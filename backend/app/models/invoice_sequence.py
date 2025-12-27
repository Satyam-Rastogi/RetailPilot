from sqlalchemy import Column, Integer, String
from app.db.session import Base


class InvoiceSequenceModel(Base):
  __tablename__ = "invoice_sequences"

  id = Column(Integer, primary_key=True, index=True)
  year = Column(Integer, nullable=False, unique=True, index=True)
  next_number = Column(Integer, nullable=False, default=1)
