from app.db.session import SessionLocal
from app.models.item import ItemModel

db = SessionLocal()
db_item = ItemModel(
    item_name='Test Item',
    brand_name='Test Brand',
    selling_price_retail=100,
    selling_price_wholesale=80,
    current_stock_quantity=10
)
print('Model created successfully')
print(db_item)
db.close()
