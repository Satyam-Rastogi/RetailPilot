from fastapi import APIRouter
from app.api.v1.endpoints import company_profile, customers, suppliers, items, invoices, stock, returns, payments

api_router = APIRouter()

api_router.include_router(company_profile.router, prefix="/company-profile", tags=["Company Profile"])
api_router.include_router(customers.router, prefix="/customers", tags=["Customers"])
api_router.include_router(suppliers.router, prefix="/suppliers", tags=["Suppliers"])
api_router.include_router(items.router, prefix="/items", tags=["Items"])
api_router.include_router(invoices.router, prefix="/invoices", tags=["Invoices"])
api_router.include_router(stock.router, tags=["Stock"])
api_router.include_router(returns.router, prefix="/returns", tags=["Returns"])
api_router.include_router(payments.router, prefix="/payments", tags=["Payments"])
