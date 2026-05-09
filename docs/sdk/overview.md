# SDK Overview

`lapvisor` ships an SDK and a CLI from one codebase. The SDK is the primary product surface — anyone can build apps on it (web UIs, dashboards, MCP servers, batch pipelines, custom agents). The CLI is one client of that SDK.

## Mental model

```
            ┌─────────────────────────────────────────────┐
            │                  Your client                │
            │   (CLI, web app, agent, MCP server, …)      │
            └──────────────────────┬──────────────────────┘
                                   │
            ┌──────────────────────┴──────────────────────┐
            │                  Bundles                     │
            │   buildLapBundle / buildSessionBundle /      │
            │   buildLapsSummary  →  versioned wire JSON   │
            └──────────────────────┬──────────────────────┘
                                   │
            ┌──────────────┬───────┴───────┬───────────────┐
            │  Adapters    │   Analysis    │     Track     │
            │  parseVbo    │  detectLaps   │  buildKart-   │
            │  loadSession │  extractLap   │  Track,       │
            │              │  summarizeLap │  parseKart-   │
            │              │               │  Track        │
            └──────────────┴───────────────┴───────────────┘
                                   │
                                Model
                          Session, Lap, …
```

The arrows go bottom-up. Lower layers are pure (no I/O, framework-free). Bundle producers compose them into versioned artifacts that any client emits identically.

## Per-area subpaths

The SDK is exposed as flat per-area npm subpaths. Each subpath is independently importable:

| Subpath | What's inside |
| --- | --- |
| `lapvisor/model` | `Session`, `Lap`, `SessionFormat` — the canonical types every layer speaks. |
| `lapvisor/adapters` | Format readers. `loadSession` (path → `Session`) and pure `loadSessionFromText` / `parseVbo`. |
| `lapvisor/analysis` | Pure analysis functions: `detectLaps`, `detectSectorSplits`, `extractLap`, `summarizeLap`, `buildSessionSummary`, plus `lapAggregates`, `cumulativeDistance`. |
| `lapvisor/bundles` | Versioned wire-format builders: `buildLapBundle` (`lapvisor-lap/v1`), `buildSessionBundle` (`lapvisor-session/v2`), `buildLapsSummary`. |
| `lapvisor/track` | `kart-track/v1` GeoJSON: `buildKartTrack`, `parseKartTrack`, `loadKartTrack`, `kartTrackIntentSchema`, geometry helpers. |
| `lapvisor/time` | `parseLapTimeMs`, `formatLapTime`. |

The bare package import (`import "lapvisor"`) is intentionally not exposed — every SDK import goes through a subpath so scope is explicit.

## Pure vs I/O

Two layers exist for parsing:

- **Pure parsers** — operate on strings, browser-safe, no Node-only deps:
  `parseVbo(text)`, `loadSessionFromText(text, format)`, `parseKartTrack(text)`.
- **I/O wrappers** — read files via `node:fs/promises`, Node-only:
  `loadSession(path)`, `loadKartTrack(path)`.

Use the pure variants in browsers and any environment where you've already fetched the bytes.

## Quick links

- Quick start: [`./quickstart.md`](./quickstart.md)
- Stability and TSDoc tiers: [`./stability.md`](./stability.md)
- Wire formats: [`../formats/`](../formats/)
- Adding new adapters / analysis / bundle versions: [`../extending/`](../extending/)
- Runnable examples: [on GitHub](https://github.com/nesterione/lapvisor/tree/main/examples)
