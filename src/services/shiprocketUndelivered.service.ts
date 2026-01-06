import { Model } from 'mongoose'
import { IShiprocketUndeliveredOrder, ShiprocketUndeliveredModel } from '../models/shiprocketUndelivered.model'
import { ShiprocketOrder } from './shiprocket.service'

export class ShiprocketUndeliveredOrderService {
    private model: Model<IShiprocketUndeliveredOrder>

    constructor() {
        this.model = ShiprocketUndeliveredModel
    }

    async upsertFromShiprocketOrder(order: ShiprocketOrder, telegramMessageId?: number): Promise<IShiprocketUndeliveredOrder> {
        const existing = await this.model.findOne({ order_id: `${order.id}` })
        const gross = this.parseAmount(order.total)
        const tax = this.parseAmount((order as any).tax)
        const netTotal = Math.max(gross - tax, 0)
        const sellerStatus: IShiprocketUndeliveredOrder['seller_status'] =
            existing?.seller_status || 'Not Contacted'
        const sellerNote = existing?.seller_note

        const payload = {
            order_id: `${order.id}`,
            channel_order_id: (order as any).channel_order_id,
            channel_id: (order as any).channel_id,
            status: order.status,
            status_code: this.normalizeStatusCode(order.status_code),
            seller_status: sellerStatus,
            seller_note: sellerNote,
            customer_name: (order as any).customer_name,
            customer_email: (order as any).customer_email,
            customer_phone: (order as any).customer_phone,
            pickup_location: (order as any).pickup_location,
            shipping_address: (order as any).shipping_address,
            products: (order as any).products,
            shipments: (order as any).shipments,
            payment_method: (order as any).payment_method,
            total: gross,
            tax,
            net_total: netTotal,
            telegram_message_id: telegramMessageId,
            metadata: order,
        }

        const result = await this.model.findOneAndUpdate({ order_id: `${order.id}` }, payload, {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
        })

        return result
    }

    async updateSellerStatus(orderId: string, status: IShiprocketUndeliveredOrder['seller_status']): Promise<IShiprocketUndeliveredOrder | null> {
        return this.model.findOneAndUpdate(
            { order_id: orderId },
            { seller_status: status },
            { new: true, upsert: false }
        )
    }

    async addNote(orderId: string, note: string): Promise<IShiprocketUndeliveredOrder | null> {
        return this.model.findOneAndUpdate({ order_id: orderId }, { seller_note: note }, { new: true })
    }

    async get(orderId: string): Promise<IShiprocketUndeliveredOrder | null> {
        return this.model.findOne({ order_id: orderId })
    }

    formatMessage(record: IShiprocketUndeliveredOrder): { text: string; parse_mode: 'HTML'; reply_markup: any } {
        const gross = this.parseAmount(record.total)
        const tax = this.parseAmount(record.tax)
        const net = Math.max(gross - tax, 0)
        const phoneRaw = (record.customer_phone || '').toString()
        const phoneDigits = phoneRaw.replace(/[^0-9]/g, '')
        const phoneFormatted = phoneDigits ? (phoneDigits.startsWith('91') ? phoneDigits : `91${phoneDigits}`) : undefined
        const orderCode = record.channel_order_id || record.order_id
        const statusText = record.status || 'Undelivered'
        const statusCode = record.status_code
        const sellerStatus = record.seller_status || 'Not Contacted'
        const sellerNote = record.seller_note
        const statusEmoji: Record<typeof sellerStatus, string> = {
            'Not Contacted': '🔴',
            'Called and Converted': '✅',
            'Called but Not Converted': '❌',
        }

        const address = (record as any).shipping_address || (record as any).delivery_address || (record as any).billing_address
        const addressParts = address
            ? [address.name, address.address1, address.address2, address.city, address.state, address.zip, address.country]
                  .filter(Boolean)
                  .join(', ')
            : ''

        const products = (record as any).products || (record.metadata as any)?.products
        const itemsBlock = Array.isArray(products)
            ? products
                  .map((item: any, idx: number) => {
                      const qty = item.quantity ?? 1
                      const price = this.parseAmount(item.price ?? item.total)
                      const name = item.name || item.title || item.channel_sku || `Item ${idx + 1}`
                      return `${idx + 1}. <b>${name}</b>\n   • Qty: ${qty}\n   • Value: ${this.formatCurrency(price)}`
                  })
                  .join('\n')
            : ''

        const lines = [
            `<b>🚨 Undelivered Order</b>`,
            `Order: ${orderCode}`,
            `Status: ${statusText}${statusCode ? ` (code ${statusCode})` : ''}`,
            `\n<b>👤 Customer</b>`,
            `${record.customer_name || 'N/A'}`,
            record.customer_email ? `${record.customer_email}` : '',
            phoneFormatted ? `+${phoneFormatted}` : '',
        ].filter(Boolean)

        if (addressParts) {
            lines.push(`\n<b>📦 Shipping Address</b>`, addressParts)
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
            `${statusEmoji[sellerStatus]} ${sellerStatus}`,
            sellerNote?.trim() ? sellerNote : '<i>No notes</i>'
        )

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
            { text: 'Update Status', callback_data: `srundelivered:update:${record.order_id}` },
            { text: 'Add Note', callback_data: `srundelivered:note:${record.order_id}` },
        ])

        return {
            text: lines.join('\n'),
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard },
        }
    }

    private parseAmount(value: string | number | undefined): number {
        if (typeof value === 'number') return value
        if (typeof value === 'string') {
            const parsed = parseFloat(value)
            return Number.isNaN(parsed) ? 0 : parsed
        }
        return 0
    }

    private formatCurrency(amount: number): string {
        return `₹${(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
    }

    private normalizeStatusCode(statusCode?: number | string): number | undefined {
        if (typeof statusCode === 'number') return statusCode
        if (typeof statusCode === 'string' && statusCode.trim() !== '') {
            const parsed = parseInt(statusCode, 10)
            return Number.isNaN(parsed) ? undefined : parsed
        }
        return undefined
    }
}
