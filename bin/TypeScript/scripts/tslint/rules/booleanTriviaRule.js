define(["require", "exports", "tslint/lib", "typescript"], function (require, exports, Lint, ts) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Rule extends Lint.Rules.AbstractRule {
        apply(sourceFile) {
            return this.applyWithFunction(sourceFile, ctx => walk(ctx));
        }
    }
    exports.Rule = Rule;
    function walk(ctx) {
        const { sourceFile } = ctx;
        ts.forEachChild(sourceFile, function recur(node) {
            if (node.kind === ts.SyntaxKind.CallExpression) {
                checkCall(node);
            }
            ts.forEachChild(node, recur);
        });
        function checkCall(node) {
            if (!shouldIgnoreCalledExpression(node.expression)) {
                for (const arg of node.arguments) {
                    checkArg(arg);
                }
            }
        }
        /** Skip certain function/method names whose parameter names are not informative. */
        function shouldIgnoreCalledExpression(expression) {
            if (expression.kind === ts.SyntaxKind.PropertyAccessExpression) {
                const methodName = expression.name.text;
                if (methodName.startsWith("set") || methodName.startsWith("assert")) {
                    return true;
                }
                switch (methodName) {
                    case "apply":
                    case "call":
                    case "equal":
                    case "fail":
                    case "isTrue":
                    case "output":
                    case "stringify":
                        return true;
                }
            }
            else if (expression.kind === ts.SyntaxKind.Identifier) {
                const functionName = expression.text;
                if (functionName.startsWith("set") || functionName.startsWith("assert")) {
                    return true;
                }
                switch (functionName) {
                    case "contains":
                    case "createAnonymousType":
                    case "createImportSpecifier":
                    case "createProperty":
                    case "createSignature":
                    case "resolveName":
                        return true;
                }
            }
            return false;
        }
        function checkArg(arg) {
            if (!isTrivia(arg)) {
                return;
            }
            const ranges = ts.getTrailingCommentRanges(sourceFile.text, arg.pos) || ts.getLeadingCommentRanges(sourceFile.text, arg.pos);
            if (ranges === undefined || ranges.length !== 1 || ranges[0].kind !== ts.SyntaxKind.MultiLineCommentTrivia) {
                ctx.addFailureAtNode(arg, "Tag argument with parameter name");
                return;
            }
            const range = ranges[0];
            const argStart = arg.getStart(sourceFile);
            if (range.end + 1 !== argStart && sourceFile.text.slice(range.end, argStart).indexOf("\n") === -1) {
                ctx.addFailureAtNode(arg, "There should be 1 space between an argument and its comment.");
            }
        }
        function isTrivia(arg) {
            switch (arg.kind) {
                case ts.SyntaxKind.TrueKeyword:
                case ts.SyntaxKind.FalseKeyword:
                case ts.SyntaxKind.NullKeyword:
                    return true;
                case ts.SyntaxKind.Identifier:
                    return arg.originalKeywordKind === ts.SyntaxKind.UndefinedKeyword;
                default:
                    return false;
            }
        }
    }
});
