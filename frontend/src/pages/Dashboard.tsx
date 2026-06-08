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
      <div className="bg-white border-b border-gray-100 px-4 sm:px-8 py-4 flex items-center justify-between gap-3 flex-wrap">
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
      <div className="px-4 sm:px-8 py-6 sm:py-8 space-y-6">

        {/* Empty state — onboarding */}
        {alerts.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-8 py-10 text-center">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <svg className="w-7 h-7 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                Rastrea el precio de cualquier producto
              </h3>
              <p className="text-sm text-gray-500 mb-8 max-w-sm mx-auto">
                Pega la URL de un producto de Amazon, PCComponentes, MediaMarkt o cualquier tienda
                y te avisamos cuando baje el precio.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 max-w-md mx-auto text-left">
                {([
                  { n: '1', title: 'Pega la URL',     desc: 'Del producto que quieres seguir' },
                  { n: '2', title: 'Fija tu precio',   desc: 'El máximo que pagarías' },
                  { n: '3', title: 'Recibe la alerta', desc: 'Por email y Telegram' },
                ] as const).map(step => (
                  <div key={step.n} className="flex flex-col gap-1.5">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                      {step.n}
                    </span>
                    <p className="text-xs font-semibold text-gray-700">{step.title}</p>
                    <p className="text-xs text-gray-400">{step.desc}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowModal(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
              >
                Crear mi primera alerta
              </button>
            </div>
          </div>
        )}

        {/* Triggered */}
        {triggered.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Precio alcanzado
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
