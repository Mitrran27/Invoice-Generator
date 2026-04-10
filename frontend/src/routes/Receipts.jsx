import { useEffect, useState } from 'react'
import { useInvoiceStore } from '@/lib/stores'
import api from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  CheckCircle, XCircle, Clock, AlertTriangle, Eye, X,
  FileText, Image as ImageIcon, Loader2, ChevronDown
} from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_STYLES = {
  pending_review: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Pending Review', icon: Clock },
  approved:       { bg: 'bg-green-100', text: 'text-green-700', label: 'Approved', icon: CheckCircle },
  rejected:       { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected', icon: XCircle },
  mismatch:       { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Amount Mismatch', icon: AlertTriangle },
}

function ReceiptBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending_review
  const Icon = s.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      <Icon className="h-3 w-3" />
      {s.label}
    </span>
  )
}

function ReviewModal({ receipt, onClose, onReviewed }) {
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [imageError, setImageError] = useState(false)

  const handleReview = async (status) => {
    setSubmitting(true)
    try {
      await api.patch(`/receipts/${receipt.id}/review`, { status, reviewerNotes: notes })
      toast.success(status === 'approved' ? '✅ Receipt approved — invoice marked paid!' : '❌ Receipt rejected')
      onReviewed(receipt.id, status)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to review receipt')
    }
    setSubmitting(false)
  }

  const isImage = receipt.file_type?.startsWith('image/')
  const isPDF = receipt.file_type === 'application/pdf'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Review Payment Receipt</h2>
            <p className="text-sm text-gray-500 mt-0.5">Invoice #{receipt.invoice_number}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* Auto-detection banner */}
          {receipt.auto_status && (
            <div className={`rounded-xl p-4 ${
              receipt.auto_status === 'approved' ? 'bg-green-50 border border-green-200' :
              receipt.auto_status === 'mismatch' ? 'bg-yellow-50 border border-yellow-200' :
              'bg-blue-50 border border-blue-200'
            }`}>
              <p className={`text-sm font-semibold ${
                receipt.auto_status === 'approved' ? 'text-green-700' :
                receipt.auto_status === 'mismatch' ? 'text-yellow-700' : 'text-blue-700'
              }`}>
                {receipt.auto_status === 'approved' ? '✅ Auto-detected: Amount matches invoice' :
                 receipt.auto_status === 'mismatch' ? '⚠️ Auto-detected: Amount mismatch — please review carefully' :
                 '🔍 Awaiting your review'}
              </p>
            </div>
          )}

          {/* Client & payment details */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'From', value: receipt.client_name || receipt.inv_client_name },
              { label: 'Email', value: receipt.client_email || '—' },
              { label: receipt.detected_amount !== null && receipt.detected_amount !== undefined ? '🔍 Auto-Detected Amount' : 'Amount Paid', value: receipt.amount_paid ? `${receipt.currency || 'USD'} ${Number(receipt.amount_paid).toFixed(2)}` : '—', highlight: true },
              { label: 'Invoice Total', value: receipt.invoice_total ? `${receipt.default_currency || 'USD'} ${Number(receipt.invoice_total).toFixed(2)}` : '—' },
              { label: 'Payment Method', value: receipt.payment_method || '—' },
              { label: 'Payment Date', value: receipt.payment_date ? formatDate(receipt.payment_date) : '—' },
              { label: 'Submitted At', value: new Date(receipt.created_at).toLocaleString() },
              { label: 'Notes', value: receipt.notes || '—' },
            ].map(({ label, value, highlight }) => (
              <div key={label} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
                <p className={`text-sm font-semibold ${highlight ? 'text-blue-700 text-base' : 'text-gray-900'}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Amount comparison */}
          {receipt.amount_paid && receipt.invoice_total && (
            <div className={`rounded-xl p-4 border ${
              Math.abs(Number(receipt.amount_paid) - Number(receipt.invoice_total)) < Number(receipt.invoice_total) * 0.01
                ? 'bg-green-50 border-green-200'
                : 'bg-yellow-50 border-yellow-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-gray-600">Paid: </span>
                  <span className="font-bold">{receipt.currency} {Number(receipt.amount_paid).toFixed(2)}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">Invoice: </span>
                  <span className="font-bold">{receipt.default_currency} {Number(receipt.invoice_total).toFixed(2)}</span>
                </div>
                <div className="text-sm font-semibold">
                  {Math.abs(Number(receipt.amount_paid) - Number(receipt.invoice_total)) < Number(receipt.invoice_total) * 0.01
                    ? <span className="text-green-600">✅ Match</span>
                    : <span className="text-yellow-600">⚠️ Diff: {receipt.currency} {Math.abs(Number(receipt.amount_paid) - Number(receipt.invoice_total)).toFixed(2)}</span>
                  }
                </div>
              </div>
            </div>
          )}

          {/* File preview */}
          {receipt.file_url && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Uploaded Proof</p>
              {isImage && !imageError ? (
                <img
                  src={receipt.file_url}
                  alt="Payment proof"
                  onError={() => setImageError(true)}
                  className="w-full max-h-64 object-contain rounded-xl border border-gray-200 bg-gray-50"
                />
              ) : isPDF ? (
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <FileText className="h-10 w-10 text-red-500 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">{receipt.file_name || 'receipt.pdf'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">PDF document</p>
                    {receipt.file_url.startsWith('data:') && (
                      <a href={receipt.file_url} download={receipt.file_name || 'receipt.pdf'}
                        className="text-xs text-blue-600 hover:underline mt-1 block">Download PDF</a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-500">
                  <ImageIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-center">File attached ({receipt.file_name || 'proof'})</p>
                </div>
              )}
            </div>
          )}

          {/* Reviewer notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Review Notes <span className="text-gray-400 text-xs">(optional — visible in dashboard)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Amount confirmed, marking as paid..."
            />
          </div>
        </div>

        {/* Actions */}
        {receipt.status === 'pending_review' || receipt.status === 'mismatch' ? (
          <div className="flex gap-3 px-6 py-4 border-t bg-white">
            <button
              onClick={() => handleReview('rejected')}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-red-200 text-red-600 py-2.5 text-sm font-semibold hover:bg-red-50 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" /> Reject
            </button>
            <button
              onClick={() => handleReview('approved')}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-green-600 text-white py-2.5 text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Approve & Mark Paid
            </button>
          </div>
        ) : (
          <div className="px-6 py-4 border-t bg-gray-50 text-center">
            <ReceiptBadge status={receipt.status} />
            {receipt.reviewer_notes && <p className="text-xs text-gray-500 mt-2">{receipt.reviewer_notes}</p>}
            {receipt.reviewed_at && <p className="text-xs text-gray-400 mt-1">Reviewed: {new Date(receipt.reviewed_at).toLocaleString()}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Receipts() {
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    fetchReceipts()
  }, [])

  const fetchReceipts = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/receipts')
      setReceipts(data.receipts)
    } catch (err) {
      toast.error('Failed to load receipts')
    }
    setLoading(false)
  }

  const handleReviewed = (id, newStatus) => {
    setReceipts(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r))
  }

  const filtered = statusFilter === 'all'
    ? receipts
    : receipts.filter(r => r.status === statusFilter)

  const pendingCount = receipts.filter(r => r.status === 'pending_review' || r.status === 'mismatch').length

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Receipts</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {receipts.length} receipt{receipts.length !== 1 ? 's' : ''} total
            {pendingCount > 0 && <span className="ml-2 text-orange-600 font-medium">· {pendingCount} awaiting review</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_STYLES).map(([v, s]) => (
              <option key={v} value={v}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-12 w-12 text-gray-200 mb-3" />
            <p className="text-gray-500">{receipts.length === 0 ? 'No payment receipts yet' : 'No receipts match this filter'}</p>
            <p className="text-xs text-gray-400 mt-1">Receipts appear when clients submit payment proof via the email link</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Invoice #</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Client</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Submitted</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Amount Paid</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Invoice Total</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Proof</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(r => (
                  <tr key={r.id} className={`hover:bg-gray-50 transition-colors ${(r.status === 'pending_review' || r.status === 'mismatch') ? 'bg-orange-50/30' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-900">{r.invoice_number}</td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{r.client_name || r.inv_client_name}</div>
                      {r.client_email && <div className="text-xs text-gray-400">{r.client_email}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {r.amount_paid ? `${r.currency || 'USD'} ${Number(r.amount_paid).toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {r.invoice_total ? `${r.default_currency || 'USD'} ${Number(r.invoice_total).toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ReceiptBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.file_url ? (
                        r.file_type?.startsWith('image/') ? (
                          <ImageIcon className="h-4 w-4 text-blue-500 mx-auto" />
                        ) : (
                          <FileText className="h-4 w-4 text-red-500 mx-auto" />
                        )
                      ) : (
                        <span className="text-gray-300 text-xs">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelected(r)}
                        className={`flex items-center gap-1.5 ml-auto rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          r.status === 'pending_review' || r.status === 'mismatch'
                            ? 'bg-orange-500 text-white hover:bg-orange-600'
                            : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {r.status === 'pending_review' || r.status === 'mismatch' ? 'Review' : 'View'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <ReviewModal
          receipt={selected}
          onClose={() => setSelected(null)}
          onReviewed={handleReviewed}
        />
      )}
    </div>
  )
}
