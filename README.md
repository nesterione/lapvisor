# lapvisor

A CLI for race data analysis — lap times, GPS telemetry, sector splits, track tooling — designed to be driven by AI agents as well as humans. Aimed at hobby karting and amateur motorsport.

> **Status:** v0.1.0. `laps`, `session`, and `track` (`create` + `edit`) work end-to-end against RaceBox / Racelogic VBOX files and `kart-track/v1` GeoJSON. Outputs are JSON-first so an agent can compose them.

## Install

Once published to npm:

```sh
npm install -g lapvisor
# or run on demand:
npx lapvisor --help
```

Requires Node.js 22+. End users do **not** need Bun.

## Develop

Bun (>=1.2) is used for dev and tests; `tsup` produces the Node-runnable bundle that ships to npm.

```sh
bun install
bun run dev <subcommand> ...      # run from source under Bun
bun run dev laps --help           # subcommand help
bun test                          # run tests
bun run lint                      # biome
bun run build                     # bundle -> dist/index.js (Node ESM)
node dist/index.js --help         # run the built artifact
bun link                          # expose `lapvisor` on PATH for local consumers
```

## Commands

| Command | Description |
| --- | --- |
| `laps <file>` | Parse a session, detect laps from gate crossings, emit a summary (count, best, mean, venue). |
| `session <file>` | Emit a complete render bundle (samples + laps + sectors + gates) as JSON for downstream UIs. |
| `track create` | Build a `kart-track/v1` GeoJSON file from a structured gate description (stdin or `--input`). |
| `track edit <file>` | Open a local browser editor for a `kart-track/v1` file (drag gates, edit name/kind/bearing/width, atomic save). |

### Try it with the bundled samples

The `samples/` directory ships a real RaceBox session at Plytinės Kartodromas (Vilnius) and the matching `kart-track/v1` track file, so every command can be exercised end-to-end without other inputs.

```sh
SESSION="samples/RaceBox Track Sessionon 05-05-2026 19-35.vbo"
TRACK="samples/plytines.track.json"

# 1. Lap summary (works without a track file — uses the gates inside the VBO).
lapvisor laps "$SESSION"

# 2. Full render bundle with sector splits — pair with the track file for named sectors.
lapvisor session "$SESSION" --track "$TRACK" | jq '{laps: (.laps|length), gates: (.gates|length), sectors: .sectorSplits[0].splits|length}'
# expect: 9 laps, 12 gates, 10 sectors

# 3. Visual track editor — opens http://localhost:5174/ in your browser.
cp "$TRACK" /tmp/edit-me.track.json     # work on a copy
lapvisor track edit /tmp/edit-me.track.json

# 4. Build a track from scratch — pipe an intent JSON through `track create`.
echo '{
  "name": "Toy track",
  "features": [
    {"id":"sf","kind":"start_finish","name":"S/F","order":0,
     "center":[25.349,54.725],"bearing_deg":90,"width_m":8,"unidirectional":false}
  ]
}' | lapvisor track create
```

### `lapvisor laps`

```sh
lapvisor laps session.vbo            # human-readable summary
lapvisor laps session.vbo --json     # JSON (also emitted when stdout is not a TTY)
```

```json
{
  "source": "session.vbo",
  "format": "vbo",
  "lapCount": 9,
  "meta": { "venue": "Plytines", "startedAt": "2026-05-05T16:35:00.000Z" },
  "bestMs": 44058,
  "meanMs": 44517
}
```

### `lapvisor session`

Emits a `lapvisor-session/v1` bundle: GPS samples, detected laps, sector splits, and gate geometry. Always JSON. Designed to be consumed by external UIs (e.g. the karting repo's `kart view` shells out to this and renders Leaflet on top).

```sh
lapvisor session session.vbo --track gates.geojson | jq '.laps | length'
```

### `lapvisor track create`

Reads a structured gate description (stdin or `--input`), validates with zod, computes LineString endpoints from each gate's `(center, bearing_deg, width_m)` via Haversine destination, emits a complete `kart-track/v1` FeatureCollection.

```sh
echo '{
  "name": "My track",
  "features": [
    {"id":"sf","kind":"start_finish","name":"S/F","order":0,
     "center":[25.349,54.725],"bearing_deg":90,"width_m":8,"unidirectional":false}
  ]
}' | lapvisor track create > my-track.json
```

Composable: upstream tools that parse vendor track formats (e.g. RaceChrono `.rcz`) decode the source and pipe an intent here — no source-format parsing lives in lapvisor.

### `lapvisor track edit`

Opens a `.track.json` in a local browser editor — drag gate centres on a Leaflet map, edit name/kind/bearing/width/unidirectional in a side panel, add or delete traps, save back to the same file.

```sh
lapvisor track edit my-track.json                     # http://localhost:5174/
lapvisor track edit my-track.json --port 6000 --no-open
lapvisor track edit my-track.json --readOnly          # disable the POST handler
```

Save: click *Save* or press Cmd/Ctrl-S. The server validates the schema tag, recomputes gate geometry from `(center, bearing, width)` (defence in depth), and atomically overwrites the file (`tmp` + `rename`).

## Adapters

| Format | Status | Notes |
| --- | --- | --- |
| `.vbo` (Racelogic VBOX / RaceBox) | working | Parser: [`src/adapters/vbo.ts`](./src/adapters/vbo.ts) · Reference: [docs/formats/vbo.md](./docs/formats/vbo.md). |
| `.gpx`, `.fit`, `.tcx`, lap-time CSV | planned | — |

## Analysis

| Capability | Status | Notes |
| --- | --- | --- |
| Lap detection from gate crossings | working | Sub-sample timestamp interpolation + direction lock + sats/velocity/min-lap filters. See [docs/analysis/laps.md](./docs/analysis/laps.md). |
| Sector splits | working | Per-lap offsets at each sector gate. Used by `session`. |
| Per-lap stats (top speed, peak G, …) | planned | — |

## Track format

`kart-track/v1` GeoJSON is owned by lapvisor — schema, builder (`track create`), and visual editor (`track edit`). Spec: [`docs/formats/kart-track-v1.md`](./docs/formats/kart-track-v1.md). Design notes (ADRs) live in the companion private `karting` repo under `docs/decisions/`.

## Programmatic use

The lower-level building blocks are available directly:

```ts
import { readFileSync } from "node:fs";
import { parseVbo } from "./src/adapters/vbo.js";
import { detectLaps } from "./src/analysis/laps.js";
import { buildKartTrack } from "./src/track/geojson.js";

const file = parseVbo(readFileSync("session.vbo", "utf8"), "session.vbo");
const { laps } = detectLaps(file.samples, file.gates);

for (const l of laps) {
  console.log(`L${l.index}: ${(l.durationMs / 1000).toFixed(3)} s`);
}
```

## Documentation

Concise reference notes that complement the code live under [`docs/`](./docs/):

- [`docs/formats/vbo.md`](./docs/formats/vbo.md), [`docs/formats/kart-track-v1.md`](./docs/formats/kart-track-v1.md)
- [`docs/analysis/laps.md`](./docs/analysis/laps.md)

## License

MIT — see [LICENSE](./LICENSE).
