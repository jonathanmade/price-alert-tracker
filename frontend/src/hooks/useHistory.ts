import { useEffect, useState } from 'react'
import { supabase } from '../api/supabase'
import type { Alert, PriceHistory } from '../api/types'

export function useHistory() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('alerts')
      .select('*, products(*)')
      .in('status', ['triggered', 'paused'])
      .order('triggered_at', { ascending: false })
      .then(({ data }) => {
        setAlerts((data as Alert[]) ?? [])
        setLoading(false)
      })
  }, [])

  const fetchPriceHistory = async (productId: string): Promise<PriceHistory[]> => {
    const { data } = await supabase
      .from('price_history')
      .select('*')
      .eq('product_id', productId)
      .order('checked_at', { ascending: true })
      .limit(30)
    return (data as PriceHistory[]) ?? []
  }

  return { alerts, loading, fetchPriceHistory }
}
