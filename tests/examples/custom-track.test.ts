import { describe, expect, test } from "bun:test";
import { buildCustomTrack } from "../../examples/custom-track.js";

describe("examples/custom-track", () => {
  test("produces a valid kart-track/v1 FeatureCollection", () => {
    const track = buildCustomTrack();
    expect(track.type).toBe("FeatureCollection");
    expect(track.properties.schema).toBe("kart-track/v1");
    expect(track.features.length).toBeGreaterThan(0);
    for (const f of track.features) {
      expect(f.geometry.type).toBe("LineString");
      expect(f.geometry.coordinates).toHaveLength(2);
    }
  });
});
