import re
from pydantic import BaseModel, ConfigDict, field_validator
from datetime import datetime
from typing import Optional

_GSTIN_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")


class SupplierBase(BaseModel):
  name: str
  contact_person: Optional[str] = None
  phone_number: Optional[str] = None
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
