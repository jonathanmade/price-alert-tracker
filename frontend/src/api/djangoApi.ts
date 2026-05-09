import { supabase } from './supabase'

const BASE_URL = import.meta.env.VITE_DJANGO_API_URL as string

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token ?? ''}`,
  }
}

export async function triggerPriceCheck(alertId: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/check-price/`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ alert_id: alertId }),
    })
    return res.ok
  } catch {
    return false
  }
}
