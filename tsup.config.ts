import { defineConfig } from "tsup";
import pkg from "./package.json";

export default defineConfig([
  {
    entry: { cli: "src/cli/index.ts" },
    format: ["esm"],
    target: "node22",
    clean: true,
    define: {
      PACKAGE_VERSION: JSON.stringify(pkg.version),
    },
    banner: {
      js: "#!/usr/bin/env node",
    },
    dts: false,
  },
  {
    entry: {
      "sdk/model": "src/sdk/model.ts",
      "sdk/adapters": "src/sdk/adapters.ts",
      "sdk/analysis": "src/sdk/analysis.ts",
      "sdk/bundles": "src/sdk/bundles.ts",
      "sdk/compare": "src/sdk/compare.ts",
      "sdk/track": "src/sdk/track.ts",
      "sdk/time": "src/sdk/time.ts",
    },
    format: ["esm"],
    target: "node22",
    clean: false,
    dts: true,
    sourcemap: true,
  },
]);
