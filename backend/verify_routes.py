from app.api.v1 import api_router

print("\n=== API Routes ===")
for route in api_router.routes:
    if hasattr(route, 'path'):
        methods = list(route.methods) if hasattr(route, 'methods') else []
        print(f"  {route.path} - {methods}")

print("\n=== Testing Backend Imports ===")
try:
    from app.models.return_receipt import ReturnReceiptModel
    print("  ✓ ReturnReceiptModel imported")
except Exception as e:
    print(f"  ✗ ReturnReceiptModel failed: {e}")

try:
    from app.api.v1.endpoints import returns
    print("  ✓ returns module imported")
except Exception as e:
    print(f"  ✗ returns module failed: {e}")
