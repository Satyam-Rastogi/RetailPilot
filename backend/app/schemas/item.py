from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List


# ── Variant schemas ────────────────────────────────────────────────────────────

class ItemVariantCreate(BaseModel):
  variant_value: str
  sku: Optional[str] = None
  stock_quantity: Optional[int] = 0
  price_override: Optional[float] = None
  low_stock_threshold: Optional[int] = None


class ItemVariantUpdate(BaseModel):
  variant_value: Optional[str] = None
  sku: Optional[str] = None
  stock_quantity: Optional[int] = None
  price_override: Optional[float] = None
  low_stock_threshold: Optional[int] = None


class ItemVariantResponse(BaseModel):
  model_config = ConfigDict(from_attributes=True)

  id: int
  item_id: int
  variant_value: str
  sku: Optional[str] = None
  stock_quantity: int
  price_override: Optional[float] = None
  low_stock_threshold: Optional[int] = None
  created_at: datetime


class ItemVariantStockAdjust(BaseModel):
  delta: int
  reason: Optional[str] = None


# ── Item schemas ───────────────────────────────────────────────────────────────

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
  has_variants: Optional[bool] = False
  variant_type: Optional[str] = None
  hsn_sac_code: Optional[str] = None
  gst_rate: Optional[float] = None   # GST rate in percent (0, 5, 12, 18, 28)
  category: Optional[str] = None
  supplier_id: Optional[int] = None


class ItemCreate(ItemBase):
  pass


class ItemUpdate(ItemBase):
  pass


class Item(ItemBase):
  model_config = ConfigDict(from_attributes=True)

  id: int
  created_at: datetime
  updated_at: Optional[datetime] = None
  variants: List[ItemVariantResponse] = []


class ItemListResponse(BaseModel):
  id: int
  item_name: str
  brand_name: str
  sku: Optional[str]
  unit_of_measurement: Optional[str] = "Pcs"
  current_stock_quantity: int
  purchase_price: Optional[float] = None
  selling_price_retail: float
  selling_price_wholesale: float
  enable_low_stock_alert: bool
  low_stock_threshold: Optional[int]
  is_low_stock: Optional[bool] = False
  has_variants: bool = False
  variant_type: Optional[str] = None
  hsn_sac_code: Optional[str] = None
  gst_rate: Optional[float] = None
  category: Optional[str] = None
  supplier_id: Optional[int] = None
  supplier_name: Optional[str] = None
  variants_count: int = 0
  variants: List[ItemVariantResponse] = []
