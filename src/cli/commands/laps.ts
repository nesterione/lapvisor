import { defineCommand } from "citty";
import pc from "picocolors";
import { loadSession } from "../../adapters/index.js";
import type { Session } from "../../model.js";
import { formatLapTime } from "../../util/time.js";

interface LapsSummary {
  source: string;
  format: Session["format"];
  lapCount: number;
  bestMs?: number;
  meanMs?: number;
  meta?: Session["meta"];
}

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
    const summary = summarize(session);

    const useJson = args.json || !process.stdout.isTTY;
    if (useJson) {
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
      return;
    }

    console.log(pc.bold(`Session: ${session.source}`));
    console.log(`Format:  ${session.format}`);
    if (session.meta?.venue) console.log(`Venue:   ${session.meta.venue}`);
    if (session.meta?.startedAt)
      console.log(`Started: ${session.meta.startedAt}`);
    console.log(`Laps:    ${summary.lapCount}`);
    if (summary.bestMs !== undefined && summary.meanMs !== undefined) {
      console.log(`Best:    ${pc.green(formatLapTime(summary.bestMs))}`);
      console.log(`Mean:    ${formatLapTime(summary.meanMs)}`);
    }
  },
});

function summarize(session: Session): LapsSummary {
  const durations = session.laps.map((l) => l.durationMs);
  const base: LapsSummary = {
    source: session.source,
    format: session.format,
    lapCount: durations.length,
    meta: session.meta,
  };
  if (durations.length === 0) return base;
  base.bestMs = Math.min(...durations);
  base.meanMs = Math.round(
    durations.reduce((a, b) => a + b, 0) / durations.length,
  );
  return base;
}
