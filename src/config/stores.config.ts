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
        telegramGroupId: process.env.STORE1_TELEGRAM_GROUP_ID || '',
        mongoDbName: process.env.STORE1_MONGODB_NAME || 'store1',
        googleSheetsSpreadsheetId: process.env.STORE1_GOOGLE_SHEETS_SPREADSHEET_ID,
        webhookPath: '/webhook/store1',
    },
    {
        storeId: 'store2',
        storeName: 'Store 2',
        telegramGroupId: process.env.STORE2_TELEGRAM_GROUP_ID || '',
        mongoDbName: process.env.STORE2_MONGODB_NAME || 'store2',
        googleSheetsSpreadsheetId: process.env.STORE2_GOOGLE_SHEETS_SPREADSHEET_ID,
        webhookPath: '/webhook/store2',
    },
]

export function getStoreConfig(storeId: string): StoreConfig | undefined {
    return STORE_CONFIGS.find(config => config.storeId === storeId)
}

export function getStoreConfigByPath(webhookPath: string): StoreConfig | undefined {
    return STORE_CONFIGS.find(config => config.webhookPath === webhookPath)
}
