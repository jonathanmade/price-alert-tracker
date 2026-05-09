import { NavLink, Outlet, Navigate } from 'react-router-dom'

const tabs = [
  { to: '/settings/account', label: 'Cuenta' },
  { to: '/settings/profile', label: 'Perfil' },
  { to: '/settings/billing', label: 'Billing' },
]

export default function Settings() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Ajustes</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-8">
        {tabs.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                isActive
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  )
}

export function SettingsRedirect() {
  return <Navigate to="/settings/account" replace />
}
