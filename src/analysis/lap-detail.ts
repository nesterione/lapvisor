/**
 * Build a `LapDetail` for one lap: samples re-indexed from 0 with absolute
 * lap-start times subtracted, cumulative distance attached, sector
 * boundaries mapped to in-lap sample indices, plus per-lap aggregates.
 *
 * This is the analysis behind `lapvisor-lap/v1` (see
 * docs/formats/lapvisor-lap-v1.md).
 */

import type { VboSample } from "../adapters/vbo.js";
import { type LapAggregates, lapAggregates } from "./aggregates.js";
import { cumulativeDistance } from "./distance.js";
import type { DetectedLap } from "./laps.js";
import type { LapSectorSplits } from "./sectors.js";

export interface RichSample {
  /** Milliseconds since lap start. */
  t: number;
  lat: number;
  lng: number;
  /** Velocity in km/h. */
  v: number;
  /** Cumulative metres from lap start. */
  d: number;
  heading?: number;
  longG?: number;
  latG?: number;
  vertG?: number;
  gyroX?: number;
  gyroY?: number;
  gyroZ?: number;
}

export interface LapSector {
  sectorIndex: number;
  label: string;
  /** Index into `LapDetail.samples`. First sample at or after the gate crossing. */
  sampleIndex: number;
  offsetMs: number;
  distanceM: number;
}

export interface LapDetail {
  lap: {
    index: number;
    durationMs: number;
    startTimestampMs?: number;
    /** Total lap distance in metres (last cumulative-distance value). */
    distanceM: number;
  };
  samples: RichSample[];
  sectors: LapSector[];
  aggregates: LapAggregates;
}

export function extractLap(
  allSamples: VboSample[],
  lap: DetectedLap,
  sectorSplits: LapSectorSplits | undefined,
): LapDetail {
  const slice = allSamples.slice(lap.firstSampleIndex, lap.lastSampleIndex + 1);
  const distances = cumulativeDistance(slice);
  const samples: RichSample[] = slice.map((s, i) =>
    toRichSample(s, lap.startTimeOfDayMs, distances[i] ?? 0),
  );

  const sectors: LapSector[] = (sectorSplits?.splits ?? []).map((sp) => {
    const idx = findFirstSampleAfter(samples, sp.offsetMs);
    return {
      sectorIndex: sp.sectorIndex,
      label: sp.label,
      sampleIndex: idx,
      offsetMs: Math.round(sp.offsetMs),
      distanceM: round1(samples[idx]?.d ?? 0),
    };
  });

  const aggregates = roundAggregates(lapAggregates(slice));
  const totalDistance =
    distances.length > 0 ? (distances[distances.length - 1] ?? 0) : 0;

  const out: LapDetail = {
    lap: {
      index: lap.index,
      durationMs: Math.round(lap.durationMs),
      distanceM: round1(totalDistance),
    },
    samples,
    sectors,
    aggregates,
  };
  if (lap.startTimestampMs !== undefined) {
    out.lap.startTimestampMs = Math.round(lap.startTimestampMs);
  }
  return out;
}

function toRichSample(
  s: VboSample,
  lapStartMs: number,
  distance: number,
): RichSample {
  const r: RichSample = {
    t: Math.round(s.timeOfDayMs - lapStartMs),
    lat: round7(s.latDeg),
    lng: round7(s.lngDeg),
    v: round1(s.velocityKmh),
    d: round1(distance),
  };
  if (Number.isFinite(s.heading)) r.heading = round1(s.heading);
  if (s.longAccG !== undefined) r.longG = round3(s.longAccG);
  if (s.latAccG !== undefined) r.latG = round3(s.latAccG);
  if (s.vertAccG !== undefined) r.vertG = round3(s.vertAccG);
  if (s.gyroXDegSec !== undefined) r.gyroX = round1(s.gyroXDegSec);
  if (s.gyroYDegSec !== undefined) r.gyroY = round1(s.gyroYDegSec);
  if (s.gyroZDegSec !== undefined) r.gyroZ = round1(s.gyroZDegSec);
  return r;
}

function findFirstSampleAfter(samples: RichSample[], tMs: number): number {
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (s && s.t >= tMs) return i;
  }
  return Math.max(0, samples.length - 1);
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function round7(v: number): number {
  return Math.round(v * 1e7) / 1e7;
}

function roundAggregates(a: LapAggregates): LapAggregates {
  return {
    topSpeedKmh: round1(a.topSpeedKmh),
    minSpeedKmh: round1(a.minSpeedKmh),
    peakLatG: round3(a.peakLatG),
    peakLongGBrake: round3(a.peakLongGBrake),
    peakLongGAccel: round3(a.peakLongGAccel),
  };
}
