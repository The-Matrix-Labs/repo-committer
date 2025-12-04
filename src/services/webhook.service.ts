import { Request, Response } from 'express'
import { TelegramService } from './telegram.service'
import { WebhookPayload } from '../types'

export class WebhookService {
    private telegramService: TelegramService

    constructor(telegramService: TelegramService) {
        this.telegramService = telegramService
    }

    async handleWebhook(req: Request, res: Response): Promise<void> {
        try {
            const payload: WebhookPayload = {
                event: req.body.event || 'unknown',
                repository: req.body.repository,
                data: req.body,
                timestamp: new Date().toISOString(),
            }

            // Format and send Telegram message
            const message = this.telegramService.formatWebhookMessage(payload.event, payload.data)

            await this.telegramService.sendMessage({
                text: message,
                parse_mode: 'HTML',
            })

            res.status(200).json({
                success: true,
                message: 'Webhook processed and notification sent',
            })
        } catch (error: any) {
            console.error('Webhook processing error:', error.message)
            res.status(500).json({
                success: false,
                message: 'Failed to process webhook',
                error: error.message,
            })
        }
    }
}
