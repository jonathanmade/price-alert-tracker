import { useState } from 'react'

interface Props {
  onClose: () => void
  onCreate: (url: string, name: string, targetPrice: number, checkTime: string) => Promise<{ error: string | null }>
}

export default function AlertModal({ onClose, onCreate }: Props) {
  const [url, setUrl]         = useState('')
  const [name, setName]       = useState('')
  const [price, setPrice]     = useState('')
  const [hour, setHour]       = useState('09')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const targetPrice = parseFloat(price)
    if (!url || isNaN(targetPrice) || targetPrice <= 0) {
      setError('Rellena todos los campos correctamente.')
      return
    }

    setLoading(true)
    const checkTime = `${hour.padStart(2, '0')}:00:00`
    const { error } = await onCreate(url, name || url, targetPrice, checkTime)
    setLoading(false)

    if (error) { setError(error); return }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">

        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Nueva alerta de precio</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL del producto</label>
            <input
              type="url"
              required
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://amazon.es/dp/..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Nike Air Max 90"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Precio objetivo (€)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="0,00"
                className="w-full border border-gray-300 rounded-lg pl-7 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Te avisamos cuando el precio baje de esta cantidad.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hora de comprobación diaria</label>
            <div className="flex items-center gap-2">
              <select
                value={hour}
                onChange={e => setHour(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={String(i).padStart(2, '0')}>
                    {String(i).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400">El sistema comprobará el precio a esta hora cada día.</p>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Crear alerta'}
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}
