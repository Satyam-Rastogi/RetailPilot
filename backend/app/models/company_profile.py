from sqlalchemy import Column, String, Float, Integer, DateTime
from app.db.session import Base
from datetime import datetime


class CompanyProfileModel(Base):
  __tablename__ = "company_profiles"

  id = Column(Integer, primary_key=True, index=True)
  shop_name = Column(String(255), nullable=False)
  shop_address = Column(String(500), nullable=True)
  shop_phone = Column(String(50), nullable=True)
  shop_gstin = Column(String(50), nullable=True)
  default_tax_rate = Column(Float, nullable=False)
  currency_symbol = Column(String(10), nullable=False)
  receiver_bank_name = Column(String(255), nullable=True)
  receiver_account_number = Column(String(50), nullable=True)
  receiver_ifsc_code = Column(String(20), nullable=True)
  upi_id = Column(String(100), nullable=True)
  created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
  updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)
