import cron from 'node-cron'
import { TelegramService } from './telegram.service'
import { ShiprocketOrder, ShiprocketService } from './shiprocket.service'
import { ShiprocketUndeliveredOrderService } from './shiprocketUndelivered.service'
import { IOrderSummaryMetrics, ReportPeriod } from '../models/orderSummary.model'

export interface ReportingOptions {
    timezone?: string
    dailyLookbackDays?: number
    weeklyLookbackDays?: number
    monthlyLookbackDays?: number
}

export interface ScheduleOptions {
    timezone?: string
    dailyTime?: string // HH:mm (24h)
    weeklyTime?: string // HH:mm (24h)
    weeklyDay?: number // 0-6 (Sun-Sat)
    monthlyTime?: string // HH:mm (24h)
    monthlyDay?: number // 1-31
    pollingIntervalMs?: number
}

export class ReportingService {
    private timezone: string
    private dailyLookbackDays: number
    private weeklyLookbackDays: number
    private monthlyLookbackDays: number
    private static readonly CANCELLED_CODES = new Set([5, 18, 54])
    private static readonly DELIVERED_CODES = new Set([7, 38])
    private static readonly UNDELIVERED_CODES = new Set([36, 50, 88, 89, 90])
    private static readonly RETURN_CODES = new Set([9, 15, 16, 17, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 45, 46, 47, 48, 55, 68, 87])
    private static readonly IN_TRANSIT_CODES = new Set([3, 4, 6, 19, 20, 34, 37, 43, 44, 45, 46, 47, 48, 62, 64, 65, 66, 67, 70, 71, 72, 73, 74, 75, 76, 80, 81, 82, 83])

    constructor(
        private shiprocketService: ShiprocketService,
        private telegramService: TelegramService,
        private undeliveredOrderService?: ShiprocketUndeliveredOrderService,
        options?: ReportingOptions
    ) {
        this.timezone = options?.timezone || 'Asia/Kolkata'
        this.dailyLookbackDays = options?.dailyLookbackDays || 1
        this.weeklyLookbackDays = options?.weeklyLookbackDays || 7
        this.monthlyLookbackDays = options?.monthlyLookbackDays || 30
    }

    async run(period: ReportPeriod): Promise<void> {
        const { message, orders } = await this.generateReport(period)
        await this.telegramService.sendMessage({
            text: message,
            parse_mode: 'HTML',
        })
        await this.notifyUndeliveredOrders(orders)
    }

    async generateReport(period: ReportPeriod): Promise<{ message: string; orders: ShiprocketOrder[] }> {
        const { start, end } = this.resolveRange(period)
        const orders = await this.shiprocketService.fetchOrders(start, end)
        const metrics = this.calculateMetrics(orders)

        const message = this.formatMessage(period, start, end, metrics)
        return { message, orders }
    }

    private resolveRange(period: ReportPeriod): { start: Date; end: Date } {
        const now = this.getNowInTimezone()
        const end = new Date(now)
        end.setHours(23, 59, 59, 999)

        const start = new Date(end)
        const lookback =
            period === 'daily' ? this.dailyLookbackDays : period === 'weekly' ? this.weeklyLookbackDays : this.monthlyLookbackDays
        start.setDate(end.getDate() - (lookback - 1))
        start.setHours(0, 0, 0, 0)

        return { start, end }
    }

    private calculateMetrics(orders: ShiprocketOrder[]): IOrderSummaryMetrics {
        const metrics: IOrderSummaryMetrics = {
            totalOrders: orders.length,
            totalOrderValue: 0,
            cancelled: { count: 0, value: 0 },
            delivered: { count: 0, value: 0 },
            undelivered: { count: 0, value: 0 },
            inTransit: { count: 0, value: 0 },
            returns: { count: 0, value: 0 },
        }

        orders.forEach(order => {
            const statusText = (order.status || '').toString().toUpperCase()
            const statusCode = this.normalizeStatusCode(order.status_code)
            const grossAmount = this.parseAmount(order.total)
            const taxAmount = this.parseAmount((order as any).tax)
            const amount = Math.max(grossAmount - taxAmount, 0)
            metrics.totalOrderValue += amount

            if (this.isReturnStatus(statusText, statusCode)) {
                metrics.returns.count += 1
                metrics.returns.value += amount
                return
            }

            if (this.isCancelledStatus(statusText, statusCode)) {
                metrics.cancelled.count += 1
                metrics.cancelled.value += amount
                return
            }

            if (this.isDeliveredStatus(statusText, statusCode)) {
                metrics.delivered.count += 1
                metrics.delivered.value += amount
                return
            }

            if (this.isUndeliveredStatus(statusText, statusCode)) {
                metrics.undelivered.count += 1
                metrics.undelivered.value += amount
                return
            }

            if (this.isInTransitStatus(statusText, statusCode)) {
                metrics.inTransit.count += 1
                metrics.inTransit.value += amount
            }
        })

        return metrics
    }

    async notifyUndeliveredOrders(
        orders: ShiprocketOrder[],
        sender?: (message: { text: string; parse_mode: 'HTML'; reply_markup?: any }) => Promise<any>
    ): Promise<void> {
        const undelivered = orders.filter(order => {
            const statusText = (order.status || '').toString().toUpperCase()
            const statusCode = this.normalizeStatusCode(order.status_code)
            return this.isUndeliveredStatus(statusText, statusCode)
        })

        for (const order of undelivered) {
            try {
                const record = this.undeliveredOrderService
                    ? await this.undeliveredOrderService.upsertFromShiprocketOrder(order)
                    : undefined
                const message = record
                    ? this.undeliveredOrderService!.formatMessage(record)
                    : this.formatUndeliveredOrderMessage(order)
                const sent = sender ? await sender(message) : await this.telegramService.sendMessage(message)
                const messageId = (sent as any)?.message_id
                if (this.undeliveredOrderService && messageId) {
                    await this.undeliveredOrderService.upsertFromShiprocketOrder(order, messageId)
                }
            } catch (error: any) {
                console.error('Failed to send undelivered order notification:', error?.message || error)
            }
        }
    }

    private normalizeStatusCode(statusCode?: number | string): number | undefined {
        if (typeof statusCode === 'number') {
            return statusCode
        }
        if (typeof statusCode === 'string' && statusCode.trim() !== '') {
            const parsed = parseInt(statusCode, 10)
            return Number.isNaN(parsed) ? undefined : parsed
        }
        return undefined
    }

    private parseAmount(value: string | number | undefined): number {
        if (typeof value === 'number') {
            return value
        }
        if (typeof value === 'string') {
            const parsed = parseFloat(value)
            return Number.isNaN(parsed) ? 0 : parsed
        }
        return 0
    }

    private isCancelledStatus(status: string, statusCode?: number): boolean {
        return (
            ReportingService.CANCELLED_CODES.has(statusCode ?? -1) ||
            status.includes('CANCELLED') ||
            status.includes('CANCELED') ||
            status.includes('CANCELLATION REQUESTED')
        )
    }

    private isDeliveredStatus(status: string, statusCode?: number): boolean {
        // Avoid counting undelivered variants as delivered
        return (
            ReportingService.DELIVERED_CODES.has(statusCode ?? -1) ||
            status === 'DELIVERED' ||
            status.includes(' DELIVERED') ||
            status === 'ORDER DELIVERED' ||
            status.includes('PARTIAL DELIVERED')
        )
    }

    private isUndeliveredStatus(status: string, statusCode?: number): boolean {
        return (
            ReportingService.UNDELIVERED_CODES.has(statusCode ?? -1) ||
            status.includes('UNDELIVERED') ||
            status.includes('NOT DELIVERED') ||
            status.includes('FAILED DELIVERY') ||
            status.includes('UNTRACEABLE') ||
            status.includes('ISSUE_RELATED_TO_THE_RECIPIENT')
        )
    }

    private isInTransitStatus(status: string, statusCode?: number): boolean {
        return (
            ReportingService.IN_TRANSIT_CODES.has(statusCode ?? -1) ||
            status.includes('TRANSIT') ||
            status.includes('IN TRANSIT') ||
            status.includes('OUT FOR DELIVERY') ||
            status.includes('OUT FOR PICKUP') ||
            status.includes('SHIPPED') ||
            status.includes('PICKUP') ||
            status.includes('QUEUED') ||
            status.includes('ALLOCATED') ||
            status.includes('SCHEDULED') ||
            status.includes('PACKED') ||
            status.includes('MANIFEST')
        )
    }

    private isReturnStatus(status: string, statusCode?: number): boolean {
        return (
            ReportingService.RETURN_CODES.has(statusCode ?? -1) ||
            status.includes('RETURN') ||
            status.includes('RTO')
        )
    }

    private formatMessage(period: ReportPeriod, start: Date, end: Date, metrics: IOrderSummaryMetrics): string {
        const formatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: this.timezone,
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        })

        const startStr = formatter.format(start)
        const endStr = formatter.format(end)
        const totalOrders = metrics.totalOrders || 0

        return [
            `<b>📦 Shiprocket ${this.capitalize(period)} Report</b>`,
            `🗓 <b>Period:</b> ${startStr} → ${endStr}`,
            '',
            `<b>📊 Totals</b>`,
            `• Orders: <b>${metrics.totalOrders}</b>`,
            `• Value: <b>${this.formatCurrency(metrics.totalOrderValue)}</b>`,
            '',
            `<b>🚥 Status Split</b>`,
            `✅ Delivered: <b>${metrics.delivered.count}</b> (${this.formatCurrency(metrics.delivered.value)}) — ${this.formatRate(metrics.delivered.count, totalOrders)}`,
            `🚫 Cancelled: <b>${metrics.cancelled.count}</b> (${this.formatCurrency(metrics.cancelled.value)}) — ${this.formatRate(metrics.cancelled.count, totalOrders)}`,
            `⚠️ Undelivered: <b>${metrics.undelivered.count}</b> (${this.formatCurrency(metrics.undelivered.value)}) — ${this.formatRate(metrics.undelivered.count, totalOrders)}`,
            `📦 In Transit: <b>${metrics.inTransit.count}</b> (${this.formatCurrency(metrics.inTransit.value)}) — ${this.formatRate(metrics.inTransit.count, totalOrders)}`,
            `↩️ Returns: <b>${metrics.returns.count}</b> (${this.formatCurrency(metrics.returns.value)}) — ${this.formatRate(metrics.returns.count, totalOrders)}`,
        ].join('\n')
    }

    private formatUndeliveredOrderMessage(order: ShiprocketOrder): { text: string; parse_mode: 'HTML'; reply_markup?: any } {
        const gross = this.parseAmount(order.total)
        const tax = this.parseAmount((order as any).tax)
        const net = Math.max(gross - tax, 0)
        const phoneRaw = ((order as any).customer_phone || '').toString()
        const phoneDigits = phoneRaw.replace(/[^0-9]/g, '')
        const phoneFormatted = phoneDigits ? (phoneDigits.startsWith('91') ? phoneDigits : `91${phoneDigits}`) : undefined
        const orderCode = (order as any).channel_order_id || order.id
        const statusText = order.status || 'Undelivered'
        const statusCode = this.normalizeStatusCode(order.status_code)
        const addressBlock = this.formatAddress(order as any)
        const itemsBlock = this.formatProducts((order as any).products)

        const lines = [
            `<b>🚨 Undelivered Order</b>`,
            `Order: ${orderCode}`,
            `Status: ${statusText}${statusCode ? ` (code ${statusCode})` : ''}`,
            `\n<b>👤 Customer</b>`,
            `${(order as any).customer_name || 'N/A'}`,
            (order as any).customer_email ? `${(order as any).customer_email}` : '',
            phoneFormatted ? `+${phoneFormatted}` : '',
        ].filter(Boolean)

        if ((order as any).pickup_location || addressBlock) {
            lines.push(`\n<b>📦 Shipping Address</b>`)
            const destination = (order as any).pickup_location ? `Pickup: ${(order as any).pickup_location}` : ''
            if (destination.trim()) lines.push(destination)
            if (addressBlock) lines.push(addressBlock)
        }

        if (itemsBlock) {
            lines.push(`\n<b>🛒 Items</b>`, itemsBlock)
        }

        lines.push(
            `\n<b>💰 Payment Summary</b>`,
            `• Total: ${this.formatCurrency(gross)}`,
            `• Tax: ${this.formatCurrency(tax)}`,
            `• Net: ${this.formatCurrency(net)}`,
            `\n<b>📊 Status & Notes</b>`,
            `🔴 Not Contacted`, // placeholder; actual seller status will appear when stored model formats
            `<i>No notes</i>`
        )

        const message: { text: string; parse_mode: 'HTML'; reply_markup?: any } = {
            text: lines.join('\n'),
            parse_mode: 'HTML',
        }

        const inline_keyboard: any[] = []
        if (phoneFormatted) {
            inline_keyboard.push([
                {
                    text: 'WhatsApp',
                    url: `https://wa.me/${phoneFormatted}`,
                },
            ])
        }
        inline_keyboard.push([
            { text: 'Update Status', callback_data: `srundelivered:update:${order.id}` },
            { text: 'Add Note', callback_data: `srundelivered:note:${order.id}` },
        ])

        message.reply_markup = { inline_keyboard }
        return message
    }

    private formatAddress(order: any): string {
        const address = order?.shipping_address || order?.delivery_address || order?.billing_address
        if (!address) {
            return ''
        }

        const parts = [address.name, address.address1, address.address2, address.city, address.state, address.zip, address.country]
        const cleaned = parts.filter(Boolean).join(', ')
        return cleaned ? cleaned : ''
    }

    private formatProducts(products: any[] | undefined): string {
        if (!Array.isArray(products) || products.length === 0) {
            return ''
        }

        return products
            .map((item, idx) => {
                const qty = item.quantity ?? 1
                const price = item.price ?? item.total ?? 0
                const name = item.name || item.title || item.channel_sku || `Item ${idx + 1}`
                return `${idx + 1}. <b>${name}</b>\n   • Qty: ${qty}\n   • Value: ${this.formatCurrency(this.parseAmount(price))}`
            })
            .join('\n')
    }

    private formatCurrency(amount: number): string {
        return `₹${(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
    }

    private formatRate(count: number, total: number): string {
        if (!total) {
            return '0%'
        }
        const rate = (count / total) * 100
        return `${rate.toFixed(1)}%`
    }

    private capitalize(value: string): string {
        return value.charAt(0).toUpperCase() + value.slice(1)
    }

    private getNowInTimezone(): Date {
        const now = new Date()
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: this.timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        })
            .formatToParts(now)
            .reduce<Record<string, number>>((acc, part) => {
                if (part.type !== 'literal') {
                    acc[part.type] = parseInt(part.value, 10)
                }
                return acc
            }, {})

        return new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
    }
}

export class ReportingScheduler {
    private timezone: string
    private dailyTime: string
    private weeklyTime: string
    private weeklyDay: number
    private monthlyTime: string
    private monthlyDay: number
    private tasks: cron.ScheduledTask[] = []
    private running: Record<ReportPeriod, boolean> = { daily: false, weekly: false, monthly: false }

    constructor(private reportingService: ReportingService, options?: ScheduleOptions) {
        this.timezone = options?.timezone || 'Asia/Kolkata'
        this.dailyTime = options?.dailyTime || '09:00'
        this.weeklyTime = options?.weeklyTime || '09:10'
        this.weeklyDay = options?.weeklyDay !== undefined ? options.weeklyDay : 1 // Monday
        this.monthlyTime = options?.monthlyTime || '09:15'
        this.monthlyDay = options?.monthlyDay || 1
    }

    start(): void {
        this.tasks.forEach(task => task.stop())
        this.tasks = []

        this.tasks.push(
            cron.schedule(this.toCronExpression(this.dailyTime), () => this.runSafely('daily'), { timezone: this.timezone })
        )

        this.tasks.push(
            cron.schedule(this.toCronExpression(this.weeklyTime, undefined, this.weeklyDay), () => this.runSafely('weekly'), {
                timezone: this.timezone,
            })
        )

        this.tasks.push(
            cron.schedule(this.toCronExpression(this.monthlyTime, this.monthlyDay), () => this.runSafely('monthly'), {
                timezone: this.timezone,
            })
        )

        console.log(
            `• Shiprocket reporting scheduler started (daily ${this.dailyTime}, weekly day ${this.weeklyDay} @ ${this.weeklyTime}, monthly day ${this.monthlyDay} @ ${this.monthlyTime}, tz ${this.timezone})`
        )
    }

    stop(): void {
        this.tasks.forEach(task => task.stop())
        this.tasks = []
    }

    private async runSafely(period: ReportPeriod): Promise<void> {
        if (this.running[period]) {
            return
        }

        this.running[period] = true
        try {
            await this.reportingService.run(period)
            console.log(`• Shiprocket ${period} report generated and sent`)
        } catch (error: any) {
            console.error(`Failed to generate ${period} report:`, error?.message || error)
        } finally {
            this.running[period] = false
        }
    }

    private toCronExpression(timeStr: string, dayOfMonth?: number, dayOfWeek?: number): string {
        const { hours, minutes } = this.parseTime(timeStr)
        const dom = dayOfMonth !== undefined ? Math.max(1, Math.min(31, dayOfMonth)) : '*'
        const dow = dayOfWeek !== undefined ? Math.max(0, Math.min(7, dayOfWeek)) : '*'
        // second minute hour day-of-month month day-of-week
        return `0 ${minutes} ${hours} ${dom} * ${dow}`
    }

    private parseTime(timeStr: string): { hours: number; minutes: number } {
        const [hourStr, minuteStr] = timeStr.split(':')
        const hours = Math.max(0, Math.min(23, parseInt(hourStr || '0', 10)))
        const minutes = Math.max(0, Math.min(59, parseInt(minuteStr || '0', 10)))
        return { hours, minutes }
    }
}
