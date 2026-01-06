import mongoose, { Document, Schema } from 'mongoose'

export interface IShiprocketUndeliveredOrder extends Document {
    order_id: string
    channel_order_id?: string
    channel_id?: number
    status?: string // API status (informational)
    status_code?: number
    seller_status: 'Not Contacted' | 'Called and Converted' | 'Called but Not Converted'
    seller_note?: string
    customer_name?: string
    customer_email?: string
    customer_phone?: string
    pickup_location?: string
    shipping_address?: Record<string, any>
    products?: any[]
    shipments?: any[]
    payment_method?: string
    total?: number
    tax?: number
    net_total?: number
    telegram_message_id?: number
    notes?: string
    metadata?: Record<string, any>
    created_at: Date
    updated_at: Date
}

const ShiprocketUndeliveredSchema = new Schema<IShiprocketUndeliveredOrder>({
    order_id: { type: String, required: true, unique: true },
    channel_order_id: { type: String },
    channel_id: { type: Number },
    status: { type: String },
    status_code: { type: Number },
    seller_status: {
        type: String,
        enum: ['Not Contacted', 'Called and Converted', 'Called but Not Converted'],
        default: 'Not Contacted',
    },
    seller_note: { type: String },
    customer_name: { type: String },
    customer_email: { type: String },
    customer_phone: { type: String },
    pickup_location: { type: String },
    shipping_address: { type: Schema.Types.Mixed },
    products: { type: Array },
    shipments: { type: Array },
    payment_method: { type: String },
    total: { type: Number },
    tax: { type: Number },
    net_total: { type: Number },
    telegram_message_id: { type: Number },
    notes: { type: String },
    metadata: { type: Schema.Types.Mixed },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
})

ShiprocketUndeliveredSchema.pre('save', function (this: any) {
    this.updated_at = new Date()
})

ShiprocketUndeliveredSchema.pre('findOneAndUpdate', function (this: any) {
    this.set({ updated_at: new Date() })
})

export const ShiprocketUndeliveredModel = mongoose.models.ShiprocketUndelivered || mongoose.model<IShiprocketUndeliveredOrder>('ShiprocketUndelivered', ShiprocketUndeliveredSchema, 'shiprocket_undelivered_orders')
