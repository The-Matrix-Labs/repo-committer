import { google } from 'googleapis'
import { ICart } from '../models/cart.model'

export class GoogleSheetsService {
    private sheets: any
    private spreadsheetId: string

    constructor(credentials: string, spreadsheetId: string) {
        this.spreadsheetId = spreadsheetId

        try {
            // Parse credentials if it's a JSON string
            const creds = typeof credentials === 'string' ? JSON.parse(credentials) : credentials

            const auth = new google.auth.GoogleAuth({
                credentials: creds,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            })

            this.sheets = google.sheets({ version: 'v4', auth })
        } catch (error: any) {
            console.error('❌ Error initializing Google Sheets:', error.message)
            throw error
        }
    }

    /**
     * Initialize the Google Sheet with headers if it doesn't exist
     */
    async initializeSheet(): Promise<void> {
        try {
            const headers = ['Cart ID', 'Status', 'Notes', 'Latest Stage', 'First Name', 'Last Name', 'Email', 'Phone Number', 'Phone Verified', 'Item Names', 'Item Prices', 'Image URLs', 'Shipping Price', 'RTO Predict', 'Total Price', 'Tax', 'Payment Status', 'Created At', 'Updated At']

            // Check if the sheet is empty
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: 'A1:S1',
            })

            // If no data, add headers
            if (!response.data.values || response.data.values.length === 0) {
                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range: 'A1:S1',
                    valueInputOption: 'RAW',
                    resource: {
                        values: [headers],
                    },
                })
                console.log('✅ Google Sheet headers initialized')
            }
        } catch (error: any) {
            console.error('❌ Error initializing sheet:', error.message)
            throw error
        }
    }

    /**
     * Convert cart data to sheet row format
     */
    private cartToRow(cart: ICart): any[] {
        return [cart.cart_id || '', cart.status || 'Not Contacted', cart.notes || '', cart.latest_stage || '', cart.first_name || '', cart.last_name || '', cart.email || '', cart.phone_number || '', cart.phone_verified ? 'Yes' : 'No', cart.item_name_list ? cart.item_name_list.join(', ') : '', cart.item_price_list ? cart.item_price_list.join(', ') : '', cart.image_urls ? cart.image_urls.join(', ') : '', cart.shipping_price || '', cart.rtoPredict || '', cart.total_price || '', cart.tax || '', cart.payment_status || '', cart.created_at ? new Date(cart.created_at).toISOString() : '', cart.updated_at ? new Date(cart.updated_at).toISOString() : '']
    }

    /**
     * Add or update a single cart in the sheet
     */
    async syncCart(cart: ICart): Promise<void> {
        try {
            // Find if cart already exists
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: 'A:A', // Cart ID column
            })

            const values = response.data.values || []
            const cartIndex = values.findIndex((row: any[]) => row[0] === cart.cart_id)

            const rowData = this.cartToRow(cart)

            if (cartIndex > 0) {
                // Update existing row (cartIndex + 1 because it's 1-indexed)
                const rowNumber = cartIndex + 1
                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range: `A${rowNumber}:S${rowNumber}`,
                    valueInputOption: 'RAW',
                    resource: {
                        values: [rowData],
                    },
                })
                console.log(`✅ Updated cart ${cart.cart_id} in Google Sheets`)
            } else {
                // Append new row
                await this.sheets.spreadsheets.values.append({
                    spreadsheetId: this.spreadsheetId,
                    range: 'A:S',
                    valueInputOption: 'RAW',
                    insertDataOption: 'INSERT_ROWS',
                    resource: {
                        values: [rowData],
                    },
                })
                console.log(`✅ Added cart ${cart.cart_id} to Google Sheets`)
            }
        } catch (error: any) {
            console.error(`❌ Error syncing cart ${cart.cart_id} to Google Sheets:`, error.message)
            throw error
        }
    }

    /**
     * Sync all carts from MongoDB to Google Sheets
     */
    async syncAllCarts(carts: ICart[]): Promise<void> {
        try {
            if (carts.length === 0) {
                console.log('No carts to sync')
                return
            }

            // Get existing cart IDs
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: 'A:A',
            })

            const existingCartIds = new Set(
                (response.data.values || []).slice(1).map((row: any[]) => row[0]) // Skip header
            )

            const rows = carts.map(cart => this.cartToRow(cart))

            // Clear existing data (except headers) and write all data
            await this.sheets.spreadsheets.values.clear({
                spreadsheetId: this.spreadsheetId,
                range: 'A2:S',
            })

            // Append all rows at once
            await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: 'A:S',
                valueInputOption: 'RAW',
                insertDataOption: 'INSERT_ROWS',
                resource: {
                    values: rows,
                },
            })

            console.log(`✅ Synced ${carts.length} carts to Google Sheets`)
        } catch (error: any) {
            console.error('❌ Error syncing all carts:', error.message)
            throw error
        }
    }

    /**
     * Get the spreadsheet URL
     */
    getSpreadsheetUrl(): string {
        return `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/edit`
    }
}
