# progress-bar

A small mod for Claude Code. It puts a progress bar above the message box that shows which step of the task Claude is on, and a panel that shows subagents as they run.

## What it does

- **Progress bar.** A rounded bar above the prompt with the current step, a halftone fill that grows as steps finish, a `Tasks 2/5` label and a percentage. It follows the task list Claude keeps (TaskCreate, TodoWrite, or the desktop app's plan list). With no task list it shows what Claude is doing right now.
- **Subagent creature.** While subagents run, the Claude Code mascot and a count (`×2`) appear at the right end of the bar.
- **Agents panel.** Running, Planned and Finished sections, one card per subagent with its type icon, model, effort, progress, time, and tokens once it is done. A yellow pill in the header adds up the tokens of finished agents. It opens by itself when the first subagent starts, or any time with `/agent-panel`.
- **Terminal.** Terminals cannot draw pictures, so there the bar is plain text blocks and the panel is plain rows.

The colors are a yellow tile on near-black with white text.

## Install

At the prompt of a terminal session:

```
/plugin install progress-bar --marketplace OWNER/REPO
```

From a shell:

```
claude plugin install progress-bar --marketplace OWNER/REPO
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `OWNER/REPO`, then Add plugin.

Replace `OWNER/REPO` with this repository's GitHub name.

## Notes

- The pictures are drawn for the desktop app. Other surfaces get the text version.
- The creature drawing is based on the Claude Code icon artwork, which is not this project's own work. Swap `BODY` in `hooks/icons.ts` for your own drawing if you share this further.
- Developed against Claude Code 2.1.326. Run `claude plugin validate .` in this folder to check it.
