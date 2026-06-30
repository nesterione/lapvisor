import pc from "picocolors";
import type { LapCompareBundle } from "../../bundles/types.js";
import { formatLapTime } from "../../util/time.js";

const SPARK = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

export function printCompareBundle(bundle: LapCompareBundle): void {
  const { reference: ref, candidate: cand, miniSectors, deltaT } = bundle;

  console.log(
    pc.bold(
      `Compare: lap ${ref.index} (ref, ${formatLapTime(ref.durationMs)}) vs lap ${cand.index} (${formatLapTime(cand.durationMs)})`,
    ),
  );
  if (bundle.meta.venue) console.log(`Venue:    ${bundle.meta.venue}`);
  if (bundle.meta.trackName) console.log(`Track:    ${bundle.meta.trackName}`);
  const totalLine = `Total:    ${signedDelta(bundle.totalDeltaMs)}`;
  console.log(totalLine);
  if (deltaT.coverage < 1) {
    console.log(
      pc.dim(
        `Coverage: ${(deltaT.coverage * 100).toFixed(0)}% (laps differ in driven distance)`,
      ),
    );
  }

  // Top gain (candidate ahead) and top loss (candidate behind).
  const ranked = [...miniSectors].sort((a, b) => a.deltaMs - b.deltaMs);
  const gains = ranked.slice(0, 5).filter((m) => m.deltaMs < 0);
  const losses = [...miniSectors]
    .sort((a, b) => b.deltaMs - a.deltaMs)
    .slice(0, 5)
    .filter((m) => m.deltaMs > 0);

  const total = bundle.miniSectorCount;
  if (gains.length > 0) {
    console.log(`\n${pc.bold("Where the candidate gained:")}`);
    for (const m of gains) printRow(m, total, true);
  }
  if (losses.length > 0) {
    console.log(`\n${pc.bold("Where the candidate lost:")}`);
    for (const m of losses) printRow(m, total, false);
  }

  if (deltaT.deltaTMs.length > 0) {
    console.log(`\n${pc.dim("Delta-t curve (start → finish):")}`);
    console.log(`  ${spark(deltaT.deltaTMs)}`);
    console.log(
      pc.dim(
        `  min ${signedDelta(Math.min(...deltaT.deltaTMs))}, ` +
          `max ${signedDelta(Math.max(...deltaT.deltaTMs))}, ` +
          `end ${signedDelta(deltaT.deltaTMs[deltaT.deltaTMs.length - 1] ?? 0)}`,
      ),
    );
  }

  if (bundle.corners && bundle.corners.length > 0) {
    console.log(`\n${pc.bold("Per-corner deltas (ref-lap corners):")}`);
    for (const c of bundle.corners) {
      const delta = signedDelta(c.deltaMs);
      const apex =
        c.deltaMinKmh === 0
          ? "apex match"
          : c.deltaMinKmh > 0
            ? `apex +${c.deltaMinKmh.toFixed(1)} km/h`
            : `apex ${c.deltaMinKmh.toFixed(1)} km/h`;
      const colored =
        c.deltaMs < 0
          ? pc.green(delta)
          : c.deltaMs > 0
            ? pc.yellow(delta)
            : pc.dim(delta);
      console.log(
        `  T${String(c.index).padStart(2)}  ${colored}  ${apex}  (${c.dEntry.toFixed(0)}–${c.dExit.toFixed(0)}m)`,
      );
    }
  }
}

function printRow(
  m: { index: number; dStart: number; dEnd: number; deltaMs: number },
  total: number,
  gain: boolean,
): void {
  const idx = `${m.index + 1}/${total}`.padStart(7);
  const range = `${m.dStart.toFixed(0)}–${m.dEnd.toFixed(0)}m`;
  const delta = signedDelta(m.deltaMs);
  console.log(
    `  Mini ${idx}  ${gain ? pc.green(delta) : pc.yellow(delta)}  (${range})`,
  );
}

function signedDelta(ms: number): string {
  const sign = ms > 0 ? "+" : ms < 0 ? "-" : "±";
  const abs = Math.abs(ms);
  const seconds = abs / 1000;
  const body = seconds >= 1 ? `${seconds.toFixed(2)}s` : `${Math.round(abs)}ms`;
  return `${sign}${body}`;
}

function spark(values: number[]): string {
  if (values.length === 0) return "";
  let min = values[0] ?? 0;
  let max = values[0] ?? 0;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min || 1;
  let out = "";
  for (const v of values) {
    const f = (v - min) / span;
    let bin = Math.floor(f * SPARK.length);
    if (bin >= SPARK.length) bin = SPARK.length - 1;
    if (bin < 0) bin = 0;
    out += SPARK[bin];
  }
  return out;
}
