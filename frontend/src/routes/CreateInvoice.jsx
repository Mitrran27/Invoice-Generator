import { useEffect } from 'react'
import { useInvoiceStore, useSettingsStore } from '@/lib/stores'
import InvoiceForm from '@/components/InvoiceForm'

export default function CreateInvoice() {
  const { createInvoice } = useInvoiceStore()
  const { fetchSettings } = useSettingsStore()

  useEffect(() => { fetchSettings() }, [])

  return (
    <div>
      <div className="border-b bg-white px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Create Invoice</h1>
        <p className="text-sm text-gray-500 mt-0.5">Fill in the details and preview your invoice</p>
      </div>
      <InvoiceForm onSubmit={createInvoice} submitLabel="Save Invoice" />
    </div>
  )
}
