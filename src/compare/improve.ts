/**
 * Session-level "where can I find time?" report. Detects corners on the best
 * lap, finds the lap that drove each corner fastest, and ranks the corners by
 * the time-loss the best lap took there. Pairs naturally with the
 * session-improvement bundle's ideal-lap (mini-sector) view: this side shows
 * *named, actionable* opportunities at corner granularity.
 *
 * Pure.
 */

import { type Corner, detectCorners } from "../analysis/corners.js";
import type { RichSample } from "../analysis/lap-detail.js";
import { round1 } from "../util/rounding.js";

export interface ImprovementLapInput {
  /** 1-based lap index. */
  lapIndex: number;
  durationMs: number;
  samples: ReadonlyArray<RichSample>;
}

export interface ImprovementOpportunity {
  /** 1-based corner index in detection order along the best lap. */
  cornerIndex: number;
  /** Distance window of the corner on the best lap. */
  dEntry: number;
  dApex: number;
  dExit: number;
  /** Time-loss vs the fastest-corner lap, in ms. Always >= 0. */
  deltaMs: number;
  /** 1-based lap index that drove this corner fastest. */
  fastestLapIndex: number;
  /** Best lap's apex speed (km/h). */
  bestApexKmh: number;
  /** Fastest-corner lap's minimum speed in the same proportional region (km/h). */
  fastestApexKmh: number;
  /** Best lap's velocity at corner exit (km/h). */
  bestExitKmh: number;
  /** Fastest-corner lap's velocity at the proportional exit position (km/h). */
  fastestExitKmh: number;
  /** Plain-text observations derived from the numerical deltas. */
  observations: string[];
}

export interface ImprovementReport {
  bestLapIndex: number;
  bestLapDurationMs: number;
  topOpportunities: ImprovementOpportunity[];
}

export interface BuildImprovementOptions {
  /** Max number of opportunities to return. Default 5. */
  maxOpportunities?: number;
  /** Minimum corner-prominence threshold (km/h). Forwarded to `detectCorners`. */
  cornerMinDropKmh?: number;
}

/**
 * Compose the session-level improvement report.
 *
 * @param perLap - One entry per detected lap, including the lap's `RichSample[]`.
 * @returns Report with ranked opportunities, or `null` when there are no laps,
 *   no corners on the best lap, or no other laps to compare against.
 */
export function buildImprovementReport(
  perLap: ReadonlyArray<ImprovementLapInput>,
  opts: BuildImprovementOptions = {},
): ImprovementReport | null {
  if (perLap.length === 0) return null;
  const maxOpps = Math.max(1, Math.floor(opts.maxOpportunities ?? 5));

  let best = perLap[0];
  if (!best) return null;
  for (const lap of perLap) {
    if (lap.durationMs < best.durationMs) best = lap;
  }
  const bestSamples = best.samples;
  const bestTotal = bestSamples[bestSamples.length - 1]?.d ?? 0;
  if (bestTotal <= 0) return null;

  const corners = detectCorners(bestSamples, {
    minDropKmh: opts.cornerMinDropKmh,
  });
  if (corners.length === 0) {
    return {
      bestLapIndex: best.lapIndex,
      bestLapDurationMs: best.durationMs,
      topOpportunities: [],
    };
  }

  const others = perLap.filter((l) => l.lapIndex !== best.lapIndex);
  const opportunities: ImprovementOpportunity[] = [];

  for (const corner of corners) {
    const refTime = timeBetween(bestSamples, corner.dEntry, corner.dExit);
    const bestExitV = velocityAtDistance(bestSamples, corner.dExit);
    let fastestLap: ImprovementLapInput | null = null;
    let fastestTime = refTime;
    for (const other of others) {
      const otherTotal = other.samples[other.samples.length - 1]?.d ?? 0;
      if (otherTotal <= 0) continue;
      const scale = otherTotal / bestTotal;
      const t = timeBetween(
        other.samples,
        corner.dEntry * scale,
        corner.dExit * scale,
      );
      if (t > 0 && t < fastestTime) {
        fastestTime = t;
        fastestLap = other;
      }
    }
    if (!fastestLap) continue;
    const otherTotal =
      fastestLap.samples[fastestLap.samples.length - 1]?.d ?? bestTotal;
    const scale = otherTotal / bestTotal;
    const fastestApex = minSpeedBetween(
      fastestLap.samples,
      corner.dEntry * scale,
      corner.dExit * scale,
    );
    const fastestExit = velocityAtDistance(
      fastestLap.samples,
      corner.dExit * scale,
    );
    const deltaMs = Math.max(0, Math.round(refTime - fastestTime));
    if (deltaMs <= 0) continue;
    opportunities.push(
      makeOpportunity(corner, deltaMs, fastestLap.lapIndex, {
        bestApex: corner.vMinKmh,
        fastestApex,
        bestExit: bestExitV,
        fastestExit,
      }),
    );
  }

  opportunities.sort((a, b) => b.deltaMs - a.deltaMs);
  return {
    bestLapIndex: best.lapIndex,
    bestLapDurationMs: best.durationMs,
    topOpportunities: opportunities.slice(0, maxOpps),
  };
}

function makeOpportunity(
  corner: Corner,
  deltaMs: number,
  fastestLapIndex: number,
  speeds: {
    bestApex: number;
    fastestApex: number;
    bestExit: number;
    fastestExit: number;
  },
): ImprovementOpportunity {
  const observations: string[] = [];
  const apexGain = round1(speeds.fastestApex - speeds.bestApex);
  const exitGain = round1(speeds.fastestExit - speeds.bestExit);
  if (apexGain >= 1) {
    observations.push(`carry +${apexGain.toFixed(1)} km/h through apex`);
  }
  if (exitGain >= 1) {
    observations.push(`earlier throttle — exit +${exitGain.toFixed(1)} km/h`);
  }
  if (observations.length === 0) {
    observations.push(`lap ${fastestLapIndex} drove this corner quicker`);
  }
  return {
    cornerIndex: corner.index,
    dEntry: corner.dEntry,
    dApex: corner.dApex,
    dExit: corner.dExit,
    deltaMs,
    fastestLapIndex,
    bestApexKmh: round1(speeds.bestApex),
    fastestApexKmh: round1(speeds.fastestApex),
    bestExitKmh: round1(speeds.bestExit),
    fastestExitKmh: round1(speeds.fastestExit),
    observations,
  };
}

function timeBetween(
  samples: ReadonlyArray<RichSample>,
  dStart: number,
  dEnd: number,
): number {
  return timeAtDistance(samples, dEnd) - timeAtDistance(samples, dStart);
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

function velocityAtDistance(
  samples: ReadonlyArray<RichSample>,
  d: number,
): number {
  if (samples.length === 0) return 0;
  if (d <= 0) return samples[0]?.v ?? 0;
  const last = samples[samples.length - 1];
  if (!last || d >= last.d) return last?.v ?? 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    if (!a || !b) continue;
    if (b.d >= d) {
      const span = b.d - a.d;
      const f = span <= 0 ? 0 : (d - a.d) / span;
      return a.v + (b.v - a.v) * f;
    }
  }
  return last.v;
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
  if (!Number.isFinite(vMin)) return velocityAtDistance(samples, dStart);
  return vMin;
}
