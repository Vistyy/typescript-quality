import { defineRule } from "@oxlint/plugins";
import { containsUnknownType, functionParameterBindingName, functionParameterTypeAnnotation, } from "../upstream/shared/function-parameters.js";
function isTypePredicateSubject(owner, parameterName) {
    const predicate = owner.returnType?.typeAnnotation;
    return (predicate?.type === "TSTypePredicate" &&
        predicate.parameterName.type === "Identifier" &&
        predicate.parameterName.name === parameterName);
}
function staticMethodName(callee) {
    if (!("property" in callee) || !("computed" in callee))
        return null;
    return callee.computed
        ? callee.property.type === "Literal" &&
            (callee.property.value === "catch" || callee.property.value === "then")
            ? callee.property.value
            : null
        : callee.property.type === "Identifier"
            ? callee.property.name
            : null;
}
function isPromiseRejectionCallback(owner) {
    if (owner.type !== "ArrowFunctionExpression" && owner.type !== "FunctionExpression")
        return false;
    const call = owner.parent;
    if (call?.type !== "CallExpression")
        return false;
    if (call.callee.type === "Super" || call.callee.type === "V8IntrinsicExpression")
        return false;
    const argument = call.arguments.indexOf(owner);
    const method = staticMethodName(call.callee);
    return (method === "catch" && argument === 0) || (method === "then" && argument === 1);
}
/** Disallow unknown inputs except owned causes, type guards, and Promise rejection callbacks. */
export const noUnknownParametersRule = defineRule({
    meta: {
        type: "problem",
        docs: {
            description: "Disallow explicitly unknown function parameters except causes, type-predicate subjects, and Promise rejection callbacks.",
        },
        messages: {
            unknownParameter: "Parameter `{{parameter}}` leaves input unparsed. Accept a named domain type; run the expected schema or parser at the I/O boundary before calling this function.",
        },
    },
    createOnce(context) {
        const checkParameters = (node) => {
            for (const parameter of node.params) {
                const annotation = functionParameterTypeAnnotation(parameter);
                if (annotation === null || annotation === undefined)
                    continue;
                if (!containsUnknownType(annotation.typeAnnotation))
                    continue;
                const name = functionParameterBindingName(parameter, context.sourceCode);
                if (name === "cause" ||
                    isTypePredicateSubject(node, name) ||
                    isPromiseRejectionCallback(node))
                    continue;
                context.report({
                    node: annotation.typeAnnotation,
                    messageId: "unknownParameter",
                    data: { parameter: name },
                });
            }
        };
        return {
            ArrowFunctionExpression: checkParameters,
            FunctionDeclaration: checkParameters,
            FunctionExpression: checkParameters,
            TSCallSignatureDeclaration: checkParameters,
            TSConstructSignatureDeclaration: checkParameters,
            TSConstructorType: checkParameters,
            TSDeclareFunction: checkParameters,
            TSEmptyBodyFunctionExpression: checkParameters,
            TSFunctionType: checkParameters,
            TSMethodSignature: checkParameters,
        };
    },
});
