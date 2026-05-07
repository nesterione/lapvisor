---
title: Add session viewer subcommand
priority: medium
created: 07.05.2026
position: 0
---
Users and AI agents need a quick way to inspect a session file (laps, totals, basic stats) without writing analysis code by hand.

## Acceptance Criteria

- [ ] New `view` subcommand accepts a session file path
- [ ] Auto-detects format via existing adapters (GPX/FIT/TCX/CSV)
- [ ] Human-readable default output: lap count, total time, fastest lap, per-lap times
- [ ] `--json` flag emits a machine-readable session summary