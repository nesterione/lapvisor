# `lapvisor-session/v2`

JSON bundle emitted by `lapvisor session <file.vbo> [--track <gates>]`.
Designed for downstream UIs that need both a full-session map bundle and
precomputed lap-level summary data.

## Schema

```json
{
  "schema": "lapvisor-session/v2",
  "source": { "file": "<path>.vbo", "format": "vbo" },
  "meta": {
    "trackName": "Plytinės summer",
    "venue": "Plytines",
    "startedAt": "2026-05-05T16:48:00.000Z"
  },
  "samples": [
    { "lat": 54.7253107, "lng": 25.3492518, "v": 53.7 }
  ],
  "laps": [
    { "index": 2, "durationMs": 45381, "firstSampleIndex": 420, "lastSampleIndex": 903 }
  ],
  "sectorSplits": [
    {
      "lapIndex": 2,
      "splits": [{ "sectorIndex": 0, "label": "S1", "offsetMs": 6480 }]
    }
  ],
  "lapSummaries": [
    {
      "index": 2,
      "durationMs": 45381,
      "startTimestampMs": 1777999776407,
      "distanceM": 870.4,
      "sectors": [
        { "sectorIndex": 0, "label": "S1", "offsetMs": 6480, "durationMs": 6480, "distanceM": 154.2 },
        { "sectorIndex": 1, "label": "Finish", "offsetMs": 45381, "durationMs": 38901, "distanceM": 870.4 }
      ],
      "aggregates": {
        "topSpeedKmh": 71.4,
        "minSpeedKmh": 28.0,
        "peakLatG": 1.31,
        "peakLongGBrake": 1.05,
        "peakLongGAccel": 0.42
      }
    }
  ],
  "sessionSummary": {
    "bestLapMs": 45381,
    "bestLapIndex": 2,
    "bestSectors": [
      { "sectorIndex": 0, "label": "S1", "durationMs": 6480, "lapIndex": 2 }
    ],
    "theoreticalBestMs": 45381,
    "sectorCount": 2
  },
  "gates": [
    {
      "kind": "start_finish",
      "name": "S/F",
      "pointA": [25.3493, 54.7253],
      "pointB": [25.3494, 54.7252]
    }
  ]
}
```

## Notes

- `samples`, `laps`, `sectorSplits`, and `gates` keep the existing session-view
  bundle semantics for map UIs.
- `lapSummaries[]` is the compact analysis-oriented layer for per-lap tables.
- `lapSummaries[].sectors[]` expresses sector **segments**, not just gate
  crossings. When split gates exist, the final segment to the finish line is
  appended with label `"Finish"`.
- `sessionSummary.bestSectors[]` is computed by sector position across laps.
- `sessionSummary.theoreticalBestMs` is omitted when there are no sector
  segments in the session.
