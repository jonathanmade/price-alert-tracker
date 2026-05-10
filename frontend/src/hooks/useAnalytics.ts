import { useEffect, useState } from 'react'
import { supabase } from '../api/supabase'
import type { Alert } from '../api/types'

export interface MonthBucket {
  month: string   // "2026-05"
  count: number
}

export interface AnalyticsData {
  activeCount:      number
  triggeredCount:   number
  totalChecks:      number
  estimatedSavings: number
  triggeredAlerts:  Alert[]
  monthlyActivity:  MonthBucket[]
}

function lastNMonths(n: number): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

export function useAnalytics() {
  const [data, setData]       = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const months = lastNMonths(6)
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

      const [alertsRes, checksRes, historyRes] = await Promise.all([
        supabase
          .from('alerts')
          .select('*, products(*), alert_urls(*)')
          .order('created_at', { ascending: false }),
        supabase
          .from('credit_transactions')
          .select('*', { count: 'exact', head: true })
          .eq('reason', 'price_check'),
        supabase
          .from('price_history')
          .select('checked_at')
          .gte('checked_at', sixMonthsAgo.toISOString()),
      ])

      const alerts = (alertsRes.data ?? []) as Alert[]

      const activeCount    = alerts.filter(a => a.status === 'active').length
      const triggeredCount = alerts.filter(a => a.status === 'triggered').length

      const triggered = alerts.filter(a => a.status === 'triggered')
      const estimatedSavings = triggered.reduce((sum, a) => {
        const current = a.products?.current_price ?? null
        if (current == null) return sum
        return sum + Math.max(0, a.target_price - current)
      }, 0)

      // Sort triggered by savings descending
      const triggeredSorted = [...triggered].sort((a, b) => {
        const savA = Math.max(0, a.target_price - (a.products?.current_price ?? a.target_price))
        const savB = Math.max(0, b.target_price - (b.products?.current_price ?? b.target_price))
        return savB - savA
      })

      // Monthly activity buckets
      const bucketMap: Record<string, number> = {}
      months.forEach(m => { bucketMap[m] = 0 })
      ;(historyRes.data ?? []).forEach(h => {
        const m = h.checked_at.substring(0, 7)
        if (m in bucketMap) bucketMap[m]++
      })
      const monthlyActivity: MonthBucket[] = months.map(m => ({ month: m, count: bucketMap[m] }))

      setData({
        activeCount,
        triggeredCount,
        totalChecks:      checksRes.count ?? 0,
        estimatedSavings,
        triggeredAlerts:  triggeredSorted,
        monthlyActivity,
      })
      setLoading(false)
    }

    fetch()
  }, [])

  return { data, loading }
}
