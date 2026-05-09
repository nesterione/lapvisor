import { defineCommand } from "citty";
import { loadSession } from "../../adapters/index.js";
import { buildLapsSummary } from "../../bundles/laps-summary.js";
import { printLapsSummary } from "../render/laps.js";

export default defineCommand({
  meta: {
    name: "laps",
    description: "Summarize lap times from a session file.",
  },
  args: {
    input: {
      type: "positional",
      description: "Path to session file (.vbo; .gpx/.fit/.tcx/.csv planned)",
      required: true,
    },
    json: {
      type: "boolean",
      description: "Emit JSON instead of human-readable output",
    },
  },
  async run({ args }) {
    const session = await loadSession(args.input);
    const summary = buildLapsSummary(session);

    const useJson = args.json || !process.stdout.isTTY;
    if (useJson) {
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
      return;
    }
    printLapsSummary(session, summary);
  },
});
