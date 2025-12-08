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

        // Answer callback query immediately to prevent timeout
        try {
            await ctx?.answerCbQuery()
        } catch (e) {
            // Ignore if already answered or expired
        }

        try {
            console.log('📥 CallbackService received:', callbackData)

            // Handle status update
            if (callbackData.startsWith('status_')) {
                const cartId = callbackData.replace('status_', '')
                console.log('📊 Showing status options for cart:', cartId)
                await this.showStatusOptions(cartId, messageId, chatId, ctx)
            }
            // Handle status selection
            else if (callbackData.startsWith('set_status_')) {
                const parts = callbackData.split('_')
                const status = parts[2]
                const cartId = parts.slice(3).join('_')
                console.log('✏️ Updating status to:', status, 'for cart:', cartId)
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
                console.log('⬅️ Going back to main menu for cart:', cartId)
                const cart = await this.cartService.getCart(cartId)
                if (cart && ctx) {
                    const message = await this.formatCartMessage(cart)
                    await ctx.editMessageText(message.text, {
                        parse_mode: 'HTML',
                        reply_markup: message.reply_markup,
                    })
                }
            } else {
                console.log('❓ Unknown callback data format:', callbackData)
            }
        } catch (error: any) {
            console.error('❌ Error handling callback:', error.message)
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
            const storeId = this.cartService.getStoreId()

            const statusMessage = `<b>Update Status</b>\n\nCurrent Status: <b>${currentStatus}</b>\n\nSelect new status:`

            const keyboard = {
                inline_keyboard: [
                    [
                        {
                            text: '🔴 Not Contacted',
                            callback_data: `${storeId}:set_status_nc_${cartId}`,
                        },
                    ],
                    [
                        {
                            text: '✅ Called and Converted',
                            callback_data: `${storeId}:set_status_cc_${cartId}`,
                        },
                    ],
                    [
                        {
                            text: '❌ Called but Not Converted',
                            callback_data: `${storeId}:set_status_cnc_${cartId}`,
                        },
                    ],
                    [
                        {
                            text: '« Back',
                            callback_data: `${storeId}:back_${cartId}`,
                        },
                    ],
                ],
            }

            if (ctx) {
                await ctx.editMessageText(statusMessage, {
                    parse_mode: 'HTML',
                    reply_markup: keyboard,
                })
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
        }
    }

    async formatCartMessage(cart: any): Promise<any> {
        let message = `<b>🛒 Cart Event</b>\n\n`

        // ============ CUSTOMER DETAILS ============
        message += `<b>👤 CUSTOMER DETAILS</b>\n`
        if (cart.first_name || cart.last_name) {
            message += `• Name: ${cart.first_name || ''} ${cart.last_name || ''}\n`
        }
        if (cart.email) {
            message += `• Email: ${cart.email}\n`
        }
        message += `• Phone: <code>${cart.phone_number || 'N/A'}</code>\n`
        if (cart.phone_verified !== undefined) {
            message += `• Phone Verified: ${cart.phone_verified ? '✅ Yes' : '❌ No'}\n`
        }

        if (cart.shipping_address) {
            message += `\n<b>📦 Shipping Address:</b>\n`
            message += `${cart.shipping_address.name || ''}\n`
            message += `${cart.shipping_address.address1 || ''}\n`
            if (cart.shipping_address.address2) {
                message += `${cart.shipping_address.address2}\n`
            }
            message += `${cart.shipping_address.city || ''}, ${cart.shipping_address.state || ''} - ${cart.shipping_address.zip || ''}\n`
            message += `${cart.shipping_address.country || ''}\n`
            message += `Phone: <code>${cart.shipping_address.phone || ''}</code>\n`
        }
        message += `\n`

        // ============ ITEM DETAILS ============
        if ((cart.items && cart.items.length > 0) || (cart.item_name_list && cart.item_name_list.length > 0)) {
            message += `<b>🛍️ ITEM DETAILS</b>\n`
            if (cart.items && cart.items.length > 0) {
                cart.items.forEach((item: any, index: number) => {
                    message += `${index + 1}. <b>${item.name || item.title}</b>\n`
                    message += `   • Quantity: ${item.quantity || 1}\n`
                    message += `   • Price: ₹${item.price?.toLocaleString('en-IN') || 'N/A'}\n`
                    if (item.sku) {
                        message += `   • SKU: ${item.sku}\n`
                    }
                    message += `\n`
                })
            } else if (cart.item_name_list && cart.item_name_list.length > 0) {
                cart.item_name_list.forEach((name: string, index: number) => {
                    message += `${index + 1}. <b>${name}</b>\n`
                    message += `   • Quantity: 1\n`
                    if (cart.item_price_list && cart.item_price_list[index]) {
                        message += `   • Price: ₹${parseFloat(cart.item_price_list[index]).toLocaleString('en-IN')}\n`
                    }
                    message += `\n`
                })
            }
        } // ============ CART METADATA ============
        message += `<b>⚙️ CART METADATA</b>\n`

        // Applied Rules
        message += `<b>Applied Rules:</b>\n`
        if (cart.shipping_price !== undefined) {
            message += `• Shipping Charge: ₹${cart.shipping_price}\n`
        }
        if (cart.rtoPredict) {
            message += `• RTO Predict: ${cart.rtoPredict}\n`
        }
        message += `\n`

        // ============ PAYMENT SUMMARY ============
        message += `<b>💰 PAYMENT SUMMARY</b>\n`

        // Calculate subtotal (total_price + total_discount - shipping if needed)
        const subtotal = cart.total_price || 0
        const tax = cart.tax || 0

        message += `• Subtotal: ₹${subtotal.toLocaleString('en-IN')}\n`

        if (tax > 0) {
            message += `• Tax: ₹${tax.toLocaleString('en-IN')}\n`
        }

        const finalAmount = subtotal
        message += `• <b>Total Amount: ₹${finalAmount.toLocaleString('en-IN')}</b>\n`

        if (cart.payment_status) {
            message += `• Payment Status: ${cart.payment_status}\n`
        }
        message += `\n`

        // ============ CART DETAILS ============
        message += `<b>📋 CART DETAILS</b>\n`
        message += `• Cart ID: <code>${cart.cart_id}</code>\n`
        message += `• Stage: ${cart.latest_stage || 'N/A'}\n`
        if (cart.updated_at) {
            const updateDate = new Date(cart.updated_at)
            const dateStr = updateDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
            const timeStr = updateDate.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
            message += `• Date: ${dateStr}\n`
            message += `• Time: ${timeStr}\n`
        }
        message += `\n`

        // ============ STATUS ============
        const statusEmoji: any = {
            'Not Contacted': '🔴',
            'Called and Converted': '✅',
            'Called but Not Converted': '❌',
        }
        message += `<b>📊 Status:</b> ${statusEmoji[cart.status]} ${cart.status}\n\n`

        // ============ NOTES ============
        message += `<b>📝 NOTES</b>\n`
        if (cart.notes && cart.notes.trim()) {
            message += `${cart.notes}\n\n`
        } else {
            message += `<i>No notes yet. Click "Add Note" to add one.</i>\n\n`
        }

        // Create inline keyboard buttons if phone number exists
        const phoneNumber = cart.phone_number?.replace(/[^0-9]/g, '')
        const formattedPhone = phoneNumber?.startsWith('91') ? phoneNumber : `91${phoneNumber}`
        const storeId = this.cartService.getStoreId()

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
                                  callback_data: `${storeId}:status_${cart.cart_id}`,
                              },
                              {
                                  text: '📝 Add Note',
                                  callback_data: `${storeId}:note_${cart.cart_id}`,
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
