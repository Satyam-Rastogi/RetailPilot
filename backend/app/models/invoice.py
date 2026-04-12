from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.models.customer import CustomerModel
from app.models.item import ItemModel
from datetime import datetime
import enum

class PaymentStatus(enum.Enum):
  UNPAID = "unpaid"
  PARTIALLY_PAID = "partial"
  PAID = "paid"

class InvoiceLineItemModel(Base):
  __tablename__ = "invoice_line_items"

  id = Column(Integer, primary_key=True, index=True)
  invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
  item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
  variant_id = Column(Integer, ForeignKey("item_variants.id"), nullable=True)   # null for non-variant items
  variant_value = Column(String(100), nullable=True)   # snapshot of variant label at sale time
  quantity = Column(Integer, nullable=False)
  price = Column(Float, nullable=False)
  discount_amount = Column(Float, nullable=True)
  discount_type = Column(String(20), nullable=True, default="amount")
  gst_rate = Column(Float, nullable=True)   # snapshot of item's GST rate at invoice time

  invoice = relationship("InvoiceModel", back_populates="line_items")
  item = relationship("ItemModel", backref="invoice_line_items")

class InvoiceModel(Base):
  __tablename__ = "invoices"

  id = Column(Integer, primary_key=True, index=True)
  invoice_number = Column(String(50), nullable=False, unique=True, index=True)
  invoice_date = Column(DateTime, nullable=False)
  due_date = Column(DateTime, nullable=True)
  customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
  discount_type = Column(String(20), nullable=True, default="amount")
  discount_amount = Column(Float, nullable=True)
  tax_rate = Column(Float, nullable=False)
  sub_total = Column(Float, nullable=True)
  total_tax_amount = Column(Float, nullable=True)
  grand_total = Column(Float, nullable=False)
  amount_paid = Column(Float, nullable=False, default=0)
  payment_status = Column(Enum(PaymentStatus), nullable=False, default=PaymentStatus.UNPAID)
  po_number = Column(String(100), nullable=True)
  shipping_address = Column(Text, nullable=True)
  notes = Column(Text, nullable=True)
  created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
  updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)

  line_items = relationship("InvoiceLineItemModel", back_populates="invoice", cascade="all, delete-orphan")
  customer = relationship("CustomerModel", back_populates="invoices")
  payment_allocations = relationship("PaymentAllocationModel", back_populates="invoice")
