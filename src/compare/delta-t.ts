/**
 * Continuous time-difference between two laps along a shared distance axis.
 *
 *   delta-t at distance d  =  candidate.t(d) − reference.t(d)
 *
 * Negative values mean the candidate lap is ahead of the reference at that
 * distance; positive values mean it is behind. Both laps are resampled onto a
 * common distance grid (truncated to their shared overlap when they differ in
 * total length).
 *
 * Foundation primitive behind `lapvisor compare`, `lapvisor improve`, and any
 * client that wants to render a "where am I losing time?" view.
 *
 * Pure.
 */

import type { RichSample } from "../analysis/lap-detail.js";
import { resampleByDistance } from "../analysis/resample.js";

export interface ComputeDeltaTOptions {
  /** Grid resolution. Default 200 points. */
  count?: number;
}

export interface DeltaTResult {
  /** Distance grid in metres (`count` evenly spaced points 0..maxDistanceM). */
  dGrid: number[];
  /** candidate.t − reference.t at each grid point, in milliseconds. */
  deltaTMs: number[];
  /** Final delta at the end of the shared distance window (= last entry of `deltaTMs`). */
  totalMs: number;
  /** End of the shared overlap window in metres. */
  maxDistanceM: number;
  /** Shared overlap as a fraction of the longer lap. 1 = same length. */
  coverage: number;
}

/**
 * Compute the per-distance time delta between two laps.
 *
 * @param reference - Reference lap samples (the "baseline" you compare against).
 * @param candidate - Candidate lap samples (the lap whose loss/gain you want to localize).
 * @param opts - Grid resolution.
 */
export function computeDeltaT(
  reference: ReadonlyArray<RichSample>,
  candidate: ReadonlyArray<RichSample>,
  opts: ComputeDeltaTOptions = {},
): DeltaTResult {
  const count = Math.max(2, Math.floor(opts.count ?? 200));
  const refTotal = reference[reference.length - 1]?.d ?? 0;
  const candTotal = candidate[candidate.length - 1]?.d ?? 0;
  const maxDistanceM = Math.min(refTotal, candTotal);
  const longer = Math.max(refTotal, candTotal);
  const coverage = longer > 0 ? maxDistanceM / longer : 0;

  if (maxDistanceM <= 0 || reference.length < 2 || candidate.length < 2) {
    return { dGrid: [], deltaTMs: [], totalMs: 0, maxDistanceM, coverage };
  }

  const ref = resampleByDistance(reference, { count, maxDistanceM });
  const cand = resampleByDistance(candidate, { count, maxDistanceM });

  const deltaTMs = new Array<number>(count);
  for (let i = 0; i < count; i++) {
    const refT = ref.samples[i]?.t ?? 0;
    const candT = cand.samples[i]?.t ?? 0;
    deltaTMs[i] = candT - refT;
  }

  return {
    dGrid: ref.dGrid,
    deltaTMs,
    totalMs: deltaTMs[count - 1] ?? 0,
    maxDistanceM,
    coverage,
  };
}
