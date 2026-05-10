---
name: tool-rg
description: Load when working with rg, ripgrep search, recursive grep, gitignore filtering, regex engines, file type filters, or JSON search output. Covers full rg CLI surface, setup, errors, and lessons.
triggers:
  bash:
    - rg
    - rg.exe
    - ripgrep
---

# rg

## What it is

**Assumption:** identifier `rg` interpreted as ripgrep at `https://github.com/BurntSushi/ripgrep`. ripgrep is a system CLI binary for recursive line-oriented regex search. It searches files and directory trees while applying smart default filters: ignore rules, hidden path skipping, binary file skipping, and Unicode-aware matching. Reach for it for source-code search, log/text search, file discovery, type-filtered search, and structured machine-readable search output; common alternatives include GNU grep, git grep, The Silver Searcher (`ag`), ack, ugrep, and ripgrep-all (`rga`) for archive/document formats.

## Capability surface

Baseline: ripgrep 15.1.0 `rg --help`/generated man page surface. ripgrep has no subcommands; capability is selected by flags and output modes.

### Invocation forms

```bash
rg [OPTIONS] PATTERN [PATH...]
rg [OPTIONS] -e PATTERN... [PATH...]
rg [OPTIONS] -f PATTERNFILE... [PATH...]
rg [OPTIONS] --files [PATH...]
rg [OPTIONS] --type-list
command | rg [OPTIONS] PATTERN
rg [OPTIONS] --help
rg [OPTIONS] --version
```

### Positional arguments

| Argument | Meaning |
|---|---|
| `PATTERN` | Regular expression to search. Use `-e/--regexp` or `--` for patterns beginning with `-`. |
| `PATH...` | Files or directories to search recursively. Explicit command-line paths override glob and ignore rules. |

### Option inversion rule

Many boolean options have inverse forms. The last flag wins. Examples: `--column` / `--no-column`, `--no-ignore` / `--ignore`, `--hidden` / `--no-hidden`, `--json` / `--no-json`, `--stats` / `--no-stats`.

### Input options

| Flag | Values | Effect | Inverse / notes |
|---|---:|---|---|
| `-e PATTERN`, `--regexp=PATTERN` | repeatable | Add a search pattern. Lines matching at least one `-e` or `-f` pattern print. Also handles patterns beginning with `-`. | With `-e` or `-f`, all positionals are search paths. |
| `-f PATTERNFILE`, `--file=PATTERNFILE` | repeatable; `-` = stdin | Read one pattern per line. Empty pattern lines match every input line. | With `-e` or `-f`, all positionals are search paths. |
| `--pre=COMMAND` | executable path/name | Search stdout of `COMMAND PATH` for each input path instead of raw file contents. | Empty command or `--no-pre` disables. Overrides `-z/--search-zip`. |
| `--pre-glob=GLOB` | repeatable; `!GLOB` excludes | With `--pre`, run preprocessor only on matching globs; non-matching files are searched normally. | No effect without `--pre`. Globs use gitignore glob rules. |
| `-z`, `--search-zip` | boolean | Search compressed files by shelling out to decompression binaries. Supports gzip, bzip2, xz, LZ4, LZMA, Brotli, Zstd. | `--no-search-zip`. Overrides `--pre`. Does not traverse archive formats as directories. |

### Search options

| Flag | Values | Effect | Inverse / notes |
|---|---:|---|---|
| `-s`, `--case-sensitive` | boolean | Case-sensitive search. | Default. Overrides `-i` and `-S`. |
| `--crlf` | boolean | Treat CRLF as a line terminator for anchors such as `^` and `$`. | `--no-crlf`. Overrides `--null-data`. |
| `--dfa-size-limit=NUM+SUFFIX?` | bytes; suffix `K`, `M`, `G` | Set regex DFA cache/size limit before fallback engine is used. | Tune for very large regex/pattern sets. |
| `-E ENCODING`, `--encoding=ENCODING` | `auto`, `none`, WHATWG encoding label | Set text encoding for all searched files. `auto` detects UTF-8/UTF-16 BOM only. `none` disables BOM sniffing. | `--no-encoding` resets to automatic mode. |
| `--engine=ENGINE` | `default`, `pcre2`, `auto` | Select regex engine for all patterns. | Overrides `-P` and `--auto-hybrid-regex`. PCRE2 is optional at build time. |
| `-F`, `--fixed-strings` | boolean | Treat all patterns as literals, not regexes. | `--no-fixed-strings`. |
| `-i`, `--ignore-case` | boolean | Unicode-aware case-insensitive search. | Overrides `-s` and `-S`. |
| `-v`, `--invert-match` | boolean | Print non-matching lines instead of matching lines. | `--no-invert-match`. Inverts line-by-line matching. |
| `-x`, `--line-regexp` | boolean | Match only when the entire line participates in a match. | Overrides `-w`. |
| `-m NUM`, `--max-count=NUM` | integer | Limit matching lines per file. `0` searches nothing. | Context lines can print more matches than the maximum. |
| `--mmap` | boolean | Use memory maps when possible. | `--no-mmap`. May abort if a searched file is truncated concurrently. |
| `-U`, `--multiline` | boolean | Permit matches that span line terminators. | `--no-multiline`. Overrides `--stop-on-nonmatch`. May use more memory. |
| `--multiline-dotall` | boolean | In multiline mode, make `.` match line terminators by default. | `--no-multiline-dotall`. No effect without `-U`. |
| `--no-unicode` | boolean | Disable Unicode mode for all patterns. | `--unicode`. Affects `.`, `\w`, `\s`, `\d`, Unicode classes, case folding, and word boundaries. |
| `--null-data` | boolean | Use NUL as line terminator. | Implies `-a/--text`. Overrides `--crlf`. |
| `-P`, `--pcre2` | boolean | Use PCRE2 regex engine. Enables look-around/backreferences if build supports PCRE2. | `--no-pcre2`. Equivalent to `--engine=pcre2`. |
| `--regex-size-limit=NUM+SUFFIX?` | bytes; suffix `K`, `M`, `G` | Set compiled regex size limit. | Increase only for intentionally large patterns. |
| `-S`, `--smart-case` | boolean | Case-insensitive only when all pattern literals are lowercase. | Overrides `-s` and `-i`. |
| `--stop-on-nonmatch` | boolean | Stop reading a file after a non-matching line follows a matching line. | Overrides `-U/--multiline`. Useful for sorted/grouped data. |
| `-a`, `--text` | boolean | Search binary files as text; disable binary detection and permit binary output. | `--no-text`. Overrides `--binary`. |
| `-j NUM`, `--threads=NUM` | integer; `0` = heuristic default | Approximate thread count. | Sorting forces single-threaded search. |
| `-w`, `--word-regexp` | boolean | Match only when surrounded by word boundaries. | Overrides `-x`. |
| `--auto-hybrid-regex` | boolean | Deprecated. Dynamically choose default engine or PCRE2 based on pattern features. | `--no-auto-hybrid-regex`. Use `--engine=auto`. |
| `--no-pcre2-unicode` | boolean | Deprecated. Disable PCRE2 Unicode mode. | `--pcre2-unicode`. Use `--no-unicode`. |

### Filter options

| Flag | Values | Effect | Inverse / notes |
|---|---:|---|---|
| `--binary` | boolean | Search binary files, but still stop after a NUL byte once a match is found and warn. | `--no-binary`. `-uuu` enables this. Overrides `-a`. |
| `-L`, `--follow` | boolean | Follow symbolic links during traversal. | `--no-follow`. Reports loops/broken links unless messages suppressed. |
| `-g GLOB`, `--glob=GLOB` | repeatable; `!GLOB` excludes | Include/exclude paths matching gitignore-style glob. Later matching globs win. | Overrides ignore logic. Use `-g 'foo/**'`, not `-g foo`, for a directory tree. |
| `--glob-case-insensitive` | boolean | Match `-g/--glob` patterns case-insensitively. | `--no-glob-case-insensitive`. Equivalent behavior to `--iglob`. |
| `-.`, `--hidden` | boolean | Search hidden files/directories. On Windows, hidden attribute also counts. | `--no-hidden`. Includes `.git` unless separately ignored. |
| `--iglob=GLOB` | repeatable; `!GLOB` excludes | Case-insensitive include/exclude glob. | Same precedence as `--glob`. |
| `--ignore-file=PATH` | repeatable | Add gitignore-format rules. Applied after automatic `.gitignore`, `.rgignore`, `.ignore`; later files have higher precedence. | Ignored when `--no-ignore-files` is set. |
| `--ignore-file-case-insensitive` | boolean | Process ignore files case-insensitively. | `--no-ignore-file-case-insensitive`. Useful on case-insensitive file systems. |
| `-d NUM`, `--max-depth=NUM`, `--maxdepth=NUM` | integer | Limit traversal depth beyond supplied paths. `0` searches only explicit paths. | Directories at depth 0 are not descended. |
| `--max-filesize=NUM+SUFFIX?` | bytes; suffix `K`, `M`, `G` | Ignore files larger than size. | Does not apply to directories. |
| `--no-ignore` | boolean | Ignore `.gitignore`, `.ignore`, `.rgignore`, git exclude, global, parent, and VCS ignore sources. | `--ignore`. Equivalent to single `-u`, except explicit `--ignore-file` still applies. |
| `--no-ignore-dot` | boolean | Ignore `.ignore` and `.rgignore` files. | `--ignore-dot`. Does not affect hidden path filtering. |
| `--no-ignore-exclude` | boolean | Ignore repository exclude files such as `.git/info/exclude`. | `--ignore-exclude`. |
| `--no-ignore-files` | boolean | Ignore paths supplied by `--ignore-file`. | `--ignore-files`. Applies even to later `--ignore-file` flags. |
| `--no-ignore-global` | boolean | Ignore global sources such as git `core.excludesFile`. | `--ignore-global`. |
| `--no-ignore-parent` | boolean | Do not ascend parent directories for ignore files. | `--ignore-parent`. |
| `--no-ignore-vcs` | boolean | Ignore source-control ignore files such as `.gitignore`. | `--ignore-vcs`. Implies `--no-ignore-parent` for VCS ignore files. |
| `--no-require-git` | boolean | Respect VCS ignore files even when no repository marker is detected. | `--require-git`. |
| `--one-file-system` | boolean | Do not cross file-system boundaries relative to each starting path. | `--no-one-file-system`. Similar to `find -xdev`. |
| `-t TYPE`, `--type=TYPE` | repeatable; special `all` | Search only files matching named type. | Lower precedence than `-g` and ignore rules. Use `--type-list`. |
| `-T TYPE`, `--type-not=TYPE` | repeatable; special `all` | Exclude files matching named type. | Use `--type-list`. |
| `--type-add=TYPESPEC` | repeatable | Add a glob for a type. Syntax: `name:glob` or `name:include:type1,type2`. | Not persisted unless added to config. Type names are Unicode letters/numbers only. |
| `--type-clear=TYPE` | type name | Clear previously defined globs for a type; later `--type-add` can add new ones. | Not persisted unless added to config. |
| `-u`, `--unrestricted` | repeatable up to 3 | Reduce smart filtering. `-u` = `--no-ignore`; `-uu` = `--no-ignore --hidden`; `-uuu` = `--no-ignore --hidden --binary`. | Symlinks still skipped without `-L`; binary matches still not printed as text without `-a`. |

### Default file type names and globs

`TYPE` accepts any name or alias listed below, plus custom names added with `--type-add`. `all` is a special synthetic type for all defined types.

```text
ada: *.adb, *.ads
agda: *.agda, *.lagda
aidl: *.aidl
alire: alire.toml
amake: *.mk, *.bp
asciidoc: *.adoc, *.asc, *.asciidoc
asm: *.asm, *.s, *.S
asp: *.aspx, *.aspx.cs, *.aspx.vb, *.ascx, *.ascx.cs, *.ascx.vb, *.asp
ats: *.ats, *.dats, *.sats, *.hats
avro: *.avdl, *.avpr, *.avsc
awk: *.awk
bat, batch: *.bat
bazel: *.bazel, *.bzl, *.BUILD, *.bazelrc, BUILD, MODULE.bazel, WORKSPACE, WORKSPACE.bazel, WORKSPACE.bzlmod
bitbake: *.bb, *.bbappend, *.bbclass, *.conf, *.inc
boxlang: *.bx, *.bxm, *.bxs
brotli: *.br
buildstream: *.bst
bzip2: *.bz2, *.tbz2
c: *.[chH], *.[chH].in, *.cats
cabal: *.cabal
candid: *.did
carp: *.carp
cbor: *.cbor
ceylon: *.ceylon
cfml: *.cfc, *.cfm
clojure: *.clj, *.cljc, *.cljs, *.cljx
cmake: *.cmake, CMakeLists.txt
cmd: *.bat, *.cmd
cml: *.cml
coffeescript: *.coffee
config: *.cfg, *.conf, *.config, *.ini
container: *Containerfile*, *Dockerfile*
coq: *.v
cpp: *.[ChH], *.cc, *.[ch]pp, *.[ch]xx, *.hh, *.inl, *.[ChH].in, *.cc.in, *.[ch]pp.in, *.[ch]xx.in, *.hh.in
creole: *.creole
crystal: Projectfile, *.cr, *.ecr, shard.yml
cs: *.cs
csharp: *.cs
cshtml: *.cshtml
csproj: *.csproj
css: *.css, *.scss
csv: *.csv
cuda: *.cu, *.cuh
cython: *.pyx, *.pxi, *.pxd
d: *.d
dart: *.dart
devicetree: *.dts, *.dtsi, *.dtso
dhall: *.dhall
diff: *.patch, *.diff
dita: *.dita, *.ditamap, *.ditaval
docker: *Dockerfile*
dockercompose: docker-compose.yml, docker-compose.*.yml
dts: *.dts, *.dtsi
dvc: Dvcfile, *.dvc
ebuild: *.ebuild, *.eclass
edn: *.edn
elisp: *.el
elixir: *.ex, *.eex, *.exs, *.heex, *.leex, *.livemd
elm: *.elm
erb: *.erb
erlang: *.erl, *.hrl
fennel: *.fnl
fidl: *.fidl
fish: *.fish
flatbuffers: *.fbs
fortran: *.f, *.F, *.f77, *.F77, *.pfo, *.f90, *.F90, *.f95, *.F95
fsharp: *.fs, *.fsx, *.fsi
fut: *.fut
gap: *.g, *.gap, *.gi, *.gd, *.tst
gdscript: *.gd
gleam: *.gleam
gn: *.gn, *.gni
go: *.go
gprbuild: *.gpr
gradle: *.gradle, *.gradle.kts, gradle.properties, gradle-wrapper.*, gradlew, gradlew.bat
graphql: *.graphql, *.graphqls
groovy: *.groovy, *.gradle
gzip: *.gz, *.tgz
h: *.h, *.hh, *.hpp
haml: *.haml
hare: *.ha
haskell: *.hs, *.lhs, *.cpphs, *.c2hs, *.hsc
hbs: *.hbs
hs: *.hs, *.lhs
html: *.htm, *.html, *.ejs
hy: *.hy
idris: *.idr, *.lidr
janet: *.janet
java: *.java, *.jsp, *.jspx, *.properties
jinja: *.j2, *.jinja, *.jinja2
jl: *.jl
js: *.js, *.jsx, *.vue, *.cjs, *.mjs
json: *.json, composer.lock, *.sarif
jsonl: *.jsonl
julia: *.jl
jupyter: *.ipynb, *.jpynb
k: *.k
kconfig: Kconfig, Kconfig.*
kotlin: *.kt, *.kts
lean: *.lean
less: *.less
license: COPYING, COPYING[.-]*, COPYRIGHT, COPYRIGHT[.-]*, EULA, EULA[.-]*, licen[cs]e, licen[cs]e.*, LICEN[CS]E, LICEN[CS]E[.-]*, *[.-]LICEN[CS]E*, NOTICE, NOTICE[.-]*, PATENTS, PATENTS[.-]*, UNLICEN[CS]E, UNLICEN[CS]E[.-]*, agpl[.-]*, gpl[.-]*, lgpl[.-]*, AGPL-*[0-9]*, APACHE-*[0-9]*, BSD-*[0-9]*, CC-BY-*, GFDL-*[0-9]*, GNU-*[0-9]*, GPL-*[0-9]*, LGPL-*[0-9]*, MIT-*[0-9]*, MPL-*[0-9]*, OFL-*[0-9]*
lilypond: *.ly, *.ily
lisp: *.el, *.jl, *.lisp, *.lsp, *.sc, *.scm
llvm: *.ll
lock: *.lock, package-lock.json
log: *.log
lua: *.lua
lz4: *.lz4
lzma: *.lzma
m4: *.ac, *.m4
make: [Gg][Nn][Uu]makefile, [Mm]akefile, [Gg][Nn][Uu]makefile.am, [Mm]akefile.am, [Gg][Nn][Uu]makefile.in, [Mm]akefile.in, Makefile.*, *.mk, *.mak
mako: *.mako, *.mao
man: *.[0-9lnpx], *.[0-9][cEFMmpSx]
markdown, md: *.markdown, *.md, *.mdown, *.mdwn, *.mkd, *.mkdn, *.mdx
matlab: *.m
meson: meson.build, meson_options.txt, meson.options
minified: *.min.html, *.min.css, *.min.js
mint: *.mint
mk: mkfile
ml: *.ml
motoko: *.mo
msbuild: *.csproj, *.fsproj, *.vcxproj, *.proj, *.props, *.targets, *.sln, *.slnf
nim: *.nim, *.nimf, *.nimble, *.nims
nix: *.nix
objc: *.h, *.m
objcpp: *.h, *.mm
ocaml: *.ml, *.mli, *.mll, *.mly
org: *.org, *.org_archive
pants: BUILD
pascal: *.pas, *.dpr, *.lpr, *.pp, *.inc
pdf: *.pdf
perl: *.perl, *.pl, *.PL, *.plh, *.plx, *.pm, *.t
php: *.php, *.php3, *.php4, *.php5, *.php7, *.php8, *.pht, *.phtml
po: *.po
pod: *.pod
postscript: *.eps, *.ps
prolog: *.pl, *.pro, *.prolog, *.P
protobuf: *.proto
ps: *.cdxml, *.ps1, *.ps1xml, *.psd1, *.psm1
puppet: *.epp, *.erb, *.pp, *.rb
purs: *.purs
py, python: *.py, *.pyi
qmake: *.pro, *.pri, *.prf
qml: *.qml
qrc: *.qrc
qui: *.ui
r: *.R, *.r, *.Rmd, *.rmd, *.Rnw, *.rnw
racket: *.rkt
raku: *.raku, *.rakumod, *.rakudoc, *.rakutest, *.p6, *.pl6, *.pm6
rdoc: *.rdoc
readme: README*, *README
reasonml: *.re, *.rei
red: *.r, *.red, *.reds
rescript: *.res, *.resi
robot: *.robot
rst: *.rst
ruby: config.ru, Gemfile, .irbrc, Rakefile, *.gemspec, *.rb, *.rbw, *.rake
rust: *.rs
sass: *.sass, *.scss
scala: *.scala, *.sbt
scdoc: *.scd, *.scdoc
seed7: *.sd7, *.s7i
sh: .env, .login, .logout, .profile, profile, .bash_login, bash_login, .bash_logout, bash_logout, .bash_profile, bash_profile, .bashrc, bashrc, *.bashrc, .cshrc, *.cshrc, .kshrc, *.kshrc, .tcshrc, .zshenv, zshenv, .zlogin, zlogin, .zlogout, zlogout, .zprofile, zprofile, .zshrc, zshrc, *.bash, *.csh, *.env, *.ksh, *.sh, *.tcsh, *.zsh
slim: *.skim, *.slim, *.slime
smarty: *.tpl
sml: *.sml, *.sig
solidity: *.sol
soy: *.soy
spark: *.spark
spec: *.spec
sql: *.sql, *.psql
ssa: *.ssa
stylus: *.styl
sv: *.v, *.vg, *.sv, *.svh, *.h
svelte: *.svelte, *.svelte.ts
svg: *.svg
swift: *.swift
swig: *.def, *.i
systemd: *.automount, *.conf, *.device, *.link, *.mount, *.path, *.scope, *.service, *.slice, *.socket, *.swap, *.target, *.timer
taskpaper: *.taskpaper
tcl: *.tcl
tex: *.tex, *.ltx, *.cls, *.sty, *.bib, *.dtx, *.ins
texinfo: *.texi
textile: *.textile
tf: *.tf, *.tf.json, *.tfvars, *.tfvars.json, *.terraformrc, terraform.rc, *.tfrc, *.terraform.lock.hcl
thrift: *.thrift
toml: *.toml, Cargo.lock
ts, typescript: *.ts, *.tsx, *.cts, *.mts
twig: *.twig
txt: *.txt
typoscript: *.typoscript, *.ts
typst: *.typ
usd: *.usd, *.usda, *.usdc
v: *.v, *.vsh
vala: *.vala
vb: *.vb
vcl: *.vcl
verilog: *.v, *.vh, *.sv, *.svh
vhdl: *.vhd, *.vhdl
vim: *.vim, .vimrc, .gvimrc, vimrc, gvimrc, _vimrc, _gvimrc
vimscript: *.vim, .vimrc, .gvimrc, vimrc, gvimrc, _vimrc, _gvimrc
vue: *.vue
webidl: *.idl, *.webidl, *.widl
wgsl: *.wgsl
wiki: *.mediawiki, *.wiki
xml: *.xml, *.xml.dist, *.dtd, *.xsl, *.xslt, *.xsd, *.xjb, *.rng, *.sch, *.xhtml
xz: *.xz, *.txz
yacc: *.y
yaml: *.yaml, *.yml
yang: *.yang
z: *.Z
zig: *.zig
zsh: .zshenv, zshenv, .zlogin, zlogin, .zlogout, zlogout, .zprofile, zprofile, .zshrc, zshrc, *.zsh
zstd: *.zst, *.zstd
```

### Output options

| Flag | Values | Effect | Inverse / notes |
|---|---:|---|---|
| `-A NUM`, `--after-context=NUM` | integer | Show lines after each match. | Overrides `--passthru`; partially overrides `-C`. |
| `-B NUM`, `--before-context=NUM` | integer | Show lines before each match. | Overrides `--passthru`; partially overrides `-C`. |
| `--block-buffered` | boolean | Force block buffering. | `--no-block-buffered`. Overrides `--line-buffered`. |
| `-b`, `--byte-offset` | boolean | Print 0-based byte offset before each output line; with `-o`, offset of match. | `--no-byte-offset`. Offset is after transcoding/decompression/preprocessing. |
| `--color=WHEN` | `never`, `auto`, `always`, `ansi` | Control color and hyperlink emission. | `auto` is default. Suppressed by `NO_COLOR`, `TERM=dumb`, `--json`, `--vimgrep`. |
| `--colors=COLOR_SPEC` | repeatable | Configure colors. Syntax: `type:attribute:value` or `type:none`. | Types: `path`, `line`, `column`, `highlight`, `match`. Attrs: `fg`, `bg`, `style`. |
| `--column` | boolean | Show 1-based column number for first match on each line; byte-based, not Unicode-column based. | `--no-column`. Implies `-n`. |
| `-C NUM`, `--context=NUM` | integer | Show lines before and after each match. | Equivalent to `-A NUM -B NUM`; overridden by `--passthru`. |
| `--context-separator=SEPARATOR` | string | Separator for non-contiguous context groups. | Default `--`. Empty string still emits line break; `--no-context-separator` disables. |
| `--field-context-separator=SEPARATOR` | string | Separator between file path/line/column/contextual line. | Default `-`. |
| `--field-match-separator=SEPARATOR` | string | Separator between file path/line/column/matching line. | Default `:`. |
| `--heading` | boolean | Print file path once above clusters of matches instead of as every-line prefix. | `--no-heading`. Default on TTY. |
| `-h`, `--help` | none | Print help. `-h` is condensed; `--help` is verbose/complete. | Exits without searching. |
| `--hostname-bin=COMMAND` | executable | Determine hostname for hyperlink formatting from command output. | Empty/default uses OS hostname lookup. |
| `--hyperlink-format=FORMAT` | alias or format string | Emit OSC-8 hyperlinks when colors/TTY permit. | Aliases: `default`, `none`, `cursor`, `file`, `grep+`, `kitty`, `macvim`, `textmate`, `vscode`, `vscode-insiders`, `vscodium`. Variables: `{path}`, `{host}`, `{line}`, `{column}`, `{wslprefix}`. |
| `--include-zero` | boolean | With `-c` or `--count-matches`, print zero counts for files without matches. | `--no-include-zero`. |
| `--line-buffered` | boolean | Force flushing after every matching line. | `--no-line-buffered`. Overrides `--block-buffered`. |
| `-n`, `--line-number` | boolean | Show 1-based line numbers. | `-N`, `--no-line-number`. Default on TTY. |
| `-N`, `--no-line-number` | boolean | Suppress line numbers. | Overridden by `-n`. Default when stdout is not a TTY. |
| `-M NUM`, `--max-columns=NUM` | bytes; `0` = disabled | Omit matching lines longer than limit; print match count instead. | Pair with `--max-columns-preview`. |
| `--max-columns-preview` | boolean | Show preview for lines exceeding `-M/--max-columns`. | `--no-max-columns-preview`. No effect without `-M`. |
| `-0`, `--null` | boolean | Terminate printed file paths with NUL. | Useful with `xargs -0`. Applies to match prefixes and file lists. |
| `-o`, `--only-matching` | boolean | Print only non-empty matched substrings, one per output line. | Works with `-r/--replace`. |
| `--path-separator=SEPARATOR` | single byte | Override printed path separator. | Empty string restores platform default (`/` Unix, `\` Windows). |
| `--passthru`, `--passthrough` | boolean | Print matching and non-matching lines, highlighting matches. | Overrides `-A`, `-B`, `-C`. |
| `-p`, `--pretty` | boolean | Alias for `--color=always --heading --line-number`. | Useful when piping to `less -R` or files. |
| `-q`, `--quiet` | boolean | Print nothing; stop after first match. | Exit-code mode. With `--files`, stop after first file not ignored. |
| `-r REPLACEMENT`, `--replace=REPLACEMENT` | replacement string | Replace matches in printed output only; never modifies files. Supports `$0`, `$1`, `$name`, `${1}`, `$$`. | Shell-quote replacement to avoid variable expansion. |
| `--sort=SORTBY` | `none`, `path`, `modified`, `accessed`, `created` | Sort ascending. | Overrides `--sortr`; disables parallelism. |
| `--sortr=SORTBY` | `none`, `path`, `modified`, `accessed`, `created` | Sort descending. | Overrides `--sort`; disables parallelism. |
| `--trim` | boolean | Remove leading ASCII whitespace from printed lines. | `--no-trim`. |
| `--vimgrep` | boolean | Print every match on its own line with line/column numbers. | Can produce quadratic output when many matches occur on a line. Prefer `--json` for integrations. |
| `-H`, `--with-filename` | boolean | Always print file path for each matching line. | Overrides `-I`. Default when multiple files searched. |
| `-I`, `--no-filename` | boolean | Never print file path with matching lines. | Overrides `-H`. Default for a single explicit file or stdin. |
| `--sort-files` | boolean | Deprecated. Sort by path ascending. | `--no-sort-files`. Use `--sort=path`. Disables parallelism. |

### Output modes

| Flag | Values | Effect | Inverse / notes |
|---|---:|---|---|
| `-c`, `--count` | boolean | Print count of matching lines per file; suppress normal output. | Overrides `--count-matches`; with `-o`, behaves like `--count-matches`. |
| `--count-matches` | boolean | Print count of individual matches per file; suppress normal output. | Overrides `-c`. |
| `-l`, `--files-with-matches` | boolean | Print only paths containing at least one match. | Overrides `--files-without-match`. |
| `--files-without-match` | boolean | Print only paths containing zero matches. | Overrides `-l`. |
| `--json` | boolean | Emit JSON Lines search messages. | `--no-json`. Incompatible with `--files`, `-l`, `--files-without-match`, `-c`, `--count-matches`; implies `--stats`. |

### JSON Lines message types

| Message | Meaning |
|---|---|
| `begin` | A file search began and contains at least one match. |
| `match` | A match was found; includes text/base64 bytes and offsets. |
| `context` | A contextual line was found; includes line text and optional match info for inverted searches. |
| `end` | File search completed; includes per-file summary statistics. |
| `summary` | Final aggregate search summary. |

JSON output represents non-UTF-8 paths/content as `bytes` with base64 data; valid UTF-8 data appears as `text`.

### Logging options

| Flag | Values | Effect | Inverse / notes |
|---|---:|---|---|
| `--debug` | boolean | Print debug messages, including why files were skipped. | Use before filing bugs or diagnosing filtering. |
| `--no-ignore-messages` | boolean | Suppress error messages from parsing ignore files. | `--ignore-messages`. |
| `--no-messages` | boolean | Suppress some file-open/file-read errors. | `--messages`. Regex syntax errors still print. |
| `--stats` | boolean | Print aggregate statistics: matched lines, files with matches, searched files, elapsed time. | `--no-stats`. No effect with `--files`, `-l`, or `--files-without-match`; implied by `--json`. |
| `--trace` | boolean | Print trace messages; implies `--debug`. | Use when `--debug` lacks enough detail. |

### Other behaviors

| Flag | Values | Effect | Inverse / notes |
|---|---:|---|---|
| `--files` | boolean | Print files that would be searched; do not search. | Overrides `--type-list`. |
| `--generate=KIND` | `man`, `complete-bash`, `complete-zsh`, `complete-fish`, `complete-powershell` | Generate man page or shell completion script to stdout. | Exits without searching. |
| `--no-config` | boolean | Do not read config from `RIPGREP_CONFIG_PATH`. | Also reserved for any future default config locations. |
| `--pcre2-version` | boolean | Print PCRE2 version/info and exit. | Errors if PCRE2 unavailable. |
| `--type-list` | boolean | Print supported type names and globs; accounts for `--type-add`/`--type-clear`. | Overridden by `--files`. |
| `-V`, `--version` | none | Print ripgrep version and build features. | Output may include SIMD/PCRE2/build revision. |

### Regex syntax and engine capability

| Engine/mode | Supports | Does not support / caveat |
|---|---|---|
| default Rust regex engine | Literal search, Unicode classes, bounded repetitions, alternation, capture groups, named capture groups, inline flags, linear-time search. | No look-around or backreferences. Newline literals require `-U`. |
| `-P`, `--engine=pcre2` | PCRE2 syntax, look-around, backreferences, JIT when available. | Optional build feature; often slower for Unicode/line-oriented search. |
| `--engine=auto` | Uses default engine when possible, PCRE2 when needed. | Match semantics/performance may change based on pattern. |
| `-U` multiline | Matches can span line terminators; `
` literals permitted. | `.` still excludes line terminators unless `(?s)` or `--multiline-dotall`. |
| `-F` fixed strings | Patterns are literal text. | Regex metacharacters lose regex meaning. |

### Automatic filtering controls

| Default filter | Default behavior | Disable / alter |
|---|---|---|
| Ignore rules | Respect `.gitignore`, `.ignore`, `.rgignore`, repository excludes, global git excludes, parent ignore files. | `--no-ignore`, specific `--no-ignore-*`, `-u`. |
| Hidden paths | Skip dotfiles/dotdirs and Windows hidden-attribute files. | `--hidden`, `-uu`. |
| Binary files | Skip or suppress binary data when NUL bytes appear. | `--binary`, `-uuu`; print binary as text with `-a`. |
| Symlinks | Do not follow symbolic links. | `-L/--follow`. |
| Stdin | Auto-detect readable stdin and search it. | Specify an explicit search path, e.g. `rg PATTERN ./`. |

### Exit status

| Code | Meaning |
|---:|---|
| `0` | At least one match found and no error occurred; with `-q`, match found can return `0` even if later errors would have occurred. |
| `1` | No match found and no error occurred. |
| `2` | Error occurred, including regex syntax errors or soft file-read errors. |

## Setup & auth

Install `rg` as the `ripgrep` package or from upstream release archives. No credentials, tokens, or auth setup exist.

Common installs:

```bash
brew install ripgrep
sudo port install ripgrep
choco install ripgrep
scoop install ripgrep
winget install BurntSushi.ripgrep.MSVC
sudo pacman -S ripgrep
sudo dnf install ripgrep
sudo zypper install ripgrep
sudo apt-get install ripgrep
cargo install ripgrep
cargo binstall ripgrep
```

Build from source:

```bash
git clone https://github.com/BurntSushi/ripgrep
cd ripgrep
cargo build --release
cargo build --release --features 'pcre2'
```

State and configuration:

| Location / source | Role |
|---|---|
| `RIPGREP_CONFIG_PATH` | Path to config file. File contains one shell argument per line. Lines beginning with `#` are ignored. |
| `.gitignore`, `.ignore`, `.rgignore` | Automatic ignore/filter rules during traversal. |
| `.git/info/exclude` | Repository-local VCS exclude rules. |
| git `core.excludesFile` | Global git excludes, commonly `$HOME/.config/git/ignore`. |
| `rg --generate complete-bash` | Bash completion script to stdout. |
| `rg --generate complete-zsh` | zsh completion script to stdout. |
| `rg --generate complete-fish` | fish completion script to stdout. |
| `rg --generate complete-powershell` | PowerShell completion script to stdout. |
| `rg --generate man` | roff man page to stdout. |

Platform notes:

| Platform | Note |
|---|---|
| Windows | Hidden file attribute is treated as hidden. `rg.exe` is the binary form. |
| Windows + PowerShell | Native executable pipeline encoding is governed by `$OutputEncoding`; set UTF-8 in profile when piping non-ASCII text. |
| Windows + Cygwin/MSYS | Leading `/` patterns can be path-translated; use `//pattern` or `MSYS_NO_PATHCONV=1`. |
| Ubuntu snaps | Upstream README says snap packages are not recommended because they generate strange file permission/file-not-found reports. |
| Cargo install | Default Cargo install may omit PCRE2 depending on features/build; check `rg --version` and `rg --pcre2-version`. |

## Common workflows

Search recursively from current directory with default smart filtering:

```bash
rg 'TODO|FIXME'
```

Prints matching lines with paths, line numbers, colors/headings on TTY; skips ignored, hidden, and binary files.

Search only specific file types:

```bash
rg -tpy -trust 'unwrap|panic|TODO' ./src ./tests
```

Searches Python and Rust type definitions only; type names come from `rg --type-list` and `--type-add`.

Search despite ignore/hidden/binary filtering:

```bash
rg -uuu 'needle' .
```

Disables ignore rules, includes hidden paths, and searches binary files; still use `-a` to print binary data as text.

Use PCRE2 look-around or backreferences:

```bash
rg -P 'foo(?!.*bar)|(?P<word>\w+)\s+\k<word>'
```

Uses PCRE2 if the build includes it; otherwise exits with the PCRE2 unavailable error.

Inspect search targets before searching:

```bash
rg --files -g '*.md' -g '!target/**'
```

Prints paths that would be searched after ignore/glob/type filters; performs no content search.

## Error handling

| Symptom | Likely cause | Fix |
|---|---|---|
| `PCRE2 is not available in this build of ripgrep` | `-P/--pcre2`, `--engine=pcre2`, or `--pcre2-version` used with a build lacking PCRE2. | Install an upstream binary/package with PCRE2, build with `cargo build --release --features 'pcre2'`, or avoid PCRE2-only syntax. |
| `No files were searched, which means ripgrep probably applied a filter you didn't expect. Try running again with --debug.` | Ignore rules, hidden-file filtering, binary filtering, type filters, max depth, bad path, or empty input removed all search targets. | Re-run with `--debug`; relax filters with `-u`, `-uu`, `-uuu`, `--hidden`, `--no-ignore`, `--type-list`, or corrected paths/globs. |
| `Error parsing regex near 'foo(?!.*ba' at character offset 5: Unrecognized flag: '!'. (Allowed flags: i, m, s, U, u, x.)` | Default regex engine does not support look-around. | Use `-P/--pcre2` or `--engine=pcre2` on a PCRE2-enabled build, or rewrite pattern without look-around. |
| `the literal '"\n"' is not allowed in a regex` | Pattern contains a newline literal without multiline mode. | Add `-U/--multiline`; add `--multiline-dotall` or inline `(?s)` when `.` must match line terminators. |
| `Compiled regex exceeds size limit of 10485760 bytes.` | Pattern or pattern set compiles into a regex larger than default limit. | Increase `--regex-size-limit`, e.g. `--regex-size-limit 1G`, or simplify/split the pattern set. |
| `invalid-utf8: PCRE2: error matching: UTF-8 error: illegal byte (0xfe or 0xff)` | PCRE2 search with `--no-encoding` encountered invalid UTF-8. | Remove `--no-encoding`, use default engine, set a correct `-E/--encoding`, or disable Unicode only when acceptable. |
| `*.go: No such file or directory (os error 2)` | Shell glob did not expand and ripgrep treated the glob as a literal path. | Use type or glob filters: `rg -tgo PATTERN`, `rg -g '*.go' PATTERN`, or quote globs intentionally for ripgrep. |
| `/cygdrive/...: The system cannot find the path specified. (os error 3)` | Windows/Cygwin/MSYS path translation or incompatible path syntax. | Use native Windows paths, escape leading `/` as `//`, set `MSYS_NO_PATHCONV=1`, or run the native `rg.exe` outside path-translation shells. |

## Traps

_Append-only. Date-stamped. Filled by the operator via the `/lesson` slash command when something bites._

## Lessons

_Append-only. Date-stamped. Filled by the operator via the `/lesson` slash command for behaviors learned that aren't in upstream docs._
