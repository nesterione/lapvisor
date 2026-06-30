import type { LapAggregates } from "../analysis/aggregates.js";
import type {
  LapDetail,
  LapSector,
  RichSample,
} from "../analysis/lap-detail.js";
import type {
  SessionLapSummary,
  SessionSummary,
} from "../analysis/session-summary.js";
import type { Session } from "../model.js";

/**
 * Gate as it appears in bundle output. Coordinates are `[lon, lat]` to match
 * GeoJSON. `kind` is normalised — VBO `start`/`split` map to
 * `start_finish`/`sector`.
 */
export interface SessionGate {
  kind: "start_finish" | "sector" | "unknown";
  name: string;
  /** [lon, lat] */
  pointA: [number, number];
  /** [lon, lat] */
  pointB: [number, number];
}

export interface BundleSource {
  file: string;
  format: "vbo";
}

export interface BundleMeta {
  trackName: string | null;
  venue?: string;
  startedAt?: string;
}

/**
 * `lapvisor-lap/v1` bundle — one lap's full payload (rich samples + sector
 * boundaries + aggregates + gate context). Spec:
 * [`docs/formats/lapvisor-lap-v1.md`](../../docs/formats/lapvisor-lap-v1.md).
 */
export interface LapBundle {
  schema: "lapvisor-lap/v1";
  source: BundleSource;
  meta: BundleMeta;
  lap: LapDetail["lap"];
  samples: RichSample[];
  sectors: LapSector[];
  aggregates: LapAggregates;
  gates: SessionGate[];
}

export interface SessionBundleSample {
  lat: number;
  lng: number;
  /** velocity in km/h */
  v: number;
}

export interface SessionBundleLap {
  index: number;
  durationMs: number;
  firstSampleIndex: number;
  lastSampleIndex: number;
}

export interface SessionBundleSectorSplit {
  sectorIndex: number;
  label: string;
  offsetMs: number;
}

export interface SessionBundleLapSectorSplits {
  lapIndex: number;
  splits: SessionBundleSectorSplit[];
}

/**
 * `lapvisor-session/v2` bundle — full session payload (compact GPS samples,
 * lap boundaries, sector splits, per-lap summaries, session summary, gates).
 * Spec: [`docs/formats/lapvisor-session-v2.md`](../../docs/formats/lapvisor-session-v2.md).
 */
export interface SessionBundle {
  schema: "lapvisor-session/v2";
  source: BundleSource;
  meta: BundleMeta;
  samples: SessionBundleSample[];
  laps: SessionBundleLap[];
  sectorSplits: SessionBundleLapSectorSplits[];
  lapSummaries: SessionLapSummary[];
  sessionSummary: SessionSummary;
  gates: SessionGate[];
}

export interface LapCompareLapRef {
  /** 1-based lap index. */
  index: number;
  durationMs: number;
  /** Total lap distance in metres (from the source lap). */
  distanceM: number;
}

export interface LapCompareDeltaT {
  /** Grid resolution actually used. */
  count: number;
  /** Distance grid in metres (length === `count`). Rounded to 0.1. */
  dGrid: number[];
  /** candidate.t − reference.t at each grid point in milliseconds. Integer ms. */
  deltaTMs: number[];
  /** End of shared overlap window in metres. */
  maxDistanceM: number;
  /** Shared overlap as a fraction of the longer lap. 1 = same length. */
  coverage: number;
}

export interface LapCompareMiniSector {
  index: number;
  dStart: number;
  dEnd: number;
  refMs: number;
  candMs: number;
  /** `candMs - refMs`. Negative ⇒ candidate ahead in this bin. */
  deltaMs: number;
}

export interface LapCompareCorner {
  /** 1-based corner index from the reference lap. */
  index: number;
  /** Distance window of the corner on the reference lap. */
  dEntry: number;
  dApex: number;
  dExit: number;
  /** Time taken between entry and exit on the reference lap (ms). */
  refMs: number;
  /** Time taken between proportional entry/exit positions on the candidate lap (ms). */
  candMs: number;
  /** `candMs - refMs`. Negative ⇒ candidate quicker through the corner. */
  deltaMs: number;
  /** Reference apex speed (km/h). */
  refMinKmh: number;
  /** Candidate minimum speed in the proportional corner region (km/h). */
  candMinKmh: number;
  /** `candMinKmh - refMinKmh`. Positive ⇒ more apex speed on candidate. */
  deltaMinKmh: number;
}

/**
 * `lapvisor-lap-compare/v1` bundle — pairwise comparison between two laps from
 * the same session. Carries reference/candidate lap meta, distance-aligned
 * delta-t curve, and per-mini-sector deltas.
 *
 * Spec: [`docs/formats/lapvisor-lap-compare-v1.md`](../../docs/formats/lapvisor-lap-compare-v1.md).
 */
export interface LapCompareBundle {
  schema: "lapvisor-lap-compare/v1";
  source: BundleSource;
  meta: BundleMeta;
  reference: LapCompareLapRef;
  candidate: LapCompareLapRef;
  /** `candidate.durationMs - reference.durationMs` (positive ⇒ candidate slower). */
  totalDeltaMs: number;
  miniSectorCount: number;
  miniSectors: LapCompareMiniSector[];
  deltaT: LapCompareDeltaT;
  /**
   * Optional per-corner deltas. Present only when corner detection was
   * requested at build time (CLI flag `--corners`). `v1` consumers that
   * ignore unknown fields are unaffected.
   */
  corners?: LapCompareCorner[];
}

export interface SessionImprovementBestLap {
  /** 1-based lap index of the best lap in the session. */
  index: number;
  durationMs: number;
  distanceM: number;
}

export interface SessionImprovementIdealMiniSector {
  /** 0-based mini-sector index (proportional position 0..count-1 along the lap). */
  index: number;
  /** 1-based lap that owned the fastest split at this position. */
  sourceLapIndex: number;
  durationMs: number;
  /** Distance at start of mini-sector on the *best* lap, in metres. */
  dStart: number;
  /** Distance at end of mini-sector on the *best* lap, in metres. */
  dEnd: number;
  /** Best lap's own duration through this mini-sector — for "gap to ideal" rendering. */
  bestLapDurationMs: number;
}

export interface SessionImprovementIdealLap {
  totalMs: number;
  miniSectorCount: number;
  miniSectors: SessionImprovementIdealMiniSector[];
}

export interface SessionImprovementOpportunity {
  /** 1-based corner index in detection order along the best lap. */
  cornerIndex: number;
  dEntry: number;
  dApex: number;
  dExit: number;
  /** Time-loss vs the lap that drove this corner fastest, in ms. Always > 0. */
  deltaMs: number;
  /** 1-based lap that drove this corner fastest. */
  fastestLapIndex: number;
  /** Best lap's apex speed (km/h). */
  bestApexKmh: number;
  /** Fastest-corner lap's apex speed in the proportional region (km/h). */
  fastestApexKmh: number;
  /** Best lap's velocity at corner exit (km/h). */
  bestExitKmh: number;
  /** Fastest-corner lap's velocity at the proportional exit position (km/h). */
  fastestExitKmh: number;
  /** Plain-text observations derived from the numerical deltas. */
  observations: string[];
}

/**
 * `lapvisor-session-improvement/v1` bundle — session-level "where can I find time?"
 * payload. v1 carries best-lap reference + ideal-lap (best-of-each-mini-sector)
 * trace. Future minor evolutions add optional fields (e.g. corner-level
 * opportunities) without breaking v1 consumers.
 *
 * Spec: [`docs/formats/lapvisor-session-improvement-v1.md`](../../docs/formats/lapvisor-session-improvement-v1.md).
 */
export interface SessionImprovementBundle {
  schema: "lapvisor-session-improvement/v1";
  source: BundleSource;
  meta: BundleMeta;
  /** Number of detected laps used to compose the ideal lap. */
  lapCount: number;
  bestLap: SessionImprovementBestLap;
  idealLap: SessionImprovementIdealLap;
  /** `bestLap.durationMs - idealLap.totalMs`. Always >= 0. */
  gapToIdealMs: number;
  /**
   * Optional ranked corner-level opportunities (added in a minor evolution of
   * `v1`). Present when produced by `lapvisor improve`; omitted from
   * `lapvisor ideal` to keep the default bundle small. `v1` consumers that
   * ignore unknown fields are unaffected.
   */
  topOpportunities?: SessionImprovementOpportunity[];
}

/**
 * Compact lap-time summary emitted by `lapvisor laps` and produced by
 * {@link "./laps-summary.js".buildLapsSummary}. Best/mean undefined when there
 * are no laps.
 */
export interface LapsSummary {
  source: string;
  format: Session["format"];
  lapCount: number;
  bestMs?: number;
  meanMs?: number;
  meta?: Session["meta"];
}
