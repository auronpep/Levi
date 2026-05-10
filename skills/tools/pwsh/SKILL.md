---
name: tool-pwsh
description: Load when working with pwsh, PowerShell 7 CLI, ps1 script execution, encoded commands, execution policy, profile startup, or SSH subsystem mode. Covers full pwsh CLI surface, setup, workflows, and error handling.
triggers:
  bash:
    - pwsh
    - pwsh.exe
    - pwsh-preview
    - Microsoft.PowerShell
---

# pwsh

## What it is

`pwsh` is the PowerShell 7+ command-line executable (`pwsh` on Unix-like systems, `pwsh.exe` on Windows). It runs interactive PowerShell sessions, executes `.ps1` scripts, evaluates inline PowerShell code, accepts CLIXML or text stdin/stdout, and starts remoting/debug IPC host modes. Reach for it for cross-platform automation, structured-object shell work, CI scripts, Windows administration from PowerShell 7, and launchable PowerShell snippets from another shell; alternatives include Windows PowerShell `powershell.exe`, Bash/zsh/fish, `cmd.exe`, Python, and platform-specific CLIs.

## Capability surface

No subcommands. Surface is process invocation parameters plus the PowerShell startup/configuration behavior they select. This does not enumerate every PowerShell cmdlet, provider, language keyword, or module.

### Invocation

```text
pwsh[.exe] [startup-parameters]
pwsh[.exe] [[-File] <filePath> [args]]
pwsh[.exe] [-Command {- | <script-block> [-args <arg-array>] | <string> [<CommandParameters>]}]
pwsh[.exe] [[-CommandWithArgs <string>] [<CommandParameters>]]
pwsh[.exe] -h | -Help | -? | /?
```

All CLI parameters are case-insensitive. Use `-` parameter prefixes. `/?` is accepted for help; forward-slash parameter forms are otherwise not the PowerShell-facing convention.

### Parameters

| Parameter | Aliases | Value / accepted values | Platform | Effect / notes |
|---|---:|---|---|---|
| `-File` | `-f` | `-` or `<filePath> [args]` | All | Runs a script file or reads commands from stdin when value is `-`. Default parameter when unnamed values are present. Must be last `pwsh` parameter; remaining tokens become script path and script arguments. On Windows PowerShell 7.2+, only `.ps1` files are accepted. |
| `-Command` | `-c` | `-`, `<script-block> [-args <arg-array>]`, or `<string> [<CommandParameters>]` | All | Executes PowerShell code, then exits unless `-NoExit` is present. Script block form is recognized only when the caller is another PowerShell host passing a `ScriptBlock`; other shells pass strings. If the value is a string, it must be the last `pwsh` parameter. |
| `-CommandWithArgs` | `-cwa` | `<string> [<CommandParameters>]` | All | Executes a command string and populates the `$args` automatic variable from following whitespace-delimited arguments. Added as experimental in 7.4; mainstream in PowerShell 7.5 preview line and later. |
| `-ConfigurationFile` | none | `<filePath>` | All | Applies a session configuration `.pssc` file to the new PowerShell session. |
| `-ConfigurationName` | `-config` | `<string>` | All | Runs the session in a registered configuration endpoint, including default remoting endpoints or custom role-capability endpoints. |
| `-CustomPipeName` | none | `<string>` | All | Creates an additional named IPC pipe for debugging and cross-process communication. Used with `Enter-PSHostProcess -CustomPipeName`. Introduced in PowerShell 6.2. |
| `-EncodedCommand` | `-e`, `-ec` | `<Base64EncodedCommand>` | All | Executes a Base64-encoded command. The decoded byte sequence must be UTF-16LE text. Use for complex nested quoting. |
| `-ExecutionPolicy` | `-ex`, `-ep` | `AllSigned`, `Bypass`, `Default`, `RemoteSigned`, `Restricted`, `Undefined`, `Unrestricted` | Windows only | Sets process-scope execution policy by writing `$Env:PSExecutionPolicyPreference` for the current session and child sessions. Does not persistently change policy. Ignored on non-Windows. |
| `-InputFormat` | `-inp`, `-if` | `Text`, `XML` | All | Selects input stream format. `Text` receives strings. `XML` receives serialized CLIXML. |
| `-Interactive` | `-i` | switch | All | Presents an interactive prompt. Inverse of `-NonInteractive`. |
| `-Login` | `-l` | switch | Linux, macOS | Starts `pwsh` as a login shell through `/bin/sh` login profile processing. Must be the first argument. No effect on Windows. Not supported as the WSL login shell. |
| `-MTA` | none | switch | Windows only | Starts PowerShell in a multi-threaded apartment. Errors on non-Windows. |
| `-NoExit` | `-noe` | switch | All | Leaves the session open after startup commands complete. |
| `-NoLogo` | `-nol` | switch | All | Suppresses the startup banner for interactive sessions. |
| `-NonInteractive` | `-noni` | switch | All | Disallows interactive prompts. Interactive features such as `Read-Host` or confirmation prompts become statement-terminating errors instead of hanging. Use for CI/CD, scheduled tasks, and hooks. |
| `-NoProfile` | `-nop` | switch | All | Skips all PowerShell profile scripts. Use when startup code must not affect automation. |
| `-NoProfileLoadTime` | none | switch | All | Suppresses the profile load-time message shown when profile loading exceeds 500 ms. |
| `-OutputFormat` | `-o`, `-of` | `Text`, `XML` | All | Selects process output format. `Text` emits formatted strings. `XML` emits serialized CLIXML; a parent PowerShell session receives deserialized objects. |
| `-SettingsFile` | `-settings` | `<filePath>` | All | Overrides the system-wide `$PSHOME/powershell.config.json` for this process. Not used by an endpoint selected through `-ConfigurationName`. |
| `-SSHServerMode` | `-sshs` | switch | All | Starts PowerShell as an SSH subsystem process from `sshd_config`. Not intended or supported for direct interactive use. |
| `-STA` | none | switch | Windows only | Starts PowerShell in a single-threaded apartment. Default on Windows. Errors on non-Windows. |
| `-Version` | `-v` | switch | All | Prints the executable version. Other parameters are ignored. |
| `-WindowStyle` | `-w` | `Normal`, `Minimized`, `Maximized`, `Hidden` | Windows only | Sets session window style. Errors on non-Windows. |
| `-WorkingDirectory` | `-wd`, `-wo` | `<directoryPath>` | All | Sets the initial working directory. Accepts valid PowerShell paths, including `~`. |
| `-Help` | `-h`, `-?`, `/?` | switch | All | Prints `pwsh` help. |

### `-File` execution semantics

| Case | Behavior |
|---|---|
| `pwsh -File ./script.ps1 arg1 arg2` | Runs `script.ps1` in the local scope of the new session. Functions and variables defined by the script remain available in that session if `-NoExit` keeps it open. |
| `pwsh ./script.ps1 arg1` | Equivalent default-parameter form when unnamed values are present. |
| `pwsh -File -` with redirected stdin | Reads PowerShell statements from stdin and executes them one at a time. |
| `pwsh -File -` without redirected stdin | Starts a normal interactive session. |
| Script switch parameters | Pass switches normally, for example `-All`; pass explicit switch booleans as `-All:$false`. |
| Native-shell variable expansion | The calling shell expands arguments before `pwsh` receives them. From `cmd.exe`, use `%windir%`; from PowerShell code passed to `-Command`, use `$Env:windir`. |
| Array-valued script parameters | Not supported reliably through native-executable argument passing. `pwsh -File` receives argv strings, not native PowerShell arrays. Prefer `-Command`, JSON input, repeated remaining arguments, or explicit parsing inside the script. |
| Exit code: normal completion | Process exits `0` unless the script calls `exit <n>` or a terminating error occurs. |
| Exit code: `exit <n>` | Process exit code is `<n>`. |
| Exit code: script-terminating error | Process exit code is `1`. |
| Exit code: `Ctrl+C` interruption | Process exit code is `0` for `-File`. |

### `-Command` execution semantics

| Case | Behavior |
|---|---|
| `pwsh -Command "Get-Date"` | Executes the string as PowerShell code. |
| `pwsh -Command { Get-Date }` from PowerShell | Parent PowerShell can pass a real script block. Results return to the parent as deserialized XML objects. |
| `pwsh -Command "& { Get-Date }"` from `cmd.exe` or POSIX shells | Use a command string and the call operator for script-block-style grouping. |
| `pwsh -Command -` with redirected stdin | Reads command text from stdin. Stdin redirection is required. |
| Command string order | If `-Command` receives a string, it must be the last `pwsh` parameter; following tokens are interpreted as part of the command string. |
| Output to parent PowerShell | Serialized/deserialized objects, not live objects. |
| Output to non-PowerShell shells | Strings, unless `-OutputFormat XML` emits CLIXML text. |
| Exit code: `$?` true | Process exit code `0`. |
| Exit code: `$?` false | Process exit code `1`. |
| Exit code: external command returns nonzero | Converted to `1` unless the command string explicitly ends with `exit $LASTEXITCODE`. |
| Exit code: terminating error or `Ctrl+C` | Process exit code `1`. |

### `-CommandWithArgs` execution semantics

| Case | Behavior |
|---|---|
| `pwsh -CommandWithArgs '$args' a b` | First token is command string; subsequent tokens populate `$args`. |
| Calling from `cmd.exe` | Use `cmd.exe` quoting rules; inner double quotes must be doubled or otherwise escaped. |
| Calling from Windows PowerShell / PowerShell | Use PowerShell quoting rules; nested command text usually needs single quotes around the outer string or escaped quotes. |

### Startup, profile, and configuration order

| Item | Behavior |
|---|---|
| Profiles | Loaded unless `-NoProfile` is present. Order: AllUsersAllHosts, AllUsersCurrentHost, CurrentUserAllHosts, CurrentUserCurrentHost. |
| Remote sessions | Profiles are not run automatically in remote sessions. |
| `$PROFILE` | Holds the CurrentUserCurrentHost profile path and note properties for other profile paths. |
| `powershell.config.json` | Loaded at startup from `$PSHOME` for AllUsers scope and from the user configuration directory for CurrentUser scope. Invalid JSON can prevent an interactive session from starting. |
| Settings precedence | On Windows, Group Policy settings override config files. AllUsers config overrides CurrentUser config. |
| `-SettingsFile` | Replaces the system-wide config file for the current process only. |
| `-ConfigurationName` | Selects an endpoint; `-SettingsFile` settings are not used by that endpoint. |

### `powershell.config.json` keys

| Key | Scope / platform | Purpose |
|---|---|---|
| `DisableImplicitWinCompat` | Windows | Disable Windows PowerShell Compatibility implicit module loading. |
| `WindowsPowerShellCompatibilityModuleDenyList` | Windows | Exclude listed modules from Windows PowerShell Compatibility. |
| `WindowsPowerShellCompatibilityNoClobberModuleList` | Windows | Prevent compatibility-loaded modules from clobbering listed module command names. |
| `ExperimentalFeatures` | All | Enable named experimental features at startup. |
| `LogChannels` | Linux, macOS | Configure PowerShell logging channels. |
| `LogIdentity` | Linux, macOS | Configure logging identity. |
| `LogKeywords` | Linux, macOS | Configure logging keywords. |
| `LogLevel` | Linux, macOS | Configure logging level. |
| `Microsoft.PowerShell:ExecutionPolicy` | Windows | Set PowerShell execution policy from config. |
| `PSModulePath` | All | Override scoped module paths; supports `%ENVVAR%` expansion, not PowerShell variable expansion. |
| `PowerShellPolicies.ExecutionPolicy` | Windows policy-compatible | Configure execution policy under the policy object. |
| `PowerShellPolicies.ConsoleSessionConfiguration` | All / policy-compatible | Configure console session configuration. |
| `PowerShellPolicies.ModuleLogging` | All / policy-compatible | Enable and configure module logging. |
| `PowerShellPolicies.ProtectedEventLogging` | All / policy-compatible | Configure protected event logging. |
| `PowerShellPolicies.ScriptBlockLogging` | All / policy-compatible | Configure script block logging and invocation logging. |
| `PowerShellPolicies.ScriptExecution` | All / policy-compatible | Configure script execution policy; takes precedence over root-level execution policy. |
| `PowerShellPolicies.Transcription` | All / policy-compatible | Configure transcript capture and output directory. |
| `PowerShellPolicies.UpdatableHelp` | All / policy-compatible | Configure default `Update-Help` source path. |
| `ConsoleSessionConfiguration` | All | Enable and name a default console session configuration. |
| `ModuleLogging` | All | Enable logging for specified modules. |
| `ProtectedEventLogging` | All | Encrypt log data with configured certificates. |
| `ScriptBlockLogging` | All | Log script input and optionally invocation start/stop events. |
| `ScriptExecution` | All | Configure script execution behavior. |
| `Transcription` | All | Enable transcript logging and configure headers/output directory. |
| `UpdatableHelp` | All | Set default source path for `Update-Help`. |

### SSH subsystem mode

| Item | Behavior |
|---|---|
| `pwsh -SSHServerMode` | Intended for `sshd_config` subsystem invocation only. |
| Default SSH subsystem name | `powershell` for PowerShell remoting over SSH unless another subsystem is requested. |
| Client cmdlets | Use `Enter-PSSession -HostName`, `New-PSSession -HostName`, or `Invoke-Command -HostName` for SSH-based remoting. |
| `-ConfigurationName` with SSH | Selects the SSH subsystem name as configured on the remote `sshd_config`. |

## Setup & auth

Install paths and commands:

| Platform | Primary install | Alternatives / notes |
|---|---|---|
| Windows | `winget install --id Microsoft.PowerShell --source winget` | `winget install --id Microsoft.PowerShell --source winget --installer-type wix` for MSI when available; `winget install --id Microsoft.PowerShell.Preview --source winget` for preview; Microsoft Store/MSIX; GitHub ZIP archive; `dotnet tool install --global PowerShell`. |
| macOS | Download the Microsoft `.pkg` from the PowerShell GitHub releases page and install it. | `sudo installer -allowUntrusted -pkg ./Downloads/powershell-<version>-osx-<arch>.pkg -target /` bypasses Gatekeeper checks for command-line package install; `dotnet tool install --global PowerShell`; binary `.tar.gz`; community Homebrew formula `brew install powershell`. |
| Ubuntu | Register Microsoft package repository, then `sudo apt-get install -y powershell`. | Universal `.deb` from GitHub releases; binary archive. |
| Debian | Register Microsoft package repository, then install package `powershell` with `apt`. | Universal `.deb`; binary archive. |
| RHEL | Register Microsoft package repository, then `sudo dnf install powershell -y`. | Universal `.rpm` from GitHub releases. |
| Alpine | Install listed runtime dependencies, extract PowerShell `linux-musl-x64.tar.gz` into `/opt/microsoft/powershell/7`, mark `pwsh` executable, and symlink it. | Alpine uses the tarball release path rather than a Microsoft repo package. |
| Linux generic | Use distro-specific Microsoft packages where supported. | Snap: `sudo snap install powershell --classic`; binary archive; .NET global tool. |

Credentials and auth:

| Area | Credential source |
|---|---|
| Local `pwsh` execution | No credentials required beyond the current OS user token. |
| Elevated Windows operations | Run host terminal elevated, or start a second `pwsh` through `Start-Process -Verb RunAs`. |
| SSH remoting | SSH keys, SSH agent, or password auth configured in the OS OpenSSH client/server. `pwsh -SSHServerMode` is the server-side subsystem process. |
| WSMan/WinRM remoting | Windows credentials, Kerberos/NTLM/CredSSP/certificate auth as configured by WinRM and PowerShell remoting. |
| PowerShell Gallery module install | Repository trust prompt; credentials usually not required for public packages. Publishing uses PowerShell Gallery API keys through module tooling, not the `pwsh` executable. |

State locations:

| State | Windows | Linux | macOS |
|---|---|---|---|
| Stable `$PSHOME` | `$Env:ProgramFiles\PowerShell\7` | `/opt/microsoft/powershell/7` | `/usr/local/microsoft/powershell/7` |
| Preview `$PSHOME` | `$Env:ProgramFiles\PowerShell\7-preview` | `/opt/microsoft/powershell/7-preview` | `/usr/local/microsoft/powershell/7-preview` |
| `pwsh` shim | Added to `%PATH%` by installer | commonly `/usr/bin/pwsh` for package/binary installs | `/usr/local/bin/pwsh` symlink |
| AllUsersAllHosts profile | `$PSHOME\Profile.ps1` | `$PSHOME/profile.ps1` | `$PSHOME/profile.ps1` |
| AllUsersCurrentHost profile | `$PSHOME\Microsoft.PowerShell_profile.ps1` | `$PSHOME/Microsoft.PowerShell_profile.ps1` | `$PSHOME/Microsoft.PowerShell_profile.ps1` |
| CurrentUserAllHosts profile | `$HOME\Documents\PowerShell\Profile.ps1` | `~/.config/powershell/profile.ps1` | `~/.config/powershell/profile.ps1` |
| CurrentUserCurrentHost profile | `$HOME\Documents\PowerShell\Microsoft.PowerShell_profile.ps1` | `~/.config/powershell/Microsoft.PowerShell_profile.ps1` | `~/.config/powershell/Microsoft.PowerShell_profile.ps1` |
| AllUsers config | `$PSHOME\powershell.config.json` | `$PSHOME/powershell.config.json` | `$PSHOME/powershell.config.json` |
| CurrentUser config | `$(Split-Path $PROFILE.CurrentUserCurrentHost)\powershell.config.json` | `~/.config/powershell/powershell.config.json` | `~/.config/powershell/powershell.config.json` |
| User modules | `$HOME\Documents\PowerShell\Modules` | `~/.local/share/powershell/Modules` | `~/.local/share/powershell/Modules` |
| Shared modules | `$Env:ProgramFiles\PowerShell\Modules` | `/usr/local/share/powershell/Modules` | `/usr/local/share/powershell/Modules` |
| Default modules | `$PSHOME\Modules` | `$PSHOME/Modules` | `$PSHOME/Modules` |
| PSReadLine history | `(Get-PSReadLineOption).HistorySavePath` | `~/.local/share/powershell/PSReadLine/ConsoleHost_history.txt` | `~/.local/share/powershell/PSReadLine/ConsoleHost_history.txt` |

Platform notes:

| Topic | Note |
|---|---|
| Windows PowerShell vs PowerShell 7 | `powershell.exe` is Windows PowerShell 5.1. `pwsh.exe` is PowerShell 7+. They install and update separately. |
| Windows MSIX / Store install | Single-user install. Store/MSIX instances do not support WSMan remoting into the Store-installed PowerShell. Changes to `$PSHOME` are blocked; all-users profiles and some all-users commands are unsupported. |
| Execution policy | Meaningful on Windows only. On non-Windows, execution policy is effectively unrestricted/bypass-like and cannot be changed. |
| Login shell | `pwsh -Login` must be first. Do not set `pwsh` as the WSL login shell. |
| Apartment state | `-STA`, `-MTA`, and `-WindowStyle` are Windows-only. |
| Docker | Current PowerShell container images are maintained by the .NET team; update base OS packages for production images. |

## Common workflows

Run a clean interactive shell:

```bash
pwsh -NoLogo -NoProfile
```

Starts an interactive session without banner or profile startup code.

Run a script in automation:

```bash
pwsh -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ./scripts/build.ps1 -Configuration Release
```

Runs `build.ps1` with literal script arguments; Windows applies the process-scope execution policy for this process only.

Run an inline command and preserve a native command exit code:

```bash
pwsh -NoLogo -NoProfile -Command "git status --short; exit \$LASTEXITCODE"
```

Executes PowerShell code, then returns the native command exit code instead of collapsing nonzero native exits to `1`.

Run PowerShell code from stdin:

```bash
cat ./script.ps1 | pwsh -NoLogo -NoProfile -Command -
```

Reads redirected stdin as PowerShell command text and exits after stdin is exhausted.

Use `-EncodedCommand` to avoid nested shell quoting:

```powershell
$command = 'Get-ChildItem "C:\Program Files"'
$bytes = [System.Text.Encoding]::Unicode.GetBytes($command)
$encoded = [Convert]::ToBase64String($bytes)
pwsh -NoProfile -EncodedCommand $encoded
```

Runs the UTF-16LE Base64-decoded command string.

## Error handling

| Symptom | Likely cause | Fix |
|---|---|---|
| `File .\Start-ActivityTracker.ps1 cannot be loaded. The file .\Start-ActivityTracker.ps1 is not digitally signed. The script will not execute on the system.` | Windows execution policy blocks unsigned script under `RemoteSigned` or `AllSigned`. | Review the script, then use `Unblock-File -Path .\Start-ActivityTracker.ps1`, sign the script, change policy at the intended scope, or use process-only `pwsh -ExecutionPolicy Bypass` for controlled automation. |
| `t.ps1: A parameter cannot be found that matches parameter name '1'.` | `pwsh -File t.ps1 -1` treats positional negative numbers as parameter-looking tokens. | Use a named parameter form such as `pwsh -File t.ps1 -p -1`, invoke from inside PowerShell, or pass data through stdin/JSON instead of positional negative argv. |
| `test.ps1: Cannot bind parameter because parameter 'x' is specified more than once. To provide multiple values to parameters that can accept multiple values, use the array syntax. For example, "-parameter value1,value2,value3".` | Repeated script parameter supplied through native-shell invocation; `pwsh -File` cannot pass true PowerShell arrays. | Redesign the script to accept remaining arguments or JSON, call through `-Command` with PowerShell syntax, or parse repeated values inside the script. |
| `Unhandled Exception: Newtonsoft.Json.JsonReaderException: Unexpected character encountered while parsing value: b. Path '', line 0, position 0.` | Invalid JSON in `powershell.config.json`; startup config parse fails. | Edit or remove the CurrentUser or `$PSHOME` `powershell.config.json` from an external shell/editor; validate JSON before restarting `pwsh`. |
| `Enter-PSSession: This parameter set requires WSMan, and no supported WSMan client library was found. WSMan is either not installed or unavailable for this system.` | WSMan remoting requested on a platform without a supported WSMan client library. | Use SSH remoting (`Enter-PSSession -HostName ...`) or install/configure the supported WSMan stack for the platform. |
| `The term 'pwsh' is not recognized as a name of a cmdlet, function, script file, or executable program.` | PowerShell 7 not installed, install path not on `PATH`, or current shell has stale environment after install. | Open a new terminal, verify the install path, add the `pwsh` directory to `PATH`, or call the full executable path. |

## Traps

_Append-only. Date-stamped. Filled by the operator via the `/lesson` slash command when something bites._

## Lessons

_Append-only. Date-stamped. Filled by the operator via the `/lesson` slash command for behaviors learned that aren't in upstream docs._
