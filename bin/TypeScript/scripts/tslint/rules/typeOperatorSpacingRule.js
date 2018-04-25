define(["require", "exports", "tslint/lib", "typescript"], function (require, exports, Lint, ts) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Rule extends Lint.Rules.AbstractRule {
        apply(sourceFile) {
            return this.applyWithFunction(sourceFile, walk);
        }
    }
    Rule.FAILURE_STRING = "The '|' and '&' operators must be surrounded by spaces";
    exports.Rule = Rule;
    function walk(ctx) {
        const { sourceFile } = ctx;
        sourceFile.forEachChild(function cb(node) {
            if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
                check(node);
            }
            node.forEachChild(cb);
        });
        function check(node) {
            const list = node.getChildren().find(child => child.kind === ts.SyntaxKind.SyntaxList);
            for (const child of list.getChildren()) {
                if ((child.kind === ts.SyntaxKind.BarToken || child.kind === ts.SyntaxKind.AmpersandToken)
                    && (/\S/.test(sourceFile.text[child.getStart(sourceFile) - 1]) || /\S/.test(sourceFile.text[child.end]))) {
                    ctx.addFailureAtNode(child, Rule.FAILURE_STRING);
                }
            }
        }
    }
});
