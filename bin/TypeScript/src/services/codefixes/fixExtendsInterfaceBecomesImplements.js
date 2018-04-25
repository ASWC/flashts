/* @internal */
var ts;
(function (ts) {
    var codefix;
    (function (codefix) {
        const fixId = "extendsInterfaceBecomesImplements";
        const errorCodes = [Diagnostics.Cannot_extend_an_interface_0_Did_you_mean_implements.code];
        codefix.registerCodeFix({
            errorCodes,
            getCodeActions(context) {
                const { sourceFile } = context;
                const nodes = getNodes(sourceFile, context.span.start);
                if (!nodes)
                    return undefined;
                const { extendsToken, heritageClauses } = nodes;
                const changes = ts.textChanges.ChangeTracker.with(context, t => doChanges(t, sourceFile, extendsToken, heritageClauses));
                return [codefix.createCodeFixAction(fixId, changes, Diagnostics.Change_extends_to_implements, fixId, Diagnostics.Change_all_extended_interfaces_to_implements)];
            },
            fixIds: [fixId],
            getAllCodeActions: context => codefix.codeFixAll(context, errorCodes, (changes, diag) => {
                const nodes = getNodes(diag.file, diag.start);
                if (nodes)
                    doChanges(changes, diag.file, nodes.extendsToken, nodes.heritageClauses);
            }),
        });
        function getNodes(sourceFile, pos) {
            const token = ts.getTokenAtPosition(sourceFile, pos, /*includeJsDocComment*/ false);
            const heritageClauses = ts.getContainingClass(token).heritageClauses;
            const extendsToken = heritageClauses[0].getFirstToken();
            return extendsToken.kind === ts.SyntaxKind.ExtendsKeyword ? { extendsToken, heritageClauses } : undefined;
        }
        function doChanges(changes, sourceFile, extendsToken, heritageClauses) {
            changes.replaceNode(sourceFile, extendsToken, ts.createToken(ts.SyntaxKind.ImplementsKeyword));
            // If there is already an implements clause, replace the implements keyword with a comma.
            if (heritageClauses.length === 2 &&
                heritageClauses[0].token === ts.SyntaxKind.ExtendsKeyword &&
                heritageClauses[1].token === ts.SyntaxKind.ImplementsKeyword) {
                const implementsToken = heritageClauses[1].getFirstToken();
                const implementsFullStart = implementsToken.getFullStart();
                changes.replaceRange(sourceFile, { pos: implementsFullStart, end: implementsFullStart }, ts.createToken(ts.SyntaxKind.CommaToken));
                // Rough heuristic: delete trailing whitespace after keyword so that it's not excessive.
                // (Trailing because leading might be indentation, which is more sensitive.)
                const text = sourceFile.text;
                let end = implementsToken.end;
                while (end < text.length && ts.isWhiteSpaceSingleLine(text.charCodeAt(end))) {
                    end++;
                }
                changes.deleteRange(sourceFile, { pos: implementsToken.getStart(), end });
            }
        }
    })(codefix = ts.codefix || (ts.codefix = {}));
})(ts || (ts = {}));