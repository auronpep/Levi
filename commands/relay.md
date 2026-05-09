---
description: "Cross-PC notification (e.g. /relay PC2 \\\"message\\\", /relay broadcast \\\"...\\\", /relay PC2 --task=<id>)"
---

User typed: /relay $ARGUMENTS.

If empty: list recent relays from ~/.relay/outbox/ (override REUBEN_RELAY_DIR).

If 'broadcast <message>': write a relay JSON file with type=broadcast, body=<message>.

If '<pc-name> <message>': write file with to_pc=<pc-name>, type=notice.

If '<pc-name> --task=<id>': write file with type=task-handoff, ref_todo_id=<id>. Also update the /todo's handoff.to field to <pc-name>.

File shape per skills/relay/README.md. Include from_pc=$REUBEN_PC_NAME (or hostname), at=ISO timestamp, id=rl-<timestamp>-<hash>.
