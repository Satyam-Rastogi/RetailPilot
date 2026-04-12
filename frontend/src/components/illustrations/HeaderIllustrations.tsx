/**
 * Page-header illustrations — decorative right-aligned SVGs placed absolutely
 * inside each page's <header> element.
 *
 * Usage in a page header:
 *   <header className="... relative overflow-hidden">
 *     <div className="absolute right-0 top-0 bottom-0 flex items-center pointer-events-none select-none">
 *       <ProductShelfSVG className="w-64 h-40 text-ink opacity-20 dark:opacity-35" />
 *     </div>
 *     <div className="relative z-10">{ ...page title + subtitle... }</div>
 *   </header>
 *
 * ViewBox: 280 × 160 for all header illustrations (same scale as AnalyticsHub's ShopCounterSVG).
 * Style: stroke-based line art (currentColor) + themed accent colours via useTheme().
 */
import { useTheme } from '../ThemeProvider'

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

// ── 1. Best Sellers — 3-tier podium display shelf ─────────────────────────────
export function ProductShelfSVG({ className }: { className?: string }) {
  const { amber } = useAccents()
  return (
    <svg viewBox="0 0 280 160" fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className} aria-hidden="true">

      {/* ── Spotlight cone from apex ── */}
      <path d="M 140 6 L 68 92 L 212 92 Z" fill={amber} fillOpacity="0.06"/>
      <line x1="140" y1="6" x2="68"  y2="92" stroke={amber} strokeWidth="0.8" strokeOpacity="0.2"/>
      <line x1="140" y1="6" x2="212" y2="92" stroke={amber} strokeWidth="0.8" strokeOpacity="0.2"/>
      {/* Spotlight bulb */}
      <circle cx="140" cy="6" r="4" fill={amber} fillOpacity="0.5"/>

      {/* ── Floor / base line ── */}
      <line x1="18" y1="138" x2="262" y2="138" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.25"/>

      {/* ── Step 1 — centre / 1st place (tallest) ── */}
      {/* Platform */}
      <rect x="103" y="93" width="74" height="45"
        stroke="currentColor" strokeWidth="1.5"
        fill="currentColor" fillOpacity="0.06"/>
      {/* Platform top edge — amber accent */}
      <line x1="103" y1="93" x2="177" y2="93" stroke={amber} strokeWidth="1.2" strokeOpacity="0.6"/>
      {/* Rank number */}
      <text x="140" y="123" textAnchor="middle" fontSize="11"
        fill="currentColor" fillOpacity="0.2" fontFamily="monospace" fontWeight="bold">01</text>
      {/* Item box on top */}
      <rect x="114" y="65" width="52" height="28"
        stroke="currentColor" strokeWidth="1.4"
        fill={amber} fillOpacity="0.08"/>
      {/* Box detail line */}
      <line x1="114" y1="73" x2="166" y2="73"
        stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.4"/>
      {/* ★ badge — top-right of item */}
      <text x="168" y="64" textAnchor="middle" fontSize="14"
        fill={amber} fontFamily="serif">★</text>

      {/* ── Step 2 — left / 2nd place ── */}
      <rect x="36" y="108" width="62" height="30"
        stroke="currentColor" strokeWidth="1.4"
        fill="currentColor" fillOpacity="0.04"/>
      <line x1="36" y1="108" x2="98" y2="108" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3"/>
      <text x="67" y="128" textAnchor="middle" fontSize="10"
        fill="currentColor" fillOpacity="0.18" fontFamily="monospace">02</text>
      {/* Item box */}
      <rect x="44" y="83" width="46" height="25"
        stroke="currentColor" strokeWidth="1.2"
        fill="currentColor" fillOpacity="0.04"/>

      {/* ── Step 3 — right / 3rd place ── */}
      <rect x="182" y="108" width="62" height="30"
        stroke="currentColor" strokeWidth="1.4"
        fill="currentColor" fillOpacity="0.04"/>
      <line x1="182" y1="108" x2="244" y2="108" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3"/>
      <text x="213" y="128" textAnchor="middle" fontSize="10"
        fill="currentColor" fillOpacity="0.18" fontFamily="monospace">03</text>
      {/* Item box */}
      <rect x="190" y="83" width="46" height="25"
        stroke="currentColor" strokeWidth="1.2"
        fill="currentColor" fillOpacity="0.04"/>
    </svg>
  )
}

// ── 2. Inventory Analytics — warehouse shelf with 3-D box illusion ─────────────
export function WarehouseSVG({ className }: { className?: string }) {
  const { green, amber, red } = useAccents()

  // Helper: draw a box with a parallelogram top for the 3-D depth illusion.
  // Front face: rect(x, y, w, h). Top face: parallelogram shifted (+12, -8).
  const Box = ({
    x, y, w, h, accent, empty,
  }: { x: number; y: number; w: number; h: number; accent?: string; empty?: boolean }) => {
    const topPath = `M ${x},${y} L ${x + 12},${y - 8} L ${x + w + 12},${y - 8} L ${x + w},${y} Z`
    const rightPath = `M ${x + w},${y} L ${x + w + 12},${y - 8} L ${x + w + 12},${y + h - 8} L ${x + w},${y + h} Z`
    if (empty) {
      return (
        <>
          <rect x={x} y={y} width={w} height={h}
            stroke={red} strokeWidth="1.2" strokeDasharray="5 3" fill="none"/>
          <line x1={x + 10} y1={y + 10} x2={x + w - 10} y2={y + h - 10}
            stroke={red} strokeWidth="1" strokeOpacity="0.4"/>
          <line x1={x + w - 10} y1={y + 10} x2={x + 10} y2={y + h - 10}
            stroke={red} strokeWidth="1" strokeOpacity="0.4"/>
        </>
      )
    }
    return (
      <>
        {/* Front face */}
        <rect x={x} y={y} width={w} height={h}
          stroke={accent ?? 'currentColor'} strokeWidth="1.3"
          fill={accent} fillOpacity="0.1"/>
        {/* Top face (depth illusion) */}
        <path d={topPath}
          stroke={accent ?? 'currentColor'} strokeWidth="1"
          fill={accent} fillOpacity="0.2"/>
        {/* Right face */}
        <path d={rightPath}
          stroke={accent ?? 'currentColor'} strokeWidth="1"
          fill={accent} fillOpacity="0.06"/>
      </>
    )
  }

  return (
    <svg viewBox="0 0 280 160" fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className} aria-hidden="true">

      {/* ── Shelf uprights ── */}
      {/* Left I-beam */}
      <rect x="22" y="12" width="12" height="130" stroke="currentColor" strokeWidth="1.2"
        fill="currentColor" fillOpacity="0.06"/>
      {/* Left depth brace */}
      <path d="M 22,12 L 34,4 L 46,4 L 34,12 Z"
        stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.08"/>

      {/* Right I-beam */}
      <rect x="234" y="12" width="12" height="130" stroke="currentColor" strokeWidth="1.2"
        fill="currentColor" fillOpacity="0.06"/>
      {/* Right depth brace */}
      <path d="M 234,12 L 246,4 L 258,4 L 246,12 Z"
        stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.08"/>

      {/* ── Shelf boards (3 levels) ── */}
      {/* Each board: front rect + parallelogram top edge */}
      {/* Top shelf rail at y=52 */}
      <rect x="22" y="51" width="224" height="7" stroke="currentColor" strokeWidth="1.2"
        fill="currentColor" fillOpacity="0.1"/>
      <path d="M 22,51 L 34,43 L 258,43 L 246,51 Z"
        stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.15"/>

      {/* Middle shelf rail at y=96 */}
      <rect x="22" y="95" width="224" height="7" stroke="currentColor" strokeWidth="1.2"
        fill="currentColor" fillOpacity="0.1"/>
      <path d="M 22,95 L 34,87 L 258,87 L 246,95 Z"
        stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.15"/>

      {/* Bottom shelf rail at y=140 */}
      <rect x="22" y="139" width="224" height="7" stroke="currentColor" strokeWidth="1.2"
        fill="currentColor" fillOpacity="0.1"/>
      <path d="M 22,139 L 34,131 L 258,131 L 246,139 Z"
        stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.15"/>

      {/* ── Boxes — Level 1 (top shelf, y=14 to 51) ── */}
      <Box x={36}  y={18} w={52} h={33} accent={green} />   {/* full */}
      <Box x={106} y={30} w={52} h={21} accent={amber} />   {/* partial (amber = low stock) */}
      <Box x={176} y={18} w={52} h={33} empty />             {/* empty slot */}

      {/* ── Boxes — Level 2 (middle shelf, y=58 to 95) ── */}
      <Box x={36}  y={58} w={52} h={37} accent={green} />
      <Box x={106} y={58} w={52} h={37} accent={green} />
      <Box x={176} y={70} w={52} h={25} accent={amber} />   {/* partial */}

      {/* ── Boxes — Level 3 (bottom shelf, y=103 to 139) ── */}
      <Box x={36}  y={103} w={52} h={36} accent={green} />
      <Box x={106} y={103} w={52} h={36} empty />            {/* empty */}
      <Box x={176} y={103} w={52} h={36} accent={green} />

      {/* ── Legend dots (top-right corner) ── */}
      <circle cx="254" cy="20" r="4" fill={green}/>
      <circle cx="254" cy="34" r="4" fill={amber}/>
      <circle cx="254" cy="48" r="4" fill={red} fillOpacity="0.7"/>
    </svg>
  )
}

// ── 3. AR Aging — desk with overdue invoices and wall clock ───────────────────
export function OverdueDeskSVG({ className }: { className?: string }) {
  const { red, amber } = useAccents()
  return (
    <svg viewBox="0 0 280 160" fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className} aria-hidden="true">

      {/* ── Wall (upper area) ── */}
      <rect x="0" y="0" width="280" height="92"
        fill="currentColor" fillOpacity="0.02"/>

      {/* ── Desk surface (slight perspective trapezoid) ── */}
      <path d="M 8 92 L 272 92 L 260 110 L 20 110 Z"
        stroke="currentColor" strokeWidth="1.4"
        fill="currentColor" fillOpacity="0.07"/>
      {/* Desk front fascia */}
      <rect x="20" y="110" width="240" height="18"
        stroke="currentColor" strokeWidth="1"
        fill="currentColor" fillOpacity="0.05"/>

      {/* ── Invoice stack ── */}
      {/* Bottom paper (slightly rotated — simulated by x-offset) */}
      <rect x="46" y="56" width="90" height="36"
        stroke="currentColor" strokeWidth="1.2"
        fill="currentColor" fillOpacity="0.04" strokeOpacity="0.6"/>
      {/* Middle paper */}
      <rect x="52" y="50" width="90" height="36"
        stroke="currentColor" strokeWidth="1.3"
        fill="currentColor" fillOpacity="0.05" strokeOpacity="0.7"/>
      {/* Top paper (front) */}
      <rect x="58" y="44" width="90" height="36"
        stroke="currentColor" strokeWidth="1.5"
        fill="currentColor" fillOpacity="0.06"/>
      {/* Invoice lines on top paper */}
      <line x1="68" y1="54" x2="138" y2="54" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.3"/>
      <line x1="68" y1="62" x2="128" y2="62" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.3"/>
      {/* OVERDUE stamp — red diagonal lines forming X */}
      <line x1="68" y1="45" x2="138" y2="79" stroke={red} strokeWidth="2.2" strokeLinecap="round" strokeOpacity="0.7"/>
      <line x1="138" y1="45" x2="68" y2="79" stroke={red} strokeWidth="2.2" strokeLinecap="round" strokeOpacity="0.7"/>
      {/* Stamp circle */}
      <ellipse cx="103" cy="62" rx="34" ry="18"
        stroke={red} strokeWidth="1.5" fill="none" strokeOpacity="0.5"/>

      {/* ── Wall clock (upper right) ── */}
      {/* Clock face */}
      <circle cx="218" cy="48" r="28"
        stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.05"/>
      {/* Clock inner ring */}
      <circle cx="218" cy="48" r="24"
        stroke="currentColor" strokeWidth="0.6" strokeOpacity="0.2" fill="none"/>
      {/* Hour marks */}
      <line x1="218" y1="22" x2="218" y2="28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="244" y1="48" x2="238" y2="48" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="218" y1="74" x2="218" y2="68" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="192" y1="48" x2="198" y2="48" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Minute marks (subtle) */}
      {[0,1,2,3,4,5,6,7,8,9,10,11].map(i => {
        if (i % 3 === 0) return null // skip hour marks
        const angle = (i / 12) * Math.PI * 2 - Math.PI / 2
        const x1 = 218 + 24 * Math.cos(angle)
        const y1 = 48  + 24 * Math.sin(angle)
        const x2 = 218 + 21 * Math.cos(angle)
        const y2 = 48  + 21 * Math.sin(angle)
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.25"/>
      })}
      {/* Hour hand — pointing near 12 (urgency) */}
      <line x1="218" y1="48" x2="218" y2="30"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      {/* Minute hand — pointing toward 11 */}
      <line x1="218" y1="48" x2="207" y2="27"
        stroke={amber} strokeWidth="1.5" strokeLinecap="round"/>
      {/* Centre dot */}
      <circle cx="218" cy="48" r="2.5" fill="currentColor"/>

      {/* ── Phone receiver off-hook (left wall) ── */}
      {/* Handset base */}
      <path d="M 18 32 C 18 22, 36 20, 38 30 L 34 38 C 32 46, 20 44, 18 36 Z"
        stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.06"/>
      {/* Cord */}
      <path d="M 28 38 C 24 52, 15 62, 18 72"
        stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" strokeOpacity="0.35" fill="none"/>
    </svg>
  )
}

// ── 4. Daily Summary — cash register printing a receipt ───────────────────────
export function ReceiptPrinterSVG({ className }: { className?: string }) {
  const { amber } = useAccents()
  return (
    <svg viewBox="0 0 280 160" fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className} aria-hidden="true">

      {/* ── Register body ── */}
      <rect x="28" y="72" width="100" height="72"
        stroke="currentColor" strokeWidth="1.5"
        fill="currentColor" fillOpacity="0.06"/>
      {/* Register top cap */}
      <rect x="28" y="66" width="100" height="10"
        stroke="currentColor" strokeWidth="1"
        fill="currentColor" fillOpacity="0.08"/>
      {/* Display screen */}
      <rect x="36" y="80" width="84" height="22" rx="1.5"
        fill="rgba(30,30,46,0.6)" stroke={amber} strokeWidth="0.8" strokeOpacity="0.4"/>
      {/* Screen glow */}
      <rect x="38" y="82" width="80" height="18" rx="1"
        fill={amber} fillOpacity="0.08"/>
      {/* Screen text lines */}
      <line x1="44" y1="87" x2="110" y2="87" stroke={amber} strokeWidth="0.7" strokeOpacity="0.35"/>
      <line x1="44" y1="93" x2="96"  y2="93" stroke={amber} strokeWidth="0.7" strokeOpacity="0.25"/>
      {/* Keyboard area */}
      {[0,1,2].map(row => (
        [0,1,2,3].map(col => (
          <rect key={`${row}-${col}`}
            x={38 + col * 21} y={110 + row * 10}
            width="16" height="7" rx="1"
            stroke="currentColor" strokeWidth="0.7" strokeOpacity="0.25"
            fill="currentColor" fillOpacity="0.04"/>
        ))
      ))}
      {/* Cash drawer line */}
      <line x1="28" y1="130" x2="128" y2="130"
        stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.2"/>

      {/* ── Paper slot at top of register ── */}
      <rect x="62" y="60" width="32" height="8"
        stroke="currentColor" strokeWidth="1"
        fill="currentColor" fillOpacity="0.12"/>

      {/* ── Receipt paper (extending upward) ── */}
      {/* Main strip */}
      <rect x="66" y="8" width="24" height="52"
        stroke="currentColor" strokeWidth="1.3"
        fill="currentColor" fillOpacity="0.05"/>
      {/* Receipt header — amber block */}
      <rect x="66" y="8" width="24" height="14"
        fill={amber} fillOpacity="0.18"
        stroke={amber} strokeWidth="0.8"/>
      {/* Header detail (logo placeholder) */}
      <line x1="70" y1="13" x2="86" y2="13"
        stroke={amber} strokeWidth="1" strokeOpacity="0.6"/>
      <line x1="72" y1="17" x2="84" y2="17"
        stroke={amber} strokeWidth="0.7" strokeOpacity="0.4"/>
      {/* Data lines on receipt body */}
      {[26, 31, 36, 41, 46, 51].map(y => (
        <line key={y} x1="70" y1={y} x2={y < 40 ? 88 : 82} y2={y}
          stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.3"/>
      ))}

      {/* ── Counter surface ── */}
      <rect x="0" y="140" width="280" height="8"
        fill="currentColor" fillOpacity="0.06"
        stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.15"/>

      {/* ── Decorative coin roll ── */}
      <rect x="158" y="118" width="30" height="14" rx="7"
        stroke="currentColor" strokeWidth="1.2"
        fill="currentColor" fillOpacity="0.05"/>
      <line x1="168" y1="118" x2="168" y2="132" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.2"/>
      <line x1="178" y1="118" x2="178" y2="132" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.2"/>

      {/* ── Cash in drawer (fanned bills) ── */}
      <rect x="148" y="95" width="50" height="20" rx="1"
        stroke="currentColor" strokeWidth="1" strokeOpacity="0.5"
        fill="currentColor" fillOpacity="0.04"/>
      <rect x="152" y="90" width="50" height="20" rx="1"
        stroke="currentColor" strokeWidth="1" strokeOpacity="0.4"
        fill="currentColor" fillOpacity="0.03"/>
      <line x1="158" y1="100" x2="190" y2="100"
        stroke="currentColor" strokeWidth="0.7" strokeOpacity="0.2"/>
    </svg>
  )
}
