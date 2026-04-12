/**
 * Shared Framer Motion animation variants.
 * Explicitly typed so TypeScript accepts the bezier ease tuples without complaints.
 */
import type { Variants } from 'framer-motion'

/** Cubic ease-out: fast reveal, smooth landing. [x1,y1,x2,y2] cubic bezier. */
export const EASE_OUT: [number, number, number, number] = [0.25, 0.8, 0.25, 1]

/** Material-style ease-in-out. */
export const EASE_IN_OUT: [number, number, number, number] = [0.4, 0, 0.2, 1]

/** Stagger container — staggers children 0.07 s apart, 0.05 s initial delay. */
export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
}

/**
 * Slide up + fade in. The default workhorse for cards, list rows, and panels.
 * Pair with `containerVariants` on the parent.
 */
export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } },
}

/** Slide in from the left + fade in. Right-column cards or sidebar panels. */
export const slideFromLeftVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: EASE_OUT } },
}

/** Scale up from 96% + fade in. Hero / feature cards. */
export const scaleUpVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: EASE_OUT } },
}

/** Simple opacity fade. Supplementary / decorative content. */
export const fadeInVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4 } },
}
