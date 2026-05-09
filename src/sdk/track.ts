/**
 * Public SDK barrel for kart-track/v1 tooling — the GeoJSON track schema,
 * builders, and gate-geometry helpers. Imported as `lapvisor/track`.
 *
 * Spec: docs/formats/kart-track-v1.md
 */

export {
  buildKartTrack,
  destination,
  gateEndpoints,
  recomputeEndpoints,
} from "../track/geojson.js";
export {
  type KartTrackIntent,
  type KartTrackIntentFeature,
  kartTrackIntentSchema,
} from "../track/intent.js";
export {
  loadKartTrack,
  parseKartTrack,
  TrackLoadError,
  trackGatesToVboGates,
} from "../track/loader.js";
export type {
  KartTrack,
  KartTrackFeature,
  KartTrackFeatureProperties,
  KartTrapKind,
  LonLat,
} from "../track/types.js";
