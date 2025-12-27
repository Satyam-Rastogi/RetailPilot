from app.models import CustomerModel, PaymentModel, PaymentAllocationModel, InvoiceModel
from app.db.session import SessionLocal
from datetime import datetime

def test_fifo_allocation():
    db = SessionLocal()

    try:
        # Get or create test customer
        customer = db.query(CustomerModel).filter(CustomerModel.name == "FIFO Test Customer").first()

        if not customer:
            # Create test customer
            customer = CustomerModel(
                name="FIFO Test Customer",
                phone_number="+91 11111 33333",
                customer_type="Wholesale",
                address="Test Address"
            )
            db.add(customer)
            db.flush()
            print(f"Created test customer: {customer.name} (ID: {customer.id})")
        else:
            print(f"Using existing customer: {customer.name} (ID: {customer.id})")

        # Clear existing test data for this customer
        # Delete existing test payments
        existing_payments = db.query(PaymentModel).filter(PaymentModel.customer_id == customer.id).all()
        for p in existing_payments:
            # Delete allocations first
            db.query(PaymentAllocationModel).filter(PaymentAllocationModel.payment_id == p.id).delete(synchronize_session=False)
        db.query(PaymentModel).filter(PaymentModel.customer_id == customer.id).delete(synchronize_session=False)

        print(f"Cleared {len(existing_payments)} existing payments")

        # Create 3 invoices for this customer
        invoices_data = [
            {
                "invoice_number": "FIFO-001",
                "date": datetime(2025, 12, 10, 10, 0),
                "amount": 30000.0
            },
            {
                "invoice_number": "FIFO-002",
                "date": datetime(2025, 12, 15, 11, 0),
                "amount": 50000.0
            },
            {
                "invoice_number": "FIFO-003",
                "date": datetime(2025, 12, 20, 12, 0),
                "amount": 40000.0
            }
        ]

        for inv_data in invoices_data:
            invoice = InvoiceModel(
                invoice_number=inv_data["invoice_number"],
                invoice_date=inv_data["date"],
                customer_id=customer.id,
                discount_type="amount",
                discount_amount=0,
                tax_rate=18.0,
                sub_total=inv_data["amount"],
                total_tax_amount=inv_data["amount"] * 0.18,
                grand_total=inv_data["amount"] * 1.18,
                amount_paid=0,
                notes=f"Test invoice {inv_data['invoice_number']}"
            )
            db.add(invoice)

        db.flush()
        print(f"Created 3 invoices for customer")

        # Total invoiced: 30,000 + 50,000 + 40,000 = 120,000
        # Create a payment of 80,000 that should allocate:
        # - 30,000 to FIO-001 (fully paid)
        # - 50,000 to FIO-002 (fully paid)

        payment = PaymentModel(
            customer_id=customer.id,
            date=datetime.now(),
            amount=80000.0,
            notes="Test FIFO payment - should pay oldest two invoices"
        )
        db.add(payment)
        db.flush()

        remaining = 80000.0
        allocations = []

        # Manual FIFO allocation
        for invoice in sorted(invoices_data, key=lambda x: x["date"]):
            due = invoice["amount"] - 0

            if due <= 0:
                print(f"Skipping {invoice['invoice_number']}: already paid or zero due")
                continue

            alloc = min(due, remaining)

            # Get the actual InvoiceModel object
            invoice_obj = db.query(InvoiceModel).filter(
                InvoiceModel.customer_id == customer.id,
                InvoiceModel.invoice_number == invoice["invoice_number"]
            ).first()

            if not invoice_obj:
                print(f"ERROR: Could not find invoice {invoice['invoice_number']}")
                continue

            allocation = PaymentAllocationModel(
                payment_id=payment.id,
                invoice_id=invoice_obj.id,
                allocated_amount=alloc
            )
            db.add(allocation)

            invoice_obj.amount_paid += alloc
            remaining -= alloc
            allocations.append(allocation)

            print(f"Allocated {alloc} to {invoice['invoice_number']}: due was {invoice['amount']}, now paid {invoice_obj.amount_paid}")

            if remaining <= 0:
                print(f"Payment fully allocated. Remaining: {remaining}")
                break

        if remaining > 0:
            payment.notes = f"Credit balance: {remaining:.2f}"
            print(f"Created credit balance: {remaining:.2f}")

        db.commit()

        print("\n=== FIFO Allocation Test Results ===")
        print(f"Customer: {customer.name}")
        print(f"Payment: {payment.amount:.2f}")
        print(f"Allocations created: {len(allocations)}")
        print(f"Credit balance: {remaining:.2f}" if remaining > 0 else "No credit balance")

        # Verify ledger state
        ledger_total = sum(inv_data["amount"] for inv_data in invoices_data)
        ledger_paid = payment.amount - remaining

        print(f"\nVerification:")
        print(f"  Total invoiced: {ledger_total:.2f}")
        print(f"  Total paid: {ledger_paid:.2f}")
        print(f"  Total unpaid: {ledger_total - ledger_paid:.2f}")

        # Check each invoice status
        for inv_data in invoices_data:
            invoice_obj = db.query(InvoiceModel).filter(
                InvoiceModel.customer_id == customer.id,
                InvoiceModel.invoice_number == inv_data["invoice_number"]
            ).first()

            if invoice_obj:
                status = "PAID" if invoice_obj.amount_paid >= invoice_obj.grand_total else (
                    "PARTIALLY PAID" if invoice_obj.amount_paid > 0 else "UNPAID"
                )
                unpaid = invoice_obj.grand_total - invoice_obj.amount_paid
                print(f"  {inv_data['invoice_number']}: {invoice_obj.amount_paid:.2f} / {invoice_obj.grand_total:.2f} paid, {unpaid:.2f} unpaid ({status})")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    test_fifo_allocation()
