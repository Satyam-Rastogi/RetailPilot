import pytest
from sqlalchemy.orm import Session
from app.models import CustomerModel, InvoiceModel, PaymentModel, PaymentAllocationModel, ItemModel, InvoiceLineItemModel
from app.db.session import SessionLocal
from app.api.v1.endpoints.payments import allocate_payment
from datetime import datetime


@pytest.fixture
def db():
    """Database session fixture"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def test_customer(db):
    """Create a test wholesale customer"""
    customer = CustomerModel(
        name="Test FIFO Customer",
        phone_number="+91 11111 22222",
        customer_type="Wholesale",
        address="Test Address",
        gstin="TESTGST001"
    )
    db.add(customer)
    db.flush()
    yield customer
    # Cleanup
    db.query(PaymentAllocationModel).filter(
        PaymentAllocationModel.payment.has(customer_id=customer.id)
    ).delete(synchronize_session=False)
    db.query(PaymentModel).filter(PaymentModel.customer_id == customer.id).delete(synchronize_session=False)
    db.query(InvoiceLineItemModel).filter(
        InvoiceLineItemModel.invoice.has(customer_id=customer.id)
    ).delete(synchronize_session=False)
    db.query(InvoiceModel).filter(InvoiceModel.customer_id == customer.id).delete(synchronize_session=False)
    db.query(CustomerModel).filter(CustomerModel.id == customer.id).delete(synchronize_session=False)
    db.commit()


@pytest.fixture
def test_item(db):
    """Get or create a test item"""
    item = db.query(ItemModel).first()
    if not item:
        item = ItemModel(
            name="Test Item",
            description="Test item for FIFO tests",
            unit="pcs",
            price=1000.0,
            stock_quantity=100
        )
        db.add(item)
        db.flush()
    yield item


def create_invoice(db, customer_id, item_id, invoice_number, date, subtotal):
    """Helper to create an invoice"""
    tax_rate = 18.0
    tax_amount = subtotal * tax_rate / 100
    grand_total = subtotal + tax_amount

    invoice = InvoiceModel(
        invoice_number=invoice_number,
        invoice_date=date,
        customer_id=customer_id,
        discount_type="amount",
        discount_amount=0,
        tax_rate=tax_rate,
        sub_total=subtotal,
        total_tax_amount=tax_amount,
        grand_total=grand_total,
        amount_paid=0,
        notes=f"Test invoice {invoice_number}"
    )
    db.add(invoice)
    db.flush()

    # Add line item
    line_item = InvoiceLineItemModel(
        invoice_id=invoice.id,
        item_id=item_id,
        quantity=1,
        price=subtotal,
        discount_amount=0,
        discount_type="amount"
    )
    db.add(line_item)
    db.commit()
    db.refresh(invoice)
    return invoice


class TestFIFOAllocation:
    """Test cases for FIFO payment allocation"""

    def test_allocate_to_single_invoice(self, db, test_customer, test_item):
        """Test allocating payment to a single unpaid invoice"""
        # Create one invoice
        invoice = create_invoice(db, test_customer.id, test_item.id,
                               "FIFO-TEST-001", datetime(2025, 12, 10), 50000)

        # Allocate payment
        payment, allocations = allocate_payment(db, test_customer.id, 30000, datetime.now())

        # Verify payment
        assert payment.amount == 30000
        assert payment.customer_id == test_customer.id

        # Verify allocation
        assert len(allocations) == 1
        assert allocations[0].allocated_amount == 30000
        assert allocations[0].invoice_id == invoice.id

        # Verify invoice updated
        db.refresh(invoice)
        assert invoice.amount_paid == 30000
        assert invoice.grand_total == 59000  # 50k + 18% tax
        assert invoice.amount_paid == 30000

    def test_allocate_across_multiple_invoices_fifo(self, db, test_customer, test_item):
        """Test FIFO allocation across multiple invoices"""
        # Create three invoices (oldest first)
        inv1 = create_invoice(db, test_customer.id, test_item.id,
                            "FIFO-TEST-001", datetime(2025, 12, 10), 30000)  # 35,400 total
        inv2 = create_invoice(db, test_customer.id, test_item.id,
                            "FIFO-TEST-002", datetime(2025, 12, 15), 50000)  # 59,000 total
        inv3 = create_invoice(db, test_customer.id, test_item.id,
                            "FIFO-TEST-003", datetime(2025, 12, 20), 40000)  # 47,200 total

        # Allocate 70,000 payment (should pay inv1 fully and part of inv2)
        payment, allocations = allocate_payment(db, test_customer.id, 70000, datetime.now())

        # Verify payment
        assert payment.amount == 70000

        # Verify allocations (2 allocations)
        assert len(allocations) == 2

        # First allocation to oldest invoice (inv1)
        alloc1 = next(a for a in allocations if a.invoice_id == inv1.id)
        assert alloc1.allocated_amount == 35400  # Full payment of inv1

        # Second allocation to next oldest (inv2)
        alloc2 = next(a for a in allocations if a.invoice_id == inv2.id)
        assert alloc2.allocated_amount == 34600  # 70,000 - 35,400

        # Refresh invoices and verify
        db.refresh(inv1)
        db.refresh(inv2)
        db.refresh(inv3)

        assert inv1.amount_paid == 35400  # Fully paid
        assert inv2.amount_paid == 34600  # Partially paid
        assert inv3.amount_paid == 0      # Not paid

    def test_overpayment_creates_credit(self, db, test_customer, test_item):
        """Test that overpayment creates credit balance"""
        # Create one invoice
        invoice = create_invoice(db, test_customer.id, test_item.id,
                               "FIFO-TEST-001", datetime(2025, 12, 10), 50000)  # 59,000 total

        # Overpay by 20,000
        payment, allocations = allocate_payment(db, test_customer.id, 80000, datetime.now())

        # Verify payment
        assert payment.amount == 80000
        assert "Credit balance: 21000.00" in payment.notes

        # Verify single allocation (full invoice payment)
        assert len(allocations) == 1
        assert allocations[0].allocated_amount == 59000

        # Verify invoice fully paid
        db.refresh(invoice)
        assert invoice.amount_paid == 59000

    def test_no_allocation_for_fully_paid_invoices(self, db, test_customer, test_item):
        """Test that fully paid invoices are skipped in FIFO"""
        # Create invoices
        inv1 = create_invoice(db, test_customer.id, test_item.id,
                            "FIFO-TEST-001", datetime(2025, 12, 10), 30000)  # 35,400
        inv2 = create_invoice(db, test_customer.id, test_item.id,
                            "FIFO-TEST-002", datetime(2025, 12, 15), 50000)  # 59,000

        # First pay inv1 fully
        allocate_payment(db, test_customer.id, 35400, datetime(2025, 12, 11))

        # Now pay 30,000 more - should go to inv2
        payment, allocations = allocate_payment(db, test_customer.id, 30000, datetime(2025, 12, 16))

        # Verify only one allocation to inv2
        assert len(allocations) == 1
        assert allocations[0].invoice_id == inv2.id
        assert allocations[0].allocated_amount == 30000

    def test_zero_payment_no_allocation(self, db, test_customer, test_item):
        """Test that zero payment creates no allocations"""
        # Create invoice
        create_invoice(db, test_customer.id, test_item.id,
                     "FIFO-TEST-001", datetime(2025, 12, 10), 50000)

        # Try zero payment
        payment, allocations = allocate_payment(db, test_customer.id, 0, datetime.now())

        # Verify
        assert payment.amount == 0
        assert len(allocations) == 0

    def test_payment_to_customer_with_no_invoices(self, db, test_customer):
        """Test payment to customer with no invoices creates credit"""
        payment, allocations = allocate_payment(db, test_customer.id, 50000, datetime.now())

        # Verify
        assert payment.amount == 50000
        assert len(allocations) == 0
        assert "Credit balance: 50000.00" in payment.notes