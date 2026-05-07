# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`lapvisor` is a CLI for race data analysis — RaceChrono Analytics in a terminal, designed to be driven by AI agents as well as humans. Target use case: hobby karting and amateur motorsport. Outputs are agent-friendly (machine-readable JSON alongside human-formatted views).

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

- npm package: `lapvisor`. `files: ["dist"]` ships only the bundle.
- `prepublishOnly` enforces lint + test + build.
- GitHub Actions (`.github/workflows/release.yml`) publishes on `vX.Y.Z` tag push: it verifies `tag == package.json version`, runs `npm publish` with `NPM_TOKEN`, and creates a GitHub release. Required repo secret: `NPM_TOKEN`.
- CI (`.github/workflows/ci.yml`) runs lint + build + test on every push/PR to `main`.

## Architecture (three layers)

1. **Adapters** (`src/adapters/`) — read input formats and normalize to a common `Session` shape. Targets: RaceChrono CSV export, GPX, FIT (Garmin), TCX, plain lap-time CSV. Every adapter returns the same model; analysis code never sees raw formats.
2. **Analysis** (`src/analysis/`) — pure functions over `Session`: lap stats, sector splits, line/speed comparisons, consistency metrics. No I/O.
3. **CLI + Skills** (`src/cli/`, `src/skills/`) — subcommands compose adapters + analysis. *Skills* are higher-level recipes meant to be invoked by an AI agent (e.g. "find the slowest sector"); each skill emits structured JSON by default and human output behind a flag.

Race data files (`*.csv`, `*.gpx`, `*.fit`) go in a gitignored `data/` directory; small samples for tests in `tests/fixtures/`. Never commit user race data.

## Domain notes

- A *session* is one outing; it contains many *laps*. Lap timing is the primary signal; GPS + speed traces are secondary.
- Lap-time inputs are messy — accept seconds (`43.605`), `MM:SS.mmm`, `HH:MM:SS.mmm`. Centralize parsing; don't scatter regex across adapters.
- "First-lap timestamp + lap durations" is a common input pattern (one of several adapters), not the core model.
- AI-agent-friendliness means: stable JSON schema for outputs, meaningful exit codes, errors as structured objects under `--json`, and no interactive prompts when stdin is not a TTY.

## Task tracking

`.jobdone/` is a committed local task tracker (config in `.jobdone/config.yaml`; files under `.jobdone/tasks/{todo,doing,done}/`). Respect its conventions when adding tasks.
