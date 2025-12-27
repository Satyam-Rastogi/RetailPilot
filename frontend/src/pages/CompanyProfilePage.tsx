import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { companyProfileService } from '../services/api'

function CompanyProfilePage() {
  const [showModal, setShowModal] = useState(false)
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
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    upsertMutation.mutate({
      ...formData,
      default_tax_rate: parseFloat(formData.default_tax_rate),
    })
  }

  return (
    <div className="page-container fade-in">
      <div className="section">
        <div className="section-inner slide-up">
          <header className="mb-12">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-5xl font-display font-bold gradient-text mb-2">
                  Company Profile
                </h1>
                <p className="text-xl text-slate-400 dark:text-slate-400 light:text-slate-600 font-medium">
                  Manage your shop settings and business details
                </p>
              </div>

              <button
                onClick={() => { resetForm(); setShowModal(true) }}
                className="btn btn-primary px-8 flex items-center gap-2"
              >
                <span className="text-xl">✏️</span>
                {profile ? 'Edit Profile' : 'Create Profile'}
              </button>
            </div>
          </header>

          {isLoading ? (
            <div className="text-center py-24 slide-up">
              <div className="text-6xl mb-4 animate-bounce">⏳</div>
              <p className="text-xl text-slate-400 dark:text-slate-400 light:text-slate-600">Loading profile...</p>
            </div>
          ) : profile ? (
            <div className="space-y-6 slide-up">
              <div className="card p-8 rounded-2xl">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.4)] float">
                    <span className="text-4xl">🏪</span>
                  </div>
                  <div>
                    <h2 className="text-3xl font-display font-bold gradient-text mb-1">
                      {profile.shop_name}
                    </h2>
                    <p className="text-slate-400 dark:text-slate-400 light:text-slate-600">
                      Your business details are configured
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="border-2 border-slate-700/50 rounded-xl p-6 bg-slate-800/30 dark:bg-slate-800/30 light:bg-slate-200/50">
                    <h3 className="text-lg font-semibold gradient-text mb-4 flex items-center gap-2">
                      <span className="text-xl">📍</span>
                      Shop Information
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm text-slate-500 dark:text-slate-500 light:text-slate-400 font-medium">Shop Address</label>
                        <p className="text-slate-200 dark:text-slate-200 light:text-slate-800">{profile.shop_address || 'Not set'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-slate-500 dark:text-slate-500 light:text-slate-400 font-medium">Phone Number</label>
                          <p className="text-slate-200 dark:text-slate-200 light:text-slate-800">{profile.shop_phone || 'Not set'}</p>
                        </div>
                        <div>
                          <label className="text-sm text-slate-500 dark:text-slate-500 light:text-slate-400 font-medium">GSTIN</label>
                          <p className="text-slate-200 dark:text-slate-200 light:text-slate-800">{profile.shop_gstin || 'Not set'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-2 border-slate-700/50 rounded-xl p-6 bg-slate-800/30 dark:bg-slate-800/30 light:bg-slate-200/50">
                    <h3 className="text-lg font-semibold gradient-text mb-4 flex items-center gap-2">
                      <span className="text-xl">💰</span>
                      Pricing Settings
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-slate-500 dark:text-slate-500 light:text-slate-400 font-medium">Default Tax Rate</label>
                        <p className="text-2xl font-display font-bold gradient-text">
                          {profile.default_tax_rate}%
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-500 light:text-slate-400 mt-1">
                          Default rate used for all invoices unless overridden
                        </p>
                      </div>
                      <div>
                        <label className="text-sm text-slate-500 dark:text-slate-500 light:text-slate-400 font-medium">Currency Symbol</label>
                        <p className="text-2xl font-display font-bold text-slate-200 dark:text-slate-200 light:text-slate-800">
                          {profile.currency_symbol}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border-2 border-slate-700/50 rounded-xl p-6 bg-slate-800/30 dark:bg-slate-800/30 light:bg-slate-200/50">
                    <h3 className="text-lg font-semibold gradient-text mb-4 flex items-center gap-2">
                      <span className="text-xl">🏦</span>
                      Bank Details (Receiver)
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm text-slate-500 dark:text-slate-500 light:text-slate-400 font-medium">Bank Name</label>
                        <p className="text-slate-200 dark:text-slate-200 light:text-slate-800">{profile.receiver_bank_name || 'Not set'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-slate-500 dark:text-slate-500 light:text-slate-400 font-medium">Account Number</label>
                          <p className="text-slate-200 dark:text-slate-200 light:text-slate-800">{profile.receiver_account_number || 'Not set'}</p>
                        </div>
                        <div>
                          <label className="text-sm text-slate-500 dark:text-slate-500 light:text-slate-400 font-medium">IFSC Code</label>
                          <p className="text-slate-200 dark:text-slate-200 light:text-slate-800">{profile.receiver_ifsc_code || 'Not set'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-24 slide-up card p-16 rounded-2xl">
              <div className="text-8xl mb-6">🏪</div>
              <h3 className="text-2xl font-display font-bold gradient-text mb-3">
                No Company Profile
              </h3>
              <p className="text-slate-400 dark:text-slate-400 light:text-slate-600 text-lg mb-6">
                Set up your company profile to get started
              </p>
              <button
                onClick={() => { resetForm(); setShowModal(true) }}
                className="btn btn-primary px-8"
              >
                Create Company Profile
              </button>
            </div>
          )}

          {showModal && (
            <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center z-50 fade-in">
              <div className="card card-dark p-10 rounded-3xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto scale-in shadow-[0_0_60px_rgba(0,0,0,0.6)]">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-3xl font-display font-bold gradient-text">
                    {profile ? 'Edit Company Profile' : 'Create Company Profile'}
                  </h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="w-10 h-10 rounded-lg bg-slate-800/50 hover:bg-red-500/20 border-2 border-slate-700/50 hover:border-red-500/50 text-slate-400 dark:text-slate-400 light:text-slate-600 hover:text-red-400 flex items-center justify-center transition-all duration-300"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold mb-3 text-slate-300 dark:text-slate-300 light:text-slate-700">
                      Shop Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.shop_name}
                      onChange={(e) => setFormData({ ...formData, shop_name: e.target.value })}
                      className="input"
                      placeholder="Enter shop name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-3 text-slate-300 dark:text-slate-300 light:text-slate-700">
                      Shop Address
                    </label>
                    <textarea
                      value={formData.shop_address}
                      onChange={(e) => setFormData({ ...formData, shop_address: e.target.value })}
                      className="input resize-none"
                      rows={3}
                      placeholder="Enter shop address"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold mb-3 text-slate-300 dark:text-slate-300 light:text-slate-700">
                        Phone Number
                      </label>
                      <input
                        type="text"
                        value={formData.shop_phone}
                        onChange={(e) => setFormData({ ...formData, shop_phone: e.target.value })}
                        className="input"
                        placeholder="+91 98765 43210"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-3 text-slate-300 dark:text-slate-300 light:text-slate-700">
                        GSTIN
                      </label>
                      <input
                        type="text"
                        value={formData.shop_gstin}
                        onChange={(e) => setFormData({ ...formData, shop_gstin: e.target.value })}
                        className="input"
                        placeholder="Enter GSTIN number"
                      />
                    </div>
                  </div>

                  <div className="border-2 border-slate-700/50 rounded-xl p-6 bg-slate-800/30 dark:bg-slate-800/30 light:bg-slate-200/50">
                    <h4 className="font-semibold text-slate-300 dark:text-slate-300 light:text-slate-700 mb-4 flex items-center gap-2">
                      <span className="text-xl">💰</span>
                      Pricing & Currency
                    </h4>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-400 dark:text-slate-400 light:text-slate-600">
                          Default Tax Rate (%) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={formData.default_tax_rate}
                          onChange={(e) => setFormData({ ...formData, default_tax_rate: e.target.value })}
                          className="input"
                          placeholder="18"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-400 dark:text-slate-400 light:text-slate-600">
                          Currency Symbol *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.currency_symbol}
                          onChange={(e) => setFormData({ ...formData, currency_symbol: e.target.value })}
                          className="input"
                          placeholder="₹"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-2 border-slate-700/50 rounded-xl p-6 bg-slate-800/30 dark:bg-slate-800/30 light:bg-slate-200/50">
                    <h4 className="font-semibold text-slate-300 dark:text-slate-300 light:text-slate-700 mb-4 flex items-center gap-2">
                      <span className="text-xl">🏦</span>
                      Bank Details (For Cheque Payments)
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm text-slate-500 dark:text-slate-500 light:text-slate-400 font-medium">Default Tax Rate (%) *</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={formData.default_tax_rate}
                          onChange={(e) => setFormData({ ...formData, default_tax_rate: e.target.value })}
                          className="input"
                          placeholder="18"
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-500 light:text-slate-400 mt-2">
                          This rate is used by default for all new invoices. You can override it per invoice when creating bills.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold mb-2 text-slate-400 dark:text-slate-400 light:text-slate-600">
                            Account Number
                          </label>
                          <input
                            type="text"
                            value={formData.receiver_account_number}
                            onChange={(e) => setFormData({ ...formData, receiver_account_number: e.target.value })}
                            className="input"
                            placeholder="Account number"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold mb-2 text-slate-400 dark:text-slate-400 light:text-slate-600">
                            IFSC Code
                          </label>
                          <input
                            type="text"
                            value={formData.receiver_ifsc_code}
                            onChange={(e) => setFormData({ ...formData, receiver_ifsc_code: e.target.value })}
                            className="input"
                            placeholder="IFSC code"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="btn btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={upsertMutation.isPending}
                      className="btn btn-primary flex-1"
                    >
                      {upsertMutation.isPending ? 'Saving...' : 'Save Profile'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CompanyProfilePage
