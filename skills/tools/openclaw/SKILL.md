---
name: tool-openclaw
description: Load when working with openclaw, Gateway CLI, plugins, hooks, skills, agents, channels, or auth repair. Covers the OpenClaw CLI surface, setup/auth, error handling, and lessons.
triggers:
  bash:
    - openclaw
    - npx openclaw
    - pnpm openclaw
    - bunx openclaw
---

# openclaw

## What it is

OpenClaw is a self-hosted personal AI assistant and Gateway CLI. It coordinates Gateway service lifecycle, chat channels, agents, model providers, inference, plugins, hooks, skills, nodes, browser/runtime tools, automation, secrets, and diagnostics from one command surface. Reach for it when installing or repairing an OpenClaw runtime, configuring agents/channels/models, sending messages, managing plugins/hooks/skills, exposing ACP/MCP bridges, controlling local/remote gateways, or running scripted inference; alternatives include Claude Code, Codex CLI, generic agent frameworks, and direct bot integrations.

## Capability surface

### Invocation

```bash
openclaw [--dev] [--profile <name>] [--container <name>] [--no-color] [--update] [-V|--version|-v] <command> [args]
openclaw
openclaw crestodian
```

Running `openclaw` with no command starts Crestodian in an interactive terminal. Plugins can register additional top-level command groups beyond the core tree.

### Global flags

| Flag | Accepted values | Purpose |
|---|---:|---|
| `--dev` | boolean | Isolate state under `~/.openclaw-dev` and shift default ports. |
| `--profile <name>` | string | Isolate state under `~/.openclaw-<name>`. |
| `--container <name>` | string | Target a named container for execution. |
| `--no-color` | boolean | Disable ANSI colors; `NO_COLOR=1` is also respected. |
| `--update` | boolean | Shorthand for `openclaw update` on source installs. |
| `-V`, `--version`, `-v` | boolean | Print version and exit. |

### Core command inventory

| Area | Commands |
|---|---|
| Setup and onboarding | `crestodian`, `setup`, `onboard`, `configure`, `config get|set|patch|unset|file|schema|validate`, `completion`, `doctor`, `dashboard` |
| Reset and uninstall | `backup create|verify`, `reset`, `uninstall`, `update`, `update status`, `update wizard` |
| Messaging and agents | `message`, `agent`, `agents list|add|delete|bindings|bind|unbind|set-identity`, `acp`, `mcp serve|list|show|set|unset` |
| Health and sessions | `status`, `health`, `sessions cleanup|export-trajectory` |
| Gateway and logs | `gateway call|usage-cost|health|status|probe|discover|install|uninstall|start|stop|restart|run`, `logs`, `system event|heartbeat last|enable|disable|presence` |
| Models and inference | `models list|status|set|set-image|scan`, `models aliases list|add|remove`, `models fallbacks list|add|remove|clear`, `models image-fallbacks list|add|remove|clear`, `models auth add|login|login-github-copilot|setup-token|paste-token`, `models auth order get|set|clear`, `infer`, `capability`, `memory`, `commitments`, `wiki` |
| Network and nodes | `directory self|peers list|groups list|members`, `nodes status|describe|list|pending|approve|reject|rename|invoke|notify|push`, `devices list|remove|clear|approve|reject|rotate|revoke`, `node run|status|install|uninstall|stop|restart` |
| Runtime and sandbox | `approvals get|set|allowlist add|remove`, `exec-policy show|preset|set`, `sandbox list|recreate|explain`, `tui`, `chat`, `terminal`, `browser` |
| Automation | `cron status|list|add|edit|rm|enable|disable|runs|run`, `tasks list|show|notify|cancel|audit|maintenance`, `tasks flow list|show|cancel`, `hooks list|info|check|enable|disable|install|update`, `webhooks gmail setup|run` |
| Discovery and docs | `dns setup`, `docs` |
| Pairing and channels | `pairing list|approve`, `qr`, `channels list|status|capabilities|resolve|logs|add|remove|login|logout` |
| Security and plugins | `security audit`, `secrets reload|audit|configure|apply`, `skills search|install|update|list|info|check`, `plugins list|search|inspect|info|install|uninstall|update|enable|disable|doctor|registry|marketplace list`, `proxy start|run|validate|coverage|sessions|query|blob|purge` |
| Legacy aliases | `daemon status|install|uninstall|start|stop|restart`, `clawbot qr` |
| Optional plugin commands | `path resolve|find|set|validate|emit`, `voicecall` when installed |

### Output modes

| Mode | Behavior |
|---|---|
| TTY human output | ANSI colors and progress indicators render only in TTY sessions. |
| `--json` | Supported by most diagnostic/listing commands; disables styling and keeps machine-readable payloads on stdout. |
| `--plain` | Supported on selected commands such as `models status`; disables styling. |
| OSC-8 hyperlinks | Clickable where supported; otherwise plain URL fallback. |

### `crestodian` / no-command helper

```bash
openclaw
openclaw crestodian
openclaw crestodian --json
openclaw crestodian --message "models"
openclaw crestodian --message "validate config"
openclaw crestodian --message "setup workspace ~/Projects/work model openai/gpt-5.5" --yes
```

| Flag | Purpose |
|---|---|
| `--json` | Print status/plan result as JSON. |
| `--message <text>` | Run a single Crestodian request. |
| `--yes` | Apply direct-command persistent operations without conversational approval. |

Crestodian can start when `openclaw.json` is missing/invalid, Gateway is down, plugin command registration is unavailable, or no agent is configured. Applied writes are audited under `~/.openclaw/audit/crestodian.jsonl`.

### `setup`

```bash
openclaw setup
openclaw setup --workspace ~/.openclaw/workspace
openclaw setup --wizard
openclaw setup --wizard --import-from hermes --import-source ~/.hermes
openclaw setup --non-interactive --mode remote --remote-url wss://gateway-host:18789 --remote-token <token>
```

| Flag | Purpose |
|---|---|
| `--workspace <path>` | Set `agents.defaults.workspace`. |
| `--wizard` | Run onboarding instead of baseline setup only. |
| `--non-interactive` | Run onboarding without prompts. |
| `--mode <mode>` | Onboarding mode, including `local` or `remote`. |
| `--import-from <provider>` | Migration provider, such as `hermes`. |
| `--import-source <path>` | Source agent home for `--import-from`. |
| `--import-secrets` | Import supported secrets during onboarding migration. |
| `--remote-url <ws-url>` | Remote Gateway WebSocket URL. |
| `--remote-token <token>` | Remote Gateway token. |

### `onboard`

```bash
openclaw onboard
openclaw onboard --modern
openclaw onboard --flow quickstart
openclaw onboard --flow manual
openclaw onboard --flow import
openclaw onboard --import-from hermes --import-source ~/.hermes
openclaw onboard --skip-bootstrap
openclaw onboard --mode remote --remote-url wss://gateway-host:18789
openclaw onboard --non-interactive --mode local --auth-choice skip --gateway-auth token --gateway-token-ref-env OPENCLAW_GATEWAY_TOKEN --accept-risk
```

| Flag | Accepted values / notes | Purpose |
|---|---|---|
| `--modern` | boolean | Start Crestodian conversational onboarding preview. |
| `--flow <flow>` | `quickstart`, `manual`, `import` | Choose onboarding flow. |
| `--import-from <provider>` | provider id | Run migration provider during onboarding. |
| `--import-source <path>` | path | Source state for import provider. |
| `--skip-bootstrap` | boolean | Skip creating bootstrap files such as `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`. |
| `--mode <mode>` | `local`, `remote` | Local setup writes `gateway.mode="local"`; remote writes connection info only. |
| `--remote-url <ws-url>` | URL | Remote Gateway WebSocket URL. |
| `--remote-token <token>` | token name/value source only | Remote Gateway token. |
| `--non-interactive` | boolean | Scripted onboarding. |
| `--auth-choice <choice>` | provider/setup choice | Model/provider auth path; documented choices include `custom-api-key`, `lmstudio`, `ollama`, `openai-api-key`, `mistral-api-key`, `zai-api-key`, `zai-coding-global`, `zai-coding-cn`, `zai-global`, `zai-cn`, `skip`. |
| `--secret-input-mode <mode>` | `plaintext`, `ref` | Store provider keys as plaintext or SecretRef. |
| `--custom-base-url <url>` | URL | Custom/LM Studio/Ollama base URL. |
| `--custom-model-id <id>` | model id | Custom/LM Studio/Ollama model id. |
| `--custom-api-key <key>` | source only | Custom provider API key; falls back to `CUSTOM_API_KEY` in non-interactive mode when omitted. |
| `--custom-compatibility <mode>` | e.g. `openai` | Compatibility mode for custom endpoints. |
| `--custom-image-input` | boolean | Mark unknown custom model as image-capable. |
| `--custom-text-input` | boolean | Force text-only metadata. |
| `--lmstudio-api-key <key>` | source only | LM Studio API token source. |
| `--mistral-api-key <key>` | source only | Mistral API key source. |
| `--zai-api-key <key>` | source only | Z.AI API key source. |
| `--gateway-auth <mode>` | `token`, other prompted modes | Gateway auth selection. |
| `--gateway-token <token>` | source only | Store plaintext gateway token. |
| `--gateway-token-ref-env <ENV>` | env var name | Store `gateway.auth.token` as env SecretRef. |
| `--install-daemon` | boolean | Install/start managed Gateway service during onboarding. |
| `--skip-health` | boolean | Skip local Gateway health wait. |
| `--accept-risk` | boolean | Accept local/custom provider risk prompts in non-interactive mode. |

For plaintext private-network `ws://` remote targets, set `OPENCLAW_ALLOW_INSECURE_PRIVATE_WS=1` in the onboarding process environment.

### `configure` / `config` wizard

```bash
openclaw configure
openclaw configure --section web
openclaw configure --section model --section channels
openclaw configure --section gateway --section daemon
openclaw config
openclaw config --section model
```

| Flag | Accepted values | Purpose |
|---|---|---|
| `--section <name>` | repeatable; `workspace`, `model`, `web`, `gateway`, `daemon`, `channels`, `plugins`, `skills`, `health` | Restrict guided configuration sections. |

### `config` non-interactive commands

```bash
openclaw config file
openclaw config schema
openclaw config get <path>
openclaw config get <path> --json
openclaw config set <path> <value>
openclaw config set <path> <json5> --strict-json
openclaw config set <path> <json5> --strict-json --merge
openclaw config set <path> <json5> --strict-json --replace
openclaw config set channels.discord.token --ref-provider default --ref-source env --ref-id DISCORD_BOT_TOKEN
openclaw config set secrets.providers.vault --provider-source exec --provider-command /usr/local/bin/openclaw-vault --provider-arg read --provider-arg openai/api-key
openclaw config set --batch-json '[{"path":"secrets.providers.default","provider":{"source":"env"}}]'
openclaw config set --batch-file ./config-set.batch.json --dry-run
openclaw config patch --file ./openclaw.patch.json5 --dry-run
openclaw config patch --stdin
openclaw config patch --file ./patch.json5 --replace-path 'channels.discord.guilds["123"].channels'
openclaw config unset <path>
openclaw config validate
openclaw config validate --json
```

| Subcommand / flag | Purpose |
|---|---|
| `config file` | Print active config path, resolved from `OPENCLAW_CONFIG_PATH` or default state. |
| `config schema` | Print generated JSON schema for `openclaw.json`. |
| `config get <path>` | Read one config path. |
| `config set <path> <value>` | Set path; values parse as JSON5 when possible, otherwise strings. |
| `config patch --file <path>` | Recursively merge JSON5 object patch; arrays/scalars replace; `null` deletes. |
| `config patch --stdin` | Read patch from stdin. |
| `config unset <path>` | Remove path. |
| `config validate` | Validate current config against active schema. |
| `--strict-json` | Require JSON5 parsing. |
| `--json` | JSON output or legacy strict JSON mode depending command. |
| `--merge` | Merge map/list assignments for protected paths. |
| `--replace` | Replace protected target completely. |
| `--replace-path <path>` | Patch mode: replace selected nested object/array exactly. |
| `--ref-provider <alias>` | SecretRef provider alias. |
| `--ref-source <source>` | SecretRef source such as `env`, `file`, `exec`. |
| `--ref-id <id>` | SecretRef id, commonly an env var or provider key id. |
| `--batch-json <json>` | Batch assignment list. |
| `--batch-file <path>` | Batch assignment file. |
| `--dry-run` | Validate without writing. |
| `--allow-exec` | Dry-run only; allow exec SecretRef checks. |

Provider-builder flags for `secrets.providers.<alias>`:

| Flag | Applies to | Purpose |
|---|---|---|
| `--provider-source <source>` | all | Secret provider source, e.g. `env`, `file`, `exec`. |
| `--provider-timeout-ms <ms>` | `file`, `exec` | Provider timeout. |
| `--provider-allowlist <pattern>` | repeatable | Provider allowlist entry. |
| `--provider-path <path>` | `file` | Secret file path. |
| `--provider-mode <mode>` | `file` | File provider mode such as JSON. |
| `--provider-max-bytes <n>` | `file` | File provider max read size. |
| `--provider-allow-insecure-path` | `file`, `exec` | Break-glass path security override. |
| `--provider-command <path>` | `exec` | Exec provider command path. |
| `--provider-arg <arg>` | repeatable | Exec provider argument. |
| `--provider-no-output-timeout-ms <ms>` | `exec` | No-output timeout. |
| `--provider-max-output-bytes <n>` | `exec` | Max stdout bytes. |
| `--provider-json-only` | `exec` | Require JSON output. |
| `--provider-env <KEY=VALUE>` | repeatable | Set provider env. |
| `--provider-pass-env <KEY>` | repeatable | Pass host env var through. |
| `--provider-trusted-dir <path>` | repeatable | Trusted command directory. |
| `--provider-allow-symlink-command` | `exec` | Permit symlinked command when trusted. |

### `completion`

```bash
openclaw completion
openclaw completion --shell zsh
openclaw completion --shell fish --install
openclaw completion --shell bash --write-state
```

| Flag | Accepted values | Purpose |
|---|---|---|
| `-s`, `--shell <shell>` | `zsh`, `bash`, `powershell`, `fish`; default `zsh` | Shell target. |
| `-i`, `--install` | boolean | Add profile source block pointing at cached script. |
| `--write-state` | boolean | Write scripts under `$OPENCLAW_STATE_DIR/completions`. |
| `-y`, `--yes` | boolean | Skip install confirmations. |

### `doctor`

```bash
openclaw doctor
openclaw doctor --repair
openclaw doctor --fix
openclaw doctor --deep
openclaw doctor --repair --non-interactive
openclaw doctor --generate-gateway-token
```

| Flag | Purpose |
|---|---|
| `--no-workspace-suggestions` | Disable workspace memory/search suggestions. |
| `--yes` | Accept defaults without prompting. |
| `--repair` | Apply recommended non-service repairs without prompting. |
| `--fix` | Alias for `--repair`. |
| `--force` | Apply aggressive repairs, including overwriting custom service config when needed. |
| `--non-interactive` | Run without prompts; safe migrations and non-service repairs only. |
| `--generate-gateway-token` | Generate and configure Gateway token. |
| `--deep` | Scan system services for extra Gateway installs and restart handoffs. |

### `dashboard`

```bash
openclaw dashboard
openclaw dashboard --no-open
```

| Flag | Purpose |
|---|---|
| `--no-open` | Start/print the Control UI without opening a browser. |

### `backup`, `reset`, `uninstall`, `update`

```bash
openclaw backup create
openclaw backup create --output ./openclaw-backup.zip --verify --json
openclaw backup create --dry-run
openclaw backup create --no-include-workspace
openclaw backup create --only-config
openclaw backup verify ./openclaw-backup.zip

openclaw reset --scope config --dry-run
openclaw reset --scope config+creds+sessions --yes
openclaw reset --scope full --non-interactive

openclaw uninstall --service --state --workspace --app --yes
openclaw uninstall --all --dry-run

openclaw update
openclaw update status
openclaw update wizard
openclaw update --channel beta
openclaw update --channel dev
openclaw update --tag beta
openclaw update --tag main
openclaw update --dry-run
openclaw update --no-restart
openclaw update --yes
openclaw update --json
openclaw update status --json
openclaw update status --timeout 10
openclaw --update
```

| Command / flag | Purpose |
|---|---|
| `backup create` | Create state/config/workspace archive. |
| `backup verify <archive>` | Verify backup archive. |
| `backup create --output <path>` | Output path. |
| `backup create --dry-run` | Preview. |
| `backup create --json` | JSON summary. |
| `backup create --verify` | Verify after creating. |
| `backup create --no-include-workspace` | Exclude workspace. |
| `backup create --only-config` | Include only config. |
| `reset --scope <scope>` | Reset scope: `config`, `config+creds+sessions`, `full`. |
| `reset --yes` | Skip confirmation. |
| `reset --non-interactive` | No prompts. |
| `reset --dry-run` | Preview reset. |
| `uninstall --service` | Remove service. |
| `uninstall --state` | Remove state. |
| `uninstall --workspace` | Remove workspace. |
| `uninstall --app` | Remove app/install artifact where supported. |
| `uninstall --all` | Remove all uninstall scopes. |
| `uninstall --yes`, `--non-interactive`, `--dry-run` | Confirmation/automation controls. |
| `update --no-restart` | Skip Gateway restart after successful update. |
| `update --channel <channel>` | Persist update channel. |
| `update --tag <tag>` | One-run package/git target override. |
| `update --dry-run` | Preview actions. |
| `update --json` | Machine-readable result. |
| `update --timeout <duration>` | Per-step timeout; default documented as 1800s for full update, 3s for status. |
| `update --yes` | Skip prompts. |

### `message`

```bash
openclaw message <action> [flags]
openclaw message send --channel discord --target channel:123 --message "hi" --reply-to 456
openclaw message broadcast --channel all --targets discord:channel:123 --targets slack:channel:C123 --message "deploy complete"
```

Common flags:

| Flag | Purpose |
|---|---|
| `--channel <channel>` | Channel selector; values include `discord`, `googlechat`, `imessage`, `matrix`, `mattermost`, `msteams`, `signal`, `slack`, `telegram`, `whatsapp`. |
| `--account <id>` | Channel account id. |
| `--target <target>` | Target channel/user/conversation for actions. |
| `--targets <target>` | Repeatable; broadcast targets. |
| `--json` | JSON output. |
| `--dry-run` | Preview action. |
| `--verbose` | Verbose diagnostics. |

Target forms:

| Channel | `--target` forms |
|---|---|
| WhatsApp | E.164, group JID, WhatsApp Channel/Newsletter JID ending `@newsletter`. |
| Telegram | chat id, `@username`, forum target `-100123:topic:42`, or `--thread-id`. |
| Discord | `channel:`, `user:`, mention `<@id>`, raw numeric id as channel. |
| Google Chat | `spaces/`, `users/`. |
| Slack | `channel:`, `user:`, raw channel id. |
| Mattermost | `channel:`, `user:`, `@username`, bare ids as channels. |
| Signal | `+E.164`, `group:`, `signal:+E.164`, `signal:group:`, `username:`, `u:`. |
| iMessage | handle, `chat_id:`, `chat_guid:`, `chat_identifier:`. |
| Matrix | `@user:server`, `!room:server`, `#alias:server`. |
| Microsoft Teams | conversation id, `conversation:`, `user:`. |

Actions:

| Action | Channels | Required flags | Optional flags / notes |
|---|---|---|---|
| `send` | WhatsApp, Telegram, Discord, Google Chat, Slack, Mattermost, Signal, iMessage, Matrix, Microsoft Teams | `--target` plus one of `--message`, `--media`, `--presentation` | `--media`, `--presentation`, `--delivery`, `--pin`, `--reply-to`, `--thread-id`, `--gif-playback`, `--force-document`, `--silent`; Telegram `--force-document`, `--thread-id`; Slack `--thread-id`; Telegram/Discord `--silent`; WhatsApp `--gif-playback`. |
| `broadcast` | any configured channel; `--channel all` for all | `--targets` repeatable | `--message`, `--media`, `--dry-run`. |
| `poll` | WhatsApp, Telegram, Discord, Matrix, Microsoft Teams | `--target`, `--poll-question`, `--poll-option` repeatable | `--poll-multi`; Discord `--poll-duration-hours`, `--silent`, `--message`; Telegram `--poll-duration-seconds` 5-600, `--silent`, `--poll-anonymous`, `--poll-public`, `--thread-id`. |
| `react` | Discord, Google Chat, Slack, Telegram, WhatsApp, Signal, Matrix | `--message-id`, `--target` | `--emoji`, `--remove`, `--participant`, `--from-me`, `--target-author`, `--target-author-uuid`; `--remove` requires `--emoji`. |
| `reactions` | Discord, Google Chat, Slack, Matrix | `--message-id`, `--target` | `--limit`. |
| `read` | Discord, Slack, Matrix | `--target` | `--limit`, `--message-id`, `--before`, `--after`; Slack exact thread with `--message-id` plus `--thread-id`; Discord `--around`. |
| `edit` | Discord, Slack, Matrix | `--message-id`, `--message`, `--target` | none documented. |
| `delete` | Discord, Slack, Telegram, Matrix | `--message-id`, `--target` | none documented. |
| `pin`, `unpin` | Discord, Slack, Matrix | `--message-id`, `--target` | none documented. |
| `pins` | Discord, Slack, Matrix | `--target` | none documented. |
| `permissions` | Discord, Matrix | `--target` | Matrix requires Matrix encryption and verification actions allowed. |
| `search` | Discord | `--guild-id`, `--query` | `--channel-id`, `--channel-ids`, `--author-id`, `--author-ids`, `--limit`. |
| `thread create` | Discord | `--thread-name`, `--target` | `--message-id`, `--message`, `--auto-archive-min`. |
| `thread list` | Discord | `--guild-id` | `--channel-id`, `--include-archived`, `--before`, `--limit`. |
| `thread reply` | Discord | `--target`, `--message` | `--media`, `--reply-to`. |
| `emoji list` | Discord, Slack | Discord requires `--guild-id` | none documented for Slack. |
| `emoji upload` | Discord | `--guild-id`, `--emoji-name`, `--media` | `--role-ids` repeatable. |
| `sticker send` | Discord | `--target`, `--sticker-id` repeatable | `--message`. |
| `sticker upload` | Discord | `--guild-id`, `--sticker-name`, `--sticker-desc`, `--sticker-tags`, `--media` | none documented. |
| `role info` | Discord | `--guild-id` | none documented. |
| `role add`, `role remove` | Discord | `--guild-id`, `--user-id`, `--role-id` | none documented. |
| `channel info` | Discord | `--target` | none documented. |
| `channel list` | Discord | `--guild-id` | none documented. |
| `member info` | Discord, Slack | `--user-id`; Discord also `--guild-id` | none documented. |
| `voice status` | Discord | `--guild-id`, `--user-id` | none documented. |
| `event list` | Discord | `--guild-id` | none documented. |
| `event create` | Discord | `--guild-id`, `--event-name`, `--start-time` | `--end-time`, `--desc`, `--channel-id`, `--location`, `--event-type`. |
| `timeout` | Discord | `--guild-id`, `--user-id` | `--duration-min` or `--until`; omit both to clear; `--reason`. |
| `kick` | Discord | `--guild-id`, `--user-id` | `--reason`. |
| `ban` | Discord | `--guild-id`, `--user-id` | `--delete-days`, `--reason`. |

### `agent`

```bash
openclaw agent --to +15555550123 --message "status update" --deliver
openclaw agent --agent ops --message "Summarize logs"
openclaw agent --agent ops --model openai/gpt-5.4 --message "Summarize logs"
openclaw agent --session-id 1234 --message "Summarize inbox" --thinking medium
openclaw agent --to +15555550123 --message "Trace logs" --verbose on --json
openclaw agent --agent ops --message "Generate report" --deliver --reply-channel slack --reply-to "#reports"
openclaw agent --agent ops --message "Run locally" --local
```

At least one session selector is required: `--to`, `--session-id`, or `--agent`.

| Flag | Accepted values / notes | Purpose |
|---|---|---|
| `-m`, `--message <text>` | required | Message body. |
| `-t`, `--to <recipient>` | selector | Recipient used to derive session key. |
| `--session-id <id>` | selector | Explicit session id. |
| `--agent <id>` | selector | Configured agent id; overrides routing bindings. |
| `--model <model>` | provider/model or id | Per-run model override. |
| `--thinking <level>` | `off`, `minimal`, `low`, `medium`, `high`, plus provider-supported `xhigh`, `adaptive`, `max` | Agent thinking level. |
| `--verbose <level>` | value | Persist verbose level for session. |
| `--channel <channel>` | channel id | Delivery channel; omitted uses main session channel. |
| `--reply-to <target>` | target | Delivery target override. |
| `--reply-channel <channel>` | channel id | Delivery channel override. |
| `--reply-account <account>` | account id | Delivery account override. |
| `--local` | boolean | Force embedded agent run. |
| `--deliver` | boolean | Send reply back to channel/target. |
| `--timeout <duration>` | default 600s or config | Override agent timeout. |
| `--json` | boolean | JSON output. |

### `agents`

```bash
openclaw agents
openclaw agents list
openclaw agents list --bindings
openclaw agents add work --workspace ~/.openclaw/workspace-work
openclaw agents add ops --workspace ~/.openclaw/workspace-ops --bind telegram:ops --non-interactive
openclaw agents bindings
openclaw agents bindings --agent work --json
openclaw agents bind --agent work --bind telegram:ops --bind discord:guild-a
openclaw agents unbind --agent work --bind telegram:ops
openclaw agents unbind --agent work --all
openclaw agents delete work --force --json
openclaw agents set-identity --workspace ~/.openclaw/workspace --from-identity
openclaw agents set-identity --agent main --name "OpenClaw" --avatar avatars/openclaw.png
```

| Subcommand | Flags | Purpose / notes |
|---|---|---|
| `agents` | none | Equivalent to `agents list`. |
| `agents list` | `--json`, `--bindings` | List agents; `--bindings` includes full routing rules. |
| `agents add [name]` | `--workspace <path>`, `--model <model>`, `--agent-dir <path>`, `--bind <channel[:account]>` repeatable, `--non-interactive`, `--json` | Create isolated agent. Non-interactive mode requires name and workspace. `main` is reserved. |
| `agents bindings` | `--agent <id>`, `--json` | List routing bindings. |
| `agents bind` | `--agent <id>`, `--bind <channel[:account]>` repeatable, `--json` | Add routing bindings; defaults to current default agent when `--agent` omitted. |
| `agents unbind` | `--agent <id>`, `--bind <channel[:account]>` repeatable, `--all`, `--json` | Remove bindings. `--all` and `--bind` are mutually exclusive. |
| `agents delete <name>` | `--force`, `--json` | Delete agent; `main` cannot be deleted; workspace/session dirs move to Trash where supported. |
| `agents set-identity` | `--agent <id>`, `--workspace <path>`, `--identity-file <path>`, `--from-identity`, `--name <name>`, `--theme <theme>`, `--emoji <emoji>`, `--avatar <path|url|data-uri>`, `--json` | Write `agents.list[].identity`; `IDENTITY.md` read from workspace root when requested. |

### `acp`

```bash
openclaw acp --url ws://127.0.0.1:18789 --session main
openclaw acp --token <token> --session-label "ops"
openclaw acp client --cwd . --server node --server-args server.js
```

| Command / flag | Purpose |
|---|---|
| `acp` | ACP bridge to Gateway. |
| `--url <ws-url>` | Gateway WebSocket URL. |
| `--token <token>` | Gateway token. |
| `--token-file <path>` | Read token from file. |
| `--password <password>` | Gateway password. |
| `--password-file <path>` | Read password from file. |
| `--session <key>` | Session key. |
| `--session-label <label>` | Session label. |
| `--require-existing` | Require existing session. |
| `--reset-session` | Reset session. |
| `--no-prefix-cwd` | Do not prefix CWD. |
| `--provenance <value>` | Set provenance. |
| `--verbose` | Verbose diagnostics. |
| `acp client` | Run ACP client process. |
| `acp client --cwd <path>` | Working directory. |
| `acp client --server <cmd>` | ACP server command. |
| `acp client --server-args <args>` | Server args. |
| `acp client --server-verbose` | Verbose server logging. |

### `mcp`

```bash
openclaw mcp serve
openclaw mcp serve --url ws://127.0.0.1:18789 --token <token>
openclaw mcp list
openclaw mcp show <name> --json
openclaw mcp set <name> '<json>'
openclaw mcp unset <name>
```

| Subcommand / flag | Purpose |
|---|---|
| `mcp serve` | Expose OpenClaw conversation/Gateway tools as an MCP server. |
| `mcp serve --url <ws-url>` | Gateway WebSocket URL. |
| `mcp serve --token <token>` / `--token-file <path>` | Gateway token source. |
| `mcp serve --password <password>` / `--password-file <path>` | Gateway password source. |
| `mcp serve --claude-channel-mode <mode>` | `auto`, `on`, `off`. |
| `mcp serve --verbose` | Verbose server logs. |
| `mcp list` | List configured MCP servers. |
| `mcp show <name>` | Show one MCP config. |
| `mcp show <name> --json` | JSON output. |
| `mcp set <name> <json>` | Set MCP config. |
| `mcp unset <name>` | Remove MCP config. |

MCP bridge tool names documented for the bridge include `conversations_list`, `conversation_get`, `messages_read`, `message_content_read`, `events_poll`, `events_wait`, `messages_send`, `permissions_list_open`, and `permission_respond`.

### `status`, `health`, `sessions`, `logs`, `system`

```bash
openclaw status
openclaw status --all
openclaw status --deep
openclaw status --usage
openclaw status --json
openclaw health --json --timeout 3000 --verbose --debug

openclaw sessions
openclaw sessions --agent ops --active --limit 20 --json
openclaw sessions export-trajectory --session-key <key> --workspace ~/.openclaw/workspace --output ./trajectory.json --json
openclaw sessions cleanup --dry-run --agent ops --json
openclaw sessions cleanup --enforce --active-key <key> --fix-missing --fix-dm-scope --all-agents

openclaw logs --limit 100 --max-bytes 100000 --plain
openclaw logs --follow --interval 1000 --json
openclaw logs --local-time --no-color

openclaw system event --text "maintenance" --mode now --json
openclaw system heartbeat last --json
openclaw system heartbeat enable
openclaw system heartbeat disable
openclaw system presence --json
```

| Command / flag | Purpose |
|---|---|
| `status --all` | Include broad status. |
| `status --deep` | Deep diagnostics. |
| `status --usage` | Usage/quota overview. |
| `status --json` | JSON status. |
| `health --json` | JSON health output. |
| `health --timeout <ms>` | Timeout. |
| `health --verbose` | Verbose checks. |
| `health --debug` | Debug detail. |
| `sessions --agent <id>` | Scope sessions to agent. |
| `sessions --all-agents` | Include all agents. |
| `sessions --store <name>` | Store selector. |
| `sessions --active` | Active sessions only. |
| `sessions --limit <n>` | Limit. |
| `sessions --verbose` | Verbose. |
| `sessions --json` | JSON. |
| `sessions export-trajectory --session-key <key>` | Export one session trajectory. |
| `sessions export-trajectory --workspace <path>` | Workspace path. |
| `sessions export-trajectory --output <path>` | Output file. |
| `sessions cleanup --dry-run` | Preview cleanup. |
| `sessions cleanup --enforce` | Enforce cleanup. |
| `sessions cleanup --active-key <key>` | Preserve active key. |
| `sessions cleanup --fix-missing` | Repair missing refs. |
| `sessions cleanup --fix-dm-scope` | Repair DM scope. |
| `logs --limit <n>` | Number of log records. |
| `logs --max-bytes <n>` | Max bytes to inspect. |
| `logs --follow` | Follow logs. |
| `logs --interval <ms>` | Poll interval. |
| `logs --json` | JSON output. |
| `logs --plain` | Plain text. |
| `logs --no-color` | Disable color. |
| `logs --local-time` | Local timestamps. |
| `system event --text <text>` | Emit system event text. |
| `system event --mode <mode>` | `now`, `next-heartbeat`. |
| `system heartbeat last|enable|disable` | Heartbeat state. |
| `system presence` | Presence state. |
| `--url <ws-url>`, `--token <token>`, `--timeout <ms>`, `--expect-final` | Shared Gateway RPC flags on supported `logs`/`system` commands. |

### `gateway`

```bash
openclaw gateway
openclaw gateway run
openclaw gateway run --port 18789 --bind 127.0.0.1 --auth token --token <token>
openclaw gateway restart
openclaw gateway restart --safe
openclaw gateway restart --safe --skip-deferral
openclaw gateway restart --force
openclaw gateway status --json --require-rpc
openclaw gateway probe --json
openclaw gateway probe --ssh user@gateway-host
openclaw gateway call status
openclaw gateway call logs.tail --params '{"sinceMs":60000}' --json
openclaw gateway usage-cost --days 7 --json
openclaw gateway stability --type payload.large --json
openclaw gateway stability --bundle latest --export --output ./stability.zip
openclaw gateway diagnostics export --output openclaw-diagnostics.zip --json
openclaw gateway discover --json
openclaw gateway install --port 18789 --runtime node --token <token> --json
openclaw gateway install --wrapper ~/.local/bin/openclaw-wrapper --force
openclaw gateway start --json
openclaw gateway stop --disable --json
openclaw gateway uninstall --json
```

`gateway`/`gateway run` options:

| Flag | Purpose |
|---|---|
| `--port <port>` | WebSocket port; config/env default usually `18789`. |
| `--bind <mode-or-host>` | Listener bind mode/host. |
| `--auth <mode>` | Auth mode override. |
| `--token <token>` | Token override; also sets `OPENCLAW_GATEWAY_TOKEN` for process. |
| `--password <password>` | Password override. |
| `--password-file <path>` | Read password from file. |
| `--tailscale` | Expose Gateway via Tailscale. |
| `--tailscale-reset` | Reset Tailscale serve/funnel config on shutdown. |
| `--allow-unconfigured` | Allow dev/ad-hoc start without `gateway.mode=local`; does not write config. |
| `--create-dev-config` | Create dev config and workspace if missing. |
| `--reset-dev` | Reset dev config, credentials, sessions, workspace; requires `--dev`. |
| `--kill-existing` | Kill existing listener on selected port before starting. |
| `--verbose` | Verbose logs. |
| `--backend-logs-only` | Only show CLI backend logs and enable stdout/stderr. |
| `--ws-log <style>` | WebSocket log style. |
| `--compact-ws-log` | Alias for `--ws-log compact`. |
| `--raw-stream-log` | Log raw model stream events to JSONL. |
| `--raw-stream-log-path <path>` | JSONL path for raw stream events. |

Gateway RPC / service options:

| Subcommand | Flags |
|---|---|
| `gateway health` | `--url <ws-url>` |
| `gateway usage-cost` | `--days <n>`, `--json` |
| `gateway stability` | `--limit <n>`, `--type <event-type>`, `--since-seq <n>`, `--bundle [path|latest]`, `--export`, `--output <path>`, `--json` |
| `gateway diagnostics export` | `--output <zip>`, `--max-lines <n>`, `--max-bytes <n>`, `--url <ws-url>`, `--token <token>`, `--password <password>`, `--timeout <ms>`, `--skip-stability`, `--json` |
| `gateway status` | `--url <ws-url>`, `--token <token>`, `--password <password>`, `--timeout <ms>`, `--no-probe`, `--require-rpc`, `--deep`, `--json` |
| `gateway probe` | `--url <ws-url>`, `--token <token>`, `--password <password>`, `--timeout <ms>`, `--json`, `--ssh <user@host[:port]>`, `--ssh-identity <path>`, `--ssh-discovery` |
| `gateway call <method>` | `--params <json-object>`, `--url <ws-url>`, `--token <token>`, `--password <password>`, `--timeout <ms>`, `--expect-final`, `--json` |
| `gateway install` | `--port <port>`, `--runtime <runtime>`, `--token <token>`, `--wrapper <path>`, `--force`, `--json` |
| `gateway restart` | `--safe`, `--skip-deferral`, `--force`, `--wait <duration>`, `--json` |
| `gateway uninstall` | `--json` |
| `gateway start` | `--json` |
| `gateway stop` | `--disable`, `--json` |
| `gateway discover` | `--timeout <ms>`, `--json` |

### `daemon` legacy alias

```bash
openclaw daemon status
openclaw daemon install
openclaw daemon start
openclaw daemon stop
openclaw daemon restart
openclaw daemon uninstall
```

Maps to Gateway service management. Options mirror `gateway status|install|start|stop|restart|uninstall`:

| Subcommand | Flags |
|---|---|
| `daemon status` | `--url`, `--token`, `--password`, `--timeout`, `--no-probe`, `--require-rpc`, `--deep`, `--json` |
| `daemon install` | `--port`, `--runtime <runtime>`, `--token`, `--force`, `--json` |
| `daemon restart` | `--safe`, `--skip-deferral`, `--force`, `--wait <duration>`, `--json` |
| `daemon uninstall`, `daemon start`, `daemon stop` | `--json` |

### `models`

```bash
openclaw models list
openclaw models status
openclaw models status --json --probe
openclaw models status --plain --check
openclaw models set openai/gpt-5.5
openclaw models set-image openai/gpt-image-1
openclaw models scan --provider openai --min-params 7B --max-candidates 20 --set-default --json
openclaw models aliases list
openclaw models aliases add fast openai/gpt-5.5
openclaw models aliases remove fast
openclaw models fallbacks list
openclaw models fallbacks add openai/gpt-5.5
openclaw models fallbacks clear
openclaw models image-fallbacks list
openclaw models image-fallbacks add openai/gpt-image-1
openclaw models image-fallbacks clear
openclaw models auth add
openclaw models auth list
openclaw models auth login --provider openai --set-default
openclaw models auth login-github-copilot
openclaw models auth setup-token
openclaw models auth paste-token
openclaw models auth status
openclaw models auth logout
openclaw models auth order get
openclaw models auth order set openai,anthropic,codex-cli
openclaw models auth order clear
```

| Command / flag | Purpose |
|---|---|
| `models list` | List known models/providers. |
| `models status` | Model/provider status. |
| `models status --json` | JSON output. |
| `models status --plain` | Plain output. |
| `models status --check` | Check mode. |
| `models status --probe` | Probe providers. |
| `models status --probe-provider <provider>` | Provider filter for probe. |
| `models status --probe-profile <profile>` | Probe auth profile. |
| `models status --probe-timeout <ms>` | Probe timeout. |
| `models status --probe-concurrency <n>` | Probe concurrency. |
| `models status --probe-max-tokens <n>` | Max tokens for probe. |
| `models status --agent <id>` | Agent scope. |
| `models set <model>` | Set default text model. |
| `models set-image <model>` | Set default image model. |
| `models scan` | Scan candidate models. |
| `models scan --no-probe` | Do not probe candidates. |
| `models scan --min-params <value>` | Minimum model size. |
| `models scan --max-age-days <n>` | Freshness filter. |
| `models scan --provider <provider>` | Provider filter. |
| `models scan --max-candidates <n>` | Candidate cap. |
| `models scan --timeout <ms>` | Probe timeout. |
| `models scan --concurrency <n>` | Probe concurrency. |
| `models scan --yes` | Skip prompts. |
| `models scan --no-input` | Non-interactive. |
| `models scan --set-default` | Set selected default. |
| `models scan --set-image` | Set selected image default. |
| `models scan --json` | JSON output. |
| `models aliases list|add|remove` | Manage aliases. |
| `models fallbacks list|add|remove|clear` | Manage text fallbacks. |
| `models image-fallbacks list|add|remove|clear` | Manage image fallbacks. |
| `models auth add|list|login|login-github-copilot|setup-token|paste-token|status|logout` | Manage provider auth profiles. |
| `models auth order get|set|clear` | Manage provider auth order. |

### `infer` / `capability`

```bash
openclaw infer list
openclaw infer inspect <capability>
openclaw infer model run --prompt "hello" --model openai/gpt-5.5 --json
openclaw infer model run --file ./prompt.txt --thinking medium --local
openclaw infer model list
openclaw infer model inspect openai/gpt-5.5
openclaw infer model providers
openclaw infer model auth login --provider openai
openclaw infer model auth logout --provider openai
openclaw infer model auth status
openclaw infer image generate --prompt "diagram" --output out.png --size 1024x1024 --json
openclaw infer image edit --file in.png --prompt "remove background" --output out.png
openclaw infer image describe --file image.png --prompt "describe" --json
openclaw infer image describe-many --file a.png --file b.png --json
openclaw infer image providers
openclaw infer audio transcribe --file memo.m4a --model openai/whisper-1 --json
openclaw infer audio providers
openclaw infer tts convert --text "hello" --output out.mp3 --json
openclaw infer tts voices
openclaw infer tts providers
openclaw infer tts status
openclaw infer tts enable
openclaw infer tts disable
openclaw infer tts set-provider <provider>
openclaw infer video generate --prompt "short clip" --duration 5 --json
openclaw infer video describe --file clip.mp4 --json
openclaw infer video providers
openclaw infer web search --query "OpenClaw docs"
openclaw infer web fetch --url https://example.com
openclaw infer web providers
openclaw infer embedding create --text "hello" --model openai/text-embedding-3-large --json
openclaw infer embedding providers
openclaw capability image providers
```

| Command / flag | Purpose |
|---|---|
| `infer list` | List capability groups. |
| `infer inspect <name>` | Inspect capability/provider. |
| `infer model run --prompt <text>` | Run text model. |
| `infer model run --file <path>` | Add prompt/content file; repeatable where supported. |
| `infer model run --model <provider/model>` | Model override. |
| `infer model run --thinking <level>` | `off`, `minimal`, `low`, `medium`, `high`, `adaptive`, `xhigh`, `max`. |
| `infer model run --local` | Local execution. |
| `infer model run --gateway` | Gateway execution. |
| `infer model run --json` | JSON output. |
| `infer model list|inspect|providers` | List/inspect model providers. |
| `infer model auth login|logout|status` | Provider auth. |
| `infer image generate|edit --prompt <text>` | Image create/edit prompt. |
| `infer image generate|edit --model <model>` | Image model. |
| `infer image edit --file <path>` | Source image file. |
| `infer image generate|edit --output <path>` | Output file. |
| `infer image generate|edit --output-format <format>` | Output format. |
| `infer image generate|edit --background <mode>` | Background mode. |
| `infer image generate|edit --openai-background <mode>` | OpenAI-specific background option. |
| `infer image generate|edit --size <size>` | Size. |
| `infer image generate|edit --aspect-ratio <ratio>` | Aspect ratio. |
| `infer image generate|edit --resolution <resolution>` | Resolution. |
| `infer image generate|edit --timeout-ms <ms>` | Timeout. |
| `infer image generate|edit --json` | JSON output. |
| `infer image describe --file <path>` | Image file. |
| `infer image describe --prompt <text>` | Prompt. |
| `infer image describe --model <model>` | Model. |
| `infer image describe --timeout-ms <ms>` | Timeout. |
| `infer image describe-many --file <path>` | Repeatable files. |
| `infer audio transcribe --file <path>` | Audio file. |
| `infer audio transcribe --language <lang>` | Language hint. |
| `infer audio transcribe --prompt <text>` | Prompt/context. |
| `infer audio transcribe --model <provider/model>` | Transcription model; include provider prefix. |
| `infer tts convert --text <text>` | TTS source text. |
| `infer tts convert --output <path>` | Output audio path. |
| `infer tts voices|providers|status|enable|disable|set-provider` | TTS provider controls. |
| `infer video generate --prompt <text>` | Video prompt. |
| `infer video generate --size <size>` | Size. |
| `infer video generate --aspect-ratio <ratio>` | Aspect ratio. |
| `infer video generate --resolution <resolution>` | Resolution. |
| `infer video generate --duration <seconds>` | Duration. |
| `infer video generate --audio <mode>` | Audio mode. |
| `infer video generate --watermark <mode>` | Watermark mode. |
| `infer video generate --timeout-ms <ms>` | Timeout. |
| `infer video describe --file <path>` | Video file. |
| `infer video describe --model <model>` | Model. |
| `infer web search --query <query>` | Web search query. |
| `infer web fetch --url <url>` | Fetch URL. |
| `infer embedding create --text <text>` | Text to embed. |
| `infer embedding create --model <model>` | Embedding model. |
| `capability` | Alias for `infer`. |

### `memory`, `commitments`, `wiki`

```bash
openclaw memory status --agent main --verbose --deep --index --json
openclaw memory index --fix --json
openclaw memory search "deployment notes" --max-results 10 --min-score 0.5 --json
openclaw memory promote --apply --limit 20 --min-score 0.6 --min-recall-count 2 --min-unique-queries 2 --include-promoted --json
openclaw memory promote-explain --json
openclaw memory rem-harness
openclaw memory rem-backfill

openclaw commitments
openclaw commitments list --all --agent ops --status pending --json
openclaw commitments dismiss <id1> <id2>

openclaw wiki status
openclaw wiki doctor
openclaw wiki init
openclaw wiki ingest ./notes
openclaw wiki compile
openclaw wiki lint
openclaw wiki search "query" --mode auto
openclaw wiki search "Alice" --mode find-person
openclaw wiki get PageName --from 1 --lines 40
openclaw wiki apply synthesis
openclaw wiki apply metadata
openclaw wiki bridge import
openclaw wiki unsafe-local import
openclaw wiki obsidian status
openclaw wiki obsidian search "query"
openclaw wiki obsidian open PageName
openclaw wiki obsidian command <command>
openclaw wiki obsidian daily
```

| Command / flag | Purpose |
|---|---|
| `memory status` | Memory subsystem status. |
| `memory status --agent <id>` | Agent scope. |
| `memory status --verbose`, `--deep`, `--index`, `--fix`, `--json` | Detail/index/repair/output controls. |
| `memory index` | Build/check index. |
| `memory search <query>` | Search memory. |
| `memory search --max-results <n>` | Result cap. |
| `memory search --min-score <score>` | Minimum score. |
| `memory promote` | Promote recurring memory candidates. |
| `memory promote --apply` | Apply promotions. |
| `memory promote --limit <n>` | Limit candidates. |
| `memory promote --min-score <score>` | Score threshold. |
| `memory promote --min-recall-count <n>` | Recall threshold. |
| `memory promote --min-unique-queries <n>` | Query diversity threshold. |
| `memory promote --include-promoted` | Include already promoted. |
| `memory promote-explain` | Explain promotion candidates. |
| `memory rem-harness`, `memory rem-backfill` | REM test/backfill tools. |
| `commitments list` | List commitments; bare `commitments` aliases list. |
| `commitments --all` | Include all. |
| `commitments --agent <id>` | Agent filter. |
| `commitments --status <status>` | `pending`, `sent`, `dismissed`, `snoozed`, `expired`. |
| `commitments dismiss <ids...>` | Dismiss commitments. |
| `wiki search --mode <mode>` | `auto`, `find-person`, `route-question`, `source-evidence`, `raw-claim`. |
| `wiki get <page> --from <line> --lines <n>` | Read page excerpt. |
| `wiki apply synthesis|metadata` | Apply wiki transformations. |
| `wiki obsidian ...` | Obsidian integration commands. |

### `directory`, `nodes`, `devices`, `node`

```bash
openclaw directory self --json
openclaw directory peers list --channel slack --account work --query jane --limit 20 --json
openclaw directory groups list --channel discord --account main --json
openclaw directory groups members --group-id <id> --json

openclaw nodes list --connected --json
openclaw nodes pending --json
openclaw nodes approve --node <id>
openclaw nodes reject --node <id>
openclaw nodes remove --node <id>
openclaw nodes rename --node <id> --name "desk"
openclaw nodes status --json
openclaw nodes describe --node <id> --json
openclaw nodes invoke --node <id> --command camera.snap --params '{"quality":80}' --invoke-timeout 30000 --idempotency-key <key> --json
openclaw nodes notify --node <id> --json
openclaw nodes push --node <id> --json

openclaw devices list --json
openclaw devices approve <requestId>
openclaw devices approve --latest
openclaw devices reject <requestId>
openclaw devices remove --device <id>
openclaw devices clear --yes --pending
openclaw devices rotate --device <id> --role operator --scope read
openclaw devices revoke --device <id> --role operator

openclaw node run --host 127.0.0.1 --port 18790 --display-name "desk"
openclaw node install --runtime node --force
openclaw node status --json
openclaw node start --json
openclaw node stop --json
openclaw node restart --json
openclaw node uninstall --json
```

| Command / flag | Purpose |
|---|---|
| `directory self` | Current identity. |
| `directory peers list` | List peers; flags `--channel`, `--account`, `--query`, `--limit`, `--json`. |
| `directory groups list` | List groups; flags `--channel`, `--account`, `--query`, `--limit`, `--json`. |
| `directory groups members` | Group members; flags `--group-id`, `--channel`, `--account`, `--json`. |
| `nodes list` | List nodes; flags `--connected`, `--last-connected`, `--url`, `--token`, `--timeout`, `--json`. |
| `nodes pending` | Pending node approvals. |
| `nodes approve|reject|remove` | Node approval/removal; `--node <id>`. |
| `nodes rename` | Rename node; `--node`, `--name`. |
| `nodes status` | Node gateway status. |
| `nodes describe` | Describe node. |
| `nodes invoke` | Invoke command on node; `--node`, `--command`, `--params`, `--invoke-timeout`, `--idempotency-key`, `--json`. |
| `nodes notify`, `nodes push` | Node notification/push commands. |
| `devices list` | List device auth records. |
| `devices approve [requestId]` | Approve device; `--latest` selects newest request. |
| `devices reject [requestId]` | Reject device. |
| `devices remove --device <id>` | Remove device. |
| `devices clear --yes [--pending]` | Clear devices, optionally only pending. |
| `devices rotate --device <id> --role <role> [--scope <scope>]` | Rotate device role/scope. |
| `devices revoke --device <id> --role <role>` | Revoke device role. |
| Device common flags | `--url`, `--token`, `--password`, `--timeout`, `--json`. |
| `node run` / `node install` | Node worker service. Flags: `--host`, `--port`, `--tls`, `--tls-fingerprint`, `--node-id`, `--display-name`; install also `--runtime node|bun`, `--force`. |
| `node status|start|stop|restart|uninstall` | Node service commands; `--json`. |

### `approvals` / `exec-policy`

```bash
openclaw approvals get --json
openclaw approvals get --gateway --url ws://127.0.0.1:18789 --token <token>
openclaw approvals set --file ./approvals.json
openclaw approvals set --stdin
openclaw approvals allowlist add --agent ops node:camera.snap
openclaw approvals allowlist remove --agent ops node:camera.snap
openclaw exec-policy show
openclaw exec-policy preset yolo
openclaw exec-policy set --host gateway --security full --ask off --ask-fallback full
```

| Command / flag | Purpose |
|---|---|
| `approvals get` | Read execution approvals. |
| `approvals set` | Write approvals. |
| `approvals allowlist add|remove` | Manage allowlist entries. |
| `--gateway` | Target Gateway approvals. |
| `--node <id>` | Target node approvals. |
| `--url`, `--token`, `--timeout`, `--json` | Gateway RPC/common flags. |
| `--file <path>` | Read policy from file. |
| `--stdin` | Read policy from stdin. |
| `--agent <id>` | Agent-scoped allowlist entry. |
| `exec-policy show` | Show execution policy. |
| `exec-policy preset <name>` | Apply preset, including `yolo`. |
| `exec-policy set --host <host>` | Set host policy. |
| `exec-policy set --security <level>` | Security level. |
| `exec-policy set --ask <mode>` | Ask policy. |
| `exec-policy set --ask-fallback <mode>` | Fallback ask policy. |

Approvals file: `~/.openclaw/exec-approvals.json`.

### `sandbox`, `tui`, `chat`, `terminal`, `browser`

```bash
openclaw sandbox explain --session <key> --agent ops --json
openclaw sandbox list --browser --json
openclaw sandbox recreate --all --force
openclaw sandbox recreate --browser --all
openclaw sandbox recreate --session <key> --agent ops

openclaw tui
openclaw tui --local
openclaw tui --url ws://127.0.0.1:18789 --token <token> --session main --deliver --message "hi"
openclaw chat
openclaw terminal

openclaw browser profiles
openclaw browser create-profile work
openclaw browser delete-profile work
openclaw browser status
openclaw browser doctor
openclaw browser start
openclaw browser stop
openclaw browser reset-profile
openclaw browser tabs
openclaw browser tab new
openclaw browser tab label
openclaw browser tab select
openclaw browser tab close
openclaw browser open https://example.com
openclaw browser focus
openclaw browser close
openclaw browser snapshot
openclaw browser screenshot
openclaw browser navigate https://example.com
openclaw browser click <selector>
openclaw browser click-coords <x> <y>
openclaw browser type <selector> <text>
openclaw browser press Enter
openclaw browser hover <selector>
openclaw browser scrollintoview <selector>
openclaw browser drag <source> <target>
openclaw browser select <selector> <value>
openclaw browser fill <selector> <value>
openclaw browser wait <selector>
openclaw browser evaluate <js>
openclaw browser upload <selector> <path>
openclaw browser waitfordownload
openclaw browser download <url>
openclaw browser dialog
openclaw browser resize 1280 720
openclaw browser set viewport
openclaw browser set offline
openclaw browser set media
openclaw browser set timezone
openclaw browser set locale
openclaw browser set geo
openclaw browser set device
openclaw browser set headers
openclaw browser set credentials
openclaw browser cookies
openclaw browser cookies set
openclaw browser cookies clear
openclaw browser storage local get
openclaw browser storage local set
openclaw browser storage session clear
openclaw browser console
openclaw browser pdf
openclaw browser responsebody
openclaw browser highlight
openclaw browser errors
openclaw browser requests
openclaw browser trace start
openclaw browser trace stop
```

| Command / flag | Purpose |
|---|---|
| `sandbox explain` | Explain sandbox resolution; flags `--session`, `--agent`, `--json`. |
| `sandbox list` | List sandboxes; flags `--browser`, `--json`. |
| `sandbox recreate` | Recreate sandboxes; flags `--all`, `--session`, `--agent`, `--browser`, `--force`. |
| `tui` | Open agent TUI. |
| `chat`, `terminal` | Aliases for `tui --local`. |
| `tui --local` | Embedded local TUI. |
| `tui --url <ws-url>`, `--token <token>`, `--password <password>` | Gateway auth/target. |
| `tui --session <key>` | Session key. |
| `tui --deliver` | Deliver reply. |
| `tui --message <text>` | Initial message. |
| Browser common flags | `--url`, `--token`, `--timeout`, `--expect-final`, `--browser-profile`, `--json`. |
| Browser action flags | (Could not locate authoritative source. Needs hands-on verification.) |

### `cron`, `tasks`, `hooks`, `webhooks`

```bash
openclaw cron status --json
openclaw cron list --json
openclaw cron add --message "daily report" --cron "0 9 * * *" --tz America/Los_Angeles --session main --announce --channel slack --to "#ops"
openclaw cron add --message "one shot" --at "2026-05-10T09:00:00-07:00" --keep-after-run
openclaw cron edit --id <id> --message "new text"
openclaw cron rm --id <id>
openclaw cron enable --id <id>
openclaw cron disable --id <id>
openclaw cron runs --id <id> --limit 20 --json
openclaw cron run --id <id> --due --json

openclaw tasks list --runtime cron --status queued --json
openclaw tasks show <id> --json
openclaw tasks notify <id> --json
openclaw tasks cancel <id> --json
openclaw tasks audit --severity warning --code lost --limit 50 --json
openclaw tasks maintenance --apply --json
openclaw tasks flow list --json
openclaw tasks flow show <id> --json
openclaw tasks flow cancel <id> --json

openclaw hooks list
openclaw hooks list --eligible --json
openclaw hooks list --verbose
openclaw hooks info session-memory --json
openclaw hooks check --json
openclaw hooks enable session-memory
openclaw hooks disable command-logger
openclaw hooks install ./my-hook-pack
openclaw hooks update --all --dry-run

openclaw webhooks gmail setup --account work --project my-project --topic gmail --subscription gmail-sub --label inbox --json
openclaw webhooks gmail run --account work --topic gmail --subscription gmail-sub --include-body --max-bytes 200000
```

| Command / flag | Purpose |
|---|---|
| `cron status|list|add|edit|rm|enable|disable|runs|run` | Cron automation surface. |
| `cron --session <mode>` | `main`, `isolated`, `current`, `session:<key>`. |
| `cron --announce` | Announce result. |
| `cron --deliver` | Deprecated delivery flag. |
| `cron --no-deliver` | Suppress delivery. |
| `cron --channel <channel>` | Delivery channel. |
| `cron --to <target>` | Delivery target. |
| `cron --thread-id <id>` | Thread target. |
| `cron --best-effort-deliver` / `--no-best-effort-deliver` | Best-effort delivery control. |
| `cron --at <datetime>` | One-shot time. |
| `cron --tz <zone>` | Time zone. |
| `cron --keep-after-run` | Keep one-shot after run. |
| `cron --failure-alert-include-skipped` | Include skipped in failure alerts. |
| `cron --model <model>` | Model override. |
| `cron --agent <id>` | Agent. |
| `cron --clear-agent` | Clear agent. |
| `cron --light-context` | Light context mode. |
| `cron --cron <expr>` | Cron expression. |
| `cron --message <text>` | Prompt/message. |
| `cron --due` | Run due items. |
| `cron --id <id>` | Job id. |
| `cron --limit <n>` | Limit runs. |
| `cron --json` | JSON output. |
| `tasks list` | Task list; flags `--json`, `--runtime subagent|acp|cron|cli`, `--status queued|running|succeeded|failed|timed_out|cancelled|lost`. |
| `tasks show|notify|cancel <id>` | Task detail/control. |
| `tasks audit` | Task audit; flags `--severity`, `--code`, `--limit`, `--json`. |
| `tasks maintenance` | Maintenance; `--apply`, `--json`. |
| `tasks flow list|show|cancel` | Flow controls. |
| `hooks list` | List hooks. |
| `hooks list --eligible` | Only hooks with requirements met. |
| `hooks list -v`, `--verbose` | Detailed hook info. |
| `hooks list --json` | JSON. |
| `hooks info <hook>` | Hook detail. |
| `hooks check` | Eligibility summary. |
| `hooks enable <hook>` | Enable workspace/internal hook. |
| `hooks disable <hook>` | Disable hook. |
| `hooks install <spec>` | Compatibility alias for `plugins install`. |
| `hooks update <spec>` / `hooks update --all` | Compatibility alias for `plugins update`; supports `--dry-run`. |
| `webhooks gmail setup` | Configure Gmail Pub/Sub webhook. |
| `webhooks gmail run` | Run Gmail webhook listener/renewal. |
| Gmail flags | `--account`, `--project`, `--topic`, `--subscription`, `--label`, `--hook-url`, `--hook-token`, `--push-token`, `--bind`, `--port`, `--path`, `--include-body`, `--max-bytes`, `--renew-minutes`, `--tailscale`, `--tailscale-path`, `--tailscale-target`, `--push-endpoint`, `--json`; `run` omits project-only setup where unsupported. |

Bundled hooks include `session-memory`, `bootstrap-extra-files`, `command-logger`, and `boot-md`.

### `dns`, `docs`, `pairing`, `qr`, `channels`

```bash
openclaw dns setup --domain openclaw.internal --apply
openclaw docs gateway auth

openclaw pairing list
openclaw pairing list telegram --json
openclaw pairing list --channel telegram --account default
openclaw pairing approve telegram <code> --notify
openclaw pairing approve --channel telegram --account default <code>

openclaw qr
openclaw qr --setup-code-only --json
openclaw qr --remote --url wss://gateway-host:18789 --token <token>
openclaw qr --public-url https://openclaw.example.com --password <password> --no-ascii

openclaw channels list
openclaw channels list --all
openclaw channels status
openclaw channels status --probe --timeout 10000 --json
openclaw channels capabilities --channel discord --target channel:123 --json
openclaw channels resolve --channel slack "#general" "@jane" --json
openclaw channels logs --channel all --lines 100 --json
openclaw channels add --channel telegram --token <token>
openclaw channels add --channel nostr --private-key "$NOSTR_PRIVATE_KEY"
openclaw channels add --channel matrix --homeserver https://matrix.example.com --user-id @bot:example.com --access-token <token>
openclaw channels remove --channel telegram --delete
openclaw channels login --channel whatsapp --verbose
openclaw channels logout --channel whatsapp
```

| Command / flag | Purpose |
|---|---|
| `dns setup --domain <domain>` | Configure DNS-SD/domain discovery. |
| `dns setup --apply` | Apply DNS setup. |
| `docs [query...]` | Search/open OpenClaw docs by query. |
| `pairing list [channel]` | List pairing requests. |
| `pairing list --channel <channel>` | Channel filter. |
| `pairing list --account <account>` | Account filter. |
| `pairing list --json` | JSON. |
| `pairing approve [channel] <code>` | Approve pairing code. |
| `pairing approve --notify` | Notify after approval. |
| `qr --setup-code-only` | Only setup code. |
| `qr --json` | JSON. |
| `qr --remote` | Remote QR. |
| `qr --url <url>` | Gateway URL. |
| `qr --public-url <url>` | Public URL. |
| `qr --token <token>` | Token. |
| `qr --password <password>` | Password. |
| `qr --no-ascii` | Suppress ASCII QR. |
| `channels list --all` | Include unconfigured bundled/installable channels. |
| `channels status --probe` | Live per-account probe/audit when Gateway reachable. |
| `channels status --timeout <ms>` | Probe timeout. |
| `channels capabilities --channel <channel>` | Capability channel. |
| `channels capabilities --account <account>` | Account selector; only with `--channel`. |
| `channels capabilities --target <target>` | Target for effective permissions. |
| `channels resolve <names...>` | Resolve names/ids. |
| `channels resolve --kind <kind>` | Restrict kind. |
| `channels logs --channel <channel|all>` | Channel logs. |
| `channels logs --lines <n>` | Log line count. |
| `channels add --channel <channel>` | Add account. |
| Add token flags | `--token`, `--bot-token`, `--app-token`, `--token-file`. |
| Signal/iMessage add flags | `--signal-number`, `--cli-path`, `--http-url`, `--http-host`, `--http-port`, `--db-path`, `--service`, `--region`. |
| Google Chat add flags | `--webhook-path`, `--webhook-url`, `--audience-type`, `--audience`. |
| Matrix add flags | `--homeserver`, `--user-id`, `--access-token`, `--password`, `--device-name`, `--initial-sync-limit`. |
| Nostr add flags | `--private-key`, `--relay-urls`. |
| Tlon add flags | `--ship`, `--url`, `--code`, `--group-channels`, `--dm-allowlist`, `--auto-discover-channels`. |
| `channels add --use-env` | Use default-account env-backed auth where supported. |
| `channels remove --delete` | Remove account/config. |
| `channels login --channel <channel>` | Interactive channel login. |
| `channels login --verbose` | Verbose login. |
| `channels logout --channel <channel>` | Logout/clear auth. |

### `security`, `secrets`, `skills`, `plugins`, `proxy`

```bash
openclaw security audit
openclaw security audit --deep
openclaw security audit --deep --password <password>
openclaw security audit --deep --token <token>
openclaw security audit --fix
openclaw security audit --json

openclaw secrets reload
openclaw secrets reload --url ws://127.0.0.1:18789 --token <token> --timeout 5000 --json
openclaw secrets audit
openclaw secrets audit --check
openclaw secrets audit --json
openclaw secrets audit --allow-exec
openclaw secrets configure --plan-out /tmp/openclaw-secrets-plan.json
openclaw secrets configure --apply --yes
openclaw secrets configure --providers-only
openclaw secrets configure --skip-provider-setup
openclaw secrets configure --agent ops --json
openclaw secrets apply --from /tmp/openclaw-secrets-plan.json --dry-run --allow-exec --json

openclaw skills search "calendar"
openclaw skills search --limit 20 --json
openclaw skills install <slug>
openclaw skills install <slug> --version <version>
openclaw skills install <slug> --force
openclaw skills install <slug> --agent ops
openclaw skills update <slug>
openclaw skills update --all --agent ops
openclaw skills list
openclaw skills list --eligible --json --verbose
openclaw skills info <slug> --json --agent ops
openclaw skills check --agent ops --json

openclaw plugins list --enabled --verbose --json
openclaw plugins search calendar --limit 20 --json
openclaw plugins install clawhub:openclaw-codex-app-server
openclaw plugins install npm:@scope/plugin@1.0.0 --pin
openclaw plugins install git:github.com/owner/repo@v1.2.3
openclaw plugins install ./my-plugin -l
openclaw plugins install ./my-plugin.zip --force
openclaw plugins install <plugin>@<marketplace>
openclaw plugins install <plugin> --marketplace owner/repo
openclaw plugins install <plugin> --dangerously-force-unsafe-install
openclaw plugins inspect <id> --runtime --json
openclaw plugins inspect --all
openclaw plugins info <id>
openclaw plugins enable <id>
openclaw plugins disable <id>
openclaw plugins registry --refresh --json
openclaw plugins uninstall <id> --dry-run
openclaw plugins uninstall <id> --keep-files
openclaw plugins doctor
openclaw plugins update <id> --dry-run
openclaw plugins update --all
openclaw plugins update <id> --dangerously-force-unsafe-install
openclaw plugins marketplace list owner/repo --json

openclaw proxy start --host 127.0.0.1 --port 18080
openclaw proxy run --host 127.0.0.1 --port 18080 -- openclaw status
openclaw proxy validate --json --proxy-url http://127.0.0.1:8080 --allowed-url https://example.com --denied-url http://127.0.0.1:18789 --apns-reachable --timeout-ms 5000
openclaw proxy coverage
openclaw proxy sessions --limit 20
openclaw proxy query --preset double-sends --session <id>
openclaw proxy blob --id <blob-id>
openclaw proxy purge
```

| Command / flag | Purpose |
|---|---|
| `security audit` | Read-only config/filesystem audit. |
| `security audit --deep` | Include live Gateway probes and plugin-owned security collectors. |
| `security audit --password <password>` | Deep-probe auth override for this command only. |
| `security audit --token <token>` | Deep-probe auth override for this command only. |
| `security audit --fix` | Apply safe deterministic fixes: policy tightening, permissions, logging redaction. |
| `security audit --json` | CI/policy JSON output. |
| `secrets reload` | Gateway RPC to re-resolve SecretRefs and atomically swap runtime snapshot on full success. |
| `secrets reload --url`, `--token`, `--timeout`, `--json` | Gateway target/output flags. |
| `secrets audit` | Scan for plaintext storage, unresolved refs, precedence drift, generated-model residues, legacy residues. |
| `secrets audit --check` | Nonzero on findings; unresolved refs higher-priority nonzero. |
| `secrets audit --allow-exec` | Allow exec SecretRef checks. |
| `secrets configure` | Interactive provider/ref planner. |
| `secrets configure --plan-out <path>` | Save plan. |
| `secrets configure --apply` | Apply after preflight. |
| `secrets configure --yes` | Skip irreversible prompt where allowed. |
| `secrets configure --providers-only` | Provider setup only. |
| `secrets configure --skip-provider-setup` | Map to existing providers. |
| `secrets configure --agent <id>` | Agent auth-profile scope. |
| `secrets configure --allow-exec` | Allow exec preflight/apply checks. |
| `secrets configure --json` | Print plan + preflight; still requires interactive TTY. |
| `secrets apply --from <plan>` | Apply saved plan. |
| `secrets apply --dry-run` | Validate without writing; skips exec by default. |
| `skills search [query...]` | Search ClawHub skills. |
| `skills search --limit <n>` | Cap results. |
| `skills install <slug>` | Install skill folder into active workspace `skills/`. |
| `skills install --version <version>` | Install version. |
| `skills install --force` | Overwrite existing workspace skill folder. |
| `skills install --agent <id>` | Target agent workspace. |
| `skills update <slug>` / `skills update --all` | Update tracked ClawHub installs. |
| `skills list` | List visible local skills; default when no subcommand. |
| `skills list --eligible` | Eligible skills only. |
| `skills list --verbose` | Detail. |
| `skills list --json` | JSON. |
| `skills info <slug>` | Skill detail. |
| `skills check` | Check ready skills visible to selected agent prompt/command surface. |
| `plugins list` | Persisted local plugin registry view. |
| `plugins list --enabled` | Enabled only. |
| `plugins list --verbose` | Source/origin/version/activation metadata. |
| `plugins search <query>` | Remote ClawHub plugin lookup; `--limit`, `--json`. |
| `plugins install <spec>` | Install plugin/hook pack/bundle. Specs include `clawhub:`, `npm:`, `npm-pack:`, `git:`, local path/archive, marketplace shorthand. |
| `plugins install --force` | Overwrite existing install. |
| `plugins install --pin` | Record exact npm resolved spec; npm only. |
| `plugins install -l`, `--link` | Link local directory through extra load path. |
| `plugins install --marketplace <source>` | Marketplace source. |
| `plugins install --dangerously-force-unsafe-install` | Break-glass dangerous-code scanner override; does not bypass hook policy or scan failures. |
| `plugins inspect <id>` | Manifest/capability diagnostics without importing runtime. |
| `plugins inspect --runtime` | Load module and include registered hooks/tools/commands/services/gateway methods/routes. |
| `plugins inspect --all` | Fleet table. |
| `plugins info <id>` | Alias for inspect. |
| `plugins enable|disable <id>` | Toggle plugin. |
| `plugins registry --refresh` | Rebuild persisted cold registry. |
| `plugins uninstall <id>` | Remove plugin records and managed files unless kept. |
| `plugins uninstall --dry-run` | Preview. |
| `plugins uninstall --keep-files` | Keep files; `--keep-config` is deprecated alias. |
| `plugins doctor` | Plugin load/manifest/compatibility diagnostics. |
| `plugins update <id>|--all` | Update tracked installs. |
| `plugins update --dry-run` | Preview. |
| `plugins marketplace list <source>` | List marketplace entries. |
| `proxy start` | Start local explicit debug proxy; defaults host `127.0.0.1` unless set. |
| `proxy run -- <command>` | Run child command through debug capture proxy. |
| `proxy validate` | Validate operator-managed proxy URL. |
| `proxy validate --proxy-url <url>` | One-off proxy URL. |
| `proxy validate --allowed-url <url>` | Repeatable expected-success destination. |
| `proxy validate --denied-url <url>` | Repeatable expected-blocked destination. |
| `proxy validate --apns-reachable` | Check APNs CONNECT reachability. |
| `proxy validate --apns-authority <url>` | APNs authority; sandbox default documented. |
| `proxy validate --timeout-ms <ms>` | Per-request timeout. |
| `proxy validate --json` | JSON. |
| `proxy coverage` | Capture coverage summary. |
| `proxy sessions --limit <n>` | List capture sessions. |
| `proxy query --preset <preset>` | Presets: `double-sends`, `retry-storms`, `cache-busting`, `ws-duplicate-frames`, `missing-ack`, `error-bursts`. |
| `proxy query --session <id>` | Session filter. |
| `proxy blob --id <id>` | Read captured blob. |
| `proxy purge` | Delete local captures. |

### `path` optional plugin command

```bash
openclaw plugins enable oc-path
openclaw path resolve --cwd . --file ./README.md --json
openclaw path find --cwd . "*.md" --human
openclaw path set --cwd . --file ./README.md --dry-run
openclaw path validate --file ./README.md
openclaw path emit --json
```

| Command / flag | Purpose |
|---|---|
| `path resolve` | Resolve a path. |
| `path find` | Find paths. |
| `path set` | Set path value; supports `--dry-run`. |
| `path validate` | Validate path input. |
| `path emit` | Emit path metadata. |
| `--cwd <path>` | Base directory. |
| `--file <path>` | File slot/path. |
| `--json` | JSON output. |
| `--human` | Human output. |

### Legacy `clawbot`

```bash
openclaw clawbot qr
```

`openclaw clawbot qr` is a compatibility alias for `openclaw qr`.

## Setup & auth

Install with a JavaScript package manager in a modern Node runtime:

```bash
npm install -g openclaw@latest
# or
pnpm add -g openclaw@latest
```

Recommended first-run path:

```bash
openclaw onboard --install-daemon
openclaw doctor
```

Source or package-manager update path:

```bash
openclaw update status --json
openclaw update --dry-run
openclaw update --yes
```

State and config locations:

| Item | Path / source |
|---|---|
| Default state dir | `~/.openclaw` |
| Dev state | `~/.openclaw-dev` with `--dev` |
| Profile state | `~/.openclaw-<profile>` with `--profile <name>` |
| Config | `~/.openclaw/openclaw.json`, or `OPENCLAW_CONFIG_PATH` |
| Default workspace | Usually `~/.openclaw/workspace`, stored in `agents.defaults.workspace` |
| Agent workspaces | `agents.defaults.workspace`, `agents.list[].workspace`, or paths created with `agents add --workspace` |
| Crestodian audit | `~/.openclaw/audit/crestodian.jsonl` |
| Gateway logs/stability | `~/.openclaw/logs/`, including `logs/stability/openclaw-stability-*.json` |
| Plugin install index | `<state>/plugins/installs.json` |
| Hook packs | `~/.openclaw/hooks/` plus configured extra directories |
| Skill installs | Active workspace `skills/`; agent-selected workspace via `--agent` |
| Node state | `~/.openclaw/node.json` |
| Exec approvals | `~/.openclaw/exec-approvals.json` |
| Completion cache | `$OPENCLAW_STATE_DIR/completions` |

Credential names and sources:

| Credential / token | Source |
|---|---|
| Gateway token | `OPENCLAW_GATEWAY_TOKEN`, `gateway.auth.token`, `--token`, `--gateway-token-ref-env`, SecretRef provider. |
| Gateway password | `OPENCLAW_GATEWAY_PASSWORD`, `gateway.auth.password`, `--password-file`, SecretRef provider. |
| OpenAI | `OPENAI_API_KEY`, model auth profile, SecretRef. |
| Anthropic | `ANTHROPIC_API_KEY`, model auth profile, SecretRef. |
| Mistral | `MISTRAL_API_KEY`, model auth profile, SecretRef. |
| OpenRouter | `OPENROUTER_API_KEY`, model auth profile, SecretRef. |
| AI Gateway | `AI_GATEWAY_API_KEY`, model auth profile, SecretRef. |
| Kimi/Moonshot | `MOONSHOT_API_KEY`, `KIMI_CODE_API_KEY`, model auth profile, SecretRef. |
| Z.AI | `ZAI_API_KEY`, model auth profile, SecretRef. |
| Custom provider | `CUSTOM_API_KEY`, `--custom-api-key`, SecretRef. |
| LM Studio | `LM_API_TOKEN`, `--lmstudio-api-key`, SecretRef. |
| Channel tokens | Channel-specific env/config refs: Discord bot token, Slack bot/app tokens, Telegram bot token, Matrix access token/password, Nostr private key, Google Chat webhook/audience, Signal/iMessage transport fields. |
| SecretRef providers | `env`, `file`, `exec` providers configured under `secrets.providers.*`. |

Platform notes:

| Platform / mode | Notes |
|---|---|
| macOS | Gateway managed service uses LaunchAgent; `gateway stop --disable` persists suppression; inline passwords can appear in process listings, prefer file/env/SecretRef. |
| Linux | Gateway managed service uses systemd user units where available; status checks inspect `Environment=` and `EnvironmentFile=` for token drift. |
| Windows | Onboarding `--install-daemon` tries Scheduled Tasks first and falls back to a per-user Startup-folder login item if task creation is denied. |
| Nix mode | `OPENCLAW_NIX_MODE=1` makes config/plugin/update mutators read-only or disabled; edit Nix source instead. |
| Private-network plaintext WebSocket | Set `OPENCLAW_ALLOW_INSECURE_PRIVATE_WS=1` for trusted `ws://` onboarding/node targets; no config-file equivalent. |
| Managed proxy diagnostics | Set `OPENCLAW_DEBUG_PROXY_ALLOW_DIRECT_CONNECT_WITH_MANAGED_PROXY=1` only for approved local diagnostics. |
| Plugin lifecycle debugging | Set `OPENCLAW_PLUGIN_LIFECYCLE_TRACE=1` to write plugin lifecycle timings to stderr while preserving JSON stdout. |

## Common workflows

Install and onboard a managed local Gateway:

```bash
npm install -g openclaw@latest
openclaw onboard --install-daemon
openclaw doctor
```

Creates baseline config/workspace, configures model/Gateway/channel paths through onboarding, installs a managed Gateway service where supported, then runs guided health checks.

Inspect Gateway and channel health:

```bash
openclaw gateway status --deep --require-rpc --json
openclaw gateway probe --json
openclaw channels status --probe --json
openclaw status --all --json
```

Prints service state, reachable Gateway targets, RPC capability, channel runtime health, and broad status as machine-readable diagnostics.

Configure a channel and bind it to an agent:

```bash
openclaw channels add --channel telegram --token "$TELEGRAM_BOT_TOKEN"
openclaw agents add ops --workspace ~/.openclaw/workspace-ops --bind telegram:ops --non-interactive
openclaw agents bindings --json
```

Adds the Telegram account, creates an isolated `ops` agent workspace, and verifies routing bindings.

Install and verify a plugin or hook pack:

```bash
openclaw plugins search "calendar" --limit 20
openclaw plugins install clawhub:<plugin-slug> --pin
openclaw plugins inspect <plugin-id> --runtime --json
openclaw gateway restart --safe
```

Installs a tracked plugin/hook pack, verifies registered runtime surfaces, and safely reloads the running Gateway after active work drains.

Run a scripted model smoke test:

```bash
openclaw infer model run --prompt "Reply with exactly: smoke-ok" --json
openclaw infer image providers --json
openclaw models status --probe --json
```

Confirms text inference, image provider inventory, and provider auth/probe status without entering the TUI.

## Error handling

| Symptom | Likely cause | Fix |
|---|---|---|
| `config schema validation failed` | Post-change config shape is invalid. | Fix the path/value/provider/ref shape, run `openclaw config validate`, then retry the write. |
| `Config policy validation failed: unsupported SecretRef usage` | SecretRef assigned to an unsupported runtime-mutable surface. | Move that credential back to plaintext/string input or to a supported SecretRef surface. |
| `SecretRef assignment(s) could not be resolved` | Referenced env/file/exec provider cannot resolve: missing env var, invalid file, exec failure, or source/provider mismatch. | Repair the provider/ref source, then rerun `openclaw config set ... --dry-run`; add `--allow-exec` only for intended exec checks. |
| `Dry run note: skipped  exec SecretRef resolvability check(s)` | Dry-run skipped exec SecretRef checks to avoid side effects. | Rerun with `--dry-run --allow-exec` when exec provider validation is intended. |
| `Error: Environment variable "MISSING_TEST_SECRET" is not set.` | Env SecretRef points at an unset variable. | Export the env var in the current process/service environment or change the SecretRef id. |
| `AUTH_TOKEN_MISMATCH` | Device/shared token drift between CLI/service/config. | Run `openclaw devices list --json`, inspect `openclaw gateway status --deep --json`, then rotate/remove/approve the stale device or reinstall Gateway service with the correct token source. |
| `AUTH_DEVICE_TOKEN_MISMATCH` | Cached device auth token no longer matches Gateway device record. | Re-approve or rotate the device via `openclaw devices approve|rotate|revoke` and verify with `openclaw gateway probe --json`. |
| `Read probe: limited - missing scope: operator.read` | Gateway accepted WebSocket connection but token/device lacks read scope. | Use a token/device role with `operator.read`, then rerun `openclaw gateway probe --json` or `gateway status --require-rpc`. |
| `ssh_tunnel_failed` | `gateway probe --ssh` could not establish the SSH tunnel and fell back to direct probes. | Verify SSH target, port, identity file, and remote Gateway bind/port; retry with explicit `--ssh user@host:port --ssh-identity <path>`. |
| `multiple_gateways` | More than one Gateway target is reachable. | Confirm this is intentional; otherwise stop extra services or isolate them with profiles/ports. |
| `auth_secretref_unresolved` | A configured Gateway auth SecretRef could not be resolved for a failed target. | Pass `--token`/`--password` explicitly for the diagnostic command or repair the SecretRef provider/source. |
| `probe_scope_limited` | WebSocket connect succeeded but read probe was limited by missing operator scope. | Use an operator-scoped credential or adjust device role/scope. |
| `openclaw browser` is an unknown command | Bundled browser plugin was filtered or not enabled/visible. | Check `openclaw plugins list --json`, plugin allow/deny config, and run `openclaw plugins enable browser` or `openclaw doctor --fix` where appropriate. |
| `OC_PATH_FILE_WILDCARD_UNSUPPORTED` | `path` plugin received a wildcard in a file slot that requires a concrete file. | Expand globs outside OpenClaw and pass one concrete path through `--file`. |
| `Claude: HTTP 403 ... user:profile` | `channels list` attempted provider usage/profile snapshot without required Claude scope/session. | Use `--no-usage` where supported, provide a valid Claude session key, or re-authenticate the Claude CLI/session. |
| `No plugin issues detected.` | `plugins doctor` found no load/manifest/compatibility issues. | No repair needed; use `plugins inspect <id> --runtime --json` for runtime registration verification. |
| `present but blocked` | Plugin is on disk but blocked by loader path-safety checks. | Fix path ownership/world-writable permissions or unsafe path condition, then rerun `openclaw plugins doctor`. |
| `missing register/activate exports` | Plugin module shape is invalid for OpenClaw runtime loading. | Rerun with `OPENCLAW_PLUGIN_LOAD_DEBUG=1`, inspect export-shape diagnostics, and fix the plugin entry point. |
| `not reachable after start` | Browser/CDP process did not become reachable after starting. | Run `openclaw browser doctor`, verify browser profile/executable/CDP settings, then restart or recreate the profile. |
| `PLAINTEXT_FOUND` | `secrets audit` found plaintext credential residue. | Run `openclaw secrets configure`, apply a plan, then rerun `openclaw secrets audit --check`. |
| `REF_UNRESOLVED` | `secrets audit` found an unresolved SecretRef. | Repair env/file/exec provider source; use `--allow-exec` only when exec providers should be executed. |
| `REF_SHADOWED` | Auth/profile credential shadows a configured SecretRef. | Apply a secrets plan that scrubs or aligns the shadowing store. |
| `LEGACY_RESIDUE` | Legacy secret/auth residue remains in state. | Apply a saved secrets plan with scrub options, then reload secrets. |
| `InvalidProviderToken` | APNs probe used an intentionally invalid provider token while checking tunnel reachability. | Treat this as successful APNs reachability when returned during `proxy validate --apns-reachable`. |
| `gateway.auth.mode` unset while both `gateway.auth.token` and `gateway.auth.password` are configured | Managed Gateway install cannot infer token-vs-password auth safely. | Set `gateway.auth.mode` explicitly with `openclaw config set gateway.auth.mode token|password`, validate, then rerun install/onboarding. |
| `OPENCLAW_NIX_MODE=1` mutating command refused | Nix mode treats config/plugin/update mutators as source-managed. | Edit the Nix source/flake or `programs.openclaw.config` / instance config; rerun read-only check commands only. |

## Traps

_Append-only. Date-stamped. Filled by the operator via the `/lesson` slash command when something bites._

## Lessons

_Append-only. Date-stamped. Filled by the operator via the `/lesson` slash command for behaviors learned that aren't in upstream docs._
