import { getCartModel, ICart } from '../models/cart.model'
import { GoogleSheetsService } from './sheets.service'
import { Model } from 'mongoose'

export class CartService {
    private sheetsService?: GoogleSheetsService
    private storeId: string
    private Cart: Model<ICart>

    constructor(storeId: string, sheetsService?: GoogleSheetsService) {
        this.storeId = storeId
        this.sheetsService = sheetsService
        // Each store gets its own collection
        this.Cart = getCartModel(`carts_${storeId}`)
    }
    async createOrUpdateCart(data: any): Promise<ICart> {
        try {
            const cartData = {
                cart_id: data.cart_id,
                latest_stage: data.latest_stage,

                // Item Details
                items: data.items,
                item_name_list: data.item_name_list,
                item_price_list: data.item_price_list,

                // Customer Details
                first_name: data.first_name,
                last_name: data.last_name,
                email: data.email,
                phone_number: data.phone_number,
                phone_verified: data.phone_verified,
                shipping_address: data.shipping_address,

                // Cart Metadata
                shipping_price: data.shipping_price,
                rtoPredict: data.rtoPredict,

                // Payment Summary
                total_price: data.total_price,
                tax: data.tax,
                payment_status: data.payment_status,

                // Cart Details
                updated_at: data.updated_at ? new Date(data.updated_at) : undefined,
            }

            const cart = await this.Cart.findOneAndUpdate({ cart_id: data.cart_id }, cartData, {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true,
            })

            // Sync to Google Sheets if service is available
            if (this.sheetsService) {
                try {
                    await this.sheetsService.syncCart(cart)
                } catch (error: any) {
                    console.error('Warning: Failed to sync to Google Sheets:', error.message)
                    // Don't throw - we don't want Sheets sync to break the cart save
                }
            }

            return cart
        } catch (error: any) {
            console.error('Error creating/updating cart:', error.message)
            throw error
        }
    }

    async updateCartStatus(cartId: string, status: 'Not Contacted' | 'Called and Converted' | 'Called but Not Converted'): Promise<ICart | null> {
        try {
            const cart = await this.Cart.findOneAndUpdate({ cart_id: cartId }, { status }, { new: true })

            // Sync to Google Sheets if service is available
            if (this.sheetsService && cart) {
                try {
                    await this.sheetsService.syncCart(cart)
                } catch (error: any) {
                    console.error('Warning: Failed to sync to Google Sheets:', error.message)
                }
            }

            return cart
        } catch (error: any) {
            console.error('Error updating cart status:', error.message)
            throw error
        }
    }

    async addNote(cartId: string, noteText: string): Promise<ICart | null> {
        try {
            const cart = await this.Cart.findOneAndUpdate({ cart_id: cartId }, { notes: noteText }, { new: true })

            // Sync to Google Sheets if service is available
            if (this.sheetsService && cart) {
                try {
                    await this.sheetsService.syncCart(cart)
                } catch (error: any) {
                    console.error('Warning: Failed to sync to Google Sheets:', error.message)
                }
            }

            return cart
        } catch (error: any) {
            console.error('Error adding note:', error.message)
            throw error
        }
    }

    async getCart(cartId: string): Promise<ICart | null> {
        try {
            return await this.Cart.findOne({ cart_id: cartId })
        } catch (error: any) {
            console.error('Error fetching cart:', error.message)
            throw error
        }
    }

    async updateTelegramMessageId(cartId: string, messageId: number): Promise<ICart | null> {
        try {
            return await this.Cart.findOneAndUpdate({ cart_id: cartId }, { telegram_message_id: messageId }, { new: true })
        } catch (error: any) {
            console.error('Error updating telegram message ID:', error.message)
            throw error
        }
    }

    /**
     * Get all carts from MongoDB for this store
     */
    async getAllCarts(): Promise<ICart[]> {
        try {
            return await this.Cart.find({}).sort({ created_at: -1 })
        } catch (error: any) {
            console.error('Error fetching all carts:', error.message)
            throw error
        }
    }

    /**
     * Sync all carts to Google Sheets
     */
    async syncAllToSheets(): Promise<{ success: boolean; count: number; message: string }> {
        try {
            if (!this.sheetsService) {
                return {
                    success: false,
                    count: 0,
                    message: 'Google Sheets service not configured',
                }
            }

            const carts = await this.getAllCarts()
            await this.sheetsService.syncAllCarts(carts)

            return {
                success: true,
                count: carts.length,
                message: `Successfully synced ${carts.length} carts to Google Sheets`,
            }
        } catch (error: any) {
            console.error('Error syncing all carts to sheets:', error.message)
            throw error
        }
    }

    getStoreId(): string {
        return this.storeId
    }
}
