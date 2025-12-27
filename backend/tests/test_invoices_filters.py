import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.db.base import Base
from app.models.customer import CustomerModel
from app.models.invoice import InvoiceModel
from app.models.invoice_sequence import InvoiceSequenceModel
from app.models.company_profile import CompanyProfileModel
from app.models.item import ItemModel

Testing database URL (test)
SQLALCHEMY_DATABASE_URL = sqlite:///./test.db

from conftest import engine, TestingSessionLocal


@pytest.fixture
def db():
    """Create a fresh database session for each test"""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def sample_customers(db: Session):
    """Create sample customers for testing"""
    customers = [
        CustomerModel(id=1, name="Priya Sharma", customer_type="Retail", phone_number="+91 98765 43210", address="123, MG Road, Bangalore", gstin="29ABCDE1234F1Z5", created_at=datetime.utcnow()),
        CustomerModel(id=2, name="Rajesh Traders", customer_type="Wholesale", phone_number="+91 87654 32109", address="45, Commercial Street, Chennai", gstin="29ZYXWV9876G2H4", created_at=datetime.utcnow()),
    ]
    db.add_all(customers)
    db.commit()
    db.flush()
    return customers


@pytest.fixture
def sample_invoices(db: Session):
    """Create sample invoices for testing with varied dates"""
    customers = db.query(CustomerModel).all()
    
    invoices = [
        # January 2025
        InvoiceModel(
            id=1,
            invoice_number="INV-2025-0001-RE",
            invoice_date=datetime(2025, 1, 15),
            customer_id=1,
            discount_type="amount",
            discount_amount=None,
            tax_rate=18.0,
            sub_total=1000.0,
            total_tax_amount=180.0,
            grand_total=1180.0,
            amount_paid=0,
            payment_status="unpaid",
            notes="January retail invoice",
            created_at=datetime.utcnow(),
        ),
        # February 2025
        InvoiceModel(
            id=2,
            invoice_number="INV-2025-0002-WS",
            invoice_date=datetime(2025, 2, 20),
            customer_id=2,
            discount_type="amount",
            discount_amount=100.0,
            tax_rate=18.0,
            sub_total=2000.0,
            total_tax_amount=342.0,
            grand_total=2242.0,
            amount_paid=500.0,
            payment_status="partial",
            notes="February wholesale with discount",
            created_at=datetime.utcnow(),
        ),
        # March 2025
        InvoiceModel(
            id=3,
            invoice_number="INV-2025-0003-RE",
            invoice_date=datetime(2025, 3, 10),
            customer_id=1,
            discount_type="amount",
            discount_amount=None,
            tax_rate=18.0,
            sub_total=1500.0,
            total_tax_amount=270.0,
            grand_total=1770.0,
            amount_paid=1770.0,
            payment_status="paid",
            notes="March paid invoice",
            created_at=datetime.utcnow(),
        ),
        # Invoice with partial number match
        InvoiceModel(
            id=4,
            invoice_number="INV-2025-0004-WS",
            invoice_date=datetime(2025, 3, 25),
            customer_id=2,
            discount_type="amount",
            discount_amount=None,
            tax_rate=18.0,
            sub_total=3000.0,
            total_tax_amount=540.0,
            grand_total=3540.0,
            amount_paid=0,
            payment_status="unpaid",
            notes="Test for number search",
            created_at=datetime.utcnow(),
        ),
    ]
    db.add_all(invoices)
    db.commit()
    db.flush()
    return invoices


class TestGetInvoicesFilters:
    """Test suite for invoice filtering endpoints"""

    def test_get_all_invoices_no_filters(self, db: Session):
        """Test getting all invoices without any filters (backward compatibility)"""
        response = self.client.get("/invoices/")
        assert response.status_code == 200
        invoices = response.json()
        assert len(invoices) == 4
        assert all("id" in inv for inv in invoices)
        assert all("invoice_number" in inv for inv in invoices)

    def test_get_invoices_date_from_only(self, db: Session):
        """Test filtering by date_from only (invoices on/after that date)"""
        response = self.client.get("/invoices/?date_from=2025-01-15")
        assert response.status_code == 200
        invoices = response.json()
        assert len(invoices) == 2
        assert all(inv["invoice_date"] >= "2025-01-15T00:00:00" for inv in invoices)

    def test_get_invoices_date_to_only(self, db: Session):
        """Test filtering by date_to only (invoices on/before that date)"""
        response = self.client.get("/invoices/?date_to=2025-01-31")
        assert response.status_code == 200
        invoices = response.json()
        assert len(invoices) == 3
        assert all(inv["invoice_date"] <= "2025-01-31T23:59:59.999999" for inv in invoices)

    def test_get_invoices_date_range(self, db: Session):
        """Test filtering by date range (from-to)"""
        response = self.client.get("/invoices/?date_from=2025-01-15&date_to=2025-02-28")
        assert response.status_code == 200
        invoices = response.json()
        assert len(invoices) == 2
        for inv in invoices:
            assert "2025-01-15T00:00:00" <= inv["invoice_date"] <= "2025-02-28T23:59:59.999999"

    def test_get_invoices_customer_id_filter(self, db: Session):
        """Test filtering by customer_id (exact customer match)"""
        response = self.client.get("/invoices/?customer_id=1")
        assert response.status_code == 200
        invoices = response.json()
        assert len(invoices) == 3
        assert all(inv["customer_id"] == 1 for inv in invoices)

    def test_get_invoices_customer_name_filter(self, db: Session, sample_customers):
        """Test filtering by customer_name (partial match)"""
        # Create customers first
        customers = sample_customers(db)
        
        response = self.client.get("/invoices/?customer_name=Priya")
        assert response.status_code == 200
        invoices = response.json()
        assert len(invoices) == 2
        assert all("Priya" in inv["customer_name"] for inv in invoices)

    def test_get_invoices_invoice_number_filter(self, db: Session, sample_invoices):
        """Test filtering by invoice_number (partial match)"""
        response = self.client.get("/invoices/?invoice_number=INV-2025")
        assert response.status_code == 200
        invoices = response.json()
        assert len(invoices) == 4
        assert all("INV-2025" in inv["invoice_number"] for inv in invoices)

    def test_get_invoices_combined_filters(self, db: Session):
        """Test combining multiple filters (date range + customer)"""
        response = self.client.get("/invoices/?date_from=2025-01-15&date_to=2025-02-28&customer_id=2")
        assert response.status_code == 200
        invoices = response.json()
        assert len(invoices) == 1
        assert invoices[0]["customer_id"] == 2
        assert "2025-01-15T00:00:00" <= invoices[0]["invoice_date"] <= "2025-02-28T23:59:59.999999"

    def test_get_invoices_invalid_date_format(self, db: Session):
        """Test validation with invalid date format"""
        response = self.client.get("/invoices/?date_from=invalid-date")
        assert response.status_code == 400
        assert "Invalid date_from format" in response.json()["detail"]

    def test_get_invoices_date_from_after_date_to(self, db: Session):
        """Test validation when date_from is after date_to (should return empty or error)"""
        response = self.client.get("/invoices/?date_from=2025-03-01&date_to=2025-02-01")
        assert response.status_code == 200
        invoices = response.json()
        assert len(invoices) == 0

    def test_get_invoices_with_pagination(self, db: Session):
        """Test that pagination works correctly with filters"""
        response = self.client.get("/invoices/?skip=0&limit=2&date_from=2025-01-01")
        assert response.status_code == 200
        invoices = response.json()
        assert len(invoices) == 2
        assert len(invoices) == 2

    def test_response_shape(self, db: Session, sample_invoices):
        """Test that response has expected shape"""
        response = self.client.get("/invoices/")
        assert response.status_code == 200
        invoices = response.json()
        
        for inv in invoices:
            assert "id" in inv
            assert "invoice_number" in inv
            assert "invoice_date" in inv
            assert "customer_name" in inv
            assert "total_amount" in inv
            assert "payment_status" in inv
