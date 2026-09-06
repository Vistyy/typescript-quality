import { defineRule } from "@oxlint/plugins";
import { createTypeAliasEnvironment, resolvedTypeMatches, } from "../upstream/shared/type-alias-resolution.js";
/** Assertions cannot establish that a reachable value is impossible. */
export const noNeverTypeAssertionRule = defineRule({
    meta: {
        type: "problem",
        docs: {
            description: "Disallow assertions to never, including locally resolved aliases.",
        },
        messages: {
            neverAssertion: "Do not assert that a value is never. Prove exhaustiveness by narrowing, or validate the value at its boundary.",
        },
    },
    createOnce(context) {
        let environment = null;
        const check = (node) => {
            if (environment === null)
                return;
            const isNever = resolvedTypeMatches(node.typeAnnotation, environment, (type, matches) => {
                if (type.type === "TSNeverKeyword")
                    return true;
                return type.type === "TSParenthesizedType" && matches(type.typeAnnotation);
            });
            if (isNever)
                context.report({ node, messageId: "neverAssertion" });
        };
        return {
            Program(node) {
                environment = createTypeAliasEnvironment(node, context.sourceCode.visitorKeys);
            },
            TSAsExpression: check,
            TSTypeAssertion: check,
        };
    },
});
