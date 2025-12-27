from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class Customer:
  id: Optional[int]
  name: str
  phone_number: Optional[str]
  address: Optional[str]
  gstin: Optional[str]
  customer_type: str
  notes: Optional[str]
  created_at: Optional[datetime] = None
  updated_at: Optional[datetime] = None
