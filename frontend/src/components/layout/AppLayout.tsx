import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import UserMenu from './UserMenu'

export default function AppLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-end px-6 shrink-0">
          <UserMenu />
        </header>
        {/* Content */}
        <main className="flex-1 p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
