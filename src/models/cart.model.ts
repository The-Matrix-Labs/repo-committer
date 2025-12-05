import mongoose, { Schema, Document } from 'mongoose'

export interface ICart extends Document {
    cart_id: string
    phone_number?: string
    customer_name?: string
    email?: string
    total_price?: number
    items?: any[]
    shipping_address?: any
    latest_stage?: string
    updated_at?: Date
    status: 'Not Contacted' | 'Called and Converted' | 'Called but Not Converted'
    notes?: string
    raw_data: any
    created_at: Date
}

const CartSchema: Schema = new Schema({
    cart_id: { type: String, required: true, unique: true },
    phone_number: { type: String },
    customer_name: { type: String },
    email: { type: String },
    total_price: { type: Number },
    items: { type: Array },
    shipping_address: { type: Object },
    latest_stage: { type: String },
    updated_at: { type: Date },
    status: {
        type: String,
        enum: ['Not Contacted', 'Called and Converted', 'Called but Not Converted'],
        default: 'Not Contacted',
    },
    notes: { type: String },
    raw_data: { type: Object },
    created_at: { type: Date, default: Date.now },
})

export default mongoose.model<ICart>('Cart', CartSchema)
