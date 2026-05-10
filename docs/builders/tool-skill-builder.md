# Tool Skill Builder Manual

**Audience:** A fresh AI session with internet access but no local file
access. You will be given (1) this manual, (2) the architecture spec
`2026-05-10-tool-knowledge-architecture-design.md`, and (3) the name of a
CLI tool, library, or git URL. Your output is a packaged skill ready to
drop into the Levi repo.

**Read the architecture spec for system context. This manual is your
operational instructions. Both must be honored. If they conflict, this
manual wins (it's tuned for the handoff scenario).**

---

## TL;DR — your job

Given a tool identifier (a name like `rclone`, a git URL, or a package
spec like `pypi:rich`):

1. Research the tool from authoritative online sources.
2. Author one `SKILL.md` per the format in this manual.
3. Package it in a zip with the exact structure described below — OR if
   you can't produce a binary, return the file contents in a single
   labeled code block.
4. Hand it back. No commentary, no clarifying questions, no "let me know
   if you'd like changes."

---

## Inputs

You will receive:

1. **This manual** (`tool-skill-builder.md`).
2. **The architecture spec** (`2026-05-10-tool-knowledge-architecture-design.md`).
   Read sections "Skill format", "Hook: Claude Code" (so you understand
   what your triggers will be matched against), and "Initial tool
   seeding" (for examples of trigger conventions).
3. **A tool identifier**. One of:
   - Short name: `rclone`, `httpie`, `jq`
   - Git URL: `https://github.com/user/repo`
   - Package spec: `pypi:rich`, `npm:yargs`, `crates:clap`
   - System binary name: `ffmpeg`, `exiftool`

If the identifier is ambiguous (e.g., a name that maps to multiple
projects), pick the most likely interpretation, name your assumption
explicitly in a single line at the top of the SKILL.md's "What it is"
section, and proceed. Do NOT ask the operator clarifying questions.

---

## Deliverable

A single zip named `tool-<kebab-name>-skill.zip` containing exactly:

```
skills/
  tools/
    <kebab-name>/
      SKILL.md
```

The path inside the zip mirrors the path inside the Levi repo so the
operator can `unzip` directly into the Levi root.

If your environment can't produce a binary zip (no Code Interpreter, no
sandbox), instead output:

````
**Path:** `skills/tools/<kebab-name>/SKILL.md`

```markdown
<full SKILL.md contents here, frontmatter included>
```
````

One code block. The path on a separate line above. Nothing else.

### `<kebab-name>` rules

- All lowercase
- Words separated by `-`
- Match the tool's canonical CLI invocation name where one exists
  (`rclone`, not `r-clone`)
- For Python libs, match the import name lowered
  (`PaddleOCR` → `paddleocr`)
- For git URLs, use the repo name (last path segment, stripped of
  `.git`)
- For names that contain dots or slashes, replace with `-`
  (`@scope/pkg` → `scope-pkg`)
- The skill's `name` frontmatter field is `tool-<kebab-name>` (with the
  prefix). The directory is `<kebab-name>` (without the prefix).
  Example: directory `httpie/`, name `tool-httpie`.

---

## SKILL.md format

Frontmatter and seven body sections. In this order. No additional
sections.

```yaml
---
name: tool-<kebab-name>
description: Load when working with <tool>, <concept-1>, <concept-2>, <auth-or-error-keyword>, <related-tool>. Covers the full <tool> CLI surface (or API surface), auth setup, error handling, and lessons.
triggers:
  bash:
    - <substring 1>
    - <substring 2>
---

# <tool>

## What it is
## Capability surface
## Setup & auth
## Common workflows
## Error handling
## Traps
## Lessons
```

### Frontmatter rules

**`name`** — exactly `tool-<kebab-name>`, matching the directory.

**`description`** — this is the implicit-load trigger phrase the model
matches against the user's situation. It must:

- Lead with: `Load when working with <tool>,`
- Mention 3–6 concepts, sub-tools, scenarios, or related keywords that
  should pull this skill in. Be specific.
- End with a one-clause summary of what's inside the skill.
- Stay under 40 words. It's a description, not a paragraph.

**Bad:** `description: ffmpeg skill`

**Bad:** `description: A comprehensive guide to ffmpeg covering everything you need to know about video editing and audio manipulation.`

**Good:** `description: Load when working with ffmpeg, video encoding, audio extraction, codec conversion, container remuxing, FFprobe inspection, or streaming. Covers full CLI surface, common workflows, and error handling.`

**`triggers.bash`** — list of substrings the hook scans against the
actual Bash command. Word-bounded substring match.

- Pick triggers specific enough not to false-positive on unrelated
  commands. `r` is too generic; `rg` is fine.
- Cover the common invocation forms: bare command, `python -m <pkg>`,
  any common shim names.
- For pure libraries with no CLI surface (e.g., `pydantic`, `tomli`),
  set `triggers.bash: []` and add a comment in the body noting that
  this skill loads explicitly only.

Example for a CLI tool with a Python module entry point:

```yaml
triggers:
  bash:
    - icloudpd
    - python -m icloudpd
```

Example for a library with no CLI:

```yaml
triggers:
  bash: []
```

### Body sections

#### `## What it is`

One paragraph. Plain English. Cover:

- What it is (CLI tool / Python library / system binary / wrapper)
- The problem it solves
- When to reach for it
- The most-cited alternatives, if any (one short clause; not a
  comparison)

If you had to pick an interpretation of an ambiguous tool name, lead
with: `**Assumption:** identifier "<name>" interpreted as <project> at
<URL>.` This is the only place ambiguity resolution lives.

#### `## Capability surface`

THE BIG SECTION. Mirror the official surface comprehensively. Don't
summarize.

For CLI tools:
- Every subcommand
- Every flag and option, with its accepted values where applicable
- Group by subcommand. Use the same headings the upstream docs use
  where reasonable.
- If the tool has a `--help` output captured online (in upstream docs,
  in the README, in a man-page mirror), reproduce it as the source of
  truth for flag inventory.

For libraries:
- Every public class, function, decorator, top-level export
- Group by module
- Include type signatures where the docs provide them

Format: scannable. Tables, lists, code blocks. Not prose. The reader is
an agent looking up flags fast.

If a tool has 100 flags, all 100 belong here. Pruning happens later in
the operator's hands, not in your output.

#### `## Setup & auth`

- Install path: pip / pipx / npm / brew / apt / manual download.
  Mention multiple if multiple are common. Lean toward the most
  modern/recommended.
- Required credentials/tokens — describe them by NAME and SOURCE only.
  NEVER inline a token, key, or password.
- Where state lives: config file path, cache dir, session storage.
- Platform-specific notes: Windows-only behavior, macOS-only flags,
  Linux-distro-specific package names.

#### `## Common workflows`

3–5 invocations the operator most likely uses. Each entry:

- One-line description of what it does
- The exact command (or code snippet for libraries)
- One-line note on output / side effect

Pick workflows that the upstream README or docs feature most
prominently — those are canonical use cases. Don't invent novel
workflows.

#### `## Error handling`

A table:

| Symptom | Likely cause | Fix |
|---|---|---|
| `error message verbatim` | one-line cause | one-line fix |

Sources:
- The tool's GitHub issue tracker, filtered to closed issues with
  resolution comments
- The FAQ section of upstream docs
- Common errors documented in the tool's README

DON'T invent errors. If you can't source one, don't include it.

If you find very few documented errors, include just the few. Empty is
fine. Better empty than fabricated.

#### `## Traps`

Starts EMPTY in your output. Format exactly:

```
## Traps

_Append-only. Date-stamped. Filled by the operator via the `/lesson`
slash command when something bites._
```

Do NOT speculate on gotchas. The operator owns this section.

#### `## Lessons`

Same — empty at creation:

```
## Lessons

_Append-only. Date-stamped. Filled by the operator via the `/lesson`
slash command for behaviors learned that aren't in upstream docs._
```

---

## Research protocol

In this priority order:

1. **Official docs site** (e.g., `https://ffmpeg.org/documentation.html`,
   `https://rclone.org/docs/`). Highest authority. Mirror its structure.
2. **GitHub README** of the canonical repo. For projects without docs
   sites, this is your authority. Read the README, the `docs/` folder
   if present, and any pinned wiki pages.
3. **`--help` output captures**. Search for `<tool> --help` to find
   reproductions in blog posts, StackOverflow, or man-page mirrors.
   These give you the full flag inventory verbatim.
4. **GitHub issue tracker (closed, resolved)**. Filter to issues
   labeled `bug` or `documentation` with a resolution comment. Sources
   the Error handling table.
5. **Package metadata pages** (PyPI, npm, crates.io). Sometimes have
   cleaner quickstart examples than the README.
6. **Recent release notes / changelog**. Capture any flags that are new
   or deprecated.

DON'T:

- Trust forum threads or blog rewrites without verifying against
  upstream
- Invent flags or options because they "sound right"
- Hallucinate version numbers, default values, or paths

If you genuinely cannot locate authoritative info for a section, write:

```
(Could not locate authoritative source. Needs hands-on verification.)
```

That string is a known signal — the operator scans for it. Don't
paraphrase.

---

## Style rules

- **Terse, technical, dense.** Reference manual, not tutorial.
- **No marketing language.** "Powerful, flexible, user-friendly" → cut.
- **No "you can / you might".** Imperative or declarative only.
- **Code blocks for commands.** Inline backticks for flag names and
  paths.
- **Verbatim error messages.** Quote them exactly, never paraphrase.
- **Type signatures verbatim.** For libraries, copy the signature from
  the docs as-is.

---

## What NOT to do

- ❌ Ask clarifying questions. Pick reasonably, note assumption, proceed.
- ❌ Inline secrets, API keys, tokens, real credentials, or
  machine-specific absolute paths.
- ❌ Speculate on traps or lessons. Those sections START EMPTY.
- ❌ Editorialize. No "this is a powerful tool that...", no "useful
  for...".
- ❌ Summarize the Capability surface. Mirror it.
- ❌ Add sections beyond the seven required.
- ❌ Output prose around the deliverable. No "Here's what I built." Just
  the zip (or the labeled code block).
- ❌ Use marketing copy from the project's homepage. Filter for
  technical content only.
- ❌ Apologize for gaps. State them in the prescribed string.

---

## Self-check before output

Walk through this list. Fix anything that's "no" before producing the
zip.

- [ ] Frontmatter has `name`, `description`, `triggers.bash`
- [ ] `name` is `tool-<kebab-name>` and matches the directory
- [ ] `description` leads with "Load when working with", mentions 3+
  specific concepts, ends with a one-clause summary, stays under 40
  words
- [ ] `triggers.bash` entries are specific (won't false-positive) AND
  cover the common invocation forms — OR the list is empty for pure
  libraries
- [ ] Body has all seven sections in order: What it is / Capability
  surface / Setup & auth / Common workflows / Error handling / Traps /
  Lessons
- [ ] Capability surface is comprehensive (looks like a reference, not a
  summary)
- [ ] No secrets, real tokens, real credentials, or machine-specific
  absolute paths anywhere
- [ ] Traps and Lessons sections contain ONLY the placeholder text
  (empty bodies)
- [ ] No editorial language; technical and dense
- [ ] Errors section sourced from real upstream issues, not invented
- [ ] Zip path is `skills/tools/<kebab-name>/SKILL.md`
- [ ] If alternative output mode (no zip), exactly one labeled code
  block, with the path called out above it, no surrounding prose

---

## Worked example

For input identifier `httpie`:

**Path:** `skills/tools/httpie/SKILL.md`

````markdown
---
name: tool-httpie
description: Load when working with httpie, HTTP requests from the CLI, REST API debugging, JSON request/response inspection, sessions, or auth headers in CLI form. Covers full CLI surface, common workflows, and error handling.
triggers:
  bash:
    - http
    - https
    - httpie
---

# httpie

## What it is

A user-friendly CLI HTTP client. Replaces curl for interactive REST API
work — colorized JSON output, intuitive request syntax, session
management. Two binaries: `http` (default protocol negotiation) and
`https` (forces HTTPS). Reach for it for hand-debugging APIs and
shell-scripting HTTP calls when readable output matters; stick with curl
for binary downloads, complex SSL options, or piping into other binary
tools.

## Capability surface

### Invocation

```
http [flags] [METHOD] URL [ITEM [ITEM ...]]
https [flags] [METHOD] URL [ITEM [ITEM ...]]
```

### Request items

| Syntax | Meaning |
|---|---|
| `name=value` | Form field (or JSON field with `--json`) |
| `name:=value` | JSON raw value (numbers, booleans, arrays) |
| `name==value` | Query parameter |
| `name:value` | Header |
| `name@filename` | File upload |
| `name=@filename` | File contents as field |

### Common flags

| Flag | Purpose |
|---|---|
| `--json`, `-j` | Force JSON serialization (default for data) |
| `--form`, `-f` | Form-encoded body |
| `--multipart` | Multipart form |
| `--auth USER[:PASS]`, `-a` | Basic auth |
| `--auth-type {basic,digest,bearer}`, `-A` | Auth scheme |
| `--session=NAME` | Persistent session by name |
| `--session-read-only=NAME` | Use session, don't update |
| `--download`, `-d` | Save body to file |
| `--continue`, `-c` | Resume download |
| `--verify={yes,no,PATH}` | TLS verification |
| `--cert=PATH` | Client cert |
| `--proxy=PROTO:URL` | Proxy |
| `--timeout=SECS` | Request timeout |
| `--max-redirects=N` | Cap redirects |
| `--print=FORMAT`, `-p` | Output parts (`H`=req hdrs, `B`=req body, `h`=resp hdrs, `b`=resp body) |
| `--pretty={all,colors,format,none}` | Output formatting |
| `--style=THEME` | Color theme |
| `--offline` | Build request, don't send |

(Full surface continues — every flag from upstream `--help` would be
listed here.)

## Setup & auth

Install: `pipx install httpie` (preferred — isolates from system
Python). Alternatives: `pip install httpie`, `brew install httpie`,
`apt install httpie`.

Auth in CLI form:
- Basic: `--auth user:pass`
- Bearer: `--auth-type=bearer --auth=<token>`
- Sessions: `--session=NAME` saves cookies and headers under
  `~/.config/httpie/sessions/<host>/<name>.json`. Read with
  `--session-read-only=NAME`.

Config file: `~/.config/httpie/config.json` for default flags.

## Common workflows

Send a JSON body:
```
http POST api.example.com/users name=alice email=alice@example.com
```

Send raw JSON (numbers, arrays, nested):
```
http POST api.example.com/items count:=5 tags:='["a","b"]'
```

Bearer token auth:
```
https -A bearer -a "$TOKEN" GET api.example.com/me
```

Persistent session:
```
https --session=work POST api.example.com/login user=alice pass=secret
https --session=work GET api.example.com/me
```

Download a file:
```
http --download GET https://example.com/file.zip
```

## Error handling

| Symptom | Likely cause | Fix |
|---|---|---|
| `http: error: ConnectionError` | Network/DNS issue or wrong scheme | Verify URL, try with `--verbose`, check proxy env vars |
| `http: error: SSLError: certificate verify failed` | Self-signed or expired cert | `--verify=no` for testing, or pass `--verify=PATH-TO-CA` |
| `http: error: argument REQUEST_ITEM: invalid value` | Item syntax mismatch | Check `=` vs `:=` vs `==` vs `:` semantics |
| Body printed as binary garbage | Response is binary, terminal renders raw | Add `--download` or `-p b > file` |
| Empty `--session` cookies after auth | Auth scheme didn't set Set-Cookie | Verify with `-p H` to see request, `-p h` to see response headers |

## Traps

_Append-only. Date-stamped. Filled by the operator via the `/lesson`
slash command when something bites._

## Lessons

_Append-only. Date-stamped. Filled by the operator via the `/lesson`
slash command for behaviors learned that aren't in upstream docs._
````

That's the depth and shape expected. Capability surface goes deep. Body
sections terse. Traps/Lessons empty.

---

## Output format recap

ONE of these:

**A. Zip file** (preferred if your environment supports binary file
creation):

`tool-<kebab-name>-skill.zip` containing only:

```
skills/tools/<kebab-name>/SKILL.md
```

**B. Inline file** (fallback):

```
**Path:** `skills/tools/<kebab-name>/SKILL.md`

```markdown
<frontmatter and full body>
```
```

Either way: nothing else. No prose, no commentary, no questions.
