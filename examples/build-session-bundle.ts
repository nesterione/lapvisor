/**
 * Produce a `lapvisor-session/v2` bundle programmatically — the same artifact
 * the CLI emits for `lapvisor session <file> --track <track>`.
 *
 * SDK surface: `lapvisor/adapters` (`parseVbo`), `lapvisor/track`
 * (`loadKartTrack`), `lapvisor/bundles` (`buildSessionBundle`).
 *
 * Run from this repo:
 *   bun run examples/build-session-bundle.ts samples/<session>.vbo samples/<track>.json
 *
 * In a consuming project:
 *   import { parseVbo } from "lapvisor/adapters";
 *   import { loadKartTrack } from "lapvisor/track";
 *   import { buildSessionBundle } from "lapvisor/bundles";
 */

import { readFile } from "node:fs/promises";
import { parseVbo } from "../src/sdk/adapters.js";
import { buildSessionBundle } from "../src/sdk/bundles.js";
import { loadKartTrack } from "../src/sdk/track.js";

export async function buildSessionBundleExample(
  sessionPath: string,
  trackPath?: string,
) {
  const text = await readFile(sessionPath, "utf8");
  const vboFile = parseVbo(text, sessionPath);
  const track = trackPath ? await loadKartTrack(trackPath) : null;
  return buildSessionBundle({
    source: { file: sessionPath, format: "vbo" },
    vboFile,
    track,
  });
}

if (import.meta.main) {
  const [, , sessionArg, trackArg] = process.argv;
  if (!sessionArg) {
    console.error(
      "usage: bun run examples/build-session-bundle.ts <session.vbo> [track.json]",
    );
    process.exit(1);
  }
  const bundle = await buildSessionBundleExample(sessionArg, trackArg);
  console.log(JSON.stringify(bundle, null, 2));
}
