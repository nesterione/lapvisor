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
  type BuildLapBundleInput,
  buildLapBundle,
} from "../bundles/lap-v1.js";
export { buildLapsSummary } from "../bundles/laps-summary.js";
export {
  type BuildSessionBundleInput,
  buildSessionBundle,
} from "../bundles/session-v2.js";
export type {
  BundleMeta,
  BundleSource,
  LapBundle,
  LapsSummary,
  SessionBundle,
  SessionBundleLap,
  SessionBundleLapSectorSplits,
  SessionBundleSample,
  SessionBundleSectorSplit,
  SessionGate,
} from "../bundles/types.js";
