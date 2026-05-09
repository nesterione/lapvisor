---
layout: home

hero:
  name: lapvisor
  text: Race data toolkit
  tagline: SDK + CLI for lap times, GPS telemetry, sector splits, and track tooling. Hobby karting and amateur motorsport.
  actions:
    - theme: brand
      text: SDK quick start
      link: /sdk/quickstart
    - theme: alt
      text: CLI overview
      link: /cli/overview
    - theme: alt
      text: GitHub
      link: https://github.com/nesterione/lapvisor

features:
  - title: SDK first
    details: Build apps on lapvisor with per-area subpaths — lapvisor/adapters, lapvisor/analysis, lapvisor/bundles, lapvisor/track, lapvisor/time, lapvisor/model. Pure parsers are browser-safe.
    link: /sdk/overview
    linkText: Open the SDK overview
  - title: CLI for humans and agents
    details: Stable JSON output, schema-stamped bundles, meaningful exit codes. Drive it from a shell or a subprocess.
    link: /cli/overview
    linkText: Read the CLI reference
  - title: Versioned wire formats
    details: kart-track/v1, lapvisor-lap/v1, lapvisor-session/v2 — public contracts every client emits identically.
    link: /formats/
    linkText: Browse format specs
  - title: Designed to extend
    details: Step-by-step guides for adding new adapters (GPX, FIT, TCX, CSV), new analyses, and new bundle versions.
    link: /extending/adapter
    linkText: Start extending
---
