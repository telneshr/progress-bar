import { atom, read, update } from 'claude-code'
import type { AgentInfo, ElementTable, Register } from 'claude-code'

import type { Activity, AgentExtra, AgentSnap, Step } from '../types'
import { CARD_H, cardSvg, fmtTime, fmtTokens, markOf, modelLine, statsSvg, STATS_H } from './card'
import { tookText } from './look'
import type { Row } from './card'
import { iconKind, KIND_COLOR } from './icons'
import { C } from './look'
import { CLAUDE_ORANGE, H, MAX_WIDTH, MIN_WIDTH, pillSvg, PX_PER_COLUMN, tokenPillSvg, tokenPillWidth } from './pill'
import type { Pill } from './pill'

const PANE = 'agents'

const steps = atom({ plugin: 'progress-bar', key: 'steps' } as const, [] as Step[])
const activity = atom(
  { plugin: 'progress-bar', key: 'activity' } as const,
  { tool: '', calls: 0, pulse: 0, taskStart: 0 } as Activity,
)
const agentExtras = atom(
  { plugin: 'progress-bar', key: 'agents' } as const,
  {} as Record<string, AgentExtra>,
)
const closedSections = atom({ plugin: 'progress-bar', key: 'closed' } as const, [] as string[])

const BAR_WIDTH = 20
const PLAN_TOOL = 'mcp__ccd_turn__update_plan'
const WRAP_TOOL = 'mcp__ccd_turn__wrap_up'

type Loose = Record<string, unknown>

const isStatus = (s: unknown): s is Step['status'] =>
  s === 'pending' || s === 'in_progress' || s === 'completed'

/** Mark the running step done and start the next waiting one. */
const advance = (list: Step[]): Step[] => {
  const next = list.map(s => ({ ...s }))
  const running = next.findIndex(s => s.status === 'in_progress')
  if (running >= 0) next[running]!.status = 'completed'
  const waiting = next.findIndex(s => s.status === 'pending')
  if (waiting >= 0) next[waiting]!.status = 'in_progress'
  return next
}

/** The app's own task list tool: `items`, `advance`, `done` and `start`. */
const applyPlan = (list: Step[], input: Loose): Step[] => {
  let next = list

  if (Array.isArray(input.items)) {
    next = (input.items as Loose[]).map(item => ({
      text: String(item.content ?? ''),
      status: isStatus(item.status) ? item.status : 'pending',
    }))
  }
  if (input.advance === true) next = advance(next)
  if (Array.isArray(input.done)) {
    const done = new Set((input.done as number[]).map(n => n - 1))
    next = next.map((s, i) => (done.has(i) ? { ...s, status: 'completed' as const } : s))
  }
  if (typeof input.start === 'number') {
    const at = input.start - 1
    next = next.map((s, i) => (i === at ? { ...s, status: 'in_progress' as const } : s))
  }
  return next
}

const applyTodos = (input: Loose): Step[] =>
  ((input.todos as Loose[] | undefined) ?? []).map(t => ({
    text: String((t.status === 'in_progress' ? t.activeForm : t.content) ?? t.content ?? ''),
    status: isStatus(t.status) ? t.status : 'pending',
  }))

/** How a tool call changes a step list, or undefined when it does not. */
const stepsChange = (
  name: string,
  input: Loose,
  createdId: string | undefined,
): ((list: Step[]) => Step[]) | undefined => {
  if (name === PLAN_TOOL) return list => applyPlan(list, input)
  if (name === WRAP_TOOL) return list => list.map(s => ({ ...s, status: 'completed' as const }))
  if (name === 'TodoWrite') return () => applyTodos(input)
  if (name === 'TaskCreate') {
    return list => [
      ...list,
      {
        text: String(input.activeForm ?? input.subject ?? ''),
        status: 'pending' as const,
        id: createdId,
      },
    ]
  }
  if (name === 'TaskUpdate') {
    const id = String(input.taskId ?? '')
    const status = input.status
    return list =>
      status === 'deleted'
        ? list.filter(s => s.id !== id)
        : list.map(s =>
            s.id === id && isStatus(status)
              ? { ...s, status, text: String(input.activeForm ?? s.text) }
              : s,
          )
  }
  return undefined
}

/** One subagent's record, changed; a new one is made when there is none. */
const touch = (
  all: Record<string, AgentExtra>,
  id: string,
  change: (one: AgentExtra) => AgentExtra,
): Record<string, AgentExtra> => ({
  ...all,
  [id]: change(all[id] ?? { steps: [], lastTool: '', endedAt: null }),
})

const isLive = (s: AgentInfo['status']): boolean =>
  s === 'running' || s === 'waiting' || s === 'pending'

const snapOf = (a: AgentInfo): AgentSnap => ({
  id: a.id,
  description: a.description,
  type: a.type,
  status: a.status,
  label: a.label,
  model: a.model,
  effort: a.effort,
  startTime: a.startTime,
  tokenCount: a.tokenCount,
})

/** Every local subagent the roster lists, remembered; the rest of each record is kept. */
const withSnaps = (all: Record<string, AgentExtra>, roster: AgentInfo[]): Record<string, AgentExtra> => {
  const next = { ...all }
  for (const a of roster) {
    if (a.kind !== 'local_agent') continue
    next[a.id] = { ...(next[a.id] ?? { steps: [], lastTool: '', endedAt: null }), snap: snapOf(a) }
  }
  return next
}

/** `low` becomes `Low`. */
const cap = (s: string): string => (s === '' ? s : s.charAt(0).toUpperCase() + s.slice(1))

/** `claude-opus-5-5` becomes `Opus 5.5`. */
const modelName = (id: string | undefined): string => {
  if (id === undefined) return ''
  const clean = id.replace(/\[.*\]$/, '')
  const m = /^claude-([a-z]+)-(\d+)-(\d+)/.exec(clean)
  return m ? `${m[1]!.charAt(0).toUpperCase()}${m[1]!.slice(1)} ${m[2]}.${m[3]}` : clean.replace(/^claude-/, '')
}

const rowOf = (a: AgentSnap, extra: AgentExtra | undefined, now: number): Row => {
  const isLive = a.status === 'running' || a.status === 'waiting'
  const first = a.label.split('\n')[0] ?? ''
  const progress = first !== '' && first !== a.description ? first : ''

  return {
    id: a.id,
    title: clip(a.description === '' ? a.type : a.description, 34),
    type: a.type,
    kind: iconKind(a.type),
    model: modelName(a.model),
    effort: a.effort === undefined ? '' : cap(String(a.effort)),
    status: a.status,
    list: extra?.steps ?? [],
    hint: clip(progress !== '' ? progress : (extra?.lastTool ?? '').replace(/^mcp__[^_]+__/, ''), 40),
    tokens: a.tokenCount,
    seconds: isLive
      ? (now - a.startTime) / 1000
      : extra?.endedAt != null
        ? (extra.endedAt - a.startTime) / 1000
        : null,
  }
}

/** Text bar for the terminal, which cannot draw pictures. */
const bar = (done: number, total: number): string => {
  const filled = total === 0 ? 0 : Math.round((done / total) * BAR_WIDTH)
  return '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled)
}

const clip = (s: string, max: number): string => (s.length > max ? `${s.slice(0, max - 1)}…` : s)

// ---------------------------------------------------------------- the mod

export const register: Register = on => {
  // Subagents running now, and the one-second tick that keeps their clocks moving.
  const running = new Set<string>()
  let tick: { cancel: () => void } | undefined
  let hasOpened = false

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'agent-panel',
      description: 'Show the Agents panel: running, planned and finished subagents',
    })

    return next(e)
  })

  on('command.run', { command: 'agent-panel' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Agents' })

    return { text: 'Agents panel opened.' }
  })

  on('prompt.submit', async ($, e, next) => {
    // A finished subagent's notification, or another agent's message, is not a new
    // task: it must not reset the clock or clear the records of agents that ended.
    const kind = e.origin.kind as string
    if (e.isMeta === true || kind === 'task-notification' || kind === 'peer' || kind === 'peer-send-message') {
      return next(e)
    }

    const now = await $.clock.now()
    await update($, activity, a => ({ tool: '', calls: 0, pulse: a.pulse, taskStart: now, doneMs: null }))
    // A finished list belongs to the last task: start fresh for the next one.
    await update($, steps, list =>
      list.length > 0 && list.every(s => s.status === 'completed') ? [] : list,
    )
    // Records of agents from earlier tasks go; only ones still alive are kept.
    let roster: AgentInfo[] = []
    try {
      roster = await $.agent.list()
    } catch {
      roster = []
    }
    const alive = new Set(roster.filter(a => isLive(a.status)).map(a => a.id))
    await update($, agentExtras, all =>
      Object.fromEntries(Object.entries(all).filter(([id]) => alive.has(id))),
    )

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const name = String(e.tool)
    const input = e as unknown as Loose
    const agentId = e.agentId

    // The main loop's calls feed the bar; a subagent's feed its own row.
    if (agentId === undefined) {
      await update($, activity, a => ({ ...a, tool: name, calls: a.calls + 1 }))
    } else {
      await update($, agentExtras, all => touch(all, agentId, one => ({ ...one, lastTool: name })))
    }

    // TaskCreate says the new task's id only once it has run.
    let ran: unknown
    let createdId: string | undefined
    if (name === 'TaskCreate') {
      ran = await next(e)
      createdId = (ran as { result?: { task?: { id?: string } } } | undefined)?.result?.task?.id
    }

    const change = stepsChange(name, input, createdId)
    if (change !== undefined) {
      if (agentId === undefined) {
        await update($, steps, change)
      } else {
        await update($, agentExtras, all =>
          touch(all, agentId, one => ({ ...one, steps: change(one.steps) })),
        )
      }
    }

    return ran === undefined ? next(e) : (ran as never)
  })

  // A subagent's turns start and end here too: touch the state so the views redraw.
  on('turn.start', async ($, e, next) => {
    const id = e.agentId
    if (id !== undefined) {
      running.add(id)

      // The timer is made before any await, so two starts at once make one. Each
      // second it forgets agents the roster no longer lists as live (one that was
      // killed may never end its turn), and stops when none are left.
      if (tick === undefined) {
        tick = $.clock.every(1000, () => {
          void (async () => {
            try {
              const roster = await $.agent.list()
              const live = new Set(roster.filter(a => isLive(a.status)).map(a => a.id))
              for (const known of running) if (!live.has(known)) running.delete(known)
              // Remember what the roster says, so a finished agent can still be drawn.
              await update($, agentExtras, all => withSnaps(all, roster))
            } catch {
              // Keep what is known; the next second tries again.
            }
            if (running.size === 0 && tick !== undefined) {
              tick.cancel()
              tick = undefined
            }
            await update($, activity, a => ({ ...a, pulse: a.pulse + 1 }))
          })()
        })
      }

      await update($, agentExtras, all => touch(all, id, one => ({ ...one, endedAt: null })))
      try {
        const roster = await $.agent.list()
        await update($, agentExtras, all => withSnaps(all, roster))
      } catch {
        // The tick remembers it a second later.
      }
      await update($, activity, a => ({ ...a, pulse: a.pulse + 1 }))

      if (!hasOpened) {
        hasOpened = true
        void $.ui.open({ id: PANE, title: 'Agents' })
      }
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const id = e.agentId
    // A reply with no task list: the bar stays, finished, until the next message.
    if (id === undefined) {
      const list = await read($, steps)
      if (list.length === 0) {
        await update($, activity, a => ({ ...a, doneMs: e.isAborted ? null : e.durationMs }))
      }
    }
    if (id !== undefined) {
      const now = await $.clock.now()
      running.delete(id)
      let info: AgentInfo | undefined
      try {
        info = (await $.agent.list()).find(a => a.id === id)
      } catch {
        info = undefined
      }
      // Its last roster entry is kept, marked finished, for the Finished list.
      await update($, agentExtras, all =>
        touch(all, id, one => {
          const last = info !== undefined ? snapOf(info) : one.snap
          return {
            ...one,
            endedAt: now,
            snap: last === undefined ? undefined : { ...last, status: isLive(last.status) ? 'completed' : last.status },
          }
        }),
      )
      await update($, activity, a => ({ ...a, pulse: a.pulse + 1 }))

      if (running.size === 0 && tick !== undefined) {
        tick.cancel()
        tick = undefined
      }
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const list = await read($, steps)
    const doing = await read($, activity)

    // The truth about subagents comes from the engine's own roster.
    let agents = 0
    try {
      const roster = await $.agent.list()
      agents = roster.filter(a => a.status === 'running' || a.status === 'pending').length
    } catch {
      agents = 0
    }

    // What the bar says, whichever surface draws it.
    let pill: Pill | null = null
    if (list.length > 0) {
      const done = list.filter(s => s.status === 'completed').length
      const current =
        list.find(s => s.status === 'in_progress') ?? list.find(s => s.status === 'pending')
      pill = {
        title: done === list.length ? 'All done' : (current?.text ?? ''),
        label: `Tasks ${done}/${list.length}`,
        fraction: done / list.length,
        isFinished: done === list.length,
        agents,
      }
    } else if (e.props.isWorking) {
      pill = {
        title: doing.tool === '' ? 'Thinking' : 'Working',
        label: doing.tool === '' ? 'Starting' : doing.tool.replace(/^mcp__[^_]+__/, ''),
        fraction: null,
        isFinished: false,
        agents,
      }
    } else if (doing.doneMs != null) {
      pill = { title: 'Done', label: tookText(doing.doneMs), fraction: 1, isFinished: true, agents }
    }
    if (pill === null) return next(e)

    // The terminal draws no pictures: a bar of blocks stands in.
    if (e.surface === 'terminal') {
      const { Box, Text } = $.ui.resolve(e)
      const subagents = pill.agents > 0 ? `, ${pill.agents} subagents running` : ''

      return (
        <Box>
          <Text color={pill.isFinished ? 'green' : 'cyan'}>
            {pill.fraction === null ? pill.label : bar(Math.round(pill.fraction * list.length), list.length)}
          </Text>
          <Text bold>{pill.fraction === null ? '' : ` ${Math.round(pill.fraction * 100)}% `}</Text>
          <Text dimColor>{`· ${pill.title}${subagents}`}</Text>
        </Box>
      )
    }

    const { Box, Svg } = $.ui.resolve(e)
    const width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(e.props.bodyColumns * PX_PER_COLUMN)))

    return (
      <Box>
        <Svg
          source={pillSvg(pill, width)}
          alt={`${pill.title}: ${pill.label}${pill.agents > 0 ? `, ${pill.agents} subagents running` : ''}`}
          width={width}
          height={H}
        />
      </Box>
    )
  })

  // ------------------------------------------------------------ the Agents pane

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    // The terminal has no Svg: it gets plain rows. Elsewhere each agent is a card.
    const { Box, Text, Button, Progress, Svg } = $.ui.resolve(e) as unknown as ElementTable<'desktop'>
    const hasPictures = e.surface !== 'terminal'
    const paneWidth = Math.max(
      280,
      Math.min(1000, Math.round(e.props.bodyColumns * PX_PER_COLUMN) - 24),
    )

    const act = await read($, activity)
    const extras = await read($, agentExtras)
    const closed = await read($, closedSections)
    const now = await $.clock.now()

    let roster: AgentInfo[] = []
    try {
      roster = await $.agent.list()
    } catch {
      roster = []
    }

    // Agents of this task, and any that still run from an earlier one.
    const since = (act.taskStart ?? 0) - 1000
    const fromRoster = roster
      .filter(a => a.kind === 'local_agent' && (isLive(a.status) || a.startTime >= since))
      .map(a => {
        const extra = extras[a.id]
        // Its turn has ended though the roster still says running: it is finished.
        const ended = extra?.endedAt != null && isLive(a.status)
        return rowOf(ended ? { ...snapOf(a), status: 'completed' as const } : snapOf(a), extra, now)
      })
    // Agents the roster no longer lists are drawn from what was remembered of them.
    const listed = new Set(roster.map(a => a.id))
    const fromMemory = Object.values(extras)
      .filter(x => x.snap !== undefined && !listed.has(x.snap.id) && x.snap.startTime >= since)
      .map(x => {
        const snap = x.snap as AgentSnap
        const status = !isLive(snap.status) ? snap.status : x.endedAt !== null ? 'completed' : 'killed'
        return rowOf({ ...snap, status }, x, now)
      })
    const rows = [...fromRoster, ...fromMemory]

    const running = rows.filter(r => r.status === 'running' || r.status === 'waiting')
    const planned = rows.filter(r => r.status === 'pending')
    const finished = rows.filter(r => !running.includes(r) && !planned.includes(r))
    const spent = finished.reduce((sum, r) => sum + r.tokens, 0)

    // The small form: what reads at a glance.
    if (e.props.placement === 'widget') {
      return (
        <Box>
          <Text color={CLAUDE_ORANGE}>◆ </Text>
          <Text>{`${running.length} running, ${finished.length} done`}</Text>
        </Box>
      )
    }

    const marker = (r: Row) =>
      ({
        done: { glyph: '✓', color: C.success },
        failed: { glyph: '✗', color: C.danger },
        stopped: { glyph: '■', color: C.muted },
        waiting: { glyph: '○', color: C.muted },
        running: { glyph: '●', color: C.accent },
      })[markOf(r.status)]

    const rowView = (r: Row) => {
      const done = r.list.filter(s => s.status === 'completed').length
      const current = r.list.find(s => s.status === 'in_progress') ?? r.list.find(s => s.status === 'pending')
      const isEnded = r.status === 'completed' || r.status === 'failed' || r.status === 'killed'
      const isPlanned = r.status === 'pending'
      const label = isEnded ? 'Done' : (current?.text ?? (r.hint !== '' ? r.hint : 'Working'))
      const detail = modelLine(r.model, r.effort)
      const sign = marker(r)
      const ends = isEnded
        ? `${fmtTokens(r.tokens)} tokens${r.seconds === null ? '' : `, ${fmtTime(r.seconds)}`}`
        : r.seconds === null
          ? ''
          : fmtTime(r.seconds)

      return (
        <Box key={r.id} flexDirection="row" gap={1} paddingY={0}>
          <Text color={CLAUDE_ORANGE}>◆</Text>
          <Box flexDirection="column" flexGrow={1}>
            <Box flexDirection="row" justifyContent="space-between">
              <Text bold>{r.title}</Text>
              <Text color={sign.color}>{sign.glyph}</Text>
            </Box>
            <Text dimColor>
              <Text color={KIND_COLOR[r.kind]}>{r.type}</Text>
              {detail === '' ? '' : ` ${detail}`}
            </Text>
            {isPlanned ? (
              <Text dimColor>Waiting to start</Text>
            ) : (
              <Progress
                label={label}
                value={r.list.length > 0 ? done : isEnded ? 1 : undefined}
                max={r.list.length > 0 ? r.list.length : 1}
                valueText={r.list.length > 0 ? `${done}/${r.list.length}` : undefined}
                color={r.status === 'failed' ? C.danger : KIND_COLOR[r.kind]}
              />
            )}
            {ends === '' ? null : <Text dimColor>{ends}</Text>}
          </Box>
        </Box>
      )
    }

    const cardView = (r: Row) => (
      <Svg
        key={r.id}
        source={cardSvg(r, paneWidth)}
        alt={`${r.title}, ${r.type} agent, ${r.status}`}
        width={paneWidth}
        height={CARD_H}
      />
    )

    const section = (name: string, title: string, list: Row[]) =>
      list.length === 0 ? null : (
        <Box key={name} flexDirection="column">
          <Button
            key={`head-${name}`}
            label={`${closed.includes(name) ? '▸' : '▾'}  ${title} (${list.length})`}
            onPress={() =>
              update($, closedSections, all =>
                all.includes(name) ? all.filter(n => n !== name) : [...all, name],
              )
            }
          />
          {closed.includes(name) ? null : (
            <Box flexDirection="column" gap={1}>
              {list.map(hasPictures ? cardView : rowView)}
            </Box>
          )}
        </Box>
      )

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold>Agents</Text>
          {spent > 0 ? (
            hasPictures ? (
              <Svg
                source={tokenPillSvg(`${fmtTokens(spent)} tokens`)}
                alt={`${fmtTokens(spent)} tokens spent`}
                width={tokenPillWidth(`${fmtTokens(spent)} tokens`)}
                height={28}
              />
            ) : (
              <Text dimColor>{`${fmtTokens(spent)} tokens`}</Text>
            )
          ) : null}
        </Box>
        {hasPictures && rows.length > 0 ? (
          <Svg
            source={statsSvg(
              paneWidth,
              { running: running.length, planned: planned.length, finished: finished.length },
              Math.max(0, (now - (act.taskStart ?? now)) / 1000),
            )}
            alt={`${running.length} running, ${planned.length} planned, ${finished.length} finished`}
            width={paneWidth}
            height={STATS_H}
          />
        ) : null}
        {rows.length === 0 ? (
          <Text dimColor>No subagents yet. They show up here when Claude starts them.</Text>
        ) : null}
        {section('running', 'Running', running)}
        {section('planned', 'Planned', planned)}
        {section('finished', 'Finished', finished)}
      </Box>
    )
  })
}
