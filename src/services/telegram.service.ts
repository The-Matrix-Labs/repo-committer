import axios from 'axios'
import { TelegramMessage } from '../types'

export class TelegramService {
    private botToken: string
    private chatId: string
    private baseUrl: string

    constructor(botToken: string, chatId: string) {
        this.botToken = botToken
        this.chatId = chatId
        this.baseUrl = `https://api.telegram.org/bot${botToken}`
    }

    async sendMessage(message: TelegramMessage): Promise<void> {
        try {
            const response = await axios.post(`${this.baseUrl}/sendMessage`, {
                chat_id: this.chatId,
                text: message.text,
                parse_mode: message.parse_mode || 'HTML',
            })

            if (!response.data.ok) {
                throw new Error(`Telegram API error: ${response.data.description}`)
            }
        } catch (error: any) {
            console.error('Failed to send Telegram message:', error.message)
            throw error
        }
    }

    formatWebhookMessage(event: string, data: Record<string, any>): string {
        const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })

        // Extract cart data if available
        if (data.cart_id) {
            let message = `<b>🛒 New Cart Event</b>\n\n`

            // ============ CART DETAILS ============
            message += `<b>📋 CART DETAILS</b>\n`
            message += `━━━━━━━━━━━━━━━━━━━━━━\n`
            message += `• Cart ID: <code>${data.cart_id}</code>\n`
            message += `• Stage: ${data.latest_stage || 'N/A'}\n`
            if (data.updated_at) {
                const updateDate = new Date(data.updated_at)
                const dateStr = updateDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
                const timeStr = updateDate.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
                message += `• Date: ${dateStr}\n`
                message += `• Time: ${timeStr}\n`
            }
            message += `\n`

            // ============ ITEM DETAILS ============
            message += `<b>🛍️ ITEM DETAILS</b>\n`
            message += `━━━━━━━━━━━━━━━━━━━━━━\n`
            if (data.items && data.items.length > 0) {
                data.items.forEach((item: any, index: number) => {
                    message += `${index + 1}. <b>${item.name || item.title}</b>\n`
                    message += `   • Quantity: ${item.quantity || 1}\n`
                    message += `   • Price: ₹${item.price?.toLocaleString('en-IN') || 'N/A'}\n`
                    if (item.sku) {
                        message += `   • SKU: ${item.sku}\n`
                    }
                    message += `\n`
                })
            } else if (data.item_name_list && data.item_name_list.length > 0) {
                data.item_name_list.forEach((name: string, index: number) => {
                    message += `${index + 1}. <b>${name}</b>\n`
                    message += `   • Quantity: 1\n`
                    if (data.item_price_list && data.item_price_list[index]) {
                        message += `   • Price: ₹${parseFloat(data.item_price_list[index]).toLocaleString('en-IN')}\n`
                    }
                    message += `\n`
                })
            }

            // ============ CUSTOMER DETAILS ============
            message += `<b>👤 CUSTOMER DETAILS</b>\n`
            message += `━━━━━━━━━━━━━━━━━━━━━━\n`
            if (data.first_name || data.last_name) {
                message += `• Name: ${data.first_name || ''} ${data.last_name || ''}\n`
            }
            if (data.email) {
                message += `• Email: ${data.email}\n`
            }
            message += `• Phone: <code>${data.phone_number || 'N/A'}</code>\n`
            if (data.phone_verified !== undefined) {
                message += `• Phone Verified: ${data.phone_verified ? '✅ Yes' : '❌ No'}\n`
            }

            if (data.shipping_address) {
                message += `\n<b>📦 Shipping Address:</b>\n`
                message += `${data.shipping_address.name || ''}\n`
                message += `${data.shipping_address.address1 || ''}\n`
                if (data.shipping_address.address2) {
                    message += `${data.shipping_address.address2}\n`
                }
                message += `${data.shipping_address.city || ''}, ${data.shipping_address.state || ''} - ${data.shipping_address.zip || ''}\n`
                message += `${data.shipping_address.country || ''}\n`
                message += `Phone: <code>${data.shipping_address.phone || ''}</code>\n`
            }
            message += `\n`

            // ============ CART METADATA ============
            message += `<b>⚙️ CART METADATA</b>\n`
            message += `━━━━━━━━━━━━━━━━━━━━━━\n`

            // Applied Rules
            message += `<b>Applied Rules:</b>\n`
            if (data.shipping_price !== undefined) {
                message += `• Shipping Charge: ₹${data.shipping_price}\n`
            }
            if (data.rtoPredict) {
                message += `• RTO Predict: ${data.rtoPredict}\n`
            }

            // Cart Attributes
            const customAttrs = data.custom_attributes || data.cart_attributes
            if (customAttrs) {
                message += `\n<b>Cart Attributes:</b>\n`
                if (customAttrs.shopifyCartToken) {
                    message += `• Shopify Cart Token: <code>${customAttrs.shopifyCartToken}</code>\n`
                }
                if (customAttrs.landing_page_url) {
                    message += `• Landing Page: ${customAttrs.landing_page_url}\n`
                }
                if (customAttrs.ipv4_address) {
                    message += `• IP Address: <code>${customAttrs.ipv4_address}</code>\n`
                }
            }
            message += `\n`

            // ============ PAYMENT SUMMARY ============
            message += `<b>💰 PAYMENT SUMMARY</b>\n`
            message += `━━━━━━━━━━━━━━━━━━━━━━\n`

            // Calculate subtotal (total_price + total_discount - shipping if needed)
            const subtotal = data.total_price || 0
            const shipping = data.shipping_price || 0
            const discount = data.total_discount || 0
            const tax = data.tax || 0

            message += `• Subtotal: ₹${subtotal.toLocaleString('en-IN')}\n`
            message += `• Shipping Charges: ₹${shipping.toLocaleString('en-IN')}\n`

            if (data.discount_codes && data.discount_codes.length > 0 && data.discount_codes[0] !== 'null') {
                message += `• Discount Code: ${data.discount_codes.join(', ')}\n`
            }

            if (discount > 0) {
                message += `• Prepaid Discount: -₹${discount.toLocaleString('en-IN')}\n`
            }

            if (tax > 0) {
                message += `• Tax: ₹${tax.toLocaleString('en-IN')}\n`
            }

            const finalAmount = subtotal
            message += `• <b>Total Amount: ₹${finalAmount.toLocaleString('en-IN')}</b>\n`

            if (data.payment_status) {
                message += `• Payment Status: ${data.payment_status}\n`
            }

            return message
        }

        // Fallback to generic format
        let message = `<b>🔔 Webhook Event Received</b>\n\n`
        message += `<b>Event:</b> ${event}\n`
        message += `<b>Time:</b> ${timestamp}\n\n`

        if (data.repository) {
            message += `<b>Repository:</b> ${data.repository}\n`
        }

        message += `<b>Data:</b>\n`
        message += `<pre>${JSON.stringify(data, null, 2)}</pre>`

        return message
    }
}
