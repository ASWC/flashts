/* @internal */
var ts;
(function (ts) {
    var refactor;
    (function (refactor) {
        var generateGetAccessorAndSetAccessor;
        (function (generateGetAccessorAndSetAccessor) {
            const actionName = "Generate 'get' and 'set' accessors";
            const actionDescription = Diagnostics.Generate_get_and_set_accessors.message;
            refactor.registerRefactor(actionName, { getEditsForAction, getAvailableActions });
            function getAvailableActions(context) {
                const { file, startPosition } = context;
                if (!getConvertibleFieldAtPosition(file, startPosition))
                    return undefined;
                return [{
                        name: actionName,
                        description: actionDescription,
                        actions: [
                            {
                                name: actionName,
                                description: actionDescription
                            }
                        ]
                    }];
            }
            function getEditsForAction(context, _actionName) {
                const { file, startPosition } = context;
                const fieldInfo = getConvertibleFieldAtPosition(file, startPosition);
                if (!fieldInfo)
                    return undefined;
                const isJS = ts.isSourceFileJavaScript(file);
                const changeTracker = ts.textChanges.ChangeTracker.fromContext(context);
                const { isStatic, fieldName, accessorName, type, container, declaration } = fieldInfo;
                const isInClassLike = ts.isClassLike(container);
                const accessorModifiers = isInClassLike
                    ? !declaration.modifiers || ts.getModifierFlags(declaration) & ts.ModifierFlags.Private ? getModifiers(isJS, isStatic, ts.SyntaxKind.PublicKeyword) : declaration.modifiers
                    : undefined;
                const fieldModifiers = isInClassLike ? getModifiers(isJS, isStatic, ts.SyntaxKind.PrivateKeyword) : undefined;
                updateFieldDeclaration(changeTracker, file, declaration, fieldName, fieldModifiers, container);
                const getAccessor = generateGetAccessor(fieldName, accessorName, type, accessorModifiers, isStatic, container);
                const setAccessor = generateSetAccessor(fieldName, accessorName, type, accessorModifiers, isStatic, container);
                insertAccessor(changeTracker, file, getAccessor, declaration, container);
                insertAccessor(changeTracker, file, setAccessor, declaration, container);
                const edits = changeTracker.getChanges();
                const renameFilename = file.fileName;
                const renameLocationOffset = ts.isIdentifier(fieldName) ? 0 : -1;
                const renameLocation = renameLocationOffset + ts.getRenameLocation(edits, renameFilename, fieldName.text, /*isDeclaredBeforeUse*/ false);
                return { renameFilename, renameLocation, edits };
            }
            function isConvertableName(name) {
                return ts.isIdentifier(name) || ts.isStringLiteral(name);
            }
            function isAcceptedDeclaration(node) {
                return ts.isParameterPropertyDeclaration(node) || ts.isPropertyDeclaration(node) || ts.isPropertyAssignment(node);
            }
            function createPropertyName(name, originalName) {
                return ts.isIdentifier(originalName) ? ts.createIdentifier(name) : ts.createLiteral(name);
            }
            function createAccessorAccessExpression(fieldName, isStatic, container) {
                const leftHead = isStatic ? container.name : ts.createThis();
                return ts.isIdentifier(fieldName) ? ts.createPropertyAccess(leftHead, fieldName) : ts.createElementAccess(leftHead, ts.createLiteral(fieldName));
            }
            function getModifiers(isJS, isStatic, accessModifier) {
                const modifiers = ts.append(!isJS ? [ts.createToken(accessModifier)] : undefined, isStatic ? ts.createToken(ts.SyntaxKind.StaticKeyword) : undefined);
                return modifiers && ts.createNodeArray(modifiers);
            }
            function getConvertibleFieldAtPosition(file, startPosition) {
                const node = ts.getTokenAtPosition(file, startPosition, /*includeJsDocComment*/ false);
                const declaration = ts.findAncestor(node.parent, isAcceptedDeclaration);
                // make sure propertyDeclaration have AccessibilityModifier or Static Modifier
                const meaning = ts.ModifierFlags.AccessibilityModifier | ts.ModifierFlags.Static;
                if (!declaration || !isConvertableName(declaration.name) || (ts.getModifierFlags(declaration) | meaning) !== meaning)
                    return undefined;
                const fieldName = createPropertyName(ts.getUniqueName(`_${declaration.name.text}`, file.text), declaration.name);
                const accessorName = createPropertyName(declaration.name.text, declaration.name);
                ts.suppressLeadingAndTrailingTrivia(fieldName);
                ts.suppressLeadingAndTrailingTrivia(declaration);
                return {
                    isStatic: ts.hasStaticModifier(declaration),
                    type: ts.getTypeAnnotationNode(declaration),
                    container: declaration.kind === ts.SyntaxKind.Parameter ? declaration.parent.parent : declaration.parent,
                    declaration,
                    fieldName,
                    accessorName,
                };
            }
            function generateGetAccessor(fieldName, accessorName, type, modifiers, isStatic, container) {
                return ts.createGetAccessor(
                /*decorators*/ undefined, modifiers, accessorName, 
                /*parameters*/ undefined, type, ts.createBlock([
                    ts.createReturn(createAccessorAccessExpression(fieldName, isStatic, container))
                ], /*multiLine*/ true));
            }
            function generateSetAccessor(fieldName, accessorName, type, modifiers, isStatic, container) {
                return ts.createSetAccessor(
                /*decorators*/ undefined, modifiers, accessorName, [ts.createParameter(
                    /*decorators*/ undefined, 
                    /*modifiers*/ undefined, 
                    /*dotDotDotToken*/ undefined, ts.createIdentifier("value"), 
                    /*questionToken*/ undefined, type)], ts.createBlock([
                    ts.createStatement(ts.createAssignment(createAccessorAccessExpression(fieldName, isStatic, container), ts.createIdentifier("value")))
                ], /*multiLine*/ true));
            }
            function updatePropertyDeclaration(changeTracker, file, declaration, fieldName, modifiers) {
                const property = ts.updateProperty(declaration, declaration.decorators, modifiers, fieldName, declaration.questionToken || declaration.exclamationToken, declaration.type, declaration.initializer);
                changeTracker.replaceNode(file, declaration, property);
            }
            function updateParameterPropertyDeclaration(changeTracker, file, declaration, fieldName, modifiers, classLikeContainer) {
                const property = ts.createProperty(declaration.decorators, modifiers, fieldName, declaration.questionToken, declaration.type, declaration.initializer);
                changeTracker.insertNodeAtClassStart(file, classLikeContainer, property);
                changeTracker.deleteNodeInList(file, declaration);
            }
            function updatePropertyAssignmentDeclaration(changeTracker, file, declaration, fieldName) {
                const assignment = ts.updatePropertyAssignment(declaration, fieldName, declaration.initializer);
                changeTracker.replacePropertyAssignment(file, declaration, assignment);
            }
            function updateFieldDeclaration(changeTracker, file, declaration, fieldName, modifiers, container) {
                if (ts.isPropertyDeclaration(declaration)) {
                    updatePropertyDeclaration(changeTracker, file, declaration, fieldName, modifiers);
                }
                else if (ts.isPropertyAssignment(declaration)) {
                    updatePropertyAssignmentDeclaration(changeTracker, file, declaration, fieldName);
                }
                else {
                    updateParameterPropertyDeclaration(changeTracker, file, declaration, fieldName, modifiers, container);
                }
            }
            function insertAccessor(changeTracker, file, accessor, declaration, container) {
                ts.isParameterPropertyDeclaration(declaration)
                    ? changeTracker.insertNodeAtClassStart(file, container, accessor)
                    : changeTracker.insertNodeAfter(file, declaration, accessor);
            }
        })(generateGetAccessorAndSetAccessor = refactor.generateGetAccessorAndSetAccessor || (refactor.generateGetAccessorAndSetAccessor = {}));
    })(refactor = ts.refactor || (ts.refactor = {}));
})(ts || (ts = {}));
