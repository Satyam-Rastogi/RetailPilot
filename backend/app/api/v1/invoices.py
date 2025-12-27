from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app.db.session import get_db
from app.models.invoice import InvoiceModel, InvoiceLineItemModel, PaymentStatus
from app.models.customer import CustomerModel
from app.models.item import ItemModel
from app.schemas.invoice import (
  Invoice, InvoiceCreate, InvoiceUpdate, InvoiceListResponse,
  InvoiceLineItem, InvoiceCalculationResponse
)
from app.domain.services.calculation_service import InvoiceCalculationService

router = APIRouter()


@router.get("/", response_model=List[InvoiceListResponse])
def get_invoices(
  skip: int = Query(0, ge=0),
  limit: int = Query(100, ge=1, le=100),
  db: Session = Depends(get_db)
):
  invoices = db.query(InvoiceModel).order_by(InvoiceModel.invoice_date.desc()).offset(skip).limit(limit).all()
  return invoices


@router.get("/{invoice_id}", response_model=Invoice)
def get_invoice(invoice_id: int, db: Session = Depends(get_db)):
  invoice = db.query(InvoiceModel).filter(InvoiceModel.id == invoice_id).first()
  if not invoice:
    raise HTTPException(status_code=404, detail="Invoice not found")
  return invoice


@router.post("/calculate", response_model=InvoiceCalculationResponse)
def calculate_invoice_totals(invoice_data: InvoiceCreate, db: Session = Depends(get_db)):
  line_items = [
    {
      "item_id": item.item_id,
      "quantity": item.quantity,
      "unit_price": item.unit_price,
      "line_discount_amount": item.line_discount_amount,
      "line_discount_percent": item.line_discount_percent
    }
    for item in invoice_data.line_items
  ]
  
  result = InvoiceCalculationService.calculate_invoice_totals(
    line_items=line_items,
    bill_discount_percent=invoice_data.bill_discount_percent,
    bill_discount_amount=invoice_data.bill_discount_amount,
    tax_rate=invoice_data.tax_rate
  )
  return result


@router.post("/", response_model=Invoice)
def create_invoice(invoice_data: InvoiceCreate, db: Session = Depends(get_db)):
  customer = db.query(CustomerModel).filter(CustomerModel.id == invoice_data.customer_id).first()
  if not customer:
    raise HTTPException(status_code=404, detail="Customer not found")
  
  calculation = InvoiceCalculationService.calculate_invoice_totals(
    line_items=[
      {
        "item_id": item.item_id,
        "quantity": item.quantity,
        "unit_price": item.unit_price,
        "line_discount_amount": item.line_discount_amount,
        "line_discount_percent": item.line_discount_percent
      }
      for item in invoice_data.line_items
    ],
    bill_discount_percent=invoice_data.bill_discount_percent,
    bill_discount_amount=invoice_data.bill_discount_amount,
    tax_rate=invoice_data.tax_rate
  )
  
  db_invoice = InvoiceModel(
    invoice_number=invoice_data.invoice_number,
    invoice_date=invoice_data.invoice_date,
    customer_id=invoice_data.customer_id,
    bill_discount_amount=invoice_data.bill_discount_amount,
    bill_discount_percent=invoice_data.bill_discount_percent,
    tax_rate=invoice_data.tax_rate,
    sub_total=calculation["sub_total"],
    total_tax_amount=calculation["tax_amount"],
    grand_total=calculation["grand_total"],
    amount_paid=0,
    payment_status=PaymentStatus.UNPAID.value,
    notes=invoice_data.notes
  )
  
  db.add(db_invoice)
  db.flush()
  
  for item_data in invoice_data.line_items:
    item = db.query(ItemModel).filter(ItemModel.id == item_data.item_id).first()
    if not item:
      raise HTTPException(status_code=404, detail=f"Item with id {item_data.item_id} not found")
    
    line_item = InvoiceLineItemModel(
      invoice_id=db_invoice.id,
      item_id=item_data.item_id,
      quantity=item_data.quantity,
      unit_price=item_data.unit_price,
      line_discount_amount=item_data.line_discount_amount,
      line_discount_percent=item_data.line_discount_percent
    )
    db.add(line_item)
    
    if item.current_stock_quantity < item_data.quantity:
      raise HTTPException(status_code=400, detail=f"Insufficient stock for item {item.item_name}")
    
    item.current_stock_quantity -= item_data.quantity
  
  db.commit()
  db.refresh(db_invoice)
  return db_invoice


@router.put("/{invoice_id}", response_model=Invoice)
def update_invoice(invoice_id: int, invoice: InvoiceUpdate, db: Session = Depends(get_db)):
  db_invoice = db.query(InvoiceModel).filter(InvoiceModel.id == invoice_id).first()
  if not db_invoice:
    raise HTTPException(status_code=404, detail="Invoice not found")
  
  for key, value in invoice.model_dump(exclude_unset=True).items():
    setattr(db_invoice, key, value)
  
  if any(hasattr(invoice, k) and getattr(invoice, k) is not None for k in ["bill_discount_amount", "bill_discount_percent"]):
    calculation = InvoiceCalculationService.calculate_invoice_totals(
      line_items=[
        {
          "item_id": li.item_id,
          "quantity": li.quantity,
          "unit_price": li.unit_price,
          "line_discount_amount": li.line_discount_amount,
          "line_discount_percent": li.line_discount_percent
        }
        for li in db_invoice.line_items
      ],
      bill_discount_percent=invoice.bill_discount_percent or db_invoice.bill_discount_percent,
      bill_discount_amount=invoice.bill_discount_amount or db_invoice.bill_discount_amount,
      tax_rate=db_invoice.tax_rate
    )
    db_invoice.sub_total = calculation["sub_total"]
    db_invoice.total_tax_amount = calculation["tax_amount"]
    db_invoice.grand_total = calculation["grand_total"]
  
  db.commit()
  db.refresh(db_invoice)
  return db_invoice


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
