import { describe, expect, test } from "bun:test";
import { buildLapBundleExample } from "../../examples/build-lap-bundle.js";

describe("examples/build-lap-bundle", () => {
  test("throws when the lap index isn't found in the fixture", async () => {
    // Test fixture has no detected laps (samples on one side of start gate),
    // so any lap index will throw — proving the producer wired up correctly.
    const fixturePath = new URL(
      "../fixtures/sample.vbo",
      import.meta.url,
    ).pathname;
    await expect(
      buildLapBundleExample(fixturePath, 1),
    ).rejects.toThrow(/lap 1 not found/);
  });
});
