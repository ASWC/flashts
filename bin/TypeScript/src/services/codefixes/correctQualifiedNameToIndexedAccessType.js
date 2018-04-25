/* @internal */
var ts;
(function (ts) {
    var codefix;
    (function (codefix) {
        const fixId = "correctQualifiedNameToIndexedAccessType";
        const errorCodes = [Diagnostics.Cannot_access_0_1_because_0_is_a_type_but_not_a_namespace_Did_you_mean_to_retrieve_the_type_of_the_property_1_in_0_with_0_1.code];
        codefix.registerCodeFix({
            errorCodes,
            getCodeActions(context) {
                const qualifiedName = getQualifiedName(context.sourceFile, context.span.start);
                if (!qualifiedName)
                    return undefined;
                const changes = ts.textChanges.ChangeTracker.with(context, t => doChange(t, context.sourceFile, qualifiedName));
                const newText = `${qualifiedName.left.text}["${qualifiedName.right.text}"]`;
                return [codefix.createCodeFixAction(fixId, changes, [Diagnostics.Rewrite_as_the_indexed_access_type_0, newText], fixId, Diagnostics.Rewrite_all_as_indexed_access_types)];
            },
            fixIds: [fixId],
            getAllCodeActions: (context) => codefix.codeFixAll(context, errorCodes, (changes, diag) => {
                const q = getQualifiedName(diag.file, diag.start);
                if (q) {
                    doChange(changes, diag.file, q);
                }
            }),
        });
        function getQualifiedName(sourceFile, pos) {
            const qualifiedName = ts.findAncestor(ts.getTokenAtPosition(sourceFile, pos, /*includeJsDocComment*/ true), ts.isQualifiedName);
            ts.Debug.assert(!!qualifiedName, "Expected position to be owned by a qualified name.");
            return ts.isIdentifier(qualifiedName.left) ? qualifiedName : undefined;
        }
        function doChange(changeTracker, sourceFile, qualifiedName) {
            const rightText = qualifiedName.right.text;
            const replacement = ts.createIndexedAccessTypeNode(ts.createTypeReferenceNode(qualifiedName.left, /*typeArguments*/ undefined), ts.createLiteralTypeNode(ts.createLiteral(rightText)));
            changeTracker.replaceNode(sourceFile, qualifiedName, replacement);
        }
    })(codefix = ts.codefix || (ts.codefix = {}));
})(ts || (ts = {}));
