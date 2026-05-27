import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-slate-950 px-4 py-3 flex items-center gap-3 border-b border-white/5">
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-slate-400 hover:text-white transition-colors p-0.5"
          aria-label="Abrir menú"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-indigo-400 font-bold text-base tracking-tight">PriceRadar</span>
      </div>

      {/* Backdrop (mobile) */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto mt-12 md:mt-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
