import { eslintCompatPlugin } from "@oxlint/plugins";
import { noChainedTypeAssertionsRule } from "./upstream/rules/no-chained-type-assertions.js";
import { noConditionalEmptyObjectSpreadRule } from "./upstream/rules/no-conditional-empty-object-spread.js";
import { noKnownValueWideningRule } from "./upstream/rules/no-known-value-widening.js";
import { noModuleMockingRule } from "./upstream/rules/no-module-mocking.js";
import { noObjectParametersRule } from "./upstream/rules/no-object-parameters.js";
import { noReflectApplyRule } from "./upstream/rules/no-reflect-apply.js";
import { noReflectGetRule } from "./upstream/rules/no-reflect-get.js";
import { noRuntimeTypeofRule } from "./upstream/rules/no-runtime-typeof.js";
import { noUnknownParametersRule } from "./upstream/rules/no-unknown-parameters.js";
import { noUnknownReturnsRule } from "./upstream/rules/no-unknown-returns.js";
import { noUnknownTypeAliasesRule } from "./upstream/rules/no-unknown-type-aliases.js";
import { noUnsafeDictionaryTypeRule } from "./upstream/rules/no-unsafe-dictionary-type.js";
import { noWidenThenAssertRule } from "./upstream/rules/no-widen-then-assert.js";
import { requireSafetyCommentForTypeAssertionRule } from "./upstream/rules/require-safety-comment-for-type-assertion.js";
/** Shared anti-slop defaults without spelling or framework-specific policy. */
export default eslintCompatPlugin({
    meta: { name: "anti-slop" },
    rules: {
        "no-chained-type-assertions": noChainedTypeAssertionsRule,
        "no-conditional-empty-object-spread": noConditionalEmptyObjectSpreadRule,
        "no-known-value-widening": noKnownValueWideningRule,
        "no-module-mocking": noModuleMockingRule,
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
