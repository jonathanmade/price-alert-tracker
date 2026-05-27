import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { supabase } from '../../api/supabase'
import { useCredits } from '../../hooks/useCredits'

const navSections = [
  {
    group: 'General',
    links: [
      {
        to: '/dashboard',
        label: 'Alertas',
        icon: (
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        ),
      },
      {
        to: '/history',
        label: 'Historial',
        icon: (
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        to: '/analytics',
        label: 'Estadísticas',
        icon: (
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
      },
    ],
  },
  {
    group: 'Cuenta',
    links: [
      {
        to: '/settings',
        label: 'Ajustes',
        icon: (
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
    ],
  },
]

interface SidebarProps {
  open?: boolean
  onClose?: () => void
}

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const [email, setEmail] = useState('')
  const { credits } = useCredits()
  const lowCredits = credits !== null && credits <= 3

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''))
  }, [])

  const initials = email ? email[0].toUpperCase() : '?'

  return (
    <aside className={`
      fixed inset-y-0 left-0 z-50 w-64 bg-slate-950 flex flex-col shrink-0
      transform transition-transform duration-200 ease-in-out
      ${open ? 'translate-x-0' : '-translate-x-full'}
      md:relative md:inset-auto md:translate-x-0 md:transition-none
    `}>

      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
        <span className="text-indigo-400 font-bold text-lg tracking-tight">PriceRadar</span>
        <button
          onClick={onClose}
          className="md:hidden text-slate-400 hover:text-white transition-colors"
          aria-label="Cerrar menú"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navSections.map(({ group, links }, sectionIdx) => (
          <div key={group}>
            <p className={`text-xs font-semibold text-slate-600 uppercase tracking-wider px-3 mb-2 ${sectionIdx > 0 ? 'mt-5' : ''}`}>
              {group}
            </p>
            {links.map(({ to, label, icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                    isActive
                      ? 'text-white bg-indigo-600/20 border-indigo-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
                  }`
                }
              >
                {icon}
                {label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User info */}
      <div className="px-4 py-4 border-t border-white/5">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-8 h-8 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-white truncate">{email}</p>
            <p className={`text-xs font-semibold ${lowCredits ? 'text-red-400' : 'text-slate-500'}`}>
              {credits !== null ? `${credits} créditos` : '—'}
            </p>
          </div>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="flex items-center gap-2 text-xs text-slate-500 hover:text-red-400 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Cerrar sesión
        </button>
      </div>

    </aside>
  )
}
