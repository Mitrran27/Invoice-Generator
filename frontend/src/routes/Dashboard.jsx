import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useInvoiceStore, useSettingsStore, useAuthStore } from '@/lib/stores'
import { FileText, CheckCircle, Clock, AlertTriangle, Plus, ArrowRight } from 'lucide-react'
import { formatCurrency, calculateTotal, formatDate } from '@/lib/utils'

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <div className={`h-9 w-9 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="h-4.5 w-4.5 text-white h-5 w-5" />
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

function StatusBadge({ status }) {
  const styles = {
    paid: 'bg-green-100 text-green-700',
    unpaid: 'bg-gray-100 text-gray-600',
    overdue: 'bg-red-100 text-red-600',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${styles[status] || styles.unpaid}`}>
      {status}
    </span>
  )
}

export default function Dashboard() {
  const { invoices, fetchInvoices } = useInvoiceStore()
  const { settings, fetchSettings } = useSettingsStore()
  const { user } = useAuthStore()

  useEffect(() => {
    fetchInvoices()
    fetchSettings()
  }, [])

  const paid = invoices.filter((i) => i.status === 'paid')
  const unpaid = invoices.filter((i) => i.status === 'unpaid')
  const overdue = invoices.filter((i) => i.status === 'overdue')

  const totalRevenue = paid.reduce(
    (sum, inv) => sum + calculateTotal(inv.items, inv.tax_percentage),
    0
  )

  const recent = [...invoices]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5)

  const currency = settings?.default_currency || 'USD'

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Here's your invoicing overview</p>
        </div>
        <Link
          to="/dashboard/create"
          className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Invoice
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Total Invoices" value={invoices.length} color="bg-blue-500" />
        <StatCard icon={CheckCircle} label="Paid" value={paid.length} color="bg-green-500" />
        <StatCard icon={Clock} label="Unpaid" value={unpaid.length} color="bg-yellow-500" />
        <StatCard icon={AlertTriangle} label="Overdue" value={overdue.length} color="bg-red-500" />
      </div>

      {/* Revenue */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-6 text-white">
        <p className="text-gray-400 text-sm mb-1">Total Revenue (Paid)</p>
        <p className="text-4xl font-bold">{formatCurrency(totalRevenue, currency)}</p>
        <p className="text-gray-400 text-sm mt-2">From {paid.length} paid invoice{paid.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Recent invoices */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <h2 className="font-semibold text-gray-900">Recent Invoices</h2>
          <Link to="/dashboard/history" className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-10 w-10 text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">No invoices yet</p>
            <Link to="/dashboard/create" className="mt-3 text-sm text-blue-600 hover:underline">
              Create your first invoice
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recent.map((inv) => (
              <div key={inv.id} className="flex items-center px-5 py-3.5 hover:bg-gray-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{inv.invoice_number}</p>
                  <p className="text-xs text-gray-400 truncate">{inv.client_name} · {formatDate(inv.issue_date)}</p>
                </div>
                <div className="text-right ml-4">
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(calculateTotal(inv.items, inv.tax_percentage), currency)}
                  </p>
                  <StatusBadge status={inv.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
