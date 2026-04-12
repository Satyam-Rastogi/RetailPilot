from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, case, and_
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.db.session import get_db
from app.models.customer import CustomerModel
from app.models.invoice import InvoiceModel, PaymentStatus
from app.schemas.customer import Customer, CustomerCreate, CustomerUpdate, CustomerListResponse, CustomerOutstandingResponse
from app.schemas.pagination import PaginatedResponse
from app.utils.pagination import paginate_query

router = APIRouter()


@router.get(
    "/",
    response_model=PaginatedResponse[CustomerListResponse],
    summary="List customers",
    description="Paginated customer list. Supports name search and `created_after` date filter. Returns compact `CustomerListResponse` (no full detail).",
)
def get_customers(
  skip: int = Query(0, ge=0),
  limit: int = Query(100, ge=1, le=1000),
  page: int = Query(1, ge=1),
  page_size: int = Query(100, ge=1, le=1000),
  search: Optional[str] = None,
  created_after: Optional[str] = Query(None, description="Filter customers created on or after this date (YYYY-MM-DD)"),
  db: Session = Depends(get_db)
):
  query = db.query(CustomerModel)

  if search:
    query = query.filter(CustomerModel.name.ilike(f"%{search}%"))

  if created_after:
    try:
      after_dt = datetime.strptime(created_after, "%Y-%m-%d")
      query = query.filter(CustomerModel.created_at >= after_dt)
    except ValueError:
      pass

  if page_size > 0:
    data, total_items, total_pages = paginate_query(query, page, page_size)
  else:
    data = query.all()
    total_items = len(data)
    total_pages = 1

  return PaginatedResponse(
    data=data,
    total_items=total_items,
    total_pages=total_pages,
    current_page=page if page_size > 0 else 1,
    page_size=page_size if page_size > 0 else total_items,
    has_next=page < total_pages if page_size > 0 else False,
    has_previous=page > 1 if page_size > 0 else False
  )


@router.get(
    "/outstanding/",
    response_model=List[CustomerOutstandingResponse],
    summary="Receivables — outstanding amounts per customer",
    description=(
        "Returns every customer's total outstanding and overdue balances computed in a **single SQL aggregate** (no N+1).\n\n"
        "- Walk-in Customer is always excluded.\n"
        "- By default, customers with zero outstanding are excluded; pass `include_zero_balance=true` to include them.\n"
        "- Results are sorted by `total_outstanding` descending.\n"
        "- `overdue_amount` counts only invoices whose `due_date` is in the past."
    ),
    responses={
        400: {"description": "Invalid `customer_type` value — must be `Retail` or `Wholesale`"},
    },
)
def get_customers_outstanding(
  include_zero_balance: bool = Query(False),
  search: Optional[str] = None,
  customer_type: Optional[str] = None,
  db: Session = Depends(get_db)
):
  today = datetime.utcnow()

  outstanding_expr = func.coalesce(func.sum(
    case(
      (InvoiceModel.payment_status != PaymentStatus.PAID,
       InvoiceModel.grand_total - InvoiceModel.amount_paid),
      else_=0.0
    )
  ), 0.0)

  overdue_expr = func.coalesce(func.sum(
    case(
      (and_(
        InvoiceModel.payment_status != PaymentStatus.PAID,
        InvoiceModel.due_date.isnot(None),
        InvoiceModel.due_date < today
      ), InvoiceModel.grand_total - InvoiceModel.amount_paid),
      else_=0.0
    )
  ), 0.0)

  overdue_count_expr = func.count(
    case(
      (and_(
        InvoiceModel.payment_status != PaymentStatus.PAID,
        InvoiceModel.due_date.isnot(None),
        InvoiceModel.due_date < today
      ), 1)
    )
  )

  unpaid_count_expr = func.count(
    case(
      (InvoiceModel.payment_status != PaymentStatus.PAID, 1)
    )
  )

  oldest_unpaid_expr = func.min(
    case(
      (InvoiceModel.payment_status != PaymentStatus.PAID, InvoiceModel.invoice_date)
    )
  )

  query = (
    db.query(
      CustomerModel.id,
      CustomerModel.name,
      CustomerModel.phone_number,
      CustomerModel.customer_type,
      outstanding_expr.label('total_outstanding'),
      overdue_expr.label('overdue_amount'),
      overdue_count_expr.label('overdue_invoice_count'),
      unpaid_count_expr.label('unpaid_invoice_count'),
      oldest_unpaid_expr.label('oldest_unpaid_date'),
    )
    .outerjoin(InvoiceModel, CustomerModel.id == InvoiceModel.customer_id)
    .filter(CustomerModel.name != 'Walk-in Customer')
  )

  if search:
    query = query.filter(CustomerModel.name.ilike(f"%{search}%"))

  if customer_type:
    if customer_type not in ('Retail', 'Wholesale'):
      raise HTTPException(status_code=400, detail="customer_type must be 'Retail' or 'Wholesale'")
    query = query.filter(CustomerModel.customer_type == customer_type)

  query = query.group_by(CustomerModel.id)
  rows = query.all()

  result = []
  for row in rows:
    if not include_zero_balance and (row.total_outstanding or 0) == 0:
      continue
    result.append(CustomerOutstandingResponse(
      id=row.id,
      name=row.name,
      phone_number=row.phone_number,
      customer_type=row.customer_type,
      total_outstanding=row.total_outstanding or 0.0,
      overdue_amount=row.overdue_amount or 0.0,
      overdue_invoice_count=row.overdue_invoice_count or 0,
      unpaid_invoice_count=row.unpaid_invoice_count or 0,
      oldest_unpaid_date=row.oldest_unpaid_date,
    ))

  result.sort(key=lambda x: x.total_outstanding, reverse=True)
  return result


@router.get(
    "/walkin/",
    response_model=Customer,
    summary="Get or create the shared Walk-in Customer record",
    description="Returns the single shared Walk-in Customer record, creating it on first call. Used by the Price Browser flow.",
)
def get_or_create_walkin(db: Session = Depends(get_db)):
  customer = db.query(CustomerModel).filter(CustomerModel.name == "Walk-in Customer").first()
  if not customer:
    customer = CustomerModel(
      name="Walk-in Customer",
      customer_type="Retail",
      notes="Shared record for anonymous walk-in sales. Do not delete.",
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
  return customer


@router.get(
    "/{customer_id}",
    response_model=Customer,
    summary="Get customer by ID",
    responses={404: {"description": "Customer not found"}},
)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
  customer = db.query(CustomerModel).filter(CustomerModel.id == customer_id).first()
  if not customer:
    raise HTTPException(status_code=404, detail="Customer not found")
  return customer


@router.post(
    "/",
    response_model=Customer,
    status_code=201,
    summary="Create customer",
    responses={409: {"description": "A customer with this name/phone already exists"}},
)
def create_customer(customer: CustomerCreate, db: Session = Depends(get_db)):
  db_customer = CustomerModel(**customer.model_dump())
  db.add(db_customer)
  db.commit()
  db.refresh(db_customer)
  return db_customer


@router.put(
    "/{customer_id}",
    response_model=Customer,
    summary="Update customer",
    responses={404: {"description": "Customer not found"}},
)
def update_customer(customer_id: int, customer: CustomerUpdate, db: Session = Depends(get_db)):
  db_customer = db.query(CustomerModel).filter(CustomerModel.id == customer_id).first()
  if not db_customer:
    raise HTTPException(status_code=404, detail="Customer not found")
  
  for key, value in customer.model_dump(exclude_unset=True).items():
    setattr(db_customer, key, value)
  
  db.commit()
  db.refresh(db_customer)
  return db_customer


@router.delete(
    "/{customer_id}",
    summary="Delete customer",
    description="Deletes a customer. **Walk-in Customer** (the system cash-sale record) cannot be deleted.",
    responses={
        400: {"description": "Walk-in Customer is a system record and cannot be deleted"},
        404: {"description": "Customer not found"},
    },
)
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
  db_customer = db.query(CustomerModel).filter(CustomerModel.id == customer_id).first()
  if not db_customer:
    raise HTTPException(status_code=404, detail="Customer not found")
  if db_customer.name == "Walk-in Customer":
    raise HTTPException(status_code=400, detail="Walk-in Customer is a system record and cannot be deleted.")

  db.delete(db_customer)
  db.commit()
  return {"message": "Customer deleted successfully"}
