import express, { Request, Response } from 'express'
import dotenv from 'dotenv'
import rateLimit from 'express-rate-limit'
import { GitHubService, DatabaseService } from './services'
import { TelegramBotService } from './services/bot.service'
import { StoreManager } from './services/store.manager'
import { STORE_CONFIGS } from './config/stores.config'

// Load environment variables
dotenv.config()

const app = express()
const port = process.env.PORT || 3000

// Initialize database
if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI environment variable is required')
    process.exit(1)
}
const databaseService = new DatabaseService(process.env.MONGODB_URI)
databaseService.connect()

// Initialize GitHub service (for the existing repo-committer functionality)
const githubService = new GitHubService(process.env.GITHUB_TOKEN || '')

// Initialize Store Manager
const storeManager = new StoreManager(process.env.TELEGRAM_BOT_TOKEN || '', process.env.GOOGLE_SHEETS_CREDENTIALS)

// Initialize all stores
async function initializeStores() {
    console.log('\n🚀 Initializing stores...\n')
    for (const config of STORE_CONFIGS) {
        await storeManager.initializeStore(config)
    }
    console.log('\n✅ All stores initialized\n')
}

// Initialize stores
initializeStores().catch(error => {
    console.error('Failed to initialize stores:', error)
    process.exit(1)
})

// Initialize Telegram bot (shared across all stores)
let isBotActive = process.env.BOT_ACTIVE === 'true'
if (isBotActive) {
    // Pass StoreManager to the bot so it can handle callbacks for all stores
    const botService = new TelegramBotService(process.env.TELEGRAM_BOT_TOKEN || '', storeManager)
    botService.launch()
    console.log('🤖 Bot is ACTIVE')
} else {
    console.log('⏸️  Bot is DISABLED (set BOT_ACTIVE=true in .env to enable)')
}

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

// Store-specific webhook endpoints
STORE_CONFIGS.forEach(config => {
    app.post(config.webhookPath, async (req: Request, res: Response) => {
        if (!isBotActive) {
            return res.status(200).json({
                success: true,
                message: 'Bot is currently disabled. Webhook ignored.',
            })
        }

        const store = storeManager.getStoreServices(config.storeId)
        if (!store) {
            return res.status(500).json({
                success: false,
                message: 'Store not initialized',
            })
        }

        await store.webhookService.handleWebhook(req, res)
    })

    console.log(`📍 Webhook endpoint registered: ${config.webhookPath} -> ${config.storeName}`)
})

app.get('/bot/status', (req: Request, res: Response) => {
    res.json({
        botActive: isBotActive,
        status: isBotActive ? 'enabled ✅' : 'disabled ⏸️',
    })
})

// Store listing endpoint
app.get('/stores', (req: Request, res: Response) => {
    const stores = storeManager.getAllStores().map(store => ({
        storeId: store.config.storeId,
        storeName: store.config.storeName,
        webhookPath: store.config.webhookPath,
        telegramGroupId: store.config.telegramGroupId,
        hasGoogleSheets: !!store.sheetsService,
    }))

    res.json({
        success: true,
        stores,
    })
})

// Store-specific Google Sheets URL endpoint
app.get('/stores/:storeId/sheets/url', (req: Request, res: Response) => {
    const { storeId } = req.params
    const store = storeManager.getStoreServices(storeId)

    if (!store) {
        return res.status(404).json({
            success: false,
            message: 'Store not found',
        })
    }

    if (!store.sheetsService) {
        return res.status(503).json({
            success: false,
            message: 'Google Sheets integration is not configured for this store',
        })
    }

    res.json({
        success: true,
        storeId: store.config.storeId,
        storeName: store.config.storeName,
        url: store.sheetsService.getSpreadsheetUrl(),
    })
})

app.listen(port, () => {
    console.log(`\n🚀 Server running on http://localhost:${port}`)
    console.log('\n📍 Available webhook endpoints:')
    STORE_CONFIGS.forEach(config => {
        console.log(`   ${config.webhookPath} -> ${config.storeName}`)
    })
    console.log('')
})
