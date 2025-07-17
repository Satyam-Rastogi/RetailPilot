from flask import Blueprint, jsonify, request
from src.models.supplier import Supplier, db

supplier_bp = Blueprint('supplier', __name__)

@supplier_bp.route('/suppliers', methods=['GET'])
def get_suppliers():
    """Get all suppliers with optional search and filtering."""
    try:
        # Get query parameters
        search = request.args.get('search', '').strip()
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        
        # Build query
        query = Supplier.query
        
        # Apply search filter
        if search:
            query = query.filter(
                db.or_(
                    Supplier.name.ilike(f'%{search}%'),
                    Supplier.contact_person.ilike(f'%{search}%'),
                    Supplier.phone_number.ilike(f'%{search}%')
                )
            )
        
        # Apply pagination
        suppliers = query.order_by(Supplier.name).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'suppliers': [supplier.to_dict() for supplier in suppliers.items],
            'total': suppliers.total,
            'pages': suppliers.pages,
            'current_page': page,
            'per_page': per_page
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@supplier_bp.route('/suppliers', methods=['POST'])
def create_supplier():
    """Create a new supplier."""
    try:
        data = request.json
        
        # Validate required fields
        if not data.get('name'):
            return jsonify({'error': 'Supplier name is required'}), 400
        
        # Create new supplier
        supplier = Supplier.from_dict(data)
        db.session.add(supplier)
        db.session.commit()
        
        return jsonify(supplier.to_dict()), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@supplier_bp.route('/suppliers/<int:supplier_id>', methods=['GET'])
def get_supplier(supplier_id):
    """Get a specific supplier by ID."""
    try:
        supplier = Supplier.query.get_or_404(supplier_id)
        return jsonify(supplier.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@supplier_bp.route('/suppliers/<int:supplier_id>', methods=['PUT'])
def update_supplier(supplier_id):
    """Update a supplier."""
    try:
        supplier = Supplier.query.get_or_404(supplier_id)
        data = request.json
        
        # Validate required fields
        if 'name' in data and not data['name']:
            return jsonify({'error': 'Supplier name is required'}), 400
        
        # Update supplier fields
        supplier.name = data.get('name', supplier.name)
        supplier.contact_person = data.get('contact_person', supplier.contact_person)
        supplier.phone_number = data.get('phone_number', supplier.phone_number)
        supplier.address = data.get('address', supplier.address)
        supplier.gstin = data.get('gstin', supplier.gstin)
        supplier.bank_name = data.get('bank_name', supplier.bank_name)
        supplier.bank_account_number = data.get('bank_account_number', supplier.bank_account_number)
        supplier.bank_ifsc_code = data.get('bank_ifsc_code', supplier.bank_ifsc_code)
        supplier.notes = data.get('notes', supplier.notes)
        
        db.session.commit()
        return jsonify(supplier.to_dict())
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@supplier_bp.route('/suppliers/<int:supplier_id>', methods=['DELETE'])
def delete_supplier(supplier_id):
    """Delete a supplier."""
    try:
        supplier = Supplier.query.get_or_404(supplier_id)
        db.session.delete(supplier)
        db.session.commit()
        return '', 204
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@supplier_bp.route('/suppliers/<int:supplier_id>/ledger', methods=['GET'])
def get_supplier_ledger(supplier_id):
    """Get supplier ledger (placeholder for now)."""
    try:
        supplier = Supplier.query.get_or_404(supplier_id)
        # TODO: Implement ledger calculation when purchase bills and payments are implemented
        return jsonify({
            'supplier': supplier.to_dict(),
            'transactions': [],
            'total_payable': 0.0
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

