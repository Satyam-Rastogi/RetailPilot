from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.models.invoice import InvoiceModel
from datetime import datetime


class ReturnReceiptModel(Base):
  __tablename__ = "return_receipts"

  id = Column(Integer, primary_key=True, index=True)
  invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
  return_date = Column(DateTime, nullable=False)
  total_credit = Column(Float, nullable=False, default=0.0)
  notes = Column(Text, nullable=True)
  created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
  updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)

  invoice = relationship("InvoiceModel", backref="returns")
  line_items = relationship("ReturnLineItemModel", back_populates="return_receipt", cascade="all, delete-orphan")


class ReturnLineItemModel(Base):
  __tablename__ = "return_line_items"

  id = Column(Integer, primary_key=True, index=True)
  return_receipt_id = Column(Integer, ForeignKey("return_receipts.id"), nullable=False)
  item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
  quantity_returned = Column(Integer, nullable=False)
  amount = Column(Float, nullable=False)
  reason = Column(String(255), nullable=True)

  return_receipt = relationship("ReturnReceiptModel", back_populates="line_items")
  item = relationship("ItemModel", backref="return_line_items")
