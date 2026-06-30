import type { VboFile, VboGate } from "../adapters/vbo.js";
import { extractLap } from "../analysis/lap-detail.js";
import { detectLaps, type LapDetectionOptions } from "../analysis/laps.js";
import {
  bestMiniSectorsAcrossSession,
  buildMiniSectors,
  type MiniSector,
} from "../analysis/mini-sectors.js";
import { buildImprovementReport } from "../compare/improve.js";
import { trackGatesToVboGates } from "../track/loader.js";
import type { KartTrack } from "../track/types.js";
import { round1 } from "../util/rounding.js";
import type {
  BundleSource,
  SessionImprovementBundle,
  SessionImprovementIdealMiniSector,
  SessionImprovementOpportunity,
} from "./types.js";

export interface BuildSessionImprovementInput {
  source: BundleSource;
  vboFile: VboFile;
  /** Optional kart-track/v1 — when present, its gates override the VBO file's gates. */
  track?: KartTrack | null;
  /** Mini-sectors per lap. Default 100. */
  miniSectorCount?: number;
  /**
   * When true, attach `topOpportunities[]` (corner-level "what to do
   * differently" entries). Default false to keep the default `lapvisor ideal`
   * bundle small.
   */
  includeOpportunities?: boolean;
  /** Max opportunities to attach when `includeOpportunities` is true. Default 5. */
  maxOpportunities?: number;
  /** Min km/h speed drop for corner detection. Default 15. */
  cornerMinDropKmh?: number;
  detectionOptions?: LapDetectionOptions;
}

/**
 * Produce a `lapvisor-session-improvement/v1` bundle: best lap + ideal lap
 * (best-of-each-mini-sector across the session) + gap. The same bundle the
 * CLI emits for `lapvisor ideal <file>`.
 *
 * @param input - Parsed VBO file plus optional track and bin count.
 * @returns A `SessionImprovementBundle` matching the published `lapvisor-session-improvement/v1` schema.
 * @throws Error when the session has no detectable laps.
 * @see {@link ../../docs/formats/lapvisor-session-improvement-v1.md | docs/formats/lapvisor-session-improvement-v1.md}
 */
export function buildSessionImprovementBundle(
  input: BuildSessionImprovementInput,
): SessionImprovementBundle {
  const {
    source,
    vboFile,
    track,
    miniSectorCount = 100,
    includeOpportunities = false,
    maxOpportunities,
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
  if (laps.length === 0) {
    throw new Error(
      "no laps detected — cannot build session-improvement bundle",
    );
  }

  const perLap = laps.map((lap) => {
    const detail = extractLap(vboFile.samples, lap, undefined);
    const miniSectors = buildMiniSectors(detail.samples, {
      count: miniSectorCount,
    });
    return {
      lapIndex: lap.index,
      durationMs: detail.lap.durationMs,
      distanceM: detail.lap.distanceM,
      samples: detail.samples,
      miniSectors,
    };
  });

  let best = perLap[0];
  if (!best) {
    throw new Error(
      "no laps detected — cannot build session-improvement bundle",
    );
  }
  for (const lap of perLap) {
    if (lap.durationMs < best.durationMs) best = lap;
  }

  const ideal = bestMiniSectorsAcrossSession(
    perLap.map((lap) => ({
      lapIndex: lap.lapIndex,
      miniSectors: lap.miniSectors,
    })),
  );
  if (!ideal) {
    throw new Error(
      "ideal-lap composition failed — mini-sector counts disagree across laps",
    );
  }

  const bestSectors: ReadonlyArray<MiniSector> = best.miniSectors;
  const idealSectors: SessionImprovementIdealMiniSector[] =
    ideal.miniSectors.map((s) => {
      const bestSeg = bestSectors[s.index];
      return {
        index: s.index,
        sourceLapIndex: s.sourceLapIndex,
        durationMs: s.durationMs,
        dStart:
          bestSeg?.dStart ??
          round1((s.index * best.distanceM) / ideal.miniSectorCount),
        dEnd:
          bestSeg?.dEnd ??
          round1(((s.index + 1) * best.distanceM) / ideal.miniSectorCount),
        bestLapDurationMs: bestSeg?.durationMs ?? s.durationMs,
      };
    });

  const gapToIdealMs = Math.max(0, best.durationMs - ideal.totalMs);

  let topOpportunities: SessionImprovementOpportunity[] | undefined;
  if (includeOpportunities) {
    const report = buildImprovementReport(perLap, {
      maxOpportunities,
      cornerMinDropKmh,
    });
    if (report) {
      topOpportunities = report.topOpportunities.map((o) => ({
        cornerIndex: o.cornerIndex,
        dEntry: round1(o.dEntry),
        dApex: round1(o.dApex),
        dExit: round1(o.dExit),
        deltaMs: o.deltaMs,
        fastestLapIndex: o.fastestLapIndex,
        bestApexKmh: round1(o.bestApexKmh),
        fastestApexKmh: round1(o.fastestApexKmh),
        bestExitKmh: round1(o.bestExitKmh),
        fastestExitKmh: round1(o.fastestExitKmh),
        observations: o.observations,
      }));
    }
  }

  const bundle: SessionImprovementBundle = {
    schema: "lapvisor-session-improvement/v1",
    source,
    meta: {
      trackName: track?.name ?? null,
      venue: vboFile.comments.Venue,
      startedAt: vboFile.startedAt?.toISOString(),
    },
    lapCount: laps.length,
    bestLap: {
      index: best.lapIndex,
      durationMs: best.durationMs,
      distanceM: best.distanceM,
    },
    idealLap: {
      totalMs: ideal.totalMs,
      miniSectorCount: ideal.miniSectorCount,
      miniSectors: idealSectors,
    },
    gapToIdealMs,
  };
  if (topOpportunities) bundle.topOpportunities = topOpportunities;
  return bundle;
}
