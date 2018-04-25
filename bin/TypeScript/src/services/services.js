var ts;
(function (ts) {
    /** The version of the language service API */
    ts.servicesVersion = "0.8";
    function createNode(kind, pos, end, parent) {
        const node = ts.isNodeKind(kind) ? new NodeObject(kind, pos, end) :
            kind === ts.SyntaxKind.Identifier ? new IdentifierObject(ts.SyntaxKind.Identifier, pos, end) :
                new TokenObject(kind, pos, end);
        node.parent = parent;
        node.flags = parent.flags & ts.NodeFlags.ContextFlags;
        return node;
    }
    class NodeObject {
        constructor(kind, pos, end) {
            this.pos = pos;
            this.end = end;
            this.flags = ts.NodeFlags.None;
            this.transformFlags = undefined;
            this.parent = undefined;
            this.kind = kind;
        }
        assertHasRealPosition(message) {
            // tslint:disable-next-line:debug-assert
            ts.Debug.assert(!ts.positionIsSynthesized(this.pos) && !ts.positionIsSynthesized(this.end), message || "Node must have a real position for this operation");
        }
        getSourceFile() {
            return ts.getSourceFileOfNode(this);
        }
        getStart(sourceFile, includeJsDocComment) {
            this.assertHasRealPosition();
            return ts.getTokenPosOfNode(this, sourceFile, includeJsDocComment);
        }
        getFullStart() {
            this.assertHasRealPosition();
            return this.pos;
        }
        getEnd() {
            this.assertHasRealPosition();
            return this.end;
        }
        getWidth(sourceFile) {
            this.assertHasRealPosition();
            return this.getEnd() - this.getStart(sourceFile);
        }
        getFullWidth() {
            this.assertHasRealPosition();
            return this.end - this.pos;
        }
        getLeadingTriviaWidth(sourceFile) {
            this.assertHasRealPosition();
            return this.getStart(sourceFile) - this.pos;
        }
        getFullText(sourceFile) {
            this.assertHasRealPosition();
            return (sourceFile || this.getSourceFile()).text.substring(this.pos, this.end);
        }
        getText(sourceFile) {
            this.assertHasRealPosition();
            if (!sourceFile) {
                sourceFile = this.getSourceFile();
            }
            return sourceFile.text.substring(this.getStart(sourceFile), this.getEnd());
        }
        getChildCount(sourceFile) {
            return this.getChildren(sourceFile).length;
        }
        getChildAt(index, sourceFile) {
            return this.getChildren(sourceFile)[index];
        }
        getChildren(sourceFile) {
            this.assertHasRealPosition("Node without a real position cannot be scanned and thus has no token nodes - use forEachChild and collect the result if that's fine");
            return this._children || (this._children = createChildren(this, sourceFile));
        }
        getFirstToken(sourceFile) {
            this.assertHasRealPosition();
            const children = this.getChildren(sourceFile);
            if (!children.length) {
                return undefined;
            }
            const child = ts.find(children, kid => kid.kind < ts.SyntaxKind.FirstJSDocNode || kid.kind > ts.SyntaxKind.LastJSDocNode);
            return child.kind < ts.SyntaxKind.FirstNode ?
                child :
                child.getFirstToken(sourceFile);
        }
        getLastToken(sourceFile) {
            this.assertHasRealPosition();
            const children = this.getChildren(sourceFile);
            const child = ts.lastOrUndefined(children);
            if (!child) {
                return undefined;
            }
            return child.kind < ts.SyntaxKind.FirstNode ? child : child.getLastToken(sourceFile);
        }
        forEachChild(cbNode, cbNodeArray) {
            return ts.forEachChild(this, cbNode, cbNodeArray);
        }
    }
    function createChildren(node, sourceFile) {
        if (!ts.isNodeKind(node.kind)) {
            return ts.emptyArray;
        }
        const children = [];
        if (ts.isJSDocCommentContainingNode(node)) {
            /** Don't add trivia for "tokens" since this is in a comment. */
            node.forEachChild(child => { children.push(child); });
            return children;
        }
        ts.scanner.setText((sourceFile || node.getSourceFile()).text);
        let pos = node.pos;
        const processNode = (child) => {
            addSyntheticNodes(children, pos, child.pos, node);
            children.push(child);
            pos = child.end;
        };
        const processNodes = (nodes) => {
            addSyntheticNodes(children, pos, nodes.pos, node);
            children.push(createSyntaxList(nodes, node));
            pos = nodes.end;
        };
        // jsDocComments need to be the first children
        ts.forEach(node.jsDoc, processNode);
        // For syntactic classifications, all trivia are classified together, including jsdoc comments.
        // For that to work, the jsdoc comments should still be the leading trivia of the first child.
        // Restoring the scanner position ensures that.
        pos = node.pos;
        node.forEachChild(processNode, processNodes);
        addSyntheticNodes(children, pos, node.end, node);
        ts.scanner.setText(undefined);
        return children;
    }
    function addSyntheticNodes(nodes, pos, end, parent) {
        ts.scanner.setTextPos(pos);
        while (pos < end) {
            const token = ts.scanner.scan();
            const textPos = ts.scanner.getTextPos();
            if (textPos <= end) {
                if (token === ts.SyntaxKind.Identifier) {
                    ts.Debug.fail(`Did not expect ${ts.Debug.showSyntaxKind(parent)} to have an Identifier in its trivia`);
                }
                nodes.push(createNode(token, pos, textPos, parent));
            }
            pos = textPos;
            if (token === ts.SyntaxKind.EndOfFileToken) {
                break;
            }
        }
    }
    function createSyntaxList(nodes, parent) {
        const list = createNode(ts.SyntaxKind.SyntaxList, nodes.pos, nodes.end, parent);
        list._children = [];
        let pos = nodes.pos;
        for (const node of nodes) {
            addSyntheticNodes(list._children, pos, node.pos, parent);
            list._children.push(node);
            pos = node.end;
        }
        addSyntheticNodes(list._children, pos, nodes.end, parent);
        return list;
    }
    class TokenOrIdentifierObject {
        constructor(pos, end) {
            // Set properties in same order as NodeObject
            this.pos = pos;
            this.end = end;
            this.flags = ts.NodeFlags.None;
            this.parent = undefined;
        }
        getSourceFile() {
            return ts.getSourceFileOfNode(this);
        }
        getStart(sourceFile, includeJsDocComment) {
            return ts.getTokenPosOfNode(this, sourceFile, includeJsDocComment);
        }
        getFullStart() {
            return this.pos;
        }
        getEnd() {
            return this.end;
        }
        getWidth(sourceFile) {
            return this.getEnd() - this.getStart(sourceFile);
        }
        getFullWidth() {
            return this.end - this.pos;
        }
        getLeadingTriviaWidth(sourceFile) {
            return this.getStart(sourceFile) - this.pos;
        }
        getFullText(sourceFile) {
            return (sourceFile || this.getSourceFile()).text.substring(this.pos, this.end);
        }
        getText(sourceFile) {
            if (!sourceFile) {
                sourceFile = this.getSourceFile();
            }
            return sourceFile.text.substring(this.getStart(sourceFile), this.getEnd());
        }
        getChildCount() {
            return 0;
        }
        getChildAt() {
            return undefined;
        }
        getChildren() {
            return ts.emptyArray;
        }
        getFirstToken() {
            return undefined;
        }
        getLastToken() {
            return undefined;
        }
        forEachChild() {
            return undefined;
        }
    }
    class SymbolObject {
        constructor(flags, name) {
            this.flags = flags;
            this.escapedName = name;
        }
        getFlags() {
            return this.flags;
        }
        get name() {
            return ts.symbolName(this);
        }
        getEscapedName() {
            return this.escapedName;
        }
        getName() {
            return this.name;
        }
        getDeclarations() {
            return this.declarations;
        }
        getDocumentationComment(checker) {
            if (!this.documentationComment) {
                this.documentationComment = ts.emptyArray; // Set temporarily to avoid an infinite loop finding inherited docs
                this.documentationComment = getDocumentationComment(this.declarations, checker);
            }
            return this.documentationComment;
        }
        getJsDocTags() {
            if (this.tags === undefined) {
                this.tags = ts.JsDoc.getJsDocTagsFromDeclarations(this.declarations);
            }
            return this.tags;
        }
    }
    class TokenObject extends TokenOrIdentifierObject {
        constructor(kind, pos, end) {
            super(pos, end);
            this.kind = kind;
        }
    }
    class IdentifierObject extends TokenOrIdentifierObject {
        constructor(_kind, pos, end) {
            super(pos, end);
        }
        get text() {
            return ts.idText(this);
        }
    }
    IdentifierObject.prototype.kind = ts.SyntaxKind.Identifier;
    class TypeObject {
        constructor(checker, flags) {
            this.checker = checker;
            this.flags = flags;
        }
        getFlags() {
            return this.flags;
        }
        getSymbol() {
            return this.symbol;
        }
        getProperties() {
            return this.checker.getPropertiesOfType(this);
        }
        getProperty(propertyName) {
            return this.checker.getPropertyOfType(this, propertyName);
        }
        getApparentProperties() {
            return this.checker.getAugmentedPropertiesOfType(this);
        }
        getCallSignatures() {
            return this.checker.getSignaturesOfType(this, ts.SignatureKind.Call);
        }
        getConstructSignatures() {
            return this.checker.getSignaturesOfType(this, ts.SignatureKind.Construct);
        }
        getStringIndexType() {
            return this.checker.getIndexTypeOfType(this, ts.IndexKind.String);
        }
        getNumberIndexType() {
            return this.checker.getIndexTypeOfType(this, ts.IndexKind.Number);
        }
        getBaseTypes() {
            return this.isClassOrInterface() ? this.checker.getBaseTypes(this) : undefined;
        }
        getNonNullableType() {
            return this.checker.getNonNullableType(this);
        }
        getConstraint() {
            return this.checker.getBaseConstraintOfType(this);
        }
        getDefault() {
            return this.checker.getDefaultFromTypeParameter(this);
        }
        isUnion() {
            return !!(this.flags & ts.TypeFlags.Union);
        }
        isIntersection() {
            return !!(this.flags & ts.TypeFlags.Intersection);
        }
        isUnionOrIntersection() {
            return !!(this.flags & ts.TypeFlags.UnionOrIntersection);
        }
        isLiteral() {
            return !!(this.flags & ts.TypeFlags.Literal);
        }
        isStringLiteral() {
            return !!(this.flags & ts.TypeFlags.StringLiteral);
        }
        isNumberLiteral() {
            return !!(this.flags & ts.TypeFlags.NumberLiteral);
        }
        isTypeParameter() {
            return !!(this.flags & ts.TypeFlags.TypeParameter);
        }
        isClassOrInterface() {
            return !!(ts.getObjectFlags(this) & ts.ObjectFlags.ClassOrInterface);
        }
        isClass() {
            return !!(ts.getObjectFlags(this) & ts.ObjectFlags.Class);
        }
    }
    class SignatureObject {
        constructor(checker) {
            this.checker = checker;
        }
        getDeclaration() {
            return this.declaration;
        }
        getTypeParameters() {
            return this.typeParameters;
        }
        getParameters() {
            return this.parameters;
        }
        getReturnType() {
            return this.checker.getReturnTypeOfSignature(this);
        }
        getDocumentationComment() {
            return this.documentationComment || (this.documentationComment = getDocumentationComment(ts.singleElementArray(this.declaration), this.checker));
        }
        getJsDocTags() {
            if (this.jsDocTags === undefined) {
                this.jsDocTags = this.declaration ? ts.JsDoc.getJsDocTagsFromDeclarations([this.declaration]) : [];
            }
            return this.jsDocTags;
        }
    }
    /**
     * Returns whether or not the given node has a JSDoc "inheritDoc" tag on it.
     * @param node the Node in question.
     * @returns `true` if `node` has a JSDoc "inheritDoc" tag on it, otherwise `false`.
     */
    function hasJSDocInheritDocTag(node) {
        return ts.getJSDocTags(node).some(tag => tag.tagName.text === "inheritDoc");
    }
    function getDocumentationComment(declarations, checker) {
        if (!declarations)
            return ts.emptyArray;
        let doc = ts.JsDoc.getJsDocCommentsFromDeclarations(declarations);
        if (doc.length === 0 || declarations.some(hasJSDocInheritDocTag)) {
            for (const declaration of declarations) {
                const inheritedDocs = findInheritedJSDocComments(declaration, declaration.symbol.name, checker);
                // TODO: GH#16312 Return a ReadonlyArray, avoid copying inheritedDocs
                if (inheritedDocs)
                    doc = doc.length === 0 ? inheritedDocs.slice() : inheritedDocs.concat(ts.lineBreakPart(), doc);
            }
        }
        return doc;
    }
    /**
     * Attempts to find JSDoc comments for possibly-inherited properties.  Checks superclasses then traverses
     * implemented interfaces until a symbol is found with the same name and with documentation.
     * @param declaration The possibly-inherited declaration to find comments for.
     * @param propertyName The name of the possibly-inherited property.
     * @param typeChecker A TypeChecker, used to find inherited properties.
     * @returns A filled array of documentation comments if any were found, otherwise an empty array.
     */
    function findInheritedJSDocComments(declaration, propertyName, typeChecker) {
        return ts.firstDefined(declaration.parent ? ts.getAllSuperTypeNodes(declaration.parent) : ts.emptyArray, superTypeNode => {
            const superType = typeChecker.getTypeAtLocation(superTypeNode);
            const baseProperty = superType && typeChecker.getPropertyOfType(superType, propertyName);
            const inheritedDocs = baseProperty && baseProperty.getDocumentationComment(typeChecker);
            return inheritedDocs && inheritedDocs.length ? inheritedDocs : undefined;
        });
    }
    class SourceFileObject extends NodeObject {
        constructor(kind, pos, end) {
            super(kind, pos, end);
        }
        update(newText, textChangeRange) {
            return ts.updateSourceFile(this, newText, textChangeRange);
        }
        getLineAndCharacterOfPosition(position) {
            return ts.getLineAndCharacterOfPosition(this, position);
        }
        getLineStarts() {
            return ts.getLineStarts(this);
        }
        getPositionOfLineAndCharacter(line, character) {
            return ts.getPositionOfLineAndCharacter(this, line, character);
        }
        getLineEndOfPosition(pos) {
            const { line } = this.getLineAndCharacterOfPosition(pos);
            const lineStarts = this.getLineStarts();
            let lastCharPos;
            if (line + 1 >= lineStarts.length) {
                lastCharPos = this.getEnd();
            }
            if (!lastCharPos) {
                lastCharPos = lineStarts[line + 1] - 1;
            }
            const fullText = this.getFullText();
            // if the new line is "\r\n", we should return the last non-new-line-character position
            return fullText[lastCharPos] === "\n" && fullText[lastCharPos - 1] === "\r" ? lastCharPos - 1 : lastCharPos;
        }
        getNamedDeclarations() {
            if (!this.namedDeclarations) {
                this.namedDeclarations = this.computeNamedDeclarations();
            }
            return this.namedDeclarations;
        }
        computeNamedDeclarations() {
            const result = ts.createMultiMap();
            ts.forEachChild(this, visit);
            return result;
            function addDeclaration(declaration) {
                const name = getDeclarationName(declaration);
                if (name) {
                    result.add(name, declaration);
                }
            }
            function getDeclarations(name) {
                let declarations = result.get(name);
                if (!declarations) {
                    result.set(name, declarations = []);
                }
                return declarations;
            }
            function getDeclarationName(declaration) {
                const name = ts.getNameOfDeclaration(declaration);
                return name && (ts.isComputedPropertyName(name) && ts.isPropertyAccessExpression(name.expression) ? name.expression.name.text
                    : ts.isPropertyName(name) ? ts.getNameFromPropertyName(name) : undefined);
            }
            function visit(node) {
                switch (node.kind) {
                    case ts.SyntaxKind.FunctionDeclaration:
                    case ts.SyntaxKind.FunctionExpression:
                    case ts.SyntaxKind.MethodDeclaration:
                    case ts.SyntaxKind.MethodSignature:
                        const functionDeclaration = node;
                        const declarationName = getDeclarationName(functionDeclaration);
                        if (declarationName) {
                            const declarations = getDeclarations(declarationName);
                            const lastDeclaration = ts.lastOrUndefined(declarations);
                            // Check whether this declaration belongs to an "overload group".
                            if (lastDeclaration && functionDeclaration.parent === lastDeclaration.parent && functionDeclaration.symbol === lastDeclaration.symbol) {
                                // Overwrite the last declaration if it was an overload
                                // and this one is an implementation.
                                if (functionDeclaration.body && !lastDeclaration.body) {
                                    declarations[declarations.length - 1] = functionDeclaration;
                                }
                            }
                            else {
                                declarations.push(functionDeclaration);
                            }
                        }
                        ts.forEachChild(node, visit);
                        break;
                    case ts.SyntaxKind.ClassDeclaration:
                    case ts.SyntaxKind.ClassExpression:
                    case ts.SyntaxKind.InterfaceDeclaration:
                    case ts.SyntaxKind.TypeAliasDeclaration:
                    case ts.SyntaxKind.EnumDeclaration:
                    case ts.SyntaxKind.ModuleDeclaration:
                    case ts.SyntaxKind.ImportEqualsDeclaration:
                    case ts.SyntaxKind.ExportSpecifier:
                    case ts.SyntaxKind.ImportSpecifier:
                    case ts.SyntaxKind.ImportClause:
                    case ts.SyntaxKind.NamespaceImport:
                    case ts.SyntaxKind.GetAccessor:
                    case ts.SyntaxKind.SetAccessor:
                    case ts.SyntaxKind.TypeLiteral:
                        addDeclaration(node);
                        ts.forEachChild(node, visit);
                        break;
                    case ts.SyntaxKind.Parameter:
                        // Only consider parameter properties
                        if (!ts.hasModifier(node, ts.ModifierFlags.ParameterPropertyModifier)) {
                            break;
                        }
                    // falls through
                    case ts.SyntaxKind.VariableDeclaration:
                    case ts.SyntaxKind.BindingElement: {
                        const decl = node;
                        if (ts.isBindingPattern(decl.name)) {
                            ts.forEachChild(decl.name, visit);
                            break;
                        }
                        if (decl.initializer) {
                            visit(decl.initializer);
                        }
                    }
                    // falls through
                    case ts.SyntaxKind.EnumMember:
                    case ts.SyntaxKind.PropertyDeclaration:
                    case ts.SyntaxKind.PropertySignature:
                        addDeclaration(node);
                        break;
                    case ts.SyntaxKind.ExportDeclaration:
                        // Handle named exports case e.g.:
                        //    export {a, b as B} from "mod";
                        if (node.exportClause) {
                            ts.forEach(node.exportClause.elements, visit);
                        }
                        break;
                    case ts.SyntaxKind.ImportDeclaration:
                        const importClause = node.importClause;
                        if (importClause) {
                            // Handle default import case e.g.:
                            //    import d from "mod";
                            if (importClause.name) {
                                addDeclaration(importClause);
                            }
                            // Handle named bindings in imports e.g.:
                            //    import * as NS from "mod";
                            //    import {a, b as B} from "mod";
                            if (importClause.namedBindings) {
                                if (importClause.namedBindings.kind === ts.SyntaxKind.NamespaceImport) {
                                    addDeclaration(importClause.namedBindings);
                                }
                                else {
                                    ts.forEach(importClause.namedBindings.elements, visit);
                                }
                            }
                        }
                        break;
                    case ts.SyntaxKind.BinaryExpression:
                        if (ts.getSpecialPropertyAssignmentKind(node) !== 0 /* None */) {
                            addDeclaration(node);
                        }
                    // falls through
                    default:
                        ts.forEachChild(node, visit);
                }
            }
        }
    }
    class SourceMapSourceObject {
        constructor(fileName, text, skipTrivia) {
            this.fileName = fileName;
            this.text = text;
            this.skipTrivia = skipTrivia;
        }
        getLineAndCharacterOfPosition(pos) {
            return ts.getLineAndCharacterOfPosition(this, pos);
        }
    }
    function getServicesObjectAllocator() {
        return {
            getNodeConstructor: () => NodeObject,
            getTokenConstructor: () => TokenObject,
            getIdentifierConstructor: () => IdentifierObject,
            getSourceFileConstructor: () => SourceFileObject,
            getSymbolConstructor: () => SymbolObject,
            getTypeConstructor: () => TypeObject,
            getSignatureConstructor: () => SignatureObject,
            getSourceMapSourceConstructor: () => SourceMapSourceObject,
        };
    }
    function toEditorSettings(optionsAsMap) {
        let allPropertiesAreCamelCased = true;
        for (const key in optionsAsMap) {
            if (ts.hasProperty(optionsAsMap, key) && !isCamelCase(key)) {
                allPropertiesAreCamelCased = false;
                break;
            }
        }
        if (allPropertiesAreCamelCased) {
            return optionsAsMap;
        }
        const settings = {};
        for (const key in optionsAsMap) {
            if (ts.hasProperty(optionsAsMap, key)) {
                const newKey = isCamelCase(key) ? key : key.charAt(0).toLowerCase() + key.substr(1);
                settings[newKey] = optionsAsMap[key];
            }
        }
        return settings;
    }
    ts.toEditorSettings = toEditorSettings;
    function isCamelCase(s) {
        return !s.length || s.charAt(0) === s.charAt(0).toLowerCase();
    }
    function displayPartsToString(displayParts) {
        if (displayParts) {
            return ts.map(displayParts, displayPart => displayPart.text).join("");
        }
        return "";
    }
    ts.displayPartsToString = displayPartsToString;
    function getDefaultCompilerOptions() {
        // Always default to "ScriptTarget.ES5" for the language service
        return {
            target: ts.ScriptTarget.ES5,
            jsx: ts.JsxEmit.Preserve
        };
    }
    ts.getDefaultCompilerOptions = getDefaultCompilerOptions;
    function getSupportedCodeFixes() {
        return ts.codefix.getSupportedErrorCodes();
    }
    ts.getSupportedCodeFixes = getSupportedCodeFixes;
    // Cache host information about script Should be refreshed
    // at each language service public entry point, since we don't know when
    // the set of scripts handled by the host changes.
    class HostCache {
        constructor(host, getCanonicalFileName) {
            this.host = host;
            // script id => script index
            this.currentDirectory = host.getCurrentDirectory();
            this.fileNameToEntry = ts.createMap();
            // Initialize the list with the root file names
            const rootFileNames = host.getScriptFileNames();
            for (const fileName of rootFileNames) {
                this.createEntry(fileName, ts.toPath(fileName, this.currentDirectory, getCanonicalFileName));
            }
            // store the compilation settings
            this._compilationSettings = host.getCompilationSettings() || getDefaultCompilerOptions();
        }
        compilationSettings() {
            return this._compilationSettings;
        }
        createEntry(fileName, path) {
            let entry;
            const scriptSnapshot = this.host.getScriptSnapshot(fileName);
            if (scriptSnapshot) {
                entry = {
                    hostFileName: fileName,
                    version: this.host.getScriptVersion(fileName),
                    scriptSnapshot,
                    scriptKind: ts.getScriptKind(fileName, this.host)
                };
            }
            else {
                entry = fileName;
            }
            this.fileNameToEntry.set(path, entry);
            return entry;
        }
        getEntryByPath(path) {
            return this.fileNameToEntry.get(path);
        }
        getHostFileInformation(path) {
            const entry = this.fileNameToEntry.get(path);
            return !ts.isString(entry) ? entry : undefined;
        }
        getOrCreateEntryByPath(fileName, path) {
            const info = this.getEntryByPath(path) || this.createEntry(fileName, path);
            return ts.isString(info) ? undefined : info;
        }
        getRootFileNames() {
            return ts.arrayFrom(this.fileNameToEntry.values(), entry => {
                return ts.isString(entry) ? entry : entry.hostFileName;
            });
        }
        getVersion(path) {
            const file = this.getHostFileInformation(path);
            return file && file.version;
        }
        getScriptSnapshot(path) {
            const file = this.getHostFileInformation(path);
            return file && file.scriptSnapshot;
        }
    }
    class SyntaxTreeCache {
        constructor(host) {
            this.host = host;
        }
        getCurrentSourceFile(fileName) {
            const scriptSnapshot = this.host.getScriptSnapshot(fileName);
            if (!scriptSnapshot) {
                // The host does not know about this file.
                throw new Error("Could not find file: '" + fileName + "'.");
            }
            const scriptKind = ts.getScriptKind(fileName, this.host);
            const version = this.host.getScriptVersion(fileName);
            let sourceFile;
            if (this.currentFileName !== fileName) {
                // This is a new file, just parse it
                sourceFile = createLanguageServiceSourceFile(fileName, scriptSnapshot, ts.ScriptTarget.Latest, version, /*setNodeParents*/ true, scriptKind);
            }
            else if (this.currentFileVersion !== version) {
                // This is the same file, just a newer version. Incrementally parse the file.
                const editRange = scriptSnapshot.getChangeRange(this.currentFileScriptSnapshot);
                sourceFile = updateLanguageServiceSourceFile(this.currentSourceFile, scriptSnapshot, version, editRange);
            }
            if (sourceFile) {
                // All done, ensure state is up to date
                this.currentFileVersion = version;
                this.currentFileName = fileName;
                this.currentFileScriptSnapshot = scriptSnapshot;
                this.currentSourceFile = sourceFile;
            }
            return this.currentSourceFile;
        }
    }
    function setSourceFileFields(sourceFile, scriptSnapshot, version) {
        sourceFile.version = version;
        sourceFile.scriptSnapshot = scriptSnapshot;
    }
    function createLanguageServiceSourceFile(fileName, scriptSnapshot, scriptTarget, version, setNodeParents, scriptKind) {
        const sourceFile = ts.createSourceFile(fileName, ts.getSnapshotText(scriptSnapshot), scriptTarget, setNodeParents, scriptKind);
        setSourceFileFields(sourceFile, scriptSnapshot, version);
        return sourceFile;
    }
    ts.createLanguageServiceSourceFile = createLanguageServiceSourceFile;
    ts.disableIncrementalParsing = false;
    function updateLanguageServiceSourceFile(sourceFile, scriptSnapshot, version, textChangeRange, aggressiveChecks) {
        // If we were given a text change range, and our version or open-ness changed, then
        // incrementally parse this file.
        if (textChangeRange) {
            if (version !== sourceFile.version) {
                // Once incremental parsing is ready, then just call into this function.
                if (!ts.disableIncrementalParsing) {
                    let newText;
                    // grab the fragment from the beginning of the original text to the beginning of the span
                    const prefix = textChangeRange.span.start !== 0
                        ? sourceFile.text.substr(0, textChangeRange.span.start)
                        : "";
                    // grab the fragment from the end of the span till the end of the original text
                    const suffix = ts.textSpanEnd(textChangeRange.span) !== sourceFile.text.length
                        ? sourceFile.text.substr(ts.textSpanEnd(textChangeRange.span))
                        : "";
                    if (textChangeRange.newLength === 0) {
                        // edit was a deletion - just combine prefix and suffix
                        newText = prefix && suffix ? prefix + suffix : prefix || suffix;
                    }
                    else {
                        // it was actual edit, fetch the fragment of new text that correspond to new span
                        const changedText = scriptSnapshot.getText(textChangeRange.span.start, textChangeRange.span.start + textChangeRange.newLength);
                        // combine prefix, changed text and suffix
                        newText = prefix && suffix
                            ? prefix + changedText + suffix
                            : prefix
                                ? (prefix + changedText)
                                : (changedText + suffix);
                    }
                    const newSourceFile = ts.updateSourceFile(sourceFile, newText, textChangeRange, aggressiveChecks);
                    setSourceFileFields(newSourceFile, scriptSnapshot, version);
                    // after incremental parsing nameTable might not be up-to-date
                    // drop it so it can be lazily recreated later
                    newSourceFile.nameTable = undefined;
                    // dispose all resources held by old script snapshot
                    if (sourceFile !== newSourceFile && sourceFile.scriptSnapshot) {
                        if (sourceFile.scriptSnapshot.dispose) {
                            sourceFile.scriptSnapshot.dispose();
                        }
                        sourceFile.scriptSnapshot = undefined;
                    }
                    return newSourceFile;
                }
            }
        }
        // Otherwise, just create a new source file.
        return createLanguageServiceSourceFile(sourceFile.fileName, scriptSnapshot, sourceFile.languageVersion, version, /*setNodeParents*/ true, sourceFile.scriptKind);
    }
    ts.updateLanguageServiceSourceFile = updateLanguageServiceSourceFile;
    class CancellationTokenObject {
        constructor(cancellationToken) {
            this.cancellationToken = cancellationToken;
        }
        isCancellationRequested() {
            return this.cancellationToken && this.cancellationToken.isCancellationRequested();
        }
        throwIfCancellationRequested() {
            if (this.isCancellationRequested()) {
                throw new ts.OperationCanceledException();
            }
        }
    }
    /* @internal */
    /** A cancellation that throttles calls to the host */
    class ThrottledCancellationToken {
        constructor(hostCancellationToken, throttleWaitMilliseconds = 20) {
            this.hostCancellationToken = hostCancellationToken;
            this.throttleWaitMilliseconds = throttleWaitMilliseconds;
            // Store when we last tried to cancel.  Checking cancellation can be expensive (as we have
            // to marshall over to the host layer).  So we only bother actually checking once enough
            // time has passed.
            this.lastCancellationCheckTime = 0;
        }
        isCancellationRequested() {
            const time = ts.timestamp();
            const duration = Math.abs(time - this.lastCancellationCheckTime);
            if (duration >= this.throttleWaitMilliseconds) {
                // Check no more than once every throttle wait milliseconds
                this.lastCancellationCheckTime = time;
                return this.hostCancellationToken.isCancellationRequested();
            }
            return false;
        }
        throwIfCancellationRequested() {
            if (this.isCancellationRequested()) {
                throw new ts.OperationCanceledException();
            }
        }
    }
    ts.ThrottledCancellationToken = ThrottledCancellationToken;
    /* @internal */
    function createSourceFileLikeCache(host) {
        const cached = ts.createMap();
        return {
            get(path) {
                if (cached.has(path)) {
                    return cached.get(path);
                }
                if (!host.fileExists || !host.readFile || !host.fileExists(path))
                    return;
                // And failing that, check the disk
                const text = host.readFile(path);
                const file = {
                    text,
                    lineMap: undefined,
                    getLineAndCharacterOfPosition(pos) {
                        return ts.computeLineAndCharacterOfPosition(ts.getLineStarts(this), pos);
                    }
                };
                cached.set(path, file);
                return file;
            }
        };
    }
    ts.createSourceFileLikeCache = createSourceFileLikeCache;
    function createLanguageService(host, documentRegistry = ts.createDocumentRegistry(host.useCaseSensitiveFileNames && host.useCaseSensitiveFileNames(), host.getCurrentDirectory()), syntaxOnly = false) {
        const syntaxTreeCache = new SyntaxTreeCache(host);
        let program;
        let lastProjectVersion;
        let lastTypesRootVersion = 0;
        const cancellationToken = new CancellationTokenObject(host.getCancellationToken && host.getCancellationToken());
        const currentDirectory = host.getCurrentDirectory();
        // Check if the localized messages json is set, otherwise query the host for it
        if (!ts.localizedDiagnosticMessages && host.getLocalizedDiagnosticMessages) {
            ts.localizedDiagnosticMessages = host.getLocalizedDiagnosticMessages();
        }
        let sourcemappedFileCache;
        function log(message) {
            if (host.log) {
                host.log(message);
            }
        }
        const useCaseSensitiveFileNames = ts.hostUsesCaseSensitiveFileNames(host);
        const getCanonicalFileName = ts.createGetCanonicalFileName(useCaseSensitiveFileNames);
        function getValidSourceFile(fileName) {
            const sourceFile = program.getSourceFile(fileName);
            if (!sourceFile) {
                throw new Error("Could not find file: '" + fileName + "'.");
            }
            return sourceFile;
        }
        function synchronizeHostData() {
            ts.Debug.assert(!syntaxOnly);
            // perform fast check if host supports it
            if (host.getProjectVersion) {
                const hostProjectVersion = host.getProjectVersion();
                if (hostProjectVersion) {
                    if (lastProjectVersion === hostProjectVersion && !host.hasChangedAutomaticTypeDirectiveNames) {
                        return;
                    }
                    lastProjectVersion = hostProjectVersion;
                }
            }
            const typeRootsVersion = host.getTypeRootsVersion ? host.getTypeRootsVersion() : 0;
            if (lastTypesRootVersion !== typeRootsVersion) {
                log("TypeRoots version has changed; provide new program");
                program = undefined;
                lastTypesRootVersion = typeRootsVersion;
            }
            // Get a fresh cache of the host information
            let hostCache = new HostCache(host, getCanonicalFileName);
            const rootFileNames = hostCache.getRootFileNames();
            const hasInvalidatedResolution = host.hasInvalidatedResolution || ts.returnFalse;
            // If the program is already up-to-date, we can reuse it
            if (ts.isProgramUptoDate(program, rootFileNames, hostCache.compilationSettings(), path => hostCache.getVersion(path), fileExists, hasInvalidatedResolution, host.hasChangedAutomaticTypeDirectiveNames)) {
                return;
            }
            // IMPORTANT - It is critical from this moment onward that we do not check
            // cancellation tokens.  We are about to mutate source files from a previous program
            // instance.  If we cancel midway through, we may end up in an inconsistent state where
            // the program points to old source files that have been invalidated because of
            // incremental parsing.
            const newSettings = hostCache.compilationSettings();
            // Now create a new compiler
            const compilerHost = {
                getSourceFile: getOrCreateSourceFile,
                getSourceFileByPath: getOrCreateSourceFileByPath,
                getCancellationToken: () => cancellationToken,
                getCanonicalFileName,
                useCaseSensitiveFileNames: () => useCaseSensitiveFileNames,
                getNewLine: () => ts.getNewLineCharacter(newSettings, () => ts.getNewLineOrDefaultFromHost(host)),
                getDefaultLibFileName: (options) => host.getDefaultLibFileName(options),
                writeFile: ts.noop,
                getCurrentDirectory: () => currentDirectory,
                fileExists,
                readFile(fileName) {
                    // stub missing host functionality
                    const path = ts.toPath(fileName, currentDirectory, getCanonicalFileName);
                    const entry = hostCache.getEntryByPath(path);
                    if (entry) {
                        return ts.isString(entry) ? undefined : ts.getSnapshotText(entry.scriptSnapshot);
                    }
                    return host.readFile && host.readFile(fileName);
                },
                realpath: host.realpath && (path => host.realpath(path)),
                directoryExists: directoryName => {
                    return ts.directoryProbablyExists(directoryName, host);
                },
                getDirectories: path => {
                    return host.getDirectories ? host.getDirectories(path) : [];
                },
                onReleaseOldSourceFile,
                hasInvalidatedResolution,
                hasChangedAutomaticTypeDirectiveNames: host.hasChangedAutomaticTypeDirectiveNames
            };
            if (host.trace) {
                compilerHost.trace = message => host.trace(message);
            }
            if (host.resolveModuleNames) {
                compilerHost.resolveModuleNames = (moduleNames, containingFile, reusedNames) => host.resolveModuleNames(moduleNames, containingFile, reusedNames);
            }
            if (host.resolveTypeReferenceDirectives) {
                compilerHost.resolveTypeReferenceDirectives = (typeReferenceDirectiveNames, containingFile) => {
                    return host.resolveTypeReferenceDirectives(typeReferenceDirectiveNames, containingFile);
                };
            }
            const documentRegistryBucketKey = documentRegistry.getKeyForCompilationSettings(newSettings);
            program = ts.createProgram(rootFileNames, newSettings, compilerHost, program);
            // hostCache is captured in the closure for 'getOrCreateSourceFile' but it should not be used past this point.
            // It needs to be cleared to allow all collected snapshots to be released
            hostCache = undefined;
            // We reset this cache on structure invalidation so we don't hold on to outdated files for long; however we can't use the `compilerHost` above,
            // Because it only functions until `hostCache` is cleared, while we'll potentially need the functionality to lazily read sourcemap files during
            // the course of whatever called `synchronizeHostData`
            sourcemappedFileCache = createSourceFileLikeCache(host);
            // Make sure all the nodes in the program are both bound, and have their parent
            // pointers set property.
            program.getTypeChecker();
            return;
            function fileExists(fileName) {
                const path = ts.toPath(fileName, currentDirectory, getCanonicalFileName);
                const entry = hostCache.getEntryByPath(path);
                return entry ?
                    !ts.isString(entry) :
                    (host.fileExists && host.fileExists(fileName));
            }
            // Release any files we have acquired in the old program but are
            // not part of the new program.
            function onReleaseOldSourceFile(oldSourceFile, oldOptions) {
                const oldSettingsKey = documentRegistry.getKeyForCompilationSettings(oldOptions);
                documentRegistry.releaseDocumentWithKey(oldSourceFile.path, oldSettingsKey);
            }
            function getOrCreateSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile) {
                return getOrCreateSourceFileByPath(fileName, ts.toPath(fileName, currentDirectory, getCanonicalFileName), languageVersion, onError, shouldCreateNewSourceFile);
            }
            function getOrCreateSourceFileByPath(fileName, path, _languageVersion, _onError, shouldCreateNewSourceFile) {
                ts.Debug.assert(hostCache !== undefined);
                // The program is asking for this file, check first if the host can locate it.
                // If the host can not locate the file, then it does not exist. return undefined
                // to the program to allow reporting of errors for missing files.
                const hostFileInformation = hostCache.getOrCreateEntryByPath(fileName, path);
                if (!hostFileInformation) {
                    return undefined;
                }
                // Check if the language version has changed since we last created a program; if they are the same,
                // it is safe to reuse the sourceFiles; if not, then the shape of the AST can change, and the oldSourceFile
                // can not be reused. we have to dump all syntax trees and create new ones.
                if (!shouldCreateNewSourceFile) {
                    // Check if the old program had this file already
                    const oldSourceFile = program && program.getSourceFileByPath(path);
                    if (oldSourceFile) {
                        // We already had a source file for this file name.  Go to the registry to
                        // ensure that we get the right up to date version of it.  We need this to
                        // address the following race-condition.  Specifically, say we have the following:
                        //
                        //      LS1
                        //          \
                        //           DocumentRegistry
                        //          /
                        //      LS2
                        //
                        // Each LS has a reference to file 'foo.ts' at version 1.  LS2 then updates
                        // it's version of 'foo.ts' to version 2.  This will cause LS2 and the
                        // DocumentRegistry to have version 2 of the document.  HOwever, LS1 will
                        // have version 1.  And *importantly* this source file will be *corrupt*.
                        // The act of creating version 2 of the file irrevocably damages the version
                        // 1 file.
                        //
                        // So, later when we call into LS1, we need to make sure that it doesn't use
                        // it's source file any more, and instead defers to DocumentRegistry to get
                        // either version 1, version 2 (or some other version) depending on what the
                        // host says should be used.
                        // We do not support the scenario where a host can modify a registered
                        // file's script kind, i.e. in one project some file is treated as ".ts"
                        // and in another as ".js"
                        ts.Debug.assertEqual(hostFileInformation.scriptKind, oldSourceFile.scriptKind, "Registered script kind should match new script kind.", path);
                        return documentRegistry.updateDocumentWithKey(fileName, path, newSettings, documentRegistryBucketKey, hostFileInformation.scriptSnapshot, hostFileInformation.version, hostFileInformation.scriptKind);
                    }
                    // We didn't already have the file.  Fall through and acquire it from the registry.
                }
                // Could not find this file in the old program, create a new SourceFile for it.
                return documentRegistry.acquireDocumentWithKey(fileName, path, newSettings, documentRegistryBucketKey, hostFileInformation.scriptSnapshot, hostFileInformation.version, hostFileInformation.scriptKind);
            }
        }
        function getProgram() {
            if (syntaxOnly) {
                ts.Debug.assert(program === undefined);
                return undefined;
            }
            synchronizeHostData();
            return program;
        }
        function cleanupSemanticCache() {
            program = undefined;
        }
        function dispose() {
            if (program) {
                ts.forEach(program.getSourceFiles(), f => documentRegistry.releaseDocument(f.fileName, program.getCompilerOptions()));
                program = undefined;
            }
            host = undefined;
        }
        /// Diagnostics
        function getSyntacticDiagnostics(fileName) {
            synchronizeHostData();
            return program.getSyntacticDiagnostics(getValidSourceFile(fileName), cancellationToken).slice();
        }
        /**
         * getSemanticDiagnostics return array of Diagnostics. If '-d' is not enabled, only report semantic errors
         * If '-d' enabled, report both semantic and emitter errors
         */
        function getSemanticDiagnostics(fileName) {
            synchronizeHostData();
            const targetSourceFile = getValidSourceFile(fileName);
            // Only perform the action per file regardless of '-out' flag as LanguageServiceHost is expected to call this function per file.
            // Therefore only get diagnostics for given file.
            const semanticDiagnostics = program.getSemanticDiagnostics(targetSourceFile, cancellationToken);
            if (!program.getCompilerOptions().declaration) {
                return semanticDiagnostics.slice();
            }
            // If '-d' is enabled, check for emitter error. One example of emitter error is export class implements non-export interface
            const declarationDiagnostics = program.getDeclarationDiagnostics(targetSourceFile, cancellationToken);
            return [...semanticDiagnostics, ...declarationDiagnostics];
        }
        function getSuggestionDiagnostics(fileName) {
            synchronizeHostData();
            return ts.computeSuggestionDiagnostics(getValidSourceFile(fileName), program);
        }
        function getCompilerOptionsDiagnostics() {
            synchronizeHostData();
            return [...program.getOptionsDiagnostics(cancellationToken), ...program.getGlobalDiagnostics(cancellationToken)];
        }
        function getCompletionsAtPosition(fileName, position, options = ts.defaultPreferences) {
            // Convert from deprecated options names to new names
            const fullPreferences = Object.assign({}, ts.identity(options), { includeCompletionsForModuleExports: options.includeCompletionsForModuleExports || options.includeExternalModuleExports, includeCompletionsWithInsertText: options.includeCompletionsWithInsertText || options.includeInsertTextCompletions });
            synchronizeHostData();
            return ts.Completions.getCompletionsAtPosition(host, program, log, getValidSourceFile(fileName), position, fullPreferences, options.triggerCharacter);
        }
        function getCompletionEntryDetails(fileName, position, name, formattingOptions, source, preferences = ts.defaultPreferences) {
            synchronizeHostData();
            return ts.Completions.getCompletionEntryDetails(program, log, getValidSourceFile(fileName), position, { name, source }, host, formattingOptions && ts.formatting.getFormatContext(formattingOptions), getCanonicalFileName, preferences);
        }
        function getCompletionEntrySymbol(fileName, position, name, source) {
            synchronizeHostData();
            return ts.Completions.getCompletionEntrySymbol(program, log, getValidSourceFile(fileName), position, { name, source });
        }
        function getQuickInfoAtPosition(fileName, position) {
            synchronizeHostData();
            const sourceFile = getValidSourceFile(fileName);
            const node = ts.getTouchingPropertyName(sourceFile, position, /*includeJsDocComment*/ true);
            if (node === sourceFile) {
                // Avoid giving quickInfo for the sourceFile as a whole.
                return undefined;
            }
            const typeChecker = program.getTypeChecker();
            const symbol = getSymbolAtLocationForQuickInfo(node, typeChecker);
            if (!symbol || typeChecker.isUnknownSymbol(symbol)) {
                // Try getting just type at this position and show
                switch (node.kind) {
                    case ts.SyntaxKind.Identifier:
                        if (ts.isLabelName(node)) {
                            // Type here will be 'any', avoid displaying this.
                            return undefined;
                        }
                    // falls through
                    case ts.SyntaxKind.PropertyAccessExpression:
                    case ts.SyntaxKind.QualifiedName:
                    case ts.SyntaxKind.ThisKeyword:
                    case ts.SyntaxKind.ThisType:
                    case ts.SyntaxKind.SuperKeyword:
                        // For the identifiers/this/super etc get the type at position
                        const type = typeChecker.getTypeAtLocation(node);
                        return type && {
                            kind: ts.ScriptElementKind.unknown,
                            kindModifiers: ts.ScriptElementKindModifier.none,
                            textSpan: ts.createTextSpanFromNode(node, sourceFile),
                            displayParts: ts.typeToDisplayParts(typeChecker, type, ts.getContainerNode(node)),
                            documentation: type.symbol ? type.symbol.getDocumentationComment(typeChecker) : undefined,
                            tags: type.symbol ? type.symbol.getJsDocTags() : undefined
                        };
                }
                return undefined;
            }
            const { symbolKind, displayParts, documentation, tags } = ts.SymbolDisplay.getSymbolDisplayPartsDocumentationAndSymbolKind(typeChecker, symbol, sourceFile, ts.getContainerNode(node), node);
            return {
                kind: symbolKind,
                kindModifiers: ts.SymbolDisplay.getSymbolModifiers(symbol),
                textSpan: ts.createTextSpanFromNode(node, sourceFile),
                displayParts,
                documentation,
                tags,
            };
        }
        function getSymbolAtLocationForQuickInfo(node, checker) {
            if ((ts.isIdentifier(node) || ts.isStringLiteral(node))
                && ts.isPropertyAssignment(node.parent)
                && node.parent.name === node) {
                const type = checker.getContextualType(node.parent.parent);
                const property = type && checker.getPropertyOfType(type, ts.getTextOfIdentifierOrLiteral(node));
                if (property) {
                    return property;
                }
            }
            return checker.getSymbolAtLocation(node);
        }
        // Sometimes tools can sometimes see the following line as a source mapping url comment, so we mangle it a bit (the [M])
        const sourceMapCommentRegExp = /^\/\/[@#] source[M]appingURL=(.+)$/gm;
        const base64UrlRegExp = /^data:(?:application\/json(?:;charset=[uU][tT][fF]-8);base64,([A-Za-z0-9+\/=]+)$)?/;
        function scanForSourcemapURL(fileName) {
            const mappedFile = sourcemappedFileCache.get(ts.toPath(fileName, currentDirectory, getCanonicalFileName));
            if (!mappedFile) {
                return;
            }
            const starts = ts.getLineStarts(mappedFile);
            for (let index = starts.length - 1; index >= 0; index--) {
                sourceMapCommentRegExp.lastIndex = starts[index];
                const comment = sourceMapCommentRegExp.exec(mappedFile.text);
                if (comment) {
                    return comment[1];
                }
            }
        }
        function convertDocumentToSourceMapper(file, contents, mapFileName) {
            let maps;
            try {
                maps = JSON.parse(contents);
            }
            catch (_b) {
                // swallow error
            }
            if (!maps || !maps.sources || !maps.file || !maps.mappings) {
                // obviously invalid map
                return file.sourceMapper = ts.sourcemaps.identitySourceMapper;
            }
            return file.sourceMapper = ts.sourcemaps.decode({
                readFile: s => host.readFile(s),
                fileExists: s => host.fileExists(s),
                getCanonicalFileName,
                log,
            }, mapFileName, maps, program, sourcemappedFileCache);
        }
        function getSourceMapper(fileName, file) {
            if (!host.readFile || !host.fileExists) {
                return file.sourceMapper = ts.sourcemaps.identitySourceMapper;
            }
            if (file.sourceMapper) {
                return file.sourceMapper;
            }
            let mapFileName = scanForSourcemapURL(fileName);
            if (mapFileName) {
                const match = base64UrlRegExp.exec(mapFileName);
                if (match) {
                    if (match[1]) {
                        const base64Object = match[1];
                        return convertDocumentToSourceMapper(file, ts.base64decode(ts.sys, base64Object), fileName);
                    }
                    // Not a data URL we can parse, skip it
                    mapFileName = undefined;
                }
            }
            const possibleMapLocations = [];
            if (mapFileName) {
                possibleMapLocations.push(mapFileName);
            }
            possibleMapLocations.push(fileName + ".map");
            for (const location of possibleMapLocations) {
                const mapPath = ts.toPath(location, ts.getDirectoryPath(fileName), getCanonicalFileName);
                if (host.fileExists(mapPath)) {
                    return convertDocumentToSourceMapper(file, host.readFile(mapPath), mapPath);
                }
            }
            return file.sourceMapper = ts.sourcemaps.identitySourceMapper;
        }
        function makeGetTargetOfMappedPosition(extract, create) {
            return getTargetOfMappedPosition;
            function getTargetOfMappedPosition(input) {
                const info = extract(input);
                if (ts.endsWith(info.fileName, ts.Extension.Dts)) {
                    let file = program.getSourceFile(info.fileName);
                    if (!file) {
                        const path = ts.toPath(info.fileName, currentDirectory, getCanonicalFileName);
                        file = sourcemappedFileCache.get(path);
                    }
                    if (!file) {
                        return input;
                    }
                    const mapper = getSourceMapper(info.fileName, file);
                    const newLoc = mapper.getOriginalPosition(info);
                    if (newLoc === info)
                        return input;
                    return getTargetOfMappedPosition(create(newLoc, input));
                }
                return input;
            }
        }
        const getTargetOfMappedDeclarationInfo = makeGetTargetOfMappedPosition((info) => ({ fileName: info.fileName, position: info.textSpan.start }), (newLoc, info) => ({
            containerKind: info.containerKind,
            containerName: info.containerName,
            fileName: newLoc.fileName,
            kind: info.kind,
            name: info.name,
            textSpan: {
                start: newLoc.position,
                length: info.textSpan.length
            }
        }));
        function getTargetOfMappedDeclarationFiles(infos) {
            return ts.map(infos, getTargetOfMappedDeclarationInfo);
        }
        /// Goto definition
        function getDefinitionAtPosition(fileName, position) {
            synchronizeHostData();
            return getTargetOfMappedDeclarationFiles(ts.GoToDefinition.getDefinitionAtPosition(program, getValidSourceFile(fileName), position));
        }
        function getDefinitionAndBoundSpan(fileName, position) {
            synchronizeHostData();
            const result = ts.GoToDefinition.getDefinitionAndBoundSpan(program, getValidSourceFile(fileName), position);
            if (!result)
                return result;
            const mappedDefs = getTargetOfMappedDeclarationFiles(result.definitions);
            if (mappedDefs === result.definitions) {
                return result;
            }
            return {
                definitions: mappedDefs,
                textSpan: result.textSpan
            };
        }
        function getTypeDefinitionAtPosition(fileName, position) {
            synchronizeHostData();
            return getTargetOfMappedDeclarationFiles(ts.GoToDefinition.getTypeDefinitionAtPosition(program.getTypeChecker(), getValidSourceFile(fileName), position));
        }
        /// Goto implementation
        const getTargetOfMappedImplementationLocation = makeGetTargetOfMappedPosition((info) => ({ fileName: info.fileName, position: info.textSpan.start }), (newLoc, info) => ({
            fileName: newLoc.fileName,
            kind: info.kind,
            displayParts: info.displayParts,
            textSpan: {
                start: newLoc.position,
                length: info.textSpan.length
            }
        }));
        function getTargetOfMappedImplementationLocations(infos) {
            return ts.map(infos, getTargetOfMappedImplementationLocation);
        }
        function getImplementationAtPosition(fileName, position) {
            synchronizeHostData();
            return getTargetOfMappedImplementationLocations(ts.FindAllReferences.getImplementationsAtPosition(program, cancellationToken, program.getSourceFiles(), getValidSourceFile(fileName), position));
        }
        /// References and Occurrences
        function getOccurrencesAtPosition(fileName, position) {
            return ts.flatMap(getDocumentHighlights(fileName, position, [fileName]), entry => entry.highlightSpans.map(highlightSpan => ({
                fileName: entry.fileName,
                textSpan: highlightSpan.textSpan,
                isWriteAccess: highlightSpan.kind === ts.HighlightSpanKind.writtenReference,
                isDefinition: false,
                isInString: highlightSpan.isInString,
            })));
        }
        function getDocumentHighlights(fileName, position, filesToSearch) {
            ts.Debug.assert(filesToSearch.some(f => ts.normalizePath(f) === fileName));
            synchronizeHostData();
            const sourceFilesToSearch = ts.map(filesToSearch, f => ts.Debug.assertDefined(program.getSourceFile(f)));
            const sourceFile = getValidSourceFile(fileName);
            return ts.DocumentHighlights.getDocumentHighlights(program, cancellationToken, sourceFile, position, sourceFilesToSearch);
        }
        function findRenameLocations(fileName, position, findInStrings, findInComments) {
            return getReferences(fileName, position, { findInStrings, findInComments, isForRename: true });
        }
        function getReferencesAtPosition(fileName, position) {
            return getReferences(fileName, position);
        }
        function getReferences(fileName, position, options) {
            synchronizeHostData();
            // Exclude default library when renaming as commonly user don't want to change that file.
            let sourceFiles = [];
            if (options && options.isForRename) {
                for (const sourceFile of program.getSourceFiles()) {
                    if (!program.isSourceFileDefaultLibrary(sourceFile)) {
                        sourceFiles.push(sourceFile);
                    }
                }
            }
            else {
                sourceFiles = program.getSourceFiles().slice();
            }
            return ts.FindAllReferences.findReferencedEntries(program, cancellationToken, sourceFiles, getValidSourceFile(fileName), position, options);
        }
        function findReferences(fileName, position) {
            synchronizeHostData();
            return ts.FindAllReferences.findReferencedSymbols(program, cancellationToken, program.getSourceFiles(), getValidSourceFile(fileName), position);
        }
        /// NavigateTo
        function getNavigateToItems(searchValue, maxResultCount, fileName, excludeDtsFiles) {
            synchronizeHostData();
            const sourceFiles = fileName ? [getValidSourceFile(fileName)] : program.getSourceFiles();
            return ts.NavigateTo.getNavigateToItems(sourceFiles, program.getTypeChecker(), cancellationToken, searchValue, maxResultCount, excludeDtsFiles);
        }
        function getEmitOutput(fileName, emitOnlyDtsFiles) {
            synchronizeHostData();
            const sourceFile = getValidSourceFile(fileName);
            const customTransformers = host.getCustomTransformers && host.getCustomTransformers();
            return ts.getFileEmitOutput(program, sourceFile, emitOnlyDtsFiles, cancellationToken, customTransformers);
        }
        // Signature help
        /**
         * This is a semantic operation.
         */
        function getSignatureHelpItems(fileName, position) {
            synchronizeHostData();
            const sourceFile = getValidSourceFile(fileName);
            return ts.SignatureHelp.getSignatureHelpItems(program, sourceFile, position, cancellationToken);
        }
        /// Syntactic features
        function getNonBoundSourceFile(fileName) {
            return syntaxTreeCache.getCurrentSourceFile(fileName);
        }
        function getSourceFile(fileName) {
            return getNonBoundSourceFile(fileName);
        }
        function getNameOrDottedNameSpan(fileName, startPos, _endPos) {
            const sourceFile = syntaxTreeCache.getCurrentSourceFile(fileName);
            // Get node at the location
            const node = ts.getTouchingPropertyName(sourceFile, startPos, /*includeJsDocComment*/ false);
            if (node === sourceFile) {
                return;
            }
            switch (node.kind) {
                case ts.SyntaxKind.PropertyAccessExpression:
                case ts.SyntaxKind.QualifiedName:
                case ts.SyntaxKind.StringLiteral:
                case ts.SyntaxKind.FalseKeyword:
                case ts.SyntaxKind.TrueKeyword:
                case ts.SyntaxKind.NullKeyword:
                case ts.SyntaxKind.SuperKeyword:
                case ts.SyntaxKind.ThisKeyword:
                case ts.SyntaxKind.ThisType:
                case ts.SyntaxKind.Identifier:
                    break;
                // Cant create the text span
                default:
                    return;
            }
            let nodeForStartPos = node;
            while (true) {
                if (ts.isRightSideOfPropertyAccess(nodeForStartPos) || ts.isRightSideOfQualifiedName(nodeForStartPos)) {
                    // If on the span is in right side of the the property or qualified name, return the span from the qualified name pos to end of this node
                    nodeForStartPos = nodeForStartPos.parent;
                }
                else if (ts.isNameOfModuleDeclaration(nodeForStartPos)) {
                    // If this is name of a module declarations, check if this is right side of dotted module name
                    // If parent of the module declaration which is parent of this node is module declaration and its body is the module declaration that this node is name of
                    // Then this name is name from dotted module
                    if (nodeForStartPos.parent.parent.kind === ts.SyntaxKind.ModuleDeclaration &&
                        nodeForStartPos.parent.parent.body === nodeForStartPos.parent) {
                        // Use parent module declarations name for start pos
                        nodeForStartPos = nodeForStartPos.parent.parent.name;
                    }
                    else {
                        // We have to use this name for start pos
                        break;
                    }
                }
                else {
                    // Is not a member expression so we have found the node for start pos
                    break;
                }
            }
            return ts.createTextSpanFromBounds(nodeForStartPos.getStart(), node.getEnd());
        }
        function getBreakpointStatementAtPosition(fileName, position) {
            // doesn't use compiler - no need to synchronize with host
            const sourceFile = syntaxTreeCache.getCurrentSourceFile(fileName);
            return ts.BreakpointResolver.spanInSourceFileAtLocation(sourceFile, position);
        }
        function getNavigationBarItems(fileName) {
            return ts.NavigationBar.getNavigationBarItems(syntaxTreeCache.getCurrentSourceFile(fileName), cancellationToken);
        }
        function getNavigationTree(fileName) {
            return ts.NavigationBar.getNavigationTree(syntaxTreeCache.getCurrentSourceFile(fileName), cancellationToken);
        }
        function isTsOrTsxFile(fileName) {
            const kind = ts.getScriptKind(fileName, host);
            return kind === ts.ScriptKind.TS || kind === ts.ScriptKind.TSX;
        }
        function getSemanticClassifications(fileName, span) {
            if (!isTsOrTsxFile(fileName)) {
                // do not run semantic classification on non-ts-or-tsx files
                return [];
            }
            synchronizeHostData();
            return ts.getSemanticClassifications(program.getTypeChecker(), cancellationToken, getValidSourceFile(fileName), program.getClassifiableNames(), span);
        }
        function getEncodedSemanticClassifications(fileName, span) {
            if (!isTsOrTsxFile(fileName)) {
                // do not run semantic classification on non-ts-or-tsx files
                return { spans: [], endOfLineState: ts.EndOfLineState.None };
            }
            synchronizeHostData();
            return ts.getEncodedSemanticClassifications(program.getTypeChecker(), cancellationToken, getValidSourceFile(fileName), program.getClassifiableNames(), span);
        }
        function getSyntacticClassifications(fileName, span) {
            // doesn't use compiler - no need to synchronize with host
            return ts.getSyntacticClassifications(cancellationToken, syntaxTreeCache.getCurrentSourceFile(fileName), span);
        }
        function getEncodedSyntacticClassifications(fileName, span) {
            // doesn't use compiler - no need to synchronize with host
            return ts.getEncodedSyntacticClassifications(cancellationToken, syntaxTreeCache.getCurrentSourceFile(fileName), span);
        }
        function getOutliningSpans(fileName) {
            // doesn't use compiler - no need to synchronize with host
            const sourceFile = syntaxTreeCache.getCurrentSourceFile(fileName);
            return ts.OutliningElementsCollector.collectElements(sourceFile, cancellationToken);
        }
        const braceMatching = ts.createMapFromTemplate({
            [ts.SyntaxKind.OpenBraceToken]: ts.SyntaxKind.CloseBraceToken,
            [ts.SyntaxKind.OpenParenToken]: ts.SyntaxKind.CloseParenToken,
            [ts.SyntaxKind.OpenBracketToken]: ts.SyntaxKind.CloseBracketToken,
            [ts.SyntaxKind.GreaterThanToken]: ts.SyntaxKind.LessThanToken,
        });
        braceMatching.forEach((value, key) => braceMatching.set(value.toString(), Number(key)));
        function getBraceMatchingAtPosition(fileName, position) {
            const sourceFile = syntaxTreeCache.getCurrentSourceFile(fileName);
            const token = ts.getTouchingToken(sourceFile, position, /*includeJsDocComment*/ false);
            const matchKind = token.getStart(sourceFile) === position ? braceMatching.get(token.kind.toString()) : undefined;
            const match = matchKind && ts.findChildOfKind(token.parent, matchKind, sourceFile);
            // We want to order the braces when we return the result.
            return match ? [ts.createTextSpanFromNode(token, sourceFile), ts.createTextSpanFromNode(match, sourceFile)].sort((a, b) => a.start - b.start) : ts.emptyArray;
        }
        function getIndentationAtPosition(fileName, position, editorOptions) {
            let start = ts.timestamp();
            const settings = toEditorSettings(editorOptions);
            const sourceFile = syntaxTreeCache.getCurrentSourceFile(fileName);
            log("getIndentationAtPosition: getCurrentSourceFile: " + (ts.timestamp() - start));
            start = ts.timestamp();
            const result = ts.formatting.SmartIndenter.getIndentation(position, sourceFile, settings);
            log("getIndentationAtPosition: computeIndentation  : " + (ts.timestamp() - start));
            return result;
        }
        function getFormattingEditsForRange(fileName, start, end, options) {
            const sourceFile = syntaxTreeCache.getCurrentSourceFile(fileName);
            return ts.formatting.formatSelection(start, end, sourceFile, ts.formatting.getFormatContext(toEditorSettings(options)));
        }
        function getFormattingEditsForDocument(fileName, options) {
            return ts.formatting.formatDocument(syntaxTreeCache.getCurrentSourceFile(fileName), ts.formatting.getFormatContext(toEditorSettings(options)));
        }
        function getFormattingEditsAfterKeystroke(fileName, position, key, options) {
            const sourceFile = syntaxTreeCache.getCurrentSourceFile(fileName);
            const formatContext = ts.formatting.getFormatContext(toEditorSettings(options));
            if (!ts.isInComment(sourceFile, position)) {
                switch (key) {
                    case "{":
                        return ts.formatting.formatOnOpeningCurly(position, sourceFile, formatContext);
                    case "}":
                        return ts.formatting.formatOnClosingCurly(position, sourceFile, formatContext);
                    case ";":
                        return ts.formatting.formatOnSemicolon(position, sourceFile, formatContext);
                    case "\n":
                        return ts.formatting.formatOnEnter(position, sourceFile, formatContext);
                }
            }
            return [];
        }
        function getCodeFixesAtPosition(fileName, start, end, errorCodes, formatOptions, preferences = ts.defaultPreferences) {
            synchronizeHostData();
            const sourceFile = getValidSourceFile(fileName);
            const span = ts.createTextSpanFromBounds(start, end);
            const formatContext = ts.formatting.getFormatContext(formatOptions);
            return ts.flatMap(ts.deduplicate(errorCodes, ts.equateValues, ts.compareValues), errorCode => {
                cancellationToken.throwIfCancellationRequested();
                return ts.codefix.getFixes({ errorCode, sourceFile, span, program, host, cancellationToken, formatContext, preferences });
            });
        }
        function getCombinedCodeFix(scope, fixId, formatOptions, preferences = ts.defaultPreferences) {
            synchronizeHostData();
            ts.Debug.assert(scope.type === "file");
            const sourceFile = getValidSourceFile(scope.fileName);
            const formatContext = ts.formatting.getFormatContext(formatOptions);
            return ts.codefix.getAllFixes({ fixId, sourceFile, program, host, cancellationToken, formatContext, preferences });
        }
        function organizeImports(scope, formatOptions, preferences = ts.defaultPreferences) {
            synchronizeHostData();
            ts.Debug.assert(scope.type === "file");
            const sourceFile = getValidSourceFile(scope.fileName);
            const formatContext = ts.formatting.getFormatContext(formatOptions);
            return ts.OrganizeImports.organizeImports(sourceFile, formatContext, host, program, preferences);
        }
        function getEditsForFileRename(oldFilePath, newFilePath, formatOptions) {
            return ts.getEditsForFileRename(getProgram(), oldFilePath, newFilePath, host, ts.formatting.getFormatContext(formatOptions));
        }
        function applyCodeActionCommand(fileName, actionOrUndefined) {
            const action = typeof fileName === "string" ? actionOrUndefined : fileName;
            return ts.isArray(action) ? Promise.all(action.map(applySingleCodeActionCommand)) : applySingleCodeActionCommand(action);
        }
        function applySingleCodeActionCommand(action) {
            switch (action.type) {
                case "install package":
                    return host.installPackage
                        ? host.installPackage({ fileName: ts.toPath(action.file, currentDirectory, getCanonicalFileName), packageName: action.packageName })
                        : Promise.reject("Host does not implement `installPackage`");
                default:
                    ts.Debug.fail();
                // TODO: Debug.assertNever(action); will only work if there is more than one type.
            }
        }
        function getDocCommentTemplateAtPosition(fileName, position) {
            return ts.JsDoc.getDocCommentTemplateAtPosition(ts.getNewLineOrDefaultFromHost(host), syntaxTreeCache.getCurrentSourceFile(fileName), position);
        }
        function isValidBraceCompletionAtPosition(fileName, position, openingBrace) {
            // '<' is currently not supported, figuring out if we're in a Generic Type vs. a comparison is too
            // expensive to do during typing scenarios
            // i.e. whether we're dealing with:
            //      var x = new foo<| ( with class foo<T>{} )
            // or
            //      var y = 3 <|
            if (openingBrace === 60 /* lessThan */) {
                return false;
            }
            const sourceFile = syntaxTreeCache.getCurrentSourceFile(fileName);
            // Check if in a context where we don't want to perform any insertion
            if (ts.isInString(sourceFile, position)) {
                return false;
            }
            if (ts.isInsideJsxElementOrAttribute(sourceFile, position)) {
                return openingBrace === 123 /* openBrace */;
            }
            if (ts.isInTemplateString(sourceFile, position)) {
                return false;
            }
            switch (openingBrace) {
                case 39 /* singleQuote */:
                case 34 /* doubleQuote */:
                case 96 /* backtick */:
                    return !ts.isInComment(sourceFile, position);
            }
            return true;
        }
        function getSpanOfEnclosingComment(fileName, position, onlyMultiLine) {
            const sourceFile = syntaxTreeCache.getCurrentSourceFile(fileName);
            const range = ts.formatting.getRangeOfEnclosingComment(sourceFile, position, onlyMultiLine);
            return range && ts.createTextSpanFromRange(range);
        }
        function getTodoComments(fileName, descriptors) {
            // Note: while getting todo comments seems like a syntactic operation, we actually
            // treat it as a semantic operation here.  This is because we expect our host to call
            // this on every single file.  If we treat this syntactically, then that will cause
            // us to populate and throw away the tree in our syntax tree cache for each file.  By
            // treating this as a semantic operation, we can access any tree without throwing
            // anything away.
            synchronizeHostData();
            const sourceFile = getValidSourceFile(fileName);
            cancellationToken.throwIfCancellationRequested();
            const fileContents = sourceFile.text;
            const result = [];
            // Exclude node_modules files as we don't want to show the todos of external libraries.
            if (descriptors.length > 0 && !isNodeModulesFile(sourceFile.fileName)) {
                const regExp = getTodoCommentsRegExp();
                let matchArray;
                while (matchArray = regExp.exec(fileContents)) {
                    cancellationToken.throwIfCancellationRequested();
                    // If we got a match, here is what the match array will look like.  Say the source text is:
                    //
                    //      "    // hack   1"
                    //
                    // The result array with the regexp:    will be:
                    //
                    //      ["// hack   1", "// ", "hack   1", undefined, "hack"]
                    //
                    // Here are the relevant capture groups:
                    //  0) The full match for the entire regexp.
                    //  1) The preamble to the message portion.
                    //  2) The message portion.
                    //  3...N) The descriptor that was matched - by index.  'undefined' for each
                    //         descriptor that didn't match.  an actual value if it did match.
                    //
                    //  i.e. 'undefined' in position 3 above means TODO(jason) didn't match.
                    //       "hack"      in position 4 means HACK did match.
                    const firstDescriptorCaptureIndex = 3;
                    ts.Debug.assert(matchArray.length === descriptors.length + firstDescriptorCaptureIndex);
                    const preamble = matchArray[1];
                    const matchPosition = matchArray.index + preamble.length;
                    // OK, we have found a match in the file.  This is only an acceptable match if
                    // it is contained within a comment.
                    if (!ts.isInComment(sourceFile, matchPosition)) {
                        continue;
                    }
                    let descriptor;
                    for (let i = 0; i < descriptors.length; i++) {
                        if (matchArray[i + firstDescriptorCaptureIndex]) {
                            descriptor = descriptors[i];
                        }
                    }
                    ts.Debug.assert(descriptor !== undefined);
                    // We don't want to match something like 'TODOBY', so we make sure a non
                    // letter/digit follows the match.
                    if (isLetterOrDigit(fileContents.charCodeAt(matchPosition + descriptor.text.length))) {
                        continue;
                    }
                    const message = matchArray[2];
                    result.push({ descriptor, message, position: matchPosition });
                }
            }
            return result;
            function escapeRegExp(str) {
                return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
            }
            function getTodoCommentsRegExp() {
                // NOTE: `?:` means 'non-capture group'.  It allows us to have groups without having to
                // filter them out later in the final result array.
                // TODO comments can appear in one of the following forms:
                //
                //  1)      // TODO     or  /////////// TODO
                //
                //  2)      /* TODO     or  /********** TODO
                //
                //  3)      /*
                //           *   TODO
                //           */
                //
                // The following three regexps are used to match the start of the text up to the TODO
                // comment portion.
                const singleLineCommentStart = /(?:\/\/+\s*)/.source;
                const multiLineCommentStart = /(?:\/\*+\s*)/.source;
                const anyNumberOfSpacesAndAsterisksAtStartOfLine = /(?:^(?:\s|\*)*)/.source;
                // Match any of the above three TODO comment start regexps.
                // Note that the outermost group *is* a capture group.  We want to capture the preamble
                // so that we can determine the starting position of the TODO comment match.
                const preamble = "(" + anyNumberOfSpacesAndAsterisksAtStartOfLine + "|" + singleLineCommentStart + "|" + multiLineCommentStart + ")";
                // Takes the descriptors and forms a regexp that matches them as if they were literals.
                // For example, if the descriptors are "TODO(jason)" and "HACK", then this will be:
                //
                //      (?:(TODO\(jason\))|(HACK))
                //
                // Note that the outermost group is *not* a capture group, but the innermost groups
                // *are* capture groups.  By capturing the inner literals we can determine after
                // matching which descriptor we are dealing with.
                const literals = "(?:" + ts.map(descriptors, d => "(" + escapeRegExp(d.text) + ")").join("|") + ")";
                // After matching a descriptor literal, the following regexp matches the rest of the
                // text up to the end of the line (or */).
                const endOfLineOrEndOfComment = /(?:$|\*\/)/.source;
                const messageRemainder = /(?:.*?)/.source;
                // This is the portion of the match we'll return as part of the TODO comment result. We
                // match the literal portion up to the end of the line or end of comment.
                const messagePortion = "(" + literals + messageRemainder + ")";
                const regExpString = preamble + messagePortion + endOfLineOrEndOfComment;
                // The final regexp will look like this:
                // /((?:\/\/+\s*)|(?:\/\*+\s*)|(?:^(?:\s|\*)*))((?:(TODO\(jason\))|(HACK))(?:.*?))(?:$|\*\/)/gim
                // The flags of the regexp are important here.
                //  'g' is so that we are doing a global search and can find matches several times
                //  in the input.
                //
                //  'i' is for case insensitivity (We do this to match C# TODO comment code).
                //
                //  'm' is so we can find matches in a multi-line input.
                return new RegExp(regExpString, "gim");
            }
            function isLetterOrDigit(char) {
                return (char >= 97 /* a */ && char <= 122 /* z */) ||
                    (char >= 65 /* A */ && char <= 90 /* Z */) ||
                    (char >= 48 /* _0 */ && char <= 57 /* _9 */);
            }
            function isNodeModulesFile(path) {
                return ts.stringContains(path, "/node_modules/");
            }
        }
        function getRenameInfo(fileName, position) {
            synchronizeHostData();
            const defaultLibFileName = host.getDefaultLibFileName(host.getCompilationSettings());
            return ts.Rename.getRenameInfo(program.getTypeChecker(), defaultLibFileName, getCanonicalFileName, getValidSourceFile(fileName), position);
        }
        function getRefactorContext(file, positionOrRange, preferences, formatOptions) {
            const [startPosition, endPosition] = typeof positionOrRange === "number" ? [positionOrRange, undefined] : [positionOrRange.pos, positionOrRange.end];
            return {
                file,
                startPosition,
                endPosition,
                program: getProgram(),
                host,
                formatContext: ts.formatting.getFormatContext(formatOptions),
                cancellationToken,
                preferences,
            };
        }
        function getApplicableRefactors(fileName, positionOrRange, preferences = ts.defaultPreferences) {
            synchronizeHostData();
            const file = getValidSourceFile(fileName);
            return ts.refactor.getApplicableRefactors(getRefactorContext(file, positionOrRange, preferences));
        }
        function getEditsForRefactor(fileName, formatOptions, positionOrRange, refactorName, actionName, preferences = ts.defaultPreferences) {
            synchronizeHostData();
            const file = getValidSourceFile(fileName);
            return ts.refactor.getEditsForRefactor(getRefactorContext(file, positionOrRange, preferences, formatOptions), refactorName, actionName);
        }
        return {
            dispose,
            cleanupSemanticCache,
            getSyntacticDiagnostics,
            getSemanticDiagnostics,
            getSuggestionDiagnostics,
            getCompilerOptionsDiagnostics,
            getSyntacticClassifications,
            getSemanticClassifications,
            getEncodedSyntacticClassifications,
            getEncodedSemanticClassifications,
            getCompletionsAtPosition,
            getCompletionEntryDetails,
            getCompletionEntrySymbol,
            getSignatureHelpItems,
            getQuickInfoAtPosition,
            getDefinitionAtPosition,
            getDefinitionAndBoundSpan,
            getImplementationAtPosition,
            getTypeDefinitionAtPosition,
            getReferencesAtPosition,
            findReferences,
            getOccurrencesAtPosition,
            getDocumentHighlights,
            getNameOrDottedNameSpan,
            getBreakpointStatementAtPosition,
            getNavigateToItems,
            getRenameInfo,
            findRenameLocations,
            getNavigationBarItems,
            getNavigationTree,
            getOutliningSpans,
            getTodoComments,
            getBraceMatchingAtPosition,
            getIndentationAtPosition,
            getFormattingEditsForRange,
            getFormattingEditsForDocument,
            getFormattingEditsAfterKeystroke,
            getDocCommentTemplateAtPosition,
            isValidBraceCompletionAtPosition,
            getSpanOfEnclosingComment,
            getCodeFixesAtPosition,
            getCombinedCodeFix,
            applyCodeActionCommand,
            organizeImports,
            getEditsForFileRename,
            getEmitOutput,
            getNonBoundSourceFile,
            getSourceFile,
            getProgram,
            getApplicableRefactors,
            getEditsForRefactor,
        };
    }
    ts.createLanguageService = createLanguageService;
    /* @internal */
    /** Names in the name table are escaped, so an identifier `__foo` will have a name table entry `___foo`. */
    function getNameTable(sourceFile) {
        if (!sourceFile.nameTable) {
            initializeNameTable(sourceFile);
        }
        return sourceFile.nameTable;
    }
    ts.getNameTable = getNameTable;
    function initializeNameTable(sourceFile) {
        const nameTable = sourceFile.nameTable = ts.createUnderscoreEscapedMap();
        sourceFile.forEachChild(function walk(node) {
            if (ts.isIdentifier(node) && node.escapedText || ts.isStringOrNumericLiteral(node) && literalIsName(node)) {
                const text = ts.getEscapedTextOfIdentifierOrLiteral(node);
                nameTable.set(text, nameTable.get(text) === undefined ? node.pos : -1);
            }
            ts.forEachChild(node, walk);
            if (ts.hasJSDocNodes(node)) {
                for (const jsDoc of node.jsDoc) {
                    ts.forEachChild(jsDoc, walk);
                }
            }
        });
    }
    /**
     * We want to store any numbers/strings if they were a name that could be
     * related to a declaration.  So, if we have 'import x = require("something")'
     * then we want 'something' to be in the name table.  Similarly, if we have
     * "a['propname']" then we want to store "propname" in the name table.
     */
    function literalIsName(node) {
        return ts.isDeclarationName(node) ||
            node.parent.kind === ts.SyntaxKind.ExternalModuleReference ||
            isArgumentOfElementAccessExpression(node) ||
            ts.isLiteralComputedPropertyDeclarationName(node);
    }
    /**
     * Returns the containing object literal property declaration given a possible name node, e.g. "a" in x = { "a": 1 }
     */
    /* @internal */
    function getContainingObjectLiteralElement(node) {
        switch (node.kind) {
            case ts.SyntaxKind.StringLiteral:
            case ts.SyntaxKind.NumericLiteral:
                if (node.parent.kind === ts.SyntaxKind.ComputedPropertyName) {
                    return ts.isObjectLiteralElement(node.parent.parent) ? node.parent.parent : undefined;
                }
            // falls through
            case ts.SyntaxKind.Identifier:
                return ts.isObjectLiteralElement(node.parent) &&
                    (node.parent.parent.kind === ts.SyntaxKind.ObjectLiteralExpression || node.parent.parent.kind === ts.SyntaxKind.JsxAttributes) &&
                    node.parent.name === node ? node.parent : undefined;
        }
        return undefined;
    }
    ts.getContainingObjectLiteralElement = getContainingObjectLiteralElement;
    /* @internal */
    function getPropertySymbolsFromContextualType(typeChecker, node) {
        const objectLiteral = node.parent;
        const contextualType = typeChecker.getContextualType(objectLiteral);
        return getPropertySymbolsFromType(contextualType, node.name);
    }
    ts.getPropertySymbolsFromContextualType = getPropertySymbolsFromContextualType;
    /* @internal */
    function getPropertySymbolsFromType(type, propName) {
        const name = ts.unescapeLeadingUnderscores(ts.getTextOfPropertyName(propName));
        if (name && type) {
            const result = [];
            const symbol = type.getProperty(name);
            if (type.flags & ts.TypeFlags.Union) {
                ts.forEach(type.types, t => {
                    const symbol = t.getProperty(name);
                    if (symbol) {
                        result.push(symbol);
                    }
                });
                return result;
            }
            if (symbol) {
                result.push(symbol);
                return result;
            }
        }
        return undefined;
    }
    ts.getPropertySymbolsFromType = getPropertySymbolsFromType;
    function isArgumentOfElementAccessExpression(node) {
        return node &&
            node.parent &&
            node.parent.kind === ts.SyntaxKind.ElementAccessExpression &&
            node.parent.argumentExpression === node;
    }
    /**
     * Get the path of the default library files (lib.d.ts) as distributed with the typescript
     * node package.
     * The functionality is not supported if the ts module is consumed outside of a node module.
     */
    function getDefaultLibFilePath(options) {
        // Check __dirname is defined and that we are on a node.js system.
        if (typeof __dirname !== "undefined") {
            return __dirname + ts.directorySeparator + ts.getDefaultLibFileName(options);
        }
        throw new Error("getDefaultLibFilePath is only supported when consumed as a node module. ");
    }
    ts.getDefaultLibFilePath = getDefaultLibFilePath;
    ts.objectAllocator = getServicesObjectAllocator();
})(ts || (ts = {}));
