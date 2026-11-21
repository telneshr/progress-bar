// The Claude Code icon (the path of claudecode-color.svg) with one accessory per
// kind of subagent. The drawing is 24 wide and 20 tall; the accessories sit above
// the head or over the eyes.

const BODY =
  'M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z'

export type IconKind = 'general' | 'explore' | 'plan' | 'build' | 'review' | 'design'

const ACCESSORY: Record<IconKind, string> = {
  general: '',
  explore:
    '<path d="M6 5.2Q6 1.2 12 1.2Q18 1.2 18 5.2Z" fill="#c9a66b"/><rect x="3.4" y="4.3" width="17.2" height="1.5" rx="0.75" fill="#a8854d"/><rect x="6" y="3.3" width="12" height="0.9" fill="#6b5530"/>',
  plan:
    '<polygon points="12,0.4 21.5,3 12,5.4 2.5,3" fill="#3a3a3a" stroke="#8a8a8a" stroke-width="0.3"/><rect x="7" y="3.6" width="10" height="1.8" fill="#3a3a3a"/><line x1="21" y1="3" x2="21" y2="6.8" stroke="#ffd23f" stroke-width="0.7"/><circle cx="21" cy="7.3" r="0.8" fill="#ffd23f"/>',
  build:
    '<path d="M5.5 5.2Q5.5 0.6 12 0.6Q18.5 0.6 18.5 5.2Z" fill="#ffd23f"/><rect x="4" y="4.3" width="16" height="1.4" rx="0.7" fill="#ffd23f"/><rect x="11" y="0.6" width="2" height="3.8" fill="#e0b21f"/>',
  review:
    '<circle cx="6.75" cy="9.5" r="2.4" fill="none" stroke="#f2f2f2" stroke-width="0.6"/><circle cx="17.25" cy="9.5" r="2.4" fill="none" stroke="#f2f2f2" stroke-width="0.6"/><line x1="9.15" y1="9.5" x2="14.85" y2="9.5" stroke="#f2f2f2" stroke-width="0.6"/>',
  design:
    '<ellipse cx="11.5" cy="3.2" rx="6.5" ry="2.3" fill="#d4537e" transform="rotate(-8 11.5 3.2)"/><rect x="11" y="0.4" width="1.2" height="1.4" fill="#d4537e"/>',
}

/** Which accessory a subagent type gets: by words in its type name. */
export const iconKind = (type: string): IconKind => {
  const t = type.toLowerCase()
  if (/explor|search|research/.test(t)) return 'explore'
  if (/plan|architect/.test(t)) return 'plan'
  if (/review|audit|verif|check/.test(t)) return 'review'
  if (/design|write|writer|doc|guide/.test(t)) return 'design'
  if (/implement|build|fix|test|worker/.test(t)) return 'build'
  return 'general'
}

/** The type's colored word in a row. */
export const KIND_COLOR: Record<IconKind, string> = {
  general: '#9aa0a6',
  explore: '#c9a66b',
  plan: '#8f8cf5',
  build: '#ffd23f',
  review: '#6fb3ff',
  design: '#ee7fa8',
}

/** The icon's shapes alone, in a 24 by 20 box, to nest in another drawing. */
export const iconInner = (kind: IconKind): string =>
  `<path fill="#d97757" fill-rule="evenodd" d="${BODY}"/>${ACCESSORY[kind]}`

export const iconSvg = (kind: IconKind, isDim: boolean): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 20"${isDim ? ' opacity="0.45"' : ''}>` +
  `${iconInner(kind)}</svg>`

// Which job a description's first telling word points to, in order of the roles below.
const ROLE_WORDS: [RegExp, string, IconKind][] = [
  [/^(review|audit|verif|inspect|critiqu|proofread|assess)/, 'Review', 'review'],
  [/^(plan|architect|outline|scope|propose|design)/, 'Plan', 'plan'],
  [/^(implement|build|fix|refactor|add|updat|chang|creat|port|migrat|code|patch|wire|install|set|make|run|test|debug)/, 'Build', 'build'],
  [/^(write|writ|draft|doc|readme|rewrit|translat|edit)/, 'Writing', 'design'],
  [/^(summar|research|find|search|look|investigat|explor|compar|gather|read|fetch|scan|list|collect|check|analy|map|survey|learn|study|locat|trac|inventor|fact)/, 'Research', 'explore'],
]

/** `statusline-setup` becomes `Statusline setup`. */
const niceType = (type: string): string => {
  const t = type.replace(/[-_]+/g, ' ').trim()
  return t === '' ? 'Helper' : t.charAt(0).toUpperCase() + t.slice(1)
}

/**
 * What a subagent is for, in a word. Its type when that says something (Explore, Plan, a
 * custom agent); for a general-purpose one, a guess from the first telling word of its task.
 */
export const roleOf = (type: string, description: string): { word: string; kind: IconKind } => {
  if (!/^general/i.test(type) && type !== '') return { word: niceType(type), kind: iconKind(type) }
  for (const word of description.toLowerCase().split(/[^a-z]+/)) {
    if (word.length < 3) continue
    for (const [re, name, kind] of ROLE_WORDS) if (re.test(word)) return { word: name, kind }
  }
  return { word: 'Helper', kind: 'general' }
}
