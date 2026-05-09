# lapvisor

A **race-data toolkit** — lap times, GPS telemetry, sector splits, track tooling — for hobby karting and amateur motorsport. Ships an SDK and a CLI from one codebase.

> **Status:** v0.3.0. SDK + CLI split. Working: `laps`, `session`, `lap`, `track create`, `track edit` against RaceBox / Racelogic VBOX files and `kart-track/v1` GeoJSON.

## Two doors

- **CLI users (humans + AI agents):** [`docs/cli/overview.md`](./docs/cli/overview.md)
- **SDK consumers (developers):** [`docs/sdk/overview.md`](./docs/sdk/overview.md)

## Install

```sh
# CLI
npm install -g lapvisor
npx lapvisor --help

# SDK
npm install lapvisor
```

Requires Node.js 22+. End users do **not** need Bun.

## CLI 60-second tour

The `samples/` directory ships a real session at Plytinės Kartodromas (Vilnius) and the matching track file:

```sh
SESSION="samples/RaceBox Track Sessionon 05-05-2026 19-35.vbo"
TRACK="samples/plytines.track.json"

# 1. Lap-time summary
lapvisor laps "$SESSION"

# 2. Full session render bundle (JSON, lapvisor-session/v2)
lapvisor session "$SESSION" --track "$TRACK" | jq '.lapSummaries | length'  # 9

# 3. One lap with rich telemetry (JSON, lapvisor-lap/v1)
lapvisor lap "$SESSION" 3 --track "$TRACK" | jq '{laps: .lap, sectors: (.sectors | length)}'
```

Full CLI reference: [`docs/cli/overview.md`](./docs/cli/overview.md).

## SDK 60-second tour

```ts
import { parseVbo } from "lapvisor/adapters";
import { loadKartTrack } from "lapvisor/track";
import { buildSessionBundle } from "lapvisor/bundles";
import { readFile } from "node:fs/promises";

const text = await readFile("session.vbo", "utf8");
const vboFile = parseVbo(text, "session.vbo");
const track = await loadKartTrack("track.json");

const bundle = buildSessionBundle({
  source: { file: "session.vbo", format: "vbo" },
  vboFile,
  track,
});

console.log(bundle.schema);  // "lapvisor-session/v2"
```

Per-area subpaths: `lapvisor/model`, `lapvisor/adapters`, `lapvisor/analysis`, `lapvisor/bundles`, `lapvisor/track`, `lapvisor/time`. Browser-safe pure variants (`parseVbo`, `parseKartTrack`, `loadSessionFromText`) skip Node-only file I/O.

Full SDK reference: [`docs/sdk/overview.md`](./docs/sdk/overview.md). Runnable examples: [`examples/`](./examples/).

## What's inside

| Section | Path |
| --- | --- |
| SDK overview, quick start, stability tiers | [`docs/sdk/`](./docs/sdk/) |
| CLI reference | [`docs/cli/`](./docs/cli/) |
| Wire formats (VBO, kart-track/v1, lapvisor-lap/v1, lapvisor-session/v2) | [`docs/formats/`](./docs/formats/) |
| How to add adapters / analyses / bundle versions | [`docs/extending/`](./docs/extending/) |
| Analysis notes (lap detection geometry, filters) | [`docs/analysis/`](./docs/analysis/) |
| Runnable SDK examples | [`examples/`](./examples/) |

## Adapters

| Format | Status | Notes |
| --- | --- | --- |
| `.vbo` (Racelogic VBOX / RaceBox) | working | [`src/adapters/vbo.ts`](./src/adapters/vbo.ts) · [spec](./docs/formats/vbo.md) |
| `.gpx`, `.fit`, `.tcx`, lap-time CSV | planned | See [`docs/extending/adapter.md`](./docs/extending/adapter.md) for how to add one. |

## Develop

Bun (>=1.2) is used for dev and tests; `tsup` produces the Node-runnable artifacts.

```sh
bun install
bun run dev <subcommand> ...      # run CLI from source
bun test                          # run tests (includes examples + SDK exports when dist/ is built)
bun run lint                      # biome
bun run format                    # biome auto-fix
bun run build                     # produces dist/cli.js + dist/sdk/*.js + dist/sdk/*.d.ts
node dist/cli.js --help           # run the built CLI artifact
```

## License

MIT — see [LICENSE](./LICENSE).
