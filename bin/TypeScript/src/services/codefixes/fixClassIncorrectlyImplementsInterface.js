/* @internal */
var ts;
(function (ts) {
    var codefix;
    (function (codefix) {
        const errorCodes = [Diagnostics.Class_0_incorrectly_implements_interface_1.code,
            Diagnostics.Class_0_incorrectly_implements_class_1_Did_you_mean_to_extend_1_and_inherit_its_members_as_a_subclass.code];
        const fixId = "fixClassIncorrectlyImplementsInterface"; // TODO: share a group with fixClassDoesntImplementInheritedAbstractMember?
        codefix.registerCodeFix({
            errorCodes,
            getCodeActions(context) {
                const { program, sourceFile, span } = context;
                const classDeclaration = getClass(sourceFile, span.start);
                const checker = program.getTypeChecker();
                return ts.mapDefined(ts.getClassImplementsHeritageClauseElements(classDeclaration), implementedTypeNode => {
                    const changes = ts.textChanges.ChangeTracker.with(context, t => addMissingDeclarations(checker, implementedTypeNode, sourceFile, classDeclaration, t, context.preferences));
                    return changes.length === 0 ? undefined : codefix.createCodeFixAction(fixId, changes, [Diagnostics.Implement_interface_0, implementedTypeNode.getText(sourceFile)], fixId, Diagnostics.Implement_all_unimplemented_interfaces);
                });
            },
            fixIds: [fixId],
            getAllCodeActions(context) {
                const seenClassDeclarations = ts.createMap();
                return codefix.codeFixAll(context, errorCodes, (changes, diag) => {
                    const classDeclaration = getClass(diag.file, diag.start);
                    if (ts.addToSeen(seenClassDeclarations, ts.getNodeId(classDeclaration))) {
                        for (const implementedTypeNode of ts.getClassImplementsHeritageClauseElements(classDeclaration)) {
                            addMissingDeclarations(context.program.getTypeChecker(), implementedTypeNode, diag.file, classDeclaration, changes, context.preferences);
                        }
                    }
                });
            },
        });
        function getClass(sourceFile, pos) {
            return ts.Debug.assertDefined(ts.getContainingClass(ts.getTokenAtPosition(sourceFile, pos, /*includeJsDocComment*/ false)));
        }
        function addMissingDeclarations(checker, implementedTypeNode, sourceFile, classDeclaration, changeTracker, preferences) {
            // Note that this is ultimately derived from a map indexed by symbol names,
            // so duplicates cannot occur.
            const implementedType = checker.getTypeAtLocation(implementedTypeNode);
            const implementedTypeSymbols = checker.getPropertiesOfType(implementedType);
            const nonPrivateMembers = implementedTypeSymbols.filter(symbol => !(ts.getModifierFlags(symbol.valueDeclaration) & ts.ModifierFlags.Private));
            const classType = checker.getTypeAtLocation(classDeclaration);
            if (!classType.getNumberIndexType()) {
                createMissingIndexSignatureDeclaration(implementedType, ts.IndexKind.Number);
            }
            if (!classType.getStringIndexType()) {
                createMissingIndexSignatureDeclaration(implementedType, ts.IndexKind.String);
            }
            codefix.createMissingMemberNodes(classDeclaration, nonPrivateMembers, checker, preferences, member => changeTracker.insertNodeAtClassStart(sourceFile, classDeclaration, member));
            function createMissingIndexSignatureDeclaration(type, kind) {
                const indexInfoOfKind = checker.getIndexInfoOfType(type, kind);
                if (indexInfoOfKind) {
                    changeTracker.insertNodeAtClassStart(sourceFile, classDeclaration, checker.indexInfoToIndexSignatureDeclaration(indexInfoOfKind, kind, classDeclaration));
                }
            }
        }
    })(codefix = ts.codefix || (ts.codefix = {}));
})(ts || (ts = {}));
