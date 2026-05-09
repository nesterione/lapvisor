/**
 * Build a `kart-track/v1` GeoJSON track from a structured intent — describe
 * gates by `(center, bearing_deg, width_m)` and lapvisor computes the
 * LineString endpoints.
 *
 * SDK surface: `lapvisor/track` — `buildKartTrack`, `kartTrackIntentSchema`.
 *
 * Run from this repo:
 *   bun run examples/custom-track.ts
 *
 * In a consuming project:
 *   import { buildKartTrack, kartTrackIntentSchema } from "lapvisor/track";
 */

import {
  buildKartTrack,
  type KartTrackIntent,
  kartTrackIntentSchema,
} from "../src/sdk/track.js";

const intent: KartTrackIntent = {
  name: "Demo Track",
  center: [25.279, 54.687],
  features: [
    {
      id: "sf",
      kind: "start_finish",
      name: "Start / Finish",
      order: 0,
      bearing_deg: 90,
      width_m: 12,
      unidirectional: false,
      center: [25.279, 54.687],
    },
    {
      id: "s1",
      kind: "sector",
      name: "S1",
      order: 1,
      bearing_deg: 90,
      width_m: 10,
      unidirectional: false,
      center: [25.28, 54.6875],
    },
  ],
};

export function buildCustomTrack(): ReturnType<typeof buildKartTrack> {
  // Validate at the boundary; in real apps this often comes from JSON input.
  const validated = kartTrackIntentSchema.parse(intent);
  return buildKartTrack(validated);
}

if (import.meta.main) {
  const track = buildCustomTrack();
  console.log(JSON.stringify(track, null, 2));
}
