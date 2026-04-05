"""
Fix wrong delta_after values in the backfill audit entries.
The edit entries used (current_stock - delta) but should use (current_stock + delta).
Run from backend/: python fix_audit_delta.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.db.session import SessionLocal
from app.models.stock_audit import StockAuditModel
from app.models.item import ItemModel

db = SessionLocal()
try:
    items = {i.id: i for i in db.query(ItemModel).all()}

    # Find all backfill entries: sold--, return--, qty*, item added*, item removed*, invoice voided--
    backfill = db.query(StockAuditModel).filter(
        StockAuditModel.reason.ilike('sold --%')
        | StockAuditModel.reason.ilike('return --%')
        | StockAuditModel.reason.ilike('qty%')
        | StockAuditModel.reason.ilike('item added%')
        | StockAuditModel.reason.ilike('item removed%')
        | StockAuditModel.reason.ilike('invoice voided --%')
    ).all()

    print("Found %d backfill entries to fix." % len(backfill))
    fixed = 0
    for entry in backfill:
        item = items.get(entry.item_id)
        if not item:
            continue
        # Correct formula: delta_after approximates stock level after this historical event
        # current_stock is the final state; delta_after = current_stock + delta
        # (stock went up by delta at this point in history, then subsequent events brought it to current)
        correct = max(0, item.current_stock_quantity + entry.delta)
        if entry.delta_after != correct:
            print("  id=%-4d  delta=%+d  delta_after: %d -> %d  (%s)" % (
                entry.id, entry.delta, entry.delta_after, correct,
                (entry.reason or '')[:50]))
            entry.delta_after = correct
            fixed += 1

    db.commit()
    print("Fixed %d entries." % fixed)
except Exception as e:
    db.rollback()
    print("ERROR: %s" % e)
    import traceback; traceback.print_exc()
finally:
    db.close()
