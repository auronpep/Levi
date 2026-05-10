---
name: tool-npx
description: Load when working with npx, npm exec, package binaries, ephemeral package execution, npm cache, workspaces, or registry auth. Covers full npx/npm exec CLI surface, setup, workflows, and errors.
triggers:
  bash:
    - npx
    - npm exec
    - npm x
---

# npx

## What it is

`npx` is the npm CLI package-runner binary; in npm v7+ it is a compatibility frontend for `npm exec`. It runs executable files published in npm packages from local dependencies or from packages resolved through the registry/cache without adding them to the current project. Reach for it for one-off CLIs, project-local package binaries, generators, and workspace-scoped command execution; common alternatives are `pnpm dlx`, `yarn dlx`, `bunx`, and direct `./node_modules/.bin/<cmd>` invocation.

## Capability surface

### Command names

| Command | Meaning |
|---|---|
| `npx` | Compatibility binary for `npm exec`; npm-owned flags must appear before positional command arguments. |
| `npm exec` | Canonical npm command. Use `--` to stop npm option parsing before command arguments. |
| `npm x` | Alias for `npm exec`. |

### Canonical help shape

```text
Run a command from a local or remote npm package

Usage:
npm exec -- <pkg>[@<version>] [args...]
npm exec --package=<pkg>[@<version>] -- <cmd> [args...]
npm exec -c '<cmd> [args...]'
npm exec --package=foo -c '<cmd> [args...]'

Options:
[--package <package-spec> [--package <package-spec> ...]] [-c|--call <call>]
[-w|--workspace <workspace-name> [-w|--workspace <workspace-name> ...]]
[-ws|--workspaces] [--include-workspace-root]

alias: x
```

### Invocation forms

| Form | Behavior |
|---|---|
| `npx -- <pkg>[@<version>] [args...]` | Infer the executable from `<pkg>` and pass `[args...]` to it. |
| `npx <pkg>[@<version>] [args...]` | Same as above; every argument after `<pkg>` belongs to the executed command, not `npx`. |
| `npx --package=<pkg>[@<version>] -- <cmd> [args...]` | Install/provide `<pkg>` in `PATH`, then run `<cmd>`. |
| `npx --package=<pkg> <cmd> [args...]` | Same as above; valid because `--package` precedes positional command args. |
| `npx -c '<cmd> [args...]'` | Run a shell command in the npm execution environment. |
| `npx --package=foo -c '<cmd> [args...]'` | Provide `foo` in `PATH`, then run a shell command. |
| `npm exec -- <pkg>[@<version>] [args...]` | Canonical form; `--` prevents npm from parsing flags meant for the child command. |
| `npm exec --package=<pkg>[@<version>] -- <cmd> [args...]` | Canonical explicit-package form. |
| `npm exec -c '<cmd> [args...]'` | Canonical shell-command form. |
| `npm exec` | Opens an interactive subshell in the npm script-like environment when no positional args or `--call` are present. Not supported in CI with TTY stdin. |

### Parse rules

| Rule | Result |
|---|---|
| `npx` sees `npx foo@latest bar --package=@npmcli/foo` | Resolves `foo@latest`; passes `bar --package=@npmcli/foo` to the `foo` command. |
| `npm exec` sees `npm exec foo@latest bar --package=@npmcli/foo` | Parses `--package=@npmcli/foo` as an npm option; runs `foo@latest bar` with `@npmcli/foo` in `PATH`. |
| `npm exec -- foo@latest bar --package=@npmcli/foo` | Stops npm option parsing; equivalent to the `npx` example. |
| `npx` option position | npm-owned options must appear before the first positional package/command argument. |
| Child command options | Place after `--` for `npm exec`; place after package/command name for `npx`. |
| Package install prompt | Missing packages trigger a prompt unless `--yes` or `--no` is set. Non-TTY stdin or CI assumes `--yes` for `npm exec`. |
| Local dependency matching | A package spec without version/tag/range can match an installed local dependency. A spec with version/tag/range only matches a local dependency with the exact same name and version. |

### Executable inference

When no `--package` option is supplied and no `-c/--call` string is supplied, npm infers the executable from the first package spec.

| Package `package.json` state | Selected executable |
|---|---|
| One `bin` entry | That executable. |
| Multiple `bin` entries that are aliases of the same target | That executable. |
| Multiple `bin` entries and one key matches the unscoped package name | The matching executable. |
| No `bin` entries | Error: `could not determine executable to run`. |
| Multiple `bin` entries and no unscoped-name match | Error: `could not determine executable to run`. |
| Need a binary other than inferred binary | Use `--package=<pkg>` and put the binary command after `--` or in `-c/--call`. |

### Package spec values

`<package-spec>` accepts the npm package-spec grammar.

| Spec | Meaning | Examples |
|---|---|---|
| `[<@scope>/]<pkg>` | Package name, default tag from `tag` config. | `npm`, `@npmcli/arborist` |
| `[<@scope>/]<pkg>@<tag>` | Package name pinned to dist-tag. | `@npmcli/arborist@latest` |
| `[<@scope>/]<pkg>@<version>` | Exact version. | `npm@10.8.3` |
| `[<@scope>/]<pkg>@<version range>` | SemVer range. | `npm@^10.0.0` |
| `<alias>@npm:<name>` | Registry package alias. | `semver@npm:@npmcli/semver-with-patch` |
| `<alias>@npm:<name>@<version-or-tag>` | Alias with version/tag. | `semver@npm:semver@7.2.2`, `semver@npm:semver@legacy` |
| `<folder>` | Local folder containing `package.json`; prefix with `./` or `/`. | `./my-package`, `/opt/npm/my-package` |
| `<tarball file>` | Local `.tgz` package. | `./my-package.tgz` |
| `<tarball url>` | Remote tarball package. | `https://registry.npmjs.org/semver/-/semver-1.0.0.tgz` |
| `<git url>` | Git package. | `https://github.com/npm/cli.git`, `git+ssh://git@github.com/npm/cli#v6.0.0` |
| GitHub shorthand | GitHub package shorthand, optionally with `#ref`. | `github:npm/cli#HEAD`, `npm/cli#c12ea07` |

### `npx` / `npm exec` primary options

| Option | Alias | Type / values | Meaning |
|---|---|---|---|
| `--package=<package-spec>` | `-p <package-spec>` for `npx` only | String; repeatable | Install/provide package(s) in the child `PATH`. In `npm exec`, `-p` is `--parseable`, not `--package`. |
| `--call=<cmd>` | `-c <cmd>` | String | Shell command to execute with selected packages in `PATH`. |
| `--workspace=<workspace>` | `-w <workspace>` | String; repeatable; workspace name, workspace path, or parent workspace path | Run in selected workspace context(s). |
| `--workspaces` | `--ws` | Boolean/null | Run in all configured workspaces. |
| `--include-workspace-root` | `--iwr` | Boolean; default `false` | Include root project when workspace execution is enabled. |
| `--yes` | `-y` | Boolean/null | Accept installation prompts. |
| `--no`, `--no-yes` | `-n` | Boolean/null | Decline installation prompts. Useful to restrict execution to already-present local/cache packages. |
| `--script-shell=<shell>` | `--shell=<shell>` for `npx` compatibility | null or String | Shell used by `npm exec`, `npm run`, and `npm init <package-spec>`. POSIX default `/bin/sh`; Windows default `cmd.exe`. |
| `--offline` |  | Boolean | Force cache-only mode; missing cache entries fail. |
| `--prefer-offline` |  | Boolean | Skip staleness checks for cached data; still fetch missing data. |
| `--prefer-online` |  | Boolean | Force immediate staleness checks, even for fresh cache entries. |
| `--cache=<path>` |  | Path | npm cache directory used for fetched packages and logs. |
| `--registry=<url>` | `--reg=<url>` | URL | Registry for package name resolution. |
| `--scope=<scope>` |  | String | Scope for registry/auth mapping. |
| `--loglevel=<level>` | `-s`, `--silent`, `-q`, `--quiet`, `-d`, `--dd`, `--ddd`, `--verbose` | `silent`, `error`, `warn`, `notice`, `http`, `info`, `verbose`, `silly` | Terminal log verbosity. |
| `--usage` | `--help`, `-h`, `-H`, `-?` | Boolean | Show short command usage. |
| `--version` | `-v` | Boolean | Print npm version and exit. |
| `--versions` |  | Boolean | Print npm and Node component versions and exit. |

### Removed, deprecated, or compatibility-only older `npx` options

| Option | Status | Replacement / current behavior |
|---|---|---|
| `--no-install` | Deprecated | Converted to `--no`. |
| `--ignore-existing` | Removed | Local package bins are always present in the executed process `PATH`. |
| `--npm` | Removed | `npx` always uses the npm it ships with. |
| `--node-arg` | Removed | Use `NODE_OPTIONS="..." npx <cmd>` or npm config `--node-options`. |
| `-n` as `--node-arg` | Removed | In current npm shorthand, `-n` is `--no-yes`. |
| `--always-spawn` | Removed | Redundant. |
| `--shell` | Compatibility-only on `npx` | Replaced by `--script-shell`; retained for `npx`. |
| Shell fallback | Removed | No fallback execution outside npm/package bins. |

### npm-wide config input syntax

Every npm config value is accepted as a command-line flag in modern `npx`/`npm exec` unless a specific command ignores it.

| Channel | Syntax |
|---|---|
| CLI Boolean true | `--flag` |
| CLI string/number/path | `--key=value` or `--key value` |
| CLI Boolean false | `--no-key` |
| Stop npm parsing | `--` |
| Environment | `npm_config_key=value`; use underscores for dashes, for example `npm_config_legacy_peer_deps=true` |
| Project config | `<project>/.npmrc` |
| User config | `~/.npmrc` or `--userconfig=<path>` |
| Global config | `$PREFIX/etc/npmrc` or `--globalconfig=<path>` |
| Built-in config | `path/to/npm/itself/npmrc` |

### npm CLI shorthands accepted by `npx` / `npm exec`

| Shorthand | Expands to |
|---|---|
| `-a` | `--all` |
| `--enjoy-by` | `--before` |
| `-c` | `--call` |
| `--desc` | `--description` |
| `-f` | `--force` |
| `-g` | `--global` |
| `--iwr` | `--include-workspace-root` |
| `-L` | `--location` |
| `-d` | `--loglevel info` |
| `-s` | `--loglevel silent` |
| `--silent` | `--loglevel silent` |
| `--ddd` | `--loglevel silly` |
| `--dd` | `--loglevel verbose` |
| `--verbose` | `--loglevel verbose` |
| `-q` | `--loglevel warn` |
| `--quiet` | `--loglevel warn` |
| `-l` | `--long` |
| `-m` | `--message` |
| `--local` | `--no-global` |
| `-n` | `--no-yes` |
| `--no` | `--no-yes` |
| `-p` | `--parseable` for npm generally; `--package` only for `npx` executable |
| `--porcelain` | `--parseable` |
| `-C` | `--prefix` |
| `--readonly` | `--read-only` |
| `--reg` | `--registry` |
| `-S` | `--save` |
| `-B` | `--save-bundle` |
| `-D` | `--save-dev` |
| `-E` | `--save-exact` |
| `-O` | `--save-optional` |
| `-P` | `--save-prod` |
| `-?` | `--usage` |
| `-h` | `--usage` |
| `-H` | `--usage` |
| `--help` | `--usage` |
| `-v` | `--version` |
| `-w` | `--workspace` |
| `--ws` | `--workspaces` |
| `-y` | `--yes` |

### npm-wide current config settings accepted as flags

| Config / flag | Type / values | Scope for `npx` / `npm exec` |
|---|---|---|
| `_auth` | null or String | Registry basic-auth value; prefer registry-scoped token in `.npmrc`, not CLI. |
| `access` | null, `restricted`, `public` | Publish/access setting; mostly irrelevant to exec. |
| `all` | Boolean | Affects commands such as `outdated`/`ls`; accepted by parser. |
| `allow-directory` | `all`, `none`, `root` | Controls install/fetch of directory package specs. |
| `allow-file` | `all`, `none`, `root` | Controls install/fetch of local tarball specs. |
| `allow-git` | `all`, `none`, `root` | Controls install/fetch of git package specs. |
| `allow-remote` | `all`, `none`, `root` | Controls install/fetch of remote URL tarball specs. |
| `allow-same-version` | Boolean | `npm version` behavior; accepted by parser. |
| `audit` | Boolean | Audit report submission during installs. |
| `audit-level` | null, `info`, `low`, `moderate`, `high`, `critical`, `none` | Minimum audit level for nonzero exit. |
| `auth-type` | `legacy`, `web` | Login strategy. |
| `before` | null or Date | Resolve only package versions published on/before date; incompatible with `min-release-age`. |
| `bin-links` | Boolean | Create executable symlinks or Windows `.cmd` shims for package bins. |
| `browser` | null, Boolean, String | Browser opener used by browser-opening npm commands. |
| `bypass-2fa` | Boolean | Granular token creation behavior. |
| `ca` | null or String; repeatable | Inline CA certificate(s) for registry TLS. Prefer `cafile`. |
| `cache` | Path | npm cache directory; defaults to `~/.npm` on POSIX and `%LocalAppData%\npm-cache` on Windows. |
| `cafile` | Path | CA bundle file for registry TLS. |
| `call` | String | Command string for `npm exec` / `npx`. |
| `cidr` | null or String; repeatable | CIDR restrictions for token creation. |
| `color` | `always` or Boolean | Terminal color output. |
| `commit-hooks` | Boolean | `npm version` git hook behavior. |
| `cpu` | null or String | Override CPU architecture for native modules. |
| `depth` | null or Number | `npm ls` recursion depth. |
| `description` | Boolean | `npm search` descriptions. |
| `diff` | String; repeatable | `npm diff` arguments. |
| `diff-dst-prefix` | String | Destination prefix for `npm diff`. |
| `diff-ignore-all-space` | Boolean | Whitespace handling for `npm diff`. |
| `diff-name-only` | Boolean | Filename-only output for `npm diff`. |
| `diff-no-prefix` | Boolean | Suppress source/destination prefixes in `npm diff`. |
| `diff-src-prefix` | String | Source prefix for `npm diff`. |
| `diff-text` | Boolean | Treat files as text in `npm diff`. |
| `diff-unified` | Number | Context-line count for `npm diff`. |
| `dry-run` | Boolean | Report intended changes for supported modifying commands; not a general network dry-run. |
| `editor` | String | Editor for `npm edit` and `npm config edit`. |
| `engine-strict` | Boolean | Refuse packages whose `engines` conflict with current Node/npm. |
| `expect-result-count` | null or Number | Expected result count; incompatible with `expect-results`. |
| `expect-results` | null or Boolean | Expected command result presence; incompatible with `expect-result-count`. |
| `expires` | null or Number | Token expiration days for token creation. |
| `fetch-retries` | Number | Registry fetch retry count. |
| `fetch-retry-factor` | Number | Retry backoff factor. |
| `fetch-retry-maxtimeout` | Number | Maximum retry timeout in milliseconds. |
| `fetch-retry-mintimeout` | Number | Minimum retry timeout in milliseconds. |
| `fetch-timeout` | Number | Registry request timeout in milliseconds. |
| `force` | Boolean | Disable multiple npm safety protections; avoid unless the intended protection is known. |
| `foreground-scripts` | Boolean | Run lifecycle scripts in foreground for debugging. |
| `format-package-lock` | Boolean | Human-readable lockfile formatting. |
| `fund` | Boolean | Funding messages after installs. |
| `git` | String | Git executable path/name. |
| `git-tag-version` | Boolean | Tag commit during `npm version`. |
| `global` | Boolean | Global mode; packages under prefix instead of project. |
| `globalconfig` | Path | Global npmrc file path. |
| `heading` | String | Prefix for debug log output. |
| `https-proxy` | null or URL | HTTPS proxy for registry fetches. |
| `if-present` | Boolean | Suppress missing-script error for `npm run`; not exported to child processes. |
| `ignore-scripts` | Boolean | Skip lifecycle scripts for package installs; explicit run commands still run their target script. |
| `include` | `prod`, `dev`, `optional`, `peer`; repeatable | Dependency types to include; inverse of `omit`. |
| `include-attestations` | Boolean | Include sigstore attestation bundles in audit signature JSON. |
| `include-staged` | Boolean | Allow experimental staged packages. |
| `include-workspace-root` | Boolean | Include root project when workspace execution is enabled. |
| `init-author-email` | String | Default `npm init` author email. |
| `init-author-name` | String | Default `npm init` author name. |
| `init-author-url` | String or URL | Default `npm init` author URL. |
| `init-license` | String | Default `npm init` license. |
| `init-module` | Path | Module loaded by `npm init`. |
| `init-private` | Boolean | Default `npm init` private flag. |
| `init-type` | String | Default `package.json` type. |
| `init-version` | SemVer String | Default `package.json` version. |
| `install-links` | Boolean | Pack `file:` deps as normal dependencies rather than symlinks; no effect on workspaces. |
| `install-strategy` | `hoisted`, `nested`, `shallow`, `linked` | Dependency tree layout strategy. |
| `json` | Boolean | JSON output where supported; not supported by all commands. |
| `legacy-peer-deps` | Boolean | Ignore peer dependency contract during tree resolution. |
| `libc` | null or String | Override libc for native modules. |
| `link` | Boolean | `npm ls` linked-package filter. |
| `local-address` | IP Address | Local interface for registry connections. |
| `location` | `global`, `user`, `project` | Config location; also related to global mode. |
| `lockfile-version` | null, `1`, `2`, `3` | Lockfile format version. |
| `loglevel` | `silent`, `error`, `warn`, `notice`, `http`, `info`, `verbose`, `silly` | Terminal log verbosity. |
| `logs-dir` | null or Path | Log directory; default `_logs` under cache. |
| `logs-max` | Number | Maximum stored log files; `0` disables log files for current run. |
| `long` | Boolean | Extended output for `ls`, `search`, `help-search`. |
| `maxsockets` | Number | Max registry connections per origin. |
| `message` | String | `npm version` commit message template. |
| `min-release-age` | null or Number | Resolve only versions older than N days; incompatible with `before`. |
| `name` | null or String | Token name/description for token creation. |
| `node-gyp` | Path | `node-gyp` executable path. |
| `node-options` | null or String | Options passed through as `NODE_OPTIONS` for lifecycle/child Node processes. |
| `noproxy` | String; repeatable | Proxy-bypass domain list; accepts comma-delimited values. |
| `offline` | Boolean | No network requests; missing cache data fails. |
| `omit` | `dev`, `optional`, `peer`; repeatable | Dependency types omitted from disk install. |
| `omit-lockfile-registry-resolved` | Boolean | Omit `resolved` registry keys in lockfiles. |
| `orgs` | null or String; repeatable | Token organization restrictions. |
| `orgs-permission` | null, `read-only`, `read-write`, `no-access` | Organization permission for token creation. |
| `os` | null or String | Override OS for native modules. |
| `otp` | null or String | One-time password for 2FA-protected registry actions. |
| `pack-destination` | String | Directory for `npm pack` tarballs. |
| `package` | String; repeatable | Package(s) to install/provide for `npm exec` / `npx`. |
| `package-lock` | Boolean | Honor/write `package-lock.json`. |
| `package-lock-only` | Boolean | Use/update only package-lock for supported commands. |
| `packages` | null or String; repeatable | Token package restrictions. |
| `packages-all` | Boolean | Grant token access to all packages. |
| `packages-and-scopes-permission` | null, `read-only`, `read-write`, `no-access` | Package/scope token permission. |
| `parseable` | Boolean | Parseable command output where supported. |
| `password` | null or String | Password for token/auth flows; prefer prompt or env, not CLI. |
| `prefer-dedupe` | Boolean | Prefer deduplication over newest satisfying dependency. |
| `prefer-offline` | Boolean | Use cached data without staleness checks; fetch missing data. |
| `prefer-online` | Boolean | Force staleness checks and fresh registry metadata. |
| `prefix` | Path | Global prefix or command working prefix. |
| `preid` | String | Prerelease identifier for versioning. |
| `progress` | Boolean | Progress bar display. |
| `provenance` | Boolean | Publish provenance from supported CI/CD. |
| `provenance-file` | Path | Provenance bundle path; incompatible with `provenance`. |
| `proxy` | null, false, URL | HTTP proxy for registry fetches. |
| `read-only` | Boolean | Mark created token read-only. |
| `rebuild-bundle` | Boolean | Rebuild bundled dependencies after install. |
| `registry` | URL | Base registry URL. |
| `replace-registry-host` | `npmjs`, `never`, `always`, or String | Lockfile registry-host replacement behavior. |
| `save` | Boolean | Save dependencies and lockfile changes where supported. |
| `save-bundle` | Boolean | Add saved dependency to `bundleDependencies`. |
| `save-dev` | Boolean | Save to `devDependencies`. |
| `save-exact` | Boolean | Save exact dependency versions. |
| `save-optional` | Boolean | Save to `optionalDependencies`. |
| `save-peer` | Boolean | Save to `peerDependencies`. |
| `save-prefix` | String | Prefix for saved dependency versions, usually `^` or `~`. |
| `save-prod` | Boolean | Save to `dependencies`. |
| `sbom-format` | null, `cyclonedx`, `spdx` | SBOM output format. |
| `sbom-type` | `library`, `application`, `framework` | SBOM primary package type. |
| `scope` | String | Operation scope and scoped registry mapping. |
| `scopes` | null or String; repeatable | Token scope restrictions. |
| `script-shell` | null or String | Shell for `npm exec`, `npm run`, and `npm init <package-spec>`. |
| `searchexclude` | String | Search exclusion options. |
| `searchlimit` | Number | Search result limit. |
| `searchopts` | String | Search options always passed to search. |
| `searchstaleness` | Number | Legacy search cache age before registry request. |
| `shell` | String | Shell for `npm explore`; compatibility alias for `npx --shell` maps to script shell. |
| `sign-git-commit` | Boolean | Sign `npm version` commit. |
| `sign-git-tag` | Boolean | Sign `npm version` tag. |
| `strict-peer-deps` | Boolean | Treat peer dependency conflicts as install failure. |
| `strict-ssl` | Boolean | Validate TLS certs for registry HTTPS. |
| `tag` | String | Default dist-tag for unversioned package specs; default `latest`. |
| `tag-version-prefix` | String | Prefix for `npm version` tags. |
| `timing` | Boolean | Write timing JSON to cache/logs dir and report timing. |
| `token-description` | null or String | Token description for token creation. |
| `umask` | Octal `0000..0777` | File/folder mode mask. |
| `unicode` | Boolean | Unicode tree glyphs. |
| `update-notifier` | Boolean | Suppress/enable npm update notices. |
| `usage` | Boolean | Short usage output. |
| `user-agent` | String | Registry request User-Agent template. |
| `userconfig` | Path | User npmrc path. |
| `version` | Boolean | Print npm version. |
| `versions` | Boolean | Print npm/Node versions map. |
| `viewer` | String | Help viewer program. |
| `which` | null or Number | Select one funding source by 1-indexed position. |
| `workspace` | String; repeatable | Workspace filter by name/path/parent path. |
| `workspaces` | null or Boolean | Run in all configured workspaces. |
| `workspaces-update` | Boolean | Run update after operations that alter workspace installs. |
| `yes` | null or Boolean | Auto-answer yes to prompts. |

### npm-wide deprecated config settings accepted as flags

| Deprecated config / flag | Replacement / behavior |
|---|---|
| `also` | Use `--include=dev`. |
| `cache-max` | Use `--prefer-online`; `--cache-max=0` aliases `--prefer-online`. |
| `cache-min` | Use `--prefer-offline`; large values alias `--prefer-offline`. |
| `cert` | Use registry-scoped `certfile`. |
| `dev` | Use `--include=dev`. |
| `global-style` | Use `--install-strategy=shallow`. |
| `init.author.email` | Use `--init-author-email`. |
| `init.author.name` | Use `--init-author-name`. |
| `init.author.url` | Use `--init-author-url`. |
| `init.license` | Use `--init-license`. |
| `init.module` | Use `--init-module`. |
| `init.version` | Use `--init-version`. |
| `key` | Use registry-scoped `keyfile`. |
| `legacy-bundling` | Use `--install-strategy=nested`. |
| `only` | Use `--omit=dev`. |
| `optional` | Use `--omit=optional` or `--include=optional`. |
| `production` | Use `--omit=dev`. |
| `shrinkwrap` | Use `--package-lock`. |

### Execution environment

| Surface | Behavior |
|---|---|
| `PATH` | Child process receives local package executables plus executables from `--package` packages. |
| Missing packages | Resolved packages install into npm cache, not the current project dependency list. |
| Cache | Cached package folder is added to child `PATH`; cache policy is controlled by `cache`, `offline`, `prefer-offline`, and `prefer-online`. |
| Local bins | Project dependency bins are available like npm scripts; local executables are linked under `./node_modules/.bin`. |
| Global bins | Not the primary resolution target. Use global binaries directly or run package specs through `npx`. |
| Shell command mode | `-c/--call` uses `script-shell`. |
| Workspaces | `--workspace` and `--workspaces` run command in workspace context(s); `--include-workspace-root` includes root. |
| Exit code | Child command exit code is propagated unless npm resolution/configuration fails first. |

## Setup & auth

Install Node.js and npm; `npx` ships with npm. Prefer a Node version manager for development machines. Check installation with:

```bash
node -v
npm -v
npx --version
npm exec --help
```

Update npm when needed:

```bash
npm install -g npm
```

Public packages need no credentials. Private packages or private registries require npm registry authentication configured by registry host/scope. Use credentials by name/source only: npm account login, organization/private-registry token, or CI-provided `NPM_TOKEN`. Store auth in scoped `.npmrc` entries or environment-expanded `.npmrc`; do not pass `_auth`, `_authToken`, passwords, cert private keys, or OTPs on shared command lines.

Config/state locations:

| State | Location |
|---|---|
| Project config | `<project>/.npmrc` |
| User config | `~/.npmrc` |
| Global config | `$PREFIX/etc/npmrc` |
| Built-in config | `path/to/npm/itself/npmrc` |
| POSIX cache | `~/.npm` |
| Windows cache | `%LocalAppData%\npm-cache` |
| Logs | `_logs` under cache unless `logs-dir` changes it |
| Local executables | `./node_modules/.bin` |
| POSIX global executables | `{prefix}/bin` |
| Windows global executables | `{prefix}`; package bins get `.cmd` shims |

Scoped registry/auth pattern:

```ini
@myorg:registry=https://registry.example.invalid/
//registry.example.invalid/:_authToken=${NPM_TOKEN?}
```

Platform notes:

| Platform | Note |
|---|---|
| macOS/Linux | Node version managers reduce global-prefix permission errors. Local package bins are symlinks. |
| Windows | npm creates `.cmd` shims for package bins. User/global prefix often lives under `%AppData%\npm`; cache under `%LocalAppData%\npm-cache`. |
| CI | Non-interactive npm exec assumes `--yes` for missing packages; set `--no` to block implicit downloads. |
| Corporate proxy/TLS | Configure `proxy`, `https-proxy`, `cafile`, and `strict-ssl`; prefer CA configuration over disabling TLS validation. |

## Common workflows

Run a local or remote package binary and pass arguments:

```bash
npx tap --bail test/foo.js
```

Runs `tap` from local dependencies when available, otherwise resolves it through npm and runs it with the provided args.

Run a binary whose command name differs from the package name:

```bash
npx --package=foo bar --bar-argument
```

Provides package `foo` in `PATH`, then runs command `bar`.

Run a shell command in the project npm execution environment:

```bash
npx -c 'eslint && say "hooray, lint passed"'
```

Runs through `script-shell`; project-local bins are available in `PATH`.

Provide multiple generator packages for one command:

```bash
npm exec --package yo --package generator-node --call "yo node"
```

Installs/provides both packages in the temporary execution environment and runs `yo node`.

Run a command in selected workspaces:

```bash
npm exec -w a -w b -- eslint ./*.js
```

Runs `eslint` in workspaces `a` and `b`.

## Error handling

| Symptom | Likely cause | Fix |
|---|---|---|
| `npm ERR! could not determine executable to run` | Package has no unique executable under `bin`, or the selected package no longer publishes the expected bin. | Inspect the package `bin` field; use `npx --package=<pkg> <bin>` or install/use the package that actually publishes the binary. |
| `Need to install the following packages:` followed by `Ok to proceed? (y)` | Package is not installed locally and npm needs registry/cache install before execution. | Add `--yes` for intentional download; add `--no` to fail instead of installing. |
| `npm error code ENOTCACHED` | `--offline` cache-only mode needs metadata/tarball not present in npm cache. | Remove `--offline`, prefill cache, or use `--prefer-offline` when missing data may be fetched. |
| `npm ERR! Error: ENOSPC, write` | Target drive or cache location lacks space or write permission. | Free disk space or move npm cache with `--cache=<path>` / `npm config set cache <path>`. |
| `npm ERR! not found: git` | Package spec or dependency requires Git, but `git` is unavailable in `PATH`. | Install Git or set npm config `git` to the Git executable path. |
| `ENOGIT` | Git dependency resolution failed because Git is missing or inaccessible. | Install Git, repair `PATH`, or avoid git package specs. |
| `npm ERR! Error: SSL Error: CERT_UNTRUSTED` | Registry TLS certificate chain is not trusted by Node/npm. | Configure `cafile` or `ca`; check corporate proxy/intercepting TLS. |
| `npm ERR! Error: SSL Error: UNABLE_TO_VERIFY_LEAF_SIGNATURE` | Registry TLS chain lacks trusted issuer/intermediate. | Configure a CA bundle with `cafile`; verify proxy and registry URL. |
| `npm ERR! Error: SSL Error: SELF_SIGNED_CERT_IN_CHAIN` | Self-signed certificate in registry/proxy chain. | Configure trusted CA/cafile for the intercepting proxy or registry. |
| `npm ERR! Error: 404 Not Found` | Package/version/tarball not found, wrong registry/scope, auth missing for private package, or registry outage. | Verify package spec, `registry`, `scope`, auth, and registry status. |
| `Error: Invalid JSON` | Registry/proxy/cache returned invalid JSON. | Retry, verify proxy configuration, and clean/verify cache. |
| `npm ERR! SyntaxError: Unexpected token <` | Registry request likely returned HTML, often from proxy/auth gateway. | Check `proxy`, `https-proxy`, registry URL, and auth. |
| `npm ERR! registry error parsing json` | Registry response was not valid JSON or local cache is corrupt. | Retry, verify registry/proxy, and clean/verify cache. |
| `ENOENT lstat` | File disappeared during npm operation, often stale tree/cache or older npm race. | Update npm; remove `node_modules`/lock/cache only as needed and rerun. |
| `ENOENT chmod` | npm attempted to chmod a missing file during package/bin setup. | Update npm; reinstall dependencies; verify filesystem/symlink support. |
| `ENOTEMPTY unlink` | npm could not remove a non-empty directory during concurrent tree mutation. | Stop concurrent npm runs, update npm, remove affected tree directory, rerun. |
| `EACCES` | Permission denied writing global prefix/cache/bin location. | Use a Node version manager or set user-writable `prefix`; avoid `sudo npx`. |
| `warn Unknown user config "<key>". This will stop working in the next major version of npm.` | Unsupported custom key exists in `.npmrc`. | Move third-party config to environment variables or package-specific config. |
| Workspace command resolves root binary instead of workspace binary | Positional inference can resolve root dependency in some workspace cases. | Use `--package=<pkg>` and/or `-c '<cmd>'` with `--workspace=<name>`. |

## Traps

_Append-only. Date-stamped. Filled by the operator via the `/lesson` slash command when something bites._

## Lessons

_Append-only. Date-stamped. Filled by the operator via the `/lesson` slash command for behaviors learned that aren't in upstream docs._
