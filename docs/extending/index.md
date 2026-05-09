# Extending lapvisor

Three step-by-step guides for the most common kinds of extension:

- [Add a new adapter](./adapter.md) — implement a new file-format reader (GPX, FIT, TCX, lap-CSV…).
- [Add a new analysis function](./analysis.md) — pure transforms over the canonical session/sample shape.
- [Evolve a bundle version](./bundle-version.md) — ship `<family>/v<N+1>` without breaking pinned consumers.

Each guide ends with a PR checklist so the contribution lands cleanly with tests, docs, and TSDoc.
