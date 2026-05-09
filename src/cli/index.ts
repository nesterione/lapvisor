import { defineCommand, runMain } from "citty";
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
    track,
  },
});

runMain(main);
