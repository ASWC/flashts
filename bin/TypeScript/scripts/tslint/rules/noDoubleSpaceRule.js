define(["require", "exports", "tslint/lib", "typescript"], function (require, exports, Lint, ts) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Rule extends Lint.Rules.AbstractRule {
        apply(sourceFile) {
            return this.applyWithFunction(sourceFile, walk);
        }
    }
    exports.Rule = Rule;
    function walk(ctx) {
        const { sourceFile } = ctx;
        const lines = sourceFile.text.split("\n");
        const strings = getLiterals(sourceFile);
        lines.forEach((line, idx) => {
            // Skip indentation.
            const firstNonSpace = /\S/.exec(line);
            if (firstNonSpace === null) {
                return;
            }
            // Allow common uses of double spaces
            // * To align `=` or `!=` signs
            // * To align comments at the end of lines
            // * To indent inside a comment
            // * To use two spaces after a period
            // * To include aligned `->` in a comment
            const rgx = /[^/*. ]  [^-!/= ]/g;
            rgx.lastIndex = firstNonSpace.index;
            const doubleSpace = rgx.exec(line);
            // Also allow to align comments after `@param`
            if (doubleSpace !== null && !line.includes("@param")) {
                const pos = lines.slice(0, idx).reduce((len, line) => len + 1 + line.length, 0) + doubleSpace.index;
                if (!strings.some(s => s.getStart() <= pos && s.end > pos)) {
                    ctx.addFailureAt(pos + 1, 2, "Use only one space.");
                }
            }
        });
    }
    function getLiterals(sourceFile) {
        const out = [];
        sourceFile.forEachChild(function cb(node) {
            switch (node.kind) {
                case ts.SyntaxKind.StringLiteral:
                case ts.SyntaxKind.TemplateHead:
                case ts.SyntaxKind.TemplateMiddle:
                case ts.SyntaxKind.TemplateTail:
                case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
                case ts.SyntaxKind.RegularExpressionLiteral:
                    out.push(node);
            }
            node.forEachChild(cb);
        });
        return out;
    }
});
