from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class CompanyProfile:
  id: Optional[int]
  shop_name: str
  shop_address: Optional[str]
  shop_phone: Optional[str]
  shop_gstin: Optional[str]
  default_tax_rate: float
  currency_symbol: str
  receiver_bank_name: Optional[str]
  receiver_account_number: Optional[str]
  receiver_ifsc_code: Optional[str]
  created_at: Optional[datetime] = None
  updated_at: Optional[datetime] = None
