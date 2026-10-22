import { type Variants } from "motion/react"
import { type CSSProperties } from "react"

/**
 * The two motion helpers the sign-in and reset pages share.
 *
 * They used to live beside a marketing landing page that no longer exists —
 * a page that advertised a product the platform does not sell. The animation
 * vocabulary outlived the page that needed it, so it moved here rather than
 * being deleted with it.
 */

/** The easing curve the console's transitions share. */
export const EASE = [0.22, 1, 0.36, 1] as const

/**
 * A staged entrance: each element waits for the one before it.
 *
 * The index is a CSS custom property, so the delay lives in the stylesheet
 * rather than in a JavaScript timer — a timer would keep running while the
 * tab is in the background, and the elements would arrive in a different
 * order than the page draws them.
 */
export const step = (i: number) => ({ "--i": i }) as CSSProperties

/** The press preset: a small scale-down while held. */
export const pressable: Variants = {
  whileTap: { scale: 0.97 },
}
