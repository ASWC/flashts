/*@internal*/
var ts;
(function (ts) {
    function transformESNext(context) {
        const { resumeLexicalEnvironment, endLexicalEnvironment, hoistVariableDeclaration } = context;
        const resolver = context.getEmitResolver();
        const compilerOptions = context.getCompilerOptions();
        const languageVersion = ts.getEmitScriptTarget(compilerOptions);
        const previousOnEmitNode = context.onEmitNode;
        context.onEmitNode = onEmitNode;
        const previousOnSubstituteNode = context.onSubstituteNode;
        context.onSubstituteNode = onSubstituteNode;
        let enabledSubstitutions;
        let enclosingFunctionFlags;
        let enclosingSuperContainerFlags = 0;
        return transformSourceFile;
        function transformSourceFile(node) {
            if (node.isDeclarationFile) {
                return node;
            }
            const visited = ts.visitEachChild(node, visitor, context);
            ts.addEmitHelpers(visited, context.readEmitHelpers());
            return visited;
        }
        function visitor(node) {
            return visitorWorker(node, /*noDestructuringValue*/ false);
        }
        function visitorNoDestructuringValue(node) {
            return visitorWorker(node, /*noDestructuringValue*/ true);
        }
        function visitorNoAsyncModifier(node) {
            if (node.kind === ts.SyntaxKind.AsyncKeyword) {
                return undefined;
            }
            return node;
        }
        function visitorWorker(node, noDestructuringValue) {
            if ((node.transformFlags & 8 /* ContainsESNext */) === 0) {
                return node;
            }
            switch (node.kind) {
                case ts.SyntaxKind.AwaitExpression:
                    return visitAwaitExpression(node);
                case ts.SyntaxKind.YieldExpression:
                    return visitYieldExpression(node);
                case ts.SyntaxKind.LabeledStatement:
                    return visitLabeledStatement(node);
                case ts.SyntaxKind.ObjectLiteralExpression:
                    return visitObjectLiteralExpression(node);
                case ts.SyntaxKind.BinaryExpression:
                    return visitBinaryExpression(node, noDestructuringValue);
                case ts.SyntaxKind.VariableDeclaration:
                    return visitVariableDeclaration(node);
                case ts.SyntaxKind.ForOfStatement:
                    return visitForOfStatement(node, /*outermostLabeledStatement*/ undefined);
                case ts.SyntaxKind.ForStatement:
                    return visitForStatement(node);
                case ts.SyntaxKind.VoidExpression:
                    return visitVoidExpression(node);
                case ts.SyntaxKind.Constructor:
                    return visitConstructorDeclaration(node);
                case ts.SyntaxKind.MethodDeclaration:
                    return visitMethodDeclaration(node);
                case ts.SyntaxKind.GetAccessor:
                    return visitGetAccessorDeclaration(node);
                case ts.SyntaxKind.SetAccessor:
                    return visitSetAccessorDeclaration(node);
                case ts.SyntaxKind.FunctionDeclaration:
                    return visitFunctionDeclaration(node);
                case ts.SyntaxKind.FunctionExpression:
                    return visitFunctionExpression(node);
                case ts.SyntaxKind.ArrowFunction:
                    return visitArrowFunction(node);
                case ts.SyntaxKind.Parameter:
                    return visitParameter(node);
                case ts.SyntaxKind.ExpressionStatement:
                    return visitExpressionStatement(node);
                case ts.SyntaxKind.ParenthesizedExpression:
                    return visitParenthesizedExpression(node, noDestructuringValue);
                case ts.SyntaxKind.CatchClause:
                    return visitCatchClause(node);
                default:
                    return ts.visitEachChild(node, visitor, context);
            }
        }
        function visitAwaitExpression(node) {
            if (enclosingFunctionFlags & 2 /* Async */ && enclosingFunctionFlags & 1 /* Generator */) {
                return ts.setOriginalNode(ts.setTextRange(ts.createYield(createAwaitHelper(context, ts.visitNode(node.expression, visitor, ts.isExpression))), 
                /*location*/ node), node);
            }
            return ts.visitEachChild(node, visitor, context);
        }
        function visitYieldExpression(node) {
            if (enclosingFunctionFlags & 2 /* Async */ && enclosingFunctionFlags & 1 /* Generator */ && node.asteriskToken) {
                const expression = ts.visitNode(node.expression, visitor, ts.isExpression);
                return ts.setOriginalNode(ts.setTextRange(ts.createYield(createAwaitHelper(context, ts.updateYield(node, node.asteriskToken, createAsyncDelegatorHelper(context, createAsyncValuesHelper(context, expression, expression), expression)))), node), node);
            }
            return ts.visitEachChild(node, visitor, context);
        }
        function visitLabeledStatement(node) {
            if (enclosingFunctionFlags & 2 /* Async */) {
                const statement = ts.unwrapInnermostStatementOfLabel(node);
                if (statement.kind === ts.SyntaxKind.ForOfStatement && statement.awaitModifier) {
                    return visitForOfStatement(statement, node);
                }
                return ts.restoreEnclosingLabel(ts.visitEachChild(statement, visitor, context), node);
            }
            return ts.visitEachChild(node, visitor, context);
        }
        function chunkObjectLiteralElements(elements) {
            let chunkObject;
            const objects = [];
            for (const e of elements) {
                if (e.kind === ts.SyntaxKind.SpreadAssignment) {
                    if (chunkObject) {
                        objects.push(ts.createObjectLiteral(chunkObject));
                        chunkObject = undefined;
                    }
                    const target = e.expression;
                    objects.push(ts.visitNode(target, visitor, ts.isExpression));
                }
                else {
                    chunkObject = ts.append(chunkObject, e.kind === ts.SyntaxKind.PropertyAssignment
                        ? ts.createPropertyAssignment(e.name, ts.visitNode(e.initializer, visitor, ts.isExpression))
                        : ts.visitNode(e, visitor, ts.isObjectLiteralElementLike));
                }
            }
            if (chunkObject) {
                objects.push(ts.createObjectLiteral(chunkObject));
            }
            return objects;
        }
        function visitObjectLiteralExpression(node) {
            if (node.transformFlags & 1048576 /* ContainsObjectSpread */) {
                // spread elements emit like so:
                // non-spread elements are chunked together into object literals, and then all are passed to __assign:
                //     { a, ...o, b } => __assign({a}, o, {b});
                // If the first element is a spread element, then the first argument to __assign is {}:
                //     { ...o, a, b, ...o2 } => __assign({}, o, {a, b}, o2)
                const objects = chunkObjectLiteralElements(node.properties);
                if (objects.length && objects[0].kind !== ts.SyntaxKind.ObjectLiteralExpression) {
                    objects.unshift(ts.createObjectLiteral());
                }
                return createAssignHelper(context, objects);
            }
            return ts.visitEachChild(node, visitor, context);
        }
        function visitExpressionStatement(node) {
            return ts.visitEachChild(node, visitorNoDestructuringValue, context);
        }
        function visitParenthesizedExpression(node, noDestructuringValue) {
            return ts.visitEachChild(node, noDestructuringValue ? visitorNoDestructuringValue : visitor, context);
        }
        function visitCatchClause(node) {
            if (!node.variableDeclaration) {
                return ts.updateCatchClause(node, ts.createVariableDeclaration(ts.createTempVariable(/*recordTempVariable*/ undefined)), ts.visitNode(node.block, visitor, ts.isBlock));
            }
            return ts.visitEachChild(node, visitor, context);
        }
        /**
         * Visits a BinaryExpression that contains a destructuring assignment.
         *
         * @param node A BinaryExpression node.
         */
        function visitBinaryExpression(node, noDestructuringValue) {
            if (ts.isDestructuringAssignment(node) && node.left.transformFlags & 1048576 /* ContainsObjectRest */) {
                return ts.flattenDestructuringAssignment(node, visitor, context, 1 /* ObjectRest */, !noDestructuringValue);
            }
            else if (node.operatorToken.kind === ts.SyntaxKind.CommaToken) {
                return ts.updateBinary(node, ts.visitNode(node.left, visitorNoDestructuringValue, ts.isExpression), ts.visitNode(node.right, noDestructuringValue ? visitorNoDestructuringValue : visitor, ts.isExpression));
            }
            return ts.visitEachChild(node, visitor, context);
        }
        /**
         * Visits a VariableDeclaration node with a binding pattern.
         *
         * @param node A VariableDeclaration node.
         */
        function visitVariableDeclaration(node) {
            // If we are here it is because the name contains a binding pattern with a rest somewhere in it.
            if (ts.isBindingPattern(node.name) && node.name.transformFlags & 1048576 /* ContainsObjectRest */) {
                return ts.flattenDestructuringBinding(node, visitor, context, 1 /* ObjectRest */);
            }
            return ts.visitEachChild(node, visitor, context);
        }
        function visitForStatement(node) {
            return ts.updateFor(node, ts.visitNode(node.initializer, visitorNoDestructuringValue, ts.isForInitializer), ts.visitNode(node.condition, visitor, ts.isExpression), ts.visitNode(node.incrementor, visitor, ts.isExpression), ts.visitNode(node.statement, visitor, ts.isStatement));
        }
        function visitVoidExpression(node) {
            return ts.visitEachChild(node, visitorNoDestructuringValue, context);
        }
        /**
         * Visits a ForOfStatement and converts it into a ES2015-compatible ForOfStatement.
         *
         * @param node A ForOfStatement.
         */
        function visitForOfStatement(node, outermostLabeledStatement) {
            if (node.initializer.transformFlags & 1048576 /* ContainsObjectRest */) {
                node = transformForOfStatementWithObjectRest(node);
            }
            if (node.awaitModifier) {
                return transformForAwaitOfStatement(node, outermostLabeledStatement);
            }
            else {
                return ts.restoreEnclosingLabel(ts.visitEachChild(node, visitor, context), outermostLabeledStatement);
            }
        }
        function transformForOfStatementWithObjectRest(node) {
            const initializerWithoutParens = ts.skipParentheses(node.initializer);
            if (ts.isVariableDeclarationList(initializerWithoutParens) || ts.isAssignmentPattern(initializerWithoutParens)) {
                let bodyLocation;
                let statementsLocation;
                const temp = ts.createTempVariable(/*recordTempVariable*/ undefined);
                const statements = [ts.createForOfBindingStatement(initializerWithoutParens, temp)];
                if (ts.isBlock(node.statement)) {
                    ts.addRange(statements, node.statement.statements);
                    bodyLocation = node.statement;
                    statementsLocation = node.statement.statements;
                }
                else if (node.statement) {
                    ts.append(statements, node.statement);
                    bodyLocation = node.statement;
                    statementsLocation = node.statement;
                }
                return ts.updateForOf(node, node.awaitModifier, ts.setTextRange(ts.createVariableDeclarationList([
                    ts.setTextRange(ts.createVariableDeclaration(temp), node.initializer)
                ], ts.NodeFlags.Let), node.initializer), node.expression, ts.setTextRange(ts.createBlock(ts.setTextRange(ts.createNodeArray(statements), statementsLocation), 
                /*multiLine*/ true), bodyLocation));
            }
            return node;
        }
        function convertForOfStatementHead(node, boundValue) {
            const binding = ts.createForOfBindingStatement(node.initializer, boundValue);
            let bodyLocation;
            let statementsLocation;
            const statements = [ts.visitNode(binding, visitor, ts.isStatement)];
            const statement = ts.visitNode(node.statement, visitor, ts.isStatement);
            if (ts.isBlock(statement)) {
                ts.addRange(statements, statement.statements);
                bodyLocation = statement;
                statementsLocation = statement.statements;
            }
            else {
                statements.push(statement);
            }
            return ts.setEmitFlags(ts.setTextRange(ts.createBlock(ts.setTextRange(ts.createNodeArray(statements), statementsLocation), 
            /*multiLine*/ true), bodyLocation), ts.EmitFlags.NoSourceMap | ts.EmitFlags.NoTokenSourceMaps);
        }
        function createDownlevelAwait(expression) {
            return enclosingFunctionFlags & 1 /* Generator */
                ? ts.createYield(/*asteriskToken*/ undefined, createAwaitHelper(context, expression))
                : ts.createAwait(expression);
        }
        function transformForAwaitOfStatement(node, outermostLabeledStatement) {
            const expression = ts.visitNode(node.expression, visitor, ts.isExpression);
            const iterator = ts.isIdentifier(expression) ? ts.getGeneratedNameForNode(expression) : ts.createTempVariable(/*recordTempVariable*/ undefined);
            const result = ts.isIdentifier(expression) ? ts.getGeneratedNameForNode(iterator) : ts.createTempVariable(/*recordTempVariable*/ undefined);
            const errorRecord = ts.createUniqueName("e");
            const catchVariable = ts.getGeneratedNameForNode(errorRecord);
            const returnMethod = ts.createTempVariable(/*recordTempVariable*/ undefined);
            const callValues = createAsyncValuesHelper(context, expression, /*location*/ node.expression);
            const callNext = ts.createCall(ts.createPropertyAccess(iterator, "next"), /*typeArguments*/ undefined, []);
            const getDone = ts.createPropertyAccess(result, "done");
            const getValue = ts.createPropertyAccess(result, "value");
            const callReturn = ts.createFunctionCall(returnMethod, iterator, []);
            hoistVariableDeclaration(errorRecord);
            hoistVariableDeclaration(returnMethod);
            const forStatement = ts.setEmitFlags(ts.setTextRange(ts.createFor(
            /*initializer*/ ts.setEmitFlags(ts.setTextRange(ts.createVariableDeclarationList([
                ts.setTextRange(ts.createVariableDeclaration(iterator, /*type*/ undefined, callValues), node.expression),
                ts.createVariableDeclaration(result)
            ]), node.expression), ts.EmitFlags.NoHoisting), 
            /*condition*/ ts.createComma(ts.createAssignment(result, createDownlevelAwait(callNext)), ts.createLogicalNot(getDone)), 
            /*incrementor*/ undefined, 
            /*statement*/ convertForOfStatementHead(node, createDownlevelAwait(getValue))), 
            /*location*/ node), ts.EmitFlags.NoTokenTrailingSourceMaps);
            return ts.createTry(ts.createBlock([
                ts.restoreEnclosingLabel(forStatement, outermostLabeledStatement)
            ]), ts.createCatchClause(ts.createVariableDeclaration(catchVariable), ts.setEmitFlags(ts.createBlock([
                ts.createStatement(ts.createAssignment(errorRecord, ts.createObjectLiteral([
                    ts.createPropertyAssignment("error", catchVariable)
                ])))
            ]), ts.EmitFlags.SingleLine)), ts.createBlock([
                ts.createTry(
                /*tryBlock*/ ts.createBlock([
                    ts.setEmitFlags(ts.createIf(ts.createLogicalAnd(ts.createLogicalAnd(result, ts.createLogicalNot(getDone)), ts.createAssignment(returnMethod, ts.createPropertyAccess(iterator, "return"))), ts.createStatement(createDownlevelAwait(callReturn))), ts.EmitFlags.SingleLine)
                ]), 
                /*catchClause*/ undefined, 
                /*finallyBlock*/ ts.setEmitFlags(ts.createBlock([
                    ts.setEmitFlags(ts.createIf(errorRecord, ts.createThrow(ts.createPropertyAccess(errorRecord, "error"))), ts.EmitFlags.SingleLine)
                ]), ts.EmitFlags.SingleLine))
            ]));
        }
        function visitParameter(node) {
            if (node.transformFlags & 1048576 /* ContainsObjectRest */) {
                // Binding patterns are converted into a generated name and are
                // evaluated inside the function body.
                return ts.updateParameter(node, 
                /*decorators*/ undefined, 
                /*modifiers*/ undefined, node.dotDotDotToken, ts.getGeneratedNameForNode(node), 
                /*questionToken*/ undefined, 
                /*type*/ undefined, ts.visitNode(node.initializer, visitor, ts.isExpression));
            }
            return ts.visitEachChild(node, visitor, context);
        }
        function visitConstructorDeclaration(node) {
            const savedEnclosingFunctionFlags = enclosingFunctionFlags;
            enclosingFunctionFlags = 0 /* Normal */;
            const updated = ts.updateConstructor(node, 
            /*decorators*/ undefined, node.modifiers, ts.visitParameterList(node.parameters, visitor, context), transformFunctionBody(node));
            enclosingFunctionFlags = savedEnclosingFunctionFlags;
            return updated;
        }
        function visitGetAccessorDeclaration(node) {
            const savedEnclosingFunctionFlags = enclosingFunctionFlags;
            enclosingFunctionFlags = 0 /* Normal */;
            const updated = ts.updateGetAccessor(node, 
            /*decorators*/ undefined, node.modifiers, ts.visitNode(node.name, visitor, ts.isPropertyName), ts.visitParameterList(node.parameters, visitor, context), 
            /*type*/ undefined, transformFunctionBody(node));
            enclosingFunctionFlags = savedEnclosingFunctionFlags;
            return updated;
        }
        function visitSetAccessorDeclaration(node) {
            const savedEnclosingFunctionFlags = enclosingFunctionFlags;
            enclosingFunctionFlags = 0 /* Normal */;
            const updated = ts.updateSetAccessor(node, 
            /*decorators*/ undefined, node.modifiers, ts.visitNode(node.name, visitor, ts.isPropertyName), ts.visitParameterList(node.parameters, visitor, context), transformFunctionBody(node));
            enclosingFunctionFlags = savedEnclosingFunctionFlags;
            return updated;
        }
        function visitMethodDeclaration(node) {
            const savedEnclosingFunctionFlags = enclosingFunctionFlags;
            enclosingFunctionFlags = ts.getFunctionFlags(node);
            const updated = ts.updateMethod(node, 
            /*decorators*/ undefined, enclosingFunctionFlags & 1 /* Generator */
                ? ts.visitNodes(node.modifiers, visitorNoAsyncModifier, ts.isModifier)
                : node.modifiers, enclosingFunctionFlags & 2 /* Async */
                ? undefined
                : node.asteriskToken, ts.visitNode(node.name, visitor, ts.isPropertyName), ts.visitNode(/*questionToken*/ undefined, visitor, ts.isToken), 
            /*typeParameters*/ undefined, ts.visitParameterList(node.parameters, visitor, context), 
            /*type*/ undefined, enclosingFunctionFlags & 2 /* Async */ && enclosingFunctionFlags & 1 /* Generator */
                ? transformAsyncGeneratorFunctionBody(node)
                : transformFunctionBody(node));
            enclosingFunctionFlags = savedEnclosingFunctionFlags;
            return updated;
        }
        function visitFunctionDeclaration(node) {
            const savedEnclosingFunctionFlags = enclosingFunctionFlags;
            enclosingFunctionFlags = ts.getFunctionFlags(node);
            const updated = ts.updateFunctionDeclaration(node, 
            /*decorators*/ undefined, enclosingFunctionFlags & 1 /* Generator */
                ? ts.visitNodes(node.modifiers, visitorNoAsyncModifier, ts.isModifier)
                : node.modifiers, enclosingFunctionFlags & 2 /* Async */
                ? undefined
                : node.asteriskToken, node.name, 
            /*typeParameters*/ undefined, ts.visitParameterList(node.parameters, visitor, context), 
            /*type*/ undefined, enclosingFunctionFlags & 2 /* Async */ && enclosingFunctionFlags & 1 /* Generator */
                ? transformAsyncGeneratorFunctionBody(node)
                : transformFunctionBody(node));
            enclosingFunctionFlags = savedEnclosingFunctionFlags;
            return updated;
        }
        function visitArrowFunction(node) {
            const savedEnclosingFunctionFlags = enclosingFunctionFlags;
            enclosingFunctionFlags = ts.getFunctionFlags(node);
            const updated = ts.updateArrowFunction(node, node.modifiers, 
            /*typeParameters*/ undefined, ts.visitParameterList(node.parameters, visitor, context), 
            /*type*/ undefined, node.equalsGreaterThanToken, transformFunctionBody(node));
            enclosingFunctionFlags = savedEnclosingFunctionFlags;
            return updated;
        }
        function visitFunctionExpression(node) {
            const savedEnclosingFunctionFlags = enclosingFunctionFlags;
            enclosingFunctionFlags = ts.getFunctionFlags(node);
            const updated = ts.updateFunctionExpression(node, enclosingFunctionFlags & 1 /* Generator */
                ? ts.visitNodes(node.modifiers, visitorNoAsyncModifier, ts.isModifier)
                : node.modifiers, enclosingFunctionFlags & 2 /* Async */
                ? undefined
                : node.asteriskToken, node.name, 
            /*typeParameters*/ undefined, ts.visitParameterList(node.parameters, visitor, context), 
            /*type*/ undefined, enclosingFunctionFlags & 2 /* Async */ && enclosingFunctionFlags & 1 /* Generator */
                ? transformAsyncGeneratorFunctionBody(node)
                : transformFunctionBody(node));
            enclosingFunctionFlags = savedEnclosingFunctionFlags;
            return updated;
        }
        function transformAsyncGeneratorFunctionBody(node) {
            resumeLexicalEnvironment();
            const statements = [];
            const statementOffset = ts.addPrologue(statements, node.body.statements, /*ensureUseStrict*/ false, visitor);
            appendObjectRestAssignmentsIfNeeded(statements, node);
            statements.push(ts.createReturn(createAsyncGeneratorHelper(context, ts.createFunctionExpression(
            /*modifiers*/ undefined, ts.createToken(ts.SyntaxKind.AsteriskToken), node.name && ts.getGeneratedNameForNode(node.name), 
            /*typeParameters*/ undefined, 
            /*parameters*/ [], 
            /*type*/ undefined, ts.updateBlock(node.body, ts.visitLexicalEnvironment(node.body.statements, visitor, context, statementOffset))))));
            ts.addRange(statements, endLexicalEnvironment());
            const block = ts.updateBlock(node.body, statements);
            // Minor optimization, emit `_super` helper to capture `super` access in an arrow.
            // This step isn't needed if we eventually transform this to ES5.
            if (languageVersion >= ts.ScriptTarget.ES2015) {
                if (resolver.getNodeCheckFlags(node) & 4096 /* AsyncMethodWithSuperBinding */) {
                    enableSubstitutionForAsyncMethodsWithSuper();
                    ts.addEmitHelper(block, ts.advancedAsyncSuperHelper);
                }
                else if (resolver.getNodeCheckFlags(node) & 2048 /* AsyncMethodWithSuper */) {
                    enableSubstitutionForAsyncMethodsWithSuper();
                    ts.addEmitHelper(block, ts.asyncSuperHelper);
                }
            }
            return block;
        }
        function transformFunctionBody(node) {
            resumeLexicalEnvironment();
            let statementOffset = 0;
            const statements = [];
            const body = ts.visitNode(node.body, visitor, ts.isConciseBody);
            if (ts.isBlock(body)) {
                statementOffset = ts.addPrologue(statements, body.statements, /*ensureUseStrict*/ false, visitor);
            }
            ts.addRange(statements, appendObjectRestAssignmentsIfNeeded(/*statements*/ undefined, node));
            const trailingStatements = endLexicalEnvironment();
            if (statementOffset > 0 || ts.some(statements) || ts.some(trailingStatements)) {
                const block = ts.convertToFunctionBody(body, /*multiLine*/ true);
                ts.addRange(statements, block.statements.slice(statementOffset));
                ts.addRange(statements, trailingStatements);
                return ts.updateBlock(block, ts.setTextRange(ts.createNodeArray(statements), block.statements));
            }
            return body;
        }
        function appendObjectRestAssignmentsIfNeeded(statements, node) {
            for (const parameter of node.parameters) {
                if (parameter.transformFlags & 1048576 /* ContainsObjectRest */) {
                    const temp = ts.getGeneratedNameForNode(parameter);
                    const declarations = ts.flattenDestructuringBinding(parameter, visitor, context, 1 /* ObjectRest */, temp, 
                    /*doNotRecordTempVariablesInLine*/ false, 
                    /*skipInitializer*/ true);
                    if (ts.some(declarations)) {
                        const statement = ts.createVariableStatement(
                        /*modifiers*/ undefined, ts.createVariableDeclarationList(declarations));
                        ts.setEmitFlags(statement, ts.EmitFlags.CustomPrologue);
                        statements = ts.append(statements, statement);
                    }
                }
            }
            return statements;
        }
        function enableSubstitutionForAsyncMethodsWithSuper() {
            if ((enabledSubstitutions & 1 /* AsyncMethodsWithSuper */) === 0) {
                enabledSubstitutions |= 1 /* AsyncMethodsWithSuper */;
                // We need to enable substitutions for call, property access, and element access
                // if we need to rewrite super calls.
                context.enableSubstitution(ts.SyntaxKind.CallExpression);
                context.enableSubstitution(ts.SyntaxKind.PropertyAccessExpression);
                context.enableSubstitution(ts.SyntaxKind.ElementAccessExpression);
                // We need to be notified when entering and exiting declarations that bind super.
                context.enableEmitNotification(ts.SyntaxKind.ClassDeclaration);
                context.enableEmitNotification(ts.SyntaxKind.MethodDeclaration);
                context.enableEmitNotification(ts.SyntaxKind.GetAccessor);
                context.enableEmitNotification(ts.SyntaxKind.SetAccessor);
                context.enableEmitNotification(ts.SyntaxKind.Constructor);
            }
        }
        /**
         * Called by the printer just before a node is printed.
         *
         * @param hint A hint as to the intended usage of the node.
         * @param node The node to be printed.
         * @param emitCallback The callback used to emit the node.
         */
        function onEmitNode(hint, node, emitCallback) {
            // If we need to support substitutions for `super` in an async method,
            // we should track it here.
            if (enabledSubstitutions & 1 /* AsyncMethodsWithSuper */ && isSuperContainer(node)) {
                const superContainerFlags = resolver.getNodeCheckFlags(node) & (2048 /* AsyncMethodWithSuper */ | 4096 /* AsyncMethodWithSuperBinding */);
                if (superContainerFlags !== enclosingSuperContainerFlags) {
                    const savedEnclosingSuperContainerFlags = enclosingSuperContainerFlags;
                    enclosingSuperContainerFlags = superContainerFlags;
                    previousOnEmitNode(hint, node, emitCallback);
                    enclosingSuperContainerFlags = savedEnclosingSuperContainerFlags;
                    return;
                }
            }
            previousOnEmitNode(hint, node, emitCallback);
        }
        /**
         * Hooks node substitutions.
         *
         * @param hint The context for the emitter.
         * @param node The node to substitute.
         */
        function onSubstituteNode(hint, node) {
            node = previousOnSubstituteNode(hint, node);
            if (hint === ts.EmitHint.Expression && enclosingSuperContainerFlags) {
                return substituteExpression(node);
            }
            return node;
        }
        function substituteExpression(node) {
            switch (node.kind) {
                case ts.SyntaxKind.PropertyAccessExpression:
                    return substitutePropertyAccessExpression(node);
                case ts.SyntaxKind.ElementAccessExpression:
                    return substituteElementAccessExpression(node);
                case ts.SyntaxKind.CallExpression:
                    return substituteCallExpression(node);
            }
            return node;
        }
        function substitutePropertyAccessExpression(node) {
            if (node.expression.kind === ts.SyntaxKind.SuperKeyword) {
                return createSuperAccessInAsyncMethod(ts.createLiteral(ts.idText(node.name)), node);
            }
            return node;
        }
        function substituteElementAccessExpression(node) {
            if (node.expression.kind === ts.SyntaxKind.SuperKeyword) {
                return createSuperAccessInAsyncMethod(node.argumentExpression, node);
            }
            return node;
        }
        function substituteCallExpression(node) {
            const expression = node.expression;
            if (ts.isSuperProperty(expression)) {
                const argumentExpression = ts.isPropertyAccessExpression(expression)
                    ? substitutePropertyAccessExpression(expression)
                    : substituteElementAccessExpression(expression);
                return ts.createCall(ts.createPropertyAccess(argumentExpression, "call"), 
                /*typeArguments*/ undefined, [
                    ts.createThis(),
                    ...node.arguments
                ]);
            }
            return node;
        }
        function isSuperContainer(node) {
            const kind = node.kind;
            return kind === ts.SyntaxKind.ClassDeclaration
                || kind === ts.SyntaxKind.Constructor
                || kind === ts.SyntaxKind.MethodDeclaration
                || kind === ts.SyntaxKind.GetAccessor
                || kind === ts.SyntaxKind.SetAccessor;
        }
        function createSuperAccessInAsyncMethod(argumentExpression, location) {
            if (enclosingSuperContainerFlags & 4096 /* AsyncMethodWithSuperBinding */) {
                return ts.setTextRange(ts.createPropertyAccess(ts.createCall(ts.createIdentifier("_super"), 
                /*typeArguments*/ undefined, [argumentExpression]), "value"), location);
            }
            else {
                return ts.setTextRange(ts.createCall(ts.createIdentifier("_super"), 
                /*typeArguments*/ undefined, [argumentExpression]), location);
            }
        }
    }
    ts.transformESNext = transformESNext;
    const assignHelper = {
        name: "typescript:assign",
        scoped: false,
        priority: 1,
        text: `
            var __assign = (this && this.__assign) || Object.assign || function(t) {
                for (var s, i = 1, n = arguments.length; i < n; i++) {
                    s = arguments[i];
                    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                        t[p] = s[p];
                }
                return t;
            };`
    };
    function createAssignHelper(context, attributesSegments) {
        if (context.getCompilerOptions().target >= ts.ScriptTarget.ES2015) {
            return ts.createCall(ts.createPropertyAccess(ts.createIdentifier("Object"), "assign"), 
            /*typeArguments*/ undefined, attributesSegments);
        }
        context.requestEmitHelper(assignHelper);
        return ts.createCall(ts.getHelperName("__assign"), 
        /*typeArguments*/ undefined, attributesSegments);
    }
    ts.createAssignHelper = createAssignHelper;
    const awaitHelper = {
        name: "typescript:await",
        scoped: false,
        text: `
            var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }`
    };
    function createAwaitHelper(context, expression) {
        context.requestEmitHelper(awaitHelper);
        return ts.createCall(ts.getHelperName("__await"), /*typeArguments*/ undefined, [expression]);
    }
    const asyncGeneratorHelper = {
        name: "typescript:asyncGenerator",
        scoped: false,
        text: `
            var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
                if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
                var g = generator.apply(thisArg, _arguments || []), i, q = [];
                return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
                function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
                function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
                function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r);  }
                function fulfill(value) { resume("next", value); }
                function reject(value) { resume("throw", value); }
                function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
            };`
    };
    function createAsyncGeneratorHelper(context, generatorFunc) {
        context.requestEmitHelper(awaitHelper);
        context.requestEmitHelper(asyncGeneratorHelper);
        // Mark this node as originally an async function
        (generatorFunc.emitNode || (generatorFunc.emitNode = {})).flags |= ts.EmitFlags.AsyncFunctionBody;
        return ts.createCall(ts.getHelperName("__asyncGenerator"), 
        /*typeArguments*/ undefined, [
            ts.createThis(),
            ts.createIdentifier("arguments"),
            generatorFunc
        ]);
    }
    const asyncDelegator = {
        name: "typescript:asyncDelegator",
        scoped: false,
        text: `
            var __asyncDelegator = (this && this.__asyncDelegator) || function (o) {
                var i, p;
                return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
                function verb(n, f) { if (o[n]) i[n] = function (v) { return (p = !p) ? { value: __await(o[n](v)), done: n === "return" } : f ? f(v) : v; }; }
            };`
    };
    function createAsyncDelegatorHelper(context, expression, location) {
        context.requestEmitHelper(awaitHelper);
        context.requestEmitHelper(asyncDelegator);
        return ts.setTextRange(ts.createCall(ts.getHelperName("__asyncDelegator"), 
        /*typeArguments*/ undefined, [expression]), location);
    }
    const asyncValues = {
        name: "typescript:asyncValues",
        scoped: false,
        text: `
            var __asyncValues = (this && this.__asyncValues) || function (o) {
                if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
                var m = o[Symbol.asyncIterator];
                return m ? m.call(o) : typeof __values === "function" ? __values(o) : o[Symbol.iterator]();
            };`
    };
    function createAsyncValuesHelper(context, expression, location) {
        context.requestEmitHelper(asyncValues);
        return ts.setTextRange(ts.createCall(ts.getHelperName("__asyncValues"), 
        /*typeArguments*/ undefined, [expression]), location);
    }
})(ts || (ts = {}));
