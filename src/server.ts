import express, { Request, Response } from 'express'
import dotenv from 'dotenv'
import rateLimit from 'express-rate-limit'
import { GitHubService, TelegramService, WebhookService, DatabaseService, CartService, CallbackService } from './services'
import { TelegramBotService } from './services/bot.service'

// Load environment variables
dotenv.config()

const app = express()
const port = process.env.PORT || 3000

// Initialize database
const databaseService = new DatabaseService(process.env.MONGODB_URI || 'mongodb+srv://amansingh9723chauhan_db_user:IxWlNtKBHHpiQ8VJ@cluster0.mgnrbot.mongodb.net/')
databaseService.connect()

// Initialize services
const githubService = new GitHubService(process.env.GITHUB_TOKEN || '')
const telegramService = new TelegramService(process.env.TELEGRAM_BOT_TOKEN || '', process.env.TELEGRAM_GROUP_ID || '')
const cartService = new CartService()
const webhookService = new WebhookService(telegramService, cartService)
const callbackService = new CallbackService(telegramService, cartService)

// Initialize and launch Telegram bot
let isBotActive = false
const botService = new TelegramBotService(process.env.TELEGRAM_BOT_TOKEN || '', callbackService)
botService.launch()

// Rate limiter to prevent abuse on GitHub endpoints
const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // Limit each IP to 5 requests per windowMs
})

// Parse JSON bodies
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
    })
})

app.get('/', (req: Request, res: Response) => {
    // Serve confirmation HTML with repo name input
    res.send(`
        <html>
        <body>
            <h2>Commit README.md and trigger deployment</h2>
            <form method="POST">
                <label for="repoName">Repository Name:</label>
                <input type="text" id="repoName" name="repoName" required />
                <br/><br/>
                <button type="submit">Commit</button>
            </form>
        </body>
        </html>
    `)
})

app.post('/', limiter, async (req: Request, res: Response) => {
    const { repoName } = req.body
    if (typeof repoName !== 'string' || repoName.trim() === '') {
        return res.status(400).send('Invalid repository name.')
    }
    const owner = 'The-Matrix-Labs'
    const repo = repoName.trim()

    try {
        const message = await githubService.updateReadme(owner, repo)
        res.send(message)
    } catch (error: unknown) {
        console.error('Error updating README:', error)
        res.status(500).send('Error accessing GitHub API.')
    }
})

// Webhook endpoint
app.post('/webhook', async (req: Request, res: Response) => {
    if (!isBotActive) {
        return res.status(200).json({
            success: true,
            message: 'Bot is currently disabled. Webhook ignored.',
        })
    }
    await webhookService.handleWebhook(req, res)
})

app.get('/bot/status', (req: Request, res: Response) => {
    res.json({
        botActive: isBotActive,
        status: isBotActive ? 'enabled ✅' : 'disabled ⏸️',
    })
})

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`)
})
