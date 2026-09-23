import { defineRule } from "@oxlint/plugins";
const suppression = /^\s*(?:oxlint-disable(?:-next-line|-line)?|biome-ignore(?:-all)?|@ts-(?:expect-error|ignore|nocheck))(?=\s|:|$)/u;
const typeScriptDirective = /^\/\s*<(?:reference\s+(?:path|types|lib|no-default-lib)|amd-module\s+name|amd-dependency\s+path)\s*=\s*(?:"[^"]+"|'[^']+')(?:\s+[a-z][\w-]*\s*=\s*(?:"[^"]+"|'[^']+'))*\s*\/>\s*$/u;
export const noProseLineCommentsRule = defineRule({
    meta: {
        type: "suggestion",
        docs: { description: "Disallow prose // comments in TypeScript code." },
        messages: {
            proseComment: "Use names or owning documentation instead of prose // comments.",
        },
    },
    create(context) {
        if (!/\.(?:ts|tsx|mts|cts)$/u.test(context.filename))
            return {};
        return {
            Program(program) {
                const firstStatementStart = program.body[0]?.range[0] ?? Number.POSITIVE_INFINITY;
                for (const comment of context.sourceCode.getAllComments()) {
                    if (comment.type !== "Line" || suppression.test(comment.value))
                        continue;
                    if (comment.range[0] < firstStatementStart && typeScriptDirective.test(comment.value))
                        continue;
                    context.report({ loc: comment.loc, messageId: "proseComment" });
                }
            },
        };
    },
});
