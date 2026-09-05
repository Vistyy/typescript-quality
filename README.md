# @vistyy/typescript-quality

This package is a pinned shared quality baseline for strict TypeScript and Effect v4 projects.

The package is a configuration dependency, not a project template.

Project-local configuration owns source selection, runtime and framework assumptions, generated files, and narrowly justified exceptions.

## Supported toolchain

The declared Node.js range is `^20.19.0 || >=22.12.0`.
The packed-consumer check has been verified on Node.js 24 on Linux; other allowed versions are not yet verified.

The supported versions are `@biomejs/biome@2.5.12`, `oxlint@1.81.0`, `@oxlint/plugins@1.81.0`, `oxlint-tsgolint@7.0.2001`, `typescript@7.0.2`, `@effect/tsgo@0.41.0`, and `effect@4.0.0-rc.112`.

The Effect release candidate is intentional and must not be silently replaced with the earlier beta.

Keep these versions exact in the consuming project's lockfile and dependency manifest.

The package's `peerDependencies` express the toolchain contract, while `@oxlint/plugins@1.81.0` is included because the vendored plugin imports it at runtime.

## Installation

The initial npm release is pending maintainer account setup.
The following installation commands apply after that release is published.
Install the package and the exact tools as development dependencies.

```sh
npm install --save-dev --save-exact \
  @vistyy/typescript-quality@0.1.0 \
  @biomejs/biome@2.5.12 \
  oxlint@1.81.0 \
  oxlint-tsgolint@7.0.2001 \
  typescript@7.0.2
```

Effect projects additionally install the Effect pins.

```sh
npm install --save-dev --save-exact @effect/tsgo@0.41.0
npm install --save-exact effect@4.0.0-rc.112
```

Use a package manager lockfile and run installation in CI with its frozen-lockfile mode.

## Adoption

Extend the shared Biome configuration from `biome.json`.

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.12/schema.json",
  "extends": ["@vistyy/typescript-quality/biome"],
  "files": {
    "includes": ["**", "!!dist/**", "!!coverage/**"]
  }
}
```

Import the shared Oxlint configuration from `oxlint.config.ts`.

```ts
import { defineConfig } from "oxlint";
import baseConfig from "@vistyy/typescript-quality/oxlint";

export default defineConfig({
  ...baseConfig,
  ignorePatterns: ["dist/**", "coverage/**"],
});
```

Spread the imported config at the root rather than only putting it in `extends`, because Oxlint's execution options are root-owned.
This carries full type-checking and blocking warning policy into the consuming project.
Use `@vistyy/typescript-quality/oxlint/effect` instead for an Effect project.

```ts
import { defineConfig } from "oxlint";
import effectConfig from "@vistyy/typescript-quality/oxlint/effect";

export default defineConfig({
  ...effectConfig,
  ignorePatterns: ["dist/**", "coverage/**"],
});
```

Extend the strict compiler baseline from `tsconfig.json`.

```json
{
  "extends": "@vistyy/typescript-quality/tsconfig/base.json",
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

Effect projects may extend `@vistyy/typescript-quality/tsconfig/effect.json` when they use the Effect language-service integration.

The Effect language-service diagnostics and the Effect Oxlint preset should not both report the same diagnostics in one check.

When using the Effect Oxlint preset as the CI owner, set the language-service plugin's `diagnostics` option to `false` in the local tsconfig if the editor would otherwise display duplicates.

## What the defaults enforce

Biome owns formatting, recommended correctness rules, explicit `noExplicitAny`, and cognitive complexity.

`noExcessiveCognitiveComplexity` is an error with `maxAllowedComplexity: 15`.

There is no file-length limit.

Oxlint owns type-aware TypeScript rules for floating promises, unsafe values, promise misuse, strict boolean expressions, and thrown values.

The vendored anti-slop wrapper owns explicit evidence rules for unknown inputs and outputs, unsafe dictionaries, widening and assertions, reflection, runtime type checks, object parameters, conditional empty spreads, module mocking, and chained assertions.

The spelling-based `no-shape-in-symbol-names` rule is intentionally not enabled.

The Effect preset enables the pinned upstream `recommended` rule set, with every selected Effect rule promoted to an error.
This includes correctness, Effect-native API, antipattern, and style diagnostics; narrow project exceptions remain available.
The name-based `no-service-constructor-imports` rule is not enabled by either preset.
Its separate `anti-slop/effect` plugin export is available only for explicit project opt-in.

The `no-unknown-parameters` rule remains enabled, with the upstream rule's narrow exceptions for a `cause` parameter and the subject of a type predicate.

Decode external `unknown` data at the boundary and pass the decoded domain type inward.

Do not suppress a rule merely to satisfy the checker.

## Local checks and CI

Use the same blocking commands locally and in CI.

For a non-Effect project, run Biome once and Oxlint's type-aware type-check once.

```sh
npx biome check --error-on-warnings .
npx oxlint --config oxlint.config.ts --report-unused-disable-directives .
```

Oxlint's `typeCheck: true` option is the full TypeScript type-check owner for this baseline, so do not add a redundant `tsc --noEmit` invocation to the same check.

For an Effect project, patch Oxlint once after installation and run the Effect preset instead.

```sh
npx effect-tsgo patch --oxlint --no-typescript
npx biome check --error-on-warnings .
npx oxlint --config oxlint.config.ts --report-unused-disable-directives .
```

The patch command validates the compatible Oxlint and `oxlint-tsgolint` versions.

Use `effect-tsgo` as the editor's sole TypeScript language server when the language-service integration is enabled.

Do not assume that an executable named `tsgo` exists.

Do not run stock `tsc`, `effect-tsgo diagnostics`, and Oxlint type-check together for the same source set.

The repository's CI entry point should be a project script that invokes the applicable commands above.

## Local overrides and exceptions

Add file selection and framework-specific rules in the consuming repository rather than changing this package.

Use Biome `overrides` for generated or syntax-specific files.

Use Oxlint `overrides` for a narrowly scoped boundary such as `src/decoders/**/*.ts`.

A boundary exception must name the external input, the decoder or validator, and the invariant established before the value crosses into domain code.

Prefer a typed decoder function that accepts `unknown` and returns a decoded result over a broad suppression.

The type-predicate exception is valid only for the parameter being narrowed.

Keep `cause` parameters limited to error-context enrichment.

Use the narrowest clear exception, whether a file override or an inline disable, and retain the unused-disable check so stale exceptions fail.

Do not automatically enable `no-shape-in-symbol-names` or `no-service-constructor-imports` for a project that has not adopted those scopes.

## Upgrades

Upgrade a compatible set of pins together in a branch.

Read the upstream release notes and compatibility table before changing a pin.

For an anti-slop update, copy canonical production source from a reviewed upstream commit into `vendor/anti-slop/upstream`, preserve its license, and update `vendor/anti-slop/PROVENANCE.md`.

Run the packed-consumer check and the negative enforcement examples before committing an upgrade.

Re-run `effect-tsgo patch --oxlint --no-typescript` after changing `@effect/tsgo`, Oxlint, or `oxlint-tsgolint`.

Expect Effect v4 release-candidate diagnostics to change as the release candidate evolves.

## Package exports

`@vistyy/typescript-quality/biome` exports the universal Biome configuration.

`@vistyy/typescript-quality/oxlint` exports the universal Oxlint configuration.

`@vistyy/typescript-quality/oxlint/effect` exports the separate Effect Oxlint configuration.

`@vistyy/typescript-quality/tsconfig/base.json` exports the strict universal TypeScript configuration.

`@vistyy/typescript-quality/tsconfig/effect.json` exports the Effect language-service TypeScript configuration.

`@vistyy/typescript-quality/anti-slop` exports the default anti-slop plugin.

`@vistyy/typescript-quality/anti-slop/effect` exports the opt-in Effect anti-slop plugin.

## Verification

`npm run check` packs this repository, installs the packed tarball into disposable external consumers, and runs valid and invalid examples through the real installed tools.

The check asserts named diagnostics and nonzero exit codes for ordinary TypeScript errors, cognitive complexity, unsafe type-aware values, floating or unhandled Effects, and invalid boundary parameters.
It exercises root configuration without CLI flags that could conceal missing type-check policy.
The check also verifies an allowed type predicate, a valid Effect program, and a pure factory import whose name starts with `make`.

Disposable consumers and their processes are removed when the check exits.

## Publishing

The GitHub repository is `Vistyy/typescript-quality`.
The initial npm publication requires an authenticated maintainer who owns the npm scope; a matching GitHub username does not establish that ownership.
After confirming the scope and enabling npm two-factor authentication, run `npm login`, `npm ci`, `npm run check`, and `npm publish --access public` for the first release.
Remove the pending-publication notice above when publishing that release.

Once the package exists, configure its npm **Trusted Publisher** settings with GitHub owner `Vistyy`, repository `typescript-quality`, and workflow filename `publish.yml`.
No npm token belongs in GitHub secrets for this workflow.
See [npm's trusted-publishing documentation](https://docs.npmjs.com/trusted-publishers/) for the account-side setup.

For subsequent releases, update the package version and lockfile together, commit the change, and push a matching `v<version>` tag.
The publish workflow checks the exact tagged version, runs the packed-consumer check, and publishes from a GitHub-hosted Node.js 24 runner using OIDC.
A failed or uncertain publication should be checked against the npm registry before retrying.

## Limitations

Oxlint JavaScript plugins are an experimental integration and the vendored anti-slop rules use lexical analysis rather than cross-file TypeScript inference.

Type-aware checks require installed dependencies, a discoverable tsconfig, and enough memory for the project graph.

The package does not prescribe runtime, bundler, test framework, source directories, generated-file policy, or deployment commands.

Those concerns remain project-local by design.
