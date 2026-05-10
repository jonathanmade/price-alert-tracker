import { useEffect, useState } from 'react'
import { supabase } from '../../api/supabase'
import type { PriceHistory } from '../../api/types'

interface Transaction {
  id: string
  amount: number
  reason: string
  created_at: string
}

const plans = [
  {
    name: 'Gratis',
    price: '0 €',
    credits: 10,
    features: ['10 créditos de inicio', 'Hasta 3 alertas activas', 'Comprobación horaria'],
    current: true,
    cta: 'Plan actual',
  },
  {
    name: 'Pro',
    price: '4,99 € / mes',
    credits: 200,
    features: ['200 créditos / mes', 'Alertas ilimitadas', 'Comprobación cada 15 min', 'Soporte prioritario'],
    current: false,
    cta: 'Próximamente',
  },
  {
    name: 'Business',
    price: '14,99 € / mes',
    credits: 1000,
    features: ['1.000 créditos / mes', 'Todo lo de Pro', 'API de acceso', 'Informes exportables'],
    current: false,
    cta: 'Próximamente',
  },
]

const reasonLabels: Record<string, string> = {
  price_check:   'Comprobación de precio',
  purchase:      'Compra de créditos',
  signup_bonus:  'Bono de bienvenida',
}

export default function Billing() {
  const [credits, setCredits]           = useState<number | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [profileRes, txRes] = await Promise.all([
        supabase.from('profiles').select('credits').eq('id', user.id).single(),
        supabase.from('credit_transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
      ])

      setCredits(profileRes.data?.credits ?? 0)
      setTransactions((txRes.data as Transaction[]) ?? [])
    }
    load()
  }, [])

  return (
    <div className="max-w-2xl space-y-8">

      {/* Créditos actuales */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Créditos disponibles</h2>
        <div className="flex items-end gap-3">
          <span className="text-5xl font-bold text-indigo-600">
            {credits ?? '—'}
          </span>
          <span className="text-gray-400 text-sm mb-2">créditos restantes</span>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Cada comprobación de precio consume 1 crédito.
        </p>
        {credits !== null && credits <= 3 && (
          <div className="mt-4 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700 font-medium">
            ⚠️ Te quedan pocos créditos. Actualiza tu plan para no perder alertas.
          </div>
        )}
      </section>

      {/* Planes */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Planes</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {plans.map(plan => (
            <div
              key={plan.name}
              className={`bg-white rounded-2xl border p-5 flex flex-col ${
                plan.name === 'Pro'
                  ? 'border-indigo-400 ring-1 ring-indigo-200'
                  : 'border-gray-200'
              }`}
            >
              {plan.name === 'Pro' && (
                <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full self-start mb-3">
                  Recomendado
                </span>
              )}
              <h3 className="font-bold text-gray-900">{plan.name}</h3>
              <p className="text-2xl font-bold text-gray-900 mt-1 mb-4">{plan.price}</p>
              <ul className="space-y-2 flex-1 mb-6">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-indigo-400 mt-0.5">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                disabled={plan.current || plan.cta === 'Próximamente'}
                className={`w-full text-sm font-medium py-2 rounded-lg transition-colors ${
                  plan.current
                    ? 'bg-gray-100 text-gray-400 cursor-default'
                    : plan.cta === 'Próximamente'
                    ? 'bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Historial de transacciones */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Historial de créditos</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-gray-400">Sin transacciones todavía.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {transactions.map(tx => (
              <div key={tx.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm text-gray-700">
                    {reasonLabels[tx.reason] ?? tx.reason}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(tx.created_at).toLocaleDateString('es-ES', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                <span className={`text-sm font-semibold ${
                  tx.amount > 0 ? 'text-green-600' : 'text-red-500'
                }`}>
                  {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  )
}
