# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`lapvisor` is a race data toolkit — lap times, GPS telemetry, sector splits — for hobby karting and amateur motorsport.

This repo ships **two things** from one codebase:

1. **SDK** (the core) — a TypeScript library exposed as flat per-area npm subpaths: `lapvisor/model`, `lapvisor/adapters`, `lapvisor/analysis`, `lapvisor/bundles`, `lapvisor/track`, `lapvisor/time`. The SDK is the long-term product surface. Anyone can build apps on it.
2. **CLI** (`lapvisor`) — a Node-runnable command-line tool that wraps the SDK. The CLI is one client among many that may exist (web UI, MCP server, custom agents).

Default rule for changes: keep logic in SDK layers; the CLI stays a thin shell that parses args, calls SDK functions (often a bundle producer), and formats output.

## Stack

- **Dev runtime / test runner**: Bun (>=1.2). Source is plain TS — Bun runs it directly.
- **Build**: `tsup` produces two artifact families:
  - CLI bin: `dist/cli.js` (ESM, target node22, `#!/usr/bin/env node` banner).
  - SDK barrels: `dist/sdk/{model,adapters,analysis,bundles,track,time}.{js,d.ts}` (one entry per subpath).
- **Language**: TypeScript with `module: NodeNext`. Internal imports use `.js` extensions (NodeNext requirement — TS resolves `.js` to `.ts` source).
- **Lint / format**: Biome (`bun run lint`, `bun run format`).
- **CLI framework**: `citty` (UnJS).
- **Validation**: `zod` — used only at trust boundaries (CLI input via `kartTrackIntentSchema`).
- **Terminal output**: `picocolors` for color. JSON when `--json` is passed or stdout is non-TTY.

Confirm with the user before adding heavier deps (chart renderers, FFmpeg wrappers, native bindings).

## Commands

- `bun install`
- `bun run dev <subcommand> ...` — run CLI from source under Bun
- `bun test` — all tests; `bun test path/to/file.test.ts` for one file
- `bun run lint` / `bun run format` — Biome
- `bun run build` — produces `dist/cli.js` + `dist/sdk/*.{js,d.ts}`
- `node dist/cli.js <subcommand>` — run the built CLI under Node
- `bun run docs:dev` — VitePress local preview at `http://localhost:5173/lapvisor/`
- `bun run docs:build` — TypeDoc + VitePress full build (catches dead links / TSDoc errors locally before CI does)

## Publishing

- npm package: `lapvisor`. `files` ships `dist/`, `docs/formats/`, README, LICENSE.
- `package.json` `exports` map exposes per-area subpaths only — bare `lapvisor` import is intentionally unexposed.
- `bin: { "lapvisor": "./dist/cli.js" }`.
- `prepublishOnly` enforces lint + test + build.
- GitHub Actions (`.github/workflows/release.yml`) publishes on `vX.Y.Z` tag push.
- CI (`.github/workflows/ci.yml`) runs lint + build + test on every push/PR to `main`.

## Architecture

**SDK layers** — pure, dependency-light, no CLI concerns (no `process.exit`, no terminal colors, no arg parsing):

1. **Model** (`src/model.ts`) — canonical `Session` / `Lap` / `SessionFormat`.
2. **Adapters** (`src/adapters/`) — `parseVbo` (pure), `loadSessionFromText` (pure dispatch by format), `loadSession` (I/O wrapper).
3. **Analysis** (`src/analysis/`) — `detectLaps`, `detectSectorSplits`, `extractLap`, `summarizeLap`, `buildSessionSummary`, `lapAggregates`, `cumulativeDistance`. All pure.
4. **Bundles** (`src/bundles/`) — versioned wire-format producers: `buildLapBundle` (`lapvisor-lap/v1`), `buildSessionBundle` (`lapvisor-session/v2`), `buildLapsSummary`. Plus shared types and gate-conversion helpers.
5. **Track** (`src/track/`) — `parseKartTrack` (pure), `loadKartTrack` (I/O), `buildKartTrack`, geometry helpers, `kartTrackIntentSchema` (zod). `track/edit/` is CLI-only and not in the SDK barrel.
6. **Util** (`src/util/`) — `time.ts` (parse/format lap times), `rounding.ts` (`round1`, `round3`, `round7`).

**SDK barrels** (`src/sdk/`) — one file per subpath, re-exports only. Public surface for consumers.

**CLI layers** (not in SDK barrels):

7. `src/cli/index.ts` + `src/cli/commands/` — citty wiring + subcommands. Each command parses args, calls a bundle producer, and decides JSON vs human output.
8. `src/cli/render/` — picocolors-flavoured human formatters (`printLapBundle`, `printLapsSummary`).
9. `src/track/edit/` — local HTTP track editor server + client.

New functionality usually belongs in the SDK layers. Reach for the CLI layer only for presentation, argument handling, and exit codes. Use shared `src/util/rounding.ts` instead of inlining `Math.round(v * 10) / 10`.

Race data files (`*.csv`, `*.gpx`, `*.fit`) go in a gitignored `data/` directory; small samples for tests in `tests/fixtures/`. Never commit user race data.

## Documentation

The published site is built by VitePress + TypeDoc and deployed to GitHub Pages on every push to `main` via `.github/workflows/docs.yml`.

- [`docs/sdk/`](./docs/sdk/) — SDK overview, quickstart, stability tiers (TSDoc policy).
- [`docs/cli/`](./docs/cli/) — CLI reference for humans and agents.
- [`docs/formats/`](./docs/formats/) — wire-format specs (versioned, public contracts).
- [`docs/extending/`](./docs/extending/) — guides for adding adapters, analyses, bundle versions.
- [`docs/analysis/`](./docs/analysis/) — analysis-function notes (geometry, filters).
- [`docs/api/`](./docs/api/) — **generated** by TypeDoc from `src/sdk/*.ts`. Gitignored. Do not hand-edit.
- [`examples/`](./examples/) — runnable SDK examples, paired with `tests/examples/`.

## Docs contribution

Docs are part of the contract — keep them current with code. When you:

- **Add a new SDK export** to a Tier-1 module: write Tier-1 TSDoc (description, `@param`, `@returns`, `@throws` where non-trivial, `@example` on entry points, `@see` to the format spec where relevant). Tier rules: [`docs/sdk/stability.md`](./docs/sdk/stability.md).
- **Add a new adapter** (GPX, FIT, TCX, lap-CSV, …): follow the checklist in [`docs/extending/adapter.md`](./docs/extending/adapter.md). Updates required: adapter table row in `README.md`, new `docs/formats/<format>.md` spec, fixture under `tests/fixtures/<format>/`, the dispatch `switch` cases in `src/adapters/index.ts`, and the SDK barrel re-export in `src/sdk/adapters.ts`.
- **Add a new analysis function**: follow [`docs/extending/analysis.md`](./docs/extending/analysis.md). Add a `docs/analysis/<name>.md` long-form note when the geometry, filter logic, or known limits are non-trivial.
- **Add or evolve a bundle version**: follow [`docs/extending/bundle-version.md`](./docs/extending/bundle-version.md). Create `docs/formats/<family>-v<N>.md`; mark the previous producer `@deprecated` but keep exporting it; never silently mutate an existing schema.
- **Add a CLI subcommand or flag**: update [`docs/cli/overview.md`](./docs/cli/overview.md) (or split into per-command pages if it grows). The CLI's JSON output is the contract — its human-readable output is not.
- **Add a notable SDK usage pattern**: drop a runnable file under `examples/`, paired with `tests/examples/<name>.test.ts`, and link it from [`docs/sdk/quickstart.md`](./docs/sdk/quickstart.md) when it deserves a place there.

If a change touches a sidebar entry (new section under `docs/`), also update `docs/.vitepress/config.ts`. Run `bun run docs:build` before committing significant doc work — the build catches dead links and TypeDoc errors that would otherwise only surface on the CI deploy.

## Domain notes

- A *session* is one outing; it contains many *laps*. Lap timing is the primary signal; GPS + speed traces are secondary.
- Lap-time inputs are messy — accept seconds (`43.605`), `MM:SS.mmm`, `HH:MM:SS.mmm`. Centralize parsing in `src/util/time.ts`; don't scatter regex across adapters.
- AI-agent-friendliness for the CLI: stable JSON schema, meaningful exit codes, no interactive prompts when stdin is not a TTY. The SDK exposes the same data as plain return values / typed errors so other clients get equivalent guarantees.
- Bundle JSON output is byte-stable across runs (rounding centralised in `src/util/rounding.ts`). Tests rely on this for output-diff verification.

## Task tracking

`.jobdone/` is a committed local task tracker (config in `.jobdone/config.yaml`; files under `.jobdone/tasks/{todo,doing,done}/`). Respect its conventions when adding tasks.
