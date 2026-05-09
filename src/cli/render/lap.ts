import pc from "picocolors";
import type { LapBundle } from "../../bundles/types.js";
import { formatLapTime } from "../../util/time.js";

export function printLapBundle(bundle: LapBundle): void {
  console.log(
    pc.bold(
      `Lap ${bundle.lap.index} — ${formatLapTime(bundle.lap.durationMs)}`,
    ),
  );
  if (bundle.meta.venue) console.log(`Venue:    ${bundle.meta.venue}`);
  if (bundle.meta.trackName) console.log(`Track:    ${bundle.meta.trackName}`);
  console.log(`Distance: ${bundle.lap.distanceM.toFixed(1)} m`);
  console.log(`Samples:  ${bundle.samples.length}`);
  console.log(`Sectors:  ${bundle.sectors.length}`);
  console.log(
    `Speed:    ${pc.green(`${bundle.aggregates.topSpeedKmh.toFixed(1)} km/h max`)}, ${bundle.aggregates.minSpeedKmh.toFixed(1)} km/h min`,
  );
  if (bundle.aggregates.peakLatG > 0) {
    console.log(
      `Peak G:   lat ${bundle.aggregates.peakLatG.toFixed(2)}, brake ${bundle.aggregates.peakLongGBrake.toFixed(2)}, accel ${bundle.aggregates.peakLongGAccel.toFixed(2)}`,
    );
  }
}
