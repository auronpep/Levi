# Talk modes — *voice / persona*

Each subdirectory is a named voice or persona. Engage with `/talk <name>`.

## Available talk modes

| Name | One-line vibe | Best for |
|---|---|---|
| `caveman` | Drop articles, fragments, terse | General-purpose token compression |

## How to add a new talk mode

1. Create `skills/talk/<name>/SKILL.md` with frontmatter (`name`, `description`)
2. Body = the voice rules
3. The `UserPromptSubmit` hook persists `/talk <name>` to `~/.claude/.levi-talk`; the `SessionStart` hook loads the matching `SKILL.md` body each turn.

## Boundary discipline (applies to all talk modes)

Every talk mode should explicitly state when to **drop** the voice:

- Code, commits, PR descriptions → write normally
- Security warnings, irreversible actions → full prose with caveats
- User confused or asking to clarify → drop voice, explain plainly
- Legal/medical/financial advice → escalate to court-reporter style or compliance thinking; do not let voice obscure the substance
