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
            const requestBody: any = {
                chat_id: this.chatId,
                text: message.text,
                parse_mode: message.parse_mode || 'HTML',
            }

            if (message.reply_markup) {
                requestBody.reply_markup = message.reply_markup
            }

            console.log('Sending to Telegram:', JSON.stringify(requestBody, null, 2))

            const response = await axios.post(`${this.baseUrl}/sendMessage`, requestBody)

            if (!response.data.ok) {
                throw new Error(`Telegram API error: ${response.data.description}`)
            }
        } catch (error: any) {
            console.error('Failed to send Telegram message:', error.message)
            if (error.response) {
                console.error('Telegram API Response:', JSON.stringify(error.response.data, null, 2))
                console.error('Request that failed:', JSON.stringify(error.config?.data, null, 2))
            }
            throw error
        }
    }

    async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
        try {
            await axios.post(`${this.baseUrl}/answerCallbackQuery`, {
                callback_query_id: callbackQueryId,
                text: text || 'Processing...',
            })
        } catch (error: any) {
            console.error('Failed to answer callback query:', error.message)
        }
    }

    async editMessageText(messageId: number, text: string, replyMarkup?: any): Promise<void> {
        try {
            const requestBody: any = {
                chat_id: this.chatId,
                message_id: messageId,
                text,
                parse_mode: 'HTML',
            }

            if (replyMarkup) {
                requestBody.reply_markup = replyMarkup
            }

            await axios.post(`${this.baseUrl}/editMessageText`, requestBody)
        } catch (error: any) {
            console.error('Failed to edit message:', error.message)
        }
    }

    async sendMediaGroup(imageUrls: string[], caption?: string): Promise<void> {
        try {
            if (imageUrls.length === 0) return

            const media = imageUrls.map((url, index) => ({
                type: 'photo',
                media: url,
                caption: index === 0 ? caption : undefined,
                parse_mode: index === 0 ? 'HTML' : undefined,
            }))

            await axios.post(`${this.baseUrl}/sendMediaGroup`, {
                chat_id: this.chatId,
                media: media,
            })
        } catch (error: any) {
            console.error('Failed to send media group:', error.message)
            if (error.response) {
                console.error('Telegram API Response:', JSON.stringify(error.response.data, null, 2))
            }
        }
    }

    extractImageUrls(data: Record<string, any>): string[] {
        const imageUrls: string[] = []

        if (data.items && data.items.length > 0) {
            data.items.forEach((item: any) => {
                if (item.img_url && typeof item.img_url === 'string' && item.img_url.trim()) {
                    imageUrls.push(item.img_url.trim())
                }
            })
        }

        return imageUrls
    }

    formatWebhookMessage(event: string, data: Record<string, any>): TelegramMessage {
        const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })

        // Extract cart data if available
        if (data.cart_id) {
            let message = `<b>🛒 New Cart Event</b>\n\n`

            // ============ STATUS ============
            message += `<b>📊 Status:</b> 🔴 Not Contacted\n\n`

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
            message += `\n`

            // ============ PAYMENT SUMMARY ============
            message += `<b>💰 PAYMENT SUMMARY</b>\n`
            message += `━━━━━━━━━━━━━━━━━━━━━━\n`

            // Calculate subtotal (total_price + total_discount - shipping if needed)
            const subtotal = data.total_price || 0
            const tax = data.tax || 0

            message += `• Subtotal: ₹${subtotal.toLocaleString('en-IN')}\n`

            if (tax > 0) {
                message += `• Tax: ₹${tax.toLocaleString('en-IN')}\n`
            }

            const finalAmount = subtotal
            message += `• <b>Total Amount: ₹${finalAmount.toLocaleString('en-IN')}</b>\n`

            if (data.payment_status) {
                message += `• Payment Status: ${data.payment_status}\n`
            }
            message += `\n`

            // ============ NOTES ============
            message += `<b>📝 NOTES</b>\n`
            message += `━━━━━━━━━━━━━━━━━━━━━━\n`
            message += `<i>No notes yet. Click "Add Note" to add one.</i>\n\n`

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

            // Create inline keyboard buttons if phone number exists
            const buttons: TelegramMessage = {
                text: message,
                parse_mode: 'HTML',
            }

            if (data.phone_number) {
                const phoneNumber = data.phone_number.replace(/[^0-9]/g, '') // Remove non-numeric characters
                // Ensure phone number starts with country code
                const formattedPhone = phoneNumber.startsWith('91') ? phoneNumber : `91${phoneNumber}`

                buttons.reply_markup = {
                    inline_keyboard: [
                        [
                            {
                                text: '💬 WhatsApp',
                                url: `https://wa.me/${formattedPhone}`,
                            },
                        ],
                        [
                            {
                                text: '📊 Update Status',
                                callback_data: `status_${data.cart_id}`,
                            },
                            {
                                text: '📝 Add Note',
                                callback_data: `note_${data.cart_id}`,
                            },
                        ],
                    ],
                }
            }
            return buttons
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

        return {
            text: message,
            parse_mode: 'HTML',
        }
    }
}
