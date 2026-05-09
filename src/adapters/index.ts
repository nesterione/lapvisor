/**
 * Format-dispatch entry point for telemetry adapters. Public SDK barrel:
 * `lapvisor/adapters`.
 *
 * Two layers:
 * - {@link loadSessionFromText} — pure, browser-safe, takes a string in.
 * - {@link loadSession} — Node-only, reads the file via `node:fs/promises` and
 *   delegates to `loadSessionFromText`.
 */

import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { detectLaps, type LapDetectionOptions } from "../analysis/laps.js";
import type { Lap, Session, SessionFormat } from "../model.js";
import { parseVbo } from "./vbo.js";

/** Thrown when an unknown extension or `SessionFormat` is requested. */
export class UnsupportedFormatError extends Error {
  constructor(formatOrExtension: string) {
    super(
      `unsupported file format "${formatOrExtension}" — supported: .vbo (more adapters planned)`,
    );
    this.name = "UnsupportedFormatError";
  }
}

export interface LoadSessionOptions {
  /** Forwarded to the lap-detection step when the format carries gates. */
  lapDetection?: LapDetectionOptions;
}

export interface LoadSessionFromTextOptions extends LoadSessionOptions {
  /** Recorded as `Session.source`. Defaults to `"<input>"`. */
  source?: string;
}

/**
 * Pure variant of {@link loadSession}. Takes the file content as a string,
 * dispatches by explicit `format`, and returns a `Session`. No file I/O,
 * browser-safe.
 *
 * @param text - The full file content.
 * @param format - One of {@link SessionFormat}. Currently only `"vbo"` is implemented.
 * @param opts - Optional `source` label and `lapDetection` overrides.
 * @returns A normalised `Session`.
 * @throws {UnsupportedFormatError} when `format` is not recognised.
 * @example
 * ```ts
 * import { loadSessionFromText } from "lapvisor/adapters";
 * const text = await fetch("/data/session.vbo").then((r) => r.text());
 * const session = loadSessionFromText(text, "vbo", { source: "session.vbo" });
 * ```
 */
export function loadSessionFromText(
  text: string,
  format: SessionFormat,
  opts: LoadSessionFromTextOptions = {},
): Session {
  switch (format) {
    case "vbo":
      return vboTextToSession(text, opts.source ?? "<input>", opts);
    default:
      throw new UnsupportedFormatError(format);
  }
}

/**
 * Reads a telemetry file from disk and returns the canonical `Session` shape.
 * Format is dispatched by file extension; the actual parsing happens in
 * {@link loadSessionFromText}.
 *
 * @param path - Path to the file.
 * @param opts - Lap-detection overrides forwarded to the chosen adapter.
 * @returns A `Session` whose `source` is set to `path`.
 * @throws {UnsupportedFormatError} when the file extension isn't recognised.
 * @example
 * ```ts
 * import { loadSession } from "lapvisor/adapters";
 * const session = await loadSession("session.vbo");
 * console.log(session.laps.length);
 * ```
 */
export async function loadSession(
  path: string,
  opts: LoadSessionOptions = {},
): Promise<Session> {
  const ext = extname(path).toLowerCase();
  const format = extensionToFormat(ext);
  const text = await readFile(path, "utf8");
  return loadSessionFromText(text, format, { ...opts, source: path });
}

function extensionToFormat(ext: string): SessionFormat {
  switch (ext) {
    case ".vbo":
      return "vbo";
    default:
      throw new UnsupportedFormatError(ext || "<no extension>");
  }
}

function vboTextToSession(
  text: string,
  source: string,
  opts: LoadSessionOptions,
): Session {
  const file = parseVbo(text, source);
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
    source,
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
