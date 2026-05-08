# lapvisor

A CLI for race data analysis — lap times, GPS telemetry, sector splits — designed to be driven by AI agents as well as humans. Aimed at hobby karting and amateur motorsport.

> **Status:** early scaffold. The CLI surface and project layout are in place. The VBO adapter (RaceBox / Racelogic VBOX) parses files end-to-end; other formats and the lap/analysis pipeline are not yet wired into the CLI.

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

Programmatic use (until a CLI subcommand lands):

```ts
import { parseVbo } from "./src/adapters/vbo.js";
import { readFileSync } from "node:fs";

const file = parseVbo(readFileSync("session.vbo", "utf8"), "session.vbo");
console.log(file.samples.length, file.gates, file.startedAt);
```

## Documentation

Concise reference notes that complement the code live under [`docs/`](./docs/).

## License

MIT — see [LICENSE](./LICENSE).
