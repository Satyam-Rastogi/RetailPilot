from typing import List, Optional
from datetime import datetime


class InvoiceCalculationService:

   @staticmethod
   def calculate_line_total(quantity: int, price: float,
                           discount_amount: Optional[float] = None,
                           discount_type: Optional[str] = None) -> float:
     line_total = quantity * price

     if discount_type == 'percent' and discount_amount is not None:
       line_total -= line_total * (discount_amount / 100)

     if discount_type == 'amount' and discount_amount is not None:
       line_total -= discount_amount

     return max(0, line_total)

   @staticmethod
   def calculate_invoice_totals(
     line_items: List[dict],
     discount_type: Optional[str] = None,
     discount_amount: Optional[float] = None,
     tax_rate: float = 0.0
   ) -> dict:
     sub_total = 0.0
     calculated_line_items = []

     for item in line_items:
       line_total = InvoiceCalculationService.calculate_line_total(
         quantity=item['quantity'],
         price=item['price'],
         discount_amount=item.get('discount_amount'),
         discount_type=item.get('discount_type', 'amount')
       )
       calculated_line_items.append({**item, 'line_total': line_total})
       sub_total += line_total

     bill_discount_value = 0.0
     if discount_type == 'percent' and discount_amount is not None:
       bill_discount_value = sub_total * (discount_amount / 100)
     elif discount_type == 'amount' and discount_amount is not None:
       bill_discount_value = discount_amount

     pre_tax_total = max(0, sub_total - bill_discount_value)
     tax_amount = pre_tax_total * (tax_rate / 100)
     grand_total = pre_tax_total + tax_amount

     return {
       'line_items': calculated_line_items,
       'sub_total': round(sub_total, 2),
       'discount_amount': round(bill_discount_value, 2),
       'pre_tax_total': round(pre_tax_total, 2),
       'tax_amount': round(tax_amount, 2),
       'grand_total': round(grand_total, 2)
     }


