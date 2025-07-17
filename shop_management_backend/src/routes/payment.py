from flask import Blueprint, request, jsonify
from src.models.user import db
from src.models.payment import Payment, LedgerEntry
from datetime import datetime
from decimal import Decimal

payment_bp = Blueprint('payment', __name__)

@payment_bp.route('/payments', methods=['GET'])
def get_payments():
    """Get all payments with optional filtering"""
    try:
        # Get query parameters
        payment_type = request.args.get('payment_type')  # 'received' or 'made'
        customer_id = request.args.get('customer_id')
        supplier_id = request.args.get('supplier_id')
        status = request.args.get('status')
        
        # Build query
        query = Payment.query
        
        if payment_type:
            query = query.filter(Payment.payment_type == payment_type)
        if customer_id:
            query = query.filter(Payment.customer_id == int(customer_id))
        if supplier_id:
            query = query.filter(Payment.supplier_id == int(supplier_id))
        if status:
            query = query.filter(Payment.status == status)
        
        payments = query.order_by(Payment.payment_date.desc()).all()
        
        return jsonify({
            'success': True,
            'payments': [payment.to_dict() for payment in payments],
            'total': len(payments)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@payment_bp.route('/payments', methods=['POST'])
def create_payment():
    """Create a new payment and update ledger"""
    try:
        data = request.get_json()
        
        # Generate payment number if not provided
        if not data.get('payment_number'):
            data['payment_number'] = Payment.generate_payment_number()
        
        # Create payment
        payment = Payment.from_dict(data)
        db.session.add(payment)
        db.session.flush()  # Get the payment ID
        
        # Create ledger entries
        create_payment_ledger_entries(payment)
        
        # Update customer/supplier outstanding balance
        update_outstanding_balance(payment)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Payment created successfully',
            'payment': payment.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@payment_bp.route('/payments/<int:payment_id>', methods=['GET'])
def get_payment(payment_id):
    """Get a specific payment"""
    try:
        payment = Payment.query.get_or_404(payment_id)
        return jsonify({
            'success': True,
            'payment': payment.to_dict()
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@payment_bp.route('/payments/<int:payment_id>', methods=['PUT'])
def update_payment(payment_id):
    """Update a payment"""
    try:
        payment = Payment.query.get_or_404(payment_id)
        data = request.get_json()
        
        # Store old values for ledger adjustment
        old_amount = payment.amount
        old_customer_id = payment.customer_id
        old_supplier_id = payment.supplier_id
        old_payment_type = payment.payment_type
        
        # Update payment fields
        payment.payment_date = datetime.strptime(data.get('payment_date'), '%Y-%m-%d').date() if data.get('payment_date') else payment.payment_date
        payment.amount = Decimal(str(data.get('amount', payment.amount)))
        payment.payment_method = data.get('payment_method', payment.payment_method)
        payment.reference_number = data.get('reference_number', payment.reference_number)
        payment.notes = data.get('notes', payment.notes)
        payment.status = data.get('status', payment.status)
        payment.updated_at = datetime.utcnow()
        
        # If amount or customer/supplier changed, adjust ledger and balances
        if (old_amount != payment.amount or 
            old_customer_id != payment.customer_id or 
            old_supplier_id != payment.supplier_id):
            
            # Reverse old ledger entries
            reverse_payment_ledger_entries(payment, old_amount, old_customer_id, old_supplier_id, old_payment_type)
            
            # Create new ledger entries
            create_payment_ledger_entries(payment)
            
            # Update balances
            reverse_outstanding_balance_update(old_amount, old_customer_id, old_supplier_id, old_payment_type)
            update_outstanding_balance(payment)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Payment updated successfully',
            'payment': payment.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@payment_bp.route('/payments/<int:payment_id>', methods=['DELETE'])
def delete_payment(payment_id):
    """Delete a payment and reverse ledger entries"""
    try:
        payment = Payment.query.get_or_404(payment_id)
        
        # Reverse ledger entries
        reverse_payment_ledger_entries(payment, payment.amount, payment.customer_id, payment.supplier_id, payment.payment_type)
        
        # Reverse outstanding balance update
        reverse_outstanding_balance_update(payment.amount, payment.customer_id, payment.supplier_id, payment.payment_type)
        
        db.session.delete(payment)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Payment deleted successfully'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@payment_bp.route('/ledger', methods=['GET'])
def get_ledger_entries():
    """Get ledger entries with optional filtering"""
    try:
        # Get query parameters
        customer_id = request.args.get('customer_id')
        supplier_id = request.args.get('supplier_id')
        entry_type = request.args.get('entry_type')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Build query
        query = LedgerEntry.query
        
        if customer_id:
            query = query.filter(LedgerEntry.customer_id == int(customer_id))
        if supplier_id:
            query = query.filter(LedgerEntry.supplier_id == int(supplier_id))
        if entry_type:
            query = query.filter(LedgerEntry.entry_type == entry_type)
        if start_date:
            query = query.filter(LedgerEntry.entry_date >= datetime.strptime(start_date, '%Y-%m-%d').date())
        if end_date:
            query = query.filter(LedgerEntry.entry_date <= datetime.strptime(end_date, '%Y-%m-%d').date())
        
        entries = query.order_by(LedgerEntry.entry_date.desc(), LedgerEntry.created_at.desc()).all()
        
        # Calculate running balance if filtering by customer or supplier
        running_balance = 0
        entries_with_balance = []
        
        for entry in reversed(entries):  # Process in chronological order
            running_balance += float(entry.debit_amount) - float(entry.credit_amount)
            entry_dict = entry.to_dict()
            entry_dict['running_balance'] = running_balance
            entries_with_balance.append(entry_dict)
        
        entries_with_balance.reverse()  # Return in reverse chronological order
        
        return jsonify({
            'success': True,
            'entries': entries_with_balance,
            'total': len(entries_with_balance),
            'final_balance': running_balance
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@payment_bp.route('/balances', methods=['GET'])
def get_balances():
    """Get outstanding balances for customers and suppliers"""
    try:
        # Get customer balances
        from src.models.customer import Customer
        customers = Customer.query.all()
        customer_balances = []
        
        for customer in customers:
            customer_balances.append({
                'id': customer.id,
                'name': customer.name,
                'balance': float(customer.outstanding_balance) if customer.outstanding_balance else 0.0,
                'type': 'customer'
            })
        
        # Get supplier balances
        from src.models.supplier import Supplier
        suppliers = Supplier.query.all()
        supplier_balances = []
        
        for supplier in suppliers:
            supplier_balances.append({
                'id': supplier.id,
                'name': supplier.name,
                'balance': float(supplier.outstanding_balance) if supplier.outstanding_balance else 0.0,
                'type': 'supplier'
            })
        
        return jsonify({
            'success': True,
            'customer_balances': customer_balances,
            'supplier_balances': supplier_balances
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Helper functions
def create_payment_ledger_entries(payment):
    """Create ledger entries for a payment"""
    if payment.payment_type == 'received':
        # Payment received from customer
        # Debit: Cash/Bank, Credit: Customer Account
        
        # Cash/Bank entry
        cash_entry = LedgerEntry(
            entry_date=payment.payment_date,
            description=f"Payment received from customer - {payment.payment_number}",
            debit_amount=payment.amount,
            credit_amount=0,
            customer_id=payment.customer_id,
            payment_id=payment.id,
            entry_type='payment_received'
        )
        db.session.add(cash_entry)
        
        # Customer account entry
        customer_entry = LedgerEntry(
            entry_date=payment.payment_date,
            description=f"Payment received - {payment.payment_number}",
            debit_amount=0,
            credit_amount=payment.amount,
            customer_id=payment.customer_id,
            payment_id=payment.id,
            entry_type='payment_received'
        )
        db.session.add(customer_entry)
        
    elif payment.payment_type == 'made':
        # Payment made to supplier
        # Debit: Supplier Account, Credit: Cash/Bank
        
        # Supplier account entry
        supplier_entry = LedgerEntry(
            entry_date=payment.payment_date,
            description=f"Payment made to supplier - {payment.payment_number}",
            debit_amount=payment.amount,
            credit_amount=0,
            supplier_id=payment.supplier_id,
            payment_id=payment.id,
            entry_type='payment_made'
        )
        db.session.add(supplier_entry)
        
        # Cash/Bank entry
        cash_entry = LedgerEntry(
            entry_date=payment.payment_date,
            description=f"Payment made to supplier - {payment.payment_number}",
            debit_amount=0,
            credit_amount=payment.amount,
            supplier_id=payment.supplier_id,
            payment_id=payment.id,
            entry_type='payment_made'
        )
        db.session.add(cash_entry)

def reverse_payment_ledger_entries(payment, old_amount, old_customer_id, old_supplier_id, old_payment_type):
    """Reverse ledger entries for a payment"""
    # Delete existing ledger entries for this payment
    LedgerEntry.query.filter(LedgerEntry.payment_id == payment.id).delete()

def update_outstanding_balance(payment):
    """Update customer or supplier outstanding balance"""
    if payment.payment_type == 'received' and payment.customer_id:
        from src.models.customer import Customer
        customer = Customer.query.get(payment.customer_id)
        if customer:
            customer.outstanding_balance = (customer.outstanding_balance or 0) - payment.amount
            
    elif payment.payment_type == 'made' and payment.supplier_id:
        from src.models.supplier import Supplier
        supplier = Supplier.query.get(payment.supplier_id)
        if supplier:
            supplier.outstanding_balance = (supplier.outstanding_balance or 0) - payment.amount

def reverse_outstanding_balance_update(amount, customer_id, supplier_id, payment_type):
    """Reverse the outstanding balance update"""
    if payment_type == 'received' and customer_id:
        from src.models.customer import Customer
        customer = Customer.query.get(customer_id)
        if customer:
            customer.outstanding_balance = (customer.outstanding_balance or 0) + amount
            
    elif payment_type == 'made' and supplier_id:
        from src.models.supplier import Supplier
        supplier = Supplier.query.get(supplier_id)
        if supplier:
            supplier.outstanding_balance = (supplier.outstanding_balance or 0) + amount

