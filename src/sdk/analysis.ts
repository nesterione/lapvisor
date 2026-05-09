/**
 * Public SDK barrel for analysis primitives — pure functions that operate on
 * the canonical session/sample shapes. Imported as `lapvisor/analysis`.
 */

export {
  type LapAggregates,
  lapAggregates,
} from "../analysis/aggregates.js";
export { cumulativeDistance } from "../analysis/distance.js";
export {
  extractLap,
  type LapDetail,
  type LapSector,
  type RichSample,
} from "../analysis/lap-detail.js";
export {
  type DetectedLap,
  detectLaps,
  type LapCrossing,
  type LapDetectionOptions,
  type LapDetectionResult,
  NoStartGateError,
  type RejectedCrossing,
} from "../analysis/laps.js";
export {
  detectSectorSplits,
  type LapSectorSplits,
  type SectorSplit,
} from "../analysis/sectors.js";
export {
  buildSessionSummary,
  type SessionBestSector,
  type SessionLapSummary,
  type SessionSummary,
  type SessionSummarySector,
  summarizeLap,
} from "../analysis/session-summary.js";
