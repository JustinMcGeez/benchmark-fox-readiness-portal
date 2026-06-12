# Claude Code Build Kit — Setup & Daily Workflow

## One-time setup (10 minutes)

1. Copy everything in this kit into your repo root (the `.claude/` folder,
   `CLAUDE.md`, and `prompts/`). Commit it. Delete AGENTS.md if you added it
   earlier — CLAUDE.md replaces it.
2. In the repo folder run `claude`, then `/model` and select your premium
   model (Fable) for the main session.
3. Run `/agents` — confirm `verifier` and `security-reviewer` appear under
   project agents. (If you created the files while a session was open,
   restart the session to load them.)
4. Docs if anything looks different from this kit:
   https://code.claude.com/docs/en/sub-agents

## Daily workflow (the whole loop)

```
claude          # open session in the repo
/build-next     # builds the next task, self-verifies via subagents
                # → read the final report block (PASS + READY TO MERGE?)
                # → do anything listed under NEEDS HUMAN
# merge the branch (gh pr / GitHub UI)
/clear          # wipe context — important for tokens and quality
/build-next     # next task
```

Your job per task = read one report block + merge. The verifier's verdict
and the gate output are your review. The two places to slow down:
- After tasks 03 and 05, read the SECURITY VERDICT block carefully.
- Anything under NEEDS HUMAN (env vars, Supabase dashboard, GitHub secrets)
  only you can do.

If you ever want a second opinion later: `/verify prompts/NN-….md`.

## Token-efficiency rules (why this kit is shaped this way)

- **CLAUDE.md is loaded every session** — that's why it's ~50 lines, not 300.
  Don't grow it casually; every line is a recurring cost.
- **Objective checks are shell commands** (typecheck/build/tests). They cost
  almost nothing and can't be sweet-talked. LLM judgment is reserved for what
  commands can't check.
- **Subagents are surgical, not constant.** Each subagent spins up its own
  context (extra tokens), so the kit uses exactly one verifier pass per task
  + security review on 4 tasks only. The payoff: all the diff-reading happens
  OUTSIDE your main context, so the builder session stays small and never
  needs /compact mid-task.
- **Verifier runs on Sonnet** (cheap, plenty for audit work).
  **security-reviewer inherits Fable** — worth it on the 4 tasks that can
  leak client data. Builder on Fable.
- **/clear between every task.** Carrying task 3's history into task 4 burns
  tokens and degrades quality. PROGRESS.md is the memory between sessions.
- **Plan mode** (Shift+Tab) for the big tasks (04, 09, 10) if you want to
  approve the approach before any code is written — cheaper than redoing a
  wrong implementation.

## Optional: hard stop-gate hook (advanced)

Hooks can run the gate automatically and block Claude from finishing with
red tests — zero LLM tokens. Format changes between versions, so set it up
interactively with the `/hooks` command in Claude Code (choose the Stop
event, command:
`npm run typecheck && npm test`). Skip this if it gives you trouble — the
verifier already runs the gate.

## Honest expectations

- Tasks 01→13 in order; merge before the next one starts (the command
  enforces this).
- If /build-next reports BLOCKED after 3 verification cycles, don't force
  it — bring the findings to a fresh session or to claude.ai and decide.
- The agents make a false "all done" much harder, but they're not a
  guarantee. The RLS test suite (task 05) is the strongest protection you
  have — never let anything weaken it.
