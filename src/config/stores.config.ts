import { env } from './env.config'

export interface StoreConfig {
    storeId: string
    storeName: string
    telegramGroupId: string
    mongoDbName: string
    googleSheetsSpreadsheetId?: string
    webhookPath: string
}

export const STORE_CONFIGS: StoreConfig[] = [
    {
        storeId: 'store1',
        storeName: 'Store 1',
        telegramGroupId: env.store1TelegramGroupId,
        mongoDbName: env.store1MongoDbName,
        googleSheetsSpreadsheetId: env.store1GoogleSheetsSpreadsheetId,
        webhookPath: '/webhook/store1',
    },
    {
        storeId: 'store2',
        storeName: 'Store 2',
        telegramGroupId: env.store2TelegramGroupId,
        mongoDbName: env.store2MongoDbName,
        googleSheetsSpreadsheetId: env.store2GoogleSheetsSpreadsheetId,
        webhookPath: '/webhook/store2',
    },
]

export function getStoreConfig(storeId: string): StoreConfig | undefined {
    return STORE_CONFIGS.find(config => config.storeId === storeId)
}

export function getStoreConfigByPath(webhookPath: string): StoreConfig | undefined {
    return STORE_CONFIGS.find(config => config.webhookPath === webhookPath)
}
