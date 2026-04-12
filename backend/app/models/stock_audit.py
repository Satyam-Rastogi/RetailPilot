from datetime import datetime
from sqlalchemy import Column, Integer, ForeignKey, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import BaseModel
from app.models.item import ItemModel


class StockAuditModel(BaseModel):
  __tablename__ = "stock_audits"

  item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
  variant_id = Column(Integer, ForeignKey("item_variants.id"), nullable=True)
  delta = Column(Integer, nullable=False)
  delta_after = Column(Integer, nullable=False)
  reason = Column(String(255), nullable=True)
  created_at = Column(DateTime(timezone=True), server_default=func.now())

  item = relationship("ItemModel", backref="stock_audit_entries")
