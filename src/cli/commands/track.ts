import { defineCommand } from "citty";
import create from "./track/create.js";
import edit from "./track/edit.js";

export default defineCommand({
  meta: {
    name: "track",
    description:
      "Track-related operations: build kart-track/v1 GeoJSON (`create`), edit it visually (`edit`).",
  },
  subCommands: {
    create,
    edit,
  },
});
