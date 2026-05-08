# lapvisor

A CLI for race data analysis — lap times, GPS telemetry, sector splits — designed to be driven by AI agents as well as humans. Aimed at hobby karting and amateur motorsport.

> **Status:** early scaffold. `lapvisor laps <file.vbo>` works end-to-end against RaceBox / Racelogic VBOX files: parses the file, detects laps from gate crossings, and emits a summary (human or JSON). Other formats and richer per-lap analysis are planned.

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
```

## Commands

| Command | Status | Description |
| --- | --- | --- |
| `laps <file>` | working for `.vbo` | Parse, detect laps from gate crossings, summarize (count, best, mean, venue, started-at). |

```sh
lapvisor laps session.vbo            # human-readable summary
lapvisor laps session.vbo --json     # JSON (also emitted when stdout is not a TTY)
```

Sample output (RaceBox karting session, 9 laps, ~12 k samples, ~50 ms total):

```json
{
  "source": "session.vbo",
  "format": "vbo",
  "lapCount": 9,
  "meta": { "venue": "Plytines", "startedAt": "2026-05-05T16:35:00.000Z", "sampleCount": 11794 },
  "bestMs": 44058.378,
  "meanMs": 44517
}
```

## Adapters

| Format | Status | Notes |
| --- | --- | --- |
| `.vbo` (Racelogic VBOX / RaceBox) | working | Parser: [`src/adapters/vbo.ts`](./src/adapters/vbo.ts) · Reference: [docs/formats/vbo.md](./docs/formats/vbo.md). |
| `.gpx`, `.fit`, `.tcx`, lap-time CSV | planned | — |

## Analysis

| Capability | Status | Notes |
| --- | --- | --- |
| Lap detection from gate crossings | working | Sub-sample timestamp interpolation + direction lock + sats/velocity/min-lap filters. See [docs/analysis/laps.md](./docs/analysis/laps.md). |
| Per-lap stats (top speed, peak G, …) | planned | — |
| Sector splits from `Split` gates | planned | — |

## Programmatic use

The lower-level building blocks are available directly:

```ts
import { readFileSync } from "node:fs";
import { parseVbo } from "./src/adapters/vbo.js";
import { detectLaps } from "./src/analysis/laps.js";

const file = parseVbo(readFileSync("session.vbo", "utf8"), "session.vbo");
const { laps, crossings, rejected } = detectLaps(file.samples, file.gates);

for (const l of laps) {
  console.log(`L${l.index}: ${(l.durationMs / 1000).toFixed(3)} s`);
}
```

## Documentation

Concise reference notes that complement the code live under [`docs/`](./docs/).

## License

MIT — see [LICENSE](./LICENSE).
