from flask import Blueprint, jsonify, request
from src.models.customer import Customer, db

customer_bp = Blueprint('customer', __name__)

@customer_bp.route('/customers', methods=['GET'])
def get_customers():
    """Get all customers with optional search and filtering."""
    try:
        # Get query parameters
        search = request.args.get('search', '').strip()
        customer_type = request.args.get('type', '').strip()
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        
        # Build query
        query = Customer.query
        
        # Apply search filter
        if search:
            query = query.filter(
                db.or_(
                    Customer.name.ilike(f'%{search}%'),
                    Customer.phone_number.ilike(f'%{search}%')
                )
            )
        
        # Apply type filter
        if customer_type and customer_type in ['Retail', 'Wholesale']:
            query = query.filter(Customer.customer_type == customer_type)
        
        # Apply pagination
        customers = query.order_by(Customer.name).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'customers': [customer.to_dict() for customer in customers.items],
            'total': customers.total,
            'pages': customers.pages,
            'current_page': page,
            'per_page': per_page
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@customer_bp.route('/customers', methods=['POST'])
def create_customer():
    """Create a new customer."""
    try:
        data = request.json
        
        # Validate required fields
        if not data.get('name'):
            return jsonify({'error': 'Customer name is required'}), 400
        
        # Validate customer type
        customer_type = data.get('customer_type', 'Retail')
        if customer_type not in ['Retail', 'Wholesale']:
            return jsonify({'error': 'Customer type must be either Retail or Wholesale'}), 400
        
        # Create new customer
        customer = Customer.from_dict(data)
        db.session.add(customer)
        db.session.commit()
        
        return jsonify(customer.to_dict()), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@customer_bp.route('/customers/<int:customer_id>', methods=['GET'])
def get_customer(customer_id):
    """Get a specific customer by ID."""
    try:
        customer = Customer.query.get_or_404(customer_id)
        return jsonify(customer.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@customer_bp.route('/customers/<int:customer_id>', methods=['PUT'])
def update_customer(customer_id):
    """Update a customer."""
    try:
        customer = Customer.query.get_or_404(customer_id)
        data = request.json
        
        # Validate required fields
        if 'name' in data and not data['name']:
            return jsonify({'error': 'Customer name is required'}), 400
        
        # Validate customer type
        if 'customer_type' in data and data['customer_type'] not in ['Retail', 'Wholesale']:
            return jsonify({'error': 'Customer type must be either Retail or Wholesale'}), 400
        
        # Update customer fields
        customer.name = data.get('name', customer.name)
        customer.phone_number = data.get('phone_number', customer.phone_number)
        customer.address = data.get('address', customer.address)
        customer.gstin = data.get('gstin', customer.gstin)
        customer.customer_type = data.get('customer_type', customer.customer_type)
        customer.notes = data.get('notes', customer.notes)
        
        db.session.commit()
        return jsonify(customer.to_dict())
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@customer_bp.route('/customers/<int:customer_id>', methods=['DELETE'])
def delete_customer(customer_id):
    """Delete a customer."""
    try:
        customer = Customer.query.get_or_404(customer_id)
        db.session.delete(customer)
        db.session.commit()
        return '', 204
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@customer_bp.route('/customers/<int:customer_id>/ledger', methods=['GET'])
def get_customer_ledger(customer_id):
    """Get customer ledger (placeholder for now)."""
    try:
        customer = Customer.query.get_or_404(customer_id)
        # TODO: Implement ledger calculation when invoices and payments are implemented
        return jsonify({
            'customer': customer.to_dict(),
            'transactions': [],
            'outstanding_balance': 0.0
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

