# `lapvisor-session-improvement/v1`

JSON bundle emitted by `lapvisor ideal <file.vbo> [--track <gates>] [--mini-sectors N] [--json]`.
Session-level "where can I find time?" payload — best lap reference plus an
ideal lap composed from the fastest mini-sector at each position across the
session.

The bundle is the contract. The human-readable view from `lapvisor ideal` is
not.

## Schema

```json
{
  "schema": "lapvisor-session-improvement/v1",
  "source": { "file": "<path>.vbo", "format": "vbo" },
  "meta": {
    "trackName": "Plytinės summer",
    "venue": "Plytines",
    "startedAt": "2026-05-05T16:48:00.000Z"
  },
  "lapCount": 12,
  "bestLap": {
    "index": 4,
    "durationMs": 62345,
    "distanceM": 870.4
  },
  "idealLap": {
    "totalMs": 61830,
    "miniSectorCount": 100,
    "miniSectors": [
      { "index": 0, "sourceLapIndex": 4, "durationMs": 615,
        "dStart": 0.0, "dEnd": 8.7, "bestLapDurationMs": 615 },
      "..."
    ]
  },
  "gapToIdealMs": 515
}
```

## Fields

### Top level

| Field | Type | Notes |
| --- | --- | --- |
| `schema` | string | Always `"lapvisor-session-improvement/v1"`. |
| `source.file` | string | Echoes the input path. |
| `source.format` | `"vbo"` | Only `.vbo` supported in v1. |
| `meta.trackName` | string \| null | From `--track`; null when no track override was used. |
| `meta.venue` | string? | From the `.vbo` `Venue :` comment. |
| `meta.startedAt` | string? | ISO-8601 UTC, only when the source carries a date. |
| `lapCount` | number | Number of detected laps used to compose the ideal lap. |
| `bestLap` | object | The fastest single lap in the session (see below). |
| `idealLap` | object | The composed best-of-each-mini-sector lap (see below). |
| `gapToIdealMs` | number | `bestLap.durationMs - idealLap.totalMs`. Always >= 0. |

### `bestLap`

| Field | Type | Notes |
| --- | --- | --- |
| `index` | number | 1-based lap index of the best lap. |
| `durationMs` | number | Best-lap duration. |
| `distanceM` | number | Best-lap total distance, rounded to 0.1 m. |

### `idealLap`

| Field | Type | Notes |
| --- | --- | --- |
| `totalMs` | number | Sum of `miniSectors[].durationMs`. |
| `miniSectorCount` | number | `count` parameter actually used (default 100). |
| `miniSectors` | array | One entry per mini-sector. |

### `idealLap.miniSectors[i]`

| Field | Type | Notes |
| --- | --- | --- |
| `index` | number | 0-based mini-sector index (proportional position 0..count-1). |
| `sourceLapIndex` | number | 1-based lap that owned the fastest split at this position. |
| `durationMs` | number | Best per-lap duration through this mini-sector. |
| `dStart` | number | Distance at start of this mini-sector on the **best lap**, in metres (rounded to 0.1). |
| `dEnd` | number | Distance at end on the **best lap**, in metres (rounded to 0.1). |
| `bestLapDurationMs` | number | Best lap's own time through this mini-sector. `bestLapDurationMs - durationMs` is the per-bin gain available. |

### `topOpportunities[i]` (optional)

Present only when produced by `lapvisor improve` (or via
`buildSessionImprovementBundle({ includeOpportunities: true })`). Omitted by
default from `lapvisor ideal` to keep that bundle small. `v1` consumers that
ignore unknown fields are unaffected.

| Field | Type | Notes |
| --- | --- | --- |
| `cornerIndex` | number | 1-based corner index in detection order along the best lap. |
| `dEntry` / `dApex` / `dExit` | number | Distance window of the corner on the best lap, in metres (rounded to 0.1). |
| `deltaMs` | number | Time-loss vs the lap that drove this corner fastest, integer ms. Always > 0. |
| `fastestLapIndex` | number | 1-based lap that drove this corner fastest. |
| `bestApexKmh` | number | Best lap's apex speed (rounded to 0.1). |
| `fastestApexKmh` | number | Fastest-corner lap's minimum speed in the proportional region (rounded to 0.1). |
| `bestExitKmh` | number | Best lap's velocity at corner exit (rounded to 0.1). |
| `fastestExitKmh` | number | Fastest-corner lap's velocity at the proportional exit position (rounded to 0.1). |
| `observations` | string[] | 1-2 plain-text observations derived from the deltas (e.g. "carry +3 km/h through apex", "earlier throttle — exit +2 km/h"). |

Observations are deterministic: same numbers in, same strings out. They are
useful for direct CLI rendering and for AI-agent consumption. Treat the
string set as patch-level — wording may change in future minor evolutions.

Corner detection heuristic: see `docs/analysis/corners.md`.

## Versioning

`v1` carries best lap + ideal lap. Optional `topOpportunities[]` was added in
a minor evolution and is omitted by default. Future minor evolutions may add
further optional fields without breaking v1 consumers. A breaking schema
change ships as `v2` per the bundle-version workflow in
`docs/extending/bundle-version.md`.

## Mini-sector positioning

Mini-sectors are **proportional** — mini-sector `i` covers `[i/count *
lapDistance, (i+1)/count * lapDistance]` on each lap's *own* total distance.
This makes mini-sector `i` correspond to "the same point on track" across
laps even when the driven racing line changed slightly. The `dStart`/`dEnd`
fields in the bundle reference the **best lap's** distance for renderability.
