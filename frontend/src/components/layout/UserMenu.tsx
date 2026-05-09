import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../api/supabase'
import { useCredits } from '../../hooks/useCredits'

const menuItems = [
  { label: 'Mi cuenta', to: '/settings/account', icon: '👤' },
  { label: 'Perfil',    to: '/settings/profile',  icon: '✏️' },
  { label: 'Billing',   to: '/settings/billing',  icon: '💳' },
]

export default function UserMenu() {
  const [open, setOpen]   = useState(false)
  const [email, setEmail] = useState('')
  const { credits }       = useCredits()
  const ref               = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''))
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const initials = email ? email[0].toUpperCase() : '?'
  const lowCredits = credits !== null && credits <= 3

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors"
      >
        {/* Avatar */}
        <span className="w-8 h-8 rounded-full bg-indigo-600 text-white text-sm font-semibold flex items-center justify-center shrink-0">
          {initials}
        </span>

        {/* Créditos */}
        {credits !== null && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            lowCredits
              ? 'bg-red-50 text-red-600'
              : 'bg-indigo-50 text-indigo-600'
          }`}>
            {credits} créditos
          </span>
        )}

        {/* Email */}
        <span className="text-sm text-gray-700 max-w-[160px] truncate hidden sm:block">
          {email}
        </span>

        {/* Chevron */}
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs text-gray-400">Conectado como</p>
            <p className="text-sm font-medium text-gray-900 truncate">{email}</p>
          </div>

          {/* Créditos banner */}
          <div className={`px-4 py-2.5 border-b ${lowCredits ? 'bg-red-50 border-red-100' : 'bg-indigo-50 border-indigo-100'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium ${lowCredits ? 'text-red-700' : 'text-indigo-700'}`}>
                {lowCredits ? '⚠️ Pocos créditos' : '⚡ Créditos'}
              </span>
              <span className={`text-sm font-bold ${lowCredits ? 'text-red-700' : 'text-indigo-700'}`}>
                {credits ?? '—'}
              </span>
            </div>
            <Link
              to="/settings/billing"
              onClick={() => setOpen(false)}
              className={`text-xs underline mt-0.5 block ${lowCredits ? 'text-red-600' : 'text-indigo-600'}`}
            >
              {lowCredits ? 'Comprar más →' : 'Ver planes →'}
            </Link>
          </div>

          {/* Items */}
          <div className="py-1">
            {menuItems.map(item => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>

          {/* Logout */}
          <div className="border-t border-gray-100 py-1">
            <button
              onClick={() => supabase.auth.signOut()}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
            >
              <span>🚪</span> Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
