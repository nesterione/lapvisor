# SDK Quick Start

Install:

```sh
npm install lapvisor
```

## Load a session

```ts
import { loadSession } from "lapvisor/adapters";

const session = await loadSession("path/to/session.vbo");
console.log(session.laps.length, "laps in", session.meta?.venue);
```

`loadSession` resolves the format from the file extension and returns the canonical `Session` shape (`lapvisor/model`).

## Build a session bundle (the same artifact `lapvisor session` emits)

```ts
import { parseVbo } from "lapvisor/adapters";
import { loadKartTrack } from "lapvisor/track";
import { buildSessionBundle } from "lapvisor/bundles";
import { readFile } from "node:fs/promises";

const text = await readFile("session.vbo", "utf8");
const vboFile = parseVbo(text, "session.vbo");
const track = await loadKartTrack("track.json"); // optional, overrides VBO gates

const bundle = buildSessionBundle({
  source: { file: "session.vbo", format: "vbo" },
  vboFile,
  track,
});

console.log(bundle.schema); // "lapvisor-session/v2"
console.log(bundle.lapSummaries.length, "laps");
```

The `bundle` is the same JSON the CLI writes to stdout for `lapvisor session session.vbo --track track.json` — pin clients to the schema string.

## Browser-safe variant

`loadSession` reads from disk. In the browser, fetch bytes yourself and use the pure parsers:

```ts
import { loadSessionFromText } from "lapvisor/adapters";

const text = await fetch("/data/session.vbo").then((r) => r.text());
const session = loadSessionFromText(text, "vbo", { source: "session.vbo" });
```

The same applies for tracks: `parseKartTrack(text)` instead of `loadKartTrack(path)`.

## Build a custom track

```ts
import { buildKartTrack, kartTrackIntentSchema } from "lapvisor/track";

const intent = kartTrackIntentSchema.parse(rawIntent); // validate at the boundary
const track = buildKartTrack(intent);
```

`intent` describes gates by `(center, bearing_deg, width_m)`; lapvisor computes the LineString endpoints. Output conforms to [`kart-track/v1`](../formats/kart-track-v1.md).

## More

Runnable variants of every snippet here live in [`/examples/`](../../examples/).
