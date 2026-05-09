/**
 * Public SDK barrel for telemetry-format adapters. Imported as
 * `lapvisor/adapters`.
 *
 * Pure parsers (`parseVbo`, `loadSessionFromText`) operate on strings and are
 * browser-safe. The path-based wrappers (`loadSession`) read files via
 * `node:fs/promises` and are Node-only.
 */

export {
  type LoadSessionFromTextOptions,
  type LoadSessionOptions,
  loadSession,
  loadSessionFromText,
  UnsupportedFormatError,
} from "../adapters/index.js";
export {
  decodeVboCoord,
  decodeVboTime,
  type LatLng,
  parseVbo,
  type VboFile,
  type VboGate,
  VboParseError,
  type VboSample,
} from "../adapters/vbo.js";
