from app.db.session import SessionLocal
from app.models.item import ItemModel
from app.models.return_receipt import ReturnReceiptModel

db = SessionLocal()

print("\n=== Stock Verification ===")
item1 = db.query(ItemModel).filter(ItemModel.id == 1).first()
print(f"Item 1 (Kanjeevaram): Stock = {item1.current_stock_quantity}")

print("\n=== Returns List ===")
returns = db.query(ReturnReceiptModel).order_by(ReturnReceiptModel.id.desc()).limit(5).all()
for r in returns:
    print(f"Return #{r.id}: Invoice #{r.invoice_id} - Credit: {r.total_credit} - Notes: {r.notes}")

db.close()
