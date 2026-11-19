// The bar above the prompt, drawn as one SVG in the telnes look.

import { C, esc, fit, FONT, HAIRLINE, halftone, statusMark, textWidth } from './look'

/** Pixels the desktop gives one character column: the pill is sized from it. */
export const PX_PER_COLUMN = 8.3
export const MIN_WIDTH = 520
export const MAX_WIDTH = 1400
export const H = 44
/** The corner radius, the same as the message box under the bar. */
const RADIUS = 16
const TRACK_H = 22

// The Claude Code icon, the path of claudecode-color.svg (a 24 by 24 box, the
// drawing itself spanning rows 5 to 20). The eyes are holes in the path.
const ICON_PATH =
  'M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z'
const ICON_TOP = 5
const ICON_ROWS = 15
const ICON_SCALE = 1.4
const ICON_W = 24 * ICON_SCALE
export const CLAUDE_ORANGE = '#d97757'

/** The quiet pill with the tokens spent: raise color, readable grey text. */
export const tokenPillWidth = (text: string): number => Math.round(textWidth(text, 13, 600) + 28)

export const tokenPillSvg = (text: string): string => {
  const w = tokenPillWidth(text)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 28" width="${w}" height="28" font-family="${FONT}">` +
    `<rect x="0.5" y="0.5" width="${w - 1}" height="27" rx="13.5" fill="${C.raise}" ${HAIRLINE}/>` +
    `<text x="${w / 2}" y="18.5" font-size="13" font-weight="600" fill="${C.text2}" text-anchor="middle">${esc(text)}</text>` +
    `</svg>`
  )
}

export type Pill = {
  title: string
  label: string
  /** 0 to 1, or null while the amount of work is not known. */
  fraction: number | null
  isFinished: boolean
  /** Subagents running right now; the creature shows only when above zero. */
  agents: number
}

// The last drawing, kept: the bar redraws often and mostly with nothing new to say.
let cached = { key: '', svg: '' }

export const pillSvg = (p: Pill, width: number): string => {
  const key = `${width}|${p.title}|${p.label}|${p.fraction}|${p.isFinished}|${p.agents}`
  if (cached.key === key) return cached.svg

  // Left to right: status mark, title, halftone track with its sticker, percentage, subagents.
  const agentsText = `×${p.agents}`
  const agentsW = p.agents > 0 ? ICON_W + 8 + textWidth(agentsText, 15, 600) + 16 : 0
  const percent = p.fraction === null ? '' : `${Math.round(p.fraction * 100)}%`
  const percentW = percent === '' ? 0 : textWidth('100%', 14) + 14
  const right = width - 20 - agentsW
  const maxTitle = Math.max(160, Math.min(440, width * 0.36))
  const title = fit(p.title, maxTitle, 15, 600)
  const titleEnd = 44 + textWidth(title, 15, 600)

  const track = { x: Math.round(titleEnd + 18), y: (H - TRACK_H) / 2, h: TRACK_H, w: 0 }
  track.w = Math.max(120, Math.round(right - percentW - track.x))

  // The sticker rides the edge of the fill; with no known end it waits at the start.
  const label = fit(p.label, 200, 13, 600)
  const labelW = Math.round(textWidth(label, 13, 600) + 24)
  const fillEnd = track.x + track.w * (p.fraction ?? 0)
  const labelX = Math.max(track.x, Math.min(track.x + track.w - labelW, fillEnd - labelW / 2))

  let agents = ''
  if (p.agents > 0) {
    const x0 = width - 20 - agentsW + 12
    const y0 = (H - ICON_ROWS * ICON_SCALE) / 2
    agents +=
      `<path transform="translate(${x0} ${y0}) scale(${ICON_SCALE}) translate(0 ${-ICON_TOP})" d="${ICON_PATH}" fill="${CLAUDE_ORANGE}" fill-rule="evenodd"/>` +
      `<text x="${x0 + ICON_W + 8}" y="27.5" font-size="15" font-weight="600" fill="${C.text}">${agentsText}</text>`
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${H}" width="${width}" height="${H}" font-family="${FONT}">` +
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${H - 1}" rx="${RADIUS}" fill="${C.bg}" ${HAIRLINE}/>` +
    statusMark(p.isFinished ? 'done' : 'running', 25, 22) +
    `<text x="44" y="27.5" font-size="15" font-weight="600" fill="${C.text}">${esc(title)}</text>` +
    halftone({ ...track, fraction: p.fraction, id: 'bar' }) +
    `<rect x="${labelX.toFixed(1)}" y="9" width="${labelW}" height="26" rx="13" fill="${C.accent}" stroke="${C.ink}" stroke-width="2"/>` +
    `<text x="${(labelX + labelW / 2).toFixed(1)}" y="26.5" font-size="13" font-weight="600" fill="${C.ink}" text-anchor="middle">${esc(label)}</text>` +
    (percent === ''
      ? ''
      : `<text x="${right}" y="27.5" font-size="14" font-weight="600" fill="${p.isFinished ? C.success : C.muted}" text-anchor="end" style="font-variant-numeric:tabular-nums">${percent}</text>`) +
    agents +
    `</svg>`

  cached = { key, svg }
  return svg
}

