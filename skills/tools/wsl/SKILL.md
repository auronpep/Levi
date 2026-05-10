---
name: tool-wsl
description: Load when working with wsl, Windows Subsystem for Linux, Linux distros on Windows, WSL2 networking, .wslconfig, wsl.conf, or distro import/export. Covers full WSL CLI/config surface, setup, errors, and lessons.
triggers:
  bash:
    - wsl
    - wsl.exe
    - wslconfig.exe
    - wslpath
    - wslinfo
    - wslg.exe
    - lxrun
---

# wsl

## What it is

**Assumption:** identifier "wsl" interpreted as Microsoft Windows Subsystem for Linux and its command-line tools: `wsl.exe`, `wsl`, `wslpath`, `wslinfo`, `wslg.exe`, and legacy `wslconfig.exe`/`lxrun`. WSL is a Windows system component and Store/MSIX package for running GNU/Linux distributions, command-line tools, services, and GUI applications on Windows without dual booting; reach for it when a Windows workflow needs Linux userspace, Linux package managers, WSL2 virtualization, distro import/export, Linux filesystem access, or Windows/Linux interop. Most-cited alternatives: native Linux, full virtual machines, Docker Desktop/containers, Cygwin, MSYS2, Git Bash.

## Capability surface

### Command families

| Command | Surface |
|---|---|
| `wsl.exe`, `wsl` | Main WSL launcher and manager. From inside a Linux distro shell, invoke as `wsl.exe`. |
| `wslg.exe` | WSLg launcher surface for GUI app integration. |
| `wslpath` | Path translation between Windows and WSL forms. |
| `wslinfo` | WSL package/networking/VM metadata helper. |
| `wslconfig.exe` | Deprecated administrative command. Replaced by `wsl.exe`. |
| `bash`, `lxrun` | Deprecated WSL-era launch/config commands. Replaced by `wsl.exe`. |
| `<DistributionName>.exe` | Store distro launcher, e.g. `ubuntu.exe`; supports distro-specific launcher commands such as `config --default-user`. Imported distros do not have launcher executables. |

### `wsl.exe` invocation

```powershell
wsl.exe [Argument] [Options...] [CommandLine]
wsl [Argument] [Options...] [CommandLine]
```

| Form | Meaning |
|---|---|
| `wsl` | Launch default shell in default distribution. |
| `wsl <CommandLine>` | Run command line in default distribution. |
| `wsl -- <CommandLine>` | Pass remaining command line as-is. |
| `wsl.exe` from Linux | Use when invoking WSL management commands from inside a WSL/Linux shell. |

### Arguments for running Linux binaries

| Argument / option | Accepted values | Meaning |
|---|---:|---|
| no command line | n/a | Launch default shell. |
| `--exec`, `-e <CommandLine>` | command line | Execute without using the default Linux shell. |
| `--shell-type <standard\|login\|none>` | `standard`, `login`, `none` | Execute command with requested shell type. |
| `--` | remainder | Pass remaining command line as-is. |
| `--cd <Directory>` | `~`, absolute Linux path beginning `/`, or absolute Windows path | Set current working directory. `~` means the Linux user's home. |
| `--distribution`, `-d <DistroName>` | installed distro name | Run specified distribution. |
| `--distribution-id <DistroGuid>` | distro GUID | Run specified distribution ID. |
| `--user`, `-u <UserName>` | Linux user in the distro | Run as specified user. |
| `--system` | n/a | Launch shell for the WSL system distribution. |

### Arguments for managing WSL

| Argument | Options / accepted values | Meaning |
|---|---|---|
| `--help` | n/a | Display usage information. |
| `--debug-shell` | n/a | Open WSL2 debug shell for diagnostics. Requires Administrator. May be disabled by policy. |
| `--install [Distro] [Options...]` | See `--install` table | Install WSL components and/or a Linux distribution. |
| `--manage <Distro> <Options...>` | See `--manage` table | Change distro-specific options. |
| `--mount <Disk>` | See `--mount` table | Attach and mount a physical or virtual disk in all WSL2 distributions. |
| `--set-default-version <Version>` | `1`, `2` | Set default WSL version for new distro installs. |
| `--shutdown [Options...]` | `--force` | Terminate all running distributions and the WSL2 lightweight utility VM. |
| `--status` | n/a | Show WSL status, default distribution, default version, kernel/package state. |
| `--unmount [Disk]` | optional disk path | Unmount and detach one disk, or all mounted disks if no disk argument is supplied. |
| `--uninstall` | n/a | Uninstall the WSL package from the machine. Does not unregister a distro; use `--unregister` for distro root filesystems. |
| `--update [Options...]` | `--pre-release`; Microsoft Learn also documents `--web-download` | Update the WSL package/kernel. |
| `--version`, `-v` | n/a | Display version information for WSL and components. |

### `wsl --install [Distro] [Options...]`

```powershell
wsl --install
wsl --install <Distro>
wsl --install --no-distribution
```

| Option | Accepted values | Meaning |
|---|---:|---|
| `[Distro]` | distro name from `wsl --list --online` | Install named distribution. Omitted installs default Ubuntu unless `--no-distribution` is used. |
| `--distribution`, `-d <Distro>` | distro name | Microsoft Learn-documented form for selecting a distro, especially on older Windows 10 builds. |
| `--enable-wsl1` | n/a | Enable WSL1 support by enabling the optional WSL component. |
| `--fixed-vhd` | n/a | Create a fixed-size disk for the distribution. |
| `--from-file <Path>` | local file path | Install distribution from a local file. |
| `--legacy` | n/a | Use legacy distribution manifest. |
| `--location <Location>` | Windows folder path | Set install path for distribution. |
| `--name <Name>` | distro registration name | Set installed distribution name. |
| `--no-distribution` | n/a | Install required optional components only; do not install a distribution. |
| `--no-launch`, `-n` | n/a | Do not launch distribution after install. |
| `--version <Version>` | `1`, `2` | WSL version for new distribution. |
| `--vhd-size <MemoryString>` | size string, e.g. `64GB`, `512MB` | Set VHD size for the distribution. |
| `--web-download` | n/a | Download from internet instead of Microsoft Store. |

### `wsl --manage <Distro> <Options...>`

```powershell
wsl --manage <Distro> --move <Location>
wsl --manage <Distro> --set-sparse <true|false>
wsl --manage <Distro> --set-default-user <Username>
wsl --manage <Distro> --resize <MemoryString>
```

| Option | Accepted values | Meaning |
|---|---:|---|
| `--move <Location>` | Windows folder path | Move distribution to a new location. |
| `--set-sparse`, `-s <true\|false>` | `true`, `false` | Set distro VHD sparse state to allow disk space to be automatically reclaimed. |
| `--allow-unsafe` | n/a | Upstream error text documents this as an override used with `--set-sparse true` when sparse VHD support is disabled because of data-corruption risk. Not listed in the main help inventory. |
| `--set-default-user <Username>` | Linux username | Set default user of distribution. |
| `--resize <MemoryString>` | size string, e.g. `256GB`, `1024MB` | Resize distribution disk. |

### `wsl --mount <Disk> [Options...]`

```powershell
wsl --mount <DiskPath>
wsl --mount <DiskPath> --partition <Index> --type <Type> --name <Name>
wsl --mount <VhdPath> --vhd --bare
```

| Option | Accepted values | Meaning |
|---|---:|---|
| `<Disk>` | physical disk path or VHD path with `--vhd` | Disk to attach. |
| `--vhd` | n/a | Treat `<Disk>` as a virtual hard disk. |
| `--bare` | n/a | Attach disk to WSL2 but do not mount it. |
| `--name <Name>` | mountpoint name without `/` | Mount disk using custom name under `/mnt/wsl/<Name>` unless automount root is changed. |
| `--type <Type>`, `-t <Type>` | filesystem type; default `ext4` | Filesystem to use when mounting. Detect with `blkid <BlockDevice>` inside WSL. |
| `--options <Options>`, `-o <Options>` | filesystem-specific options | Additional mount options. Generic options such as `ro`, `rw`, `noatime` are not supported by Microsoft Learn-documented `wsl --mount`; use filesystem-specific options. |
| `--partition <Index>` | partition number | Partition index to mount; defaults to whole disk. |

### `wsl --shutdown [Options...]`

| Option | Meaning |
|---|---|
| no option | Terminate all running distros and the WSL2 lightweight utility VM. Required for many `.wslconfig` and `/etc/wsl.conf` changes to apply. |
| `--force` | Terminate the WSL2 VM even if an operation is in progress. Can cause data loss. |

### `wsl --update [Options...]`

| Option | Meaning |
|---|---|
| no option | Update WSL package/kernel through the configured update channel. |
| `--pre-release` | Download a pre-release version if available. |
| `--web-download` | Microsoft Learn-documented option to download update from GitHub rather than Microsoft Store. Availability can vary by WSL package/version. |

### Arguments for managing distributions

| Argument | Options / accepted values | Meaning |
|---|---|---|
| `--export <Distro> <FileName> [Options]` | `--format <tar\|tar.gz\|tar.xz\|vhd>` | Export distribution. `FileName` can be `-` for stdout. |
| `--export <Distro> <FileName> --vhd` | WSL2 only | Microsoft Learn-documented form for exporting a `.vhdx` instead of tar. Current help inventory favors `--format vhd`. |
| `--import <Distro> <InstallLocation> <FileName> [Options]` | `--version <1\|2>`, `--vhd` | Import tar, stdin (`-`), or VHD/VHDX as a new distribution. With `--vhd`, WSL copies the VHD to install location. |
| `--import-in-place <Distro> <FileName>` | ext4 VHD/VHDX file | Register specified VHD file as a new distribution without copying. Virtual disk must be ext4. |
| `--list`, `-l [Options]` | `--all`, `--running`, `--quiet`, `-q`, `--verbose`, `-v`, `--online`, `-o` | List installed or installable distributions. |
| `--set-default`, `-s <Distro>` | installed distro | Set distribution as default. |
| `--set-version <Distro> <Version>` | `1`, `2` | Convert specified distribution between WSL1 and WSL2. Back up first for large/important distros. |
| `--terminate`, `-t <Distro>` | installed distro | Terminate specified running distribution. |
| `--unregister <Distro>` | installed distro | Unregister distribution and delete its root filesystem. Data loss is permanent unless exported/backed up. |

### `wsl --list`, `wsl -l` options

| Option | Meaning |
|---|---|
| no option | List registered distributions. |
| `--all` | Include distributions being installed or uninstalled. |
| `--running` | List only running distributions. |
| `--quiet`, `-q` | Print only distribution names. Useful for scripts. |
| `--verbose`, `-v` | Include state and WSL version. |
| `--online`, `-o` | List distributions available for `wsl --install`. |

### Distro launcher commands

```powershell
<DistributionName> config --default-user <Username>
```

| Command | Meaning |
|---|---|
| `<DistributionName> config --default-user <Username>` | Set default login user for a Store-installed distribution launcher, e.g. `ubuntu config --default-user <Username>`. User must already exist. |
| Imported distro default user | Imported distributions do not have executable launchers; set default user via `/etc/wsl.conf` `[user] default=<Username>`. |

### `wslpath`

```bash
wslpath [Options] <Path>
```

| Option | Meaning |
|---|---|
| `-a` | Force absolute path output. |
| `-u` | Translate Windows path to WSL path. Default. |
| `-w` | Translate WSL path to Windows path with backslashes. |
| `-m` | Translate WSL path to Windows path with `/` separators. |

### `wslinfo`

```powershell
wslinfo [Option]
wslinfo [Option] -n
```

| Option | Meaning |
|---|---|
| `--networking-mode` | Display current networking mode. |
| `--msal-proxy-path` | Display path to MSAL proxy application. |
| `--vm-id` | Display WSL VM ID. |
| `--version` | Display WSL package version. |
| `-n` | Do not print trailing newline. |

### `wslg.exe`

```powershell
wslg.exe [Argument] [Options...] [CommandLine]
```

| Argument / option | Accepted values | Meaning |
|---|---:|---|
| `--cd <Directory>` | `~`, absolute Linux path beginning `/`, or absolute Windows path | Set current working directory. |
| `--distribution`, `-d <Distro>` | installed distro | Run specified distribution. |
| `--user`, `-u <UserName>` | Linux user | Run as specified user. |
| `--shell-type <standard\|login\|none>` | `standard`, `login`, `none` | Execute command with requested shell type. |
| `--help` | n/a | Display usage information. |
| `--` | remainder | Pass remaining command line as-is. |

### Deprecated `wslconfig.exe`

```powershell
wslconfig.exe [Argument] [Options]
```

| Argument / option | Meaning |
|---|---|
| `/l`, `/list [Option]` | List registered distributions. |
| `/all` | With `/list`, include distributions currently being installed or uninstalled. |
| `/running` | With `/list`, list only running distributions. |
| `/s`, `/setdefault <DistributionName>` | Set distribution as default. |
| `/t`, `/terminate <DistributionName>` | Terminate distribution. |
| `/u`, `/unregister <DistributionName>` | Unregister distribution and delete root filesystem. |

### Deprecated `bash` / `lxrun`

| Command | Status |
|---|---|
| `bash [Options]` | Original WSL launch syntax. Replaced by `wsl` / `wsl.exe`. |
| `lxrun /[Argument]` | Original WSL distro management syntax. Replaced by `wsl` / `wsl.exe`. |

### `/etc/wsl.conf` per-distribution configuration

Path: `/etc/wsl.conf` inside each distro. Applies to WSL1 and WSL2 distros. Changes apply only after the distro fully stops; `wsl --terminate <Distro>` or `wsl --shutdown` forces restart.

| Section | Key | Value | Default | Meaning |
|---|---|---:|---:|---|
| `[automount]` | `enabled` | boolean | `true` | Automatically mount fixed Windows drives with DrvFs. |
| `[automount]` | `mountFsTab` | boolean | `true` | Process `/etc/fstab` on WSL start. |
| `[automount]` | `root` | string | `/mnt/` | Root directory where fixed drives mount. |
| `[automount]` | `options` | comma-separated DrvFs options | `null` | DrvFs-specific mount options appended to defaults. |
| `[network]` | `generateHosts` | boolean | `true` | Generate `/etc/hosts`. |
| `[network]` | `generateResolvConf` | boolean | `true` | Generate `/etc/resolv.conf`. |
| `[network]` | `hostname` | string | Windows hostname | Distro hostname. |
| `[interop]` | `enabled` | boolean | `true` | Enable launching Windows processes from WSL. |
| `[interop]` | `appendWindowsPath` | boolean | `true` | Append Windows PATH entries to Linux `$PATH`. |
| `[user]` | `default` | string | initial username | Default user when starting a WSL session. |
| `[boot]` | `systemd` | boolean | distro-dependent | Enable systemd where supported. Requires WSL 0.67.6+ for distributions that do not already run systemd by default. |
| `[boot]` | `command` | string | `null` | Root command to run when the WSL instance starts. Windows 11 / Server 2022+. |
| `[boot]` | `protectBinfmt` | boolean | `true` | Prevent WSL from generating systemd units when systemd is enabled. |
| `[gpu]` | `enabled` | boolean | `true` | Allow Linux applications to access Windows GPU via para-virtualization. |
| `[time]` | `useWindowsTimezone` | boolean | `true` | Use and sync to Windows timezone. |

#### `/etc/wsl.conf` DrvFs `options` values

| Option | Default | Meaning |
|---|---:|---|
| `uid` | default distro user ID, commonly `1000` | Owner user ID for all mounted files. |
| `gid` | default distro group ID, commonly `1000` | Owner group ID for all mounted files. |
| `umask` | `022` | Octal permissions mask for files and directories. |
| `fmask` | `000` | Octal permissions mask for files. |
| `dmask` | `000` | Octal permissions mask for directories. |
| `metadata` | disabled | Store Linux permission metadata on Windows files. Required for masks/ownership behavior beyond default DrvFs semantics. |
| `case` | `off` | Case sensitivity mode. Accepted values: `off`, `dir`, `force`. |

### `%UserProfile%\.wslconfig` global WSL2 configuration

Path: `%UserProfile%\.wslconfig` on Windows. Applies globally to WSL2 distributions only. Changes require the WSL2 VM to stop; run `wsl --shutdown`.

#### `[wsl2]` settings

| Key | Value | Default | Meaning |
|---|---|---:|---|
| `kernel` | path | Microsoft built kernel | Absolute Windows path to custom Linux kernel. Escape backslashes in file. |
| `kernelModules` | path | none | Absolute Windows path to custom Linux kernel modules VHD. |
| `memory` | size | 50% of total Windows memory | Memory assigned to WSL2 VM. |
| `processors` | number | logical processor count | Logical processors assigned to WSL2 VM. Must not exceed host logical processor count. |
| `localhostForwarding` | boolean | `true` | Make WSL2 ports bound to wildcard/localhost connectable from Windows via `localhost:port`. Ignored with mirrored networking. |
| `kernelCommandLine` | string | none | Additional kernel command line. |
| `safeMode` | boolean | `false` | Disable many features to recover bad distro states. Windows 11 and WSL 0.66.2+. |
| `swap` | size | 25% of memory rounded up to nearest GB | Swap size; `0` disables swap. |
| `swapFile` | path | `%Temp%\swap.vhdx` | Absolute Windows path to swap VHD. |
| `guiApplications` | boolean | `true` | Enable/disable WSLg GUI application support. |
| `debugConsole` | boolean | `false` | Show console containing `dmesg` output when starting WSL2 distro. Windows 11. |
| `maxCrashDumpCount` | number | `10` | Number of WSL crash dumps retained. |
| `nestedVirtualization` | boolean | `true` | Enable nested VMs inside WSL2. Windows 11. |
| `vmIdleTimeout` | number milliseconds | `60000` | Idle time before VM shutdown. Windows 11. |
| `dnsProxy` | boolean | `true` | NAT-only; configure Linux DNS server to NAT on host. `false` mirrors Windows DNS servers. |
| `networkingMode` | string | `NAT` | Accepted values: `none`, `nat`, `bridged` deprecated, `mirrored`, `virtioproxy`. Unknown values use NAT. Starting WSL 2.3.25, NAT failure falls back to VirtioProxy. |
| `firewall` | boolean | `true` | Apply Windows Firewall and Hyper-V traffic rules to WSL network traffic. Windows 11 22H2+. |
| `dnsTunneling` | boolean | `true` | Change how DNS requests are proxied from WSL to Windows. Windows 11 22H2+. |
| `autoProxy` | boolean | `true` | Use Windows HTTP proxy information. Windows 11. |
| `defaultVhdSize` | size | `1099511627776` (1 TB) | Maximum size for newly created distro VHDs. |

#### `[experimental]` settings

| Key | Value | Default | Meaning |
|---|---|---:|---|
| `autoMemoryReclaim` | `disabled`, `gradual`, `dropCache` | `dropCache` | Automatic cached memory reclamation mode. Unknown values behave like `dropCache`. |
| `sparseVhd` | boolean | `false` | Newly created VHDs become sparse automatically. |
| `bestEffortDnsParsing` | boolean | `false` | With `wsl2.dnsTunneling=true`, extract DNS question and attempt resolution while ignoring unknown records. Windows 11 22H2+. |
| `dnsTunnelingIpAddress` | string | `10.255.255.254` | Nameserver configured in Linux `resolv.conf` when DNS tunneling is enabled. Windows 11 22H2+. |
| `initialAutoProxyTimeout` | string milliseconds | `1000` | With `wsl2.autoProxy=true`, time WSL waits for HTTP proxy info while starting a container. Windows 11. |
| `ignoredPorts` | comma-separated port list | `null` | With mirrored networking, ports Linux apps may bind even if Windows uses them, e.g. `3000,9000,9090`. Windows 11 22H2+. |
| `hostAddressLoopback` | boolean | `false` | With mirrored networking, allow container/host connection using host-assigned IPv4 addresses. `127.0.0.1` loopback is always usable. Windows 11 22H2+. |

### Filesystem and interop surfaces

| Surface | Meaning |
|---|---|
| `/mnt/c`, `/mnt/d`, ... | DrvFs mounts of fixed Windows drives, unless automount is disabled or root changed. |
| `\\wsl.localhost\<Distro>\` | Windows UNC access to Linux filesystem. |
| `\\wsl\<Distro>\` | UNC access prefix supported by current WSL; older `\\wsl$\<Distro>\` remains supported. |
| `explorer.exe .` | Open current Linux directory in Windows Explorer when interop is enabled. |
| `cmd.exe`, `powershell.exe`, `notepad.exe`, etc. | Windows executables callable from WSL when interop is enabled. |
| Windows PATH injection | Controlled by `/etc/wsl.conf` `[interop] appendWindowsPath`. |
| `/etc/fstab` | Additional filesystem mounts processed on startup when `[automount] mountFsTab=true`. |
| `/etc/hosts` | Auto-generated unless `[network] generateHosts=false`. |
| `/etc/resolv.conf` | Auto-generated unless `[network] generateResolvConf=false`. |

## Setup & auth

Install modern WSL from PowerShell or Command Prompt:

```powershell
wsl --install
```

Install a named distro:

```powershell
wsl --list --online
wsl --install Ubuntu
```

Install components only, with no distribution:

```powershell
wsl --install --no-distribution
```

Update WSL package/kernel:

```powershell
wsl --update
wsl --version
```

Manual install path for older Windows builds or Windows Server Core:

```powershell
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
wsl --set-default-version 2
```

Auth/credentials:

| Credential / identity | Source | Notes |
|---|---|---|
| Windows user identity | Windows account/session | Controls access to Windows files, WSL package installation rights, and administrative operations. |
| Linux distro user/password | Created on first distro launch or by distro tooling | Used for Linux login and `sudo`; not a Windows password. |
| Git/SSH/cloud credentials inside WSL | Linux files, agent, keyring, Git Credential Manager, or tool-specific credential stores | Do not inline secrets in `wsl.conf`, `.wslconfig`, shell history, or exported skill docs. |
| Microsoft Store/package updates | Windows Store/MSIX infrastructure or web download | No token normally required. Corporate policy may block Store, WSL, WSL1, `--mount`, or `--debug-shell`. |

State/config locations:

| Location | Purpose |
|---|---|
| `%UserProfile%\.wslconfig` | Global WSL2 VM settings. |
| `/etc/wsl.conf` | Per-distro WSL settings. |
| `/etc/fstab` | Extra mounts processed at distro startup. |
| `/etc/hosts`, `/etc/resolv.conf` | Hostname/DNS files generated by WSL unless disabled. |
| `<DistroInstallLocation>\ext4.vhdx` | WSL2 root filesystem virtual disk for imported or moved distros; Store distros keep it under their package `LocalState`. |
| `\\wsl.localhost\<Distro>\` | Windows access to Linux filesystem. |
| `/mnt/<drive-letter>` | Linux access to fixed Windows drives. |

Platform notes:

| Platform | Notes |
|---|---|
| Windows 11 | Preferred modern WSL target; supports WSLg, systemd, WSL Settings app, mirrored networking, many `.wslconfig` Windows-11-only keys. |
| Windows 10 | Simplified `wsl --install` requires recent builds. WSL2 requires Windows 10 version 1903 build 18362+ for x64, version 2004 build 19041+ for ARM64. Older systems require manual DISM steps and kernel MSI. |
| Windows Server / LTSC / Store-blocked environments | Use manual optional-component install and direct distro downloads/imports when Store is unavailable. |
| ARM64 | `wsl.exe --mount` on ARM64 requires Windows version 27653 or newer according to upstream error text. |
| 32-bit process on 64-bit Windows | Native `wsl.exe` lives in native System32; a 32-bit process may need `C:\Windows\Sysnative\wsl.exe`. |
| Linux shell inside WSL | Use `wsl.exe`, not `wsl`, unless a Linux package named `wsl` is intentionally installed. |

## Common workflows

Install WSL and the default Ubuntu distribution:

```powershell
wsl --install
```

Side effect: enables required components, installs the default distro, then first launch creates the Linux user.

List installed and installable distributions:

```powershell
wsl --list --verbose
wsl --list --online
```

Output: installed distro state/version, then online distro names valid for `wsl --install <Distro>`.

Run one Linux command from PowerShell/CMD:

```powershell
wsl -d Ubuntu -u root -- uname -a
```

Output: command stdout/stderr from the selected distro without entering an interactive shell.

Back up and restore a distro:

```powershell
wsl --export Ubuntu .\ubuntu-backup.tar
wsl --import Ubuntu-Restore .\Ubuntu-Restore .\ubuntu-backup.tar --version 2
```

Side effect: creates a tar snapshot, then registers a new restored distro at the selected install location.

Restart WSL after config changes:

```powershell
wsl --list --running
wsl --shutdown
wsl --status
```

Side effect: stops all WSL distros and the WSL2 VM so `%UserProfile%\.wslconfig` and `/etc/wsl.conf` changes can apply on next launch.

## Error handling

| Symptom | Likely cause | Fix |
|---|---|---|
| `Installation failed with error 0x80070003` | WSL or distro installed off the system drive, or install storage target not supported. | Store distributions on system drive; check Windows Settings storage defaults; retry install. |
| `WslRegisterDistribution failed with error 0x8007019e` | Windows Subsystem for Linux optional component is not enabled. | Enable optional component or run `wsl --install --no-distribution`; reboot if prompted. |
| `Installation failed with error 0x80070003 or error 0x80370102` | Virtualization or Virtual Machine Platform unavailable; CPU may not support SLAT. | Enable virtualization in firmware and enable `VirtualMachinePlatform`; verify Windows/CPU support. |
| `Invalid command line option: wsl --set-version Ubuntu 2` | WSL not enabled or Windows build too old for WSL2 conversion command. | Enable WSL optional component and use Windows build 18362+; update Windows if needed. |
| `The requested operation could not be completed due to a virtual disk system limitation. Virtual hard disk files must be uncompressed and unencrypted and must not be sparse.` | Distro `LocalState` or VHD is compressed, encrypted, or sparse in a way WSL conversion cannot use. | Remove NTFS compression/encryption from the distro `LocalState`/VHD location; retry `wsl --set-version`. |
| `The term 'wsl' is not recognized as the name of a cmdlet, function, script file, or operable program.` | WSL optional component not installed, PATH/system redirection issue, or ARM64 PowerShell mismatch. | Install WSL; use `wsl.exe` from Command Prompt/PowerShell Core; from 32-bit processes use `C:\Windows\Sysnative\wsl.exe`. |
| `Error: Windows Subsystem for Linux has no installed distributions.` | No distro installed for the current Windows user, distro has never been launched, or command is running under a different account. | Run `wsl --list --online` then `wsl --install <Distro>`; launch distro once; verify user/elevation context. |
| `Error: This update only applies to machines with the Windows Subsystem for Linux.` | Kernel MSI/update run before WSL optional component is enabled, unsupported Windows version, or reboot pending. | Enable WSL, reboot, update Windows, then rerun installer/update. |
| `Error: WSL 2 requires an update to its kernel component.` | WSL2 kernel package missing or outdated. | Install/reinstall the WSL2 Linux kernel update package or run `wsl --update` where available. |
| `Error: 0x80040306` | Legacy console mode enabled. | In `cmd.exe` Properties, disable legacy console; relaunch terminal. |
| `Error: 0x80040154` | WSL feature disabled during Windows update. | Re-enable WSL optional feature and reboot. |
| `Error: 0x800704ec This program is blocked by group policy. For more information, contact your system administrator.` | Enterprise/group policy blocks WSL. | Run `wsl --update`; if still blocked, change policy through administrator/Intune/GPO. |
| `WSL2 is unable to start since virtualization is not enabled on this machine.` | Firmware virtualization disabled or Virtual Machine Platform component missing. | Enable virtualization in firmware; run `wsl.exe --install --no-distribution`; reboot. |
| `The disk was attached but failed to mount: {}` | Disk attached, filesystem mount failed. | Run `dmesg` inside WSL2 for details; detach with `wsl.exe --unmount <Disk>`; verify filesystem/partition/options. |
| `Administrator access is needed to mount a disk.` | `wsl --mount` requires elevated privileges. | Re-run PowerShell/CMD as Administrator. |
| `wsl.exe --mount is disabled by the computer policy.` | Enterprise policy disables disk mount command. | Remove/adjust WSL policy or avoid `--mount`. |
| `Running the debug shell requires running wsl.exe as Administrator.` | `--debug-shell` executed without elevation. | Re-run shell as Administrator, unless policy disables debug shell. |
| `The debug shell is disabled by the computer policy.` | Enterprise policy disables `--debug-shell`. | Remove/adjust WSL policy; collect diagnostics through allowed channels. |
| `There is no distribution with the supplied name.` | Distro name does not match registered distro or installable online name. | Run `wsl -l -q` for installed names or `wsl -l -o` for installable names; retry exact name. |
| `User not found.` | `--user <UserName>` or default-user setting references a Linux user that does not exist. | Create the user inside the distro or use an existing username; verify with `whoami`/`getent passwd`. |
| `A distribution with the supplied name already exists. Use --name to chose a different name.` | Install/import name collides with an existing registration. | Pick a unique `--name`/`<Distro>` or unregister/export existing distro first. |
| `The supplied install location is already in use.` | Install/import/move target already contains another distro or VHD. | Choose an empty install location. |
| `Importing the distribution failed.` | Tar/VHD invalid, path inaccessible, wrong import mode, or disk format mismatch. | Verify file path and format; use `--vhd` for VHD/VHDX; use ext4 VHD for `--import-in-place`. |
| `This looks like a VHD file. Use --vhd to import a VHD instead of a tar.` | `wsl --import` attempted VHD as tar. | Add `--vhd` or use `--import-in-place` as appropriate. |
| `The imported file is not a valid Linux distribution.` | Import file is not a valid root filesystem tar or supported WSL distro package. | Use a valid Linux rootfs tar, WSL distro package, or VHD mode. |
| `The distribution failed to start because its virtual disk is corrupted.` | Distro VHD corruption. | Export/repair from backups if possible; follow disk mount recovery guidance; avoid destructive `--unregister` unless data is disposable. |
| `No internet access in WSL` | Firewall/VPN/virtualization network interference or DNS generation/proxy issue. | Test host networking, VPN/firewall, Hyper-V VM networking; inspect `/etc/resolv.conf`; try `wsl --shutdown`; collect WSL networking logs if persistent. |
| `Processing /etc/fstab with mount -a failed.` | Invalid `/etc/fstab` entry or inaccessible mount target. | Boot distro, inspect `/etc/fstab`, run `sudo mount -a`, fix failing entry, restart WSL. |
| `Failed to open config file {}, {}` | `.wslconfig` or `/etc/wsl.conf` inaccessible/malformed. | Check file path, permissions, encoding, INI syntax; restart WSL. |
| `Unknown key '{}' in {}:{}` | Unsupported key in config file. | Remove or correct key; verify section/key spelling and WSL version support. |
| `Invalid value '{}' for config key '{}' in {}:{} (Valid values: {})` | Config value outside accepted enum/boolean/size/IP format. | Replace with an accepted value; run `wsl --shutdown`; relaunch. |
| `Arguments {} and {} can't be specified at same time.` | Mutually exclusive CLI options combined. | Split into separate commands or remove one option. |
| `Argument {} requires the {} argument.` | Dependent option supplied without required companion option. | Add required option or remove dependent option. |
| `Optional components needed to run WSL are not installed.` | Required Windows features missing. | Run `wsl --install --no-distribution`; reboot. |
| `The operation could not be completed because the VHD is currently in use.` | Distro/disk VHD is mounted or active. | Stop the distro or run `wsl.exe --shutdown`; retry. |
| `wsl2.processors cannot exceed the number of logical processors on the system ({} > {})` | `.wslconfig` requests more processors than host has. | Set `processors` to host logical processor count or lower. |
| `The plugin '{}' requires a newer version of WSL. Please run: wsl.exe --update` | Plugin depends on a newer WSL package. | Run `wsl --update`; restart WSL. |
| `Windows version {} does not support the packaged version of Windows Subsystem for Linux.` | WSL package requires a newer Windows build/update. | Install required Windows update or use supported inbox/Store WSL version. |

## Traps

_Append-only. Date-stamped. Filled by the operator via the `/lesson` slash command when something bites._

## Lessons

_Append-only. Date-stamped. Filled by the operator via the `/lesson` slash command for behaviors learned that aren't in upstream docs._
