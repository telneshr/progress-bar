export type StepStatus = 'pending' | 'in_progress' | 'completed'

export type Step = {
  /** Present-tense text shown while this step is the current one. */
  text: string
  status: StepStatus
  /** Set for steps made by TaskCreate, so TaskUpdate can find them. */
  id?: string
}

/** What Claude is doing right now, for turns with no step list. */
export type Activity = {
  /** The last tool Claude called this turn, or '' before the first. */
  tool: string
  /** Tool calls since the prompt was sent. */
  calls: number
  /** Bumped whenever a subagent starts or ends, and each second while one runs. */
  pulse: number
  /** When the last prompt was sent, in milliseconds since the epoch. */
  taskStart: number
  /** How long the last reply took, in milliseconds, when it ended with no task list; null or
      missing otherwise. The bar then shows it finished, as a task list's "All done" stays. */
  doneMs?: number | null
}

/** What the roster last said about a subagent, kept so a finished one can still be drawn. */
export type AgentSnap = {
  id: string
  description: string
  type: string
  status: 'pending' | 'running' | 'waiting' | 'idle' | 'completed' | 'failed' | 'killed'
  label: string
  model?: string | undefined
  effort?: string | number | undefined
  startTime: number
  tokenCount: number
}

/** What the mod keeps about one subagent, beside what the engine's roster says. */
export type AgentExtra = {
  /** The roster's last word on it; the Finished list draws from this once the roster drops it. */
  snap?: AgentSnap | undefined
  /** The subagent's own task list, when it keeps one. */
  steps: Step[]
  /** The last tool it called. */
  lastTool: string
  /** When its turn ended, in milliseconds since the epoch; null while it runs. */
  endedAt: number | null
}

declare module 'claude-code' {
  interface PluginState {
    'progress-bar': {
      steps: Step[]
      activity: Activity
      agents: Record<string, AgentExtra>
      /** Section names the person has collapsed in the Agents pane. */
      closed: string[]
    }
  }
}
