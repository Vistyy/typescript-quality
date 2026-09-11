import { recommended } from "@effect/tsgo/oxlint-presets";
import baseConfig from "./base.mjs";

const recommendedRules = recommended.rules ?? {};

export default {
  extends: [baseConfig, recommended],
  plugins: [...(baseConfig.plugins ?? []), ...(recommended.plugins ?? [])],
  jsPlugins: [
    ...baseConfig.jsPlugins,
    {
      name: "anti-slop-effect",
      specifier: "@syzom/typescript-quality/anti-slop/effect",
    },
  ],
  rules: {
    ...Object.fromEntries(Object.keys(recommendedRules).map((rule) => [rule, "error"])),
    "effecttsgo/unsafe-effect-type-assertion": "error",
    "effecttsgo/any-unknown-in-error-context": "error",
    "anti-slop-effect/no-manual-effect-error-tag": "error",
    "anti-slop-effect/no-manual-tag-comparison": "error",
    "anti-slop-effect/no-manual-tagged-construction": "error",
    "anti-slop-effect/no-service-constructor-imports": "error",
    "anti-slop-effect/prefer-effect-match": "error",
  },
};
