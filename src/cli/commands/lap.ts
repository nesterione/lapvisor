/**
 * `lapvisor lap` — emit a `lapvisor-lap/v1` JSON bundle for a single lap.
 * Bundle producer: `src/bundles/lap-v1.ts`. Human formatter: `src/cli/render/lap.ts`.
 */

import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { defineCommand } from "citty";
import { parseVbo } from "../../adapters/vbo.js";
import { buildLapBundle } from "../../bundles/lap-v1.js";
import { loadKartTrack } from "../../track/loader.js";
import type { KartTrack } from "../../track/types.js";
import { printLapBundle } from "../render/lap.js";

export default defineCommand({
  meta: {
    name: "lap",
    description:
      "Emit one lap as a `lapvisor-lap/v1` JSON bundle (rich telemetry + distance + sectors).",
  },
  args: {
    input: {
      type: "positional",
      description: "Path to session file (.vbo)",
      required: true,
    },
    index: {
      type: "positional",
      description: "1-based lap index",
      required: true,
    },
    track: {
      type: "string",
      description:
        "Path to a kart-track/v1 GeoJSON file. When set, overrides any gates in the session file.",
    },
    json: {
      type: "boolean",
      description: "Force JSON output even when stdout is a TTY",
    },
  },
  async run({ args }) {
    const ext = extname(args.input).toLowerCase();
    if (ext !== ".vbo") {
      throw new Error(
        `unsupported file format "${ext || "<no extension>"}" — lap currently supports .vbo only`,
      );
    }

    const lapIndex = Number(args.index);
    if (!Number.isInteger(lapIndex) || lapIndex < 1) {
      throw new Error(
        `lap index must be a positive integer, got "${args.index}"`,
      );
    }

    const text = await readFile(args.input, "utf8");
    const vboFile = parseVbo(text, args.input);

    let track: KartTrack | null = null;
    if (args.track) track = await loadKartTrack(args.track);

    const bundle = buildLapBundle({
      source: { file: args.input, format: "vbo" },
      vboFile,
      lapIndex,
      track,
    });

    const useJson = args.json || !process.stdout.isTTY;
    if (useJson) {
      process.stdout.write(`${JSON.stringify(bundle)}\n`);
      return;
    }
    printLapBundle(bundle);
  },
});
