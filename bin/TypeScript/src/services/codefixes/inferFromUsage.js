/* @internal */
var ts;
(function (ts) {
    var codefix;
    (function (codefix) {
        const fixId = "inferFromUsage";
        const errorCodes = [
            // Variable declarations
            Diagnostics.Variable_0_implicitly_has_type_1_in_some_locations_where_its_type_cannot_be_determined.code,
            // Variable uses
            Diagnostics.Variable_0_implicitly_has_an_1_type.code,
            // Parameter declarations
            Diagnostics.Parameter_0_implicitly_has_an_1_type.code,
            Diagnostics.Rest_parameter_0_implicitly_has_an_any_type.code,
            // Get Accessor declarations
            Diagnostics.Property_0_implicitly_has_type_any_because_its_get_accessor_lacks_a_return_type_annotation.code,
            Diagnostics._0_which_lacks_return_type_annotation_implicitly_has_an_1_return_type.code,
            // Set Accessor declarations
            Diagnostics.Property_0_implicitly_has_type_any_because_its_set_accessor_lacks_a_parameter_type_annotation.code,
            // Property declarations
            Diagnostics.Member_0_implicitly_has_an_1_type.code,
        ];
        codefix.registerCodeFix({
            errorCodes,
            getCodeActions(context) {
                const { sourceFile, program, span: { start }, errorCode, cancellationToken } = context;
                if (ts.isSourceFileJavaScript(sourceFile)) {
                    return undefined; // TODO: GH#20113
                }
                const token = ts.getTokenAtPosition(sourceFile, start, /*includeJsDocComment*/ false);
                let declaration;
                const changes = ts.textChanges.ChangeTracker.with(context, changes => { declaration = doChange(changes, sourceFile, token, errorCode, program, cancellationToken); });
                return changes.length === 0 ? undefined
                    : [codefix.createCodeFixAction(fixId, changes, [getDiagnostic(errorCode, token), ts.getNameOfDeclaration(declaration).getText(sourceFile)], fixId, Diagnostics.Infer_all_types_from_usage)];
            },
            fixIds: [fixId],
            getAllCodeActions(context) {
                const { sourceFile, program, cancellationToken } = context;
                const seenFunctions = ts.createMap();
                return codefix.codeFixAll(context, errorCodes, (changes, err) => {
                    doChange(changes, sourceFile, ts.getTokenAtPosition(err.file, err.start, /*includeJsDocComment*/ false), err.code, program, cancellationToken, seenFunctions);
                });
            },
        });
        function getDiagnostic(errorCode, token) {
            switch (errorCode) {
                case Diagnostics.Parameter_0_implicitly_has_an_1_type.code:
                    return ts.isSetAccessor(ts.getContainingFunction(token)) ? Diagnostics.Infer_type_of_0_from_usage : Diagnostics.Infer_parameter_types_from_usage;
                case Diagnostics.Rest_parameter_0_implicitly_has_an_any_type.code:
                    return Diagnostics.Infer_parameter_types_from_usage;
                default:
                    return Diagnostics.Infer_type_of_0_from_usage;
            }
        }
        function doChange(changes, sourceFile, token, errorCode, program, cancellationToken, seenFunctions) {
            if (!ts.isParameterPropertyModifier(token.kind) && token.kind !== ts.SyntaxKind.Identifier && token.kind !== ts.SyntaxKind.DotDotDotToken) {
                return undefined;
            }
            const { parent } = token;
            switch (errorCode) {
                // Variable and Property declarations
                case Diagnostics.Member_0_implicitly_has_an_1_type.code:
                case Diagnostics.Variable_0_implicitly_has_type_1_in_some_locations_where_its_type_cannot_be_determined.code:
                    if (ts.isVariableDeclaration(parent) || ts.isPropertyDeclaration(parent) || ts.isPropertySignature(parent)) { // handle bad location
                        annotateVariableDeclaration(changes, sourceFile, parent, program, cancellationToken);
                        return parent;
                    }
                    return undefined;
                case Diagnostics.Variable_0_implicitly_has_an_1_type.code: {
                    const symbol = program.getTypeChecker().getSymbolAtLocation(token);
                    if (symbol && symbol.valueDeclaration && ts.isVariableDeclaration(symbol.valueDeclaration)) {
                        annotateVariableDeclaration(changes, sourceFile, symbol.valueDeclaration, program, cancellationToken);
                        return symbol.valueDeclaration;
                    }
                }
            }
            const containingFunction = ts.getContainingFunction(token);
            if (containingFunction === undefined) {
                return undefined;
            }
            switch (errorCode) {
                // Parameter declarations
                case Diagnostics.Parameter_0_implicitly_has_an_1_type.code:
                    if (ts.isSetAccessor(containingFunction)) {
                        annotateSetAccessor(changes, sourceFile, containingFunction, program, cancellationToken);
                        return containingFunction;
                    }
                // falls through
                case Diagnostics.Rest_parameter_0_implicitly_has_an_any_type.code:
                    if (!seenFunctions || ts.addToSeen(seenFunctions, ts.getNodeId(containingFunction))) {
                        const param = ts.cast(parent, ts.isParameter);
                        annotateParameters(changes, param, containingFunction, sourceFile, program, cancellationToken);
                        return param;
                    }
                    return undefined;
                // Get Accessor declarations
                case Diagnostics.Property_0_implicitly_has_type_any_because_its_get_accessor_lacks_a_return_type_annotation.code:
                case Diagnostics._0_which_lacks_return_type_annotation_implicitly_has_an_1_return_type.code:
                    if (ts.isGetAccessor(containingFunction) && ts.isIdentifier(containingFunction.name)) {
                        annotate(changes, sourceFile, containingFunction, inferTypeForVariableFromUsage(containingFunction.name, program, cancellationToken), program);
                        return containingFunction;
                    }
                    return undefined;
                // Set Accessor declarations
                case Diagnostics.Property_0_implicitly_has_type_any_because_its_set_accessor_lacks_a_parameter_type_annotation.code:
                    if (ts.isSetAccessor(containingFunction)) {
                        annotateSetAccessor(changes, sourceFile, containingFunction, program, cancellationToken);
                        return containingFunction;
                    }
                    return undefined;
                default:
                    return ts.Debug.fail(String(errorCode));
            }
        }
        function annotateVariableDeclaration(changes, sourceFile, declaration, program, cancellationToken) {
            if (ts.isIdentifier(declaration.name)) {
                annotate(changes, sourceFile, declaration, inferTypeForVariableFromUsage(declaration.name, program, cancellationToken), program);
            }
        }
        function isApplicableFunctionForInference(declaration) {
            switch (declaration.kind) {
                case ts.SyntaxKind.FunctionDeclaration:
                case ts.SyntaxKind.MethodDeclaration:
                case ts.SyntaxKind.Constructor:
                    return true;
                case ts.SyntaxKind.FunctionExpression:
                    return !!declaration.name;
            }
            return false;
        }
        function annotateParameters(changes, parameterDeclaration, containingFunction, sourceFile, program, cancellationToken) {
            if (!ts.isIdentifier(parameterDeclaration.name) || !isApplicableFunctionForInference(containingFunction)) {
                return;
            }
            const types = inferTypeForParametersFromUsage(containingFunction, sourceFile, program, cancellationToken) ||
                containingFunction.parameters.map(p => ts.isIdentifier(p.name) ? inferTypeForVariableFromUsage(p.name, program, cancellationToken) : undefined);
            // We didn't actually find a set of type inference positions matching each parameter position
            if (!types || containingFunction.parameters.length !== types.length) {
                return;
            }
            ts.zipWith(containingFunction.parameters, types, (parameter, type) => {
                if (!parameter.type && !parameter.initializer) {
                    annotate(changes, sourceFile, parameter, type, program);
                }
            });
        }
        function annotateSetAccessor(changes, sourceFile, setAccessorDeclaration, program, cancellationToken) {
            const param = ts.firstOrUndefined(setAccessorDeclaration.parameters);
            if (param && ts.isIdentifier(setAccessorDeclaration.name) && ts.isIdentifier(param.name)) {
                const type = inferTypeForVariableFromUsage(setAccessorDeclaration.name, program, cancellationToken) ||
                    inferTypeForVariableFromUsage(param.name, program, cancellationToken);
                annotate(changes, sourceFile, param, type, program);
            }
        }
        function annotate(changes, sourceFile, declaration, type, program) {
            const typeNode = type && getTypeNodeIfAccessible(type, declaration, program.getTypeChecker());
            if (typeNode)
                changes.tryInsertTypeAnnotation(sourceFile, declaration, typeNode);
        }
        function getTypeNodeIfAccessible(type, enclosingScope, checker) {
            let typeIsAccessible = true;
            const notAccessible = () => { typeIsAccessible = false; };
            const res = checker.typeToTypeNode(type, enclosingScope, /*flags*/ undefined, {
                trackSymbol: (symbol, declaration, meaning) => {
                    typeIsAccessible = typeIsAccessible && checker.isSymbolAccessible(symbol, declaration, meaning, /*shouldComputeAliasToMarkVisible*/ false).accessibility === 0 /* Accessible */;
                },
                reportInaccessibleThisError: notAccessible,
                reportPrivateInBaseOfClassExpression: notAccessible,
                reportInaccessibleUniqueSymbolError: notAccessible,
            });
            return typeIsAccessible ? res : undefined;
        }
        function getReferences(token, program, cancellationToken) {
            // Position shouldn't matter since token is not a SourceFile.
            return ts.mapDefined(ts.FindAllReferences.getReferenceEntriesForNode(-1, token, program, program.getSourceFiles(), cancellationToken), entry => entry.type === "node" ? ts.tryCast(entry.node, ts.isIdentifier) : undefined);
        }
        function inferTypeForVariableFromUsage(token, program, cancellationToken) {
            return InferFromReference.inferTypeFromReferences(getReferences(token, program, cancellationToken), program.getTypeChecker(), cancellationToken);
        }
        function inferTypeForParametersFromUsage(containingFunction, sourceFile, program, cancellationToken) {
            switch (containingFunction.kind) {
                case ts.SyntaxKind.Constructor:
                case ts.SyntaxKind.FunctionExpression:
                case ts.SyntaxKind.FunctionDeclaration:
                case ts.SyntaxKind.MethodDeclaration:
                    const isConstructor = containingFunction.kind === ts.SyntaxKind.Constructor;
                    const searchToken = isConstructor ?
                        ts.findChildOfKind(containingFunction, ts.SyntaxKind.ConstructorKeyword, sourceFile) :
                        containingFunction.name;
                    if (searchToken) {
                        return InferFromReference.inferTypeForParametersFromReferences(getReferences(searchToken, program, cancellationToken), containingFunction, program.getTypeChecker(), cancellationToken);
                    }
            }
        }
        let InferFromReference;
        (function (InferFromReference) {
            function inferTypeFromReferences(references, checker, cancellationToken) {
                const usageContext = {};
                for (const reference of references) {
                    cancellationToken.throwIfCancellationRequested();
                    inferTypeFromContext(reference, checker, usageContext);
                }
                return getTypeFromUsageContext(usageContext, checker);
            }
            InferFromReference.inferTypeFromReferences = inferTypeFromReferences;
            function inferTypeForParametersFromReferences(references, declaration, checker, cancellationToken) {
                if (references.length === 0) {
                    return undefined;
                }
                if (!declaration.parameters) {
                    return undefined;
                }
                const usageContext = {};
                for (const reference of references) {
                    cancellationToken.throwIfCancellationRequested();
                    inferTypeFromContext(reference, checker, usageContext);
                }
                const isConstructor = declaration.kind === ts.SyntaxKind.Constructor;
                const callContexts = isConstructor ? usageContext.constructContexts : usageContext.callContexts;
                return callContexts && declaration.parameters.map((parameter, parameterIndex) => {
                    const types = [];
                    const isRest = ts.isRestParameter(parameter);
                    for (const callContext of callContexts) {
                        if (callContext.argumentTypes.length <= parameterIndex) {
                            continue;
                        }
                        if (isRest) {
                            for (let i = parameterIndex; i < callContext.argumentTypes.length; i++) {
                                types.push(checker.getBaseTypeOfLiteralType(callContext.argumentTypes[i]));
                            }
                        }
                        else {
                            types.push(checker.getBaseTypeOfLiteralType(callContext.argumentTypes[parameterIndex]));
                        }
                    }
                    if (!types.length) {
                        return undefined;
                    }
                    const type = checker.getWidenedType(checker.getUnionType(types, 2 /* Subtype */));
                    return isRest ? checker.createArrayType(type) : type;
                });
            }
            InferFromReference.inferTypeForParametersFromReferences = inferTypeForParametersFromReferences;
            function inferTypeFromContext(node, checker, usageContext) {
                while (ts.isRightSideOfQualifiedNameOrPropertyAccess(node)) {
                    node = node.parent;
                }
                switch (node.parent.kind) {
                    case ts.SyntaxKind.PostfixUnaryExpression:
                        usageContext.isNumber = true;
                        break;
                    case ts.SyntaxKind.PrefixUnaryExpression:
                        inferTypeFromPrefixUnaryExpressionContext(node.parent, usageContext);
                        break;
                    case ts.SyntaxKind.BinaryExpression:
                        inferTypeFromBinaryExpressionContext(node, node.parent, checker, usageContext);
                        break;
                    case ts.SyntaxKind.CaseClause:
                    case ts.SyntaxKind.DefaultClause:
                        inferTypeFromSwitchStatementLabelContext(node.parent, checker, usageContext);
                        break;
                    case ts.SyntaxKind.CallExpression:
                    case ts.SyntaxKind.NewExpression:
                        if (node.parent.expression === node) {
                            inferTypeFromCallExpressionContext(node.parent, checker, usageContext);
                        }
                        else {
                            inferTypeFromContextualType(node, checker, usageContext);
                        }
                        break;
                    case ts.SyntaxKind.PropertyAccessExpression:
                        inferTypeFromPropertyAccessExpressionContext(node.parent, checker, usageContext);
                        break;
                    case ts.SyntaxKind.ElementAccessExpression:
                        inferTypeFromPropertyElementExpressionContext(node.parent, node, checker, usageContext);
                        break;
                    default:
                        return inferTypeFromContextualType(node, checker, usageContext);
                }
            }
            function inferTypeFromContextualType(node, checker, usageContext) {
                if (ts.isExpressionNode(node)) {
                    addCandidateType(usageContext, checker.getContextualType(node));
                }
            }
            function inferTypeFromPrefixUnaryExpressionContext(node, usageContext) {
                switch (node.operator) {
                    case ts.SyntaxKind.PlusPlusToken:
                    case ts.SyntaxKind.MinusMinusToken:
                    case ts.SyntaxKind.MinusToken:
                    case ts.SyntaxKind.TildeToken:
                        usageContext.isNumber = true;
                        break;
                    case ts.SyntaxKind.PlusToken:
                        usageContext.isNumberOrString = true;
                        break;
                    // case SyntaxKind.ExclamationToken:
                    // no inferences here;
                }
            }
            function inferTypeFromBinaryExpressionContext(node, parent, checker, usageContext) {
                switch (parent.operatorToken.kind) {
                    // ExponentiationOperator
                    case ts.SyntaxKind.AsteriskAsteriskToken:
                    // MultiplicativeOperator
                    case ts.SyntaxKind.AsteriskToken:
                    case ts.SyntaxKind.SlashToken:
                    case ts.SyntaxKind.PercentToken:
                    // ShiftOperator
                    case ts.SyntaxKind.LessThanLessThanToken:
                    case ts.SyntaxKind.GreaterThanGreaterThanToken:
                    case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
                    // BitwiseOperator
                    case ts.SyntaxKind.AmpersandToken:
                    case ts.SyntaxKind.BarToken:
                    case ts.SyntaxKind.CaretToken:
                    // CompoundAssignmentOperator
                    case ts.SyntaxKind.MinusEqualsToken:
                    case ts.SyntaxKind.AsteriskAsteriskEqualsToken:
                    case ts.SyntaxKind.AsteriskEqualsToken:
                    case ts.SyntaxKind.SlashEqualsToken:
                    case ts.SyntaxKind.PercentEqualsToken:
                    case ts.SyntaxKind.AmpersandEqualsToken:
                    case ts.SyntaxKind.BarEqualsToken:
                    case ts.SyntaxKind.CaretEqualsToken:
                    case ts.SyntaxKind.LessThanLessThanEqualsToken:
                    case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken:
                    case ts.SyntaxKind.GreaterThanGreaterThanEqualsToken:
                    // AdditiveOperator
                    case ts.SyntaxKind.MinusToken:
                    // RelationalOperator
                    case ts.SyntaxKind.LessThanToken:
                    case ts.SyntaxKind.LessThanEqualsToken:
                    case ts.SyntaxKind.GreaterThanToken:
                    case ts.SyntaxKind.GreaterThanEqualsToken:
                        const operandType = checker.getTypeAtLocation(parent.left === node ? parent.right : parent.left);
                        if (operandType.flags & ts.TypeFlags.EnumLike) {
                            addCandidateType(usageContext, operandType);
                        }
                        else {
                            usageContext.isNumber = true;
                        }
                        break;
                    case ts.SyntaxKind.PlusEqualsToken:
                    case ts.SyntaxKind.PlusToken:
                        const otherOperandType = checker.getTypeAtLocation(parent.left === node ? parent.right : parent.left);
                        if (otherOperandType.flags & ts.TypeFlags.EnumLike) {
                            addCandidateType(usageContext, otherOperandType);
                        }
                        else if (otherOperandType.flags & ts.TypeFlags.NumberLike) {
                            usageContext.isNumber = true;
                        }
                        else if (otherOperandType.flags & ts.TypeFlags.StringLike) {
                            usageContext.isString = true;
                        }
                        else {
                            usageContext.isNumberOrString = true;
                        }
                        break;
                    //  AssignmentOperators
                    case ts.SyntaxKind.EqualsToken:
                    case ts.SyntaxKind.EqualsEqualsToken:
                    case ts.SyntaxKind.EqualsEqualsEqualsToken:
                    case ts.SyntaxKind.ExclamationEqualsEqualsToken:
                    case ts.SyntaxKind.ExclamationEqualsToken:
                        addCandidateType(usageContext, checker.getTypeAtLocation(parent.left === node ? parent.right : parent.left));
                        break;
                    case ts.SyntaxKind.InKeyword:
                        if (node === parent.left) {
                            usageContext.isString = true;
                        }
                        break;
                    // LogicalOperator
                    case ts.SyntaxKind.BarBarToken:
                        if (node === parent.left &&
                            (node.parent.parent.kind === ts.SyntaxKind.VariableDeclaration || ts.isAssignmentExpression(node.parent.parent, /*excludeCompoundAssignment*/ true))) {
                            // var x = x || {};
                            // TODO: use getFalsyflagsOfType
                            addCandidateType(usageContext, checker.getTypeAtLocation(parent.right));
                        }
                        break;
                    case ts.SyntaxKind.AmpersandAmpersandToken:
                    case ts.SyntaxKind.CommaToken:
                    case ts.SyntaxKind.InstanceOfKeyword:
                        // nothing to infer here
                        break;
                }
            }
            function inferTypeFromSwitchStatementLabelContext(parent, checker, usageContext) {
                addCandidateType(usageContext, checker.getTypeAtLocation(parent.parent.parent.expression));
            }
            function inferTypeFromCallExpressionContext(parent, checker, usageContext) {
                const callContext = {
                    argumentTypes: [],
                    returnType: {}
                };
                if (parent.arguments) {
                    for (const argument of parent.arguments) {
                        callContext.argumentTypes.push(checker.getTypeAtLocation(argument));
                    }
                }
                inferTypeFromContext(parent, checker, callContext.returnType);
                if (parent.kind === ts.SyntaxKind.CallExpression) {
                    (usageContext.callContexts || (usageContext.callContexts = [])).push(callContext);
                }
                else {
                    (usageContext.constructContexts || (usageContext.constructContexts = [])).push(callContext);
                }
            }
            function inferTypeFromPropertyAccessExpressionContext(parent, checker, usageContext) {
                const name = ts.escapeLeadingUnderscores(parent.name.text);
                if (!usageContext.properties) {
                    usageContext.properties = ts.createUnderscoreEscapedMap();
                }
                const propertyUsageContext = usageContext.properties.get(name) || {};
                inferTypeFromContext(parent, checker, propertyUsageContext);
                usageContext.properties.set(name, propertyUsageContext);
            }
            function inferTypeFromPropertyElementExpressionContext(parent, node, checker, usageContext) {
                if (node === parent.argumentExpression) {
                    usageContext.isNumberOrString = true;
                    return;
                }
                else {
                    const indexType = checker.getTypeAtLocation(parent);
                    const indexUsageContext = {};
                    inferTypeFromContext(parent, checker, indexUsageContext);
                    if (indexType.flags & ts.TypeFlags.NumberLike) {
                        usageContext.numberIndexContext = indexUsageContext;
                    }
                    else {
                        usageContext.stringIndexContext = indexUsageContext;
                    }
                }
            }
            function getTypeFromUsageContext(usageContext, checker) {
                if (usageContext.isNumberOrString && !usageContext.isNumber && !usageContext.isString) {
                    return checker.getUnionType([checker.getNumberType(), checker.getStringType()]);
                }
                else if (usageContext.isNumber) {
                    return checker.getNumberType();
                }
                else if (usageContext.isString) {
                    return checker.getStringType();
                }
                else if (usageContext.candidateTypes) {
                    return checker.getWidenedType(checker.getUnionType(ts.map(usageContext.candidateTypes, t => checker.getBaseTypeOfLiteralType(t)), 2 /* Subtype */));
                }
                else if (usageContext.properties && hasCallContext(usageContext.properties.get("then"))) {
                    const paramType = getParameterTypeFromCallContexts(0, usageContext.properties.get("then").callContexts, /*isRestParameter*/ false, checker);
                    const types = paramType.getCallSignatures().map(c => c.getReturnType());
                    return checker.createPromiseType(types.length ? checker.getUnionType(types, 2 /* Subtype */) : checker.getAnyType());
                }
                else if (usageContext.properties && hasCallContext(usageContext.properties.get("push"))) {
                    return checker.createArrayType(getParameterTypeFromCallContexts(0, usageContext.properties.get("push").callContexts, /*isRestParameter*/ false, checker));
                }
                else if (usageContext.properties || usageContext.callContexts || usageContext.constructContexts || usageContext.numberIndexContext || usageContext.stringIndexContext) {
                    const members = ts.createUnderscoreEscapedMap();
                    const callSignatures = [];
                    const constructSignatures = [];
                    let stringIndexInfo;
                    let numberIndexInfo;
                    if (usageContext.properties) {
                        usageContext.properties.forEach((context, name) => {
                            const symbol = checker.createSymbol(ts.SymbolFlags.Property, name);
                            symbol.type = getTypeFromUsageContext(context, checker) || checker.getAnyType();
                            members.set(name, symbol);
                        });
                    }
                    if (usageContext.callContexts) {
                        for (const callContext of usageContext.callContexts) {
                            callSignatures.push(getSignatureFromCallContext(callContext, checker));
                        }
                    }
                    if (usageContext.constructContexts) {
                        for (const constructContext of usageContext.constructContexts) {
                            constructSignatures.push(getSignatureFromCallContext(constructContext, checker));
                        }
                    }
                    if (usageContext.numberIndexContext) {
                        numberIndexInfo = checker.createIndexInfo(getTypeFromUsageContext(usageContext.numberIndexContext, checker), /*isReadonly*/ false);
                    }
                    if (usageContext.stringIndexContext) {
                        stringIndexInfo = checker.createIndexInfo(getTypeFromUsageContext(usageContext.stringIndexContext, checker), /*isReadonly*/ false);
                    }
                    return checker.createAnonymousType(/*symbol*/ undefined, members, callSignatures, constructSignatures, stringIndexInfo, numberIndexInfo);
                }
                else {
                    return undefined;
                }
            }
            function getParameterTypeFromCallContexts(parameterIndex, callContexts, isRestParameter, checker) {
                let types = [];
                if (callContexts) {
                    for (const callContext of callContexts) {
                        if (callContext.argumentTypes.length > parameterIndex) {
                            if (isRestParameter) {
                                types = ts.concatenate(types, ts.map(callContext.argumentTypes.slice(parameterIndex), a => checker.getBaseTypeOfLiteralType(a)));
                            }
                            else {
                                types.push(checker.getBaseTypeOfLiteralType(callContext.argumentTypes[parameterIndex]));
                            }
                        }
                    }
                }
                if (types.length) {
                    const type = checker.getWidenedType(checker.getUnionType(types, 2 /* Subtype */));
                    return isRestParameter ? checker.createArrayType(type) : type;
                }
                return undefined;
            }
            function getSignatureFromCallContext(callContext, checker) {
                const parameters = [];
                for (let i = 0; i < callContext.argumentTypes.length; i++) {
                    const symbol = checker.createSymbol(ts.SymbolFlags.FunctionScopedVariable, ts.escapeLeadingUnderscores(`arg${i}`));
                    symbol.type = checker.getWidenedType(checker.getBaseTypeOfLiteralType(callContext.argumentTypes[i]));
                    parameters.push(symbol);
                }
                const returnType = getTypeFromUsageContext(callContext.returnType, checker) || checker.getVoidType();
                return checker.createSignature(/*declaration*/ undefined, /*typeParameters*/ undefined, /*thisParameter*/ undefined, parameters, returnType, /*typePredicate*/ undefined, callContext.argumentTypes.length, /*hasRestParameter*/ false, /*hasLiteralTypes*/ false);
            }
            function addCandidateType(context, type) {
                if (type && !(type.flags & ts.TypeFlags.Any) && !(type.flags & ts.TypeFlags.Never)) {
                    (context.candidateTypes || (context.candidateTypes = [])).push(type);
                }
            }
            function hasCallContext(usageContext) {
                return usageContext && usageContext.callContexts;
            }
        })(InferFromReference || (InferFromReference = {}));
    })(codefix = ts.codefix || (ts.codefix = {}));
})(ts || (ts = {}));
