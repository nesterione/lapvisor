/**
 * `lapvisor improve` — the headline session-level command. Composes the same
 * `lapvisor-session-improvement/v1` bundle as `lapvisor ideal`, but with
 * `topOpportunities[]` attached: ranked, named corner-level "what to do
 * differently next time" entries.
 *
 * Bundle producer: `src/bundles/session-improvement-v1.ts`. Human formatter:
 * `src/cli/render/improve.ts`.
 */

import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { defineCommand } from "citty";
import { parseVbo } from "../../adapters/vbo.js";
import { buildSessionImprovementBundle } from "../../bundles/session-improvement-v1.js";
import { loadKartTrack } from "../../track/loader.js";
import type { KartTrack } from "../../track/types.js";
import { printImproveBundle } from "../render/improve.js";

export default defineCommand({
  meta: {
    name: "improve",
    description:
      "Where am I losing time across this session — ranked corner-level opportunities and ideal lap.",
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
    top: {
      type: "string",
      description: "Max corner opportunities to surface. Default 5.",
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
        `unsupported file format "${ext || "<no extension>"}" — improve currently supports .vbo only`,
      );
    }

    const miniSectorCount = parsePositiveInt(
      args["mini-sectors"],
      "--mini-sectors",
      2,
      10_000,
    );
    const maxOpportunities = parsePositiveInt(args.top, "--top", 1, 50);

    const text = await readFile(args.input, "utf8");
    const vboFile = parseVbo(text, args.input);

    let track: KartTrack | null = null;
    if (args.track) track = await loadKartTrack(args.track);

    const bundle = buildSessionImprovementBundle({
      source: { file: args.input, format: "vbo" },
      vboFile,
      track,
      miniSectorCount,
      includeOpportunities: true,
      maxOpportunities,
    });

    const useJson = args.json || !process.stdout.isTTY;
    if (useJson) {
      process.stdout.write(`${JSON.stringify(bundle)}\n`);
      return;
    }
    printImproveBundle(bundle);
  },
});

function parsePositiveInt(
  raw: string | undefined,
  label: string,
  min: number,
  max: number,
): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(
      `${label} must be an integer between ${min} and ${max}, got "${raw}"`,
    );
  }
  return n;
}
