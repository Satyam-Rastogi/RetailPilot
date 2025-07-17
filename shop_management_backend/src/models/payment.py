from src.models.user import db
from datetime import datetime
from decimal import Decimal


class Payment(db.Model):
    __tablename__ = 'payments'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Payment details
    payment_number = db.Column(db.String(50), unique=True, nullable=False)
    payment_date = db.Column(db.Date, nullable=False, default=datetime.utcnow().date)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    payment_method = db.Column(db.String(50), nullable=False)  # cash, bank_transfer, upi, cheque, card
    
    # Reference details
    reference_number = db.Column(db.String(100), nullable=True)  # cheque number, transaction ID, etc.
    notes = db.Column(db.Text, nullable=True)
    
    # Invoice reference (without foreign key constraint for now)
    invoice_id = db.Column(db.Integer, nullable=True)
    
    # Customer/Supplier reference (without foreign key constraints for now)
    customer_id = db.Column(db.Integer, nullable=True)
    supplier_id = db.Column(db.Integer, nullable=True)
    
    # Payment type
    payment_type = db.Column(db.String(20), nullable=False)  # 'received' for customer payments, 'made' for supplier payments
    
    # Status
    status = db.Column(db.String(20), nullable=False, default='completed')  # completed, pending, cancelled
    
    # Timestamps
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        # Get customer/supplier name using queries
        customer_name = None
        supplier_name = None
        invoice_number = None
        
        if self.customer_id:
            from src.models.customer import Customer
            customer = Customer.query.get(self.customer_id)
            customer_name = customer.name if customer else None
            
        if self.supplier_id:
            from src.models.supplier import Supplier
            supplier = Supplier.query.get(self.supplier_id)
            supplier_name = supplier.name if supplier else None
            
        if self.invoice_id:
            from src.models.invoice import Invoice
            invoice = Invoice.query.get(self.invoice_id)
            invoice_number = invoice.invoice_number if invoice else None
        
        return {
            'id': self.id,
            'payment_number': self.payment_number,
            'payment_date': self.payment_date.isoformat() if self.payment_date else None,
            'amount': float(self.amount) if self.amount else 0.0,
            'payment_method': self.payment_method,
            'reference_number': self.reference_number,
            'notes': self.notes,
            'invoice_id': self.invoice_id,
            'invoice_number': invoice_number,
            'customer_id': self.customer_id,
            'customer_name': customer_name,
            'supplier_id': self.supplier_id,
            'supplier_name': supplier_name,
            'payment_type': self.payment_type,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    @staticmethod
    def from_dict(data):
        payment = Payment()
        payment.payment_number = data.get('payment_number', '')
        payment.payment_date = datetime.strptime(data.get('payment_date'), '%Y-%m-%d').date() if data.get('payment_date') else datetime.utcnow().date()
        payment.amount = Decimal(str(data.get('amount', 0)))
        payment.payment_method = data.get('payment_method', 'cash')
        payment.reference_number = data.get('reference_number', '')
        payment.notes = data.get('notes', '')
        payment.invoice_id = data.get('invoice_id')
        payment.customer_id = data.get('customer_id')
        payment.supplier_id = data.get('supplier_id')
        payment.payment_type = data.get('payment_type', 'received')
        payment.status = data.get('status', 'completed')
        return payment
    
    @staticmethod
    def generate_payment_number():
        """Generate a unique payment number"""
        from datetime import datetime
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        return f"PAY-{timestamp}"


class LedgerEntry(db.Model):
    __tablename__ = 'ledger_entries'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Entry details
    entry_date = db.Column(db.Date, nullable=False, default=datetime.utcnow().date)
    description = db.Column(db.String(255), nullable=False)
    
    # Amount details
    debit_amount = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    credit_amount = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    
    # References (without foreign key constraints for now)
    customer_id = db.Column(db.Integer, nullable=True)
    supplier_id = db.Column(db.Integer, nullable=True)
    invoice_id = db.Column(db.Integer, nullable=True)
    payment_id = db.Column(db.Integer, nullable=True)
    
    # Entry type
    entry_type = db.Column(db.String(50), nullable=False)  # 'sale', 'purchase', 'payment_received', 'payment_made', 'adjustment'
    
    # Timestamps
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    
    def to_dict(self):
        # Get related entity names using queries
        customer_name = None
        supplier_name = None
        invoice_number = None
        payment_number = None
        
        if self.customer_id:
            from src.models.customer import Customer
            customer = Customer.query.get(self.customer_id)
            customer_name = customer.name if customer else None
            
        if self.supplier_id:
            from src.models.supplier import Supplier
            supplier = Supplier.query.get(self.supplier_id)
            supplier_name = supplier.name if supplier else None
            
        if self.invoice_id:
            from src.models.invoice import Invoice
            invoice = Invoice.query.get(self.invoice_id)
            invoice_number = invoice.invoice_number if invoice else None
            
        if self.payment_id:
            payment = Payment.query.get(self.payment_id)
            payment_number = payment.payment_number if payment else None
        
        return {
            'id': self.id,
            'entry_date': self.entry_date.isoformat() if self.entry_date else None,
            'description': self.description,
            'debit_amount': float(self.debit_amount) if self.debit_amount else 0.0,
            'credit_amount': float(self.credit_amount) if self.credit_amount else 0.0,
            'customer_id': self.customer_id,
            'customer_name': customer_name,
            'supplier_id': self.supplier_id,
            'supplier_name': supplier_name,
            'invoice_id': self.invoice_id,
            'invoice_number': invoice_number,
            'payment_id': self.payment_id,
            'payment_number': payment_number,
            'entry_type': self.entry_type,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

