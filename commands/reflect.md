---
description: "Run post-work reflection (e.g. /reflect lesson, /reflect missed, /reflect off, or /reflect alone to list)"
---

User typed: /reflect $ARGUMENTS. The hook has updated the active reflect kind (for persistent mode) or this is being treated as a one-shot.

If $ARGUMENTS is empty: list available reflection kinds by reading skills/reflect/*/SKILL.md (skip README). Show name + description.

If $ARGUMENTS is 'off': confirm persistent reflect mode disabled.

If $ARGUMENTS is '<kind> on': confirm persistent mode active. End-of-session Stop hook will run this reflection automatically.

Otherwise ($ARGUMENTS is a kind): run the named reflection ONE-SHOT now. Read skills/reflect/$ARGUMENTS/SKILL.md and produce the analysis described there. Output is printed in conversation. If active /dossier is set and the kind is 'lesson', also append the lesson to the dossier.
