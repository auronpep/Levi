# Learn Levi & josh in 30 minutes

A hands-on tutorial. Twelve short lessons, in order, that take you from "what is this" to "I can drive the whole system fluently."

> Reference for everything covered here lives in **[USER-MANUAL.md](USER-MANUAL.md)**. Use this file to learn the system; use that one to look things up after.

---

## How to use this tutorial

1. Open a terminal (PowerShell or Git Bash, doesn't matter).
2. Read each lesson, run the commands, look at the output, then move on.
3. If a lesson breaks, jump to **[Lesson 12: When things break](#lesson-12-when-things-break)** and come back.
4. Don't skip lessons — later ones depend on earlier ones.

You don't need a Claude Code or Codex session open for the first 10 lessons. Just a shell.

---

## The mental model (read first)

The system is one shared filesystem at `~/.josh/` plus a small CLI called `josh`. You drop work into the filesystem, agents pick it up, you see what's happening with `josh status`, you decide approvals. That's it.

Three places you can interact:

- **Shell** — `josh ...` from any terminal
- **Claude Code** — `/levi:josh ...` (note the `levi:` prefix)
- **Codex** — `/josh ...`

All three call the same CLI. All three read and write the same `~/.josh/` directory. There's no "primary" surface — pick whichever is in front of you.

A background process called the **orchestrator** runs every 5 minutes (Windows Task Scheduler) and does the routine work — moving new todos from `incoming/` to `triaged/`, cleaning up stuck claims, expiring old approvals. You'll see it referenced as "tick".

Now to the lessons.

---

## Lesson 1: See what's running

Goal: confirm the system is alive.

```
josh status
```

What you should see:
```
josh status — C:\Users\<you>\.josh
updated: 2026-05-09T...
agents:
  claude_code     idle   —
  codex           idle   —
  orchestrator    alive  2026-05-09T...
queue:
  incoming           0
  triaged            0
  ...
```

**What this tells you:**
- The dashboard is working
- The orchestrator has ticked recently (`alive`, with a timestamp)
- The queue is empty (no work in flight)

If `orchestrator` shows `idle` or the timestamp is hours old, the heartbeat isn't running — see [Lesson 12](#lesson-12-when-things-break).

---

## Lesson 2: Drop your first todo

Goal: create one piece of work.

```
josh push todo "Try the josh tutorial"
```

What you'll see:
```
01KR67ABCDEFGHIJKLMNOPQRST
```

That string is a **ULID** — a 26-character ID that's also sortable by time. Every artifact in `~/.josh/` has one. The last 6 characters (`OPQRST` here) are a "short ID" — they work in most commands as a shortcut.

**What just happened:** a JSON file was atomically written to `~/.josh/todo/incoming/<id>.json`. Nothing else has reacted to it yet — the orchestrator does that on its next tick.

**Save the short ID** (last 6 chars) — you'll use it in Lesson 4.

---

## Lesson 3: Watch it move

Goal: see your todo flow through the queue.

```
josh list todo
```

You should see your todo in the `incoming` state:
```
id (last 6)  state         pri  agent        age      title
-----------  ------------  ---  -----------  -------  ----------------------------------------
OPQRST       incoming      p2   auto         3s       Try the josh tutorial
```

Now trigger the orchestrator manually instead of waiting up to 5 minutes:

```
josh tick
```

You'll see one line like:
```
tick 47: triaged=1 swept=0 expired=0 controls=0
```

That means: "1 todo was triaged, 0 stale claims swept, 0 approvals auto-expired, 0 control commands processed." Now run `list todo` again:

```
josh list todo
```

Your todo is now in `triaged` state. The orchestrator looked at it, accepted it, and moved it forward. The `agent` field is still `auto` because there's no routing rule to assign it.

**What you learned:** the lifecycle uses directories as states. `incoming/` → `triaged/` → `in_progress/` → `done/` (with `failed/`, `blocked/`, `cancelled/` as alternate ends). The orchestrator moves things from `incoming/` to `triaged/`. The agents (or you) move things from `triaged/` onward.

---

## Lesson 4: Claim it and complete it

Goal: do the work yourself and mark it done.

Replace `OPQRST` with your todo's last 6 characters:

```
josh claim OPQRST --as "tutorial:lesson-4"
```

You should see your full ID echoed back. The todo just moved from `triaged/` to `in_progress/`. Confirm:

```
josh list todo
```

The state column should now read `in_progress`. The `claim` field on the JSON records who claimed it (`tutorial:lesson-4`) and when. Look at the full record:

```
josh show OPQRST
```

You'll see the full JSON — including a `claim` block and a `history` array tracking every transition.

Now finish it:

```
josh complete OPQRST --note "did the tutorial"
```

Confirm:

```
josh list todo --state done
```

There it is, in `done`, with `completed_at`, `completed_by`, and a final `completion_note`.

**What you learned:** the four core mutate commands are `claim`, `complete`, `fail`, `cancel` — plus `block`/`unblock` if a dependency is in the way. Each is an atomic move between state directories. `--as` (or `--actor`) overrides the default actor (which is your shell username).

---

## Lesson 5: Send a question to another agent

Goal: send a message to Codex.

```
josh push handoff --to codex --kind request --title "What's a ULID?" --body "Quick question — why ULIDs over UUIDs in this system?" --as "tutorial:lesson-5"
```

You'll see another ID echoed. Now check what landed in Codex's inbox:

```
josh list handoffs --for codex
```

```
id (last 6)  for          state      kind     pri  age      from              title
-----------  -----------  ---------  -------  ---  -------  ----------------  --------------------
XYZABC       codex        incoming   request  p2   2s       tutorial:lesson-5  What's a ULID?
```

**What just happened:** a JSON message was written to `~/.josh/codex/incoming/<id>.json`. Next time Codex checks its inbox, the question will be there.

**Save this short ID** (`XYZABC` here) for the next lesson.

---

## Lesson 6: Reply to a handoff

Goal: simulate Codex answering you.

Pretend you're Codex for a moment:

```
josh reply XYZABC --body "ULIDs are time-sortable so 'ls incoming/' shows oldest first. UUIDs aren't sortable." --as "codex:tutorial-session"
```

You'll see a NEW ID echoed (the reply gets its own ULID). Behind the scenes, two things happened atomically:

1. A new handoff file was written to `~/.josh/claude/incoming/` (because the original came from `tutorial:lesson-5`, which the reply router recognized as "claude side")
2. The original message was moved from `~/.josh/codex/incoming/` to `~/.josh/codex/processed/`

Confirm:

```
josh list handoffs --for codex                  # original is gone from incoming
josh list handoffs --for codex --state processed # it's here now
josh list handoffs --for claude                 # the reply landed in claude's inbox
```

**What you learned:** handoffs are cross-agent messaging with thread continuity. Every reply preserves a `thread_id` so you can reconstruct the conversation. The agent that received the message is responsible for either replying (`josh reply`) or acknowledging (`josh ack`) — both move the original to `processed/`.

---

## Lesson 7: Request your own approval

Goal: gate something on a yes/no decision.

```
josh push approval --summary "Should I delete the tutorial todos when done?" --details "There's no harm in keeping them, but they clutter 'list todo --state all'." --default-after 4h --default-choice deny
```

You'll see another ID echoed. List pending approvals:

```
josh list approvals
```

```
id (last 6)  state    age      decision   requester              summary
-----------  -------  -------  ---------  ---------------------  ------------------------
DEFGHI       pending  3s       —          tutorial:lesson-7      Should I delete the tutorial todos when done?
```

**What you learned:** approvals are persistent yes/no decisions. They live in `approvals/pending/` until someone decides them. If `--default-after` elapses without a decision, the orchestrator applies `--default-choice` automatically. This lets you gate deploys / pushes / destructive ops on your explicit OK without blocking forever if you forget.

---

## Lesson 8: Approve it

Goal: decide a pending approval.

```
josh approve DEFGHI --note "yeah, clean them up at the end"
```

Confirm:

```
josh list approvals --state done
```

```
DEFGHI       done     30s      approve    tutorial:lesson-7      ...
```

**What you learned:** approvals are decided with `josh approve <id>` or `josh deny <id>`. The decision is recorded immutably with `decided_at`, `decided_by`, and an optional `--note` or `--reason`.

You also have `josh push review` + `josh review <id> --verdict X` for code/design review (a similar pattern but with three-way verdicts: `approve`, `request_changes`, `block`). Try those when you have something real to review.

---

## Lesson 9: Lock a shared resource

Goal: claim exclusive access to something.

```
josh lock acquire tutorial-resource --ttl 5m --reason "demo"
```

You'll see `tutorial-resource` echoed back (the resource name, not a ULID). It now has a lock entry:

```
josh lock list
```

```
resource             holder                   expires_at            status   reason
-------------------  -----------------------  --------------------  -------  -------------------------
tutorial-resource    cli:<you>                2026-05-09T...        held     demo
```

The lock has a 5-minute TTL — it'll expire automatically if you forget to release. Release it now:

```
josh lock release tutorial-resource
josh lock list
```

`(no locks held)`

**What you learned:** `josh lock acquire` is convention-based mutual exclusion across agents. Anyone running `josh lock list` can see who's holding what. Agents agree to check before touching the protected resource. Useful for: running migrations, doing deploys, exclusive file rewrites — anywhere you don't want two agents stepping on each other.

---

## Lesson 10: Try a talk mode (Claude Code only)

Goal: change Claude's voice for a session.

This lesson needs a Claude Code session. Start one:

```
cd C:\Levi
claude
```

In the session:
```
/levi:talk caveman
```

You'll see something like: "Caveman mode active. Persists until /talk off."

Now ask Claude anything:
```
explain the difference between a regular expression and a wildcard pattern
```

The response will be terse, fragment-heavy, no articles. Try the more aggressive variant:

```
/levi:talk caveman-ultra
```

Then ask the same question again — even shorter, single-clause sentences, dropped prepositions.

Turn it off:
```
/levi:talk off
```

Or use natural language: "stop caveman" / "talk normally".

**What you learned:** Levi has a "talk" axis with two modes (caveman, caveman-ultra). The mode persists across turns via a flag file (`~/.claude/.levi-talk`) and the `UserPromptSubmit` hook injects the SKILL rules into every prompt's context. This is the only Levi axis with content shipped — the other 46 axes (`/style`, `/think`, `/role`, etc.) are dispatcher-surface placeholders waiting for content.

---

## Lesson 11: Read the audit log

Goal: see the forensic record.

Every meaningful action since you started writes a line to `~/.josh/audit/<today>.jsonl`. Tail it:

```
# PowerShell
Get-Content "$env:USERPROFILE\.josh\audit\$(Get-Date -Format yyyy-MM-dd).jsonl" -Tail 20

# Bash
tail -20 ~/.josh/audit/$(date +%Y-%m-%d).jsonl
```

You'll see lines like:
```
{"at":"2026-05-09T...","actor":"tutorial:lesson-5","action":"handoff.sent","id":"01H...","details":{"to":"codex","kind":"request","thread_id":"01H...","title":"What's a ULID?"}}
{"at":"2026-05-09T...","actor":"orchestrator","action":"todo.triaged","id":"01H...","details":{"agent":"auto","priority":"p2"}}
{"at":"2026-05-09T...","actor":"tutorial:lesson-7","action":"approval.requested","id":"01H...","details":{"summary":"...","options":["approve","deny"]}}
```

Find every event for one of your tutorial actors:

```
# PowerShell
Select-String -Pattern "tutorial:lesson" -Path "$env:USERPROFILE\.josh\audit\*.jsonl"

# Bash
grep "tutorial:lesson" ~/.josh/audit/*.jsonl
```

**What you learned:** the audit log is append-only and never edited. It captures every state transition, every cross-agent message, every approval decision, every orchestrator tick. Daily-rotated. When something looks weird, this is the first place to look.

---

## Lesson 12: When things break

Six diagnostic moves you'll use repeatedly.

**The orchestrator stopped ticking** (`josh status` shows `last_tick` more than 10 min old)
```
# PowerShell
Get-ScheduledTaskInfo -TaskName 'josh-tick'
Start-ScheduledTask -TaskName 'josh-tick'

# Or from any shell — manual tick
josh tick --verbose
```

**Something's stuck in `in_progress/` and the agent is gone**
```
josh tick     # orchestrator sweeps stale claims (older than ttl_sec) on every tick
```

**A todo went to `failed/` and you don't know why**
```
josh show <id>          # full JSON, including failure_reason and history
```

**Two agents both claimed the same todo** (shouldn't happen but worth checking)
```
# Bash
grep "todo.claimed" ~/.josh/audit/*.jsonl | grep "<short-id>"
```
If two `claimed` events exist for the same id, something's wrong with the lock primitive — file an issue.

**JSON files look corrupt or weird**
```
josh validate           # walks the tree, checks every JSON against its schema
```

**The lock file is stuck and `tick` always says "lock held"**
```
# PowerShell
Remove-Item "$env:USERPROFILE\.josh\orchestrator\orchestrator.lock"

# Bash
rm ~/.josh/orchestrator/orchestrator.lock

josh tick               # try again
```

**Slash command not recognized in Claude Code**
- Use `/levi:josh` (with the prefix), not `/josh`. Codex uses `/josh` (no prefix).

**Multiple slash commands in one message do weird things**
- Each message can only fire ONE slash command (the first `/`). Send them as separate messages, or use `!josh ...` for raw bash.

---

## Graduating exercises

Three realistic scenarios that exercise the system end-to-end. Pick one or do all three.

### Exercise A — Real bug fix workflow

You found a flaky test. Walk it through the full lifecycle:

```
# 1. Drop the todo with a verify command
josh push todo "Fix flaky test: tests/users.test.ts line 42" \
  --priority p1 \
  --agent codex \
  --label test,flaky \
  --verify "echo 'pretend tests pass' && exit 0"

# 2. Wait or fire tick
josh tick

# 3. Claim it (pretend you're codex)
josh claim <short-id> --as "codex:bug-fix-session"

# 4. (do the work)

# 5. Complete — verify will run
josh complete <short-id> --note "added wait-for-element retry, 100ms backoff"
```

If verify fails (exit non-zero), `complete` refuses. Run `josh complete <id> --skip-verify` to override or `josh fail <id> --reason "..."` to mark failed.

### Exercise B — Cross-agent collaboration

You're in Claude Code working on something and need Codex's opinion:

```
# In Claude Code
/levi:josh push handoff --to codex \
  --kind request \
  --priority p1 \
  --title "Quick design call: Result<T,E> vs throw?" \
  --body "Refactoring src/parse.ts. Should errors be Result types or thrown? What does the rest of the codebase do?" \
  --as "claude-code:my-session"
```

In a Codex session:
```
/josh list handoffs --for codex
/josh show <id>
/josh reply <id> --body "Codebase uses thrown for unrecoverable, Result for parse errors. parseConfig should return Result<Config, ParseError>." --as "codex:my-session"
```

Back in Claude Code:
```
/levi:josh list handoffs --for claude     # the answer landed
/levi:josh ack <reply-id> --note "applied"
```

### Exercise C — Approval-gated deploy

Before pushing to production:

```
josh push approval \
  --summary "Deploy v0.5.0 to prod (github.com/me/svc)?" \
  --details "Changelog: feat(api), fix(auth), docs(readme). Tests green. Staging soaked 24h." \
  --options "approve,deny,wait" \
  --default-after 6h \
  --default-choice deny

# review the request
josh show <id>

# decide
josh approve <id> --note "ok, sending it"
# or
josh deny <id> --reason "wait for the auth fix to soak another 12h"
```

If you forget to decide for 6 hours, the orchestrator applies `deny` automatically. Audit captures the auto-expiry.

---

## What you can do now

After all 12 lessons + an exercise, you can:

- Drop, claim, complete, fail, block, cancel todos
- Send messages to other agents and reply to messages they send you
- Request and decide approvals (with optional auto-expiry)
- Request code/design reviews and submit verdicts
- Lock shared resources
- Pause / resume / drain the orchestrator
- Read the audit log to debug anything
- Switch Claude into caveman mode

You haven't yet:

- Written a routing rule (try editing `~/.josh/orchestrator/routing.json`)
- Pushed a code review (try `josh push review --subject-ref <pr-url> --reviewer codex`)
- Used `josh control reorder` to bump priority on a live todo
- Set up the system on a second PC

For everything else — every flag of every command, every JSON schema, every troubleshooting recipe — read **[USER-MANUAL.md](USER-MANUAL.md)**.

---

## Cleanup (optional)

If you want to wipe the tutorial data:

```
# PowerShell
Remove-Item "$env:USERPROFILE\.josh\todo\done\*.json"
Remove-Item "$env:USERPROFILE\.josh\codex\processed\*.json"
Remove-Item "$env:USERPROFILE\.josh\claude\incoming\*.json"
Remove-Item "$env:USERPROFILE\.josh\approvals\done\*.json"

# Bash
rm -f ~/.josh/todo/done/*.json
rm -f ~/.josh/codex/processed/*.json
rm -f ~/.josh/claude/incoming/*.json
rm -f ~/.josh/approvals/done/*.json
```

`josh status` afterward should show all zeros.

That's the system. Go drop a real todo.
