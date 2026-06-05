import { useEffect, useState } from 'react'
import { supabase } from '../../api/supabase'
import PasswordStrength, { validatePassword } from '../../components/ui/PasswordStrength'

export default function Account() {
  const [email, setEmail] = useState('')
  const [_currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [loadingPw, setLoadingPw] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''))
  }, [])

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwMsg(null)

    if (newPassword !== confirmPassword) {
      setPwMsg({ type: 'error', text: 'Las contraseñas no coinciden.' })
      return
    }
    if (!validatePassword(newPassword)) {
      setPwMsg({ type: 'error', text: 'La contraseña no cumple los requisitos mínimos.' })
      return
    }

    setLoadingPw(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setLoadingPw(false)

    if (error) {
      setPwMsg({ type: 'error', text: error.message })
    } else {
      setPwMsg({ type: 'success', text: 'Contraseña actualizada correctamente.' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  return (
    <div className="max-w-xl space-y-8">

      {/* Email */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Email</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dirección de email
          </label>
          <input
            type="email"
            value={email}
            disabled
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
          />
          <p className="text-xs text-gray-400 mt-1.5">
            Para cambiar el email contacta con soporte.
          </p>
        </div>
      </section>

      {/* Cambiar contraseña */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Contraseña</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nueva contraseña
            </label>
            <div className="relative">
              <input
                type={showNewPw ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowNewPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showNewPw ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                )}
              </button>
            </div>
            <PasswordStrength password={newPassword} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar nueva contraseña
            </label>
            <div className="relative">
              <input
                type={showConfirmPw ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showConfirmPw ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {pwMsg && (
            <p className={`text-sm ${pwMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {pwMsg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={loadingPw}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {loadingPw ? 'Guardando...' : 'Actualizar contraseña'}
          </button>
        </form>
      </section>

      {/* Zona de peligro */}
      <section className="bg-white border border-red-200 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-red-600 mb-1">Zona de peligro</h2>
        <p className="text-sm text-gray-500 mb-4">
          Eliminar la cuenta borra todos tus datos permanentemente.
        </p>
        {!showDelete ? (
          <button
            onClick={() => setShowDelete(true)}
            className="text-sm text-red-500 border border-red-200 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors"
          >
            Eliminar mi cuenta
          </button>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-red-700">
              ¿Seguro? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => supabase.auth.signOut()}
                className="text-sm bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Sí, eliminar cuenta
              </button>
              <button
                onClick={() => setShowDelete(false)}
                className="text-sm border border-gray-200 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>

    </div>
  )
}
