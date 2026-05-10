import { NavLink, Outlet, Navigate } from 'react-router-dom'

const tabs = [
  { to: '/settings/account', label: 'Cuenta' },
  { to: '/settings/profile', label: 'Perfil' },
  { to: '/settings/billing', label: 'Billing' },
]

export default function Settings() {
  return (
    <>
      {/* Page header */}
      <div className="bg-white border-b border-gray-100 px-8 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Ajustes</h1>
        <p className="text-xs text-gray-400 mt-0.5">Gestiona tu cuenta y preferencias</p>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-8">
        <div className="flex gap-1">
          {tabs.map(tab => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
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
      </div>

      {/* Tab content */}
      <div className="px-8 py-8">
        <Outlet />
      </div>
    </>
  )
}

export function SettingsRedirect() {
  return <Navigate to="/settings/account" replace />
}
