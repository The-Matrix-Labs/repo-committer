export interface WebhookPayload {
    event: string
    repository?: string
    data: Record<string, any>
    timestamp: string
}

export interface TelegramMessage {
    text: string
    parse_mode?: 'HTML' | 'Markdown'
}
