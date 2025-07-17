from flask_sqlalchemy import SQLAlchemy
from src.models.user import db

class CompanyProfile(db.Model):
    __tablename__ = 'company_profile'
    
    id = db.Column(db.Integer, primary_key=True)
    shop_name = db.Column(db.String(255), nullable=False)
    shop_address = db.Column(db.Text, nullable=True)
    shop_phone = db.Column(db.String(20), nullable=True)
    shop_gstin = db.Column(db.String(15), nullable=True)
    default_tax_rate = db.Column(db.Float, nullable=False, default=0.0)
    currency_symbol = db.Column(db.String(5), nullable=False, default='₹')
    receiver_bank_name = db.Column(db.String(255), nullable=True)
    receiver_account_number = db.Column(db.String(50), nullable=True)
    receiver_ifsc_code = db.Column(db.String(11), nullable=True)
    upi_bank_name = db.Column(db.String(255), nullable=True)
    upi_id = db.Column(db.String(100), nullable=True)
    upi_account_number = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    def __repr__(self):
        return f'<CompanyProfile {self.shop_name}>'

    def to_dict(self):
        return {
            'id': self.id,
            'shop_name': self.shop_name,
            'shop_address': self.shop_address,
            'shop_phone': self.shop_phone,
            'shop_gstin': self.shop_gstin,
            'default_tax_rate': self.default_tax_rate,
            'currency_symbol': self.currency_symbol,
            'receiver_bank_name': self.receiver_bank_name,
            'receiver_account_number': self.receiver_account_number,
            'receiver_ifsc_code': self.receiver_ifsc_code,
            'upi_bank_name': self.upi_bank_name,
            'upi_id': self.upi_id,
            'upi_account_number': self.upi_account_number,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

    @staticmethod
    def from_dict(data):
        return CompanyProfile(
            shop_name=data.get('shop_name'),
            shop_address=data.get('shop_address'),
            shop_phone=data.get('shop_phone'),
            shop_gstin=data.get('shop_gstin'),
            default_tax_rate=data.get('default_tax_rate', 0.0),
            currency_symbol=data.get('currency_symbol', '₹'),
            receiver_bank_name=data.get('receiver_bank_name'),
            receiver_account_number=data.get('receiver_account_number'),
            receiver_ifsc_code=data.get('receiver_ifsc_code'),
            upi_bank_name=data.get('upi_bank_name'),
            upi_id=data.get('upi_id'),
            upi_account_number=data.get('upi_account_number')
        )

