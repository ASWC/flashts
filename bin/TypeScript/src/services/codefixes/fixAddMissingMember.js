/* @internal */
var ts;
(function (ts) {
    var codefix;
    (function (codefix) {
        const fixName = "addMissingMember";
        const errorCodes = [
            Diagnostics.Property_0_does_not_exist_on_type_1.code,
            Diagnostics.Property_0_does_not_exist_on_type_1_Did_you_mean_2.code,
        ];
        const fixId = "addMissingMember";
        codefix.registerCodeFix({
            errorCodes,
            getCodeActions(context) {
                const info = getInfo(context.sourceFile, context.span.start, context.program.getTypeChecker());
                if (!info)
                    return undefined;
                const { classDeclaration, classDeclarationSourceFile, inJs, makeStatic, token, call } = info;
                const methodCodeAction = call && getActionForMethodDeclaration(context, classDeclarationSourceFile, classDeclaration, token, call, makeStatic, inJs, context.preferences);
                const addMember = inJs ?
                    ts.singleElementArray(getActionsForAddMissingMemberInJavaScriptFile(context, classDeclarationSourceFile, classDeclaration, token.text, makeStatic)) :
                    getActionsForAddMissingMemberInTypeScriptFile(context, classDeclarationSourceFile, classDeclaration, token, makeStatic);
                return ts.concatenate(ts.singleElementArray(methodCodeAction), addMember);
            },
            fixIds: [fixId],
            getAllCodeActions: context => {
                const seenNames = ts.createMap();
                return codefix.codeFixAll(context, errorCodes, (changes, diag) => {
                    const { program, preferences } = context;
                    const info = getInfo(diag.file, diag.start, program.getTypeChecker());
                    if (!info)
                        return;
                    const { classDeclaration, classDeclarationSourceFile, inJs, makeStatic, token, call } = info;
                    if (!ts.addToSeen(seenNames, token.text)) {
                        return;
                    }
                    // Always prefer to add a method declaration if possible.
                    if (call) {
                        addMethodDeclaration(changes, classDeclarationSourceFile, classDeclaration, token, call, makeStatic, inJs, preferences);
                    }
                    else {
                        if (inJs) {
                            addMissingMemberInJs(changes, classDeclarationSourceFile, classDeclaration, token.text, makeStatic);
                        }
                        else {
                            const typeNode = getTypeNode(program.getTypeChecker(), classDeclaration, token);
                            addPropertyDeclaration(changes, classDeclarationSourceFile, classDeclaration, token.text, typeNode, makeStatic);
                        }
                    }
                });
            },
        });
        function getInfo(tokenSourceFile, tokenPos, checker) {
            // The identifier of the missing property. eg:
            // this.missing = 1;
            //      ^^^^^^^
            const token = ts.getTokenAtPosition(tokenSourceFile, tokenPos, /*includeJsDocComment*/ false);
            if (!ts.isIdentifier(token)) {
                return undefined;
            }
            const { parent } = token;
            if (!ts.isPropertyAccessExpression(parent))
                return undefined;
            const leftExpressionType = ts.skipConstraint(checker.getTypeAtLocation(parent.expression));
            const { symbol } = leftExpressionType;
            const classDeclaration = symbol && symbol.declarations && ts.find(symbol.declarations, ts.isClassLike);
            if (!classDeclaration)
                return undefined;
            const makeStatic = leftExpressionType.target !== checker.getDeclaredTypeOfSymbol(symbol);
            const classDeclarationSourceFile = classDeclaration.getSourceFile();
            const inJs = ts.isSourceFileJavaScript(classDeclarationSourceFile);
            const call = ts.tryCast(parent.parent, ts.isCallExpression);
            return { token, classDeclaration, makeStatic, classDeclarationSourceFile, inJs, call };
        }
        function getActionsForAddMissingMemberInJavaScriptFile(context, classDeclarationSourceFile, classDeclaration, tokenName, makeStatic) {
            const changes = ts.textChanges.ChangeTracker.with(context, t => addMissingMemberInJs(t, classDeclarationSourceFile, classDeclaration, tokenName, makeStatic));
            return changes.length === 0 ? undefined
                : codefix.createCodeFixAction(fixName, changes, [makeStatic ? Diagnostics.Initialize_static_property_0 : Diagnostics.Initialize_property_0_in_the_constructor, tokenName], fixId, Diagnostics.Add_all_missing_members);
        }
        function addMissingMemberInJs(changeTracker, classDeclarationSourceFile, classDeclaration, tokenName, makeStatic) {
            if (makeStatic) {
                if (classDeclaration.kind === ts.SyntaxKind.ClassExpression) {
                    return;
                }
                const className = classDeclaration.name.getText();
                const staticInitialization = initializePropertyToUndefined(ts.createIdentifier(className), tokenName);
                changeTracker.insertNodeAfter(classDeclarationSourceFile, classDeclaration, staticInitialization);
            }
            else {
                const classConstructor = ts.getFirstConstructorWithBody(classDeclaration);
                if (!classConstructor) {
                    return;
                }
                const propertyInitialization = initializePropertyToUndefined(ts.createThis(), tokenName);
                changeTracker.insertNodeAtConstructorEnd(classDeclarationSourceFile, classConstructor, propertyInitialization);
            }
        }
        function initializePropertyToUndefined(obj, propertyName) {
            return ts.createStatement(ts.createAssignment(ts.createPropertyAccess(obj, propertyName), ts.createIdentifier("undefined")));
        }
        function getActionsForAddMissingMemberInTypeScriptFile(context, classDeclarationSourceFile, classDeclaration, token, makeStatic) {
            const typeNode = getTypeNode(context.program.getTypeChecker(), classDeclaration, token);
            const addProp = createAddPropertyDeclarationAction(context, classDeclarationSourceFile, classDeclaration, makeStatic, token.text, typeNode);
            return makeStatic ? [addProp] : [addProp, createAddIndexSignatureAction(context, classDeclarationSourceFile, classDeclaration, token.text, typeNode)];
        }
        function getTypeNode(checker, classDeclaration, token) {
            let typeNode;
            if (token.parent.parent.kind === ts.SyntaxKind.BinaryExpression) {
                const binaryExpression = token.parent.parent;
                const otherExpression = token.parent === binaryExpression.left ? binaryExpression.right : binaryExpression.left;
                const widenedType = checker.getWidenedType(checker.getBaseTypeOfLiteralType(checker.getTypeAtLocation(otherExpression)));
                typeNode = checker.typeToTypeNode(widenedType, classDeclaration);
            }
            return typeNode || ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
        }
        function createAddPropertyDeclarationAction(context, classDeclarationSourceFile, classDeclaration, makeStatic, tokenName, typeNode) {
            const changes = ts.textChanges.ChangeTracker.with(context, t => addPropertyDeclaration(t, classDeclarationSourceFile, classDeclaration, tokenName, typeNode, makeStatic));
            return codefix.createCodeFixAction(fixName, changes, [makeStatic ? Diagnostics.Declare_static_property_0 : Diagnostics.Declare_property_0, tokenName], fixId, Diagnostics.Add_all_missing_members);
        }
        function addPropertyDeclaration(changeTracker, classDeclarationSourceFile, classDeclaration, tokenName, typeNode, makeStatic) {
            const property = ts.createProperty(
            /*decorators*/ undefined, 
            /*modifiers*/ makeStatic ? [ts.createToken(ts.SyntaxKind.StaticKeyword)] : undefined, tokenName, 
            /*questionToken*/ undefined, typeNode, 
            /*initializer*/ undefined);
            changeTracker.insertNodeAtClassStart(classDeclarationSourceFile, classDeclaration, property);
        }
        function createAddIndexSignatureAction(context, classDeclarationSourceFile, classDeclaration, tokenName, typeNode) {
            // Index signatures cannot have the static modifier.
            const stringTypeNode = ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
            const indexingParameter = ts.createParameter(
            /*decorators*/ undefined, 
            /*modifiers*/ undefined, 
            /*dotDotDotToken*/ undefined, "x", 
            /*questionToken*/ undefined, stringTypeNode, 
            /*initializer*/ undefined);
            const indexSignature = ts.createIndexSignature(
            /*decorators*/ undefined, 
            /*modifiers*/ undefined, [indexingParameter], typeNode);
            const changes = ts.textChanges.ChangeTracker.with(context, t => t.insertNodeAtClassStart(classDeclarationSourceFile, classDeclaration, indexSignature));
            // No fixId here because code-fix-all currently only works on adding individual named properties.
            return codefix.createCodeFixActionNoFixId(fixName, changes, [Diagnostics.Add_index_signature_for_property_0, tokenName]);
        }
        function getActionForMethodDeclaration(context, classDeclarationSourceFile, classDeclaration, token, callExpression, makeStatic, inJs, preferences) {
            const changes = ts.textChanges.ChangeTracker.with(context, t => addMethodDeclaration(t, classDeclarationSourceFile, classDeclaration, token, callExpression, makeStatic, inJs, preferences));
            return codefix.createCodeFixAction(fixName, changes, [makeStatic ? Diagnostics.Declare_static_method_0 : Diagnostics.Declare_method_0, token.text], fixId, Diagnostics.Add_all_missing_members);
        }
        function addMethodDeclaration(changeTracker, classDeclarationSourceFile, classDeclaration, token, callExpression, makeStatic, inJs, preferences) {
            const methodDeclaration = codefix.createMethodFromCallExpression(callExpression, token.text, inJs, makeStatic, preferences);
            changeTracker.insertNodeAtClassStart(classDeclarationSourceFile, classDeclaration, methodDeclaration);
        }
    })(codefix = ts.codefix || (ts.codefix = {}));
})(ts || (ts = {}));
