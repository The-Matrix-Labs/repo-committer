import dotenv from 'dotenv'

dotenv.config()

function parseNumber(value: string | undefined, defaultValue: number): number
function parseNumber(value: string | undefined): number | undefined
function parseNumber(value: string | undefined, defaultValue?: number): number | undefined {
    if (value === undefined || value === '') {
        return defaultValue
    }

    const parsed = parseInt(value, 10)
    return Number.isNaN(parsed) ? defaultValue : parsed
}

export const env = {
    port: parseNumber(process.env.PORT, 3000),
    nodeEnv: process.env.NODE_ENV || 'development',
    mongodbUri: process.env.MONGODB_URI,

    githubToken: process.env.GITHUB_TOKEN || '',

    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',

    googleSheetsCredentials: process.env.GOOGLE_SHEETS_CREDENTIALS,
    botActive: process.env.BOT_ACTIVE === 'true',

    shiprocketApiBaseUrl: process.env.SHIPROCKET_API_BASE_URL,
    shiprocketApiToken: process.env.SHIPROCKET_API_TOKEN,
    shiprocketEmail: process.env.SHIPROCKET_EMAIL,
    shiprocketPassword: process.env.SHIPROCKET_PASSWORD,
    shiprocketTokenRefreshMarginSeconds: parseNumber(process.env.SHIPROCKET_TOKEN_REFRESH_MARGIN_SECONDS, 300),
    reportTelegramGroupId: process.env.REPORT_TELEGRAM_GROUP_ID,

    reportWeeklyDay: parseNumber(process.env.REPORT_WEEKLY_DAY),
    reportMonthlyDay: parseNumber(process.env.REPORT_MONTHLY_DAY),
    reportTimezone: process.env.REPORT_TIMEZONE,
    reportDailyLookbackDays: parseNumber(process.env.REPORT_DAILY_LOOKBACK_DAYS, 1),
    reportWeeklyLookbackDays: parseNumber(process.env.REPORT_WEEKLY_LOOKBACK_DAYS, 7),
    reportMonthlyLookbackDays: parseNumber(process.env.REPORT_MONTHLY_LOOKBACK_DAYS, 30),
    reportDailyTime: process.env.REPORT_DAILY_TIME,
    reportWeeklyTime: process.env.REPORT_WEEKLY_TIME,
    reportMonthlyTime: process.env.REPORT_MONTHLY_TIME,


    store1TelegramGroupId: process.env.STORE1_TELEGRAM_GROUP_ID || '',
    store1MongoDbName: process.env.STORE1_MONGODB_NAME || 'store1',
    store1GoogleSheetsSpreadsheetId: process.env.STORE1_GOOGLE_SHEETS_SPREADSHEET_ID,
    
    store2TelegramGroupId: process.env.STORE2_TELEGRAM_GROUP_ID || '',
    store2MongoDbName: process.env.STORE2_MONGODB_NAME || 'store2',
    store2GoogleSheetsSpreadsheetId: process.env.STORE2_GOOGLE_SHEETS_SPREADSHEET_ID,
}
