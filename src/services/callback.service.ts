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

            // Handle status toggle
            if (callbackData.startsWith('status_')) {
                const cartId = callbackData.replace('status_', '')
                console.log('📊 Toggling status for cart:', cartId)
                await this.toggleStatus(cartId, messageId, chatId, ctx)
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

    private async toggleStatus(cartId: string, messageId: number, chatId: number, ctx?: Context): Promise<void> {
        const cart = await this.cartService.getCart(cartId)
        const current: 'Not Contacted' | 'Called and Converted' | 'Called but Not Converted' = cart?.status || 'Not Contacted'
        const nextMap: Record<typeof current, typeof current> = {
            'Not Contacted': 'Called and Converted',
            'Called and Converted': 'Called but Not Converted',
            'Called but Not Converted': 'Not Contacted',
        }
        const nextStatus = nextMap[current]
        await this.updateStatus(cartId, nextStatus, messageId, chatId, ctx)
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
        let lines: string[] = []

        // Header
        lines.push(`<b>🛒 Cart Event</b>`)

        // ============ CUSTOMER DETAILS ============
        lines.push(`\n<b>👤 CUSTOMER DETAILS</b>`)
        if (cart.first_name || cart.last_name) {
            lines.push(`• Name: ${cart.first_name || ''} ${cart.last_name || ''}`.trim())
        }
        if (cart.email) {
            lines.push(`• Email: ${cart.email}`)
        }
        lines.push(`• Phone: ${cart.phone_number || 'N/A'}`)
        if (cart.phone_verified !== undefined) {
            lines.push(`• Phone Verified: ${cart.phone_verified ? '✅ Yes' : '❌ No'}`)
        }

        // ============ SHIPPING ADDRESS ============
        if (cart.shipping_address) {
            lines.push(`\n<b>📦 Shipping Address:</b>`)
            lines.push(`${cart.shipping_address.name || ''}`.trim())
            lines.push(`${cart.shipping_address.address1 || ''}`.trim())
            if (cart.shipping_address.address2) {
                lines.push(`${cart.shipping_address.address2}`.trim())
            }
            lines.push(
                `${cart.shipping_address.city || ''}, ${cart.shipping_address.state || ''} - ${cart.shipping_address.zip || ''}`.trim()
            )
            lines.push(`${cart.shipping_address.country || ''}`.trim())
            lines.push(`Phone: ${cart.shipping_address.phone || ''}`.trim())
        }

        // ============ ITEM DETAILS ============
        const items: string[] = []
        if (cart.items && cart.items.length > 0) {
            cart.items.forEach((item: any, index: number) => {
                items.push(
                    `${index + 1}. <b>${item.name || item.title}</b>\n   • Quantity: ${item.quantity || 1}\n   • Price: ₹${
                        item.price?.toLocaleString('en-IN') || 'N/A'
                    }${item.sku ? `\n   • SKU: ${item.sku}` : ''}`
                )
            })
        } else if (cart.item_name_list && cart.item_name_list.length > 0) {
            cart.item_name_list.forEach((name: string, index: number) => {
                const price = cart.item_price_list && cart.item_price_list[index] ? parseFloat(cart.item_price_list[index]) : undefined
                items.push(
                    `${index + 1}. <b>${name}</b>\n   • Quantity: 1${price !== undefined ? `\n   • Price: ₹${price.toLocaleString('en-IN')}` : ''}`
                )
            })
        }
        if (items.length) {
            lines.push(`\n<b>🛍️ ITEM DETAILS</b>`)
            lines.push(items.join('\n'))
        }

        // ============ CART METADATA ============
        lines.push(`\n<b>⚙️ CART METADATA</b>`)
        lines.push(`<b>Applied Rules:</b>`)
        if (cart.shipping_price !== undefined) {
            lines.push(`• Shipping Charge: ₹${cart.shipping_price}`)
        }
        if (cart.rtoPredict) {
            lines.push(`• RTO Predict: ${cart.rtoPredict}`)
        }

        // ============ PAYMENT SUMMARY ============
        lines.push(`\n<b>💰 PAYMENT SUMMARY</b>`)
        const subtotal = cart.total_price || 0
        const tax = cart.tax || 0
        lines.push(`• Subtotal: ₹${subtotal.toLocaleString('en-IN')}`)
        if (tax > 0) {
            lines.push(`• Tax: ₹${tax.toLocaleString('en-IN')}`)
        }
        const finalAmount = subtotal + tax
        lines.push(`• Total Amount: ₹${finalAmount.toLocaleString('en-IN')}`)
        if (cart.payment_status) {
            lines.push(`• Payment Status: ${cart.payment_status}`)
        }

        // ============ CART DETAILS ============
        lines.push(`\n<b>📋 CART DETAILS</b>`)
        lines.push(`• Cart ID: ${cart.cart_id}`)
        lines.push(`• Stage: ${cart.latest_stage || 'N/A'}`)
        if (cart.updated_at) {
            const updateDate = new Date(cart.updated_at)
            const dateStr = updateDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
            const timeStr = updateDate.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
            lines.push(`• Date: ${dateStr}`)
            lines.push(`• Time: ${timeStr}`)
        }

        // ============ STATUS & NOTES ============
        const resolvedStatus: 'Not Contacted' | 'Called and Converted' | 'Called but Not Converted' = cart.status || 'Not Contacted'
        const statusEmoji: Record<typeof resolvedStatus, string> = {
            'Not Contacted': '🔴',
            'Called and Converted': '✅',
            'Called but Not Converted': '❌',
        }
        lines.push(`\n<b>📊 Status:</b> ${statusEmoji[resolvedStatus]} ${resolvedStatus}`)
        lines.push(`<b>📝 NOTES</b>`)
        if (cart.notes && cart.notes.trim()) {
            lines.push(cart.notes)
        } else {
            lines.push(`<i>No notes yet. Click "Add Note" to add one.</i>`)
        }
        lines.push('')

        const message = lines.filter(line => line !== undefined).join('\n')

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
