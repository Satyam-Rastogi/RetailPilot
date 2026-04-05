import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.db.session import SessionLocal
from app.models.customer import CustomerModel
from app.models.item import ItemModel
from app.models.invoice import InvoiceModel
from app.models.invoice_sequence import InvoiceSequenceModel
from datetime import datetime

db = SessionLocal()

# All sequences
seqs = db.query(InvoiceSequenceModel).all()
print("SEQUENCES:")
for s in seqs:
    print("  year=%s  next=%s" % (s.year, s.next_number))

# April 2026 invoices
apr_invoices = db.query(InvoiceModel).filter(
    InvoiceModel.invoice_date >= datetime(2026, 4, 1),
    InvoiceModel.invoice_date < datetime(2026, 5, 1)
).order_by(InvoiceModel.invoice_date).all()
print("\nAPRIL 2026 INVOICES (%d):" % len(apr_invoices))
for inv in apr_invoices:
    from app.models.customer import CustomerModel as CM
    cust = db.query(CM).filter(CM.id == inv.customer_id).first()
    print("  %s  %-30s  total=%8.2f  paid=%8.2f  status=%-20s  date=%s" % (
        inv.invoice_number,
        cust.name[:30] if cust else "?",
        inv.grand_total, inv.amount_paid,
        str(inv.payment_status).split(".")[-1],
        str(inv.invoice_date)[:10]))

# March 2026 invoice count
mar = db.query(InvoiceModel).filter(
    InvoiceModel.invoice_date >= datetime(2026, 3, 1),
    InvoiceModel.invoice_date < datetime(2026, 4, 1)
).count()
print("\nMARCH 2026 INVOICES: %d" % mar)

# Most recent invoice number
last = db.query(InvoiceModel).order_by(InvoiceModel.id.desc()).first()
print("LAST INVOICE: %s" % (last.invoice_number if last else None))

# Wholesale customers
ws = db.query(CustomerModel).filter(CustomerModel.customer_type == "Wholesale").all()
print("\nWHOLESALE CUSTOMERS (%d):" % len(ws))
for c in ws:
    print("  id=%d  %s  credit_days=%s  gstin=%s" % (c.id, c.name, c.credit_days, c.gstin))

# Items with enough stock for wholesale orders (>= 20 pcs or metres)
print("\nHIGH-STOCK ITEMS (stock >= 10):")
for i in db.query(ItemModel).filter(ItemModel.is_active == True, ItemModel.current_stock_quantity >= 10).all():
    print("  id=%d  %-35s  stock=%-5d  retail=%6.0f  ws=%6.0f" % (
        i.id, i.item_name[:35], i.current_stock_quantity, i.selling_price_retail, i.selling_price_wholesale))

db.close()
