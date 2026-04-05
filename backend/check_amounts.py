import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.db.session import SessionLocal
from sqlalchemy import text

db = SessionLocal()
rows = db.execute(text(
    "SELECT c.name, i.invoice_date, i.grand_total, i.invoice_number, i.amount_paid "
    "FROM invoices i JOIN customers c ON c.id=i.customer_id "
    "WHERE c.customer_type='Wholesale' ORDER BY c.name, i.invoice_date"
)).fetchall()

cur = None
cust_total = 0
for r in rows:
    if r[0] != cur:
        if cur:
            print(f"  SUBTOTAL: {cust_total:,.0f}")
        print(f"\n{r[0]}:")
        cur = r[0]
        cust_total = 0
    cust_total += r[2]
    print(f"  {str(r[1])[:10]}  {r[3]:>15}  total={r[2]:>10,.0f}  paid={r[4]:>10,.0f}")
if cur:
    print(f"  SUBTOTAL: {cust_total:,.0f}")
db.close()
