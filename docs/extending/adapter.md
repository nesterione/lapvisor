# Adding a new adapter

An adapter reads a telemetry file format and normalises it into the canonical `Session` shape. Today only VBO is implemented; GPX, FIT (Garmin), TCX, and lap-CSV are planned.

This guide describes how to add one. Use `src/adapters/vbo.ts` as the reference implementation.

## 1. Understand the contracts

The adapter must produce two things:

- **A pure parser** — `parse<Format>(text, source?) → <Format>File`. Pure means: takes a string in, returns an object out. No file I/O, no `console.log`, no `process.exit`. Browser-safe.
- **A `Session` mapping** — given the parsed object, produce a `Session` (`lapvisor/model`). Drop into the dispatch in `src/adapters/index.ts`.

`Session` is the type any analysis function speaks. See [`src/model.ts`](../../src/model.ts) for the exact shape: `source`, `format`, `laps[]`, optional `meta`. A `Lap` is `{ index, durationMs, startMs? }` — the minimum needed for `lapvisor laps` style summaries.

## 2. File layout

```
src/adapters/
  <format>.ts         # parse<Format>(text), the format's typed objects, error class
src/sdk/adapters.ts   # add: re-export the new public surface (parser, types, errors)
```

The dispatch entry sits in `src/adapters/index.ts`:

1. Add `"<format>"` to `SessionFormat` in `src/model.ts`.
2. Add a case to the `switch (format)` inside `loadSessionFromText`.
3. Add the file extension to `extensionToFormat` (the path → format mapper).

## 3. Reference walkthrough — VBO

`src/adapters/vbo.ts` exports:

- `parseVbo(text, source?) → VboFile` — pure parser.
- Typed shapes: `VboFile`, `VboSample`, `VboGate`, `LatLng`.
- `VboParseError` for structured failures.
- `decodeVboCoord`, `decodeVboTime` — helpers for upstream tools.

`src/adapters/index.ts` then has a tiny `vboTextToSession(text, source, opts)` that wraps `parseVbo` + `detectLaps` and returns a `Session`. This is the pattern for every adapter — keep the parser pure; do `Session` mapping in `index.ts`.

## 4. Fixtures and tests

- Put a small (~50 KB max) sample under `tests/fixtures/<format>/sample.<ext>`.
- Add `tests/<format>.test.ts` covering: round-trip, malformed input → error class, channel-absence handling, midnight/timestamp rollover (when applicable).
- Extend `tests/adapters.test.ts` with a `loadSession` case for the new extension.

## 5. Documentation

Every adapter ships with:

- A wire-format spec at `docs/formats/<format>.md`. Describe the file structure and how it maps to `Session`.
- A row in the README's adapter table.
- TSDoc on every exported symbol of the new module (Tier 1 — see [`../sdk/stability.md`](../sdk/stability.md)).

## 6. PR checklist

- [ ] `src/adapters/<format>.ts` — pure parser, no I/O.
- [ ] `src/model.ts` — `SessionFormat` updated.
- [ ] `src/adapters/index.ts` — dispatch case added in both `extensionToFormat` and `loadSessionFromText`.
- [ ] `src/sdk/adapters.ts` — re-exports added.
- [ ] `tests/<format>.test.ts` — pure-parser tests.
- [ ] `tests/adapters.test.ts` — `loadSession` case extended.
- [ ] `tests/fixtures/<format>/` — small sample committed.
- [ ] `docs/formats/<format>.md` — wire-format spec.
- [ ] `README.md` — adapter table row.
- [ ] Tier-1 TSDoc on all new public exports.
- [ ] `bun run lint && bun test && bun run build` green.
