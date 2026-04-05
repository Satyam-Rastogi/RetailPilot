"""
Additive seed -- April 1, 2, 3 invoices.
Does NOT wipe existing data. Safe to run on top of current DB.
Run from backend/ directory:  python seed_april.py

Day breakdown (variable counts, not fixed):
  Apr 1: 4 wholesale  + 5 retail  =  9 invoices
  Apr 2: 3 wholesale  + 6 retail  =  9 invoices
  Apr 3: 5 wholesale  + 4 retail  + 1 walk-in = 10 invoices
  Total: 28 invoices

Wholesale target: avg >= 80K per invoice (realistic range 70K-95K+)
Retail target:    6K - 40K per invoice

Edge cases:
  GST 5% / 12% / 18%
  Amount discount vs percent discount vs zero discount
  Paid / partial / unpaid
  Retail partial payment  (unusual -- flagged in notes)
  Retail unpaid           (flagged for follow-up)
  Walk-in cash counter sale
  High-value retail  (~Rs.39.9K)
  Near-floor retail  (~Rs.7.2K)
  Single-item invoice
  5-item line invoice
  NET-30 / NET-45 / NET-60 credit windows
  Wholesale advance paid same day
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal
from app.models.customer import CustomerModel
from app.models.item import ItemModel
from app.models.invoice import InvoiceModel, InvoiceLineItemModel, PaymentStatus
from app.models.invoice_sequence import InvoiceSequenceModel
from datetime import datetime, timedelta

db = SessionLocal()


def ts(year, month, day, hour=10, minute=0):
    return datetime(year, month, day, hour, minute, 0)


APR1 = ts(2026, 4, 1)
APR2 = ts(2026, 4, 2)
APR3 = ts(2026, 4, 3)


def make_invoice(db, num, customer, invoice_date, due_days,
                 line_specs, discount_type, discount_val, tax_rate, status,
                 amount_paid=0, notes=None, po_number=None, shipping_address=None):
    """
    line_specs  -- list of (ItemModel, qty, unit_price)
    discount_type -- 'amount' | 'percent'
    discount_val  -- rupees when 'amount', percentage (e.g. 5) when 'percent'
    status        -- 'paid' | 'partial' | 'unpaid'
    Returns the created InvoiceModel.
    """
    inv_num = "INV-2026-%04d" % num
    sub = sum(float(qty) * float(price) for (_, qty, price) in line_specs)
    if discount_type == "percent":
        disc = round(sub * float(discount_val) / 100.0, 2)
    else:
        disc = float(discount_val)
    after = sub - disc
    tax = round(after * float(tax_rate) / 100.0, 2)
    grand = round(after + tax, 2)

    due_date = invoice_date + timedelta(days=int(due_days)) if due_days else None
    ps = (PaymentStatus.PAID if status == "paid"
          else PaymentStatus.PARTIALLY_PAID if status == "partial"
          else PaymentStatus.UNPAID)

    inv = InvoiceModel(
        invoice_number=inv_num,
        invoice_date=invoice_date,
        due_date=due_date,
        customer_id=customer.id,
        discount_type=discount_type,
        discount_amount=disc,
        tax_rate=float(tax_rate),
        sub_total=round(sub, 2),
        total_tax_amount=tax,
        grand_total=grand,
        amount_paid=round(float(amount_paid), 2),
        payment_status=ps,
        notes=notes,
        po_number=po_number,
        shipping_address=shipping_address,
    )
    db.add(inv)
    db.flush()

    for (item, qty, price) in line_specs:
        db.add(InvoiceLineItemModel(
            invoice_id=inv.id,
            item_id=item.id,
            quantity=int(qty),
            price=float(price),
            discount_amount=0.0,
            discount_type="amount",
        ))

    tag = customer.customer_type[:2].upper()
    print("  [%s] %s  %-32s  total=%9.2f  paid=%9.2f  %-8s  GST=%s%%  due=%sd" % (
        tag, inv_num, customer.name[:32], grand, float(amount_paid),
        status.upper(), tax_rate, due_days))
    return inv


try:
    c = {cu.name: cu for cu in db.query(CustomerModel).all()}
    it = {i.item_name: i for i in db.query(ItemModel).filter(ItemModel.is_active == True).all()}

    walkin = c.get("Walk-in Customer") or c.get("Walk-In Customer")
    if not walkin:
        walkin = CustomerModel(name="Walk-in Customer", customer_type="Retail",
                               credit_days=0, notes="Default walk-in / counter-sale customer")
        db.add(walkin)
        db.flush()
        c["Walk-in Customer"] = walkin
        print("INFO: Created Walk-in Customer row.")

    seq = db.query(InvoiceSequenceModel).filter_by(year=2026).first()
    start = seq.next_number if seq else 143
    num = [start]   # mutable counter -- num[0] is always the next invoice number

    def I():
        """Consume and return next invoice number as int."""
        v = num[0]
        num[0] += 1
        return v

    print("Starting at INV-2026-%04d\n" % start)

    # ===========================================================
    # APRIL 1   --   4 Wholesale  +  5 Retail
    # ===========================================================
    print("=== April 1, 2026  (4 WS + 5 RT) ===")

    # W1: Mehta Boutique (NET-30) -- fabric + dupatta mix, 5% disc, PARTIAL
    # sub 75,000 | disc5% 3750 | after 71250 | tax18% 12825 | total 84,075
    make_invoice(db, I(), c["Mehta Boutique"], APR1, 30,
        [(it["Chanderi Silk Fabric"],          60, 640),
         (it["Silk Blouse Fabric"],             40, 590),
         (it["Georgette Dupatta"],              25, 520)],
        "percent", 5, 18, "partial", amount_paid=40000,
        notes="Advance Rs.40,000 received cash. Balance due May 1.",
        po_number="PO-MB-APR01-01",
        shipping_address="Shop 4, Nehru Bazar, Jaipur, RJ")

    # W2: Delhi Wholesale Hub (NET-60) -- fabric bulk, zero discount, UNPAID
    # sub 78,500 | tax18% 14130 | total 92,630
    make_invoice(db, I(), c["Delhi Wholesale Hub"], APR1, 60,
        [(it["Polyester Crepe Fabric"],        150, 145),
         (it["Net Shimmer Fabric"],            100, 165),
         (it["Cotton Block Print Fabric"],      50, 265),
         (it["Kalamkari Print Fabric"],         60, 250),
         (it["Satin Fabric"],                   60, 200)],
        "amount", 0, 18, "unpaid",
        notes="NET-60 fabric bulk. Due June 1.",
        po_number="PO-DWH-APR01-01",
        shipping_address="Nehru Place Warehouse, New Delhi")

    # W3: Shekhawati Saree House (NET-45) -- sarees only, Rs.2000 disc, UNPAID
    # sub 73,500 | disc 2000 | after 71500 | tax18% 12870 | total 84,370
    make_invoice(db, I(), c["Shekhawati Saree House"], APR1, 45,
        [(it["Maheshwari Cotton-Silk Saree"],  15, 1800),
         (it["Tie-Dye Saree"],                 15, 1550),
         (it["Pure Linen Saree"],              15, 1550)],
        "amount", 2000, 18, "unpaid",
        notes="Saree season restocking. NET-45.",
        po_number="PO-SSH-APR01-01",
        shipping_address="Main Market, Sikar, Rajasthan")

    # W4: Rajasthan Traders (NET-30) -- dupatta + silk, 8% disc, PARTIAL
    # sub 77,250 | disc8% 6180 | after 71070 | tax18% 12792.6 | total 83,862.6
    make_invoice(db, I(), c["Rajasthan Traders"], APR1, 30,
        [(it["Bandhani Dupatta"],              30, 440),
         (it["Phulkari Embroidered Dupatta"],  25, 1050),
         (it["Organza Dupatta"],               30, 460),
         (it["Silk Kurta Fabric"],             30, 800)],
        "percent", 8, 18, "partial", amount_paid=40000,
        notes="8% trade discount. Advance Rs.40,000 paid.",
        po_number="PO-RT-APR01-01")

    # R1: Sunita Sharma -- small, 5% disc, PAID
    # sub 12,500 | disc5% 625 | after 11875 | tax18% 2137.5 | total 14,012.5
    make_invoice(db, I(), c["Sunita Sharma"], ts(2026,4,1,11,15), 0,
        [(it["Banarasi Silk Saree"],    2, 5500),
         (it["Georgette Dupatta"],      2, 750)],
        "percent", 5, 18, "paid",
        amount_paid=round(12500 * 0.95 * 1.18, 2))

    # R2: Kavya Patel -- near-floor retail (~Rs.7.2K), no disc, PAID
    # sub 6,140 | tax18% 1105.2 | total 7,245.2
    make_invoice(db, I(), c["Kavya Patel"], ts(2026,4,1,11,50), 0,
        [(it["Maheshwari Cotton-Silk Saree"],  1, 2400),
         (it["Embroidered Blouse Piece"],       2, 550),
         (it["Chanderi Silk Fabric"],           3, 880)],
        "amount", 0, 18, "paid",
        amount_paid=round(6140 * 1.18, 2))

    # R3: Arjun Singh -- medium, Rs.500 fixed disc, PAID
    # sub 11,140 | disc 500 | after 10640 | tax18% 1915.2 | total 12,555.2
    make_invoice(db, I(), c["Arjun Singh"], ts(2026,4,1,13,30), 0,
        [(it["Kanchipuram Silk Saree"],  1, 9500),
         (it["Silk Blouse Fabric"],       2, 820)],
        "amount", 500, 18, "paid",
        amount_paid=round((11140 - 500) * 1.18, 2),
        notes="Rs.500 loyalty discount applied.")

    # R4: Neha Gupta -- medium, no disc, PAID
    # sub 8,250 | tax18% 1485 | total 9,735
    make_invoice(db, I(), c["Neha Gupta"], ts(2026,4,1,14,45), 0,
        [(it["Phulkari Embroidered Dupatta"],  3, 1450),
         (it["Pure Wool Shawl"],               2, 1950)],
        "amount", 0, 18, "paid",
        amount_paid=round(8250 * 1.18, 2))

    # R5: Priyanka Joshi -- medium, 10% disc, PAID
    # sub 10,910 | disc10% 1091 | after 9819 | tax18% 1767.42 | total 11,586.42
    make_invoice(db, I(), c["Priyanka Joshi"], ts(2026,4,1,16,20), 0,
        [(it["Tie-Dye Saree"],          3, 2100),
         (it["Embroidered Blouse Piece"],5, 550),
         (it["Bandhani Dupatta"],        3, 620)],
        "percent", 10, 18, "paid",
        amount_paid=round(10910 * 0.90 * 1.18, 2),
        notes="Festival 10% discount.")

    # ===========================================================
    # APRIL 2   --   3 Wholesale  +  6 Retail
    # ===========================================================
    print("\n=== April 2, 2026  (3 WS + 6 RT) ===")

    # W5: Mumbai Fashion Co. (NET-60) -- blouse + organza, 5% disc, UNPAID
    # sub 74,750 | disc5% 3737.5 | after 71012.5 | tax18% 12782.25 | total 83,794.75
    make_invoice(db, I(), c["Mumbai Fashion Co."], APR2, 60,
        [(it["Silk Blouse Fabric"],    45, 590),
         (it["Velvet Blouse Fabric"],  30, 540),
         (it["Organza Dupatta"],       40, 460),
         (it["Linen Shirt Fabric"],    40, 340)],
        "percent", 5, 18, "unpaid",
        notes="NET-60. Blouse fabric restocking. Due June 2.",
        po_number="PO-MFC-APR02-01",
        shipping_address="Lower Parel Godown, Mumbai, MH")

    # W6: South Silk Traders (NET-45) -- premium silks only, 5% disc, PARTIAL
    # sub 78,600 | disc5% 3930 | after 74670 | tax18% 13440.6 | total 88,110.6
    make_invoice(db, I(), c["South Silk Traders"], APR2, 45,
        [(it["Kanchipuram Silk Saree"],  8, 7200),
         (it["Banarasi Silk Saree"],      5, 4200)],
        "percent", 5, 18, "partial", amount_paid=50000,
        notes="Premium silk restock. Advance Rs.50,000 received. Balance May 17.",
        po_number="PO-SST-APR02-01",
        shipping_address="Silk Market, Kanchipuram, TN")

    # W7: Priya Fashion House (NET-45) -- fabric mix, 8% disc, UNPAID
    # sub 78,150 | disc8% 6252 | after 71898 | tax18% 12941.64 | total 84,839.64
    make_invoice(db, I(), c["Priya Fashion House"], APR2, 45,
        [(it["Chanderi Silk Fabric"],   50, 640),
         (it["Net Shimmer Fabric"],     80, 165),
         (it["Men's Kurta Fabric"],     80, 215),
         (it["Ikat Cotton Fabric"],     50, 315)],
        "percent", 8, 18, "unpaid",
        notes="Fabric mix order. 8% trade discount. NET-45.",
        po_number="PO-PFH-APR02-01",
        shipping_address="Bandra Warehouse, Mumbai, MH")

    # R6: Ravi Kumar -- small 3-item, no disc, PAID
    # sub 9,700 | tax18% 1746 | total 11,446
    make_invoice(db, I(), c["Ravi Kumar"], ts(2026,4,2,10,30), 0,
        [(it["Georgette Dupatta"],         2, 750),
         (it["Chanderi Silk Fabric"],       5, 880),
         (it["Cotton Block Print Fabric"], 10, 380)],
        "amount", 0, 18, "paid",
        amount_paid=round(9700 * 1.18, 2))

    # R7: Meera Agarwal -- small, 5% disc, PAID
    # sub 7,940 | disc5% 397 | after 7543 | tax18% 1357.74 | total 8,900.74
    make_invoice(db, I(), c["Meera Agarwal"], ts(2026,4,2,11,45), 0,
        [(it["Pure Linen Saree"],    3, 2100),
         (it["Silk Blouse Fabric"],  2, 820)],
        "percent", 5, 18, "paid",
        amount_paid=round(7940 * 0.95 * 1.18, 2))

    # R8: Pooja Singh -- HIGH VALUE retail (~Rs.27K), Rs.1500 disc, PAID
    # sub 24,400 | disc 1500 | after 22900 | tax18% 4122 | total 27,022
    make_invoice(db, I(), c["Pooja Singh"], ts(2026,4,2,12,0), 0,
        [(it["Kanchipuram Silk Saree"],  2, 9500),
         (it["Pure Wool Shawl"],          2, 1950),
         (it["Georgette Dupatta"],        2, 750)],
        "amount", 1500, 18, "paid",
        amount_paid=round((24400 - 1500) * 1.18, 2),
        notes="Bridal trousseau. Loyalty discount Rs.1,500.")

    # R9: Rekha Sharma -- small, 5% disc, PAID
    # sub 7,150 | disc5% 357.5 | after 6792.5 | tax18% 1222.65 | total 8,015.15
    make_invoice(db, I(), c["Rekha Sharma"], ts(2026,4,2,14,10), 0,
        [(it["Tie-Dye Saree"],          2, 2100),
         (it["Embroidered Blouse Piece"],3, 550),
         (it["Organza Dupatta"],         2, 650)],
        "percent", 5, 18, "paid",
        amount_paid=round(7150 * 0.95 * 1.18, 2))

    # R10: Deepa Nair -- EDGE: retail PARTIAL payment
    # sub 19,400 | no disc | tax18% 3492 | total 22,892  |  paid 12,000
    make_invoice(db, I(), c["Deepa Nair"], ts(2026,4,2,15,30), 0,
        [(it["Banarasi Silk Saree"],           3, 5500),
         (it["Phulkari Embroidered Dupatta"],  2, 1450)],
        "amount", 0, 18, "partial", amount_paid=12000,
        notes="Paid Rs.12,000 cash. Balance Rs.10,892 to be collected.")

    # R11: Sundar Kumar -- medium, 12% GST edge case, no disc, PAID
    # sub 17,800 | tax12% 2136 | total 19,936
    make_invoice(db, I(), c["Sundar Kumar"], ts(2026,4,2,17,0), 0,
        [(it["Cotton Block Print Fabric"], 20, 380),
         (it["Plain Lawn Fabric"],          30, 185),
         (it["Men's Kurta Fabric"],         15, 310)],
        "amount", 0, 12, "paid",
        amount_paid=round(17800 * 1.12, 2),
        notes="12% GST -- unstitched fabric category.")

    # ===========================================================
    # APRIL 3   --   5 Wholesale  +  4 Retail  +  1 Walk-in
    # ===========================================================
    print("\n=== April 3, 2026  (5 WS + 4 RT + 1 WI) ===")

    # W8: Hyderabad Silks Ltd. (NET-30) -- premium silk + dupatta, 5% disc, UNPAID
    # sub 77,400 | disc5% 3870 | after 73530 | tax18% 13235.4 | total 86,765.4
    make_invoice(db, I(), c["Hyderabad Silks Ltd."], APR3, 30,
        [(it["Kanchipuram Silk Saree"],        6, 7200),
         (it["Maheshwari Cotton-Silk Saree"], 12, 1800),
         (it["Phulkari Embroidered Dupatta"], 12, 1050)],
        "percent", 5, 18, "unpaid",
        notes="Premium silk restocking. NET-30. Due May 3.",
        po_number="PO-HSL-APR03-01",
        shipping_address="Abids Showroom, Hyderabad, TS")

    # W9: Lucknow Chikankari House (NET-45) -- fabric only, no disc, UNPAID
    # sub 79,800 | tax18% 14364 | total 94,164
    make_invoice(db, I(), c["Lucknow Chikankari House"], APR3, 45,
        [(it["Ikat Cotton Fabric"],     40, 315),
         (it["Silk Kurta Fabric"],      50, 800),
         (it["Chanderi Silk Fabric"],   30, 640),
         (it["Satin Fabric"],           40, 200)],
        "amount", 0, 18, "unpaid",
        notes="Fabric for chikankari work. NET-45. Due May 18.",
        po_number="PO-LCH-APR03-01",
        shipping_address="Aminabad, Lucknow, UP")

    # W10: Varanasi Silk Emporium (NET-45) -- blouse + dupatta, 8% disc, PARTIAL
    # sub 69,450 | disc8% 5556 | after 63894 | tax12% 7667.28 | total 71,561.28
    # EDGE: 12% GST on this wholesale invoice
    make_invoice(db, I(), c["Varanasi Silk Emporium"], APR3, 45,
        [(it["Silk Blouse Fabric"],     35, 590),
         (it["Velvet Blouse Fabric"],   30, 540),
         (it["Bandhani Dupatta"],       40, 440),
         (it["Kalamkari Print Fabric"], 60, 250)],
        "percent", 8, 12, "partial", amount_paid=35000,
        notes="12% GST blended rate on fabric. Advance Rs.35,000. Balance May 18.",
        po_number="PO-VSE-APR03-01")

    # W11: Kolkata Textile Hub (NET-30) -- fabric assortment, 10% disc, UNPAID
    # sub 69,900 | disc10% 6990 | after 62910 | tax18% 11323.8 | total 74,233.8
    make_invoice(db, I(), c["Kolkata Textile Hub"], APR3, 30,
        [(it["Linen Shirt Fabric"],      50, 340),
         (it["Polyester Crepe Fabric"], 100, 145),
         (it["Net Shimmer Fabric"],      60, 165),
         (it["Kalamkari Print Fabric"],  50, 250),
         (it["Satin Fabric"],            80, 200)],
        "percent", 10, 18, "unpaid",
        notes="Fabric assortment. NET-30. Due May 3.",
        po_number="PO-KTH-APR03-01",
        shipping_address="Park Street Godown, Kolkata, WB")

    # W12: Punjab Dress Centre (NET-30) -- dupatta bulk, 10% disc, PARTIAL
    # sub 87,150 | disc10% 8715 | after 78435 | tax18% 14118.3 | total 92,553.3
    make_invoice(db, I(), c["Punjab Dress Centre"], APR3, 30,
        [(it["Phulkari Embroidered Dupatta"], 25, 1050),
         (it["Bandhani Dupatta"],             30, 440),
         (it["Organza Dupatta"],              35, 460),
         (it["Georgette Dupatta"],            30, 520),
         (it["Silk Kurta Fabric"],            20, 800)],
        "percent", 10, 18, "partial", amount_paid=50000,
        notes="Dupatta bulk order. Advance Rs.50,000. Balance due May 3.",
        po_number="PO-PDC-APR03-01",
        shipping_address="Hall Bazar, Amritsar, Punjab")

    # R12: Geeta Yadav -- small, 5% GST edge case, PAID
    # sub 8,210 | no disc | tax5% 410.5 | total 8,620.5
    make_invoice(db, I(), c["Geeta Yadav"], ts(2026,4,3,10,15), 0,
        [(it["Maheshwari Cotton-Silk Saree"],  2, 2400),
         (it["Embroidered Blouse Piece"],       3, 550),
         (it["Chanderi Silk Fabric"],           2, 880)],
        "amount", 0, 5, "paid",
        amount_paid=round(8210 * 1.05, 2),
        notes="5% GST -- natural cotton-silk fabric category.")

    # R13: Anjali Verma -- HIGH VALUE retail (~Rs.39.9K), Rs.2000 disc, PAID
    # sub 35,850 | disc 2000 | after 33850 | tax18% 6093 | total 39,943
    make_invoice(db, I(), c["Anjali Verma"], ts(2026,4,3,11,30), 0,
        [(it["Kanchipuram Silk Saree"],  2, 9500),
         (it["Banarasi Silk Saree"],     2, 5500),
         (it["Pure Wool Shawl"],         3, 1950)],
        "amount", 2000, 18, "paid",
        amount_paid=round((35850 - 2000) * 1.18, 2),
        notes="Wedding season purchase. Highest retail ticket of April.")

    # R14: Ramesh Patel -- medium, 10% disc, PAID
    # sub 8,940 | disc10% 894 | after 8046 | tax18% 1448.28 | total 9,494.28
    make_invoice(db, I(), c["Ramesh Patel"], ts(2026,4,3,14,0), 0,
        [(it["Tie-Dye Saree"],    2, 2100),
         (it["Pure Linen Saree"], 1, 2100),
         (it["Chanderi Silk Fabric"], 3, 880)],
        "percent", 10, 18, "paid",
        amount_paid=round(8940 * 0.90 * 1.18, 2))

    # R15: Seema Bansal -- EDGE: retail UNPAID (UPI promised, not received)
    # sub 7,460 | no disc | tax18% 1342.8 | total 8,802.8
    make_invoice(db, I(), c["Seema Bansal"], ts(2026,4,3,16,45), 0,
        [(it["Phulkari Embroidered Dupatta"],  2, 1450),
         (it["Silk Blouse Fabric"],             3, 820),
         (it["Pure Linen Saree"],               1, 2100)],
        "amount", 0, 18, "unpaid", amount_paid=0,
        notes="Customer promised UPI transfer by evening. Payment not received. Follow up.")

    # Walk-in: cash counter sale, single visit, no disc, PAID
    # sub 7,350 | tax18% 1323 | total 8,673
    make_invoice(db, I(), walkin, ts(2026,4,3,15,20), 0,
        [(it["Banarasi Silk Saree"],      1, 5500),
         (it["Embroidered Blouse Piece"], 2, 550),
         (it["Georgette Dupatta"],        1, 750)],
        "amount", 0, 18, "paid",
        amount_paid=round(7350 * 1.18, 2),
        notes="Counter sale. Cash received.")

    # ── Update sequence ────────────────────────────────────────────────────────
    if seq:
        seq.next_number = num[0]
    else:
        db.add(InvoiceSequenceModel(year=2026, next_number=num[0]))

    db.commit()
    added = num[0] - start
    print("\nOK -- %d invoices added (INV-2026-%04d to INV-2026-%04d)." % (
        added, start, num[0] - 1))
    print("Sequence next: INV-2026-%04d" % num[0])
    print("\nBreakdown:")
    print("  Apr 1: 4 wholesale + 5 retail = 9")
    print("  Apr 2: 3 wholesale + 6 retail = 9")
    print("  Apr 3: 5 wholesale + 4 retail + 1 walk-in = 10")

except Exception as e:
    db.rollback()
    print("ERROR: %s" % e)
    import traceback; traceback.print_exc()
finally:
    db.close()
