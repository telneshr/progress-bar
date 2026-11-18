// How the Agents pane draws a subagent as a card, and the summary strip above them.
// Everything is one small SVG per card, in the telnes colors.

import type { AgentInfo } from 'claude-code'

import type { Step } from '../types'
import { iconInner, KIND_COLOR } from './icons'
import type { IconKind } from './icons'

const YELLOW = '#ffd23f'
const GREEN = '#5fd38d'
const RED = '#e24b4a'
const GREY = '#9aa0a6'

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

export const CARD_H = 96
export const STATS_H = 64

export const fmtTime = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

export const fmtTokens = (n: number): string =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const clip = (s: string, max: number): string =>
  max < 2 ? '' : s.length > max ? `${s.slice(0, max - 1)}…` : s

const SIZES = 8
const STEP = 6

/**
 * A halftone bar: dots swell toward the edge of the done part. With no known end
 * (`fraction` null) a cluster of swelling dots sweeps along it, a step each redraw.
 * Dots of one size share one path.
 */
const bar = (x: number, y: number, w: number, h: number, fraction: number | null, sweep: number): string => {
  const sizes: string[] = Array.from({ length: SIZES }, () => '')
  let faint = ''
  const cols = Math.floor(w / STEP) - 2
  const edge = fraction === null ? x + w * sweep : x + w * fraction
  const tail = w * 0.3

  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < 2; r += 1) {
      const cx = x + STEP + c * STEP + (r === 1 ? STEP / 2 : 0)
      const cy = y + h / 2 + (r === 0 ? -3 : 3)
      let size = -1
      if (fraction === null) {
        if (cx <= edge && cx >= edge - tail) size = Math.round((1 - (edge - cx) / tail) * (SIZES - 1))
      } else if (cx < edge) {
        size = Math.round(((cx - x) / Math.max(1, edge - x)) * (SIZES - 1))
      }
      if (size >= 0) sizes[size] += `M${cx} ${cy}h.01`
      else faint += `M${cx} ${cy}h.01`
    }
  }

  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="#1a1a1a" stroke="#2c2c2c"/>` +
    sizes
      .map((d, i) =>
        d === ''
          ? ''
          : `<path d="${d}" fill="none" stroke="${YELLOW}" stroke-width="${(2 * (0.9 + (1.5 * i) / (SIZES - 1))).toFixed(1)}" stroke-linecap="round"/>`,
      )
      .join('') +
    (faint === '' ? '' : `<path d="${faint}" fill="none" stroke="#383838" stroke-width="1.6" stroke-linecap="round"/>`)
  )
}

const marker = (status: AgentInfo['status'], cx: number, cy: number): string => {
  if (status === 'completed') {
    return `<path d="M${cx - 5} ${cy}l3.6 3.8L${cx + 5.5} ${cy - 4}" fill="none" stroke="${GREEN}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`
  }
  if (status === 'failed') {
    return `<path d="M${cx - 4} ${cy - 4}l8 8M${cx + 4} ${cy - 4}l-8 8" fill="none" stroke="${RED}" stroke-width="2.2" stroke-linecap="round"/>`
  }
  if (status === 'killed' || status === 'idle') {
    return `<rect x="${cx - 4}" y="${cy - 4}" width="8" height="8" rx="1.5" fill="${GREY}"/>`
  }
  if (status === 'pending') {
    return `<circle cx="${cx}" cy="${cy}" r="4.5" fill="none" stroke="${GREY}" stroke-width="1.8"/>`
  }
  return `<circle cx="${cx}" cy="${cy}" r="5.5" fill="${YELLOW}"/>`
}

/** One subagent's card, `width` pixels wide. */
export const cardSvg = (r: Row, width: number, now: number): string => {
  const left = 88
  const isPlanned = r.status === 'pending'
  const isEnded = r.status === 'completed' || r.status === 'failed' || r.status === 'killed'
  const done = r.list.filter(s => s.status === 'completed').length
  const current = r.list.find(s => s.status === 'in_progress') ?? r.list.find(s => s.status === 'pending')

  const detail = [r.model, r.effort].filter(x => x !== '').join(' · ')
  const label = isPlanned
    ? 'Waiting to start'
    : isEnded
      ? 'Done'
      : (current?.text ?? (r.hint !== '' ? r.hint : 'Working'))
  const rightOfBar = r.seconds === null ? '' : fmtTime(r.seconds)
  const rightOfHint = isEnded
    ? `${fmtTokens(r.tokens)} tokens`
    : r.list.length > 0
      ? `step ${Math.min(done + 1, r.list.length)}/${r.list.length}`
      : ''

  const barW = Math.max(60, width - left - 70)
  const fraction = r.list.length > 0 ? done / r.list.length : isEnded ? 1 : null
  const sweep = (Math.floor(now / 1000) % 5) / 5 + 0.1
  const chars = Math.max(8, Math.floor((width - left - 50) / 9.5))

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${CARD_H}" width="${width}" height="${CARD_H}" font-family="Segoe UI, system-ui, sans-serif">` +
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${CARD_H - 1}" rx="14" fill="#202020" stroke="#2e2e2e"/>` +
    `<svg x="16" y="24" width="56" height="47" viewBox="0 0 24 20"${isPlanned ? ' opacity="0.45"' : ''}>${iconInner(r.kind)}</svg>` +
    `<text x="${left}" y="29" font-size="17" font-weight="600" fill="#f2f2f2">${esc(clip(r.title, chars))}</text>` +
    marker(r.status, width - 26, 24) +
    `<text x="${left}" y="48" font-size="13"><tspan fill="${KIND_COLOR[r.kind]}" font-weight="600">${esc(r.type)}</tspan><tspan fill="${GREY}">${esc(detail === '' ? '' : `  ${detail}`)}</tspan></text>` +
    (isPlanned
      ? ''
      : bar(left, 57, barW, 14, fraction, sweep) +
        `<text x="${width - 16}" y="69" font-size="13" fill="#bdbdbd" text-anchor="end">${esc(rightOfBar)}</text>`) +
    `<text x="${left}" y="89" font-size="12.5" fill="${GREY}">${esc(clip(label, Math.floor(chars * 0.9)))}</text>` +
    `<text x="${width - 16}" y="89" font-size="12.5" fill="${GREY}" text-anchor="end">${esc(rightOfHint)}</text>` +
    `</svg>`
  )
}

/** The strip of three counts above the cards. */
export const statsSvg = (
  width: number,
  counts: { running: number; planned: number; finished: number },
  seconds: number,
): string => {
  const gap = 10
  const tile = (width - gap * 2) / 3
  const items: [string, string][] = [
    ['Running', String(counts.running)],
    [counts.planned > 0 ? 'Planned' : 'Finished', String(counts.planned > 0 ? counts.planned : counts.finished)],
    ['Time', fmtTime(seconds)],
  ]

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${STATS_H}" width="${width}" height="${STATS_H}" font-family="Segoe UI, system-ui, sans-serif">` +
    items
      .map(([name, value], i) => {
        const x = i * (tile + gap)
        return (
          `<rect x="${x + 0.5}" y="0.5" width="${tile - 1}" height="${STATS_H - 1}" rx="12" fill="#202020" stroke="#2e2e2e"/>` +
          `<text x="${x + 14}" y="22" font-size="12.5" fill="${GREY}">${name}</text>` +
          `<text x="${x + 14}" y="49" font-size="24" font-weight="600" fill="${i === 0 ? YELLOW : '#f2f2f2'}">${esc(value)}</text>`
        )
      })
      .join('') +
    `</svg>`
  )
}
