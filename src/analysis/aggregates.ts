/**
 * Per-lap scalar aggregates (top/min speed, peak G channels). Pure scans
 * over the input samples — no projection, no smoothing. Channels that are
 * absent in the source format (e.g. RaceChrono lacks vertical G) yield 0
 * because the absence-vs-zero distinction is signaled at the LapDetail
 * level by sample-side optional fields, not here.
 */

import type { VboSample } from "../adapters/vbo.js";

export interface LapAggregates {
  topSpeedKmh: number;
  minSpeedKmh: number;
  /** Absolute lateral G across the lap. */
  peakLatG: number;
  /** Peak braking deceleration in g, expressed as a positive magnitude. */
  peakLongGBrake: number;
  /** Peak forward acceleration in g (positive longG). */
  peakLongGAccel: number;
}

export function lapAggregates(samples: VboSample[]): LapAggregates {
  let top = Number.NEGATIVE_INFINITY;
  let min = Number.POSITIVE_INFINITY;
  let peakLat = 0;
  let peakBrake = 0;
  let peakAccel = 0;

  for (const s of samples) {
    if (Number.isFinite(s.velocityKmh)) {
      if (s.velocityKmh > top) top = s.velocityKmh;
      if (s.velocityKmh < min) min = s.velocityKmh;
    }
    if (s.latAccG !== undefined) {
      const abs = Math.abs(s.latAccG);
      if (abs > peakLat) peakLat = abs;
    }
    if (s.longAccG !== undefined) {
      if (s.longAccG < 0) {
        const abs = -s.longAccG;
        if (abs > peakBrake) peakBrake = abs;
      } else if (s.longAccG > peakAccel) {
        peakAccel = s.longAccG;
      }
    }
  }

  return {
    topSpeedKmh: top === Number.NEGATIVE_INFINITY ? 0 : top,
    minSpeedKmh: min === Number.POSITIVE_INFINITY ? 0 : min,
    peakLatG: peakLat,
    peakLongGBrake: peakBrake,
    peakLongGAccel: peakAccel,
  };
}
