import { forwardRef } from 'react'
import { formatCurrency, calculateSubtotal, formatDate } from '@/lib/utils'

// A4 dimensions at 96dpi: 794 x 1123px
const A4_W = 794
const A4_H = 1123

const InvoicePreview = forwardRef(function InvoicePreview(
  { clientName, clientEmail, clientAddress, invoiceNumber, issueDate, dueDate,
    items = [], taxPercentage = 0, notes, settings = {}, status, partialPercentage },
  ref
) {
  const subtotal = calculateSubtotal(items)
  const taxAmount = subtotal * (Number(taxPercentage) / 100)
  const total = subtotal + taxAmount
  const currency = settings.default_currency || settings.defaultCurrency || 'USD'

  const statusStyles = {
    paid:       { bg: '#dcfce7', color: '#166534', label: 'PAID' },
    unpaid:     { bg: '#fee2e2', color: '#991b1b', label: 'UNPAID' },
    pending:    { bg: '#fef9c3', color: '#854d0e', label: 'PENDING' },
    partial:    { bg: '#fff7ed', color: '#c2410c', label: `PARTIAL${partialPercentage ? ` (${partialPercentage}%)` : ''}` },
    failed:     { bg: '#fee2e2', color: '#7f1d1d', label: 'FAILED' },
    cancelled:  { bg: '#f3f4f6', color: '#374151', label: 'CANCELLED' },
    refunded:   { bg: '#ede9fe', color: '#5b21b6', label: 'REFUNDED' },
    expired:    { bg: '#fce7f3', color: '#9d174d', label: 'EXPIRED' },
    processing: { bg: '#dbeafe', color: '#1e40af', label: 'PROCESSING' },
    overdue:    { bg: '#fee2e2', color: '#991b1b', label: 'OVERDUE' },
  }
  const ss = status ? (statusStyles[status] || statusStyles.unpaid) : null

  return (
    <div
      ref={ref}
      style={{
        width: `${A4_W}px`,
        minHeight: `${A4_H}px`,
        backgroundColor: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      {/* Top accent bar */}
      <div style={{ height: '6px', background: 'linear-gradient(90deg, #1a1a2e 0%, #3b82f6 100%)' }} />

      <div style={{ display: 'flex', flex: 1 }}>
        {/* Left sidebar */}
        <div style={{
          width: '240px', flexShrink: 0,
          backgroundColor: '#1a1a2e', color: '#fff',
          padding: '36px 24px',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Logo */}
          {settings.company_logo || settings.companyLogo ? (
            <img
              src={settings.company_logo || settings.companyLogo}
              alt="logo"
              style={{ width: '88px', height: '88px', objectFit: 'contain', borderRadius: '10px', marginBottom: '18px', background: '#fff', padding: '4px' }}
            />
          ) : (
            <div style={{ width: '60px', height: '60px', backgroundColor: '#3b82f6', borderRadius: '10px', marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', fontWeight: 'bold' }}>
              {(settings.company_name || settings.companyName || 'C')[0].toUpperCase()}
            </div>
          )}

          <h2 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 2px' }}>
            {settings.company_name || settings.companyName || 'Your Company'}
          </h2>

          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '20px', lineHeight: '1.8' }}>
            {(settings.company_address || settings.companyAddress) && (
              <p style={{ whiteSpace: 'pre-line', margin: '0 0 8px' }}>{settings.company_address || settings.companyAddress}</p>
            )}
            {settings.phone && <p style={{ margin: '0 0 2px' }}>📞 {settings.phone}</p>}
            {(settings.email || settings.companyEmail) && <p style={{ margin: '0 0 2px' }}>✉ {settings.email || settings.companyEmail}</p>}
            {settings.website && <p style={{ margin: '0 0 2px' }}>🌐 {settings.website}</p>}
          </div>

          {/* Payment info */}
          {(settings.bank_name || settings.bankName) && (
            <div style={{ marginTop: '28px', fontSize: '11px', borderTop: '1px solid #334155', paddingTop: '20px' }}>
              <p style={{ color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '9px', marginBottom: '10px', fontWeight: '600' }}>Payment Info</p>
              <p style={{ color: '#e2e8f0', margin: '0 0 3px', fontWeight: '600' }}>{settings.bank_name || settings.bankName}</p>
              <p style={{ color: '#94a3b8', margin: '0 0 3px' }}>{settings.account_name || settings.accountName}</p>
              <p style={{ color: '#94a3b8', margin: 0 }}>{settings.account_number || settings.accountNumber}</p>
            </div>
          )}

          {/* Status stamp */}
          {ss && (
            <div style={{ marginTop: 'auto', paddingTop: '24px' }}>
              <div style={{
                background: ss.bg, color: ss.color,
                border: `2px solid ${ss.color}`,
                borderRadius: '6px', padding: '8px 12px',
                fontSize: '13px', fontWeight: '800',
                textAlign: 'center', letterSpacing: '0.1em',
                transform: 'rotate(-3deg)',
              }}>
                {ss.label}
              </div>
            </div>
          )}
        </div>

        {/* Right content */}
        <div style={{ flex: 1, padding: '36px 32px', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
            <div>
              <h1 style={{ fontSize: '36px', fontWeight: '900', color: '#1a1a2e', letterSpacing: '-0.03em', margin: 0 }}>INVOICE</h1>
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: '3px', margin: '3px 0 0' }}># {invoiceNumber}</p>
            </div>
            <div style={{ textAlign: 'right', fontSize: '12px', color: '#475569' }}>
              <div style={{ marginBottom: '5px' }}>
                <span style={{ color: '#94a3b8' }}>Issued: </span>
                <span style={{ fontWeight: '600' }}>{formatDate(issueDate)}</span>
              </div>
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '3px 10px', borderRadius: '4px', display: 'inline-block', fontWeight: '700', fontSize: '11px' }}>
                Due: {formatDate(dueDate)}
              </div>
            </div>
          </div>

          {/* Bill to */}
          <div style={{ marginBottom: '28px', background: '#f8fafc', borderRadius: '8px', padding: '16px 18px' }}>
            <p style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', margin: '0 0 8px', fontWeight: '600' }}>Bill To</p>
            <p style={{ fontSize: '16px', fontWeight: '700', color: '#1a1a2e', margin: '0 0 3px' }}>{clientName || '—'}</p>
            {clientEmail && <p style={{ fontSize: '12px', color: '#3b82f6', margin: '0 0 2px' }}>{clientEmail}</p>}
            {clientAddress && <p style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'pre-line', margin: '2px 0 0' }}>{clientAddress}</p>}
          </div>

          {/* Items table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '20px' }}>
            <thead>
              <tr style={{ backgroundColor: '#1a1a2e', color: '#fff' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '600', borderRadius: '6px 0 0 6px', fontSize: '11px', letterSpacing: '0.05em' }}>DESCRIPTION</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '600', fontSize: '11px' }}>RATE</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '600', fontSize: '11px' }}>QTY</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '600', borderRadius: '0 6px 6px 0', fontSize: '11px' }}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id || i} style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 14px', color: '#374151' }}>{item.description || '—'}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#374151' }}>{formatCurrency(item.rate, currency)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#374151' }}>{item.quantity}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '600', color: '#1a1a2e' }}>
                    {formatCurrency(Number(item.rate) * Number(item.quantity), currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ marginLeft: 'auto', width: '210px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', color: '#475569' }}>
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal, currency)}</span>
            </div>
            {Number(taxPercentage) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', color: '#475569' }}>
                <span>Tax ({taxPercentage}%)</span>
                <span>{formatCurrency(taxAmount, currency)}</span>
              </div>
            )}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '10px 14px', marginTop: '6px',
              background: 'linear-gradient(135deg, #1a1a2e 0%, #2d3a5e 100%)',
              color: '#fff', borderRadius: '8px', fontWeight: '700', fontSize: '14px'
            }}>
              <span>TOTAL</span>
              <span>{formatCurrency(total, currency)}</span>
            </div>
          </div>

          {/* Notes */}
          {notes && (
            <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #e2e8f0', fontSize: '11px', color: '#64748b' }}>
              <p style={{ fontWeight: '600', marginBottom: '5px', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '10px' }}>Notes</p>
              <p style={{ whiteSpace: 'pre-line', margin: 0, lineHeight: '1.6' }}>{notes}</p>
            </div>
          )}

          {/* Footer line */}
          <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '10px', color: '#cbd5e1' }}>
            Thank you for your business!
          </div>
        </div>
      </div>

      {/* Bottom accent */}
      <div style={{ height: '4px', background: 'linear-gradient(90deg, #3b82f6 0%, #1a1a2e 100%)' }} />
    </div>
  )
})

export default InvoicePreview
