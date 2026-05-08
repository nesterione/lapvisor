# 0001 — Track format

**Status:** accepted (2026-05-08); coord-scale erratum 2026-05-08 (see Errata);
migrated from `karting` to `lapvisor` 2026-05-08.
**Scope:** `lapvisor track create` and downstream consumers (`lapvisor session`,
`lapvisor track edit`, future lap-trace overlays). RaceChrono-specific bits
referenced below now live in the `karting` repo's `kart track convert` —
the converter parses `.rcz` and pipes a structured intent to
`lapvisor track create`, which builds the GeoJSON.

## Context

We need a track representation we control — RaceChrono `.rcz` is fine as
an input but its scaling (degrees × 6,000,000, milli-degrees, millimetres)
and opaque integer `type` codes are awkward to work with directly. The
first real consumer will be a future renderer that overlays lap traces
on gates, so geometry needs to be inspectable in standard tooling without
custom decoders.

## Decision

1. **Output is GeoJSON `FeatureCollection`** — schema tag
   `"kart-track/v1"` in top-level `properties`. See
   [`formats/kart-track-v1.md`](../formats/kart-track-v1.md).
2. **Each trap is a `LineString`** of the two gate endpoints, computed
   from `(centre, bearing, width)` via Haversine destination.
3. **Coordinates are decimal degrees `[lon, lat]`, units are metres /
   degrees** in `properties` — no scaling factors leak out of the
   converter.
4. **Original RaceChrono fields preserved verbatim** in
   `properties` (`bearing_deg`, `width_m`, `unidirectional`, `center`,
   `kind`, plus `raw_type` for unknown trap types). Reverse conversion
   stays cheap.
5. **Coordinates are rounded to 7 decimal places** — matches RaceChrono's
   native precision (≈11 mm) and keeps file diffs clean.

## Why GeoJSON over a custom flat JSON

- Drops straight into geojson.io, QGIS, Leaflet, Mapbox — instant visual
  verification ("did the conversion produce a recognisable track?").
- Standard tooling handles iteration, bbox, simplification etc. for free.
- Cost is one extra layer of nesting in JSON. Cheap.

## Why LineString gates over `Point + bearing/width` metadata

A trap **is** a line crossing — the gate is the geometry. Encoding it as
the actual line means a viewer renders it correctly with no custom code.
We still keep `bearing_deg`, `width_m`, and `center` in `properties` for
round-tripping; the line is derivable but pre-computing it is what makes
the file useful to non-domain tools.

## Why Haversine, not Vincenty / WGS-84 ellipsoid

Gate half-widths are 5–10 m. Haversine error at this scale is well below
0.1 m (≪ GPS noise). Vincenty would buy nothing and adds iterative
math.

## Why coord-faithful (no re-georeferencing in the converter)

The converter preserves whatever the source contains, byte-faithful
modulo the documented scale conversion. We do not "snap" coordinates
to a published venue location, even when one exists. If a source file
is misaligned (e.g. hand-placed in the RaceChrono editor without
GPS reference), fixing it is a separate one-shot operation — either
in the RaceChrono editor or in `lapvisor track edit` — not something
the converter should silently do. Mixing the two would corrupt files
where the original placement was intentional.

## Why a `track` parent command, not a flat `track-create`

We expect siblings: `lapvisor track inspect`, `lapvisor track render`.
Nesting keeps root help clean and groups related ops. citty supports it
natively via `subCommands` on a parent `defineCommand`.

## Why stdin/stdout for `track create`

`lapvisor track create` reads its intent JSON from stdin (or `--input`)
and writes GeoJSON to stdout (or `--out`). That makes it composable:
upstream tools (e.g. `kart track convert` parsing `.rcz`) pipe in an
intent and capture the output, no intermediate files needed. It also
keeps lapvisor free of source-format parsing — Haversine endpoint math
is the only thing on this side of the wire.

## Consequences

- Schema is committed: bumping to `kart-track/v2` requires a new spec
  file and migration notes here. Additive optional properties stay on
  v1.
- Future commands can rely on `properties.schema === "kart-track/v1"`
  for input validation.

## Errata

### 2026-05-08 — RaceChrono coord scale corrected from 10⁷ to 6,000,000

The first cut of this ADR (and the source code) divided RaceChrono
trap coordinates by `1e7`, which produced shape-correct gates in the
**wrong place** (Mediterranean off Libya for the Plytinės sample). The
empirically correct scale is **6,000,000** — verified by
round-tripping `track_of_plytines_ihar_2026.rcz` and matching the S/F
to the published Plytinės Kartodromas marker (`54.72499°N, 25.34911°E`,
~36 m delta).

`360 × 6,000,000 = 2.16 × 10⁹` fits comfortably in signed int32,
which is presumably why the RaceChrono author picked it. With `× 10⁷`,
longitudes past ~214° would overflow.

Spec for the `.rcz` input format lives in the `karting` repo
(`docs/formats/racechrono-rcz.md`); the fix lives in
`karting/src/track/racechrono.ts` (`RC_LATLON_SCALE`).
