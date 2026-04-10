import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useInvoiceStore, useSettingsStore } from '@/lib/stores'
import InvoicePreview from '@/components/InvoicePreview'
import { formatCurrency, calculateTotal, formatDate } from '@/lib/utils'
import { ArrowLeft, Download, Printer, Pencil, Loader2, Image as ImageIcon, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

const A4_W = 794
const A4_H = 1123
const STATUS_COLORS = {
  paid: 'bg-green-100 text-green-700', unpaid: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700', pending_payment: 'bg-amber-100 text-amber-800',
  partial: 'bg-orange-100 text-orange-700', processing: 'bg-blue-100 text-blue-700',
  failed: 'bg-red-200 text-red-900', cancelled: 'bg-gray-100 text-gray-600',
  refunded: 'bg-purple-100 text-purple-700', expired: 'bg-pink-100 text-pink-700',
  overdue: 'bg-red-100 text-red-800',
}

export default function ViewInvoice() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getInvoiceById, fetchInvoices } = useInvoiceStore()
  const { settings, fetchSettings } = useSettingsStore()
  const printRef = useRef(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchInvoices(), fetchSettings()]).then(() => setLoading(false))
  }, [])

  const invoice = getInvoiceById(id)
  const currency = settings?.default_currency || 'USD'

  const captureCanvas = async () => {
    return await html2canvas(printRef.current, {
      scale: 2, useCORS: true, backgroundColor: '#ffffff',
      width: A4_W, height: A4_H,
      windowWidth: A4_W, windowHeight: A4_H,
      logging: false,
    })
  }

  const downloadPDF = async () => {
    const toastId = toast.loading('Generating PDF...')
    try {
      const canvas = await captureCanvas()
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297)
      pdf.save(`Invoice-${invoice.invoice_number}.pdf`)
      toast.success('PDF downloaded!', { id: toastId })
    } catch { toast.error('PDF failed', { id: toastId }) }
  }

  const downloadImage = async () => {
    const toastId = toast.loading('Generating image...')
    try {
      const canvas = await captureCanvas()
      const link = document.createElement('a')
      link.download = `Invoice-${invoice.invoice_number}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      toast.success('Image downloaded!', { id: toastId })
    } catch { toast.error('Image failed', { id: toastId }) }
  }

  const handlePrint = async () => {
    const canvas = await captureCanvas()
    const pw = window.open('', '_blank')
    pw.document.write(`<!DOCTYPE html><html><head><title>Invoice ${invoice?.invoice_number}</title>
      <style>@page{size:A4 portrait;margin:0}body{margin:0}img{width:210mm;height:297mm;display:block}</style>
      </head><body><img src="${canvas.toDataURL('image/png')}" />
      <script>window.onload=function(){window.print()}</script></body></html>`)
    pw.document.close()
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-gray-300" /></div>
  if (!invoice) return (
    <div className="flex flex-col items-center justify-center h-64 text-center p-6">
      <p className="text-gray-500 mb-3">Invoice not found.</p>
      <button onClick={() => navigate('/dashboard/history')} className="text-sm text-blue-600 hover:underline">Back to History</button>
    </div>
  )

  const statusLabel = invoice.status === 'pending_payment'
    ? '💳 Pending Payment Review'
    : invoice.status === 'partial' && invoice.partial_percentage
    ? `Partial (${invoice.partial_percentage}%)`
    : invoice.status

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Invoice {invoice.invoice_number}</h1>
            <p className="text-sm text-gray-500">Created {formatDate(invoice.created_at)}</p>
          </div>
          <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[invoice.status] || STATUS_COLORS.unpaid}`}>
            {statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link to={`/dashboard/edit/${invoice.id}`} className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Pencil className="h-4 w-4" /> Edit
          </Link>
          <button onClick={downloadPDF} className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Download className="h-4 w-4" /> PDF
          </button>
          <button onClick={downloadImage} className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <ImageIcon className="h-4 w-4" /> Image
          </button>
          <button onClick={handlePrint} className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
            <Printer className="h-4 w-4" /> Print (A4)
          </button>
        </div>
      </div>

      {/* Pending payment review banner */}
      {invoice.status === 'pending_payment' && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
          <span className="text-2xl">💳</span>
          <div>
            <p className="font-semibold text-amber-800">Client has submitted a payment receipt</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Review the receipt in the <a href="/dashboard/receipts" className="underline font-medium">Receipts page</a> and approve or reject it. The invoice will be marked as <strong>Paid</strong> only after your approval.
            </p>
          </div>
        </div>
      )}

      {/* Meta cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Client', value: invoice.client_name },
          { label: 'Issue Date', value: formatDate(invoice.issue_date) },
          { label: 'Due Date', value: formatDate(invoice.due_date) },
          { label: 'Total', value: formatCurrency(calculateTotal(invoice.items, invoice.tax_percentage), currency) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className="font-semibold text-gray-900 text-sm">{value}</p>
          </div>
        ))}
      </div>

      {/* Reminder email timeline */}
      {(invoice.email_sent_at_7day || invoice.email_sent_at_3day || invoice.email_sent_at_1day) && (
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
          <p className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">📧 Reminder Emails Sent</p>
          <div className="space-y-1">
            {invoice.email_sent_at_7day && (
              <p className="text-sm text-blue-600">
                <span className="font-medium">7-day reminder:</span> {new Date(invoice.email_sent_at_7day).toLocaleString()}
              </p>
            )}
            {invoice.email_sent_at_3day && (
              <p className="text-sm text-yellow-600">
                <span className="font-medium">3-day reminder:</span> {new Date(invoice.email_sent_at_3day).toLocaleString()}
              </p>
            )}
            {invoice.email_sent_at_1day && (
              <p className="text-sm text-red-600">
                <span className="font-medium">1-day reminder:</span> {new Date(invoice.email_sent_at_1day).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* A4 Invoice Preview — full view, no scroll */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <p className="font-semibold text-gray-900 text-sm">Invoice Preview — A4</p>
          <span className="text-xs text-gray-400">210 × 297 mm</span>
        </div>
        <div
          className="bg-gray-100 flex items-start justify-center p-4 overflow-hidden"
          style={{ height: `${Math.round(A4_H * 0.62) + 32}px` }}
        >
          <div style={{
            transform: 'scale(0.62)',
            transformOrigin: 'top center',
            width: `${A4_W}px`,
            flexShrink: 0,
          }}>
            <InvoicePreview
              ref={printRef}
              clientName={invoice.client_name}
              clientEmail={invoice.client_email}
              clientAddress={invoice.client_address}
              invoiceNumber={invoice.invoice_number}
              issueDate={invoice.issue_date}
              dueDate={invoice.due_date}
              items={invoice.items}
              taxPercentage={invoice.tax_percentage}
              notes={invoice.notes}
              settings={settings}
              status={invoice.status}
              partialPercentage={invoice.partial_percentage}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
