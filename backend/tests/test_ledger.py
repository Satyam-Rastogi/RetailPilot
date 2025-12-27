import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import get_db, Base, engine
from scripts.reset_and_seed_all import seed_all_data


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Setup test database once for all tests"""
    # Create tables
    Base.metadata.create_all(bind=engine)

    # Seed test data
    seed_all_data()

    yield

    # Cleanup after all tests
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    """Create test client"""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def db_session():
    """Get database session"""
    db = next(get_db())
    try:
        yield db
    finally:
        db.close()


class TestLedgerSystem:
    """End-to-end tests for ledger payment allocation system"""

    def test_ledger_data_exists(self, client):
        """Test that seed data was created successfully"""
        # Get all payments
        response = client.get("/api/v1/payments/")
        assert response.status_code == 200
        payments = response.json()

        # Should have payments from seed
        assert len(payments) >= 10  # At least 10 payments from seed

        # Get ledger for first wholesale customer
        customer_id = 1  # Assuming first customer is wholesale
        response = client.get(f"/api/v1/payments/customer/{customer_id}/ledger")
        assert response.status_code == 200
        ledger = response.json()

        # Verify ledger structure
        assert "customer_id" in ledger
        assert "total_invoiced" in ledger
        assert "total_paid" in ledger
        assert "total_unpaid" in ledger
        assert "invoices" in ledger
        assert "payments" in ledger

        # Verify calculations
        expected_unpaid = ledger["total_invoiced"] - ledger["total_paid"]
        assert abs(ledger["total_unpaid"] - expected_unpaid) < 0.01

    def test_fifo_allocation_logic(self, client):
        """Test that payments are allocated FIFO to oldest invoices"""
        # Find a customer with multiple invoices
        customer_id = 1

        # Get customer's invoices ordered by date
        response = client.get(f"/api/v1/payments/customer/{customer_id}/ledger/invoices")
        assert response.status_code == 200
        invoices = response.json()

        # Sort by invoice date (oldest first)
        invoices_sorted = sorted(invoices, key=lambda x: x["invoice_date"])

        # Create a payment for this customer
        payment_amount = 50000.0
        payment_data = {
            "customer_id": customer_id,
            "date": datetime.now().isoformat(),
            "amount": payment_amount,
            "notes": "Test FIFO allocation"
        }

        response = client.post("/api/v1/payments/", json=payment_data)
        assert response.status_code == 201
        payment = response.json()

        # Verify payment was created with allocations
        assert "allocations" in payment
        assert len(payment["allocations"]) > 0

        # Verify allocations follow FIFO (oldest invoices first)
        total_allocated = sum(alloc["allocated_amount"] for alloc in payment["allocations"])
        assert total_allocated <= payment_amount

        # Check that allocations go to oldest unpaid invoices
        allocated_invoice_ids = [alloc["invoice_id"] for alloc in payment["allocations"]]
        unpaid_invoices = [inv for inv in invoices_sorted if inv["amount_paid"] < inv["grand_total"]]

        # First allocation should be to oldest unpaid invoice
        if unpaid_invoices:
            oldest_unpaid = unpaid_invoices[0]
            assert oldest_unpaid["id"] in allocated_invoice_ids

    def test_payment_creation_updates_invoice_amount_paid(self, client):
        """Test that creating a payment updates invoice amount_paid correctly"""
        customer_id = 1

        # Get initial ledger state
        response = client.get(f"/api/v1/payments/customer/{customer_id}/ledger")
        initial_ledger = response.json()

        # Find an unpaid or partially paid invoice
        unpaid_invoice = None
        for invoice in initial_ledger["invoices"]:
            if invoice["amount_paid"] < invoice["grand_total"]:
                unpaid_invoice = invoice
                break

        if not unpaid_invoice:
            pytest.skip("No unpaid invoices available for testing")

        initial_amount_paid = unpaid_invoice["amount_paid"]
        due_amount = unpaid_invoice["grand_total"] - initial_amount_paid

        # Create payment for exactly the due amount
        payment_data = {
            "customer_id": customer_id,
            "date": datetime.now().isoformat(),
            "amount": due_amount,
            "notes": f"Test payment for invoice {unpaid_invoice['id']}"
        }

        response = client.post("/api/v1/payments/", json=payment_data)
        assert response.status_code == 201
        payment = response.json()

        # Verify the invoice was allocated to
        invoice_allocations = [alloc for alloc in payment["allocations"]
                             if alloc["invoice_id"] == unpaid_invoice["id"]]
        assert len(invoice_allocations) > 0

        # Check updated ledger
        response = client.get(f"/api/v1/payments/customer/{customer_id}/ledger")
        updated_ledger = response.json()

        # Find the updated invoice
        updated_invoice = next(inv for inv in updated_ledger["invoices"]
                             if inv["id"] == unpaid_invoice["id"])

        # Verify amount_paid was updated
        expected_amount_paid = initial_amount_paid + sum(alloc["allocated_amount"]
                                                        for alloc in invoice_allocations)
        assert abs(updated_invoice["amount_paid"] - expected_amount_paid) < 0.01

    def test_ledger_summary_calculations(self, client):
        """Test that ledger summary calculations are accurate"""
        customer_id = 1

        response = client.get(f"/api/v1/payments/customer/{customer_id}/ledger")
        assert response.status_code == 200
        ledger = response.json()

        # Manual calculation of totals
        total_invoiced = sum(inv["grand_total"] for inv in ledger["invoices"])
        total_paid = sum(pay["amount"] for pay in ledger["payments"])
        total_unpaid = total_invoiced - total_paid

        # Verify API calculations match manual
        assert abs(ledger["total_invoiced"] - total_invoiced) < 0.01
        assert abs(ledger["total_paid"] - total_paid) < 0.01
        assert abs(ledger["total_unpaid"] - total_unpaid) < 0.01

    def test_no_overpayments(self, client):
        """Test that payments never exceed total invoiced amounts"""
        # Check all customers
        for customer_id in range(1, 6):  # Wholesale customers 1-5
            response = client.get(f"/api/v1/payments/customer/{customer_id}/ledger")
            if response.status_code == 200:
                ledger = response.json()

                # Total paid should not exceed total invoiced
                assert ledger["total_paid"] <= ledger["total_invoiced"], \
                    f"Customer {customer_id} has overpayment: paid {ledger['total_paid']}, invoiced {ledger['total_invoiced']}"

                # Individual invoices should not have amount_paid > grand_total
                for invoice in ledger["invoices"]:
                    assert invoice["amount_paid"] <= invoice["grand_total"], \
                        f"Invoice {invoice['id']} overpaid: paid {invoice['amount_paid']}, total {invoice['grand_total']}"

    def test_invoice_status_calculation(self, client):
        """Test that invoice payment statuses are calculated correctly"""
        customer_id = 1

        response = client.get(f"/api/v1/payments/customer/{customer_id}/ledger/invoices")
        assert response.status_code == 200
        invoices = response.json()

        for invoice in invoices:
            amount_paid = invoice["amount_paid"]
            grand_total = invoice["grand_total"]
            status = invoice["payment_status"]

            if amount_paid == 0:
                assert status == "Unpaid"
            elif amount_paid < grand_total:
                assert status == "Partially Paid"
            elif amount_paid >= grand_total:
                assert status == "Paid"
            else:
                pytest.fail(f"Invalid payment status for invoice {invoice['id']}: {status}")

    def test_date_filtering(self, client):
        """Test that date filters work correctly on ledger"""
        customer_id = 1

        # Get all invoices first
        response = client.get(f"/api/v1/payments/customer/{customer_id}/ledger")
        full_ledger = response.json()

        # Test date range filtering
        start_date = "2025-01-01"
        end_date = "2025-06-30"

        response = client.get(f"/api/v1/payments/customer/{customer_id}/ledger?date_from={start_date}&date_to={end_date}")
        assert response.status_code == 200
        filtered_ledger = response.json()

        # Verify invoices are within date range
        for invoice in filtered_ledger["invoices"]:
            invoice_date = datetime.fromisoformat(invoice["invoice_date"].replace('Z', '+00:00')).date()
            assert start_date <= invoice_date.isoformat() <= end_date

    def test_payment_detail_with_allocations(self, client):
        """Test that payment details include all allocations"""
        # Get all payments
        response = client.get("/api/v1/payments/")
        payments = response.json()

        # Test first payment with allocations
        payment_with_allocations = None
        for payment in payments:
            if payment.get("allocations") and len(payment["allocations"]) > 0:
                payment_with_allocations = payment
                break

        if not payment_with_allocations:
            pytest.skip("No payments with allocations found")

        # Get detailed payment view
        payment_id = payment_with_allocations["id"]
        response = client.get(f"/api/v1/payments/{payment_id}")
        assert response.status_code == 200
        detailed_payment = response.json()

        # Verify allocations are present and detailed
        assert "allocations" in detailed_payment
        assert len(detailed_payment["allocations"]) > 0

        for alloc in detailed_payment["allocations"]:
            assert "invoice_id" in alloc
            assert "invoice_number" in alloc
            assert "allocated_amount" in alloc
            assert alloc["allocated_amount"] > 0

        # Verify total allocated doesn't exceed payment amount
        total_allocated = sum(alloc["allocated_amount"] for alloc in detailed_payment["allocations"])
        assert total_allocated <= detailed_payment["amount"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])