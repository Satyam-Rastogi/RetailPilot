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
from app.schemas.pagination import PaginatedResponse
from app.domain.services.calculation_service import InvoiceCalculationService
from app.utils.normalization import normalize_customer_input
from app.utils.pagination import paginate_query

router = APIRouter()


def get_invoice_suffix(customer_type: str) -> str:
  if customer_type == 'Wholesale':
    return 'WS'
  return 'RE'


def generate_invoice_number(year: int, sequence: int, customer_type: str) -> str:
  suffix = get_invoice_suffix(customer_type)
  return f"INV-{year}-{str(sequence).zfill(4)}-{suffix}"


@router.get("/", response_model=PaginatedResponse[dict])
def get_invoices(
  skip: int = Query(0, ge=0),
  limit: int = Query(100, ge=1, le=500),
  page: int = Query(1, ge=1),
  page_size: int = Query(100, ge=1, le=500),
  date_from: Optional[str] = Query(None, description="Filter invoices from this date (YYYY-MM-DD)"),
  date_to: Optional[str] = Query(None, description="Filter invoices up to this date (YYYY-MM-DD)"),
  customer_id: Optional[int] = Query(None, description="Filter by customer ID"),
  customer_name: Optional[str] = Query(None, description="Search by customer name (partial match)"),
  invoice_number: Optional[str] = Query(None, description="Search by invoice number (partial match)"),
  payment_status: Optional[str] = Query(None, description="Filter by payment status (paid/partial/unpaid)"),
  overdue_only: Optional[bool] = Query(None, description="Show only overdue invoices"),
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

  if payment_status:
    status_map = {
      'paid': PaymentStatus.PAID,
      'partial': PaymentStatus.PARTIALLY_PAID,
      'unpaid': PaymentStatus.UNPAID,
    }
    mapped = status_map.get(payment_status.lower())
    if mapped:
      query = query.filter(InvoiceModel.payment_status == mapped)

  if overdue_only:
    now = datetime.utcnow()
    query = query.filter(
      InvoiceModel.due_date != None,
      InvoiceModel.due_date < now,
      InvoiceModel.payment_status != PaymentStatus.PAID,
    )

  sort_map = {
    "invoice_date": InvoiceModel.invoice_date,
    "grand_total": InvoiceModel.grand_total,
    "payment_status": InvoiceModel.payment_status,
    "customer_name": CustomerModel.name,
  }
  sort_field = sort_map.get(sort_by, InvoiceModel.invoice_date)
  query = query.order_by(sort_field.desc() if sort_dir == "desc" else sort_field.asc())

  if page_size > 0:
    data, total_items, total_pages = paginate_query(query, page, page_size)
  else:
    data = query.all()
    total_items = len(data)
    total_pages = 1

  result = []
  for invoice in data:
    result.append({
      'id': invoice.id,
      'invoice_number': invoice.invoice_number,
      'invoice_date': invoice.invoice_date.isoformat(),
      'due_date': invoice.due_date.isoformat() if invoice.due_date else None,
      'customer_id': invoice.customer_id,
      'customer_name': invoice.customer.name if invoice.customer else None,
      'customer_type': invoice.customer.customer_type if invoice.customer else None,
      'total_amount': invoice.grand_total,
      'amount_paid': invoice.amount_paid,
      'payment_status': invoice.payment_status.value,
    })

  return PaginatedResponse(
    data=result,
    total_items=total_items,
    total_pages=total_pages,
    current_page=page if page_size > 0 else 1,
    page_size=page_size if page_size > 0 else total_items,
    has_next=page < total_pages if page_size > 0 else False,
    has_previous=page > 1 if page_size > 0 else False
  )


@router.get("/{invoice_id}", response_model=dict)
def get_invoice(invoice_id: int, db: Session = Depends(get_db)):
  invoice = db.query(InvoiceModel).options(joinedload(InvoiceModel.customer)).filter(InvoiceModel.id == invoice_id).first()
  if not invoice:
    raise HTTPException(status_code=404, detail="Invoice not found")

  # Build per-item returned quantity map
  returned_qty: dict[int, int] = {}
  returns_data = []
  for ret in getattr(invoice, 'returns', []):
    ret_items = []
    for rli in ret.line_items:
      returned_qty[rli.item_id] = returned_qty.get(rli.item_id, 0) + rli.quantity_returned
      ret_items.append({
        'item_id': rli.item_id,
        'item_name': rli.item.item_name if rli.item else None,
        'quantity_returned': rli.quantity_returned,
        'amount': rli.amount,
        'reason': rli.reason,
        'reason_category': rli.reason_category.value if rli.reason_category else None,
      })
    returns_data.append({
      'id': ret.id,
      'return_date': ret.return_date.isoformat(),
      'total_credit': ret.total_credit,
      'is_partial': ret.is_partial,
      'notes': ret.notes,
      'items_returned_count': ret.items_returned_count,
      'total_items_in_invoice': ret.total_items_in_invoice,
      'line_items': ret_items,
    })

  return {
    'id': invoice.id,
    'invoice_number': invoice.invoice_number,
    'invoice_date': invoice.invoice_date.isoformat(),
    'due_date': invoice.due_date.isoformat() if invoice.due_date else None,
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
    'po_number': invoice.po_number,
    'shipping_address': invoice.shipping_address,
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
        'quantity_returned': returned_qty.get(li.item_id, 0),
        'gst_rate': li.gst_rate,
        'hsn_sac_code': li.item.hsn_sac_code if li.item else None,
      }
      for li in invoice.line_items
    ],
    'returns': returns_data,
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

  # Pre-fetch items to get gst_rate for per-item tax calculation
  line_items_raw = invoice_data.get('line_items', [])
  item_gst_map: dict = {}
  for li in line_items_raw:
    item_id = li.get('item_id')
    if item_id and li.get('gst_rate') is None:
      db_item_for_gst = db.query(ItemModel).filter(ItemModel.id == item_id).first()
      if db_item_for_gst:
        item_gst_map[item_id] = db_item_for_gst.gst_rate

  calculation = InvoiceCalculationService.calculate_invoice_totals(
    line_items=[
      {
        "item_id": li.get('item_id'),
        "quantity": li.get('quantity'),
        "price": li.get('price'),
        "discount_amount": li.get('discount_amount'),
        "discount_type": li.get('discount_type', 'amount'),
        "gst_rate": li.get('gst_rate') if li.get('gst_rate') is not None else item_gst_map.get(li.get('item_id')),
      }
      for li in line_items_raw
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

  invoice_date = datetime.fromisoformat(invoice_data['invoice_date'].replace('Z', '+00:00'))

  due_date = None
  credit_days = customer.credit_days or 0
  if credit_days > 0:
    due_date = invoice_date + timedelta(days=credit_days)

  db_invoice = InvoiceModel(
    invoice_number=invoice_number,
    invoice_date=invoice_date,
    due_date=due_date,
    customer_id=customer.id,
    discount_type=invoice_data.get('discount_type', 'amount'),
    discount_amount=invoice_data.get('discount_amount'),
    tax_rate=tax_rate,
    sub_total=calculation["sub_total"],
    total_tax_amount=calculation["tax_amount"],
    grand_total=calculation["grand_total"],
    amount_paid=0,
    payment_status=PaymentStatus.UNPAID.value,
    po_number=invoice_data.get('po_number'),
    shipping_address=invoice_data.get('shipping_address'),
    notes=invoice_data.get('notes')
  )

  db.add(db_invoice)
  db.flush()

  # Validate all items and stock before making any mutations
  for item in invoice_data.get('line_items', []):
    db_item = db.query(ItemModel).filter(ItemModel.id == item['item_id']).first()
    if not db_item:
      raise HTTPException(status_code=404, detail=f"Item with id {item['item_id']} not found")
    if db_item.current_stock_quantity < item['quantity']:
      raise HTTPException(status_code=400, detail=f"Insufficient stock for item {db_item.item_name}")

  # All valid — now create line items and deduct stock
  for item in invoice_data.get('line_items', []):
    db_item = db.query(ItemModel).filter(ItemModel.id == item['item_id']).first()
    line_item = InvoiceLineItemModel(
      invoice_id=db_invoice.id,
      item_id=item['item_id'],
      quantity=item['quantity'],
      price=item['price'],
      discount_amount=item.get('discount_amount'),
      discount_type=item.get('discount_type', 'amount'),
      gst_rate=item.get('gst_rate') if item.get('gst_rate') is not None else db_item.gst_rate,
    )
    db.add(line_item)
    db_item.current_stock_quantity -= item['quantity']

  db.commit()
  db.refresh(db_invoice)
  return {
    'id': db_invoice.id,
    'invoice_number': db_invoice.invoice_number,
    'invoice_date': db_invoice.invoice_date.isoformat(),
    'due_date': db_invoice.due_date.isoformat() if db_invoice.due_date else None,
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
    'po_number': db_invoice.po_number,
    'shipping_address': db_invoice.shipping_address,
    'notes': db_invoice.notes,
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
      for li in db_invoice.line_items
    ],
  }


@router.delete("/{invoice_id}")
def delete_invoice(invoice_id: int, db: Session = Depends(get_db)):
    db_invoice = db.query(InvoiceModel).filter(InvoiceModel.id == invoice_id).first()
    if not db_invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if db_invoice.amount_paid > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete an invoice that has payments applied. Delete the associated payments first."
        )

    for line_item in db_invoice.line_items:
        item = db.query(ItemModel).filter(ItemModel.id == line_item.item_id).first()
        if item:
            item.current_stock_quantity += line_item.quantity

    db.delete(db_invoice)
    db.commit()
    return {"message": "Invoice deleted successfully"}


@router.put("/{invoice_id}", response_model=dict)
def update_invoice(invoice_id: int, invoice_data: dict, db: Session = Depends(get_db)):
    """
    Update an invoice.
    
    Handles:
    - Invoice date changes
    - Discount/tax rate updates
    - Line item additions, removals, quantity changes
    - Stock adjustments for quantity changes
    - Totals recalculation
    """
    db_invoice = db.query(InvoiceModel).filter(InvoiceModel.id == invoice_id).first()
    if not db_invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    old_line_items = db.query(InvoiceLineItemModel).filter(InvoiceLineItemModel.invoice_id == invoice_id).all()
    old_line_item_map = {li.item_id: li for li in old_line_items}

    if invoice_data.get('invoice_date'):
        try:
            db_invoice.invoice_date = datetime.fromisoformat(invoice_data['invoice_date'].replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            pass

    if 'discount_type' in invoice_data:
        db_invoice.discount_type = invoice_data['discount_type']
    if 'discount_amount' in invoice_data:
        db_invoice.discount_amount = invoice_data['discount_amount']
    if 'tax_rate' in invoice_data:
        db_invoice.tax_rate = invoice_data['tax_rate']
    if 'notes' in invoice_data:
        db_invoice.notes = invoice_data['notes']
    if 'po_number' in invoice_data:
        db_invoice.po_number = invoice_data['po_number']
    if 'shipping_address' in invoice_data:
        db_invoice.shipping_address = invoice_data['shipping_address']

    new_line_items = invoice_data.get('line_items', [])

    for item_id, old_li in old_line_item_map.items():
        if item_id not in [li.get('item_id') for li in new_line_items if li.get('item_id')]:
            item = db.query(ItemModel).filter(ItemModel.id == item_id).first()
            if item:
                item.current_stock_quantity += old_li.quantity
            db.delete(old_li)

    for new_li in new_line_items:
        item_id = new_li.get('item_id')
        new_quantity = new_li.get('quantity', 0)
        new_price = new_li.get('price', 0)
        new_discount = new_li.get('discount_amount', 0)
        new_discount_type = new_li.get('discount_type', 'amount')

        if item_id in old_line_item_map:
            old_li = old_line_item_map[item_id]
            quantity_diff = new_quantity - old_li.quantity

            if quantity_diff != 0:
                item = db.query(ItemModel).filter(ItemModel.id == item_id).first()
                if item:
                    if quantity_diff > 0:
                        if item.current_stock_quantity < quantity_diff:
                            raise HTTPException(status_code=400, detail=f"Insufficient stock for item {item.item_name}")
                        item.current_stock_quantity -= quantity_diff
                    else:
                        item.current_stock_quantity += abs(quantity_diff)

            old_li.quantity = new_quantity
            old_li.price = new_price
            old_li.discount_amount = new_discount
            old_li.discount_type = new_discount_type
            db.add(old_li)
        else:
            item = db.query(ItemModel).filter(ItemModel.id == item_id).first()
            if not item:
                raise HTTPException(status_code=404, detail=f"Item with id {item_id} not found")

            if item.current_stock_quantity < new_quantity:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for item {item.item_name}")

            item.current_stock_quantity -= new_quantity

            line_item = InvoiceLineItemModel(
                invoice_id=db_invoice.id,
                item_id=item_id,
                quantity=new_quantity,
                price=new_price,
                discount_amount=new_discount,
                discount_type=new_discount_type
            )
            db.add(line_item)

    calculation = InvoiceCalculationService.calculate_invoice_totals(
        line_items=[
            {
                "item_id": li.get('item_id'),
                "quantity": li.get('quantity', 0),
                "price": li.get('price', 0),
                "discount_amount": li.get('discount_amount', 0),
                "discount_type": li.get('discount_type', 'amount')
            }
            for li in new_line_items
        ],
        discount_type=db_invoice.discount_type or 'amount',
        discount_amount=db_invoice.discount_amount or 0,
        tax_rate=db_invoice.tax_rate or 18.0
    )

    db_invoice.sub_total = calculation["sub_total"]
    db_invoice.total_tax_amount = calculation["tax_amount"]
    db_invoice.grand_total = calculation["grand_total"]

    db.commit()
    db.refresh(db_invoice)

    return {
        'id': db_invoice.id,
        'invoice_number': db_invoice.invoice_number,
        'invoice_date': db_invoice.invoice_date.isoformat(),
        'due_date': db_invoice.due_date.isoformat() if db_invoice.due_date else None,
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
        'po_number': db_invoice.po_number,
        'shipping_address': db_invoice.shipping_address,
        'notes': db_invoice.notes,
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
            for li in db_invoice.line_items
        ],
    }
