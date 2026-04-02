import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import {
  Globe, Database, Check, Bell, AlertTriangle, CheckCircle2, Info,
  Building2, User, ChevronDown, X, Pencil,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '../lib/toast'
import { useSettings } from '../components/SettingsProvider'
import { companyProfileService } from '../services/api'
import { cn } from '../lib/utils'

const currencies = [
  { code: 'INR', name: 'Indian Rupee',        symbol: '₹'  },
  { code: 'USD', name: 'US Dollar',            symbol: '$'  },
  { code: 'EUR', name: 'Euro',                 symbol: '€'  },
  { code: 'GBP', name: 'British Pound',        symbol: '£'  },
  { code: 'JPY', name: 'Japanese Yen',         symbol: '¥'  },
  { code: 'AUD', name: 'Australian Dollar',    symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar',      symbol: 'C$' },
  { code: 'CHF', name: 'Swiss Franc',          symbol: 'CHF'},
  { code: 'CNY', name: 'Chinese Yuan',         symbol: '¥'  },
  { code: 'SEK', name: 'Swedish Krona',        symbol: 'kr' },
  { code: 'NZD', name: 'New Zealand Dollar',   symbol: 'NZ$'},
  { code: 'MXN', name: 'Mexican Peso',         symbol: '$'  },
  { code: 'SGD', name: 'Singapore Dollar',     symbol: 'S$' },
  { code: 'HKD', name: 'Hong Kong Dollar',     symbol: 'HK$'},
  { code: 'NOK', name: 'Norwegian Krone',      symbol: 'kr' },
  { code: 'KRW', name: 'South Korean Won',     symbol: '₩'  },
  { code: 'TRY', name: 'Turkish Lira',         symbol: '₺'  },
  { code: 'RUB', name: 'Russian Ruble',        symbol: '₽'  },
  { code: 'BRL', name: 'Brazilian Real',       symbol: 'R$' },
  { code: 'ZAR', name: 'South African Rand',   symbol: 'R'  },
]

const inputClass = 'w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors'
const labelClass = 'block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5'

// ── Searchable currency combobox ────────────────────────────────────────────
function CurrencyCombobox({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const selected = currencies.find(c => c.code === value)

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    if (!q) return currencies
    return currencies.filter(c =>
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.symbol.toLowerCase().includes(q)
    )
  }, [query])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleOpen = () => {
    setOpen(true)
    setQuery('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleSelect = (code: string) => {
    onChange(code)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className="w-full flex items-center justify-between px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors hover:border-accent brutal-focus"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select currency"
      >
        <span className="flex items-center gap-3">
          <span className="w-6 text-center font-bold text-base">{selected?.symbol}</span>
          <span>{selected?.code}</span>
          <span className="text-ink-light text-xs">{selected?.name}</span>
        </span>
        <ChevronDown className={cn('w-4 h-4 text-ink-light shrink-0 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 brutal-border bg-surface shadow-lg flex flex-col max-h-72 overflow-hidden">
          <div className="relative border-b border-line shrink-0">
            <input
              ref={inputRef}
              id="currency-search"
              name="currency-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search currency…"
              className="w-full pl-3 pr-8 py-2.5 bg-paper font-mono text-sm focus:outline-none border-0"
              aria-label="Search currencies"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:text-danger transition-colors"
                aria-label="Clear search">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="overflow-y-auto flex-1" role="listbox" aria-label="Currency options">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 font-mono text-sm text-ink-light">No currencies match</div>
            ) : filtered.map(curr => (
              <div
                key={curr.code}
                role="option"
                aria-selected={curr.code === value}
                onClick={() => handleSelect(curr.code)}
                className={cn(
                  'flex items-center justify-between px-4 py-2.5 cursor-pointer font-mono text-sm transition-colors',
                  curr.code === value ? 'bg-ink text-surface font-bold' : 'hover:bg-ink hover:text-surface'
                )}
              >
                <span className="flex items-center gap-3">
                  <span className="w-6 text-center font-bold">{curr.symbol}</span>
                  <span>{curr.code}</span>
                  <span className={cn('text-[11px] uppercase tracking-widest', curr.code === value ? 'text-surface/60' : 'text-ink-light')}>
                    {curr.name}
                  </span>
                </span>
                {curr.code === value && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shared modal shell ──────────────────────────────────────────────────────
function EditModal({ title, onClose, onSubmit, isPending, children }: {
  title: string
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  isPending?: boolean
  children: React.ReactNode
}) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/20 backdrop-blur-md">
      <div className="brutal-border bg-surface w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-line bg-ink text-surface shrink-0">
          <h2 className="font-display font-bold text-xl uppercase tracking-tighter">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-danger hover:text-paper transition-colors brutal-focus" aria-label="Close modal">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">{children}</div>
          <div className="border-t border-line p-5 flex gap-3 justify-end bg-paper shrink-0">
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 brutal-border font-mono text-sm uppercase tracking-wider hover:border-accent hover:text-accent transition-colors brutal-focus">
              Cancel
            </button>
            <button type="submit" disabled={isPending}
              className="px-5 py-2.5 bg-accent text-on-accent font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-accent-hover active:brutal-shadow-accent-active brutal-focus transition-all disabled:opacity-50">
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

// ── Read-only field ─────────────────────────────────────────────────────────
function ROField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-ink-light mb-0.5">{label}</div>
      <div className="font-mono text-sm text-ink">{value || <span className="opacity-40">—</span>}</div>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────
function SettingsPage() {
  const queryClient = useQueryClient()
  const {
    numberSystem, setNumberSystem, currency, setCurrency, formatCurrency,
    userName, setUserName, userDesignation, setUserDesignation, userPhone, setUserPhone,
  } = useSettings()

  // Modal visibility
  const [showUserModal, setShowUserModal] = useState(false)
  const [showCompanyModal, setShowCompanyModal] = useState(false)

  // ── User profile draft ──────────────────────────────────────────────────
  const [draftName, setDraftName] = useState(userName)
  const [draftDesig, setDraftDesig] = useState(userDesignation)
  const [draftPhone, setDraftPhone] = useState(userPhone)

  const openUserModal = () => {
    setDraftName(userName)
    setDraftDesig(userDesignation)
    setDraftPhone(userPhone)
    setShowUserModal(true)
  }

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draftName.trim()) { toast.error('Name is required.'); return }
    setUserName(draftName.trim())
    setUserDesignation(draftDesig.trim())
    setUserPhone(draftPhone.trim())
    setShowUserModal(false)
    toast.success('User profile updated.')
  }

  // ── Company profile ─────────────────────────────────────────────────────
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['company-profile'],
    queryFn: () => companyProfileService.get(),
  })

  const [companyForm, setCompanyForm] = useState({
    shop_name: '', shop_address: '', shop_phone: '', shop_gstin: '',
    default_tax_rate: '18', currency_symbol: '₹',
    receiver_bank_name: '', receiver_account_number: '', receiver_ifsc_code: '',
  })

  const openCompanyModal = () => {
    setCompanyForm({
      shop_name: profile?.shop_name || '',
      shop_address: profile?.shop_address || '',
      shop_phone: profile?.shop_phone || '',
      shop_gstin: profile?.shop_gstin || '',
      default_tax_rate: profile?.default_tax_rate?.toString() || '18',
      currency_symbol: profile?.currency_symbol || '₹',
      receiver_bank_name: profile?.receiver_bank_name || '',
      receiver_account_number: profile?.receiver_account_number || '',
      receiver_ifsc_code: profile?.receiver_ifsc_code || '',
    })
    setShowCompanyModal(true)
  }

  const upsertMutation = useMutation({
    mutationFn: (data: any) => profile ? companyProfileService.update(data) : companyProfileService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-profile'] })
      setShowCompanyModal(false)
      toast.success('Company profile saved.')
    },
    onError: () => toast.error('Failed to save company profile.'),
  })

  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyForm.shop_name.trim()) { toast.error('Shop name is required.'); return }
    upsertMutation.mutate({ ...companyForm, default_tax_rate: parseFloat(companyForm.default_tax_rate) })
  }

  const triggerPreview = (type: 'success' | 'error' | 'warning' | 'info') => {
    const messages = {
      success: 'Database synced perfectly.',
      error: 'Fatality. Connection dropped.',
      warning: 'Inventory dropping below limits.',
      info: 'New update patch is available.',
    }
    toast[type](messages[type])
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <header className="border-b border-line pb-6">
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="type-display">
          Settings
        </motion.h1>
        <p className="text-ink-light font-mono uppercase tracking-widest text-sm mt-2">Environment Configuration</p>
        <div className="w-16 h-0.5 bg-accent mt-4" />
      </header>

      {/* ── Row 1: Parsing + Currency ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Numerical Parsing Engine */}
        <div className="brutal-border bg-surface p-5">
          <h3 className="text-base font-display font-bold uppercase border-b border-line pb-3 mb-4 flex items-center gap-2">
            <Database className="w-4 h-4 text-accent" />
            Numerical Parsing Engine
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => { setNumberSystem('en-IN'); toast.success('Switched to Indian system.') }}
              className={cn('p-4 border text-left flex flex-col gap-1 brutal-focus transition-all',
                numberSystem === 'en-IN' ? 'border-accent bg-accent/5' : 'border-line bg-paper hover:border-ink brutal-shadow-hover')}
              aria-pressed={numberSystem === 'en-IN'}
            >
              <div className="flex justify-between items-center w-full">
                <span className="font-bold uppercase tracking-widest text-xs">Indian</span>
                {numberSystem === 'en-IN' && <Check className="w-4 h-4 text-accent shrink-0" />}
              </div>
              <span className="text-xl font-display font-bold">10,00,000</span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-ink-light">Lakh / Crore</span>
            </button>
            <button
              onClick={() => { setNumberSystem('en-US'); toast.success('Switched to global system.') }}
              className={cn('p-4 border text-left flex flex-col gap-1 brutal-focus transition-all',
                numberSystem === 'en-US' ? 'border-accent bg-accent/5' : 'border-line bg-paper hover:border-ink brutal-shadow-hover')}
              aria-pressed={numberSystem === 'en-US'}
            >
              <div className="flex justify-between items-center w-full">
                <span className="font-bold uppercase tracking-widest text-xs">Global</span>
                {numberSystem === 'en-US' && <Check className="w-4 h-4 text-accent shrink-0" />}
              </div>
              <span className="text-xl font-display font-bold">1,000,000</span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-ink-light">Million / Billion</span>
            </button>
          </div>
          <div className="p-3 border border-line bg-paper flex items-center gap-3">
            <span className="text-[10px] font-mono uppercase tracking-widest text-ink-light shrink-0">Preview</span>
            <span className="font-display font-bold text-lg">{formatCurrency(1000000)}</span>
          </div>
        </div>

        {/* Base Fiat Currency */}
        <div className="brutal-border bg-surface p-5">
          <h3 className="text-base font-display font-bold uppercase border-b border-line pb-3 mb-4 flex items-center gap-2">
            <Globe className="w-4 h-4 text-accent" />
            Base Fiat Currency
          </h3>
          <p className="font-mono text-xs text-ink-light mb-3 leading-relaxed">
            Currency symbol used as prefix across all monetary values.
          </p>
          <CurrencyCombobox
            value={currency}
            onChange={(code) => {
              setCurrency(code)
              const curr = currencies.find(c => c.code === code)
              toast.success(`Currency set to ${curr?.name ?? code}.`)
            }}
          />
        </div>
      </div>

      {/* ── Row 2: User Profile (read-only + pencil) ──────────────────────── */}
      <div className="brutal-border bg-surface p-5">
        <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
          <h3 className="text-base font-display font-bold uppercase flex items-center gap-2">
            <User className="w-4 h-4 text-accent" />
            User Profile
          </h3>
          <button
            onClick={openUserModal}
            className="p-2 brutal-border hover:bg-accent hover:text-on-accent hover:border-accent transition-colors brutal-focus"
            aria-label="Edit user profile"
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ROField label="Name" value={userName} />
          <ROField label="Designation" value={userDesignation} />
          <ROField label="Contact Number" value={userPhone} />
        </div>
      </div>

      {/* ── Row 3: Company Profile (read-only + pencil) ───────────────────── */}
      <div className="brutal-border bg-surface p-5">
        <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
          <h3 className="text-base font-display font-bold uppercase flex items-center gap-2">
            <Building2 className="w-4 h-4 text-accent" />
            Company Profile
          </h3>
          <button
            onClick={openCompanyModal}
            disabled={profileLoading}
            className="p-2 brutal-border hover:bg-accent hover:text-on-accent hover:border-accent transition-colors brutal-focus disabled:opacity-40"
            aria-label="Edit company profile"
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>

        {profileLoading ? (
          <p className="font-mono text-sm text-ink-light">Loading…</p>
        ) : profile ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="sm:col-span-2">
                <ROField label="Shop Name" value={profile.shop_name} />
              </div>
              <ROField label="Phone" value={profile.shop_phone} />
              <ROField label="GSTIN" value={profile.shop_gstin} />
              <div className="sm:col-span-2 lg:col-span-4">
                <ROField label="Address" value={profile.shop_address} />
              </div>
            </div>
            <div className="border-t border-line pt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <ROField label="Default Tax Rate" value={profile.default_tax_rate != null ? `${profile.default_tax_rate}%` : undefined} />
              <ROField label="Bank Name" value={profile.receiver_bank_name} />
              <ROField label="Account Number" value={profile.receiver_account_number} />
              <ROField label="IFSC Code" value={profile.receiver_ifsc_code} />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between py-2">
            <p className="font-mono text-sm text-ink-light">No company profile set up yet.</p>
            <button
              onClick={openCompanyModal}
              className="px-4 py-2 bg-accent text-on-accent font-mono text-xs uppercase tracking-wider brutal-border brutal-focus transition-all"
            >
              Create Profile
            </button>
          </div>
        )}
      </div>

      {/* ── Row 4: Toast Preview ──────────────────────────────────────────── */}
      <div className="brutal-border bg-surface p-5">
        <h3 className="text-base font-display font-bold uppercase border-b border-line pb-3 mb-4 flex items-center gap-2">
          <Bell className="w-4 h-4 text-accent" />
          UI Notification System
        </h3>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => triggerPreview('success')}
            className="brutal-border px-5 py-2.5 font-mono font-bold uppercase tracking-widest text-sm bg-success text-on-status hover:bg-surface hover:text-success transition-colors brutal-focus flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Success
          </button>
          <button onClick={() => triggerPreview('error')}
            className="brutal-border px-5 py-2.5 font-mono font-bold uppercase tracking-widest text-sm bg-danger text-on-status hover:bg-surface hover:text-danger transition-colors brutal-focus flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Error
          </button>
          <button onClick={() => triggerPreview('warning')}
            className="brutal-border px-5 py-2.5 font-mono font-bold uppercase tracking-widest text-sm bg-warning text-on-status hover:bg-surface hover:text-warning transition-colors brutal-focus flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Warning
          </button>
          <button onClick={() => triggerPreview('info')}
            className="brutal-border px-5 py-2.5 font-mono font-bold uppercase tracking-widest text-sm bg-accent text-on-accent hover:bg-surface hover:text-accent transition-colors brutal-focus flex items-center gap-2">
            <Info className="w-4 h-4" /> Info
          </button>
        </div>
      </div>

      {/* ── User Profile Modal ────────────────────────────────────────────── */}
      {showUserModal && (
        <EditModal title="Edit User Profile" onClose={() => setShowUserModal(false)} onSubmit={handleSaveUser}>
          <div>
            <label htmlFor="user-name" className={labelClass}>Name *</label>
            <input id="user-name" name="user_name" type="text" required
              value={draftName} onChange={(e) => setDraftName(e.target.value)}
              placeholder="Your name" className={inputClass} aria-required="true" autoFocus
            />
          </div>
          <div>
            <label htmlFor="user-designation" className={labelClass}>Designation</label>
            <input id="user-designation" name="user_designation" type="text"
              value={draftDesig} onChange={(e) => setDraftDesig(e.target.value)}
              placeholder="e.g. Admin, Manager" className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="user-phone" className={labelClass}>
              Contact Number <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <input id="user-phone" name="user_phone" type="tel"
              value={draftPhone} onChange={(e) => setDraftPhone(e.target.value)}
              placeholder="Phone number" className={inputClass}
            />
          </div>
        </EditModal>
      )}

      {/* ── Company Profile Modal ─────────────────────────────────────────── */}
      {showCompanyModal && (
        <EditModal
          title={profile ? 'Edit Company Profile' : 'Create Company Profile'}
          onClose={() => setShowCompanyModal(false)}
          onSubmit={handleSaveCompany}
          isPending={upsertMutation.isPending}
        >
          {/* Shop Info */}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light border-b border-line pb-1.5 mb-3">Shop Info</div>
            <div className="space-y-3">
              <div>
                <label htmlFor="shop-name" className={labelClass}>Shop Name *</label>
                <input id="shop-name" name="shop_name" type="text" required autoFocus
                  value={companyForm.shop_name}
                  onChange={(e) => setCompanyForm({ ...companyForm, shop_name: e.target.value })}
                  placeholder="Enter shop name" className={inputClass} aria-required="true"
                />
              </div>
              <div>
                <label htmlFor="shop-address" className={labelClass}>Address</label>
                <textarea id="shop-address" name="shop_address"
                  value={companyForm.shop_address}
                  onChange={(e) => setCompanyForm({ ...companyForm, shop_address: e.target.value })}
                  placeholder="Shop address" rows={2}
                  className="w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="shop-phone" className={labelClass}>Phone</label>
                  <input id="shop-phone" name="shop_phone" type="tel"
                    value={companyForm.shop_phone}
                    onChange={(e) => setCompanyForm({ ...companyForm, shop_phone: e.target.value })}
                    placeholder="+91 98765 43210" className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="shop-gstin" className={labelClass}>GSTIN</label>
                  <input id="shop-gstin" name="shop_gstin" type="text"
                    value={companyForm.shop_gstin}
                    onChange={(e) => setCompanyForm({ ...companyForm, shop_gstin: e.target.value })}
                    placeholder="GST number" className={inputClass}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light border-b border-line pb-1.5 mb-3">Pricing</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor="default-tax-rate" className={labelClass}>Default Tax Rate (%)</label>
                <input id="default-tax-rate" name="default_tax_rate" type="number" step="0.01" required
                  value={companyForm.default_tax_rate}
                  onChange={(e) => setCompanyForm({ ...companyForm, default_tax_rate: e.target.value })}
                  placeholder="18" className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Bank Details */}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light border-b border-line pb-1.5 mb-3">Bank Details</div>
            <div className="space-y-3">
              <div>
                <label htmlFor="bank-name" className={labelClass}>Bank Name</label>
                <input id="bank-name" name="receiver_bank_name" type="text"
                  value={companyForm.receiver_bank_name}
                  onChange={(e) => setCompanyForm({ ...companyForm, receiver_bank_name: e.target.value })}
                  placeholder="Bank name" className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="account-number" className={labelClass}>Account Number</label>
                  <input id="account-number" name="receiver_account_number" type="text"
                    value={companyForm.receiver_account_number}
                    onChange={(e) => setCompanyForm({ ...companyForm, receiver_account_number: e.target.value })}
                    placeholder="Account number" className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="ifsc-code" className={labelClass}>IFSC Code</label>
                  <input id="ifsc-code" name="receiver_ifsc_code" type="text"
                    value={companyForm.receiver_ifsc_code}
                    onChange={(e) => setCompanyForm({ ...companyForm, receiver_ifsc_code: e.target.value })}
                    placeholder="IFSC code" className={inputClass}
                  />
                </div>
              </div>
            </div>
          </div>
        </EditModal>
      )}
    </div>
  )
}

export default SettingsPage
