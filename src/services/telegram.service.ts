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
        const timestamp = new Date().toLocaleString()

        // Extract cart data if available
        if (data.cart_id) {
            let message = `<b>🛒 New Cart Event</b>\n\n`

            message += `<b>📋 Cart ID:</b>\n<code>${data.cart_id}</code>\n\n`

            message += `<b>💰 Price Details:</b>\n`
            message += `• Currency: <code>${data.currency || 'N/A'}</code>\n`
            const formattedPrice = data.total_price ? data.total_price.toLocaleString('en-IN') : '0'
            message += `• Total: <code>${formattedPrice}</code>\n`
            message += `• Items: ${data.item_count || 0}\n\n`

            message += `<b>📱 Contact Info:</b>\n`
            message += `• Phone: <code>${data.phone_number || 'N/A'}</code>\n`
            message += `• Verified: ${data.phone_verified ? '✅' : '❌'}\n\n`

            message += `<b>📊 Stage:</b> ${data.latest_stage || 'N/A'}\n`
            message += `<b>🏪 Source:</b> ${data.source_name || 'N/A'}\n`
            message += `<b>🕒 Time:</b> ${timestamp}\n`

            if (data.cart_attributes?.ipv4_address) {
                message += `\n<b>🌐 IP:</b> <code>${data.cart_attributes.ipv4_address}</code>\n`
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
