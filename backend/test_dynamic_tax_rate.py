import requests
import json

BASE_URL = "http://localhost:8000/api/v1"

# Test company profile (to get default tax rate)
print("Fetching company profile...")
response = requests.get(f"{BASE_URL}/company-profile/")
if response.status_code == 200:
    profile = response.json()
    print(f"Company Profile: {profile}")
    print(f"Default Tax Rate: {profile.get('default_tax_rate', 'Not set')}%")
else:
    print(f"Failed: {response.text}")

# Test invoice with dynamic tax rate
print("\nTesting invoice creation with dynamic tax rate...")

test_data_with_tax_rate = {
    "invoice_number": "TEST-DYN-001",
    "invoice_date": "2025-12-25T00:00:00",
    "customer_id": 1,
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
    "tax_rate": 15,
    "notes": "Test with custom tax rate"
}

response = requests.post(f"{BASE_URL}/invoices/", json=test_data_with_tax_rate)
print(f"Status: {response.status_code}")
if response.status_code == 200:
    print("SUCCESS! Invoice created with custom tax rate (15%)")
    data = response.json()
    print(f"Invoice ID: {data.get('id')}")
    print(f"Tax rate used: {data.get('tax_rate')}%")
else:
    print(f"FAILED: {response.text}")

# Test invoice without tax rate (should use company default)
print("\nTesting invoice creation without tax rate (should use company default)...")

test_data_without_tax_rate = {
    "invoice_number": "TEST-DYN-002",
    "invoice_date": "2025-12-25T00:00:00",
    "customer_id": 1,
    "line_items": [
        {
            "item_id": 1,
            "item_name": "Test Item",
            "quantity": 2,
            "price": 50,
            "discount_amount": 0,
            "discount_type": "amount",
            "total": 100
        }
    ],
    "discount_type": "amount",
    "discount_amount": 0,
    "notes": "Test with default tax rate"
}

response = requests.post(f"{BASE_URL}/invoices/", json=test_data_without_tax_rate)
print(f"Status: {response.status_code}")
if response.status_code == 200:
    print("SUCCESS! Invoice created with default tax rate (from company profile)")
    data = response.json()
    print(f"Invoice ID: {data.get('id')}")
    print(f"Tax rate used: {data.get('tax_rate')}%")
else:
    print(f"FAILED: {response.text}")
