import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../api/supabase'
import PasswordStrength, { validatePassword } from '../components/ui/PasswordStrength'

/* ---- Icons ---- */
const EyeIcon = ({ open }: { open: boolean }) => open ? (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
) : (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
)

/* ---- Password input with show/hide ---- */
function PasswordInput({ value, onChange, label, placeholder = '••••••••' }: {
  value: string; onChange: (v: string) => void; label: string; placeholder?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-300">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          required
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          tabIndex={-1}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <EyeIcon open={show} />
        </button>
      </div>
    </div>
  )
}

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState(false)
  const [loading, setLoading]       = useState(false)
  const [validToken, setValidToken] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setValidToken(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }
    if (!validatePassword(password)) { setError('La contraseña no cumple los requisitos mínimos.'); return }
    setError(''); setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess(true)
      setTimeout(() => navigate('/dashboard'), 2500)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#020817] flex">

      {/* ---- LEFT PANEL ---- */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 bg-[#0a1628] border-r border-slate-800 p-12">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="3.5" stroke="white" strokeWidth="1.6"/>
              <circle cx="10" cy="10" r="7" stroke="white" strokeWidth="1" strokeDasharray="2.5 2.5"/>
              <path d="M10 2v2.5M10 15.5V18M2 10h2.5M15.5 10H18" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="text-white font-bold text-lg" style={{fontFamily:'Sora,sans-serif'}}>Price-A-Radar</span>
        </Link>

        <div>
          <h2 className="text-3xl font-bold text-white leading-tight mb-4" style={{fontFamily:'Sora,sans-serif'}}>
            Recupera el<br/>
            <span className="text-indigo-400">acceso a tu cuenta.</span>
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Elige una contraseña segura para proteger tus alertas y tu historial de precios.
          </p>
        </div>

        <p className="text-slate-600 text-xs">© {new Date().getFullYear()} Price-A-Radar · Hecho con ☕ en España</p>
      </div>

      {/* ---- RIGHT PANEL ---- */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <Link to="/" className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="3.5" stroke="white" strokeWidth="1.6"/>
                <circle cx="10" cy="10" r="7" stroke="white" strokeWidth="1" strokeDasharray="2.5 2.5"/>
              </svg>
            </div>
            <span className="text-white font-bold" style={{fontFamily:'Sora,sans-serif'}}>Price-A-Radar</span>
          </Link>

          {/* ---- Invalid / expired token ---- */}
          {!validToken && (
            <>
              <h1 className="text-2xl font-bold text-white mb-2" style={{fontFamily:'Sora,sans-serif'}}>
                Enlace no válido
              </h1>
              <p className="text-slate-400 text-sm mb-8">
                Este enlace de recuperación no es válido o ha expirado. Solicita uno nuevo desde la pantalla de inicio de sesión.
              </p>
              <Link
                to="/login"
                className="inline-block w-full text-center bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
                style={{fontFamily:'Sora,sans-serif'}}
              >
                Volver al inicio de sesión
              </Link>
            </>
          )}

          {/* ---- Success state ---- */}
          {validToken && success && (
            <>
              <h1 className="text-2xl font-bold text-white mb-2" style={{fontFamily:'Sora,sans-serif'}}>
                ¡Contraseña actualizada!
              </h1>
              <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                Tu contraseña ha sido actualizada correctamente. Redirigiendo al panel...
              </p>
            </>
          )}

          {/* ---- Form ---- */}
          {validToken && !success && (
            <>
              <h1 className="text-2xl font-bold text-white mb-1" style={{fontFamily:'Sora,sans-serif'}}>
                Nueva contraseña
              </h1>
              <p className="text-slate-400 text-sm mb-8">
                Elige una contraseña segura con al menos 8 caracteres.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <PasswordInput label="Nueva contraseña" value={password} onChange={setPassword} />
                <PasswordStrength password={password} />
                <PasswordInput label="Confirmar contraseña" value={confirm} onChange={setConfirm} />

                {error && (
                  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                  style={{fontFamily:'Sora,sans-serif'}}
                >
                  {loading
                    ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Actualizando...</span>
                    : 'Actualizar contraseña'}
                </button>
              </form>
            </>
          )}

        </div>
      </div>

    </div>
  )
}
