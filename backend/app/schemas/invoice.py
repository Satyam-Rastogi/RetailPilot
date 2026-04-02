from pydantic import BaseModel, ConfigDict, Field, model_validator
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
  gst_rate: Optional[float] = None
  hsn_sac_code: Optional[str] = None


class InvoiceLineItemCreate(InvoiceLineItemBase):
  @model_validator(mode='after')
  def hsn_required_when_gst_set(self) -> 'InvoiceLineItemCreate':
    if self.gst_rate and self.gst_rate > 0 and not (self.hsn_sac_code or '').strip():
      raise ValueError(
        f"HSN/SAC code is required for items with a GST rate (item_id={self.item_id})"
      )
    return self


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
