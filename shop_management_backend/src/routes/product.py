from flask import Blueprint, request, jsonify
from src.models.product import Product, db
from sqlalchemy import or_

product_bp = Blueprint("product", __name__)

@product_bp.route("/products", methods=["GET"])
def get_products():
    """Get all products with optional search and filtering"""
    try:
        # Get query parameters
        search = request.args.get("search", "").strip()
        category = request.args.get("category", "").strip()
        low_stock = request.args.get("low_stock", "").lower() == "true"
        active_only = request.args.get("active_only", "true").lower() == "true"
        
        # Build query
        query = Product.query
        
        # Filter by active status
        if active_only:
            query = query.filter(Product.is_active == True)
        
        # Search filter
        if search:
            query = query.filter(
                or_(
                    Product.name.ilike(f"%{search}%"),
                    Product.description.ilike(f"%{search}%"),
                    Product.sku.ilike(f"%{search}%"),
                    Product.barcode.ilike(f"%{search}%")
                )
            )
        
        # Category filter
        if category:
            query = query.filter(Product.category.ilike(f"%{category}%"))
        
        # Get all products first
        products = query.order_by(Product.name).all()
        
        # Filter for low stock if requested
        if low_stock:
            products = [p for p in products if p.stock_quantity <= (p.min_stock_level or 0)]
        
        products_data = [product.to_dict() for product in products]
        
        # Calculate summary statistics
        total_products = len(products_data)
        total_stock_value = sum(p["retail_stock_value"] for p in products_data) # Changed to retail_stock_value
        low_stock_count = sum(1 for p in products_data if p["is_low_stock"])
        
        return jsonify({
            "products": products_data,
            "summary": {
                "total_products": total_products,
                "total_stock_value": total_stock_value,
                "low_stock_count": low_stock_count
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@product_bp.route("/products/<int:product_id>", methods=["GET"])
def get_product(product_id):
    """Get a specific product by ID"""
    try:
        product = Product.query.get_or_404(product_id)
        return jsonify(product.to_dict())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@product_bp.route("/products", methods=["POST"])
def create_product():
    """Create a new product"""
    try:
        data = request.get_json()
        
        if not data or not data.get("name"):
            return jsonify({"error": "Product name is required"}), 400
        
        # Check if SKU already exists (if provided)
        if data.get("sku"):
            existing_product = Product.query.filter_by(sku=data["sku"]).first()
            if existing_product:
                return jsonify({"error": "SKU already exists"}), 400
        
        product = Product.from_dict(data)
        db.session.add(product)
        db.session.commit()
        
        return jsonify(product.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@product_bp.route("/products/<int:product_id>", methods=["PUT"])
def update_product(product_id):
    """Update an existing product"""
    try:
        product = Product.query.get_or_404(product_id)
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Check if SKU already exists (if being updated and different)
        if data.get("sku") and data["sku"] != product.sku:
            existing_product = Product.query.filter_by(sku=data["sku"]).first()
            if existing_product:
                return jsonify({"error": "SKU already exists"}), 400
        
        product.update_from_dict(data)
        db.session.commit()
        
        return jsonify(product.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@product_bp.route("/products/<int:product_id>", methods=["DELETE"])
def delete_product(product_id):
    """Delete a product (hard delete)"""
    try:
        product = Product.query.get_or_404(product_id)
        
        # Hard delete - remove from database
        db.session.delete(product)
        db.session.commit()
        
        return jsonify({"message": "Product deleted successfully"}), 204
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@product_bp.route("/products/<int:product_id>/stock", methods=["POST"])
def adjust_stock(product_id):
    """Adjust product stock quantity"""
    try:
        product = Product.query.get_or_404(product_id)
        data = request.get_json()
        
        if not data or "quantity_change" not in data:
            return jsonify({"error": "quantity_change is required"}), 400
        
        quantity_change = data["quantity_change"]
        reason = data.get("reason", "manual_adjustment")
        
        if not isinstance(quantity_change, (int, float)):
            return jsonify({"error": "quantity_change must be a number"}), 400
        
        adjustment_result = product.adjust_stock(int(quantity_change), reason)
        db.session.commit()
        
        return jsonify({
            "message": "Stock adjusted successfully",
            "adjustment": adjustment_result,
            "product": product.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@product_bp.route("/products/categories", methods=["GET"])
def get_categories():
    """Get all unique product categories"""
    try:
        categories = db.session.query(Product.category).filter(
            Product.category.isnot(None),
            Product.category != "",
            Product.is_active == True
        ).distinct().all()
        
        category_list = [cat[0] for cat in categories if cat[0]]
        category_list.sort()
        
        return jsonify({"categories": category_list})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@product_bp.route("/products/low-stock", methods=["GET"])
def get_low_stock_products():
    """Get products with low stock levels"""
    try:
        products = Product.query.filter(Product.is_active == True).all()
        low_stock_products = [
            product.to_dict() for product in products 
            if product.stock_quantity <= (product.min_stock_level or 0)
        ]
        
        return jsonify({
            "products": low_stock_products,
            "count": len(low_stock_products)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500





