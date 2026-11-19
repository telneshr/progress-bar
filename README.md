# progress-bar

A small mod for Claude Code. It puts a progress bar above the message box that shows which step of the task Claude is on, and a panel that shows subagents as they run.

## What it does

- **Progress bar.** A rounded bar above the prompt with the current step, a halftone fill whose dots grow as steps finish, a `Tasks 2/5` sticker riding the edge of the fill, and a percentage. When every step is done it shows a green check and 100%. It follows the task list Claude keeps (TaskCreate, TodoWrite, or the desktop app's plan list). With no task list it shows what Claude is doing right now.
- **Subagent creature.** While subagents run, the Claude Code mascot and a count (`×2`) appear at the right end of the bar.
- **Agents panel.** A strip of counts on top (running, planned or finished, and time), then Running, Planned and Finished sections with one card per subagent: its type icon, model and effort ("Sonnet 5.5, low effort"), which step it's on, a halftone progress bar, time, and tokens once it's done. A quiet pill in the header adds up the tokens of finished agents. It opens by itself when the first subagent starts, or any time with `/agent-panel`.
- **Terminal.** Terminals cannot draw pictures, so there the bar is plain text blocks and the panel is plain rows.

It uses the telnes look: near-black surfaces, one yellow accent, rounded corners and halftone dots. When nothing says how much work is left, a cluster of dots sweeps along the bar instead (it stands still if Windows asks for reduced motion).

## Install

At the prompt of a terminal session:

```
/plugin install progress-bar --marketplace telneshr/progress-bar
```

From a shell:

```
claude plugin install progress-bar --marketplace telneshr/progress-bar
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `telneshr/progress-bar`, then Add plugin.

## Notes

- The pictures are drawn for the desktop app. Other surfaces get the text version.
- The creature drawing is based on the Claude Code icon artwork, which is not this project's own work. Swap `BODY` in `hooks/icons.ts` for your own drawing if you share this further.
- Developed against Claude Code 2.1.326. Run `claude plugin validate .` in this folder to check it.
