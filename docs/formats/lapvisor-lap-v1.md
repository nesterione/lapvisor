# `lapvisor-lap/v1`

JSON bundle emitted by `lapvisor lap <file.vbo> <lap-index> [--track <gates>] [--json]`.
A single lap with rich per-sample telemetry on a distance-along-track axis,
plus sector boundaries and per-lap aggregates. Designed for distance-aligned
overlay of two or more laps in downstream UIs (`kart compare`).

## Schema

```json
{
  "schema": "lapvisor-lap/v1",
  "source": { "file": "<path>.vbo", "format": "vbo" },
  "meta": {
    "trackName": "Plytinės summer",
    "venue": "Plytines",
    "startedAt": "2026-05-05T16:48:00.000Z"
  },
  "lap": {
    "index": 2,
    "durationMs": 45381,
    "startTimestampMs": 1777999776407,
    "distanceM": 870.4
  },
  "samples": [
    { "t": 0, "lat": 54.7253107, "lng": 25.3492518, "v": 53.7, "d": 0,
      "heading": 327.6, "longG": -0.641, "latG": 0.858, "vertG": 1.204,
      "gyroX": 23, "gyroY": 19.2, "gyroZ": -42.2 },
    "..."
  ],
  "sectors": [
    { "sectorIndex": 0, "label": "S1", "sampleIndex": 162, "offsetMs": 6480, "distanceM": 154.2 }
  ],
  "aggregates": {
    "topSpeedKmh": 71.4,
    "minSpeedKmh": 28.0,
    "peakLatG": 1.31,
    "peakLongGBrake": 1.05,
    "peakLongGAccel": 0.42
  },
  "gates": [
    { "kind": "start_finish", "name": "S/F",
      "pointA": [25.3493, 54.7253], "pointB": [25.3494, 54.7252] }
  ]
}
```

## Fields

### Top level

| Field | Type | Notes |
| --- | --- | --- |
| `schema` | string | Always `"lapvisor-lap/v1"`. |
| `source.file` | string | Echoes the input path. |
| `source.format` | `"vbo"` | Only `.vbo` supported in v1. |
| `meta.trackName` | string \| null | Authored track name when `--track` was passed. |
| `meta.venue` | string? | From the `.vbo` header (`Venue :` or `name`). |
| `meta.startedAt` | string? | ISO-8601 UTC, only when the source carries a date. |
| `lap` | object | The selected lap (see below). |
| `samples` | array | Per-sample rich telemetry, re-indexed from t=0 (see below). |
| `sectors` | array | Sector boundaries inside this lap (see below). |
| `aggregates` | object | Scalar lap stats (see below). |
| `gates` | array | All gates considered for lap detection / sector splits. |

### `lap`

| Field | Type | Notes |
| --- | --- | --- |
| `index` | number | 1-based, matches `lapvisor laps`. |
| `durationMs` | number | Sub-sample-interpolated. |
| `startTimestampMs` | number? | Absolute UTC epoch ms; only when source has a date. |
| `distanceM` | number | Sum of inter-sample Haversine distances. Excludes the partial segment before the first in-lap sample and after the last; for 10–25 Hz GPS this is a sub-metre underestimate. |

### `samples[]`

Re-indexed within the lap (no boundary samples from the previous/next lap).

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `t` | number | yes | ms since lap start (0 at first in-lap sample). |
| `lat` | number | yes | degrees, 7-decimal precision. |
| `lng` | number | yes | degrees, 7-decimal precision. |
| `v` | number | yes | km/h, 1-decimal precision. |
| `d` | number | yes | cumulative metres from `samples[0]`. |
| `heading` | number? | when finite | degrees, 0–360 true. |
| `longG` | number? | when present | body-frame longitudinal acceleration in g (negative = braking). |
| `latG` | number? | when present | body-frame lateral acceleration in g. |
| `vertG` | number? | RaceBox only | body-frame vertical acceleration in g. |
| `gyroX,Y,Z` | number? | RaceBox only | rotation rates in deg/s. |

Optional fields are **omitted** when the channel is absent in the source
format. Consumers must treat absence and zero as different.

### `sectors[]`

| Field | Type | Notes |
| --- | --- | --- |
| `sectorIndex` | number | Index into the input sector-gate array (stable across laps). |
| `label` | string | From the gate label (`Split` line in `.vbo` after `¬`). |
| `sampleIndex` | number | First sample in `samples[]` at or after the gate crossing. |
| `offsetMs` | number | ms since lap start. |
| `distanceM` | number | Cumulative distance at `sampleIndex`. |

### `aggregates`

Scalars from a single pass over the lap's samples. G channels report
**positive magnitudes** (e.g. `peakLongGBrake: 1.05` means a 1.05 g
deceleration). Channels absent in the source produce `0` here.

## Invariants

- `samples[0].t === 0` and `samples[0].d === 0`.
- `samples` is non-empty for any lap returned by `detectLaps`.
- `samples[i].t` is non-decreasing in `i`. So is `samples[i].d`.
- `sectors[].sampleIndex` is in `[0, samples.length)`.
- `lap.distanceM === samples[last].d` (within rounding).

## Generation

```sh
lapvisor lap session.vbo 5
lapvisor lap session.vbo 5 --track plytines/summer.track.json
lapvisor lap session.vbo 5 --json   # force JSON when stdout is a TTY
```

Without `--json` and a TTY stdout, prints a one-screen human summary
(track, distance, peaks). Pipe redirection or `--json` selects JSON output.
