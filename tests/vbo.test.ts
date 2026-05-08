import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";
import {
  decodeVboCoord,
  decodeVboTime,
  parseVbo,
  VboParseError,
} from "../src/adapters/vbo.js";

const fixturePath = fileURLToPath(new URL("./fixtures/sample.vbo", import.meta.url));
const sampleVbo = readFileSync(fixturePath, "utf8");

describe("decodeVboCoord", () => {
  test("latitude: minutes → north-positive degrees", () => {
    expect(decodeVboCoord("+03283.51691", "lat")).toBeCloseTo(54.7253, 4);
  });
  test("longitude flips VBOX W-positive to E-positive", () => {
    // -1520.95871' is encoded for ~25.349°E (Plytinė, LT).
    expect(decodeVboCoord("-001520.95871", "lng")).toBeCloseTo(25.3493, 4);
  });
  test("rejects non-numeric tokens", () => {
    expect(() => decodeVboCoord("nope", "lat")).toThrow(VboParseError);
  });
});

describe("decodeVboTime", () => {
  test("HHMMSS.ss → ms since start of day", () => {
    expect(decodeVboTime("163508.04")).toBe(
      ((16 * 60 + 35) * 60 + 8) * 1000 + 40,
    );
  });
  test("midnight → 0", () => {
    expect(decodeVboTime("000000.00")).toBe(0);
  });
});

describe("parseVbo", () => {
  const file = parseVbo(sampleVbo, "sample.vbo");

  test("parses comments as Key:Value pairs", () => {
    expect(file.comments["Serial Number"]).toBe("3242708543");
    expect(file.comments.Venue).toBe("TestTrack");
  });

  test("derives startedAt from UTC Date Started (DD/MM/YYYY)", () => {
    expect(file.startedAt?.toISOString()).toBe("2026-05-05T16:35:00.000Z");
  });

  test("captures both [header] labels and canonical channel keys", () => {
    expect(file.channelLabels).toContain("LongAcc");
    expect(file.channels).toContain("longAccG");
    expect(file.channels).toContain("lat");
    expect(file.channels).toContain("lng");
    expect(file.channels.length).toBe(file.channelLabels.length);
  });

  test("parses laptiming gates with kind and label", () => {
    expect(file.gates).toHaveLength(2);
    expect(file.gates[0].kind).toBe("start");
    expect(file.gates[0].label).toBe("Start / Finish");
    expect(file.gates[0].pointA.latDeg).toBeCloseTo(54.72530, 4);
    expect(file.gates[0].pointA.lngDeg).toBeCloseTo(25.34940, 4);
    expect(file.gates[1].kind).toBe("split");
    expect(file.gates[1].label).toBe("S1");
  });

  test("decodes data rows into typed samples", () => {
    expect(file.samples).toHaveLength(3);
    const first = file.samples[0];
    expect(first.timeOfDayMs).toBe(decodeVboTime("163508.00"));
    expect(first.latDeg).toBeCloseTo(54.7253, 4);
    expect(first.lngDeg).toBeCloseTo(25.3493, 4);
    expect(first.velocityKmh).toBeCloseTo(52.171, 3);
    expect(first.heading).toBeCloseTo(312.25, 2);
    expect(first.heightM).toBeCloseTo(145.77, 2);
    expect(first.longAccG).toBeCloseTo(-0.504, 3);
    expect(first.gyroZDegSec).toBeCloseTo(-7.13, 2);
    expect(first.sats).toBe(0);
  });

  test("populates timestampMs as absolute UTC epoch when start date is known", () => {
    const first = file.samples[0];
    expect(first.timestampMs).toBe(Date.UTC(2026, 4, 5, 16, 35, 8));
  });
});

describe("parseVbo error handling", () => {
  test("reports line number on malformed data row", () => {
    const broken = sampleVbo.replace(
      "163508.00 +03283.51691 -001520.95871 052.171 312.25 +00145.77 -0.504 +0.116 +1.039 +5.880 +4.470 -7.130 0",
      "163508.00 +03283.51691 -001520.95871",
    );
    expect(() => parseVbo(broken)).toThrow(/line \d+.*expected 13 columns/);
  });

  test("rejects file with no [column names] and no [header]", () => {
    expect(() => parseVbo("[data]\n163508.00 +03283.51691\n")).toThrow(VboParseError);
  });
});

describe("parseVbo with unknown channels", () => {
  test("routes unrecognized columns into sample.extra", () => {
    const withExtra = `[column names]
time lat lng velocity heading height brake_pressure
[data]
163508.00 +03283.51691 -001520.95871 052.171 312.25 +00145.77 0.85
`;
    const file = parseVbo(withExtra);
    expect(file.samples[0].extra).toEqual({ brake_pressure: 0.85 });
  });
});
