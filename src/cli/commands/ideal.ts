/**
 * `lapvisor ideal` — emit a `lapvisor-session-improvement/v1` bundle showing
 * the best-of-each-mini-sector "ideal lap" alongside the actual best lap.
 * Bundle producer: `src/bundles/session-improvement-v1.ts`. Human formatter:
 * `src/cli/render/ideal.ts`.
 */

import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { defineCommand } from "citty";
import { parseVbo } from "../../adapters/vbo.js";
import { buildSessionImprovementBundle } from "../../bundles/session-improvement-v1.js";
import { loadKartTrack } from "../../track/loader.js";
import type { KartTrack } from "../../track/types.js";
import { printIdealBundle } from "../render/ideal.js";

export default defineCommand({
  meta: {
    name: "ideal",
    description:
      "Show the best-of-each-mini-sector ideal lap and the gap to your actual best lap.",
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
    "mini-sectors": {
      type: "string",
      description:
        "Number of equal-distance mini-sectors per lap. Default 100.",
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
        `unsupported file format "${ext || "<no extension>"}" — ideal currently supports .vbo only`,
      );
    }

    const miniSectorCount = parseMiniSectors(args["mini-sectors"]);

    const text = await readFile(args.input, "utf8");
    const vboFile = parseVbo(text, args.input);

    let track: KartTrack | null = null;
    if (args.track) track = await loadKartTrack(args.track);

    const bundle = buildSessionImprovementBundle({
      source: { file: args.input, format: "vbo" },
      vboFile,
      track,
      miniSectorCount,
    });

    const useJson = args.json || !process.stdout.isTTY;
    if (useJson) {
      process.stdout.write(`${JSON.stringify(bundle)}\n`);
      return;
    }
    printIdealBundle(bundle);
  },
});

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
