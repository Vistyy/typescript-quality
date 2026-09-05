import { recommended } from "@effect/tsgo/oxlint-presets";
import baseConfig from "./base.mjs";

export default {
  extends: [baseConfig, recommended],
  jsPlugins: [
    {
      name: "anti-slop-effect",
      specifier: "@vistyy/typescript-quality/anti-slop/effect"
    }
  ],
  rules: {
    "anti-slop-effect/no-service-constructor-imports": "error",
    "effecttsgo/floating-effect": "error",
    "effecttsgo/floating-effect-in-vitest": "error",
    "effecttsgo/missing-effect-context": "error",
    "effecttsgo/missing-effect-error": "error",
    "effecttsgo/missing-layer-context": "error",
    "effecttsgo/missing-return-yield-star": "error",
    "effecttsgo/missing-star-in-yield-effect-gen": "error",
    "effecttsgo/promise-in-effect-success": "error",
    "effecttsgo/unsafe-effect-type-assertion": "error"
  }
};
