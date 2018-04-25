/* @internal */
var ts;
(function (ts) {
    var codefix;
    (function (codefix) {
        const fixId = "classSuperMustPrecedeThisAccess";
        const errorCodes = [Diagnostics.super_must_be_called_before_accessing_this_in_the_constructor_of_a_derived_class.code];
        codefix.registerCodeFix({
            errorCodes,
            getCodeActions(context) {
                const { sourceFile, span } = context;
                const nodes = getNodes(sourceFile, span.start);
                if (!nodes)
                    return undefined;
                const { constructor, superCall } = nodes;
                const changes = ts.textChanges.ChangeTracker.with(context, t => doChange(t, sourceFile, constructor, superCall));
                return [codefix.createCodeFixAction(fixId, changes, Diagnostics.Make_super_call_the_first_statement_in_the_constructor, fixId, Diagnostics.Make_all_super_calls_the_first_statement_in_their_constructor)];
            },
            fixIds: [fixId],
            getAllCodeActions(context) {
                const { sourceFile } = context;
                const seenClasses = ts.createMap(); // Ensure we only do this once per class.
                return codefix.codeFixAll(context, errorCodes, (changes, diag) => {
                    const nodes = getNodes(diag.file, diag.start);
                    if (!nodes)
                        return;
                    const { constructor, superCall } = nodes;
                    if (ts.addToSeen(seenClasses, ts.getNodeId(constructor.parent))) {
                        doChange(changes, sourceFile, constructor, superCall);
                    }
                });
            },
        });
        function doChange(changes, sourceFile, constructor, superCall) {
            changes.insertNodeAtConstructorStart(sourceFile, constructor, superCall);
            changes.deleteNode(sourceFile, superCall);
        }
        function getNodes(sourceFile, pos) {
            const token = ts.getTokenAtPosition(sourceFile, pos, /*includeJsDocComment*/ false);
            if (token.kind !== ts.SyntaxKind.ThisKeyword)
                return undefined;
            const constructor = ts.getContainingFunction(token);
            const superCall = findSuperCall(constructor.body);
            // figure out if the `this` access is actually inside the supercall
            // i.e. super(this.a), since in that case we won't suggest a fix
            return superCall && !superCall.expression.arguments.some(arg => ts.isPropertyAccessExpression(arg) && arg.expression === token) ? { constructor, superCall } : undefined;
        }
        function findSuperCall(n) {
            return ts.isExpressionStatement(n) && ts.isSuperCall(n.expression)
                ? n
                : ts.isFunctionLike(n)
                    ? undefined
                    : ts.forEachChild(n, findSuperCall);
        }
    })(codefix = ts.codefix || (ts.codefix = {}));
})(ts || (ts = {}));
