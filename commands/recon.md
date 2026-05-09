---
description: "Codebase reconnaissance (e.g. /recon for one-shot scan, /recon on for persistent, /recon off)"
---

User typed: /recon $ARGUMENTS. Hook may have updated persistence flag.

If $ARGUMENTS is empty (one-shot): perform reconnaissance of current repo. Read README.md, CLAUDE.md, CONTRIBUTING.md. Identify entry points (package.json scripts, Makefile, main files). Map top-level directory structure to depth 2. Identify language, framework, test runner, linter, CI system. Surface conventions and gotchas. Output structured recon report following skills/recon/README.md format. Recommend 1-3 concrete next steps.

If $ARGUMENTS is 'on': enable persistent mode — SessionStart hook will run recon at start of every session in this directory.

If $ARGUMENTS is 'off': disable persistent mode.
