from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from app.db.session import get_db
from app.models.item import ItemModel
from app.models.item_variant import ItemVariantModel
from app.models.stock_audit import StockAuditModel
from app.schemas.item import (
  Item, ItemCreate, ItemUpdate, ItemListResponse,
  ItemVariantCreate, ItemVariantUpdate, ItemVariantResponse, ItemVariantStockAdjust,
)
from app.schemas.stock import StockAdjust, StockAuditResponse
from app.schemas.pagination import PaginatedResponse
from app.utils.pagination import paginate_query

router = APIRouter()


def _build_list_response(item: ItemModel) -> ItemListResponse:
  total_stock = item.current_stock_quantity
  if item.has_variants and item.variants:
    total_stock = sum(v.stock_quantity for v in item.variants)

  threshold = item.low_stock_threshold or 0
  is_low = item.enable_low_stock_alert and total_stock <= threshold

  return ItemListResponse(
    id=item.id,
    item_name=item.item_name,
    brand_name=item.brand_name,
    sku=item.sku,
    unit_of_measurement=item.unit_of_measurement,
    current_stock_quantity=total_stock,
    purchase_price=item.purchase_price,
    selling_price_retail=item.selling_price_retail,
    selling_price_wholesale=item.selling_price_wholesale,
    enable_low_stock_alert=item.enable_low_stock_alert,
    low_stock_threshold=item.low_stock_threshold,
    is_low_stock=is_low,
    has_variants=item.has_variants,
    variant_type=item.variant_type,
    hsn_sac_code=item.hsn_sac_code,
    gst_rate=item.gst_rate,
    variants_count=len(item.variants),
    variants=[ItemVariantResponse.model_validate(v) for v in item.variants],
  )


# ── Items list ─────────────────────────────────────────────────────────────────

@router.get("/", response_model=PaginatedResponse[ItemListResponse])
def get_items(
  page: int = Query(1, ge=1),
  page_size: int = Query(20, ge=1, le=1000),
  search: Optional[str] = None,
  low_stock_only: bool = Query(False, description="Return only items that are at or below their low-stock threshold"),
  db: Session = Depends(get_db),
):
  query = db.query(ItemModel).options(joinedload(ItemModel.variants)).filter(ItemModel.is_active == True)

  if search:
    query = query.filter(
      ItemModel.item_name.ilike(f"%{search}%") |
      ItemModel.sku.ilike(f"%{search}%") |
      ItemModel.brand_name.ilike(f"%{search}%")
    )

  if low_stock_only:
    # Filter at DB level for non-variant items (fast path).
    # Variant items: load the enable_low_stock_alert ones and post-filter.
    query = query.filter(ItemModel.enable_low_stock_alert == True)

  data, total_items, total_pages = paginate_query(query, page, page_size)

  if low_stock_only:
    # Post-filter to include variant items where summed stock is low
    data = [item for item in data if _build_list_response(item).is_low_stock]
    total_items = len(data)
    total_pages = 1
  result = [_build_list_response(item) for item in data]

  return PaginatedResponse(
    data=result,
    total_items=total_items,
    total_pages=total_pages,
    current_page=page,
    page_size=page_size,
    has_next=page < total_pages,
    has_previous=page > 1,
  )


# ── Stock audit list ───────────────────────────────────────────────────────────

@router.get("/stock-audit/", response_model=PaginatedResponse[StockAuditResponse])
def get_stock_audits(
  page: int = Query(1, ge=1),
  page_size: int = Query(20, ge=1, le=100),
  item_id: Optional[int] = Query(None),
  db: Session = Depends(get_db),
):
  query = db.query(StockAuditModel).order_by(StockAuditModel.created_at.desc())
  if item_id:
    query = query.filter(StockAuditModel.item_id == item_id)

  data, total_items, total_pages = paginate_query(query, page, page_size)

  result = [
    StockAuditResponse(
      id=entry.id,
      item_id=entry.item_id,
      item_name=entry.item.item_name if entry.item else None,
      delta=entry.delta,
      delta_after=entry.delta_after,
      reason=entry.reason,
      created_at=entry.created_at,
    )
    for entry in data
  ]

  return PaginatedResponse(
    data=result,
    total_items=total_items,
    total_pages=total_pages,
    current_page=page,
    page_size=page_size,
    has_next=page < total_pages,
    has_previous=page > 1,
  )


# ── Item detail ────────────────────────────────────────────────────────────────

@router.get("/{item_id}", response_model=Item)
def get_item(item_id: int, db: Session = Depends(get_db)):
  item = db.query(ItemModel).options(joinedload(ItemModel.variants)).filter(ItemModel.id == item_id, ItemModel.is_active == True).first()
  if not item:
    raise HTTPException(status_code=404, detail="Item not found")
  return item


# ── Create item ────────────────────────────────────────────────────────────────

@router.post("/", response_model=Item)
def create_item(item: ItemCreate, db: Session = Depends(get_db)):
  db_item = ItemModel(**item.model_dump())
  db.add(db_item)
  db.commit()
  db.refresh(db_item)
  return db_item


# ── Update item ────────────────────────────────────────────────────────────────

@router.put("/{item_id}", response_model=Item)
def update_item(item_id: int, item: ItemUpdate, db: Session = Depends(get_db)):
  db_item = db.query(ItemModel).options(joinedload(ItemModel.variants)).filter(ItemModel.id == item_id).first()
  if not db_item:
    raise HTTPException(status_code=404, detail="Item not found")

  for key, value in item.model_dump(exclude_unset=True).items():
    setattr(db_item, key, value)

  db.commit()
  db.refresh(db_item)
  return db_item


# ── Delete item ────────────────────────────────────────────────────────────────

@router.delete("/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db)):
  db_item = db.query(ItemModel).filter(ItemModel.id == item_id, ItemModel.is_active == True).first()
  if not db_item:
    raise HTTPException(status_code=404, detail="Item not found")
  db_item.is_active = False
  db.commit()
  return {"message": "Item deleted successfully"}


# ── Adjust parent stock ────────────────────────────────────────────────────────

@router.post("/{item_id}/stock", response_model=Item)
def adjust_stock(item_id: int, payload: StockAdjust, db: Session = Depends(get_db)):
  item = db.query(ItemModel).options(joinedload(ItemModel.variants)).filter(ItemModel.id == item_id).first()
  if not item:
    raise HTTPException(status_code=404, detail="Item not found")

  new_qty = item.current_stock_quantity + payload.delta
  if new_qty < 0:
    raise HTTPException(status_code=400, detail="Stock cannot be negative")

  item.current_stock_quantity = new_qty
  audit = StockAuditModel(
    item_id=item_id,
    delta=payload.delta,
    delta_after=new_qty,
    reason=payload.reason or "Manual adjustment",
  )
  db.add(audit)
  db.commit()
  db.refresh(item)
  return item


# ── Variant CRUD ───────────────────────────────────────────────────────────────

@router.get("/{item_id}/variants/", response_model=list[ItemVariantResponse])
def get_variants(item_id: int, db: Session = Depends(get_db)):
  item = db.query(ItemModel).filter(ItemModel.id == item_id).first()
  if not item:
    raise HTTPException(status_code=404, detail="Item not found")
  return item.variants


@router.post("/{item_id}/variants/", response_model=ItemVariantResponse)
def create_variant(item_id: int, payload: ItemVariantCreate, db: Session = Depends(get_db)):
  item = db.query(ItemModel).filter(ItemModel.id == item_id).first()
  if not item:
    raise HTTPException(status_code=404, detail="Item not found")

  variant = ItemVariantModel(
    item_id=item_id,
    variant_value=payload.variant_value,
    sku=payload.sku,
    stock_quantity=payload.stock_quantity or 0,
  )
  db.add(variant)
  item.has_variants = True
  db.commit()
  db.refresh(variant)
  return variant


@router.put("/{item_id}/variants/{variant_id}", response_model=ItemVariantResponse)
def update_variant(item_id: int, variant_id: int, payload: ItemVariantUpdate, db: Session = Depends(get_db)):
  variant = db.query(ItemVariantModel).filter(
    ItemVariantModel.id == variant_id,
    ItemVariantModel.item_id == item_id,
  ).first()
  if not variant:
    raise HTTPException(status_code=404, detail="Variant not found")

  for key, value in payload.model_dump(exclude_unset=True).items():
    setattr(variant, key, value)

  db.commit()
  db.refresh(variant)
  return variant


@router.delete("/{item_id}/variants/{variant_id}")
def delete_variant(item_id: int, variant_id: int, db: Session = Depends(get_db)):
  variant = db.query(ItemVariantModel).filter(
    ItemVariantModel.id == variant_id,
    ItemVariantModel.item_id == item_id,
  ).first()
  if not variant:
    raise HTTPException(status_code=404, detail="Variant not found")

  db.delete(variant)
  db.flush()

  remaining = db.query(ItemVariantModel).filter(ItemVariantModel.item_id == item_id).count()
  if remaining == 0:
    item = db.query(ItemModel).filter(ItemModel.id == item_id).first()
    if item:
      item.has_variants = False
      item.variant_type = None

  db.commit()
  return {"message": "Variant deleted"}


@router.post("/{item_id}/variants/{variant_id}/stock", response_model=ItemVariantResponse)
def adjust_variant_stock(
  item_id: int,
  variant_id: int,
  payload: ItemVariantStockAdjust,
  db: Session = Depends(get_db),
):
  variant = db.query(ItemVariantModel).filter(
    ItemVariantModel.id == variant_id,
    ItemVariantModel.item_id == item_id,
  ).first()
  if not variant:
    raise HTTPException(status_code=404, detail="Variant not found")

  new_qty = variant.stock_quantity + payload.delta
  if new_qty < 0:
    raise HTTPException(status_code=400, detail="Stock cannot be negative")

  variant.stock_quantity = new_qty
  audit = StockAuditModel(
    item_id=item_id,
    delta=payload.delta,
    delta_after=new_qty,
    reason=payload.reason or f"Variant '{variant.variant_value}' adjustment",
  )
  db.add(audit)
  db.commit()
  db.refresh(variant)
  return variant
