# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-05-09

### Added
- `lapvisor lap <file.vbo> <index> [--track <gates>]` — emits one lap as a
  `lapvisor-lap/v1` JSON bundle: re-based per-sample telemetry (lat/lng/speed,
  cumulative metres, acceleration, gyro when present), sector boundaries as
  in-lap sample indices, and per-lap aggregates (top/min speed, peak G).
  Designed for distance-aligned cross-driver overlays.
- New analyses: `analysis/distance.ts` (Haversine cumulative distance),
  `analysis/aggregates.ts` (per-lap min/max scans), `analysis/lap-detail.ts`
  (slice samples to a lap, attach distance, map sector splits).
- Schema spec at `docs/formats/lapvisor-lap-v1.md`.

## [0.1.0] - 2026-05-08

### Added
- VBO adapter for RaceBox / Racelogic VBOX files (`[header]`, `[comments]`,
  `[laptiming]`, `[column names]`, `[data]`); unknown channels routed into
  `sample.extra`. Reference at `docs/formats/vbo.md`.
- Lap detection from gate crossings: pure `detectLaps(samples, gates, opts?)`
  with local-meter projection, bounded segment-segment intersection,
  sub-sample timestamp interpolation, first-crossing direction lock, and
  sats/velocity/min-lap filters.
- `loadSession` dispatcher (`src/adapters/index.ts`) — reads file, parses by
  extension, runs lap detection so `Session.laps` is populated.
- `laps` subcommand prints venue / started-at / lap-count / best / mean and
  emits structured JSON with meta for agent consumption.
- `track create` (stdin intent → GeoJSON) and JSON session bundle for
  external UIs to render single-session views without lapvisor shipping HTML.
- `.jobdone/` task tracker scaffolding.

## [0.0.2] - 2026-05-07

### Changed
- Dropped RaceChrono references from docs and code paths.

## [0.0.1] - 2026-05-07

### Added
- Initial TypeScript Bun CLI scaffold with `citty`, `zod`, `picocolors`.
- npm publish pipeline: `tsup` bundle, Biome lint/format, GitHub Actions CI
  and tag-driven release workflow.

[0.2.0]: https://github.com/nesterione/lapvisor/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/nesterione/lapvisor/compare/v0.0.2...v0.1.0
[0.0.2]: https://github.com/nesterione/lapvisor/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/nesterione/lapvisor/releases/tag/v0.0.1
