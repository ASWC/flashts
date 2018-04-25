/* @internal */
var ts;
(function (ts) {
    var codefix;
    (function (codefix) {
        const fixId = "useDefaultImport";
        const errorCodes = [Diagnostics.Import_may_be_converted_to_a_default_import.code];
        codefix.registerCodeFix({
            errorCodes,
            getCodeActions(context) {
                const { sourceFile, span: { start } } = context;
                const info = getInfo(sourceFile, start);
                if (!info)
                    return undefined;
                const changes = ts.textChanges.ChangeTracker.with(context, t => doChange(t, sourceFile, info));
                return [codefix.createCodeFixAction(fixId, changes, Diagnostics.Convert_to_default_import, fixId, Diagnostics.Convert_all_to_default_imports)];
            },
            fixIds: [fixId],
            getAllCodeActions: context => codefix.codeFixAll(context, errorCodes, (changes, diag) => {
                const info = getInfo(diag.file, diag.start);
                if (info)
                    doChange(changes, diag.file, info);
            }),
        });
        function getInfo(sourceFile, pos) {
            const name = ts.getTokenAtPosition(sourceFile, pos, /*includeJsDocComment*/ false);
            if (!ts.isIdentifier(name))
                return undefined; // bad input
            const { parent } = name;
            if (ts.isImportEqualsDeclaration(parent) && ts.isExternalModuleReference(parent.moduleReference)) {
                return { importNode: parent, name, moduleSpecifier: parent.moduleReference.expression };
            }
            else if (ts.isNamespaceImport(parent)) {
                const importNode = parent.parent.parent;
                return { importNode, name, moduleSpecifier: importNode.moduleSpecifier };
            }
        }
        function doChange(changes, sourceFile, info) {
            changes.replaceNode(sourceFile, info.importNode, codefix.makeImportDeclaration(info.name, /*namedImports*/ undefined, info.moduleSpecifier));
        }
    })(codefix = ts.codefix || (ts.codefix = {}));
})(ts || (ts = {}));
