---
name: tool-icloudpd
description: Load when working with icloudpd, iCloud Photos downloads, Apple ID MFA, album sync, keyring cookies, Docker/NAS backups. Covers full CLI surface, auth setup, workflows, and error handling.
triggers:
  bash:
    - icloudpd
    - python -m icloudpd
    - npx --yes icloudpd
    - icloud --username
    - icloud --delete-from-keyring
---

# icloudpd

## What it is

`icloudpd` is the iCloud Photos Downloader command-line tool for copying, syncing, or moving iCloud Photos assets into local storage. Reach for it when backing up iCloud Photos to a server, NAS, Docker volume, desktop folder, or archival workflow; use Apple Photos/iCloud for Windows for GUI sync, and `osxphotos` for macOS local Photos-library exports.

## Capability surface

### Executables installed by the package

| Executable | Purpose |
|---|---|
| `icloudpd` | Main downloader/syncer for iCloud Photos assets. |
| `icloud` | Related `pyicloud_ipd` helper used primarily for system-keyring password storage/deletion and MFA validation. Use `icloud`, not `icloudpd`, for the documented keyring-management flow. |

### `icloudpd` invocation grammar

```bash
icloudpd [GLOBAL] [COMMON] [--username USER [COMMON] ...] [--username USER [COMMON] ...]
```

No subcommands. Options are grouped by parser role:

| Group | Scope |
|---|---|
| `GLOBAL` | Applied across all user configurations. Parsed from anywhere in the argument list. |
| `COMMON` before the first `--username` | Defaults for all user configurations. |
| `COMMON` after a `--username` | Settings for that user/config only. |
| `USER` | `--username` starts a new user/config group; `--password` applies to that group. |

### Operation modes

| Mode | Selector | Local effect | iCloud effect |
|---|---|---|---|
| Copy | default | Download assets that are missing locally. | No deletion. |
| Sync | `--auto-delete` | Download missing assets and delete local files for assets moved to iCloud “Recently Deleted”. | No deletion initiated by `icloudpd`. |
| Move | `--keep-icloud-recent-days DAYS` | Download or confirm assets locally. | Move eligible iCloud assets to “Recently Deleted”, except assets created within `DAYS`. |
| Deprecated move | `--delete-after-download` | Download assets. | Move downloaded remote assets to “Recently Deleted”; deprecated in favor of `--keep-icloud-recent-days`. |

### `icloudpd` GLOBAL options

| Option | Values / default | Purpose |
|---|---|---|
| `-h`, `--help` | flag | Show generated help. Mutually exclusive with `--version`. |
| `--version` | flag | Print version, commit hash, and build timestamp. Mutually exclusive with `--help`. If `--use-os-locale` appears before `--version`, version date formatting uses OS locale. |
| `--use-os-locale` | flag; default off | Use host OS locale for date formatting, including date-derived folder names and version date output. Default is US English. |
| `--only-print-filenames` | flag; default off | Print paths for files that would be downloaded. Does not download, delete local files, or delete iCloud files. Not compatible with `--watch-with-interval`. |
| `--log-level LEVEL` | `debug`, `info`, `error`; default `debug` | Set log verbosity. |
| `--no-progress-bar` | flag; default off | Disable the one-line progress bar; useful for logs/non-TTY output. Progress bar is disabled by default when no TTY is attached. |
| `--threads-num N` | integer; default `1`; deprecated | Deprecated and always effectively single-threaded. To be removed in a future version. |
| `--domain DOMAIN` | `com`, `cn`; default `com` | Select iCloud root domain. Use `cn` for mainland China access. |
| `--watch-with-interval SECONDS` | integer seconds; default unset | Run indefinitely, rechecking iCloud after each interval. Not compatible with `--list-albums`, `--list-libraries`, `--only-print-filenames`, or `--auth-only`. |
| `--password-provider PROVIDER` | repeatable: `parameter`, `keyring`, `console`, `webui`; default order `parameter`, `keyring`, `console` | Select password providers and their order. `console` or `webui` must be last if specified because they cannot be skipped. Valid keyring passwords are saved back to keyring. |
| `--mfa-provider PROVIDER` | `console`, `webui`; default `console` | Select MFA input source. `webui` starts an internal web server on port `8080`. |

### `icloudpd` COMMON options

| Option | Values / default | Purpose |
|---|---|---|
| `-d DIRECTORY`, `--directory DIRECTORY` | path; required unless `--auth-only`, `--list-albums`, or `--list-libraries` is used | Root local folder for downloads and generated folder structure. |
| `--auth-only` | flag; default off | Authenticate, persist session cookies/tokens, and exit without listing or processing assets. Not compatible with `--watch-with-interval`. |
| `--cookie-directory DIR` | path; default `~/.pyicloud` | Directory for persisted authentication cookies/tokens. User-specific cookie files avoid collisions when multiple users share one cookie directory. |
| `--size SIZE` | repeatable: `original`, `medium`, `thumb`, `adjusted`, `alternative`; default `original` | Asset image version(s) to download. Multiple `--size` values are accepted and de-duplicated. `medium` and `thumb` always add filename suffixes; `adjusted` and `alternative` add suffixes when conflicting; `original` never adds a size suffix. |
| `--live-photo-size SIZE` | `original`, `medium`, `thumb`; default `original` | Video size for Live Photo video components. |
| `--recent N` | integer; default unset | Check only the `N` most recently added assets for local copies. Assets are ordered by date added to iCloud, not capture/creation date. |
| `--until-found N` | integer; default unset | Process assets from newest-added to oldest-added until `N` consecutive remote assets already match local files. Optimizes incremental runs but does not fill older local gaps. |
| `-a ALBUM`, `--album ALBUM` | repeatable; default whole collection | Download only the named album(s). Since `1.31.0`, may be specified multiple times. |
| `-l`, `--list-albums` | flag; default off | List available albums and exit. |
| `--library LIBRARY` | library name/key; default “Personal Library” / internal `PrimarySync` | Select one iCloud Photos library. Only one library can be processed by one configuration. |
| `--list-libraries` | flag; default off | List available libraries and exit. |
| `--skip-videos` | flag; default off | Skip video assets. Mutually exclusive with `--skip-photos` within the same configuration. |
| `--skip-photos` | flag; default off | Skip photo assets. Mutually exclusive with `--skip-videos` within the same configuration. Added in `1.30.0`. |
| `--skip-live-photos` | flag; default off | Skip Live Photo video components. |
| `--xmp-sidecar` | flag; default off | Export additional asset metadata as XMP sidecar files. |
| `--force-size` | flag; default off | Download only requested sizes. Without this flag, unavailable requested sizes fall back to `original`; `adjusted` and `alternative` are not forced. |
| `--auto-delete` | flag; default off | Scan iCloud “Recently Deleted” and delete matching local files. Mutually exclusive with `--delete-after-download`. |
| `--folder-structure FORMAT` | Python datetime format string or `none`; default `{:%Y/%m/%d}` | Build subfolders from asset creation timestamp. `none` puts all files directly under `--directory`. Uses Python string formatting grammar. |
| `--set-exif-datetime` | flag; default off | Write EXIF `DateTimeOriginal` from asset creation date when the EXIF tag does not already exist. |
| `--smtp-username USER` | string; default unset | SMTP username for expired/needed authentication notification email. |
| `--smtp-password PASSWORD` | string; default unset | SMTP password/app password for notification email. Do not inline secrets in reusable commands. |
| `--smtp-host HOST` | host; default `smtp.gmail.com` | SMTP server host for notifications. |
| `--smtp-port PORT` | integer; default `587` | SMTP server port for notifications. |
| `--smtp-no-tls` | flag; default off | Disable TLS for SMTP. TLS is required for Gmail. |
| `--notification-email EMAIL` | email; default SMTP username | Recipient for expired/needed authentication notification email. |
| `--notification-email-from EMAIL` | email; default SMTP username or `--notification-email` | Sender address for notification email. |
| `--notification-script PATH` | path; default unset | External script to run for expired/needed authentication notification. |
| `--delete-after-download` | flag; deprecated since `1.26.0` | Delete each iCloud asset after a local download. Deleted items move to “Recently Deleted”. Already-local assets that are not downloaded are not deleted. Use `--keep-icloud-recent-days` instead. |
| `--keep-icloud-recent-days DAYS` | integer; default unset | Delete iCloud assets after local download or local confirmation except assets created within `DAYS`. `0` deletes all eligible assets from iCloud. Filters such as `--skip-videos` exclude skipped assets from deletion. |
| `--dry-run` | flag; default off | Authenticate and compare local/remote state, reporting actions without modifying local storage or iCloud. |
| `--keep-unicode-in-filenames` | flag; default off | Preserve Unicode characters in filenames. Default strips Unicode for compatibility. |
| `--live-photo-mov-filename-policy POLICY` | `suffix`, `original`; default `suffix` | Naming policy for Live Photo video component. `suffix` uses still-image suffix style such as `_HEVC`; `original` keeps the video filename as-is. |
| `--align-raw POLICY` | `as-is`, `original`, `alternative`; default `as-is` | For RAW+JPEG/JPEG+RAW assets, treat RAW as unchanged, always original, or always alternative when selecting sizes. |
| `--file-match-policy POLICY` | `name-size-dedup-with-suffix`, `name-id7`; default `name-size-dedup-with-suffix` | Local/remote file matching and de-duplication policy. `name-size-dedup-with-suffix` appends file size for duplicate names. `name-id7` appends an invariant 7-character iCloud asset ID and does not de-duplicate by suffix. |
| `--skip-created-before TS_OR_INTERVAL` | ISO timestamp/date or interval such as `5d`; default unset | Do not process assets created before the timestamp. If timezone is absent, local timezone is used. Creation/capture date is used, not iCloud added date. |
| `--skip-created-after TS_OR_INTERVAL` | ISO timestamp/date or interval such as `5d`; default unset | Do not process assets created after the timestamp. If timezone is absent, local timezone is used. Creation/capture date is used, not iCloud added date. |

### `icloudpd` USER options

| Option | Values / default | Purpose |
|---|---|---|
| `-u EMAIL`, `--username EMAIL` | Apple ID email; repeatable | Start a new user/configuration group. Options after this point apply to that group until the next `--username`, except global options. |
| `-p PASSWORD`, `--password PASSWORD` | string; default unset | Apple ID password used only when `--password-provider parameter` is active. Avoid inline secrets; prefer keyring, console, environment expansion in one-off shells, or webui. |

### Multiple account/config behavior

```bash
icloudpd --use-os-locale --cookie-directory ./cookies \
  --username alice@example.com --directory ./alice \
  --username bob@example.com   --directory ./bob
```

| Placement | Behavior |
|---|---|
| Before first `--username` | Common defaults for every following user config. Example: shared `--cookie-directory ./cookies`. |
| After a `--username` | Applies only to that user/config. Example: Alice and Bob get different `--directory` values. |
| Same `--username` repeated | Multiple configs for one account. Example: one config with `--skip-videos` to download photos, another with `--skip-photos` to download videos. |
| Global option anywhere | Applies app-wide. Example: `--use-os-locale`. |

### Required/compatibility rules enforced by `icloudpd`

| Rule | Enforced outcome |
|---|---|
| No arguments | Equivalent to `--help`. |
| No `--username` group | No user config is processed. Use at least one `--username` for normal work. |
| Per configuration, one of `--auth-only`, `--directory`, `--list-libraries`, or `--list-albums` is required | Parser exits with an error message. |
| `--skip-videos` with `--skip-photos` in one configuration | Invalid. Use only one filter per configuration. |
| `--auto-delete` with `--delete-after-download` | Invalid. Mutually exclusive. |
| `--keep-icloud-recent-days` with `--delete-after-download` | Invalid. Do not combine in one configuration. |
| `--watch-with-interval` with `--list-albums`, `--list-libraries`, `--only-print-filenames`, or `--auth-only` | Invalid. Watch mode requires a normal processing run. |
| Invalid `--folder-structure` format | Parser exits with `Format <value> specified in --folder-structure is incorrect`. |

### Asset sizes and representations

| Size | Meaning / behavior |
|---|---|
| `original` | Original asset representation. Default. No size suffix. |
| `medium` | Medium-sized derivative. Always adds a filename suffix. |
| `thumb` | Thumbnail derivative. Always adds a filename suffix. |
| `adjusted` | Edited representation, including portrait edits. Falls back to `original` unless forced. Adds suffix when needed to avoid conflict. |
| `alternative` | Alternate representation for RAW+JPEG/JPEG+RAW assets. Falls back to `original` unless forced. Adds suffix when needed to avoid conflict. |

### RAW and Live Photo handling

| Feature | Behavior |
|---|---|
| Apple ProRAW / ProRes | Downloaded like supported originals. |
| Imported RAW images | Recognized formats include DNG, CR2, CR3, CRW, ARW, RAF, RW2, NRF, NEF, PEF, ORF. |
| RAW+JPEG / JPEG+RAW | One representation maps to `original`, the other to `alternative`; `--align-raw` disambiguates RAW placement. |
| Live Photos | Still image and video component are downloaded as separate files unless skipped. Video size follows `--live-photo-size`; video naming follows `--live-photo-mov-filename-policy`. |

### File naming and folder structure

| Feature | Parameter | Behavior |
|---|---|---|
| Folder hierarchy | `--folder-structure FORMAT` | Uses asset creation timestamp with Python datetime formatting. Default `{:%Y/%m/%d}`. `none` disables subfolders. |
| OS locale | `--use-os-locale` | Locale-sensitive datetime codes such as `%B` use host locale instead of default English. |
| Duplicate filenames | `--file-match-policy name-size-dedup-with-suffix` | Default. Adds file-size suffix for duplicate local names. |
| Stable asset IDs | `--file-match-policy name-id7` | Adds 7-character iCloud asset ID suffix to all names. |
| Unicode filenames | `--keep-unicode-in-filenames` | Keeps Unicode. Default strips Unicode. |
| Live Photo MOV naming | `--live-photo-mov-filename-policy suffix` | Default. Uses suffix style, e.g. `IMG_1234_HEVC.MOV`. |
| Live Photo original MOV naming | `--live-photo-mov-filename-policy original` | Keeps the original video filename; pair with `--file-match-policy name-id7` when collisions matter. |

### Web UI surface

| Trigger | Behavior |
|---|---|
| `--password-provider webui` | Starts internal web server on port `8080` and accepts Apple ID password through Web UI. |
| `--mfa-provider webui` | Starts internal web server on port `8080` and accepts MFA code through Web UI. |
| NAS/container use | Map host port to container port `8080` and open browser to the mapped host port. |

### `icloud` helper invocation grammar

```bash
icloud --username EMAIL [--password PASSWORD] [--domain com|cn] [--delete-from-keyring] [--non-interactive]
icloud --version
```

### `icloud` helper options

| Option | Values / default | Purpose |
|---|---|---|
| `--username EMAIL` | Apple ID email; required except `--version` | Select Apple ID account. |
| `--password PASSWORD` | string; default unset | Password to use. If absent, fetch from system keyring; if unavailable and interactive, prompt. |
| `-n`, `--non-interactive` | flag; default interactive | Disable interactive prompts. |
| `--delete-from-keyring` | flag; default off | Delete stored password in system keyring for the username. |
| `--domain DOMAIN` | `com` or `cn`; default `com` | Root domain for iCloud requests. |
| `--version` | flag | Print version, commit hash, and timestamp. |

## Setup & auth

### Install methods

| Method | Command / action | Notes |
|---|---|---|
| PyPI | `pip install icloudpd` | Main Python package install. Project metadata targets Python `>=3.10,<3.14` in current upstream source. |
| PyPI on Windows user install | `pip install icloudpd --user` | Add the printed Python `Scripts` directory under the user profile to `PATH`. |
| Docker | `docker run -it --rm --name icloudpd -v $(pwd)/Photos:/data -e TZ=America/Los_Angeles icloudpd/icloudpd:latest icloudpd --directory /data --username my@email.address --watch-with-interval 3600` | On Windows shells, use `%cd%` or a full path such as `-v c:/photos/icloud:/data`; only Linux containers are supported. Persist `--cookie-directory` with a host volume when container restarts must preserve auth state. |
| AUR | `yay -S icloudpd-bin` | Arch Linux binary package. Manual path: clone `https://aur.archlinux.org/icloudpd-bin.git`, then `makepkg -sirc`. |
| npm | `npx --yes icloudpd --directory /data --username my@email.address --watch-with-interval 3600` | Wrapper distribution. |
| GitHub release binary | Download platform binary, mark executable, run directly | macOS binary is Intel 64-bit and works on Apple Silicon through translation; Gatekeeper requires allowing the binary in Privacy & Security on first run. |
| Source build | Clone upstream repository and build/run from source | Use only when package/binary distributions are unsuitable. |

### iCloud account prerequisites

| Requirement | Setting / behavior |
|---|---|
| Access iCloud Data on the Web | Enable on iPhone/iPad under Apple Account / iCloud settings. Without it, Apple may return `ACCESS_DENIED`. |
| Advanced Data Protection | Disable for the account. ADP disables the web access pattern used by `icloudpd`. |
| MFA / 2FA | Apple requires MFA for new accounts. `icloudpd` supports console and Web UI MFA entry. MFA trust expires on Apple’s interval, documented as about two months. |
| FIDO / hardware security keys | Not supported. |
| Mainland China | Use `--domain cn`; reports are mixed. |

### Password and session storage

| Item | Location / provider |
|---|---|
| Session cookies/tokens | `--cookie-directory`, default `~/.pyicloud`. |
| Password provider default order | `parameter`, then `keyring`, then `console`. |
| Keyring storage | System keyring backend used by Python `keyring` / `keyrings-alt`. Store with `icloud --username EMAIL`; delete with `icloud --username EMAIL --delete-from-keyring`. |
| Console password | `--password-provider console`; prompts on stdin. |
| Web UI password | `--password-provider webui`; port `8080`. |
| CLI password parameter | `--password` / `-p`; avoid in reusable commands because process listings, shell history, logs, or orchestration manifests may expose it. |
| Notification credentials | `--smtp-username`, `--smtp-password`, `--smtp-host`, `--smtp-port`, `--smtp-no-tls`; Gmail with 2FA requires an app password. |

### State and side effects

| State | Notes |
|---|---|
| Downloads | Written under `--directory` plus `--folder-structure`. |
| Local deletion | `--auto-delete` deletes local files corresponding to assets in iCloud “Recently Deleted”. |
| Remote deletion | `--keep-icloud-recent-days` or deprecated `--delete-after-download` moves iCloud assets to “Recently Deleted”. |
| EXIF updates | `--set-exif-datetime` modifies downloaded image EXIF only when `DateTimeOriginal` is absent. |
| XMP sidecars | `--xmp-sidecar` writes metadata sidecar files alongside assets. |
| Dry runs | `--dry-run` authenticates and compares state without local or remote mutations. |

## Common workflows

Authenticate and persist session only:

```bash
icloudpd --username my@email.address --password-provider console --auth-only
```

Creates or refreshes cookies/tokens in `~/.pyicloud` and exits without asset processing.

Store password in system keyring, then authenticate from keyring:

```bash
icloud --username my@email.address
icloudpd --username my@email.address --password-provider keyring --auth-only
```

First command prompts for password and offers to save it. Second command validates downloader auth using keyring.

Continuously copy iCloud Photos into local storage:

```bash
icloudpd --directory /data --username my@email.address --watch-with-interval 3600
```

Downloads missing assets and repeats hourly. No local deletion and no iCloud deletion.

List libraries and albums before a scoped download:

```bash
icloudpd --username my@email.address --list-libraries
icloudpd --username my@email.address --list-albums
icloudpd --directory ./Photos --username my@email.address --library "Personal Library" --album "Favorites"
```

Prints available scopes, then downloads one selected library/album.

Download edited/original pairs with EXIF date repair:

```bash
icloudpd --directory ./Photos --username my@email.address --size adjusted --size original --set-exif-datetime
```

Downloads edited versions and originals, adding suffixes where needed; fills missing `DateTimeOriginal` EXIF tags.

Dry-run a move workflow before deleting older assets from iCloud:

```bash
icloudpd --directory /data --username my@email.address --keep-icloud-recent-days 30 --dry-run
```

Reports local and remote actions without modifying iCloud. Remove `--dry-run` only after reviewing output.

## Error handling

| Symptom | Likely cause | Fix |
|---|---|---|
| `Bad Request (400)` on first run | iCloud Photos API/account data not ready for the account. | Wait 5–10 minutes and retry. If still present after 30 minutes, capture output and open an upstream issue. |
| `private db access disabled for this account. Please wait a few minutes then try again.The remote servers might be trying to throttle requests. (ACCESS_DENIED)` | iCloud web data access disabled, Advanced Data Protection enabled, or Apple-side access denial. | Enable Access iCloud Data on the Web, disable Advanced Data Protection, clear stale cookies if needed, then run `--auth-only`. |
| `NotImplementedError: None of providers gave password` | Selected password providers did not yield a password, commonly `--password-provider keyring` with no stored keyring password. | Store password with `icloud --username EMAIL`, or include `--password-provider console` / `--password-provider webui` after `keyring`. |
| `icloud: error: No password supplied` | `icloud` helper ran non-interactively or keyring had no password. | Run interactively, pass a one-off `--password` securely, or fix keyring backend availability. |
| `keyring.errors.PasswordDeleteError: Password not found` | Requested deletion of a keyring entry that does not exist. | Treat as already absent; re-store with `icloud --username EMAIL` if keyring auth is desired. |
| `KeyError: 'dsInfo'` | Commonly reported when mainland China accounts/requests hit the wrong iCloud root domain. | Retry with `--domain cn` for `icloudpd` and `icloud`. |
| `Failed to verify verification code` | MFA/2SA code was wrong, expired, truncated, or entered for the wrong device/session. | Request a fresh code and preserve leading zeros. Prefer current `icloudpd`; older releases had SMS/MFA handling fixes. |
| `Two-step/two-factor authentication is required!` | Stored session/MFA trust expired. | Run `icloudpd --username EMAIL --auth-only` with console or Web UI MFA provider. Configure SMTP/script notifications if unattended operation matters. |
| `Only one of --skip-videos and --skip-photos can be used at a time for each configuration` | Both media filters were used in the same config group. | Split into two `--username` config groups or remove one filter. |
| `--auth-only, --directory, --list-libraries, or --list-albums are required for each configuration` | A user config lacks an action/output directory. | Add `--directory DIR`, `--auth-only`, `--list-libraries`, or `--list-albums` after each `--username`. |
| `--auto-delete and --delete-after-download are mutually exclusive per configuration` | Local sync deletion and remote move deletion were combined. | Choose `--auto-delete` for local sync cleanup or `--keep-icloud-recent-days` for remote cleanup. |
| `--keep-icloud-recent-days and --delete-after-download should not be used together in one configuration` | Deprecated delete mode combined with replacement delete mode. | Remove `--delete-after-download`; use only `--keep-icloud-recent-days`. |
| `--watch-with-interval is not compatible with --list-albums, --list-libraries, --only-print-filenames, and --auth-only` | Watch mode was combined with a listing/auth/print-only action. | Run the listing/auth/print-only command separately, then run watch mode with a normal download configuration. |
| `Format <value> specified in --folder-structure is incorrect` | Invalid Python datetime format string for folder generation. | Use a valid format such as `{:%Y/%m/%d}`, quote shell metacharacters, or use `--folder-structure none`. |
| `Failed to execv() /tmp/staticx-...` on Synology | Synology `/tmp` mounted `noexec`, blocking static binary execution. | Run `sudo mount /tmp -o remount,exec` from SSH, or use a package/container path that does not require executing from `/tmp`. |
| `server_hostname cannot be an empty string or start with a leading dot` | Old SMTP notification/TLS bug in pre-1.7.2-era deployments. | Upgrade `icloudpd`; verify `--smtp-host`, `--smtp-port`, and TLS settings. |
| `Missing apple_id field` / `Invalid authentication token.` | Authentication protocol mismatch, stale token, or old release behavior. | Upgrade to current release, clear `--cookie-directory`, then run `--auth-only`; verify account prerequisites and MFA. |

## Traps

_Append-only. Date-stamped. Filled by the operator via the `/lesson` slash command when something bites._

## Lessons

_Append-only. Date-stamped. Filled by the operator via the `/lesson` slash command for behaviors learned that aren't in upstream docs._
