from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import List, Optional


class ReturnLineItemCreate(BaseModel):
  item_id: int
  quantity_returned: int
  amount: float
  reason: Optional[str] = None


class ReturnLineItem(ReturnLineItemCreate):
  model_config = ConfigDict(from_attributes=True)

  id: int
  return_receipt_id: int


class ReturnReceiptBase(BaseModel):
  invoice_id: int
  return_date: datetime
  total_credit: float
  notes: Optional[str] = None


class ReturnReceiptCreate(ReturnReceiptBase):
  line_items: List[ReturnLineItemCreate]


class ReturnReceipt(ReturnReceiptBase):
  model_config = ConfigDict(from_attributes=True)

  id: int
  created_at: datetime
  updated_at: Optional[datetime] = None
  line_items: List[ReturnLineItem] = []
