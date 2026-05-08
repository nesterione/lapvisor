# lapvisor

A CLI for race data analysis — lap times, GPS telemetry, sector splits — designed to be driven by AI agents as well as humans. Aimed at hobby karting and amateur motorsport.

> **Status:** early scaffold. The CLI surface and project layout are in place. The VBO adapter parses RaceBox / Racelogic VBOX files end-to-end and lap detection from gate crossings works against real telemetry; neither is yet wired into a CLI subcommand.

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
| `laps <file>` | scaffolded | Summarize lap times from a session file |

Pass `--json` (or pipe stdout) to get machine-readable output.

## Adapters

| Format | Status | Notes |
| --- | --- | --- |
| `.vbo` (Racelogic VBOX / RaceBox) | parser ready | See [docs/formats/vbo.md](./docs/formats/vbo.md). Parser at [`src/adapters/vbo.ts`](./src/adapters/vbo.ts); not yet wired into a CLI subcommand. |
| `.gpx`, `.fit`, `.tcx`, lap-time CSV | planned | — |

## Analysis

| Capability | Status | Notes |
| --- | --- | --- |
| Lap detection from gate crossings | working | Sub-sample timestamp interpolation + direction lock + sats/velocity/min-lap filters. See [docs/analysis/laps.md](./docs/analysis/laps.md). Runs in ~5 ms over 12 k samples. |
| Per-lap stats (top speed, peak G, …) | planned | — |
| Sector splits from `Split` gates | planned | — |

## Programmatic use

Until a CLI subcommand wires it up:

```ts
import { readFileSync } from "node:fs";
import { parseVbo } from "./src/adapters/vbo.js";
import { detectLaps } from "./src/analysis/laps.js";

const file = parseVbo(readFileSync("session.vbo", "utf8"), "session.vbo");
const { laps } = detectLaps(file.samples, file.gates);

for (const l of laps) {
  console.log(`L${l.index}: ${(l.durationMs / 1000).toFixed(3)} s`);
}
```

## Documentation

Concise reference notes that complement the code live under [`docs/`](./docs/).

## License

MIT — see [LICENSE](./LICENSE).
