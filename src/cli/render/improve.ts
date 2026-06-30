import pc from "picocolors";
import type { SessionImprovementBundle } from "../../bundles/types.js";
import { formatLapTime } from "../../util/time.js";

export function printImproveBundle(bundle: SessionImprovementBundle): void {
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

  const opps = bundle.topOpportunities ?? [];
  if (opps.length === 0) {
    if (gapToIdealMs <= 0) {
      console.log("\nYou put it together — best lap matches the ideal lap.");
    } else {
      console.log(
        "\nNo named corner opportunities — the gap to ideal is spread thin across the lap.",
      );
    }
    return;
  }

  console.log(`\n${pc.bold("Where you can find time:")}`);
  for (const o of opps) {
    const range = `${o.dEntry.toFixed(0)}–${o.dExit.toFixed(0)}m`;
    const headline =
      `  Corner ${String(o.cornerIndex).padStart(2)}  ` +
      `${pc.yellow(`+${formatGap(o.deltaMs)}`)}  ` +
      `apex ${o.bestApexKmh.toFixed(0)} km/h vs ${o.fastestApexKmh.toFixed(0)} km/h on lap ${o.fastestLapIndex}  ` +
      pc.dim(`(${range})`);
    console.log(headline);
    for (const obs of o.observations) {
      console.log(`              ${pc.dim("→")} ${obs}`);
    }
  }
}

function formatGap(ms: number): string {
  const seconds = ms / 1000;
  return seconds >= 1 ? `${seconds.toFixed(2)}s` : `${Math.round(ms)}ms`;
}
