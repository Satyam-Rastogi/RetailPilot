import React, { createContext, useContext, useState, useEffect } from 'react'

type SettingsContextType = {
  numberSystem: 'en-IN' | 'en-US'
  setNumberSystem: (sys: 'en-IN' | 'en-US') => void
  currency: string
  setCurrency: (code: string) => void
  formatCurrency: (amount: number) => string
  formatCurrencyCompact: (amount: number) => string
  // User profile
  userName: string
  setUserName: (v: string) => void
  userDesignation: string
  setUserDesignation: (v: string) => void
  userPhone: string
  setUserPhone: (v: string) => void
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [numberSystem, setNumberSystem] = useState<'en-IN' | 'en-US'>('en-IN')
  const [currency, setCurrency] = useState<string>('INR')
  const [userName, setUserName] = useState('Shop Owner')
  const [userDesignation, setUserDesignation] = useState('Admin')
  const [userPhone, setUserPhone] = useState('')

  useEffect(() => {
    const savedSys = localStorage.getItem('retailpilot_number_sys')
    const savedCurr = localStorage.getItem('retailpilot_currency')
    const savedName = localStorage.getItem('retailpilot_user_name')
    const savedDesig = localStorage.getItem('retailpilot_user_designation')
    const savedPhone = localStorage.getItem('retailpilot_user_phone')
    if (savedSys === 'en-IN' || savedSys === 'en-US') setNumberSystem(savedSys)
    if (savedCurr) setCurrency(savedCurr)
    if (savedName) setUserName(savedName)
    if (savedDesig) setUserDesignation(savedDesig)
    if (savedPhone) setUserPhone(savedPhone)
  }, [])

  useEffect(() => { localStorage.setItem('retailpilot_number_sys', numberSystem) }, [numberSystem])
  useEffect(() => { localStorage.setItem('retailpilot_currency', currency) }, [currency])
  useEffect(() => { localStorage.setItem('retailpilot_user_name', userName) }, [userName])
  useEffect(() => { localStorage.setItem('retailpilot_user_designation', userDesignation) }, [userDesignation])
  useEffect(() => { localStorage.setItem('retailpilot_user_phone', userPhone) }, [userPhone])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(numberSystem, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount)

  const formatCurrencyCompact = (amount: number) =>
    new Intl.NumberFormat(numberSystem, {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount)

  return (
    <SettingsContext.Provider value={{
      numberSystem, setNumberSystem,
      currency, setCurrency,
      formatCurrency, formatCurrencyCompact,
      userName, setUserName,
      userDesignation, setUserDesignation,
      userPhone, setUserPhone,
    }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) throw new Error('useSettings must be used within a SettingsProvider')
  return context
}
