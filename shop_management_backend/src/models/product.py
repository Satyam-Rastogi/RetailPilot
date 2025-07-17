from src.models.user import db
from datetime import datetime

class Product(db.Model):
    __tablename__ = 'products'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    sku = db.Column(db.String(100), unique=True, nullable=True)  # Stock Keeping Unit
    category = db.Column(db.String(100), nullable=True)
    
    # Pricing
    retail_price = db.Column(db.Numeric(10, 2), nullable=False)
    wholesale_price = db.Column(db.Numeric(10, 2), nullable=False)
    cost_price = db.Column(db.Numeric(10, 2), nullable=True, default=0.00)  # Purchase cost
    
    # Stock Management
    stock_quantity = db.Column(db.Integer, nullable=False, default=0)
    min_stock_level = db.Column(db.Integer, nullable=True, default=0)  # Reorder level
    max_stock_level = db.Column(db.Integer, nullable=True, default=1000)
    unit_of_measurement = db.Column(db.String(50), nullable=True, default='pcs')  # pcs, kg, ltr, etc.
    barcode = db.Column(db.String(100), nullable=True)
    tax_rate = db.Column(db.Numeric(5, 2), nullable=True, default=0.00)  # Tax percentage
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f'<Product {self.name}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'sku': self.sku,
            'category': self.category,
            'retail_price': float(self.retail_price) if self.retail_price else 0.00,
            'wholesale_price': float(self.wholesale_price) if self.wholesale_price else 0.00,
            'cost_price': float(self.cost_price) if self.cost_price else 0.00,
            'stock_quantity': self.stock_quantity,
            'min_stock_level': self.min_stock_level,
            'max_stock_level': self.max_stock_level,
            'unit_of_measurement': self.unit_of_measurement,
            'barcode': self.barcode,
            'tax_rate': float(self.tax_rate) if self.tax_rate else 0.00,
            'is_active': self.is_active,
            'is_low_stock': self.stock_quantity <= (self.min_stock_level or 0),
            'retail_stock_value': float(self.retail_price * self.stock_quantity) if self.retail_price else 0.00,
            'wholesale_stock_value': float(self.wholesale_price * self.stock_quantity) if self.wholesale_price else 0.00,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def get_price_for_type(self, customer_type):
        """Get price based on customer type (Retail/Wholesale)"""
        if customer_type and customer_type.lower() == 'wholesale':
            return float(self.wholesale_price) if self.wholesale_price else 0.00
        else:
            return float(self.retail_price) if self.retail_price else 0.00
    
    @staticmethod
    def from_dict(data):
        product = Product()
        product.name = data.get('name', '')
        product.description = data.get('description', '')
        product.sku = data.get('sku', '')
        product.category = data.get('category', '')
        product.retail_price = data.get('retail_price', 0.00)
        product.wholesale_price = data.get('wholesale_price', 0.00)
        product.cost_price = data.get('cost_price', 0.00)
        product.stock_quantity = data.get('stock_quantity', 0)
        product.min_stock_level = data.get('min_stock_level', 0)
        product.max_stock_level = data.get('max_stock_level', 1000)
        product.unit_of_measurement = data.get('unit_of_measurement', 'pcs')
        product.barcode = data.get('barcode', '')
        product.tax_rate = data.get('tax_rate', 0.00)
        product.is_active = data.get('is_active', True)
        return product
    
    def update_from_dict(self, data):
        """Update product fields from dictionary"""
        self.name = data.get('name', self.name)
        self.description = data.get('description', self.description)
        self.sku = data.get('sku', self.sku)
        self.category = data.get('category', self.category)
        self.retail_price = data.get('retail_price', self.retail_price)
        self.wholesale_price = data.get('wholesale_price', self.wholesale_price)
        self.cost_price = data.get('cost_price', self.cost_price)
        self.stock_quantity = data.get('stock_quantity', self.stock_quantity)
        self.min_stock_level = data.get('min_stock_level', self.min_stock_level)
        self.max_stock_level = data.get('max_stock_level', self.max_stock_level)
        self.unit_of_measurement = data.get('unit_of_measurement', self.unit_of_measurement)
        self.barcode = data.get('barcode', self.barcode)
        self.tax_rate = data.get('tax_rate', self.tax_rate)
        self.is_active = data.get('is_active', self.is_active)
        self.updated_at = datetime.utcnow()
    
    def adjust_stock(self, quantity_change, reason='manual_adjustment'):
        """Adjust stock quantity (positive for increase, negative for decrease)"""
        old_quantity = self.stock_quantity
        self.stock_quantity += quantity_change
        self.updated_at = datetime.utcnow()
        
        # Ensure stock doesn't go negative
        if self.stock_quantity < 0:
            self.stock_quantity = 0
        
        return {
            'old_quantity': old_quantity,
            'new_quantity': self.stock_quantity,
            'change': quantity_change,
            'reason': reason
        }

