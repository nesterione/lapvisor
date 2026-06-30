---
description: Use this skill when the user asks how to use the lapvisor CLI — what each subcommand does (laps, session, lap, ideal, compare, improve, track), which one to pick for goals like "where am I losing time?", "compare two laps", or "is my best lap really my best?", what flags and JSON schemas each command emits, and how to drive lapvisor from a script or AI agent.
argument-hint: "[subcommand]"
---

# lapvisor CLI guide

`lapvisor` is a TypeScript SDK + CLI for analyzing race-data files (laps, GPS,
sectors, telemetry) for hobby karting and amateur motorsport. The CLI is a
thin shell over the SDK — its **JSON output is the contract**; the
human-readable (TTY) view is patch-level convenience and not stable across
versions.

This skill maps user goals to the right subcommand, gives a compact reference
for each, and routes to the wire-format docs when the user wants depth.

## Focus

User passed: `$ARGUMENTS`

If `$ARGUMENTS` names a subcommand below (e.g. `compare`, `improve`), lead
with that command's section and skip the goal table. Otherwise present the
full goal→command map.

## Pick the right command for the goal

| If the user is trying to… | Run |
|---|---|
| Summarize a session — count, best lap, mean lap, venue | `lapvisor laps <file>` |
| Get the entire session as one JSON bundle (samples + laps + sectors + gates) | `lapvisor session <file>` |
| Drill into one specific lap (rich telemetry, distance, sectors, peaks) | `lapvisor lap <file> <N>` |
| Answer *"is my best lap really my best?"* / build the **ultimate lap** | `lapvisor ideal <file>` |
| Compare two specific laps (delta-t curve, per-mini-sector deltas, optional per-corner) | `lapvisor compare <file> <refIdx> <candIdx>` |
| Answer *"where am I losing time and what should I do differently?"* — **the headline** | `lapvisor improve <file>` |
| Author a `kart-track/v1` GeoJSON gate file from a structured description | `lapvisor track create -i <intent.json>` -o `<track.json>` |
| Edit a track interactively in a browser | `lapvisor track edit <track.json>` |

When the goal is generic (*"analyze this session"*, *"find time"*), default
to **`lapvisor improve`** — it is the highest-leverage command.

## Per-command reference

All commands take `.vbo` (Racelogic VBOX text) inputs. Other formats
(`.gpx`, `.fit`, `.tcx`, `.lap-csv`) are reserved but not yet implemented.

### `lapvisor laps`

```sh
lapvisor laps <file> [--json]
```

Compact summary: `lapCount`, `bestMs`, `meanMs`, source, format, meta.
**Schema**: an unversioned `LapsSummary` shape (no `schema` field). Use
`lapvisor session` when you need a stable wire format.

### `lapvisor session`

```sh
lapvisor session <file> [--track <track.json>]
```

Full bundle with raw samples, lap boundaries, sector splits, per-lap
summaries, session summary, gates. Always emits JSON (no human render).
**Schema**: `lapvisor-session/v2` — see `docs/formats/lapvisor-session-v2.md`.

### `lapvisor lap`

```sh
lapvisor lap <file> <index> [--track <track.json>] [--json]
```

One lap with rich per-sample telemetry on a distance-along-track axis,
sector boundaries, and per-lap aggregates (top/min speed, peak Gs).
**Schema**: `lapvisor-lap/v1` — see `docs/formats/lapvisor-lap-v1.md`.

### `lapvisor ideal`

```sh
lapvisor ideal <file> [--track <track.json>] [--mini-sectors N] [--json]
```

Best-of-each-mini-sector "ultimate lap" composed across the session, plus
the gap to your actual best lap. Default 100 mini-sectors.
**Schema**: `lapvisor-session-improvement/v1` (without `topOpportunities`).
See `docs/formats/lapvisor-session-improvement-v1.md`.

### `lapvisor compare`

```sh
lapvisor compare <file> <refIdx> <candIdx> [--track <track.json>] [--mini-sectors N] [--corners] [--json]
```

Pairwise lap comparison: continuous delta-t curve + per-mini-sector deltas.
Pass `--corners` to additionally include per-corner deltas (auto-detected
from speed minima on the reference lap).
**Schema**: `lapvisor-lap-compare/v1` — see
`docs/formats/lapvisor-lap-compare-v1.md` and
`docs/analysis/corners.md` for the corner-detection heuristic.

### `lapvisor improve` — headline

```sh
lapvisor improve <file> [--track <track.json>] [--mini-sectors N] [--top N] [--json]
```

Session-level "where to find time" report. Detects corners on the best lap,
finds which lap drove each corner fastest, ranks corners by time-loss, and
attaches `topOpportunities[]` with apex/exit deltas and short plain-text
observations (e.g. *"carry +3.0 km/h through apex"*). `--top` caps the
number of opportunities returned (default 5).
**Schema**: `lapvisor-session-improvement/v1` (with `topOpportunities`).

### `lapvisor track create`

```sh
lapvisor track create [-i <intent.json>] [-o <track.json>] [--no-pretty]
```

Build a `kart-track/v1` GeoJSON gate file from a structured intent
(center + bearing + width per gate). Reads stdin / writes stdout when
flags are omitted. Validated by zod (`kartTrackIntentSchema`).
**Schema**: `kart-track/v1` — see `docs/formats/kart-track-v1.md`.

### `lapvisor track edit`

```sh
lapvisor track edit <track.json> [--port <n>] [--no-open] [--readOnly]
```

Opens a local HTTP browser editor for a `kart-track/v1` file. Default port
5174; set `0` for a free port. Use `--readOnly` to view without saving.

## Output mode rules

- **JSON** when `--json` is passed **or** when stdout is not a TTY (piped,
  redirected, sub-shell, agent invocation). Always machine-readable, with
  a stable `schema` field on every bundle (except `laps`).
- **Human-readable** when stdout is a TTY and `--json` is not set. Coloured
  via picocolors. **Not a stable contract** — wording and formatting can
  change between minor versions.
- **Exit 0** on success, **exit 1** on any error (file missing, parse
  failure, lap index out of range, etc.). Errors go to stderr.

So when driving lapvisor from a script or agent: **just pipe stdout** —
you don't need `--json` because non-TTY already triggers JSON output.

## Driving from an agent

```sh
# 1. Quick lap summary
lapvisor laps session.vbo | jq '.bestMs'

# 2. Full session bundle for a UI / dashboard
lapvisor session session.vbo --track track.json > session.json

# 3. Headline "where can I find time?" report
lapvisor improve session.vbo | jq '.topOpportunities[]'
```

The same JSON can be produced from the SDK programmatically — every CLI
command has a `buildXBundle` counterpart in `lapvisor/bundles`. Useful when
embedding lapvisor inside a larger TypeScript app rather than shelling out.

## Where to look next

- **CLI overview & flag tables**: `docs/cli/overview.md`
- **Wire-format specs** (the JSON contracts):
  - `docs/formats/lapvisor-lap-v1.md`
  - `docs/formats/lapvisor-session-v2.md`
  - `docs/formats/lapvisor-lap-compare-v1.md`
  - `docs/formats/lapvisor-session-improvement-v1.md`
  - `docs/formats/kart-track-v1.md`
  - `docs/formats/vbo.md` (input format)
- **Analysis notes** (heuristics, edge cases):
  - `docs/analysis/laps.md`
  - `docs/analysis/corners.md`
- **SDK quickstart & API reference**: `docs/sdk/quickstart.md` and the
  generated `docs/api/`.
- **Project rules / architecture**: `CLAUDE.md`.
- **Driving from non-Claude AI tools**: `AGENTS.md`.

When the user wants depth on a specific schema, read the matching
`docs/formats/<schema>.md` rather than re-deriving from this skill.
