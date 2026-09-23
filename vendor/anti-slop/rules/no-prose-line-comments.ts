import { defineRule } from "@oxlint/plugins";

const suppression =
  /^\s*(?:oxlint-disable(?:-next-line|-line)?|biome-ignore(?:-all)?|@ts-(?:expect-error|ignore|nocheck))(?=\s|:|$)/u;

export const noProseLineCommentsRule = defineRule({
  meta: {
    type: "suggestion",
    docs: { description: "Disallow prose // comments in TypeScript code." },
    messages: {
      proseComment: "Use names or owning documentation instead of prose // comments.",
    },
  },
  create(context) {
    if (!/\.(?:ts|tsx|mts|cts)$/u.test(context.filename)) return {};

    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (comment.type !== "Line" || suppression.test(comment.value)) continue;

          context.report({ loc: comment.loc, messageId: "proseComment" });
        }
      },
    };
  },
});
