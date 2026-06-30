/**
 * `lapvisor compare` — emit a `lapvisor-lap-compare/v1` bundle that shows where
 * a candidate lap gained or lost time vs a reference lap from the same session.
 * Bundle producer: `src/bundles/lap-compare-v1.ts`. Human formatter:
 * `src/cli/render/compare.ts`.
 */

import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { defineCommand } from "citty";
import { parseVbo } from "../../adapters/vbo.js";
import { buildLapComparisonBundle } from "../../bundles/lap-compare-v1.js";
import { loadKartTrack } from "../../track/loader.js";
import type { KartTrack } from "../../track/types.js";
import { printCompareBundle } from "../render/compare.js";

export default defineCommand({
  meta: {
    name: "compare",
    description:
      "Compare two laps in the same session: delta-t curve + per-mini-sector deltas.",
  },
  args: {
    input: {
      type: "positional",
      description: "Path to session file (.vbo)",
      required: true,
    },
    ref: {
      type: "positional",
      description: "1-based reference (baseline) lap index",
      required: true,
    },
    candidate: {
      type: "positional",
      description:
        "1-based candidate lap index (the lap whose loss/gain you want)",
      required: true,
    },
    track: {
      type: "string",
      description:
        "Path to a kart-track/v1 GeoJSON file. When set, overrides any gates in the session file.",
    },
    "mini-sectors": {
      type: "string",
      description:
        "Number of equal-distance mini-sectors per lap. Default 100.",
    },
    corners: {
      type: "boolean",
      description:
        "Include per-corner deltas (auto-detected from speed minima on the reference lap).",
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
        `unsupported file format "${ext || "<no extension>"}" — compare currently supports .vbo only`,
      );
    }

    const refLapIndex = parseLapIndex(args.ref, "reference");
    const candidateLapIndex = parseLapIndex(args.candidate, "candidate");
    if (refLapIndex === candidateLapIndex) {
      throw new Error("reference and candidate lap indices must differ");
    }
    const miniSectorCount = parseMiniSectors(args["mini-sectors"]);

    const text = await readFile(args.input, "utf8");
    const vboFile = parseVbo(text, args.input);

    let track: KartTrack | null = null;
    if (args.track) track = await loadKartTrack(args.track);

    const bundle = buildLapComparisonBundle({
      source: { file: args.input, format: "vbo" },
      vboFile,
      refLapIndex,
      candidateLapIndex,
      track,
      miniSectorCount,
      includeCorners: args.corners,
    });

    const useJson = args.json || !process.stdout.isTTY;
    if (useJson) {
      process.stdout.write(`${JSON.stringify(bundle)}\n`);
      return;
    }
    printCompareBundle(bundle);
  },
});

function parseLapIndex(raw: string, label: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(
      `${label} lap index must be a positive integer, got "${raw}"`,
    );
  }
  return n;
}

function parseMiniSectors(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 2 || n > 10_000) {
    throw new Error(
      `--mini-sectors must be an integer between 2 and 10000, got "${raw}"`,
    );
  }
  return n;
}
