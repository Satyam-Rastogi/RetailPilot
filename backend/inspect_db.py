import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.db.session import SessionLocal
from app.models.customer import CustomerModel
from app.models.item import ItemModel
from app.models.invoice import InvoiceModel
from app.models.invoice_sequence import InvoiceSequenceModel

db = SessionLocal()
customers = db.query(CustomerModel).all()
print("CUSTOMERS (%d):" % len(customers))
for c in customers:
    print("  id=%d name=%s type=%s" % (c.id, c.name, c.customer_type))

items = db.query(ItemModel).filter(ItemModel.is_active == True).all()
print("\nITEMS (%d active):" % len(items))
for i in items:
    print("  id=%d  %-35s  stock=%-5d  retail=%-8.0f  ws=%.0f" % (
        i.id, i.item_name[:35], i.current_stock_quantity, i.selling_price_retail, i.selling_price_wholesale))

seq = db.query(InvoiceSequenceModel).first()
print("\nSEQUENCE: year=%s next=%s" % (seq.year if seq else None, seq.next_number if seq else None))

inv_count = db.query(InvoiceModel).count()
print("INVOICES in DB: %d" % inv_count)

last5 = db.query(InvoiceModel).order_by(InvoiceModel.id.desc()).limit(5).all()
print("\nLast 5 invoices:")
for inv in last5:
    print("  %s  customer_id=%s  grand_total=%.2f  status=%s  date=%s" % (
        inv.invoice_number, inv.customer_id, inv.grand_total, inv.payment_status, inv.invoice_date))

db.close()
