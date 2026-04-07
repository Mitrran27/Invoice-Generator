import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useInvoiceStore, useSettingsStore } from '@/lib/stores'
import InvoiceForm from '@/components/InvoiceForm'
import { Loader2 } from 'lucide-react'

export default function EditInvoice() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getInvoiceById, updateInvoice, fetchInvoices } = useInvoiceStore()
  const { fetchSettings } = useSettingsStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      await Promise.all([fetchInvoices(), fetchSettings()])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  const invoice = getInvoiceById(id)
  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-gray-500">Invoice not found.</p>
        <button onClick={() => navigate('/dashboard/history')} className="mt-3 text-sm text-blue-600 hover:underline">
          Back to History
        </button>
      </div>
    )
  }

  const handleUpdate = (data) => updateInvoice(id, data)

  return (
    <div>
      <div className="border-b bg-white px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Edit Invoice</h1>
        <p className="text-sm text-gray-500 mt-0.5">#{invoice.invoice_number}</p>
      </div>
      <InvoiceForm initial={invoice} onSubmit={handleUpdate} submitLabel="Update Invoice" />
    </div>
  )
}
