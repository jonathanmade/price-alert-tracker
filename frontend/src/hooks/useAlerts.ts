import { useEffect, useState } from 'react'
import { supabase } from '../api/supabase'
import { triggerPriceCheck } from '../api/djangoApi'
import type { Alert, AdditionalUrl } from '../api/types'

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAlerts = async () => {
    const { data } = await supabase
      .from('alerts')
      .select('*, products(*), alert_urls(*)')
      .order('created_at', { ascending: false })
    setAlerts((data as Alert[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchAlerts() }, [])

  const createAlert = async (
    url: string,
    name: string,
    targetPrice: number,
    checkTime: string,
    additionalUrls?: AdditionalUrl[],
  ): Promise<{ error: string | null }> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado' }

    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({ user_id: user.id, url, name })
      .select()
      .single()

    if (productError) return { error: productError.message }

    const { data: alert, error: alertError } = await supabase
      .from('alerts')
      .insert({ user_id: user.id, product_id: product.id, target_price: targetPrice, check_time: checkTime })
      .select()
      .single()

    if (alertError) return { error: alertError.message }

    if (additionalUrls && additionalUrls.length > 0) {
      await supabase.from('alert_urls').insert(
        additionalUrls.map(au => ({ alert_id: alert.id, url: au.url, marketplace_label: au.marketplace_label }))
      )
    }

    await fetchAlerts()
    triggerPriceCheck(alert.id)

    return { error: null }
  }

  const deleteAlert = async (alertId: string, productId: string) => {
    await supabase.from('alerts').delete().eq('id', alertId)
    await supabase.from('products').delete().eq('id', productId)
    await fetchAlerts()
  }

  const togglePause = async (alert: Alert) => {
    const newStatus = alert.status === 'paused' ? 'active' : 'paused'
    await supabase.from('alerts').update({ status: newStatus }).eq('id', alert.id)
    await fetchAlerts()
  }

  const checkNow = async (alertId: string) => {
    const result = await triggerPriceCheck(alertId)
    if (result.price !== null) {
      window.dispatchEvent(new Event('credits-updated'))
    }
    await fetchAlerts()
    return result
  }

  const updateCheckTime = async (alertId: string, checkTime: string) => {
    await supabase.from('alerts').update({ check_time: checkTime }).eq('id', alertId)
    await fetchAlerts()
  }

  return { alerts, loading, createAlert, deleteAlert, togglePause, checkNow, updateCheckTime }
}
