import sys
sys.path.insert(0, '.')

from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models import (
    CustomerModel, InvoiceModel, PaymentModel, PaymentAllocationModel,
    ItemModel, InvoiceLineItemModel, SupplierModel, CompanyProfileModel,
    ReturnReceiptModel, ReturnLineItemModel
)
from app.db.session import SessionLocal, engine
from app.models.company_profile import CompanyProfileModel

# Force import all models to ensure they're registered with Base
import app.models  # This ensures all models are imported and registered

# Drop and recreate tables
from app.db.session import Base
Base.metadata.drop_all(bind=engine)
print('Dropped all tables')
Base.metadata.create_all(bind=engine)
print('Recreated all tables with new schema')

db = SessionLocal()

# Seed helpers
def seed_company_profile(db: Session):
    profile = CompanyProfileModel(
        shop_name="RetailPilot Test Store",
        shop_address="123 Market Street, Textile City",
        shop_phone="+91 12345 67890",
        shop_gstin="GSTSHOP123456",
        default_tax_rate=18.0,
        currency_symbol="₹",
        receiver_bank_name="Test Bank",
        receiver_account_number="1234567890",
        receiver_ifsc_code="TEST0001234"
    )
    db.add(profile)
    db.commit()
    print("Seeded company profile")

def seed_items(db: Session):
    items = [
        ItemModel(item_name="Banarasi Silk Saree", brand_name="Royal Weaves", sku="WS-BSN-001", material="Silk", purchase_price=2500, selling_price_retail=4500, selling_price_wholesale=3200, current_stock_quantity=50, unit_of_measurement="Pcs", low_stock_threshold=10, enable_low_stock_alert=True),
        ItemModel(item_name="Kanjivaram Silk Saree", brand_name="Tamil Nadu Silks", sku="TN-KNJ-001", material="Silk", purchase_price=4000, selling_price_retail=7500, selling_price_wholesale=5200, current_stock_quantity=30, unit_of_measurement="Pcs", low_stock_threshold=5, enable_low_stock_alert=True),
        ItemModel(item_name="Chiffon Saree", brand_name="FabFinds", sku="FF-CHF-001", material="Chiffon", purchase_price=800, selling_price_retail=1500, selling_price_wholesale=1100, current_stock_quantity=100, unit_of_measurement="Pcs", low_stock_threshold=20, enable_low_stock_alert=False),
        ItemModel(item_name="Georgette Saree", brand_name="FabFinds", sku="FF-GEO-001", material="Georgette", purchase_price=900, selling_price_retail=1800, selling_price_wholesale=1300, current_stock_quantity=75, unit_of_measurement="Pcs", low_stock_threshold=15, enable_low_stock_alert=False),
        ItemModel(item_name="Cotton Saree", brand_name="Handloom Heritage", sku="HH-COT-001", material="Cotton", purchase_price=600, selling_price_retail=1200, selling_price_wholesale=850, current_stock_quantity=200, unit_of_measurement="Pcs", low_stock_threshold=30, enable_low_stock_alert=False),
        ItemModel(item_name=" designer Saree", brand_name="Designer Di", sku="DD-DSN-001", material="Blend", purchase_price=3500, selling_price_retail=6500, selling_price_wholesale=4800, current_stock_quantity=25, unit_of_measurement="Pcs", low_stock_threshold=5, enable_low_stock_alert=True),
        ItemModel(item_name="Wedding Saree", brand_name="Bridal Belle", sku="BB-WED-001", material="Silk", purchase_price=8000, selling_price_retail=15000, selling_price_wholesale=11000, current_stock_quantity=10, unit_of_measurement="Pcs", low_stock_threshold=3, enable_low_stock_alert=True),
        ItemModel(item_name="Party Wear Saree", brand_name="Party Perfect", sku="PP-PWT-001", material="Satin", purchase_price=1500, selling_price_retail=2800, selling_price_wholesale=2100, current_stock_quantity=60, unit_of_measurement="Pcs", low_stock_threshold=12, enable_low_stock_alert=False),
        ItemModel(item_name=" Printed Saree", brand_name="Print Palace", sku="PP-PRT-001", material="Viscose", purchase_price=400, selling_price_retail=800, selling_price_wholesale=550, current_stock_quantity=150, unit_of_measurement="Pcs", low_stock_threshold=25, enable_low_stock_alert=False),
        ItemModel(item_name=" Linen Saree", brand_name="Linen Luxury", sku="LL-LIN-001", material="Linen", purchase_price=1200, selling_price_retail=2200, selling_price_wholesale=1650, current_stock_quantity=80, unit_of_measurement="Pcs", low_stock_threshold=15, enable_low_stock_alert=False),
        ItemModel(item_name=" Velvet Saree", brand_name="Velvet Vogue", sku="VV-VLV-001", material="Velvet", purchase_price=2000, selling_price_retail=3800, selling_price_wholesale=2800, current_stock_quantity=40, unit_of_measurement="Pcs", low_stock_threshold=8, enable_low_stock_alert=True),
        ItemModel(item_name=" Organza Saree", brand_name="Organza Opulence", sku="OO-ORG-001", material="Organza", purchase_price=1800, selling_price_retail=3500, selling_price_wholesale=2500, current_stock_quantity=35, unit_of_measurement="Pcs", low_stock_threshold=7, enable_low_stock_alert=True),
    ]
    for item in items:
        db.add(item)
    db.commit()
    print(f"Seeded {len(items)} items")

def seed_suppliers(db: Session):
    suppliers = [
        SupplierModel(name="Silk Road Traders", contact_person="Rajesh Kumar", phone_number="+91 98765 43210", address="Banaras, UP", gstin="SRTPK123456", supplier_bank_name="State Bank", supplier_bank_account_number="12345678901", supplier_bank_ifsc_code="SBIN0001234"),
        SupplierModel(name="Tamil Textiles", contact_person="Priya Sharma", phone_number="+91 87654 32109", address="Chennai, TN", gstin="TXTLS987654", supplier_bank_name="Indian Bank", supplier_bank_account_number="23456789012", supplier_bank_ifsc_code="IBKL0005678"),
        SupplierModel(name="Mumbai Fabrics", contact_person="Amit Patel", phone_number="+91 76543 21098", address="Mumbai, MH", gstin="MFBCT567890", supplier_bank_name="HDFC Bank", supplier_bank_account_number="34567890123", supplier_bank_ifsc_code="HDFC0009012"),
        SupplierModel(name="Delhi Dress Materials", contact_person="Sneha Gupta", phone_number="+91 65432 10987", address="Delhi, DL", gstin="DLDR345678", supplier_bank_name="Axis Bank", supplier_bank_account_number="45678901234", supplier_bank_ifsc_code="AXIS0003456"),
        SupplierModel(name="Kolkata Handlooms", contact_person="Deb Mitra", phone_number="+91 54321 09876", address="Kolkata, WB", gstin="KLKH901234", supplier_bank_name="PNB", supplier_bank_account_number="56789012345", supplier_bank_ifsc_code="PUNB789012"),
    ]
    for supplier in suppliers:
        db.add(supplier)
    db.commit()
    print(f"Seeded {len(suppliers)} suppliers")

def seed_customers(db: Session):
    customers = [
        CustomerModel(name="Rajesh Traders", phone_number="+91 98765 11111", address="Mumbai, Maharashtra", gstin="GSTRT111111", customer_type="Wholesale", notes="Regular wholesale customer, pays on time"),
        CustomerModel(name="Priya Boutiques", phone_number="+91 98765 22222", address="Pune, Maharashtra", gstin="GSTPB222222", customer_type="Wholesale", notes="Bulk buyer, prefers credit"),
        CustomerModel(name="Amit Fabrics", phone_number="+91 98765 33333", address="Surat, Gujarat", gstin="GSTAFF333333", customer_type="Wholesale", notes="Long-term customer"),
        CustomerModel(name="Sneha Silks", phone_number="+91 98765 44444", address="Bangalore, Karnataka", gstin="GSTSS444444", customer_type="Wholesale", notes="Premium customer"),
        CustomerModel(name="Fashion House Mumbai", phone_number="+91 98765 55555", address="Mumbai, Maharashtra", gstin="GSTFH555555", customer_type="Wholesale", notes="Corporate account"),
        CustomerModel(name="Walk-in Customer 1", phone_number="+91 98765 66666", address="Local", gstin="N/A", customer_type="Retail"),
        CustomerModel(name="Walk-in Customer 2", phone_number="+91 98765 77777", address="Local", gstin="N/A", customer_type="Retail"),
        CustomerModel(name="Walk-in Customer 3", phone_number="+91 98765 88888", address="Local", gstin="N/A", customer_type="Retail"),
    ]
    for customer in customers:
        db.add(customer)
    db.commit()
    print(f"Seeded {len(customers)} customers")

def seed_invoices(db: Session):
    customers = db.query(CustomerModel).all()
    items = db.query(ItemModel).all()
    current_year = datetime.now().year
    import random
    from app.domain.services.calculation_service import InvoiceCalculationService
    from app.models.invoice import PaymentStatus
    
    invoice_counts = {c.id: 3 for c in customers}
    
    for idx_customer, customer in enumerate(customers):
        for i in range(invoice_counts.get(customer.id, 3)):
            # Select items and calculate totals BEFORE creating invoice
            num_items = random.randint(2, 4)
            selected_items = random.sample(items, num_items)
            
            line_item_data = []
            for item in selected_items:
                quantity = random.randint(1, 3)
                price = item.selling_price_wholesale if customer.customer_type == "Wholesale" else item.selling_price_retail
                line_item_data.append({
                    'quantity': quantity,
                    'price': price,
                    'discount_amount': 0,
                    'discount_type': 'amount'
                })
            
            # Calculate totals first
            calculation_result = InvoiceCalculationService.calculate_invoice_totals(
                line_item_data,
                "amount",
                0,
                18.0
            )
            
            # Create invoice with grand_total already calculated (include customer ID for unique invoice numbers)
            invoice = InvoiceModel(
                invoice_number=f"INV-{current_year}-{str(idx_customer+1).zfill(3)}-{str(i+1).zfill(2)}-{'WS' if customer.customer_type == 'Wholesale' else 'RE'}",
                invoice_date=datetime.now() - timedelta(days=(i+1)*15),
                customer_id=customer.id,
                discount_type="amount",
                discount_amount=0,
                tax_rate=18.0,
                sub_total=calculation_result['sub_total'],
                total_tax_amount=calculation_result['tax_amount'],
                grand_total=calculation_result['grand_total'],
                amount_paid=0,
                payment_status=PaymentStatus.UNPAID,
                notes=f"Invoice {i+1} for {customer.name}"
            )
            db.add(invoice)
            db.flush()
            
            # Add line items after invoice is created
            for idx, item in enumerate(selected_items):
                data = line_item_data[idx]
                line_item = InvoiceLineItemModel(
                    invoice_id=invoice.id,
                    item_id=item.id,
                    quantity=data['quantity'],
                    price=data['price'],
                    discount_amount=0,
                    discount_type="amount"
                )
                db.add(line_item)
            
            db.commit()
    
    print(f"Seeded invoices for {len(customers)} customers")

def seed_payments(db: Session):
    customers = db.query(CustomerModel).all()
    invoices = db.query(InvoiceModel).all()
    
    for customer in customers:
        customer_invoices = [inv for inv in invoices if inv.customer_id == customer.id]
        if not customer_invoices:
            continue
            
        # Create 1-2 payments per customer
        import random
        num_payments = random.randint(1, 2)
        
        for i in range(num_payments):
            # Calculate remaining amount for this customer
            total_invoiced = sum(inv.grand_total for inv in customer_invoices)
            existing_payments = db.query(PaymentModel).filter(PaymentModel.customer_id == customer.id).all()
            total_paid = sum(p.amount for p in existing_payments)
            
            remaining = total_invoiced - total_paid
            if remaining <= 0:
                continue
                
            # Payment amount between 20-60% of remaining
            payment_amount = round(remaining * random.uniform(0.2, 0.6), 2)
            
            payment = PaymentModel(
                customer_id=customer.id,
                date=datetime.now() - timedelta(days=random.randint(1, 30)),
                amount=payment_amount,
                notes=f"Payment {i+1} for {customer.name}"
            )
            db.add(payment)
            db.flush()
            
            # FIFO allocation
            unpaid_invoices = [inv for inv in customer_invoices if inv.amount_paid < inv.grand_total]
            unpaid_invoices.sort(key=lambda x: x.invoice_date)
            
            remaining_amount = payment_amount
            for inv in unpaid_invoices:
                if remaining_amount <= 0:
                    break
                    
                due = inv.grand_total - inv.amount_paid
                allocate = min(due, remaining_amount)
                
                allocation = PaymentAllocationModel(
                    payment_id=payment.id,
                    invoice_id=inv.id,
                    allocated_amount=allocate
                )
                db.add(allocation)
                
                inv.amount_paid += allocate
                remaining_amount -= allocate
            
            db.commit()
    
    # Update payment status
    from app.models.invoice import PaymentStatus
    for invoice in invoices:
        if invoice.amount_paid >= invoice.grand_total:
            invoice.payment_status = PaymentStatus.PAID
        elif invoice.amount_paid > 0:
            invoice.payment_status = PaymentStatus.PARTIALLY_PAID
        else:
            invoice.payment_status = PaymentStatus.UNPAID
    db.commit()
    
    payments = db.query(PaymentModel).all()
    print(f"Seeded {len(payments)} payments")

def seed_returns(db: Session):
    from app.models.return_receipt import ReturnReceiptModel, ReturnLineItemModel, ReturnReasonCategory
    from app.models.stock_audit import StockAuditModel
    import random

    invoices = db.query(InvoiceModel).all()

    returns_data = [
        {
            "invoice_id": invoices[0].id,
            "return_date": datetime.now() - timedelta(days=15),
            "notes": "Color mismatch - customer returned one saree",
            "is_partial": True,
            "total_items_in_invoice": 3,
            "items_returned_count": 1,
            "line_items": [
                {
                    "item_id": invoices[0].line_items[0].item_id,
                    "quantity_returned": 1,
                    "amount": 3200.00,
                    "reason": "Color not as expected",
                    "reason_category": ReturnReasonCategory.DAMAGED
                }
            ]
        },
        {
            "invoice_id": invoices[1].id,
            "return_date": datetime.now() - timedelta(days=10),
            "notes": "Customer was unable to pay the full amount",
            "is_partial": False,
            "total_items_in_invoice": 2,
            "items_returned_count": 2,
            "line_items": [
                {
                    "item_id": invoices[1].line_items[0].item_id,
                    "quantity_returned": 1,
                    "amount": 4500.00,
                    "reason": "Unable to pay",
                    "reason_category": ReturnReasonCategory.UNABLE_TO_PAY
                },
                {
                    "item_id": invoices[1].line_items[1].item_id,
                    "quantity_returned": 1,
                    "amount": 3200.00,
                    "reason": "Unable to pay",
                    "reason_category": ReturnReasonCategory.UNABLE_TO_PAY
                }
            ]
        }
    ]

    for ret_data in returns_data:
        return_receipt = ReturnReceiptModel(
            invoice_id=ret_data["invoice_id"],
            return_date=ret_data["return_date"],
            total_credit=sum(li["amount"] for li in ret_data["line_items"]),
            notes=ret_data["notes"],
            is_partial=ret_data["is_partial"],
            total_items_in_invoice=ret_data["total_items_in_invoice"],
            items_returned_count=ret_data["items_returned_count"],
        )
        db.add(return_receipt)
        db.flush()

        for li_data in ret_data["line_items"]:
            return_line = ReturnLineItemModel(
                return_receipt_id=return_receipt.id,
                item_id=li_data["item_id"],
                quantity_returned=li_data["quantity_returned"],
                amount=li_data["amount"],
                reason=li_data["reason"],
                reason_category=li_data["reason_category"],
            )
            db.add(return_line)
            db.flush()

            item = db.query(ItemModel).filter(ItemModel.id == li_data["item_id"]).first()
            quantity_after = item.current_stock_quantity + li_data["quantity_returned"]
            item.current_stock_quantity += li_data["quantity_returned"]

            audit = StockAuditModel(
                item_id=li_data["item_id"],
                delta=li_data["quantity_returned"],
                delta_after=quantity_after,
                reason=f"Return - Invoice #{return_receipt.id}",
            )
            db.add(audit)

        db.commit()

    print(f"Seeded {len(returns_data)} returns with stock audit entries")

def validate_seed(db: Session):
    invoices = db.query(InvoiceModel).all()
    payments = db.query(PaymentModel).all()
    allocations = db.query(PaymentAllocationModel).all()
    
    errors = []
    
    for invoice in invoices:
        expected_amount = invoice.grand_total
        actual_amount = invoice.amount_paid
        calculated_paid = sum(
            alloc.allocated_amount 
            for alloc in allocations 
            if alloc.invoice_id == invoice.id
        )
        
        if abs(actual_amount - calculated_paid) > 0.01:
            errors.append(f"Invoice {invoice.invoice_number}: amount_paid mismatch (stored={actual_amount}, calculated={calculated_paid})")
        
        expected_outstanding = invoice.grand_total - invoice.amount_paid
        if expected_outstanding < -0.01:
            errors.append(f"Invoice {invoice.invoice_number}: overpayment detected (outstanding={expected_outstanding})")
    
    if errors:
        print("Seed validation FAILED:")
        for error in errors:
            print(f"  - {error}")
    else:
        print("Seed validation PASSED: All invoices have correct amounts and no overpayments")

# Run seeding
try:
    seed_company_profile(db)
    seed_items(db)
    seed_suppliers(db)
    seed_customers(db)
    seed_invoices(db)
    seed_payments(db)
    seed_returns(db)
    validate_seed(db)
    print("\nDatabase reset and seeding completed successfully!")
except Exception as e:
    print(f"Error during seeding: {e}")
    db.rollback()
finally:
    db.close()
