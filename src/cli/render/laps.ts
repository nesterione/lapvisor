import pc from "picocolors";
import type { LapsSummary } from "../../bundles/types.js";
import type { Session } from "../../model.js";
import { formatLapTime } from "../../util/time.js";

export function printLapsSummary(session: Session, summary: LapsSummary): void {
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
}
