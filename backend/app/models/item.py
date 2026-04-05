from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, ForeignKey, text
from sqlalchemy.orm import relationship
from app.db.session import Base
from datetime import datetime


class ItemModel(Base):
  __tablename__ = "items"

  id = Column(Integer, primary_key=True, index=True)
  item_name = Column(String(255), nullable=False, index=True)
  brand_name = Column(String(255), nullable=False, index=True)
  sku = Column(String(100), nullable=True, unique=True, index=True)
  material = Column(String(100), nullable=True)
  purchase_price = Column(Float, nullable=True)
  selling_price_retail = Column(Float, nullable=False)
  selling_price_wholesale = Column(Float, nullable=False)
  current_stock_quantity = Column(Integer, nullable=False, default=0)
  unit_of_measurement = Column(String(20), nullable=False, default="Pcs")
  low_stock_threshold = Column(Integer, nullable=True)
  enable_low_stock_alert = Column(Boolean, nullable=False, default=False)
  has_variants = Column(Boolean, nullable=False, default=False)
  variant_type = Column(String(50), nullable=True)   # e.g. "Size", "Color", "Style"
  hsn_sac_code = Column(String(30), nullable=True)
  gst_rate = Column(Float, nullable=True)   # e.g. 0, 5, 12, 18, 28 (percent)
  category = Column(String(100), nullable=True)
  supplier_id = Column(Integer, ForeignKey('suppliers.id'), nullable=True)
  is_active = Column(Boolean, nullable=False, default=True, server_default=text('1'))
  created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
  updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)

  supplier = relationship("SupplierModel", back_populates="items", foreign_keys=[supplier_id])

  variants = relationship(
    "ItemVariantModel",
    back_populates="item",
    cascade="all, delete-orphan",
    order_by="ItemVariantModel.id",
  )
