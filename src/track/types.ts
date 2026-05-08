/**
 * `kart-track/v1` — GeoJSON FeatureCollection of trap gates produced by the
 * sibling `karting` repo (`kart track convert`). Imported here so lapvisor can
 * use authored start_finish + sector gates for lap detection and overlay.
 *
 * Spec: https://github.com/nesterione/karting/blob/main/docs/formats/kart-track-v1.md
 */

export type LonLat = [number, number]; // [longitude, latitude]

export type KartTrapKind = "start_finish" | "sector" | "unknown";

export interface KartTrackFeatureProperties {
  id: string;
  kind: KartTrapKind;
  name: string;
  order: number;
  bearing_deg: number;
  width_m: number;
  unidirectional: boolean;
  center: LonLat;
  raw_type?: number;
}

export interface KartTrackFeature {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: [LonLat, LonLat];
  };
  properties: KartTrackFeatureProperties;
}

export interface KartTrack {
  type: "FeatureCollection";
  name: string;
  properties: {
    schema: "kart-track/v1";
    source?: { format: string; file: string };
    center: LonLat;
  };
  features: KartTrackFeature[];
}
