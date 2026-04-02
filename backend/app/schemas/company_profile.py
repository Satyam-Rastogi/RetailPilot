import re
from pydantic import BaseModel, ConfigDict, field_validator
from datetime import datetime
from typing import Optional

_GSTIN_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")


class CompanyProfileBase(BaseModel):
  shop_name: str
  shop_address: Optional[str] = None
  shop_phone: Optional[str] = None
  shop_gstin: Optional[str] = None

  @field_validator("shop_gstin", mode="before")
  @classmethod
  def validate_gstin(cls, v: Optional[str]) -> Optional[str]:
    if not v or v.strip() in ("", "N/A"):
      return v
    cleaned = v.strip().upper()
    if not _GSTIN_RE.match(cleaned):
      raise ValueError("Invalid GSTIN format. Expected: 22AAAAA0000A1Z5")
    return cleaned
  default_tax_rate: float
  currency_symbol: str
  receiver_bank_name: Optional[str] = None
  receiver_account_number: Optional[str] = None
  receiver_ifsc_code: Optional[str] = None
  upi_id: Optional[str] = None


class CompanyProfileCreate(CompanyProfileBase):
  pass


class CompanyProfileUpdate(CompanyProfileBase):
  pass


class CompanyProfile(CompanyProfileBase):
  model_config = ConfigDict(from_attributes=True)
  
  id: int
  created_at: datetime
  updated_at: Optional[datetime] = None
