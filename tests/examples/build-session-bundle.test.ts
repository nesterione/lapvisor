import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";
import { buildSessionBundleExample } from "../../examples/build-session-bundle.js";

const fixturePath = fileURLToPath(
  new URL("../fixtures/sample.vbo", import.meta.url),
);

describe("examples/build-session-bundle", () => {
  test("produces a lapvisor-session/v2 bundle", async () => {
    const bundle = await buildSessionBundleExample(fixturePath);
    expect(bundle.schema).toBe("lapvisor-session/v2");
    expect(bundle.source.format).toBe("vbo");
    expect(Array.isArray(bundle.samples)).toBe(true);
  });
});
