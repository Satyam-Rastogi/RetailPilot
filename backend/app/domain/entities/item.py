from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class Item:
  id: Optional[int]
  item_name: str
  brand_name: str
  sku: Optional[str]
  material: Optional[str]
  purchase_price: Optional[float]
  selling_price_retail: float
  selling_price_wholesale: float
  current_stock_quantity: int
  unit_of_measurement: str
  low_stock_threshold: Optional[int]
  enable_low_stock_alert: bool
  created_at: Optional[datetime] = None
  updated_at: Optional[datetime] = None
