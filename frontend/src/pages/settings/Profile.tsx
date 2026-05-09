import { useEffect, useState } from 'react'
import { supabase } from '../../api/supabase'

export default function Profile() {
  const [email, setEmail]       = useState('')
  const [fullName, setFullName] = useState('')
  const [saved, setSaved]       = useState(false)
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? '')
      setFullName(data.user?.user_metadata?.full_name ?? '')
    })
  }, [])

  const initials = fullName
    ? fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : email ? email[0].toUpperCase()
    : '?'

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await supabase.auth.updateUser({ data: { full_name: fullName } })
    setLoading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="max-w-xl space-y-6">
      <section className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-6">Perfil público</h2>

        {/* Avatar */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-indigo-600 text-white text-2xl font-bold flex items-center justify-center shrink-0">
            {initials}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Avatar</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Generado automáticamente a partir de tus iniciales.
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre completo
            </label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Tu nombre"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar cambios'}
            </button>
            {saved && (
              <span className="text-sm text-green-600 font-medium">✓ Guardado</span>
            )}
          </div>
        </form>
      </section>
    </div>
  )
}
