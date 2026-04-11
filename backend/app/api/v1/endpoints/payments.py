from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime
from app.db.session import get_db
from app.models.payment import PaymentModel, PaymentAllocationModel
from app.models.invoice import InvoiceModel, PaymentStatus
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
from app.schemas.pagination import PaginatedResponse
from app.utils.pagination import paginate_query

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

    if invoice.amount_paid >= invoice.grand_total:
      invoice.payment_status = PaymentStatus.PAID
    else:
      invoice.payment_status = PaymentStatus.PARTIALLY_PAID

    if remaining <= 0:
      break

  if remaining > 0:
    payment.credit_balance = remaining

  db.commit()
  db.refresh(payment)

  return payment, allocations


@router.post(
    "/",
    response_model=PaymentResponse,
    status_code=201,
    summary="Record payment with FIFO allocation",
    description=(
        "Records a customer payment and automatically allocates it to outstanding invoices using **FIFO** (oldest invoice first).\n\n"
        "If the payment exceeds all outstanding invoices, the surplus is stored as `credit_balance` on the payment record.\n\n"
        "**Payment amount is immutable after creation.** Only `date`, `payment_method`, and `notes` can be updated."
    ),
    responses={404: {"description": "Customer not found"}},
)
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

  if payment_data.notes:
    payment.notes = payment_data.notes

  payment.payment_method = payment_data.payment_method or "cash"
  payment.reference_number = payment_data.reference_number

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
    payment_method=payment.payment_method,
    reference_number=payment.reference_number,
    credit_balance=payment.credit_balance,
    notes=payment.notes,
    created_at=payment.created_at,
    allocations=allocation_responses
  )


@router.get(
    "/",
    response_model=PaginatedResponse[PaymentResponse],
    summary="List payments",
    description="Paginated payment list. Filterable by `customer_id`, `date_from`, and `date_to`.",
)
def get_payments(
  customer_id: Optional[int] = None,
  date_from: Optional[str] = None,
  date_to: Optional[str] = None,
  page: int = 1,
  page_size: int = 100,
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

  data, total_items, total_pages = paginate_query(query, page, page_size)

  result = []
  for payment in data:
    allocations = db.query(PaymentAllocationModel).options(joinedload(PaymentAllocationModel.invoice)).filter(PaymentAllocationModel.payment_id == payment.id).all()
    result.append(
      PaymentResponse(
        id=payment.id,
        customer_id=payment.customer_id,
        customer_name=payment.customer.name if payment.customer else None,
        date=payment.date,
        amount=payment.amount,
        payment_method=payment.payment_method,
        reference_number=payment.reference_number,
        credit_balance=payment.credit_balance,
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

  return PaginatedResponse(
    data=result,
    total_items=total_items,
    total_pages=total_pages,
    current_page=page,
    page_size=page_size if page_size > 0 else total_items,
    has_next=page < total_pages,
    has_previous=page > 1
  )


@router.get(
    "/{payment_id}",
    response_model=PaymentResponse,
    summary="Get payment by ID",
    responses={404: {"description": "Payment not found"}},
)
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
    payment_method=payment.payment_method,
    reference_number=payment.reference_number,
    credit_balance=payment.credit_balance,
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


@router.patch(
    "/{payment_id}",
    response_model=PaymentResponse,
    summary="Update payment metadata",
    description=(
        "Updates non-financial metadata only: `date`, `payment_method`, `reference_number`, `notes`.\n\n"
        "**`amount` cannot be changed** — payment amounts are immutable after creation. "
        "Delete and recreate the payment if the amount needs correction."
    ),
    responses={404: {"description": "Payment not found"}},
)
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
  if payment_update.payment_method is not None:
    payment.payment_method = payment_update.payment_method
  if payment_update.reference_number is not None:
    payment.reference_number = payment_update.reference_number
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
    payment_method=payment.payment_method,
    reference_number=payment.reference_number,
    credit_balance=payment.credit_balance,
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


@router.delete(
    "/{payment_id}",
    summary="Delete payment (full reversal)",
    description=(
        "Fully reverses a payment:\n\n"
        "1. Removes all `PaymentAllocation` records for this payment.\n"
        "2. Restores `amount_paid` on each affected invoice.\n"
        "3. Recalculates invoice `payment_status` (Paid → Partially Paid / Unpaid).\n"
        "4. Deletes the payment record.\n\n"
        "This is the correct way to fix a wrong payment — there is no partial undo."
    ),
    responses={404: {"description": "Payment not found"}},
)
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
      invoice.amount_paid = max(0.0, invoice.amount_paid - alloc.allocated_amount)
      if invoice.amount_paid <= 0:
        invoice.payment_status = PaymentStatus.UNPAID
      elif invoice.amount_paid < invoice.grand_total:
        invoice.payment_status = PaymentStatus.PARTIALLY_PAID
    db.delete(alloc)

  db.delete(payment)
  db.commit()

  return {"message": "Payment deleted successfully"}


@router.get(
    "/customer/{customer_id}/ledger",
    response_model=CustomerLedgerResponse,
    summary="Customer ledger — full invoice + payment history",
    description=(
        "Returns a customer's complete receivables ledger:\n\n"
        "- `invoices`: all invoices with `grand_total`, `amount_paid`, `unpaid`, and `payment_status`\n"
        "- `payments`: all payments with their FIFO allocations\n"
        "- `total_invoiced`, `total_paid`, `total_unpaid` summary fields\n\n"
        "Used by the per-customer Ledger page. Supports `date_from` / `date_to` range filtering."
    ),
    responses={404: {"description": "Customer not found"}},
)
def get_customer_ledger(
  customer_id: int,
  date_from: Optional[str] = None,
  date_to: Optional[str] = None,
  page: int = 1,
  page_size: int = 100,
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

  # Order BEFORE pagination - avoid AttributeError on list object
  invoices_query = invoices_query.order_by(InvoiceModel.invoice_date.asc())

  # Now paginate - result is already ordered
  invoices, invoice_total, invoice_pages = paginate_query(invoices_query, page, page_size)

  invoice_ledger = []
  total_invoiced = 0
  total_paid = 0
  for invoice in invoices:
    unpaid = invoice.grand_total - invoice.amount_paid
    total_invoiced += invoice.grand_total
    total_paid += invoice.amount_paid
    status = "Paid" if unpaid <= 0 else ("Partially Paid" if invoice.amount_paid > 0 else "Unpaid")
    invoice_ledger.append(
      InvoiceLedgerResponse(
        id=invoice.id,
        invoice_number=invoice.invoice_number,
        invoice_date=invoice.invoice_date,
        due_date=invoice.due_date,
        grand_total=invoice.grand_total,
        amount_paid=invoice.amount_paid,
        unpaid=unpaid,
        payment_status=status
      )
    )

  total_unpaid = total_invoiced - total_paid

  payments_query = db.query(PaymentModel).filter(PaymentModel.customer_id == customer_id)

  if date_from:
    payments_query = payments_query.filter(PaymentModel.date >= datetime.strptime(date_from, "%Y-%m-%d"))

  if date_to:
    payments_query = payments_query.filter(PaymentModel.date <= datetime.strptime(date_to, "%Y-%m-%d"))

  if page_size > 0:
    payments, payment_total, payment_pages = paginate_query(payments_query, page, page_size)
  else:
    payments = payments_query.all()
    payment_total = len(payments)
    payment_pages = 1

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
        payment_method=p.payment_method,
        reference_number=p.reference_number,
        credit_balance=p.credit_balance,
        notes=p.notes,
        created_at=p.created_at,
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

  return CustomerLedgerResponse(
    customer_id=customer.id,
    customer_name=customer.name,
    total_invoiced=total_invoiced,
    total_paid=total_paid,
    total_unpaid=total_unpaid,
    invoices=invoice_ledger,
    payments=payments_response
  )


@router.get(
    "/customer/{customer_id}/ledger/invoices",
    response_model=PaginatedResponse[InvoiceLedgerResponse],
    summary="Customer invoices — paginated ledger view",
    description="Paginated invoice list for a customer, sorted oldest-first. Used by the ledger page invoice tab.",
    responses={
        400: {"description": "Invalid date format — use YYYY-MM-DD"},
        404: {"description": "Customer not found"},
    },
)
def get_customer_invoices_ledger(
  customer_id: int,
  date_from: Optional[str] = None,
  date_to: Optional[str] = None,
  page: int = 1,
  page_size: int = 100,
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

  # Order BEFORE pagination - avoid AttributeError on list object
  query = query.order_by(InvoiceModel.invoice_date.asc())

  if page_size > 0:
    invoices, total_items, total_pages = paginate_query(query, page, page_size)
  else:
    invoices = query.all()
    total_items = len(invoices)
    total_pages = 1

  result = []
  for invoice in invoices:
    unpaid = invoice.grand_total - invoice.amount_paid
    status = "Paid" if unpaid <= 0 else ("Partially Paid" if invoice.amount_paid > 0 else "Unpaid")
    result.append(
      InvoiceLedgerResponse(
        id=invoice.id,
        invoice_number=invoice.invoice_number,
        invoice_date=invoice.invoice_date,
        due_date=invoice.due_date,
        grand_total=invoice.grand_total,
        amount_paid=invoice.amount_paid,
        unpaid=unpaid,
        payment_status=status
      )
    )

  return PaginatedResponse(
    data=result,
    total_items=total_items,
    total_pages=total_pages,
    current_page=page if page_size > 0 else 1,
    page_size=page_size if page_size > 0 else total_items,
    has_next=page < total_pages if page_size > 0 else False,
    has_previous=page > 1 if page_size > 0 else False
  )


@router.get(
    "/invoices/{invoice_id}/allocations",
    response_model=List[InvoiceAllocationDetail],
    summary="Invoice payment allocations",
    description="Returns all payment allocations applied to a specific invoice, ordered by allocation date. Used by the invoice detail view.",
    responses={404: {"description": "Invoice not found"}},
)
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
