import pc from "picocolors";
import type { SessionImprovementBundle } from "../../bundles/types.js";
import { formatLapTime } from "../../util/time.js";

export function printIdealBundle(bundle: SessionImprovementBundle): void {
  const { bestLap, idealLap, gapToIdealMs } = bundle;
  console.log(pc.bold(`Session: ${bundle.source.file}`));
  if (bundle.meta.venue) console.log(`Venue:    ${bundle.meta.venue}`);
  if (bundle.meta.trackName) console.log(`Track:    ${bundle.meta.trackName}`);
  console.log(`Laps:     ${bundle.lapCount}`);
  console.log(
    `Best:     ${pc.green(formatLapTime(bestLap.durationMs))}  (lap ${bestLap.index})`,
  );
  console.log(
    `Ideal:    ${pc.cyan(formatLapTime(idealLap.totalMs))}  (gap ${pc.yellow(formatGap(gapToIdealMs))})`,
  );

  if (gapToIdealMs <= 0) {
    console.log("\nYou put it together — best lap matches the ideal lap.");
    return;
  }

  const opportunities = idealLap.miniSectors
    .map((s) => ({
      sector: s,
      gapMs: s.bestLapDurationMs - s.durationMs,
    }))
    .filter((o) => o.gapMs > 0)
    .sort((a, b) => b.gapMs - a.gapMs)
    .slice(0, 5);

  if (opportunities.length === 0) return;

  console.log(`\n${pc.bold("Where the ideal lap pulls from:")}`);
  for (const o of opportunities) {
    const range = `${o.sector.dStart.toFixed(0)}–${o.sector.dEnd.toFixed(0)}m`;
    const idx = `${o.sector.index + 1}/${idealLap.miniSectorCount}`;
    console.log(
      `  Mini ${idx.padStart(7)}  ${pc.yellow(`+${formatGap(o.gapMs)}`)}  ` +
        `best from lap ${o.sector.sourceLapIndex}  (${range})`,
    );
  }
}

function formatGap(ms: number): string {
  const seconds = ms / 1000;
  return seconds >= 1 ? `${seconds.toFixed(2)}s` : `${Math.round(ms)}ms`;
}
