/*@internal*/
var ts;
(function (ts) {
    function transformES2015(context) {
        const { startLexicalEnvironment, resumeLexicalEnvironment, endLexicalEnvironment, hoistVariableDeclaration, } = context;
        const compilerOptions = context.getCompilerOptions();
        const resolver = context.getEmitResolver();
        const previousOnSubstituteNode = context.onSubstituteNode;
        const previousOnEmitNode = context.onEmitNode;
        context.onEmitNode = onEmitNode;
        context.onSubstituteNode = onSubstituteNode;
        let currentSourceFile;
        let currentText;
        let hierarchyFacts;
        let taggedTemplateStringDeclarations;
        function recordTaggedTemplateString(temp) {
            taggedTemplateStringDeclarations = ts.append(taggedTemplateStringDeclarations, ts.createVariableDeclaration(temp));
        }
        /**
         * Used to track if we are emitting body of the converted loop
         */
        let convertedLoopState;
        /**
         * Keeps track of whether substitutions have been enabled for specific cases.
         * They are persisted between each SourceFile transformation and should not
         * be reset.
         */
        let enabledSubstitutions;
        return transformSourceFile;
        function transformSourceFile(node) {
            if (node.isDeclarationFile) {
                return node;
            }
            currentSourceFile = node;
            currentText = node.text;
            const visited = visitSourceFile(node);
            ts.addEmitHelpers(visited, context.readEmitHelpers());
            currentSourceFile = undefined;
            currentText = undefined;
            taggedTemplateStringDeclarations = undefined;
            hierarchyFacts = 0 /* None */;
            return visited;
        }
        /**
         * Sets the `HierarchyFacts` for this node prior to visiting this node's subtree, returning the facts set prior to modification.
         * @param excludeFacts The existing `HierarchyFacts` to reset before visiting the subtree.
         * @param includeFacts The new `HierarchyFacts` to set before visiting the subtree.
         */
        function enterSubtree(excludeFacts, includeFacts) {
            const ancestorFacts = hierarchyFacts;
            hierarchyFacts = (hierarchyFacts & ~excludeFacts | includeFacts) & 16383 /* AncestorFactsMask */;
            return ancestorFacts;
        }
        /**
         * Restores the `HierarchyFacts` for this node's ancestor after visiting this node's
         * subtree, propagating specific facts from the subtree.
         * @param ancestorFacts The `HierarchyFacts` of the ancestor to restore after visiting the subtree.
         * @param excludeFacts The existing `HierarchyFacts` of the subtree that should not be propagated.
         * @param includeFacts The new `HierarchyFacts` of the subtree that should be propagated.
         */
        function exitSubtree(ancestorFacts, excludeFacts, includeFacts) {
            hierarchyFacts = (hierarchyFacts & ~excludeFacts | includeFacts) & -16384 /* SubtreeFactsMask */ | ancestorFacts;
        }
        function isReturnVoidStatementInConstructorWithCapturedSuper(node) {
            return hierarchyFacts & 4096 /* ConstructorWithCapturedSuper */
                && node.kind === ts.SyntaxKind.ReturnStatement
                && !node.expression;
        }
        function shouldVisitNode(node) {
            return (node.transformFlags & 128 /* ContainsES2015 */) !== 0
                || convertedLoopState !== undefined
                || (hierarchyFacts & 4096 /* ConstructorWithCapturedSuper */ && (ts.isStatement(node) || (node.kind === ts.SyntaxKind.Block)))
                || (ts.isIterationStatement(node, /*lookInLabeledStatements*/ false) && shouldConvertIterationStatementBody(node))
                || (ts.getEmitFlags(node) & ts.EmitFlags.TypeScriptClassWrapper) !== 0;
        }
        function visitor(node) {
            if (shouldVisitNode(node)) {
                return visitJavaScript(node);
            }
            else {
                return node;
            }
        }
        function functionBodyVisitor(node) {
            if (shouldVisitNode(node)) {
                return visitBlock(node, /*isFunctionBody*/ true);
            }
            return node;
        }
        function callExpressionVisitor(node) {
            if (node.kind === ts.SyntaxKind.SuperKeyword) {
                return visitSuperKeyword(/*isExpressionOfCall*/ true);
            }
            return visitor(node);
        }
        function visitJavaScript(node) {
            switch (node.kind) {
                case ts.SyntaxKind.StaticKeyword:
                    return undefined; // elide static keyword
                case ts.SyntaxKind.ClassDeclaration:
                    return visitClassDeclaration(node);
                case ts.SyntaxKind.ClassExpression:
                    return visitClassExpression(node);
                case ts.SyntaxKind.Parameter:
                    return visitParameter(node);
                case ts.SyntaxKind.FunctionDeclaration:
                    return visitFunctionDeclaration(node);
                case ts.SyntaxKind.ArrowFunction:
                    return visitArrowFunction(node);
                case ts.SyntaxKind.FunctionExpression:
                    return visitFunctionExpression(node);
                case ts.SyntaxKind.VariableDeclaration:
                    return visitVariableDeclaration(node);
                case ts.SyntaxKind.Identifier:
                    return visitIdentifier(node);
                case ts.SyntaxKind.VariableDeclarationList:
                    return visitVariableDeclarationList(node);
                case ts.SyntaxKind.SwitchStatement:
                    return visitSwitchStatement(node);
                case ts.SyntaxKind.CaseBlock:
                    return visitCaseBlock(node);
                case ts.SyntaxKind.Block:
                    return visitBlock(node, /*isFunctionBody*/ false);
                case ts.SyntaxKind.BreakStatement:
                case ts.SyntaxKind.ContinueStatement:
                    return visitBreakOrContinueStatement(node);
                case ts.SyntaxKind.LabeledStatement:
                    return visitLabeledStatement(node);
                case ts.SyntaxKind.DoStatement:
                case ts.SyntaxKind.WhileStatement:
                    return visitDoOrWhileStatement(node, /*outermostLabeledStatement*/ undefined);
                case ts.SyntaxKind.ForStatement:
                    return visitForStatement(node, /*outermostLabeledStatement*/ undefined);
                case ts.SyntaxKind.ForInStatement:
                    return visitForInStatement(node, /*outermostLabeledStatement*/ undefined);
                case ts.SyntaxKind.ForOfStatement:
                    return visitForOfStatement(node, /*outermostLabeledStatement*/ undefined);
                case ts.SyntaxKind.ExpressionStatement:
                    return visitExpressionStatement(node);
                case ts.SyntaxKind.ObjectLiteralExpression:
                    return visitObjectLiteralExpression(node);
                case ts.SyntaxKind.CatchClause:
                    return visitCatchClause(node);
                case ts.SyntaxKind.ShorthandPropertyAssignment:
                    return visitShorthandPropertyAssignment(node);
                case ts.SyntaxKind.ComputedPropertyName:
                    return visitComputedPropertyName(node);
                case ts.SyntaxKind.ArrayLiteralExpression:
                    return visitArrayLiteralExpression(node);
                case ts.SyntaxKind.CallExpression:
                    return visitCallExpression(node);
                case ts.SyntaxKind.NewExpression:
                    return visitNewExpression(node);
                case ts.SyntaxKind.ParenthesizedExpression:
                    return visitParenthesizedExpression(node, /*needsDestructuringValue*/ true);
                case ts.SyntaxKind.BinaryExpression:
                    return visitBinaryExpression(node, /*needsDestructuringValue*/ true);
                case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
                case ts.SyntaxKind.TemplateHead:
                case ts.SyntaxKind.TemplateMiddle:
                case ts.SyntaxKind.TemplateTail:
                    return visitTemplateLiteral(node);
                case ts.SyntaxKind.StringLiteral:
                    return visitStringLiteral(node);
                case ts.SyntaxKind.NumericLiteral:
                    return visitNumericLiteral(node);
                case ts.SyntaxKind.TaggedTemplateExpression:
                    return visitTaggedTemplateExpression(node);
                case ts.SyntaxKind.TemplateExpression:
                    return visitTemplateExpression(node);
                case ts.SyntaxKind.YieldExpression:
                    return visitYieldExpression(node);
                case ts.SyntaxKind.SpreadElement:
                    return visitSpreadElement(node);
                case ts.SyntaxKind.SuperKeyword:
                    return visitSuperKeyword(/*isExpressionOfCall*/ false);
                case ts.SyntaxKind.ThisKeyword:
                    return visitThisKeyword(node);
                case ts.SyntaxKind.MetaProperty:
                    return visitMetaProperty(node);
                case ts.SyntaxKind.MethodDeclaration:
                    return visitMethodDeclaration(node);
                case ts.SyntaxKind.GetAccessor:
                case ts.SyntaxKind.SetAccessor:
                    return visitAccessorDeclaration(node);
                case ts.SyntaxKind.VariableStatement:
                    return visitVariableStatement(node);
                case ts.SyntaxKind.ReturnStatement:
                    return visitReturnStatement(node);
                default:
                    return ts.visitEachChild(node, visitor, context);
            }
        }
        function visitSourceFile(node) {
            const ancestorFacts = enterSubtree(3968 /* SourceFileExcludes */, 64 /* SourceFileIncludes */);
            const statements = [];
            startLexicalEnvironment();
            let statementOffset = ts.addStandardPrologue(statements, node.statements, /*ensureUseStrict*/ false);
            addCaptureThisForNodeIfNeeded(statements, node);
            statementOffset = ts.addCustomPrologue(statements, node.statements, statementOffset, visitor);
            ts.addRange(statements, ts.visitNodes(node.statements, visitor, ts.isStatement, statementOffset));
            if (taggedTemplateStringDeclarations) {
                statements.push(ts.createVariableStatement(/*modifiers*/ undefined, ts.createVariableDeclarationList(taggedTemplateStringDeclarations)));
            }
            ts.addRange(statements, endLexicalEnvironment());
            exitSubtree(ancestorFacts, 0 /* None */, 0 /* None */);
            return ts.updateSourceFileNode(node, ts.setTextRange(ts.createNodeArray(statements), node.statements));
        }
        function visitSwitchStatement(node) {
            if (convertedLoopState !== undefined) {
                const savedAllowedNonLabeledJumps = convertedLoopState.allowedNonLabeledJumps;
                // for switch statement allow only non-labeled break
                convertedLoopState.allowedNonLabeledJumps |= 2 /* Break */;
                const result = ts.visitEachChild(node, visitor, context);
                convertedLoopState.allowedNonLabeledJumps = savedAllowedNonLabeledJumps;
                return result;
            }
            return ts.visitEachChild(node, visitor, context);
        }
        function visitCaseBlock(node) {
            const ancestorFacts = enterSubtree(4032 /* BlockScopeExcludes */, 0 /* BlockScopeIncludes */);
            const updated = ts.visitEachChild(node, visitor, context);
            exitSubtree(ancestorFacts, 0 /* None */, 0 /* None */);
            return updated;
        }
        function returnCapturedThis(node) {
            return ts.setOriginalNode(ts.createReturn(ts.createFileLevelUniqueName("_this")), node);
        }
        function visitReturnStatement(node) {
            if (convertedLoopState) {
                convertedLoopState.nonLocalJumps |= 8 /* Return */;
                if (isReturnVoidStatementInConstructorWithCapturedSuper(node)) {
                    node = returnCapturedThis(node);
                }
                return ts.createReturn(ts.createObjectLiteral([
                    ts.createPropertyAssignment(ts.createIdentifier("value"), node.expression
                        ? ts.visitNode(node.expression, visitor, ts.isExpression)
                        : ts.createVoidZero())
                ]));
            }
            else if (isReturnVoidStatementInConstructorWithCapturedSuper(node)) {
                return returnCapturedThis(node);
            }
            return ts.visitEachChild(node, visitor, context);
        }
        function visitThisKeyword(node) {
            if (convertedLoopState) {
                if (hierarchyFacts & 2 /* ArrowFunction */) {
                    // if the enclosing function is an ArrowFunction then we use the captured 'this' keyword.
                    convertedLoopState.containsLexicalThis = true;
                    return node;
                }
                return convertedLoopState.thisName || (convertedLoopState.thisName = ts.createUniqueName("this"));
            }
            return node;
        }
        function visitIdentifier(node) {
            if (!convertedLoopState) {
                return node;
            }
            if (ts.isGeneratedIdentifier(node)) {
                return node;
            }
            if (node.escapedText !== "arguments" || !resolver.isArgumentsLocalBinding(node)) {
                return node;
            }
            return convertedLoopState.argumentsName || (convertedLoopState.argumentsName = ts.createUniqueName("arguments"));
        }
        function visitBreakOrContinueStatement(node) {
            if (convertedLoopState) {
                // check if we can emit break/continue as is
                // it is possible if either
                //   - break/continue is labeled and label is located inside the converted loop
                //   - break/continue is non-labeled and located in non-converted loop/switch statement
                const jump = node.kind === ts.SyntaxKind.BreakStatement ? 2 /* Break */ : 4 /* Continue */;
                const canUseBreakOrContinue = (node.label && convertedLoopState.labels && convertedLoopState.labels.get(ts.idText(node.label))) ||
                    (!node.label && (convertedLoopState.allowedNonLabeledJumps & jump));
                if (!canUseBreakOrContinue) {
                    let labelMarker;
                    if (!node.label) {
                        if (node.kind === ts.SyntaxKind.BreakStatement) {
                            convertedLoopState.nonLocalJumps |= 2 /* Break */;
                            labelMarker = "break";
                        }
                        else {
                            convertedLoopState.nonLocalJumps |= 4 /* Continue */;
                            // note: return value is emitted only to simplify debugging, call to converted loop body does not do any dispatching on it.
                            labelMarker = "continue";
                        }
                    }
                    else {
                        if (node.kind === ts.SyntaxKind.BreakStatement) {
                            labelMarker = `break-${node.label.escapedText}`;
                            setLabeledJump(convertedLoopState, /*isBreak*/ true, ts.idText(node.label), labelMarker);
                        }
                        else {
                            labelMarker = `continue-${node.label.escapedText}`;
                            setLabeledJump(convertedLoopState, /*isBreak*/ false, ts.idText(node.label), labelMarker);
                        }
                    }
                    let returnExpression = ts.createLiteral(labelMarker);
                    if (convertedLoopState.loopOutParameters.length) {
                        const outParams = convertedLoopState.loopOutParameters;
                        let expr;
                        for (let i = 0; i < outParams.length; i++) {
                            const copyExpr = copyOutParameter(outParams[i], 1 /* ToOutParameter */);
                            if (i === 0) {
                                expr = copyExpr;
                            }
                            else {
                                expr = ts.createBinary(expr, ts.SyntaxKind.CommaToken, copyExpr);
                            }
                        }
                        returnExpression = ts.createBinary(expr, ts.SyntaxKind.CommaToken, returnExpression);
                    }
                    return ts.createReturn(returnExpression);
                }
            }
            return ts.visitEachChild(node, visitor, context);
        }
        /**
         * Visits a ClassDeclaration and transforms it into a variable statement.
         *
         * @param node A ClassDeclaration node.
         */
        function visitClassDeclaration(node) {
            // [source]
            //      class C { }
            //
            // [output]
            //      var C = (function () {
            //          function C() {
            //          }
            //          return C;
            //      }());
            const variable = ts.createVariableDeclaration(ts.getLocalName(node, /*allowComments*/ true), 
            /*type*/ undefined, transformClassLikeDeclarationToExpression(node));
            ts.setOriginalNode(variable, node);
            const statements = [];
            const statement = ts.createVariableStatement(/*modifiers*/ undefined, ts.createVariableDeclarationList([variable]));
            ts.setOriginalNode(statement, node);
            ts.setTextRange(statement, node);
            ts.startOnNewLine(statement);
            statements.push(statement);
            // Add an `export default` statement for default exports (for `--target es5 --module es6`)
            if (ts.hasModifier(node, ts.ModifierFlags.Export)) {
                const exportStatement = ts.hasModifier(node, ts.ModifierFlags.Default)
                    ? ts.createExportDefault(ts.getLocalName(node))
                    : ts.createExternalModuleExport(ts.getLocalName(node));
                ts.setOriginalNode(exportStatement, statement);
                statements.push(exportStatement);
            }
            const emitFlags = ts.getEmitFlags(node);
            if ((emitFlags & ts.EmitFlags.HasEndOfDeclarationMarker) === 0) {
                // Add a DeclarationMarker as a marker for the end of the declaration
                statements.push(ts.createEndOfDeclarationMarker(node));
                ts.setEmitFlags(statement, emitFlags | ts.EmitFlags.HasEndOfDeclarationMarker);
            }
            return ts.singleOrMany(statements);
        }
        /**
         * Visits a ClassExpression and transforms it into an expression.
         *
         * @param node A ClassExpression node.
         */
        function visitClassExpression(node) {
            // [source]
            //      C = class { }
            //
            // [output]
            //      C = (function () {
            //          function class_1() {
            //          }
            //          return class_1;
            //      }())
            return transformClassLikeDeclarationToExpression(node);
        }
        /**
         * Transforms a ClassExpression or ClassDeclaration into an expression.
         *
         * @param node A ClassExpression or ClassDeclaration node.
         */
        function transformClassLikeDeclarationToExpression(node) {
            // [source]
            //      class C extends D {
            //          constructor() {}
            //          method() {}
            //          get prop() {}
            //          set prop(v) {}
            //      }
            //
            // [output]
            //      (function (_super) {
            //          __extends(C, _super);
            //          function C() {
            //          }
            //          C.prototype.method = function () {}
            //          Object.defineProperty(C.prototype, "prop", {
            //              get: function() {},
            //              set: function() {},
            //              enumerable: true,
            //              configurable: true
            //          });
            //          return C;
            //      }(D))
            if (node.name) {
                enableSubstitutionsForBlockScopedBindings();
            }
            const extendsClauseElement = ts.getClassExtendsHeritageClauseElement(node);
            const classFunction = ts.createFunctionExpression(
            /*modifiers*/ undefined, 
            /*asteriskToken*/ undefined, 
            /*name*/ undefined, 
            /*typeParameters*/ undefined, extendsClauseElement ? [ts.createParameter(/*decorators*/ undefined, /*modifiers*/ undefined, /*dotDotDotToken*/ undefined, ts.createFileLevelUniqueName("_super"))] : [], 
            /*type*/ undefined, transformClassBody(node, extendsClauseElement));
            // To preserve the behavior of the old emitter, we explicitly indent
            // the body of the function here if it was requested in an earlier
            // transformation.
            ts.setEmitFlags(classFunction, (ts.getEmitFlags(node) & ts.EmitFlags.Indented) | ts.EmitFlags.ReuseTempVariableScope);
            // "inner" and "outer" below are added purely to preserve source map locations from
            // the old emitter
            const inner = ts.createPartiallyEmittedExpression(classFunction);
            inner.end = node.end;
            ts.setEmitFlags(inner, ts.EmitFlags.NoComments);
            const outer = ts.createPartiallyEmittedExpression(inner);
            outer.end = ts.skipTrivia(currentText, node.pos);
            ts.setEmitFlags(outer, ts.EmitFlags.NoComments);
            const result = ts.createParen(ts.createCall(outer, 
            /*typeArguments*/ undefined, extendsClauseElement
                ? [ts.visitNode(extendsClauseElement.expression, visitor, ts.isExpression)]
                : []));
            ts.addSyntheticLeadingComment(result, ts.SyntaxKind.MultiLineCommentTrivia, "* @class ");
            return result;
        }
        /**
         * Transforms a ClassExpression or ClassDeclaration into a function body.
         *
         * @param node A ClassExpression or ClassDeclaration node.
         * @param extendsClauseElement The expression for the class `extends` clause.
         */
        function transformClassBody(node, extendsClauseElement) {
            const statements = [];
            startLexicalEnvironment();
            addExtendsHelperIfNeeded(statements, node, extendsClauseElement);
            addConstructor(statements, node, extendsClauseElement);
            addClassMembers(statements, node);
            // Create a synthetic text range for the return statement.
            const closingBraceLocation = ts.createTokenRange(ts.skipTrivia(currentText, node.members.end), ts.SyntaxKind.CloseBraceToken);
            const localName = ts.getInternalName(node);
            // The following partially-emitted expression exists purely to align our sourcemap
            // emit with the original emitter.
            const outer = ts.createPartiallyEmittedExpression(localName);
            outer.end = closingBraceLocation.end;
            ts.setEmitFlags(outer, ts.EmitFlags.NoComments);
            const statement = ts.createReturn(outer);
            statement.pos = closingBraceLocation.pos;
            ts.setEmitFlags(statement, ts.EmitFlags.NoComments | ts.EmitFlags.NoTokenSourceMaps);
            statements.push(statement);
            ts.addRange(statements, endLexicalEnvironment());
            const block = ts.createBlock(ts.setTextRange(ts.createNodeArray(statements), /*location*/ node.members), /*multiLine*/ true);
            ts.setEmitFlags(block, ts.EmitFlags.NoComments);
            return block;
        }
        /**
         * Adds a call to the `__extends` helper if needed for a class.
         *
         * @param statements The statements of the class body function.
         * @param node The ClassExpression or ClassDeclaration node.
         * @param extendsClauseElement The expression for the class `extends` clause.
         */
        function addExtendsHelperIfNeeded(statements, node, extendsClauseElement) {
            if (extendsClauseElement) {
                statements.push(ts.setTextRange(ts.createStatement(createExtendsHelper(context, ts.getInternalName(node))), 
                /*location*/ extendsClauseElement));
            }
        }
        /**
         * Adds the constructor of the class to a class body function.
         *
         * @param statements The statements of the class body function.
         * @param node The ClassExpression or ClassDeclaration node.
         * @param extendsClauseElement The expression for the class `extends` clause.
         */
        function addConstructor(statements, node, extendsClauseElement) {
            const savedConvertedLoopState = convertedLoopState;
            convertedLoopState = undefined;
            const ancestorFacts = enterSubtree(16278 /* ConstructorExcludes */, 73 /* ConstructorIncludes */);
            const constructor = ts.getFirstConstructorWithBody(node);
            const hasSynthesizedSuper = hasSynthesizedDefaultSuperCall(constructor, extendsClauseElement !== undefined);
            const constructorFunction = ts.createFunctionDeclaration(
            /*decorators*/ undefined, 
            /*modifiers*/ undefined, 
            /*asteriskToken*/ undefined, ts.getInternalName(node), 
            /*typeParameters*/ undefined, transformConstructorParameters(constructor, hasSynthesizedSuper), 
            /*type*/ undefined, transformConstructorBody(constructor, node, extendsClauseElement, hasSynthesizedSuper));
            ts.setTextRange(constructorFunction, constructor || node);
            if (extendsClauseElement) {
                ts.setEmitFlags(constructorFunction, ts.EmitFlags.CapturesThis);
            }
            statements.push(constructorFunction);
            exitSubtree(ancestorFacts, 49152 /* PropagateNewTargetMask */, 0 /* None */);
            convertedLoopState = savedConvertedLoopState;
        }
        /**
         * Transforms the parameters of the constructor declaration of a class.
         *
         * @param constructor The constructor for the class.
         * @param hasSynthesizedSuper A value indicating whether the constructor starts with a
         *                            synthesized `super` call.
         */
        function transformConstructorParameters(constructor, hasSynthesizedSuper) {
            // If the TypeScript transformer needed to synthesize a constructor for property
            // initializers, it would have also added a synthetic `...args` parameter and
            // `super` call.
            // If this is the case, we do not include the synthetic `...args` parameter and
            // will instead use the `arguments` object in ES5/3.
            return ts.visitParameterList(constructor && !hasSynthesizedSuper && constructor.parameters, visitor, context)
                || [];
        }
        /**
         * Transforms the body of a constructor declaration of a class.
         *
         * @param constructor The constructor for the class.
         * @param node The node which contains the constructor.
         * @param extendsClauseElement The expression for the class `extends` clause.
         * @param hasSynthesizedSuper A value indicating whether the constructor starts with a
         *                            synthesized `super` call.
         */
        function transformConstructorBody(constructor, node, extendsClauseElement, hasSynthesizedSuper) {
            const statements = [];
            resumeLexicalEnvironment();
            let statementOffset = -1;
            if (hasSynthesizedSuper) {
                // If a super call has already been synthesized,
                // we're going to assume that we should just transform everything after that.
                // The assumption is that no prior step in the pipeline has added any prologue directives.
                statementOffset = 0;
            }
            else if (constructor) {
                statementOffset = ts.addStandardPrologue(statements, constructor.body.statements, /*ensureUseStrict*/ false);
            }
            if (constructor) {
                addDefaultValueAssignmentsIfNeeded(statements, constructor);
                addRestParameterIfNeeded(statements, constructor, hasSynthesizedSuper);
                if (!hasSynthesizedSuper) {
                    // If no super call has been synthesized, emit custom prologue directives.
                    statementOffset = ts.addCustomPrologue(statements, constructor.body.statements, statementOffset, visitor);
                }
                ts.Debug.assert(statementOffset >= 0, "statementOffset not initialized correctly!");
            }
            // determine whether the class is known syntactically to be a derived class (e.g. a
            // class that extends a value that is not syntactically known to be `null`).
            const isDerivedClass = extendsClauseElement && ts.skipOuterExpressions(extendsClauseElement.expression).kind !== ts.SyntaxKind.NullKeyword;
            const superCaptureStatus = declareOrCaptureOrReturnThisForConstructorIfNeeded(statements, constructor, isDerivedClass, hasSynthesizedSuper, statementOffset);
            // The last statement expression was replaced. Skip it.
            if (superCaptureStatus === 1 /* ReplaceSuperCapture */ || superCaptureStatus === 2 /* ReplaceWithReturn */) {
                statementOffset++;
            }
            if (constructor) {
                if (superCaptureStatus === 1 /* ReplaceSuperCapture */) {
                    hierarchyFacts |= 4096 /* ConstructorWithCapturedSuper */;
                }
                ts.addRange(statements, ts.visitNodes(constructor.body.statements, visitor, ts.isStatement, /*start*/ statementOffset));
            }
            // Return `_this` unless we're sure enough that it would be pointless to add a return statement.
            // If there's a constructor that we can tell returns in enough places, then we *do not* want to add a return.
            if (isDerivedClass
                && superCaptureStatus !== 2 /* ReplaceWithReturn */
                && !(constructor && isSufficientlyCoveredByReturnStatements(constructor.body))) {
                statements.push(ts.createReturn(ts.createFileLevelUniqueName("_this")));
            }
            ts.addRange(statements, endLexicalEnvironment());
            if (constructor) {
                prependCaptureNewTargetIfNeeded(statements, constructor, /*copyOnWrite*/ false);
            }
            const block = ts.createBlock(ts.setTextRange(ts.createNodeArray(statements), 
            /*location*/ constructor ? constructor.body.statements : node.members), 
            /*multiLine*/ true);
            ts.setTextRange(block, constructor ? constructor.body : node);
            if (!constructor) {
                ts.setEmitFlags(block, ts.EmitFlags.NoComments);
            }
            return block;
        }
        /**
         * We want to try to avoid emitting a return statement in certain cases if a user already returned something.
         * It would generate obviously dead code, so we'll try to make things a little bit prettier
         * by doing a minimal check on whether some common patterns always explicitly return.
         */
        function isSufficientlyCoveredByReturnStatements(statement) {
            // A return statement is considered covered.
            if (statement.kind === ts.SyntaxKind.ReturnStatement) {
                return true;
            }
            // An if-statement with two covered branches is covered.
            else if (statement.kind === ts.SyntaxKind.IfStatement) {
                const ifStatement = statement;
                if (ifStatement.elseStatement) {
                    return isSufficientlyCoveredByReturnStatements(ifStatement.thenStatement) &&
                        isSufficientlyCoveredByReturnStatements(ifStatement.elseStatement);
                }
            }
            // A block is covered if it has a last statement which is covered.
            else if (statement.kind === ts.SyntaxKind.Block) {
                const lastStatement = ts.lastOrUndefined(statement.statements);
                if (lastStatement && isSufficientlyCoveredByReturnStatements(lastStatement)) {
                    return true;
                }
            }
            return false;
        }
        /**
         * Declares a `_this` variable for derived classes and for when arrow functions capture `this`.
         *
         * @returns The new statement offset into the `statements` array.
         */
        function declareOrCaptureOrReturnThisForConstructorIfNeeded(statements, ctor, isDerivedClass, hasSynthesizedSuper, statementOffset) {
            // If this isn't a derived class, just capture 'this' for arrow functions if necessary.
            if (!isDerivedClass) {
                if (ctor) {
                    addCaptureThisForNodeIfNeeded(statements, ctor);
                }
                return 0 /* NoReplacement */;
            }
            // We must be here because the user didn't write a constructor
            // but we needed to call 'super(...args)' anyway as per 14.5.14 of the ES2016 spec.
            // If that's the case we can just immediately return the result of a 'super()' call.
            if (!ctor) {
                statements.push(ts.createReturn(createDefaultSuperCallOrThis()));
                return 2 /* ReplaceWithReturn */;
            }
            // The constructor exists, but it and the 'super()' call it contains were generated
            // for something like property initializers.
            // Create a captured '_this' variable and assume it will subsequently be used.
            if (hasSynthesizedSuper) {
                captureThisForNode(statements, ctor, createDefaultSuperCallOrThis());
                enableSubstitutionsForCapturedThis();
                return 1 /* ReplaceSuperCapture */;
            }
            // Most of the time, a 'super' call will be the first real statement in a constructor body.
            // In these cases, we'd like to transform these into a *single* statement instead of a declaration
            // followed by an assignment statement for '_this'. For instance, if we emitted without an initializer,
            // we'd get:
            //
            //      var _this;
            //      _this = _super.call(...) || this;
            //
            // instead of
            //
            //      var _this = _super.call(...) || this;
            //
            // Additionally, if the 'super()' call is the last statement, we should just avoid capturing
            // entirely and immediately return the result like so:
            //
            //      return _super.call(...) || this;
            //
            let firstStatement;
            let superCallExpression;
            const ctorStatements = ctor.body.statements;
            if (statementOffset < ctorStatements.length) {
                firstStatement = ctorStatements[statementOffset];
                if (firstStatement.kind === ts.SyntaxKind.ExpressionStatement && ts.isSuperCall(firstStatement.expression)) {
                    superCallExpression = visitImmediateSuperCallInBody(firstStatement.expression);
                }
            }
            // Return the result if we have an immediate super() call on the last statement,
            // but only if the constructor itself doesn't use 'this' elsewhere.
            if (superCallExpression
                && statementOffset === ctorStatements.length - 1
                && !(ctor.transformFlags & (16384 /* ContainsLexicalThis */ | 32768 /* ContainsCapturedLexicalThis */))) {
                const returnStatement = ts.createReturn(superCallExpression);
                if (superCallExpression.kind !== ts.SyntaxKind.BinaryExpression
                    || superCallExpression.left.kind !== ts.SyntaxKind.CallExpression) {
                    ts.Debug.fail("Assumed generated super call would have form 'super.call(...) || this'.");
                }
                // Shift comments from the original super call to the return statement.
                ts.setCommentRange(returnStatement, ts.getCommentRange(ts.setEmitFlags(superCallExpression.left, ts.EmitFlags.NoComments)));
                statements.push(returnStatement);
                return 2 /* ReplaceWithReturn */;
            }
            // Perform the capture.
            captureThisForNode(statements, ctor, superCallExpression || createActualThis(), firstStatement);
            // If we're actually replacing the original statement, we need to signal this to the caller.
            if (superCallExpression) {
                return 1 /* ReplaceSuperCapture */;
            }
            return 0 /* NoReplacement */;
        }
        function createActualThis() {
            return ts.setEmitFlags(ts.createThis(), ts.EmitFlags.NoSubstitution);
        }
        function createDefaultSuperCallOrThis() {
            return ts.createLogicalOr(ts.createLogicalAnd(ts.createStrictInequality(ts.createFileLevelUniqueName("_super"), ts.createNull()), ts.createFunctionApply(ts.createFileLevelUniqueName("_super"), createActualThis(), ts.createIdentifier("arguments"))), createActualThis());
        }
        /**
         * Visits a parameter declaration.
         *
         * @param node A ParameterDeclaration node.
         */
        function visitParameter(node) {
            if (node.dotDotDotToken) {
                // rest parameters are elided
                return undefined;
            }
            else if (ts.isBindingPattern(node.name)) {
                // Binding patterns are converted into a generated name and are
                // evaluated inside the function body.
                return ts.setOriginalNode(ts.setTextRange(ts.createParameter(
                /*decorators*/ undefined, 
                /*modifiers*/ undefined, 
                /*dotDotDotToken*/ undefined, ts.getGeneratedNameForNode(node), 
                /*questionToken*/ undefined, 
                /*type*/ undefined, 
                /*initializer*/ undefined), 
                /*location*/ node), 
                /*original*/ node);
            }
            else if (node.initializer) {
                // Initializers are elided
                return ts.setOriginalNode(ts.setTextRange(ts.createParameter(
                /*decorators*/ undefined, 
                /*modifiers*/ undefined, 
                /*dotDotDotToken*/ undefined, node.name, 
                /*questionToken*/ undefined, 
                /*type*/ undefined, 
                /*initializer*/ undefined), 
                /*location*/ node), 
                /*original*/ node);
            }
            else {
                return node;
            }
        }
        /**
         * Gets a value indicating whether we need to add default value assignments for a
         * function-like node.
         *
         * @param node A function-like node.
         */
        function shouldAddDefaultValueAssignments(node) {
            return (node.transformFlags & 131072 /* ContainsDefaultValueAssignments */) !== 0;
        }
        /**
         * Adds statements to the body of a function-like node if it contains parameters with
         * binding patterns or initializers.
         *
         * @param statements The statements for the new function body.
         * @param node A function-like node.
         */
        function addDefaultValueAssignmentsIfNeeded(statements, node) {
            if (!shouldAddDefaultValueAssignments(node)) {
                return;
            }
            for (const parameter of node.parameters) {
                const { name, initializer, dotDotDotToken } = parameter;
                // A rest parameter cannot have a binding pattern or an initializer,
                // so let's just ignore it.
                if (dotDotDotToken) {
                    continue;
                }
                if (ts.isBindingPattern(name)) {
                    addDefaultValueAssignmentForBindingPattern(statements, parameter, name, initializer);
                }
                else if (initializer) {
                    addDefaultValueAssignmentForInitializer(statements, parameter, name, initializer);
                }
            }
        }
        /**
         * Adds statements to the body of a function-like node for parameters with binding patterns
         *
         * @param statements The statements for the new function body.
         * @param parameter The parameter for the function.
         * @param name The name of the parameter.
         * @param initializer The initializer for the parameter.
         */
        function addDefaultValueAssignmentForBindingPattern(statements, parameter, name, initializer) {
            const temp = ts.getGeneratedNameForNode(parameter);
            // In cases where a binding pattern is simply '[]' or '{}',
            // we usually don't want to emit a var declaration; however, in the presence
            // of an initializer, we must emit that expression to preserve side effects.
            if (name.elements.length > 0) {
                statements.push(ts.setEmitFlags(ts.createVariableStatement(
                /*modifiers*/ undefined, ts.createVariableDeclarationList(ts.flattenDestructuringBinding(parameter, visitor, context, 0 /* All */, temp))), ts.EmitFlags.CustomPrologue));
            }
            else if (initializer) {
                statements.push(ts.setEmitFlags(ts.createStatement(ts.createAssignment(temp, ts.visitNode(initializer, visitor, ts.isExpression))), ts.EmitFlags.CustomPrologue));
            }
        }
        /**
         * Adds statements to the body of a function-like node for parameters with initializers.
         *
         * @param statements The statements for the new function body.
         * @param parameter The parameter for the function.
         * @param name The name of the parameter.
         * @param initializer The initializer for the parameter.
         */
        function addDefaultValueAssignmentForInitializer(statements, parameter, name, initializer) {
            initializer = ts.visitNode(initializer, visitor, ts.isExpression);
            const statement = ts.createIf(ts.createTypeCheck(ts.getSynthesizedClone(name), "undefined"), ts.setEmitFlags(ts.setTextRange(ts.createBlock([
                ts.createStatement(ts.setEmitFlags(ts.setTextRange(ts.createAssignment(ts.setEmitFlags(ts.getMutableClone(name), ts.EmitFlags.NoSourceMap), ts.setEmitFlags(initializer, ts.EmitFlags.NoSourceMap | ts.getEmitFlags(initializer) | ts.EmitFlags.NoComments)), parameter), ts.EmitFlags.NoComments))
            ]), parameter), ts.EmitFlags.SingleLine | ts.EmitFlags.NoTrailingSourceMap | ts.EmitFlags.NoTokenSourceMaps | ts.EmitFlags.NoComments));
            ts.startOnNewLine(statement);
            ts.setTextRange(statement, parameter);
            ts.setEmitFlags(statement, ts.EmitFlags.NoTokenSourceMaps | ts.EmitFlags.NoTrailingSourceMap | ts.EmitFlags.CustomPrologue | ts.EmitFlags.NoComments);
            statements.push(statement);
        }
        /**
         * Gets a value indicating whether we need to add statements to handle a rest parameter.
         *
         * @param node A ParameterDeclaration node.
         * @param inConstructorWithSynthesizedSuper A value indicating whether the parameter is
         *                                          part of a constructor declaration with a
         *                                          synthesized call to `super`
         */
        function shouldAddRestParameter(node, inConstructorWithSynthesizedSuper) {
            return node && node.dotDotDotToken && node.name.kind === ts.SyntaxKind.Identifier && !inConstructorWithSynthesizedSuper;
        }
        /**
         * Adds statements to the body of a function-like node if it contains a rest parameter.
         *
         * @param statements The statements for the new function body.
         * @param node A function-like node.
         * @param inConstructorWithSynthesizedSuper A value indicating whether the parameter is
         *                                          part of a constructor declaration with a
         *                                          synthesized call to `super`
         */
        function addRestParameterIfNeeded(statements, node, inConstructorWithSynthesizedSuper) {
            const parameter = ts.lastOrUndefined(node.parameters);
            if (!shouldAddRestParameter(parameter, inConstructorWithSynthesizedSuper)) {
                return;
            }
            // `declarationName` is the name of the local declaration for the parameter.
            const declarationName = ts.getMutableClone(parameter.name);
            ts.setEmitFlags(declarationName, ts.EmitFlags.NoSourceMap);
            // `expressionName` is the name of the parameter used in expressions.
            const expressionName = ts.getSynthesizedClone(parameter.name);
            const restIndex = node.parameters.length - 1;
            const temp = ts.createLoopVariable();
            // var param = [];
            statements.push(ts.setEmitFlags(ts.setTextRange(ts.createVariableStatement(
            /*modifiers*/ undefined, ts.createVariableDeclarationList([
                ts.createVariableDeclaration(declarationName, 
                /*type*/ undefined, ts.createArrayLiteral([]))
            ])), 
            /*location*/ parameter), ts.EmitFlags.CustomPrologue));
            // for (var _i = restIndex; _i < arguments.length; _i++) {
            //   param[_i - restIndex] = arguments[_i];
            // }
            const forStatement = ts.createFor(ts.setTextRange(ts.createVariableDeclarationList([
                ts.createVariableDeclaration(temp, /*type*/ undefined, ts.createLiteral(restIndex))
            ]), parameter), ts.setTextRange(ts.createLessThan(temp, ts.createPropertyAccess(ts.createIdentifier("arguments"), "length")), parameter), ts.setTextRange(ts.createPostfixIncrement(temp), parameter), ts.createBlock([
                ts.startOnNewLine(ts.setTextRange(ts.createStatement(ts.createAssignment(ts.createElementAccess(expressionName, restIndex === 0
                    ? temp
                    : ts.createSubtract(temp, ts.createLiteral(restIndex))), ts.createElementAccess(ts.createIdentifier("arguments"), temp))), 
                /*location*/ parameter))
            ]));
            ts.setEmitFlags(forStatement, ts.EmitFlags.CustomPrologue);
            ts.startOnNewLine(forStatement);
            statements.push(forStatement);
        }
        /**
         * Adds a statement to capture the `this` of a function declaration if it is needed.
         *
         * @param statements The statements for the new function body.
         * @param node A node.
         */
        function addCaptureThisForNodeIfNeeded(statements, node) {
            if (node.transformFlags & 32768 /* ContainsCapturedLexicalThis */ && node.kind !== ts.SyntaxKind.ArrowFunction) {
                captureThisForNode(statements, node, ts.createThis());
            }
        }
        function captureThisForNode(statements, node, initializer, originalStatement) {
            enableSubstitutionsForCapturedThis();
            const captureThisStatement = ts.createVariableStatement(
            /*modifiers*/ undefined, ts.createVariableDeclarationList([
                ts.createVariableDeclaration(ts.createFileLevelUniqueName("_this"), 
                /*type*/ undefined, initializer)
            ]));
            ts.setEmitFlags(captureThisStatement, ts.EmitFlags.NoComments | ts.EmitFlags.CustomPrologue);
            ts.setTextRange(captureThisStatement, originalStatement);
            ts.setSourceMapRange(captureThisStatement, node);
            statements.push(captureThisStatement);
        }
        function prependCaptureNewTargetIfNeeded(statements, node, copyOnWrite) {
            if (hierarchyFacts & 16384 /* NewTarget */) {
                let newTarget;
                switch (node.kind) {
                    case ts.SyntaxKind.ArrowFunction:
                        return statements;
                    case ts.SyntaxKind.MethodDeclaration:
                    case ts.SyntaxKind.GetAccessor:
                    case ts.SyntaxKind.SetAccessor:
                        // Methods and accessors cannot be constructors, so 'new.target' will
                        // always return 'undefined'.
                        newTarget = ts.createVoidZero();
                        break;
                    case ts.SyntaxKind.Constructor:
                        // Class constructors can only be called with `new`, so `this.constructor`
                        // should be relatively safe to use.
                        newTarget = ts.createPropertyAccess(ts.setEmitFlags(ts.createThis(), ts.EmitFlags.NoSubstitution), "constructor");
                        break;
                    case ts.SyntaxKind.FunctionDeclaration:
                    case ts.SyntaxKind.FunctionExpression:
                        // Functions can be called or constructed, and may have a `this` due to
                        // being a member or when calling an imported function via `other_1.f()`.
                        newTarget = ts.createConditional(ts.createLogicalAnd(ts.setEmitFlags(ts.createThis(), ts.EmitFlags.NoSubstitution), ts.createBinary(ts.setEmitFlags(ts.createThis(), ts.EmitFlags.NoSubstitution), ts.SyntaxKind.InstanceOfKeyword, ts.getLocalName(node))), ts.createPropertyAccess(ts.setEmitFlags(ts.createThis(), ts.EmitFlags.NoSubstitution), "constructor"), ts.createVoidZero());
                        break;
                    default:
                        return ts.Debug.failBadSyntaxKind(node);
                }
                const captureNewTargetStatement = ts.createVariableStatement(
                /*modifiers*/ undefined, ts.createVariableDeclarationList([
                    ts.createVariableDeclaration(ts.createFileLevelUniqueName("_newTarget"), 
                    /*type*/ undefined, newTarget)
                ]));
                if (copyOnWrite) {
                    return [captureNewTargetStatement, ...statements];
                }
                statements.unshift(captureNewTargetStatement);
            }
            return statements;
        }
        /**
         * Adds statements to the class body function for a class to define the members of the
         * class.
         *
         * @param statements The statements for the class body function.
         * @param node The ClassExpression or ClassDeclaration node.
         */
        function addClassMembers(statements, node) {
            for (const member of node.members) {
                switch (member.kind) {
                    case ts.SyntaxKind.SemicolonClassElement:
                        statements.push(transformSemicolonClassElementToStatement(member));
                        break;
                    case ts.SyntaxKind.MethodDeclaration:
                        statements.push(transformClassMethodDeclarationToStatement(getClassMemberPrefix(node, member), member, node));
                        break;
                    case ts.SyntaxKind.GetAccessor:
                    case ts.SyntaxKind.SetAccessor:
                        const accessors = ts.getAllAccessorDeclarations(node.members, member);
                        if (member === accessors.firstAccessor) {
                            statements.push(transformAccessorsToStatement(getClassMemberPrefix(node, member), accessors, node));
                        }
                        break;
                    case ts.SyntaxKind.Constructor:
                        // Constructors are handled in visitClassExpression/visitClassDeclaration
                        break;
                    default:
                        ts.Debug.failBadSyntaxKind(node);
                        break;
                }
            }
        }
        /**
         * Transforms a SemicolonClassElement into a statement for a class body function.
         *
         * @param member The SemicolonClassElement node.
         */
        function transformSemicolonClassElementToStatement(member) {
            return ts.setTextRange(ts.createEmptyStatement(), member);
        }
        /**
         * Transforms a MethodDeclaration into a statement for a class body function.
         *
         * @param receiver The receiver for the member.
         * @param member The MethodDeclaration node.
         */
        function transformClassMethodDeclarationToStatement(receiver, member, container) {
            const ancestorFacts = enterSubtree(0 /* None */, 0 /* None */);
            const commentRange = ts.getCommentRange(member);
            const sourceMapRange = ts.getSourceMapRange(member);
            const memberName = ts.createMemberAccessForPropertyName(receiver, ts.visitNode(member.name, visitor, ts.isPropertyName), /*location*/ member.name);
            const memberFunction = transformFunctionLikeToExpression(member, /*location*/ member, /*name*/ undefined, container);
            ts.setEmitFlags(memberFunction, ts.EmitFlags.NoComments);
            ts.setSourceMapRange(memberFunction, sourceMapRange);
            const statement = ts.setTextRange(ts.createStatement(ts.createAssignment(memberName, memberFunction)), 
            /*location*/ member);
            ts.setOriginalNode(statement, member);
            ts.setCommentRange(statement, commentRange);
            // The location for the statement is used to emit comments only.
            // No source map should be emitted for this statement to align with the
            // old emitter.
            ts.setEmitFlags(statement, ts.EmitFlags.NoSourceMap);
            exitSubtree(ancestorFacts, 49152 /* PropagateNewTargetMask */, hierarchyFacts & 49152 /* PropagateNewTargetMask */ ? 16384 /* NewTarget */ : 0 /* None */);
            return statement;
        }
        /**
         * Transforms a set of related of get/set accessors into a statement for a class body function.
         *
         * @param receiver The receiver for the member.
         * @param accessors The set of related get/set accessors.
         */
        function transformAccessorsToStatement(receiver, accessors, container) {
            const statement = ts.createStatement(transformAccessorsToExpression(receiver, accessors, container, /*startsOnNewLine*/ false));
            // The location for the statement is used to emit source maps only.
            // No comments should be emitted for this statement to align with the
            // old emitter.
            ts.setEmitFlags(statement, ts.EmitFlags.NoComments);
            ts.setSourceMapRange(statement, ts.getSourceMapRange(accessors.firstAccessor));
            return statement;
        }
        /**
         * Transforms a set of related get/set accessors into an expression for either a class
         * body function or an ObjectLiteralExpression with computed properties.
         *
         * @param receiver The receiver for the member.
         */
        function transformAccessorsToExpression(receiver, { firstAccessor, getAccessor, setAccessor }, container, startsOnNewLine) {
            const ancestorFacts = enterSubtree(0 /* None */, 0 /* None */);
            // To align with source maps in the old emitter, the receiver and property name
            // arguments are both mapped contiguously to the accessor name.
            const target = ts.getMutableClone(receiver);
            ts.setEmitFlags(target, ts.EmitFlags.NoComments | ts.EmitFlags.NoTrailingSourceMap);
            ts.setSourceMapRange(target, firstAccessor.name);
            const propertyName = ts.createExpressionForPropertyName(ts.visitNode(firstAccessor.name, visitor, ts.isPropertyName));
            ts.setEmitFlags(propertyName, ts.EmitFlags.NoComments | ts.EmitFlags.NoLeadingSourceMap);
            ts.setSourceMapRange(propertyName, firstAccessor.name);
            const properties = [];
            if (getAccessor) {
                const getterFunction = transformFunctionLikeToExpression(getAccessor, /*location*/ undefined, /*name*/ undefined, container);
                ts.setSourceMapRange(getterFunction, ts.getSourceMapRange(getAccessor));
                ts.setEmitFlags(getterFunction, ts.EmitFlags.NoLeadingComments);
                const getter = ts.createPropertyAssignment("get", getterFunction);
                ts.setCommentRange(getter, ts.getCommentRange(getAccessor));
                properties.push(getter);
            }
            if (setAccessor) {
                const setterFunction = transformFunctionLikeToExpression(setAccessor, /*location*/ undefined, /*name*/ undefined, container);
                ts.setSourceMapRange(setterFunction, ts.getSourceMapRange(setAccessor));
                ts.setEmitFlags(setterFunction, ts.EmitFlags.NoLeadingComments);
                const setter = ts.createPropertyAssignment("set", setterFunction);
                ts.setCommentRange(setter, ts.getCommentRange(setAccessor));
                properties.push(setter);
            }
            properties.push(ts.createPropertyAssignment("enumerable", ts.createTrue()), ts.createPropertyAssignment("configurable", ts.createTrue()));
            const call = ts.createCall(ts.createPropertyAccess(ts.createIdentifier("Object"), "defineProperty"), 
            /*typeArguments*/ undefined, [
                target,
                propertyName,
                ts.createObjectLiteral(properties, /*multiLine*/ true)
            ]);
            if (startsOnNewLine) {
                ts.startOnNewLine(call);
            }
            exitSubtree(ancestorFacts, 49152 /* PropagateNewTargetMask */, hierarchyFacts & 49152 /* PropagateNewTargetMask */ ? 16384 /* NewTarget */ : 0 /* None */);
            return call;
        }
        /**
         * Visits an ArrowFunction and transforms it into a FunctionExpression.
         *
         * @param node An ArrowFunction node.
         */
        function visitArrowFunction(node) {
            if (node.transformFlags & 16384 /* ContainsLexicalThis */) {
                enableSubstitutionsForCapturedThis();
            }
            const savedConvertedLoopState = convertedLoopState;
            convertedLoopState = undefined;
            const ancestorFacts = enterSubtree(16256 /* ArrowFunctionExcludes */, 66 /* ArrowFunctionIncludes */);
            const func = ts.createFunctionExpression(
            /*modifiers*/ undefined, 
            /*asteriskToken*/ undefined, 
            /*name*/ undefined, 
            /*typeParameters*/ undefined, ts.visitParameterList(node.parameters, visitor, context), 
            /*type*/ undefined, transformFunctionBody(node));
            ts.setTextRange(func, node);
            ts.setOriginalNode(func, node);
            ts.setEmitFlags(func, ts.EmitFlags.CapturesThis);
            exitSubtree(ancestorFacts, 0 /* None */, 0 /* None */);
            convertedLoopState = savedConvertedLoopState;
            return func;
        }
        /**
         * Visits a FunctionExpression node.
         *
         * @param node a FunctionExpression node.
         */
        function visitFunctionExpression(node) {
            const ancestorFacts = ts.getEmitFlags(node) & ts.EmitFlags.AsyncFunctionBody
                ? enterSubtree(16278 /* AsyncFunctionBodyExcludes */, 69 /* AsyncFunctionBodyIncludes */)
                : enterSubtree(16286 /* FunctionExcludes */, 65 /* FunctionIncludes */);
            const savedConvertedLoopState = convertedLoopState;
            convertedLoopState = undefined;
            const parameters = ts.visitParameterList(node.parameters, visitor, context);
            const body = node.transformFlags & 64 /* ES2015 */
                ? transformFunctionBody(node)
                : visitFunctionBodyDownLevel(node);
            const name = hierarchyFacts & 16384 /* NewTarget */
                ? ts.getLocalName(node)
                : node.name;
            exitSubtree(ancestorFacts, 49152 /* PropagateNewTargetMask */, 0 /* None */);
            convertedLoopState = savedConvertedLoopState;
            return ts.updateFunctionExpression(node, 
            /*modifiers*/ undefined, node.asteriskToken, name, 
            /*typeParameters*/ undefined, parameters, 
            /*type*/ undefined, body);
        }
        /**
         * Visits a FunctionDeclaration node.
         *
         * @param node a FunctionDeclaration node.
         */
        function visitFunctionDeclaration(node) {
            const savedConvertedLoopState = convertedLoopState;
            convertedLoopState = undefined;
            const ancestorFacts = enterSubtree(16286 /* FunctionExcludes */, 65 /* FunctionIncludes */);
            const parameters = ts.visitParameterList(node.parameters, visitor, context);
            const body = node.transformFlags & 64 /* ES2015 */
                ? transformFunctionBody(node)
                : visitFunctionBodyDownLevel(node);
            const name = hierarchyFacts & 16384 /* NewTarget */
                ? ts.getLocalName(node)
                : node.name;
            exitSubtree(ancestorFacts, 49152 /* PropagateNewTargetMask */, 0 /* None */);
            convertedLoopState = savedConvertedLoopState;
            return ts.updateFunctionDeclaration(node, 
            /*decorators*/ undefined, ts.visitNodes(node.modifiers, visitor, ts.isModifier), node.asteriskToken, name, 
            /*typeParameters*/ undefined, parameters, 
            /*type*/ undefined, body);
        }
        /**
         * Transforms a function-like node into a FunctionExpression.
         *
         * @param node The function-like node to transform.
         * @param location The source-map location for the new FunctionExpression.
         * @param name The name of the new FunctionExpression.
         */
        function transformFunctionLikeToExpression(node, location, name, container) {
            const savedConvertedLoopState = convertedLoopState;
            convertedLoopState = undefined;
            const ancestorFacts = container && ts.isClassLike(container) && !ts.hasModifier(node, ts.ModifierFlags.Static)
                ? enterSubtree(16286 /* FunctionExcludes */, 65 /* FunctionIncludes */ | 8 /* NonStaticClassElement */)
                : enterSubtree(16286 /* FunctionExcludes */, 65 /* FunctionIncludes */);
            const parameters = ts.visitParameterList(node.parameters, visitor, context);
            const body = transformFunctionBody(node);
            if (hierarchyFacts & 16384 /* NewTarget */ && !name && (node.kind === ts.SyntaxKind.FunctionDeclaration || node.kind === ts.SyntaxKind.FunctionExpression)) {
                name = ts.getGeneratedNameForNode(node);
            }
            exitSubtree(ancestorFacts, 49152 /* PropagateNewTargetMask */, 0 /* None */);
            convertedLoopState = savedConvertedLoopState;
            return ts.setOriginalNode(ts.setTextRange(ts.createFunctionExpression(
            /*modifiers*/ undefined, node.asteriskToken, name, 
            /*typeParameters*/ undefined, parameters, 
            /*type*/ undefined, body), location), 
            /*original*/ node);
        }
        /**
         * Transforms the body of a function-like node.
         *
         * @param node A function-like node.
         */
        function transformFunctionBody(node) {
            let multiLine = false; // indicates whether the block *must* be emitted as multiple lines
            let singleLine = false; // indicates whether the block *may* be emitted as a single line
            let statementsLocation;
            let closeBraceLocation;
            const statements = [];
            const body = node.body;
            let statementOffset;
            resumeLexicalEnvironment();
            if (ts.isBlock(body)) {
                // ensureUseStrict is false because no new prologue-directive should be added.
                // addStandardPrologue will put already-existing directives at the beginning of the target statement-array
                statementOffset = ts.addStandardPrologue(statements, body.statements, /*ensureUseStrict*/ false);
            }
            addCaptureThisForNodeIfNeeded(statements, node);
            addDefaultValueAssignmentsIfNeeded(statements, node);
            addRestParameterIfNeeded(statements, node, /*inConstructorWithSynthesizedSuper*/ false);
            // If we added any generated statements, this must be a multi-line block.
            if (!multiLine && statements.length > 0) {
                multiLine = true;
            }
            if (ts.isBlock(body)) {
                // addCustomPrologue puts already-existing directives at the beginning of the target statement-array
                statementOffset = ts.addCustomPrologue(statements, body.statements, statementOffset, visitor);
                statementsLocation = body.statements;
                ts.addRange(statements, ts.visitNodes(body.statements, visitor, ts.isStatement, statementOffset));
                // If the original body was a multi-line block, this must be a multi-line block.
                if (!multiLine && body.multiLine) {
                    multiLine = true;
                }
            }
            else {
                ts.Debug.assert(node.kind === ts.SyntaxKind.ArrowFunction);
                // To align with the old emitter, we use a synthetic end position on the location
                // for the statement list we synthesize when we down-level an arrow function with
                // an expression function body. This prevents both comments and source maps from
                // being emitted for the end position only.
                statementsLocation = ts.moveRangeEnd(body, -1);
                const equalsGreaterThanToken = node.equalsGreaterThanToken;
                if (!ts.nodeIsSynthesized(equalsGreaterThanToken) && !ts.nodeIsSynthesized(body)) {
                    if (ts.rangeEndIsOnSameLineAsRangeStart(equalsGreaterThanToken, body, currentSourceFile)) {
                        singleLine = true;
                    }
                    else {
                        multiLine = true;
                    }
                }
                const expression = ts.visitNode(body, visitor, ts.isExpression);
                const returnStatement = ts.createReturn(expression);
                ts.setTextRange(returnStatement, body);
                ts.setEmitFlags(returnStatement, ts.EmitFlags.NoTokenSourceMaps | ts.EmitFlags.NoTrailingSourceMap | ts.EmitFlags.NoTrailingComments);
                statements.push(returnStatement);
                // To align with the source map emit for the old emitter, we set a custom
                // source map location for the close brace.
                closeBraceLocation = body;
            }
            const lexicalEnvironment = context.endLexicalEnvironment();
            ts.addRange(statements, lexicalEnvironment);
            prependCaptureNewTargetIfNeeded(statements, node, /*copyOnWrite*/ false);
            // If we added any final generated statements, this must be a multi-line block
            if (!multiLine && lexicalEnvironment && lexicalEnvironment.length) {
                multiLine = true;
            }
            const block = ts.createBlock(ts.setTextRange(ts.createNodeArray(statements), statementsLocation), multiLine);
            ts.setTextRange(block, node.body);
            if (!multiLine && singleLine) {
                ts.setEmitFlags(block, ts.EmitFlags.SingleLine);
            }
            if (closeBraceLocation) {
                ts.setTokenSourceMapRange(block, ts.SyntaxKind.CloseBraceToken, closeBraceLocation);
            }
            ts.setOriginalNode(block, node.body);
            return block;
        }
        function visitFunctionBodyDownLevel(node) {
            const updated = ts.visitFunctionBody(node.body, functionBodyVisitor, context);
            return ts.updateBlock(updated, ts.setTextRange(ts.createNodeArray(prependCaptureNewTargetIfNeeded(updated.statements, node, /*copyOnWrite*/ true)), 
            /*location*/ updated.statements));
        }
        function visitBlock(node, isFunctionBody) {
            if (isFunctionBody) {
                // A function body is not a block scope.
                return ts.visitEachChild(node, visitor, context);
            }
            const ancestorFacts = hierarchyFacts & 256 /* IterationStatement */
                ? enterSubtree(4032 /* IterationStatementBlockExcludes */, 512 /* IterationStatementBlockIncludes */)
                : enterSubtree(3904 /* BlockExcludes */, 128 /* BlockIncludes */);
            const updated = ts.visitEachChild(node, visitor, context);
            exitSubtree(ancestorFacts, 0 /* None */, 0 /* None */);
            return updated;
        }
        /**
         * Visits an ExpressionStatement that contains a destructuring assignment.
         *
         * @param node An ExpressionStatement node.
         */
        function visitExpressionStatement(node) {
            // If we are here it is most likely because our expression is a destructuring assignment.
            switch (node.expression.kind) {
                case ts.SyntaxKind.ParenthesizedExpression:
                    return ts.updateStatement(node, visitParenthesizedExpression(node.expression, /*needsDestructuringValue*/ false));
                case ts.SyntaxKind.BinaryExpression:
                    return ts.updateStatement(node, visitBinaryExpression(node.expression, /*needsDestructuringValue*/ false));
            }
            return ts.visitEachChild(node, visitor, context);
        }
        /**
         * Visits a ParenthesizedExpression that may contain a destructuring assignment.
         *
         * @param node A ParenthesizedExpression node.
         * @param needsDestructuringValue A value indicating whether we need to hold onto the rhs
         *                                of a destructuring assignment.
         */
        function visitParenthesizedExpression(node, needsDestructuringValue) {
            // If we are here it is most likely because our expression is a destructuring assignment.
            if (!needsDestructuringValue) {
                // By default we always emit the RHS at the end of a flattened destructuring
                // expression. If we are in a state where we do not need the destructuring value,
                // we pass that information along to the children that care about it.
                switch (node.expression.kind) {
                    case ts.SyntaxKind.ParenthesizedExpression:
                        return ts.updateParen(node, visitParenthesizedExpression(node.expression, /*needsDestructuringValue*/ false));
                    case ts.SyntaxKind.BinaryExpression:
                        return ts.updateParen(node, visitBinaryExpression(node.expression, /*needsDestructuringValue*/ false));
                }
            }
            return ts.visitEachChild(node, visitor, context);
        }
        /**
         * Visits a BinaryExpression that contains a destructuring assignment.
         *
         * @param node A BinaryExpression node.
         * @param needsDestructuringValue A value indicating whether we need to hold onto the rhs
         *                                of a destructuring assignment.
         */
        function visitBinaryExpression(node, needsDestructuringValue) {
            // If we are here it is because this is a destructuring assignment.
            if (ts.isDestructuringAssignment(node)) {
                return ts.flattenDestructuringAssignment(node, visitor, context, 0 /* All */, needsDestructuringValue);
            }
            return ts.visitEachChild(node, visitor, context);
        }
        function visitVariableStatement(node) {
            const ancestorFacts = enterSubtree(0 /* None */, ts.hasModifier(node, ts.ModifierFlags.Export) ? 32 /* ExportedVariableStatement */ : 0 /* None */);
            let updated;
            if (convertedLoopState && (node.declarationList.flags & ts.NodeFlags.BlockScoped) === 0) {
                // we are inside a converted loop - hoist variable declarations
                let assignments;
                for (const decl of node.declarationList.declarations) {
                    hoistVariableDeclarationDeclaredInConvertedLoop(convertedLoopState, decl);
                    if (decl.initializer) {
                        let assignment;
                        if (ts.isBindingPattern(decl.name)) {
                            assignment = ts.flattenDestructuringAssignment(decl, visitor, context, 0 /* All */);
                        }
                        else {
                            assignment = ts.createBinary(decl.name, ts.SyntaxKind.EqualsToken, ts.visitNode(decl.initializer, visitor, ts.isExpression));
                            ts.setTextRange(assignment, decl);
                        }
                        assignments = ts.append(assignments, assignment);
                    }
                }
                if (assignments) {
                    updated = ts.setTextRange(ts.createStatement(ts.inlineExpressions(assignments)), node);
                }
                else {
                    // none of declarations has initializer - the entire variable statement can be deleted
                    updated = undefined;
                }
            }
            else {
                updated = ts.visitEachChild(node, visitor, context);
            }
            exitSubtree(ancestorFacts, 0 /* None */, 0 /* None */);
            return updated;
        }
        /**
         * Visits a VariableDeclarationList that is block scoped (e.g. `let` or `const`).
         *
         * @param node A VariableDeclarationList node.
         */
        function visitVariableDeclarationList(node) {
            if (node.transformFlags & 64 /* ES2015 */) {
                if (node.flags & ts.NodeFlags.BlockScoped) {
                    enableSubstitutionsForBlockScopedBindings();
                }
                const declarations = ts.flatMap(node.declarations, node.flags & ts.NodeFlags.Let
                    ? visitVariableDeclarationInLetDeclarationList
                    : visitVariableDeclaration);
                const declarationList = ts.createVariableDeclarationList(declarations);
                ts.setOriginalNode(declarationList, node);
                ts.setTextRange(declarationList, node);
                ts.setCommentRange(declarationList, node);
                if (node.transformFlags & 8388608 /* ContainsBindingPattern */
                    && (ts.isBindingPattern(node.declarations[0].name) || ts.isBindingPattern(ts.lastOrUndefined(node.declarations).name))) {
                    // If the first or last declaration is a binding pattern, we need to modify
                    // the source map range for the declaration list.
                    const firstDeclaration = ts.firstOrUndefined(declarations);
                    if (firstDeclaration) {
                        const lastDeclaration = ts.lastOrUndefined(declarations);
                        ts.setSourceMapRange(declarationList, ts.createRange(firstDeclaration.pos, lastDeclaration.end));
                    }
                }
                return declarationList;
            }
            return ts.visitEachChild(node, visitor, context);
        }
        /**
         * Gets a value indicating whether we should emit an explicit initializer for a variable
         * declaration in a `let` declaration list.
         *
         * @param node A VariableDeclaration node.
         */
        function shouldEmitExplicitInitializerForLetDeclaration(node) {
            // Nested let bindings might need to be initialized explicitly to preserve
            // ES6 semantic:
            //
            //  { let x = 1; }
            //  { let x; } // x here should be undefined. not 1
            //
            // Top level bindings never collide with anything and thus don't require
            // explicit initialization. As for nested let bindings there are two cases:
            //
            // - Nested let bindings that were not renamed definitely should be
            //   initialized explicitly:
            //
            //    { let x = 1; }
            //    { let x; if (some-condition) { x = 1}; if (x) { /*1*/ } }
            //
            //   Without explicit initialization code in /*1*/ can be executed even if
            //   some-condition is evaluated to false.
            //
            // - Renaming introduces fresh name that should not collide with any
            //   existing names, however renamed bindings sometimes also should be
            //   explicitly initialized. One particular case: non-captured binding
            //   declared inside loop body (but not in loop initializer):
            //
            //    let x;
            //    for (;;) {
            //        let x;
            //    }
            //
            //   In downlevel codegen inner 'x' will be renamed so it won't collide
            //   with outer 'x' however it will should be reset on every iteration as
            //   if it was declared anew.
            //
            //   * Why non-captured binding?
            //     - Because if loop contains block scoped binding captured in some
            //       function then loop body will be rewritten to have a fresh scope
            //       on every iteration so everything will just work.
            //
            //   * Why loop initializer is excluded?
            //     - Since we've introduced a fresh name it already will be undefined.
            const flags = resolver.getNodeCheckFlags(node);
            const isCapturedInFunction = flags & 131072 /* CapturedBlockScopedBinding */;
            const isDeclaredInLoop = flags & 262144 /* BlockScopedBindingInLoop */;
            const emittedAsTopLevel = (hierarchyFacts & 64 /* TopLevel */) !== 0
                || (isCapturedInFunction
                    && isDeclaredInLoop
                    && (hierarchyFacts & 512 /* IterationStatementBlock */) !== 0);
            const emitExplicitInitializer = !emittedAsTopLevel
                && (hierarchyFacts & 2048 /* ForInOrForOfStatement */) === 0
                && (!resolver.isDeclarationWithCollidingName(node)
                    || (isDeclaredInLoop
                        && !isCapturedInFunction
                        && (hierarchyFacts & (1024 /* ForStatement */ | 2048 /* ForInOrForOfStatement */)) === 0));
            return emitExplicitInitializer;
        }
        /**
         * Visits a VariableDeclaration in a `let` declaration list.
         *
         * @param node A VariableDeclaration node.
         */
        function visitVariableDeclarationInLetDeclarationList(node) {
            // For binding pattern names that lack initializers there is no point to emit
            // explicit initializer since downlevel codegen for destructuring will fail
            // in the absence of initializer so all binding elements will say uninitialized
            const name = node.name;
            if (ts.isBindingPattern(name)) {
                return visitVariableDeclaration(node);
            }
            if (!node.initializer && shouldEmitExplicitInitializerForLetDeclaration(node)) {
                const clone = ts.getMutableClone(node);
                clone.initializer = ts.createVoidZero();
                return clone;
            }
            return ts.visitEachChild(node, visitor, context);
        }
        /**
         * Visits a VariableDeclaration node with a binding pattern.
         *
         * @param node A VariableDeclaration node.
         */
        function visitVariableDeclaration(node) {
            const ancestorFacts = enterSubtree(32 /* ExportedVariableStatement */, 0 /* None */);
            let updated;
            if (ts.isBindingPattern(node.name)) {
                updated = ts.flattenDestructuringBinding(node, visitor, context, 0 /* All */, 
                /*value*/ undefined, (ancestorFacts & 32 /* ExportedVariableStatement */) !== 0);
            }
            else {
                updated = ts.visitEachChild(node, visitor, context);
            }
            exitSubtree(ancestorFacts, 0 /* None */, 0 /* None */);
            return updated;
        }
        function recordLabel(node) {
            convertedLoopState.labels.set(ts.idText(node.label), true);
        }
        function resetLabel(node) {
            convertedLoopState.labels.set(ts.idText(node.label), false);
        }
        function visitLabeledStatement(node) {
            if (convertedLoopState && !convertedLoopState.labels) {
                convertedLoopState.labels = ts.createMap();
            }
            const statement = ts.unwrapInnermostStatementOfLabel(node, convertedLoopState && recordLabel);
            return ts.isIterationStatement(statement, /*lookInLabeledStatements*/ false)
                ? visitIterationStatement(statement, /*outermostLabeledStatement*/ node)
                : ts.restoreEnclosingLabel(ts.visitNode(statement, visitor, ts.isStatement), node, convertedLoopState && resetLabel);
        }
        function visitIterationStatement(node, outermostLabeledStatement) {
            switch (node.kind) {
                case ts.SyntaxKind.DoStatement:
                case ts.SyntaxKind.WhileStatement:
                    return visitDoOrWhileStatement(node, outermostLabeledStatement);
                case ts.SyntaxKind.ForStatement:
                    return visitForStatement(node, outermostLabeledStatement);
                case ts.SyntaxKind.ForInStatement:
                    return visitForInStatement(node, outermostLabeledStatement);
                case ts.SyntaxKind.ForOfStatement:
                    return visitForOfStatement(node, outermostLabeledStatement);
            }
        }
        function visitIterationStatementWithFacts(excludeFacts, includeFacts, node, outermostLabeledStatement, convert) {
            const ancestorFacts = enterSubtree(excludeFacts, includeFacts);
            const updated = convertIterationStatementBodyIfNecessary(node, outermostLabeledStatement, convert);
            exitSubtree(ancestorFacts, 0 /* None */, 0 /* None */);
            return updated;
        }
        function visitDoOrWhileStatement(node, outermostLabeledStatement) {
            return visitIterationStatementWithFacts(0 /* DoOrWhileStatementExcludes */, 256 /* DoOrWhileStatementIncludes */, node, outermostLabeledStatement);
        }
        function visitForStatement(node, outermostLabeledStatement) {
            return visitIterationStatementWithFacts(3008 /* ForStatementExcludes */, 1280 /* ForStatementIncludes */, node, outermostLabeledStatement);
        }
        function visitForInStatement(node, outermostLabeledStatement) {
            return visitIterationStatementWithFacts(1984 /* ForInOrForOfStatementExcludes */, 2304 /* ForInOrForOfStatementIncludes */, node, outermostLabeledStatement);
        }
        function visitForOfStatement(node, outermostLabeledStatement) {
            return visitIterationStatementWithFacts(1984 /* ForInOrForOfStatementExcludes */, 2304 /* ForInOrForOfStatementIncludes */, node, outermostLabeledStatement, compilerOptions.downlevelIteration ? convertForOfStatementForIterable : convertForOfStatementForArray);
        }
        function convertForOfStatementHead(node, boundValue, convertedLoopBodyStatements) {
            const statements = [];
            if (ts.isVariableDeclarationList(node.initializer)) {
                if (node.initializer.flags & ts.NodeFlags.BlockScoped) {
                    enableSubstitutionsForBlockScopedBindings();
                }
                const firstOriginalDeclaration = ts.firstOrUndefined(node.initializer.declarations);
                if (firstOriginalDeclaration && ts.isBindingPattern(firstOriginalDeclaration.name)) {
                    // This works whether the declaration is a var, let, or const.
                    // It will use rhsIterationValue _a[_i] as the initializer.
                    const declarations = ts.flattenDestructuringBinding(firstOriginalDeclaration, visitor, context, 0 /* All */, boundValue);
                    const declarationList = ts.setTextRange(ts.createVariableDeclarationList(declarations), node.initializer);
                    ts.setOriginalNode(declarationList, node.initializer);
                    // Adjust the source map range for the first declaration to align with the old
                    // emitter.
                    const firstDeclaration = declarations[0];
                    const lastDeclaration = ts.lastOrUndefined(declarations);
                    ts.setSourceMapRange(declarationList, ts.createRange(firstDeclaration.pos, lastDeclaration.end));
                    statements.push(ts.createVariableStatement(
                    /*modifiers*/ undefined, declarationList));
                }
                else {
                    // The following call does not include the initializer, so we have
                    // to emit it separately.
                    statements.push(ts.setTextRange(ts.createVariableStatement(
                    /*modifiers*/ undefined, ts.setOriginalNode(ts.setTextRange(ts.createVariableDeclarationList([
                        ts.createVariableDeclaration(firstOriginalDeclaration ? firstOriginalDeclaration.name : ts.createTempVariable(/*recordTempVariable*/ undefined), 
                        /*type*/ undefined, boundValue)
                    ]), ts.moveRangePos(node.initializer, -1)), node.initializer)), ts.moveRangeEnd(node.initializer, -1)));
                }
            }
            else {
                // Initializer is an expression. Emit the expression in the body, so that it's
                // evaluated on every iteration.
                const assignment = ts.createAssignment(node.initializer, boundValue);
                if (ts.isDestructuringAssignment(assignment)) {
                    ts.aggregateTransformFlags(assignment);
                    statements.push(ts.createStatement(visitBinaryExpression(assignment, /*needsDestructuringValue*/ false)));
                }
                else {
                    assignment.end = node.initializer.end;
                    statements.push(ts.setTextRange(ts.createStatement(ts.visitNode(assignment, visitor, ts.isExpression)), ts.moveRangeEnd(node.initializer, -1)));
                }
            }
            if (convertedLoopBodyStatements) {
                return createSyntheticBlockForConvertedStatements(ts.addRange(statements, convertedLoopBodyStatements));
            }
            else {
                const statement = ts.visitNode(node.statement, visitor, ts.isStatement, ts.liftToBlock);
                if (ts.isBlock(statement)) {
                    return ts.updateBlock(statement, ts.setTextRange(ts.createNodeArray(ts.concatenate(statements, statement.statements)), statement.statements));
                }
                else {
                    statements.push(statement);
                    return createSyntheticBlockForConvertedStatements(statements);
                }
            }
        }
        function createSyntheticBlockForConvertedStatements(statements) {
            return ts.setEmitFlags(ts.createBlock(ts.createNodeArray(statements), 
            /*multiLine*/ true), ts.EmitFlags.NoSourceMap | ts.EmitFlags.NoTokenSourceMaps);
        }
        function convertForOfStatementForArray(node, outermostLabeledStatement, convertedLoopBodyStatements) {
            // The following ES6 code:
            //
            //    for (let v of expr) { }
            //
            // should be emitted as
            //
            //    for (var _i = 0, _a = expr; _i < _a.length; _i++) {
            //        var v = _a[_i];
            //    }
            //
            // where _a and _i are temps emitted to capture the RHS and the counter,
            // respectively.
            // When the left hand side is an expression instead of a let declaration,
            // the "let v" is not emitted.
            // When the left hand side is a let/const, the v is renamed if there is
            // another v in scope.
            // Note that all assignments to the LHS are emitted in the body, including
            // all destructuring.
            // Note also that because an extra statement is needed to assign to the LHS,
            // for-of bodies are always emitted as blocks.
            const expression = ts.visitNode(node.expression, visitor, ts.isExpression);
            // In the case where the user wrote an identifier as the RHS, like this:
            //
            //     for (let v of arr) { }
            //
            // we don't want to emit a temporary variable for the RHS, just use it directly.
            const counter = ts.createLoopVariable();
            const rhsReference = ts.isIdentifier(expression) ? ts.getGeneratedNameForNode(expression) : ts.createTempVariable(/*recordTempVariable*/ undefined);
            // The old emitter does not emit source maps for the expression
            ts.setEmitFlags(expression, ts.EmitFlags.NoSourceMap | ts.getEmitFlags(expression));
            const forStatement = ts.setTextRange(ts.createFor(
            /*initializer*/ ts.setEmitFlags(ts.setTextRange(ts.createVariableDeclarationList([
                ts.setTextRange(ts.createVariableDeclaration(counter, /*type*/ undefined, ts.createLiteral(0)), ts.moveRangePos(node.expression, -1)),
                ts.setTextRange(ts.createVariableDeclaration(rhsReference, /*type*/ undefined, expression), node.expression)
            ]), node.expression), ts.EmitFlags.NoHoisting), 
            /*condition*/ ts.setTextRange(ts.createLessThan(counter, ts.createPropertyAccess(rhsReference, "length")), node.expression), 
            /*incrementor*/ ts.setTextRange(ts.createPostfixIncrement(counter), node.expression), 
            /*statement*/ convertForOfStatementHead(node, ts.createElementAccess(rhsReference, counter), convertedLoopBodyStatements)), 
            /*location*/ node);
            // Disable trailing source maps for the OpenParenToken to align source map emit with the old emitter.
            ts.setEmitFlags(forStatement, ts.EmitFlags.NoTokenTrailingSourceMaps);
            ts.setTextRange(forStatement, node);
            return ts.restoreEnclosingLabel(forStatement, outermostLabeledStatement, convertedLoopState && resetLabel);
        }
        function convertForOfStatementForIterable(node, outermostLabeledStatement, convertedLoopBodyStatements) {
            const expression = ts.visitNode(node.expression, visitor, ts.isExpression);
            const iterator = ts.isIdentifier(expression) ? ts.getGeneratedNameForNode(expression) : ts.createTempVariable(/*recordTempVariable*/ undefined);
            const result = ts.isIdentifier(expression) ? ts.getGeneratedNameForNode(iterator) : ts.createTempVariable(/*recordTempVariable*/ undefined);
            const errorRecord = ts.createUniqueName("e");
            const catchVariable = ts.getGeneratedNameForNode(errorRecord);
            const returnMethod = ts.createTempVariable(/*recordTempVariable*/ undefined);
            const values = ts.createValuesHelper(context, expression, node.expression);
            const next = ts.createCall(ts.createPropertyAccess(iterator, "next"), /*typeArguments*/ undefined, []);
            hoistVariableDeclaration(errorRecord);
            hoistVariableDeclaration(returnMethod);
            const forStatement = ts.setEmitFlags(ts.setTextRange(ts.createFor(
            /*initializer*/ ts.setEmitFlags(ts.setTextRange(ts.createVariableDeclarationList([
                ts.setTextRange(ts.createVariableDeclaration(iterator, /*type*/ undefined, values), node.expression),
                ts.createVariableDeclaration(result, /*type*/ undefined, next)
            ]), node.expression), ts.EmitFlags.NoHoisting), 
            /*condition*/ ts.createLogicalNot(ts.createPropertyAccess(result, "done")), 
            /*incrementor*/ ts.createAssignment(result, next), 
            /*statement*/ convertForOfStatementHead(node, ts.createPropertyAccess(result, "value"), convertedLoopBodyStatements)), 
            /*location*/ node), ts.EmitFlags.NoTokenTrailingSourceMaps);
            return ts.createTry(ts.createBlock([
                ts.restoreEnclosingLabel(forStatement, outermostLabeledStatement, convertedLoopState && resetLabel)
            ]), ts.createCatchClause(ts.createVariableDeclaration(catchVariable), ts.setEmitFlags(ts.createBlock([
                ts.createStatement(ts.createAssignment(errorRecord, ts.createObjectLiteral([
                    ts.createPropertyAssignment("error", catchVariable)
                ])))
            ]), ts.EmitFlags.SingleLine)), ts.createBlock([
                ts.createTry(
                /*tryBlock*/ ts.createBlock([
                    ts.setEmitFlags(ts.createIf(ts.createLogicalAnd(ts.createLogicalAnd(result, ts.createLogicalNot(ts.createPropertyAccess(result, "done"))), ts.createAssignment(returnMethod, ts.createPropertyAccess(iterator, "return"))), ts.createStatement(ts.createFunctionCall(returnMethod, iterator, []))), ts.EmitFlags.SingleLine),
                ]), 
                /*catchClause*/ undefined, 
                /*finallyBlock*/ ts.setEmitFlags(ts.createBlock([
                    ts.setEmitFlags(ts.createIf(errorRecord, ts.createThrow(ts.createPropertyAccess(errorRecord, "error"))), ts.EmitFlags.SingleLine)
                ]), ts.EmitFlags.SingleLine))
            ]));
        }
        /**
         * Visits an ObjectLiteralExpression with computed property names.
         *
         * @param node An ObjectLiteralExpression node.
         */
        function visitObjectLiteralExpression(node) {
            // We are here because a ComputedPropertyName was used somewhere in the expression.
            const properties = node.properties;
            const numProperties = properties.length;
            // Find the first computed property.
            // Everything until that point can be emitted as part of the initial object literal.
            let numInitialProperties = numProperties;
            let numInitialPropertiesWithoutYield = numProperties;
            for (let i = 0; i < numProperties; i++) {
                const property = properties[i];
                if ((property.transformFlags & 16777216 /* ContainsYield */ && hierarchyFacts & 4 /* AsyncFunctionBody */)
                    && i < numInitialPropertiesWithoutYield) {
                    numInitialPropertiesWithoutYield = i;
                }
                if (property.name.kind === ts.SyntaxKind.ComputedPropertyName) {
                    numInitialProperties = i;
                    break;
                }
            }
            if (numInitialProperties !== numProperties) {
                if (numInitialPropertiesWithoutYield < numInitialProperties) {
                    numInitialProperties = numInitialPropertiesWithoutYield;
                }
                // For computed properties, we need to create a unique handle to the object
                // literal so we can modify it without risking internal assignments tainting the object.
                const temp = ts.createTempVariable(hoistVariableDeclaration);
                // Write out the first non-computed properties, then emit the rest through indexing on the temp variable.
                const expressions = [];
                const assignment = ts.createAssignment(temp, ts.setEmitFlags(ts.createObjectLiteral(ts.visitNodes(properties, visitor, ts.isObjectLiteralElementLike, 0, numInitialProperties), node.multiLine), ts.EmitFlags.Indented));
                if (node.multiLine) {
                    ts.startOnNewLine(assignment);
                }
                expressions.push(assignment);
                addObjectLiteralMembers(expressions, node, temp, numInitialProperties);
                // We need to clone the temporary identifier so that we can write it on a
                // new line
                expressions.push(node.multiLine ? ts.startOnNewLine(ts.getMutableClone(temp)) : temp);
                return ts.inlineExpressions(expressions);
            }
            return ts.visitEachChild(node, visitor, context);
        }
        function shouldConvertIterationStatementBody(node) {
            return (resolver.getNodeCheckFlags(node) & 65536 /* LoopWithCapturedBlockScopedBinding */) !== 0;
        }
        /**
         * Records constituents of name for the given variable to be hoisted in the outer scope.
         */
        function hoistVariableDeclarationDeclaredInConvertedLoop(state, node) {
            if (!state.hoistedLocalVariables) {
                state.hoistedLocalVariables = [];
            }
            visit(node.name);
            function visit(node) {
                if (node.kind === ts.SyntaxKind.Identifier) {
                    state.hoistedLocalVariables.push(node);
                }
                else {
                    for (const element of node.elements) {
                        if (!ts.isOmittedExpression(element)) {
                            visit(element.name);
                        }
                    }
                }
            }
        }
        function convertIterationStatementBodyIfNecessary(node, outermostLabeledStatement, convert) {
            if (!shouldConvertIterationStatementBody(node)) {
                let saveAllowedNonLabeledJumps;
                if (convertedLoopState) {
                    // we get here if we are trying to emit normal loop loop inside converted loop
                    // set allowedNonLabeledJumps to Break | Continue to mark that break\continue inside the loop should be emitted as is
                    saveAllowedNonLabeledJumps = convertedLoopState.allowedNonLabeledJumps;
                    convertedLoopState.allowedNonLabeledJumps = 2 /* Break */ | 4 /* Continue */;
                }
                const result = convert
                    ? convert(node, outermostLabeledStatement, /*convertedLoopBodyStatements*/ undefined)
                    : ts.restoreEnclosingLabel(ts.visitEachChild(node, visitor, context), outermostLabeledStatement, convertedLoopState && resetLabel);
                if (convertedLoopState) {
                    convertedLoopState.allowedNonLabeledJumps = saveAllowedNonLabeledJumps;
                }
                return result;
            }
            const functionName = ts.createUniqueName("_loop");
            let loopInitializer;
            switch (node.kind) {
                case ts.SyntaxKind.ForStatement:
                case ts.SyntaxKind.ForInStatement:
                case ts.SyntaxKind.ForOfStatement:
                    const initializer = node.initializer;
                    if (initializer && initializer.kind === ts.SyntaxKind.VariableDeclarationList) {
                        loopInitializer = initializer;
                    }
                    break;
            }
            // variables that will be passed to the loop as parameters
            const loopParameters = [];
            // variables declared in the loop initializer that will be changed inside the loop
            const loopOutParameters = [];
            if (loopInitializer && (ts.getCombinedNodeFlags(loopInitializer) & ts.NodeFlags.BlockScoped)) {
                for (const decl of loopInitializer.declarations) {
                    processLoopVariableDeclaration(decl, loopParameters, loopOutParameters);
                }
            }
            const outerConvertedLoopState = convertedLoopState;
            convertedLoopState = { loopOutParameters };
            if (outerConvertedLoopState) {
                // convertedOuterLoopState !== undefined means that this converted loop is nested in another converted loop.
                // if outer converted loop has already accumulated some state - pass it through
                if (outerConvertedLoopState.argumentsName) {
                    // outer loop has already used 'arguments' so we've already have some name to alias it
                    // use the same name in all nested loops
                    convertedLoopState.argumentsName = outerConvertedLoopState.argumentsName;
                }
                if (outerConvertedLoopState.thisName) {
                    // outer loop has already used 'this' so we've already have some name to alias it
                    // use the same name in all nested loops
                    convertedLoopState.thisName = outerConvertedLoopState.thisName;
                }
                if (outerConvertedLoopState.hoistedLocalVariables) {
                    // we've already collected some non-block scoped variable declarations in enclosing loop
                    // use the same storage in nested loop
                    convertedLoopState.hoistedLocalVariables = outerConvertedLoopState.hoistedLocalVariables;
                }
            }
            startLexicalEnvironment();
            let loopBody = ts.visitNode(node.statement, visitor, ts.isStatement, ts.liftToBlock);
            const lexicalEnvironment = endLexicalEnvironment();
            const currentState = convertedLoopState;
            convertedLoopState = outerConvertedLoopState;
            if (loopOutParameters.length || lexicalEnvironment) {
                const statements = ts.isBlock(loopBody) ? loopBody.statements.slice() : [loopBody];
                if (loopOutParameters.length) {
                    copyOutParameters(loopOutParameters, 1 /* ToOutParameter */, statements);
                }
                ts.addRange(statements, lexicalEnvironment);
                loopBody = ts.createBlock(statements, /*multiline*/ true);
            }
            if (ts.isBlock(loopBody)) {
                loopBody.multiLine = true;
            }
            else {
                loopBody = ts.createBlock([loopBody], /*multiline*/ true);
            }
            const containsYield = (node.statement.transformFlags & 16777216 /* ContainsYield */) !== 0;
            const isAsyncBlockContainingAwait = containsYield && (hierarchyFacts & 4 /* AsyncFunctionBody */) !== 0;
            let loopBodyFlags = 0;
            if (currentState.containsLexicalThis) {
                loopBodyFlags |= ts.EmitFlags.CapturesThis;
            }
            if (isAsyncBlockContainingAwait) {
                loopBodyFlags |= ts.EmitFlags.AsyncFunctionBody;
            }
            const convertedLoopVariable = ts.createVariableStatement(
            /*modifiers*/ undefined, ts.setEmitFlags(ts.createVariableDeclarationList([
                ts.createVariableDeclaration(functionName, 
                /*type*/ undefined, ts.setEmitFlags(ts.createFunctionExpression(
                /*modifiers*/ undefined, containsYield ? ts.createToken(ts.SyntaxKind.AsteriskToken) : undefined, 
                /*name*/ undefined, 
                /*typeParameters*/ undefined, loopParameters, 
                /*type*/ undefined, loopBody), loopBodyFlags))
            ]), ts.EmitFlags.NoHoisting));
            const statements = [convertedLoopVariable];
            let extraVariableDeclarations;
            // propagate state from the inner loop to the outer loop if necessary
            if (currentState.argumentsName) {
                // if alias for arguments is set
                if (outerConvertedLoopState) {
                    // pass it to outer converted loop
                    outerConvertedLoopState.argumentsName = currentState.argumentsName;
                }
                else {
                    // this is top level converted loop and we need to create an alias for 'arguments' object
                    (extraVariableDeclarations || (extraVariableDeclarations = [])).push(ts.createVariableDeclaration(currentState.argumentsName, 
                    /*type*/ undefined, ts.createIdentifier("arguments")));
                }
            }
            if (currentState.thisName) {
                // if alias for this is set
                if (outerConvertedLoopState) {
                    // pass it to outer converted loop
                    outerConvertedLoopState.thisName = currentState.thisName;
                }
                else {
                    // this is top level converted loop so we need to create an alias for 'this' here
                    // NOTE:
                    // if converted loops were all nested in arrow function then we'll always emit '_this' so convertedLoopState.thisName will not be set.
                    // If it is set this means that all nested loops are not nested in arrow function and it is safe to capture 'this'.
                    (extraVariableDeclarations || (extraVariableDeclarations = [])).push(ts.createVariableDeclaration(currentState.thisName, 
                    /*type*/ undefined, ts.createIdentifier("this")));
                }
            }
            if (currentState.hoistedLocalVariables) {
                // if hoistedLocalVariables !== undefined this means that we've possibly collected some variable declarations to be hoisted later
                if (outerConvertedLoopState) {
                    // pass them to outer converted loop
                    outerConvertedLoopState.hoistedLocalVariables = currentState.hoistedLocalVariables;
                }
                else {
                    if (!extraVariableDeclarations) {
                        extraVariableDeclarations = [];
                    }
                    // hoist collected variable declarations
                    for (const identifier of currentState.hoistedLocalVariables) {
                        extraVariableDeclarations.push(ts.createVariableDeclaration(identifier));
                    }
                }
            }
            // add extra variables to hold out parameters if necessary
            if (loopOutParameters.length) {
                if (!extraVariableDeclarations) {
                    extraVariableDeclarations = [];
                }
                for (const outParam of loopOutParameters) {
                    extraVariableDeclarations.push(ts.createVariableDeclaration(outParam.outParamName));
                }
            }
            // create variable statement to hold all introduced variable declarations
            if (extraVariableDeclarations) {
                statements.push(ts.createVariableStatement(
                /*modifiers*/ undefined, ts.createVariableDeclarationList(extraVariableDeclarations)));
            }
            const convertedLoopBodyStatements = generateCallToConvertedLoop(functionName, loopParameters, currentState, containsYield);
            let loop;
            if (convert) {
                loop = convert(node, outermostLabeledStatement, convertedLoopBodyStatements);
            }
            else {
                let clone = ts.getMutableClone(node);
                // clean statement part
                clone.statement = undefined;
                // visit childnodes to transform initializer/condition/incrementor parts
                clone = ts.visitEachChild(clone, visitor, context);
                // set loop statement
                clone.statement = ts.createBlock(convertedLoopBodyStatements, /*multiline*/ true);
                // reset and re-aggregate the transform flags
                clone.transformFlags = 0;
                ts.aggregateTransformFlags(clone);
                loop = ts.restoreEnclosingLabel(clone, outermostLabeledStatement, convertedLoopState && resetLabel);
            }
            statements.push(loop);
            return statements;
        }
        function copyOutParameter(outParam, copyDirection) {
            const source = copyDirection === 0 /* ToOriginal */ ? outParam.outParamName : outParam.originalName;
            const target = copyDirection === 0 /* ToOriginal */ ? outParam.originalName : outParam.outParamName;
            return ts.createBinary(target, ts.SyntaxKind.EqualsToken, source);
        }
        function copyOutParameters(outParams, copyDirection, statements) {
            for (const outParam of outParams) {
                statements.push(ts.createStatement(copyOutParameter(outParam, copyDirection)));
            }
        }
        function generateCallToConvertedLoop(loopFunctionExpressionName, parameters, state, isAsyncBlockContainingAwait) {
            const outerConvertedLoopState = convertedLoopState;
            const statements = [];
            // loop is considered simple if it does not have any return statements or break\continue that transfer control outside of the loop
            // simple loops are emitted as just 'loop()';
            // NOTE: if loop uses only 'continue' it still will be emitted as simple loop
            const isSimpleLoop = !(state.nonLocalJumps & ~4 /* Continue */) &&
                !state.labeledNonLocalBreaks &&
                !state.labeledNonLocalContinues;
            const call = ts.createCall(loopFunctionExpressionName, /*typeArguments*/ undefined, ts.map(parameters, p => p.name));
            const callResult = isAsyncBlockContainingAwait
                ? ts.createYield(ts.createToken(ts.SyntaxKind.AsteriskToken), ts.setEmitFlags(call, ts.EmitFlags.Iterator))
                : call;
            if (isSimpleLoop) {
                statements.push(ts.createStatement(callResult));
                copyOutParameters(state.loopOutParameters, 0 /* ToOriginal */, statements);
            }
            else {
                const loopResultName = ts.createUniqueName("state");
                const stateVariable = ts.createVariableStatement(
                /*modifiers*/ undefined, ts.createVariableDeclarationList([ts.createVariableDeclaration(loopResultName, /*type*/ undefined, callResult)]));
                statements.push(stateVariable);
                copyOutParameters(state.loopOutParameters, 0 /* ToOriginal */, statements);
                if (state.nonLocalJumps & 8 /* Return */) {
                    let returnStatement;
                    if (outerConvertedLoopState) {
                        outerConvertedLoopState.nonLocalJumps |= 8 /* Return */;
                        returnStatement = ts.createReturn(loopResultName);
                    }
                    else {
                        returnStatement = ts.createReturn(ts.createPropertyAccess(loopResultName, "value"));
                    }
                    statements.push(ts.createIf(ts.createBinary(ts.createTypeOf(loopResultName), ts.SyntaxKind.EqualsEqualsEqualsToken, ts.createLiteral("object")), returnStatement));
                }
                if (state.nonLocalJumps & 2 /* Break */) {
                    statements.push(ts.createIf(ts.createBinary(loopResultName, ts.SyntaxKind.EqualsEqualsEqualsToken, ts.createLiteral("break")), ts.createBreak()));
                }
                if (state.labeledNonLocalBreaks || state.labeledNonLocalContinues) {
                    const caseClauses = [];
                    processLabeledJumps(state.labeledNonLocalBreaks, /*isBreak*/ true, loopResultName, outerConvertedLoopState, caseClauses);
                    processLabeledJumps(state.labeledNonLocalContinues, /*isBreak*/ false, loopResultName, outerConvertedLoopState, caseClauses);
                    statements.push(ts.createSwitch(loopResultName, ts.createCaseBlock(caseClauses)));
                }
            }
            return statements;
        }
        function setLabeledJump(state, isBreak, labelText, labelMarker) {
            if (isBreak) {
                if (!state.labeledNonLocalBreaks) {
                    state.labeledNonLocalBreaks = ts.createMap();
                }
                state.labeledNonLocalBreaks.set(labelText, labelMarker);
            }
            else {
                if (!state.labeledNonLocalContinues) {
                    state.labeledNonLocalContinues = ts.createMap();
                }
                state.labeledNonLocalContinues.set(labelText, labelMarker);
            }
        }
        function processLabeledJumps(table, isBreak, loopResultName, outerLoop, caseClauses) {
            if (!table) {
                return;
            }
            table.forEach((labelMarker, labelText) => {
                const statements = [];
                // if there are no outer converted loop or outer label in question is located inside outer converted loop
                // then emit labeled break\continue
                // otherwise propagate pair 'label -> marker' to outer converted loop and emit 'return labelMarker' so outer loop can later decide what to do
                if (!outerLoop || (outerLoop.labels && outerLoop.labels.get(labelText))) {
                    const label = ts.createIdentifier(labelText);
                    statements.push(isBreak ? ts.createBreak(label) : ts.createContinue(label));
                }
                else {
                    setLabeledJump(outerLoop, isBreak, labelText, labelMarker);
                    statements.push(ts.createReturn(loopResultName));
                }
                caseClauses.push(ts.createCaseClause(ts.createLiteral(labelMarker), statements));
            });
        }
        function processLoopVariableDeclaration(decl, loopParameters, loopOutParameters) {
            const name = decl.name;
            if (ts.isBindingPattern(name)) {
                for (const element of name.elements) {
                    if (!ts.isOmittedExpression(element)) {
                        processLoopVariableDeclaration(element, loopParameters, loopOutParameters);
                    }
                }
            }
            else {
                loopParameters.push(ts.createParameter(/*decorators*/ undefined, /*modifiers*/ undefined, /*dotDotDotToken*/ undefined, name));
                if (resolver.getNodeCheckFlags(decl) & 2097152 /* NeedsLoopOutParameter */) {
                    const outParamName = ts.createUniqueName("out_" + ts.idText(name));
                    loopOutParameters.push({ originalName: name, outParamName });
                }
            }
        }
        /**
         * Adds the members of an object literal to an array of expressions.
         *
         * @param expressions An array of expressions.
         * @param node An ObjectLiteralExpression node.
         * @param receiver The receiver for members of the ObjectLiteralExpression.
         * @param numInitialNonComputedProperties The number of initial properties without
         *                                        computed property names.
         */
        function addObjectLiteralMembers(expressions, node, receiver, start) {
            const properties = node.properties;
            const numProperties = properties.length;
            for (let i = start; i < numProperties; i++) {
                const property = properties[i];
                switch (property.kind) {
                    case ts.SyntaxKind.GetAccessor:
                    case ts.SyntaxKind.SetAccessor:
                        const accessors = ts.getAllAccessorDeclarations(node.properties, property);
                        if (property === accessors.firstAccessor) {
                            expressions.push(transformAccessorsToExpression(receiver, accessors, node, node.multiLine));
                        }
                        break;
                    case ts.SyntaxKind.MethodDeclaration:
                        expressions.push(transformObjectLiteralMethodDeclarationToExpression(property, receiver, node, node.multiLine));
                        break;
                    case ts.SyntaxKind.PropertyAssignment:
                        expressions.push(transformPropertyAssignmentToExpression(property, receiver, node.multiLine));
                        break;
                    case ts.SyntaxKind.ShorthandPropertyAssignment:
                        expressions.push(transformShorthandPropertyAssignmentToExpression(property, receiver, node.multiLine));
                        break;
                    default:
                        ts.Debug.failBadSyntaxKind(node);
                        break;
                }
            }
        }
        /**
         * Transforms a PropertyAssignment node into an expression.
         *
         * @param node The ObjectLiteralExpression that contains the PropertyAssignment.
         * @param property The PropertyAssignment node.
         * @param receiver The receiver for the assignment.
         */
        function transformPropertyAssignmentToExpression(property, receiver, startsOnNewLine) {
            const expression = ts.createAssignment(ts.createMemberAccessForPropertyName(receiver, ts.visitNode(property.name, visitor, ts.isPropertyName)), ts.visitNode(property.initializer, visitor, ts.isExpression));
            ts.setTextRange(expression, property);
            if (startsOnNewLine) {
                ts.startOnNewLine(expression);
            }
            return expression;
        }
        /**
         * Transforms a ShorthandPropertyAssignment node into an expression.
         *
         * @param node The ObjectLiteralExpression that contains the ShorthandPropertyAssignment.
         * @param property The ShorthandPropertyAssignment node.
         * @param receiver The receiver for the assignment.
         */
        function transformShorthandPropertyAssignmentToExpression(property, receiver, startsOnNewLine) {
            const expression = ts.createAssignment(ts.createMemberAccessForPropertyName(receiver, ts.visitNode(property.name, visitor, ts.isPropertyName)), ts.getSynthesizedClone(property.name));
            ts.setTextRange(expression, property);
            if (startsOnNewLine) {
                ts.startOnNewLine(expression);
            }
            return expression;
        }
        /**
         * Transforms a MethodDeclaration of an ObjectLiteralExpression into an expression.
         *
         * @param node The ObjectLiteralExpression that contains the MethodDeclaration.
         * @param method The MethodDeclaration node.
         * @param receiver The receiver for the assignment.
         */
        function transformObjectLiteralMethodDeclarationToExpression(method, receiver, container, startsOnNewLine) {
            const ancestorFacts = enterSubtree(0 /* None */, 0 /* None */);
            const expression = ts.createAssignment(ts.createMemberAccessForPropertyName(receiver, ts.visitNode(method.name, visitor, ts.isPropertyName)), transformFunctionLikeToExpression(method, /*location*/ method, /*name*/ undefined, container));
            ts.setTextRange(expression, method);
            if (startsOnNewLine) {
                ts.startOnNewLine(expression);
            }
            exitSubtree(ancestorFacts, 49152 /* PropagateNewTargetMask */, hierarchyFacts & 49152 /* PropagateNewTargetMask */ ? 16384 /* NewTarget */ : 0 /* None */);
            return expression;
        }
        function visitCatchClause(node) {
            const ancestorFacts = enterSubtree(4032 /* BlockScopeExcludes */, 0 /* BlockScopeIncludes */);
            let updated;
            ts.Debug.assert(!!node.variableDeclaration, "Catch clause variable should always be present when downleveling ES2015.");
            if (ts.isBindingPattern(node.variableDeclaration.name)) {
                const temp = ts.createTempVariable(/*recordTempVariable*/ undefined);
                const newVariableDeclaration = ts.createVariableDeclaration(temp);
                ts.setTextRange(newVariableDeclaration, node.variableDeclaration);
                const vars = ts.flattenDestructuringBinding(node.variableDeclaration, visitor, context, 0 /* All */, temp);
                const list = ts.createVariableDeclarationList(vars);
                ts.setTextRange(list, node.variableDeclaration);
                const destructure = ts.createVariableStatement(/*modifiers*/ undefined, list);
                updated = ts.updateCatchClause(node, newVariableDeclaration, addStatementToStartOfBlock(node.block, destructure));
            }
            else {
                updated = ts.visitEachChild(node, visitor, context);
            }
            exitSubtree(ancestorFacts, 0 /* None */, 0 /* None */);
            return updated;
        }
        function addStatementToStartOfBlock(block, statement) {
            const transformedStatements = ts.visitNodes(block.statements, visitor, ts.isStatement);
            return ts.updateBlock(block, [statement, ...transformedStatements]);
        }
        /**
         * Visits a MethodDeclaration of an ObjectLiteralExpression and transforms it into a
         * PropertyAssignment.
         *
         * @param node A MethodDeclaration node.
         */
        function visitMethodDeclaration(node) {
            // We should only get here for methods on an object literal with regular identifier names.
            // Methods on classes are handled in visitClassDeclaration/visitClassExpression.
            // Methods with computed property names are handled in visitObjectLiteralExpression.
            ts.Debug.assert(!ts.isComputedPropertyName(node.name));
            const functionExpression = transformFunctionLikeToExpression(node, /*location*/ ts.moveRangePos(node, -1), /*name*/ undefined, /*container*/ undefined);
            ts.setEmitFlags(functionExpression, ts.EmitFlags.NoLeadingComments | ts.getEmitFlags(functionExpression));
            return ts.setTextRange(ts.createPropertyAssignment(node.name, functionExpression), 
            /*location*/ node);
        }
        /**
         * Visits an AccessorDeclaration of an ObjectLiteralExpression.
         *
         * @param node An AccessorDeclaration node.
         */
        function visitAccessorDeclaration(node) {
            ts.Debug.assert(!ts.isComputedPropertyName(node.name));
            const savedConvertedLoopState = convertedLoopState;
            convertedLoopState = undefined;
            const ancestorFacts = enterSubtree(16286 /* FunctionExcludes */, 65 /* FunctionIncludes */);
            let updated;
            const parameters = ts.visitParameterList(node.parameters, visitor, context);
            const body = node.transformFlags & (32768 /* ContainsCapturedLexicalThis */ | 128 /* ContainsES2015 */)
                ? transformFunctionBody(node)
                : visitFunctionBodyDownLevel(node);
            if (node.kind === ts.SyntaxKind.GetAccessor) {
                updated = ts.updateGetAccessor(node, node.decorators, node.modifiers, node.name, parameters, node.type, body);
            }
            else {
                updated = ts.updateSetAccessor(node, node.decorators, node.modifiers, node.name, parameters, body);
            }
            exitSubtree(ancestorFacts, 49152 /* PropagateNewTargetMask */, 0 /* None */);
            convertedLoopState = savedConvertedLoopState;
            return updated;
        }
        /**
         * Visits a ShorthandPropertyAssignment and transforms it into a PropertyAssignment.
         *
         * @param node A ShorthandPropertyAssignment node.
         */
        function visitShorthandPropertyAssignment(node) {
            return ts.setTextRange(ts.createPropertyAssignment(node.name, ts.getSynthesizedClone(node.name)), 
            /*location*/ node);
        }
        function visitComputedPropertyName(node) {
            const ancestorFacts = enterSubtree(0 /* ComputedPropertyNameExcludes */, 8192 /* ComputedPropertyNameIncludes */);
            const updated = ts.visitEachChild(node, visitor, context);
            exitSubtree(ancestorFacts, 49152 /* PropagateNewTargetMask */, hierarchyFacts & 49152 /* PropagateNewTargetMask */ ? 32768 /* NewTargetInComputedPropertyName */ : 0 /* None */);
            return updated;
        }
        /**
         * Visits a YieldExpression node.
         *
         * @param node A YieldExpression node.
         */
        function visitYieldExpression(node) {
            // `yield` expressions are transformed using the generators transformer.
            return ts.visitEachChild(node, visitor, context);
        }
        /**
         * Visits an ArrayLiteralExpression that contains a spread element.
         *
         * @param node An ArrayLiteralExpression node.
         */
        function visitArrayLiteralExpression(node) {
            if (node.transformFlags & 64 /* ES2015 */) {
                // We are here because we contain a SpreadElementExpression.
                return transformAndSpreadElements(node.elements, /*needsUniqueCopy*/ true, node.multiLine, /*hasTrailingComma*/ node.elements.hasTrailingComma);
            }
            return ts.visitEachChild(node, visitor, context);
        }
        /**
         * Visits a CallExpression that contains either a spread element or `super`.
         *
         * @param node a CallExpression.
         */
        function visitCallExpression(node) {
            if (ts.getEmitFlags(node) & ts.EmitFlags.TypeScriptClassWrapper) {
                return visitTypeScriptClassWrapper(node);
            }
            if (node.transformFlags & 64 /* ES2015 */) {
                return visitCallExpressionWithPotentialCapturedThisAssignment(node, /*assignToCapturedThis*/ true);
            }
            return ts.updateCall(node, ts.visitNode(node.expression, callExpressionVisitor, ts.isExpression), 
            /*typeArguments*/ undefined, ts.visitNodes(node.arguments, visitor, ts.isExpression));
        }
        function visitTypeScriptClassWrapper(node) {
            // This is a call to a class wrapper function (an IIFE) created by the 'ts' transformer.
            // The wrapper has a form similar to:
            //
            //  (function() {
            //      class C { // 1
            //      }
            //      C.x = 1; // 2
            //      return C;
            //  }())
            //
            // When we transform the class, we end up with something like this:
            //
            //  (function () {
            //      var C = (function () { // 3
            //          function C() {
            //          }
            //          return C; // 4
            //      }());
            //      C.x = 1;
            //      return C;
            //  }())
            //
            // We want to simplify the two nested IIFEs to end up with something like this:
            //
            //  (function () {
            //      function C() {
            //      }
            //      C.x = 1;
            //      return C;
            //  }())
            // We skip any outer expressions in a number of places to get to the innermost
            // expression, but we will restore them later to preserve comments and source maps.
            const body = ts.cast(ts.cast(ts.skipOuterExpressions(node.expression), ts.isArrowFunction).body, ts.isBlock);
            // The class statements are the statements generated by visiting the first statement of the
            // body (1), while all other statements are added to remainingStatements (2)
            const classStatements = ts.visitNodes(body.statements, visitor, ts.isStatement, 0, 1);
            const remainingStatements = ts.visitNodes(body.statements, visitor, ts.isStatement, 1, body.statements.length - 1);
            const varStatement = ts.cast(ts.firstOrUndefined(classStatements), ts.isVariableStatement);
            // We know there is only one variable declaration here as we verified this in an
            // earlier call to isTypeScriptClassWrapper
            const variable = varStatement.declarationList.declarations[0];
            const initializer = ts.skipOuterExpressions(variable.initializer);
            // Under certain conditions, the 'ts' transformer may introduce a class alias, which
            // we see as an assignment, for example:
            //
            //  (function () {
            //      var C = C_1 = (function () {
            //          function C() {
            //          }
            //          C.x = function () { return C_1; }
            //          return C;
            //      }());
            //      C = C_1 = __decorate([dec], C);
            //      return C;
            //      var C_1;
            //  }())
            //
            const aliasAssignment = ts.tryCast(initializer, ts.isAssignmentExpression);
            // The underlying call (3) is another IIFE that may contain a '_super' argument.
            const call = ts.cast(aliasAssignment ? ts.skipOuterExpressions(aliasAssignment.right) : initializer, ts.isCallExpression);
            const func = ts.cast(ts.skipOuterExpressions(call.expression), ts.isFunctionExpression);
            const funcStatements = func.body.statements;
            let classBodyStart = 0;
            let classBodyEnd = -1;
            const statements = [];
            if (aliasAssignment) {
                // If we have a class alias assignment, we need to move it to the down-level constructor
                // function we generated for the class.
                const extendsCall = ts.tryCast(funcStatements[classBodyStart], ts.isExpressionStatement);
                if (extendsCall) {
                    statements.push(extendsCall);
                    classBodyStart++;
                }
                // The next statement is the function declaration.
                statements.push(funcStatements[classBodyStart]);
                classBodyStart++;
                // Add the class alias following the declaration.
                statements.push(ts.createStatement(ts.createAssignment(aliasAssignment.left, ts.cast(variable.name, ts.isIdentifier))));
            }
            // Find the trailing 'return' statement (4)
            while (!ts.isReturnStatement(ts.elementAt(funcStatements, classBodyEnd))) {
                classBodyEnd--;
            }
            // When we extract the statements of the inner IIFE, we exclude the 'return' statement (4)
            // as we already have one that has been introduced by the 'ts' transformer.
            ts.addRange(statements, funcStatements, classBodyStart, classBodyEnd);
            if (classBodyEnd < -1) {
                // If there were any hoisted declarations following the return statement, we should
                // append them.
                ts.addRange(statements, funcStatements, classBodyEnd + 1);
            }
            // Add the remaining statements of the outer wrapper.
            ts.addRange(statements, remainingStatements);
            // The 'es2015' class transform may add an end-of-declaration marker. If so we will add it
            // after the remaining statements from the 'ts' transformer.
            ts.addRange(statements, classStatements, /*start*/ 1);
            // Recreate any outer parentheses or partially-emitted expressions to preserve source map
            // and comment locations.
            return ts.recreateOuterExpressions(node.expression, ts.recreateOuterExpressions(variable.initializer, ts.recreateOuterExpressions(aliasAssignment && aliasAssignment.right, ts.updateCall(call, ts.recreateOuterExpressions(call.expression, ts.updateFunctionExpression(func, 
            /*modifiers*/ undefined, 
            /*asteriskToken*/ undefined, 
            /*name*/ undefined, 
            /*typeParameters*/ undefined, func.parameters, 
            /*type*/ undefined, ts.updateBlock(func.body, statements))), 
            /*typeArguments*/ undefined, call.arguments))));
        }
        function visitImmediateSuperCallInBody(node) {
            return visitCallExpressionWithPotentialCapturedThisAssignment(node, /*assignToCapturedThis*/ false);
        }
        function visitCallExpressionWithPotentialCapturedThisAssignment(node, assignToCapturedThis) {
            // We are here either because SuperKeyword was used somewhere in the expression, or
            // because we contain a SpreadElementExpression.
            if (node.transformFlags & 524288 /* ContainsSpread */ ||
                node.expression.kind === ts.SyntaxKind.SuperKeyword ||
                ts.isSuperProperty(ts.skipOuterExpressions(node.expression))) {
                const { target, thisArg } = ts.createCallBinding(node.expression, hoistVariableDeclaration);
                if (node.expression.kind === ts.SyntaxKind.SuperKeyword) {
                    ts.setEmitFlags(thisArg, ts.EmitFlags.NoSubstitution);
                }
                let resultingCall;
                if (node.transformFlags & 524288 /* ContainsSpread */) {
                    // [source]
                    //      f(...a, b)
                    //      x.m(...a, b)
                    //      super(...a, b)
                    //      super.m(...a, b) // in static
                    //      super.m(...a, b) // in instance
                    //
                    // [output]
                    //      f.apply(void 0, a.concat([b]))
                    //      (_a = x).m.apply(_a, a.concat([b]))
                    //      _super.apply(this, a.concat([b]))
                    //      _super.m.apply(this, a.concat([b]))
                    //      _super.prototype.m.apply(this, a.concat([b]))
                    resultingCall = ts.createFunctionApply(ts.visitNode(target, callExpressionVisitor, ts.isExpression), ts.visitNode(thisArg, visitor, ts.isExpression), transformAndSpreadElements(node.arguments, /*needsUniqueCopy*/ false, /*multiLine*/ false, /*hasTrailingComma*/ false));
                }
                else {
                    // [source]
                    //      super(a)
                    //      super.m(a) // in static
                    //      super.m(a) // in instance
                    //
                    // [output]
                    //      _super.call(this, a)
                    //      _super.m.call(this, a)
                    //      _super.prototype.m.call(this, a)
                    resultingCall = ts.createFunctionCall(ts.visitNode(target, callExpressionVisitor, ts.isExpression), ts.visitNode(thisArg, visitor, ts.isExpression), ts.visitNodes(node.arguments, visitor, ts.isExpression), 
                    /*location*/ node);
                }
                if (node.expression.kind === ts.SyntaxKind.SuperKeyword) {
                    const actualThis = ts.createThis();
                    ts.setEmitFlags(actualThis, ts.EmitFlags.NoSubstitution);
                    const initializer = ts.createLogicalOr(resultingCall, actualThis);
                    resultingCall = assignToCapturedThis
                        ? ts.createAssignment(ts.createFileLevelUniqueName("_this"), initializer)
                        : initializer;
                }
                return ts.setOriginalNode(resultingCall, node);
            }
            return ts.visitEachChild(node, visitor, context);
        }
        /**
         * Visits a NewExpression that contains a spread element.
         *
         * @param node A NewExpression node.
         */
        function visitNewExpression(node) {
            if (node.transformFlags & 524288 /* ContainsSpread */) {
                // We are here because we contain a SpreadElementExpression.
                // [source]
                //      new C(...a)
                //
                // [output]
                //      new ((_a = C).bind.apply(_a, [void 0].concat(a)))()
                const { target, thisArg } = ts.createCallBinding(ts.createPropertyAccess(node.expression, "bind"), hoistVariableDeclaration);
                return ts.createNew(ts.createFunctionApply(ts.visitNode(target, visitor, ts.isExpression), thisArg, transformAndSpreadElements(ts.createNodeArray([ts.createVoidZero(), ...node.arguments]), /*needsUniqueCopy*/ false, /*multiLine*/ false, /*hasTrailingComma*/ false)), 
                /*typeArguments*/ undefined, []);
            }
            return ts.visitEachChild(node, visitor, context);
        }
        /**
         * Transforms an array of Expression nodes that contains a SpreadExpression.
         *
         * @param elements The array of Expression nodes.
         * @param needsUniqueCopy A value indicating whether to ensure that the result is a fresh array.
         * @param multiLine A value indicating whether the result should be emitted on multiple lines.
         */
        function transformAndSpreadElements(elements, needsUniqueCopy, multiLine, hasTrailingComma) {
            // [source]
            //      [a, ...b, c]
            //
            // [output]
            //      [a].concat(b, [c])
            // Map spans of spread expressions into their expressions and spans of other
            // expressions into an array literal.
            const numElements = elements.length;
            const segments = ts.flatten(ts.spanMap(elements, partitionSpread, (partition, visitPartition, _start, end) => visitPartition(partition, multiLine, hasTrailingComma && end === numElements)));
            if (compilerOptions.downlevelIteration) {
                if (segments.length === 1) {
                    const firstSegment = segments[0];
                    if (ts.isCallExpression(firstSegment)
                        && ts.isIdentifier(firstSegment.expression)
                        && (ts.getEmitFlags(firstSegment.expression) & ts.EmitFlags.HelperName)
                        && firstSegment.expression.escapedText === "___spread") {
                        return segments[0];
                    }
                }
                return ts.createSpreadHelper(context, segments);
            }
            else {
                if (segments.length === 1) {
                    const firstElement = elements[0];
                    return needsUniqueCopy && ts.isSpreadElement(firstElement) && firstElement.expression.kind !== ts.SyntaxKind.ArrayLiteralExpression
                        ? ts.createArraySlice(segments[0])
                        : segments[0];
                }
                // Rewrite using the pattern <segment0>.concat(<segment1>, <segment2>, ...)
                return ts.createArrayConcat(segments.shift(), segments);
            }
        }
        function partitionSpread(node) {
            return ts.isSpreadElement(node)
                ? visitSpanOfSpreads
                : visitSpanOfNonSpreads;
        }
        function visitSpanOfSpreads(chunk) {
            return ts.map(chunk, visitExpressionOfSpread);
        }
        function visitSpanOfNonSpreads(chunk, multiLine, hasTrailingComma) {
            return ts.createArrayLiteral(ts.visitNodes(ts.createNodeArray(chunk, hasTrailingComma), visitor, ts.isExpression), multiLine);
        }
        function visitSpreadElement(node) {
            return ts.visitNode(node.expression, visitor, ts.isExpression);
        }
        /**
         * Transforms the expression of a SpreadExpression node.
         *
         * @param node A SpreadExpression node.
         */
        function visitExpressionOfSpread(node) {
            return ts.visitNode(node.expression, visitor, ts.isExpression);
        }
        /**
         * Visits a template literal.
         *
         * @param node A template literal.
         */
        function visitTemplateLiteral(node) {
            return ts.setTextRange(ts.createLiteral(node.text), node);
        }
        /**
         * Visits a string literal with an extended unicode escape.
         *
         * @param node A string literal.
         */
        function visitStringLiteral(node) {
            if (node.hasExtendedUnicodeEscape) {
                return ts.setTextRange(ts.createLiteral(node.text), node);
            }
            return node;
        }
        /**
         * Visits a binary or octal (ES6) numeric literal.
         *
         * @param node A string literal.
         */
        function visitNumericLiteral(node) {
            if (node.numericLiteralFlags & 384 /* BinaryOrOctalSpecifier */) {
                return ts.setTextRange(ts.createNumericLiteral(node.text), node);
            }
            return node;
        }
        /**
         * Visits a TaggedTemplateExpression node.
         *
         * @param node A TaggedTemplateExpression node.
         */
        function visitTaggedTemplateExpression(node) {
            // Visit the tag expression
            const tag = ts.visitNode(node.tag, visitor, ts.isExpression);
            // Build up the template arguments and the raw and cooked strings for the template.
            // We start out with 'undefined' for the first argument and revisit later
            // to avoid walking over the template string twice and shifting all our arguments over after the fact.
            const templateArguments = [undefined];
            const cookedStrings = [];
            const rawStrings = [];
            const template = node.template;
            if (ts.isNoSubstitutionTemplateLiteral(template)) {
                cookedStrings.push(ts.createLiteral(template.text));
                rawStrings.push(getRawLiteral(template));
            }
            else {
                cookedStrings.push(ts.createLiteral(template.head.text));
                rawStrings.push(getRawLiteral(template.head));
                for (const templateSpan of template.templateSpans) {
                    cookedStrings.push(ts.createLiteral(templateSpan.literal.text));
                    rawStrings.push(getRawLiteral(templateSpan.literal));
                    templateArguments.push(ts.visitNode(templateSpan.expression, visitor, ts.isExpression));
                }
            }
            const helperCall = createTemplateObjectHelper(context, ts.createArrayLiteral(cookedStrings), ts.createArrayLiteral(rawStrings));
            // Create a variable to cache the template object if we're in a module.
            // Do not do this in the global scope, as any variable we currently generate could conflict with
            // variables from outside of the current compilation. In the future, we can revisit this behavior.
            if (ts.isExternalModule(currentSourceFile)) {
                const tempVar = ts.createUniqueName("templateObject");
                recordTaggedTemplateString(tempVar);
                templateArguments[0] = ts.createLogicalOr(tempVar, ts.createAssignment(tempVar, helperCall));
            }
            else {
                templateArguments[0] = helperCall;
            }
            return ts.createCall(tag, /*typeArguments*/ undefined, templateArguments);
        }
        /**
         * Creates an ES5 compatible literal from an ES6 template literal.
         *
         * @param node The ES6 template literal.
         */
        function getRawLiteral(node) {
            // Find original source text, since we need to emit the raw strings of the tagged template.
            // The raw strings contain the (escaped) strings of what the user wrote.
            // Examples: `\n` is converted to "\\n", a template string with a newline to "\n".
            let text = ts.getSourceTextOfNodeFromSourceFile(currentSourceFile, node);
            // text contains the original source, it will also contain quotes ("`"), dolar signs and braces ("${" and "}"),
            // thus we need to remove those characters.
            // First template piece starts with "`", others with "}"
            // Last template piece ends with "`", others with "${"
            const isLast = node.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral || node.kind === ts.SyntaxKind.TemplateTail;
            text = text.substring(1, text.length - (isLast ? 1 : 2));
            // Newline normalization:
            // ES6 Spec 11.8.6.1 - Static Semantics of TV's and TRV's
            // <CR><LF> and <CR> LineTerminatorSequences are normalized to <LF> for both TV and TRV.
            text = text.replace(/\r\n?/g, "\n");
            return ts.setTextRange(ts.createLiteral(text), node);
        }
        /**
         * Visits a TemplateExpression node.
         *
         * @param node A TemplateExpression node.
         */
        function visitTemplateExpression(node) {
            const expressions = [];
            addTemplateHead(expressions, node);
            addTemplateSpans(expressions, node);
            // createAdd will check if each expression binds less closely than binary '+'.
            // If it does, it wraps the expression in parentheses. Otherwise, something like
            //    `abc${ 1 << 2 }`
            // becomes
            //    "abc" + 1 << 2 + ""
            // which is really
            //    ("abc" + 1) << (2 + "")
            // rather than
            //    "abc" + (1 << 2) + ""
            const expression = ts.reduceLeft(expressions, ts.createAdd);
            if (ts.nodeIsSynthesized(expression)) {
                expression.pos = node.pos;
                expression.end = node.end;
            }
            return expression;
        }
        /**
         * Gets a value indicating whether we need to include the head of a TemplateExpression.
         *
         * @param node A TemplateExpression node.
         */
        function shouldAddTemplateHead(node) {
            // If this expression has an empty head literal and the first template span has a non-empty
            // literal, then emitting the empty head literal is not necessary.
            //     `${ foo } and ${ bar }`
            // can be emitted as
            //     foo + " and " + bar
            // This is because it is only required that one of the first two operands in the emit
            // output must be a string literal, so that the other operand and all following operands
            // are forced into strings.
            //
            // If the first template span has an empty literal, then the head must still be emitted.
            //     `${ foo }${ bar }`
            // must still be emitted as
            //     "" + foo + bar
            // There is always atleast one templateSpan in this code path, since
            // NoSubstitutionTemplateLiterals are directly emitted via emitLiteral()
            ts.Debug.assert(node.templateSpans.length !== 0);
            return node.head.text.length !== 0 || node.templateSpans[0].literal.text.length === 0;
        }
        /**
         * Adds the head of a TemplateExpression to an array of expressions.
         *
         * @param expressions An array of expressions.
         * @param node A TemplateExpression node.
         */
        function addTemplateHead(expressions, node) {
            if (!shouldAddTemplateHead(node)) {
                return;
            }
            expressions.push(ts.createLiteral(node.head.text));
        }
        /**
         * Visits and adds the template spans of a TemplateExpression to an array of expressions.
         *
         * @param expressions An array of expressions.
         * @param node A TemplateExpression node.
         */
        function addTemplateSpans(expressions, node) {
            for (const span of node.templateSpans) {
                expressions.push(ts.visitNode(span.expression, visitor, ts.isExpression));
                // Only emit if the literal is non-empty.
                // The binary '+' operator is left-associative, so the first string concatenation
                // with the head will force the result up to this point to be a string.
                // Emitting a '+ ""' has no semantic effect for middles and tails.
                if (span.literal.text.length !== 0) {
                    expressions.push(ts.createLiteral(span.literal.text));
                }
            }
        }
        /**
         * Visits the `super` keyword
         */
        function visitSuperKeyword(isExpressionOfCall) {
            return hierarchyFacts & 8 /* NonStaticClassElement */
                && !isExpressionOfCall
                ? ts.createPropertyAccess(ts.createFileLevelUniqueName("_super"), "prototype")
                : ts.createFileLevelUniqueName("_super");
        }
        function visitMetaProperty(node) {
            if (node.keywordToken === ts.SyntaxKind.NewKeyword && node.name.escapedText === "target") {
                if (hierarchyFacts & 8192 /* ComputedPropertyName */) {
                    hierarchyFacts |= 32768 /* NewTargetInComputedPropertyName */;
                }
                else {
                    hierarchyFacts |= 16384 /* NewTarget */;
                }
                return ts.createFileLevelUniqueName("_newTarget");
            }
            return node;
        }
        /**
         * Called by the printer just before a node is printed.
         *
         * @param hint A hint as to the intended usage of the node.
         * @param node The node to be printed.
         * @param emitCallback The callback used to emit the node.
         */
        function onEmitNode(hint, node, emitCallback) {
            if (enabledSubstitutions & 1 /* CapturedThis */ && ts.isFunctionLike(node)) {
                // If we are tracking a captured `this`, keep track of the enclosing function.
                const ancestorFacts = enterSubtree(16286 /* FunctionExcludes */, ts.getEmitFlags(node) & ts.EmitFlags.CapturesThis
                    ? 65 /* FunctionIncludes */ | 16 /* CapturesThis */
                    : 65 /* FunctionIncludes */);
                previousOnEmitNode(hint, node, emitCallback);
                exitSubtree(ancestorFacts, 0 /* None */, 0 /* None */);
                return;
            }
            previousOnEmitNode(hint, node, emitCallback);
        }
        /**
         * Enables a more costly code path for substitutions when we determine a source file
         * contains block-scoped bindings (e.g. `let` or `const`).
         */
        function enableSubstitutionsForBlockScopedBindings() {
            if ((enabledSubstitutions & 2 /* BlockScopedBindings */) === 0) {
                enabledSubstitutions |= 2 /* BlockScopedBindings */;
                context.enableSubstitution(ts.SyntaxKind.Identifier);
            }
        }
        /**
         * Enables a more costly code path for substitutions when we determine a source file
         * contains a captured `this`.
         */
        function enableSubstitutionsForCapturedThis() {
            if ((enabledSubstitutions & 1 /* CapturedThis */) === 0) {
                enabledSubstitutions |= 1 /* CapturedThis */;
                context.enableSubstitution(ts.SyntaxKind.ThisKeyword);
                context.enableEmitNotification(ts.SyntaxKind.Constructor);
                context.enableEmitNotification(ts.SyntaxKind.MethodDeclaration);
                context.enableEmitNotification(ts.SyntaxKind.GetAccessor);
                context.enableEmitNotification(ts.SyntaxKind.SetAccessor);
                context.enableEmitNotification(ts.SyntaxKind.ArrowFunction);
                context.enableEmitNotification(ts.SyntaxKind.FunctionExpression);
                context.enableEmitNotification(ts.SyntaxKind.FunctionDeclaration);
            }
        }
        /**
         * Hooks node substitutions.
         *
         * @param hint The context for the emitter.
         * @param node The node to substitute.
         */
        function onSubstituteNode(hint, node) {
            node = previousOnSubstituteNode(hint, node);
            if (hint === ts.EmitHint.Expression) {
                return substituteExpression(node);
            }
            if (ts.isIdentifier(node)) {
                return substituteIdentifier(node);
            }
            return node;
        }
        /**
         * Hooks substitutions for non-expression identifiers.
         */
        function substituteIdentifier(node) {
            // Only substitute the identifier if we have enabled substitutions for block-scoped
            // bindings.
            if (enabledSubstitutions & 2 /* BlockScopedBindings */ && !ts.isInternalName(node)) {
                const original = ts.getParseTreeNode(node, ts.isIdentifier);
                if (original && isNameOfDeclarationWithCollidingName(original)) {
                    return ts.setTextRange(ts.getGeneratedNameForNode(original), node);
                }
            }
            return node;
        }
        /**
         * Determines whether a name is the name of a declaration with a colliding name.
         * NOTE: This function expects to be called with an original source tree node.
         *
         * @param node An original source tree node.
         */
        function isNameOfDeclarationWithCollidingName(node) {
            const parent = node.parent;
            switch (parent.kind) {
                case ts.SyntaxKind.BindingElement:
                case ts.SyntaxKind.ClassDeclaration:
                case ts.SyntaxKind.EnumDeclaration:
                case ts.SyntaxKind.VariableDeclaration:
                    return parent.name === node
                        && resolver.isDeclarationWithCollidingName(parent);
            }
            return false;
        }
        /**
         * Substitutes an expression.
         *
         * @param node An Expression node.
         */
        function substituteExpression(node) {
            switch (node.kind) {
                case ts.SyntaxKind.Identifier:
                    return substituteExpressionIdentifier(node);
                case ts.SyntaxKind.ThisKeyword:
                    return substituteThisKeyword(node);
            }
            return node;
        }
        /**
         * Substitutes an expression identifier.
         *
         * @param node An Identifier node.
         */
        function substituteExpressionIdentifier(node) {
            if (enabledSubstitutions & 2 /* BlockScopedBindings */ && !ts.isInternalName(node)) {
                const declaration = resolver.getReferencedDeclarationWithCollidingName(node);
                if (declaration && !(ts.isClassLike(declaration) && isPartOfClassBody(declaration, node))) {
                    return ts.setTextRange(ts.getGeneratedNameForNode(ts.getNameOfDeclaration(declaration)), node);
                }
            }
            return node;
        }
        function isPartOfClassBody(declaration, node) {
            let currentNode = ts.getParseTreeNode(node);
            if (!currentNode || currentNode === declaration || currentNode.end <= declaration.pos || currentNode.pos >= declaration.end) {
                // if the node has no correlation to a parse tree node, its definitely not
                // part of the body.
                // if the node is outside of the document range of the declaration, its
                // definitely not part of the body.
                return false;
            }
            const blockScope = ts.getEnclosingBlockScopeContainer(declaration);
            while (currentNode) {
                if (currentNode === blockScope || currentNode === declaration) {
                    // if we are in the enclosing block scope of the declaration, we are definitely
                    // not inside the class body.
                    return false;
                }
                if (ts.isClassElement(currentNode) && currentNode.parent === declaration) {
                    return true;
                }
                currentNode = currentNode.parent;
            }
            return false;
        }
        /**
         * Substitutes `this` when contained within an arrow function.
         *
         * @param node The ThisKeyword node.
         */
        function substituteThisKeyword(node) {
            if (enabledSubstitutions & 1 /* CapturedThis */
                && hierarchyFacts & 16 /* CapturesThis */) {
                return ts.setTextRange(ts.createFileLevelUniqueName("_this"), node);
            }
            return node;
        }
        function getClassMemberPrefix(node, member) {
            return ts.hasModifier(member, ts.ModifierFlags.Static)
                ? ts.getInternalName(node)
                : ts.createPropertyAccess(ts.getInternalName(node), "prototype");
        }
        function hasSynthesizedDefaultSuperCall(constructor, hasExtendsClause) {
            if (!constructor || !hasExtendsClause) {
                return false;
            }
            if (ts.some(constructor.parameters)) {
                return false;
            }
            const statement = ts.firstOrUndefined(constructor.body.statements);
            if (!statement || !ts.nodeIsSynthesized(statement) || statement.kind !== ts.SyntaxKind.ExpressionStatement) {
                return false;
            }
            const statementExpression = statement.expression;
            if (!ts.nodeIsSynthesized(statementExpression) || statementExpression.kind !== ts.SyntaxKind.CallExpression) {
                return false;
            }
            const callTarget = statementExpression.expression;
            if (!ts.nodeIsSynthesized(callTarget) || callTarget.kind !== ts.SyntaxKind.SuperKeyword) {
                return false;
            }
            const callArgument = ts.singleOrUndefined(statementExpression.arguments);
            if (!callArgument || !ts.nodeIsSynthesized(callArgument) || callArgument.kind !== ts.SyntaxKind.SpreadElement) {
                return false;
            }
            const expression = callArgument.expression;
            return ts.isIdentifier(expression) && expression.escapedText === "arguments";
        }
    }
    ts.transformES2015 = transformES2015;
    function createExtendsHelper(context, name) {
        context.requestEmitHelper(extendsHelper);
        return ts.createCall(ts.getHelperName("__extends"), 
        /*typeArguments*/ undefined, [
            name,
            ts.createFileLevelUniqueName("_super")
        ]);
    }
    function createTemplateObjectHelper(context, cooked, raw) {
        context.requestEmitHelper(templateObjectHelper);
        return ts.createCall(ts.getHelperName("__makeTemplateObject"), 
        /*typeArguments*/ undefined, [
            cooked,
            raw
        ]);
    }
    const extendsHelper = {
        name: "typescript:extends",
        scoped: false,
        priority: 0,
        text: `
            var __extends = (this && this.__extends) || (function () {
                var extendStatics = Object.setPrototypeOf ||
                    ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                    function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
                return function (d, b) {
                    extendStatics(d, b);
                    function __() { this.constructor = d; }
                    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
                };
            })();`
    };
    const templateObjectHelper = {
        name: "typescript:makeTemplateObject",
        scoped: false,
        priority: 0,
        text: `
            var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
                if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
                return cooked;
            };`
    };
})(ts || (ts = {}));
