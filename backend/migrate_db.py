from app.db.session import engine
from app.db.base import Base
from app.models import company_profile, customer, supplier, item, invoice_sequence, return_receipt

Base.metadata.create_all(bind=engine)

print("Database tables created successfully!")
print("Tables:")
print("  - invoice_sequences")
print("  - return_receipts")
print("  - return_line_items")
