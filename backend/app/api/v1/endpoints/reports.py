from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, date as date_type, timedelta
from pydantic import BaseModel
from app.db.session import get_db
from app.models.customer import CustomerModel
from app.models.invoice import InvoiceModel, PaymentStatus
from app.models.payment import PaymentModel

router = APIRouter()


class AgingBucket(BaseModel):
  customer_id: int
  customer_name: str
  customer_type: str
  current: float        # not yet due (no due_date, or due_date >= today)
  days_1_30: float
  days_31_60: float
  days_61_90: float
  days_over_90: float
  total_outstanding: float


class AgingReportResponse(BaseModel):
  rows: List[AgingBucket]
  totals: AgingBucket


@router.get("/aging/", response_model=AgingReportResponse)
def get_aging_report(
  customer_type: Optional[str] = None,
  db: Session = Depends(get_db)
):
  today = datetime.utcnow().date()

  invoices = (
    db.query(InvoiceModel)
    .join(CustomerModel, InvoiceModel.customer_id == CustomerModel.id)
    .filter(
      InvoiceModel.payment_status != PaymentStatus.PAID,
      CustomerModel.name != 'Walk-in Customer',
    )
  )

  if customer_type:
    invoices = invoices.filter(CustomerModel.customer_type == customer_type)

  invoices = invoices.all()

  # Aggregate per customer
  buckets: dict[int, AgingBucket] = {}

  for inv in invoices:
    cid = inv.customer_id
    if cid not in buckets:
      buckets[cid] = AgingBucket(
        customer_id=cid,
        customer_name=inv.customer.name,
        customer_type=inv.customer.customer_type,
        current=0.0,
        days_1_30=0.0,
        days_31_60=0.0,
        days_61_90=0.0,
        days_over_90=0.0,
        total_outstanding=0.0,
      )

    unpaid = float(inv.grand_total - inv.amount_paid)
    bucket = buckets[cid]

    if inv.due_date is None:
      bucket.current += unpaid
    else:
      due = inv.due_date.date() if hasattr(inv.due_date, 'date') else inv.due_date
      days_past = (today - due).days
      if days_past <= 0:
        bucket.current += unpaid
      elif days_past <= 30:
        bucket.days_1_30 += unpaid
      elif days_past <= 60:
        bucket.days_31_60 += unpaid
      elif days_past <= 90:
        bucket.days_61_90 += unpaid
      else:
        bucket.days_over_90 += unpaid

    bucket.total_outstanding += unpaid

  rows = sorted(buckets.values(), key=lambda r: r.total_outstanding, reverse=True)

  totals = AgingBucket(
    customer_id=0,
    customer_name="TOTAL",
    customer_type="",
    current=sum(r.current for r in rows),
    days_1_30=sum(r.days_1_30 for r in rows),
    days_31_60=sum(r.days_31_60 for r in rows),
    days_61_90=sum(r.days_61_90 for r in rows),
    days_over_90=sum(r.days_over_90 for r in rows),
    total_outstanding=sum(r.total_outstanding for r in rows),
  )

  return AgingReportResponse(rows=rows, totals=totals)


# ── Daily Sales Summary ───────────────────────────────────────────────────────

class SalesByMethod(BaseModel):
  method: str
  count: int
  total: float

class SalesByType(BaseModel):
  customer_type: str
  count: int
  total: float

class DailySummaryResponse(BaseModel):
  date: str
  invoice_count: int
  total_sales: float
  by_customer_type: List[SalesByType]
  payment_count: int
  total_collected: float
  by_payment_method: List[SalesByMethod]


@router.get("/daily-summary/", response_model=DailySummaryResponse)
def get_daily_summary(
  date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format (default: today)"),
  db: Session = Depends(get_db)
):
  if date:
    try:
      target = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
      raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
  else:
    target = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

  day_start = target.replace(hour=0, minute=0, second=0, microsecond=0)
  day_end = target.replace(hour=23, minute=59, second=59, microsecond=999999)

  # ── Invoices created on this day ───────────────────────────────────────────
  invoice_rows = (
    db.query(
      CustomerModel.customer_type,
      func.count(InvoiceModel.id).label('count'),
      func.coalesce(func.sum(InvoiceModel.grand_total), 0).label('total'),
    )
    .join(CustomerModel, InvoiceModel.customer_id == CustomerModel.id)
    .filter(InvoiceModel.invoice_date >= day_start, InvoiceModel.invoice_date <= day_end)
    .group_by(CustomerModel.customer_type)
    .all()
  )

  total_sales = sum(float(r.total) for r in invoice_rows)
  invoice_count = sum(r.count for r in invoice_rows)
  by_customer_type = [
    SalesByType(customer_type=r.customer_type or 'Unknown', count=r.count, total=float(r.total))
    for r in invoice_rows
  ]

  # ── Payments received on this day (exclude credit_note) ───────────────────
  payment_rows = (
    db.query(
      PaymentModel.payment_method,
      func.count(PaymentModel.id).label('count'),
      func.coalesce(func.sum(PaymentModel.amount), 0).label('total'),
    )
    .filter(
      PaymentModel.date >= day_start,
      PaymentModel.date <= day_end,
      PaymentModel.payment_method != 'credit_note',
    )
    .group_by(PaymentModel.payment_method)
    .all()
  )

  total_collected = sum(float(r.total) for r in payment_rows)
  payment_count = sum(r.count for r in payment_rows)
  by_payment_method = [
    SalesByMethod(method=r.payment_method or 'unspecified', count=r.count, total=float(r.total))
    for r in payment_rows
  ]

  return DailySummaryResponse(
    date=target.strftime("%Y-%m-%d"),
    invoice_count=invoice_count,
    total_sales=total_sales,
    by_customer_type=by_customer_type,
    payment_count=payment_count,
    total_collected=total_collected,
    by_payment_method=by_payment_method,
  )


# ── Revenue Analytics ─────────────────────────────────────────────────────────

class MonthlyRevenue(BaseModel):
  month: str          # "2026-01"
  month_label: str    # "Jan 2026"
  retail: float
  wholesale: float
  total: float
  invoice_count: int

class TopCustomer(BaseModel):
  customer_id: int
  customer_name: str
  customer_type: str
  total: float
  invoice_count: int

class RevenueSummary(BaseModel):
  retail_total: float
  wholesale_total: float
  grand_total: float
  retail_pct: float
  wholesale_pct: float
  invoice_count: int

class RevenueReportResponse(BaseModel):
  months: List[MonthlyRevenue]
  top_customers: List[TopCustomer]
  summary: RevenueSummary
  period_months: int


_MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']


@router.get("/revenue/", response_model=RevenueReportResponse)
def get_revenue_report(
  months: int = Query(12, ge=1, le=36, description="Number of months to include (max 36)"),
  db: Session = Depends(get_db),
):
  today = datetime.utcnow().date()

  # Compute the first day of the window (start of month, N months ago)
  first_day = today.replace(day=1)
  for _ in range(months - 1):
    first_day = (first_day - timedelta(days=1)).replace(day=1)

  cutoff = datetime(first_day.year, first_day.month, 1)

  # ── Monthly revenue by customer type ────────────────────────────────────────
  rows = (
    db.query(
      func.strftime('%Y-%m', InvoiceModel.invoice_date).label('month'),
      CustomerModel.customer_type,
      func.coalesce(func.sum(InvoiceModel.grand_total), 0).label('total'),
      func.count(InvoiceModel.id).label('count'),
    )
    .join(CustomerModel, InvoiceModel.customer_id == CustomerModel.id)
    .filter(InvoiceModel.invoice_date >= cutoff)
    .group_by('month', CustomerModel.customer_type)
    .order_by('month')
    .all()
  )

  # Aggregate into {month_key: {retail, wholesale, count}} map
  monthly_map: dict = {}
  for row in rows:
    m = row.month
    if m not in monthly_map:
      monthly_map[m] = {'retail': 0.0, 'wholesale': 0.0, 'count': 0}
    ct = (row.customer_type or '').lower()
    if 'retail' in ct:
      monthly_map[m]['retail'] += float(row.total)
    else:
      monthly_map[m]['wholesale'] += float(row.total)
    monthly_map[m]['count'] += row.count

  # Build complete month list (fill in zeros for months with no invoices)
  month_list: List[MonthlyRevenue] = []
  cur = first_day
  for _ in range(months):
    key = cur.strftime('%Y-%m')
    data = monthly_map.get(key, {'retail': 0.0, 'wholesale': 0.0, 'count': 0})
    label = f"{_MONTH_NAMES[cur.month - 1]} {cur.year}"
    month_list.append(MonthlyRevenue(
      month=key,
      month_label=label,
      retail=data['retail'],
      wholesale=data['wholesale'],
      total=data['retail'] + data['wholesale'],
      invoice_count=data['count'],
    ))
    # Advance to next month
    if cur.month == 12:
      cur = cur.replace(year=cur.year + 1, month=1)
    else:
      cur = cur.replace(month=cur.month + 1)

  # ── Top customers by revenue in the period ──────────────────────────────────
  top_rows = (
    db.query(
      CustomerModel.id,
      CustomerModel.name,
      CustomerModel.customer_type,
      func.coalesce(func.sum(InvoiceModel.grand_total), 0).label('total'),
      func.count(InvoiceModel.id).label('count'),
    )
    .join(InvoiceModel, InvoiceModel.customer_id == CustomerModel.id)
    .filter(InvoiceModel.invoice_date >= cutoff)
    .group_by(CustomerModel.id, CustomerModel.name, CustomerModel.customer_type)
    .order_by(func.sum(InvoiceModel.grand_total).desc())
    .limit(10)
    .all()
  )

  top_customers = [
    TopCustomer(
      customer_id=r.id,
      customer_name=r.name,
      customer_type=r.customer_type or 'Unknown',
      total=float(r.total),
      invoice_count=r.count,
    )
    for r in top_rows
  ]

  # ── Summary totals ───────────────────────────────────────────────────────────
  retail_total = sum(m.retail for m in month_list)
  wholesale_total = sum(m.wholesale for m in month_list)
  grand_total = retail_total + wholesale_total

  summary = RevenueSummary(
    retail_total=retail_total,
    wholesale_total=wholesale_total,
    grand_total=grand_total,
    retail_pct=round(retail_total / grand_total * 100, 1) if grand_total > 0 else 0.0,
    wholesale_pct=round(wholesale_total / grand_total * 100, 1) if grand_total > 0 else 0.0,
    invoice_count=sum(m.invoice_count for m in month_list),
  )

  return RevenueReportResponse(
    months=month_list,
    top_customers=top_customers,
    summary=summary,
    period_months=months,
  )
