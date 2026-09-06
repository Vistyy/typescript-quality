# Vendored anti-slop provenance

The canonical anti-slop production source in `upstream/` is copied without modification from [`dmmulroy/anti-slop`](https://github.com/dmmulroy/anti-slop) commit `e8c4880471b23ab7f216fba7b27d173a6ef07d4c`, tagged as version `0.1.2`.

The upstream `LICENSE` is retained beside the vendored source.

The package entrypoint is a small local policy wrapper around that source.
The local `rules/` directory adds `no-never-type-assertion` without modifying the pinned upstream source.
This rule resolves local type aliases using the vendored helper; it does not claim type-checker-level resolution of imported or computed types.

The wrapper enables the generic rules except the spelling-based `no-shape-in-symbol-names` rule, which is intentionally available only in the canonical source and is not enabled by this package.

The Effect `no-service-constructor-imports` plugin remains a separate opt-in export and is not enabled by the base Oxlint configuration.

Before updating this vendor directory, review upstream changes, copy production source from a pinned commit, preserve the license, and rerun packed-consumer checks.
