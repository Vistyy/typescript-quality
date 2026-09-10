import config from "./oxlint/base.mjs";

export default {
  ...config,
  // The copied plugin and its local integration compile and are exercised through the
  // packed-consumer boundary. Loading the plugin while linting itself would recursively apply its
  // policy to third-party source.
  ignorePatterns: ["dist/**", "vendor/anti-slop/**", "oxlint/inherited-errors.mjs"],
};
