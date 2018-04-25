define(["require", "exports", "tslint/lib", "typescript"], function (require, exports, Lint, ts) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Rule extends Lint.Rules.AbstractRule {
        apply(sourceFile) {
            return this.applyWithFunction(sourceFile, walk);
        }
    }
    Rule.TRAILING_FAILURE_STRING = "Excess trailing whitespace found around type assertion.";
    exports.Rule = Rule;
    function walk(ctx) {
        ts.forEachChild(ctx.sourceFile, recur);
        function recur(node) {
            if (node.kind === ts.SyntaxKind.TypeAssertionExpression) {
                const refined = node;
                const leftSideWhitespaceStart = refined.type.getEnd() + 1;
                const rightSideWhitespaceEnd = refined.expression.getStart();
                if (leftSideWhitespaceStart !== rightSideWhitespaceEnd) {
                    ctx.addFailure(leftSideWhitespaceStart, rightSideWhitespaceEnd, Rule.TRAILING_FAILURE_STRING);
                }
            }
            ts.forEachChild(node, recur);
        }
    }
});
