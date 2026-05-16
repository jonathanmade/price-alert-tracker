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

// ── Telegram API ─────────────────────────────────────────────────────────────

export interface TelegramStatus {
  linked: boolean
  username?: string
  first_name?: string
  linked_at?: string
}

export async function getTelegramStatus(): Promise<TelegramStatus> {
  try {
    const res = await fetch(`${BASE_URL}/api/telegram/status/`, {
      headers: await authHeaders(),
    })
    return await res.json()
  } catch {
    return { linked: false }
  }
}

export async function getTelegramLinkUrl(): Promise<{ link_url?: string; expires_in?: number; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/api/telegram/link/`, {
      method: 'POST',
      headers: await authHeaders(),
    })
    return await res.json()
  } catch {
    return { error: 'Error de conexión' }
  }
}

export async function unlinkTelegram(): Promise<{ ok?: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/api/telegram/unlink/`, {
      method: 'POST',
      headers: await authHeaders(),
    })
    return await res.json()
  } catch {
    return { error: 'Error de conexión' }
  }
}

// ── Metadata scraping ─────────────────────────────────────────────────────────

export interface ProductMetadata {
  name?: string
  image_url?: string | null
  price?: number | null
}

export async function scrapeMetadata(url: string): Promise<ProductMetadata> {
  try {
    const res = await fetch(`${BASE_URL}/api/scrape-metadata/`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ url }),
    })
    return await res.json()
  } catch {
    return {}
  }
}

// ── Outbound click tracking ───────────────────────────────────────────────────

export async function trackOutboundClick(productId: string): Promise<void> {
  try {
    await fetch(`${BASE_URL}/api/track-outbound/`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ product_id: productId }),
    })
  } catch {
    // fire-and-forget: never block the user
  }
}

// ── Price check ───────────────────────────────────────────────────────────────

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
