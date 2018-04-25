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
        ts.forEachChild(ctx.sourceFile, function recur(node) {
            if (ts.isCallExpression(node)) {
                checkCall(node);
            }
            ts.forEachChild(node, recur);
        });
        function checkCall(node) {
            if (!isDebugAssert(node.expression) || node.arguments.length < 2) {
                return;
            }
            const message = node.arguments[1];
            if (!ts.isStringLiteral(message)) {
                ctx.addFailureAtNode(message, "Second argument to 'Debug.assert' should be a string literal.");
            }
            if (node.arguments.length < 3) {
                return;
            }
            const message2 = node.arguments[2];
            if (!ts.isStringLiteral(message2) && !ts.isArrowFunction(message2)) {
                ctx.addFailureAtNode(message, "Third argument to 'Debug.assert' should be a string literal or arrow function.");
            }
        }
        function isDebugAssert(expr) {
            return ts.isPropertyAccessExpression(expr) && isName(expr.expression, "Debug") && isName(expr.name, "assert");
        }
        function isName(expr, text) {
            return ts.isIdentifier(expr) && expr.text === text;
        }
    }
});
