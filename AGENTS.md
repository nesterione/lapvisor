# AGENTS.md

Guidance for AI tools driving lapvisor (Cursor, Aider, custom agents). Claude Code uses [`CLAUDE.md`](./CLAUDE.md) — start there.

## Repo shape

`lapvisor` ships an **SDK** and a **CLI** from one codebase. The SDK (`lapvisor/adapters`, `lapvisor/analysis`, `lapvisor/bundles`, `lapvisor/track`, `lapvisor/time`, `lapvisor/model`) is the durable product surface; the CLI is one client of it. Default rule for changes: keep logic in SDK layers; the CLI stays a thin wrapper.

## How to drive the CLI

- Run `lapvisor <subcommand> --help` for any flag list.
- The CLI emits **JSON** when stdout is not a TTY or when `--json` is passed. Always pipe (`> out.json` or `| jq`) to get the machine-readable form.
- Bundle outputs carry a `schema` field — pin to it (`lapvisor-session/v2`, `lapvisor-lap/v1`, `kart-track/v1`).
- Exit code `0` on success, `1` on any error. Error messages go to stderr and are not yet structured.

Full reference: [`docs/cli/overview.md`](./docs/cli/overview.md).

## How to use the SDK

- Per-area subpaths: import from `lapvisor/<area>` only — never reach into `lapvisor/dist/...` or `lapvisor/src/...`.
- Pure parsers (`parseVbo`, `parseKartTrack`, `loadSessionFromText`) are browser-safe; the path-based wrappers are Node-only.
- Bundle producers (`buildLapBundle`, `buildSessionBundle`, `buildLapsSummary`) emit identical output to the CLI.

Full reference: [`docs/sdk/overview.md`](./docs/sdk/overview.md). Runnable examples: [`examples/`](./examples/).

## Extending

- New adapter (GPX / FIT / TCX / CSV): [`docs/extending/adapter.md`](./docs/extending/adapter.md).
- New analysis function: [`docs/extending/analysis.md`](./docs/extending/analysis.md).
- New bundle version: [`docs/extending/bundle-version.md`](./docs/extending/bundle-version.md).

## Tests

`bun test`. Tests under `tests/examples/` double as SDK usage examples. Tests under `tests/sdk-exports.test.ts` verify every subpath's runtime exports — they auto-skip when `dist/` isn't built.
