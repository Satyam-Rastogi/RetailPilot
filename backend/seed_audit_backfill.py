"""
Backfill stock audit entries to showcase all entry types.
Adds: ~22 Sales, 7 Returns, 10 Edits, 10 Voids
Uses REAL invoice numbers and item IDs from the DB.
Run from backend/: python seed_audit_backfill.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal
from app.models.invoice import InvoiceModel, InvoiceLineItemModel
from app.models.return_receipt import ReturnReceiptModel, ReturnLineItemModel
from app.models.item import ItemModel
from app.models.stock_audit import StockAuditModel
from datetime import datetime, timedelta

db = SessionLocal()

def ago(days, hour=10, minute=0):
    return datetime.utcnow() - timedelta(days=days, hours=-hour, minutes=-minute)

try:
    # Load lookups
    items = {i.id: i for i in db.query(ItemModel).filter(ItemModel.is_active == True).all()}
    invoices = db.query(InvoiceModel).order_by(InvoiceModel.invoice_date.asc()).all()
    inv_map = {inv.id: inv for inv in invoices}

    entries_added = 0

    # ==========================================================================
    # SALES (~22 entries)
    # Pick one line item per invoice from the first 22 invoices that have items
    # ==========================================================================
    print("Adding Sale entries...")
    sale_count = 0
    for inv in invoices:
        if sale_count >= 22:
            break
        lis = db.query(InvoiceLineItemModel).filter(
            InvoiceLineItemModel.invoice_id == inv.id
        ).all()
        if not lis:
            continue
        li = lis[0]
        item = items.get(li.item_id)
        if not item:
            continue
        # delta_after approximates stock at time of sale (current + qty sold as rough proxy)
        delta_after = max(0, item.current_stock_quantity + li.quantity)
        db.add(StockAuditModel(
            item_id=li.item_id,
            delta=-li.quantity,
            delta_after=delta_after,
            reason="Sold -- Invoice #%s" % inv.invoice_number,
            created_at=inv.invoice_date,
        ))
        sale_count += 1
        entries_added += 1
        print("  [SALE] -%d  %s  %s" % (li.quantity, item.item_name[:30], inv.invoice_number))

    # ==========================================================================
    # RETURNS (7 entries from all 8 existing return receipts)
    # ==========================================================================
    print("\nAdding Return entries...")
    returns = db.query(ReturnReceiptModel).all()
    for rr in returns[:7]:
        inv = inv_map.get(rr.invoice_id)
        inv_num = inv.invoice_number if inv else ("Invoice #%d" % rr.invoice_id)
        lis = db.query(ReturnLineItemModel).filter(
            ReturnLineItemModel.return_receipt_id == rr.id
        ).all()
        for li in lis[:1]:  # one line item per return for clarity
            item = items.get(li.item_id)
            if not item:
                continue
            delta_after = item.current_stock_quantity
            db.add(StockAuditModel(
                item_id=li.item_id,
                delta=li.quantity_returned,
                delta_after=delta_after,
                reason="Return -- Invoice #%s | %s" % (inv_num, item.item_name[:25] if item else ""),
                created_at=rr.return_date,
            ))
            entries_added += 1
            print("  [RETURN] +%d  %s  %s" % (
                li.quantity_returned, item.item_name[:30] if item else "?", inv_num))

    # ==========================================================================
    # EDITS (10 entries) -- synthetic, using real invoices + items
    # Four reason variants: qty increased, qty reduced, item removed, item added
    # ==========================================================================
    print("\nAdding Edit entries...")
    # Pick invoices to reference (skip first 22 used for sales)
    edit_invoices = [inv for inv in invoices if inv.id > 22][:20]
    edit_items = [i for i in items.values() if i.current_stock_quantity > 0]

    edit_specs = [
        # (inv_index, item_index, delta, reason_template, days_ago)
        (0,  0,  -3, "Qty increased on Invoice #%s",  60),
        (1,  1,  -5, "Qty increased on Invoice #%s",  55),
        (2,  2,  -2, "Qty increased on Invoice #%s",  50),
        (3,  3,  -4, "Qty increased on Invoice #%s",  45),
        (4,  4,  +2, "Qty reduced on Invoice #%s",    42),
        (5,  5,  +1, "Qty reduced on Invoice #%s",    38),
        (6,  6,  +3, "Qty reduced on Invoice #%s",    35),
        (7,  7,  +6, "Item removed from Invoice #%s", 30),
        (8,  8,  +4, "Item removed from Invoice #%s", 25),
        (9,  9,  -8, "Item added to Invoice #%s",     20),
    ]

    for inv_idx, item_idx, delta, reason_tpl, days in edit_specs:
        if inv_idx >= len(edit_invoices) or item_idx >= len(edit_items):
            continue
        inv = edit_invoices[inv_idx]
        item = edit_items[item_idx]
        delta_after = max(0, item.current_stock_quantity - delta)
        db.add(StockAuditModel(
            item_id=item.id,
            delta=delta,
            delta_after=delta_after,
            reason=reason_tpl % inv.invoice_number,
            created_at=ago(days),
        ))
        entries_added += 1
        print("  [EDIT]  %+d  %s  %s" % (delta, item.item_name[:30], inv.invoice_number))

    # ==========================================================================
    # VOIDS (10 entries) -- synthetic, using real invoices + items
    # ==========================================================================
    print("\nAdding Void entries...")
    # Use invoices that are safely past (different set from edits)
    void_invoices = [inv for inv in invoices if inv.id > 40][:15]

    void_specs = [
        # (inv_index, item_index, qty_restored, days_ago)
        (0,  0,  2,  70),
        (1,  1,  5,  68),
        (2,  2,  1,  65),
        (3,  3,  3,  62),
        (4,  4,  10, 58),
        (5,  5,  4,  55),
        (6,  6,  2,  52),
        (7,  7,  6,  49),
        (8,  8,  3,  46),
        (9,  9,  8,  43),
    ]

    void_items = [i for i in items.values() if i.current_stock_quantity > 5]

    for inv_idx, item_idx, qty, days in void_specs:
        if inv_idx >= len(void_invoices) or item_idx >= len(void_items):
            continue
        inv = void_invoices[inv_idx]
        item = void_items[item_idx]
        delta_after = item.current_stock_quantity + qty
        db.add(StockAuditModel(
            item_id=item.id,
            delta=qty,
            delta_after=delta_after,
            reason="Invoice voided -- #%s" % inv.invoice_number,
            created_at=ago(days),
        ))
        entries_added += 1
        print("  [VOID]  +%d  %s  %s" % (qty, item.item_name[:30], inv.invoice_number))

    db.commit()

    total = db.query(StockAuditModel).count()
    print("\nDone. %d new entries added. Total audit entries: %d" % (entries_added, total))
    print("  Sales:   %d" % sale_count)
    print("  Returns: %d" % min(7, len(returns)))
    print("  Edits:   10")
    print("  Voids:   10")

except Exception as e:
    db.rollback()
    print("ERROR: %s" % e)
    import traceback; traceback.print_exc()
finally:
    db.close()
