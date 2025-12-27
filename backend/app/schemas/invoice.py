from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import List, Optional


class InvoiceLineItemBase(BaseModel):
  item_id: int
  item_name: Optional[str] = None
  quantity: int
  price: float
  discount_amount: Optional[float] = None
  discount_type: Optional[str] = 'amount'
  total: float


class InvoiceLineItemCreate(InvoiceLineItemBase):
  pass


class InvoiceLineItem(InvoiceLineItemBase):
  model_config = ConfigDict(from_attributes=True, alias_generator=lambda x: x if x == 'item_id' else x)

  id: int
  invoice_id: int
  created_at: datetime
  updated_at: Optional[datetime] = None
  item_id: int = Field(alias='item_id')
  item_name: Optional[str] = None


class InlineCustomer(BaseModel):
  name: str
  phone_number: Optional[str] = None
  address: Optional[str] = None
  gstin: Optional[str] = None
  customer_type: Optional[str] = 'Retail'
  notes: Optional[str] = None


class InvoiceBase(BaseModel):
  invoice_number: Optional[str] = None
  invoice_date: datetime
  customer_id: Optional[int] = None
  discount_type: Optional[str] = 'amount'
  discount_amount: Optional[float] = None
  tax_rate: Optional[float] = None
  notes: Optional[str] = None


class InvoiceCreate(InvoiceBase):
  line_items: List[InvoiceLineItemCreate]
  new_customer: Optional[InlineCustomer] = None
