import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import {
  createTypeAliasEnvironment,
  resolvedTypeMatches,
  type TypeAliasEnvironment,
} from "../upstream/shared/type-alias-resolution.ts";

/** Assertions cannot establish that a reachable value is impossible. */
export const noNeverTypeAssertionRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow assertions to never, including locally resolved aliases.",
    },
    messages: {
      neverAssertion:
        "Do not assert that a value is never. Prove exhaustiveness by narrowing, or validate the value at its boundary.",
    },
  },
  createOnce(context) {
    let environment: TypeAliasEnvironment | null = null;
    const check = (node: ESTree.TSAsExpression | ESTree.TSTypeAssertion) => {
      if (environment === null) return;
      const isNever = resolvedTypeMatches(node.typeAnnotation, environment, (type, matches) => {
        if (type.type === "TSNeverKeyword") return true;
        return type.type === "TSParenthesizedType" && matches(type.typeAnnotation);
      });
      if (isNever) context.report({ node, messageId: "neverAssertion" });
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
