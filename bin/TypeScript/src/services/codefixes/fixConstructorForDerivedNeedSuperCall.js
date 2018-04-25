/* @internal */
var ts;
(function (ts) {
    var codefix;
    (function (codefix) {
        const fixId = "constructorForDerivedNeedSuperCall";
        const errorCodes = [Diagnostics.Constructors_for_derived_classes_must_contain_a_super_call.code];
        codefix.registerCodeFix({
            errorCodes,
            getCodeActions(context) {
                const { sourceFile, span } = context;
                const ctr = getNode(sourceFile, span.start);
                const changes = ts.textChanges.ChangeTracker.with(context, t => doChange(t, sourceFile, ctr));
                return [codefix.createCodeFixAction(fixId, changes, Diagnostics.Add_missing_super_call, fixId, Diagnostics.Add_all_missing_super_calls)];
            },
            fixIds: [fixId],
            getAllCodeActions: context => codefix.codeFixAll(context, errorCodes, (changes, diag) => doChange(changes, context.sourceFile, getNode(diag.file, diag.start))),
        });
        function getNode(sourceFile, pos) {
            const token = ts.getTokenAtPosition(sourceFile, pos, /*includeJsDocComment*/ false);
            ts.Debug.assert(token.kind === ts.SyntaxKind.ConstructorKeyword);
            return token.parent;
        }
        function doChange(changes, sourceFile, ctr) {
            const superCall = ts.createStatement(ts.createCall(ts.createSuper(), /*typeArguments*/ undefined, /*argumentsArray*/ ts.emptyArray));
            changes.insertNodeAtConstructorStart(sourceFile, ctr, superCall);
        }
    })(codefix = ts.codefix || (ts.codefix = {}));
})(ts || (ts = {}));
