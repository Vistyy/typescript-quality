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
    "effecttsgo/node-builtin-import": "off",
    "anti-slop-effect/no-manual-effect-error-tag": "error",
    "anti-slop-effect/prefer-effect-match": "error",
  },
};
