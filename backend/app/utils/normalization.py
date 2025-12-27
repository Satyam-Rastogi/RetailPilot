def normalize_customer_input(data: dict) -> dict:
  normalized = data.copy()
  
  if not normalized.get('phone_number'):
    normalized['phone_number'] = 'N/A'
  
  if not normalized.get('address'):
    normalized['address'] = 'N/A'
  
  if not normalized.get('gstin'):
    normalized['gstin'] = 'N/A'
  
  if not normalized.get('customer_type'):
    normalized['customer_type'] = 'Retail'
  
  return normalized
