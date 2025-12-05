export interface WebhookPayload {
    event: string
    repository?: string
    data: Record<string, any>
    timestamp: string
}

export interface TelegramMessage {
    text: string
    parse_mode?: 'HTML' | 'Markdown'
    reply_markup?: {
        inline_keyboard: Array<
            Array<{
                text: string
                url?: string
                callback_data?: string
            }>
        >
    }
}
