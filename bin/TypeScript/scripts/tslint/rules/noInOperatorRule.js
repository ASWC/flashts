define(["require", "exports", "tslint/lib", "typescript"], function (require, exports, Lint, ts) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Rule extends Lint.Rules.AbstractRule {
        apply(sourceFile) {
            return this.applyWithFunction(sourceFile, walk);
        }
    }
    Rule.FAILURE_STRING = "Don't use the 'in' keyword - use 'hasProperty' to check for key presence instead";
    exports.Rule = Rule;
    function walk(ctx) {
        ts.forEachChild(ctx.sourceFile, recur);
        function recur(node) {
            if (node.kind === ts.SyntaxKind.InKeyword && node.parent.kind === ts.SyntaxKind.BinaryExpression) {
                ctx.addFailureAtNode(node, Rule.FAILURE_STRING);
            }
        }
    }
});
