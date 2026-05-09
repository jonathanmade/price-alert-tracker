import { useState } from 'react'
import { useHistory } from '../hooks/useHistory'
import PriceChart from '../components/alerts/PriceChart'
import type { Alert, PriceHistory } from '../api/types'

const statusLabel: Record<string, { label: string; className: string }> = {
  triggered: { label: '¡Precio alcanzado!', className: 'bg-indigo-50 text-indigo-700' },
  paused:    { label: 'Pausada',            className: 'bg-gray-100 text-gray-500' },
}

export default function History() {
  const { alerts, loading, fetchPriceHistory } = useHistory()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [chartData, setChartData] = useState<Record<string, PriceHistory[]>>({})
  const [loadingChart, setLoadingChart] = useState<string | null>(null)

  const handleExpand = async (alert: Alert) => {
    if (expanded === alert.id) {
      setExpanded(null)
      return
    }
    setExpanded(alert.id)
    if (!chartData[alert.product_id]) {
      setLoadingChart(alert.product_id)
      const history = await fetchPriceHistory(alert.product_id)
      setChartData(prev => ({ ...prev, [alert.product_id]: history }))
      setLoadingChart(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Historial</h1>
        <p className="text-sm text-gray-400 mt-0.5">Alertas disparadas y pausadas</p>
      </div>

      {/* Empty state */}
      {alerts.length === 0 && (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">📜</p>
          <h3 className="text-base font-semibold text-gray-700 mb-1">Sin historial todavía</h3>
          <p className="text-sm text-gray-400">
            Aquí aparecerán las alertas cuando se disparen o las pausas.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {alerts.map(alert => {
          const product = alert.products
          const isExpanded = expanded === alert.id
          const status = statusLabel[alert.status] ?? statusLabel.paused

          return (
            <div
              key={alert.id}
              className="bg-white border border-gray-200 rounded-2xl overflow-hidden"
            >
              {/* Row */}
              <button
                onClick={() => handleExpand(alert)}
                className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
              >
                {/* Status badge */}
                <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${status.className}`}>
                  {status.label}
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {product?.name ?? 'Producto'}
                  </p>
                  {alert.triggered_at && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(alert.triggered_at).toLocaleDateString('es-ES', {
                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  )}
                </div>

                {/* Prices */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900">
                    {product?.current_price != null ? `${Number(product.current_price).toFixed(2)} €` : '—'}
                  </p>
                  <p className="text-xs text-gray-400">
                    objetivo: {Number(alert.target_price).toFixed(2)} €
                  </p>
                </div>

                {/* Chevron */}
                <span className={`text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                  ▾
                </span>
              </button>

              {/* Chart panel */}
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-4 mb-3">
                    Historial de precios
                  </p>

                  {loadingChart === alert.product_id ? (
                    <div className="h-40 flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <PriceChart
                      history={chartData[alert.product_id] ?? []}
                      targetPrice={Number(alert.target_price)}
                    />
                  )}

                  <a
                    href={product?.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-4 text-xs text-indigo-600 hover:underline"
                  >
                    Ver producto →
                  </a>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
