import Cart, { ICart } from '../models/cart.model'

export class CartService {
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

            const cart = await Cart.findOneAndUpdate({ cart_id: data.cart_id }, cartData, {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true,
            })

            return cart
        } catch (error: any) {
            console.error('Error creating/updating cart:', error.message)
            throw error
        }
    }

    async updateCartStatus(cartId: string, status: 'Not Contacted' | 'Called and Converted' | 'Called but Not Converted'): Promise<ICart | null> {
        try {
            const cart = await Cart.findOneAndUpdate({ cart_id: cartId }, { status }, { new: true })
            return cart
        } catch (error: any) {
            console.error('Error updating cart status:', error.message)
            throw error
        }
    }

    async addNote(cartId: string, noteText: string): Promise<ICart | null> {
        try {
            const cart = await Cart.findOneAndUpdate({ cart_id: cartId }, { notes: noteText }, { new: true })
            return cart
        } catch (error: any) {
            console.error('Error adding note:', error.message)
            throw error
        }
    }

    async getCart(cartId: string): Promise<ICart | null> {
        try {
            return await Cart.findOne({ cart_id: cartId })
        } catch (error: any) {
            console.error('Error fetching cart:', error.message)
            throw error
        }
    }

    async updateTelegramMessageId(cartId: string, messageId: number): Promise<ICart | null> {
        try {
            return await Cart.findOneAndUpdate({ cart_id: cartId }, { telegram_message_id: messageId }, { new: true })
        } catch (error: any) {
            console.error('Error updating telegram message ID:', error.message)
            throw error
        }
    }
}
