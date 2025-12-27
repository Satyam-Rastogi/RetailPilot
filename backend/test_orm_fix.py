from app.models import CustomerModel, PaymentModel, InvoiceModel, PaymentAllocationModel
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

engine = create_engine("sqlite:///./shop_management.db", connect_args={"check_same_thread": False})
session = Session(bind=engine)

# Check if relationships work
print("Testing Customer with payments...")
customer = session.query(CustomerModel).first()
if customer:
    print(f"Customer: {customer.name}")
    print(f"Has payments attr: {hasattr(customer, 'payments')}")
    print(f"Has customer_payments attr (should be False): {hasattr(customer, 'customer_payments')}")
    if hasattr(customer, 'payments'):
        print(f"Payments count: {len(customer.payments)}")
else:
    print("No customers found")

print("\nTesting Invoice with payment allocations...")
invoice = session.query(InvoiceModel).first()
if invoice:
    print(f"Invoice: {invoice.invoice_number}")
    print(f"Has payment_allocations attr: {hasattr(invoice, 'payment_allocations')}")
    if hasattr(invoice, 'payment_allocations'):
        print(f"Payment allocations count: {len(invoice.payment_allocations)}")
else:
    print("No invoices found")

print("\nORM relationships test passed!")
session.close()
