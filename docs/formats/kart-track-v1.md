# `kart-track/v1` format

The track format owned by lapvisor. Produced by `lapvisor track create`
(and edited via `lapvisor track edit`); consumed by `lapvisor session`
and downstream UIs (e.g. the `karting` repo's `kart view` reads it
to overlay gates on a session). The `karting` repo's `kart track convert`
parses RaceChrono `.rcz` and pipes intent JSON into `lapvisor track create`
to produce these files.

A standard GeoJSON `FeatureCollection` with track metadata in
`properties` and one `Feature` per trap (gate) in `features`.

Why GeoJSON: drag-and-drop into [geojson.io](https://geojson.io), QGIS, or
Leaflet renders the gates correctly without custom code. Coordinates are
plain decimal degrees (`[lon, lat]`) — no scaling factors leak out.

## Top level

```jsonc
{
  "type": "FeatureCollection",
  "name": "of Plytines ihar 2026",
  "properties": {
    "schema": "kart-track/v1",
    "source": { "format": "racechrono", "file": "track_of_plytines_ihar_2026.rcz" },
    "center": [15.209979, 32.8353055]   // [lon, lat]
  },
  "features": [ /* one per trap, in input order */ ]
}
```

| Field                  | Notes                                                                       |
|------------------------|-----------------------------------------------------------------------------|
| `type`                 | Always `"FeatureCollection"`.                                                |
| `name`                 | Track name, copied from source.                                              |
| `properties.schema`    | `"kart-track/v1"`. Bump the version when the shape changes incompatibly.     |
| `properties.source`    | Where this came from. `format` + `file` (basename only).                     |
| `properties.center`    | Track centroid `[lon, lat]`. Either copied from source or averaged from traps. |

## Trap feature

Each trap becomes a `LineString` whose two points are the **gate endpoints**
the car drives through.

```jsonc
{
  "type": "Feature",
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [15.2094457, 32.8351887],   // left endpoint  (bearing - 90°)
      [15.2096595, 32.8351793]    // right endpoint (bearing + 90°)
    ]
  },
  "properties": {
    "id": "sf",
    "kind": "start_finish",
    "name": "S/F",
    "order": 0,
    "bearing_deg": 3,
    "width_m": 20,
    "unidirectional": true,
    "center": [15.2095526, 32.835184]
  }
}
```

| Property         | Notes                                                                                            |
|------------------|--------------------------------------------------------------------------------------------------|
| `id`             | `"sf"` for the start/finish, `"trap-N"` for sectors using `order`. Stable across re-runs.         |
| `kind`           | `"start_finish"` (RaceChrono type 3), `"sector"` (type 4), `"unknown"` (anything else).           |
| `name`           | Copied from source.                                                                              |
| `order`          | Position in the input `traps[]` array. S/F is normally `0` but input order wins.                 |
| `bearing_deg`    | Decimal degrees, `0..360`. Direction of travel through the trap.                                  |
| `width_m`        | Gate length in metres.                                                                           |
| `unidirectional` | If true, only crossings in the bearing direction count.                                          |
| `center`         | Trap centre `[lon, lat]`. Original RaceChrono trap centre, decoded.                              |
| `raw_type`       | **Only when `kind === "unknown"`** — the integer RaceChrono type that we couldn't classify.      |

### Endpoint geometry

Endpoints are computed on a sphere (Haversine destination, R = 6 371 008.8 m):

```
left  = destination(center, bearing_deg - 90, width_m / 2)
right = destination(center, bearing_deg + 90, width_m / 2)
```

This is accurate to <0.1 m for the 5–10 m hops we need. All numbers are
rounded to 7 decimal places (≈ 11 mm at the equator) so the file diffs
cleanly.

### Conventions

- `coordinates` is always `[lon, lat]` — GeoJSON order, opposite to
  RaceChrono's native fields.
- All numeric values are in real units (metres, decimal degrees). No
  scaling factors anywhere.
- Property keys use `snake_case` for unit-bearing fields (`bearing_deg`,
  `width_m`) so the unit is visible at the call site.

## Round-trip

Every RaceChrono trap field is preserved (`bearing`, `width`,
`uniDirectional`, `centerLat/Lon`, `type` via `kind` + optional
`raw_type`, `name`, ordering via `order`). A reverse converter back to
`.rcz` is straightforward when needed; not implemented yet.

## Versioning

Schema is `"kart-track/v1"`. Breaking changes bump the suffix
(`v2`, …) and live in a sibling spec file. Additive changes (new
optional `properties` keys) stay on `v1`.
