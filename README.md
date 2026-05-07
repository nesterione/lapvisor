# lapvisor

A CLI for race data analysis — lap times, GPS telemetry, sector splits — designed to be driven by AI agents as well as humans. Aimed at hobby karting and amateur motorsport.

> **Status:** early scaffold. The CLI surface and project layout are in place; format adapters and analysis routines are not implemented yet.

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

## License

MIT — see [LICENSE](./LICENSE).
