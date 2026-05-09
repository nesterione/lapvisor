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
