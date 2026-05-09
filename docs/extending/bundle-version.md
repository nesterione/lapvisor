# Evolving a bundle version

Bundles are the SDK's most durable contract. Every consumer — CLI users, web UIs, agents pinning to a `schema` field — depends on stability. The cost of a wrong change is broken pipelines somewhere we can't see.

When in doubt, ship a new version. Never silently mutate an existing one.

## Naming rule

| Item | Format | Example |
| --- | --- | --- |
| Schema string | `<family>/v<N>` | `lapvisor-session/v2` |
| Producer function | `build<Family>BundleV<N>` | `buildSessionBundleV2` |
| Result type | `<Family>BundleV<N>` | `SessionBundleV2` |
| Spec file | `docs/formats/<family>-v<N>.md` | `docs/formats/lapvisor-session-v2.md` |

(Today's exports are unsuffixed — `buildSessionBundle`, `SessionBundle`, etc. — because there's only one live version per family. They will get the `V<N>` suffix when V<N+1> ships, both forms exported during the transition.)

## When to bump

| Change | Bump? |
| --- | --- |
| Add an optional field at any level | No. Additive within the current version. |
| Add a new required field | **Yes.** Bump version. |
| Remove or rename a field | **Yes.** Bump version. |
| Change the meaning of a field (units, semantics) | **Yes.** Bump version. |
| Change rounding behaviour | **Yes.** Bump version. Rounded outputs are byte-stable across runs. |
| Add a new bundle for a new artifact (`lapvisor-foo/v1`) | New family — start at v1. |

When unsure: bump.

## Steps to ship V<N+1>

1. Create the new producer: `src/bundles/<family>-v<N+1>.ts` with `build<Family>BundleV<N+1>` and `<Family>BundleV<N+1>`.
2. Update or add types in `src/bundles/types.ts`.
3. Mark the old producer `@deprecated`. Keep exporting it.
4. Update `src/sdk/bundles.ts` to re-export both.
5. Write the new spec: `docs/formats/<family>-v<N+1>.md`. Reference the old spec as "Superseded by".
6. Add a "Superseded by" header to the old spec. Don't delete it.
7. CLI behaviour: emit V<N+1> by default. Add `--schema <family>/v<N>` flag if the old version is still useful for pinned consumers.
8. Tests: cover both producers in parallel.

## Deprecation timeline

- Mark `@deprecated` with the version that replaced it: `@deprecated since 0.4.0 — use buildSessionBundleV3`.
- Old producers stay exported until the next major version.
- Spec files stay forever. They're a permanent record; consumers in the wild may still emit pinned versions.

## Removing in a major

- Remove the deprecated producer + its types from `src/bundles/`.
- Remove the re-exports from `src/sdk/bundles.ts`.
- Update `docs/extending/bundle-version.md` to drop the now-irrelevant pinning advice.
- Bump `package.json` major version.
- Add a CHANGELOG entry. Be specific about which schema strings stop being produced and which still parse.

## CLI emit policy

The CLI emits the **newest** non-deprecated version of each family by default. To pin, add a `--schema <family>/v<N>` flag at subcommand level. Reject unknown schemas with exit code 1.

## PR checklist

- [ ] New producer file `src/bundles/<family>-v<N+1>.ts`.
- [ ] Old producer marked `@deprecated`.
- [ ] `src/sdk/bundles.ts` re-exports both.
- [ ] `docs/formats/<family>-v<N+1>.md` spec written.
- [ ] Old spec annotated "Superseded by".
- [ ] Tests for both producers.
- [ ] CLI default emits V<N+1>; `--schema` flag honours both.
- [ ] CHANGELOG entry.
- [ ] `bun run lint && bun test && bun run build` green.
