/**
 * Per-corner comparison: given corners detected on a reference lap, compute
 * how a candidate lap performed through the same corners — time delta, apex
 * speed delta, peak braking delta. Mappings between laps are proportional to
 * each lap's own total distance, matching the mini-sector convention.
 *
 * Pure.
 */

import type { Corner } from "../analysis/corners.js";
import type { RichSample } from "../analysis/lap-detail.js";
import { round1 } from "../util/rounding.js";

export interface CornerComparison {
  /** 1-based corner index from the reference lap. */
  index: number;
  /** Distance window on the reference lap. */
  dEntry: number;
  dApex: number;
  dExit: number;
  /** Time taken between entry and exit on the reference lap (ms). */
  refMs: number;
  /** Time taken between the proportional entry/exit positions on the candidate lap (ms). */
  candMs: number;
  /** `candMs - refMs`. Negative ⇒ candidate quicker through the corner. */
  deltaMs: number;
  /** Reference lap apex speed (km/h). */
  refMinKmh: number;
  /** Candidate lap minimum speed in the proportional corner region (km/h). */
  candMinKmh: number;
  /** `candMinKmh - refMinKmh`. Positive ⇒ more apex speed on candidate. */
  deltaMinKmh: number;
}

/**
 * Compare a candidate lap against the corners detected on a reference lap.
 *
 * @param refCorners - Corners detected on the reference lap (e.g. from `detectCorners`).
 * @param refSamples - The reference lap samples.
 * @param candidateSamples - The candidate lap samples.
 * @returns One {@link CornerComparison} per reference-lap corner.
 */
export function compareCorners(
  refCorners: ReadonlyArray<Corner>,
  refSamples: ReadonlyArray<RichSample>,
  candidateSamples: ReadonlyArray<RichSample>,
): CornerComparison[] {
  const refTotal = refSamples[refSamples.length - 1]?.d ?? 0;
  const candTotal = candidateSamples[candidateSamples.length - 1]?.d ?? 0;
  if (refTotal <= 0 || candTotal <= 0) return [];
  const scale = candTotal / refTotal;

  const out: CornerComparison[] = [];
  for (const corner of refCorners) {
    const refEntryT = timeAtDistance(refSamples, corner.dEntry);
    const refExitT = timeAtDistance(refSamples, corner.dExit);
    const candEntryT = timeAtDistance(candidateSamples, corner.dEntry * scale);
    const candExitT = timeAtDistance(candidateSamples, corner.dExit * scale);
    const refMs = refExitT - refEntryT;
    const candMs = candExitT - candEntryT;
    const candMin = minSpeedBetween(
      candidateSamples,
      corner.dEntry * scale,
      corner.dExit * scale,
    );
    out.push({
      index: corner.index,
      dEntry: corner.dEntry,
      dApex: corner.dApex,
      dExit: corner.dExit,
      refMs: Math.round(refMs),
      candMs: Math.round(candMs),
      deltaMs: Math.round(candMs - refMs),
      refMinKmh: corner.vMinKmh,
      candMinKmh: round1(candMin),
      deltaMinKmh: round1(candMin - corner.vMinKmh),
    });
  }
  return out;
}

function timeAtDistance(samples: ReadonlyArray<RichSample>, d: number): number {
  if (samples.length === 0) return 0;
  if (d <= 0) return samples[0]?.t ?? 0;
  const last = samples[samples.length - 1];
  if (!last || d >= last.d) return last?.t ?? 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    if (!a || !b) continue;
    if (b.d >= d) {
      const span = b.d - a.d;
      const f = span <= 0 ? 0 : (d - a.d) / span;
      return a.t + (b.t - a.t) * f;
    }
  }
  return last.t;
}

function minSpeedBetween(
  samples: ReadonlyArray<RichSample>,
  dStart: number,
  dEnd: number,
): number {
  if (samples.length === 0) return 0;
  let vMin = Number.POSITIVE_INFINITY;
  for (const s of samples) {
    if (s.d < dStart) continue;
    if (s.d > dEnd) break;
    if (s.v < vMin) vMin = s.v;
  }
  if (!Number.isFinite(vMin)) {
    return samples[Math.floor(samples.length / 2)]?.v ?? 0;
  }
  return vMin;
}
