#!/usr/bin/env python3
"""
Realistic 8-month seed data for RetailPilot.

Shop: Sharma Textile & Garments — Jaipur, Rajasthan
Period: July 25, 2025 → March 28, 2026

Seasonal patterns (India):
  Jul  — New shop, slow start
  Aug  — Raksha Bandhan (19 Aug), Independence Day (15 Aug)
  Sep  — Navratri prep, Onam (5–15 Sep)
  Oct  — Navratri/Garba (2–12 Oct), Dussehra (12 Oct), Karwa Chauth (20 Oct)
  Nov  — Diwali (1 Nov) — PEAK MONTH
  Dec  — Winter wedding season, Christmas
  Jan  — Wedding season peak (Makar Sankranti 14 Jan)
  Feb  — Valentine's Day (14 Feb), weddings continue
  Mar  — Holi (14 Mar), season tapering
"""
import sys, os, random
from datetime import datetime, timedelta
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal, engine
from app.db.base import Base
from app.models.company_profile import CompanyProfileModel
from app.models.customer import CustomerModel
from app.models.supplier import SupplierModel
from app.models.item import ItemModel
from app.models.item_variant import ItemVariantModel
from app.models.invoice import InvoiceModel, InvoiceLineItemModel, PaymentStatus
from app.models.invoice_sequence import InvoiceSequenceModel
from app.models.payment import PaymentModel, PaymentAllocationModel
from app.models.stock_audit import StockAuditModel
from app.models.return_receipt import ReturnReceiptModel, ReturnLineItemModel, ReturnReasonCategory
import app.models  # ensure all models registered for create_all

random.seed(42)

# ── Helpers ───────────────────────────────────────────────────────────────────

def dt(year, month, day):
    h = random.randint(9, 19)
    m = random.randint(0, 59)
    return datetime(year, month, day, h, m)

inv_seq = {"2025": 0, "2026": 0}

def next_inv_no(date: datetime) -> str:
    year = str(date.year)
    inv_seq[year] += 1
    return f"INV-{year}-{inv_seq[year]:04d}"

# ── Reference data ────────────────────────────────────────────────────────────

RAW_CUSTOMERS = [
    dict(name="Mehta Boutique", phone_number="98765-43210", email="mehta.boutique@gmail.com",
         address="12, MI Road, Jaipur – 302001", gstin="08AABCM1234F1Z5",
         customer_type="Wholesale", credit_days=30,
         notes="Regular wholesale buyer — heavy during Navratri & Diwali"),
    dict(name="Priya Fashion House", phone_number="87654-32109", email="priya@fashionhouse.in",
         address="C-45, Vaishali Nagar, Jaipur – 302021", gstin="08AADCP5678G1Z3",
         customer_type="Wholesale", credit_days=45,
         notes="Wedding season specialist — large lehenga & saree orders"),
    dict(name="Delhi Wholesale Hub", phone_number="99887-76543", email="orders@dwhub.in",
         address="Chandni Chowk, Delhi – 110006", gstin="07AABCD9876H1Z2",
         customer_type="Wholesale", credit_days=60,
         notes="Large orders; slow payer — follow up after 50 days"),
    dict(name="Rajasthan Traders", phone_number="94555-12345", email="rt@rajtraders.in",
         address="Johri Bazaar, Jaipur – 302003", gstin="08AACRT4321J1Z9",
         customer_type="Wholesale", credit_days=30,
         notes="Block-print fabrics & wedding season focus"),
    dict(name="Sunita Sharma", phone_number="96321-11223", email=None,
         address="Sector 7, Malviya Nagar, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Loyal retail customer since day one"),
    dict(name="Kavya Patel", phone_number="91234-56789", email="kavya.patel@gmail.com",
         address="B-12, Shyam Nagar, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Diwali & festival collection buyer"),
    dict(name="Arjun Singh", phone_number="77891-23456", email=None,
         address="Transport Nagar, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0, notes=None),
    dict(name="Neha Gupta", phone_number="82345-67890", email="neha.gupta@outlook.com",
         address="Vaishali Nagar, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Bridal shopping — big orders before wedding dates"),
    dict(name="Walk-in Customer", phone_number=None, email=None,
         address=None, gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Generic walk-in for unregistered cash sales"),
    # ── New wholesale customers ────────────────────────────────────────────────
    dict(name="Shekhawati Saree House", phone_number="94120-33456", email="shekhawati.sarees@gmail.com",
         address="Fatehpur Shekhawati, Sikar – 332301, Rajasthan", gstin="08AABCS7890Q1Z1",
         customer_type="Wholesale", credit_days=45,
         notes="Saree specialist — Kanchipuram, Banarasi focus; reliable payer"),
    dict(name="Mumbai Fashion Co.", phone_number="99200-44567", email="orders@mumbaifashion.in",
         address="Fashion Street, Churchgate, Mumbai – 400020, Maharashtra", gstin="27AABCM2345R1Z4",
         customer_type="Wholesale", credit_days=60,
         notes="Fashion-forward — lehenga & anarkali focus; slow payer, follow up after 55 days"),
    dict(name="Punjab Dress Centre", phone_number="98140-55678", email="punjab.dress@yahoo.in",
         address="Chaura Bazaar, Ludhiana – 141008, Punjab", gstin="03AABCP4567S1Z7",
         customer_type="Wholesale", credit_days=30,
         notes="Phulkari dupattas, salwar sets, menswear — reliable, pays on time"),
    dict(name="South Silk Traders", phone_number="91500-66789", email="southsilk@traders.in",
         address="T-Nagar, Chennai – 600017, Tamil Nadu", gstin="33AABCS8901T1Z3",
         customer_type="Wholesale", credit_days=45,
         notes="South Indian silk specialists — Kanchipuram & blouse fabrics; moderate payer"),
    dict(name="Hyderabad Silks Ltd.", phone_number="95000-77890", email="hyd.silks@gmail.com",
         address="Laad Bazaar, Charminar, Hyderabad – 500002, Telangana", gstin="36AABCH3456U1Z6",
         customer_type="Wholesale", credit_days=30,
         notes="Bridal silk & anarkali focus; irregular payment pattern"),
    dict(name="Kolkata Textile Hub", phone_number="90330-88901", email="ktextiles@hotmail.com",
         address="Burrabazar, Kolkata – 700007, West Bengal", gstin="19AABCK5678V1Z2",
         customer_type="Wholesale", credit_days=30,
         notes="Bandhani, tie-dye & value fabrics; decent payer"),
    # ── New retail customers ───────────────────────────────────────────────────
    dict(name="Priyanka Joshi", phone_number="97654-32101", email="priyanka.joshi91@gmail.com",
         address="Mansarovar, Jaipur – 302020", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Regular buyer — salwar sets, dupattas, festival wear"),
    dict(name="Ravi Kumar", phone_number="88765-43212", email=None,
         address="Tonk Road, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Buys fabric for family tailoring — kurta fabric, lawn cotton"),
    dict(name="Meera Agarwal", phone_number="93456-54323", email="meera.agarwal@gmail.com",
         address="Civil Lines, Jaipur – 302006", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Bridal trousseau shopping — Kanchipuram silk, lehengas, designer blouses"),
    dict(name="Pooja Singh", phone_number="85678-65434", email=None,
         address="Pratap Nagar, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Festival enthusiast — Navratri, Diwali, Holi outfits"),
    # ── Additional wholesale customers ─────────────────────────────────────────
    dict(name="Jodhpur Fabrics Mart", phone_number="94120-11234", email="jodhpur.fabrics@gmail.com",
         address="Sojati Gate, Jodhpur – 342001, Rajasthan", gstin="08AABCJ1234L1Z6",
         customer_type="Wholesale", credit_days=30,
         notes="Leheriya, tie-dye & block-print fabrics; reliable payer",
         created_at=datetime(2025, 8, 5)),
    dict(name="Varanasi Silk Emporium", phone_number="94201-22345", email="vsi@varanasisilk.in",
         address="Vishwanath Gali, Varanasi – 221001, UP", gstin="09AABCV2345M1Z3",
         customer_type="Wholesale", credit_days=45,
         notes="Banarasi silk sarees & zari fabrics, premium buyer",
         created_at=datetime(2025, 8, 18)),
    dict(name="Ahmedabad Cloth Palace", phone_number="79900-33456", email="acp@clothpalace.in",
         address="Kalupur Cloth Market, Ahmedabad – 380002, Gujarat", gstin="24AABCA3456N1Z1",
         customer_type="Wholesale", credit_days=30,
         notes="Wholesale buyer — cotton, synthetic, Gujarat specialties",
         created_at=datetime(2025, 9, 3)),
    dict(name="Surat Textile Market", phone_number="92700-44567", email="stm@suratfabrics.in",
         address="Ring Road Textile Market, Surat – 395002, Gujarat", gstin="24AABCS4567O1Z8",
         customer_type="Wholesale", credit_days=45,
         notes="Synthetic & embellished fabrics; large volumes, occasional delays",
         created_at=datetime(2025, 9, 20)),
    dict(name="Amritsar Phulkari House", phone_number="98150-55678", email="phulkari@amritsar.in",
         address="Hall Bazaar, Amritsar – 143001, Punjab", gstin="03AABCA5678P1Z5",
         customer_type="Wholesale", credit_days=30,
         notes="Phulkari embroidery & Punjab ethnic wear; prompt payer",
         created_at=datetime(2025, 10, 8)),
    dict(name="Bhopal Saree Collections", phone_number="96300-66789", email="bsc@bhopalsarees.com",
         address="New Market, Bhopal – 462001, Madhya Pradesh", gstin="23AABCB6789Q1Z2",
         customer_type="Wholesale", credit_days=30,
         notes="Chanderi, Maheshwari & cotton sarees; moderate volume",
         created_at=datetime(2025, 10, 22)),
    dict(name="Indore Fashion Hub", phone_number="93100-77890", email="ifh@indorefashion.in",
         address="Sarafa Bazaar, Indore – 452001, Madhya Pradesh", gstin="23AABCI7890R1Z9",
         customer_type="Wholesale", credit_days=45,
         notes="Trendy western & fusion wear along with ethnic; fast-growing account",
         created_at=datetime(2025, 11, 5)),
    dict(name="Coimbatore Textile Co.", phone_number="99422-88901", email="ctc@coimbatexile.in",
         address="Textiles Park, Coimbatore – 641001, Tamil Nadu", gstin="33AABCC8901S1Z6",
         customer_type="Wholesale", credit_days=30,
         notes="Cotton, linen & blended fabrics; south India market buyer",
         created_at=datetime(2025, 11, 19)),
    dict(name="Nagpur Garment Traders", phone_number="71200-99012", email="ngt@nagpurgarments.in",
         address="Itwari Market, Nagpur – 440002, Maharashtra", gstin="27AABCN9012T1Z3",
         customer_type="Wholesale", credit_days=30,
         notes="Ready-made garments & fabric wholesale; growing volume",
         created_at=datetime(2025, 12, 4)),
    dict(name="Patna Wholesale Fabrics", phone_number="99310-10123", email="pwf@patnafabrics.in",
         address="Harding Road, Patna – 800001, Bihar", gstin="10AABCP0123U1Z7",
         customer_type="Wholesale", credit_days=45,
         notes="Bihar ethnic wear, Bhagalpuri silk; steady payer",
         created_at=datetime(2025, 12, 17)),
    dict(name="Guwahati Textile Agency", phone_number="94351-21234", email="gta@guwahati.in",
         address="Fancy Bazaar, Guwahati – 781001, Assam", gstin="18AABCG1234V1Z4",
         customer_type="Wholesale", credit_days=30,
         notes="Northeast market — Mekhela chador, silk, handlooms",
         created_at=datetime(2026, 1, 8)),
    dict(name="Bhubaneswar Silk House", phone_number="96780-32345", email="bsh@orissasilk.in",
         address="Janpath, Bhubaneswar – 751001, Odisha", gstin="21AABCB2345W1Z1",
         customer_type="Wholesale", credit_days=30,
         notes="Sambalpuri & Ikat fabrics; niche buyer, consistent orders",
         created_at=datetime(2026, 1, 22)),
    dict(name="Kochi Saree Boutique", phone_number="94470-43456", email="ksb@kochisarees.in",
         address="MG Road, Kochi – 682001, Kerala", gstin="32AABCK3456X1Z8",
         customer_type="Wholesale", credit_days=45,
         notes="Kerala kasavu sarees, silk, cotton; wedding season peak",
         created_at=datetime(2026, 1, 31)),
    dict(name="Vijayawada Fashion House", phone_number="86600-54567", email="vfh@vijayawadafashion.in",
         address="Benz Circle, Vijayawada – 520010, Andhra Pradesh", gstin="37AABCV4567Y1Z5",
         customer_type="Wholesale", credit_days=30,
         notes="Handloom cotton & silk sarees, Andhra market",
         created_at=datetime(2026, 2, 10)),
    dict(name="Srinagar Pashmina House", phone_number="94190-65678", email="sph@pashmina.in",
         address="Residency Road, Srinagar – 190001, J&K", gstin="01AABCS5678Z1Z2",
         customer_type="Wholesale", credit_days=45,
         notes="Pashmina shawls, kashmiri embroidery; premium segment",
         created_at=datetime(2026, 2, 20)),
    dict(name="Chandigarh Dress Centre", phone_number="98151-76789", email="cdc@chandigarhdress.in",
         address="Sector 17, Chandigarh – 160017, Punjab", gstin="04AABCC6789A2Z9",
         customer_type="Wholesale", credit_days=30,
         notes="Punjabi suits, salwar kameez sets; steady account",
         created_at=datetime(2026, 2, 28)),
    dict(name="Raipur Fabric Traders", phone_number="97700-87890", email="rft@raipurfabrics.in",
         address="Sadar Bazaar, Raipur – 492001, Chhattisgarh", gstin="22AABCR7890B2Z6",
         customer_type="Wholesale", credit_days=30,
         notes="Cotton & synthetic fabrics; new account, first order pending",
         created_at=datetime(2026, 3, 5)),
    dict(name="Lucknow Chikankari House", phone_number="99350-98901", email="lch@chikankari.in",
         address="Hazratganj, Lucknow – 226001, UP", gstin="09AABCL8901C2Z3",
         customer_type="Wholesale", credit_days=45,
         notes="Chikankari kurtas, embroidered kurtis & suits; premium buyer",
         created_at=datetime(2026, 3, 14)),
    # ── Additional retail customers ─────────────────────────────────────────────
    dict(name="Rekha Sharma", phone_number="96543-10101", email=None,
         address="Bais Godam, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Regular saree buyer — Navratri & Diwali",
         created_at=datetime(2025, 8, 2)),
    dict(name="Deepa Nair", phone_number="91234-20202", email="deepa.nair@gmail.com",
         address="Vaishali Nagar, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Prefers south Indian silk styles",
         created_at=datetime(2025, 8, 15)),
    dict(name="Sundar Kumar", phone_number="88901-30303", email=None,
         address="Jhotwara, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Menswear — kurta pajama sets & fabric",
         created_at=datetime(2025, 9, 1)),
    dict(name="Geeta Yadav", phone_number="77890-40404", email=None,
         address="Murlipura, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Festival wear — chaniya choli & dupattas",
         created_at=datetime(2025, 9, 12)),
    dict(name="Anjali Verma", phone_number="82345-50505", email="anjali.v@yahoo.in",
         address="Pratap Nagar, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Wedding attendee shopper — regular",
         created_at=datetime(2025, 9, 25)),
    dict(name="Ramesh Patel", phone_number="94001-60606", email=None,
         address="Tonk Road, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Fabric buyer — cotton lawn for home stitching",
         created_at=datetime(2025, 10, 4)),
    dict(name="Seema Bansal", phone_number="93450-70707", email="seema.b@gmail.com",
         address="Civil Lines, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Saree collector — Banarasi & Maheshwari",
         created_at=datetime(2025, 10, 18)),
    dict(name="Vikas Joshi", phone_number="96789-80808", email=None,
         address="Sindhi Camp, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Gift shopper — sarees & stoles for occasions",
         created_at=datetime(2025, 10, 30)),
    dict(name="Radha Devi", phone_number="85670-90909", email=None,
         address="Raja Park, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Daily wear cotton — budget-conscious buyer",
         created_at=datetime(2025, 11, 3)),
    dict(name="Prakash Mehta", phone_number="99001-11000", email=None,
         address="Malviya Nagar, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Buys for family — bulk cotton & sarees",
         created_at=datetime(2025, 11, 10)),
    dict(name="Komal Agarwal", phone_number="91002-22111", email="komal.a@outlook.com",
         address="Shyam Nagar, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Bridal trousseau — lehenga & blouse sets",
         created_at=datetime(2025, 11, 20)),
    dict(name="Suresh Yadav", phone_number="87003-33222", email=None,
         address="Sanganer, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Block-print fabric buyer for home tailoring",
         created_at=datetime(2025, 11, 28)),
    dict(name="Tara Singh", phone_number="76004-44333", email=None,
         address="Mansarovar, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Winter shawl & wool dupatta buyer",
         created_at=datetime(2025, 12, 5)),
    dict(name="Manoj Kumar", phone_number="95005-55444", email="manoj.kumar@gmail.com",
         address="Durgapura, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Men's kurta fabric — seasonal buyer",
         created_at=datetime(2025, 12, 15)),
    dict(name="Asha Pandey", phone_number="94006-66555", email=None,
         address="Vaishali Nagar, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Daily wear cotton sarees, simple dupattas",
         created_at=datetime(2025, 12, 27)),
    dict(name="Vijay Sharma", phone_number="92007-77666", email=None,
         address="Jagatpura, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Men's ceremonial kurta fabric for weddings",
         created_at=datetime(2026, 1, 5)),
    dict(name="Sangeetha Iyer", phone_number="90008-88777", email="sangeetha.iyer@gmail.com",
         address="Gopalpura Bypass, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="South Indian silk sarees — Kanchipuram focus",
         created_at=datetime(2026, 1, 12)),
    dict(name="Rohit Malhotra", phone_number="88009-99888", email=None,
         address="MI Road, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Wedding guest shopping — sarees & stoles",
         created_at=datetime(2026, 1, 19)),
    dict(name="Poonam Gupta", phone_number="78010-10999", email="poonam.g@gmail.com",
         address="Nirman Nagar, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Bridal lehenga & dupatta — big spender",
         created_at=datetime(2026, 1, 27)),
    dict(name="Nirmala Jain", phone_number="99011-21110", email=None,
         address="Sector 5, Malviya Nagar, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Cotton daily wear — loyal repeat buyer",
         created_at=datetime(2026, 2, 4)),
    dict(name="Alka Chauhan", phone_number="97012-32221", email="alka.chauhan@yahoo.in",
         address="Ambabari, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Festival & casual saree buyer",
         created_at=datetime(2026, 2, 12)),
    dict(name="Sunil Tiwari", phone_number="95013-43332", email=None,
         address="Hasanpura, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Kurta fabric for family functions",
         created_at=datetime(2026, 2, 19)),
    dict(name="Deepika Rathod", phone_number="93014-54443", email="deepika.r@gmail.com",
         address="Chitrakoot, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Designer blouse & dupatta buyer",
         created_at=datetime(2026, 2, 26)),
    dict(name="Manish Sharma", phone_number="91015-65554", email=None,
         address="Kalwar Road, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Bulk cotton fabric for school uniform stitching",
         created_at=datetime(2026, 3, 2)),
    dict(name="Priti Saxena", phone_number="89016-76665", email="priti.s@gmail.com",
         address="Bani Park, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Holi & spring collection buyer",
         created_at=datetime(2026, 3, 7)),
    dict(name="Ritu Khandelwal", phone_number="87017-87776", email=None,
         address="Sodala, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Saree & blouse fabric; new customer",
         created_at=datetime(2026, 3, 10)),
    dict(name="Sanjay Dixit", phone_number="85018-98887", email=None,
         address="Jhotwara, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Men's ethnic wear — kurta sets",
         created_at=datetime(2026, 3, 14)),
    dict(name="Lata Mishra", phone_number="83019-09998", email="lata.m@yahoo.in",
         address="Kanota, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Holi celebration outfit buyer",
         created_at=datetime(2026, 3, 17)),
    dict(name="Pradeep Gupta", phone_number="81020-11109", email=None,
         address="Agra Road, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="New customer — walk-in for cotton fabric",
         created_at=datetime(2026, 3, 21)),
    dict(name="Savita Rawat", phone_number="79021-22210", email="savita.r@gmail.com",
         address="Vidhyadhar Nagar, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="Spring collection shopping — sarees & dupattas",
         created_at=datetime(2026, 3, 24)),
    dict(name="Hemant Joshi", phone_number="77022-33321", email=None,
         address="Sitabari, Jaipur", gstin=None,
         customer_type="Retail", credit_days=0,
         notes="New customer — referred by Kavya Patel",
         created_at=datetime(2026, 3, 26)),
]

RAW_SUPPLIERS = [
    dict(name="Bharat Silk Mills", contact_person="Ramesh Bharat", phone_number="98001-23456",
         address="Surat Textile Market, Ring Road, Surat – 395002, Gujarat",
         gstin="24AABCB1234K1ZP",
         supplier_bank_name="HDFC Bank", supplier_bank_account_number="50200012345678",
         supplier_bank_ifsc_code="HDFC0001234",
         notes="Premium silk & georgette — 15-day delivery, MOQ 10 pcs"),
    dict(name="Jaipur Cotton Co.", contact_person="Vikas Sharma", phone_number="94001-56789",
         address="Sanganer Industrial Area, Jaipur – 302029",
         gstin="08AACJC5678L1Z2",
         supplier_bank_name="State Bank of India", supplier_bank_account_number="31204567891234",
         supplier_bank_ifsc_code="SBIN0001234",
         notes="Local block-print & lawn cotton, fast delivery"),
    dict(name="Laxmi Garments Mfg.", contact_person="Pradeep Laxmi", phone_number="99001-11234",
         address="RIICO Industrial Area, Bhiwadi – 301019, Rajasthan",
         gstin="08AABCL9012M1Z8",
         supplier_bank_name="Kotak Mahindra Bank", supplier_bank_account_number="1234567890123",
         supplier_bank_ifsc_code="KKBK0001234",
         notes="Ready-made kurtis, lehengas, anarkalis — 7-day delivery"),
    dict(name="Maheshwari Fabrics", contact_person="Suresh Maheshwari", phone_number="90123-45678",
         address="Cloth Market, MG Road, Indore – 452001, MP",
         gstin="23AABCM3456N1Z3",
         supplier_bank_name="Punjab National Bank", supplier_bank_account_number="0123456789012",
         supplier_bank_ifsc_code="PUNB0001234",
         notes="Maheshwari sarees & Chanderi silk — exclusive partnership"),
    dict(name="Zari Brocade House", contact_person="Anil Zari", phone_number="88912-34567",
         address="Vishwanath Gali, Varanasi – 221001, UP",
         gstin="09AABCZ7890P1Z1",
         supplier_bank_name="Bank of Baroda", supplier_bank_account_number="99876543210123",
         supplier_bank_ifsc_code="BARB0001234",
         notes="Banarasi silk & zari-work sarees — premium supplier, 3-week lead time"),
    dict(name="Rajasthan Craft Exports", contact_person="Devendra Sharma", phone_number="92345-11234",
         address="Khirni Phatak, Jaipur – 302002, Rajasthan",
         gstin="08AABCR2345W1Z4",
         supplier_bank_name="Bank of Rajasthan", supplier_bank_account_number="20123456789012",
         supplier_bank_ifsc_code="BKRJ0001234",
         notes="Bandhani, tie-dye, block-print sarees & dupattas — local supplier, 5-day delivery"),
    dict(name="Punjab Woolen Mills", contact_person="Gurpreet Singh", phone_number="98141-22345",
         address="Focal Point, Ludhiana – 141010, Punjab",
         gstin="03AABCP6789X1Z8",
         supplier_bank_name="Punjab National Bank", supplier_bank_account_number="1234512345123",
         supplier_bank_ifsc_code="PUNB0002345",
         notes="Pure wool shawls, Phulkari embroidered dupattas — seasonal, winter stock in Sep"),
    dict(name="Gujarat Synthetic Fabrics", contact_person="Nilesh Patel", phone_number="98254-33456",
         address="GIDC Estate, Surat – 395010, Gujarat",
         gstin="24AABCG3456Y1Z5",
         supplier_bank_name="Axis Bank", supplier_bank_account_number="91234567890123",
         supplier_bank_ifsc_code="UTIB0001234",
         notes="Polyester crepe, net shimmer & synthetic blended fabrics — high volume, 10-day delivery"),
    dict(name="Bangalore Silk House", contact_person="Venkat Rao", phone_number="99800-44567",
         address="K.R. Market, Bangalore – 560002, Karnataka",
         gstin="29AABCB7890Z1Z9",
         supplier_bank_name="Canara Bank", supplier_bank_account_number="0123401234012",
         supplier_bank_ifsc_code="CNRB0001234",
         notes="Kanchipuram & other south Indian silk sarees — premium, 15-day lead time"),
    dict(name="Delhi Embroidery Works", contact_person="Rakesh Gupta", phone_number="98110-55678",
         address="Chandni Chowk, Delhi – 110006",
         gstin="07AABCD4567A2Z1",
         supplier_bank_name="HDFC Bank", supplier_bank_account_number="50201234567890",
         supplier_bank_ifsc_code="HDFC0003456",
         notes="Designer blouse sets, embroidered kurta fabrics — 7-day delivery, MOQ 5 pcs"),
    dict(name="Tiruppur Garment Factory", contact_person="Murugan Selvam", phone_number="94432-66789",
         address="Industrial Area, Tiruppur – 641604, Tamil Nadu",
         gstin="33AABCT9012B2Z7",
         supplier_bank_name="Indian Bank", supplier_bank_account_number="6789012345678",
         supplier_bank_ifsc_code="IDIB0001234",
         notes="Knitted kurtis, t-shirts & cotton innerwear — bulk supply, 7-day delivery"),
    dict(name="Kolkata Silk Palace", contact_person="Subhash Dutta", phone_number="98300-77890",
         address="Burrabazar, Kolkata – 700007, West Bengal",
         gstin="19AABCK0123C2Z4",
         supplier_bank_name="United Bank", supplier_bank_account_number="0987654321098",
         supplier_bank_ifsc_code="UTBI0001234",
         notes="Murshidabad silk, Baluchari sarees — premium, 3-week lead time"),
    dict(name="Ahmedabad Cotton Mills", contact_person="Jayesh Shah", phone_number="79900-88901",
         address="CG Road, Ahmedabad – 380006, Gujarat",
         gstin="24AABCA1234D2Z1",
         supplier_bank_name="Axis Bank", supplier_bank_account_number="91200123456789",
         supplier_bank_ifsc_code="UTIB0002345",
         notes="Plain & printed cotton, poplin — high volume, competitive pricing"),
    dict(name="Hyderabad Printed Fabrics", contact_person="Ravi Reddy", phone_number="99000-99012",
         address="Laad Bazaar, Hyderabad – 500002, Telangana",
         gstin="36AABCH2345E2Z8",
         supplier_bank_name="ICICI Bank", supplier_bank_account_number="123456789012345",
         supplier_bank_ifsc_code="ICIC0001234",
         notes="Digital print & block-print fabrics, kalamkari — 10-day delivery"),
    dict(name="Udaipur Bandhej House", contact_person="Kishore Trivedi", phone_number="94142-10234",
         address="Hathi Pol, Udaipur – 313001, Rajasthan",
         gstin="08AABCU3456F2Z5",
         supplier_bank_name="Bank of Baroda", supplier_bank_account_number="20023456789012",
         supplier_bank_ifsc_code="BARB0002345",
         notes="Bandhej sarees, leheriya dupattas — local Rajasthani craft supplier"),
    dict(name="Chennai Blouse Hub", contact_person="Lakshmi Subramaniam", phone_number="99440-21345",
         address="T-Nagar, Chennai – 600017, Tamil Nadu",
         gstin="33AABCC4567G2Z2",
         supplier_bank_name="Canara Bank", supplier_bank_account_number="0234012340234",
         supplier_bank_ifsc_code="CNRB0002345",
         notes="Readymade blouses, stitched blouse sets — 5-day delivery, south India styles"),
    dict(name="Surat Weaves & Crafts", contact_person="Bhavesh Patel", phone_number="97240-32456",
         address="Piplod, Surat – 395007, Gujarat",
         gstin="24AABCS5678H2Z9",
         supplier_bank_name="HDFC Bank", supplier_bank_account_number="50300012345678",
         supplier_bank_ifsc_code="HDFC0004567",
         notes="Chiffon, satin, organza & embellished fabrics — 10-day delivery, MOQ 20 pcs"),
    dict(name="Jaipur Zari & Embroidery", contact_person="Mahesh Kumawat", phone_number="94141-43567",
         address="Kishanpole Bazaar, Jaipur – 302003, Rajasthan",
         gstin="08AABCJ6789I2Z6",
         supplier_bank_name="State Bank of India", supplier_bank_account_number="31205678901234",
         supplier_bank_ifsc_code="SBIN0002345",
         notes="Gota-patti, zardosi & sequin embroidery work — local artisan supplier, 5-day delivery"),
]

RAW_ITEMS = [
    dict(item_name="Banarasi Silk Saree", brand_name="Zari Brocade House", sku="ZBH-SAR-001",
         material="Pure Silk", purchase_price=2800, selling_price_retail=5500,
         selling_price_wholesale=4200, current_stock_quantity=14,
         unit_of_measurement="Pcs", low_stock_threshold=5, enable_low_stock_alert=True,
         has_variants=False, variant_type=None),
    dict(item_name="Cotton Block Print Fabric", brand_name="Jaipur Cotton Co.", sku="JCC-FAB-001",
         material="Cotton", purchase_price=180, selling_price_retail=380,
         selling_price_wholesale=265, current_stock_quantity=72,
         unit_of_measurement="Mtr", low_stock_threshold=20, enable_low_stock_alert=True,
         has_variants=False, variant_type=None),
    dict(item_name="Georgette Dupatta", brand_name="Bharat Silk Mills", sku="BSM-DUP-001",
         material="Georgette", purchase_price=340, selling_price_retail=750,
         selling_price_wholesale=520, current_stock_quantity=28,
         unit_of_measurement="Pcs", low_stock_threshold=10, enable_low_stock_alert=True,
         has_variants=False, variant_type=None),
    dict(item_name="Maheshwari Cotton-Silk Saree", brand_name="Maheshwari Fabrics", sku="MF-SAR-001",
         material="Cotton-Silk Blend", purchase_price=1150, selling_price_retail=2400,
         selling_price_wholesale=1800, current_stock_quantity=19,
         unit_of_measurement="Pcs", low_stock_threshold=5, enable_low_stock_alert=True,
         has_variants=False, variant_type=None),
    dict(item_name="Embroidered Blouse Piece", brand_name="Laxmi Garments Mfg.", sku="LG-BLP-001",
         material="Cotton", purchase_price=250, selling_price_retail=550,
         selling_price_wholesale=380, current_stock_quantity=38,
         unit_of_measurement="Pcs", low_stock_threshold=10, enable_low_stock_alert=True,
         has_variants=False, variant_type=None),
    dict(item_name="Chanderi Silk Fabric", brand_name="Maheshwari Fabrics", sku="MF-CHA-001",
         material="Chanderi Silk", purchase_price=420, selling_price_retail=880,
         selling_price_wholesale=640, current_stock_quantity=48,
         unit_of_measurement="Mtr", low_stock_threshold=15, enable_low_stock_alert=True,
         has_variants=False, variant_type=None),
    dict(item_name="Zari Border Saree", brand_name="Zari Brocade House", sku="ZBH-ZBS-001",
         material="Silk", purchase_price=1750, selling_price_retail=3500,
         selling_price_wholesale=2700, current_stock_quantity=9,
         unit_of_measurement="Pcs", low_stock_threshold=5, enable_low_stock_alert=True,
         has_variants=False, variant_type=None),
    dict(item_name="Plain Lawn Fabric", brand_name="Jaipur Cotton Co.", sku="JCC-LWN-001",
         material="Lawn Cotton", purchase_price=90, selling_price_retail=185,
         selling_price_wholesale=135, current_stock_quantity=105,
         unit_of_measurement="Mtr", low_stock_threshold=30, enable_low_stock_alert=False,
         has_variants=False, variant_type=None),
    dict(item_name="Silk Stole", brand_name="Bharat Silk Mills", sku="BSM-STO-001",
         material="Pure Silk", purchase_price=490, selling_price_retail=980,
         selling_price_wholesale=720, current_stock_quantity=4,
         unit_of_measurement="Pcs", low_stock_threshold=8, enable_low_stock_alert=True,
         has_variants=False, variant_type=None),
    dict(item_name="Cotton Kurti", brand_name="Laxmi Garments Mfg.", sku="LG-KUR-001",
         material="Cotton", purchase_price=280, selling_price_retail=599,
         selling_price_wholesale=420, current_stock_quantity=0,
         unit_of_measurement="Pcs", low_stock_threshold=5, enable_low_stock_alert=True,
         has_variants=True, variant_type="Size",
         variants=[
             dict(variant_value="Small",  sku="LG-KUR-001-S",  stock_quantity=12),
             dict(variant_value="Medium", sku="LG-KUR-001-M",  stock_quantity=20),
             dict(variant_value="Large",  sku="LG-KUR-001-L",  stock_quantity=16),
             dict(variant_value="XL",     sku="LG-KUR-001-XL", stock_quantity=7),
         ]),
    dict(item_name="Lehenga Choli Set", brand_name="Laxmi Garments Mfg.", sku="LG-LHG-001",
         material="Net + Velvet", purchase_price=1800, selling_price_retail=4200,
         selling_price_wholesale=3100, current_stock_quantity=0,
         unit_of_measurement="Set", low_stock_threshold=3, enable_low_stock_alert=True,
         has_variants=True, variant_type="Color",
         variants=[
             dict(variant_value="Red",         sku="LG-LHG-001-RED", stock_quantity=5),
             dict(variant_value="Navy Blue",    sku="LG-LHG-001-NVY", stock_quantity=3),
             dict(variant_value="Maroon",       sku="LG-LHG-001-MAR", stock_quantity=6),
             dict(variant_value="Bottle Green", sku="LG-LHG-001-GRN", stock_quantity=2),
         ]),
    dict(item_name="Anarkali Suit", brand_name="Laxmi Garments Mfg.", sku="LG-ANK-001",
         material="Georgette", purchase_price=950, selling_price_retail=2100,
         selling_price_wholesale=1600, current_stock_quantity=0,
         unit_of_measurement="Set", low_stock_threshold=4, enable_low_stock_alert=True,
         has_variants=True, variant_type="Size",
         variants=[
             dict(variant_value="Small",  sku="LG-ANK-001-S",   stock_quantity=7),
             dict(variant_value="Medium", sku="LG-ANK-001-M",   stock_quantity=13),
             dict(variant_value="Large",  sku="LG-ANK-001-L",   stock_quantity=10),
             dict(variant_value="XL",     sku="LG-ANK-001-XL",  stock_quantity=4),
             dict(variant_value="XXL",    sku="LG-ANK-001-XXL", stock_quantity=2),
         ]),
    # ── New plain items ────────────────────────────────────────────────────────
    dict(item_name="Kanchipuram Silk Saree", brand_name="Bangalore Silk House", sku="BSH-KAN-001",
         material="Pure Silk", purchase_price=4500, selling_price_retail=9500,
         selling_price_wholesale=7200, current_stock_quantity=12,
         unit_of_measurement="Pcs", low_stock_threshold=4, enable_low_stock_alert=True,
         has_variants=False, variant_type=None),
    dict(item_name="Pure Wool Shawl", brand_name="Punjab Woolen Mills", sku="PWM-WLS-001",
         material="Pure Wool", purchase_price=800, selling_price_retail=1950,
         selling_price_wholesale=1400, current_stock_quantity=24,
         unit_of_measurement="Pcs", low_stock_threshold=8, enable_low_stock_alert=True,
         has_variants=False, variant_type=None),
    dict(item_name="Polyester Crepe Fabric", brand_name="Gujarat Synthetic Fabrics", sku="GSF-POL-001",
         material="Polyester", purchase_price=90, selling_price_retail=210,
         selling_price_wholesale=145, current_stock_quantity=180,
         unit_of_measurement="Mtr", low_stock_threshold=40, enable_low_stock_alert=False,
         has_variants=False, variant_type=None),
    dict(item_name="Bandhani Dupatta", brand_name="Rajasthan Craft Exports", sku="RCE-BAN-001",
         material="Cotton", purchase_price=270, selling_price_retail=620,
         selling_price_wholesale=440, current_stock_quantity=45,
         unit_of_measurement="Pcs", low_stock_threshold=12, enable_low_stock_alert=True,
         has_variants=False, variant_type=None),
    dict(item_name="Phulkari Embroidered Dupatta", brand_name="Punjab Woolen Mills", sku="PWM-PHU-001",
         material="Cotton with Silk Thread", purchase_price=620, selling_price_retail=1450,
         selling_price_wholesale=1050, current_stock_quantity=30,
         unit_of_measurement="Pcs", low_stock_threshold=8, enable_low_stock_alert=True,
         has_variants=False, variant_type=None),
    dict(item_name="Men's Kurta Fabric", brand_name="Jaipur Cotton Co.", sku="JCC-MKF-001",
         material="Cotton", purchase_price=140, selling_price_retail=310,
         selling_price_wholesale=215, current_stock_quantity=90,
         unit_of_measurement="Mtr", low_stock_threshold=20, enable_low_stock_alert=False,
         has_variants=False, variant_type=None),
    dict(item_name="Silk Blouse Fabric", brand_name="Bharat Silk Mills", sku="BSM-SBF-001",
         material="Pure Silk", purchase_price=360, selling_price_retail=820,
         selling_price_wholesale=590, current_stock_quantity=55,
         unit_of_measurement="Mtr", low_stock_threshold=15, enable_low_stock_alert=True,
         has_variants=False, variant_type=None),
    dict(item_name="Net Shimmer Fabric", brand_name="Gujarat Synthetic Fabrics", sku="GSF-NET-001",
         material="Net/Shimmer Blend", purchase_price=110, selling_price_retail=240,
         selling_price_wholesale=165, current_stock_quantity=130,
         unit_of_measurement="Mtr", low_stock_threshold=25, enable_low_stock_alert=False,
         has_variants=False, variant_type=None),
    dict(item_name="Tie-Dye Saree", brand_name="Rajasthan Craft Exports", sku="RCE-TDY-001",
         material="Cotton", purchase_price=850, selling_price_retail=2100,
         selling_price_wholesale=1550, current_stock_quantity=22,
         unit_of_measurement="Pcs", low_stock_threshold=6, enable_low_stock_alert=True,
         has_variants=False, variant_type=None),
    # ── New variant items ──────────────────────────────────────────────────────
    dict(item_name="Salwar Kameez Set", brand_name="Laxmi Garments Mfg.", sku="LG-SKS-001",
         material="Cotton Blend", purchase_price=480, selling_price_retail=1050,
         selling_price_wholesale=760, current_stock_quantity=0,
         unit_of_measurement="Set", low_stock_threshold=5, enable_low_stock_alert=True,
         has_variants=True, variant_type="Size",
         variants=[
             dict(variant_value="Small",  sku="LG-SKS-001-S",  stock_quantity=14),
             dict(variant_value="Medium", sku="LG-SKS-001-M",  stock_quantity=22),
             dict(variant_value="Large",  sku="LG-SKS-001-L",  stock_quantity=18),
             dict(variant_value="XL",     sku="LG-SKS-001-XL", stock_quantity=10),
             dict(variant_value="XXL",    sku="LG-SKS-001-XXL",stock_quantity=5),
         ]),
    dict(item_name="Men's Kurta Pajama Set", brand_name="Laxmi Garments Mfg.", sku="LG-MKP-001",
         material="Cotton", purchase_price=550, selling_price_retail=1250,
         selling_price_wholesale=900, current_stock_quantity=0,
         unit_of_measurement="Set", low_stock_threshold=4, enable_low_stock_alert=True,
         has_variants=True, variant_type="Size",
         variants=[
             dict(variant_value="Small",  sku="LG-MKP-001-S",  stock_quantity=8),
             dict(variant_value="Medium", sku="LG-MKP-001-M",  stock_quantity=15),
             dict(variant_value="Large",  sku="LG-MKP-001-L",  stock_quantity=12),
             dict(variant_value="XL",     sku="LG-MKP-001-XL", stock_quantity=6),
         ]),
    dict(item_name="Designer Blouse Set", brand_name="Delhi Embroidery Works", sku="DEW-DSB-001",
         material="Silk with Zari Work", purchase_price=1100, selling_price_retail=2700,
         selling_price_wholesale=2000, current_stock_quantity=0,
         unit_of_measurement="Set", low_stock_threshold=3, enable_low_stock_alert=True,
         has_variants=True, variant_type="Color",
         variants=[
             dict(variant_value="Gold",   sku="DEW-DSB-001-GLD", stock_quantity=6),
             dict(variant_value="Silver", sku="DEW-DSB-001-SLV", stock_quantity=4),
             dict(variant_value="Rose",   sku="DEW-DSB-001-RSE", stock_quantity=5),
             dict(variant_value="Navy",   sku="DEW-DSB-001-NVY", stock_quantity=3),
         ]),
    # ── Additional items (to reach 42 total) ───────────────────────────────────
    dict(item_name="Tussar Silk Saree", brand_name="Kolkata Silk Palace", sku="KSP-TUS-001",
         material="Tussar Silk", purchase_price=1600, selling_price_retail=3800,
         selling_price_wholesale=2800, current_stock_quantity=3,
         unit_of_measurement="Pcs", low_stock_threshold=5, enable_low_stock_alert=True,
         has_variants=False, variant_type=None),
    dict(item_name="Chiffon Saree", brand_name="Bharat Silk Mills", sku="BSM-CHF-001",
         material="Chiffon", purchase_price=520, selling_price_retail=1150,
         selling_price_wholesale=840, current_stock_quantity=7,
         unit_of_measurement="Pcs", low_stock_threshold=10, enable_low_stock_alert=True,
         has_variants=False, variant_type=None),
    dict(item_name="Pure Linen Saree", brand_name="Ahmedabad Cotton Mills", sku="ACM-LIN-001",
         material="Pure Linen", purchase_price=900, selling_price_retail=2100,
         selling_price_wholesale=1550, current_stock_quantity=20,
         unit_of_measurement="Pcs", low_stock_threshold=6, enable_low_stock_alert=True,
         has_variants=False, variant_type=None),
    dict(item_name="Kalamkari Print Fabric", brand_name="Hyderabad Printed Fabrics", sku="HPF-KAL-001",
         material="Cotton", purchase_price=160, selling_price_retail=360,
         selling_price_wholesale=250, current_stock_quantity=80,
         unit_of_measurement="Mtr", low_stock_threshold=20, enable_low_stock_alert=True,
         has_variants=False, variant_type=None),
    dict(item_name="Ikat Cotton Fabric", brand_name="Ahmedabad Cotton Mills", sku="ACM-IKT-001",
         material="Cotton", purchase_price=200, selling_price_retail=450,
         selling_price_wholesale=315, current_stock_quantity=65,
         unit_of_measurement="Mtr", low_stock_threshold=18, enable_low_stock_alert=True,
         has_variants=False, variant_type=None),
    dict(item_name="Organza Dupatta", brand_name="Surat Weaves & Crafts", sku="SWC-ORG-001",
         material="Organza", purchase_price=280, selling_price_retail=650,
         selling_price_wholesale=460, current_stock_quantity=42,
         unit_of_measurement="Pcs", low_stock_threshold=10, enable_low_stock_alert=True,
         has_variants=False, variant_type=None),
    dict(item_name="Mirror Work Dupatta", brand_name="Udaipur Bandhej House", sku="UBH-MIR-001",
         material="Cotton with Mirror Embroidery", purchase_price=380, selling_price_retail=890,
         selling_price_wholesale=640, current_stock_quantity=6,
         unit_of_measurement="Pcs", low_stock_threshold=10, enable_low_stock_alert=True,
         has_variants=False, variant_type=None),
    dict(item_name="Linen Shirt Fabric", brand_name="Ahmedabad Cotton Mills", sku="ACM-LSF-001",
         material="Pure Linen", purchase_price=220, selling_price_retail=490,
         selling_price_wholesale=340, current_stock_quantity=70,
         unit_of_measurement="Mtr", low_stock_threshold=15, enable_low_stock_alert=False,
         has_variants=False, variant_type=None),
    dict(item_name="Satin Fabric", brand_name="Surat Weaves & Crafts", sku="SWC-SAT-001",
         material="Satin", purchase_price=130, selling_price_retail=290,
         selling_price_wholesale=200, current_stock_quantity=110,
         unit_of_measurement="Mtr", low_stock_threshold=25, enable_low_stock_alert=False,
         has_variants=False, variant_type=None),
    dict(item_name="Velvet Blouse Fabric", brand_name="Delhi Embroidery Works", sku="DEW-VEL-001",
         material="Velvet", purchase_price=320, selling_price_retail=750,
         selling_price_wholesale=540, current_stock_quantity=48,
         unit_of_measurement="Mtr", low_stock_threshold=12, enable_low_stock_alert=True,
         has_variants=False, variant_type=None),
    dict(item_name="Digital Print Saree", brand_name="Hyderabad Printed Fabrics", sku="HPF-DPS-001",
         material="Georgette", purchase_price=640, selling_price_retail=1450,
         selling_price_wholesale=1050, current_stock_quantity=5,
         unit_of_measurement="Pcs", low_stock_threshold=8, enable_low_stock_alert=True,
         has_variants=False, variant_type=None),
    dict(item_name="Silk Kurta Fabric", brand_name="Bharat Silk Mills", sku="BSM-SKF-001",
         material="Pure Silk", purchase_price=480, selling_price_retail=1100,
         selling_price_wholesale=800, current_stock_quantity=55,
         unit_of_measurement="Mtr", low_stock_threshold=12, enable_low_stock_alert=True,
         has_variants=False, variant_type=None),
    dict(item_name="Sambalpuri Ikat Saree", brand_name="Kolkata Silk Palace", sku="KSP-SAM-001",
         material="Cotton-Silk", purchase_price=1900, selling_price_retail=4500,
         selling_price_wholesale=3300, current_stock_quantity=2,
         unit_of_measurement="Pcs", low_stock_threshold=4, enable_low_stock_alert=True,
         has_variants=False, variant_type=None),
    dict(item_name="Rayon Kurti", brand_name="Tiruppur Garment Factory", sku="TGF-RAY-001",
         material="Rayon", purchase_price=220, selling_price_retail=499,
         selling_price_wholesale=350, current_stock_quantity=0,
         unit_of_measurement="Pcs", low_stock_threshold=8, enable_low_stock_alert=True,
         has_variants=True, variant_type="Size",
         variants=[
             dict(variant_value="Small",  sku="TGF-RAY-001-S",  stock_quantity=15),
             dict(variant_value="Medium", sku="TGF-RAY-001-M",  stock_quantity=25),
             dict(variant_value="Large",  sku="TGF-RAY-001-L",  stock_quantity=18),
             dict(variant_value="XL",     sku="TGF-RAY-001-XL", stock_quantity=10),
         ]),
    dict(item_name="Cotton Palazzo Set", brand_name="Tiruppur Garment Factory", sku="TGF-PZZ-001",
         material="Cotton", purchase_price=380, selling_price_retail=850,
         selling_price_wholesale=615, current_stock_quantity=0,
         unit_of_measurement="Set", low_stock_threshold=5, enable_low_stock_alert=True,
         has_variants=True, variant_type="Size",
         variants=[
             dict(variant_value="Small",  sku="TGF-PZZ-001-S",  stock_quantity=10),
             dict(variant_value="Medium", sku="TGF-PZZ-001-M",  stock_quantity=18),
             dict(variant_value="Large",  sku="TGF-PZZ-001-L",  stock_quantity=14),
             dict(variant_value="XL",     sku="TGF-PZZ-001-XL", stock_quantity=7),
         ]),
    dict(item_name="Bridal Lehenga Set", brand_name="Laxmi Garments Mfg.", sku="LG-BRL-001",
         material="Net + Velvet + Zari", purchase_price=4500, selling_price_retail=12000,
         selling_price_wholesale=9000, current_stock_quantity=0,
         unit_of_measurement="Set", low_stock_threshold=2, enable_low_stock_alert=True,
         has_variants=True, variant_type="Color",
         variants=[
             dict(variant_value="Bridal Red",    sku="LG-BRL-001-RED", stock_quantity=3),
             dict(variant_value="Royal Blue",     sku="LG-BRL-001-BLU", stock_quantity=2),
             dict(variant_value="Emerald Green",  sku="LG-BRL-001-GRN", stock_quantity=2),
             dict(variant_value="Champagne Gold", sku="LG-BRL-001-GLD", stock_quantity=2),
         ]),
    dict(item_name="Embroidered Lehenga Skirt", brand_name="Delhi Embroidery Works", sku="DEW-ELS-001",
         material="Net with Embroidery", purchase_price=2200, selling_price_retail=5500,
         selling_price_wholesale=4000, current_stock_quantity=0,
         unit_of_measurement="Pcs", low_stock_threshold=3, enable_low_stock_alert=True,
         has_variants=True, variant_type="Color",
         variants=[
             dict(variant_value="Pink",   sku="DEW-ELS-001-PNK", stock_quantity=4),
             dict(variant_value="Purple", sku="DEW-ELS-001-PRP", stock_quantity=3),
             dict(variant_value="Black",  sku="DEW-ELS-001-BLK", stock_quantity=2),
         ]),
    dict(item_name="Readymade Blouse", brand_name="Chennai Blouse Hub", sku="CBH-BLS-001",
         material="Cotton Silk", purchase_price=350, selling_price_retail=799,
         selling_price_wholesale=570, current_stock_quantity=0,
         unit_of_measurement="Pcs", low_stock_threshold=6, enable_low_stock_alert=True,
         has_variants=True, variant_type="Size",
         variants=[
             dict(variant_value='32"', sku="CBH-BLS-001-32", stock_quantity=10),
             dict(variant_value='34"', sku="CBH-BLS-001-34", stock_quantity=16),
             dict(variant_value='36"', sku="CBH-BLS-001-36", stock_quantity=14),
             dict(variant_value='38"', sku="CBH-BLS-001-38", stock_quantity=8),
             dict(variant_value='40"', sku="CBH-BLS-001-40", stock_quantity=5),
         ]),
]

# Populated after DB insert
_items: dict = {}   # sku -> ItemModel
_custs: dict = {}   # name -> CustomerModel

# ── Invoice factory ───────────────────────────────────────────────────────────

def make_invoice(
    db: Session,
    customer: CustomerModel,
    date: datetime,
    lines: list,
    discount_pct: float = 0.0,
    notes: Optional[str] = None,
    payment_status: Optional[str] = None,
    po_number: Optional[str] = None,
) -> InvoiceModel:
    inv_no = next_inv_no(date)

    max_price = max(
        (p if p is not None else (
            _items[s].selling_price_wholesale if customer.customer_type == "Wholesale"
            else _items[s].selling_price_retail
        ))
        for s, _, p in lines
    )
    tax_rate = 12.0 if max_price > 1000 else 5.0

    sub_total = 0.0
    line_models = []
    for (sku, qty, price_override) in lines:
        item = _items[sku]
        price = price_override if price_override is not None else (
            item.selling_price_wholesale if customer.customer_type == "Wholesale"
            else item.selling_price_retail
        )
        sub_total += price * qty
        line_models.append(InvoiceLineItemModel(
            item_id=item.id, quantity=qty, price=price,
            discount_amount=None, discount_type="amount",
        ))

    invoice_discount = round(sub_total * discount_pct / 100, 2) if discount_pct else 0.0
    taxable = sub_total - invoice_discount
    tax_amount = round(taxable * tax_rate / 100, 2)
    grand_total = round(taxable + tax_amount, 2)

    credit_days = customer.credit_days or 0
    due_date = date + timedelta(days=credit_days) if credit_days > 0 else None

    if payment_status is None:
        if customer.customer_type == "Retail":
            # Retail: always paid at point of sale (cash/UPI)
            payment_status = "paid"
        else:
            # Wholesale: always start unpaid — make_payment() handles all settlement
            payment_status = "unpaid"

    ps_map = {
        "paid": PaymentStatus.PAID,
        "partial": PaymentStatus.PARTIALLY_PAID,
        "unpaid": PaymentStatus.UNPAID,
    }
    ps = ps_map[payment_status]

    if payment_status == "paid":
        amount_paid = grand_total
    elif payment_status == "partial":
        amount_paid = round(grand_total * random.uniform(0.30, 0.72), 2)
    else:
        amount_paid = 0.0

    inv = InvoiceModel(
        invoice_number=inv_no,
        invoice_date=date,
        due_date=due_date,
        customer_id=customer.id,
        discount_type="percent" if discount_pct else "amount",
        discount_amount=invoice_discount,
        tax_rate=tax_rate,
        sub_total=sub_total,
        total_tax_amount=tax_amount,
        grand_total=grand_total,
        amount_paid=amount_paid,
        payment_status=ps,
        po_number=po_number,
        notes=notes,
        created_at=date,
        updated_at=date,
    )
    inv.line_items = line_models
    db.add(inv)
    db.flush()
    return inv


def make_payment(db, customer, date, amount, invoices_to_allocate, method="cash", ref=None, notes=None):
    payment = PaymentModel(
        customer_id=customer.id, date=date, amount=amount,
        payment_method=method, reference_number=ref,
        credit_balance=0.0, notes=notes, created_at=date,
    )
    db.add(payment)
    db.flush()

    remaining = amount
    for inv in invoices_to_allocate:
        if remaining <= 0:
            break
        unpaid = inv.grand_total - inv.amount_paid
        if unpaid <= 0:
            continue
        alloc = min(unpaid, remaining)
        db.add(PaymentAllocationModel(
            payment_id=payment.id, invoice_id=inv.id,
            allocated_amount=alloc, created_at=date,
        ))
        inv.amount_paid = round(inv.amount_paid + alloc, 2)
        remaining -= alloc
        if inv.amount_paid >= inv.grand_total - 0.01:
            inv.payment_status = PaymentStatus.PAID
        else:
            inv.payment_status = PaymentStatus.PARTIALLY_PAID
    # Store any unallocated surplus as credit balance
    if remaining > 0.01:
        payment.credit_balance = round(remaining, 2)
    return payment


# ── Main seed ─────────────────────────────────────────────────────────────────

def _seed(db: Session):
    print("  [1/7] Company profile...")
    db.add(CompanyProfileModel(
        shop_name="Sharma Textile & Garments",
        shop_address="G-14, Bapu Bazaar, Jaipur – 302003, Rajasthan",
        shop_phone="0141-4012345",
        shop_gstin="08ABCPS1234F1Z5",
        default_tax_rate=5.0,
        currency_symbol="₹",
        receiver_bank_name="HDFC Bank",
        receiver_account_number="50200098765432",
        receiver_ifsc_code="HDFC0002456",
        created_at=datetime(2025, 7, 20),
    ))
    db.flush()

    print("  [2/7] Customers...")
    for c in RAW_CUSTOMERS:
        cdata = dict(c)
        created_at = cdata.pop("created_at", datetime(2025, 7, 22))
        obj = CustomerModel(**cdata, created_at=created_at)
        db.add(obj)
        db.flush()
        _custs[obj.name] = obj

    print("  [3/7] Suppliers...")
    for s in RAW_SUPPLIERS:
        db.add(SupplierModel(**s, created_at=datetime(2025, 7, 22)))
    db.flush()

    print("  [4/7] Items & variants...")
    for idata in RAW_ITEMS:
        variants = idata.pop("variants", [])
        item = ItemModel(**idata, created_at=datetime(2025, 7, 22))
        db.add(item)
        db.flush()
        _items[item.sku] = item
        for v in variants:
            db.add(ItemVariantModel(item_id=item.id, **v, created_at=datetime(2025, 7, 22)))
    db.flush()

    print("  [5/7] Stock audit entries...")
    opening = {
        "ZBH-SAR-001": 50, "JCC-FAB-001": 200, "BSM-DUP-001": 80,
        "MF-SAR-001":  60, "LG-BLP-001":  100, "MF-CHA-001":  120,
        "ZBH-ZBS-001": 40, "JCC-LWN-001": 300, "BSM-STO-001": 50,
        "LG-KUR-001": 120, "LG-LHG-001":   50, "LG-ANK-001":   80,
        # New items opening stock
        "BSH-KAN-001":  30, "PWM-WLS-001":  60, "GSF-POL-001": 400,
        "RCE-BAN-001":  80, "PWM-PHU-001":  60, "JCC-MKF-001": 200,
        "BSM-SBF-001": 100, "GSF-NET-001": 250, "RCE-TDY-001":  50,
        "LG-SKS-001":  100, "LG-MKP-001":   60, "DEW-DSB-001":  30,
        # Additional items opening stock
        "KSP-TUS-001":  40, "BSM-CHF-001":  80, "ACM-LIN-001":  45,
        "HPF-KAL-001": 160, "ACM-IKT-001": 120, "SWC-ORG-001":  80,
        "UBH-MIR-001":  80, "ACM-LSF-001": 150, "SWC-SAT-001": 200,
        "DEW-VEL-001":  80, "HPF-DPS-001":  60, "BSM-SKF-001": 100,
        "KSP-SAM-001":  25, "TGF-RAY-001": 100, "TGF-PZZ-001":  70,
        "LG-BRL-001":   20, "DEW-ELS-001":  30, "CBH-BLS-001":  80,
        # Note: current_stock_quantity in RAW_ITEMS for some items is set below
        # their opening stock (stock sold over time), intentionally for realistic demo.
    }
    # Track cumulative restocked stock per SKU for accurate delta_after
    _rs = {}
    for sku, qty in opening.items():
        _rs[sku] = qty
        db.add(StockAuditModel(
            item_id=_items[sku].id, delta=qty, delta_after=qty,
            reason="Opening stock — shop setup",
            created_at=datetime(2025, 7, 22, 10, 0),
        ))

    restocks = [
        ("ZBH-SAR-001", datetime(2025,10, 1,  9, 0), 30, "Navratri restock — Banarasi sarees"),
        ("LG-LHG-001",  datetime(2025,10, 2,  9,30), 40, "Navratri restock — lehengas"),
        ("LG-ANK-001",  datetime(2025,10, 2, 10, 0), 50, "Navratri restock — anarkali suits"),
        ("BSM-DUP-001", datetime(2025,10, 5, 11, 0), 50, "Navratri restock — georgette dupattas"),
        ("ZBH-SAR-001", datetime(2025,10,28,  9, 0), 40, "Diwali restock — Banarasi sarees"),
        ("MF-SAR-001",  datetime(2025,10,28,  9, 0), 40, "Diwali restock — Maheshwari sarees"),
        ("ZBH-ZBS-001", datetime(2025,10,28,  9, 0), 35, "Diwali restock — zari border sarees"),
        ("BSM-STO-001", datetime(2025,10,28,  9, 0), 30, "Diwali restock — silk stoles"),
        ("LG-LHG-001",  datetime(2025,11,25,  9, 0), 60, "Wedding season restock — lehengas"),
        ("LG-ANK-001",  datetime(2025,11,25,  9, 0), 60, "Wedding season restock — anarkalis"),
        ("LG-KUR-001",  datetime(2025,11,25,  9, 0), 80, "Wedding season restock — kurtis"),
        ("MF-CHA-001",  datetime(2025,12, 1,  9, 0), 60, "December restock — Chanderi fabric"),
        ("JCC-FAB-001", datetime(2025,12, 1,  9, 0),150, "December bulk restock — block print fabric"),
        ("BSM-STO-001", datetime(2026, 1, 3,  9, 0), 25, "January restock — silk stoles"),
        ("ZBH-SAR-001", datetime(2026, 1, 3,  9, 0), 35, "January wedding season restock — Banarasi"),
        ("ZBH-ZBS-001", datetime(2026, 1, 3,  9, 0), 20, "January wedding restock — zari sarees"),
        ("LG-LHG-001",  datetime(2026, 1, 3,  9, 0), 50, "January wedding restock — lehengas"),
        ("MF-SAR-001",  datetime(2026, 1, 3,  9, 0), 30, "January restock — Maheshwari sarees"),
        ("JCC-LWN-001", datetime(2026, 2, 1,  9, 0),150, "February bulk restock — lawn fabric"),
        ("LG-KUR-001",  datetime(2026, 3, 1,  9, 0), 50, "Holi/spring restock — cotton kurtis"),
        ("JCC-FAB-001", datetime(2026, 3, 1,  9, 0),100, "Spring restock — block print fabric"),
        # New item restocks
        ("BSH-KAN-001", datetime(2025,10,28,  9, 0), 20, "Diwali restock — Kanchipuram sarees"),
        ("BSH-KAN-001", datetime(2026, 1, 3,  9, 0), 25, "Wedding season restock — Kanchipuram"),
        ("PWM-WLS-001", datetime(2025,10,15,  9, 0), 40, "Winter restock — wool shawls"),
        ("PWM-PHU-001", datetime(2025,10, 5,  9, 0), 40, "Navratri restock — Phulkari dupattas"),
        ("PWM-PHU-001", datetime(2026, 1, 5,  9, 0), 30, "Wedding season restock — Phulkari"),
        ("RCE-BAN-001", datetime(2025,10, 2,  9, 0), 60, "Navratri restock — Bandhani dupattas"),
        ("RCE-BAN-001", datetime(2026, 1,10,  9, 0), 50, "Wedding/spring restock — Bandhani"),
        ("RCE-TDY-001", datetime(2025,11,25,  9, 0), 30, "Wedding season restock — tie-dye sarees"),
        ("LG-SKS-001",  datetime(2025,11,25,  9, 0), 80, "Wedding season restock — salwar sets"),
        ("LG-SKS-001",  datetime(2026, 2, 1,  9, 0), 60, "Spring restock — salwar kameez"),
        ("LG-MKP-001",  datetime(2025,10,28,  9, 0), 40, "Diwali restock — men's kurta sets"),
        ("LG-MKP-001",  datetime(2026, 1, 5,  9, 0), 30, "Wedding season restock — kurta pajama"),
        ("DEW-DSB-001", datetime(2025,11, 1,  9, 0), 20, "Wedding season restock — designer blouses"),
        ("DEW-DSB-001", datetime(2026, 1, 5,  9, 0), 20, "Jan restock — designer blouse sets"),
        ("BSM-SBF-001", datetime(2025,11,25,  9, 0), 60, "Wedding season restock — silk blouse fabric"),
        ("GSF-NET-001", datetime(2025,10,28,  9, 0), 80, "Wedding season restock — net fabric"),
        ("GSF-NET-001", datetime(2026, 1, 3,  9, 0), 70, "Jan restock — net shimmer fabric"),
        ("GSF-POL-001", datetime(2026, 2, 1,  9, 0),150, "Spring bulk restock — polyester fabric"),
        ("JCC-MKF-001", datetime(2025,10,15,  9, 0), 80, "Festive restock — men's kurta fabric"),
        ("JCC-MKF-001", datetime(2026, 3, 1,  9, 0),100, "Spring restock — men's kurta fabric"),
    ]
    for sku, rdate, qty, reason in restocks:
        _rs[sku] = _rs.get(sku, 0) + qty
        db.add(StockAuditModel(
            item_id=_items[sku].id, delta=qty, delta_after=_rs[sku],
            reason=reason, created_at=rdate,
        ))
    db.flush()

    # ── INVOICES ──────────────────────────────────────────────────────────────
    print("  [6/7] Generating invoices...")
    all_invoices = []

    mehta  = _custs["Mehta Boutique"]
    priya  = _custs["Priya Fashion House"]
    delhi  = _custs["Delhi Wholesale Hub"]
    raj    = _custs["Rajasthan Traders"]
    sunita = _custs["Sunita Sharma"]
    kavya  = _custs["Kavya Patel"]
    arjun  = _custs["Arjun Singh"]
    neha   = _custs["Neha Gupta"]
    walkin = _custs["Walk-in Customer"]

    SAR = "ZBH-SAR-001"; FAB = "JCC-FAB-001"; DUP = "BSM-DUP-001"
    MSR = "MF-SAR-001";  BLP = "LG-BLP-001";  CHA = "MF-CHA-001"
    ZBS = "ZBH-ZBS-001"; LWN = "JCC-LWN-001"; STO = "BSM-STO-001"
    KUR = "LG-KUR-001";  LHG = "LG-LHG-001";  ANK = "LG-ANK-001"
    # New items
    KAN = "BSH-KAN-001"; WLS = "PWM-WLS-001"; POL = "GSF-POL-001"
    BAN = "RCE-BAN-001"; PHU = "PWM-PHU-001"; MKF = "JCC-MKF-001"
    SBF = "BSM-SBF-001"; NET = "GSF-NET-001"; TDY = "RCE-TDY-001"
    SKS = "LG-SKS-001";  MKP = "LG-MKP-001";  DSB = "DEW-DSB-001"

    # New wholesale customers
    shekh = _custs["Shekhawati Saree House"]
    mumbai= _custs["Mumbai Fashion Co."]
    punjab= _custs["Punjab Dress Centre"]
    south = _custs["South Silk Traders"]
    hyd   = _custs["Hyderabad Silks Ltd."]
    kolkata= _custs["Kolkata Textile Hub"]
    # New retail customers
    priyanka= _custs["Priyanka Joshi"]
    ravi    = _custs["Ravi Kumar"]
    meera   = _custs["Meera Agarwal"]
    pooja   = _custs["Pooja Singh"]

    # Each tuple: (customer, date, [(sku, qty, price_override)], discount_pct, notes)
    invoice_batches = [
        # ── JULY 2025 (new shop, slow) ────────────────────────────────────
        (mehta, dt(2025,7,25), [(FAB,30,None),(DUP,5,None)], 5, "Opening wholesale order", "PO-MEH-2025-001"),
        (raj,   dt(2025,7,26), [(FAB,20,None),(LWN,40,None)], 5, "July opening order", "PO-RAJ-2025-001"),
        (sunita,dt(2025,7,28), [(MSR,1,None),(BLP,2,None)], 0, None),
        (walkin,dt(2025,7,29), [(FAB,3,None)], 0, None),
        (kavya, dt(2025,7,30), [(DUP,1,None),(BLP,1,None)], 0, None),
        (walkin,dt(2025,7,31), [(LWN,4,None),(FAB,2,None)], 0, None),
        # ── AUGUST 2025 ── Independence Day & Raksha Bandhan ──────────────
        (sunita,dt(2025,8,2),  [(CHA,2,None)], 0, None),
        (arjun, dt(2025,8,4),  [(LWN,5,None),(FAB,2,None)], 0, None),
        (walkin,dt(2025,8,5),  [(DUP,2,None)], 0, None),
        (mehta, dt(2025,8,7),  [(FAB,25,None),(CHA,10,None)], 5, "Second order", "PO-MEH-2025-002"),
        (walkin,dt(2025,8,10), [(FAB,3,None),(LWN,2,None)], 0, None),
        (sunita,dt(2025,8,12), [(MSR,1,None)], 0, None),
        (kavya, dt(2025,8,13), [(DUP,3,None),(BLP,2,None)], 0, "Independence Day shopping"),
        (walkin,dt(2025,8,14), [(KUR,2,None),(DUP,1,None)], 0, None),
        (walkin,dt(2025,8,15), [(FAB,4,None),(LWN,3,None)], 0, "Independence Day"),
        (walkin,dt(2025,8,17), [(DUP,3,None),(STO,1,None)], 0, None),
        (sunita,dt(2025,8,18), [(DUP,2,None),(STO,2,None)], 0, "Raksha Bandhan gifts"),
        (kavya, dt(2025,8,18), [(MSR,1,None),(DUP,1,None)], 0, "Raksha Bandhan"),
        (walkin,dt(2025,8,19), [(DUP,5,None),(STO,3,None),(BLP,2,None)], 0, "Raksha Bandhan peak"),
        (walkin,dt(2025,8,19), [(FAB,3,None),(DUP,2,None)], 0, None),
        (arjun, dt(2025,8,20), [(STO,2,None),(DUP,1,None)], 0, "Gift purchase"),
        (walkin,dt(2025,8,22), [(MSR,1,None),(BLP,1,None)], 0, None),
        (neha,  dt(2025,8,24), [(SAR,1,None),(BLP,2,None)], 0, "Festive wear"),
        (walkin,dt(2025,8,25), [(CHA,3,None),(LWN,4,None)], 0, None),
        (raj,   dt(2025,8,26), [(FAB,40,None),(CHA,15,None)], 5, "August wholesale"),
        (sunita,dt(2025,8,27), [(MSR,1,None),(DUP,1,None)], 0, "Ganesh Chaturthi"),
        (walkin,dt(2025,8,28), [(KUR,3,None),(DUP,1,None)], 0, None),
        (mehta, dt(2025,8,29), [(DUP,20,None),(STO,10,None),(BLP,15,None)], 5, "End-Aug wholesale", "PO-MEH-2025-003"),
        (walkin,dt(2025,8,30), [(FAB,2,None),(BLP,1,None)], 0, None),
        (kavya, dt(2025,8,31), [(ANK,1,None)], 0, None),
        # ── SEPTEMBER 2025 ── Navratri prep & Onam ──────────────────────
        (walkin,dt(2025,9,1),  [(FAB,3,None),(LWN,4,None)], 0, None),
        (sunita,dt(2025,9,3),  [(CHA,2,None),(BLP,1,None)], 0, None),
        (walkin,dt(2025,9,5),  [(MSR,1,None),(DUP,2,None)], 0, "Onam"),
        (kavya, dt(2025,9,6),  [(MSR,2,None),(DUP,2,None)], 0, "Onam sarees"),
        (walkin,dt(2025,9,7),  [(SAR,1,None)], 0, "Onam Banarasi"),
        (walkin,dt(2025,9,8),  [(MSR,1,None),(BLP,2,None)], 0, None),
        (arjun, dt(2025,9,9),  [(FAB,4,None),(LWN,5,None)], 0, None),
        (walkin,dt(2025,9,10), [(DUP,3,None),(STO,1,None)], 0, "Onam"),
        (neha,  dt(2025,9,11), [(ANK,2,None),(DUP,2,None)], 0, "Festival wear"),
        (walkin,dt(2025,9,12), [(CHA,3,None),(FAB,2,None)], 0, None),
        (walkin,dt(2025,9,13), [(KUR,3,None),(DUP,2,None)], 0, None),
        (sunita,dt(2025,9,14), [(ZBS,1,None),(BLP,1,None)], 0, None),
        (walkin,dt(2025,9,15), [(MSR,1,None)], 0, "Onam last day"),
        (mehta, dt(2025,9,17), [(LHG,8,None),(ANK,10,None),(DUP,15,None)], 5, "Navratri wholesale prep", "PO-MEH-2025-004"),
        (priya, dt(2025,9,18), [(LHG,12,None),(ANK,8,None)], 5, "Navratri order", "PO-PRY-2025-001"),
        (walkin,dt(2025,9,19), [(FAB,4,None),(LWN,3,None)], 0, None),
        (kavya, dt(2025,9,20), [(ANK,1,None),(DUP,2,None)], 0, "Navratri shopping"),
        (walkin,dt(2025,9,21), [(KUR,2,None),(DUP,1,None)], 0, None),
        (raj,   dt(2025,9,22), [(FAB,50,None),(LWN,60,None)], 5, "September wholesale bulk", "PO-RAJ-2025-002"),
        (walkin,dt(2025,9,24), [(DUP,3,None),(STO,2,None)], 0, None),
        (neha,  dt(2025,9,25), [(LHG,1,None),(BLP,2,None)], 0, "Navratri lehenga"),
        (walkin,dt(2025,9,26), [(MSR,1,None),(BLP,1,None)], 0, None),
        (arjun, dt(2025,9,27), [(LWN,6,None),(FAB,3,None)], 0, None),
        (kavya, dt(2025,9,28), [(ANK,1,None),(DUP,2,None)], 0, "Navratri prep"),
        (walkin,dt(2025,9,29), [(KUR,4,None),(DUP,2,None)], 0, None),
        (sunita,dt(2025,9,30), [(ZBS,1,None),(DUP,1,None)], 0, None),
        (delhi, dt(2025,9,25), [(SAR,5,None),(ZBS,5,None),(MSR,8,None)], 7, "Sep wholesale saree order", "PO-DWH-2025-001"),
        # ── OCTOBER 2025 ── Navratri/Garba + Dussehra + Karwa Chauth ────
        (walkin,dt(2025,10,2),  [(LHG,2,None),(ANK,1,None),(DUP,3,None)], 0, "Navratri Day 1"),
        (walkin,dt(2025,10,2),  [(KUR,3,None),(DUP,2,None)], 0, None),
        (kavya, dt(2025,10,3),  [(LHG,1,None),(DUP,2,None)], 0, "Navratri outfit"),
        (sunita,dt(2025,10,3),  [(ANK,1,None),(DUP,2,None)], 0, "Navratri"),
        (walkin,dt(2025,10,4),  [(LHG,2,None),(BLP,2,None)], 0, None),
        (walkin,dt(2025,10,4),  [(ANK,2,None),(KUR,2,None)], 0, None),
        (arjun, dt(2025,10,5),  [(STO,3,None),(FAB,2,None)], 0, "Gift items"),
        (neha,  dt(2025,10,5),  [(LHG,1,None),(DUP,3,None)], 0, "Navratri look"),
        (walkin,dt(2025,10,5),  [(KUR,4,None),(DUP,3,None)], 0, None),
        (walkin,dt(2025,10,6),  [(LHG,3,None),(ANK,2,None)], 0, None),
        (kavya, dt(2025,10,6),  [(SAR,1,None),(BLP,2,None)], 0, None),
        (walkin,dt(2025,10,7),  [(ANK,3,None),(DUP,4,None)], 0, "Navratri rush"),
        (walkin,dt(2025,10,7),  [(KUR,5,None),(STO,2,None)], 0, None),
        (sunita,dt(2025,10,8),  [(LHG,1,None),(BLP,2,None)], 0, None),
        (walkin,dt(2025,10,8),  [(DUP,6,None),(STO,3,None)], 0, None),
        (walkin,dt(2025,10,9),  [(LHG,2,None),(ANK,1,None),(DUP,2,None)], 0, None),
        (walkin,dt(2025,10,10), [(KUR,4,None),(DUP,3,None)], 0, "Garba night outfits"),
        (walkin,dt(2025,10,10), [(ANK,3,None),(LHG,1,None)], 0, None),
        (neha,  dt(2025,10,11), [(SAR,1,None),(DUP,2,None)], 0, "Navratri Ashtami"),
        (walkin,dt(2025,10,11), [(LHG,3,None),(BLP,3,None)], 0, None),
        (walkin,dt(2025,10,12), [(ANK,2,None),(KUR,3,None)], 0, "Dussehra"),
        (kavya, dt(2025,10,12), [(LHG,1,None),(DUP,3,None)], 0, "Dussehra"),
        (mehta, dt(2025,10,14), [(LHG,15,None),(ANK,12,None),(DUP,20,None)], 5, "Navratri follow-up order", "PO-MEH-2025-005"),
        (priya, dt(2025,10,15), [(LHG,10,None),(ANK,8,None),(SAR,4,None)], 5, "Navratri/Dussehra order", "PO-PRY-2025-002"),
        (walkin,dt(2025,10,15), [(CHA,3,None),(FAB,4,None)], 0, None),
        (walkin,dt(2025,10,16), [(MSR,1,None),(BLP,1,None)], 0, None),
        (walkin,dt(2025,10,17), [(ANK,2,None),(DUP,2,None)], 0, None),
        (sunita,dt(2025,10,18), [(SAR,1,None),(BLP,2,None)], 0, "Karwa Chauth prep"),
        (kavya, dt(2025,10,19), [(MSR,1,None),(STO,2,None)], 0, "Karwa Chauth"),
        (walkin,dt(2025,10,19), [(SAR,2,None),(DUP,3,None)], 0, "Karwa Chauth"),
        (walkin,dt(2025,10,20), [(ZBS,2,None),(BLP,3,None)], 0, "Karwa Chauth peak"),
        (walkin,dt(2025,10,20), [(MSR,2,None),(DUP,2,None)], 0, None),
        (neha,  dt(2025,10,20), [(SAR,1,None),(BLP,2,None)], 0, "Karwa Chauth saree"),
        (arjun, dt(2025,10,20), [(STO,3,None),(DUP,2,None)], 0, "Karwa Chauth gifts"),
        (walkin,dt(2025,10,22), [(LHG,2,None),(KUR,3,None)], 0, "Diwali shopping"),
        (walkin,dt(2025,10,23), [(SAR,1,None),(ZBS,1,None)], 0, None),
        (walkin,dt(2025,10,24), [(ANK,2,None),(DUP,3,None)], 0, "Diwali prep"),
        (sunita,dt(2025,10,25), [(SAR,1,None),(BLP,2,None)], 0, "Diwali saree"),
        (kavya, dt(2025,10,26), [(LHG,1,None),(ANK,1,None),(DUP,2,None)], 0, "Diwali"),
        (walkin,dt(2025,10,26), [(KUR,4,None),(STO,2,None)], 0, None),
        (walkin,dt(2025,10,27), [(SAR,2,None),(ZBS,1,None)], 0, "Diwali gifts"),
        (walkin,dt(2025,10,27), [(MSR,2,None),(DUP,3,None)], 0, None),
        (walkin,dt(2025,10,28), [(LHG,3,None),(ANK,2,None),(BLP,3,None)], 0, "Diwali eve"),
        (walkin,dt(2025,10,28), [(SAR,2,None),(ZBS,2,None)], 0, None),
        (walkin,dt(2025,10,29), [(KUR,5,None),(DUP,4,None)], 0, None),
        (walkin,dt(2025,10,30), [(ANK,3,None),(STO,3,None)], 0, "Last-minute Diwali"),
        (delhi, dt(2025,10,15), [(SAR,8,None),(ZBS,6,None),(MSR,10,None)], 7, "Diwali wholesale order", "PO-DWH-2025-002"),
        (raj,   dt(2025,10,20), [(LHG,10,None),(ANK,8,None),(SAR,5,None)], 5, "Diwali/wedding wholesale", "PO-RAJ-2025-003"),
        # ── NOVEMBER 2025 ── Diwali (Nov 1) PEAK + Wedding Season ───────
        (walkin,dt(2025,11,1),  [(SAR,3,None),(ZBS,2,None),(BLP,4,None)], 0, "Diwali"),
        (walkin,dt(2025,11,1),  [(LHG,4,None),(ANK,2,None)], 0, "Diwali"),
        (walkin,dt(2025,11,1),  [(MSR,3,None),(DUP,5,None)], 0, "Diwali"),
        (kavya, dt(2025,11,1),  [(SAR,1,None),(STO,3,None),(BLP,2,None)], 0, "Diwali gifting"),
        (sunita,dt(2025,11,1),  [(ZBS,1,None),(DUP,3,None)], 0, "Diwali purchase"),
        (neha,  dt(2025,11,1),  [(SAR,2,None),(BLP,3,None)], 0, "Diwali celebration"),
        (walkin,dt(2025,11,1),  [(KUR,6,None),(DUP,5,None)], 0, None),
        (arjun, dt(2025,11,1),  [(STO,5,None),(DUP,3,None)], 0, "Diwali gifts"),
        (walkin,dt(2025,11,2),  [(LHG,3,None),(ANK,3,None),(DUP,4,None)], 0, None),
        (walkin,dt(2025,11,2),  [(SAR,2,None),(ZBS,2,None)], 0, None),
        (walkin,dt(2025,11,3),  [(KUR,5,None),(STO,4,None)], 0, "Bhai Dooj"),
        (sunita,dt(2025,11,3),  [(DUP,4,None),(BLP,3,None)], 0, "Bhai Dooj gifts"),
        (walkin,dt(2025,11,3),  [(MSR,2,None),(ANK,1,None)], 0, None),
        (walkin,dt(2025,11,4),  [(LHG,2,None),(DUP,3,None)], 0, None),
        (kavya, dt(2025,11,5),  [(ANK,2,None),(CHA,3,None)], 0, None),
        (mehta, dt(2025,11,6),  [(LHG,20,None),(ANK,15,None),(SAR,8,None)], 5, "Nov wholesale — wedding season", "PO-MEH-2025-006"),
        (priya, dt(2025,11,7),  [(LHG,15,None),(ANK,12,None),(DUP,20,None)], 5, "Wedding season bulk order", "PO-PRY-2025-003"),
        (walkin,dt(2025,11,8),  [(SAR,1,None),(BLP,2,None)], 0, None),
        (walkin,dt(2025,11,9),  [(LHG,2,None),(ANK,1,None)], 0, "Wedding wear"),
        (walkin,dt(2025,11,10), [(KUR,3,None),(CHA,2,None)], 0, None),
        (neha,  dt(2025,11,11), [(LHG,1,None),(BLP,3,None)], 0, "Wedding outfit"),
        (walkin,dt(2025,11,12), [(ZBS,2,None),(DUP,3,None)], 0, None),
        (walkin,dt(2025,11,13), [(ANK,2,None),(STO,2,None)], 0, None),
        (sunita,dt(2025,11,14), [(SAR,1,None),(DUP,2,None)], 0, "Wedding season"),
        (walkin,dt(2025,11,15), [(LHG,3,None),(ANK,2,None),(BLP,3,None)], 0, None),
        (walkin,dt(2025,11,16), [(MSR,2,None),(KUR,3,None)], 0, None),
        (walkin,dt(2025,11,17), [(SAR,1,None),(ZBS,1,None)], 0, None),
        (kavya, dt(2025,11,18), [(LHG,1,None),(DUP,4,None)], 0, "Wedding"),
        (walkin,dt(2025,11,19), [(ANK,3,None),(CHA,3,None)], 0, None),
        (walkin,dt(2025,11,20), [(KUR,4,None),(DUP,3,None)], 0, None),
        (arjun, dt(2025,11,21), [(FAB,5,None),(LWN,6,None)], 0, None),
        (walkin,dt(2025,11,22), [(LHG,2,None),(SAR,1,None)], 0, None),
        (walkin,dt(2025,11,23), [(ANK,2,None),(DUP,2,None)], 0, None),
        (walkin,dt(2025,11,24), [(MSR,1,None),(BLP,2,None)], 0, None),
        (neha,  dt(2025,11,25), [(LHG,1,None),(ANK,1,None),(BLP,2,None)], 0, "Wedding"),
        (walkin,dt(2025,11,26), [(SAR,2,None),(ZBS,1,None)], 0, None),
        (walkin,dt(2025,11,27), [(KUR,5,None),(STO,3,None)], 0, None),
        (walkin,dt(2025,11,28), [(LHG,3,None),(ANK,2,None)], 0, None),
        (walkin,dt(2025,11,29), [(DUP,5,None),(CHA,3,None)], 0, None),
        (walkin,dt(2025,11,30), [(ANK,2,None),(LHG,1,None),(BLP,2,None)], 0, None),
        (delhi, dt(2025,11,10), [(SAR,10,None),(ZBS,8,None),(LHG,12,None),(ANK,10,None)], 7, "Nov wholesale — Diwali/wedding", "PO-DWH-2025-003"),
        (raj,   dt(2025,11,20), [(LHG,12,None),(ANK,10,None),(SAR,6,None)], 5, "Wedding wholesale", "PO-RAJ-2025-004"),
        # ── DECEMBER 2025 ── Wedding season + Christmas ──────────────────
        (walkin,dt(2025,12,1),  [(LHG,2,None),(ANK,2,None),(DUP,3,None)], 0, "Wedding season"),
        (walkin,dt(2025,12,2),  [(SAR,1,None),(BLP,2,None)], 0, None),
        (neha,  dt(2025,12,3),  [(LHG,1,None),(DUP,3,None)], 0, "Wedding bridal"),
        (walkin,dt(2025,12,4),  [(KUR,4,None),(CHA,3,None)], 0, None),
        (walkin,dt(2025,12,5),  [(ANK,3,None),(STO,2,None)], 0, None),
        (sunita,dt(2025,12,6),  [(ZBS,1,None),(BLP,2,None)], 0, None),
        (walkin,dt(2025,12,7),  [(LHG,3,None),(ANK,2,None)], 0, "Wedding"),
        (kavya, dt(2025,12,8),  [(SAR,1,None),(DUP,3,None)], 0, None),
        (walkin,dt(2025,12,9),  [(MSR,2,None),(BLP,3,None)], 0, None),
        (walkin,dt(2025,12,10), [(LHG,2,None),(DUP,4,None)], 0, None),
        (arjun, dt(2025,12,11), [(FAB,4,None),(LWN,5,None)], 0, None),
        (walkin,dt(2025,12,12), [(ANK,3,None),(KUR,3,None)], 0, "Wedding guest wear"),
        (walkin,dt(2025,12,13), [(SAR,1,None),(ZBS,1,None)], 0, None),
        (walkin,dt(2025,12,14), [(LHG,2,None),(BLP,3,None)], 0, None),
        (sunita,dt(2025,12,15), [(MSR,1,None),(STO,1,None)], 0, None),
        (walkin,dt(2025,12,16), [(CHA,3,None),(DUP,3,None)], 0, None),
        (walkin,dt(2025,12,17), [(ANK,2,None),(KUR,4,None)], 0, None),
        (walkin,dt(2025,12,18), [(LHG,3,None),(ANK,1,None)], 0, "Big winter wedding"),
        (neha,  dt(2025,12,19), [(LHG,1,None),(BLP,3,None)], 0, "Bridal"),
        (walkin,dt(2025,12,20), [(SAR,2,None),(DUP,4,None)], 0, None),
        (kavya, dt(2025,12,21), [(ANK,2,None),(CHA,2,None)], 0, None),
        (walkin,dt(2025,12,22), [(KUR,4,None),(STO,2,None)], 0, None),
        (walkin,dt(2025,12,23), [(SAR,1,None),(DUP,3,None)], 0, "Christmas gifts"),
        (walkin,dt(2025,12,24), [(STO,4,None),(DUP,4,None)], 0, "Christmas Eve"),
        (walkin,dt(2025,12,25), [(FAB,3,None),(LWN,4,None)], 0, "Christmas Day"),
        (sunita,dt(2025,12,26), [(MSR,1,None),(BLP,1,None)], 0, None),
        (walkin,dt(2025,12,27), [(LHG,2,None),(ANK,2,None)], 0, None),
        (walkin,dt(2025,12,28), [(KUR,3,None),(DUP,2,None)], 0, None),
        (walkin,dt(2025,12,29), [(SAR,1,None),(ZBS,1,None)], 0, None),
        (arjun, dt(2025,12,30), [(FAB,5,None),(CHA,2,None)], 0, None),
        (walkin,dt(2025,12,31), [(DUP,4,None),(STO,3,None)], 0, "New Year Eve"),
        (mehta, dt(2025,12,5),  [(LHG,18,None),(ANK,14,None),(KUR,20,None)], 5, "December wholesale", "PO-MEH-2025-007"),
        (priya, dt(2025,12,12), [(LHG,14,None),(ANK,10,None),(SAR,5,None)], 5, "Wedding season wholesale", "PO-PRY-2025-004"),
        (delhi, dt(2025,12,8),  [(SAR,8,None),(ZBS,6,None),(MSR,8,None)], 7, "Dec wholesale sarees", "PO-DWH-2025-004"),
        (raj,   dt(2025,12,15), [(LHG,10,None),(ANK,8,None),(FAB,40,None)], 5, "Dec wholesale mixed", "PO-RAJ-2025-005"),
        # ── JANUARY 2026 ── Wedding season PEAK + Makar Sankranti ───────
        (walkin,dt(2026,1,1),  [(DUP,4,None),(STO,3,None)], 0, "New Year"),
        (walkin,dt(2026,1,2),  [(LHG,3,None),(ANK,2,None)], 0, "Wedding season"),
        (neha,  dt(2026,1,3),  [(LHG,1,None),(BLP,3,None)], 0, "Bridal shopping"),
        (walkin,dt(2026,1,4),  [(SAR,2,None),(ZBS,1,None)], 0, None),
        (sunita,dt(2026,1,5),  [(ANK,1,None),(DUP,3,None)], 0, None),
        (walkin,dt(2026,1,5),  [(KUR,4,None),(CHA,2,None)], 0, None),
        (walkin,dt(2026,1,6),  [(LHG,4,None),(ANK,3,None)], 0, "Wedding weekend"),
        (kavya, dt(2026,1,7),  [(SAR,1,None),(DUP,3,None)], 0, "Wedding guest"),
        (walkin,dt(2026,1,7),  [(ANK,3,None),(DUP,4,None)], 0, None),
        (walkin,dt(2026,1,8),  [(LHG,3,None),(BLP,3,None)], 0, None),
        (walkin,dt(2026,1,9),  [(KUR,2,None),(STO,1,None)], 0, None),
        (walkin,dt(2026,1,10), [(MSR,2,None),(DUP,3,None)], 0, None),
        (arjun, dt(2026,1,11), [(FAB,4,None),(LWN,5,None)], 0, None),
        (walkin,dt(2026,1,11), [(ANK,3,None),(KUR,4,None)], 0, "Wedding rush"),
        (walkin,dt(2026,1,12), [(LHG,4,None),(ANK,2,None)], 0, None),
        (neha,  dt(2026,1,12), [(SAR,1,None),(BLP,4,None)], 0, "Pre-wedding"),
        (walkin,dt(2026,1,13), [(KUR,2,None),(DUP,2,None)], 0, "Makar Sankranti prep"),
        (walkin,dt(2026,1,14), [(LHG,3,None),(ANK,2,None),(DUP,3,None)], 0, "Makar Sankranti"),
        (kavya, dt(2026,1,14), [(ZBS,1,None),(BLP,2,None)], 0, "Sankranti"),
        (sunita,dt(2026,1,14), [(MSR,1,None),(DUP,2,None)], 0, "Sankranti"),
        (walkin,dt(2026,1,15), [(SAR,2,None),(ZBS,2,None)], 0, None),
        (walkin,dt(2026,1,16), [(ANK,3,None),(KUR,4,None)], 0, None),
        (walkin,dt(2026,1,17), [(LHG,4,None),(DUP,4,None)], 0, "Wedding weekend peak"),
        (walkin,dt(2026,1,18), [(LHG,3,None),(ANK,2,None)], 0, None),
        (walkin,dt(2026,1,19), [(SAR,1,None),(MSR,1,None),(BLP,3,None)], 0, None),
        (neha,  dt(2026,1,20), [(LHG,1,None),(ANK,1,None)], 0, "Wedding"),
        (walkin,dt(2026,1,20), [(KUR,2,None),(CHA,1,None)], 0, None),
        (walkin,dt(2026,1,21), [(ANK,3,None),(DUP,4,None)], 0, None),
        (walkin,dt(2026,1,22), [(LHG,3,None),(SAR,1,None)], 0, None),
        (walkin,dt(2026,1,23), [(ZBS,2,None),(BLP,3,None)], 0, None),
        (walkin,dt(2026,1,24), [(ANK,1,None),(KUR,2,None)], 0, None),
        (kavya, dt(2026,1,25), [(LHG,1,None),(DUP,3,None)], 0, "Wedding guest"),
        (walkin,dt(2026,1,25), [(MSR,2,None),(STO,2,None)], 0, None),
        (walkin,dt(2026,1,26), [(FAB,4,None),(LWN,5,None)], 0, "Republic Day"),
        (sunita,dt(2026,1,27), [(SAR,1,None),(BLP,2,None)], 0, None),
        (walkin,dt(2026,1,28), [(LHG,4,None),(ANK,3,None)], 0, "Big wedding weekend"),
        (walkin,dt(2026,1,29), [(ANK,2,None),(KUR,2,None)], 0, None),
        (walkin,dt(2026,1,30), [(ZBS,2,None),(DUP,4,None)], 0, None),
        (walkin,dt(2026,1,31), [(SAR,2,None),(MSR,2,None)], 0, None),
        (mehta, dt(2026,1,5),  [(LHG,20,None),(ANK,15,None),(SAR,10,None)], 5, "Jan wholesale — wedding peak", "PO-MEH-2026-001"),
        (priya, dt(2026,1,10), [(LHG,18,None),(ANK,12,None),(DUP,25,None)], 5, "January wedding bulk", "PO-PRY-2026-001"),
        (delhi, dt(2026,1,8),  [(SAR,10,None),(ZBS,8,None),(MSR,10,None),(LHG,8,None)], 7, "Jan wholesale — weddings", "PO-DWH-2026-001"),
        (raj,   dt(2026,1,15), [(LHG,12,None),(ANK,10,None),(KUR,20,None)], 5, "Jan wholesale bulk", "PO-RAJ-2026-001"),
        # ── FEBRUARY 2026 ── Valentine's Day + Weddings ─────────────────
        (walkin,dt(2026,2,1),  [(LHG,2,None),(ANK,2,None),(DUP,3,None)], 0, "Wedding season"),
        (walkin,dt(2026,2,2),  [(KUR,4,None),(CHA,2,None)], 0, None),
        (sunita,dt(2026,2,3),  [(SAR,1,None),(BLP,2,None)], 0, None),
        (walkin,dt(2026,2,4),  [(ANK,3,None),(DUP,4,None)], 0, None),
        (walkin,dt(2026,2,5),  [(LHG,3,None),(SAR,1,None)], 0, None),
        (kavya, dt(2026,2,6),  [(ANK,1,None),(DUP,3,None)], 0, None),
        (walkin,dt(2026,2,7),  [(MSR,2,None),(ZBS,1,None)], 0, None),
        (walkin,dt(2026,2,8),  [(LHG,2,None),(KUR,4,None)], 0, None),
        (arjun, dt(2026,2,9),  [(FAB,5,None),(LWN,6,None)], 0, None),
        (walkin,dt(2026,2,10), [(ANK,3,None),(DUP,4,None)], 0, None),
        (walkin,dt(2026,2,11), [(SAR,1,None),(BLP,3,None)], 0, None),
        (walkin,dt(2026,2,12), [(LHG,3,None),(STO,4,None)], 0, "Valentine's week"),
        (neha,  dt(2026,2,13), [(SAR,1,None),(DUP,3,None)], 0, "Valentine's Day gift"),
        (walkin,dt(2026,2,14), [(STO,6,None),(DUP,5,None)], 0, "Valentine's Day"),
        (walkin,dt(2026,2,14), [(SAR,1,None),(MSR,1,None)], 0, "Valentine's gift"),
        (kavya, dt(2026,2,14), [(STO,2,None),(DUP,2,None)], 0, "Valentine's"),
        (sunita,dt(2026,2,15), [(ANK,1,None),(CHA,2,None)], 0, None),
        (walkin,dt(2026,2,16), [(LHG,2,None),(ANK,2,None)], 0, None),
        (walkin,dt(2026,2,17), [(KUR,5,None),(DUP,3,None)], 0, None),
        (walkin,dt(2026,2,18), [(SAR,1,None),(ZBS,1,None)], 0, None),
        (walkin,dt(2026,2,19), [(LHG,3,None),(BLP,3,None)], 0, None),
        (walkin,dt(2026,2,20), [(MSR,2,None),(DUP,3,None)], 0, None),
        (walkin,dt(2026,2,21), [(ANK,2,None),(KUR,3,None)], 0, None),
        (arjun, dt(2026,2,22), [(FAB,3,None),(CHA,2,None)], 0, None),
        (walkin,dt(2026,2,23), [(LHG,2,None),(ANK,2,None)], 0, "Late wedding season"),
        (walkin,dt(2026,2,24), [(SAR,1,None),(STO,2,None)], 0, None),
        (walkin,dt(2026,2,25), [(ZBS,2,None),(DUP,3,None)], 0, None),
        (walkin,dt(2026,2,26), [(KUR,4,None),(LWN,5,None)], 0, "Maha Shivratri"),
        (sunita,dt(2026,2,27), [(MSR,1,None),(BLP,2,None)], 0, None),
        (walkin,dt(2026,2,28), [(ANK,2,None),(DUP,2,None)], 0, None),
        (mehta, dt(2026,2,3),  [(LHG,15,None),(ANK,12,None),(KUR,18,None)], 5, "Feb wholesale", "PO-MEH-2026-002"),
        (priya, dt(2026,2,12), [(LHG,12,None),(ANK,10,None),(SAR,6,None)], 5, "Valentine's/wedding bulk", "PO-PRY-2026-002"),
        (delhi, dt(2026,2,8),  [(SAR,8,None),(ZBS,6,None),(MSR,8,None)], 7, "Feb wholesale sarees", "PO-DWH-2026-002"),
        # ── MARCH 2026 ── Holi (Mar 14) + Tapering ──────────────────────
        (walkin,dt(2026,3,1),  [(LHG,2,None),(ANK,1,None),(DUP,3,None)], 0, None),
        (walkin,dt(2026,3,2),  [(KUR,4,None),(CHA,2,None)], 0, None),
        (sunita,dt(2026,3,3),  [(MSR,1,None),(BLP,2,None)], 0, None),
        (walkin,dt(2026,3,4),  [(FAB,5,None),(LWN,6,None)], 0, None),
        (walkin,dt(2026,3,5),  [(ANK,2,None),(DUP,3,None)], 0, None),
        (kavya, dt(2026,3,6),  [(SAR,1,None),(DUP,2,None)], 0, None),
        (walkin,dt(2026,3,7),  [(KUR,3,None),(STO,2,None)], 0, None),
        (walkin,dt(2026,3,8),  [(LHG,1,None),(ANK,2,None)], 0, "Women's Day"),
        (sunita,dt(2026,3,8),  [(ZBS,1,None),(BLP,2,None)], 0, "Women's Day"),
        (walkin,dt(2026,3,9),  [(MSR,1,None),(CHA,2,None)], 0, None),
        (walkin,dt(2026,3,10), [(ANK,2,None),(DUP,3,None)], 0, None),
        (walkin,dt(2026,3,11), [(KUR,4,None),(FAB,3,None)], 0, None),
        (walkin,dt(2026,3,12), [(LHG,2,None),(STO,2,None)], 0, "Pre-Holi"),
        (arjun, dt(2026,3,13), [(FAB,5,None),(LWN,6,None)], 0, "Holi prep"),
        (walkin,dt(2026,3,14), [(KUR,2,None),(FAB,3,None),(LWN,4,None)], 0, "Holi festival"),
        (walkin,dt(2026,3,14), [(KUR,2,None),(DUP,2,None)], 0, "Holi"),
        (kavya, dt(2026,3,14), [(KUR,2,None),(FAB,3,None)], 0, "Holi outfits"),
        (sunita,dt(2026,3,15), [(CHA,2,None),(BLP,1,None)], 0, None),
        (walkin,dt(2026,3,15), [(LWN,8,None),(FAB,5,None)], 0, "Post-Holi"),
        (walkin,dt(2026,3,16), [(KUR,3,None),(ANK,1,None)], 0, None),
        (walkin,dt(2026,3,17), [(MSR,1,None),(DUP,2,None)], 0, None),
        (walkin,dt(2026,3,18), [(FAB,4,None),(LWN,5,None)], 0, None),
        (walkin,dt(2026,3,19), [(SAR,1,None),(BLP,2,None)], 0, None),
        (walkin,dt(2026,3,20), [(ANK,2,None),(DUP,2,None)], 0, None),
        (walkin,dt(2026,3,21), [(KUR,3,None),(CHA,2,None)], 0, None),
        (walkin,dt(2026,3,22), [(LHG,1,None),(STO,2,None)], 0, None),
        (arjun, dt(2026,3,23), [(FAB,4,None),(LWN,6,None)], 0, None),
        (walkin,dt(2026,3,24), [(KUR,4,None),(DUP,3,None)], 0, None),
        (walkin,dt(2026,3,25), [(MSR,1,None),(BLP,2,None)], 0, None),
        (walkin,dt(2026,3,26), [(ANK,2,None),(FAB,3,None)], 0, None),
        (walkin,dt(2026,3,27), [(KUR,3,None),(DUP,2,None)], 0, None),
        (sunita,dt(2026,3,28), [(SAR,1,None),(BLP,2,None)], 0, "Today"),
        (walkin,dt(2026,3,28), [(FAB,3,None),(LWN,4,None)], 0, "Today walk-in"),
        (mehta, dt(2026,3,5),  [(LHG,10,None),(ANK,8,None),(KUR,15,None)], 5, "March wholesale", "PO-MEH-2026-003"),
        (raj,   dt(2026,3,10), [(FAB,50,None),(LWN,60,None),(CHA,20,None)], 5, "March summer stock", "PO-RAJ-2026-002"),

        # ══ NEW WHOLESALE CUSTOMERS ══════════════════════════════════════════

        # ── Shekhawati Saree House (net-45, decent payer) ────────────────────
        (shekh,dt(2025,8,20), [(SAR,5,None),(KAN,4,None),(ZBS,3,None)], 5, "August opening order", "PO-SSH-2025-001"),
        (shekh,dt(2025,10,10),[(SAR,8,None),(ZBS,5,None),(TDY,6,None)], 5, "Navratri order", "PO-SSH-2025-002"),
        (shekh,dt(2025,11,15),[(KAN,8,None),(SAR,6,None),(MSR,6,None)], 5, "Wedding season order", "PO-SSH-2025-003"),
        (shekh,dt(2025,12,20),[(ZBS,6,None),(KAN,5,None),(DUP,10,None)],5, "December wholesale", "PO-SSH-2025-004"),
        (shekh,dt(2026,1,15), [(KAN,10,None),(SAR,8,None),(ZBS,5,None)],5, "Wedding peak order", "PO-SSH-2026-001"),
        (shekh,dt(2026,2,5),  [(KAN,6,None),(MSR,5,None),(SBF,10,None)],5, "February order", "PO-SSH-2026-002"),
        (shekh,dt(2026,3,1),  [(SAR,4,None),(ZBS,4,None),(TDY,5,None)], 5, "March order", "PO-SSH-2026-003"),

        # ── Mumbai Fashion Co. (net-60, slow payer) ──────────────────────────
        (mumbai,dt(2025,8,15), [(LHG,5,None),(ANK,6,None),(SAR,3,None)],  7, "Opening order", "PO-MFC-2025-001"),
        (mumbai,dt(2025,10,20),[(LHG,8,None),(ANK,8,None),(KAN,4,None)],  7, "Navratri order", "PO-MFC-2025-002"),
        (mumbai,dt(2025,11,15),[(KAN,6,None),(LHG,10,None),(NET,20,None)], 7, "Diwali/wedding order", "PO-MFC-2025-003"),
        (mumbai,dt(2026,1,15), [(LHG,8,None),(ANK,6,None),(DSB,8,None)],  7, "Jan wedding peak", "PO-MFC-2026-001"),
        (mumbai,dt(2026,2,15), [(KAN,5,None),(LHG,6,None),(NET,15,None)], 7, "February order", "PO-MFC-2026-002"),
        (mumbai,dt(2026,3,10), [(LHG,4,None),(ANK,4,None),(KAN,3,None)],  7, "March order", "PO-MFC-2026-003"),

        # ── Punjab Dress Centre (net-30, good payer) ─────────────────────────
        (punjab,dt(2025,10,5), [(PHU,15,None),(SKS,12,None),(FAB,30,None)],5, "Navratri order", "PO-PDC-2025-001"),
        (punjab,dt(2025,11,10),[(PHU,10,None),(SKS,10,None),(MKP,8,None)], 5, "Wedding season", "PO-PDC-2025-002"),
        (punjab,dt(2025,12,15),[(WLS,10,None),(PHU,8,None),(SKS,10,None)], 5, "Winter wholesale", "PO-PDC-2025-003"),
        (punjab,dt(2026,1,20), [(SKS,15,None),(MKP,12,None),(PHU,10,None)],5, "Wedding peak", "PO-PDC-2026-001"),
        (punjab,dt(2026,2,15), [(PHU,10,None),(SKS,8,None),(WLS,6,None)],  5, "February order", "PO-PDC-2026-002"),
        (punjab,dt(2026,3,5),  [(SKS,12,None),(PHU,8,None),(MKF,20,None)], 5, "March spring order", "PO-PDC-2026-003"),
        (punjab,dt(2026,3,20), [(SKS,8,None),(MKP,6,None),(FAB,20,None)],  5, "Late March order", "PO-PDC-2026-004"),

        # ── South Silk Traders (net-45, medium payer) ────────────────────────
        (south,dt(2025,9,10),  [(KAN,6,None),(MSR,5,None),(SBF,15,None)], 5, "Sep opening order", "PO-SST-2025-001"),
        (south,dt(2025,10,25), [(KAN,8,None),(SAR,6,None),(SBF,12,None)], 5, "Navratri/Dussehra", "PO-SST-2025-002"),
        (south,dt(2025,11,20), [(KAN,10,None),(MSR,8,None),(ZBS,5,None)], 5, "Wedding season", "PO-SST-2025-003"),
        (south,dt(2025,12,22), [(KAN,8,None),(SAR,5,None),(MSR,6,None)],  5, "December order", "PO-SST-2025-004"),
        (south,dt(2026,1,25),  [(KAN,12,None),(ZBS,6,None),(SBF,15,None)],5, "Wedding peak", "PO-SST-2026-001"),
        (south,dt(2026,2,20),  [(KAN,6,None),(MSR,5,None),(SAR,4,None)],  5, "February order", "PO-SST-2026-002"),
        (south,dt(2026,3,15),  [(KAN,4,None),(MSR,3,None),(SBF,10,None)], 5, "March order", "PO-SST-2026-003"),

        # ── Hyderabad Silks Ltd. (net-30, irregular) ─────────────────────────
        (hyd,dt(2025,10,15),   [(KAN,5,None),(ANK,6,None),(MSR,4,None)],  5, "Oct order", "PO-HYD-2025-001"),
        (hyd,dt(2025,11,25),   [(KAN,8,None),(LHG,6,None),(NET,15,None)], 5, "Diwali/wedding order", "PO-HYD-2025-002"),
        (hyd,dt(2026,1,20),    [(KAN,8,None),(ANK,8,None),(ZBS,4,None)],  5, "Wedding peak", "PO-HYD-2026-001"),
        (hyd,dt(2026,2,25),    [(KAN,5,None),(MSR,4,None),(NET,12,None)], 5, "February order", "PO-HYD-2026-002"),
        (hyd,dt(2026,3,8),     [(ANK,4,None),(KAN,3,None),(LHG,3,None)],  5, "March order 1", "PO-HYD-2026-003"),
        (hyd,dt(2026,3,22),    [(KAN,4,None),(NET,10,None),(MSR,3,None)], 5, "March order 2", "PO-HYD-2026-004"),

        # ── Kolkata Textile Hub (net-30, decent payer) ───────────────────────
        (kolkata,dt(2025,11,10),[(BAN,20,None),(FAB,40,None),(POL,30,None)],5,"Nov opening order","PO-KTH-2025-001"),
        (kolkata,dt(2026,1,12), [(BAN,15,None),(TDY,10,None),(POL,25,None)],5,"Jan order","PO-KTH-2026-001"),
        (kolkata,dt(2026,2,18), [(BAN,12,None),(FAB,30,None),(TDY,8,None)], 5,"Feb order","PO-KTH-2026-002"),
        (kolkata,dt(2026,3,18), [(BAN,10,None),(POL,20,None),(TDY,6,None)], 5,"March order","PO-KTH-2026-003"),

        # ══ NEW RETAIL CUSTOMERS ═════════════════════════════════════════════

        # ── Priyanka Joshi ───────────────────────────────────────────────────
        (priyanka,dt(2025,8,10),  [(SKS,1,None),(DUP,1,None)], 0, None),
        (priyanka,dt(2025,9,15),  [(BAN,2,None),(KUR,1,None)], 0, "Navratri shopping"),
        (priyanka,dt(2025,10,3),  [(SKS,1,None),(BAN,2,None)], 0, "Navratri"),
        (priyanka,dt(2025,11,2),  [(ANK,1,None),(DUP,2,None)], 0, "Diwali"),
        (priyanka,dt(2025,12,10), [(SKS,1,None),(CHA,2,None)], 0, "Wedding season"),
        (priyanka,dt(2026,1,20),  [(SKS,1,None),(BAN,2,None)], 0, "Wedding guest outfit"),
        (priyanka,dt(2026,2,14),  [(DUP,2,None),(STO,1,None)], 0, "Valentine's Day"),
        (priyanka,dt(2026,3,8),   [(KUR,1,None),(BAN,2,None)], 0, "Women's Day"),

        # ── Ravi Kumar ───────────────────────────────────────────────────────
        (ravi,dt(2025,8,5),   [(MKF,3,None),(LWN,4,None)], 0, "Fabric for tailoring"),
        (ravi,dt(2025,9,20),  [(MKF,4,None),(LWN,5,None)], 0, None),
        (ravi,dt(2025,10,20), [(MKP,1,None),(MKF,3,None)], 0, "Dussehra kurta"),
        (ravi,dt(2025,11,1),  [(MKP,1,None),(STO,2,None)], 0, "Diwali gifts"),
        (ravi,dt(2025,12,25), [(MKF,2,None),(LWN,3,None)], 0, "Christmas gifts"),
        (ravi,dt(2026,1,14),  [(MKP,1,None),(MKF,2,None)], 0, "Makar Sankranti kurta"),
        (ravi,dt(2026,2,9),   [(MKF,3,None),(LWN,4,None)], 0, None),
        (ravi,dt(2026,3,14),  [(MKF,3,None),(LWN,5,None)], 0, "Holi fabric"),

        # ── Meera Agarwal (bridal) ───────────────────────────────────────────
        (meera,dt(2025,9,5),   [(KAN,1,None),(DSB,1,None)],         0, "Bridal shopping begins"),
        (meera,dt(2025,10,15), [(LHG,1,None),(DSB,2,None),(DUP,3,None)], 0, "Bridal trousseau"),
        (meera,dt(2025,11,3),  [(KAN,1,None),(SAR,1,None),(BLP,2,None)],  0, "Trousseau — sarees"),
        (meera,dt(2025,12,1),  [(SAR,1,None),(ZBS,1,None),(DSB,1,None)],  0, "Pre-wedding picks"),
        (meera,dt(2026,1,10),  [(KAN,1,None),(LHG,1,None),(DUP,2,None)],  0, "Wedding week purchase"),
        (meera,dt(2026,2,20),  [(MSR,1,None),(BLP,2,None)],         0, "Post-wedding"),

        # ── Pooja Singh (festival buyer) ─────────────────────────────────────
        (pooja,dt(2025,8,19),  [(BAN,2,None),(DUP,1,None)], 0, "Raksha Bandhan"),
        (pooja,dt(2025,9,6),   [(ANK,1,None),(BAN,2,None)], 0, "Navratri prep"),
        (pooja,dt(2025,10,2),  [(SKS,1,None),(BAN,2,None)], 0, "Navratri Day 1"),
        (pooja,dt(2025,11,1),  [(ANK,1,None),(DUP,2,None)], 0, "Diwali"),
        (pooja,dt(2025,11,3),  [(BAN,3,None),(STO,1,None)], 0, "Bhai Dooj"),
        (pooja,dt(2025,12,15), [(SKS,1,None),(CHA,2,None)], 0, "Winter wedding"),
        (pooja,dt(2026,1,14),  [(SKS,1,None),(BAN,2,None)], 0, "Makar Sankranti"),
        (pooja,dt(2026,2,14),  [(DUP,2,None),(STO,1,None)], 0, "Valentine's"),
        (pooja,dt(2026,3,14),  [(KUR,2,None),(BAN,2,None)], 0, "Holi"),
    ]

    for batch in invoice_batches:
        cust, date, lines, disc, note = batch[:5]
        po = batch[5] if len(batch) > 5 else None
        inv = make_invoice(db, cust, date, lines, disc, note, po_number=po)
        all_invoices.append(inv)

    db.flush()
    print(f"      -> {len(all_invoices)} invoices created")

    # ── RETURNS ────────────────────────────────────────────────────────────────
    print("  [6b] Returns...")

    def add_return(
        receipt_kwargs: dict,
        line_items: list,
    ):
        """Create a ReturnReceiptModel and its ReturnLineItemModel records."""
        receipt = ReturnReceiptModel(**receipt_kwargs)
        db.add(receipt)
        db.flush()  # Resolve receipt.id before referencing in line items
        for li_kwargs in line_items:
            db.add(ReturnLineItemModel(return_receipt_id=receipt.id, **li_kwargs))

    # ── Return 1: Kavya — damaged dupatta, Aug ──────────────────────────────
    r1 = next((i for i in all_invoices if i.customer_id == kavya.id
               and i.invoice_date.month == 8), None)
    if r1:
        add_return(
            receipt_kwargs=dict(
                invoice_id=r1.id, return_date=datetime(2025, 8, 22, 11, 0),
                total_credit=750.0,
                notes="Customer reported a torn hem on the georgette dupatta. "
                      "Defect visible at seam — manufacturing fault. Full credit issued.",
                is_partial=True, total_items_in_invoice=2, items_returned_count=1,
                created_at=datetime(2025, 8, 22),
            ),
            line_items=[dict(
                item_id=_items[DUP].id, quantity_returned=1, amount=750.0,
                reason="Torn hem at seam — manufacturing defect noticed after unboxing",
                reason_category=ReturnReasonCategory.DAMAGED,
            )],
        )

    # ── Return 2: Mehta Boutique — wrong colour lehenga, Oct ───────────────
    r2 = next((i for i in all_invoices if i.customer_id == mehta.id
               and i.invoice_date.month == 10), None)
    if r2:
        credit_r2 = round(4 * 3100.0 * 0.95, 2)  # 4 lehengas at WS price, 5% disc
        add_return(
            receipt_kwargs=dict(
                invoice_id=r2.id, return_date=datetime(2025, 10, 20, 10, 0),
                total_credit=credit_r2,
                notes="Colour mismatch — order was wine red, received dark maroon. "
                      "4 lehenga pieces returned. Credit applied against next order.",
                is_partial=True, total_items_in_invoice=3, items_returned_count=1,
                created_at=datetime(2025, 10, 20),
            ),
            line_items=[dict(
                item_id=_items[LHG].id, quantity_returned=4, amount=credit_r2,
                reason="Wrong colour dispatched — wine red ordered, dark maroon received",
                reason_category=ReturnReasonCategory.WRONG_ITEM,
            )],
        )

    # ── Return 3: Neha Gupta — full return, quality complaint, Nov ──────────
    # Neha's first Nov invoice: SAR×2, BLP×3 ("Diwali celebration")
    r3 = next((i for i in all_invoices if i.customer_id == neha.id
               and i.invoice_date.month == 11), None)
    if r3:
        add_return(
            receipt_kwargs=dict(
                invoice_id=r3.id, return_date=datetime(2025, 11, 14, 15, 0),
                total_credit=r3.grand_total,
                notes="Customer returned full order. Complained of colour bleeding on Banarasi "
                      "Silk Sarees and loose embroidery threads on blouse pieces. Full credit granted.",
                is_partial=False, total_items_in_invoice=2, items_returned_count=2,
                created_at=datetime(2025, 11, 14),
            ),
            line_items=[
                dict(
                    item_id=_items[SAR].id, quantity_returned=2, amount=11000.0,
                    reason="Colour bleeding reported after first dry-clean — fabric quality issue",
                    reason_category=ReturnReasonCategory.QUALITY_ISSUE,
                ),
                dict(
                    item_id=_items[BLP].id, quantity_returned=3,
                    amount=round(r3.grand_total - 11000.0, 2),
                    reason="Loose embroidery threads — stitching not up to standard",
                    reason_category=ReturnReasonCategory.QUALITY_ISSUE,
                ),
            ],
        )

    # ── Return 4: Delhi Wholesale Hub — post-Diwali excess, Dec ────────────
    r4 = next((i for i in all_invoices if i.customer_id == delhi.id
               and i.invoice_date.month == 11), None)
    if r4:
        credit_r4 = round(4 * 2900.0 * 0.93, 2)  # 4 ZBS at WS price with 7% disc
        add_return(
            receipt_kwargs=dict(
                invoice_id=r4.id, return_date=datetime(2025, 12, 10, 11, 0),
                total_credit=credit_r4,
                notes="Post-Diwali season stock return. Zari border sarees could not be sold "
                      "in time. Partial return — 4 pieces from batch of 8.",
                is_partial=True, total_items_in_invoice=4, items_returned_count=1,
                created_at=datetime(2025, 12, 10),
            ),
            line_items=[dict(
                item_id=_items[ZBS].id, quantity_returned=4, amount=credit_r4,
                reason="Could not sell remaining stock post-Diwali season — returning excess",
                reason_category=ReturnReasonCategory.UNABLE_TO_SELL,
            )],
        )

    # ── Return 5: Walk-in — defective silk stole, Jan ───────────────────────
    # Walk-in's first Jan 2026 invoice (day <= 6): DUP×4, STO×3 ("New Year")
    r5 = next((i for i in all_invoices if i.customer_id == walkin.id
               and i.invoice_date.month == 1 and i.invoice_date.year == 2026
               and i.invoice_date.day <= 6), None)
    if r5:
        add_return(
            receipt_kwargs=dict(
                invoice_id=r5.id, return_date=datetime(2026, 1, 9, 14, 0),
                total_credit=980.0,
                notes="Customer found loose threads along the border of a silk stole. "
                      "Defect confirmed — manufacturing fault. Full credit for 1 stole issued.",
                is_partial=True, total_items_in_invoice=2, items_returned_count=1,
                created_at=datetime(2026, 1, 9),
            ),
            line_items=[dict(
                item_id=_items[STO].id, quantity_returned=1, amount=980.0,
                reason="Loose threads along border — manufacturing defect noticed after gift unwrapping",
                reason_category=ReturnReasonCategory.DAMAGED,
            )],
        )

    # ── Return 6: Priya Fashion House — unable to sell anarkalis, Dec ───────
    r6 = next((i for i in all_invoices if i.customer_id == priya.id
               and i.invoice_date.month == 12), None)
    if r6:
        credit_r6 = round(3 * 1600.0 * 0.95, 2)  # 3 ANK at WS price with 5% disc
        add_return(
            receipt_kwargs=dict(
                invoice_id=r6.id, return_date=datetime(2025, 12, 28, 10, 0),
                total_credit=credit_r6,
                notes="Post-wedding-season return. 3 anarkali suits unsold — style did not "
                      "match local market preference. Deducted from Jan 2026 order.",
                is_partial=True, total_items_in_invoice=3, items_returned_count=1,
                created_at=datetime(2025, 12, 28),
            ),
            line_items=[dict(
                item_id=_items[ANK].id, quantity_returned=3, amount=credit_r6,
                reason="Style not matching local demand — could not sell post-season",
                reason_category=ReturnReasonCategory.UNABLE_TO_SELL,
            )],
        )

    # ── Return 7: Rajasthan Traders — fabric damaged in transit, Oct ────────
    r7 = next((i for i in all_invoices if i.customer_id == raj.id
               and i.invoice_date.month == 9), None)
    if r7:
        credit_r7 = round(10 * 265.0 * 0.95, 2)  # 10m FAB at WS price with 5% disc
        add_return(
            receipt_kwargs=dict(
                invoice_id=r7.id, return_date=datetime(2025, 10, 5, 11, 30),
                total_credit=credit_r7,
                notes="10 metres of cotton block print fabric reported water-damaged "
                      "on arrival. Courier damage confirmed. Credit issued, claim raised with transport.",
                is_partial=True, total_items_in_invoice=2, items_returned_count=1,
                created_at=datetime(2025, 10, 5),
            ),
            line_items=[dict(
                item_id=_items[FAB].id, quantity_returned=10, amount=credit_r7,
                reason="Water damage in transit — fabric unusable on delivery",
                reason_category=ReturnReasonCategory.DAMAGED,
            )],
        )

    # ── Return 8: Sunita Sharma — colour fading zari saree, Nov ────────────
    # Sunita's Nov 1 invoice (day 1–10): ZBS×1, DUP×3 ("Diwali purchase")
    r8 = next((i for i in all_invoices if i.customer_id == sunita.id
               and i.invoice_date.month == 11 and i.invoice_date.day >= 1
               and i.invoice_date.day <= 10), None)
    if r8:
        add_return(
            receipt_kwargs=dict(
                invoice_id=r8.id, return_date=datetime(2025, 11, 18, 16, 30),
                total_credit=2800.0,
                notes="Customer complained of colour fading on the zari border saree after first wash. "
                      "Zari border tarnished — quality issue. Partial credit issued after inspection.",
                is_partial=True, total_items_in_invoice=2, items_returned_count=1,
                created_at=datetime(2025, 11, 18),
            ),
            line_items=[dict(
                item_id=_items[ZBS].id, quantity_returned=1, amount=2800.0,
                reason="Colour fading and zari tarnish after first hand wash — fabric quality complaint",
                reason_category=ReturnReasonCategory.QUALITY_ISSUE,
            )],
        )

    # ── PAYMENTS for wholesale invoices ────────────────────────────────────────
    print("  [7/7] Wholesale payments...")

    TODAY = datetime(2026, 3, 28)

    def cap_date(d: datetime) -> datetime:
        """Ensure payment dates never fall after today."""
        return min(d, TODAY - timedelta(days=1))

    def fifo_pay(customer, date, amount, method="cash", ref=None, notes=None):
        """
        Record a bulk payment for `customer`, allocating via FIFO (oldest
        outstanding invoice first).  If the payment exceeds the oldest
        invoice's balance the remainder spills to the next-oldest, and so on.
        """
        outstanding = sorted(
            [i for i in all_invoices
             if i.customer_id == customer.id
             and i.invoice_date.date() <= date.date()
             and round(i.grand_total - i.amount_paid, 2) > 0.01],
            key=lambda x: x.invoice_date,
        )
        payment = PaymentModel(
            customer_id=customer.id,
            date=date,
            amount=round(amount, 2),
            payment_method=method,
            reference_number=ref,
            credit_balance=0.0,
            notes=notes,
            created_at=date,
        )
        db.add(payment)
        db.flush()
        remaining = round(amount, 2)
        for inv in outstanding:
            if remaining < 0.01:
                break
            due = round(inv.grand_total - inv.amount_paid, 2)
            alloc = round(min(due, remaining), 2)
            db.add(PaymentAllocationModel(
                payment_id=payment.id,
                invoice_id=inv.id,
                allocated_amount=alloc,
                created_at=date,
            ))
            inv.amount_paid = round(inv.amount_paid + alloc, 2)
            remaining = round(remaining - alloc, 2)
            if inv.amount_paid >= inv.grand_total - 0.01:
                inv.payment_status = PaymentStatus.PAID
            else:
                inv.payment_status = PaymentStatus.PARTIALLY_PAID
        if remaining > 0.01:
            payment.credit_balance = round(remaining, 2)
        return payment

    # ── WHOLESALE PAYMENT HISTORY — FIFO BULK PAYMENTS ───────────────────────
    # Each customer makes periodic lump-sum payments.  fifo_pay() allocates
    # each payment to the oldest outstanding invoice first; any remainder
    # spills into the next-oldest, and so on (exactly like the live app does).
    # This produces realistic ledger history: old invoices get cleared
    # sequentially, leaving one "frontier" invoice partially paid and
    # the newest invoices unpaid.
    #
    # 54 total payment records across 10 wholesale customers.
    # Expected final distribution: ~39 PAID, ~10 PARTIALLY_PAID, ~18 UNPAID.

    # ── Mehta Boutique — net-30.  7 payments (Sep–Mar). ─────────────────────
    # Clears Jul→Nov in full; Dec ends up partially paid; Jan–Mar unpaid.
    fifo_pay(mehta, datetime(2025,  9,  5), 28_000, "cash",
             notes="Cash settlement — Jul/Aug invoices")
    fifo_pay(mehta, datetime(2025, 10,  8), 30_000, "bank_transfer",
             ref="NEFT-MEH-20251008", notes="October NEFT payment")
    fifo_pay(mehta, datetime(2025, 11,  8), 55_000, "bank_transfer",
             ref="NEFT-MEH-20251108", notes="November NEFT — clearing Sep invoice")
    fifo_pay(mehta, datetime(2025, 12,  8), 60_000, "bank_transfer",
             ref="NEFT-MEH-20251208", notes="December partial NEFT")
    fifo_pay(mehta, datetime(2026,  1,  8), 70_000, "bank_transfer",
             ref="NEFT-MEH-20260108", notes="January NEFT — clearing Oct invoice")
    fifo_pay(mehta, datetime(2026,  2,  8), 65_000, "bank_transfer",
             ref="NEFT-MEH-20260208", notes="February NEFT — clearing Nov invoice")
    fifo_pay(mehta, datetime(2026,  3,  8), 50_000, "bank_transfer",
             ref="NEFT-MEH-20260308", notes="March partial payment — Dec invoice pending")

    # ── Priya Fashion House — net-45.  5 payments (Oct–Feb). ────────────────
    # Clears Sep→Nov in full; Dec ends partially paid; Jan–Feb unpaid.
    fifo_pay(priya, datetime(2025, 10, 28), 55_000, "cheque",
             ref=f"CHQ-PRY-{random.randint(100000,999999)}", notes="Cheque — Sep invoice cleared")
    fifo_pay(priya, datetime(2025, 12,  1), 65_000, "cheque",
             ref=f"CHQ-PRY-{random.randint(100000,999999)}", notes="Cheque — Oct invoice cleared")
    fifo_pay(priya, datetime(2025, 12, 28), 50_000, "bank_transfer",
             ref="NEFT-PRY-20251228", notes="Partial — Nov invoice, balance pending")
    fifo_pay(priya, datetime(2026,  1, 25), 55_000, "bank_transfer",
             ref="NEFT-PRY-20260125", notes="NEFT — Nov cleared, Dec invoice partial")
    fifo_pay(priya, datetime(2026,  2, 25), 35_000, "cheque",
             ref=f"CHQ-PRY-{random.randint(100000,999999)}", notes="Partial cheque — Dec balance outstanding")

    # ── Delhi Wholesale Hub — net-60, slow payer.  5 payments (Dec–Mar). ────
    # Clears Sep→Nov in full; Dec ends partially paid; Jan–Feb unpaid.
    fifo_pay(delhi, datetime(2025, 12,  1), 70_000, "bank_transfer",
             ref=f"IMPS-DWH-{random.randint(100000,999999)}", notes="IMPS — Sep cleared, Oct partial")
    fifo_pay(delhi, datetime(2026,  1, 15), 80_000, "bank_transfer",
             ref=f"IMPS-DWH-{random.randint(100000,999999)}", notes="IMPS — Oct cleared, Nov partial")
    fifo_pay(delhi, datetime(2026,  2, 15), 75_000, "bank_transfer",
             ref=f"IMPS-DWH-{random.randint(100000,999999)}", notes="Partial — Nov outstanding, follow-up sent")
    fifo_pay(delhi, datetime(2026,  3, 10), 50_000, "bank_transfer",
             ref=f"IMPS-DWH-{random.randint(100000,999999)}", notes="IMPS — Nov cleared, Dec partial")
    fifo_pay(delhi, datetime(2026,  3, 25), 15_000, "bank_transfer",
             ref=f"IMPS-DWH-{random.randint(100000,999999)}", notes="Partial top-up — Dec balance pending")

    # ── Rajasthan Traders — net-30, reliable.  6 payments (Sep–Mar). ────────
    # Clears Jul→Dec in full; Jan partially paid; Mar unpaid.
    fifo_pay(raj, datetime(2025,  9, 10), 35_000, "cash",
             notes="Cash — Jul/Aug/Sep invoices cleared")
    fifo_pay(raj, datetime(2025, 10, 25), 55_000, "cash",
             notes="Cash — Sep cleared, Oct partial")
    fifo_pay(raj, datetime(2025, 12,  5), 75_000, "cash",
             notes="Cash — Oct cleared, Nov partial")
    fifo_pay(raj, datetime(2026,  1,  5), 65_000, "bank_transfer",
             ref="NEFT-RAJ-20260105", notes="NEFT — Nov cleared, Dec partial")
    fifo_pay(raj, datetime(2026,  2,  5), 55_000, "bank_transfer",
             ref="NEFT-RAJ-20260205", notes="NEFT — Dec cleared, Jan partial")
    fifo_pay(raj, datetime(2026,  3,  5), 30_000, "cash",
             notes="Partial cash — Jan balance outstanding, Mar unpaid")

    # ── Shekhawati Saree House — net-45.  6 payments (Oct–Mar). ─────────────
    # Clears Aug→Jan in full; Feb partially paid; Mar unpaid.
    fifo_pay(shekh, datetime(2025, 10,  5), 65_000, "bank_transfer",
             ref="NEFT-SSH-20251005", notes="NEFT — Aug cleared, Oct partial")
    fifo_pay(shekh, datetime(2025, 11, 25), 80_000, "bank_transfer",
             ref="NEFT-SSH-20251125", notes="NEFT — Oct cleared, Nov partial")
    fifo_pay(shekh, datetime(2026,  1,  5), 95_000, "bank_transfer",
             ref="NEFT-SSH-20260105", notes="NEFT — Nov cleared, Dec partial")
    fifo_pay(shekh, datetime(2026,  1, 30), 65_000, "bank_transfer",
             ref="NEFT-SSH-20260130", notes="NEFT — Dec cleared, Jan partial")
    fifo_pay(shekh, datetime(2026,  2, 25), 80_000, "bank_transfer",
             ref="NEFT-SSH-20260225", notes="NEFT — Jan partially covered")
    fifo_pay(shekh, datetime(2026,  3, 20), 25_000, "bank_transfer",
             ref="NEFT-SSH-20260320", notes="Partial — Jan cleared, Feb partial; Mar unpaid")

    # ── Mumbai Fashion Co. — net-60, slow payer.  5 payments (Dec–Mar). ─────
    # Clears Aug→Jan in full; Feb partially paid; Mar unpaid.
    fifo_pay(mumbai, datetime(2025, 12, 10), 70_000, "bank_transfer",
             ref=f"IMPS-MFC-{random.randint(100000,999999)}", notes="IMPS — Aug cleared, Oct partial")
    fifo_pay(mumbai, datetime(2026,  1, 20), 75_000, "bank_transfer",
             ref=f"IMPS-MFC-{random.randint(100000,999999)}", notes="IMPS — Oct cleared, Nov partial")
    fifo_pay(mumbai, datetime(2026,  2, 20), 70_000, "bank_transfer",
             ref=f"IMPS-MFC-{random.randint(100000,999999)}", notes="IMPS — Nov cleared, Jan partial")
    fifo_pay(mumbai, datetime(2026,  3,  5), 50_000, "bank_transfer",
             ref=f"IMPS-MFC-{random.randint(100000,999999)}", notes="IMPS — Jan cleared, Feb partial")
    fifo_pay(mumbai, datetime(2026,  3, 20), 20_000, "bank_transfer",
             ref=f"IMPS-MFC-{random.randint(100000,999999)}", notes="Partial top-up — Feb balance pending")

    # ── Punjab Dress Centre — net-30.  6 payments (Nov–Mar). ────────────────
    # Clears Oct→Jan in full; Feb partially paid; Mar×2 unpaid.
    fifo_pay(punjab, datetime(2025, 11,  5), 35_000, "bank_transfer",
             ref="NEFT-PDC-20251105", notes="NEFT — Oct cleared, Nov partial")
    fifo_pay(punjab, datetime(2025, 12,  5), 28_000, "bank_transfer",
             ref="NEFT-PDC-20251205", notes="NEFT — Nov cleared, Dec partial")
    fifo_pay(punjab, datetime(2026,  1, 10), 32_000, "bank_transfer",
             ref="NEFT-PDC-20260110", notes="NEFT — Dec cleared, Jan partial")
    fifo_pay(punjab, datetime(2026,  2, 10), 33_000, "bank_transfer",
             ref="NEFT-PDC-20260210", notes="Partial — Jan outstanding")
    fifo_pay(punjab, datetime(2026,  2, 28),  1_000, "bank_transfer",
             ref="NEFT-PDC-20260228", notes="Top-up — Jan cleared, Feb partial")
    fifo_pay(punjab, datetime(2026,  3, 10), 15_000, "bank_transfer",
             ref="NEFT-PDC-20260310", notes="Partial — Feb balance pending; Mar unpaid")

    # ── South Silk Traders — net-45.  6 payments (Nov–Mar). ─────────────────
    # Clears Sep→Dec in full; Jan partially paid; Feb–Mar unpaid.
    fifo_pay(south, datetime(2025, 11, 10),  70_000, "cheque",
             ref=f"CHQ-SST-{random.randint(100000,999999)}", notes="Cheque — Sep cleared, Oct partial")
    fifo_pay(south, datetime(2025, 12, 20), 100_000, "cheque",
             ref=f"CHQ-SST-{random.randint(100000,999999)}", notes="Cheque — Oct cleared, Nov partial")
    fifo_pay(south, datetime(2026,  1, 25), 110_000, "cheque",
             ref=f"CHQ-SST-{random.randint(100000,999999)}", notes="Cheque — Nov cleared, Dec partial")
    fifo_pay(south, datetime(2026,  2, 25),  95_000, "bank_transfer",
             ref="NEFT-SST-20260225", notes="NEFT — Dec cleared, Jan partial")
    fifo_pay(south, datetime(2026,  3, 10),  70_000, "bank_transfer",
             ref="NEFT-SST-20260310", notes="Partial NEFT — Jan balance large")
    fifo_pay(south, datetime(2026,  3, 22),  30_000, "bank_transfer",
             ref="NEFT-SST-20260322", notes="Partial — Jan still outstanding; Feb/Mar unpaid")

    # ── Hyderabad Silks Ltd. — net-30, irregular.  5 payments (Dec–Mar). ────
    # Clears Oct→Feb in full; Mar×2 unpaid.
    fifo_pay(hyd, datetime(2025, 12,  1), 60_000, "bank_transfer",
             ref="NEFT-HYD-20251201", notes="NEFT — Oct cleared, Nov partial")
    fifo_pay(hyd, datetime(2026,  1,  5), 80_000, "bank_transfer",
             ref="NEFT-HYD-20260105", notes="NEFT — Nov cleared, Jan partial")
    fifo_pay(hyd, datetime(2026,  2,  5), 85_000, "bank_transfer",
             ref="NEFT-HYD-20260205", notes="NEFT — Jan partially covered")
    fifo_pay(hyd, datetime(2026,  3,  5), 45_000, "bank_transfer",
             ref="NEFT-HYD-20260305", notes="NEFT — Jan cleared, Feb partial")
    fifo_pay(hyd, datetime(2026,  3, 20),  3_000, "bank_transfer",
             ref="NEFT-HYD-20260320", notes="Partial — Feb almost cleared; Mar unpaid")

    # ── Kolkata Textile Hub — net-30.  3 payments (Dec–Mar). ────────────────
    # Clears Nov in full; Jan partially paid; Feb–Mar unpaid.
    fifo_pay(kolkata, datetime(2025, 12, 15), 28_000, "cash",
             notes="Cash — Nov cleared, Jan partial")
    fifo_pay(kolkata, datetime(2026,  1, 28),  8_000, "cash",
             notes="Partial cash — Jan partially settled")
    fifo_pay(kolkata, datetime(2026,  3,  5), 10_000, "cash",
             notes="Partial cash — Jan outstanding; Feb/Mar unpaid")

    db.flush()

    # ── Invoice sequences ──────────────────────────────────────────────────────
    for year_str, seq in inv_seq.items():
        if seq > 0:
            db.add(InvoiceSequenceModel(year=int(year_str), next_number=seq + 1))
    db.flush()

    print(f"\n  Summary:")
    print(f"     Customers : {len(RAW_CUSTOMERS)}")
    print(f"     Suppliers : {len(RAW_SUPPLIERS)}")
    print(f"     Items     : {len(RAW_ITEMS)}")
    print(f"     Invoices  : {len(all_invoices)}")


def run():
    print("Starting RetailPilot seed...\n")
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    try:
        _seed(db)
        db.commit()
        print("\nSeeding complete!")
    except Exception as e:
        db.rollback()
        print(f"\nError: {e}")
        import traceback; traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
