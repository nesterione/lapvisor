/**
 * Public SDK barrel for multi-lap comparison primitives — pure functions for
 * computing where one lap gained/lost time against another. Imported as
 * `lapvisor/compare`.
 *
 * Pairs naturally with `lapvisor/analysis` (single-lap primitives) and
 * `lapvisor/bundles` (wire-format producers like `buildLapComparisonBundle`).
 */

export {
  type CornerComparison,
  compareCorners,
} from "../compare/corners.js";
export {
  type ComputeDeltaTOptions,
  computeDeltaT,
  type DeltaTResult,
} from "../compare/delta-t.js";
export {
  type BuildImprovementOptions,
  buildImprovementReport,
  type ImprovementLapInput,
  type ImprovementOpportunity,
  type ImprovementReport,
} from "../compare/improve.js";
export {
  type CompareLapsOptions,
  type CompareLapsResult,
  compareLaps,
  type MiniSectorDelta,
} from "../compare/lap-vs-lap.js";
