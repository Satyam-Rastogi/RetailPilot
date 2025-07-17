from flask_sqlalchemy import SQLAlchemy
from src.models.user import db

class Supplier(db.Model):
    __tablename__ = 'supplier'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    contact_person = db.Column(db.String(255), nullable=True)
    phone_number = db.Column(db.String(20), nullable=True)
    address = db.Column(db.Text, nullable=True)
    gstin = db.Column(db.String(15), nullable=True)
    bank_name = db.Column(db.String(255), nullable=True)
    bank_account_number = db.Column(db.String(50), nullable=True)
    bank_ifsc_code = db.Column(db.String(11), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    outstanding_balance = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    def __repr__(self):
        return f'<Supplier {self.name}>'

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'contact_person': self.contact_person,
            'phone_number': self.phone_number,
            'address': self.address,
            'gstin': self.gstin,
            'bank_name': self.bank_name,
            'bank_account_number': self.bank_account_number,
            'bank_ifsc_code': self.bank_ifsc_code,
            'notes': self.notes,
            'outstanding_balance': float(self.outstanding_balance) if self.outstanding_balance else 0.0,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

    @staticmethod
    def from_dict(data):
        return Supplier(
            name=data.get('name'),
            contact_person=data.get('contact_person'),
            phone_number=data.get('phone_number'),
            address=data.get('address'),
            gstin=data.get('gstin'),
            bank_name=data.get('bank_name'),
            bank_account_number=data.get('bank_account_number'),
            bank_ifsc_code=data.get('bank_ifsc_code'),
            notes=data.get('notes')
        )

