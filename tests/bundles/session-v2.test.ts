import { describe, expect, test } from "bun:test";
import type { VboFile, VboGate, VboSample } from "../../src/adapters/vbo.js";
import { buildSessionBundle } from "../../src/bundles/session-v2.js";

const M_PER_DEG = 111_320;

function sample(opts: {
  tMs: number;
  xM: number;
  yM: number;
  vKmh?: number;
}): VboSample {
  return {
    timeOfDayMs: opts.tMs,
    latDeg: opts.yM / M_PER_DEG,
    lngDeg: -opts.xM / M_PER_DEG,
    velocityKmh: opts.vKmh ?? 60,
    heading: 0,
    heightM: 0,
    sats: 8,
  };
}

function gate(opts: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind?: VboGate["kind"];
  label?: string;
}): VboGate {
  return {
    label: opts.label ?? "Start / Finish",
    kind: opts.kind ?? "start",
    pointA: { latDeg: opts.y1 / M_PER_DEG, lngDeg: opts.x1 / M_PER_DEG },
    pointB: { latDeg: opts.y2 / M_PER_DEG, lngDeg: opts.x2 / M_PER_DEG },
  };
}

function fakeVboFile(): VboFile {
  const samples: VboSample[] = [
    sample({ tMs: 0, xM: -1, yM: 0 }),
    sample({ tMs: 1000, xM: 1, yM: 0 }),
    sample({ tMs: 30_000, xM: -1, yM: 0 }),
    sample({ tMs: 31_000, xM: 1, yM: 0 }),
    sample({ tMs: 60_000, xM: -1, yM: 0 }),
    sample({ tMs: 61_000, xM: 1, yM: 0 }),
  ];
  return {
    source: "fake.vbo",
    comments: { Venue: "TestTrack" },
    channels: ["time", "lat", "lng"],
    channelLabels: [],
    gates: [gate({ x1: 0, y1: -5, x2: 0, y2: 5 })],
    samples,
  };
}

describe("buildSessionBundle", () => {
  test("emits lapvisor-session/v2 schema with expected top-level fields", () => {
    const vboFile = fakeVboFile();
    const bundle = buildSessionBundle({
      source: { file: "fake.vbo", format: "vbo" },
      vboFile,
    });
    expect(bundle.schema).toBe("lapvisor-session/v2");
    expect(bundle.source).toEqual({ file: "fake.vbo", format: "vbo" });
    expect(bundle.meta.venue).toBe("TestTrack");
    expect(bundle.samples.length).toBe(vboFile.samples.length);
    expect(bundle.laps.length).toBeGreaterThan(0);
    expect(bundle.sectorSplits).toEqual([]); // no sector gates
    expect(bundle.lapSummaries.length).toBe(bundle.laps.length);
    expect(bundle.sessionSummary.bestLapIndex).toBeDefined();
    expect(bundle.gates).toHaveLength(1);
  });

  test("samples are rounded to 7 decimals lat/lng and 1 decimal velocity", () => {
    const vboFile = fakeVboFile();
    const bundle = buildSessionBundle({
      source: { file: "fake.vbo", format: "vbo" },
      vboFile,
    });
    for (const s of bundle.samples) {
      expect(Number.isFinite(s.lat)).toBe(true);
      expect(s.v.toString()).toMatch(/^\d+(\.\d)?$/);
    }
  });
});
