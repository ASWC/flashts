/*@internal*/
var ts;
(function (ts) {
    /**
     * Indicates whether to emit type metadata in the new format.
     */
    const USE_NEW_TYPE_METADATA_FORMAT = false;
    function transformTypeScript(context) {
        const { startLexicalEnvironment, resumeLexicalEnvironment, endLexicalEnvironment, hoistVariableDeclaration, } = context;
        const resolver = context.getEmitResolver();
        const compilerOptions = context.getCompilerOptions();
        const strictNullChecks = ts.getStrictOptionValue(compilerOptions, "strictNullChecks");
        const languageVersion = ts.getEmitScriptTarget(compilerOptions);
        const moduleKind = ts.getEmitModuleKind(compilerOptions);
        // Save the previous transformation hooks.
        const previousOnEmitNode = context.onEmitNode;
        const previousOnSubstituteNode = context.onSubstituteNode;
        // Set new transformation hooks.
        context.onEmitNode = onEmitNode;
        context.onSubstituteNode = onSubstituteNode;
        // Enable substitution for property/element access to emit const enum values.
        context.enableSubstitution(ts.SyntaxKind.PropertyAccessExpression);
        context.enableSubstitution(ts.SyntaxKind.ElementAccessExpression);
        // These variables contain state that changes as we descend into the tree.
        let currentSourceFile;
        let currentNamespace;
        let currentNamespaceContainerName;
        let currentScope;
        let currentScopeFirstDeclarationsOfName;
        /**
         * Keeps track of whether expression substitution has been enabled for specific edge cases.
         * They are persisted between each SourceFile transformation and should not be reset.
         */
        let enabledSubstitutions;
        /**
         * A map that keeps track of aliases created for classes with decorators to avoid issues
         * with the double-binding behavior of classes.
         */
        let classAliases;
        /**
         * Keeps track of whether we are within any containing namespaces when performing
         * just-in-time substitution while printing an expression identifier.
         */
        let applicableSubstitutions;
        /**
         * Tracks what computed name expressions originating from elided names must be inlined
         * at the next execution site, in document order
         */
        let pendingExpressions;
        return transformSourceFile;
        /**
         * Transform TypeScript-specific syntax in a SourceFile.
         *
         * @param node A SourceFile node.
         */
        function transformSourceFile(node) {
            if (node.isDeclarationFile) {
                return node;
            }
            currentSourceFile = node;
            const visited = saveStateAndInvoke(node, visitSourceFile);
            ts.addEmitHelpers(visited, context.readEmitHelpers());
            currentSourceFile = undefined;
            return visited;
        }
        /**
         * Visits a node, saving and restoring state variables on the stack.
         *
         * @param node The node to visit.
         */
        function saveStateAndInvoke(node, f) {
            // Save state
            const savedCurrentScope = currentScope;
            const savedCurrentScopeFirstDeclarationsOfName = currentScopeFirstDeclarationsOfName;
            // Handle state changes before visiting a node.
            onBeforeVisitNode(node);
            const visited = f(node);
            // Restore state
            if (currentScope !== savedCurrentScope) {
                currentScopeFirstDeclarationsOfName = savedCurrentScopeFirstDeclarationsOfName;
            }
            currentScope = savedCurrentScope;
            return visited;
        }
        /**
         * Performs actions that should always occur immediately before visiting a node.
         *
         * @param node The node to visit.
         */
        function onBeforeVisitNode(node) {
            switch (node.kind) {
                case ts.SyntaxKind.SourceFile:
                case ts.SyntaxKind.CaseBlock:
                case ts.SyntaxKind.ModuleBlock:
                case ts.SyntaxKind.Block:
                    currentScope = node;
                    currentScopeFirstDeclarationsOfName = undefined;
                    break;
                case ts.SyntaxKind.ClassDeclaration:
                case ts.SyntaxKind.FunctionDeclaration:
                    if (ts.hasModifier(node, ts.ModifierFlags.Ambient)) {
                        break;
                    }
                    // Record these declarations provided that they have a name.
                    if (node.name) {
                        recordEmittedDeclarationInScope(node);
                    }
                    else {
                        // These nodes should always have names unless they are default-exports;
                        // however, class declaration parsing allows for undefined names, so syntactically invalid
                        // programs may also have an undefined name.
                        ts.Debug.assert(node.kind === ts.SyntaxKind.ClassDeclaration || ts.hasModifier(node, ts.ModifierFlags.Default));
                    }
                    break;
            }
        }
        /**
         * General-purpose node visitor.
         *
         * @param node The node to visit.
         */
        function visitor(node) {
            return saveStateAndInvoke(node, visitorWorker);
        }
        /**
         * Visits and possibly transforms any node.
         *
         * @param node The node to visit.
         */
        function visitorWorker(node) {
            if (node.transformFlags & 1 /* TypeScript */) {
                // This node is explicitly marked as TypeScript, so we should transform the node.
                return visitTypeScript(node);
            }
            else if (node.transformFlags & 2 /* ContainsTypeScript */) {
                // This node contains TypeScript, so we should visit its children.
                return ts.visitEachChild(node, visitor, context);
            }
            return node;
        }
        /**
         * Specialized visitor that visits the immediate children of a SourceFile.
         *
         * @param node The node to visit.
         */
        function sourceElementVisitor(node) {
            return saveStateAndInvoke(node, sourceElementVisitorWorker);
        }
        /**
         * Specialized visitor that visits the immediate children of a SourceFile.
         *
         * @param node The node to visit.
         */
        function sourceElementVisitorWorker(node) {
            switch (node.kind) {
                case ts.SyntaxKind.ImportDeclaration:
                case ts.SyntaxKind.ImportEqualsDeclaration:
                case ts.SyntaxKind.ExportAssignment:
                case ts.SyntaxKind.ExportDeclaration:
                    return visitEllidableStatement(node);
                default:
                    return visitorWorker(node);
            }
        }
        function visitEllidableStatement(node) {
            const parsed = ts.getParseTreeNode(node);
            if (parsed !== node) {
                // If the node has been transformed by a `before` transformer, perform no ellision on it
                // As the type information we would attempt to lookup to perform ellision is potentially unavailable for the synthesized nodes
                // We do not reuse `visitorWorker`, as the ellidable statement syntax kinds are technically unrecognized by the switch-case in `visitTypeScript`,
                // and will trigger debug failures when debug verbosity is turned up
                if (node.transformFlags & 2 /* ContainsTypeScript */) {
                    // This node contains TypeScript, so we should visit its children.
                    return ts.visitEachChild(node, visitor, context);
                }
                // Otherwise, we can just return the node
                return node;
            }
            switch (node.kind) {
                case ts.SyntaxKind.ImportDeclaration:
                    return visitImportDeclaration(node);
                case ts.SyntaxKind.ImportEqualsDeclaration:
                    return visitImportEqualsDeclaration(node);
                case ts.SyntaxKind.ExportAssignment:
                    return visitExportAssignment(node);
                case ts.SyntaxKind.ExportDeclaration:
                    return visitExportDeclaration(node);
                default:
                    ts.Debug.fail("Unhandled ellided statement");
            }
        }
        /**
         * Specialized visitor that visits the immediate children of a namespace.
         *
         * @param node The node to visit.
         */
        function namespaceElementVisitor(node) {
            return saveStateAndInvoke(node, namespaceElementVisitorWorker);
        }
        /**
         * Specialized visitor that visits the immediate children of a namespace.
         *
         * @param node The node to visit.
         */
        function namespaceElementVisitorWorker(node) {
            if (node.kind === ts.SyntaxKind.ExportDeclaration ||
                node.kind === ts.SyntaxKind.ImportDeclaration ||
                node.kind === ts.SyntaxKind.ImportClause ||
                (node.kind === ts.SyntaxKind.ImportEqualsDeclaration &&
                    node.moduleReference.kind === ts.SyntaxKind.ExternalModuleReference)) {
                // do not emit ES6 imports and exports since they are illegal inside a namespace
                return undefined;
            }
            else if (node.transformFlags & 1 /* TypeScript */ || ts.hasModifier(node, ts.ModifierFlags.Export)) {
                // This node is explicitly marked as TypeScript, or is exported at the namespace
                // level, so we should transform the node.
                return visitTypeScript(node);
            }
            else if (node.transformFlags & 2 /* ContainsTypeScript */) {
                // This node contains TypeScript, so we should visit its children.
                return ts.visitEachChild(node, visitor, context);
            }
            return node;
        }
        /**
         * Specialized visitor that visits the immediate children of a class with TypeScript syntax.
         *
         * @param node The node to visit.
         */
        function classElementVisitor(node) {
            return saveStateAndInvoke(node, classElementVisitorWorker);
        }
        /**
         * Specialized visitor that visits the immediate children of a class with TypeScript syntax.
         *
         * @param node The node to visit.
         */
        function classElementVisitorWorker(node) {
            switch (node.kind) {
                case ts.SyntaxKind.Constructor:
                    // TypeScript constructors are transformed in `visitClassDeclaration`.
                    // We elide them here as `visitorWorker` checks transform flags, which could
                    // erronously include an ES6 constructor without TypeScript syntax.
                    return undefined;
                case ts.SyntaxKind.PropertyDeclaration:
                case ts.SyntaxKind.IndexSignature:
                case ts.SyntaxKind.GetAccessor:
                case ts.SyntaxKind.SetAccessor:
                case ts.SyntaxKind.MethodDeclaration:
                    // Fallback to the default visit behavior.
                    return visitorWorker(node);
                case ts.SyntaxKind.SemicolonClassElement:
                    return node;
                default:
                    return ts.Debug.failBadSyntaxKind(node);
            }
        }
        function modifierVisitor(node) {
            if (ts.modifierToFlag(node.kind) & ts.ModifierFlags.TypeScriptModifier) {
                return undefined;
            }
            else if (currentNamespace && node.kind === ts.SyntaxKind.ExportKeyword) {
                return undefined;
            }
            return node;
        }
        /**
         * Branching visitor, visits a TypeScript syntax node.
         *
         * @param node The node to visit.
         */
        function visitTypeScript(node) {
            if (ts.hasModifier(node, ts.ModifierFlags.Ambient) && ts.isStatement(node)) {
                // TypeScript ambient declarations are elided, but some comments may be preserved.
                // See the implementation of `getLeadingComments` in comments.ts for more details.
                return ts.createNotEmittedStatement(node);
            }
            switch (node.kind) {
                case ts.SyntaxKind.ExportKeyword:
                case ts.SyntaxKind.DefaultKeyword:
                    // ES6 export and default modifiers are elided when inside a namespace.
                    return currentNamespace ? undefined : node;
                case ts.SyntaxKind.PublicKeyword:
                case ts.SyntaxKind.PrivateKeyword:
                case ts.SyntaxKind.ProtectedKeyword:
                case ts.SyntaxKind.AbstractKeyword:
                case ts.SyntaxKind.ConstKeyword:
                case ts.SyntaxKind.DeclareKeyword:
                case ts.SyntaxKind.ReadonlyKeyword:
                // TypeScript accessibility and readonly modifiers are elided.
                case ts.SyntaxKind.ArrayType:
                case ts.SyntaxKind.TupleType:
                case ts.SyntaxKind.TypeLiteral:
                case ts.SyntaxKind.TypePredicate:
                case ts.SyntaxKind.TypeParameter:
                case ts.SyntaxKind.AnyKeyword:
                case ts.SyntaxKind.BooleanKeyword:
                case ts.SyntaxKind.StringKeyword:
                case ts.SyntaxKind.NumberKeyword:
                case ts.SyntaxKind.NeverKeyword:
                case ts.SyntaxKind.VoidKeyword:
                case ts.SyntaxKind.SymbolKeyword:
                case ts.SyntaxKind.ConstructorType:
                case ts.SyntaxKind.FunctionType:
                case ts.SyntaxKind.TypeQuery:
                case ts.SyntaxKind.TypeReference:
                case ts.SyntaxKind.UnionType:
                case ts.SyntaxKind.IntersectionType:
                case ts.SyntaxKind.ConditionalType:
                case ts.SyntaxKind.ParenthesizedType:
                case ts.SyntaxKind.ThisType:
                case ts.SyntaxKind.TypeOperator:
                case ts.SyntaxKind.IndexedAccessType:
                case ts.SyntaxKind.MappedType:
                case ts.SyntaxKind.LiteralType:
                // TypeScript type nodes are elided.
                case ts.SyntaxKind.IndexSignature:
                // TypeScript index signatures are elided.
                case ts.SyntaxKind.Decorator:
                // TypeScript decorators are elided. They will be emitted as part of visitClassDeclaration.
                case ts.SyntaxKind.TypeAliasDeclaration:
                    // TypeScript type-only declarations are elided.
                    return undefined;
                case ts.SyntaxKind.PropertyDeclaration:
                    // TypeScript property declarations are elided. However their names are still visited, and can potentially be retained if they could have sideeffects
                    return visitPropertyDeclaration(node);
                case ts.SyntaxKind.NamespaceExportDeclaration:
                    // TypeScript namespace export declarations are elided.
                    return undefined;
                case ts.SyntaxKind.Constructor:
                    return visitConstructor(node);
                case ts.SyntaxKind.InterfaceDeclaration:
                    // TypeScript interfaces are elided, but some comments may be preserved.
                    // See the implementation of `getLeadingComments` in comments.ts for more details.
                    return ts.createNotEmittedStatement(node);
                case ts.SyntaxKind.ClassDeclaration:
                    // This is a class declaration with TypeScript syntax extensions.
                    //
                    // TypeScript class syntax extensions include:
                    // - decorators
                    // - optional `implements` heritage clause
                    // - parameter property assignments in the constructor
                    // - property declarations
                    // - index signatures
                    // - method overload signatures
                    return visitClassDeclaration(node);
                case ts.SyntaxKind.ClassExpression:
                    // This is a class expression with TypeScript syntax extensions.
                    //
                    // TypeScript class syntax extensions include:
                    // - decorators
                    // - optional `implements` heritage clause
                    // - parameter property assignments in the constructor
                    // - property declarations
                    // - index signatures
                    // - method overload signatures
                    return visitClassExpression(node);
                case ts.SyntaxKind.HeritageClause:
                    // This is a heritage clause with TypeScript syntax extensions.
                    //
                    // TypeScript heritage clause extensions include:
                    // - `implements` clause
                    return visitHeritageClause(node);
                case ts.SyntaxKind.ExpressionWithTypeArguments:
                    // TypeScript supports type arguments on an expression in an `extends` heritage clause.
                    return visitExpressionWithTypeArguments(node);
                case ts.SyntaxKind.MethodDeclaration:
                    // TypeScript method declarations may have decorators, modifiers
                    // or type annotations.
                    return visitMethodDeclaration(node);
                case ts.SyntaxKind.GetAccessor:
                    // Get Accessors can have TypeScript modifiers, decorators, and type annotations.
                    return visitGetAccessor(node);
                case ts.SyntaxKind.SetAccessor:
                    // Set Accessors can have TypeScript modifiers and type annotations.
                    return visitSetAccessor(node);
                case ts.SyntaxKind.FunctionDeclaration:
                    // Typescript function declarations can have modifiers, decorators, and type annotations.
                    return visitFunctionDeclaration(node);
                case ts.SyntaxKind.FunctionExpression:
                    // TypeScript function expressions can have modifiers and type annotations.
                    return visitFunctionExpression(node);
                case ts.SyntaxKind.ArrowFunction:
                    // TypeScript arrow functions can have modifiers and type annotations.
                    return visitArrowFunction(node);
                case ts.SyntaxKind.Parameter:
                    // This is a parameter declaration with TypeScript syntax extensions.
                    //
                    // TypeScript parameter declaration syntax extensions include:
                    // - decorators
                    // - accessibility modifiers
                    // - the question mark (?) token for optional parameters
                    // - type annotations
                    // - this parameters
                    return visitParameter(node);
                case ts.SyntaxKind.ParenthesizedExpression:
                    // ParenthesizedExpressions are TypeScript if their expression is a
                    // TypeAssertion or AsExpression
                    return visitParenthesizedExpression(node);
                case ts.SyntaxKind.TypeAssertionExpression:
                case ts.SyntaxKind.AsExpression:
                    // TypeScript type assertions are removed, but their subtrees are preserved.
                    return visitAssertionExpression(node);
                case ts.SyntaxKind.CallExpression:
                    return visitCallExpression(node);
                case ts.SyntaxKind.NewExpression:
                    return visitNewExpression(node);
                case ts.SyntaxKind.TaggedTemplateExpression:
                    return visitTaggedTemplateExpression(node);
                case ts.SyntaxKind.NonNullExpression:
                    // TypeScript non-null expressions are removed, but their subtrees are preserved.
                    return visitNonNullExpression(node);
                case ts.SyntaxKind.EnumDeclaration:
                    // TypeScript enum declarations do not exist in ES6 and must be rewritten.
                    return visitEnumDeclaration(node);
                case ts.SyntaxKind.VariableStatement:
                    // TypeScript namespace exports for variable statements must be transformed.
                    return visitVariableStatement(node);
                case ts.SyntaxKind.VariableDeclaration:
                    return visitVariableDeclaration(node);
                case ts.SyntaxKind.ModuleDeclaration:
                    // TypeScript namespace declarations must be transformed.
                    return visitModuleDeclaration(node);
                case ts.SyntaxKind.ImportEqualsDeclaration:
                    // TypeScript namespace or external module import.
                    return visitImportEqualsDeclaration(node);
                default:
                    return ts.Debug.failBadSyntaxKind(node);
            }
        }
        function visitSourceFile(node) {
            const alwaysStrict = ts.getStrictOptionValue(compilerOptions, "alwaysStrict") &&
                !(ts.isExternalModule(node) && moduleKind >= ts.ModuleKind.ES2015);
            return ts.updateSourceFileNode(node, ts.visitLexicalEnvironment(node.statements, sourceElementVisitor, context, /*start*/ 0, alwaysStrict));
        }
        /**
         * Tests whether we should emit a __decorate call for a class declaration.
         */
        function shouldEmitDecorateCallForClass(node) {
            if (node.decorators && node.decorators.length > 0) {
                return true;
            }
            const constructor = ts.getFirstConstructorWithBody(node);
            if (constructor) {
                return ts.forEach(constructor.parameters, shouldEmitDecorateCallForParameter);
            }
            return false;
        }
        /**
         * Tests whether we should emit a __decorate call for a parameter declaration.
         */
        function shouldEmitDecorateCallForParameter(parameter) {
            return parameter.decorators !== undefined && parameter.decorators.length > 0;
        }
        function getClassFacts(node, staticProperties) {
            let facts = 0 /* None */;
            if (ts.some(staticProperties))
                facts |= 1 /* HasStaticInitializedProperties */;
            const extendsClauseElement = ts.getClassExtendsHeritageClauseElement(node);
            if (extendsClauseElement && ts.skipOuterExpressions(extendsClauseElement.expression).kind !== ts.SyntaxKind.NullKeyword)
                facts |= 64 /* IsDerivedClass */;
            if (shouldEmitDecorateCallForClass(node))
                facts |= 2 /* HasConstructorDecorators */;
            if (ts.childIsDecorated(node))
                facts |= 4 /* HasMemberDecorators */;
            if (isExportOfNamespace(node))
                facts |= 8 /* IsExportOfNamespace */;
            else if (isDefaultExternalModuleExport(node))
                facts |= 32 /* IsDefaultExternalExport */;
            else if (isNamedExternalModuleExport(node))
                facts |= 16 /* IsNamedExternalExport */;
            if (languageVersion <= ts.ScriptTarget.ES5 && (facts & 7 /* MayNeedImmediatelyInvokedFunctionExpression */))
                facts |= 128 /* UseImmediatelyInvokedFunctionExpression */;
            return facts;
        }
        /**
         * Transforms a class declaration with TypeScript syntax into compatible ES6.
         *
         * This function will only be called when one of the following conditions are met:
         * - The class has decorators.
         * - The class has property declarations with initializers.
         * - The class contains a constructor that contains parameters with accessibility modifiers.
         * - The class is an export in a TypeScript namespace.
         *
         * @param node The node to transform.
         */
        function visitClassDeclaration(node) {
            const savedPendingExpressions = pendingExpressions;
            pendingExpressions = undefined;
            const staticProperties = getInitializedProperties(node, /*isStatic*/ true);
            const facts = getClassFacts(node, staticProperties);
            if (facts & 128 /* UseImmediatelyInvokedFunctionExpression */) {
                context.startLexicalEnvironment();
            }
            const name = node.name || (facts & 5 /* NeedsName */ ? ts.getGeneratedNameForNode(node) : undefined);
            const classStatement = facts & 2 /* HasConstructorDecorators */
                ? createClassDeclarationHeadWithDecorators(node, name, facts)
                : createClassDeclarationHeadWithoutDecorators(node, name, facts);
            let statements = [classStatement];
            // Write any pending expressions from elided or moved computed property names
            if (ts.some(pendingExpressions)) {
                statements.push(ts.createStatement(ts.inlineExpressions(pendingExpressions)));
            }
            pendingExpressions = savedPendingExpressions;
            // Emit static property assignment. Because classDeclaration is lexically evaluated,
            // it is safe to emit static property assignment after classDeclaration
            // From ES6 specification:
            //      HasLexicalDeclaration (N) : Determines if the argument identifier has a binding in this environment record that was created using
            //                                  a lexical declaration such as a LexicalDeclaration or a ClassDeclaration.
            if (facts & 1 /* HasStaticInitializedProperties */) {
                addInitializedPropertyStatements(statements, staticProperties, facts & 128 /* UseImmediatelyInvokedFunctionExpression */ ? ts.getInternalName(node) : ts.getLocalName(node));
            }
            // Write any decorators of the node.
            addClassElementDecorationStatements(statements, node, /*isStatic*/ false);
            addClassElementDecorationStatements(statements, node, /*isStatic*/ true);
            addConstructorDecorationStatement(statements, node);
            if (facts & 128 /* UseImmediatelyInvokedFunctionExpression */) {
                // When we emit a TypeScript class down to ES5, we must wrap it in an IIFE so that the
                // 'es2015' transformer can properly nest static initializers and decorators. The result
                // looks something like:
                //
                //  var C = function () {
                //      class C {
                //      }
                //      C.static_prop = 1;
                //      return C;
                //  }();
                //
                const closingBraceLocation = ts.createTokenRange(ts.skipTrivia(currentSourceFile.text, node.members.end), ts.SyntaxKind.CloseBraceToken);
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
                ts.addRange(statements, context.endLexicalEnvironment());
                const iife = ts.createImmediatelyInvokedArrowFunction(statements);
                ts.setEmitFlags(iife, ts.EmitFlags.TypeScriptClassWrapper);
                const varStatement = ts.createVariableStatement(
                /*modifiers*/ undefined, ts.createVariableDeclarationList([
                    ts.createVariableDeclaration(ts.getLocalName(node, /*allowComments*/ false, /*allowSourceMaps*/ false), 
                    /*type*/ undefined, iife)
                ]));
                ts.setOriginalNode(varStatement, node);
                ts.setCommentRange(varStatement, node);
                ts.setSourceMapRange(varStatement, ts.moveRangePastDecorators(node));
                ts.startOnNewLine(varStatement);
                statements = [varStatement];
            }
            // If the class is exported as part of a TypeScript namespace, emit the namespace export.
            // Otherwise, if the class was exported at the top level and was decorated, emit an export
            // declaration or export default for the class.
            if (facts & 8 /* IsExportOfNamespace */) {
                addExportMemberAssignment(statements, node);
            }
            else if (facts & 128 /* UseImmediatelyInvokedFunctionExpression */ || facts & 2 /* HasConstructorDecorators */) {
                if (facts & 32 /* IsDefaultExternalExport */) {
                    statements.push(ts.createExportDefault(ts.getLocalName(node, /*allowComments*/ false, /*allowSourceMaps*/ true)));
                }
                else if (facts & 16 /* IsNamedExternalExport */) {
                    statements.push(ts.createExternalModuleExport(ts.getLocalName(node, /*allowComments*/ false, /*allowSourceMaps*/ true)));
                }
            }
            if (statements.length > 1) {
                // Add a DeclarationMarker as a marker for the end of the declaration
                statements.push(ts.createEndOfDeclarationMarker(node));
                ts.setEmitFlags(classStatement, ts.getEmitFlags(classStatement) | ts.EmitFlags.HasEndOfDeclarationMarker);
            }
            return ts.singleOrMany(statements);
        }
        /**
         * Transforms a non-decorated class declaration and appends the resulting statements.
         *
         * @param node A ClassDeclaration node.
         * @param name The name of the class.
         * @param facts Precomputed facts about the class.
         */
        function createClassDeclarationHeadWithoutDecorators(node, name, facts) {
            //  ${modifiers} class ${name} ${heritageClauses} {
            //      ${members}
            //  }
            // we do not emit modifiers on the declaration if we are emitting an IIFE
            const modifiers = !(facts & 128 /* UseImmediatelyInvokedFunctionExpression */)
                ? ts.visitNodes(node.modifiers, modifierVisitor, ts.isModifier)
                : undefined;
            const classDeclaration = ts.createClassDeclaration(
            /*decorators*/ undefined, modifiers, name, 
            /*typeParameters*/ undefined, ts.visitNodes(node.heritageClauses, visitor, ts.isHeritageClause), transformClassMembers(node, (facts & 64 /* IsDerivedClass */) !== 0));
            // To better align with the old emitter, we should not emit a trailing source map
            // entry if the class has static properties.
            let emitFlags = ts.getEmitFlags(node);
            if (facts & 1 /* HasStaticInitializedProperties */) {
                emitFlags |= ts.EmitFlags.NoTrailingSourceMap;
            }
            ts.setTextRange(classDeclaration, node);
            ts.setOriginalNode(classDeclaration, node);
            ts.setEmitFlags(classDeclaration, emitFlags);
            return classDeclaration;
        }
        /**
         * Transforms a decorated class declaration and appends the resulting statements. If
         * the class requires an alias to avoid issues with double-binding, the alias is returned.
         */
        function createClassDeclarationHeadWithDecorators(node, name, facts) {
            // When we emit an ES6 class that has a class decorator, we must tailor the
            // emit to certain specific cases.
            //
            // In the simplest case, we emit the class declaration as a let declaration, and
            // evaluate decorators after the close of the class body:
            //
            //  [Example 1]
            //  ---------------------------------------------------------------------
            //  TypeScript                      | Javascript
            //  ---------------------------------------------------------------------
            //  @dec                            | let C = class C {
            //  class C {                       | }
            //  }                               | C = __decorate([dec], C);
            //  ---------------------------------------------------------------------
            //  @dec                            | let C = class C {
            //  export class C {                | }
            //  }                               | C = __decorate([dec], C);
            //                                  | export { C };
            //  ---------------------------------------------------------------------
            //
            // If a class declaration contains a reference to itself *inside* of the class body,
            // this introduces two bindings to the class: One outside of the class body, and one
            // inside of the class body. If we apply decorators as in [Example 1] above, there
            // is the possibility that the decorator `dec` will return a new value for the
            // constructor, which would result in the binding inside of the class no longer
            // pointing to the same reference as the binding outside of the class.
            //
            // As a result, we must instead rewrite all references to the class *inside* of the
            // class body to instead point to a local temporary alias for the class:
            //
            //  [Example 2]
            //  ---------------------------------------------------------------------
            //  TypeScript                      | Javascript
            //  ---------------------------------------------------------------------
            //  @dec                            | let C = C_1 = class C {
            //  class C {                       |   static x() { return C_1.y; }
            //    static x() { return C.y; }    | }
            //    static y = 1;                 | C.y = 1;
            //  }                               | C = C_1 = __decorate([dec], C);
            //                                  | var C_1;
            //  ---------------------------------------------------------------------
            //  @dec                            | let C = class C {
            //  export class C {                |   static x() { return C_1.y; }
            //    static x() { return C.y; }    | }
            //    static y = 1;                 | C.y = 1;
            //  }                               | C = C_1 = __decorate([dec], C);
            //                                  | export { C };
            //                                  | var C_1;
            //  ---------------------------------------------------------------------
            //
            // If a class declaration is the default export of a module, we instead emit
            // the export after the decorated declaration:
            //
            //  [Example 3]
            //  ---------------------------------------------------------------------
            //  TypeScript                      | Javascript
            //  ---------------------------------------------------------------------
            //  @dec                            | let default_1 = class {
            //  export default class {          | }
            //  }                               | default_1 = __decorate([dec], default_1);
            //                                  | export default default_1;
            //  ---------------------------------------------------------------------
            //  @dec                            | let C = class C {
            //  export default class C {        | }
            //  }                               | C = __decorate([dec], C);
            //                                  | export default C;
            //  ---------------------------------------------------------------------
            //
            // If the class declaration is the default export and a reference to itself
            // inside of the class body, we must emit both an alias for the class *and*
            // move the export after the declaration:
            //
            //  [Example 4]
            //  ---------------------------------------------------------------------
            //  TypeScript                      | Javascript
            //  ---------------------------------------------------------------------
            //  @dec                            | let C = class C {
            //  export default class C {        |   static x() { return C_1.y; }
            //    static x() { return C.y; }    | }
            //    static y = 1;                 | C.y = 1;
            //  }                               | C = C_1 = __decorate([dec], C);
            //                                  | export default C;
            //                                  | var C_1;
            //  ---------------------------------------------------------------------
            //
            const location = ts.moveRangePastDecorators(node);
            const classAlias = getClassAliasIfNeeded(node);
            const declName = ts.getLocalName(node, /*allowComments*/ false, /*allowSourceMaps*/ true);
            //  ... = class ${name} ${heritageClauses} {
            //      ${members}
            //  }
            const heritageClauses = ts.visitNodes(node.heritageClauses, visitor, ts.isHeritageClause);
            const members = transformClassMembers(node, (facts & 64 /* IsDerivedClass */) !== 0);
            const classExpression = ts.createClassExpression(/*modifiers*/ undefined, name, /*typeParameters*/ undefined, heritageClauses, members);
            ts.setOriginalNode(classExpression, node);
            ts.setTextRange(classExpression, location);
            //  let ${name} = ${classExpression} where name is either declaredName if the class doesn't contain self-reference
            //                                         or decoratedClassAlias if the class contain self-reference.
            const statement = ts.createVariableStatement(
            /*modifiers*/ undefined, ts.createVariableDeclarationList([
                ts.createVariableDeclaration(declName, 
                /*type*/ undefined, classAlias ? ts.createAssignment(classAlias, classExpression) : classExpression)
            ], ts.NodeFlags.Let));
            ts.setOriginalNode(statement, node);
            ts.setTextRange(statement, location);
            ts.setCommentRange(statement, node);
            return statement;
        }
        /**
         * Transforms a class expression with TypeScript syntax into compatible ES6.
         *
         * This function will only be called when one of the following conditions are met:
         * - The class has property declarations with initializers.
         * - The class contains a constructor that contains parameters with accessibility modifiers.
         *
         * @param node The node to transform.
         */
        function visitClassExpression(node) {
            const savedPendingExpressions = pendingExpressions;
            pendingExpressions = undefined;
            const staticProperties = getInitializedProperties(node, /*isStatic*/ true);
            const heritageClauses = ts.visitNodes(node.heritageClauses, visitor, ts.isHeritageClause);
            const members = transformClassMembers(node, ts.some(heritageClauses, c => c.token === ts.SyntaxKind.ExtendsKeyword));
            const classExpression = ts.createClassExpression(
            /*modifiers*/ undefined, node.name, 
            /*typeParameters*/ undefined, heritageClauses, members);
            ts.setOriginalNode(classExpression, node);
            ts.setTextRange(classExpression, node);
            if (ts.some(staticProperties) || ts.some(pendingExpressions)) {
                const expressions = [];
                const isClassWithConstructorReference = resolver.getNodeCheckFlags(node) & 8388608 /* ClassWithConstructorReference */;
                const temp = ts.createTempVariable(hoistVariableDeclaration, !!isClassWithConstructorReference);
                if (isClassWithConstructorReference) {
                    // record an alias as the class name is not in scope for statics.
                    enableSubstitutionForClassAliases();
                    const alias = ts.getSynthesizedClone(temp);
                    alias.autoGenerateFlags &= ~16 /* ReservedInNestedScopes */;
                    classAliases[ts.getOriginalNodeId(node)] = alias;
                }
                // To preserve the behavior of the old emitter, we explicitly indent
                // the body of a class with static initializers.
                ts.setEmitFlags(classExpression, ts.EmitFlags.Indented | ts.getEmitFlags(classExpression));
                expressions.push(ts.startOnNewLine(ts.createAssignment(temp, classExpression)));
                // Add any pending expressions leftover from elided or relocated computed property names
                ts.addRange(expressions, ts.map(pendingExpressions, ts.startOnNewLine));
                pendingExpressions = savedPendingExpressions;
                ts.addRange(expressions, generateInitializedPropertyExpressions(staticProperties, temp));
                expressions.push(ts.startOnNewLine(temp));
                return ts.inlineExpressions(expressions);
            }
            pendingExpressions = savedPendingExpressions;
            return classExpression;
        }
        /**
         * Transforms the members of a class.
         *
         * @param node The current class.
         * @param isDerivedClass A value indicating whether the class has an extends clause that does not extend 'null'.
         */
        function transformClassMembers(node, isDerivedClass) {
            const members = [];
            const constructor = transformConstructor(node, isDerivedClass);
            if (constructor) {
                members.push(constructor);
            }
            ts.addRange(members, ts.visitNodes(node.members, classElementVisitor, ts.isClassElement));
            return ts.setTextRange(ts.createNodeArray(members), /*location*/ node.members);
        }
        /**
         * Transforms (or creates) a constructor for a class.
         *
         * @param node The current class.
         * @param isDerivedClass A value indicating whether the class has an extends clause that does not extend 'null'.
         */
        function transformConstructor(node, isDerivedClass) {
            // Check if we have property assignment inside class declaration.
            // If there is a property assignment, we need to emit constructor whether users define it or not
            // If there is no property assignment, we can omit constructor if users do not define it
            const hasInstancePropertyWithInitializer = ts.forEach(node.members, isInstanceInitializedProperty);
            const hasParameterPropertyAssignments = node.transformFlags & 262144 /* ContainsParameterPropertyAssignments */;
            const constructor = ts.getFirstConstructorWithBody(node);
            // If the class does not contain nodes that require a synthesized constructor,
            // accept the current constructor if it exists.
            if (!hasInstancePropertyWithInitializer && !hasParameterPropertyAssignments) {
                return ts.visitEachChild(constructor, visitor, context);
            }
            const parameters = transformConstructorParameters(constructor);
            const body = transformConstructorBody(node, constructor, isDerivedClass);
            //  constructor(${parameters}) {
            //      ${body}
            //  }
            return ts.startOnNewLine(ts.setOriginalNode(ts.setTextRange(ts.createConstructor(
            /*decorators*/ undefined, 
            /*modifiers*/ undefined, parameters, body), constructor || node), constructor));
        }
        /**
         * Transforms (or creates) the parameters for the constructor of a class with
         * parameter property assignments or instance property initializers.
         *
         * @param constructor The constructor declaration.
         */
        function transformConstructorParameters(constructor) {
            // The ES2015 spec specifies in 14.5.14. Runtime Semantics: ClassDefinitionEvaluation:
            // If constructor is empty, then
            //     If ClassHeritag_eopt is present and protoParent is not null, then
            //          Let constructor be the result of parsing the source text
            //              constructor(...args) { super (...args);}
            //          using the syntactic grammar with the goal symbol MethodDefinition[~Yield].
            //      Else,
            //           Let constructor be the result of parsing the source text
            //               constructor( ){ }
            //           using the syntactic grammar with the goal symbol MethodDefinition[~Yield].
            //
            // While we could emit the '...args' rest parameter, certain later tools in the pipeline might
            // downlevel the '...args' portion less efficiently by naively copying the contents of 'arguments' to an array.
            // Instead, we'll avoid using a rest parameter and spread into the super call as
            // 'super(...arguments)' instead of 'super(...args)', as you can see in "transformConstructorBody".
            return ts.visitParameterList(constructor && constructor.parameters, visitor, context)
                || [];
        }
        /**
         * Transforms (or creates) a constructor body for a class with parameter property
         * assignments or instance property initializers.
         *
         * @param node The current class.
         * @param constructor The current class constructor.
         * @param isDerivedClass A value indicating whether the class has an extends clause that does not extend 'null'.
         */
        function transformConstructorBody(node, constructor, isDerivedClass) {
            let statements = [];
            let indexOfFirstStatement = 0;
            resumeLexicalEnvironment();
            if (constructor) {
                indexOfFirstStatement = addPrologueDirectivesAndInitialSuperCall(constructor, statements);
                // Add parameters with property assignments. Transforms this:
                //
                //  constructor (public x, public y) {
                //  }
                //
                // Into this:
                //
                //  constructor (x, y) {
                //      this.x = x;
                //      this.y = y;
                //  }
                //
                const propertyAssignments = getParametersWithPropertyAssignments(constructor);
                ts.addRange(statements, ts.map(propertyAssignments, transformParameterWithPropertyAssignment));
            }
            else if (isDerivedClass) {
                // Add a synthetic `super` call:
                //
                //  super(...arguments);
                //
                statements.push(ts.createStatement(ts.createCall(ts.createSuper(), 
                /*typeArguments*/ undefined, [ts.createSpread(ts.createIdentifier("arguments"))])));
            }
            // Add the property initializers. Transforms this:
            //
            //  public x = 1;
            //
            // Into this:
            //
            //  constructor() {
            //      this.x = 1;
            //  }
            //
            const properties = getInitializedProperties(node, /*isStatic*/ false);
            addInitializedPropertyStatements(statements, properties, ts.createThis());
            if (constructor) {
                // The class already had a constructor, so we should add the existing statements, skipping the initial super call.
                ts.addRange(statements, ts.visitNodes(constructor.body.statements, visitor, ts.isStatement, indexOfFirstStatement));
            }
            // End the lexical environment.
            statements = ts.mergeLexicalEnvironment(statements, endLexicalEnvironment());
            return ts.setTextRange(ts.createBlock(ts.setTextRange(ts.createNodeArray(statements), 
            /*location*/ constructor ? constructor.body.statements : node.members), 
            /*multiLine*/ true), 
            /*location*/ constructor ? constructor.body : undefined);
        }
        /**
         * Adds super call and preceding prologue directives into the list of statements.
         *
         * @param ctor The constructor node.
         * @returns index of the statement that follows super call
         */
        function addPrologueDirectivesAndInitialSuperCall(ctor, result) {
            if (ctor.body) {
                const statements = ctor.body.statements;
                // add prologue directives to the list (if any)
                const index = ts.addPrologue(result, statements, /*ensureUseStrict*/ false, visitor);
                if (index === statements.length) {
                    // list contains nothing but prologue directives (or empty) - exit
                    return index;
                }
                const statement = statements[index];
                if (statement.kind === ts.SyntaxKind.ExpressionStatement && ts.isSuperCall(statement.expression)) {
                    result.push(ts.visitNode(statement, visitor, ts.isStatement));
                    return index + 1;
                }
                return index;
            }
            return 0;
        }
        /**
         * Gets all parameters of a constructor that should be transformed into property assignments.
         *
         * @param node The constructor node.
         */
        function getParametersWithPropertyAssignments(node) {
            return ts.filter(node.parameters, isParameterWithPropertyAssignment);
        }
        /**
         * Determines whether a parameter should be transformed into a property assignment.
         *
         * @param parameter The parameter node.
         */
        function isParameterWithPropertyAssignment(parameter) {
            return ts.hasModifier(parameter, ts.ModifierFlags.ParameterPropertyModifier)
                && ts.isIdentifier(parameter.name);
        }
        /**
         * Transforms a parameter into a property assignment statement.
         *
         * @param node The parameter declaration.
         */
        function transformParameterWithPropertyAssignment(node) {
            ts.Debug.assert(ts.isIdentifier(node.name));
            const name = node.name;
            const propertyName = ts.getMutableClone(name);
            ts.setEmitFlags(propertyName, ts.EmitFlags.NoComments | ts.EmitFlags.NoSourceMap);
            const localName = ts.getMutableClone(name);
            ts.setEmitFlags(localName, ts.EmitFlags.NoComments);
            return ts.startOnNewLine(ts.setEmitFlags(ts.setTextRange(ts.createStatement(ts.createAssignment(ts.setTextRange(ts.createPropertyAccess(ts.createThis(), propertyName), node.name), localName)), ts.moveRangePos(node, -1)), ts.EmitFlags.NoComments));
        }
        /**
         * Gets all property declarations with initializers on either the static or instance side of a class.
         *
         * @param node The class node.
         * @param isStatic A value indicating whether to get properties from the static or instance side of the class.
         */
        function getInitializedProperties(node, isStatic) {
            return ts.filter(node.members, isStatic ? isStaticInitializedProperty : isInstanceInitializedProperty);
        }
        /**
         * Gets a value indicating whether a class element is a static property declaration with an initializer.
         *
         * @param member The class element node.
         */
        function isStaticInitializedProperty(member) {
            return isInitializedProperty(member, /*isStatic*/ true);
        }
        /**
         * Gets a value indicating whether a class element is an instance property declaration with an initializer.
         *
         * @param member The class element node.
         */
        function isInstanceInitializedProperty(member) {
            return isInitializedProperty(member, /*isStatic*/ false);
        }
        /**
         * Gets a value indicating whether a class element is either a static or an instance property declaration with an initializer.
         *
         * @param member The class element node.
         * @param isStatic A value indicating whether the member should be a static or instance member.
         */
        function isInitializedProperty(member, isStatic) {
            return member.kind === ts.SyntaxKind.PropertyDeclaration
                && isStatic === ts.hasModifier(member, ts.ModifierFlags.Static)
                && member.initializer !== undefined;
        }
        /**
         * Generates assignment statements for property initializers.
         *
         * @param properties An array of property declarations to transform.
         * @param receiver The receiver on which each property should be assigned.
         */
        function addInitializedPropertyStatements(statements, properties, receiver) {
            for (const property of properties) {
                const statement = ts.createStatement(transformInitializedProperty(property, receiver));
                ts.setSourceMapRange(statement, ts.moveRangePastModifiers(property));
                ts.setCommentRange(statement, property);
                statements.push(statement);
            }
        }
        /**
         * Generates assignment expressions for property initializers.
         *
         * @param properties An array of property declarations to transform.
         * @param receiver The receiver on which each property should be assigned.
         */
        function generateInitializedPropertyExpressions(properties, receiver) {
            const expressions = [];
            for (const property of properties) {
                const expression = transformInitializedProperty(property, receiver);
                ts.startOnNewLine(expression);
                ts.setSourceMapRange(expression, ts.moveRangePastModifiers(property));
                ts.setCommentRange(expression, property);
                expressions.push(expression);
            }
            return expressions;
        }
        /**
         * Transforms a property initializer into an assignment statement.
         *
         * @param property The property declaration.
         * @param receiver The object receiving the property assignment.
         */
        function transformInitializedProperty(property, receiver) {
            // We generate a name here in order to reuse the value cached by the relocated computed name expression (which uses the same generated name)
            const propertyName = ts.isComputedPropertyName(property.name) && !isSimpleInlineableExpression(property.name.expression)
                ? ts.updateComputedPropertyName(property.name, ts.getGeneratedNameForNode(property.name, !ts.hasModifier(property, ts.ModifierFlags.Static)))
                : property.name;
            const initializer = ts.visitNode(property.initializer, visitor, ts.isExpression);
            const memberAccess = ts.createMemberAccessForPropertyName(receiver, propertyName, /*location*/ propertyName);
            return ts.createAssignment(memberAccess, initializer);
        }
        /**
         * Gets either the static or instance members of a class that are decorated, or have
         * parameters that are decorated.
         *
         * @param node The class containing the member.
         * @param isStatic A value indicating whether to retrieve static or instance members of
         *                 the class.
         */
        function getDecoratedClassElements(node, isStatic) {
            return ts.filter(node.members, isStatic ? m => isStaticDecoratedClassElement(m, node) : m => isInstanceDecoratedClassElement(m, node));
        }
        /**
         * Determines whether a class member is a static member of a class that is decorated, or
         * has parameters that are decorated.
         *
         * @param member The class member.
         */
        function isStaticDecoratedClassElement(member, parent) {
            return isDecoratedClassElement(member, /*isStatic*/ true, parent);
        }
        /**
         * Determines whether a class member is an instance member of a class that is decorated,
         * or has parameters that are decorated.
         *
         * @param member The class member.
         */
        function isInstanceDecoratedClassElement(member, parent) {
            return isDecoratedClassElement(member, /*isStatic*/ false, parent);
        }
        /**
         * Determines whether a class member is either a static or an instance member of a class
         * that is decorated, or has parameters that are decorated.
         *
         * @param member The class member.
         */
        function isDecoratedClassElement(member, isStatic, parent) {
            return ts.nodeOrChildIsDecorated(member, parent)
                && isStatic === ts.hasModifier(member, ts.ModifierFlags.Static);
        }
        /**
         * Gets an array of arrays of decorators for the parameters of a function-like node.
         * The offset into the result array should correspond to the offset of the parameter.
         *
         * @param node The function-like node.
         */
        function getDecoratorsOfParameters(node) {
            let decorators;
            if (node) {
                const parameters = node.parameters;
                for (let i = 0; i < parameters.length; i++) {
                    const parameter = parameters[i];
                    if (decorators || parameter.decorators) {
                        if (!decorators) {
                            decorators = new Array(parameters.length);
                        }
                        decorators[i] = parameter.decorators;
                    }
                }
            }
            return decorators;
        }
        /**
         * Gets an AllDecorators object containing the decorators for the class and the decorators for the
         * parameters of the constructor of the class.
         *
         * @param node The class node.
         */
        function getAllDecoratorsOfConstructor(node) {
            const decorators = node.decorators;
            const parameters = getDecoratorsOfParameters(ts.getFirstConstructorWithBody(node));
            if (!decorators && !parameters) {
                return undefined;
            }
            return {
                decorators,
                parameters
            };
        }
        /**
         * Gets an AllDecorators object containing the decorators for the member and its parameters.
         *
         * @param node The class node that contains the member.
         * @param member The class member.
         */
        function getAllDecoratorsOfClassElement(node, member) {
            switch (member.kind) {
                case ts.SyntaxKind.GetAccessor:
                case ts.SyntaxKind.SetAccessor:
                    return getAllDecoratorsOfAccessors(node, member);
                case ts.SyntaxKind.MethodDeclaration:
                    return getAllDecoratorsOfMethod(member);
                case ts.SyntaxKind.PropertyDeclaration:
                    return getAllDecoratorsOfProperty(member);
                default:
                    return undefined;
            }
        }
        /**
         * Gets an AllDecorators object containing the decorators for the accessor and its parameters.
         *
         * @param node The class node that contains the accessor.
         * @param accessor The class accessor member.
         */
        function getAllDecoratorsOfAccessors(node, accessor) {
            if (!accessor.body) {
                return undefined;
            }
            const { firstAccessor, secondAccessor, setAccessor } = ts.getAllAccessorDeclarations(node.members, accessor);
            const firstAccessorWithDecorators = firstAccessor.decorators ? firstAccessor : secondAccessor && secondAccessor.decorators ? secondAccessor : undefined;
            if (!firstAccessorWithDecorators || accessor !== firstAccessorWithDecorators) {
                return undefined;
            }
            const decorators = firstAccessorWithDecorators.decorators;
            const parameters = getDecoratorsOfParameters(setAccessor);
            if (!decorators && !parameters) {
                return undefined;
            }
            return { decorators, parameters };
        }
        /**
         * Gets an AllDecorators object containing the decorators for the method and its parameters.
         *
         * @param method The class method member.
         */
        function getAllDecoratorsOfMethod(method) {
            if (!method.body) {
                return undefined;
            }
            const decorators = method.decorators;
            const parameters = getDecoratorsOfParameters(method);
            if (!decorators && !parameters) {
                return undefined;
            }
            return { decorators, parameters };
        }
        /**
         * Gets an AllDecorators object containing the decorators for the property.
         *
         * @param property The class property member.
         */
        function getAllDecoratorsOfProperty(property) {
            const decorators = property.decorators;
            if (!decorators) {
                return undefined;
            }
            return { decorators };
        }
        /**
         * Transforms all of the decorators for a declaration into an array of expressions.
         *
         * @param node The declaration node.
         * @param allDecorators An object containing all of the decorators for the declaration.
         */
        function transformAllDecoratorsOfDeclaration(node, container, allDecorators) {
            if (!allDecorators) {
                return undefined;
            }
            const decoratorExpressions = [];
            ts.addRange(decoratorExpressions, ts.map(allDecorators.decorators, transformDecorator));
            ts.addRange(decoratorExpressions, ts.flatMap(allDecorators.parameters, transformDecoratorsOfParameter));
            addTypeMetadata(node, container, decoratorExpressions);
            return decoratorExpressions;
        }
        /**
         * Generates statements used to apply decorators to either the static or instance members
         * of a class.
         *
         * @param node The class node.
         * @param isStatic A value indicating whether to generate statements for static or
         *                 instance members.
         */
        function addClassElementDecorationStatements(statements, node, isStatic) {
            ts.addRange(statements, ts.map(generateClassElementDecorationExpressions(node, isStatic), expressionToStatement));
        }
        /**
         * Generates expressions used to apply decorators to either the static or instance members
         * of a class.
         *
         * @param node The class node.
         * @param isStatic A value indicating whether to generate expressions for static or
         *                 instance members.
         */
        function generateClassElementDecorationExpressions(node, isStatic) {
            const members = getDecoratedClassElements(node, isStatic);
            let expressions;
            for (const member of members) {
                const expression = generateClassElementDecorationExpression(node, member);
                if (expression) {
                    if (!expressions) {
                        expressions = [expression];
                    }
                    else {
                        expressions.push(expression);
                    }
                }
            }
            return expressions;
        }
        /**
         * Generates an expression used to evaluate class element decorators at runtime.
         *
         * @param node The class node that contains the member.
         * @param member The class member.
         */
        function generateClassElementDecorationExpression(node, member) {
            const allDecorators = getAllDecoratorsOfClassElement(node, member);
            const decoratorExpressions = transformAllDecoratorsOfDeclaration(member, node, allDecorators);
            if (!decoratorExpressions) {
                return undefined;
            }
            // Emit the call to __decorate. Given the following:
            //
            //   class C {
            //     @dec method(@dec2 x) {}
            //     @dec get accessor() {}
            //     @dec prop;
            //   }
            //
            // The emit for a method is:
            //
            //   __decorate([
            //       dec,
            //       __param(0, dec2),
            //       __metadata("design:type", Function),
            //       __metadata("design:paramtypes", [Object]),
            //       __metadata("design:returntype", void 0)
            //   ], C.prototype, "method", null);
            //
            // The emit for an accessor is:
            //
            //   __decorate([
            //       dec
            //   ], C.prototype, "accessor", null);
            //
            // The emit for a property is:
            //
            //   __decorate([
            //       dec
            //   ], C.prototype, "prop");
            //
            const prefix = getClassMemberPrefix(node, member);
            const memberName = getExpressionForPropertyName(member, /*generateNameForComputedPropertyName*/ true);
            const descriptor = languageVersion > ts.ScriptTarget.ES3
                ? member.kind === ts.SyntaxKind.PropertyDeclaration
                    // We emit `void 0` here to indicate to `__decorate` that it can invoke `Object.defineProperty` directly, but that it
                    // should not invoke `Object.getOwnPropertyDescriptor`.
                    ? ts.createVoidZero()
                    // We emit `null` here to indicate to `__decorate` that it can invoke `Object.getOwnPropertyDescriptor` directly.
                    // We have this extra argument here so that we can inject an explicit property descriptor at a later date.
                    : ts.createNull()
                : undefined;
            const helper = createDecorateHelper(context, decoratorExpressions, prefix, memberName, descriptor, ts.moveRangePastDecorators(member));
            ts.setEmitFlags(helper, ts.EmitFlags.NoComments);
            return helper;
        }
        /**
         * Generates a __decorate helper call for a class constructor.
         *
         * @param node The class node.
         */
        function addConstructorDecorationStatement(statements, node) {
            const expression = generateConstructorDecorationExpression(node);
            if (expression) {
                statements.push(ts.setOriginalNode(ts.createStatement(expression), node));
            }
        }
        /**
         * Generates a __decorate helper call for a class constructor.
         *
         * @param node The class node.
         */
        function generateConstructorDecorationExpression(node) {
            const allDecorators = getAllDecoratorsOfConstructor(node);
            const decoratorExpressions = transformAllDecoratorsOfDeclaration(node, node, allDecorators);
            if (!decoratorExpressions) {
                return undefined;
            }
            const classAlias = classAliases && classAliases[ts.getOriginalNodeId(node)];
            const localName = ts.getLocalName(node, /*allowComments*/ false, /*allowSourceMaps*/ true);
            const decorate = createDecorateHelper(context, decoratorExpressions, localName);
            const expression = ts.createAssignment(localName, classAlias ? ts.createAssignment(classAlias, decorate) : decorate);
            ts.setEmitFlags(expression, ts.EmitFlags.NoComments);
            ts.setSourceMapRange(expression, ts.moveRangePastDecorators(node));
            return expression;
        }
        /**
         * Transforms a decorator into an expression.
         *
         * @param decorator The decorator node.
         */
        function transformDecorator(decorator) {
            return ts.visitNode(decorator.expression, visitor, ts.isExpression);
        }
        /**
         * Transforms the decorators of a parameter.
         *
         * @param decorators The decorators for the parameter at the provided offset.
         * @param parameterOffset The offset of the parameter.
         */
        function transformDecoratorsOfParameter(decorators, parameterOffset) {
            let expressions;
            if (decorators) {
                expressions = [];
                for (const decorator of decorators) {
                    const helper = createParamHelper(context, transformDecorator(decorator), parameterOffset, 
                    /*location*/ decorator.expression);
                    ts.setEmitFlags(helper, ts.EmitFlags.NoComments);
                    expressions.push(helper);
                }
            }
            return expressions;
        }
        /**
         * Adds optional type metadata for a declaration.
         *
         * @param node The declaration node.
         * @param decoratorExpressions The destination array to which to add new decorator expressions.
         */
        function addTypeMetadata(node, container, decoratorExpressions) {
            if (USE_NEW_TYPE_METADATA_FORMAT) {
                addNewTypeMetadata(node, container, decoratorExpressions);
            }
            else {
                addOldTypeMetadata(node, container, decoratorExpressions);
            }
        }
        function addOldTypeMetadata(node, container, decoratorExpressions) {
            if (compilerOptions.emitDecoratorMetadata) {
                if (shouldAddTypeMetadata(node)) {
                    decoratorExpressions.push(createMetadataHelper(context, "design:type", serializeTypeOfNode(node)));
                }
                if (shouldAddParamTypesMetadata(node)) {
                    decoratorExpressions.push(createMetadataHelper(context, "design:paramtypes", serializeParameterTypesOfNode(node, container)));
                }
                if (shouldAddReturnTypeMetadata(node)) {
                    decoratorExpressions.push(createMetadataHelper(context, "design:returntype", serializeReturnTypeOfNode(node)));
                }
            }
        }
        function addNewTypeMetadata(node, container, decoratorExpressions) {
            if (compilerOptions.emitDecoratorMetadata) {
                let properties;
                if (shouldAddTypeMetadata(node)) {
                    (properties || (properties = [])).push(ts.createPropertyAssignment("type", ts.createArrowFunction(/*modifiers*/ undefined, /*typeParameters*/ undefined, [], /*type*/ undefined, ts.createToken(ts.SyntaxKind.EqualsGreaterThanToken), serializeTypeOfNode(node))));
                }
                if (shouldAddParamTypesMetadata(node)) {
                    (properties || (properties = [])).push(ts.createPropertyAssignment("paramTypes", ts.createArrowFunction(/*modifiers*/ undefined, /*typeParameters*/ undefined, [], /*type*/ undefined, ts.createToken(ts.SyntaxKind.EqualsGreaterThanToken), serializeParameterTypesOfNode(node, container))));
                }
                if (shouldAddReturnTypeMetadata(node)) {
                    (properties || (properties = [])).push(ts.createPropertyAssignment("returnType", ts.createArrowFunction(/*modifiers*/ undefined, /*typeParameters*/ undefined, [], /*type*/ undefined, ts.createToken(ts.SyntaxKind.EqualsGreaterThanToken), serializeReturnTypeOfNode(node))));
                }
                if (properties) {
                    decoratorExpressions.push(createMetadataHelper(context, "design:typeinfo", ts.createObjectLiteral(properties, /*multiLine*/ true)));
                }
            }
        }
        /**
         * Determines whether to emit the "design:type" metadata based on the node's kind.
         * The caller should have already tested whether the node has decorators and whether the
         * emitDecoratorMetadata compiler option is set.
         *
         * @param node The node to test.
         */
        function shouldAddTypeMetadata(node) {
            const kind = node.kind;
            return kind === ts.SyntaxKind.MethodDeclaration
                || kind === ts.SyntaxKind.GetAccessor
                || kind === ts.SyntaxKind.SetAccessor
                || kind === ts.SyntaxKind.PropertyDeclaration;
        }
        /**
         * Determines whether to emit the "design:returntype" metadata based on the node's kind.
         * The caller should have already tested whether the node has decorators and whether the
         * emitDecoratorMetadata compiler option is set.
         *
         * @param node The node to test.
         */
        function shouldAddReturnTypeMetadata(node) {
            return node.kind === ts.SyntaxKind.MethodDeclaration;
        }
        /**
         * Determines whether to emit the "design:paramtypes" metadata based on the node's kind.
         * The caller should have already tested whether the node has decorators and whether the
         * emitDecoratorMetadata compiler option is set.
         *
         * @param node The node to test.
         */
        function shouldAddParamTypesMetadata(node) {
            switch (node.kind) {
                case ts.SyntaxKind.ClassDeclaration:
                case ts.SyntaxKind.ClassExpression:
                    return ts.getFirstConstructorWithBody(node) !== undefined;
                case ts.SyntaxKind.MethodDeclaration:
                case ts.SyntaxKind.GetAccessor:
                case ts.SyntaxKind.SetAccessor:
                    return true;
            }
            return false;
        }
        /**
         * Serializes the type of a node for use with decorator type metadata.
         *
         * @param node The node that should have its type serialized.
         */
        function serializeTypeOfNode(node) {
            switch (node.kind) {
                case ts.SyntaxKind.PropertyDeclaration:
                case ts.SyntaxKind.Parameter:
                case ts.SyntaxKind.GetAccessor:
                    return serializeTypeNode(node.type);
                case ts.SyntaxKind.SetAccessor:
                    return serializeTypeNode(ts.getSetAccessorTypeAnnotationNode(node));
                case ts.SyntaxKind.ClassDeclaration:
                case ts.SyntaxKind.ClassExpression:
                case ts.SyntaxKind.MethodDeclaration:
                    return ts.createIdentifier("Function");
                default:
                    return ts.createVoidZero();
            }
        }
        /**
         * Serializes the types of the parameters of a node for use with decorator type metadata.
         *
         * @param node The node that should have its parameter types serialized.
         */
        function serializeParameterTypesOfNode(node, container) {
            const valueDeclaration = ts.isClassLike(node)
                ? ts.getFirstConstructorWithBody(node)
                : ts.isFunctionLike(node) && ts.nodeIsPresent(node.body)
                    ? node
                    : undefined;
            const expressions = [];
            if (valueDeclaration) {
                const parameters = getParametersOfDecoratedDeclaration(valueDeclaration, container);
                const numParameters = parameters.length;
                for (let i = 0; i < numParameters; i++) {
                    const parameter = parameters[i];
                    if (i === 0 && ts.isIdentifier(parameter.name) && parameter.name.escapedText === "this") {
                        continue;
                    }
                    if (parameter.dotDotDotToken) {
                        expressions.push(serializeTypeNode(ts.getRestParameterElementType(parameter.type)));
                    }
                    else {
                        expressions.push(serializeTypeOfNode(parameter));
                    }
                }
            }
            return ts.createArrayLiteral(expressions);
        }
        function getParametersOfDecoratedDeclaration(node, container) {
            if (container && node.kind === ts.SyntaxKind.GetAccessor) {
                const { setAccessor } = ts.getAllAccessorDeclarations(container.members, node);
                if (setAccessor) {
                    return setAccessor.parameters;
                }
            }
            return node.parameters;
        }
        /**
         * Serializes the return type of a node for use with decorator type metadata.
         *
         * @param node The node that should have its return type serialized.
         */
        function serializeReturnTypeOfNode(node) {
            if (ts.isFunctionLike(node) && node.type) {
                return serializeTypeNode(node.type);
            }
            else if (ts.isAsyncFunction(node)) {
                return ts.createIdentifier("Promise");
            }
            return ts.createVoidZero();
        }
        /**
         * Serializes a type node for use with decorator type metadata.
         *
         * Types are serialized in the following fashion:
         * - Void types point to "undefined" (e.g. "void 0")
         * - Function and Constructor types point to the global "Function" constructor.
         * - Interface types with a call or construct signature types point to the global
         *   "Function" constructor.
         * - Array and Tuple types point to the global "Array" constructor.
         * - Type predicates and booleans point to the global "Boolean" constructor.
         * - String literal types and strings point to the global "String" constructor.
         * - Enum and number types point to the global "Number" constructor.
         * - Symbol types point to the global "Symbol" constructor.
         * - Type references to classes (or class-like variables) point to the constructor for the class.
         * - Anything else points to the global "Object" constructor.
         *
         * @param node The type node to serialize.
         */
        function serializeTypeNode(node) {
            if (node === undefined) {
                return ts.createIdentifier("Object");
            }
            switch (node.kind) {
                case ts.SyntaxKind.VoidKeyword:
                case ts.SyntaxKind.UndefinedKeyword:
                case ts.SyntaxKind.NullKeyword:
                case ts.SyntaxKind.NeverKeyword:
                    return ts.createVoidZero();
                case ts.SyntaxKind.ParenthesizedType:
                    return serializeTypeNode(node.type);
                case ts.SyntaxKind.FunctionType:
                case ts.SyntaxKind.ConstructorType:
                    return ts.createIdentifier("Function");
                case ts.SyntaxKind.ArrayType:
                case ts.SyntaxKind.TupleType:
                    return ts.createIdentifier("Array");
                case ts.SyntaxKind.TypePredicate:
                case ts.SyntaxKind.BooleanKeyword:
                    return ts.createIdentifier("Boolean");
                case ts.SyntaxKind.StringKeyword:
                    return ts.createIdentifier("String");
                case ts.SyntaxKind.ObjectKeyword:
                    return ts.createIdentifier("Object");
                case ts.SyntaxKind.LiteralType:
                    switch (node.literal.kind) {
                        case ts.SyntaxKind.StringLiteral:
                            return ts.createIdentifier("String");
                        case ts.SyntaxKind.NumericLiteral:
                            return ts.createIdentifier("Number");
                        case ts.SyntaxKind.TrueKeyword:
                        case ts.SyntaxKind.FalseKeyword:
                            return ts.createIdentifier("Boolean");
                        default:
                            return ts.Debug.failBadSyntaxKind(node.literal);
                    }
                case ts.SyntaxKind.NumberKeyword:
                    return ts.createIdentifier("Number");
                case ts.SyntaxKind.SymbolKeyword:
                    return languageVersion < ts.ScriptTarget.ES2015
                        ? getGlobalSymbolNameWithFallback()
                        : ts.createIdentifier("Symbol");
                case ts.SyntaxKind.TypeReference:
                    return serializeTypeReferenceNode(node);
                case ts.SyntaxKind.IntersectionType:
                case ts.SyntaxKind.UnionType:
                    return serializeUnionOrIntersectionType(node);
                case ts.SyntaxKind.TypeQuery:
                case ts.SyntaxKind.TypeOperator:
                case ts.SyntaxKind.IndexedAccessType:
                case ts.SyntaxKind.MappedType:
                case ts.SyntaxKind.TypeLiteral:
                case ts.SyntaxKind.AnyKeyword:
                case ts.SyntaxKind.ThisType:
                    break;
                default:
                    return ts.Debug.failBadSyntaxKind(node);
            }
            return ts.createIdentifier("Object");
        }
        function serializeUnionOrIntersectionType(node) {
            // Note when updating logic here also update getEntityNameForDecoratorMetadata
            // so that aliases can be marked as referenced
            let serializedUnion;
            for (let typeNode of node.types) {
                while (typeNode.kind === ts.SyntaxKind.ParenthesizedType) {
                    typeNode = typeNode.type; // Skip parens if need be
                }
                if (typeNode.kind === ts.SyntaxKind.NeverKeyword) {
                    continue; // Always elide `never` from the union/intersection if possible
                }
                if (!strictNullChecks && (typeNode.kind === ts.SyntaxKind.NullKeyword || typeNode.kind === ts.SyntaxKind.UndefinedKeyword)) {
                    continue; // Elide null and undefined from unions for metadata, just like what we did prior to the implementation of strict null checks
                }
                const serializedIndividual = serializeTypeNode(typeNode);
                if (ts.isIdentifier(serializedIndividual) && serializedIndividual.escapedText === "Object") {
                    // One of the individual is global object, return immediately
                    return serializedIndividual;
                }
                // If there exists union that is not void 0 expression, check if the the common type is identifier.
                // anything more complex and we will just default to Object
                else if (serializedUnion) {
                    // Different types
                    if (!ts.isIdentifier(serializedUnion) ||
                        !ts.isIdentifier(serializedIndividual) ||
                        serializedUnion.escapedText !== serializedIndividual.escapedText) {
                        return ts.createIdentifier("Object");
                    }
                }
                else {
                    // Initialize the union type
                    serializedUnion = serializedIndividual;
                }
            }
            // If we were able to find common type, use it
            return serializedUnion || ts.createVoidZero(); // Fallback is only hit if all union constituients are null/undefined/never
        }
        /**
         * Serializes a TypeReferenceNode to an appropriate JS constructor value for use with
         * decorator type metadata.
         *
         * @param node The type reference node.
         */
        function serializeTypeReferenceNode(node) {
            switch (resolver.getTypeReferenceSerializationKind(node.typeName, currentScope)) {
                case ts.TypeReferenceSerializationKind.Unknown:
                    const serialized = serializeEntityNameAsExpression(node.typeName, /*useFallback*/ true);
                    const temp = ts.createTempVariable(hoistVariableDeclaration);
                    return ts.createLogicalOr(ts.createLogicalAnd(ts.createTypeCheck(ts.createAssignment(temp, serialized), "function"), temp), ts.createIdentifier("Object"));
                case ts.TypeReferenceSerializationKind.TypeWithConstructSignatureAndValue:
                    return serializeEntityNameAsExpression(node.typeName, /*useFallback*/ false);
                case ts.TypeReferenceSerializationKind.VoidNullableOrNeverType:
                    return ts.createVoidZero();
                case ts.TypeReferenceSerializationKind.BooleanType:
                    return ts.createIdentifier("Boolean");
                case ts.TypeReferenceSerializationKind.NumberLikeType:
                    return ts.createIdentifier("Number");
                case ts.TypeReferenceSerializationKind.StringLikeType:
                    return ts.createIdentifier("String");
                case ts.TypeReferenceSerializationKind.ArrayLikeType:
                    return ts.createIdentifier("Array");
                case ts.TypeReferenceSerializationKind.ESSymbolType:
                    return languageVersion < ts.ScriptTarget.ES2015
                        ? getGlobalSymbolNameWithFallback()
                        : ts.createIdentifier("Symbol");
                case ts.TypeReferenceSerializationKind.TypeWithCallSignature:
                    return ts.createIdentifier("Function");
                case ts.TypeReferenceSerializationKind.Promise:
                    return ts.createIdentifier("Promise");
                case ts.TypeReferenceSerializationKind.ObjectType:
                default:
                    return ts.createIdentifier("Object");
            }
        }
        /**
         * Serializes an entity name as an expression for decorator type metadata.
         *
         * @param node The entity name to serialize.
         * @param useFallback A value indicating whether to use logical operators to test for the
         *                    entity name at runtime.
         */
        function serializeEntityNameAsExpression(node, useFallback) {
            switch (node.kind) {
                case ts.SyntaxKind.Identifier:
                    // Create a clone of the name with a new parent, and treat it as if it were
                    // a source tree node for the purposes of the checker.
                    const name = ts.getMutableClone(node);
                    name.flags &= ~ts.NodeFlags.Synthesized;
                    name.original = undefined;
                    name.parent = ts.getParseTreeNode(currentScope); // ensure the parent is set to a parse tree node.
                    if (useFallback) {
                        return ts.createLogicalAnd(ts.createStrictInequality(ts.createTypeOf(name), ts.createLiteral("undefined")), name);
                    }
                    return name;
                case ts.SyntaxKind.QualifiedName:
                    return serializeQualifiedNameAsExpression(node, useFallback);
            }
        }
        /**
         * Serializes an qualified name as an expression for decorator type metadata.
         *
         * @param node The qualified name to serialize.
         * @param useFallback A value indicating whether to use logical operators to test for the
         *                    qualified name at runtime.
         */
        function serializeQualifiedNameAsExpression(node, useFallback) {
            let left;
            if (node.left.kind === ts.SyntaxKind.Identifier) {
                left = serializeEntityNameAsExpression(node.left, useFallback);
            }
            else if (useFallback) {
                const temp = ts.createTempVariable(hoistVariableDeclaration);
                left = ts.createLogicalAnd(ts.createAssignment(temp, serializeEntityNameAsExpression(node.left, /*useFallback*/ true)), temp);
            }
            else {
                left = serializeEntityNameAsExpression(node.left, /*useFallback*/ false);
            }
            return ts.createPropertyAccess(left, node.right);
        }
        /**
         * Gets an expression that points to the global "Symbol" constructor at runtime if it is
         * available.
         */
        function getGlobalSymbolNameWithFallback() {
            return ts.createConditional(ts.createTypeCheck(ts.createIdentifier("Symbol"), "function"), ts.createIdentifier("Symbol"), ts.createIdentifier("Object"));
        }
        /**
         * A simple inlinable expression is an expression which can be copied into multiple locations
         * without risk of repeating any sideeffects and whose value could not possibly change between
         * any such locations
         */
        function isSimpleInlineableExpression(expression) {
            return !ts.isIdentifier(expression) && ts.isSimpleCopiableExpression(expression) ||
                ts.isWellKnownSymbolSyntactically(expression);
        }
        /**
         * Gets an expression that represents a property name. For a computed property, a
         * name is generated for the node.
         *
         * @param member The member whose name should be converted into an expression.
         */
        function getExpressionForPropertyName(member, generateNameForComputedPropertyName) {
            const name = member.name;
            if (ts.isComputedPropertyName(name)) {
                return generateNameForComputedPropertyName && !isSimpleInlineableExpression(name.expression)
                    ? ts.getGeneratedNameForNode(name)
                    : name.expression;
            }
            else if (ts.isIdentifier(name)) {
                return ts.createLiteral(ts.idText(name));
            }
            else {
                return ts.getSynthesizedClone(name);
            }
        }
        /**
         * If the name is a computed property, this function transforms it, then either returns an expression which caches the
         * value of the result or the expression itself if the value is either unused or safe to inline into multiple locations
         * @param shouldHoist Does the expression need to be reused? (ie, for an initializer or a decorator)
         * @param omitSimple Should expressions with no observable side-effects be elided? (ie, the expression is not hoisted for a decorator or initializer and is a literal)
         */
        function getPropertyNameExpressionIfNeeded(name, shouldHoist, omitSimple) {
            if (ts.isComputedPropertyName(name)) {
                const expression = ts.visitNode(name.expression, visitor, ts.isExpression);
                const innerExpression = ts.skipPartiallyEmittedExpressions(expression);
                const inlinable = isSimpleInlineableExpression(innerExpression);
                if (!inlinable && shouldHoist) {
                    const generatedName = ts.getGeneratedNameForNode(name);
                    hoistVariableDeclaration(generatedName);
                    return ts.createAssignment(generatedName, expression);
                }
                return (omitSimple && (inlinable || ts.isIdentifier(innerExpression))) ? undefined : expression;
            }
        }
        /**
         * Visits the property name of a class element, for use when emitting property
         * initializers. For a computed property on a node with decorators, a temporary
         * value is stored for later use.
         *
         * @param member The member whose name should be visited.
         */
        function visitPropertyNameOfClassElement(member) {
            const name = member.name;
            let expr = getPropertyNameExpressionIfNeeded(name, ts.some(member.decorators), /*omitSimple*/ false);
            if (expr) { // expr only exists if `name` is a computed property name
                // Inline any pending expressions from previous elided or relocated computed property name expressions in order to preserve execution order
                if (ts.some(pendingExpressions)) {
                    expr = ts.inlineExpressions([...pendingExpressions, expr]);
                    pendingExpressions.length = 0;
                }
                return ts.updateComputedPropertyName(name, expr);
            }
            else {
                return name;
            }
        }
        /**
         * Transforms a HeritageClause with TypeScript syntax.
         *
         * This function will only be called when one of the following conditions are met:
         * - The node is a non-`extends` heritage clause that should be elided.
         * - The node is an `extends` heritage clause that should be visited, but only allow a single type.
         *
         * @param node The HeritageClause to transform.
         */
        function visitHeritageClause(node) {
            if (node.token === ts.SyntaxKind.ExtendsKeyword) {
                const types = ts.visitNodes(node.types, visitor, ts.isExpressionWithTypeArguments, 0, 1);
                return ts.setTextRange(ts.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, types), node);
            }
            return undefined;
        }
        /**
         * Transforms an ExpressionWithTypeArguments with TypeScript syntax.
         *
         * This function will only be called when one of the following conditions are met:
         * - The node contains type arguments that should be elided.
         *
         * @param node The ExpressionWithTypeArguments to transform.
         */
        function visitExpressionWithTypeArguments(node) {
            return ts.updateExpressionWithTypeArguments(node, 
            /*typeArguments*/ undefined, ts.visitNode(node.expression, visitor, ts.isLeftHandSideExpression));
        }
        /**
         * Determines whether to emit a function-like declaration. We should not emit the
         * declaration if it does not have a body.
         *
         * @param node The declaration node.
         */
        function shouldEmitFunctionLikeDeclaration(node) {
            return !ts.nodeIsMissing(node.body);
        }
        function visitPropertyDeclaration(node) {
            const expr = getPropertyNameExpressionIfNeeded(node.name, ts.some(node.decorators) || !!node.initializer, /*omitSimple*/ true);
            if (expr && !isSimpleInlineableExpression(expr)) {
                (pendingExpressions || (pendingExpressions = [])).push(expr);
            }
            return undefined;
        }
        function visitConstructor(node) {
            if (!shouldEmitFunctionLikeDeclaration(node)) {
                return undefined;
            }
            return ts.updateConstructor(node, ts.visitNodes(node.decorators, visitor, ts.isDecorator), ts.visitNodes(node.modifiers, visitor, ts.isModifier), ts.visitParameterList(node.parameters, visitor, context), ts.visitFunctionBody(node.body, visitor, context));
        }
        /**
         * Visits a method declaration of a class.
         *
         * This function will be called when one of the following conditions are met:
         * - The node is an overload
         * - The node is marked as abstract, public, private, protected, or readonly
         * - The node has a computed property name
         *
         * @param node The method node.
         */
        function visitMethodDeclaration(node) {
            if (!shouldEmitFunctionLikeDeclaration(node)) {
                return undefined;
            }
            const updated = ts.updateMethod(node, 
            /*decorators*/ undefined, ts.visitNodes(node.modifiers, modifierVisitor, ts.isModifier), node.asteriskToken, visitPropertyNameOfClassElement(node), 
            /*questionToken*/ undefined, 
            /*typeParameters*/ undefined, ts.visitParameterList(node.parameters, visitor, context), 
            /*type*/ undefined, ts.visitFunctionBody(node.body, visitor, context));
            if (updated !== node) {
                // While we emit the source map for the node after skipping decorators and modifiers,
                // we need to emit the comments for the original range.
                ts.setCommentRange(updated, node);
                ts.setSourceMapRange(updated, ts.moveRangePastDecorators(node));
            }
            return updated;
        }
        /**
         * Determines whether to emit an accessor declaration. We should not emit the
         * declaration if it does not have a body and is abstract.
         *
         * @param node The declaration node.
         */
        function shouldEmitAccessorDeclaration(node) {
            return !(ts.nodeIsMissing(node.body) && ts.hasModifier(node, ts.ModifierFlags.Abstract));
        }
        /**
         * Visits a get accessor declaration of a class.
         *
         * This function will be called when one of the following conditions are met:
         * - The node is marked as abstract, public, private, or protected
         * - The node has a computed property name
         *
         * @param node The get accessor node.
         */
        function visitGetAccessor(node) {
            if (!shouldEmitAccessorDeclaration(node)) {
                return undefined;
            }
            const updated = ts.updateGetAccessor(node, 
            /*decorators*/ undefined, ts.visitNodes(node.modifiers, modifierVisitor, ts.isModifier), visitPropertyNameOfClassElement(node), ts.visitParameterList(node.parameters, visitor, context), 
            /*type*/ undefined, ts.visitFunctionBody(node.body, visitor, context) || ts.createBlock([]));
            if (updated !== node) {
                // While we emit the source map for the node after skipping decorators and modifiers,
                // we need to emit the comments for the original range.
                ts.setCommentRange(updated, node);
                ts.setSourceMapRange(updated, ts.moveRangePastDecorators(node));
            }
            return updated;
        }
        /**
         * Visits a set accessor declaration of a class.
         *
         * This function will be called when one of the following conditions are met:
         * - The node is marked as abstract, public, private, or protected
         * - The node has a computed property name
         *
         * @param node The set accessor node.
         */
        function visitSetAccessor(node) {
            if (!shouldEmitAccessorDeclaration(node)) {
                return undefined;
            }
            const updated = ts.updateSetAccessor(node, 
            /*decorators*/ undefined, ts.visitNodes(node.modifiers, modifierVisitor, ts.isModifier), visitPropertyNameOfClassElement(node), ts.visitParameterList(node.parameters, visitor, context), ts.visitFunctionBody(node.body, visitor, context) || ts.createBlock([]));
            if (updated !== node) {
                // While we emit the source map for the node after skipping decorators and modifiers,
                // we need to emit the comments for the original range.
                ts.setCommentRange(updated, node);
                ts.setSourceMapRange(updated, ts.moveRangePastDecorators(node));
            }
            return updated;
        }
        /**
         * Visits a function declaration.
         *
         * This function will be called when one of the following conditions are met:
         * - The node is an overload
         * - The node is exported from a TypeScript namespace
         * - The node has decorators
         *
         * @param node The function node.
         */
        function visitFunctionDeclaration(node) {
            if (!shouldEmitFunctionLikeDeclaration(node)) {
                return ts.createNotEmittedStatement(node);
            }
            const updated = ts.updateFunctionDeclaration(node, 
            /*decorators*/ undefined, ts.visitNodes(node.modifiers, modifierVisitor, ts.isModifier), node.asteriskToken, node.name, 
            /*typeParameters*/ undefined, ts.visitParameterList(node.parameters, visitor, context), 
            /*type*/ undefined, ts.visitFunctionBody(node.body, visitor, context) || ts.createBlock([]));
            if (isExportOfNamespace(node)) {
                const statements = [updated];
                addExportMemberAssignment(statements, node);
                return statements;
            }
            return updated;
        }
        /**
         * Visits a function expression node.
         *
         * This function will be called when one of the following conditions are met:
         * - The node has type annotations
         *
         * @param node The function expression node.
         */
        function visitFunctionExpression(node) {
            if (!shouldEmitFunctionLikeDeclaration(node)) {
                return ts.createOmittedExpression();
            }
            const updated = ts.updateFunctionExpression(node, ts.visitNodes(node.modifiers, modifierVisitor, ts.isModifier), node.asteriskToken, node.name, 
            /*typeParameters*/ undefined, ts.visitParameterList(node.parameters, visitor, context), 
            /*type*/ undefined, ts.visitFunctionBody(node.body, visitor, context) || ts.createBlock([]));
            return updated;
        }
        /**
         * @remarks
         * This function will be called when one of the following conditions are met:
         * - The node has type annotations
         */
        function visitArrowFunction(node) {
            const updated = ts.updateArrowFunction(node, ts.visitNodes(node.modifiers, modifierVisitor, ts.isModifier), 
            /*typeParameters*/ undefined, ts.visitParameterList(node.parameters, visitor, context), 
            /*type*/ undefined, node.equalsGreaterThanToken, ts.visitFunctionBody(node.body, visitor, context));
            return updated;
        }
        /**
         * Visits a parameter declaration node.
         *
         * This function will be called when one of the following conditions are met:
         * - The node has an accessibility modifier.
         * - The node has a questionToken.
         * - The node's kind is ThisKeyword.
         *
         * @param node The parameter declaration node.
         */
        function visitParameter(node) {
            if (ts.parameterIsThisKeyword(node)) {
                return undefined;
            }
            const parameter = ts.createParameter(
            /*decorators*/ undefined, 
            /*modifiers*/ undefined, node.dotDotDotToken, ts.visitNode(node.name, visitor, ts.isBindingName), 
            /*questionToken*/ undefined, 
            /*type*/ undefined, ts.visitNode(node.initializer, visitor, ts.isExpression));
            // While we emit the source map for the node after skipping decorators and modifiers,
            // we need to emit the comments for the original range.
            ts.setOriginalNode(parameter, node);
            ts.setTextRange(parameter, ts.moveRangePastModifiers(node));
            ts.setCommentRange(parameter, node);
            ts.setSourceMapRange(parameter, ts.moveRangePastModifiers(node));
            ts.setEmitFlags(parameter.name, ts.EmitFlags.NoTrailingSourceMap);
            return parameter;
        }
        /**
         * Visits a variable statement in a namespace.
         *
         * This function will be called when one of the following conditions are met:
         * - The node is exported from a TypeScript namespace.
         */
        function visitVariableStatement(node) {
            if (isExportOfNamespace(node)) {
                const variables = ts.getInitializedVariables(node.declarationList);
                if (variables.length === 0) {
                    // elide statement if there are no initialized variables.
                    return undefined;
                }
                return ts.setTextRange(ts.createStatement(ts.inlineExpressions(ts.map(variables, transformInitializedVariable))), node);
            }
            else {
                return ts.visitEachChild(node, visitor, context);
            }
        }
        function transformInitializedVariable(node) {
            const name = node.name;
            if (ts.isBindingPattern(name)) {
                return ts.flattenDestructuringAssignment(node, visitor, context, 0 /* All */, 
                /*needsValue*/ false, createNamespaceExportExpression);
            }
            else {
                return ts.setTextRange(ts.createAssignment(getNamespaceMemberNameWithSourceMapsAndWithoutComments(name), ts.visitNode(node.initializer, visitor, ts.isExpression)), 
                /*location*/ node);
            }
        }
        function visitVariableDeclaration(node) {
            return ts.updateVariableDeclaration(node, ts.visitNode(node.name, visitor, ts.isBindingName), 
            /*type*/ undefined, ts.visitNode(node.initializer, visitor, ts.isExpression));
        }
        /**
         * Visits a parenthesized expression that contains either a type assertion or an `as`
         * expression.
         *
         * @param node The parenthesized expression node.
         */
        function visitParenthesizedExpression(node) {
            const innerExpression = ts.skipOuterExpressions(node.expression, ~2 /* Assertions */);
            if (ts.isAssertionExpression(innerExpression)) {
                // Make sure we consider all nested cast expressions, e.g.:
                // (<any><number><any>-A).x;
                const expression = ts.visitNode(node.expression, visitor, ts.isExpression);
                // We have an expression of the form: (<Type>SubExpr). Emitting this as (SubExpr)
                // is really not desirable. We would like to emit the subexpression as-is. Omitting
                // the parentheses, however, could cause change in the semantics of the generated
                // code if the casted expression has a lower precedence than the rest of the
                // expression.
                //
                // To preserve comments, we return a "PartiallyEmittedExpression" here which will
                // preserve the position information of the original expression.
                //
                // Due to the auto-parenthesization rules used by the visitor and factory functions
                // we can safely elide the parentheses here, as a new synthetic
                // ParenthesizedExpression will be inserted if we remove parentheses too
                // aggressively.
                return ts.createPartiallyEmittedExpression(expression, node);
            }
            return ts.visitEachChild(node, visitor, context);
        }
        function visitAssertionExpression(node) {
            const expression = ts.visitNode(node.expression, visitor, ts.isExpression);
            return ts.createPartiallyEmittedExpression(expression, node);
        }
        function visitNonNullExpression(node) {
            const expression = ts.visitNode(node.expression, visitor, ts.isLeftHandSideExpression);
            return ts.createPartiallyEmittedExpression(expression, node);
        }
        function visitCallExpression(node) {
            return ts.updateCall(node, ts.visitNode(node.expression, visitor, ts.isExpression), 
            /*typeArguments*/ undefined, ts.visitNodes(node.arguments, visitor, ts.isExpression));
        }
        function visitNewExpression(node) {
            return ts.updateNew(node, ts.visitNode(node.expression, visitor, ts.isExpression), 
            /*typeArguments*/ undefined, ts.visitNodes(node.arguments, visitor, ts.isExpression));
        }
        function visitTaggedTemplateExpression(node) {
            return ts.updateTaggedTemplate(node, ts.visitNode(node.tag, visitor, ts.isExpression), 
            /*typeArguments*/ undefined, ts.visitNode(node.template, visitor, ts.isExpression));
        }
        /**
         * Determines whether to emit an enum declaration.
         *
         * @param node The enum declaration node.
         */
        function shouldEmitEnumDeclaration(node) {
            return !ts.isConst(node)
                || compilerOptions.preserveConstEnums
                || compilerOptions.isolatedModules;
        }
        /**
         * Visits an enum declaration.
         *
         * This function will be called any time a TypeScript enum is encountered.
         *
         * @param node The enum declaration node.
         */
        function visitEnumDeclaration(node) {
            if (!shouldEmitEnumDeclaration(node)) {
                return undefined;
            }
            const statements = [];
            // We request to be advised when the printer is about to print this node. This allows
            // us to set up the correct state for later substitutions.
            let emitFlags = ts.EmitFlags.AdviseOnEmitNode;
            // If needed, we should emit a variable declaration for the enum. If we emit
            // a leading variable declaration, we should not emit leading comments for the
            // enum body.
            if (addVarForEnumOrModuleDeclaration(statements, node)) {
                // We should still emit the comments if we are emitting a system module.
                if (moduleKind !== ts.ModuleKind.System || currentScope !== currentSourceFile) {
                    emitFlags |= ts.EmitFlags.NoLeadingComments;
                }
            }
            // `parameterName` is the declaration name used inside of the enum.
            const parameterName = getNamespaceParameterName(node);
            // `containerName` is the expression used inside of the enum for assignments.
            const containerName = getNamespaceContainerName(node);
            // `exportName` is the expression used within this node's container for any exported references.
            const exportName = ts.hasModifier(node, ts.ModifierFlags.Export)
                ? ts.getExternalModuleOrNamespaceExportName(currentNamespaceContainerName, node, /*allowComments*/ false, /*allowSourceMaps*/ true)
                : ts.getLocalName(node, /*allowComments*/ false, /*allowSourceMaps*/ true);
            //  x || (x = {})
            //  exports.x || (exports.x = {})
            let moduleArg = ts.createLogicalOr(exportName, ts.createAssignment(exportName, ts.createObjectLiteral()));
            if (hasNamespaceQualifiedExportName(node)) {
                // `localName` is the expression used within this node's containing scope for any local references.
                const localName = ts.getLocalName(node, /*allowComments*/ false, /*allowSourceMaps*/ true);
                //  x = (exports.x || (exports.x = {}))
                moduleArg = ts.createAssignment(localName, moduleArg);
            }
            //  (function (x) {
            //      x[x["y"] = 0] = "y";
            //      ...
            //  })(x || (x = {}));
            const enumStatement = ts.createStatement(ts.createCall(ts.createFunctionExpression(
            /*modifiers*/ undefined, 
            /*asteriskToken*/ undefined, 
            /*name*/ undefined, 
            /*typeParameters*/ undefined, [ts.createParameter(/*decorators*/ undefined, /*modifiers*/ undefined, /*dotDotDotToken*/ undefined, parameterName)], 
            /*type*/ undefined, transformEnumBody(node, containerName)), 
            /*typeArguments*/ undefined, [moduleArg]));
            ts.setOriginalNode(enumStatement, node);
            ts.setTextRange(enumStatement, node);
            ts.setEmitFlags(enumStatement, emitFlags);
            statements.push(enumStatement);
            // Add a DeclarationMarker for the enum to preserve trailing comments and mark
            // the end of the declaration.
            statements.push(ts.createEndOfDeclarationMarker(node));
            return statements;
        }
        /**
         * Transforms the body of an enum declaration.
         *
         * @param node The enum declaration node.
         */
        function transformEnumBody(node, localName) {
            const savedCurrentNamespaceLocalName = currentNamespaceContainerName;
            currentNamespaceContainerName = localName;
            const statements = [];
            startLexicalEnvironment();
            ts.addRange(statements, ts.map(node.members, transformEnumMember));
            ts.addRange(statements, endLexicalEnvironment());
            currentNamespaceContainerName = savedCurrentNamespaceLocalName;
            return ts.createBlock(ts.setTextRange(ts.createNodeArray(statements), /*location*/ node.members), 
            /*multiLine*/ true);
        }
        /**
         * Transforms an enum member into a statement.
         *
         * @param member The enum member node.
         */
        function transformEnumMember(member) {
            // enums don't support computed properties
            // we pass false as 'generateNameForComputedPropertyName' for a backward compatibility purposes
            // old emitter always generate 'expression' part of the name as-is.
            const name = getExpressionForPropertyName(member, /*generateNameForComputedPropertyName*/ false);
            const valueExpression = transformEnumMemberDeclarationValue(member);
            const innerAssignment = ts.createAssignment(ts.createElementAccess(currentNamespaceContainerName, name), valueExpression);
            const outerAssignment = valueExpression.kind === ts.SyntaxKind.StringLiteral ?
                innerAssignment :
                ts.createAssignment(ts.createElementAccess(currentNamespaceContainerName, innerAssignment), name);
            return ts.setTextRange(ts.createStatement(ts.setTextRange(outerAssignment, member)), member);
        }
        /**
         * Transforms the value of an enum member.
         *
         * @param member The enum member node.
         */
        function transformEnumMemberDeclarationValue(member) {
            const value = resolver.getConstantValue(member);
            if (value !== undefined) {
                return ts.createLiteral(value);
            }
            else {
                enableSubstitutionForNonQualifiedEnumMembers();
                if (member.initializer) {
                    return ts.visitNode(member.initializer, visitor, ts.isExpression);
                }
                else {
                    return ts.createVoidZero();
                }
            }
        }
        /**
         * Determines whether to elide a module declaration.
         *
         * @param node The module declaration node.
         */
        function shouldEmitModuleDeclaration(node) {
            return ts.isInstantiatedModule(node, compilerOptions.preserveConstEnums || compilerOptions.isolatedModules);
        }
        /**
         * Determines whether an exported declaration will have a qualified export name (e.g. `f.x`
         * or `exports.x`).
         */
        function hasNamespaceQualifiedExportName(node) {
            return isExportOfNamespace(node)
                || (isExternalModuleExport(node)
                    && moduleKind !== ts.ModuleKind.ES2015
                    && moduleKind !== ts.ModuleKind.ESNext
                    && moduleKind !== ts.ModuleKind.System);
        }
        /**
         * Records that a declaration was emitted in the current scope, if it was the first
         * declaration for the provided symbol.
         */
        function recordEmittedDeclarationInScope(node) {
            if (!currentScopeFirstDeclarationsOfName) {
                currentScopeFirstDeclarationsOfName = ts.createUnderscoreEscapedMap();
            }
            const name = declaredNameInScope(node);
            if (!currentScopeFirstDeclarationsOfName.has(name)) {
                currentScopeFirstDeclarationsOfName.set(name, node);
            }
        }
        /**
         * Determines whether a declaration is the first declaration with
         * the same name emitted in the current scope.
         */
        function isFirstEmittedDeclarationInScope(node) {
            if (currentScopeFirstDeclarationsOfName) {
                const name = declaredNameInScope(node);
                return currentScopeFirstDeclarationsOfName.get(name) === node;
            }
            return true;
        }
        function declaredNameInScope(node) {
            ts.Debug.assertNode(node.name, ts.isIdentifier);
            return node.name.escapedText;
        }
        /**
         * Adds a leading VariableStatement for a enum or module declaration.
         */
        function addVarForEnumOrModuleDeclaration(statements, node) {
            // Emit a variable statement for the module. We emit top-level enums as a `var`
            // declaration to avoid static errors in global scripts scripts due to redeclaration.
            // enums in any other scope are emitted as a `let` declaration.
            const statement = ts.createVariableStatement(ts.visitNodes(node.modifiers, modifierVisitor, ts.isModifier), ts.createVariableDeclarationList([
                ts.createVariableDeclaration(ts.getLocalName(node, /*allowComments*/ false, /*allowSourceMaps*/ true))
            ], currentScope.kind === ts.SyntaxKind.SourceFile ? ts.NodeFlags.None : ts.NodeFlags.Let));
            ts.setOriginalNode(statement, node);
            recordEmittedDeclarationInScope(node);
            if (isFirstEmittedDeclarationInScope(node)) {
                // Adjust the source map emit to match the old emitter.
                if (node.kind === ts.SyntaxKind.EnumDeclaration) {
                    ts.setSourceMapRange(statement.declarationList, node);
                }
                else {
                    ts.setSourceMapRange(statement, node);
                }
                // Trailing comments for module declaration should be emitted after the function closure
                // instead of the variable statement:
                //
                //     /** Module comment*/
                //     module m1 {
                //         function foo4Export() {
                //         }
                //     } // trailing comment module
                //
                // Should emit:
                //
                //     /** Module comment*/
                //     var m1;
                //     (function (m1) {
                //         function foo4Export() {
                //         }
                //     })(m1 || (m1 = {})); // trailing comment module
                //
                ts.setCommentRange(statement, node);
                ts.setEmitFlags(statement, ts.EmitFlags.NoTrailingComments | ts.EmitFlags.HasEndOfDeclarationMarker);
                statements.push(statement);
                return true;
            }
            else {
                // For an EnumDeclaration or ModuleDeclaration that merges with a preceeding
                // declaration we do not emit a leading variable declaration. To preserve the
                // begin/end semantics of the declararation and to properly handle exports
                // we wrap the leading variable declaration in a `MergeDeclarationMarker`.
                const mergeMarker = ts.createMergeDeclarationMarker(statement);
                ts.setEmitFlags(mergeMarker, ts.EmitFlags.NoComments | ts.EmitFlags.HasEndOfDeclarationMarker);
                statements.push(mergeMarker);
                return false;
            }
        }
        /**
         * Visits a module declaration node.
         *
         * This function will be called any time a TypeScript namespace (ModuleDeclaration) is encountered.
         *
         * @param node The module declaration node.
         */
        function visitModuleDeclaration(node) {
            if (!shouldEmitModuleDeclaration(node)) {
                return ts.createNotEmittedStatement(node);
            }
            ts.Debug.assertNode(node.name, ts.isIdentifier, "A TypeScript namespace should have an Identifier name.");
            enableSubstitutionForNamespaceExports();
            const statements = [];
            // We request to be advised when the printer is about to print this node. This allows
            // us to set up the correct state for later substitutions.
            let emitFlags = ts.EmitFlags.AdviseOnEmitNode;
            // If needed, we should emit a variable declaration for the module. If we emit
            // a leading variable declaration, we should not emit leading comments for the
            // module body.
            if (addVarForEnumOrModuleDeclaration(statements, node)) {
                // We should still emit the comments if we are emitting a system module.
                if (moduleKind !== ts.ModuleKind.System || currentScope !== currentSourceFile) {
                    emitFlags |= ts.EmitFlags.NoLeadingComments;
                }
            }
            // `parameterName` is the declaration name used inside of the namespace.
            const parameterName = getNamespaceParameterName(node);
            // `containerName` is the expression used inside of the namespace for exports.
            const containerName = getNamespaceContainerName(node);
            // `exportName` is the expression used within this node's container for any exported references.
            const exportName = ts.hasModifier(node, ts.ModifierFlags.Export)
                ? ts.getExternalModuleOrNamespaceExportName(currentNamespaceContainerName, node, /*allowComments*/ false, /*allowSourceMaps*/ true)
                : ts.getLocalName(node, /*allowComments*/ false, /*allowSourceMaps*/ true);
            //  x || (x = {})
            //  exports.x || (exports.x = {})
            let moduleArg = ts.createLogicalOr(exportName, ts.createAssignment(exportName, ts.createObjectLiteral()));
            if (hasNamespaceQualifiedExportName(node)) {
                // `localName` is the expression used within this node's containing scope for any local references.
                const localName = ts.getLocalName(node, /*allowComments*/ false, /*allowSourceMaps*/ true);
                //  x = (exports.x || (exports.x = {}))
                moduleArg = ts.createAssignment(localName, moduleArg);
            }
            //  (function (x_1) {
            //      x_1.y = ...;
            //  })(x || (x = {}));
            const moduleStatement = ts.createStatement(ts.createCall(ts.createFunctionExpression(
            /*modifiers*/ undefined, 
            /*asteriskToken*/ undefined, 
            /*name*/ undefined, 
            /*typeParameters*/ undefined, [ts.createParameter(/*decorators*/ undefined, /*modifiers*/ undefined, /*dotDotDotToken*/ undefined, parameterName)], 
            /*type*/ undefined, transformModuleBody(node, containerName)), 
            /*typeArguments*/ undefined, [moduleArg]));
            ts.setOriginalNode(moduleStatement, node);
            ts.setTextRange(moduleStatement, node);
            ts.setEmitFlags(moduleStatement, emitFlags);
            statements.push(moduleStatement);
            // Add a DeclarationMarker for the namespace to preserve trailing comments and mark
            // the end of the declaration.
            statements.push(ts.createEndOfDeclarationMarker(node));
            return statements;
        }
        /**
         * Transforms the body of a module declaration.
         *
         * @param node The module declaration node.
         */
        function transformModuleBody(node, namespaceLocalName) {
            const savedCurrentNamespaceContainerName = currentNamespaceContainerName;
            const savedCurrentNamespace = currentNamespace;
            const savedCurrentScopeFirstDeclarationsOfName = currentScopeFirstDeclarationsOfName;
            currentNamespaceContainerName = namespaceLocalName;
            currentNamespace = node;
            currentScopeFirstDeclarationsOfName = undefined;
            const statements = [];
            startLexicalEnvironment();
            let statementsLocation;
            let blockLocation;
            const body = node.body;
            if (body.kind === ts.SyntaxKind.ModuleBlock) {
                saveStateAndInvoke(body, body => ts.addRange(statements, ts.visitNodes(body.statements, namespaceElementVisitor, ts.isStatement)));
                statementsLocation = body.statements;
                blockLocation = body;
            }
            else {
                const result = visitModuleDeclaration(body);
                if (result) {
                    if (ts.isArray(result)) {
                        ts.addRange(statements, result);
                    }
                    else {
                        statements.push(result);
                    }
                }
                const moduleBlock = getInnerMostModuleDeclarationFromDottedModule(node).body;
                statementsLocation = ts.moveRangePos(moduleBlock.statements, -1);
            }
            ts.addRange(statements, endLexicalEnvironment());
            currentNamespaceContainerName = savedCurrentNamespaceContainerName;
            currentNamespace = savedCurrentNamespace;
            currentScopeFirstDeclarationsOfName = savedCurrentScopeFirstDeclarationsOfName;
            const block = ts.createBlock(ts.setTextRange(ts.createNodeArray(statements), 
            /*location*/ statementsLocation), 
            /*multiLine*/ true);
            ts.setTextRange(block, blockLocation);
            // namespace hello.hi.world {
            //      function foo() {}
            //
            //      // TODO, blah
            // }
            //
            // should be emitted as
            //
            // var hello;
            // (function (hello) {
            //     var hi;
            //     (function (hi) {
            //         var world;
            //         (function (world) {
            //             function foo() { }
            //             // TODO, blah
            //         })(world = hi.world || (hi.world = {}));
            //     })(hi = hello.hi || (hello.hi = {}));
            // })(hello || (hello = {}));
            // We only want to emit comment on the namespace which contains block body itself, not the containing namespaces.
            if (body.kind !== ts.SyntaxKind.ModuleBlock) {
                ts.setEmitFlags(block, ts.getEmitFlags(block) | ts.EmitFlags.NoComments);
            }
            return block;
        }
        function getInnerMostModuleDeclarationFromDottedModule(moduleDeclaration) {
            if (moduleDeclaration.body.kind === ts.SyntaxKind.ModuleDeclaration) {
                const recursiveInnerModule = getInnerMostModuleDeclarationFromDottedModule(moduleDeclaration.body);
                return recursiveInnerModule || moduleDeclaration.body;
            }
        }
        /**
         * Visits an import declaration, eliding it if it is not referenced.
         *
         * @param node The import declaration node.
         */
        function visitImportDeclaration(node) {
            if (!node.importClause) {
                // Do not elide a side-effect only import declaration.
                //  import "foo";
                return node;
            }
            // Elide the declaration if the import clause was elided.
            const importClause = ts.visitNode(node.importClause, visitImportClause, ts.isImportClause);
            return importClause
                ? ts.updateImportDeclaration(node, 
                /*decorators*/ undefined, 
                /*modifiers*/ undefined, importClause, node.moduleSpecifier)
                : undefined;
        }
        /**
         * Visits an import clause, eliding it if it is not referenced.
         *
         * @param node The import clause node.
         */
        function visitImportClause(node) {
            // Elide the import clause if we elide both its name and its named bindings.
            const name = resolver.isReferencedAliasDeclaration(node) ? node.name : undefined;
            const namedBindings = ts.visitNode(node.namedBindings, visitNamedImportBindings, ts.isNamedImportBindings);
            return (name || namedBindings) ? ts.updateImportClause(node, name, namedBindings) : undefined;
        }
        /**
         * Visits named import bindings, eliding it if it is not referenced.
         *
         * @param node The named import bindings node.
         */
        function visitNamedImportBindings(node) {
            if (node.kind === ts.SyntaxKind.NamespaceImport) {
                // Elide a namespace import if it is not referenced.
                return resolver.isReferencedAliasDeclaration(node) ? node : undefined;
            }
            else {
                // Elide named imports if all of its import specifiers are elided.
                const elements = ts.visitNodes(node.elements, visitImportSpecifier, ts.isImportSpecifier);
                return ts.some(elements) ? ts.updateNamedImports(node, elements) : undefined;
            }
        }
        /**
         * Visits an import specifier, eliding it if it is not referenced.
         *
         * @param node The import specifier node.
         */
        function visitImportSpecifier(node) {
            // Elide an import specifier if it is not referenced.
            return resolver.isReferencedAliasDeclaration(node) ? node : undefined;
        }
        /**
         * Visits an export assignment, eliding it if it does not contain a clause that resolves
         * to a value.
         *
         * @param node The export assignment node.
         */
        function visitExportAssignment(node) {
            // Elide the export assignment if it does not reference a value.
            return resolver.isValueAliasDeclaration(node)
                ? ts.visitEachChild(node, visitor, context)
                : undefined;
        }
        /**
         * Visits an export declaration, eliding it if it does not contain a clause that resolves
         * to a value.
         *
         * @param node The export declaration node.
         */
        function visitExportDeclaration(node) {
            if (!node.exportClause) {
                // Elide a star export if the module it references does not export a value.
                return compilerOptions.isolatedModules || resolver.moduleExportsSomeValue(node.moduleSpecifier) ? node : undefined;
            }
            if (!resolver.isValueAliasDeclaration(node)) {
                // Elide the export declaration if it does not export a value.
                return undefined;
            }
            // Elide the export declaration if all of its named exports are elided.
            const exportClause = ts.visitNode(node.exportClause, visitNamedExports, ts.isNamedExports);
            return exportClause
                ? ts.updateExportDeclaration(node, 
                /*decorators*/ undefined, 
                /*modifiers*/ undefined, exportClause, node.moduleSpecifier)
                : undefined;
        }
        /**
         * Visits named exports, eliding it if it does not contain an export specifier that
         * resolves to a value.
         *
         * @param node The named exports node.
         */
        function visitNamedExports(node) {
            // Elide the named exports if all of its export specifiers were elided.
            const elements = ts.visitNodes(node.elements, visitExportSpecifier, ts.isExportSpecifier);
            return ts.some(elements) ? ts.updateNamedExports(node, elements) : undefined;
        }
        /**
         * Visits an export specifier, eliding it if it does not resolve to a value.
         *
         * @param node The export specifier node.
         */
        function visitExportSpecifier(node) {
            // Elide an export specifier if it does not reference a value.
            return resolver.isValueAliasDeclaration(node) ? node : undefined;
        }
        /**
         * Determines whether to emit an import equals declaration.
         *
         * @param node The import equals declaration node.
         */
        function shouldEmitImportEqualsDeclaration(node) {
            // preserve old compiler's behavior: emit 'var' for import declaration (even if we do not consider them referenced) when
            // - current file is not external module
            // - import declaration is top level and target is value imported by entity name
            return resolver.isReferencedAliasDeclaration(node)
                || (!ts.isExternalModule(currentSourceFile)
                    && resolver.isTopLevelValueImportEqualsWithEntityName(node));
        }
        /**
         * Visits an import equals declaration.
         *
         * @param node The import equals declaration node.
         */
        function visitImportEqualsDeclaration(node) {
            if (ts.isExternalModuleImportEqualsDeclaration(node)) {
                // Elide external module `import=` if it is not referenced.
                return resolver.isReferencedAliasDeclaration(node)
                    ? ts.visitEachChild(node, visitor, context)
                    : undefined;
            }
            if (!shouldEmitImportEqualsDeclaration(node)) {
                return undefined;
            }
            const moduleReference = ts.createExpressionFromEntityName(node.moduleReference);
            ts.setEmitFlags(moduleReference, ts.EmitFlags.NoComments | ts.EmitFlags.NoNestedComments);
            if (isNamedExternalModuleExport(node) || !isExportOfNamespace(node)) {
                //  export var ${name} = ${moduleReference};
                //  var ${name} = ${moduleReference};
                return ts.setOriginalNode(ts.setTextRange(ts.createVariableStatement(ts.visitNodes(node.modifiers, modifierVisitor, ts.isModifier), ts.createVariableDeclarationList([
                    ts.setOriginalNode(ts.createVariableDeclaration(node.name, 
                    /*type*/ undefined, moduleReference), node)
                ])), node), node);
            }
            else {
                // exports.${name} = ${moduleReference};
                return ts.setOriginalNode(createNamespaceExport(node.name, moduleReference, node), node);
            }
        }
        /**
         * Gets a value indicating whether the node is exported from a namespace.
         *
         * @param node The node to test.
         */
        function isExportOfNamespace(node) {
            return currentNamespace !== undefined && ts.hasModifier(node, ts.ModifierFlags.Export);
        }
        /**
         * Gets a value indicating whether the node is exported from an external module.
         *
         * @param node The node to test.
         */
        function isExternalModuleExport(node) {
            return currentNamespace === undefined && ts.hasModifier(node, ts.ModifierFlags.Export);
        }
        /**
         * Gets a value indicating whether the node is a named export from an external module.
         *
         * @param node The node to test.
         */
        function isNamedExternalModuleExport(node) {
            return isExternalModuleExport(node)
                && !ts.hasModifier(node, ts.ModifierFlags.Default);
        }
        /**
         * Gets a value indicating whether the node is the default export of an external module.
         *
         * @param node The node to test.
         */
        function isDefaultExternalModuleExport(node) {
            return isExternalModuleExport(node)
                && ts.hasModifier(node, ts.ModifierFlags.Default);
        }
        /**
         * Creates a statement for the provided expression. This is used in calls to `map`.
         */
        function expressionToStatement(expression) {
            return ts.createStatement(expression);
        }
        function addExportMemberAssignment(statements, node) {
            const expression = ts.createAssignment(ts.getExternalModuleOrNamespaceExportName(currentNamespaceContainerName, node, /*allowComments*/ false, /*allowSourceMaps*/ true), ts.getLocalName(node));
            ts.setSourceMapRange(expression, ts.createRange(node.name ? node.name.pos : node.pos, node.end));
            const statement = ts.createStatement(expression);
            ts.setSourceMapRange(statement, ts.createRange(-1, node.end));
            statements.push(statement);
        }
        function createNamespaceExport(exportName, exportValue, location) {
            return ts.setTextRange(ts.createStatement(ts.createAssignment(ts.getNamespaceMemberName(currentNamespaceContainerName, exportName, /*allowComments*/ false, /*allowSourceMaps*/ true), exportValue)), location);
        }
        function createNamespaceExportExpression(exportName, exportValue, location) {
            return ts.setTextRange(ts.createAssignment(getNamespaceMemberNameWithSourceMapsAndWithoutComments(exportName), exportValue), location);
        }
        function getNamespaceMemberNameWithSourceMapsAndWithoutComments(name) {
            return ts.getNamespaceMemberName(currentNamespaceContainerName, name, /*allowComments*/ false, /*allowSourceMaps*/ true);
        }
        /**
         * Gets the declaration name used inside of a namespace or enum.
         */
        function getNamespaceParameterName(node) {
            const name = ts.getGeneratedNameForNode(node);
            ts.setSourceMapRange(name, node.name);
            return name;
        }
        /**
         * Gets the expression used to refer to a namespace or enum within the body
         * of its declaration.
         */
        function getNamespaceContainerName(node) {
            return ts.getGeneratedNameForNode(node);
        }
        /**
         * Gets a local alias for a class declaration if it is a decorated class with an internal
         * reference to the static side of the class. This is necessary to avoid issues with
         * double-binding semantics for the class name.
         */
        function getClassAliasIfNeeded(node) {
            if (resolver.getNodeCheckFlags(node) & 8388608 /* ClassWithConstructorReference */) {
                enableSubstitutionForClassAliases();
                const classAlias = ts.createUniqueName(node.name && !ts.isGeneratedIdentifier(node.name) ? ts.idText(node.name) : "default");
                classAliases[ts.getOriginalNodeId(node)] = classAlias;
                hoistVariableDeclaration(classAlias);
                return classAlias;
            }
        }
        function getClassPrototype(node) {
            return ts.createPropertyAccess(ts.getDeclarationName(node), "prototype");
        }
        function getClassMemberPrefix(node, member) {
            return ts.hasModifier(member, ts.ModifierFlags.Static)
                ? ts.getDeclarationName(node)
                : getClassPrototype(node);
        }
        function enableSubstitutionForNonQualifiedEnumMembers() {
            if ((enabledSubstitutions & 8 /* NonQualifiedEnumMembers */) === 0) {
                enabledSubstitutions |= 8 /* NonQualifiedEnumMembers */;
                context.enableSubstitution(ts.SyntaxKind.Identifier);
            }
        }
        function enableSubstitutionForClassAliases() {
            if ((enabledSubstitutions & 1 /* ClassAliases */) === 0) {
                enabledSubstitutions |= 1 /* ClassAliases */;
                // We need to enable substitutions for identifiers. This allows us to
                // substitute class names inside of a class declaration.
                context.enableSubstitution(ts.SyntaxKind.Identifier);
                // Keep track of class aliases.
                classAliases = [];
            }
        }
        function enableSubstitutionForNamespaceExports() {
            if ((enabledSubstitutions & 2 /* NamespaceExports */) === 0) {
                enabledSubstitutions |= 2 /* NamespaceExports */;
                // We need to enable substitutions for identifiers and shorthand property assignments. This allows us to
                // substitute the names of exported members of a namespace.
                context.enableSubstitution(ts.SyntaxKind.Identifier);
                context.enableSubstitution(ts.SyntaxKind.ShorthandPropertyAssignment);
                // We need to be notified when entering and exiting namespaces.
                context.enableEmitNotification(ts.SyntaxKind.ModuleDeclaration);
            }
        }
        function isTransformedModuleDeclaration(node) {
            return ts.getOriginalNode(node).kind === ts.SyntaxKind.ModuleDeclaration;
        }
        function isTransformedEnumDeclaration(node) {
            return ts.getOriginalNode(node).kind === ts.SyntaxKind.EnumDeclaration;
        }
        /**
         * Hook for node emit.
         *
         * @param hint A hint as to the intended usage of the node.
         * @param node The node to emit.
         * @param emit A callback used to emit the node in the printer.
         */
        function onEmitNode(hint, node, emitCallback) {
            const savedApplicableSubstitutions = applicableSubstitutions;
            const savedCurrentSourceFile = currentSourceFile;
            if (ts.isSourceFile(node)) {
                currentSourceFile = node;
            }
            if (enabledSubstitutions & 2 /* NamespaceExports */ && isTransformedModuleDeclaration(node)) {
                applicableSubstitutions |= 2 /* NamespaceExports */;
            }
            if (enabledSubstitutions & 8 /* NonQualifiedEnumMembers */ && isTransformedEnumDeclaration(node)) {
                applicableSubstitutions |= 8 /* NonQualifiedEnumMembers */;
            }
            previousOnEmitNode(hint, node, emitCallback);
            applicableSubstitutions = savedApplicableSubstitutions;
            currentSourceFile = savedCurrentSourceFile;
        }
        /**
         * Hooks node substitutions.
         *
         * @param hint A hint as to the intended usage of the node.
         * @param node The node to substitute.
         */
        function onSubstituteNode(hint, node) {
            node = previousOnSubstituteNode(hint, node);
            if (hint === ts.EmitHint.Expression) {
                return substituteExpression(node);
            }
            else if (ts.isShorthandPropertyAssignment(node)) {
                return substituteShorthandPropertyAssignment(node);
            }
            return node;
        }
        function substituteShorthandPropertyAssignment(node) {
            if (enabledSubstitutions & 2 /* NamespaceExports */) {
                const name = node.name;
                const exportedName = trySubstituteNamespaceExportedName(name);
                if (exportedName) {
                    // A shorthand property with an assignment initializer is probably part of a
                    // destructuring assignment
                    if (node.objectAssignmentInitializer) {
                        const initializer = ts.createAssignment(exportedName, node.objectAssignmentInitializer);
                        return ts.setTextRange(ts.createPropertyAssignment(name, initializer), node);
                    }
                    return ts.setTextRange(ts.createPropertyAssignment(name, exportedName), node);
                }
            }
            return node;
        }
        function substituteExpression(node) {
            switch (node.kind) {
                case ts.SyntaxKind.Identifier:
                    return substituteExpressionIdentifier(node);
                case ts.SyntaxKind.PropertyAccessExpression:
                    return substitutePropertyAccessExpression(node);
                case ts.SyntaxKind.ElementAccessExpression:
                    return substituteElementAccessExpression(node);
            }
            return node;
        }
        function substituteExpressionIdentifier(node) {
            return trySubstituteClassAlias(node)
                || trySubstituteNamespaceExportedName(node)
                || node;
        }
        function trySubstituteClassAlias(node) {
            if (enabledSubstitutions & 1 /* ClassAliases */) {
                if (resolver.getNodeCheckFlags(node) & 16777216 /* ConstructorReferenceInClass */) {
                    // Due to the emit for class decorators, any reference to the class from inside of the class body
                    // must instead be rewritten to point to a temporary variable to avoid issues with the double-bind
                    // behavior of class names in ES6.
                    // Also, when emitting statics for class expressions, we must substitute a class alias for
                    // constructor references in static property initializers.
                    const declaration = resolver.getReferencedValueDeclaration(node);
                    if (declaration) {
                        const classAlias = classAliases[declaration.id];
                        if (classAlias) {
                            const clone = ts.getSynthesizedClone(classAlias);
                            ts.setSourceMapRange(clone, node);
                            ts.setCommentRange(clone, node);
                            return clone;
                        }
                    }
                }
            }
            return undefined;
        }
        function trySubstituteNamespaceExportedName(node) {
            // If this is explicitly a local name, do not substitute.
            if (enabledSubstitutions & applicableSubstitutions && !ts.isGeneratedIdentifier(node) && !ts.isLocalName(node)) {
                // If we are nested within a namespace declaration, we may need to qualifiy
                // an identifier that is exported from a merged namespace.
                const container = resolver.getReferencedExportContainer(node, /*prefixLocals*/ false);
                if (container && container.kind !== ts.SyntaxKind.SourceFile) {
                    const substitute = (applicableSubstitutions & 2 /* NamespaceExports */ && container.kind === ts.SyntaxKind.ModuleDeclaration) ||
                        (applicableSubstitutions & 8 /* NonQualifiedEnumMembers */ && container.kind === ts.SyntaxKind.EnumDeclaration);
                    if (substitute) {
                        return ts.setTextRange(ts.createPropertyAccess(ts.getGeneratedNameForNode(container), node), 
                        /*location*/ node);
                    }
                }
            }
            return undefined;
        }
        function substitutePropertyAccessExpression(node) {
            return substituteConstantValue(node);
        }
        function substituteElementAccessExpression(node) {
            return substituteConstantValue(node);
        }
        function substituteConstantValue(node) {
            const constantValue = tryGetConstEnumValue(node);
            if (constantValue !== undefined) {
                // track the constant value on the node for the printer in needsDotDotForPropertyAccess
                ts.setConstantValue(node, constantValue);
                const substitute = ts.createLiteral(constantValue);
                if (!compilerOptions.removeComments) {
                    const propertyName = ts.isPropertyAccessExpression(node)
                        ? ts.declarationNameToString(node.name)
                        : ts.getTextOfNode(node.argumentExpression);
                    ts.addSyntheticTrailingComment(substitute, ts.SyntaxKind.MultiLineCommentTrivia, ` ${propertyName} `);
                }
                return substitute;
            }
            return node;
        }
        function tryGetConstEnumValue(node) {
            if (compilerOptions.isolatedModules) {
                return undefined;
            }
            return ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) ? resolver.getConstantValue(node) : undefined;
        }
    }
    ts.transformTypeScript = transformTypeScript;
    function createDecorateHelper(context, decoratorExpressions, target, memberName, descriptor, location) {
        const argumentsArray = [];
        argumentsArray.push(ts.createArrayLiteral(decoratorExpressions, /*multiLine*/ true));
        argumentsArray.push(target);
        if (memberName) {
            argumentsArray.push(memberName);
            if (descriptor) {
                argumentsArray.push(descriptor);
            }
        }
        context.requestEmitHelper(decorateHelper);
        return ts.setTextRange(ts.createCall(ts.getHelperName("__decorate"), 
        /*typeArguments*/ undefined, argumentsArray), location);
    }
    const decorateHelper = {
        name: "typescript:decorate",
        scoped: false,
        priority: 2,
        text: `
            var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
                var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
                if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
                else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
                return c > 3 && r && Object.defineProperty(target, key, r), r;
            };`
    };
    function createMetadataHelper(context, metadataKey, metadataValue) {
        context.requestEmitHelper(metadataHelper);
        return ts.createCall(ts.getHelperName("__metadata"), 
        /*typeArguments*/ undefined, [
            ts.createLiteral(metadataKey),
            metadataValue
        ]);
    }
    const metadataHelper = {
        name: "typescript:metadata",
        scoped: false,
        priority: 3,
        text: `
            var __metadata = (this && this.__metadata) || function (k, v) {
                if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
            };`
    };
    function createParamHelper(context, expression, parameterOffset, location) {
        context.requestEmitHelper(paramHelper);
        return ts.setTextRange(ts.createCall(ts.getHelperName("__param"), 
        /*typeArguments*/ undefined, [
            ts.createLiteral(parameterOffset),
            expression
        ]), location);
    }
    const paramHelper = {
        name: "typescript:param",
        scoped: false,
        priority: 4,
        text: `
            var __param = (this && this.__param) || function (paramIndex, decorator) {
                return function (target, key) { decorator(target, key, paramIndex); }
            };`
    };
})(ts || (ts = {}));
