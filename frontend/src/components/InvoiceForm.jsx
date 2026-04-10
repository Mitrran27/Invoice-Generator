import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettingsStore, useInvoiceStore } from '@/lib/stores'
import InvoicePreview from '@/components/InvoicePreview'
import { Plus, Trash2, Save, Download, Printer, Loader2, Image as ImageIcon, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

const emptyItem = () => ({ id: crypto.randomUUID(), description: '', rate: 0, quantity: 1 })

const ALL_STATUSES = [
  { value: 'unpaid',     label: 'Unpaid',      color: 'text-red-600' },
  { value: 'paid',       label: 'Paid',        color: 'text-green-600' },
  { value: 'pending',    label: 'Pending',     color: 'text-yellow-600' },
  { value: 'partial',    label: 'Partial',     color: 'text-orange-600' },
  { value: 'processing', label: 'Processing',  color: 'text-blue-600' },
  { value: 'failed',     label: 'Failed',      color: 'text-red-800' },
  { value: 'cancelled',  label: 'Cancelled',   color: 'text-gray-600' },
  { value: 'refunded',   label: 'Refunded',    color: 'text-purple-600' },
  { value: 'expired',    label: 'Expired',     color: 'text-pink-600' },
  { value: 'overdue',    label: 'Overdue',     color: 'text-red-700' },
]

const PREVIEW_SCALE = 0.60
const A4_W = 794
const A4_H = 1123

export default function InvoiceForm({ initial = null, onSubmit, submitLabel = 'Save Invoice' }) {
  const navigate = useNavigate()
  const { settings } = useSettingsStore()
  const { sendInvoiceEmail } = useInvoiceStore()
  const printRef = useRef(null)
  const [saving, setSaving] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)

  const [form, setForm] = useState({
    invoiceNumber: initial?.invoice_number || `INV-${Date.now().toString().slice(-6)}`,
    clientName: initial?.client_name || '',
    clientEmail: initial?.client_email || '',
    clientAddress: initial?.client_address || '',
    issueDate: initial?.issue_date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    dueDate: initial?.due_date?.slice(0, 10) || new Date(Date.now() + 30*86400000).toISOString().slice(0, 10),
    taxPercentage: initial?.tax_percentage ?? settings?.default_tax_percentage ?? 10,
    notes: initial?.notes || '',
    status: initial?.status || 'unpaid',
    partialPercentage: initial?.partial_percentage || 0,
    sendEmailNow: false,
  })
  const [items, setItems] = useState(
    initial?.items?.length
      ? initial.items.map((i) => ({ ...i, id: i.id || crypto.randomUUID() }))
      : [emptyItem()]
  )

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const addItem = () => setItems((p) => [...p, emptyItem()])
  const removeItem = (id) => { if (items.length > 1) setItems((p) => p.filter((i) => i.id !== id)) }
  const updateItem = (id, field, value) => setItems((p) => p.map((i) => i.id === id ? { ...i, [field]: value } : i))

  // Generate A4 canvas from the preview ref
  const captureA4Canvas = async () => {
    if (!printRef.current) throw new Error('Preview not ready')
    return await html2canvas(printRef.current, {
      scale: 2, useCORS: true, backgroundColor: '#ffffff',
      width: A4_W, height: A4_H,
      windowWidth: A4_W, windowHeight: A4_H,
      logging: false,
      onclone: (doc) => {
        // Ensure all inline styles are preserved in clone
        const el = doc.querySelector('[data-invoice-preview]')
        if (el) el.style.transform = 'none'
      },
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.clientName.trim()) { toast.error('Client name is required'); return }
    setSaving(true)

    // Generate PDF base64 to attach to email if sendEmailNow
    let pdfBase64 = null
    if (form.sendEmailNow && form.clientEmail) {
      try {
        const canvas = await captureA4Canvas()
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297)
        pdfBase64 = pdf.output('datauristring').split(',')[1]
      } catch (err) { console.warn('PDF generation failed, sending without attachment') }
    }

    const result = await onSubmit({ ...form, items, pdfBase64 })
    setSaving(false)
    if (result?.success) {
      toast.success(form.sendEmailNow && form.clientEmail ? 'Invoice saved & email sent with PDF!' : 'Invoice saved!')
      navigate('/dashboard/history')
    } else {
      toast.error(result?.error || 'Failed to save invoice')
    }
  }

  // Send email for an already-saved invoice
  const handleSendEmail = async () => {
    if (!initial?.id) { toast.error('Save the invoice first'); return }
    if (!form.clientEmail) { toast.error('Client email is required'); return }
    setSendingEmail(true)
    const toastId = toast.loading('Generating PDF & sending email...')
    try {
      const canvas = await captureA4Canvas()
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297)
      const pdfBase64 = pdf.output('datauristring').split(',')[1]
      const result = await sendInvoiceEmail(initial.id, pdfBase64)
      if (result.success) {
        toast.success('Email with PDF sent to client!', { id: toastId })
      } else {
        toast.error(result.error || 'Failed to send email', { id: toastId })
      }
    } catch (err) {
      toast.error('Failed: ' + err.message, { id: toastId })
    }
    setSendingEmail(false)
  }

  const downloadPDF = async () => {
    const toastId = toast.loading('Generating A4 PDF...')
    try {
      const canvas = await captureA4Canvas()
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297)
      pdf.save(`Invoice-${form.invoiceNumber}.pdf`)
      toast.success('A4 PDF downloaded!', { id: toastId })
    } catch (err) {
      toast.error('Failed to generate PDF', { id: toastId })
    }
  }

  const downloadImage = async () => {
    const toastId = toast.loading('Generating image...')
    try {
      const canvas = await captureA4Canvas()
      const link = document.createElement('a')
      link.download = `Invoice-${form.invoiceNumber}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      toast.success('Image downloaded!', { id: toastId })
    } catch {
      toast.error('Failed to generate image', { id: toastId })
    }
  }

  const handlePrint = async () => {
    const canvas = await captureA4Canvas()
    const pw = window.open('', '_blank')
    pw.document.write(`<!DOCTYPE html><html><head><title>Invoice ${form.invoiceNumber}</title>
      <style>@page{size:A4 portrait;margin:0}body{margin:0}img{width:210mm;height:297mm;display:block}</style>
      </head><body><img src="${canvas.toDataURL('image/png')}" />
      <script>window.onload=function(){window.print()}<\/script></body></html>`)
    pw.document.close()
  }

  const subtotal = items.reduce((s, i) => s + Number(i.rate)*Number(i.quantity), 0)
  const tax = subtotal * (Number(form.taxPercentage)/100)
  const total = subtotal + tax
  const currency = settings?.default_currency || 'USD'

  const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5'

  return (
    <form onSubmit={handleSubmit} className="p-6 max-w-7xl mx-auto">
      <div className="grid lg:grid-cols-2 gap-6">
        {/* ── Left: Form ── */}
        <div className="space-y-5">
          {/* Client */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">Client Details</h3>
            <div>
              <label className={labelCls}>Client Name *</label>
              <input className={inputCls} value={form.clientName} onChange={set('clientName')} placeholder="Acme Corp" />
            </div>
            <div>
              <label className={labelCls}>Client Email <span className="text-gray-400 text-xs">(for reminders & PDF)</span></label>
              <input type="email" className={inputCls} value={form.clientEmail} onChange={set('clientEmail')} placeholder="client@example.com" />
            </div>
            <div>
              <label className={labelCls}>Client Address</label>
              <textarea className={inputCls} rows={2} value={form.clientAddress} onChange={set('clientAddress')} placeholder="123 Street, City, Country" />
            </div>
            {form.clientEmail && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={form.sendEmailNow} onChange={set('sendEmailNow')}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-gray-600">Send invoice PDF to client when saved</span>
              </label>
            )}
          </div>

          {/* Invoice Info */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">Invoice Info</h3>
            <div>
              <label className={labelCls}>Invoice Number</label>
              <input className={inputCls} value={form.invoiceNumber} onChange={set('invoiceNumber')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Issue Date</label><input type="date" className={inputCls} value={form.issueDate} onChange={set('issueDate')} /></div>
              <div><label className={labelCls}>Due Date</label><input type="date" className={inputCls} value={form.dueDate} onChange={set('dueDate')} /></div>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              {initial?.id ? (
                <select className={inputCls} value={form.status} onChange={set('status')}>
                  {ALL_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              ) : (
                <div className={`${inputCls} bg-gray-50 text-gray-500 cursor-not-allowed flex items-center gap-2`}>
                  <span className="inline-block w-2 h-2 rounded-full bg-red-400" />
                  Unpaid (set automatically)
                </div>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Line Items</h3>
              <button type="button" onClick={addItem} className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800">
                <Plus className="h-3.5 w-3.5" /> Add Item
              </button>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-400 px-1">
                <div className="col-span-5">Description</div><div className="col-span-3">Rate</div>
                <div className="col-span-2">Qty</div><div className="col-span-2 text-right">Amount</div>
              </div>
              {items.map((item) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                  <input className={`col-span-5 ${inputCls}`} value={item.description} onChange={(e) => updateItem(item.id,'description',e.target.value)} placeholder="Description" />
                  <input type="number" className={`col-span-3 ${inputCls}`} value={item.rate} onChange={(e) => updateItem(item.id,'rate',parseFloat(e.target.value)||0)} min="0" step="0.01" />
                  <input type="number" className={`col-span-2 ${inputCls}`} value={item.quantity} onChange={(e) => updateItem(item.id,'quantity',parseInt(e.target.value)||1)} min="1" />
                  <div className="col-span-2 flex items-center justify-end gap-1">
                    <span className="text-xs font-medium text-gray-700">{currency}{(Number(item.rate)*Number(item.quantity)).toFixed(2)}</span>
                    <button type="button" onClick={() => removeItem(item.id)} disabled={items.length===1} className="p-1 rounded text-gray-300 hover:text-red-500 disabled:opacity-30">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{currency}{subtotal.toFixed(2)}</span></div>
              <div className="flex items-center justify-between text-gray-500">
                <div className="flex items-center gap-2"><span>Tax</span>
                  <div className="flex items-center gap-1">
                    <input type="number" className="w-14 rounded border border-gray-200 px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={form.taxPercentage} onChange={set('taxPercentage')} min="0" max="100" />
                    <span className="text-xs">%</span>
                  </div>
                </div>
                <span>{currency}{tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t border-gray-100"><span>Total</span><span>{currency}{total.toFixed(2)}</span></div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <label className={labelCls}>Notes</label>
            <textarea className={inputCls} rows={3} value={form.notes} onChange={set('notes')} placeholder="Payment terms, thank you message, etc." />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {submitLabel}
            </button>
            {initial?.id && (
              <button type="button" onClick={handleSendEmail} disabled={sendingEmail||!form.clientEmail}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Send PDF to Client
              </button>
            )}
            <button type="button" onClick={downloadPDF} className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Download className="h-4 w-4" /> PDF (A4)
            </button>
            <button type="button" onClick={downloadImage} className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <ImageIcon className="h-4 w-4" /> Image
            </button>
            <button type="button" onClick={handlePrint} className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Printer className="h-4 w-4" /> Print (A4)
            </button>
          </div>
        </div>

        {/* ── Right: Full-view A4 Preview (no scroll) ── */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <p className="font-semibold text-gray-900 text-sm">Live Preview — A4</p>
              <span className="text-xs text-gray-400">210 × 297 mm</span>
            </div>
            <div className="bg-gray-100 flex items-start justify-center p-3"
              style={{ height: `${Math.round(A4_H * PREVIEW_SCALE) + 24}px`, overflow: 'hidden' }}>
              <div style={{ transform: `scale(${PREVIEW_SCALE})`, transformOrigin: 'top center', width: `${A4_W}px`, flexShrink: 0 }}>
                <InvoicePreview ref={printRef}
                  clientName={form.clientName} clientEmail={form.clientEmail} clientAddress={form.clientAddress}
                  invoiceNumber={form.invoiceNumber} issueDate={form.issueDate} dueDate={form.dueDate}
                  items={items} taxPercentage={form.taxPercentage} notes={form.notes}
                  settings={settings} status={form.status} partialPercentage={form.partialPercentage}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}
