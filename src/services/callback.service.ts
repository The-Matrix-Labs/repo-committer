import { TelegramService } from './telegram.service'
import { CartService } from './cart.service'
import { Context } from 'telegraf'

export class CallbackService {
    private telegramService: TelegramService
    private cartService: CartService

    constructor(telegramService: TelegramService, cartService: CartService) {
        this.telegramService = telegramService
        this.cartService = cartService
    }

    async handleCallback(callbackQuery: any, ctx?: Context): Promise<void> {
        const callbackData = callbackQuery.data
        const messageId = callbackQuery.message.message_id
        const chatId = callbackQuery.message.chat.id

        try {
            // Handle status update
            if (callbackData.startsWith('status_')) {
                const cartId = callbackData.replace('status_', '')
                await this.showStatusOptions(cartId, messageId, chatId, ctx)
            }
            // Handle status selection
            else if (callbackData.startsWith('set_status_')) {
                const parts = callbackData.split('_')
                const status = parts[2]
                const cartId = parts.slice(3).join('_')
                const statusMap: any = {
                    nc: 'Not Contacted',
                    cc: 'Called and Converted',
                    cnc: 'Called but Not Converted',
                }
                await this.updateStatus(cartId, statusMap[status], messageId, chatId, ctx)
            }
            // Handle back to main menu
            else if (callbackData.startsWith('back_')) {
                const cartId = callbackData.replace('back_', '')
                const cart = await this.cartService.getCart(cartId)
                if (cart && ctx) {
                    const message = await this.formatCartMessage(cart)
                    await ctx.editMessageText(message.text, {
                        parse_mode: 'HTML',
                        reply_markup: message.reply_markup,
                    })
                    await ctx.answerCbQuery('Back to main menu')
                } else {
                    await ctx?.answerCbQuery('Cart not found')
                }
            } else {
                await ctx?.answerCbQuery('Unknown action')
            }
        } catch (error: any) {
            console.error('❌ Error handling callback:', error.message)
            if (ctx) {
                await ctx.answerCbQuery('Error occurred').catch(() => {})
            }
        }
    }

    async addNoteDirectly(cartId: string, noteText: string, messageId?: number, ctx?: Context): Promise<void> {
        try {
            await this.cartService.addNote(cartId, noteText)

            // Update the cart message with the new note
            if (messageId && ctx) {
                const cart = await this.cartService.getCart(cartId)
                if (cart) {
                    const message = await this.formatCartMessage(cart)
                    await ctx.telegram.editMessageText(ctx.chat!.id, messageId, undefined, message.text, {
                        parse_mode: 'HTML',
                        reply_markup: message.reply_markup,
                    })
                }
            }
        } catch (error: any) {
            console.error('❌ Error adding note:', error.message)
        }
    }

    private async showStatusOptions(cartId: string, messageId: number, chatId: number, ctx?: Context): Promise<void> {
        try {
            const cart = await this.cartService.getCart(cartId)
            const currentStatus = cart?.status || 'Not Contacted'

            const statusMessage = `<b>Update Status</b>\n\nCurrent Status: <b>${currentStatus}</b>\n\nSelect new status:`

            const keyboard = {
                inline_keyboard: [
                    [
                        {
                            text: '🔴 Not Contacted',
                            callback_data: `set_status_nc_${cartId}`,
                        },
                    ],
                    [
                        {
                            text: '✅ Called and Converted',
                            callback_data: `set_status_cc_${cartId}`,
                        },
                    ],
                    [
                        {
                            text: '❌ Called but Not Converted',
                            callback_data: `set_status_cnc_${cartId}`,
                        },
                    ],
                    [
                        {
                            text: '« Back',
                            callback_data: `back_${cartId}`,
                        },
                    ],
                ],
            }

            if (ctx) {
                await ctx.editMessageText(statusMessage, {
                    parse_mode: 'HTML',
                    reply_markup: keyboard,
                })
                await ctx.answerCbQuery('Status options loaded')
            }
        } catch (error: any) {
            console.error('❌ Error showing status options:', error.message)
            throw error
        }
    }

    private async updateStatus(cartId: string, status: 'Not Contacted' | 'Called and Converted' | 'Called but Not Converted', messageId: number, chatId: number, ctx?: Context): Promise<void> {
        await this.cartService.updateCartStatus(cartId, status)
        const cart = await this.cartService.getCart(cartId)

        if (cart && ctx) {
            const message = await this.formatCartMessage(cart)
            await ctx.editMessageText(message.text, {
                parse_mode: 'HTML',
                reply_markup: message.reply_markup,
            })
            await ctx.answerCbQuery(`Status updated to: ${status}`)
        }
    }

    private async formatCartMessage(cart: any): Promise<any> {
        const data = cart.raw_data
        let message = `<b>🛒 Cart Event</b>\n\n`

        // Status indicator
        const statusEmoji: any = {
            'Not Contacted': '🔴',
            'Called and Converted': '✅',
            'Called but Not Converted': '❌',
        }
        message += `<b>📊 Status:</b> ${statusEmoji[cart.status]} ${cart.status}\n\n`

        // Items
        message += `<b>🛍️ ITEM DETAILS</b>\n`
        if (data.items && data.items.length > 0) {
            data.items.forEach((item: any, index: number) => {
                message += `${index + 1}. <b>${item.name || item.title}</b>\n`
                message += `   • Quantity: ${item.quantity || 1}\n`
                message += `   • Price: ₹${item.price?.toLocaleString('en-IN') || 'N/A'}\n`
                message += `\n`
            })
        }

        // Customer
        message += `<b>👤 CUSTOMER DETAILS</b>\n`
        message += `• Name: ${cart.customer_name || 'N/A'}\n`
        message += `• Phone: <code>${cart.phone_number || 'N/A'}</code>\n\n`

        // Payment
        message += `<b>💰 PAYMENT SUMMARY</b>\n`
        message += `• Total: ₹${cart.total_price?.toLocaleString('en-IN') || 0}\n\n`

        // Notes
        message += `<b>📝 NOTES</b>\n`
        if (cart.notes && cart.notes.trim()) {
            message += `${cart.notes}\n\n`
        } else {
            message += `<i>No notes yet. Click "Add Note" to add one.</i>\n\n`
        }

        // Cart Details
        message += `<b>📋 CART DETAILS</b>\n`
        message += `• Cart ID: <code>${cart.cart_id}</code>\n`
        message += `• Stage: ${cart.latest_stage || 'N/A'}\n`

        const phoneNumber = cart.phone_number?.replace(/[^0-9]/g, '')
        const formattedPhone = phoneNumber?.startsWith('91') ? phoneNumber : `91${phoneNumber}`

        return {
            text: message,
            parse_mode: 'HTML',
            reply_markup: phoneNumber
                ? {
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
                                  callback_data: `status_${cart.cart_id}`,
                              },
                              {
                                  text: '📝 Add Note',
                                  callback_data: `note_${cart.cart_id}`,
                              },
                          ],
                      ],
                  }
                : undefined,
        }
    }

    async handleNoteCommand(text: string, userId: string): Promise<string> {
        // Expected format: /note <cart_id> <note_text>
        const parts = text.split(' ')
        if (parts.length < 3) {
            return '❌ Invalid format. Use: /note <cart_id> <your note text>'
        }

        const cartId = parts[1]
        const noteText = parts.slice(2).join(' ')

        try {
            await this.cartService.addNote(cartId, noteText)
            return `✅ Note added successfully for cart ${cartId}`
        } catch (error: any) {
            return `❌ Error adding note: ${error.message}`
        }
    }
}
