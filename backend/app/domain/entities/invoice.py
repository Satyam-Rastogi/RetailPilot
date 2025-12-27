from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional


@dataclass
class InvoiceLineItem:
  id: Optional[int] = None
  item_id: int
  item_name: Optional[str] = None
  quantity: int
  price: float
  discount_amount: Optional[float] = None
  discount_type: Optional[str] = None
  created_at: Optional[datetime] = None
  updated_at: Optional[datetime] = None


@dataclass
class Invoice:
  id: Optional[int] = None
  invoice_number: str
  invoice_date: datetime
  customer_id: int
  line_items: List[InvoiceLineItem]
  discount_type: Optional[str] = None
  discount_amount: Optional[float] = None
  tax_rate: float
  sub_total: Optional[float] = None
  total_tax_amount: Optional[float] = None
  grand_total: Optional[float] = None
  amount_paid: Optional[float] = None
  payment_status: str
  notes: Optional[str] = None
  created_at: Optional[datetime] = None
  updated_at: Optional[datetime] = None
