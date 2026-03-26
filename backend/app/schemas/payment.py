from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import List, Optional


class PaymentBase(BaseModel):
  customer_id: int
  date: datetime
  amount: float
  payment_method: Optional[str] = "cash"
  reference_number: Optional[str] = None
  credit_balance: Optional[float] = None
  notes: Optional[str] = None


class PaymentCreate(PaymentBase):
  pass


class PaymentUpdate(BaseModel):
  date: Optional[datetime] = None
  payment_method: Optional[str] = None
  reference_number: Optional[str] = None
  notes: Optional[str] = None


class PaymentAllocationBase(BaseModel):
  invoice_id: int
  allocated_amount: float


class PaymentAllocationCreate(PaymentAllocationBase):
  pass


class PaymentAllocationResponse(PaymentAllocationBase):
  model_config = ConfigDict(from_attributes=True)

  id: int
  payment_id: int
  invoice_number: Optional[str] = None
  created_at: datetime


class PaymentResponse(PaymentBase):
  model_config = ConfigDict(from_attributes=True)

  id: int
  customer_id: int
  customer_name: Optional[str] = None
  date: datetime
  amount: float
  payment_method: Optional[str] = None
  reference_number: Optional[str] = None
  credit_balance: Optional[float] = None
  notes: Optional[str] = None
  created_at: datetime
  allocations: List[PaymentAllocationResponse] = []


class InvoiceLedgerResponse(BaseModel):
  id: int
  invoice_number: str
  invoice_date: datetime
  due_date: Optional[datetime] = None
  grand_total: float
  amount_paid: float
  unpaid: float
  payment_status: str


class CustomerLedgerResponse(BaseModel):
  customer_id: int
  customer_name: str
  total_invoiced: float
  total_paid: float
  total_unpaid: float
  invoices: List[InvoiceLedgerResponse]
  payments: List[PaymentResponse]


class InvoiceAllocationDetail(BaseModel):
  model_config = ConfigDict(from_attributes=True)

  id: int
  payment_id: int
  date: datetime
  allocated_amount: float
  notes: Optional[str] = None
  created_at: datetime
