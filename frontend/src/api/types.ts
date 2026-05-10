export interface Profile {
  id: string
  email: string
  created_at: string
}

export interface Product {
  id: string
  user_id: string
  name: string
  url: string
  current_price: number | null
  last_checked_at: string | null
  created_at: string
}

export interface AlertUrl {
  id: string
  alert_id: string
  url: string
  marketplace_label: string
  current_price: number | null
  last_checked_at: string | null
  created_at: string
}

export interface AdditionalUrl {
  url: string
  marketplace_label: string
}

export interface Alert {
  id: string
  user_id: string
  product_id: string
  target_price: number
  status: 'active' | 'triggered' | 'paused'
  check_time: string        // "HH:00:00"
  triggered_at: string | null
  created_at: string
  products?: Product
  alert_urls?: AlertUrl[]
}

export interface PriceHistory {
  id: string
  product_id: string
  price: number
  checked_at: string
}
