/**
 * DatePicker — single date selector
 * DateRangePicker — two-date range selector with hover preview + manual text entry
 *
 * Both use react-day-picker v9 for logic (range hover, keyboard nav, a11y)
 * and are styled entirely with our design tokens. Zero library styles leak through.
 * Portalled to document.body so they escape overflow:hidden inside modals.
 *
 * DateRangePicker features:
 *  - Editable "From" / "To" text inputs — type any date (dd MMM yyyy, dd/MM/yyyy, yyyy-MM-dd)
 *  - 2-month calendar for visual selection; navigate with ‹ › to cross any month boundary
 *  - Calendar scrolls to the typed month when you press Enter / Tab / blur
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { DayPicker, type DateRange } from 'react-day-picker'
import { format, parse, isValid, startOfDay } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────

const API_FMT      = 'yyyy-MM-dd'
const DISPLAY_FMT  = 'dd MMM yyyy'
// Formats accepted in text inputs (tried in order)
const INPUT_FMTS   = [
  'dd MMM yyyy',   // 15 Jan 2026
  'd MMM yyyy',    //  5 Jan 2026
  'dd MMMM yyyy',  // 15 January 2026
  'd MMMM yyyy',   //  5 January 2026
  'dd/MM/yyyy',    // 15/01/2026
  'd/M/yyyy',      //  5/1/2026
  'yyyy-MM-dd',    // 2026-01-15
  'dd-MM-yyyy',    // 15-01-2026
]

export function strToDate(s: string | undefined): Date | undefined {
  if (!s) return undefined
  const d = parse(s, API_FMT, new Date())
  return isValid(d) ? startOfDay(d) : undefined
}

export function dateToStr(d: Date | undefined | null): string {
  if (!d || !isValid(d)) return ''
  return format(d, API_FMT)
}

function parseTypedDate(s: string): Date | undefined {
  const trimmed = s.trim()
  if (!trimmed) return undefined
  for (const f of INPUT_FMTS) {
    const d = parse(trimmed, f, new Date())
    if (isValid(d)) return startOfDay(d)
  }
  return undefined
}

// ── Shared calendar classNames (v9 key names) ─────────────────────────────────

export const calendarClassNames = {
  root:             'p-4 select-none',
  months:           'flex gap-6',
  month:            'space-y-3',
  month_caption:    'flex items-center justify-between mb-2',
  caption_label:    'font-mono font-bold text-[11px] uppercase tracking-widest',
  nav:              'flex items-center gap-1',

  button_previous: [
    'w-7 h-7 brutal-border bg-paper flex items-center justify-center',
    'hover:bg-ink hover:text-surface transition-colors',
    'disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-paper disabled:hover:text-ink',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
  ].join(' '),
  button_next: [
    'w-7 h-7 brutal-border bg-paper flex items-center justify-center',
    'hover:bg-ink hover:text-surface transition-colors',
    'disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-paper disabled:hover:text-ink',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
  ].join(' '),

  month_grid:       'w-full border-collapse',
  weekdays:         '',
  weekday:          'w-9 pb-1.5 text-[9px] font-mono uppercase tracking-widest text-ink-light text-center font-normal',
  weeks:            '',
  week:             '',

  // day cell (td) — wrapper; gets range band background
  day:              'p-0 w-9 h-9 text-center align-middle',

  // clickable button inside the cell
  day_button: [
    'w-9 h-9 font-mono text-xs flex items-center justify-center',
    'hover:bg-ink hover:text-surface transition-colors duration-100',
    'disabled:opacity-25 disabled:cursor-not-allowed',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
  ].join(' '),

  selected:      '!bg-ink !text-surface hover:!bg-ink/90',
  today:         'font-bold [&:not(.rdp-selected)]:text-accent',
  outside:       '!text-ink-light/30 hover:!bg-ink/5',
  disabled:      '!opacity-25 !cursor-not-allowed',
  hidden:        'invisible',

  range_start:   'bg-ink/[.08] dark:bg-white/[.08]',
  range_end:     'bg-ink/[.08] dark:bg-white/[.08]',
  range_middle:  'bg-ink/[.08] dark:bg-white/[.08]',

  // disable library transitions to avoid flicker
  weeks_before_enter:   '',
  weeks_before_exit:    '',
  weeks_after_enter:    '',
  weeks_after_exit:     '',
  caption_after_enter:  '',
  caption_after_exit:   '',
  caption_before_enter: '',
  caption_before_exit:  '',
}

// ── Custom chevron ────────────────────────────────────────────────────────────

function CalendarChevron({ orientation }: { orientation?: string }) {
  return orientation === 'right'
    ? <ChevronRight className="w-3.5 h-3.5" />
    : <ChevronLeft  className="w-3.5 h-3.5" />
}

// ── Popup hook — position + outside-click + Escape ───────────────────────────

function usePopup(
  triggerRef: React.RefObject<HTMLElement | null>,
  popupRef:   React.RefObject<HTMLElement | null>,
  popupWidth  = 296,
) {
  const [open, setOpen] = useState(false)
  const [pos,  setPos]  = useState({ top: 0, left: 0 })

  const openPopup = useCallback(() => {
    const rect = triggerRef.current!.getBoundingClientRect()
    const vw   = window.innerWidth
    let left   = rect.left
    if (left + popupWidth > vw - 8) left = Math.max(8, vw - popupWidth - 8)
    setPos({ top: rect.bottom + 6, left })
    setOpen(true)
  }, [triggerRef, popupWidth])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !popupRef.current?.contains(e.target as Node)
      ) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown',   onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown',   onKey)
    }
  }, [open, triggerRef, popupRef])

  return { open, setOpen, pos, openPopup }
}

// ── Calendar popup shell ──────────────────────────────────────────────────────

function CalendarPopup({
  popupRef,
  pos,
  children,
}: {
  popupRef: React.RefObject<HTMLDivElement>
  pos: { top: number; left: number }
  children: React.ReactNode
}) {
  return createPortal(
    <div
      ref={popupRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
      className="bg-paper brutal-border shadow-[4px_4px_0px_var(--theme-shadow)]"
    >
      {children}
    </div>,
    document.body
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DatePicker — single date
// ─────────────────────────────────────────────────────────────────────────────

interface DatePickerProps {
  value:        string   // 'yyyy-MM-dd' or ''
  onChange:     (val: string) => void
  min?:         string
  max?:         string
  placeholder?: string
  className?:   string
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = 'Select date',
  className   = '',
}: DatePickerProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef   = useRef<HTMLDivElement>(null)
  const { open, setOpen, pos, openPopup } = usePopup(triggerRef, popupRef, 296)

  const selected = strToDate(value)
  const minDate  = strToDate(min)
  const maxDate  = strToDate(max)

  const handleSelect = (date: Date | undefined) => {
    onChange(dateToStr(date))
    setOpen(false)
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => open ? setOpen(false) : openPopup()}
        className={[
          'flex items-center gap-2 px-3 py-2 brutal-border bg-paper text-ink',
          'font-mono text-xs transition-colors hover:border-accent',
          'focus:outline-none focus:border-accent',
          open ? 'border-accent' : '',
          className,
        ].join(' ')}
      >
        <CalendarDays className="w-3.5 h-3.5 text-ink-light shrink-0" />
        <span className={selected ? 'text-ink' : 'text-ink-light'}>
          {selected ? format(selected, DISPLAY_FMT) : placeholder}
        </span>
      </button>

      {open && (
        <CalendarPopup popupRef={popupRef} pos={pos}>
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            defaultMonth={selected ?? maxDate ?? new Date()}
            disabled={[
              ...(minDate ? [{ before: minDate }] : []),
              ...(maxDate ? [{ after: maxDate }] : []),
            ]}
            classNames={calendarClassNames}
            components={{ Chevron: CalendarChevron }}
          />
        </CalendarPopup>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DateRangePicker — from → to with text inputs + 2-month calendar
// ─────────────────────────────────────────────────────────────────────────────

interface DateRangePickerProps {
  from:      string   // 'yyyy-MM-dd' or ''
  to:        string   // 'yyyy-MM-dd' or ''
  onChange:  (range: { from: string; to: string }) => void
  max?:      string
  className?: string
}

// Base text-input style for the From / To fields inside the popup
const textInputBase = [
  'w-full px-2 py-1.5 brutal-border bg-paper text-ink',
  'font-mono text-xs placeholder:text-ink-light/50',
  'focus:outline-none transition-colors',
].join(' ')

export function DateRangePicker({
  from,
  to,
  onChange,
  max,
  className = '',
}: DateRangePickerProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef   = useRef<HTMLDivElement>(null)
  const { open, setOpen, pos, openPopup } = usePopup(triggerRef, popupRef, 624)

  const fromDate = strToDate(from)
  const toDate   = strToDate(to)
  const maxDate  = strToDate(max)

  // ── Text input state ──────────────────────────────────────────────────────
  const [fromText,  setFromText]  = useState(fromDate ? format(fromDate, DISPLAY_FMT) : '')
  const [toText,    setToText]    = useState(toDate   ? format(toDate,   DISPLAY_FMT) : '')
  const [fromError, setFromError] = useState('')
  const [toError,   setToError]   = useState('')

  // double-fire guard for Enter+blur
  const fromApplying = useRef(false)
  const toApplying   = useRef(false)

  // Calendar visible month
  const [calMonth, setCalMonth] = useState<Date>(fromDate ?? maxDate ?? new Date())

  // ── Two-phase calendar selection ──────────────────────────────────────────
  // 'from' = next calendar click sets the start date
  // 'to'   = next calendar click sets the end date
  const [phase, setPhase] = useState<'from' | 'to'>('from')

  // Always open in 'from' phase — standard two-click flow: pick start, then end.
  // To modify only the end date, user can click the TO text input (onFocus → 'to').
  useEffect(() => {
    if (open) setPhase('from')
  }, [open])

  // Sync text inputs when props change externally (quick-range buttons etc.)
  useEffect(() => {
    const d = strToDate(from)
    setFromText(d ? format(d, DISPLAY_FMT) : '')
    setFromError('')
  }, [from])
  useEffect(() => {
    const d = strToDate(to)
    setToText(d ? format(d, DISPLAY_FMT) : '')
    setToError('')
  }, [to])

  // ── Calendar selected prop ────────────────────────────────────────────────
  // Phase 'from': show nothing selected — so any click unambiguously sets a new start.
  //   (react-day-picker returns {from:D,to:D} when clicking with an existing
  //    complete range, which would trigger an accidental close.)
  // Phase 'to':   show from anchor so the hover/range preview works correctly.
  const calSelected: DateRange = phase === 'from'
    ? { from: undefined, to: undefined }
    : { from: fromDate, to: undefined }

  // ── Calendar click handler ────────────────────────────────────────────────
  const handleCalendarSelect = (range: DateRange | undefined) => {
    if (phase === 'from') {
      // range.from is the clicked date (calendar was cleared)
      const f = dateToStr(range?.from)
      if (!f) return
      onChange({ from: f, to: '' })   // clear 'to' — user will pick it next
      setCalMonth(strToDate(f)!)
      setPhase('to')
    } else {
      // In 'to' phase, selected={from, to:undefined}.
      // react-day-picker returns:
      //   {from, to: clicked}   when clicked ≥ from  (normal end-date selection)
      //   {from: clicked, to:undefined} when clicked < from (it resets to new start)
      const clicked = range?.to ?? range?.from   // always the date the user clicked
      const clickedStr = dateToStr(clicked)
      if (!clickedStr) return

      const fd = strToDate(from)
      const cd = strToDate(clickedStr)
      if (!fd || !cd) return

      if (cd >= fd) {
        // Valid end date — commit range and close
        onChange({ from, to: clickedStr })
        setOpen(false)
        setPhase('from')
      } else {
        // Clicked before start → make it the new start, stay in 'to' phase
        onChange({ from: clickedStr, to: '' })
        setCalMonth(cd)
        // phase stays 'to' — user still needs to pick an end date
      }
    }
  }

  // ── Apply typed FROM ──────────────────────────────────────────────────────
  const applyFrom = useCallback(() => {
    if (fromApplying.current) return
    fromApplying.current = true
    setTimeout(() => { fromApplying.current = false }, 0)

    const trimmed = fromText.trim()
    if (!trimmed) {
      onChange({ from: '', to: '' })
      setFromError('')
      setPhase('from')
      return
    }
    const d = parseTypedDate(trimmed)
    if (!d) {
      setFromError('Invalid date — try "15 Jan 2026" or "15/01/2026"')
      return
    }
    setFromError('')
    // Keep existing 'to' if it's still valid; otherwise clear it
    const existingTo = strToDate(to)
    const keepTo = existingTo && existingTo >= d ? to : ''
    onChange({ from: dateToStr(d), to: keepTo })
    setCalMonth(d)
    setPhase(keepTo ? 'from' : 'to')  // if to cleared, user picks end next
  }, [fromText, to, onChange])

  // ── Apply typed TO ────────────────────────────────────────────────────────
  const applyTo = useCallback(() => {
    if (toApplying.current) return
    toApplying.current = true
    setTimeout(() => { toApplying.current = false }, 0)

    const trimmed = toText.trim()
    if (!trimmed) {
      onChange({ from, to: '' })
      setToError('')
      setPhase('to')
      return
    }
    const d = parseTypedDate(trimmed)
    if (!d) {
      setToError('Invalid date — try "15 Mar 2026" or "15/03/2026"')
      return
    }
    const fd = strToDate(from)
    if (!from) {
      setToError('Set a start date first')
      return
    }
    if (fd && d < fd) {
      setToError('End date must be after start date')
      return
    }
    setToError('')
    onChange({ from, to: dateToStr(d) })
    setOpen(false)
    setPhase('from')
  }, [toText, from, onChange, setOpen])

  // ── Trigger label ─────────────────────────────────────────────────────────
  const label = fromDate && toDate
    ? `${format(fromDate, 'dd MMM yyyy')} → ${format(toDate, 'dd MMM yyyy')}`
    : fromDate
    ? `${format(fromDate, 'dd MMM yyyy')} → …`
    : 'Select date range'

  const hasValue = !!(fromDate || toDate)

  // Label shown on each input field header — highlights the active phase
  const fromLabel = phase === 'from' && open ? 'Start Date ← click below' : 'From'
  const toLabel   = phase === 'to'   && open ? 'End Date ← click below'   : 'To'

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => open ? setOpen(false) : openPopup()}
        className={[
          'flex items-center gap-2 px-3 py-2 brutal-border bg-paper text-ink',
          'font-mono text-xs transition-colors hover:border-accent',
          'focus:outline-none focus:border-accent whitespace-nowrap',
          open ? 'border-accent' : '',
          className,
        ].join(' ')}
      >
        <CalendarDays className="w-3.5 h-3.5 text-ink-light shrink-0" />
        <span className={hasValue ? 'text-ink' : 'text-ink-light'}>{label}</span>
      </button>

      {open && (
        <CalendarPopup popupRef={popupRef} pos={pos}>

          {/* ── Text inputs with phase-aware labels ── */}
          <div className="px-4 pt-3.5 pb-3 grid grid-cols-2 gap-3 border-b border-line">
            {/* FROM */}
            <div>
              <div className={[
                'text-[9px] font-mono uppercase tracking-widest mb-1.5 transition-colors',
                phase === 'from' ? 'text-accent font-bold' : 'text-ink-light',
              ].join(' ')}>
                {fromLabel}
              </div>
              <input
                type="text"
                value={fromText}
                onChange={e => { setFromText(e.target.value); setFromError('') }}
                onFocus={() => setPhase('from')}
                onBlur={applyFrom}
                onKeyDown={e => { if (e.key === 'Enter') applyFrom() }}
                placeholder="15 Jan 2026"
                className={[
                  textInputBase,
                  fromError
                    ? 'border-danger'
                    : phase === 'from'
                    ? 'border-accent'
                    : 'focus:border-accent',
                ].join(' ')}
                spellCheck={false}
                autoComplete="off"
              />
              {fromError && (
                <div className="mt-1 text-[9px] font-mono text-danger leading-tight">{fromError}</div>
              )}
            </div>
            {/* TO */}
            <div>
              <div className={[
                'text-[9px] font-mono uppercase tracking-widest mb-1.5 transition-colors',
                phase === 'to' ? 'text-accent font-bold' : 'text-ink-light',
              ].join(' ')}>
                {toLabel}
              </div>
              <input
                type="text"
                value={toText}
                onChange={e => { setToText(e.target.value); setToError('') }}
                onFocus={() => setPhase('to')}
                onBlur={applyTo}
                onKeyDown={e => { if (e.key === 'Enter') applyTo() }}
                placeholder="29 Mar 2026"
                className={[
                  textInputBase,
                  toError
                    ? 'border-danger'
                    : phase === 'to'
                    ? 'border-accent'
                    : 'focus:border-accent',
                ].join(' ')}
                spellCheck={false}
                autoComplete="off"
              />
              {toError && (
                <div className="mt-1 text-[9px] font-mono text-danger leading-tight">{toError}</div>
              )}
            </div>
            <div className="col-span-2 text-[9px] font-mono text-ink-light/50 -mt-1">
              15 Jan 2026 · 15 January 2026 · 15/01/2026 · 2026-01-15
            </div>
          </div>

          {/* ── 2-month calendar ── */}
          <DayPicker
            mode="range"
            selected={calSelected}
            onSelect={handleCalendarSelect}
            month={calMonth}
            onMonthChange={setCalMonth}
            numberOfMonths={2}
            disabled={maxDate ? [{ after: maxDate }] : []}
            classNames={calendarClassNames}
            components={{ Chevron: CalendarChevron }}
          />

          {/* ── Footer ── */}
          <div className="border-t border-line px-4 py-2.5 flex justify-between items-center gap-4">
            <span className="font-mono text-[10px] text-ink-light uppercase tracking-widest">
              {phase === 'from'
                ? fromDate && toDate
                  ? `Click new start · or click "To" field above to change end only`
                  : 'Step 1 of 2 — click a start date'
                : 'Step 2 of 2 — navigate ‹ › then click end date'}
            </span>
            {hasValue && (
              <button
                onClick={() => { onChange({ from: '', to: '' }); setOpen(false) }}
                className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-ink-light hover:text-danger transition-colors"
              >
                Clear
              </button>
            )}
          </div>

        </CalendarPopup>
      )}
    </>
  )
}
