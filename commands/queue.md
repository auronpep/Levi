---
description: "Defer side-tasks to /todo instead of executing (e.g. /queue on, /queue off)"
---

User typed: /queue $ARGUMENTS. Hook updated active flag.

If empty: show state.

If 'on': confirm queue mode. From now on, anything you'd 'also do' or 'check next' gets a /todo add instead of immediate execution. The user stays focused on the main task; /loop picks up the queue later.

If 'off': confirm normal execute mode.
