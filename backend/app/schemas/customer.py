import re
from pydantic import BaseModel, ConfigDict, field_validator
from datetime import datetime
from typing import Optional

_GSTIN_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")


class CustomerBase(BaseModel):
  name: str
  phone_number: Optional[str] = None
  email: Optional[str] = None
  address: Optional[str] = None
  gstin: Optional[str] = None

  @field_validator("gstin", mode="before")
  @classmethod
  def validate_gstin(cls, v: Optional[str]) -> Optional[str]:
    if not v or v.strip() in ("", "N/A"):
      return v
    cleaned = v.strip().upper()
    if not _GSTIN_RE.match(cleaned):
      raise ValueError("Invalid GSTIN format. Expected: 22AAAAA0000A1Z5")
    return cleaned
  customer_type: Optional[str] = "Retail"
  credit_days: Optional[int] = 0
  credit_limit: Optional[float] = None
  price_markup_type: Optional[str] = None    # 'percent' | 'flat'
  price_markup_value: Optional[float] = None
  price_discount_type: Optional[str] = None  # 'percent' | 'flat'
  price_discount_value: Optional[float] = None
  notes: Optional[str] = None


class CustomerCreate(CustomerBase):
  pass


class CustomerUpdate(CustomerBase):
  pass


class Customer(CustomerBase):
  model_config = ConfigDict(from_attributes=True)

  id: int
  created_at: datetime
  updated_at: Optional[datetime] = None


class CustomerListResponse(BaseModel):
  model_config = ConfigDict(from_attributes=True)

  id: int
  name: str
  phone_number: Optional[str]
  customer_type: str
  credit_days: Optional[int] = None
  credit_limit: Optional[float] = None
  price_markup_type: Optional[str] = None
  price_markup_value: Optional[float] = None
  price_discount_type: Optional[str] = None
  price_discount_value: Optional[float] = None


class CustomerOutstandingResponse(BaseModel):
  model_config = ConfigDict(from_attributes=True)

  id: int
  name: str
  phone_number: Optional[str] = None
  customer_type: str
  total_outstanding: float
  overdue_amount: float
  overdue_invoice_count: int
  unpaid_invoice_count: int
  oldest_unpaid_date: Optional[datetime] = None
