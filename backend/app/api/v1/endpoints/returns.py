from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app.db.session import get_db
from app.models.return_receipt import ReturnReceiptModel, ReturnLineItemModel
from app.models.invoice import InvoiceModel
from app.models.item import ItemModel
from app.schemas.return_receipt import (
  ReturnReceipt, ReturnReceiptCreate, ReturnLineItem
)

router = APIRouter()


@router.get("/", response_model=List[dict])
def get_returns(
  skip: int = 0,
  limit: int = 100,
  db: Session = Depends(get_db)
):
  returns = db.query(ReturnReceiptModel).order_by(ReturnReceiptModel.return_date.desc()).offset(skip).limit(limit).all()
  
  result = []
  for ret in returns:
    result.append({
      'id': ret.id,
      'invoice_id': ret.invoice_id,
      'invoice_number': ret.invoice.invoice_number if ret.invoice else None,
      'invoice_date': ret.invoice.invoice_date.isoformat() if ret.invoice else None,
      'total_credit': ret.total_credit,
      'notes': ret.notes,
      'created_at': ret.created_at.isoformat(),
    })
  
  return result


@router.get("/{return_id}", response_model=dict)
def get_return(return_id: int, db: Session = Depends(get_db)):
  return_receipt = db.query(ReturnReceiptModel).filter(ReturnReceiptModel.id == return_id).first()
  
  if not return_receipt:
    raise HTTPException(status_code=404, detail="Return not found")
  
  line_items = db.query(ReturnLineItemModel).filter(ReturnLineItemModel.return_receipt_id == return_id).all()
  
  item_details = {}
  for item in line_items:
    db_item = db.query(ItemModel).filter(ItemModel.id == item.item_id).first()
    if db_item:
      item_details[item.item_id] = {
        'item_name': db_item.item_name,
        'returnable_quantity': db_item.current_stock_quantity + item.quantity_returned
      }
  
  return {
    'id': return_receipt.id,
    'invoice_id': return_receipt.invoice_id,
    'invoice_number': return_receipt.invoice.invoice_number if return_receipt.invoice else None,
    'invoice_date': return_receipt.invoice.invoice_date.isoformat() if return_receipt.invoice else None,
    'total_credit': return_receipt.total_credit,
    'notes': return_receipt.notes,
    'created_at': return_receipt.created_at.isoformat(),
    'line_items': [
      {
        'id': item.id,
        'return_receipt_id': item.return_receipt_id,
        'item_id': item.item_id,
        'item_name': item_details.get(item.item_id, {}).get('item_name'),
        'quantity_returned': item.quantity_returned,
        'amount': item.amount,
        'reason': item.reason,
      }
      for item in line_items
    ],
  }


@router.post("/", response_model=dict)
def create_return(return_data: ReturnReceiptCreate, db: Session = Depends(get_db)):
  invoice = db.query(InvoiceModel).filter(InvoiceModel.id == return_data.invoice_id).first()
  
  if not invoice:
    raise HTTPException(status_code=404, detail="Invoice not found")
  
  total_credit = sum(item.amount for item in return_data.line_items)
  
  db_return = ReturnReceiptModel(
    invoice_id=return_data.invoice_id,
    return_date=return_data.return_date,
    total_credit=total_credit,
    notes=return_data.notes
  )
  db.add(db_return)
  db.flush()
  
  for item_data in return_data.line_items:
    db_item = db.query(ItemModel).filter(ItemModel.id == item_data.item_id).first()
    
    if not db_item:
      raise HTTPException(status_code=404, detail=f"Item with id {item_data.item_id} not found")
    
    if db_item.current_stock_quantity < item_data.quantity_returned:
      raise HTTPException(status_code=400, detail=f"Cannot return {item_data.quantity_returned} items. Only {db_item.current_stock_quantity} available.")
    
    db_item.current_stock_quantity += item_data.quantity_returned
    
    return_line = ReturnLineItemModel(
      return_receipt_id=db_return.id,
      item_id=item_data.item_id,
      quantity_returned=item_data.quantity_returned,
      amount=item_data.amount,
      reason=item_data.reason
    )
    db.add(return_line)
  
  db.commit()
  db.refresh(db_return)
  
  return {
    'id': db_return.id,
    'invoice_id': db_return.invoice_id,
    'invoice_number': db_return.invoice.invoice_number if db_return.invoice else None,
    'invoice_date': db_return.invoice.invoice_date.isoformat() if db_return.invoice else None,
    'total_credit': db_return.total_credit,
    'notes': db_return.notes,
    'created_at': db_return.created_at.isoformat(),
  }
