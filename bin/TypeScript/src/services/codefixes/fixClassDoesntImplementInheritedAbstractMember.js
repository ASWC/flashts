/* @internal */
var ts;
(function (ts) {
    var codefix;
    (function (codefix) {
        const errorCodes = [
            Diagnostics.Non_abstract_class_0_does_not_implement_inherited_abstract_member_1_from_class_2.code,
            Diagnostics.Non_abstract_class_expression_does_not_implement_inherited_abstract_member_0_from_class_1.code,
        ];
        const fixId = "fixClassDoesntImplementInheritedAbstractMember";
        codefix.registerCodeFix({
            errorCodes,
            getCodeActions(context) {
                const { program, sourceFile, span } = context;
                const changes = ts.textChanges.ChangeTracker.with(context, t => addMissingMembers(getClass(sourceFile, span.start), sourceFile, program.getTypeChecker(), t, context.preferences));
                return changes.length === 0 ? undefined : [codefix.createCodeFixAction(fixId, changes, Diagnostics.Implement_inherited_abstract_class, fixId, Diagnostics.Implement_all_inherited_abstract_classes)];
            },
            fixIds: [fixId],
            getAllCodeActions: context => {
                const seenClassDeclarations = ts.createMap();
                return codefix.codeFixAll(context, errorCodes, (changes, diag) => {
                    const classDeclaration = getClass(diag.file, diag.start);
                    if (ts.addToSeen(seenClassDeclarations, ts.getNodeId(classDeclaration))) {
                        addMissingMembers(classDeclaration, context.sourceFile, context.program.getTypeChecker(), changes, context.preferences);
                    }
                });
            },
        });
        function getClass(sourceFile, pos) {
            // Token is the identifier in the case of a class declaration
            // or the class keyword token in the case of a class expression.
            const token = ts.getTokenAtPosition(sourceFile, pos, /*includeJsDocComment*/ false);
            return ts.cast(token.parent, ts.isClassLike);
        }
        function addMissingMembers(classDeclaration, sourceFile, checker, changeTracker, preferences) {
            const extendsNode = ts.getClassExtendsHeritageClauseElement(classDeclaration);
            const instantiatedExtendsType = checker.getTypeAtLocation(extendsNode);
            // Note that this is ultimately derived from a map indexed by symbol names,
            // so duplicates cannot occur.
            const abstractAndNonPrivateExtendsSymbols = checker.getPropertiesOfType(instantiatedExtendsType).filter(symbolPointsToNonPrivateAndAbstractMember);
            codefix.createMissingMemberNodes(classDeclaration, abstractAndNonPrivateExtendsSymbols, checker, preferences, member => changeTracker.insertNodeAtClassStart(sourceFile, classDeclaration, member));
        }
        function symbolPointsToNonPrivateAndAbstractMember(symbol) {
            // See `codeFixClassExtendAbstractProtectedProperty.ts` in https://github.com/Microsoft/TypeScript/pull/11547/files
            // (now named `codeFixClassExtendAbstractPrivateProperty.ts`)
            const flags = ts.getModifierFlags(ts.first(symbol.getDeclarations()));
            return !(flags & ts.ModifierFlags.Private) && !!(flags & ts.ModifierFlags.Abstract);
        }
    })(codefix = ts.codefix || (ts.codefix = {}));
})(ts || (ts = {}));
