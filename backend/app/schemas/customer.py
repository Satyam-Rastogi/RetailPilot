from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional


class CustomerBase(BaseModel):
  name: str
  phone_number: Optional[str] = None
  email: Optional[str] = None
  address: Optional[str] = None
  gstin: Optional[str] = None
  customer_type: Optional[str] = "Retail"
  credit_days: Optional[int] = 0
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
  id: int
  name: str
  phone_number: Optional[str]
  customer_type: str
  credit_days: Optional[int] = None
