/**
 * `lapvisor session` — emit a `lapvisor-session/v2` JSON bundle (samples +
 * laps + sector splits + per-lap summaries + session summary + gates). The
 * bundle producer lives in `src/bundles/session-v2.ts`; this file is a thin
 * CLI wrapper (parse args → call producer → write JSON).
 */

import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { defineCommand } from "citty";
import { parseVbo } from "../../adapters/vbo.js";
import { buildSessionBundle } from "../../bundles/session-v2.js";
import { loadKartTrack } from "../../track/loader.js";
import type { KartTrack } from "../../track/types.js";

export default defineCommand({
  meta: {
    name: "session",
    description:
      "Emit a session render bundle (samples + laps + sectors + gates) as JSON.",
  },
  args: {
    input: {
      type: "positional",
      description: "Path to session file (.vbo)",
      required: true,
    },
    track: {
      type: "string",
      description:
        "Path to a kart-track/v1 GeoJSON file. When set, overrides any gates in the session file.",
    },
  },
  async run({ args }) {
    const ext = extname(args.input).toLowerCase();
    if (ext !== ".vbo") {
      throw new Error(
        `unsupported file format "${ext || "<no extension>"}" — session currently supports .vbo only`,
      );
    }

    const text = await readFile(args.input, "utf8");
    const vboFile = parseVbo(text, args.input);

    let track: KartTrack | null = null;
    if (args.track) track = await loadKartTrack(args.track);

    const bundle = buildSessionBundle({
      source: { file: args.input, format: "vbo" },
      vboFile,
      track,
    });

    process.stdout.write(`${JSON.stringify(bundle)}\n`);
  },
});
