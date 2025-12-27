from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.models.customer import CustomerModel
from app.models.invoice import InvoiceModel
from datetime import datetime


class PaymentModel(Base):
  __tablename__ = "payments"

  id = Column(Integer, primary_key=True, index=True)
  customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
  date = Column(DateTime, nullable=False)
  amount = Column(Float, nullable=False)
  notes = Column(Text, nullable=True)
  created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

  customer = relationship("CustomerModel", back_populates="payments")
  allocations = relationship("PaymentAllocationModel", back_populates="payment", cascade="all, delete-orphan")


class PaymentAllocationModel(Base):
  __tablename__ = "payment_allocations"

  id = Column(Integer, primary_key=True, index=True)
  payment_id = Column(Integer, ForeignKey("payments.id"), nullable=False)
  invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
  allocated_amount = Column(Float, nullable=False)
  created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

  payment = relationship("PaymentModel", back_populates="allocations")
  invoice = relationship("InvoiceModel", back_populates="payment_allocations")
