import { useState } from 'react'
import { Link } from 'react-router-dom'
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

/* ---- Perks shown on the left panel ---- */
const PERKS = [
  { icon: '🔔', text: 'Alertas en menos de 60 segundos' },
  { icon: '🏪', text: '+127 tiendas monitorizadas' },
  { icon: '📉', text: 'Historial de precios incluido' },
  { icon: '🎁', text: '10 créditos gratis al registrarte' },
]

/* ---- Main component ---- */
export default function Login() {
  const [email, setEmail]                   = useState('')
  const [password, setPassword]             = useState('')
  const [confirm, setConfirm]               = useState('')
  const [isRegister, setIsRegister]         = useState(false)
  const [isForgot, setIsForgot]             = useState(false)
  const [acceptedTerms, setAcceptedTerms]   = useState(false)
  const [error, setError]                   = useState('')
  const [success, setSuccess]               = useState('')
  const [loading, setLoading]               = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSuccess('')

    if (isRegister && password !== confirm) { setError('Las contraseñas no coinciden.'); return }
    if (isRegister && !validatePassword(password)) { setError('La contraseña no cumple los requisitos mínimos.'); return }
    if (isRegister && !acceptedTerms)       { setError('Debes aceptar los términos y condiciones.'); return }

    setLoading(true)
    const { error } = isRegister
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
    } else if (isRegister) {
      setSuccess('¡Cuenta creada! Revisa tu email para confirmarla.')
    }
    setLoading(false)
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSuccess(''); setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://app.pricearadar.com/reset-password',
    })
    if (error) {
      setError(error.message)
    } else {
      setSuccess('Revisa tu email. Si la cuenta existe, recibirás un enlace en unos minutos.')
    }
    setLoading(false)
  }

  const switchMode = () => {
    setIsRegister(r => !r)
    setError(''); setSuccess(''); setConfirm(''); setAcceptedTerms(false)
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
            Compra cuando<br/>
            <span className="text-indigo-400">el precio es tuyo.</span>
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-10">
            Monitoriza cualquier producto, fija tu precio objetivo y olvídate. Te avisamos en el instante que baje.
          </p>
          <div className="space-y-4">
            {PERKS.map(p => (
              <div key={p.text} className="flex items-center gap-3">
                <span className="text-lg">{p.icon}</span>
                <span className="text-slate-300 text-sm">{p.text}</span>
              </div>
            ))}
          </div>
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

          {isForgot ? (
            <>
              <h1 className="text-2xl font-bold text-white mb-1" style={{fontFamily:'Sora,sans-serif'}}>
                Recuperar contraseña
              </h1>
              <p className="text-slate-400 text-sm mb-8">
                <button
                  type="button"
                  onClick={() => { setIsForgot(false); setError(''); setSuccess('') }}
                  className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  Volver al login
                </button>
              </p>

              {success ? (
                <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">{success}</p>
              ) : (
                <form onSubmit={handleForgot} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-300">Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="tu@email.com"
                      className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                    />
                  </div>

                  {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                    style={{fontFamily:'Sora,sans-serif'}}
                  >
                    {loading
                      ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Cargando...</span>
                      : 'Enviar enlace de recuperación'}
                  </button>
                </form>
              )}
            </>
          ) : (
            <>
          <h1 className="text-2xl font-bold text-white mb-1" style={{fontFamily:'Sora,sans-serif'}}>
            {isRegister ? 'Crear cuenta' : 'Bienvenido de nuevo'}
          </h1>
          <p className="text-slate-400 text-sm mb-8">
            {isRegister ? '¿Ya tienes cuenta? ' : '¿No tienes cuenta? '}
            <button onClick={switchMode} className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
              {isRegister ? 'Inicia sesión' : 'Regístrate gratis'}
            </button>
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-300">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>

            <PasswordInput label="Contraseña" value={password} onChange={setPassword} />
            {isRegister && <PasswordStrength password={password} />}

            {!isRegister && (
              <div className="text-right -mt-1">
                <button
                  type="button"
                  onClick={() => { setIsForgot(true); setError(''); setSuccess('') }}
                  className="text-xs text-slate-500 hover:text-indigo-400 transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}

            {isRegister && (
              <PasswordInput label="Confirmar contraseña" value={confirm} onChange={setConfirm} />
            )}

            {/* Terms checkbox */}
            {isRegister && (
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative mt-0.5 shrink-0">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={e => setAcceptedTerms(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${acceptedTerms ? 'bg-indigo-600 border-indigo-600' : 'border-slate-600 group-hover:border-slate-500'}`}>
                    {acceptedTerms && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-sm text-slate-400 leading-snug">
                  He leído y acepto los{' '}
                  <Link to="/terminos" target="_blank" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                    Términos y Condiciones
                  </Link>
                </span>
              </label>
            )}

            {/* Error / success */}
            {error   && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
            {success && <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">{success}</p>}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              style={{fontFamily:'Sora,sans-serif'}}
            >
              {loading
                ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Cargando...</span>
                : isRegister ? 'Crear cuenta gratis' : 'Entrar'}
            </button>

          </form>
            </>
          )}
        </div>
      </div>

    </div>
  )
}
