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

  // Social media links
  const twitter  = settings.twitter  || settings.companyTwitter  || ''
  const linkedin = settings.linkedin || settings.companyLinkedin || ''
  const facebook = settings.facebook || settings.companyFacebook || ''
  const hasSocial = twitter || linkedin || facebook

  const statusStyles = {
    paid:             { bg: '#dcfce7', color: '#166534', label: 'PAID' },
    unpaid:           { bg: '#fee2e2', color: '#991b1b', label: 'UNPAID' },
    pending:          { bg: '#fef9c3', color: '#854d0e', label: 'PENDING' },
    pending_payment:  { bg: '#fef3c7', color: '#92400e', label: 'PENDING PAYMENT' },
    partial:          { bg: '#fff7ed', color: '#c2410c', label: `PARTIAL${partialPercentage ? ` (${partialPercentage}%)` : ''}` },
    failed:           { bg: '#fee2e2', color: '#7f1d1d', label: 'FAILED' },
    cancelled:        { bg: '#f3f4f6', color: '#374151', label: 'CANCELLED' },
    refunded:         { bg: '#ede9fe', color: '#5b21b6', label: 'REFUNDED' },
    expired:          { bg: '#fce7f3', color: '#9d174d', label: 'EXPIRED' },
    processing:       { bg: '#dbeafe', color: '#1e40af', label: 'PROCESSING' },
    overdue:          { bg: '#fee2e2', color: '#991b1b', label: 'OVERDUE' },
  }
  const ss = status ? (statusStyles[status] || statusStyles.unpaid) : null

  // Logo: display cleanly without white bg box
  const logoSrc = settings.company_logo || settings.companyLogo || ''

  return (
    <div
      ref={ref}
      style={{
        width: `${A4_W}px`,
        minHeight: `${A4_H}px`,
        backgroundColor: '#ffffff',
        fontFamily: "'Arial', 'Helvetica Neue', Helvetica, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* Top accent bar */}
      <div style={{ height: '6px', background: 'linear-gradient(90deg, #1a1a2e 0%, #3b82f6 100%)', flexShrink: 0 }} />

      <div style={{ display: 'flex', flex: 1 }}>
        {/* ── Left sidebar ── */}
        <div style={{
          width: '230px', flexShrink: 0,
          backgroundColor: '#1a1a2e', color: '#fff',
          padding: '32px 22px',
          display: 'flex', flexDirection: 'column',
          gap: 0,
        }}>
          {/* Logo — no white box, transparent bg, clean display */}
          {logoSrc ? (
            <div style={{ marginBottom: '18px' }}>
              <img
                src={logoSrc}
                alt="logo"
                style={{
                  width: '100px',
                  height: 'auto',
                  maxHeight: '100px',
                  display: 'block',
                }}
                onError={(e) => { e.target.style.display = 'none' }}
              />
            </div>
          ) : (
            /* Initials avatar — clean, no white box */
            <div style={{
              width: '56px', height: '56px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              borderRadius: '12px', marginBottom: '18px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '24px', fontWeight: '800', color: '#fff',
              letterSpacing: '-0.02em',
              boxShadow: '0 4px 12px rgba(59,130,246,0.4)',
            }}>
              {(settings.company_name || settings.companyName || 'C')[0].toUpperCase()}
            </div>
          )}

          <h2 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 2px', lineHeight: '1.3', color: '#fff' }}>
            {settings.company_name || settings.companyName || 'Your Company'}
          </h2>

          {/* Company details */}
          <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '16px', lineHeight: '1.75' }}>
            {(settings.company_address || settings.companyAddress) && (
              <div style={{ whiteSpace: 'pre-line', marginBottom: '8px' }}>{settings.company_address || settings.companyAddress}</div>
            )}
            {settings.phone && (
              <div style={{ marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '9px' }}>📞</span> {settings.phone}
              </div>
            )}
            {(settings.email || settings.companyEmail) && (
              <div style={{ marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '9px' }}>✉</span> {settings.email || settings.companyEmail}
              </div>
            )}
            {settings.website && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '9px' }}>🌐</span> {settings.website}
              </div>
            )}
          </div>

          {/* Social media */}
          {hasSocial && (
            <div style={{ marginTop: '14px', fontSize: '10px', color: '#64748b', lineHeight: '1.8' }}>
              <div style={{ height: '1px', background: '#1e2d47', marginBottom: '12px' }} />
              {twitter && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#7dd3fc', marginBottom: '2px' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.254 5.622L18.244 2.25z"/>
                  </svg>
                  <span>{twitter}</span>
                </div>
              )}
              {linkedin && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#7dd3fc', marginBottom: '2px' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  <span>{linkedin}</span>
                </div>
              )}
              {facebook && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#7dd3fc', marginBottom: '2px' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  <span>{facebook}</span>
                </div>
              )}
            </div>
          )}

          {/* Payment info */}
          {(settings.bank_name || settings.bankName) && (
            <div style={{ marginTop: '20px', fontSize: '10.5px' }}>
              <div style={{ height: '1px', background: '#1e2d47', marginBottom: '14px' }} />
              <div style={{ color: '#475569', textTransform: 'uppercase', letterSpacing: '0.09em', fontSize: '8.5px', marginBottom: '8px', fontWeight: '700' }}>
                Payment Info
              </div>
              <div style={{ color: '#e2e8f0', marginBottom: '3px', fontWeight: '600' }}>{settings.bank_name || settings.bankName}</div>
              <div style={{ color: '#94a3b8', marginBottom: '2px' }}>{settings.account_name || settings.accountName}</div>
              <div style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '10px' }}>{settings.account_number || settings.accountNumber}</div>
            </div>
          )}

          {/* Status stamp */}
          {ss && (
            <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
              <div style={{
                background: ss.bg, color: ss.color,
                border: `2px solid ${ss.color}`,
                borderRadius: '6px', padding: '7px 10px',
                fontSize: '11px', fontWeight: '800',
                textAlign: 'center', letterSpacing: '0.12em',
                transform: 'rotate(-4deg)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}>
                {ss.label}
              </div>
            </div>
          )}
        </div>

        {/* ── Right content ── */}
        <div style={{ flex: 1, padding: '32px 28px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '26px' }}>
            <div>
              <h1 style={{ fontSize: '34px', fontWeight: '900', color: '#1a1a2e', letterSpacing: '-0.03em', margin: 0, lineHeight: 1 }}>INVOICE</h1>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0', fontWeight: '500' }}>#{invoiceNumber}</p>
            </div>
            <div style={{ textAlign: 'right', fontSize: '11px', color: '#475569' }}>
              <div style={{ marginBottom: '5px' }}>
                <span style={{ color: '#94a3b8' }}>Issued: </span>
                <span style={{ fontWeight: '600', color: '#374151' }}>{formatDate(issueDate)}</span>
              </div>
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '3px 10px', borderRadius: '4px', display: 'inline-block', fontWeight: '700', fontSize: '10px', letterSpacing: '0.02em' }}>
                Due: {formatDate(dueDate)}
              </div>
            </div>
          </div>

          {/* Bill to */}
          <div style={{ marginBottom: '22px', background: '#f8fafc', borderRadius: '8px', padding: '14px 16px', border: '1px solid #e2e8f0' }}>
            <p style={{ fontSize: '8.5px', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', margin: '0 0 7px', fontWeight: '700' }}>Bill To</p>
            <p style={{ fontSize: '15px', fontWeight: '700', color: '#1a1a2e', margin: '0 0 3px' }}>{clientName || '—'}</p>
            {clientEmail && <p style={{ fontSize: '11px', color: '#3b82f6', margin: '0 0 2px' }}>{clientEmail}</p>}
            {clientAddress && <p style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'pre-line', margin: '2px 0 0', lineHeight: '1.5' }}>{clientAddress}</p>}
          </div>

          {/* Items table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', marginBottom: '18px' }}>
            <thead>
              <tr style={{ backgroundColor: '#1a1a2e', color: '#fff' }}>
                <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: '600', borderRadius: '5px 0 0 5px', fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Description</th>
                <th style={{ padding: '9px 12px', textAlign: 'right', fontWeight: '600', fontSize: '10px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Rate</th>
                <th style={{ padding: '9px 12px', textAlign: 'right', fontWeight: '600', fontSize: '10px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Qty</th>
                <th style={{ padding: '9px 12px', textAlign: 'right', fontWeight: '600', borderRadius: '0 5px 5px 0', fontSize: '10px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id || i} style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '9px 12px', color: '#374151', lineHeight: '1.4' }}>{item.description || '—'}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: '#374151' }}>{formatCurrency(item.rate, currency)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: '#374151' }}>{item.quantity}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: '600', color: '#1a1a2e' }}>
                    {formatCurrency(Number(item.rate) * Number(item.quantity), currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ marginLeft: 'auto', width: '200px', fontSize: '11.5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#475569' }}>
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal, currency)}</span>
            </div>
            {Number(taxPercentage) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#475569' }}>
                <span>Tax ({taxPercentage}%)</span>
                <span>{formatCurrency(taxAmount, currency)}</span>
              </div>
            )}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '9px 12px', marginTop: '5px',
              background: 'linear-gradient(135deg, #1a1a2e 0%, #2d3a5e 100%)',
              color: '#fff', borderRadius: '7px', fontWeight: '700', fontSize: '13px',
              boxShadow: '0 2px 8px rgba(26,26,46,0.25)',
            }}>
              <span>TOTAL</span>
              <span>{formatCurrency(total, currency)}</span>
            </div>
          </div>

          {/* Notes */}
          {notes && (
            <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #e2e8f0', fontSize: '10.5px', color: '#64748b' }}>
              <p style={{ fontWeight: '700', marginBottom: '4px', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: '9px' }}>Notes</p>
              <p style={{ whiteSpace: 'pre-line', margin: 0, lineHeight: '1.6' }}>{notes}</p>
            </div>
          )}

          {/* Footer */}
          <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '9.5px', color: '#cbd5e1', letterSpacing: '0.05em' }}>
            Thank you for your business!
          </div>
        </div>
      </div>

      {/* Bottom accent */}
      <div style={{ height: '4px', background: 'linear-gradient(90deg, #3b82f6 0%, #1a1a2e 100%)', flexShrink: 0 }} />
    </div>
  )
})

export default InvoicePreview
