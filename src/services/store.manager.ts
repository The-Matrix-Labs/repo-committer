import { StoreConfig } from '../config/stores.config'
import { TelegramService } from './telegram.service'
import { CartService } from './cart.service'
import { CallbackService } from './callback.service'
import { WebhookService } from './webhook.service'
import { GoogleSheetsService } from './sheets.service'

export interface StoreServices {
    config: StoreConfig
    telegramService: TelegramService
    cartService: CartService
    callbackService: CallbackService
    webhookService: WebhookService
    sheetsService?: GoogleSheetsService
}

export class StoreManager {
    private stores: Map<string, StoreServices> = new Map()
    private telegramBotToken: string
    private googleSheetsCredentials?: string

    constructor(telegramBotToken: string, googleSheetsCredentials?: string) {
        this.telegramBotToken = telegramBotToken
        this.googleSheetsCredentials = googleSheetsCredentials
    }

    async initializeStore(config: StoreConfig): Promise<void> {
        console.log(`\n🏪 Initializing ${config.storeName} (${config.storeId})...`)

        // Initialize Telegram service for this store
        const telegramService = new TelegramService(this.telegramBotToken, config.telegramGroupId, config.storeId)

        // Initialize Google Sheets service if configured
        let sheetsService: GoogleSheetsService | undefined
        if (this.googleSheetsCredentials && config.googleSheetsSpreadsheetId) {
            try {
                sheetsService = new GoogleSheetsService(this.googleSheetsCredentials, config.googleSheetsSpreadsheetId)
                await sheetsService.initializeSheet()
                console.log(`  📊 Google Sheets enabled: ${sheetsService.getSpreadsheetUrl()}`)
            } catch (error: any) {
                console.error(`  ❌ Failed to initialize Google Sheets for ${config.storeName}:`, error.message)
            }
        }

        // Initialize Cart service with store-specific configuration
        const cartService = new CartService(config.storeId, sheetsService)

        // Initialize Callback and Webhook services
        const callbackService = new CallbackService(telegramService, cartService)
        const webhookService = new WebhookService(telegramService, cartService, callbackService)

        // Store all services
        this.stores.set(config.storeId, {
            config,
            telegramService,
            cartService,
            callbackService,
            webhookService,
            sheetsService,
        })

        console.log(`✅ ${config.storeName} initialized successfully`)
    }

    getStoreServices(storeId: string): StoreServices | undefined {
        return this.stores.get(storeId)
    }

    getAllStores(): StoreServices[] {
        return Array.from(this.stores.values())
    }

    getStoreByWebhookPath(path: string): StoreServices | undefined {
        for (const store of this.stores.values()) {
            if (store.config.webhookPath === path) {
                return store
            }
        }
        return undefined
    }
}
