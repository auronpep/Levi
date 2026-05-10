---
name: tool-trigger-bootstrap
description: "Inject tool-skill trigger guidance at agent bootstrap so agents auto-load matching tool-* skills when a Bash command matches a declared trigger."
homepage: https://github.com/VoteWood/Levi
metadata:
  {
    "openclaw":
      {
        "emoji": "🔧",
        "events": ["agent:bootstrap"],
        "install": [{ "id": "levi", "kind": "local", "label": "Levi tool-knowledge" }]
      }
  }
---

# Tool Trigger Bootstrap Hook

Runs at agent bootstrap to inject one short piece of guidance: when running a
Bash command, scan the command for substrings declared in `triggers.bash` of
any installed `tool-*` skill, and load the matching skill before continuing.

## Why

OpenClaw's bundled hooks fire on session-level events (`gateway:startup`,
`agent:bootstrap`, `command`), not per-tool-call. This hook approximates
per-call enforcement by giving the agent the trigger awareness it needs at
bootstrap time, then relying on the agent to apply it on each Bash call.

## What gets injected

A short reference to the tool-skill trigger contract — see
`openclaw/TRIGGER.md` in the Levi source tree for the canonical wording.

## Configuration

None required. Enabled by default once the plugin is installed.
