import type { LapAggregates } from "./aggregates.js";
import type { LapDetail } from "./lap-detail.js";

export interface SessionSummarySector {
  /** Zero-based sector segment index within the lap. */
  sectorIndex: number;
  label: string;
  /** Elapsed time to the end of this sector segment. */
  offsetMs: number;
  /** Duration of this sector segment only. */
  durationMs: number;
  /** Distance at the end of this sector segment. */
  distanceM: number;
}

export interface SessionLapSummary {
  index: number;
  durationMs: number;
  startTimestampMs?: number;
  distanceM: number;
  sectors: SessionSummarySector[];
  aggregates: LapAggregates;
}

export interface SessionBestSector {
  sectorIndex: number;
  label: string;
  durationMs: number;
  lapIndex: number;
}

export interface SessionSummary {
  bestLapMs?: number;
  bestLapIndex?: number;
  bestSectors: SessionBestSector[];
  theoreticalBestMs?: number;
  sectorCount: number;
}

/**
 * Compact a {@link LapDetail} into the summary shape used by
 * `lapvisor-session/v2`. Splits sector cumulative offsets into per-segment
 * durations and appends a synthetic `"Finish"` segment when sectors are
 * present. Pure.
 *
 * @param detail - Per-lap detail produced by `extractLap`.
 * @returns The lap's summary block (sectors, aggregates, totals).
 */
export function summarizeLap(detail: LapDetail): SessionLapSummary {
  const sectors: SessionSummarySector[] = [];
  let prevOffsetMs = 0;

  for (let i = 0; i < detail.sectors.length; i++) {
    const sector = detail.sectors[i];
    const durationMs = Math.max(0, sector.offsetMs - prevOffsetMs);
    sectors.push({
      sectorIndex: i,
      label: sector.label || `S${i + 1}`,
      offsetMs: sector.offsetMs,
      durationMs,
      distanceM: sector.distanceM,
    });
    prevOffsetMs = sector.offsetMs;
  }

  if (detail.sectors.length > 0) {
    const finalIndex = detail.sectors.length;
    const finalDurationMs = Math.max(0, detail.lap.durationMs - prevOffsetMs);
    sectors.push({
      sectorIndex: finalIndex,
      label: "Finish",
      offsetMs: detail.lap.durationMs,
      durationMs: finalDurationMs,
      distanceM: detail.lap.distanceM,
    });
  }

  const summary: SessionLapSummary = {
    index: detail.lap.index,
    durationMs: detail.lap.durationMs,
    distanceM: detail.lap.distanceM,
    sectors,
    aggregates: detail.aggregates,
  };
  if (detail.lap.startTimestampMs !== undefined) {
    summary.startTimestampMs = detail.lap.startTimestampMs;
  }
  return summary;
}

/**
 * Aggregate per-lap summaries into a session-level summary: best lap,
 * per-sector best splits across all laps, and the theoretical-best lap time
 * (sum of best per-sector splits). Pure.
 *
 * @param lapSummaries - One entry per detected lap.
 * @returns Session-level best-of metrics.
 */
export function buildSessionSummary(
  lapSummaries: SessionLapSummary[],
): SessionSummary {
  if (lapSummaries.length === 0) {
    return {
      bestSectors: [],
      sectorCount: 0,
    };
  }

  let bestLap = lapSummaries[0];
  let sectorCount = 0;
  for (const lap of lapSummaries) {
    if (lap.durationMs < bestLap.durationMs) bestLap = lap;
    if (lap.sectors.length > sectorCount) sectorCount = lap.sectors.length;
  }

  const bestSectors: SessionBestSector[] = [];
  for (let sectorIndex = 0; sectorIndex < sectorCount; sectorIndex++) {
    let best: SessionBestSector | null = null;
    for (const lap of lapSummaries) {
      const sector = lap.sectors[sectorIndex];
      if (!sector) continue;
      if (!best || sector.durationMs < best.durationMs) {
        best = {
          sectorIndex,
          label: sector.label,
          durationMs: sector.durationMs,
          lapIndex: lap.index,
        };
      }
    }
    if (best) bestSectors.push(best);
  }

  const summary: SessionSummary = {
    bestLapMs: bestLap.durationMs,
    bestLapIndex: bestLap.index,
    bestSectors,
    sectorCount,
  };
  if (bestSectors.length > 0) {
    summary.theoreticalBestMs = bestSectors.reduce(
      (acc, sector) => acc + sector.durationMs,
      0,
    );
  }
  return summary;
}
