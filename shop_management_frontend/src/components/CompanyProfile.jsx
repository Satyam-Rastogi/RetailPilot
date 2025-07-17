import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Save, Building2 } from 'lucide-react'

const API_BASE_URL = 'http://localhost:5000/api'

export default function CompanyProfile() {
  const [profile, setProfile] = useState({
    shop_name: '',
    shop_address: '',
    shop_phone: '',
    shop_gstin: '',
    default_tax_rate: 0.0,
    currency_symbol: '₹',
    receiver_bank_name: '',
    receiver_account_number: '',
    receiver_ifsc_code: '',
    upi_bank_name: '',
    upi_id: '',
    upi_account_number: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/company-profile`)
      const data = await response.json()
      setProfile(data)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching profile:', error)
      setMessage('Error loading profile')
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setProfile(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      const response = await fetch(`${API_BASE_URL}/company-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profile),
      })

      if (response.ok) {
        const updatedProfile = await response.json()
        setProfile(updatedProfile)
        setMessage('Profile saved successfully!')
        setTimeout(() => setMessage(''), 3000)
      } else {
        const errorData = await response.json()
        setMessage(`Error: ${errorData.error || 'Failed to save profile'}`)
      }
    } catch (error) {
      console.error('Error saving profile:', error)
      setMessage('Error saving profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-2 mb-6">
        <Building2 className="h-6 w-6" />
        <h1 className="text-3xl font-bold">Company Profile</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Enter your shop's basic details that will appear on invoices and bills.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shop_name">Shop Name *</Label>
                <Input
                  id="shop_name"
                  name="shop_name"
                  value={profile.shop_name}
                  onChange={handleInputChange}
                  placeholder="Enter shop name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shop_phone">Phone Number</Label>
                <Input
                  id="shop_phone"
                  name="shop_phone"
                  value={profile.shop_phone}
                  onChange={handleInputChange}
                  placeholder="Enter phone number"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shop_address">Address</Label>
              <Textarea
                id="shop_address"
                name="shop_address"
                value={profile.shop_address}
                onChange={handleInputChange}
                placeholder="Enter shop address"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shop_gstin">GSTIN</Label>
              <Input
                id="shop_gstin"
                name="shop_gstin"
                value={profile.shop_gstin}
                onChange={handleInputChange}
                placeholder="Enter GSTIN (optional)"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Settings</CardTitle>
            <CardDescription>
              Configure default settings for your shop management system.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="default_tax_rate">Default Tax Rate (%)</Label>
                <Input
                  id="default_tax_rate"
                  name="default_tax_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={profile.default_tax_rate}
                  onChange={handleInputChange}
                  placeholder="Enter tax rate"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency_symbol">Currency Symbol</Label>
                <Input
                  id="currency_symbol"
                  name="currency_symbol"
                  value={profile.currency_symbol}
                  onChange={handleInputChange}
                  placeholder="Enter currency symbol"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bank Details</CardTitle>
            <CardDescription>
              Optional bank details for receiving payments (will appear on invoices).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="receiver_bank_name">Bank Name</Label>
              <Input
                id="receiver_bank_name"
                name="receiver_bank_name"
                value={profile.receiver_bank_name}
                onChange={handleInputChange}
                placeholder="Enter bank name"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="receiver_account_number">Account Number</Label>
                <Input
                  id="receiver_account_number"
                  name="receiver_account_number"
                  value={profile.receiver_account_number}
                  onChange={handleInputChange}
                  placeholder="Enter account number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="receiver_ifsc_code">IFSC Code</Label>
                <Input
                  id="receiver_ifsc_code"
                  name="receiver_ifsc_code"
                  value={profile.receiver_ifsc_code}
                  onChange={handleInputChange}
                  placeholder="Enter IFSC code"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>UPI Details</CardTitle>
            <CardDescription>
              UPI payment details for receiving digital payments (will appear on invoices).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="upi_bank_name">UPI Bank Name</Label>
              <Input
                id="upi_bank_name"
                name="upi_bank_name"
                value={profile.upi_bank_name}
                onChange={handleInputChange}
                placeholder="Enter UPI bank name"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="upi_id">UPI ID</Label>
                <Input
                  id="upi_id"
                  name="upi_id"
                  value={profile.upi_id}
                  onChange={handleInputChange}
                  placeholder="Enter UPI ID (e.g., user@paytm)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="upi_account_number">UPI Account Number</Label>
                <Input
                  id="upi_account_number"
                  name="upi_account_number"
                  value={profile.upi_account_number}
                  onChange={handleInputChange}
                  placeholder="Enter account number linked to UPI"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <div>
            {message && (
              <p className={`text-sm ${message.includes('Error') ? 'text-destructive' : 'text-green-600'}`}>
                {message}
              </p>
            )}
          </div>
          <Button type="submit" disabled={saving} className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
        </div>
      </form>
    </div>
  )
}

