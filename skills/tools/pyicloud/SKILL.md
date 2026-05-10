---
name: tool-pyicloud
description: Load when working with pyicloud, iCloud authentication, Find My devices, iCloud Drive, Photos, Notes, Reminders, or the icloud CLI. Covers full API/CLI surface, auth setup, error handling, and lessons.
triggers:
  bash:
    - icloud
    - pyicloud
    - from pyicloud
    - import pyicloud
    - python -m pyicloud
    - python -m pyicloud.cmdline
---

# pyicloud

## What it is

PyiCloud is a Python library plus the `icloud` Typer CLI for interacting with Apple iCloud web services through the same web endpoints used by iCloud.com. It solves authentication, session persistence, 2FA/security-key handling, and access to Account, Find My devices, Calendar, Contacts, iCloud Drive, Photos, Hide My Email, Notes, and Reminders. Reach for it when Python automation must inspect or mutate iCloud data; common alternatives are `icloudpd` for bulk photo downloads, Apple Shortcuts/iCloud.com for manual workflows, and service-specific wrappers.

## Capability surface

### Version and entry points

| Surface | Details |
|---|---|
| Package | `pyicloud` |
| Current source snapshot used here | `timlaing/pyicloud` tag `2.5.0` |
| Python requirement | `>=3.10` |
| Top-level exports | `PyiCloudService`, `AppleDevice` |
| Console script | `icloud = pyicloud.cmdline:main` |
| Backward-compatible module entry | `pyicloud.cmdline.main()` |

### CLI root

```bash
icloud [OPTIONS] COMMAND [ARGS]...
```

| Option | Values/default | Meaning |
|---|---:|---|
| `--version` | boolean | Print installed pyicloud version and exit. |
| `--install-completion` | shell-dependent | Typer shell-completion installer. |
| `--show-completion` | shell-dependent | Print shell-completion script. |
| `--help` | boolean | Show command or subcommand help. |

Root command groups:

| Group | Purpose |
|---|---|
| `icloud auth` | Manage authentication, local sessions, and keyring credentials. |
| `icloud account` | Inspect account metadata, devices, family, and storage. |
| `icloud devices` | Work with Find My devices. |
| `icloud calendar` | Inspect calendars and events. |
| `icloud contacts` | Inspect contacts and the account me-card. |
| `icloud drive` | Browse and download iCloud Drive files. |
| `icloud photos` | Browse and download iCloud Photos. |
| `icloud hidemyemail` | Manage Hide My Email aliases. |
| `icloud notes` | Inspect, render, and export Notes. |
| `icloud reminders` | Inspect and mutate Reminders. |

### CLI shared options

These options are attached to leaf commands rather than group callbacks.

| Option | Applies to | Values/default | Meaning |
|---|---|---:|---|
| `--username` | most commands | string | Apple ID username. Required to bootstrap a new local account; optional when one local account is discoverable. |
| `--session-dir` | most commands | path | Directory for `.session`, `.cookiejar`, and `accounts.json`. |
| `--password` | `auth login` | string | Apple ID password. Omit to use keyring or interactive prompt. |
| `--china-mainland` | `auth login` | boolean/nullable | Use China mainland iCloud endpoints. |
| `--interactive` / `--non-interactive` | `auth login` | default `--interactive` | Enable prompts for password, MFA device selection, and codes. |
| `--accept-terms` | `auth login` | boolean | Accept pending Apple iCloud web terms. |
| `--http-proxy` | most commands | URL | Override HTTP proxy for requests. |
| `--https-proxy` | most commands | URL | Override HTTPS proxy for requests. |
| `--no-verify-ssl` | most commands | boolean | Disable TLS certificate verification. Testing-only. |
| `--format` | most commands | `text`, `json`; default `text` | Output format. |
| `--log-level` | most commands | `error`, `warning`, `info`, `debug`; default `warning` | Internal logging level. |
| `--with-family` | `devices` commands | boolean | Include family devices in Find My listings. |

### CLI command inventory

| Command | Arguments | Command-specific options | Output / side effect |
|---|---|---|---|
| `icloud auth status` | none | shared account/network/output/log options | Current auth/session status. |
| `icloud auth login` | none | `--username`, `--session-dir`, `--password`, `--china-mainland`, `--interactive/--non-interactive`, `--accept-terms`, `--http-proxy`, `--https-proxy`, `--no-verify-ssl`, `--format`, `--log-level` | Authenticates, persists session/cookies, stores password in keyring when entered interactively. |
| `icloud auth logout` | none | `--keep-trusted`, `--all-sessions`, `--remove-keyring`, shared account/network/output/log options | Remote logout when possible; clears local session files; optionally deletes keyring password. |
| `icloud auth keyring delete` | none | `--username`, `--session-dir`, `--format`, `--log-level` | Deletes stored password for account from system keyring. |
| `icloud account summary` | none | shared account/network/output/log options | Account plan summary. |
| `icloud account devices` | none | shared account/network/output/log options | Account device metadata. |
| `icloud account family` | none | shared account/network/output/log options | Family-member metadata. |
| `icloud account storage` | none | shared account/network/output/log options | Storage quota/usage. |
| `icloud devices list` | none | `--locate`, shared account/network/output/log options, `--with-family` | Device list; optionally current locations. |
| `icloud devices show DEVICE` | `DEVICE`: id/name/index selector | `--locate`, `--raw`, shared account/network/output/log options, `--with-family` | One device, normalized or raw. |
| `icloud devices sound DEVICE` | `DEVICE` | `--subject`, shared account/network/output/log options, `--with-family` | Plays Find My sound. |
| `icloud devices message DEVICE MESSAGE` | `DEVICE`, display message text | `--subject`, `--silent`, shared account/network/output/log options, `--with-family` | Displays a Find My message; optionally silent. |
| `icloud devices lost-mode DEVICE` | `DEVICE` | `--phone`, `--message`, `--passcode`, shared account/network/output/log options, `--with-family` | Enables Lost Mode. |
| `icloud devices erase DEVICE` | `DEVICE` | `--message`, `--force`/`-f`, shared account/network/output/log options, `--with-family` | Requests device erase; confirmation unless `--force`. |
| `icloud devices export DEVICE` | `DEVICE` | `--output PATH`, `--raw/--no-raw`, hidden `--normalized`, shared account/network/output/log options, `--with-family` | Writes device JSON to file. |
| `icloud calendar calendars` | none | shared account/network/output/log options | Calendar list. |
| `icloud calendar events` | none | `--from DATETIME`, `--to DATETIME`, `--period PERIOD`, `--calendar-guid GUID`, `--limit N`, shared account/network/output/log options | Event list; calendar filter is client-side. |
| `icloud contacts list` | none | `--limit N`, shared account/network/output/log options | Contacts. |
| `icloud contacts me` | none | shared account/network/output/log options | Me-card, including photo metadata when available. |
| `icloud drive list [PATH]` | `PATH`, default `/` | `--trash`, shared account/network/output/log options | Directory entries from drive or trash root. |
| `icloud drive download PATH` | `PATH` | `--output PATH`, `--trash`, shared account/network/output/log options | Downloads one file. |
| `icloud photos albums` | none | shared account/network/output/log options | Photo album list. |
| `icloud photos list` | none | `--album NAME`, `--limit N`, shared account/network/output/log options | Photo asset list from all photos or album. |
| `icloud photos download PHOTO_ID` | `PHOTO_ID` | `--output PATH`, `--version VERSION`, shared account/network/output/log options | Downloads selected photo asset version. |
| `icloud hidemyemail list` | none | shared account/network/output/log options | Alias list. |
| `icloud hidemyemail generate` | none | shared account/network/output/log options | Generates an available alias without reserving it. |
| `icloud hidemyemail reserve EMAIL LABEL` | `EMAIL`, `LABEL` | `--note`, shared account/network/output/log options | Reserves a generated alias. |
| `icloud hidemyemail update ANONYMOUS_ID LABEL` | `ANONYMOUS_ID`, `LABEL` | `--note`, shared account/network/output/log options | Updates alias metadata. |
| `icloud hidemyemail deactivate ANONYMOUS_ID` | `ANONYMOUS_ID` | shared account/network/output/log options | Deactivates alias. |
| `icloud hidemyemail reactivate ANONYMOUS_ID` | `ANONYMOUS_ID` | shared account/network/output/log options | Reactivates alias. |
| `icloud hidemyemail delete ANONYMOUS_ID` | `ANONYMOUS_ID` | shared account/network/output/log options | Deletes alias. |
| `icloud notes recent` | none | `--limit N`, `--include-deleted`, shared account/network/output/log options | Recent note summaries. |
| `icloud notes folders` | none | shared account/network/output/log options | Folder list. |
| `icloud notes list` | none | `--folder-id ID`, `--all`, `--since CURSOR`, `--limit N`, shared account/network/output/log options | Notes in folder, all notes, or cursor-based iteration. |
| `icloud notes search` | none | `--title TITLE`, `--title-contains TEXT`, `--limit N`, shared account/network/output/log options | Title search. Must pass one title option. |
| `icloud notes get NOTE_ID` | `NOTE_ID` | `--with-attachments`, shared account/network/output/log options | Full note payload; attachment metadata optional. |
| `icloud notes render NOTE_ID` | `NOTE_ID` | `--preview-appearance light|dark`, `--pdf-height N`, shared account/network/output/log options | HTML fragment/string output. |
| `icloud notes export NOTE_ID` | `NOTE_ID` | `--output-dir PATH`, `--export-mode archival|lightweight`, `--assets-dir PATH`, `--full-page/--fragment`, `--preview-appearance light|dark`, `--pdf-height N`, shared account/network/output/log options | HTML export; archival mode downloads assets. |
| `icloud notes changes` | none | `--since CURSOR`, `--limit N`, shared account/network/output/log options | Incremental changes. |
| `icloud notes sync-cursor` | none | shared account/network/output/log options | Current Notes sync cursor. |
| `icloud reminders lists` | none | shared account/network/output/log options | Reminder lists. |
| `icloud reminders list` | none | `--list-id ID`, `--include-completed`, `--limit N`, shared account/network/output/log options | Reminder list entries. |
| `icloud reminders get REMINDER_ID` | `REMINDER_ID` | shared account/network/output/log options | One reminder. |
| `icloud reminders create` | none | `--list-id ID`, `--title TITLE`, `--desc TEXT`, `--completed/--not-completed`, `--due-date DATETIME`, `--priority N`, `--flagged/--not-flagged`, `--all-day/--not-all-day`, `--time-zone TZ`, `--parent-reminder-id ID`, shared account/network/output/log options | Creates reminder. |
| `icloud reminders update REMINDER_ID` | `REMINDER_ID` | `--title`, `--desc`, `--completed/--not-completed`, `--due-date`, `--clear-due-date`, `--priority`, `--flagged/--not-flagged`, `--all-day/--not-all-day`, `--time-zone`, `--clear-time-zone`, `--parent-reminder-id`, `--clear-parent-reminder`, shared account/network/output/log options | Updates reminder fields. |
| `icloud reminders set-status REMINDER_ID` | `REMINDER_ID` | `--completed/--not-completed`, shared account/network/output/log options | Marks reminder complete/incomplete. |
| `icloud reminders delete REMINDER_ID` | `REMINDER_ID` | shared account/network/output/log options | Deletes reminder. |
| `icloud reminders snapshot` | none | `--list-id ID`, `--include-completed`, `--results-limit N`, shared account/network/output/log options | Compound reminder snapshot with related records. |
| `icloud reminders changes` | none | `--since CURSOR`, `--limit N`, shared account/network/output/log options | Incremental changes. |
| `icloud reminders sync-cursor` | none | shared account/network/output/log options | Current Reminders sync cursor. |
| `icloud reminders alarm list REMINDER_ID` | `REMINDER_ID` | shared account/network/output/log options | Alarms for reminder. |
| `icloud reminders alarm add-location REMINDER_ID` | `REMINDER_ID` | `--title`, `--address`, `--latitude`, `--longitude`, `--radius`, `--proximity arriving|leaving`, shared account/network/output/log options | Adds location trigger alarm. |
| `icloud reminders hashtag list REMINDER_ID` | `REMINDER_ID` | shared account/network/output/log options | Hashtags for reminder. |
| `icloud reminders hashtag create REMINDER_ID NAME` | `REMINDER_ID`, `NAME` | shared account/network/output/log options | Creates hashtag. |
| `icloud reminders hashtag update REMINDER_ID HASHTAG_ID` | `REMINDER_ID`, `HASHTAG_ID` | `--name`, shared account/network/output/log options | Updates hashtag. |
| `icloud reminders hashtag delete REMINDER_ID HASHTAG_ID` | `REMINDER_ID`, `HASHTAG_ID` | shared account/network/output/log options | Deletes hashtag link/record. |
| `icloud reminders attachment list REMINDER_ID` | `REMINDER_ID` | shared account/network/output/log options | Attachments for reminder. |
| `icloud reminders attachment create-url REMINDER_ID` | `REMINDER_ID` | `--url URL`, `--uti UTI`, shared account/network/output/log options | Adds URL attachment. |
| `icloud reminders attachment update REMINDER_ID ATTACHMENT_ID` | `REMINDER_ID`, `ATTACHMENT_ID` | `--url`, `--uti`, `--filename`, `--file-size`, `--width`, `--height`, shared account/network/output/log options | Updates attachment metadata. |
| `icloud reminders attachment delete REMINDER_ID ATTACHMENT_ID` | `REMINDER_ID`, `ATTACHMENT_ID` | shared account/network/output/log options | Deletes attachment. |
| `icloud reminders recurrence list REMINDER_ID` | `REMINDER_ID` | shared account/network/output/log options | Recurrence rules for reminder. |
| `icloud reminders recurrence create REMINDER_ID` | `REMINDER_ID` | `--frequency daily|weekly|monthly|yearly`, `--interval N`, `--occurrence-count N`, `--first-day-of-week 0..6`, shared account/network/output/log options | Creates recurrence rule. |
| `icloud reminders recurrence update REMINDER_ID RULE_ID` | `REMINDER_ID`, `RULE_ID` | `--frequency`, `--interval`, `--occurrence-count`, `--first-day-of-week`, shared account/network/output/log options | Updates recurrence rule. |
| `icloud reminders recurrence delete REMINDER_ID RULE_ID` | `REMINDER_ID`, `RULE_ID` | shared account/network/output/log options | Deletes recurrence rule. |

### Python package exports

| Module | Public surface |
|---|---|
| `pyicloud` | `PyiCloudService`, `AppleDevice` |
| `pyicloud.cmdline` | `main()` |
| `pyicloud.utils` | `KEYRING_SYSTEM`, `get_password(username, interactive=sys.stdout.isatty())`, `password_exists_in_keyring(username)`, `get_password_from_keyring(username)`, `store_password_in_keyring(username, password)`, `delete_password_in_keyring(username)`, `underscore_to_camelcase(word, initial_capital=False)`, `camelcase_to_underscore(camel_str)`, `b64url_decode(s)`, `b64_encode(b)` |
| `pyicloud.ssl_context` | `configurable_ssl_verification(verify_ssl=True, http_proxy=None, https_proxy=None)` |
| `pyicloud.srp_password` | `SrpProtocolType.{S2K,S2K_FO}`, `SrpPassword(password)`, `SrpPassword.set_encrypt_info(salt, iterations, key_length, protocol)`, `SrpPassword.encode()` |
| `pyicloud.common.models` | `ServiceModel`, `FrozenServiceModel`, `MutableServiceModel` |
| `pyicloud.common.cloudkit.base` | `CloudKitExtraMode = Literal['allow','ignore','forbid']`, `resolve_cloudkit_validation_extra(explicit=None, default='allow')`, `CKModel` |

### Exceptions

| Exception | Constructor / fields | Raised for |
|---|---|---|
| `PyiCloudException` | base class | Generic pyicloud error. |
| `PyiCloudPasswordException` | base subclass | Password/SRP handling. |
| `PyiCloudServiceUnavailable` | base subclass | Service unavailable or missing endpoint/capability. |
| `TokenException` | base subclass | Token errors. |
| `PyiCloudAPIResponseException` | `PyiCloudAPIResponseException(reason, code=None, response=None)`; attributes `reason`, `code`, `response` | Normalized Apple API response error. |
| `PyiCloudServiceNotActivatedException` | subclass of `PyiCloudAPIResponseException` | iCloud service not enabled/activated. |
| `PyiCloudFailedLoginException` | `PyiCloudFailedLoginException(msg, *args, response=None)`; attribute `response` | Failed login, password, SRP, or token validation. |
| `PyiCloudAcceptTermsException` | base subclass | Pending iCloud terms not accepted. |
| `PyiCloud2FARequiredException` | `PyiCloud2FARequiredException(apple_id, response)`; attribute `response` | HSA2/2FA required. |
| `PyiCloud2SARequiredException` | `PyiCloud2SARequiredException(apple_id)` | Legacy two-step auth required. |
| `PyiCloudAuthRequiredException` | `PyiCloudAuthRequiredException(apple_id, response)`; attribute `response` | Re-authentication required. |
| `PyiCloudNoTrustedNumberAvailable` | base subclass | SMS 2FA path has no trusted number. |
| `PyiCloudTrustedDevicePromptException` | subclass of `PyiCloudAPIResponseException` | Trusted-device prompt bootstrap failure. |
| `PyiCloudTrustedDeviceVerificationException` | subclass of `PyiCloudAPIResponseException` | Trusted-device code verification failure. |
| `PyiCloudNoStoredPasswordAvailableException` | base subclass | No keyring password. |
| `PyiCloudNoDevicesException` | base subclass | No Find My devices. |
| `PhotosServiceException` | `PhotosServiceException(*args, photo=None, album=None)` | Photos album/asset mutation failure. |
| `RemindersAuthError` | base exception | CloudKit Reminders auth failure. |
| `RemindersApiError` | `RemindersApiError(message, payload=None)` | CloudKit Reminders API/validation failure. |
| `NotesError` | base exception | Notes service error. |
| `NotesAuthError` | subclass of `NotesError` | CloudKit Notes auth failure. |
| `NotesRateLimited` | `NotesRateLimited(message, retry_after=None)` | Notes HTTP 429 response. |
| `NotesApiError` | `NotesApiError(message, payload=None)` | Notes API/validation failure. |
| `NoteNotFound` | subclass of `NotesError` | Missing note id. |
| `NoteLockedError` | subclass of `NotesError` | Passphrase-locked note content. |

### `PyiCloudService`

```python
PyiCloudService(
    apple_id: str,
    password: Optional[str] = None,
    cookie_directory: Optional[str] = None,
    verify: bool = True,
    client_id: Optional[str] = None,
    with_family: bool = True,
    china_mainland: Optional[bool] = None,
    accept_terms: bool = False,
    refresh_interval: float | None = None,
    *,
    authenticate: bool = True,
    cloudkit_validation_extra: Optional[CloudKitExtraMode] = None,
) -> None
```

| Member | Type / signature | Meaning |
|---|---|---|
| `resolve_cookie_directory(cookie_directory=None)` | function | Returns explicit expanded directory, else `<tempdir>/pyicloud/<os-user>`. |
| `is_china_mainland` | property | Whether China mainland endpoints are active. |
| `authenticate(force_refresh=False, service=None)` | method | Authenticate or validate cached token; optionally service-specific login. |
| `get_auth_status()` | method | Probe current token/session without prompting. |
| `logout(keep_trusted=False, all_sessions=False, clear_local_session=True)` | method | Remote logout and/or local persistence clear. |
| `session` | property | `PyiCloudSession`. |
| `requires_2sa` | property | Legacy two-step auth still needed. |
| `requires_2fa` | property | Two-factor auth still needed. |
| `is_trusted_session` | property | Whether Apple marks session trusted. |
| `trusted_devices` | property | Trusted devices for legacy verification. |
| `send_verification_code(device)` | method | Send legacy verification code to trusted device. |
| `validate_verification_code(device, code)` | method | Validate legacy trusted-device code, then trust session. |
| `two_factor_delivery_method` | property | `unknown`, `trusted_device`, `sms`, or security-key mediated flow state. |
| `two_factor_delivery_notice` | property | Human-readable Apple 2FA delivery notice. |
| `security_key_names` | property | Names surfaced for required FIDO2/WebAuthn keys. |
| `request_2fa_code()` | method | Requests HSA2 code via trusted device or SMS; returns boolean. |
| `fido2_devices` | property | Available `CtapHidDevice` security keys. |
| `confirm_security_key(device=None)` | method | Completes FIDO2 security-key assertion. |
| `validate_2fa_code(code)` | method | Validates HSA2 code, then trusts session. |
| `trust_session()` | method | Marks session trusted with Apple. |
| `get_webservice_url(ws_key)` | method | Resolve iCloud service endpoint URL from webservices payload. |
| `devices` | property | `FindMyiPhoneServiceManager`. |
| `iphone` | property | First Find My device / legacy shortcut. |
| `account` | property | `AccountService`. |
| `files` | property | `UbiquityService` legacy file storage. |
| `photos` | property | `PhotosService`. |
| `calendar` | property | `CalendarService`. |
| `contacts` | property | `ContactsService`. |
| `reminders` | property | `RemindersService`. |
| `drive` | property | `DriveService`. |
| `hidemyemail` | property | `HideMyEmailService`. |
| `notes` | property | `NotesService`. |
| `account_name` | property | Apple ID account name. |

Auxiliary auth dataclasses:

| Class | Fields / methods |
|---|---|
| `TrustedPhoneNumber` | fields `device_id`, `non_fteu=None`, `push_mode=None`; methods `from_mapping(value)`, `as_phone_number_payload()` |
| `PhoneNumberVerification` | fields `trusted_phone_number=None`, `trusted_phone_numbers=()`; methods `from_mapping(value)`, `best_trusted_phone_number()` |

### `PyiCloudSession`

`PyiCloudSession` subclasses `requests.Session` and persists Apple cookies and response header-derived session data.

| Member | Signature / value |
|---|---|
| `__init__` | `PyiCloudSession(service, client_id, cookie_directory, verify=False, headers=None)` |
| `data` | property; mutable session metadata dict; non-persisted auth challenge keys filtered on save. |
| `logger` | property. |
| `clear_persistence(remove_files=True)` | Clears in-memory cookies/data; optionally removes `.cookiejar` and `.session`. |
| `request(...)` | Requests through normalized error handling and persistence. |
| `request_raw(...)` | Requests and persists without raising normalized API response exceptions. |
| `service` | property; owning `PyiCloudService`. |
| `cookiejar_path` | property; `<cookie_directory>/<sanitized-account>.cookiejar`. |
| `session_path` | property; `<cookie_directory>/<sanitized-account>.session`. |

### Account service

| Class/member | Surface |
|---|---|
| `AccountService(service_root, session, china_mainland, params)` | Base account metadata service. |
| `AccountService.devices` | property; account devices. |
| `AccountService.family` | property; family members. |
| `AccountService.storage` | property; `AccountStorage`. |
| `AccountService.summary_plan` | property; plan summary. |
| `AccountDevice(dict)` | dict subclass for account device rows. |
| `FamilyMember(member_info, session, params, acc_family_member_photo_url)` | properties `last_name`, `dsid`, `original_invitation_email`, `full_name`, `age_classification`, `apple_id_for_purchases`, `apple_id`, `family_id`, `first_name`, `has_parental_privileges`, `has_screen_time_enabled`, `has_ask_to_buy_enabled`, `has_share_purchases_enabled`, `share_my_location_enabled_family_members`, `has_share_my_location_enabled`, `dsid_for_purchases`; methods `get_photo()`, `__getitem__(key)` |
| `AccountStorageUsageForMedia(usage_data)` | properties `key`, `label`, `color`, `usage_in_bytes`. |
| `AccountStorageUsage(usage_data, quota_data)` | properties `comp_storage_in_bytes`, `used_storage_in_bytes`, `used_storage_in_percent`, `available_storage_in_bytes`, `available_storage_in_percent`, `total_storage_in_bytes`, `commerce_storage_in_bytes`, `quota_over`, `quota_tier_max`, `quota_almost_full`, `quota_paid`. |
| `AccountStorage(storage_data)` | storage wrapper; inspect raw/attributes produced from account storage payload. |

### Find My devices

| Class/member | Surface |
|---|---|
| `FindMyiPhoneServiceManager(service_root, token_endpoint, session, params, with_family=False, refresh_interval=None)` | Manager for Find My devices. |
| `FindMyiPhoneServiceManager.refresh(locate=True)` | Refreshes device payloads; `locate=True` asks Apple for locations. |
| `FindMyiPhoneServiceManager.__getitem__(key)` | Lookup by id/name/index. |
| `FindMyiPhoneServiceManager.__iter__()` / `__len__()` | Iterate/count devices. |
| `FindMyiPhoneServiceManager.is_alive` | property; refresh worker/alive state. |
| `FindMyiPhoneServiceManager.devices` | property; device collection. |
| `FindMyiPhoneServiceManager.user_info` | property; account/user payload. |
| `AppleDevice(content, params, manager, sound_url, lost_url, erase_url, erase_token_url, message_url)` | One Find My device. |
| `AppleDevice.session` | property. |
| `AppleDevice.update(data)` | Merge updated payload. |
| `AppleDevice.location` | property; current location payload. |
| `AppleDevice.status(additional=None)` | Device status summary; optional additional keys. |
| `AppleDevice.play_sound(subject='Find My iPhone Alert')` | Trigger audible Find My alert. |
| `AppleDevice.display_message(subject='Find My iPhone Alert', message='This is a note', sounds=False, vibrate=False, strobe=False)` | Display Find My message. |
| `AppleDevice.lost_device(number, text='This device has been lost. Please call me.', newpasscode='')` | Enable lost mode. |
| `AppleDevice.erase_device(text='This device has been lost. Please call me.', newpasscode='')` | Request erase. |
| `AppleDevice.data` | property; raw device dict. |
| `AppleDevice.__getitem__(key)` | Raw dict access. |
| `AppleDevice.name`, `model`, `model_name`, `device_type` | properties. |
| `AppleDevice.lost_mode_available`, `messaging_available`, `sound_available`, `erase_available`, `location_available` | capability properties. |

### Calendar service

| Class/member | Surface |
|---|---|
| `DateFormats` | constants `API_DATE='%Y-%m-%d'`, `APPLE_DATE='%Y%m%d'`. |
| `CalendarDefaults` | constants `TITLE='Untitled'`, `SYMBOLIC_COLOR='__custom__'`, `SUPPORTED_TYPE='Event'`, `OBJECT_TYPE='personal'`, `ORDER=7`, `SHARE_TITLE=''`, `SHARED_URL=''`, `COLOR=''`. |
| `InviteeDefaults` | constants `ROLE='REQ-PARTICIPANT'`, `STATUS='NEEDS-ACTION'`. |
| `AlarmDefaults` | constants `MESSAGE_TYPE='message'`, `IS_LOCATION_BASED=False`. |
| `AlarmMeasurement` | dataclass fields `before=True`, `weeks=0`, `days=0`, `hours=0`, `minutes=0`, `seconds=0`. |
| `AppleAlarm` | dataclass fields `guid`, `pGuid`, `messageType='message'`, `isLocationBased=False`, `measurement=AlarmMeasurement()`. |
| `AppleDateFormat` | dataclass fields `date_string`, `year`, `month`, `day`, `hour`, `minute`, `minutes_from_midnight`; methods `from_datetime(dt, is_start=True)`, `to_list()`. |
| `AppleEventInvitee` | dataclass fields `email`, `role='REQ-PARTICIPANT'`, `inviteeStatus='NEEDS-ACTION'`. |
| `ApplePayloadInvitee` | dataclass fields `guid`, `pGuid`, `role`, `isOrganizer=False`, `email=''`, `inviteeStatus`, `commonName=''`, `isMe=False`. |
| `AppleCalendarEvent` | dataclass for Apple event payload: required `title`, `tz`, `icon`, `duration`, `allDay`, `pGuid`, `guid`, `startDate`, `endDate`, `localStartDate`, `localEndDate`, `createdDate`, `lastModifiedDate`, `extendedDetailsAreIncluded`, `recurrenceException`, `recurrenceMaster`, `hasAttachments`; optional `readOnly=False`, `transparent=False`, birthday flags, `location`, `url`, `description`, `etag`, `alarms`, `attachments`, `invitees`, `changeRecurring`. |
| `EventObject` | dataclass fields `pguid`, `title='New Event'`, `start_date`, `end_date`, `local_start_date`, `local_end_date`, computed `duration`, `icon=0`, `change_recurring`, `tz`, `guid`, `location`, booleans for details/recurrence/attachments/all-day/junk, `etag`, generated `invitees`, `alarms`, `_alarm_metadata`. |
| `EventObject.to_apple_event()` | Convert to AppleCalendarEvent. |
| `EventObject.request_data` | property; dict payload. |
| `EventObject.dt_to_list(dt, start=True)` | Convert datetime to Apple list. |
| `EventObject.add_invitees(_invitees=None)` | Add invitees. |
| `EventObject.add_alarm_at_time()` | Add absolute-time alarm. |
| `EventObject.add_alarm_before(minutes=0, hours=0, days=0, weeks=0)` | Add relative alarm before event. |
| `EventObject.get(var)` | Field getter. |
| `CalendarObject` | dataclass fields `title='Untitled'`, `guid=''`, `share_type=None`, `symbolic_color='__custom__'`, `supported_type='Event'`, `object_type='personal'`, `share_title=''`, `shared_url=''`, `color=''`, `order=7`, `extended_details_are_included=True`, `read_only=False`, `enabled=True`, many optional sharing/notification/publication fields, `is_default`, `is_family`, `etag`, `ctag`. |
| `CalendarObject.gen_random_color()` | Generate color. |
| `CalendarObject.request_data` | property; dict payload. |
| `CalendarService(service_root, session, params)` | Calendar API service. |
| `CalendarService.default_params` | property. |
| `CalendarService.obj_from_dict(obj, _dict)` | Map payload dict to dataclass object. |
| `CalendarService.get_ctag(guid)` | Calendar ctag lookup. |
| `CalendarService.refresh_client(from_dt=None, to_dt=None)` | Refreshes calendar/event state. |
| `CalendarService.get_calendars(as_objs=False)` | Return raw calendars or `CalendarObject` objects. |
| `CalendarService.add_calendar(calendar)` | Add `CalendarObject`. |
| `CalendarService.remove_calendar(cal_guid)` | Delete calendar by guid. |
| `CalendarService.get_events(from_dt=None, to_dt=None, period='month', as_objs=False)` | Return raw events or `EventObject` objects. |
| `CalendarService.get_event_detail(pguid, guid, as_obj=False)` | Event detail. |
| `CalendarService.add_event(event)` | Add/update event. |
| `CalendarService.remove_event(event)` | Delete event. |

### Contacts service

| Class/member | Surface |
|---|---|
| `ContactsService(service_root, session, params)` | Contacts service. |
| `ContactsService.refresh_client()` | Refresh contacts payload. |
| `ContactsService.all` | property; all contacts. |
| `ContactsService.me` | property; `MeCard`. |
| `MeCard(data)` | Account me-card wrapper. |
| `MeCard.first_name`, `last_name`, `photo`, `raw_data` | properties. |

### iCloud Drive service

| Class/member | Surface |
|---|---|
| `DriveService(service_root, document_root, session, params)` | iCloud Drive service. |
| `DriveService.get_node_data(drivewsid, share_id=None)` | Fetch node metadata. |
| `DriveService.get_file(file_id, zone='com.apple.CloudDocs', **kwargs)` | Fetch file response. |
| `DriveService.get_app_data()` | Fetch iCloud Drive app data. |
| `DriveService.send_file(folder_id, file_object, zone='com.apple.CloudDocs', **kwargs)` | Upload file object. |
| `DriveService.create_folders(parent, name)` | Create folder. |
| `DriveService.delete_items(node_id, etag)` | Delete item. |
| `DriveService.rename_items(node_id, etag, name)` | Rename item. |
| `DriveService.move_nodes_to_node(nodes, destination)` | Move nodes to node. |
| `DriveService.move_items_to_trash(node_id, etag)` | Trash item. |
| `DriveService.recover_items_from_trash(node_id, etag)` | Recover trashed item. |
| `DriveService.delete_forever_from_trash(node_id, etag)` | Permanently delete trashed item. |
| `DriveService.root` | property; root `DriveNode`. |
| `DriveService.trash` | property; trash `DriveNode`. |
| `DriveService.refresh_root()` / `refresh_trash()` | Refresh node roots. |
| `DriveService.__getitem__(key)` | Root child lookup by name. |
| `DriveNode(conn, data)` | One iCloud Drive node. Constants: `TYPE_UNKNOWN='unknown'`, `TYPE_TRASH='trash'`, `NAME_ROOT='root'`, `NAME_UNKNOWN='<UNKNOWN>'`. |
| `DriveNode.name`, `type`, `size`, `date_changed`, `date_modified`, `date_last_open` | properties. |
| `DriveNode.get_children(force=False)` | Fetch child nodes. |
| `DriveNode.remove(child)` | Remove child from local cache. |
| `DriveNode.open(**kwargs)` | Return file response; pass `stream=True` for streaming download. |
| `DriveNode.upload(file_object, **kwargs)` | Upload into node. |
| `DriveNode.dir()` | List child names. |
| `DriveNode.mkdir(folder)` | Create child folder. |
| `DriveNode.rename(name)` | Rename node. |
| `DriveNode.move_to_trash()` / `delete()` | Move to trash / delete. |
| `DriveNode.recover()` | Recover from trash. |
| `DriveNode.delete_forever()` | Permanently delete from trash. |
| `DriveNode.get(name)` / `__getitem__(key)` | Child lookup. |

### Legacy Ubiquity file service

| Class/member | Surface |
|---|---|
| `UbiquityService(service_root, session, params)` | Legacy pre-iCloud-Drive file service. |
| `UbiquityService.root` | property. |
| `UbiquityService.get_node_url(node_id, variant='item')` | Node endpoint URL. |
| `UbiquityService.get_node(node_id)` | Fetch node. |
| `UbiquityService.get_children(node_id)` | Fetch children. |
| `UbiquityService.get_file(node_id, **kwargs)` | Fetch file response. |
| `UbiquityService.__getitem__(key)` | Root child lookup. |
| `UbiquityNode(conn, data)` | Legacy node wrapper. |
| `UbiquityNode.item_id`, `name`, `type`, `size`, `modified` | properties. |
| `UbiquityNode.open(**kwargs)` | File response. |
| `UbiquityNode.get_children()` / `dir()` | Children. |
| `UbiquityNode.get(name)` / `__getitem__(key)` | Child lookup. |

### Photos service

| Class/member | Surface |
|---|---|
| `AlbumTypeEnum` | `ALBUM=0`, `FOLDER=3`, `SMART_ALBUM=6`. |
| `SmartAlbumEnum` | `ALL_PHOTOS='Library'`, `BURSTS='Bursts'`, `FAVORITES='Favorites'`, `HIDDEN='Hidden'`, `LIVE='Live'`, `PANORAMAS='Panoramas'`, `RECENTLY_DELETED='Recently Deleted'`, `SCREENSHOTS='Screenshots'`, `SLO_MO='Slo-mo'`, `TIME_LAPSE='Time-lapse'`, `VIDEOS='Videos'`. |
| `DirectionEnum` | `ASCENDING`, `DESCENDING`. |
| `ListTypeEnum` | `DEFAULT`, `DELETED`, `HIDDEN`, `SMART_ALBUM`, `STACK`, `CONTAINER`, `SHARED_STREAM` values map to CloudKit record-list names. |
| `ObjectTypeEnum` | `ALL`, `BURST`, `DELETED`, `FAVORITE`, `HIDDEN`, `LIVE`, `PANORAMA`, `SCREENSHOT`, `SLOMO`, `TIMELAPSE`, `VIDEO`, `CONTAINER` values map to CloudKit object types. |
| `AlbumContainer(albums=None)` | Iterable album collection. Methods `__len__()`, `__getitem__(key)`, `__iter__()`, `find(name)`, `get(key, default=None)`, `append(album)`, `index(idx)`. |
| `BasePhotoLibrary(service, asset_type, upload_url=None)` | Abstract library. Properties/methods `albums`, `parse_asset_response(response)`. |
| `PhotoLibrary(service, zone_id, upload_url=None)` | Main private photo library. Constants `SMART_ALBUMS`; methods `create_album(name, album_type=AlbumTypeEnum.ALBUM)`, `upload_file(path)`; property `all`. |
| `PhotoStreamLibrary(service, shared_streams_url)` | Shared stream library. |
| `PhotosService(service_root, session, params, upload_url, shared_streams_url)` | Photos service. Properties `libraries`, `all`, `albums`, `shared_streams`; method `create_album(name, album_type=AlbumTypeEnum.ALBUM)`. |
| `BasePhotoAlbum(library, name, list_type, page_size=100, direction=DirectionEnum.ASCENDING)` | Iterable album. Properties `fullname`, `page_size`, `service`, `title`, `name`, `photos`, `id`; setter `name=value`; methods `photo(index)`, `rename(value)`, `delete()`, `__iter__()`, `__len__()`, `get(key)`, `__getitem__(key)`. |
| `PhotoAlbum(...)` | User album. Methods/properties `id`, `fullname`, `rename(value)`, `delete()`, `add_photo(photo)`, `upload(path)`. |
| `PhotoAlbumFolder(PhotoAlbum)` | Folder subclass; `upload(path)` returns no asset. |
| `SmartPhotoAlbum(PhotoAlbum)` | Smart album subclass; properties `id`, `fullname`; `upload(path)` returns no asset. |
| `SharedPhotoStreamAlbum(...)` | Shared album. Properties `id`, `fullname`, `sharing_type`, `allow_contributions`, `is_public`, `is_web_upload_supported`, `public_url`; methods `delete()`, `rename(value)`. |
| `PhotoAsset(service, master_record, asset_record)` | Asset wrapper. Constants `ITEM_TYPES`, `FILE_TYPE_EXTENSIONS`, `PHOTO_VERSION_LOOKUP`, `VIDEO_VERSION_LOOKUP`. |
| `PhotoAsset.id`, `filename`, `size`, `created`, `asset_date`, `added_date`, `dimensions`, `item_type`, `is_live_photo`, `versions` | properties. |
| `PhotoAsset.download_url(version='original')` | Resolve version URL. Versions include `original`, `medium`, `thumb`, `original_video`, `medium_video`, `thumb_video` when present. |
| `PhotoAsset.download(version='original', **kwargs)` | Return download response. |
| `PhotoAsset.delete()` | Delete asset. |
| `PhotoStreamAsset(PhotoAsset)` | Shared-stream asset; properties `like_count`, `liked`. |

### Hide My Email service

| Class/member | Surface |
|---|---|
| `HideMyEmailService(service_root, session, params)` | Hide My Email aliases. |
| `HideMyEmailService.generate()` | Generate alias candidate. |
| `HideMyEmailService.reserve(email, label, note='Generated')` | Reserve alias. |
| `HideMyEmailService.__len__()` / `__iter__()` | Count/iterate aliases. |
| `HideMyEmailService.__getitem__(anonymous_id)` | Lookup alias. |
| `HideMyEmailService.update_metadata(anonymous_id, label, note=None)` | Update label/note. |
| `HideMyEmailService.delete(anonymous_id)` | Delete alias. |
| `HideMyEmailService.deactivate(anonymous_id)` | Deactivate alias. |
| `HideMyEmailService.reactivate(anonymous_id)` | Reactivate alias. |

### Reminders service

| Class/member | Surface |
|---|---|
| `RemindersService(service_root, session, params, *, cloudkit_validation_extra=None)` | CloudKit Reminders service. Constants `_CONTAINER='com.apple.reminders'`, `_ENV='production'`, `_SCOPE='private'`. |
| `RemindersService.lists()` | Return `RemindersList` records. |
| `RemindersService.reminders(list_id=None)` | Return reminder records, optionally one list. |
| `RemindersService.sync_cursor()` | Return current sync cursor. |
| `RemindersService.iter_changes(since=None)` | Yield `ReminderChangeEvent` records after cursor. |
| `RemindersService.get(reminder_id)` | Fetch one `Reminder`. |
| `RemindersService.create(list_id, title, desc='', completed=False, due_date=None, priority=0, flagged=False, all_day=False, time_zone=None, parent_reminder_id=None)` | Create reminder. |
| `RemindersService.update(reminder)` | Persist mutated `Reminder`. |
| `RemindersService.delete(reminder)` | Delete reminder. |
| `RemindersService.add_location_trigger(reminder, title='', address='', latitude=0.0, longitude=0.0, radius=100.0, proximity=Proximity.ARRIVING)` | Add geofence alarm. |
| `RemindersService.create_hashtag(reminder, name)` | Create hashtag. |
| `RemindersService.update_hashtag(hashtag, name)` | Rename hashtag record. |
| `RemindersService.delete_hashtag(reminder, hashtag)` | Delete hashtag for reminder. |
| `RemindersService.create_url_attachment(reminder, url, uti='public.url')` | Add URL attachment. |
| `RemindersService.update_attachment(attachment, *, url=None, uti=None, filename=None, file_size=None, width=None, height=None)` | Update attachment metadata. |
| `RemindersService.delete_attachment(reminder, attachment)` | Delete attachment. |
| `RemindersService.create_recurrence_rule(reminder, *, frequency=RecurrenceFrequency.DAILY, interval=1, occurrence_count=0, first_day_of_week=0)` | Add recurrence rule. |
| `RemindersService.update_recurrence_rule(recurrence_rule, *, frequency=None, interval=None, occurrence_count=None, first_day_of_week=None)` | Update recurrence rule. |
| `RemindersService.delete_recurrence_rule(reminder, recurrence_rule)` | Delete recurrence rule. |
| `RemindersService.list_reminders(list_id, include_completed=False, results_limit=200)` | Compound query result with related alarms/triggers/attachments/tags/recurrence. |
| `RemindersService.alarms_for(reminder)` | Related alarms. |
| `RemindersService.tags_for(reminder)` | Related hashtags. |
| `RemindersService.attachments_for(reminder)` | Related attachments. |
| `RemindersService.recurrence_rules_for(reminder)` | Related recurrence rules. |
| `CloudKitRemindersClient(base_url, session, base_params, *, validation_extra=None)` | Low-level CloudKit client. Methods `lookup(record_names, zone_id)`, `query(query=..., zone_id=..., desired_keys=None, results_limit=None, continuation=None)`, `current_sync_token(zone_id=..., record_type='reminderList')`, `changes(zone_req=..., results_limit=None)`, `modify(operations, zone_id, atomic=None)`, `download_asset_bytes(url)`. |

Reminders domain models:

| Model | Fields / values |
|---|---|
| `Reminder` | `id`, `list_id`, `title`, `desc=''`, `completed=False`, `completed_date=None`, `due_date=None`, `start_date=None`, `priority=0`, `flagged=False`, `all_day=False`, `deleted=False`, `time_zone=None`, `alarm_ids=[]`, `hashtag_ids=[]`, `attachment_ids=[]`, `recurrence_rule_ids=[]`, `parent_reminder_id=None`, `created=None`, `modified=None`, `record_change_tag=None`. |
| `ReminderChangeEvent` | `type: Literal['updated','deleted']`, `reminder_id`, `reminder=None`. |
| `RemindersList` | `id`, `title`, `color=None`, `count=0`, `badge_emblem=None`, `sorting_style=None`, `is_group=False`, `reminder_ids=[]`, `guid=None`, `record_change_tag=None`. |
| `Alarm` | `id`, `alarm_uid`, `reminder_id`, `trigger_id`, `record_change_tag=None`. |
| `Proximity` | `ARRIVING=1`, `LEAVING=2`. |
| `LocationTrigger` | `id`, `alarm_id`, `title=''`, `address=''`, `latitude=0.0`, `longitude=0.0`, `radius>=0`, `proximity=Proximity.ARRIVING`, `location_uid=''`, `record_change_tag=None`. |
| `URLAttachment` | `id`, `reminder_id`, `url=''`, `uti='public.url'`, `record_change_tag=None`. |
| `ImageAttachment` | `id`, `reminder_id`, `file_asset_url=''`, `filename=''`, `file_size>=0`, `width>=0`, `height>=0`, `uti='public.jpeg'`, `record_change_tag=None`. |
| `Hashtag` | `id`, `name`, `reminder_id`, `created=None`, `record_change_tag=None`. |
| `RecurrenceFrequency` | `DAILY=1`, `WEEKLY=2`, `MONTHLY=3`, `YEARLY=4`. |
| `RecurrenceRule` | `id`, `reminder_id`, `frequency=DAILY`, `interval>=1`, `occurrence_count>=0` (`0` means infinite), `first_day_of_week=0..6`, `record_change_tag=None`. |
| `AlarmWithTrigger` | `alarm`, `trigger=None`. |
| `ListRemindersResult` | `reminders`, `alarms`, `triggers`, `attachments`, `hashtags`, `recurrence_rules`. |

### Notes service

| Class/member | Surface |
|---|---|
| `NotesService(service_root, session, params, *, cloudkit_validation_extra=None)` | CloudKit Notes service. Constants `_CONTAINER='com.apple.notes'`, `_ENV='production'`, `_SCOPE='private'`. |
| `NotesService.recents(limit=50)` | Recent notes. |
| `NotesService.recents_in_folder(folder_id, limit=20)` | Recent notes in folder. |
| `NotesService.iter_all(since=None)` | Iterate all note summaries from optional sync cursor. |
| `NotesService.folders()` | Note folders. |
| `NotesService.in_folder(folder_id, limit=None)` | Notes in folder. |
| `NotesService.get(note_id, *, with_attachments=False)` | Full note; raises `NoteNotFound` or `NoteLockedError`. |
| `NotesService.sync_cursor()` | Current sync cursor. |
| `NotesService.export_note(note_id, output_dir, **config_kwargs)` | Export note to disk. |
| `NotesService.render_note(note_id, **config_kwargs)` | Render note HTML string. |
| `NotesService.iter_changes(since=None)` | Incremental note changes. |
| `NotesService.raw` | property; raw lower-level Notes service/client. |
| `CloudKitNotesClient(base_url, session, base_params, *, validation_extra=None, timeout=DEFAULT_TIMEOUT)` | Low-level CloudKit client. Methods `query(query=..., zone_id=..., desired_keys=None, results_limit=None, continuation=None)`, `lookup(record_names, desired_keys=None)`, `changes(zone_req=...)`, `download_asset_stream(url, chunk_size=65536)`, `download_asset_to(url, directory)`, `current_sync_token(zone_name)`. |

Notes data models:

| Model | Fields / methods |
|---|---|
| `NoteSummary` | `id`, `title`, `snippet`, `modified_at`, `folder_id`, `folder_name`, `is_deleted`, `is_locked`. |
| `Attachment` | `id`, `filename`, `uti`, `size`, `download_url`, `preview_url`, `thumbnail_url`; methods `save_to(directory, *, service)`, `stream(*, service, chunk_size=65536)`. |
| `Note` | Inherits `NoteSummary`; fields `text`, `html=None`, `attachments`; computed property `has_attachments`. |
| `NoteFolder` | `id`, `name`, `has_subfolders`, `count`. |
| `ChangeEvent` | `type: Literal['updated','deleted']`, `note`. |

Notes rendering/export knobs used by CLI and `**config_kwargs`:

| Name | Values |
|---|---|
| `PreviewAppearance` | `light`, `dark`. |
| `ExportMode` | `archival`, `lightweight`. |
| `full_page` | `True` for full HTML page; `False` for fragment. |
| `pdf_height` | Embedded PDF height in pixels. |
| `assets_dir` | Asset directory for archival export. |

## Setup & auth

Install:

```bash
python -m pip install pyicloud
```

CLI-only isolated install:

```bash
pipx install pyicloud
```

Current runtime dependencies include `certifi`, `click`, `cryptography`, `fido2`, `keyring`, `keyrings.alt`, `protobuf`, `pydantic`, `requests`, `rich`, `srp`, `tinyhtml`, `typer`, and `tzlocal`.

Credentials and auth inputs:

| Name | Source / storage |
|---|---|
| Apple ID username | CLI `--username`; Python `PyiCloudService(apple_id=...)`; local account index for later discovery. |
| Apple ID password | CLI `--password`, interactive prompt, or system keyring. Python constructor `password=...` or keyring fallback. |
| Keyring service name | `pyicloud://icloud-password`; item username is the Apple ID. |
| HSA2 / 2FA code | Apple trusted device prompt or SMS; requested by `request_2fa_code()` / CLI login flow. |
| Legacy 2SA device code | `trusted_devices`, `send_verification_code(device)`, `validate_verification_code(device, code)`. |
| FIDO2 security key | Local HID security key discovered by `fido2_devices`; completed via `confirm_security_key()`. |
| China mainland endpoints | CLI `--china-mainland`, Python `china_mainland=True`, or environment `icloud_china=1`. |
| iCloud updated terms | CLI `--accept-terms`, Python `accept_terms=True`. |

State paths:

| State | Default path / behavior |
|---|---|
| Session root | `resolve_cookie_directory(None)` -> `<tempdir>/pyicloud/<os-user>`; override with CLI `--session-dir` or Python `cookie_directory`. |
| Cookie jar | `<session-root>/<sanitized-apple-id>.cookiejar`. |
| Session metadata | `<session-root>/<sanitized-apple-id>.session`. |
| CLI account index | `<session-root>/accounts.json`; lock file `<session-root>/accounts.json.lock` when platform supports file locking. |
| Password | OS keyring under service `pyicloud://icloud-password`; delete with `icloud auth keyring delete --username <apple-id>`. |

Network and platform notes:

| Topic | Detail |
|---|---|
| TLS | `verify=True` by default in Python service; CLI `--no-verify-ssl` disables verification via a context manager. |
| Proxies | CLI `--http-proxy` / `--https-proxy`; Python callers can use requests environment/proxy behavior or session customization. |
| MFA prompts | `--non-interactive` cannot complete 2FA/2SA prompts unless cached/trusted session already exists. |
| Keyring backend | Depends on OS keyring provider; `keyrings.alt` is installed as fallback. |
| Session trust | Cached cookies reduce repeated Apple sign-in emails/prompts; `trust_session()` persists trusted-browser state when Apple accepts it. |

## Common workflows

Authenticate CLI account and complete 2FA interactively:

```bash
icloud auth login --username "$APPLE_ID" --accept-terms
```

Persists session/cookies, updates `accounts.json`, and stores password in keyring when entered via prompt.

Check Find My devices and locations as JSON:

```bash
icloud devices list --username "$APPLE_ID" --locate --with-family --format json
```

Prints normalized device records, including location when Apple returns it.

Authenticate from Python and handle HSA2 code flow:

```python
from pyicloud import PyiCloudService

api = PyiCloudService("apple-id@example.com", "APPLE_ID_PASSWORD", accept_terms=True)
if api.requires_2fa:
    api.request_2fa_code()
    api.validate_2fa_code(input("2FA code: "))
```

Creates a trusted persisted session when Apple accepts the code.

Download an iCloud Drive file from Python:

```python
from pathlib import Path
from pyicloud import PyiCloudService

api = PyiCloudService("apple-id@example.com", "APPLE_ID_PASSWORD")
node = api.drive["Documents"]["example.txt"]
response = node.open(stream=True)
Path("example.txt").write_bytes(response.content)
```

Reads the selected Drive node and writes the file locally.

Export an Apple Note with archival assets:

```bash
icloud notes export NOTE_ID --username "$APPLE_ID" --output-dir ./notes-export --export-mode archival --assets-dir ./notes-assets
```

Writes HTML output and downloads referenced assets when available.

Download a specific photo version from the CLI:

```bash
icloud photos download PHOTO_ID --username "$APPLE_ID" --version original --output ./photo-original
```

Writes the requested asset version to the output path.

## Error handling

| Symptom | Likely cause | Fix |
|---|---|---|
| `No password set` | Python auth attempted without constructor password and without keyring password. | Pass `password=...`, run `icloud auth login --username <apple-id>`, or store the password with keyring. |
| `Invalid email/password combination.` | Bad Apple ID password, stale keyring password, or Apple rejected SRP credentials. | Delete stale keyring entry with `icloud auth keyring delete --username <apple-id>`, then run `icloud auth login --username <apple-id>`. |
| `Invalid authentication token.` | Cached session token is no longer valid. | Run `icloud auth logout --username <apple-id>` and then `icloud auth login --username <apple-id>`. |
| `Missing X-APPLE-WEBAUTH-TOKEN cookie` | Session metadata exists but required auth cookie is missing. | Clear session files with `icloud auth logout --username <apple-id>` and log in again. |
| `You must accept the updated terms of service to continue. Set --accept-terms to accept them.` | Apple requires updated iCloud web terms. | Add CLI `--accept-terms` or Python `accept_terms=True`. |
| `Could not get terms version` | Apple terms endpoint did not return an iCloud terms version. | Retry later; verify Apple ID can accept terms in iCloud web UI. |
| `2FA authentication required for account: <apple-id> (HSA2)` | HSA2 challenge is pending. | Run interactive `icloud auth login`, or call `request_2fa_code()` plus `validate_2fa_code(code)`, or complete `confirm_security_key()`. |
| `Two-factor authentication is required, but interactive prompts are disabled.` | CLI command used `--non-interactive` without a trusted session. | Authenticate once interactively or remove `--non-interactive`. |
| `This 2FA challenge requires a security key. Connect one and retry.` | Apple requires FIDO2/WebAuthn security key. | Connect registered security key and rerun login, or use Python `fido2_devices` / `confirm_security_key()`. |
| `Two-factor authentication requires a trusted phone number, but none was returned.` | SMS path selected but Apple did not return a usable trusted phone number. | Use trusted-device prompt or security key; verify trusted numbers in Apple ID settings. |
| `Failed to request the 2FA trusted-device prompt.` | Apple trusted-device bridge prompt request failed. | Retry login; use SMS or security key path if available. |
| `Failed to request the 2FA SMS code.` | Apple SMS code request failed. | Retry; verify trusted phone numbers; complete login from iCloud.com if Apple blocks automation. |
| `Failed to verify the 2FA trusted-device code.` | Apple rejected trusted-device code verification. | Request a new code and retry; clear session if repeated. |
| `Failed to verify the 2FA code.` | All CLI validation attempts failed. | Request a fresh code; ensure code is for the same Apple ID and current login attempt. |
| `Two-step authentication required for account: <apple-id>` | Legacy 2SA flow is required. | Use `trusted_devices`, `send_verification_code(device)`, and `validate_verification_code(device, code)`; CLI login handles this interactively. |
| `Failed to send the 2SA verification code.` | Legacy trusted device did not accept code delivery. | Select another trusted device or retry after confirming Apple ID settings. |
| `Failed to verify the 2SA code.` | Legacy 2SA code was wrong or expired. | Request a new legacy verification code and retry. |
| `No local accounts were found; pass --username to bootstrap one.` | CLI account index/session root has no discoverable account. | Pass `--username <apple-id>` or use the same `--session-dir` used during login. |
| `Multiple local accounts were found; pass --username to choose one.` | More than one indexed account exists. | Pass `--username <apple-id>`. |
| `You are not logged into any iCloud accounts. To log in, run: icloud auth login --username ` | CLI command needs an authenticated session but none is active. | Run `icloud auth login --username <apple-id>`. |
| `Sound is not available for this device` | Find My device payload says sound action is unavailable. | Check `AppleDevice.sound_available`; choose another device/action. |
| `Message is not available for this device` | Find My device payload says display-message action is unavailable. | Check `AppleDevice.messaging_available`; choose another device/action. |
| `Lost mode is not available for this device` | Find My device payload says lost-mode action is unavailable. | Check `AppleDevice.lost_mode_available`; choose another device/action. |
| `Find My iPhone erase token not available` | Erase flow could not retrieve required erase token. | Refresh device manager and retry; verify Apple allows erase in Find My web UI. |
| `Erase is not available for this device` | Find My device payload says erase is unavailable. | Check `AppleDevice.erase_available`; avoid erase command for that device. |
| `Path not found: <path>` | CLI Drive path resolver could not find a node. | Check exact slash-separated path; add `--trash` if resolving from trash root. |
| `Only files can be downloaded.` | `icloud drive download` target is a folder or non-file node. | Use `icloud drive list PATH` and select a file. |
| `Root not found` | Drive root node was not present in Apple payload. | Reauthenticate and retry; verify iCloud Drive is enabled. |
| `Trash not found` | Drive trash root was not present in Apple payload. | Refresh trash with `api.drive.refresh_trash()` or avoid trash operations. |
| `'NAME' does not appear to be in the Trash.` | `recover()` or `delete_forever()` called on a non-trash node. | Use `api.drive.trash[...]` before trash recovery/permanent deletion. |
| `No album named '<album>' was found.` | CLI photo album selector did not match an album name. | Run `icloud photos albums --format json` and use the exact name. |
| `No photo matched '<photo_id>'.` | Photo id was not in current searchable album/all-photo set. | List photos again and use the returned asset id. |
| `No data was returned for that photo version.` | Requested photo version key is absent for that asset. | Inspect `PhotoAsset.versions`; use an available version. |
| `Failed to create album` | Photos CloudKit album create failed. | Retry after reauth; verify Photos service is active. |
| `Failed to add photo to album` | Photos upload succeeded but album relation creation failed. | Retry `album.add_photo(photo)`; verify album is not smart/shared read-only. |
| `Note not found: <note_id>` | Notes lookup did not find the note id. | Use `icloud notes recent`, `icloud notes list`, or `icloud notes search` to get a current id. |
| `Note '<title-or-id>' is locked and cannot be read.` | Apple Note is passphrase locked. | Unlock/read it manually in Apple Notes; pyicloud cannot retrieve locked content. |
| `Attachment does not expose a download URL.` | Notes attachment metadata lacks downloadable URL. | Skip that attachment or fetch note with attachments again later. |
| `HTTP 429: rate limited` | Notes CloudKit endpoint throttled requests. | Back off; respect `retry_after` when provided by `NotesRateLimited`. |
| `Pass --title or --title-contains to search notes.` | CLI notes search called without a search criterion. | Add `--title` or `--title-contains`. |
| `HTTP <code>: unauthorized` | Notes or Reminders CloudKit call returned 401/403. | Reauthenticate; confirm service is enabled and session is trusted. |
| `No reminder updates were requested.` | `icloud reminders update` supplied no mutable fields. | Pass at least one update option such as `--title`, `--completed`, or `--clear-due-date`. |
| `No attachment updates were requested.` | Reminder attachment update supplied no mutable fields. | Pass at least one of `--url`, `--uti`, `--filename`, `--file-size`, `--width`, `--height`. |
| `No recurrence updates were requested.` | Recurrence update supplied no mutable fields. | Pass one of `--frequency`, `--interval`, `--occurrence-count`, `--first-day-of-week`. |

## Traps

_Append-only. Date-stamped. Filled by the operator via the `/lesson` slash command when something bites._

## Lessons

_Append-only. Date-stamped. Filled by the operator via the `/lesson` slash command for behaviors learned that aren't in upstream docs._
