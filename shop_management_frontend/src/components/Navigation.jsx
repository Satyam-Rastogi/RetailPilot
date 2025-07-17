import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Users, Truck, Package, FileText, DollarSign, BarChart3, MessageCircle } from 'lucide-react'

export default function Navigation({ currentView, onViewChange }) {
  const menuItems = [
    { id: 'company-profile', label: 'Company Profile', icon: Building2 },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'suppliers', label: 'Suppliers', icon: Truck },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'bills', label: 'Bills & Invoices', icon: FileText },
    { id: 'payments', label: 'Payments', icon: DollarSign },
    { id: 'chat', label: 'AI Assistant', icon: MessageCircle },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 }
  ]

  return (
    <Card className="w-64 h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Shop Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon
          return (
            <Button
              key={item.id}
              variant={currentView === item.id ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => onViewChange(item.id)}
            >
              <Icon className="h-4 w-4 mr-2" />
              {item.label}
              {item.id === 'chat' && (
                <span className="ml-auto text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">
                  AI
                </span>
              )}
            </Button>
          )
        })}
      </CardContent>
    </Card>
  )
}
