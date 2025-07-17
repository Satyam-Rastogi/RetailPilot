from flask import Blueprint, jsonify, request
from src.models.company_profile import CompanyProfile, db

company_profile_bp = Blueprint('company_profile', __name__)

@company_profile_bp.route('/company-profile', methods=['GET'])
def get_company_profile():
    """Get the company profile. Returns empty profile if none exists."""
    profile = CompanyProfile.query.first()
    if profile:
        return jsonify(profile.to_dict())
    else:
        # Return a default empty profile structure
        return jsonify({
            'id': None,
            'shop_name': '',
            'shop_address': '',
            'shop_phone': '',
            'shop_gstin': '',
            'default_tax_rate': 0.0,
            'currency_symbol': '₹',
            'receiver_bank_name': '',
            'receiver_account_number': '',
            'receiver_ifsc_code': '',
            'upi_bank_name': '',
            'upi_id': '',
            'upi_account_number': '',
            'created_at': None,
            'updated_at': None
        })

@company_profile_bp.route('/company-profile', methods=['POST'])
def create_or_update_company_profile():
    """Create or update the company profile."""
    try:
        data = request.json
        
        # Validate required fields
        if not data.get('shop_name'):
            return jsonify({'error': 'Shop name is required'}), 400
        
        if 'default_tax_rate' in data:
            try:
                data['default_tax_rate'] = float(data['default_tax_rate'])
                if data['default_tax_rate'] < 0 or data['default_tax_rate'] > 100:
                    return jsonify({'error': 'Tax rate must be between 0 and 100'}), 400
            except (ValueError, TypeError):
                return jsonify({'error': 'Invalid tax rate format'}), 400
        
        # Check if profile already exists
        profile = CompanyProfile.query.first()
        
        if profile:
            # Update existing profile
            profile.shop_name = data.get('shop_name', profile.shop_name)
            profile.shop_address = data.get('shop_address', profile.shop_address)
            profile.shop_phone = data.get('shop_phone', profile.shop_phone)
            profile.shop_gstin = data.get('shop_gstin', profile.shop_gstin)
            profile.default_tax_rate = data.get('default_tax_rate', profile.default_tax_rate)
            profile.currency_symbol = data.get('currency_symbol', profile.currency_symbol)
            profile.receiver_bank_name = data.get('receiver_bank_name', profile.receiver_bank_name)
            profile.receiver_account_number = data.get('receiver_account_number', profile.receiver_account_number)
            profile.receiver_ifsc_code = data.get('receiver_ifsc_code', profile.receiver_ifsc_code)
            profile.upi_bank_name = data.get('upi_bank_name', profile.upi_bank_name)
            profile.upi_id = data.get('upi_id', profile.upi_id)
            profile.upi_account_number = data.get('upi_account_number', profile.upi_account_number)
        else:
            # Create new profile
            profile = CompanyProfile.from_dict(data)
            db.session.add(profile)
        
        db.session.commit()
        return jsonify(profile.to_dict()), 200 if CompanyProfile.query.first() else 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@company_profile_bp.route('/company-profile', methods=['PUT'])
def update_company_profile():
    """Update the company profile."""
    try:
        profile = CompanyProfile.query.first()
        if not profile:
            return jsonify({'error': 'Company profile not found. Please create one first.'}), 404
        
        data = request.json
        
        # Validate required fields
        if 'shop_name' in data and not data['shop_name']:
            return jsonify({'error': 'Shop name is required'}), 400
        
        if 'default_tax_rate' in data:
            try:
                data['default_tax_rate'] = float(data['default_tax_rate'])
                if data['default_tax_rate'] < 0 or data['default_tax_rate'] > 100:
                    return jsonify({'error': 'Tax rate must be between 0 and 100'}), 400
            except (ValueError, TypeError):
                return jsonify({'error': 'Invalid tax rate format'}), 400
        
        # Update profile fields
        profile.shop_name = data.get('shop_name', profile.shop_name)
        profile.shop_address = data.get('shop_address', profile.shop_address)
        profile.shop_phone = data.get('shop_phone', profile.shop_phone)
        profile.shop_gstin = data.get('shop_gstin', profile.shop_gstin)
        profile.default_tax_rate = data.get('default_tax_rate', profile.default_tax_rate)
        profile.currency_symbol = data.get('currency_symbol', profile.currency_symbol)
        profile.receiver_bank_name = data.get('receiver_bank_name', profile.receiver_bank_name)
        profile.receiver_account_number = data.get('receiver_account_number', profile.receiver_account_number)
        profile.receiver_ifsc_code = data.get('receiver_ifsc_code', profile.receiver_ifsc_code)
        profile.upi_bank_name = data.get('upi_bank_name', profile.upi_bank_name)
        profile.upi_id = data.get('upi_id', profile.upi_id)
        profile.upi_account_number = data.get('upi_account_number', profile.upi_account_number)
        
        db.session.commit()
        return jsonify(profile.to_dict())
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

