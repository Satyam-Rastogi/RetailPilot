"""
Seed script for Wholesale Ledger feature with payments and allocations.
"""

from app.db.session import SessionLocal
from app.models.customer import CustomerModel
from app.models.invoice import InvoiceModel, PaymentStatus
from datetime import datetime, timedelta
import random

db = SessionLocal()

try:
    # Get or create wholesale customer
    customer = db.query(CustomerModel).filter(CustomerModel.name == "Rajesh Traders").first()

    if not customer:
        customer = CustomerModel(
            name="Rajesh Traders",
            phone_number="+91 87654 32109",
            address="45, Commercial Street, Chennai",
            gstin="29ZYXWV9876G2H4",
            customer_type="Wholesale",
            notes="Bulk buyer, orders monthly"
        )
        db.add(customer)
        db.flush()

    # Create invoices with varying dates (Jan to Dec 2025)
    # Total invoiced: 300000, to simulate multiple payments
    invoices_data = [
        {
            "invoice_date": datetime(2025, 1, 10),
            "grand_total": 80000,
            "description": "January bulk order"
        },
        {
            "invoice_date": datetime(2025, 2, 5),
            "grand_total": 50000,
            "description": "February partial order"
        },
        {
            "invoice_date": datetime(2025, 3, 8),
            "grand_total": 60000,
            "description": "March bulk order"
        },
        {
            "invoice_date": datetime(2025, 4, 12),
            "grand_total": 70000,
            "description": "April stock refresh"
        },
        {
            "invoice_date": datetime(2025, 5, 15),
            "grand_total": 40000,
            "description": "May emergency order"
        },
    ]

    # Create invoices
    for i, inv_data in enumerate(invoices_data):
        invoice = InvoiceModel(
            invoice_number=f"INV-2025-{i+1:05d}-WS",
            invoice_date=inv_data["invoice_date"],
            customer_id=customer.id,
            discount_type="percent",
            discount_amount=5.0 if i < 2 else 0.0,
            tax_rate=18.0,
            sub_total=inv_data["grand_total"] / 1.18,
            total_tax_amount=inv_data["grand_total"] - inv_data["sub_total"],
            grand_total=inv_data["grand_total"],
            amount_paid=0,
            payment_status=PaymentStatus.UNPAID,
            notes=inv_data["description"]
        )
        db.add(invoice)
        db.flush()

        # Add some line items (using item_id 1 as placeholder)
        from app.models.item import ItemModel
        item = db.query(ItemModel).filter(ItemModel.id == 1).first()

        if item:
            from app.models.invoice import InvoiceLineItemModel
            line_item = InvoiceLineItemModel(
                invoice_id=invoice.id,
                item_id=item.id,
                quantity=int(inv_data["grand_total"] / item.selling_price_wholesale),
                price=item.selling_price_wholesale,
                discount_amount=0,
                discount_type="amount"
            )
            db.add(line_item)
        else:
            print(f"WARNING: Could not find item_id 1 for invoice {invoice.invoice_number}")

        db.commit()
        print(f"Created invoice: {invoice.invoice_number} - Total: {invoice.grand_total}")

    print(f"\n=== Created {len(invoices_data)} invoices for {customer.name} ===")

    db.close()
    print("\n✅ Database seeded successfully!")
    print("\n📝 Summary:")
    print(f"   - Wholesale Customer: Rajesh Traders")
    print(f"   - Invoices: {len(invoices_data)}")
    print(f"   - Total Invoiced: 300,000")
    print(f"   - Total Paid: 0")
    print(f"   - Total Unpaid: 300,000")
    print("\n💡 Next Steps:")
    print("   1. Restart backend server to pick up new models")
    print("   2. Post payments via POST /api/v1/payments")
    print("   3. View ledger at GET /api/v1/customers/2/ledger")

except Exception as e:
    db.rollback()
    print(f"\n❌ Error seeding database: {e}")
    import traceback
    traceback.print_exc()
finally:
    db.close()
