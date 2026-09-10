import inheritedErrors from "./inherited-errors.mjs";
import policy from "./policy.mjs";

export default {
  ...policy,
  rules: { ...inheritedErrors, ...policy.rules },
};
