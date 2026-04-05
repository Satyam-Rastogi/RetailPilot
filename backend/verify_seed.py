import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.db.session import SessionLocal
from sqlalchemy import text

db = SessionLocal()

# Invoice status breakdown
rows = db.execute(text("""
    SELECT payment_status, COUNT(*) as cnt
    FROM invoices GROUP BY payment_status
""")).fetchall()
print("All invoice statuses:")
for r in rows:
    print(f"  {r[0]}: {r[1]}")

# Wholesale-only breakdown
rows2 = db.execute(text("""
    SELECT payment_status, COUNT(*) as cnt
    FROM invoices
    WHERE customer_id IN (SELECT id FROM customers WHERE customer_type='Wholesale')
    GROUP BY payment_status
""")).fetchall()
print("\nWholesale invoice statuses:")
for r in rows2:
    print(f"  {r[0]}: {r[1]}")

# Key counts
overpaid = db.execute(text("SELECT COUNT(*) FROM invoices WHERE amount_paid > grand_total + 0.01")).scalar()
future_p = db.execute(text("SELECT COUNT(*) FROM payments WHERE date > '2026-03-28'")).scalar()
returns  = db.execute(text("SELECT COUNT(*) FROM return_receipts")).scalar()
li       = db.execute(text("SELECT COUNT(*) FROM return_line_items")).scalar()
po       = db.execute(text("SELECT COUNT(*) FROM invoices WHERE po_number IS NOT NULL")).scalar()
payments = db.execute(text("SELECT COUNT(*) FROM payments")).scalar()
items    = db.execute(text("SELECT COUNT(*) FROM items")).scalar()
customers= db.execute(text("SELECT COUNT(*) FROM customers")).scalar()
suppliers= db.execute(text("SELECT COUNT(*) FROM suppliers")).scalar()
audits   = db.execute(text("SELECT COUNT(*) FROM stock_audits")).scalar()

print(f"\nSummary:")
print(f"  Customers    : {customers}")
print(f"  Suppliers    : {suppliers}")
print(f"  Items        : {items}")
print(f"  Stock audits : {audits}")
print(f"  Payments     : {payments}")
print(f"  Returns      : {returns} receipts / {li} line items")
print(f"  PO numbers   : {po} invoices")
print(f"  Overpaid     : {overpaid}  (want 0)")
print(f"  Future pmts  : {future_p}  (want 0)")
db.close()
