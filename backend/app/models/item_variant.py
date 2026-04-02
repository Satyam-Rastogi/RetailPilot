from sqlalchemy import Column, String, Integer, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.db.session import Base
from datetime import datetime


class ItemVariantModel(Base):
  __tablename__ = "item_variants"

  id = Column(Integer, primary_key=True, index=True)
  item_id = Column(Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
  variant_value = Column(String(100), nullable=False)   # e.g. "Small", "Red", "XL"
  sku = Column(String(100), nullable=True, index=True)  # child SKU, e.g. "KS-001-S"
  stock_quantity = Column(Integer, nullable=False, default=0)
  created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

  item = relationship("ItemModel", back_populates="variants")
