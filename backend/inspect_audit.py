import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.db.session import SessionLocal
from app.models.invoice import InvoiceModel, InvoiceLineItemModel
from app.models.return_receipt import ReturnReceiptModel, ReturnLineItemModel
from app.models.stock_audit import StockAuditModel
from app.models.item import ItemModel

db = SessionLocal()

# How many audit entries exist and what types
audits = db.query(StockAuditModel).all()
print("EXISTING AUDIT ENTRIES: %d" % len(audits))
for a in audits[:5]:
    print("  id=%d item_id=%d delta=%d reason=%s" % (a.id, a.item_id, a.delta, a.reason[:60] if a.reason else ""))

# Sample of invoices with line items
print("\nSAMPLE INVOICES WITH LINE ITEMS (first 10):")
invoices = db.query(InvoiceModel).limit(30).all()
for inv in invoices[:10]:
    lis = db.query(InvoiceLineItemModel).filter(InvoiceLineItemModel.invoice_id == inv.id).all()
    if lis:
        li = lis[0]
        item = db.query(ItemModel).filter(ItemModel.id == li.item_id).first()
        print("  %s  item_id=%d (%s) qty=%d  stock_now=%d" % (
            inv.invoice_number, li.item_id,
            item.item_name[:25] if item else "?",
            li.quantity,
            item.current_stock_quantity if item else 0))

# Returns
returns = db.query(ReturnReceiptModel).all()
print("\nRETURN RECEIPTS: %d" % len(returns))
for r in returns[:8]:
    inv = db.query(InvoiceModel).filter(InvoiceModel.id == r.invoice_id).first()
    lis = db.query(ReturnLineItemModel).filter(ReturnLineItemModel.return_receipt_id == r.id).all()
    print("  return_id=%d  invoice=%s  credit=%.0f  line_items=%d" % (
        r.id, inv.invoice_number if inv else "?", r.total_credit, len(lis)))
    for li in lis[:2]:
        item = db.query(ItemModel).filter(ItemModel.id == li.item_id).first()
        print("    item_id=%d (%s) qty=%d" % (
            li.item_id, item.item_name[:25] if item else "?", li.quantity_returned))

# Items with enough stock
print("\nITEMS (id, name, stock):")
for i in db.query(ItemModel).filter(ItemModel.is_active==True).order_by(ItemModel.id).all():
    print("  id=%-3d stock=%-5d %s" % (i.id, i.current_stock_quantity, i.item_name[:35]))

db.close()
