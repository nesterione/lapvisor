# 0002 — Track editor

**Status:** accepted (2026-05-08); migrated from `karting` to `lapvisor` 2026-05-08.
**Scope:** `lapvisor track edit` v1 — visual editor for `kart-track/v1`.

## Context

We can convert RaceChrono `.rcz` to our format
([ADR 0001](0001-track-format.md)) but couldn't fix or extend a track
without re-exporting from the RaceChrono app. Goal: edit gates, names,
bearing, width, S/F position, and add/delete traps from a map view.
Constraint: free, no API keys, agile MVP first.

## Decision

1. **Local web app** launched by `lapvisor track edit <file>` —
   Node `http` server on `localhost:5174`, auto-opens the browser, two
   endpoints (`GET /api/track`, `POST /api/track`).
2. **Leaflet** for the map (loaded from CDN, no key, ~40 KB).
3. **OSM by default + Esri World Imagery as a layer toggle.** Both
   free, no API key. Esri is the one that matters for aligning gates
   to real asphalt.
4. **No client build step.** Browser JS is kept as a string constant
   (`EDITOR_CLIENT_JS` in `src/track/edit/client.ts`) and inlined into
   the HTML at render time, so tsup bundles the whole CLI into a single
   Node-runnable `dist/index.js` with no extra asset files.
5. **Atomic save**: client `POST`s the FeatureCollection, server
   validates the schema tag, normalises geometry via
   `recomputeEndpoints` (defence in depth), writes to `<file>.tmp`
   then `rename` over the original. Same path the user opened — no
   ".edited" suffix surprise.
6. **Default port 5174** — distinct from karting's `kart report` (5173)
   so both can run side-by-side during a session-review workflow.
7. **`--readOnly` flag** that disables the POST handler and hides the
   Save button. For sharing a track with someone over a tunnel
   without giving them write access.

## Why a local http server, not a static page

Static drag-drop + download-to-save is simpler in lines of code, but
every save becomes a manual file-overwrite ritual. The local-server
approach is one click + Cmd-S and the file is written in place.

**Why Node `http`, not `Bun.serve`:** lapvisor publishes a Node bundle
(`tsup` → `dist/index.js`), so `Bun.serve` is unavailable to npm
consumers. Node `http` gives us the same one-route + JSON-body pattern
with no runtime branching.

## Why Leaflet, not MapLibre / OpenLayers

Leaflet wins on simplicity for what we need (tiles, polylines,
draggable markers, layer control). MapLibre's vector tiles look nicer
but require a style JSON and a vector tile source — more setup,
more deps, no win for a 100×100 m kart track. Easy to swap later if
we want vector rendering.

## Why no client build step

Editor is a few hundred lines of plain JS plus Leaflet from CDN.
Adding a separate browser bundler (esbuild, Vite) would buy us very
little and cost setup, watch mode, sourcemap config, and dist artefacts.
Keeping the client as a string constant in `client.ts` means tsup picks
it up as part of the main bundle — one artefact, one publish.

The trade-off: no TypeScript in the client. We mirror the math from
`src/track/geojson.ts` by hand (~25 lines). Acceptable; tested against
the same input file for round-trip stability.

## Why server-side `recomputeEndpoints` on save

Even though the client does it on every change, we recompute again on
the server. If the client is buggy or someone POSTs hand-crafted JSON
with stale geometry, the file on disk still has geometry that matches
its `properties` (`bearing_deg`, `width_m`, `center`). One source of
truth for the gate.

## Why the same port handler for read & write (no `--readOnly` second
binary)

`--readOnly` is a flag, not a separate command, because the read path
is identical. The flag short-circuits the POST handler and toggles
the Save button. Cheap to maintain.

## Consequences

- Future track-related browser features (e.g. `lapvisor track render`
  for laps + traces overlay) reuse the `src/track/edit/` server +
  template scaffolding.
- Schema discipline: every endpoint that writes the file checks
  `properties.schema === "kart-track/v1"`. Bumping to v2 means
  updating that check + the spec ([formats/kart-track-v1.md](../formats/kart-track-v1.md)).
- Editor state is in-memory only — there's no undo. Closing the tab
  before saving discards changes. We accept that for v1; undo is on
  the iteration ladder.

## Out of scope (deferred)

- Visual rotation / width handles (drag arrow tip, drag endpoint).
  v1 uses number inputs only.
- Undo / redo, multi-track editing, GPX overlay, RaceChrono export.
- Bundled (offline) Leaflet — currently CDN-only.
