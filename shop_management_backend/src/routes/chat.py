from flask import Blueprint, request, jsonify
import google.generativeai as genai
import os
import json
import re
from datetime import datetime, timedelta
from src.models.customer import Customer
from src.models.supplier import Supplier
from src.models.product import Product
from src.models.invoice import Invoice
from src.models.payment import Payment
from src.models.user import db

chat_bp = Blueprint('chat', __name__)

# Configure Gemini API
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
model = genai.GenerativeModel('gemini-1.5-flash')

# System prompt for the LLM
SYSTEM_PROMPT = """
You are an AI assistant for a Shop Management System. Your role is to understand user queries and convert them into structured API calls.

Available API endpoints and their parameters:
1. GET /api/customers - Get all customers
   - Parameters: search (string)
2. GET /api/suppliers - Get all suppliers  
   - Parameters: search (string)
3. GET /api/products - Get all products
   - Parameters: search (string), min_price (float), max_price (float), category (string)
4. GET /api/invoices - Get all invoices
   - Parameters: customer_id (int), status (string), search (string), start_date (YYYY-MM-DD), end_date (YYYY-MM-DD), limit (int)
5. GET /api/payments - Get all payments
   - Parameters: customer_id (int), invoice_id (int), start_date (YYYY-MM-DD), end_date (YYYY-MM-DD)

Response format: Always respond with a JSON object containing:
{
  "intent": "query",
  "action": "specific_action_name",
  "entities": {},
  "api_calls": [
    {
      "method": "GET",
      "endpoint": "/api/invoices",
      "params": {"status": "unpaid"}
    }
  ],
  "response_message": "Human-readable response to show user",
  "requires_confirmation": false
}

For queries about balances, stock, or information - set requires_confirmation to false.
For creating, updating, or deleting data - set requires_confirmation to true.

Handle these types of queries:
- "Show me unpaid invoices" -> GET /api/invoices with status="unpaid"
- "Which customer has the most expensive invoice" -> GET /api/invoices (then analyze results)
- "Which customer has the highest unpaid bill" -> GET /api/invoices with status="unpaid" (then analyze results)
- "List all customers" -> GET /api/customers
- "Check stock for Cotton Kurta" -> GET /api/products with search="Cotton Kurta"

Parse dates naturally (e.g., "last week", "yesterday", "October 15th").
Extract entities like customer names, amounts, product names, etc.

IMPORTANT: Always return valid JSON. Do not include any text before or after the JSON object.
"""

def parse_date_expression(date_str):
    """Parse natural language date expressions into actual dates"""
    today = datetime.now().date()
    date_str = date_str.lower().strip()
    
    if date_str in ['today']:
        return today.strftime('%Y-%m-%d')
    elif date_str in ['yesterday']:
        return (today - timedelta(days=1)).strftime('%Y-%m-%d')
    elif date_str in ['last week']:
        start_date = today - timedelta(days=7)
        return start_date.strftime('%Y-%m-%d')
    elif date_str in ['this month']:
        start_date = today.replace(day=1)
        return start_date.strftime('%Y-%m-%d')
    elif date_str in ['last month']:
        if today.month == 1:
            start_date = today.replace(year=today.year-1, month=12, day=1)
        else:
            start_date = today.replace(month=today.month-1, day=1)
        return start_date.strftime('%Y-%m-%d')
    
    # Try to parse specific date formats
    try:
        # Try YYYY-MM-DD format
        parsed_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        return parsed_date.strftime('%Y-%m-%d')
    except ValueError:
        pass
    
    return None

def execute_api_call(api_call):
    """Execute an API call and return the result"""
    method = api_call.get('method', 'GET')
    endpoint = api_call.get('endpoint', '')
    params = api_call.get('params', {})
    
    try:
        if endpoint == '/api/customers':
            query = Customer.query
            if params.get('search'):
                search_term = f"%{params['search']}%"
                query = query.filter(Customer.name.ilike(search_term))
            customers = query.all()
            return {'customers': [customer.to_dict() for customer in customers]}
            
        elif endpoint == '/api/suppliers':
            query = Supplier.query
            if params.get('search'):
                search_term = f"%{params['search']}%"
                query = query.filter(Supplier.name.ilike(search_term))
            suppliers = query.all()
            return {'suppliers': [supplier.to_dict() for supplier in suppliers]}
            
        elif endpoint == '/api/products':
            query = Product.query
            if params.get('search'):
                search_term = f"%{params['search']}%"
                query = query.filter(Product.name.ilike(search_term))
            if params.get('min_price'):
                query = query.filter(Product.retail_price >= float(params['min_price']))
            if params.get('max_price'):
                query = query.filter(Product.retail_price <= float(params['max_price']))
            if params.get('category'):
                query = query.filter(Product.category.ilike(f"%{params['category']}%"))
            products = query.all()
            return {'products': [product.to_dict() for product in products]}
            
        elif endpoint == '/api/invoices':
            query = Invoice.query
            if params.get('customer_id'):
                query = query.filter(Invoice.customer_id == int(params['customer_id']))
            if params.get('status'):
                if params['status'] == 'unpaid':
                    query = query.filter(Invoice.paid_amount == 0)
                elif params['status'] == 'paid':
                    query = query.filter(Invoice.paid_amount >= Invoice.total_amount)
                elif params['status'] == 'partially_paid':
                    query = query.filter(Invoice.paid_amount > 0, Invoice.paid_amount < Invoice.total_amount)
            if params.get('start_date'):
                query = query.filter(Invoice.invoice_date >= params['start_date'])
            if params.get('end_date'):
                query = query.filter(Invoice.invoice_date <= params['end_date'])
            if params.get('search'):
                search_term = f"%{params['search']}%"
                query = query.filter(Invoice.invoice_number.ilike(search_term))
            
            query = query.order_by(Invoice.invoice_date.desc())
            if params.get('limit'):
                query = query.limit(int(params['limit']))
                
            invoices = query.all()
            return {'invoices': [invoice.to_dict() for invoice in invoices]}
            
        elif endpoint == '/api/payments':
            query = Payment.query
            if params.get('customer_id'):
                query = query.filter(Payment.customer_id == int(params['customer_id']))
            if params.get('invoice_id'):
                query = query.filter(Payment.invoice_id == int(params['invoice_id']))
            if params.get('start_date'):
                query = query.filter(Payment.payment_date >= params['start_date'])
            if params.get('end_date'):
                query = query.filter(Payment.payment_date <= params['end_date'])
                
            payments = query.all()
            return {'payments': [payment.to_dict() for payment in payments]}
            
        else:
            return {'error': f'Unknown endpoint: {endpoint}'}
            
    except Exception as e:
        return {'error': str(e)}

def analyze_invoices_for_query(invoices, query_type):
    """Analyze invoices to answer specific queries"""
    if not invoices:
        return "No invoices found."
    
    if query_type == "most_expensive":
        # Find the invoice with the highest total amount
        max_invoice = max(invoices, key=lambda x: x.get('total_amount', 0))
        return f"The customer with the most expensive invoice is {max_invoice.get('customer_name', 'Unknown')} with invoice {max_invoice.get('invoice_number', 'N/A')} for ₹{max_invoice.get('total_amount', 0)}"
    
    elif query_type == "highest_unpaid":
        # Find the unpaid invoice with the highest outstanding amount
        unpaid_invoices = [inv for inv in invoices if inv.get('paid_amount', 0) == 0]
        if not unpaid_invoices:
            return "No unpaid invoices found."
        max_unpaid = max(unpaid_invoices, key=lambda x: x.get('total_amount', 0))
        return f"The customer with the highest unpaid bill is {max_unpaid.get('customer_name', 'Unknown')} with invoice {max_unpaid.get('invoice_number', 'N/A')} for ₹{max_unpaid.get('total_amount', 0)}"
    
    return "Analysis completed."

@chat_bp.route('/chat', methods=['POST'])
def chat():
    """Main chat endpoint for processing user messages"""
    try:
        data = request.get_json()
        if not data or 'message' not in data:
            return jsonify({'error': 'Message is required'}), 400
        
        user_message = data['message']
        
        # Create the full prompt for Gemini
        full_prompt = f"{SYSTEM_PROMPT}\n\nUser message: {user_message}\n\nPlease analyze this message and provide the structured JSON response:"
        
        # Call Gemini API
        response = model.generate_content(full_prompt)
        
        # Parse the response with improved error handling
        try:
            response_text = response.text.strip()
            
            # Try to extract JSON from the response
            json_match = re.search(r'```json\s*(.*?)\s*```', response_text, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
            else:
                # Try to find JSON object in the response
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    json_str = json_match.group(0)
                else:
                    json_str = response_text
            
            llm_response = json.loads(json_str)
            
        except (json.JSONDecodeError, AttributeError) as e:
            # If JSON parsing fails, create a fallback response
            return create_fallback_response(user_message)
        
        # Execute API calls if this is a query
        if llm_response.get('intent') == 'query' and llm_response.get('api_calls'):
            results = []
            for api_call in llm_response['api_calls']:
                result = execute_api_call(api_call)
                results.append(result)
            
            # Check if this is a special analysis query
            user_message_lower = user_message.lower()
            if "most expensive invoice" in user_message_lower and 'invoices' in results[0]:
                formatted_response = analyze_invoices_for_query(results[0]['invoices'], "most_expensive")
            elif "highest unpaid" in user_message_lower and 'invoices' in results[0]:
                formatted_response = analyze_invoices_for_query(results[0]['invoices'], "highest_unpaid")
            else:
                # Format the response based on the results
                formatted_response = format_query_response(llm_response, results)
            
            return jsonify({
                'intent': llm_response.get('intent'),
                'action': llm_response.get('action'),
                'response': formatted_response,
                'requires_confirmation': llm_response.get('requires_confirmation', False),
                'data': results
            })
        
        # For write operations, return the structured response for confirmation
        return jsonify({
            'intent': llm_response.get('intent'),
            'action': llm_response.get('action'),
            'response': llm_response.get('response_message'),
            'requires_confirmation': llm_response.get('requires_confirmation', True),
            'entities': llm_response.get('entities', {}),
            'api_calls': llm_response.get('api_calls', [])
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def create_fallback_response(user_message):
    """Create a fallback response when LLM parsing fails"""
    user_message_lower = user_message.lower()
    
    # Handle common queries with fallback logic
    if "unpaid" in user_message_lower and "invoice" in user_message_lower:
        # Query unpaid invoices
        try:
            query = Invoice.query.filter(Invoice.paid_amount == 0).order_by(Invoice.invoice_date.desc())
            invoices = query.all()
            invoice_data = [invoice.to_dict() for invoice in invoices]
            
            if "highest" in user_message_lower or "most" in user_message_lower:
                response_text = analyze_invoices_for_query(invoice_data, "highest_unpaid")
            else:
                response_text = format_query_response({'action': 'list_unpaid_invoices'}, [{'invoices': invoice_data}])
            
            return jsonify({
                'intent': 'query',
                'action': 'list_unpaid_invoices',
                'response': response_text,
                'requires_confirmation': False,
                'data': [{'invoices': invoice_data}]
            })
        except Exception as e:
            return jsonify({'error': f'Database query failed: {str(e)}'}), 500
    
    elif "most expensive" in user_message_lower and "invoice" in user_message_lower:
        # Query all invoices to find most expensive
        try:
            query = Invoice.query.order_by(Invoice.total_amount.desc())
            invoices = query.all()
            invoice_data = [invoice.to_dict() for invoice in invoices]
            
            response_text = analyze_invoices_for_query(invoice_data, "most_expensive")
            
            return jsonify({
                'intent': 'query',
                'action': 'find_most_expensive_invoice',
                'response': response_text,
                'requires_confirmation': False,
                'data': [{'invoices': invoice_data}]
            })
        except Exception as e:
            return jsonify({'error': f'Database query failed: {str(e)}'}), 500
    
    elif "customer" in user_message_lower:
        # Query customers
        try:
            customers = Customer.query.all()
            customer_data = [customer.to_dict() for customer in customers]
            response_text = format_query_response({'action': 'list_customers'}, [{'customers': customer_data}])
            
            return jsonify({
                'intent': 'query',
                'action': 'list_customers',
                'response': response_text,
                'requires_confirmation': False,
                'data': [{'customers': customer_data}]
            })
        except Exception as e:
            return jsonify({'error': f'Database query failed: {str(e)}'}), 500
    
    # Default fallback
    return jsonify({
        'intent': 'unknown',
        'action': 'unknown',
        'response': 'I\'m sorry, I couldn\'t understand your request. Could you please rephrase it? For example, try "Show me unpaid invoices" or "List all customers".',
        'requires_confirmation': False,
        'data': []
    })

def format_query_response(llm_response, results):
    """Format the query results into a human-readable response"""
    action = llm_response.get('action', '')
    
    if not results or not results[0]:
        return "No results found for your query."
    
    result = results[0]
    
    if 'customers' in result:
        customers = result['customers']
        if len(customers) == 0:
            return "No customers found matching your criteria."
        elif len(customers) == 1:
            customer = customers[0]
            return f"Found customer: {customer['name']} (Phone: {customer['phone']}, Address: {customer['address']})"
        else:
            customer_list = "\n".join([f"• {c['name']} (Phone: {c['phone']})" for c in customers[:10]])
            return f"Found {len(customers)} customers:\n{customer_list}"
    
    elif 'suppliers' in result:
        suppliers = result['suppliers']
        if len(suppliers) == 0:
            return "No suppliers found matching your criteria."
        elif len(suppliers) == 1:
            supplier = suppliers[0]
            return f"Found supplier: {supplier['name']} (Contact: {supplier['contact_person']}, Phone: {supplier['phone']})"
        else:
            supplier_list = "\n".join([f"• {s['name']} (Contact: {s['contact_person']})" for s in suppliers[:10]])
            return f"Found {len(suppliers)} suppliers:\n{supplier_list}"
    
    elif 'products' in result:
        products = result['products']
        if len(products) == 0:
            return "No products found matching your criteria."
        elif len(products) == 1:
            product = products[0]
            return f"Product: {product['name']}\nStock: {product['stock_quantity']} {product['unit_of_measurement']}\nRetail Price: ₹{product['retail_price']}\nWholesale Price: ₹{product['wholesale_price']}"
        else:
            product_list = "\n".join([f"• {p['name']} - Stock: {p['stock_quantity']} - Price: ₹{p['retail_price']}" for p in products[:10]])
            return f"Found {len(products)} products:\n{product_list}"
    
    elif 'invoices' in result:
        invoices = result['invoices']
        if len(invoices) == 0:
            return "No invoices found matching your criteria."
        elif len(invoices) == 1:
            invoice = invoices[0]
            status = "Paid" if invoice.get('is_paid') else ("Partially Paid" if invoice.get('paid_amount', 0) > 0 else "Unpaid")
            return f"Invoice: {invoice['invoice_number']}\nCustomer: {invoice.get('customer_name', 'N/A')}\nDate: {invoice['invoice_date']}\nAmount: ₹{invoice['total_amount']}\nStatus: {status}\nOutstanding: ₹{invoice.get('outstanding_amount', invoice['total_amount'] - invoice.get('paid_amount', 0))}"
        else:
            invoice_list = "\n".join([f"• {i['invoice_number']} - {i.get('customer_name', 'N/A')} - ₹{i['total_amount']} ({'Paid' if i.get('is_paid') else 'Unpaid'})" for i in invoices[:10]])
            return f"Found {len(invoices)} invoices:\n{invoice_list}"
    
    elif 'payments' in result:
        payments = result['payments']
        if len(payments) == 0:
            return "No payments found matching your criteria."
        else:
            payment_list = "\n".join([f"• ₹{p['amount']} on {p['payment_date']} via {p['payment_method']}" for p in payments[:10]])
            return f"Found {len(payments)} payments:\n{payment_list}"
    
    return "Query executed successfully."

@chat_bp.route('/chat/confirm', methods=['POST'])
def confirm_action():
    """Confirm and execute a write action"""
    try:
        data = request.get_json()
        if not data or 'api_calls' not in data:
            return jsonify({'error': 'API calls are required for confirmation'}), 400
        
        # Execute the confirmed API calls
        results = []
        for api_call in data['api_calls']:
            # For now, we'll implement basic create operations
            # This would need to be expanded based on the specific endpoints
            result = execute_write_operation(api_call)
            results.append(result)
        
        return jsonify({
            'success': True,
            'message': 'Action completed successfully',
            'results': results
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def execute_write_operation(api_call):
    """Execute write operations (create, update, delete)"""
    method = api_call.get('method')
    endpoint = api_call.get('endpoint')
    body = api_call.get('body', {})
    
    try:
        if method == 'POST' and endpoint == '/api/customers':
            customer = Customer.from_dict(body)
            db.session.add(customer)
            db.session.commit()
            return {'success': True, 'customer': customer.to_dict()}
        
        elif method == 'POST' and endpoint == '/api/suppliers':
            supplier = Supplier.from_dict(body)
            db.session.add(supplier)
            db.session.commit()
            return {'success': True, 'supplier': supplier.to_dict()}
        
        elif method == 'POST' and endpoint == '/api/payments':
            payment = Payment.from_dict(body)
            db.session.add(payment)
            
            # Update invoice paid amount
            if payment.invoice_id:
                invoice = Invoice.query.get(payment.invoice_id)
                if invoice:
                    invoice.paid_amount += payment.amount
                    if invoice.paid_amount >= invoice.total_amount:
                        invoice.status = 'paid'
                    elif invoice.paid_amount > 0:
                        invoice.status = 'partial'
            
            db.session.commit()
            return {'success': True, 'payment': payment.to_dict()}
        
        else:
            return {'error': f'Unsupported operation: {method} {endpoint}'}
            
    except Exception as e:
        db.session.rollback()
        return {'error': str(e)}