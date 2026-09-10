# @syzom/typescript-quality

Shared, pinned Biome, Oxlint, TypeScript, and optional Effect v4 configuration.
Projects keep ownership of their runtime, source selection, and justified exceptions.
The toolchain requires Node.js 22.12 or newer and is verified on Node.js 22 and 24 on Linux.

## Install

```sh
pnpm add --save-dev --save-exact \
  @syzom/typescript-quality@0.3.0 \
  @biomejs/biome@2.5.12 oxlint@1.82.0 oxlint-tsgolint@7.0.2001 \
  typescript@7.0.2
```

For Effect projects, also install:

```sh
pnpm add --save-exact effect@4.0.0-rc.112
pnpm add --save-dev --save-exact @effect/tsgo@0.45.0
```

Keep the compatible versions pinned together and commit the package-manager lockfile.

## Configure

`biome.json`:

```json
{
  "extends": ["@syzom/typescript-quality/biome"],
  "files": { "includes": ["**", "!!dist/**", "!!coverage/**"] }
}
```

`oxlint.config.ts`:

```ts
import { defineConfig } from "oxlint";
import config from "@syzom/typescript-quality/oxlint";

export default defineConfig({
  ...config,
  ignorePatterns: ["dist/**", "coverage/**"],
});
```

For Effect projects, use `@syzom/typescript-quality/oxlint/effect` instead.
Spread the configuration at the root: putting it only in `extends` does not carry Oxlint's root-owned execution options.

`tsconfig.json`:

```json
{
  "extends": "@syzom/typescript-quality/tsconfig/base.json",
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

Adjust source and generated-file selection to the project.
For optional Effect editor integration, follow the [Effect TypeScript language-service documentation](https://github.com/Effect-TS/tsgo).

## Check

After each installation in an Effect project, patch the compatible Oxlint integration:

```sh
pnpm exec effect-tsgo patch --oxlint --no-typescript
```

Use these same checks locally and in CI:

```sh
pnpm exec biome check --error-on-warnings .
pnpm exec oxlint --config oxlint.config.ts .
```

Oxlint performs the full TypeScript type-check, so a separate `tsc --noEmit` pass is unnecessary for the same source set.
Selected rule warnings are promoted to errors, and unused Oxlint disable directives are errors too.
The warning guards remain a safeguard for other tool diagnostics.

## Policy and exceptions

- Biome owns formatting, recommended rules, explicit `any` rejection, and cognitive complexity capped at **15**.
- Oxlint owns type-aware safety checks and exhaustive union switches, including switches with a `default` case.
- Assertions to `never` (including locally resolved aliases) and chained assertions are errors even when accompanied by a safety comment.
- Runtime `typeof` is allowed in explicit type guards and existence probes; other runtime uses remain errors.
- The generic preset rejects repeated eager array passes, copying reducer accumulators, accumulating spreads, and unreadable statement spacing in addition to its evidence and boundary rules.
- The Effect preset makes the pinned upstream recommended rules errors, adds unsafe channel-assertion and `any`/`unknown` error/requirements-channel checks, and enables the vendored Effect tag, Match, and service-constructor rules.
- Vendored anti-slop rules reject selected low-evidence patterns; [provenance and update instructions](vendor/anti-slop/PROVENANCE.md) identify their exact upstream source and nested license obligations.
- New rules are blocking by default. Fix owned code where practical and use narrow explained exceptions for genuine boundaries or conflicting architecture; repeated exceptions require reevaluating the shared rule.
- There is no file-length limit, blanket constructor-name ban, or `Shape`-name ban.

Use narrow local overrides or explained inline exceptions for real boundaries rather than disguising code to evade a rule.
Do not enable both editor and lint integrations to report the same Effect diagnostics.

## Maintaining this package

Rule selection lives in `biome/policy.json` and `oxlint/policy.mjs`.
The root `biome.json`, `oxlint.config.mjs`, and `tsconfig.json` apply the published policy to package-owned configuration, scripts, and tests. Generated output and copied upstream source stay under their generator, compiler, provenance, and packed-consumer checks instead of being reformatted or rewritten as locally owned code.
After changing compatible tool pins or selection policy, run `pnpm sync:rules` to regenerate severity overlays from the installed pinned tools.
Do not hand-edit `biome/base.json` or `oxlint/inherited-errors.mjs`.
Use the pnpm version pinned in `packageManager`.
Run `pnpm install --frozen-lockfile` and `pnpm check` before releasing; the check also rejects stale generated presets.
The check builds and packs the package, installs it into a disposable consumer, and verifies passing examples and intentional rule violations.
To release, update the version and lockfile, commit and push, then push the matching `v<version>` tag.
GitHub Actions verifies that tag, installs and packs with pnpm, and publishes the verified tarball through npm trusted publishing.
The npm CLI is used only as the OIDC publication transport, not as the package manager.
