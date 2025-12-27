from sqlalchemy import Column, String, Text, Integer, DateTime
from app.db.session import Base
from datetime import datetime

class SupplierModel(Base):
  __tablename__ = "suppliers"

  id = Column(Integer, primary_key=True, index=True)
  name = Column(String(255), nullable=False, index=True)
  contact_person = Column(String(255), nullable=True)
  phone_number = Column(String(50), nullable=True, index=True)
  address = Column(String(500), nullable=True)
  gstin = Column(String(50), nullable=True)
  supplier_bank_name = Column(String(255), nullable=True)
  supplier_bank_account_number = Column(String(50), nullable=True)
  supplier_bank_ifsc_code = Column(String(20), nullable=True)
  notes = Column(Text, nullable=True)
  created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
  updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)
