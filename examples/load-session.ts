/**
 * Load a session file from disk and report a quick summary.
 *
 * SDK surface: `lapvisor/adapters` — `loadSession`.
 *
 * Run from this repo:
 *   bun run examples/load-session.ts samples/sample.vbo
 *
 * In a consuming project:
 *   import { loadSession } from "lapvisor/adapters";
 */

import { loadSession } from "../src/sdk/adapters.js";

export interface LoadSessionExampleResult {
  source: string;
  format: string;
  lapCount: number;
  venue?: string;
  bestLapMs?: number;
}

export async function loadSessionExample(
  path: string,
): Promise<LoadSessionExampleResult> {
  const session = await loadSession(path);
  const durations = session.laps.map((l) => l.durationMs);
  return {
    source: session.source,
    format: session.format,
    lapCount: session.laps.length,
    venue: session.meta?.venue,
    bestLapMs: durations.length > 0 ? Math.min(...durations) : undefined,
  };
}

if (import.meta.main) {
  const path =
    process.argv[2] ??
    "samples/RaceBox Track Sessionon 05-05-2026 19-35.vbo";
  const result = await loadSessionExample(path);
  console.log(result);
}
