from flask_sqlalchemy import SQLAlchemy
from src.models.user import db

class Customer(db.Model):
    __tablename__ = 'customer'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    phone_number = db.Column(db.String(20), nullable=True)
    address = db.Column(db.Text, nullable=True)
    gstin = db.Column(db.String(15), nullable=True)
    customer_type = db.Column(db.String(20), nullable=False, default='Retail')  # 'Retail' or 'Wholesale'
    notes = db.Column(db.Text, nullable=True)
    outstanding_balance = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    def __repr__(self):
        return f'<Customer {self.name}>'

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'phone_number': self.phone_number,
            'address': self.address,
            'gstin': self.gstin,
            'customer_type': self.customer_type,
            'notes': self.notes,
            'outstanding_balance': float(self.outstanding_balance) if self.outstanding_balance else 0.0,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

    @staticmethod
    def from_dict(data):
        return Customer(
            name=data.get('name'),
            phone_number=data.get('phone_number'),
            address=data.get('address'),
            gstin=data.get('gstin'),
            customer_type=data.get('customer_type', 'Retail'),
            notes=data.get('notes')
        )

