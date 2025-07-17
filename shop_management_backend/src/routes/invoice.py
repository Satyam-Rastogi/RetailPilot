from flask import Blueprint, request, jsonify
from src.models.invoice import Invoice, InvoiceLineItem, db
from src.models.product import Product
from src.models.customer import Customer
from src.models.supplier import Supplier
from sqlalchemy import or_, and_
from datetime import datetime, timedelta
import uuid

invoice_bp = Blueprint('invoice', __name__)

@invoice_bp.route('/invoices', methods=['GET'])
def get_invoices():
    """Get all invoices with optional filtering"""
    try:
        # Get query parameters
        invoice_type = request.args.get('type', '')  # 'sales' or 'purchase'
        customer_id = request.args.get('customer_id', '')
        supplier_id = request.args.get('supplier_id', '')
        status = request.args.get('status', '')
        search = request.args.get('search', '').strip()
        
        # Build query
        query = Invoice.query
        
        # Filter by type
        if invoice_type in ['sales', 'purchase']:
            query = query.filter(Invoice.invoice_type == invoice_type)
        
        # Filter by customer
        if customer_id:
            query = query.filter(Invoice.customer_id == int(customer_id))
        
        # Filter by supplier
        if supplier_id:
            query = query.filter(Invoice.supplier_id == int(supplier_id))
        
        # Filter by status
        if status:
            query = query.filter(Invoice.status == status)
        
        # Search filter
        if search:
            query = query.filter(
                or_(
                    Invoice.invoice_number.ilike(f'%{search}%'),
                    Invoice.notes.ilike(f'%{search}%')
                )
            )
        
        # Get invoices ordered by date (newest first)
        invoices = query.order_by(Invoice.invoice_date.desc()).all()
        invoices_data = [invoice.to_dict() for invoice in invoices]
        
        # Calculate summary statistics
        total_invoices = len(invoices_data)
        total_amount = sum(inv['total_amount'] for inv in invoices_data)
        total_outstanding = sum(inv['outstanding_amount'] for inv in invoices_data)
        paid_invoices = sum(1 for inv in invoices_data if inv['is_paid'])
        
        return jsonify({
            'invoices': invoices_data,
            'summary': {
                'total_invoices': total_invoices,
                'total_amount': total_amount,
                'total_outstanding': total_outstanding,
                'paid_invoices': paid_invoices,
                'unpaid_invoices': total_invoices - paid_invoices
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@invoice_bp.route('/invoices/<int:invoice_id>', methods=['GET'])
def get_invoice(invoice_id):
    """Get a specific invoice by ID"""
    try:
        invoice = Invoice.query.get_or_404(invoice_id)
        return jsonify(invoice.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@invoice_bp.route('/invoices', methods=['POST'])
def create_invoice():
    """Create a new invoice"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Validate required fields
        if not data.get('invoice_type') or data['invoice_type'] not in ['sales', 'purchase']:
            return jsonify({'error': 'Valid invoice_type (sales/purchase) is required'}), 400
        
        if data['invoice_type'] == 'sales' and not data.get('customer_id'):
            return jsonify({'error': 'customer_id is required for sales invoices'}), 400
        
        if data['invoice_type'] == 'purchase' and not data.get('supplier_id'):
            return jsonify({'error': 'supplier_id is required for purchase invoices'}), 400
        
        # Generate invoice number if not provided
        if not data.get('invoice_number'):
            prefix = 'INV-S' if data['invoice_type'] == 'sales' else 'INV-P'
            timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
            data['invoice_number'] = f"{prefix}-{timestamp}"
        
        # Check if invoice number already exists
        existing_invoice = Invoice.query.filter_by(invoice_number=data['invoice_number']).first()
        if existing_invoice:
            return jsonify({'error': 'Invoice number already exists'}), 400
        
        # Create invoice
        invoice = Invoice.from_dict(data)
        db.session.add(invoice)
        db.session.flush()  # Get the invoice ID
        
        # Add line items
        line_items_data = data.get('line_items', [])
        for item_data in line_items_data:
            line_item = InvoiceLineItem.from_dict(item_data)
            line_item.invoice_id = invoice.id
            
            # If product_id is provided, get product details
            if line_item.product_id:
                product = Product.query.get(line_item.product_id)
                if product:
                    line_item.item_name = product.name
                    line_item.item_description = product.description
                    if not item_data.get('unit_price'):
                        line_item.unit_price = product.unit_price
                    if not item_data.get('tax_rate'):
                        line_item.tax_rate = product.tax_rate
                    line_item.calculate_amounts()
            
            db.session.add(line_item)
        
        # Calculate totals
        db.session.flush()  # Ensure line items are saved
        invoice.calculate_totals()
        
        # Update product stock for sales invoices
        if invoice.invoice_type == 'sales':
            for line_item in invoice.line_items:
                if line_item.product_id:
                    product = Product.query.get(line_item.product_id)
                    if product:
                        product.adjust_stock(-int(line_item.quantity), 'sales_invoice')
        
        # Update product stock for purchase invoices (increase stock)
        elif invoice.invoice_type == 'purchase':
            for line_item in invoice.line_items:
                if line_item.product_id:
                    product = Product.query.get(line_item.product_id)
                    if product:
                        product.adjust_stock(int(line_item.quantity), 'purchase_invoice')
        
        db.session.commit()
        
        return jsonify(invoice.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@invoice_bp.route('/invoices/<int:invoice_id>', methods=['PUT'])
def update_invoice(invoice_id):
    """Update an existing invoice"""
    try:
        invoice = Invoice.query.get_or_404(invoice_id)
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Store old line items for stock adjustment reversal
        old_line_items = [(item.product_id, item.quantity) for item in invoice.line_items if item.product_id]
        
        # Update invoice fields
        invoice.update_from_dict(data)
        
        # Update line items if provided
        if 'line_items' in data:
            # Remove existing line items
            for item in invoice.line_items:
                db.session.delete(item)
            
            # Add new line items
            for item_data in data['line_items']:
                line_item = InvoiceLineItem.from_dict(item_data)
                line_item.invoice_id = invoice.id
                
                # If product_id is provided, get product details
                if line_item.product_id:
                    product = Product.query.get(line_item.product_id)
                    if product:
                        line_item.item_name = product.name
                        line_item.item_description = product.description
                        if not item_data.get('unit_price'):
                            line_item.unit_price = product.unit_price
                        if not item_data.get('tax_rate'):
                            line_item.tax_rate = product.tax_rate
                        line_item.calculate_amounts()
                
                db.session.add(line_item)
            
            # Recalculate totals
            db.session.flush()
            invoice.calculate_totals()
            
            # Reverse old stock adjustments
            if invoice.invoice_type == 'sales':
                for product_id, quantity in old_line_items:
                    product = Product.query.get(product_id)
                    if product:
                        product.adjust_stock(int(quantity), 'sales_invoice_reversal')
            elif invoice.invoice_type == 'purchase':
                for product_id, quantity in old_line_items:
                    product = Product.query.get(product_id)
                    if product:
                        product.adjust_stock(-int(quantity), 'purchase_invoice_reversal')
            
            # Apply new stock adjustments
            if invoice.invoice_type == 'sales':
                for line_item in invoice.line_items:
                    if line_item.product_id:
                        product = Product.query.get(line_item.product_id)
                        if product:
                            product.adjust_stock(-int(line_item.quantity), 'sales_invoice')
            elif invoice.invoice_type == 'purchase':
                for line_item in invoice.line_items:
                    if line_item.product_id:
                        product = Product.query.get(line_item.product_id)
                        if product:
                            product.adjust_stock(int(line_item.quantity), 'purchase_invoice')
        
        db.session.commit()
        
        return jsonify(invoice.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@invoice_bp.route('/invoices/<int:invoice_id>', methods=['DELETE'])
def delete_invoice(invoice_id):
    """Delete an invoice (soft delete by setting status to cancelled)"""
    try:
        invoice = Invoice.query.get_or_404(invoice_id)
        
        # Reverse stock adjustments
        if invoice.invoice_type == 'sales':
            for line_item in invoice.line_items:
                if line_item.product_id:
                    product = Product.query.get(line_item.product_id)
                    if product:
                        product.adjust_stock(int(line_item.quantity), 'sales_invoice_cancelled')
        elif invoice.invoice_type == 'purchase':
            for line_item in invoice.line_items:
                if line_item.product_id:
                    product = Product.query.get(line_item.product_id)
                    if product:
                        product.adjust_stock(-int(line_item.quantity), 'purchase_invoice_cancelled')
        
        # Soft delete - mark as cancelled
        invoice.status = 'cancelled'
        invoice.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({'message': 'Invoice cancelled successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@invoice_bp.route('/invoices/<int:invoice_id>/payment', methods=['POST'])
def record_payment(invoice_id):
    """Record a payment against an invoice"""
    try:
        invoice = Invoice.query.get_or_404(invoice_id)
        data = request.get_json()
        
        if not data or 'amount' not in data:
            return jsonify({'error': 'Payment amount is required'}), 400
        
        payment_amount = float(data['amount'])
        
        if payment_amount <= 0:
            return jsonify({'error': 'Payment amount must be positive'}), 400
        
        if invoice.paid_amount + payment_amount > invoice.total_amount:
            return jsonify({'error': 'Payment amount exceeds outstanding balance'}), 400
        
        # Update paid amount
        invoice.paid_amount += payment_amount
        
        # Update status based on payment
        if invoice.is_paid:
            invoice.status = 'paid'
        elif invoice.paid_amount > 0:
            invoice.status = 'partial'
        
        invoice.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Payment recorded successfully',
            'invoice': invoice.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@invoice_bp.route('/invoices/generate-number', methods=['POST'])
def generate_invoice_number():
    """Generate a new invoice number"""
    try:
        data = request.get_json()
        invoice_type = data.get('type', 'sales')
        
        if invoice_type not in ['sales', 'purchase']:
            return jsonify({'error': 'Invalid invoice type'}), 400
        
        prefix = 'INV-S' if invoice_type == 'sales' else 'INV-P'
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        invoice_number = f"{prefix}-{timestamp}"
        
        # Ensure uniqueness
        counter = 1
        original_number = invoice_number
        while Invoice.query.filter_by(invoice_number=invoice_number).first():
            invoice_number = f"{original_number}-{counter}"
            counter += 1
        
        return jsonify({'invoice_number': invoice_number})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@invoice_bp.route('/invoices/dashboard', methods=['GET'])
def get_dashboard_data():
    """Get dashboard data for invoices"""
    try:
        # Get recent invoices
        recent_invoices = Invoice.query.order_by(Invoice.created_at.desc()).limit(10).all()
        
        # Get overdue invoices
        today = datetime.now().date()
        overdue_invoices = Invoice.query.filter(
            and_(
                Invoice.due_date < today,
                Invoice.status.in_(['draft', 'sent', 'partial'])
            )
        ).all()
        
        # Calculate totals
        total_sales = db.session.query(db.func.sum(Invoice.total_amount)).filter(
            Invoice.invoice_type == 'sales',
            Invoice.status != 'cancelled'
        ).scalar() or 0
        
        total_purchases = db.session.query(db.func.sum(Invoice.total_amount)).filter(
            Invoice.invoice_type == 'purchase',
            Invoice.status != 'cancelled'
        ).scalar() or 0
        
        total_outstanding = db.session.query(
            db.func.sum(Invoice.total_amount - Invoice.paid_amount)
        ).filter(
            Invoice.status.in_(['draft', 'sent', 'partial'])
        ).scalar() or 0
        
        return jsonify({
            'recent_invoices': [inv.to_dict() for inv in recent_invoices],
            'overdue_invoices': [inv.to_dict() for inv in overdue_invoices],
            'totals': {
                'total_sales': float(total_sales),
                'total_purchases': float(total_purchases),
                'total_outstanding': float(total_outstanding),
                'overdue_count': len(overdue_invoices)
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

