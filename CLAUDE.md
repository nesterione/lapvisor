# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`lapvisor` is a race data toolkit — lap times, GPS telemetry, sector splits — for hobby karting and amateur motorsport.

This repo ships **two things** from one codebase:

1. **SDK** (the core) — a TypeScript library of adapters + analysis + domain model. Anyone can build apps on top of it: web UIs, dashboards, custom agents, batch pipelines, other CLIs. The SDK is the long-term product surface.
2. **CLI** (one client of the SDK) — a Node-runnable command-line tool that wraps the SDK for direct use by humans and AI agents. Outputs are agent-friendly (machine-readable JSON alongside human-formatted views). The CLI is the first reference client; more clients (e.g., MCP server, web app) may follow.

When making changes, default to keeping logic in the SDK layers (adapters, analysis, model) so any future client benefits. The CLI should be a thin shell that parses args, calls SDK functions, and formats output.

## Stack

- **Dev runtime / test runner**: Bun (>=1.2). Used for `bun run dev`, `bun test`, and CI. Source is plain TS — Bun runs it directly.
- **Build**: `tsup` bundles `src/cli/index.ts` → `dist/index.js` (ESM, target node22) with a `#!/usr/bin/env node` banner. The published npm artifact is Node-runnable; **end users do not need Bun**.
- **Language**: TypeScript with `module: NodeNext`. Internal imports use `.js` extensions (NodeNext requirement — TS resolves `.js` to `.ts` source).
- **Lint / format**: Biome (`bun run lint`, `bun run format`).
- **CLI framework**: `citty` (UnJS) for nested subcommands.
- **Validation**: `zod` for user input and external file parsing.
- **Terminal output**: `picocolors` for color. JSON output when `--json` is passed or stdout is non-TTY.

Confirm with the user before adding heavier deps (chart renderers, FFmpeg wrappers, native bindings).

## Commands

- `bun install`
- `bun run dev <subcommand> ...` — run CLI from source under Bun
- `bun test` — all tests; `bun test path/to/file.test.ts` for one file
- `bun run lint` / `bun run format` — Biome
- `bun run build` — produce `dist/index.js` (Node ESM bundle, executable)
- `node dist/index.js <subcommand>` — run the built artifact under Node

## Publishing

- npm package: `lapvisor`. Currently `files: ["dist"]` ships only the CLI bundle. The SDK is not yet published as a separate import surface — when we expose it, expect a second entry point (e.g. `lapvisor/sdk`) and corresponding type declarations.
- `prepublishOnly` enforces lint + test + build.
- GitHub Actions (`.github/workflows/release.yml`) publishes on `vX.Y.Z` tag push: it verifies `tag == package.json version`, runs `npm publish` with `NPM_TOKEN`, and creates a GitHub release. Required repo secret: `NPM_TOKEN`.
- CI (`.github/workflows/ci.yml`) runs lint + build + test on every push/PR to `main`.

## Architecture

The codebase is split into **SDK layers** (reusable by any client) and **client layers** (currently just the CLI).

**SDK layers** — keep these pure, dependency-light, and free of CLI concerns (no `process.exit`, no terminal colors, no arg parsing):

1. **Model** (`src/model.ts`) — the canonical `Session` / `Lap` types every client speaks.
2. **Adapters** (`src/adapters/`) — read input formats and normalize to `Session`. Targets: GPX, FIT (Garmin), TCX, plain lap-time CSV. Every adapter returns the same model; analysis code never sees raw formats.
3. **Analysis** (`src/analysis/`) — pure functions over `Session`: lap stats, sector splits, line/speed comparisons, consistency metrics. No I/O.
4. **Track** (`src/track/`), **Util** (`src/util/`) — supporting SDK utilities (track geometry, shared helpers).

**Client layers**:

5. **CLI** (`src/cli/`) — subcommands compose SDK functions and format output. Thin layer: parse → call SDK → render. *Skills* (`src/skills/`, when present) are higher-level recipes meant to be invoked by an AI agent (e.g. "find the slowest sector"); each skill emits structured JSON by default and human output behind a flag.

New functionality usually belongs in the SDK layers. Reach for the CLI layer only for presentation, argument handling, and exit codes. If a piece of logic would also be useful to a non-CLI client, it goes in the SDK.

Race data files (`*.csv`, `*.gpx`, `*.fit`) go in a gitignored `data/` directory; small samples for tests in `tests/fixtures/`. Never commit user race data.

## Domain notes

- A *session* is one outing; it contains many *laps*. Lap timing is the primary signal; GPS + speed traces are secondary.
- Lap-time inputs are messy — accept seconds (`43.605`), `MM:SS.mmm`, `HH:MM:SS.mmm`. Centralize parsing; don't scatter regex across adapters.
- "First-lap timestamp + lap durations" is a common input pattern (one of several adapters), not the core model.
- AI-agent-friendliness means: stable JSON schema for outputs, meaningful exit codes, errors as structured objects under `--json`, and no interactive prompts when stdin is not a TTY. This applies to the CLI; the SDK exposes the same data as plain return values / typed errors so other clients get equivalent guarantees.

## Task tracking

`.jobdone/` is a committed local task tracker (config in `.jobdone/config.yaml`; files under `.jobdone/tasks/{todo,doing,done}/`). Respect its conventions when adding tasks.
