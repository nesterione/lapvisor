import type { Session } from "../model.js";
import type { LapsSummary } from "./types.js";

/**
 * Compact a {@link Session} into the lap-summary shape emitted by
 * `lapvisor laps`: count, best, mean, source/format, and pass-through meta.
 *
 * @param session - A normalised session from `loadSession` / `loadSessionFromText`.
 * @returns A `LapsSummary` with `bestMs`/`meanMs` undefined when there are no laps.
 */
export function buildLapsSummary(session: Session): LapsSummary {
  const durations = session.laps.map((l) => l.durationMs);
  const base: LapsSummary = {
    source: session.source,
    format: session.format,
    lapCount: durations.length,
    meta: session.meta,
  };
  if (durations.length === 0) return base;
  base.bestMs = Math.min(...durations);
  base.meanMs = Math.round(
    durations.reduce((a, b) => a + b, 0) / durations.length,
  );
  return base;
}
