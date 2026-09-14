import type { ESTree, SourceCode } from "@oxlint/plugins";
import { defineRule } from "@oxlint/plugins";
import { resolveVariable } from "../upstream/shared/scope.ts";

function isGlobalJson(sourceCode: SourceCode, expression: ESTree.Expression): boolean {
  if (expression.type !== "Identifier" || expression.name !== "JSON") return false;

  if (sourceCode.isGlobalReference(expression)) return true;

  const variable = resolveVariable(sourceCode, expression);

  return variable === null || variable.defs.length === 0;
}

function isJsonParseCall(sourceCode: SourceCode, expression: ESTree.Expression): boolean {
  if (expression.type !== "CallExpression") return false;

  const callee = expression.callee;

  if (callee.type === "Super" || callee.type === "V8IntrinsicExpression") return false;

  if (!("object" in callee) || !("property" in callee) || !("computed" in callee)) return false;

  if (!isGlobalJson(sourceCode, callee.object)) return false;

  return callee.computed
    ? callee.property.type === "Literal" && callee.property.value === "parse"
    : callee.property.type === "Identifier" && callee.property.name === "parse";
}

/** Runtime JSON must be decoded or validated before it receives a trusted static type. */
export const noJsonParseTypeAssertionRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow direct type assertions on the result of global JSON.parse.",
    },
    messages: {
      assertedJson:
        "JSON.parse returns untrusted runtime data. Decode or validate it before assigning a trusted type.",
    },
  },
  createOnce(context) {
    const check = (node: ESTree.TSAsExpression | ESTree.TSTypeAssertion) => {
      if (isJsonParseCall(context.sourceCode, node.expression)) {
        context.report({ node, messageId: "assertedJson" });
      }
    };

    return {
      TSAsExpression: check,
      TSTypeAssertion: check,
    };
  },
});
