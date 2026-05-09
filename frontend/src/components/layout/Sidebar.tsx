import { NavLink } from 'react-router-dom'

const links = [
  { to: '/dashboard', label: 'Alertas',   icon: '🔔' },
  { to: '/history',   label: 'Historial', icon: '📜' },
  { to: '/settings',  label: 'Ajustes',   icon: '⚙️' },
]

export default function Sidebar() {
  return (
    <aside className="w-56 min-h-screen bg-white border-r border-gray-200 flex flex-col shrink-0">
      <div className="px-6 py-5 border-b border-gray-200">
        <span className="text-indigo-600 font-bold text-lg tracking-tight">PriceAlert</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`
            }
          >
            <span>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
