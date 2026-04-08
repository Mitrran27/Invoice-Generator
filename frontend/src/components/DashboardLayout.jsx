import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/stores'
import {
  LayoutDashboard, FilePlus, Clock, Settings, LogOut, FileText, Menu, Receipt,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import NotificationBell from '@/components/NotificationBell'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/dashboard/create', icon: FilePlus, label: 'Create Invoice' },
  { to: '/dashboard/history', icon: Clock, label: 'History' },
  { to: '/dashboard/receipts', icon: Receipt, label: 'Receipts' },
  { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
]

export default function DashboardLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/login') }

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-gray-800">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500">
          <FileText className="h-4 w-4 text-white" />
        </div>
        <span className="font-semibold text-white text-sm">Invoice Generator</span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink key={to} to={to} end={end} onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            )}>
            <Icon className="h-4 w-4" />{label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-gray-800 px-3 py-4 space-y-1">
        <div className="px-3 py-2">
          <p className="text-xs text-gray-400">Signed in as</p>
          <p className="text-sm font-medium text-white truncate">{user?.email}</p>
        </div>
        <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
          <LogOut className="h-4 w-4" />Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="hidden lg:flex w-56 flex-shrink-0 flex-col bg-gray-900">
        <SidebarContent />
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-56 bg-gray-900">
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex items-center justify-between border-b bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden rounded-md p-1.5 text-gray-500 hover:bg-gray-100">
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 lg:hidden">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-500">
                <FileText className="h-3 w-3 text-white" />
              </div>
              <span className="font-semibold text-sm">Invoice Generator</span>
            </div>
          </div>
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
