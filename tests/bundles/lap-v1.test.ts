import { describe, expect, test } from "bun:test";
import type { VboFile, VboGate, VboSample } from "../../src/adapters/vbo.js";
import { buildLapBundle } from "../../src/bundles/lap-v1.js";

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
  // Two samples per lap, crossing a vertical gate at x=0 three times -> 2 laps.
  const samples: VboSample[] = [
    sample({ tMs: 0, xM: -1, yM: 0 }),
    sample({ tMs: 1000, xM: 1, yM: 0 }), // crossing 1
    sample({ tMs: 30_000, xM: -1, yM: 0 }),
    sample({ tMs: 31_000, xM: 1, yM: 0 }), // crossing 2 -> end of lap 1
    sample({ tMs: 60_000, xM: -1, yM: 0 }),
    sample({ tMs: 61_000, xM: 1, yM: 0 }), // crossing 3 -> end of lap 2
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

describe("buildLapBundle", () => {
  test("emits lapvisor-lap/v1 schema with expected fields", () => {
    const vboFile = fakeVboFile();
    const bundle = buildLapBundle({
      source: { file: "fake.vbo", format: "vbo" },
      vboFile,
      lapIndex: 1,
    });
    expect(bundle.schema).toBe("lapvisor-lap/v1");
    expect(bundle.source).toEqual({ file: "fake.vbo", format: "vbo" });
    expect(bundle.meta.trackName).toBeNull();
    expect(bundle.meta.venue).toBe("TestTrack");
    expect(bundle.lap.index).toBe(1);
    expect(bundle.lap.durationMs).toBeGreaterThan(0);
    expect(bundle.samples.length).toBeGreaterThan(0);
    expect(Array.isArray(bundle.sectors)).toBe(true);
    expect(typeof bundle.aggregates.topSpeedKmh).toBe("number");
    expect(bundle.gates).toHaveLength(1);
    expect(bundle.gates[0].kind).toBe("start_finish");
  });

  test("throws when the requested lap index is missing", () => {
    const vboFile = fakeVboFile();
    expect(() =>
      buildLapBundle({
        source: { file: "fake.vbo", format: "vbo" },
        vboFile,
        lapIndex: 99,
      }),
    ).toThrow(/lap 99 not found/);
  });
});
