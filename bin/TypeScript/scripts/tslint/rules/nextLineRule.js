define(["require", "exports", "tslint/lib", "typescript"], function (require, exports, Lint, ts) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const OPTION_CATCH = "check-catch";
    const OPTION_ELSE = "check-else";
    class Rule extends Lint.Rules.AbstractRule {
        apply(sourceFile) {
            const options = this.getOptions().ruleArguments;
            const checkCatch = options.indexOf(OPTION_CATCH) !== -1;
            const checkElse = options.indexOf(OPTION_ELSE) !== -1;
            return this.applyWithFunction(sourceFile, ctx => walk(ctx, checkCatch, checkElse));
        }
    }
    Rule.CATCH_FAILURE_STRING = "'catch' should not be on the same line as the preceeding block's curly brace";
    Rule.ELSE_FAILURE_STRING = "'else' should not be on the same line as the preceeding block's curly brace";
    exports.Rule = Rule;
    function walk(ctx, checkCatch, checkElse) {
        const { sourceFile } = ctx;
        ts.forEachChild(sourceFile, function recur(node) {
            switch (node.kind) {
                case ts.SyntaxKind.IfStatement:
                    checkIf(node);
                    break;
                case ts.SyntaxKind.TryStatement:
                    checkTry(node);
                    break;
            }
            ts.forEachChild(node, recur);
        });
        function checkIf(node) {
            const { thenStatement, elseStatement } = node;
            if (!elseStatement) {
                return;
            }
            // find the else keyword
            const elseKeyword = getFirstChildOfKind(node, ts.SyntaxKind.ElseKeyword);
            if (checkElse && !!elseKeyword) {
                const thenStatementEndLoc = sourceFile.getLineAndCharacterOfPosition(thenStatement.getEnd());
                const elseKeywordLoc = sourceFile.getLineAndCharacterOfPosition(elseKeyword.getStart(sourceFile));
                if (thenStatementEndLoc.line === elseKeywordLoc.line) {
                    ctx.addFailureAtNode(elseKeyword, Rule.ELSE_FAILURE_STRING);
                }
            }
        }
        function checkTry({ tryBlock, catchClause }) {
            if (!checkCatch || !catchClause) {
                return;
            }
            const tryClosingBrace = tryBlock.getLastToken(sourceFile);
            const catchKeyword = catchClause.getFirstToken(sourceFile);
            const tryClosingBraceLoc = sourceFile.getLineAndCharacterOfPosition(tryClosingBrace.getEnd());
            const catchKeywordLoc = sourceFile.getLineAndCharacterOfPosition(catchKeyword.getStart(sourceFile));
            if (tryClosingBraceLoc.line === catchKeywordLoc.line) {
                ctx.addFailureAtNode(catchKeyword, Rule.CATCH_FAILURE_STRING);
            }
        }
    }
    function getFirstChildOfKind(node, kind) {
        return node.getChildren().filter((child) => child.kind === kind)[0];
    }
});
