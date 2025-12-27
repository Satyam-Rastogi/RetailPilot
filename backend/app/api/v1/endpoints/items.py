from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.session import get_db
from app.models.item import ItemModel
from app.schemas.item import Item, ItemCreate, ItemUpdate, ItemListResponse

router = APIRouter()


@router.get("/", response_model=List[ItemListResponse])
def get_items(
  skip: int = Query(0, ge=0),
  limit: int = Query(100, ge=1, le=100),
  search: Optional[str] = None,
  db: Session = Depends(get_db)
):
  query = db.query(ItemModel)
  
  if search:
    query = query.filter(ItemModel.item_name.ilike(f"%{search}%"))
  
  items = query.offset(skip).limit(limit).all()
  
  result = []
  for item in items:
    item_dict = {
      "id": item.id,
      "item_name": item.item_name,
      "brand_name": item.brand_name,
      "sku": item.sku,
      "current_stock_quantity": item.current_stock_quantity,
      "selling_price_retail": item.selling_price_retail,
      "selling_price_wholesale": item.selling_price_wholesale,
      "enable_low_stock_alert": item.enable_low_stock_alert,
      "low_stock_threshold": item.low_stock_threshold,
      "is_low_stock": item.enable_low_stock_alert and 
                      item.low_stock_threshold is not None and 
                      item.current_stock_quantity <= item.low_stock_threshold
    }
    result.append(ItemListResponse(**item_dict))
  
  return result


@router.get("/{item_id}", response_model=Item)
def get_item(item_id: int, db: Session = Depends(get_db)):
  item = db.query(ItemModel).filter(ItemModel.id == item_id).first()
  if not item:
    raise HTTPException(status_code=404, detail="Item not found")
  return item


@router.post("/", response_model=Item)
def create_item(item: ItemCreate, db: Session = Depends(get_db)):
  db_item = ItemModel(**item.model_dump())
  db.add(db_item)
  db.commit()
  db.refresh(db_item)
  return db_item


@router.put("/{item_id}", response_model=Item)
def update_item(item_id: int, item: ItemUpdate, db: Session = Depends(get_db)):
  db_item = db.query(ItemModel).filter(ItemModel.id == item_id).first()
  if not db_item:
    raise HTTPException(status_code=404, detail="Item not found")
  
  for key, value in item.model_dump(exclude_unset=True).items():
    setattr(db_item, key, value)
  
  db.commit()
  db.refresh(db_item)
  return db_item


@router.delete("/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db)):
  db_item = db.query(ItemModel).filter(ItemModel.id == item_id).first()
  if not db_item:
    raise HTTPException(status_code=404, detail="Item not found")
  
  db.delete(db_item)
  db.commit()
  return {"message": "Item deleted successfully"}


# Stock adjustment endpoint
from app.schemas.stock import StockAdjust

@router.post("/{item_id}/stock", response_model=Item)
def adjust_stock(item_id: int, payload: StockAdjust, db: Session = Depends(get_db)):
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
