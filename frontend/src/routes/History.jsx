import { useEffect, useRef, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useInvoiceStore, useSettingsStore } from '@/lib/stores'
import InvoicePreview from '@/components/InvoicePreview'
import { formatCurrency, calculateTotal, formatDate } from '@/lib/utils'
import {
  Eye, Download, Printer, Copy, Trash2, MoreVertical,
  Plus, FileText, Pencil, Loader2, X, Search, ChevronUp, ChevronDown, Image as ImageIcon, Mail,
} from 'lucide-react'
import toast from 'react-hot-toast'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

const A4_W = 794
const A4_H = 1123

const ALL_STATUSES = [
  { value: 'unpaid',     label: 'Unpaid',      bg: 'bg-red-100',     text: 'text-red-700' },
  { value: 'paid',       label: 'Paid',        bg: 'bg-green-100',   text: 'text-green-700' },
  { value: 'pending',    label: 'Pending',     bg: 'bg-yellow-100',  text: 'text-yellow-700' },
  { value: 'partial',    label: 'Partial',     bg: 'bg-orange-100',  text: 'text-orange-700' },
  { value: 'processing', label: 'Processing',  bg: 'bg-blue-100',    text: 'text-blue-700' },
  { value: 'failed',     label: 'Failed',      bg: 'bg-red-200',     text: 'text-red-900' },
  { value: 'cancelled',  label: 'Cancelled',   bg: 'bg-gray-100',    text: 'text-gray-600' },
  { value: 'refunded',   label: 'Refunded',    bg: 'bg-purple-100',  text: 'text-purple-700' },
  { value: 'expired',    label: 'Expired',     bg: 'bg-pink-100',    text: 'text-pink-700' },
  { value: 'overdue',    label: 'Overdue',     bg: 'bg-red-100',     text: 'text-red-800' },
]

const STATUS_MAP = Object.fromEntries(ALL_STATUSES.map(s => [s.value, s]))

function StatusBadge({ status, partialPercentage }) {
  const s = STATUS_MAP[status] || STATUS_MAP['unpaid']
  const label = status === 'partial' && partialPercentage
    ? `Partial (${partialPercentage}%)`
    : s.label
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      {label}
    </span>
  )
}

function StatusDropdown({ invoice, onUpdate }) {
  const [open, setOpen] = useState(false)
  const [partial, setPartial] = useState(invoice.partial_percentage || 50)
  const current = STATUS_MAP[invoice.status] || STATUS_MAP['unpaid']

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold transition-colors ${current.bg} ${current.text} hover:opacity-80`}
      >
        {invoice.status === 'partial' && invoice.partial_percentage
          ? `Partial (${invoice.partial_percentage}%)`
          : current.label}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-8 z-30 w-52 rounded-xl border border-gray-100 bg-white shadow-xl py-1 text-xs overflow-hidden">
            {ALL_STATUSES.map(s => (
              <div key={s.value}>
                <button
                  onClick={() => {
                    if (s.value !== 'partial') {
                      onUpdate(invoice.id, s.value, null)
                      setOpen(false)
                    }
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 hover:bg-gray-50 ${invoice.status === s.value ? 'font-bold' : ''}`}
                >
                  <span className={`w-2 h-2 rounded-full ${s.bg} border ${s.text}`} />
                  {s.label}
                  {invoice.status === s.value && <span className="ml-auto text-gray-400">✓</span>}
                </button>
                {s.value === 'partial' && (
                  <div className="px-3 pb-2 flex items-center gap-2">
                    <input
                      type="number" min="1" max="99"
                      value={partial}
                      onChange={e => setPartial(e.target.value)}
                      className="w-16 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
                      onClick={e => e.stopPropagation()}
                    />
                    <span className="text-gray-400">%</span>
                    <button
                      onClick={() => { onUpdate(invoice.id, 'partial', partial); setOpen(false) }}
                      className="text-xs bg-orange-500 text-white px-2 py-1 rounded hover:bg-orange-600"
                    >Set</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function DropMenu({ invoice, onDelete, onDuplicate, onDownloadPDF, onDownloadImage, onPrint, onSendEmail }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 w-48 rounded-xl border border-gray-100 bg-white shadow-lg py-1 text-sm">
            <button onClick={() => { navigate(`/dashboard/edit/${invoice.id}`); setOpen(false) }} className="flex w-full items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-gray-700">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button onClick={() => { onDownloadPDF(); setOpen(false) }} className="flex w-full items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-gray-700">
              <Download className="h-3.5 w-3.5" /> Download PDF
            </button>
            <button onClick={() => { onDownloadImage(); setOpen(false) }} className="flex w-full items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-gray-700">
              <ImageIcon className="h-3.5 w-3.5" /> Download Image
            </button>
            <button onClick={() => { onPrint(); setOpen(false) }} className="flex w-full items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-gray-700">
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
            <button onClick={() => { onDuplicate(); setOpen(false) }} className="flex w-full items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-gray-700">
              <Copy className="h-3.5 w-3.5" /> Duplicate
            </button>
            {invoice.client_email && (
              <button onClick={() => { onSendEmail(); setOpen(false) }} className="flex w-full items-center gap-2.5 px-3 py-2 hover:bg-blue-50 text-blue-600">
                <Mail className="h-3.5 w-3.5" /> Send to Client
              </button>
            )}
            <div className="border-t border-gray-100 my-1" />
            <button onClick={() => { onDelete(); setOpen(false) }} className="flex w-full items-center gap-2.5 px-3 py-2 hover:bg-red-50 text-red-500">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// Sort indicator component
function SortIcon({ field, sortField, sortDir }) {
  if (sortField !== field) return <ChevronUp className="h-3 w-3 text-gray-300" />
  return sortDir === 'asc'
    ? <ChevronUp className="h-3 w-3 text-blue-500" />
    : <ChevronDown className="h-3 w-3 text-blue-500" />
}

export default function History() {
  const { invoices, fetchInvoices, updateStatus, duplicateInvoice, deleteInvoice, isLoading, sendInvoiceEmail: sendInvoiceEmailFn } = useInvoiceStore()
  const { settings, fetchSettings } = useSettingsStore()
  const [viewModal, setViewModal] = useState(null)   // invoice shown in preview modal
  const [captureTarget, setCaptureTarget] = useState(null) // invoice being captured off-screen
  const [confirm, setConfirm] = useState(null)
  const printRef = useRef(null)

  // Search & sort state
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortField, setSortField] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => { fetchInvoices(); fetchSettings() }, [])

  const currency = settings?.default_currency || 'USD'

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  // Filtered + sorted invoices
  const displayed = useMemo(() => {
    let list = [...invoices]

    // Search: invoice number, client name
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(inv =>
        inv.invoice_number.toLowerCase().includes(q) ||
        inv.client_name.toLowerCase().includes(q) ||
        (inv.client_email || '').toLowerCase().includes(q)
      )
    }

    // Status filter
    if (statusFilter !== 'all') list = list.filter(inv => inv.status === statusFilter)

    // Sort
    list.sort((a, b) => {
      let va, vb
      if (sortField === 'amount') {
        va = calculateTotal(a.items, a.tax_percentage)
        vb = calculateTotal(b.items, b.tax_percentage)
      } else if (sortField === 'issue_date' || sortField === 'due_date' || sortField === 'created_at') {
        va = new Date(a[sortField]).getTime()
        vb = new Date(b[sortField]).getTime()
      } else if (sortField === 'status') {
        va = a.status; vb = b.status
      } else {
        va = (a[sortField] || '').toString().toLowerCase()
        vb = (b[sortField] || '').toString().toLowerCase()
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    return list
  }, [invoices, search, statusFilter, sortField, sortDir])

  const handleStatus = async (id, status, partialPct) => {
    const r = await updateStatus(id, status, partialPct)
    if (!r.success) toast.error(r.error)
  }

  const handleDuplicate = async (id) => {
    const r = await duplicateInvoice(id)
    r.success ? toast.success('Invoice duplicated!') : toast.error(r.error)
  }

  const handleDelete = async () => {
    const r = await deleteInvoice(confirm)
    r.success ? toast.success('Invoice deleted') : toast.error(r.error)
    setConfirm(null)
  }

  // Generic canvas capture of printRef
  const captureCanvas = async (inv) => {
    setCaptureTarget(inv)
    await new Promise(r => setTimeout(r, 220))
    const canvas = await html2canvas(printRef.current, {
      scale: 2, useCORS: true, backgroundColor: '#ffffff',
      width: A4_W, height: A4_H,
      windowWidth: A4_W, windowHeight: A4_H,
      logging: false,
    })
    setCaptureTarget(null)
    return canvas
  }

  const captureAndClear = async (inv) => {
    return await captureCanvas(inv)
  }

  const downloadPDF = async (inv) => {
    const toastId = toast.loading('Generating PDF...')
    try {
      const canvas = await captureCanvas(inv)
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297)
      pdf.save(`Invoice-${inv.invoice_number}.pdf`)
      toast.success('PDF downloaded!', { id: toastId })
    } catch { toast.error('PDF failed', { id: toastId }) }
  }

  const downloadImage = async (inv) => {
    const toastId = toast.loading('Generating image...')
    try {
      const canvas = await captureCanvas(inv)
      const link = document.createElement('a')
      link.download = `Invoice-${inv.invoice_number}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      toast.success('Image downloaded!', { id: toastId })
    } catch { toast.error('Image failed', { id: toastId }) }
  }

  const printInvoice = async (inv) => {
    try {
      const canvas = await captureCanvas(inv)
      const imgData = canvas.toDataURL('image/png')
      const pw = window.open('', '_blank')
      pw.document.write(`<!DOCTYPE html><html><head><title>Invoice ${inv.invoice_number}</title>
        <style>@page{size:A4 portrait;margin:0}body{margin:0}img{width:210mm;height:297mm;display:block}</style>
        </head><body><img src="${imgData}" /><script>window.onload=function(){window.print()}</script></body></html>`)
      pw.document.close()
    } catch { toast.error('Print failed') }
  }

  const sendEmail = async (inv) => {
    toast.success(`Invoice ${inv.invoice_number} queued for email to ${inv.client_email}`)
    // Could call a dedicated /api/invoices/:id/send endpoint here
  }

  const thCls = "px-4 py-3 font-medium text-gray-500 cursor-pointer select-none hover:text-gray-800 transition-colors"

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoice History</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {displayed.length} of {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link to="/dashboard/create" className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800">
          <Plus className="h-4 w-4" /> New Invoice
        </Link>
      </div>

      {/* Search + Filter bar */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search invoice #, client name or email..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="all">All Statuses</option>
          {ALL_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-300" /></div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-12 w-12 text-gray-200 mb-3" />
            <p className="text-gray-500">{invoices.length === 0 ? 'No invoices yet' : 'No results found'}</p>
            {invoices.length === 0 && (
              <Link to="/dashboard/create" className="mt-3 text-sm text-blue-600 hover:underline">Create your first invoice</Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className={`${thCls} text-left`} onClick={() => handleSort('invoice_number')}>
                    <div className="flex items-center gap-1">Invoice # <SortIcon field="invoice_number" sortField={sortField} sortDir={sortDir} /></div>
                  </th>
                  <th className={`${thCls} text-left`} onClick={() => handleSort('client_name')}>
                    <div className="flex items-center gap-1">Client <SortIcon field="client_name" sortField={sortField} sortDir={sortDir} /></div>
                  </th>
                  <th className={`${thCls} text-left`} onClick={() => handleSort('issue_date')}>
                    <div className="flex items-center gap-1">Date <SortIcon field="issue_date" sortField={sortField} sortDir={sortDir} /></div>
                  </th>
                  <th className={`${thCls} text-left`} onClick={() => handleSort('due_date')}>
                    <div className="flex items-center gap-1">Due <SortIcon field="due_date" sortField={sortField} sortDir={sortDir} /></div>
                  </th>
                  <th className={`${thCls} text-right`} onClick={() => handleSort('amount')}>
                    <div className="flex items-center justify-end gap-1">Amount <SortIcon field="amount" sortField={sortField} sortDir={sortDir} /></div>
                  </th>
                  <th className={`${thCls} text-center`} onClick={() => handleSort('status')}>
                    <div className="flex items-center justify-center gap-1">Status <SortIcon field="status" sortField={sortField} sortDir={sortDir} /></div>
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayed.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{inv.invoice_number}</td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{inv.client_name}</div>
                      {inv.client_email && <div className="text-xs text-gray-400">{inv.client_email}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(inv.issue_date)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(inv.due_date)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {formatCurrency(calculateTotal(inv.items, inv.tax_percentage), currency)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusDropdown invoice={inv} onUpdate={handleStatus} />
                      {/* Email reminder log indicators */}
                      <div className="flex items-center justify-center gap-1 mt-1">
                        {inv.email_sent_at_7day && (
                          <span title={`7-day reminder sent: ${new Date(inv.email_sent_at_7day).toLocaleString()}`}
                            className="w-2 h-2 rounded-full bg-blue-400 cursor-help" />
                        )}
                        {inv.email_sent_at_3day && (
                          <span title={`3-day reminder sent: ${new Date(inv.email_sent_at_3day).toLocaleString()}`}
                            className="w-2 h-2 rounded-full bg-yellow-400 cursor-help" />
                        )}
                        {inv.email_sent_at_1day && (
                          <span title={`1-day reminder sent: ${new Date(inv.email_sent_at_1day).toLocaleString()}`}
                            className="w-2 h-2 rounded-full bg-red-400 cursor-help" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewModal(inv)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
                          <Eye className="h-4 w-4" />
                        </button>
                        <DropMenu
                          invoice={inv}
                          onDelete={() => setConfirm(inv.id)}
                          onDuplicate={() => handleDuplicate(inv.id)}
                          onDownloadPDF={() => downloadPDF(inv)}
                          onDownloadImage={() => downloadImage(inv)}
                          onPrint={() => printInvoice(inv)}
                          onSendEmail={() => sendEmail(inv)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legend for email dots */}
      <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
        <span className="font-medium text-gray-500">Reminder emails:</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> 7-day sent</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" /> 3-day sent</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> 1-day sent</span>
      </div>

      {/* Hidden invoice for PDF/print/email capture — separate from modal */}
      {captureTarget && (
        <div className="fixed left-[-9999px] top-0" aria-hidden="true" style={{ zIndex: -1 }}>
          <InvoicePreview
            ref={printRef}
            clientName={captureTarget.client_name}
            clientEmail={captureTarget.client_email}
            clientAddress={captureTarget.client_address}
            invoiceNumber={captureTarget.invoice_number}
            issueDate={captureTarget.issue_date}
            dueDate={captureTarget.due_date}
            items={captureTarget.items}
            taxPercentage={captureTarget.tax_percentage}
            notes={captureTarget.notes}
            settings={settings}
            status={captureTarget.status}
            partialPercentage={captureTarget.partial_percentage}
          />
        </div>
      )}

      {/* Preview Modal */}
      {viewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <h2 className="font-semibold text-gray-900">Invoice {viewModal.invoice_number}</h2>
                {/* Reminder email timeline */}
                <div className="flex items-center gap-3 mt-1">
                  {viewModal.email_sent_at_7day && (
                    <span className="text-xs text-blue-600 flex items-center gap-1">
                      📧 7-day: {new Date(viewModal.email_sent_at_7day).toLocaleString()}
                    </span>
                  )}
                  {viewModal.email_sent_at_3day && (
                    <span className="text-xs text-yellow-600 flex items-center gap-1">
                      📧 3-day: {new Date(viewModal.email_sent_at_3day).toLocaleString()}
                    </span>
                  )}
                  {viewModal.email_sent_at_1day && (
                    <span className="text-xs text-red-600 flex items-center gap-1">
                      📧 1-day: {new Date(viewModal.email_sent_at_1day).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setViewModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* A4 preview inside modal — no scroll, fits container */}
            <div className="flex-1 overflow-hidden bg-gray-100 flex items-start justify-center p-4">
              <div style={{
                transform: 'scale(0.58)',
                transformOrigin: 'top center',
                width: `${A4_W}px`,
                marginBottom: `-${Math.round(A4_H * 0.42)}px`,
              }}>
                <InvoicePreview
                  clientName={viewModal.client_name}
                  clientEmail={viewModal.client_email}
                  clientAddress={viewModal.client_address}
                  invoiceNumber={viewModal.invoice_number}
                  issueDate={viewModal.issue_date}
                  dueDate={viewModal.due_date}
                  items={viewModal.items}
                  taxPercentage={viewModal.tax_percentage}
                  notes={viewModal.notes}
                  settings={settings}
                  status={viewModal.status}
                  partialPercentage={viewModal.partial_percentage}
                />
              </div>
            </div>
            <div className="flex gap-2 px-5 py-3 border-t bg-white">
              <button onClick={() => downloadPDF(viewModal)} className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50">
                <Download className="h-4 w-4" /> PDF (A4)
              </button>
              <button onClick={() => downloadImage(viewModal)} className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50">
                <ImageIcon className="h-4 w-4" /> Image
              </button>
              <button onClick={() => printInvoice(viewModal)} className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50">
                <Printer className="h-4 w-4" /> Print (A4)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <h2 className="font-bold text-gray-900 text-lg mb-2">Delete Invoice?</h2>
            <p className="text-gray-500 text-sm mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirm(null)} className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleDelete} className="flex-1 rounded-lg bg-red-500 text-white px-4 py-2.5 text-sm font-medium hover:bg-red-600">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
