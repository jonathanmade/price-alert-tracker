import { useState } from 'react'
import { scrapeMetadata, type ProductMetadata } from '../../api/djangoApi'
import type { AdditionalUrl } from '../../api/types'

interface Props {
  onClose: () => void
  onCreate: (
    url: string,
    name: string,
    targetPrice: number,
    checkTime: string,
    additionalUrls?: AdditionalUrl[],
  ) => Promise<{ error: string | null }>
}

type MetaStatus = 'idle' | 'loading' | 'done' | 'failed'

interface ExtraUrl {
  id: number
  url: string
  meta: ProductMetadata | null
  metaStatus: MetaStatus
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

export default function AlertModal({ onClose, onCreate }: Props) {
  const [url, setUrl]         = useState('')
  const [name, setName]       = useState('')
  const [price, setPrice]     = useState('')
  const [hour, setHour]       = useState('09')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const [metaStatus, setMetaStatus] = useState<MetaStatus>('idle')
  const [meta, setMeta]             = useState<ProductMetadata | null>(null)
  const [extraUrls, setExtraUrls]   = useState<ExtraUrl[]>([])

  const fetchMeta = async (rawUrl: string) => {
    try { new URL(rawUrl) } catch { return }
    setMetaStatus('loading')
    const data = await scrapeMetadata(rawUrl)
    if (data.name) {
      setMeta(data)
      if (!name) setName(data.name)
      if (!price && data.price) {
        setPrice(String(Math.floor(data.price * 0.9 * 100) / 100))
      }
      setMetaStatus('done')
    } else {
      setMetaStatus('failed')
    }
  }

  const fetchExtraMeta = async (id: number, rawUrl: string) => {
    try { new URL(rawUrl) } catch { return }
    setExtraUrls(prev => prev.map(u => u.id === id ? { ...u, metaStatus: 'loading' } : u))
    const data = await scrapeMetadata(rawUrl)
    setExtraUrls(prev => prev.map(u => u.id === id
      ? { ...u, meta: data.name ? data : null, metaStatus: data.name ? 'done' : 'failed' }
      : u))
  }

  const handleUrlBlur = () => {
    if (url && metaStatus === 'idle') fetchMeta(url)
  }

  const handleUrlChange = (v: string) => {
    setUrl(v)
    setMetaStatus('idle')
    setMeta(null)
  }

  const addExtra = () => {
    setExtraUrls(prev => [...prev, { id: Date.now(), url: '', meta: null, metaStatus: 'idle' }])
  }

  const removeExtra = (id: number) => {
    setExtraUrls(prev => prev.filter(u => u.id !== id))
  }

  const updateExtra = (id: number, v: string) => {
    setExtraUrls(prev => prev.map(u => u.id === id ? { ...u, url: v, meta: null, metaStatus: 'idle' } : u))
  }

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
    const additionalUrls: AdditionalUrl[] = extraUrls
      .filter(u => u.url.trim())
      .map(u => ({ url: u.url.trim(), marketplace_label: domainLabel(u.url) }))

    const { error } = await onCreate(url, name || url, targetPrice, checkTime, additionalUrls)
    setLoading(false)
    if (error) { setError(error); return }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-base font-semibold text-gray-900">Nueva alerta de precio</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* Primary URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL del producto</label>
            <div className="relative">
              <input
                type="url"
                required
                value={url}
                onChange={e => handleUrlChange(e.target.value)}
                onBlur={handleUrlBlur}
                placeholder="https://amazon.es/dp/..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-9"
              />
              {metaStatus === 'loading' && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Detectamos nombre y precio automáticamente al pegar la URL.
            </p>
          </div>

          {/* Primary product preview */}
          {metaStatus === 'done' && meta && (
            <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
              {meta.image_url && (
                <img
                  src={meta.image_url}
                  alt=""
                  className="w-12 h-12 object-contain rounded-lg bg-white border border-gray-100 shrink-0"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-indigo-600 mb-0.5">{domainLabel(url)}</p>
                <p className="text-sm font-medium text-gray-800 truncate">{meta.name}</p>
                {meta.price != null && (
                  <p className="text-xs text-gray-500 mt-0.5">Precio actual: <b>€{meta.price.toFixed(2)}</b></p>
                )}
              </div>
              <span className="text-green-500 text-lg shrink-0">✓</span>
            </div>
          )}

          {/* Additional marketplace URLs */}
          {extraUrls.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Otras tiendas</p>
              {extraUrls.map(extra => (
                <div key={extra.id} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="url"
                        value={extra.url}
                        onChange={e => updateExtra(extra.id, e.target.value)}
                        onBlur={() => { if (extra.url && extra.metaStatus === 'idle') fetchExtraMeta(extra.id, extra.url) }}
                        placeholder="https://pccomponentes.com/..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-9"
                      />
                      {extra.metaStatus === 'loading' && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeExtra(extra.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors text-xl leading-none px-1 shrink-0"
                    >
                      ×
                    </button>
                  </div>
                  {extra.metaStatus === 'done' && extra.meta?.price != null && (
                    <div className="flex items-center gap-2 pl-1 text-xs">
                      <span className="text-green-500">✓</span>
                      <span className="font-medium text-gray-700">{domainLabel(extra.url)}</span>
                      <span className="text-indigo-600 font-semibold">€{extra.meta.price.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add marketplace button */}
          {metaStatus === 'done' && (
            <button
              type="button"
              onClick={addExtra}
              className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
            >
              <span className="w-4 h-4 rounded-full border border-indigo-400 flex items-center justify-center text-indigo-500 leading-none">+</span>
              Añadir otra tienda
            </button>
          )}

          {/* Name */}
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

          {/* Target price */}
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
            <p className="text-xs text-gray-400 mt-1">
              {meta?.price != null
                ? <>Precio actual en {domainLabel(url)}: €{meta.price.toFixed(2)} · Te avisamos cuando cualquier tienda baje de tu objetivo.</>
                : 'Te avisamos cuando el precio baje de esta cantidad en cualquiera de las tiendas.'}
            </p>
          </div>

          {/* Check hour */}
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
              <p className="text-xs text-gray-400">Comprueba todas las tiendas a esta hora.</p>
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
