import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";
import { loadSessionExample } from "../../examples/load-session.js";

const fixturePath = fileURLToPath(
  new URL("../fixtures/sample.vbo", import.meta.url),
);

describe("examples/load-session", () => {
  test("returns a summary shape for a real VBO file", async () => {
    const result = await loadSessionExample(fixturePath);
    expect(result.format).toBe("vbo");
    expect(result.venue).toBe("TestTrack");
    expect(typeof result.lapCount).toBe("number");
  });
});
