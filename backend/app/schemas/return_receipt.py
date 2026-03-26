from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import List, Optional
from app.models.return_receipt import ReturnReasonCategory


class ReturnLineItemCreate(BaseModel):
    item_id: int
    quantity_returned: int
    amount: float
    reason: Optional[str] = None
    reason_category: Optional[ReturnReasonCategory] = None


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
    is_partial: bool
    total_items_in_invoice: int
    items_returned_count: int


class ReturnReceipt(ReturnReceiptBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_partial: bool
    total_items_in_invoice: int
    items_returned_count: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    line_items: List[ReturnLineItem] = []
