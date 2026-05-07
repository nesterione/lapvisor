#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    name: "lapvisor",
    version: "0.0.1",
    description: "Race data analysis from the terminal — agent-friendly.",
  },
  subCommands: {
    laps: () => import("./commands/laps").then((m) => m.default),
  },
});

runMain(main);
