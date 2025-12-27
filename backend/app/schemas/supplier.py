from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional


class SupplierBase(BaseModel):
  name: str
  contact_person: Optional[str] = None
  phone_number: Optional[str] = None
  address: Optional[str] = None
  gstin: Optional[str] = None
  supplier_bank_name: Optional[str] = None
  supplier_bank_account_number: Optional[str] = None
  supplier_bank_ifsc_code: Optional[str] = None
  notes: Optional[str] = None


class SupplierCreate(SupplierBase):
  pass


class SupplierUpdate(SupplierBase):
  pass


class Supplier(SupplierBase):
  model_config = ConfigDict(from_attributes=True)
  
  id: int
  created_at: datetime
  updated_at: Optional[datetime] = None


class SupplierListResponse(BaseModel):
  id: int
  name: str
  phone_number: Optional[str]
  gstin: Optional[str]
