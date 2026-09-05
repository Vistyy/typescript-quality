import { recommended } from "@effect/tsgo/oxlint-presets";
import baseConfig from "./base.mjs";

export default {
  options: baseConfig.options,
  extends: [baseConfig, recommended],
  rules: Object.fromEntries(
    Object.keys(recommended.rules).map((rule) => [rule, "error"])
  )
};
