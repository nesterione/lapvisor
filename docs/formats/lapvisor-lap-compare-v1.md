# `lapvisor-lap-compare/v1`

JSON bundle emitted by `lapvisor compare <file.vbo> <refIdx> <candIdx> [--track <gates>] [--mini-sectors N] [--json]`.
Pairwise comparison of two laps from the same session: where the candidate
gained or lost time vs the reference, expressed both as a continuous delta-t
curve and as per-mini-sector deltas.

The bundle is the contract. The human-readable view from `lapvisor compare` is
not.

## Schema

```json
{
  "schema": "lapvisor-lap-compare/v1",
  "source": { "file": "<path>.vbo", "format": "vbo" },
  "meta": {
    "trackName": "Plytinės summer",
    "venue": "Plytines",
    "startedAt": "2026-05-05T16:48:00.000Z"
  },
  "reference": { "index": 4, "durationMs": 62345, "distanceM": 870.4 },
  "candidate": { "index": 7, "durationMs": 62579, "distanceM": 871.2 },
  "totalDeltaMs": 234,
  "miniSectorCount": 100,
  "miniSectors": [
    { "index": 0, "dStart": 0.0, "dEnd": 8.7,
      "refMs": 615, "candMs": 622, "deltaMs": 7 },
    "..."
  ],
  "deltaT": {
    "count": 200,
    "dGrid": [0.0, 4.4, 8.7, "..."],
    "deltaTMs": [0, 1, 4, "..."],
    "maxDistanceM": 870.4,
    "coverage": 1
  }
}
```

## Fields

### Top level

| Field | Type | Notes |
| --- | --- | --- |
| `schema` | string | Always `"lapvisor-lap-compare/v1"`. |
| `source.file` | string | Echoes the input path. |
| `source.format` | `"vbo"` | Only `.vbo` supported in v1. |
| `meta.*` | object | Track name, venue, start timestamp (same shape as other bundles). |
| `reference` | object | The baseline lap (`{ index, durationMs, distanceM }`). |
| `candidate` | object | The lap being compared (`{ index, durationMs, distanceM }`). |
| `totalDeltaMs` | number | `candidate.durationMs - reference.durationMs`. Positive ⇒ candidate slower over its full lap. |
| `miniSectorCount` | number | Bin count actually used (default 100). |
| `miniSectors` | array | Per-mini-sector deltas — the ranked-loss view. |
| `deltaT` | object | Per-distance delta-t curve — the continuous view. |

### `miniSectors[i]`

| Field | Type | Notes |
| --- | --- | --- |
| `index` | number | 0-based mini-sector index. |
| `dStart` / `dEnd` | number | Distance window on the **reference** lap, in metres (rounded to 0.1). |
| `refMs` | number | Reference lap's duration through this mini-sector, integer ms. |
| `candMs` | number | Candidate lap's duration through this mini-sector, integer ms. |
| `deltaMs` | number | `candMs - refMs`. Negative ⇒ candidate ahead in this bin. |

Sum of `deltaMs` across all mini-sectors equals `totalDeltaMs` to within rounding (each
entry is rounded to integer ms).

### `deltaT`

| Field | Type | Notes |
| --- | --- | --- |
| `count` | number | Grid resolution (default 200). |
| `dGrid` | number[] | Distance values (m), evenly spaced from 0 to `maxDistanceM`. Rounded to 0.1. |
| `deltaTMs` | number[] | candidate.t − reference.t at each grid distance, integer ms. |
| `maxDistanceM` | number | End of the shared overlap window — `min(reference.distanceM, candidate.distanceM)`. |
| `coverage` | number | Shared overlap as a fraction of the longer lap. `1` ⇒ same length. |

### `corners[i]` (optional)

Present only when corner detection was requested at build time
(`buildLapComparisonBundle({ includeCorners: true })`, or `lapvisor compare
--corners`). When absent, the field is omitted entirely — `v1` consumers that
don't know about corners are unaffected.

| Field | Type | Notes |
| --- | --- | --- |
| `index` | number | 1-based corner index in detection order along the reference lap. |
| `dEntry` / `dApex` / `dExit` | number | Distance window of the corner on the **reference** lap, in metres (rounded to 0.1). |
| `refMs` | number | Time taken between entry and exit on the reference lap, integer ms. |
| `candMs` | number | Time taken between proportional entry/exit positions on the candidate lap, integer ms. |
| `deltaMs` | number | `candMs - refMs`. Negative ⇒ candidate quicker through this corner. |
| `refMinKmh` | number | Reference lap apex speed, km/h (rounded to 0.1). |
| `candMinKmh` | number | Candidate lap minimum speed in the proportional corner region, km/h. |
| `deltaMinKmh` | number | `candMinKmh - refMinKmh`. Positive ⇒ more apex speed on candidate. |

Corner detection heuristic: see `docs/analysis/corners.md`.

## Versioning

`v1` carries delta-t + per-mini-sector deltas. Optional `corners[]` was added
in a minor evolution and is omitted by default to keep the default bundle
small. Future minor evolutions may add further optional fields without
breaking v1 consumers. A breaking schema change ships as `v2` per the
bundle-version workflow in `docs/extending/bundle-version.md`.
