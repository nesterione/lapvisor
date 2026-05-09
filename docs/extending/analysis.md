# Adding a new analysis function

Analysis functions are pure transforms over the canonical `Session`/sample shape. Examples: `detectLaps`, `extractLap`, `summarizeLap`. They live under `src/analysis/`.

## Function-shape conventions

- **Pure.** No I/O. No `console.log`. No global state. Same inputs → same outputs.
- **Options object.** When a function takes more than positional inputs, accept a single `Options` object with optional fields:

  ```ts
  export interface MyAnalysisOptions {
    /** Minimum velocity in km/h to consider a sample. Defaults to 5. */
    minVelocityKmh?: number;
  }

  export function myAnalysis(
    samples: VboSample[],
    options: MyAnalysisOptions = {},
  ): MyAnalysisResult { … }
  ```

- **Result + diagnostics.** When the function may reject inputs, return both the accepted results and a diagnostics list (mirror `LapDetectionResult.rejected`):

  ```ts
  export interface MyAnalysisResult {
    items: MyItem[];
    rejected: MyRejection[];
  }
  ```

- **Errors.** Throw a typed `Error` subclass for unrecoverable input problems (e.g. `NoStartGateError`). Use plain `throw new Error(...)` for programmer errors.

## Numerical hygiene

- Round only at presentation/serialization boundaries. Analysis functions should return full-precision numbers.
- Suffix unit-bearing field names: `Ms`, `Kmh`, `M`, `G`, `DegSec`, `Deg`. Reviewers can spot unit mistakes faster.
- Use shared helpers in `src/util/rounding.ts` (`round1`, `round3`, `round7`) when serializing.

## File layout

```
src/analysis/
  <name>.ts                 # one analysis concern per file
tests/<name>.test.ts        # fixture-driven; reuse tests/fixtures/
src/sdk/analysis.ts         # add re-exports
```

## Tests

- Use the existing pattern (`tests/laps.test.ts`, `tests/lap-detail.test.ts`) — synthesize tiny `VboSample` arrays in equirectangular metres so geometry is deterministic.
- Cover at minimum: empty input, single-element input, the happy path, the rejection branch, the error branch.

## When to surface as a CLI flag

Most new analysis is exposed as part of an existing bundle (e.g. extending `LapDetail` or `SessionSummary`). You only need a new CLI subcommand when the result is large or stand-alone enough that piping it through `lapvisor session` would bloat the bundle.

Heuristics:

- If it's a small per-lap or per-session number → fold it into an existing bundle (likely a new bundle version).
- If it's a full new artifact (e.g. a heat map of speed vs distance) → consider a new subcommand and a new bundle version.

## PR checklist

- [ ] `src/analysis/<name>.ts` — pure function, options object, result type exported.
- [ ] `src/sdk/analysis.ts` — re-exports added.
- [ ] `tests/<name>.test.ts` — covers happy path, edge cases, errors.
- [ ] Tier-1 TSDoc on every exported symbol.
- [ ] If the function alters wire output, follow [`./bundle-version.md`](./bundle-version.md).
- [ ] `bun run lint && bun test && bun run build` green.
