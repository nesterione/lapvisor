/**
 * Produce a `lapvisor-lap/v1` bundle for a single lap — the same artifact the
 * CLI emits for `lapvisor lap <file> <index>`.
 *
 * SDK surface: `lapvisor/adapters` (`parseVbo`), `lapvisor/track`
 * (`loadKartTrack`), `lapvisor/bundles` (`buildLapBundle`).
 *
 * Run from this repo:
 *   bun run examples/build-lap-bundle.ts samples/<session>.vbo 3 [samples/<track>.json]
 */

import { readFile } from "node:fs/promises";
import { parseVbo } from "../src/sdk/adapters.js";
import { buildLapBundle } from "../src/sdk/bundles.js";
import { loadKartTrack } from "../src/sdk/track.js";

export async function buildLapBundleExample(
  sessionPath: string,
  lapIndex: number,
  trackPath?: string,
) {
  const text = await readFile(sessionPath, "utf8");
  const vboFile = parseVbo(text, sessionPath);
  const track = trackPath ? await loadKartTrack(trackPath) : null;
  return buildLapBundle({
    source: { file: sessionPath, format: "vbo" },
    vboFile,
    lapIndex,
    track,
  });
}

if (import.meta.main) {
  const [, , sessionArg, indexArg, trackArg] = process.argv;
  if (!sessionArg || !indexArg) {
    console.error(
      "usage: bun run examples/build-lap-bundle.ts <session.vbo> <lap-index> [track.json]",
    );
    process.exit(1);
  }
  const bundle = await buildLapBundleExample(
    sessionArg,
    Number(indexArg),
    trackArg,
  );
  console.log(JSON.stringify(bundle, null, 2));
}
