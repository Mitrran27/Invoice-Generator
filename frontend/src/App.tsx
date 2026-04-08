import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/stores'
import DashboardLayout from '@/components/DashboardLayout'
import Login from '@/routes/Login'
import Dashboard from '@/routes/Dashboard'
import CreateInvoice from '@/routes/CreateInvoice'
import EditInvoice from '@/routes/EditInvoice'
import History from '@/routes/History'
import ViewInvoice from '@/routes/ViewInvoice'
import Settings from '@/routes/Settings'
import Receipts from '@/routes/Receipts'
import PaymentReceipt from '@/routes/PaymentReceipt'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s: any) => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s: any) => s.token)
  return !token ? <>{children}</> : <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

      {/* Public payment receipt upload page — no auth required */}
      <Route path="/pay/:token" element={<PaymentReceipt />} />

      <Route path="/dashboard" element={<PrivateRoute><DashboardLayout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="create" element={<CreateInvoice />} />
        <Route path="edit/:id" element={<EditInvoice />} />
        <Route path="history" element={<History />} />
        <Route path="view/:id" element={<ViewInvoice />} />
        <Route path="settings" element={<Settings />} />
        <Route path="receipts" element={<Receipts />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
