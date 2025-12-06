import mongoose, { Schema, Document } from 'mongoose'

export interface ICart extends Document {
    cart_id: string
    status: 'Not Contacted' | 'Called and Converted' | 'Called but Not Converted'
    notes?: string
    latest_stage?: string

    // Item Details
    items?: any[]
    item_name_list?: string[]
    item_price_list?: string[]

    // Customer Details
    first_name?: string
    last_name?: string
    email?: string
    phone_number?: string
    phone_verified?: boolean
    shipping_address?: any

    // Cart Metadata
    shipping_price?: number
    rtoPredict?: string

    // Payment Summary
    total_price?: number
    tax?: number
    payment_status?: string

    // Cart Details
    updated_at?: Date
    created_at: Date
}

const CartSchema: Schema = new Schema({
    cart_id: { type: String, required: true, unique: true },
    status: {
        type: String,
        enum: ['Not Contacted', 'Called and Converted', 'Called but Not Converted'],
        default: 'Not Contacted',
    },
    notes: { type: String },
    latest_stage: { type: String },

    // Item Details
    items: { type: Array },
    item_name_list: { type: Array },
    item_price_list: { type: Array },

    // Customer Details
    first_name: { type: String },
    last_name: { type: String },
    email: { type: String },
    phone_number: { type: String },
    phone_verified: { type: Boolean },
    shipping_address: { type: Object },

    // Cart Metadata
    shipping_price: { type: Number },
    rtoPredict: { type: String },

    // Payment Summary
    total_price: { type: Number },
    tax: { type: Number },
    payment_status: { type: String },

    // Cart Details
    updated_at: { type: Date },
    created_at: { type: Date, default: Date.now },
})

export default mongoose.model<ICart>('Cart', CartSchema)
