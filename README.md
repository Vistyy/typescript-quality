# @syzom/typescript-quality

Shared, pinned Biome, Oxlint, TypeScript, and optional Effect v4 configuration.
Projects keep ownership of their runtime, source selection, and justified exceptions.
The toolchain is verified on Node.js 24 on Linux.

## Install

```sh
npm install --save-dev --save-exact \
  @syzom/typescript-quality@0.1.1 \
  @biomejs/biome@2.5.12 oxlint@1.81.0 oxlint-tsgolint@7.0.2001 \
  typescript@7.0.2
```

For Effect projects, also install:

```sh
npm install --save-exact effect@4.0.0-rc.112
npm install --save-dev --save-exact @effect/tsgo@0.41.0
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
npx effect-tsgo patch --oxlint --no-typescript
```

Use these same checks locally and in CI:

```sh
npx biome check --error-on-warnings .
npx oxlint --config oxlint.config.ts .
```

Oxlint performs the full TypeScript type-check, so a separate `tsc --noEmit` pass is unnecessary for the same source set.
Selected rule warnings are promoted to errors, and unused Oxlint disable directives are errors too.
The warning guards remain a safeguard for other tool diagnostics.

## Policy and exceptions

- Biome owns formatting, recommended rules, explicit `any` rejection, and cognitive complexity capped at **15**.
- Oxlint owns type-aware safety checks and exhaustive union switches, including switches with a `default` case.
- The Effect preset makes the pinned upstream recommended rules errors and adds unsafe channel-assertion and `any`/`unknown` error/requirements-channel checks.
- Vendored anti-slop rules reject selected low-evidence patterns; [provenance and update instructions](vendor/anti-slop/PROVENANCE.md) identify their upstream source.
- There is no file-length limit, blanket constructor-name ban, or `Shape`-name ban.

Use narrow local overrides or explained inline exceptions for real boundaries rather than disguising code to evade a rule.
Do not enable both editor and lint integrations to report the same Effect diagnostics.

## Maintaining this package

Rule selection lives in `biome/policy.json` and `oxlint/policy.mjs`.
After changing compatible tool pins or selection policy, run `npm run sync:rules` to regenerate severity overlays from the installed pinned tools.
Do not hand-edit `biome/base.json` or `oxlint/inherited-errors.mjs`.
Run `npm ci` and `npm run check` before releasing; the check also rejects stale generated presets.
The check builds and packs the package, installs it into a disposable consumer, and verifies passing examples and intentional rule violations.
To release, update the version and lockfile, commit and push, then push the matching `v<version>` tag.
GitHub Actions verifies that tag and publishes through npm trusted publishing.
