/**
 * Lap detection from a time-ordered stream of GPS samples and a set of gates.
 *
 * Algorithm: for each consecutive sample pair, test segment-segment intersection
 * against the start/finish gate in a local equirectangular projection (centred
 * on the gate midpoint, accurate to sub-mm at karting scale). The crossing time
 * is interpolated within the sample pair so lap times are not quantised to the
 * GPS sample rate. A direction lock (set by the first accepted crossing)
 * rejects wrong-way passes.
 */

import type { LatLng, VboGate, VboSample } from "../adapters/vbo.js";

export interface LapDetectionOptions {
  /** Reject crossings closer than this to the previous one (debounces narrow gates and parked-on-the-line). */
  minLapMs?: number;
  /** Reject sample pairs where both samples are below this speed (parked / paddock crawl). */
  minSpeedKmh?: number;
  /** Reject sample pairs where either sample has no GPS fix (sats === 0). */
  requireFix?: boolean;
}

const DEFAULTS: Required<LapDetectionOptions> = {
  minLapMs: 5_000,
  minSpeedKmh: 5,
  requireFix: true,
};

export interface LapCrossing {
  /** Index of the sample *after* the crossing (i.e. the path P→Q crossed between sample i-1 and i). */
  sampleIndex: number;
  /** Interpolated time-of-day at the crossing (UTC ms since midnight). */
  timeOfDayMs: number;
  /** Interpolated absolute UTC epoch ms, when both samples carried timestampMs. */
  timestampMs?: number;
  /** Sign of the crossing relative to the gate orientation. The first accepted crossing locks the expected sign. */
  direction: 1 | -1;
}

export interface DetectedLap {
  /** 1-based lap number (in detection order). */
  index: number;
  startTimeOfDayMs: number;
  durationMs: number;
  /** Absolute UTC epoch ms, when known. */
  startTimestampMs?: number;
  /** Inclusive sample-index range covered by the lap. */
  firstSampleIndex: number;
  lastSampleIndex: number;
}

export interface RejectedCrossing {
  sampleIndex: number;
  reason:
    | "no-fix"
    | "below-min-speed"
    | "too-soon-after-previous"
    | "wrong-direction"
    | "off-gate-end"
    | "parallel";
}

export interface LapDetectionResult {
  laps: DetectedLap[];
  crossings: LapCrossing[];
  rejected: RejectedCrossing[];
}

export class NoStartGateError extends Error {
  constructor() {
    super("no [laptiming] Start gate defined — cannot detect laps");
    this.name = "NoStartGateError";
  }
}

export function detectLaps(
  samples: VboSample[],
  gates: VboGate[],
  opts: LapDetectionOptions = {},
): LapDetectionResult {
  const startGate = gates.find((g) => g.kind === "start");
  if (!startGate) throw new NoStartGateError();

  const cfg = { ...DEFAULTS, ...opts };

  // Project the gate once. Both endpoints share the same reference, so the
  // local-meters frame is fixed for the whole detection run.
  const ref = midpoint(startGate.pointA, startGate.pointB);
  const projector = makeProjector(ref);
  const A = projector(startGate.pointA);
  const B = projector(startGate.pointB);
  const ABx = B.x - A.x;
  const ABy = B.y - A.y;

  const crossings: LapCrossing[] = [];
  const rejected: RejectedCrossing[] = [];
  let expectedDirection: 1 | -1 | null = null;
  let lastAcceptedMs = Number.NEGATIVE_INFINITY;

  for (let i = 1; i < samples.length; i++) {
    const P = samples[i - 1];
    const Q = samples[i];

    if (cfg.requireFix && (P.sats === 0 || Q.sats === 0)) {
      // Filtered before geometry to keep cost low; not added to `rejected` because
      // the overwhelmingly common case is the pre-fix prefix at session start.
      continue;
    }
    if (P.velocityKmh < cfg.minSpeedKmh && Q.velocityKmh < cfg.minSpeedKmh) {
      continue;
    }

    const Pp = projector(P);
    const Qp = projector(Q);

    // Standard 2D segment-segment intersection. denom is parallel-test;
    // numT/numU give the parameters along PQ and AB respectively.
    const PQx = Qp.x - Pp.x;
    const PQy = Qp.y - Pp.y;
    const denom = PQx * ABy - PQy * ABx;
    if (denom === 0) {
      // Parallel — exceedingly rare in practice; record only when at least
      // one sample is on the line to surface the geometric oddity.
      continue;
    }

    const APx = A.x - Pp.x;
    const APy = A.y - Pp.y;
    const numT = APx * ABy - APy * ABx;
    const numU = APx * PQy - APy * PQx;
    const t = numT / denom;
    const u = numU / denom;

    // Path didn't intersect between this sample pair.
    if (t < 0 || t > 1) continue;
    // Path crossed the infinite extension of AB but not between the gate posts.
    if (u < 0 || u > 1) {
      rejected.push({ sampleIndex: i, reason: "off-gate-end" });
      continue;
    }

    const direction: 1 | -1 = denom > 0 ? 1 : -1;
    const timeOfDayMs = P.timeOfDayMs + t * (Q.timeOfDayMs - P.timeOfDayMs);

    if (timeOfDayMs - lastAcceptedMs < cfg.minLapMs) {
      rejected.push({ sampleIndex: i, reason: "too-soon-after-previous" });
      continue;
    }

    if (expectedDirection === null) {
      expectedDirection = direction;
    } else if (direction !== expectedDirection) {
      rejected.push({ sampleIndex: i, reason: "wrong-direction" });
      continue;
    }

    const timestampMs =
      P.timestampMs !== undefined && Q.timestampMs !== undefined
        ? P.timestampMs + t * (Q.timestampMs - P.timestampMs)
        : undefined;

    crossings.push({ sampleIndex: i, timeOfDayMs, timestampMs, direction });
    lastAcceptedMs = timeOfDayMs;
  }

  const laps: DetectedLap[] = [];
  for (let k = 1; k < crossings.length; k++) {
    const start = crossings[k - 1];
    const end = crossings[k];
    laps.push({
      index: k,
      startTimeOfDayMs: start.timeOfDayMs,
      durationMs: end.timeOfDayMs - start.timeOfDayMs,
      startTimestampMs: start.timestampMs,
      firstSampleIndex: start.sampleIndex,
      lastSampleIndex: end.sampleIndex - 1,
    });
  }

  return { laps, crossings, rejected };
}

interface XY {
  x: number;
  y: number;
}

const M_PER_DEG_LAT = 111_320;

function makeProjector(ref: LatLng): (p: LatLng) => XY {
  const cosLat = Math.cos((ref.latDeg * Math.PI) / 180);
  const mPerDegLng = M_PER_DEG_LAT * cosLat;
  return (p) => ({
    x: (p.lngDeg - ref.lngDeg) * mPerDegLng,
    y: (p.latDeg - ref.latDeg) * M_PER_DEG_LAT,
  });
}

function midpoint(a: LatLng, b: LatLng): LatLng {
  return {
    latDeg: (a.latDeg + b.latDeg) / 2,
    lngDeg: (a.lngDeg + b.lngDeg) / 2,
  };
}
