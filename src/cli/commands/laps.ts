import { defineCommand } from "citty";
import pc from "picocolors";
import type { Session } from "../../model.js";
import { formatLapTime } from "../../util/time.js";

interface LapsSummary {
  source: string;
  format: Session["format"];
  lapCount: number;
  bestMs?: number;
  meanMs?: number;
}

export default defineCommand({
  meta: {
    name: "laps",
    description: "Summarize lap times from a session file.",
  },
  args: {
    input: {
      type: "positional",
      description: "Path to session file (CSV/GPX/FIT/TCX)",
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
    console.log(`Laps:    ${summary.lapCount}`);
    if (summary.bestMs !== undefined && summary.meanMs !== undefined) {
      console.log(`Best:    ${pc.green(formatLapTime(summary.bestMs))}`);
      console.log(`Mean:    ${formatLapTime(summary.meanMs)}`);
    }
  },
});

async function loadSession(_path: string): Promise<Session> {
  throw new Error("no adapter implemented yet — wire up src/adapters first");
}

function summarize(session: Session): LapsSummary {
  const durations = session.laps.map((l) => l.durationMs);
  if (durations.length === 0) {
    return { source: session.source, format: session.format, lapCount: 0 };
  }
  const bestMs = Math.min(...durations);
  const meanMs = Math.round(
    durations.reduce((a, b) => a + b, 0) / durations.length,
  );
  return {
    source: session.source,
    format: session.format,
    lapCount: durations.length,
    bestMs,
    meanMs,
  };
}
