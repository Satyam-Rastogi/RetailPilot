from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class Supplier:
  id: Optional[int]
  name: str
  contact_person: Optional[str]
  phone_number: Optional[str]
  address: Optional[str]
  gstin: Optional[str]
  supplier_bank_name: Optional[str]
  supplier_bank_account_number: Optional[str]
  supplier_bank_ifsc_code: Optional[str]
  notes: Optional[str]
  created_at: Optional[datetime] = None
  updated_at: Optional[datetime] = None
