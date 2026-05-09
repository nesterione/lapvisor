import { describe, expect, test } from "bun:test";
import { buildLapsSummary } from "../../src/bundles/laps-summary.js";
import type { Session } from "../../src/model.js";

function fakeSession(durations: number[]): Session {
  return {
    source: "fake.vbo",
    format: "vbo",
    laps: durations.map((durationMs, i) => ({
      index: i + 1,
      durationMs,
    })),
    meta: { venue: "TestTrack" },
  };
}

describe("buildLapsSummary", () => {
  test("returns lapCount only when there are no laps", () => {
    const summary = buildLapsSummary(fakeSession([]));
    expect(summary.lapCount).toBe(0);
    expect(summary.bestMs).toBeUndefined();
    expect(summary.meanMs).toBeUndefined();
    expect(summary.source).toBe("fake.vbo");
    expect(summary.format).toBe("vbo");
    expect(summary.meta?.venue).toBe("TestTrack");
  });

  test("computes best (min) and mean lap durations", () => {
    const summary = buildLapsSummary(fakeSession([45_000, 43_500, 44_000]));
    expect(summary.lapCount).toBe(3);
    expect(summary.bestMs).toBe(43_500);
    expect(summary.meanMs).toBe(Math.round((45000 + 43500 + 44000) / 3));
  });

  test("rounds the mean to an integer", () => {
    const summary = buildLapsSummary(fakeSession([100, 101]));
    expect(summary.meanMs).toBe(101); // (100+101)/2 = 100.5 -> 101
  });
});
