import policy from "./policy.mjs";
import inheritedErrors from "./inherited-errors.mjs";

export default {
  ...policy,
  rules: { ...inheritedErrors, ...policy.rules }
};
