from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional


class ItemBase(BaseModel):
  item_name: str
  brand_name: str
  sku: Optional[str] = None
  material: Optional[str] = None
  purchase_price: Optional[float] = None
  selling_price_retail: float
  selling_price_wholesale: float
  current_stock_quantity: Optional[int] = 0
  unit_of_measurement: Optional[str] = "Pcs"
  low_stock_threshold: Optional[int] = None
  enable_low_stock_alert: Optional[bool] = False


class ItemCreate(ItemBase):
  pass


class ItemUpdate(ItemBase):
  pass


class Item(ItemBase):
  model_config = ConfigDict(from_attributes=True)
  
  id: int
  created_at: datetime
  updated_at: Optional[datetime] = None


class ItemListResponse(BaseModel):
  id: int
  item_name: str
  brand_name: str
  sku: Optional[str]
  current_stock_quantity: int
  selling_price_retail: float
  selling_price_wholesale: float
  enable_low_stock_alert: bool
  low_stock_threshold: Optional[int]
  is_low_stock: Optional[bool] = False
