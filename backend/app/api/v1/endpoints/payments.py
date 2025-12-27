from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime
from app.db.session import get_db
from app.models.payment import PaymentModel, PaymentAllocationModel
from app.models.invoice import InvoiceModel
from app.models.customer import CustomerModel
from app.schemas.payment import (
  PaymentCreate,
  PaymentResponse,
  PaymentAllocationResponse,
  InvoiceLedgerResponse,
  CustomerLedgerResponse,
  InvoiceAllocationDetail,
  PaymentUpdate,
)

router = APIRouter()


def allocate_payment(
  db: Session,
  customer_id: int,
  amount: float,
  date: datetime
) -> tuple[PaymentModel, List[PaymentAllocationModel]]:
  """
  Allocate a payment to oldest unpaid invoices for a customer (FIFO).
  Returns: created Payment with allocations.
  """
  query = (
    db.query(InvoiceModel)
    .options(joinedload(InvoiceModel.customer))
    .filter(InvoiceModel.customer_id == customer_id)
    .filter(InvoiceModel.grand_total > InvoiceModel.amount_paid)
    .order_by(InvoiceModel.invoice_date.asc())
  )

  invoices = query.all()

  payment = PaymentModel(
    customer_id=customer_id,
    date=date,
    amount=amount,
    notes=""
  )
  db.add(payment)
  db.flush()

  remaining = amount
  allocations = []

  for invoice in invoices:
    due = invoice.grand_total - invoice.amount_paid
    if due <= 0:
      continue

    alloc = min(due, remaining)

    allocation = PaymentAllocationModel(
      payment_id=payment.id,
      invoice_id=invoice.id,
      allocated_amount=alloc
    )
    db.add(allocation)

    invoice.amount_paid += alloc
    remaining -= alloc
    allocations.append(allocation)

    if remaining <= 0:
      break

  if remaining > 0:
    payment.notes = f"Credit balance: {remaining:.2f}"

  db.commit()
  db.refresh(payment)

  return payment, allocations


@router.post("/", response_model=PaymentResponse)
def create_payment(
  payment_data: PaymentCreate,
  db: Session = Depends(get_db)
):
  customer = db.query(CustomerModel).filter(CustomerModel.id == payment_data.customer_id).first()
  if not customer:
    raise HTTPException(status_code=404, detail="Customer not found")

  payment, allocations = allocate_payment(
    db=db,
    customer_id=payment_data.customer_id,
    amount=payment_data.amount,
    date=payment_data.date,
  )

  payment.notes = payment_data.notes or payment.notes

  db.commit()
  db.refresh(payment)

  allocation_responses = [
    PaymentAllocationResponse(
      id=alloc.id,
      payment_id=alloc.payment_id,
      invoice_id=alloc.invoice_id,
      invoice_number=db.query(InvoiceModel).filter(InvoiceModel.id == alloc.invoice_id).first().invoice_number if alloc.invoice_id else None,
      allocated_amount=alloc.allocated_amount,
      created_at=alloc.created_at
    )
    for alloc in allocations
  ]

  return PaymentResponse(
    id=payment.id,
    customer_id=payment.customer_id,
    customer_name=customer.name,
    date=payment.date,
    amount=payment.amount,
    notes=payment.notes,
    created_at=payment.created_at,
    allocations=allocation_responses
  )


@router.get("/", response_model=List[PaymentResponse])
def get_payments(
  customer_id: Optional[int] = None,
  date_from: Optional[str] = None,
  date_to: Optional[str] = None,
  skip: int = 0,
  limit: int = 100,
  db: Session = Depends(get_db)
):
  query = db.query(PaymentModel)

  if customer_id:
    query = query.filter(PaymentModel.customer_id == customer_id)

  if date_from:
    try:
      from_date = datetime.strptime(date_from, "%Y-%m-%d")
      query = query.filter(PaymentModel.date >= from_date)
    except ValueError:
      raise HTTPException(status_code=400, detail="Invalid date_from format. Use YYYY-MM-DD")

  if date_to:
    try:
      to_date = datetime.strptime(date_to, "%Y-%m-%d")
      query = query.filter(PaymentModel.date <= to_date)
    except ValueError:
      raise HTTPException(status_code=400, detail="Invalid date_to format. Use YYYY-MM-DD")

  payments = query.options(joinedload(PaymentModel.customer)).order_by(PaymentModel.date.desc()).offset(skip).limit(limit).all()

  result = []
  for payment in payments:
    allocations = db.query(PaymentAllocationModel).options(joinedload(PaymentAllocationModel.invoice)).filter(PaymentAllocationModel.payment_id == payment.id).all()
    result.append(
      PaymentResponse(
        id=payment.id,
        customer_id=payment.customer_id,
        customer_name=payment.customer.name if payment.customer else None,
        date=payment.date,
        amount=payment.amount,
        notes=payment.notes,
        created_at=payment.created_at,
        allocations=[
          PaymentAllocationResponse(
            id=alloc.id,
            payment_id=alloc.payment_id,
            invoice_id=alloc.invoice_id,
            invoice_number=alloc.invoice.invoice_number if alloc.invoice else None,
            allocated_amount=alloc.allocated_amount,
            created_at=alloc.created_at
          )
          for alloc in allocations
        ]
      )
    )

  return result


@router.get("/{payment_id}", response_model=PaymentResponse)
def get_payment(payment_id: int, db: Session = Depends(get_db)):
  payment = db.query(PaymentModel).filter(PaymentModel.id == payment_id).first()
  if not payment:
    raise HTTPException(status_code=404, detail="Payment not found")

  allocations = db.query(PaymentAllocationModel).filter(PaymentAllocationModel.payment_id == payment_id).all()

  return PaymentResponse(
    id=payment.id,
    customer_id=payment.customer_id,
    customer_name=payment.customer.name if payment.customer else None,
    date=payment.date,
    amount=payment.amount,
    notes=payment.notes,
    created_at=payment.created_at,
    allocations=[
      PaymentAllocationResponse(
        id=alloc.id,
        payment_id=alloc.payment_id,
        invoice_id=alloc.invoice_id,
        invoice_number=alloc.invoice.invoice_number if alloc.invoice else None,
        allocated_amount=alloc.allocated_amount,
        created_at=alloc.created_at
      )
      for alloc in allocations
    ]
  )


@router.patch("/{payment_id}", response_model=PaymentResponse)
def update_payment(
  payment_id: int,
  payment_update: PaymentUpdate,
  db: Session = Depends(get_db)
):
  payment = db.query(PaymentModel).filter(PaymentModel.id == payment_id).first()
  if not payment:
    raise HTTPException(status_code=404, detail="Payment not found")

  if payment_update.date is not None:
    payment.date = payment_update.date
  if payment_update.notes is not None:
    payment.notes = payment_update.notes

  db.commit()
  db.refresh(payment)

  allocations = db.query(PaymentAllocationModel).filter(PaymentAllocationModel.payment_id == payment_id).all()

  return PaymentResponse(
    id=payment.id,
    customer_id=payment.customer_id,
    customer_name=payment.customer.name if payment.customer else None,
    date=payment.date,
    amount=payment.amount,
    notes=payment.notes,
    created_at=payment.created_at,
    allocations=[
      PaymentAllocationResponse(
        id=alloc.id,
        payment_id=alloc.payment_id,
        invoice_id=alloc.invoice_id,
        invoice_number=alloc.invoice.invoice_number if alloc.invoice else None,
        allocated_amount=alloc.allocated_amount,
        created_at=alloc.created_at
      )
      for alloc in allocations
    ]
  )


@router.delete("/{payment_id}")
def delete_payment(
  payment_id: int,
  db: Session = Depends(get_db)
):
  payment = db.query(PaymentModel).filter(PaymentModel.id == payment_id).first()
  if not payment:
    raise HTTPException(status_code=404, detail="Payment not found")

  allocations = db.query(PaymentAllocationModel).filter(PaymentAllocationModel.payment_id == payment_id).all()

  for alloc in allocations:
    invoice = db.query(InvoiceModel).filter(InvoiceModel.id == alloc.invoice_id).first()
    if invoice:
      invoice.amount_paid -= alloc.allocated_amount
    db.delete(alloc)

  db.delete(payment)
  db.commit()

  return {"message": "Payment deleted successfully"}


@router.get("/customer/{customer_id}/ledger", response_model=CustomerLedgerResponse)
def get_customer_ledger(
  customer_id: int,
  date_from: Optional[str] = None,
  date_to: Optional[str] = None,
  db: Session = Depends(get_db)
):
  customer = db.query(CustomerModel).filter(CustomerModel.id == customer_id).first()
  if not customer:
    raise HTTPException(status_code=404, detail="Customer not found")

  invoices_query = db.query(InvoiceModel).filter(InvoiceModel.customer_id == customer_id)
  if date_from:
    try:
      from_date = datetime.strptime(date_from, "%Y-%m-%d")
      invoices_query = invoices_query.filter(InvoiceModel.invoice_date >= from_date)
    except ValueError:
      raise HTTPException(status_code=400, detail="Invalid date_from format. Use YYYY-MM-DD")

  if date_to:
    try:
      to_date = datetime.strptime(date_to, "%Y-%m-%d")
      invoices_query = invoices_query.filter(InvoiceModel.invoice_date <= to_date)
    except ValueError:
      raise HTTPException(status_code=400, detail="Invalid date_to format. Use YYYY-MM-DD")

  invoices = invoices_query.order_by(InvoiceModel.invoice_date.asc()).all()

  invoice_ledger = []
  total_invoiced = 0
  for invoice in invoices:
    unpaid = invoice.grand_total - invoice.amount_paid
    total_invoiced += invoice.grand_total
    status = "Paid" if unpaid <= 0 else ("Partially Paid" if invoice.amount_paid > 0 else "Unpaid")
    invoice_ledger.append(
      InvoiceLedgerResponse(
        id=invoice.id,
        invoice_number=invoice.invoice_number,
        invoice_date=invoice.invoice_date,
        grand_total=invoice.grand_total,
        amount_paid=invoice.amount_paid,
        unpaid=unpaid,
        payment_status=status
      )
    )

  payments = db.query(PaymentModel).filter(PaymentModel.customer_id == customer_id).all()

  if date_from:
    payments = payments.filter(PaymentModel.date >= datetime.strptime(date_from, "%Y-%m-%d"))

  if date_to:
    payments = payments.filter(PaymentModel.date <= datetime.strptime(date_to, "%Y-%m-%d"))

  total_paid = sum(p.amount for p in payments)
  total_unpaid = total_invoiced - total_paid

  payments_response = []
  for p in payments:
    allocations = db.query(PaymentAllocationModel).options(
      joinedload(PaymentAllocationModel.invoice),
      joinedload(PaymentAllocationModel.payment)
    ).filter(PaymentAllocationModel.payment_id == p.id).all()
    payments_response.append(
      PaymentResponse(
        id=p.id,
        customer_id=p.customer_id,
        customer_name=customer.name,
        date=p.date,
        amount=p.amount,
        notes=p.notes,
        created_at=p.created_at,
        allocations=[]
      )
    )

  return CustomerLedgerResponse(
    customer_id=customer.id,
    customer_name=customer.name,
    total_invoiced=total_invoiced,
    total_paid=total_paid,
    total_unpaid=total_unpaid,
    invoices=invoice_ledger,
    payments=payments_response
  )


@router.get("/customer/{customer_id}/ledger/invoices", response_model=List[InvoiceLedgerResponse])
def get_customer_invoices_ledger(
  customer_id: int,
  date_from: Optional[str] = None,
  date_to: Optional[str] = None,
  db: Session = Depends(get_db)
):
  customer = db.query(CustomerModel).filter(CustomerModel.id == customer_id).first()
  if not customer:
    raise HTTPException(status_code=404, detail="Customer not found")

  query = db.query(InvoiceModel).filter(InvoiceModel.customer_id == customer_id)

  if date_from:
    try:
      from_date = datetime.strptime(date_from, "%Y-%m-%d")
      query = query.filter(InvoiceModel.invoice_date >= from_date)
    except ValueError:
      raise HTTPException(status_code=400, detail="Invalid date_from format. Use YYYY-MM-DD")

  if date_to:
    try:
      to_date = datetime.strptime(date_to, "%Y-%m-%d")
      query = query.filter(InvoiceModel.invoice_date <= to_date)
    except ValueError:
      raise HTTPException(status_code=400, detail="Invalid date_to format. Use YYYY-MM-DD")

  invoices = query.order_by(InvoiceModel.invoice_date.asc()).all()

  result = []
  for invoice in invoices:
    unpaid = invoice.grand_total - invoice.amount_paid
    status = "Paid" if unpaid <= 0 else ("Partially Paid" if invoice.amount_paid > 0 else "Unpaid")
    result.append(
      InvoiceLedgerResponse(
        id=invoice.id,
        invoice_number=invoice.invoice_number,
        invoice_date=invoice.invoice_date,
        grand_total=invoice.grand_total,
        amount_paid=invoice.amount_paid,
        unpaid=unpaid,
        payment_status=status
      )
    )

  return result


@router.get("/invoices/{invoice_id}/allocations", response_model=List[InvoiceAllocationDetail])
def get_invoice_allocations(
  invoice_id: int,
  db: Session = Depends(get_db)
):
  invoice = db.query(InvoiceModel).filter(InvoiceModel.id == invoice_id).first()
  if not invoice:
    raise HTTPException(status_code=404, detail="Invoice not found")

  allocations = (
    db.query(PaymentAllocationModel)
    .options(
      joinedload(PaymentAllocationModel.payment)
    )
    .filter(PaymentAllocationModel.invoice_id == invoice_id)
    .order_by(PaymentAllocationModel.created_at.asc())
    .all()
  )

  result = []
  for alloc in allocations:
    result.append(
      InvoiceAllocationDetail(
        id=alloc.id,
        payment_id=alloc.payment_id,
        date=alloc.payment.date,
        allocated_amount=alloc.allocated_amount,
        notes=alloc.payment.notes,
        created_at=alloc.created_at
      )
    )

  return result
