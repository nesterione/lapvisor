import type { VboFile, VboGate } from "../adapters/vbo.js";
import { detectCorners } from "../analysis/corners.js";
import { extractLap } from "../analysis/lap-detail.js";
import { detectLaps, type LapDetectionOptions } from "../analysis/laps.js";
import { compareCorners } from "../compare/corners.js";
import { compareLaps } from "../compare/lap-vs-lap.js";
import { trackGatesToVboGates } from "../track/loader.js";
import type { KartTrack } from "../track/types.js";
import { round1 } from "../util/rounding.js";
import type {
  BundleSource,
  LapCompareBundle,
  LapCompareCorner,
  LapCompareMiniSector,
} from "./types.js";

export interface BuildLapComparisonInput {
  source: BundleSource;
  vboFile: VboFile;
  /** 1-based lap index of the reference (baseline) lap. */
  refLapIndex: number;
  /** 1-based lap index of the candidate lap (the one whose gain/loss you want). */
  candidateLapIndex: number;
  /** Optional kart-track/v1 — when present, its gates override the VBO file's. */
  track?: KartTrack | null;
  miniSectorCount?: number;
  deltaTCount?: number;
  /**
   * When true, attach an optional `corners[]` block detected on the reference
   * lap with per-corner deltas vs the candidate. Default false to keep the
   * default bundle small.
   */
  includeCorners?: boolean;
  /** Forwarded to `detectCorners`. */
  cornerMinDropKmh?: number;
  detectionOptions?: LapDetectionOptions;
}

/**
 * Produce a `lapvisor-lap-compare/v1` bundle: pairwise comparison of two laps
 * from the same session. The same bundle the CLI emits for
 * `lapvisor compare <file> <refIdx> <candIdx>`.
 *
 * @param input - Parsed VBO file + the two lap indices to compare.
 * @returns A `LapCompareBundle` matching the published `lapvisor-lap-compare/v1` schema.
 * @throws Error when either lap index is missing in the detected laps.
 * @see {@link ../../docs/formats/lapvisor-lap-compare-v1.md | docs/formats/lapvisor-lap-compare-v1.md}
 */
export function buildLapComparisonBundle(
  input: BuildLapComparisonInput,
): LapCompareBundle {
  const {
    source,
    vboFile,
    refLapIndex,
    candidateLapIndex,
    track,
    miniSectorCount = 100,
    deltaTCount = 200,
    includeCorners = false,
    cornerMinDropKmh,
    detectionOptions,
  } = input;

  const detectionGates: VboGate[] = track
    ? trackGatesToVboGates(track)
    : vboFile.gates;
  const { laps } = detectLaps(
    vboFile.samples,
    detectionGates,
    detectionOptions,
  );

  const refLap = laps.find((l) => l.index === refLapIndex);
  if (!refLap) {
    throw new Error(
      `reference lap ${refLapIndex} not found — file has ${laps.length} detected laps`,
    );
  }
  const candLap = laps.find((l) => l.index === candidateLapIndex);
  if (!candLap) {
    throw new Error(
      `candidate lap ${candidateLapIndex} not found — file has ${laps.length} detected laps`,
    );
  }

  const refDetail = extractLap(vboFile.samples, refLap, undefined);
  const candDetail = extractLap(vboFile.samples, candLap, undefined);

  const result = compareLaps(refDetail.samples, candDetail.samples, {
    miniSectorCount,
    deltaTCount,
  });

  const miniSectors: LapCompareMiniSector[] = result.miniSectors.map((m) => ({
    index: m.index,
    dStart: round1(m.dStart),
    dEnd: round1(m.dEnd),
    refMs: Math.round(m.refMs),
    candMs: Math.round(m.candMs),
    deltaMs: Math.round(m.deltaMs),
  }));

  let corners: LapCompareCorner[] | undefined;
  if (includeCorners) {
    const detected = detectCorners(refDetail.samples, {
      minDropKmh: cornerMinDropKmh,
    });
    corners = compareCorners(
      detected,
      refDetail.samples,
      candDetail.samples,
    ).map((c) => ({
      index: c.index,
      dEntry: round1(c.dEntry),
      dApex: round1(c.dApex),
      dExit: round1(c.dExit),
      refMs: c.refMs,
      candMs: c.candMs,
      deltaMs: c.deltaMs,
      refMinKmh: round1(c.refMinKmh),
      candMinKmh: round1(c.candMinKmh),
      deltaMinKmh: round1(c.deltaMinKmh),
    }));
  }

  const bundle: LapCompareBundle = {
    schema: "lapvisor-lap-compare/v1",
    source,
    meta: {
      trackName: track?.name ?? null,
      venue: vboFile.comments.Venue,
      startedAt: vboFile.startedAt?.toISOString(),
    },
    reference: {
      index: refDetail.lap.index,
      durationMs: refDetail.lap.durationMs,
      distanceM: refDetail.lap.distanceM,
    },
    candidate: {
      index: candDetail.lap.index,
      durationMs: candDetail.lap.durationMs,
      distanceM: candDetail.lap.distanceM,
    },
    totalDeltaMs: candDetail.lap.durationMs - refDetail.lap.durationMs,
    miniSectorCount: result.miniSectors.length,
    miniSectors,
    deltaT: {
      count: result.deltaT.dGrid.length,
      dGrid: result.deltaT.dGrid.map(round1),
      deltaTMs: result.deltaT.deltaTMs.map((v) => Math.round(v)),
      maxDistanceM: round1(result.deltaT.maxDistanceM),
      coverage: round1(result.deltaT.coverage),
    },
  };
  if (corners) bundle.corners = corners;
  return bundle;
}
