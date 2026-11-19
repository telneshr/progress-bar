// How the Agents pane draws a subagent as a card, and the summary strip above them.
// Everything is one small SVG per card, in the telnes colors.

import type { AgentInfo } from 'claude-code'

import type { Step } from '../types'
import { iconInner, KIND_COLOR } from './icons'
import type { IconKind } from './icons'
import { C, esc, fit, FONT, HAIRLINE, halftone, statusMark, textWidth } from './look'

/** One subagent as the pane shows it. */
export type Row = {
  id: string
  title: string
  type: string
  kind: IconKind
  model: string
  effort: string
  status: AgentInfo['status']
  list: Step[]
  hint: string
  tokens: number
  seconds: number | null
}

export const CARD_H = 100
export const STATS_H = 68

export const fmtTime = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

export const fmtTokens = (n: number): string =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)

/** "Sonnet 5.5, low effort", or whichever half is known. */
export const modelLine = (model: string, effort: string): string =>
  [model, effort === '' ? '' : `${effort.toLowerCase()} effort`].filter(x => x !== '').join(', ')

/** How a subagent's state reads as a mark. */
export const markOf = (status: AgentInfo['status']): Parameters<typeof statusMark>[0] =>
  status === 'completed'
    ? 'done'
    : status === 'failed'
      ? 'failed'
      : status === 'killed' || status === 'idle'
        ? 'stopped'
        : status === 'pending'
          ? 'waiting'
          : 'running'

/** One subagent's card, `width` pixels wide. */
export const cardSvg = (r: Row, width: number): string => {
  const left = 84
  const right = width - 18
  const isPlanned = r.status === 'pending'
  const isEnded = r.status === 'completed' || r.status === 'failed' || r.status === 'killed'
  const done = r.list.filter(s => s.status === 'completed').length
  const current = r.list.find(s => s.status === 'in_progress') ?? r.list.find(s => s.status === 'pending')

  const label = isPlanned
    ? 'Waiting to start'
    : r.status === 'failed'
      ? 'Stopped with an error'
      : r.status === 'killed'
        ? 'Stopped'
        : isEnded
          ? 'Done'
          : (current?.text ?? (r.hint !== '' ? r.hint : 'Working'))
  const time = r.seconds === null ? '' : fmtTime(r.seconds)
  const corner = isEnded
    ? `${fmtTokens(r.tokens)} tokens`
    : r.list.length > 0
      ? `Step ${Math.min(done + 1, r.list.length)} of ${r.list.length}`
      : ''

  const fraction = r.list.length > 0 ? done / r.list.length : isEnded ? 1 : null
  const barW = Math.max(60, right - left - 52)
  const model = modelLine(r.model, r.effort)
  const type = fit(r.type, (right - left) * 0.5, 13, 600)
  const typeW = textWidth(type, 13, 600)
  const cornerW = textWidth(corner, 13) + 16

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${CARD_H}" width="${width}" height="${CARD_H}" font-family="${FONT}">` +
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${CARD_H - 1}" rx="16" fill="${C.panel}" ${HAIRLINE}/>` +
    `<svg x="16" y="26" width="52" height="44" viewBox="0 0 24 20"${isPlanned ? ' opacity="0.45"' : ''}>${iconInner(r.kind)}</svg>` +
    `<text x="${left}" y="30" font-size="16" font-weight="700" fill="${C.text}">${esc(fit(r.title, right - left - 30, 16, 700))}</text>` +
    statusMark(markOf(r.status), right - 6, 25) +
    `<text x="${left}" y="50" font-size="13" font-weight="600" fill="${KIND_COLOR[r.kind]}">${esc(type)}</text>` +
    (model === ''
      ? ''
      : `<text x="${left + typeW + 10}" y="50" font-size="13" fill="${C.muted}">${esc(fit(model, right - left - typeW - 10, 13))}</text>`) +
    (isPlanned
      ? ''
      : halftone({ x: left, y: 59, w: barW, h: 14, fraction, id: `c${r.id.replace(/[^a-zA-Z0-9]/g, '')}` }) +
        `<text x="${right}" y="70.5" font-size="13" fill="${C.text2}" text-anchor="end" style="font-variant-numeric:tabular-nums">${esc(time)}</text>`) +
    `<text x="${left}" y="91" font-size="13" fill="${r.status === 'failed' ? C.danger : C.muted}">${esc(fit(label, right - left - cornerW, 13))}</text>` +
    `<text x="${right}" y="91" font-size="13" fill="${C.muted}" text-anchor="end">${esc(corner)}</text>` +
    `</svg>`
  )
}

/** The strip of three counts above the cards. */
export const statsSvg = (
  width: number,
  counts: { running: number; planned: number; finished: number },
  seconds: number,
): string => {
  const gap = 12
  const tile = (width - gap * 2) / 3
  const items: [string, string, string][] = [
    ['Running', String(counts.running), counts.running > 0 ? C.accent : C.text],
    counts.planned > 0
      ? ['Planned', String(counts.planned), C.text]
      : ['Finished', String(counts.finished), C.text],
    ['Time', fmtTime(seconds), C.text],
  ]

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${STATS_H}" width="${width}" height="${STATS_H}" font-family="${FONT}">` +
    items
      .map(([name, value, color], i) => {
        const x = i * (tile + gap)
        return (
          `<rect x="${x + 0.5}" y="0.5" width="${tile - 1}" height="${STATS_H - 1}" rx="16" fill="${C.panel}" ${HAIRLINE}/>` +
          `<text x="${x + 16}" y="24" font-size="13" font-weight="600" fill="${C.muted}">${name}</text>` +
          `<text x="${x + 16}" y="53" font-size="24" font-weight="800" fill="${color}" style="font-variant-numeric:tabular-nums">${esc(value)}</text>`
        )
      })
      .join('') +
    `</svg>`
  )
}
