var ts;
(function (ts) {
    const isTypeNodeOrTypeParameterDeclaration = ts.or(ts.isTypeNode, ts.isTypeParameterDeclaration);
    function visitNode(node, visitor, test, lift) {
        if (node === undefined || visitor === undefined) {
            return node;
        }
        ts.aggregateTransformFlags(node);
        const visited = visitor(node);
        if (visited === node) {
            return node;
        }
        let visitedNode;
        if (visited === undefined) {
            return undefined;
        }
        else if (ts.isArray(visited)) {
            visitedNode = (lift || extractSingleNode)(visited);
        }
        else {
            visitedNode = visited;
        }
        ts.Debug.assertNode(visitedNode, test);
        ts.aggregateTransformFlags(visitedNode);
        return visitedNode;
    }
    ts.visitNode = visitNode;
    /**
     * Visits a NodeArray using the supplied visitor, possibly returning a new NodeArray in its place.
     *
     * @param nodes The NodeArray to visit.
     * @param visitor The callback used to visit a Node.
     * @param test A node test to execute for each node.
     * @param start An optional value indicating the starting offset at which to start visiting.
     * @param count An optional value indicating the maximum number of nodes to visit.
     */
    function visitNodes(nodes, visitor, test, start, count) {
        if (nodes === undefined || visitor === undefined) {
            return nodes;
        }
        let updated;
        // Ensure start and count have valid values
        const length = nodes.length;
        if (start === undefined || start < 0) {
            start = 0;
        }
        if (count === undefined || count > length - start) {
            count = length - start;
        }
        if (start > 0 || count < length) {
            // If we are not visiting all of the original nodes, we must always create a new array.
            // Since this is a fragment of a node array, we do not copy over the previous location
            // and will only copy over `hasTrailingComma` if we are including the last element.
            updated = ts.createNodeArray([], /*hasTrailingComma*/ nodes.hasTrailingComma && start + count === length);
        }
        // Visit each original node.
        for (let i = 0; i < count; i++) {
            const node = nodes[i + start];
            ts.aggregateTransformFlags(node);
            const visited = node !== undefined ? visitor(node) : undefined;
            if (updated !== undefined || visited === undefined || visited !== node) {
                if (updated === undefined) {
                    // Ensure we have a copy of `nodes`, up to the current index.
                    updated = ts.createNodeArray(nodes.slice(0, i), nodes.hasTrailingComma);
                    ts.setTextRange(updated, nodes);
                }
                if (visited) {
                    if (ts.isArray(visited)) {
                        for (const visitedNode of visited) {
                            ts.Debug.assertNode(visitedNode, test);
                            ts.aggregateTransformFlags(visitedNode);
                            updated.push(visitedNode);
                        }
                    }
                    else {
                        ts.Debug.assertNode(visited, test);
                        ts.aggregateTransformFlags(visited);
                        updated.push(visited);
                    }
                }
            }
        }
        return updated || nodes;
    }
    ts.visitNodes = visitNodes;
    /**
     * Starts a new lexical environment and visits a statement list, ending the lexical environment
     * and merging hoisted declarations upon completion.
     */
    function visitLexicalEnvironment(statements, visitor, context, start, ensureUseStrict) {
        context.startLexicalEnvironment();
        statements = visitNodes(statements, visitor, ts.isStatement, start);
        if (ensureUseStrict && !ts.startsWithUseStrict(statements)) {
            statements = ts.setTextRange(ts.createNodeArray([ts.createStatement(ts.createLiteral("use strict")), ...statements]), statements);
        }
        const declarations = context.endLexicalEnvironment();
        return ts.setTextRange(ts.createNodeArray(ts.concatenate(statements, declarations)), statements);
    }
    ts.visitLexicalEnvironment = visitLexicalEnvironment;
    /**
     * Starts a new lexical environment and visits a parameter list, suspending the lexical
     * environment upon completion.
     */
    function visitParameterList(nodes, visitor, context, nodesVisitor = visitNodes) {
        context.startLexicalEnvironment();
        const updated = nodesVisitor(nodes, visitor, ts.isParameterDeclaration);
        context.suspendLexicalEnvironment();
        return updated;
    }
    ts.visitParameterList = visitParameterList;
    function visitFunctionBody(node, visitor, context) {
        context.resumeLexicalEnvironment();
        const updated = visitNode(node, visitor, ts.isConciseBody);
        const declarations = context.endLexicalEnvironment();
        if (ts.some(declarations)) {
            const block = ts.convertToFunctionBody(updated);
            const statements = ts.mergeLexicalEnvironment(block.statements, declarations);
            return ts.updateBlock(block, statements);
        }
        return updated;
    }
    ts.visitFunctionBody = visitFunctionBody;
    function visitEachChild(node, visitor, context, nodesVisitor = visitNodes, tokenVisitor) {
        if (node === undefined) {
            return undefined;
        }
        const kind = node.kind;
        // No need to visit nodes with no children.
        if ((kind > ts.SyntaxKind.FirstToken && kind <= ts.SyntaxKind.LastToken) || kind === ts.SyntaxKind.ThisType) {
            return node;
        }
        switch (kind) {
            // Names
            case ts.SyntaxKind.Identifier:
                return ts.updateIdentifier(node, nodesVisitor(node.typeArguments, visitor, isTypeNodeOrTypeParameterDeclaration));
            case ts.SyntaxKind.QualifiedName:
                return ts.updateQualifiedName(node, visitNode(node.left, visitor, ts.isEntityName), visitNode(node.right, visitor, ts.isIdentifier));
            case ts.SyntaxKind.ComputedPropertyName:
                return ts.updateComputedPropertyName(node, visitNode(node.expression, visitor, ts.isExpression));
            // Signature elements
            case ts.SyntaxKind.TypeParameter:
                return ts.updateTypeParameterDeclaration(node, visitNode(node.name, visitor, ts.isIdentifier), visitNode(node.constraint, visitor, ts.isTypeNode), visitNode(node.default, visitor, ts.isTypeNode));
            case ts.SyntaxKind.Parameter:
                return ts.updateParameter(node, nodesVisitor(node.decorators, visitor, ts.isDecorator), nodesVisitor(node.modifiers, visitor, ts.isModifier), visitNode(node.dotDotDotToken, tokenVisitor, ts.isToken), visitNode(node.name, visitor, ts.isBindingName), visitNode(node.questionToken, tokenVisitor, ts.isToken), visitNode(node.type, visitor, ts.isTypeNode), visitNode(node.initializer, visitor, ts.isExpression));
            case ts.SyntaxKind.Decorator:
                return ts.updateDecorator(node, visitNode(node.expression, visitor, ts.isExpression));
            // Type elements
            case ts.SyntaxKind.PropertySignature:
                return ts.updatePropertySignature(node, nodesVisitor(node.modifiers, visitor, ts.isToken), visitNode(node.name, visitor, ts.isPropertyName), visitNode(node.questionToken, tokenVisitor, ts.isToken), visitNode(node.type, visitor, ts.isTypeNode), visitNode(node.initializer, visitor, ts.isExpression));
            case ts.SyntaxKind.PropertyDeclaration:
                return ts.updateProperty(node, nodesVisitor(node.decorators, visitor, ts.isDecorator), nodesVisitor(node.modifiers, visitor, ts.isModifier), visitNode(node.name, visitor, ts.isPropertyName), visitNode(node.questionToken, tokenVisitor, ts.isToken), visitNode(node.type, visitor, ts.isTypeNode), visitNode(node.initializer, visitor, ts.isExpression));
            case ts.SyntaxKind.MethodSignature:
                return ts.updateMethodSignature(node, nodesVisitor(node.typeParameters, visitor, ts.isTypeParameterDeclaration), nodesVisitor(node.parameters, visitor, ts.isParameterDeclaration), visitNode(node.type, visitor, ts.isTypeNode), visitNode(node.name, visitor, ts.isPropertyName), visitNode(node.questionToken, tokenVisitor, ts.isToken));
            case ts.SyntaxKind.MethodDeclaration:
                return ts.updateMethod(node, nodesVisitor(node.decorators, visitor, ts.isDecorator), nodesVisitor(node.modifiers, visitor, ts.isModifier), visitNode(node.asteriskToken, tokenVisitor, ts.isToken), visitNode(node.name, visitor, ts.isPropertyName), visitNode(node.questionToken, tokenVisitor, ts.isToken), nodesVisitor(node.typeParameters, visitor, ts.isTypeParameterDeclaration), visitParameterList(node.parameters, visitor, context, nodesVisitor), visitNode(node.type, visitor, ts.isTypeNode), visitFunctionBody(node.body, visitor, context));
            case ts.SyntaxKind.Constructor:
                return ts.updateConstructor(node, nodesVisitor(node.decorators, visitor, ts.isDecorator), nodesVisitor(node.modifiers, visitor, ts.isModifier), visitParameterList(node.parameters, visitor, context, nodesVisitor), visitFunctionBody(node.body, visitor, context));
            case ts.SyntaxKind.GetAccessor:
                return ts.updateGetAccessor(node, nodesVisitor(node.decorators, visitor, ts.isDecorator), nodesVisitor(node.modifiers, visitor, ts.isModifier), visitNode(node.name, visitor, ts.isPropertyName), visitParameterList(node.parameters, visitor, context, nodesVisitor), visitNode(node.type, visitor, ts.isTypeNode), visitFunctionBody(node.body, visitor, context));
            case ts.SyntaxKind.SetAccessor:
                return ts.updateSetAccessor(node, nodesVisitor(node.decorators, visitor, ts.isDecorator), nodesVisitor(node.modifiers, visitor, ts.isModifier), visitNode(node.name, visitor, ts.isPropertyName), visitParameterList(node.parameters, visitor, context, nodesVisitor), visitFunctionBody(node.body, visitor, context));
            case ts.SyntaxKind.CallSignature:
                return ts.updateCallSignature(node, nodesVisitor(node.typeParameters, visitor, ts.isTypeParameterDeclaration), nodesVisitor(node.parameters, visitor, ts.isParameterDeclaration), visitNode(node.type, visitor, ts.isTypeNode));
            case ts.SyntaxKind.ConstructSignature:
                return ts.updateConstructSignature(node, nodesVisitor(node.typeParameters, visitor, ts.isTypeParameterDeclaration), nodesVisitor(node.parameters, visitor, ts.isParameterDeclaration), visitNode(node.type, visitor, ts.isTypeNode));
            case ts.SyntaxKind.IndexSignature:
                return ts.updateIndexSignature(node, nodesVisitor(node.decorators, visitor, ts.isDecorator), nodesVisitor(node.modifiers, visitor, ts.isModifier), nodesVisitor(node.parameters, visitor, ts.isParameterDeclaration), visitNode(node.type, visitor, ts.isTypeNode));
            // Types
            case ts.SyntaxKind.TypePredicate:
                return ts.updateTypePredicateNode(node, visitNode(node.parameterName, visitor), visitNode(node.type, visitor, ts.isTypeNode));
            case ts.SyntaxKind.TypeReference:
                return ts.updateTypeReferenceNode(node, visitNode(node.typeName, visitor, ts.isEntityName), nodesVisitor(node.typeArguments, visitor, ts.isTypeNode));
            case ts.SyntaxKind.FunctionType:
                return ts.updateFunctionTypeNode(node, nodesVisitor(node.typeParameters, visitor, ts.isTypeParameterDeclaration), nodesVisitor(node.parameters, visitor, ts.isParameterDeclaration), visitNode(node.type, visitor, ts.isTypeNode));
            case ts.SyntaxKind.ConstructorType:
                return ts.updateConstructorTypeNode(node, nodesVisitor(node.typeParameters, visitor, ts.isTypeParameterDeclaration), nodesVisitor(node.parameters, visitor, ts.isParameterDeclaration), visitNode(node.type, visitor, ts.isTypeNode));
            case ts.SyntaxKind.TypeQuery:
                return ts.updateTypeQueryNode(node, visitNode(node.exprName, visitor, ts.isEntityName));
            case ts.SyntaxKind.TypeLiteral:
                return ts.updateTypeLiteralNode(node, nodesVisitor(node.members, visitor, ts.isTypeElement));
            case ts.SyntaxKind.ArrayType:
                return ts.updateArrayTypeNode(node, visitNode(node.elementType, visitor, ts.isTypeNode));
            case ts.SyntaxKind.TupleType:
                return ts.updateTypleTypeNode(node, nodesVisitor(node.elementTypes, visitor, ts.isTypeNode));
            case ts.SyntaxKind.UnionType:
                return ts.updateUnionTypeNode(node, nodesVisitor(node.types, visitor, ts.isTypeNode));
            case ts.SyntaxKind.IntersectionType:
                return ts.updateIntersectionTypeNode(node, nodesVisitor(node.types, visitor, ts.isTypeNode));
            case ts.SyntaxKind.ConditionalType:
                return ts.updateConditionalTypeNode(node, visitNode(node.checkType, visitor, ts.isTypeNode), visitNode(node.extendsType, visitor, ts.isTypeNode), visitNode(node.trueType, visitor, ts.isTypeNode), visitNode(node.falseType, visitor, ts.isTypeNode));
            case ts.SyntaxKind.InferType:
                return ts.updateInferTypeNode(node, visitNode(node.typeParameter, visitor, ts.isTypeParameterDeclaration));
            case ts.SyntaxKind.ImportType:
                return ts.updateImportTypeNode(node, visitNode(node.argument, visitor, ts.isTypeNode), visitNode(node.qualifier, visitor, ts.isEntityName), visitNodes(node.typeArguments, visitor, ts.isTypeNode), node.isTypeOf);
            case ts.SyntaxKind.ParenthesizedType:
                return ts.updateParenthesizedType(node, visitNode(node.type, visitor, ts.isTypeNode));
            case ts.SyntaxKind.TypeOperator:
                return ts.updateTypeOperatorNode(node, visitNode(node.type, visitor, ts.isTypeNode));
            case ts.SyntaxKind.IndexedAccessType:
                return ts.updateIndexedAccessTypeNode(node, visitNode(node.objectType, visitor, ts.isTypeNode), visitNode(node.indexType, visitor, ts.isTypeNode));
            case ts.SyntaxKind.MappedType:
                return ts.updateMappedTypeNode(node, visitNode(node.readonlyToken, tokenVisitor, ts.isToken), visitNode(node.typeParameter, visitor, ts.isTypeParameterDeclaration), visitNode(node.questionToken, tokenVisitor, ts.isToken), visitNode(node.type, visitor, ts.isTypeNode));
            case ts.SyntaxKind.LiteralType:
                return ts.updateLiteralTypeNode(node, visitNode(node.literal, visitor, ts.isExpression));
            // Binding patterns
            case ts.SyntaxKind.ObjectBindingPattern:
                return ts.updateObjectBindingPattern(node, nodesVisitor(node.elements, visitor, ts.isBindingElement));
            case ts.SyntaxKind.ArrayBindingPattern:
                return ts.updateArrayBindingPattern(node, nodesVisitor(node.elements, visitor, ts.isArrayBindingElement));
            case ts.SyntaxKind.BindingElement:
                return ts.updateBindingElement(node, visitNode(node.dotDotDotToken, tokenVisitor, ts.isToken), visitNode(node.propertyName, visitor, ts.isPropertyName), visitNode(node.name, visitor, ts.isBindingName), visitNode(node.initializer, visitor, ts.isExpression));
            // Expression
            case ts.SyntaxKind.ArrayLiteralExpression:
                return ts.updateArrayLiteral(node, nodesVisitor(node.elements, visitor, ts.isExpression));
            case ts.SyntaxKind.ObjectLiteralExpression:
                return ts.updateObjectLiteral(node, nodesVisitor(node.properties, visitor, ts.isObjectLiteralElementLike));
            case ts.SyntaxKind.PropertyAccessExpression:
                return ts.updatePropertyAccess(node, visitNode(node.expression, visitor, ts.isExpression), visitNode(node.name, visitor, ts.isIdentifier));
            case ts.SyntaxKind.ElementAccessExpression:
                return ts.updateElementAccess(node, visitNode(node.expression, visitor, ts.isExpression), visitNode(node.argumentExpression, visitor, ts.isExpression));
            case ts.SyntaxKind.CallExpression:
                return ts.updateCall(node, visitNode(node.expression, visitor, ts.isExpression), nodesVisitor(node.typeArguments, visitor, ts.isTypeNode), nodesVisitor(node.arguments, visitor, ts.isExpression));
            case ts.SyntaxKind.NewExpression:
                return ts.updateNew(node, visitNode(node.expression, visitor, ts.isExpression), nodesVisitor(node.typeArguments, visitor, ts.isTypeNode), nodesVisitor(node.arguments, visitor, ts.isExpression));
            case ts.SyntaxKind.TaggedTemplateExpression:
                return ts.updateTaggedTemplate(node, visitNode(node.tag, visitor, ts.isExpression), visitNodes(node.typeArguments, visitor, ts.isExpression), visitNode(node.template, visitor, ts.isTemplateLiteral));
            case ts.SyntaxKind.TypeAssertionExpression:
                return ts.updateTypeAssertion(node, visitNode(node.type, visitor, ts.isTypeNode), visitNode(node.expression, visitor, ts.isExpression));
            case ts.SyntaxKind.ParenthesizedExpression:
                return ts.updateParen(node, visitNode(node.expression, visitor, ts.isExpression));
            case ts.SyntaxKind.FunctionExpression:
                return ts.updateFunctionExpression(node, nodesVisitor(node.modifiers, visitor, ts.isModifier), visitNode(node.asteriskToken, tokenVisitor, ts.isToken), visitNode(node.name, visitor, ts.isIdentifier), nodesVisitor(node.typeParameters, visitor, ts.isTypeParameterDeclaration), visitParameterList(node.parameters, visitor, context, nodesVisitor), visitNode(node.type, visitor, ts.isTypeNode), visitFunctionBody(node.body, visitor, context));
            case ts.SyntaxKind.ArrowFunction:
                return ts.updateArrowFunction(node, nodesVisitor(node.modifiers, visitor, ts.isModifier), nodesVisitor(node.typeParameters, visitor, ts.isTypeParameterDeclaration), visitParameterList(node.parameters, visitor, context, nodesVisitor), visitNode(node.type, visitor, ts.isTypeNode), visitNode(node.equalsGreaterThanToken, visitor, ts.isToken), visitFunctionBody(node.body, visitor, context));
            case ts.SyntaxKind.DeleteExpression:
                return ts.updateDelete(node, visitNode(node.expression, visitor, ts.isExpression));
            case ts.SyntaxKind.TypeOfExpression:
                return ts.updateTypeOf(node, visitNode(node.expression, visitor, ts.isExpression));
            case ts.SyntaxKind.VoidExpression:
                return ts.updateVoid(node, visitNode(node.expression, visitor, ts.isExpression));
            case ts.SyntaxKind.AwaitExpression:
                return ts.updateAwait(node, visitNode(node.expression, visitor, ts.isExpression));
            case ts.SyntaxKind.PrefixUnaryExpression:
                return ts.updatePrefix(node, visitNode(node.operand, visitor, ts.isExpression));
            case ts.SyntaxKind.PostfixUnaryExpression:
                return ts.updatePostfix(node, visitNode(node.operand, visitor, ts.isExpression));
            case ts.SyntaxKind.BinaryExpression:
                return ts.updateBinary(node, visitNode(node.left, visitor, ts.isExpression), visitNode(node.right, visitor, ts.isExpression), visitNode(node.operatorToken, visitor, ts.isToken));
            case ts.SyntaxKind.ConditionalExpression:
                return ts.updateConditional(node, visitNode(node.condition, visitor, ts.isExpression), visitNode(node.questionToken, visitor, ts.isToken), visitNode(node.whenTrue, visitor, ts.isExpression), visitNode(node.colonToken, visitor, ts.isToken), visitNode(node.whenFalse, visitor, ts.isExpression));
            case ts.SyntaxKind.TemplateExpression:
                return ts.updateTemplateExpression(node, visitNode(node.head, visitor, ts.isTemplateHead), nodesVisitor(node.templateSpans, visitor, ts.isTemplateSpan));
            case ts.SyntaxKind.YieldExpression:
                return ts.updateYield(node, visitNode(node.asteriskToken, tokenVisitor, ts.isToken), visitNode(node.expression, visitor, ts.isExpression));
            case ts.SyntaxKind.SpreadElement:
                return ts.updateSpread(node, visitNode(node.expression, visitor, ts.isExpression));
            case ts.SyntaxKind.ClassExpression:
                return ts.updateClassExpression(node, nodesVisitor(node.modifiers, visitor, ts.isModifier), visitNode(node.name, visitor, ts.isIdentifier), nodesVisitor(node.typeParameters, visitor, ts.isTypeParameterDeclaration), nodesVisitor(node.heritageClauses, visitor, ts.isHeritageClause), nodesVisitor(node.members, visitor, ts.isClassElement));
            case ts.SyntaxKind.ExpressionWithTypeArguments:
                return ts.updateExpressionWithTypeArguments(node, nodesVisitor(node.typeArguments, visitor, ts.isTypeNode), visitNode(node.expression, visitor, ts.isExpression));
            case ts.SyntaxKind.AsExpression:
                return ts.updateAsExpression(node, visitNode(node.expression, visitor, ts.isExpression), visitNode(node.type, visitor, ts.isTypeNode));
            case ts.SyntaxKind.NonNullExpression:
                return ts.updateNonNullExpression(node, visitNode(node.expression, visitor, ts.isExpression));
            case ts.SyntaxKind.MetaProperty:
                return ts.updateMetaProperty(node, visitNode(node.name, visitor, ts.isIdentifier));
            // Misc
            case ts.SyntaxKind.TemplateSpan:
                return ts.updateTemplateSpan(node, visitNode(node.expression, visitor, ts.isExpression), visitNode(node.literal, visitor, ts.isTemplateMiddleOrTemplateTail));
            // Element
            case ts.SyntaxKind.Block:
                return ts.updateBlock(node, nodesVisitor(node.statements, visitor, ts.isStatement));
            case ts.SyntaxKind.VariableStatement:
                return ts.updateVariableStatement(node, nodesVisitor(node.modifiers, visitor, ts.isModifier), visitNode(node.declarationList, visitor, ts.isVariableDeclarationList));
            case ts.SyntaxKind.ExpressionStatement:
                return ts.updateStatement(node, visitNode(node.expression, visitor, ts.isExpression));
            case ts.SyntaxKind.IfStatement:
                return ts.updateIf(node, visitNode(node.expression, visitor, ts.isExpression), visitNode(node.thenStatement, visitor, ts.isStatement, ts.liftToBlock), visitNode(node.elseStatement, visitor, ts.isStatement, ts.liftToBlock));
            case ts.SyntaxKind.DoStatement:
                return ts.updateDo(node, visitNode(node.statement, visitor, ts.isStatement, ts.liftToBlock), visitNode(node.expression, visitor, ts.isExpression));
            case ts.SyntaxKind.WhileStatement:
                return ts.updateWhile(node, visitNode(node.expression, visitor, ts.isExpression), visitNode(node.statement, visitor, ts.isStatement, ts.liftToBlock));
            case ts.SyntaxKind.ForStatement:
                return ts.updateFor(node, visitNode(node.initializer, visitor, ts.isForInitializer), visitNode(node.condition, visitor, ts.isExpression), visitNode(node.incrementor, visitor, ts.isExpression), visitNode(node.statement, visitor, ts.isStatement, ts.liftToBlock));
            case ts.SyntaxKind.ForInStatement:
                return ts.updateForIn(node, visitNode(node.initializer, visitor, ts.isForInitializer), visitNode(node.expression, visitor, ts.isExpression), visitNode(node.statement, visitor, ts.isStatement, ts.liftToBlock));
            case ts.SyntaxKind.ForOfStatement:
                return ts.updateForOf(node, visitNode(node.awaitModifier, visitor, ts.isToken), visitNode(node.initializer, visitor, ts.isForInitializer), visitNode(node.expression, visitor, ts.isExpression), visitNode(node.statement, visitor, ts.isStatement, ts.liftToBlock));
            case ts.SyntaxKind.ContinueStatement:
                return ts.updateContinue(node, visitNode(node.label, visitor, ts.isIdentifier));
            case ts.SyntaxKind.BreakStatement:
                return ts.updateBreak(node, visitNode(node.label, visitor, ts.isIdentifier));
            case ts.SyntaxKind.ReturnStatement:
                return ts.updateReturn(node, visitNode(node.expression, visitor, ts.isExpression));
            case ts.SyntaxKind.WithStatement:
                return ts.updateWith(node, visitNode(node.expression, visitor, ts.isExpression), visitNode(node.statement, visitor, ts.isStatement, ts.liftToBlock));
            case ts.SyntaxKind.SwitchStatement:
                return ts.updateSwitch(node, visitNode(node.expression, visitor, ts.isExpression), visitNode(node.caseBlock, visitor, ts.isCaseBlock));
            case ts.SyntaxKind.LabeledStatement:
                return ts.updateLabel(node, visitNode(node.label, visitor, ts.isIdentifier), visitNode(node.statement, visitor, ts.isStatement, ts.liftToBlock));
            case ts.SyntaxKind.ThrowStatement:
                return ts.updateThrow(node, visitNode(node.expression, visitor, ts.isExpression));
            case ts.SyntaxKind.TryStatement:
                return ts.updateTry(node, visitNode(node.tryBlock, visitor, ts.isBlock), visitNode(node.catchClause, visitor, ts.isCatchClause), visitNode(node.finallyBlock, visitor, ts.isBlock));
            case ts.SyntaxKind.VariableDeclaration:
                return ts.updateVariableDeclaration(node, visitNode(node.name, visitor, ts.isBindingName), visitNode(node.type, visitor, ts.isTypeNode), visitNode(node.initializer, visitor, ts.isExpression));
            case ts.SyntaxKind.VariableDeclarationList:
                return ts.updateVariableDeclarationList(node, nodesVisitor(node.declarations, visitor, ts.isVariableDeclaration));
            case ts.SyntaxKind.FunctionDeclaration:
                return ts.updateFunctionDeclaration(node, nodesVisitor(node.decorators, visitor, ts.isDecorator), nodesVisitor(node.modifiers, visitor, ts.isModifier), visitNode(node.asteriskToken, tokenVisitor, ts.isToken), visitNode(node.name, visitor, ts.isIdentifier), nodesVisitor(node.typeParameters, visitor, ts.isTypeParameterDeclaration), visitParameterList(node.parameters, visitor, context, nodesVisitor), visitNode(node.type, visitor, ts.isTypeNode), visitFunctionBody(node.body, visitor, context));
            case ts.SyntaxKind.ClassDeclaration:
                return ts.updateClassDeclaration(node, nodesVisitor(node.decorators, visitor, ts.isDecorator), nodesVisitor(node.modifiers, visitor, ts.isModifier), visitNode(node.name, visitor, ts.isIdentifier), nodesVisitor(node.typeParameters, visitor, ts.isTypeParameterDeclaration), nodesVisitor(node.heritageClauses, visitor, ts.isHeritageClause), nodesVisitor(node.members, visitor, ts.isClassElement));
            case ts.SyntaxKind.InterfaceDeclaration:
                return ts.updateInterfaceDeclaration(node, nodesVisitor(node.decorators, visitor, ts.isDecorator), nodesVisitor(node.modifiers, visitor, ts.isModifier), visitNode(node.name, visitor, ts.isIdentifier), nodesVisitor(node.typeParameters, visitor, ts.isTypeParameterDeclaration), nodesVisitor(node.heritageClauses, visitor, ts.isHeritageClause), nodesVisitor(node.members, visitor, ts.isTypeElement));
            case ts.SyntaxKind.TypeAliasDeclaration:
                return ts.updateTypeAliasDeclaration(node, nodesVisitor(node.decorators, visitor, ts.isDecorator), nodesVisitor(node.modifiers, visitor, ts.isModifier), visitNode(node.name, visitor, ts.isIdentifier), nodesVisitor(node.typeParameters, visitor, ts.isTypeParameterDeclaration), visitNode(node.type, visitor, ts.isTypeNode));
            case ts.SyntaxKind.EnumDeclaration:
                return ts.updateEnumDeclaration(node, nodesVisitor(node.decorators, visitor, ts.isDecorator), nodesVisitor(node.modifiers, visitor, ts.isModifier), visitNode(node.name, visitor, ts.isIdentifier), nodesVisitor(node.members, visitor, ts.isEnumMember));
            case ts.SyntaxKind.ModuleDeclaration:
                return ts.updateModuleDeclaration(node, nodesVisitor(node.decorators, visitor, ts.isDecorator), nodesVisitor(node.modifiers, visitor, ts.isModifier), visitNode(node.name, visitor, ts.isIdentifier), visitNode(node.body, visitor, ts.isModuleBody));
            case ts.SyntaxKind.ModuleBlock:
                return ts.updateModuleBlock(node, nodesVisitor(node.statements, visitor, ts.isStatement));
            case ts.SyntaxKind.CaseBlock:
                return ts.updateCaseBlock(node, nodesVisitor(node.clauses, visitor, ts.isCaseOrDefaultClause));
            case ts.SyntaxKind.NamespaceExportDeclaration:
                return ts.updateNamespaceExportDeclaration(node, visitNode(node.name, visitor, ts.isIdentifier));
            case ts.SyntaxKind.ImportEqualsDeclaration:
                return ts.updateImportEqualsDeclaration(node, nodesVisitor(node.decorators, visitor, ts.isDecorator), nodesVisitor(node.modifiers, visitor, ts.isModifier), visitNode(node.name, visitor, ts.isIdentifier), visitNode(node.moduleReference, visitor, ts.isModuleReference));
            case ts.SyntaxKind.ImportDeclaration:
                return ts.updateImportDeclaration(node, nodesVisitor(node.decorators, visitor, ts.isDecorator), nodesVisitor(node.modifiers, visitor, ts.isModifier), visitNode(node.importClause, visitor, ts.isImportClause), visitNode(node.moduleSpecifier, visitor, ts.isExpression));
            case ts.SyntaxKind.ImportClause:
                return ts.updateImportClause(node, visitNode(node.name, visitor, ts.isIdentifier), visitNode(node.namedBindings, visitor, ts.isNamedImportBindings));
            case ts.SyntaxKind.NamespaceImport:
                return ts.updateNamespaceImport(node, visitNode(node.name, visitor, ts.isIdentifier));
            case ts.SyntaxKind.NamedImports:
                return ts.updateNamedImports(node, nodesVisitor(node.elements, visitor, ts.isImportSpecifier));
            case ts.SyntaxKind.ImportSpecifier:
                return ts.updateImportSpecifier(node, visitNode(node.propertyName, visitor, ts.isIdentifier), visitNode(node.name, visitor, ts.isIdentifier));
            case ts.SyntaxKind.ExportAssignment:
                return ts.updateExportAssignment(node, nodesVisitor(node.decorators, visitor, ts.isDecorator), nodesVisitor(node.modifiers, visitor, ts.isModifier), visitNode(node.expression, visitor, ts.isExpression));
            case ts.SyntaxKind.ExportDeclaration:
                return ts.updateExportDeclaration(node, nodesVisitor(node.decorators, visitor, ts.isDecorator), nodesVisitor(node.modifiers, visitor, ts.isModifier), visitNode(node.exportClause, visitor, ts.isNamedExports), visitNode(node.moduleSpecifier, visitor, ts.isExpression));
            case ts.SyntaxKind.NamedExports:
                return ts.updateNamedExports(node, nodesVisitor(node.elements, visitor, ts.isExportSpecifier));
            case ts.SyntaxKind.ExportSpecifier:
                return ts.updateExportSpecifier(node, visitNode(node.propertyName, visitor, ts.isIdentifier), visitNode(node.name, visitor, ts.isIdentifier));
            // Module references
            case ts.SyntaxKind.ExternalModuleReference:
                return ts.updateExternalModuleReference(node, visitNode(node.expression, visitor, ts.isExpression));
            // JSX
            case ts.SyntaxKind.JsxElement:
                return ts.updateJsxElement(node, visitNode(node.openingElement, visitor, ts.isJsxOpeningElement), nodesVisitor(node.children, visitor, ts.isJsxChild), visitNode(node.closingElement, visitor, ts.isJsxClosingElement));
            case ts.SyntaxKind.JsxSelfClosingElement:
                return ts.updateJsxSelfClosingElement(node, visitNode(node.tagName, visitor, ts.isJsxTagNameExpression), nodesVisitor(node.typeArguments, visitor, ts.isTypeNode), visitNode(node.attributes, visitor, ts.isJsxAttributes));
            case ts.SyntaxKind.JsxOpeningElement:
                return ts.updateJsxOpeningElement(node, visitNode(node.tagName, visitor, ts.isJsxTagNameExpression), nodesVisitor(node.typeArguments, visitor, ts.isTypeNode), visitNode(node.attributes, visitor, ts.isJsxAttributes));
            case ts.SyntaxKind.JsxClosingElement:
                return ts.updateJsxClosingElement(node, visitNode(node.tagName, visitor, ts.isJsxTagNameExpression));
            case ts.SyntaxKind.JsxFragment:
                return ts.updateJsxFragment(node, visitNode(node.openingFragment, visitor, ts.isJsxOpeningFragment), nodesVisitor(node.children, visitor, ts.isJsxChild), visitNode(node.closingFragment, visitor, ts.isJsxClosingFragment));
            case ts.SyntaxKind.JsxAttribute:
                return ts.updateJsxAttribute(node, visitNode(node.name, visitor, ts.isIdentifier), visitNode(node.initializer, visitor, ts.isStringLiteralOrJsxExpression));
            case ts.SyntaxKind.JsxAttributes:
                return ts.updateJsxAttributes(node, nodesVisitor(node.properties, visitor, ts.isJsxAttributeLike));
            case ts.SyntaxKind.JsxSpreadAttribute:
                return ts.updateJsxSpreadAttribute(node, visitNode(node.expression, visitor, ts.isExpression));
            case ts.SyntaxKind.JsxExpression:
                return ts.updateJsxExpression(node, visitNode(node.expression, visitor, ts.isExpression));
            // Clauses
            case ts.SyntaxKind.CaseClause:
                return ts.updateCaseClause(node, visitNode(node.expression, visitor, ts.isExpression), nodesVisitor(node.statements, visitor, ts.isStatement));
            case ts.SyntaxKind.DefaultClause:
                return ts.updateDefaultClause(node, nodesVisitor(node.statements, visitor, ts.isStatement));
            case ts.SyntaxKind.HeritageClause:
                return ts.updateHeritageClause(node, nodesVisitor(node.types, visitor, ts.isExpressionWithTypeArguments));
            case ts.SyntaxKind.CatchClause:
                return ts.updateCatchClause(node, visitNode(node.variableDeclaration, visitor, ts.isVariableDeclaration), visitNode(node.block, visitor, ts.isBlock));
            // Property assignments
            case ts.SyntaxKind.PropertyAssignment:
                return ts.updatePropertyAssignment(node, visitNode(node.name, visitor, ts.isPropertyName), visitNode(node.initializer, visitor, ts.isExpression));
            case ts.SyntaxKind.ShorthandPropertyAssignment:
                return ts.updateShorthandPropertyAssignment(node, visitNode(node.name, visitor, ts.isIdentifier), visitNode(node.objectAssignmentInitializer, visitor, ts.isExpression));
            case ts.SyntaxKind.SpreadAssignment:
                return ts.updateSpreadAssignment(node, visitNode(node.expression, visitor, ts.isExpression));
            // Enum
            case ts.SyntaxKind.EnumMember:
                return ts.updateEnumMember(node, visitNode(node.name, visitor, ts.isPropertyName), visitNode(node.initializer, visitor, ts.isExpression));
            // Top-level nodes
            case ts.SyntaxKind.SourceFile:
                return ts.updateSourceFileNode(node, visitLexicalEnvironment(node.statements, visitor, context));
            // Transformation nodes
            case ts.SyntaxKind.PartiallyEmittedExpression:
                return ts.updatePartiallyEmittedExpression(node, visitNode(node.expression, visitor, ts.isExpression));
            case ts.SyntaxKind.CommaListExpression:
                return ts.updateCommaList(node, nodesVisitor(node.elements, visitor, ts.isExpression));
            default:
                // No need to visit nodes with no children.
                return node;
        }
    }
    ts.visitEachChild = visitEachChild;
    /**
     * Extracts the single node from a NodeArray.
     *
     * @param nodes The NodeArray.
     */
    function extractSingleNode(nodes) {
        ts.Debug.assert(nodes.length <= 1, "Too many nodes written to output.");
        return ts.singleOrUndefined(nodes);
    }
})(ts || (ts = {}));
/* @internal */
(function (ts) {
    function reduceNode(node, f, initial) {
        return node ? f(initial, node) : initial;
    }
    function reduceNodeArray(nodes, f, initial) {
        return nodes ? f(initial, nodes) : initial;
    }
    /**
     * Similar to `reduceLeft`, performs a reduction against each child of a node.
     * NOTE: Unlike `forEachChild`, this does *not* visit every node.
     *
     * @param node The node containing the children to reduce.
     * @param initial The initial value to supply to the reduction.
     * @param f The callback function
     */
    function reduceEachChild(node, initial, cbNode, cbNodeArray) {
        if (node === undefined) {
            return initial;
        }
        const reduceNodes = cbNodeArray ? reduceNodeArray : ts.reduceLeft;
        const cbNodes = cbNodeArray || cbNode;
        const kind = node.kind;
        // No need to visit nodes with no children.
        if ((kind > ts.SyntaxKind.FirstToken && kind <= ts.SyntaxKind.LastToken)) {
            return initial;
        }
        // We do not yet support types.
        if ((kind >= ts.SyntaxKind.TypePredicate && kind <= ts.SyntaxKind.LiteralType)) {
            return initial;
        }
        let result = initial;
        switch (node.kind) {
            // Leaf nodes
            case ts.SyntaxKind.SemicolonClassElement:
            case ts.SyntaxKind.EmptyStatement:
            case ts.SyntaxKind.OmittedExpression:
            case ts.SyntaxKind.DebuggerStatement:
            case ts.SyntaxKind.NotEmittedStatement:
                // No need to visit nodes with no children.
                break;
            // Names
            case ts.SyntaxKind.QualifiedName:
                result = reduceNode(node.left, cbNode, result);
                result = reduceNode(node.right, cbNode, result);
                break;
            case ts.SyntaxKind.ComputedPropertyName:
                result = reduceNode(node.expression, cbNode, result);
                break;
            // Signature elements
            case ts.SyntaxKind.Parameter:
                result = reduceNodes(node.decorators, cbNodes, result);
                result = reduceNodes(node.modifiers, cbNodes, result);
                result = reduceNode(node.name, cbNode, result);
                result = reduceNode(node.type, cbNode, result);
                result = reduceNode(node.initializer, cbNode, result);
                break;
            case ts.SyntaxKind.Decorator:
                result = reduceNode(node.expression, cbNode, result);
                break;
            // Type member
            case ts.SyntaxKind.PropertySignature:
                result = reduceNodes(node.modifiers, cbNodes, result);
                result = reduceNode(node.name, cbNode, result);
                result = reduceNode(node.questionToken, cbNode, result);
                result = reduceNode(node.type, cbNode, result);
                result = reduceNode(node.initializer, cbNode, result);
                break;
            case ts.SyntaxKind.PropertyDeclaration:
                result = reduceNodes(node.decorators, cbNodes, result);
                result = reduceNodes(node.modifiers, cbNodes, result);
                result = reduceNode(node.name, cbNode, result);
                result = reduceNode(node.type, cbNode, result);
                result = reduceNode(node.initializer, cbNode, result);
                break;
            case ts.SyntaxKind.MethodDeclaration:
                result = reduceNodes(node.decorators, cbNodes, result);
                result = reduceNodes(node.modifiers, cbNodes, result);
                result = reduceNode(node.name, cbNode, result);
                result = reduceNodes(node.typeParameters, cbNodes, result);
                result = reduceNodes(node.parameters, cbNodes, result);
                result = reduceNode(node.type, cbNode, result);
                result = reduceNode(node.body, cbNode, result);
                break;
            case ts.SyntaxKind.Constructor:
                result = reduceNodes(node.modifiers, cbNodes, result);
                result = reduceNodes(node.parameters, cbNodes, result);
                result = reduceNode(node.body, cbNode, result);
                break;
            case ts.SyntaxKind.GetAccessor:
                result = reduceNodes(node.decorators, cbNodes, result);
                result = reduceNodes(node.modifiers, cbNodes, result);
                result = reduceNode(node.name, cbNode, result);
                result = reduceNodes(node.parameters, cbNodes, result);
                result = reduceNode(node.type, cbNode, result);
                result = reduceNode(node.body, cbNode, result);
                break;
            case ts.SyntaxKind.SetAccessor:
                result = reduceNodes(node.decorators, cbNodes, result);
                result = reduceNodes(node.modifiers, cbNodes, result);
                result = reduceNode(node.name, cbNode, result);
                result = reduceNodes(node.parameters, cbNodes, result);
                result = reduceNode(node.body, cbNode, result);
                break;
            // Binding patterns
            case ts.SyntaxKind.ObjectBindingPattern:
            case ts.SyntaxKind.ArrayBindingPattern:
                result = reduceNodes(node.elements, cbNodes, result);
                break;
            case ts.SyntaxKind.BindingElement:
                result = reduceNode(node.propertyName, cbNode, result);
                result = reduceNode(node.name, cbNode, result);
                result = reduceNode(node.initializer, cbNode, result);
                break;
            // Expression
            case ts.SyntaxKind.ArrayLiteralExpression:
                result = reduceNodes(node.elements, cbNodes, result);
                break;
            case ts.SyntaxKind.ObjectLiteralExpression:
                result = reduceNodes(node.properties, cbNodes, result);
                break;
            case ts.SyntaxKind.PropertyAccessExpression:
                result = reduceNode(node.expression, cbNode, result);
                result = reduceNode(node.name, cbNode, result);
                break;
            case ts.SyntaxKind.ElementAccessExpression:
                result = reduceNode(node.expression, cbNode, result);
                result = reduceNode(node.argumentExpression, cbNode, result);
                break;
            case ts.SyntaxKind.CallExpression:
                result = reduceNode(node.expression, cbNode, result);
                result = reduceNodes(node.typeArguments, cbNodes, result);
                result = reduceNodes(node.arguments, cbNodes, result);
                break;
            case ts.SyntaxKind.NewExpression:
                result = reduceNode(node.expression, cbNode, result);
                result = reduceNodes(node.typeArguments, cbNodes, result);
                result = reduceNodes(node.arguments, cbNodes, result);
                break;
            case ts.SyntaxKind.TaggedTemplateExpression:
                result = reduceNode(node.tag, cbNode, result);
                result = reduceNode(node.template, cbNode, result);
                break;
            case ts.SyntaxKind.TypeAssertionExpression:
                result = reduceNode(node.type, cbNode, result);
                result = reduceNode(node.expression, cbNode, result);
                break;
            case ts.SyntaxKind.FunctionExpression:
                result = reduceNodes(node.modifiers, cbNodes, result);
                result = reduceNode(node.name, cbNode, result);
                result = reduceNodes(node.typeParameters, cbNodes, result);
                result = reduceNodes(node.parameters, cbNodes, result);
                result = reduceNode(node.type, cbNode, result);
                result = reduceNode(node.body, cbNode, result);
                break;
            case ts.SyntaxKind.ArrowFunction:
                result = reduceNodes(node.modifiers, cbNodes, result);
                result = reduceNodes(node.typeParameters, cbNodes, result);
                result = reduceNodes(node.parameters, cbNodes, result);
                result = reduceNode(node.type, cbNode, result);
                result = reduceNode(node.body, cbNode, result);
                break;
            case ts.SyntaxKind.ParenthesizedExpression:
            case ts.SyntaxKind.DeleteExpression:
            case ts.SyntaxKind.TypeOfExpression:
            case ts.SyntaxKind.VoidExpression:
            case ts.SyntaxKind.AwaitExpression:
            case ts.SyntaxKind.YieldExpression:
            case ts.SyntaxKind.SpreadElement:
            case ts.SyntaxKind.NonNullExpression:
                result = reduceNode(node.expression, cbNode, result);
                break;
            case ts.SyntaxKind.PrefixUnaryExpression:
            case ts.SyntaxKind.PostfixUnaryExpression:
                result = reduceNode(node.operand, cbNode, result);
                break;
            case ts.SyntaxKind.BinaryExpression:
                result = reduceNode(node.left, cbNode, result);
                result = reduceNode(node.right, cbNode, result);
                break;
            case ts.SyntaxKind.ConditionalExpression:
                result = reduceNode(node.condition, cbNode, result);
                result = reduceNode(node.whenTrue, cbNode, result);
                result = reduceNode(node.whenFalse, cbNode, result);
                break;
            case ts.SyntaxKind.TemplateExpression:
                result = reduceNode(node.head, cbNode, result);
                result = reduceNodes(node.templateSpans, cbNodes, result);
                break;
            case ts.SyntaxKind.ClassExpression:
                result = reduceNodes(node.modifiers, cbNodes, result);
                result = reduceNode(node.name, cbNode, result);
                result = reduceNodes(node.typeParameters, cbNodes, result);
                result = reduceNodes(node.heritageClauses, cbNodes, result);
                result = reduceNodes(node.members, cbNodes, result);
                break;
            case ts.SyntaxKind.ExpressionWithTypeArguments:
                result = reduceNode(node.expression, cbNode, result);
                result = reduceNodes(node.typeArguments, cbNodes, result);
                break;
            case ts.SyntaxKind.AsExpression:
                result = reduceNode(node.expression, cbNode, result);
                result = reduceNode(node.type, cbNode, result);
                break;
            // Misc
            case ts.SyntaxKind.TemplateSpan:
                result = reduceNode(node.expression, cbNode, result);
                result = reduceNode(node.literal, cbNode, result);
                break;
            // Element
            case ts.SyntaxKind.Block:
                result = reduceNodes(node.statements, cbNodes, result);
                break;
            case ts.SyntaxKind.VariableStatement:
                result = reduceNodes(node.modifiers, cbNodes, result);
                result = reduceNode(node.declarationList, cbNode, result);
                break;
            case ts.SyntaxKind.ExpressionStatement:
                result = reduceNode(node.expression, cbNode, result);
                break;
            case ts.SyntaxKind.IfStatement:
                result = reduceNode(node.expression, cbNode, result);
                result = reduceNode(node.thenStatement, cbNode, result);
                result = reduceNode(node.elseStatement, cbNode, result);
                break;
            case ts.SyntaxKind.DoStatement:
                result = reduceNode(node.statement, cbNode, result);
                result = reduceNode(node.expression, cbNode, result);
                break;
            case ts.SyntaxKind.WhileStatement:
            case ts.SyntaxKind.WithStatement:
                result = reduceNode(node.expression, cbNode, result);
                result = reduceNode(node.statement, cbNode, result);
                break;
            case ts.SyntaxKind.ForStatement:
                result = reduceNode(node.initializer, cbNode, result);
                result = reduceNode(node.condition, cbNode, result);
                result = reduceNode(node.incrementor, cbNode, result);
                result = reduceNode(node.statement, cbNode, result);
                break;
            case ts.SyntaxKind.ForInStatement:
            case ts.SyntaxKind.ForOfStatement:
                result = reduceNode(node.initializer, cbNode, result);
                result = reduceNode(node.expression, cbNode, result);
                result = reduceNode(node.statement, cbNode, result);
                break;
            case ts.SyntaxKind.ReturnStatement:
            case ts.SyntaxKind.ThrowStatement:
                result = reduceNode(node.expression, cbNode, result);
                break;
            case ts.SyntaxKind.SwitchStatement:
                result = reduceNode(node.expression, cbNode, result);
                result = reduceNode(node.caseBlock, cbNode, result);
                break;
            case ts.SyntaxKind.LabeledStatement:
                result = reduceNode(node.label, cbNode, result);
                result = reduceNode(node.statement, cbNode, result);
                break;
            case ts.SyntaxKind.TryStatement:
                result = reduceNode(node.tryBlock, cbNode, result);
                result = reduceNode(node.catchClause, cbNode, result);
                result = reduceNode(node.finallyBlock, cbNode, result);
                break;
            case ts.SyntaxKind.VariableDeclaration:
                result = reduceNode(node.name, cbNode, result);
                result = reduceNode(node.type, cbNode, result);
                result = reduceNode(node.initializer, cbNode, result);
                break;
            case ts.SyntaxKind.VariableDeclarationList:
                result = reduceNodes(node.declarations, cbNodes, result);
                break;
            case ts.SyntaxKind.FunctionDeclaration:
                result = reduceNodes(node.decorators, cbNodes, result);
                result = reduceNodes(node.modifiers, cbNodes, result);
                result = reduceNode(node.name, cbNode, result);
                result = reduceNodes(node.typeParameters, cbNodes, result);
                result = reduceNodes(node.parameters, cbNodes, result);
                result = reduceNode(node.type, cbNode, result);
                result = reduceNode(node.body, cbNode, result);
                break;
            case ts.SyntaxKind.ClassDeclaration:
                result = reduceNodes(node.decorators, cbNodes, result);
                result = reduceNodes(node.modifiers, cbNodes, result);
                result = reduceNode(node.name, cbNode, result);
                result = reduceNodes(node.typeParameters, cbNodes, result);
                result = reduceNodes(node.heritageClauses, cbNodes, result);
                result = reduceNodes(node.members, cbNodes, result);
                break;
            case ts.SyntaxKind.EnumDeclaration:
                result = reduceNodes(node.decorators, cbNodes, result);
                result = reduceNodes(node.modifiers, cbNodes, result);
                result = reduceNode(node.name, cbNode, result);
                result = reduceNodes(node.members, cbNodes, result);
                break;
            case ts.SyntaxKind.ModuleDeclaration:
                result = reduceNodes(node.decorators, cbNodes, result);
                result = reduceNodes(node.modifiers, cbNodes, result);
                result = reduceNode(node.name, cbNode, result);
                result = reduceNode(node.body, cbNode, result);
                break;
            case ts.SyntaxKind.ModuleBlock:
                result = reduceNodes(node.statements, cbNodes, result);
                break;
            case ts.SyntaxKind.CaseBlock:
                result = reduceNodes(node.clauses, cbNodes, result);
                break;
            case ts.SyntaxKind.ImportEqualsDeclaration:
                result = reduceNodes(node.decorators, cbNodes, result);
                result = reduceNodes(node.modifiers, cbNodes, result);
                result = reduceNode(node.name, cbNode, result);
                result = reduceNode(node.moduleReference, cbNode, result);
                break;
            case ts.SyntaxKind.ImportDeclaration:
                result = reduceNodes(node.decorators, cbNodes, result);
                result = reduceNodes(node.modifiers, cbNodes, result);
                result = reduceNode(node.importClause, cbNode, result);
                result = reduceNode(node.moduleSpecifier, cbNode, result);
                break;
            case ts.SyntaxKind.ImportClause:
                result = reduceNode(node.name, cbNode, result);
                result = reduceNode(node.namedBindings, cbNode, result);
                break;
            case ts.SyntaxKind.NamespaceImport:
                result = reduceNode(node.name, cbNode, result);
                break;
            case ts.SyntaxKind.NamedImports:
            case ts.SyntaxKind.NamedExports:
                result = reduceNodes(node.elements, cbNodes, result);
                break;
            case ts.SyntaxKind.ImportSpecifier:
            case ts.SyntaxKind.ExportSpecifier:
                result = reduceNode(node.propertyName, cbNode, result);
                result = reduceNode(node.name, cbNode, result);
                break;
            case ts.SyntaxKind.ExportAssignment:
                result = ts.reduceLeft(node.decorators, cbNode, result);
                result = ts.reduceLeft(node.modifiers, cbNode, result);
                result = reduceNode(node.expression, cbNode, result);
                break;
            case ts.SyntaxKind.ExportDeclaration:
                result = ts.reduceLeft(node.decorators, cbNode, result);
                result = ts.reduceLeft(node.modifiers, cbNode, result);
                result = reduceNode(node.exportClause, cbNode, result);
                result = reduceNode(node.moduleSpecifier, cbNode, result);
                break;
            // Module references
            case ts.SyntaxKind.ExternalModuleReference:
                result = reduceNode(node.expression, cbNode, result);
                break;
            // JSX
            case ts.SyntaxKind.JsxElement:
                result = reduceNode(node.openingElement, cbNode, result);
                result = ts.reduceLeft(node.children, cbNode, result);
                result = reduceNode(node.closingElement, cbNode, result);
                break;
            case ts.SyntaxKind.JsxFragment:
                result = reduceNode(node.openingFragment, cbNode, result);
                result = ts.reduceLeft(node.children, cbNode, result);
                result = reduceNode(node.closingFragment, cbNode, result);
                break;
            case ts.SyntaxKind.JsxSelfClosingElement:
            case ts.SyntaxKind.JsxOpeningElement:
                result = reduceNode(node.tagName, cbNode, result);
                result = reduceNode(node.attributes, cbNode, result);
                break;
            case ts.SyntaxKind.JsxAttributes:
                result = reduceNodes(node.properties, cbNodes, result);
                break;
            case ts.SyntaxKind.JsxClosingElement:
                result = reduceNode(node.tagName, cbNode, result);
                break;
            case ts.SyntaxKind.JsxAttribute:
                result = reduceNode(node.name, cbNode, result);
                result = reduceNode(node.initializer, cbNode, result);
                break;
            case ts.SyntaxKind.JsxSpreadAttribute:
                result = reduceNode(node.expression, cbNode, result);
                break;
            case ts.SyntaxKind.JsxExpression:
                result = reduceNode(node.expression, cbNode, result);
                break;
            // Clauses
            case ts.SyntaxKind.CaseClause:
                result = reduceNode(node.expression, cbNode, result);
            // falls through
            case ts.SyntaxKind.DefaultClause:
                result = reduceNodes(node.statements, cbNodes, result);
                break;
            case ts.SyntaxKind.HeritageClause:
                result = reduceNodes(node.types, cbNodes, result);
                break;
            case ts.SyntaxKind.CatchClause:
                result = reduceNode(node.variableDeclaration, cbNode, result);
                result = reduceNode(node.block, cbNode, result);
                break;
            // Property assignments
            case ts.SyntaxKind.PropertyAssignment:
                result = reduceNode(node.name, cbNode, result);
                result = reduceNode(node.initializer, cbNode, result);
                break;
            case ts.SyntaxKind.ShorthandPropertyAssignment:
                result = reduceNode(node.name, cbNode, result);
                result = reduceNode(node.objectAssignmentInitializer, cbNode, result);
                break;
            case ts.SyntaxKind.SpreadAssignment:
                result = reduceNode(node.expression, cbNode, result);
                break;
            // Enum
            case ts.SyntaxKind.EnumMember:
                result = reduceNode(node.name, cbNode, result);
                result = reduceNode(node.initializer, cbNode, result);
                break;
            // Top-level nodes
            case ts.SyntaxKind.SourceFile:
                result = reduceNodes(node.statements, cbNodes, result);
                break;
            // Transformation nodes
            case ts.SyntaxKind.PartiallyEmittedExpression:
                result = reduceNode(node.expression, cbNode, result);
                break;
            case ts.SyntaxKind.CommaListExpression:
                result = reduceNodes(node.elements, cbNodes, result);
                break;
            default:
                break;
        }
        return result;
    }
    ts.reduceEachChild = reduceEachChild;
    function mergeLexicalEnvironment(statements, declarations) {
        if (!ts.some(declarations)) {
            return statements;
        }
        return ts.isNodeArray(statements)
            ? ts.setTextRange(ts.createNodeArray(ts.concatenate(statements, declarations)), statements)
            : ts.addRange(statements, declarations);
    }
    ts.mergeLexicalEnvironment = mergeLexicalEnvironment;
    /**
     * Lifts a NodeArray containing only Statement nodes to a block.
     *
     * @param nodes The NodeArray.
     */
    function liftToBlock(nodes) {
        Debug.assert(ts.every(nodes, ts.isStatement), "Cannot lift nodes to a Block.");
        return ts.singleOrUndefined(nodes) || ts.createBlock(nodes);
    }
    ts.liftToBlock = liftToBlock;
    /**
     * Aggregates the TransformFlags for a Node and its subtree.
     */
    function aggregateTransformFlags(node) {
        aggregateTransformFlagsForNode(node);
        return node;
    }
    ts.aggregateTransformFlags = aggregateTransformFlags;
    /**
     * Aggregates the TransformFlags for a Node and its subtree. The flags for the subtree are
     * computed first, then the transform flags for the current node are computed from the subtree
     * flags and the state of the current node. Finally, the transform flags of the node are
     * returned, excluding any flags that should not be included in its parent node's subtree
     * flags.
     */
    function aggregateTransformFlagsForNode(node) {
        if (node === undefined) {
            return 0 /* None */;
        }
        if (node.transformFlags & 536870912 /* HasComputedFlags */) {
            return node.transformFlags & ~ts.getTransformFlagsSubtreeExclusions(node.kind);
        }
        const subtreeFlags = aggregateTransformFlagsForSubtree(node);
        return ts.computeTransformFlagsForNode(node, subtreeFlags);
    }
    function aggregateTransformFlagsForNodeArray(nodes) {
        if (nodes === undefined) {
            return 0 /* None */;
        }
        let subtreeFlags = 0 /* None */;
        let nodeArrayFlags = 0 /* None */;
        for (const node of nodes) {
            subtreeFlags |= aggregateTransformFlagsForNode(node);
            nodeArrayFlags |= node.transformFlags & ~536870912 /* HasComputedFlags */;
        }
        nodes.transformFlags = nodeArrayFlags | 536870912 /* HasComputedFlags */;
        return subtreeFlags;
    }
    /**
     * Aggregates the transform flags for the subtree of a node.
     */
    function aggregateTransformFlagsForSubtree(node) {
        // We do not transform ambient declarations or types, so there is no need to
        // recursively aggregate transform flags.
        if (ts.hasModifier(node, ts.ModifierFlags.Ambient) || (ts.isTypeNode(node) && node.kind !== ts.SyntaxKind.ExpressionWithTypeArguments)) {
            return 0 /* None */;
        }
        // Aggregate the transform flags of each child.
        return reduceEachChild(node, 0 /* None */, aggregateTransformFlagsForChildNode, aggregateTransformFlagsForChildNodes);
    }
    /**
     * Aggregates the TransformFlags of a child node with the TransformFlags of its
     * siblings.
     */
    function aggregateTransformFlagsForChildNode(transformFlags, node) {
        return transformFlags | aggregateTransformFlagsForNode(node);
    }
    function aggregateTransformFlagsForChildNodes(transformFlags, nodes) {
        return transformFlags | aggregateTransformFlagsForNodeArray(nodes);
    }
    let Debug;
    (function (Debug) {
        let isDebugInfoEnabled = false;
        function failBadSyntaxKind(node, message) {
            return Debug.fail(`${message || "Unexpected node."}\r\nNode ${ts.formatSyntaxKind(node.kind)} was unexpected.`, failBadSyntaxKind);
        }
        Debug.failBadSyntaxKind = failBadSyntaxKind;
        Debug.assertEachNode = Debug.shouldAssert(1 /* Normal */)
            ? (nodes, test, message) => Debug.assert(test === undefined || ts.every(nodes, test), message || "Unexpected node.", () => `Node array did not pass test '${Debug.getFunctionName(test)}'.`, Debug.assertEachNode)
            : ts.noop;
        Debug.assertNode = Debug.shouldAssert(1 /* Normal */)
            ? (node, test, message) => Debug.assert(test === undefined || test(node), message || "Unexpected node.", () => `Node ${ts.formatSyntaxKind(node.kind)} did not pass test '${Debug.getFunctionName(test)}'.`, Debug.assertNode)
            : ts.noop;
        Debug.assertOptionalNode = Debug.shouldAssert(1 /* Normal */)
            ? (node, test, message) => Debug.assert(test === undefined || node === undefined || test(node), message || "Unexpected node.", () => `Node ${ts.formatSyntaxKind(node.kind)} did not pass test '${Debug.getFunctionName(test)}'.`, Debug.assertOptionalNode)
            : ts.noop;
        Debug.assertOptionalToken = Debug.shouldAssert(1 /* Normal */)
            ? (node, kind, message) => Debug.assert(kind === undefined || node === undefined || node.kind === kind, message || "Unexpected node.", () => `Node ${ts.formatSyntaxKind(node.kind)} was not a '${ts.formatSyntaxKind(kind)}' token.`, Debug.assertOptionalToken)
            : ts.noop;
        Debug.assertMissingNode = Debug.shouldAssert(1 /* Normal */)
            ? (node, message) => Debug.assert(node === undefined, message || "Unexpected node.", () => `Node ${ts.formatSyntaxKind(node.kind)} was unexpected'.`, Debug.assertMissingNode)
            : ts.noop;
        /**
         * Injects debug information into frequently used types.
         */
        function enableDebugInfo() {
            if (isDebugInfoEnabled)
                return;
            // Add additional properties in debug mode to assist with debugging.
            Object.defineProperties(ts.objectAllocator.getSymbolConstructor().prototype, {
                __debugFlags: { get() { return ts.formatSymbolFlags(this.flags); } }
            });
            Object.defineProperties(ts.objectAllocator.getTypeConstructor().prototype, {
                __debugFlags: { get() { return ts.formatTypeFlags(this.flags); } },
                __debugObjectFlags: { get() { return this.flags & ts.TypeFlags.Object ? ts.formatObjectFlags(this.objectFlags) : ""; } },
                __debugTypeToString: { value() { return this.checker.typeToString(this); } },
            });
            const nodeConstructors = [
                ts.objectAllocator.getNodeConstructor(),
                ts.objectAllocator.getIdentifierConstructor(),
                ts.objectAllocator.getTokenConstructor(),
                ts.objectAllocator.getSourceFileConstructor()
            ];
            for (const ctor of nodeConstructors) {
                if (!ctor.prototype.hasOwnProperty("__debugKind")) {
                    Object.defineProperties(ctor.prototype, {
                        __debugKind: { get() { return ts.formatSyntaxKind(this.kind); } },
                        __debugModifierFlags: { get() { return ts.formatModifierFlags(ts.getModifierFlagsNoCache(this)); } },
                        __debugTransformFlags: { get() { return ts.formatTransformFlags(this.transformFlags); } },
                        __debugEmitFlags: { get() { return ts.formatEmitFlags(ts.getEmitFlags(this)); } },
                        __debugGetText: {
                            value(includeTrivia) {
                                if (ts.nodeIsSynthesized(this))
                                    return "";
                                const parseNode = ts.getParseTreeNode(this);
                                const sourceFile = parseNode && ts.getSourceFileOfNode(parseNode);
                                return sourceFile ? ts.getSourceTextOfNodeFromSourceFile(sourceFile, parseNode, includeTrivia) : "";
                            }
                        }
                    });
                }
            }
            isDebugInfoEnabled = true;
        }
        Debug.enableDebugInfo = enableDebugInfo;
    })(Debug = ts.Debug || (ts.Debug = {}));
})(ts || (ts = {}));
