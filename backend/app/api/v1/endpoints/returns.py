from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
from app.db.session import get_db
from app.models.return_receipt import ReturnReceiptModel, ReturnLineItemModel
from app.models.invoice import InvoiceModel, InvoiceLineItemModel, PaymentStatus
from app.models.customer import CustomerModel
from app.models.payment import PaymentModel, PaymentAllocationModel
from app.models.item import ItemModel
from app.models.stock_audit import StockAuditModel
from app.schemas.return_receipt import (
    ReturnReceipt, ReturnReceiptCreate, ReturnLineItem
)

router = APIRouter()


@router.get(
    "/",
    response_model=List[dict],
    summary="List returns",
    description="Returns list of goods returns. Filterable by `reason_category`, `is_partial`, `date_from`, and `date_to`. Ordered by return date descending.",
)
def get_returns(
    skip: int = 0,
    limit: int = 100,
    reason_category: Optional[str] = Query(None, description="Filter by reason category"),
    is_partial: Optional[bool] = Query(None, description="Filter by return type (true=partial, false=full)"),
    date_from: Optional[str] = Query(None, description="Filter from date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Filter to date (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    query = db.query(ReturnReceiptModel)

    if is_partial is not None:
        query = query.filter(ReturnReceiptModel.is_partial == is_partial)

    if date_from:
        try:
            from_date = datetime.strptime(date_from, "%Y-%m-%d")
            query = query.filter(ReturnReceiptModel.return_date >= from_date)
        except ValueError:
            pass

    if date_to:
        try:
            to_date = datetime.strptime(date_to, "%Y-%m-%d")
            query = query.filter(ReturnReceiptModel.return_date <= to_date)
        except ValueError:
            pass

    returns = query.order_by(ReturnReceiptModel.return_date.desc()).offset(skip).limit(limit).all()

    result = []
    for ret in returns:
        line_items = db.query(ReturnLineItemModel).filter(ReturnLineItemModel.return_receipt_id == ret.id).all()
        primary_category = None
        for li in line_items:
            if li.reason_category:
                primary_category = li.reason_category.value
                break

        # Resolve customer name — either via invoice or direct customer FK
        customer_name = None
        if ret.invoice and ret.invoice.customer:
            customer_name = ret.invoice.customer.name
        elif ret.customer:
            customer_name = ret.customer.name

        result.append({
            'id': ret.id,
            'invoice_id': ret.invoice_id,
            'customer_id': ret.customer_id,
            'invoice_number': ret.invoice.invoice_number if ret.invoice else None,
            'customer_name': customer_name,
            'invoice_date': ret.invoice.invoice_date.isoformat() if ret.invoice else None,
            'return_date': ret.return_date.isoformat(),
            'total_credit': ret.total_credit,
            'is_partial': ret.is_partial,
            'is_gr': ret.invoice_id is None,
            'total_items_in_invoice': ret.total_items_in_invoice,
            'items_returned_count': ret.items_returned_count,
            'reason_category': primary_category,
            'notes': ret.notes,
            'created_at': ret.created_at.isoformat(),
        })

    return result


@router.get(
    "/{return_id}",
    response_model=dict,
    summary="Get return detail",
    description="Returns full detail for a single goods return: line items, credit amounts, reason categories, and related stock audit records.",
    responses={404: {"description": "Return not found"}},
)
def get_return(return_id: int, db: Session = Depends(get_db)):
    return_receipt = db.query(ReturnReceiptModel).filter(ReturnReceiptModel.id == return_id).first()

    if not return_receipt:
        raise HTTPException(status_code=404, detail="Return not found")

    line_items = db.query(ReturnLineItemModel).filter(ReturnLineItemModel.return_receipt_id == return_id).all()

    item_details = {}
    for item in line_items:
        db_item = db.query(ItemModel).filter(ItemModel.id == item.item_id).first()
        if db_item:
            item_details[item.item_id] = {
                'item_name': db_item.item_name,
                'returnable_quantity': db_item.current_stock_quantity + item.quantity_returned
            }

    stock_audit = db.query(StockAuditModel).filter(
        StockAuditModel.reason.like(f"%Return - Invoice #{return_receipt.id}%")
    ).all()

    return {
        'id': return_receipt.id,
        'invoice_id': return_receipt.invoice_id,
        'invoice_number': return_receipt.invoice.invoice_number if return_receipt.invoice else None,
        'invoice_date': return_receipt.invoice.invoice_date.isoformat() if return_receipt.invoice else None,
        'is_partial': return_receipt.is_partial,
        'total_items_in_invoice': return_receipt.total_items_in_invoice,
        'items_returned_count': return_receipt.items_returned_count,
        'total_credit': return_receipt.total_credit,
        'return_date': return_receipt.return_date.isoformat(),
        'notes': return_receipt.notes,
        'created_at': return_receipt.created_at.isoformat(),
        'line_items': [
            {
                'id': item.id,
                'return_receipt_id': item.return_receipt_id,
                'item_id': item.item_id,
                'item_name': item_details.get(item.item_id, {}).get('item_name'),
                'quantity_returned': item.quantity_returned,
                'amount': item.amount,
                'reason': item.reason,
                'reason_category': item.reason_category.value if item.reason_category else None,
            }
            for item in line_items
        ],
        'stock_audit': [
            {
                'id': audit.id,
                'item_id': audit.item_id,
                'item_name': audit.item.item_name if audit.item else None,
                'quantity_change': audit.delta,
                'reason': audit.reason,
                'created_at': audit.created_at.isoformat() if audit.created_at else None,
            }
            for audit in stock_audit
        ],
    }


@router.post(
    "/",
    response_model=dict,
    status_code=201,
    summary="Create goods return",
    description=(
        "Records a goods return against an existing invoice.\n\n"
        "**Side effects (in order):**\n"
        "1. Validates return quantities against original invoice line items.\n"
        "2. Restores stock for each returned item (writes `StockAudit`).\n"
        "3. Creates a `credit_note` payment for `total_credit`.\n"
        "4. FIFO-allocates the credit note against the customer's outstanding invoices.\n\n"
        "A partial return (`is_partial=true`) is recorded when not all items from the invoice are returned."
    ),
    responses={
        400: {"description": "Invalid return quantities, or no invoice/customer data"},
        404: {"description": "Invoice or item not found"},
    },
)
def create_return(return_data: ReturnReceiptCreate, db: Session = Depends(get_db)):
    # ── Validate and resolve customer/invoice ─────────────────────────────────
    invoice = None
    customer_id = None

    if return_data.invoice_id:
        invoice = db.query(InvoiceModel).filter(InvoiceModel.id == return_data.invoice_id).first()
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        customer_id = invoice.customer_id
    elif return_data.customer_id:
        customer = db.query(CustomerModel).filter(CustomerModel.id == return_data.customer_id).first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        customer_id = return_data.customer_id
    else:
        raise HTTPException(status_code=400, detail="Either invoice_id or customer_id is required")

    total_credit = sum(item.amount for item in return_data.line_items)

    # ── P1-1: Validate return quantities against original invoice ─────────────
    if invoice:
        for item_data in return_data.line_items:
            orig = db.query(InvoiceLineItemModel).filter(
                InvoiceLineItemModel.invoice_id == invoice.id,
                InvoiceLineItemModel.item_id == item_data.item_id,
            ).first()
            if not orig:
                db_item_name = db.query(ItemModel.item_name).filter(ItemModel.id == item_data.item_id).scalar() or str(item_data.item_id)
                raise HTTPException(
                    status_code=422,
                    detail=f"Item '{db_item_name}' was not on invoice {invoice.invoice_number}"
                )
            already_returned = db.query(func.sum(ReturnLineItemModel.quantity_returned)).filter(
                ReturnLineItemModel.item_id == item_data.item_id,
                ReturnLineItemModel.return_receipt_id.in_(
                    db.query(ReturnReceiptModel.id).filter(ReturnReceiptModel.invoice_id == invoice.id)
                )
            ).scalar() or 0
            available = orig.quantity - already_returned
            if item_data.quantity_returned > available:
                db_item_name = db.query(ItemModel.item_name).filter(ItemModel.id == item_data.item_id).scalar() or str(item_data.item_id)
                raise HTTPException(
                    status_code=422,
                    detail=f"Cannot return {item_data.quantity_returned} of '{db_item_name}': "
                           f"only {available} returnable (sold {orig.quantity}, already returned {already_returned})"
                )

    db_return = ReturnReceiptModel(
        invoice_id=return_data.invoice_id,
        customer_id=customer_id,
        return_date=return_data.return_date,
        total_credit=total_credit,
        notes=return_data.notes,
        is_partial=return_data.is_partial,
        total_items_in_invoice=return_data.total_items_in_invoice,
        items_returned_count=return_data.items_returned_count,
    )
    db.add(db_return)
    db.flush()

    audit_ref = f"Invoice #{invoice.invoice_number}" if invoice else f"GR #{db_return.id}"

    for item_data in return_data.line_items:
        db_item = db.query(ItemModel).filter(ItemModel.id == item_data.item_id).first()

        if not db_item:
            raise HTTPException(status_code=404, detail=f"Item with id {item_data.item_id} not found")

        db_item.current_stock_quantity += item_data.quantity_returned

        return_line = ReturnLineItemModel(
            return_receipt_id=db_return.id,
            item_id=item_data.item_id,
            quantity_returned=item_data.quantity_returned,
            amount=item_data.amount,
            reason=item_data.reason,
            reason_category=item_data.reason_category
        )
        db.add(return_line)
        db.flush()

        db.add(StockAuditModel(
            item_id=item_data.item_id,
            delta=item_data.quantity_returned,
            delta_after=db_item.current_stock_quantity,
            reason=f"Return - {audit_ref}",
        ))

    # ── For standalone GRs: create a credit_note payment entry ───────────────
    if not return_data.invoice_id:
        db.add(PaymentModel(
            customer_id=customer_id,
            date=return_data.return_date,
            amount=total_credit,
            payment_method="credit_note",
            credit_balance=total_credit,
            notes=f"GR Credit Note — Return #{db_return.id}",
        ))

    # ── P1-4: For invoice-linked returns: credit note + FIFO allocation ───────
    if return_data.invoice_id and total_credit > 0:
        credit_payment = PaymentModel(
            customer_id=customer_id,
            date=return_data.return_date,
            amount=total_credit,
            payment_method="credit_note",
            notes=f"Credit Note — {invoice.invoice_number}",
        )
        db.add(credit_payment)
        db.flush()

        unpaid_invoices = db.query(InvoiceModel).filter(
            InvoiceModel.customer_id == customer_id,
            InvoiceModel.grand_total > InvoiceModel.amount_paid,
        ).order_by(InvoiceModel.invoice_date.asc()).all()

        remaining = total_credit
        for inv in unpaid_invoices:
            if remaining <= 0:
                break
            due = inv.grand_total - inv.amount_paid
            alloc = min(due, remaining)
            db.add(PaymentAllocationModel(
                payment_id=credit_payment.id,
                invoice_id=inv.id,
                allocated_amount=alloc,
            ))
            inv.amount_paid += alloc
            remaining -= alloc
            if inv.amount_paid >= inv.grand_total:
                inv.payment_status = PaymentStatus.PAID
            else:
                inv.payment_status = PaymentStatus.PARTIALLY_PAID

        if remaining > 0:
            credit_payment.credit_balance = remaining

    db.commit()
    db.refresh(db_return)

    customer_name = None
    if db_return.invoice and db_return.invoice.customer:
        customer_name = db_return.invoice.customer.name
    elif db_return.customer:
        customer_name = db_return.customer.name

    return {
        'id': db_return.id,
        'invoice_id': db_return.invoice_id,
        'customer_id': db_return.customer_id,
        'invoice_number': db_return.invoice.invoice_number if db_return.invoice else None,
        'customer_name': customer_name,
        'invoice_date': db_return.invoice.invoice_date.isoformat() if db_return.invoice else None,
        'total_credit': db_return.total_credit,
        'is_partial': db_return.is_partial,
        'is_gr': db_return.invoice_id is None,
        'notes': db_return.notes,
        'created_at': db_return.created_at.isoformat(),
    }


@router.delete(
    "/{return_id}",
    response_model=dict,
    summary="Delete return (full reversal)",
    description=(
        "Fully reverses a goods return:\n\n"
        "1. Removes the FIFO allocation for the `credit_note` payment.\n"
        "2. Deletes the `credit_note` payment.\n"
        "3. Restores invoice `amount_paid` and `payment_status`.\n"
        "4. Deducts stock for each returned item (undoes the stock restore).\n"
        "5. Deletes all `ReturnLineItem` records and the `ReturnReceipt`."
    ),
    responses={404: {"description": "Return not found"}},
)
def delete_return(return_id: int, db: Session = Depends(get_db)):
    """
    Delete a return receipt and fully reverse its effects:
    1. Reverse stock additions for every returned line item
    2. Reverse FIFO allocations from the associated credit note payment
    3. Delete the credit note payment
    4. Delete the return receipt and its line items
    """
    db_return = db.query(ReturnReceiptModel).filter(ReturnReceiptModel.id == return_id).first()
    if not db_return:
        raise HTTPException(status_code=404, detail="Return not found")

    # ── Find the associated credit note payment ───────────────────────────────
    invoice_number = db_return.invoice.invoice_number if db_return.invoice else None
    if invoice_number:
        credit_payment = db.query(PaymentModel).filter(
            PaymentModel.customer_id == db_return.customer_id,
            PaymentModel.payment_method == 'credit_note',
            PaymentModel.amount == db_return.total_credit,
            PaymentModel.notes.contains(invoice_number),
        ).first()
    else:
        credit_payment = db.query(PaymentModel).filter(
            PaymentModel.customer_id == db_return.customer_id,
            PaymentModel.payment_method == 'credit_note',
            PaymentModel.notes.contains(f"Return #{return_id}"),
        ).first()

    if credit_payment:
        # Reverse all FIFO allocations made from this credit note
        allocations = db.query(PaymentAllocationModel).filter(
            PaymentAllocationModel.payment_id == credit_payment.id
        ).all()
        for alloc in allocations:
            inv = db.query(InvoiceModel).filter(InvoiceModel.id == alloc.invoice_id).first()
            if inv:
                inv.amount_paid = max(0.0, float(inv.amount_paid) - float(alloc.allocated_amount))
                if inv.amount_paid <= 0:
                    inv.payment_status = PaymentStatus.UNPAID
                elif inv.amount_paid >= inv.grand_total:
                    inv.payment_status = PaymentStatus.PAID
                else:
                    inv.payment_status = PaymentStatus.PARTIALLY_PAID
            db.delete(alloc)
        db.delete(credit_payment)

    # ── Reverse stock and delete line items ───────────────────────────────────
    line_items = db.query(ReturnLineItemModel).filter(
        ReturnLineItemModel.return_receipt_id == return_id
    ).all()
    for li in line_items:
        item = db.query(ItemModel).filter(ItemModel.id == li.item_id).first()
        if item:
            item.current_stock_quantity = max(0, item.current_stock_quantity - li.quantity_returned)
        # Remove associated stock audit entries
        db.query(StockAuditModel).filter(
            StockAuditModel.item_id == li.item_id,
            StockAuditModel.reason.like(f"%#{db_return.id}%"),
        ).delete(synchronize_session=False)
        db.delete(li)

    db.delete(db_return)
    db.commit()
    return {'detail': f'Return #{return_id} deleted and all effects reversed'}


@router.put(
    "/{return_id}",
    response_model=dict,
    summary="Update return notes",
    description="Updates the `notes` field on a return receipt. Other fields are immutable — delete and recreate the return to correct quantities.",
    responses={404: {"description": "Return not found"}},
)
def update_return(return_id: int, return_data: dict, db: Session = Depends(get_db)):
    """
    Update a return.
    
    Allows editing:
    - Return date
    - Notes
    - Reason category
    - Line items (add/remove/modify quantities)
    - Stock adjustments for quantity changes
    """
    db_return = db.query(ReturnReceiptModel).filter(ReturnReceiptModel.id == return_id).first()
    
    if not db_return:
        raise HTTPException(status_code=404, detail="Return not found")
    
    invoice = db.query(InvoiceModel).filter(InvoiceModel.id == db_return.invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if return_data.get('return_date'):
        try:
            db_return.return_date = datetime.fromisoformat(return_data['return_date'].replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            pass

    if 'notes' in return_data:
        db_return.notes = return_data['notes']

    old_line_items = db.query(ReturnLineItemModel).filter(ReturnLineItemModel.return_receipt_id == return_id).all()
    old_line_item_map = {li.item_id: li for li in old_line_items}

    new_line_items = return_data.get('line_items', [])

    for item_id, old_li in old_line_item_map.items():
        matching_new = next((li for li in new_line_items if li.get('item_id') == item_id), None)
        if matching_new is None:
            item = db.query(ItemModel).filter(ItemModel.id == item_id).first()
            if item:
                item.current_stock_quantity -= old_li.quantity_returned
            db.delete(old_li)
        else:
            new_quantity = matching_new.get('quantity_returned', 0)
            quantity_diff = new_quantity - old_li.quantity_returned

            if quantity_diff != 0:
                item = db.query(ItemModel).filter(ItemModel.id == item_id).first()
                if item:
                    if quantity_diff > 0:
                        if item.current_stock_quantity < quantity_diff:
                            raise HTTPException(status_code=400, detail=f"Insufficient stock for item {item.item_name}")
                        item.current_stock_quantity -= quantity_diff
                    else:
                        item.current_stock_quantity += abs(quantity_diff)

            old_li.quantity_returned = matching_new.get('quantity_returned', 0)
            old_li.amount = matching_new.get('amount', 0)
            old_li.reason = matching_new.get('reason')
            old_li.reason_category = matching_new.get('reason_category')
            db.add(old_li)

    for new_li in new_line_items:
        item_id = new_li.get('item_id')
        if item_id not in old_line_item_map:
            new_quantity = new_li.get('quantity_returned', 0)
            item = db.query(ItemModel).filter(ItemModel.id == item_id).first()
            if not item:
                raise HTTPException(status_code=404, detail=f"Item with id {item_id} not found")

            if item.current_stock_quantity < new_quantity:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for item {item.item_name}")

            item.current_stock_quantity -= new_quantity

            return_line = ReturnLineItemModel(
                return_receipt_id=db_return.id,
                item_id=item_id,
                quantity_returned=new_quantity,
                amount=new_li.get('amount', 0),
                reason=new_li.get('reason'),
                reason_category=new_li.get('reason_category')
            )
            db.add(return_line)

    total_credit = sum(li.amount for li in db.query(ReturnLineItemModel).filter(ReturnLineItemModel.return_receipt_id == return_id).all())
    db_return.total_credit = total_credit

    items_returned_count = sum(li.quantity_returned for li in db.query(ReturnLineItemModel).filter(ReturnLineItemModel.return_receipt_id == return_id).all())
    db_return.items_returned_count = items_returned_count

    db.commit()
    db.refresh(db_return)

    line_items = db.query(ReturnLineItemModel).filter(ReturnLineItemModel.return_receipt_id == return_id).all()

    return {
        'id': db_return.id,
        'invoice_id': db_return.invoice_id,
        'invoice_number': db_return.invoice.invoice_number if db_return.invoice else None,
        'invoice_date': db_return.invoice.invoice_date.isoformat() if db_return.invoice else None,
        'return_date': db_return.return_date.isoformat(),
        'total_credit': db_return.total_credit,
        'is_partial': db_return.is_partial,
        'total_items_in_invoice': db_return.total_items_in_invoice,
        'items_returned_count': db_return.items_returned_count,
        'notes': db_return.notes,
        'created_at': db_return.created_at.isoformat(),
        'line_items': [
            {
                'id': li.id,
                'return_receipt_id': li.return_receipt_id,
                'item_id': li.item_id,
                'item_name': li.item.item_name if li.item else None,
                'quantity_returned': li.quantity_returned,
                'amount': li.amount,
                'reason': li.reason,
                'reason_category': li.reason_category.value if li.reason_category else None,
            }
            for li in line_items
        ],
    }
