from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.session import engine
from app.db.base import Base
from app.api.v1 import api_router
from app.models import company_profile, customer, supplier, item, invoice, return_receipt, payment

Base.metadata.create_all(bind=engine)

app = FastAPI(
  title="Shop Management MVP",
  description="Shop Management System for small retail businesses",
  version="1.0.0"
)

app.add_middleware(
  CORSMiddleware,
  allow_origins=["http://localhost:3000"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/")
def health_check():
  return {"status": "healthy", "message": "Shop Management API is running"}
