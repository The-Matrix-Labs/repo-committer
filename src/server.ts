import express, { Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import {
    GitHubService,
    DatabaseService,
    ReportingScheduler,
    ReportingService,
    ShiprocketService,
    ShiprocketUndeliveredOrderService,
    TelegramService,
} from './services'
import { TelegramBotService } from './services/bot.service'
import { StoreManager } from './services/store.manager'
import { env } from './config/env.config'
import { STORE_CONFIGS } from './config/stores.config'

const app = express()
const port = env.port

// Initialize database
if (!env.mongodbUri) {
    console.error('❌ MONGODB_URI environment variable is required')
    process.exit(1)
}
const databaseService = new DatabaseService(env.mongodbUri)
databaseService.connect()

// Initialize GitHub service (for the existing repo-committer functionality)
const githubService = new GitHubService(env.githubToken)

// Initialize Store Manager
const storeManager = new StoreManager(env.telegramBotToken, env.googleSheetsCredentials)
let shiprocketUndeliveredService: ShiprocketUndeliveredOrderService | undefined

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

// Shiprocket reporting scheduler (daily/weekly/monthly)
const shiprocketToken = env.shiprocketApiToken
const reportingGroupId = env.reportTelegramGroupId
let reportingService: ReportingService | undefined
if (shiprocketToken && reportingGroupId && env.telegramBotToken) {
    const weeklyDay = env.reportWeeklyDay
    const monthlyDay = env.reportMonthlyDay

    const shiprocketService = new ShiprocketService(shiprocketToken, {
        baseUrl: env.shiprocketApiBaseUrl,
        useMockData: false,
        authEmail: env.shiprocketEmail,
        authPassword: env.shiprocketPassword,
        tokenRefreshMarginSeconds: env.shiprocketTokenRefreshMarginSeconds,
    })
    shiprocketUndeliveredService = new ShiprocketUndeliveredOrderService()

    const reportingTelegramService = new TelegramService(env.telegramBotToken, reportingGroupId, 'shiprocket-reports')

    reportingService = new ReportingService(shiprocketService, reportingTelegramService, shiprocketUndeliveredService, {
        timezone: env.reportTimezone,
        dailyLookbackDays: env.reportDailyLookbackDays,
        weeklyLookbackDays: env.reportWeeklyLookbackDays,
        monthlyLookbackDays: env.reportMonthlyLookbackDays,
    })

    const reportingScheduler = new ReportingScheduler(reportingService, {
        timezone: env.reportTimezone,
        dailyTime: env.reportDailyTime,
        weeklyTime: env.reportWeeklyTime,
        weeklyDay: Number.isNaN(weeklyDay) ? undefined : weeklyDay,
        monthlyTime: env.reportMonthlyTime,
        monthlyDay: Number.isNaN(monthlyDay) ? undefined : monthlyDay,
    })

    reportingScheduler.start()
} else {
    console.log('?? Shiprocket reporting disabled. Ensure SHIPROCKET_API_TOKEN, REPORT_TELEGRAM_GROUP_ID and TELEGRAM_BOT_TOKEN are set.')
}

// Initialize Telegram bot (shared across all stores)
let isBotActive = env.botActive
let botService: TelegramBotService | undefined
if (isBotActive) {
    botService = new TelegramBotService(env.telegramBotToken, storeManager, reportingService, shiprocketUndeliveredService)
    storeManager.setTelegramClient(botService.getBot().telegram)
    botService.launch()
    console.log('🤖 Bot is ACTIVE')
} else {
    console.log('🤖  Bot is DISABLED (set BOT_ACTIVE=true in .env to enable)')
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
        environment: env.nodeEnv,
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
