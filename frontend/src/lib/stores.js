import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from './api'

// ─── Auth Store ──────────────────────────────────────────────────────────────
export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true })
        try {
          const { data } = await api.post('/auth/login', { email, password })
          localStorage.setItem('invoice_token', data.token)
          localStorage.setItem('invoice_user', JSON.stringify(data.user))
          set({ user: data.user, token: data.token, isLoading: false })
          return { success: true }
        } catch (err) {
          set({ isLoading: false })
          return { success: false, error: err.response?.data?.error || 'Login failed' }
        }
      },

      register: async (name, email, password) => {
        set({ isLoading: true })
        try {
          const { data } = await api.post('/auth/register', { name, email, password })
          localStorage.setItem('invoice_token', data.token)
          localStorage.setItem('invoice_user', JSON.stringify(data.user))
          set({ user: data.user, token: data.token, isLoading: false })
          return { success: true }
        } catch (err) {
          set({ isLoading: false })
          return { success: false, error: err.response?.data?.error || 'Registration failed' }
        }
      },

      logout: () => {
        localStorage.removeItem('invoice_token')
        localStorage.removeItem('invoice_user')
        set({ user: null, token: null })
      },

      isAuthenticated: () => !!get().token,
    }),
    {
      name: 'invoice-auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
)

// ─── Invoice Store ────────────────────────────────────────────────────────────
export const useInvoiceStore = create((set, get) => ({
  invoices: [],
  isLoading: false,
  error: null,

  fetchInvoices: async () => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await api.get('/invoices')
      set({ invoices: data.invoices, isLoading: false })
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to fetch invoices', isLoading: false })
    }
  },

  createInvoice: async (invoiceData) => {
    try {
      const { data } = await api.post('/invoices', invoiceData)
      set((state) => ({ invoices: [data.invoice, ...state.invoices] }))
      return { success: true, invoice: data.invoice }
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Failed to create invoice' }
    }
  },

  updateInvoice: async (id, invoiceData) => {
    try {
      const { data } = await api.put(`/invoices/${id}`, invoiceData)
      set((state) => ({
        invoices: state.invoices.map((inv) => (inv.id === id ? { ...inv, ...data.invoice } : inv)),
      }))
      return { success: true, invoice: data.invoice }
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Failed to update invoice' }
    }
  },

  updateStatus: async (id, status, partialPercentage) => {
    try {
      const { data } = await api.patch(`/invoices/${id}/status`, { status, partialPercentage })
      set((state) => ({
        invoices: state.invoices.map((inv) => (inv.id === id ? { ...inv, ...data.invoice } : inv)),
      }))
      return { success: true }
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Failed to update status' }
    }
  },

  duplicateInvoice: async (id) => {
    try {
      const { data } = await api.post(`/invoices/${id}/duplicate`)
      set((state) => ({ invoices: [data.invoice, ...state.invoices] }))
      return { success: true, invoice: data.invoice }
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Failed to duplicate invoice' }
    }
  },

  deleteInvoice: async (id) => {
    try {
      await api.delete(`/invoices/${id}`)
      set((state) => ({ invoices: state.invoices.filter((inv) => inv.id !== id) }))
      return { success: true }
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Failed to delete invoice' }
    }
  },

  getInvoiceById: (id) => get().invoices.find((inv) => inv.id === id) || null,
}))

// ─── Settings Store ───────────────────────────────────────────────────────────
export const useSettingsStore = create((set) => ({
  settings: {
    company_name: 'Your Company',
    company_logo: '',
    company_address: '',
    phone: '',
    email: '',
    website: '',
    twitter: '',
    linkedin: '',
    facebook: '',
    default_currency: 'USD',
    default_tax_percentage: 10,
    bank_name: '',
    account_name: '',
    account_number: '',
    reminder_enabled: false,
    reminder_days_before: 3,
  },
  isLoading: false,

  fetchSettings: async () => {
    set({ isLoading: true })
    try {
      const { data } = await api.get('/settings')
      set({ settings: data.settings, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  saveSettings: async (settingsData) => {
    set({ isLoading: true })
    try {
      const { data } = await api.put('/settings', settingsData)
      set({ settings: data.settings, isLoading: false })
      return { success: true }
    } catch (err) {
      set({ isLoading: false })
      return { success: false, error: err.response?.data?.error || 'Failed to save settings' }
    }
  },
}))
