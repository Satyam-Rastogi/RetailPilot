from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.db.session import get_db
from app.models.customer import CustomerModel
from app.schemas.customer import Customer, CustomerCreate, CustomerUpdate, CustomerListResponse
from app.schemas.pagination import PaginatedResponse
from app.utils.pagination import paginate_query

router = APIRouter()


@router.get("/", response_model=PaginatedResponse[CustomerListResponse])
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


@router.get("/{customer_id}", response_model=Customer)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
  customer = db.query(CustomerModel).filter(CustomerModel.id == customer_id).first()
  if not customer:
    raise HTTPException(status_code=404, detail="Customer not found")
  return customer


@router.post("/", response_model=Customer)
def create_customer(customer: CustomerCreate, db: Session = Depends(get_db)):
  db_customer = CustomerModel(**customer.model_dump())
  db.add(db_customer)
  db.commit()
  db.refresh(db_customer)
  return db_customer


@router.put("/{customer_id}", response_model=Customer)
def update_customer(customer_id: int, customer: CustomerUpdate, db: Session = Depends(get_db)):
  db_customer = db.query(CustomerModel).filter(CustomerModel.id == customer_id).first()
  if not db_customer:
    raise HTTPException(status_code=404, detail="Customer not found")
  
  for key, value in customer.model_dump(exclude_unset=True).items():
    setattr(db_customer, key, value)
  
  db.commit()
  db.refresh(db_customer)
  return db_customer


@router.delete("/{customer_id}")
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
  db_customer = db.query(CustomerModel).filter(CustomerModel.id == customer_id).first()
  if not db_customer:
    raise HTTPException(status_code=404, detail="Customer not found")
  if db_customer.name == "Walk-in Customer":
    raise HTTPException(status_code=400, detail="Walk-in Customer is a system record and cannot be deleted.")

  db.delete(db_customer)
  db.commit()
  return {"message": "Customer deleted successfully"}
