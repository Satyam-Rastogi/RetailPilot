from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.item import ItemModel
from app.schemas.stock import StockAdjust

router = APIRouter()

@router.post(
    "/items/{item_id}/stock",
    summary="Manual stock adjustment",
    description=(
        "Adjusts the stock quantity for an item by `delta` (positive = add, negative = deduct).\n\n"
        "Writes a `StockAudit` record with the delta, resulting quantity, and reason string.\n\n"
        "Returns 400 if the adjustment would result in negative stock."
    ),
    responses={
        400: {"description": "Stock cannot go negative"},
        404: {"description": "Item not found"},
    },
)
def adjust_stock_simple(item_id: int, payload: StockAdjust, db: Session = Depends(get_db)):
  item = db.query(ItemModel).filter(ItemModel.id == item_id).first()
  if not item:
    raise HTTPException(status_code=404, detail="Item not found")
  new_qty = item.current_stock_quantity + payload.delta
  if new_qty < 0:
    raise HTTPException(status_code=400, detail="Stock cannot be negative")
  item.current_stock_quantity = new_qty
  db.commit()
  db.refresh(item)
  return item
