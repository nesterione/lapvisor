import { describe, expect, test } from "bun:test";
import { parseKartTrack, TrackLoadError } from "../src/track/loader.js";

const VALID_TRACK = {
  type: "FeatureCollection",
  name: "Test Track",
  properties: {
    schema: "kart-track/v1",
    center: [25, 55] as [number, number],
  },
  features: [
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [25.0, 55.0],
          [25.0001, 55.0001],
        ],
      },
      properties: {
        id: "g1",
        kind: "start_finish",
        name: "S/F",
        order: 0,
        bearing_deg: 0,
        width_m: 12,
        unidirectional: false,
        center: [25.00005, 55.00005],
      },
    },
  ],
};

describe("parseKartTrack", () => {
  test("parses a valid kart-track/v1 FeatureCollection", () => {
    const track = parseKartTrack(JSON.stringify(VALID_TRACK));
    expect(track.name).toBe("Test Track");
    expect(track.features).toHaveLength(1);
    expect(track.features[0].properties.kind).toBe("start_finish");
  });

  test("throws TrackLoadError on invalid JSON", () => {
    expect(() => parseKartTrack("{not json", "fake.json")).toThrow(
      TrackLoadError,
    );
    expect(() => parseKartTrack("{not json", "fake.json")).toThrow(
      /fake.json: invalid JSON/,
    );
  });

  test("throws TrackLoadError when the schema field is wrong", () => {
    const wrong = { ...VALID_TRACK, properties: { schema: "kart-track/v999", center: [0, 0] } };
    expect(() => parseKartTrack(JSON.stringify(wrong), "x.json")).toThrow(
      /not a kart-track\/v1 FeatureCollection/,
    );
  });

  test("throws TrackLoadError when type is not FeatureCollection", () => {
    const wrong = { ...VALID_TRACK, type: "Feature" };
    expect(() => parseKartTrack(JSON.stringify(wrong))).toThrow(TrackLoadError);
  });

  test("throws TrackLoadError when features is not an array", () => {
    const wrong = { ...VALID_TRACK, features: null };
    expect(() => parseKartTrack(JSON.stringify(wrong))).toThrow(TrackLoadError);
  });
});
