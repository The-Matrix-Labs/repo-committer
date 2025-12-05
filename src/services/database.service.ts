import mongoose from 'mongoose'

export class DatabaseService {
    private connectionString: string

    constructor(connectionString: string) {
        this.connectionString = connectionString
    }

    async connect(): Promise<void> {
        try {
            await mongoose.connect(this.connectionString)
            console.log('✅ MongoDB connected successfully')
        } catch (error: any) {
            console.error('❌ MongoDB connection error:', error.message)
            throw error
        }
    }

    async disconnect(): Promise<void> {
        try {
            await mongoose.disconnect()
            console.log('MongoDB disconnected')
        } catch (error: any) {
            console.error('MongoDB disconnection error:', error.message)
        }
    }
}
