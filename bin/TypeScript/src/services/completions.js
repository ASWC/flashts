/* @internal */
var ts;
(function (ts) {
    var Completions;
    (function (Completions) {
        function getCompletionsAtPosition(host, program, log, sourceFile, position, preferences, triggerCharacter) {
            const typeChecker = program.getTypeChecker();
            const compilerOptions = program.getCompilerOptions();
            if (ts.isInReferenceComment(sourceFile, position)) {
                const entries = Completions.PathCompletions.getTripleSlashReferenceCompletion(sourceFile, position, compilerOptions, host);
                return entries && convertPathCompletions(entries);
            }
            const contextToken = ts.findPrecedingToken(position, sourceFile);
            if (triggerCharacter && !isValidTrigger(sourceFile, triggerCharacter, contextToken, position))
                return undefined;
            if (ts.isInString(sourceFile, position, contextToken)) {
                return !contextToken || !ts.isStringLiteralLike(contextToken)
                    ? undefined
                    : convertStringLiteralCompletions(getStringLiteralCompletionEntries(sourceFile, contextToken, position, typeChecker, compilerOptions, host), sourceFile, typeChecker, log, preferences);
            }
            if (contextToken && ts.isBreakOrContinueStatement(contextToken.parent)
                && (contextToken.kind === ts.SyntaxKind.BreakKeyword || contextToken.kind === ts.SyntaxKind.ContinueKeyword || contextToken.kind === ts.SyntaxKind.Identifier)) {
                return getLabelCompletionAtPosition(contextToken.parent);
            }
            const completionData = getCompletionData(program, log, sourceFile, position, preferences, /*detailsEntryId*/ undefined);
            if (!completionData) {
                return undefined;
            }
            switch (completionData.kind) {
                case 0 /* Data */:
                    return completionInfoFromData(sourceFile, typeChecker, compilerOptions, log, completionData, preferences);
                case 1 /* JsDocTagName */:
                    // If the current position is a jsDoc tag name, only tag names should be provided for completion
                    return jsdocCompletionInfo(ts.JsDoc.getJSDocTagNameCompletions());
                case 2 /* JsDocTag */:
                    // If the current position is a jsDoc tag, only tags should be provided for completion
                    return jsdocCompletionInfo(ts.JsDoc.getJSDocTagCompletions());
                case 3 /* JsDocParameterName */:
                    return jsdocCompletionInfo(ts.JsDoc.getJSDocParameterNameCompletions(completionData.tag));
                default:
                    return ts.Debug.assertNever(completionData);
            }
        }
        Completions.getCompletionsAtPosition = getCompletionsAtPosition;
        function convertStringLiteralCompletions(completion, sourceFile, checker, log, preferences) {
            if (completion === undefined) {
                return undefined;
            }
            switch (completion.kind) {
                case 0 /* Paths */:
                    return convertPathCompletions(completion.paths);
                case 1 /* Properties */: {
                    const entries = [];
                    getCompletionEntriesFromSymbols(completion.symbols, entries, sourceFile, sourceFile, checker, ts.ScriptTarget.ESNext, log, 4 /* String */, preferences); // Target will not be used, so arbitrary
                    return { isGlobalCompletion: false, isMemberCompletion: true, isNewIdentifierLocation: completion.hasIndexSignature, entries };
                }
                case 2 /* Types */: {
                    const entries = completion.types.map(type => ({ name: type.value, kindModifiers: ts.ScriptElementKindModifier.none, kind: ts.ScriptElementKind.typeElement, sortText: "0" }));
                    return { isGlobalCompletion: false, isMemberCompletion: false, isNewIdentifierLocation: completion.isNewIdentifier, entries };
                }
                default:
                    return ts.Debug.assertNever(completion);
            }
        }
        function convertPathCompletions(pathCompletions) {
            const isGlobalCompletion = false; // We don't want the editor to offer any other completions, such as snippets, inside a comment.
            const isNewIdentifierLocation = true; // The user may type in a path that doesn't yet exist, creating a "new identifier" with respect to the collection of identifiers the server is aware of.
            const entries = pathCompletions.map(({ name, kind, span }) => ({ name, kind, kindModifiers: ts.ScriptElementKindModifier.none, sortText: "0", replacementSpan: span }));
            return { isGlobalCompletion, isMemberCompletion: false, isNewIdentifierLocation, entries };
        }
        function jsdocCompletionInfo(entries) {
            return { isGlobalCompletion: false, isMemberCompletion: false, isNewIdentifierLocation: false, entries };
        }
        function completionInfoFromData(sourceFile, typeChecker, compilerOptions, log, completionData, preferences) {
            const { symbols, completionKind, isInSnippetScope, isNewIdentifierLocation, location, propertyAccessToConvert, keywordFilters, symbolToOriginInfoMap, recommendedCompletion, isJsxInitializer } = completionData;
            if (sourceFile.languageVariant === ts.LanguageVariant.JSX && location && location.parent && ts.isJsxClosingElement(location.parent)) {
                // In the TypeScript JSX element, if such element is not defined. When users query for completion at closing tag,
                // instead of simply giving unknown value, the completion will return the tag-name of an associated opening-element.
                // For example:
                //     var x = <div> </ /*1*/>
                // The completion list at "1" will contain "div" with type any
                const tagName = location.parent.parent.openingElement.tagName;
                return { isGlobalCompletion: false, isMemberCompletion: true, isNewIdentifierLocation: false,
                    entries: [{
                            name: tagName.getFullText(),
                            kind: ts.ScriptElementKind.classElement,
                            kindModifiers: undefined,
                            sortText: "0",
                        }] };
            }
            const entries = [];
            if (ts.isSourceFileJavaScript(sourceFile)) {
                const uniqueNames = getCompletionEntriesFromSymbols(symbols, entries, location, sourceFile, typeChecker, compilerOptions.target, log, completionKind, preferences, propertyAccessToConvert, isJsxInitializer, recommendedCompletion, symbolToOriginInfoMap);
                getJavaScriptCompletionEntries(sourceFile, location.pos, uniqueNames, compilerOptions.target, entries);
            }
            else {
                if ((!symbols || symbols.length === 0) && keywordFilters === 0 /* None */) {
                    return undefined;
                }
                getCompletionEntriesFromSymbols(symbols, entries, location, sourceFile, typeChecker, compilerOptions.target, log, completionKind, preferences, propertyAccessToConvert, isJsxInitializer, recommendedCompletion, symbolToOriginInfoMap);
            }
            // TODO add filter for keyword based on type/value/namespace and also location
            // Add all keywords if
            // - this is not a member completion list (all the keywords)
            // - other filters are enabled in required scenario so add those keywords
            const isMemberCompletion = isMemberCompletionKind(completionKind);
            if (keywordFilters !== 0 /* None */ || !isMemberCompletion) {
                ts.addRange(entries, getKeywordCompletions(keywordFilters));
            }
            return { isGlobalCompletion: isInSnippetScope, isMemberCompletion, isNewIdentifierLocation, entries };
        }
        function isMemberCompletionKind(kind) {
            switch (kind) {
                case 0 /* ObjectPropertyDeclaration */:
                case 3 /* MemberLike */:
                case 2 /* PropertyAccess */:
                    return true;
                default:
                    return false;
            }
        }
        function getJavaScriptCompletionEntries(sourceFile, position, uniqueNames, target, entries) {
            ts.getNameTable(sourceFile).forEach((pos, name) => {
                // Skip identifiers produced only from the current location
                if (pos === position) {
                    return;
                }
                const realName = ts.unescapeLeadingUnderscores(name);
                if (ts.addToSeen(uniqueNames, realName) && ts.isIdentifierText(realName, target) && !ts.isStringANonContextualKeyword(realName)) {
                    entries.push({
                        name: realName,
                        kind: ts.ScriptElementKind.warning,
                        kindModifiers: "",
                        sortText: "1"
                    });
                }
            });
        }
        function createCompletionEntry(symbol, location, sourceFile, typeChecker, target, kind, origin, recommendedCompletion, propertyAccessToConvert, isJsxInitializer, preferences) {
            const info = getCompletionEntryDisplayNameForSymbol(symbol, target, origin, kind);
            if (!info) {
                return undefined;
            }
            const { name, needsConvertPropertyAccess } = info;
            let insertText;
            let replacementSpan;
            if (origin && origin.type === "this-type") {
                insertText = needsConvertPropertyAccess ? `this[${quote(name, preferences)}]` : `this.${name}`;
            }
            // We should only have needsConvertPropertyAccess if there's a property access to convert. But see #21790.
            // Somehow there was a global with a non-identifier name. Hopefully someone will complain about getting a "foo bar" global completion and provide a repro.
            else if ((origin && origin.type === "symbol-member" || needsConvertPropertyAccess) && propertyAccessToConvert) {
                insertText = needsConvertPropertyAccess ? `[${quote(name, preferences)}]` : `[${name}]`;
                const dot = ts.findChildOfKind(propertyAccessToConvert, ts.SyntaxKind.DotToken, sourceFile);
                // If the text after the '.' starts with this name, write over it. Else, add new text.
                const end = ts.startsWith(name, propertyAccessToConvert.name.text) ? propertyAccessToConvert.name.end : dot.end;
                replacementSpan = ts.createTextSpanFromBounds(dot.getStart(sourceFile), end);
            }
            if (isJsxInitializer) {
                if (insertText === undefined)
                    insertText = name;
                insertText = `{${insertText}}`;
                if (typeof isJsxInitializer !== "boolean") {
                    replacementSpan = ts.createTextSpanFromNode(isJsxInitializer, sourceFile);
                }
            }
            if (insertText !== undefined && !preferences.includeCompletionsWithInsertText) {
                return undefined;
            }
            // TODO(drosen): Right now we just permit *all* semantic meanings when calling
            // 'getSymbolKind' which is permissible given that it is backwards compatible; but
            // really we should consider passing the meaning for the node so that we don't report
            // that a suggestion for a value is an interface.  We COULD also just do what
            // 'getSymbolModifiers' does, which is to use the first declaration.
            // Use a 'sortText' of 0' so that all symbol completion entries come before any other
            // entries (like JavaScript identifier entries).
            return {
                name,
                kind: ts.SymbolDisplay.getSymbolKind(typeChecker, symbol, location),
                kindModifiers: ts.SymbolDisplay.getSymbolModifiers(symbol),
                sortText: "0",
                source: getSourceFromOrigin(origin),
                hasAction: trueOrUndefined(!!origin && origin.type === "export"),
                isRecommended: trueOrUndefined(isRecommendedCompletionMatch(symbol, recommendedCompletion, typeChecker)),
                insertText,
                replacementSpan,
            };
        }
        function quote(text, preferences) {
            const quoted = JSON.stringify(text);
            switch (preferences.quotePreference) {
                case undefined:
                case "double":
                    return quoted;
                case "single":
                    return `'${ts.stripQuotes(quoted).replace("'", "\\'").replace('\\"', '"')}'`;
                default:
                    return ts.Debug.assertNever(preferences.quotePreference);
            }
        }
        function isRecommendedCompletionMatch(localSymbol, recommendedCompletion, checker) {
            return localSymbol === recommendedCompletion ||
                !!(localSymbol.flags & ts.SymbolFlags.ExportValue) && checker.getExportSymbolOfSymbol(localSymbol) === recommendedCompletion;
        }
        function trueOrUndefined(b) {
            return b ? true : undefined;
        }
        function getSourceFromOrigin(origin) {
            return origin && origin.type === "export" ? ts.stripQuotes(origin.moduleSymbol.name) : undefined;
        }
        function getCompletionEntriesFromSymbols(symbols, entries, location, sourceFile, typeChecker, target, log, kind, preferences, propertyAccessToConvert, isJsxInitializer, recommendedCompletion, symbolToOriginInfoMap) {
            const start = ts.timestamp();
            // Tracks unique names.
            // We don't set this for global variables or completions from external module exports, because we can have multiple of those.
            // Based on the order we add things we will always see locals first, then globals, then module exports.
            // So adding a completion for a local will prevent us from adding completions for external module exports sharing the same name.
            const uniques = ts.createMap();
            for (const symbol of symbols) {
                const origin = symbolToOriginInfoMap ? symbolToOriginInfoMap[ts.getSymbolId(symbol)] : undefined;
                const entry = createCompletionEntry(symbol, location, sourceFile, typeChecker, target, kind, origin, recommendedCompletion, propertyAccessToConvert, isJsxInitializer, preferences);
                if (!entry) {
                    continue;
                }
                const { name } = entry;
                if (uniques.has(name)) {
                    continue;
                }
                // Latter case tests whether this is a global variable.
                if (!origin && !(symbol.parent === undefined && !ts.some(symbol.declarations, d => d.getSourceFile() === location.getSourceFile()))) {
                    uniques.set(name, true);
                }
                entries.push(entry);
            }
            log("getCompletionsAtPosition: getCompletionEntriesFromSymbols: " + (ts.timestamp() - start));
            return uniques;
        }
        function getLabelCompletionAtPosition(node) {
            const entries = getLabelStatementCompletions(node);
            if (entries.length) {
                return { isGlobalCompletion: false, isMemberCompletion: false, isNewIdentifierLocation: false, entries };
            }
        }
        function getLabelStatementCompletions(node) {
            const entries = [];
            const uniques = ts.createMap();
            let current = node;
            while (current) {
                if (ts.isFunctionLike(current)) {
                    break;
                }
                if (ts.isLabeledStatement(current)) {
                    const name = current.label.text;
                    if (!uniques.has(name)) {
                        uniques.set(name, true);
                        entries.push({
                            name,
                            kindModifiers: ts.ScriptElementKindModifier.none,
                            kind: ts.ScriptElementKind.label,
                            sortText: "0"
                        });
                    }
                }
                current = current.parent;
            }
            return entries;
        }
        function getStringLiteralCompletionEntries(sourceFile, node, position, typeChecker, compilerOptions, host) {
            switch (node.parent.kind) {
                case ts.SyntaxKind.LiteralType:
                    switch (node.parent.parent.kind) {
                        case ts.SyntaxKind.TypeReference:
                            return { kind: 2 /* Types */, types: getStringLiteralTypes(typeChecker.getTypeArgumentConstraint(node.parent), typeChecker), isNewIdentifier: false };
                        case ts.SyntaxKind.IndexedAccessType:
                            // Get all apparent property names
                            // i.e. interface Foo {
                            //          foo: string;
                            //          bar: string;
                            //      }
                            //      let x: Foo["/*completion position*/"]
                            return stringLiteralCompletionsFromProperties(typeChecker.getTypeFromTypeNode(node.parent.parent.objectType));
                        case ts.SyntaxKind.ImportType:
                            return { kind: 0 /* Paths */, paths: Completions.PathCompletions.getStringLiteralCompletionsFromModuleNames(sourceFile, node, compilerOptions, host, typeChecker) };
                        default:
                            return undefined;
                    }
                case ts.SyntaxKind.PropertyAssignment:
                    if (ts.isObjectLiteralExpression(node.parent.parent) && node.parent.name === node) {
                        // Get quoted name of properties of the object literal expression
                        // i.e. interface ConfigFiles {
                        //          'jspm:dev': string
                        //      }
                        //      let files: ConfigFiles = {
                        //          '/*completion position*/'
                        //      }
                        //
                        //      function foo(c: ConfigFiles) {}
                        //      foo({
                        //          '/*completion position*/'
                        //      });
                        return stringLiteralCompletionsFromProperties(typeChecker.getContextualType(node.parent.parent));
                    }
                    return fromContextualType();
                case ts.SyntaxKind.ElementAccessExpression: {
                    const { expression, argumentExpression } = node.parent;
                    if (node === argumentExpression) {
                        // Get all names of properties on the expression
                        // i.e. interface A {
                        //      'prop1': string
                        // }
                        // let a: A;
                        // a['/*completion position*/']
                        return stringLiteralCompletionsFromProperties(typeChecker.getTypeAtLocation(expression));
                    }
                    return undefined;
                }
                case ts.SyntaxKind.CallExpression:
                case ts.SyntaxKind.NewExpression:
                    if (!ts.isRequireCall(node.parent, /*checkArgumentIsStringLiteralLike*/ false) && !ts.isImportCall(node.parent)) {
                        const argumentInfo = ts.SignatureHelp.getImmediatelyContainingArgumentInfo(node, position, sourceFile);
                        // Get string literal completions from specialized signatures of the target
                        // i.e. declare function f(a: 'A');
                        // f("/*completion position*/")
                        return argumentInfo ? getStringLiteralCompletionsFromSignature(argumentInfo, typeChecker) : fromContextualType();
                    }
                // falls through (is `require("")` or `import("")`)
                case ts.SyntaxKind.ImportDeclaration:
                case ts.SyntaxKind.ExportDeclaration:
                case ts.SyntaxKind.ExternalModuleReference:
                    // Get all known external module names or complete a path to a module
                    // i.e. import * as ns from "/*completion position*/";
                    //      var y = import("/*completion position*/");
                    //      import x = require("/*completion position*/");
                    //      var y = require("/*completion position*/");
                    //      export * from "/*completion position*/";
                    return { kind: 0 /* Paths */, paths: Completions.PathCompletions.getStringLiteralCompletionsFromModuleNames(sourceFile, node, compilerOptions, host, typeChecker) };
                default:
                    return fromContextualType();
            }
            function fromContextualType() {
                // Get completion for string literal from string literal type
                // i.e. var x: "hi" | "hello" = "/*completion position*/"
                return { kind: 2 /* Types */, types: getStringLiteralTypes(getContextualTypeFromParent(node, typeChecker), typeChecker), isNewIdentifier: false };
            }
        }
        function getStringLiteralCompletionsFromSignature(argumentInfo, checker) {
            let isNewIdentifier = false;
            const uniques = ts.createMap();
            const candidates = [];
            checker.getResolvedSignature(argumentInfo.invocation, candidates, argumentInfo.argumentCount);
            const types = ts.flatMap(candidates, candidate => {
                if (!candidate.hasRestParameter && argumentInfo.argumentCount > candidate.parameters.length)
                    return;
                const type = checker.getParameterType(candidate, argumentInfo.argumentIndex);
                isNewIdentifier = isNewIdentifier || !!(type.flags & ts.TypeFlags.String);
                return getStringLiteralTypes(type, checker, uniques);
            });
            return { kind: 2 /* Types */, types, isNewIdentifier };
        }
        function stringLiteralCompletionsFromProperties(type) {
            return type && { kind: 1 /* Properties */, symbols: type.getApparentProperties(), hasIndexSignature: hasIndexSignature(type) };
        }
        function getStringLiteralTypes(type, typeChecker, uniques = ts.createMap()) {
            if (!type)
                return ts.emptyArray;
            type = ts.skipConstraint(type);
            return type.isUnion()
                ? ts.flatMap(type.types, t => getStringLiteralTypes(t, typeChecker, uniques))
                : type.isStringLiteral() && !(type.flags & ts.TypeFlags.EnumLiteral) && ts.addToSeen(uniques, type.value)
                    ? [type]
                    : ts.emptyArray;
        }
        function getSymbolCompletionFromEntryId(program, log, sourceFile, position, entryId) {
            const completionData = getCompletionData(program, log, sourceFile, position, { includeCompletionsForModuleExports: true, includeCompletionsWithInsertText: true }, entryId);
            if (!completionData) {
                return { type: "none" };
            }
            if (completionData.kind !== 0 /* Data */) {
                return { type: "request", request: completionData };
            }
            const { symbols, location, completionKind, symbolToOriginInfoMap, previousToken, isJsxInitializer } = completionData;
            // Find the symbol with the matching entry name.
            // We don't need to perform character checks here because we're only comparing the
            // name against 'entryName' (which is known to be good), not building a new
            // completion entry.
            return ts.firstDefined(symbols, (symbol) => {
                const origin = symbolToOriginInfoMap[ts.getSymbolId(symbol)];
                const info = getCompletionEntryDisplayNameForSymbol(symbol, program.getCompilerOptions().target, origin, completionKind);
                return info && info.name === entryId.name && getSourceFromOrigin(origin) === entryId.source
                    ? { type: "symbol", symbol, location, symbolToOriginInfoMap, previousToken, isJsxInitializer }
                    : undefined;
            }) || { type: "none" };
        }
        function getSymbolName(symbol, origin, target) {
            return origin && origin.type === "export" && origin.isDefaultExport && symbol.escapedName === ts.InternalSymbolName.Default
                // Name of "export default foo;" is "foo". Name of "export default 0" is the filename converted to camelCase.
                ? ts.firstDefined(symbol.declarations, d => ts.isExportAssignment(d) && ts.isIdentifier(d.expression) ? d.expression.text : undefined)
                    || ts.codefix.moduleSymbolToValidIdentifier(origin.moduleSymbol, target)
                : symbol.name;
        }
        function getCompletionEntryDetails(program, log, sourceFile, position, entryId, host, formatContext, getCanonicalFileName, preferences) {
            const typeChecker = program.getTypeChecker();
            const compilerOptions = program.getCompilerOptions();
            const { name } = entryId;
            const contextToken = ts.findPrecedingToken(position, sourceFile);
            if (ts.isInString(sourceFile, position, contextToken)) {
                const stringLiteralCompletions = !contextToken || !ts.isStringLiteralLike(contextToken)
                    ? undefined
                    : getStringLiteralCompletionEntries(sourceFile, contextToken, position, typeChecker, compilerOptions, host);
                return stringLiteralCompletions && stringLiteralCompletionDetails(name, contextToken, stringLiteralCompletions, sourceFile, typeChecker);
            }
            // Compute all the completion symbols again.
            const symbolCompletion = getSymbolCompletionFromEntryId(program, log, sourceFile, position, entryId);
            switch (symbolCompletion.type) {
                case "request": {
                    const { request } = symbolCompletion;
                    switch (request.kind) {
                        case 1 /* JsDocTagName */:
                            return ts.JsDoc.getJSDocTagNameCompletionDetails(name);
                        case 2 /* JsDocTag */:
                            return ts.JsDoc.getJSDocTagCompletionDetails(name);
                        case 3 /* JsDocParameterName */:
                            return ts.JsDoc.getJSDocParameterNameCompletionDetails(name);
                        default:
                            return ts.Debug.assertNever(request);
                    }
                }
                case "symbol": {
                    const { symbol, location, symbolToOriginInfoMap, previousToken } = symbolCompletion;
                    const { codeActions, sourceDisplay } = getCompletionEntryCodeActionsAndSourceDisplay(symbolToOriginInfoMap, symbol, program, typeChecker, host, compilerOptions, sourceFile, previousToken, formatContext, getCanonicalFileName, program.getSourceFiles(), preferences);
                    return createCompletionDetailsForSymbol(symbol, typeChecker, sourceFile, location, codeActions, sourceDisplay);
                }
                case "none":
                    // Didn't find a symbol with this name.  See if we can find a keyword instead.
                    return allKeywordsCompletions().some(c => c.name === name) ? createCompletionDetails(name, ts.ScriptElementKindModifier.none, ts.ScriptElementKind.keyword, [ts.displayPart(name, ts.SymbolDisplayPartKind.keyword)]) : undefined;
            }
        }
        Completions.getCompletionEntryDetails = getCompletionEntryDetails;
        function createCompletionDetailsForSymbol(symbol, checker, sourceFile, location, codeActions, sourceDisplay) {
            const { displayParts, documentation, symbolKind, tags } = ts.SymbolDisplay.getSymbolDisplayPartsDocumentationAndSymbolKind(checker, symbol, sourceFile, location, location, 7 /* All */);
            return createCompletionDetails(symbol.name, ts.SymbolDisplay.getSymbolModifiers(symbol), symbolKind, displayParts, documentation, tags, codeActions, sourceDisplay);
        }
        function stringLiteralCompletionDetails(name, location, completion, sourceFile, checker) {
            switch (completion.kind) {
                case 0 /* Paths */: {
                    const match = ts.find(completion.paths, p => p.name === name);
                    return match && createCompletionDetails(name, ts.ScriptElementKindModifier.none, match.kind, [ts.textPart(name)]);
                }
                case 1 /* Properties */: {
                    const match = ts.find(completion.symbols, s => s.name === name);
                    return match && createCompletionDetailsForSymbol(match, checker, sourceFile, location);
                }
                case 2 /* Types */:
                    return ts.find(completion.types, t => t.value === name) ? createCompletionDetails(name, ts.ScriptElementKindModifier.none, ts.ScriptElementKind.typeElement, [ts.textPart(name)]) : undefined;
                default:
                    return ts.Debug.assertNever(completion);
            }
        }
        function createCompletionDetails(name, kindModifiers, kind, displayParts, documentation, tags, codeActions, source) {
            return { name, kindModifiers, kind, displayParts, documentation, tags, codeActions, source };
        }
        function getCompletionEntryCodeActionsAndSourceDisplay(symbolToOriginInfoMap, symbol, program, checker, host, compilerOptions, sourceFile, previousToken, formatContext, getCanonicalFileName, allSourceFiles, preferences) {
            const symbolOriginInfo = symbolToOriginInfoMap[ts.getSymbolId(symbol)];
            if (!symbolOriginInfo || symbolOriginInfo.type !== "export") {
                return { codeActions: undefined, sourceDisplay: undefined };
            }
            const { moduleSymbol } = symbolOriginInfo;
            const exportedSymbol = ts.skipAlias(symbol.exportSymbol || symbol, checker);
            const { moduleSpecifier, codeAction } = ts.codefix.getImportCompletionAction(exportedSymbol, moduleSymbol, sourceFile, getSymbolName(symbol, symbolOriginInfo, compilerOptions.target), host, program, checker, compilerOptions, allSourceFiles, formatContext, getCanonicalFileName, previousToken, preferences);
            return { sourceDisplay: [ts.textPart(moduleSpecifier)], codeActions: [codeAction] };
        }
        function getCompletionEntrySymbol(program, log, sourceFile, position, entryId) {
            const completion = getSymbolCompletionFromEntryId(program, log, sourceFile, position, entryId);
            return completion.type === "symbol" ? completion.symbol : undefined;
        }
        Completions.getCompletionEntrySymbol = getCompletionEntrySymbol;
        function getRecommendedCompletion(currentToken, position, sourceFile, checker) {
            const ty = getContextualType(currentToken, position, sourceFile, checker);
            const symbol = ty && ty.symbol;
            // Don't include make a recommended completion for an abstract class
            return symbol && (symbol.flags & ts.SymbolFlags.Enum || symbol.flags & ts.SymbolFlags.Class && !ts.isAbstractConstructorSymbol(symbol))
                ? getFirstSymbolInChain(symbol, currentToken, checker)
                : undefined;
        }
        function getContextualType(currentToken, position, sourceFile, checker) {
            const { parent } = currentToken;
            switch (currentToken.kind) {
                case ts.SyntaxKind.Identifier:
                    return getContextualTypeFromParent(currentToken, checker);
                case ts.SyntaxKind.EqualsToken:
                    switch (parent.kind) {
                        case ts.SyntaxKind.VariableDeclaration:
                            return checker.getContextualType(parent.initializer);
                        case ts.SyntaxKind.BinaryExpression:
                            return checker.getTypeAtLocation(parent.left);
                        case ts.SyntaxKind.JsxAttribute:
                            return checker.getContextualTypeForJsxAttribute(parent);
                        default:
                            return undefined;
                    }
                case ts.SyntaxKind.NewKeyword:
                    return checker.getContextualType(parent);
                case ts.SyntaxKind.CaseKeyword:
                    return getSwitchedType(ts.cast(parent, ts.isCaseClause), checker);
                case ts.SyntaxKind.OpenBraceToken:
                    return ts.isJsxExpression(parent) && parent.parent.kind !== ts.SyntaxKind.JsxElement ? checker.getContextualTypeForJsxAttribute(parent.parent) : undefined;
                default:
                    const argInfo = ts.SignatureHelp.getImmediatelyContainingArgumentInfo(currentToken, position, sourceFile);
                    return argInfo
                        // At `,`, treat this as the next argument after the comma.
                        ? checker.getContextualTypeForArgumentAtIndex(argInfo.invocation, argInfo.argumentIndex + (currentToken.kind === ts.SyntaxKind.CommaToken ? 1 : 0))
                        : isEqualityOperatorKind(currentToken.kind) && ts.isBinaryExpression(parent) && isEqualityOperatorKind(parent.operatorToken.kind)
                            // completion at `x ===/**/` should be for the right side
                            ? checker.getTypeAtLocation(parent.left)
                            : checker.getContextualType(currentToken);
            }
        }
        function getContextualTypeFromParent(node, checker) {
            const { parent } = node;
            switch (parent.kind) {
                case ts.SyntaxKind.NewExpression:
                    return checker.getContextualType(parent);
                case ts.SyntaxKind.BinaryExpression: {
                    const { left, operatorToken, right } = parent;
                    return isEqualityOperatorKind(operatorToken.kind)
                        ? checker.getTypeAtLocation(node === right ? left : right)
                        : checker.getContextualType(node);
                }
                case ts.SyntaxKind.CaseClause:
                    return parent.expression === node ? getSwitchedType(parent, checker) : undefined;
                default:
                    return checker.getContextualType(node);
            }
        }
        function getSwitchedType(caseClause, checker) {
            return checker.getTypeAtLocation(caseClause.parent.parent.expression);
        }
        function getFirstSymbolInChain(symbol, enclosingDeclaration, checker) {
            const chain = checker.getAccessibleSymbolChain(symbol, enclosingDeclaration, /*meaning*/ ts.SymbolFlags.All, /*useOnlyExternalAliasing*/ false);
            if (chain)
                return ts.first(chain);
            return symbol.parent && (isModuleSymbol(symbol.parent) ? symbol : getFirstSymbolInChain(symbol.parent, enclosingDeclaration, checker));
        }
        function isModuleSymbol(symbol) {
            return symbol.declarations.some(d => d.kind === ts.SyntaxKind.SourceFile);
        }
        function getCompletionData(program, log, sourceFile, position, preferences, detailsEntryId) {
            const typeChecker = program.getTypeChecker();
            let start = ts.timestamp();
            let currentToken = ts.getTokenAtPosition(sourceFile, position, /*includeJsDocComment*/ false); // TODO: GH#15853
            // We will check for jsdoc comments with insideComment and getJsDocTagAtPosition. (TODO: that seems rather inefficient to check the same thing so many times.)
            log("getCompletionData: Get current token: " + (ts.timestamp() - start));
            start = ts.timestamp();
            // Completion not allowed inside comments, bail out if this is the case
            const insideComment = ts.isInComment(sourceFile, position, currentToken);
            log("getCompletionData: Is inside comment: " + (ts.timestamp() - start));
            let insideJsDocTagTypeExpression = false;
            let isInSnippetScope = false;
            if (insideComment) {
                if (ts.hasDocComment(sourceFile, position)) {
                    if (sourceFile.text.charCodeAt(position - 1) === 64 /* at */) {
                        // The current position is next to the '@' sign, when no tag name being provided yet.
                        // Provide a full list of tag names
                        return { kind: 1 /* JsDocTagName */ };
                    }
                    else {
                        // When completion is requested without "@", we will have check to make sure that
                        // there are no comments prefix the request position. We will only allow "*" and space.
                        // e.g
                        //   /** |c| /*
                        //
                        //   /**
                        //     |c|
                        //    */
                        //
                        //   /**
                        //    * |c|
                        //    */
                        //
                        //   /**
                        //    *         |c|
                        //    */
                        const lineStart = ts.getLineStartPositionForPosition(position, sourceFile);
                        if (!(sourceFile.text.substring(lineStart, position).match(/[^\*|\s|(/\*\*)]/))) {
                            return { kind: 2 /* JsDocTag */ };
                        }
                    }
                }
                // Completion should work inside certain JsDoc tags. For example:
                //     /** @type {number | string} */
                // Completion should work in the brackets
                const tag = getJsDocTagAtPosition(currentToken, position);
                if (tag) {
                    if (tag.tagName.pos <= position && position <= tag.tagName.end) {
                        return { kind: 1 /* JsDocTagName */ };
                    }
                    if (isTagWithTypeExpression(tag) && tag.typeExpression && tag.typeExpression.kind === ts.SyntaxKind.JSDocTypeExpression) {
                        currentToken = ts.getTokenAtPosition(sourceFile, position, /*includeJsDocComment*/ true);
                        if (!currentToken ||
                            (!ts.isDeclarationName(currentToken) &&
                                (currentToken.parent.kind !== ts.SyntaxKind.JSDocPropertyTag ||
                                    currentToken.parent.name !== currentToken))) {
                            // Use as type location if inside tag's type expression
                            insideJsDocTagTypeExpression = isCurrentlyEditingNode(tag.typeExpression);
                        }
                    }
                    if (ts.isJSDocParameterTag(tag) && (ts.nodeIsMissing(tag.name) || tag.name.pos <= position && position <= tag.name.end)) {
                        return { kind: 3 /* JsDocParameterName */, tag };
                    }
                }
                if (!insideJsDocTagTypeExpression) {
                    // Proceed if the current position is in jsDoc tag expression; otherwise it is a normal
                    // comment or the plain text part of a jsDoc comment, so no completion should be available
                    log("Returning an empty list because completion was inside a regular comment or plain text part of a JsDoc comment.");
                    return undefined;
                }
            }
            start = ts.timestamp();
            const previousToken = ts.findPrecedingToken(position, sourceFile, /*startNode*/ undefined, insideJsDocTagTypeExpression);
            log("getCompletionData: Get previous token 1: " + (ts.timestamp() - start));
            // The decision to provide completion depends on the contextToken, which is determined through the previousToken.
            // Note: 'previousToken' (and thus 'contextToken') can be undefined if we are the beginning of the file
            let contextToken = previousToken;
            // Check if the caret is at the end of an identifier; this is a partial identifier that we want to complete: e.g. a.toS|
            // Skip this partial identifier and adjust the contextToken to the token that precedes it.
            if (contextToken && position <= contextToken.end && (ts.isIdentifier(contextToken) || ts.isKeyword(contextToken.kind))) {
                const start = ts.timestamp();
                contextToken = ts.findPrecedingToken(contextToken.getFullStart(), sourceFile, /*startNode*/ undefined, insideJsDocTagTypeExpression);
                log("getCompletionData: Get previous token 2: " + (ts.timestamp() - start));
            }
            // Find the node where completion is requested on.
            // Also determine whether we are trying to complete with members of that node
            // or attributes of a JSX tag.
            let node = currentToken;
            let propertyAccessToConvert;
            let isRightOfDot = false;
            let isRightOfOpenTag = false;
            let isStartingCloseTag = false;
            let isJsxInitializer = false;
            let location = ts.getTouchingPropertyName(sourceFile, position, insideJsDocTagTypeExpression); // TODO: GH#15853
            if (contextToken) {
                // Bail out if this is a known invalid completion location
                if (isCompletionListBlocker(contextToken)) {
                    log("Returning an empty list because completion was requested in an invalid position.");
                    return undefined;
                }
                let parent = contextToken.parent;
                if (contextToken.kind === ts.SyntaxKind.DotToken) {
                    isRightOfDot = true;
                    switch (parent.kind) {
                        case ts.SyntaxKind.PropertyAccessExpression:
                            propertyAccessToConvert = parent;
                            node = propertyAccessToConvert.expression;
                            break;
                        case ts.SyntaxKind.QualifiedName:
                            node = parent.left;
                            break;
                        case ts.SyntaxKind.ImportType:
                            node = parent;
                            break;
                        default:
                            // There is nothing that precedes the dot, so this likely just a stray character
                            // or leading into a '...' token. Just bail out instead.
                            return undefined;
                    }
                }
                else if (sourceFile.languageVariant === ts.LanguageVariant.JSX) {
                    // <UI.Test /* completion position */ />
                    // If the tagname is a property access expression, we will then walk up to the top most of property access expression.
                    // Then, try to get a JSX container and its associated attributes type.
                    if (parent && parent.kind === ts.SyntaxKind.PropertyAccessExpression) {
                        contextToken = parent;
                        parent = parent.parent;
                    }
                    // Fix location
                    if (currentToken.parent === location) {
                        switch (currentToken.kind) {
                            case ts.SyntaxKind.GreaterThanToken:
                                if (currentToken.parent.kind === ts.SyntaxKind.JsxElement || currentToken.parent.kind === ts.SyntaxKind.JsxOpeningElement) {
                                    location = currentToken;
                                }
                                break;
                            case ts.SyntaxKind.SlashToken:
                                if (currentToken.parent.kind === ts.SyntaxKind.JsxSelfClosingElement) {
                                    location = currentToken;
                                }
                                break;
                        }
                    }
                    switch (parent.kind) {
                        case ts.SyntaxKind.JsxClosingElement:
                            if (contextToken.kind === ts.SyntaxKind.SlashToken) {
                                isStartingCloseTag = true;
                                location = contextToken;
                            }
                            break;
                        case ts.SyntaxKind.BinaryExpression:
                            if (!(parent.left.flags & ts.NodeFlags.ThisNodeHasError)) {
                                // It has a left-hand side, so we're not in an opening JSX tag.
                                break;
                            }
                        // falls through
                        case ts.SyntaxKind.JsxSelfClosingElement:
                        case ts.SyntaxKind.JsxElement:
                        case ts.SyntaxKind.JsxOpeningElement:
                            if (contextToken.kind === ts.SyntaxKind.LessThanToken) {
                                isRightOfOpenTag = true;
                                location = contextToken;
                            }
                            break;
                        case ts.SyntaxKind.JsxAttribute:
                            switch (previousToken.kind) {
                                case ts.SyntaxKind.EqualsToken:
                                    isJsxInitializer = true;
                                    break;
                                case ts.SyntaxKind.Identifier:
                                    // For `<div x=[|f/**/|]`, `parent` will be `x` and `previousToken.parent` will be `f` (which is its own JsxAttribute)
                                    if (parent !== previousToken.parent && !parent.initializer) {
                                        isJsxInitializer = previousToken;
                                    }
                            }
                            break;
                    }
                }
            }
            const semanticStart = ts.timestamp();
            let completionKind = 5 /* None */;
            let isNewIdentifierLocation = false;
            let keywordFilters = 0 /* None */;
            let symbols = [];
            const symbolToOriginInfoMap = [];
            if (isRightOfDot) {
                getTypeScriptMemberSymbols();
            }
            else if (isRightOfOpenTag) {
                const tagSymbols = ts.Debug.assertEachDefined(typeChecker.getJsxIntrinsicTagNamesAt(location), "getJsxIntrinsicTagNames() should all be defined");
                if (tryGetGlobalSymbols()) {
                    symbols = tagSymbols.concat(symbols.filter(s => !!(s.flags & (ts.SymbolFlags.Value | ts.SymbolFlags.Alias))));
                }
                else {
                    symbols = tagSymbols;
                }
                completionKind = 3 /* MemberLike */;
            }
            else if (isStartingCloseTag) {
                const tagName = contextToken.parent.parent.openingElement.tagName;
                const tagSymbol = typeChecker.getSymbolAtLocation(tagName);
                if (tagSymbol) {
                    symbols = [tagSymbol];
                }
                completionKind = 3 /* MemberLike */;
            }
            else {
                // For JavaScript or TypeScript, if we're not after a dot, then just try to get the
                // global symbols in scope.  These results should be valid for either language as
                // the set of symbols that can be referenced from this location.
                if (!tryGetGlobalSymbols()) {
                    return undefined;
                }
            }
            log("getCompletionData: Semantic work: " + (ts.timestamp() - semanticStart));
            const recommendedCompletion = previousToken && getRecommendedCompletion(previousToken, position, sourceFile, typeChecker);
            return { kind: 0 /* Data */, symbols, completionKind, isInSnippetScope, propertyAccessToConvert, isNewIdentifierLocation, location, keywordFilters, symbolToOriginInfoMap, recommendedCompletion, previousToken, isJsxInitializer };
            function isTagWithTypeExpression(tag) {
                switch (tag.kind) {
                    case ts.SyntaxKind.JSDocParameterTag:
                    case ts.SyntaxKind.JSDocPropertyTag:
                    case ts.SyntaxKind.JSDocReturnTag:
                    case ts.SyntaxKind.JSDocTypeTag:
                    case ts.SyntaxKind.JSDocTypedefTag:
                        return true;
                }
            }
            function getTypeScriptMemberSymbols() {
                // Right of dot member completion list
                completionKind = 2 /* PropertyAccess */;
                // Since this is qualified name check its a type node location
                const isImportType = ts.isLiteralImportTypeNode(node);
                const isTypeLocation = insideJsDocTagTypeExpression || (isImportType && !node.isTypeOf) || ts.isPartOfTypeNode(node.parent);
                const isRhsOfImportDeclaration = ts.isInRightSideOfInternalImportEqualsDeclaration(node);
                const allowTypeOrValue = isRhsOfImportDeclaration || (!isTypeLocation && ts.isPossiblyTypeArgumentPosition(contextToken, sourceFile));
                if (ts.isEntityName(node) || isImportType) {
                    let symbol = typeChecker.getSymbolAtLocation(node);
                    if (symbol) {
                        symbol = ts.skipAlias(symbol, typeChecker);
                        if (symbol.flags & (ts.SymbolFlags.Module | ts.SymbolFlags.Enum)) {
                            // Extract module or enum members
                            const exportedSymbols = ts.Debug.assertEachDefined(typeChecker.getExportsOfModule(symbol), "getExportsOfModule() should all be defined");
                            const isValidValueAccess = (symbol) => typeChecker.isValidPropertyAccess(isImportType ? node : (node.parent), symbol.name);
                            const isValidTypeAccess = (symbol) => symbolCanBeReferencedAtTypeLocation(symbol);
                            const isValidAccess = allowTypeOrValue ?
                                // Any kind is allowed when dotting off namespace in internal import equals declaration
                                (symbol) => isValidTypeAccess(symbol) || isValidValueAccess(symbol) :
                                isTypeLocation ? isValidTypeAccess : isValidValueAccess;
                            for (const symbol of exportedSymbols) {
                                if (isValidAccess(symbol)) {
                                    symbols.push(symbol);
                                }
                            }
                            // If the module is merged with a value, we must get the type of the class and add its propertes (for inherited static methods).
                            if (!isTypeLocation && symbol.declarations.some(d => d.kind !== ts.SyntaxKind.SourceFile && d.kind !== ts.SyntaxKind.ModuleDeclaration && d.kind !== ts.SyntaxKind.EnumDeclaration)) {
                                addTypeProperties(typeChecker.getTypeOfSymbolAtLocation(symbol, node));
                            }
                            return;
                        }
                    }
                }
                if (!isTypeLocation) {
                    addTypeProperties(typeChecker.getTypeAtLocation(node));
                }
            }
            function addTypeProperties(type) {
                isNewIdentifierLocation = hasIndexSignature(type);
                if (ts.isSourceFileJavaScript(sourceFile)) {
                    // In javascript files, for union types, we don't just get the members that
                    // the individual types have in common, we also include all the members that
                    // each individual type has. This is because we're going to add all identifiers
                    // anyways. So we might as well elevate the members that were at least part
                    // of the individual types to a higher status since we know what they are.
                    symbols.push(...getPropertiesForCompletion(type, typeChecker, /*isForAccess*/ true));
                }
                else {
                    for (const symbol of type.getApparentProperties()) {
                        if (typeChecker.isValidPropertyAccessForCompletions(node.kind === ts.SyntaxKind.ImportType ? node : node.parent, type, symbol)) {
                            addPropertySymbol(symbol);
                        }
                    }
                }
            }
            function addPropertySymbol(symbol) {
                // If this is e.g. [Symbol.iterator], add a completion for `Symbol`.
                const symbolSymbol = ts.firstDefined(symbol.declarations, decl => {
                    const name = ts.getNameOfDeclaration(decl);
                    const leftName = name.kind === ts.SyntaxKind.ComputedPropertyName ? getLeftMostName(name.expression) : undefined;
                    return leftName && typeChecker.getSymbolAtLocation(leftName);
                });
                if (symbolSymbol) {
                    symbols.push(symbolSymbol);
                    symbolToOriginInfoMap[ts.getSymbolId(symbolSymbol)] = { type: "symbol-member" };
                }
                else {
                    symbols.push(symbol);
                }
            }
            /** Given 'a.b.c', returns 'a'. */
            function getLeftMostName(e) {
                return ts.isIdentifier(e) ? e : ts.isPropertyAccessExpression(e) ? getLeftMostName(e.expression) : undefined;
            }
            function tryGetGlobalSymbols() {
                const result = tryGetObjectLikeCompletionSymbols()
                    || tryGetImportOrExportClauseCompletionSymbols()
                    || tryGetConstructorCompletion()
                    || tryGetClassLikeCompletionSymbols()
                    || tryGetJsxCompletionSymbols()
                    || (getGlobalCompletions(), 1 /* Success */);
                return result === 1 /* Success */;
            }
            function tryGetConstructorCompletion() {
                if (!tryGetConstructorLikeCompletionContainer(contextToken))
                    return 0 /* Continue */;
                // no members, only keywords
                completionKind = 5 /* None */;
                // Declaring new property/method/accessor
                isNewIdentifierLocation = true;
                // Has keywords for constructor parameter
                keywordFilters = 3 /* ConstructorParameterKeywords */;
                return 1 /* Success */;
            }
            function tryGetJsxCompletionSymbols() {
                const jsxContainer = tryGetContainingJsxElement(contextToken);
                // Cursor is inside a JSX self-closing element or opening element
                const attrsType = jsxContainer && typeChecker.getAllAttributesTypeFromJsxOpeningLikeElement(jsxContainer);
                if (!attrsType)
                    return 0 /* Continue */;
                symbols = filterJsxAttributes(typeChecker.getPropertiesOfType(attrsType), jsxContainer.attributes.properties);
                completionKind = 3 /* MemberLike */;
                isNewIdentifierLocation = false;
                return 1 /* Success */;
            }
            function getGlobalCompletions() {
                if (tryGetFunctionLikeBodyCompletionContainer(contextToken)) {
                    keywordFilters = 4 /* FunctionLikeBodyKeywords */;
                }
                // Get all entities in the current scope.
                completionKind = 1 /* Global */;
                isNewIdentifierLocation = isNewIdentifierDefinitionLocation(contextToken);
                if (previousToken !== contextToken) {
                    ts.Debug.assert(!!previousToken, "Expected 'contextToken' to be defined when different from 'previousToken'.");
                }
                // We need to find the node that will give us an appropriate scope to begin
                // aggregating completion candidates. This is achieved in 'getScopeNode'
                // by finding the first node that encompasses a position, accounting for whether a node
                // is "complete" to decide whether a position belongs to the node.
                //
                // However, at the end of an identifier, we are interested in the scope of the identifier
                // itself, but fall outside of the identifier. For instance:
                //
                //      xyz => x$
                //
                // the cursor is outside of both the 'x' and the arrow function 'xyz => x',
                // so 'xyz' is not returned in our results.
                //
                // We define 'adjustedPosition' so that we may appropriately account for
                // being at the end of an identifier. The intention is that if requesting completion
                // at the end of an identifier, it should be effectively equivalent to requesting completion
                // anywhere inside/at the beginning of the identifier. So in the previous case, the
                // 'adjustedPosition' will work as if requesting completion in the following:
                //
                //      xyz => $x
                //
                // If previousToken !== contextToken, then
                //   - 'contextToken' was adjusted to the token prior to 'previousToken'
                //      because we were at the end of an identifier.
                //   - 'previousToken' is defined.
                const adjustedPosition = previousToken !== contextToken ?
                    previousToken.getStart() :
                    position;
                const scopeNode = getScopeNode(contextToken, adjustedPosition, sourceFile) || sourceFile;
                isInSnippetScope = isSnippetScope(scopeNode);
                const symbolMeanings = ts.SymbolFlags.Type | ts.SymbolFlags.Value | ts.SymbolFlags.Namespace | ts.SymbolFlags.Alias;
                symbols = ts.Debug.assertEachDefined(typeChecker.getSymbolsInScope(scopeNode, symbolMeanings), "getSymbolsInScope() should all be defined");
                // Need to insert 'this.' before properties of `this` type, so only do that if `includeInsertTextCompletions`
                if (preferences.includeCompletionsWithInsertText && scopeNode.kind !== ts.SyntaxKind.SourceFile) {
                    const thisType = typeChecker.tryGetThisTypeAt(scopeNode);
                    if (thisType) {
                        for (const symbol of getPropertiesForCompletion(thisType, typeChecker, /*isForAccess*/ true)) {
                            symbolToOriginInfoMap[ts.getSymbolId(symbol)] = { type: "this-type" };
                            symbols.push(symbol);
                        }
                    }
                }
                if (shouldOfferImportCompletions()) {
                    getSymbolsFromOtherSourceFileExports(symbols, previousToken && ts.isIdentifier(previousToken) ? previousToken.text : "", program.getCompilerOptions().target);
                }
                filterGlobalCompletion(symbols);
            }
            function shouldOfferImportCompletions() {
                // If not already a module, must have modules enabled and not currently be in a commonjs module. (TODO: import completions for commonjs)
                if (!preferences.includeCompletionsForModuleExports)
                    return false;
                // If already using ES6 modules, OK to continue using them.
                if (sourceFile.externalModuleIndicator)
                    return true;
                // If already using commonjs, don't introduce ES6.
                if (sourceFile.commonJsModuleIndicator)
                    return false;
                // If some file is using ES6 modules, assume that it's OK to add more.
                if (ts.programContainsEs6Modules(program))
                    return true;
                // For JS, stay on the safe side.
                if (ts.isSourceFileJavaScript(sourceFile))
                    return false;
                // If module transpilation is enabled or we're targeting es6 or above, or not emitting, OK.
                return ts.compilerOptionsIndicateEs6Modules(program.getCompilerOptions());
            }
            function isSnippetScope(scopeNode) {
                switch (scopeNode.kind) {
                    case ts.SyntaxKind.SourceFile:
                    case ts.SyntaxKind.TemplateExpression:
                    case ts.SyntaxKind.JsxExpression:
                    case ts.SyntaxKind.Block:
                        return true;
                    default:
                        return ts.isStatement(scopeNode);
                }
            }
            function filterGlobalCompletion(symbols) {
                const isTypeOnlyCompletion = insideJsDocTagTypeExpression || !isContextTokenValueLocation(contextToken) && (ts.isPartOfTypeNode(location) || isContextTokenTypeLocation(contextToken));
                const allowTypes = isTypeOnlyCompletion || !isContextTokenValueLocation(contextToken) && ts.isPossiblyTypeArgumentPosition(contextToken, sourceFile);
                if (isTypeOnlyCompletion)
                    keywordFilters = 5 /* TypeKeywords */;
                ts.filterMutate(symbols, symbol => {
                    if (!ts.isSourceFile(location)) {
                        // export = /**/ here we want to get all meanings, so any symbol is ok
                        if (ts.isExportAssignment(location.parent)) {
                            return true;
                        }
                        symbol = ts.skipAlias(symbol, typeChecker);
                        // import m = /**/ <-- It can only access namespace (if typing import = x. this would get member symbols and not namespace)
                        if (ts.isInRightSideOfInternalImportEqualsDeclaration(location)) {
                            return !!(symbol.flags & ts.SymbolFlags.Namespace);
                        }
                        if (allowTypes) {
                            // Its a type, but you can reach it by namespace.type as well
                            const symbolAllowedAsType = symbolCanBeReferencedAtTypeLocation(symbol);
                            if (symbolAllowedAsType || isTypeOnlyCompletion) {
                                return symbolAllowedAsType;
                            }
                        }
                    }
                    // expressions are value space (which includes the value namespaces)
                    return !!(ts.getCombinedLocalAndExportSymbolFlags(symbol) & ts.SymbolFlags.Value);
                });
            }
            function isContextTokenValueLocation(contextToken) {
                return contextToken &&
                    contextToken.kind === ts.SyntaxKind.TypeOfKeyword &&
                    (contextToken.parent.kind === ts.SyntaxKind.TypeQuery || ts.isTypeOfExpression(contextToken.parent));
            }
            function isContextTokenTypeLocation(contextToken) {
                if (contextToken) {
                    const parentKind = contextToken.parent.kind;
                    switch (contextToken.kind) {
                        case ts.SyntaxKind.ColonToken:
                            return parentKind === ts.SyntaxKind.PropertyDeclaration ||
                                parentKind === ts.SyntaxKind.PropertySignature ||
                                parentKind === ts.SyntaxKind.Parameter ||
                                parentKind === ts.SyntaxKind.VariableDeclaration ||
                                ts.isFunctionLikeKind(parentKind);
                        case ts.SyntaxKind.EqualsToken:
                            return parentKind === ts.SyntaxKind.TypeAliasDeclaration;
                        case ts.SyntaxKind.AsKeyword:
                            return parentKind === ts.SyntaxKind.AsExpression;
                    }
                }
                return false;
            }
            function symbolCanBeReferencedAtTypeLocation(symbol) {
                symbol = symbol.exportSymbol || symbol;
                // This is an alias, follow what it aliases
                symbol = ts.skipAlias(symbol, typeChecker);
                if (symbol.flags & ts.SymbolFlags.Type) {
                    return true;
                }
                if (symbol.flags & ts.SymbolFlags.Module) {
                    const exportedSymbols = typeChecker.getExportsOfModule(symbol);
                    // If the exported symbols contains type,
                    // symbol can be referenced at locations where type is allowed
                    return ts.forEach(exportedSymbols, symbolCanBeReferencedAtTypeLocation);
                }
            }
            function getSymbolsFromOtherSourceFileExports(symbols, tokenText, target) {
                const tokenTextLowerCase = tokenText.toLowerCase();
                ts.codefix.forEachExternalModuleToImportFrom(typeChecker, sourceFile, program.getSourceFiles(), moduleSymbol => {
                    // Perf -- ignore other modules if this is a request for details
                    if (detailsEntryId && detailsEntryId.source && ts.stripQuotes(moduleSymbol.name) !== detailsEntryId.source) {
                        return;
                    }
                    for (let symbol of typeChecker.getExportsOfModule(moduleSymbol)) {
                        // Don't add a completion for a re-export, only for the original.
                        // The actual import fix might end up coming from a re-export -- we don't compute that until getting completion details.
                        // This is just to avoid adding duplicate completion entries.
                        //
                        // If `symbol.parent !== ...`, this comes from an `export * from "foo"` re-export. Those don't create new symbols.
                        // If `some(...)`, this comes from an `export { foo } from "foo"` re-export, which creates a new symbol (thus isn't caught by the first check).
                        if (typeChecker.getMergedSymbol(symbol.parent) !== typeChecker.resolveExternalModuleSymbol(moduleSymbol)
                            || ts.some(symbol.declarations, d => ts.isExportSpecifier(d) && !!d.parent.parent.moduleSpecifier)) {
                            continue;
                        }
                        const isDefaultExport = symbol.name === ts.InternalSymbolName.Default;
                        if (isDefaultExport) {
                            symbol = ts.getLocalSymbolForExportDefault(symbol) || symbol;
                        }
                        const origin = { type: "export", moduleSymbol, isDefaultExport };
                        if (detailsEntryId || stringContainsCharactersInOrder(getSymbolName(symbol, origin, target).toLowerCase(), tokenTextLowerCase)) {
                            symbols.push(symbol);
                            symbolToOriginInfoMap[ts.getSymbolId(symbol)] = origin;
                        }
                    }
                });
            }
            /**
             * True if you could remove some characters in `a` to get `b`.
             * E.g., true for "abcdef" and "bdf".
             * But not true for "abcdef" and "dbf".
             */
            function stringContainsCharactersInOrder(str, characters) {
                if (characters.length === 0) {
                    return true;
                }
                let characterIndex = 0;
                for (let strIndex = 0; strIndex < str.length; strIndex++) {
                    if (str.charCodeAt(strIndex) === characters.charCodeAt(characterIndex)) {
                        characterIndex++;
                        if (characterIndex === characters.length) {
                            return true;
                        }
                    }
                }
                // Did not find all characters
                return false;
            }
            /**
             * Finds the first node that "embraces" the position, so that one may
             * accurately aggregate locals from the closest containing scope.
             */
            function getScopeNode(initialToken, position, sourceFile) {
                let scope = initialToken;
                while (scope && !ts.positionBelongsToNode(scope, position, sourceFile)) {
                    scope = scope.parent;
                }
                return scope;
            }
            function isCompletionListBlocker(contextToken) {
                const start = ts.timestamp();
                const result = isInStringOrRegularExpressionOrTemplateLiteral(contextToken) ||
                    isSolelyIdentifierDefinitionLocation(contextToken) ||
                    isDotOfNumericLiteral(contextToken) ||
                    isInJsxText(contextToken);
                log("getCompletionsAtPosition: isCompletionListBlocker: " + (ts.timestamp() - start));
                return result;
            }
            function isInJsxText(contextToken) {
                if (contextToken.kind === ts.SyntaxKind.JsxText) {
                    return true;
                }
                if (contextToken.kind === ts.SyntaxKind.GreaterThanToken && contextToken.parent) {
                    if (contextToken.parent.kind === ts.SyntaxKind.JsxOpeningElement) {
                        return true;
                    }
                    if (contextToken.parent.kind === ts.SyntaxKind.JsxClosingElement || contextToken.parent.kind === ts.SyntaxKind.JsxSelfClosingElement) {
                        return contextToken.parent.parent && contextToken.parent.parent.kind === ts.SyntaxKind.JsxElement;
                    }
                }
                return false;
            }
            function isNewIdentifierDefinitionLocation(previousToken) {
                if (previousToken) {
                    const containingNodeKind = previousToken.parent.kind;
                    switch (previousToken.kind) {
                        case ts.SyntaxKind.CommaToken:
                            return containingNodeKind === ts.SyntaxKind.CallExpression // func( a, |
                                || containingNodeKind === ts.SyntaxKind.Constructor // constructor( a, |   /* public, protected, private keywords are allowed here, so show completion */
                                || containingNodeKind === ts.SyntaxKind.NewExpression // new C(a, |
                                || containingNodeKind === ts.SyntaxKind.ArrayLiteralExpression // [a, |
                                || containingNodeKind === ts.SyntaxKind.BinaryExpression // const x = (a, |
                                || containingNodeKind === ts.SyntaxKind.FunctionType; // var x: (s: string, list|
                        case ts.SyntaxKind.OpenParenToken:
                            return containingNodeKind === ts.SyntaxKind.CallExpression // func( |
                                || containingNodeKind === ts.SyntaxKind.Constructor // constructor( |
                                || containingNodeKind === ts.SyntaxKind.NewExpression // new C(a|
                                || containingNodeKind === ts.SyntaxKind.ParenthesizedExpression // const x = (a|
                                || containingNodeKind === ts.SyntaxKind.ParenthesizedType; // function F(pred: (a| /* this can become an arrow function, where 'a' is the argument */
                        case ts.SyntaxKind.OpenBracketToken:
                            return containingNodeKind === ts.SyntaxKind.ArrayLiteralExpression // [ |
                                || containingNodeKind === ts.SyntaxKind.IndexSignature // [ | : string ]
                                || containingNodeKind === ts.SyntaxKind.ComputedPropertyName; // [ |    /* this can become an index signature */
                        case ts.SyntaxKind.ModuleKeyword: // module |
                        case ts.SyntaxKind.NamespaceKeyword: // namespace |
                            return true;
                        case ts.SyntaxKind.DotToken:
                            return containingNodeKind === ts.SyntaxKind.ModuleDeclaration; // module A.|
                        case ts.SyntaxKind.OpenBraceToken:
                            return containingNodeKind === ts.SyntaxKind.ClassDeclaration; // class A{ |
                        case ts.SyntaxKind.EqualsToken:
                            return containingNodeKind === ts.SyntaxKind.VariableDeclaration // const x = a|
                                || containingNodeKind === ts.SyntaxKind.BinaryExpression; // x = a|
                        case ts.SyntaxKind.TemplateHead:
                            return containingNodeKind === ts.SyntaxKind.TemplateExpression; // `aa ${|
                        case ts.SyntaxKind.TemplateMiddle:
                            return containingNodeKind === ts.SyntaxKind.TemplateSpan; // `aa ${10} dd ${|
                        case ts.SyntaxKind.PublicKeyword:
                        case ts.SyntaxKind.PrivateKeyword:
                        case ts.SyntaxKind.ProtectedKeyword:
                            return containingNodeKind === ts.SyntaxKind.PropertyDeclaration; // class A{ public |
                    }
                    // Previous token may have been a keyword that was converted to an identifier.
                    switch (keywordForNode(previousToken)) {
                        case ts.SyntaxKind.PublicKeyword:
                        case ts.SyntaxKind.ProtectedKeyword:
                        case ts.SyntaxKind.PrivateKeyword:
                            return true;
                    }
                }
                return false;
            }
            function isInStringOrRegularExpressionOrTemplateLiteral(contextToken) {
                if (contextToken.kind === ts.SyntaxKind.StringLiteral
                    || contextToken.kind === ts.SyntaxKind.RegularExpressionLiteral
                    || ts.isTemplateLiteralKind(contextToken.kind)) {
                    const start = contextToken.getStart();
                    const end = contextToken.getEnd();
                    // To be "in" one of these literals, the position has to be:
                    //   1. entirely within the token text.
                    //   2. at the end position of an unterminated token.
                    //   3. at the end of a regular expression (due to trailing flags like '/foo/g').
                    if (start < position && position < end) {
                        return true;
                    }
                    if (position === end) {
                        return !!contextToken.isUnterminated
                            || contextToken.kind === ts.SyntaxKind.RegularExpressionLiteral;
                    }
                }
                return false;
            }
            /**
             * Aggregates relevant symbols for completion in object literals and object binding patterns.
             * Relevant symbols are stored in the captured 'symbols' variable.
             *
             * @returns true if 'symbols' was successfully populated; false otherwise.
             */
            function tryGetObjectLikeCompletionSymbols() {
                const objectLikeContainer = tryGetObjectLikeCompletionContainer(contextToken);
                if (!objectLikeContainer)
                    return 0 /* Continue */;
                // We're looking up possible property names from contextual/inferred/declared type.
                completionKind = 0 /* ObjectPropertyDeclaration */;
                let typeMembers;
                let existingMembers;
                if (objectLikeContainer.kind === ts.SyntaxKind.ObjectLiteralExpression) {
                    const typeForObject = typeChecker.getContextualType(objectLikeContainer);
                    if (!typeForObject)
                        return 2 /* Fail */;
                    isNewIdentifierLocation = hasIndexSignature(typeForObject);
                    typeMembers = getPropertiesForCompletion(typeForObject, typeChecker, /*isForAccess*/ false);
                    existingMembers = objectLikeContainer.properties;
                }
                else {
                    ts.Debug.assert(objectLikeContainer.kind === ts.SyntaxKind.ObjectBindingPattern);
                    // We are *only* completing on properties from the type being destructured.
                    isNewIdentifierLocation = false;
                    const rootDeclaration = ts.getRootDeclaration(objectLikeContainer.parent);
                    if (!ts.isVariableLike(rootDeclaration))
                        return ts.Debug.fail("Root declaration is not variable-like.");
                    // We don't want to complete using the type acquired by the shape
                    // of the binding pattern; we are only interested in types acquired
                    // through type declaration or inference.
                    // Also proceed if rootDeclaration is a parameter and if its containing function expression/arrow function is contextually typed -
                    // type of parameter will flow in from the contextual type of the function
                    let canGetType = ts.hasInitializer(rootDeclaration) || ts.hasType(rootDeclaration) || rootDeclaration.parent.parent.kind === ts.SyntaxKind.ForOfStatement;
                    if (!canGetType && rootDeclaration.kind === ts.SyntaxKind.Parameter) {
                        if (ts.isExpression(rootDeclaration.parent)) {
                            canGetType = !!typeChecker.getContextualType(rootDeclaration.parent);
                        }
                        else if (rootDeclaration.parent.kind === ts.SyntaxKind.MethodDeclaration || rootDeclaration.parent.kind === ts.SyntaxKind.SetAccessor) {
                            canGetType = ts.isExpression(rootDeclaration.parent.parent) && !!typeChecker.getContextualType(rootDeclaration.parent.parent);
                        }
                    }
                    if (canGetType) {
                        const typeForObject = typeChecker.getTypeAtLocation(objectLikeContainer);
                        if (!typeForObject)
                            return 2 /* Fail */;
                        // In a binding pattern, get only known properties. Everywhere else we will get all possible properties.
                        typeMembers = typeChecker.getPropertiesOfType(typeForObject).filter((symbol) => !(ts.getDeclarationModifierFlagsFromSymbol(symbol) & ts.ModifierFlags.NonPublicAccessibilityModifier));
                        existingMembers = objectLikeContainer.elements;
                    }
                }
                if (typeMembers && typeMembers.length > 0) {
                    // Add filtered items to the completion list
                    symbols = filterObjectMembersList(typeMembers, ts.Debug.assertDefined(existingMembers));
                }
                return 1 /* Success */;
            }
            /**
             * Aggregates relevant symbols for completion in import clauses and export clauses
             * whose declarations have a module specifier; for instance, symbols will be aggregated for
             *
             *      import { | } from "moduleName";
             *      export { a as foo, | } from "moduleName";
             *
             * but not for
             *
             *      export { | };
             *
             * Relevant symbols are stored in the captured 'symbols' variable.
             *
             * @returns true if 'symbols' was successfully populated; false otherwise.
             */
            function tryGetImportOrExportClauseCompletionSymbols() {
                // `import { |` or `import { a as 0, | }`
                const namedImportsOrExports = contextToken && (contextToken.kind === ts.SyntaxKind.OpenBraceToken || contextToken.kind === ts.SyntaxKind.CommaToken)
                    ? ts.tryCast(contextToken.parent, ts.isNamedImportsOrExports) : undefined;
                if (!namedImportsOrExports)
                    return 0 /* Continue */;
                // cursor is in an import clause
                // try to show exported member for imported module
                const { moduleSpecifier } = namedImportsOrExports.kind === ts.SyntaxKind.NamedImports ? namedImportsOrExports.parent.parent : namedImportsOrExports.parent;
                const moduleSpecifierSymbol = typeChecker.getSymbolAtLocation(moduleSpecifier);
                if (!moduleSpecifierSymbol)
                    return 2 /* Fail */;
                completionKind = 3 /* MemberLike */;
                isNewIdentifierLocation = false;
                const exports = typeChecker.getExportsAndPropertiesOfModule(moduleSpecifierSymbol);
                const existing = ts.arrayToSet(namedImportsOrExports.elements, n => isCurrentlyEditingNode(n) ? undefined : (n.propertyName || n.name).escapedText);
                symbols = exports.filter(e => e.escapedName !== ts.InternalSymbolName.Default && !existing.get(e.escapedName));
                return 1 /* Success */;
            }
            /**
             * Aggregates relevant symbols for completion in class declaration
             * Relevant symbols are stored in the captured 'symbols' variable.
             */
            function tryGetClassLikeCompletionSymbols() {
                const decl = tryGetObjectTypeDeclarationCompletionContainer(sourceFile, contextToken, location);
                if (!decl)
                    return 0 /* Continue */;
                // We're looking up possible property names from parent type.
                completionKind = 3 /* MemberLike */;
                // Declaring new property/method/accessor
                isNewIdentifierLocation = true;
                keywordFilters = ts.isClassLike(decl) ? 1 /* ClassElementKeywords */ : 2 /* InterfaceElementKeywords */;
                // If you're in an interface you don't want to repeat things from super-interface. So just stop here.
                if (!ts.isClassLike(decl))
                    return 1 /* Success */;
                const classElement = contextToken.parent;
                let classElementModifierFlags = ts.isClassElement(classElement) && ts.getModifierFlags(classElement);
                // If this is context token is not something we are editing now, consider if this would lead to be modifier
                if (contextToken.kind === ts.SyntaxKind.Identifier && !isCurrentlyEditingNode(contextToken)) {
                    switch (contextToken.getText()) {
                        case "private":
                            classElementModifierFlags = classElementModifierFlags | ts.ModifierFlags.Private;
                            break;
                        case "static":
                            classElementModifierFlags = classElementModifierFlags | ts.ModifierFlags.Static;
                            break;
                    }
                }
                // No member list for private methods
                if (!(classElementModifierFlags & ts.ModifierFlags.Private)) {
                    // List of property symbols of base type that are not private and already implemented
                    const baseSymbols = ts.flatMap(ts.getAllSuperTypeNodes(decl), baseTypeNode => {
                        const type = typeChecker.getTypeAtLocation(baseTypeNode);
                        return typeChecker.getPropertiesOfType(classElementModifierFlags & ts.ModifierFlags.Static ? typeChecker.getTypeOfSymbolAtLocation(type.symbol, decl) : type);
                    });
                    symbols = filterClassMembersList(baseSymbols, decl.members, classElementModifierFlags);
                }
                return 1 /* Success */;
            }
            /**
             * Returns the immediate owning object literal or binding pattern of a context token,
             * on the condition that one exists and that the context implies completion should be given.
             */
            function tryGetObjectLikeCompletionContainer(contextToken) {
                if (contextToken) {
                    switch (contextToken.kind) {
                        case ts.SyntaxKind.OpenBraceToken: // const x = { |
                        case ts.SyntaxKind.CommaToken: // const x = { a: 0, |
                            const parent = contextToken.parent;
                            if (ts.isObjectLiteralExpression(parent) || ts.isObjectBindingPattern(parent)) {
                                return parent;
                            }
                            break;
                    }
                }
                return undefined;
            }
            function isConstructorParameterCompletion(node) {
                return !!node.parent && ts.isParameter(node.parent) && ts.isConstructorDeclaration(node.parent.parent)
                    && (ts.isParameterPropertyModifier(node.kind) || ts.isDeclarationName(node));
            }
            /**
             * Returns the immediate owning class declaration of a context token,
             * on the condition that one exists and that the context implies completion should be given.
             */
            function tryGetConstructorLikeCompletionContainer(contextToken) {
                if (contextToken) {
                    switch (contextToken.kind) {
                        case ts.SyntaxKind.OpenParenToken:
                        case ts.SyntaxKind.CommaToken:
                            return ts.isConstructorDeclaration(contextToken.parent) && contextToken.parent;
                        default:
                            if (isConstructorParameterCompletion(contextToken)) {
                                return contextToken.parent.parent;
                            }
                    }
                }
                return undefined;
            }
            function tryGetFunctionLikeBodyCompletionContainer(contextToken) {
                if (contextToken) {
                    let prev;
                    const container = ts.findAncestor(contextToken.parent, (node) => {
                        if (ts.isClassLike(node)) {
                            return "quit";
                        }
                        if (ts.isFunctionLikeDeclaration(node) && prev === node.body) {
                            return true;
                        }
                        prev = node;
                    });
                    return container && container;
                }
            }
            function tryGetContainingJsxElement(contextToken) {
                if (contextToken) {
                    const parent = contextToken.parent;
                    switch (contextToken.kind) {
                        case ts.SyntaxKind.LessThanSlashToken:
                        case ts.SyntaxKind.SlashToken:
                        case ts.SyntaxKind.Identifier:
                        case ts.SyntaxKind.PropertyAccessExpression:
                        case ts.SyntaxKind.JsxAttributes:
                        case ts.SyntaxKind.JsxAttribute:
                        case ts.SyntaxKind.JsxSpreadAttribute:
                            if (parent && (parent.kind === ts.SyntaxKind.JsxSelfClosingElement || parent.kind === ts.SyntaxKind.JsxOpeningElement)) {
                                return parent;
                            }
                            else if (parent.kind === ts.SyntaxKind.JsxAttribute) {
                                // Currently we parse JsxOpeningLikeElement as:
                                //      JsxOpeningLikeElement
                                //          attributes: JsxAttributes
                                //             properties: NodeArray<JsxAttributeLike>
                                return parent.parent.parent;
                            }
                            break;
                        // The context token is the closing } or " of an attribute, which means
                        // its parent is a JsxExpression, whose parent is a JsxAttribute,
                        // whose parent is a JsxOpeningLikeElement
                        case ts.SyntaxKind.StringLiteral:
                            if (parent && ((parent.kind === ts.SyntaxKind.JsxAttribute) || (parent.kind === ts.SyntaxKind.JsxSpreadAttribute))) {
                                // Currently we parse JsxOpeningLikeElement as:
                                //      JsxOpeningLikeElement
                                //          attributes: JsxAttributes
                                //             properties: NodeArray<JsxAttributeLike>
                                return parent.parent.parent;
                            }
                            break;
                        case ts.SyntaxKind.CloseBraceToken:
                            if (parent &&
                                parent.kind === ts.SyntaxKind.JsxExpression &&
                                parent.parent && parent.parent.kind === ts.SyntaxKind.JsxAttribute) {
                                // Currently we parse JsxOpeningLikeElement as:
                                //      JsxOpeningLikeElement
                                //          attributes: JsxAttributes
                                //             properties: NodeArray<JsxAttributeLike>
                                //                  each JsxAttribute can have initializer as JsxExpression
                                return parent.parent.parent.parent;
                            }
                            if (parent && parent.kind === ts.SyntaxKind.JsxSpreadAttribute) {
                                // Currently we parse JsxOpeningLikeElement as:
                                //      JsxOpeningLikeElement
                                //          attributes: JsxAttributes
                                //             properties: NodeArray<JsxAttributeLike>
                                return parent.parent.parent;
                            }
                            break;
                    }
                }
                return undefined;
            }
            /**
             * @returns true if we are certain that the currently edited location must define a new location; false otherwise.
             */
            function isSolelyIdentifierDefinitionLocation(contextToken) {
                const containingNodeKind = contextToken.parent.kind;
                switch (contextToken.kind) {
                    case ts.SyntaxKind.CommaToken:
                        return containingNodeKind === ts.SyntaxKind.VariableDeclaration ||
                            containingNodeKind === ts.SyntaxKind.VariableDeclarationList ||
                            containingNodeKind === ts.SyntaxKind.VariableStatement ||
                            containingNodeKind === ts.SyntaxKind.EnumDeclaration || // enum a { foo, |
                            isFunctionLikeButNotConstructor(containingNodeKind) ||
                            containingNodeKind === ts.SyntaxKind.InterfaceDeclaration || // interface A<T, |
                            containingNodeKind === ts.SyntaxKind.ArrayBindingPattern || // var [x, y|
                            containingNodeKind === ts.SyntaxKind.TypeAliasDeclaration || // type Map, K, |
                            // class A<T, |
                            // var C = class D<T, |
                            (ts.isClassLike(contextToken.parent) &&
                                contextToken.parent.typeParameters &&
                                contextToken.parent.typeParameters.end >= contextToken.pos);
                    case ts.SyntaxKind.DotToken:
                        return containingNodeKind === ts.SyntaxKind.ArrayBindingPattern; // var [.|
                    case ts.SyntaxKind.ColonToken:
                        return containingNodeKind === ts.SyntaxKind.BindingElement; // var {x :html|
                    case ts.SyntaxKind.OpenBracketToken:
                        return containingNodeKind === ts.SyntaxKind.ArrayBindingPattern; // var [x|
                    case ts.SyntaxKind.OpenParenToken:
                        return containingNodeKind === ts.SyntaxKind.CatchClause ||
                            isFunctionLikeButNotConstructor(containingNodeKind);
                    case ts.SyntaxKind.OpenBraceToken:
                        return containingNodeKind === ts.SyntaxKind.EnumDeclaration; // enum a { |
                    case ts.SyntaxKind.LessThanToken:
                        return containingNodeKind === ts.SyntaxKind.ClassDeclaration || // class A< |
                            containingNodeKind === ts.SyntaxKind.ClassExpression || // var C = class D< |
                            containingNodeKind === ts.SyntaxKind.InterfaceDeclaration || // interface A< |
                            containingNodeKind === ts.SyntaxKind.TypeAliasDeclaration || // type List< |
                            ts.isFunctionLikeKind(containingNodeKind);
                    case ts.SyntaxKind.StaticKeyword:
                        return containingNodeKind === ts.SyntaxKind.PropertyDeclaration && !ts.isClassLike(contextToken.parent.parent);
                    case ts.SyntaxKind.DotDotDotToken:
                        return containingNodeKind === ts.SyntaxKind.Parameter ||
                            (contextToken.parent && contextToken.parent.parent &&
                                contextToken.parent.parent.kind === ts.SyntaxKind.ArrayBindingPattern); // var [...z|
                    case ts.SyntaxKind.PublicKeyword:
                    case ts.SyntaxKind.PrivateKeyword:
                    case ts.SyntaxKind.ProtectedKeyword:
                        return containingNodeKind === ts.SyntaxKind.Parameter && !ts.isConstructorDeclaration(contextToken.parent.parent);
                    case ts.SyntaxKind.AsKeyword:
                        return containingNodeKind === ts.SyntaxKind.ImportSpecifier ||
                            containingNodeKind === ts.SyntaxKind.ExportSpecifier ||
                            containingNodeKind === ts.SyntaxKind.NamespaceImport;
                    case ts.SyntaxKind.GetKeyword:
                    case ts.SyntaxKind.SetKeyword:
                        if (isFromObjectTypeDeclaration(contextToken)) {
                            return false;
                        }
                    // falls through
                    case ts.SyntaxKind.ClassKeyword:
                    case ts.SyntaxKind.EnumKeyword:
                    case ts.SyntaxKind.InterfaceKeyword:
                    case ts.SyntaxKind.FunctionKeyword:
                    case ts.SyntaxKind.VarKeyword:
                    case ts.SyntaxKind.ImportKeyword:
                    case ts.SyntaxKind.LetKeyword:
                    case ts.SyntaxKind.ConstKeyword:
                    case ts.SyntaxKind.YieldKeyword:
                    case ts.SyntaxKind.TypeKeyword: // type htm|
                        return true;
                }
                // If the previous token is keyword correspoding to class member completion keyword
                // there will be completion available here
                if (isClassMemberCompletionKeyword(keywordForNode(contextToken)) && isFromObjectTypeDeclaration(contextToken)) {
                    return false;
                }
                if (isConstructorParameterCompletion(contextToken)) {
                    // constructor parameter completion is available only if
                    // - its modifier of the constructor parameter or
                    // - its name of the parameter and not being edited
                    // eg. constructor(a |<- this shouldnt show completion
                    if (!ts.isIdentifier(contextToken) ||
                        ts.isParameterPropertyModifier(keywordForNode(contextToken)) ||
                        isCurrentlyEditingNode(contextToken)) {
                        return false;
                    }
                }
                // Previous token may have been a keyword that was converted to an identifier.
                switch (keywordForNode(contextToken)) {
                    case ts.SyntaxKind.AbstractKeyword:
                    case ts.SyntaxKind.AsyncKeyword:
                    case ts.SyntaxKind.ClassKeyword:
                    case ts.SyntaxKind.ConstKeyword:
                    case ts.SyntaxKind.DeclareKeyword:
                    case ts.SyntaxKind.EnumKeyword:
                    case ts.SyntaxKind.FunctionKeyword:
                    case ts.SyntaxKind.InterfaceKeyword:
                    case ts.SyntaxKind.LetKeyword:
                    case ts.SyntaxKind.PrivateKeyword:
                    case ts.SyntaxKind.ProtectedKeyword:
                    case ts.SyntaxKind.PublicKeyword:
                    case ts.SyntaxKind.StaticKeyword:
                    case ts.SyntaxKind.VarKeyword:
                    case ts.SyntaxKind.YieldKeyword:
                        return true;
                }
                return ts.isDeclarationName(contextToken)
                    && !ts.isJsxAttribute(contextToken.parent)
                    // Don't block completions if we're in `class C /**/`, because we're *past* the end of the identifier and might want to complete `extends`.
                    // If `contextToken !== previousToken`, this is `class C ex/**/`.
                    && !(ts.isClassLike(contextToken.parent) && (contextToken !== previousToken || position > previousToken.end));
            }
            function isFunctionLikeButNotConstructor(kind) {
                return ts.isFunctionLikeKind(kind) && kind !== ts.SyntaxKind.Constructor;
            }
            function isDotOfNumericLiteral(contextToken) {
                if (contextToken.kind === ts.SyntaxKind.NumericLiteral) {
                    const text = contextToken.getFullText();
                    return text.charAt(text.length - 1) === ".";
                }
                return false;
            }
            /**
             * Filters out completion suggestions for named imports or exports.
             *
             * @returns Symbols to be suggested in an object binding pattern or object literal expression, barring those whose declarations
             *          do not occur at the current position and have not otherwise been typed.
             */
            function filterObjectMembersList(contextualMemberSymbols, existingMembers) {
                if (existingMembers.length === 0) {
                    return contextualMemberSymbols;
                }
                const existingMemberNames = ts.createUnderscoreEscapedMap();
                for (const m of existingMembers) {
                    // Ignore omitted expressions for missing members
                    if (m.kind !== ts.SyntaxKind.PropertyAssignment &&
                        m.kind !== ts.SyntaxKind.ShorthandPropertyAssignment &&
                        m.kind !== ts.SyntaxKind.BindingElement &&
                        m.kind !== ts.SyntaxKind.MethodDeclaration &&
                        m.kind !== ts.SyntaxKind.GetAccessor &&
                        m.kind !== ts.SyntaxKind.SetAccessor) {
                        continue;
                    }
                    // If this is the current item we are editing right now, do not filter it out
                    if (isCurrentlyEditingNode(m)) {
                        continue;
                    }
                    let existingName;
                    if (m.kind === ts.SyntaxKind.BindingElement && m.propertyName) {
                        // include only identifiers in completion list
                        if (m.propertyName.kind === ts.SyntaxKind.Identifier) {
                            existingName = m.propertyName.escapedText;
                        }
                    }
                    else {
                        // TODO: Account for computed property name
                        // NOTE: if one only performs this step when m.name is an identifier,
                        // things like '__proto__' are not filtered out.
                        const name = ts.getNameOfDeclaration(m);
                        existingName = ts.isPropertyNameLiteral(name) ? ts.getEscapedTextOfIdentifierOrLiteral(name) : undefined;
                    }
                    existingMemberNames.set(existingName, true);
                }
                return contextualMemberSymbols.filter(m => !existingMemberNames.get(m.escapedName));
            }
            /**
             * Filters out completion suggestions for class elements.
             *
             * @returns Symbols to be suggested in an class element depending on existing memebers and symbol flags
             */
            function filterClassMembersList(baseSymbols, existingMembers, currentClassElementModifierFlags) {
                const existingMemberNames = ts.createUnderscoreEscapedMap();
                for (const m of existingMembers) {
                    // Ignore omitted expressions for missing members
                    if (m.kind !== ts.SyntaxKind.PropertyDeclaration &&
                        m.kind !== ts.SyntaxKind.MethodDeclaration &&
                        m.kind !== ts.SyntaxKind.GetAccessor &&
                        m.kind !== ts.SyntaxKind.SetAccessor) {
                        continue;
                    }
                    // If this is the current item we are editing right now, do not filter it out
                    if (isCurrentlyEditingNode(m)) {
                        continue;
                    }
                    // Dont filter member even if the name matches if it is declared private in the list
                    if (ts.hasModifier(m, ts.ModifierFlags.Private)) {
                        continue;
                    }
                    // do not filter it out if the static presence doesnt match
                    if (ts.hasModifier(m, ts.ModifierFlags.Static) !== !!(currentClassElementModifierFlags & ts.ModifierFlags.Static)) {
                        continue;
                    }
                    const existingName = ts.getPropertyNameForPropertyNameNode(m.name);
                    if (existingName) {
                        existingMemberNames.set(existingName, true);
                    }
                }
                return baseSymbols.filter(propertySymbol => !existingMemberNames.has(propertySymbol.escapedName) &&
                    !!propertySymbol.declarations &&
                    !(ts.getDeclarationModifierFlagsFromSymbol(propertySymbol) & ts.ModifierFlags.Private));
            }
            /**
             * Filters out completion suggestions from 'symbols' according to existing JSX attributes.
             *
             * @returns Symbols to be suggested in a JSX element, barring those whose attributes
             *          do not occur at the current position and have not otherwise been typed.
             */
            function filterJsxAttributes(symbols, attributes) {
                const seenNames = ts.createUnderscoreEscapedMap();
                for (const attr of attributes) {
                    // If this is the current item we are editing right now, do not filter it out
                    if (isCurrentlyEditingNode(attr)) {
                        continue;
                    }
                    if (attr.kind === ts.SyntaxKind.JsxAttribute) {
                        seenNames.set(attr.name.escapedText, true);
                    }
                }
                return symbols.filter(a => !seenNames.get(a.escapedName));
            }
            function isCurrentlyEditingNode(node) {
                return node.getStart(sourceFile) <= position && position <= node.getEnd();
            }
        }
        function getCompletionEntryDisplayNameForSymbol(symbol, target, origin, kind) {
            const name = getSymbolName(symbol, origin, target);
            if (name === undefined
                // If the symbol is external module, don't show it in the completion list
                // (i.e declare module "http" { const x; } | // <= request completion here, "http" should not be there)
                || symbol.flags & ts.SymbolFlags.Module && ts.startsWithQuote(name)
                // If the symbol is the internal name of an ES symbol, it is not a valid entry. Internal names for ES symbols start with "__@"
                || ts.isKnownSymbol(symbol)) {
                return undefined;
            }
            const validIdentiferResult = { name, needsConvertPropertyAccess: false };
            if (ts.isIdentifierText(name, target))
                return validIdentiferResult;
            switch (kind) {
                case 3 /* MemberLike */:
                    return undefined;
                case 0 /* ObjectPropertyDeclaration */:
                    // TODO: GH#18169
                    return { name: JSON.stringify(name), needsConvertPropertyAccess: false };
                case 2 /* PropertyAccess */:
                case 1 /* Global */: // For a 'this.' completion it will be in a global context, but may have a non-identifier name.
                    // Don't add a completion for a name starting with a space. See https://github.com/Microsoft/TypeScript/pull/20547
                    return name.charCodeAt(0) === 32 /* space */ ? undefined : { name, needsConvertPropertyAccess: true };
                case 5 /* None */:
                case 4 /* String */:
                    return validIdentiferResult;
                default:
                    ts.Debug.assertNever(kind);
            }
        }
        // A cache of completion entries for keywords, these do not change between sessions
        const _keywordCompletions = [];
        const allKeywordsCompletions = ts.memoize(() => {
            const res = [];
            for (let i = ts.SyntaxKind.FirstKeyword; i <= ts.SyntaxKind.LastKeyword; i++) {
                res.push({
                    name: ts.tokenToString(i),
                    kind: ts.ScriptElementKind.keyword,
                    kindModifiers: ts.ScriptElementKindModifier.none,
                    sortText: "0"
                });
            }
            return res;
        });
        function getKeywordCompletions(keywordFilter) {
            return _keywordCompletions[keywordFilter] || (_keywordCompletions[keywordFilter] = allKeywordsCompletions().filter(entry => {
                const kind = ts.stringToToken(entry.name);
                switch (keywordFilter) {
                    case 0 /* None */:
                        // "undefined" is a global variable, so don't need a keyword completion for it.
                        return kind !== ts.SyntaxKind.UndefinedKeyword;
                    case 1 /* ClassElementKeywords */:
                        return isClassMemberCompletionKeyword(kind);
                    case 2 /* InterfaceElementKeywords */:
                        return isInterfaceOrTypeLiteralCompletionKeyword(kind);
                    case 3 /* ConstructorParameterKeywords */:
                        return ts.isParameterPropertyModifier(kind);
                    case 4 /* FunctionLikeBodyKeywords */:
                        return !isClassMemberCompletionKeyword(kind);
                    case 5 /* TypeKeywords */:
                        return ts.isTypeKeyword(kind);
                    default:
                        return ts.Debug.assertNever(keywordFilter);
                }
            }));
        }
        function isInterfaceOrTypeLiteralCompletionKeyword(kind) {
            return kind === ts.SyntaxKind.ReadonlyKeyword;
        }
        function isClassMemberCompletionKeyword(kind) {
            switch (kind) {
                case ts.SyntaxKind.AbstractKeyword:
                case ts.SyntaxKind.ConstructorKeyword:
                case ts.SyntaxKind.GetKeyword:
                case ts.SyntaxKind.SetKeyword:
                case ts.SyntaxKind.AsyncKeyword:
                    return true;
                default:
                    return ts.isClassMemberModifier(kind);
            }
        }
        function keywordForNode(node) {
            return ts.isIdentifier(node) ? node.originalKeywordKind || ts.SyntaxKind.Unknown : node.kind;
        }
        function isEqualityOperatorKind(kind) {
            switch (kind) {
                case ts.SyntaxKind.EqualsEqualsEqualsToken:
                case ts.SyntaxKind.EqualsEqualsToken:
                case ts.SyntaxKind.ExclamationEqualsEqualsToken:
                case ts.SyntaxKind.ExclamationEqualsToken:
                    return true;
                default:
                    return false;
            }
        }
        /** Get the corresponding JSDocTag node if the position is in a jsDoc comment */
        function getJsDocTagAtPosition(node, position) {
            const { jsDoc } = getJsDocHavingNode(node);
            if (!jsDoc)
                return undefined;
            for (const { pos, end, tags } of jsDoc) {
                if (!tags || position < pos || position > end)
                    continue;
                for (let i = tags.length - 1; i >= 0; i--) {
                    const tag = tags[i];
                    if (position >= tag.pos) {
                        return tag;
                    }
                }
            }
        }
        function getJsDocHavingNode(node) {
            if (!ts.isToken(node))
                return node;
            switch (node.kind) {
                case ts.SyntaxKind.VarKeyword:
                case ts.SyntaxKind.LetKeyword:
                case ts.SyntaxKind.ConstKeyword:
                    // if the current token is var, let or const, skip the VariableDeclarationList
                    return node.parent.parent;
                default:
                    return node.parent;
            }
        }
        /**
         * Gets all properties on a type, but if that type is a union of several types,
         * excludes array-like types or callable/constructable types.
         */
        function getPropertiesForCompletion(type, checker, isForAccess) {
            if (!(type.isUnion())) {
                return ts.Debug.assertEachDefined(type.getApparentProperties(), "getApparentProperties() should all be defined");
            }
            // If we're providing completions for an object literal, skip primitive, array-like, or callable types since those shouldn't be implemented by object literals.
            const filteredTypes = isForAccess ? type.types : type.types.filter(memberType => !(memberType.flags & ts.TypeFlags.Primitive || checker.isArrayLikeType(memberType) || ts.typeHasCallOrConstructSignatures(memberType, checker)));
            return ts.Debug.assertEachDefined(checker.getAllPossiblePropertiesOfTypes(filteredTypes), "getAllPossiblePropertiesOfTypes() should all be defined");
        }
        /**
         * Returns the immediate owning class declaration of a context token,
         * on the condition that one exists and that the context implies completion should be given.
         */
        function tryGetObjectTypeDeclarationCompletionContainer(sourceFile, contextToken, location) {
            // class c { method() { } | method2() { } }
            switch (location.kind) {
                case ts.SyntaxKind.SyntaxList:
                    return ts.tryCast(location.parent, ts.isObjectTypeDeclaration);
                case ts.SyntaxKind.EndOfFileToken:
                    const cls = ts.tryCast(ts.lastOrUndefined(ts.cast(location.parent, ts.isSourceFile).statements), ts.isObjectTypeDeclaration);
                    if (cls && !ts.findChildOfKind(cls, ts.SyntaxKind.CloseBraceToken, sourceFile)) {
                        return cls;
                    }
            }
            if (!contextToken)
                return undefined;
            switch (contextToken.kind) {
                case ts.SyntaxKind.SemicolonToken: // class c {getValue(): number; | }
                case ts.SyntaxKind.CloseBraceToken: // class c { method() { } | }
                    // class c { method() { } b| }
                    return isFromObjectTypeDeclaration(location) && location.parent.name === location
                        ? location.parent.parent
                        : ts.tryCast(location, ts.isObjectTypeDeclaration);
                case ts.SyntaxKind.OpenBraceToken: // class c { |
                case ts.SyntaxKind.CommaToken: // class c {getValue(): number, | }
                    return ts.tryCast(contextToken.parent, ts.isObjectTypeDeclaration);
                default:
                    if (!isFromObjectTypeDeclaration(contextToken))
                        return undefined;
                    const isValidKeyword = ts.isClassLike(contextToken.parent.parent) ? isClassMemberCompletionKeyword : isInterfaceOrTypeLiteralCompletionKeyword;
                    return (isValidKeyword(contextToken.kind) || ts.isIdentifier(contextToken) && isValidKeyword(ts.stringToToken(contextToken.text)))
                        ? contextToken.parent.parent : undefined;
            }
        }
        // TODO: GH#19856 Would like to return `node is Node & { parent: (ClassElement | TypeElement) & { parent: ObjectTypeDeclaration } }` but then compilation takes > 10 minutes
        function isFromObjectTypeDeclaration(node) {
            return node.parent && ts.isClassOrTypeElement(node.parent) && ts.isObjectTypeDeclaration(node.parent.parent);
        }
        function hasIndexSignature(type) {
            return !!type.getStringIndexType() || !!type.getNumberIndexType();
        }
        function isValidTrigger(sourceFile, triggerCharacter, contextToken, position) {
            switch (triggerCharacter) {
                case '"':
                case "'":
                case "`":
                    // Only automatically bring up completions if this is an opening quote.
                    return isStringLiteralOrTemplate(contextToken) && position === contextToken.getStart(sourceFile) + 1;
                case "<":
                    // Opening JSX tag
                    return contextToken.kind === ts.SyntaxKind.LessThanToken && contextToken.parent.kind !== ts.SyntaxKind.BinaryExpression;
                default:
                    return ts.Debug.fail(triggerCharacter);
            }
        }
        function isStringLiteralOrTemplate(node) {
            switch (node.kind) {
                case ts.SyntaxKind.StringLiteral:
                case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
                case ts.SyntaxKind.TemplateExpression:
                case ts.SyntaxKind.TaggedTemplateExpression:
                    return true;
                default:
                    return false;
            }
        }
    })(Completions = ts.Completions || (ts.Completions = {}));
})(ts || (ts = {}));
