from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models import (
    CustomerModel, InvoiceModel, PaymentModel, PaymentAllocationModel,
    ItemModel, InvoiceLineItemModel, SupplierModel, CompanyProfileModel
)
from app.db.session import SessionLocal

# Utility: safe clear in proper order

def clear_all_data(db: Session):
    db.query(PaymentAllocationModel).delete()
    db.query(PaymentModel).delete()
    db.query(InvoiceLineItemModel).delete()
    db.query(InvoiceModel).delete()
    db.query(CustomerModel).delete()
    db.query(ItemModel).delete()
    db.query(SupplierModel).delete()
    db.query(CompanyProfileModel).delete()
    db.commit()
    print("Cleared all seed data")

# Seed helpers

def seed_company_profile(db: Session):
    profile = CompanyProfileModel(
        shop_name="RetailPilot Test Store",
        shop_address="123 Market Street, Textile City",
        shop_phone="+91 12345 67890",
        shop_gstin="GSTSHOP123456",
        receiver_bank_name="Test Bank",
        receiver_account_number="1234567890",
        receiver_ifsc_code="TEST0001234",
        default_tax_rate=18.0,
        currency_symbol="₹"
    )
    db.add(profile)
    db.flush()
    print("Seeded company profile")


def seed_items(db):
    names = [
        "Kanjeevaram Silk Saree","Banarasi Silk Saree","Chiffon Saree","Kota Silk Saree",
        "Patola Silk Saree","Cotton Fabric (m)","Silk Thread","Organza Saree",
        "Georgette Saree","Linen Saree","Silk Saree (Embroidered)","Crepe Silk Saree"
    ]
    items = []
    for i, name in enumerate(names):
        item = ItemModel(item_name=name,
                         brand_name="Test Brand",
                         selling_price_retail=1000.0*(i+1),
                         selling_price_wholesale=800.0*(i+1),
                         current_stock_quantity=20*(i+1),
                         unit_of_measurement="pcs")
        db.add(item)
        items.append(item)
    db.flush()
    print(f"Seeded {len(items)} items")
    return items


def seed_suppliers(db):
    suppliers = [
        {"name": "Nova Textiles", "contact_person": "Raj Kumar", "phone_number": "+91 98765 43210", "gstin": "GSTSUPPLIER001"},
        {"name": "Silk & Co", "contact_person": "Amit Singh", "phone_number": "+91 87654 32109", "gstin": "GSTSUPPLIER002"},
        {"name": "Weave World", "contact_person": "Priya Mehta", "phone_number": "+91 76543 21098", "gstin": "GSTSUPPLIER003"},
        {"name": "Heritage Fabrics", "contact_person": "Suresh Patel", "phone_number": "+91 65432 10987", "gstin": "GSTSUPPLIER004"},
        {"name": "SilkRoute Supplies", "contact_person": "Neha Gupta", "phone_number": "+91 54321 98765", "gstin": "GSTSUPPLIER005"},
    ]
    created = []
    for s in suppliers:
        obj = SupplierModel(**s)
        db.add(obj)
        created.append(obj)
    db.flush()
    print(f"Seeded {len(created)} suppliers")
    return created


def seed_customers(db):
    wholes = [
        {"name":"Rajesh Traders","phone":"+91 98765 43210","type":"Wholesale","address":"123 Market Road","gstin":"GSC001"},
        {"name":"Anita Wholesale Corp","phone":"+91 87654 32109","type":"Wholesale","address":"456 Commerce Lane","gstin":"GSC002"},
        {"name":"Vijay Distributors","phone":"+91 76543 21098","type":"Wholesale","address":"789 Business Park","gstin":"GSC003"},
        {"name":"Priya Enterprises","phone":"+91 65432 10987","type":"Wholesale","address":"321 Trade Center","gstin":"GSC004"},
        {"name":"Anand Textiles","phone":"+91 54321 98760","type":"Wholesale","address":"10 Silk Ave","gstin":"GSC005"},
    ]
    retail = [
        {"name":"Kiran Retailer","phone":"+91 99999 11111","type":"Retail","address":"987 Shop Lane","gstin":"GRC001"},
        {"name":"Sunita Fashion","phone":"+91 88888 22222","type":"Retail","address":"12 Mall Road","gstin":"GRC002"},
        {"name":"Meera Textiles","phone":"+91 77777 33333","type":"Retail","address":"34 Market Street","gstin":"GRC003"},
    ]
    all = []
    for c in wholes + retail:
        cust = CustomerModel(name=c["name"] , phone_number=c["phone"], customer_type=c["type"], address=c["address"], gstin=c["gstin"], notes="Seeded")
        db.add(cust)
        all.append(cust)
    db.flush()
    print(f"Seeded {len(all)} customers")
    return all


def seed_invoices(db, items, customers):
    invoices = []
    # Vary invoice counts per customer: some have 1, some 3, some 5
    invoice_counts = [5, 3, 1, 4, 2, 5, 3, 1]  # for 8 customers

    for i, customer in enumerate(customers):
        n = invoice_counts[i]
        for j in range(n):
            subtotal = 20000 + (i+j)*2000
            tax = subtotal * 0.18
            grand = subtotal + tax
            month = 11 + (j % 2)  # Alternate months to avoid invalid dates
            day = 10 + j
            if month > 12:
                month = 12
                day = 10
            inv = InvoiceModel(invoice_number=f"INV-2024-{month:02d}{day:02d}{i}-{j}-WS" if customer.customer_type == "Wholesale" else f"INV-2024-{month:02d}{day:02d}{i}-{j}-RE",
                               invoice_date=datetime(2024, month, day if day <= 28 else 28),
                               customer_id=customer.id,
                               discount_type="amount", discount_amount=0,
                               tax_rate=18.0, sub_total=subtotal, total_tax_amount=tax, grand_total=grand,
                               amount_paid=0, notes=f"Invoice for {customer.name}")
            db.add(inv)
            db.flush()  # Flush to get invoice.id
            invoices.append(inv)
            item = items[(i + j) % len(items)]
            li = InvoiceLineItemModel(invoice_id=inv.id, item_id=item.id, quantity=1, price=item.selling_price_retail, discount_amount=0, discount_type="amount")
            db.add(li)
        db.flush()
        print(f"Created {n} invoices for {customer.name}")

    print(f"Seeded {len(invoices)} invoices")
    return invoices


def seed_payments(db, customers, invoices):
    # First calculate total invoiced amounts for each customer
    customer_totals = {}
    for customer in customers:
        customer_invoices = [inv for inv in invoices if inv.customer_id == customer.id]
        total_invoiced = sum(inv.grand_total for inv in customer_invoices)
        customer_totals[customer.id] = total_invoiced
        print(f"Customer {customer.id} ({customer.name}): Total Invoiced = {total_invoiced:.2f}, Invoice Count = {len(customer_invoices)}")

    # Define payment data (will be created via allocate_payment)
    # Create payments that are significantly less than total invoiced amounts (max 80%)
    payment_data = [
        # Rajesh Traders (WS) - 5 invoices: total ~147k -> payments: 50k + 30k = 80k (54% - well under)
        {"customer_id": customers[0].id, "date": datetime(2024,12,1), "amount": 50000, "notes": "Seed payment"},
        {"customer_id": customers[0].id, "date": datetime(2025,1,5), "amount": 30000, "notes": "Seed payment"},

        # Anita Wholesale (WS) - 3 invoices: total ~85k -> payments: 20k + 15k + 10k = 45k (53% - well under)
        {"customer_id": customers[1].id, "date": datetime(2024,12,5), "amount": 20000, "notes": "Seed payment"},
        {"customer_id": customers[1].id, "date": datetime(2025,1,5), "amount": 15000, "notes": "Seed payment"},
        {"customer_id": customers[1].id, "date": datetime(2025,1,15), "amount": 10000, "notes": "Seed payment"},

        # Vijay Distributors (WS) - 1 invoice: total ~24k -> payments: 10k + 8k = 18k (76% - well under)
        {"customer_id": customers[2].id, "date": datetime(2024,12,10), "amount": 10000, "notes": "Seed payment"},
        {"customer_id": customers[2].id, "date": datetime(2025,1,5), "amount": 8000, "notes": "Seed payment"},

        # Priya Enterprises (WS) - 4 invoices: total ~95k -> payments: 30k + 25k = 55k (58% - well under)
        {"customer_id": customers[3].id, "date": datetime(2024,12,15), "amount": 30000, "notes": "Seed payment"},
        {"customer_id": customers[3].id, "date": datetime(2025,1,5), "amount": 25000, "notes": "Seed payment"},

        # Anand Textiles (WS) - 2 invoices: total ~47k -> payment: 30k (64% - well under)
        {"customer_id": customers[4].id, "date": datetime(2025,1,10), "amount": 30000, "notes": "Seed payment"},

        # Retail customers - smaller amounts (all under 80% of totals)
        {"customer_id": customers[5].id, "date": datetime(2025,1,10), "amount": 40000, "notes": "Seed payment"},  # Kiran
        {"customer_id": customers[6].id, "date": datetime(2025,1,10), "amount": 28000, "notes": "Seed payment"},  # Sunita
        {"customer_id": customers[7].id, "date": datetime(2025,1,10), "amount": 15000, "notes": "Seed payment"},  # Meera
    ]

    # Verify no overpayments before allocating
    for customer in customers:
        customer_payments = [pd for pd in payment_data if pd["customer_id"] == customer.id]
        total_paid = sum(pd["amount"] for pd in customer_payments)
        total_invoiced = customer_totals[customer.id]
        
        if total_paid > total_invoiced:
            print(f"WARNING: Customer {customer.id} ({customer.name}) has overpayment: Paid {total_paid:.2f} > Invoiced {total_invoiced:.2f}")
            raise ValueError(f"Overpayment detected for customer {customer.id}: {customer.name}")
        else:
            percentage = (total_paid / total_invoiced) * 100 if total_invoiced > 0 else 0
            print(f"Customer {customer.id} ({customer.name}): Will Pay {total_paid:.2f} ({percentage:.1f}% of invoiced)")

    # Create payments and allocations via FIFO
    from app.api.v1.endpoints.payments import allocate_payment
    allocation_count = 0
    for pd in payment_data:
        try:
            payment, allocs = allocate_payment(db, pd["customer_id"], pd["amount"], pd["date"])
            payment.notes = pd["notes"]
            allocation_count += len(allocs)
            print(f"Created payment {payment.id}: {payment.amount:.2f} for customer {pd['customer_id']} with {len(allocs)} allocations")
        except Exception as e:
            print("Alloc error:", e)
            db.rollback()
            continue
    
    db.commit()
    print(f"Total payments created: {len(payment_data)}")
    print(f"Total allocations: {allocation_count}")


def validate_seed(db):
    ok = True
    invoices = db.query(InvoiceModel).all()
    for inv in invoices:
        sub = inv.sub_total
        tax = inv.total_tax_amount
        grand = inv.grand_total
        if abs((sub + tax - inv.discount_amount) - grand) > 0.01:
            print("Inconsistent totals for", inv.invoice_number)
            ok = False
        paid = inv.amount_paid
        alloc_sum = sum(a.allocated_amount for a in db.query(PaymentAllocationModel).filter(PaymentAllocationModel.invoice_id == inv.id).all())
        if abs(paid - alloc_sum) > 0.01:
            print("Alloc/paid mismatch on", inv.invoice_number, paid, alloc_sum)
            ok = False
    print("Seed validation:", "OK" if ok else "FAILED")
    return ok


def seed_all():
    db = SessionLocal()
    clear_all_data(db)
    seed_company_profile(db)
    items = seed_items(db)
    suppliers = seed_suppliers(db)
    customers = seed_customers(db)
    invoices = seed_invoices(db, items, customers)
    seed_payments(db, customers, invoices)
    validate_seed(db)
    db.close()


if __name__ == '__main__':
    seed_all()
