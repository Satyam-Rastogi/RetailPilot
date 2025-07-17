from src.models.user import db
from datetime import datetime
from decimal import Decimal

class Invoice(db.Model):
    __tablename__ = 'invoices'
    
    id = db.Column(db.Integer, primary_key=True)
    invoice_number = db.Column(db.String(50), unique=True, nullable=False)
    invoice_type = db.Column(db.String(20), nullable=False)  # 'sales' or 'purchase'
    
    # Customer/Supplier references (without foreign key constraints for now)
    customer_id = db.Column(db.Integer, nullable=True)
    supplier_id = db.Column(db.Integer, nullable=True)
    
    # Invoice details
    invoice_date = db.Column(db.Date, nullable=False, default=datetime.utcnow().date)
    due_date = db.Column(db.Date, nullable=True)
    
    # Financial details
    subtotal = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    tax_amount = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    discount_amount = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    total_amount = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    paid_amount = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    
    # Status and notes
    status = db.Column(db.String(20), nullable=False, default='draft')  # draft, sent, paid, overdue, cancelled
    notes = db.Column(db.Text, nullable=True)
    terms_conditions = db.Column(db.Text, nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    line_items = db.relationship('InvoiceLineItem', backref='invoice', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Invoice {self.invoice_number}>'
    
    @property
    def outstanding_amount(self):
        """Calculate outstanding amount"""
        return float(self.total_amount - self.paid_amount)
    
    @property
    def is_paid(self):
        """Check if invoice is fully paid"""
        return self.paid_amount >= self.total_amount
    
    @property
    def payment_status(self):
        """Get payment status"""
        if self.paid_amount == 0:
            return 'unpaid'
        elif self.paid_amount >= self.total_amount:
            return 'paid'
        else:
            return 'partial'
    
    def calculate_totals(self):
        """Calculate and update invoice totals from line items"""
        subtotal = sum(item.line_total for item in self.line_items)
        tax_amount = sum(item.tax_amount for item in self.line_items)
        
        self.subtotal = subtotal
        self.tax_amount = tax_amount
        self.total_amount = subtotal + tax_amount - self.discount_amount
        self.updated_at = datetime.utcnow()
    
    def to_dict(self):
        # Get customer and supplier data using queries
        customer_name = None
        supplier_name = None
        
        if self.customer_id:
            from src.models.customer import Customer
            customer = Customer.query.get(self.customer_id)
            customer_name = customer.name if customer else None
            
        if self.supplier_id:
            from src.models.supplier import Supplier
            supplier = Supplier.query.get(self.supplier_id)
            supplier_name = supplier.name if supplier else None
        
        return {
            'id': self.id,
            'invoice_number': self.invoice_number,
            'invoice_type': self.invoice_type,
            'customer_id': self.customer_id,
            'supplier_id': self.supplier_id,
            'customer_name': customer_name,
            'supplier_name': supplier_name,
            'invoice_date': self.invoice_date.isoformat() if self.invoice_date else None,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'subtotal': float(self.subtotal),
            'tax_amount': float(self.tax_amount),
            'discount_amount': float(self.discount_amount),
            'total_amount': float(self.total_amount),
            'paid_amount': float(self.paid_amount),
            'outstanding_amount': self.outstanding_amount,
            'status': self.status,
            'payment_status': self.payment_status,
            'is_paid': self.is_paid,
            'notes': self.notes,
            'terms_conditions': self.terms_conditions,
            'line_items': [item.to_dict() for item in self.line_items],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    @staticmethod
    def from_dict(data):
        invoice = Invoice()
        invoice.invoice_number = data.get('invoice_number', '')
        invoice.invoice_type = data.get('invoice_type', 'sales')
        invoice.customer_id = data.get('customer_id')
        invoice.supplier_id = data.get('supplier_id')
        invoice.invoice_date = datetime.strptime(data['invoice_date'], '%Y-%m-%d').date() if data.get('invoice_date') else datetime.utcnow().date()
        invoice.due_date = datetime.strptime(data['due_date'], '%Y-%m-%d').date() if data.get('due_date') else None
        invoice.discount_amount = Decimal(str(data.get('discount_amount', 0)))
        invoice.status = data.get('status', 'draft')
        invoice.notes = data.get('notes', '')
        invoice.terms_conditions = data.get('terms_conditions', '')
        return invoice
    
    def update_from_dict(self, data):
        """Update invoice fields from dictionary"""
        self.invoice_number = data.get('invoice_number', self.invoice_number)
        self.invoice_type = data.get('invoice_type', self.invoice_type)
        self.customer_id = data.get('customer_id', self.customer_id)
        self.supplier_id = data.get('supplier_id', self.supplier_id)
        
        if data.get('invoice_date'):
            self.invoice_date = datetime.strptime(data['invoice_date'], '%Y-%m-%d').date()
        if data.get('due_date'):
            self.due_date = datetime.strptime(data['due_date'], '%Y-%m-%d').date()
            
        self.discount_amount = Decimal(str(data.get('discount_amount', self.discount_amount)))
        self.status = data.get('status', self.status)
        self.notes = data.get('notes', self.notes)
        self.terms_conditions = data.get('terms_conditions', self.terms_conditions)
        self.updated_at = datetime.utcnow()


class InvoiceLineItem(db.Model):
    __tablename__ = 'invoice_line_items'
    
    id = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoices.id'), nullable=False)
    product_id = db.Column(db.Integer, nullable=True)  # Removed foreign key constraint
    
    # Item details
    item_name = db.Column(db.String(255), nullable=False)
    item_description = db.Column(db.Text, nullable=True)
    quantity = db.Column(db.Numeric(10, 3), nullable=False, default=1)
    unit_price = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    tax_rate = db.Column(db.Numeric(5, 2), nullable=False, default=0.00)
    
    # Calculated fields
    line_total = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    tax_amount = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    
    def __repr__(self):
        return f'<InvoiceLineItem {self.item_name}>'
    
    def calculate_amounts(self):
        """Calculate line total and tax amount"""
        subtotal = self.quantity * self.unit_price
        self.tax_amount = subtotal * (self.tax_rate / 100)
        self.line_total = subtotal + self.tax_amount
    
    def to_dict(self):
        # Get product data using query
        product_name = None
        product_sku = None
        
        if self.product_id:
            from src.models.product import Product
            product = Product.query.get(self.product_id)
            if product:
                product_name = product.name
                product_sku = product.sku
        
        return {
            'id': self.id,
            'invoice_id': self.invoice_id,
            'product_id': self.product_id,
            'product_name': product_name,
            'product_sku': product_sku,
            'item_name': self.item_name,
            'item_description': self.item_description,
            'quantity': float(self.quantity),
            'unit_price': float(self.unit_price),
            'tax_rate': float(self.tax_rate),
            'line_total': float(self.line_total),
            'tax_amount': float(self.tax_amount)
        }
    
    @staticmethod
    def from_dict(data):
        line_item = InvoiceLineItem()
        line_item.product_id = data.get('product_id')
        line_item.item_name = data.get('item_name', '')
        line_item.item_description = data.get('item_description', '')
        line_item.quantity = Decimal(str(data.get('quantity', 1)))
        line_item.unit_price = Decimal(str(data.get('unit_price', 0)))
        line_item.tax_rate = Decimal(str(data.get('tax_rate', 0)))
        line_item.calculate_amounts()
        return line_item

