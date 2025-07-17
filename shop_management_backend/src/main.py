import os
import sys
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# DON'T CHANGE THIS !!!
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, send_from_directory
from flask_cors import CORS
from src.models.user import db
from src.models.company_profile import CompanyProfile
from src.models.customer import Customer
from src.models.supplier import Supplier
from src.models.product import Product
from src.models.invoice import Invoice, InvoiceLineItem
from src.models.payment import Payment, LedgerEntry
from src.routes.user import user_bp
from src.routes.company_profile import company_profile_bp
from src.routes.customer import customer_bp
from src.routes.supplier import supplier_bp
from src.routes.product import product_bp
from src.routes.invoice import invoice_bp
from src.routes.payment import payment_bp
from src.routes.chat import chat_bp

app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))
app.config['SECRET_KEY'] = 'asdf#FGSgvasgf$5$WGT'
CORS(app)

app.register_blueprint(user_bp, url_prefix='/api')
app.register_blueprint(company_profile_bp, url_prefix='/api')
app.register_blueprint(customer_bp, url_prefix='/api')
app.register_blueprint(supplier_bp, url_prefix='/api')
app.register_blueprint(product_bp, url_prefix='/api')
app.register_blueprint(invoice_bp, url_prefix='/api')
app.register_blueprint(payment_bp, url_prefix='/api')
app.register_blueprint(chat_bp, url_prefix='/api')

# uncomment if you need to use database
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(os.path.dirname(__file__), 'database', 'app.db')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)
with app.app_context():
    db.create_all()

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static_folder_path = app.static_folder
    if static_folder_path is None:
            return "Static folder not configured", 404

    if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
        return send_from_directory(static_folder_path, path)
    else:
        index_path = os.path.join(static_folder_path, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(static_folder_path, 'index.html')
        else:
            return "index.html not found", 404


if __name__ == '__main__':
    # Access the API key to verify it's loaded
    gemini_api_key = os.getenv('GEMINI_API_KEY')
    if gemini_api_key:
        print(f"✓ Gemini API Key loaded successfully")
    else:
        print("✗ Warning: Gemini API Key not found in environment variables")
    
    app.run(host='0.0.0.0', port=5000, debug=True)