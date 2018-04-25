/* @internal */
var ts;
(function (ts) {
    var codefix;
    (function (codefix) {
        const fixName = "strictClassInitialization";
        const fixIdAddDefiniteAssignmentAssertions = "addMissingPropertyDefiniteAssignmentAssertions";
        const fixIdAddUndefinedType = "addMissingPropertyUndefinedType";
        const fixIdAddInitializer = "addMissingPropertyInitializer";
        const errorCodes = [Diagnostics.Property_0_has_no_initializer_and_is_not_definitely_assigned_in_the_constructor.code];
        codefix.registerCodeFix({
            errorCodes,
            getCodeActions: (context) => {
                const propertyDeclaration = getPropertyDeclaration(context.sourceFile, context.span.start);
                if (!propertyDeclaration)
                    return;
                const result = [
                    getActionForAddMissingUndefinedType(context, propertyDeclaration),
                    getActionForAddMissingDefiniteAssignmentAssertion(context, propertyDeclaration)
                ];
                ts.append(result, getActionForAddMissingInitializer(context, propertyDeclaration));
                return result;
            },
            fixIds: [fixIdAddDefiniteAssignmentAssertions, fixIdAddUndefinedType, fixIdAddInitializer],
            getAllCodeActions: context => {
                return codefix.codeFixAll(context, errorCodes, (changes, diag) => {
                    const propertyDeclaration = getPropertyDeclaration(diag.file, diag.start);
                    if (!propertyDeclaration)
                        return;
                    switch (context.fixId) {
                        case fixIdAddDefiniteAssignmentAssertions:
                            addDefiniteAssignmentAssertion(changes, diag.file, propertyDeclaration);
                            break;
                        case fixIdAddUndefinedType:
                            addUndefinedType(changes, diag.file, propertyDeclaration);
                            break;
                        case fixIdAddInitializer:
                            const checker = context.program.getTypeChecker();
                            const initializer = getInitializer(checker, propertyDeclaration);
                            if (!initializer)
                                return;
                            addInitializer(changes, diag.file, propertyDeclaration, initializer);
                            break;
                        default:
                            ts.Debug.fail(JSON.stringify(context.fixId));
                    }
                });
            },
        });
        function getPropertyDeclaration(sourceFile, pos) {
            const token = ts.getTokenAtPosition(sourceFile, pos, /*includeJsDocComment*/ false);
            return ts.isIdentifier(token) ? ts.cast(token.parent, ts.isPropertyDeclaration) : undefined;
        }
        function getActionForAddMissingDefiniteAssignmentAssertion(context, propertyDeclaration) {
            const changes = ts.textChanges.ChangeTracker.with(context, t => addDefiniteAssignmentAssertion(t, context.sourceFile, propertyDeclaration));
            return codefix.createCodeFixAction(fixName, changes, [Diagnostics.Add_definite_assignment_assertion_to_property_0, propertyDeclaration.getText()], fixIdAddDefiniteAssignmentAssertions, Diagnostics.Add_definite_assignment_assertions_to_all_uninitialized_properties);
        }
        function addDefiniteAssignmentAssertion(changeTracker, propertyDeclarationSourceFile, propertyDeclaration) {
            const property = ts.updateProperty(propertyDeclaration, propertyDeclaration.decorators, propertyDeclaration.modifiers, propertyDeclaration.name, ts.createToken(ts.SyntaxKind.ExclamationToken), propertyDeclaration.type, propertyDeclaration.initializer);
            changeTracker.replaceNode(propertyDeclarationSourceFile, propertyDeclaration, property);
        }
        function getActionForAddMissingUndefinedType(context, propertyDeclaration) {
            const changes = ts.textChanges.ChangeTracker.with(context, t => addUndefinedType(t, context.sourceFile, propertyDeclaration));
            return codefix.createCodeFixAction(fixName, changes, [Diagnostics.Add_undefined_type_to_property_0, propertyDeclaration.name.getText()], fixIdAddUndefinedType, Diagnostics.Add_undefined_type_to_all_uninitialized_properties);
        }
        function addUndefinedType(changeTracker, propertyDeclarationSourceFile, propertyDeclaration) {
            const undefinedTypeNode = ts.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword);
            const types = ts.isUnionTypeNode(propertyDeclaration.type) ? propertyDeclaration.type.types.concat(undefinedTypeNode) : [propertyDeclaration.type, undefinedTypeNode];
            changeTracker.replaceNode(propertyDeclarationSourceFile, propertyDeclaration.type, ts.createUnionTypeNode(types));
        }
        function getActionForAddMissingInitializer(context, propertyDeclaration) {
            const checker = context.program.getTypeChecker();
            const initializer = getInitializer(checker, propertyDeclaration);
            if (!initializer)
                return undefined;
            const changes = ts.textChanges.ChangeTracker.with(context, t => addInitializer(t, context.sourceFile, propertyDeclaration, initializer));
            return codefix.createCodeFixAction(fixName, changes, [Diagnostics.Add_initializer_to_property_0, propertyDeclaration.name.getText()], fixIdAddInitializer, Diagnostics.Add_initializers_to_all_uninitialized_properties);
        }
        function addInitializer(changeTracker, propertyDeclarationSourceFile, propertyDeclaration, initializer) {
            const property = ts.updateProperty(propertyDeclaration, propertyDeclaration.decorators, propertyDeclaration.modifiers, propertyDeclaration.name, propertyDeclaration.questionToken, propertyDeclaration.type, initializer);
            changeTracker.replaceNode(propertyDeclarationSourceFile, propertyDeclaration, property);
        }
        function getInitializer(checker, propertyDeclaration) {
            return getDefaultValueFromType(checker, checker.getTypeFromTypeNode(propertyDeclaration.type));
        }
        function getDefaultValueFromType(checker, type) {
            if (type.flags & ts.TypeFlags.String) {
                return ts.createLiteral("");
            }
            else if (type.flags & ts.TypeFlags.Number) {
                return ts.createNumericLiteral("0");
            }
            else if (type.flags & ts.TypeFlags.Boolean) {
                return ts.createFalse();
            }
            else if (type.isLiteral()) {
                return ts.createLiteral(type.value);
            }
            else if (type.isUnion()) {
                return ts.firstDefined(type.types, t => getDefaultValueFromType(checker, t));
            }
            else if (type.isClass()) {
                const classDeclaration = ts.getClassLikeDeclarationOfSymbol(type.symbol);
                if (!classDeclaration || ts.hasModifier(classDeclaration, ts.ModifierFlags.Abstract))
                    return undefined;
                const constructorDeclaration = ts.getFirstConstructorWithBody(classDeclaration);
                if (constructorDeclaration && constructorDeclaration.parameters.length)
                    return undefined;
                return ts.createNew(ts.createIdentifier(type.symbol.name), /*typeArguments*/ undefined, /*argumentsArray*/ undefined);
            }
            return undefined;
        }
    })(codefix = ts.codefix || (ts.codefix = {}));
})(ts || (ts = {}));
