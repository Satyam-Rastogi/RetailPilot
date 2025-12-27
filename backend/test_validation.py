from app.schemas.item import ItemCreate

data = {
    'item_name': 'Test Item',
    'brand_name': 'Test Brand',
    'selling_price_retail': 100,
    'selling_price_wholesale': 80,
    'current_stock_quantity': 10
}
item = ItemCreate(**data)
print('Validation successful')
print(item.model_dump())
