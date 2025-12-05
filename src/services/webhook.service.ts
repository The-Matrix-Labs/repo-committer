import { Request, Response } from 'express'
import { TelegramService } from './telegram.service'
import { CartService } from './cart.service'
import { WebhookPayload } from '../types'

export class WebhookService {
    private telegramService: TelegramService
    private cartService: CartService

    constructor(telegramService: TelegramService, cartService: CartService) {
        this.telegramService = telegramService
        this.cartService = cartService
    }

    async handleWebhook(req: Request, res: Response): Promise<void> {
        try {
            const payload: WebhookPayload = {
                event: req.body.event || 'unknown',
                repository: req.body.repository,
                data: req.body,
                timestamp: new Date().toISOString(),
            }

            // Save cart to database (wrapped in try-catch to not block message sending)
            if (payload.data.cart_id) {
                try {
                    await this.cartService.createOrUpdateCart(payload.data)
                } catch (dbError: any) {
                    console.error('Database error (continuing):', dbError.message)
                }
            }

            // Extract and send product images as media group
            const imageUrls = this.telegramService.extractImageUrls(payload.data)
            if (imageUrls.length > 0) {
                await this.telegramService.sendMediaGroup(imageUrls, '🛍️ Product Images')
            }

            // Format and send Telegram message with cart details
            const messageData = this.telegramService.formatWebhookMessage(payload.event, payload.data)
            await this.telegramService.sendMessage(messageData)

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
