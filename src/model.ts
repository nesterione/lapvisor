/**
 * Canonical session/lap model. Every adapter normalises to these shapes;
 * every analysis function reads them. Public SDK barrel: `lapvisor/model`.
 */

/** Telemetry input formats lapvisor knows how to dispatch. Currently only `"vbo"` is implemented; the others are reserved. */
export type SessionFormat = "gpx" | "fit" | "tcx" | "lap-csv" | "vbo";

/** A single timed lap inside a `Session`. */
export interface Lap {
  /** 1-based lap number in detection order. */
  index: number;
  /** Lap duration in milliseconds, full precision. */
  durationMs: number;
  /**
   * Lap-start timestamp. Time-of-day in ms (HHMMSS-derived) when no calendar
   * date is known; absolute UTC epoch ms when the source carries a date.
   */
  startMs?: number;
}

/**
 * One outing — the canonical shape every adapter produces and every analysis
 * function consumes.
 */
export interface Session {
  /** Source identifier — typically the input path, or `"<input>"` for in-memory text. */
  source: string;
  format: SessionFormat;
  laps: Lap[];
  /** Free-form per-source metadata: `venue`, `startedAt`, `serialNumber`, `sampleCount`, … */
  meta?: Record<string, unknown>;
}
