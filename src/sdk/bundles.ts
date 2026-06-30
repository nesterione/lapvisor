/**
 * Public SDK barrel for bundle producers — versioned wire-format builders that
 * any client (CLI, web UI, agent) can use to emit identical artifacts.
 * Imported as `lapvisor/bundles`.
 *
 * Schemas:
 * - `lapvisor-lap/v1` (see docs/formats/lapvisor-lap-v1.md)
 * - `lapvisor-session/v2` (see docs/formats/lapvisor-session-v2.md)
 */

export {
  type BuildLapComparisonInput,
  buildLapComparisonBundle,
} from "../bundles/lap-compare-v1.js";
export {
  type BuildLapBundleInput,
  buildLapBundle,
} from "../bundles/lap-v1.js";
export { buildLapsSummary } from "../bundles/laps-summary.js";
export {
  type BuildSessionImprovementInput,
  buildSessionImprovementBundle,
} from "../bundles/session-improvement-v1.js";
export {
  type BuildSessionBundleInput,
  buildSessionBundle,
} from "../bundles/session-v2.js";
export type {
  BundleMeta,
  BundleSource,
  LapBundle,
  LapCompareBundle,
  LapCompareCorner,
  LapCompareDeltaT,
  LapCompareLapRef,
  LapCompareMiniSector,
  LapsSummary,
  SessionBundle,
  SessionBundleLap,
  SessionBundleLapSectorSplits,
  SessionBundleSample,
  SessionBundleSectorSplit,
  SessionGate,
  SessionImprovementBestLap,
  SessionImprovementBundle,
  SessionImprovementIdealLap,
  SessionImprovementIdealMiniSector,
  SessionImprovementOpportunity,
} from "../bundles/types.js";
