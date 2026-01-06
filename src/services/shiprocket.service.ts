import axios, { AxiosInstance } from 'axios'
import { shiprocketOrdersMock } from '../data/shiprocketOrders.mock'

export interface ShiprocketOrder {
    id: number
    status: string
    status_code?: number
    total?: string | number
    [key: string]: any
}

export interface ShiprocketServiceOptions {
    baseUrl?: string
    timeoutMs?: number
    useMockData?: boolean
    authEmail?: string
    authPassword?: string
    tokenRefreshMarginSeconds?: number
}

export interface ShiprocketOrderQuery {
    page?: number
    perPage?: number
    sort?: 'ASC' | 'DESC'
    sortBy?: 'id' | 'status'
    to?: string
    from?: string
    filterBy?: 'status' | 'payment_method' | 'delivery_country' | 'channel_order_id'
    filter?: string | number
    search?: string
    pickupLocation?: string
    channelId?: number
    fbs?: 0 | 1
}

export class ShiprocketService {
    private static readonly DEFAULT_CHANNEL_ID = 6546252
    private client: AxiosInstance
    private baseUrl: string
    private useMockData: boolean
    private authEmail?: string
    private authPassword?: string
    private refreshMarginMs: number
    private currentToken?: string
    private tokenExpiryMs?: number

    constructor(token: string, options?: ShiprocketServiceOptions) {
        this.baseUrl = options?.baseUrl || 'https://apiv2.shiprocket.in/v1/external'
        this.useMockData = options?.useMockData ?? true
        this.authEmail = options?.authEmail
        this.authPassword = options?.authPassword
        this.refreshMarginMs = (options?.tokenRefreshMarginSeconds ?? 300) * 1000
        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: options?.timeoutMs || 20000,
            headers: {
                'Content-Type': 'application/json',
            },
        })
        if (!this.useMockData && token) {
            this.setToken(token)
        }
    }

    /**
     * Fetches all orders between the provided start and end dates (inclusive).
     * Handles pagination until all pages are collected.
     */
    async fetchOrders(startDate: Date, endDate: Date, query?: ShiprocketOrderQuery): Promise<ShiprocketOrder[]> {
        await this.ensureToken()
        const channelId = query?.channelId ?? ShiprocketService.DEFAULT_CHANNEL_ID
        if (this.useMockData) {
            return this.applyQueryFilters(shiprocketOrdersMock.data || [], { ...query, channelId })
        }

        const orders: ShiprocketOrder[] = []
        let page = query?.page ?? 1
        const perPage = query?.perPage ?? 100
        const startDateStr = this.formatDate(startDate)
        const endDateStr = this.formatDate(endDate)

        while (true) {
            try {
                const params = {
                    page,
                    per_page: perPage,
                    sort: query?.sort,
                    sort_by: query?.sortBy,
                    to: query?.to ?? endDateStr,
                    from: query?.from ?? startDateStr,
                    filter_by: query?.filterBy,
                    filter: query?.filter,
                    search: query?.search,
                    pickup_location: query?.pickupLocation,
                    channel_id: channelId,
                    fbs: query?.fbs,
                    // Shiprocket also supports start/end + from/to variants; send both to be safe.
                    start_date: startDateStr,
                    end_date: endDateStr,
                    from_date: startDateStr,
                    to_date: endDateStr,
                }

                const response = await this.client.get('/orders', {
                    params,
                })

                const pageOrders = Array.isArray(response.data?.data) ? response.data.data : []
                orders.push(...pageOrders)

                const pagination = response.data?.meta?.pagination
                const totalPages = pagination?.total_pages || (pageOrders.length < perPage ? page : page + 1)

                if (!pagination || page >= totalPages) {
                    break
                }

                page += 1
            } catch (error: any) {
                console.error('Failed to fetch Shiprocket orders:', error?.message || error)
                if (error?.response?.data) {
                    console.error('Shiprocket response:', JSON.stringify(error.response.data, null, 2))
                }
                throw error
            }
        }

        return orders
    }

    private async ensureToken(): Promise<void> {
        if (this.useMockData) {
            return
        }

        const now = Date.now()
        const isExpired = !this.currentToken || !this.tokenExpiryMs || this.tokenExpiryMs - this.refreshMarginMs <= now

        if (!isExpired) {
            return
        }

        if (!this.authEmail || !this.authPassword) {
            throw new Error('Shiprocket credentials are missing. Set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD.')
        }

        try {
            const response = await axios.post(
                `${this.baseUrl}/auth/login`,
                { email: this.authEmail, password: this.authPassword },
                { timeout: 15000, headers: { 'Content-Type': 'application/json' } }
            )

            const newToken = response.data?.token
            if (!newToken) {
                throw new Error('Shiprocket login did not return a token')
            }

            this.setToken(newToken)
        } catch (error: any) {
            console.error('Failed to refresh Shiprocket token:', error?.message || error)
            if (error?.response?.data) {
                console.error('Shiprocket auth response:', JSON.stringify(error.response.data, null, 2))
            }
            throw error
        }
    }

    private applyQueryFilters(orders: ShiprocketOrder[], query?: ShiprocketOrderQuery): ShiprocketOrder[] {
        if (!query) {
            return orders
        }

        let filtered = [...orders]

        if (query.filterBy && query.filter !== undefined) {
            const keyMap: Record<string, keyof ShiprocketOrder> = {
                status: 'status',
                payment_method: 'payment_method',
                delivery_country: 'delivery_country',
                channel_order_id: 'channel_order_id',
            }
            const key = keyMap[query.filterBy]
            if (key) {
                filtered = filtered.filter(order => `${(order as any)[key] ?? ''}`.toUpperCase() === `${query.filter}`.toUpperCase())
            }
        }

        if (query.search) {
            const term = query.search.toUpperCase()
            filtered = filtered.filter(order => `${order.channel_order_id ?? ''}`.toUpperCase().includes(term) || `${(order as any).awb ?? ''}`.toUpperCase().includes(term))
        }

        if (query.pickupLocation) {
            const term = query.pickupLocation.toUpperCase()
            filtered = filtered.filter(order => `${(order as any).pickup_location ?? ''}`.toUpperCase().includes(term))
        }

        if (query.channelId !== undefined) {
            filtered = filtered.filter(order => order.channel_id === query.channelId)
        }

        if (query.fbs !== undefined) {
            filtered = filtered.filter(order => (order as any).fbs === query.fbs)
        }

        const page = query.page ?? 1
        const perPage = query.perPage ?? filtered.length
        const start = (page - 1) * perPage
        const end = start + perPage
        return filtered.slice(start, end)
    }

    private setToken(token: string): void {
        this.currentToken = token
        this.tokenExpiryMs = this.decodeTokenExpiry(token)
        this.client.defaults.headers.common.Authorization = `Bearer ${token}`
    }

    private decodeTokenExpiry(token: string): number | undefined {
        const parts = token.split('.')
        if (parts.length < 2) {
            return undefined
        }
        try {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
            if (payload?.exp) {
                return Number(payload.exp) * 1000
            }
        } catch (err) {
            return undefined
        }
        return undefined
    }

    private formatDate(date: Date): string {
        const year = date.getFullYear()
        const month = `${date.getMonth() + 1}`.padStart(2, '0')
        const day = `${date.getDate()}`.padStart(2, '0')
        return `${year}-${month}-${day}`
    }
}
