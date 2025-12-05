import { Telegraf } from 'telegraf'
import { CallbackService } from './callback.service'

export class TelegramBotService {
    private bot: Telegraf
    private callbackService: CallbackService
    private awaitingNote: Map<number, { cartId: string; messageId: number; promptMessageId?: number }> = new Map()

    constructor(botToken: string, callbackService: CallbackService) {
        this.bot = new Telegraf(botToken)
        this.callbackService = callbackService

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

                // Check if this is a note request
                if (callbackData.startsWith('note_')) {
                    const cartId = callbackData.replace('note_', '')
                    const messageId = ctx.callbackQuery.message?.message_id

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
                    })
                    await ctx.answerCbQuery()
                    return
                }

                // Handle all other callbacks (status, back, etc.)
                await this.callbackService.handleCallback(ctx.callbackQuery, ctx)
            } catch (error: any) {
                console.error('❌ Error handling callback:', error.message)
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

                    // Add note and update the cart message
                    await this.callbackService.addNoteDirectly(noteData.cartId, text, noteData.messageId, ctx)
                    return
                }

                // Handle /note command (legacy support)
                if (text.startsWith('/note')) {
                    const response = await this.callbackService.handleNoteCommand(text, userId.toString())
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
