/**
 * Empty-state illustrations — used inside <EmptyState illustration={...} />.
 * Each SVG calls useTheme() internally so accent colours adapt between
 * light and dark mode without any prop drilling.
 *
 * ViewBox: 160 × 100 (landscape compact, rendered at w-48 h-28 in EmptyState).
 * Style: stroke-based line art (currentColor) + 1-2 themed accent colours.
 */
import { useTheme } from '../ThemeProvider'

// ── Shared accent palettes ────────────────────────────────────────────────────
function useAccents() {
  const { theme } = useTheme()
  const dk = theme === 'dark'
  return {
    amber:  dk ? '#FCD34D' : '#F59E0B',
    indigo: dk ? '#818CF8' : '#6366F1',
    green:  dk ? '#34D399' : '#10B981',
    red:    dk ? '#F87171' : '#EF4444',
  }
}

// ── 1. Invoices — clipboard with pen ─────────────────────────────────────────
export function EmptyClipboardSVG() {
  const { amber } = useAccents()
  return (
    <svg viewBox="0 0 160 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Clipboard body */}
      <rect x="28" y="18" width="104" height="76" stroke="currentColor" strokeWidth="1.5"/>
      {/* Metal clip */}
      <rect x="62" y="9" width="36" height="15" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="80" y1="9" x2="80" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Blank form lines */}
      <line x1="42" y1="40" x2="118" y2="40" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.55"/>
      <line x1="42" y1="52" x2="118" y2="52" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.55"/>
      <line x1="42" y1="64" x2="90"  y2="64" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.4"/>
      {/* Pen body */}
      <line x1="108" y1="55" x2="133" y2="87" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      {/* Pen cap */}
      <rect x="104" y="49" width="9" height="6" rx="1" fill="currentColor" opacity="0.45"/>
      {/* Pen nib — amber / warm gold */}
      <circle cx="133" cy="87" r="3.5" fill={amber}/>
    </svg>
  )
}

// ── 2. Customers — rolodex / person card ─────────────────────────────────────
export function CustomerDirectorySVG() {
  const { indigo } = useAccents()
  return (
    <svg viewBox="0 0 160 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Back card */}
      <rect x="35" y="22" width="90" height="65" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.35"/>
      {/* Main card */}
      <rect x="25" y="29" width="90" height="65" stroke="currentColor" strokeWidth="1.5"/>
      {/* Indigo tab */}
      <rect x="35" y="19" width="24" height="14" rx="2" fill={indigo}/>
      {/* Person head */}
      <circle cx="57" cy="52" r="9" stroke="currentColor" strokeWidth="1.5"/>
      {/* Person shoulders */}
      <path d="M 40 80 Q 57 63 74 80" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      {/* Name / detail lines */}
      <line x1="82" y1="48" x2="108" y2="48" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.65"/>
      <line x1="82" y1="59" x2="102" y2="59" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.5"/>
      <line x1="82" y1="70" x2="110" y2="70" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.4"/>
    </svg>
  )
}

// ── 3. Items / inventory — bare shelf ────────────────────────────────────────
export function BareShelfSVG() {
  const { amber } = useAccents()
  return (
    <svg viewBox="0 0 160 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Vertical uprights */}
      <line x1="20" y1="10" x2="20" y2="92" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="140" y1="10" x2="140" y2="92" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Top shelf board */}
      <rect x="14" y="34" width="132" height="8" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.07"/>
      {/* Top shelf amber front edge */}
      <line x1="14" y1="42" x2="146" y2="42" stroke={amber} strokeWidth="1.8"/>
      {/* Bottom shelf board */}
      <rect x="14" y="70" width="132" height="8" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.07"/>
      {/* Bottom shelf amber front edge */}
      <line x1="14" y1="78" x2="146" y2="78" stroke={amber} strokeWidth="1.8"/>
      {/* Dust dots — suggests emptiness */}
      <circle cx="55"  cy="55" r="2" fill="currentColor" fillOpacity="0.18"/>
      <circle cx="80"  cy="55" r="2" fill="currentColor" fillOpacity="0.18"/>
      <circle cx="105" cy="55" r="2" fill="currentColor" fillOpacity="0.18"/>
    </svg>
  )
}

// ── 4. Suppliers — delivery truck with empty cargo ────────────────────────────
export function MissingTruckSVG() {
  const { indigo } = useAccents()
  return (
    <svg viewBox="0 0 160 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Dashed road */}
      <line x1="8" y1="86" x2="152" y2="86" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.35" strokeDasharray="8 4"/>
      {/* Cargo box (empty) */}
      <rect x="16" y="40" width="75" height="43" stroke="currentColor" strokeWidth="1.5"/>
      {/* Diagonal hatch = empty */}
      <line x1="32" y1="42" x2="42" y2="81" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.2"/>
      <line x1="50" y1="42" x2="60" y2="81" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.2"/>
      <line x1="68" y1="42" x2="78" y2="81" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.2"/>
      {/* Cab */}
      <rect x="91" y="52" width="43" height="31" stroke="currentColor" strokeWidth="1.5"/>
      {/* Windshield — indigo / violet tint */}
      <rect x="97" y="57" width="22" height="14" rx="1" stroke="currentColor" strokeWidth="1.2" fill={indigo} fillOpacity="0.22"/>
      {/* Wheels */}
      <circle cx="43"  cy="84" r="9" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="43"  cy="84" r="3.5" fill="currentColor" fillOpacity="0.3"/>
      <circle cx="116" cy="84" r="9" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="116" cy="84" r="3.5" fill="currentColor" fillOpacity="0.3"/>
    </svg>
  )
}

// ── 5. Returns — open box with return arrow ───────────────────────────────────
export function ReturnBoxSVG() {
  const { amber } = useAccents()
  return (
    <svg viewBox="0 0 160 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Box body */}
      <rect x="40" y="50" width="80" height="44" stroke="currentColor" strokeWidth="1.5"/>
      {/* Centre crease */}
      <line x1="80" y1="50" x2="80" y2="94" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.3" strokeDasharray="4 3"/>
      {/* Left flap open */}
      <path d="M 40 50 L 20 30 L 60 32 L 40 50" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="currentColor" fillOpacity="0.06"/>
      {/* Right flap open */}
      <path d="M 120 50 L 100 32 L 140 30 L 120 50" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="currentColor" fillOpacity="0.06"/>
      {/* Return arrow — amber / warm gold */}
      <path d="M 108 25 C 108 8, 72 6, 64 20" stroke={amber} strokeWidth="2.2" strokeLinecap="round" fill="none"/>
      {/* Arrowhead */}
      <path d="M 64 20 L 72 15" stroke={amber} strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M 64 20 L 60 28" stroke={amber} strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  )
}

// ── 6. Ledger / Receivables — empty wallet ────────────────────────────────────
export function EmptyWalletSVG() {
  const { green } = useAccents()
  return (
    <svg viewBox="0 0 160 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Wallet outer body */}
      <rect x="18" y="26" width="124" height="58" rx="3" stroke="currentColor" strokeWidth="1.5"/>
      {/* Wallet flap / fold line */}
      <line x1="18" y1="44" x2="142" y2="44" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4"/>
      {/* Bill compartment (left, empty) */}
      <rect x="26" y="50" width="46" height="26" stroke="currentColor" strokeWidth="1" strokeOpacity="0.5" strokeDasharray="5 3"/>
      {/* Card slot (right) — green accent outline */}
      <rect x="82" y="50" width="50" height="26" rx="2" stroke={green} strokeWidth="1.3" strokeDasharray="5 3"/>
      {/* Coin clasp at top */}
      <rect x="64" y="18" width="32" height="12" rx="4" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.07"/>
      {/* ₹ symbol in card slot — green */}
      <text x="107" y="67" textAnchor="middle" fontSize="12" fill={green} fillOpacity="0.6" fontFamily="monospace">₹</text>
    </svg>
  )
}
