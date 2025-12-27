from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime, timedelta
from app.db.session import get_db
from app.models.invoice import InvoiceModel, InvoiceLineItemModel, PaymentStatus
from app.models.customer import CustomerModel
from app.models.item import ItemModel
from app.models.invoice_sequence import InvoiceSequenceModel
from app.models.company_profile import CompanyProfileModel
from app.schemas.invoice import (
  InvoiceLineItemCreate,
)
from app.schemas.customer import CustomerCreate
from app.domain.services.calculation_service import InvoiceCalculationService
from app.utils.normalization import normalize_customer_input

router = APIRouter()


def get_invoice_suffix(customer_type: str) -> str:
  if customer_type == 'Wholesale':
    return 'WS'
  return 'RE'


def generate_invoice_number(year: int, sequence: int, customer_type: str) -> str:
  suffix = get_invoice_suffix(customer_type)
  return f"INV-{year}-{str(sequence).zfill(4)}-{suffix}"


@router.get("/", response_model=List[dict])
def get_invoices(
  skip: int = Query(0, ge=0),
  limit: int = Query(100, ge=1, le=100),
  date_from: Optional[str] = Query(None, description="Filter invoices from this date (YYYY-MM-DD)"),
  date_to: Optional[str] = Query(None, description="Filter invoices up to this date (YYYY-MM-DD)"),
  customer_id: Optional[int] = Query(None, description="Filter by customer ID"),
  customer_name: Optional[str] = Query(None, description="Search by customer name (partial match)"),
  invoice_number: Optional[str] = Query(None, description="Search by invoice number (partial match)"),
  sort_by: Optional[str] = Query(None, description="Sort field (default: invoice_date)"),
  sort_dir: Optional[str] = Query("desc", description="Sort direction (asc/desc)"),
  db: Session = Depends(get_db)
):
  query = db.query(InvoiceModel).options(joinedload(InvoiceModel.customer)).join(CustomerModel)

  if date_from:
    try:
      from_date = datetime.strptime(date_from, "%Y-%m-%d").replace(hour=0, minute=0, second=0, microsecond=0)
      query = query.filter(InvoiceModel.invoice_date >= from_date)
    except ValueError:
      raise HTTPException(status_code=400, detail="Invalid date_from format. Use YYYY-MM-DD")

  if date_to:
    try:
      to_date = datetime.strptime(date_to, "%Y-%m-%d").replace(hour=23, minute=59, second=59, microsecond=999999)
      query = query.filter(InvoiceModel.invoice_date <= to_date)
    except ValueError:
      raise HTTPException(status_code=400, detail="Invalid date_to format. Use YYYY-MM-DD")

  if customer_id:
    query = query.filter(InvoiceModel.customer_id == customer_id)

  if customer_name:
    query = query.filter(CustomerModel.name.ilike(f"%{customer_name}%"))

  if invoice_number:
    query = query.filter(InvoiceModel.invoice_number.ilike(f"%{invoice_number}%"))

  sort_field = InvoiceModel.invoice_date if sort_by == "invoice_date" else InvoiceModel.invoice_date
  query = query.order_by(sort_field.desc() if sort_dir == "desc" else sort_field.asc())

  invoices = query.offset(skip).limit(limit).all()
  result = []
  for invoice in invoices:
    result.append({
      'id': invoice.id,
      'invoice_number': invoice.invoice_number,
      'invoice_date': invoice.invoice_date.isoformat(),
      'customer_name': invoice.customer.name if invoice.customer else None,
      'total_amount': invoice.grand_total,
      'payment_status': invoice.payment_status.value,
    })
  return result


@router.get("/{invoice_id}", response_model=dict)
def get_invoice(invoice_id: int, db: Session = Depends(get_db)):
  invoice = db.query(InvoiceModel).options(joinedload(InvoiceModel.customer)).filter(InvoiceModel.id == invoice_id).first()
  if not invoice:
    raise HTTPException(status_code=404, detail="Invoice not found")
  return {
    'id': invoice.id,
    'invoice_number': invoice.invoice_number,
    'invoice_date': invoice.invoice_date.isoformat(),
    'customer_id': invoice.customer_id,
    'customer_name': invoice.customer.name if invoice.customer else None,
    'customer_type': invoice.customer.customer_type if invoice.customer else None,
    'discount_type': invoice.discount_type,
    'discount_amount': invoice.discount_amount,
    'tax_rate': invoice.tax_rate,
    'sub_total': invoice.sub_total,
    'total_tax_amount': invoice.total_tax_amount,
    'grand_total': invoice.grand_total,
    'amount_paid': invoice.amount_paid,
    'payment_status': invoice.payment_status.value,
    'notes': invoice.notes,
    'line_items': [
      {
        'item_id': li.item_id,
        'item_name': li.item.item_name if li.item else None,
        'quantity': li.quantity,
        'price': li.price,
        'discount_amount': li.discount_amount,
        'discount_type': li.discount_type,
        'total': li.price * li.quantity - (li.discount_amount or 0),
      }
      for li in invoice.line_items
    ],
  }


@router.post("/calculate", response_model=dict)
def calculate_invoice_totals(invoice_data: dict, db: Session = Depends(get_db)):
  line_items = [
    {
      "item_id": item.item_id,
      "quantity": item.quantity,
      "price": item.price,
      "discount_amount": item.discount_amount,
      "discount_type": item.discount_type
    }
    for item in invoice_data.get('line_items', [])
  ]

  result = InvoiceCalculationService.calculate_invoice_totals(
    line_items=line_items,
    discount_type=invoice_data.get('discount_type', 'amount'),
    discount_amount=invoice_data.get('discount_amount'),
    tax_rate=0.18
  )
  return result


@router.post("/", response_model=dict)
def create_invoice(invoice_data: dict, db: Session = Depends(get_db)):
  customer = None

  if invoice_data.get('new_customer'):
    normalized_data = normalize_customer_input(invoice_data['new_customer'])
    new_customer_schema = CustomerCreate(**normalized_data)
    customer = CustomerModel(**new_customer_schema.model_dump())
    db.add(customer)
    db.flush()
    db.refresh(customer)
  elif invoice_data.get('customer_id'):
    customer = db.query(CustomerModel).filter(CustomerModel.id == invoice_data['customer_id']).first()
    if not customer:
      raise HTTPException(status_code=404, detail="Customer not found")
  else:
    raise HTTPException(status_code=400, detail="Either customer_id or new_customer must be provided")

  tax_rate = 18.0
  if invoice_data.get('tax_rate') is not None:
    tax_rate = float(invoice_data['tax_rate'])
  else:
    profile = db.query(CompanyProfileModel).first()
    if profile and profile.default_tax_rate is not None:
      tax_rate = profile.default_tax_rate

  calculation = InvoiceCalculationService.calculate_invoice_totals(
    line_items=[
      {
        "item_id": item.item_id,
        "quantity": item.quantity,
        "price": item.price,
        "discount_amount": item.discount_amount,
        "discount_type": item.discount_type
      }
      for item in invoice_data.get('line_items', [])
    ],
    discount_type=invoice_data.get('discount_type', 'amount'),
    discount_amount=invoice_data.get('discount_amount'),
    tax_rate=tax_rate
  )

  invoice_number = invoice_data.get('invoice_number')
  if not invoice_number:
    current_year = datetime.utcnow().year
    sequence_record = db.query(InvoiceSequenceModel).filter(InvoiceSequenceModel.year == current_year).first()
    if not sequence_record:
      sequence_record = InvoiceSequenceModel(year=current_year, next_number=1)
      db.add(sequence_record)
      db.flush()
    else:
      sequence_record.next_number += 1
      db.flush()

  customer_type = 'Retail'
  if customer.customer_type:
    customer_type = customer.customer_type

  invoice_number = generate_invoice_number(current_year, sequence_record.next_number, customer_type)

  db_invoice = InvoiceModel(
    invoice_number=invoice_number,
    invoice_date=datetime.fromisoformat(invoice_data['invoice_date'].replace('Z', '+00:00')),
    customer_id=customer.id,
    discount_type=invoice_data.get('discount_type', 'amount'),
    discount_amount=invoice_data.get('discount_amount'),
    tax_rate=tax_rate,
    sub_total=calculation["sub_total"],
    total_tax_amount=calculation["tax_amount"],
    grand_total=calculation["grand_total"],
    amount_paid=0,
    payment_status=PaymentStatus.UNPAID.value,
    notes=invoice_data.get('notes')
  )

  db.add(db_invoice)
  db.flush()

  for item in invoice_data.get('line_items', []):
    db_item = db.query(ItemModel).filter(ItemModel.id == item['item_id']).first()
    if not db_item:
      raise HTTPException(status_code=404, detail=f"Item with id {item['item_id']} not found")

    line_item = InvoiceLineItemModel(
      invoice_id=db_invoice.id,
      item_id=item['item_id'],
      quantity=item['quantity'],
      price=item['price'],
      discount_amount=item.get('discount_amount'),
      discount_type=item.get('discount_type', 'amount')
    )
    db.add(line_item)

    if db_item.current_stock_quantity < item['quantity']:
      raise HTTPException(status_code=400, detail=f"Insufficient stock for item {db_item.item_name}")

    db_item.current_stock_quantity -= item['quantity']

  db.commit()
  db.refresh(db_invoice)
  return {
    'id': db_invoice.id,
    'invoice_number': db_invoice.invoice_number,
    'invoice_date': db_invoice.invoice_date.isoformat(),
    'customer_id': db_invoice.customer_id,
    'customer_name': db_invoice.customer.name if db_invoice.customer else None,
    'customer_type': db_invoice.customer.customer_type if db_invoice.customer else None,
    'discount_type': db_invoice.discount_type,
    'discount_amount': db_invoice.discount_amount,
    'tax_rate': db_invoice.tax_rate,
    'sub_total': db_invoice.sub_total,
    'total_tax_amount': db_invoice.total_tax_amount,
    'grand_total': db_invoice.grand_total,
    'amount_paid': db_invoice.amount_paid,
    'payment_status': db_invoice.payment_status.value,
    'notes': db_invoice.notes,
    'line_items': [
      {
        'item_id': li.item_id,
        'item_name': li.item.item_name if li.item else None,
        'quantity': li.quantity,
        'price': li.price,
        'discount_amount': li.discount_amount,
        'discount_type': li.discount_type,
        'total': li.total,
      }
      for li in db_invoice.line_items
    ],
  }


@router.delete("/{invoice_id}")
def delete_invoice(invoice_id: int, db: Session = Depends(get_db)):
  db_invoice = db.query(InvoiceModel).filter(InvoiceModel.id == invoice_id).first()
  if not db_invoice:
    raise HTTPException(status_code=404, detail="Invoice not found")

  for line_item in db_invoice.line_items:
    item = db.query(ItemModel).filter(ItemModel.id == line_item.item_id).first()
    if item:
      item.current_stock_quantity += line_item.quantity

  db.delete(db_invoice)
  db.commit()
  return {"message": "Invoice deleted successfully"}
