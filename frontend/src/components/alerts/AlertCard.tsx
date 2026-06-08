import { useState } from 'react'
import type { Alert } from '../../api/types'
import { trackOutboundClick } from '../../api/djangoApi'

interface Props {
  alert: Alert
  onDelete: (alertId: string, productId: string) => void
  onTogglePause: (alert: Alert) => void
  onCheckNow: (alertId: string) => Promise<{ price: number | null; error?: string }>
  onUpdateCheckTime: (alertId: string, checkTime: string) => Promise<void>
}

const statusConfig = {
  active:    { dot: 'bg-green-400',  label: 'Activa',    text: 'text-green-700',  bg: 'bg-green-50' },
  triggered: { dot: 'bg-indigo-400', label: 'Disparada', text: 'text-indigo-700', bg: 'bg-indigo-50' },
  paused:    { dot: 'bg-gray-300',   label: 'Pausada',   text: 'text-gray-500',   bg: 'bg-gray-50' },
}

function formatHour(checkTime: string): string {
  return checkTime ? checkTime.substring(0, 5) : '09:00'
}

function domainLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace('www.', '')
    const name = host.split('.')[0]
    return name.charAt(0).toUpperCase() + name.slice(1)
  } catch {
    return url
  }
}

export default function AlertCard({ alert, onDelete, onTogglePause, onCheckNow, onUpdateCheckTime }: Props) {
  const [checking, setChecking]         = useState(false)
  const [checkMsg, setCheckMsg]         = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [editingTime, setEditingTime]   = useState(false)
  const [selectedHour, setSelectedHour] = useState(alert.check_time?.substring(0, 2) ?? '09')

  const handleCheckNow = async () => {
    setChecking(true)
    setCheckMsg(null)
    const result = await onCheckNow(alert.id)
    setChecking(false)
    if (result.error) {
      setCheckMsg({ type: 'error', text: result.error })
    } else if (result.price !== null) {
      setCheckMsg({ type: 'ok', text: `Precio actualizado: ${result.price.toFixed(2)} € · −1 crédito` })
    }
    setTimeout(() => setCheckMsg(null), 6000)
  }

  const handleSaveTime = async () => {
    await onUpdateCheckTime(alert.id, `${selectedHour.padStart(2, '0')}:00:00`)
    setEditingTime(false)
  }

  const product = alert.products
  const config  = statusConfig[alert.status]

  // Build marketplace prices array (primary + additional)
  const allPrices = [
    { label: domainLabel(product?.url ?? ''), price: product?.current_price ?? null, url: product?.url ?? '' },
    ...(alert.alert_urls ?? []).map(au => ({
      label: au.marketplace_label || domainLabel(au.url),
      price: au.current_price,
      url:   au.url,
    })),
  ]
  const hasMultiple = allPrices.length > 1

  const validPrices = allPrices.map(p => p.price).filter((p): p is number => p != null)
  const lowestPrice = validPrices.length > 0 ? Math.min(...validPrices) : null

  const priceDiff = lowestPrice != null
    ? Math.round(((lowestPrice - alert.target_price) / alert.target_price) * 100)
    : null

  return (
    <>
      {/* ── DESKTOP (sm y superior) ───────────────────────────────────── */}
      <div className="hidden sm:flex flex-col bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">

        {/* Imagen */}
        <div className="relative h-40 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
          {product?.image_url ? (
            <img
              src={product.image_url}
              alt={product.name ?? ''}
              className="w-full h-full object-contain p-4"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            <svg className="w-14 h-14 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 3H8l-2 4h12l-2-4z" />
            </svg>
          )}

          {/* Badge status */}
          <span className={`absolute top-3 left-3 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${config.bg} ${config.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
            {config.label}
          </span>

          {/* Badge priceDiff */}
          {priceDiff !== null && (
            <span className={`absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full ${
              priceDiff <= 0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-600'
            }`}>
              {priceDiff > 0 ? `+${priceDiff}%` : `${priceDiff}%`}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col gap-3 p-4 flex-1">

          {/* Nombre */}
          <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">
            {product?.name ?? 'Sin nombre'}
          </h3>

          {/* Marketplace chips */}
          <div className="flex flex-wrap gap-1">
            {allPrices.map(mp => (
              <a
                key={mp.url}
                href={mp.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => product?.id && trackOutboundClick(product.id)}
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  mp.price === lowestPrice && mp.price != null
                    ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className="font-medium">{mp.label}</span>
                {mp.price != null && <span>€{mp.price.toFixed(2)}</span>}
                {mp.price === lowestPrice && mp.price != null && <span className="font-bold">↓</span>}
              </a>
            ))}
          </div>

          {/* Bloque de precios */}
          <div className="bg-gray-50 rounded-xl px-3 py-2.5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-400 mb-0.5">{hasMultiple ? 'Más bajo' : 'Actual'}</p>
              <p className="text-base font-bold text-gray-900">
                {lowestPrice != null ? `€${lowestPrice.toFixed(2)}` : '—'}
              </p>
            </div>
            <div className="w-px h-8 bg-gray-200 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-400 mb-0.5">Mi objetivo</p>
              <p className="text-base font-semibold text-indigo-600">€{alert.target_price.toFixed(2)}</p>
            </div>
          </div>

          {/* Hora revisión */}
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 6v6l4 2"/>
            </svg>
            <span className="text-xs text-gray-400">Revisión:</span>
            {editingTime ? (
              <>
                <select
                  value={selectedHour}
                  onChange={e => setSelectedHour(e.target.value)}
                  className="text-xs border border-gray-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={String(i).padStart(2, '0')}>
                      {String(i).padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
                <button onClick={handleSaveTime} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Guardar</button>
                <button onClick={() => setEditingTime(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
              </>
            ) : (
              <>
                <span className="text-xs font-medium text-gray-700">{formatHour(alert.check_time ?? '09:00:00')}</span>
                <button onClick={() => setEditingTime(true)} className="text-xs text-gray-400 hover:text-indigo-500 transition-colors">Editar</button>
              </>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Acciones */}
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <button
              onClick={handleCheckNow}
              disabled={checking}
              className="flex-1 text-xs text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg border border-indigo-100 hover:border-indigo-300 transition-colors disabled:opacity-50"
            >
              {checking ? 'Buscando...' : 'Comprobar'}
            </button>
            <button
              onClick={() => onTogglePause(alert)}
              className="text-xs text-gray-400 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
              title={alert.status === 'paused' ? 'Reanudar' : 'Pausar'}
            >
              {alert.status === 'paused' ? '▶' : '⏸'}
            </button>
            <button
              onClick={() => onDelete(alert.id, alert.product_id)}
              className="text-xs text-red-400 hover:text-red-600 px-3 py-1.5 rounded-lg border border-red-50 hover:border-red-200 transition-colors"
              title="Eliminar"
            >
              🗑
            </button>
          </div>

          {/* Check result banner */}
          {checkMsg && (
            <div className={`rounded-xl px-3 py-2 text-xs font-medium ${
              checkMsg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
            }`}>
              {checkMsg.type === 'ok' ? '✓ ' : '✕ '}{checkMsg.text}
            </div>
          )}

          {/* Triggered banner */}
          {alert.status === 'triggered' && (
            <div className="bg-indigo-50 rounded-xl px-3 py-2 text-xs text-indigo-700 font-medium">
              ¡Precio alcanzado! Te hemos enviado un email.
            </div>
          )}
        </div>
      </div>

      {/* ── MÓVIL (menor que sm) ──────────────────────────────────────── */}
      <div className="flex sm:hidden items-center gap-3 bg-white border border-gray-100 rounded-2xl p-3 shadow-sm">

        {/* Thumbnail */}
        <div className="w-14 h-14 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden">
          {product?.image_url ? (
            <img
              src={product.image_url}
              alt={product.name ?? ''}
              className="w-full h-full object-contain p-1"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            <svg className="w-7 h-7 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 3H8l-2 4h12l-2-4z" />
            </svg>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full mb-1 ${config.bg} ${config.text}`}>
            <span className={`w-1 h-1 rounded-full ${config.dot}`} />
            {config.label}
          </span>
          <p className="text-sm font-semibold text-gray-900 truncate leading-snug">
            {product?.name ?? 'Sin nombre'}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-gray-500">
              {lowestPrice != null ? `€${lowestPrice.toFixed(2)}` : '—'}
            </span>
            <span className="text-gray-300 text-xs">→</span>
            <span className="text-xs font-semibold text-indigo-600">€{alert.target_price.toFixed(2)}</span>
            {priceDiff !== null && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                priceDiff <= 0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-600'
              }`}>
                {priceDiff > 0 ? `+${priceDiff}%` : `${priceDiff}%`}
              </span>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            onClick={handleCheckNow}
            disabled={checking}
            className="text-[10px] text-indigo-600 hover:text-indigo-800 px-2.5 py-1 rounded-lg border border-indigo-100 hover:border-indigo-300 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {checking ? '...' : 'Comprobar'}
          </button>
          <button
            onClick={() => onDelete(alert.id, alert.product_id)}
            className="text-[10px] text-red-400 hover:text-red-600 px-2.5 py-1 rounded-lg border border-red-50 hover:border-red-200 transition-colors"
          >
            Eliminar
          </button>
        </div>
      </div>
    </>
  )
}
