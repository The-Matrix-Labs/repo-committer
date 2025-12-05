import Cart, { ICart } from '../models/cart.model'

export class CartService {
    async createOrUpdateCart(data: any): Promise<ICart> {
        try {
            const cartData = {
                cart_id: data.cart_id,
                phone_number: data.phone_number,
                customer_name: data.first_name && data.last_name ? `${data.first_name} ${data.last_name}` : undefined,
                email: data.email,
                total_price: data.total_price,
                items: data.items,
                shipping_address: data.shipping_address,
                latest_stage: data.latest_stage,
                updated_at: data.updated_at ? new Date(data.updated_at) : undefined,
                raw_data: data,
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
}
