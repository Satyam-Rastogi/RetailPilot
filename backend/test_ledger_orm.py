from app.models import CustomerModel, InvoiceModel

print("Testing ORM relationships...")
from app.db.session import SessionLocal

db = SessionLocal()

# Test Customer
customer = db.query(CustomerModel).first()
if customer:
    print(f"Customer: {customer.name}")
    print(f"Has payments: {hasattr(customer, 'payments')}")
else:
    print("No customers in DB")

# Test Invoice
invoice = db.query(InvoiceModel).first()
if invoice:
    print(f"Invoice: {invoice.invoice_number}")
    print(f"Has payment_allocations: {hasattr(invoice, 'payment_allocations')}")
else:
    print("No invoices in DB")

db.close()
print("Test complete!")
