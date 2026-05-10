import { useState } from 'react'
import { useAlerts } from '../hooks/useAlerts'
import AlertCard from '../components/alerts/AlertCard'
import AlertModal from '../components/alerts/AlertModal'

export default function Dashboard() {
  const { alerts, loading, createAlert, deleteAlert, togglePause, checkNow, updateCheckTime } = useAlerts()
  const [showModal, setShowModal] = useState(false)

  const active    = alerts.filter(a => a.status === 'active')
  const triggered = alerts.filter(a => a.status === 'triggered')
  const paused    = alerts.filter(a => a.status === 'paused')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <>
      {/* Page header */}
      <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Mis alertas</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {alerts.length === 0
              ? 'Ninguna alerta todavía'
              : `${active.length} activa${active.length !== 1 ? 's' : ''} · ${alerts.length} en total`}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + Nueva alerta
        </button>
      </div>

      {/* Content */}
      <div className="px-8 py-8 space-y-6">

        {/* Empty state */}
        {alerts.length === 0 && (
          <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-12 text-center">
            <h3 className="text-base font-semibold text-gray-700 mb-1">Sin alertas todavía</h3>
            <p className="text-sm text-gray-400 mb-5">
              Crea tu primera alerta y te avisamos cuando baje el precio.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Crear primera alerta
            </button>
          </div>
        )}

        {/* Triggered */}
        {triggered.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Precio alcanzado
            </h2>
            <div className="space-y-3">
              {triggered.map(alert => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onDelete={deleteAlert}
                  onTogglePause={togglePause}
                  onCheckNow={checkNow}
                  onUpdateCheckTime={updateCheckTime}
                />
              ))}
            </div>
          </section>
        )}

        {/* Active */}
        {active.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Activas
            </h2>
            <div className="space-y-3">
              {active.map(alert => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onDelete={deleteAlert}
                  onTogglePause={togglePause}
                  onCheckNow={checkNow}
                  onUpdateCheckTime={updateCheckTime}
                />
              ))}
            </div>
          </section>
        )}

        {/* Paused */}
        {paused.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Pausadas
            </h2>
            <div className="space-y-3">
              {paused.map(alert => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onDelete={deleteAlert}
                  onTogglePause={togglePause}
                  onCheckNow={checkNow}
                  onUpdateCheckTime={updateCheckTime}
                />
              ))}
            </div>
          </section>
        )}

      </div>

      {showModal && (
        <AlertModal
          onClose={() => setShowModal(false)}
          onCreate={createAlert}
        />
      )}
    </>
  )
}
