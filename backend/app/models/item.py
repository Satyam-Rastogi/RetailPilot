from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime
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
  created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
  updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)
