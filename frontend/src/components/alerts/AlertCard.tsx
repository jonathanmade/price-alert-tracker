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
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow transition-shadow">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">

        <div className="flex-1 min-w-0">
          {/* Status badge */}
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full mb-3 ${config.bg} ${config.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
            {config.label}
          </span>

          {/* Product name */}
          <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-1 truncate">
            {product?.name ?? 'Sin nombre'}
          </h3>

          {/* URL (single marketplace) or marketplace chips (multi) */}
          {hasMultiple ? (
            <div className="flex flex-wrap gap-1.5 mb-4 mt-2">
              {allPrices.map(mp => (
                <a
                  key={mp.url}
                  href={mp.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => product?.id && trackOutboundClick(product.id)}
                  className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    mp.price === lowestPrice && mp.price != null
                      ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="font-medium">{mp.label}</span>
                  <span>{mp.price != null ? `€${mp.price.toFixed(2)}` : '—'}</span>
                  {mp.price === lowestPrice && mp.price != null && (
                    <span className="font-bold">↓</span>
                  )}
                </a>
              ))}
            </div>
          ) : (
            <a
              href={product?.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => product?.id && trackOutboundClick(product.id)}
              className="text-xs text-gray-400 hover:text-indigo-500 truncate block mb-4 transition-colors"
            >
              {product?.url}
            </a>
          )}

          {/* Prices summary */}
          <div className="flex items-end gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">
                {hasMultiple ? 'Precio más bajo' : 'Precio actual'}
              </p>
              <p className="text-lg font-bold text-gray-900">
                {lowestPrice != null ? `${lowestPrice.toFixed(2)} €` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Mi objetivo</p>
              <p className="text-lg font-semibold text-indigo-600">
                {alert.target_price.toFixed(2)} €
              </p>
            </div>
            {priceDiff !== null && (
              <div className="mb-0.5">
                <span className={`text-xs font-medium px-2 py-1 rounded-lg ${
                  priceDiff <= 0
                    ? 'bg-green-50 text-green-600'
                    : 'bg-orange-50 text-orange-600'
                }`}>
                  {priceDiff > 0 ? `+${priceDiff}%` : `${priceDiff}%`}
                </span>
              </div>
            )}
          </div>

          {/* Check time */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-gray-400">Revisión diaria:</span>
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
                <button
                  onClick={handleSaveTime}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Guardar
                </button>
                <button
                  onClick={() => setEditingTime(false)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <span className="text-xs font-medium text-gray-700">
                  {formatHour(alert.check_time ?? '09:00:00')}
                </span>
                <button
                  onClick={() => setEditingTime(true)}
                  className="text-xs text-gray-400 hover:text-indigo-500 transition-colors"
                >
                  Editar
                </button>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-row sm:flex-col gap-2 shrink-0 flex-wrap">
          <button
            onClick={handleCheckNow}
            disabled={checking}
            className="text-xs text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg border border-indigo-200 hover:border-indigo-300 transition-colors disabled:opacity-50"
          >
            {checking ? 'Buscando...' : 'Comprobar ahora'}
          </button>
          <button
            onClick={() => onTogglePause(alert)}
            className="text-xs text-gray-400 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
          >
            {alert.status === 'paused' ? 'Reanudar' : 'Pausar'}
          </button>
          <button
            onClick={() => onDelete(alert.id, alert.product_id)}
            className="text-xs text-red-400 hover:text-red-600 px-3 py-1.5 rounded-lg border border-red-100 hover:border-red-200 transition-colors"
          >
            Eliminar
          </button>
        </div>

      </div>

      {/* Check result banner */}
      {checkMsg && (
        <div className={`mt-4 rounded-xl px-4 py-2.5 text-xs font-medium ${
          checkMsg.type === 'ok'
            ? 'bg-green-50 text-green-700'
            : 'bg-red-50 text-red-600'
        }`}>
          {checkMsg.type === 'ok' ? '✓ ' : '✕ '}{checkMsg.text}
        </div>
      )}

      {/* Triggered banner */}
      {alert.status === 'triggered' && (
        <div className="mt-4 bg-indigo-50 rounded-xl px-4 py-2.5 text-xs text-indigo-700 font-medium">
          ¡Precio alcanzado! Te hemos enviado un email.
        </div>
      )}
    </div>
  )
}
