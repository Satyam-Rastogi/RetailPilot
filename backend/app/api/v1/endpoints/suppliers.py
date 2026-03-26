from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.session import get_db
from app.models.supplier import SupplierModel
from app.schemas.supplier import Supplier, SupplierCreate, SupplierUpdate, SupplierListResponse
from app.schemas.pagination import PaginatedResponse
from app.utils.pagination import paginate_query

router = APIRouter()


@router.get("/", response_model=PaginatedResponse[SupplierListResponse])
def get_suppliers(
  skip: int = Query(0, ge=0),
  limit: int = Query(100, ge=1, le=100),
  page: int = Query(1, ge=1),
  page_size: int = Query(100, ge=1, le=100),
  search: Optional[str] = None,
  db: Session = Depends(get_db)
):
  query = db.query(SupplierModel)

  if search:
    query = query.filter(SupplierModel.name.ilike(f"%{search}%"))

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


@router.get("/{supplier_id}", response_model=Supplier)
def get_supplier(supplier_id: int, db: Session = Depends(get_db)):
  supplier = db.query(SupplierModel).filter(SupplierModel.id == supplier_id).first()
  if not supplier:
    raise HTTPException(status_code=404, detail="Supplier not found")
  return supplier


@router.post("/", response_model=Supplier)
def create_supplier(supplier: SupplierCreate, db: Session = Depends(get_db)):
  db_supplier = SupplierModel(**supplier.model_dump())
  db.add(db_supplier)
  db.commit()
  db.refresh(db_supplier)
  return db_supplier


@router.put("/{supplier_id}", response_model=Supplier)
def update_supplier(supplier_id: int, supplier: SupplierUpdate, db: Session = Depends(get_db)):
  db_supplier = db.query(SupplierModel).filter(SupplierModel.id == supplier_id).first()
  if not db_supplier:
    raise HTTPException(status_code=404, detail="Supplier not found")
  
  for key, value in supplier.model_dump(exclude_unset=True).items():
    setattr(db_supplier, key, value)
  
  db.commit()
  db.refresh(db_supplier)
  return db_supplier


@router.delete("/{supplier_id}")
def delete_supplier(supplier_id: int, db: Session = Depends(get_db)):
  db_supplier = db.query(SupplierModel).filter(SupplierModel.id == supplier_id).first()
  if not db_supplier:
    raise HTTPException(status_code=404, detail="Supplier not found")
  
  db.delete(db_supplier)
  db.commit()
  return {"message": "Supplier deleted successfully"}
