import { useAnalytics, type MonthBucket } from '../hooks/useAnalytics'

const MONTH_LABELS: Record<string, string> = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
}

function formatMonth(ym: string): string {
  const [year, month] = ym.split('-')
  return `${MONTH_LABELS[month] ?? month} ${year.slice(2)}`
}

function ActivityChart({ data }: { data: MonthBucket[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1)
  const MAX_H = 72

  return (
    <div className="flex items-end gap-2 h-28 pt-6">
      {data.map(d => {
        const barH = d.count === 0 ? 4 : Math.max(6, Math.round((d.count / maxCount) * MAX_H))
        return (
          <div key={d.month} className="flex-1 flex flex-col items-center gap-1.5">
            {d.count > 0 && (
              <span className="text-xs text-gray-400">{d.count}</span>
            )}
            <div
              className={`w-full rounded-t-md ${d.count === 0 ? 'bg-gray-100' : 'bg-indigo-500'}`}
              style={{ height: barH }}
            />
            <span className="text-xs text-gray-400 whitespace-nowrap">{formatMonth(d.month)}</span>
          </div>
        )
      })}
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string
  sub?: string
  accent?: boolean
}

function StatCard({ label, value, sub, accent }: StatCardProps) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-bold ${accent ? 'text-green-600' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function Analytics() {
  const { data, loading } = useAnalytics()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data) return null

  const { activeCount, triggeredCount, totalChecks, estimatedSavings, triggeredAlerts, monthlyActivity } = data

  return (
    <>
      {/* Page header */}
      <div className="bg-white border-b border-gray-100 px-8 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Estadísticas</h1>
        <p className="text-xs text-gray-400 mt-0.5">Resumen de tu actividad y ahorro estimado</p>
      </div>

      <div className="px-8 py-8 space-y-6">

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Alertas activas"
            value={String(activeCount)}
            sub="monitorizando ahora"
          />
          <StatCard
            label="Alertas disparadas"
            value={String(triggeredCount)}
            sub="precios alcanzados"
          />
          <StatCard
            label="Comprobaciones"
            value={String(totalChecks)}
            sub="créditos consumidos"
          />
          <StatCard
            label="Ahorro estimado"
            value={estimatedSavings > 0 ? `€${estimatedSavings.toFixed(2)}` : '—'}
            sub="vs. tu precio máximo"
            accent={estimatedSavings > 0}
          />
        </div>

        {/* Monthly activity chart */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Actividad mensual</h2>
          <p className="text-xs text-gray-400 mb-4">Comprobaciones de precio de los últimos 6 meses</p>
          {monthlyActivity.every(b => b.count === 0) ? (
            <p className="text-sm text-gray-400 py-4">Sin actividad en este período.</p>
          ) : (
            <ActivityChart data={monthlyActivity} />
          )}
        </div>

        {/* Best finds */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50">
            <h2 className="text-sm font-semibold text-gray-900">Mejores encontrados</h2>
            <p className="text-xs text-gray-400 mt-0.5">Alertas disparadas con mayor ahorro</p>
          </div>

          {triggeredAlerts.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-gray-400">
                Todavía no se ha disparado ninguna alerta.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {triggeredAlerts.map(alert => {
                const product  = alert.products
                const savings  = Math.max(0, alert.target_price - (product?.current_price ?? alert.target_price))
                const hasSaved = savings > 0

                return (
                  <li key={alert.id} className="px-6 py-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {product?.name ?? 'Producto eliminado'}
                      </p>
                      {product?.url && (
                        <a
                          href={product.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-400 hover:text-indigo-500 transition-colors truncate block"
                        >
                          {product.url}
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-4 shrink-0 text-right">
                      <div>
                        <p className="text-xs text-gray-400">Mi objetivo</p>
                        <p className="text-sm font-semibold text-gray-700">€{alert.target_price.toFixed(2)}</p>
                      </div>
                      {product?.current_price != null && (
                        <div>
                          <p className="text-xs text-gray-400">Precio obtenido</p>
                          <p className="text-sm font-bold text-gray-900">€{product.current_price.toFixed(2)}</p>
                        </div>
                      )}
                      {hasSaved && (
                        <span className="text-sm font-bold text-green-600 bg-green-50 border border-green-100 px-2.5 py-1 rounded-xl">
                          −€{savings.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

      </div>
    </>
  )
}
