import { useEffect, useState } from 'react'
import { getTelegramStatus, getTelegramLinkUrl, unlinkTelegram, type TelegramStatus } from '../../api/djangoApi'

export default function Notifications() {
  const [status, setStatus]     = useState<TelegramStatus | null>(null)
  const [loading, setLoading]   = useState(true)
  const [linkUrl, setLinkUrl]   = useState('')
  const [linkLoading, setLinkLoading] = useState(false)
  const [unlinkLoading, setUnlinkLoading] = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    getTelegramStatus().then(s => {
      setStatus(s)
      setLoading(false)
    })
  }, [])

  const handleConnect = async () => {
    setLinkLoading(true)
    setError('')
    const result = await getTelegramLinkUrl()
    setLinkLoading(false)
    if (result.error) {
      setError(result.error)
    } else if (result.link_url) {
      setLinkUrl(result.link_url)
    }
  }

  const handleRefresh = async () => {
    setLoading(true)
    setLinkUrl('')
    const s = await getTelegramStatus()
    setStatus(s)
    setLoading(false)
  }

  const handleUnlink = async () => {
    setUnlinkLoading(true)
    const result = await unlinkTelegram()
    setUnlinkLoading(false)
    if (!result.error) {
      setStatus({ linked: false })
      setLinkUrl('')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-24">
        <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-xl space-y-6">

      {/* Telegram section */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-3">
          {/* Telegram icon */}
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-sky-500" fill="currentColor">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 13.837l-2.95-.924c-.64-.203-.658-.64.136-.954l11.57-4.461c.537-.194 1.006.131.968.723z"/>
          </svg>
          <h2 className="text-sm font-semibold text-gray-900">Notificaciones por Telegram</h2>
        </div>

        <div className="px-6 py-5">
          {status?.linked ? (
            /* ── Linked state ── */
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-100 rounded-xl">
                <span className="text-green-500 text-xl">✓</span>
                <div>
                  <p className="text-sm font-semibold text-green-800">Telegram conectado</p>
                  <p className="text-xs text-green-600 mt-0.5">
                    {status.username ? `@${status.username}` : status.first_name}
                    {status.linked_at && (
                      <> · desde {new Date(status.linked_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</>
                    )}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Recibirás un mensaje en Telegram cada vez que el precio de un producto baje a tu objetivo.
                Puedes escribir <span className="font-mono bg-gray-100 px-1 rounded">/stop</span> al bot para pausar las notificaciones.
              </p>
              <button
                onClick={handleUnlink}
                disabled={unlinkLoading}
                className="text-sm text-red-500 border border-red-200 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {unlinkLoading ? 'Desconectando...' : 'Desconectar Telegram'}
              </button>
            </div>
          ) : linkUrl ? (
            /* ── Pending link state ── */
            <div className="space-y-4">
              <p className="text-sm font-medium text-gray-700">Sigue estos pasos para conectar tu cuenta:</p>
              <ol className="space-y-3 text-sm text-gray-600">
                <li className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <span>Abre el enlace en tu dispositivo con Telegram instalado:</span>
                </li>
              </ol>
              <a
                href={linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-400 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 13.837l-2.95-.924c-.64-.203-.658-.64.136-.954l11.57-4.461c.537-.194 1.006.131.968.723z"/>
                </svg>
                Abrir en Telegram
              </a>
              <ol className="space-y-3 text-sm text-gray-600 mt-2">
                <li className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <span>Pulsa <b>Iniciar</b> en el bot de Telegram.</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <span>Vuelve aquí y comprueba el estado.</span>
                </li>
              </ol>
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleRefresh}
                  className="text-sm text-indigo-600 border border-indigo-200 hover:bg-indigo-50 px-4 py-2 rounded-lg transition-colors"
                >
                  Comprobar estado
                </button>
                <p className="text-xs text-gray-400">El enlace caduca en 15 min.</p>
              </div>
            </div>
          ) : (
            /* ── Not linked state ── */
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Conecta tu cuenta de Telegram para recibir alertas de precio al instante, además del email.
              </p>
              <ul className="space-y-2 text-xs text-gray-500">
                <li className="flex gap-2"><span className="text-indigo-400">→</span> Notificaciones instantáneas cuando el precio baje</li>
                <li className="flex gap-2"><span className="text-indigo-400">→</span> Sin necesidad de revisar el email</li>
                <li className="flex gap-2"><span className="text-indigo-400">→</span> Puedes desconectarlo en cualquier momento</li>
              </ul>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                onClick={handleConnect}
                disabled={linkLoading}
                className="flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 13.837l-2.95-.924c-.64-.203-.658-.64.136-.954l11.57-4.461c.537-.194 1.006.131.968.723z"/>
                </svg>
                {linkLoading ? 'Generando enlace...' : 'Conectar Telegram'}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Email notifications info */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Email</h2>
        <div className="flex items-center gap-3">
          <span className="text-green-500">✓</span>
          <p className="text-sm text-gray-600">
            Las notificaciones por email están siempre activas para todas tus alertas.
          </p>
        </div>
      </section>

    </div>
  )
}
