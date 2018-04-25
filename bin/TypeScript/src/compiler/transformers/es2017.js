/*@internal*/
var ts;
(function (ts) {
    function transformES2017(context) {
        const { resumeLexicalEnvironment, endLexicalEnvironment, hoistVariableDeclaration } = context;
        const resolver = context.getEmitResolver();
        const compilerOptions = context.getCompilerOptions();
        const languageVersion = ts.getEmitScriptTarget(compilerOptions);
        /**
         * Keeps track of whether expression substitution has been enabled for specific edge cases.
         * They are persisted between each SourceFile transformation and should not be reset.
         */
        let enabledSubstitutions;
        /**
         * This keeps track of containers where `super` is valid, for use with
         * just-in-time substitution for `super` expressions inside of async methods.
         */
        let enclosingSuperContainerFlags = 0;
        let enclosingFunctionParameterNames;
        // Save the previous transformation hooks.
        const previousOnEmitNode = context.onEmitNode;
        const previousOnSubstituteNode = context.onSubstituteNode;
        // Set new transformation hooks.
        context.onEmitNode = onEmitNode;
        context.onSubstituteNode = onSubstituteNode;
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
            if ((node.transformFlags & 16 /* ContainsES2017 */) === 0) {
                return node;
            }
            switch (node.kind) {
                case ts.SyntaxKind.AsyncKeyword:
                    // ES2017 async modifier should be elided for targets < ES2017
                    return undefined;
                case ts.SyntaxKind.AwaitExpression:
                    return visitAwaitExpression(node);
                case ts.SyntaxKind.MethodDeclaration:
                    return visitMethodDeclaration(node);
                case ts.SyntaxKind.FunctionDeclaration:
                    return visitFunctionDeclaration(node);
                case ts.SyntaxKind.FunctionExpression:
                    return visitFunctionExpression(node);
                case ts.SyntaxKind.ArrowFunction:
                    return visitArrowFunction(node);
                default:
                    return ts.visitEachChild(node, visitor, context);
            }
        }
        function asyncBodyVisitor(node) {
            if (ts.isNodeWithPossibleHoistedDeclaration(node)) {
                switch (node.kind) {
                    case ts.SyntaxKind.VariableStatement:
                        return visitVariableStatementInAsyncBody(node);
                    case ts.SyntaxKind.ForStatement:
                        return visitForStatementInAsyncBody(node);
                    case ts.SyntaxKind.ForInStatement:
                        return visitForInStatementInAsyncBody(node);
                    case ts.SyntaxKind.ForOfStatement:
                        return visitForOfStatementInAsyncBody(node);
                    case ts.SyntaxKind.CatchClause:
                        return visitCatchClauseInAsyncBody(node);
                    case ts.SyntaxKind.Block:
                    case ts.SyntaxKind.SwitchStatement:
                    case ts.SyntaxKind.CaseBlock:
                    case ts.SyntaxKind.CaseClause:
                    case ts.SyntaxKind.DefaultClause:
                    case ts.SyntaxKind.TryStatement:
                    case ts.SyntaxKind.DoStatement:
                    case ts.SyntaxKind.WhileStatement:
                    case ts.SyntaxKind.IfStatement:
                    case ts.SyntaxKind.WithStatement:
                    case ts.SyntaxKind.LabeledStatement:
                        return ts.visitEachChild(node, asyncBodyVisitor, context);
                    default:
                        return ts.Debug.assertNever(node, "Unhandled node.");
                }
            }
            return visitor(node);
        }
        function visitCatchClauseInAsyncBody(node) {
            const catchClauseNames = ts.createUnderscoreEscapedMap();
            recordDeclarationName(node.variableDeclaration, catchClauseNames);
            // names declared in a catch variable are block scoped
            let catchClauseUnshadowedNames;
            catchClauseNames.forEach((_, escapedName) => {
                if (enclosingFunctionParameterNames.has(escapedName)) {
                    if (!catchClauseUnshadowedNames) {
                        catchClauseUnshadowedNames = ts.cloneMap(enclosingFunctionParameterNames);
                    }
                    catchClauseUnshadowedNames.delete(escapedName);
                }
            });
            if (catchClauseUnshadowedNames) {
                const savedEnclosingFunctionParameterNames = enclosingFunctionParameterNames;
                enclosingFunctionParameterNames = catchClauseUnshadowedNames;
                const result = ts.visitEachChild(node, asyncBodyVisitor, context);
                enclosingFunctionParameterNames = savedEnclosingFunctionParameterNames;
                return result;
            }
            else {
                return ts.visitEachChild(node, asyncBodyVisitor, context);
            }
        }
        function visitVariableStatementInAsyncBody(node) {
            if (isVariableDeclarationListWithCollidingName(node.declarationList)) {
                const expression = visitVariableDeclarationListWithCollidingNames(node.declarationList, /*hasReceiver*/ false);
                return expression ? ts.createStatement(expression) : undefined;
            }
            return ts.visitEachChild(node, visitor, context);
        }
        function visitForInStatementInAsyncBody(node) {
            return ts.updateForIn(node, isVariableDeclarationListWithCollidingName(node.initializer)
                ? visitVariableDeclarationListWithCollidingNames(node.initializer, /*hasReceiver*/ true)
                : ts.visitNode(node.initializer, visitor, ts.isForInitializer), ts.visitNode(node.expression, visitor, ts.isExpression), ts.visitNode(node.statement, asyncBodyVisitor, ts.isStatement, ts.liftToBlock));
        }
        function visitForOfStatementInAsyncBody(node) {
            return ts.updateForOf(node, ts.visitNode(node.awaitModifier, visitor, ts.isToken), isVariableDeclarationListWithCollidingName(node.initializer)
                ? visitVariableDeclarationListWithCollidingNames(node.initializer, /*hasReceiver*/ true)
                : ts.visitNode(node.initializer, visitor, ts.isForInitializer), ts.visitNode(node.expression, visitor, ts.isExpression), ts.visitNode(node.statement, asyncBodyVisitor, ts.isStatement, ts.liftToBlock));
        }
        function visitForStatementInAsyncBody(node) {
            return ts.updateFor(node, isVariableDeclarationListWithCollidingName(node.initializer)
                ? visitVariableDeclarationListWithCollidingNames(node.initializer, /*hasReceiver*/ false)
                : ts.visitNode(node.initializer, visitor, ts.isForInitializer), ts.visitNode(node.condition, visitor, ts.isExpression), ts.visitNode(node.incrementor, visitor, ts.isExpression), ts.visitNode(node.statement, asyncBodyVisitor, ts.isStatement, ts.liftToBlock));
        }
        /**
         * Visits an AwaitExpression node.
         *
         * This function will be called any time a ES2017 await expression is encountered.
         *
         * @param node The node to visit.
         */
        function visitAwaitExpression(node) {
            return ts.setOriginalNode(ts.setTextRange(ts.createYield(
            /*asteriskToken*/ undefined, ts.visitNode(node.expression, visitor, ts.isExpression)), node), node);
        }
        /**
         * Visits a MethodDeclaration node.
         *
         * This function will be called when one of the following conditions are met:
         * - The node is marked as async
         *
         * @param node The node to visit.
         */
        function visitMethodDeclaration(node) {
            return ts.updateMethod(node, 
            /*decorators*/ undefined, ts.visitNodes(node.modifiers, visitor, ts.isModifier), node.asteriskToken, node.name, 
            /*questionToken*/ undefined, 
            /*typeParameters*/ undefined, ts.visitParameterList(node.parameters, visitor, context), 
            /*type*/ undefined, ts.getFunctionFlags(node) & 2 /* Async */
                ? transformAsyncFunctionBody(node)
                : ts.visitFunctionBody(node.body, visitor, context));
        }
        /**
         * Visits a FunctionDeclaration node.
         *
         * This function will be called when one of the following conditions are met:
         * - The node is marked async
         *
         * @param node The node to visit.
         */
        function visitFunctionDeclaration(node) {
            return ts.updateFunctionDeclaration(node, 
            /*decorators*/ undefined, ts.visitNodes(node.modifiers, visitor, ts.isModifier), node.asteriskToken, node.name, 
            /*typeParameters*/ undefined, ts.visitParameterList(node.parameters, visitor, context), 
            /*type*/ undefined, ts.getFunctionFlags(node) & 2 /* Async */
                ? transformAsyncFunctionBody(node)
                : ts.visitFunctionBody(node.body, visitor, context));
        }
        /**
         * Visits a FunctionExpression node.
         *
         * This function will be called when one of the following conditions are met:
         * - The node is marked async
         *
         * @param node The node to visit.
         */
        function visitFunctionExpression(node) {
            return ts.updateFunctionExpression(node, ts.visitNodes(node.modifiers, visitor, ts.isModifier), node.asteriskToken, node.name, 
            /*typeParameters*/ undefined, ts.visitParameterList(node.parameters, visitor, context), 
            /*type*/ undefined, ts.getFunctionFlags(node) & 2 /* Async */
                ? transformAsyncFunctionBody(node)
                : ts.visitFunctionBody(node.body, visitor, context));
        }
        /**
         * Visits an ArrowFunction.
         *
         * This function will be called when one of the following conditions are met:
         * - The node is marked async
         *
         * @param node The node to visit.
         */
        function visitArrowFunction(node) {
            return ts.updateArrowFunction(node, ts.visitNodes(node.modifiers, visitor, ts.isModifier), 
            /*typeParameters*/ undefined, ts.visitParameterList(node.parameters, visitor, context), 
            /*type*/ undefined, node.equalsGreaterThanToken, ts.getFunctionFlags(node) & 2 /* Async */
                ? transformAsyncFunctionBody(node)
                : ts.visitFunctionBody(node.body, visitor, context));
        }
        function recordDeclarationName({ name }, names) {
            if (ts.isIdentifier(name)) {
                names.set(name.escapedText, true);
            }
            else {
                for (const element of name.elements) {
                    if (!ts.isOmittedExpression(element)) {
                        recordDeclarationName(element, names);
                    }
                }
            }
        }
        function isVariableDeclarationListWithCollidingName(node) {
            return node
                && ts.isVariableDeclarationList(node)
                && !(node.flags & ts.NodeFlags.BlockScoped)
                && ts.forEach(node.declarations, collidesWithParameterName);
        }
        function visitVariableDeclarationListWithCollidingNames(node, hasReceiver) {
            hoistVariableDeclarationList(node);
            const variables = ts.getInitializedVariables(node);
            if (variables.length === 0) {
                if (hasReceiver) {
                    return ts.visitNode(ts.convertToAssignmentElementTarget(node.declarations[0].name), visitor, ts.isExpression);
                }
                return undefined;
            }
            return ts.inlineExpressions(ts.map(variables, transformInitializedVariable));
        }
        function hoistVariableDeclarationList(node) {
            ts.forEach(node.declarations, hoistVariable);
        }
        function hoistVariable({ name }) {
            if (ts.isIdentifier(name)) {
                hoistVariableDeclaration(name);
            }
            else {
                for (const element of name.elements) {
                    if (!ts.isOmittedExpression(element)) {
                        hoistVariable(element);
                    }
                }
            }
        }
        function transformInitializedVariable(node) {
            const converted = ts.setSourceMapRange(ts.createAssignment(ts.convertToAssignmentElementTarget(node.name), node.initializer), node);
            return ts.visitNode(converted, visitor, ts.isExpression);
        }
        function collidesWithParameterName({ name }) {
            if (ts.isIdentifier(name)) {
                return enclosingFunctionParameterNames.has(name.escapedText);
            }
            else {
                for (const element of name.elements) {
                    if (!ts.isOmittedExpression(element) && collidesWithParameterName(element)) {
                        return true;
                    }
                }
            }
            return false;
        }
        function transformAsyncFunctionBody(node) {
            resumeLexicalEnvironment();
            const original = ts.getOriginalNode(node, ts.isFunctionLike);
            const nodeType = original.type;
            const promiseConstructor = languageVersion < ts.ScriptTarget.ES2015 ? getPromiseConstructor(nodeType) : undefined;
            const isArrowFunction = node.kind === ts.SyntaxKind.ArrowFunction;
            const hasLexicalArguments = (resolver.getNodeCheckFlags(node) & 8192 /* CaptureArguments */) !== 0;
            // An async function is emit as an outer function that calls an inner
            // generator function. To preserve lexical bindings, we pass the current
            // `this` and `arguments` objects to `__awaiter`. The generator function
            // passed to `__awaiter` is executed inside of the callback to the
            // promise constructor.
            const savedEnclosingFunctionParameterNames = enclosingFunctionParameterNames;
            enclosingFunctionParameterNames = ts.createUnderscoreEscapedMap();
            for (const parameter of node.parameters) {
                recordDeclarationName(parameter, enclosingFunctionParameterNames);
            }
            let result;
            if (!isArrowFunction) {
                const statements = [];
                const statementOffset = ts.addPrologue(statements, node.body.statements, /*ensureUseStrict*/ false, visitor);
                statements.push(ts.createReturn(createAwaiterHelper(context, hasLexicalArguments, promiseConstructor, transformAsyncFunctionBodyWorker(node.body, statementOffset))));
                ts.addRange(statements, endLexicalEnvironment());
                const block = ts.createBlock(statements, /*multiLine*/ true);
                ts.setTextRange(block, node.body);
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
                result = block;
            }
            else {
                const expression = createAwaiterHelper(context, hasLexicalArguments, promiseConstructor, transformAsyncFunctionBodyWorker(node.body));
                const declarations = endLexicalEnvironment();
                if (ts.some(declarations)) {
                    const block = ts.convertToFunctionBody(expression);
                    result = ts.updateBlock(block, ts.setTextRange(ts.createNodeArray(ts.concatenate(block.statements, declarations)), block.statements));
                }
                else {
                    result = expression;
                }
            }
            enclosingFunctionParameterNames = savedEnclosingFunctionParameterNames;
            return result;
        }
        function transformAsyncFunctionBodyWorker(body, start) {
            if (ts.isBlock(body)) {
                return ts.updateBlock(body, ts.visitNodes(body.statements, asyncBodyVisitor, ts.isStatement, start));
            }
            else {
                return ts.convertToFunctionBody(ts.visitNode(body, asyncBodyVisitor, ts.isConciseBody));
            }
        }
        function getPromiseConstructor(type) {
            const typeName = type && ts.getEntityNameFromTypeNode(type);
            if (typeName && ts.isEntityName(typeName)) {
                const serializationKind = resolver.getTypeReferenceSerializationKind(typeName);
                if (serializationKind === ts.TypeReferenceSerializationKind.TypeWithConstructSignatureAndValue
                    || serializationKind === ts.TypeReferenceSerializationKind.Unknown) {
                    return typeName;
                }
            }
            return undefined;
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
         * Hook for node emit.
         *
         * @param hint A hint as to the intended usage of the node.
         * @param node The node to emit.
         * @param emit A callback used to emit the node in the printer.
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
         * @param hint A hint as to the intended usage of the node.
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
                return ts.setTextRange(ts.createPropertyAccess(ts.createCall(ts.createFileLevelUniqueName("_super"), 
                /*typeArguments*/ undefined, [argumentExpression]), "value"), location);
            }
            else {
                return ts.setTextRange(ts.createCall(ts.createFileLevelUniqueName("_super"), 
                /*typeArguments*/ undefined, [argumentExpression]), location);
            }
        }
    }
    ts.transformES2017 = transformES2017;
    const awaiterHelper = {
        name: "typescript:awaiter",
        scoped: false,
        priority: 5,
        text: `
            var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
                return new (P || (P = Promise))(function (resolve, reject) {
                    function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
                    function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
                    function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
                    step((generator = generator.apply(thisArg, _arguments || [])).next());
                });
            };`
    };
    function createAwaiterHelper(context, hasLexicalArguments, promiseConstructor, body) {
        context.requestEmitHelper(awaiterHelper);
        const generatorFunc = ts.createFunctionExpression(
        /*modifiers*/ undefined, ts.createToken(ts.SyntaxKind.AsteriskToken), 
        /*name*/ undefined, 
        /*typeParameters*/ undefined, 
        /*parameters*/ [], 
        /*type*/ undefined, body);
        // Mark this node as originally an async function
        (generatorFunc.emitNode || (generatorFunc.emitNode = {})).flags |= ts.EmitFlags.AsyncFunctionBody | ts.EmitFlags.ReuseTempVariableScope;
        return ts.createCall(ts.getHelperName("__awaiter"), 
        /*typeArguments*/ undefined, [
            ts.createThis(),
            hasLexicalArguments ? ts.createIdentifier("arguments") : ts.createVoidZero(),
            promiseConstructor ? ts.createExpressionFromEntityName(promiseConstructor) : ts.createVoidZero(),
            generatorFunc
        ]);
    }
    ts.asyncSuperHelper = {
        name: "typescript:async-super",
        scoped: true,
        text: ts.helperString `
            const ${"_super"} = name => super[name];`
    };
    ts.advancedAsyncSuperHelper = {
        name: "typescript:advanced-async-super",
        scoped: true,
        text: ts.helperString `
            const ${"_super"} = (function (geti, seti) {
                const cache = Object.create(null);
                return name => cache[name] || (cache[name] = { get value() { return geti(name); }, set value(v) { seti(name, v); } });
            })(name => super[name], (name, value) => super[name] = value);`
    };
})(ts || (ts = {}));
