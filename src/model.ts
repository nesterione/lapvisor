export type SessionFormat = "gpx" | "fit" | "tcx" | "lap-csv";

export interface Lap {
  index: number;
  durationMs: number;
  startMs?: number;
}

export interface Session {
  source: string;
  format: SessionFormat;
  laps: Lap[];
  meta?: Record<string, unknown>;
}
