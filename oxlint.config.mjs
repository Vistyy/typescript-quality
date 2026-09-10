import config from "./oxlint/base.mjs";

export default {
  ...config,
  // Verbatim upstream and generated files are checked at their ownership boundaries instead.
  ignorePatterns: ["dist/**", "vendor/anti-slop/upstream/**", "oxlint/inherited-errors.mjs"],
};
