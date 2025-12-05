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

            // Cart ID
            message += `<b>📋 Cart ID:</b>\n<code>${data.cart_id}</code>\n\n`

            // Stage
            message += `<b>📊 Stage:</b> ${data.latest_stage || 'N/A'}\n`
            if (data.updated_at) {
                const updatedTime = new Date(data.updated_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                message += `<b>🔄 Updated:</b> ${updatedTime}\n`
            }
            message += `\n`

            // Contact Information
            message += `<b>📱 Contact Info:</b>\n`
            if (data.first_name || data.last_name) {
                message += `• Name: ${data.first_name || ''} ${data.last_name || ''}\n`
            }
            message += `• Phone: <code>${data.phone_number || 'N/A'}</code>\n`
            if (data.phone_verified !== undefined) {
                message += `• Verified: ${data.phone_verified ? '✅' : '❌'}\n`
            }
            if (data.email) {
                message += `• Email: ${data.email}\n`
            }
            message += `\n`

            // Price Details
            message += `<b>💰 Price Details:</b>\n`
            message += `• Currency: <code>${data.currency || 'N/A'}</code>\n`
            const formattedPrice = data.total_price ? data.total_price.toLocaleString('en-IN') : '0'
            message += `• Total Price: <code>₹${formattedPrice}</code>\n`
            message += `• Items Count: ${data.item_count || 0}\n`
            if (data.shipping_price !== undefined) {
                message += `• Shipping: <code>₹${data.shipping_price}</code>\n`
            }
            if (data.total_discount !== undefined && data.total_discount > 0) {
                message += `• Discount: <code>₹${data.total_discount}</code>\n`
            }
            if (data.discount_codes && data.discount_codes.length > 0 && data.discount_codes[0] !== 'null') {
                message += `• Discount Codes: ${data.discount_codes.join(', ')}\n`
            }
            if (data.tax !== undefined) {
                message += `• Tax: <code>₹${data.tax}</code>\n`
            }
            if (data.payment_status) {
                message += `• Payment Status: ${data.payment_status}\n`
            }
            message += `\n`

            // Items Details
            if (data.items && data.items.length > 0) {
                message += `<b>🛍️ Items:</b>\n`
                data.items.forEach((item: any, index: number) => {
                    message += `${index + 1}. ${item.name || item.title}\n`
                    message += `   • Price: ₹${item.price?.toLocaleString('en-IN') || 'N/A'}\n`
                    message += `   • Quantity: ${item.quantity || 1}\n`
                    if (item.sku) {
                        message += `   • SKU: ${item.sku}\n`
                    }
                })
                message += `\n`
            } else if (data.item_name_list && data.item_name_list.length > 0) {
                message += `<b>🛍️ Items:</b>\n`
                data.item_name_list.forEach((name: string, index: number) => {
                    message += `${index + 1}. ${name}\n`
                    if (data.item_price_list && data.item_price_list[index]) {
                        message += `   • Price: ₹${parseFloat(data.item_price_list[index]).toLocaleString('en-IN')}\n`
                    }
                })
                message += `\n`
            }

            // Shipping Address (Type 1 - with full shipping details)
            if (data.shipping_address) {
                message += `<b>📦 Shipping Address:</b>\n`
                message += `${data.shipping_address.name || ''}\n`
                message += `${data.shipping_address.address1 || ''}\n`
                if (data.shipping_address.address2) {
                    message += `${data.shipping_address.address2}\n`
                }
                message += `${data.shipping_address.city || ''}, ${data.shipping_address.state || ''} - ${data.shipping_address.zip || ''}\n`
                message += `${data.shipping_address.country || ''}\n`
                message += `Phone: <code>${data.shipping_address.phone || ''}</code>\n\n`
            }

            // Billing Address (if different from shipping)
            if (data.billing_address && data.billing_address !== data.shipping_address) {
                message += `<b>💳 Billing Address:</b>\n`
                message += `${data.billing_address.name || ''}\n`
                message += `${data.billing_address.address1 || ''}\n`
                if (data.billing_address.address2) {
                    message += `${data.billing_address.address2}\n`
                }
                message += `${data.billing_address.city || ''}, ${data.billing_address.state || ''} - ${data.billing_address.zip || ''}\n`
                message += `${data.billing_address.country || ''}\n\n`
            }

            // Additional Info
            message += `<b>ℹ️ Additional Info:</b>\n`
            if (data.rtoPredict) {
                message += `• RTO Predict: ${data.rtoPredict}\n`
            }

            // Custom Attributes / Cart Attributes
            const customAttrs = data.custom_attributes || data.cart_attributes
            if (customAttrs?.ipv4_address) {
                message += `• IP Address: <code>${customAttrs.ipv4_address}</code>\n`
            }
            message += `\n<b>🕒 Notification Time:</b> ${timestamp}`

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
