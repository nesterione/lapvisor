# Wire formats

The lapvisor toolkit produces and consumes a small set of versioned JSON / GeoJSON formats. Each spec is a public contract: any client (CLI, SDK consumer, web app, agent) emits identical artifacts.

## Naming rule

`<family>/v<N>` schema string. The schema field is the first thing every bundle carries. Pin by it.

| Spec | Schema string | Producer (SDK) | CLI |
| --- | --- | --- | --- |
| [`vbo.md`](./vbo.md) | (input format, not lapvisor-emitted) | `parseVbo` (`lapvisor/adapters`) | reads via `lapvisor session/lap/laps` |
| [`kart-track-v1.md`](./kart-track-v1.md) | `kart-track/v1` | `buildKartTrack` (`lapvisor/track`) | `lapvisor track create` |
| [`lapvisor-lap-v1.md`](./lapvisor-lap-v1.md) | `lapvisor-lap/v1` | `buildLapBundle` (`lapvisor/bundles`) | `lapvisor lap` |
| [`lapvisor-session-v2.md`](./lapvisor-session-v2.md) | `lapvisor-session/v2` | `buildSessionBundle` (`lapvisor/bundles`) | `lapvisor session` |

## Versioning

When a format changes, a new spec file appears (e.g. `lapvisor-session-v3.md`). The old spec stays — it's a permanent record. See [`../extending/bundle-version.md`](../extending/bundle-version.md) for the version-evolution workflow.

Spec files ship with the npm package (`files: ["dist", "docs/formats", ...]`) so SDK consumers can resolve `@see` links from a TypeDoc build offline.
