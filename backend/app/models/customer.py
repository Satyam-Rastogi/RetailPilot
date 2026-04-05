from sqlalchemy import Column, String, Text, Integer, Float, DateTime
from sqlalchemy.orm import relationship
from app.db.session import Base
from datetime import datetime


class CustomerModel(Base):
  __tablename__ = "customers"

  id = Column(Integer, primary_key=True, index=True)
  name = Column(String(255), nullable=False, index=True)
  phone_number = Column(String(50), nullable=True, index=True)
  email = Column(String(255), nullable=True)
  address = Column(String(500), nullable=True)
  gstin = Column(String(50), nullable=True)
  customer_type = Column(String(20), nullable=False, default="Retail")
  credit_days = Column(Integer, nullable=True, default=0)
  credit_limit = Column(Float, nullable=True)
  notes = Column(Text, nullable=True)
  created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
  updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)

  invoices = relationship("InvoiceModel", back_populates="customer")
  payments = relationship("PaymentModel", back_populates="customer")
