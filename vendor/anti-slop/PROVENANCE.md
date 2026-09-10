# Vendored anti-slop provenance

The canonical anti-slop production source in `upstream/` is copied without modification from [`dmmulroy/anti-slop`](https://github.com/dmmulroy/anti-slop) commit `c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b`. That revision is newer than the latest `v0.1.2` tag while upstream's package metadata still reports `0.1.2`; the immutable commit, not that version, identifies this snapshot.

The upstream `LICENSE` is retained beside the vendored source. The nested ESLint Stylistic source under `upstream/vendor/eslint-stylistic/` retains its own `LICENSE` and `UPSTREAM.md`; both must remain in every redistributed package copy.

The package entrypoint is a small local policy wrapper around that source. The local `rules/` directory adds `no-never-type-assertion` without modifying the pinned upstream source. This rule resolves local type aliases using the vendored helper; it does not claim type-checker-level resolution of imported or computed types.

The wrapper enables the generic rules except the spelling-based `no-shape-in-symbol-names` rule, which is intentionally available only in the canonical source and is not enabled by this package. The Effect rules remain a separate export and are enabled only by this package's Effect Oxlint preset.

Updates follow upstream's vendored-installation procedure in `skills/install-anti-slop/references/update.md`: stage local, incoming, and recoverable base snapshots separately; review a three-way diff; preserve local policy; update exact provenance; and verify the built and packed package. Never replace the local wrapper or local rules with upstream defaults.
