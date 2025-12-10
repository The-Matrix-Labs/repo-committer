import { Request, Response } from 'express'
import { TelegramService } from './telegram.service'
import { CartService } from './cart.service'
import { CallbackService } from './callback.service'
import { WebhookPayload } from '../types'

export class WebhookService {
    private telegramService: TelegramService
    private cartService: CartService
    private callbackService: CallbackService

    constructor(telegramService: TelegramService, cartService: CartService, callbackService: CallbackService) {
        this.telegramService = telegramService
        this.cartService = cartService
        this.callbackService = callbackService
    }

    async handleWebhook(req: Request, res: Response): Promise<void> {
        try {
            const payload: WebhookPayload = {
                event: req.body.event || 'unknown',
                repository: req.body.repository,
                data: req.body,
                timestamp: new Date().toISOString(),
            }

            if (!payload.data.cart_id) {
                res.status(400).json({
                    success: false,
                    message: 'No cart_id provided',
                })
                return
            }

            // Check if cart already exists
            const existingCart = await this.cartService.getCart(payload.data.cart_id)

            // Determine event type based on data richness
            // Phone Received: No shipping address and no item details
            // Abandon Cart: Has shipping address OR has item details (items array or item_name_list)
            const hasShippingAddress = payload.data.shipping_address && Object.keys(payload.data.shipping_address).length > 0
            const hasItemDetails = (payload.data.items && payload.data.items.length > 0) || (payload.data.item_name_list && payload.data.item_name_list.length > 0)

            const isPhoneReceived = !hasShippingAddress && !hasItemDetails
            const isAbandonCart = hasShippingAddress || hasItemDetails

            // Save/update cart to database
            const updatedCart = await this.cartService.createOrUpdateCart(payload.data)

            // Decision logic for Telegram message
            let shouldSendNewMessage = false
            let shouldUpdateMessage = false

            if (!existingCart) {
                // Case 2 (AC first) or Case 3 (PR first) - No existing cart, send new message
                shouldSendNewMessage = true
            } else if (existingCart.telegram_message_id) {
                // Cart exists with Telegram message
                // Determine if existing cart had rich data
                const existingHasShippingAddress = existingCart.shipping_address && Object.keys(existingCart.shipping_address).length > 0
                const existingHasItemDetails = (existingCart.items && existingCart.items.length > 0) || (existingCart.item_name_list && existingCart.item_name_list.length > 0)
                const existingIsAbandonCart = existingHasShippingAddress || existingHasItemDetails

                if (isAbandonCart && !existingIsAbandonCart) {
                    // Case 1: PR -> AC - Update existing message with better data
                    shouldUpdateMessage = true
                } else if (isPhoneReceived && existingIsAbandonCart) {
                    // Case 4: AC -> PR - Don't send or update (AC data is better)
                    shouldSendNewMessage = false
                    shouldUpdateMessage = false
                } else {
                    // Same event type again - update the message
                    shouldUpdateMessage = true
                }
            } else {
                // Cart exists but no message ID (shouldn't happen, but handle it)
                shouldSendNewMessage = true
            }

            // Handle Telegram messaging
            if (shouldSendNewMessage) {
                // Send product images first
                const imageUrls = this.telegramService.extractImageUrls(payload.data)
                if (imageUrls.length > 0) {
                    await this.telegramService.sendMediaGroup(imageUrls, '🛍️ Product Images ⬇️')
                }

                // Fetch the latest cart data from DB (includes status and notes)
                const latestCart = await this.cartService.getCart(payload.data.cart_id)
                if (!latestCart) {
                    throw new Error('Cart not found after creation')
                }

                // Use formatCartMessage to preserve status and notes
                const messageData = await this.callbackService.formatCartMessage(latestCart)
                const sentMessage = await this.telegramService.sendMessage(messageData)

                // Update cart with telegram message ID
                if (sentMessage && sentMessage.message_id) {
                    await this.cartService.updateTelegramMessageId(payload.data.cart_id, sentMessage.message_id)
                }
            } else if (shouldUpdateMessage && existingCart?.telegram_message_id) {
                // Fetch the latest cart data from DB (includes status and notes)
                const latestCart = await this.cartService.getCart(payload.data.cart_id)
                if (!latestCart) {
                    throw new Error('Cart not found')
                }

                // Check if this is an upgrade from Phone Received to Abandon Cart (Scenario 1)
                const existingHasShippingAddress = existingCart.shipping_address && Object.keys(existingCart.shipping_address).length > 0
                const existingHasItemDetails = (existingCart.items && existingCart.items.length > 0) || (existingCart.item_name_list && existingCart.item_name_list.length > 0)
                const existingIsAbandonCart = existingHasShippingAddress || existingHasItemDetails

                // If upgrading from phone event to abandon cart event, send images
                if (isAbandonCart && !existingIsAbandonCart) {
                    const imageUrls = this.telegramService.extractImageUrls(payload.data)
                    if (imageUrls.length > 0) {
                        await this.telegramService.sendMediaGroup(imageUrls, '🛍️ Product Images ⬆️')
                    }
                }

                // Use formatCartMessage to preserve status and notes
                const messageData = await this.callbackService.formatCartMessage(latestCart)
                await this.telegramService.editMessageText(existingCart.telegram_message_id, messageData.text, messageData.reply_markup)
            }

            res.status(200).json({
                success: true,
                message: 'Webhook processed',
                action: shouldSendNewMessage ? 'sent_new_message' : shouldUpdateMessage ? 'updated_message' : 'no_message',
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
