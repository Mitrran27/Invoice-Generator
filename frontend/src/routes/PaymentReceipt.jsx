import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import api from '@/lib/api'
import { Upload, CheckCircle, AlertTriangle, Loader2, FileText, X, Image as ImageIcon, Scan } from 'lucide-react'
import toast from 'react-hot-toast'

export default function PaymentReceipt() {
  const { token } = useParams()
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [result, setResult] = useState(null)
  const [file, setFile] = useState(null)
  const [filePreview, setFilePreview] = useState(null)
  const [form, setForm] = useState({
    clientName: '', clientEmail: '', paymentMethod: '',
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
      setFilePreview(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) { toast.error('Please upload your payment proof (receipt image or PDF)'); return }
    setSubmitting(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      fd.append('receipt', file)

      const { data } = await api.post(`/receipts/upload/${token}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(data)
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

  if (submitted && result) {
    const isMatch = result.autoStatus === 'approved'
    const isMismatch = result.autoStatus === 'mismatch'
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          {isMatch
            ? <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            : <AlertTriangle className={`h-16 w-16 mx-auto mb-4 ${isMismatch ? 'text-yellow-500' : 'text-blue-500'}`} />
          }
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {isMatch ? 'Receipt Submitted — Pending Review!' : isMismatch ? 'Amount Mismatch Detected' : 'Receipt Submitted!'}
          </h2>
          <p className="text-gray-500 mb-5 text-sm">
            {isMatch
              ? 'Your payment matches the invoice amount. The invoice owner will review and confirm.'
              : isMismatch
              ? `The amount detected does not match the invoice total. The invoice owner will review.`
              : 'Your receipt is under review. The invoice owner will verify and update the status.'}
          </p>

          <div className="bg-gray-50 rounded-xl p-4 text-left text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Invoice #</span>
              <span className="font-semibold">{info.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Invoice Total</span>
              <span className="font-semibold">{info.currency} {info.invoiceTotal?.toFixed(2)}</span>
            </div>
            {result.detectedAmount !== null && result.detectedAmount !== undefined ? (
              <div className="flex justify-between">
                <span className="text-gray-500 flex items-center gap-1"><Scan className="h-3 w-3" /> Auto-detected</span>
                <span className="font-semibold text-blue-600">{info.currency} {Number(result.detectedAmount).toFixed(2)}</span>
              </div>
            ) : (
              <div className="flex justify-between">
                <span className="text-gray-500">Amount Submitted</span>
                <span className="font-semibold">{info.currency} {Number(result.amountUsed || 0).toFixed(2)}</span>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-400 mt-4">The invoice status is now "Pending Payment" until reviewed.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Company header */}
        <div className="bg-gray-900 text-white rounded-2xl p-6 mb-5">
          <div className="flex items-center gap-4">
            {info.companyLogo ? (
              <img
                src={info.companyLogo}
                alt={info.companyName}
                className="h-14 w-14 object-contain rounded-xl"
                style={{ filter: 'brightness(0) invert(1)' }}
                onError={(e) => e.target.style.display = 'none'}
              />
            ) : (
              <div className="h-14 w-14 bg-blue-500 rounded-xl flex items-center justify-center text-2xl font-bold">
                {info.companyName?.[0]?.toUpperCase() || 'C'}
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold">{info.companyName}</h1>
              <p className="text-gray-400 text-sm">Payment Receipt Submission</p>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {info.website && <span className="text-xs text-gray-400">🌐 {info.website}</span>}
                {info.twitter && <span className="text-xs text-blue-400">𝕏 {info.twitter}</span>}
                {info.linkedin && <span className="text-xs text-blue-300">in {info.linkedin}</span>}
                {info.facebook && <span className="text-xs text-blue-300">f {info.facebook}</span>}
              </div>
            </div>
          </div>
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
              <p className="font-medium text-red-600">
                {new Date(info.dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Status</p>
              <p className="font-medium capitalize text-gray-700">{info.invoiceStatus}</p>
            </div>
          </div>
        </div>

        {/* Upload form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Submit Payment Proof</h2>

          {/* OCR info banner */}
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
            <Scan className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-500" />
            <p>The amount will be automatically detected from your receipt image. You don't need to enter the amount manually — just upload your receipt.</p>
          </div>

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

          {/* File upload — primary field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Payment Proof * <span className="text-gray-400 text-xs">(bank slip, screenshot, receipt — PDF or image)</span>
            </label>
            {filePreview ? (
              <div className="relative">
                <img src={filePreview} alt="preview" className="w-full max-h-52 object-contain rounded-xl border border-gray-200 bg-gray-50" />
                <button type="button" onClick={() => { setFile(null); setFilePreview(null) }}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 shadow">
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="absolute bottom-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1 shadow">
                  <Scan className="h-3 w-3" /> Amount will be auto-detected
                </div>
              </div>
            ) : file ? (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <FileText className="h-8 w-8 text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">PDF document</p>
                </div>
                <button type="button" onClick={() => setFile(null)} className="text-red-500 hover:text-red-700"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-blue-300 rounded-xl cursor-pointer hover:bg-blue-50 transition-colors bg-blue-50/30">
                <Upload className="h-8 w-8 text-blue-400 mb-2" />
                <p className="text-sm text-gray-600 font-medium">Click to upload receipt</p>
                <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG up to 10MB</p>
                <p className="text-xs text-blue-500 mt-1 flex items-center gap-1"><Scan className="h-3 w-3" /> Amount auto-detected from image</p>
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp" onChange={handleFileChange} />
              </label>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
            <textarea className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Transaction reference number, or any additional notes..." />
          </div>

          <button type="submit" disabled={submitting}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60 transition-colors">
            {submitting
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing receipt...</>
              : <><Upload className="h-4 w-4" /> Submit Payment Receipt</>
            }
          </button>

          <p className="text-center text-xs text-gray-400">
            Your receipt will be reviewed by {info.companyName} before the invoice is marked as paid.
          </p>
        </form>
      </div>
    </div>
  )
}
