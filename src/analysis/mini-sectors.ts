/**
 * Mini-sector segmentation: chop a lap into N equal-distance bins so time loss
 * is localizable without hand-drawn sector gates. Each lap is divided into
 * `count` proportional slices of its own total distance — i.e. mini-sector
 * `i` covers `[i/count * lapDistance, (i+1)/count * lapDistance]`. Proportional
 * bucketing (vs. absolute metres) lets two laps with slightly different driven
 * distances be compared at the same *position on track*.
 *
 * Pure.
 */

import { round1 } from "../util/rounding.js";
import type { RichSample } from "./lap-detail.js";
import { resampleByDistance } from "./resample.js";

export interface MiniSector {
  /** 0-based mini-sector index. */
  index: number;
  /** Distance at start of this mini-sector, in metres from lap start. */
  dStart: number;
  /** Distance at end of this mini-sector, in metres from lap start. */
  dEnd: number;
  /** Time spent inside this mini-sector, in milliseconds. */
  durationMs: number;
  /** Minimum velocity (km/h) sampled inside this mini-sector. */
  vMin: number;
  /** Maximum velocity (km/h) sampled inside this mini-sector. */
  vMax: number;
}

export interface BuildMiniSectorsOptions {
  /** Number of equal-distance bins per lap. Default 100. */
  count?: number;
}

/**
 * Build N equal-distance mini-sectors for one lap.
 *
 * @param samples - Lap samples in source order with `d` (cumulative distance) attached.
 * @param opts - Bin count.
 * @returns One entry per mini-sector. Empty array when the lap has no distance.
 */
export function buildMiniSectors(
  samples: ReadonlyArray<RichSample>,
  opts: BuildMiniSectorsOptions = {},
): MiniSector[] {
  const count = Math.max(1, Math.floor(opts.count ?? 100));
  const last = samples[samples.length - 1];
  if (samples.length < 2 || !last || last.d <= 0) return [];

  const lapDistance = last.d;
  const step = lapDistance / count;

  const grid = resampleByDistance(samples, {
    count: count + 1,
    maxDistanceM: lapDistance,
  });

  const vMins = new Array<number>(count).fill(Number.POSITIVE_INFINITY);
  const vMaxs = new Array<number>(count).fill(Number.NEGATIVE_INFINITY);
  for (const s of samples) {
    if (s.d < 0 || s.d > lapDistance) continue;
    let idx = Math.floor(s.d / step);
    if (idx >= count) idx = count - 1;
    if (idx < 0) idx = 0;
    const cMin = vMins[idx];
    const cMax = vMaxs[idx];
    if (cMin === undefined || s.v < cMin) vMins[idx] = s.v;
    if (cMax === undefined || s.v > cMax) vMaxs[idx] = s.v;
  }

  const out: MiniSector[] = [];
  for (let i = 0; i < count; i++) {
    const t0 = grid.samples[i]?.t ?? 0;
    const t1 = grid.samples[i + 1]?.t ?? t0;
    const fallbackV = grid.samples[i]?.v ?? 0;
    const vMin = vMins[i];
    const vMax = vMaxs[i];
    out.push({
      index: i,
      dStart: round1(i * step),
      dEnd: round1((i + 1) * step),
      durationMs: Math.max(0, Math.round(t1 - t0)),
      vMin: round1(
        vMin === undefined || !Number.isFinite(vMin) ? fallbackV : vMin,
      ),
      vMax: round1(
        vMax === undefined || !Number.isFinite(vMax) ? fallbackV : vMax,
      ),
    });
  }
  return out;
}

export interface IdealMiniSector {
  /** 0-based mini-sector index (proportional position on the lap). */
  index: number;
  /** 1-based lap index whose split at this mini-sector was the fastest. */
  sourceLapIndex: number;
  /** Best per-lap duration for this mini-sector, in milliseconds. */
  durationMs: number;
}

export interface IdealLap {
  /** Total time of the best-of-each-mini-sector lap, in milliseconds. */
  totalMs: number;
  /** Number of mini-sectors composing this ideal lap. */
  miniSectorCount: number;
  miniSectors: IdealMiniSector[];
}

export interface LapMiniSectors {
  /** 1-based lap index. */
  lapIndex: number;
  miniSectors: MiniSector[];
}

/**
 * Pick the fastest mini-sector at each position across the session and sum
 * them into an "ideal lap" — the lap you have already proven you are capable
 * of, but never put together in one go.
 *
 * @param laps - Per-lap mini-sectors (same `count` for every lap).
 * @returns The composed ideal lap, or `null` when no laps are provided or
 *   counts disagree.
 */
export function bestMiniSectorsAcrossSession(
  laps: ReadonlyArray<LapMiniSectors>,
): IdealLap | null {
  if (laps.length === 0) return null;
  const first = laps[0];
  if (!first) return null;
  const count = first.miniSectors.length;
  if (count === 0) return null;
  for (const lap of laps) {
    if (lap.miniSectors.length !== count) return null;
  }

  const out: IdealMiniSector[] = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    let bestLap = first.lapIndex;
    let bestMs = Number.POSITIVE_INFINITY;
    for (const lap of laps) {
      const seg = lap.miniSectors[i];
      if (!seg) continue;
      if (seg.durationMs < bestMs) {
        bestMs = seg.durationMs;
        bestLap = lap.lapIndex;
      }
    }
    if (!Number.isFinite(bestMs)) return null;
    total += bestMs;
    out.push({ index: i, sourceLapIndex: bestLap, durationMs: bestMs });
  }
  return { totalMs: total, miniSectorCount: count, miniSectors: out };
}
