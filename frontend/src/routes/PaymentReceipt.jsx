import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import api from '@/lib/api'
import { Upload, CheckCircle, AlertTriangle, Loader2, FileText, X, Image as ImageIcon } from 'lucide-react'
import toast from 'react-hot-toast'

export default function PaymentReceipt() {
  const { token } = useParams()
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [autoStatus, setAutoStatus] = useState(null)
  const [file, setFile] = useState(null)
  const [filePreview, setFilePreview] = useState(null)
  const [form, setForm] = useState({
    clientName: '', clientEmail: '', amountPaid: '', paymentMethod: '',
    paymentDate: new Date().toISOString().slice(0, 10), notes: '',
  })

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const { data } = await api.get(`/receipts/upload/${token}`)
        setInfo(data)
        setForm(f => ({
          ...f,
          clientName: data.clientName || '',
          clientEmail: data.clientEmail || '',
          amountPaid: data.invoiceTotal ? data.invoiceTotal.toFixed(2) : '',
        }))
      } catch (err) {
        setInfo({ error: err.response?.data?.error || 'Invalid or expired link' })
      }
      setLoading(false)
    }
    fetchInfo()
  }, [token])

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    if (f.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => setFilePreview(reader.result)
      reader.readAsDataURL(f)
    } else {
      setFilePreview(null) // PDF
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.amountPaid || Number(form.amountPaid) <= 0) { toast.error('Please enter the amount paid'); return }
    setSubmitting(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      if (file) fd.append('receipt', file)

      const { data } = await api.post(`/receipts/upload/${token}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setAutoStatus(data.autoStatus)
      setSubmitted(true)
      toast.success('Receipt submitted!')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit receipt')
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (info?.error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Link Invalid</h2>
          <p className="text-gray-500">{info.error}</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    const isMatch = autoStatus === 'approved'
    const isMismatch = autoStatus === 'mismatch'
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          {isMatch ? (
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          ) : (
            <AlertTriangle className={`h-16 w-16 mx-auto mb-4 ${isMismatch ? 'text-yellow-500' : 'text-blue-500'}`} />
          )}
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {isMatch ? 'Payment Confirmed!' : isMismatch ? 'Amount Mismatch Detected' : 'Receipt Submitted!'}
          </h2>
          <p className="text-gray-500 mb-4">
            {isMatch
              ? 'Your payment receipt has been submitted and the amount matches the invoice. The invoice owner will confirm shortly.'
              : isMismatch
              ? `The amount you paid (${Number(form.amountPaid).toFixed(2)}) does not match the invoice total (${info.invoiceTotal?.toFixed(2)}). The invoice owner will review and contact you if needed.`
              : 'Your receipt has been submitted and is under review. The invoice owner will verify and update the status.'}
          </p>
          <div className="bg-gray-50 rounded-xl p-4 text-left text-sm">
            <p className="text-gray-500">Invoice #</p>
            <p className="font-semibold text-gray-900">{info.invoiceNumber}</p>
            <p className="text-gray-500 mt-2">Amount Submitted</p>
            <p className="font-semibold text-gray-900">{info.currency} {Number(form.amountPaid).toFixed(2)}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="bg-gray-900 text-white rounded-2xl p-6 mb-6 text-center">
          <div className="h-12 w-12 bg-blue-500 rounded-xl flex items-center justify-center mx-auto mb-3">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold">Submit Payment Receipt</h1>
          <p className="text-gray-400 text-sm mt-1">{info.companyName}</p>
        </div>

        {/* Invoice summary */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
          <h2 className="font-semibold text-gray-900 mb-3">Invoice Details</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Invoice #</p>
              <p className="font-semibold text-gray-900">{info.invoiceNumber}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Amount Due</p>
              <p className="font-bold text-gray-900 text-lg">{info.currency} {info.invoiceTotal?.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Due Date</p>
              <p className="font-medium text-red-600">{new Date(info.dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Status</p>
              <p className="font-medium capitalize text-gray-700">{info.invoiceStatus}</p>
            </div>
          </div>
        </div>

        {/* Upload form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Your Payment Details</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Name</label>
              <input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} placeholder="Your name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Email</label>
              <input type="email" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.clientEmail} onChange={e => setForm(f => ({ ...f, clientEmail: e.target.value }))} placeholder="your@email.com" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount Paid *</label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-500">{info.currency}</span>
              <input type="number" step="0.01" min="0.01" required
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.amountPaid} onChange={e => setForm(f => ({ ...f, amountPaid: e.target.value }))} placeholder="0.00" />
            </div>
            {info.invoiceTotal && Number(form.amountPaid) > 0 && (
              <p className={`text-xs mt-1 ${Math.abs(Number(form.amountPaid) - info.invoiceTotal) < info.invoiceTotal * 0.01 ? 'text-green-600' : 'text-yellow-600'}`}>
                {Math.abs(Number(form.amountPaid) - info.invoiceTotal) < info.invoiceTotal * 0.01
                  ? '✅ Amount matches invoice total'
                  : `⚠️ Invoice total is ${info.currency} ${info.invoiceTotal?.toFixed(2)}`}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Method</label>
              <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                <option value="">Select method</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Debit Card">Debit Card</option>
                <option value="PayPal">PayPal</option>
                <option value="Crypto">Crypto</option>
                <option value="Cheque">Cheque</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Date</label>
              <input type="date" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.paymentDate} onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))} />
            </div>
          </div>

          {/* File upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Payment Proof <span className="text-gray-400 text-xs">(bank slip, screenshot, receipt — PDF or image)</span>
            </label>
            {filePreview ? (
              <div className="relative">
                <img src={filePreview} alt="preview" className="w-full max-h-48 object-contain rounded-lg border border-gray-200" />
                <button type="button" onClick={() => { setFile(null); setFilePreview(null) }}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : file ? (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <FileText className="h-8 w-8 text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{file.name}</p></div>
                <button type="button" onClick={() => setFile(null)} className="text-red-500 hover:text-red-700"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                <Upload className="h-8 w-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">Click to upload or drag & drop</p>
                <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG, GIF up to 10MB</p>
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp" onChange={handleFileChange} />
              </label>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
            <textarea className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Transaction ID, reference number, or any notes..." />
          </div>

          <button type="submit" disabled={submitting}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60 transition-colors">
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</> : <><Upload className="h-4 w-4" /> Submit Payment Receipt</>}
          </button>
        </form>
      </div>
    </div>
  )
}
