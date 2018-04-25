/* @internal */
var ts;
(function (ts) {
    function getModuleInstanceState(node) {
        return node.body ? getModuleInstanceStateWorker(node.body) : 1 /* Instantiated */;
    }
    ts.getModuleInstanceState = getModuleInstanceState;
    function getModuleInstanceStateWorker(node) {
        // A module is uninstantiated if it contains only
        switch (node.kind) {
            // 1. interface declarations, type alias declarations
            case ts.SyntaxKind.InterfaceDeclaration:
            case ts.SyntaxKind.TypeAliasDeclaration:
                return 0 /* NonInstantiated */;
            // 2. const enum declarations
            case ts.SyntaxKind.EnumDeclaration:
                if (ts.isConst(node)) {
                    return 2 /* ConstEnumOnly */;
                }
                break;
            // 3. non-exported import declarations
            case ts.SyntaxKind.ImportDeclaration:
            case ts.SyntaxKind.ImportEqualsDeclaration:
                if (!(ts.hasModifier(node, ts.ModifierFlags.Export))) {
                    return 0 /* NonInstantiated */;
                }
                break;
            // 4. other uninstantiated module declarations.
            case ts.SyntaxKind.ModuleBlock: {
                let state = 0 /* NonInstantiated */;
                ts.forEachChild(node, n => {
                    const childState = getModuleInstanceStateWorker(n);
                    switch (childState) {
                        case 0 /* NonInstantiated */:
                            // child is non-instantiated - continue searching
                            return;
                        case 2 /* ConstEnumOnly */:
                            // child is const enum only - record state and continue searching
                            state = 2 /* ConstEnumOnly */;
                            return;
                        case 1 /* Instantiated */:
                            // child is instantiated - record state and stop
                            state = 1 /* Instantiated */;
                            return true;
                        default:
                            ts.Debug.assertNever(childState);
                    }
                });
                return state;
            }
            case ts.SyntaxKind.ModuleDeclaration:
                return getModuleInstanceState(node);
            case ts.SyntaxKind.Identifier:
                // Only jsdoc typedef definition can exist in jsdoc namespace, and it should
                // be considered the same as type alias
                if (node.isInJSDocNamespace) {
                    return 0 /* NonInstantiated */;
                }
        }
        return 1 /* Instantiated */;
    }
    const binder = createBinder();
    function bindSourceFile(file, options) {
        ts.performance.mark("beforeBind");
        binder(file, options);
        ts.performance.mark("afterBind");
        ts.performance.measure("Bind", "beforeBind", "afterBind");
    }
    ts.bindSourceFile = bindSourceFile;
    function createBinder() {
        let file;
        let options;
        let languageVersion;
        let parent;
        let container;
        let thisParentContainer; // Container one level up
        let blockScopeContainer;
        let lastContainer;
        let seenThisKeyword;
        // state used by control flow analysis
        let currentFlow;
        let currentBreakTarget;
        let currentContinueTarget;
        let currentReturnTarget;
        let currentTrueTarget;
        let currentFalseTarget;
        let preSwitchCaseFlow;
        let activeLabels;
        let hasExplicitReturn;
        // state used for emit helpers
        let emitFlags;
        // If this file is an external module, then it is automatically in strict-mode according to
        // ES6.  If it is not an external module, then we'll determine if it is in strict mode or
        // not depending on if we see "use strict" in certain places or if we hit a class/namespace
        // or if compiler options contain alwaysStrict.
        let inStrictMode;
        let symbolCount = 0;
        let Symbol; // tslint:disable-line variable-name
        let classifiableNames;
        const unreachableFlow = { flags: ts.FlowFlags.Unreachable };
        const reportedUnreachableFlow = { flags: ts.FlowFlags.Unreachable };
        // state used to aggregate transform flags during bind.
        let subtreeTransformFlags = 0 /* None */;
        let skipTransformFlagAggregation;
        /**
         * Inside the binder, we may create a diagnostic for an as-yet unbound node (with potentially no parent pointers, implying no accessible source file)
         * If so, the node _must_ be in the current file (as that's the only way anything could have traversed to it to yield it as the error node)
         * This version of `createDiagnosticForNode` uses the binder's context to account for this, and always yields correct diagnostics even in these situations.
         */
        function createDiagnosticForNode(node, message, arg0, arg1, arg2) {
            return ts.createDiagnosticForNodeInSourceFile(ts.getSourceFileOfNode(node) || file, node, message, arg0, arg1, arg2);
        }
        function bindSourceFile(f, opts) {
            file = f;
            options = opts;
            languageVersion = ts.getEmitScriptTarget(options);
            inStrictMode = bindInStrictMode(file, opts);
            classifiableNames = ts.createUnderscoreEscapedMap();
            symbolCount = 0;
            skipTransformFlagAggregation = file.isDeclarationFile;
            Symbol = ts.objectAllocator.getSymbolConstructor();
            if (!file.locals) {
                bind(file);
                file.symbolCount = symbolCount;
                file.classifiableNames = classifiableNames;
            }
            file = undefined;
            options = undefined;
            languageVersion = undefined;
            parent = undefined;
            container = undefined;
            thisParentContainer = undefined;
            blockScopeContainer = undefined;
            lastContainer = undefined;
            seenThisKeyword = false;
            currentFlow = undefined;
            currentBreakTarget = undefined;
            currentContinueTarget = undefined;
            currentReturnTarget = undefined;
            currentTrueTarget = undefined;
            currentFalseTarget = undefined;
            activeLabels = undefined;
            hasExplicitReturn = false;
            emitFlags = ts.NodeFlags.None;
            subtreeTransformFlags = 0 /* None */;
        }
        return bindSourceFile;
        function bindInStrictMode(file, opts) {
            if (ts.getStrictOptionValue(opts, "alwaysStrict") && !file.isDeclarationFile) {
                // bind in strict mode source files with alwaysStrict option
                return true;
            }
            else {
                return !!file.externalModuleIndicator;
            }
        }
        function createSymbol(flags, name) {
            symbolCount++;
            return new Symbol(flags, name);
        }
        function addDeclarationToSymbol(symbol, node, symbolFlags) {
            symbol.flags |= symbolFlags;
            node.symbol = symbol;
            symbol.declarations = ts.append(symbol.declarations, node);
            if (symbolFlags & ts.SymbolFlags.HasExports && !symbol.exports) {
                symbol.exports = ts.createSymbolTable();
            }
            if (symbolFlags & ts.SymbolFlags.HasMembers && !symbol.members) {
                symbol.members = ts.createSymbolTable();
            }
            if (symbolFlags & ts.SymbolFlags.Value) {
                const valueDeclaration = symbol.valueDeclaration;
                if (!valueDeclaration ||
                    (valueDeclaration.kind !== node.kind && valueDeclaration.kind === ts.SyntaxKind.ModuleDeclaration)) {
                    // other kinds of value declarations take precedence over modules
                    symbol.valueDeclaration = node;
                }
            }
        }
        // Should not be called on a declaration with a computed property name,
        // unless it is a well known Symbol.
        function getDeclarationName(node) {
            if (node.kind === ts.SyntaxKind.ExportAssignment) {
                return node.isExportEquals ? ts.InternalSymbolName.ExportEquals : ts.InternalSymbolName.Default;
            }
            const name = ts.getNameOfDeclaration(node);
            if (name) {
                if (ts.isAmbientModule(node)) {
                    const moduleName = ts.getTextOfIdentifierOrLiteral(name);
                    return (ts.isGlobalScopeAugmentation(node) ? "__global" : `"${moduleName}"`);
                }
                if (name.kind === ts.SyntaxKind.ComputedPropertyName) {
                    const nameExpression = name.expression;
                    // treat computed property names where expression is string/numeric literal as just string/numeric literal
                    if (ts.isStringOrNumericLiteral(nameExpression)) {
                        return ts.escapeLeadingUnderscores(nameExpression.text);
                    }
                    ts.Debug.assert(ts.isWellKnownSymbolSyntactically(nameExpression));
                    return ts.getPropertyNameForKnownSymbolName(ts.idText(nameExpression.name));
                }
                return ts.isPropertyNameLiteral(name) ? ts.getEscapedTextOfIdentifierOrLiteral(name) : undefined;
            }
            switch (node.kind) {
                case ts.SyntaxKind.Constructor:
                    return ts.InternalSymbolName.Constructor;
                case ts.SyntaxKind.FunctionType:
                case ts.SyntaxKind.CallSignature:
                    return ts.InternalSymbolName.Call;
                case ts.SyntaxKind.ConstructorType:
                case ts.SyntaxKind.ConstructSignature:
                    return ts.InternalSymbolName.New;
                case ts.SyntaxKind.IndexSignature:
                    return ts.InternalSymbolName.Index;
                case ts.SyntaxKind.ExportDeclaration:
                    return ts.InternalSymbolName.ExportStar;
                case ts.SyntaxKind.BinaryExpression:
                    if (ts.getSpecialPropertyAssignmentKind(node) === 2 /* ModuleExports */) {
                        // module.exports = ...
                        return ts.InternalSymbolName.ExportEquals;
                    }
                    ts.Debug.fail("Unknown binary declaration kind");
                    break;
                case ts.SyntaxKind.JSDocFunctionType:
                    return (ts.isJSDocConstructSignature(node) ? ts.InternalSymbolName.New : ts.InternalSymbolName.Call);
                case ts.SyntaxKind.Parameter:
                    // Parameters with names are handled at the top of this function.  Parameters
                    // without names can only come from JSDocFunctionTypes.
                    ts.Debug.assert(node.parent.kind === ts.SyntaxKind.JSDocFunctionType, "Impossible parameter parent kind", () => `parent is: ${ts.SyntaxKind ? ts.SyntaxKind[node.parent.kind] : node.parent.kind}, expected JSDocFunctionType`);
                    const functionType = node.parent;
                    const index = functionType.parameters.indexOf(node);
                    return "arg" + index;
                case ts.SyntaxKind.JSDocTypedefTag:
                    const name = ts.getNameOfJSDocTypedef(node);
                    return typeof name !== "undefined" ? name.escapedText : undefined;
            }
        }
        function getDisplayName(node) {
            return ts.isNamedDeclaration(node) ? ts.declarationNameToString(node.name) : ts.unescapeLeadingUnderscores(getDeclarationName(node));
        }
        /**
         * Declares a Symbol for the node and adds it to symbols. Reports errors for conflicting identifier names.
         * @param symbolTable - The symbol table which node will be added to.
         * @param parent - node's parent declaration.
         * @param node - The declaration to be added to the symbol table
         * @param includes - The SymbolFlags that node has in addition to its declaration type (eg: export, ambient, etc.)
         * @param excludes - The flags which node cannot be declared alongside in a symbol table. Used to report forbidden declarations.
         */
        function declareSymbol(symbolTable, parent, node, includes, excludes, isReplaceableByMethod) {
            ts.Debug.assert(!ts.hasDynamicName(node));
            const isDefaultExport = ts.hasModifier(node, ts.ModifierFlags.Default);
            // The exported symbol for an export default function/class node is always named "default"
            const name = isDefaultExport && parent ? ts.InternalSymbolName.Default : getDeclarationName(node);
            let symbol;
            if (name === undefined) {
                symbol = createSymbol(ts.SymbolFlags.None, ts.InternalSymbolName.Missing);
            }
            else {
                // Check and see if the symbol table already has a symbol with this name.  If not,
                // create a new symbol with this name and add it to the table.  Note that we don't
                // give the new symbol any flags *yet*.  This ensures that it will not conflict
                // with the 'excludes' flags we pass in.
                //
                // If we do get an existing symbol, see if it conflicts with the new symbol we're
                // creating.  For example, a 'var' symbol and a 'class' symbol will conflict within
                // the same symbol table.  If we have a conflict, report the issue on each
                // declaration we have for this symbol, and then create a new symbol for this
                // declaration.
                //
                // Note that when properties declared in Javascript constructors
                // (marked by isReplaceableByMethod) conflict with another symbol, the property loses.
                // Always. This allows the common Javascript pattern of overwriting a prototype method
                // with an bound instance method of the same type: `this.method = this.method.bind(this)`
                //
                // If we created a new symbol, either because we didn't have a symbol with this name
                // in the symbol table, or we conflicted with an existing symbol, then just add this
                // node as the sole declaration of the new symbol.
                //
                // Otherwise, we'll be merging into a compatible existing symbol (for example when
                // you have multiple 'vars' with the same name in the same container).  In this case
                // just add this node into the declarations list of the symbol.
                symbol = symbolTable.get(name);
                if (includes & ts.SymbolFlags.Classifiable) {
                    classifiableNames.set(name, true);
                }
                if (!symbol) {
                    symbolTable.set(name, symbol = createSymbol(ts.SymbolFlags.None, name));
                    if (isReplaceableByMethod)
                        symbol.isReplaceableByMethod = true;
                }
                else if (isReplaceableByMethod && !symbol.isReplaceableByMethod) {
                    // A symbol already exists, so don't add this as a declaration.
                    return symbol;
                }
                else if (symbol.flags & excludes) {
                    if (symbol.isReplaceableByMethod) {
                        // Javascript constructor-declared symbols can be discarded in favor of
                        // prototype symbols like methods.
                        symbolTable.set(name, symbol = createSymbol(ts.SymbolFlags.None, name));
                    }
                    else {
                        if (ts.isNamedDeclaration(node)) {
                            node.name.parent = node;
                        }
                        // Report errors every position with duplicate declaration
                        // Report errors on previous encountered declarations
                        let message = symbol.flags & ts.SymbolFlags.BlockScopedVariable
                            ? Diagnostics.Cannot_redeclare_block_scoped_variable_0
                            : Diagnostics.Duplicate_identifier_0;
                        if (symbol.flags & ts.SymbolFlags.Enum || includes & ts.SymbolFlags.Enum) {
                            message = Diagnostics.Enum_declarations_can_only_merge_with_namespace_or_other_enum_declarations;
                        }
                        if (symbol.declarations && symbol.declarations.length) {
                            // If the current node is a default export of some sort, then check if
                            // there are any other default exports that we need to error on.
                            // We'll know whether we have other default exports depending on if `symbol` already has a declaration list set.
                            if (isDefaultExport) {
                                message = Diagnostics.A_module_cannot_have_multiple_default_exports;
                            }
                            else {
                                // This is to properly report an error in the case "export default { }" is after export default of class declaration or function declaration.
                                // Error on multiple export default in the following case:
                                // 1. multiple export default of class declaration or function declaration by checking NodeFlags.Default
                                // 2. multiple export default of export assignment. This one doesn't have NodeFlags.Default on (as export default doesn't considered as modifiers)
                                if (symbol.declarations && symbol.declarations.length &&
                                    (node.kind === ts.SyntaxKind.ExportAssignment && !node.isExportEquals)) {
                                    message = Diagnostics.A_module_cannot_have_multiple_default_exports;
                                }
                            }
                        }
                        ts.forEach(symbol.declarations, declaration => {
                            file.bindDiagnostics.push(createDiagnosticForNode(ts.getNameOfDeclaration(declaration) || declaration, message, getDisplayName(declaration)));
                        });
                        file.bindDiagnostics.push(createDiagnosticForNode(ts.getNameOfDeclaration(node) || node, message, getDisplayName(node)));
                        symbol = createSymbol(ts.SymbolFlags.None, name);
                    }
                }
            }
            addDeclarationToSymbol(symbol, node, includes);
            if (symbol.parent) {
                ts.Debug.assert(symbol.parent === parent, "Existing symbol parent should match new one");
            }
            else {
                symbol.parent = parent;
            }
            return symbol;
        }
        function declareModuleMember(node, symbolFlags, symbolExcludes) {
            const hasExportModifier = ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export;
            if (symbolFlags & ts.SymbolFlags.Alias) {
                if (node.kind === ts.SyntaxKind.ExportSpecifier || (node.kind === ts.SyntaxKind.ImportEqualsDeclaration && hasExportModifier)) {
                    return declareSymbol(container.symbol.exports, container.symbol, node, symbolFlags, symbolExcludes);
                }
                else {
                    return declareSymbol(container.locals, /*parent*/ undefined, node, symbolFlags, symbolExcludes);
                }
            }
            else {
                // Exported module members are given 2 symbols: A local symbol that is classified with an ExportValue flag,
                // and an associated export symbol with all the correct flags set on it. There are 2 main reasons:
                //
                //   1. We treat locals and exports of the same name as mutually exclusive within a container.
                //      That means the binder will issue a Duplicate Identifier error if you mix locals and exports
                //      with the same name in the same container.
                //      TODO: Make this a more specific error and decouple it from the exclusion logic.
                //   2. When we checkIdentifier in the checker, we set its resolved symbol to the local symbol,
                //      but return the export symbol (by calling getExportSymbolOfValueSymbolIfExported). That way
                //      when the emitter comes back to it, it knows not to qualify the name if it was found in a containing scope.
                // NOTE: Nested ambient modules always should go to to 'locals' table to prevent their automatic merge
                //       during global merging in the checker. Why? The only case when ambient module is permitted inside another module is module augmentation
                //       and this case is specially handled. Module augmentations should only be merged with original module definition
                //       and should never be merged directly with other augmentation, and the latter case would be possible if automatic merge is allowed.
                if (node.kind === ts.SyntaxKind.JSDocTypedefTag)
                    ts.Debug.assert(ts.isInJavaScriptFile(node)); // We shouldn't add symbols for JSDoc nodes if not in a JS file.
                const isJSDocTypedefInJSDocNamespace = ts.isJSDocTypedefTag(node) && node.name && node.name.kind === ts.SyntaxKind.Identifier && node.name.isInJSDocNamespace;
                if ((!ts.isAmbientModule(node) && (hasExportModifier || container.flags & ts.NodeFlags.ExportContext)) || isJSDocTypedefInJSDocNamespace) {
                    if (ts.hasModifier(node, ts.ModifierFlags.Default) && !getDeclarationName(node)) {
                        return declareSymbol(container.symbol.exports, container.symbol, node, symbolFlags, symbolExcludes); // No local symbol for an unnamed default!
                    }
                    const exportKind = symbolFlags & ts.SymbolFlags.Value ? ts.SymbolFlags.ExportValue : 0;
                    const local = declareSymbol(container.locals, /*parent*/ undefined, node, exportKind, symbolExcludes);
                    local.exportSymbol = declareSymbol(container.symbol.exports, container.symbol, node, symbolFlags, symbolExcludes);
                    node.localSymbol = local;
                    return local;
                }
                else {
                    return declareSymbol(container.locals, /*parent*/ undefined, node, symbolFlags, symbolExcludes);
                }
            }
        }
        // All container nodes are kept on a linked list in declaration order. This list is used by
        // the getLocalNameOfContainer function in the type checker to validate that the local name
        // used for a container is unique.
        function bindContainer(node, containerFlags) {
            // Before we recurse into a node's children, we first save the existing parent, container
            // and block-container.  Then after we pop out of processing the children, we restore
            // these saved values.
            const saveContainer = container;
            const saveThisParentContainer = thisParentContainer;
            const savedBlockScopeContainer = blockScopeContainer;
            // Depending on what kind of node this is, we may have to adjust the current container
            // and block-container.   If the current node is a container, then it is automatically
            // considered the current block-container as well.  Also, for containers that we know
            // may contain locals, we eagerly initialize the .locals field. We do this because
            // it's highly likely that the .locals will be needed to place some child in (for example,
            // a parameter, or variable declaration).
            //
            // However, we do not proactively create the .locals for block-containers because it's
            // totally normal and common for block-containers to never actually have a block-scoped
            // variable in them.  We don't want to end up allocating an object for every 'block' we
            // run into when most of them won't be necessary.
            //
            // Finally, if this is a block-container, then we clear out any existing .locals object
            // it may contain within it.  This happens in incremental scenarios.  Because we can be
            // reusing a node from a previous compilation, that node may have had 'locals' created
            // for it.  We must clear this so we don't accidentally move any stale data forward from
            // a previous compilation.
            if (containerFlags & 1 /* IsContainer */) {
                if (node.kind !== ts.SyntaxKind.ArrowFunction) {
                    thisParentContainer = container;
                }
                container = blockScopeContainer = node;
                if (containerFlags & 32 /* HasLocals */) {
                    container.locals = ts.createSymbolTable();
                }
                addToContainerChain(container);
            }
            else if (containerFlags & 2 /* IsBlockScopedContainer */) {
                blockScopeContainer = node;
                blockScopeContainer.locals = undefined;
            }
            if (containerFlags & 4 /* IsControlFlowContainer */) {
                const saveCurrentFlow = currentFlow;
                const saveBreakTarget = currentBreakTarget;
                const saveContinueTarget = currentContinueTarget;
                const saveReturnTarget = currentReturnTarget;
                const saveActiveLabels = activeLabels;
                const saveHasExplicitReturn = hasExplicitReturn;
                const isIIFE = containerFlags & 16 /* IsFunctionExpression */ && !ts.hasModifier(node, ts.ModifierFlags.Async) &&
                    !node.asteriskToken && !!ts.getImmediatelyInvokedFunctionExpression(node);
                // A non-async, non-generator IIFE is considered part of the containing control flow. Return statements behave
                // similarly to break statements that exit to a label just past the statement body.
                if (!isIIFE) {
                    currentFlow = { flags: ts.FlowFlags.Start };
                    if (containerFlags & (16 /* IsFunctionExpression */ | 128 /* IsObjectLiteralOrClassExpressionMethod */)) {
                        currentFlow.container = node;
                    }
                }
                // We create a return control flow graph for IIFEs and constructors. For constructors
                // we use the return control flow graph in strict property intialization checks.
                currentReturnTarget = isIIFE || node.kind === ts.SyntaxKind.Constructor ? createBranchLabel() : undefined;
                currentBreakTarget = undefined;
                currentContinueTarget = undefined;
                activeLabels = undefined;
                hasExplicitReturn = false;
                bindChildren(node);
                // Reset all reachability check related flags on node (for incremental scenarios)
                node.flags &= ~ts.NodeFlags.ReachabilityAndEmitFlags;
                if (!(currentFlow.flags & ts.FlowFlags.Unreachable) && containerFlags & 8 /* IsFunctionLike */ && ts.nodeIsPresent(node.body)) {
                    node.flags |= ts.NodeFlags.HasImplicitReturn;
                    if (hasExplicitReturn)
                        node.flags |= ts.NodeFlags.HasExplicitReturn;
                }
                if (node.kind === ts.SyntaxKind.SourceFile) {
                    node.flags |= emitFlags;
                }
                if (currentReturnTarget) {
                    addAntecedent(currentReturnTarget, currentFlow);
                    currentFlow = finishFlowLabel(currentReturnTarget);
                    if (node.kind === ts.SyntaxKind.Constructor) {
                        node.returnFlowNode = currentFlow;
                    }
                }
                if (!isIIFE) {
                    currentFlow = saveCurrentFlow;
                }
                currentBreakTarget = saveBreakTarget;
                currentContinueTarget = saveContinueTarget;
                currentReturnTarget = saveReturnTarget;
                activeLabels = saveActiveLabels;
                hasExplicitReturn = saveHasExplicitReturn;
            }
            else if (containerFlags & 64 /* IsInterface */) {
                seenThisKeyword = false;
                bindChildren(node);
                node.flags = seenThisKeyword ? node.flags | ts.NodeFlags.ContainsThis : node.flags & ~ts.NodeFlags.ContainsThis;
            }
            else {
                bindChildren(node);
            }
            container = saveContainer;
            thisParentContainer = saveThisParentContainer;
            blockScopeContainer = savedBlockScopeContainer;
        }
        function bindChildren(node) {
            if (skipTransformFlagAggregation) {
                bindChildrenWorker(node);
            }
            else if (node.transformFlags & 536870912 /* HasComputedFlags */) {
                skipTransformFlagAggregation = true;
                bindChildrenWorker(node);
                skipTransformFlagAggregation = false;
                subtreeTransformFlags |= node.transformFlags & ~getTransformFlagsSubtreeExclusions(node.kind);
            }
            else {
                const savedSubtreeTransformFlags = subtreeTransformFlags;
                subtreeTransformFlags = 0;
                bindChildrenWorker(node);
                subtreeTransformFlags = savedSubtreeTransformFlags | computeTransformFlagsForNode(node, subtreeTransformFlags);
            }
        }
        function bindEachFunctionsFirst(nodes) {
            bindEach(nodes, n => n.kind === ts.SyntaxKind.FunctionDeclaration ? bind(n) : undefined);
            bindEach(nodes, n => n.kind !== ts.SyntaxKind.FunctionDeclaration ? bind(n) : undefined);
        }
        function bindEach(nodes, bindFunction = bind) {
            if (nodes === undefined) {
                return;
            }
            if (skipTransformFlagAggregation) {
                ts.forEach(nodes, bindFunction);
            }
            else {
                const savedSubtreeTransformFlags = subtreeTransformFlags;
                subtreeTransformFlags = 0 /* None */;
                let nodeArrayFlags = 0 /* None */;
                for (const node of nodes) {
                    bindFunction(node);
                    nodeArrayFlags |= node.transformFlags & ~536870912 /* HasComputedFlags */;
                }
                nodes.transformFlags = nodeArrayFlags | 536870912 /* HasComputedFlags */;
                subtreeTransformFlags |= savedSubtreeTransformFlags;
            }
        }
        function bindEachChild(node) {
            ts.forEachChild(node, bind, bindEach);
        }
        function bindChildrenWorker(node) {
            // Binding of JsDocComment should be done before the current block scope container changes.
            // because the scope of JsDocComment should not be affected by whether the current node is a
            // container or not.
            if (ts.hasJSDocNodes(node)) {
                if (ts.isInJavaScriptFile(node)) {
                    for (const j of node.jsDoc) {
                        bind(j);
                    }
                }
                else {
                    for (const j of node.jsDoc) {
                        setParentPointers(node, j);
                    }
                }
            }
            if (checkUnreachable(node)) {
                bindEachChild(node);
                return;
            }
            switch (node.kind) {
                case ts.SyntaxKind.WhileStatement:
                    bindWhileStatement(node);
                    break;
                case ts.SyntaxKind.DoStatement:
                    bindDoStatement(node);
                    break;
                case ts.SyntaxKind.ForStatement:
                    bindForStatement(node);
                    break;
                case ts.SyntaxKind.ForInStatement:
                case ts.SyntaxKind.ForOfStatement:
                    bindForInOrForOfStatement(node);
                    break;
                case ts.SyntaxKind.IfStatement:
                    bindIfStatement(node);
                    break;
                case ts.SyntaxKind.ReturnStatement:
                case ts.SyntaxKind.ThrowStatement:
                    bindReturnOrThrow(node);
                    break;
                case ts.SyntaxKind.BreakStatement:
                case ts.SyntaxKind.ContinueStatement:
                    bindBreakOrContinueStatement(node);
                    break;
                case ts.SyntaxKind.TryStatement:
                    bindTryStatement(node);
                    break;
                case ts.SyntaxKind.SwitchStatement:
                    bindSwitchStatement(node);
                    break;
                case ts.SyntaxKind.CaseBlock:
                    bindCaseBlock(node);
                    break;
                case ts.SyntaxKind.CaseClause:
                    bindCaseClause(node);
                    break;
                case ts.SyntaxKind.LabeledStatement:
                    bindLabeledStatement(node);
                    break;
                case ts.SyntaxKind.PrefixUnaryExpression:
                    bindPrefixUnaryExpressionFlow(node);
                    break;
                case ts.SyntaxKind.PostfixUnaryExpression:
                    bindPostfixUnaryExpressionFlow(node);
                    break;
                case ts.SyntaxKind.BinaryExpression:
                    bindBinaryExpressionFlow(node);
                    break;
                case ts.SyntaxKind.DeleteExpression:
                    bindDeleteExpressionFlow(node);
                    break;
                case ts.SyntaxKind.ConditionalExpression:
                    bindConditionalExpressionFlow(node);
                    break;
                case ts.SyntaxKind.VariableDeclaration:
                    bindVariableDeclarationFlow(node);
                    break;
                case ts.SyntaxKind.CallExpression:
                    bindCallExpressionFlow(node);
                    break;
                case ts.SyntaxKind.JSDocComment:
                    bindJSDocComment(node);
                    break;
                case ts.SyntaxKind.JSDocTypedefTag:
                    bindJSDocTypedefTag(node);
                    break;
                // In source files and blocks, bind functions first to match hoisting that occurs at runtime
                case ts.SyntaxKind.SourceFile:
                    bindEachFunctionsFirst(node.statements);
                    bind(node.endOfFileToken);
                    break;
                case ts.SyntaxKind.Block:
                case ts.SyntaxKind.ModuleBlock:
                    bindEachFunctionsFirst(node.statements);
                    break;
                default:
                    bindEachChild(node);
                    break;
            }
        }
        function isNarrowingExpression(expr) {
            switch (expr.kind) {
                case ts.SyntaxKind.Identifier:
                case ts.SyntaxKind.ThisKeyword:
                case ts.SyntaxKind.PropertyAccessExpression:
                    return isNarrowableReference(expr);
                case ts.SyntaxKind.CallExpression:
                    return hasNarrowableArgument(expr);
                case ts.SyntaxKind.ParenthesizedExpression:
                    return isNarrowingExpression(expr.expression);
                case ts.SyntaxKind.BinaryExpression:
                    return isNarrowingBinaryExpression(expr);
                case ts.SyntaxKind.PrefixUnaryExpression:
                    return expr.operator === ts.SyntaxKind.ExclamationToken && isNarrowingExpression(expr.operand);
            }
            return false;
        }
        function isNarrowableReference(expr) {
            return expr.kind === ts.SyntaxKind.Identifier ||
                expr.kind === ts.SyntaxKind.ThisKeyword ||
                expr.kind === ts.SyntaxKind.SuperKeyword ||
                expr.kind === ts.SyntaxKind.PropertyAccessExpression && isNarrowableReference(expr.expression);
        }
        function hasNarrowableArgument(expr) {
            if (expr.arguments) {
                for (const argument of expr.arguments) {
                    if (isNarrowableReference(argument)) {
                        return true;
                    }
                }
            }
            if (expr.expression.kind === ts.SyntaxKind.PropertyAccessExpression &&
                isNarrowableReference(expr.expression.expression)) {
                return true;
            }
            return false;
        }
        function isNarrowingTypeofOperands(expr1, expr2) {
            return ts.isTypeOfExpression(expr1) && isNarrowableOperand(expr1.expression) && ts.isStringLiteralLike(expr2);
        }
        function isNarrowableInOperands(left, right) {
            return ts.isStringLiteralLike(left) && isNarrowingExpression(right);
        }
        function isNarrowingBinaryExpression(expr) {
            switch (expr.operatorToken.kind) {
                case ts.SyntaxKind.EqualsToken:
                    return isNarrowableReference(expr.left);
                case ts.SyntaxKind.EqualsEqualsToken:
                case ts.SyntaxKind.ExclamationEqualsToken:
                case ts.SyntaxKind.EqualsEqualsEqualsToken:
                case ts.SyntaxKind.ExclamationEqualsEqualsToken:
                    return isNarrowableOperand(expr.left) || isNarrowableOperand(expr.right) ||
                        isNarrowingTypeofOperands(expr.right, expr.left) || isNarrowingTypeofOperands(expr.left, expr.right);
                case ts.SyntaxKind.InstanceOfKeyword:
                    return isNarrowableOperand(expr.left);
                case ts.SyntaxKind.InKeyword:
                    return isNarrowableInOperands(expr.left, expr.right);
                case ts.SyntaxKind.CommaToken:
                    return isNarrowingExpression(expr.right);
            }
            return false;
        }
        function isNarrowableOperand(expr) {
            switch (expr.kind) {
                case ts.SyntaxKind.ParenthesizedExpression:
                    return isNarrowableOperand(expr.expression);
                case ts.SyntaxKind.BinaryExpression:
                    switch (expr.operatorToken.kind) {
                        case ts.SyntaxKind.EqualsToken:
                            return isNarrowableOperand(expr.left);
                        case ts.SyntaxKind.CommaToken:
                            return isNarrowableOperand(expr.right);
                    }
            }
            return isNarrowableReference(expr);
        }
        function createBranchLabel() {
            return {
                flags: ts.FlowFlags.BranchLabel,
                antecedents: undefined
            };
        }
        function createLoopLabel() {
            return {
                flags: ts.FlowFlags.LoopLabel,
                antecedents: undefined
            };
        }
        function setFlowNodeReferenced(flow) {
            // On first reference we set the Referenced flag, thereafter we set the Shared flag
            flow.flags |= flow.flags & ts.FlowFlags.Referenced ? ts.FlowFlags.Shared : ts.FlowFlags.Referenced;
        }
        function addAntecedent(label, antecedent) {
            if (!(antecedent.flags & ts.FlowFlags.Unreachable) && !ts.contains(label.antecedents, antecedent)) {
                (label.antecedents || (label.antecedents = [])).push(antecedent);
                setFlowNodeReferenced(antecedent);
            }
        }
        function createFlowCondition(flags, antecedent, expression) {
            if (antecedent.flags & ts.FlowFlags.Unreachable) {
                return antecedent;
            }
            if (!expression) {
                return flags & ts.FlowFlags.TrueCondition ? antecedent : unreachableFlow;
            }
            if (expression.kind === ts.SyntaxKind.TrueKeyword && flags & ts.FlowFlags.FalseCondition ||
                expression.kind === ts.SyntaxKind.FalseKeyword && flags & ts.FlowFlags.TrueCondition) {
                return unreachableFlow;
            }
            if (!isNarrowingExpression(expression)) {
                return antecedent;
            }
            setFlowNodeReferenced(antecedent);
            return { flags, expression, antecedent };
        }
        function createFlowSwitchClause(antecedent, switchStatement, clauseStart, clauseEnd) {
            if (!isNarrowingExpression(switchStatement.expression)) {
                return antecedent;
            }
            setFlowNodeReferenced(antecedent);
            return { flags: ts.FlowFlags.SwitchClause, switchStatement, clauseStart, clauseEnd, antecedent };
        }
        function createFlowAssignment(antecedent, node) {
            setFlowNodeReferenced(antecedent);
            return { flags: ts.FlowFlags.Assignment, antecedent, node };
        }
        function createFlowArrayMutation(antecedent, node) {
            setFlowNodeReferenced(antecedent);
            const res = { flags: ts.FlowFlags.ArrayMutation, antecedent, node };
            return res;
        }
        function finishFlowLabel(flow) {
            const antecedents = flow.antecedents;
            if (!antecedents) {
                return unreachableFlow;
            }
            if (antecedents.length === 1) {
                return antecedents[0];
            }
            return flow;
        }
        function isStatementCondition(node) {
            const parent = node.parent;
            switch (parent.kind) {
                case ts.SyntaxKind.IfStatement:
                case ts.SyntaxKind.WhileStatement:
                case ts.SyntaxKind.DoStatement:
                    return parent.expression === node;
                case ts.SyntaxKind.ForStatement:
                case ts.SyntaxKind.ConditionalExpression:
                    return parent.condition === node;
            }
            return false;
        }
        function isLogicalExpression(node) {
            while (true) {
                if (node.kind === ts.SyntaxKind.ParenthesizedExpression) {
                    node = node.expression;
                }
                else if (node.kind === ts.SyntaxKind.PrefixUnaryExpression && node.operator === ts.SyntaxKind.ExclamationToken) {
                    node = node.operand;
                }
                else {
                    return node.kind === ts.SyntaxKind.BinaryExpression && (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
                        node.operatorToken.kind === ts.SyntaxKind.BarBarToken);
                }
            }
        }
        function isTopLevelLogicalExpression(node) {
            while (node.parent.kind === ts.SyntaxKind.ParenthesizedExpression ||
                node.parent.kind === ts.SyntaxKind.PrefixUnaryExpression &&
                    node.parent.operator === ts.SyntaxKind.ExclamationToken) {
                node = node.parent;
            }
            return !isStatementCondition(node) && !isLogicalExpression(node.parent);
        }
        function bindCondition(node, trueTarget, falseTarget) {
            const saveTrueTarget = currentTrueTarget;
            const saveFalseTarget = currentFalseTarget;
            currentTrueTarget = trueTarget;
            currentFalseTarget = falseTarget;
            bind(node);
            currentTrueTarget = saveTrueTarget;
            currentFalseTarget = saveFalseTarget;
            if (!node || !isLogicalExpression(node)) {
                addAntecedent(trueTarget, createFlowCondition(ts.FlowFlags.TrueCondition, currentFlow, node));
                addAntecedent(falseTarget, createFlowCondition(ts.FlowFlags.FalseCondition, currentFlow, node));
            }
        }
        function bindIterativeStatement(node, breakTarget, continueTarget) {
            const saveBreakTarget = currentBreakTarget;
            const saveContinueTarget = currentContinueTarget;
            currentBreakTarget = breakTarget;
            currentContinueTarget = continueTarget;
            bind(node);
            currentBreakTarget = saveBreakTarget;
            currentContinueTarget = saveContinueTarget;
        }
        function bindWhileStatement(node) {
            const preWhileLabel = createLoopLabel();
            const preBodyLabel = createBranchLabel();
            const postWhileLabel = createBranchLabel();
            addAntecedent(preWhileLabel, currentFlow);
            currentFlow = preWhileLabel;
            bindCondition(node.expression, preBodyLabel, postWhileLabel);
            currentFlow = finishFlowLabel(preBodyLabel);
            bindIterativeStatement(node.statement, postWhileLabel, preWhileLabel);
            addAntecedent(preWhileLabel, currentFlow);
            currentFlow = finishFlowLabel(postWhileLabel);
        }
        function bindDoStatement(node) {
            const preDoLabel = createLoopLabel();
            const enclosingLabeledStatement = node.parent.kind === ts.SyntaxKind.LabeledStatement
                ? ts.lastOrUndefined(activeLabels)
                : undefined;
            // if do statement is wrapped in labeled statement then target labels for break/continue with or without
            // label should be the same
            const preConditionLabel = enclosingLabeledStatement ? enclosingLabeledStatement.continueTarget : createBranchLabel();
            const postDoLabel = enclosingLabeledStatement ? enclosingLabeledStatement.breakTarget : createBranchLabel();
            addAntecedent(preDoLabel, currentFlow);
            currentFlow = preDoLabel;
            bindIterativeStatement(node.statement, postDoLabel, preConditionLabel);
            addAntecedent(preConditionLabel, currentFlow);
            currentFlow = finishFlowLabel(preConditionLabel);
            bindCondition(node.expression, preDoLabel, postDoLabel);
            currentFlow = finishFlowLabel(postDoLabel);
        }
        function bindForStatement(node) {
            const preLoopLabel = createLoopLabel();
            const preBodyLabel = createBranchLabel();
            const postLoopLabel = createBranchLabel();
            bind(node.initializer);
            addAntecedent(preLoopLabel, currentFlow);
            currentFlow = preLoopLabel;
            bindCondition(node.condition, preBodyLabel, postLoopLabel);
            currentFlow = finishFlowLabel(preBodyLabel);
            bindIterativeStatement(node.statement, postLoopLabel, preLoopLabel);
            bind(node.incrementor);
            addAntecedent(preLoopLabel, currentFlow);
            currentFlow = finishFlowLabel(postLoopLabel);
        }
        function bindForInOrForOfStatement(node) {
            const preLoopLabel = createLoopLabel();
            const postLoopLabel = createBranchLabel();
            addAntecedent(preLoopLabel, currentFlow);
            currentFlow = preLoopLabel;
            if (node.kind === ts.SyntaxKind.ForOfStatement) {
                bind(node.awaitModifier);
            }
            bind(node.expression);
            addAntecedent(postLoopLabel, currentFlow);
            bind(node.initializer);
            if (node.initializer.kind !== ts.SyntaxKind.VariableDeclarationList) {
                bindAssignmentTargetFlow(node.initializer);
            }
            bindIterativeStatement(node.statement, postLoopLabel, preLoopLabel);
            addAntecedent(preLoopLabel, currentFlow);
            currentFlow = finishFlowLabel(postLoopLabel);
        }
        function bindIfStatement(node) {
            const thenLabel = createBranchLabel();
            const elseLabel = createBranchLabel();
            const postIfLabel = createBranchLabel();
            bindCondition(node.expression, thenLabel, elseLabel);
            currentFlow = finishFlowLabel(thenLabel);
            bind(node.thenStatement);
            addAntecedent(postIfLabel, currentFlow);
            currentFlow = finishFlowLabel(elseLabel);
            bind(node.elseStatement);
            addAntecedent(postIfLabel, currentFlow);
            currentFlow = finishFlowLabel(postIfLabel);
        }
        function bindReturnOrThrow(node) {
            bind(node.expression);
            if (node.kind === ts.SyntaxKind.ReturnStatement) {
                hasExplicitReturn = true;
                if (currentReturnTarget) {
                    addAntecedent(currentReturnTarget, currentFlow);
                }
            }
            currentFlow = unreachableFlow;
        }
        function findActiveLabel(name) {
            if (activeLabels) {
                for (const label of activeLabels) {
                    if (label.name === name) {
                        return label;
                    }
                }
            }
            return undefined;
        }
        function bindBreakOrContinueFlow(node, breakTarget, continueTarget) {
            const flowLabel = node.kind === ts.SyntaxKind.BreakStatement ? breakTarget : continueTarget;
            if (flowLabel) {
                addAntecedent(flowLabel, currentFlow);
                currentFlow = unreachableFlow;
            }
        }
        function bindBreakOrContinueStatement(node) {
            bind(node.label);
            if (node.label) {
                const activeLabel = findActiveLabel(node.label.escapedText);
                if (activeLabel) {
                    activeLabel.referenced = true;
                    bindBreakOrContinueFlow(node, activeLabel.breakTarget, activeLabel.continueTarget);
                }
            }
            else {
                bindBreakOrContinueFlow(node, currentBreakTarget, currentContinueTarget);
            }
        }
        function bindTryStatement(node) {
            const preFinallyLabel = createBranchLabel();
            const preTryFlow = currentFlow;
            // TODO: Every statement in try block is potentially an exit point!
            bind(node.tryBlock);
            addAntecedent(preFinallyLabel, currentFlow);
            const flowAfterTry = currentFlow;
            let flowAfterCatch = unreachableFlow;
            if (node.catchClause) {
                currentFlow = preTryFlow;
                bind(node.catchClause);
                addAntecedent(preFinallyLabel, currentFlow);
                flowAfterCatch = currentFlow;
            }
            if (node.finallyBlock) {
                // in finally flow is combined from pre-try/flow from try/flow from catch
                // pre-flow is necessary to make sure that finally is reachable even if finally flows in both try and finally blocks are unreachable
                // also for finally blocks we inject two extra edges into the flow graph.
                // first -> edge that connects pre-try flow with the label at the beginning of the finally block, it has lock associated with it
                // second -> edge that represents post-finally flow.
                // these edges are used in following scenario:
                // let a; (1)
                // try { a = someOperation(); (2)}
                // finally { (3) console.log(a) } (4)
                // (5) a
                // flow graph for this case looks roughly like this (arrows show ):
                // (1-pre-try-flow) <--.. <-- (2-post-try-flow)
                //  ^                                ^
                //  |*****(3-pre-finally-label) -----|
                //                ^
                //                |-- ... <-- (4-post-finally-label) <--- (5)
                // In case when we walk the flow starting from inside the finally block we want to take edge '*****' into account
                // since it ensures that finally is always reachable. However when we start outside the finally block and go through label (5)
                // then edge '*****' should be discarded because label 4 is only reachable if post-finally label-4 is reachable
                // Simply speaking code inside finally block is treated as reachable as pre-try-flow
                // since we conservatively assume that any line in try block can throw or return in which case we'll enter finally.
                // However code after finally is reachable only if control flow was not abrupted in try/catch or finally blocks - it should be composed from
                // final flows of these blocks without taking pre-try flow into account.
                //
                // extra edges that we inject allows to control this behavior
                // if when walking the flow we step on post-finally edge - we can mark matching pre-finally edge as locked so it will be skipped.
                const preFinallyFlow = { flags: ts.FlowFlags.PreFinally, antecedent: preTryFlow, lock: {} };
                addAntecedent(preFinallyLabel, preFinallyFlow);
                currentFlow = finishFlowLabel(preFinallyLabel);
                bind(node.finallyBlock);
                // if flow after finally is unreachable - keep it
                // otherwise check if flows after try and after catch are unreachable
                // if yes - convert current flow to unreachable
                // i.e.
                // try { return "1" } finally { console.log(1); }
                // console.log(2); // this line should be unreachable even if flow falls out of finally block
                if (!(currentFlow.flags & ts.FlowFlags.Unreachable)) {
                    if ((flowAfterTry.flags & ts.FlowFlags.Unreachable) && (flowAfterCatch.flags & ts.FlowFlags.Unreachable)) {
                        currentFlow = flowAfterTry === reportedUnreachableFlow || flowAfterCatch === reportedUnreachableFlow
                            ? reportedUnreachableFlow
                            : unreachableFlow;
                    }
                }
                if (!(currentFlow.flags & ts.FlowFlags.Unreachable)) {
                    const afterFinallyFlow = { flags: ts.FlowFlags.AfterFinally, antecedent: currentFlow };
                    preFinallyFlow.lock = afterFinallyFlow;
                    currentFlow = afterFinallyFlow;
                }
            }
            else {
                currentFlow = finishFlowLabel(preFinallyLabel);
            }
        }
        function bindSwitchStatement(node) {
            const postSwitchLabel = createBranchLabel();
            bind(node.expression);
            const saveBreakTarget = currentBreakTarget;
            const savePreSwitchCaseFlow = preSwitchCaseFlow;
            currentBreakTarget = postSwitchLabel;
            preSwitchCaseFlow = currentFlow;
            bind(node.caseBlock);
            addAntecedent(postSwitchLabel, currentFlow);
            const hasDefault = ts.forEach(node.caseBlock.clauses, c => c.kind === ts.SyntaxKind.DefaultClause);
            // We mark a switch statement as possibly exhaustive if it has no default clause and if all
            // case clauses have unreachable end points (e.g. they all return).
            node.possiblyExhaustive = !hasDefault && !postSwitchLabel.antecedents;
            if (!hasDefault) {
                addAntecedent(postSwitchLabel, createFlowSwitchClause(preSwitchCaseFlow, node, 0, 0));
            }
            currentBreakTarget = saveBreakTarget;
            preSwitchCaseFlow = savePreSwitchCaseFlow;
            currentFlow = finishFlowLabel(postSwitchLabel);
        }
        function bindCaseBlock(node) {
            const savedSubtreeTransformFlags = subtreeTransformFlags;
            subtreeTransformFlags = 0;
            const clauses = node.clauses;
            let fallthroughFlow = unreachableFlow;
            for (let i = 0; i < clauses.length; i++) {
                const clauseStart = i;
                while (!clauses[i].statements.length && i + 1 < clauses.length) {
                    bind(clauses[i]);
                    i++;
                }
                const preCaseLabel = createBranchLabel();
                addAntecedent(preCaseLabel, createFlowSwitchClause(preSwitchCaseFlow, node.parent, clauseStart, i + 1));
                addAntecedent(preCaseLabel, fallthroughFlow);
                currentFlow = finishFlowLabel(preCaseLabel);
                const clause = clauses[i];
                bind(clause);
                fallthroughFlow = currentFlow;
                if (!(currentFlow.flags & ts.FlowFlags.Unreachable) && i !== clauses.length - 1 && options.noFallthroughCasesInSwitch) {
                    errorOnFirstToken(clause, Diagnostics.Fallthrough_case_in_switch);
                }
            }
            clauses.transformFlags = subtreeTransformFlags | 536870912 /* HasComputedFlags */;
            subtreeTransformFlags |= savedSubtreeTransformFlags;
        }
        function bindCaseClause(node) {
            const saveCurrentFlow = currentFlow;
            currentFlow = preSwitchCaseFlow;
            bind(node.expression);
            currentFlow = saveCurrentFlow;
            bindEach(node.statements);
        }
        function pushActiveLabel(name, breakTarget, continueTarget) {
            const activeLabel = {
                name,
                breakTarget,
                continueTarget,
                referenced: false
            };
            (activeLabels || (activeLabels = [])).push(activeLabel);
            return activeLabel;
        }
        function popActiveLabel() {
            activeLabels.pop();
        }
        function bindLabeledStatement(node) {
            const preStatementLabel = createLoopLabel();
            const postStatementLabel = createBranchLabel();
            bind(node.label);
            addAntecedent(preStatementLabel, currentFlow);
            const activeLabel = pushActiveLabel(node.label.escapedText, postStatementLabel, preStatementLabel);
            bind(node.statement);
            popActiveLabel();
            if (!activeLabel.referenced && !options.allowUnusedLabels) {
                file.bindDiagnostics.push(createDiagnosticForNode(node.label, Diagnostics.Unused_label));
            }
            if (!node.statement || node.statement.kind !== ts.SyntaxKind.DoStatement) {
                // do statement sets current flow inside bindDoStatement
                addAntecedent(postStatementLabel, currentFlow);
                currentFlow = finishFlowLabel(postStatementLabel);
            }
        }
        function bindDestructuringTargetFlow(node) {
            if (node.kind === ts.SyntaxKind.BinaryExpression && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
                bindAssignmentTargetFlow(node.left);
            }
            else {
                bindAssignmentTargetFlow(node);
            }
        }
        function bindAssignmentTargetFlow(node) {
            if (isNarrowableReference(node)) {
                currentFlow = createFlowAssignment(currentFlow, node);
            }
            else if (node.kind === ts.SyntaxKind.ArrayLiteralExpression) {
                for (const e of node.elements) {
                    if (e.kind === ts.SyntaxKind.SpreadElement) {
                        bindAssignmentTargetFlow(e.expression);
                    }
                    else {
                        bindDestructuringTargetFlow(e);
                    }
                }
            }
            else if (node.kind === ts.SyntaxKind.ObjectLiteralExpression) {
                for (const p of node.properties) {
                    if (p.kind === ts.SyntaxKind.PropertyAssignment) {
                        bindDestructuringTargetFlow(p.initializer);
                    }
                    else if (p.kind === ts.SyntaxKind.ShorthandPropertyAssignment) {
                        bindAssignmentTargetFlow(p.name);
                    }
                    else if (p.kind === ts.SyntaxKind.SpreadAssignment) {
                        bindAssignmentTargetFlow(p.expression);
                    }
                }
            }
        }
        function bindLogicalExpression(node, trueTarget, falseTarget) {
            const preRightLabel = createBranchLabel();
            if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
                bindCondition(node.left, preRightLabel, falseTarget);
            }
            else {
                bindCondition(node.left, trueTarget, preRightLabel);
            }
            currentFlow = finishFlowLabel(preRightLabel);
            bind(node.operatorToken);
            bindCondition(node.right, trueTarget, falseTarget);
        }
        function bindPrefixUnaryExpressionFlow(node) {
            if (node.operator === ts.SyntaxKind.ExclamationToken) {
                const saveTrueTarget = currentTrueTarget;
                currentTrueTarget = currentFalseTarget;
                currentFalseTarget = saveTrueTarget;
                bindEachChild(node);
                currentFalseTarget = currentTrueTarget;
                currentTrueTarget = saveTrueTarget;
            }
            else {
                bindEachChild(node);
                if (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken) {
                    bindAssignmentTargetFlow(node.operand);
                }
            }
        }
        function bindPostfixUnaryExpressionFlow(node) {
            bindEachChild(node);
            if (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken) {
                bindAssignmentTargetFlow(node.operand);
            }
        }
        function bindBinaryExpressionFlow(node) {
            const operator = node.operatorToken.kind;
            if (operator === ts.SyntaxKind.AmpersandAmpersandToken || operator === ts.SyntaxKind.BarBarToken) {
                if (isTopLevelLogicalExpression(node)) {
                    const postExpressionLabel = createBranchLabel();
                    bindLogicalExpression(node, postExpressionLabel, postExpressionLabel);
                    currentFlow = finishFlowLabel(postExpressionLabel);
                }
                else {
                    bindLogicalExpression(node, currentTrueTarget, currentFalseTarget);
                }
            }
            else {
                bindEachChild(node);
                if (ts.isAssignmentOperator(operator) && !ts.isAssignmentTarget(node)) {
                    bindAssignmentTargetFlow(node.left);
                    if (operator === ts.SyntaxKind.EqualsToken && node.left.kind === ts.SyntaxKind.ElementAccessExpression) {
                        const elementAccess = node.left;
                        if (isNarrowableOperand(elementAccess.expression)) {
                            currentFlow = createFlowArrayMutation(currentFlow, node);
                        }
                    }
                }
            }
        }
        function bindDeleteExpressionFlow(node) {
            bindEachChild(node);
            if (node.expression.kind === ts.SyntaxKind.PropertyAccessExpression) {
                bindAssignmentTargetFlow(node.expression);
            }
        }
        function bindConditionalExpressionFlow(node) {
            const trueLabel = createBranchLabel();
            const falseLabel = createBranchLabel();
            const postExpressionLabel = createBranchLabel();
            bindCondition(node.condition, trueLabel, falseLabel);
            currentFlow = finishFlowLabel(trueLabel);
            bind(node.questionToken);
            bind(node.whenTrue);
            addAntecedent(postExpressionLabel, currentFlow);
            currentFlow = finishFlowLabel(falseLabel);
            bind(node.colonToken);
            bind(node.whenFalse);
            addAntecedent(postExpressionLabel, currentFlow);
            currentFlow = finishFlowLabel(postExpressionLabel);
        }
        function bindInitializedVariableFlow(node) {
            const name = !ts.isOmittedExpression(node) ? node.name : undefined;
            if (ts.isBindingPattern(name)) {
                for (const child of name.elements) {
                    bindInitializedVariableFlow(child);
                }
            }
            else {
                currentFlow = createFlowAssignment(currentFlow, node);
            }
        }
        function bindVariableDeclarationFlow(node) {
            bindEachChild(node);
            if (node.initializer || ts.isForInOrOfStatement(node.parent.parent)) {
                bindInitializedVariableFlow(node);
            }
        }
        function bindJSDocComment(node) {
            ts.forEachChild(node, n => {
                if (n.kind !== ts.SyntaxKind.JSDocTypedefTag) {
                    bind(n);
                }
            });
        }
        function bindJSDocTypedefTag(node) {
            ts.forEachChild(node, n => {
                // if the node has a fullName "A.B.C", that means symbol "C" was already bound
                // when we visit "fullName"; so when we visit the name "C" as the next child of
                // the jsDocTypedefTag, we should skip binding it.
                if (node.fullName && n === node.name && node.fullName.kind !== ts.SyntaxKind.Identifier) {
                    return;
                }
                bind(n);
            });
        }
        function bindCallExpressionFlow(node) {
            // If the target of the call expression is a function expression or arrow function we have
            // an immediately invoked function expression (IIFE). Initialize the flowNode property to
            // the current control flow (which includes evaluation of the IIFE arguments).
            let expr = node.expression;
            while (expr.kind === ts.SyntaxKind.ParenthesizedExpression) {
                expr = expr.expression;
            }
            if (expr.kind === ts.SyntaxKind.FunctionExpression || expr.kind === ts.SyntaxKind.ArrowFunction) {
                bindEach(node.typeArguments);
                bindEach(node.arguments);
                bind(node.expression);
            }
            else {
                bindEachChild(node);
            }
            if (node.expression.kind === ts.SyntaxKind.PropertyAccessExpression) {
                const propertyAccess = node.expression;
                if (isNarrowableOperand(propertyAccess.expression) && ts.isPushOrUnshiftIdentifier(propertyAccess.name)) {
                    currentFlow = createFlowArrayMutation(currentFlow, node);
                }
            }
        }
        function getContainerFlags(node) {
            switch (node.kind) {
                case ts.SyntaxKind.ClassExpression:
                case ts.SyntaxKind.ClassDeclaration:
                case ts.SyntaxKind.EnumDeclaration:
                case ts.SyntaxKind.ObjectLiteralExpression:
                case ts.SyntaxKind.TypeLiteral:
                case ts.SyntaxKind.JSDocTypeLiteral:
                case ts.SyntaxKind.JsxAttributes:
                    return 1 /* IsContainer */;
                case ts.SyntaxKind.InterfaceDeclaration:
                    return 1 /* IsContainer */ | 64 /* IsInterface */;
                case ts.SyntaxKind.ModuleDeclaration:
                case ts.SyntaxKind.TypeAliasDeclaration:
                case ts.SyntaxKind.MappedType:
                    return 1 /* IsContainer */ | 32 /* HasLocals */;
                case ts.SyntaxKind.SourceFile:
                    return 1 /* IsContainer */ | 4 /* IsControlFlowContainer */ | 32 /* HasLocals */;
                case ts.SyntaxKind.MethodDeclaration:
                    if (ts.isObjectLiteralOrClassExpressionMethod(node)) {
                        return 1 /* IsContainer */ | 4 /* IsControlFlowContainer */ | 32 /* HasLocals */ | 8 /* IsFunctionLike */ | 128 /* IsObjectLiteralOrClassExpressionMethod */;
                    }
                // falls through
                case ts.SyntaxKind.Constructor:
                case ts.SyntaxKind.FunctionDeclaration:
                case ts.SyntaxKind.MethodSignature:
                case ts.SyntaxKind.GetAccessor:
                case ts.SyntaxKind.SetAccessor:
                case ts.SyntaxKind.CallSignature:
                case ts.SyntaxKind.JSDocFunctionType:
                case ts.SyntaxKind.FunctionType:
                case ts.SyntaxKind.ConstructSignature:
                case ts.SyntaxKind.IndexSignature:
                case ts.SyntaxKind.ConstructorType:
                    return 1 /* IsContainer */ | 4 /* IsControlFlowContainer */ | 32 /* HasLocals */ | 8 /* IsFunctionLike */;
                case ts.SyntaxKind.FunctionExpression:
                case ts.SyntaxKind.ArrowFunction:
                    return 1 /* IsContainer */ | 4 /* IsControlFlowContainer */ | 32 /* HasLocals */ | 8 /* IsFunctionLike */ | 16 /* IsFunctionExpression */;
                case ts.SyntaxKind.ModuleBlock:
                    return 4 /* IsControlFlowContainer */;
                case ts.SyntaxKind.PropertyDeclaration:
                    return node.initializer ? 4 /* IsControlFlowContainer */ : 0;
                case ts.SyntaxKind.CatchClause:
                case ts.SyntaxKind.ForStatement:
                case ts.SyntaxKind.ForInStatement:
                case ts.SyntaxKind.ForOfStatement:
                case ts.SyntaxKind.CaseBlock:
                    return 2 /* IsBlockScopedContainer */;
                case ts.SyntaxKind.Block:
                    // do not treat blocks directly inside a function as a block-scoped-container.
                    // Locals that reside in this block should go to the function locals. Otherwise 'x'
                    // would not appear to be a redeclaration of a block scoped local in the following
                    // example:
                    //
                    //      function foo() {
                    //          var x;
                    //          let x;
                    //      }
                    //
                    // If we placed 'var x' into the function locals and 'let x' into the locals of
                    // the block, then there would be no collision.
                    //
                    // By not creating a new block-scoped-container here, we ensure that both 'var x'
                    // and 'let x' go into the Function-container's locals, and we do get a collision
                    // conflict.
                    return ts.isFunctionLike(node.parent) ? 0 /* None */ : 2 /* IsBlockScopedContainer */;
            }
            return 0 /* None */;
        }
        function addToContainerChain(next) {
            if (lastContainer) {
                lastContainer.nextContainer = next;
            }
            lastContainer = next;
        }
        function declareSymbolAndAddToSymbolTable(node, symbolFlags, symbolExcludes) {
            switch (container.kind) {
                // Modules, source files, and classes need specialized handling for how their
                // members are declared (for example, a member of a class will go into a specific
                // symbol table depending on if it is static or not). We defer to specialized
                // handlers to take care of declaring these child members.
                case ts.SyntaxKind.ModuleDeclaration:
                    return declareModuleMember(node, symbolFlags, symbolExcludes);
                case ts.SyntaxKind.SourceFile:
                    return declareSourceFileMember(node, symbolFlags, symbolExcludes);
                case ts.SyntaxKind.ClassExpression:
                case ts.SyntaxKind.ClassDeclaration:
                    return declareClassMember(node, symbolFlags, symbolExcludes);
                case ts.SyntaxKind.EnumDeclaration:
                    return declareSymbol(container.symbol.exports, container.symbol, node, symbolFlags, symbolExcludes);
                case ts.SyntaxKind.TypeLiteral:
                case ts.SyntaxKind.JSDocTypeLiteral:
                case ts.SyntaxKind.ObjectLiteralExpression:
                case ts.SyntaxKind.InterfaceDeclaration:
                case ts.SyntaxKind.JsxAttributes:
                    // Interface/Object-types always have their children added to the 'members' of
                    // their container. They are only accessible through an instance of their
                    // container, and are never in scope otherwise (even inside the body of the
                    // object / type / interface declaring them). An exception is type parameters,
                    // which are in scope without qualification (similar to 'locals').
                    return declareSymbol(container.symbol.members, container.symbol, node, symbolFlags, symbolExcludes);
                case ts.SyntaxKind.FunctionType:
                case ts.SyntaxKind.ConstructorType:
                case ts.SyntaxKind.CallSignature:
                case ts.SyntaxKind.ConstructSignature:
                case ts.SyntaxKind.IndexSignature:
                case ts.SyntaxKind.MethodDeclaration:
                case ts.SyntaxKind.MethodSignature:
                case ts.SyntaxKind.Constructor:
                case ts.SyntaxKind.GetAccessor:
                case ts.SyntaxKind.SetAccessor:
                case ts.SyntaxKind.FunctionDeclaration:
                case ts.SyntaxKind.FunctionExpression:
                case ts.SyntaxKind.ArrowFunction:
                case ts.SyntaxKind.JSDocFunctionType:
                case ts.SyntaxKind.TypeAliasDeclaration:
                case ts.SyntaxKind.MappedType:
                    // All the children of these container types are never visible through another
                    // symbol (i.e. through another symbol's 'exports' or 'members').  Instead,
                    // they're only accessed 'lexically' (i.e. from code that exists underneath
                    // their container in the tree). To accomplish this, we simply add their declared
                    // symbol to the 'locals' of the container.  These symbols can then be found as
                    // the type checker walks up the containers, checking them for matching names.
                    return declareSymbol(container.locals, /*parent*/ undefined, node, symbolFlags, symbolExcludes);
            }
        }
        function declareClassMember(node, symbolFlags, symbolExcludes) {
            return ts.hasModifier(node, ts.ModifierFlags.Static)
                ? declareSymbol(container.symbol.exports, container.symbol, node, symbolFlags, symbolExcludes)
                : declareSymbol(container.symbol.members, container.symbol, node, symbolFlags, symbolExcludes);
        }
        function declareSourceFileMember(node, symbolFlags, symbolExcludes) {
            return ts.isExternalModule(file)
                ? declareModuleMember(node, symbolFlags, symbolExcludes)
                : declareSymbol(file.locals, /*parent*/ undefined, node, symbolFlags, symbolExcludes);
        }
        function hasExportDeclarations(node) {
            const body = node.kind === ts.SyntaxKind.SourceFile ? node : node.body;
            if (body && (body.kind === ts.SyntaxKind.SourceFile || body.kind === ts.SyntaxKind.ModuleBlock)) {
                for (const stat of body.statements) {
                    if (stat.kind === ts.SyntaxKind.ExportDeclaration || stat.kind === ts.SyntaxKind.ExportAssignment) {
                        return true;
                    }
                }
            }
            return false;
        }
        function setExportContextFlag(node) {
            // A declaration source file or ambient module declaration that contains no export declarations (but possibly regular
            // declarations with export modifiers) is an export context in which declarations are implicitly exported.
            if (node.flags & ts.NodeFlags.Ambient && !hasExportDeclarations(node)) {
                node.flags |= ts.NodeFlags.ExportContext;
            }
            else {
                node.flags &= ~ts.NodeFlags.ExportContext;
            }
        }
        function bindModuleDeclaration(node) {
            setExportContextFlag(node);
            if (ts.isAmbientModule(node)) {
                if (ts.hasModifier(node, ts.ModifierFlags.Export)) {
                    errorOnFirstToken(node, Diagnostics.export_modifier_cannot_be_applied_to_ambient_modules_and_module_augmentations_since_they_are_always_visible);
                }
                if (ts.isModuleAugmentationExternal(node)) {
                    declareModuleSymbol(node);
                }
                else {
                    let pattern;
                    if (node.name.kind === ts.SyntaxKind.StringLiteral) {
                        const { text } = node.name;
                        if (ts.hasZeroOrOneAsteriskCharacter(text)) {
                            pattern = ts.tryParsePattern(text);
                        }
                        else {
                            errorOnFirstToken(node.name, Diagnostics.Pattern_0_can_have_at_most_one_Asterisk_character, text);
                        }
                    }
                    const symbol = declareSymbolAndAddToSymbolTable(node, ts.SymbolFlags.ValueModule, ts.SymbolFlags.ValueModuleExcludes);
                    file.patternAmbientModules = ts.append(file.patternAmbientModules, pattern && { pattern, symbol });
                }
            }
            else {
                const state = declareModuleSymbol(node);
                if (state !== 0 /* NonInstantiated */) {
                    const { symbol } = node;
                    // if module was already merged with some function, class or non-const enum, treat it as non-const-enum-only
                    symbol.constEnumOnlyModule = (!(symbol.flags & (ts.SymbolFlags.Function | ts.SymbolFlags.Class | ts.SymbolFlags.RegularEnum)))
                        // Current must be `const enum` only
                        && state === 2 /* ConstEnumOnly */
                        // Can't have been set to 'false' in a previous merged symbol. ('undefined' OK)
                        && symbol.constEnumOnlyModule !== false;
                }
            }
        }
        function declareModuleSymbol(node) {
            const state = getModuleInstanceState(node);
            const instantiated = state !== 0 /* NonInstantiated */;
            declareSymbolAndAddToSymbolTable(node, instantiated ? ts.SymbolFlags.ValueModule : ts.SymbolFlags.NamespaceModule, instantiated ? ts.SymbolFlags.ValueModuleExcludes : ts.SymbolFlags.NamespaceModuleExcludes);
            return state;
        }
        function bindFunctionOrConstructorType(node) {
            // For a given function symbol "<...>(...) => T" we want to generate a symbol identical
            // to the one we would get for: { <...>(...): T }
            //
            // We do that by making an anonymous type literal symbol, and then setting the function
            // symbol as its sole member. To the rest of the system, this symbol will be indistinguishable
            // from an actual type literal symbol you would have gotten had you used the long form.
            const symbol = createSymbol(ts.SymbolFlags.Signature, getDeclarationName(node));
            addDeclarationToSymbol(symbol, node, ts.SymbolFlags.Signature);
            const typeLiteralSymbol = createSymbol(ts.SymbolFlags.TypeLiteral, ts.InternalSymbolName.Type);
            addDeclarationToSymbol(typeLiteralSymbol, node, ts.SymbolFlags.TypeLiteral);
            typeLiteralSymbol.members = ts.createSymbolTable();
            typeLiteralSymbol.members.set(symbol.escapedName, symbol);
        }
        function bindObjectLiteralExpression(node) {
            if (inStrictMode) {
                const seen = ts.createUnderscoreEscapedMap();
                for (const prop of node.properties) {
                    if (prop.kind === ts.SyntaxKind.SpreadAssignment || prop.name.kind !== ts.SyntaxKind.Identifier) {
                        continue;
                    }
                    const identifier = prop.name;
                    // ECMA-262 11.1.5 Object Initializer
                    // If previous is not undefined then throw a SyntaxError exception if any of the following conditions are true
                    // a.This production is contained in strict code and IsDataDescriptor(previous) is true and
                    // IsDataDescriptor(propId.descriptor) is true.
                    //    b.IsDataDescriptor(previous) is true and IsAccessorDescriptor(propId.descriptor) is true.
                    //    c.IsAccessorDescriptor(previous) is true and IsDataDescriptor(propId.descriptor) is true.
                    //    d.IsAccessorDescriptor(previous) is true and IsAccessorDescriptor(propId.descriptor) is true
                    // and either both previous and propId.descriptor have[[Get]] fields or both previous and propId.descriptor have[[Set]] fields
                    const currentKind = prop.kind === ts.SyntaxKind.PropertyAssignment || prop.kind === ts.SyntaxKind.ShorthandPropertyAssignment || prop.kind === ts.SyntaxKind.MethodDeclaration
                        ? 1 /* Property */
                        : 2 /* Accessor */;
                    const existingKind = seen.get(identifier.escapedText);
                    if (!existingKind) {
                        seen.set(identifier.escapedText, currentKind);
                        continue;
                    }
                    if (currentKind === 1 /* Property */ && existingKind === 1 /* Property */) {
                        const span = ts.getErrorSpanForNode(file, identifier);
                        file.bindDiagnostics.push(ts.createFileDiagnostic(file, span.start, span.length, Diagnostics.An_object_literal_cannot_have_multiple_properties_with_the_same_name_in_strict_mode));
                    }
                }
            }
            return bindAnonymousDeclaration(node, ts.SymbolFlags.ObjectLiteral, ts.InternalSymbolName.Object);
        }
        function bindJsxAttributes(node) {
            return bindAnonymousDeclaration(node, ts.SymbolFlags.ObjectLiteral, ts.InternalSymbolName.JSXAttributes);
        }
        function bindJsxAttribute(node, symbolFlags, symbolExcludes) {
            return declareSymbolAndAddToSymbolTable(node, symbolFlags, symbolExcludes);
        }
        function bindAnonymousDeclaration(node, symbolFlags, name) {
            const symbol = createSymbol(symbolFlags, name);
            if (symbolFlags & (ts.SymbolFlags.EnumMember | ts.SymbolFlags.ClassMember)) {
                symbol.parent = container.symbol;
            }
            addDeclarationToSymbol(symbol, node, symbolFlags);
        }
        function bindBlockScopedDeclaration(node, symbolFlags, symbolExcludes) {
            switch (blockScopeContainer.kind) {
                case ts.SyntaxKind.ModuleDeclaration:
                    declareModuleMember(node, symbolFlags, symbolExcludes);
                    break;
                case ts.SyntaxKind.SourceFile:
                    if (ts.isExternalModule(container)) {
                        declareModuleMember(node, symbolFlags, symbolExcludes);
                        break;
                    }
                // falls through
                default:
                    if (!blockScopeContainer.locals) {
                        blockScopeContainer.locals = ts.createSymbolTable();
                        addToContainerChain(blockScopeContainer);
                    }
                    declareSymbol(blockScopeContainer.locals, /*parent*/ undefined, node, symbolFlags, symbolExcludes);
            }
        }
        function bindBlockScopedVariableDeclaration(node) {
            bindBlockScopedDeclaration(node, ts.SymbolFlags.BlockScopedVariable, ts.SymbolFlags.BlockScopedVariableExcludes);
        }
        // The binder visits every node in the syntax tree so it is a convenient place to perform a single localized
        // check for reserved words used as identifiers in strict mode code.
        function checkStrictModeIdentifier(node) {
            if (inStrictMode &&
                node.originalKeywordKind >= ts.SyntaxKind.FirstFutureReservedWord &&
                node.originalKeywordKind <= ts.SyntaxKind.LastFutureReservedWord &&
                !ts.isIdentifierName(node) &&
                !(node.flags & ts.NodeFlags.Ambient)) {
                // Report error only if there are no parse errors in file
                if (!file.parseDiagnostics.length) {
                    file.bindDiagnostics.push(createDiagnosticForNode(node, getStrictModeIdentifierMessage(node), ts.declarationNameToString(node)));
                }
            }
        }
        function getStrictModeIdentifierMessage(node) {
            // Provide specialized messages to help the user understand why we think they're in
            // strict mode.
            if (ts.getContainingClass(node)) {
                return Diagnostics.Identifier_expected_0_is_a_reserved_word_in_strict_mode_Class_definitions_are_automatically_in_strict_mode;
            }
            if (file.externalModuleIndicator) {
                return Diagnostics.Identifier_expected_0_is_a_reserved_word_in_strict_mode_Modules_are_automatically_in_strict_mode;
            }
            return Diagnostics.Identifier_expected_0_is_a_reserved_word_in_strict_mode;
        }
        function checkStrictModeBinaryExpression(node) {
            if (inStrictMode && ts.isLeftHandSideExpression(node.left) && ts.isAssignmentOperator(node.operatorToken.kind)) {
                // ECMA 262 (Annex C) The identifier eval or arguments may not appear as the LeftHandSideExpression of an
                // Assignment operator(11.13) or of a PostfixExpression(11.3)
                checkStrictModeEvalOrArguments(node, node.left);
            }
        }
        function checkStrictModeCatchClause(node) {
            // It is a SyntaxError if a TryStatement with a Catch occurs within strict code and the Identifier of the
            // Catch production is eval or arguments
            if (inStrictMode && node.variableDeclaration) {
                checkStrictModeEvalOrArguments(node, node.variableDeclaration.name);
            }
        }
        function checkStrictModeDeleteExpression(node) {
            // Grammar checking
            if (inStrictMode && node.expression.kind === ts.SyntaxKind.Identifier) {
                // When a delete operator occurs within strict mode code, a SyntaxError is thrown if its
                // UnaryExpression is a direct reference to a variable, function argument, or function name
                const span = ts.getErrorSpanForNode(file, node.expression);
                file.bindDiagnostics.push(ts.createFileDiagnostic(file, span.start, span.length, Diagnostics.delete_cannot_be_called_on_an_identifier_in_strict_mode));
            }
        }
        function isEvalOrArgumentsIdentifier(node) {
            return ts.isIdentifier(node) && (node.escapedText === "eval" || node.escapedText === "arguments");
        }
        function checkStrictModeEvalOrArguments(contextNode, name) {
            if (name && name.kind === ts.SyntaxKind.Identifier) {
                const identifier = name;
                if (isEvalOrArgumentsIdentifier(identifier)) {
                    // We check first if the name is inside class declaration or class expression; if so give explicit message
                    // otherwise report generic error message.
                    const span = ts.getErrorSpanForNode(file, name);
                    file.bindDiagnostics.push(ts.createFileDiagnostic(file, span.start, span.length, getStrictModeEvalOrArgumentsMessage(contextNode), ts.idText(identifier)));
                }
            }
        }
        function getStrictModeEvalOrArgumentsMessage(node) {
            // Provide specialized messages to help the user understand why we think they're in
            // strict mode.
            if (ts.getContainingClass(node)) {
                return Diagnostics.Invalid_use_of_0_Class_definitions_are_automatically_in_strict_mode;
            }
            if (file.externalModuleIndicator) {
                return Diagnostics.Invalid_use_of_0_Modules_are_automatically_in_strict_mode;
            }
            return Diagnostics.Invalid_use_of_0_in_strict_mode;
        }
        function checkStrictModeFunctionName(node) {
            if (inStrictMode) {
                // It is a SyntaxError if the identifier eval or arguments appears within a FormalParameterList of a strict mode FunctionDeclaration or FunctionExpression (13.1))
                checkStrictModeEvalOrArguments(node, node.name);
            }
        }
        function getStrictModeBlockScopeFunctionDeclarationMessage(node) {
            // Provide specialized messages to help the user understand why we think they're in
            // strict mode.
            if (ts.getContainingClass(node)) {
                return Diagnostics.Function_declarations_are_not_allowed_inside_blocks_in_strict_mode_when_targeting_ES3_or_ES5_Class_definitions_are_automatically_in_strict_mode;
            }
            if (file.externalModuleIndicator) {
                return Diagnostics.Function_declarations_are_not_allowed_inside_blocks_in_strict_mode_when_targeting_ES3_or_ES5_Modules_are_automatically_in_strict_mode;
            }
            return Diagnostics.Function_declarations_are_not_allowed_inside_blocks_in_strict_mode_when_targeting_ES3_or_ES5;
        }
        function checkStrictModeFunctionDeclaration(node) {
            if (languageVersion < ts.ScriptTarget.ES2015) {
                // Report error if function is not top level function declaration
                if (blockScopeContainer.kind !== ts.SyntaxKind.SourceFile &&
                    blockScopeContainer.kind !== ts.SyntaxKind.ModuleDeclaration &&
                    !ts.isFunctionLike(blockScopeContainer)) {
                    // We check first if the name is inside class declaration or class expression; if so give explicit message
                    // otherwise report generic error message.
                    const errorSpan = ts.getErrorSpanForNode(file, node);
                    file.bindDiagnostics.push(ts.createFileDiagnostic(file, errorSpan.start, errorSpan.length, getStrictModeBlockScopeFunctionDeclarationMessage(node)));
                }
            }
        }
        function checkStrictModeNumericLiteral(node) {
            if (inStrictMode && node.numericLiteralFlags & 32 /* Octal */) {
                file.bindDiagnostics.push(createDiagnosticForNode(node, Diagnostics.Octal_literals_are_not_allowed_in_strict_mode));
            }
        }
        function checkStrictModePostfixUnaryExpression(node) {
            // Grammar checking
            // The identifier eval or arguments may not appear as the LeftHandSideExpression of an
            // Assignment operator(11.13) or of a PostfixExpression(11.3) or as the UnaryExpression
            // operated upon by a Prefix Increment(11.4.4) or a Prefix Decrement(11.4.5) operator.
            if (inStrictMode) {
                checkStrictModeEvalOrArguments(node, node.operand);
            }
        }
        function checkStrictModePrefixUnaryExpression(node) {
            // Grammar checking
            if (inStrictMode) {
                if (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken) {
                    checkStrictModeEvalOrArguments(node, node.operand);
                }
            }
        }
        function checkStrictModeWithStatement(node) {
            // Grammar checking for withStatement
            if (inStrictMode) {
                errorOnFirstToken(node, Diagnostics.with_statements_are_not_allowed_in_strict_mode);
            }
        }
        function errorOnFirstToken(node, message, arg0, arg1, arg2) {
            const span = ts.getSpanOfTokenAtPosition(file, node.pos);
            file.bindDiagnostics.push(ts.createFileDiagnostic(file, span.start, span.length, message, arg0, arg1, arg2));
        }
        function bind(node) {
            if (!node) {
                return;
            }
            node.parent = parent;
            const saveInStrictMode = inStrictMode;
            // Even though in the AST the jsdoc @typedef node belongs to the current node,
            // its symbol might be in the same scope with the current node's symbol. Consider:
            //
            //     /** @typedef {string | number} MyType */
            //     function foo();
            //
            // Here the current node is "foo", which is a container, but the scope of "MyType" should
            // not be inside "foo". Therefore we always bind @typedef before bind the parent node,
            // and skip binding this tag later when binding all the other jsdoc tags.
            if (ts.isInJavaScriptFile(node))
                bindJSDocTypedefTagIfAny(node);
            // First we bind declaration nodes to a symbol if possible. We'll both create a symbol
            // and then potentially add the symbol to an appropriate symbol table. Possible
            // destination symbol tables are:
            //
            //  1) The 'exports' table of the current container's symbol.
            //  2) The 'members' table of the current container's symbol.
            //  3) The 'locals' table of the current container.
            //
            // However, not all symbols will end up in any of these tables. 'Anonymous' symbols
            // (like TypeLiterals for example) will not be put in any table.
            bindWorker(node);
            // Then we recurse into the children of the node to bind them as well. For certain
            // symbols we do specialized work when we recurse. For example, we'll keep track of
            // the current 'container' node when it changes. This helps us know which symbol table
            // a local should go into for example. Since terminal nodes are known not to have
            // children, as an optimization we don't process those.
            if (node.kind > ts.SyntaxKind.LastToken) {
                const saveParent = parent;
                parent = node;
                const containerFlags = getContainerFlags(node);
                if (containerFlags === 0 /* None */) {
                    bindChildren(node);
                }
                else {
                    bindContainer(node, containerFlags);
                }
                parent = saveParent;
            }
            else if (!skipTransformFlagAggregation && (node.transformFlags & 536870912 /* HasComputedFlags */) === 0) {
                subtreeTransformFlags |= computeTransformFlagsForNode(node, 0);
            }
            inStrictMode = saveInStrictMode;
        }
        function bindJSDocTypedefTagIfAny(node) {
            if (!ts.hasJSDocNodes(node)) {
                return;
            }
            for (const jsDoc of node.jsDoc) {
                if (!jsDoc.tags) {
                    continue;
                }
                for (const tag of jsDoc.tags) {
                    if (tag.kind === ts.SyntaxKind.JSDocTypedefTag) {
                        const savedParent = parent;
                        parent = jsDoc;
                        bind(tag);
                        parent = savedParent;
                    }
                }
            }
        }
        function updateStrictModeStatementList(statements) {
            if (!inStrictMode) {
                for (const statement of statements) {
                    if (!ts.isPrologueDirective(statement)) {
                        return;
                    }
                    if (isUseStrictPrologueDirective(statement)) {
                        inStrictMode = true;
                        return;
                    }
                }
            }
        }
        /// Should be called only on prologue directives (isPrologueDirective(node) should be true)
        function isUseStrictPrologueDirective(node) {
            const nodeText = ts.getSourceTextOfNodeFromSourceFile(file, node.expression);
            // Note: the node text must be exactly "use strict" or 'use strict'.  It is not ok for the
            // string to contain unicode escapes (as per ES5).
            return nodeText === '"use strict"' || nodeText === "'use strict'";
        }
        function bindWorker(node) {
            switch (node.kind) {
                /* Strict mode checks */
                case ts.SyntaxKind.Identifier:
                    // for typedef type names with namespaces, bind the new jsdoc type symbol here
                    // because it requires all containing namespaces to be in effect, namely the
                    // current "blockScopeContainer" needs to be set to its immediate namespace parent.
                    if (node.isInJSDocNamespace) {
                        let parentNode = node.parent;
                        while (parentNode && parentNode.kind !== ts.SyntaxKind.JSDocTypedefTag) {
                            parentNode = parentNode.parent;
                        }
                        bindBlockScopedDeclaration(parentNode, ts.SymbolFlags.TypeAlias, ts.SymbolFlags.TypeAliasExcludes);
                        break;
                    }
                // falls through
                case ts.SyntaxKind.ThisKeyword:
                    if (currentFlow && (ts.isExpression(node) || parent.kind === ts.SyntaxKind.ShorthandPropertyAssignment)) {
                        node.flowNode = currentFlow;
                    }
                    return checkStrictModeIdentifier(node);
                case ts.SyntaxKind.PropertyAccessExpression:
                    if (currentFlow && isNarrowableReference(node)) {
                        node.flowNode = currentFlow;
                    }
                    if (ts.isSpecialPropertyDeclaration(node)) {
                        bindSpecialPropertyDeclaration(node);
                    }
                    break;
                case ts.SyntaxKind.BinaryExpression:
                    const specialKind = ts.getSpecialPropertyAssignmentKind(node);
                    switch (specialKind) {
                        case 1 /* ExportsProperty */:
                            bindExportsPropertyAssignment(node);
                            break;
                        case 2 /* ModuleExports */:
                            bindModuleExportsAssignment(node);
                            break;
                        case 3 /* PrototypeProperty */:
                            bindPrototypePropertyAssignment(node.left, node);
                            break;
                        case 6 /* Prototype */:
                            bindPrototypeAssignment(node);
                            break;
                        case 4 /* ThisProperty */:
                            bindThisPropertyAssignment(node);
                            break;
                        case 5 /* Property */:
                            bindSpecialPropertyAssignment(node);
                            break;
                        case 0 /* None */:
                            // Nothing to do
                            break;
                        default:
                            ts.Debug.fail("Unknown special property assignment kind");
                    }
                    return checkStrictModeBinaryExpression(node);
                case ts.SyntaxKind.CatchClause:
                    return checkStrictModeCatchClause(node);
                case ts.SyntaxKind.DeleteExpression:
                    return checkStrictModeDeleteExpression(node);
                case ts.SyntaxKind.NumericLiteral:
                    return checkStrictModeNumericLiteral(node);
                case ts.SyntaxKind.PostfixUnaryExpression:
                    return checkStrictModePostfixUnaryExpression(node);
                case ts.SyntaxKind.PrefixUnaryExpression:
                    return checkStrictModePrefixUnaryExpression(node);
                case ts.SyntaxKind.WithStatement:
                    return checkStrictModeWithStatement(node);
                case ts.SyntaxKind.ThisType:
                    seenThisKeyword = true;
                    return;
                case ts.SyntaxKind.TypePredicate:
                    break; // Binding the children will handle everything
                case ts.SyntaxKind.TypeParameter:
                    return bindTypeParameter(node);
                case ts.SyntaxKind.Parameter:
                    return bindParameter(node);
                case ts.SyntaxKind.VariableDeclaration:
                    return bindVariableDeclarationOrBindingElement(node);
                case ts.SyntaxKind.BindingElement:
                    node.flowNode = currentFlow;
                    return bindVariableDeclarationOrBindingElement(node);
                case ts.SyntaxKind.PropertyDeclaration:
                case ts.SyntaxKind.PropertySignature:
                    return bindPropertyWorker(node);
                case ts.SyntaxKind.PropertyAssignment:
                case ts.SyntaxKind.ShorthandPropertyAssignment:
                    return bindPropertyOrMethodOrAccessor(node, ts.SymbolFlags.Property, ts.SymbolFlags.PropertyExcludes);
                case ts.SyntaxKind.EnumMember:
                    return bindPropertyOrMethodOrAccessor(node, ts.SymbolFlags.EnumMember, ts.SymbolFlags.EnumMemberExcludes);
                case ts.SyntaxKind.CallSignature:
                case ts.SyntaxKind.ConstructSignature:
                case ts.SyntaxKind.IndexSignature:
                    return declareSymbolAndAddToSymbolTable(node, ts.SymbolFlags.Signature, ts.SymbolFlags.None);
                case ts.SyntaxKind.MethodDeclaration:
                case ts.SyntaxKind.MethodSignature:
                    // If this is an ObjectLiteralExpression method, then it sits in the same space
                    // as other properties in the object literal.  So we use SymbolFlags.PropertyExcludes
                    // so that it will conflict with any other object literal members with the same
                    // name.
                    return bindPropertyOrMethodOrAccessor(node, ts.SymbolFlags.Method | (node.questionToken ? ts.SymbolFlags.Optional : ts.SymbolFlags.None), ts.isObjectLiteralMethod(node) ? ts.SymbolFlags.PropertyExcludes : ts.SymbolFlags.MethodExcludes);
                case ts.SyntaxKind.FunctionDeclaration:
                    return bindFunctionDeclaration(node);
                case ts.SyntaxKind.Constructor:
                    return declareSymbolAndAddToSymbolTable(node, ts.SymbolFlags.Constructor, /*symbolExcludes:*/ ts.SymbolFlags.None);
                case ts.SyntaxKind.GetAccessor:
                    return bindPropertyOrMethodOrAccessor(node, ts.SymbolFlags.GetAccessor, ts.SymbolFlags.GetAccessorExcludes);
                case ts.SyntaxKind.SetAccessor:
                    return bindPropertyOrMethodOrAccessor(node, ts.SymbolFlags.SetAccessor, ts.SymbolFlags.SetAccessorExcludes);
                case ts.SyntaxKind.FunctionType:
                case ts.SyntaxKind.JSDocFunctionType:
                case ts.SyntaxKind.ConstructorType:
                    return bindFunctionOrConstructorType(node);
                case ts.SyntaxKind.TypeLiteral:
                case ts.SyntaxKind.JSDocTypeLiteral:
                case ts.SyntaxKind.MappedType:
                    return bindAnonymousTypeWorker(node);
                case ts.SyntaxKind.ObjectLiteralExpression:
                    return bindObjectLiteralExpression(node);
                case ts.SyntaxKind.FunctionExpression:
                case ts.SyntaxKind.ArrowFunction:
                    return bindFunctionExpression(node);
                case ts.SyntaxKind.CallExpression:
                    if (ts.isInJavaScriptFile(node)) {
                        bindCallExpression(node);
                    }
                    break;
                // Members of classes, interfaces, and modules
                case ts.SyntaxKind.ClassExpression:
                case ts.SyntaxKind.ClassDeclaration:
                    // All classes are automatically in strict mode in ES6.
                    inStrictMode = true;
                    return bindClassLikeDeclaration(node);
                case ts.SyntaxKind.InterfaceDeclaration:
                    return bindBlockScopedDeclaration(node, ts.SymbolFlags.Interface, ts.SymbolFlags.InterfaceExcludes);
                case ts.SyntaxKind.TypeAliasDeclaration:
                    return bindBlockScopedDeclaration(node, ts.SymbolFlags.TypeAlias, ts.SymbolFlags.TypeAliasExcludes);
                case ts.SyntaxKind.EnumDeclaration:
                    return bindEnumDeclaration(node);
                case ts.SyntaxKind.ModuleDeclaration:
                    return bindModuleDeclaration(node);
                // Jsx-attributes
                case ts.SyntaxKind.JsxAttributes:
                    return bindJsxAttributes(node);
                case ts.SyntaxKind.JsxAttribute:
                    return bindJsxAttribute(node, ts.SymbolFlags.Property, ts.SymbolFlags.PropertyExcludes);
                // Imports and exports
                case ts.SyntaxKind.ImportEqualsDeclaration:
                case ts.SyntaxKind.NamespaceImport:
                case ts.SyntaxKind.ImportSpecifier:
                case ts.SyntaxKind.ExportSpecifier:
                    return declareSymbolAndAddToSymbolTable(node, ts.SymbolFlags.Alias, ts.SymbolFlags.AliasExcludes);
                case ts.SyntaxKind.NamespaceExportDeclaration:
                    return bindNamespaceExportDeclaration(node);
                case ts.SyntaxKind.ImportClause:
                    return bindImportClause(node);
                case ts.SyntaxKind.ExportDeclaration:
                    return bindExportDeclaration(node);
                case ts.SyntaxKind.ExportAssignment:
                    return bindExportAssignment(node);
                case ts.SyntaxKind.SourceFile:
                    updateStrictModeStatementList(node.statements);
                    return bindSourceFileIfExternalModule();
                case ts.SyntaxKind.Block:
                    if (!ts.isFunctionLike(node.parent)) {
                        return;
                    }
                // falls through
                case ts.SyntaxKind.ModuleBlock:
                    return updateStrictModeStatementList(node.statements);
                case ts.SyntaxKind.JSDocParameterTag:
                    if (node.parent.kind !== ts.SyntaxKind.JSDocTypeLiteral) {
                        break;
                    }
                // falls through
                case ts.SyntaxKind.JSDocPropertyTag:
                    const propTag = node;
                    const flags = propTag.isBracketed || propTag.typeExpression && propTag.typeExpression.type.kind === ts.SyntaxKind.JSDocOptionalType ?
                        ts.SymbolFlags.Property | ts.SymbolFlags.Optional :
                        ts.SymbolFlags.Property;
                    return declareSymbolAndAddToSymbolTable(propTag, flags, ts.SymbolFlags.PropertyExcludes);
                case ts.SyntaxKind.JSDocTypedefTag: {
                    const { fullName } = node;
                    if (!fullName || fullName.kind === ts.SyntaxKind.Identifier) {
                        return bindBlockScopedDeclaration(node, ts.SymbolFlags.TypeAlias, ts.SymbolFlags.TypeAliasExcludes);
                    }
                    break;
                }
            }
        }
        function bindPropertyWorker(node) {
            return bindPropertyOrMethodOrAccessor(node, ts.SymbolFlags.Property | (node.questionToken ? ts.SymbolFlags.Optional : ts.SymbolFlags.None), ts.SymbolFlags.PropertyExcludes);
        }
        function bindAnonymousTypeWorker(node) {
            return bindAnonymousDeclaration(node, ts.SymbolFlags.TypeLiteral, ts.InternalSymbolName.Type);
        }
        function bindSourceFileIfExternalModule() {
            setExportContextFlag(file);
            if (ts.isExternalModule(file)) {
                bindSourceFileAsExternalModule();
            }
        }
        function bindSourceFileAsExternalModule() {
            bindAnonymousDeclaration(file, ts.SymbolFlags.ValueModule, `"${ts.removeFileExtension(file.fileName)}"`);
        }
        function bindExportAssignment(node) {
            if (!container.symbol || !container.symbol.exports) {
                // Export assignment in some sort of block construct
                bindAnonymousDeclaration(node, ts.SymbolFlags.Alias, getDeclarationName(node));
            }
            else {
                const flags = node.kind === ts.SyntaxKind.ExportAssignment && ts.exportAssignmentIsAlias(node)
                    // An export default clause with an EntityNameExpression or a class expression exports all meanings of that identifier or expression;
                    ? ts.SymbolFlags.Alias
                    // An export default clause with any other expression exports a value
                    : ts.SymbolFlags.Property;
                // If there is an `export default x;` alias declaration, can't `export default` anything else.
                // (In contrast, you can still have `export default function f() {}` and `export default interface I {}`.)
                declareSymbol(container.symbol.exports, container.symbol, node, flags, ts.SymbolFlags.All);
            }
        }
        function bindNamespaceExportDeclaration(node) {
            if (node.modifiers && node.modifiers.length) {
                file.bindDiagnostics.push(createDiagnosticForNode(node, Diagnostics.Modifiers_cannot_appear_here));
            }
            if (node.parent.kind !== ts.SyntaxKind.SourceFile) {
                file.bindDiagnostics.push(createDiagnosticForNode(node, Diagnostics.Global_module_exports_may_only_appear_at_top_level));
                return;
            }
            else {
                const parent = node.parent;
                if (!ts.isExternalModule(parent)) {
                    file.bindDiagnostics.push(createDiagnosticForNode(node, Diagnostics.Global_module_exports_may_only_appear_in_module_files));
                    return;
                }
                if (!parent.isDeclarationFile) {
                    file.bindDiagnostics.push(createDiagnosticForNode(node, Diagnostics.Global_module_exports_may_only_appear_in_declaration_files));
                    return;
                }
            }
            file.symbol.globalExports = file.symbol.globalExports || ts.createSymbolTable();
            declareSymbol(file.symbol.globalExports, file.symbol, node, ts.SymbolFlags.Alias, ts.SymbolFlags.AliasExcludes);
        }
        function bindExportDeclaration(node) {
            if (!container.symbol || !container.symbol.exports) {
                // Export * in some sort of block construct
                bindAnonymousDeclaration(node, ts.SymbolFlags.ExportStar, getDeclarationName(node));
            }
            else if (!node.exportClause) {
                // All export * declarations are collected in an __export symbol
                declareSymbol(container.symbol.exports, container.symbol, node, ts.SymbolFlags.ExportStar, ts.SymbolFlags.None);
            }
        }
        function bindImportClause(node) {
            if (node.name) {
                declareSymbolAndAddToSymbolTable(node, ts.SymbolFlags.Alias, ts.SymbolFlags.AliasExcludes);
            }
        }
        function setCommonJsModuleIndicator(node) {
            if (!file.commonJsModuleIndicator) {
                file.commonJsModuleIndicator = node;
                if (!file.externalModuleIndicator) {
                    bindSourceFileAsExternalModule();
                }
            }
        }
        function bindExportsPropertyAssignment(node) {
            // When we create a property via 'exports.foo = bar', the 'exports.foo' property access
            // expression is the declaration
            setCommonJsModuleIndicator(node);
            const lhs = node.left;
            const symbol = forEachIdentifierInEntityName(lhs.expression, (id, original) => {
                if (!original) {
                    return undefined;
                }
                const s = ts.getJSInitializerSymbol(original);
                addDeclarationToSymbol(s, id, ts.SymbolFlags.Module | ts.SymbolFlags.JSContainer);
                return s;
            });
            if (symbol) {
                declareSymbol(symbol.exports, symbol, lhs, ts.SymbolFlags.Property | ts.SymbolFlags.ExportValue, ts.SymbolFlags.None);
            }
        }
        function bindModuleExportsAssignment(node) {
            // A common practice in node modules is to set 'export = module.exports = {}', this ensures that 'exports'
            // is still pointing to 'module.exports'.
            // We do not want to consider this as 'export=' since a module can have only one of these.
            // Similarly we do not want to treat 'module.exports = exports' as an 'export='.
            const assignedExpression = ts.getRightMostAssignedExpression(node.right);
            if (ts.isEmptyObjectLiteral(assignedExpression) || container === file && isExportsOrModuleExportsOrAlias(file, assignedExpression)) {
                // Mark it as a module in case there are no other exports in the file
                setCommonJsModuleIndicator(node);
                return;
            }
            // 'module.exports = expr' assignment
            setCommonJsModuleIndicator(node);
            const flags = ts.exportAssignmentIsAlias(node)
                ? ts.SymbolFlags.Alias // An export= with an EntityNameExpression or a ClassExpression exports all meanings of that identifier or class
                : ts.SymbolFlags.Property | ts.SymbolFlags.ExportValue | ts.SymbolFlags.ValueModule;
            declareSymbol(file.symbol.exports, file.symbol, node, flags, ts.SymbolFlags.None);
        }
        function bindThisPropertyAssignment(node) {
            ts.Debug.assert(ts.isInJavaScriptFile(node));
            const thisContainer = ts.getThisContainer(node, /*includeArrowFunctions*/ false);
            switch (thisContainer.kind) {
                case ts.SyntaxKind.FunctionDeclaration:
                case ts.SyntaxKind.FunctionExpression:
                    let constructorSymbol = thisContainer.symbol;
                    // For `f.prototype.m = function() { this.x = 0; }`, `this.x = 0` should modify `f`'s members, not the function expression.
                    if (ts.isBinaryExpression(thisContainer.parent) && thisContainer.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
                        const l = thisContainer.parent.left;
                        if (ts.isPropertyAccessEntityNameExpression(l) && ts.isPrototypeAccess(l.expression)) {
                            constructorSymbol = getJSInitializerSymbolFromName(l.expression.expression, thisParentContainer);
                        }
                    }
                    if (constructorSymbol) {
                        // Declare a 'member' if the container is an ES5 class or ES6 constructor
                        constructorSymbol.members = constructorSymbol.members || ts.createSymbolTable();
                        // It's acceptable for multiple 'this' assignments of the same identifier to occur
                        declareSymbol(constructorSymbol.members, constructorSymbol, node, ts.SymbolFlags.Property, ts.SymbolFlags.PropertyExcludes & ~ts.SymbolFlags.Property);
                    }
                    break;
                case ts.SyntaxKind.Constructor:
                case ts.SyntaxKind.PropertyDeclaration:
                case ts.SyntaxKind.MethodDeclaration:
                case ts.SyntaxKind.GetAccessor:
                case ts.SyntaxKind.SetAccessor:
                    // this.foo assignment in a JavaScript class
                    // Bind this property to the containing class
                    const containingClass = thisContainer.parent;
                    const symbolTable = ts.hasModifier(thisContainer, ts.ModifierFlags.Static) ? containingClass.symbol.exports : containingClass.symbol.members;
                    declareSymbol(symbolTable, containingClass.symbol, node, ts.SymbolFlags.Property, ts.SymbolFlags.None, /*isReplaceableByMethod*/ true);
                    break;
                case ts.SyntaxKind.SourceFile:
                    // this.foo assignment in a source file
                    // Do not bind. It would be nice to support this someday though.
                    break;
                default:
                    ts.Debug.fail(ts.Debug.showSyntaxKind(thisContainer));
            }
        }
        function bindSpecialPropertyDeclaration(node) {
            if (node.expression.kind === ts.SyntaxKind.ThisKeyword) {
                bindThisPropertyAssignment(node);
            }
            else if (ts.isPropertyAccessEntityNameExpression(node) && node.parent.parent.kind === ts.SyntaxKind.SourceFile) {
                if (ts.isPrototypeAccess(node.expression)) {
                    bindPrototypePropertyAssignment(node, node.parent);
                }
                else {
                    bindStaticPropertyAssignment(node);
                }
            }
        }
        /** For `x.prototype = { p, ... }`, declare members p,... if `x` is function/class/{}, or not declared. */
        function bindPrototypeAssignment(node) {
            node.left.parent = node;
            node.right.parent = node;
            const lhs = node.left;
            bindPropertyAssignment(lhs, lhs, /*isPrototypeProperty*/ false);
        }
        /**
         * For `x.prototype.y = z`, declare a member `y` on `x` if `x` is a function or class, or not declared.
         * Note that jsdoc preceding an ExpressionStatement like `x.prototype.y;` is also treated as a declaration.
         */
        function bindPrototypePropertyAssignment(lhs, parent) {
            // Look up the function in the local scope, since prototype assignments should
            // follow the function declaration
            const classPrototype = lhs.expression;
            const constructorFunction = classPrototype.expression;
            // Fix up parent pointers since we're going to use these nodes before we bind into them
            lhs.parent = parent;
            constructorFunction.parent = classPrototype;
            classPrototype.parent = lhs;
            bindPropertyAssignment(constructorFunction, lhs, /*isPrototypeProperty*/ true);
        }
        function bindSpecialPropertyAssignment(node) {
            const lhs = node.left;
            // Fix up parent pointers since we're going to use these nodes before we bind into them
            node.left.parent = node;
            node.right.parent = node;
            if (ts.isIdentifier(lhs.expression) && container === file && isNameOfExportsOrModuleExportsAliasDeclaration(file, lhs.expression)) {
                // This can be an alias for the 'exports' or 'module.exports' names, e.g.
                //    var util = module.exports;
                //    util.property = function ...
                bindExportsPropertyAssignment(node);
            }
            else {
                bindStaticPropertyAssignment(lhs);
            }
        }
        /**
         * For nodes like `x.y = z`, declare a member 'y' on 'x' if x is a function (or IIFE) or class or {}, or not declared.
         * Also works for expression statements preceded by JSDoc, like / ** @type number * / x.y;
         */
        function bindStaticPropertyAssignment(node) {
            node.expression.parent = node;
            bindPropertyAssignment(node.expression, node, /*isPrototypeProperty*/ false);
        }
        function getJSInitializerSymbolFromName(name, lookupContainer) {
            return ts.getJSInitializerSymbol(lookupSymbolForPropertyAccess(name, lookupContainer));
        }
        function bindPropertyAssignment(name, propertyAccess, isPrototypeProperty) {
            let symbol = getJSInitializerSymbolFromName(name);
            const isToplevelNamespaceableInitializer = ts.isBinaryExpression(propertyAccess.parent)
                ? getParentOfBinaryExpression(propertyAccess.parent).parent.kind === ts.SyntaxKind.SourceFile &&
                    !!ts.getJavascriptInitializer(ts.getInitializerOfBinaryExpression(propertyAccess.parent), ts.isPrototypeAccess(propertyAccess.parent.left))
                : propertyAccess.parent.parent.kind === ts.SyntaxKind.SourceFile;
            if (!isPrototypeProperty && (!symbol || !(symbol.flags & ts.SymbolFlags.Namespace)) && isToplevelNamespaceableInitializer) {
                // make symbols or add declarations for intermediate containers
                const flags = ts.SymbolFlags.Module | ts.SymbolFlags.JSContainer;
                const excludeFlags = ts.SymbolFlags.ValueModuleExcludes & ~ts.SymbolFlags.JSContainer;
                forEachIdentifierInEntityName(propertyAccess.expression, (id, original) => {
                    if (original) {
                        // Note: add declaration to original symbol, not the special-syntax's symbol, so that namespaces work for type lookup
                        addDeclarationToSymbol(original, id, flags);
                        return original;
                    }
                    else {
                        return symbol = declareSymbol(symbol ? symbol.exports : container.locals, symbol, id, flags, excludeFlags);
                    }
                });
            }
            if (!symbol || !(symbol.flags & (ts.SymbolFlags.Function | ts.SymbolFlags.Class | ts.SymbolFlags.NamespaceModule | ts.SymbolFlags.ObjectLiteral))) {
                return;
            }
            // Set up the members collection if it doesn't exist already
            const symbolTable = isPrototypeProperty ?
                (symbol.members || (symbol.members = ts.createSymbolTable())) :
                (symbol.exports || (symbol.exports = ts.createSymbolTable()));
            // Declare the method/property
            const jsContainerFlag = isToplevelNamespaceableInitializer ? ts.SymbolFlags.JSContainer : 0;
            const isMethod = ts.isFunctionLikeDeclaration(ts.getAssignedJavascriptInitializer(propertyAccess));
            const symbolFlags = (isMethod ? ts.SymbolFlags.Method : ts.SymbolFlags.Property) | jsContainerFlag;
            const symbolExcludes = (isMethod ? ts.SymbolFlags.MethodExcludes : ts.SymbolFlags.PropertyExcludes) & ~jsContainerFlag;
            declareSymbol(symbolTable, symbol, propertyAccess, symbolFlags, symbolExcludes);
        }
        function getParentOfBinaryExpression(expr) {
            while (ts.isBinaryExpression(expr.parent)) {
                expr = expr.parent;
            }
            return expr.parent;
        }
        function lookupSymbolForPropertyAccess(node, lookupContainer = container) {
            if (ts.isIdentifier(node)) {
                return lookupSymbolForNameWorker(lookupContainer, node.escapedText);
            }
            else {
                const symbol = ts.getJSInitializerSymbol(lookupSymbolForPropertyAccess(node.expression));
                return symbol && symbol.exports && symbol.exports.get(node.name.escapedText);
            }
        }
        function forEachIdentifierInEntityName(e, action) {
            if (isExportsOrModuleExportsOrAlias(file, e)) {
                return file.symbol;
            }
            else if (ts.isIdentifier(e)) {
                return action(e, lookupSymbolForPropertyAccess(e));
            }
            else {
                const s = ts.getJSInitializerSymbol(forEachIdentifierInEntityName(e.expression, action));
                ts.Debug.assert(!!s && !!s.exports);
                return action(e.name, s.exports.get(e.name.escapedText));
            }
        }
        function bindCallExpression(node) {
            // We're only inspecting call expressions to detect CommonJS modules, so we can skip
            // this check if we've already seen the module indicator
            if (!file.commonJsModuleIndicator && ts.isRequireCall(node, /*checkArgumentIsStringLiteralLike*/ false)) {
                setCommonJsModuleIndicator(node);
            }
        }
        function bindClassLikeDeclaration(node) {
            if (node.kind === ts.SyntaxKind.ClassDeclaration) {
                bindBlockScopedDeclaration(node, ts.SymbolFlags.Class, ts.SymbolFlags.ClassExcludes);
            }
            else {
                const bindingName = node.name ? node.name.escapedText : ts.InternalSymbolName.Class;
                bindAnonymousDeclaration(node, ts.SymbolFlags.Class, bindingName);
                // Add name of class expression into the map for semantic classifier
                if (node.name) {
                    classifiableNames.set(node.name.escapedText, true);
                }
            }
            const symbol = node.symbol;
            // TypeScript 1.0 spec (April 2014): 8.4
            // Every class automatically contains a static property member named 'prototype', the
            // type of which is an instantiation of the class type with type Any supplied as a type
            // argument for each type parameter. It is an error to explicitly declare a static
            // property member with the name 'prototype'.
            //
            // Note: we check for this here because this class may be merging into a module.  The
            // module might have an exported variable called 'prototype'.  We can't allow that as
            // that would clash with the built-in 'prototype' for the class.
            const prototypeSymbol = createSymbol(ts.SymbolFlags.Property | ts.SymbolFlags.Prototype, "prototype");
            const symbolExport = symbol.exports.get(prototypeSymbol.escapedName);
            if (symbolExport) {
                if (node.name) {
                    node.name.parent = node;
                }
                file.bindDiagnostics.push(createDiagnosticForNode(symbolExport.declarations[0], Diagnostics.Duplicate_identifier_0, ts.symbolName(prototypeSymbol)));
            }
            symbol.exports.set(prototypeSymbol.escapedName, prototypeSymbol);
            prototypeSymbol.parent = symbol;
        }
        function bindEnumDeclaration(node) {
            return ts.isConst(node)
                ? bindBlockScopedDeclaration(node, ts.SymbolFlags.ConstEnum, ts.SymbolFlags.ConstEnumExcludes)
                : bindBlockScopedDeclaration(node, ts.SymbolFlags.RegularEnum, ts.SymbolFlags.RegularEnumExcludes);
        }
        function bindVariableDeclarationOrBindingElement(node) {
            if (inStrictMode) {
                checkStrictModeEvalOrArguments(node, node.name);
            }
            if (!ts.isBindingPattern(node.name)) {
                if (ts.isBlockOrCatchScoped(node)) {
                    bindBlockScopedVariableDeclaration(node);
                }
                else if (ts.isParameterDeclaration(node)) {
                    // It is safe to walk up parent chain to find whether the node is a destructing parameter declaration
                    // because its parent chain has already been set up, since parents are set before descending into children.
                    //
                    // If node is a binding element in parameter declaration, we need to use ParameterExcludes.
                    // Using ParameterExcludes flag allows the compiler to report an error on duplicate identifiers in Parameter Declaration
                    // For example:
                    //      function foo([a,a]) {} // Duplicate Identifier error
                    //      function bar(a,a) {}   // Duplicate Identifier error, parameter declaration in this case is handled in bindParameter
                    //                             // which correctly set excluded symbols
                    declareSymbolAndAddToSymbolTable(node, ts.SymbolFlags.FunctionScopedVariable, ts.SymbolFlags.ParameterExcludes);
                }
                else {
                    declareSymbolAndAddToSymbolTable(node, ts.SymbolFlags.FunctionScopedVariable, ts.SymbolFlags.FunctionScopedVariableExcludes);
                }
            }
        }
        function bindParameter(node) {
            if (inStrictMode && !(node.flags & ts.NodeFlags.Ambient)) {
                // It is a SyntaxError if the identifier eval or arguments appears within a FormalParameterList of a
                // strict mode FunctionLikeDeclaration or FunctionExpression(13.1)
                checkStrictModeEvalOrArguments(node, node.name);
            }
            if (ts.isBindingPattern(node.name)) {
                bindAnonymousDeclaration(node, ts.SymbolFlags.FunctionScopedVariable, "__" + node.parent.parameters.indexOf(node));
            }
            else {
                declareSymbolAndAddToSymbolTable(node, ts.SymbolFlags.FunctionScopedVariable, ts.SymbolFlags.ParameterExcludes);
            }
            // If this is a property-parameter, then also declare the property symbol into the
            // containing class.
            if (ts.isParameterPropertyDeclaration(node)) {
                const classDeclaration = node.parent.parent;
                declareSymbol(classDeclaration.symbol.members, classDeclaration.symbol, node, ts.SymbolFlags.Property | (node.questionToken ? ts.SymbolFlags.Optional : ts.SymbolFlags.None), ts.SymbolFlags.PropertyExcludes);
            }
        }
        function bindFunctionDeclaration(node) {
            if (!file.isDeclarationFile && !(node.flags & ts.NodeFlags.Ambient)) {
                if (ts.isAsyncFunction(node)) {
                    emitFlags |= ts.NodeFlags.HasAsyncFunctions;
                }
            }
            checkStrictModeFunctionName(node);
            if (inStrictMode) {
                checkStrictModeFunctionDeclaration(node);
                bindBlockScopedDeclaration(node, ts.SymbolFlags.Function, ts.SymbolFlags.FunctionExcludes);
            }
            else {
                declareSymbolAndAddToSymbolTable(node, ts.SymbolFlags.Function, ts.SymbolFlags.FunctionExcludes);
            }
        }
        function bindFunctionExpression(node) {
            if (!file.isDeclarationFile && !(node.flags & ts.NodeFlags.Ambient)) {
                if (ts.isAsyncFunction(node)) {
                    emitFlags |= ts.NodeFlags.HasAsyncFunctions;
                }
            }
            if (currentFlow) {
                node.flowNode = currentFlow;
            }
            checkStrictModeFunctionName(node);
            const bindingName = node.name ? node.name.escapedText : ts.InternalSymbolName.Function;
            return bindAnonymousDeclaration(node, ts.SymbolFlags.Function, bindingName);
        }
        function bindPropertyOrMethodOrAccessor(node, symbolFlags, symbolExcludes) {
            if (!file.isDeclarationFile && !(node.flags & ts.NodeFlags.Ambient) && ts.isAsyncFunction(node)) {
                emitFlags |= ts.NodeFlags.HasAsyncFunctions;
            }
            if (currentFlow && ts.isObjectLiteralOrClassExpressionMethod(node)) {
                node.flowNode = currentFlow;
            }
            return ts.hasDynamicName(node)
                ? bindAnonymousDeclaration(node, symbolFlags, ts.InternalSymbolName.Computed)
                : declareSymbolAndAddToSymbolTable(node, symbolFlags, symbolExcludes);
        }
        function getInferTypeContainer(node) {
            while (node) {
                const parent = node.parent;
                if (parent && parent.kind === ts.SyntaxKind.ConditionalType && parent.extendsType === node) {
                    return parent;
                }
                node = parent;
            }
            return undefined;
        }
        function bindTypeParameter(node) {
            if (node.parent.kind === ts.SyntaxKind.InferType) {
                const container = getInferTypeContainer(node.parent);
                if (container) {
                    if (!container.locals) {
                        container.locals = ts.createSymbolTable();
                    }
                    declareSymbol(container.locals, /*parent*/ undefined, node, ts.SymbolFlags.TypeParameter, ts.SymbolFlags.TypeParameterExcludes);
                }
                else {
                    bindAnonymousDeclaration(node, ts.SymbolFlags.TypeParameter, getDeclarationName(node));
                }
            }
            else {
                declareSymbolAndAddToSymbolTable(node, ts.SymbolFlags.TypeParameter, ts.SymbolFlags.TypeParameterExcludes);
            }
        }
        // reachability checks
        function shouldReportErrorOnModuleDeclaration(node) {
            const instanceState = getModuleInstanceState(node);
            return instanceState === 1 /* Instantiated */ || (instanceState === 2 /* ConstEnumOnly */ && options.preserveConstEnums);
        }
        function checkUnreachable(node) {
            if (!(currentFlow.flags & ts.FlowFlags.Unreachable)) {
                return false;
            }
            if (currentFlow === unreachableFlow) {
                const reportError = 
                // report error on all statements except empty ones
                (ts.isStatementButNotDeclaration(node) && node.kind !== ts.SyntaxKind.EmptyStatement) ||
                    // report error on class declarations
                    node.kind === ts.SyntaxKind.ClassDeclaration ||
                    // report error on instantiated modules or const-enums only modules if preserveConstEnums is set
                    (node.kind === ts.SyntaxKind.ModuleDeclaration && shouldReportErrorOnModuleDeclaration(node)) ||
                    // report error on regular enums and const enums if preserveConstEnums is set
                    (node.kind === ts.SyntaxKind.EnumDeclaration && (!ts.isConstEnumDeclaration(node) || options.preserveConstEnums));
                if (reportError) {
                    currentFlow = reportedUnreachableFlow;
                    // unreachable code is reported if
                    // - user has explicitly asked about it AND
                    // - statement is in not ambient context (statements in ambient context is already an error
                    //   so we should not report extras) AND
                    //   - node is not variable statement OR
                    //   - node is block scoped variable statement OR
                    //   - node is not block scoped variable statement and at least one variable declaration has initializer
                    //   Rationale: we don't want to report errors on non-initialized var's since they are hoisted
                    //   On the other side we do want to report errors on non-initialized 'lets' because of TDZ
                    const reportUnreachableCode = !options.allowUnreachableCode &&
                        !(node.flags & ts.NodeFlags.Ambient) &&
                        (node.kind !== ts.SyntaxKind.VariableStatement ||
                            ts.getCombinedNodeFlags(node.declarationList) & ts.NodeFlags.BlockScoped ||
                            ts.forEach(node.declarationList.declarations, d => d.initializer));
                    if (reportUnreachableCode) {
                        errorOnFirstToken(node, Diagnostics.Unreachable_code_detected);
                    }
                }
            }
            return true;
        }
    }
    /* @internal */
    function isExportsOrModuleExportsOrAlias(sourceFile, node) {
        return ts.isExportsIdentifier(node) ||
            ts.isModuleExportsPropertyAccessExpression(node) ||
            ts.isIdentifier(node) && isNameOfExportsOrModuleExportsAliasDeclaration(sourceFile, node);
    }
    ts.isExportsOrModuleExportsOrAlias = isExportsOrModuleExportsOrAlias;
    function isNameOfExportsOrModuleExportsAliasDeclaration(sourceFile, node) {
        const symbol = lookupSymbolForNameWorker(sourceFile, node.escapedText);
        return symbol && symbol.valueDeclaration && ts.isVariableDeclaration(symbol.valueDeclaration) &&
            symbol.valueDeclaration.initializer && isExportsOrModuleExportsOrAliasOrAssignment(sourceFile, symbol.valueDeclaration.initializer);
    }
    function isExportsOrModuleExportsOrAliasOrAssignment(sourceFile, node) {
        return isExportsOrModuleExportsOrAlias(sourceFile, node) ||
            (ts.isAssignmentExpression(node, /*excludeCompoundAssignment*/ true) && (isExportsOrModuleExportsOrAliasOrAssignment(sourceFile, node.left) || isExportsOrModuleExportsOrAliasOrAssignment(sourceFile, node.right)));
    }
    function lookupSymbolForNameWorker(container, name) {
        const local = container.locals && container.locals.get(name);
        if (local) {
            return local.exportSymbol || local;
        }
        return container.symbol && container.symbol.exports && container.symbol.exports.get(name);
    }
    /**
     * Computes the transform flags for a node, given the transform flags of its subtree
     *
     * @param node The node to analyze
     * @param subtreeFlags Transform flags computed for this node's subtree
     */
    function computeTransformFlagsForNode(node, subtreeFlags) {
        const kind = node.kind;
        switch (kind) {
            case ts.SyntaxKind.CallExpression:
                return computeCallExpression(node, subtreeFlags);
            case ts.SyntaxKind.NewExpression:
                return computeNewExpression(node, subtreeFlags);
            case ts.SyntaxKind.ModuleDeclaration:
                return computeModuleDeclaration(node, subtreeFlags);
            case ts.SyntaxKind.ParenthesizedExpression:
                return computeParenthesizedExpression(node, subtreeFlags);
            case ts.SyntaxKind.BinaryExpression:
                return computeBinaryExpression(node, subtreeFlags);
            case ts.SyntaxKind.ExpressionStatement:
                return computeExpressionStatement(node, subtreeFlags);
            case ts.SyntaxKind.Parameter:
                return computeParameter(node, subtreeFlags);
            case ts.SyntaxKind.ArrowFunction:
                return computeArrowFunction(node, subtreeFlags);
            case ts.SyntaxKind.FunctionExpression:
                return computeFunctionExpression(node, subtreeFlags);
            case ts.SyntaxKind.FunctionDeclaration:
                return computeFunctionDeclaration(node, subtreeFlags);
            case ts.SyntaxKind.VariableDeclaration:
                return computeVariableDeclaration(node, subtreeFlags);
            case ts.SyntaxKind.VariableDeclarationList:
                return computeVariableDeclarationList(node, subtreeFlags);
            case ts.SyntaxKind.VariableStatement:
                return computeVariableStatement(node, subtreeFlags);
            case ts.SyntaxKind.LabeledStatement:
                return computeLabeledStatement(node, subtreeFlags);
            case ts.SyntaxKind.ClassDeclaration:
                return computeClassDeclaration(node, subtreeFlags);
            case ts.SyntaxKind.ClassExpression:
                return computeClassExpression(node, subtreeFlags);
            case ts.SyntaxKind.HeritageClause:
                return computeHeritageClause(node, subtreeFlags);
            case ts.SyntaxKind.CatchClause:
                return computeCatchClause(node, subtreeFlags);
            case ts.SyntaxKind.ExpressionWithTypeArguments:
                return computeExpressionWithTypeArguments(node, subtreeFlags);
            case ts.SyntaxKind.Constructor:
                return computeConstructor(node, subtreeFlags);
            case ts.SyntaxKind.PropertyDeclaration:
                return computePropertyDeclaration(node, subtreeFlags);
            case ts.SyntaxKind.MethodDeclaration:
                return computeMethod(node, subtreeFlags);
            case ts.SyntaxKind.GetAccessor:
            case ts.SyntaxKind.SetAccessor:
                return computeAccessor(node, subtreeFlags);
            case ts.SyntaxKind.ImportEqualsDeclaration:
                return computeImportEquals(node, subtreeFlags);
            case ts.SyntaxKind.PropertyAccessExpression:
                return computePropertyAccess(node, subtreeFlags);
            case ts.SyntaxKind.ElementAccessExpression:
                return computeElementAccess(node, subtreeFlags);
            default:
                return computeOther(node, kind, subtreeFlags);
        }
    }
    ts.computeTransformFlagsForNode = computeTransformFlagsForNode;
    function computeCallExpression(node, subtreeFlags) {
        let transformFlags = subtreeFlags;
        const expression = node.expression;
        if (node.typeArguments) {
            transformFlags |= 3 /* AssertTypeScript */;
        }
        if (subtreeFlags & 524288 /* ContainsSpread */
            || (expression.transformFlags & (134217728 /* Super */ | 268435456 /* ContainsSuper */))) {
            // If the this node contains a SpreadExpression, or is a super call, then it is an ES6
            // node.
            transformFlags |= 192 /* AssertES2015 */;
            // super property or element accesses could be inside lambdas, etc, and need a captured `this`,
            // while super keyword for super calls (indicated by TransformFlags.Super) does not (since it can only be top-level in a constructor)
            if (expression.transformFlags & 268435456 /* ContainsSuper */) {
                transformFlags |= 16384 /* ContainsLexicalThis */;
            }
        }
        if (expression.kind === ts.SyntaxKind.ImportKeyword) {
            transformFlags |= 67108864 /* ContainsDynamicImport */;
            // A dynamic 'import()' call that contains a lexical 'this' will
            // require a captured 'this' when emitting down-level.
            if (subtreeFlags & 16384 /* ContainsLexicalThis */) {
                transformFlags |= 32768 /* ContainsCapturedLexicalThis */;
            }
        }
        node.transformFlags = transformFlags | 536870912 /* HasComputedFlags */;
        return transformFlags & ~940049729 /* ArrayLiteralOrCallOrNewExcludes */;
    }
    function computeNewExpression(node, subtreeFlags) {
        let transformFlags = subtreeFlags;
        if (node.typeArguments) {
            transformFlags |= 3 /* AssertTypeScript */;
        }
        if (subtreeFlags & 524288 /* ContainsSpread */) {
            // If the this node contains a SpreadElementExpression then it is an ES6
            // node.
            transformFlags |= 192 /* AssertES2015 */;
        }
        node.transformFlags = transformFlags | 536870912 /* HasComputedFlags */;
        return transformFlags & ~940049729 /* ArrayLiteralOrCallOrNewExcludes */;
    }
    function computeBinaryExpression(node, subtreeFlags) {
        let transformFlags = subtreeFlags;
        const operatorTokenKind = node.operatorToken.kind;
        const leftKind = node.left.kind;
        if (operatorTokenKind === ts.SyntaxKind.EqualsToken && leftKind === ts.SyntaxKind.ObjectLiteralExpression) {
            // Destructuring object assignments with are ES2015 syntax
            // and possibly ESNext if they contain rest
            transformFlags |= 8 /* AssertESNext */ | 192 /* AssertES2015 */ | 3072 /* AssertDestructuringAssignment */;
        }
        else if (operatorTokenKind === ts.SyntaxKind.EqualsToken && leftKind === ts.SyntaxKind.ArrayLiteralExpression) {
            // Destructuring assignments are ES2015 syntax.
            transformFlags |= 192 /* AssertES2015 */ | 3072 /* AssertDestructuringAssignment */;
        }
        else if (operatorTokenKind === ts.SyntaxKind.AsteriskAsteriskToken
            || operatorTokenKind === ts.SyntaxKind.AsteriskAsteriskEqualsToken) {
            // Exponentiation is ES2016 syntax.
            transformFlags |= 32 /* AssertES2016 */;
        }
        node.transformFlags = transformFlags | 536870912 /* HasComputedFlags */;
        return transformFlags & ~939525441 /* NodeExcludes */;
    }
    function computeParameter(node, subtreeFlags) {
        let transformFlags = subtreeFlags;
        const name = node.name;
        const initializer = node.initializer;
        const dotDotDotToken = node.dotDotDotToken;
        // The '?' token, type annotations, decorators, and 'this' parameters are TypeSCript
        // syntax.
        if (node.questionToken
            || node.type
            || subtreeFlags & 4096 /* ContainsDecorators */
            || ts.isThisIdentifier(name)) {
            transformFlags |= 3 /* AssertTypeScript */;
        }
        // If a parameter has an accessibility modifier, then it is TypeScript syntax.
        if (ts.hasModifier(node, ts.ModifierFlags.ParameterPropertyModifier)) {
            transformFlags |= 3 /* AssertTypeScript */ | 262144 /* ContainsParameterPropertyAssignments */;
        }
        // parameters with object rest destructuring are ES Next syntax
        if (subtreeFlags & 1048576 /* ContainsObjectRest */) {
            transformFlags |= 8 /* AssertESNext */;
        }
        // If a parameter has an initializer, a binding pattern or a dotDotDot token, then
        // it is ES6 syntax and its container must emit default value assignments or parameter destructuring downlevel.
        if (subtreeFlags & 8388608 /* ContainsBindingPattern */ || initializer || dotDotDotToken) {
            transformFlags |= 192 /* AssertES2015 */ | 131072 /* ContainsDefaultValueAssignments */;
        }
        node.transformFlags = transformFlags | 536870912 /* HasComputedFlags */;
        return transformFlags & ~939525441 /* ParameterExcludes */;
    }
    function computeParenthesizedExpression(node, subtreeFlags) {
        let transformFlags = subtreeFlags;
        const expression = node.expression;
        const expressionKind = expression.kind;
        const expressionTransformFlags = expression.transformFlags;
        // If the node is synthesized, it means the emitter put the parentheses there,
        // not the user. If we didn't want them, the emitter would not have put them
        // there.
        if (expressionKind === ts.SyntaxKind.AsExpression
            || expressionKind === ts.SyntaxKind.TypeAssertionExpression) {
            transformFlags |= 3 /* AssertTypeScript */;
        }
        // If the expression of a ParenthesizedExpression is a destructuring assignment,
        // then the ParenthesizedExpression is a destructuring assignment.
        if (expressionTransformFlags & 1024 /* DestructuringAssignment */) {
            transformFlags |= 1024 /* DestructuringAssignment */;
        }
        node.transformFlags = transformFlags | 536870912 /* HasComputedFlags */;
        return transformFlags & ~536872257 /* OuterExpressionExcludes */;
    }
    function computeClassDeclaration(node, subtreeFlags) {
        let transformFlags;
        if (ts.hasModifier(node, ts.ModifierFlags.Ambient)) {
            // An ambient declaration is TypeScript syntax.
            transformFlags = 3 /* AssertTypeScript */;
        }
        else {
            // A ClassDeclaration is ES6 syntax.
            transformFlags = subtreeFlags | 192 /* AssertES2015 */;
            // A class with a parameter property assignment, property initializer, or decorator is
            // TypeScript syntax.
            // An exported declaration may be TypeScript syntax, but is handled by the visitor
            // for a namespace declaration.
            if ((subtreeFlags & 274432 /* TypeScriptClassSyntaxMask */)
                || node.typeParameters) {
                transformFlags |= 3 /* AssertTypeScript */;
            }
            if (subtreeFlags & 65536 /* ContainsLexicalThisInComputedPropertyName */) {
                // A computed property name containing `this` might need to be rewritten,
                // so propagate the ContainsLexicalThis flag upward.
                transformFlags |= 16384 /* ContainsLexicalThis */;
            }
        }
        node.transformFlags = transformFlags | 536870912 /* HasComputedFlags */;
        return transformFlags & ~942011713 /* ClassExcludes */;
    }
    function computeClassExpression(node, subtreeFlags) {
        // A ClassExpression is ES6 syntax.
        let transformFlags = subtreeFlags | 192 /* AssertES2015 */;
        // A class with a parameter property assignment, property initializer, or decorator is
        // TypeScript syntax.
        if (subtreeFlags & 274432 /* TypeScriptClassSyntaxMask */
            || node.typeParameters) {
            transformFlags |= 3 /* AssertTypeScript */;
        }
        if (subtreeFlags & 65536 /* ContainsLexicalThisInComputedPropertyName */) {
            // A computed property name containing `this` might need to be rewritten,
            // so propagate the ContainsLexicalThis flag upward.
            transformFlags |= 16384 /* ContainsLexicalThis */;
        }
        node.transformFlags = transformFlags | 536870912 /* HasComputedFlags */;
        return transformFlags & ~942011713 /* ClassExcludes */;
    }
    function computeHeritageClause(node, subtreeFlags) {
        let transformFlags = subtreeFlags;
        switch (node.token) {
            case ts.SyntaxKind.ExtendsKeyword:
                // An `extends` HeritageClause is ES6 syntax.
                transformFlags |= 192 /* AssertES2015 */;
                break;
            case ts.SyntaxKind.ImplementsKeyword:
                // An `implements` HeritageClause is TypeScript syntax.
                transformFlags |= 3 /* AssertTypeScript */;
                break;
            default:
                ts.Debug.fail("Unexpected token for heritage clause");
                break;
        }
        node.transformFlags = transformFlags | 536870912 /* HasComputedFlags */;
        return transformFlags & ~939525441 /* NodeExcludes */;
    }
    function computeCatchClause(node, subtreeFlags) {
        let transformFlags = subtreeFlags;
        if (!node.variableDeclaration) {
            transformFlags |= 8 /* AssertESNext */;
        }
        else if (ts.isBindingPattern(node.variableDeclaration.name)) {
            transformFlags |= 192 /* AssertES2015 */;
        }
        node.transformFlags = transformFlags | 536870912 /* HasComputedFlags */;
        return transformFlags & ~940574017 /* CatchClauseExcludes */;
    }
    function computeExpressionWithTypeArguments(node, subtreeFlags) {
        // An ExpressionWithTypeArguments is ES6 syntax, as it is used in the
        // extends clause of a class.
        let transformFlags = subtreeFlags | 192 /* AssertES2015 */;
        // If an ExpressionWithTypeArguments contains type arguments, then it
        // is TypeScript syntax.
        if (node.typeArguments) {
            transformFlags |= 3 /* AssertTypeScript */;
        }
        node.transformFlags = transformFlags | 536870912 /* HasComputedFlags */;
        return transformFlags & ~939525441 /* NodeExcludes */;
    }
    function computeConstructor(node, subtreeFlags) {
        let transformFlags = subtreeFlags;
        // TypeScript-specific modifiers and overloads are TypeScript syntax
        if (ts.hasModifier(node, ts.ModifierFlags.TypeScriptModifier)
            || !node.body) {
            transformFlags |= 3 /* AssertTypeScript */;
        }
        // function declarations with object rest destructuring are ES Next syntax
        if (subtreeFlags & 1048576 /* ContainsObjectRest */) {
            transformFlags |= 8 /* AssertESNext */;
        }
        node.transformFlags = transformFlags | 536870912 /* HasComputedFlags */;
        return transformFlags & ~1003668801 /* ConstructorExcludes */;
    }
    function computeMethod(node, subtreeFlags) {
        // A MethodDeclaration is ES6 syntax.
        let transformFlags = subtreeFlags | 192 /* AssertES2015 */;
        // Decorators, TypeScript-specific modifiers, type parameters, type annotations, and
        // overloads are TypeScript syntax.
        if (node.decorators
            || ts.hasModifier(node, ts.ModifierFlags.TypeScriptModifier)
            || node.typeParameters
            || node.type
            || (node.name && ts.isComputedPropertyName(node.name)) // While computed method names aren't typescript, the TS transform must visit them to emit property declarations correctly
            || !node.body) {
            transformFlags |= 3 /* AssertTypeScript */;
        }
        // function declarations with object rest destructuring are ES Next syntax
        if (subtreeFlags & 1048576 /* ContainsObjectRest */) {
            transformFlags |= 8 /* AssertESNext */;
        }
        // An async method declaration is ES2017 syntax.
        if (ts.hasModifier(node, ts.ModifierFlags.Async)) {
            transformFlags |= node.asteriskToken ? 8 /* AssertESNext */ : 16 /* AssertES2017 */;
        }
        if (node.asteriskToken) {
            transformFlags |= 768 /* AssertGenerator */;
        }
        node.transformFlags = transformFlags | 536870912 /* HasComputedFlags */;
        return transformFlags & ~1003668801 /* MethodOrAccessorExcludes */;
    }
    function computeAccessor(node, subtreeFlags) {
        let transformFlags = subtreeFlags;
        // Decorators, TypeScript-specific modifiers, type annotations, and overloads are
        // TypeScript syntax.
        if (node.decorators
            || ts.hasModifier(node, ts.ModifierFlags.TypeScriptModifier)
            || node.type
            || (node.name && ts.isComputedPropertyName(node.name)) // While computed accessor names aren't typescript, the TS transform must visit them to emit property declarations correctly
            || !node.body) {
            transformFlags |= 3 /* AssertTypeScript */;
        }
        // function declarations with object rest destructuring are ES Next syntax
        if (subtreeFlags & 1048576 /* ContainsObjectRest */) {
            transformFlags |= 8 /* AssertESNext */;
        }
        node.transformFlags = transformFlags | 536870912 /* HasComputedFlags */;
        return transformFlags & ~1003668801 /* MethodOrAccessorExcludes */;
    }
    function computePropertyDeclaration(node, subtreeFlags) {
        // A PropertyDeclaration is TypeScript syntax.
        let transformFlags = subtreeFlags | 3 /* AssertTypeScript */;
        // If the PropertyDeclaration has an initializer, we need to inform its ancestor
        // so that it handle the transformation.
        if (node.initializer) {
            transformFlags |= 8192 /* ContainsPropertyInitializer */;
        }
        node.transformFlags = transformFlags | 536870912 /* HasComputedFlags */;
        return transformFlags & ~939525441 /* NodeExcludes */;
    }
    function computeFunctionDeclaration(node, subtreeFlags) {
        let transformFlags;
        const modifierFlags = ts.getModifierFlags(node);
        const body = node.body;
        if (!body || (modifierFlags & ts.ModifierFlags.Ambient)) {
            // An ambient declaration is TypeScript syntax.
            // A FunctionDeclaration without a body is an overload and is TypeScript syntax.
            transformFlags = 3 /* AssertTypeScript */;
        }
        else {
            transformFlags = subtreeFlags | 33554432 /* ContainsHoistedDeclarationOrCompletion */;
            // TypeScript-specific modifiers, type parameters, and type annotations are TypeScript
            // syntax.
            if (modifierFlags & ts.ModifierFlags.TypeScriptModifier
                || node.typeParameters
                || node.type) {
                transformFlags |= 3 /* AssertTypeScript */;
            }
            // An async function declaration is ES2017 syntax.
            if (modifierFlags & ts.ModifierFlags.Async) {
                transformFlags |= node.asteriskToken ? 8 /* AssertESNext */ : 16 /* AssertES2017 */;
            }
            // function declarations with object rest destructuring are ES Next syntax
            if (subtreeFlags & 1048576 /* ContainsObjectRest */) {
                transformFlags |= 8 /* AssertESNext */;
            }
            // If a FunctionDeclaration's subtree has marked the container as needing to capture the
            // lexical this, or the function contains parameters with initializers, then this node is
            // ES6 syntax.
            if (subtreeFlags & 163840 /* ES2015FunctionSyntaxMask */) {
                transformFlags |= 192 /* AssertES2015 */;
            }
            // If a FunctionDeclaration is generator function and is the body of a
            // transformed async function, then this node can be transformed to a
            // down-level generator.
            // Currently we do not support transforming any other generator fucntions
            // down level.
            if (node.asteriskToken) {
                transformFlags |= 768 /* AssertGenerator */;
            }
        }
        node.transformFlags = transformFlags | 536870912 /* HasComputedFlags */;
        return transformFlags & ~1003935041 /* FunctionExcludes */;
    }
    function computeFunctionExpression(node, subtreeFlags) {
        let transformFlags = subtreeFlags;
        // TypeScript-specific modifiers, type parameters, and type annotations are TypeScript
        // syntax.
        if (ts.hasModifier(node, ts.ModifierFlags.TypeScriptModifier)
            || node.typeParameters
            || node.type) {
            transformFlags |= 3 /* AssertTypeScript */;
        }
        // An async function expression is ES2017 syntax.
        if (ts.hasModifier(node, ts.ModifierFlags.Async)) {
            transformFlags |= node.asteriskToken ? 8 /* AssertESNext */ : 16 /* AssertES2017 */;
        }
        // function expressions with object rest destructuring are ES Next syntax
        if (subtreeFlags & 1048576 /* ContainsObjectRest */) {
            transformFlags |= 8 /* AssertESNext */;
        }
        // If a FunctionExpression's subtree has marked the container as needing to capture the
        // lexical this, or the function contains parameters with initializers, then this node is
        // ES6 syntax.
        if (subtreeFlags & 163840 /* ES2015FunctionSyntaxMask */) {
            transformFlags |= 192 /* AssertES2015 */;
        }
        // If a FunctionExpression is generator function and is the body of a
        // transformed async function, then this node can be transformed to a
        // down-level generator.
        if (node.asteriskToken) {
            transformFlags |= 768 /* AssertGenerator */;
        }
        node.transformFlags = transformFlags | 536870912 /* HasComputedFlags */;
        return transformFlags & ~1003935041 /* FunctionExcludes */;
    }
    function computeArrowFunction(node, subtreeFlags) {
        // An ArrowFunction is ES6 syntax, and excludes markers that should not escape the scope of an ArrowFunction.
        let transformFlags = subtreeFlags | 192 /* AssertES2015 */;
        // TypeScript-specific modifiers, type parameters, and type annotations are TypeScript
        // syntax.
        if (ts.hasModifier(node, ts.ModifierFlags.TypeScriptModifier)
            || node.typeParameters
            || node.type) {
            transformFlags |= 3 /* AssertTypeScript */;
        }
        // An async arrow function is ES2017 syntax.
        if (ts.hasModifier(node, ts.ModifierFlags.Async)) {
            transformFlags |= 16 /* AssertES2017 */;
        }
        // arrow functions with object rest destructuring are ES Next syntax
        if (subtreeFlags & 1048576 /* ContainsObjectRest */) {
            transformFlags |= 8 /* AssertESNext */;
        }
        // If an ArrowFunction contains a lexical this, its container must capture the lexical this.
        if (subtreeFlags & 16384 /* ContainsLexicalThis */) {
            transformFlags |= 32768 /* ContainsCapturedLexicalThis */;
        }
        node.transformFlags = transformFlags | 536870912 /* HasComputedFlags */;
        return transformFlags & ~1003902273 /* ArrowFunctionExcludes */;
    }
    function computePropertyAccess(node, subtreeFlags) {
        let transformFlags = subtreeFlags;
        // If a PropertyAccessExpression starts with a super keyword, then it is
        // ES6 syntax, and requires a lexical `this` binding.
        if (transformFlags & 134217728 /* Super */) {
            transformFlags ^= 134217728 /* Super */;
            transformFlags |= 268435456 /* ContainsSuper */;
        }
        node.transformFlags = transformFlags | 536870912 /* HasComputedFlags */;
        return transformFlags & ~671089985 /* PropertyAccessExcludes */;
    }
    function computeElementAccess(node, subtreeFlags) {
        let transformFlags = subtreeFlags;
        const expression = node.expression;
        const expressionFlags = expression.transformFlags; // We do not want to aggregate flags from the argument expression for super/this capturing
        // If an ElementAccessExpression starts with a super keyword, then it is
        // ES6 syntax, and requires a lexical `this` binding.
        if (expressionFlags & 134217728 /* Super */) {
            transformFlags &= ~134217728 /* Super */;
            transformFlags |= 268435456 /* ContainsSuper */;
        }
        node.transformFlags = transformFlags | 536870912 /* HasComputedFlags */;
        return transformFlags & ~671089985 /* PropertyAccessExcludes */;
    }
    function computeVariableDeclaration(node, subtreeFlags) {
        let transformFlags = subtreeFlags;
        transformFlags |= 192 /* AssertES2015 */ | 8388608 /* ContainsBindingPattern */;
        // A VariableDeclaration containing ObjectRest is ESNext syntax
        if (subtreeFlags & 1048576 /* ContainsObjectRest */) {
            transformFlags |= 8 /* AssertESNext */;
        }
        // Type annotations are TypeScript syntax.
        if (node.type) {
            transformFlags |= 3 /* AssertTypeScript */;
        }
        node.transformFlags = transformFlags | 536870912 /* HasComputedFlags */;
        return transformFlags & ~939525441 /* NodeExcludes */;
    }
    function computeVariableStatement(node, subtreeFlags) {
        let transformFlags;
        const declarationListTransformFlags = node.declarationList.transformFlags;
        // An ambient declaration is TypeScript syntax.
        if (ts.hasModifier(node, ts.ModifierFlags.Ambient)) {
            transformFlags = 3 /* AssertTypeScript */;
        }
        else {
            transformFlags = subtreeFlags;
            if (declarationListTransformFlags & 8388608 /* ContainsBindingPattern */) {
                transformFlags |= 192 /* AssertES2015 */;
            }
        }
        node.transformFlags = transformFlags | 536870912 /* HasComputedFlags */;
        return transformFlags & ~939525441 /* NodeExcludes */;
    }
    function computeLabeledStatement(node, subtreeFlags) {
        let transformFlags = subtreeFlags;
        // A labeled statement containing a block scoped binding *may* need to be transformed from ES6.
        if (subtreeFlags & 4194304 /* ContainsBlockScopedBinding */
            && ts.isIterationStatement(node, /*lookInLabeledStatements*/ true)) {
            transformFlags |= 192 /* AssertES2015 */;
        }
        node.transformFlags = transformFlags | 536870912 /* HasComputedFlags */;
        return transformFlags & ~939525441 /* NodeExcludes */;
    }
    function computeImportEquals(node, subtreeFlags) {
        let transformFlags = subtreeFlags;
        // An ImportEqualsDeclaration with a namespace reference is TypeScript.
        if (!ts.isExternalModuleImportEqualsDeclaration(node)) {
            transformFlags |= 3 /* AssertTypeScript */;
        }
        node.transformFlags = transformFlags | 536870912 /* HasComputedFlags */;
        return transformFlags & ~939525441 /* NodeExcludes */;
    }
    function computeExpressionStatement(node, subtreeFlags) {
        let transformFlags = subtreeFlags;
        // If the expression of an expression statement is a destructuring assignment,
        // then we treat the statement as ES6 so that we can indicate that we do not
        // need to hold on to the right-hand side.
        if (node.expression.transformFlags & 1024 /* DestructuringAssignment */) {
            transformFlags |= 192 /* AssertES2015 */;
        }
        node.transformFlags = transformFlags | 536870912 /* HasComputedFlags */;
        return transformFlags & ~939525441 /* NodeExcludes */;
    }
    function computeModuleDeclaration(node, subtreeFlags) {
        let transformFlags = 3 /* AssertTypeScript */;
        const modifierFlags = ts.getModifierFlags(node);
        if ((modifierFlags & ts.ModifierFlags.Ambient) === 0) {
            transformFlags |= subtreeFlags;
        }
        node.transformFlags = transformFlags | 536870912 /* HasComputedFlags */;
        return transformFlags & ~977327425 /* ModuleExcludes */;
    }
    function computeVariableDeclarationList(node, subtreeFlags) {
        let transformFlags = subtreeFlags | 33554432 /* ContainsHoistedDeclarationOrCompletion */;
        if (subtreeFlags & 8388608 /* ContainsBindingPattern */) {
            transformFlags |= 192 /* AssertES2015 */;
        }
        // If a VariableDeclarationList is `let` or `const`, then it is ES6 syntax.
        if (node.flags & ts.NodeFlags.BlockScoped) {
            transformFlags |= 192 /* AssertES2015 */ | 4194304 /* ContainsBlockScopedBinding */;
        }
        node.transformFlags = transformFlags | 536870912 /* HasComputedFlags */;
        return transformFlags & ~948962625 /* VariableDeclarationListExcludes */;
    }
    function computeOther(node, kind, subtreeFlags) {
        // Mark transformations needed for each node
        let transformFlags = subtreeFlags;
        let excludeFlags = 939525441 /* NodeExcludes */;
        switch (kind) {
            case ts.SyntaxKind.AsyncKeyword:
            case ts.SyntaxKind.AwaitExpression:
                // async/await is ES2017 syntax, but may be ESNext syntax (for async generators)
                transformFlags |= 8 /* AssertESNext */ | 16 /* AssertES2017 */;
                break;
            case ts.SyntaxKind.TypeAssertionExpression:
            case ts.SyntaxKind.AsExpression:
            case ts.SyntaxKind.PartiallyEmittedExpression:
                // These nodes are TypeScript syntax.
                transformFlags |= 3 /* AssertTypeScript */;
                excludeFlags = 536872257 /* OuterExpressionExcludes */;
                break;
            case ts.SyntaxKind.PublicKeyword:
            case ts.SyntaxKind.PrivateKeyword:
            case ts.SyntaxKind.ProtectedKeyword:
            case ts.SyntaxKind.AbstractKeyword:
            case ts.SyntaxKind.DeclareKeyword:
            case ts.SyntaxKind.ConstKeyword:
            case ts.SyntaxKind.EnumDeclaration:
            case ts.SyntaxKind.EnumMember:
            case ts.SyntaxKind.NonNullExpression:
            case ts.SyntaxKind.ReadonlyKeyword:
                // These nodes are TypeScript syntax.
                transformFlags |= 3 /* AssertTypeScript */;
                break;
            case ts.SyntaxKind.JsxElement:
            case ts.SyntaxKind.JsxSelfClosingElement:
            case ts.SyntaxKind.JsxOpeningElement:
            case ts.SyntaxKind.JsxText:
            case ts.SyntaxKind.JsxClosingElement:
            case ts.SyntaxKind.JsxFragment:
            case ts.SyntaxKind.JsxOpeningFragment:
            case ts.SyntaxKind.JsxClosingFragment:
            case ts.SyntaxKind.JsxAttribute:
            case ts.SyntaxKind.JsxAttributes:
            case ts.SyntaxKind.JsxSpreadAttribute:
            case ts.SyntaxKind.JsxExpression:
                // These nodes are Jsx syntax.
                transformFlags |= 4 /* AssertJsx */;
                break;
            case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
            case ts.SyntaxKind.TemplateHead:
            case ts.SyntaxKind.TemplateMiddle:
            case ts.SyntaxKind.TemplateTail:
            case ts.SyntaxKind.TemplateExpression:
            case ts.SyntaxKind.TaggedTemplateExpression:
            case ts.SyntaxKind.ShorthandPropertyAssignment:
            case ts.SyntaxKind.StaticKeyword:
            case ts.SyntaxKind.MetaProperty:
                // These nodes are ES6 syntax.
                transformFlags |= 192 /* AssertES2015 */;
                break;
            case ts.SyntaxKind.StringLiteral:
                if (node.hasExtendedUnicodeEscape) {
                    transformFlags |= 192 /* AssertES2015 */;
                }
                break;
            case ts.SyntaxKind.NumericLiteral:
                if (node.numericLiteralFlags & 384 /* BinaryOrOctalSpecifier */) {
                    transformFlags |= 192 /* AssertES2015 */;
                }
                break;
            case ts.SyntaxKind.ForOfStatement:
                // This node is either ES2015 syntax or ES2017 syntax (if it is a for-await-of).
                if (node.awaitModifier) {
                    transformFlags |= 8 /* AssertESNext */;
                }
                transformFlags |= 192 /* AssertES2015 */;
                break;
            case ts.SyntaxKind.YieldExpression:
                // This node is either ES2015 syntax (in a generator) or ES2017 syntax (in an async
                // generator).
                transformFlags |= 8 /* AssertESNext */ | 192 /* AssertES2015 */ | 16777216 /* ContainsYield */;
                break;
            case ts.SyntaxKind.AnyKeyword:
            case ts.SyntaxKind.NumberKeyword:
            case ts.SyntaxKind.NeverKeyword:
            case ts.SyntaxKind.ObjectKeyword:
            case ts.SyntaxKind.StringKeyword:
            case ts.SyntaxKind.BooleanKeyword:
            case ts.SyntaxKind.SymbolKeyword:
            case ts.SyntaxKind.VoidKeyword:
            case ts.SyntaxKind.TypeParameter:
            case ts.SyntaxKind.PropertySignature:
            case ts.SyntaxKind.MethodSignature:
            case ts.SyntaxKind.CallSignature:
            case ts.SyntaxKind.ConstructSignature:
            case ts.SyntaxKind.IndexSignature:
            case ts.SyntaxKind.TypePredicate:
            case ts.SyntaxKind.TypeReference:
            case ts.SyntaxKind.FunctionType:
            case ts.SyntaxKind.ConstructorType:
            case ts.SyntaxKind.TypeQuery:
            case ts.SyntaxKind.TypeLiteral:
            case ts.SyntaxKind.ArrayType:
            case ts.SyntaxKind.TupleType:
            case ts.SyntaxKind.UnionType:
            case ts.SyntaxKind.IntersectionType:
            case ts.SyntaxKind.ConditionalType:
            case ts.SyntaxKind.InferType:
            case ts.SyntaxKind.ParenthesizedType:
            case ts.SyntaxKind.InterfaceDeclaration:
            case ts.SyntaxKind.TypeAliasDeclaration:
            case ts.SyntaxKind.ThisType:
            case ts.SyntaxKind.TypeOperator:
            case ts.SyntaxKind.IndexedAccessType:
            case ts.SyntaxKind.MappedType:
            case ts.SyntaxKind.LiteralType:
            case ts.SyntaxKind.NamespaceExportDeclaration:
                // Types and signatures are TypeScript syntax, and exclude all other facts.
                transformFlags = 3 /* AssertTypeScript */;
                excludeFlags = -3 /* TypeExcludes */;
                break;
            case ts.SyntaxKind.ComputedPropertyName:
                // Even though computed property names are ES6, we don't treat them as such.
                // This is so that they can flow through PropertyName transforms unaffected.
                // Instead, we mark the container as ES6, so that it can properly handle the transform.
                transformFlags |= 2097152 /* ContainsComputedPropertyName */;
                if (subtreeFlags & 16384 /* ContainsLexicalThis */) {
                    // A computed method name like `[this.getName()](x: string) { ... }` needs to
                    // distinguish itself from the normal case of a method body containing `this`:
                    // `this` inside a method doesn't need to be rewritten (the method provides `this`),
                    // whereas `this` inside a computed name *might* need to be rewritten if the class/object
                    // is inside an arrow function:
                    // `_this = this; () => class K { [_this.getName()]() { ... } }`
                    // To make this distinction, use ContainsLexicalThisInComputedPropertyName
                    // instead of ContainsLexicalThis for computed property names
                    transformFlags |= 65536 /* ContainsLexicalThisInComputedPropertyName */;
                }
                break;
            case ts.SyntaxKind.SpreadElement:
                transformFlags |= 192 /* AssertES2015 */ | 524288 /* ContainsSpread */;
                break;
            case ts.SyntaxKind.SpreadAssignment:
                transformFlags |= 8 /* AssertESNext */ | 1048576 /* ContainsObjectSpread */;
                break;
            case ts.SyntaxKind.SuperKeyword:
                // This node is ES6 syntax.
                transformFlags |= 192 /* AssertES2015 */ | 134217728 /* Super */;
                excludeFlags = 536872257 /* OuterExpressionExcludes */; // must be set to persist `Super`
                break;
            case ts.SyntaxKind.ThisKeyword:
                // Mark this node and its ancestors as containing a lexical `this` keyword.
                transformFlags |= 16384 /* ContainsLexicalThis */;
                break;
            case ts.SyntaxKind.ObjectBindingPattern:
                transformFlags |= 192 /* AssertES2015 */ | 8388608 /* ContainsBindingPattern */;
                if (subtreeFlags & 524288 /* ContainsRest */) {
                    transformFlags |= 8 /* AssertESNext */ | 1048576 /* ContainsObjectRest */;
                }
                excludeFlags = 940049729 /* BindingPatternExcludes */;
                break;
            case ts.SyntaxKind.ArrayBindingPattern:
                transformFlags |= 192 /* AssertES2015 */ | 8388608 /* ContainsBindingPattern */;
                excludeFlags = 940049729 /* BindingPatternExcludes */;
                break;
            case ts.SyntaxKind.BindingElement:
                transformFlags |= 192 /* AssertES2015 */;
                if (node.dotDotDotToken) {
                    transformFlags |= 524288 /* ContainsRest */;
                }
                break;
            case ts.SyntaxKind.Decorator:
                // This node is TypeScript syntax, and marks its container as also being TypeScript syntax.
                transformFlags |= 3 /* AssertTypeScript */ | 4096 /* ContainsDecorators */;
                break;
            case ts.SyntaxKind.ObjectLiteralExpression:
                excludeFlags = 942740801 /* ObjectLiteralExcludes */;
                if (subtreeFlags & 2097152 /* ContainsComputedPropertyName */) {
                    // If an ObjectLiteralExpression contains a ComputedPropertyName, then it
                    // is an ES6 node.
                    transformFlags |= 192 /* AssertES2015 */;
                }
                if (subtreeFlags & 65536 /* ContainsLexicalThisInComputedPropertyName */) {
                    // A computed property name containing `this` might need to be rewritten,
                    // so propagate the ContainsLexicalThis flag upward.
                    transformFlags |= 16384 /* ContainsLexicalThis */;
                }
                if (subtreeFlags & 1048576 /* ContainsObjectSpread */) {
                    // If an ObjectLiteralExpression contains a spread element, then it
                    // is an ES next node.
                    transformFlags |= 8 /* AssertESNext */;
                }
                break;
            case ts.SyntaxKind.ArrayLiteralExpression:
            case ts.SyntaxKind.NewExpression:
                excludeFlags = 940049729 /* ArrayLiteralOrCallOrNewExcludes */;
                if (subtreeFlags & 524288 /* ContainsSpread */) {
                    // If the this node contains a SpreadExpression, then it is an ES6
                    // node.
                    transformFlags |= 192 /* AssertES2015 */;
                }
                break;
            case ts.SyntaxKind.DoStatement:
            case ts.SyntaxKind.WhileStatement:
            case ts.SyntaxKind.ForStatement:
            case ts.SyntaxKind.ForInStatement:
                // A loop containing a block scoped binding *may* need to be transformed from ES6.
                if (subtreeFlags & 4194304 /* ContainsBlockScopedBinding */) {
                    transformFlags |= 192 /* AssertES2015 */;
                }
                break;
            case ts.SyntaxKind.SourceFile:
                if (subtreeFlags & 32768 /* ContainsCapturedLexicalThis */) {
                    transformFlags |= 192 /* AssertES2015 */;
                }
                break;
            case ts.SyntaxKind.ReturnStatement:
            case ts.SyntaxKind.ContinueStatement:
            case ts.SyntaxKind.BreakStatement:
                transformFlags |= 33554432 /* ContainsHoistedDeclarationOrCompletion */;
                break;
        }
        node.transformFlags = transformFlags | 536870912 /* HasComputedFlags */;
        return transformFlags & ~excludeFlags;
    }
    /**
     * Gets the transform flags to exclude when unioning the transform flags of a subtree.
     *
     * NOTE: This needs to be kept up-to-date with the exclusions used in `computeTransformFlagsForNode`.
     *       For performance reasons, `computeTransformFlagsForNode` uses local constant values rather
     *       than calling this function.
     */
    /* @internal */
    function getTransformFlagsSubtreeExclusions(kind) {
        if (kind >= ts.SyntaxKind.FirstTypeNode && kind <= ts.SyntaxKind.LastTypeNode) {
            return -3 /* TypeExcludes */;
        }
        switch (kind) {
            case ts.SyntaxKind.CallExpression:
            case ts.SyntaxKind.NewExpression:
            case ts.SyntaxKind.ArrayLiteralExpression:
                return 940049729 /* ArrayLiteralOrCallOrNewExcludes */;
            case ts.SyntaxKind.ModuleDeclaration:
                return 977327425 /* ModuleExcludes */;
            case ts.SyntaxKind.Parameter:
                return 939525441 /* ParameterExcludes */;
            case ts.SyntaxKind.ArrowFunction:
                return 1003902273 /* ArrowFunctionExcludes */;
            case ts.SyntaxKind.FunctionExpression:
            case ts.SyntaxKind.FunctionDeclaration:
                return 1003935041 /* FunctionExcludes */;
            case ts.SyntaxKind.VariableDeclarationList:
                return 948962625 /* VariableDeclarationListExcludes */;
            case ts.SyntaxKind.ClassDeclaration:
            case ts.SyntaxKind.ClassExpression:
                return 942011713 /* ClassExcludes */;
            case ts.SyntaxKind.Constructor:
                return 1003668801 /* ConstructorExcludes */;
            case ts.SyntaxKind.MethodDeclaration:
            case ts.SyntaxKind.GetAccessor:
            case ts.SyntaxKind.SetAccessor:
                return 1003668801 /* MethodOrAccessorExcludes */;
            case ts.SyntaxKind.AnyKeyword:
            case ts.SyntaxKind.NumberKeyword:
            case ts.SyntaxKind.NeverKeyword:
            case ts.SyntaxKind.StringKeyword:
            case ts.SyntaxKind.ObjectKeyword:
            case ts.SyntaxKind.BooleanKeyword:
            case ts.SyntaxKind.SymbolKeyword:
            case ts.SyntaxKind.VoidKeyword:
            case ts.SyntaxKind.TypeParameter:
            case ts.SyntaxKind.PropertySignature:
            case ts.SyntaxKind.MethodSignature:
            case ts.SyntaxKind.CallSignature:
            case ts.SyntaxKind.ConstructSignature:
            case ts.SyntaxKind.IndexSignature:
            case ts.SyntaxKind.InterfaceDeclaration:
            case ts.SyntaxKind.TypeAliasDeclaration:
                return -3 /* TypeExcludes */;
            case ts.SyntaxKind.ObjectLiteralExpression:
                return 942740801 /* ObjectLiteralExcludes */;
            case ts.SyntaxKind.CatchClause:
                return 940574017 /* CatchClauseExcludes */;
            case ts.SyntaxKind.ObjectBindingPattern:
            case ts.SyntaxKind.ArrayBindingPattern:
                return 940049729 /* BindingPatternExcludes */;
            case ts.SyntaxKind.TypeAssertionExpression:
            case ts.SyntaxKind.AsExpression:
            case ts.SyntaxKind.PartiallyEmittedExpression:
            case ts.SyntaxKind.ParenthesizedExpression:
            case ts.SyntaxKind.SuperKeyword:
                return 536872257 /* OuterExpressionExcludes */;
            case ts.SyntaxKind.PropertyAccessExpression:
            case ts.SyntaxKind.ElementAccessExpression:
                return 671089985 /* PropertyAccessExcludes */;
            default:
                return 939525441 /* NodeExcludes */;
        }
    }
    ts.getTransformFlagsSubtreeExclusions = getTransformFlagsSubtreeExclusions;
    /**
     * "Binds" JSDoc nodes in TypeScript code.
     * Since we will never create symbols for JSDoc, we just set parent pointers instead.
     */
    function setParentPointers(parent, child) {
        child.parent = parent;
        ts.forEachChild(child, (childsChild) => setParentPointers(child, childsChild));
    }
})(ts || (ts = {}));
