// The telnes look, shared by the bar above the prompt and the Agents pane:
// its colors, a way to measure text before drawing it, and the halftone bar.
// Drawings are SVG images, so they can only use fonts installed on the PC.

/** The telnes colors (see the telnes-design skill's tokens). */
export const C = {
  bg: '#121212',
  panel: '#1d1d1f',
  raise: '#222226',
  text: '#f4f4f5',
  text2: '#d9d9dd',
  muted: '#b4b4ba',
  accent: '#ffd23f',
  ink: '#111111',
  danger: '#ff9a9a',
  success: '#5fd38d',
  /** The halftone bar's own pill, track dots and edge. */
  track: '#1a1a1a',
  trackEdge: '#2c2c2c',
  trackDot: '#3c3c3c',
} as const

/** A hairline on a dark surface: white at 8%. */
export const HAIRLINE = 'stroke="#ffffff" stroke-opacity="0.08"'

export const FONT = "Manrope, 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"

export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Rough widths of Segoe UI's characters, in ems: enough to keep text inside its box.
const NARROW = new Set("ijl|!.,:;'`")
const SLIM = new Set('frt()[]{}/\\-"I1')
const WIDE = new Set('mwMW@%')
const charWidth = (ch: string): number => {
  if (ch === ' ') return 0.27
  if (NARROW.has(ch)) return 0.25
  if (SLIM.has(ch)) return 0.36
  if (WIDE.has(ch)) return 0.86
  if (ch >= '0' && ch <= '9') return 0.55
  if (ch >= 'A' && ch <= 'Z') return 0.63
  if (ch.charCodeAt(0) > 0x2e7f) return 1 // CJK and other full-width letters
  return 0.52
}

/** About how many pixels `text` takes at `size` and `weight`; it errs on the wide side. */
export const textWidth = (text: string, size: number, weight = 400): number => {
  let ems = 0
  for (const ch of text) ems += charWidth(ch)
  return ems * size * (weight >= 700 ? 1.08 : weight >= 600 ? 1.05 : 1)
}

/** `text` shortened with "…" so it fits in `max` pixels. */
export const fit = (text: string, max: number, size: number, weight = 400): string => {
  if (textWidth(text, size, weight) <= max) return text
  const chars = [...text]
  while (chars.length > 0 && textWidth(`${chars.join('')}…`, size, weight) > max) chars.pop()
  return chars.length === 0 ? '' : `${chars.join('').trimEnd()}…`
}

// ---------------------------------------------------------------- halftone

const DOT_STEP = 6
const DOT_SIZES = 8
/** Dot diameters from small to large (the telnes brand recipe: 1.8 to 5.4 px). */
const dotSize = (i: number): string => (1.8 + (3.6 * i) / (DOT_SIZES - 1)).toFixed(2)

/** Where the dots sit: two staggered rows, the second half a step along. */
const dotsIn = (x: number, y: number, w: number, h: number): { cx: number; cy: number }[] => {
  const all: { cx: number; cy: number }[] = []
  for (let cx = x + DOT_STEP; cx <= x + w - DOT_STEP; cx += DOT_STEP) {
    all.push({ cx, cy: y + h / 2 - 3 })
    if (cx + DOT_STEP / 2 <= x + w - DOT_STEP) all.push({ cx: cx + DOT_STEP / 2, cy: y + h / 2 + 3 })
  }
  return all
}

/** Dots of one size share one path: a zero-length stroke with round caps per dot. */
const paths = (bySize: string[], color: string): string =>
  bySize
    .map((d, i) =>
      d === '' ? '' : `<path d="${d}" fill="none" stroke="${color}" stroke-width="${dotSize(i)}" stroke-linecap="round"/>`,
    )
    .join('')

export type Halftone = {
  x: number
  y: number
  w: number
  h: number
  /** 0 to 1; null when the amount of work isn't known, which draws a sweeping cluster. */
  fraction: number | null
  /** Unique within the drawing, for the sweep's clip. */
  id: string
}

/**
 * The telnes halftone bar: a dark pill whose dots swell toward the edge of the done
 * part. With no known end, a cluster of swelling dots sweeps along it (CSS animation
 * inside the image, stepping one dot at a time so it stays on the grid; it stands
 * still when the PC asks for reduced motion).
 */
export const halftone = (b: Halftone): string => {
  const pill = `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${b.h / 2}" fill="${C.track}" stroke="${C.trackEdge}"/>`
  const dots = dotsIn(b.x, b.y, b.w, b.h)
  let faint = ''

  if (b.fraction !== null) {
    const edge = b.x + b.w * Math.max(0, Math.min(1, b.fraction))
    const bySize: string[] = Array.from({ length: DOT_SIZES }, () => '')
    for (const d of dots) {
      if (d.cx < edge) {
        const size = Math.round(((d.cx - b.x) / Math.max(1, edge - b.x)) * (DOT_SIZES - 1))
        bySize[size] += `M${d.cx} ${d.cy}h.01`
      } else {
        faint += `M${d.cx} ${d.cy}h.01`
      }
    }
    return pill + paths(bySize, C.accent) + paths([faint], C.trackDot)
  }

  for (const d of dots) faint += `M${d.cx} ${d.cy}h.01`

  // The cluster, drawn at the bar's left and moved along by whole dot steps.
  const tail = Math.max(DOT_STEP * 6, Math.round((b.w * 0.3) / DOT_STEP) * DOT_STEP)
  const bySize: string[] = Array.from({ length: DOT_SIZES }, () => '')
  for (const d of dotsIn(b.x, b.y, tail + DOT_STEP * 2, b.h)) {
    const size = Math.round(((d.cx - b.x) / tail) * (DOT_SIZES - 1))
    if (size >= 0 && size < DOT_SIZES) bySize[size] += `M${d.cx} ${d.cy}h.01`
  }
  const from = -tail
  const to = Math.round(b.w / DOT_STEP) * DOT_STEP
  const steps = Math.round((to - from) / DOT_STEP)
  const seconds = Math.max(1.2, (to - from) / 320).toFixed(2)
  const rest = Math.round((b.w * 0.35) / DOT_STEP) * DOT_STEP

  return (
    `<style>` +
    `@keyframes sweep-${b.id}{from{transform:translateX(${from}px)}to{transform:translateX(${to}px)}}` +
    `.sweep-${b.id}{transform:translateX(${rest}px);animation:sweep-${b.id} ${seconds}s steps(${steps}) infinite}` +
    `@media (prefers-reduced-motion: reduce){.sweep-${b.id}{animation:none}}` +
    `</style>` +
    `<clipPath id="clip-${b.id}"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${b.h / 2}"/></clipPath>` +
    pill +
    paths([faint], C.trackDot) +
    `<g clip-path="url(#clip-${b.id})"><g class="sweep-${b.id}">${paths(bySize, C.accent)}</g></g>`
  )
}

/** A small round status mark centered on (cx, cy). */
export const statusMark = (
  status: 'running' | 'done' | 'failed' | 'stopped' | 'waiting',
  cx: number,
  cy: number,
): string => {
  if (status === 'done') {
    return `<path d="M${cx - 5} ${cy}l3.6 3.8L${cx + 5.5} ${cy - 4}" fill="none" stroke="${C.success}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`
  }
  if (status === 'failed') {
    return `<path d="M${cx - 4} ${cy - 4}l8 8M${cx + 4} ${cy - 4}l-8 8" fill="none" stroke="${C.danger}" stroke-width="2.2" stroke-linecap="round"/>`
  }
  if (status === 'stopped') return `<rect x="${cx - 4}" y="${cy - 4}" width="8" height="8" rx="2" fill="${C.muted}"/>`
  if (status === 'waiting') return `<circle cx="${cx}" cy="${cy}" r="4.5" fill="none" stroke="${C.muted}" stroke-width="1.8"/>`
  return `<circle cx="${cx}" cy="${cy}" r="5.5" fill="${C.accent}"/>`
}
