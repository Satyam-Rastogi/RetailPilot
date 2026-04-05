"""
Full seed script — wipes all data and populates with comprehensive dummy data.
Run from backend/ directory:  python seed_full.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal
from app.models.company_profile import CompanyProfileModel
from app.models.customer import CustomerModel
from app.models.supplier import SupplierModel
from app.models.item import ItemModel
from app.models.invoice import InvoiceModel, InvoiceLineItemModel, PaymentStatus
from app.models.invoice_sequence import InvoiceSequenceModel
from app.models.return_receipt import ReturnReceiptModel, ReturnLineItemModel, ReturnReasonCategory
from app.models.stock_audit import StockAuditModel
from datetime import datetime, timedelta

db = SessionLocal()

def d(days_ago: int) -> datetime:
    return datetime.utcnow() - timedelta(days=days_ago)

try:
    print("Wiping existing data...")
    db.query(ReturnLineItemModel).delete()
    db.query(ReturnReceiptModel).delete()
    db.query(StockAuditModel).delete()
    db.query(InvoiceLineItemModel).delete()
    db.query(InvoiceModel).delete()
    db.query(InvoiceSequenceModel).delete()
    db.query(ItemModel).delete()
    db.query(SupplierModel).delete()
    db.query(CustomerModel).delete()
    db.query(CompanyProfileModel).delete()
    db.commit()
    print("Done wiping.")

    # ── Company Profile ────────────────────────────────────────────────────────
    company = CompanyProfileModel(
        shop_name="Shri Ram Textile House",
        shop_address="42, Sadar Bazar, Chandni Chowk, Delhi - 110006",
        shop_phone="+91 98765 43210",
        shop_gstin="07AABCS1429B1Z3",
        default_tax_rate=18.0,
        currency_symbol="₹",
        receiver_bank_name="Punjab National Bank",
        receiver_account_number="4201000123456789",
        receiver_ifsc_code="PUNB0420100",
    )
    db.add(company)
    db.commit()
    print("Company profile created.")

    # ── Suppliers (12) ─────────────────────────────────────────────────────────
    suppliers_data = [
        dict(name="Kanjeevaram Silk Mills", contact_person="Rajan Pillai", phone_number="+91 98400 11223",
             address="23, Silk Road, Kanchipuram, TN", gstin="33AABFK1234C1Z5",
             supplier_bank_name="SBI", supplier_bank_account_number="3201001987654", supplier_bank_ifsc_code="SBIN0030201"),
        dict(name="Varanasi Weavers Collective", contact_person="Amit Gupta", phone_number="+91 94150 33445",
             address="7, Vishwanath Gali, Varanasi, UP", gstin="09AACFV5678D2Z1",
             supplier_bank_name="Bank of Baroda", supplier_bank_account_number="1234500067890", supplier_bank_ifsc_code="BARB0VARASI"),
        dict(name="Gujarat Fabric Exports", contact_person="Meena Shah", phone_number="+91 97270 55667",
             address="Plot 15, GIDC, Surat, Gujarat", gstin="24AABFG9012E3Z7",
             supplier_bank_name="HDFC Bank", supplier_bank_account_number="5020012345678", supplier_bank_ifsc_code="HDFC0000075"),
        dict(name="Rajasthan Block Print Co.", contact_person="Mohan Sharma", phone_number="+91 94141 77889",
             address="Block Print Nagar, Jaipur, Rajasthan", gstin="08AABFR3456F4Z3",
             supplier_bank_name="ICICI Bank", supplier_bank_account_number="000501234567", supplier_bank_ifsc_code="ICIC0000506"),
        dict(name="Coimbatore Cotton Mills", contact_person="Priya Nadar", phone_number="+91 94890 99001",
             address="Mill Road, Coimbatore, TN", gstin="33AABFC7890G5Z9"),
        dict(name="Bengal Muslin House", contact_person="Debashis Roy", phone_number="+91 93300 11223",
             address="12, Jorasanko, Kolkata, WB", gstin="19AABFB1234H6Z5"),
        dict(name="Pune Polyester Industries", contact_person="Suresh Patil", phone_number="+91 98220 33445",
             address="Phase 2, Pimpri-Chinchwad, Pune", gstin="27AABFP5678I7Z1"),
        dict(name="Ludhiana Woolen Works", contact_person="Harpreet Singh", phone_number="+91 98140 55667",
             address="GT Road, Ludhiana, Punjab", gstin="03AABFL9012J8Z7"),
        dict(name="Bhopal Dyeing & Printing", contact_person="Kavita Tiwari", phone_number="+91 98930 77889",
             address="Industrial Area, Bhopal, MP", gstin="23AABFB3456K9Z3"),
        dict(name="Chennai Thread Suppliers", contact_person="Anbu Selvan", phone_number="+91 94440 99001",
             address="Anna Salai, Chennai, TN", gstin="33AABFC7890L1Z9"),
        dict(name="Hyderabad Embroidery Works", contact_person="Srinivas Reddy", phone_number="+91 98490 11223",
             address="Secunderabad, Hyderabad, TS", gstin="36AABFH1234M2Z5"),
        dict(name="Jaipur Zari & Gota", contact_person="Ramesh Verma", phone_number="+91 98290 33445",
             address="Bapu Bazar, Jaipur, Rajasthan", gstin="08AABFJ5678N3Z1"),
    ]
    suppliers = [SupplierModel(**s) for s in suppliers_data]
    db.add_all(suppliers)
    db.commit()
    print(f"Created {len(suppliers)} suppliers.")

    # ── Customers (25: 15 Retail + 10 Wholesale) ──────────────────────────────
    customers_data = [
        # Retail customers
        dict(name="Anjali Sharma", phone_number="+91 98110 12345", email="anjali.sharma@gmail.com",
             address="C-42, Lajpat Nagar, New Delhi", customer_type="Retail", credit_days=0, notes="Regular buyer"),
        dict(name="Ravi Kumar Singh", phone_number="+91 94110 23456", email="ravi.singh@yahoo.com",
             address="15, Sector 18, Noida, UP", customer_type="Retail", credit_days=0),
        dict(name="Sunita Devi", phone_number="+91 87000 34567", address="Near Bus Stand, Rohini, Delhi",
             customer_type="Retail", credit_days=0, notes="Festival bulk buyer"),
        dict(name="Pradeep Joshi", phone_number="+91 96000 45678", email="pradeep.j@gmail.com",
             address="32, MG Road, Pune, MH", customer_type="Retail", credit_days=0),
        dict(name="Meera Nair", phone_number="+91 98450 56789", address="Indiranagar, Bengaluru, KA",
             customer_type="Retail", credit_days=0),
        dict(name="Arjun Kapoor", phone_number="+91 99990 67890", email="arjun.kapoor@hotmail.com",
             address="Bandra West, Mumbai, MH", customer_type="Retail", credit_days=0, notes="Saree specialist customer"),
        dict(name="Fatima Begum", phone_number="+91 93000 78901", address="Old City, Hyderabad, TS",
             customer_type="Retail", credit_days=0),
        dict(name="Vikram Malhotra", phone_number="+91 98760 89012", email="vikram.m@gmail.com",
             address="Rajouri Garden, New Delhi", customer_type="Retail", credit_days=0),
        dict(name="Kavitha Reddy", phone_number="+91 94520 90123", address="Jubilee Hills, Hyderabad, TS",
             customer_type="Retail", credit_days=0),
        dict(name="Suresh Babu", phone_number="+91 98990 01234", address="T. Nagar, Chennai, TN",
             customer_type="Retail", credit_days=0, notes="Buys in small batches"),
        dict(name="Lakshmi Iyer", phone_number="+91 99000 12345", email="lakshmi.iyer@gmail.com",
             address="Mylapore, Chennai, TN", customer_type="Retail", credit_days=0),
        dict(name="Rajesh Pandey", phone_number="+91 97320 23456", address="Civil Lines, Allahabad, UP",
             customer_type="Retail", credit_days=0),
        dict(name="Pooja Agarwal", phone_number="+91 96780 34567", email="pooja.ag@yahoo.com",
             address="Vaishali Nagar, Jaipur, RJ", customer_type="Retail", credit_days=0),
        dict(name="Deepak Verma", phone_number="+91 89000 45678", address="Shastri Nagar, Meerut, UP",
             customer_type="Retail", credit_days=0),
        dict(name="Nirmala Shetty", phone_number="+91 98450 56789", address="Mangaluru, Karnataka",
             customer_type="Retail", credit_days=0),
        # Wholesale customers (for ledger)
        dict(name="Sharma Traders Pvt Ltd", phone_number="+91 98110 67890", email="sharma.traders@business.com",
             address="Shop 4, Khari Baoli, Delhi", gstin="07AABFS1234A1Z5",
             customer_type="Wholesale", credit_days=30, notes="Monthly settlement, NET-30"),
        dict(name="Priya Fashion House", phone_number="+91 94110 78901", email="priya.fashion@gmail.com",
             address="Fashion Street, Mumbai, MH", gstin="27AABFP5678B2Z1",
             customer_type="Wholesale", credit_days=15, notes="Bi-monthly orders"),
        dict(name="Mehta & Sons Garments", phone_number="+91 98760 89012", email="mehta.sons@gmail.com",
             address="Textile Market, Surat, GJ", gstin="24AABFM9012C3Z7",
             customer_type="Wholesale", credit_days=45, notes="Large orders, NET-45"),
        dict(name="Delhi Wholesale Emporium", phone_number="+91 99990 90123", email="delhiwholesale@yahoo.com",
             address="Sadar Bazar, Delhi", gstin="07AABFD3456D4Z3",
             customer_type="Wholesale", credit_days=30),
        dict(name="Rajputana Fashion Co.", phone_number="+91 93000 01234", email="rajputana.fashion@gmail.com",
             address="Johari Bazar, Jaipur, RJ", gstin="08AABFR7890E5Z9",
             customer_type="Wholesale", credit_days=21, notes="Festival orders in advance"),
        dict(name="South Silk Traders", phone_number="+91 94520 12345", address="Silk Market, Kanchipuram, TN",
             gstin="33AABFS1234F6Z5", customer_type="Wholesale", credit_days=30),
        dict(name="Bengal Boutiques Ltd", phone_number="+91 98990 23456", email="bengalboutiques@gmail.com",
             address="Park Street, Kolkata, WB", gstin="19AABFB5678G7Z1",
             customer_type="Wholesale", credit_days=15),
        dict(name="Deccan Dress Circle", phone_number="+91 98450 34567", email="deccan.dress@business.com",
             address="Abids, Hyderabad, TS", gstin="36AABFD9012H8Z7",
             customer_type="Wholesale", credit_days=30, notes="Reliable payer"),
        dict(name="Ahmedabad Apparel Hub", phone_number="+91 97320 45678", email="ahm.apparel@gmail.com",
             address="Ellis Bridge, Ahmedabad, GJ", gstin="24AABFA3456I9Z3",
             customer_type="Wholesale", credit_days=45),
        dict(name="Lucknow Chikan Works", phone_number="+91 96780 56789", email="lucknow.chikan@yahoo.com",
             address="Aminabad, Lucknow, UP", gstin="09AABFL7890J1Z9",
             customer_type="Wholesale", credit_days=30, notes="Chikan embroidery specialist"),
    ]
    customers = [CustomerModel(**c) for c in customers_data]
    db.add_all(customers)
    db.commit()
    print(f"Created {len(customers)} customers.")

    # ── Items (22) ─────────────────────────────────────────────────────────────
    items_data = [
        # High stock items
        dict(item_name="Kanjeevaram Silk Saree", brand_name="Kanjeevaram Silks", sku="KVS-001",
             material="Pure Silk", purchase_price=7200, selling_price_retail=12500, selling_price_wholesale=8500,
             current_stock_quantity=48, unit_of_measurement="Pcs", low_stock_threshold=10, enable_low_stock_alert=True),
        dict(item_name="Banarasi Georgette Saree", brand_name="Varanasi Weavers", sku="BGS-002",
             material="Georgette", purchase_price=4200, selling_price_retail=8000, selling_price_wholesale=5500,
             current_stock_quantity=62, unit_of_measurement="Pcs", low_stock_threshold=15, enable_low_stock_alert=True),
        dict(item_name="Chiffon Printed Saree", brand_name="Gujarat Fabrics", sku="CPS-003",
             material="Chiffon", purchase_price=1600, selling_price_retail=3200, selling_price_wholesale=2100,
             current_stock_quantity=95, unit_of_measurement="Pcs", low_stock_threshold=20, enable_low_stock_alert=True),
        dict(item_name="Cotton Block Print Saree", brand_name="Rajasthan Block Print", sku="CBP-004",
             material="Cotton", purchase_price=900, selling_price_retail=1800, selling_price_wholesale=1200,
             current_stock_quantity=120, unit_of_measurement="Pcs", low_stock_threshold=25, enable_low_stock_alert=True),
        dict(item_name="Linen Handloom Saree", brand_name="Bengal Muslin", sku="LHS-005",
             material="Linen", purchase_price=2800, selling_price_retail=5500, selling_price_wholesale=3800,
             current_stock_quantity=35, unit_of_measurement="Pcs", low_stock_threshold=10, enable_low_stock_alert=True),
        dict(item_name="Silk Thread Bundle (100g)", brand_name="Chennai Threads", sku="STB-006",
             material="Silk Thread", purchase_price=180, selling_price_retail=350, selling_price_wholesale=240,
             current_stock_quantity=200, unit_of_measurement="Pcs", low_stock_threshold=50, enable_low_stock_alert=True),
        dict(item_name="Cotton Fabric Plain (1m)", brand_name="Coimbatore Cotton", sku="CFP-007",
             material="Cotton", purchase_price=85, selling_price_retail=160, selling_price_wholesale=110,
             current_stock_quantity=500, unit_of_measurement="Metres", low_stock_threshold=100, enable_low_stock_alert=True),
        dict(item_name="Polyester Blend Fabric (1m)", brand_name="Pune Polyester", sku="PBF-008",
             material="Polyester", purchase_price=55, selling_price_retail=120, selling_price_wholesale=80,
             current_stock_quantity=380, unit_of_measurement="Metres", low_stock_threshold=80, enable_low_stock_alert=True),
        dict(item_name="Woolen Shawl", brand_name="Ludhiana Woolen", sku="WLS-009",
             material="Wool", purchase_price=1200, selling_price_retail=2400, selling_price_wholesale=1700,
             current_stock_quantity=45, unit_of_measurement="Pcs", low_stock_threshold=12, enable_low_stock_alert=True),
        dict(item_name="Dupatta Embroidered", brand_name="Hyderabad Embroidery", sku="DPE-010",
             material="Net", purchase_price=320, selling_price_retail=650, selling_price_wholesale=420,
             current_stock_quantity=88, unit_of_measurement="Pcs", low_stock_threshold=20, enable_low_stock_alert=True),
        dict(item_name="Zari Border Tape (1m)", brand_name="Jaipur Zari", sku="ZBT-011",
             material="Zari", purchase_price=45, selling_price_retail=95, selling_price_wholesale=65,
             current_stock_quantity=320, unit_of_measurement="Metres", low_stock_threshold=100, enable_low_stock_alert=True),
        dict(item_name="Lehenga Choli Set", brand_name="Rajputana Fashion", sku="LCS-012",
             material="Silk Blend", purchase_price=3500, selling_price_retail=6500, selling_price_wholesale=4500,
             current_stock_quantity=28, unit_of_measurement="Sets", low_stock_threshold=8, enable_low_stock_alert=True),
        # Low stock items (below threshold)
        dict(item_name="Pure Silk Fabric (1m)", brand_name="Kanjeevaram Silks", sku="PSF-013",
             material="Pure Silk", purchase_price=950, selling_price_retail=1800, selling_price_wholesale=1300,
             current_stock_quantity=4, unit_of_measurement="Metres", low_stock_threshold=20, enable_low_stock_alert=True),
        dict(item_name="Banarasi Brocade Fabric (1m)", brand_name="Varanasi Weavers", sku="BBF-014",
             material="Brocade", purchase_price=1200, selling_price_retail=2200, selling_price_wholesale=1600,
             current_stock_quantity=6, unit_of_measurement="Metres", low_stock_threshold=25, enable_low_stock_alert=True),
        dict(item_name="Gota Patti Lace (1m)", brand_name="Jaipur Zari", sku="GPL-015",
             material="Gota", purchase_price=120, selling_price_retail=250, selling_price_wholesale=170,
             current_stock_quantity=8, unit_of_measurement="Metres", low_stock_threshold=50, enable_low_stock_alert=True),
        dict(item_name="Chikan Kurta Fabric (2.5m)", brand_name="Lucknow Chikan", sku="CKF-016",
             material="Cotton Chikan", purchase_price=680, selling_price_retail=1400, selling_price_wholesale=980,
             current_stock_quantity=3, unit_of_measurement="Sets", low_stock_threshold=10, enable_low_stock_alert=True),
        dict(item_name="Mirror Work Skirt Panel", brand_name="Rajasthan Block Print", sku="MWS-017",
             material="Cotton Mirror Work", purchase_price=850, selling_price_retail=1700, selling_price_wholesale=1200,
             current_stock_quantity=5, unit_of_measurement="Pcs", low_stock_threshold=15, enable_low_stock_alert=True),
        # Normal stock items
        dict(item_name="Organza Saree", brand_name="Gujarat Fabrics", sku="OGS-018",
             material="Organza", purchase_price=2200, selling_price_retail=4200, selling_price_wholesale=2900,
             current_stock_quantity=32, unit_of_measurement="Pcs", low_stock_threshold=10, enable_low_stock_alert=False),
        dict(item_name="Chanderi Silk Saree", brand_name="Bengal Muslin", sku="CSS-019",
             material="Chanderi", purchase_price=3800, selling_price_retail=7000, selling_price_wholesale=4800,
             current_stock_quantity=22, unit_of_measurement="Pcs", low_stock_threshold=8, enable_low_stock_alert=True),
        dict(item_name="Phulkari Dupatta", brand_name="Ludhiana Woolen", sku="PHD-020",
             material="Cotton Phulkari", purchase_price=480, selling_price_retail=950, selling_price_wholesale=660,
             current_stock_quantity=55, unit_of_measurement="Pcs", low_stock_threshold=15, enable_low_stock_alert=True),
        dict(item_name="Ikat Fabric (1m)", brand_name="Coimbatore Cotton", sku="IKF-021",
             material="Ikat Cotton", purchase_price=280, selling_price_retail=550, selling_price_wholesale=380,
             current_stock_quantity=145, unit_of_measurement="Metres", low_stock_threshold=40, enable_low_stock_alert=True),
        dict(item_name="Batik Print Fabric (1m)", brand_name="Pune Polyester", sku="BPF-022",
             material="Cotton Batik", purchase_price=190, selling_price_retail=380, selling_price_wholesale=260,
             current_stock_quantity=210, unit_of_measurement="Metres", low_stock_threshold=60, enable_low_stock_alert=False),
    ]
    items = [ItemModel(**it) for it in items_data]
    db.add_all(items)
    db.commit()
    print(f"Created {len(items)} items.")

    # ── Invoice Sequence Seed ──────────────────────────────────────────────────
    seq = InvoiceSequenceModel(year=2026, next_number=31)
    db.add(seq)
    db.commit()

    # ── Helper to build invoice totals ────────────────────────────────────────
    def make_invoice(inv_num, customer, invoice_date, due_days, line_specs, discount_type, discount_val, tax_rate, status, amount_paid=0, notes=None, po_number=None, shipping_address=None):
        """line_specs: list of (item, qty, price_override or None)"""
        line_total = 0.0
        line_objs = []
        for (item, qty, price_override) in line_specs:
            price = price_override if price_override else item.selling_price_retail
            row_total = qty * price
            line_total += row_total
            line_objs.append(InvoiceLineItemModel(item_id=item.id, quantity=qty, price=price, discount_amount=0, discount_type="amount"))

        if discount_type == "amount":
            disc = discount_val
        else:
            disc = line_total * (discount_val / 100)

        after_disc = line_total - disc
        tax = after_disc * (tax_rate / 100)
        grand = after_disc + tax

        due_date = invoice_date + timedelta(days=due_days) if due_days else None
        ps = PaymentStatus.PAID if status == "paid" else (PaymentStatus.PARTIALLY_PAID if status == "partial" else PaymentStatus.UNPAID)

        inv = InvoiceModel(
            invoice_number=inv_num,
            invoice_date=invoice_date,
            due_date=due_date,
            customer_id=customer.id,
            discount_type=discount_type,
            discount_amount=disc,
            tax_rate=tax_rate,
            sub_total=line_total,
            total_tax_amount=tax,
            grand_total=grand,
            amount_paid=amount_paid,
            payment_status=ps,
            notes=notes,
            po_number=po_number,
            shipping_address=shipping_address,
        )
        db.add(inv)
        db.flush()
        for li in line_objs:
            li.invoice_id = inv.id
        db.add_all(line_objs)
        return inv

    # Shorthand references
    c = {cust.name: cust for cust in customers}
    it = {item.item_name: item for item in items}

    # ── 30 Invoices ────────────────────────────────────────────────────────────
    # Older paid invoices (60-90 days ago)
    inv01 = make_invoice("INV-2026-0001", c["Sharma Traders Pvt Ltd"], d(88), 30,
        [(it["Kanjeevaram Silk Saree"], 10, 8500), (it["Banarasi Georgette Saree"], 15, 5500)],
        "amount", 2000, 18, "paid", notes="First bulk order", po_number="PO-ST-001",
        shipping_address="Warehouse A, Khari Baoli, Delhi", amount_paid=round((10*8500+15*5500-2000)*1.18, 2))

    inv02 = make_invoice("INV-2026-0002", c["Anjali Sharma"], d(82), 0,
        [(it["Chiffon Printed Saree"], 2, None), (it["Cotton Block Print Saree"], 3, None)],
        "percent", 5, 18, "paid", amount_paid=round(((2*3200+3*1800)*0.95)*1.18, 2))

    inv03 = make_invoice("INV-2026-0003", c["Priya Fashion House"], d(76), 15,
        [(it["Linen Handloom Saree"], 20, 3800), (it["Chanderi Silk Saree"], 8, 4800)],
        "amount", 5000, 18, "paid", po_number="PO-PFH-001", shipping_address="Fashion Street, Mumbai",
        amount_paid=round(((20*3800+8*4800)-5000)*1.18, 2))

    inv04 = make_invoice("INV-2026-0004", c["Ravi Kumar Singh"], d(70), 0,
        [(it["Woolen Shawl"], 3, None), (it["Phulkari Dupatta"], 5, None)],
        "amount", 0, 18, "paid", amount_paid=round((3*2400+5*950)*1.18, 2))

    inv05 = make_invoice("INV-2026-0005", c["Mehta & Sons Garments"], d(65), 45,
        [(it["Cotton Fabric Plain (1m)"], 500, 110), (it["Polyester Blend Fabric (1m)"], 300, 80)],
        "percent", 8, 18, "paid", po_number="PO-MES-001", shipping_address="Textile Market, Surat",
        amount_paid=round(((500*110+300*80)*0.92)*1.18, 2))

    inv06 = make_invoice("INV-2026-0006", c["Sunita Devi"], d(60), 0,
        [(it["Kanjeevaram Silk Saree"], 1, None), (it["Dupatta Embroidered"], 2, None)],
        "amount", 500, 18, "paid", notes="Festival purchase",
        amount_paid=round((12500+2*650-500)*1.18, 2))

    inv07 = make_invoice("INV-2026-0007", c["Delhi Wholesale Emporium"], d(55), 30,
        [(it["Banarasi Georgette Saree"], 25, 5500), (it["Organza Saree"], 15, 2900)],
        "percent", 10, 18, "paid", po_number="PO-DWE-001",
        amount_paid=round(((25*5500+15*2900)*0.90)*1.18, 2))

    inv08 = make_invoice("INV-2026-0008", c["Meera Nair"], d(50), 0,
        [(it["Silk Thread Bundle (100g)"], 10, None), (it["Zari Border Tape (1m)"], 20, None)],
        "amount", 0, 18, "paid", amount_paid=round((10*350+20*95)*1.18, 2))

    inv09 = make_invoice("INV-2026-0009", c["Rajputana Fashion Co."], d(48), 21,
        [(it["Lehenga Choli Set"], 12, 4500), (it["Dupatta Embroidered"], 20, 420)],
        "amount", 3000, 18, "paid", po_number="PO-RFC-001",
        amount_paid=round((12*4500+20*420-3000)*1.18, 2))

    inv10 = make_invoice("INV-2026-0010", c["Arjun Kapoor"], d(42), 0,
        [(it["Cotton Block Print Saree"], 5, None), (it["Batik Print Fabric (1m)"], 20, None)],
        "percent", 10, 18, "paid", notes="Regular customer discount",
        amount_paid=round(((5*1800+20*380)*0.90)*1.18, 2))

    inv11 = make_invoice("INV-2026-0011", c["South Silk Traders"], d(40), 30,
        [(it["Pure Silk Fabric (1m)"], 30, 1300), (it["Banarasi Brocade Fabric (1m)"], 20, 1600)],
        "amount", 0, 18, "paid", po_number="PO-SST-001",
        amount_paid=round((30*1300+20*1600)*1.18, 2))

    inv12 = make_invoice("INV-2026-0012", c["Fatima Begum"], d(35), 0,
        [(it["Chikan Kurta Fabric (2.5m)"], 4, None), (it["Gota Patti Lace (1m)"], 15, None)],
        "amount", 0, 18, "paid", amount_paid=round((4*1400+15*250)*1.18, 2))

    # Partial payment invoices
    inv13 = make_invoice("INV-2026-0013", c["Sharma Traders Pvt Ltd"], d(30), 30,
        [(it["Kanjeevaram Silk Saree"], 15, 8500), (it["Chanderi Silk Saree"], 10, 4800)],
        "amount", 5000, 18, "partial", notes="NET-30, partial advance", po_number="PO-ST-002",
        shipping_address="Warehouse A, Khari Baoli, Delhi",
        amount_paid=50000)

    inv14 = make_invoice("INV-2026-0014", c["Priya Fashion House"], d(28), 15,
        [(it["Linen Handloom Saree"], 12, 3800), (it["Woolen Shawl"], 8, 1700)],
        "percent", 5, 18, "partial", po_number="PO-PFH-002", amount_paid=30000)

    inv15 = make_invoice("INV-2026-0015", c["Vikram Malhotra"], d(25), 0,
        [(it["Banarasi Georgette Saree"], 3, None), (it["Lehenga Choli Set"], 2, None)],
        "amount", 1000, 18, "partial", amount_paid=25000, notes="Will pay balance next week")

    inv16 = make_invoice("INV-2026-0016", c["Mehta & Sons Garments"], d(22), 45,
        [(it["Cotton Fabric Plain (1m)"], 800, 110), (it["Ikat Fabric (1m)"], 200, 380)],
        "percent", 12, 18, "partial", po_number="PO-MES-002",
        shipping_address="Textile Market, Surat", amount_paid=80000)

    inv17 = make_invoice("INV-2026-0017", c["Bengal Boutiques Ltd"], d(20), 15,
        [(it["Organza Saree"], 25, 2900), (it["Chiffon Printed Saree"], 30, 2100)],
        "amount", 4000, 18, "partial", po_number="PO-BBL-001", amount_paid=60000)

    inv18 = make_invoice("INV-2026-0018", c["Kavitha Reddy"], d(18), 0,
        [(it["Phulkari Dupatta"], 10, None), (it["Silk Thread Bundle (100g)"], 15, None)],
        "amount", 500, 18, "partial", amount_paid=15000)

    inv19 = make_invoice("INV-2026-0019", c["Deccan Dress Circle"], d(15), 30,
        [(it["Banarasi Brocade Fabric (1m)"], 50, 1600), (it["Pure Silk Fabric (1m)"], 40, 1300)],
        "amount", 0, 18, "partial", po_number="PO-DDC-001", amount_paid=60000)

    inv20 = make_invoice("INV-2026-0020", c["Rajesh Pandey"], d(14), 0,
        [(it["Cotton Block Print Saree"], 8, None)],
        "percent", 8, 18, "partial", amount_paid=12000)

    # Unpaid invoices (some overdue!)
    inv21 = make_invoice("INV-2026-0021", c["Delhi Wholesale Emporium"], d(45), 30,
        [(it["Kanjeevaram Silk Saree"], 20, 8500), (it["Banarasi Georgette Saree"], 30, 5500)],
        "percent", 10, 18, "unpaid", notes="OVERDUE - 15 days past due", po_number="PO-DWE-002",
        amount_paid=0)  # Due date = d(45)+30 = d(15) — overdue!

    inv22 = make_invoice("INV-2026-0022", c["Sharma Traders Pvt Ltd"], d(40), 30,
        [(it["Linen Handloom Saree"], 25, 3800), (it["Chanderi Silk Saree"], 15, 4800)],
        "amount", 8000, 18, "unpaid", po_number="PO-ST-003",
        notes="OVERDUE - 10 days past due", amount_paid=0)

    inv23 = make_invoice("INV-2026-0023", c["Pooja Agarwal"], d(12), 0,
        [(it["Chiffon Printed Saree"], 4, None), (it["Cotton Block Print Saree"], 6, None)],
        "percent", 5, 18, "unpaid", amount_paid=0)

    inv24 = make_invoice("INV-2026-0024", c["Ahmedabad Apparel Hub"], d(38), 30,
        [(it["Polyester Blend Fabric (1m)"], 500, 80), (it["Batik Print Fabric (1m)"], 300, 260)],
        "percent", 8, 18, "unpaid", po_number="PO-AAH-001",
        notes="OVERDUE - 8 days past due", amount_paid=0)

    inv25 = make_invoice("INV-2026-0025", c["Deepak Verma"], d(10), 0,
        [(it["Woolen Shawl"], 4, None), (it["Dupatta Embroidered"], 8, None)],
        "amount", 500, 18, "unpaid", amount_paid=0)

    inv26 = make_invoice("INV-2026-0026", c["Lucknow Chikan Works"], d(35), 21,
        [(it["Chikan Kurta Fabric (2.5m)"], 30, 980), (it["Gota Patti Lace (1m)"], 100, 170)],
        "amount", 3000, 18, "unpaid", po_number="PO-LCW-001",
        notes="OVERDUE - 14 days past due", amount_paid=0)

    inv27 = make_invoice("INV-2026-0027", c["Rajputana Fashion Co."], d(8), 21,
        [(it["Lehenga Choli Set"], 20, 4500), (it["Mirror Work Skirt Panel"], 30, 1200)],
        "amount", 6000, 18, "unpaid", po_number="PO-RFC-002", amount_paid=0)

    inv28 = make_invoice("INV-2026-0028", c["Nirmala Shetty"], d(6), 0,
        [(it["Kanjeevaram Silk Saree"], 2, None), (it["Silk Thread Bundle (100g)"], 5, None)],
        "amount", 0, 18, "unpaid", amount_paid=0)

    inv29 = make_invoice("INV-2026-0029", c["South Silk Traders"], d(32), 30,
        [(it["Zari Border Tape (1m)"], 200, 65), (it["Gota Patti Lace (1m)"], 150, 170)],
        "amount", 2000, 18, "unpaid", po_number="PO-SST-002",
        notes="OVERDUE - 2 days past due", amount_paid=0)

    inv30 = make_invoice("INV-2026-0030", c["Suresh Babu"], d(4), 0,
        [(it["Chiffon Printed Saree"], 3, None), (it["Organza Saree"], 2, None)],
        "amount", 0, 18, "unpaid", amount_paid=0, notes="New customer — cash on delivery")

    db.commit()
    all_invoices = [inv01,inv02,inv03,inv04,inv05,inv06,inv07,inv08,inv09,inv10,
                    inv11,inv12,inv13,inv14,inv15,inv16,inv17,inv18,inv19,inv20,
                    inv21,inv22,inv23,inv24,inv25,inv26,inv27,inv28,inv29,inv30]
    print(f"Created {len(all_invoices)} invoices.")

    # ── 10 Returns ─────────────────────────────────────────────────────────────
    returns_data = [
        dict(invoice=inv02, return_date=d(80), total_credit=round(3200*1.18,2),
             notes="One saree was color-faded", is_partial=True,
             items_returned_count=1, total_items_in_invoice=5,
             line_items=[dict(item_id=it["Chiffon Printed Saree"].id, quantity_returned=1,
                              amount=round(3200*1.18,2), reason="Color faded on washing",
                              reason_category=ReturnReasonCategory.QUALITY_ISSUE)]),
        dict(invoice=inv04, return_date=d(68), total_credit=round(2400*1.18,2),
             notes="Shawl size wrong", is_partial=True,
             items_returned_count=1, total_items_in_invoice=8,
             line_items=[dict(item_id=it["Woolen Shawl"].id, quantity_returned=1,
                              amount=round(2400*1.18,2), reason="Wrong size delivered",
                              reason_category=ReturnReasonCategory.WRONG_ITEM)]),
        dict(invoice=inv06, return_date=d(58), total_credit=round(650*2*1.18,2),
             notes="Dupatta had loose threads", is_partial=True,
             items_returned_count=2, total_items_in_invoice=3,
             line_items=[dict(item_id=it["Dupatta Embroidered"].id, quantity_returned=2,
                              amount=round(650*2*1.18,2), reason="Loose threads",
                              reason_category=ReturnReasonCategory.DAMAGED)]),
        dict(invoice=inv07, return_date=d(48), total_credit=round(2900*5*1.18,2),
             notes="Organza sarees didn't sell — returning 5", is_partial=True,
             items_returned_count=5, total_items_in_invoice=40,
             line_items=[dict(item_id=it["Organza Saree"].id, quantity_returned=5,
                              amount=round(2900*5*1.18,2), reason="Unable to sell in market",
                              reason_category=ReturnReasonCategory.UNABLE_TO_SELL)]),
        dict(invoice=inv09, return_date=d(44), total_credit=round(4500*3*1.18,2),
             notes="Lehengas returned — festival over", is_partial=True,
             items_returned_count=3, total_items_in_invoice=32,
             line_items=[dict(item_id=it["Lehenga Choli Set"].id, quantity_returned=3,
                              amount=round(4500*3*1.18,2), reason="Season ended, unsold stock",
                              reason_category=ReturnReasonCategory.UNABLE_TO_SELL)]),
        dict(invoice=inv10, return_date=d(40), total_credit=round(1800*2*1.18,2),
             notes="Block print sarees damaged in transit", is_partial=True,
             items_returned_count=2, total_items_in_invoice=25,
             line_items=[dict(item_id=it["Cotton Block Print Saree"].id, quantity_returned=2,
                              amount=round(1800*2*1.18,2), reason="Torn on delivery",
                              reason_category=ReturnReasonCategory.DAMAGED)]),
        dict(invoice=inv12, return_date=d(33), total_credit=round(1400*2*1.18,2),
             notes="Wrong chikan pieces sent", is_partial=True,
             items_returned_count=2, total_items_in_invoice=19,
             line_items=[dict(item_id=it["Chikan Kurta Fabric (2.5m)"].id, quantity_returned=2,
                              amount=round(1400*2*1.18,2), reason="Wrong embroidery pattern",
                              reason_category=ReturnReasonCategory.WRONG_ITEM)]),
        dict(invoice=inv15, return_date=d(22), total_credit=round(6500*1*1.18,2),
             notes="Customer found better price elsewhere", is_partial=True,
             items_returned_count=1, total_items_in_invoice=5,
             line_items=[dict(item_id=it["Lehenga Choli Set"].id, quantity_returned=1,
                              amount=round(6500*1*1.18,2), reason="Found cheaper elsewhere",
                              reason_category=ReturnReasonCategory.BETTER_DEAL)]),
        dict(invoice=inv17, return_date=d(15), total_credit=round(2900*10*1.18,2),
             notes="10 organza sarees defective", is_partial=True,
             items_returned_count=10, total_items_in_invoice=55,
             line_items=[dict(item_id=it["Organza Saree"].id, quantity_returned=10,
                              amount=round(2900*10*1.18,2), reason="Defective batch — torn edges",
                              reason_category=ReturnReasonCategory.DAMAGED)]),
        dict(invoice=inv20, return_date=d(10), total_credit=round(1800*3*1.18,2),
             notes="Customer unable to pay for full order", is_partial=True,
             items_returned_count=3, total_items_in_invoice=8,
             line_items=[dict(item_id=it["Cotton Block Print Saree"].id, quantity_returned=3,
                              amount=round(1800*3*1.18,2), reason="Cash flow issue",
                              reason_category=ReturnReasonCategory.UNABLE_TO_PAY)]),
    ]

    for r in returns_data:
        rr = ReturnReceiptModel(
            invoice_id=r["invoice"].id,
            return_date=r["return_date"],
            total_credit=r["total_credit"],
            notes=r["notes"],
            is_partial=r["is_partial"],
            items_returned_count=r["items_returned_count"],
            total_items_in_invoice=r["total_items_in_invoice"],
        )
        db.add(rr)
        db.flush()
        for li in r["line_items"]:
            db.add(ReturnLineItemModel(return_receipt_id=rr.id, **li))
    db.commit()
    print("Created 10 returns.")

    # ── Stock Audit Entries (12 direct adjustments) ────────────────────────────
    stock_audits = [
        dict(item_id=it["Kanjeevaram Silk Saree"].id, delta=50, delta_after=50, reason="Initial stock intake", created_at=d(90)),
        dict(item_id=it["Banarasi Georgette Saree"].id, delta=80, delta_after=80, reason="Initial stock intake", created_at=d(90)),
        dict(item_id=it["Cotton Fabric Plain (1m)"].id, delta=600, delta_after=600, reason="Bulk purchase from Coimbatore Cotton", created_at=d(85)),
        dict(item_id=it["Pure Silk Fabric (1m)"].id, delta=30, delta_after=30, reason="Stock received from supplier", created_at=d(80)),
        dict(item_id=it["Pure Silk Fabric (1m)"].id, delta=-26, delta_after=4, reason="Sold out — invoice bulk orders", created_at=d(45)),
        dict(item_id=it["Banarasi Brocade Fabric (1m)"].id, delta=20, delta_after=20, reason="Supplier delivery", created_at=d(70)),
        dict(item_id=it["Banarasi Brocade Fabric (1m)"].id, delta=-14, delta_after=6, reason="Invoiced to South Silk Traders", created_at=d(40)),
        dict(item_id=it["Gota Patti Lace (1m)"].id, delta=100, delta_after=100, reason="Seasonal stock replenishment", created_at=d(60)),
        dict(item_id=it["Gota Patti Lace (1m)"].id, delta=-92, delta_after=8, reason="High demand — multiple orders", created_at=d(20)),
        dict(item_id=it["Chikan Kurta Fabric (2.5m)"].id, delta=15, delta_after=15, reason="Stock received from Lucknow Chikan", created_at=d(50)),
        dict(item_id=it["Chikan Kurta Fabric (2.5m)"].id, delta=-12, delta_after=3, reason="Sold in bulk orders", created_at=d(15)),
        dict(item_id=it["Mirror Work Skirt Panel"].id, delta=20, delta_after=20, reason="New batch from Rajasthan", created_at=d(40)),
        dict(item_id=it["Mirror Work Skirt Panel"].id, delta=-15, delta_after=5, reason="Festival order depletion", created_at=d(10)),
    ]

    for sa in stock_audits:
        obj = StockAuditModel(**sa)
        db.add(obj)
    db.commit()
    print("Created 13 stock audit entries.")

    print("\n✓ Database seeded successfully!")
    print(f"  - 1 company profile")
    print(f"  - {len(suppliers)} suppliers")
    print(f"  - {len(customers)} customers (15 retail + 10 wholesale)")
    print(f"  - {len(items)} inventory items (5 low stock)")
    print(f"  - 30 invoices (12 paid, 8 partial, 10 unpaid — 5 overdue)")
    print(f"  - 10 returns across various invoices")
    print(f"  - 13 stock audit entries")

except Exception as e:
    db.rollback()
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
finally:
    db.close()
