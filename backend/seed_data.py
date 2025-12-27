from app.db.session import SessionLocal
from app.models.item import ItemModel
from app.models.customer import CustomerModel
from app.models.supplier import SupplierModel
from app.models.company_profile import CompanyProfileModel
from app.models.invoice import InvoiceModel, InvoiceLineItemModel, PaymentStatus
from app.models.invoice_sequence import InvoiceSequenceModel
from app.models.return_receipt import ReturnReceiptModel, ReturnLineItemModel
from datetime import datetime

db = SessionLocal()

try:
    existing_items = db.query(ItemModel).count()
    if existing_items == 0:
        items = [
            ItemModel(
                item_name="Kanjeevaram Silk Saree",
                brand_name="Kanjeevaram Silks",
                sku="KVS001",
                material="Silk",
                purchase_price=7000,
                selling_price_retail=12000,
                selling_price_wholesale=8000,
                current_stock_quantity=50,
                unit_of_measurement="Pcs",
                low_stock_threshold=10,
                enable_low_stock_alert=True
            ),
            ItemModel(
                item_name="Banarasi Georgette Saree",
                brand_name="Banarasi Georgetes",
                sku="BNG001",
                material="Georgette",
                purchase_price=4500,
                selling_price_retail=8500,
                selling_price_wholesale=6000,
                current_stock_quantity=75,
                unit_of_measurement="Pcs",
                low_stock_threshold=15,
                enable_low_stock_alert=True
            ),
            ItemModel(
                item_name="Chiffon Silk Saree",
                brand_name="Chiffon Silks",
                sku="CHF001",
                material="Chiffon",
                purchase_price=1800,
                selling_price_retail=3500,
                selling_price_wholesale=2200,
                current_stock_quantity=100,
                unit_of_measurement="Pcs",
                low_stock_threshold=20,
                enable_low_stock_alert=True
            ),
            ItemModel(
                item_name="Kota Silk Saree",
                brand_name="Kota Silks",
                sku="KTS001",
                material="Kota Silk",
                purchase_price=2000,
                selling_price_retail=4000,
                selling_price_wholesale=2500,
                current_stock_quantity=25,
                unit_of_measurement="Pcs",
                low_stock_threshold=5,
                enable_low_stock_alert=True
            ),
            ItemModel(
                item_name="Patola Print Saree",
                brand_name="Patola Prints",
                sku="PTS001",
                material="Cotton",
                purchase_price=800,
                selling_price_retail=1500,
                selling_price_wholesale=1000,
                current_stock_quantity=60,
                unit_of_measurement="Pcs",
                low_stock_threshold=15,
                enable_low_stock_alert=False
            )
        ]
        db.add_all(items)
        print(f'Added {len(items)} items')
    else:
        print(f'Items already exist: {existing_items}')

    existing_customers = db.query(CustomerModel).count()
    if existing_customers == 0:
        customers = [
            CustomerModel(
                name="Priya Sharma",
                phone_number="+91 98765 43210",
                address="123, MG Road, Bangalore",
                gstin="29ABCDE1234F1Z5",
                customer_type="Retail",
                notes="Regular customer, prefers silk sarees"
            ),
            CustomerModel(
                name="Rajesh Traders",
                phone_number="+91 87654 32109",
                address="45, Commercial Street, Chennai",
                gstin="29ZYXWV9876G2H4",
                customer_type="Wholesale",
                notes="Bulk buyer, orders monthly"
            ),
            CustomerModel(
                name="Anita Gupta",
                phone_number="+91 76543 21098",
                address="78, Park Street, Kolkata",
                gstin=None,
                customer_type="Retail",
                notes="Prefers georgette sarees"
            ),
            CustomerModel(
                name="Sneha Reddy",
                phone_number="+91 98765 12345",
                address="56, Jubilee Hills, Hyderabad",
                gstin="36FGHIJ3456K3L7",
                customer_type="Retail",
                notes="New customer"
            )
        ]
        db.add_all(customers)
        print(f'Added {len(customers)} customers')
    else:
        print(f'Customers already exist: {existing_customers}')

    existing_suppliers = db.query(SupplierModel).count()
    if existing_suppliers == 0:
        suppliers = [
            SupplierModel(
                name="Kanchi Weavers Co-operative",
                contact_person="R. Venkataraman",
                phone_number="+91 98765 12345",
                address="56, Temple Street, Kanchipuram",
                gstin="33LMNOP1234K1J9",
                supplier_bank_name="State Bank of India",
                supplier_bank_account_number="1234567890123456",
                supplier_bank_ifsc_code="SBIN0001234",
                notes="Primary silk saree supplier"
            ),
            SupplierModel(
                name="Banaras Textile Mills",
                contact_person="A. Kumar",
                phone_number="+91 87654 54321",
                address="89, Weaver's Lane, Varanasi",
                gstin="09QRSTU5678L2M3",
                supplier_bank_name="Punjab National Bank",
                supplier_bank_account_number="9876543210987654",
                supplier_bank_ifsc_code="PUNB0567890",
                notes="Banarasi sarees and georgette materials"
            )
        ]
        db.add_all(suppliers)
        print(f'Added {len(suppliers)} suppliers')
    else:
        print(f'Suppliers already exist: {existing_suppliers}')

    existing_profile = db.query(CompanyProfileModel).count()
    if existing_profile == 0:
        profile = CompanyProfileModel(
            shop_name="Kala Saree Collections",
            shop_address="15, Silk Road, Chennai, Tamil Nadu 600001",
            shop_phone="+91 44 2345 6789",
            shop_gstin="33ABCDEF1234G1H5",
            default_tax_rate=18.0,
            currency_symbol="₹",
            receiver_bank_name="HDFC Bank",
            receiver_account_number="5678901234567890",
            receiver_ifsc_code="HDFC0005678"
        )
        db.add(profile)
        print('Added company profile')
    else:
        print(f'Company profile already exists: {existing_profile}')

    existing_invoices = db.query(InvoiceModel).count()
    if existing_invoices == 0:
        current_year = datetime.now().year

        sequence_record = InvoiceSequenceModel(year=current_year, next_number=1)
        db.add(sequence_record)
        db.flush()

        priya = db.query(CustomerModel).filter(CustomerModel.name == "Priya Sharma").first()
        rajesh = db.query(CustomerModel).filter(CustomerModel.name == "Rajesh Traders").first()
        anita = db.query(CustomerModel).filter(CustomerModel.name == "Anita Gupta").first()
        sneha = db.query(CustomerModel).filter(CustomerModel.name == "Sneha Reddy").first()

        if not sneha:
            sneha = CustomerModel(
                name="Sneha Reddy",
                phone_number="+91 98765 12345",
                address="56, Jubilee Hills, Hyderabad",
                gstin="36FGHIJ3456K3L7",
                customer_type="Retail",
                notes="New customer"
            )
            db.add(sneha)
            db.flush()
        
        kanjeevaram = db.query(ItemModel).filter(ItemModel.sku == "KVS001").first()
        banarasi = db.query(ItemModel).filter(ItemModel.sku == "BNG001").first()
        chiffon = db.query(ItemModel).filter(ItemModel.sku == "CHF001").first()
        kota = db.query(ItemModel).filter(ItemModel.sku == "KTS001").first()
        patola = db.query(ItemModel).filter(ItemModel.sku == "PTS001").first()
        
        invoices_data = [
            {
                "invoice_number": f"INV-{current_year}-0001-RE",
                "customer": priya,
                "customer_type": "Retail",
                "invoice_date": datetime(2025, 12, 20),
                "line_items": [
                    {"item": kanjeevaram, "qty": 2, "price": 12000},
                    {"item": banarasi, "qty": 1, "price": 8500},
                ],
                "discount_type": "amount",
                "discount_amount": 500,
                "amount_paid": 25000,
                "payment_status": PaymentStatus.PAID,
                "notes": "Festival purchase - Diwali special"
            },
            {
                "invoice_number": f"INV-{current_year}-0002-WS",
                "customer": rajesh,
                "customer_type": "Wholesale",
                "invoice_date": datetime(2025, 12, 22),
                "line_items": [
                    {"item": kanjeevaram, "qty": 5, "price": 8000},
                    {"item": banarasi, "qty": 10, "price": 6000},
                    {"item": chiffon, "qty": 15, "price": 2200},
                ],
                "discount_type": "percent",
                "discount_amount": 5,
                "amount_paid": 60000,
                "payment_status": PaymentStatus.PARTIALLY_PAID,
                "notes": "Bulk wholesale order for upcoming season"
            },
            {
                "invoice_number": f"INV-{current_year}-0003-RE",
                "customer": anita,
                "customer_type": "Retail",
                "invoice_date": datetime(2025, 12, 23),
                "line_items": [
                    {"item": chiffon, "qty": 3, "price": 3500},
                    {"item": kota, "qty": 2, "price": 4000},
                ],
                "discount_type": "amount",
                "discount_amount": 0,
                "amount_paid": 0,
                "payment_status": PaymentStatus.UNPAID,
                "notes": "Wedding gift purchase"
            },
            {
                "invoice_number": f"INV-{current_year}-0004-RE",
                "customer": sneha,
                "customer_type": "Retail",
                "invoice_date": datetime(2025, 12, 24),
                "line_items": [
                    {"item": patola, "qty": 4, "price": 1500},
                    {"item": kanjeevaram, "qty": 1, "price": 12000},
                ],
                "discount_type": "amount",
                "discount_amount": 200,
                "amount_paid": 0,
                "payment_status": PaymentStatus.PAID,
                "notes": "New year celebration"
            }
        ]
        
        created_invoices = []
        for inv_data in invoices_data:
            sub_total = sum(li["qty"] * li["price"] for li in inv_data["line_items"])
            discount_amount = inv_data["discount_amount"] if inv_data["discount_type"] == "amount" else (sub_total * inv_data["discount_amount"] / 100)
            tax_rate = 18.0
            total_tax_amount = (sub_total - discount_amount) * tax_rate / 100
            grand_total = sub_total - discount_amount + total_tax_amount
            
            invoice = InvoiceModel(
                invoice_number=inv_data["invoice_number"],
                invoice_date=inv_data["invoice_date"],
                customer_id=inv_data["customer"].id,
                discount_type=inv_data["discount_type"],
                discount_amount=discount_amount,
                tax_rate=tax_rate,
                sub_total=sub_total,
                total_tax_amount=total_tax_amount,
                grand_total=grand_total,
                amount_paid=inv_data["amount_paid"],
                payment_status=inv_data["payment_status"],
                notes=inv_data["notes"]
            )
            db.add(invoice)
            db.flush()
            
            for li_data in inv_data["line_items"]:
                line_item = InvoiceLineItemModel(
                    invoice_id=invoice.id,
                    item_id=li_data["item"].id,
                    quantity=li_data["qty"],
                    price=li_data["price"]
                )
                db.add(line_item)

                li_data["item"].current_stock_quantity -= li_data["qty"]
            
            created_invoices.append(invoice)
        
        print(f'Added {len(created_invoices)} invoices')
        
        existing_returns = db.query(ReturnReceiptModel).count()
        if existing_returns == 0:
            returns_data = [
                {
                    "invoice": created_invoices[0],
                    "return_date": datetime(2025, 12, 21),
                    "notes": "Color mismatch - customer returned one saree",
                    "line_items": [
                        {"item": kanjeevaram, "qty": 1, "price": 12000},
                    ]
                },
                {
                    "invoice": created_invoices[2],
                    "return_date": datetime(2025, 12, 25),
                    "notes": "Size issue - wanted larger quantity",
                    "line_items": [
                        {"item": kota, "qty": 1, "price": 4000},
                    ]
                }
            ]
            
            for ret_data in returns_data:
                total_credit = sum(li["qty"] * li["price"] for li in ret_data["line_items"])
                
                return_receipt = ReturnReceiptModel(
                    invoice_id=ret_data["invoice"].id,
                    return_date=ret_data["return_date"],
                    total_credit=total_credit,
                    notes=ret_data["notes"]
                )
                db.add(return_receipt)
                db.flush()
                
                for li_data in ret_data["line_items"]:
                    return_line_item = ReturnLineItemModel(
                        return_receipt_id=return_receipt.id,
                        item_id=li_data["item"].id,
                        quantity_returned=li_data["qty"],
                        amount=li_data["qty"] * li_data["price"]
                    )
                    db.add(return_line_item)
                    
                    li_data["item"].current_stock_quantity += li_data["qty"]
            
            print(f'Added {len(returns_data)} returns')
        else:
            print(f'Returns already exist: {existing_returns}')
    else:
        print(f'Invoices already exist: {existing_invoices}')

    db.commit()
    print('\nDatabase seeded successfully!')
    print('\nSummary:')
    print(f'   - Items: {db.query(ItemModel).count()}')
    print(f'   - Customers: {db.query(CustomerModel).count()}')
    print(f'   - Suppliers: {db.query(SupplierModel).count()}')
    print(f'   - Invoices: {db.query(InvoiceModel).count()}')
    print(f'   - Returns: {db.query(ReturnReceiptModel).count()}')

except Exception as e:
    db.rollback()
    print(f'Error seeding database: {e}')
    import traceback
    traceback.print_exc()
finally:
    db.close()
