/**
 * Parser for the Racelogic VBOX text format (`.vbo`), as written by RaceBox and
 * other VBOX-compatible tools. The format is line-oriented ASCII organized into
 * `[section]` blocks: `[header]`, `[comments]`, `[laptiming]`, `[column names]`,
 * `[data]`. Only the parser lives here — mapping to the common `Session` shape
 * (lap detection from gates) is a separate step.
 */

export interface LatLng {
  latDeg: number;
  lngDeg: number;
}

export interface VboGate {
  /** Free-form label that follows the `¬` separator, e.g. "Start / Finish". */
  label: string;
  /** First column of the gate line. `Start` defines the start/finish; `Split` defines a sector split. */
  kind: "start" | "split" | "other";
  pointA: LatLng;
  pointB: LatLng;
}

export interface VboSample {
  /** Milliseconds since the start of the UTC day (from HHMMSS.ss). */
  timeOfDayMs: number;
  /** Absolute UTC epoch ms. Present only when `[comments]` carried a start date. */
  timestampMs?: number;
  latDeg: number;
  lngDeg: number;
  velocityKmh: number;
  heading: number;
  heightM: number;
  longAccG?: number;
  latAccG?: number;
  vertAccG?: number;
  gyroXDegSec?: number;
  gyroYDegSec?: number;
  gyroZDegSec?: number;
  sats?: number;
  /** Channels present in `[data]` that the parser does not recognize by name. */
  extra?: Record<string, number>;
}

export interface VboFile {
  source: string;
  /** `Key : Value` pairs from `[comments]`. */
  comments: Record<string, string>;
  /** Parsed from `UTC Date Started` if present. */
  startedAt?: Date;
  /** Canonical channel keys (one per `[data]` column), derived from `[column names]`. */
  channels: string[];
  /** Verbatim `[header]` tokens (one per channel, descriptive). */
  channelLabels: string[];
  gates: VboGate[];
  samples: VboSample[];
}

export class VboParseError extends Error {
  readonly line: number | undefined;
  constructor(message: string, line?: number) {
    super(line !== undefined ? `[line ${line}] ${message}` : message);
    this.name = "VboParseError";
    this.line = line;
  }
}

/**
 * Maps a token from `[header]` or `[column names]` to a stable canonical key.
 * Comparison is case-insensitive. Unknown tokens are normalized but kept verbatim
 * (lowercased) so they end up in `VboSample.extra` rather than being silently dropped.
 */
const CHANNEL_ALIASES: Record<string, string> = {
  time: "time",
  lat: "lat",
  latitude: "lat",
  lng: "lng",
  long: "lng",
  longitude: "lng",
  velocity: "velocityKmh",
  "velocity kmh": "velocityKmh",
  heading: "heading",
  height: "heightM",
  longacc: "longAccG",
  latacc: "latAccG",
  vertacc: "vertAccG",
  "x-rotation-gyroscope": "gyroXDegSec",
  "y-rotation-gyroscope": "gyroYDegSec",
  "z-rotation-gyroscope": "gyroZDegSec",
  sats: "sats",
  satellites: "sats",
};

function canonicalChannel(token: string): string {
  const key = token.trim().toLowerCase();
  return CHANNEL_ALIASES[key] ?? key;
}

/**
 * Parse a Racelogic VBOX text file. Pure function — takes the file content as
 * a string, returns a typed object. No file I/O, browser-safe.
 *
 * @param text - The full `.vbo` file content.
 * @param source - Label used in error messages and stored on the returned `VboFile`.
 * @returns A parsed `VboFile` (samples, gates, comments, channel layout).
 * @throws {VboParseError} on structural problems (missing sections, bad coords, etc.).
 * @see {@link ../../docs/formats/vbo.md | docs/formats/vbo.md}
 * @example
 * ```ts
 * import { parseVbo } from "lapvisor/adapters";
 * import { readFile } from "node:fs/promises";
 * const file = parseVbo(await readFile("session.vbo", "utf8"), "session.vbo");
 * console.log(file.samples.length, "samples,", file.gates.length, "gates");
 * ```
 */
export function parseVbo(text: string, source = "<input>"): VboFile {
  const lines = text.split(/\r?\n/);

  const comments: Record<string, string> = {};
  const channelLabels: string[] = [];
  let channels: string[] = [];
  const gates: VboGate[] = [];
  const dataLines: { lineNo: number; text: string }[] = [];

  let section: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const sectionMatch = /^\[([^\]]+)\]\s*$/.exec(trimmed);
    if (sectionMatch) {
      section = sectionMatch[1].trim().toLowerCase();
      continue;
    }

    const lineNo = i + 1;
    switch (section) {
      case "header":
        channelLabels.push(trimmed);
        break;
      case "comments": {
        const sep = trimmed.indexOf(":");
        if (sep > 0) {
          const key = trimmed.slice(0, sep).trim();
          const value = trimmed.slice(sep + 1).trim();
          if (key) comments[key] = value;
        }
        break;
      }
      case "laptiming":
        gates.push(parseGate(trimmed, lineNo));
        break;
      case "column names":
        channels = trimmed.split(/\s+/).map(canonicalChannel);
        break;
      case "data":
        dataLines.push({ lineNo, text: trimmed });
        break;
      default:
        // Pre-section lines (e.g. the "File created on …" banner) are ignored.
        break;
    }
  }

  if (channels.length === 0) {
    if (channelLabels.length === 0) {
      throw new VboParseError(
        "missing [column names] and [header] — cannot decode data rows",
      );
    }
    channels = channelLabels.map(canonicalChannel);
  }

  if (channelLabels.length > 0 && channelLabels.length !== channels.length) {
    throw new VboParseError(
      `[header] has ${channelLabels.length} channels but [column names] has ${channels.length}`,
    );
  }

  const startedAt = parseStartDate(comments);
  const dayStartMs = startedAt
    ? Date.UTC(
        startedAt.getUTCFullYear(),
        startedAt.getUTCMonth(),
        startedAt.getUTCDate(),
      )
    : undefined;

  const samples = dataLines.map(({ lineNo, text: row }) =>
    parseSampleRow(row, channels, lineNo, dayStartMs),
  );

  return {
    source,
    comments,
    startedAt,
    channels,
    channelLabels,
    gates,
    samples,
  };
}

/**
 * Decodes a VBOX coordinate token (signed minutes, e.g. `+03283.51691`) into
 * decimal degrees. `kind` controls the longitude sign convention: VBOX stores
 * longitude with **West positive / East negative**, which we flip so callers
 * always get standard E-positive decimal degrees.
 */
export function decodeVboCoord(token: string, kind: "lat" | "lng"): number {
  const minutes = Number(token);
  if (!Number.isFinite(minutes)) {
    throw new VboParseError(`expected numeric minutes, got "${token}"`);
  }
  const deg = minutes / 60;
  return kind === "lng" ? -deg : deg;
}

/**
 * Decodes a VBOX time-of-day token (`HHMMSS.ss`, UTC) to milliseconds since
 * the start of the day. `163508.04` → 16h 35m 08.04s → 59_708_040 ms.
 */
export function decodeVboTime(token: string): number {
  const value = Number(token);
  if (!Number.isFinite(value)) {
    throw new VboParseError(`expected HHMMSS.ss time, got "${token}"`);
  }
  const hours = Math.floor(value / 10000);
  const minutes = Math.floor((value % 10000) / 100);
  const seconds = value - hours * 10000 - minutes * 100;
  return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
}

function parseGate(line: string, lineNo: number): VboGate {
  // The label after `¬` is optional but conventional. Strip it off first so it
  // doesn't get caught by the whitespace split on numeric columns.
  const sepIdx = line.indexOf("¬");
  const head = (sepIdx >= 0 ? line.slice(0, sepIdx) : line).trim();
  const label = sepIdx >= 0 ? line.slice(sepIdx + 1).trim() : "";

  const tokens = head.split(/\s+/);
  if (tokens.length < 5) {
    throw new VboParseError(
      `expected "<kind> <latA> <lngA> <latB> <lngB>" in [laptiming], got "${line}"`,
      lineNo,
    );
  }

  const [kindToken, latA, lngA, latB, lngB] = tokens;
  const kindLower = kindToken.toLowerCase();
  const kind: VboGate["kind"] =
    kindLower === "start" ? "start" : kindLower === "split" ? "split" : "other";

  return {
    label,
    kind,
    pointA: {
      latDeg: decodeVboCoord(latA, "lat"),
      lngDeg: decodeVboCoord(lngA, "lng"),
    },
    pointB: {
      latDeg: decodeVboCoord(latB, "lat"),
      lngDeg: decodeVboCoord(lngB, "lng"),
    },
  };
}

function parseSampleRow(
  row: string,
  channels: string[],
  lineNo: number,
  dayStartMs: number | undefined,
): VboSample {
  const tokens = row.split(/\s+/);
  if (tokens.length !== channels.length) {
    throw new VboParseError(
      `expected ${channels.length} columns, got ${tokens.length}`,
      lineNo,
    );
  }

  const sample: VboSample = {
    timeOfDayMs: 0,
    latDeg: Number.NaN,
    lngDeg: Number.NaN,
    velocityKmh: Number.NaN,
    heading: Number.NaN,
    heightM: Number.NaN,
  };

  let extra: Record<string, number> | undefined;
  for (let c = 0; c < channels.length; c++) {
    const channel = channels[c];
    const token = tokens[c];

    switch (channel) {
      case "time":
        sample.timeOfDayMs = decodeVboTime(token);
        break;
      case "lat":
        sample.latDeg = decodeVboCoord(token, "lat");
        break;
      case "lng":
        sample.lngDeg = decodeVboCoord(token, "lng");
        break;
      case "velocityKmh":
        sample.velocityKmh = parseNumber(token, channel, lineNo);
        break;
      case "heading":
        sample.heading = parseNumber(token, channel, lineNo);
        break;
      case "heightM":
        sample.heightM = parseNumber(token, channel, lineNo);
        break;
      case "longAccG":
        sample.longAccG = parseNumber(token, channel, lineNo);
        break;
      case "latAccG":
        sample.latAccG = parseNumber(token, channel, lineNo);
        break;
      case "vertAccG":
        sample.vertAccG = parseNumber(token, channel, lineNo);
        break;
      case "gyroXDegSec":
        sample.gyroXDegSec = parseNumber(token, channel, lineNo);
        break;
      case "gyroYDegSec":
        sample.gyroYDegSec = parseNumber(token, channel, lineNo);
        break;
      case "gyroZDegSec":
        sample.gyroZDegSec = parseNumber(token, channel, lineNo);
        break;
      case "sats":
        sample.sats = Math.trunc(parseNumber(token, channel, lineNo));
        break;
      default:
        if (!extra) extra = {};
        extra[channel] = parseNumber(token, channel, lineNo);
    }
  }

  if (extra) sample.extra = extra;
  if (dayStartMs !== undefined)
    sample.timestampMs = dayStartMs + sample.timeOfDayMs;
  return sample;
}

function parseNumber(token: string, channel: string, lineNo: number): number {
  const n = Number(token);
  if (!Number.isFinite(n)) {
    throw new VboParseError(
      `channel "${channel}" expected number, got "${token}"`,
      lineNo,
    );
  }
  return n;
}

/**
 * Parses `UTC Date Started : DD/MM/YYYY HH:MM` from `[comments]`. RaceBox writes
 * day-first; we accept that as the only form and ignore other keys/locales for now.
 * Returns `undefined` when the field is missing or unparseable so callers can
 * still operate on time-of-day only.
 */
function parseStartDate(comments: Record<string, string>): Date | undefined {
  const raw = comments["UTC Date Started"];
  if (!raw) return undefined;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/.exec(raw);
  if (!m) return undefined;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const hour = m[4] ? Number(m[4]) : 0;
  const minute = m[5] ? Number(m[5]) : 0;
  const ms = Date.UTC(year, month - 1, day, hour, minute);
  return Number.isFinite(ms) ? new Date(ms) : undefined;
}
