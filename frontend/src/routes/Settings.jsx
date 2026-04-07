import { useEffect, useState } from 'react'
import { useSettingsStore } from '@/lib/stores'
import { Building2, CreditCard, Globe, Bell, Loader2, Save, Upload, X } from 'lucide-react'
import toast from 'react-hot-toast'

const currencies = [
  'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'SGD', 'MYR', 'INR', 'HKD', 'CHF', 'CNY',
]

const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5'

function Section({ icon: Icon, title, description, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
        <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center">
          <Icon className="h-4 w-4 text-gray-500" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
          {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  )
}

export default function Settings() {
  const { settings, fetchSettings, saveSettings, isLoading } = useSettingsStore()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchSettings().then(() => {})
  }, [])

  // Sync form when settings load
  useEffect(() => {
    if (settings && !form) {
      setForm({
        companyName: settings.company_name || '',
        companyLogo: settings.company_logo || '',
        companyAddress: settings.company_address || '',
        phone: settings.phone || '',
        email: settings.email || '',
        website: settings.website || '',
        twitter: settings.twitter || '',
        linkedin: settings.linkedin || '',
        facebook: settings.facebook || '',
        defaultCurrency: settings.default_currency || 'USD',
        defaultTaxPercentage: settings.default_tax_percentage ?? 10,
        bankName: settings.bank_name || '',
        accountName: settings.account_name || '',
        accountNumber: settings.account_number || '',
        reminderEnabled: settings.reminder_enabled ?? false,
        reminderDaysBefore: settings.reminder_days_before ?? 3,
      })
    }
  }, [settings])

  const set = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error('Logo must be under 2MB'); return }
    const reader = new FileReader()
    reader.onloadend = () => setForm((f) => ({ ...f, companyLogo: reader.result }))
    reader.readAsDataURL(file)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const result = await saveSettings(form)
    setSaving(false)
    result.success ? toast.success('Settings saved!') : toast.error(result.error)
  }

  if (!form) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSave}>
      <div className="border-b bg-white px-6 py-4 sticky top-0 z-10 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure your company info and invoice defaults</p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </button>
      </div>

      <div className="p-6 max-w-3xl mx-auto space-y-5">
        {/* Company Info */}
        <Section icon={Building2} title="Company Information" description="Appears on all your invoices">
          {/* Logo */}
          <div>
            <label className={labelCls}>Company Logo</label>
            <div className="flex items-center gap-4">
              {form.companyLogo ? (
                <div className="relative">
                  <img src={form.companyLogo} alt="logo" className="h-16 w-16 rounded-xl object-contain border border-gray-200" />
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, companyLogo: '' }))}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="h-16 w-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300">
                  <Building2 className="h-6 w-6" />
                </div>
              )}
              <label className="cursor-pointer flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                <Upload className="h-4 w-4" />
                Upload Logo
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Company Name</label>
              <input className={inputCls} value={form.companyName} onChange={set('companyName')} placeholder="Acme Corp" />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" className={inputCls} value={form.email} onChange={set('email')} placeholder="contact@company.com" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Address</label>
            <textarea className={inputCls} rows={2} value={form.companyAddress} onChange={set('companyAddress')} placeholder="123 Business St, City, Country" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Phone</label>
              <input className={inputCls} value={form.phone} onChange={set('phone')} placeholder="+1 555 000 0000" />
            </div>
            <div>
              <label className={labelCls}>Website</label>
              <input className={inputCls} value={form.website} onChange={set('website')} placeholder="www.company.com" />
            </div>
          </div>
        </Section>

        {/* Social */}
        <Section icon={Globe} title="Social Media" description="Optional links shown on invoices">
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { field: 'twitter', label: 'Twitter / X', placeholder: '@yourhandle' },
              { field: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/...' },
              { field: 'facebook', label: 'Facebook', placeholder: 'facebook.com/...' },
            ].map(({ field, label, placeholder }) => (
              <div key={field}>
                <label className={labelCls}>{label}</label>
                <input className={inputCls} value={form[field]} onChange={set(field)} placeholder={placeholder} />
              </div>
            ))}
          </div>
        </Section>

        {/* Invoice defaults */}
        <Section icon={CreditCard} title="Invoice Defaults" description="Pre-filled values when creating invoices">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Default Currency</label>
              <select className={inputCls} value={form.defaultCurrency} onChange={set('defaultCurrency')}>
                {currencies.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Default Tax (%)</label>
              <input type="number" className={inputCls} value={form.defaultTaxPercentage} onChange={set('defaultTaxPercentage')} min="0" max="100" step="0.5" />
            </div>
          </div>
        </Section>

        {/* Payment info */}
        <Section icon={CreditCard} title="Payment Information" description="Bank details shown on invoices">
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Bank Name</label>
              <input className={inputCls} value={form.bankName} onChange={set('bankName')} placeholder="First National Bank" />
            </div>
            <div>
              <label className={labelCls}>Account Name</label>
              <input className={inputCls} value={form.accountName} onChange={set('accountName')} placeholder="Acme Corp LLC" />
            </div>
            <div>
              <label className={labelCls}>Account Number</label>
              <input className={inputCls} value={form.accountNumber} onChange={set('accountNumber')} placeholder="1234567890" />
            </div>
          </div>
        </Section>

        {/* Reminders */}
        <Section icon={Bell} title="Email Reminders" description="Automatically email clients before invoices are due">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.reminderEnabled}
              onChange={set('reminderEnabled')}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <p className="text-sm font-medium text-gray-900">Enable payment reminders</p>
              <p className="text-xs text-gray-400 mt-0.5">
                A reminder email will be sent to the client's email address before the due date. Make sure to add the client's email when creating invoices.
              </p>
            </div>
          </label>

          {form.reminderEnabled && (
            <div className="pl-7">
              <label className={labelCls}>Days before due date</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  className="w-20 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.reminderDaysBefore}
                  onChange={set('reminderDaysBefore')}
                  min="1"
                  max="30"
                />
                <span className="text-sm text-gray-500">days before due date</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Reminders run daily at 8:00 AM server time. Only unpaid invoices with a client email will receive reminders.
              </p>
            </div>
          )}
        </Section>
      </div>
    </form>
  )
}
