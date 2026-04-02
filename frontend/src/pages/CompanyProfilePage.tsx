import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { companyProfileService } from '../services/api'
import { useModalKeyboard } from '../hooks/useModalKeyboard'

function CompanyProfilePage() {
  const [showModal, setShowModal] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  useModalKeyboard(showModal, () => setShowModal(false), modalRef)
  const [formData, setFormData] = useState({
    shop_name: '',
    shop_address: '',
    shop_phone: '',
    shop_gstin: '',
    default_tax_rate: '18',
    currency_symbol: '₹',
    receiver_bank_name: '',
    receiver_account_number: '',
    receiver_ifsc_code: '',
    upi_id: '',
  })

  const queryClient = useQueryClient()

  const { data: profile, isLoading } = useQuery({
    queryKey: ['company-profile'],
    queryFn: () => companyProfileService.get(),
  })

  const upsertMutation = useMutation({
    mutationFn: (data: any) => {
      if (profile) {
        return companyProfileService.update(data)
      }
      return companyProfileService.create(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-profile'] })
      setShowModal(false)
      resetForm()
    },
  })

  const resetForm = () => {
    setFormData({
      shop_name: '',
      shop_address: '',
      shop_phone: '',
      shop_gstin: '',
      default_tax_rate: '18',
      currency_symbol: '₹',
      receiver_bank_name: '',
      receiver_account_number: '',
      receiver_ifsc_code: '',
      upi_id: '',
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    upsertMutation.mutate({
      ...formData,
      default_tax_rate: parseFloat(formData.default_tax_rate),
    })
  }

  const openModal = () => {
    if (profile) {
      setFormData({
        shop_name: profile.shop_name || '',
        shop_address: profile.shop_address || '',
        shop_phone: profile.shop_phone || '',
        shop_gstin: profile.shop_gstin || '',
        default_tax_rate: profile.default_tax_rate?.toString() || '18',
        currency_symbol: profile.currency_symbol || '₹',
        receiver_bank_name: profile.receiver_bank_name || '',
        receiver_account_number: profile.receiver_account_number || '',
        receiver_ifsc_code: profile.receiver_ifsc_code || '',
        upi_id: profile.upi_id || '',
      })
    } else {
      resetForm()
    }
    setShowModal(true)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="type-heading">Company Profile</h1>
          <p className="text-ink-light font-mono text-xs uppercase tracking-widest mt-1">
            Manage your shop settings and business details
          </p>
        </div>
        <button
          onClick={openModal}
          className="px-5 py-2.5 bg-accent text-on-accent font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-accent-hover active:brutal-shadow-accent-active brutal-focus transition-all"
        >
          {profile ? 'Edit Profile' : 'Create Profile'}
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="brutal-border bg-surface p-16 text-center">
          <p className="font-mono text-sm uppercase tracking-widest text-ink-light">Loading profile...</p>
        </div>
      ) : profile ? (
        <div className="space-y-6">
          {/* Shop Name Banner */}
          <div className="brutal-border bg-ink text-surface px-6 py-5">
            <div className="font-mono text-[10px] uppercase tracking-widest text-surface/60 mb-1">Shop Name</div>
            <div className="font-display font-bold text-2xl uppercase">{profile.shop_name}</div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Shop Information */}
            <div className="brutal-border bg-surface p-6">
              <div className="font-display font-bold uppercase text-sm border-b border-line pb-2 mb-4">
                Shop Information
              </div>
              <div className="space-y-4">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1">Shop Address</div>
                  <div className="font-mono text-sm text-ink">{profile.shop_address || 'Not set'}</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1">Phone Number</div>
                    <div className="font-mono text-sm text-ink">{profile.shop_phone || 'Not set'}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1">GSTIN</div>
                    <div className="font-mono text-sm text-ink">{profile.shop_gstin || 'Not set'}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing Settings */}
            <div className="brutal-border bg-surface p-6">
              <div className="font-display font-bold uppercase text-sm border-b border-line pb-2 mb-4">
                Pricing Settings
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1">Default Tax Rate</div>
                  <div className="font-display font-bold text-3xl text-ink">{profile.default_tax_rate}%</div>
                  <div className="font-mono text-[10px] text-ink-light mt-1">Used for all invoices unless overridden</div>
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1">Currency Symbol</div>
                  <div className="font-display font-bold text-3xl text-ink">{profile.currency_symbol}</div>
                </div>
              </div>
            </div>

            {/* Bank Details */}
            <div className="brutal-border bg-surface p-6">
              <div className="font-display font-bold uppercase text-sm border-b border-line pb-2 mb-4">
                Bank Details (Receiver)
              </div>
              <div className="space-y-4">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1">Bank Name</div>
                  <div className="font-mono text-sm text-ink">{profile.receiver_bank_name || 'Not set'}</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1">Account Number</div>
                    <div className="font-mono text-sm text-ink">{profile.receiver_account_number || 'Not set'}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1">IFSC Code</div>
                    <div className="font-mono text-sm text-ink">{profile.receiver_ifsc_code || 'Not set'}</div>
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-ink-light mb-1">UPI ID</div>
                  <div className="font-mono text-sm text-ink">{profile.upi_id || 'Not set'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="brutal-border bg-surface p-16 text-center">
          <p className="font-mono text-sm uppercase tracking-widest text-ink-light mb-2">No Company Profile</p>
          <p className="font-mono text-xs text-ink-light mb-6">Set up your company profile to get started</p>
          <button
            onClick={() => { resetForm(); setShowModal(true) }}
            className="px-5 py-2.5 bg-accent text-on-accent font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-accent-hover active:brutal-shadow-accent-active brutal-focus transition-all"
          >
            Create Company Profile
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/20 backdrop-blur-md" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div ref={modalRef} className="brutal-border bg-surface w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-line bg-ink text-surface shrink-0">
              <h2 className="font-display font-bold text-xl uppercase">
                {profile ? 'Edit Company Profile' : 'Create Company Profile'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-danger transition-colors brutal-focus"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Basic Info Section */}
                <div>
                  <div className="font-display font-bold uppercase text-sm border-b border-line pb-2 mb-4">
                    Basic Info
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">
                        Shop Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.shop_name}
                        onChange={(e) => setFormData({ ...formData, shop_name: e.target.value })}
                        placeholder="Enter shop name"
                        className="w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">
                        Shop Address
                      </label>
                      <textarea
                        value={formData.shop_address}
                        onChange={(e) => setFormData({ ...formData, shop_address: e.target.value })}
                        placeholder="Enter shop address"
                        rows={3}
                        className="w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">
                          Phone Number
                        </label>
                        <input
                          type="text"
                          value={formData.shop_phone}
                          onChange={(e) => setFormData({ ...formData, shop_phone: e.target.value })}
                          placeholder="+91 98765 43210"
                          className="w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">
                          GSTIN
                        </label>
                        <input
                          type="text"
                          value={formData.shop_gstin}
                          onChange={(e) => setFormData({ ...formData, shop_gstin: e.target.value })}
                          placeholder="Enter GSTIN number"
                          className="w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">
                          Default Tax Rate (%) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={formData.default_tax_rate}
                          onChange={(e) => setFormData({ ...formData, default_tax_rate: e.target.value })}
                          placeholder="18"
                          className="w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">
                          Currency Symbol *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.currency_symbol}
                          onChange={(e) => setFormData({ ...formData, currency_symbol: e.target.value })}
                          placeholder="₹"
                          className="w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bank Details Section */}
                <div>
                  <div className="font-display font-bold uppercase text-sm border-b border-line pb-2 mb-4">
                    Bank Details
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">
                        Bank Name
                      </label>
                      <input
                        type="text"
                        value={formData.receiver_bank_name}
                        onChange={(e) => setFormData({ ...formData, receiver_bank_name: e.target.value })}
                        placeholder="Bank name"
                        className="w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">
                          Account Number
                        </label>
                        <input
                          type="text"
                          value={formData.receiver_account_number}
                          onChange={(e) => setFormData({ ...formData, receiver_account_number: e.target.value })}
                          placeholder="Account number"
                          className="w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">
                          IFSC Code
                        </label>
                        <input
                          type="text"
                          value={formData.receiver_ifsc_code}
                          onChange={(e) => setFormData({ ...formData, receiver_ifsc_code: e.target.value })}
                          placeholder="IFSC code"
                          className="w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-light mb-1.5">
                        UPI ID
                      </label>
                      <input
                        type="text"
                        value={formData.upi_id}
                        onChange={(e) => setFormData({ ...formData, upi_id: e.target.value })}
                        placeholder="e.g., shopname@upi"
                        className="w-full px-3 py-2.5 brutal-border bg-paper text-ink font-mono text-sm focus:outline-none focus:border-accent transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-line p-5 flex gap-3 justify-end bg-paper shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 brutal-border font-mono text-sm uppercase tracking-wider hover:border-accent hover:text-accent transition-colors brutal-focus"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={upsertMutation.isPending}
                  className="px-5 py-2.5 bg-accent text-on-accent font-mono text-sm uppercase tracking-wider brutal-border brutal-shadow brutal-shadow-accent-hover active:brutal-shadow-accent-active brutal-focus transition-all disabled:opacity-50"
                >
                  {upsertMutation.isPending ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default CompanyProfilePage
