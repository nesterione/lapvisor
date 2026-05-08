/**
 * Sector-split timing. Given a set of sector gates and the lap boundaries
 * produced by `detectLaps`, find the time of each sector-gate crossing within
 * each lap and express it as an offset from the lap start.
 *
 * Geometry mirrors `detectLaps` (segment-segment intersection in a local
 * equirectangular projection). We keep direction agnostic for sector gates —
 * the lap is already sliced by the start gate, so any wrong-way pass at a
 * sector would be filtered out by the surrounding lap timing.
 */

import type { VboGate, VboSample } from "../adapters/vbo.js";
import type { DetectedLap } from "./laps.js";

export interface SectorSplit {
  /** Index into the input `sectors` array. */
  sectorIndex: number;
  /** Free-form gate label (from VboGate.label). */
  label: string;
  /** Offset from lap start, in milliseconds. */
  offsetMs: number;
}

export interface LapSectorSplits {
  lapIndex: number;
  splits: SectorSplit[];
}

export function detectSectorSplits(
  samples: VboSample[],
  sectors: VboGate[],
  laps: DetectedLap[],
): LapSectorSplits[] {
  if (sectors.length === 0 || laps.length === 0) return [];

  const projected = sectors.map(projectGate);

  const result: LapSectorSplits[] = [];
  for (const lap of laps) {
    const splits: SectorSplit[] = [];
    for (let s = 0; s < sectors.length; s++) {
      const split = firstCrossingInLap(
        samples,
        projected[s],
        lap,
        s,
        sectors[s].label,
      );
      if (split) splits.push(split);
    }
    splits.sort((a, b) => a.offsetMs - b.offsetMs);
    result.push({ lapIndex: lap.index, splits });
  }
  return result;
}

interface ProjectedGate {
  refLat: number;
  refLng: number;
  cosLat: number;
  Ax: number;
  Ay: number;
  ABx: number;
  ABy: number;
}

const M_PER_DEG_LAT = 111_320;

function projectGate(g: VboGate): ProjectedGate {
  const refLat = (g.pointA.latDeg + g.pointB.latDeg) / 2;
  const refLng = (g.pointA.lngDeg + g.pointB.lngDeg) / 2;
  const cosLat = Math.cos((refLat * Math.PI) / 180);
  const mPerDegLng = M_PER_DEG_LAT * cosLat;
  const Ax = (g.pointA.lngDeg - refLng) * mPerDegLng;
  const Ay = (g.pointA.latDeg - refLat) * M_PER_DEG_LAT;
  const Bx = (g.pointB.lngDeg - refLng) * mPerDegLng;
  const By = (g.pointB.latDeg - refLat) * M_PER_DEG_LAT;
  return { refLat, refLng, cosLat, Ax, Ay, ABx: Bx - Ax, ABy: By - Ay };
}

function firstCrossingInLap(
  samples: VboSample[],
  gate: ProjectedGate,
  lap: DetectedLap,
  sectorIndex: number,
  label: string,
): SectorSplit | null {
  const mPerDegLng = M_PER_DEG_LAT * gate.cosLat;
  const start = Math.max(1, lap.firstSampleIndex);
  const end = Math.min(samples.length - 1, lap.lastSampleIndex);
  for (let i = start; i <= end; i++) {
    const P = samples[i - 1];
    const Q = samples[i];
    const Px = (P.lngDeg - gate.refLng) * mPerDegLng;
    const Py = (P.latDeg - gate.refLat) * M_PER_DEG_LAT;
    const Qx = (Q.lngDeg - gate.refLng) * mPerDegLng;
    const Qy = (Q.latDeg - gate.refLat) * M_PER_DEG_LAT;

    const PQx = Qx - Px;
    const PQy = Qy - Py;
    const denom = PQx * gate.ABy - PQy * gate.ABx;
    if (denom === 0) continue;
    const APx = gate.Ax - Px;
    const APy = gate.Ay - Py;
    const t = (APx * gate.ABy - APy * gate.ABx) / denom;
    const u = (APx * PQy - APy * PQx) / denom;
    if (t < 0 || t > 1 || u < 0 || u > 1) continue;
    const timeOfDayMs = P.timeOfDayMs + t * (Q.timeOfDayMs - P.timeOfDayMs);
    const offsetMs = timeOfDayMs - lap.startTimeOfDayMs;
    if (offsetMs <= 0 || offsetMs > lap.durationMs) continue;
    return { sectorIndex, label, offsetMs };
  }
  return null;
}
