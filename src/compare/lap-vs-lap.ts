/**
 * Pairwise lap comparison: takes a reference lap and a candidate lap, and
 * returns where (and by how much) the candidate gained or lost time. Combines
 * the per-distance delta-t curve with per-mini-sector deltas so callers can
 * render either a continuous curve or a ranked "biggest opportunities" view.
 *
 * Mini-sector buckets are proportional to each lap's *own* total distance,
 * which makes mini-sector i correspond to "the same point on track" across
 * laps even when the racing line shifted slightly.
 *
 * Pure.
 */

import type { RichSample } from "../analysis/lap-detail.js";
import { buildMiniSectors, type MiniSector } from "../analysis/mini-sectors.js";
import { computeDeltaT, type DeltaTResult } from "./delta-t.js";

export interface CompareLapsOptions {
  /** Mini-sector bin count. Default 100. */
  miniSectorCount?: number;
  /** Delta-t grid resolution. Default 200. */
  deltaTCount?: number;
}

export interface MiniSectorDelta {
  /** 0-based mini-sector index. */
  index: number;
  /** Distance window on the reference lap, in metres. */
  dStart: number;
  dEnd: number;
  /** Reference lap's duration through this mini-sector. */
  refMs: number;
  /** Candidate lap's duration through this mini-sector. */
  candMs: number;
  /** `candMs - refMs`. Negative ⇒ candidate ahead in this bin. */
  deltaMs: number;
}

export interface CompareLapsResult {
  /** Per-distance time delta, candidate minus reference. */
  deltaT: DeltaTResult;
  /** Per-mini-sector deltas (candidate − reference), aligned to reference-lap distances. */
  miniSectors: MiniSectorDelta[];
  /** Sum of `miniSectors[].deltaMs` (matches `deltaT.totalMs` within rounding). */
  totalDeltaMs: number;
}

/**
 * Compare two laps and return where the candidate lost or gained time vs the
 * reference. Both laps must have the {@link RichSample} shape produced by
 * {@link "../analysis/lap-detail.js".extractLap}.
 */
export function compareLaps(
  reference: ReadonlyArray<RichSample>,
  candidate: ReadonlyArray<RichSample>,
  opts: CompareLapsOptions = {},
): CompareLapsResult {
  const miniSectorCount = Math.max(1, Math.floor(opts.miniSectorCount ?? 100));
  const deltaTCount = Math.max(2, Math.floor(opts.deltaTCount ?? 200));

  const deltaT = computeDeltaT(reference, candidate, { count: deltaTCount });
  const refMini = buildMiniSectors(reference, { count: miniSectorCount });
  const candMini = buildMiniSectors(candidate, { count: miniSectorCount });

  const miniSectors: MiniSectorDelta[] = [];
  let total = 0;
  for (let i = 0; i < miniSectorCount; i++) {
    const r = refMini[i];
    const c = candMini[i];
    const delta = (c?.durationMs ?? 0) - (r?.durationMs ?? 0);
    miniSectors.push({
      index: i,
      dStart: r?.dStart ?? c?.dStart ?? 0,
      dEnd: r?.dEnd ?? c?.dEnd ?? 0,
      refMs: r?.durationMs ?? 0,
      candMs: c?.durationMs ?? 0,
      deltaMs: delta,
    });
    total += delta;
  }

  return { deltaT, miniSectors, totalDeltaMs: total };
}

/**
 * Re-export to keep `MiniSector` reachable via this module — useful for
 * downstream code that already pins to `lapvisor/compare`.
 */
export type { MiniSector };
