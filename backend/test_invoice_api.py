import requests
import json

BASE_URL = "http://localhost:8000/api/v1"

test_data = {
    "customer_id": 1,
    "invoice_number": "TEST-001",
    "invoice_date": "2025-12-25T00:00:00",
    "line_items": [
        {
            "item_id": 1,
            "item_name": "Test Item",
            "quantity": 1,
            "price": 100,
            "discount_amount": 0,
            "discount_type": "amount",
            "total": 100
        }
    ],
    "discount_type": "amount",
    "discount_amount": 0,
    "tax_rate": 0.18,
    "notes": "Test invoice"
}

print("Testing invoice creation with existing customer...")
response = requests.post(f"{BASE_URL}/invoices/", json=test_data)
print(f"Status: {response.status_code}")
if response.status_code == 200:
    print("SUCCESS! Invoice created with existing customer")
else:
    print(f"FAILED: {response.text}")

test_data_new_customer = {
    "invoice_number": "TEST-002",
    "invoice_date": "2025-12-25T00:00:00",
    "line_items": [
        {
            "item_id": 1,
            "item_name": "Test Item",
            "quantity": 1,
            "price": 100,
            "discount_amount": 0,
            "discount_type": "amount",
            "total": 100
        }
    ],
    "discount_type": "amount",
    "discount_amount": 0,
    "tax_rate": 0.18,
    "new_customer": {
        "name": "One Time Customer",
        "phone_number": None,
        "address": None,
        "gstin": None,
        "customer_type": "Retail",
        "notes": "Created during invoice"
    }
}

print("\nTesting invoice creation with new inline customer...")
response = requests.post(f"{BASE_URL}/invoices/", json=test_data_new_customer)
print(f"Status: {response.status_code}")
if response.status_code == 200:
    print("SUCCESS! Invoice created with new inline customer")
    print(f"Response: {response.json()}")
else:
    print(f"FAILED: {response.text}")
