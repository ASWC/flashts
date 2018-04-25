/* @internal */
var ts;
(function (ts) {
    var FindAllReferences;
    (function (FindAllReferences) {
        function nodeEntry(node, isInString) {
            return { type: "node", node, isInString };
        }
        FindAllReferences.nodeEntry = nodeEntry;
        function findReferencedSymbols(program, cancellationToken, sourceFiles, sourceFile, position) {
            const node = ts.getTouchingPropertyName(sourceFile, position, /*includeJsDocComment*/ true);
            const referencedSymbols = FindAllReferences.Core.getReferencedSymbolsForNode(position, node, program, sourceFiles, cancellationToken);
            const checker = program.getTypeChecker();
            return !referencedSymbols || !referencedSymbols.length ? undefined : ts.mapDefined(referencedSymbols, ({ definition, references }) => 
            // Only include referenced symbols that have a valid definition.
            definition && { definition: definitionToReferencedSymbolDefinitionInfo(definition, checker, node), references: references.map(toReferenceEntry) });
        }
        FindAllReferences.findReferencedSymbols = findReferencedSymbols;
        function getImplementationsAtPosition(program, cancellationToken, sourceFiles, sourceFile, position) {
            // A node in a JSDoc comment can't have an implementation anyway.
            const node = ts.getTouchingPropertyName(sourceFile, position, /*includeJsDocComment*/ false);
            const referenceEntries = getImplementationReferenceEntries(program, cancellationToken, sourceFiles, node, position);
            const checker = program.getTypeChecker();
            return ts.map(referenceEntries, entry => toImplementationLocation(entry, checker));
        }
        FindAllReferences.getImplementationsAtPosition = getImplementationsAtPosition;
        function getImplementationReferenceEntries(program, cancellationToken, sourceFiles, node, position) {
            if (node.kind === ts.SyntaxKind.SourceFile) {
                return undefined;
            }
            const checker = program.getTypeChecker();
            // If invoked directly on a shorthand property assignment, then return
            // the declaration of the symbol being assigned (not the symbol being assigned to).
            if (node.parent.kind === ts.SyntaxKind.ShorthandPropertyAssignment) {
                const result = [];
                FindAllReferences.Core.getReferenceEntriesForShorthandPropertyAssignment(node, checker, node => result.push(nodeEntry(node)));
                return result;
            }
            else if (node.kind === ts.SyntaxKind.SuperKeyword || ts.isSuperProperty(node.parent)) {
                // References to and accesses on the super keyword only have one possible implementation, so no
                // need to "Find all References"
                const symbol = checker.getSymbolAtLocation(node);
                return symbol.valueDeclaration && [nodeEntry(symbol.valueDeclaration)];
            }
            else {
                // Perform "Find all References" and retrieve only those that are implementations
                return getReferenceEntriesForNode(position, node, program, sourceFiles, cancellationToken, { implementations: true });
            }
        }
        function findReferencedEntries(program, cancellationToken, sourceFiles, sourceFile, position, options) {
            const node = ts.getTouchingPropertyName(sourceFile, position, /*includeJsDocComment*/ true);
            return ts.map(flattenEntries(FindAllReferences.Core.getReferencedSymbolsForNode(position, node, program, sourceFiles, cancellationToken, options)), toReferenceEntry);
        }
        FindAllReferences.findReferencedEntries = findReferencedEntries;
        function getReferenceEntriesForNode(position, node, program, sourceFiles, cancellationToken, options = {}, sourceFilesSet = ts.arrayToSet(sourceFiles, f => f.fileName)) {
            return flattenEntries(FindAllReferences.Core.getReferencedSymbolsForNode(position, node, program, sourceFiles, cancellationToken, options, sourceFilesSet));
        }
        FindAllReferences.getReferenceEntriesForNode = getReferenceEntriesForNode;
        function flattenEntries(referenceSymbols) {
            return referenceSymbols && ts.flatMap(referenceSymbols, r => r.references);
        }
        function definitionToReferencedSymbolDefinitionInfo(def, checker, originalNode) {
            const info = (() => {
                switch (def.type) {
                    case "symbol": {
                        const { symbol } = def;
                        const { displayParts, kind } = getDefinitionKindAndDisplayParts(symbol, checker, originalNode);
                        const name = displayParts.map(p => p.text).join("");
                        return { node: symbol.declarations ? ts.getNameOfDeclaration(ts.first(symbol.declarations)) || ts.first(symbol.declarations) : originalNode, name, kind, displayParts };
                    }
                    case "label": {
                        const { node } = def;
                        return { node, name: node.text, kind: ts.ScriptElementKind.label, displayParts: [ts.displayPart(node.text, ts.SymbolDisplayPartKind.text)] };
                    }
                    case "keyword": {
                        const { node } = def;
                        const name = ts.tokenToString(node.kind);
                        return { node, name, kind: ts.ScriptElementKind.keyword, displayParts: [{ text: name, kind: ts.ScriptElementKind.keyword }] };
                    }
                    case "this": {
                        const { node } = def;
                        const symbol = checker.getSymbolAtLocation(node);
                        const displayParts = symbol && ts.SymbolDisplay.getSymbolDisplayPartsDocumentationAndSymbolKind(checker, symbol, node.getSourceFile(), ts.getContainerNode(node), node).displayParts;
                        return { node, name: "this", kind: ts.ScriptElementKind.variableElement, displayParts };
                    }
                    case "string": {
                        const { node } = def;
                        return { node, name: node.text, kind: ts.ScriptElementKind.variableElement, displayParts: [ts.displayPart(ts.getTextOfNode(node), ts.SymbolDisplayPartKind.stringLiteral)] };
                    }
                    default:
                        return ts.Debug.assertNever(def);
                }
            })();
            const { node, name, kind, displayParts } = info;
            const sourceFile = node.getSourceFile();
            return { containerKind: ts.ScriptElementKind.unknown, containerName: "", fileName: sourceFile.fileName, kind, name, textSpan: getTextSpan(ts.isComputedPropertyName(node) ? node.expression : node, sourceFile), displayParts };
        }
        function getDefinitionKindAndDisplayParts(symbol, checker, node) {
            const meaning = FindAllReferences.Core.getIntersectingMeaningFromDeclarations(node, symbol);
            const enclosingDeclaration = ts.firstOrUndefined(symbol.declarations) || node;
            const { displayParts, symbolKind } = ts.SymbolDisplay.getSymbolDisplayPartsDocumentationAndSymbolKind(checker, symbol, enclosingDeclaration.getSourceFile(), enclosingDeclaration, enclosingDeclaration, meaning);
            return { displayParts, kind: symbolKind };
        }
        function toReferenceEntry(entry) {
            if (entry.type === "span") {
                return { textSpan: entry.textSpan, fileName: entry.fileName, isWriteAccess: false, isDefinition: false };
            }
            const { node, isInString } = entry;
            const sourceFile = node.getSourceFile();
            return {
                fileName: sourceFile.fileName,
                textSpan: getTextSpan(node, sourceFile),
                isWriteAccess: isWriteAccessForReference(node),
                isDefinition: node.kind === ts.SyntaxKind.DefaultKeyword
                    || ts.isAnyDeclarationName(node)
                    || ts.isLiteralComputedPropertyDeclarationName(node),
                isInString,
            };
        }
        function toImplementationLocation(entry, checker) {
            if (entry.type === "node") {
                const { node } = entry;
                const sourceFile = node.getSourceFile();
                return Object.assign({ textSpan: getTextSpan(node, sourceFile), fileName: sourceFile.fileName }, implementationKindDisplayParts(node, checker));
            }
            else {
                const { textSpan, fileName } = entry;
                return { textSpan, fileName, kind: ts.ScriptElementKind.unknown, displayParts: [] };
            }
        }
        function implementationKindDisplayParts(node, checker) {
            const symbol = checker.getSymbolAtLocation(ts.isDeclaration(node) && node.name ? node.name : node);
            if (symbol) {
                return getDefinitionKindAndDisplayParts(symbol, checker, node);
            }
            else if (node.kind === ts.SyntaxKind.ObjectLiteralExpression) {
                return {
                    kind: ts.ScriptElementKind.interfaceElement,
                    displayParts: [ts.punctuationPart(ts.SyntaxKind.OpenParenToken), ts.textPart("object literal"), ts.punctuationPart(ts.SyntaxKind.CloseParenToken)]
                };
            }
            else if (node.kind === ts.SyntaxKind.ClassExpression) {
                return {
                    kind: ts.ScriptElementKind.localClassElement,
                    displayParts: [ts.punctuationPart(ts.SyntaxKind.OpenParenToken), ts.textPart("anonymous local class"), ts.punctuationPart(ts.SyntaxKind.CloseParenToken)]
                };
            }
            else {
                return { kind: ts.getNodeKind(node), displayParts: [] };
            }
        }
        function toHighlightSpan(entry) {
            if (entry.type === "span") {
                const { fileName, textSpan } = entry;
                return { fileName, span: { textSpan, kind: ts.HighlightSpanKind.reference } };
            }
            const { node, isInString } = entry;
            const sourceFile = node.getSourceFile();
            const writeAccess = isWriteAccessForReference(node);
            const span = {
                textSpan: getTextSpan(node, sourceFile),
                kind: writeAccess ? ts.HighlightSpanKind.writtenReference : ts.HighlightSpanKind.reference,
                isInString
            };
            return { fileName: sourceFile.fileName, span };
        }
        FindAllReferences.toHighlightSpan = toHighlightSpan;
        function getTextSpan(node, sourceFile) {
            let start = node.getStart(sourceFile);
            let end = node.getEnd();
            if (node.kind === ts.SyntaxKind.StringLiteral) {
                start += 1;
                end -= 1;
            }
            return ts.createTextSpanFromBounds(start, end);
        }
        /** A node is considered a writeAccess iff it is a name of a declaration or a target of an assignment */
        function isWriteAccessForReference(node) {
            return node.kind === ts.SyntaxKind.DefaultKeyword || ts.isAnyDeclarationName(node) || ts.isWriteAccess(node);
        }
    })(FindAllReferences = ts.FindAllReferences || (ts.FindAllReferences = {}));
})(ts || (ts = {}));
/** Encapsulates the core find-all-references algorithm. */
/* @internal */
(function (ts) {
    var FindAllReferences;
    (function (FindAllReferences) {
        var Core;
        (function (Core) {
            /** Core find-all-references algorithm. Handles special cases before delegating to `getReferencedSymbolsForSymbol`. */
            function getReferencedSymbolsForNode(position, node, program, sourceFiles, cancellationToken, options = {}, sourceFilesSet = ts.arrayToSet(sourceFiles, f => f.fileName)) {
                if (ts.isSourceFile(node)) {
                    const reference = ts.GoToDefinition.getReferenceAtPosition(node, position, program);
                    return reference && getReferencedSymbolsForModule(program, program.getTypeChecker().getMergedSymbol(reference.file.symbol), sourceFiles, sourceFilesSet);
                }
                if (!options.implementations) {
                    const special = getReferencedSymbolsSpecial(node, sourceFiles, cancellationToken);
                    if (special) {
                        return special;
                    }
                }
                const checker = program.getTypeChecker();
                const symbol = checker.getSymbolAtLocation(node);
                // Could not find a symbol e.g. unknown identifier
                if (!symbol) {
                    // String literal might be a property (and thus have a symbol), so do this here rather than in getReferencedSymbolsSpecial.
                    return !options.implementations && ts.isStringLiteral(node) ? getReferencesForStringLiteral(node, sourceFiles, cancellationToken) : undefined;
                }
                if (symbol.flags & ts.SymbolFlags.Module && isModuleReferenceLocation(node)) {
                    return getReferencedSymbolsForModule(program, symbol, sourceFiles, sourceFilesSet);
                }
                return getReferencedSymbolsForSymbol(symbol, node, sourceFiles, sourceFilesSet, checker, cancellationToken, options);
            }
            Core.getReferencedSymbolsForNode = getReferencedSymbolsForNode;
            function isModuleReferenceLocation(node) {
                if (!ts.isStringLiteralLike(node)) {
                    return false;
                }
                switch (node.parent.kind) {
                    case ts.SyntaxKind.ModuleDeclaration:
                    case ts.SyntaxKind.ExternalModuleReference:
                    case ts.SyntaxKind.ImportDeclaration:
                    case ts.SyntaxKind.ExportDeclaration:
                        return true;
                    case ts.SyntaxKind.CallExpression:
                        return ts.isRequireCall(node.parent, /*checkArgumentIsStringLiteralLike*/ false) || ts.isImportCall(node.parent);
                    default:
                        return false;
                }
            }
            function getReferencedSymbolsForModule(program, symbol, sourceFiles, sourceFilesSet) {
                ts.Debug.assert(!!symbol.valueDeclaration);
                const references = FindAllReferences.findModuleReferences(program, sourceFiles, symbol).map(reference => {
                    if (reference.kind === "import") {
                        return { type: "node", node: reference.literal };
                    }
                    else {
                        return {
                            type: "span",
                            fileName: reference.referencingFile.fileName,
                            textSpan: ts.createTextSpanFromRange(reference.ref),
                        };
                    }
                });
                for (const decl of symbol.declarations) {
                    switch (decl.kind) {
                        case ts.SyntaxKind.SourceFile:
                            // Don't include the source file itself. (This may not be ideal behavior, but awkward to include an entire file as a reference.)
                            break;
                        case ts.SyntaxKind.ModuleDeclaration:
                            if (sourceFilesSet.has(decl.getSourceFile().fileName)) {
                                references.push({ type: "node", node: decl.name });
                            }
                            break;
                        default:
                            ts.Debug.fail("Expected a module symbol to be declared by a SourceFile or ModuleDeclaration.");
                    }
                }
                return [{ definition: { type: "symbol", symbol }, references }];
            }
            /** getReferencedSymbols for special node kinds. */
            function getReferencedSymbolsSpecial(node, sourceFiles, cancellationToken) {
                if (ts.isTypeKeyword(node.kind)) {
                    return getAllReferencesForKeyword(sourceFiles, node.kind, cancellationToken);
                }
                // Labels
                if (ts.isJumpStatementTarget(node)) {
                    const labelDefinition = ts.getTargetLabel(node.parent, node.text);
                    // if we have a label definition, look within its statement for references, if not, then
                    // the label is undefined and we have no results..
                    return labelDefinition && getLabelReferencesInNode(labelDefinition.parent, labelDefinition);
                }
                else if (ts.isLabelOfLabeledStatement(node)) {
                    // it is a label definition and not a target, search within the parent labeledStatement
                    return getLabelReferencesInNode(node.parent, node);
                }
                if (ts.isThis(node)) {
                    return getReferencesForThisKeyword(node, sourceFiles, cancellationToken);
                }
                if (node.kind === ts.SyntaxKind.SuperKeyword) {
                    return getReferencesForSuperKeyword(node);
                }
                return undefined;
            }
            /** Core find-all-references algorithm for a normal symbol. */
            function getReferencedSymbolsForSymbol(symbol, node, sourceFiles, sourceFilesSet, checker, cancellationToken, options) {
                symbol = skipPastExportOrImportSpecifierOrUnion(symbol, node, checker) || symbol;
                // Compute the meaning from the location and the symbol it references
                const searchMeaning = getIntersectingMeaningFromDeclarations(node, symbol);
                const result = [];
                const state = new State(sourceFiles, sourceFilesSet, getSpecialSearchKind(node), checker, cancellationToken, searchMeaning, options, result);
                if (node.kind === ts.SyntaxKind.DefaultKeyword) {
                    addReference(node, symbol, state);
                    searchForImportsOfExport(node, symbol, { exportingModuleSymbol: ts.Debug.assertDefined(symbol.parent, "Expected export symbol to have a parent"), exportKind: 1 /* Default */ }, state);
                }
                else {
                    const search = state.createSearch(node, symbol, /*comingFrom*/ undefined, { allSearchSymbols: populateSearchSymbolSet(symbol, node, checker, options.implementations) });
                    // Try to get the smallest valid scope that we can limit our search to;
                    // otherwise we'll need to search globally (i.e. include each file).
                    const scope = getSymbolScope(symbol);
                    if (scope) {
                        getReferencesInContainer(scope, scope.getSourceFile(), search, state, /*addReferencesHere*/ !(ts.isSourceFile(scope) && !ts.contains(sourceFiles, scope)));
                    }
                    else {
                        // Global search
                        for (const sourceFile of state.sourceFiles) {
                            state.cancellationToken.throwIfCancellationRequested();
                            searchForName(sourceFile, search, state);
                        }
                    }
                }
                return result;
            }
            function getSpecialSearchKind(node) {
                switch (node.kind) {
                    case ts.SyntaxKind.ConstructorKeyword:
                        return 1 /* Constructor */;
                    case ts.SyntaxKind.Identifier:
                        if (ts.isClassLike(node.parent)) {
                            ts.Debug.assert(node.parent.name === node);
                            return 2 /* Class */;
                        }
                    // falls through
                    default:
                        return 0 /* None */;
                }
            }
            /** Handle a few special cases relating to export/import specifiers. */
            function skipPastExportOrImportSpecifierOrUnion(symbol, node, checker) {
                const { parent } = node;
                if (ts.isExportSpecifier(parent)) {
                    return getLocalSymbolForExportSpecifier(node, symbol, parent, checker);
                }
                if (ts.isImportSpecifier(parent) && parent.propertyName === node) {
                    // We're at `foo` in `import { foo as bar }`. Probably intended to find all refs on the original, not just on the import.
                    return checker.getImmediateAliasedSymbol(symbol);
                }
                // If the symbol is declared as part of a declaration like `{ type: "a" } | { type: "b" }`, use the property on the union type to get more references.
                return ts.firstDefined(symbol.declarations, decl => {
                    if (!decl.parent) {
                        // Assertions for GH#21814. We should be handling SourceFile symbols in `getReferencedSymbolsForModule` instead of getting here.
                        ts.Debug.assert(decl.kind === ts.SyntaxKind.SourceFile);
                        ts.Debug.fail(`Unexpected symbol at ${ts.Debug.showSyntaxKind(node)}: ${ts.Debug.showSymbol(symbol)}`);
                    }
                    return ts.isTypeLiteralNode(decl.parent) && ts.isUnionTypeNode(decl.parent.parent)
                        ? checker.getPropertyOfType(checker.getTypeFromTypeNode(decl.parent.parent), symbol.name)
                        : undefined;
                });
            }
            /**
             * Holds all state needed for the finding references.
             * Unlike `Search`, there is only one `State`.
             */
            class State {
                constructor(sourceFiles, sourceFilesSet, 
                /** True if we're searching for constructor references. */
                specialSearchKind, checker, cancellationToken, searchMeaning, options, result) {
                    this.sourceFiles = sourceFiles;
                    this.sourceFilesSet = sourceFilesSet;
                    this.specialSearchKind = specialSearchKind;
                    this.checker = checker;
                    this.cancellationToken = cancellationToken;
                    this.searchMeaning = searchMeaning;
                    this.options = options;
                    this.result = result;
                    /** Cache for `explicitlyinheritsFrom`. */
                    this.inheritsFromCache = ts.createMap();
                    /**
                     * Type nodes can contain multiple references to the same type. For example:
                     *      let x: Foo & (Foo & Bar) = ...
                     * Because we are returning the implementation locations and not the identifier locations,
                     * duplicate entries would be returned here as each of the type references is part of
                     * the same implementation. For that reason, check before we add a new entry.
                     */
                    this.markSeenContainingTypeReference = ts.nodeSeenTracker();
                    /**
                     * It's possible that we will encounter the right side of `export { foo as bar } from "x";` more than once.
                     * For example:
                     *     // b.ts
                     *     export { foo as bar } from "./a";
                     *     import { bar } from "./b";
                     *
                     * Normally at `foo as bar` we directly add `foo` and do not locally search for it (since it doesn't declare a local).
                     * But another reference to it may appear in the same source file.
                     * See `tests/cases/fourslash/transitiveExportImports3.ts`.
                     */
                    this.markSeenReExportRHS = ts.nodeSeenTracker();
                    this.symbolIdToReferences = [];
                    // Source file ID → symbol ID → Whether the symbol has been searched for in the source file.
                    this.sourceFileToSeenSymbols = [];
                }
                includesSourceFile(sourceFile) {
                    return this.sourceFilesSet.has(sourceFile.fileName);
                }
                /** Gets every place to look for references of an exported symbols. See `ImportsResult` in `importTracker.ts` for more documentation. */
                getImportSearches(exportSymbol, exportInfo) {
                    if (!this.importTracker)
                        this.importTracker = FindAllReferences.createImportTracker(this.sourceFiles, this.sourceFilesSet, this.checker, this.cancellationToken);
                    return this.importTracker(exportSymbol, exportInfo, this.options.isForRename);
                }
                /** @param allSearchSymbols set of additinal symbols for use by `includes`. */
                createSearch(location, symbol, comingFrom, searchOptions = {}) {
                    // Note: if this is an external module symbol, the name doesn't include quotes.
                    // Note: getLocalSymbolForExportDefault handles `export default class C {}`, but not `export default C` or `export { C as default }`.
                    // The other two forms seem to be handled downstream (e.g. in `skipPastExportOrImportSpecifier`), so special-casing the first form
                    // here appears to be intentional).
                    const { text = ts.stripQuotes(ts.unescapeLeadingUnderscores((ts.getLocalSymbolForExportDefault(symbol) || symbol).escapedName)), allSearchSymbols = [symbol], } = searchOptions;
                    const escapedText = ts.escapeLeadingUnderscores(text);
                    const parents = this.options.implementations && getParentSymbolsOfPropertyAccess(location, symbol, this.checker);
                    return { symbol, comingFrom, text, escapedText, parents, allSearchSymbols, includes: sym => ts.contains(allSearchSymbols, sym) };
                }
                /**
                 * Callback to add references for a particular searched symbol.
                 * This initializes a reference group, so only call this if you will add at least one reference.
                 */
                referenceAdder(searchSymbol) {
                    const symbolId = ts.getSymbolId(searchSymbol);
                    let references = this.symbolIdToReferences[symbolId];
                    if (!references) {
                        references = this.symbolIdToReferences[symbolId] = [];
                        this.result.push({ definition: { type: "symbol", symbol: searchSymbol }, references });
                    }
                    return node => references.push(FindAllReferences.nodeEntry(node));
                }
                /** Add a reference with no associated definition. */
                addStringOrCommentReference(fileName, textSpan) {
                    this.result.push({
                        definition: undefined,
                        references: [{ type: "span", fileName, textSpan }]
                    });
                }
                /** Returns `true` the first time we search for a symbol in a file and `false` afterwards. */
                markSearchedSymbols(sourceFile, symbols) {
                    const sourceId = ts.getNodeId(sourceFile);
                    const seenSymbols = this.sourceFileToSeenSymbols[sourceId] || (this.sourceFileToSeenSymbols[sourceId] = ts.createMap());
                    let anyNewSymbols = false;
                    for (const sym of symbols) {
                        anyNewSymbols = ts.addToSeen(seenSymbols, ts.getSymbolId(sym)) || anyNewSymbols;
                    }
                    return anyNewSymbols;
                }
            }
            /** Search for all imports of a given exported symbol using `State.getImportSearches`. */
            function searchForImportsOfExport(exportLocation, exportSymbol, exportInfo, state) {
                const { importSearches, singleReferences, indirectUsers } = state.getImportSearches(exportSymbol, exportInfo);
                // For `import { foo as bar }` just add the reference to `foo`, and don't otherwise search in the file.
                if (singleReferences.length) {
                    const addRef = state.referenceAdder(exportSymbol);
                    for (const singleRef of singleReferences) {
                        // At `default` in `import { default as x }` or `export { default as x }`, do add a reference, but do not rename.
                        if (!(state.options.isForRename && (ts.isExportSpecifier(singleRef.parent) || ts.isImportSpecifier(singleRef.parent)) && singleRef.escapedText === ts.InternalSymbolName.Default)) {
                            addRef(singleRef);
                        }
                    }
                }
                // For each import, find all references to that import in its source file.
                for (const [importLocation, importSymbol] of importSearches) {
                    getReferencesInSourceFile(importLocation.getSourceFile(), state.createSearch(importLocation, importSymbol, 1 /* Export */), state);
                }
                if (indirectUsers.length) {
                    let indirectSearch;
                    switch (exportInfo.exportKind) {
                        case 0 /* Named */:
                            indirectSearch = state.createSearch(exportLocation, exportSymbol, 1 /* Export */);
                            break;
                        case 1 /* Default */:
                            // Search for a property access to '.default'. This can't be renamed.
                            indirectSearch = state.options.isForRename ? undefined : state.createSearch(exportLocation, exportSymbol, 1 /* Export */, { text: "default" });
                            break;
                        case 2 /* ExportEquals */:
                            break;
                    }
                    if (indirectSearch) {
                        for (const indirectUser of indirectUsers) {
                            searchForName(indirectUser, indirectSearch, state);
                        }
                    }
                }
            }
            // Go to the symbol we imported from and find references for it.
            function searchForImportedSymbol(symbol, state) {
                for (const declaration of symbol.declarations) {
                    const exportingFile = declaration.getSourceFile();
                    // Need to search in the file even if it's not in the search-file set, because it might export the symbol.
                    getReferencesInSourceFile(exportingFile, state.createSearch(declaration, symbol, 0 /* Import */), state, state.includesSourceFile(exportingFile));
                }
            }
            /** Search for all occurences of an identifier in a source file (and filter out the ones that match). */
            function searchForName(sourceFile, search, state) {
                if (ts.getNameTable(sourceFile).get(search.escapedText) !== undefined) {
                    getReferencesInSourceFile(sourceFile, search, state);
                }
            }
            function getPropertySymbolOfDestructuringAssignment(location, checker) {
                return ts.isArrayLiteralOrObjectLiteralDestructuringPattern(location.parent.parent) &&
                    checker.getPropertySymbolOfDestructuringAssignment(location);
            }
            function getObjectBindingElementWithoutPropertyName(symbol) {
                const bindingElement = ts.getDeclarationOfKind(symbol, ts.SyntaxKind.BindingElement);
                if (bindingElement &&
                    bindingElement.parent.kind === ts.SyntaxKind.ObjectBindingPattern &&
                    !bindingElement.propertyName) {
                    return bindingElement;
                }
            }
            function getPropertySymbolOfObjectBindingPatternWithoutPropertyName(symbol, checker) {
                const bindingElement = getObjectBindingElementWithoutPropertyName(symbol);
                if (!bindingElement)
                    return undefined;
                const typeOfPattern = checker.getTypeAtLocation(bindingElement.parent);
                const propSymbol = typeOfPattern && checker.getPropertyOfType(typeOfPattern, bindingElement.name.text);
                if (propSymbol && propSymbol.flags & ts.SymbolFlags.Accessor) {
                    // See GH#16922
                    ts.Debug.assert(!!(propSymbol.flags & ts.SymbolFlags.Transient));
                    return propSymbol.target;
                }
                return propSymbol;
            }
            /**
             * Determines the smallest scope in which a symbol may have named references.
             * Note that not every construct has been accounted for. This function can
             * probably be improved.
             *
             * @returns undefined if the scope cannot be determined, implying that
             * a reference to a symbol can occur anywhere.
             */
            function getSymbolScope(symbol) {
                // If this is the symbol of a named function expression or named class expression,
                // then named references are limited to its own scope.
                const { declarations, flags, parent, valueDeclaration } = symbol;
                if (valueDeclaration && (valueDeclaration.kind === ts.SyntaxKind.FunctionExpression || valueDeclaration.kind === ts.SyntaxKind.ClassExpression)) {
                    return valueDeclaration;
                }
                if (!declarations) {
                    return undefined;
                }
                // If this is private property or method, the scope is the containing class
                if (flags & (ts.SymbolFlags.Property | ts.SymbolFlags.Method)) {
                    const privateDeclaration = ts.find(declarations, d => ts.hasModifier(d, ts.ModifierFlags.Private));
                    if (privateDeclaration) {
                        return ts.getAncestor(privateDeclaration, ts.SyntaxKind.ClassDeclaration);
                    }
                    // Else this is a public property and could be accessed from anywhere.
                    return undefined;
                }
                // If symbol is of object binding pattern element without property name we would want to
                // look for property too and that could be anywhere
                if (getObjectBindingElementWithoutPropertyName(symbol)) {
                    return undefined;
                }
                /*
                If the symbol has a parent, it's globally visible unless:
                - It's a private property (handled above).
                - It's a type parameter.
                - The parent is an external module: then we should only search in the module (and recurse on the export later).
                  - But if the parent has `export as namespace`, the symbol is globally visible through that namespace.
                */
                const exposedByParent = parent && !(symbol.flags & ts.SymbolFlags.TypeParameter);
                if (exposedByParent && !((parent.flags & ts.SymbolFlags.Module) && ts.isExternalModuleSymbol(parent) && !parent.globalExports)) {
                    return undefined;
                }
                let scope;
                for (const declaration of declarations) {
                    const container = ts.getContainerNode(declaration);
                    if (scope && scope !== container) {
                        // Different declarations have different containers, bail out
                        return undefined;
                    }
                    if (!container || container.kind === ts.SyntaxKind.SourceFile && !ts.isExternalOrCommonJsModule(container)) {
                        // This is a global variable and not an external module, any declaration defined
                        // within this scope is visible outside the file
                        return undefined;
                    }
                    // The search scope is the container node
                    scope = container;
                }
                // If symbol.parent, this means we are in an export of an external module. (Otherwise we would have returned `undefined` above.)
                // For an export of a module, we may be in a declaration file, and it may be accessed elsewhere. E.g.:
                //     declare module "a" { export type T = number; }
                //     declare module "b" { import { T } from "a"; export const x: T; }
                // So we must search the whole source file. (Because we will mark the source file as seen, we we won't return to it when searching for imports.)
                return exposedByParent ? scope.getSourceFile() : scope;
            }
            /** Used as a quick check for whether a symbol is used at all in a file (besides its definition). */
            function isSymbolReferencedInFile(definition, checker, sourceFile) {
                const symbol = checker.getSymbolAtLocation(definition);
                if (!symbol)
                    return true; // Be lenient with invalid code.
                return getPossibleSymbolReferenceNodes(sourceFile, symbol.name).some(token => {
                    if (!ts.isIdentifier(token) || token === definition || token.escapedText !== definition.escapedText)
                        return false;
                    const referenceSymbol = checker.getSymbolAtLocation(token);
                    return referenceSymbol === symbol
                        || checker.getShorthandAssignmentValueSymbol(token.parent) === symbol
                        || ts.isExportSpecifier(token.parent) && getLocalSymbolForExportSpecifier(token, referenceSymbol, token.parent, checker) === symbol;
                });
            }
            Core.isSymbolReferencedInFile = isSymbolReferencedInFile;
            function getPossibleSymbolReferenceNodes(sourceFile, symbolName, container = sourceFile) {
                return getPossibleSymbolReferencePositions(sourceFile, symbolName, container).map(pos => ts.getTouchingPropertyName(sourceFile, pos, /*includeJsDocComment*/ true));
            }
            function getPossibleSymbolReferencePositions(sourceFile, symbolName, container = sourceFile) {
                const positions = [];
                /// TODO: Cache symbol existence for files to save text search
                // Also, need to make this work for unicode escapes.
                // Be resilient in the face of a symbol with no name or zero length name
                if (!symbolName || !symbolName.length) {
                    return positions;
                }
                const text = sourceFile.text;
                const sourceLength = text.length;
                const symbolNameLength = symbolName.length;
                let position = text.indexOf(symbolName, container.pos);
                while (position >= 0) {
                    // If we are past the end, stop looking
                    if (position > container.end)
                        break;
                    // We found a match.  Make sure it's not part of a larger word (i.e. the char
                    // before and after it have to be a non-identifier char).
                    const endPosition = position + symbolNameLength;
                    if ((position === 0 || !ts.isIdentifierPart(text.charCodeAt(position - 1), ts.ScriptTarget.Latest)) &&
                        (endPosition === sourceLength || !ts.isIdentifierPart(text.charCodeAt(endPosition), ts.ScriptTarget.Latest))) {
                        // Found a real match.  Keep searching.
                        positions.push(position);
                    }
                    position = text.indexOf(symbolName, position + symbolNameLength + 1);
                }
                return positions;
            }
            function getLabelReferencesInNode(container, targetLabel) {
                const sourceFile = container.getSourceFile();
                const labelName = targetLabel.text;
                const references = ts.mapDefined(getPossibleSymbolReferenceNodes(sourceFile, labelName, container), node => 
                // Only pick labels that are either the target label, or have a target that is the target label
                node === targetLabel || (ts.isJumpStatementTarget(node) && ts.getTargetLabel(node, labelName) === targetLabel) ? FindAllReferences.nodeEntry(node) : undefined);
                return [{ definition: { type: "label", node: targetLabel }, references }];
            }
            function isValidReferencePosition(node, searchSymbolName) {
                // Compare the length so we filter out strict superstrings of the symbol we are looking for
                switch (node.kind) {
                    case ts.SyntaxKind.Identifier:
                        return node.text.length === searchSymbolName.length;
                    case ts.SyntaxKind.StringLiteral: {
                        const str = node;
                        return (ts.isLiteralNameOfPropertyDeclarationOrIndexAccess(str) || ts.isNameOfModuleDeclaration(node) || ts.isExpressionOfExternalModuleImportEqualsDeclaration(node)) &&
                            str.text.length === searchSymbolName.length;
                    }
                    case ts.SyntaxKind.NumericLiteral:
                        return ts.isLiteralNameOfPropertyDeclarationOrIndexAccess(node) && node.text.length === searchSymbolName.length;
                    case ts.SyntaxKind.DefaultKeyword:
                        return "default".length === searchSymbolName.length;
                    default:
                        return false;
                }
            }
            function getAllReferencesForKeyword(sourceFiles, keywordKind, cancellationToken) {
                const references = ts.flatMap(sourceFiles, sourceFile => {
                    cancellationToken.throwIfCancellationRequested();
                    return ts.mapDefined(getPossibleSymbolReferenceNodes(sourceFile, ts.tokenToString(keywordKind), sourceFile), referenceLocation => referenceLocation.kind === keywordKind ? FindAllReferences.nodeEntry(referenceLocation) : undefined);
                });
                return references.length ? [{ definition: { type: "keyword", node: references[0].node }, references }] : undefined;
            }
            function getReferencesInSourceFile(sourceFile, search, state, addReferencesHere = true) {
                state.cancellationToken.throwIfCancellationRequested();
                return getReferencesInContainer(sourceFile, sourceFile, search, state, addReferencesHere);
            }
            /**
             * Search within node "container" for references for a search value, where the search value is defined as a
             * tuple of(searchSymbol, searchText, searchLocation, and searchMeaning).
             * searchLocation: a node where the search value
             */
            function getReferencesInContainer(container, sourceFile, search, state, addReferencesHere) {
                if (!state.markSearchedSymbols(sourceFile, search.allSearchSymbols)) {
                    return;
                }
                for (const position of getPossibleSymbolReferencePositions(sourceFile, search.text, container)) {
                    getReferencesAtLocation(sourceFile, position, search, state, addReferencesHere);
                }
            }
            function getReferencesAtLocation(sourceFile, position, search, state, addReferencesHere) {
                const referenceLocation = ts.getTouchingPropertyName(sourceFile, position, /*includeJsDocComment*/ true);
                if (!isValidReferencePosition(referenceLocation, search.text)) {
                    // This wasn't the start of a token.  Check to see if it might be a
                    // match in a comment or string if that's what the caller is asking
                    // for.
                    if (!state.options.implementations && (state.options.findInStrings && ts.isInString(sourceFile, position) || state.options.findInComments && ts.isInNonReferenceComment(sourceFile, position))) {
                        // In the case where we're looking inside comments/strings, we don't have
                        // an actual definition.  So just use 'undefined' here.  Features like
                        // 'Rename' won't care (as they ignore the definitions), and features like
                        // 'FindReferences' will just filter out these results.
                        state.addStringOrCommentReference(sourceFile.fileName, ts.createTextSpan(position, search.text.length));
                    }
                    return;
                }
                if (!(ts.getMeaningFromLocation(referenceLocation) & state.searchMeaning)) {
                    return;
                }
                const referenceSymbol = state.checker.getSymbolAtLocation(referenceLocation);
                if (!referenceSymbol) {
                    return;
                }
                const { parent } = referenceLocation;
                if (ts.isImportSpecifier(parent) && parent.propertyName === referenceLocation) {
                    // This is added through `singleReferences` in ImportsResult. If we happen to see it again, don't add it again.
                    return;
                }
                if (ts.isExportSpecifier(parent)) {
                    ts.Debug.assert(referenceLocation.kind === ts.SyntaxKind.Identifier);
                    getReferencesAtExportSpecifier(referenceLocation, referenceSymbol, parent, search, state, addReferencesHere);
                    return;
                }
                const relatedSymbol = getRelatedSymbol(search, referenceSymbol, referenceLocation, state);
                if (!relatedSymbol) {
                    getReferenceForShorthandProperty(referenceSymbol, search, state);
                    return;
                }
                switch (state.specialSearchKind) {
                    case 0 /* None */:
                        if (addReferencesHere)
                            addReference(referenceLocation, relatedSymbol, state);
                        break;
                    case 1 /* Constructor */:
                        addConstructorReferences(referenceLocation, sourceFile, search, state);
                        break;
                    case 2 /* Class */:
                        addClassStaticThisReferences(referenceLocation, search, state);
                        break;
                    default:
                        ts.Debug.assertNever(state.specialSearchKind);
                }
                getImportOrExportReferences(referenceLocation, referenceSymbol, search, state);
            }
            function getReferencesAtExportSpecifier(referenceLocation, referenceSymbol, exportSpecifier, search, state, addReferencesHere) {
                const { parent, propertyName, name } = exportSpecifier;
                const exportDeclaration = parent.parent;
                const localSymbol = getLocalSymbolForExportSpecifier(referenceLocation, referenceSymbol, exportSpecifier, state.checker);
                if (!search.includes(localSymbol)) {
                    return;
                }
                if (!propertyName) {
                    // Don't rename at `export { default } from "m";`. (but do continue to search for imports of the re-export)
                    if (!(state.options.isForRename && name.escapedText === ts.InternalSymbolName.Default)) {
                        addRef();
                    }
                }
                else if (referenceLocation === propertyName) {
                    // For `export { foo as bar } from "baz"`, "`foo`" will be added from the singleReferences for import searches of the original export.
                    // For `export { foo as bar };`, where `foo` is a local, so add it now.
                    if (!exportDeclaration.moduleSpecifier) {
                        addRef();
                    }
                    if (addReferencesHere && !state.options.isForRename && state.markSeenReExportRHS(name)) {
                        addReference(name, referenceSymbol, state);
                    }
                }
                else {
                    if (state.markSeenReExportRHS(referenceLocation)) {
                        addRef();
                    }
                }
                // For `export { foo as bar }`, rename `foo`, but not `bar`.
                if (!(referenceLocation === propertyName && state.options.isForRename)) {
                    const exportKind = referenceLocation.originalKeywordKind === ts.SyntaxKind.DefaultKeyword ? 1 /* Default */ : 0 /* Named */;
                    const exportInfo = FindAllReferences.getExportInfo(referenceSymbol, exportKind, state.checker);
                    ts.Debug.assert(!!exportInfo);
                    searchForImportsOfExport(referenceLocation, referenceSymbol, exportInfo, state);
                }
                // At `export { x } from "foo"`, also search for the imported symbol `"foo".x`.
                if (search.comingFrom !== 1 /* Export */ && exportDeclaration.moduleSpecifier && !propertyName) {
                    const imported = state.checker.getExportSpecifierLocalTargetSymbol(exportSpecifier);
                    if (imported)
                        searchForImportedSymbol(imported, state);
                }
                function addRef() {
                    if (addReferencesHere)
                        addReference(referenceLocation, localSymbol, state);
                }
            }
            function getLocalSymbolForExportSpecifier(referenceLocation, referenceSymbol, exportSpecifier, checker) {
                return isExportSpecifierAlias(referenceLocation, exportSpecifier) && checker.getExportSpecifierLocalTargetSymbol(exportSpecifier) || referenceSymbol;
            }
            function isExportSpecifierAlias(referenceLocation, exportSpecifier) {
                const { parent, propertyName, name } = exportSpecifier;
                ts.Debug.assert(propertyName === referenceLocation || name === referenceLocation);
                if (propertyName) {
                    // Given `export { foo as bar } [from "someModule"]`: It's an alias at `foo`, but at `bar` it's a new symbol.
                    return propertyName === referenceLocation;
                }
                else {
                    // `export { foo } from "foo"` is a re-export.
                    // `export { foo };` is not a re-export, it creates an alias for the local variable `foo`.
                    return !parent.parent.moduleSpecifier;
                }
            }
            function getImportOrExportReferences(referenceLocation, referenceSymbol, search, state) {
                const importOrExport = FindAllReferences.getImportOrExportSymbol(referenceLocation, referenceSymbol, state.checker, search.comingFrom === 1 /* Export */);
                if (!importOrExport)
                    return;
                const { symbol } = importOrExport;
                if (importOrExport.kind === 0 /* Import */) {
                    if (!state.options.isForRename || importOrExport.isNamedImport) {
                        searchForImportedSymbol(symbol, state);
                    }
                }
                else {
                    // We don't check for `state.isForRename`, even for default exports, because importers that previously matched the export name should be updated to continue matching.
                    searchForImportsOfExport(referenceLocation, symbol, importOrExport.exportInfo, state);
                }
            }
            function getReferenceForShorthandProperty({ flags, valueDeclaration }, search, state) {
                const shorthandValueSymbol = state.checker.getShorthandAssignmentValueSymbol(valueDeclaration);
                /*
                 * Because in short-hand property assignment, an identifier which stored as name of the short-hand property assignment
                 * has two meanings: property name and property value. Therefore when we do findAllReference at the position where
                 * an identifier is declared, the language service should return the position of the variable declaration as well as
                 * the position in short-hand property assignment excluding property accessing. However, if we do findAllReference at the
                 * position of property accessing, the referenceEntry of such position will be handled in the first case.
                 */
                if (!(flags & ts.SymbolFlags.Transient) && search.includes(shorthandValueSymbol)) {
                    addReference(ts.getNameOfDeclaration(valueDeclaration), shorthandValueSymbol, state);
                }
            }
            function addReference(referenceLocation, relatedSymbol, state) {
                const addRef = state.referenceAdder(relatedSymbol);
                if (state.options.implementations) {
                    addImplementationReferences(referenceLocation, addRef, state);
                }
                else {
                    addRef(referenceLocation);
                }
            }
            /** Adds references when a constructor is used with `new this()` in its own class and `super()` calls in subclasses.  */
            function addConstructorReferences(referenceLocation, sourceFile, search, state) {
                if (ts.isNewExpressionTarget(referenceLocation)) {
                    addReference(referenceLocation, search.symbol, state);
                }
                const pusher = () => state.referenceAdder(search.symbol);
                if (ts.isClassLike(referenceLocation.parent)) {
                    ts.Debug.assert(referenceLocation.kind === ts.SyntaxKind.DefaultKeyword || referenceLocation.parent.name === referenceLocation);
                    // This is the class declaration containing the constructor.
                    findOwnConstructorReferences(search.symbol, sourceFile, pusher());
                }
                else {
                    // If this class appears in `extends C`, then the extending class' "super" calls are references.
                    const classExtending = tryGetClassByExtendingIdentifier(referenceLocation);
                    if (classExtending) {
                        findSuperConstructorAccesses(classExtending, pusher());
                    }
                }
            }
            function addClassStaticThisReferences(referenceLocation, search, state) {
                addReference(referenceLocation, search.symbol, state);
                const classLike = referenceLocation.parent;
                if (state.options.isForRename || !ts.isClassLike(classLike))
                    return;
                ts.Debug.assert(classLike.name === referenceLocation);
                const addRef = state.referenceAdder(search.symbol);
                for (const member of classLike.members) {
                    if (!(ts.isMethodOrAccessor(member) && ts.hasModifier(member, ts.ModifierFlags.Static))) {
                        continue;
                    }
                    member.body.forEachChild(function cb(node) {
                        if (node.kind === ts.SyntaxKind.ThisKeyword) {
                            addRef(node);
                        }
                        else if (!ts.isFunctionLike(node)) {
                            node.forEachChild(cb);
                        }
                    });
                }
            }
            /**
             * `classSymbol` is the class where the constructor was defined.
             * Reference the constructor and all calls to `new this()`.
             */
            function findOwnConstructorReferences(classSymbol, sourceFile, addNode) {
                for (const decl of classSymbol.members.get(ts.InternalSymbolName.Constructor).declarations) {
                    const ctrKeyword = ts.findChildOfKind(decl, ts.SyntaxKind.ConstructorKeyword, sourceFile);
                    ts.Debug.assert(decl.kind === ts.SyntaxKind.Constructor && !!ctrKeyword);
                    addNode(ctrKeyword);
                }
                classSymbol.exports.forEach(member => {
                    const decl = member.valueDeclaration;
                    if (decl && decl.kind === ts.SyntaxKind.MethodDeclaration) {
                        const body = decl.body;
                        if (body) {
                            forEachDescendantOfKind(body, ts.SyntaxKind.ThisKeyword, thisKeyword => {
                                if (ts.isNewExpressionTarget(thisKeyword)) {
                                    addNode(thisKeyword);
                                }
                            });
                        }
                    }
                });
            }
            /** Find references to `super` in the constructor of an extending class.  */
            function findSuperConstructorAccesses(cls, addNode) {
                const symbol = cls.symbol;
                const ctr = symbol.members.get(ts.InternalSymbolName.Constructor);
                if (!ctr) {
                    return;
                }
                for (const decl of ctr.declarations) {
                    ts.Debug.assert(decl.kind === ts.SyntaxKind.Constructor);
                    const body = decl.body;
                    if (body) {
                        forEachDescendantOfKind(body, ts.SyntaxKind.SuperKeyword, node => {
                            if (ts.isCallExpressionTarget(node)) {
                                addNode(node);
                            }
                        });
                    }
                }
            }
            function addImplementationReferences(refNode, addReference, state) {
                // Check if we found a function/propertyAssignment/method with an implementation or initializer
                if (ts.isDeclarationName(refNode) && isImplementation(refNode.parent)) {
                    addReference(refNode.parent);
                    return;
                }
                if (refNode.kind !== ts.SyntaxKind.Identifier) {
                    return;
                }
                if (refNode.parent.kind === ts.SyntaxKind.ShorthandPropertyAssignment) {
                    // Go ahead and dereference the shorthand assignment by going to its definition
                    getReferenceEntriesForShorthandPropertyAssignment(refNode, state.checker, addReference);
                }
                // Check if the node is within an extends or implements clause
                const containingClass = getContainingClassIfInHeritageClause(refNode);
                if (containingClass) {
                    addReference(containingClass);
                    return;
                }
                // If we got a type reference, try and see if the reference applies to any expressions that can implement an interface
                // Find the first node whose parent isn't a type node -- i.e., the highest type node.
                const typeNode = ts.findAncestor(refNode, a => !ts.isQualifiedName(a.parent) && !ts.isTypeNode(a.parent) && !ts.isTypeElement(a.parent));
                const typeHavingNode = typeNode.parent;
                if (ts.hasType(typeHavingNode) && typeHavingNode.type === typeNode && state.markSeenContainingTypeReference(typeHavingNode)) {
                    if (ts.hasInitializer(typeHavingNode)) {
                        addIfImplementation(typeHavingNode.initializer);
                    }
                    else if (ts.isFunctionLike(typeHavingNode) && typeHavingNode.body) {
                        const body = typeHavingNode.body;
                        if (body.kind === ts.SyntaxKind.Block) {
                            ts.forEachReturnStatement(body, returnStatement => {
                                if (returnStatement.expression)
                                    addIfImplementation(returnStatement.expression);
                            });
                        }
                        else {
                            addIfImplementation(body);
                        }
                    }
                    else if (ts.isAssertionExpression(typeHavingNode)) {
                        addIfImplementation(typeHavingNode.expression);
                    }
                }
                function addIfImplementation(e) {
                    if (isImplementationExpression(e))
                        addReference(e);
                }
            }
            function getContainingClassIfInHeritageClause(node) {
                return ts.isIdentifier(node) || ts.isPropertyAccessExpression(node) ? getContainingClassIfInHeritageClause(node.parent)
                    : ts.isExpressionWithTypeArguments(node) ? ts.tryCast(node.parent.parent, ts.isClassLike) : undefined;
            }
            /**
             * Returns true if this is an expression that can be considered an implementation
             */
            function isImplementationExpression(node) {
                switch (node.kind) {
                    case ts.SyntaxKind.ParenthesizedExpression:
                        return isImplementationExpression(node.expression);
                    case ts.SyntaxKind.ArrowFunction:
                    case ts.SyntaxKind.FunctionExpression:
                    case ts.SyntaxKind.ObjectLiteralExpression:
                    case ts.SyntaxKind.ClassExpression:
                    case ts.SyntaxKind.ArrayLiteralExpression:
                        return true;
                    default:
                        return false;
                }
            }
            /**
             * Determines if the parent symbol occurs somewhere in the child's ancestry. If the parent symbol
             * is an interface, determines if some ancestor of the child symbol extends or inherits from it.
             * Also takes in a cache of previous results which makes this slightly more efficient and is
             * necessary to avoid potential loops like so:
             *     class A extends B { }
             *     class B extends A { }
             *
             * We traverse the AST rather than using the type checker because users are typically only interested
             * in explicit implementations of an interface/class when calling "Go to Implementation". Sibling
             * implementations of types that share a common ancestor with the type whose implementation we are
             * searching for need to be filtered out of the results. The type checker doesn't let us make the
             * distinction between structurally compatible implementations and explicit implementations, so we
             * must use the AST.
             *
             * @param symbol         A class or interface Symbol
             * @param parent        Another class or interface Symbol
             * @param cachedResults A map of symbol id pairs (i.e. "child,parent") to booleans indicating previous results
             */
            function explicitlyInheritsFrom(symbol, parent, cachedResults, checker) {
                if (symbol === parent) {
                    return true;
                }
                const key = ts.getSymbolId(symbol) + "," + ts.getSymbolId(parent);
                const cached = cachedResults.get(key);
                if (cached !== undefined) {
                    return cached;
                }
                // Set the key so that we don't infinitely recurse
                cachedResults.set(key, false);
                const inherits = symbol.declarations.some(declaration => ts.getAllSuperTypeNodes(declaration).some(typeReference => {
                    const type = checker.getTypeAtLocation(typeReference);
                    return !!type && !!type.symbol && explicitlyInheritsFrom(type.symbol, parent, cachedResults, checker);
                }));
                cachedResults.set(key, inherits);
                return inherits;
            }
            function getReferencesForSuperKeyword(superKeyword) {
                let searchSpaceNode = ts.getSuperContainer(superKeyword, /*stopOnFunctions*/ false);
                if (!searchSpaceNode) {
                    return undefined;
                }
                // Whether 'super' occurs in a static context within a class.
                let staticFlag = ts.ModifierFlags.Static;
                switch (searchSpaceNode.kind) {
                    case ts.SyntaxKind.PropertyDeclaration:
                    case ts.SyntaxKind.PropertySignature:
                    case ts.SyntaxKind.MethodDeclaration:
                    case ts.SyntaxKind.MethodSignature:
                    case ts.SyntaxKind.Constructor:
                    case ts.SyntaxKind.GetAccessor:
                    case ts.SyntaxKind.SetAccessor:
                        staticFlag &= ts.getModifierFlags(searchSpaceNode);
                        searchSpaceNode = searchSpaceNode.parent; // re-assign to be the owning class
                        break;
                    default:
                        return undefined;
                }
                const sourceFile = searchSpaceNode.getSourceFile();
                const references = ts.mapDefined(getPossibleSymbolReferenceNodes(sourceFile, "super", searchSpaceNode), node => {
                    if (node.kind !== ts.SyntaxKind.SuperKeyword) {
                        return;
                    }
                    const container = ts.getSuperContainer(node, /*stopOnFunctions*/ false);
                    // If we have a 'super' container, we must have an enclosing class.
                    // Now make sure the owning class is the same as the search-space
                    // and has the same static qualifier as the original 'super's owner.
                    return container && (ts.ModifierFlags.Static & ts.getModifierFlags(container)) === staticFlag && container.parent.symbol === searchSpaceNode.symbol ? FindAllReferences.nodeEntry(node) : undefined;
                });
                return [{ definition: { type: "symbol", symbol: searchSpaceNode.symbol }, references }];
            }
            function getReferencesForThisKeyword(thisOrSuperKeyword, sourceFiles, cancellationToken) {
                let searchSpaceNode = ts.getThisContainer(thisOrSuperKeyword, /* includeArrowFunctions */ false);
                // Whether 'this' occurs in a static context within a class.
                let staticFlag = ts.ModifierFlags.Static;
                switch (searchSpaceNode.kind) {
                    case ts.SyntaxKind.MethodDeclaration:
                    case ts.SyntaxKind.MethodSignature:
                        if (ts.isObjectLiteralMethod(searchSpaceNode)) {
                            break;
                        }
                    // falls through
                    case ts.SyntaxKind.PropertyDeclaration:
                    case ts.SyntaxKind.PropertySignature:
                    case ts.SyntaxKind.Constructor:
                    case ts.SyntaxKind.GetAccessor:
                    case ts.SyntaxKind.SetAccessor:
                        staticFlag &= ts.getModifierFlags(searchSpaceNode);
                        searchSpaceNode = searchSpaceNode.parent; // re-assign to be the owning class
                        break;
                    case ts.SyntaxKind.SourceFile:
                        if (ts.isExternalModule(searchSpaceNode)) {
                            return undefined;
                        }
                    // falls through
                    case ts.SyntaxKind.FunctionDeclaration:
                    case ts.SyntaxKind.FunctionExpression:
                        break;
                    // Computed properties in classes are not handled here because references to this are illegal,
                    // so there is no point finding references to them.
                    default:
                        return undefined;
                }
                const references = ts.flatMap(searchSpaceNode.kind === ts.SyntaxKind.SourceFile ? sourceFiles : [searchSpaceNode.getSourceFile()], sourceFile => {
                    cancellationToken.throwIfCancellationRequested();
                    return getPossibleSymbolReferenceNodes(sourceFile, "this", ts.isSourceFile(searchSpaceNode) ? sourceFile : searchSpaceNode).filter(node => {
                        if (!ts.isThis(node)) {
                            return false;
                        }
                        const container = ts.getThisContainer(node, /* includeArrowFunctions */ false);
                        switch (searchSpaceNode.kind) {
                            case ts.SyntaxKind.FunctionExpression:
                            case ts.SyntaxKind.FunctionDeclaration:
                                return searchSpaceNode.symbol === container.symbol;
                            case ts.SyntaxKind.MethodDeclaration:
                            case ts.SyntaxKind.MethodSignature:
                                return ts.isObjectLiteralMethod(searchSpaceNode) && searchSpaceNode.symbol === container.symbol;
                            case ts.SyntaxKind.ClassExpression:
                            case ts.SyntaxKind.ClassDeclaration:
                                // Make sure the container belongs to the same class
                                // and has the appropriate static modifier from the original container.
                                return container.parent && searchSpaceNode.symbol === container.parent.symbol && (ts.getModifierFlags(container) & ts.ModifierFlags.Static) === staticFlag;
                            case ts.SyntaxKind.SourceFile:
                                return container.kind === ts.SyntaxKind.SourceFile && !ts.isExternalModule(container);
                        }
                    });
                }).map(n => FindAllReferences.nodeEntry(n));
                return [{
                        definition: { type: "this", node: thisOrSuperKeyword },
                        references
                    }];
            }
            function getReferencesForStringLiteral(node, sourceFiles, cancellationToken) {
                const references = ts.flatMap(sourceFiles, sourceFile => {
                    cancellationToken.throwIfCancellationRequested();
                    return ts.mapDefined(getPossibleSymbolReferenceNodes(sourceFile, node.text), ref => ts.isStringLiteral(ref) && ref.text === node.text ? FindAllReferences.nodeEntry(ref, /*isInString*/ true) : undefined);
                });
                return [{
                        definition: { type: "string", node },
                        references
                    }];
            }
            // For certain symbol kinds, we need to include other symbols in the search set.
            // This is not needed when searching for re-exports.
            function populateSearchSymbolSet(symbol, location, checker, implementations) {
                const result = [];
                forEachRelatedSymbol(symbol, location, checker, (sym, root, base) => { result.push(base || root || sym); }, 
                /*allowBaseTypes*/ () => !implementations);
                return result;
            }
            function forEachRelatedSymbol(symbol, location, checker, cbSymbol, allowBaseTypes) {
                const containingObjectLiteralElement = ts.getContainingObjectLiteralElement(location);
                if (containingObjectLiteralElement) {
                    // If the location is in a context sensitive location (i.e. in an object literal) try
                    // to get a contextual type for it, and add the property symbol from the contextual
                    // type to the search set
                    const res = ts.firstDefined(getPropertySymbolsFromContextualType(containingObjectLiteralElement, checker), fromRoot);
                    if (res)
                        return res;
                    // If the location is name of property symbol from object literal destructuring pattern
                    // Search the property symbol
                    //      for ( { property: p2 } of elems) { }
                    const propertySymbol = getPropertySymbolOfDestructuringAssignment(location, checker);
                    const res1 = propertySymbol && cbSymbol(propertySymbol);
                    if (res1)
                        return res1;
                    /* Because in short-hand property assignment, location has two meaning : property name and as value of the property
                     * When we do findAllReference at the position of the short-hand property assignment, we would want to have references to position of
                     * property name and variable declaration of the identifier.
                     * Like in below example, when querying for all references for an identifier 'name', of the property assignment, the language service
                     * should show both 'name' in 'obj' and 'name' in variable declaration
                     *      const name = "Foo";
                     *      const obj = { name };
                     * In order to do that, we will populate the search set with the value symbol of the identifier as a value of the property assignment
                     * so that when matching with potential reference symbol, both symbols from property declaration and variable declaration
                     * will be included correctly.
                     */
                    const shorthandValueSymbol = checker.getShorthandAssignmentValueSymbol(location.parent);
                    const res2 = shorthandValueSymbol && cbSymbol(shorthandValueSymbol);
                    if (res2)
                        return res2;
                }
                const res = fromRoot(symbol);
                if (res)
                    return res;
                if (symbol.valueDeclaration && ts.isParameterPropertyDeclaration(symbol.valueDeclaration)) {
                    // For a parameter property, now try on the other symbol (property if this was a parameter, parameter if this was a property).
                    const paramProps = checker.getSymbolsOfParameterPropertyDeclaration(ts.cast(symbol.valueDeclaration, ts.isParameter), symbol.name);
                    ts.Debug.assert(paramProps.length === 2 && !!(paramProps[0].flags & ts.SymbolFlags.FunctionScopedVariable) && !!(paramProps[1].flags & ts.SymbolFlags.Property)); // is [parameter, property]
                    return fromRoot(symbol.flags & ts.SymbolFlags.FunctionScopedVariable ? paramProps[1] : paramProps[0]);
                }
                // If this is symbol of binding element without propertyName declaration in Object binding pattern
                // Include the property in the search
                const bindingElementPropertySymbol = getPropertySymbolOfObjectBindingPatternWithoutPropertyName(symbol, checker);
                return bindingElementPropertySymbol && fromRoot(bindingElementPropertySymbol);
                function fromRoot(sym) {
                    // If this is a union property:
                    //   - In populateSearchSymbolsSet we will add all the symbols from all its source symbols in all unioned types.
                    //   - In findRelatedSymbol, we will just use the union symbol if any source symbol is included in the search.
                    // If the symbol is an instantiation from a another symbol (e.g. widened symbol):
                    //   - In populateSearchSymbolsSet, add the root the list
                    //   - In findRelatedSymbol, return the source symbol if that is in the search. (Do not return the instantiation symbol.)
                    return ts.firstDefined(checker.getRootSymbols(sym), rootSymbol => cbSymbol(sym, rootSymbol)
                        // Add symbol of properties/methods of the same name in base classes and implemented interfaces definitions
                        || (rootSymbol.parent && rootSymbol.parent.flags & (ts.SymbolFlags.Class | ts.SymbolFlags.Interface) && allowBaseTypes(rootSymbol)
                            ? getPropertySymbolsFromBaseTypes(rootSymbol.parent, rootSymbol.name, checker, base => cbSymbol(sym, rootSymbol, base))
                            : undefined));
                }
            }
            /**
             * Find symbol of the given property-name and add the symbol to the given result array
             * @param symbol a symbol to start searching for the given propertyName
             * @param propertyName a name of property to search for
             * @param result an array of symbol of found property symbols
             * @param previousIterationSymbolsCache a cache of symbol from previous iterations of calling this function to prevent infinite revisiting of the same symbol.
             *                                The value of previousIterationSymbol is undefined when the function is first called.
             */
            function getPropertySymbolsFromBaseTypes(symbol, propertyName, checker, cb) {
                const seen = ts.createMap();
                return recur(symbol);
                function recur(symbol) {
                    // Use `addToSeen` to ensure we don't infinitely recurse in this situation:
                    //      interface C extends C {
                    //          /*findRef*/propName: string;
                    //      }
                    if (!(symbol.flags & (ts.SymbolFlags.Class | ts.SymbolFlags.Interface)) || !ts.addToSeen(seen, ts.getSymbolId(symbol)))
                        return;
                    return ts.firstDefined(symbol.declarations, declaration => ts.firstDefined(ts.getAllSuperTypeNodes(declaration), typeReference => {
                        const type = checker.getTypeAtLocation(typeReference);
                        const propertySymbol = type && type.symbol && checker.getPropertyOfType(type, propertyName);
                        // Visit the typeReference as well to see if it directly or indirectly uses that property
                        return propertySymbol && (ts.firstDefined(checker.getRootSymbols(propertySymbol), cb) || recur(type.symbol));
                    }));
                }
            }
            function getRelatedSymbol(search, referenceSymbol, referenceLocation, state) {
                const { checker } = state;
                return forEachRelatedSymbol(referenceSymbol, referenceLocation, checker, (sym, rootSymbol, baseSymbol) => search.includes(baseSymbol || rootSymbol || sym)
                    // For a base type, use the symbol for the derived type. For a synthetic (e.g. union) property, use the union symbol.
                    ? rootSymbol && !(ts.getCheckFlags(sym) & 6 /* Synthetic */) ? rootSymbol : sym
                    : undefined, 
                /*allowBaseTypes*/ rootSymbol => !(search.parents && !search.parents.some(parent => explicitlyInheritsFrom(rootSymbol.parent, parent, state.inheritsFromCache, checker))));
            }
            /** Gets all symbols for one property. Does not get symbols for every property. */
            function getPropertySymbolsFromContextualType(node, checker) {
                const contextualType = checker.getContextualType(node.parent);
                const name = ts.getNameFromPropertyName(node.name);
                const symbol = contextualType && name && contextualType.getProperty(name);
                return symbol ? [symbol] :
                    contextualType && contextualType.isUnion() ? ts.mapDefined(contextualType.types, t => t.getProperty(name)) : ts.emptyArray;
            }
            /**
             * Given an initial searchMeaning, extracted from a location, widen the search scope based on the declarations
             * of the corresponding symbol. e.g. if we are searching for "Foo" in value position, but "Foo" references a class
             * then we need to widen the search to include type positions as well.
             * On the contrary, if we are searching for "Bar" in type position and we trace bar to an interface, and an uninstantiated
             * module, we want to keep the search limited to only types, as the two declarations (interface and uninstantiated module)
             * do not intersect in any of the three spaces.
             */
            function getIntersectingMeaningFromDeclarations(node, symbol) {
                let meaning = ts.getMeaningFromLocation(node);
                const { declarations } = symbol;
                if (declarations) {
                    let lastIterationMeaning;
                    do {
                        // The result is order-sensitive, for instance if initialMeaning === Namespace, and declarations = [class, instantiated module]
                        // we need to consider both as they initialMeaning intersects with the module in the namespace space, and the module
                        // intersects with the class in the value space.
                        // To achieve that we will keep iterating until the result stabilizes.
                        // Remember the last meaning
                        lastIterationMeaning = meaning;
                        for (const declaration of declarations) {
                            const declarationMeaning = ts.getMeaningFromDeclaration(declaration);
                            if (declarationMeaning & meaning) {
                                meaning |= declarationMeaning;
                            }
                        }
                    } while (meaning !== lastIterationMeaning);
                }
                return meaning;
            }
            Core.getIntersectingMeaningFromDeclarations = getIntersectingMeaningFromDeclarations;
            function isImplementation(node) {
                return !!(node.flags & ts.NodeFlags.Ambient)
                    || (ts.isVariableLike(node) ? ts.hasInitializer(node)
                        : ts.isFunctionLikeDeclaration(node) ? !!node.body
                            : ts.isClassLike(node) || ts.isModuleOrEnumDeclaration(node));
            }
            function getReferenceEntriesForShorthandPropertyAssignment(node, checker, addReference) {
                const refSymbol = checker.getSymbolAtLocation(node);
                const shorthandSymbol = checker.getShorthandAssignmentValueSymbol(refSymbol.valueDeclaration);
                if (shorthandSymbol) {
                    for (const declaration of shorthandSymbol.getDeclarations()) {
                        if (ts.getMeaningFromDeclaration(declaration) & 1 /* Value */) {
                            addReference(declaration);
                        }
                    }
                }
            }
            Core.getReferenceEntriesForShorthandPropertyAssignment = getReferenceEntriesForShorthandPropertyAssignment;
            function forEachDescendantOfKind(node, kind, action) {
                ts.forEachChild(node, child => {
                    if (child.kind === kind) {
                        action(child);
                    }
                    forEachDescendantOfKind(child, kind, action);
                });
            }
            /** Get `C` given `N` if `N` is in the position `class C extends N` or `class C extends foo.N` where `N` is an identifier. */
            function tryGetClassByExtendingIdentifier(node) {
                return ts.tryGetClassExtendingExpressionWithTypeArguments(ts.climbPastPropertyAccess(node).parent);
            }
            /**
             * If we are just looking for implementations and this is a property access expression, we need to get the
             * symbol of the local type of the symbol the property is being accessed on. This is because our search
             * symbol may have a different parent symbol if the local type's symbol does not declare the property
             * being accessed (i.e. it is declared in some parent class or interface)
             */
            function getParentSymbolsOfPropertyAccess(location, symbol, checker) {
                const propertyAccessExpression = ts.isRightSideOfPropertyAccess(location) ? location.parent : undefined;
                const lhsType = propertyAccessExpression && checker.getTypeAtLocation(propertyAccessExpression.expression);
                const res = ts.mapDefined(lhsType && (lhsType.isUnionOrIntersection() ? lhsType.types : lhsType.symbol === symbol.parent ? undefined : [lhsType]), t => t.symbol && t.symbol.flags & (ts.SymbolFlags.Class | ts.SymbolFlags.Interface) ? t.symbol : undefined);
                return res.length === 0 ? undefined : res;
            }
        })(Core = FindAllReferences.Core || (FindAllReferences.Core = {}));
    })(FindAllReferences = ts.FindAllReferences || (ts.FindAllReferences = {}));
})(ts || (ts = {}));
