import { Telegraf } from 'telegraf'
import { StoreManager } from './store.manager'

export class TelegramBotService {
    private bot: Telegraf
    private storeManager: StoreManager
    private awaitingNote: Map<number, { cartId: string; messageId: number; promptMessageId?: number; storeId: string }> = new Map()

    constructor(botToken: string, storeManager: StoreManager) {
        this.bot = new Telegraf(botToken)
        this.storeManager = storeManager

        this.setupHandlers()
    }

    private setupHandlers(): void {
        // Handle callback queries (button presses)
        this.bot.on('callback_query', async ctx => {
            try {
                const callbackData = 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : undefined

                if (!callbackData) {
                    await ctx.answerCbQuery('No action specified')
                    return
                }

                console.log('🤖 Bot received callback_data:', callbackData)

                // Extract store ID from callback data (format: storeId:action_data)
                const [storeId, ...actionParts] = callbackData.split(':')
                const action = actionParts.join(':')

                console.log('📦 Extracted - storeId:', storeId, 'action:', action)

                const store = this.storeManager.getStoreServices(storeId)
                if (!store) {
                    console.error('❌ Store not found:', storeId)
                    await ctx.answerCbQuery('Store not found')
                    return
                }

                console.log('✅ Store found:', storeId)

                // Check if this is a note request
                if (action.startsWith('note_')) {
                    const cartId = action.replace('note_', '')
                    const messageId = ctx.callbackQuery.message?.message_id

                    console.log('📝 Note request for cart:', cartId)

                    // Send a prompt message
                    const promptMsg = await ctx.reply('📝 <b>Add Note</b>\n\nType your note and send it. It will replace any existing note.', {
                        parse_mode: 'HTML',
                        reply_markup: {
                            force_reply: true,
                        },
                    })

                    this.awaitingNote.set(ctx.from.id, {
                        cartId: cartId,
                        messageId: messageId!,
                        promptMessageId: promptMsg.message_id,
                        storeId: storeId,
                    })
                    await ctx.answerCbQuery()
                    return
                }

                console.log('🔀 Routing to CallbackService with action:', action)

                // Create a modified callback query with the action (without storeId prefix)
                const modifiedCallbackQuery = {
                    ...ctx.callbackQuery,
                    data: action,
                }

                // Handle all other callbacks (status, back, etc.) with the correct store's callback service
                await store.callbackService.handleCallback(modifiedCallbackQuery, ctx)
            } catch (error: any) {
                console.error('❌ Error handling callback:', error.message)
                console.error('❌ Stack trace:', error.stack)
                await ctx.answerCbQuery('Error occurred').catch(() => {})
            }
        })

        // Handle text messages (for notes)
        this.bot.on('text', async ctx => {
            try {
                const userId = ctx.from.id
                const text = ctx.message.text

                // Check if user is waiting to add a note
                if (this.awaitingNote.has(userId)) {
                    const noteData = this.awaitingNote.get(userId)!
                    this.awaitingNote.delete(userId)

                    // Delete the user's note message
                    try {
                        await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id)
                    } catch (e) {
                        // Silently fail if can't delete
                    }

                    // Delete the prompt message
                    if (noteData.promptMessageId) {
                        try {
                            await ctx.telegram.deleteMessage(ctx.chat.id, noteData.promptMessageId)
                        } catch (e) {
                            // Silently fail if can't delete
                        }
                    }

                    // Get the correct store's callback service
                    const store = this.storeManager.getStoreServices(noteData.storeId)
                    if (!store) {
                        await ctx.reply('Store not found')
                        return
                    }

                    // Add note and update the cart message
                    await store.callbackService.addNoteDirectly(noteData.cartId, text, noteData.messageId, ctx)
                    return
                }

                // Handle /note command (legacy support) - try all stores
                if (text.startsWith('/note')) {
                    // Since we don't know which store the cart belongs to, try the first store
                    const firstStoreServices = Array.from(this.storeManager.getAllStores().values())[0]
                    const response = await firstStoreServices.callbackService.handleNoteCommand(text, userId.toString())
                    await ctx.reply(response, { parse_mode: 'HTML' })
                }
            } catch (error: any) {
                console.error('Error handling text message:', error.message)
                await ctx.reply('Error processing your message')
            }
        })

        // Handle errors
        this.bot.catch((err: any) => {
            console.error('Telegraf error:', err)
        })
    }

    launch(): void {
        this.bot.launch()
        console.log('✅ Telegram bot launched successfully')

        // Enable graceful stop
        process.once('SIGINT', () => this.bot.stop('SIGINT'))
        process.once('SIGTERM', () => this.bot.stop('SIGTERM'))
    }

    getBot(): Telegraf {
        return this.bot
    }
}
