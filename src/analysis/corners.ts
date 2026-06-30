/**
 * Heuristic corner detection from a lap's speed trace.
 *
 * No track-side metadata required. The detector finds local speed minima
 * bracketed by local speed maxima and accepts each minimum as a corner when
 * the speed drop from the surrounding peak exceeds a prominence threshold
 * (default 15 km/h). The apex is the sample at the minimum; entry and exit
 * are the bracketing maxima.
 *
 * Pure.
 *
 * Long-form notes (heuristic, edge cases, tuning) live in
 * `docs/analysis/corners.md`.
 */

import { round1, round3 } from "../util/rounding.js";
import type { RichSample } from "./lap-detail.js";

export interface Corner {
  /** 1-based corner number along the lap, in detection order. */
  index: number;
  /** Sample index of the entry (preceding speed maximum). */
  entrySampleIndex: number;
  /** Sample index of the apex (speed minimum). */
  apexSampleIndex: number;
  /** Sample index of the exit (following speed maximum). */
  exitSampleIndex: number;
  /** Distance at entry, in metres. */
  dEntry: number;
  /** Distance at apex, in metres. */
  dApex: number;
  /** Distance at exit, in metres. */
  dExit: number;
  /** Velocity at apex (= minimum speed of the corner), in km/h. */
  vMinKmh: number;
  /** Velocity at entry, in km/h. */
  vEntryKmh: number;
  /** Velocity at exit, in km/h. */
  vExitKmh: number;
  /** Maximum |latG| sampled between entry and exit, when latG is available. */
  peakLatG?: number;
  /** Most-negative longG sampled between entry and apex, when longG is available. */
  peakBrakingG?: number;
}

export interface DetectCornersOptions {
  /** Minimum km/h drop from the bracketing speed peak. Default 15. */
  minDropKmh?: number;
  /** Reject any apex whose minimum speed is above this (km/h). Default ∞ (no upper bound). */
  maxApexKmh?: number;
}

/**
 * Detect corners from a lap's speed trace.
 *
 * @param samples - Lap samples (require `.v` and `.d`; `.longG`/`.latG` enrich
 *   the output if present).
 * @param opts - Detection thresholds.
 * @returns Detected corners in order along the lap (1-based `index`). Empty
 *   array when the lap has fewer than 3 samples or when no speed minimum
 *   passes the prominence threshold.
 */
export function detectCorners(
  samples: ReadonlyArray<RichSample>,
  opts: DetectCornersOptions = {},
): Corner[] {
  const minDrop = opts.minDropKmh ?? 15;
  const maxApex = opts.maxApexKmh ?? Number.POSITIVE_INFINITY;
  if (samples.length < 3) return [];

  const maxima: number[] = [0];
  for (let i = 1; i < samples.length - 1; i++) {
    const prev = samples[i - 1]?.v ?? 0;
    const cur = samples[i]?.v ?? 0;
    const next = samples[i + 1]?.v ?? 0;
    if (cur >= prev && cur >= next && (cur > prev || cur > next)) {
      maxima.push(i);
    }
  }
  maxima.push(samples.length - 1);

  const corners: Corner[] = [];
  let cIdx = 1;
  for (let k = 0; k < maxima.length - 1; k++) {
    const entryIdx = maxima[k] ?? 0;
    const exitIdx = maxima[k + 1] ?? samples.length - 1;
    if (exitIdx <= entryIdx + 1) continue;

    let apexIdx = entryIdx;
    let vMin = samples[entryIdx]?.v ?? Number.POSITIVE_INFINITY;
    for (let i = entryIdx + 1; i < exitIdx; i++) {
      const v = samples[i]?.v ?? Number.POSITIVE_INFINITY;
      if (v < vMin) {
        vMin = v;
        apexIdx = i;
      }
    }
    if (apexIdx === entryIdx) continue;

    const vEntry = samples[entryIdx]?.v ?? 0;
    const vExit = samples[exitIdx]?.v ?? 0;
    const drop = Math.max(vEntry, vExit) - vMin;
    if (drop < minDrop) continue;
    if (vMin > maxApex) continue;

    let peakLat = 0;
    for (let i = entryIdx; i <= exitIdx; i++) {
      const lg = samples[i]?.latG;
      if (lg !== undefined) {
        const abs = Math.abs(lg);
        if (abs > peakLat) peakLat = abs;
      }
    }
    let peakBrake = 0;
    for (let i = entryIdx; i <= apexIdx; i++) {
      const lg = samples[i]?.longG;
      if (lg !== undefined && lg < peakBrake) peakBrake = lg;
    }

    const corner: Corner = {
      index: cIdx++,
      entrySampleIndex: entryIdx,
      apexSampleIndex: apexIdx,
      exitSampleIndex: exitIdx,
      dEntry: round1(samples[entryIdx]?.d ?? 0),
      dApex: round1(samples[apexIdx]?.d ?? 0),
      dExit: round1(samples[exitIdx]?.d ?? 0),
      vMinKmh: round1(vMin),
      vEntryKmh: round1(vEntry),
      vExitKmh: round1(vExit),
    };
    if (peakLat > 0) corner.peakLatG = round3(peakLat);
    if (peakBrake < 0) corner.peakBrakingG = round3(peakBrake);
    corners.push(corner);
  }
  return corners;
}
