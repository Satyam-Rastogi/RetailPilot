#!/usr/bin/env python3
"""
Delete all seeded data from RetailPilot database.
Keeps table structure intact. Resets all sequences.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal
from app.models.return_receipt import ReturnLineItemModel, ReturnReceiptModel
from app.models.payment import PaymentAllocationModel, PaymentModel
from app.models.stock_audit import StockAuditModel
from app.models.invoice import InvoiceLineItemModel, InvoiceModel
from app.models.invoice_sequence import InvoiceSequenceModel
from app.models.item_variant import ItemVariantModel
from app.models.item import ItemModel
from app.models.customer import CustomerModel
from app.models.supplier import SupplierModel
from app.models.company_profile import CompanyProfileModel

ORDER = [
    ReturnLineItemModel,
    ReturnReceiptModel,
    PaymentAllocationModel,
    PaymentModel,
    StockAuditModel,
    InvoiceLineItemModel,
    InvoiceModel,
    InvoiceSequenceModel,
    ItemVariantModel,
    ItemModel,
    CustomerModel,
    SupplierModel,
    CompanyProfileModel,
]

def run():
    db = SessionLocal()
    try:
        for model in ORDER:
            count = db.query(model).delete()
            print(f"  Deleted {count:>4} rows from {model.__tablename__}")
        db.commit()
        print("\nAll data cleared.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    run()
