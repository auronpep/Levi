---
name: tool-python
description: Load when working with python, CPython interpreter flags, module execution, virtual environments, Windows py launcher, PYTHON* environment variables, or traceback/debug startup. Covers full interpreter CLI surface, setup/auth, workflows, and error handling.
triggers:
  bash:
    - python
    - python3
    - pythonw
    - py -
    - py -m
    - py list
    - py install
    - py uninstall
    - py exec
    - py help
    - pyw
    - pymanager
---

# python

## What it is

**Assumption:** identifier `python` interpreted as the CPython interpreter CLI and associated Python install manager / launcher commands from the Python Software Foundation. Python is a general-purpose programming language runtime and command-line interpreter for running scripts, modules, package tooling, REPL sessions, diagnostics, and virtual environments. Reach for it when executing Python code directly, selecting interpreter versions, creating isolated project runtimes, inspecting startup/import behavior, or invoking package CLIs through `python -m`; alternatives include PyPy for an alternate Python implementation, Node.js/Ruby for other scripting runtimes, and shell tools for small command pipelines.

## Capability surface

### Interpreter invocation

```text
python [-bBdEhiIOPqRsSuvVWx?] [-c command | -m module-name | script | -] [args]
python3 [same options]
pythonw [same options, windowed on Windows/macOS builds where present]
```

| Form | Effect | `sys.argv[0]` / path behavior |
|---|---|---|
| `python` | Start interactive mode when stdin is a TTY; otherwise read stdin. | `sys.argv[0] == ""`; current directory prepended to `sys.path` unless `-P`/`-I`. |
| `python -c <command>` | Execute one or more Python statements supplied on command line. | `sys.argv[0] == "-c"`; current directory prepended to `sys.path` unless `-P`/`-I`; command is automatically dedented in Python 3.14+. |
| `python -m <module-name>` | Locate module/package on `sys.path` and execute as `__main__`. | `sys.argv[0]` becomes module path after location; current directory prepended to `sys.path` unless `-P`/`-I`. Built-in and C extension modules cannot be executed this way. |
| `python -` | Read program from stdin. | `sys.argv[0] == "-"`; current directory prepended to `sys.path` unless `-P`/`-I`. |
| `python <script.py>` | Execute script file. | Script directory prepended to `sys.path` unless `-P`/`-I`. |
| `python <directory>` | Execute `<directory>/__main__.py`. | Directory path prepended to `sys.path` unless `-P`/`-I`. |
| `python <zipfile>` | Execute `__main__.py` inside zip archive. | Zip path prepended to `sys.path` unless `-P`/`-I`. |
| `python [interface-option] [args...]` | First interface option terminates interpreter option parsing. | Remaining args populate `sys.argv`. |

### Generic options

| Option | Effect |
|---|---|
| `-?` | Print short help and exit. |
| `-h` | Print short help and exit. |
| `--help` | Print short help and exit. |
| `--help-env` | Print Python-specific environment variables and exit. |
| `--help-xoptions` | Print implementation-specific `-X` options and exit. |
| `--help-all` | Print complete usage information and exit. |
| `-V` | Print version and exit. |
| `--version` | Print version and exit. |
| `-VV` | Print extended build/version details and exit. |

### Miscellaneous interpreter options

| Option | Accepted values | Effect |
|---|---:|---|
| `-b` | none | Warn on bytes/bytearray to str conversion without encoding and on bytes/bytearray comparisons with str or bytes-vs-int. |
| `-bb` | none | Convert the `-b` warning cases to errors. |
| `-B` | none | Do not write `.pyc` files on source module import. Equivalent env: `PYTHONDONTWRITEBYTECODE`. |
| `--check-hash-based-pycs` | `default`, `always`, `never` | Control validation behavior of hash-based `.pyc` files. Timestamp-based `.pyc` files unaffected. |
| `-d` | repeatable | Enable parser debugging output on debug builds; ignored on non-debug builds. Equivalent env: `PYTHONDEBUG`. |
| `-E` | none | Ignore all `PYTHON*` environment variables. |
| `-i` | none | Enter interactive mode after script, `-c`, or `-m`; `PYTHONSTARTUP` not read. Equivalent env: `PYTHONINSPECT`. |
| `-I` | none | Isolated mode; implies `-E`, `-P`, `-s`; removes script/current directory and user site-packages from `sys.path`; ignores `PYTHON*`. |
| `-O` | repeatable once | Remove `assert` statements and code conditional on `__debug__`; write `.opt-1.pyc`. Equivalent env: `PYTHONOPTIMIZE`. |
| `-OO` | none | Apply `-O` and discard docstrings; write `.opt-2.pyc`. |
| `-P` | none | Do not prepend potentially unsafe paths to `sys.path` for script, `-m`, `-c`, or REPL. Equivalent env: `PYTHONSAFEPATH`. |
| `-q` | none | Suppress copyright/version banner in interactive mode. |
| `-R` | none | Enable hash randomization when `PYTHONHASHSEED` is not `random`; retained for compatibility because hash randomization is default. |
| `-s` | none | Do not add user site-packages directory to `sys.path`. Equivalent env: `PYTHONNOUSERSITE`. |
| `-S` | none | Disable automatic `site` import and site-dependent `sys.path` manipulation. |
| `-u` | none | Force stdout and stderr unbuffered; stdin unaffected. Equivalent env: `PYTHONUNBUFFERED`. |
| `-v` | repeatable | Print each module initialization and origin; with `-vv`, print each file checked during import search; prints cleanup details at exit. Equivalent env: `PYTHONVERBOSE`. |
| `-W arg` | warning filter | Configure warnings. Repeatable; last matching filter wins. Equivalent env: `PYTHONWARNINGS`. |
| `-x` | none | Skip first source line; DOS shebang compatibility. |
| `-X opt[=value]` | implementation-specific | Set CPython implementation-specific option or arbitrary `sys._xoptions` entry. |

### `-W` warning control

```text
-Wdefault  # Warn once per call location
-Werror    # Convert to exceptions
-Walways   # Warn every time
-Wall      # Same as -Walways
-Wmodule   # Warn once per calling module
-Wonce     # Warn once per Python process
-Wignore   # Never warn
```

Full warning filter form:

```text
action:message:category:module:lineno
```

| Field | Match behavior |
|---|---|
| `action` | `default`, `error`, `always`, `all`, `module`, `once`, `ignore`; abbreviations accepted. |
| `message` | Case-insensitive match against whole warning message; empty matches all. |
| `category` | Warning category class name; actual category must be subclass. |
| `module` | Case-sensitive match against fully qualified module name. |
| `lineno` | Exact line number; `0` or omitted matches all lines. |

### `-X` implementation-specific options

| Option | Accepted values | Effect / availability |
|---|---:|---|
| `-X faulthandler` | none | Enable `faulthandler` at startup. Equivalent env: `PYTHONFAULTHANDLER`. |
| `-X showrefcount` | none | Print total reference count and used memory blocks on program finish or after each interactive statement. Debug builds only. |
| `-X tracemalloc` | none | Start `tracemalloc` with default one-frame traceback limit. Equivalent env: `PYTHONTRACEMALLOC`. |
| `-X tracemalloc=NFRAME` | integer | Start `tracemalloc` with `NFRAME` traceback frames. |
| `-X int_max_str_digits=N` | integer | Configure global integer string conversion length limit. Equivalent env: `PYTHONINTMAXSTRDIGITS`. |
| `-X importtime` | none / `1` | Print import timings: module name, cumulative time including nested imports, self time excluding nested imports. Output may be broken in multithreaded apps. Equivalent env: `PYTHONPROFILEIMPORTTIME=1`. |
| `-X importtime=2` | `2` | Include already-loaded module imports; cached imports show `cached` in time columns. Equivalent env: `PYTHONPROFILEIMPORTTIME=2`. |
| `-X dev` | none | Enable Python Development Mode. Equivalent env: `PYTHONDEVMODE`. |
| `-X utf8` | none / `1` | Enable UTF-8 Mode. Equivalent env: `PYTHONUTF8=1`. |
| `-X utf8=0` | `0` | Disable UTF-8 Mode even when it would otherwise activate automatically. Equivalent env: `PYTHONUTF8=0`. |
| `-X pycache_prefix=PATH` | path | Write `.pyc` files into a parallel tree rooted at `PATH`. Equivalent env: `PYTHONPYCACHEPREFIX`. |
| `-X warn_default_encoding` | none | Emit `EncodingWarning` when locale-specific default encoding is used to open files. Equivalent env: `PYTHONWARNDEFAULTENCODING`. |
| `-X no_debug_ranges` | none | Omit extra code-object location tables for smaller code objects/pycs and less detailed traceback indicators. Equivalent env: `PYTHONNODEBUGRANGES`. |
| `-X frozen_modules=on` | `on` | Use frozen modules; installed Python default. `importlib_bootstrap` and `importlib_bootstrap_external` always use frozen versions. Equivalent env: `PYTHON_FROZEN_MODULES=on`. |
| `-X frozen_modules=off` | `off` | Ignore frozen modules except bootstrap modules; source-tree debug default. Equivalent env: `PYTHON_FROZEN_MODULES=off`. |
| `-X perf` | none | Enable Linux `perf` Python call reporting when platform supports it; otherwise no effect. Equivalent env: `PYTHONPERFSUPPORT`. |
| `-X perf_jit` | none | Enable Linux `perf` call reporting with DWARF/JIT support when platform supports it; otherwise no effect. Equivalent env: `PYTHON_PERF_JIT_SUPPORT`. |
| `-X disable_remote_debug` | none | Disable PEP 768 remote debugging support where present. Equivalent env: `PYTHON_DISABLE_REMOTE_DEBUG`. |
| `-X cpu_count=n` | integer `>=1` | Override `os.cpu_count()`, `os.process_cpu_count()`, and `multiprocessing.cpu_count()`. Equivalent env: `PYTHON_CPU_COUNT`. |
| `-X cpu_count=default` | `default` | Do not override CPU count. |
| `-X presite=package.module` | import path | Import module before `site` and before `__main__`; debug builds only. Equivalent env: `PYTHON_PRESITE`. |
| `-X gil=0` | `0` | Force GIL disabled; requires build configured with `--disable-gil`. Equivalent env: `PYTHON_GIL=0`. |
| `-X gil=1` | `1` | Force GIL enabled. Equivalent env: `PYTHON_GIL=1`. |
| `-X thread_inherit_context=0` | `0` | New `threading.Thread` starts with empty context. Equivalent env: `PYTHON_THREAD_INHERIT_CONTEXT=0`. |
| `-X thread_inherit_context=1` | `1` | New `threading.Thread` starts with caller context copy. Equivalent env: `PYTHON_THREAD_INHERIT_CONTEXT=1`. |
| `-X context_aware_warnings=0` | `0` | `warnings.catch_warnings` does not use a `ContextVar` for warning filter state. Equivalent env: `PYTHON_CONTEXT_AWARE_WARNINGS=0`. |
| `-X context_aware_warnings=1` | `1` | `warnings.catch_warnings` uses a `ContextVar` for warning filter state. Equivalent env: `PYTHON_CONTEXT_AWARE_WARNINGS=1`. |
| `-X tlbc=0` | `0` | Disable thread-local bytecode on `--disable-gil` builds; also disables specializing interpreter. Equivalent env: `PYTHON_TLBC=0`. |
| `-X tlbc=1` | `1` | Enable thread-local bytecode on `--disable-gil` builds. Equivalent env: `PYTHON_TLBC=1`. |
| `-X key=value` | arbitrary | Store arbitrary key/value in `sys._xoptions`; no interpreter behavior unless application reads it. |

Removed / no-special-meaning options:

| Option | Status |
|---|---|
| `-X showalloccount` | Removed in Python 3.9. |
| `-X oldparser` | Removed in Python 3.10. |
| `-J` | No longer reserved for Jython in Python 3.14; no special meaning. |

### Color control

| Variable | Accepted values | Effect / precedence |
|---|---:|---|
| `TERM=dumb` | `dumb` | Disable color. |
| `FORCE_COLOR` | any set value | Enable color even when terminal detection would not. |
| `NO_COLOR` | any set value | Disable all color; takes precedence over `FORCE_COLOR`. |
| `PYTHON_COLORS` | `1`, `0` | Control only Python interpreter colorization; takes precedence over `NO_COLOR`, which takes precedence over `FORCE_COLOR`. |

### Python environment variables

Processed before command-line switches except where `-E` or `-I` disables `PYTHON*`; command-line switches override env variables on conflicts.

| Variable | Accepted values | Effect |
|---|---:|---|
| `PYTHONHOME` | `prefix` or `prefix:exec_prefix` | Override standard library location prefixes. |
| `PYTHONPATH` | path list separated by `os.pathsep` | Prepend additional module search paths; nonexistent dirs ignored; zipfiles containing pure Python modules allowed; extension modules cannot be imported from zipfiles. |
| `PYTHONSAFEPATH` | non-empty | Equivalent to `-P`; do not prepend potentially unsafe path to `sys.path`. |
| `PYTHONPLATLIBDIR` | string | Override `sys.platlibdir`. |
| `PYTHONSTARTUP` | readable file path | Execute file before first interactive prompt; same namespace as interactive session. |
| `PYTHONOPTIMIZE` | non-empty / integer | Equivalent to `-O`; integer repeats `-O`. |
| `PYTHONBREAKPOINT` | dotted callable / empty / `0` | Set callable used by `breakpoint()`; empty uses `pdb.set_trace`; `0` disables breakpoints. |
| `PYTHONDEBUG` | non-empty / integer | Equivalent to `-d`; debug build required. |
| `PYTHONINSPECT` | non-empty | Equivalent to `-i`; can be set by Python code via `os.environ` before exit. |
| `PYTHONUNBUFFERED` | non-empty | Equivalent to `-u`. |
| `PYTHONVERBOSE` | non-empty / integer | Equivalent to `-v`; integer repeats `-v`. |
| `PYTHONCASEOK` | set value | Ignore case in imports. Windows/macOS only. |
| `PYTHONDONTWRITEBYTECODE` | non-empty | Equivalent to `-B`; suppress `.pyc` writes. |
| `PYTHONPYCACHEPREFIX` | path | Equivalent to `-X pycache_prefix=PATH`. |
| `PYTHONHASHSEED` | `random`, unset, or integer `0..4294967295` | Random hash seed when unset/`random`; fixed seed for repeatable hashing; `0` disables hash randomization. |
| `PYTHONINTMAXSTRDIGITS` | integer | Equivalent to `-X int_max_str_digits`. |
| `PYTHONIOENCODING` | `encoding[:errors]` | Override stdin/stdout/stderr encoding; stderr error handler always `backslashreplace`; Windows interactive console ignores encoding unless `PYTHONLEGACYWINDOWSSTDIO` set. |
| `PYTHONNOUSERSITE` | set value | Equivalent to `-s`. |
| `PYTHONUSERBASE` | path | Set user base directory used for user site-packages and `python -m pip install --user`. |
| `PYTHONEXECUTABLE` | path/string | Override `sys.argv[0]` from C runtime. macOS only. |
| `PYTHONWARNINGS` | comma-separated warning filters | Equivalent to multiple `-W` options; later filters take precedence. |
| `PYTHONFAULTHANDLER` | non-empty | Equivalent to `-X faulthandler`. |
| `PYTHONTRACEMALLOC` | non-empty / integer frames | Equivalent to `-X tracemalloc[=NFRAME]`. |
| `PYTHONPROFILEIMPORTTIME` | `1`, `2` | Equivalent to `-X importtime`; `2` includes already-loaded modules. |
| `PYTHONASYNCIODEBUG` | non-empty | Enable asyncio debug mode. |
| `PYTHONMALLOC` | `default`, `malloc`, `pymalloc`, `mimalloc`, `debug`, `malloc_debug`, `pymalloc_debug`, `mimalloc_debug` | Select memory allocator and/or debug hooks. Free-threaded builds support only `default`, `debug`, `mimalloc`, `mimalloc_debug`. |
| `PYTHONMALLOCSTATS` | non-empty | Print pymalloc/mimalloc allocator stats on new arenas and shutdown; ignored for forced `malloc` or builds without pymalloc/mimalloc. |
| `PYTHONLEGACYWINDOWSFSENCODING` | non-empty | Revert Windows filesystem encoding/error handler to pre-3.6 `mbcs`/`replace`. Windows only. |
| `PYTHONLEGACYWINDOWSSTDIO` | non-empty | Use legacy Windows console reader/writer; redirected streams unaffected. Windows only. |
| `PYTHONCOERCECLOCALE` | `0`, `warn`, other/unset | `0` disables legacy ASCII locale coercion; `warn` emits diagnostics if coercion occurs. Unix only. |
| `PYTHONDEVMODE` | non-empty | Equivalent to `-X dev`. |
| `PYTHONUTF8` | `1`, `0` | `1` enables UTF-8 Mode; `0` disables; other non-empty values error during interpreter initialization. |
| `PYTHONWARNDEFAULTENCODING` | non-empty | Equivalent to `-X warn_default_encoding`. |
| `PYTHONNODEBUGRANGES` | set value | Equivalent to `-X no_debug_ranges`. |
| `PYTHONPERFSUPPORT` | nonzero / `0` | Equivalent to `-X perf`; `0` disables. Linux perf support only where platform supports it. |
| `PYTHON_PERF_JIT_SUPPORT` | nonzero / `0` | Equivalent to `-X perf_jit`; `0` disables. Linux perf/JIT support only where platform supports it. |
| `PYTHON_DISABLE_REMOTE_DEBUG` | non-empty | Equivalent to `-X disable_remote_debug`. |
| `PYTHON_CPU_COUNT` | positive integer | Equivalent to `-X cpu_count=n`. |
| `PYTHON_FROZEN_MODULES` | `on`, `off` | Equivalent to `-X frozen_modules=on|off`. |
| `PYTHON_COLORS` | `1`, `0` | Control Python output colorization. |
| `PYTHON_BASIC_REPL` | any value | Use traditional parser-based REPL instead of Python-based PyREPL. |
| `PYTHON_HISTORY` | path | Set `.python_history` file location; default is `.python_history` in user home. |
| `PYTHON_GIL` | `1`, `0` | Force GIL on/off; off requires `--disable-gil`; `-X gil` takes precedence. |
| `PYTHON_THREAD_INHERIT_CONTEXT` | `1`, `0` | Set default context inheritance for `threading.Thread`; default depends on free-threaded build status. |
| `PYTHON_CONTEXT_AWARE_WARNINGS` | `1`, `0` | Make `warnings.catch_warnings` use/not use `ContextVar`; default depends on free-threaded build status. |
| `PYTHON_JIT` | `1`, `0` | Force experimental JIT enabled/disabled on builds where available. |
| `PYTHON_TLBC` | `1`, `0` | Enable/disable thread-local bytecode on `--disable-gil` builds; disabling also disables specializing interpreter. |

### Debug-build environment variables

| Variable | Accepted values | Effect / build requirement |
|---|---:|---|
| `PYTHONDUMPREFS` | set value | Dump live objects/reference counts after shutdown; requires `--with-trace-refs`. |
| `PYTHONDUMPREFSFILE` | path | Dump live objects/reference counts after shutdown into given path; requires `--with-trace-refs`. |
| `PYTHON_PRESITE` | module path | Import module early before `site` and before `__main__`; requires `--with-pydebug`; `-X presite` takes precedence. |

### `python -m venv`

```text
python -m venv [-h] [--system-site-packages] [--symlinks | --copies] [--clear]
                [--upgrade] [--without-pip] [--prompt PROMPT] [--upgrade-deps]
                [--without-scm-ignore-files]
                ENV_DIR [ENV_DIR ...]
```

| Argument / option | Effect |
|---|---|
| `ENV_DIR [ENV_DIR ...]` | Required target directory or directories; creates identical environments according to options. |
| `-h`, `--help` | Show help and exit. |
| `--system-site-packages` | Give venv access to system site-packages. |
| `--symlinks` | Try symlinks instead of copies when symlinks are not platform default. |
| `--copies` | Try copies instead of symlinks even when symlinks are platform default. |
| `--clear` | Delete existing environment directory contents before creation. |
| `--upgrade` | Upgrade existing environment to current Python after in-place Python upgrade. |
| `--without-pip` | Skip pip bootstrap/upgrade. |
| `--prompt PROMPT` | Set alternate activation prompt prefix. |
| `--upgrade-deps` | Upgrade core dependency `pip` to latest version from PyPI. |
| `--without-scm-ignore-files` | Skip creation of SCM ignore files; Git `.gitignore` is created by default in Python 3.13+. |

Venv layout and activation:

| Platform/shell | Activation command |
|---|---|
| POSIX bash/zsh | `source <venv>/bin/activate` |
| POSIX fish | `source <venv>/bin/activate.fish` |
| POSIX csh/tcsh | `source <venv>/bin/activate.csh` |
| POSIX PowerShell | `<venv>/bin/Activate.ps1` |
| Windows cmd.exe | `<venv>\Scripts\activate.bat` |
| Windows PowerShell | `<venv>\Scripts\Activate.ps1` |

### Common `python -m` standard-library entry points

`python -m <module>` delegates to the target module’s `__main__` entry point. Load a module-specific skill/reference when operating deep inside that module. Common built-in entry points:

| Invocation | Purpose |
|---|---|
| `python -m pip ...` | Run pip bound to the selected interpreter; package install/update/uninstall. |
| `python -m venv ...` | Create virtual environments. |
| `python -m ensurepip ...` | Bootstrap bundled pip when available. |
| `python -m site` | Inspect site-packages and user-site paths. |
| `python -m sysconfig` | Print interpreter build/install scheme configuration. |
| `python -m timeit ...` | Run microbenchmarks. |
| `python -m pdb ...` | Run script under Python debugger. |
| `python -m trace ...` | Trace code execution / coverage-style counts. |
| `python -m cProfile ...` | Run deterministic profiler. |
| `python -m pstats ...` | Inspect profiler stats interactively. |
| `python -m compileall ...` | Byte-compile source trees. |
| `python -m py_compile ...` | Byte-compile specific source files. |
| `python -m json.tool ...` | Validate and pretty-print JSON. |
| `python -m http.server ...` | Serve files over HTTP from a directory. |
| `python -m unittest ...` | Run unittest test discovery or named tests. |
| `python -m doctest ...` | Run doctest examples. |
| `python -m asyncio` | Start asyncio-aware REPL / use asyncio module CLI features available in installed version. |
| `python -m zipapp ...` | Package Python applications as executable zip archives. |
| `python -m idlelib` | Launch IDLE when installed. |
| `python -m turtle` / `python -m turtledemo` | Launch turtle demo tooling when Tk is installed. |

### Windows Python install manager / launcher commands

Commands: `python`, `python3`, `pythonw`, `py`, `pyw`, `pymanager`, `pymanagerw`. On current Windows docs, `python` launches the requested/default runtime, `py` can launch and manage runtimes, and `pymanager` is the unambiguous manager form; `pymanager exec ...` is equivalent to `py ...` for launch behavior.

| Command form | Effect |
|---|---|
| `python [runtime args...]` | Launch current/default runtime, active venv, or script-requested version. |
| `python3 [runtime args...]` | Windows alias mimicking POSIX `python3`; not broadly recommended beyond catching POSIX-style invocations. |
| `pythonw [runtime args...]` | Windowed Python; avoids console window. |
| `py [runtime args...]` | Launch default runtime with runtime args. |
| `py -V:<TAG> ...` | Launch specific runtime tag; `V:` may be omitted for official release tags starting with `3`. Examples: `py -V:3.14`, `py -3.14`, `py -V:3-arm64`. |
| `pyw [runtime args...]` | Windowed launcher; avoids console window. |
| `pymanager` | Show manager help with lower conflict risk than `py`. |
| `pymanager exec ...` | Launch runtime; equivalent behavior to `py ...`. |
| `pymanagerw` | Windowed manager. |

Common manager options, specified after subcommand:

| Option | Effect |
|---|---|
| `-v`, `--verbose` | Increase output. Repeat as `-vv` for more diagnostics. |
| `-q`, `--quiet` | Reduce output. Repeat as `-qq` for quieter output. |
| `--config=<PATH>` | Load configuration file overriding multiple settings. |
| `-?`, `/?` | Show help for command. |

Manager help:

| Command | Effect |
|---|---|
| `py help` | Show full supported command list and options. |
| `py help <command>` | Show help for subcommand. |
| `py <command> -?` / `py <command> /?` | Show help for subcommand. |

Runtime listing:

```text
py list [-f=|--format=<FMT>] [-1|--one] [--online|-s=|--source=<URL>] [<TAG>...]
```

| Option | Accepted values | Effect |
|---|---:|---|
| `<TAG>...` | tag filters; optional range prefixes `<`, `<=`, `>=`, `>` | Filter installed/online runtimes. |
| `-f <FMT>`, `--format=<FMT>` | `table`, `csv`, `json`, `jsonl`, `exe`, `prefix` | Select output format. |
| `-1`, `--one` | none | Show single best/default matching runtime. |
| `--online` | none | Search default online runtime index. |
| `-s <URL>`, `--source=<URL>` | URL/path | Search specified source/index. |
| `--only-managed` | none | Exclude unmanaged runtimes. |
| `--list`, `--list-paths`, `-0`, `-0p` | legacy forms | Compatibility with old launcher; no additional options; legacy output. |

Runtime install:

```text
py install [-s=|--source=<URL>] [-f|--force] [-u|--update] [--dry-run] [<TAG>...]
py install ... [-t=|--target=<PATH>] <TAG>
py install --download=<PATH> ... <TAG>...
py install --source="<PATH>\index.json" <TAG>...
py install --refresh [--force]
py install --configure -y
```

| Option / argument | Effect |
|---|---|
| `<TAG>...` | Install one or more runtime tags; special tag `default` selects default. Ranges unsupported for install. |
| `-s <URL>`, `--source=<URL>` | Override online/offline index used to obtain runtimes. |
| `-f`, `--force` | Ignore cached files and replace existing install. |
| `-u`, `--update` | Replace existing installs only when a newer version exists; with no tags, update all managed installs. |
| `--dry-run` | Generate output/logs without modifying installs. |
| `--refresh` | Recreate registrations, Start menu shortcuts, registry keys, global aliases, and installed package shortcut wrappers. |
| `-t <PATH>`, `--target=<PATH>` | Extract runtime to target directory without normal registration; launch via target executable directly. |
| `--download=<PATH>` | Create offline install directory with packages and `index.json`. |
| `--configure -y` | Run configuration checker and accept changes; documented for programmatic install setup. |

Runtime uninstall:

```text
py uninstall [-y|--yes] <TAG>...
py uninstall [-y|--yes] --purge
```

| Option / argument | Effect |
|---|---|
| `<TAG>...` | Remove one or more managed runtime tags; ranges unsupported. |
| `-y`, `--yes` | Bypass confirmation. |
| `--purge` | Remove all runtimes managed by Python install manager, plus Start menu, registry, and download caches; unmanaged runtimes and manually created config files unaffected. |

Windows shebang virtual commands supported by `python` / `py`:

| Shebang pattern | Effect |
|---|---|
| `/usr/bin/env <ALIAS>` | Locate alias; may search `PATH` for unrecognized commands unless disabled. |
| `/usr/bin/env -S <ALIAS>` | Same with env `-S` style argument parsing. |
| `/usr/bin/<ALIAS>` | Resolve alias. |
| `/usr/local/bin/<ALIAS>` | Resolve alias. |
| `<ALIAS>` | Resolve alias. |

Windows install manager configuration:

| Config key | Environment variable | Effect / default |
|---|---|---|
| `default_tag` | `PYTHON_MANAGER_DEFAULT` | Preferred default version to launch/install; default is most recent non-prerelease CPython. |
| `default_platform` | `PYTHON_MANAGER_DEFAULT_PLATFORM` | Preferred platform suffix, e.g. `-64`, when matching tags. |
| `logs_dir` | `PYTHON_MANAGER_LOGS` | Log file directory; default `%TEMP%`. |
| `automatic_install` | `PYTHON_MANAGER_AUTOMATIC_INSTALL` | Allow automatic install when using `py exec` or when no runtimes exist; default true. |
| `include_unmanaged` | `PYTHON_MANAGER_INCLUDE_UNMANAGED` | Include unmanaged runtimes in listing/launching; default true. |
| `shebang_can_run_anything` | `PYTHON_MANAGER_SHEBANG_CAN_RUN_ANYTHING` | Allow shebangs to launch applications other than Python runtimes; default true. |
| `log_level` | `PYMANAGER_VERBOSE`, `PYMANAGER_DEBUG` | Set output/log level; default `20`; lower is more output. |
| `confirm` | `PYTHON_MANAGER_CONFIRM` | Confirm actions such as uninstall; default true. |
| `install.source` | `PYTHON_MANAGER_SOURCE_URL` | Override runtime install index feed. |
| `install.enable_entrypoints` | none | Generate global commands for installed package entry points; default true. Run `py install --refresh` after changes. |
| `list.format` | `PYTHON_MANAGER_LIST_FORMAT` | Default `py list` format; default `table`. |
| `install_dir` | none | Root directory for runtimes; moving this breaks previous installs unless moved. |
| `global_dir` | none | Directory for global commands such as `python3.14.exe` and `pip.exe`; add to `PATH`. |
| `download_dir` | none | Temporary cache for downloaded files. |

Windows administrative configuration keys:

| Config key | Effect |
|---|---|
| `base_config` | Highest-priority config file; only built-in config or registry can modify. |
| `user_config` | Second config file. |
| `additional_config` | Third config file. |
| `registry_override_key` | Registry location for overrides. |
| `bundled_dir` | Read-only directory of locally cached files. |
| `install.fallback_source` | Path/URL to fallback index when primary unavailable. |
| `install.enable_shortcut_kinds` | Comma-separated shortcut kinds to allow, e.g. `pep514,start`. |
| `install.disable_shortcut_kinds` | Comma-separated shortcut kinds to exclude. |
| `install.hard_link_entrypoints` | Use hard links for global shortcuts; run `py install --refresh --force` after changes. |
| `pep514_root` | Registry root for PEP 514 entries; default `HKEY_CURRENT_USER\Software\Python`. |
| `start_folder` | Start menu folder; default `Python`. |
| `virtual_env` | Active venv path; default `%VIRTUAL_ENV%`; empty disables venv detection. |
| `shebang_can_run_anything_silently` | Suppress warnings when shebang launches non-Python app. |
| `source_settings` | Per-source index signature settings. |

Windows launcher diagnostics and legacy launcher variables:

| Variable | Effect |
|---|---|
| `PYLAUNCHER_DEBUG` | Print launcher diagnostic information to stderr. |
| `PYLAUNCHER_DRYRUN` | Print command that would run; do not launch Python; stdout encoded as UTF-8. |
| `PYLAUNCHER_ALLOW_INSTALL` | Attempt Microsoft Store install if requested version missing and available; may require interaction and rerun. |
| `PYLAUNCHER_ALWAYS_INSTALL` | Always try install even if detected; intended for testing, use with `PYLAUNCHER_DRYRUN`. |
| `PYLAUNCHER_NO_SEARCH_PATH` | Skip PATH search for `/usr/bin/env` shebang handling in legacy launcher. |
| `PY_PYTHON` | Legacy launcher default version qualifier for `python`. |
| `PY_PYTHON3` | Legacy launcher default version qualifier for `python3`. |

Windows launcher return codes:

| Code name | Value | Meaning |
|---|---:|---|
| `RC_CREATE_PROCESS` | `101` | Failed to launch Python. |
| `RC_NO_PYTHON` | `103` | Unable to locate requested version. |
| `RC_NO_VENV_CFG` | `106` | A `pyvenv.cfg` was required but not found. |
| `RC_BAD_VENV_CFG` | `107` | A `pyvenv.cfg` was found but is corrupt. |
| `RC_NO_COMMANDLINE` | `108` | Unable to obtain command line from operating system. |
| `RC_INTERNAL_ERROR` | `109` | Unexpected error; report bug. |
| `RC_INSTALLING` | `111` | Install started; command must be re-run after it completes. |

## Setup & auth

Install paths:

| Platform | Recommended / common install path |
|---|---|
| Windows | Install Python Install Manager from `python.org/downloads` or Microsoft Store; commands should include `python`, `py`, `pymanager`, `pythonw`, `pyw`, `pymanagerw`. Programmatic install path: `winget install 9NQ7512CXL7T -e --accept-package-agreements --disable-interactivity`, then optionally `py install --configure -y`. Windows Server 2019: use MSI when MSIX is unsupported. |
| macOS | Use signed/notarized `python.org` `.pkg` installer for supported releases, or third-party package managers such as Homebrew/MacPorts/Anaconda when that distribution owns the environment. Official installer places framework under `/Library/Frameworks/Python.framework` and symlinks under `/usr/local/bin/`. Do not modify Apple-controlled `/usr/bin/python3`. |
| Linux | Use distro package where sufficient (`python3`, `python3-venv`, `python3-pip` package names vary), or build CPython from source. For source installs, prefer `make altinstall` over `make install` to avoid overwriting/masquerading `python3`. |
| FreeBSD | `pkg install python3`. |
| OpenBSD | `pkg_add -r python` or install versioned package from OpenBSD package mirror. |
| Source build | `./configure && make && make altinstall`; consult CPython build requirements and platform README for flags. |

Credentials/auth: none for the interpreter. Package installation through `python -m pip` may require package-index credentials, TLS trust configuration, or OS package manager privileges; store credentials in the package manager’s documented config/keyring, never in `SKILL.md`.

State and filesystem locations:

| State | Location / notes |
|---|---|
| Bytecode cache | `__pycache__/` beside sources unless `-B`/`PYTHONDONTWRITEBYTECODE`; alternate tree with `-X pycache_prefix=PATH` / `PYTHONPYCACHEPREFIX`. |
| REPL history | `.python_history` in user home by default; override with `PYTHON_HISTORY`. |
| Virtual environment | Directory chosen by `python -m venv`; contains `pyvenv.cfg`, interpreter executable under `bin/` or `Scripts\`, and site-packages. Not movable/copyable; recreate instead. |
| Windows Python install manager user config | `%AppData%\Python\pymanager.json` by default; extra config via `PYTHON_MANAGER_CONFIG` or `--config=<PATH>`. |
| Windows Python install manager logs | `%TEMP%` by default; override with `PYTHON_MANAGER_LOGS` / `logs_dir`. |
| Windows global aliases | `%LocalAppData%\Python\bin` by default for global aliases in current docs; add to `PATH` when full aliases such as `python3.14.exe` or installed package scripts are needed. |
| Windows App Execution Alias path | `%UserProfile%\AppData\Local\Microsoft\WindowsApps`; required for Store/MSIX aliases. |
| macOS official installer | `/Applications/Python 3.x/`, `/Library/Frameworks/Python.framework`, symlinks under `/usr/local/bin/`. Run `Install Certificates.command` after install to install SSL root certificates for bundled Python. |

Platform-specific notes:

| Platform | Note |
|---|---|
| Windows | Prefer `python -m pip` over bare `pip` to bind package operations to the selected runtime. Use `py list` to inspect default/current runtimes. Use `py -V:<TAG>` for version selection. |
| Windows PowerShell | `Activate.ps1` may require `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`. |
| Windows venv symlinks | Symlinks are supported but not recommended; double-clicking `python.exe` in File Explorer resolves symlink eagerly and ignores the venv. |
| macOS | Finder-launched scripts do not run in the normal shell environment and may miss shell profile environment variables. |
| Unix | Use shebang `#!/usr/bin/env python3` for PATH-based interpreter selection; make scripts executable with `chmod +x script`. |

## Common workflows

Check the interpreter selected by the shell:

```bash
python -VV
python -c "import sys; print(sys.executable); print(sys.version)"
```

Outputs version/build details and the exact executable path.

Run a module instead of a potentially mismatched script wrapper:

```bash
python -m pip --version
python -m pip install -U pip
```

Runs `pip` through the selected interpreter; package changes land in that interpreter environment.

Create and activate a project virtual environment:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -U pip
```

Creates `.venv/`, prepends its executable directory when activated, and installs packages into the venv.

Run a script/module with safer import path handling:

```bash
python -P -m package.module arg1 arg2
python -I script.py
```

Avoids prepending current/script directory; `-I` also ignores `PYTHON*` env vars and user site-packages.

Inspect import startup cost and crashes:

```bash
PYTHONFAULTHANDLER=1 python -X importtime -c "import your_package"
python -X tracemalloc=25 script.py
```

Prints fault tracebacks on fatal signals, import timing to stderr, or memory allocation tracebacks.

Windows runtime selection and install manager inspection:

```powershell
py list --format=json
py -V:3.14 -m venv .venv
py install --dry-run 3.14
```

Shows installed runtimes, creates a venv with a specific runtime tag, or previews runtime installation without writing.

## Error handling

| Symptom | Likely cause | Fix |
|---|---|---|
| `python` gives me a “command not found” error or opens the Store app when I type it in my terminal. | Windows Python Install Manager missing, app execution aliases disabled/stale, or WindowsApps path missing. | Install Python Install Manager; refresh “Python (default)” / “Python (default windowed)” / “Python install manager” aliases; ensure `%UserProfile%\AppData\Local\Microsoft\WindowsApps` is on `PATH`; test `py` and `pymanager`. |
| `py` gives me a “command not found” error when I type it in my terminal. | Python Install Manager missing, aliases disabled/stale, or WindowsApps path missing. | Install Python Install Manager; refresh aliases; ensure `%UserProfile%\AppData\Local\Microsoft\WindowsApps` is on `PATH`. |
| `py` gives me a “can’t open file” error when I type commands in my terminal. | Legacy launcher has priority over Python Install Manager. | Remove “Python launcher” from Windows Installed Apps, or use `pymanager` for manager operations. |
| `python` doesn’t launch the same runtime as `py` | Existing Python runtime or PATH entry overrides alias. | Remove/modify existing Python runtimes and disable PATH options; set `python.exe` app execution alias to “Python (default)”. |
| `python` and `py` don’t launch the runtime I expect | `PYTHON_MANAGER_DEFAULT` / `default_tag` selects another runtime; managed installs outrank unmanaged; prerelease/unmanaged runtime selected. | Check `py list`; configure default tag; install expected runtime with `py install`; uninstall prerelease or reinstall with `py install`. |
| `pythonw` or `pyw` don’t launch the same runtime as `python` or `py` | Windowed aliases inconsistent with console aliases. | Refresh `pythonw.exe` and `pyw.exe` app execution aliases to match other Python aliases. |
| `pip` gives me a “command not found” error when I type it in my terminal. | Venv not activated, generated executable missing, or global shortcuts directory absent from `PATH`. | Activate `.venv\Scripts\activate`; prefer `python -m pip`; run `py install --refresh`; add global shortcuts directory to `PATH`. |
| I installed a package with `pip` but its command is not found. | Venv not activated or Python Install Manager has not refreshed global shortcuts for package entry points. | Activate `.venv\Scripts\activate`; run `py install --refresh`. |
| Typing `script-name.py` in the terminal opens in a new window. | Windows OS file association limitation. | Prefix with `py`, create same-name batch wrapper containing `@py "%~dpn0.py" %*`, or install/select legacy launcher association. |
| Drag-dropping files onto a script doesn’t work | Windows OS limitation with current install path. | Use legacy launcher support or Python Install Manager installed from MSI. |
| My old `py.ini` settings no longer work. | New Python Install Manager does not support old launcher configuration file/settings. | Move settings to Python Install Manager configuration (`%AppData%\Python\pymanager.json`, env vars, or `--config`). |
| `RC_CREATE_PROCESS` / exit code `101` | Launcher failed to start Python process. | Verify target runtime path with `py list --format=exe`; reinstall/refresh runtime with `py install --refresh` or `py install --force <TAG>`. |
| `RC_NO_PYTHON` / exit code `103` | Requested runtime version unavailable. | Inspect `py list` and `py list --online`; install requested tag with `py install <TAG>` or adjust `-V:<TAG>`. |
| `RC_NO_VENV_CFG` / exit code `106` | Launcher expected venv metadata but `pyvenv.cfg` missing. | Recreate venv with `python -m venv <env>`; avoid moving/copying venv directories. |
| `RC_BAD_VENV_CFG` / exit code `107` | Found corrupt `pyvenv.cfg`. | Recreate venv; restore `pyvenv.cfg` from known-good source only if environment is otherwise intact. |
| `RC_NO_COMMANDLINE` / exit code `108` | Launcher could not obtain command line from OS. | Re-run in a normal terminal; collect logs and report bug if repeatable. |
| `RC_INTERNAL_ERROR` / exit code `109` | Unexpected launcher failure. | Collect `%TEMP%` logs or configured log directory and report bug. |
| `RC_INSTALLING` / exit code `111` | Requested install started and command must be re-run. | Wait for install process to complete, then run the original command again. |
| `No module named '_tkinter'` | Tk interface package missing from Python install. | Install platform Tk/Tcl package or use a Python distribution that includes Tk; for Linux, install distro-specific Tk/IDLE package. |

## Traps

_Append-only. Date-stamped. Filled by the operator via the `/lesson` slash command when something bites._

## Lessons

_Append-only. Date-stamped. Filled by the operator via the `/lesson` slash command for behaviors learned that aren't in upstream docs._
