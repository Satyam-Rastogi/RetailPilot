
#!/usr/bin/env python3
import requests
import json
import random
from datetime import datetime, timedelta
import time

BASE_URL = "http://localhost:5000/api"

# Sample data for customers and suppliers
customer_names = [
    "Priya Sharma", "Rajesh Kumar", "Anjali Singh", "Sanjay Gupta", "Neha Kumari",
    "Amit Verma", "Pooja Devi", "Vikas Yadav", "Shweta Mishra", "Rahul Singh",
    "Kavita Sharma", "Deepak Kumar", "Meena Devi", "Alok Gupta", "Ritu Singh"
]

supplier_names = [
    "Textile Hub", "Fashion Forward", "Garment Galaxy", "Shoe Mart", "Accessory World",
    "Fabric Fashions", "Style Source", "Trend Traders", "Apparel Avenue", "Prime Products",
    "Global Goods", "Elite Emporium", "Quality Wears", "Direct Distributors", "Wholesale Wonders"
]

# Sample products data
products_data = [
    {"name": "Cotton Kurta - Blue", "category": "Clothing", "retail_price": 60, "wholesale_price": 45, "cost_price": 35, "stock": 25},
    {"name": "Silk Saree - Red", "category": "Clothing", "retail_price": 120, "wholesale_price": 95, "cost_price": 75, "stock": 15},
    {"name": "Denim Jeans - Black", "category": "Clothing", "retail_price": 80, "wholesale_price": 65, "cost_price": 50, "stock": 30},
    {"name": "Formal Shirt - White", "category": "Clothing", "retail_price": 70, "wholesale_price": 55, "cost_price": 40, "stock": 40},
    {"name": "Casual T-Shirt - Green", "category": "Clothing", "retail_price": 50, "wholesale_price": 35, "cost_price": 25, "stock": 50},
    {"name": "Woolen Sweater - Grey", "category": "Clothing", "retail_price": 100, "wholesale_price": 80, "cost_price": 60, "stock": 20},
    {"name": "Summer Dress - Yellow", "category": "Clothing", "retail_price": 90, "wholesale_price": 70, "cost_price": 55, "stock": 25},
    {"name": "Leather Jacket - Brown", "category": "Clothing", "retail_price": 200, "wholesale_price": 160, "cost_price": 120, "stock": 10},
    {"name": "Sports Shoes - Nike", "category": "Footwear", "retail_price": 150, "wholesale_price": 120, "cost_price": 90, "stock": 35},
    {"name": "Formal Shoes - Black", "category": "Footwear", "retail_price": 110, "wholesale_price": 85, "cost_price": 65, "stock": 28},
    {"name": "Handbag - Leather", "category": "Accessories", "retail_price": 130, "wholesale_price": 100, "cost_price": 75, "stock": 18},
    {"name": "Wallet - Brown", "category": "Accessories", "retail_price": 40, "wholesale_price": 30, "cost_price": 20, "stock": 45},
    {"name": "Scarf - Silk", "category": "Accessories", "retail_price": 35, "wholesale_price": 25, "cost_price": 15, "stock": 60},
    {"name": "Belt - Leather", "category": "Accessories", "retail_price": 45, "wholesale_price": 35, "cost_price": 25, "stock": 40},
    {"name": "Watch - Digital", "category": "Accessories", "retail_price": 180, "wholesale_price": 140, "cost_price": 100, "stock": 22}
]

def clear_data(endpoint):
    print(f"Clearing existing {endpoint}...")
    try:
        response = requests.get(f"{BASE_URL}/{endpoint}")
        if response.status_code == 200:
            items = response.json()[endpoint]
            print(f"Found {len(items)} {endpoint} to delete.")
            for item in items:
                print(f"Attempting to delete {endpoint} with ID: {item['id']}")
                delete_response = requests.delete(f"{BASE_URL}/{endpoint}/{item['id']}")
                print(f"Delete response status for {endpoint} {item['id']}: {delete_response.status_code}")
                if delete_response.status_code not in [200, 204]: # 204 for successful deletion with no content
                    print(f"✗ Failed to delete {endpoint} {item['id']}: {delete_response.text}")
            print(f"✓ Cleared {len(items)} existing {endpoint}.")
        else:
            print(f"✗ Failed to fetch {endpoint} for clearing: {response.text}")
    except Exception as e:
        print(f"✗ Error clearing {endpoint}: {e}")

def create_customers():
    print("Creating customers...")
    for i, name in enumerate(customer_names):
        data = {
            "name": name,
            "phone": f"98765432{i:02d}",
            "address": f"{i+1} Main St, City, State",
            "gstin": f"GSTIN{i:05d}" if i % 2 == 0 else None, # Some customers have GSTIN
            "notes": f"Sample customer {name}"
        }
        try:
            response = requests.post(f"{BASE_URL}/customers", json=data)
            if response.status_code == 201:
                print(f"✓ Created Customer: {name}")
            else:
                print(f"✗ Failed to create {name}: {response.text}")
        except Exception as e:
            print(f"✗ Error creating {name}: {e}")

def create_suppliers():
    print("\nCreating suppliers...")
    for i, name in enumerate(supplier_names):
        data = {
            "name": name,
            "contact_person": f"Contact {name}",
            "phone": f"99887766{i:02d}",
            "email": f"contact{i}@example.com",
            "address": f"{i+1} Industrial Area, Town, State",
            "gstin": f"SUPGSTIN{i:05d}",
            "notes": f"Sample supplier {name}"
        }
        try:
            response = requests.post(f"{BASE_URL}/suppliers", json=data)
            if response.status_code == 201:
                print(f"✓ Created Supplier: {name}")
            else:
                print(f"✗ Failed to create {name}: {response.text}")
        except Exception as e:
            print(f"✗ Error creating {name}: {e}")

def create_products():
    print("\nCreating products...")
    for i, product in enumerate(products_data, 1):
        data = {
            "name": product["name"],
            "description": f"High quality {product['name'].lower()} with premium finish",
            "sku": f"SKU{i:03d}",
            "category": product["category"],
            "retail_price": product["retail_price"],
            "wholesale_price": product["wholesale_price"],
            "cost_price": product["cost_price"],
            "stock_quantity": product["stock"],
            "min_stock_level": 10,
            "max_stock_level": 500,
            "unit_of_measurement": "pcs",
            "tax_rate": 18.0
        }
        
        try:
            response = requests.post(f"{BASE_URL}/products", json=data)
            if response.status_code == 201:
                print(f"✓ Created: {product['name']} (Retail: ₹{product['retail_price']}, Wholesale: ₹{product['wholesale_price']})")
            else:
                print(f"✗ Failed to create {product['name']}: {response.text}")
        except Exception as e:
            print(f"✗ Error creating {product['name']}: {e}")

def create_invoices():
    print("\nCreating sample invoices...")
    
    # Get customers and products
    customers_response = requests.get(f"{BASE_URL}/customers")
    products_response = requests.get(f"{BASE_URL}/products")
    
    if customers_response.status_code != 200 or products_response.status_code != 200:
        print("Failed to fetch customers or products")
        return
    
    customers = customers_response.json()["customers"]
    products = products_response.json()["products"]
    
    if not customers or not products:
        print("No customers or products found")
        return
    
    # Create 15 invoices with different statuses
    invoice_statuses = ["paid"] * 7 + ["unpaid"] * 3 + ["partially_paid"] * 5
    
    for i in range(15):
        customer = random.choice(customers)
        status = invoice_statuses[i]
        bill_type = random.choice(["retail", "wholesale"]) # Randomly assign bill type
        
        # Create invoice date (random date in last 30 days)
        invoice_date = datetime.now() - timedelta(days=random.randint(1, 30))
        due_date = invoice_date + timedelta(days=30)
        
        # Select 1-3 random products
        selected_products = random.sample(products, random.randint(1, 3))
        line_items = []
        
        for product in selected_products:
            quantity = random.randint(1, 5)
            # Use appropriate price based on bill type
            if bill_type == "wholesale":
                unit_price = product["wholesale_price"]
            else:
                unit_price = product["retail_price"]
            
            line_items.append({
                "product_id": product["id"],
                "product_name": product["name"],
                "quantity": quantity,
                "unit_price": unit_price,
                "tax_rate": product["tax_rate"]
            })
        
        invoice_data = {
            "invoice_type": "sales",
            "customer_id": customer["id"],
            "invoice_date": invoice_date.strftime("%Y-%m-%d"),
            "due_date": due_date.strftime("%Y-%m-%d"),
            "line_items": line_items,
            "notes": f"Sample invoice {i+1} - {status}",
            "bill_type": bill_type # Add bill_type to invoice data
        }
        
        try:
            response = requests.post(f"{BASE_URL}/invoices", json=invoice_data)
            if response.status_code == 201:
                invoice = response.json()
                total_amount = invoice["total_amount"]
                
                # Create payments based on status
                if status == "paid":
                    # Full payment
                    payment_data = {
                        "payment_type": "received",
                        "customer_id": customer["id"],
                        "invoice_id": invoice["id"],
                        "amount": total_amount,
                        "payment_method": random.choice(["cash", "bank_transfer", "upi", "card"]),
                        "payment_date": (invoice_date + timedelta(days=random.randint(1, 10))).strftime("%Y-%m-%d"),
                        "reference_number": f"PAY{i+1:03d}",
                        "notes": f"Full payment for invoice {invoice['invoice_number']}"
                    }
                    requests.post(f"{BASE_URL}/payments", json=payment_data)
                    
                elif status == "partially_paid":
                    # Partial payment (50-80% of total)
                    partial_amount = round(total_amount * random.uniform(0.5, 0.8), 2)
                    payment_data = {
                        "payment_type": "received",
                        "customer_id": customer["id"],
                        "invoice_id": invoice["id"],
                        "amount": partial_amount,
                        "payment_method": random.choice(["cash", "bank_transfer", "upi"]),
                        "payment_date": (invoice_date + timedelta(days=random.randint(1, 15))).strftime("%Y-%m-%d"),
                        "reference_number": f"PAY{i+1:03d}",
                        "notes": f"Partial payment for invoice {invoice['invoice_number']}"
                    }
                    requests.post(f"{BASE_URL}/payments", json=payment_data)
                
                print(f"✓ Created Invoice {invoice['invoice_number']} for {customer['name']} - ₹{total_amount} ({status}, {bill_type})")
            else:
                print(f"✗ Failed to create invoice {i+1}: {response.text}")
        except Exception as e:
            print(f"✗ Error creating invoice {i+1}: {e}")

if __name__ == "__main__":
    print("🚀 Creating sample data for Shop Management System...")
    clear_data("invoices")
    clear_data("products")
    clear_data("customers")
    clear_data("suppliers")
    time.sleep(1) # Give some time for deletions to propagate
    create_customers()
    create_suppliers()
    create_products()
    create_invoices()
    print("\n✅ Sample data creation completed!")


