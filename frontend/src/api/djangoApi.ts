import { supabase } from './supabase'

const BASE_URL = import.meta.env.VITE_DJANGO_API_URL as string

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token ?? ''}`,
  }
}

interface CheckResult {
  price: number | null
  triggered: boolean
  credits_remaining: number
  error?: string
}

export async function triggerPriceCheck(alertId: string): Promise<CheckResult> {
  try {
    const res = await fetch(`${BASE_URL}/api/check-price/`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ alert_id: alertId }),
    })
    const data = await res.json()
    if (!res.ok) return { price: null, triggered: false, credits_remaining: 0, error: data.error }
    return data
  } catch {
    return { price: null, triggered: false, credits_remaining: 0, error: 'Error de conexión con el servidor' }
  }
}
