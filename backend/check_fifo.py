import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.db.session import SessionLocal
from sqlalchemy import text

db = SessionLocal()

rows = db.execute(text("""
    SELECT p.id, c.name, p.date, p.amount, COUNT(pa.id) as inv_count
    FROM payments p
    JOIN customers c ON c.id=p.customer_id
    JOIN payment_allocations pa ON pa.payment_id=p.id
    GROUP BY p.id
    ORDER BY inv_count DESC, c.name
""")).fetchall()

total_payments = db.execute(text("SELECT COUNT(*) FROM payments")).scalar()
total_alloc = db.execute(text("SELECT COUNT(*) FROM payment_allocations")).scalar()
multi = [r for r in rows if r[4] > 1]

print(f"Total payments  : {total_payments}")
print(f"Total allocations (ledger entries): {total_alloc}")
print(f"FIFO spillover (multi-invoice payments): {len(multi)} of {total_payments}")
print()
print("Payments spanning 2+ invoices:")
for r in multi:
    print(f"  {str(r[2])[:10]}  {r[1]:<28}  amt={r[3]:>10,.0f}  covers {r[4]} invoices")

db.close()
