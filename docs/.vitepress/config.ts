import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitepress";

// typedoc-vitepress-theme drops a sidebar here on each `bun run docs:api`.
// Read it lazily so `vitepress dev` still works before the first generation.
const apiSidebarPath = fileURLToPath(
  new URL("../api/typedoc-sidebar.json", import.meta.url),
);
const apiSidebar = existsSync(apiSidebarPath)
  ? JSON.parse(readFileSync(apiSidebarPath, "utf8"))
  : [];

export default defineConfig({
  title: "lapvisor",
  description:
    "Race data toolkit (SDK + CLI) for hobby karting and amateur motorsport.",
  base: "/lapvisor/",
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: [/^\.\.\//],
  themeConfig: {
    nav: [
      { text: "Guide", link: "/sdk/overview" },
      { text: "CLI", link: "/cli/overview" },
      { text: "API", link: "/api/" },
      { text: "Formats", link: "/formats/" },
    ],
    sidebar: {
      "/sdk/": [
        {
          text: "SDK",
          items: [
            { text: "Overview", link: "/sdk/overview" },
            { text: "Quick start", link: "/sdk/quickstart" },
            { text: "Stability", link: "/sdk/stability" },
          ],
        },
        {
          text: "Extending",
          items: [
            { text: "Add an adapter", link: "/extending/adapter" },
            { text: "Add an analysis", link: "/extending/analysis" },
            { text: "Bundle versions", link: "/extending/bundle-version" },
          ],
        },
      ],
      "/cli/": [
        {
          text: "CLI",
          items: [{ text: "Overview", link: "/cli/overview" }],
        },
      ],
      "/formats/": [
        {
          text: "Wire formats",
          items: [
            { text: "Index", link: "/formats/" },
            { text: "VBO", link: "/formats/vbo" },
            { text: "kart-track/v1", link: "/formats/kart-track-v1" },
            { text: "lapvisor-lap/v1", link: "/formats/lapvisor-lap-v1" },
            {
              text: "lapvisor-session/v2",
              link: "/formats/lapvisor-session-v2",
            },
          ],
        },
        {
          text: "Analysis notes",
          items: [{ text: "Lap detection", link: "/analysis/laps" }],
        },
      ],
      "/extending/": [
        {
          text: "Extending",
          items: [
            { text: "Add an adapter", link: "/extending/adapter" },
            { text: "Add an analysis", link: "/extending/analysis" },
            { text: "Bundle versions", link: "/extending/bundle-version" },
          ],
        },
      ],
      "/analysis/": [
        {
          text: "Analysis notes",
          items: [{ text: "Lap detection", link: "/analysis/laps" }],
        },
      ],
      "/api/": apiSidebar,
    },
    socialLinks: [
      { icon: "github", link: "https://github.com/nesterione/lapvisor" },
    ],
    editLink: {
      pattern:
        "https://github.com/nesterione/lapvisor/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },
    search: { provider: "local" },
    outline: { level: [2, 3] },
    footer: {
      message: "Released under the MIT License.",
      copyright: "© Ihar Nestsiarenia",
    },
  },
});
