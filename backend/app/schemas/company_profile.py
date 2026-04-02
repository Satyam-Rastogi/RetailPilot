from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional


class CompanyProfileBase(BaseModel):
  shop_name: str
  shop_address: Optional[str] = None
  shop_phone: Optional[str] = None
  shop_gstin: Optional[str] = None
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
