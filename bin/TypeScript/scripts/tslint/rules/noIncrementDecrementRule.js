define(["require", "exports", "tslint/lib", "typescript"], function (require, exports, Lint, ts) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Rule extends Lint.Rules.AbstractRule {
        apply(sourceFile) {
            return this.applyWithFunction(sourceFile, walk);
        }
    }
    Rule.POSTFIX_FAILURE_STRING = "Don't use '++' or '--' postfix operators outside statements or for loops.";
    Rule.PREFIX_FAILURE_STRING = "Don't use '++' or '--' prefix operators.";
    exports.Rule = Rule;
    function walk(ctx) {
        ts.forEachChild(ctx.sourceFile, recur);
        function recur(node) {
            switch (node.kind) {
                case ts.SyntaxKind.PrefixUnaryExpression:
                    const { operator } = node;
                    if (operator === ts.SyntaxKind.PlusPlusToken || operator === ts.SyntaxKind.MinusMinusToken) {
                        check(node);
                    }
                    break;
                case ts.SyntaxKind.PostfixUnaryExpression:
                    check(node);
                    break;
            }
        }
        function check(node) {
            if (!isAllowedLocation(node.parent)) {
                ctx.addFailureAtNode(node, Rule.POSTFIX_FAILURE_STRING);
            }
        }
    }
    function isAllowedLocation(node) {
        switch (node.kind) {
            // Can be a statement
            case ts.SyntaxKind.ExpressionStatement:
                return true;
            // Can be directly in a for-statement
            case ts.SyntaxKind.ForStatement:
                return true;
            // Can be in a comma operator in a for statement (`for (let a = 0, b = 10; a < b; a++, b--)`)
            case ts.SyntaxKind.BinaryExpression:
                return node.operatorToken.kind === ts.SyntaxKind.CommaToken &&
                    node.parent.kind === ts.SyntaxKind.ForStatement;
            default:
                return false;
        }
    }
});
