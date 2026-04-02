from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean, Enum
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.models.invoice import InvoiceModel
from datetime import datetime
import enum


class ReturnReasonCategory(enum.Enum):
    DAMAGED = "damaged_goods"
    UNABLE_TO_PAY = "was_not_able_to_pay"
    UNABLE_TO_SELL = "was_not_able_to_sell"
    BETTER_DEAL = "found_a_better_deal"
    QUALITY_ISSUE = "quality_issue"
    WRONG_ITEM = "wrong_item_delivered"
    OTHER = "other"


class ReturnReceiptModel(Base):
    __tablename__ = "return_receipts"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)   # nullable for standalone GRs
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True) # set on all returns
    return_date = Column(DateTime, nullable=False)
    total_credit = Column(Float, nullable=False, default=0.0)
    notes = Column(Text, nullable=True)
    is_partial = Column(Boolean, nullable=False, default=True)
    total_items_in_invoice = Column(Integer, nullable=False)
    items_returned_count = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)

    invoice = relationship("InvoiceModel", backref="returns", foreign_keys=[invoice_id])
    customer = relationship("CustomerModel", foreign_keys=[customer_id])
    line_items = relationship("ReturnLineItemModel", back_populates="return_receipt", cascade="all, delete-orphan")


class ReturnLineItemModel(Base):
    __tablename__ = "return_line_items"

    id = Column(Integer, primary_key=True, index=True)
    return_receipt_id = Column(Integer, ForeignKey("return_receipts.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    quantity_returned = Column(Integer, nullable=False)
    amount = Column(Float, nullable=False)
    reason = Column(String(255), nullable=True)
    reason_category = Column(Enum(ReturnReasonCategory), nullable=True)

    return_receipt = relationship("ReturnReceiptModel", back_populates="line_items")
    item = relationship("ItemModel", backref="return_line_items")
