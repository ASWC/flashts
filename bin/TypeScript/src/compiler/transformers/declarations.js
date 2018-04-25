/*@internal*/
var ts;
(function (ts) {
    function getDeclarationDiagnostics(host, resolver, file) {
        if (file && ts.isSourceFileJavaScript(file)) {
            return []; // No declaration diagnostics for js for now
        }
        const compilerOptions = host.getCompilerOptions();
        const result = ts.transformNodes(resolver, host, compilerOptions, file ? [file] : ts.filter(host.getSourceFiles(), ts.isSourceFileNotJavaScript), [transformDeclarations], /*allowDtsFiles*/ false);
        return result.diagnostics;
    }
    ts.getDeclarationDiagnostics = getDeclarationDiagnostics;
    const declarationEmitNodeBuilderFlags = ts.NodeBuilderFlags.MultilineObjectLiterals | ts.TypeFormatFlags.WriteClassExpressionAsTypeLiteral | ts.NodeBuilderFlags.UseTypeOfFunction | ts.NodeBuilderFlags.UseStructuralFallback | ts.NodeBuilderFlags.AllowEmptyTuple;
    /**
     * Transforms a ts file into a .d.ts file
     * This process requires type information, which is retrieved through the emit resolver. Because of this,
     * in many places this transformer assumes it will be operating on parse tree nodes directly.
     * This means that _no transforms should be allowed to occur before this one_.
     */
    function transformDeclarations(context) {
        const throwDiagnostic = () => ts.Debug.fail("Diagnostic emitted without context");
        let getSymbolAccessibilityDiagnostic = throwDiagnostic;
        let needsDeclare = true;
        let isBundledEmit = false;
        let resultHasExternalModuleIndicator = false;
        let needsScopeFixMarker = false;
        let resultHasScopeMarker = false;
        let enclosingDeclaration;
        let necessaryTypeRefernces;
        let lateMarkedStatements;
        let lateStatementReplacementMap;
        let suppressNewDiagnosticContexts;
        const symbolTracker = {
            trackSymbol,
            reportInaccessibleThisError,
            reportInaccessibleUniqueSymbolError,
            reportPrivateInBaseOfClassExpression
        };
        let errorNameNode;
        let currentSourceFile;
        const resolver = context.getEmitResolver();
        const options = context.getCompilerOptions();
        const newLine = ts.getNewLineCharacter(options);
        const { noResolve, stripInternal } = options;
        const host = context.getEmitHost();
        return transformRoot;
        function recordTypeReferenceDirectivesIfNecessary(typeReferenceDirectives) {
            if (!typeReferenceDirectives) {
                return;
            }
            necessaryTypeRefernces = necessaryTypeRefernces || ts.createMap();
            for (const ref of typeReferenceDirectives) {
                necessaryTypeRefernces.set(ref, true);
            }
        }
        function handleSymbolAccessibilityError(symbolAccessibilityResult) {
            if (symbolAccessibilityResult.accessibility === 0 /* Accessible */) {
                // Add aliases back onto the possible imports list if they're not there so we can try them again with updated visibility info
                if (symbolAccessibilityResult && symbolAccessibilityResult.aliasesToMakeVisible) {
                    if (!lateMarkedStatements) {
                        lateMarkedStatements = symbolAccessibilityResult.aliasesToMakeVisible;
                    }
                    else {
                        for (const ref of symbolAccessibilityResult.aliasesToMakeVisible) {
                            ts.pushIfUnique(lateMarkedStatements, ref);
                        }
                    }
                }
                // TODO: Do all these accessibility checks inside/after the first pass in the checker when declarations are enabled, if possible
            }
            else {
                // Report error
                const errorInfo = getSymbolAccessibilityDiagnostic(symbolAccessibilityResult);
                if (errorInfo) {
                    if (errorInfo.typeName) {
                        context.addDiagnostic(ts.createDiagnosticForNode(symbolAccessibilityResult.errorNode || errorInfo.errorNode, errorInfo.diagnosticMessage, ts.getTextOfNode(errorInfo.typeName), symbolAccessibilityResult.errorSymbolName, symbolAccessibilityResult.errorModuleName));
                    }
                    else {
                        context.addDiagnostic(ts.createDiagnosticForNode(symbolAccessibilityResult.errorNode || errorInfo.errorNode, errorInfo.diagnosticMessage, symbolAccessibilityResult.errorSymbolName, symbolAccessibilityResult.errorModuleName));
                    }
                }
            }
        }
        function trackSymbol(symbol, enclosingDeclaration, meaning) {
            handleSymbolAccessibilityError(resolver.isSymbolAccessible(symbol, enclosingDeclaration, meaning, /*shouldComputeAliasesToMakeVisible*/ true));
            recordTypeReferenceDirectivesIfNecessary(resolver.getTypeReferenceDirectivesForSymbol(symbol, meaning));
        }
        function reportPrivateInBaseOfClassExpression(propertyName) {
            if (errorNameNode) {
                context.addDiagnostic(ts.createDiagnosticForNode(errorNameNode, Diagnostics.Property_0_of_exported_class_expression_may_not_be_private_or_protected, propertyName));
            }
        }
        function reportInaccessibleUniqueSymbolError() {
            if (errorNameNode) {
                context.addDiagnostic(ts.createDiagnosticForNode(errorNameNode, Diagnostics.The_inferred_type_of_0_references_an_inaccessible_1_type_A_type_annotation_is_necessary, ts.declarationNameToString(errorNameNode), "unique symbol"));
            }
        }
        function reportInaccessibleThisError() {
            if (errorNameNode) {
                context.addDiagnostic(ts.createDiagnosticForNode(errorNameNode, Diagnostics.The_inferred_type_of_0_references_an_inaccessible_1_type_A_type_annotation_is_necessary, ts.declarationNameToString(errorNameNode), "this"));
            }
        }
        function transformRoot(node) {
            if (node.kind === ts.SyntaxKind.SourceFile && (node.isDeclarationFile || ts.isSourceFileJavaScript(node))) {
                return node;
            }
            if (node.kind === ts.SyntaxKind.Bundle) {
                isBundledEmit = true;
                const refs = ts.createMap();
                let hasNoDefaultLib = false;
                const bundle = ts.createBundle(ts.map(node.sourceFiles, sourceFile => {
                    if (sourceFile.isDeclarationFile || ts.isSourceFileJavaScript(sourceFile))
                        return; // Omit declaration files from bundle results, too
                    hasNoDefaultLib = hasNoDefaultLib || sourceFile.hasNoDefaultLib;
                    currentSourceFile = sourceFile;
                    enclosingDeclaration = sourceFile;
                    lateMarkedStatements = undefined;
                    suppressNewDiagnosticContexts = false;
                    lateStatementReplacementMap = ts.createMap();
                    getSymbolAccessibilityDiagnostic = throwDiagnostic;
                    needsScopeFixMarker = false;
                    resultHasScopeMarker = false;
                    collectReferences(sourceFile, refs);
                    if (ts.isExternalModule(sourceFile)) {
                        resultHasExternalModuleIndicator = false; // unused in external module bundle emit (all external modules are within module blocks, therefore are known to be modules)
                        needsDeclare = false;
                        const statements = ts.visitNodes(sourceFile.statements, visitDeclarationStatements);
                        const newFile = ts.updateSourceFileNode(sourceFile, [ts.createModuleDeclaration([], [ts.createModifier(ts.SyntaxKind.DeclareKeyword)], ts.createLiteral(ts.getResolvedExternalModuleName(context.getEmitHost(), sourceFile)), ts.createModuleBlock(ts.setTextRange(ts.createNodeArray(filterCandidateImports(statements)), sourceFile.statements)))], /*isDeclarationFile*/ true, /*referencedFiles*/ [], /*typeReferences*/ [], /*hasNoDefaultLib*/ false);
                        return newFile;
                    }
                    needsDeclare = true;
                    const updated = ts.visitNodes(sourceFile.statements, visitDeclarationStatements);
                    return ts.updateSourceFileNode(sourceFile, filterCandidateImports(updated), /*isDeclarationFile*/ true, /*referencedFiles*/ [], /*typeReferences*/ [], /*hasNoDefaultLib*/ false);
                }));
                bundle.syntheticFileReferences = [];
                bundle.syntheticTypeReferences = getFileReferencesForUsedTypeReferences();
                bundle.hasNoDefaultLib = hasNoDefaultLib;
                const outputFilePath = ts.getDirectoryPath(ts.normalizeSlashes(ts.getOutputPathsFor(node, host, /*forceDtsPaths*/ true).declarationFilePath));
                const referenceVisitor = mapReferencesIntoArray(bundle.syntheticFileReferences, outputFilePath);
                refs.forEach(referenceVisitor);
                return bundle;
            }
            // Single source file
            needsDeclare = true;
            needsScopeFixMarker = false;
            resultHasScopeMarker = false;
            enclosingDeclaration = node;
            currentSourceFile = node;
            getSymbolAccessibilityDiagnostic = throwDiagnostic;
            isBundledEmit = false;
            resultHasExternalModuleIndicator = false;
            suppressNewDiagnosticContexts = false;
            lateMarkedStatements = undefined;
            lateStatementReplacementMap = ts.createMap();
            necessaryTypeRefernces = undefined;
            const refs = collectReferences(currentSourceFile, ts.createMap());
            const references = [];
            const outputFilePath = ts.getDirectoryPath(ts.normalizeSlashes(ts.getOutputPathsFor(node, host, /*forceDtsPaths*/ true).declarationFilePath));
            const referenceVisitor = mapReferencesIntoArray(references, outputFilePath);
            refs.forEach(referenceVisitor);
            const statements = ts.visitNodes(node.statements, visitDeclarationStatements);
            let combinedStatements = ts.setTextRange(ts.createNodeArray(filterCandidateImports(statements)), node.statements);
            const emittedImports = ts.filter(combinedStatements, ts.isAnyImportSyntax);
            if (ts.isExternalModule(node) && (!resultHasExternalModuleIndicator || (needsScopeFixMarker && !resultHasScopeMarker))) {
                combinedStatements = ts.setTextRange(ts.createNodeArray([...combinedStatements, ts.createExportDeclaration(/*decorators*/ undefined, /*modifiers*/ undefined, ts.createNamedExports([]), /*moduleSpecifier*/ undefined)]), combinedStatements);
            }
            const updated = ts.updateSourceFileNode(node, combinedStatements, /*isDeclarationFile*/ true, references, getFileReferencesForUsedTypeReferences(), node.hasNoDefaultLib);
            return updated;
            function getFileReferencesForUsedTypeReferences() {
                return necessaryTypeRefernces ? ts.mapDefined(ts.arrayFrom(necessaryTypeRefernces.keys()), getFileReferenceForTypeName) : [];
            }
            function getFileReferenceForTypeName(typeName) {
                // Elide type references for which we have imports
                for (const importStatement of emittedImports) {
                    if (ts.isImportEqualsDeclaration(importStatement) && ts.isExternalModuleReference(importStatement.moduleReference)) {
                        const expr = importStatement.moduleReference.expression;
                        if (ts.isStringLiteralLike(expr) && expr.text === typeName) {
                            return undefined;
                        }
                    }
                    else if (ts.isImportDeclaration(importStatement) && ts.isStringLiteral(importStatement.moduleSpecifier) && importStatement.moduleSpecifier.text === typeName) {
                        return undefined;
                    }
                }
                return { fileName: typeName, pos: -1, end: -1 };
            }
            function mapReferencesIntoArray(references, outputFilePath) {
                return file => {
                    let declFileName;
                    if (file.isDeclarationFile) { // Neither decl files or js should have their refs changed
                        declFileName = file.fileName;
                    }
                    else {
                        if (isBundledEmit && ts.contains(node.sourceFiles, file))
                            return; // Omit references to files which are being merged
                        const paths = ts.getOutputPathsFor(file, host, /*forceDtsPaths*/ true);
                        declFileName = paths.declarationFilePath || paths.jsFilePath;
                    }
                    if (declFileName) {
                        let fileName = ts.getRelativePathToDirectoryOrUrl(outputFilePath, declFileName, host.getCurrentDirectory(), host.getCanonicalFileName, 
                        /*isAbsolutePathAnUrl*/ false);
                        if (ts.startsWith(fileName, "./") && ts.hasExtension(fileName)) {
                            fileName = fileName.substring(2);
                        }
                        references.push({ pos: -1, end: -1, fileName });
                    }
                };
            }
        }
        function collectReferences(sourceFile, ret) {
            if (noResolve || ts.isSourceFileJavaScript(sourceFile))
                return ret;
            ts.forEach(sourceFile.referencedFiles, f => {
                const elem = ts.tryResolveScriptReference(host, sourceFile, f);
                if (elem) {
                    ret.set("" + ts.getNodeId(elem), elem);
                }
            });
            return ret;
        }
        function filterBindingPatternInitializers(name) {
            if (name.kind === ts.SyntaxKind.Identifier) {
                return name;
            }
            else {
                if (name.kind === ts.SyntaxKind.ArrayBindingPattern) {
                    return ts.updateArrayBindingPattern(name, ts.visitNodes(name.elements, visitBindingElement));
                }
                else {
                    return ts.updateObjectBindingPattern(name, ts.visitNodes(name.elements, visitBindingElement));
                }
            }
            function visitBindingElement(elem) {
                if (elem.kind === ts.SyntaxKind.OmittedExpression) {
                    return elem;
                }
                return ts.updateBindingElement(elem, elem.dotDotDotToken, elem.propertyName, filterBindingPatternInitializers(elem.name), shouldPrintWithInitializer(elem) ? elem.initializer : undefined);
            }
        }
        function ensureParameter(p, modifierMask) {
            let oldDiag;
            if (!suppressNewDiagnosticContexts) {
                oldDiag = getSymbolAccessibilityDiagnostic;
                getSymbolAccessibilityDiagnostic = ts.createGetSymbolAccessibilityDiagnosticForNode(p);
            }
            const newParam = ts.updateParameter(p, 
            /*decorators*/ undefined, maskModifiers(p, modifierMask), p.dotDotDotToken, filterBindingPatternInitializers(p.name), resolver.isOptionalParameter(p) ? (p.questionToken || ts.createToken(ts.SyntaxKind.QuestionToken)) : undefined, ensureType(p, p.type, /*ignorePrivate*/ true), // Ignore private param props, since this type is going straight back into a param
            ensureNoInitializer(p));
            if (!suppressNewDiagnosticContexts) {
                getSymbolAccessibilityDiagnostic = oldDiag;
            }
            return newParam;
        }
        function shouldPrintWithInitializer(node) {
            return canHaveLiteralInitializer(node) && resolver.isLiteralConstDeclaration(ts.getParseTreeNode(node)); // TODO: Make safe
        }
        function ensureNoInitializer(node) {
            if (shouldPrintWithInitializer(node)) {
                return resolver.createLiteralConstValue(ts.getParseTreeNode(node)); // TODO: Make safe
            }
            return undefined;
        }
        function ensureType(node, type, ignorePrivate) {
            if (!ignorePrivate && ts.hasModifier(node, ts.ModifierFlags.Private)) {
                // Private nodes emit no types (except private parameter properties, whose parameter types are actually visible)
                return;
            }
            if (shouldPrintWithInitializer(node)) {
                // Literal const declarations will have an initializer ensured rather than a type
                return;
            }
            const shouldUseResolverType = node.kind === ts.SyntaxKind.Parameter &&
                (resolver.isRequiredInitializedParameter(node) ||
                    resolver.isOptionalUninitializedParameterProperty(node));
            if (type && !shouldUseResolverType) {
                return ts.visitNode(type, visitDeclarationSubtree);
            }
            if (!ts.getParseTreeNode(node)) {
                return type ? ts.visitNode(type, visitDeclarationSubtree) : ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
            }
            if (node.kind === ts.SyntaxKind.SetAccessor) {
                // Set accessors with no associated type node (from it's param or get accessor return) are `any` since they are never contextually typed right now
                // (The inferred type here will be void, but the old declaration emitter printed `any`, so this replicates that)
                return ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
            }
            errorNameNode = node.name;
            let oldDiag;
            if (!suppressNewDiagnosticContexts) {
                oldDiag = getSymbolAccessibilityDiagnostic;
                getSymbolAccessibilityDiagnostic = ts.createGetSymbolAccessibilityDiagnosticForNode(node);
            }
            if (node.kind === ts.SyntaxKind.VariableDeclaration || node.kind === ts.SyntaxKind.BindingElement) {
                return cleanup(resolver.createTypeOfDeclaration(node, enclosingDeclaration, declarationEmitNodeBuilderFlags, symbolTracker));
            }
            if (node.kind === ts.SyntaxKind.Parameter
                || node.kind === ts.SyntaxKind.PropertyDeclaration
                || node.kind === ts.SyntaxKind.PropertySignature) {
                if (!node.initializer)
                    return cleanup(resolver.createTypeOfDeclaration(node, enclosingDeclaration, declarationEmitNodeBuilderFlags, symbolTracker, shouldUseResolverType));
                return cleanup(resolver.createTypeOfDeclaration(node, enclosingDeclaration, declarationEmitNodeBuilderFlags, symbolTracker, shouldUseResolverType) || resolver.createTypeOfExpression(node.initializer, enclosingDeclaration, declarationEmitNodeBuilderFlags, symbolTracker));
            }
            return cleanup(resolver.createReturnTypeOfSignatureDeclaration(node, enclosingDeclaration, declarationEmitNodeBuilderFlags, symbolTracker));
            function cleanup(returnValue) {
                errorNameNode = undefined;
                if (!suppressNewDiagnosticContexts) {
                    getSymbolAccessibilityDiagnostic = oldDiag;
                }
                return returnValue || ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
            }
        }
        function isDeclarationAndNotVisible(node) {
            node = ts.getParseTreeNode(node);
            switch (node.kind) {
                case ts.SyntaxKind.FunctionDeclaration:
                case ts.SyntaxKind.ModuleDeclaration:
                case ts.SyntaxKind.InterfaceDeclaration:
                case ts.SyntaxKind.ClassDeclaration:
                case ts.SyntaxKind.TypeAliasDeclaration:
                case ts.SyntaxKind.EnumDeclaration:
                    return !resolver.isDeclarationVisible(node);
                // The following should be doing their own visibility checks based on filtering their members
                case ts.SyntaxKind.VariableDeclaration:
                    return !getBindingNameVisible(node);
                case ts.SyntaxKind.ImportEqualsDeclaration:
                case ts.SyntaxKind.ImportDeclaration:
                case ts.SyntaxKind.ExportDeclaration:
                case ts.SyntaxKind.ExportAssignment:
                    return false;
            }
            return false;
        }
        function getBindingNameVisible(elem) {
            if (ts.isOmittedExpression(elem)) {
                return false;
            }
            if (ts.isBindingPattern(elem.name)) {
                // If any child binding pattern element has been marked visible (usually by collect linked aliases), then this is visible
                return ts.forEach(elem.name.elements, getBindingNameVisible);
            }
            else {
                return resolver.isDeclarationVisible(elem);
            }
        }
        function updateParamsList(node, params, modifierMask) {
            if (ts.hasModifier(node, ts.ModifierFlags.Private)) {
                return undefined;
            }
            const newParams = ts.map(params, p => ensureParameter(p, modifierMask));
            if (!newParams) {
                return undefined;
            }
            return ts.createNodeArray(newParams, params.hasTrailingComma);
        }
        function ensureTypeParams(node, params) {
            return ts.hasModifier(node, ts.ModifierFlags.Private) ? undefined : ts.visitNodes(params, visitDeclarationSubtree);
        }
        function isEnclosingDeclaration(node) {
            return ts.isSourceFile(node)
                || ts.isTypeAliasDeclaration(node)
                || ts.isModuleDeclaration(node)
                || ts.isClassDeclaration(node)
                || ts.isInterfaceDeclaration(node)
                || ts.isFunctionLike(node)
                || ts.isIndexSignatureDeclaration(node)
                || ts.isMappedTypeNode(node);
        }
        function checkEntityNameVisibility(entityName, enclosingDeclaration) {
            const visibilityResult = resolver.isEntityNameVisible(entityName, enclosingDeclaration);
            handleSymbolAccessibilityError(visibilityResult);
            recordTypeReferenceDirectivesIfNecessary(resolver.getTypeReferenceDirectivesForEntityName(entityName));
        }
        function preserveJsDoc(updated, original) {
            if (ts.hasJSDocNodes(updated) && ts.hasJSDocNodes(original)) {
                updated.jsDoc = original.jsDoc;
            }
            return ts.setCommentRange(updated, ts.getCommentRange(original));
        }
        function rewriteModuleSpecifier(parent, input) {
            if (!input)
                return;
            resultHasExternalModuleIndicator = resultHasExternalModuleIndicator || (parent.kind !== ts.SyntaxKind.ModuleDeclaration && parent.kind !== ts.SyntaxKind.ImportType);
            if (input.kind === ts.SyntaxKind.StringLiteral && isBundledEmit) {
                const newName = ts.getExternalModuleNameFromDeclaration(context.getEmitHost(), resolver, parent);
                if (newName) {
                    return ts.createLiteral(newName);
                }
            }
            return input;
        }
        function transformImportEqualsDeclaration(decl) {
            if (!resolver.isDeclarationVisible(decl))
                return;
            if (decl.moduleReference.kind === ts.SyntaxKind.ExternalModuleReference) {
                // Rewrite external module names if necessary
                const specifier = ts.getExternalModuleImportEqualsDeclarationExpression(decl);
                return ts.updateImportEqualsDeclaration(decl, 
                /*decorators*/ undefined, decl.modifiers, decl.name, ts.updateExternalModuleReference(decl.moduleReference, rewriteModuleSpecifier(decl, specifier)));
            }
            else {
                const oldDiag = getSymbolAccessibilityDiagnostic;
                getSymbolAccessibilityDiagnostic = ts.createGetSymbolAccessibilityDiagnosticForNode(decl);
                checkEntityNameVisibility(decl.moduleReference, enclosingDeclaration);
                getSymbolAccessibilityDiagnostic = oldDiag;
                return decl;
            }
        }
        function transformImportDeclaration(decl) {
            if (!decl.importClause) {
                // import "mod" - possibly needed for side effects? (global interface patches, module augmentations, etc)
                return ts.updateImportDeclaration(decl, 
                /*decorators*/ undefined, decl.modifiers, decl.importClause, rewriteModuleSpecifier(decl, decl.moduleSpecifier));
            }
            // The `importClause` visibility corresponds to the default's visibility.
            const visibleDefaultBinding = decl.importClause && decl.importClause.name && resolver.isDeclarationVisible(decl.importClause) ? decl.importClause.name : undefined;
            if (!decl.importClause.namedBindings) {
                // No named bindings (either namespace or list), meaning the import is just default or should be elided
                return visibleDefaultBinding && ts.updateImportDeclaration(decl, /*decorators*/ undefined, decl.modifiers, ts.updateImportClause(decl.importClause, visibleDefaultBinding, 
                /*namedBindings*/ undefined), rewriteModuleSpecifier(decl, decl.moduleSpecifier));
            }
            if (decl.importClause.namedBindings.kind === ts.SyntaxKind.NamespaceImport) {
                // Namespace import (optionally with visible default)
                const namedBindings = resolver.isDeclarationVisible(decl.importClause.namedBindings) ? decl.importClause.namedBindings : /*namedBindings*/ undefined;
                return visibleDefaultBinding || namedBindings ? ts.updateImportDeclaration(decl, /*decorators*/ undefined, decl.modifiers, ts.updateImportClause(decl.importClause, visibleDefaultBinding, namedBindings), rewriteModuleSpecifier(decl, decl.moduleSpecifier)) : undefined;
            }
            // Named imports (optionally with visible default)
            const bindingList = ts.mapDefined(decl.importClause.namedBindings.elements, b => resolver.isDeclarationVisible(b) ? b : undefined);
            if ((bindingList && bindingList.length) || visibleDefaultBinding) {
                return ts.updateImportDeclaration(decl, 
                /*decorators*/ undefined, decl.modifiers, ts.updateImportClause(decl.importClause, visibleDefaultBinding, bindingList && bindingList.length ? ts.updateNamedImports(decl.importClause.namedBindings, bindingList) : undefined), rewriteModuleSpecifier(decl, decl.moduleSpecifier));
            }
            // Nothing visible
        }
        function filterCandidateImports(statements) {
            // This is a `while` loop because `handleSymbolAccessibilityError` can see additional import aliases marked as visible during
            // error handling which must now be included in the output and themselves checked for errors.
            // For example:
            // ```
            // module A {
            //   export module Q {}
            //   import B = Q;
            //   import C = B;
            //   export import D = C;
            // }
            // ```
            // In such a scenario, only Q and D are initially visible, but we don't consider imports as private names - instead we say they if they are referenced they must
            // be recorded. So while checking D's visibility we mark C as visible, then we must check C which in turn marks B, completing the chain of
            // dependent imports and allowing a valid declaration file output. Today, this dependent alias marking only happens for internal import aliases.
            const unconsideredStatements = [];
            while (ts.length(lateMarkedStatements)) {
                const i = lateMarkedStatements.shift();
                if ((ts.isSourceFile(i.parent) ? i.parent : i.parent.parent) !== enclosingDeclaration) { // Filter to only declarations in the current scope
                    unconsideredStatements.push(i);
                    continue;
                }
                if (!ts.isLateVisibilityPaintedStatement(i)) {
                    return ts.Debug.fail(`Late replaced statement was foudn which is not handled by the declaration transformer!: ${ts.SyntaxKind ? ts.SyntaxKind[i.kind] : i.kind}`);
                }
                switch (i.kind) {
                    case ts.SyntaxKind.ImportEqualsDeclaration: {
                        const result = transformImportEqualsDeclaration(i);
                        lateStatementReplacementMap.set("" + ts.getNodeId(i), result);
                        break;
                    }
                    case ts.SyntaxKind.ImportDeclaration: {
                        const result = transformImportDeclaration(i);
                        lateStatementReplacementMap.set("" + ts.getNodeId(i), result);
                        break;
                    }
                    case ts.SyntaxKind.VariableStatement: {
                        const result = transformVariableStatement(i, /*privateDeclaration*/ true); // Transform the statement (potentially again, possibly revealing more sub-nodes)
                        lateStatementReplacementMap.set("" + ts.getNodeId(i), result);
                        break;
                    }
                    default: ts.Debug.assertNever(i, "Unhandled late painted statement!");
                }
            }
            // Filtering available imports is the last thing done within a scope, so the possible set becomes those which could not
            // be considered in the child scope
            lateMarkedStatements = unconsideredStatements;
            // And lastly, we need to get the final form of all those indetermine import declarations from before and add them to the output list
            // (and remove them from the set to examine for outter declarations)
            return ts.visitNodes(statements, visitLateVisibilityMarkedStatements);
        }
        function visitLateVisibilityMarkedStatements(statement) {
            if (ts.isLateVisibilityPaintedStatement(statement)) {
                const key = "" + ts.getNodeId(statement);
                if (lateStatementReplacementMap.has(key)) {
                    const result = lateStatementReplacementMap.get(key);
                    lateStatementReplacementMap.delete(key);
                    if (result && ts.isSourceFile(statement.parent) && !ts.isAnyImportOrReExport(result) && !ts.isExportAssignment(result) && !ts.hasModifier(result, ts.ModifierFlags.Export)) {
                        // Top-level declarations in .d.ts files are always considered exported even without a modifier unless there's an export assignment or specifier
                        needsScopeFixMarker = true;
                    }
                    return result;
                }
                else {
                    return ts.getParseTreeNode(statement) ? undefined : statement;
                }
            }
            else {
                return statement;
            }
        }
        function visitDeclarationSubtree(input) {
            if (shouldStripInternal(input))
                return;
            if (ts.isDeclaration(input)) {
                if (isDeclarationAndNotVisible(input))
                    return;
                if (ts.hasDynamicName(input) && !resolver.isLateBound(ts.getParseTreeNode(input))) {
                    return;
                }
            }
            // Elide implementation signatures from overload sets
            if (ts.isFunctionLike(input) && resolver.isImplementationOfOverload(input))
                return;
            // Elide semicolon class statements
            if (ts.isSemicolonClassElement(input))
                return;
            let previousEnclosingDeclaration;
            if (isEnclosingDeclaration(input)) {
                previousEnclosingDeclaration = enclosingDeclaration;
                enclosingDeclaration = input;
            }
            const oldDiag = getSymbolAccessibilityDiagnostic;
            // Emit methods which are private as properties with no type information
            if (ts.isMethodDeclaration(input) || ts.isMethodSignature(input)) {
                if (ts.hasModifier(input, ts.ModifierFlags.Private)) {
                    if (input.symbol && input.symbol.declarations && input.symbol.declarations[0] !== input)
                        return; // Elide all but the first overload
                    return cleanup(ts.createProperty(/*decorators*/ undefined, ensureModifiers(input), input.name, /*questionToken*/ undefined, /*type*/ undefined, /*initializer*/ undefined));
                }
            }
            const canProdiceDiagnostic = ts.canProduceDiagnostics(input);
            if (canProdiceDiagnostic && !suppressNewDiagnosticContexts) {
                getSymbolAccessibilityDiagnostic = ts.createGetSymbolAccessibilityDiagnosticForNode(input);
            }
            if (ts.isTypeQueryNode(input)) {
                checkEntityNameVisibility(input.exprName, enclosingDeclaration);
            }
            const oldWithinObjectLiteralType = suppressNewDiagnosticContexts;
            let shouldEnterSuppressNewDiagnosticsContextContext = ((input.kind === ts.SyntaxKind.TypeLiteral || input.kind === ts.SyntaxKind.MappedType) && input.parent.kind !== ts.SyntaxKind.TypeAliasDeclaration);
            if (shouldEnterSuppressNewDiagnosticsContextContext) {
                // We stop making new diagnostic contexts within object literal types. Unless it's an object type on the RHS of a type alias declaration. Then we do.
                suppressNewDiagnosticContexts = true;
            }
            if (isProcessedComponent(input)) {
                switch (input.kind) {
                    case ts.SyntaxKind.ExpressionWithTypeArguments: {
                        if ((ts.isEntityName(input.expression) || ts.isEntityNameExpression(input.expression))) {
                            checkEntityNameVisibility(input.expression, enclosingDeclaration);
                        }
                        const node = ts.visitEachChild(input, visitDeclarationSubtree, context);
                        return cleanup(ts.updateExpressionWithTypeArguments(node, ts.parenthesizeTypeParameters(node.typeArguments), node.expression));
                    }
                    case ts.SyntaxKind.TypeReference: {
                        checkEntityNameVisibility(input.typeName, enclosingDeclaration);
                        const node = ts.visitEachChild(input, visitDeclarationSubtree, context);
                        return cleanup(ts.updateTypeReferenceNode(node, node.typeName, ts.parenthesizeTypeParameters(node.typeArguments)));
                    }
                    case ts.SyntaxKind.ConstructSignature:
                        return cleanup(ts.updateConstructSignature(input, ensureTypeParams(input, input.typeParameters), updateParamsList(input, input.parameters), ensureType(input, input.type)));
                    case ts.SyntaxKind.Constructor: {
                        const isPrivate = ts.hasModifier(input, ts.ModifierFlags.Private);
                        // A constructor declaration may not have a type annotation
                        const ctor = ts.createSignatureDeclaration(ts.SyntaxKind.Constructor, isPrivate ? undefined : ensureTypeParams(input, input.typeParameters), isPrivate ? undefined : updateParamsList(input, input.parameters, ts.ModifierFlags.None), 
                        /*type*/ undefined);
                        ctor.modifiers = ts.createNodeArray(ensureModifiers(input));
                        return cleanup(ctor);
                    }
                    case ts.SyntaxKind.MethodDeclaration: {
                        const sig = ts.createSignatureDeclaration(ts.SyntaxKind.MethodSignature, ensureTypeParams(input, input.typeParameters), updateParamsList(input, input.parameters), ensureType(input, input.type));
                        sig.name = input.name;
                        sig.modifiers = ts.createNodeArray(ensureModifiers(input));
                        sig.questionToken = input.questionToken;
                        return cleanup(sig);
                    }
                    case ts.SyntaxKind.GetAccessor: {
                        const newNode = ensureAccessor(input);
                        return cleanup(newNode);
                    }
                    case ts.SyntaxKind.SetAccessor: {
                        const newNode = ensureAccessor(input);
                        return cleanup(newNode);
                    }
                    case ts.SyntaxKind.PropertyDeclaration:
                        return cleanup(ts.updateProperty(input, 
                        /*decorators*/ undefined, ensureModifiers(input), input.name, input.questionToken, !ts.hasModifier(input, ts.ModifierFlags.Private) ? ensureType(input, input.type) : undefined, ensureNoInitializer(input)));
                    case ts.SyntaxKind.PropertySignature:
                        return cleanup(ts.updatePropertySignature(input, ensureModifiers(input), input.name, input.questionToken, !ts.hasModifier(input, ts.ModifierFlags.Private) ? ensureType(input, input.type) : undefined, ensureNoInitializer(input)));
                    case ts.SyntaxKind.MethodSignature: {
                        return cleanup(ts.updateMethodSignature(input, ensureTypeParams(input, input.typeParameters), updateParamsList(input, input.parameters), ensureType(input, input.type), input.name, input.questionToken));
                    }
                    case ts.SyntaxKind.CallSignature: {
                        return cleanup(ts.updateCallSignature(input, ensureTypeParams(input, input.typeParameters), updateParamsList(input, input.parameters), ensureType(input, input.type)));
                    }
                    case ts.SyntaxKind.IndexSignature: {
                        return cleanup(ts.updateIndexSignature(input, 
                        /*decorators*/ undefined, ensureModifiers(input), updateParamsList(input, input.parameters), ts.visitNode(input.type, visitDeclarationSubtree) || ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)));
                    }
                    case ts.SyntaxKind.VariableDeclaration: {
                        if (ts.isBindingPattern(input.name)) {
                            return recreateBindingPattern(input.name);
                        }
                        shouldEnterSuppressNewDiagnosticsContextContext = true;
                        suppressNewDiagnosticContexts = true; // Variable declaration types also suppress new diagnostic contexts, provided the contexts wouldn't be made for binding pattern types
                        return cleanup(ts.updateVariableDeclaration(input, input.name, ensureType(input, input.type), ensureNoInitializer(input)));
                    }
                    case ts.SyntaxKind.TypeParameter: {
                        if (isPrivateMethodTypeParameter(input) && (input.default || input.constraint)) {
                            return cleanup(ts.updateTypeParameterDeclaration(input, input.name, /*constraint*/ undefined, /*defaultType*/ undefined));
                        }
                        return cleanup(ts.visitEachChild(input, visitDeclarationSubtree, context));
                    }
                    case ts.SyntaxKind.ConditionalType: {
                        // We have to process conditional types in a special way because for visibility purposes we need to push a new enclosingDeclaration
                        // just for the `infer` types in the true branch. It's an implicit declaration scope that only applies to _part_ of the type.
                        const checkType = ts.visitNode(input.checkType, visitDeclarationSubtree);
                        const extendsType = ts.visitNode(input.extendsType, visitDeclarationSubtree);
                        const oldEnclosingDecl = enclosingDeclaration;
                        enclosingDeclaration = input.trueType;
                        const trueType = ts.visitNode(input.trueType, visitDeclarationSubtree);
                        enclosingDeclaration = oldEnclosingDecl;
                        const falseType = ts.visitNode(input.falseType, visitDeclarationSubtree);
                        return cleanup(ts.updateConditionalTypeNode(input, checkType, extendsType, trueType, falseType));
                    }
                    case ts.SyntaxKind.FunctionType: {
                        return cleanup(ts.updateFunctionTypeNode(input, ts.visitNodes(input.typeParameters, visitDeclarationSubtree), updateParamsList(input, input.parameters), ts.visitNode(input.type, visitDeclarationSubtree)));
                    }
                    case ts.SyntaxKind.ConstructorType: {
                        return cleanup(ts.updateConstructorTypeNode(input, ts.visitNodes(input.typeParameters, visitDeclarationSubtree), updateParamsList(input, input.parameters), ts.visitNode(input.type, visitDeclarationSubtree)));
                    }
                    case ts.SyntaxKind.ImportType: {
                        if (!ts.isLiteralImportTypeNode(input))
                            return cleanup(input);
                        return cleanup(ts.updateImportTypeNode(input, ts.updateLiteralTypeNode(input.argument, rewriteModuleSpecifier(input, input.argument.literal)), input.qualifier, ts.visitNodes(input.typeArguments, visitDeclarationSubtree, ts.isTypeNode), input.isTypeOf));
                    }
                    default: ts.Debug.assertNever(input, `Attempted to process unhandled node kind: ${ts.SyntaxKind[input.kind]}`);
                }
            }
            return cleanup(ts.visitEachChild(input, visitDeclarationSubtree, context));
            function cleanup(returnValue) {
                if (returnValue && canProdiceDiagnostic && ts.hasDynamicName(input)) {
                    checkName(input);
                }
                if (isEnclosingDeclaration(input)) {
                    enclosingDeclaration = previousEnclosingDeclaration;
                }
                if (canProdiceDiagnostic && !suppressNewDiagnosticContexts) {
                    getSymbolAccessibilityDiagnostic = oldDiag;
                }
                if (shouldEnterSuppressNewDiagnosticsContextContext) {
                    suppressNewDiagnosticContexts = oldWithinObjectLiteralType;
                }
                if (returnValue === input) {
                    return returnValue;
                }
                return returnValue && ts.setOriginalNode(preserveJsDoc(returnValue, input), input);
            }
        }
        function isPrivateMethodTypeParameter(node) {
            return node.parent.kind === ts.SyntaxKind.MethodDeclaration && ts.hasModifier(node.parent, ts.ModifierFlags.Private);
        }
        function visitDeclarationStatements(input) {
            if (!isPreservedDeclarationStatement(input)) {
                // return undefined for unmatched kinds to omit them from the tree
                return;
            }
            if (shouldStripInternal(input))
                return;
            switch (input.kind) {
                case ts.SyntaxKind.ExportDeclaration: {
                    if (ts.isSourceFile(input.parent)) {
                        resultHasExternalModuleIndicator = true;
                        resultHasScopeMarker = true;
                    }
                    // Always visible if the parent node isn't dropped for being not visible
                    // Rewrite external module names if necessary
                    return ts.updateExportDeclaration(input, /*decorators*/ undefined, input.modifiers, input.exportClause, rewriteModuleSpecifier(input, input.moduleSpecifier));
                }
                case ts.SyntaxKind.ExportAssignment: {
                    // Always visible if the parent node isn't dropped for being not visible
                    if (ts.isSourceFile(input.parent)) {
                        resultHasExternalModuleIndicator = true;
                        resultHasScopeMarker = true;
                    }
                    if (input.expression.kind === ts.SyntaxKind.Identifier) {
                        return input;
                    }
                    else {
                        const newId = ts.createOptimisticUniqueName("_default");
                        getSymbolAccessibilityDiagnostic = () => ({
                            diagnosticMessage: Diagnostics.Default_export_of_the_module_has_or_is_using_private_name_0,
                            errorNode: input
                        });
                        const varDecl = ts.createVariableDeclaration(newId, resolver.createTypeOfExpression(input.expression, input, declarationEmitNodeBuilderFlags, symbolTracker), /*initializer*/ undefined);
                        const statement = ts.createVariableStatement(needsDeclare ? [ts.createModifier(ts.SyntaxKind.DeclareKeyword)] : [], ts.createVariableDeclarationList([varDecl], ts.NodeFlags.Const));
                        return [statement, ts.updateExportAssignment(input, input.decorators, input.modifiers, newId)];
                    }
                }
                case ts.SyntaxKind.ImportEqualsDeclaration:
                case ts.SyntaxKind.ImportDeclaration: {
                    // Different parts of the import may be marked visible at different times (via visibility checking), so we defer our first look until later
                    // to reduce the likelihood we need to rewrite it
                    lateMarkedStatements = lateMarkedStatements || [];
                    ts.pushIfUnique(lateMarkedStatements, input);
                    return input;
                }
            }
            if (ts.isDeclaration(input) && isDeclarationAndNotVisible(input))
                return;
            // Elide implementation signatures from overload sets
            if (ts.isFunctionLike(input) && resolver.isImplementationOfOverload(input))
                return;
            let previousEnclosingDeclaration;
            if (isEnclosingDeclaration(input)) {
                previousEnclosingDeclaration = enclosingDeclaration;
                enclosingDeclaration = input;
            }
            let previousNeedsDeclare;
            const canProdiceDiagnostic = ts.canProduceDiagnostics(input);
            const oldDiag = getSymbolAccessibilityDiagnostic;
            if (canProdiceDiagnostic) {
                getSymbolAccessibilityDiagnostic = ts.createGetSymbolAccessibilityDiagnosticForNode(input);
            }
            let oldPossibleImports;
            switch (input.kind) {
                case ts.SyntaxKind.TypeAliasDeclaration: // Type aliases get `declare`d if need be (for legacy support), but that's all
                    return cleanup(ts.updateTypeAliasDeclaration(input, 
                    /*decorators*/ undefined, ensureModifiers(input), input.name, ts.visitNodes(input.typeParameters, visitDeclarationSubtree, ts.isTypeParameterDeclaration), ts.visitNode(input.type, visitDeclarationSubtree, ts.isTypeNode)));
                case ts.SyntaxKind.InterfaceDeclaration: {
                    return cleanup(ts.updateInterfaceDeclaration(input, 
                    /*decorators*/ undefined, ensureModifiers(input), input.name, ensureTypeParams(input, input.typeParameters), transformHeritageClauses(input.heritageClauses), ts.visitNodes(input.members, visitDeclarationSubtree)));
                }
                case ts.SyntaxKind.FunctionDeclaration: {
                    // Generators lose their generator-ness, excepting their return type
                    return cleanup(ts.updateFunctionDeclaration(input, 
                    /*decorators*/ undefined, ensureModifiers(input), 
                    /*asteriskToken*/ undefined, input.name, ensureTypeParams(input, input.typeParameters), updateParamsList(input, input.parameters), ensureType(input, input.type), 
                    /*body*/ undefined));
                }
                case ts.SyntaxKind.ModuleDeclaration: {
                    previousNeedsDeclare = needsDeclare;
                    needsDeclare = false;
                    oldPossibleImports = lateMarkedStatements;
                    lateMarkedStatements = undefined;
                    const inner = input.body;
                    if (inner && inner.kind === ts.SyntaxKind.ModuleBlock) {
                        const statements = ts.visitNodes(inner.statements, visitDeclarationStatements);
                        const body = ts.updateModuleBlock(inner, filterCandidateImports(statements));
                        needsDeclare = previousNeedsDeclare;
                        const mods = ensureModifiers(input);
                        return cleanup(ts.updateModuleDeclaration(input, 
                        /*decorators*/ undefined, mods, ts.isExternalModuleAugmentation(input) ? rewriteModuleSpecifier(input, input.name) : input.name, body));
                    }
                    else {
                        needsDeclare = previousNeedsDeclare;
                        const mods = ensureModifiers(input);
                        needsDeclare = false;
                        return cleanup(ts.updateModuleDeclaration(input, 
                        /*decorators*/ undefined, mods, input.name, ts.visitNode(inner, visitDeclarationStatements)));
                    }
                }
                case ts.SyntaxKind.ClassDeclaration: {
                    const modifiers = ts.createNodeArray(ensureModifiers(input));
                    const typeParameters = ensureTypeParams(input, input.typeParameters);
                    const ctor = ts.getFirstConstructorWithBody(input);
                    let parameterProperties;
                    if (ctor) {
                        const oldDiag = getSymbolAccessibilityDiagnostic;
                        parameterProperties = ts.compact(ts.flatMap(ctor.parameters, param => {
                            if (!ts.hasModifier(param, ts.ModifierFlags.ParameterPropertyModifier))
                                return;
                            getSymbolAccessibilityDiagnostic = ts.createGetSymbolAccessibilityDiagnosticForNode(param);
                            if (param.name.kind === ts.SyntaxKind.Identifier) {
                                return preserveJsDoc(ts.createProperty(
                                /*decorators*/ undefined, ensureModifiers(param), param.name, param.questionToken, ensureType(param, param.type), ensureNoInitializer(param)), param);
                            }
                            else {
                                // Pattern - this is currently an error, but we emit declarations for it somewhat correctly
                                return walkBindingPattern(param.name);
                            }
                            function walkBindingPattern(pattern) {
                                let elems;
                                for (const elem of pattern.elements) {
                                    if (ts.isOmittedExpression(elem))
                                        continue;
                                    if (ts.isBindingPattern(elem.name)) {
                                        elems = ts.concatenate(elems, walkBindingPattern(elem.name));
                                    }
                                    elems = elems || [];
                                    elems.push(ts.createProperty(
                                    /*decorators*/ undefined, ensureModifiers(param), elem.name, 
                                    /*questionToken*/ undefined, ensureType(elem, /*type*/ undefined), 
                                    /*initializer*/ undefined));
                                }
                                return elems;
                            }
                        }));
                        getSymbolAccessibilityDiagnostic = oldDiag;
                    }
                    const members = ts.createNodeArray(ts.concatenate(parameterProperties, ts.visitNodes(input.members, visitDeclarationSubtree)));
                    const extendsClause = ts.getClassExtendsHeritageClauseElement(input);
                    if (extendsClause && !ts.isEntityNameExpression(extendsClause.expression) && extendsClause.expression.kind !== ts.SyntaxKind.NullKeyword) {
                        // We must add a temporary declaration for the extends clause expression
                        const newId = ts.createOptimisticUniqueName(`${ts.unescapeLeadingUnderscores(input.name.escapedText)}_base`);
                        getSymbolAccessibilityDiagnostic = () => ({
                            diagnosticMessage: Diagnostics.extends_clause_of_exported_class_0_has_or_is_using_private_name_1,
                            errorNode: extendsClause,
                            typeName: input.name
                        });
                        const varDecl = ts.createVariableDeclaration(newId, resolver.createTypeOfExpression(extendsClause.expression, input, declarationEmitNodeBuilderFlags, symbolTracker), /*initializer*/ undefined);
                        const statement = ts.createVariableStatement(needsDeclare ? [ts.createModifier(ts.SyntaxKind.DeclareKeyword)] : [], ts.createVariableDeclarationList([varDecl], ts.NodeFlags.Const));
                        const heritageClauses = ts.createNodeArray(ts.map(input.heritageClauses, clause => {
                            if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
                                const oldDiag = getSymbolAccessibilityDiagnostic;
                                getSymbolAccessibilityDiagnostic = ts.createGetSymbolAccessibilityDiagnosticForNode(clause.types[0]);
                                const newClause = ts.updateHeritageClause(clause, ts.map(clause.types, t => ts.updateExpressionWithTypeArguments(t, ts.visitNodes(t.typeArguments, visitDeclarationSubtree), newId)));
                                getSymbolAccessibilityDiagnostic = oldDiag;
                                return newClause;
                            }
                            return ts.updateHeritageClause(clause, ts.visitNodes(ts.createNodeArray(ts.filter(clause.types, t => ts.isEntityNameExpression(t.expression) || t.expression.kind === ts.SyntaxKind.NullKeyword)), visitDeclarationSubtree));
                        }));
                        return [statement, cleanup(ts.updateClassDeclaration(input, 
                            /*decorators*/ undefined, modifiers, input.name, typeParameters, heritageClauses, members))];
                    }
                    else {
                        const heritageClauses = transformHeritageClauses(input.heritageClauses);
                        return cleanup(ts.updateClassDeclaration(input, 
                        /*decorators*/ undefined, modifiers, input.name, typeParameters, heritageClauses, members));
                    }
                }
                case ts.SyntaxKind.VariableStatement: {
                    const result = transformVariableStatement(input);
                    lateStatementReplacementMap.set("" + ts.getNodeId(input), result); // Don't actually elide yet; just leave as original node - will be elided/swapped by late pass
                    return cleanup(input);
                }
                case ts.SyntaxKind.EnumDeclaration: {
                    return cleanup(ts.updateEnumDeclaration(input, /*decorators*/ undefined, ts.createNodeArray(ensureModifiers(input)), input.name, ts.createNodeArray(ts.mapDefined(input.members, m => {
                        if (shouldStripInternal(m))
                            return;
                        // Rewrite enum values to their constants, if available
                        const constValue = resolver.getConstantValue(m);
                        return preserveJsDoc(ts.updateEnumMember(m, m.name, constValue !== undefined ? ts.createLiteral(constValue) : undefined), m);
                    }))));
                }
            }
            // Anything left unhandled is an error, so this should be unreachable
            return ts.Debug.assertNever(input, `Unhandled top-level node in declaration emit: ${ts.SyntaxKind[input.kind]}`);
            function cleanup(returnValue) {
                if (isEnclosingDeclaration(input)) {
                    enclosingDeclaration = previousEnclosingDeclaration;
                }
                if (input.kind === ts.SyntaxKind.ModuleDeclaration) {
                    needsDeclare = previousNeedsDeclare;
                    lateMarkedStatements = ts.concatenate(oldPossibleImports, lateMarkedStatements);
                }
                if (canProdiceDiagnostic) {
                    getSymbolAccessibilityDiagnostic = oldDiag;
                }
                if (returnValue && (!ts.isLateVisibilityPaintedStatement(input) || lateStatementReplacementMap.get("" + ts.getNodeId(input)))) {
                    if (!resultHasExternalModuleIndicator && ts.hasModifier(input, ts.ModifierFlags.Export) && ts.isSourceFile(input.parent)) {
                        // Exported top-level member indicates moduleness
                        resultHasExternalModuleIndicator = true;
                    }
                }
                if (returnValue === input) {
                    return returnValue;
                }
                return returnValue && ts.setOriginalNode(preserveJsDoc(returnValue, input), input);
            }
        }
        function transformVariableStatement(input, privateDeclaration) {
            if (!ts.forEach(input.declarationList.declarations, getBindingNameVisible))
                return;
            const nodes = ts.visitNodes(input.declarationList.declarations, visitDeclarationSubtree);
            if (!ts.length(nodes))
                return;
            return ts.updateVariableStatement(input, ts.createNodeArray(ensureModifiers(input, privateDeclaration)), ts.updateVariableDeclarationList(input.declarationList, nodes));
        }
        function recreateBindingPattern(d) {
            return ts.flatten(ts.mapDefined(d.elements, e => recreateBindingElement(e)));
        }
        function recreateBindingElement(e) {
            if (e.kind === ts.SyntaxKind.OmittedExpression) {
                return;
            }
            if (e.name) {
                if (!getBindingNameVisible(e))
                    return;
                if (ts.isBindingPattern(e.name)) {
                    return recreateBindingPattern(e.name);
                }
                else {
                    return ts.createVariableDeclaration(e.name, ensureType(e, /*type*/ undefined), /*initializer*/ undefined);
                }
            }
        }
        function checkName(node) {
            let oldDiag;
            if (!suppressNewDiagnosticContexts) {
                oldDiag = getSymbolAccessibilityDiagnostic;
                getSymbolAccessibilityDiagnostic = ts.createGetSymbolAccessibilityDiagnosticForNodeName(node);
            }
            errorNameNode = node.name;
            ts.Debug.assert(resolver.isLateBound(ts.getParseTreeNode(node))); // Should only be called with dynamic names
            const decl = node;
            const entityName = decl.name.expression;
            checkEntityNameVisibility(entityName, enclosingDeclaration);
            if (!suppressNewDiagnosticContexts) {
                getSymbolAccessibilityDiagnostic = oldDiag;
            }
            errorNameNode = undefined;
        }
        function hasInternalAnnotation(range) {
            const comment = currentSourceFile.text.substring(range.pos, range.end);
            return ts.stringContains(comment, "@internal");
        }
        function shouldStripInternal(node) {
            if (stripInternal && node) {
                const leadingCommentRanges = ts.getLeadingCommentRangesOfNode(ts.getParseTreeNode(node), currentSourceFile);
                if (ts.forEach(leadingCommentRanges, hasInternalAnnotation)) {
                    return true;
                }
            }
            return false;
        }
        function ensureModifiers(node, privateDeclaration) {
            const currentFlags = ts.getModifierFlags(node);
            const newFlags = ensureModifierFlags(node, privateDeclaration);
            if (currentFlags === newFlags) {
                return node.modifiers;
            }
            return ts.createModifiersFromModifierFlags(newFlags);
        }
        function ensureModifierFlags(node, privateDeclaration) {
            let mask = ts.ModifierFlags.All ^ (ts.ModifierFlags.Public | ts.ModifierFlags.Async); // No async modifiers in declaration files
            let additions = (needsDeclare && !isAlwaysType(node)) ? ts.ModifierFlags.Ambient : ts.ModifierFlags.None;
            const parentIsFile = node.parent.kind === ts.SyntaxKind.SourceFile;
            if (!parentIsFile || (isBundledEmit && parentIsFile && ts.isExternalModule(node.parent))) {
                mask ^= ((privateDeclaration || (isBundledEmit && parentIsFile) ? 0 : ts.ModifierFlags.Export) | ts.ModifierFlags.Default | ts.ModifierFlags.Ambient);
                additions = ts.ModifierFlags.None;
            }
            return maskModifierFlags(node, mask, additions);
        }
        function ensureAccessor(node) {
            const accessors = ts.getAllAccessorDeclarations(node.parent.members, node);
            if (node.kind !== accessors.firstAccessor.kind) {
                return;
            }
            let accessorType = getTypeAnnotationFromAccessor(node);
            if (!accessorType && accessors.secondAccessor) {
                accessorType = getTypeAnnotationFromAccessor(accessors.secondAccessor);
                // If we end up pulling the type from the second accessor, we also need to change the diagnostic context to get the expected error message
                getSymbolAccessibilityDiagnostic = ts.createGetSymbolAccessibilityDiagnosticForNode(accessors.secondAccessor);
            }
            const prop = ts.createProperty(/*decorators*/ undefined, maskModifiers(node, /*mask*/ undefined, (!accessors.setAccessor) ? ts.ModifierFlags.Readonly : ts.ModifierFlags.None), node.name, node.questionToken, ensureType(node, accessorType), /*initializer*/ undefined);
            const leadingsSyntheticCommentRanges = accessors.secondAccessor && ts.getLeadingCommentRangesOfNode(accessors.secondAccessor, currentSourceFile);
            if (leadingsSyntheticCommentRanges) {
                for (const range of leadingsSyntheticCommentRanges) {
                    if (range.kind === ts.SyntaxKind.MultiLineCommentTrivia) {
                        let text = currentSourceFile.text.slice(range.pos + 2, range.end - 2);
                        const lines = text.split(/\r\n?|\n/g);
                        if (lines.length > 1) {
                            const lastLines = lines.slice(1);
                            const indentation = ts.guessIndentation(lastLines);
                            text = [lines[0], ...ts.map(lastLines, l => l.slice(indentation))].join(newLine);
                        }
                        ts.addSyntheticLeadingComment(prop, range.kind, text, range.hasTrailingNewLine);
                    }
                }
            }
            return prop;
        }
        function transformHeritageClauses(nodes) {
            return ts.createNodeArray(ts.filter(ts.map(nodes, clause => ts.updateHeritageClause(clause, ts.visitNodes(ts.createNodeArray(ts.filter(clause.types, t => {
                return ts.isEntityNameExpression(t.expression) || (clause.token === ts.SyntaxKind.ExtendsKeyword && t.expression.kind === ts.SyntaxKind.NullKeyword);
            })), visitDeclarationSubtree))), clause => clause.types && !!clause.types.length));
        }
    }
    ts.transformDeclarations = transformDeclarations;
    function isAlwaysType(node) {
        if (node.kind === ts.SyntaxKind.InterfaceDeclaration) {
            return true;
        }
        return false;
    }
    // Elide "public" modifier, as it is the default
    function maskModifiers(node, modifierMask, modifierAdditions) {
        return ts.createModifiersFromModifierFlags(maskModifierFlags(node, modifierMask, modifierAdditions));
    }
    function maskModifierFlags(node, modifierMask = ts.ModifierFlags.All ^ ts.ModifierFlags.Public, modifierAdditions = ts.ModifierFlags.None) {
        let flags = (ts.getModifierFlags(node) & modifierMask) | modifierAdditions;
        if (flags & ts.ModifierFlags.Default && flags & ts.ModifierFlags.Ambient) {
            flags ^= ts.ModifierFlags.Ambient; // `declare` is never required alongside `default` (and would be an error if printed)
        }
        return flags;
    }
    function getTypeAnnotationFromAccessor(accessor) {
        if (accessor) {
            return accessor.kind === ts.SyntaxKind.GetAccessor
                ? accessor.type // Getter - return type
                : accessor.parameters.length > 0
                    ? accessor.parameters[0].type // Setter parameter type
                    : undefined;
        }
    }
    function canHaveLiteralInitializer(node) {
        switch (node.kind) {
            case ts.SyntaxKind.VariableDeclaration:
            case ts.SyntaxKind.PropertyDeclaration:
            case ts.SyntaxKind.PropertySignature:
            case ts.SyntaxKind.Parameter:
                return true;
        }
        return false;
    }
    function isPreservedDeclarationStatement(node) {
        switch (node.kind) {
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.ModuleDeclaration:
            case ts.SyntaxKind.ImportEqualsDeclaration:
            case ts.SyntaxKind.InterfaceDeclaration:
            case ts.SyntaxKind.ClassDeclaration:
            case ts.SyntaxKind.TypeAliasDeclaration:
            case ts.SyntaxKind.EnumDeclaration:
            case ts.SyntaxKind.VariableStatement:
            case ts.SyntaxKind.ImportDeclaration:
            case ts.SyntaxKind.ExportDeclaration:
            case ts.SyntaxKind.ExportAssignment:
                return true;
        }
        return false;
    }
    function isProcessedComponent(node) {
        switch (node.kind) {
            case ts.SyntaxKind.ConstructSignature:
            case ts.SyntaxKind.Constructor:
            case ts.SyntaxKind.MethodDeclaration:
            case ts.SyntaxKind.GetAccessor:
            case ts.SyntaxKind.SetAccessor:
            case ts.SyntaxKind.PropertyDeclaration:
            case ts.SyntaxKind.PropertySignature:
            case ts.SyntaxKind.MethodSignature:
            case ts.SyntaxKind.CallSignature:
            case ts.SyntaxKind.IndexSignature:
            case ts.SyntaxKind.VariableDeclaration:
            case ts.SyntaxKind.TypeParameter:
            case ts.SyntaxKind.ExpressionWithTypeArguments:
            case ts.SyntaxKind.TypeReference:
            case ts.SyntaxKind.ConditionalType:
            case ts.SyntaxKind.FunctionType:
            case ts.SyntaxKind.ConstructorType:
            case ts.SyntaxKind.ImportType:
                return true;
        }
        return false;
    }
})(ts || (ts = {}));
