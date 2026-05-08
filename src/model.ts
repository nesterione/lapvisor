export type SessionFormat = "gpx" | "fit" | "tcx" | "lap-csv" | "vbo";

export interface Lap {
  index: number;
  durationMs: number;
  /** Time-of-day in ms when known (HHMMSS-derived); absolute UTC epoch ms when the source carries a date. */
  startMs?: number;
}

export interface Session {
  source: string;
  format: SessionFormat;
  laps: Lap[];
  meta?: Record<string, unknown>;
}
