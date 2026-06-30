import { defineCommand, runMain } from "citty";
import compare from "./commands/compare.js";
import ideal from "./commands/ideal.js";
import improve from "./commands/improve.js";
import lap from "./commands/lap.js";
import laps from "./commands/laps.js";
import session from "./commands/session.js";
import track from "./commands/track.js";

declare const PACKAGE_VERSION: string;

const main = defineCommand({
  meta: {
    name: "lapvisor",
    version: typeof PACKAGE_VERSION !== "undefined" ? PACKAGE_VERSION : "0.0.0",
    description: "Race data analysis from the terminal — agent-friendly.",
  },
  subCommands: {
    laps,
    session,
    lap,
    ideal,
    compare,
    improve,
    track,
  },
});

runMain(main);
