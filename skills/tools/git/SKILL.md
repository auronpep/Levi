---
name: tool-git
description: Load when working with git, version control, repositories, branches, commits, remotes, merge conflicts, or authentication. Covers full Git CLI surface, auth setup, error handling, and lessons.
triggers:
  bash:
    - git
    - gitk
    - git gui
    - git-gui
    - scalar
---

# git

## What it is

Git is a CLI-centered distributed revision control system and tool suite for tracking source history, branching and merging work, coordinating with remotes, inspecting object databases, and scripting low-level repository operations. Reach for it for source-control workflows, patch review, branch/rebase/merge work, remote synchronization, repository maintenance, and plumbing-level object/ref manipulation; common alternatives include Mercurial, Fossil, and Subversion.

## Capability surface

Version basis: official git-scm reference documentation current to Git 2.54.0 (2026-04-20) plus local `git -h` / `git <command> -h` snapshots from Git 2.47.3. Commands marked experimental or server-side follow upstream docs; local optional commands absent from this Linux image are still listed.

### Global invocation

```text
usage: git [-v | --version] [-h | --help] [-C <path>] [-c <name>=<value>]
           [--exec-path[=<path>]] [--html-path] [--man-path] [--info-path]
           [-p | --paginate | -P | --no-pager] [--no-replace-objects] [--no-lazy-fetch]
           [--no-optional-locks] [--no-advice] [--bare] [--git-dir=<path>]
           [--work-tree=<path>] [--namespace=<name>] [--config-env=<name>=<envvar>]
           [--literal-pathspecs] [--glob-pathspecs] [--noglob-pathspecs]
           [--icase-pathspecs] [--list-cmds=<group>[,<group>...]]
           [--attr-source=<tree-ish>] <command> [<args>]

Global options:
    -v, --version                    print Git suite version
    -h, --help                       print synopsis/common commands; with -a/--all print all commands
    -C <path>                        run as if Git started in <path>
    -c <name>=<value>                pass transient config parameter
    --config-env=<name>=<envvar>     read transient config value from environment
    --exec-path[=<path>]             print/set core Git program path
    --html-path                      print installed HTML docs path
    --man-path                       print manpage path
    --info-path                      print Info docs path
    -p, --paginate                   pipe output into pager
    -P, --no-pager                   do not use pager
    --git-dir=<path>                 set .git directory path; disables discovery
    --work-tree=<path>               set working tree path
    --namespace=<path>               set Git namespace (GIT_NAMESPACE)
    --bare                           treat repository as bare
    --no-replace-objects             disable replacement refs
    --no-lazy-fetch                  do not lazily fetch promisor-remote objects
    --no-optional-locks              skip optional locking operations
    --no-advice                      disable advice hints
    --literal-pathspecs              treat pathspecs literally
    --glob-pathspecs                 add glob magic to all pathspecs
    --noglob-pathspecs               add literal magic to all pathspecs
    --icase-pathspecs                add icase magic to all pathspecs
    --list-cmds=<group>[,<group>...] list command groups (internal/experimental)
    --attr-source=<tree-ish>         read gitattributes from tree-ish
```

### Official command inventory


#### Setup and config

| Command | Purpose |
|---|---|
| `git` | Top-level Git program and global options |
| `config` | Get and set repository, global, system, worktree, or command-scoped options |
| `help` | Display help information about Git |
| `bugreport` | Collect information for filing a Git bug report |
| `credential` | Retrieve and store user credentials |
| `credential-cache` | Helper to temporarily store passwords in memory |
| `credential-store` | Helper to store credentials on disk |

#### Getting and creating projects

| Command | Purpose |
|---|---|
| `init` | Create an empty Git repository or reinitialize an existing one |
| `clone` | Clone a repository into a new directory |

#### Basic snapshotting

| Command | Purpose |
|---|---|
| `add` | Add file contents to the index |
| `status` | Show the working tree status |
| `diff` | Show changes between commits, commit and working tree, etc. |
| `commit` | Record changes to the repository |
| `notes` | Add or inspect object notes |
| `restore` | Restore working tree files |
| `reset` | Set HEAD or the index to a known state |
| `rm` | Remove files from the working tree and from the index |
| `mv` | Move or rename a file, directory, or symlink |

#### Branching and merging

| Command | Purpose |
|---|---|
| `branch` | List, create, or delete branches |
| `checkout` | Switch branches or restore working tree files |
| `switch` | Switch branches |
| `merge` | Join two or more development histories together |
| `mergetool` | Run merge conflict resolution tools |
| `log` | Show commit logs |
| `stash` | Stash changes in a dirty working directory |
| `tag` | Create, list, delete, or verify tags |
| `worktree` | Manage multiple working trees |

#### Sharing and updating projects

| Command | Purpose |
|---|---|
| `fetch` | Download objects and refs from another repository |
| `pull` | Fetch from and integrate with another repository or local branch |
| `push` | Update remote refs along with associated objects |
| `remote` | Manage the set of tracked repositories |
| `submodule` | Initialize, update, or inspect submodules |

#### Inspection and comparison

| Command | Purpose |
|---|---|
| `show` | Show various types of objects |
| `log` | Show commit logs |
| `diff` | Show changes between commits, commit and working tree, etc. |
| `difftool` | Show changes using common diff tools |
| `range-diff` | Compare two commit ranges |
| `shortlog` | Summarize git log output |
| `describe` | Give an object a human-readable name based on refs |

#### Patching

| Command | Purpose |
|---|---|
| `apply` | Apply a patch to files and/or to the index |
| `cherry-pick` | Apply the changes introduced by existing commits |
| `diff` | Show changes between commits, commit and working tree, etc. |
| `rebase` | Reapply commits on top of another base tip |
| `revert` | Revert existing commits by creating new commits |

#### Debugging

| Command | Purpose |
|---|---|
| `bisect` | Use binary search to find the commit that introduced a bug |
| `blame` | Show what revision and author last modified each line |
| `grep` | Print lines matching a pattern |

#### Email

| Command | Purpose |
|---|---|
| `am` | Apply a series of patches from a mailbox |
| `apply` | Apply a patch to files and/or to the index |
| `imap-send` | Send a collection of patches from stdin to an IMAP folder |
| `format-patch` | Prepare patches for e-mail submission |
| `send-email` | Send a collection of patches as emails |
| `request-pull` | Generate a summary of pending changes |

#### External systems

| Command | Purpose |
|---|---|
| `svn` | Bidirectional operation between a Subversion repository and Git |
| `fast-import` | Backend for fast Git data importers |
| `p4` | Import from and submit to Perforce repositories |
| `archimport` | Import a GNU Arch repository into Git |
| `cvsexportcommit` | Export a single commit to a CVS checkout |
| `cvsimport` | Salvage data from CVS into Git |
| `cvsserver` | CVS server emulator for Git |
| `quiltimport` | Apply a quilt patchset onto the current branch |

#### Administration

| Command | Purpose |
|---|---|
| `clean` | Remove untracked files from the working tree |
| `gc` | Clean up unnecessary files and optimize the local repository |
| `fsck` | Verify connectivity and validity of objects in the database |
| `reflog` | Manage reflog information |
| `filter-branch` | Rewrite branches |
| `instaweb` | Instantly browse a working repository in gitweb |
| `archive` | Create an archive of files from a named tree |
| `bundle` | Move objects and refs by archive |
| `maintenance` | Run tasks to optimize Git repository data |
| `sparse-checkout` | Reduce the working tree to a subset of tracked files |
| `replace` | Create, list, delete refs to replace objects |
| `refs` | Low-level access to refs |
| `pack-refs` | Pack heads and tags for efficient repository access |
| `prune` | Prune unreachable objects |
| `repack` | Pack unpacked objects |

#### GUI and large-repository helpers

| Command | Purpose |
|---|---|
| `gui` | Portable Tcl/Tk graphical interface to Git |
| `citool` | Graphical alternative to git-commit; alias for git gui citool |
| `gitk` | Git repository browser |
| `scalar` | Tool for managing large Git repositories |

#### Experimental porcelain in 2.54

| Command | Purpose |
|---|---|
| `backfill` | Download missing objects in a partial clone |
| `history` | EXPERIMENTAL: rewrite history |
| `last-modified` | EXPERIMENTAL: show when files were last modified |

#### Low-level manipulation commands

| Command | Purpose |
|---|---|
| `apply` | Apply a patch to files and/or to the index |
| `checkout-index` | Copy files from the index to the working tree |
| `commit-graph` | Write and verify Git commit-graph files |
| `commit-tree` | Create a new commit object |
| `hash-object` | Compute object ID and optionally create an object from a file |
| `index-pack` | Build pack index file for an existing packed archive |
| `merge-file` | Run a three-way file merge |
| `merge-index` | Run a merge for files needing merging |
| `mktag` | Create a tag object with extra validation |
| `mktree` | Build a tree object from ls-tree formatted text |
| `multi-pack-index` | Write and verify multi-pack-indexes |
| `pack-objects` | Create a packed archive of objects |
| `prune-packed` | Remove extra objects already in pack files |
| `read-tree` | Read tree information into the index |
| `replay` | EXPERIMENTAL: replay commits on a new base |
| `symbolic-ref` | Read, modify, and delete symbolic refs |
| `unpack-objects` | Unpack objects from a packed archive |
| `update-index` | Register file contents in the working tree to the index |
| `update-ref` | Update the object name stored in a ref safely |
| `write-tree` | Create a tree object from the current index |

#### Low-level interrogation commands

| Command | Purpose |
|---|---|
| `cat-file` | Provide contents or details of repository objects |
| `cherry` | Find commits yet to be applied to upstream |
| `diff-files` | Compare files in the working tree and the index |
| `diff-index` | Compare a tree to the working tree or index |
| `diff-pairs` | Compare the content and mode of provided blob pairs |
| `diff-tree` | Compare blob content and modes via two tree objects |
| `for-each-ref` | Output information on each ref |
| `for-each-repo` | Run a Git command on a list of repositories |
| `get-tar-commit-id` | Extract commit ID from an archive made by git-archive |
| `ls-files` | Show information about files in the index and working tree |
| `ls-remote` | List references in a remote repository |
| `ls-tree` | List the contents of a tree object |
| `merge-base` | Find good common ancestors for a merge |
| `name-rev` | Find symbolic names for given revisions |
| `pack-redundant` | Find redundant pack files |
| `repo` | EXPERIMENTAL: retrieve repository information |
| `rev-list` | List commit objects in reverse chronological order |
| `rev-parse` | Pick out and massage parameters |
| `show-index` | Show packed archive index |
| `show-ref` | List references in a local repository |
| `unpack-file` | Create a temporary file with a blob's contents |
| `var` | Show a Git logical variable |
| `verify-pack` | Validate packed Git archive files |

#### Low-level syncing and server-side commands

| Command | Purpose |
|---|---|
| `daemon` | Simple server for Git repositories |
| `fetch-pack` | Receive missing objects from another repository |
| `http-backend` | Server-side implementation of Git over HTTP |
| `send-pack` | Push objects over Git protocol |
| `update-server-info` | Update auxiliary info for dumb servers |
| `http-fetch` | Download from a remote Git repository via HTTP |
| `http-push` | Push objects over HTTP/DAV to another repository |
| `receive-pack` | Receive what is pushed into the repository |
| `shell` | Restricted login shell for Git-only SSH access |
| `upload-archive` | Send archive back to git-archive |
| `upload-pack` | Send objects packed back to git-fetch-pack |

#### Internal helper commands

| Command | Purpose |
|---|---|
| `check-attr` | Display gitattributes information |
| `check-ignore` | Debug gitignore/exclude files |
| `check-mailmap` | Show canonical names and email addresses |
| `check-ref-format` | Ensure a reference name is well formed |
| `column` | Display data in columns |
| `fmt-merge-msg` | Produce a merge commit message |
| `hook` | Run Git hooks |
| `interpret-trailers` | Add or parse structured commit-message trailers |
| `mailinfo` | Extract patch and authorship from one e-mail message |
| `mailsplit` | Simple UNIX mbox splitter |
| `merge-one-file` | Standard helper for git-merge-index |
| `patch-id` | Compute unique IDs for patches |
| `sh-i18n` | Git i18n setup code for shell scripts |
| `sh-setup` | Common Git shell script setup code |
| `stripspace` | Remove unnecessary whitespace |

### Guides and interface manuals

```text
The Git concept guides are:
   core-tutorial    A Git core tutorial for developers
   credentials      Providing usernames and passwords to Git
   cvs-migration    Git for CVS users
   diffcore         Tweaking diff output
   everyday         A useful minimum set of commands for Everyday Git
   faq              Frequently asked questions about using Git
   glossary         A Git Glossary
   namespaces       Git namespaces
   remote-helpers   Helper programs to interact with remote repositories
   submodules       Mounting one repository inside another
   tutorial         A tutorial introduction to Git
   tutorial-2       A tutorial introduction to Git: part two
   workflows        An overview of recommended workflows with Git

'git help -a' and 'git help -g' list available subcommands and some
concept guides. See 'git help <command>' or 'git help <concept>'
to read about a specific subcommand or concept.
See 'git help git' for an overview of the system.
```

```text
User-facing repository, command and file interfaces:
   attributes          Defining attributes per path
   cli                 Git command-line interface and conventions
   hooks               Hooks used by Git
   ignore              Specifies intentionally untracked files to ignore
   mailmap             Map author/committer names and/or E-Mail addresses
   modules             Defining submodule properties
   repository-layout   Git Repository Layout
   revisions           Specifying revisions and ranges for Git
```

```text
File formats, protocols and other developer interfaces:
   format-bundle           The bundle file format
   format-chunk            Chunk-based file formats
   format-commit-graph     Git commit-graph format
   format-index            Git index format
   format-pack             Git pack format
   format-signature        Git cryptographic signature formats
   protocol-capabilities   Protocol v0 and v1 capabilities
   protocol-common         Things common to various protocols
   protocol-http           Git HTTP-based protocols
   protocol-pack           How packs are transferred over-the-wire
   protocol-v2             Git Wire Protocol, Version 2
```

### Command help snapshots


#### Setup and config command details


##### `config` — Get and set repository, global, system, worktree, or command-scoped options

```text
usage: git config list [<file-option>] [<display-option>] [--includes]
   or: git config get [<file-option>] [<display-option>] [--includes] [--all] [--regexp] [--value=<value>] [--fixed-value] [--default=<default>] <name>
   or: git config set [<file-option>] [--type=<type>] [--all] [--value=<value>] [--fixed-value] <name> <value>
   or: git config unset [<file-option>] [--all] [--value=<value>] [--fixed-value] <name>
   or: git config rename-section [<file-option>] <old-name> <new-name>
   or: git config remove-section [<file-option>] <name>
   or: git config edit [<file-option>]
   or: git config [<file-option>] --get-colorbool <name> [<stdout-is-tty>]
```

##### `help` — Display help information about Git

```text
usage: git help [-a|--all] [--[no-]verbose] [--[no-]external-commands] [--[no-]aliases]
   or: git help [[-i|--info] [-m|--man] [-w|--web]] [<command>|<doc>]
   or: git help [-g|--guides]
   or: git help [-c|--config]
   or: git help [--user-interfaces]
   or: git help [--developer-interfaces]

    -a, --all             print all available commands
    --[no-]external-commands
                          show external commands in --all
    --[no-]aliases        show aliases in --all
    -m, --[no-]man        show man page
    -w, --[no-]web        show manual in web browser
    -i, --[no-]info       show info page
    -v, --[no-]verbose    print command description
    -g, --guides          print list of useful guides
    --user-interfaces     print list of user-facing repository, command and file interfaces
    --developer-interfaces
                          print list of file formats, protocols and other developer interfaces
    -c, --config          print all configuration variable names
```

##### `bugreport` — Collect information for filing a Git bug report

```text
usage: git bugreport [(-o | --output-directory) <path>]
                     [(-s | --suffix) <format> | --no-suffix]
                     [--diagnose[=<mode>]]

    --[no-]diagnose[=<mode>]
                          create an additional zip archive of detailed diagnostics (default 'stats')
    -o, --[no-]output-directory <path>
                          specify a destination for the bugreport file(s)
    -s, --[no-]suffix <format>
                          specify a strftime format suffix for the filename(s)
```

##### `credential` — Retrieve and store user credentials

```text
usage: git credential (fill|approve|reject)
```

##### `credential-cache` — Helper to temporarily store passwords in memory

```text
usage: git credential-cache [<options>] <action>

    --[no-]timeout <n>    number of seconds to cache credentials
    --[no-]socket <path>  path of cache-daemon socket
```

##### `credential-store` — Helper to store credentials on disk

```text
usage: git credential-store [<options>] <action>

    --[no-]file <path>    fetch and store credentials in <path>
```

#### Getting and creating projects command details


##### `init` — Create an empty Git repository or reinitialize an existing one

```text
usage: git init [-q | --quiet] [--bare] [--template=<template-directory>]
                [--separate-git-dir <git-dir>] [--object-format=<format>]
                [--ref-format=<format>]
                [-b <branch-name> | --initial-branch=<branch-name>]
                [--shared[=<permissions>]] [<directory>]

    --[no-]template <template-directory>
                          directory from which templates will be used
    --[no-]bare           create a bare repository
    --shared[=<permissions>]
                          specify that the git repository is to be shared amongst several users
    -q, --[no-]quiet      be quiet
    --[no-]separate-git-dir <gitdir>
                          separate git dir from working tree
    -b, --[no-]initial-branch <name>
                          override the name of the initial branch
    --[no-]object-format <hash>
                          specify the hash algorithm to use
    --[no-]ref-format <format>
                          specify the reference format to use
```

##### `clone` — Clone a repository into a new directory

```text
usage: git clone [<options>] [--] <repo> [<dir>]

    -v, --[no-]verbose    be more verbose
    -q, --[no-]quiet      be more quiet
    --[no-]progress       force progress reporting
    --[no-]reject-shallow don't clone shallow repository
    -n, --no-checkout     don't create a checkout
    --checkout            opposite of --no-checkout
    --[no-]bare           create a bare repository
    --[no-]mirror         create a mirror repository (implies --bare)
    -l, --[no-]local      to clone from a local repository
    --no-hardlinks        don't use local hardlinks, always copy
    --hardlinks           opposite of --no-hardlinks
    -s, --[no-]shared     setup as shared repository
    --[no-]recurse-submodules[=<pathspec>]
                          initialize submodules in the clone
    --[no-]recursive[=<pathspec>]
                          alias of --recurse-submodules
    -j, --[no-]jobs <n>   number of submodules cloned in parallel
    --[no-]template <template-directory>
                          directory from which templates will be used
    --[no-]reference <repo>
                          reference repository
    --[no-]reference-if-able <repo>
                          reference repository
    --[no-]dissociate     use --reference only while cloning
    -o, --[no-]origin <name>
                          use <name> instead of 'origin' to track upstream
    -b, --[no-]branch <branch>
                          checkout <branch> instead of the remote's HEAD
    -u, --[no-]upload-pack <path>
                          path to git-upload-pack on the remote
    --[no-]depth <depth>  create a shallow clone of that depth
    --[no-]shallow-since <time>
                          create a shallow clone since a specific time
    --[no-]shallow-exclude <revision>
                          deepen history of shallow clone, excluding rev
    --[no-]single-branch  clone only one branch, HEAD or --branch
    --no-tags             don't clone any tags, and make later fetches not to follow them
    --tags                opposite of --no-tags
    --[no-]shallow-submodules
                          any cloned submodules will be shallow
    --[no-]separate-git-dir <gitdir>
                          separate git dir from working tree
    --[no-]ref-format <format>
                          specify the reference format to use
    -c, --[no-]config <key=value>
                          set config inside the new repository
    --[no-]server-option <server-specific>
                          option to transmit
    -4, --ipv4            use IPv4 addresses only
    -6, --ipv6            use IPv6 addresses only
    --[no-]filter <args>  object filtering
    --[no-]also-filter-submodules
                          apply partial clone filters to submodules
    --[no-]remote-submodules
                          any cloned submodules will use their remote-tracking branch
    --[no-]sparse         initialize sparse-checkout file to include only files at root
    --[no-]bundle-uri <uri>
                          a URI for downloading bundles before fetching from origin remote
```

#### Basic snapshotting command details


##### `add` — Add file contents to the index

```text
usage: git add [<options>] [--] <pathspec>...

    -n, --[no-]dry-run    dry run
    -v, --[no-]verbose    be verbose

    -i, --[no-]interactive
                          interactive picking
    -p, --[no-]patch      select hunks interactively
    -e, --[no-]edit       edit current diff and apply
    -f, --[no-]force      allow adding otherwise ignored files
    -u, --[no-]update     update tracked files
    --[no-]renormalize    renormalize EOL of tracked files (implies -u)
    -N, --[no-]intent-to-add
                          record only the fact that the path will be added later
    -A, --[no-]all        add changes from all tracked and untracked files
    --[no-]ignore-removal ignore paths removed in the working tree (same as --no-all)
    --[no-]refresh        don't add, only refresh the index
    --[no-]ignore-errors  just skip files which cannot be added because of errors
    --[no-]ignore-missing check if - even missing - files are ignored in dry run
    --[no-]sparse         allow updating entries outside of the sparse-checkout cone
    --[no-]chmod (+|-)x   override the executable bit of the listed files
    --[no-]pathspec-from-file <file>
                          read pathspec from file
    --[no-]pathspec-file-nul
                          with --pathspec-from-file, pathspec elements are separated with NUL character
```

##### `status` — Show the working tree status

```text
usage: git status [<options>] [--] [<pathspec>...]

    -v, --[no-]verbose    be verbose
    -s, --[no-]short      show status concisely
    -b, --[no-]branch     show branch information
    --[no-]show-stash     show stash information
    --[no-]ahead-behind   compute full ahead/behind values
    --[no-]porcelain[=<version>]
                          machine-readable output
    --[no-]long           show status in long format (default)
    -z, --[no-]null       terminate entries with NUL
    -u, --[no-]untracked-files[=<mode>]
                          show untracked files, optional modes: all, normal, no. (Default: all)
    --[no-]ignored[=<mode>]
                          show ignored files, optional modes: traditional, matching, no. (Default: traditional)
    --[no-]ignore-submodules[=<when>]
                          ignore changes to submodules, optional when: all, dirty, untracked. (Default: all)
    --[no-]column[=<style>]
                          list untracked files in columns
    --no-renames          do not detect renames
    --renames             opposite of --no-renames
    -M, --find-renames[=<n>]
                          detect renames, optionally set similarity index
```

##### `diff` — Show changes between commits, commit and working tree, etc.

```text
usage: git diff --no-index [<options>] <path> <path>

Diff output format options
    -p, --patch           generate patch
    -s, --no-patch        suppress diff output
    -u                    generate patch
    -U, --unified[=<n>]   generate diffs with <n> lines context
    -W, --[no-]function-context
                          generate diffs with <n> lines context
    --raw                 generate the diff in raw format
    --patch-with-raw      synonym for '-p --raw'
    --patch-with-stat     synonym for '-p --stat'
    --numstat             machine friendly --stat
    --shortstat           output only the last line of --stat
    -X, --dirstat[=<param1>,<param2>...]
                          output the distribution of relative amount of changes for each sub-directory
    --cumulative          synonym for --dirstat=cumulative
    --dirstat-by-file[=<param1>,<param2>...]
                          synonym for --dirstat=files,<param1>,<param2>...
    --check               warn if changes introduce conflict markers or whitespace errors
    --summary             condensed summary such as creations, renames and mode changes
    --name-only           show only names of changed files
    --name-status         show only names and status of changed files
    --stat[=<width>[,<name-width>[,<count>]]]
                          generate diffstat
    --stat-width <width>  generate diffstat with a given width
    --stat-name-width <width>
                          generate diffstat with a given name width
    --stat-graph-width <width>
                          generate diffstat with a given graph width
    --stat-count <count>  generate diffstat with limited lines
    --[no-]compact-summary
                          generate compact summary in diffstat
    --binary              output a binary diff that can be applied
    --[no-]full-index     show full pre- and post-image object names on the "index" lines
    --[no-]color[=<when>] show colored diff
    --ws-error-highlight <kind>
                          highlight whitespace errors in the 'context', 'old' or 'new' lines in the diff
    -z                    do not munge pathnames and use NULs as output field terminators in --raw or --numstat
    --[no-]abbrev[=<n>]   use <n> digits to display object names
    --src-prefix <prefix> show the given source prefix instead of "a/"
    --dst-prefix <prefix> show the given destination prefix instead of "b/"
    --line-prefix <prefix>
                          prepend an additional prefix to every line of output
    --no-prefix           do not show any source or destination prefix
    --default-prefix      use default prefixes a/ and b/
    --inter-hunk-context <n>
                          show context between diff hunks up to the specified number of lines
    --output-indicator-new <char>
                          specify the character to indicate a new line instead of '+'
    --output-indicator-old <char>
                          specify the character to indicate an old line instead of '-'
    --output-indicator-context <char>
                          specify the character to indicate a context instead of ' '

Diff rename options
    -B, --break-rewrites[=<n>[/<m>]]
                          break complete rewrite changes into pairs of delete and create
    -M, --find-renames[=<n>]
                          detect renames
    -D, --irreversible-delete
                          omit the preimage for deletes
    -C, --find-copies[=<n>]
                          detect copies
    --[no-]find-copies-harder
                          use unmodified files as source to find copies
    --no-renames          disable rename detection
    --[no-]rename-empty   use empty blobs as rename source
    --[no-]follow         continue listing the history of a file beyond renames
    -l <n>                prevent rename/copy detection if the number of rename/copy targets exceeds given limit

Diff algorithm options
    --minimal             produce the smallest possible diff
    -w, --ignore-all-space
                          ignore whitespace when comparing lines
    -b, --ignore-space-change
                          ignore changes in amount of whitespace
    --ignore-space-at-eol ignore changes in whitespace at EOL
    --ignore-cr-at-eol    ignore carrier-return at the end of line
    --ignore-blank-lines  ignore changes whose lines are all blank
    -I, --[no-]ignore-matching-lines <regex>
                          ignore changes whose all lines match <regex>
    --[no-]indent-heuristic
                          heuristic to shift diff hunk boundaries for easy reading
    --patience            generate diff using the "patience diff" algorithm
    --histogram           generate diff using the "histogram diff" algorithm
    --diff-algorithm <algorithm>
                          choose a diff algorithm
    --anchored <text>     generate diff using the "anchored diff" algorithm
    --word-diff[=<mode>]  show word diff, using <mode> to delimit changed words
    --word-diff-regex <regex>
                          use <regex> to decide what a word is
    --color-words[=<regex>]
                          equivalent to --word-diff=color --word-diff-regex=<regex>
    --[no-]color-moved[=<mode>]
                          moved lines of code are colored differently
    --[no-]color-moved-ws <mode>
                          how white spaces are ignored in --color-moved

Other diff options
    --[no-]relative[=<prefix>]
                          when run from subdir, exclude changes outside and show relative paths
    -a, --[no-]text       treat all files as text
    -R                    swap two inputs, reverse the diff
    --[no-]exit-code      exit with 1 if there were differences, 0 otherwise
    --[no-]quiet          disable all output of the program
    --[no-]ext-diff       allow an external diff helper to be executed
    --[no-]textconv       run external text conversion filters when comparing binary files
    --ignore-submodules[=<when>]
                          ignore changes to submodules in the diff generation
    --submodule[=<format>]
                          specify how differences in submodules are shown
    --ita-invisible-in-index
                          hide 'git add -N' entries from the index
    --ita-visible-in-index
                          treat 'git add -N' entries as real in the index
    -S <string>           look for differences that change the number of occurrences of the specified string
    -G <regex>            look for differences that change the number of occurrences of the specified regex
    --pickaxe-all         show all changes in the changeset with -S or -G
    --pickaxe-regex       treat <string> in -S as extended POSIX regular expression
    -O <file>             control the order in which files appear in the output
    --rotate-to <path>    show the change in the specified path first
    --skip-to <path>      skip the output to the specified path
    --find-object <object-id>
                          look for differences that change the number of occurrences of the specified object
    --diff-filter [(A|C|D|M|R|T|U|X|B)...[*]]
                          select files by diff type
    --output <file>       output to a specific file
```

##### `commit` — Record changes to the repository

```text
usage: git commit [-a | --interactive | --patch] [-s] [-v] [-u<mode>] [--amend]
                  [--dry-run] [(-c | -C | --squash) <commit> | --fixup [(amend|reword):]<commit>]
                  [-F <file> | -m <msg>] [--reset-author] [--allow-empty]
                  [--allow-empty-message] [--no-verify] [-e] [--author=<author>]
                  [--date=<date>] [--cleanup=<mode>] [--[no-]status]
                  [-i | -o] [--pathspec-from-file=<file> [--pathspec-file-nul]]
                  [(--trailer <token>[(=|:)<value>])...] [-S[<keyid>]]
                  [--] [<pathspec>...]

    -q, --[no-]quiet      suppress summary after successful commit
    -v, --[no-]verbose    show diff in commit message template

Commit message options
    -F, --[no-]file <file>
                          read message from file
    --[no-]author <author>
                          override author for commit
    --[no-]date <date>    override date for commit
    -m, --[no-]message <message>
                          commit message
    -c, --[no-]reedit-message <commit>
                          reuse and edit message from specified commit
    -C, --[no-]reuse-message <commit>
                          reuse message from specified commit
    --[no-]fixup [(amend|reword):]commit
                          use autosquash formatted message to fixup or amend/reword specified commit
    --[no-]squash <commit>
                          use autosquash formatted message to squash specified commit
    --[no-]reset-author   the commit is authored by me now (used with -C/-c/--amend)
    --trailer <trailer>   add custom trailer(s)
    -s, --[no-]signoff    add a Signed-off-by trailer
    -t, --[no-]template <file>
                          use specified template file
    -e, --[no-]edit       force edit of commit
    --[no-]cleanup <mode> how to strip spaces and #comments from message
    --[no-]status         include status in commit message template
    -S, --[no-]gpg-sign[=<key-id>]
                          GPG sign commit

Commit contents options
    -a, --[no-]all        commit all changed files
    -i, --[no-]include    add specified files to index for commit
    --[no-]interactive    interactively add files
    -p, --[no-]patch      interactively add changes
    -o, --[no-]only       commit only specified files
    -n, --no-verify       bypass pre-commit and commit-msg hooks
    --verify              opposite of --no-verify
    --[no-]dry-run        show what would be committed
    --[no-]short          show status concisely
    --[no-]branch         show branch information
    --[no-]ahead-behind   compute full ahead/behind values
    --[no-]porcelain      machine-readable output
    --[no-]long           show status in long format (default)
    -z, --[no-]null       terminate entries with NUL
    --[no-]amend          amend previous commit
    --no-post-rewrite     bypass post-rewrite hook
    --post-rewrite        opposite of --no-post-rewrite
    -u, --[no-]untracked-files[=<mode>]
                          show untracked files, optional modes: all, normal, no. (Default: all)
    --[no-]pathspec-from-file <file>
                          read pathspec from file
    --[no-]pathspec-file-nul
                          with --pathspec-from-file, pathspec elements are separated with NUL character
```

##### `notes` — Add or inspect object notes

```text
usage: git notes [--ref <notes-ref>] [list [<object>]]
   or: git notes [--ref <notes-ref>] add [-f] [--allow-empty] [--[no-]separator|--separator=<paragraph-break>] [--[no-]stripspace] [-m <msg> | -F <file> | (-c | -C) <object>] [<object>]
   or: git notes [--ref <notes-ref>] copy [-f] <from-object> <to-object>
   or: git notes [--ref <notes-ref>] append [--allow-empty] [--[no-]separator|--separator=<paragraph-break>] [--[no-]stripspace] [-m <msg> | -F <file> | (-c | -C) <object>] [<object>]
   or: git notes [--ref <notes-ref>] edit [--allow-empty] [<object>]
   or: git notes [--ref <notes-ref>] show [<object>]
   or: git notes [--ref <notes-ref>] merge [-v | -q] [-s <strategy>] <notes-ref>
   or: git notes merge --commit [-v | -q]
   or: git notes merge --abort [-v | -q]
   or: git notes [--ref <notes-ref>] remove [<object>...]
   or: git notes [--ref <notes-ref>] prune [-n] [-v]
   or: git notes [--ref <notes-ref>] get-ref

    --[no-]ref <notes-ref>
                          use notes from <notes-ref>
```

##### `restore` — Restore working tree files

```text
usage: git restore [<options>] [--source=<branch>] <file>...

    -s, --[no-]source <tree-ish>
                          which tree-ish to checkout from
    -S, --[no-]staged     restore the index
    -W, --[no-]worktree   restore the working tree (default)
    --[no-]ignore-unmerged
                          ignore unmerged entries
    --[no-]overlay        use overlay mode
    -q, --[no-]quiet      suppress progress reporting
    --[no-]recurse-submodules[=<checkout>]
                          control recursive updating of submodules
    --[no-]progress       force progress reporting
    -m, --[no-]merge      perform a 3-way merge with the new branch
    --[no-]conflict <style>
                          conflict style (merge, diff3, or zdiff3)
    -2, --ours            checkout our version for unmerged files
    -3, --theirs          checkout their version for unmerged files
    -p, --[no-]patch      select hunks interactively
    --[no-]ignore-skip-worktree-bits
                          do not limit pathspecs to sparse entries only
    --[no-]pathspec-from-file <file>
                          read pathspec from file
    --[no-]pathspec-file-nul
                          with --pathspec-from-file, pathspec elements are separated with NUL character
```

##### `reset` — Set HEAD or the index to a known state

```text
usage: git reset [--mixed | --soft | --hard | --merge | --keep] [-q] [<commit>]
   or: git reset [-q] [<tree-ish>] [--] <pathspec>...
   or: git reset [-q] [--pathspec-from-file [--pathspec-file-nul]] [<tree-ish>]
   or: git reset --patch [<tree-ish>] [--] [<pathspec>...]

    -q, --[no-]quiet      be quiet, only report errors
    --no-refresh          skip refreshing the index after reset
    --refresh             opposite of --no-refresh
    --mixed               reset HEAD and index
    --soft                reset only HEAD
    --hard                reset HEAD, index and working tree
    --merge               reset HEAD, index and working tree
    --keep                reset HEAD but keep local changes
    --[no-]recurse-submodules[=<reset>]
                          control recursive updating of submodules
    -p, --[no-]patch      select hunks interactively
    -N, --[no-]intent-to-add
                          record only the fact that removed paths will be added later
    --[no-]pathspec-from-file <file>
                          read pathspec from file
    --[no-]pathspec-file-nul
                          with --pathspec-from-file, pathspec elements are separated with NUL character
```

##### `rm` — Remove files from the working tree and from the index

```text
usage: git rm [-f | --force] [-n] [-r] [--cached] [--ignore-unmatch]
              [--quiet] [--pathspec-from-file=<file> [--pathspec-file-nul]]
              [--] [<pathspec>...]

    -n, --[no-]dry-run    dry run
    -q, --[no-]quiet      do not list removed files
    --[no-]cached         only remove from the index
    -f, --[no-]force      override the up-to-date check
    -r                    allow recursive removal
    --[no-]ignore-unmatch exit with a zero status even if nothing matched
    --[no-]sparse         allow updating entries outside of the sparse-checkout cone
    --[no-]pathspec-from-file <file>
                          read pathspec from file
    --[no-]pathspec-file-nul
                          with --pathspec-from-file, pathspec elements are separated with NUL character
```

##### `mv` — Move or rename a file, directory, or symlink

```text
usage: git mv [<options>] <source>... <destination>

    -v, --[no-]verbose    be verbose
    -n, --[no-]dry-run    dry run
    -f, --[no-]force      force move/rename even if target exists
    -k                    skip move/rename errors
    --[no-]sparse         allow updating entries outside of the sparse-checkout cone
```

#### Branching and merging command details


##### `branch` — List, create, or delete branches

```text
usage: git branch [<options>] [-r | -a] [--merged] [--no-merged]
   or: git branch [<options>] [-f] [--recurse-submodules] <branch-name> [<start-point>]
   or: git branch [<options>] [-l] [<pattern>...]
   or: git branch [<options>] [-r] (-d | -D) <branch-name>...
   or: git branch [<options>] (-m | -M) [<old-branch>] <new-branch>
   or: git branch [<options>] (-c | -C) [<old-branch>] <new-branch>
   or: git branch [<options>] [-r | -a] [--points-at]
   or: git branch [<options>] [-r | -a] [--format]

Generic options
    -v, --[no-]verbose    show hash and subject, give twice for upstream branch
    -q, --[no-]quiet      suppress informational messages
    -t, --[no-]track[=(direct|inherit)]
                          set branch tracking configuration
    -u, --[no-]set-upstream-to <upstream>
                          change the upstream info
    --[no-]unset-upstream unset the upstream info
    --[no-]color[=<when>] use colored output
    -r, --remotes         act on remote-tracking branches
    --contains <commit>   print only branches that contain the commit
    --no-contains <commit>
                          print only branches that don't contain the commit
    --[no-]abbrev[=<n>]   use <n> digits to display object names

Specific git-branch actions:
    -a, --all             list both remote-tracking and local branches
    -d, --[no-]delete     delete fully merged branch
    -D                    delete branch (even if not merged)
    -m, --[no-]move       move/rename a branch and its reflog
    -M                    move/rename a branch, even if target exists
    --[no-]omit-empty     do not output a newline after empty formatted refs
    -c, --[no-]copy       copy a branch and its reflog
    -C                    copy a branch, even if target exists
    -l, --[no-]list       list branch names
    --[no-]show-current   show current branch name
    --[no-]create-reflog  create the branch's reflog
    --[no-]edit-description
                          edit the description for the branch
    -f, --[no-]force      force creation, move/rename, deletion
    --merged <commit>     print only branches that are merged
    --no-merged <commit>  print only branches that are not merged
    --[no-]column[=<style>]
                          list branches in columns
    --[no-]sort <key>     field name to sort on
    --[no-]points-at <object>
                          print only branches of the object
    -i, --[no-]ignore-case
                          sorting and filtering are case insensitive
    --[no-]recurse-submodules
                          recurse through submodules
    --[no-]format <format>
                          format to use for the output
```

##### `checkout` — Switch branches or restore working tree files

```text
usage: git checkout [<options>] <branch>
   or: git checkout [<options>] [<branch>] -- <file>...

    -b <branch>           create and checkout a new branch
    -B <branch>           create/reset and checkout a branch
    -l                    create reflog for new branch
    --[no-]guess          second guess 'git checkout <no-such-branch>' (default)
    --[no-]overlay        use overlay mode (default)
    -q, --[no-]quiet      suppress progress reporting
    --[no-]recurse-submodules[=<checkout>]
                          control recursive updating of submodules
    --[no-]progress       force progress reporting
    -m, --[no-]merge      perform a 3-way merge with the new branch
    --[no-]conflict <style>
                          conflict style (merge, diff3, or zdiff3)
    -d, --[no-]detach     detach HEAD at named commit
    -t, --[no-]track[=(direct|inherit)]
                          set branch tracking configuration
    -f, --[no-]force      force checkout (throw away local modifications)
    --[no-]orphan <new-branch>
                          new unborn branch
    --[no-]overwrite-ignore
                          update ignored files (default)
    --[no-]ignore-other-worktrees
                          do not check if another worktree is using this branch
    -2, --ours            checkout our version for unmerged files
    -3, --theirs          checkout their version for unmerged files
    -p, --[no-]patch      select hunks interactively
    --[no-]ignore-skip-worktree-bits
                          do not limit pathspecs to sparse entries only
    --[no-]pathspec-from-file <file>
                          read pathspec from file
    --[no-]pathspec-file-nul
                          with --pathspec-from-file, pathspec elements are separated with NUL character
```

##### `switch` — Switch branches

```text
usage: git switch [<options>] [<branch>]

    -c, --[no-]create <branch>
                          create and switch to a new branch
    -C, --[no-]force-create <branch>
                          create/reset and switch to a branch
    --[no-]guess          second guess 'git switch <no-such-branch>'
    --[no-]discard-changes
                          throw away local modifications
    -q, --[no-]quiet      suppress progress reporting
    --[no-]recurse-submodules[=<checkout>]
                          control recursive updating of submodules
    --[no-]progress       force progress reporting
    -m, --[no-]merge      perform a 3-way merge with the new branch
    --[no-]conflict <style>
                          conflict style (merge, diff3, or zdiff3)
    -d, --[no-]detach     detach HEAD at named commit
    -t, --[no-]track[=(direct|inherit)]
                          set branch tracking configuration
    -f, --[no-]force      force checkout (throw away local modifications)
    --[no-]orphan <new-branch>
                          new unborn branch
    --[no-]overwrite-ignore
                          update ignored files (default)
    --[no-]ignore-other-worktrees
                          do not check if another worktree is using this branch
```

##### `merge` — Join two or more development histories together

```text
usage: git merge [<options>] [<commit>...]
   or: git merge --abort
   or: git merge --continue

    -n                    do not show a diffstat at the end of the merge
    --[no-]stat           show a diffstat at the end of the merge
    --[no-]summary        (synonym to --stat)
    --[no-]log[=<n>]      add (at most <n>) entries from shortlog to merge commit message
    --[no-]squash         create a single commit instead of doing a merge
    --[no-]commit         perform a commit if the merge succeeds (default)
    -e, --[no-]edit       edit message before committing
    --[no-]cleanup <mode> how to strip spaces and #comments from message
    --[no-]ff             allow fast-forward (default)
    --ff-only             abort if fast-forward is not possible
    --[no-]rerere-autoupdate
                          update the index with reused conflict resolution if possible
    --[no-]verify-signatures
                          verify that the named commit has a valid GPG signature
    -s, --[no-]strategy <strategy>
                          merge strategy to use
    -X, --[no-]strategy-option <option=value>
                          option for selected merge strategy
    -m, --[no-]message <message>
                          merge commit message (for a non-fast-forward merge)
    -F, --file <path>     read message from file
    --[no-]into-name <name>
                          use <name> instead of the real target
    -v, --[no-]verbose    be more verbose
    -q, --[no-]quiet      be more quiet
    --[no-]abort          abort the current in-progress merge
    --[no-]quit           --abort but leave index and working tree alone
    --[no-]continue       continue the current in-progress merge
    --[no-]allow-unrelated-histories
                          allow merging unrelated histories
    --[no-]progress       force progress reporting
    -S, --[no-]gpg-sign[=<key-id>]
                          GPG sign commit
    --[no-]autostash      automatically stash/stash pop before and after
    --[no-]overwrite-ignore
                          update ignored files (default)
    --[no-]signoff        add a Signed-off-by trailer
    --no-verify           bypass pre-merge-commit and commit-msg hooks
    --verify              opposite of --no-verify
```

##### `mergetool` — Run merge conflict resolution tools

```text
usage: git mergetool [--tool=tool] [--tool-help] [-y|--no-prompt|--prompt] [-g|--gui|--no-gui] [-O<orderfile>] [file to merge] ...
```

##### `log` — Show commit logs

```text
usage: git log [<options>] [<revision-range>] [[--] <path>...]
   or: git show [<options>] <object>...

    -q, --[no-]quiet      suppress diff output
    --[no-]source         show source
    --[no-]use-mailmap    use mail map file
    --[no-]mailmap        alias of --use-mailmap
    --clear-decorations   clear all previously-defined decoration filters
    --[no-]decorate-refs <pattern>
                          only decorate refs that match <pattern>
    --[no-]decorate-refs-exclude <pattern>
                          do not decorate refs that match <pattern>
    --[no-]decorate[=...] decorate options
    -L <range:file>       trace the evolution of line range <start>,<end> or function :<funcname> in <file>
```

##### `stash` — Stash changes in a dirty working directory

```text
usage: git stash list [<log-options>]
   or: git stash show [-u | --include-untracked | --only-untracked] [<diff-options>] [<stash>]
   or: git stash drop [-q | --quiet] [<stash>]
   or: git stash pop [--index] [-q | --quiet] [<stash>]
   or: git stash apply [--index] [-q | --quiet] [<stash>]
   or: git stash branch <branchname> [<stash>]
   or: git stash [push [-p | --patch] [-S | --staged] [-k | --[no-]keep-index] [-q | --quiet]
                 [-u | --include-untracked] [-a | --all] [(-m | --message) <message>]
                 [--pathspec-from-file=<file> [--pathspec-file-nul]]
                 [--] [<pathspec>...]]
   or: git stash save [-p | --patch] [-S | --staged] [-k | --[no-]keep-index] [-q | --quiet]
                 [-u | --include-untracked] [-a | --all] [<message>]
   or: git stash clear
   or: git stash create [<message>]
   or: git stash store [(-m | --message) <message>] [-q | --quiet] <commit>
```

##### `tag` — Create, list, delete, or verify tags

```text
usage: git tag [-a | -s | -u <key-id>] [-f] [-m <msg> | -F <file>] [-e]
               [(--trailer <token>[(=|:)<value>])...]
               <tagname> [<commit> | <object>]
   or: git tag -d <tagname>...
   or: git tag [-n[<num>]] -l [--contains <commit>] [--no-contains <commit>]
               [--points-at <object>] [--column[=<options>] | --no-column]
               [--create-reflog] [--sort=<key>] [--format=<format>]
               [--merged <commit>] [--no-merged <commit>] [<pattern>...]
   or: git tag -v [--format=<format>] <tagname>...

    -l, --list            list tag names
    -n[<n>]               print <n> lines of each tag message
    -d, --delete          delete tags
    -v, --verify          verify tags

Tag creation options
    -a, --[no-]annotate   annotated tag, needs a message
    -m, --message <message>
                          tag message
    -F, --[no-]file <file>
                          read message from file
    --trailer <trailer>   add custom trailer(s)
    -e, --[no-]edit       force edit of tag message
    -s, --[no-]sign       annotated and GPG-signed tag
    --[no-]cleanup <mode> how to strip spaces and #comments from message
    -u, --[no-]local-user <key-id>
                          use another key to sign the tag
    -f, --[no-]force      replace the tag if exists
    --[no-]create-reflog  create a reflog

Tag listing options
    --[no-]column[=<style>]
                          show tag list in columns
    --contains <commit>   print only tags that contain the commit
    --no-contains <commit>
                          print only tags that don't contain the commit
    --merged <commit>     print only tags that are merged
    --no-merged <commit>  print only tags that are not merged
    --[no-]omit-empty     do not output a newline after empty formatted refs
    --[no-]sort <key>     field name to sort on
    --[no-]points-at <object>
                          print only tags of the object
    --[no-]format <format>
                          format to use for the output
    --[no-]color[=<when>] respect format colors
    -i, --[no-]ignore-case
                          sorting and filtering are case insensitive
```

##### `worktree` — Manage multiple working trees

```text
usage: git worktree add [-f] [--detach] [--checkout] [--lock [--reason <string>]]
                        [--orphan] [(-b | -B) <new-branch>] <path> [<commit-ish>]
   or: git worktree list [-v | --porcelain [-z]]
   or: git worktree lock [--reason <string>] <worktree>
   or: git worktree move <worktree> <new-path>
   or: git worktree prune [-n] [-v] [--expire <expire>]
   or: git worktree remove [-f] <worktree>
   or: git worktree repair [<path>...]
   or: git worktree unlock <worktree>
```

#### Sharing and updating projects command details


##### `fetch` — Download objects and refs from another repository

```text
usage: git fetch [<options>] [<repository> [<refspec>...]]
   or: git fetch [<options>] <group>
   or: git fetch --multiple [<options>] [(<repository> | <group>)...]
   or: git fetch --all [<options>]

    -v, --[no-]verbose    be more verbose
    -q, --[no-]quiet      be more quiet
    --[no-]all            fetch from all remotes
    --[no-]set-upstream   set upstream for git pull/fetch
    -a, --[no-]append     append to .git/FETCH_HEAD instead of overwriting
    --[no-]atomic         use atomic transaction to update references
    --[no-]upload-pack <path>
                          path to upload pack on remote end
    -f, --[no-]force      force overwrite of local reference
    -m, --[no-]multiple   fetch from multiple remotes
    -t, --[no-]tags       fetch all tags and associated objects
    -n                    do not fetch all tags (--no-tags)
    -j, --[no-]jobs <n>   number of submodules fetched in parallel
    --[no-]prefetch       modify the refspec to place all refs within refs/prefetch/
    -p, --[no-]prune      prune remote-tracking branches no longer on remote
    -P, --[no-]prune-tags prune local tags no longer on remote and clobber changed tags
    --[no-]recurse-submodules[=<on-demand>]
                          control recursive fetching of submodules
    --[no-]dry-run        dry run
    --[no-]porcelain      machine-readable output
    --[no-]write-fetch-head
                          write fetched references to the FETCH_HEAD file
    -k, --[no-]keep       keep downloaded pack
    -u, --[no-]update-head-ok
                          allow updating of HEAD ref
    --[no-]progress       force progress reporting
    --[no-]depth <depth>  deepen history of shallow clone
    --[no-]shallow-since <time>
                          deepen history of shallow repository based on time
    --[no-]shallow-exclude <revision>
                          deepen history of shallow clone, excluding rev
    --[no-]deepen <n>     deepen history of shallow clone
    --unshallow           convert to a complete repository
    --refetch             re-fetch without negotiating common commits
    --[no-]update-shallow accept refs that update .git/shallow
    --refmap <refmap>     specify fetch refmap
    -o, --[no-]server-option <server-specific>
                          option to transmit
    -4, --ipv4            use IPv4 addresses only
    -6, --ipv6            use IPv6 addresses only
    --[no-]negotiation-tip <revision>
                          report that we have only objects reachable from this object
    --[no-]negotiate-only do not fetch a packfile; instead, print ancestors of negotiation tips
    --[no-]filter <args>  object filtering
    --[no-]auto-maintenance
                          run 'maintenance --auto' after fetching
    --[no-]auto-gc        run 'maintenance --auto' after fetching
    --[no-]show-forced-updates
                          check for forced-updates on all updated branches
    --[no-]write-commit-graph
                          write the commit-graph after fetching
    --[no-]stdin          accept refspecs from stdin
```

##### `pull` — Fetch from and integrate with another repository or local branch

```text
usage: git pull [<options>] [<repository> [<refspec>...]]

    -v, --[no-]verbose    be more verbose
    -q, --[no-]quiet      be more quiet
    --[no-]progress       force progress reporting
    --[no-]recurse-submodules[=<on-demand>]
                          control for recursive fetching of submodules

Options related to merging
    -r, --[no-]rebase[=(false|true|merges|interactive)]
                          incorporate changes by rebasing rather than merging
    -n                    do not show a diffstat at the end of the merge
    --[no-]stat           show a diffstat at the end of the merge
    --[no-]log[=<n>]      add (at most <n>) entries from shortlog to merge commit message
    --[no-]signoff[=...]  add a Signed-off-by trailer
    --[no-]squash         create a single commit instead of doing a merge
    --[no-]commit         perform a commit if the merge succeeds (default)
    --[no-]edit           edit message before committing
    --[no-]cleanup <mode> how to strip spaces and #comments from message
    --[no-]ff             allow fast-forward
    --ff-only             abort if fast-forward is not possible
    --[no-]verify         control use of pre-merge-commit and commit-msg hooks
    --[no-]verify-signatures
                          verify that the named commit has a valid GPG signature
    --[no-]autostash      automatically stash/stash pop before and after
    -s, --[no-]strategy <strategy>
                          merge strategy to use
    -X, --[no-]strategy-option <option=value>
                          option for selected merge strategy
    -S, --[no-]gpg-sign[=<key-id>]
                          GPG sign commit
    --[no-]allow-unrelated-histories
                          allow merging unrelated histories

Options related to fetching
    --[no-]all            fetch from all remotes
    -a, --[no-]append     append to .git/FETCH_HEAD instead of overwriting
    --[no-]upload-pack <path>
                          path to upload pack on remote end
    -f, --[no-]force      force overwrite of local branch
    -t, --[no-]tags       fetch all tags and associated objects
    -p, --[no-]prune      prune remote-tracking branches no longer on remote
    -j, --[no-]jobs[=<n>] number of submodules pulled in parallel
    --[no-]dry-run        dry run
    -k, --[no-]keep       keep downloaded pack
    --[no-]depth <depth>  deepen history of shallow clone
    --[no-]shallow-since <time>
                          deepen history of shallow repository based on time
    --[no-]shallow-exclude <revision>
                          deepen history of shallow clone, excluding rev
    --[no-]deepen <n>     deepen history of shallow clone
    --unshallow           convert to a complete repository
    --[no-]update-shallow accept refs that update .git/shallow
    --refmap <refmap>     specify fetch refmap
    -o, --[no-]server-option <server-specific>
                          option to transmit
    -4, --[no-]ipv4       use IPv4 addresses only
    -6, --[no-]ipv6       use IPv6 addresses only
    --[no-]negotiation-tip <revision>
                          report that we have only objects reachable from this object
    --[no-]show-forced-updates
                          check for forced-updates on all updated branches
    --[no-]set-upstream   set upstream for git pull/fetch
```

##### `push` — Update remote refs along with associated objects

```text
usage: git push [<options>] [<repository> [<refspec>...]]

    -v, --[no-]verbose    be more verbose
    -q, --[no-]quiet      be more quiet
    --[no-]repo <repository>
                          repository
    --[no-]all            push all branches
    --[no-]branches       alias of --all
    --[no-]mirror         mirror all refs
    -d, --[no-]delete     delete refs
    --[no-]tags           push tags (can't be used with --all or --branches or --mirror)
    -n, --[no-]dry-run    dry run
    --[no-]porcelain      machine-readable output
    -f, --[no-]force      force updates
    --[no-]force-with-lease[=<refname>:<expect>]
                          require old value of ref to be at this value
    --[no-]force-if-includes
                          require remote updates to be integrated locally
    --[no-]recurse-submodules (check|on-demand|no)
                          control recursive pushing of submodules
    --[no-]thin           use thin pack
    --[no-]receive-pack <receive-pack>
                          receive pack program
    --[no-]exec <receive-pack>
                          receive pack program
    -u, --[no-]set-upstream
                          set upstream for git pull/status
    --[no-]progress       force progress reporting
    --[no-]prune          prune locally removed refs
    --no-verify           bypass pre-push hook
    --verify              opposite of --no-verify
    --[no-]follow-tags    push missing but relevant tags
    --[no-]signed[=(yes|no|if-asked)]
                          GPG sign the push
    --[no-]atomic         request atomic transaction on remote side
    -o, --[no-]push-option <server-specific>
                          option to transmit
    -4, --ipv4            use IPv4 addresses only
    -6, --ipv6            use IPv6 addresses only
```

##### `remote` — Manage the set of tracked repositories

```text
usage: git remote [-v | --verbose]
   or: git remote add [-t <branch>] [-m <master>] [-f] [--tags | --no-tags] [--mirror=<fetch|push>] <name> <url>
   or: git remote rename [--[no-]progress] <old> <new>
   or: git remote remove <name>
   or: git remote set-head <name> (-a | --auto | -d | --delete | <branch>)
   or: git remote [-v | --verbose] show [-n] <name>
   or: git remote prune [-n | --dry-run] <name>
   or: git remote [-v | --verbose] update [-p | --prune] [(<group> | <remote>)...]
   or: git remote set-branches [--add] <name> <branch>...
   or: git remote get-url [--push] [--all] <name>
   or: git remote set-url [--push] <name> <newurl> [<oldurl>]
   or: git remote set-url --add <name> <newurl>
   or: git remote set-url --delete <name> <url>

    -v, --[no-]verbose    be verbose; must be placed before a subcommand
```

##### `submodule` — Initialize, update, or inspect submodules

```text
usage: git submodule [--quiet] [--cached]
   or: git submodule [--quiet] add [-b <branch>] [-f|--force] [--name <name>] [--reference <repository>] [--] <repository> [<path>]
   or: git submodule [--quiet] status [--cached] [--recursive] [--] [<path>...]
   or: git submodule [--quiet] init [--] [<path>...]
   or: git submodule [--quiet] deinit [-f|--force] (--all| [--] <path>...)
   or: git submodule [--quiet] update [--init [--filter=<filter-spec>]] [--remote] [-N|--no-fetch] [-f|--force] [--checkout|--merge|--rebase] [--[no-]recommend-shallow] [--reference <repository>] [--recursive] [--[no-]single-branch] [--] [<path>...]
   or: git submodule [--quiet] set-branch (--default|--branch <branch>) [--] <path>
   or: git submodule [--quiet] set-url [--] <path> <newurl>
   or: git submodule [--quiet] summary [--cached|--files] [--summary-limit <n>] [commit] [--] [<path>...]
   or: git submodule [--quiet] foreach [--recursive] <command>
   or: git submodule [--quiet] sync [--recursive] [--] [<path>...]
   or: git submodule [--quiet] absorbgitdirs [--] [<path>...]
```

#### Inspection and comparison command details


##### `show` — Show various types of objects

```text
usage: git log [<options>] [<revision-range>] [[--] <path>...]
   or: git show [<options>] <object>...

    -q, --[no-]quiet      suppress diff output
    --[no-]source         show source
    --[no-]use-mailmap    use mail map file
    --[no-]mailmap        alias of --use-mailmap
    --clear-decorations   clear all previously-defined decoration filters
    --[no-]decorate-refs <pattern>
                          only decorate refs that match <pattern>
    --[no-]decorate-refs-exclude <pattern>
                          do not decorate refs that match <pattern>
    --[no-]decorate[=...] decorate options
    -L <range:file>       trace the evolution of line range <start>,<end> or function :<funcname> in <file>
```

##### `difftool` — Show changes using common diff tools

```text
usage: git difftool [<options>] [<commit> [<commit>]] [--] [<path>...]

    -g, --[no-]gui        use `diff.guitool` instead of `diff.tool`
    -d, --[no-]dir-diff   perform a full-directory diff
    -y, --no-prompt       do not prompt before launching a diff tool
    --[no-]symlinks       use symlinks in dir-diff mode
    -t, --[no-]tool <tool>
                          use the specified diff tool
    --[no-]tool-help      print a list of diff tools that may be used with `--tool`
    --[no-]trust-exit-code
                          make 'git-difftool' exit when an invoked diff tool returns a non-zero exit code
    -x, --[no-]extcmd <command>
                          specify a custom command for viewing diffs
    --no-index            passed to `diff`
    --index               opposite of --no-index
```

##### `range-diff` — Compare two commit ranges

```text
usage: git range-diff [<options>] <old-base>..<old-tip> <new-base>..<new-tip>
   or: git range-diff [<options>] <old-tip>...<new-tip>
   or: git range-diff [<options>] <base> <old-tip> <new-tip>

    --[no-]creation-factor <n>
                          percentage by which creation is weighted
    --no-dual-color       use simple diff colors
    --dual-color          opposite of --no-dual-color
    --[no-]notes[=<notes>]
                          passed to 'git log'
    --[no-]left-only      only emit output related to the first range
    --[no-]right-only     only emit output related to the second range

Diff output format options
    -p, --patch           generate patch
    -s, --no-patch        suppress diff output
    -u                    generate patch
    -U, --unified[=<n>]   generate diffs with <n> lines context
    -W, --[no-]function-context
                          generate diffs with <n> lines context
    --raw                 generate the diff in raw format
    --patch-with-raw      synonym for '-p --raw'
    --patch-with-stat     synonym for '-p --stat'
    --numstat             machine friendly --stat
    --shortstat           output only the last line of --stat
    -X, --dirstat[=<param1>,<param2>...]
                          output the distribution of relative amount of changes for each sub-directory
    --cumulative          synonym for --dirstat=cumulative
    --dirstat-by-file[=<param1>,<param2>...]
                          synonym for --dirstat=files,<param1>,<param2>...
    --check               warn if changes introduce conflict markers or whitespace errors
    --summary             condensed summary such as creations, renames and mode changes
    --name-only           show only names of changed files
    --name-status         show only names and status of changed files
    --stat[=<width>[,<name-width>[,<count>]]]
                          generate diffstat
    --stat-width <width>  generate diffstat with a given width
    --stat-name-width <width>
                          generate diffstat with a given name width
    --stat-graph-width <width>
                          generate diffstat with a given graph width
    --stat-count <count>  generate diffstat with limited lines
    --[no-]compact-summary
                          generate compact summary in diffstat
    --binary              output a binary diff that can be applied
    --[no-]full-index     show full pre- and post-image object names on the "index" lines
    --[no-]color[=<when>] show colored diff
    --ws-error-highlight <kind>
                          highlight whitespace errors in the 'context', 'old' or 'new' lines in the diff
    -z                    do not munge pathnames and use NULs as output field terminators in --raw or --numstat
    --[no-]abbrev[=<n>]   use <n> digits to display object names
    --src-prefix <prefix> show the given source prefix instead of "a/"
    --dst-prefix <prefix> show the given destination prefix instead of "b/"
    --line-prefix <prefix>
                          prepend an additional prefix to every line of output
    --no-prefix           do not show any source or destination prefix
    --default-prefix      use default prefixes a/ and b/
    --inter-hunk-context <n>
                          show context between diff hunks up to the specified number of lines
    --output-indicator-new <char>
                          specify the character to indicate a new line instead of '+'
    --output-indicator-old <char>
                          specify the character to indicate an old line instead of '-'
    --output-indicator-context <char>
                          specify the character to indicate a context instead of ' '

Diff rename options
    -B, --break-rewrites[=<n>[/<m>]]
                          break complete rewrite changes into pairs of delete and create
    -M, --find-renames[=<n>]
                          detect renames
    -D, --irreversible-delete
                          omit the preimage for deletes
    -C, --find-copies[=<n>]
                          detect copies
    --[no-]find-copies-harder
                          use unmodified files as source to find copies
    --no-renames          disable rename detection
    --[no-]rename-empty   use empty blobs as rename source
    --[no-]follow         continue listing the history of a file beyond renames
    -l <n>                prevent rename/copy detection if the number of rename/copy targets exceeds given limit

Diff algorithm options
    --minimal             produce the smallest possible diff
    -w, --ignore-all-space
                          ignore whitespace when comparing lines
    -b, --ignore-space-change
                          ignore changes in amount of whitespace
    --ignore-space-at-eol ignore changes in whitespace at EOL
    --ignore-cr-at-eol    ignore carrier-return at the end of line
    --ignore-blank-lines  ignore changes whose lines are all blank
    -I, --[no-]ignore-matching-lines <regex>
                          ignore changes whose all lines match <regex>
    --[no-]indent-heuristic
                          heuristic to shift diff hunk boundaries for easy reading
    --patience            generate diff using the "patience diff" algorithm
    --histogram           generate diff using the "histogram diff" algorithm
    --diff-algorithm <algorithm>
                          choose a diff algorithm
    --anchored <text>     generate diff using the "anchored diff" algorithm
    --word-diff[=<mode>]  show word diff, using <mode> to delimit changed words
    --word-diff-regex <regex>
                          use <regex> to decide what a word is
    --color-words[=<regex>]
                          equivalent to --word-diff=color --word-diff-regex=<regex>
    --[no-]color-moved[=<mode>]
                          moved lines of code are colored differently
    --[no-]color-moved-ws <mode>
                          how white spaces are ignored in --color-moved

Other diff options
    --[no-]relative[=<prefix>]
                          when run from subdir, exclude changes outside and show relative paths
    -a, --[no-]text       treat all files as text
    -R                    swap two inputs, reverse the diff
    --[no-]exit-code      exit with 1 if there were differences, 0 otherwise
    --[no-]quiet          disable all output of the program
    --[no-]ext-diff       allow an external diff helper to be executed
    --[no-]textconv       run external text conversion filters when comparing binary files
    --ignore-submodules[=<when>]
                          ignore changes to submodules in the diff generation
    --submodule[=<format>]
                          specify how differences in submodules are shown
    --ita-invisible-in-index
                          hide 'git add -N' entries from the index
    --ita-visible-in-index
                          treat 'git add -N' entries as real in the index
    -S <string>           look for differences that change the number of occurrences of the specified string
    -G <regex>            look for differences that change the number of occurrences of the specified regex
    --pickaxe-all         show all changes in the changeset with -S or -G
    --pickaxe-regex       treat <string> in -S as extended POSIX regular expression
    -O <file>             control the order in which files appear in the output
    --rotate-to <path>    show the change in the specified path first
    --skip-to <path>      skip the output to the specified path
    --find-object <object-id>
                          look for differences that change the number of occurrences of the specified object
    --diff-filter [(A|C|D|M|R|T|U|X|B)...[*]]
                          select files by diff type
    --output <file>       output to a specific file
```

##### `shortlog` — Summarize git log output

```text
usage: git shortlog [<options>] [<revision-range>] [[--] <path>...]
   or: git log --pretty=short | git shortlog [<options>]

    -c, --[no-]committer  group by committer rather than author
    -n, --[no-]numbered   sort output according to the number of commits per author
    -s, --[no-]summary    suppress commit descriptions, only provides commit count
    -e, --[no-]email      show the email address of each author
    -w[<w>[,<i1>[,<i2>]]] linewrap output
    --[no-]group <field>  group by field
```

##### `describe` — Give an object a human-readable name based on refs

```text
usage: git describe [--all] [--tags] [--contains] [--abbrev=<n>] [<commit-ish>...]
   or: git describe [--all] [--tags] [--contains] [--abbrev=<n>] --dirty[=<mark>]
   or: git describe <blob>

    --[no-]contains       find the tag that comes after the commit
    --[no-]debug          debug search strategy on stderr
    --[no-]all            use any ref
    --[no-]tags           use any tag, even unannotated
    --[no-]long           always use long format
    --[no-]first-parent   only follow first parent
    --[no-]abbrev[=<n>]   use <n> digits to display object names
    --[no-]exact-match    only output exact matches
    --[no-]candidates <n> consider <n> most recent tags (default: 10)
    --[no-]match <pattern>
                          only consider tags matching <pattern>
    --[no-]exclude <pattern>
                          do not consider tags matching <pattern>
    --[no-]always         show abbreviated commit object as fallback
    --[no-]dirty[=<mark>] append <mark> on dirty working tree (default: "-dirty")
    --[no-]broken[=<mark>]
                          append <mark> on broken working tree (default: "-broken")
```

#### Patching command details


##### `apply` — Apply a patch to files and/or to the index

```text
usage: git apply [<options>] [<patch>...]

    --exclude <path>      don't apply changes matching the given path
    --include <path>      apply changes matching the given path
    -p <num>              remove <num> leading slashes from traditional diff paths
    --no-add              ignore additions made by the patch
    --add                 opposite of --no-add
    --[no-]stat           instead of applying the patch, output diffstat for the input
    --[no-]numstat        show number of added and deleted lines in decimal notation
    --[no-]summary        instead of applying the patch, output a summary for the input
    --[no-]check          instead of applying the patch, see if the patch is applicable
    --[no-]index          make sure the patch is applicable to the current index
    -N, --[no-]intent-to-add
                          mark new files with `git add --intent-to-add`
    --[no-]cached         apply a patch without touching the working tree
    --[no-]unsafe-paths   accept a patch that touches outside the working area
    --[no-]apply          also apply the patch (use with --stat/--summary/--check)
    -3, --[no-]3way       attempt three-way merge, fall back on normal patch if that fails
    --ours                for conflicts, use our version
    --theirs              for conflicts, use their version
    --union               for conflicts, use a union version
    --[no-]build-fake-ancestor <file>
                          build a temporary index based on embedded index information
    -z                    paths are separated with NUL character
    -C <n>                ensure at least <n> lines of context match
    --[no-]whitespace <action>
                          detect new or modified lines that have whitespace errors
    --[no-]ignore-space-change
                          ignore changes in whitespace when finding context
    --[no-]ignore-whitespace
                          ignore changes in whitespace when finding context
    -R, --[no-]reverse    apply the patch in reverse
    --[no-]unidiff-zero   don't expect at least one line of context
    --[no-]reject         leave the rejected hunks in corresponding *.rej files
    --[no-]allow-overlap  allow overlapping hunks
    -v, --[no-]verbose    be more verbose
    -q, --[no-]quiet      be more quiet
    --[no-]inaccurate-eof tolerate incorrectly detected missing new-line at the end of file
    --[no-]recount        do not trust the line counts in the hunk headers
    --[no-]directory <root>
                          prepend <root> to all filenames
    --[no-]allow-empty    don't return error for empty patches
```

##### `cherry-pick` — Apply the changes introduced by existing commits

```text
usage: git cherry-pick [--edit] [-n] [-m <parent-number>] [-s] [-x] [--ff]
                       [-S[<keyid>]] <commit>...
   or: git cherry-pick (--continue | --skip | --abort | --quit)

    --quit                end revert or cherry-pick sequence
    --continue            resume revert or cherry-pick sequence
    --abort               cancel revert or cherry-pick sequence
    --skip                skip current commit and continue
    --[no-]cleanup <mode> how to strip spaces and #comments from message
    -n, --no-commit       don't automatically commit
    --commit              opposite of --no-commit
    -e, --[no-]edit       edit the commit message
    -s, --[no-]signoff    add a Signed-off-by trailer
    -m, --[no-]mainline <parent-number>
                          select mainline parent
    --[no-]rerere-autoupdate
                          update the index with reused conflict resolution if possible
    --[no-]strategy <strategy>
                          merge strategy
    -X, --[no-]strategy-option <option>
                          option for merge strategy
    -S, --[no-]gpg-sign[=<key-id>]
                          GPG sign commit
    -x                    append commit name
    --[no-]ff             allow fast-forward
    --[no-]allow-empty    preserve initially empty commits
    --[no-]allow-empty-message
                          allow commits with empty messages
    --[no-]keep-redundant-commits
                          deprecated: use --empty=keep instead
    --empty (stop|drop|keep)
                          how to handle commits that become empty
```

##### `rebase` — Reapply commits on top of another base tip

```text
usage: git rebase [-i] [options] [--exec <cmd>] [--onto <newbase> | --keep-base] [<upstream> [<branch>]]
   or: git rebase [-i] [options] [--exec <cmd>] [--onto <newbase>] --root [<branch>]
   or: git rebase --continue | --abort | --skip | --edit-todo

    --[no-]onto <revision>
                          rebase onto given branch instead of upstream
    --[no-]keep-base      use the merge-base of upstream and branch as the current base
    --no-verify           allow pre-rebase hook to run
    --verify              opposite of --no-verify
    -q, --[no-]quiet      be quiet. implies --no-stat
    -v, --[no-]verbose    display a diffstat of what changed upstream
    -n, --no-stat         do not show diffstat of what changed upstream
    --stat                opposite of --no-stat
    --[no-]signoff        add a Signed-off-by trailer to each commit
    --[no-]committer-date-is-author-date
                          make committer date match author date
    --[no-]reset-author-date
                          ignore author date and use current date
    -C <n>                passed to 'git apply'
    --[no-]ignore-whitespace
                          ignore changes in whitespace
    --[no-]whitespace <action>
                          passed to 'git apply'
    -f, --[no-]force-rebase
                          cherry-pick all commits, even if unchanged
    --no-ff               cherry-pick all commits, even if unchanged
    --ff                  opposite of --no-ff
    --continue            continue
    --skip                skip current patch and continue
    --abort               abort and check out the original branch
    --quit                abort but keep HEAD where it is
    --edit-todo           edit the todo list during an interactive rebase
    --show-current-patch  show the patch file being applied or merged
    --apply               use apply strategies to rebase
    -m, --merge           use merging strategies to rebase
    -i, --interactive     let the user edit the list of commits to rebase
    --[no-]rerere-autoupdate
                          update the index with reused conflict resolution if possible
    --empty (drop|keep|stop)
                          how to handle commits that become empty
    --[no-]autosquash     move commits that begin with squash!/fixup! under -i
    --[no-]update-refs    update branches that point to commits that are being rebased
    -S, --[no-]gpg-sign[=<key-id>]
                          GPG-sign commits
    --[no-]autostash      automatically stash/stash pop before and after
    -x, --[no-]exec <exec>
                          add exec lines after each commit of the editable list
    -r, --[no-]rebase-merges[=<mode>]
                          try to rebase merges instead of skipping them
    --[no-]fork-point     use 'merge-base --fork-point' to refine upstream
    -s, --[no-]strategy <strategy>
                          use the given merge strategy
    -X, --[no-]strategy-option <option>
                          pass the argument through to the merge strategy
    --[no-]root           rebase all reachable commits up to the root(s)
    --[no-]reschedule-failed-exec
                          automatically re-schedule any `exec` that fails
    --[no-]reapply-cherry-picks
                          apply all changes, even those already present upstream
```

##### `revert` — Revert existing commits by creating new commits

```text
usage: git revert [--[no-]edit] [-n] [-m <parent-number>] [-s] [-S[<keyid>]] <commit>...
   or: git revert (--continue | --skip | --abort | --quit)

    --quit                end revert or cherry-pick sequence
    --continue            resume revert or cherry-pick sequence
    --abort               cancel revert or cherry-pick sequence
    --skip                skip current commit and continue
    --[no-]cleanup <mode> how to strip spaces and #comments from message
    -n, --no-commit       don't automatically commit
    --commit              opposite of --no-commit
    -e, --[no-]edit       edit the commit message
    -s, --[no-]signoff    add a Signed-off-by trailer
    -m, --[no-]mainline <parent-number>
                          select mainline parent
    --[no-]rerere-autoupdate
                          update the index with reused conflict resolution if possible
    --[no-]strategy <strategy>
                          merge strategy
    -X, --[no-]strategy-option <option>
                          option for merge strategy
    -S, --[no-]gpg-sign[=<key-id>]
                          GPG sign commit
    --[no-]reference      use the 'reference' format to refer to commits
```

#### Debugging command details


##### `bisect` — Use binary search to find the commit that introduced a bug

```text
usage: git bisect start [--term-(new|bad)=<term> --term-(old|good)=<term>]    [--no-checkout] [--first-parent] [<bad> [<good>...]] [--]    [<pathspec>...]
   or: git bisect (good|bad) [<rev>...]
   or: git bisect terms [--term-good | --term-bad]
   or: git bisect skip [(<rev>|<range>)...]
   or: git bisect next
   or: git bisect reset [<commit>]
   or: git bisect visualize
   or: git bisect replay <logfile>
   or: git bisect log
   or: git bisect run <cmd> [<arg>...]
```

##### `blame` — Show what revision and author last modified each line

```text
usage: git blame [<options>] [<rev-opts>] [<rev>] [--] <file>

    <rev-opts> are documented in git-rev-list(1)

    --[no-]incremental    show blame entries as we find them, incrementally
    -b                    do not show object names of boundary commits (Default: off)
    --[no-]root           do not treat root commits as boundaries (Default: off)
    --[no-]show-stats     show work cost statistics
    --[no-]progress       force progress reporting
    --[no-]score-debug    show output score for blame entries
    -f, --[no-]show-name  show original filename (Default: auto)
    -n, --[no-]show-number
                          show original linenumber (Default: off)
    -p, --[no-]porcelain  show in a format designed for machine consumption
    --[no-]line-porcelain show porcelain format with per-line commit information
    -c                    use the same output mode as git-annotate (Default: off)
    -t                    show raw timestamp (Default: off)
    -l                    show long commit SHA1 (Default: off)
    -s                    suppress author name and timestamp (Default: off)
    -e, --[no-]show-email show author email instead of name (Default: off)
    -w                    ignore whitespace differences
    --[no-]ignore-rev <rev>
                          ignore <rev> when blaming
    --[no-]ignore-revs-file <file>
                          ignore revisions from <file>
    --[no-]color-lines    color redundant metadata from previous line differently
    --[no-]color-by-age   color lines by age
    --[no-]minimal        spend extra cycles to find better match
    -S <file>             use revisions from <file> instead of calling git-rev-list
    --[no-]contents <file>
                          use <file>'s contents as the final image
    -C[<score>]           find line copies within and across files
    -M[<score>]           find line movements within and across files
    -L <range>            process only line range <start>,<end> or function :<funcname>
    --[no-]abbrev[=<n>]   use <n> digits to display object names
```

##### `grep` — Print lines matching a pattern

```text
usage: git grep [<options>] [-e] <pattern> [<rev>...] [[--] <path>...]

    --[no-]cached         search in index instead of in the work tree
    --no-index            find in contents not managed by git
    --index               opposite of --no-index
    --[no-]untracked      search in both tracked and untracked files
    --[no-]exclude-standard
                          ignore files specified via '.gitignore'
    --[no-]recurse-submodules
                          recursively search in each submodule

    -v, --[no-]invert-match
                          show non-matching lines
    -i, --[no-]ignore-case
                          case insensitive matching
    -w, --[no-]word-regexp
                          match patterns only at word boundaries
    -a, --[no-]text       process binary files as text
    -I                    don't match patterns in binary files
    --[no-]textconv       process binary files with textconv filters
    -r, --[no-]recursive  search in subdirectories (default)
    --max-depth <n>       descend at most <n> levels

    -E, --[no-]extended-regexp
                          use extended POSIX regular expressions
    -G, --[no-]basic-regexp
                          use basic POSIX regular expressions (default)
    -F, --[no-]fixed-strings
                          interpret patterns as fixed strings
    -P, --[no-]perl-regexp
                          use Perl-compatible regular expressions

    -n, --[no-]line-number
                          show line numbers
    --[no-]column         show column number of first match
    -h                    don't show filenames
    -H                    show filenames
    --[no-]full-name      show filenames relative to top directory
    -l, --[no-]files-with-matches
                          show only filenames instead of matching lines
    --[no-]name-only      synonym for --files-with-matches
    -L, --[no-]files-without-match
                          show only the names of files without match
    -z, --[no-]null       print NUL after filenames
    -o, --[no-]only-matching
                          show only matching parts of a line
    -c, --[no-]count      show the number of matches instead of matching lines
    --[no-]color[=<when>] highlight matches
    --[no-]break          print empty line between matches from different files
    --[no-]heading        show filename only once above matches from same file

    -C, --[no-]context <n>
                          show <n> context lines before and after matches
    -B, --[no-]before-context <n>
                          show <n> context lines before matches
    -A, --[no-]after-context <n>
                          show <n> context lines after matches
    --[no-]threads <n>    use <n> worker threads
    -NUM                  shortcut for -C NUM
    -p, --[no-]show-function
                          show a line with the function name before matches
    -W, --[no-]function-context
                          show the surrounding function

    -f <file>             read patterns from file
    -e <pattern>          match <pattern>
    --and                 combine patterns specified with -e
    --or
    --not
    (
    )
    -q, --[no-]quiet      indicate hit with exit status without output
    --[no-]all-match      show only matches from files that match all patterns

    -O, --[no-]open-files-in-pager[=<pager>]
                          show matching files in the pager
    --[no-]ext-grep       allow calling of grep(1) (ignored by this build)
    -m, --[no-]max-count <n>
                          maximum number of results per file
```

#### Email command details


##### `am` — Apply a series of patches from a mailbox

```text
usage: git am [<options>] [(<mbox> | <Maildir>)...]
   or: git am [<options>] (--continue | --skip | --abort)

    -i, --[no-]interactive
                          run interactively
    -n, --no-verify       bypass pre-applypatch and applypatch-msg hooks
    --verify              opposite of --no-verify
    -3, --[no-]3way       allow fall back on 3way merging if needed
    -q, --[no-]quiet      be quiet
    -s, --[no-]signoff    add a Signed-off-by trailer to the commit message
    -u, --[no-]utf8       recode into utf8 (default)
    -k, --[no-]keep       pass -k flag to git-mailinfo
    --[no-]keep-non-patch pass -b flag to git-mailinfo
    -m, --[no-]message-id pass -m flag to git-mailinfo
    --[no-]keep-cr        pass --keep-cr flag to git-mailsplit for mbox format
    -c, --[no-]scissors   strip everything before a scissors line
    --quoted-cr <action>  pass it through git-mailinfo
    --[no-]whitespace <action>
                          pass it through git-apply
    --[no-]ignore-space-change
                          pass it through git-apply
    --[no-]ignore-whitespace
                          pass it through git-apply
    --[no-]directory <root>
                          pass it through git-apply
    --[no-]exclude <path> pass it through git-apply
    --[no-]include <path> pass it through git-apply
    -C <n>                pass it through git-apply
    -p <num>              pass it through git-apply
    --[no-]patch-format <format>
                          format the patch(es) are in
    --[no-]reject         pass it through git-apply
    --[no-]resolvemsg ... override error message when patch failure occurs
    --continue            continue applying patches after resolving a conflict
    -r, --resolved        synonyms for --continue
    --skip                skip the current patch
    --abort               restore the original branch and abort the patching operation
    --quit                abort the patching operation but keep HEAD where it is
    --show-current-patch[=(diff|raw)]
                          show the patch being applied
    --retry               try to apply current patch again
    --allow-empty         record the empty patch as an empty commit
    --[no-]committer-date-is-author-date
                          lie about committer date
    --[no-]ignore-date    use current timestamp for author date
    --[no-]rerere-autoupdate
                          update the index with reused conflict resolution if possible
    -S, --[no-]gpg-sign[=<key-id>]
                          GPG-sign commits
    --empty (stop|drop|keep)
                          how to handle empty patches
```

##### `imap-send` — Send a collection of patches from stdin to an IMAP folder

```text
usage: git imap-send [-v] [-q] [--[no-]curl] < <mbox>

    -v, --[no-]verbose    be more verbose
    -q, --[no-]quiet      be more quiet
    --[no-]curl           use libcurl to communicate with the IMAP server
```

##### `format-patch` — Prepare patches for e-mail submission

```text
usage: git format-patch [<options>] [<since> | <revision-range>]

    -n, --[no-]numbered   use [PATCH n/m] even with a single patch
    -N, --no-numbered     use [PATCH] even with multiple patches
    -s, --[no-]signoff    add a Signed-off-by trailer
    --[no-]stdout         print patches to standard out
    --[no-]cover-letter   generate a cover letter
    --[no-]numbered-files use simple number sequence for output file names
    --[no-]suffix <sfx>   use <sfx> instead of '.patch'
    --[no-]start-number <n>
                          start numbering patches at <n> instead of 1
    -v, --[no-]reroll-count <reroll-count>
                          mark the series as Nth re-roll
    --[no-]filename-max-length <n>
                          max length of output filename
    --[no-]rfc[=<rfc>]    add <rfc> (default 'RFC') before 'PATCH'
    --[no-]cover-from-description <cover-from-description-mode>
                          generate parts of a cover letter based on a branch's description
    --[no-]description-file <file>
                          use branch description from file
    --subject-prefix <prefix>
                          use [<prefix>] instead of [PATCH]
    -o, --output-directory <dir>
                          store resulting files in <dir>
    -k, --keep-subject    don't strip/add [PATCH]
    --no-binary           don't output binary diffs
    --binary              opposite of --no-binary
    --[no-]zero-commit    output all-zero hash in From header
    --[no-]ignore-if-in-upstream
                          don't include a patch matching a commit upstream
    -p, --no-stat         show patch format instead of default (patch + stat)

Messaging
    --[no-]add-header <header>
                          add email header
    --[no-]to <email>     add To: header
    --[no-]cc <email>     add Cc: header
    --[no-]from[=<ident>] set From address to <ident> (or committer ident if absent)
    --[no-]in-reply-to <message-id>
                          make first mail a reply to <message-id>
    --[no-]attach[=<boundary>]
                          attach the patch
    --inline[=<boundary>] inline the patch
    --[no-]thread[=<style>]
                          enable message threading, styles: shallow, deep
    --[no-]signature <signature>
                          add a signature
    --[no-]base <base-commit>
                          add prerequisite tree info to the patch series
    --[no-]signature-file <file>
                          add a signature from a file
    -q, --[no-]quiet      don't print the patch filenames
    --[no-]progress       show progress while generating patches
    --[no-]interdiff <rev>
                          show changes against <rev> in cover letter or single patch
    --[no-]range-diff <refspec>
                          show changes against <refspec> in cover letter or single patch
    --[no-]creation-factor <n>
                          percentage by which creation is weighted
    --[no-]force-in-body-from
                          show in-body From: even if identical to the e-mail header
```

##### `send-email` — Send a collection of patches as emails

```text
usage: git send-email [<options>] <file|directory>...
   or: git send-email [<options>] <format-patch-options>

Sends patch emails generated by git format-patch. Requires SMTP configuration via sendemail.* config or command-line options.
Common option families: --to/--cc/--bcc, --from, --subject, --smtp-server, --smtp-server-port, --smtp-user, --smtp-encryption, --annotate, --dry-run, --thread, --in-reply-to, --cover-letter.
```

##### `request-pull` — Generate a summary of pending changes

```text
usage: git request-pull [options] start url [end]

    -p                    show patch text as well
```

#### External systems command details


##### `svn` — Bidirectional operation between a Subversion repository and Git

```text
usage: git svn <command> [<options>] [<arguments>]

Common commands:
    clone        initialize and fetch from SVN repository
    init         initialize SVN metadata without fetching
    fetch        fetch revisions from SVN
    rebase       fetch and rebase current branch onto SVN remote
    dcommit      commit each Git commit as an SVN revision
    log          show SVN log
    find-rev     translate SVN revision to Git commit or vice versa
    info         show SVN repository information
    create-ignore / show-ignore  derive .gitignore-style ignores from svn:ignore

Requires Subversion/Perl support in the Git installation.
```

##### `fast-import` — Backend for fast Git data importers

```text
usage: git fast-import [--date-format=<f>] [--max-pack-size=<n>] [--big-file-threshold=<n>] [--depth=<n>] [--active-branches=<n>] [--export-marks=<marks.file>]
```

##### `p4` — Import from and submit to Perforce repositories

```text
usage: git p4 clone [<sync options>] [<clone options>] <p4 depot path>...
   or: git p4 sync [<sync options>] [<p4 depot path>...]
   or: git p4 rebase
   or: git p4 submit [<submit options>] [<master branch name>]

Perforce bridge. Requires p4 client configuration and access to a Perforce server.
```

##### `archimport` — Import a GNU Arch repository into Git

```text
usage: git archimport [-h] [-v] [-o] [-a] [-f] [-T] [-D <depth>] [-t <tempdir>]
                      <archive>/<branch>[:<git-branch>]...

    -h              display usage
    -v              verbose
    -o              use old-style branch names
    -a              auto-register archives
    -f              force overwrite of existing Git branches
    -T              create tags for imported branch names
    -D <depth>      follow merge ancestry to depth
    -t <tempdir>    temporary directory
```

##### `cvsexportcommit` — Export a single commit to a CVS checkout

```text
usage: git cvsexportcommit [-h] [-u] [-v] [-c] [-P] [-p] [-a] [-d <cvsroot>]
                          [-w <cvs-workdir>] [-W] [-f] [-m <msgprefix>] [<parent-commit>] <commit-id>

Exports a single Git commit to a CVS checkout. Checks CVS working copy safety and does not autocommit by default.
```

##### `cvsimport` — Salvage data from CVS into Git

```text
usage: git cvsimport [-o <branch-for-HEAD>] [-h] [-v] [-d <CVSROOT>]
                     [-A <author-conv-file>] [-p <options-for-cvsps>] [-P <file>]
                     [-C <git-repository>] [-z <fuzz>] [-i] [-k] [-u] [-s <subst>]
                     [-a] [-m] [-M <regex>] [-S <regex>] [-L <commit-limit>]
                     [-r <remote>] [-R] [<CVS-module>]

Imports CVS history into Git. Requires cvsps/cvs tooling in typical installations.
```

##### `cvsserver` — CVS server emulator for Git

```text
usage: git cvsserver [<options>] [pserver|server] [<directory>...]

CVS server emulator for Git. Supports SSH server mode and pserver when configured. Used by CVS clients against a Git repository.
```

##### `quiltimport` — Apply a quilt patchset onto the current branch

```text
usage: git quiltimport [options]

    -n, --[no-]dry-run    dry run
    --[no-]author ...     author name and email address for patches without any
    --[no-]patches ...    path to the quilt patches
    --[no-]series ...     path to the quilt series file
    --[no-]keep-non-patch Pass -b to git mailinfo
```

#### Administration command details


##### `clean` — Remove untracked files from the working tree

```text
usage: git clean [-d] [-f] [-i] [-n] [-q] [-e <pattern>] [-x | -X] [--] [<pathspec>...]

    -q, --[no-]quiet      do not print names of files removed
    -n, --[no-]dry-run    dry run
    -f, --[no-]force      force
    -i, --[no-]interactive
                          interactive cleaning
    -d                    remove whole directories
    -e, --exclude <pattern>
                          add <pattern> to ignore rules
    -x                    remove ignored files, too
    -X                    remove only ignored files
```

##### `gc` — Clean up unnecessary files and optimize the local repository

```text
usage: git gc [<options>]

    -q, --[no-]quiet      suppress progress reporting
    --[no-]prune[=<date>] prune unreferenced objects
    --[no-]cruft          pack unreferenced objects separately
    --max-cruft-size <n>  with --cruft, limit the size of new cruft packs
    --[no-]aggressive     be more thorough (increased runtime)
    --[no-]auto           enable auto-gc mode
    --[no-]detach         perform garbage collection in the background
    --[no-]force          force running gc even if there may be another gc running
    --[no-]keep-largest-pack
                          repack all other packs except the largest pack
```

##### `fsck` — Verify connectivity and validity of objects in the database

```text
usage: git fsck [--tags] [--root] [--unreachable] [--cache] [--no-reflogs]
                [--[no-]full] [--strict] [--verbose] [--lost-found]
                [--[no-]dangling] [--[no-]progress] [--connectivity-only]
                [--[no-]name-objects] [<object>...]

    -v, --[no-]verbose    be verbose
    --[no-]unreachable    show unreachable objects
    --[no-]dangling       show dangling objects
    --[no-]tags           report tags
    --[no-]root           report root nodes
    --[no-]cache          make index objects head nodes
    --[no-]reflogs        make reflogs head nodes (default)
    --[no-]full           also consider packs and alternate objects
    --[no-]connectivity-only
                          check only connectivity
    --[no-]strict         enable more strict checking
    --[no-]lost-found     write dangling objects in .git/lost-found
    --[no-]progress       show progress
    --[no-]name-objects   show verbose names for reachable objects
```

##### `reflog` — Manage reflog information

```text
usage: git reflog [show] [<log-options>] [<ref>]
   or: git reflog list
   or: git reflog expire [--expire=<time>] [--expire-unreachable=<time>]
                         [--rewrite] [--updateref] [--stale-fix]
                         [--dry-run | -n] [--verbose] [--all [--single-worktree] | <refs>...]
   or: git reflog delete [--rewrite] [--updateref]
                         [--dry-run | -n] [--verbose] <ref>@{<specifier>}...
   or: git reflog exists <ref>
```

##### `filter-branch` — Rewrite branches

```text
usage: git filter-branch [--setup <command>] [--subdirectory-filter <directory>] [--env-filter <command>]
	[--tree-filter <command>] [--index-filter <command>]
	[--parent-filter <command>] [--msg-filter <command>]
	[--commit-filter <command>] [--tag-name-filter <command>]
	[--original <namespace>]
	[-d <directory>] [-f | --force] [--state-branch <branch>]
	[--] [<rev-list options>...]
```

##### `instaweb` — Instantly browse a working repository in gitweb

```text
usage: git instaweb [options] (--start | --stop | --restart)

    -l, --[no-]local      only bind on 127.0.0.1
    -p, --[no-]port ...   the port to bind to
    -d, --[no-]httpd ...  the command to launch
    -b, --[no-]browser ...
                          the browser to launch
    -m, --[no-]module-path ...
                          the module path (only needed for apache2)

Action
    --[no-]stop           stop the web server
    --[no-]start          start the web server
    --[no-]restart        restart the web server
```

##### `archive` — Create an archive of files from a named tree

```text
usage: git archive [<options>] <tree-ish> [<path>...]
   or: git archive --list
   or: git archive --remote <repo> [--exec <cmd>] [<options>] <tree-ish> [<path>...]
   or: git archive --remote <repo> [--exec <cmd>] --list

    --[no-]format <fmt>   archive format
    --[no-]prefix <prefix>
                          prepend prefix to each pathname in the archive
    --[no-]add-file <file>
                          add untracked file to archive
    --[no-]add-virtual-file <path:content>
                          add untracked file to archive
    -o, --[no-]output <file>
                          write the archive to this file
    --[no-]worktree-attributes
                          read .gitattributes in working directory
    -v, --[no-]verbose    report archived files on stderr
    --mtime <time>        set modification time of archive entries
    -NUM                  set compression level

    -l, --[no-]list       list supported archive formats

    --[no-]remote <repo>  retrieve the archive from remote repository <repo>
    --[no-]exec <command> path to the remote git-upload-archive command
```

##### `bundle` — Move objects and refs by archive

```text
usage: git bundle create [-q | --quiet | --progress]
                         [--version=<version>] <file> <git-rev-list-args>
   or: git bundle verify [-q | --quiet] <file>
   or: git bundle list-heads <file> [<refname>...]
   or: git bundle unbundle [--progress] <file> [<refname>...]
```

##### `maintenance` — Run tasks to optimize Git repository data

```text
usage: git maintenance <subcommand> [<options>]
```

##### `sparse-checkout` — Reduce the working tree to a subset of tracked files

```text
usage: git sparse-checkout (init | list | set | add | reapply | disable | check-rules) [<options>]
```

##### `replace` — Create, list, delete refs to replace objects

```text
usage: git replace [-f] <object> <replacement>
   or: git replace [-f] --edit <object>
   or: git replace [-f] --graft <commit> [<parent>...]
   or: git replace [-f] --convert-graft-file
   or: git replace -d <object>...
   or: git replace [--format=<format>] [-l [<pattern>]]

    -l, --list            list replace refs
    -d, --delete          delete replace refs
    -e, --edit            edit existing object
    -g, --graft           change a commit's parents
    --convert-graft-file  convert existing graft file
    -f, --[no-]force      replace the ref if it exists
    --[no-]raw            do not pretty-print contents for --edit
    --[no-]format <format>
                          use this format
```

##### `refs` — Low-level access to refs

```text
usage: git refs migrate --ref-format=<format> [--dry-run]
   or: git refs verify [--strict] [--verbose]
```

##### `pack-refs` — Pack heads and tags for efficient repository access

```text
usage: git pack-refs [--all] [--no-prune] [--auto] [--include <pattern>] [--exclude <pattern>]

    --[no-]all            pack everything
    --[no-]prune          prune loose refs (default)
    --[no-]auto           auto-pack refs as needed
    --[no-]include <pattern>
                          references to include
    --[no-]exclude <pattern>
                          references to exclude
```

##### `prune` — Prune unreachable objects

```text
usage: git prune [-n] [-v] [--progress] [--expire <time>] [--] [<head>...]

    -n, --[no-]dry-run    do not remove, show only
    -v, --[no-]verbose    report pruned objects
    --[no-]progress       show progress
    --[no-]expire <expiry-date>
                          expire objects older than <time>
    --[no-]exclude-promisor-objects
                          limit traversal to objects outside promisor packfiles
```

##### `repack` — Pack unpacked objects

```text
usage: git repack [<options>]

    -a                    pack everything in a single pack
    -A                    same as -a, and turn unreachable objects loose
    --[no-]cruft          same as -a, pack unreachable cruft objects separately
    --[no-]cruft-expiration <approxidate>
                          with --cruft, expire objects older than this
    --max-cruft-size <n>  with --cruft, limit the size of new cruft packs
    -d                    remove redundant packs, and run git-prune-packed
    -f                    pass --no-reuse-delta to git-pack-objects
    -F                    pass --no-reuse-object to git-pack-objects
    -n                    do not run git-update-server-info
    -q, --[no-]quiet      be quiet
    -l, --[no-]local      pass --local to git-pack-objects
    -b, --[no-]write-bitmap-index
                          write bitmap index
    -i, --[no-]delta-islands
                          pass --delta-islands to git-pack-objects
    --[no-]unpack-unreachable <approxidate>
                          with -A, do not loosen objects older than this
    -k, --[no-]keep-unreachable
                          with -a, repack unreachable objects
    --[no-]window <n>     size of the window used for delta compression
    --[no-]window-memory <bytes>
                          same as the above, but limit memory size instead of entries count
    --[no-]depth <n>      limits the maximum delta depth
    --[no-]threads <n>    limits the maximum number of threads
    --max-pack-size <n>   maximum size of each packfile
    --[no-]filter <args>  object filtering
    --[no-]pack-kept-objects
                          repack objects in packs marked with .keep
    --[no-]keep-pack <name>
                          do not repack this pack
    -g, --[no-]geometric <n>
                          find a geometric progression with factor <N>
    -m, --[no-]write-midx write a multi-pack index of the resulting packs
    --[no-]expire-to <dir>
                          pack prefix to store a pack containing pruned objects
    --[no-]filter-to <dir>
                          pack prefix to store a pack containing filtered out objects
```

#### GUI and large-repository helpers command details


##### `gui` — Portable Tcl/Tk graphical interface to Git

```text
usage: git gui [<command>] [<arguments>]

Commands:
    blame [<rev>] <file>      start blame viewer for file
    browser [<rev>]           start tree browser for commit
    citool [--amend|--nocommit] start single-commit GUI mode and return to shell
    version                   display git gui version
```

##### `citool` — Graphical alternative to git-commit; alias for git gui citool

```text
usage: git citool

Graphical alternative to git commit. Standard alias for `git gui citool`.
```

##### `gitk` — Git repository browser

```text
usage: gitk [<options>] [<revision-range>] [--] [<path>...]

Repository browser. Accepts git rev-list-style revision ranges and path limiters plus gitk GUI options. Visualizes commit graph, commit metadata, and tree/file differences.
```

##### `scalar` — Tool for managing large Git repositories

```text
usage: scalar [-C <directory>] [-c <key>=<value>] <command> [<options>]

Commands:
	clone
	list
	register
	unregister
	run
	reconfigure
	delete
	help
	version
	diagnose

# scalar clone
usage: scalar clone [--single-branch] [--branch <main-branch>] [--full-clone]
       	[--[no-]src] [--[no-]tags] <url> [<enlistment>]

    -b, --[no-]branch <branch>
                          branch to checkout after clone
    --[no-]full-clone     when cloning, create full working directory
    --[no-]single-branch  only download metadata for the branch that will be checked out
    --[no-]src            create repository within 'src' directory
    --[no-]tags           specify if tags should be fetched during clone

# scalar list
fatal: `scalar list` does not take arguments

# scalar register
usage: scalar register [<enlistment>]

# scalar unregister
usage: scalar unregister [<enlistment>]

# scalar run
usage: scalar run <task> [<enlistment>]
       Tasks:
       	config
       	commit-graph
       	fetch
       	loose-objects
       	pack-files

# scalar reconfigure
usage: scalar reconfigure [--all | <enlistment>]

    -a, --[no-]all        reconfigure all registered enlistments

# scalar delete
usage: scalar delete <enlistment>

# scalar help
usage: scalar help

# scalar version
usage: scalar verbose [-v | --verbose] [--build-options]

    -v, --[no-]verbose    include Git version
    --[no-]build-options  include Git's build options

# scalar diagnose
usage: scalar diagnose [<enlistment>]
```

#### Experimental porcelain in 2.54 command details


##### `backfill` — Download missing objects in a partial clone

```text
usage: git backfill [--min-batch-size=<n>] [--[no-]sparse] [<rev-list-options>]

    --min-batch-size=<n>   minimum missing-object batch size requested from server; default 50000
    --[no-]sparse          restrict downloads to paths matching sparse-checkout when enabled
    <rev-list-options>     commit-limiting options accepted by git rev-list

EXPERIMENTAL. Downloads missing blobs in partial clones, especially blobless clones made with --filter=blob:none.
```

##### `history` — EXPERIMENTAL: rewrite history

```text
usage: git history reword <commit> [--dry-run] [--update-refs=(branches|head)]
   or: git history split <commit> [--dry-run] [--update-refs=(branches|head)] [--] [<pathspec>...]

Commands:
    reword <commit>                         rewrite the commit message for <commit>
    split <commit> [--] [<pathspec>...]     interactively split <commit> into two commits

Options:
    --dry-run                               write needed objects and print ref updates without updating refs
    --update-refs=(branches|head)           update all descendant local branches or only HEAD; default branches

EXPERIMENTAL. Does not yet support histories containing merges or operations that can result in merge conflicts.
```

##### `last-modified` — EXPERIMENTAL: show when files were last modified

```text
usage: git last-modified [--recursive] [--show-trees] [--max-depth=<depth>] [-z]
                         [<revision-range>] [[--] <pathspec>...]

    -r, --recursive             descend recursively into subtrees; equivalent to --max-depth=-1
    -t, --show-trees            show tree entries while recursing
    --max-depth=<depth>         maximum levels to traverse; negative means no limit; default 0
    -z                          NUL-terminate output lines
    <revision-range>            commits to traverse; default HEAD
    [--] <pathspec>...          limit paths

EXPERIMENTAL. Output: <oid> TAB <path> LF, or NUL with -z.
```

#### Low-level manipulation commands command details


##### `checkout-index` — Copy files from the index to the working tree

```text
usage: git checkout-index [<options>] [--] [<file>...]

    -a, --[no-]all        check out all files in the index
    --[no-]ignore-skip-worktree-bits
                          do not skip files with skip-worktree set
    -f, --[no-]force      force overwrite of existing files
    -q, --[no-]quiet      no warning for existing files and files not in index
    -n, --no-create       don't checkout new files
    --create              opposite of --no-create
    -u, --[no-]index      update stat information in the index file
    -z                    paths are separated with NUL character
    --[no-]stdin          read list of paths from the standard input
    --[no-]temp           write the content to temporary files
    --[no-]prefix <string>
                          when creating files, prepend <string>
    --stage (1|2|3|all)   copy out the files from named stage
```

##### `commit-graph` — Write and verify Git commit-graph files

```text
usage: git commit-graph verify [--object-dir <dir>] [--shallow] [--[no-]progress]
   or: git commit-graph write [--object-dir <dir>] [--append]
                              [--split[=<strategy>]] [--reachable | --stdin-packs | --stdin-commits]
                              [--changed-paths] [--[no-]max-new-filters <n>] [--[no-]progress]
                              <split-options>

    --[no-]object-dir <dir>
                          the object directory to store the graph
```

##### `commit-tree` — Create a new commit object

```text
usage: git commit-tree <tree> [(-p <parent>)...]
   or: git commit-tree [(-p <parent>)...] [-S[<keyid>]] [(-m <message>)...]
                       [(-F <file>)...] <tree>

    -p <parent>           id of a parent commit object
    -m <message>          commit message
    -F <file>             read commit log message from file
    -S, --[no-]gpg-sign[=<key-id>]
                          GPG sign commit
```

##### `hash-object` — Compute object ID and optionally create an object from a file

```text
usage: git hash-object [-t <type>] [-w] [--path=<file> | --no-filters]
                       [--stdin [--literally]] [--] <file>...
   or: git hash-object [-t <type>] [-w] --stdin-paths [--no-filters]

    -t <type>             object type
    -w                    write the object into the object database
    --[no-]stdin          read the object from stdin
    --[no-]stdin-paths    read file names from stdin
    --no-filters          store file as is without filters
    --filters             opposite of --no-filters
    --[no-]literally      just hash any random garbage to create corrupt objects for debugging Git
    --[no-]path <file>    process file as it were from this path
```

##### `index-pack` — Build pack index file for an existing packed archive

```text
usage: git index-pack [-v] [-o <index-file>] [--keep | --keep=<msg>] [--[no-]rev-index] [--verify] [--strict[=<msg-id>=<severity>...]] [--fsck-objects[=<msg-id>=<severity>...]] (<pack-file> | --stdin [--fix-thin] [<pack-file>])
```

##### `merge-file` — Run a three-way file merge

```text
usage: git merge-file [<options>] [-L <name1> [-L <orig> [-L <name2>]]] <file1> <orig-file> <file2>

    -p, --[no-]stdout     send results to standard output
    --[no-]object-id      use object IDs instead of filenames
    --[no-]diff3          use a diff3 based merge
    --[no-]zdiff3         use a zealous diff3 based merge
    --[no-]ours           for conflicts, use our version
    --[no-]theirs         for conflicts, use their version
    --[no-]union          for conflicts, use a union version
    --diff-algorithm <algorithm>
                          choose a diff algorithm
    --[no-]marker-size <n>
                          for conflicts, use this marker size
    -q, --[no-]quiet      do not warn about conflicts
    -L <name>             set labels for file1/orig-file/file2
```

##### `merge-index` — Run a merge for files needing merging

```text
usage: git merge-index [-o] [-q] <merge-program> (-a | [--] [<filename>...])
```

##### `mktag` — Create a tag object with extra validation

```text
usage: git mktag

    --[no-]strict         enable more strict checking
```

##### `mktree` — Build a tree object from ls-tree formatted text

```text
usage: git mktree [-z] [--missing] [--batch]

    -z                    input is NUL terminated
    --[no-]missing        allow missing objects
    --[no-]batch          allow creation of more than one tree
```

##### `multi-pack-index` — Write and verify multi-pack-indexes

```text
usage: git multi-pack-index [<options>] write [--preferred-pack=<pack>][--refs-snapshot=<path>]
   or: git multi-pack-index [<options>] verify
   or: git multi-pack-index [<options>] expire
   or: git multi-pack-index [<options>] repack [--batch-size=<size>]

    --[no-]object-dir <directory>
                          object directory containing set of packfile and pack-index pairs
```

##### `pack-objects` — Create a packed archive of objects

```text
usage: git pack-objects --stdout [<options>] [< <ref-list> | < <object-list>]
   or: git pack-objects [<options>] <base-name> [< <ref-list> | < <object-list>]

    -q, --[no-]quiet      do not show progress meter
    --[no-]progress       show progress meter
    --[no-]all-progress   show progress meter during object writing phase
    --[no-]all-progress-implied
                          similar to --all-progress when progress meter is shown
    --index-version <version>[,<offset>]
                          write the pack index file in the specified idx format version
    --max-pack-size <n>   maximum size of each output pack file
    --[no-]local          ignore borrowed objects from alternate object store
    --[no-]incremental    ignore packed objects
    --[no-]window <n>     limit pack window by objects
    --window-memory <n>   limit pack window by memory in addition to object limit
    --[no-]depth <n>      maximum length of delta chain allowed in the resulting pack
    --[no-]reuse-delta    reuse existing deltas
    --[no-]reuse-object   reuse existing objects
    --[no-]delta-base-offset
                          use OFS_DELTA objects
    --[no-]threads <n>    use threads when searching for best delta matches
    --[no-]non-empty      do not create an empty pack output
    --[no-]revs           read revision arguments from standard input
    --unpacked            limit the objects to those that are not yet packed
    --all                 include objects reachable from any reference
    --reflog              include objects referred by reflog entries
    --indexed-objects     include objects referred to by the index
    --[no-]stdin-packs    read packs from stdin
    --[no-]stdout         output pack to stdout
    --[no-]include-tag    include tag objects that refer to objects to be packed
    --[no-]keep-unreachable
                          keep unreachable objects
    --[no-]pack-loose-unreachable
                          pack loose unreachable objects
    --[no-]unpack-unreachable[=<time>]
                          unpack unreachable objects newer than <time>
    --[no-]cruft          create a cruft pack
    --[no-]cruft-expiration[=<time>]
                          expire cruft objects older than <time>
    --[no-]sparse         use the sparse reachability algorithm
    --[no-]thin           create thin packs
    --[no-]shallow        create packs suitable for shallow fetches
    --[no-]honor-pack-keep
                          ignore packs that have companion .keep file
    --[no-]keep-pack <name>
                          ignore this pack
    --[no-]compression <n>
                          pack compression level
    --[no-]keep-true-parents
                          do not hide commits by grafts
    --[no-]use-bitmap-index
                          use a bitmap index if available to speed up counting objects
    --[no-]write-bitmap-index
                          write a bitmap index together with the pack index
    --[no-]filter <args>  object filtering
    --missing <action>    handling for missing objects
    --[no-]exclude-promisor-objects
                          do not pack objects in promisor packfiles
    --[no-]delta-islands  respect islands during delta compression
    --[no-]uri-protocol <protocol>
                          exclude any configured uploadpack.blobpackfileuri with this protocol
```

##### `prune-packed` — Remove extra objects already in pack files

```text
usage: git prune-packed [-n | --dry-run] [-q | --quiet]

    -n, --[no-]dry-run    dry run
    -q, --[no-]quiet      be quiet
```

##### `read-tree` — Read tree information into the index

```text
usage: git read-tree [(-m [--trivial] [--aggressive] | --reset | --prefix=<prefix>)
                     [-u | -i]] [--index-output=<file>] [--no-sparse-checkout]
                     (--empty | <tree-ish1> [<tree-ish2> [<tree-ish3>]])

    --index-output <file> write resulting index to <file>
    --[no-]empty          only empty the index
    -v, --[no-]verbose    be verbose

Merging
    -m                    perform a merge in addition to a read
    --[no-]trivial        3-way merge if no file level merging required
    --[no-]aggressive     3-way merge in presence of adds and removes
    --[no-]reset          same as -m, but discard unmerged entries
    --prefix <subdirectory>/
                          read the tree into the index under <subdirectory>/
    -u                    update working tree with merge result
    --exclude-per-directory <gitignore>
                          allow explicitly ignored files to be overwritten
    -i                    don't check the working tree after merging
    -n, --[no-]dry-run    don't update the index or the work tree
    --no-sparse-checkout  skip applying sparse checkout filter
    --sparse-checkout     opposite of --no-sparse-checkout
    --[no-]debug-unpack   debug unpack-trees
    --[no-]recurse-submodules[=<checkout>]
                          control recursive updating of submodules
    -q, --[no-]quiet      suppress feedback messages
```

##### `replay` — EXPERIMENTAL: replay commits on a new base

```text
usage: (EXPERIMENTAL!) git replay ([--contained] --onto <newbase> | --advance <branch>) <revision-range>...

    --[no-]advance <branch>
                          make replay advance given branch
    --[no-]onto <revision>
                          replay onto given commit
    --[no-]contained      advance all branches contained in revision-range
```

##### `symbolic-ref` — Read, modify, and delete symbolic refs

```text
usage: git symbolic-ref [-m <reason>] <name> <ref>
   or: git symbolic-ref [-q] [--short] [--no-recurse] <name>
   or: git symbolic-ref --delete [-q] <name>

    -q, --[no-]quiet      suppress error message for non-symbolic (detached) refs
    -d, --[no-]delete     delete symbolic ref
    --[no-]short          shorten ref output
    --[no-]recurse        recursively dereference (default)
    -m <reason>           reason of the update
```

##### `unpack-objects` — Unpack objects from a packed archive

```text
usage: git unpack-objects [-n] [-q] [-r] [--strict]
```

##### `update-index` — Register file contents in the working tree to the index

```text
usage: git update-index [<options>] [--] [<file>...]

    -q                    continue refresh even when index needs update
    --[no-]ignore-submodules
                          refresh: ignore submodules
    --[no-]add            do not ignore new files
    --[no-]replace        let files replace directories and vice-versa
    --[no-]remove         notice files missing from worktree
    --[no-]unmerged       refresh even if index contains unmerged entries
    --refresh             refresh stat information
    --really-refresh      like --refresh, but ignore assume-unchanged setting
    --cacheinfo <mode>,<object>,<path>
                          add the specified entry to the index
    --chmod (+|-)x        override the executable bit of the listed files
    --assume-unchanged    mark files as "not changing"
    --no-assume-unchanged clear assumed-unchanged bit
    --skip-worktree       mark files as "index-only"
    --no-skip-worktree    clear skip-worktree bit
    --[no-]ignore-skip-worktree-entries
                          do not touch index-only entries
    --[no-]info-only      add to index only; do not add content to object database
    --[no-]force-remove   remove named paths even if present in worktree
    -z                    with --stdin: input lines are terminated by null bytes
    --stdin               read list of paths to be updated from standard input
    --index-info          add entries from standard input to the index
    --unresolve           repopulate stages #2 and #3 for the listed paths
    -g, --again           only update entries that differ from HEAD
    --[no-]ignore-missing ignore files missing from worktree
    --[no-]verbose        report actions to standard output
    --clear-resolve-undo  (for porcelains) forget saved unresolved conflicts
    --[no-]index-version <n>
                          write index in this format
    --[no-]show-index-version
                          report on-disk index format version
    --[no-]split-index    enable or disable split index
    --[no-]untracked-cache
                          enable/disable untracked cache
    --[no-]test-untracked-cache
                          test if the filesystem supports untracked cache
    --[no-]force-untracked-cache
                          enable untracked cache without testing the filesystem
    --[no-]force-write-index
                          write out the index even if is not flagged as changed
    --[no-]fsmonitor      enable or disable file system monitor
    --fsmonitor-valid     mark files as fsmonitor valid
    --no-fsmonitor-valid  clear fsmonitor valid bit
```

##### `update-ref` — Update the object name stored in a ref safely

```text
usage: git update-ref [<options>] -d <refname> [<old-oid>]
   or: git update-ref [<options>]    <refname> <new-oid> [<old-oid>]
   or: git update-ref [<options>] --stdin [-z]

    -m <reason>           reason of the update
    -d                    delete the reference
    --no-deref            update <refname> not the one it points to
    --deref               opposite of --no-deref
    -z                    stdin has NUL-terminated arguments
    --[no-]stdin          read updates from stdin
    --[no-]create-reflog  create a reflog
```

##### `write-tree` — Create a tree object from the current index

```text
usage: git write-tree [--missing-ok] [--prefix=<prefix>/]

    --[no-]missing-ok     allow missing objects
    --[no-]prefix <prefix>/
                          write tree object for a subdirectory <prefix>
```

#### Low-level interrogation commands command details


##### `cat-file` — Provide contents or details of repository objects

```text
usage: git cat-file <type> <object>
   or: git cat-file (-e | -p) <object>
   or: git cat-file (-t | -s) [--allow-unknown-type] <object>
   or: git cat-file (--textconv | --filters)
                    [<rev>:<path|tree-ish> | --path=<path|tree-ish> <rev>]
   or: git cat-file (--batch | --batch-check | --batch-command) [--batch-all-objects]
                    [--buffer] [--follow-symlinks] [--unordered]
                    [--textconv | --filters] [-Z]

Check object existence or emit object contents
    -e                    check if <object> exists
    -p                    pretty-print <object> content

Emit [broken] object attributes
    -t                    show object type (one of 'blob', 'tree', 'commit', 'tag', ...)
    -s                    show object size
    --[no-]allow-unknown-type
                          allow -s and -t to work with broken/corrupt objects
    --[no-]use-mailmap    use mail map file
    --[no-]mailmap        alias of --use-mailmap

Batch objects requested on stdin (or --batch-all-objects)
    --batch[=<format>]    show full <object> or <rev> contents
    --batch-check[=<format>]
                          like --batch, but don't emit <contents>
    -Z                    stdin and stdout is NUL-terminated
    --batch-command[=<format>]
                          read commands from stdin
    --batch-all-objects   with --batch[-check]: ignores stdin, batches all known objects

Change or optimize batch output
    --[no-]buffer         buffer --batch output
    --[no-]follow-symlinks
                          follow in-tree symlinks
    --[no-]unordered      do not order objects before emitting them

Emit object (blob or tree) with conversion or filter (stand-alone, or with batch)
    --textconv            run textconv on object's content
    --filters             run filters on object's content
    --[no-]path blob|tree use a <path> for (--textconv | --filters); Not with 'batch'
```

##### `cherry` — Find commits yet to be applied to upstream

```text
usage: git cherry [-v] [<upstream> [<head> [<limit>]]]

    --[no-]abbrev[=<n>]   use <n> digits to display object names
    -v, --[no-]verbose    be verbose
```

##### `diff-files` — Compare files in the working tree and the index

```text
usage: git diff-files [-q] [-0 | -1 | -2 | -3 | -c | --cc] [<common-diff-options>] [<path>...]

common diff options:
  -z            output diff-raw with lines terminated with NUL.
  -p            output patch format.
  -u            synonym for -p.
  --patch-with-raw
                output both a patch and the diff-raw format.
  --stat        show diffstat instead of patch.
  --numstat     show numeric diffstat instead of patch.
  --patch-with-stat
                output a patch and prepend its diffstat.
  --name-only   show only names of changed files.
  --name-status show names and status of changed files.
  --full-index  show full object name on index lines.
  --abbrev=<n>  abbreviate object names in diff-tree header and diff-raw.
  -R            swap input file pairs.
  -B            detect complete rewrites.
  -M            detect renames.
  -C            detect copies.
  --find-copies-harder
                try unchanged files as candidate for copy detection.
  -l<n>         limit rename attempts up to <n> paths.
  -O<file>      reorder diffs according to the <file>.
  -S<string>    find filepair whose only one side contains the string.
  --pickaxe-all
                show all files diff when -S is used and hit is found.
  -a  --text    treat all files as text.
```

##### `diff-index` — Compare a tree to the working tree or index

```text
usage: git diff-index [-m] [--cached] [--merge-base] [<common-diff-options>] <tree-ish> [<path>...]

common diff options:
  -z            output diff-raw with lines terminated with NUL.
  -p            output patch format.
  -u            synonym for -p.
  --patch-with-raw
                output both a patch and the diff-raw format.
  --stat        show diffstat instead of patch.
  --numstat     show numeric diffstat instead of patch.
  --patch-with-stat
                output a patch and prepend its diffstat.
  --name-only   show only names of changed files.
  --name-status show names and status of changed files.
  --full-index  show full object name on index lines.
  --abbrev=<n>  abbreviate object names in diff-tree header and diff-raw.
  -R            swap input file pairs.
  -B            detect complete rewrites.
  -M            detect renames.
  -C            detect copies.
  --find-copies-harder
                try unchanged files as candidate for copy detection.
  -l<n>         limit rename attempts up to <n> paths.
  -O<file>      reorder diffs according to the <file>.
  -S<string>    find filepair whose only one side contains the string.
  --pickaxe-all
                show all files diff when -S is used and hit is found.
  -a  --text    treat all files as text.
```

##### `diff-pairs` — Compare the content and mode of provided blob pairs

```text
usage: git diff-pairs -z [<diff-options>]

    -z                    read NUL-terminated raw diff input and delimit output batches with NUL
    <diff-options>        diff output options accepted by Git diff machinery

Reads NUL-terminated raw file pairs from stdin, such as output from git diff-tree -z -r --raw, and computes patch-format diffs when stdin closes or between NUL-batch delimiters.
```

##### `diff-tree` — Compare blob content and modes via two tree objects

```text
usage: git diff-tree [--stdin] [-m] [-s] [-v] [--no-commit-id] [--pretty]
              [-t] [-r] [-c | --cc] [--combined-all-paths] [--root] [--merge-base]
              [<common-diff-options>] <tree-ish> [<tree-ish>] [<path>...]

  -r            diff recursively
  -c            show combined diff for merge commits
  --cc          show combined diff for merge commits removing uninteresting hunks
  --combined-all-paths
                show name of file in all parents for combined diffs
  --root        include the initial commit as diff against /dev/null

common diff options:
  -z            output diff-raw with lines terminated with NUL.
  -p            output patch format.
  -u            synonym for -p.
  --patch-with-raw
                output both a patch and the diff-raw format.
  --stat        show diffstat instead of patch.
  --numstat     show numeric diffstat instead of patch.
  --patch-with-stat
                output a patch and prepend its diffstat.
  --name-only   show only names of changed files.
  --name-status show names and status of changed files.
  --full-index  show full object name on index lines.
  --abbrev=<n>  abbreviate object names in diff-tree header and diff-raw.
  -R            swap input file pairs.
  -B            detect complete rewrites.
  -M            detect renames.
  -C            detect copies.
  --find-copies-harder
                try unchanged files as candidate for copy detection.
  -l<n>         limit rename attempts up to <n> paths.
  -O<file>      reorder diffs according to the <file>.
  -S<string>    find filepair whose only one side contains the string.
  --pickaxe-all
                show all files diff when -S is used and hit is found.
  -a  --text    treat all files as text.
```

##### `for-each-ref` — Output information on each ref

```text
usage: git for-each-ref [<options>] [<pattern>]
   or: git for-each-ref [--points-at <object>]
   or: git for-each-ref [--merged [<commit>]] [--no-merged [<commit>]]
   or: git for-each-ref [--contains [<commit>]] [--no-contains [<commit>]]

    -s, --[no-]shell      quote placeholders suitably for shells
    -p, --[no-]perl       quote placeholders suitably for perl
    --[no-]python         quote placeholders suitably for python
    --[no-]tcl            quote placeholders suitably for Tcl
    --[no-]omit-empty     do not output a newline after empty formatted refs

    --[no-]count <n>      show only <n> matched refs
    --[no-]format <format>
                          format to use for the output
    --[no-]color[=<when>] respect format colors
    --[no-]exclude <pattern>
                          exclude refs which match pattern
    --[no-]sort <key>     field name to sort on
    --[no-]points-at <object>
                          print only refs which points at the given object
    --merged <commit>     print only refs that are merged
    --no-merged <commit>  print only refs that are not merged
    --contains <commit>   print only refs which contain the commit
    --no-contains <commit>
                          print only refs which don't contain the commit
    --[no-]ignore-case    sorting and filtering are case insensitive
    --[no-]stdin          read reference patterns from stdin
    --[no-]include-root-refs
                          also include HEAD ref and pseudorefs
```

##### `for-each-repo` — Run a Git command on a list of repositories

```text
usage: git for-each-repo --config=<config> [--] <arguments>

    --[no-]config <config>
                          config key storing a list of repository paths
    --[no-]keep-going     keep going even if command fails in a repository
```

##### `get-tar-commit-id` — Extract commit ID from an archive made by git-archive

```text
usage: git get-tar-commit-id
```

##### `ls-files` — Show information about files in the index and working tree

```text
usage: git ls-files [<options>] [<file>...]

    -z                    separate paths with the NUL character
    -t                    identify the file status with tags
    -v                    use lowercase letters for 'assume unchanged' files
    -f                    use lowercase letters for 'fsmonitor clean' files
    -c, --[no-]cached     show cached files in the output (default)
    -d, --[no-]deleted    show deleted files in the output
    -m, --[no-]modified   show modified files in the output
    -o, --[no-]others     show other files in the output
    -i, --[no-]ignored    show ignored files in the output
    -s, --[no-]stage      show staged contents' object name in the output
    -k, --[no-]killed     show files on the filesystem that need to be removed
    --[no-]directory      show 'other' directories' names only
    --[no-]eol            show line endings of files
    --[no-]empty-directory
                          don't show empty directories
    -u, --[no-]unmerged   show unmerged files in the output
    --[no-]resolve-undo   show resolve-undo information
    -x, --exclude <pattern>
                          skip files matching pattern
    -X, --exclude-from <file>
                          read exclude patterns from <file>
    --[no-]exclude-per-directory <file>
                          read additional per-directory exclude patterns in <file>
    --exclude-standard    add the standard git exclusions
    --full-name           make the output relative to the project top directory
    --[no-]recurse-submodules
                          recurse through submodules
    --[no-]error-unmatch  if any <file> is not in the index, treat this as an error
    --[no-]with-tree <tree-ish>
                          pretend that paths removed since <tree-ish> are still present
    --[no-]abbrev[=<n>]   use <n> digits to display object names
    --[no-]debug          show debugging data
    --[no-]deduplicate    suppress duplicate entries
    --[no-]sparse         show sparse directories in the presence of a sparse index
    --format <format>     format to use for the output
```

##### `ls-remote` — List references in a remote repository

```text
usage: git ls-remote [--branches] [--tags] [--refs] [--upload-pack=<exec>]
                     [-q | --quiet] [--exit-code] [--get-url] [--sort=<key>]
                     [--symref] [<repository> [<patterns>...]]

    -q, --[no-]quiet      do not print remote URL
    --[no-]upload-pack <exec>
                          path of git-upload-pack on the remote host
    -t, --[no-]tags       limit to tags
    -b, --[no-]branches   limit to branches
    --[no-]refs           do not show peeled tags
    --[no-]get-url        take url.<base>.insteadOf into account
    --[no-]sort <key>     field name to sort on
    --[no-]exit-code      exit with exit code 2 if no matching refs are found
    --[no-]symref         show underlying ref in addition to the object pointed by it
    -o, --[no-]server-option <server-specific>
                          option to transmit
```

##### `ls-tree` — List the contents of a tree object

```text
usage: git ls-tree [<options>] <tree-ish> [<path>...]

    -d                    only show trees
    -r                    recurse into subtrees
    -t                    show trees when recursing
    -z                    terminate entries with NUL byte
    -l, --long            include object size
    --name-only           list only filenames
    --name-status         list only filenames
    --object-only         list only objects
    --[no-]full-name      use full path names
    --[no-]full-tree      list entire tree; not just current directory (implies --full-name)
    --format <format>     format to use for the output
    --[no-]abbrev[=<n>]   use <n> digits to display object names
```

##### `merge-base` — Find good common ancestors for a merge

```text
usage: git merge-base [-a | --all] <commit> <commit>...
   or: git merge-base [-a | --all] --octopus <commit>...
   or: git merge-base --is-ancestor <commit> <commit>
   or: git merge-base --independent <commit>...
   or: git merge-base --fork-point <ref> [<commit>]

    -a, --[no-]all        output all common ancestors
    --octopus             find ancestors for a single n-way merge
    --independent         list revs not reachable from others
    --is-ancestor         is the first one ancestor of the other?
    --fork-point          find where <commit> forked from reflog of <ref>
```

##### `name-rev` — Find symbolic names for given revisions

```text
usage: git name-rev [<options>] <commit>...
   or: git name-rev [<options>] --all
   or: git name-rev [<options>] --annotate-stdin

    --[no-]name-only      print only ref-based names (no object names)
    --[no-]tags           only use tags to name the commits
    --[no-]refs <pattern> only use refs matching <pattern>
    --[no-]exclude <pattern>
                          ignore refs matching <pattern>

    --[no-]all            list all commits reachable from all refs
    --[no-]annotate-stdin annotate text from stdin
    --[no-]undefined      allow to print `undefined` names (default)
    --[no-]always         show abbreviated commit object as fallback
```

##### `pack-redundant` — Find redundant pack files

```text
usage: git pack-redundant [--verbose] [--alt-odb] (--all | <pack-filename>...)
```

##### `repo` — EXPERIMENTAL: retrieve repository information

```text
usage: git repo info [--format=(lines|nul) | -z] [--all | <key>...]
   or: git repo info --keys [--format=(lines|nul) | -z]
   or: git repo structure [--format=(table|lines|nul) | -z]

Commands:
    info [--all | <key>...]       print requested repository metadata keys/values
    info --keys                   print supported info keys
    structure                     print repository structure information

Options:
    --format=lines                key=value lines; default for info
    --format=nul                  newline between key/value and NUL after each value; parser-safe
    --format=table                table output; default for structure
    -z                            alias for --format=nul

EXPERIMENTAL. Behavior may change.
```

##### `rev-list` — List commit objects in reverse chronological order

```text
usage: git rev-list [<options>] <commit>... [--] [<path>...]

  limiting output:
    --max-count=<n>
    --max-age=<epoch>
    --min-age=<epoch>
    --sparse
    --no-merges
    --min-parents=<n>
    --no-min-parents
    --max-parents=<n>
    --no-max-parents
    --remove-empty
    --all
    --branches
    --tags
    --remotes
    --stdin
    --exclude-hidden=[fetch|receive|uploadpack]
    --quiet
  ordering output:
    --topo-order
    --date-order
    --reverse
  formatting output:
    --parents
    --children
    --objects | --objects-edge
    --disk-usage[=human]
    --unpacked
    --header | --pretty
    --[no-]object-names
    --abbrev=<n> | --no-abbrev
    --abbrev-commit
    --left-right
    --count
  special purpose:
    --bisect
    --bisect-vars
    --bisect-all
```

##### `rev-parse` — Pick out and massage parameters

```text
usage: git rev-parse --parseopt [<options>] -- [<args>...]
   or: git rev-parse --sq-quote [<arg>...]
   or: git rev-parse [<options>] [<arg>...]

Run "git rev-parse --parseopt -h" for more information on the first usage.
```

##### `show-index` — Show packed archive index

```text
usage: git show-index [--object-format=<hash-algorithm>]

    --[no-]object-format <hash-algorithm>
                          specify the hash algorithm to use
```

##### `show-ref` — List references in a local repository

```text
usage: git show-ref [--head] [-d | --dereference]
                    [-s | --hash[=<n>]] [--abbrev[=<n>]] [--branches] [--tags]
                    [--] [<pattern>...]
   or: git show-ref --verify [-q | --quiet] [-d | --dereference]
                    [-s | --hash[=<n>]] [--abbrev[=<n>]]
                    [--] [<ref>...]
   or: git show-ref --exclude-existing[=<pattern>]
   or: git show-ref --exists <ref>

    --[no-]tags           only show tags (can be combined with --branches)
    --[no-]branches       only show branches (can be combined with --tags)
    --[no-]exists         check for reference existence without resolving
    --[no-]verify         stricter reference checking, requires exact ref path
    --[no-]head           show the HEAD reference, even if it would be filtered out
    -d, --[no-]dereference
                          dereference tags into object IDs
    -s, --[no-]hash[=<n>] only show SHA1 hash using <n> digits
    --[no-]abbrev[=<n>]   use <n> digits to display object names
    -q, --[no-]quiet      do not print results to stdout (useful with --verify)
    --exclude-existing[=<pattern>]
                          show refs from stdin that aren't in local repository
```

##### `unpack-file` — Create a temporary file with a blob's contents

```text
usage: git unpack-file <blob>
```

##### `var` — Show a Git logical variable

```text
usage: git var (-l | <variable>)
```

##### `verify-pack` — Validate packed Git archive files

```text
usage: git verify-pack [-v | --verbose] [-s | --stat-only] [--] <pack>.idx...

    -v, --[no-]verbose    verbose
    -s, --[no-]stat-only  show statistics only
    --[no-]object-format <hash>
                          specify the hash algorithm to use
```

#### Low-level syncing and server-side commands command details


##### `daemon` — Simple server for Git repositories

```text
usage: git daemon [--verbose] [--syslog] [--export-all]
           [--timeout=<n>] [--init-timeout=<n>] [--max-connections=<n>]
           [--strict-paths] [--base-path=<path>] [--base-path-relaxed]
           [--user-path | --user-path=<path>]
           [--interpolated-path=<path>]
           [--reuseaddr] [--pid-file=<file>]
           [--(enable|disable|allow-override|forbid-override)=<service>]
           [--access-hook=<path>]
           [--inetd | [--listen=<host_or_ipaddr>] [--port=<n>]
                      [--detach] [--user=<user> [--group=<group>]]
           [--log-destination=(stderr|syslog|none)]
           [<directory>...]
```

##### `fetch-pack` — Receive missing objects from another repository

```text
usage: git fetch-pack [--all] [--stdin] [--quiet | -q] [--keep | -k] [--thin] [--include-tag] [--upload-pack=<git-upload-pack>] [--depth=<n>] [--no-progress] [--diag-url] [-v] [<host>:]<directory> [<refs>...]
```

##### `http-backend` — Server-side implementation of Git over HTTP

```text
usage: git http-backend

CGI program providing server-side Git over HTTP. Reads CGI environment such as GIT_PROJECT_ROOT, PATH_INFO, REMOTE_USER, REQUEST_METHOD, CONTENT_TYPE, QUERY_STRING, REMOTE_ADDR, HTTP_* headers, and service request bodies. Usually configured behind Apache/nginx/CGI rather than invoked directly.
```

##### `send-pack` — Push objects over Git protocol

```text
usage: git send-pack [--mirror] [--dry-run] [--force]
                     [--receive-pack=<git-receive-pack>]
                     [--verbose] [--thin] [--atomic]
                     [--[no-]signed | --signed=(true|false|if-asked)]
                     [<host>:]<directory> (--all | <ref>...)

    -v, --[no-]verbose    be more verbose
    -q, --[no-]quiet      be more quiet
    --[no-]receive-pack <receive-pack>
                          receive pack program
    --[no-]exec <receive-pack>
                          receive pack program
    --[no-]remote <remote>
                          remote name
    --[no-]all            push all refs
    -n, --[no-]dry-run    dry run
    --[no-]mirror         mirror all refs
    -f, --[no-]force      force updates
    --[no-]signed[=(yes|no|if-asked)]
                          GPG sign the push
    --[no-]push-option <server-specific>
                          option to transmit
    --[no-]progress       force progress reporting
    --[no-]thin           use thin pack
    --[no-]atomic         request atomic transaction on remote side
    --[no-]stateless-rpc  use stateless RPC protocol
    --[no-]stdin          read refs from stdin
    --[no-]helper-status  print status from remote helper
    --[no-]force-with-lease[=<refname>:<expect>]
                          require old value of ref to be at this value
    --[no-]force-if-includes
                          require remote updates to be integrated locally
```

##### `update-server-info` — Update auxiliary info for dumb servers

```text
usage: git update-server-info [-f | --force]

    -f, --[no-]force      update the info files from scratch
```

##### `http-fetch` — Download from a remote Git repository via HTTP

```text
usage: git http-fetch [-c] [-t] [-a] [-d] [-v] [-w <filename>] [--recover]
                      [--stdin | --packfile=<hash> | <commit>] <URL>

    <commit> / commit-id          hash or filename under <URL>/refs/ to pull
    -a, -c, -t                    ignored for historical reasons
    -v                            report downloaded objects
    -w <filename>                 write commit-id under $GIT_DIR/refs/<filename>
    --stdin                       read <commit-id>[TAB<filename-as-in--w>] lines from stdin
    --packfile=<hash>             internal: fetch packfile directly and index it
    --index-pack-args=<args>      internal: pass args to index-pack
    --recover                     recover from a previous interrupted fetch when supported
```

##### `http-push` — Push objects over HTTP/DAV to another repository

```text
usage: git http-push [--all] [--dry-run] [--force] [--verbose] <URL> <ref> [<ref>...]

    --all         verify all objects in entire local ref history exist remotely
    --force       allow remote ref update that is not an ancestor of local ref; can lose commits
    --dry-run     do everything except send updates
    --verbose     report walked/sent objects
    -d, -D        remove <ref> from remote repository, subject to safety checks
    <ref>...      remote refs to update
```

##### `receive-pack` — Receive what is pushed into the repository

```text
usage: git receive-pack <git-dir>

Server-side command invoked by git send-pack to receive pushed updates. Usually not invoked directly by users. Honors receive.* configuration such as receive.denyNonFastForwards.
```

##### `shell` — Restricted login shell for Git-only SSH access

```text
usage: chsh -s $(command -v git-shell) <user>
       git clone <user>@localhost:/path/to/repo.git
       ssh <user>@localhost

Restricted login shell for Git-only SSH access. Accepts only these commands after -c unless ~/git-shell-commands exists:
    git receive-pack <argument>
    git upload-pack <argument>
    git upload-archive <argument>
    cvs server
```

##### `upload-archive` — Send archive back to git-archive

```text
usage: git upload-archive <repository>

Server-side command invoked by git archive --remote to send a generated archive over the Git protocol. Usually not invoked directly.
```

##### `upload-pack` — Send objects packed back to git-fetch-pack

```text
usage: git-upload-pack [--[no-]strict] [--timeout=<n>] [--stateless-rpc]
                      [--advertise-refs] <directory>

    --[no-]strict           do not try <directory>/.git if <directory> is not a Git directory
    --timeout=<n>           interrupt transfer after <n> seconds of inactivity
    --stateless-rpc         single stdin/stdout cycle for HTTP POST processing
    --advertise-refs        advertise refs and capabilities then exit

Server-side command invoked by git fetch-pack; usually not invoked directly.
```

#### Internal helper commands command details


##### `check-attr` — Display gitattributes information

```text
usage: git check-attr [--source <tree-ish>] [-a | --all | <attr>...] [--] <pathname>...
   or: git check-attr --stdin [-z] [--source <tree-ish>] [-a | --all | <attr>...]

    -a, --[no-]all        report all attributes set on file
    --[no-]cached         use .gitattributes only from the index
    --[no-]stdin          read file names from stdin
    -z                    terminate input and output records by a NUL character
    --[no-]source <tree-ish>
                          which tree-ish to check attributes at
```

##### `check-ignore` — Debug gitignore/exclude files

```text
usage: git check-ignore [<options>] <pathname>...
   or: git check-ignore [<options>] --stdin

    -q, --[no-]quiet      suppress progress reporting
    -v, --[no-]verbose    be verbose

    --[no-]stdin          read file names from stdin
    -z                    terminate input and output records by a NUL character
    -n, --[no-]non-matching
                          show non-matching input paths
    --no-index            ignore index when checking
    --index               opposite of --no-index
```

##### `check-mailmap` — Show canonical names and email addresses

```text
usage: git check-mailmap [<options>] <contact>...

    --[no-]stdin          also read contacts from stdin
    --[no-]mailmap-file <file>
                          read additional mailmap entries from file
    --[no-]mailmap-blob <blob>
                          read additional mailmap entries from blob
```

##### `check-ref-format` — Ensure a reference name is well formed

```text
usage: git check-ref-format [--normalize] [<options>] <refname>
   or: git check-ref-format --branch <branchname-shorthand>
```

##### `column` — Display data in columns

```text
usage: git column [<options>]

    --[no-]command <name> lookup config vars
    --[no-]mode[=<style>] layout to use
    --[no-]raw-mode <n>   layout to use
    --[no-]width <n>      maximum width
    --[no-]indent <string>
                          padding space on left border
    --[no-]nl <string>    padding space on right border
    --[no-]padding <n>    padding space between columns
```

##### `fmt-merge-msg` — Produce a merge commit message

```text
usage: git fmt-merge-msg [-m <message>] [--log[=<n>] | --no-log] [--file <file>]

    --[no-]log[=<n>]      populate log with at most <n> entries from shortlog
    -m, --[no-]message <text>
                          use <text> as start of message
    --[no-]into-name <name>
                          use <name> instead of the real target branch
    -F, --[no-]file <file>
                          file to read from
```

##### `hook` — Run Git hooks

```text
usage: git hook run [--ignore-missing] [--to-stdin=<path>] <hook-name> [-- <hook-args>]
```

##### `interpret-trailers` — Add or parse structured commit-message trailers

```text
usage: git interpret-trailers [--in-place] [--trim-empty]
                              [(--trailer (<key>|<key-alias>)[(=|:)<value>])...]
                              [--parse] [<file>...]

    --[no-]in-place       edit files in place
    --[no-]trim-empty     trim empty trailers
    --[no-]where <placement>
                          where to place the new trailer
    --[no-]if-exists <action>
                          action if trailer already exists
    --[no-]if-missing <action>
                          action if trailer is missing
    --[no-]only-trailers  output only the trailers
    --[no-]only-input     do not apply trailer.* configuration variables
    --[no-]unfold         reformat multiline trailer values as single-line values
    --parse               alias for --only-trailers --only-input --unfold
    --no-divider          do not treat "---" as the end of input
    --divider             opposite of --no-divider
    --[no-]trailer <trailer>
                          trailer(s) to add
```

##### `mailinfo` — Extract patch and authorship from one e-mail message

```text
usage: git mailinfo [<options>] <msg> <patch> < mail >info

    -k                    keep subject
    -b                    keep non patch brackets in subject
    -m, --[no-]message-id copy Message-ID to the end of commit message
    -u                    re-code metadata to i18n.commitEncoding
    -n                    disable charset re-coding of metadata
    --encoding <encoding> re-code metadata to this encoding
    --[no-]scissors       use scissors
    --quoted-cr <action>  action when quoted CR is found
```

##### `mailsplit` — Simple UNIX mbox splitter

```text
usage: git mailsplit [-d<prec>] [-f<n>] [-b] [--keep-cr] -o<directory> [(<mbox>|<Maildir>)...]
```

##### `merge-one-file` — Standard helper for git-merge-index

```text
usage: git merge-one-file <orig blob> <our blob> <their blob> <path> <orig mode> <our mode> <their mode>

usage: git merge-one-file <orig blob> <our blob> <their blob> <path> <orig mode> <our mode> <their mode>

Blob ids and modes should be empty for missing files.
```

##### `patch-id` — Compute unique IDs for patches

```text
usage: git patch-id [--stable | --unstable | --verbatim]

    --unstable            use the unstable patch-id algorithm
    --stable              use the stable patch-id algorithm
    --verbatim            don't strip whitespace from the patch
```

##### `sh-i18n` — Git i18n setup code for shell scripts

```text
Shell library, not an end-user command. Provides Git's i18n setup code for shell scripts.
```

##### `sh-setup` — Common Git shell script setup code

```text
Shell library, not an end-user command. Provides common Git shell-script setup helpers.
```

##### `stripspace` — Remove unnecessary whitespace

```text
usage: git stripspace [-s | --strip-comments]
   or: git stripspace [-c | --comment-lines]

    -s, --strip-comments  skip and remove all lines starting with comment character
    -c, --comment-lines   prepend comment character and space to each line
```

#### Additional local command details


##### `fast-export`

```text
usage: git fast-export [<rev-list-opts>]

    --[no-]progress <n>   show progress after <n> objects
    --[no-]signed-tags <mode>
                          select handling of signed tags
    --[no-]tag-of-filtered-object <mode>
                          select handling of tags that tag filtered objects
    --[no-]reencode <mode>
                          select handling of commit messages in an alternate encoding
    --[no-]export-marks <file>
                          dump marks to this file
    --[no-]import-marks <file>
                          import marks from this file
    --[no-]import-marks-if-exists <file>
                          import marks from this file if it exists
    --[no-]fake-missing-tagger
                          fake a tagger when tags lack one
    --[no-]full-tree      output full tree for each commit
    --[no-]use-done-feature
                          use the done feature to terminate the stream
    --no-data             skip output of blob data
    --data                opposite of --no-data
    --[no-]refspec <refspec>
                          apply refspec to exported refs
    --[no-]anonymize      anonymize output
    --anonymize-map <from:to>
                          convert <from> to <to> in anonymized output
    --[no-]reference-excluded-parents
                          reference parents which are not in fast-export stream by object id
    --[no-]show-original-ids
                          show original object ids of blobs/commits
    --[no-]mark-tags      label tags with mark ids
```

##### `annotate`

```text
usage: git annotate [<options>] [<rev-opts>] [<rev>] [--] <file>

    <rev-opts> are documented in git-rev-list(1)

    --[no-]incremental    show blame entries as we find them, incrementally
    -b                    do not show object names of boundary commits (Default: off)
    --[no-]root           do not treat root commits as boundaries (Default: off)
    --[no-]show-stats     show work cost statistics
    --[no-]progress       force progress reporting
    --[no-]score-debug    show output score for blame entries
    -f, --[no-]show-name  show original filename (Default: auto)
    -n, --[no-]show-number
                          show original linenumber (Default: off)
    -p, --[no-]porcelain  show in a format designed for machine consumption
    --[no-]line-porcelain show porcelain format with per-line commit information
    -c                    use the same output mode as git-annotate (Default: off)
    -t                    show raw timestamp (Default: off)
    -l                    show long commit SHA1 (Default: off)
    -s                    suppress author name and timestamp (Default: off)
    -e, --[no-]show-email show author email instead of name (Default: off)
    -w                    ignore whitespace differences
    --[no-]ignore-rev <rev>
                          ignore <rev> when blaming
    --[no-]ignore-revs-file <file>
                          ignore revisions from <file>
    --[no-]color-lines    color redundant metadata from previous line differently
    --[no-]color-by-age   color lines by age
    --[no-]minimal        spend extra cycles to find better match
    -S <file>             use revisions from <file> instead of calling git-rev-list
    --[no-]contents <file>
                          use <file>'s contents as the final image
    -C[<score>]           find line copies within and across files
    -M[<score>]           find line movements within and across files
    -L <range>            process only line range <start>,<end> or function :<funcname>
    --[no-]abbrev[=<n>]   use <n> digits to display object names
```

##### `count-objects`

```text
usage: git count-objects [-v] [-H | --human-readable]

    -v, --[no-]verbose    be verbose
    -H, --[no-]human-readable
                          print sizes in human readable format
```

##### `diagnose`

```text
usage: git diagnose [(-o | --output-directory) <path>] [(-s | --suffix) <format>]
                    [--mode=<mode>]

    -o, --[no-]output-directory <path>
                          specify a destination for the diagnostics archive
    -s, --[no-]suffix <format>
                          specify a strftime format suffix for the filename
    --mode (stats|all)    specify the content of the diagnostic archive
```

##### `gitweb`

```text
(Could not locate authoritative source. Needs hands-on verification.)
```

##### `merge-tree`

```text
usage: git merge-tree [--write-tree] [<options>] <branch1> <branch2>
   or: git merge-tree [--trivial-merge] <base-tree> <branch1> <branch2>

    --write-tree          do a real merge instead of a trivial merge
    --trivial-merge       do a trivial merge only
    --[no-]messages       also show informational/conflict messages
    -z                    separate paths with the NUL character
    --name-only           list filenames without modes/oids/stages
    --allow-unrelated-histories
                          allow merging unrelated histories
    --stdin               perform multiple merges, one per line of input
    --[no-]merge-base <tree-ish>
                          specify a merge-base for the merge
    -X, --[no-]strategy-option <option=value>
                          option for selected merge strategy
```

##### `rerere`

```text
usage: git rerere [clear | forget <pathspec>... | diff | status | remaining | gc]

    --[no-]rerere-autoupdate
                          register clean resolutions in index
```

##### `show-branch`

```text
usage: git show-branch [-a | --all] [-r | --remotes] [--topo-order | --date-order]
                       [--current] [--color[=<when>] | --no-color] [--sparse]
                       [--more=<n> | --list | --independent | --merge-base]
                       [--no-name | --sha1-name] [--topics]
                       [(<rev> | <glob>)...]
   or: git show-branch (-g | --reflog)[=<n>[,<base>]] [--list] [<ref>]

    -a, --[no-]all        show remote-tracking and local branches
    -r, --[no-]remotes    show remote-tracking branches
    --[no-]color[=<when>] color '*!+-' corresponding to the branch
    --[no-]more[=<n>]     show <n> more commits after the common ancestor
    --[no-]list           synonym to more=-1
    --no-name             suppress naming strings
    --name                opposite of --no-name
    --[no-]current        include the current branch
    --[no-]sha1-name      name commits with their object names
    --[no-]merge-base     show possible merge bases
    --[no-]independent    show refs unreachable from any other ref
    --topo-order          show commits in topological order
    --[no-]topics         show only commits not on the first branch
    --[no-]sparse         show merges reachable from only one tip
    --date-order          topologically sort, maintaining date order where possible
    -g, --reflog[=<n>[,<base>]]
                          show <n> most recent ref-log entries starting at base
```

##### `verify-commit`

```text
usage: git verify-commit [-v | --verbose] [--raw] <commit>...

    -v, --[no-]verbose    print commit contents
    --[no-]raw            print raw gpg status output
```

##### `verify-tag`

```text
usage: git verify-tag [-v | --verbose] [--format=<format>] [--raw] <tag>...

    -v, --[no-]verbose    print tag contents
    --[no-]raw            print raw gpg status output
    --[no-]format <format>
                          format to use for the output
```

##### `version`

```text
usage: git version [--build-options]

    --[no-]build-options  also print build options
```

##### `whatchanged`

```text
usage: git log [<options>] [<revision-range>] [[--] <path>...]
   or: git show [<options>] <object>...

    -q, --[no-]quiet      suppress diff output
    --[no-]source         show source
    --[no-]use-mailmap    use mail map file
    --[no-]mailmap        alias of --use-mailmap
    --clear-decorations   clear all previously-defined decoration filters
    --[no-]decorate-refs <pattern>
                          only decorate refs that match <pattern>
    --[no-]decorate-refs-exclude <pattern>
                          do not decorate refs that match <pattern>
    --[no-]decorate[=...] decorate options
    -L <range:file>       trace the evolution of line range <start>,<end> or function :<funcname> in <file>
```

## Setup & auth

Install paths:

| Platform | Command / source |
|---|---|
| Windows | Git for Windows installer from `git-scm.com`, or `winget install --id Git.Git -e --source winget` |
| macOS | `brew install git`; Apple Command Line Tools also provide `/usr/bin/git` via `xcode-select --install` |
| Debian/Ubuntu | `sudo apt update && sudo apt install git` |
| Fedora/RHEL | `sudo dnf install git` |
| Arch | `sudo pacman -S git` |
| SUSE/openSUSE | `sudo zypper install git` |
| Source | Build from the Git source release after installing compiler, gettext, openssl, curl, zlib, expat, and perl dependencies |

Identity setup:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global init.defaultBranch main
```

Credential sources and helpers:

| Auth path | Credential source | Git configuration |
|---|---|---|
| SSH remotes | SSH keypair from `~/.ssh/`, loaded into `ssh-agent`; public key registered with hosting provider | Remote URL like `git@github.com:ORG/REPO.git` |
| HTTPS + token | Personal access token from GitHub/GitLab/Bitbucket/Azure DevOps provider | `credential.helper` stores/retrieves credentials; never put token in URL history |
| Git Credential Manager | OS secure store / browser-based host auth | `git config --global credential.helper manager` or platform installer default |
| macOS keychain | macOS Keychain | `git config --global credential.helper osxkeychain` |
| In-memory cache | Local cache daemon | `git config --global credential.helper 'cache --timeout=3600'` |
| Plaintext store | `~/.git-credentials` | `git config --global credential.helper store`; avoid for shared machines |

State locations:

| State | Path / source |
|---|---|
| Repository metadata | `.git/` for normal repos; repository root for bare repos |
| Local config | `.git/config` |
| Worktree config | `.git/config.worktree` when `extensions.worktreeConfig` is enabled |
| Global config | `~/.gitconfig` and/or `$XDG_CONFIG_HOME/git/config` |
| System config | `/etc/gitconfig` on Unix-like systems; Git for Windows also has installation-level config |
| Objects | `.git/objects/`, packfiles under `.git/objects/pack/` |
| Refs | `.git/refs/`, `.git/packed-refs` |
| Index | `.git/index`; alternate path via `GIT_INDEX_FILE` |
| Hooks | `.git/hooks/`; managed command surface via `git hook run` |
| Ignore files | `.gitignore`, `.git/info/exclude`, global excludes from `core.excludesFile` |
| Attributes | `.gitattributes`, `.git/info/attributes`, global attributes file |
| Submodule metadata | `.gitmodules`, `.git/config`, nested `.git/modules/<name>/` |
| Credentials | OS credential store, helper-specific cache/socket, or `~/.git-credentials` for `credential-store` |

Platform notes:

| Platform | Note |
|---|---|
| Windows | Git for Windows ships Git Bash, OpenSSH, GCM, and Unix-like tools. Watch `core.autocrlf`, `core.filemode=false`, `core.symlinks`, long-path support, and case-insensitive filesystem behavior. |
| macOS | `/usr/bin/git` may be Apple Git. Use Homebrew Git for newer upstream versions. Watch APFS case sensitivity and `credential.helper=osxkeychain`. |
| Linux | Distribution packages may lag upstream. Use distro package for stability; build/source or vendor repo for latest Git. |
| CI/containers | Set `user.name`/`user.email`, avoid interactive credential prompts, and use `GIT_TERMINAL_PROMPT=0` when failing fast is required. |

## Common workflows

Initialize a repository, set identity, and create the first commit:

```bash
git init
git config user.name "Your Name"
git config user.email "you@example.com"
git add .
git commit -m "Initial commit"
```

Creates `.git/`, stages the current tree, and records the first commit on the default branch.

Clone, inspect status, and view history:

```bash
git clone git@example.com:org/repo.git
cd repo
git status --short --branch
git log --oneline --decorate --graph --all -n 20
```

Creates a local working copy, reports branch/worktree state, and shows recent commit graph.

Create a feature branch and publish it upstream:

```bash
git switch -c feature/topic
git add path/to/file
git commit -m "Implement topic"
git push -u origin feature/topic
```

Creates a branch, commits selected changes, and establishes upstream tracking on the remote.

Fetch remote changes and replay local commits:

```bash
git fetch --prune origin
git rebase origin/main
git push --force-with-lease
```

Updates remote-tracking refs, rebases current branch on `origin/main`, and safely updates a rewritten remote branch only if the remote still matches the local expectation.

Resolve a merge conflict:

```bash
git merge feature/topic
git status
git diff --check
git add <resolved-file>
git commit
```

Leaves conflict markers for manual resolution, stages resolved files, and completes the merge commit.

Undo or inspect safely before destructive operations:

```bash
git status --short
git restore --staged <path>
git restore <path>
git reflog --date=iso
git reset --hard <safe-commit>
```

Unstages/restores files or, after checking reflog, moves branch/index/worktree to a known commit.

## Error handling

| Symptom | Likely cause | Fix |
|---|---|---|
| `fatal: not a git repository (or any of the parent directories): .git` | Command ran outside a worktree or bare repository discovery path. | `cd` into the repository, run `git -C <repo> <command>`, or create/clone a repository. |
| `Author identity unknown` / `fatal: unable to auto-detect email address` | `user.name` and/or `user.email` missing in local/global/system config. | Run `git config --global user.name "Your Name"` and `git config --global user.email "you@example.com"`, or set local repo values without `--global`. |
| `error: The following untracked working tree files would be overwritten by checkout:` | Switching branches would overwrite untracked files. | Move/remove the files, commit them on the current branch, or stash including untracked files with `git stash push -u`. |
| `fatal: refusing to merge unrelated histories` | Merge/pull has no common ancestor between histories. | Verify the remote/branch is correct; only for intentional project joins, use `git merge --allow-unrelated-histories <ref>` or `git pull --allow-unrelated-histories`. |
| `CONFLICT (content): Merge conflict in <path>` / `Automatic merge failed; fix conflicts and then commit the result.` | Both sides changed overlapping content. | Edit files to resolve markers, inspect with `git diff`, stage resolved paths with `git add`, then `git commit` or abort with `git merge --abort`. |
| `! [rejected]        <branch> -> <branch> (non-fast-forward)` / `error: failed to push some refs to '...'` | Remote branch contains commits absent locally, or local history was rewritten. | Integrate remote changes with `git pull --rebase` or `git fetch` + `git rebase`; for intended rewrites, use `git push --force-with-lease`. |
| `fatal: 'origin' does not appear to be a git repository` / `fatal: Could not read from remote repository.` | Remote name/URL missing, misspelled, inaccessible, or authentication failed. | Check `git remote -v`, set URL with `git remote set-url origin <url>`, verify SSH/PAT credentials, and confirm repository exists. |
| `fatal: ambiguous argument '<name>': unknown revision or path not in the working tree.` | Argument could be neither resolved as a revision nor path, or revision/path ambiguity exists. | Verify ref with `git show-ref`, fetch missing refs, or separate revisions from paths using `--`. |
| `hint: You have divergent branches and need to specify how to reconcile them.` | `git pull` found divergent local and remote branches without configured merge/rebase policy. | Use `git pull --rebase`, `git pull --no-rebase`, or configure `pull.rebase` / `pull.ff` intentionally. |
| `fatal: detected dubious ownership in repository` | Repository owner differs from current user under Git safe.directory protection. | Confirm path is trusted, then run `git config --global --add safe.directory <repo-path>`; fix filesystem ownership when possible. |

## Traps

_Append-only. Date-stamped. Filled by the operator via the `/lesson` slash command when something bites._

## Lessons

_Append-only. Date-stamped. Filled by the operator via the `/lesson` slash command for behaviors learned that aren't in upstream docs._
