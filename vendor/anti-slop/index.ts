import { eslintCompatPlugin } from "@oxlint/plugins";

import { noNeverTypeAssertionRule } from "./rules/no-never-type-assertion.ts";

import { noChainedTypeAssertionsRule } from "./upstream/rules/no-chained-type-assertions.ts";
import { noConditionalEmptyObjectSpreadRule } from "./upstream/rules/no-conditional-empty-object-spread.ts";
import { noKnownValueWideningRule } from "./upstream/rules/no-known-value-widening.ts";
import { noModuleMockingRule } from "./upstream/rules/no-module-mocking.ts";
import { noObjectParametersRule } from "./upstream/rules/no-object-parameters.ts";
import { noReflectApplyRule } from "./upstream/rules/no-reflect-apply.ts";
import { noReflectGetRule } from "./upstream/rules/no-reflect-get.ts";
import { noRuntimeTypeofRule } from "./upstream/rules/no-runtime-typeof.ts";
import { noUnknownParametersRule } from "./upstream/rules/no-unknown-parameters.ts";
import { noUnknownReturnsRule } from "./upstream/rules/no-unknown-returns.ts";
import { noUnknownTypeAliasesRule } from "./upstream/rules/no-unknown-type-aliases.ts";
import { noUnsafeDictionaryTypeRule } from "./upstream/rules/no-unsafe-dictionary-type.ts";
import { noWidenThenAssertRule } from "./upstream/rules/no-widen-then-assert.ts";
import { requireSafetyCommentForTypeAssertionRule } from "./upstream/rules/require-safety-comment-for-type-assertion.ts";

/** Shared anti-slop defaults without spelling or framework-specific policy. */
export default eslintCompatPlugin({
  meta: { name: "anti-slop" },
  rules: {
    "no-chained-type-assertions": noChainedTypeAssertionsRule,
    "no-conditional-empty-object-spread": noConditionalEmptyObjectSpreadRule,
    "no-known-value-widening": noKnownValueWideningRule,
    "no-module-mocking": noModuleMockingRule,
    "no-never-type-assertion": noNeverTypeAssertionRule,
    "no-object-parameters": noObjectParametersRule,
    "no-reflect-apply": noReflectApplyRule,
    "no-reflect-get": noReflectGetRule,
    "no-runtime-typeof": noRuntimeTypeofRule,
    "no-unknown-parameters": noUnknownParametersRule,
    "no-unknown-returns": noUnknownReturnsRule,
    "no-unknown-type-aliases": noUnknownTypeAliasesRule,
    "no-unsafe-dictionary-type": noUnsafeDictionaryTypeRule,
    "no-widen-then-assert": noWidenThenAssertRule,
    "require-safety-comment-for-type-assertion": requireSafetyCommentForTypeAssertionRule,
  },
});
