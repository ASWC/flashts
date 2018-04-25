// Transforms generator functions into a compatible ES5 representation with similar runtime
// semantics. This is accomplished by first transforming the body of each generator
// function into an intermediate representation that is the compiled into a JavaScript
// switch statement.
//
// Many functions in this transformer will contain comments indicating the expected
// intermediate representation. For illustrative purposes, the following intermediate
// language is used to define this intermediate representation:
//
//  .nop                            - Performs no operation.
//  .local NAME, ...                - Define local variable declarations.
//  .mark LABEL                     - Mark the location of a label.
//  .br LABEL                       - Jump to a label. If jumping out of a protected
//                                    region, all .finally blocks are executed.
//  .brtrue LABEL, (x)              - Jump to a label IIF the expression `x` is truthy.
//                                    If jumping out of a protected region, all .finally
//                                    blocks are executed.
//  .brfalse LABEL, (x)             - Jump to a label IIF the expression `x` is falsey.
//                                    If jumping out of a protected region, all .finally
//                                    blocks are executed.
//  .yield (x)                      - Yield the value of the optional expression `x`.
//                                    Resume at the next label.
//  .yieldstar (x)                  - Delegate yield to the value of the optional
//                                    expression `x`. Resume at the next label.
//                                    NOTE: `x` must be an Iterator, not an Iterable.
//  .loop CONTINUE, BREAK           - Marks the beginning of a loop. Any "continue" or
//                                    "break" abrupt completions jump to the CONTINUE or
//                                    BREAK labels, respectively.
//  .endloop                        - Marks the end of a loop.
//  .with (x)                       - Marks the beginning of a WithStatement block, using
//                                    the supplied expression.
//  .endwith                        - Marks the end of a WithStatement.
//  .switch                         - Marks the beginning of a SwitchStatement.
//  .endswitch                      - Marks the end of a SwitchStatement.
//  .labeled NAME                   - Marks the beginning of a LabeledStatement with the
//                                    supplied name.
//  .endlabeled                     - Marks the end of a LabeledStatement.
//  .try TRY, CATCH, FINALLY, END   - Marks the beginning of a protected region, and the
//                                    labels for each block.
//  .catch (x)                      - Marks the beginning of a catch block.
//  .finally                        - Marks the beginning of a finally block.
//  .endfinally                     - Marks the end of a finally block.
//  .endtry                         - Marks the end of a protected region.
//  .throw (x)                      - Throws the value of the expression `x`.
//  .return (x)                     - Returns the value of the expression `x`.
//
// In addition, the illustrative intermediate representation introduces some special
// variables:
//
//  %sent%                          - Either returns the next value sent to the generator,
//                                    returns the result of a delegated yield, or throws
//                                    the exception sent to the generator.
//  %error%                         - Returns the value of the current exception in a
//                                    catch block.
//
// This intermediate representation is then compiled into JavaScript syntax. The resulting
// compilation output looks something like the following:
//
//  function f() {
//      var /*locals*/;
//      /*functions*/
//      return __generator(function (state) {
//          switch (state.label) {
//              /*cases per label*/
//          }
//      });
//  }
//
// Each of the above instructions corresponds to JavaScript emit similar to the following:
//
//  .local NAME                   | var NAME;
// -------------------------------|----------------------------------------------
//  .mark LABEL                   | case LABEL:
// -------------------------------|----------------------------------------------
//  .br LABEL                     |     return [3 /*break*/, LABEL];
// -------------------------------|----------------------------------------------
//  .brtrue LABEL, (x)            |     if (x) return [3 /*break*/, LABEL];
// -------------------------------|----------------------------------------------
//  .brfalse LABEL, (x)           |     if (!(x)) return [3, /*break*/, LABEL];
// -------------------------------|----------------------------------------------
//  .yield (x)                    |     return [4 /*yield*/, x];
//  .mark RESUME                  | case RESUME:
//      a = %sent%;               |     a = state.sent();
// -------------------------------|----------------------------------------------
//  .yieldstar (x)                |     return [5 /*yield**/, x];
//  .mark RESUME                  | case RESUME:
//      a = %sent%;               |     a = state.sent();
// -------------------------------|----------------------------------------------
//  .with (_a)                    |     with (_a) {
//      a();                      |         a();
//                                |     }
//                                |     state.label = LABEL;
//  .mark LABEL                   | case LABEL:
//                                |     with (_a) {
//      b();                      |         b();
//                                |     }
//  .endwith                      |
// -------------------------------|----------------------------------------------
//                                | case 0:
//                                |     state.trys = [];
//                                | ...
//  .try TRY, CATCH, FINALLY, END |
//  .mark TRY                     | case TRY:
//                                |     state.trys.push([TRY, CATCH, FINALLY, END]);
//  .nop                          |
//      a();                      |     a();
//  .br END                       |     return [3 /*break*/, END];
//  .catch (e)                    |
//  .mark CATCH                   | case CATCH:
//                                |     e = state.sent();
//      b();                      |     b();
//  .br END                       |     return [3 /*break*/, END];
//  .finally                      |
//  .mark FINALLY                 | case FINALLY:
//      c();                      |     c();
//  .endfinally                   |     return [7 /*endfinally*/];
//  .endtry                       |
//  .mark END                     | case END:
/*@internal*/
var ts;
(function (ts) {
    function getInstructionName(instruction) {
        switch (instruction) {
            case 2 /* Return */: return "return";
            case 3 /* Break */: return "break";
            case 4 /* Yield */: return "yield";
            case 5 /* YieldStar */: return "yield*";
            case 7 /* Endfinally */: return "endfinally";
        }
    }
    function transformGenerators(context) {
        const { resumeLexicalEnvironment, endLexicalEnvironment, hoistFunctionDeclaration, hoistVariableDeclaration } = context;
        const compilerOptions = context.getCompilerOptions();
        const languageVersion = ts.getEmitScriptTarget(compilerOptions);
        const resolver = context.getEmitResolver();
        const previousOnSubstituteNode = context.onSubstituteNode;
        context.onSubstituteNode = onSubstituteNode;
        let renamedCatchVariables;
        let renamedCatchVariableDeclarations;
        let inGeneratorFunctionBody;
        let inStatementContainingYield;
        // The following three arrays store information about generated code blocks.
        // All three arrays are correlated by their index. This approach is used over allocating
        // objects to store the same information to avoid GC overhead.
        //
        let blocks; // Information about the code block
        let blockOffsets; // The operation offset at which a code block begins or ends
        let blockActions; // Whether the code block is opened or closed
        let blockStack; // A stack of currently open code blocks
        // Labels are used to mark locations in the code that can be the target of a Break (jump)
        // operation. These are translated into case clauses in a switch statement.
        // The following two arrays are correlated by their index. This approach is used over
        // allocating objects to store the same information to avoid GC overhead.
        //
        let labelOffsets; // The operation offset at which the label is defined.
        let labelExpressions; // The NumericLiteral nodes bound to each label.
        let nextLabelId = 1; // The next label id to use.
        // Operations store information about generated code for the function body. This
        // Includes things like statements, assignments, breaks (jumps), and yields.
        // The following three arrays are correlated by their index. This approach is used over
        // allocating objects to store the same information to avoid GC overhead.
        //
        let operations; // The operation to perform.
        let operationArguments; // The arguments to the operation.
        let operationLocations; // The source map location for the operation.
        let state; // The name of the state object used by the generator at runtime.
        // The following variables store information used by the `build` function:
        //
        let blockIndex = 0; // The index of the current block.
        let labelNumber = 0; // The current label number.
        let labelNumbers;
        let lastOperationWasAbrupt; // Indicates whether the last operation was abrupt (break/continue).
        let lastOperationWasCompletion; // Indicates whether the last operation was a completion (return/throw).
        let clauses; // The case clauses generated for labels.
        let statements; // The statements for the current label.
        let exceptionBlockStack; // A stack of containing exception blocks.
        let currentExceptionBlock; // The current exception block.
        let withBlockStack; // A stack containing `with` blocks.
        return transformSourceFile;
        function transformSourceFile(node) {
            if (node.isDeclarationFile || (node.transformFlags & 512 /* ContainsGenerator */) === 0) {
                return node;
            }
            const visited = ts.visitEachChild(node, visitor, context);
            ts.addEmitHelpers(visited, context.readEmitHelpers());
            return visited;
        }
        /**
         * Visits a node.
         *
         * @param node The node to visit.
         */
        function visitor(node) {
            const transformFlags = node.transformFlags;
            if (inStatementContainingYield) {
                return visitJavaScriptInStatementContainingYield(node);
            }
            else if (inGeneratorFunctionBody) {
                return visitJavaScriptInGeneratorFunctionBody(node);
            }
            else if (transformFlags & 256 /* Generator */) {
                return visitGenerator(node);
            }
            else if (transformFlags & 512 /* ContainsGenerator */) {
                return ts.visitEachChild(node, visitor, context);
            }
            else {
                return node;
            }
        }
        /**
         * Visits a node that is contained within a statement that contains yield.
         *
         * @param node The node to visit.
         */
        function visitJavaScriptInStatementContainingYield(node) {
            switch (node.kind) {
                case ts.SyntaxKind.DoStatement:
                    return visitDoStatement(node);
                case ts.SyntaxKind.WhileStatement:
                    return visitWhileStatement(node);
                case ts.SyntaxKind.SwitchStatement:
                    return visitSwitchStatement(node);
                case ts.SyntaxKind.LabeledStatement:
                    return visitLabeledStatement(node);
                default:
                    return visitJavaScriptInGeneratorFunctionBody(node);
            }
        }
        /**
         * Visits a node that is contained within a generator function.
         *
         * @param node The node to visit.
         */
        function visitJavaScriptInGeneratorFunctionBody(node) {
            switch (node.kind) {
                case ts.SyntaxKind.FunctionDeclaration:
                    return visitFunctionDeclaration(node);
                case ts.SyntaxKind.FunctionExpression:
                    return visitFunctionExpression(node);
                case ts.SyntaxKind.GetAccessor:
                case ts.SyntaxKind.SetAccessor:
                    return visitAccessorDeclaration(node);
                case ts.SyntaxKind.VariableStatement:
                    return visitVariableStatement(node);
                case ts.SyntaxKind.ForStatement:
                    return visitForStatement(node);
                case ts.SyntaxKind.ForInStatement:
                    return visitForInStatement(node);
                case ts.SyntaxKind.BreakStatement:
                    return visitBreakStatement(node);
                case ts.SyntaxKind.ContinueStatement:
                    return visitContinueStatement(node);
                case ts.SyntaxKind.ReturnStatement:
                    return visitReturnStatement(node);
                default:
                    if (node.transformFlags & 16777216 /* ContainsYield */) {
                        return visitJavaScriptContainingYield(node);
                    }
                    else if (node.transformFlags & (512 /* ContainsGenerator */ | 33554432 /* ContainsHoistedDeclarationOrCompletion */)) {
                        return ts.visitEachChild(node, visitor, context);
                    }
                    else {
                        return node;
                    }
            }
        }
        /**
         * Visits a node that contains a YieldExpression.
         *
         * @param node The node to visit.
         */
        function visitJavaScriptContainingYield(node) {
            switch (node.kind) {
                case ts.SyntaxKind.BinaryExpression:
                    return visitBinaryExpression(node);
                case ts.SyntaxKind.ConditionalExpression:
                    return visitConditionalExpression(node);
                case ts.SyntaxKind.YieldExpression:
                    return visitYieldExpression(node);
                case ts.SyntaxKind.ArrayLiteralExpression:
                    return visitArrayLiteralExpression(node);
                case ts.SyntaxKind.ObjectLiteralExpression:
                    return visitObjectLiteralExpression(node);
                case ts.SyntaxKind.ElementAccessExpression:
                    return visitElementAccessExpression(node);
                case ts.SyntaxKind.CallExpression:
                    return visitCallExpression(node);
                case ts.SyntaxKind.NewExpression:
                    return visitNewExpression(node);
                default:
                    return ts.visitEachChild(node, visitor, context);
            }
        }
        /**
         * Visits a generator function.
         *
         * @param node The node to visit.
         */
        function visitGenerator(node) {
            switch (node.kind) {
                case ts.SyntaxKind.FunctionDeclaration:
                    return visitFunctionDeclaration(node);
                case ts.SyntaxKind.FunctionExpression:
                    return visitFunctionExpression(node);
                default:
                    return ts.Debug.failBadSyntaxKind(node);
            }
        }
        /**
         * Visits a function declaration.
         *
         * This will be called when one of the following conditions are met:
         * - The function declaration is a generator function.
         * - The function declaration is contained within the body of a generator function.
         *
         * @param node The node to visit.
         */
        function visitFunctionDeclaration(node) {
            // Currently, we only support generators that were originally async functions.
            if (node.asteriskToken) {
                node = ts.setOriginalNode(ts.setTextRange(ts.createFunctionDeclaration(
                /*decorators*/ undefined, node.modifiers, 
                /*asteriskToken*/ undefined, node.name, 
                /*typeParameters*/ undefined, ts.visitParameterList(node.parameters, visitor, context), 
                /*type*/ undefined, transformGeneratorFunctionBody(node.body)), 
                /*location*/ node), node);
            }
            else {
                const savedInGeneratorFunctionBody = inGeneratorFunctionBody;
                const savedInStatementContainingYield = inStatementContainingYield;
                inGeneratorFunctionBody = false;
                inStatementContainingYield = false;
                node = ts.visitEachChild(node, visitor, context);
                inGeneratorFunctionBody = savedInGeneratorFunctionBody;
                inStatementContainingYield = savedInStatementContainingYield;
            }
            if (inGeneratorFunctionBody) {
                // Function declarations in a generator function body are hoisted
                // to the top of the lexical scope and elided from the current statement.
                hoistFunctionDeclaration(node);
                return undefined;
            }
            else {
                return node;
            }
        }
        /**
         * Visits a function expression.
         *
         * This will be called when one of the following conditions are met:
         * - The function expression is a generator function.
         * - The function expression is contained within the body of a generator function.
         *
         * @param node The node to visit.
         */
        function visitFunctionExpression(node) {
            // Currently, we only support generators that were originally async functions.
            if (node.asteriskToken) {
                node = ts.setOriginalNode(ts.setTextRange(ts.createFunctionExpression(
                /*modifiers*/ undefined, 
                /*asteriskToken*/ undefined, node.name, 
                /*typeParameters*/ undefined, ts.visitParameterList(node.parameters, visitor, context), 
                /*type*/ undefined, transformGeneratorFunctionBody(node.body)), 
                /*location*/ node), node);
            }
            else {
                const savedInGeneratorFunctionBody = inGeneratorFunctionBody;
                const savedInStatementContainingYield = inStatementContainingYield;
                inGeneratorFunctionBody = false;
                inStatementContainingYield = false;
                node = ts.visitEachChild(node, visitor, context);
                inGeneratorFunctionBody = savedInGeneratorFunctionBody;
                inStatementContainingYield = savedInStatementContainingYield;
            }
            return node;
        }
        /**
         * Visits a get or set accessor declaration.
         *
         * This will be called when one of the following conditions are met:
         * - The accessor is contained within the body of a generator function.
         *
         * @param node The node to visit.
         */
        function visitAccessorDeclaration(node) {
            const savedInGeneratorFunctionBody = inGeneratorFunctionBody;
            const savedInStatementContainingYield = inStatementContainingYield;
            inGeneratorFunctionBody = false;
            inStatementContainingYield = false;
            node = ts.visitEachChild(node, visitor, context);
            inGeneratorFunctionBody = savedInGeneratorFunctionBody;
            inStatementContainingYield = savedInStatementContainingYield;
            return node;
        }
        /**
         * Transforms the body of a generator function declaration.
         *
         * @param node The function body to transform.
         */
        function transformGeneratorFunctionBody(body) {
            // Save existing generator state
            const statements = [];
            const savedInGeneratorFunctionBody = inGeneratorFunctionBody;
            const savedInStatementContainingYield = inStatementContainingYield;
            const savedBlocks = blocks;
            const savedBlockOffsets = blockOffsets;
            const savedBlockActions = blockActions;
            const savedBlockStack = blockStack;
            const savedLabelOffsets = labelOffsets;
            const savedLabelExpressions = labelExpressions;
            const savedNextLabelId = nextLabelId;
            const savedOperations = operations;
            const savedOperationArguments = operationArguments;
            const savedOperationLocations = operationLocations;
            const savedState = state;
            // Initialize generator state
            inGeneratorFunctionBody = true;
            inStatementContainingYield = false;
            blocks = undefined;
            blockOffsets = undefined;
            blockActions = undefined;
            blockStack = undefined;
            labelOffsets = undefined;
            labelExpressions = undefined;
            nextLabelId = 1;
            operations = undefined;
            operationArguments = undefined;
            operationLocations = undefined;
            state = ts.createTempVariable(/*recordTempVariable*/ undefined);
            // Build the generator
            resumeLexicalEnvironment();
            const statementOffset = ts.addPrologue(statements, body.statements, /*ensureUseStrict*/ false, visitor);
            transformAndEmitStatements(body.statements, statementOffset);
            const buildResult = build();
            ts.addRange(statements, endLexicalEnvironment());
            statements.push(ts.createReturn(buildResult));
            // Restore previous generator state
            inGeneratorFunctionBody = savedInGeneratorFunctionBody;
            inStatementContainingYield = savedInStatementContainingYield;
            blocks = savedBlocks;
            blockOffsets = savedBlockOffsets;
            blockActions = savedBlockActions;
            blockStack = savedBlockStack;
            labelOffsets = savedLabelOffsets;
            labelExpressions = savedLabelExpressions;
            nextLabelId = savedNextLabelId;
            operations = savedOperations;
            operationArguments = savedOperationArguments;
            operationLocations = savedOperationLocations;
            state = savedState;
            return ts.setTextRange(ts.createBlock(statements, body.multiLine), body);
        }
        /**
         * Visits a variable statement.
         *
         * This will be called when one of the following conditions are met:
         * - The variable statement is contained within the body of a generator function.
         *
         * @param node The node to visit.
         */
        function visitVariableStatement(node) {
            if (node.transformFlags & 16777216 /* ContainsYield */) {
                transformAndEmitVariableDeclarationList(node.declarationList);
                return undefined;
            }
            else {
                // Do not hoist custom prologues.
                if (ts.getEmitFlags(node) & ts.EmitFlags.CustomPrologue) {
                    return node;
                }
                for (const variable of node.declarationList.declarations) {
                    hoistVariableDeclaration(variable.name);
                }
                const variables = ts.getInitializedVariables(node.declarationList);
                if (variables.length === 0) {
                    return undefined;
                }
                return ts.setSourceMapRange(ts.createStatement(ts.inlineExpressions(ts.map(variables, transformInitializedVariable))), node);
            }
        }
        /**
         * Visits a binary expression.
         *
         * This will be called when one of the following conditions are met:
         * - The node contains a YieldExpression.
         *
         * @param node The node to visit.
         */
        function visitBinaryExpression(node) {
            switch (ts.getExpressionAssociativity(node)) {
                case 0 /* Left */:
                    return visitLeftAssociativeBinaryExpression(node);
                case 1 /* Right */:
                    return visitRightAssociativeBinaryExpression(node);
                default:
                    ts.Debug.fail("Unknown associativity.");
            }
        }
        function isCompoundAssignment(kind) {
            return kind >= ts.SyntaxKind.FirstCompoundAssignment
                && kind <= ts.SyntaxKind.LastCompoundAssignment;
        }
        function getOperatorForCompoundAssignment(kind) {
            switch (kind) {
                case ts.SyntaxKind.PlusEqualsToken: return ts.SyntaxKind.PlusToken;
                case ts.SyntaxKind.MinusEqualsToken: return ts.SyntaxKind.MinusToken;
                case ts.SyntaxKind.AsteriskEqualsToken: return ts.SyntaxKind.AsteriskToken;
                case ts.SyntaxKind.AsteriskAsteriskEqualsToken: return ts.SyntaxKind.AsteriskAsteriskToken;
                case ts.SyntaxKind.SlashEqualsToken: return ts.SyntaxKind.SlashToken;
                case ts.SyntaxKind.PercentEqualsToken: return ts.SyntaxKind.PercentToken;
                case ts.SyntaxKind.LessThanLessThanEqualsToken: return ts.SyntaxKind.LessThanLessThanToken;
                case ts.SyntaxKind.GreaterThanGreaterThanEqualsToken: return ts.SyntaxKind.GreaterThanGreaterThanToken;
                case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken: return ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken;
                case ts.SyntaxKind.AmpersandEqualsToken: return ts.SyntaxKind.AmpersandToken;
                case ts.SyntaxKind.BarEqualsToken: return ts.SyntaxKind.BarToken;
                case ts.SyntaxKind.CaretEqualsToken: return ts.SyntaxKind.CaretToken;
            }
        }
        /**
         * Visits a right-associative binary expression containing `yield`.
         *
         * @param node The node to visit.
         */
        function visitRightAssociativeBinaryExpression(node) {
            const { left, right } = node;
            if (containsYield(right)) {
                let target;
                switch (left.kind) {
                    case ts.SyntaxKind.PropertyAccessExpression:
                        // [source]
                        //      a.b = yield;
                        //
                        // [intermediate]
                        //  .local _a
                        //      _a = a;
                        //  .yield resumeLabel
                        //  .mark resumeLabel
                        //      _a.b = %sent%;
                        target = ts.updatePropertyAccess(left, cacheExpression(ts.visitNode(left.expression, visitor, ts.isLeftHandSideExpression)), left.name);
                        break;
                    case ts.SyntaxKind.ElementAccessExpression:
                        // [source]
                        //      a[b] = yield;
                        //
                        // [intermediate]
                        //  .local _a, _b
                        //      _a = a;
                        //      _b = b;
                        //  .yield resumeLabel
                        //  .mark resumeLabel
                        //      _a[_b] = %sent%;
                        target = ts.updateElementAccess(left, cacheExpression(ts.visitNode(left.expression, visitor, ts.isLeftHandSideExpression)), cacheExpression(ts.visitNode(left.argumentExpression, visitor, ts.isExpression)));
                        break;
                    default:
                        target = ts.visitNode(left, visitor, ts.isExpression);
                        break;
                }
                const operator = node.operatorToken.kind;
                if (isCompoundAssignment(operator)) {
                    return ts.setTextRange(ts.createAssignment(target, ts.setTextRange(ts.createBinary(cacheExpression(target), getOperatorForCompoundAssignment(operator), ts.visitNode(right, visitor, ts.isExpression)), node)), node);
                }
                else {
                    return ts.updateBinary(node, target, ts.visitNode(right, visitor, ts.isExpression));
                }
            }
            return ts.visitEachChild(node, visitor, context);
        }
        function visitLeftAssociativeBinaryExpression(node) {
            if (containsYield(node.right)) {
                if (ts.isLogicalOperator(node.operatorToken.kind)) {
                    return visitLogicalBinaryExpression(node);
                }
                else if (node.operatorToken.kind === ts.SyntaxKind.CommaToken) {
                    return visitCommaExpression(node);
                }
                // [source]
                //      a() + (yield) + c()
                //
                // [intermediate]
                //  .local _a
                //      _a = a();
                //  .yield resumeLabel
                //      _a + %sent% + c()
                const clone = ts.getMutableClone(node);
                clone.left = cacheExpression(ts.visitNode(node.left, visitor, ts.isExpression));
                clone.right = ts.visitNode(node.right, visitor, ts.isExpression);
                return clone;
            }
            return ts.visitEachChild(node, visitor, context);
        }
        /**
         * Visits a logical binary expression containing `yield`.
         *
         * @param node A node to visit.
         */
        function visitLogicalBinaryExpression(node) {
            // Logical binary expressions (`&&` and `||`) are shortcutting expressions and need
            // to be transformed as such:
            //
            // [source]
            //      x = a() && yield;
            //
            // [intermediate]
            //  .local _a
            //      _a = a();
            //  .brfalse resultLabel, (_a)
            //  .yield resumeLabel
            //  .mark resumeLabel
            //      _a = %sent%;
            //  .mark resultLabel
            //      x = _a;
            //
            // [source]
            //      x = a() || yield;
            //
            // [intermediate]
            //  .local _a
            //      _a = a();
            //  .brtrue resultLabel, (_a)
            //  .yield resumeLabel
            //  .mark resumeLabel
            //      _a = %sent%;
            //  .mark resultLabel
            //      x = _a;
            const resultLabel = defineLabel();
            const resultLocal = declareLocal();
            emitAssignment(resultLocal, ts.visitNode(node.left, visitor, ts.isExpression), /*location*/ node.left);
            if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
                // Logical `&&` shortcuts when the left-hand operand is falsey.
                emitBreakWhenFalse(resultLabel, resultLocal, /*location*/ node.left);
            }
            else {
                // Logical `||` shortcuts when the left-hand operand is truthy.
                emitBreakWhenTrue(resultLabel, resultLocal, /*location*/ node.left);
            }
            emitAssignment(resultLocal, ts.visitNode(node.right, visitor, ts.isExpression), /*location*/ node.right);
            markLabel(resultLabel);
            return resultLocal;
        }
        /**
         * Visits a comma expression containing `yield`.
         *
         * @param node The node to visit.
         */
        function visitCommaExpression(node) {
            // [source]
            //      x = a(), yield, b();
            //
            // [intermediate]
            //      a();
            //  .yield resumeLabel
            //  .mark resumeLabel
            //      x = %sent%, b();
            let pendingExpressions = [];
            visit(node.left);
            visit(node.right);
            return ts.inlineExpressions(pendingExpressions);
            function visit(node) {
                if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.CommaToken) {
                    visit(node.left);
                    visit(node.right);
                }
                else {
                    if (containsYield(node) && pendingExpressions.length > 0) {
                        emitWorker(1 /* Statement */, [ts.createStatement(ts.inlineExpressions(pendingExpressions))]);
                        pendingExpressions = [];
                    }
                    pendingExpressions.push(ts.visitNode(node, visitor, ts.isExpression));
                }
            }
        }
        /**
         * Visits a conditional expression containing `yield`.
         *
         * @param node The node to visit.
         */
        function visitConditionalExpression(node) {
            // [source]
            //      x = a() ? yield : b();
            //
            // [intermediate]
            //  .local _a
            //  .brfalse whenFalseLabel, (a())
            //  .yield resumeLabel
            //  .mark resumeLabel
            //      _a = %sent%;
            //  .br resultLabel
            //  .mark whenFalseLabel
            //      _a = b();
            //  .mark resultLabel
            //      x = _a;
            // We only need to perform a specific transformation if a `yield` expression exists
            // in either the `whenTrue` or `whenFalse` branches.
            // A `yield` in the condition will be handled by the normal visitor.
            if (containsYield(node.whenTrue) || containsYield(node.whenFalse)) {
                const whenFalseLabel = defineLabel();
                const resultLabel = defineLabel();
                const resultLocal = declareLocal();
                emitBreakWhenFalse(whenFalseLabel, ts.visitNode(node.condition, visitor, ts.isExpression), /*location*/ node.condition);
                emitAssignment(resultLocal, ts.visitNode(node.whenTrue, visitor, ts.isExpression), /*location*/ node.whenTrue);
                emitBreak(resultLabel);
                markLabel(whenFalseLabel);
                emitAssignment(resultLocal, ts.visitNode(node.whenFalse, visitor, ts.isExpression), /*location*/ node.whenFalse);
                markLabel(resultLabel);
                return resultLocal;
            }
            return ts.visitEachChild(node, visitor, context);
        }
        /**
         * Visits a `yield` expression.
         *
         * @param node The node to visit.
         */
        function visitYieldExpression(node) {
            // [source]
            //      x = yield a();
            //
            // [intermediate]
            //  .yield resumeLabel, (a())
            //  .mark resumeLabel
            //      x = %sent%;
            const resumeLabel = defineLabel();
            const expression = ts.visitNode(node.expression, visitor, ts.isExpression);
            if (node.asteriskToken) {
                const iterator = (ts.getEmitFlags(node.expression) & ts.EmitFlags.Iterator) === 0
                    ? ts.createValuesHelper(context, expression, /*location*/ node)
                    : expression;
                emitYieldStar(iterator, /*location*/ node);
            }
            else {
                emitYield(expression, /*location*/ node);
            }
            markLabel(resumeLabel);
            return createGeneratorResume(/*location*/ node);
        }
        /**
         * Visits an ArrayLiteralExpression that contains a YieldExpression.
         *
         * @param node The node to visit.
         */
        function visitArrayLiteralExpression(node) {
            return visitElements(node.elements, /*leadingElement*/ undefined, /*location*/ undefined, node.multiLine);
        }
        /**
         * Visits an array of expressions containing one or more YieldExpression nodes
         * and returns an expression for the resulting value.
         *
         * @param elements The elements to visit.
         * @param multiLine Whether array literals created should be emitted on multiple lines.
         */
        function visitElements(elements, leadingElement, location, multiLine) {
            // [source]
            //      ar = [1, yield, 2];
            //
            // [intermediate]
            //  .local _a
            //      _a = [1];
            //  .yield resumeLabel
            //  .mark resumeLabel
            //      ar = _a.concat([%sent%, 2]);
            const numInitialElements = countInitialNodesWithoutYield(elements);
            let temp;
            if (numInitialElements > 0) {
                temp = declareLocal();
                const initialElements = ts.visitNodes(elements, visitor, ts.isExpression, 0, numInitialElements);
                emitAssignment(temp, ts.createArrayLiteral(leadingElement
                    ? [leadingElement, ...initialElements]
                    : initialElements));
                leadingElement = undefined;
            }
            const expressions = ts.reduceLeft(elements, reduceElement, [], numInitialElements);
            return temp
                ? ts.createArrayConcat(temp, [ts.createArrayLiteral(expressions, multiLine)])
                : ts.setTextRange(ts.createArrayLiteral(leadingElement ? [leadingElement, ...expressions] : expressions, multiLine), location);
            function reduceElement(expressions, element) {
                if (containsYield(element) && expressions.length > 0) {
                    const hasAssignedTemp = temp !== undefined;
                    if (!temp) {
                        temp = declareLocal();
                    }
                    emitAssignment(temp, hasAssignedTemp
                        ? ts.createArrayConcat(temp, [ts.createArrayLiteral(expressions, multiLine)])
                        : ts.createArrayLiteral(leadingElement ? [leadingElement, ...expressions] : expressions, multiLine));
                    leadingElement = undefined;
                    expressions = [];
                }
                expressions.push(ts.visitNode(element, visitor, ts.isExpression));
                return expressions;
            }
        }
        function visitObjectLiteralExpression(node) {
            // [source]
            //      o = {
            //          a: 1,
            //          b: yield,
            //          c: 2
            //      };
            //
            // [intermediate]
            //  .local _a
            //      _a = {
            //          a: 1
            //      };
            //  .yield resumeLabel
            //  .mark resumeLabel
            //      o = (_a.b = %sent%,
            //          _a.c = 2,
            //          _a);
            const properties = node.properties;
            const multiLine = node.multiLine;
            const numInitialProperties = countInitialNodesWithoutYield(properties);
            const temp = declareLocal();
            emitAssignment(temp, ts.createObjectLiteral(ts.visitNodes(properties, visitor, ts.isObjectLiteralElementLike, 0, numInitialProperties), multiLine));
            const expressions = ts.reduceLeft(properties, reduceProperty, [], numInitialProperties);
            expressions.push(multiLine ? ts.startOnNewLine(ts.getMutableClone(temp)) : temp);
            return ts.inlineExpressions(expressions);
            function reduceProperty(expressions, property) {
                if (containsYield(property) && expressions.length > 0) {
                    emitStatement(ts.createStatement(ts.inlineExpressions(expressions)));
                    expressions = [];
                }
                const expression = ts.createExpressionForObjectLiteralElementLike(node, property, temp);
                const visited = ts.visitNode(expression, visitor, ts.isExpression);
                if (visited) {
                    if (multiLine) {
                        ts.startOnNewLine(visited);
                    }
                    expressions.push(visited);
                }
                return expressions;
            }
        }
        /**
         * Visits an ElementAccessExpression that contains a YieldExpression.
         *
         * @param node The node to visit.
         */
        function visitElementAccessExpression(node) {
            if (containsYield(node.argumentExpression)) {
                // [source]
                //      a = x[yield];
                //
                // [intermediate]
                //  .local _a
                //      _a = x;
                //  .yield resumeLabel
                //  .mark resumeLabel
                //      a = _a[%sent%]
                const clone = ts.getMutableClone(node);
                clone.expression = cacheExpression(ts.visitNode(node.expression, visitor, ts.isLeftHandSideExpression));
                clone.argumentExpression = ts.visitNode(node.argumentExpression, visitor, ts.isExpression);
                return clone;
            }
            return ts.visitEachChild(node, visitor, context);
        }
        function visitCallExpression(node) {
            if (!ts.isImportCall(node) && ts.forEach(node.arguments, containsYield)) {
                // [source]
                //      a.b(1, yield, 2);
                //
                // [intermediate]
                //  .local _a, _b, _c
                //      _b = (_a = a).b;
                //      _c = [1];
                //  .yield resumeLabel
                //  .mark resumeLabel
                //      _b.apply(_a, _c.concat([%sent%, 2]));
                const { target, thisArg } = ts.createCallBinding(node.expression, hoistVariableDeclaration, languageVersion, /*cacheIdentifiers*/ true);
                return ts.setOriginalNode(ts.createFunctionApply(cacheExpression(ts.visitNode(target, visitor, ts.isLeftHandSideExpression)), thisArg, visitElements(node.arguments), 
                /*location*/ node), node);
            }
            return ts.visitEachChild(node, visitor, context);
        }
        function visitNewExpression(node) {
            if (ts.forEach(node.arguments, containsYield)) {
                // [source]
                //      new a.b(1, yield, 2);
                //
                // [intermediate]
                //  .local _a, _b, _c
                //      _b = (_a = a.b).bind;
                //      _c = [1];
                //  .yield resumeLabel
                //  .mark resumeLabel
                //      new (_b.apply(_a, _c.concat([%sent%, 2])));
                const { target, thisArg } = ts.createCallBinding(ts.createPropertyAccess(node.expression, "bind"), hoistVariableDeclaration);
                return ts.setOriginalNode(ts.setTextRange(ts.createNew(ts.createFunctionApply(cacheExpression(ts.visitNode(target, visitor, ts.isExpression)), thisArg, visitElements(node.arguments, 
                /*leadingElement*/ ts.createVoidZero())), 
                /*typeArguments*/ undefined, []), node), node);
            }
            return ts.visitEachChild(node, visitor, context);
        }
        function transformAndEmitStatements(statements, start = 0) {
            const numStatements = statements.length;
            for (let i = start; i < numStatements; i++) {
                transformAndEmitStatement(statements[i]);
            }
        }
        function transformAndEmitEmbeddedStatement(node) {
            if (ts.isBlock(node)) {
                transformAndEmitStatements(node.statements);
            }
            else {
                transformAndEmitStatement(node);
            }
        }
        function transformAndEmitStatement(node) {
            const savedInStatementContainingYield = inStatementContainingYield;
            if (!inStatementContainingYield) {
                inStatementContainingYield = containsYield(node);
            }
            transformAndEmitStatementWorker(node);
            inStatementContainingYield = savedInStatementContainingYield;
        }
        function transformAndEmitStatementWorker(node) {
            switch (node.kind) {
                case ts.SyntaxKind.Block:
                    return transformAndEmitBlock(node);
                case ts.SyntaxKind.ExpressionStatement:
                    return transformAndEmitExpressionStatement(node);
                case ts.SyntaxKind.IfStatement:
                    return transformAndEmitIfStatement(node);
                case ts.SyntaxKind.DoStatement:
                    return transformAndEmitDoStatement(node);
                case ts.SyntaxKind.WhileStatement:
                    return transformAndEmitWhileStatement(node);
                case ts.SyntaxKind.ForStatement:
                    return transformAndEmitForStatement(node);
                case ts.SyntaxKind.ForInStatement:
                    return transformAndEmitForInStatement(node);
                case ts.SyntaxKind.ContinueStatement:
                    return transformAndEmitContinueStatement(node);
                case ts.SyntaxKind.BreakStatement:
                    return transformAndEmitBreakStatement(node);
                case ts.SyntaxKind.ReturnStatement:
                    return transformAndEmitReturnStatement(node);
                case ts.SyntaxKind.WithStatement:
                    return transformAndEmitWithStatement(node);
                case ts.SyntaxKind.SwitchStatement:
                    return transformAndEmitSwitchStatement(node);
                case ts.SyntaxKind.LabeledStatement:
                    return transformAndEmitLabeledStatement(node);
                case ts.SyntaxKind.ThrowStatement:
                    return transformAndEmitThrowStatement(node);
                case ts.SyntaxKind.TryStatement:
                    return transformAndEmitTryStatement(node);
                default:
                    return emitStatement(ts.visitNode(node, visitor, ts.isStatement));
            }
        }
        function transformAndEmitBlock(node) {
            if (containsYield(node)) {
                transformAndEmitStatements(node.statements);
            }
            else {
                emitStatement(ts.visitNode(node, visitor, ts.isStatement));
            }
        }
        function transformAndEmitExpressionStatement(node) {
            emitStatement(ts.visitNode(node, visitor, ts.isStatement));
        }
        function transformAndEmitVariableDeclarationList(node) {
            for (const variable of node.declarations) {
                const name = ts.getSynthesizedClone(variable.name);
                ts.setCommentRange(name, variable.name);
                hoistVariableDeclaration(name);
            }
            const variables = ts.getInitializedVariables(node);
            const numVariables = variables.length;
            let variablesWritten = 0;
            let pendingExpressions = [];
            while (variablesWritten < numVariables) {
                for (let i = variablesWritten; i < numVariables; i++) {
                    const variable = variables[i];
                    if (containsYield(variable.initializer) && pendingExpressions.length > 0) {
                        break;
                    }
                    pendingExpressions.push(transformInitializedVariable(variable));
                }
                if (pendingExpressions.length) {
                    emitStatement(ts.createStatement(ts.inlineExpressions(pendingExpressions)));
                    variablesWritten += pendingExpressions.length;
                    pendingExpressions = [];
                }
            }
            return undefined;
        }
        function transformInitializedVariable(node) {
            return ts.setSourceMapRange(ts.createAssignment(ts.setSourceMapRange(ts.getSynthesizedClone(node.name), node.name), ts.visitNode(node.initializer, visitor, ts.isExpression)), node);
        }
        function transformAndEmitIfStatement(node) {
            if (containsYield(node)) {
                // [source]
                //      if (x)
                //          /*thenStatement*/
                //      else
                //          /*elseStatement*/
                //
                // [intermediate]
                //  .brfalse elseLabel, (x)
                //      /*thenStatement*/
                //  .br endLabel
                //  .mark elseLabel
                //      /*elseStatement*/
                //  .mark endLabel
                if (containsYield(node.thenStatement) || containsYield(node.elseStatement)) {
                    const endLabel = defineLabel();
                    const elseLabel = node.elseStatement ? defineLabel() : undefined;
                    emitBreakWhenFalse(node.elseStatement ? elseLabel : endLabel, ts.visitNode(node.expression, visitor, ts.isExpression), /*location*/ node.expression);
                    transformAndEmitEmbeddedStatement(node.thenStatement);
                    if (node.elseStatement) {
                        emitBreak(endLabel);
                        markLabel(elseLabel);
                        transformAndEmitEmbeddedStatement(node.elseStatement);
                    }
                    markLabel(endLabel);
                }
                else {
                    emitStatement(ts.visitNode(node, visitor, ts.isStatement));
                }
            }
            else {
                emitStatement(ts.visitNode(node, visitor, ts.isStatement));
            }
        }
        function transformAndEmitDoStatement(node) {
            if (containsYield(node)) {
                // [source]
                //      do {
                //          /*body*/
                //      }
                //      while (i < 10);
                //
                // [intermediate]
                //  .loop conditionLabel, endLabel
                //  .mark loopLabel
                //      /*body*/
                //  .mark conditionLabel
                //  .brtrue loopLabel, (i < 10)
                //  .endloop
                //  .mark endLabel
                const conditionLabel = defineLabel();
                const loopLabel = defineLabel();
                beginLoopBlock(/*continueLabel*/ conditionLabel);
                markLabel(loopLabel);
                transformAndEmitEmbeddedStatement(node.statement);
                markLabel(conditionLabel);
                emitBreakWhenTrue(loopLabel, ts.visitNode(node.expression, visitor, ts.isExpression));
                endLoopBlock();
            }
            else {
                emitStatement(ts.visitNode(node, visitor, ts.isStatement));
            }
        }
        function visitDoStatement(node) {
            if (inStatementContainingYield) {
                beginScriptLoopBlock();
                node = ts.visitEachChild(node, visitor, context);
                endLoopBlock();
                return node;
            }
            else {
                return ts.visitEachChild(node, visitor, context);
            }
        }
        function transformAndEmitWhileStatement(node) {
            if (containsYield(node)) {
                // [source]
                //      while (i < 10) {
                //          /*body*/
                //      }
                //
                // [intermediate]
                //  .loop loopLabel, endLabel
                //  .mark loopLabel
                //  .brfalse endLabel, (i < 10)
                //      /*body*/
                //  .br loopLabel
                //  .endloop
                //  .mark endLabel
                const loopLabel = defineLabel();
                const endLabel = beginLoopBlock(loopLabel);
                markLabel(loopLabel);
                emitBreakWhenFalse(endLabel, ts.visitNode(node.expression, visitor, ts.isExpression));
                transformAndEmitEmbeddedStatement(node.statement);
                emitBreak(loopLabel);
                endLoopBlock();
            }
            else {
                emitStatement(ts.visitNode(node, visitor, ts.isStatement));
            }
        }
        function visitWhileStatement(node) {
            if (inStatementContainingYield) {
                beginScriptLoopBlock();
                node = ts.visitEachChild(node, visitor, context);
                endLoopBlock();
                return node;
            }
            else {
                return ts.visitEachChild(node, visitor, context);
            }
        }
        function transformAndEmitForStatement(node) {
            if (containsYield(node)) {
                // [source]
                //      for (var i = 0; i < 10; i++) {
                //          /*body*/
                //      }
                //
                // [intermediate]
                //  .local i
                //      i = 0;
                //  .loop incrementLabel, endLoopLabel
                //  .mark conditionLabel
                //  .brfalse endLoopLabel, (i < 10)
                //      /*body*/
                //  .mark incrementLabel
                //      i++;
                //  .br conditionLabel
                //  .endloop
                //  .mark endLoopLabel
                const conditionLabel = defineLabel();
                const incrementLabel = defineLabel();
                const endLabel = beginLoopBlock(incrementLabel);
                if (node.initializer) {
                    const initializer = node.initializer;
                    if (ts.isVariableDeclarationList(initializer)) {
                        transformAndEmitVariableDeclarationList(initializer);
                    }
                    else {
                        emitStatement(ts.setTextRange(ts.createStatement(ts.visitNode(initializer, visitor, ts.isExpression)), initializer));
                    }
                }
                markLabel(conditionLabel);
                if (node.condition) {
                    emitBreakWhenFalse(endLabel, ts.visitNode(node.condition, visitor, ts.isExpression));
                }
                transformAndEmitEmbeddedStatement(node.statement);
                markLabel(incrementLabel);
                if (node.incrementor) {
                    emitStatement(ts.setTextRange(ts.createStatement(ts.visitNode(node.incrementor, visitor, ts.isExpression)), node.incrementor));
                }
                emitBreak(conditionLabel);
                endLoopBlock();
            }
            else {
                emitStatement(ts.visitNode(node, visitor, ts.isStatement));
            }
        }
        function visitForStatement(node) {
            if (inStatementContainingYield) {
                beginScriptLoopBlock();
            }
            const initializer = node.initializer;
            if (initializer && ts.isVariableDeclarationList(initializer)) {
                for (const variable of initializer.declarations) {
                    hoistVariableDeclaration(variable.name);
                }
                const variables = ts.getInitializedVariables(initializer);
                node = ts.updateFor(node, variables.length > 0
                    ? ts.inlineExpressions(ts.map(variables, transformInitializedVariable))
                    : undefined, ts.visitNode(node.condition, visitor, ts.isExpression), ts.visitNode(node.incrementor, visitor, ts.isExpression), ts.visitNode(node.statement, visitor, ts.isStatement, ts.liftToBlock));
            }
            else {
                node = ts.visitEachChild(node, visitor, context);
            }
            if (inStatementContainingYield) {
                endLoopBlock();
            }
            return node;
        }
        function transformAndEmitForInStatement(node) {
            // TODO(rbuckton): Source map locations
            if (containsYield(node)) {
                // [source]
                //      for (var p in o) {
                //          /*body*/
                //      }
                //
                // [intermediate]
                //  .local _a, _b, _i
                //      _a = [];
                //      for (_b in o) _a.push(_b);
                //      _i = 0;
                //  .loop incrementLabel, endLoopLabel
                //  .mark conditionLabel
                //  .brfalse endLoopLabel, (_i < _a.length)
                //      p = _a[_i];
                //      /*body*/
                //  .mark incrementLabel
                //      _b++;
                //  .br conditionLabel
                //  .endloop
                //  .mark endLoopLabel
                const keysArray = declareLocal(); // _a
                const key = declareLocal(); // _b
                const keysIndex = ts.createLoopVariable(); // _i
                const initializer = node.initializer;
                hoistVariableDeclaration(keysIndex);
                emitAssignment(keysArray, ts.createArrayLiteral());
                emitStatement(ts.createForIn(key, ts.visitNode(node.expression, visitor, ts.isExpression), ts.createStatement(ts.createCall(ts.createPropertyAccess(keysArray, "push"), 
                /*typeArguments*/ undefined, [key]))));
                emitAssignment(keysIndex, ts.createLiteral(0));
                const conditionLabel = defineLabel();
                const incrementLabel = defineLabel();
                const endLabel = beginLoopBlock(incrementLabel);
                markLabel(conditionLabel);
                emitBreakWhenFalse(endLabel, ts.createLessThan(keysIndex, ts.createPropertyAccess(keysArray, "length")));
                let variable;
                if (ts.isVariableDeclarationList(initializer)) {
                    for (const variable of initializer.declarations) {
                        hoistVariableDeclaration(variable.name);
                    }
                    variable = ts.getSynthesizedClone(initializer.declarations[0].name);
                }
                else {
                    variable = ts.visitNode(initializer, visitor, ts.isExpression);
                    ts.Debug.assert(ts.isLeftHandSideExpression(variable));
                }
                emitAssignment(variable, ts.createElementAccess(keysArray, keysIndex));
                transformAndEmitEmbeddedStatement(node.statement);
                markLabel(incrementLabel);
                emitStatement(ts.createStatement(ts.createPostfixIncrement(keysIndex)));
                emitBreak(conditionLabel);
                endLoopBlock();
            }
            else {
                emitStatement(ts.visitNode(node, visitor, ts.isStatement));
            }
        }
        function visitForInStatement(node) {
            // [source]
            //      for (var x in a) {
            //          /*body*/
            //      }
            //
            // [intermediate]
            //  .local x
            //  .loop
            //      for (x in a) {
            //          /*body*/
            //      }
            //  .endloop
            if (inStatementContainingYield) {
                beginScriptLoopBlock();
            }
            const initializer = node.initializer;
            if (ts.isVariableDeclarationList(initializer)) {
                for (const variable of initializer.declarations) {
                    hoistVariableDeclaration(variable.name);
                }
                node = ts.updateForIn(node, initializer.declarations[0].name, ts.visitNode(node.expression, visitor, ts.isExpression), ts.visitNode(node.statement, visitor, ts.isStatement, ts.liftToBlock));
            }
            else {
                node = ts.visitEachChild(node, visitor, context);
            }
            if (inStatementContainingYield) {
                endLoopBlock();
            }
            return node;
        }
        function transformAndEmitContinueStatement(node) {
            const label = findContinueTarget(node.label ? ts.idText(node.label) : undefined);
            if (label > 0) {
                emitBreak(label, /*location*/ node);
            }
            else {
                // invalid continue without a containing loop. Leave the node as is, per #17875.
                emitStatement(node);
            }
        }
        function visitContinueStatement(node) {
            if (inStatementContainingYield) {
                const label = findContinueTarget(node.label && ts.idText(node.label));
                if (label > 0) {
                    return createInlineBreak(label, /*location*/ node);
                }
            }
            return ts.visitEachChild(node, visitor, context);
        }
        function transformAndEmitBreakStatement(node) {
            const label = findBreakTarget(node.label ? ts.idText(node.label) : undefined);
            if (label > 0) {
                emitBreak(label, /*location*/ node);
            }
            else {
                // invalid break without a containing loop, switch, or labeled statement. Leave the node as is, per #17875.
                emitStatement(node);
            }
        }
        function visitBreakStatement(node) {
            if (inStatementContainingYield) {
                const label = findBreakTarget(node.label && ts.idText(node.label));
                if (label > 0) {
                    return createInlineBreak(label, /*location*/ node);
                }
            }
            return ts.visitEachChild(node, visitor, context);
        }
        function transformAndEmitReturnStatement(node) {
            emitReturn(ts.visitNode(node.expression, visitor, ts.isExpression), 
            /*location*/ node);
        }
        function visitReturnStatement(node) {
            return createInlineReturn(ts.visitNode(node.expression, visitor, ts.isExpression), 
            /*location*/ node);
        }
        function transformAndEmitWithStatement(node) {
            if (containsYield(node)) {
                // [source]
                //      with (x) {
                //          /*body*/
                //      }
                //
                // [intermediate]
                //  .with (x)
                //      /*body*/
                //  .endwith
                beginWithBlock(cacheExpression(ts.visitNode(node.expression, visitor, ts.isExpression)));
                transformAndEmitEmbeddedStatement(node.statement);
                endWithBlock();
            }
            else {
                emitStatement(ts.visitNode(node, visitor, ts.isStatement));
            }
        }
        function transformAndEmitSwitchStatement(node) {
            if (containsYield(node.caseBlock)) {
                // [source]
                //      switch (x) {
                //          case a:
                //              /*caseStatements*/
                //          case b:
                //              /*caseStatements*/
                //          default:
                //              /*defaultStatements*/
                //      }
                //
                // [intermediate]
                //  .local _a
                //  .switch endLabel
                //      _a = x;
                //      switch (_a) {
                //          case a:
                //  .br clauseLabels[0]
                //      }
                //      switch (_a) {
                //          case b:
                //  .br clauseLabels[1]
                //      }
                //  .br clauseLabels[2]
                //  .mark clauseLabels[0]
                //      /*caseStatements*/
                //  .mark clauseLabels[1]
                //      /*caseStatements*/
                //  .mark clauseLabels[2]
                //      /*caseStatements*/
                //  .endswitch
                //  .mark endLabel
                const caseBlock = node.caseBlock;
                const numClauses = caseBlock.clauses.length;
                const endLabel = beginSwitchBlock();
                const expression = cacheExpression(ts.visitNode(node.expression, visitor, ts.isExpression));
                // Create labels for each clause and find the index of the first default clause.
                const clauseLabels = [];
                let defaultClauseIndex = -1;
                for (let i = 0; i < numClauses; i++) {
                    const clause = caseBlock.clauses[i];
                    clauseLabels.push(defineLabel());
                    if (clause.kind === ts.SyntaxKind.DefaultClause && defaultClauseIndex === -1) {
                        defaultClauseIndex = i;
                    }
                }
                // Emit switch statements for each run of case clauses either from the first case
                // clause or the next case clause with a `yield` in its expression, up to the next
                // case clause with a `yield` in its expression.
                let clausesWritten = 0;
                let pendingClauses = [];
                while (clausesWritten < numClauses) {
                    let defaultClausesSkipped = 0;
                    for (let i = clausesWritten; i < numClauses; i++) {
                        const clause = caseBlock.clauses[i];
                        if (clause.kind === ts.SyntaxKind.CaseClause) {
                            if (containsYield(clause.expression) && pendingClauses.length > 0) {
                                break;
                            }
                            pendingClauses.push(ts.createCaseClause(ts.visitNode(clause.expression, visitor, ts.isExpression), [
                                createInlineBreak(clauseLabels[i], /*location*/ clause.expression)
                            ]));
                        }
                        else {
                            defaultClausesSkipped++;
                        }
                    }
                    if (pendingClauses.length) {
                        emitStatement(ts.createSwitch(expression, ts.createCaseBlock(pendingClauses)));
                        clausesWritten += pendingClauses.length;
                        pendingClauses = [];
                    }
                    if (defaultClausesSkipped > 0) {
                        clausesWritten += defaultClausesSkipped;
                        defaultClausesSkipped = 0;
                    }
                }
                if (defaultClauseIndex >= 0) {
                    emitBreak(clauseLabels[defaultClauseIndex]);
                }
                else {
                    emitBreak(endLabel);
                }
                for (let i = 0; i < numClauses; i++) {
                    markLabel(clauseLabels[i]);
                    transformAndEmitStatements(caseBlock.clauses[i].statements);
                }
                endSwitchBlock();
            }
            else {
                emitStatement(ts.visitNode(node, visitor, ts.isStatement));
            }
        }
        function visitSwitchStatement(node) {
            if (inStatementContainingYield) {
                beginScriptSwitchBlock();
            }
            node = ts.visitEachChild(node, visitor, context);
            if (inStatementContainingYield) {
                endSwitchBlock();
            }
            return node;
        }
        function transformAndEmitLabeledStatement(node) {
            if (containsYield(node)) {
                // [source]
                //      x: {
                //          /*body*/
                //      }
                //
                // [intermediate]
                //  .labeled "x", endLabel
                //      /*body*/
                //  .endlabeled
                //  .mark endLabel
                beginLabeledBlock(ts.idText(node.label));
                transformAndEmitEmbeddedStatement(node.statement);
                endLabeledBlock();
            }
            else {
                emitStatement(ts.visitNode(node, visitor, ts.isStatement));
            }
        }
        function visitLabeledStatement(node) {
            if (inStatementContainingYield) {
                beginScriptLabeledBlock(ts.idText(node.label));
            }
            node = ts.visitEachChild(node, visitor, context);
            if (inStatementContainingYield) {
                endLabeledBlock();
            }
            return node;
        }
        function transformAndEmitThrowStatement(node) {
            emitThrow(ts.visitNode(node.expression, visitor, ts.isExpression), 
            /*location*/ node);
        }
        function transformAndEmitTryStatement(node) {
            if (containsYield(node)) {
                // [source]
                //      try {
                //          /*tryBlock*/
                //      }
                //      catch (e) {
                //          /*catchBlock*/
                //      }
                //      finally {
                //          /*finallyBlock*/
                //      }
                //
                // [intermediate]
                //  .local _a
                //  .try tryLabel, catchLabel, finallyLabel, endLabel
                //  .mark tryLabel
                //  .nop
                //      /*tryBlock*/
                //  .br endLabel
                //  .catch
                //  .mark catchLabel
                //      _a = %error%;
                //      /*catchBlock*/
                //  .br endLabel
                //  .finally
                //  .mark finallyLabel
                //      /*finallyBlock*/
                //  .endfinally
                //  .endtry
                //  .mark endLabel
                beginExceptionBlock();
                transformAndEmitEmbeddedStatement(node.tryBlock);
                if (node.catchClause) {
                    beginCatchBlock(node.catchClause.variableDeclaration);
                    transformAndEmitEmbeddedStatement(node.catchClause.block);
                }
                if (node.finallyBlock) {
                    beginFinallyBlock();
                    transformAndEmitEmbeddedStatement(node.finallyBlock);
                }
                endExceptionBlock();
            }
            else {
                emitStatement(ts.visitEachChild(node, visitor, context));
            }
        }
        function containsYield(node) {
            return node && (node.transformFlags & 16777216 /* ContainsYield */) !== 0;
        }
        function countInitialNodesWithoutYield(nodes) {
            const numNodes = nodes.length;
            for (let i = 0; i < numNodes; i++) {
                if (containsYield(nodes[i])) {
                    return i;
                }
            }
            return -1;
        }
        function onSubstituteNode(hint, node) {
            node = previousOnSubstituteNode(hint, node);
            if (hint === ts.EmitHint.Expression) {
                return substituteExpression(node);
            }
            return node;
        }
        function substituteExpression(node) {
            if (ts.isIdentifier(node)) {
                return substituteExpressionIdentifier(node);
            }
            return node;
        }
        function substituteExpressionIdentifier(node) {
            if (!ts.isGeneratedIdentifier(node) && renamedCatchVariables && renamedCatchVariables.has(ts.idText(node))) {
                const original = ts.getOriginalNode(node);
                if (ts.isIdentifier(original) && original.parent) {
                    const declaration = resolver.getReferencedValueDeclaration(original);
                    if (declaration) {
                        const name = renamedCatchVariableDeclarations[ts.getOriginalNodeId(declaration)];
                        if (name) {
                            const clone = ts.getMutableClone(name);
                            ts.setSourceMapRange(clone, node);
                            ts.setCommentRange(clone, node);
                            return clone;
                        }
                    }
                }
            }
            return node;
        }
        function cacheExpression(node) {
            let temp;
            if (ts.isGeneratedIdentifier(node) || ts.getEmitFlags(node) & ts.EmitFlags.HelperName) {
                return node;
            }
            temp = ts.createTempVariable(hoistVariableDeclaration);
            emitAssignment(temp, node, /*location*/ node);
            return temp;
        }
        function declareLocal(name) {
            const temp = name
                ? ts.createUniqueName(name)
                : ts.createTempVariable(/*recordTempVariable*/ undefined);
            hoistVariableDeclaration(temp);
            return temp;
        }
        /**
         * Defines a label, uses as the target of a Break operation.
         */
        function defineLabel() {
            if (!labelOffsets) {
                labelOffsets = [];
            }
            const label = nextLabelId;
            nextLabelId++;
            labelOffsets[label] = -1;
            return label;
        }
        /**
         * Marks the current operation with the specified label.
         */
        function markLabel(label) {
            ts.Debug.assert(labelOffsets !== undefined, "No labels were defined.");
            labelOffsets[label] = operations ? operations.length : 0;
        }
        /**
         * Begins a block operation (With, Break/Continue, Try/Catch/Finally)
         *
         * @param block Information about the block.
         */
        function beginBlock(block) {
            if (!blocks) {
                blocks = [];
                blockActions = [];
                blockOffsets = [];
                blockStack = [];
            }
            const index = blockActions.length;
            blockActions[index] = 0 /* Open */;
            blockOffsets[index] = operations ? operations.length : 0;
            blocks[index] = block;
            blockStack.push(block);
            return index;
        }
        /**
         * Ends the current block operation.
         */
        function endBlock() {
            const block = peekBlock();
            ts.Debug.assert(block !== undefined, "beginBlock was never called.");
            const index = blockActions.length;
            blockActions[index] = 1 /* Close */;
            blockOffsets[index] = operations ? operations.length : 0;
            blocks[index] = block;
            blockStack.pop();
            return block;
        }
        /**
         * Gets the current open block.
         */
        function peekBlock() {
            return ts.lastOrUndefined(blockStack);
        }
        /**
         * Gets the kind of the current open block.
         */
        function peekBlockKind() {
            const block = peekBlock();
            return block && block.kind;
        }
        /**
         * Begins a code block for a generated `with` statement.
         *
         * @param expression An identifier representing expression for the `with` block.
         */
        function beginWithBlock(expression) {
            const startLabel = defineLabel();
            const endLabel = defineLabel();
            markLabel(startLabel);
            beginBlock({
                kind: 1 /* With */,
                expression,
                startLabel,
                endLabel
            });
        }
        /**
         * Ends a code block for a generated `with` statement.
         */
        function endWithBlock() {
            ts.Debug.assert(peekBlockKind() === 1 /* With */);
            const block = endBlock();
            markLabel(block.endLabel);
        }
        /**
         * Begins a code block for a generated `try` statement.
         */
        function beginExceptionBlock() {
            const startLabel = defineLabel();
            const endLabel = defineLabel();
            markLabel(startLabel);
            beginBlock({
                kind: 0 /* Exception */,
                state: 0 /* Try */,
                startLabel,
                endLabel
            });
            emitNop();
            return endLabel;
        }
        /**
         * Enters the `catch` clause of a generated `try` statement.
         *
         * @param variable The catch variable.
         */
        function beginCatchBlock(variable) {
            ts.Debug.assert(peekBlockKind() === 0 /* Exception */);
            // generated identifiers should already be unique within a file
            let name;
            if (ts.isGeneratedIdentifier(variable.name)) {
                name = variable.name;
                hoistVariableDeclaration(variable.name);
            }
            else {
                const text = ts.idText(variable.name);
                name = declareLocal(text);
                if (!renamedCatchVariables) {
                    renamedCatchVariables = ts.createMap();
                    renamedCatchVariableDeclarations = [];
                    context.enableSubstitution(ts.SyntaxKind.Identifier);
                }
                renamedCatchVariables.set(text, true);
                renamedCatchVariableDeclarations[ts.getOriginalNodeId(variable)] = name;
            }
            const exception = peekBlock();
            ts.Debug.assert(exception.state < 1 /* Catch */);
            const endLabel = exception.endLabel;
            emitBreak(endLabel);
            const catchLabel = defineLabel();
            markLabel(catchLabel);
            exception.state = 1 /* Catch */;
            exception.catchVariable = name;
            exception.catchLabel = catchLabel;
            emitAssignment(name, ts.createCall(ts.createPropertyAccess(state, "sent"), /*typeArguments*/ undefined, []));
            emitNop();
        }
        /**
         * Enters the `finally` block of a generated `try` statement.
         */
        function beginFinallyBlock() {
            ts.Debug.assert(peekBlockKind() === 0 /* Exception */);
            const exception = peekBlock();
            ts.Debug.assert(exception.state < 2 /* Finally */);
            const endLabel = exception.endLabel;
            emitBreak(endLabel);
            const finallyLabel = defineLabel();
            markLabel(finallyLabel);
            exception.state = 2 /* Finally */;
            exception.finallyLabel = finallyLabel;
        }
        /**
         * Ends the code block for a generated `try` statement.
         */
        function endExceptionBlock() {
            ts.Debug.assert(peekBlockKind() === 0 /* Exception */);
            const exception = endBlock();
            const state = exception.state;
            if (state < 2 /* Finally */) {
                emitBreak(exception.endLabel);
            }
            else {
                emitEndfinally();
            }
            markLabel(exception.endLabel);
            emitNop();
            exception.state = 3 /* Done */;
        }
        /**
         * Begins a code block that supports `break` or `continue` statements that are defined in
         * the source tree and not from generated code.
         *
         * @param labelText Names from containing labeled statements.
         */
        function beginScriptLoopBlock() {
            beginBlock({
                kind: 3 /* Loop */,
                isScript: true,
                breakLabel: -1,
                continueLabel: -1
            });
        }
        /**
         * Begins a code block that supports `break` or `continue` statements that are defined in
         * generated code. Returns a label used to mark the operation to which to jump when a
         * `break` statement targets this block.
         *
         * @param continueLabel A Label used to mark the operation to which to jump when a
         *                      `continue` statement targets this block.
         */
        function beginLoopBlock(continueLabel) {
            const breakLabel = defineLabel();
            beginBlock({
                kind: 3 /* Loop */,
                isScript: false,
                breakLabel,
                continueLabel,
            });
            return breakLabel;
        }
        /**
         * Ends a code block that supports `break` or `continue` statements that are defined in
         * generated code or in the source tree.
         */
        function endLoopBlock() {
            ts.Debug.assert(peekBlockKind() === 3 /* Loop */);
            const block = endBlock();
            const breakLabel = block.breakLabel;
            if (!block.isScript) {
                markLabel(breakLabel);
            }
        }
        /**
         * Begins a code block that supports `break` statements that are defined in the source
         * tree and not from generated code.
         *
         */
        function beginScriptSwitchBlock() {
            beginBlock({
                kind: 2 /* Switch */,
                isScript: true,
                breakLabel: -1
            });
        }
        /**
         * Begins a code block that supports `break` statements that are defined in generated code.
         * Returns a label used to mark the operation to which to jump when a `break` statement
         * targets this block.
         */
        function beginSwitchBlock() {
            const breakLabel = defineLabel();
            beginBlock({
                kind: 2 /* Switch */,
                isScript: false,
                breakLabel,
            });
            return breakLabel;
        }
        /**
         * Ends a code block that supports `break` statements that are defined in generated code.
         */
        function endSwitchBlock() {
            ts.Debug.assert(peekBlockKind() === 2 /* Switch */);
            const block = endBlock();
            const breakLabel = block.breakLabel;
            if (!block.isScript) {
                markLabel(breakLabel);
            }
        }
        function beginScriptLabeledBlock(labelText) {
            beginBlock({
                kind: 4 /* Labeled */,
                isScript: true,
                labelText,
                breakLabel: -1
            });
        }
        function beginLabeledBlock(labelText) {
            const breakLabel = defineLabel();
            beginBlock({
                kind: 4 /* Labeled */,
                isScript: false,
                labelText,
                breakLabel
            });
        }
        function endLabeledBlock() {
            ts.Debug.assert(peekBlockKind() === 4 /* Labeled */);
            const block = endBlock();
            if (!block.isScript) {
                markLabel(block.breakLabel);
            }
        }
        /**
         * Indicates whether the provided block supports `break` statements.
         *
         * @param block A code block.
         */
        function supportsUnlabeledBreak(block) {
            return block.kind === 2 /* Switch */
                || block.kind === 3 /* Loop */;
        }
        /**
         * Indicates whether the provided block supports `break` statements with labels.
         *
         * @param block A code block.
         */
        function supportsLabeledBreakOrContinue(block) {
            return block.kind === 4 /* Labeled */;
        }
        /**
         * Indicates whether the provided block supports `continue` statements.
         *
         * @param block A code block.
         */
        function supportsUnlabeledContinue(block) {
            return block.kind === 3 /* Loop */;
        }
        function hasImmediateContainingLabeledBlock(labelText, start) {
            for (let j = start; j >= 0; j--) {
                const containingBlock = blockStack[j];
                if (supportsLabeledBreakOrContinue(containingBlock)) {
                    if (containingBlock.labelText === labelText) {
                        return true;
                    }
                }
                else {
                    break;
                }
            }
            return false;
        }
        /**
         * Finds the label that is the target for a `break` statement.
         *
         * @param labelText An optional name of a containing labeled statement.
         */
        function findBreakTarget(labelText) {
            if (blockStack) {
                if (labelText) {
                    for (let i = blockStack.length - 1; i >= 0; i--) {
                        const block = blockStack[i];
                        if (supportsLabeledBreakOrContinue(block) && block.labelText === labelText) {
                            return block.breakLabel;
                        }
                        else if (supportsUnlabeledBreak(block) && hasImmediateContainingLabeledBlock(labelText, i - 1)) {
                            return block.breakLabel;
                        }
                    }
                }
                else {
                    for (let i = blockStack.length - 1; i >= 0; i--) {
                        const block = blockStack[i];
                        if (supportsUnlabeledBreak(block)) {
                            return block.breakLabel;
                        }
                    }
                }
            }
            return 0;
        }
        /**
         * Finds the label that is the target for a `continue` statement.
         *
         * @param labelText An optional name of a containing labeled statement.
         */
        function findContinueTarget(labelText) {
            if (blockStack) {
                if (labelText) {
                    for (let i = blockStack.length - 1; i >= 0; i--) {
                        const block = blockStack[i];
                        if (supportsUnlabeledContinue(block) && hasImmediateContainingLabeledBlock(labelText, i - 1)) {
                            return block.continueLabel;
                        }
                    }
                }
                else {
                    for (let i = blockStack.length - 1; i >= 0; i--) {
                        const block = blockStack[i];
                        if (supportsUnlabeledContinue(block)) {
                            return block.continueLabel;
                        }
                    }
                }
            }
            return 0;
        }
        /**
         * Creates an expression that can be used to indicate the value for a label.
         *
         * @param label A label.
         */
        function createLabel(label) {
            if (label > 0) {
                if (labelExpressions === undefined) {
                    labelExpressions = [];
                }
                const expression = ts.createLiteral(-1);
                if (labelExpressions[label] === undefined) {
                    labelExpressions[label] = [expression];
                }
                else {
                    labelExpressions[label].push(expression);
                }
                return expression;
            }
            return ts.createOmittedExpression();
        }
        /**
         * Creates a numeric literal for the provided instruction.
         */
        function createInstruction(instruction) {
            const literal = ts.createLiteral(instruction);
            ts.addSyntheticTrailingComment(literal, ts.SyntaxKind.MultiLineCommentTrivia, getInstructionName(instruction));
            return literal;
        }
        /**
         * Creates a statement that can be used indicate a Break operation to the provided label.
         *
         * @param label A label.
         * @param location An optional source map location for the statement.
         */
        function createInlineBreak(label, location) {
            ts.Debug.assertLessThan(0, label, "Invalid label");
            return ts.setTextRange(ts.createReturn(ts.createArrayLiteral([
                createInstruction(3 /* Break */),
                createLabel(label)
            ])), location);
        }
        /**
         * Creates a statement that can be used indicate a Return operation.
         *
         * @param expression The expression for the return statement.
         * @param location An optional source map location for the statement.
         */
        function createInlineReturn(expression, location) {
            return ts.setTextRange(ts.createReturn(ts.createArrayLiteral(expression
                ? [createInstruction(2 /* Return */), expression]
                : [createInstruction(2 /* Return */)])), location);
        }
        /**
         * Creates an expression that can be used to resume from a Yield operation.
         */
        function createGeneratorResume(location) {
            return ts.setTextRange(ts.createCall(ts.createPropertyAccess(state, "sent"), 
            /*typeArguments*/ undefined, []), location);
        }
        /**
         * Emits an empty instruction.
         */
        function emitNop() {
            emitWorker(0 /* Nop */);
        }
        /**
         * Emits a Statement.
         *
         * @param node A statement.
         */
        function emitStatement(node) {
            if (node) {
                emitWorker(1 /* Statement */, [node]);
            }
            else {
                emitNop();
            }
        }
        /**
         * Emits an Assignment operation.
         *
         * @param left The left-hand side of the assignment.
         * @param right The right-hand side of the assignment.
         * @param location An optional source map location for the assignment.
         */
        function emitAssignment(left, right, location) {
            emitWorker(2 /* Assign */, [left, right], location);
        }
        /**
         * Emits a Break operation to the specified label.
         *
         * @param label A label.
         * @param location An optional source map location for the assignment.
         */
        function emitBreak(label, location) {
            emitWorker(3 /* Break */, [label], location);
        }
        /**
         * Emits a Break operation to the specified label when a condition evaluates to a truthy
         * value at runtime.
         *
         * @param label A label.
         * @param condition The condition.
         * @param location An optional source map location for the assignment.
         */
        function emitBreakWhenTrue(label, condition, location) {
            emitWorker(4 /* BreakWhenTrue */, [label, condition], location);
        }
        /**
         * Emits a Break to the specified label when a condition evaluates to a falsey value at
         * runtime.
         *
         * @param label A label.
         * @param condition The condition.
         * @param location An optional source map location for the assignment.
         */
        function emitBreakWhenFalse(label, condition, location) {
            emitWorker(5 /* BreakWhenFalse */, [label, condition], location);
        }
        /**
         * Emits a YieldStar operation for the provided expression.
         *
         * @param expression An optional value for the yield operation.
         * @param location An optional source map location for the assignment.
         */
        function emitYieldStar(expression, location) {
            emitWorker(7 /* YieldStar */, [expression], location);
        }
        /**
         * Emits a Yield operation for the provided expression.
         *
         * @param expression An optional value for the yield operation.
         * @param location An optional source map location for the assignment.
         */
        function emitYield(expression, location) {
            emitWorker(6 /* Yield */, [expression], location);
        }
        /**
         * Emits a Return operation for the provided expression.
         *
         * @param expression An optional value for the operation.
         * @param location An optional source map location for the assignment.
         */
        function emitReturn(expression, location) {
            emitWorker(8 /* Return */, [expression], location);
        }
        /**
         * Emits a Throw operation for the provided expression.
         *
         * @param expression A value for the operation.
         * @param location An optional source map location for the assignment.
         */
        function emitThrow(expression, location) {
            emitWorker(9 /* Throw */, [expression], location);
        }
        /**
         * Emits an Endfinally operation. This is used to handle `finally` block semantics.
         */
        function emitEndfinally() {
            emitWorker(10 /* Endfinally */);
        }
        /**
         * Emits an operation.
         *
         * @param code The OpCode for the operation.
         * @param args The optional arguments for the operation.
         */
        function emitWorker(code, args, location) {
            if (operations === undefined) {
                operations = [];
                operationArguments = [];
                operationLocations = [];
            }
            if (labelOffsets === undefined) {
                // mark entry point
                markLabel(defineLabel());
            }
            const operationIndex = operations.length;
            operations[operationIndex] = code;
            operationArguments[operationIndex] = args;
            operationLocations[operationIndex] = location;
        }
        /**
         * Builds the generator function body.
         */
        function build() {
            blockIndex = 0;
            labelNumber = 0;
            labelNumbers = undefined;
            lastOperationWasAbrupt = false;
            lastOperationWasCompletion = false;
            clauses = undefined;
            statements = undefined;
            exceptionBlockStack = undefined;
            currentExceptionBlock = undefined;
            withBlockStack = undefined;
            const buildResult = buildStatements();
            return createGeneratorHelper(context, ts.setEmitFlags(ts.createFunctionExpression(
            /*modifiers*/ undefined, 
            /*asteriskToken*/ undefined, 
            /*name*/ undefined, 
            /*typeParameters*/ undefined, [ts.createParameter(/*decorators*/ undefined, /*modifiers*/ undefined, /*dotDotDotToken*/ undefined, state)], 
            /*type*/ undefined, ts.createBlock(buildResult, 
            /*multiLine*/ buildResult.length > 0)), ts.EmitFlags.ReuseTempVariableScope));
        }
        /**
         * Builds the statements for the generator function body.
         */
        function buildStatements() {
            if (operations) {
                for (let operationIndex = 0; operationIndex < operations.length; operationIndex++) {
                    writeOperation(operationIndex);
                }
                flushFinalLabel(operations.length);
            }
            else {
                flushFinalLabel(0);
            }
            if (clauses) {
                const labelExpression = ts.createPropertyAccess(state, "label");
                const switchStatement = ts.createSwitch(labelExpression, ts.createCaseBlock(clauses));
                return [ts.startOnNewLine(switchStatement)];
            }
            if (statements) {
                return statements;
            }
            return [];
        }
        /**
         * Flush the current label and advance to a new label.
         */
        function flushLabel() {
            if (!statements) {
                return;
            }
            appendLabel(/*markLabelEnd*/ !lastOperationWasAbrupt);
            lastOperationWasAbrupt = false;
            lastOperationWasCompletion = false;
            labelNumber++;
        }
        /**
         * Flush the final label of the generator function body.
         */
        function flushFinalLabel(operationIndex) {
            if (isFinalLabelReachable(operationIndex)) {
                tryEnterLabel(operationIndex);
                withBlockStack = undefined;
                writeReturn(/*expression*/ undefined, /*operationLocation*/ undefined);
            }
            if (statements && clauses) {
                appendLabel(/*markLabelEnd*/ false);
            }
            updateLabelExpressions();
        }
        /**
         * Tests whether the final label of the generator function body
         * is reachable by user code.
         */
        function isFinalLabelReachable(operationIndex) {
            // if the last operation was *not* a completion (return/throw) then
            // the final label is reachable.
            if (!lastOperationWasCompletion) {
                return true;
            }
            // if there are no labels defined or referenced, then the final label is
            // not reachable.
            if (!labelOffsets || !labelExpressions) {
                return false;
            }
            // if the label for this offset is referenced, then the final label
            // is reachable.
            for (let label = 0; label < labelOffsets.length; label++) {
                if (labelOffsets[label] === operationIndex && labelExpressions[label]) {
                    return true;
                }
            }
            return false;
        }
        /**
         * Appends a case clause for the last label and sets the new label.
         *
         * @param markLabelEnd Indicates that the transition between labels was a fall-through
         *                     from a previous case clause and the change in labels should be
         *                     reflected on the `state` object.
         */
        function appendLabel(markLabelEnd) {
            if (!clauses) {
                clauses = [];
            }
            if (statements) {
                if (withBlockStack) {
                    // The previous label was nested inside one or more `with` blocks, so we
                    // surround the statements in generated `with` blocks to create the same environment.
                    for (let i = withBlockStack.length - 1; i >= 0; i--) {
                        const withBlock = withBlockStack[i];
                        statements = [ts.createWith(withBlock.expression, ts.createBlock(statements))];
                    }
                }
                if (currentExceptionBlock) {
                    // The previous label was nested inside of an exception block, so we must
                    // indicate entry into a protected region by pushing the label numbers
                    // for each block in the protected region.
                    const { startLabel, catchLabel, finallyLabel, endLabel } = currentExceptionBlock;
                    statements.unshift(ts.createStatement(ts.createCall(ts.createPropertyAccess(ts.createPropertyAccess(state, "trys"), "push"), 
                    /*typeArguments*/ undefined, [
                        ts.createArrayLiteral([
                            createLabel(startLabel),
                            createLabel(catchLabel),
                            createLabel(finallyLabel),
                            createLabel(endLabel)
                        ])
                    ])));
                    currentExceptionBlock = undefined;
                }
                if (markLabelEnd) {
                    // The case clause for the last label falls through to this label, so we
                    // add an assignment statement to reflect the change in labels.
                    statements.push(ts.createStatement(ts.createAssignment(ts.createPropertyAccess(state, "label"), ts.createLiteral(labelNumber + 1))));
                }
            }
            clauses.push(ts.createCaseClause(ts.createLiteral(labelNumber), statements || []));
            statements = undefined;
        }
        /**
         * Tries to enter into a new label at the current operation index.
         */
        function tryEnterLabel(operationIndex) {
            if (!labelOffsets) {
                return;
            }
            for (let label = 0; label < labelOffsets.length; label++) {
                if (labelOffsets[label] === operationIndex) {
                    flushLabel();
                    if (labelNumbers === undefined) {
                        labelNumbers = [];
                    }
                    if (labelNumbers[labelNumber] === undefined) {
                        labelNumbers[labelNumber] = [label];
                    }
                    else {
                        labelNumbers[labelNumber].push(label);
                    }
                }
            }
        }
        /**
         * Updates literal expressions for labels with actual label numbers.
         */
        function updateLabelExpressions() {
            if (labelExpressions !== undefined && labelNumbers !== undefined) {
                for (let labelNumber = 0; labelNumber < labelNumbers.length; labelNumber++) {
                    const labels = labelNumbers[labelNumber];
                    if (labels !== undefined) {
                        for (const label of labels) {
                            const expressions = labelExpressions[label];
                            if (expressions !== undefined) {
                                for (const expression of expressions) {
                                    expression.text = String(labelNumber);
                                }
                            }
                        }
                    }
                }
            }
        }
        /**
         * Tries to enter or leave a code block.
         */
        function tryEnterOrLeaveBlock(operationIndex) {
            if (blocks) {
                for (; blockIndex < blockActions.length && blockOffsets[blockIndex] <= operationIndex; blockIndex++) {
                    const block = blocks[blockIndex];
                    const blockAction = blockActions[blockIndex];
                    switch (block.kind) {
                        case 0 /* Exception */:
                            if (blockAction === 0 /* Open */) {
                                if (!exceptionBlockStack) {
                                    exceptionBlockStack = [];
                                }
                                if (!statements) {
                                    statements = [];
                                }
                                exceptionBlockStack.push(currentExceptionBlock);
                                currentExceptionBlock = block;
                            }
                            else if (blockAction === 1 /* Close */) {
                                currentExceptionBlock = exceptionBlockStack.pop();
                            }
                            break;
                        case 1 /* With */:
                            if (blockAction === 0 /* Open */) {
                                if (!withBlockStack) {
                                    withBlockStack = [];
                                }
                                withBlockStack.push(block);
                            }
                            else if (blockAction === 1 /* Close */) {
                                withBlockStack.pop();
                            }
                            break;
                        // default: do nothing
                    }
                }
            }
        }
        /**
         * Writes an operation as a statement to the current label's statement list.
         *
         * @param operation The OpCode of the operation
         */
        function writeOperation(operationIndex) {
            tryEnterLabel(operationIndex);
            tryEnterOrLeaveBlock(operationIndex);
            // early termination, nothing else to process in this label
            if (lastOperationWasAbrupt) {
                return;
            }
            lastOperationWasAbrupt = false;
            lastOperationWasCompletion = false;
            const opcode = operations[operationIndex];
            if (opcode === 0 /* Nop */) {
                return;
            }
            else if (opcode === 10 /* Endfinally */) {
                return writeEndfinally();
            }
            const args = operationArguments[operationIndex];
            if (opcode === 1 /* Statement */) {
                return writeStatement(args[0]);
            }
            const location = operationLocations[operationIndex];
            switch (opcode) {
                case 2 /* Assign */:
                    return writeAssign(args[0], args[1], location);
                case 3 /* Break */:
                    return writeBreak(args[0], location);
                case 4 /* BreakWhenTrue */:
                    return writeBreakWhenTrue(args[0], args[1], location);
                case 5 /* BreakWhenFalse */:
                    return writeBreakWhenFalse(args[0], args[1], location);
                case 6 /* Yield */:
                    return writeYield(args[0], location);
                case 7 /* YieldStar */:
                    return writeYieldStar(args[0], location);
                case 8 /* Return */:
                    return writeReturn(args[0], location);
                case 9 /* Throw */:
                    return writeThrow(args[0], location);
            }
        }
        /**
         * Writes a statement to the current label's statement list.
         *
         * @param statement A statement to write.
         */
        function writeStatement(statement) {
            if (statement) {
                if (!statements) {
                    statements = [statement];
                }
                else {
                    statements.push(statement);
                }
            }
        }
        /**
         * Writes an Assign operation to the current label's statement list.
         *
         * @param left The left-hand side of the assignment.
         * @param right The right-hand side of the assignment.
         * @param operationLocation The source map location for the operation.
         */
        function writeAssign(left, right, operationLocation) {
            writeStatement(ts.setTextRange(ts.createStatement(ts.createAssignment(left, right)), operationLocation));
        }
        /**
         * Writes a Throw operation to the current label's statement list.
         *
         * @param expression The value to throw.
         * @param operationLocation The source map location for the operation.
         */
        function writeThrow(expression, operationLocation) {
            lastOperationWasAbrupt = true;
            lastOperationWasCompletion = true;
            writeStatement(ts.setTextRange(ts.createThrow(expression), operationLocation));
        }
        /**
         * Writes a Return operation to the current label's statement list.
         *
         * @param expression The value to return.
         * @param operationLocation The source map location for the operation.
         */
        function writeReturn(expression, operationLocation) {
            lastOperationWasAbrupt = true;
            lastOperationWasCompletion = true;
            writeStatement(ts.setEmitFlags(ts.setTextRange(ts.createReturn(ts.createArrayLiteral(expression
                ? [createInstruction(2 /* Return */), expression]
                : [createInstruction(2 /* Return */)])), operationLocation), ts.EmitFlags.NoTokenSourceMaps));
        }
        /**
         * Writes a Break operation to the current label's statement list.
         *
         * @param label The label for the Break.
         * @param operationLocation The source map location for the operation.
         */
        function writeBreak(label, operationLocation) {
            lastOperationWasAbrupt = true;
            writeStatement(ts.setEmitFlags(ts.setTextRange(ts.createReturn(ts.createArrayLiteral([
                createInstruction(3 /* Break */),
                createLabel(label)
            ])), operationLocation), ts.EmitFlags.NoTokenSourceMaps));
        }
        /**
         * Writes a BreakWhenTrue operation to the current label's statement list.
         *
         * @param label The label for the Break.
         * @param condition The condition for the Break.
         * @param operationLocation The source map location for the operation.
         */
        function writeBreakWhenTrue(label, condition, operationLocation) {
            writeStatement(ts.setEmitFlags(ts.createIf(condition, ts.setEmitFlags(ts.setTextRange(ts.createReturn(ts.createArrayLiteral([
                createInstruction(3 /* Break */),
                createLabel(label)
            ])), operationLocation), ts.EmitFlags.NoTokenSourceMaps)), ts.EmitFlags.SingleLine));
        }
        /**
         * Writes a BreakWhenFalse operation to the current label's statement list.
         *
         * @param label The label for the Break.
         * @param condition The condition for the Break.
         * @param operationLocation The source map location for the operation.
         */
        function writeBreakWhenFalse(label, condition, operationLocation) {
            writeStatement(ts.setEmitFlags(ts.createIf(ts.createLogicalNot(condition), ts.setEmitFlags(ts.setTextRange(ts.createReturn(ts.createArrayLiteral([
                createInstruction(3 /* Break */),
                createLabel(label)
            ])), operationLocation), ts.EmitFlags.NoTokenSourceMaps)), ts.EmitFlags.SingleLine));
        }
        /**
         * Writes a Yield operation to the current label's statement list.
         *
         * @param expression The expression to yield.
         * @param operationLocation The source map location for the operation.
         */
        function writeYield(expression, operationLocation) {
            lastOperationWasAbrupt = true;
            writeStatement(ts.setEmitFlags(ts.setTextRange(ts.createReturn(ts.createArrayLiteral(expression
                ? [createInstruction(4 /* Yield */), expression]
                : [createInstruction(4 /* Yield */)])), operationLocation), ts.EmitFlags.NoTokenSourceMaps));
        }
        /**
         * Writes a YieldStar instruction to the current label's statement list.
         *
         * @param expression The expression to yield.
         * @param operationLocation The source map location for the operation.
         */
        function writeYieldStar(expression, operationLocation) {
            lastOperationWasAbrupt = true;
            writeStatement(ts.setEmitFlags(ts.setTextRange(ts.createReturn(ts.createArrayLiteral([
                createInstruction(5 /* YieldStar */),
                expression
            ])), operationLocation), ts.EmitFlags.NoTokenSourceMaps));
        }
        /**
         * Writes an Endfinally instruction to the current label's statement list.
         */
        function writeEndfinally() {
            lastOperationWasAbrupt = true;
            writeStatement(ts.createReturn(ts.createArrayLiteral([
                createInstruction(7 /* Endfinally */)
            ])));
        }
    }
    ts.transformGenerators = transformGenerators;
    function createGeneratorHelper(context, body) {
        context.requestEmitHelper(generatorHelper);
        return ts.createCall(ts.getHelperName("__generator"), 
        /*typeArguments*/ undefined, [ts.createThis(), body]);
    }
    // The __generator helper is used by down-level transformations to emulate the runtime
    // semantics of an ES2015 generator function. When called, this helper returns an
    // object that implements the Iterator protocol, in that it has `next`, `return`, and
    // `throw` methods that step through the generator when invoked.
    //
    // parameters:
    //  @param thisArg  The value to use as the `this` binding for the transformed generator body.
    //  @param body     A function that acts as the transformed generator body.
    //
    // variables:
    //  _       Persistent state for the generator that is shared between the helper and the
    //          generator body. The state object has the following members:
    //            sent() - A method that returns or throws the current completion value.
    //            label  - The next point at which to resume evaluation of the generator body.
    //            trys   - A stack of protected regions (try/catch/finally blocks).
    //            ops    - A stack of pending instructions when inside of a finally block.
    //  f       A value indicating whether the generator is executing.
    //  y       An iterator to delegate for a yield*.
    //  t       A temporary variable that holds one of the following values (note that these
    //          cases do not overlap):
    //          - The completion value when resuming from a `yield` or `yield*`.
    //          - The error value for a catch block.
    //          - The current protected region (array of try/catch/finally/end labels).
    //          - The verb (`next`, `throw`, or `return` method) to delegate to the expression
    //            of a `yield*`.
    //          - The result of evaluating the verb delegated to the expression of a `yield*`.
    //
    // functions:
    //  verb(n)     Creates a bound callback to the `step` function for opcode `n`.
    //  step(op)    Evaluates opcodes in a generator body until execution is suspended or
    //              completed.
    //
    // The __generator helper understands a limited set of instructions:
    //  0: next(value?)     - Start or resume the generator with the specified value.
    //  1: throw(error)     - Resume the generator with an exception. If the generator is
    //                        suspended inside of one or more protected regions, evaluates
    //                        any intervening finally blocks between the current label and
    //                        the nearest catch block or function boundary. If uncaught, the
    //                        exception is thrown to the caller.
    //  2: return(value?)   - Resume the generator as if with a return. If the generator is
    //                        suspended inside of one or more protected regions, evaluates any
    //                        intervening finally blocks.
    //  3: break(label)     - Jump to the specified label. If the label is outside of the
    //                        current protected region, evaluates any intervening finally
    //                        blocks.
    //  4: yield(value?)    - Yield execution to the caller with an optional value. When
    //                        resumed, the generator will continue at the next label.
    //  5: yield*(value)    - Delegates evaluation to the supplied iterator. When
    //                        delegation completes, the generator will continue at the next
    //                        label.
    //  6: catch(error)     - Handles an exception thrown from within the generator body. If
    //                        the current label is inside of one or more protected regions,
    //                        evaluates any intervening finally blocks between the current
    //                        label and the nearest catch block or function boundary. If
    //                        uncaught, the exception is thrown to the caller.
    //  7: endfinally       - Ends a finally block, resuming the last instruction prior to
    //                        entering a finally block.
    //
    // For examples of how these are used, see the comments in ./transformers/generators.ts
    const generatorHelper = {
        name: "typescript:generator",
        scoped: false,
        priority: 6,
        text: `
            var __generator = (this && this.__generator) || function (thisArg, body) {
                var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
                return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
                function verb(n) { return function (v) { return step([n, v]); }; }
                function step(op) {
                    if (f) throw new TypeError("Generator is already executing.");
                    while (_) try {
                        if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
                        if (y = 0, t) op = [0, t.value];
                        switch (op[0]) {
                            case 0: case 1: t = op; break;
                            case 4: _.label++; return { value: op[1], done: false };
                            case 5: _.label++; y = op[1]; op = [0]; continue;
                            case 7: op = _.ops.pop(); _.trys.pop(); continue;
                            default:
                                if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                                if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                                if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                                if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                                if (t[2]) _.ops.pop();
                                _.trys.pop(); continue;
                        }
                        op = body.call(thisArg, _);
                    } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
                    if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
                }
            };`
    };
})(ts || (ts = {}));
