import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { detectLaps, type LapDetectionOptions } from "../analysis/laps.js";
import type { Lap, Session } from "../model.js";
import { parseVbo } from "./vbo.js";

export class UnsupportedFormatError extends Error {
  constructor(extension: string) {
    super(
      `unsupported file format "${extension}" — supported: .vbo (more adapters planned)`,
    );
    this.name = "UnsupportedFormatError";
  }
}

export interface LoadSessionOptions {
  /** Forwarded to the lap-detection step when the format carries gates. */
  lapDetection?: LapDetectionOptions;
}

/**
 * Reads a telemetry file and returns the common `Session` shape. Format is
 * dispatched by file extension. Each adapter does its own parsing, then any
 * format that carries gate definitions also runs lap detection so the returned
 * `Session.laps` is populated.
 */
export async function loadSession(
  path: string,
  opts: LoadSessionOptions = {},
): Promise<Session> {
  const ext = extname(path).toLowerCase();
  switch (ext) {
    case ".vbo":
      return loadVboSession(path, opts);
    default:
      throw new UnsupportedFormatError(ext || "<no extension>");
  }
}

async function loadVboSession(
  path: string,
  opts: LoadSessionOptions,
): Promise<Session> {
  const text = await readFile(path, "utf8");
  const file = parseVbo(text, path);
  const { laps: detected } = detectLaps(
    file.samples,
    file.gates,
    opts.lapDetection,
  );

  const laps: Lap[] = detected.map((l) => ({
    index: l.index,
    durationMs: l.durationMs,
    startMs: l.startTimestampMs ?? l.startTimeOfDayMs,
  }));

  return {
    source: path,
    format: "vbo",
    laps,
    meta: {
      venue: file.comments.Venue,
      serialNumber: file.comments["Serial Number"],
      startedAt: file.startedAt?.toISOString(),
      sampleCount: file.samples.length,
      gateCount: file.gates.length,
    },
  };
}
