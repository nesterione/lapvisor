# lapvisor

A CLI for race data analysis — RaceChrono Analytics for the terminal, designed to be driven by AI agents as well as humans. Aimed at hobby karting and amateur motorsport.

> **Status:** early scaffold. The CLI surface and project layout are in place; format adapters and analysis routines are not implemented yet.

## Requirements

- [Bun](https://bun.sh) 1.1+

## Install

```sh
bun install
```

## Run

```sh
bun run dev <subcommand> ...      # run from source
bun run dev laps --help           # subcommand help
bun test                          # run tests
bun run typecheck                 # tsc --noEmit
bun run build                     # single-file binary -> dist/lapvisor
```

## Commands

| Command | Status | Description |
| --- | --- | --- |
| `laps <file>` | scaffolded | Summarize lap times from a session file |

Pass `--json` (or pipe stdout) to get machine-readable output.

## License

MIT — see [LICENSE](./LICENSE).
