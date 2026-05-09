import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../api/supabase'

const stores = ['Amazon', 'MediaMarkt', 'El Corte Inglés', 'Zara', 'ASOS', 'PcComponentes']

const steps = [
  {
    number: '01',
    title: 'Pega la URL del producto',
    description: 'Copia el enlace de cualquier producto de tus tiendas favoritas.',
  },
  {
    number: '02',
    title: 'Pon tu precio objetivo',
    description: 'Dinos cuánto estás dispuesto a pagar y nosotros hacemos el resto.',
  },
  {
    number: '03',
    title: 'Recibe el aviso',
    description: 'Te notificamos por email en cuanto el precio baje a tu objetivo.',
  },
]

export default function Landing() {
  const [url, setUrl] = useState('')
  const [price, setPrice] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLoggedIn(!!data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setLoggedIn(!!session)
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <div className="min-h-screen bg-white">

      {/* Nav */}
      <header className="border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-indigo-600 font-bold text-xl tracking-tight">PriceAlert</span>
          <div className="flex items-center gap-3">
            {loggedIn ? (
              <Link
                to="/dashboard"
                className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Ir al dashboard →
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
                >
                  Iniciar sesión
                </Link>
                <Link
                  to="/login"
                  className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  Empezar gratis
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <span className="inline-block bg-indigo-50 text-indigo-600 text-xs font-semibold px-3 py-1 rounded-full mb-6 tracking-wide uppercase">
          Alertas de precio automáticas
        </span>
        <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-5">
          Compra cuando el precio<br />
          <span className="text-indigo-600">sea el que tú decides</span>
        </h1>
        <p className="text-lg text-gray-500 mb-10 max-w-xl mx-auto">
          Registra cualquier producto, pon tu precio objetivo y te avisamos por email
          en cuanto baje. Sin recargar la página, sin perder el tiempo.
        </p>

        {/* CTA form */}
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 max-w-2xl mx-auto">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://amazon.es/dp/..."
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
              <input
                type="number"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="Precio objetivo"
                className="w-full sm:w-40 border border-gray-300 rounded-lg pl-7 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>
            <Link
              to={loggedIn ? '/dashboard' : '/login'}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors whitespace-nowrap"
            >
              {loggedIn ? 'Ir al dashboard →' : 'Crear alerta →'}
            </Link>
          </div>
          <p className="text-xs text-gray-400 mt-3">Gratis para siempre hasta 5 alertas activas.</p>
        </div>

        {/* Stores */}
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {stores.map(store => (
            <span
              key={store}
              className="bg-gray-100 text-gray-500 text-xs font-medium px-3 py-1.5 rounded-full"
            >
              {store}
            </span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 border-y border-gray-100 py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Tres pasos y listo
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {steps.map(step => (
              <div key={step.number} className="bg-white rounded-2xl border border-gray-200 p-6">
                <span className="text-3xl font-bold text-indigo-100">{step.number}</span>
                <h3 className="text-base font-semibold text-gray-900 mt-3 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-5xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          ¿A qué esperas?
        </h2>
        <p className="text-gray-500 mb-8">
          Empieza gratis. Sin tarjeta de crédito.
        </p>
        <Link
          to={loggedIn ? '/dashboard' : '/login'}
          className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-3 rounded-xl text-sm transition-colors"
        >
          {loggedIn ? 'Ir al dashboard →' : 'Crear mi cuenta gratis →'}
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} PriceAlert. Hecho con ☕ en España.
      </footer>

    </div>
  )
}
