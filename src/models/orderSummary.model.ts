export type ReportPeriod = 'daily' | 'weekly' | 'monthly'

export interface IOrderSummaryMetrics {
    totalOrders: number
    totalOrderValue: number
    cancelled: { count: number; value: number }
    delivered: { count: number; value: number }
    undelivered: { count: number; value: number }
    inTransit: { count: number; value: number }
    returns: { count: number; value: number }
}
