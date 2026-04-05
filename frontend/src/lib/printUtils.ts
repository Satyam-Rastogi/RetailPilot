// ── Indian currency amount-in-words ──────────────────────────────────────────

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen']

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function wordsUnder100(n: number): string {
  if (n < 20) return ONES[n]
  return (TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '')).trim()
}

function wordsUnder1000(n: number): string {
  if (n < 100) return wordsUnder100(n)
  return ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + wordsUnder100(n % 100) : '')
}

/** Converts a non-negative integer (rupees only) to Indian words */
function rupeesToWords(n: number): string {
  if (n === 0) return 'Zero'
  const crore = Math.floor(n / 1_00_00_000)
  const lakh  = Math.floor((n % 1_00_00_000) / 1_00_000)
  const thou  = Math.floor((n % 1_00_000) / 1_000)
  const hund  = n % 1_000

  const parts: string[] = []
  if (crore) parts.push(wordsUnder1000(crore) + ' Crore')
  if (lakh)  parts.push(wordsUnder100(lakh)   + ' Lakh')
  if (thou)  parts.push(wordsUnder1000(thou)  + ' Thousand')
  if (hund)  parts.push(wordsUnder1000(hund))

  return parts.join(' ')
}

/**
 * Converts a rupee amount (with paise) to Indian words.
 * E.g. 1234.50 → "One Thousand Two Hundred Thirty Four Rupees and Fifty Paise Only"
 */
export function amountInWords(amount: number): string {
  const rupees = Math.floor(amount)
  const paise  = Math.round((amount - rupees) * 100)
  let result = rupeesToWords(rupees) + ' Rupees'
  if (paise > 0) result += ' and ' + wordsUnder100(paise) + ' Paise'
  return result + ' Only'
}


// ── GSTIN state code helpers ─────────────────────────────────────────────────

/** Returns the 2-digit state code from a GSTIN, or null if not a valid GSTIN. */
export function stateCodeFromGSTIN(gstin: string | null | undefined): string | null {
  if (!gstin || gstin.length < 2) return null
  const code = gstin.slice(0, 2)
  return /^\d{2}$/.test(code) ? code : null
}

/**
 * Returns true if seller and buyer are in different states (→ IGST applies).
 * Falls back to false (intra-state / CGST+SGST) when either GSTIN is missing.
 */
export function isInterStateTx(
  sellerGSTIN: string | null | undefined,
  buyerGSTIN:  string | null | undefined,
): boolean {
  const s = stateCodeFromGSTIN(sellerGSTIN)
  const b = stateCodeFromGSTIN(buyerGSTIN)
  if (!s || !b) return false   // can't determine → assume intra-state
  return s !== b
}

// ── Indian GST state code directory ─────────────────────────────────────────

const STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
  '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
  '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam',
  '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha',
  '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '25': 'Daman & Diu', '26': 'Dadra & Nagar Haveli', '27': 'Maharashtra',
  '28': 'Andhra Pradesh (old)', '29': 'Karnataka', '30': 'Goa',
  '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu',
  '34': 'Puducherry', '35': 'Andaman & Nicobar Islands', '36': 'Telangana',
  '37': 'Andhra Pradesh', '38': 'Ladakh',
  '97': 'Other Territory', '99': 'Centre Jurisdiction',
}

/** Returns full state name from a GSTIN state code, e.g. "27" → "Maharashtra" */
export function stateNameFromCode(code: string | null): string {
  if (!code) return ''
  return STATE_CODES[code] ?? `State ${code}`
}

/** Returns the state name from a GSTIN directly. */
export function stateFromGSTIN(gstin: string | null | undefined): string {
  return stateNameFromCode(stateCodeFromGSTIN(gstin))
}
