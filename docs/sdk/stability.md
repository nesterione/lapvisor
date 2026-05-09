# SDK Stability

## Subpath promises

| Subpath | Stability |
| --- | --- |
| `lapvisor/model` | Stable. Type changes are breaking (major bump). |
| `lapvisor/adapters` | Stable. New adapters (GPX, FIT, TCX, lap-csv) are additive. |
| `lapvisor/analysis` | Stable. New analysis functions are additive. Existing function signatures are frozen within a major. |
| `lapvisor/bundles` | Versioned. Each bundle producer (`buildLapBundleV1`, `buildSessionBundleV2`, …) is frozen for the life of its version. New versions appear as new exports; old ones are `@deprecated` but kept exporting through the next major. See [`../extending/bundle-version.md`](../extending/bundle-version.md). |
| `lapvisor/track` | Stable. The `kart-track/v1` schema itself is the contract. |
| `lapvisor/time` | Stable. |

The bare package import (`import "lapvisor"`) is **not** exposed; only the per-area subpaths are. Don't import internal source files (`lapvisor/dist/...`, `lapvisor/src/...`) — those are not stable.

## TSDoc tiers

The SDK uses three tiers of documentation to avoid a flag-day rewrite while keeping the public surface fully documented.

### Tier 1 — every export documented

Modules whose every export must carry full TSDoc (description, `@param` per parameter, `@returns`, `@throws` where non-trivial, `@example` on entry points, `@see` to wire-format spec where relevant).

- `src/model.ts`
- `src/adapters/index.ts`, `src/adapters/vbo.ts`
- `src/analysis/laps.ts`, `lap-detail.ts`, `session-summary.ts`, `sectors.ts`, `aggregates.ts`, `distance.ts`
- `src/bundles/*.ts`
- `src/track/loader.ts`, `geojson.ts`, `intent.ts`, `types.ts`

Exemplar:

```ts
/**
 * Detect laps from a time-ordered stream of GPS samples and a set of gates.
 *
 * Pure function — no I/O. Geometry and filter details: [`docs/analysis/laps.md`](../analysis/laps.md).
 *
 * @param samples - Time-ordered samples. Must be sorted by `timeOfDayMs`.
 * @param gates - At least one `kind: "start"` gate is required.
 * @param opts - Filter overrides; defaults debounce 5 s and require a GPS fix.
 * @returns Detected laps, accepted crossings, and rejected-crossing diagnostics.
 * @throws {NoStartGateError} when `gates` contains no start gate.
 * @example
 * ```ts
 * import { parseVbo } from "lapvisor/adapters";
 * import { detectLaps } from "lapvisor/analysis";
 * const file = parseVbo(text);
 * const { laps } = detectLaps(file.samples, file.gates);
 * ```
 */
```

### Tier 2 — descriptions on exports

Internal-but-exported helpers (e.g. `decodeVboCoord`, `decodeVboTime`, `src/util/*`). One-line description; `@param`/`@returns` only when the name doesn't make it obvious.

### Tier 3 — internal

Everything not exported from the SDK barrels — including all of `src/cli/`. Optional one-line file-header docstring; per-function TSDoc not required.

## Versioning

Bumps follow [SemVer](https://semver.org/) on the SDK surface, not the CLI presentation. A change that:

- Adds a new export to any subpath → minor.
- Renames or removes a Tier-1 export → major.
- Adds a new bundle version (e.g. `lapvisor-session/v3`) alongside an existing one → minor (old version still exported, marked `@deprecated`).
- Removes a deprecated bundle version → major.
- Changes CLI human-output formatting → patch (output is not a contract).

CLI JSON output is the same wire format as the corresponding bundle producer. Pinning to a bundle version in code (via the schema field, or by importing the typed producer) is more durable than pinning to a CLI version.
