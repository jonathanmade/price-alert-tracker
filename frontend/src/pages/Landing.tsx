import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../api/supabase'

const stores = ['Amazon', 'MediaMarkt', 'El Corte Inglés', 'PcComponentes', 'ASOS', 'Zara', 'Fnac', 'Zalando']

const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
    title: 'Alertas instantáneas',
    description: 'Recibe un email en el momento exacto en que el precio baja a tu objetivo. Sin demoras, sin spam.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Revisión programada',
    description: 'Configura la hora a la que quieres que se compruebe cada producto. Tú mandas el horario.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Historial de precios',
    description: 'Visualiza la evolución del precio con gráficas y decide el mejor momento para comprar.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
      </svg>
    ),
    title: 'Todas tus tiendas',
    description: 'Compatible con Amazon, MediaMarkt, PcComponentes y muchas más. Pega cualquier URL.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    title: 'Privado y seguro',
    description: 'Tus datos son tuyos. No vendemos información ni compartimos tu actividad con terceros.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: 'Comprobación manual',
    description: '¿No puedes esperar? Pulsa "Comprobar ahora" y obtén el precio actualizado al instante.',
  },
]

const steps = [
  { number: '01', title: 'Pega la URL', description: 'Copia el enlace del producto desde cualquier tienda online.' },
  { number: '02', title: 'Fija tu precio', description: 'Dinos cuánto máximo quieres pagar y cuándo revisarlo.' },
  { number: '03', title: 'Recibe el aviso', description: 'Te notificamos por email en cuanto baje el precio. Solo compra cuando salga a cuenta.' },
]

const plans = [
  {
    name: 'Gratis',
    price: '0',
    description: 'Para empezar a ahorrar hoy mismo.',
    features: ['10 créditos de bienvenida', 'Alertas ilimitadas', 'Historial de precios', 'Email de notificación'],
    cta: 'Empezar gratis',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '4,99',
    description: 'Para compradores que buscan el máximo ahorro.',
    features: ['500 créditos / mes', 'Todo lo del plan Gratis', 'Comprobaciones cada hora', 'Soporte prioritario'],
    cta: 'Probar Pro',
    highlight: true,
  },
]

function AlertMock() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setStep(s => (s + 1) % 4), 2000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="relative w-full max-w-sm mx-auto">
      {/* Main card */}
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center gap-2 mb-4">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400" />
          </span>
          <span className="text-xs text-white/60 font-medium">Monitorizando en tiempo real</span>
        </div>

        <p className="text-white/50 text-xs mb-1">Sony WH-1000XM5 — Amazon.es</p>
        <h3 className="text-white font-semibold text-sm mb-3 leading-snug">Sony WH-1000XM5 Auriculares Inalámbricos</h3>

        <div className="flex items-end gap-3 mb-4">
          <div>
            <p className="text-white/40 text-xs mb-0.5">Precio actual</p>
            <p className={`text-2xl font-bold transition-all duration-700 ${step >= 2 ? 'text-green-400' : 'text-white'}`}>
              {step >= 2 ? '€249,00' : '€319,00'}
            </p>
          </div>
          <div>
            <p className="text-white/40 text-xs mb-0.5">Mi objetivo</p>
            <p className="text-lg font-semibold text-indigo-300">€260,00</p>
          </div>
          {step >= 2 && (
            <span className="mb-1 text-xs font-semibold px-2 py-1 rounded-lg bg-green-400/20 text-green-400 animate-pulse">
              −22%
            </span>
          )}
        </div>

        <div className="w-full bg-white/10 rounded-full h-1.5 mb-1">
          <div
            className="bg-indigo-400 h-1.5 rounded-full transition-all duration-1000"
            style={{ width: step === 0 ? '80%' : step === 1 ? '90%' : '100%' }}
          />
        </div>
        <p className="text-white/30 text-xs">Última revisión: hace 2 min</p>
      </div>

      {/* Floating notification */}
      <div className={`absolute -top-4 -right-4 bg-white rounded-xl shadow-xl p-3 w-56 transition-all duration-500 ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
        <div className="flex items-start gap-2.5">
          <span className="text-lg leading-none">🎉</span>
          <div>
            <p className="text-xs font-semibold text-gray-900">¡Precio alcanzado!</p>
            <p className="text-xs text-gray-500 mt-0.5">Sony WH-1000XM5 bajó a <strong className="text-green-600">€249,00</strong></p>
          </div>
        </div>
      </div>

      {/* Floating savings badge */}
      <div className={`absolute -bottom-3 -left-4 bg-green-500 text-white rounded-xl shadow-xl px-3 py-2 transition-all duration-500 ${step >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
        <p className="text-xs font-bold">Ahorras €70,00</p>
      </div>
    </div>
  )
}

export default function Landing() {
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLoggedIn(!!data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setLoggedIn(!!session)
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-indigo-600 font-bold text-xl tracking-tight">PriceAlert</span>
          <nav className="hidden md:flex items-center gap-8 text-sm text-gray-500">
            <a href="#features" className="hover:text-gray-900 transition-colors">Funciones</a>
            <a href="#how" className="hover:text-gray-900 transition-colors">Cómo funciona</a>
            <a href="#pricing" className="hover:text-gray-900 transition-colors">Precios</a>
          </nav>
          <div className="flex items-center gap-3">
            {loggedIn ? (
              <Link to="/dashboard" className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg transition-colors">
                Ir al dashboard →
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors hidden sm:block">
                  Iniciar sesión
                </Link>
                <Link to="/login" className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg transition-colors">
                  Empezar gratis
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative bg-slate-950 pt-32 pb-28 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-indigo-600/20 rounded-full blur-3xl" />
          <div className="absolute top-20 right-0 w-[400px] h-[400px] bg-violet-600/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-indigo-800/20 rounded-full blur-3xl" />
          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        <div className="relative max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Left */}
            <div>
              <span className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                Alertas de precio automáticas
              </span>

              <h1 className="text-5xl lg:text-6xl font-bold text-white leading-[1.1] mb-6">
                Compra cuando{' '}
                <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                  el precio es tuyo
                </span>
              </h1>

              <p className="text-lg text-slate-400 mb-8 leading-relaxed max-w-lg">
                Registra cualquier producto, fija tu precio objetivo y olvídate. Te avisamos por email
                en cuanto el precio baje. Sin refrescar, sin perder el tiempo.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-10">
                <Link
                  to={loggedIn ? '/dashboard' : '/login'}
                  className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3.5 rounded-xl text-sm transition-colors shadow-lg shadow-indigo-500/25"
                >
                  {loggedIn ? 'Ir al dashboard' : 'Empezar gratis'}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
                <a
                  href="#how"
                  className="inline-flex items-center justify-center gap-2 border border-white/10 text-white/70 hover:text-white hover:border-white/20 font-medium px-6 py-3.5 rounded-xl text-sm transition-colors"
                >
                  Ver cómo funciona
                </a>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6 pt-6 border-t border-white/10">
                <div>
                  <p className="text-2xl font-bold text-white">10</p>
                  <p className="text-xs text-slate-500">créditos gratis</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div>
                  <p className="text-2xl font-bold text-white">∞</p>
                  <p className="text-xs text-slate-500">alertas activas</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div>
                  <p className="text-2xl font-bold text-white">0€</p>
                  <p className="text-xs text-slate-500">para empezar</p>
                </div>
              </div>
            </div>

            {/* Right — animated mock */}
            <div className="flex justify-center lg:justify-end">
              <AlertMock />
            </div>
          </div>
        </div>
      </section>

      {/* Stores strip */}
      <section className="bg-slate-900 border-y border-white/5 py-5">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider shrink-0">Compatible con</span>
            {stores.map(store => (
              <span key={store} className="text-sm font-semibold text-slate-400">{store}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-indigo-600 text-sm font-semibold uppercase tracking-wider">Funciones</span>
            <h2 className="text-4xl font-bold text-gray-900 mt-2">
              Todo lo que necesitas para comprar inteligente
            </h2>
            <p className="text-gray-500 mt-4 max-w-xl mx-auto">
              Sin complicaciones. Pega la URL, pon tu precio y nosotros hacemos el resto.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="group p-6 rounded-2xl border border-gray-100 hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-50 transition-all duration-300">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-indigo-600 text-sm font-semibold uppercase tracking-wider">Proceso</span>
            <h2 className="text-4xl font-bold text-gray-900 mt-2">Tres pasos y listo</h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-8 relative">
            {/* Connecting line */}
            <div className="hidden sm:block absolute top-10 left-[calc(16.66%+2rem)] right-[calc(16.66%+2rem)] h-px bg-gradient-to-r from-indigo-200 via-indigo-300 to-indigo-200" />

            {steps.map((step, i) => (
              <div key={i} className="text-center relative">
                <div className="w-20 h-20 rounded-2xl bg-white border-2 border-indigo-100 flex items-center justify-center mx-auto mb-5 shadow-sm">
                  <span className="text-2xl font-bold text-indigo-600">{step.number}</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-indigo-600 text-sm font-semibold uppercase tracking-wider">Precios</span>
            <h2 className="text-4xl font-bold text-gray-900 mt-2">Simple y transparente</h2>
            <p className="text-gray-500 mt-4">Sin sorpresas. Empieza gratis y escala cuando lo necesites.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {plans.map((plan, i) => (
              <div
                key={i}
                className={`rounded-2xl p-8 border-2 relative ${
                  plan.highlight
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xl shadow-indigo-200'
                    : 'bg-white border-gray-100'
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-xs font-bold px-4 py-1 rounded-full shadow">
                    Más popular
                  </span>
                )}
                <p className={`text-sm font-semibold mb-1 ${plan.highlight ? 'text-indigo-200' : 'text-gray-500'}`}>{plan.name}</p>
                <div className="flex items-end gap-1 mb-2">
                  <span className={`text-4xl font-bold ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>€{plan.price}</span>
                  <span className={`text-sm mb-1.5 ${plan.highlight ? 'text-indigo-200' : 'text-gray-400'}`}>/mes</span>
                </div>
                <p className={`text-sm mb-6 ${plan.highlight ? 'text-indigo-200' : 'text-gray-500'}`}>{plan.description}</p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feat, j) => (
                    <li key={j} className="flex items-center gap-2.5 text-sm">
                      <svg className={`w-4 h-4 shrink-0 ${plan.highlight ? 'text-indigo-200' : 'text-indigo-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className={plan.highlight ? 'text-indigo-100' : 'text-gray-600'}>{feat}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to={loggedIn ? '/dashboard' : '/login'}
                  className={`block text-center text-sm font-semibold py-3 rounded-xl transition-colors ${
                    plan.highlight
                      ? 'bg-white text-indigo-600 hover:bg-indigo-50'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gradient-to-br from-indigo-600 to-violet-600 py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Deja de perder ofertas
          </h2>
          <p className="text-indigo-200 text-lg mb-10 max-w-xl mx-auto">
            Cada día miles de productos bajan de precio. Sin PriceAlert, te los pierdes.
            Con PriceAlert, compras cuando vale la pena.
          </p>
          <Link
            to={loggedIn ? '/dashboard' : '/login'}
            className="inline-flex items-center gap-2 bg-white text-indigo-600 hover:bg-indigo-50 font-bold px-8 py-4 rounded-xl text-sm transition-colors shadow-xl shadow-indigo-900/20"
          >
            {loggedIn ? 'Ir al dashboard' : 'Crear mi cuenta gratis'}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
          <p className="text-indigo-300 text-xs mt-4">Sin tarjeta de crédito. 10 créditos gratis al registrarte.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-indigo-400 font-bold text-lg">PriceAlert</span>
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} PriceAlert. Hecho con ☕ en España.</p>
          <div className="flex gap-5 text-xs text-slate-500">
            <a href="#" className="hover:text-slate-300 transition-colors">Privacidad</a>
            <a href="#" className="hover:text-slate-300 transition-colors">Términos</a>
            <a href="mailto:hola@pricealert.es" className="hover:text-slate-300 transition-colors">Contacto</a>
          </div>
        </div>
      </footer>

    </div>
  )
}
