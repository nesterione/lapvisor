# CLI Overview

`lapvisor` is the command-line client for the lapvisor SDK. Humans run it interactively; AI agents drive it as a JSON-emitting subprocess.

## Install

```sh
npm install -g lapvisor
# or run on demand:
npx lapvisor --help
```

Requires Node.js 22+. End users do not need Bun.

## Commands

| Command | Purpose |
| --- | --- |
| `lapvisor laps <file>` | Summarize lap times from a session file (count, best, mean, venue). |
| `lapvisor session <file> [--track <track.json>]` | Emit a complete render bundle (samples + laps + sectors + gates) as `lapvisor-session/v2` JSON. |
| `lapvisor lap <file> <index> [--track <track.json>] [--json]` | Emit one lap as `lapvisor-lap/v1` JSON (rich telemetry + distance + sectors + per-lap aggregates). |
| `lapvisor track create [-i <intent.json>] [-o <track.json>] [--pretty]` | Build a `kart-track/v1` GeoJSON track from a structured gate description. |
| `lapvisor track edit <track.json> [--port <n>] [--readOnly]` | Open a local browser editor for a `kart-track/v1` file. |

Run `lapvisor <subcommand> --help` for the full per-command flag list.

## Output mode

Each subcommand emits one of two output styles:

- **JSON** when `--json` is passed, or when stdout is not a TTY (piped output, agent invocation). Always machine-readable, schema-stamped.
- **Human-readable** when stdout is a TTY and `--json` is not set. Coloured, summarised. **Not a stable contract** — changes to formatting are patch-level.

For agents: prefer to invoke the CLI with stdout redirected (e.g. `lapvisor session foo.vbo > out.json`) and parse the JSON. The schema field (`lapvisor-session/v2`, `lapvisor-lap/v1`, `kart-track/v1`) lets you pin to a specific wire format.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success. JSON or human output written to stdout. |
| `1` | Runtime error — file not found, parse failure, schema mismatch, lap index out of range, etc. Error message goes to stderr. |

Errors are not yet structured under `--json` — that is planned for a future bundle version.

## Wire formats

The CLI is the canonical reference implementation of the bundle formats. The same JSON can be produced from the SDK:

- `lapvisor session …` ↔ `buildSessionBundle` (`lapvisor/bundles`)
- `lapvisor lap …` ↔ `buildLapBundle` (`lapvisor/bundles`)
- `lapvisor track create …` ↔ `buildKartTrack` (`lapvisor/track`)

Format specs live in [`../formats/`](../formats/).

## Driving from an agent

```sh
# 1. Get a quick lap summary (JSON-only when piped)
lapvisor laps session.vbo | jq '.bestMs'

# 2. Get the full session bundle for a UI / dashboard / analysis
lapvisor session session.vbo --track track.json > session.json

# 3. Get one lap's telemetry for cross-driver comparison
lapvisor lap session.vbo 3 > lap-3.json
```

Stable across versions: the `schema` field, named JSON fields, exit codes. Unstable: human (TTY) output, human error messages.
