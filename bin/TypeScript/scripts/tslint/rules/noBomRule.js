define(["require", "exports", "tslint/lib"], function (require, exports, Lint) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Rule extends Lint.Rules.AbstractRule {
        apply(sourceFile) {
            return this.applyWithFunction(sourceFile, walk);
        }
    }
    Rule.FAILURE_STRING = "This file has a BOM.";
    exports.Rule = Rule;
    function walk(ctx) {
        if (ctx.sourceFile.text[0] === "\ufeff") {
            ctx.addFailure(0, 1, Rule.FAILURE_STRING);
        }
    }
});
