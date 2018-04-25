/* @internal */
var ts;
(function (ts) {
    ts.resolvingEmptyArray = [];
    ts.emptyMap = ts.createMap();
    ts.emptyUnderscoreEscapedMap = ts.emptyMap;
    ts.externalHelpersModuleNameText = "tslib";
    function getDeclarationOfKind(symbol, kind) {
        const declarations = symbol.declarations;
        if (declarations) {
            for (const declaration of declarations) {
                if (declaration.kind === kind) {
                    return declaration;
                }
            }
        }
        return undefined;
    }
    ts.getDeclarationOfKind = getDeclarationOfKind;
    const stringWriter = createSingleLineStringWriter();
    function createSingleLineStringWriter() {
        let str = "";
        const writeText = text => str += text;
        return {
            getText: () => str,
            write: writeText,
            rawWrite: writeText,
            writeTextOfNode: writeText,
            writeKeyword: writeText,
            writeOperator: writeText,
            writePunctuation: writeText,
            writeSpace: writeText,
            writeStringLiteral: writeText,
            writeLiteral: writeText,
            writeParameter: writeText,
            writeProperty: writeText,
            writeSymbol: writeText,
            getTextPos: () => str.length,
            getLine: () => 0,
            getColumn: () => 0,
            getIndent: () => 0,
            isAtStartOfLine: () => false,
            // Completely ignore indentation for string writers.  And map newlines to
            // a single space.
            writeLine: () => str += " ",
            increaseIndent: ts.noop,
            decreaseIndent: ts.noop,
            clear: () => str = "",
            trackSymbol: ts.noop,
            reportInaccessibleThisError: ts.noop,
            reportInaccessibleUniqueSymbolError: ts.noop,
            reportPrivateInBaseOfClassExpression: ts.noop,
        };
    }
    function usingSingleLineStringWriter(action) {
        const oldString = stringWriter.getText();
        try {
            action(stringWriter);
            return stringWriter.getText();
        }
        finally {
            stringWriter.clear();
            stringWriter.writeKeyword(oldString);
        }
    }
    ts.usingSingleLineStringWriter = usingSingleLineStringWriter;
    function getFullWidth(node) {
        return node.end - node.pos;
    }
    ts.getFullWidth = getFullWidth;
    function getResolvedModule(sourceFile, moduleNameText) {
        return sourceFile && sourceFile.resolvedModules && sourceFile.resolvedModules.get(moduleNameText);
    }
    ts.getResolvedModule = getResolvedModule;
    function setResolvedModule(sourceFile, moduleNameText, resolvedModule) {
        if (!sourceFile.resolvedModules) {
            sourceFile.resolvedModules = ts.createMap();
        }
        sourceFile.resolvedModules.set(moduleNameText, resolvedModule);
    }
    ts.setResolvedModule = setResolvedModule;
    function setResolvedTypeReferenceDirective(sourceFile, typeReferenceDirectiveName, resolvedTypeReferenceDirective) {
        if (!sourceFile.resolvedTypeReferenceDirectiveNames) {
            sourceFile.resolvedTypeReferenceDirectiveNames = ts.createMap();
        }
        sourceFile.resolvedTypeReferenceDirectiveNames.set(typeReferenceDirectiveName, resolvedTypeReferenceDirective);
    }
    ts.setResolvedTypeReferenceDirective = setResolvedTypeReferenceDirective;
    function moduleResolutionIsEqualTo(oldResolution, newResolution) {
        return oldResolution.isExternalLibraryImport === newResolution.isExternalLibraryImport &&
            oldResolution.extension === newResolution.extension &&
            oldResolution.resolvedFileName === newResolution.resolvedFileName &&
            oldResolution.originalPath === newResolution.originalPath &&
            packageIdIsEqual(oldResolution.packageId, newResolution.packageId);
    }
    ts.moduleResolutionIsEqualTo = moduleResolutionIsEqualTo;
    function packageIdIsEqual(a, b) {
        return a === b || a && b && a.name === b.name && a.subModuleName === b.subModuleName && a.version === b.version;
    }
    function packageIdToString({ name, subModuleName, version }) {
        const fullName = subModuleName ? `${name}/${subModuleName}` : name;
        return `${fullName}@${version}`;
    }
    ts.packageIdToString = packageIdToString;
    function typeDirectiveIsEqualTo(oldResolution, newResolution) {
        return oldResolution.resolvedFileName === newResolution.resolvedFileName && oldResolution.primary === newResolution.primary;
    }
    ts.typeDirectiveIsEqualTo = typeDirectiveIsEqualTo;
    function hasChangesInResolutions(names, newResolutions, oldResolutions, comparer) {
        ts.Debug.assert(names.length === newResolutions.length);
        for (let i = 0; i < names.length; i++) {
            const newResolution = newResolutions[i];
            const oldResolution = oldResolutions && oldResolutions.get(names[i]);
            const changed = oldResolution
                ? !newResolution || !comparer(oldResolution, newResolution)
                : newResolution;
            if (changed) {
                return true;
            }
        }
        return false;
    }
    ts.hasChangesInResolutions = hasChangesInResolutions;
    // Returns true if this node contains a parse error anywhere underneath it.
    function containsParseError(node) {
        aggregateChildData(node);
        return (node.flags & ts.NodeFlags.ThisNodeOrAnySubNodesHasError) !== 0;
    }
    ts.containsParseError = containsParseError;
    function aggregateChildData(node) {
        if (!(node.flags & ts.NodeFlags.HasAggregatedChildData)) {
            // A node is considered to contain a parse error if:
            //  a) the parser explicitly marked that it had an error
            //  b) any of it's children reported that it had an error.
            const thisNodeOrAnySubNodesHasError = ((node.flags & ts.NodeFlags.ThisNodeHasError) !== 0) ||
                ts.forEachChild(node, containsParseError);
            // If so, mark ourselves accordingly.
            if (thisNodeOrAnySubNodesHasError) {
                node.flags |= ts.NodeFlags.ThisNodeOrAnySubNodesHasError;
            }
            // Also mark that we've propagated the child information to this node.  This way we can
            // always consult the bit directly on this node without needing to check its children
            // again.
            node.flags |= ts.NodeFlags.HasAggregatedChildData;
        }
    }
    function getSourceFileOfNode(node) {
        while (node && node.kind !== ts.SyntaxKind.SourceFile) {
            node = node.parent;
        }
        return node;
    }
    ts.getSourceFileOfNode = getSourceFileOfNode;
    function isStatementWithLocals(node) {
        switch (node.kind) {
            case ts.SyntaxKind.Block:
            case ts.SyntaxKind.CaseBlock:
            case ts.SyntaxKind.ForStatement:
            case ts.SyntaxKind.ForInStatement:
            case ts.SyntaxKind.ForOfStatement:
                return true;
        }
        return false;
    }
    ts.isStatementWithLocals = isStatementWithLocals;
    function getStartPositionOfLine(line, sourceFile) {
        ts.Debug.assert(line >= 0);
        return ts.getLineStarts(sourceFile)[line];
    }
    ts.getStartPositionOfLine = getStartPositionOfLine;
    // This is a useful function for debugging purposes.
    function nodePosToString(node) {
        const file = getSourceFileOfNode(node);
        const loc = ts.getLineAndCharacterOfPosition(file, node.pos);
        return `${file.fileName}(${loc.line + 1},${loc.character + 1})`;
    }
    ts.nodePosToString = nodePosToString;
    function getEndLinePosition(line, sourceFile) {
        ts.Debug.assert(line >= 0);
        const lineStarts = ts.getLineStarts(sourceFile);
        const lineIndex = line;
        const sourceText = sourceFile.text;
        if (lineIndex + 1 === lineStarts.length) {
            // last line - return EOF
            return sourceText.length - 1;
        }
        else {
            // current line start
            const start = lineStarts[lineIndex];
            // take the start position of the next line - 1 = it should be some line break
            let pos = lineStarts[lineIndex + 1] - 1;
            ts.Debug.assert(ts.isLineBreak(sourceText.charCodeAt(pos)));
            // walk backwards skipping line breaks, stop the the beginning of current line.
            // i.e:
            // <some text>
            // $ <- end of line for this position should match the start position
            while (start <= pos && ts.isLineBreak(sourceText.charCodeAt(pos))) {
                pos--;
            }
            return pos;
        }
    }
    ts.getEndLinePosition = getEndLinePosition;
    /**
     * Returns a value indicating whether a name is unique globally or within the current file
     */
    function isFileLevelUniqueName(currentSourceFile, name, hasGlobalName) {
        return !(hasGlobalName && hasGlobalName(name))
            && !currentSourceFile.identifiers.has(name);
    }
    ts.isFileLevelUniqueName = isFileLevelUniqueName;
    // Returns true if this node is missing from the actual source code. A 'missing' node is different
    // from 'undefined/defined'. When a node is undefined (which can happen for optional nodes
    // in the tree), it is definitely missing. However, a node may be defined, but still be
    // missing.  This happens whenever the parser knows it needs to parse something, but can't
    // get anything in the source code that it expects at that location. For example:
    //
    //          let a: ;
    //
    // Here, the Type in the Type-Annotation is not-optional (as there is a colon in the source
    // code). So the parser will attempt to parse out a type, and will create an actual node.
    // However, this node will be 'missing' in the sense that no actual source-code/tokens are
    // contained within it.
    function nodeIsMissing(node) {
        if (node === undefined) {
            return true;
        }
        return node.pos === node.end && node.pos >= 0 && node.kind !== ts.SyntaxKind.EndOfFileToken;
    }
    ts.nodeIsMissing = nodeIsMissing;
    function nodeIsPresent(node) {
        return !nodeIsMissing(node);
    }
    ts.nodeIsPresent = nodeIsPresent;
    /**
     * Determine if the given comment is a triple-slash
     *
     * @return true if the comment is a triple-slash comment else false
     */
    function isRecognizedTripleSlashComment(text, commentPos, commentEnd) {
        // Verify this is /// comment, but do the regexp match only when we first can find /// in the comment text
        // so that we don't end up computing comment string and doing match for all // comments
        if (text.charCodeAt(commentPos + 1) === 47 /* slash */ &&
            commentPos + 2 < commentEnd &&
            text.charCodeAt(commentPos + 2) === 47 /* slash */) {
            const textSubStr = text.substring(commentPos, commentEnd);
            return textSubStr.match(ts.fullTripleSlashReferencePathRegEx) ||
                textSubStr.match(ts.fullTripleSlashAMDReferencePathRegEx) ||
                textSubStr.match(fullTripleSlashReferenceTypeReferenceDirectiveRegEx) ||
                textSubStr.match(defaultLibReferenceRegEx) ?
                true : false;
        }
        return false;
    }
    ts.isRecognizedTripleSlashComment = isRecognizedTripleSlashComment;
    function isPinnedComment(text, start) {
        return text.charCodeAt(start + 1) === 42 /* asterisk */ &&
            text.charCodeAt(start + 2) === 33 /* exclamation */;
    }
    ts.isPinnedComment = isPinnedComment;
    function getTokenPosOfNode(node, sourceFile, includeJsDoc) {
        // With nodes that have no width (i.e. 'Missing' nodes), we actually *don't*
        // want to skip trivia because this will launch us forward to the next token.
        if (nodeIsMissing(node)) {
            return node.pos;
        }
        if (ts.isJSDocNode(node)) {
            return ts.skipTrivia((sourceFile || getSourceFileOfNode(node)).text, node.pos, /*stopAfterLineBreak*/ false, /*stopAtComments*/ true);
        }
        if (includeJsDoc && ts.hasJSDocNodes(node)) {
            return getTokenPosOfNode(node.jsDoc[0]);
        }
        // For a syntax list, it is possible that one of its children has JSDocComment nodes, while
        // the syntax list itself considers them as normal trivia. Therefore if we simply skip
        // trivia for the list, we may have skipped the JSDocComment as well. So we should process its
        // first child to determine the actual position of its first token.
        if (node.kind === ts.SyntaxKind.SyntaxList && node._children.length > 0) {
            return getTokenPosOfNode(node._children[0], sourceFile, includeJsDoc);
        }
        return ts.skipTrivia((sourceFile || getSourceFileOfNode(node)).text, node.pos);
    }
    ts.getTokenPosOfNode = getTokenPosOfNode;
    function getNonDecoratorTokenPosOfNode(node, sourceFile) {
        if (nodeIsMissing(node) || !node.decorators) {
            return getTokenPosOfNode(node, sourceFile);
        }
        return ts.skipTrivia((sourceFile || getSourceFileOfNode(node)).text, node.decorators.end);
    }
    ts.getNonDecoratorTokenPosOfNode = getNonDecoratorTokenPosOfNode;
    function getSourceTextOfNodeFromSourceFile(sourceFile, node, includeTrivia = false) {
        return getTextOfNodeFromSourceText(sourceFile.text, node, includeTrivia);
    }
    ts.getSourceTextOfNodeFromSourceFile = getSourceTextOfNodeFromSourceFile;
    function getTextOfNodeFromSourceText(sourceText, node, includeTrivia = false) {
        if (nodeIsMissing(node)) {
            return "";
        }
        return sourceText.substring(includeTrivia ? node.pos : ts.skipTrivia(sourceText, node.pos), node.end);
    }
    ts.getTextOfNodeFromSourceText = getTextOfNodeFromSourceText;
    function getTextOfNode(node, includeTrivia = false) {
        return getSourceTextOfNodeFromSourceFile(getSourceFileOfNode(node), node, includeTrivia);
    }
    ts.getTextOfNode = getTextOfNode;
    function getPos(range) {
        return range.pos;
    }
    /**
     * Note: it is expected that the `nodeArray` and the `node` are within the same file.
     * For example, searching for a `SourceFile` in a `SourceFile[]` wouldn't work.
     */
    function indexOfNode(nodeArray, node) {
        return ts.binarySearch(nodeArray, node, getPos, ts.compareValues);
    }
    ts.indexOfNode = indexOfNode;
    /**
     * Gets flags that control emit behavior of a node.
     */
    function getEmitFlags(node) {
        const emitNode = node.emitNode;
        return emitNode && emitNode.flags;
    }
    ts.getEmitFlags = getEmitFlags;
    function getLiteralText(node, sourceFile) {
        // If we don't need to downlevel and we can reach the original source text using
        // the node's parent reference, then simply get the text as it was originally written.
        if (!nodeIsSynthesized(node) && node.parent && !(ts.isNumericLiteral(node) && node.numericLiteralFlags & 512 /* ContainsSeparator */)) {
            return getSourceTextOfNodeFromSourceFile(sourceFile, node);
        }
        const escapeText = getEmitFlags(node) & ts.EmitFlags.NoAsciiEscaping ? escapeString : escapeNonAsciiString;
        // If we can't reach the original source text, use the canonical form if it's a number,
        // or a (possibly escaped) quoted form of the original text if it's string-like.
        switch (node.kind) {
            case ts.SyntaxKind.StringLiteral:
                if (node.singleQuote) {
                    return "'" + escapeText(node.text, 39 /* singleQuote */) + "'";
                }
                else {
                    return '"' + escapeText(node.text, 34 /* doubleQuote */) + '"';
                }
            case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
                return "`" + escapeText(node.text, 96 /* backtick */) + "`";
            case ts.SyntaxKind.TemplateHead:
                // tslint:disable-next-line no-invalid-template-strings
                return "`" + escapeText(node.text, 96 /* backtick */) + "${";
            case ts.SyntaxKind.TemplateMiddle:
                // tslint:disable-next-line no-invalid-template-strings
                return "}" + escapeText(node.text, 96 /* backtick */) + "${";
            case ts.SyntaxKind.TemplateTail:
                return "}" + escapeText(node.text, 96 /* backtick */) + "`";
            case ts.SyntaxKind.NumericLiteral:
            case ts.SyntaxKind.RegularExpressionLiteral:
                return node.text;
        }
        ts.Debug.fail(`Literal kind '${node.kind}' not accounted for.`);
    }
    ts.getLiteralText = getLiteralText;
    function getTextOfConstantValue(value) {
        return ts.isString(value) ? '"' + escapeNonAsciiString(value) + '"' : "" + value;
    }
    ts.getTextOfConstantValue = getTextOfConstantValue;
    // Add an extra underscore to identifiers that start with two underscores to avoid issues with magic names like '__proto__'
    function escapeLeadingUnderscores(identifier) {
        return (identifier.length >= 2 && identifier.charCodeAt(0) === 95 /* _ */ && identifier.charCodeAt(1) === 95 /* _ */ ? "_" + identifier : identifier);
    }
    ts.escapeLeadingUnderscores = escapeLeadingUnderscores;
    /**
     * @deprecated Use `id.escapedText` to get the escaped text of an Identifier.
     * @param identifier The identifier to escape
     */
    function escapeIdentifier(identifier) {
        return identifier;
    }
    ts.escapeIdentifier = escapeIdentifier;
    // Make an identifier from an external module name by extracting the string after the last "/" and replacing
    // all non-alphanumeric characters with underscores
    function makeIdentifierFromModuleName(moduleName) {
        return ts.getBaseFileName(moduleName).replace(/^(\d)/, "_$1").replace(/\W/g, "_");
    }
    ts.makeIdentifierFromModuleName = makeIdentifierFromModuleName;
    function isBlockOrCatchScoped(declaration) {
        return (ts.getCombinedNodeFlags(declaration) & ts.NodeFlags.BlockScoped) !== 0 ||
            isCatchClauseVariableDeclarationOrBindingElement(declaration);
    }
    ts.isBlockOrCatchScoped = isBlockOrCatchScoped;
    function isCatchClauseVariableDeclarationOrBindingElement(declaration) {
        const node = getRootDeclaration(declaration);
        return node.kind === ts.SyntaxKind.VariableDeclaration && node.parent.kind === ts.SyntaxKind.CatchClause;
    }
    ts.isCatchClauseVariableDeclarationOrBindingElement = isCatchClauseVariableDeclarationOrBindingElement;
    function isAmbientModule(node) {
        return ts.isModuleDeclaration(node) && (node.name.kind === ts.SyntaxKind.StringLiteral || isGlobalScopeAugmentation(node));
    }
    ts.isAmbientModule = isAmbientModule;
    function isModuleWithStringLiteralName(node) {
        return ts.isModuleDeclaration(node) && node.name.kind === ts.SyntaxKind.StringLiteral;
    }
    ts.isModuleWithStringLiteralName = isModuleWithStringLiteralName;
    function isNonGlobalAmbientModule(node) {
        return ts.isModuleDeclaration(node) && ts.isStringLiteral(node.name);
    }
    ts.isNonGlobalAmbientModule = isNonGlobalAmbientModule;
    /** Given a symbol for a module, checks that it is a shorthand ambient module. */
    function isShorthandAmbientModuleSymbol(moduleSymbol) {
        return isShorthandAmbientModule(moduleSymbol.valueDeclaration);
    }
    ts.isShorthandAmbientModuleSymbol = isShorthandAmbientModuleSymbol;
    function isShorthandAmbientModule(node) {
        // The only kind of module that can be missing a body is a shorthand ambient module.
        return node && node.kind === ts.SyntaxKind.ModuleDeclaration && (!node.body);
    }
    function isBlockScopedContainerTopLevel(node) {
        return node.kind === ts.SyntaxKind.SourceFile ||
            node.kind === ts.SyntaxKind.ModuleDeclaration ||
            ts.isFunctionLike(node);
    }
    ts.isBlockScopedContainerTopLevel = isBlockScopedContainerTopLevel;
    function isGlobalScopeAugmentation(module) {
        return !!(module.flags & ts.NodeFlags.GlobalAugmentation);
    }
    ts.isGlobalScopeAugmentation = isGlobalScopeAugmentation;
    function isExternalModuleAugmentation(node) {
        return isAmbientModule(node) && isModuleAugmentationExternal(node);
    }
    ts.isExternalModuleAugmentation = isExternalModuleAugmentation;
    function isModuleAugmentationExternal(node) {
        // external module augmentation is a ambient module declaration that is either:
        // - defined in the top level scope and source file is an external module
        // - defined inside ambient module declaration located in the top level scope and source file not an external module
        switch (node.parent.kind) {
            case ts.SyntaxKind.SourceFile:
                return ts.isExternalModule(node.parent);
            case ts.SyntaxKind.ModuleBlock:
                return isAmbientModule(node.parent.parent) && ts.isSourceFile(node.parent.parent.parent) && !ts.isExternalModule(node.parent.parent.parent);
        }
        return false;
    }
    ts.isModuleAugmentationExternal = isModuleAugmentationExternal;
    function isEffectiveExternalModule(node, compilerOptions) {
        return ts.isExternalModule(node) || compilerOptions.isolatedModules || ((ts.getEmitModuleKind(compilerOptions) === ts.ModuleKind.CommonJS) && !!node.commonJsModuleIndicator);
    }
    ts.isEffectiveExternalModule = isEffectiveExternalModule;
    function isBlockScope(node, parentNode) {
        switch (node.kind) {
            case ts.SyntaxKind.SourceFile:
            case ts.SyntaxKind.CaseBlock:
            case ts.SyntaxKind.CatchClause:
            case ts.SyntaxKind.ModuleDeclaration:
            case ts.SyntaxKind.ForStatement:
            case ts.SyntaxKind.ForInStatement:
            case ts.SyntaxKind.ForOfStatement:
            case ts.SyntaxKind.Constructor:
            case ts.SyntaxKind.MethodDeclaration:
            case ts.SyntaxKind.GetAccessor:
            case ts.SyntaxKind.SetAccessor:
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.FunctionExpression:
            case ts.SyntaxKind.ArrowFunction:
                return true;
            case ts.SyntaxKind.Block:
                // function block is not considered block-scope container
                // see comment in binder.ts: bind(...), case for SyntaxKind.Block
                return parentNode && !ts.isFunctionLike(parentNode);
        }
        return false;
    }
    ts.isBlockScope = isBlockScope;
    function isDeclarationWithTypeParameters(node) {
        switch (node.kind) {
            case ts.SyntaxKind.CallSignature:
            case ts.SyntaxKind.ConstructSignature:
            case ts.SyntaxKind.MethodSignature:
            case ts.SyntaxKind.IndexSignature:
            case ts.SyntaxKind.FunctionType:
            case ts.SyntaxKind.ConstructorType:
            case ts.SyntaxKind.JSDocFunctionType:
            case ts.SyntaxKind.ClassDeclaration:
            case ts.SyntaxKind.ClassExpression:
            case ts.SyntaxKind.InterfaceDeclaration:
            case ts.SyntaxKind.TypeAliasDeclaration:
            case ts.SyntaxKind.JSDocTemplateTag:
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.MethodDeclaration:
            case ts.SyntaxKind.Constructor:
            case ts.SyntaxKind.GetAccessor:
            case ts.SyntaxKind.SetAccessor:
            case ts.SyntaxKind.FunctionExpression:
            case ts.SyntaxKind.ArrowFunction:
                return true;
            default:
                ts.assertTypeIsNever(node);
                return false;
        }
    }
    ts.isDeclarationWithTypeParameters = isDeclarationWithTypeParameters;
    function isAnyImportSyntax(node) {
        switch (node.kind) {
            case ts.SyntaxKind.ImportDeclaration:
            case ts.SyntaxKind.ImportEqualsDeclaration:
                return true;
            default:
                return false;
        }
    }
    ts.isAnyImportSyntax = isAnyImportSyntax;
    function isLateVisibilityPaintedStatement(node) {
        switch (node.kind) {
            case ts.SyntaxKind.ImportDeclaration:
            case ts.SyntaxKind.ImportEqualsDeclaration:
            case ts.SyntaxKind.VariableStatement:
                return true;
            default:
                return false;
        }
    }
    ts.isLateVisibilityPaintedStatement = isLateVisibilityPaintedStatement;
    function isAnyImportOrReExport(node) {
        return isAnyImportSyntax(node) || ts.isExportDeclaration(node);
    }
    ts.isAnyImportOrReExport = isAnyImportOrReExport;
    // Gets the nearest enclosing block scope container that has the provided node
    // as a descendant, that is not the provided node.
    function getEnclosingBlockScopeContainer(node) {
        let current = node.parent;
        while (current) {
            if (isBlockScope(current, current.parent)) {
                return current;
            }
            current = current.parent;
        }
    }
    ts.getEnclosingBlockScopeContainer = getEnclosingBlockScopeContainer;
    // Return display name of an identifier
    // Computed property names will just be emitted as "[<expr>]", where <expr> is the source
    // text of the expression in the computed property.
    function declarationNameToString(name) {
        return getFullWidth(name) === 0 ? "(Missing)" : getTextOfNode(name);
    }
    ts.declarationNameToString = declarationNameToString;
    function getNameFromIndexInfo(info) {
        return info.declaration ? declarationNameToString(info.declaration.parameters[0].name) : undefined;
    }
    ts.getNameFromIndexInfo = getNameFromIndexInfo;
    function getTextOfPropertyName(name) {
        switch (name.kind) {
            case ts.SyntaxKind.Identifier:
                return name.escapedText;
            case ts.SyntaxKind.StringLiteral:
            case ts.SyntaxKind.NumericLiteral:
                return escapeLeadingUnderscores(name.text);
            case ts.SyntaxKind.ComputedPropertyName:
                return isStringOrNumericLiteral(name.expression) ? escapeLeadingUnderscores(name.expression.text) : undefined;
            default:
                ts.Debug.assertNever(name);
        }
    }
    ts.getTextOfPropertyName = getTextOfPropertyName;
    function entityNameToString(name) {
        switch (name.kind) {
            case ts.SyntaxKind.Identifier:
                return getFullWidth(name) === 0 ? ts.idText(name) : getTextOfNode(name);
            case ts.SyntaxKind.QualifiedName:
                return entityNameToString(name.left) + "." + entityNameToString(name.right);
            case ts.SyntaxKind.PropertyAccessExpression:
                return entityNameToString(name.expression) + "." + entityNameToString(name.name);
        }
    }
    ts.entityNameToString = entityNameToString;
    function createDiagnosticForNode(node, message, arg0, arg1, arg2, arg3) {
        const sourceFile = getSourceFileOfNode(node);
        return createDiagnosticForNodeInSourceFile(sourceFile, node, message, arg0, arg1, arg2, arg3);
    }
    ts.createDiagnosticForNode = createDiagnosticForNode;
    function createDiagnosticForNodeArray(sourceFile, nodes, message, arg0, arg1, arg2, arg3) {
        const start = ts.skipTrivia(sourceFile.text, nodes.pos);
        return ts.createFileDiagnostic(sourceFile, start, nodes.end - start, message, arg0, arg1, arg2, arg3);
    }
    ts.createDiagnosticForNodeArray = createDiagnosticForNodeArray;
    function createDiagnosticForNodeInSourceFile(sourceFile, node, message, arg0, arg1, arg2, arg3) {
        const span = getErrorSpanForNode(sourceFile, node);
        return ts.createFileDiagnostic(sourceFile, span.start, span.length, message, arg0, arg1, arg2, arg3);
    }
    ts.createDiagnosticForNodeInSourceFile = createDiagnosticForNodeInSourceFile;
    function createDiagnosticForNodeSpan(sourceFile, startNode, endNode, message, arg0, arg1, arg2, arg3) {
        const start = ts.skipTrivia(sourceFile.text, startNode.pos);
        return ts.createFileDiagnostic(sourceFile, start, endNode.end - start, message, arg0, arg1, arg2, arg3);
    }
    ts.createDiagnosticForNodeSpan = createDiagnosticForNodeSpan;
    function createDiagnosticForNodeFromMessageChain(node, messageChain) {
        const sourceFile = getSourceFileOfNode(node);
        const span = getErrorSpanForNode(sourceFile, node);
        return {
            file: sourceFile,
            start: span.start,
            length: span.length,
            code: messageChain.code,
            category: messageChain.category,
            messageText: messageChain.next ? messageChain : messageChain.messageText
        };
    }
    ts.createDiagnosticForNodeFromMessageChain = createDiagnosticForNodeFromMessageChain;
    function getSpanOfTokenAtPosition(sourceFile, pos) {
        const scanner = ts.createScanner(sourceFile.languageVersion, /*skipTrivia*/ true, sourceFile.languageVariant, sourceFile.text, /*onError:*/ undefined, pos);
        scanner.scan();
        const start = scanner.getTokenPos();
        return ts.createTextSpanFromBounds(start, scanner.getTextPos());
    }
    ts.getSpanOfTokenAtPosition = getSpanOfTokenAtPosition;
    function getErrorSpanForArrowFunction(sourceFile, node) {
        const pos = ts.skipTrivia(sourceFile.text, node.pos);
        if (node.body && node.body.kind === ts.SyntaxKind.Block) {
            const { line: startLine } = ts.getLineAndCharacterOfPosition(sourceFile, node.body.pos);
            const { line: endLine } = ts.getLineAndCharacterOfPosition(sourceFile, node.body.end);
            if (startLine < endLine) {
                // The arrow function spans multiple lines,
                // make the error span be the first line, inclusive.
                return ts.createTextSpan(pos, getEndLinePosition(startLine, sourceFile) - pos + 1);
            }
        }
        return ts.createTextSpanFromBounds(pos, node.end);
    }
    function getErrorSpanForNode(sourceFile, node) {
        let errorNode = node;
        switch (node.kind) {
            case ts.SyntaxKind.SourceFile:
                const pos = ts.skipTrivia(sourceFile.text, 0, /*stopAfterLineBreak*/ false);
                if (pos === sourceFile.text.length) {
                    // file is empty - return span for the beginning of the file
                    return ts.createTextSpan(0, 0);
                }
                return getSpanOfTokenAtPosition(sourceFile, pos);
            // This list is a work in progress. Add missing node kinds to improve their error
            // spans.
            case ts.SyntaxKind.VariableDeclaration:
            case ts.SyntaxKind.BindingElement:
            case ts.SyntaxKind.ClassDeclaration:
            case ts.SyntaxKind.ClassExpression:
            case ts.SyntaxKind.InterfaceDeclaration:
            case ts.SyntaxKind.ModuleDeclaration:
            case ts.SyntaxKind.EnumDeclaration:
            case ts.SyntaxKind.EnumMember:
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.FunctionExpression:
            case ts.SyntaxKind.MethodDeclaration:
            case ts.SyntaxKind.GetAccessor:
            case ts.SyntaxKind.SetAccessor:
            case ts.SyntaxKind.TypeAliasDeclaration:
                errorNode = node.name;
                break;
            case ts.SyntaxKind.ArrowFunction:
                return getErrorSpanForArrowFunction(sourceFile, node);
        }
        if (errorNode === undefined) {
            // If we don't have a better node, then just set the error on the first token of
            // construct.
            return getSpanOfTokenAtPosition(sourceFile, node.pos);
        }
        const isMissing = nodeIsMissing(errorNode);
        const pos = isMissing
            ? errorNode.pos
            : ts.skipTrivia(sourceFile.text, errorNode.pos);
        // These asserts should all be satisfied for a properly constructed `errorNode`.
        if (isMissing) {
            ts.Debug.assert(pos === errorNode.pos, "This failure could trigger https://github.com/Microsoft/TypeScript/issues/20809");
            ts.Debug.assert(pos === errorNode.end, "This failure could trigger https://github.com/Microsoft/TypeScript/issues/20809");
        }
        else {
            ts.Debug.assert(pos >= errorNode.pos, "This failure could trigger https://github.com/Microsoft/TypeScript/issues/20809");
            ts.Debug.assert(pos <= errorNode.end, "This failure could trigger https://github.com/Microsoft/TypeScript/issues/20809");
        }
        return ts.createTextSpanFromBounds(pos, errorNode.end);
    }
    ts.getErrorSpanForNode = getErrorSpanForNode;
    function isExternalOrCommonJsModule(file) {
        return (file.externalModuleIndicator || file.commonJsModuleIndicator) !== undefined;
    }
    ts.isExternalOrCommonJsModule = isExternalOrCommonJsModule;
    function isConstEnumDeclaration(node) {
        return node.kind === ts.SyntaxKind.EnumDeclaration && isConst(node);
    }
    ts.isConstEnumDeclaration = isConstEnumDeclaration;
    function isConst(node) {
        return !!(ts.getCombinedNodeFlags(node) & ts.NodeFlags.Const)
            || !!(ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Const);
    }
    ts.isConst = isConst;
    function isLet(node) {
        return !!(ts.getCombinedNodeFlags(node) & ts.NodeFlags.Let);
    }
    ts.isLet = isLet;
    function isSuperCall(n) {
        return n.kind === ts.SyntaxKind.CallExpression && n.expression.kind === ts.SyntaxKind.SuperKeyword;
    }
    ts.isSuperCall = isSuperCall;
    function isImportCall(n) {
        return n.kind === ts.SyntaxKind.CallExpression && n.expression.kind === ts.SyntaxKind.ImportKeyword;
    }
    ts.isImportCall = isImportCall;
    function isLiteralImportTypeNode(n) {
        return n.kind === ts.SyntaxKind.ImportType &&
            n.argument.kind === ts.SyntaxKind.LiteralType &&
            ts.isStringLiteral(n.argument.literal);
    }
    ts.isLiteralImportTypeNode = isLiteralImportTypeNode;
    function isPrologueDirective(node) {
        return node.kind === ts.SyntaxKind.ExpressionStatement
            && node.expression.kind === ts.SyntaxKind.StringLiteral;
    }
    ts.isPrologueDirective = isPrologueDirective;
    function getLeadingCommentRangesOfNode(node, sourceFileOfNode) {
        return node.kind !== ts.SyntaxKind.JsxText ? ts.getLeadingCommentRanges(sourceFileOfNode.text, node.pos) : undefined;
    }
    ts.getLeadingCommentRangesOfNode = getLeadingCommentRangesOfNode;
    function getJSDocCommentRanges(node, text) {
        const commentRanges = (node.kind === ts.SyntaxKind.Parameter ||
            node.kind === ts.SyntaxKind.TypeParameter ||
            node.kind === ts.SyntaxKind.FunctionExpression ||
            node.kind === ts.SyntaxKind.ArrowFunction ||
            node.kind === ts.SyntaxKind.ParenthesizedExpression) ?
            ts.concatenate(ts.getTrailingCommentRanges(text, node.pos), ts.getLeadingCommentRanges(text, node.pos)) :
            ts.getLeadingCommentRanges(text, node.pos);
        // True if the comment starts with '/**' but not if it is '/**/'
        return ts.filter(commentRanges, comment => text.charCodeAt(comment.pos + 1) === 42 /* asterisk */ &&
            text.charCodeAt(comment.pos + 2) === 42 /* asterisk */ &&
            text.charCodeAt(comment.pos + 3) !== 47 /* slash */);
    }
    ts.getJSDocCommentRanges = getJSDocCommentRanges;
    ts.fullTripleSlashReferencePathRegEx = /^(\/\/\/\s*<reference\s+path\s*=\s*)('|")(.+?)\2.*?\/>/;
    const fullTripleSlashReferenceTypeReferenceDirectiveRegEx = /^(\/\/\/\s*<reference\s+types\s*=\s*)('|")(.+?)\2.*?\/>/;
    ts.fullTripleSlashAMDReferencePathRegEx = /^(\/\/\/\s*<amd-dependency\s+path\s*=\s*)('|")(.+?)\2.*?\/>/;
    const defaultLibReferenceRegEx = /^(\/\/\/\s*<reference\s+no-default-lib\s*=\s*)('|")(.+?)\2\s*\/>/;
    function isPartOfTypeNode(node) {
        if (ts.SyntaxKind.FirstTypeNode <= node.kind && node.kind <= ts.SyntaxKind.LastTypeNode) {
            return true;
        }
        switch (node.kind) {
            case ts.SyntaxKind.AnyKeyword:
            case ts.SyntaxKind.NumberKeyword:
            case ts.SyntaxKind.StringKeyword:
            case ts.SyntaxKind.BooleanKeyword:
            case ts.SyntaxKind.SymbolKeyword:
            case ts.SyntaxKind.UndefinedKeyword:
            case ts.SyntaxKind.NeverKeyword:
                return true;
            case ts.SyntaxKind.VoidKeyword:
                return node.parent.kind !== ts.SyntaxKind.VoidExpression;
            case ts.SyntaxKind.ExpressionWithTypeArguments:
                return !isExpressionWithTypeArgumentsInClassExtendsClause(node);
            case ts.SyntaxKind.TypeParameter:
                return node.parent.kind === ts.SyntaxKind.MappedType || node.parent.kind === ts.SyntaxKind.InferType;
            // Identifiers and qualified names may be type nodes, depending on their context. Climb
            // above them to find the lowest container
            case ts.SyntaxKind.Identifier:
                // If the identifier is the RHS of a qualified name, then it's a type iff its parent is.
                if (node.parent.kind === ts.SyntaxKind.QualifiedName && node.parent.right === node) {
                    node = node.parent;
                }
                else if (node.parent.kind === ts.SyntaxKind.PropertyAccessExpression && node.parent.name === node) {
                    node = node.parent;
                }
                // At this point, node is either a qualified name or an identifier
                ts.Debug.assert(node.kind === ts.SyntaxKind.Identifier || node.kind === ts.SyntaxKind.QualifiedName || node.kind === ts.SyntaxKind.PropertyAccessExpression, "'node' was expected to be a qualified name, identifier or property access in 'isPartOfTypeNode'.");
            // falls through
            case ts.SyntaxKind.QualifiedName:
            case ts.SyntaxKind.PropertyAccessExpression:
            case ts.SyntaxKind.ThisKeyword:
                const parent = node.parent;
                if (parent.kind === ts.SyntaxKind.TypeQuery) {
                    return false;
                }
                if (parent.kind === ts.SyntaxKind.ImportType) {
                    return !parent.isTypeOf;
                }
                // Do not recursively call isPartOfTypeNode on the parent. In the example:
                //
                //     let a: A.B.C;
                //
                // Calling isPartOfTypeNode would consider the qualified name A.B a type node.
                // Only C and A.B.C are type nodes.
                if (ts.SyntaxKind.FirstTypeNode <= parent.kind && parent.kind <= ts.SyntaxKind.LastTypeNode) {
                    return true;
                }
                switch (parent.kind) {
                    case ts.SyntaxKind.ExpressionWithTypeArguments:
                        return !isExpressionWithTypeArgumentsInClassExtendsClause(parent);
                    case ts.SyntaxKind.TypeParameter:
                        return node === parent.constraint;
                    case ts.SyntaxKind.PropertyDeclaration:
                    case ts.SyntaxKind.PropertySignature:
                    case ts.SyntaxKind.Parameter:
                    case ts.SyntaxKind.VariableDeclaration:
                        return node === parent.type;
                    case ts.SyntaxKind.FunctionDeclaration:
                    case ts.SyntaxKind.FunctionExpression:
                    case ts.SyntaxKind.ArrowFunction:
                    case ts.SyntaxKind.Constructor:
                    case ts.SyntaxKind.MethodDeclaration:
                    case ts.SyntaxKind.MethodSignature:
                    case ts.SyntaxKind.GetAccessor:
                    case ts.SyntaxKind.SetAccessor:
                        return node === parent.type;
                    case ts.SyntaxKind.CallSignature:
                    case ts.SyntaxKind.ConstructSignature:
                    case ts.SyntaxKind.IndexSignature:
                        return node === parent.type;
                    case ts.SyntaxKind.TypeAssertionExpression:
                        return node === parent.type;
                    case ts.SyntaxKind.CallExpression:
                    case ts.SyntaxKind.NewExpression:
                        return ts.contains(parent.typeArguments, node);
                    case ts.SyntaxKind.TaggedTemplateExpression:
                        // TODO (drosen): TaggedTemplateExpressions may eventually support type arguments.
                        return false;
                }
        }
        return false;
    }
    ts.isPartOfTypeNode = isPartOfTypeNode;
    function isChildOfNodeWithKind(node, kind) {
        while (node) {
            if (node.kind === kind) {
                return true;
            }
            node = node.parent;
        }
        return false;
    }
    ts.isChildOfNodeWithKind = isChildOfNodeWithKind;
    // Warning: This has the same semantics as the forEach family of functions,
    //          in that traversal terminates in the event that 'visitor' supplies a truthy value.
    function forEachReturnStatement(body, visitor) {
        return traverse(body);
        function traverse(node) {
            switch (node.kind) {
                case ts.SyntaxKind.ReturnStatement:
                    return visitor(node);
                case ts.SyntaxKind.CaseBlock:
                case ts.SyntaxKind.Block:
                case ts.SyntaxKind.IfStatement:
                case ts.SyntaxKind.DoStatement:
                case ts.SyntaxKind.WhileStatement:
                case ts.SyntaxKind.ForStatement:
                case ts.SyntaxKind.ForInStatement:
                case ts.SyntaxKind.ForOfStatement:
                case ts.SyntaxKind.WithStatement:
                case ts.SyntaxKind.SwitchStatement:
                case ts.SyntaxKind.CaseClause:
                case ts.SyntaxKind.DefaultClause:
                case ts.SyntaxKind.LabeledStatement:
                case ts.SyntaxKind.TryStatement:
                case ts.SyntaxKind.CatchClause:
                    return ts.forEachChild(node, traverse);
            }
        }
    }
    ts.forEachReturnStatement = forEachReturnStatement;
    function forEachYieldExpression(body, visitor) {
        return traverse(body);
        function traverse(node) {
            switch (node.kind) {
                case ts.SyntaxKind.YieldExpression:
                    visitor(node);
                    const operand = node.expression;
                    if (operand) {
                        traverse(operand);
                    }
                    return;
                case ts.SyntaxKind.EnumDeclaration:
                case ts.SyntaxKind.InterfaceDeclaration:
                case ts.SyntaxKind.ModuleDeclaration:
                case ts.SyntaxKind.TypeAliasDeclaration:
                case ts.SyntaxKind.ClassDeclaration:
                case ts.SyntaxKind.ClassExpression:
                    // These are not allowed inside a generator now, but eventually they may be allowed
                    // as local types. Regardless, any yield statements contained within them should be
                    // skipped in this traversal.
                    return;
                default:
                    if (ts.isFunctionLike(node)) {
                        if (node.name && node.name.kind === ts.SyntaxKind.ComputedPropertyName) {
                            // Note that we will not include methods/accessors of a class because they would require
                            // first descending into the class. This is by design.
                            traverse(node.name.expression);
                            return;
                        }
                    }
                    else if (!isPartOfTypeNode(node)) {
                        // This is the general case, which should include mostly expressions and statements.
                        // Also includes NodeArrays.
                        ts.forEachChild(node, traverse);
                    }
            }
        }
    }
    ts.forEachYieldExpression = forEachYieldExpression;
    /**
     * Gets the most likely element type for a TypeNode. This is not an exhaustive test
     * as it assumes a rest argument can only be an array type (either T[], or Array<T>).
     *
     * @param node The type node.
     */
    function getRestParameterElementType(node) {
        if (node && node.kind === ts.SyntaxKind.ArrayType) {
            return node.elementType;
        }
        else if (node && node.kind === ts.SyntaxKind.TypeReference) {
            return ts.singleOrUndefined(node.typeArguments);
        }
        else {
            return undefined;
        }
    }
    ts.getRestParameterElementType = getRestParameterElementType;
    function getMembersOfDeclaration(node) {
        switch (node.kind) {
            case ts.SyntaxKind.InterfaceDeclaration:
            case ts.SyntaxKind.ClassDeclaration:
            case ts.SyntaxKind.ClassExpression:
            case ts.SyntaxKind.TypeLiteral:
                return node.members;
            case ts.SyntaxKind.ObjectLiteralExpression:
                return node.properties;
        }
    }
    ts.getMembersOfDeclaration = getMembersOfDeclaration;
    function isVariableLike(node) {
        if (node) {
            switch (node.kind) {
                case ts.SyntaxKind.BindingElement:
                case ts.SyntaxKind.EnumMember:
                case ts.SyntaxKind.Parameter:
                case ts.SyntaxKind.PropertyAssignment:
                case ts.SyntaxKind.PropertyDeclaration:
                case ts.SyntaxKind.PropertySignature:
                case ts.SyntaxKind.ShorthandPropertyAssignment:
                case ts.SyntaxKind.VariableDeclaration:
                    return true;
            }
        }
        return false;
    }
    ts.isVariableLike = isVariableLike;
    function isVariableLikeOrAccessor(node) {
        return isVariableLike(node) || ts.isAccessor(node);
    }
    ts.isVariableLikeOrAccessor = isVariableLikeOrAccessor;
    function isVariableDeclarationInVariableStatement(node) {
        return node.parent.kind === ts.SyntaxKind.VariableDeclarationList
            && node.parent.parent.kind === ts.SyntaxKind.VariableStatement;
    }
    ts.isVariableDeclarationInVariableStatement = isVariableDeclarationInVariableStatement;
    function isValidESSymbolDeclaration(node) {
        return ts.isVariableDeclaration(node) ? isConst(node) && ts.isIdentifier(node.name) && isVariableDeclarationInVariableStatement(node) :
            ts.isPropertyDeclaration(node) ? hasReadonlyModifier(node) && hasStaticModifier(node) :
                ts.isPropertySignature(node) && hasReadonlyModifier(node);
    }
    ts.isValidESSymbolDeclaration = isValidESSymbolDeclaration;
    function introducesArgumentsExoticObject(node) {
        switch (node.kind) {
            case ts.SyntaxKind.MethodDeclaration:
            case ts.SyntaxKind.MethodSignature:
            case ts.SyntaxKind.Constructor:
            case ts.SyntaxKind.GetAccessor:
            case ts.SyntaxKind.SetAccessor:
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.FunctionExpression:
                return true;
        }
        return false;
    }
    ts.introducesArgumentsExoticObject = introducesArgumentsExoticObject;
    function unwrapInnermostStatementOfLabel(node, beforeUnwrapLabelCallback) {
        while (true) {
            if (beforeUnwrapLabelCallback) {
                beforeUnwrapLabelCallback(node);
            }
            if (node.statement.kind !== ts.SyntaxKind.LabeledStatement) {
                return node.statement;
            }
            node = node.statement;
        }
    }
    ts.unwrapInnermostStatementOfLabel = unwrapInnermostStatementOfLabel;
    function isFunctionBlock(node) {
        return node && node.kind === ts.SyntaxKind.Block && ts.isFunctionLike(node.parent);
    }
    ts.isFunctionBlock = isFunctionBlock;
    function isObjectLiteralMethod(node) {
        return node && node.kind === ts.SyntaxKind.MethodDeclaration && node.parent.kind === ts.SyntaxKind.ObjectLiteralExpression;
    }
    ts.isObjectLiteralMethod = isObjectLiteralMethod;
    function isObjectLiteralOrClassExpressionMethod(node) {
        return node.kind === ts.SyntaxKind.MethodDeclaration &&
            (node.parent.kind === ts.SyntaxKind.ObjectLiteralExpression ||
                node.parent.kind === ts.SyntaxKind.ClassExpression);
    }
    ts.isObjectLiteralOrClassExpressionMethod = isObjectLiteralOrClassExpressionMethod;
    function isIdentifierTypePredicate(predicate) {
        return predicate && predicate.kind === ts.TypePredicateKind.Identifier;
    }
    ts.isIdentifierTypePredicate = isIdentifierTypePredicate;
    function isThisTypePredicate(predicate) {
        return predicate && predicate.kind === ts.TypePredicateKind.This;
    }
    ts.isThisTypePredicate = isThisTypePredicate;
    function getPropertyAssignment(objectLiteral, key, key2) {
        return ts.filter(objectLiteral.properties, (property) => {
            if (property.kind === ts.SyntaxKind.PropertyAssignment) {
                const propName = getTextOfPropertyName(property.name);
                return key === propName || (key2 && key2 === propName);
            }
        });
    }
    ts.getPropertyAssignment = getPropertyAssignment;
    function getContainingFunction(node) {
        return ts.findAncestor(node.parent, ts.isFunctionLike);
    }
    ts.getContainingFunction = getContainingFunction;
    function getContainingClass(node) {
        return ts.findAncestor(node.parent, ts.isClassLike);
    }
    ts.getContainingClass = getContainingClass;
    function getThisContainer(node, includeArrowFunctions) {
        while (true) {
            node = node.parent;
            if (!node) {
                return undefined;
            }
            switch (node.kind) {
                case ts.SyntaxKind.ComputedPropertyName:
                    // If the grandparent node is an object literal (as opposed to a class),
                    // then the computed property is not a 'this' container.
                    // A computed property name in a class needs to be a this container
                    // so that we can error on it.
                    if (ts.isClassLike(node.parent.parent)) {
                        return node;
                    }
                    // If this is a computed property, then the parent should not
                    // make it a this container. The parent might be a property
                    // in an object literal, like a method or accessor. But in order for
                    // such a parent to be a this container, the reference must be in
                    // the *body* of the container.
                    node = node.parent;
                    break;
                case ts.SyntaxKind.Decorator:
                    // Decorators are always applied outside of the body of a class or method.
                    if (node.parent.kind === ts.SyntaxKind.Parameter && ts.isClassElement(node.parent.parent)) {
                        // If the decorator's parent is a Parameter, we resolve the this container from
                        // the grandparent class declaration.
                        node = node.parent.parent;
                    }
                    else if (ts.isClassElement(node.parent)) {
                        // If the decorator's parent is a class element, we resolve the 'this' container
                        // from the parent class declaration.
                        node = node.parent;
                    }
                    break;
                case ts.SyntaxKind.ArrowFunction:
                    if (!includeArrowFunctions) {
                        continue;
                    }
                // falls through
                case ts.SyntaxKind.FunctionDeclaration:
                case ts.SyntaxKind.FunctionExpression:
                case ts.SyntaxKind.ModuleDeclaration:
                case ts.SyntaxKind.PropertyDeclaration:
                case ts.SyntaxKind.PropertySignature:
                case ts.SyntaxKind.MethodDeclaration:
                case ts.SyntaxKind.MethodSignature:
                case ts.SyntaxKind.Constructor:
                case ts.SyntaxKind.GetAccessor:
                case ts.SyntaxKind.SetAccessor:
                case ts.SyntaxKind.CallSignature:
                case ts.SyntaxKind.ConstructSignature:
                case ts.SyntaxKind.IndexSignature:
                case ts.SyntaxKind.EnumDeclaration:
                case ts.SyntaxKind.SourceFile:
                    return node;
            }
        }
    }
    ts.getThisContainer = getThisContainer;
    function getNewTargetContainer(node) {
        const container = getThisContainer(node, /*includeArrowFunctions*/ false);
        if (container) {
            switch (container.kind) {
                case ts.SyntaxKind.Constructor:
                case ts.SyntaxKind.FunctionDeclaration:
                case ts.SyntaxKind.FunctionExpression:
                    return container;
            }
        }
        return undefined;
    }
    ts.getNewTargetContainer = getNewTargetContainer;
    /**
     * Given an super call/property node, returns the closest node where
     * - a super call/property access is legal in the node and not legal in the parent node the node.
     *   i.e. super call is legal in constructor but not legal in the class body.
     * - the container is an arrow function (so caller might need to call getSuperContainer again in case it needs to climb higher)
     * - a super call/property is definitely illegal in the container (but might be legal in some subnode)
     *   i.e. super property access is illegal in function declaration but can be legal in the statement list
     */
    function getSuperContainer(node, stopOnFunctions) {
        while (true) {
            node = node.parent;
            if (!node) {
                return node;
            }
            switch (node.kind) {
                case ts.SyntaxKind.ComputedPropertyName:
                    node = node.parent;
                    break;
                case ts.SyntaxKind.FunctionDeclaration:
                case ts.SyntaxKind.FunctionExpression:
                case ts.SyntaxKind.ArrowFunction:
                    if (!stopOnFunctions) {
                        continue;
                    }
                // falls through
                case ts.SyntaxKind.PropertyDeclaration:
                case ts.SyntaxKind.PropertySignature:
                case ts.SyntaxKind.MethodDeclaration:
                case ts.SyntaxKind.MethodSignature:
                case ts.SyntaxKind.Constructor:
                case ts.SyntaxKind.GetAccessor:
                case ts.SyntaxKind.SetAccessor:
                    return node;
                case ts.SyntaxKind.Decorator:
                    // Decorators are always applied outside of the body of a class or method.
                    if (node.parent.kind === ts.SyntaxKind.Parameter && ts.isClassElement(node.parent.parent)) {
                        // If the decorator's parent is a Parameter, we resolve the this container from
                        // the grandparent class declaration.
                        node = node.parent.parent;
                    }
                    else if (ts.isClassElement(node.parent)) {
                        // If the decorator's parent is a class element, we resolve the 'this' container
                        // from the parent class declaration.
                        node = node.parent;
                    }
                    break;
            }
        }
    }
    ts.getSuperContainer = getSuperContainer;
    function getImmediatelyInvokedFunctionExpression(func) {
        if (func.kind === ts.SyntaxKind.FunctionExpression || func.kind === ts.SyntaxKind.ArrowFunction) {
            let prev = func;
            let parent = func.parent;
            while (parent.kind === ts.SyntaxKind.ParenthesizedExpression) {
                prev = parent;
                parent = parent.parent;
            }
            if (parent.kind === ts.SyntaxKind.CallExpression && parent.expression === prev) {
                return parent;
            }
        }
    }
    ts.getImmediatelyInvokedFunctionExpression = getImmediatelyInvokedFunctionExpression;
    /**
     * Determines whether a node is a property or element access expression for `super`.
     */
    function isSuperProperty(node) {
        const kind = node.kind;
        return (kind === ts.SyntaxKind.PropertyAccessExpression || kind === ts.SyntaxKind.ElementAccessExpression)
            && node.expression.kind === ts.SyntaxKind.SuperKeyword;
    }
    ts.isSuperProperty = isSuperProperty;
    /**
     * Determines whether a node is a property or element access expression for `this`.
     */
    function isThisProperty(node) {
        const kind = node.kind;
        return (kind === ts.SyntaxKind.PropertyAccessExpression || kind === ts.SyntaxKind.ElementAccessExpression)
            && node.expression.kind === ts.SyntaxKind.ThisKeyword;
    }
    ts.isThisProperty = isThisProperty;
    function getEntityNameFromTypeNode(node) {
        switch (node.kind) {
            case ts.SyntaxKind.TypeReference:
                return node.typeName;
            case ts.SyntaxKind.ExpressionWithTypeArguments:
                return isEntityNameExpression(node.expression)
                    ? node.expression
                    : undefined;
            case ts.SyntaxKind.Identifier:
            case ts.SyntaxKind.QualifiedName:
                return node;
        }
        return undefined;
    }
    ts.getEntityNameFromTypeNode = getEntityNameFromTypeNode;
    function getInvokedExpression(node) {
        switch (node.kind) {
            case ts.SyntaxKind.TaggedTemplateExpression:
                return node.tag;
            case ts.SyntaxKind.JsxOpeningElement:
            case ts.SyntaxKind.JsxSelfClosingElement:
                return node.tagName;
            default:
                return node.expression;
        }
    }
    ts.getInvokedExpression = getInvokedExpression;
    function nodeCanBeDecorated(node, parent, grandparent) {
        switch (node.kind) {
            case ts.SyntaxKind.ClassDeclaration:
                // classes are valid targets
                return true;
            case ts.SyntaxKind.PropertyDeclaration:
                // property declarations are valid if their parent is a class declaration.
                return parent.kind === ts.SyntaxKind.ClassDeclaration;
            case ts.SyntaxKind.GetAccessor:
            case ts.SyntaxKind.SetAccessor:
            case ts.SyntaxKind.MethodDeclaration:
                // if this method has a body and its parent is a class declaration, this is a valid target.
                return node.body !== undefined
                    && parent.kind === ts.SyntaxKind.ClassDeclaration;
            case ts.SyntaxKind.Parameter:
                // if the parameter's parent has a body and its grandparent is a class declaration, this is a valid target;
                return parent.body !== undefined
                    && (parent.kind === ts.SyntaxKind.Constructor
                        || parent.kind === ts.SyntaxKind.MethodDeclaration
                        || parent.kind === ts.SyntaxKind.SetAccessor)
                    && grandparent.kind === ts.SyntaxKind.ClassDeclaration;
        }
        return false;
    }
    ts.nodeCanBeDecorated = nodeCanBeDecorated;
    function nodeIsDecorated(node, parent, grandparent) {
        return node.decorators !== undefined
            && nodeCanBeDecorated(node, parent, grandparent);
    }
    ts.nodeIsDecorated = nodeIsDecorated;
    function nodeOrChildIsDecorated(node, parent, grandparent) {
        return nodeIsDecorated(node, parent, grandparent) || childIsDecorated(node, parent);
    }
    ts.nodeOrChildIsDecorated = nodeOrChildIsDecorated;
    function childIsDecorated(node, parent) {
        switch (node.kind) {
            case ts.SyntaxKind.ClassDeclaration:
                return ts.forEach(node.members, m => nodeOrChildIsDecorated(m, node, parent));
            case ts.SyntaxKind.MethodDeclaration:
            case ts.SyntaxKind.SetAccessor:
                return ts.forEach(node.parameters, p => nodeIsDecorated(p, node, parent));
        }
    }
    ts.childIsDecorated = childIsDecorated;
    function isJSXTagName(node) {
        const parent = node.parent;
        if (parent.kind === ts.SyntaxKind.JsxOpeningElement ||
            parent.kind === ts.SyntaxKind.JsxSelfClosingElement ||
            parent.kind === ts.SyntaxKind.JsxClosingElement) {
            return parent.tagName === node;
        }
        return false;
    }
    ts.isJSXTagName = isJSXTagName;
    function isExpressionNode(node) {
        switch (node.kind) {
            case ts.SyntaxKind.SuperKeyword:
            case ts.SyntaxKind.NullKeyword:
            case ts.SyntaxKind.TrueKeyword:
            case ts.SyntaxKind.FalseKeyword:
            case ts.SyntaxKind.RegularExpressionLiteral:
            case ts.SyntaxKind.ArrayLiteralExpression:
            case ts.SyntaxKind.ObjectLiteralExpression:
            case ts.SyntaxKind.PropertyAccessExpression:
            case ts.SyntaxKind.ElementAccessExpression:
            case ts.SyntaxKind.CallExpression:
            case ts.SyntaxKind.NewExpression:
            case ts.SyntaxKind.TaggedTemplateExpression:
            case ts.SyntaxKind.AsExpression:
            case ts.SyntaxKind.TypeAssertionExpression:
            case ts.SyntaxKind.NonNullExpression:
            case ts.SyntaxKind.ParenthesizedExpression:
            case ts.SyntaxKind.FunctionExpression:
            case ts.SyntaxKind.ClassExpression:
            case ts.SyntaxKind.ArrowFunction:
            case ts.SyntaxKind.VoidExpression:
            case ts.SyntaxKind.DeleteExpression:
            case ts.SyntaxKind.TypeOfExpression:
            case ts.SyntaxKind.PrefixUnaryExpression:
            case ts.SyntaxKind.PostfixUnaryExpression:
            case ts.SyntaxKind.BinaryExpression:
            case ts.SyntaxKind.ConditionalExpression:
            case ts.SyntaxKind.SpreadElement:
            case ts.SyntaxKind.TemplateExpression:
            case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
            case ts.SyntaxKind.OmittedExpression:
            case ts.SyntaxKind.JsxElement:
            case ts.SyntaxKind.JsxSelfClosingElement:
            case ts.SyntaxKind.JsxFragment:
            case ts.SyntaxKind.YieldExpression:
            case ts.SyntaxKind.AwaitExpression:
            case ts.SyntaxKind.MetaProperty:
                return true;
            case ts.SyntaxKind.QualifiedName:
                while (node.parent.kind === ts.SyntaxKind.QualifiedName) {
                    node = node.parent;
                }
                return node.parent.kind === ts.SyntaxKind.TypeQuery || isJSXTagName(node);
            case ts.SyntaxKind.Identifier:
                if (node.parent.kind === ts.SyntaxKind.TypeQuery || isJSXTagName(node)) {
                    return true;
                }
            // falls through
            case ts.SyntaxKind.NumericLiteral:
            case ts.SyntaxKind.StringLiteral:
            case ts.SyntaxKind.ThisKeyword:
                return isInExpressionContext(node);
            default:
                return false;
        }
    }
    ts.isExpressionNode = isExpressionNode;
    function isInExpressionContext(node) {
        const parent = node.parent;
        switch (parent.kind) {
            case ts.SyntaxKind.VariableDeclaration:
            case ts.SyntaxKind.Parameter:
            case ts.SyntaxKind.PropertyDeclaration:
            case ts.SyntaxKind.PropertySignature:
            case ts.SyntaxKind.EnumMember:
            case ts.SyntaxKind.PropertyAssignment:
            case ts.SyntaxKind.BindingElement:
                return parent.initializer === node;
            case ts.SyntaxKind.ExpressionStatement:
            case ts.SyntaxKind.IfStatement:
            case ts.SyntaxKind.DoStatement:
            case ts.SyntaxKind.WhileStatement:
            case ts.SyntaxKind.ReturnStatement:
            case ts.SyntaxKind.WithStatement:
            case ts.SyntaxKind.SwitchStatement:
            case ts.SyntaxKind.CaseClause:
            case ts.SyntaxKind.ThrowStatement:
                return parent.expression === node;
            case ts.SyntaxKind.ForStatement:
                const forStatement = parent;
                return (forStatement.initializer === node && forStatement.initializer.kind !== ts.SyntaxKind.VariableDeclarationList) ||
                    forStatement.condition === node ||
                    forStatement.incrementor === node;
            case ts.SyntaxKind.ForInStatement:
            case ts.SyntaxKind.ForOfStatement:
                const forInStatement = parent;
                return (forInStatement.initializer === node && forInStatement.initializer.kind !== ts.SyntaxKind.VariableDeclarationList) ||
                    forInStatement.expression === node;
            case ts.SyntaxKind.TypeAssertionExpression:
            case ts.SyntaxKind.AsExpression:
                return node === parent.expression;
            case ts.SyntaxKind.TemplateSpan:
                return node === parent.expression;
            case ts.SyntaxKind.ComputedPropertyName:
                return node === parent.expression;
            case ts.SyntaxKind.Decorator:
            case ts.SyntaxKind.JsxExpression:
            case ts.SyntaxKind.JsxSpreadAttribute:
            case ts.SyntaxKind.SpreadAssignment:
                return true;
            case ts.SyntaxKind.ExpressionWithTypeArguments:
                return parent.expression === node && isExpressionWithTypeArgumentsInClassExtendsClause(parent);
            default:
                return isExpressionNode(parent);
        }
    }
    ts.isInExpressionContext = isInExpressionContext;
    function isExternalModuleImportEqualsDeclaration(node) {
        return node.kind === ts.SyntaxKind.ImportEqualsDeclaration && node.moduleReference.kind === ts.SyntaxKind.ExternalModuleReference;
    }
    ts.isExternalModuleImportEqualsDeclaration = isExternalModuleImportEqualsDeclaration;
    function getExternalModuleImportEqualsDeclarationExpression(node) {
        ts.Debug.assert(isExternalModuleImportEqualsDeclaration(node));
        return node.moduleReference.expression;
    }
    ts.getExternalModuleImportEqualsDeclarationExpression = getExternalModuleImportEqualsDeclarationExpression;
    function isInternalModuleImportEqualsDeclaration(node) {
        return node.kind === ts.SyntaxKind.ImportEqualsDeclaration && node.moduleReference.kind !== ts.SyntaxKind.ExternalModuleReference;
    }
    ts.isInternalModuleImportEqualsDeclaration = isInternalModuleImportEqualsDeclaration;
    function isSourceFileJavaScript(file) {
        return isInJavaScriptFile(file);
    }
    ts.isSourceFileJavaScript = isSourceFileJavaScript;
    function isSourceFileNotJavaScript(file) {
        return !isInJavaScriptFile(file);
    }
    ts.isSourceFileNotJavaScript = isSourceFileNotJavaScript;
    function isInJavaScriptFile(node) {
        return node && !!(node.flags & ts.NodeFlags.JavaScriptFile);
    }
    ts.isInJavaScriptFile = isInJavaScriptFile;
    function isInJSDoc(node) {
        return node && !!(node.flags & ts.NodeFlags.JSDoc);
    }
    ts.isInJSDoc = isInJSDoc;
    function isJSDocIndexSignature(node) {
        return ts.isTypeReferenceNode(node) &&
            ts.isIdentifier(node.typeName) &&
            node.typeName.escapedText === "Object" &&
            node.typeArguments && node.typeArguments.length === 2 &&
            (node.typeArguments[0].kind === ts.SyntaxKind.StringKeyword || node.typeArguments[0].kind === ts.SyntaxKind.NumberKeyword);
    }
    ts.isJSDocIndexSignature = isJSDocIndexSignature;
    function isRequireCall(callExpression, checkArgumentIsStringLiteralLike) {
        if (callExpression.kind !== ts.SyntaxKind.CallExpression) {
            return false;
        }
        const { expression, arguments: args } = callExpression;
        if (expression.kind !== ts.SyntaxKind.Identifier || expression.escapedText !== "require") {
            return false;
        }
        if (args.length !== 1) {
            return false;
        }
        const arg = args[0];
        return !checkArgumentIsStringLiteralLike || ts.isStringLiteralLike(arg);
    }
    ts.isRequireCall = isRequireCall;
    function isSingleOrDoubleQuote(charCode) {
        return charCode === 39 /* singleQuote */ || charCode === 34 /* doubleQuote */;
    }
    ts.isSingleOrDoubleQuote = isSingleOrDoubleQuote;
    function isStringDoubleQuoted(str, sourceFile) {
        return getSourceTextOfNodeFromSourceFile(sourceFile, str).charCodeAt(0) === 34 /* doubleQuote */;
    }
    ts.isStringDoubleQuoted = isStringDoubleQuoted;
    /**
     * Given the symbol of a declaration, find the symbol of its Javascript container-like initializer,
     * if it has one. Otherwise just return the original symbol.
     *
     * Container-like initializer behave like namespaces, so the binder needs to add contained symbols
     * to their exports. An example is a function with assignments to `this` inside.
     */
    function getJSInitializerSymbol(symbol) {
        if (!symbol || !symbol.valueDeclaration) {
            return symbol;
        }
        const declaration = symbol.valueDeclaration;
        const e = getDeclaredJavascriptInitializer(declaration) || getAssignedJavascriptInitializer(declaration);
        return e && e.symbol ? e.symbol : symbol;
    }
    ts.getJSInitializerSymbol = getJSInitializerSymbol;
    /** Get the declaration initializer, when the initializer is container-like (See getJavascriptInitializer) */
    function getDeclaredJavascriptInitializer(node) {
        if (node && ts.isVariableDeclaration(node) && node.initializer) {
            return getJavascriptInitializer(node.initializer, /*isPrototypeAssignment*/ false) ||
                ts.isIdentifier(node.name) && getDefaultedJavascriptInitializer(node.name, node.initializer, /*isPrototypeAssignment*/ false);
        }
    }
    ts.getDeclaredJavascriptInitializer = getDeclaredJavascriptInitializer;
    /**
     * Get the assignment 'initializer' -- the righthand side-- when the initializer is container-like (See getJavascriptInitializer).
     * We treat the right hand side of assignments with container-like initalizers as declarations.
     */
    function getAssignedJavascriptInitializer(node) {
        if (node && node.parent && ts.isBinaryExpression(node.parent) && node.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            const isPrototypeAssignment = isPrototypeAccess(node.parent.left);
            return getJavascriptInitializer(node.parent.right, isPrototypeAssignment) ||
                getDefaultedJavascriptInitializer(node.parent.left, node.parent.right, isPrototypeAssignment);
        }
    }
    ts.getAssignedJavascriptInitializer = getAssignedJavascriptInitializer;
    /**
     * Recognized Javascript container-like initializers are:
     * 1. (function() {})() -- IIFEs
     * 2. function() { } -- Function expressions
     * 3. class { } -- Class expressions
     * 4. {} -- Empty object literals
     * 5. { ... } -- Non-empty object literals, when used to initialize a prototype, like `C.prototype = { m() { } }`
     *
     * This function returns the provided initializer, or undefined if it is not valid.
     */
    function getJavascriptInitializer(initializer, isPrototypeAssignment) {
        if (ts.isCallExpression(initializer)) {
            const e = skipParentheses(initializer.expression);
            return e.kind === ts.SyntaxKind.FunctionExpression || e.kind === ts.SyntaxKind.ArrowFunction ? initializer : undefined;
        }
        if (initializer.kind === ts.SyntaxKind.FunctionExpression ||
            initializer.kind === ts.SyntaxKind.ClassExpression ||
            initializer.kind === ts.SyntaxKind.ArrowFunction) {
            return initializer;
        }
        if (ts.isObjectLiteralExpression(initializer) && (initializer.properties.length === 0 || isPrototypeAssignment)) {
            return initializer;
        }
    }
    ts.getJavascriptInitializer = getJavascriptInitializer;
    /**
     * A defaulted Javascript initializer matches the pattern
     * `Lhs = Lhs || JavascriptInitializer`
     * or `var Lhs = Lhs || JavascriptInitializer`
     *
     * The second Lhs is required to be the same as the first except that it may be prefixed with
     * 'window.', 'global.' or 'self.' The second Lhs is otherwise ignored by the binder and checker.
     */
    function getDefaultedJavascriptInitializer(name, initializer, isPrototypeAssignment) {
        const e = ts.isBinaryExpression(initializer) && initializer.operatorToken.kind === ts.SyntaxKind.BarBarToken && getJavascriptInitializer(initializer.right, isPrototypeAssignment);
        if (e && isSameEntityName(name, initializer.left)) {
            return e;
        }
    }
    /** Given a Javascript initializer, return the outer name. That is, the lhs of the assignment or the declaration name. */
    function getOuterNameOfJsInitializer(node) {
        if (ts.isBinaryExpression(node.parent)) {
            const parent = (node.parent.operatorToken.kind === ts.SyntaxKind.BarBarToken && ts.isBinaryExpression(node.parent.parent)) ? node.parent.parent : node.parent;
            if (parent.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(parent.left)) {
                return parent.left;
            }
        }
        else if (ts.isVariableDeclaration(node.parent)) {
            return node.parent.name;
        }
    }
    ts.getOuterNameOfJsInitializer = getOuterNameOfJsInitializer;
    /**
     * Is the 'declared' name the same as the one in the initializer?
     * @return true for identical entity names, as well as ones where the initializer is prefixed with
     * 'window', 'self' or 'global'. For example:
     *
     * var my = my || {}
     * var min = window.min || {}
     * my.app = self.my.app || class { }
     */
    function isSameEntityName(name, initializer) {
        if (ts.isIdentifier(name) && ts.isIdentifier(initializer)) {
            return name.escapedText === initializer.escapedText;
        }
        if (ts.isIdentifier(name) && ts.isPropertyAccessExpression(initializer)) {
            return (initializer.expression.kind === ts.SyntaxKind.ThisKeyword ||
                ts.isIdentifier(initializer.expression) &&
                    (initializer.expression.escapedText === "window" ||
                        initializer.expression.escapedText === "self" ||
                        initializer.expression.escapedText === "global")) &&
                isSameEntityName(name, initializer.name);
        }
        if (ts.isPropertyAccessExpression(name) && ts.isPropertyAccessExpression(initializer)) {
            return name.name.escapedText === initializer.name.escapedText && isSameEntityName(name.expression, initializer.expression);
        }
        return false;
    }
    function getRightMostAssignedExpression(node) {
        while (isAssignmentExpression(node, /*excludeCompoundAssignements*/ true)) {
            node = node.right;
        }
        return node;
    }
    ts.getRightMostAssignedExpression = getRightMostAssignedExpression;
    function isExportsIdentifier(node) {
        return ts.isIdentifier(node) && node.escapedText === "exports";
    }
    ts.isExportsIdentifier = isExportsIdentifier;
    function isModuleExportsPropertyAccessExpression(node) {
        return ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.escapedText === "module" && node.name.escapedText === "exports";
    }
    ts.isModuleExportsPropertyAccessExpression = isModuleExportsPropertyAccessExpression;
    /// Given a BinaryExpression, returns SpecialPropertyAssignmentKind for the various kinds of property
    /// assignments we treat as special in the binder
    function getSpecialPropertyAssignmentKind(expr) {
        if (!isInJavaScriptFile(expr) ||
            expr.operatorToken.kind !== ts.SyntaxKind.EqualsToken ||
            !ts.isPropertyAccessExpression(expr.left)) {
            return 0 /* None */;
        }
        const lhs = expr.left;
        if (lhs.expression.kind === ts.SyntaxKind.ThisKeyword) {
            return 4 /* ThisProperty */;
        }
        else if (ts.isIdentifier(lhs.expression) && lhs.expression.escapedText === "module" && lhs.name.escapedText === "exports") {
            // module.exports = expr
            return 2 /* ModuleExports */;
        }
        else if (isEntityNameExpression(lhs.expression)) {
            if (lhs.name.escapedText === "prototype" && ts.isObjectLiteralExpression(getInitializerOfBinaryExpression(expr))) {
                // F.prototype = { ... }
                return 6 /* Prototype */;
            }
            else if (isPrototypeAccess(lhs.expression)) {
                // F.G....prototype.x = expr
                return 3 /* PrototypeProperty */;
            }
            let nextToLast = lhs;
            while (ts.isPropertyAccessExpression(nextToLast.expression)) {
                nextToLast = nextToLast.expression;
            }
            ts.Debug.assert(ts.isIdentifier(nextToLast.expression));
            const id = nextToLast.expression;
            if (id.escapedText === "exports" ||
                id.escapedText === "module" && nextToLast.name.escapedText === "exports") {
                // exports.name = expr OR module.exports.name = expr
                return 1 /* ExportsProperty */;
            }
            // F.G...x = expr
            return 5 /* Property */;
        }
        return 0 /* None */;
    }
    ts.getSpecialPropertyAssignmentKind = getSpecialPropertyAssignmentKind;
    function getInitializerOfBinaryExpression(expr) {
        while (ts.isBinaryExpression(expr.right)) {
            expr = expr.right;
        }
        return expr.right;
    }
    ts.getInitializerOfBinaryExpression = getInitializerOfBinaryExpression;
    function isPrototypePropertyAssignment(node) {
        return ts.isBinaryExpression(node) && getSpecialPropertyAssignmentKind(node) === 3 /* PrototypeProperty */;
    }
    ts.isPrototypePropertyAssignment = isPrototypePropertyAssignment;
    function isSpecialPropertyDeclaration(expr) {
        return isInJavaScriptFile(expr) &&
            expr.parent && expr.parent.kind === ts.SyntaxKind.ExpressionStatement &&
            !!ts.getJSDocTypeTag(expr.parent);
    }
    ts.isSpecialPropertyDeclaration = isSpecialPropertyDeclaration;
    function importFromModuleSpecifier(node) {
        switch (node.parent.kind) {
            case ts.SyntaxKind.ImportDeclaration:
            case ts.SyntaxKind.ExportDeclaration:
                return node.parent;
            case ts.SyntaxKind.ExternalModuleReference:
                return node.parent.parent;
            case ts.SyntaxKind.CallExpression:
                return node.parent;
            case ts.SyntaxKind.LiteralType:
                return ts.cast(node.parent.parent, ts.isImportTypeNode);
            default:
                return ts.Debug.fail(ts.Debug.showSyntaxKind(node.parent));
        }
    }
    ts.importFromModuleSpecifier = importFromModuleSpecifier;
    function getExternalModuleName(node) {
        switch (node.kind) {
            case ts.SyntaxKind.ImportDeclaration:
            case ts.SyntaxKind.ExportDeclaration:
                return node.moduleSpecifier;
            case ts.SyntaxKind.ImportEqualsDeclaration:
                return node.moduleReference.kind === ts.SyntaxKind.ExternalModuleReference ? node.moduleReference.expression : undefined;
            case ts.SyntaxKind.ImportType:
                return isLiteralImportTypeNode(node) ? node.argument.literal : undefined;
            default:
                return ts.Debug.assertNever(node);
        }
    }
    ts.getExternalModuleName = getExternalModuleName;
    function getNamespaceDeclarationNode(node) {
        switch (node.kind) {
            case ts.SyntaxKind.ImportDeclaration:
                return node.importClause && ts.tryCast(node.importClause.namedBindings, ts.isNamespaceImport);
            case ts.SyntaxKind.ImportEqualsDeclaration:
                return node;
            case ts.SyntaxKind.ExportDeclaration:
                return undefined;
            default:
                return ts.Debug.assertNever(node);
        }
    }
    ts.getNamespaceDeclarationNode = getNamespaceDeclarationNode;
    function isDefaultImport(node) {
        return node.kind === ts.SyntaxKind.ImportDeclaration && node.importClause && !!node.importClause.name;
    }
    ts.isDefaultImport = isDefaultImport;
    function hasQuestionToken(node) {
        if (node) {
            switch (node.kind) {
                case ts.SyntaxKind.Parameter:
                case ts.SyntaxKind.MethodDeclaration:
                case ts.SyntaxKind.MethodSignature:
                case ts.SyntaxKind.ShorthandPropertyAssignment:
                case ts.SyntaxKind.PropertyAssignment:
                case ts.SyntaxKind.PropertyDeclaration:
                case ts.SyntaxKind.PropertySignature:
                    return node.questionToken !== undefined;
            }
        }
        return false;
    }
    ts.hasQuestionToken = hasQuestionToken;
    function isJSDocConstructSignature(node) {
        return node.kind === ts.SyntaxKind.JSDocFunctionType &&
            node.parameters.length > 0 &&
            node.parameters[0].name &&
            node.parameters[0].name.escapedText === "new";
    }
    ts.isJSDocConstructSignature = isJSDocConstructSignature;
    function getSourceOfAssignment(node) {
        return ts.isExpressionStatement(node) &&
            node.expression && ts.isBinaryExpression(node.expression) &&
            node.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            node.expression.right;
    }
    function getSourceOfDefaultedAssignment(node) {
        return ts.isExpressionStatement(node) &&
            ts.isBinaryExpression(node.expression) &&
            getSpecialPropertyAssignmentKind(node.expression) !== 0 /* None */ &&
            ts.isBinaryExpression(node.expression.right) &&
            node.expression.right.operatorToken.kind === ts.SyntaxKind.BarBarToken &&
            node.expression.right.right;
    }
    function getSingleInitializerOfVariableStatementOrPropertyDeclaration(node) {
        switch (node.kind) {
            case ts.SyntaxKind.VariableStatement:
                const v = getSingleVariableOfVariableStatement(node);
                return v && v.initializer;
            case ts.SyntaxKind.PropertyDeclaration:
                return node.initializer;
        }
    }
    function getSingleVariableOfVariableStatement(node) {
        return ts.isVariableStatement(node) &&
            node.declarationList.declarations.length > 0 &&
            node.declarationList.declarations[0];
    }
    function getNestedModuleDeclaration(node) {
        return node.kind === ts.SyntaxKind.ModuleDeclaration &&
            node.body &&
            node.body.kind === ts.SyntaxKind.ModuleDeclaration &&
            node.body;
    }
    function getJSDocCommentsAndTags(node) {
        let result;
        getJSDocCommentsAndTagsWorker(node);
        return result || ts.emptyArray;
        function getJSDocCommentsAndTagsWorker(node) {
            const parent = node.parent;
            if (!parent)
                return;
            if (parent.kind === ts.SyntaxKind.PropertyAssignment || parent.kind === ts.SyntaxKind.PropertyDeclaration || getNestedModuleDeclaration(parent)) {
                getJSDocCommentsAndTagsWorker(parent);
            }
            // Try to recognize this pattern when node is initializer of variable declaration and JSDoc comments are on containing variable statement.
            // /**
            //   * @param {number} name
            //   * @returns {number}
            //   */
            // var x = function(name) { return name.length; }
            if (parent.parent &&
                (getSingleVariableOfVariableStatement(parent.parent) === node || getSourceOfAssignment(parent.parent))) {
                getJSDocCommentsAndTagsWorker(parent.parent);
            }
            if (parent.parent && parent.parent.parent &&
                (getSingleVariableOfVariableStatement(parent.parent.parent) ||
                    getSingleInitializerOfVariableStatementOrPropertyDeclaration(parent.parent.parent) === node ||
                    getSourceOfDefaultedAssignment(parent.parent.parent))) {
                getJSDocCommentsAndTagsWorker(parent.parent.parent);
            }
            if (ts.isBinaryExpression(node) && getSpecialPropertyAssignmentKind(node) !== 0 /* None */ ||
                ts.isBinaryExpression(parent) && getSpecialPropertyAssignmentKind(parent) !== 0 /* None */ ||
                node.kind === ts.SyntaxKind.PropertyAccessExpression && node.parent && node.parent.kind === ts.SyntaxKind.ExpressionStatement) {
                getJSDocCommentsAndTagsWorker(parent);
            }
            // Pull parameter comments from declaring function as well
            if (node.kind === ts.SyntaxKind.Parameter) {
                result = ts.addRange(result, ts.getJSDocParameterTags(node));
            }
            if (isVariableLike(node) && ts.hasInitializer(node) && ts.hasJSDocNodes(node.initializer)) {
                result = ts.addRange(result, node.initializer.jsDoc);
            }
            if (ts.hasJSDocNodes(node)) {
                result = ts.addRange(result, node.jsDoc);
            }
        }
    }
    ts.getJSDocCommentsAndTags = getJSDocCommentsAndTags;
    /** Does the opposite of `getJSDocParameterTags`: given a JSDoc parameter, finds the parameter corresponding to it. */
    function getParameterSymbolFromJSDoc(node) {
        if (node.symbol) {
            return node.symbol;
        }
        if (!ts.isIdentifier(node.name)) {
            return undefined;
        }
        const name = node.name.escapedText;
        const decl = getHostSignatureFromJSDoc(node);
        if (!decl) {
            return undefined;
        }
        const parameter = ts.find(decl.parameters, p => p.name.kind === ts.SyntaxKind.Identifier && p.name.escapedText === name);
        return parameter && parameter.symbol;
    }
    ts.getParameterSymbolFromJSDoc = getParameterSymbolFromJSDoc;
    function getHostSignatureFromJSDoc(node) {
        const host = getJSDocHost(node);
        const decl = getSourceOfDefaultedAssignment(host) ||
            getSourceOfAssignment(host) ||
            getSingleInitializerOfVariableStatementOrPropertyDeclaration(host) ||
            getSingleVariableOfVariableStatement(host) ||
            getNestedModuleDeclaration(host) ||
            host;
        return decl && ts.isFunctionLike(decl) ? decl : undefined;
    }
    ts.getHostSignatureFromJSDoc = getHostSignatureFromJSDoc;
    function getJSDocHost(node) {
        while (node.parent.kind === ts.SyntaxKind.JSDocTypeLiteral) {
            node = node.parent.parent.parent;
        }
        ts.Debug.assert(node.parent.kind === ts.SyntaxKind.JSDocComment);
        return node.parent.parent;
    }
    ts.getJSDocHost = getJSDocHost;
    function getTypeParameterFromJsDoc(node) {
        const name = node.name.escapedText;
        const { typeParameters } = node.parent.parent.parent;
        return ts.find(typeParameters, p => p.name.escapedText === name);
    }
    ts.getTypeParameterFromJsDoc = getTypeParameterFromJsDoc;
    function hasRestParameter(s) {
        const last = ts.lastOrUndefined(s.parameters);
        return last && isRestParameter(last);
    }
    ts.hasRestParameter = hasRestParameter;
    function isRestParameter(node) {
        return node.dotDotDotToken !== undefined || node.type && node.type.kind === ts.SyntaxKind.JSDocVariadicType;
    }
    ts.isRestParameter = isRestParameter;
    function getAssignmentTargetKind(node) {
        let parent = node.parent;
        while (true) {
            switch (parent.kind) {
                case ts.SyntaxKind.BinaryExpression:
                    const binaryOperator = parent.operatorToken.kind;
                    return isAssignmentOperator(binaryOperator) && parent.left === node ?
                        binaryOperator === ts.SyntaxKind.EqualsToken ? 1 /* Definite */ : 2 /* Compound */ :
                        0 /* None */;
                case ts.SyntaxKind.PrefixUnaryExpression:
                case ts.SyntaxKind.PostfixUnaryExpression:
                    const unaryOperator = parent.operator;
                    return unaryOperator === ts.SyntaxKind.PlusPlusToken || unaryOperator === ts.SyntaxKind.MinusMinusToken ? 2 /* Compound */ : 0 /* None */;
                case ts.SyntaxKind.ForInStatement:
                case ts.SyntaxKind.ForOfStatement:
                    return parent.initializer === node ? 1 /* Definite */ : 0 /* None */;
                case ts.SyntaxKind.ParenthesizedExpression:
                case ts.SyntaxKind.ArrayLiteralExpression:
                case ts.SyntaxKind.SpreadElement:
                case ts.SyntaxKind.NonNullExpression:
                    node = parent;
                    break;
                case ts.SyntaxKind.ShorthandPropertyAssignment:
                    if (parent.name !== node) {
                        return 0 /* None */;
                    }
                    node = parent.parent;
                    break;
                case ts.SyntaxKind.PropertyAssignment:
                    if (parent.name === node) {
                        return 0 /* None */;
                    }
                    node = parent.parent;
                    break;
                default:
                    return 0 /* None */;
            }
            parent = node.parent;
        }
    }
    ts.getAssignmentTargetKind = getAssignmentTargetKind;
    // A node is an assignment target if it is on the left hand side of an '=' token, if it is parented by a property
    // assignment in an object literal that is an assignment target, or if it is parented by an array literal that is
    // an assignment target. Examples include 'a = xxx', '{ p: a } = xxx', '[{ a }] = xxx'.
    // (Note that `p` is not a target in the above examples, only `a`.)
    function isAssignmentTarget(node) {
        return getAssignmentTargetKind(node) !== 0 /* None */;
    }
    ts.isAssignmentTarget = isAssignmentTarget;
    /**
     * Indicates whether a node could contain a `var` VariableDeclarationList that contributes to
     * the same `var` declaration scope as the node's parent.
     */
    function isNodeWithPossibleHoistedDeclaration(node) {
        switch (node.kind) {
            case ts.SyntaxKind.Block:
            case ts.SyntaxKind.VariableStatement:
            case ts.SyntaxKind.WithStatement:
            case ts.SyntaxKind.IfStatement:
            case ts.SyntaxKind.SwitchStatement:
            case ts.SyntaxKind.CaseBlock:
            case ts.SyntaxKind.CaseClause:
            case ts.SyntaxKind.DefaultClause:
            case ts.SyntaxKind.LabeledStatement:
            case ts.SyntaxKind.ForStatement:
            case ts.SyntaxKind.ForInStatement:
            case ts.SyntaxKind.ForOfStatement:
            case ts.SyntaxKind.DoStatement:
            case ts.SyntaxKind.WhileStatement:
            case ts.SyntaxKind.TryStatement:
            case ts.SyntaxKind.CatchClause:
                return true;
        }
        return false;
    }
    ts.isNodeWithPossibleHoistedDeclaration = isNodeWithPossibleHoistedDeclaration;
    function isValueSignatureDeclaration(node) {
        return ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isMethodOrAccessor(node) || ts.isFunctionDeclaration(node) || ts.isConstructorDeclaration(node);
    }
    ts.isValueSignatureDeclaration = isValueSignatureDeclaration;
    function walkUp(node, kind) {
        while (node && node.kind === kind) {
            node = node.parent;
        }
        return node;
    }
    function walkUpParenthesizedTypes(node) {
        return walkUp(node, ts.SyntaxKind.ParenthesizedType);
    }
    ts.walkUpParenthesizedTypes = walkUpParenthesizedTypes;
    function walkUpParenthesizedExpressions(node) {
        return walkUp(node, ts.SyntaxKind.ParenthesizedExpression);
    }
    ts.walkUpParenthesizedExpressions = walkUpParenthesizedExpressions;
    function skipParentheses(node) {
        while (node.kind === ts.SyntaxKind.ParenthesizedExpression) {
            node = node.expression;
        }
        return node;
    }
    ts.skipParentheses = skipParentheses;
    // a node is delete target iff. it is PropertyAccessExpression/ElementAccessExpression with parentheses skipped
    function isDeleteTarget(node) {
        if (node.kind !== ts.SyntaxKind.PropertyAccessExpression && node.kind !== ts.SyntaxKind.ElementAccessExpression) {
            return false;
        }
        node = walkUpParenthesizedExpressions(node.parent);
        return node && node.kind === ts.SyntaxKind.DeleteExpression;
    }
    ts.isDeleteTarget = isDeleteTarget;
    function isNodeDescendantOf(node, ancestor) {
        while (node) {
            if (node === ancestor)
                return true;
            node = node.parent;
        }
        return false;
    }
    ts.isNodeDescendantOf = isNodeDescendantOf;
    // True if `name` is the name of a declaration node
    function isDeclarationName(name) {
        return !ts.isSourceFile(name) && !ts.isBindingPattern(name) && ts.isDeclaration(name.parent) && name.parent.name === name;
    }
    ts.isDeclarationName = isDeclarationName;
    // See GH#16030
    function isAnyDeclarationName(name) {
        switch (name.kind) {
            case ts.SyntaxKind.Identifier:
            case ts.SyntaxKind.StringLiteral:
            case ts.SyntaxKind.NumericLiteral:
                if (ts.isDeclaration(name.parent)) {
                    return name.parent.name === name;
                }
                const binExp = name.parent.parent;
                return ts.isBinaryExpression(binExp) && getSpecialPropertyAssignmentKind(binExp) !== 0 /* None */ && ts.getNameOfDeclaration(binExp) === name;
            default:
                return false;
        }
    }
    ts.isAnyDeclarationName = isAnyDeclarationName;
    function isLiteralComputedPropertyDeclarationName(node) {
        return (node.kind === ts.SyntaxKind.StringLiteral || node.kind === ts.SyntaxKind.NumericLiteral) &&
            node.parent.kind === ts.SyntaxKind.ComputedPropertyName &&
            ts.isDeclaration(node.parent.parent);
    }
    ts.isLiteralComputedPropertyDeclarationName = isLiteralComputedPropertyDeclarationName;
    // Return true if the given identifier is classified as an IdentifierName
    function isIdentifierName(node) {
        let parent = node.parent;
        switch (parent.kind) {
            case ts.SyntaxKind.PropertyDeclaration:
            case ts.SyntaxKind.PropertySignature:
            case ts.SyntaxKind.MethodDeclaration:
            case ts.SyntaxKind.MethodSignature:
            case ts.SyntaxKind.GetAccessor:
            case ts.SyntaxKind.SetAccessor:
            case ts.SyntaxKind.EnumMember:
            case ts.SyntaxKind.PropertyAssignment:
            case ts.SyntaxKind.PropertyAccessExpression:
                // Name in member declaration or property name in property access
                return parent.name === node;
            case ts.SyntaxKind.QualifiedName:
                // Name on right hand side of dot in a type query or type reference
                if (parent.right === node) {
                    while (parent.kind === ts.SyntaxKind.QualifiedName) {
                        parent = parent.parent;
                    }
                    return parent.kind === ts.SyntaxKind.TypeQuery || parent.kind === ts.SyntaxKind.TypeReference;
                }
                return false;
            case ts.SyntaxKind.BindingElement:
            case ts.SyntaxKind.ImportSpecifier:
                // Property name in binding element or import specifier
                return parent.propertyName === node;
            case ts.SyntaxKind.ExportSpecifier:
            case ts.SyntaxKind.JsxAttribute:
                // Any name in an export specifier or JSX Attribute
                return true;
        }
        return false;
    }
    ts.isIdentifierName = isIdentifierName;
    // An alias symbol is created by one of the following declarations:
    // import <symbol> = ...
    // import <symbol> from ...
    // import * as <symbol> from ...
    // import { x as <symbol> } from ...
    // export { x as <symbol> } from ...
    // export = <EntityNameExpression>
    // export default <EntityNameExpression>
    function isAliasSymbolDeclaration(node) {
        return node.kind === ts.SyntaxKind.ImportEqualsDeclaration ||
            node.kind === ts.SyntaxKind.NamespaceExportDeclaration ||
            node.kind === ts.SyntaxKind.ImportClause && !!node.name ||
            node.kind === ts.SyntaxKind.NamespaceImport ||
            node.kind === ts.SyntaxKind.ImportSpecifier ||
            node.kind === ts.SyntaxKind.ExportSpecifier ||
            node.kind === ts.SyntaxKind.ExportAssignment && exportAssignmentIsAlias(node) ||
            ts.isBinaryExpression(node) && getSpecialPropertyAssignmentKind(node) === 2 /* ModuleExports */;
    }
    ts.isAliasSymbolDeclaration = isAliasSymbolDeclaration;
    function exportAssignmentIsAlias(node) {
        const e = ts.isExportAssignment(node) ? node.expression : node.right;
        return isEntityNameExpression(e) || ts.isClassExpression(e);
    }
    ts.exportAssignmentIsAlias = exportAssignmentIsAlias;
    function getClassExtendsHeritageClauseElement(node) {
        const heritageClause = getHeritageClause(node.heritageClauses, ts.SyntaxKind.ExtendsKeyword);
        return heritageClause && heritageClause.types.length > 0 ? heritageClause.types[0] : undefined;
    }
    ts.getClassExtendsHeritageClauseElement = getClassExtendsHeritageClauseElement;
    function getClassImplementsHeritageClauseElements(node) {
        const heritageClause = getHeritageClause(node.heritageClauses, ts.SyntaxKind.ImplementsKeyword);
        return heritageClause ? heritageClause.types : undefined;
    }
    ts.getClassImplementsHeritageClauseElements = getClassImplementsHeritageClauseElements;
    /** Returns the node in an `extends` or `implements` clause of a class or interface. */
    function getAllSuperTypeNodes(node) {
        return ts.isInterfaceDeclaration(node) ? getInterfaceBaseTypeNodes(node) || ts.emptyArray
            : ts.isClassLike(node) ? ts.concatenate(ts.singleElementArray(getClassExtendsHeritageClauseElement(node)), getClassImplementsHeritageClauseElements(node)) || ts.emptyArray
                : ts.emptyArray;
    }
    ts.getAllSuperTypeNodes = getAllSuperTypeNodes;
    function getInterfaceBaseTypeNodes(node) {
        const heritageClause = getHeritageClause(node.heritageClauses, ts.SyntaxKind.ExtendsKeyword);
        return heritageClause ? heritageClause.types : undefined;
    }
    ts.getInterfaceBaseTypeNodes = getInterfaceBaseTypeNodes;
    function getHeritageClause(clauses, kind) {
        if (clauses) {
            for (const clause of clauses) {
                if (clause.token === kind) {
                    return clause;
                }
            }
        }
        return undefined;
    }
    ts.getHeritageClause = getHeritageClause;
    function tryResolveScriptReference(host, sourceFile, reference) {
        if (!host.getCompilerOptions().noResolve) {
            const referenceFileName = ts.isRootedDiskPath(reference.fileName) ? reference.fileName : ts.combinePaths(ts.getDirectoryPath(sourceFile.fileName), reference.fileName);
            return host.getSourceFile(referenceFileName);
        }
    }
    ts.tryResolveScriptReference = tryResolveScriptReference;
    function getAncestor(node, kind) {
        while (node) {
            if (node.kind === kind) {
                return node;
            }
            node = node.parent;
        }
        return undefined;
    }
    ts.getAncestor = getAncestor;
    function isKeyword(token) {
        return ts.SyntaxKind.FirstKeyword <= token && token <= ts.SyntaxKind.LastKeyword;
    }
    ts.isKeyword = isKeyword;
    function isContextualKeyword(token) {
        return ts.SyntaxKind.FirstContextualKeyword <= token && token <= ts.SyntaxKind.LastContextualKeyword;
    }
    ts.isContextualKeyword = isContextualKeyword;
    function isNonContextualKeyword(token) {
        return isKeyword(token) && !isContextualKeyword(token);
    }
    ts.isNonContextualKeyword = isNonContextualKeyword;
    function isStringANonContextualKeyword(name) {
        const token = ts.stringToToken(name);
        return token !== undefined && isNonContextualKeyword(token);
    }
    ts.isStringANonContextualKeyword = isStringANonContextualKeyword;
    function isTrivia(token) {
        return ts.SyntaxKind.FirstTriviaToken <= token && token <= ts.SyntaxKind.LastTriviaToken;
    }
    ts.isTrivia = isTrivia;
    function getFunctionFlags(node) {
        if (!node) {
            return 4 /* Invalid */;
        }
        let flags = 0 /* Normal */;
        switch (node.kind) {
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.FunctionExpression:
            case ts.SyntaxKind.MethodDeclaration:
                if (node.asteriskToken) {
                    flags |= 1 /* Generator */;
                }
            // falls through
            case ts.SyntaxKind.ArrowFunction:
                if (hasModifier(node, ts.ModifierFlags.Async)) {
                    flags |= 2 /* Async */;
                }
                break;
        }
        if (!node.body) {
            flags |= 4 /* Invalid */;
        }
        return flags;
    }
    ts.getFunctionFlags = getFunctionFlags;
    function isAsyncFunction(node) {
        switch (node.kind) {
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.FunctionExpression:
            case ts.SyntaxKind.ArrowFunction:
            case ts.SyntaxKind.MethodDeclaration:
                return node.body !== undefined
                    && node.asteriskToken === undefined
                    && hasModifier(node, ts.ModifierFlags.Async);
        }
        return false;
    }
    ts.isAsyncFunction = isAsyncFunction;
    function isStringOrNumericLiteral(node) {
        const kind = node.kind;
        return kind === ts.SyntaxKind.StringLiteral
            || kind === ts.SyntaxKind.NumericLiteral;
    }
    ts.isStringOrNumericLiteral = isStringOrNumericLiteral;
    /**
     * A declaration has a dynamic name if both of the following are true:
     *   1. The declaration has a computed property name
     *   2. The computed name is *not* expressed as Symbol.<name>, where name
     *      is a property of the Symbol constructor that denotes a built in
     *      Symbol.
     */
    function hasDynamicName(declaration) {
        const name = ts.getNameOfDeclaration(declaration);
        return name && isDynamicName(name);
    }
    ts.hasDynamicName = hasDynamicName;
    function isDynamicName(name) {
        return name.kind === ts.SyntaxKind.ComputedPropertyName &&
            !isStringOrNumericLiteral(name.expression) &&
            !isWellKnownSymbolSyntactically(name.expression);
    }
    ts.isDynamicName = isDynamicName;
    /**
     * Checks if the expression is of the form:
     *    Symbol.name
     * where Symbol is literally the word "Symbol", and name is any identifierName
     */
    function isWellKnownSymbolSyntactically(node) {
        return ts.isPropertyAccessExpression(node) && isESSymbolIdentifier(node.expression);
    }
    ts.isWellKnownSymbolSyntactically = isWellKnownSymbolSyntactically;
    function getPropertyNameForPropertyNameNode(name) {
        if (name.kind === ts.SyntaxKind.Identifier) {
            return name.escapedText;
        }
        if (name.kind === ts.SyntaxKind.StringLiteral || name.kind === ts.SyntaxKind.NumericLiteral) {
            return escapeLeadingUnderscores(name.text);
        }
        if (name.kind === ts.SyntaxKind.ComputedPropertyName) {
            const nameExpression = name.expression;
            if (isWellKnownSymbolSyntactically(nameExpression)) {
                return getPropertyNameForKnownSymbolName(ts.idText(nameExpression.name));
            }
            else if (nameExpression.kind === ts.SyntaxKind.StringLiteral || nameExpression.kind === ts.SyntaxKind.NumericLiteral) {
                return escapeLeadingUnderscores(nameExpression.text);
            }
        }
        return undefined;
    }
    ts.getPropertyNameForPropertyNameNode = getPropertyNameForPropertyNameNode;
    function isPropertyNameLiteral(node) {
        switch (node.kind) {
            case ts.SyntaxKind.Identifier:
            case ts.SyntaxKind.StringLiteral:
            case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
            case ts.SyntaxKind.NumericLiteral:
                return true;
            default:
                return false;
        }
    }
    ts.isPropertyNameLiteral = isPropertyNameLiteral;
    function getTextOfIdentifierOrLiteral(node) {
        return node.kind === ts.SyntaxKind.Identifier ? ts.idText(node) : node.text;
    }
    ts.getTextOfIdentifierOrLiteral = getTextOfIdentifierOrLiteral;
    function getEscapedTextOfIdentifierOrLiteral(node) {
        return node.kind === ts.SyntaxKind.Identifier ? node.escapedText : escapeLeadingUnderscores(node.text);
    }
    ts.getEscapedTextOfIdentifierOrLiteral = getEscapedTextOfIdentifierOrLiteral;
    function getPropertyNameForKnownSymbolName(symbolName) {
        return "__@" + symbolName;
    }
    ts.getPropertyNameForKnownSymbolName = getPropertyNameForKnownSymbolName;
    function isKnownSymbol(symbol) {
        return ts.startsWith(symbol.escapedName, "__@");
    }
    ts.isKnownSymbol = isKnownSymbol;
    /**
     * Includes the word "Symbol" with unicode escapes
     */
    function isESSymbolIdentifier(node) {
        return node.kind === ts.SyntaxKind.Identifier && node.escapedText === "Symbol";
    }
    ts.isESSymbolIdentifier = isESSymbolIdentifier;
    function isPushOrUnshiftIdentifier(node) {
        return node.escapedText === "push" || node.escapedText === "unshift";
    }
    ts.isPushOrUnshiftIdentifier = isPushOrUnshiftIdentifier;
    function isParameterDeclaration(node) {
        const root = getRootDeclaration(node);
        return root.kind === ts.SyntaxKind.Parameter;
    }
    ts.isParameterDeclaration = isParameterDeclaration;
    function getRootDeclaration(node) {
        while (node.kind === ts.SyntaxKind.BindingElement) {
            node = node.parent.parent;
        }
        return node;
    }
    ts.getRootDeclaration = getRootDeclaration;
    function nodeStartsNewLexicalEnvironment(node) {
        const kind = node.kind;
        return kind === ts.SyntaxKind.Constructor
            || kind === ts.SyntaxKind.FunctionExpression
            || kind === ts.SyntaxKind.FunctionDeclaration
            || kind === ts.SyntaxKind.ArrowFunction
            || kind === ts.SyntaxKind.MethodDeclaration
            || kind === ts.SyntaxKind.GetAccessor
            || kind === ts.SyntaxKind.SetAccessor
            || kind === ts.SyntaxKind.ModuleDeclaration
            || kind === ts.SyntaxKind.SourceFile;
    }
    ts.nodeStartsNewLexicalEnvironment = nodeStartsNewLexicalEnvironment;
    function nodeIsSynthesized(range) {
        return ts.positionIsSynthesized(range.pos)
            || ts.positionIsSynthesized(range.end);
    }
    ts.nodeIsSynthesized = nodeIsSynthesized;
    function getOriginalSourceFile(sourceFile) {
        return ts.getParseTreeNode(sourceFile, ts.isSourceFile) || sourceFile;
    }
    ts.getOriginalSourceFile = getOriginalSourceFile;
    function getExpressionAssociativity(expression) {
        const operator = getOperator(expression);
        const hasArguments = expression.kind === ts.SyntaxKind.NewExpression && expression.arguments !== undefined;
        return getOperatorAssociativity(expression.kind, operator, hasArguments);
    }
    ts.getExpressionAssociativity = getExpressionAssociativity;
    function getOperatorAssociativity(kind, operator, hasArguments) {
        switch (kind) {
            case ts.SyntaxKind.NewExpression:
                return hasArguments ? 0 /* Left */ : 1 /* Right */;
            case ts.SyntaxKind.PrefixUnaryExpression:
            case ts.SyntaxKind.TypeOfExpression:
            case ts.SyntaxKind.VoidExpression:
            case ts.SyntaxKind.DeleteExpression:
            case ts.SyntaxKind.AwaitExpression:
            case ts.SyntaxKind.ConditionalExpression:
            case ts.SyntaxKind.YieldExpression:
                return 1 /* Right */;
            case ts.SyntaxKind.BinaryExpression:
                switch (operator) {
                    case ts.SyntaxKind.AsteriskAsteriskToken:
                    case ts.SyntaxKind.EqualsToken:
                    case ts.SyntaxKind.PlusEqualsToken:
                    case ts.SyntaxKind.MinusEqualsToken:
                    case ts.SyntaxKind.AsteriskAsteriskEqualsToken:
                    case ts.SyntaxKind.AsteriskEqualsToken:
                    case ts.SyntaxKind.SlashEqualsToken:
                    case ts.SyntaxKind.PercentEqualsToken:
                    case ts.SyntaxKind.LessThanLessThanEqualsToken:
                    case ts.SyntaxKind.GreaterThanGreaterThanEqualsToken:
                    case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken:
                    case ts.SyntaxKind.AmpersandEqualsToken:
                    case ts.SyntaxKind.CaretEqualsToken:
                    case ts.SyntaxKind.BarEqualsToken:
                        return 1 /* Right */;
                }
        }
        return 0 /* Left */;
    }
    ts.getOperatorAssociativity = getOperatorAssociativity;
    function getExpressionPrecedence(expression) {
        const operator = getOperator(expression);
        const hasArguments = expression.kind === ts.SyntaxKind.NewExpression && expression.arguments !== undefined;
        return getOperatorPrecedence(expression.kind, operator, hasArguments);
    }
    ts.getExpressionPrecedence = getExpressionPrecedence;
    function getOperator(expression) {
        if (expression.kind === ts.SyntaxKind.BinaryExpression) {
            return expression.operatorToken.kind;
        }
        else if (expression.kind === ts.SyntaxKind.PrefixUnaryExpression || expression.kind === ts.SyntaxKind.PostfixUnaryExpression) {
            return expression.operator;
        }
        else {
            return expression.kind;
        }
    }
    ts.getOperator = getOperator;
    function getOperatorPrecedence(nodeKind, operatorKind, hasArguments) {
        switch (nodeKind) {
            case ts.SyntaxKind.CommaListExpression:
                return 0;
            case ts.SyntaxKind.SpreadElement:
                return 1;
            case ts.SyntaxKind.YieldExpression:
                return 2;
            case ts.SyntaxKind.ConditionalExpression:
                return 4;
            case ts.SyntaxKind.BinaryExpression:
                switch (operatorKind) {
                    case ts.SyntaxKind.CommaToken:
                        return 0;
                    case ts.SyntaxKind.EqualsToken:
                    case ts.SyntaxKind.PlusEqualsToken:
                    case ts.SyntaxKind.MinusEqualsToken:
                    case ts.SyntaxKind.AsteriskAsteriskEqualsToken:
                    case ts.SyntaxKind.AsteriskEqualsToken:
                    case ts.SyntaxKind.SlashEqualsToken:
                    case ts.SyntaxKind.PercentEqualsToken:
                    case ts.SyntaxKind.LessThanLessThanEqualsToken:
                    case ts.SyntaxKind.GreaterThanGreaterThanEqualsToken:
                    case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken:
                    case ts.SyntaxKind.AmpersandEqualsToken:
                    case ts.SyntaxKind.CaretEqualsToken:
                    case ts.SyntaxKind.BarEqualsToken:
                        return 3;
                    default:
                        return getBinaryOperatorPrecedence(operatorKind);
                }
            case ts.SyntaxKind.PrefixUnaryExpression:
            case ts.SyntaxKind.TypeOfExpression:
            case ts.SyntaxKind.VoidExpression:
            case ts.SyntaxKind.DeleteExpression:
            case ts.SyntaxKind.AwaitExpression:
                return 16;
            case ts.SyntaxKind.PostfixUnaryExpression:
                return 17;
            case ts.SyntaxKind.CallExpression:
                return 18;
            case ts.SyntaxKind.NewExpression:
                return hasArguments ? 19 : 18;
            case ts.SyntaxKind.TaggedTemplateExpression:
            case ts.SyntaxKind.PropertyAccessExpression:
            case ts.SyntaxKind.ElementAccessExpression:
                return 19;
            case ts.SyntaxKind.ThisKeyword:
            case ts.SyntaxKind.SuperKeyword:
            case ts.SyntaxKind.Identifier:
            case ts.SyntaxKind.NullKeyword:
            case ts.SyntaxKind.TrueKeyword:
            case ts.SyntaxKind.FalseKeyword:
            case ts.SyntaxKind.NumericLiteral:
            case ts.SyntaxKind.StringLiteral:
            case ts.SyntaxKind.ArrayLiteralExpression:
            case ts.SyntaxKind.ObjectLiteralExpression:
            case ts.SyntaxKind.FunctionExpression:
            case ts.SyntaxKind.ArrowFunction:
            case ts.SyntaxKind.ClassExpression:
            case ts.SyntaxKind.JsxElement:
            case ts.SyntaxKind.JsxSelfClosingElement:
            case ts.SyntaxKind.JsxFragment:
            case ts.SyntaxKind.RegularExpressionLiteral:
            case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
            case ts.SyntaxKind.TemplateExpression:
            case ts.SyntaxKind.ParenthesizedExpression:
            case ts.SyntaxKind.OmittedExpression:
                return 20;
            default:
                return -1;
        }
    }
    ts.getOperatorPrecedence = getOperatorPrecedence;
    /* @internal */
    function getBinaryOperatorPrecedence(kind) {
        switch (kind) {
            case ts.SyntaxKind.BarBarToken:
                return 5;
            case ts.SyntaxKind.AmpersandAmpersandToken:
                return 6;
            case ts.SyntaxKind.BarToken:
                return 7;
            case ts.SyntaxKind.CaretToken:
                return 8;
            case ts.SyntaxKind.AmpersandToken:
                return 9;
            case ts.SyntaxKind.EqualsEqualsToken:
            case ts.SyntaxKind.ExclamationEqualsToken:
            case ts.SyntaxKind.EqualsEqualsEqualsToken:
            case ts.SyntaxKind.ExclamationEqualsEqualsToken:
                return 10;
            case ts.SyntaxKind.LessThanToken:
            case ts.SyntaxKind.GreaterThanToken:
            case ts.SyntaxKind.LessThanEqualsToken:
            case ts.SyntaxKind.GreaterThanEqualsToken:
            case ts.SyntaxKind.InstanceOfKeyword:
            case ts.SyntaxKind.InKeyword:
            case ts.SyntaxKind.AsKeyword:
                return 11;
            case ts.SyntaxKind.LessThanLessThanToken:
            case ts.SyntaxKind.GreaterThanGreaterThanToken:
            case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
                return 12;
            case ts.SyntaxKind.PlusToken:
            case ts.SyntaxKind.MinusToken:
                return 13;
            case ts.SyntaxKind.AsteriskToken:
            case ts.SyntaxKind.SlashToken:
            case ts.SyntaxKind.PercentToken:
                return 14;
            case ts.SyntaxKind.AsteriskAsteriskToken:
                return 15;
        }
        // -1 is lower than all other precedences.  Returning it will cause binary expression
        // parsing to stop.
        return -1;
    }
    ts.getBinaryOperatorPrecedence = getBinaryOperatorPrecedence;
    function createDiagnosticCollection() {
        let nonFileDiagnostics = [];
        const filesWithDiagnostics = [];
        const fileDiagnostics = ts.createMap();
        let hasReadNonFileDiagnostics = false;
        return {
            add,
            getGlobalDiagnostics,
            getDiagnostics,
            reattachFileDiagnostics
        };
        function reattachFileDiagnostics(newFile) {
            ts.forEach(fileDiagnostics.get(newFile.fileName), diagnostic => diagnostic.file = newFile);
        }
        function add(diagnostic) {
            let diagnostics;
            if (diagnostic.file) {
                diagnostics = fileDiagnostics.get(diagnostic.file.fileName);
                if (!diagnostics) {
                    diagnostics = [];
                    fileDiagnostics.set(diagnostic.file.fileName, diagnostics);
                    ts.insertSorted(filesWithDiagnostics, diagnostic.file.fileName, ts.compareStringsCaseSensitive);
                }
            }
            else {
                // If we've already read the non-file diagnostics, do not modify the existing array.
                if (hasReadNonFileDiagnostics) {
                    hasReadNonFileDiagnostics = false;
                    nonFileDiagnostics = nonFileDiagnostics.slice();
                }
                diagnostics = nonFileDiagnostics;
            }
            ts.insertSorted(diagnostics, diagnostic, ts.compareDiagnostics);
        }
        function getGlobalDiagnostics() {
            hasReadNonFileDiagnostics = true;
            return nonFileDiagnostics;
        }
        function getDiagnostics(fileName) {
            if (fileName) {
                return fileDiagnostics.get(fileName) || [];
            }
            const fileDiags = ts.flatMap(filesWithDiagnostics, f => fileDiagnostics.get(f));
            if (!nonFileDiagnostics.length) {
                return fileDiags;
            }
            fileDiags.unshift(...nonFileDiagnostics);
            return fileDiags;
        }
    }
    ts.createDiagnosticCollection = createDiagnosticCollection;
    // This consists of the first 19 unprintable ASCII characters, canonical escapes, lineSeparator,
    // paragraphSeparator, and nextLine. The latter three are just desirable to suppress new lines in
    // the language service. These characters should be escaped when printing, and if any characters are added,
    // the map below must be updated. Note that this regexp *does not* include the 'delete' character.
    // There is no reason for this other than that JSON.stringify does not handle it either.
    const doubleQuoteEscapedCharsRegExp = /[\\\"\u0000-\u001f\t\v\f\b\r\n\u2028\u2029\u0085]/g;
    const singleQuoteEscapedCharsRegExp = /[\\\'\u0000-\u001f\t\v\f\b\r\n\u2028\u2029\u0085]/g;
    const backtickQuoteEscapedCharsRegExp = /[\\\`\u0000-\u001f\t\v\f\b\r\n\u2028\u2029\u0085]/g;
    const escapedCharsMap = ts.createMapFromTemplate({
        "\t": "\\t",
        "\v": "\\v",
        "\f": "\\f",
        "\b": "\\b",
        "\r": "\\r",
        "\n": "\\n",
        "\\": "\\\\",
        "\"": "\\\"",
        "\'": "\\\'",
        "\`": "\\\`",
        "\u2028": "\\u2028",
        "\u2029": "\\u2029",
        "\u0085": "\\u0085" // nextLine
    });
    /**
     * Based heavily on the abstract 'Quote'/'QuoteJSONString' operation from ECMA-262 (24.3.2.2),
     * but augmented for a few select characters (e.g. lineSeparator, paragraphSeparator, nextLine)
     * Note that this doesn't actually wrap the input in double quotes.
     */
    function escapeString(s, quoteChar) {
        const escapedCharsRegExp = quoteChar === 96 /* backtick */ ? backtickQuoteEscapedCharsRegExp :
            quoteChar === 39 /* singleQuote */ ? singleQuoteEscapedCharsRegExp :
                doubleQuoteEscapedCharsRegExp;
        return s.replace(escapedCharsRegExp, getReplacement);
    }
    ts.escapeString = escapeString;
    function getReplacement(c, offset, input) {
        if (c.charCodeAt(0) === 0 /* nullCharacter */) {
            const lookAhead = input.charCodeAt(offset + c.length);
            if (lookAhead >= 48 /* _0 */ && lookAhead <= 57 /* _9 */) {
                // If the null character is followed by digits, print as a hex escape to prevent the result from parsing as an octal (which is forbidden in strict mode)
                return "\\x00";
            }
            // Otherwise, keep printing a literal \0 for the null character
            return "\\0";
        }
        return escapedCharsMap.get(c) || get16BitUnicodeEscapeSequence(c.charCodeAt(0));
    }
    function isIntrinsicJsxName(name) {
        const ch = name.charCodeAt(0);
        return (ch >= 97 /* a */ && ch <= 122 /* z */) || name.indexOf("-") > -1;
    }
    ts.isIntrinsicJsxName = isIntrinsicJsxName;
    function get16BitUnicodeEscapeSequence(charCode) {
        const hexCharCode = charCode.toString(16).toUpperCase();
        const paddedHexCode = ("0000" + hexCharCode).slice(-4);
        return "\\u" + paddedHexCode;
    }
    const nonAsciiCharacters = /[^\u0000-\u007F]/g;
    function escapeNonAsciiString(s, quoteChar) {
        s = escapeString(s, quoteChar);
        // Replace non-ASCII characters with '\uNNNN' escapes if any exist.
        // Otherwise just return the original string.
        return nonAsciiCharacters.test(s) ?
            s.replace(nonAsciiCharacters, c => get16BitUnicodeEscapeSequence(c.charCodeAt(0))) :
            s;
    }
    ts.escapeNonAsciiString = escapeNonAsciiString;
    const indentStrings = ["", "    "];
    function getIndentString(level) {
        if (indentStrings[level] === undefined) {
            indentStrings[level] = getIndentString(level - 1) + indentStrings[1];
        }
        return indentStrings[level];
    }
    ts.getIndentString = getIndentString;
    function getIndentSize() {
        return indentStrings[1].length;
    }
    ts.getIndentSize = getIndentSize;
    function createTextWriter(newLine) {
        let output;
        let indent;
        let lineStart;
        let lineCount;
        let linePos;
        function write(s) {
            if (s && s.length) {
                if (lineStart) {
                    output += getIndentString(indent);
                    lineStart = false;
                }
                output += s;
            }
        }
        function reset() {
            output = "";
            indent = 0;
            lineStart = true;
            lineCount = 0;
            linePos = 0;
        }
        function rawWrite(s) {
            if (s !== undefined) {
                if (lineStart) {
                    lineStart = false;
                }
                output += s;
            }
        }
        function writeLiteral(s) {
            if (s && s.length) {
                write(s);
                const lineStartsOfS = ts.computeLineStarts(s);
                if (lineStartsOfS.length > 1) {
                    lineCount = lineCount + lineStartsOfS.length - 1;
                    linePos = output.length - s.length + ts.lastOrUndefined(lineStartsOfS);
                }
            }
        }
        function writeLine() {
            if (!lineStart) {
                output += newLine;
                lineCount++;
                linePos = output.length;
                lineStart = true;
            }
        }
        function writeTextOfNode(text, node) {
            write(getTextOfNodeFromSourceText(text, node));
        }
        reset();
        return {
            write,
            rawWrite,
            writeTextOfNode,
            writeLiteral,
            writeLine,
            increaseIndent: () => { indent++; },
            decreaseIndent: () => { indent--; },
            getIndent: () => indent,
            getTextPos: () => output.length,
            getLine: () => lineCount + 1,
            getColumn: () => lineStart ? indent * getIndentSize() + 1 : output.length - linePos + 1,
            getText: () => output,
            isAtStartOfLine: () => lineStart,
            clear: reset,
            reportInaccessibleThisError: ts.noop,
            reportPrivateInBaseOfClassExpression: ts.noop,
            reportInaccessibleUniqueSymbolError: ts.noop,
            trackSymbol: ts.noop,
            writeKeyword: write,
            writeOperator: write,
            writeParameter: write,
            writeProperty: write,
            writePunctuation: write,
            writeSpace: write,
            writeStringLiteral: write,
            writeSymbol: write
        };
    }
    ts.createTextWriter = createTextWriter;
    function getResolvedExternalModuleName(host, file) {
        return file.moduleName || getExternalModuleNameFromPath(host, file.fileName);
    }
    ts.getResolvedExternalModuleName = getResolvedExternalModuleName;
    function getExternalModuleNameFromDeclaration(host, resolver, declaration) {
        const file = resolver.getExternalModuleFileFromDeclaration(declaration);
        if (!file || file.isDeclarationFile) {
            return undefined;
        }
        return getResolvedExternalModuleName(host, file);
    }
    ts.getExternalModuleNameFromDeclaration = getExternalModuleNameFromDeclaration;
    /**
     * Resolves a local path to a path which is absolute to the base of the emit
     */
    function getExternalModuleNameFromPath(host, fileName) {
        const getCanonicalFileName = (f) => host.getCanonicalFileName(f);
        const dir = ts.toPath(host.getCommonSourceDirectory(), host.getCurrentDirectory(), getCanonicalFileName);
        const filePath = ts.getNormalizedAbsolutePath(fileName, host.getCurrentDirectory());
        const relativePath = ts.getRelativePathToDirectoryOrUrl(dir, filePath, dir, getCanonicalFileName, /*isAbsolutePathAnUrl*/ false);
        return ts.removeFileExtension(relativePath);
    }
    ts.getExternalModuleNameFromPath = getExternalModuleNameFromPath;
    function getOwnEmitOutputFilePath(sourceFile, host, extension) {
        const compilerOptions = host.getCompilerOptions();
        let emitOutputFilePathWithoutExtension;
        if (compilerOptions.outDir) {
            emitOutputFilePathWithoutExtension = ts.removeFileExtension(getSourceFilePathInNewDir(sourceFile, host, compilerOptions.outDir));
        }
        else {
            emitOutputFilePathWithoutExtension = ts.removeFileExtension(sourceFile.fileName);
        }
        return emitOutputFilePathWithoutExtension + extension;
    }
    ts.getOwnEmitOutputFilePath = getOwnEmitOutputFilePath;
    function getDeclarationEmitOutputFilePath(sourceFile, host) {
        const options = host.getCompilerOptions();
        const outputDir = options.declarationDir || options.outDir; // Prefer declaration folder if specified
        const path = outputDir
            ? getSourceFilePathInNewDir(sourceFile, host, outputDir)
            : sourceFile.fileName;
        return ts.removeFileExtension(path) + ts.Extension.Dts;
    }
    ts.getDeclarationEmitOutputFilePath = getDeclarationEmitOutputFilePath;
    /**
     * Gets the source files that are expected to have an emit output.
     *
     * Originally part of `forEachExpectedEmitFile`, this functionality was extracted to support
     * transformations.
     *
     * @param host An EmitHost.
     * @param targetSourceFile An optional target source file to emit.
     */
    function getSourceFilesToEmit(host, targetSourceFile) {
        const options = host.getCompilerOptions();
        const isSourceFileFromExternalLibrary = (file) => host.isSourceFileFromExternalLibrary(file);
        if (options.outFile || options.out) {
            const moduleKind = ts.getEmitModuleKind(options);
            const moduleEmitEnabled = moduleKind === ts.ModuleKind.AMD || moduleKind === ts.ModuleKind.System;
            // Can emit only sources that are not declaration file and are either non module code or module with --module or --target es6 specified
            return ts.filter(host.getSourceFiles(), sourceFile => (moduleEmitEnabled || !ts.isExternalModule(sourceFile)) && sourceFileMayBeEmitted(sourceFile, options, isSourceFileFromExternalLibrary));
        }
        else {
            const sourceFiles = targetSourceFile === undefined ? host.getSourceFiles() : [targetSourceFile];
            return ts.filter(sourceFiles, sourceFile => sourceFileMayBeEmitted(sourceFile, options, isSourceFileFromExternalLibrary));
        }
    }
    ts.getSourceFilesToEmit = getSourceFilesToEmit;
    /** Don't call this for `--outFile`, just for `--outDir` or plain emit. `--outFile` needs additional checks. */
    function sourceFileMayBeEmitted(sourceFile, options, isSourceFileFromExternalLibrary) {
        return !(options.noEmitForJsFiles && isSourceFileJavaScript(sourceFile)) && !sourceFile.isDeclarationFile && !isSourceFileFromExternalLibrary(sourceFile);
    }
    ts.sourceFileMayBeEmitted = sourceFileMayBeEmitted;
    function getSourceFilePathInNewDir(sourceFile, host, newDirPath) {
        let sourceFilePath = ts.getNormalizedAbsolutePath(sourceFile.fileName, host.getCurrentDirectory());
        const commonSourceDirectory = host.getCommonSourceDirectory();
        const isSourceFileInCommonSourceDirectory = host.getCanonicalFileName(sourceFilePath).indexOf(host.getCanonicalFileName(commonSourceDirectory)) === 0;
        sourceFilePath = isSourceFileInCommonSourceDirectory ? sourceFilePath.substring(commonSourceDirectory.length) : sourceFilePath;
        return ts.combinePaths(newDirPath, sourceFilePath);
    }
    ts.getSourceFilePathInNewDir = getSourceFilePathInNewDir;
    function writeFile(host, diagnostics, fileName, data, writeByteOrderMark, sourceFiles) {
        host.writeFile(fileName, data, writeByteOrderMark, hostErrorMessage => {
            diagnostics.add(ts.createCompilerDiagnostic(Diagnostics.Could_not_write_file_0_Colon_1, fileName, hostErrorMessage));
        }, sourceFiles);
    }
    ts.writeFile = writeFile;
    function getLineOfLocalPosition(currentSourceFile, pos) {
        return ts.getLineAndCharacterOfPosition(currentSourceFile, pos).line;
    }
    ts.getLineOfLocalPosition = getLineOfLocalPosition;
    function getLineOfLocalPositionFromLineMap(lineMap, pos) {
        return ts.computeLineAndCharacterOfPosition(lineMap, pos).line;
    }
    ts.getLineOfLocalPositionFromLineMap = getLineOfLocalPositionFromLineMap;
    function getFirstConstructorWithBody(node) {
        return ts.find(node.members, (member) => ts.isConstructorDeclaration(member) && nodeIsPresent(member.body));
    }
    ts.getFirstConstructorWithBody = getFirstConstructorWithBody;
    function getSetAccessorValueParameter(accessor) {
        if (accessor && accessor.parameters.length > 0) {
            const hasThis = accessor.parameters.length === 2 && parameterIsThisKeyword(accessor.parameters[0]);
            return accessor.parameters[hasThis ? 1 : 0];
        }
    }
    /** Get the type annotation for the value parameter. */
    function getSetAccessorTypeAnnotationNode(accessor) {
        const parameter = getSetAccessorValueParameter(accessor);
        return parameter && parameter.type;
    }
    ts.getSetAccessorTypeAnnotationNode = getSetAccessorTypeAnnotationNode;
    function getThisParameter(signature) {
        if (signature.parameters.length) {
            const thisParameter = signature.parameters[0];
            if (parameterIsThisKeyword(thisParameter)) {
                return thisParameter;
            }
        }
    }
    ts.getThisParameter = getThisParameter;
    function parameterIsThisKeyword(parameter) {
        return isThisIdentifier(parameter.name);
    }
    ts.parameterIsThisKeyword = parameterIsThisKeyword;
    function isThisIdentifier(node) {
        return node && node.kind === ts.SyntaxKind.Identifier && identifierIsThisKeyword(node);
    }
    ts.isThisIdentifier = isThisIdentifier;
    function identifierIsThisKeyword(id) {
        return id.originalKeywordKind === ts.SyntaxKind.ThisKeyword;
    }
    ts.identifierIsThisKeyword = identifierIsThisKeyword;
    function getAllAccessorDeclarations(declarations, accessor) {
        let firstAccessor;
        let secondAccessor;
        let getAccessor;
        let setAccessor;
        if (hasDynamicName(accessor)) {
            firstAccessor = accessor;
            if (accessor.kind === ts.SyntaxKind.GetAccessor) {
                getAccessor = accessor;
            }
            else if (accessor.kind === ts.SyntaxKind.SetAccessor) {
                setAccessor = accessor;
            }
            else {
                ts.Debug.fail("Accessor has wrong kind");
            }
        }
        else {
            ts.forEach(declarations, (member) => {
                if ((member.kind === ts.SyntaxKind.GetAccessor || member.kind === ts.SyntaxKind.SetAccessor)
                    && hasModifier(member, ts.ModifierFlags.Static) === hasModifier(accessor, ts.ModifierFlags.Static)) {
                    const memberName = getPropertyNameForPropertyNameNode(member.name);
                    const accessorName = getPropertyNameForPropertyNameNode(accessor.name);
                    if (memberName === accessorName) {
                        if (!firstAccessor) {
                            firstAccessor = member;
                        }
                        else if (!secondAccessor) {
                            secondAccessor = member;
                        }
                        if (member.kind === ts.SyntaxKind.GetAccessor && !getAccessor) {
                            getAccessor = member;
                        }
                        if (member.kind === ts.SyntaxKind.SetAccessor && !setAccessor) {
                            setAccessor = member;
                        }
                    }
                }
            });
        }
        return {
            firstAccessor,
            secondAccessor,
            getAccessor,
            setAccessor
        };
    }
    ts.getAllAccessorDeclarations = getAllAccessorDeclarations;
    /**
     * Gets the effective type annotation of a variable, parameter, or property. If the node was
     * parsed in a JavaScript file, gets the type annotation from JSDoc.
     */
    function getEffectiveTypeAnnotationNode(node) {
        return node.type || (isInJavaScriptFile(node) ? ts.getJSDocType(node) : undefined);
    }
    ts.getEffectiveTypeAnnotationNode = getEffectiveTypeAnnotationNode;
    function getTypeAnnotationNode(node) {
        return node.type;
    }
    ts.getTypeAnnotationNode = getTypeAnnotationNode;
    /**
     * Gets the effective return type annotation of a signature. If the node was parsed in a
     * JavaScript file, gets the return type annotation from JSDoc.
     */
    function getEffectiveReturnTypeNode(node) {
        return node.type || (isInJavaScriptFile(node) ? ts.getJSDocReturnType(node) : undefined);
    }
    ts.getEffectiveReturnTypeNode = getEffectiveReturnTypeNode;
    /**
     * Gets the effective type parameters. If the node was parsed in a
     * JavaScript file, gets the type parameters from the `@template` tag from JSDoc.
     */
    function getEffectiveTypeParameterDeclarations(node) {
        return node.typeParameters || (isInJavaScriptFile(node) ? getJSDocTypeParameterDeclarations(node) : undefined);
    }
    ts.getEffectiveTypeParameterDeclarations = getEffectiveTypeParameterDeclarations;
    function getJSDocTypeParameterDeclarations(node) {
        const templateTag = ts.getJSDocTemplateTag(node);
        return templateTag && templateTag.typeParameters;
    }
    ts.getJSDocTypeParameterDeclarations = getJSDocTypeParameterDeclarations;
    /**
     * Gets the effective type annotation of the value parameter of a set accessor. If the node
     * was parsed in a JavaScript file, gets the type annotation from JSDoc.
     */
    function getEffectiveSetAccessorTypeAnnotationNode(node) {
        const parameter = getSetAccessorValueParameter(node);
        return parameter && getEffectiveTypeAnnotationNode(parameter);
    }
    ts.getEffectiveSetAccessorTypeAnnotationNode = getEffectiveSetAccessorTypeAnnotationNode;
    function emitNewLineBeforeLeadingComments(lineMap, writer, node, leadingComments) {
        emitNewLineBeforeLeadingCommentsOfPosition(lineMap, writer, node.pos, leadingComments);
    }
    ts.emitNewLineBeforeLeadingComments = emitNewLineBeforeLeadingComments;
    function emitNewLineBeforeLeadingCommentsOfPosition(lineMap, writer, pos, leadingComments) {
        // If the leading comments start on different line than the start of node, write new line
        if (leadingComments && leadingComments.length && pos !== leadingComments[0].pos &&
            getLineOfLocalPositionFromLineMap(lineMap, pos) !== getLineOfLocalPositionFromLineMap(lineMap, leadingComments[0].pos)) {
            writer.writeLine();
        }
    }
    ts.emitNewLineBeforeLeadingCommentsOfPosition = emitNewLineBeforeLeadingCommentsOfPosition;
    function emitNewLineBeforeLeadingCommentOfPosition(lineMap, writer, pos, commentPos) {
        // If the leading comments start on different line than the start of node, write new line
        if (pos !== commentPos &&
            getLineOfLocalPositionFromLineMap(lineMap, pos) !== getLineOfLocalPositionFromLineMap(lineMap, commentPos)) {
            writer.writeLine();
        }
    }
    ts.emitNewLineBeforeLeadingCommentOfPosition = emitNewLineBeforeLeadingCommentOfPosition;
    function emitComments(text, lineMap, writer, comments, leadingSeparator, trailingSeparator, newLine, writeComment) {
        if (comments && comments.length > 0) {
            if (leadingSeparator) {
                writer.write(" ");
            }
            let emitInterveningSeparator = false;
            for (const comment of comments) {
                if (emitInterveningSeparator) {
                    writer.write(" ");
                    emitInterveningSeparator = false;
                }
                writeComment(text, lineMap, writer, comment.pos, comment.end, newLine);
                if (comment.hasTrailingNewLine) {
                    writer.writeLine();
                }
                else {
                    emitInterveningSeparator = true;
                }
            }
            if (emitInterveningSeparator && trailingSeparator) {
                writer.write(" ");
            }
        }
    }
    ts.emitComments = emitComments;
    /**
     * Detached comment is a comment at the top of file or function body that is separated from
     * the next statement by space.
     */
    function emitDetachedComments(text, lineMap, writer, writeComment, node, newLine, removeComments) {
        let leadingComments;
        let currentDetachedCommentInfo;
        if (removeComments) {
            // removeComments is true, only reserve pinned comment at the top of file
            // For example:
            //      /*! Pinned Comment */
            //
            //      var x = 10;
            if (node.pos === 0) {
                leadingComments = ts.filter(ts.getLeadingCommentRanges(text, node.pos), isPinnedCommentLocal);
            }
        }
        else {
            // removeComments is false, just get detached as normal and bypass the process to filter comment
            leadingComments = ts.getLeadingCommentRanges(text, node.pos);
        }
        if (leadingComments) {
            const detachedComments = [];
            let lastComment;
            for (const comment of leadingComments) {
                if (lastComment) {
                    const lastCommentLine = getLineOfLocalPositionFromLineMap(lineMap, lastComment.end);
                    const commentLine = getLineOfLocalPositionFromLineMap(lineMap, comment.pos);
                    if (commentLine >= lastCommentLine + 2) {
                        // There was a blank line between the last comment and this comment.  This
                        // comment is not part of the copyright comments.  Return what we have so
                        // far.
                        break;
                    }
                }
                detachedComments.push(comment);
                lastComment = comment;
            }
            if (detachedComments.length) {
                // All comments look like they could have been part of the copyright header.  Make
                // sure there is at least one blank line between it and the node.  If not, it's not
                // a copyright header.
                const lastCommentLine = getLineOfLocalPositionFromLineMap(lineMap, ts.lastOrUndefined(detachedComments).end);
                const nodeLine = getLineOfLocalPositionFromLineMap(lineMap, ts.skipTrivia(text, node.pos));
                if (nodeLine >= lastCommentLine + 2) {
                    // Valid detachedComments
                    emitNewLineBeforeLeadingComments(lineMap, writer, node, leadingComments);
                    emitComments(text, lineMap, writer, detachedComments, /*leadingSeparator*/ false, /*trailingSeparator*/ true, newLine, writeComment);
                    currentDetachedCommentInfo = { nodePos: node.pos, detachedCommentEndPos: ts.lastOrUndefined(detachedComments).end };
                }
            }
        }
        return currentDetachedCommentInfo;
        function isPinnedCommentLocal(comment) {
            return isPinnedComment(text, comment.pos);
        }
    }
    ts.emitDetachedComments = emitDetachedComments;
    function writeCommentRange(text, lineMap, writer, commentPos, commentEnd, newLine) {
        if (text.charCodeAt(commentPos + 1) === 42 /* asterisk */) {
            const firstCommentLineAndCharacter = ts.computeLineAndCharacterOfPosition(lineMap, commentPos);
            const lineCount = lineMap.length;
            let firstCommentLineIndent;
            for (let pos = commentPos, currentLine = firstCommentLineAndCharacter.line; pos < commentEnd; currentLine++) {
                const nextLineStart = (currentLine + 1) === lineCount
                    ? text.length + 1
                    : lineMap[currentLine + 1];
                if (pos !== commentPos) {
                    // If we are not emitting first line, we need to write the spaces to adjust the alignment
                    if (firstCommentLineIndent === undefined) {
                        firstCommentLineIndent = calculateIndent(text, lineMap[firstCommentLineAndCharacter.line], commentPos);
                    }
                    // These are number of spaces writer is going to write at current indent
                    const currentWriterIndentSpacing = writer.getIndent() * getIndentSize();
                    // Number of spaces we want to be writing
                    // eg: Assume writer indent
                    // module m {
                    //         /* starts at character 9 this is line 1
                    //    * starts at character pos 4 line                        --1  = 8 - 8 + 3
                    //   More left indented comment */                            --2  = 8 - 8 + 2
                    //     class c { }
                    // }
                    // module m {
                    //     /* this is line 1 -- Assume current writer indent 8
                    //      * line                                                --3 = 8 - 4 + 5
                    //            More right indented comment */                  --4 = 8 - 4 + 11
                    //     class c { }
                    // }
                    const spacesToEmit = currentWriterIndentSpacing - firstCommentLineIndent + calculateIndent(text, pos, nextLineStart);
                    if (spacesToEmit > 0) {
                        let numberOfSingleSpacesToEmit = spacesToEmit % getIndentSize();
                        const indentSizeSpaceString = getIndentString((spacesToEmit - numberOfSingleSpacesToEmit) / getIndentSize());
                        // Write indent size string ( in eg 1: = "", 2: "" , 3: string with 8 spaces 4: string with 12 spaces
                        writer.rawWrite(indentSizeSpaceString);
                        // Emit the single spaces (in eg: 1: 3 spaces, 2: 2 spaces, 3: 1 space, 4: 3 spaces)
                        while (numberOfSingleSpacesToEmit) {
                            writer.rawWrite(" ");
                            numberOfSingleSpacesToEmit--;
                        }
                    }
                    else {
                        // No spaces to emit write empty string
                        writer.rawWrite("");
                    }
                }
                // Write the comment line text
                writeTrimmedCurrentLine(text, commentEnd, writer, newLine, pos, nextLineStart);
                pos = nextLineStart;
            }
        }
        else {
            // Single line comment of style //....
            writer.write(text.substring(commentPos, commentEnd));
        }
    }
    ts.writeCommentRange = writeCommentRange;
    function writeTrimmedCurrentLine(text, commentEnd, writer, newLine, pos, nextLineStart) {
        const end = Math.min(commentEnd, nextLineStart - 1);
        const currentLineText = text.substring(pos, end).replace(/^\s+|\s+$/g, "");
        if (currentLineText) {
            // trimmed forward and ending spaces text
            writer.write(currentLineText);
            if (end !== commentEnd) {
                writer.writeLine();
            }
        }
        else {
            // Empty string - make sure we write empty line
            writer.writeLiteral(newLine);
        }
    }
    function calculateIndent(text, pos, end) {
        let currentLineIndent = 0;
        for (; pos < end && ts.isWhiteSpaceSingleLine(text.charCodeAt(pos)); pos++) {
            if (text.charCodeAt(pos) === 9 /* tab */) {
                // Tabs = TabSize = indent size and go to next tabStop
                currentLineIndent += getIndentSize() - (currentLineIndent % getIndentSize());
            }
            else {
                // Single space
                currentLineIndent++;
            }
        }
        return currentLineIndent;
    }
    function hasModifiers(node) {
        return getModifierFlags(node) !== ts.ModifierFlags.None;
    }
    ts.hasModifiers = hasModifiers;
    function hasModifier(node, flags) {
        return !!getSelectedModifierFlags(node, flags);
    }
    ts.hasModifier = hasModifier;
    function hasStaticModifier(node) {
        return hasModifier(node, ts.ModifierFlags.Static);
    }
    ts.hasStaticModifier = hasStaticModifier;
    function hasReadonlyModifier(node) {
        return hasModifier(node, ts.ModifierFlags.Readonly);
    }
    ts.hasReadonlyModifier = hasReadonlyModifier;
    function getSelectedModifierFlags(node, flags) {
        return getModifierFlags(node) & flags;
    }
    ts.getSelectedModifierFlags = getSelectedModifierFlags;
    function getModifierFlags(node) {
        if (node.modifierFlagsCache & ts.ModifierFlags.HasComputedFlags) {
            return node.modifierFlagsCache & ~ts.ModifierFlags.HasComputedFlags;
        }
        const flags = getModifierFlagsNoCache(node);
        node.modifierFlagsCache = flags | ts.ModifierFlags.HasComputedFlags;
        return flags;
    }
    ts.getModifierFlags = getModifierFlags;
    function getModifierFlagsNoCache(node) {
        let flags = ts.ModifierFlags.None;
        if (node.modifiers) {
            for (const modifier of node.modifiers) {
                flags |= modifierToFlag(modifier.kind);
            }
        }
        if (node.flags & ts.NodeFlags.NestedNamespace || (node.kind === ts.SyntaxKind.Identifier && node.isInJSDocNamespace)) {
            flags |= ts.ModifierFlags.Export;
        }
        return flags;
    }
    ts.getModifierFlagsNoCache = getModifierFlagsNoCache;
    function modifierToFlag(token) {
        switch (token) {
            case ts.SyntaxKind.StaticKeyword: return ts.ModifierFlags.Static;
            case ts.SyntaxKind.PublicKeyword: return ts.ModifierFlags.Public;
            case ts.SyntaxKind.ProtectedKeyword: return ts.ModifierFlags.Protected;
            case ts.SyntaxKind.PrivateKeyword: return ts.ModifierFlags.Private;
            case ts.SyntaxKind.AbstractKeyword: return ts.ModifierFlags.Abstract;
            case ts.SyntaxKind.ExportKeyword: return ts.ModifierFlags.Export;
            case ts.SyntaxKind.DeclareKeyword: return ts.ModifierFlags.Ambient;
            case ts.SyntaxKind.ConstKeyword: return ts.ModifierFlags.Const;
            case ts.SyntaxKind.DefaultKeyword: return ts.ModifierFlags.Default;
            case ts.SyntaxKind.AsyncKeyword: return ts.ModifierFlags.Async;
            case ts.SyntaxKind.ReadonlyKeyword: return ts.ModifierFlags.Readonly;
        }
        return ts.ModifierFlags.None;
    }
    ts.modifierToFlag = modifierToFlag;
    function isLogicalOperator(token) {
        return token === ts.SyntaxKind.BarBarToken
            || token === ts.SyntaxKind.AmpersandAmpersandToken
            || token === ts.SyntaxKind.ExclamationToken;
    }
    ts.isLogicalOperator = isLogicalOperator;
    function isAssignmentOperator(token) {
        return token >= ts.SyntaxKind.FirstAssignment && token <= ts.SyntaxKind.LastAssignment;
    }
    ts.isAssignmentOperator = isAssignmentOperator;
    /** Get `C` given `N` if `N` is in the position `class C extends N` where `N` is an ExpressionWithTypeArguments. */
    function tryGetClassExtendingExpressionWithTypeArguments(node) {
        if (node.kind === ts.SyntaxKind.ExpressionWithTypeArguments &&
            node.parent.token === ts.SyntaxKind.ExtendsKeyword &&
            ts.isClassLike(node.parent.parent)) {
            return node.parent.parent;
        }
    }
    ts.tryGetClassExtendingExpressionWithTypeArguments = tryGetClassExtendingExpressionWithTypeArguments;
    function isAssignmentExpression(node, excludeCompoundAssignment) {
        return ts.isBinaryExpression(node)
            && (excludeCompoundAssignment
                ? node.operatorToken.kind === ts.SyntaxKind.EqualsToken
                : isAssignmentOperator(node.operatorToken.kind))
            && ts.isLeftHandSideExpression(node.left);
    }
    ts.isAssignmentExpression = isAssignmentExpression;
    function isDestructuringAssignment(node) {
        if (isAssignmentExpression(node, /*excludeCompoundAssignment*/ true)) {
            const kind = node.left.kind;
            return kind === ts.SyntaxKind.ObjectLiteralExpression
                || kind === ts.SyntaxKind.ArrayLiteralExpression;
        }
        return false;
    }
    ts.isDestructuringAssignment = isDestructuringAssignment;
    function isExpressionWithTypeArgumentsInClassExtendsClause(node) {
        return tryGetClassExtendingExpressionWithTypeArguments(node) !== undefined;
    }
    ts.isExpressionWithTypeArgumentsInClassExtendsClause = isExpressionWithTypeArgumentsInClassExtendsClause;
    function isExpressionWithTypeArgumentsInClassImplementsClause(node) {
        return node.kind === ts.SyntaxKind.ExpressionWithTypeArguments
            && isEntityNameExpression(node.expression)
            && node.parent
            && node.parent.token === ts.SyntaxKind.ImplementsKeyword
            && node.parent.parent
            && ts.isClassLike(node.parent.parent);
    }
    ts.isExpressionWithTypeArgumentsInClassImplementsClause = isExpressionWithTypeArgumentsInClassImplementsClause;
    function isEntityNameExpression(node) {
        return node.kind === ts.SyntaxKind.Identifier || isPropertyAccessEntityNameExpression(node);
    }
    ts.isEntityNameExpression = isEntityNameExpression;
    function isPropertyAccessEntityNameExpression(node) {
        return ts.isPropertyAccessExpression(node) && isEntityNameExpression(node.expression);
    }
    ts.isPropertyAccessEntityNameExpression = isPropertyAccessEntityNameExpression;
    function isPrototypeAccess(node) {
        return ts.isPropertyAccessExpression(node) && node.name.escapedText === "prototype";
    }
    ts.isPrototypeAccess = isPrototypeAccess;
    function isRightSideOfQualifiedNameOrPropertyAccess(node) {
        return (node.parent.kind === ts.SyntaxKind.QualifiedName && node.parent.right === node) ||
            (node.parent.kind === ts.SyntaxKind.PropertyAccessExpression && node.parent.name === node);
    }
    ts.isRightSideOfQualifiedNameOrPropertyAccess = isRightSideOfQualifiedNameOrPropertyAccess;
    function isEmptyObjectLiteral(expression) {
        return expression.kind === ts.SyntaxKind.ObjectLiteralExpression &&
            expression.properties.length === 0;
    }
    ts.isEmptyObjectLiteral = isEmptyObjectLiteral;
    function isEmptyArrayLiteral(expression) {
        return expression.kind === ts.SyntaxKind.ArrayLiteralExpression &&
            expression.elements.length === 0;
    }
    ts.isEmptyArrayLiteral = isEmptyArrayLiteral;
    function getLocalSymbolForExportDefault(symbol) {
        return isExportDefaultSymbol(symbol) ? symbol.declarations[0].localSymbol : undefined;
    }
    ts.getLocalSymbolForExportDefault = getLocalSymbolForExportDefault;
    function isExportDefaultSymbol(symbol) {
        return symbol && ts.length(symbol.declarations) > 0 && hasModifier(symbol.declarations[0], ts.ModifierFlags.Default);
    }
    /** Return ".ts", ".d.ts", or ".tsx", if that is the extension. */
    function tryExtractTypeScriptExtension(fileName) {
        return ts.find(ts.supportedTypescriptExtensionsForExtractExtension, extension => ts.fileExtensionIs(fileName, extension));
    }
    ts.tryExtractTypeScriptExtension = tryExtractTypeScriptExtension;
    /**
     * Replace each instance of non-ascii characters by one, two, three, or four escape sequences
     * representing the UTF-8 encoding of the character, and return the expanded char code list.
     */
    function getExpandedCharCodes(input) {
        const output = [];
        const length = input.length;
        for (let i = 0; i < length; i++) {
            const charCode = input.charCodeAt(i);
            // handle utf8
            if (charCode < 0x80) {
                output.push(charCode);
            }
            else if (charCode < 0x800) {
                output.push((charCode >> 6) | 0B11000000);
                output.push((charCode & 0B00111111) | 0B10000000);
            }
            else if (charCode < 0x10000) {
                output.push((charCode >> 12) | 0B11100000);
                output.push(((charCode >> 6) & 0B00111111) | 0B10000000);
                output.push((charCode & 0B00111111) | 0B10000000);
            }
            else if (charCode < 0x20000) {
                output.push((charCode >> 18) | 0B11110000);
                output.push(((charCode >> 12) & 0B00111111) | 0B10000000);
                output.push(((charCode >> 6) & 0B00111111) | 0B10000000);
                output.push((charCode & 0B00111111) | 0B10000000);
            }
            else {
                ts.Debug.assert(false, "Unexpected code point");
            }
        }
        return output;
    }
    const base64Digits = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    /**
     * Converts a string to a base-64 encoded ASCII string.
     */
    function convertToBase64(input) {
        let result = "";
        const charCodes = getExpandedCharCodes(input);
        let i = 0;
        const length = charCodes.length;
        let byte1, byte2, byte3, byte4;
        while (i < length) {
            // Convert every 6-bits in the input 3 character points
            // into a base64 digit
            byte1 = charCodes[i] >> 2;
            byte2 = (charCodes[i] & 0B00000011) << 4 | charCodes[i + 1] >> 4;
            byte3 = (charCodes[i + 1] & 0B00001111) << 2 | charCodes[i + 2] >> 6;
            byte4 = charCodes[i + 2] & 0B00111111;
            // We are out of characters in the input, set the extra
            // digits to 64 (padding character).
            if (i + 1 >= length) {
                byte3 = byte4 = 64;
            }
            else if (i + 2 >= length) {
                byte4 = 64;
            }
            // Write to the output
            result += base64Digits.charAt(byte1) + base64Digits.charAt(byte2) + base64Digits.charAt(byte3) + base64Digits.charAt(byte4);
            i += 3;
        }
        return result;
    }
    ts.convertToBase64 = convertToBase64;
    function getStringFromExpandedCharCodes(codes) {
        let output = "";
        let i = 0;
        const length = codes.length;
        while (i < length) {
            const charCode = codes[i];
            if (charCode < 0x80) {
                output += String.fromCharCode(charCode);
                i++;
            }
            else if ((charCode & 0B11000000) === 0B11000000) {
                let value = charCode & 0B00111111;
                i++;
                let nextCode = codes[i];
                while ((nextCode & 0B11000000) === 0B10000000) {
                    value = (value << 6) | (nextCode & 0B00111111);
                    i++;
                    nextCode = codes[i];
                }
                // `value` may be greater than 10FFFF (the maximum unicode codepoint) - JS will just make this into an invalid character for us
                output += String.fromCharCode(value);
            }
            else {
                // We don't want to kill the process when decoding fails (due to a following char byte not
                // following a leading char), so we just print the (bad) value
                output += String.fromCharCode(charCode);
                i++;
            }
        }
        return output;
    }
    function base64encode(host, input) {
        if (host.base64encode) {
            return host.base64encode(input);
        }
        return convertToBase64(input);
    }
    ts.base64encode = base64encode;
    function base64decode(host, input) {
        if (host.base64decode) {
            return host.base64decode(input);
        }
        const length = input.length;
        const expandedCharCodes = [];
        let i = 0;
        while (i < length) {
            // Stop decoding once padding characters are present
            if (input.charCodeAt(i) === base64Digits.charCodeAt(64)) {
                break;
            }
            // convert 4 input digits into three characters, ignoring padding characters at the end
            const ch1 = base64Digits.indexOf(input[i]);
            const ch2 = base64Digits.indexOf(input[i + 1]);
            const ch3 = base64Digits.indexOf(input[i + 2]);
            const ch4 = base64Digits.indexOf(input[i + 3]);
            const code1 = ((ch1 & 0B00111111) << 2) | ((ch2 >> 4) & 0B00000011);
            const code2 = ((ch2 & 0B00001111) << 4) | ((ch3 >> 2) & 0B00001111);
            const code3 = ((ch3 & 0B00000011) << 6) | (ch4 & 0B00111111);
            if (code2 === 0 && ch3 !== 0) { // code2 decoded to zero, but ch3 was padding - elide code2 and code3
                expandedCharCodes.push(code1);
            }
            else if (code3 === 0 && ch4 !== 0) { // code3 decoded to zero, but ch4 was padding, elide code3
                expandedCharCodes.push(code1, code2);
            }
            else {
                expandedCharCodes.push(code1, code2, code3);
            }
            i += 4;
        }
        return getStringFromExpandedCharCodes(expandedCharCodes);
    }
    ts.base64decode = base64decode;
    const carriageReturnLineFeed = "\r\n";
    const lineFeed = "\n";
    function getNewLineCharacter(options, getNewLine) {
        switch (options.newLine) {
            case ts.NewLineKind.CarriageReturnLineFeed:
                return carriageReturnLineFeed;
            case ts.NewLineKind.LineFeed:
                return lineFeed;
        }
        return getNewLine ? getNewLine() : ts.sys ? ts.sys.newLine : carriageReturnLineFeed;
    }
    ts.getNewLineCharacter = getNewLineCharacter;
    /**
     * Formats an enum value as a string for debugging and debug assertions.
     */
    function formatEnum(value = 0, enumObject, isFlags) {
        const members = getEnumMembers(enumObject);
        if (value === 0) {
            return members.length > 0 && members[0][0] === 0 ? members[0][1] : "0";
        }
        if (isFlags) {
            let result = "";
            let remainingFlags = value;
            for (let i = members.length - 1; i >= 0 && remainingFlags !== 0; i--) {
                const [enumValue, enumName] = members[i];
                if (enumValue !== 0 && (remainingFlags & enumValue) === enumValue) {
                    remainingFlags &= ~enumValue;
                    result = `${enumName}${result ? ", " : ""}${result}`;
                }
            }
            if (remainingFlags === 0) {
                return result;
            }
        }
        else {
            for (const [enumValue, enumName] of members) {
                if (enumValue === value) {
                    return enumName;
                }
            }
        }
        return value.toString();
    }
    function getEnumMembers(enumObject) {
        const result = [];
        for (const name in enumObject) {
            const value = enumObject[name];
            if (typeof value === "number") {
                result.push([value, name]);
            }
        }
        return ts.stableSort(result, (x, y) => ts.compareValues(x[0], y[0]));
    }
    function formatSyntaxKind(kind) {
        return formatEnum(kind, ts.SyntaxKind, /*isFlags*/ false);
    }
    ts.formatSyntaxKind = formatSyntaxKind;
    function formatModifierFlags(flags) {
        return formatEnum(flags, ts.ModifierFlags, /*isFlags*/ true);
    }
    ts.formatModifierFlags = formatModifierFlags;
    function formatTransformFlags(flags) {
        return formatEnum(flags, ts.TransformFlags, /*isFlags*/ true);
    }
    ts.formatTransformFlags = formatTransformFlags;
    function formatEmitFlags(flags) {
        return formatEnum(flags, ts.EmitFlags, /*isFlags*/ true);
    }
    ts.formatEmitFlags = formatEmitFlags;
    function formatSymbolFlags(flags) {
        return formatEnum(flags, ts.SymbolFlags, /*isFlags*/ true);
    }
    ts.formatSymbolFlags = formatSymbolFlags;
    function formatTypeFlags(flags) {
        return formatEnum(flags, ts.TypeFlags, /*isFlags*/ true);
    }
    ts.formatTypeFlags = formatTypeFlags;
    function formatObjectFlags(flags) {
        return formatEnum(flags, ts.ObjectFlags, /*isFlags*/ true);
    }
    ts.formatObjectFlags = formatObjectFlags;
    /**
     * Creates a new TextRange from the provided pos and end.
     *
     * @param pos The start position.
     * @param end The end position.
     */
    function createRange(pos, end) {
        return { pos, end };
    }
    ts.createRange = createRange;
    /**
     * Creates a new TextRange from a provided range with a new end position.
     *
     * @param range A TextRange.
     * @param end The new end position.
     */
    function moveRangeEnd(range, end) {
        return createRange(range.pos, end);
    }
    ts.moveRangeEnd = moveRangeEnd;
    /**
     * Creates a new TextRange from a provided range with a new start position.
     *
     * @param range A TextRange.
     * @param pos The new Start position.
     */
    function moveRangePos(range, pos) {
        return createRange(pos, range.end);
    }
    ts.moveRangePos = moveRangePos;
    /**
     * Moves the start position of a range past any decorators.
     */
    function moveRangePastDecorators(node) {
        return node.decorators && node.decorators.length > 0
            ? moveRangePos(node, node.decorators.end)
            : node;
    }
    ts.moveRangePastDecorators = moveRangePastDecorators;
    /**
     * Moves the start position of a range past any decorators or modifiers.
     */
    function moveRangePastModifiers(node) {
        return node.modifiers && node.modifiers.length > 0
            ? moveRangePos(node, node.modifiers.end)
            : moveRangePastDecorators(node);
    }
    ts.moveRangePastModifiers = moveRangePastModifiers;
    /**
     * Determines whether a TextRange has the same start and end positions.
     *
     * @param range A TextRange.
     */
    function isCollapsedRange(range) {
        return range.pos === range.end;
    }
    ts.isCollapsedRange = isCollapsedRange;
    /**
     * Creates a new TextRange for a token at the provides start position.
     *
     * @param pos The start position.
     * @param token The token.
     */
    function createTokenRange(pos, token) {
        return createRange(pos, pos + ts.tokenToString(token).length);
    }
    ts.createTokenRange = createTokenRange;
    function rangeIsOnSingleLine(range, sourceFile) {
        return rangeStartIsOnSameLineAsRangeEnd(range, range, sourceFile);
    }
    ts.rangeIsOnSingleLine = rangeIsOnSingleLine;
    function rangeStartPositionsAreOnSameLine(range1, range2, sourceFile) {
        return positionsAreOnSameLine(getStartPositionOfRange(range1, sourceFile), getStartPositionOfRange(range2, sourceFile), sourceFile);
    }
    ts.rangeStartPositionsAreOnSameLine = rangeStartPositionsAreOnSameLine;
    function rangeEndPositionsAreOnSameLine(range1, range2, sourceFile) {
        return positionsAreOnSameLine(range1.end, range2.end, sourceFile);
    }
    ts.rangeEndPositionsAreOnSameLine = rangeEndPositionsAreOnSameLine;
    function rangeStartIsOnSameLineAsRangeEnd(range1, range2, sourceFile) {
        return positionsAreOnSameLine(getStartPositionOfRange(range1, sourceFile), range2.end, sourceFile);
    }
    ts.rangeStartIsOnSameLineAsRangeEnd = rangeStartIsOnSameLineAsRangeEnd;
    function rangeEndIsOnSameLineAsRangeStart(range1, range2, sourceFile) {
        return positionsAreOnSameLine(range1.end, getStartPositionOfRange(range2, sourceFile), sourceFile);
    }
    ts.rangeEndIsOnSameLineAsRangeStart = rangeEndIsOnSameLineAsRangeStart;
    function positionsAreOnSameLine(pos1, pos2, sourceFile) {
        return pos1 === pos2 ||
            getLineOfLocalPosition(sourceFile, pos1) === getLineOfLocalPosition(sourceFile, pos2);
    }
    ts.positionsAreOnSameLine = positionsAreOnSameLine;
    function getStartPositionOfRange(range, sourceFile) {
        return ts.positionIsSynthesized(range.pos) ? -1 : ts.skipTrivia(sourceFile.text, range.pos);
    }
    ts.getStartPositionOfRange = getStartPositionOfRange;
    /**
     * Determines whether a name was originally the declaration name of an enum or namespace
     * declaration.
     */
    function isDeclarationNameOfEnumOrNamespace(node) {
        const parseNode = ts.getParseTreeNode(node);
        if (parseNode) {
            switch (parseNode.parent.kind) {
                case ts.SyntaxKind.EnumDeclaration:
                case ts.SyntaxKind.ModuleDeclaration:
                    return parseNode === parseNode.parent.name;
            }
        }
        return false;
    }
    ts.isDeclarationNameOfEnumOrNamespace = isDeclarationNameOfEnumOrNamespace;
    function getInitializedVariables(node) {
        return ts.filter(node.declarations, isInitializedVariable);
    }
    ts.getInitializedVariables = getInitializedVariables;
    function isInitializedVariable(node) {
        return node.initializer !== undefined;
    }
    function isWatchSet(options) {
        // Firefox has Object.prototype.watch
        return options.watch && options.hasOwnProperty("watch");
    }
    ts.isWatchSet = isWatchSet;
    function getCheckFlags(symbol) {
        return symbol.flags & ts.SymbolFlags.Transient ? symbol.checkFlags : 0;
    }
    ts.getCheckFlags = getCheckFlags;
    function getDeclarationModifierFlagsFromSymbol(s) {
        if (s.valueDeclaration) {
            const flags = ts.getCombinedModifierFlags(s.valueDeclaration);
            return s.parent && s.parent.flags & ts.SymbolFlags.Class ? flags : flags & ~ts.ModifierFlags.AccessibilityModifier;
        }
        if (getCheckFlags(s) & 6 /* Synthetic */) {
            const checkFlags = s.checkFlags;
            const accessModifier = checkFlags & 256 /* ContainsPrivate */ ? ts.ModifierFlags.Private :
                checkFlags & 64 /* ContainsPublic */ ? ts.ModifierFlags.Public :
                    ts.ModifierFlags.Protected;
            const staticModifier = checkFlags & 512 /* ContainsStatic */ ? ts.ModifierFlags.Static : 0;
            return accessModifier | staticModifier;
        }
        if (s.flags & ts.SymbolFlags.Prototype) {
            return ts.ModifierFlags.Public | ts.ModifierFlags.Static;
        }
        return 0;
    }
    ts.getDeclarationModifierFlagsFromSymbol = getDeclarationModifierFlagsFromSymbol;
    function skipAlias(symbol, checker) {
        return symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    }
    ts.skipAlias = skipAlias;
    /** See comment on `declareModuleMember` in `binder.ts`. */
    function getCombinedLocalAndExportSymbolFlags(symbol) {
        return symbol.exportSymbol ? symbol.exportSymbol.flags | symbol.flags : symbol.flags;
    }
    ts.getCombinedLocalAndExportSymbolFlags = getCombinedLocalAndExportSymbolFlags;
    function isWriteOnlyAccess(node) {
        return accessKind(node) === 1 /* Write */;
    }
    ts.isWriteOnlyAccess = isWriteOnlyAccess;
    function isWriteAccess(node) {
        return accessKind(node) !== 0 /* Read */;
    }
    ts.isWriteAccess = isWriteAccess;
    function accessKind(node) {
        const { parent } = node;
        if (!parent)
            return 0 /* Read */;
        switch (parent.kind) {
            case ts.SyntaxKind.PostfixUnaryExpression:
            case ts.SyntaxKind.PrefixUnaryExpression:
                const { operator } = parent;
                return operator === ts.SyntaxKind.PlusPlusToken || operator === ts.SyntaxKind.MinusMinusToken ? writeOrReadWrite() : 0 /* Read */;
            case ts.SyntaxKind.BinaryExpression:
                const { left, operatorToken } = parent;
                return left === node && isAssignmentOperator(operatorToken.kind) ? writeOrReadWrite() : 0 /* Read */;
            case ts.SyntaxKind.PropertyAccessExpression:
                return parent.name !== node ? 0 /* Read */ : accessKind(parent);
            default:
                return 0 /* Read */;
        }
        function writeOrReadWrite() {
            // If grandparent is not an ExpressionStatement, this is used as an expression in addition to having a side effect.
            return parent.parent && parent.parent.kind === ts.SyntaxKind.ExpressionStatement ? 1 /* Write */ : 2 /* ReadWrite */;
        }
    }
    function compareDataObjects(dst, src) {
        if (!dst || !src || Object.keys(dst).length !== Object.keys(src).length) {
            return false;
        }
        for (const e in dst) {
            if (typeof dst[e] === "object") {
                if (!compareDataObjects(dst[e], src[e])) {
                    return false;
                }
            }
            else if (typeof dst[e] !== "function") {
                if (dst[e] !== src[e]) {
                    return false;
                }
            }
        }
        return true;
    }
    ts.compareDataObjects = compareDataObjects;
    /**
     * clears already present map by calling onDeleteExistingValue callback before deleting that key/value
     */
    function clearMap(map, onDeleteValue) {
        // Remove all
        map.forEach(onDeleteValue);
        map.clear();
    }
    ts.clearMap = clearMap;
    /**
     * Mutates the map with newMap such that keys in map will be same as newMap.
     */
    function mutateMap(map, newMap, options) {
        const { createNewValue, onDeleteValue, onExistingValue } = options;
        // Needs update
        map.forEach((existingValue, key) => {
            const valueInNewMap = newMap.get(key);
            // Not present any more in new map, remove it
            if (valueInNewMap === undefined) {
                map.delete(key);
                onDeleteValue(existingValue, key);
            }
            // If present notify about existing values
            else if (onExistingValue) {
                onExistingValue(existingValue, valueInNewMap, key);
            }
        });
        // Add new values that are not already present
        newMap.forEach((valueInNewMap, key) => {
            if (!map.has(key)) {
                // New values
                map.set(key, createNewValue(key, valueInNewMap));
            }
        });
    }
    ts.mutateMap = mutateMap;
    /** Calls `callback` on `directory` and every ancestor directory it has, returning the first defined result. */
    function forEachAncestorDirectory(directory, callback) {
        while (true) {
            const result = callback(directory);
            if (result !== undefined) {
                return result;
            }
            const parentPath = ts.getDirectoryPath(directory);
            if (parentPath === directory) {
                return undefined;
            }
            directory = parentPath;
        }
    }
    ts.forEachAncestorDirectory = forEachAncestorDirectory;
    // Return true if the given type is the constructor type for an abstract class
    function isAbstractConstructorType(type) {
        return !!(getObjectFlags(type) & ts.ObjectFlags.Anonymous) && !!type.symbol && isAbstractConstructorSymbol(type.symbol);
    }
    ts.isAbstractConstructorType = isAbstractConstructorType;
    function isAbstractConstructorSymbol(symbol) {
        if (symbol.flags & ts.SymbolFlags.Class) {
            const declaration = getClassLikeDeclarationOfSymbol(symbol);
            return !!declaration && hasModifier(declaration, ts.ModifierFlags.Abstract);
        }
        return false;
    }
    ts.isAbstractConstructorSymbol = isAbstractConstructorSymbol;
    function getClassLikeDeclarationOfSymbol(symbol) {
        return ts.find(symbol.declarations, ts.isClassLike);
    }
    ts.getClassLikeDeclarationOfSymbol = getClassLikeDeclarationOfSymbol;
    function getObjectFlags(type) {
        return type.flags & ts.TypeFlags.Object ? type.objectFlags : 0;
    }
    ts.getObjectFlags = getObjectFlags;
    function typeHasCallOrConstructSignatures(type, checker) {
        return checker.getSignaturesOfType(type, ts.SignatureKind.Call).length !== 0 || checker.getSignaturesOfType(type, ts.SignatureKind.Construct).length !== 0;
    }
    ts.typeHasCallOrConstructSignatures = typeHasCallOrConstructSignatures;
    function forSomeAncestorDirectory(directory, callback) {
        return !!forEachAncestorDirectory(directory, d => callback(d) ? true : undefined);
    }
    ts.forSomeAncestorDirectory = forSomeAncestorDirectory;
    function isUMDExportSymbol(symbol) {
        return symbol && symbol.declarations && symbol.declarations[0] && ts.isNamespaceExportDeclaration(symbol.declarations[0]);
    }
    ts.isUMDExportSymbol = isUMDExportSymbol;
    function showModuleSpecifier({ moduleSpecifier }) {
        return ts.isStringLiteral(moduleSpecifier) ? moduleSpecifier.text : getTextOfNode(moduleSpecifier);
    }
    ts.showModuleSpecifier = showModuleSpecifier;
    function getLastChild(node) {
        let lastChild;
        ts.forEachChild(node, child => {
            if (nodeIsPresent(child))
                lastChild = child;
        }, children => {
            // As an optimization, jump straight to the end of the list.
            for (let i = children.length - 1; i >= 0; i--) {
                if (nodeIsPresent(children[i])) {
                    lastChild = children[i];
                    break;
                }
            }
        });
        return lastChild;
    }
    ts.getLastChild = getLastChild;
    /** Add a value to a set, and return true if it wasn't already present. */
    function addToSeen(seen, key) {
        key = String(key);
        if (seen.has(key)) {
            return false;
        }
        seen.set(key, true);
        return true;
    }
    ts.addToSeen = addToSeen;
    function isObjectTypeDeclaration(node) {
        return ts.isClassLike(node) || ts.isInterfaceDeclaration(node) || ts.isTypeLiteralNode(node);
    }
    ts.isObjectTypeDeclaration = isObjectTypeDeclaration;
})(ts || (ts = {}));
(function (ts) {
    function getDefaultLibFileName(options) {
        switch (options.target) {
            case ts.ScriptTarget.ESNext:
                return "lib.esnext.full.d.ts";
            case ts.ScriptTarget.ES2017:
                return "lib.es2017.full.d.ts";
            case ts.ScriptTarget.ES2016:
                return "lib.es2016.full.d.ts";
            case ts.ScriptTarget.ES2015:
                return "lib.es6.d.ts"; // We don't use lib.es2015.full.d.ts due to breaking change.
            default:
                return "lib.d.ts";
        }
    }
    ts.getDefaultLibFileName = getDefaultLibFileName;
    function textSpanEnd(span) {
        return span.start + span.length;
    }
    ts.textSpanEnd = textSpanEnd;
    function textSpanIsEmpty(span) {
        return span.length === 0;
    }
    ts.textSpanIsEmpty = textSpanIsEmpty;
    function textSpanContainsPosition(span, position) {
        return position >= span.start && position < textSpanEnd(span);
    }
    ts.textSpanContainsPosition = textSpanContainsPosition;
    // Returns true if 'span' contains 'other'.
    function textSpanContainsTextSpan(span, other) {
        return other.start >= span.start && textSpanEnd(other) <= textSpanEnd(span);
    }
    ts.textSpanContainsTextSpan = textSpanContainsTextSpan;
    function textSpanOverlapsWith(span, other) {
        return textSpanOverlap(span, other) !== undefined;
    }
    ts.textSpanOverlapsWith = textSpanOverlapsWith;
    function textSpanOverlap(span1, span2) {
        const overlap = textSpanIntersection(span1, span2);
        return overlap && overlap.length === 0 ? undefined : overlap;
    }
    ts.textSpanOverlap = textSpanOverlap;
    function textSpanIntersectsWithTextSpan(span, other) {
        return decodedTextSpanIntersectsWith(span.start, span.length, other.start, other.length);
    }
    ts.textSpanIntersectsWithTextSpan = textSpanIntersectsWithTextSpan;
    function textSpanIntersectsWith(span, start, length) {
        return decodedTextSpanIntersectsWith(span.start, span.length, start, length);
    }
    ts.textSpanIntersectsWith = textSpanIntersectsWith;
    function decodedTextSpanIntersectsWith(start1, length1, start2, length2) {
        const end1 = start1 + length1;
        const end2 = start2 + length2;
        return start2 <= end1 && end2 >= start1;
    }
    ts.decodedTextSpanIntersectsWith = decodedTextSpanIntersectsWith;
    function textSpanIntersectsWithPosition(span, position) {
        return position <= textSpanEnd(span) && position >= span.start;
    }
    ts.textSpanIntersectsWithPosition = textSpanIntersectsWithPosition;
    function textSpanIntersection(span1, span2) {
        const start = Math.max(span1.start, span2.start);
        const end = Math.min(textSpanEnd(span1), textSpanEnd(span2));
        return start <= end ? createTextSpanFromBounds(start, end) : undefined;
    }
    ts.textSpanIntersection = textSpanIntersection;
    function createTextSpan(start, length) {
        if (start < 0) {
            throw new Error("start < 0");
        }
        if (length < 0) {
            throw new Error("length < 0");
        }
        return { start, length };
    }
    ts.createTextSpan = createTextSpan;
    /* @internal */
    function createTextRange(pos, end = pos) {
        ts.Debug.assert(end >= pos);
        return { pos, end };
    }
    ts.createTextRange = createTextRange;
    function createTextSpanFromBounds(start, end) {
        return createTextSpan(start, end - start);
    }
    ts.createTextSpanFromBounds = createTextSpanFromBounds;
    function textChangeRangeNewSpan(range) {
        return createTextSpan(range.span.start, range.newLength);
    }
    ts.textChangeRangeNewSpan = textChangeRangeNewSpan;
    function textChangeRangeIsUnchanged(range) {
        return textSpanIsEmpty(range.span) && range.newLength === 0;
    }
    ts.textChangeRangeIsUnchanged = textChangeRangeIsUnchanged;
    function createTextChangeRange(span, newLength) {
        if (newLength < 0) {
            throw new Error("newLength < 0");
        }
        return { span, newLength };
    }
    ts.createTextChangeRange = createTextChangeRange;
    ts.unchangedTextChangeRange = createTextChangeRange(createTextSpan(0, 0), 0);
    /**
     * Called to merge all the changes that occurred across several versions of a script snapshot
     * into a single change.  i.e. if a user keeps making successive edits to a script we will
     * have a text change from V1 to V2, V2 to V3, ..., Vn.
     *
     * This function will then merge those changes into a single change range valid between V1 and
     * Vn.
     */
    function collapseTextChangeRangesAcrossMultipleVersions(changes) {
        if (changes.length === 0) {
            return ts.unchangedTextChangeRange;
        }
        if (changes.length === 1) {
            return changes[0];
        }
        // We change from talking about { { oldStart, oldLength }, newLength } to { oldStart, oldEnd, newEnd }
        // as it makes things much easier to reason about.
        const change0 = changes[0];
        let oldStartN = change0.span.start;
        let oldEndN = textSpanEnd(change0.span);
        let newEndN = oldStartN + change0.newLength;
        for (let i = 1; i < changes.length; i++) {
            const nextChange = changes[i];
            // Consider the following case:
            // i.e. two edits.  The first represents the text change range { { 10, 50 }, 30 }.  i.e. The span starting
            // at 10, with length 50 is reduced to length 30.  The second represents the text change range { { 30, 30 }, 40 }.
            // i.e. the span starting at 30 with length 30 is increased to length 40.
            //
            //      0         10        20        30        40        50        60        70        80        90        100
            //      -------------------------------------------------------------------------------------------------------
            //                |                                                 /
            //                |                                            /----
            //  T1            |                                       /----
            //                |                                  /----
            //                |                             /----
            //      -------------------------------------------------------------------------------------------------------
            //                                     |                            \
            //                                     |                               \
            //   T2                                |                                 \
            //                                     |                                   \
            //                                     |                                      \
            //      -------------------------------------------------------------------------------------------------------
            //
            // Merging these turns out to not be too difficult.  First, determining the new start of the change is trivial
            // it's just the min of the old and new starts.  i.e.:
            //
            //      0         10        20        30        40        50        60        70        80        90        100
            //      ------------------------------------------------------------*------------------------------------------
            //                |                                                 /
            //                |                                            /----
            //  T1            |                                       /----
            //                |                                  /----
            //                |                             /----
            //      ----------------------------------------$-------------------$------------------------------------------
            //                .                    |                            \
            //                .                    |                               \
            //   T2           .                    |                                 \
            //                .                    |                                   \
            //                .                    |                                      \
            //      ----------------------------------------------------------------------*--------------------------------
            //
            // (Note the dots represent the newly inferred start.
            // Determining the new and old end is also pretty simple.  Basically it boils down to paying attention to the
            // absolute positions at the asterisks, and the relative change between the dollar signs. Basically, we see
            // which if the two $'s precedes the other, and we move that one forward until they line up.  in this case that
            // means:
            //
            //      0         10        20        30        40        50        60        70        80        90        100
            //      --------------------------------------------------------------------------------*----------------------
            //                |                                                                     /
            //                |                                                                /----
            //  T1            |                                                           /----
            //                |                                                      /----
            //                |                                                 /----
            //      ------------------------------------------------------------$------------------------------------------
            //                .                    |                            \
            //                .                    |                               \
            //   T2           .                    |                                 \
            //                .                    |                                   \
            //                .                    |                                      \
            //      ----------------------------------------------------------------------*--------------------------------
            //
            // In other words (in this case), we're recognizing that the second edit happened after where the first edit
            // ended with a delta of 20 characters (60 - 40).  Thus, if we go back in time to where the first edit started
            // that's the same as if we started at char 80 instead of 60.
            //
            // As it so happens, the same logic applies if the second edit precedes the first edit.  In that case rather
            // than pushing the first edit forward to match the second, we'll push the second edit forward to match the
            // first.
            //
            // In this case that means we have { oldStart: 10, oldEnd: 80, newEnd: 70 } or, in TextChangeRange
            // semantics: { { start: 10, length: 70 }, newLength: 60 }
            //
            // The math then works out as follows.
            // If we have { oldStart1, oldEnd1, newEnd1 } and { oldStart2, oldEnd2, newEnd2 } then we can compute the
            // final result like so:
            //
            // {
            //      oldStart3: Min(oldStart1, oldStart2),
            //      oldEnd3: Max(oldEnd1, oldEnd1 + (oldEnd2 - newEnd1)),
            //      newEnd3: Max(newEnd2, newEnd2 + (newEnd1 - oldEnd2))
            // }
            const oldStart1 = oldStartN;
            const oldEnd1 = oldEndN;
            const newEnd1 = newEndN;
            const oldStart2 = nextChange.span.start;
            const oldEnd2 = textSpanEnd(nextChange.span);
            const newEnd2 = oldStart2 + nextChange.newLength;
            oldStartN = Math.min(oldStart1, oldStart2);
            oldEndN = Math.max(oldEnd1, oldEnd1 + (oldEnd2 - newEnd1));
            newEndN = Math.max(newEnd2, newEnd2 + (newEnd1 - oldEnd2));
        }
        return createTextChangeRange(createTextSpanFromBounds(oldStartN, oldEndN), /*newLength*/ newEndN - oldStartN);
    }
    ts.collapseTextChangeRangesAcrossMultipleVersions = collapseTextChangeRangesAcrossMultipleVersions;
    function getTypeParameterOwner(d) {
        if (d && d.kind === ts.SyntaxKind.TypeParameter) {
            for (let current = d; current; current = current.parent) {
                if (ts.isFunctionLike(current) || ts.isClassLike(current) || current.kind === ts.SyntaxKind.InterfaceDeclaration) {
                    return current;
                }
            }
        }
    }
    ts.getTypeParameterOwner = getTypeParameterOwner;
    function isParameterPropertyDeclaration(node) {
        return ts.hasModifier(node, ts.ModifierFlags.ParameterPropertyModifier) && node.parent.kind === ts.SyntaxKind.Constructor;
    }
    ts.isParameterPropertyDeclaration = isParameterPropertyDeclaration;
    function isEmptyBindingPattern(node) {
        if (ts.isBindingPattern(node)) {
            return ts.every(node.elements, isEmptyBindingElement);
        }
        return false;
    }
    ts.isEmptyBindingPattern = isEmptyBindingPattern;
    function isEmptyBindingElement(node) {
        if (ts.isOmittedExpression(node)) {
            return true;
        }
        return isEmptyBindingPattern(node.name);
    }
    ts.isEmptyBindingElement = isEmptyBindingElement;
    function walkUpBindingElementsAndPatterns(node) {
        while (node && (node.kind === ts.SyntaxKind.BindingElement || ts.isBindingPattern(node))) {
            node = node.parent;
        }
        return node;
    }
    function getCombinedModifierFlags(node) {
        node = walkUpBindingElementsAndPatterns(node);
        let flags = ts.getModifierFlags(node);
        if (node.kind === ts.SyntaxKind.VariableDeclaration) {
            node = node.parent;
        }
        if (node && node.kind === ts.SyntaxKind.VariableDeclarationList) {
            flags |= ts.getModifierFlags(node);
            node = node.parent;
        }
        if (node && node.kind === ts.SyntaxKind.VariableStatement) {
            flags |= ts.getModifierFlags(node);
        }
        return flags;
    }
    ts.getCombinedModifierFlags = getCombinedModifierFlags;
    // Returns the node flags for this node and all relevant parent nodes.  This is done so that
    // nodes like variable declarations and binding elements can returned a view of their flags
    // that includes the modifiers from their container.  i.e. flags like export/declare aren't
    // stored on the variable declaration directly, but on the containing variable statement
    // (if it has one).  Similarly, flags for let/const are store on the variable declaration
    // list.  By calling this function, all those flags are combined so that the client can treat
    // the node as if it actually had those flags.
    function getCombinedNodeFlags(node) {
        node = walkUpBindingElementsAndPatterns(node);
        let flags = node.flags;
        if (node.kind === ts.SyntaxKind.VariableDeclaration) {
            node = node.parent;
        }
        if (node && node.kind === ts.SyntaxKind.VariableDeclarationList) {
            flags |= node.flags;
            node = node.parent;
        }
        if (node && node.kind === ts.SyntaxKind.VariableStatement) {
            flags |= node.flags;
        }
        return flags;
    }
    ts.getCombinedNodeFlags = getCombinedNodeFlags;
    /**
     * Checks to see if the locale is in the appropriate format,
     * and if it is, attempts to set the appropriate language.
     */
    function validateLocaleAndSetLanguage(locale, sys, errors) {
        const matchResult = /^([a-z]+)([_\-]([a-z]+))?$/.exec(locale.toLowerCase());
        if (!matchResult) {
            if (errors) {
                errors.push(ts.createCompilerDiagnostic(Diagnostics.Locale_must_be_of_the_form_language_or_language_territory_For_example_0_or_1, "en", "ja-jp"));
            }
            return;
        }
        const language = matchResult[1];
        const territory = matchResult[3];
        // First try the entire locale, then fall back to just language if that's all we have.
        // Either ways do not fail, and fallback to the English diagnostic strings.
        if (!trySetLanguageAndTerritory(language, territory, errors)) {
            trySetLanguageAndTerritory(language, /*territory*/ undefined, errors);
        }
        // Set the UI locale for string collation
        ts.setUILocale(locale);
        function trySetLanguageAndTerritory(language, territory, errors) {
            const compilerFilePath = ts.normalizePath(sys.getExecutingFilePath());
            const containingDirectoryPath = ts.getDirectoryPath(compilerFilePath);
            let filePath = ts.combinePaths(containingDirectoryPath, language);
            if (territory) {
                filePath = filePath + "-" + territory;
            }
            filePath = sys.resolvePath(ts.combinePaths(filePath, "diagnosticMessages.generated.json"));
            if (!sys.fileExists(filePath)) {
                return false;
            }
            // TODO: Add codePage support for readFile?
            let fileContents = "";
            try {
                fileContents = sys.readFile(filePath);
            }
            catch (e) {
                if (errors) {
                    errors.push(ts.createCompilerDiagnostic(Diagnostics.Unable_to_open_file_0, filePath));
                }
                return false;
            }
            try {
                // tslint:disable-next-line no-unnecessary-qualifier (making clear this is a global mutation!)
                ts.localizedDiagnosticMessages = JSON.parse(fileContents);
            }
            catch (e) {
                if (errors) {
                    errors.push(ts.createCompilerDiagnostic(Diagnostics.Corrupted_locale_file_0, filePath));
                }
                return false;
            }
            return true;
        }
    }
    ts.validateLocaleAndSetLanguage = validateLocaleAndSetLanguage;
    function getOriginalNode(node, nodeTest) {
        if (node) {
            while (node.original !== undefined) {
                node = node.original;
            }
        }
        return !nodeTest || nodeTest(node) ? node : undefined;
    }
    ts.getOriginalNode = getOriginalNode;
    /**
     * Gets a value indicating whether a node originated in the parse tree.
     *
     * @param node The node to test.
     */
    function isParseTreeNode(node) {
        return (node.flags & ts.NodeFlags.Synthesized) === 0;
    }
    ts.isParseTreeNode = isParseTreeNode;
    function getParseTreeNode(node, nodeTest) {
        if (node === undefined || isParseTreeNode(node)) {
            return node;
        }
        node = getOriginalNode(node);
        if (isParseTreeNode(node) && (!nodeTest || nodeTest(node))) {
            return node;
        }
        return undefined;
    }
    ts.getParseTreeNode = getParseTreeNode;
    /**
     * Remove extra underscore from escaped identifier text content.
     *
     * @param identifier The escaped identifier text.
     * @returns The unescaped identifier text.
     */
    function unescapeLeadingUnderscores(identifier) {
        const id = identifier;
        return id.length >= 3 && id.charCodeAt(0) === 95 /* _ */ && id.charCodeAt(1) === 95 /* _ */ && id.charCodeAt(2) === 95 /* _ */ ? id.substr(1) : id;
    }
    ts.unescapeLeadingUnderscores = unescapeLeadingUnderscores;
    function idText(identifier) {
        return unescapeLeadingUnderscores(identifier.escapedText);
    }
    ts.idText = idText;
    function symbolName(symbol) {
        return unescapeLeadingUnderscores(symbol.escapedName);
    }
    ts.symbolName = symbolName;
    /**
     * Remove extra underscore from escaped identifier text content.
     * @deprecated Use `id.text` for the unescaped text.
     * @param identifier The escaped identifier text.
     * @returns The unescaped identifier text.
     */
    function unescapeIdentifier(id) {
        return id;
    }
    ts.unescapeIdentifier = unescapeIdentifier;
    /**
     * A JSDocTypedef tag has an _optional_ name field - if a name is not directly present, we should
     * attempt to draw the name from the node the declaration is on (as that declaration is what its' symbol
     * will be merged with)
     */
    function nameForNamelessJSDocTypedef(declaration) {
        const hostNode = declaration.parent.parent;
        if (!hostNode) {
            return undefined;
        }
        // Covers classes, functions - any named declaration host node
        if (ts.isDeclaration(hostNode)) {
            return getDeclarationIdentifier(hostNode);
        }
        // Covers remaining cases
        switch (hostNode.kind) {
            case ts.SyntaxKind.VariableStatement:
                if (hostNode.declarationList && hostNode.declarationList.declarations[0]) {
                    return getDeclarationIdentifier(hostNode.declarationList.declarations[0]);
                }
                return undefined;
            case ts.SyntaxKind.ExpressionStatement:
                const expr = hostNode.expression;
                switch (expr.kind) {
                    case ts.SyntaxKind.PropertyAccessExpression:
                        return expr.name;
                    case ts.SyntaxKind.ElementAccessExpression:
                        const arg = expr.argumentExpression;
                        if (ts.isIdentifier(arg)) {
                            return arg;
                        }
                }
                return undefined;
            case ts.SyntaxKind.EndOfFileToken:
                return undefined;
            case ts.SyntaxKind.ParenthesizedExpression: {
                return getDeclarationIdentifier(hostNode.expression);
            }
            case ts.SyntaxKind.LabeledStatement: {
                if (ts.isDeclaration(hostNode.statement) || ts.isExpression(hostNode.statement)) {
                    return getDeclarationIdentifier(hostNode.statement);
                }
                return undefined;
            }
            default:
                ts.Debug.assertNever(hostNode, "Found typedef tag attached to node which it should not be!");
        }
    }
    function getDeclarationIdentifier(node) {
        const name = getNameOfDeclaration(node);
        return ts.isIdentifier(name) ? name : undefined;
    }
    function getNameOfJSDocTypedef(declaration) {
        return declaration.name || nameForNamelessJSDocTypedef(declaration);
    }
    ts.getNameOfJSDocTypedef = getNameOfJSDocTypedef;
    /** @internal */
    function isNamedDeclaration(node) {
        return !!node.name; // A 'name' property should always be a DeclarationName.
    }
    ts.isNamedDeclaration = isNamedDeclaration;
    function getNameOfDeclaration(declaration) {
        if (!declaration) {
            return undefined;
        }
        switch (declaration.kind) {
            case ts.SyntaxKind.ClassExpression:
            case ts.SyntaxKind.FunctionExpression:
                if (!declaration.name) {
                    return getAssignedName(declaration);
                }
                break;
            case ts.SyntaxKind.Identifier:
                return declaration;
            case ts.SyntaxKind.JSDocPropertyTag:
            case ts.SyntaxKind.JSDocParameterTag: {
                const { name } = declaration;
                if (name.kind === ts.SyntaxKind.QualifiedName) {
                    return name.right;
                }
                break;
            }
            case ts.SyntaxKind.BinaryExpression: {
                const expr = declaration;
                switch (ts.getSpecialPropertyAssignmentKind(expr)) {
                    case 1 /* ExportsProperty */:
                    case 4 /* ThisProperty */:
                    case 5 /* Property */:
                    case 3 /* PrototypeProperty */:
                        return expr.left.name;
                    default:
                        return undefined;
                }
            }
            case ts.SyntaxKind.JSDocTypedefTag:
                return getNameOfJSDocTypedef(declaration);
            case ts.SyntaxKind.ExportAssignment: {
                const { expression } = declaration;
                return ts.isIdentifier(expression) ? expression : undefined;
            }
        }
        return declaration.name;
    }
    ts.getNameOfDeclaration = getNameOfDeclaration;
    function getAssignedName(node) {
        if (!node.parent) {
            return undefined;
        }
        else if (ts.isPropertyAssignment(node.parent) || ts.isBindingElement(node.parent)) {
            return node.parent.name;
        }
        else if (ts.isBinaryExpression(node.parent) && node === node.parent.right) {
            if (ts.isIdentifier(node.parent.left)) {
                return node.parent.left;
            }
            else if (ts.isPropertyAccessExpression(node.parent.left)) {
                return node.parent.left.name;
            }
        }
    }
    /**
     * Gets the JSDoc parameter tags for the node if present.
     *
     * @remarks Returns any JSDoc param tag that matches the provided
     * parameter, whether a param tag on a containing function
     * expression, or a param tag on a variable declaration whose
     * initializer is the containing function. The tags closest to the
     * node are returned first, so in the previous example, the param
     * tag on the containing function expression would be first.
     *
     * Does not return tags for binding patterns, because JSDoc matches
     * parameters by name and binding patterns do not have a name.
     */
    function getJSDocParameterTags(param) {
        if (param.name) {
            if (ts.isIdentifier(param.name)) {
                const name = param.name.escapedText;
                return getJSDocTags(param.parent).filter((tag) => ts.isJSDocParameterTag(tag) && ts.isIdentifier(tag.name) && tag.name.escapedText === name);
            }
            else {
                const i = param.parent.parameters.indexOf(param);
                ts.Debug.assert(i > -1, "Parameters should always be in their parents' parameter list");
                const paramTags = getJSDocTags(param.parent).filter(ts.isJSDocParameterTag);
                if (i < paramTags.length) {
                    return [paramTags[i]];
                }
            }
        }
        // return empty array for: out-of-order binding patterns and JSDoc function syntax, which has un-named parameters
        return ts.emptyArray;
    }
    ts.getJSDocParameterTags = getJSDocParameterTags;
    /**
     * Return true if the node has JSDoc parameter tags.
     *
     * @remarks Includes parameter tags that are not directly on the node,
     * for example on a variable declaration whose initializer is a function expression.
     */
    function hasJSDocParameterTags(node) {
        return !!getFirstJSDocTag(node, ts.isJSDocParameterTag);
    }
    ts.hasJSDocParameterTags = hasJSDocParameterTags;
    /** Gets the JSDoc augments tag for the node if present */
    function getJSDocAugmentsTag(node) {
        return getFirstJSDocTag(node, ts.isJSDocAugmentsTag);
    }
    ts.getJSDocAugmentsTag = getJSDocAugmentsTag;
    /** Gets the JSDoc class tag for the node if present */
    function getJSDocClassTag(node) {
        return getFirstJSDocTag(node, ts.isJSDocClassTag);
    }
    ts.getJSDocClassTag = getJSDocClassTag;
    /** Gets the JSDoc return tag for the node if present */
    function getJSDocReturnTag(node) {
        return getFirstJSDocTag(node, ts.isJSDocReturnTag);
    }
    ts.getJSDocReturnTag = getJSDocReturnTag;
    /** Gets the JSDoc template tag for the node if present */
    function getJSDocTemplateTag(node) {
        return getFirstJSDocTag(node, ts.isJSDocTemplateTag);
    }
    ts.getJSDocTemplateTag = getJSDocTemplateTag;
    /** Gets the JSDoc type tag for the node if present and valid */
    function getJSDocTypeTag(node) {
        // We should have already issued an error if there were multiple type jsdocs, so just use the first one.
        const tag = getFirstJSDocTag(node, ts.isJSDocTypeTag);
        if (tag && tag.typeExpression && tag.typeExpression.type) {
            return tag;
        }
        return undefined;
    }
    ts.getJSDocTypeTag = getJSDocTypeTag;
    /**
     * Gets the type node for the node if provided via JSDoc.
     *
     * @remarks The search includes any JSDoc param tag that relates
     * to the provided parameter, for example a type tag on the
     * parameter itself, or a param tag on a containing function
     * expression, or a param tag on a variable declaration whose
     * initializer is the containing function. The tags closest to the
     * node are examined first, so in the previous example, the type
     * tag directly on the node would be returned.
     */
    function getJSDocType(node) {
        let tag = getFirstJSDocTag(node, ts.isJSDocTypeTag);
        if (!tag && ts.isParameter(node)) {
            tag = ts.find(getJSDocParameterTags(node), tag => !!tag.typeExpression);
        }
        return tag && tag.typeExpression && tag.typeExpression.type;
    }
    ts.getJSDocType = getJSDocType;
    /**
     * Gets the return type node for the node if provided via JSDoc's return tag.
     *
     * @remarks `getJSDocReturnTag` just gets the whole JSDoc tag. This function
     * gets the type from inside the braces.
     */
    function getJSDocReturnType(node) {
        const returnTag = getJSDocReturnTag(node);
        return returnTag && returnTag.typeExpression && returnTag.typeExpression.type;
    }
    ts.getJSDocReturnType = getJSDocReturnType;
    /** Get all JSDoc tags related to a node, including those on parent nodes. */
    function getJSDocTags(node) {
        let tags = node.jsDocCache;
        // If cache is 'null', that means we did the work of searching for JSDoc tags and came up with nothing.
        if (tags === undefined) {
            node.jsDocCache = tags = ts.flatMap(ts.getJSDocCommentsAndTags(node), j => ts.isJSDoc(j) ? j.tags : j);
        }
        return tags;
    }
    ts.getJSDocTags = getJSDocTags;
    /** Get the first JSDoc tag of a specified kind, or undefined if not present. */
    function getFirstJSDocTag(node, predicate) {
        return ts.find(getJSDocTags(node), predicate);
    }
    /** Gets all JSDoc tags of a specified kind, or undefined if not present. */
    function getAllJSDocTagsOfKind(node, kind) {
        return getJSDocTags(node).filter(doc => doc.kind === kind);
    }
    ts.getAllJSDocTagsOfKind = getAllJSDocTagsOfKind;
})(ts || (ts = {}));
// Simple node tests of the form `node.kind === SyntaxKind.Foo`.
(function (ts) {
    // Literals
    function isNumericLiteral(node) {
        return node.kind === ts.SyntaxKind.NumericLiteral;
    }
    ts.isNumericLiteral = isNumericLiteral;
    function isStringLiteral(node) {
        return node.kind === ts.SyntaxKind.StringLiteral;
    }
    ts.isStringLiteral = isStringLiteral;
    function isJsxText(node) {
        return node.kind === ts.SyntaxKind.JsxText;
    }
    ts.isJsxText = isJsxText;
    function isRegularExpressionLiteral(node) {
        return node.kind === ts.SyntaxKind.RegularExpressionLiteral;
    }
    ts.isRegularExpressionLiteral = isRegularExpressionLiteral;
    function isNoSubstitutionTemplateLiteral(node) {
        return node.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral;
    }
    ts.isNoSubstitutionTemplateLiteral = isNoSubstitutionTemplateLiteral;
    // Pseudo-literals
    function isTemplateHead(node) {
        return node.kind === ts.SyntaxKind.TemplateHead;
    }
    ts.isTemplateHead = isTemplateHead;
    function isTemplateMiddle(node) {
        return node.kind === ts.SyntaxKind.TemplateMiddle;
    }
    ts.isTemplateMiddle = isTemplateMiddle;
    function isTemplateTail(node) {
        return node.kind === ts.SyntaxKind.TemplateTail;
    }
    ts.isTemplateTail = isTemplateTail;
    function isIdentifier(node) {
        return node.kind === ts.SyntaxKind.Identifier;
    }
    ts.isIdentifier = isIdentifier;
    // Names
    function isQualifiedName(node) {
        return node.kind === ts.SyntaxKind.QualifiedName;
    }
    ts.isQualifiedName = isQualifiedName;
    function isComputedPropertyName(node) {
        return node.kind === ts.SyntaxKind.ComputedPropertyName;
    }
    ts.isComputedPropertyName = isComputedPropertyName;
    // Signature elements
    function isTypeParameterDeclaration(node) {
        return node.kind === ts.SyntaxKind.TypeParameter;
    }
    ts.isTypeParameterDeclaration = isTypeParameterDeclaration;
    function isParameter(node) {
        return node.kind === ts.SyntaxKind.Parameter;
    }
    ts.isParameter = isParameter;
    function isDecorator(node) {
        return node.kind === ts.SyntaxKind.Decorator;
    }
    ts.isDecorator = isDecorator;
    // TypeMember
    function isPropertySignature(node) {
        return node.kind === ts.SyntaxKind.PropertySignature;
    }
    ts.isPropertySignature = isPropertySignature;
    function isPropertyDeclaration(node) {
        return node.kind === ts.SyntaxKind.PropertyDeclaration;
    }
    ts.isPropertyDeclaration = isPropertyDeclaration;
    function isMethodSignature(node) {
        return node.kind === ts.SyntaxKind.MethodSignature;
    }
    ts.isMethodSignature = isMethodSignature;
    function isMethodDeclaration(node) {
        return node.kind === ts.SyntaxKind.MethodDeclaration;
    }
    ts.isMethodDeclaration = isMethodDeclaration;
    function isConstructorDeclaration(node) {
        return node.kind === ts.SyntaxKind.Constructor;
    }
    ts.isConstructorDeclaration = isConstructorDeclaration;
    function isGetAccessorDeclaration(node) {
        return node.kind === ts.SyntaxKind.GetAccessor;
    }
    ts.isGetAccessorDeclaration = isGetAccessorDeclaration;
    function isSetAccessorDeclaration(node) {
        return node.kind === ts.SyntaxKind.SetAccessor;
    }
    ts.isSetAccessorDeclaration = isSetAccessorDeclaration;
    function isCallSignatureDeclaration(node) {
        return node.kind === ts.SyntaxKind.CallSignature;
    }
    ts.isCallSignatureDeclaration = isCallSignatureDeclaration;
    function isConstructSignatureDeclaration(node) {
        return node.kind === ts.SyntaxKind.ConstructSignature;
    }
    ts.isConstructSignatureDeclaration = isConstructSignatureDeclaration;
    function isIndexSignatureDeclaration(node) {
        return node.kind === ts.SyntaxKind.IndexSignature;
    }
    ts.isIndexSignatureDeclaration = isIndexSignatureDeclaration;
    // Type
    function isTypePredicateNode(node) {
        return node.kind === ts.SyntaxKind.TypePredicate;
    }
    ts.isTypePredicateNode = isTypePredicateNode;
    function isTypeReferenceNode(node) {
        return node.kind === ts.SyntaxKind.TypeReference;
    }
    ts.isTypeReferenceNode = isTypeReferenceNode;
    function isFunctionTypeNode(node) {
        return node.kind === ts.SyntaxKind.FunctionType;
    }
    ts.isFunctionTypeNode = isFunctionTypeNode;
    function isConstructorTypeNode(node) {
        return node.kind === ts.SyntaxKind.ConstructorType;
    }
    ts.isConstructorTypeNode = isConstructorTypeNode;
    function isTypeQueryNode(node) {
        return node.kind === ts.SyntaxKind.TypeQuery;
    }
    ts.isTypeQueryNode = isTypeQueryNode;
    function isTypeLiteralNode(node) {
        return node.kind === ts.SyntaxKind.TypeLiteral;
    }
    ts.isTypeLiteralNode = isTypeLiteralNode;
    function isArrayTypeNode(node) {
        return node.kind === ts.SyntaxKind.ArrayType;
    }
    ts.isArrayTypeNode = isArrayTypeNode;
    function isTupleTypeNode(node) {
        return node.kind === ts.SyntaxKind.TupleType;
    }
    ts.isTupleTypeNode = isTupleTypeNode;
    function isUnionTypeNode(node) {
        return node.kind === ts.SyntaxKind.UnionType;
    }
    ts.isUnionTypeNode = isUnionTypeNode;
    function isIntersectionTypeNode(node) {
        return node.kind === ts.SyntaxKind.IntersectionType;
    }
    ts.isIntersectionTypeNode = isIntersectionTypeNode;
    function isConditionalTypeNode(node) {
        return node.kind === ts.SyntaxKind.ConditionalType;
    }
    ts.isConditionalTypeNode = isConditionalTypeNode;
    function isInferTypeNode(node) {
        return node.kind === ts.SyntaxKind.InferType;
    }
    ts.isInferTypeNode = isInferTypeNode;
    function isParenthesizedTypeNode(node) {
        return node.kind === ts.SyntaxKind.ParenthesizedType;
    }
    ts.isParenthesizedTypeNode = isParenthesizedTypeNode;
    function isThisTypeNode(node) {
        return node.kind === ts.SyntaxKind.ThisType;
    }
    ts.isThisTypeNode = isThisTypeNode;
    function isTypeOperatorNode(node) {
        return node.kind === ts.SyntaxKind.TypeOperator;
    }
    ts.isTypeOperatorNode = isTypeOperatorNode;
    function isIndexedAccessTypeNode(node) {
        return node.kind === ts.SyntaxKind.IndexedAccessType;
    }
    ts.isIndexedAccessTypeNode = isIndexedAccessTypeNode;
    function isMappedTypeNode(node) {
        return node.kind === ts.SyntaxKind.MappedType;
    }
    ts.isMappedTypeNode = isMappedTypeNode;
    function isLiteralTypeNode(node) {
        return node.kind === ts.SyntaxKind.LiteralType;
    }
    ts.isLiteralTypeNode = isLiteralTypeNode;
    function isImportTypeNode(node) {
        return node.kind === ts.SyntaxKind.ImportType;
    }
    ts.isImportTypeNode = isImportTypeNode;
    // Binding patterns
    function isObjectBindingPattern(node) {
        return node.kind === ts.SyntaxKind.ObjectBindingPattern;
    }
    ts.isObjectBindingPattern = isObjectBindingPattern;
    function isArrayBindingPattern(node) {
        return node.kind === ts.SyntaxKind.ArrayBindingPattern;
    }
    ts.isArrayBindingPattern = isArrayBindingPattern;
    function isBindingElement(node) {
        return node.kind === ts.SyntaxKind.BindingElement;
    }
    ts.isBindingElement = isBindingElement;
    // Expression
    function isArrayLiteralExpression(node) {
        return node.kind === ts.SyntaxKind.ArrayLiteralExpression;
    }
    ts.isArrayLiteralExpression = isArrayLiteralExpression;
    function isObjectLiteralExpression(node) {
        return node.kind === ts.SyntaxKind.ObjectLiteralExpression;
    }
    ts.isObjectLiteralExpression = isObjectLiteralExpression;
    function isPropertyAccessExpression(node) {
        return node.kind === ts.SyntaxKind.PropertyAccessExpression;
    }
    ts.isPropertyAccessExpression = isPropertyAccessExpression;
    function isElementAccessExpression(node) {
        return node.kind === ts.SyntaxKind.ElementAccessExpression;
    }
    ts.isElementAccessExpression = isElementAccessExpression;
    function isCallExpression(node) {
        return node.kind === ts.SyntaxKind.CallExpression;
    }
    ts.isCallExpression = isCallExpression;
    function isNewExpression(node) {
        return node.kind === ts.SyntaxKind.NewExpression;
    }
    ts.isNewExpression = isNewExpression;
    function isTaggedTemplateExpression(node) {
        return node.kind === ts.SyntaxKind.TaggedTemplateExpression;
    }
    ts.isTaggedTemplateExpression = isTaggedTemplateExpression;
    function isTypeAssertion(node) {
        return node.kind === ts.SyntaxKind.TypeAssertionExpression;
    }
    ts.isTypeAssertion = isTypeAssertion;
    function isParenthesizedExpression(node) {
        return node.kind === ts.SyntaxKind.ParenthesizedExpression;
    }
    ts.isParenthesizedExpression = isParenthesizedExpression;
    function skipPartiallyEmittedExpressions(node) {
        while (node.kind === ts.SyntaxKind.PartiallyEmittedExpression) {
            node = node.expression;
        }
        return node;
    }
    ts.skipPartiallyEmittedExpressions = skipPartiallyEmittedExpressions;
    function isFunctionExpression(node) {
        return node.kind === ts.SyntaxKind.FunctionExpression;
    }
    ts.isFunctionExpression = isFunctionExpression;
    function isArrowFunction(node) {
        return node.kind === ts.SyntaxKind.ArrowFunction;
    }
    ts.isArrowFunction = isArrowFunction;
    function isDeleteExpression(node) {
        return node.kind === ts.SyntaxKind.DeleteExpression;
    }
    ts.isDeleteExpression = isDeleteExpression;
    function isTypeOfExpression(node) {
        return node.kind === ts.SyntaxKind.TypeOfExpression;
    }
    ts.isTypeOfExpression = isTypeOfExpression;
    function isVoidExpression(node) {
        return node.kind === ts.SyntaxKind.VoidExpression;
    }
    ts.isVoidExpression = isVoidExpression;
    function isAwaitExpression(node) {
        return node.kind === ts.SyntaxKind.AwaitExpression;
    }
    ts.isAwaitExpression = isAwaitExpression;
    function isPrefixUnaryExpression(node) {
        return node.kind === ts.SyntaxKind.PrefixUnaryExpression;
    }
    ts.isPrefixUnaryExpression = isPrefixUnaryExpression;
    function isPostfixUnaryExpression(node) {
        return node.kind === ts.SyntaxKind.PostfixUnaryExpression;
    }
    ts.isPostfixUnaryExpression = isPostfixUnaryExpression;
    function isBinaryExpression(node) {
        return node.kind === ts.SyntaxKind.BinaryExpression;
    }
    ts.isBinaryExpression = isBinaryExpression;
    function isConditionalExpression(node) {
        return node.kind === ts.SyntaxKind.ConditionalExpression;
    }
    ts.isConditionalExpression = isConditionalExpression;
    function isTemplateExpression(node) {
        return node.kind === ts.SyntaxKind.TemplateExpression;
    }
    ts.isTemplateExpression = isTemplateExpression;
    function isYieldExpression(node) {
        return node.kind === ts.SyntaxKind.YieldExpression;
    }
    ts.isYieldExpression = isYieldExpression;
    function isSpreadElement(node) {
        return node.kind === ts.SyntaxKind.SpreadElement;
    }
    ts.isSpreadElement = isSpreadElement;
    function isClassExpression(node) {
        return node.kind === ts.SyntaxKind.ClassExpression;
    }
    ts.isClassExpression = isClassExpression;
    function isOmittedExpression(node) {
        return node.kind === ts.SyntaxKind.OmittedExpression;
    }
    ts.isOmittedExpression = isOmittedExpression;
    function isExpressionWithTypeArguments(node) {
        return node.kind === ts.SyntaxKind.ExpressionWithTypeArguments;
    }
    ts.isExpressionWithTypeArguments = isExpressionWithTypeArguments;
    function isAsExpression(node) {
        return node.kind === ts.SyntaxKind.AsExpression;
    }
    ts.isAsExpression = isAsExpression;
    function isNonNullExpression(node) {
        return node.kind === ts.SyntaxKind.NonNullExpression;
    }
    ts.isNonNullExpression = isNonNullExpression;
    function isMetaProperty(node) {
        return node.kind === ts.SyntaxKind.MetaProperty;
    }
    ts.isMetaProperty = isMetaProperty;
    // Misc
    function isTemplateSpan(node) {
        return node.kind === ts.SyntaxKind.TemplateSpan;
    }
    ts.isTemplateSpan = isTemplateSpan;
    function isSemicolonClassElement(node) {
        return node.kind === ts.SyntaxKind.SemicolonClassElement;
    }
    ts.isSemicolonClassElement = isSemicolonClassElement;
    // Block
    function isBlock(node) {
        return node.kind === ts.SyntaxKind.Block;
    }
    ts.isBlock = isBlock;
    function isVariableStatement(node) {
        return node.kind === ts.SyntaxKind.VariableStatement;
    }
    ts.isVariableStatement = isVariableStatement;
    function isEmptyStatement(node) {
        return node.kind === ts.SyntaxKind.EmptyStatement;
    }
    ts.isEmptyStatement = isEmptyStatement;
    function isExpressionStatement(node) {
        return node.kind === ts.SyntaxKind.ExpressionStatement;
    }
    ts.isExpressionStatement = isExpressionStatement;
    function isIfStatement(node) {
        return node.kind === ts.SyntaxKind.IfStatement;
    }
    ts.isIfStatement = isIfStatement;
    function isDoStatement(node) {
        return node.kind === ts.SyntaxKind.DoStatement;
    }
    ts.isDoStatement = isDoStatement;
    function isWhileStatement(node) {
        return node.kind === ts.SyntaxKind.WhileStatement;
    }
    ts.isWhileStatement = isWhileStatement;
    function isForStatement(node) {
        return node.kind === ts.SyntaxKind.ForStatement;
    }
    ts.isForStatement = isForStatement;
    function isForInStatement(node) {
        return node.kind === ts.SyntaxKind.ForInStatement;
    }
    ts.isForInStatement = isForInStatement;
    function isForOfStatement(node) {
        return node.kind === ts.SyntaxKind.ForOfStatement;
    }
    ts.isForOfStatement = isForOfStatement;
    function isContinueStatement(node) {
        return node.kind === ts.SyntaxKind.ContinueStatement;
    }
    ts.isContinueStatement = isContinueStatement;
    function isBreakStatement(node) {
        return node.kind === ts.SyntaxKind.BreakStatement;
    }
    ts.isBreakStatement = isBreakStatement;
    function isBreakOrContinueStatement(node) {
        return node.kind === ts.SyntaxKind.BreakStatement || node.kind === ts.SyntaxKind.ContinueStatement;
    }
    ts.isBreakOrContinueStatement = isBreakOrContinueStatement;
    function isReturnStatement(node) {
        return node.kind === ts.SyntaxKind.ReturnStatement;
    }
    ts.isReturnStatement = isReturnStatement;
    function isWithStatement(node) {
        return node.kind === ts.SyntaxKind.WithStatement;
    }
    ts.isWithStatement = isWithStatement;
    function isSwitchStatement(node) {
        return node.kind === ts.SyntaxKind.SwitchStatement;
    }
    ts.isSwitchStatement = isSwitchStatement;
    function isLabeledStatement(node) {
        return node.kind === ts.SyntaxKind.LabeledStatement;
    }
    ts.isLabeledStatement = isLabeledStatement;
    function isThrowStatement(node) {
        return node.kind === ts.SyntaxKind.ThrowStatement;
    }
    ts.isThrowStatement = isThrowStatement;
    function isTryStatement(node) {
        return node.kind === ts.SyntaxKind.TryStatement;
    }
    ts.isTryStatement = isTryStatement;
    function isDebuggerStatement(node) {
        return node.kind === ts.SyntaxKind.DebuggerStatement;
    }
    ts.isDebuggerStatement = isDebuggerStatement;
    function isVariableDeclaration(node) {
        return node.kind === ts.SyntaxKind.VariableDeclaration;
    }
    ts.isVariableDeclaration = isVariableDeclaration;
    function isVariableDeclarationList(node) {
        return node.kind === ts.SyntaxKind.VariableDeclarationList;
    }
    ts.isVariableDeclarationList = isVariableDeclarationList;
    function isFunctionDeclaration(node) {
        return node.kind === ts.SyntaxKind.FunctionDeclaration;
    }
    ts.isFunctionDeclaration = isFunctionDeclaration;
    function isClassDeclaration(node) {
        return node.kind === ts.SyntaxKind.ClassDeclaration;
    }
    ts.isClassDeclaration = isClassDeclaration;
    function isInterfaceDeclaration(node) {
        return node.kind === ts.SyntaxKind.InterfaceDeclaration;
    }
    ts.isInterfaceDeclaration = isInterfaceDeclaration;
    function isTypeAliasDeclaration(node) {
        return node.kind === ts.SyntaxKind.TypeAliasDeclaration;
    }
    ts.isTypeAliasDeclaration = isTypeAliasDeclaration;
    function isEnumDeclaration(node) {
        return node.kind === ts.SyntaxKind.EnumDeclaration;
    }
    ts.isEnumDeclaration = isEnumDeclaration;
    function isModuleDeclaration(node) {
        return node.kind === ts.SyntaxKind.ModuleDeclaration;
    }
    ts.isModuleDeclaration = isModuleDeclaration;
    function isModuleBlock(node) {
        return node.kind === ts.SyntaxKind.ModuleBlock;
    }
    ts.isModuleBlock = isModuleBlock;
    function isCaseBlock(node) {
        return node.kind === ts.SyntaxKind.CaseBlock;
    }
    ts.isCaseBlock = isCaseBlock;
    function isNamespaceExportDeclaration(node) {
        return node.kind === ts.SyntaxKind.NamespaceExportDeclaration;
    }
    ts.isNamespaceExportDeclaration = isNamespaceExportDeclaration;
    function isImportEqualsDeclaration(node) {
        return node.kind === ts.SyntaxKind.ImportEqualsDeclaration;
    }
    ts.isImportEqualsDeclaration = isImportEqualsDeclaration;
    function isImportDeclaration(node) {
        return node.kind === ts.SyntaxKind.ImportDeclaration;
    }
    ts.isImportDeclaration = isImportDeclaration;
    function isImportClause(node) {
        return node.kind === ts.SyntaxKind.ImportClause;
    }
    ts.isImportClause = isImportClause;
    function isNamespaceImport(node) {
        return node.kind === ts.SyntaxKind.NamespaceImport;
    }
    ts.isNamespaceImport = isNamespaceImport;
    function isNamedImports(node) {
        return node.kind === ts.SyntaxKind.NamedImports;
    }
    ts.isNamedImports = isNamedImports;
    function isImportSpecifier(node) {
        return node.kind === ts.SyntaxKind.ImportSpecifier;
    }
    ts.isImportSpecifier = isImportSpecifier;
    function isExportAssignment(node) {
        return node.kind === ts.SyntaxKind.ExportAssignment;
    }
    ts.isExportAssignment = isExportAssignment;
    function isExportDeclaration(node) {
        return node.kind === ts.SyntaxKind.ExportDeclaration;
    }
    ts.isExportDeclaration = isExportDeclaration;
    function isNamedExports(node) {
        return node.kind === ts.SyntaxKind.NamedExports;
    }
    ts.isNamedExports = isNamedExports;
    function isExportSpecifier(node) {
        return node.kind === ts.SyntaxKind.ExportSpecifier;
    }
    ts.isExportSpecifier = isExportSpecifier;
    function isMissingDeclaration(node) {
        return node.kind === ts.SyntaxKind.MissingDeclaration;
    }
    ts.isMissingDeclaration = isMissingDeclaration;
    // Module References
    function isExternalModuleReference(node) {
        return node.kind === ts.SyntaxKind.ExternalModuleReference;
    }
    ts.isExternalModuleReference = isExternalModuleReference;
    // JSX
    function isJsxElement(node) {
        return node.kind === ts.SyntaxKind.JsxElement;
    }
    ts.isJsxElement = isJsxElement;
    function isJsxSelfClosingElement(node) {
        return node.kind === ts.SyntaxKind.JsxSelfClosingElement;
    }
    ts.isJsxSelfClosingElement = isJsxSelfClosingElement;
    function isJsxOpeningElement(node) {
        return node.kind === ts.SyntaxKind.JsxOpeningElement;
    }
    ts.isJsxOpeningElement = isJsxOpeningElement;
    function isJsxClosingElement(node) {
        return node.kind === ts.SyntaxKind.JsxClosingElement;
    }
    ts.isJsxClosingElement = isJsxClosingElement;
    function isJsxFragment(node) {
        return node.kind === ts.SyntaxKind.JsxFragment;
    }
    ts.isJsxFragment = isJsxFragment;
    function isJsxOpeningFragment(node) {
        return node.kind === ts.SyntaxKind.JsxOpeningFragment;
    }
    ts.isJsxOpeningFragment = isJsxOpeningFragment;
    function isJsxClosingFragment(node) {
        return node.kind === ts.SyntaxKind.JsxClosingFragment;
    }
    ts.isJsxClosingFragment = isJsxClosingFragment;
    function isJsxAttribute(node) {
        return node.kind === ts.SyntaxKind.JsxAttribute;
    }
    ts.isJsxAttribute = isJsxAttribute;
    function isJsxAttributes(node) {
        return node.kind === ts.SyntaxKind.JsxAttributes;
    }
    ts.isJsxAttributes = isJsxAttributes;
    function isJsxSpreadAttribute(node) {
        return node.kind === ts.SyntaxKind.JsxSpreadAttribute;
    }
    ts.isJsxSpreadAttribute = isJsxSpreadAttribute;
    function isJsxExpression(node) {
        return node.kind === ts.SyntaxKind.JsxExpression;
    }
    ts.isJsxExpression = isJsxExpression;
    // Clauses
    function isCaseClause(node) {
        return node.kind === ts.SyntaxKind.CaseClause;
    }
    ts.isCaseClause = isCaseClause;
    function isDefaultClause(node) {
        return node.kind === ts.SyntaxKind.DefaultClause;
    }
    ts.isDefaultClause = isDefaultClause;
    function isHeritageClause(node) {
        return node.kind === ts.SyntaxKind.HeritageClause;
    }
    ts.isHeritageClause = isHeritageClause;
    function isCatchClause(node) {
        return node.kind === ts.SyntaxKind.CatchClause;
    }
    ts.isCatchClause = isCatchClause;
    // Property assignments
    function isPropertyAssignment(node) {
        return node.kind === ts.SyntaxKind.PropertyAssignment;
    }
    ts.isPropertyAssignment = isPropertyAssignment;
    function isShorthandPropertyAssignment(node) {
        return node.kind === ts.SyntaxKind.ShorthandPropertyAssignment;
    }
    ts.isShorthandPropertyAssignment = isShorthandPropertyAssignment;
    function isSpreadAssignment(node) {
        return node.kind === ts.SyntaxKind.SpreadAssignment;
    }
    ts.isSpreadAssignment = isSpreadAssignment;
    // Enum
    function isEnumMember(node) {
        return node.kind === ts.SyntaxKind.EnumMember;
    }
    ts.isEnumMember = isEnumMember;
    // Top-level nodes
    function isSourceFile(node) {
        return node.kind === ts.SyntaxKind.SourceFile;
    }
    ts.isSourceFile = isSourceFile;
    function isBundle(node) {
        return node.kind === ts.SyntaxKind.Bundle;
    }
    ts.isBundle = isBundle;
    // JSDoc
    function isJSDocTypeExpression(node) {
        return node.kind === ts.SyntaxKind.JSDocTypeExpression;
    }
    ts.isJSDocTypeExpression = isJSDocTypeExpression;
    function isJSDocAllType(node) {
        return node.kind === ts.SyntaxKind.JSDocAllType;
    }
    ts.isJSDocAllType = isJSDocAllType;
    function isJSDocUnknownType(node) {
        return node.kind === ts.SyntaxKind.JSDocUnknownType;
    }
    ts.isJSDocUnknownType = isJSDocUnknownType;
    function isJSDocNullableType(node) {
        return node.kind === ts.SyntaxKind.JSDocNullableType;
    }
    ts.isJSDocNullableType = isJSDocNullableType;
    function isJSDocNonNullableType(node) {
        return node.kind === ts.SyntaxKind.JSDocNonNullableType;
    }
    ts.isJSDocNonNullableType = isJSDocNonNullableType;
    function isJSDocOptionalType(node) {
        return node.kind === ts.SyntaxKind.JSDocOptionalType;
    }
    ts.isJSDocOptionalType = isJSDocOptionalType;
    function isJSDocFunctionType(node) {
        return node.kind === ts.SyntaxKind.JSDocFunctionType;
    }
    ts.isJSDocFunctionType = isJSDocFunctionType;
    function isJSDocVariadicType(node) {
        return node.kind === ts.SyntaxKind.JSDocVariadicType;
    }
    ts.isJSDocVariadicType = isJSDocVariadicType;
    function isJSDoc(node) {
        return node.kind === ts.SyntaxKind.JSDocComment;
    }
    ts.isJSDoc = isJSDoc;
    function isJSDocAugmentsTag(node) {
        return node.kind === ts.SyntaxKind.JSDocAugmentsTag;
    }
    ts.isJSDocAugmentsTag = isJSDocAugmentsTag;
    function isJSDocClassTag(node) {
        return node.kind === ts.SyntaxKind.JSDocClassTag;
    }
    ts.isJSDocClassTag = isJSDocClassTag;
    function isJSDocParameterTag(node) {
        return node.kind === ts.SyntaxKind.JSDocParameterTag;
    }
    ts.isJSDocParameterTag = isJSDocParameterTag;
    function isJSDocReturnTag(node) {
        return node.kind === ts.SyntaxKind.JSDocReturnTag;
    }
    ts.isJSDocReturnTag = isJSDocReturnTag;
    function isJSDocTypeTag(node) {
        return node.kind === ts.SyntaxKind.JSDocTypeTag;
    }
    ts.isJSDocTypeTag = isJSDocTypeTag;
    function isJSDocTemplateTag(node) {
        return node.kind === ts.SyntaxKind.JSDocTemplateTag;
    }
    ts.isJSDocTemplateTag = isJSDocTemplateTag;
    function isJSDocTypedefTag(node) {
        return node.kind === ts.SyntaxKind.JSDocTypedefTag;
    }
    ts.isJSDocTypedefTag = isJSDocTypedefTag;
    function isJSDocPropertyTag(node) {
        return node.kind === ts.SyntaxKind.JSDocPropertyTag;
    }
    ts.isJSDocPropertyTag = isJSDocPropertyTag;
    function isJSDocPropertyLikeTag(node) {
        return node.kind === ts.SyntaxKind.JSDocPropertyTag || node.kind === ts.SyntaxKind.JSDocParameterTag;
    }
    ts.isJSDocPropertyLikeTag = isJSDocPropertyLikeTag;
    function isJSDocTypeLiteral(node) {
        return node.kind === ts.SyntaxKind.JSDocTypeLiteral;
    }
    ts.isJSDocTypeLiteral = isJSDocTypeLiteral;
})(ts || (ts = {}));
// Node tests
//
// All node tests in the following list should *not* reference parent pointers so that
// they may be used with transformations.
(function (ts) {
    /* @internal */
    function isSyntaxList(n) {
        return n.kind === ts.SyntaxKind.SyntaxList;
    }
    ts.isSyntaxList = isSyntaxList;
    /* @internal */
    function isNode(node) {
        return isNodeKind(node.kind);
    }
    ts.isNode = isNode;
    /* @internal */
    function isNodeKind(kind) {
        return kind >= ts.SyntaxKind.FirstNode;
    }
    ts.isNodeKind = isNodeKind;
    /**
     * True if node is of some token syntax kind.
     * For example, this is true for an IfKeyword but not for an IfStatement.
     * Literals are considered tokens, except TemplateLiteral, but does include TemplateHead/Middle/Tail.
     */
    function isToken(n) {
        return n.kind >= ts.SyntaxKind.FirstToken && n.kind <= ts.SyntaxKind.LastToken;
    }
    ts.isToken = isToken;
    // Node Arrays
    /* @internal */
    function isNodeArray(array) {
        return array.hasOwnProperty("pos") && array.hasOwnProperty("end");
    }
    ts.isNodeArray = isNodeArray;
    // Literals
    /* @internal */
    function isLiteralKind(kind) {
        return ts.SyntaxKind.FirstLiteralToken <= kind && kind <= ts.SyntaxKind.LastLiteralToken;
    }
    ts.isLiteralKind = isLiteralKind;
    function isLiteralExpression(node) {
        return isLiteralKind(node.kind);
    }
    ts.isLiteralExpression = isLiteralExpression;
    // Pseudo-literals
    /* @internal */
    function isTemplateLiteralKind(kind) {
        return ts.SyntaxKind.FirstTemplateToken <= kind && kind <= ts.SyntaxKind.LastTemplateToken;
    }
    ts.isTemplateLiteralKind = isTemplateLiteralKind;
    function isTemplateMiddleOrTemplateTail(node) {
        const kind = node.kind;
        return kind === ts.SyntaxKind.TemplateMiddle
            || kind === ts.SyntaxKind.TemplateTail;
    }
    ts.isTemplateMiddleOrTemplateTail = isTemplateMiddleOrTemplateTail;
    function isStringTextContainingNode(node) {
        return node.kind === ts.SyntaxKind.StringLiteral || isTemplateLiteralKind(node.kind);
    }
    ts.isStringTextContainingNode = isStringTextContainingNode;
    // Identifiers
    /* @internal */
    function isGeneratedIdentifier(node) {
        // Using `>` here catches both `GeneratedIdentifierKind.None` and `undefined`.
        return ts.isIdentifier(node) && (node.autoGenerateFlags & 7 /* KindMask */) > 0 /* None */;
    }
    ts.isGeneratedIdentifier = isGeneratedIdentifier;
    // Keywords
    /* @internal */
    function isModifierKind(token) {
        switch (token) {
            case ts.SyntaxKind.AbstractKeyword:
            case ts.SyntaxKind.AsyncKeyword:
            case ts.SyntaxKind.ConstKeyword:
            case ts.SyntaxKind.DeclareKeyword:
            case ts.SyntaxKind.DefaultKeyword:
            case ts.SyntaxKind.ExportKeyword:
            case ts.SyntaxKind.PublicKeyword:
            case ts.SyntaxKind.PrivateKeyword:
            case ts.SyntaxKind.ProtectedKeyword:
            case ts.SyntaxKind.ReadonlyKeyword:
            case ts.SyntaxKind.StaticKeyword:
                return true;
        }
        return false;
    }
    ts.isModifierKind = isModifierKind;
    /* @internal */
    function isParameterPropertyModifier(kind) {
        return !!(ts.modifierToFlag(kind) & ts.ModifierFlags.ParameterPropertyModifier);
    }
    ts.isParameterPropertyModifier = isParameterPropertyModifier;
    /* @internal */
    function isClassMemberModifier(idToken) {
        return isParameterPropertyModifier(idToken) || idToken === ts.SyntaxKind.StaticKeyword;
    }
    ts.isClassMemberModifier = isClassMemberModifier;
    function isModifier(node) {
        return isModifierKind(node.kind);
    }
    ts.isModifier = isModifier;
    function isEntityName(node) {
        const kind = node.kind;
        return kind === ts.SyntaxKind.QualifiedName
            || kind === ts.SyntaxKind.Identifier;
    }
    ts.isEntityName = isEntityName;
    function isPropertyName(node) {
        const kind = node.kind;
        return kind === ts.SyntaxKind.Identifier
            || kind === ts.SyntaxKind.StringLiteral
            || kind === ts.SyntaxKind.NumericLiteral
            || kind === ts.SyntaxKind.ComputedPropertyName;
    }
    ts.isPropertyName = isPropertyName;
    function isBindingName(node) {
        const kind = node.kind;
        return kind === ts.SyntaxKind.Identifier
            || kind === ts.SyntaxKind.ObjectBindingPattern
            || kind === ts.SyntaxKind.ArrayBindingPattern;
    }
    ts.isBindingName = isBindingName;
    // Functions
    function isFunctionLike(node) {
        return node && isFunctionLikeKind(node.kind);
    }
    ts.isFunctionLike = isFunctionLike;
    /* @internal */
    function isFunctionLikeDeclaration(node) {
        return node && isFunctionLikeDeclarationKind(node.kind);
    }
    ts.isFunctionLikeDeclaration = isFunctionLikeDeclaration;
    function isFunctionLikeDeclarationKind(kind) {
        switch (kind) {
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.MethodDeclaration:
            case ts.SyntaxKind.Constructor:
            case ts.SyntaxKind.GetAccessor:
            case ts.SyntaxKind.SetAccessor:
            case ts.SyntaxKind.FunctionExpression:
            case ts.SyntaxKind.ArrowFunction:
                return true;
            default:
                return false;
        }
    }
    /* @internal */
    function isFunctionLikeKind(kind) {
        switch (kind) {
            case ts.SyntaxKind.MethodSignature:
            case ts.SyntaxKind.CallSignature:
            case ts.SyntaxKind.ConstructSignature:
            case ts.SyntaxKind.IndexSignature:
            case ts.SyntaxKind.FunctionType:
            case ts.SyntaxKind.JSDocFunctionType:
            case ts.SyntaxKind.ConstructorType:
                return true;
            default:
                return isFunctionLikeDeclarationKind(kind);
        }
    }
    ts.isFunctionLikeKind = isFunctionLikeKind;
    /* @internal */
    function isFunctionOrModuleBlock(node) {
        return ts.isSourceFile(node) || ts.isModuleBlock(node) || ts.isBlock(node) && isFunctionLike(node.parent);
    }
    ts.isFunctionOrModuleBlock = isFunctionOrModuleBlock;
    // Classes
    function isClassElement(node) {
        const kind = node.kind;
        return kind === ts.SyntaxKind.Constructor
            || kind === ts.SyntaxKind.PropertyDeclaration
            || kind === ts.SyntaxKind.MethodDeclaration
            || kind === ts.SyntaxKind.GetAccessor
            || kind === ts.SyntaxKind.SetAccessor
            || kind === ts.SyntaxKind.IndexSignature
            || kind === ts.SyntaxKind.SemicolonClassElement;
    }
    ts.isClassElement = isClassElement;
    function isClassLike(node) {
        return node && (node.kind === ts.SyntaxKind.ClassDeclaration || node.kind === ts.SyntaxKind.ClassExpression);
    }
    ts.isClassLike = isClassLike;
    function isAccessor(node) {
        return node && (node.kind === ts.SyntaxKind.GetAccessor || node.kind === ts.SyntaxKind.SetAccessor);
    }
    ts.isAccessor = isAccessor;
    /* @internal */
    function isMethodOrAccessor(node) {
        switch (node.kind) {
            case ts.SyntaxKind.MethodDeclaration:
            case ts.SyntaxKind.GetAccessor:
            case ts.SyntaxKind.SetAccessor:
                return true;
            default:
                return false;
        }
    }
    ts.isMethodOrAccessor = isMethodOrAccessor;
    // Type members
    function isTypeElement(node) {
        const kind = node.kind;
        return kind === ts.SyntaxKind.ConstructSignature
            || kind === ts.SyntaxKind.CallSignature
            || kind === ts.SyntaxKind.PropertySignature
            || kind === ts.SyntaxKind.MethodSignature
            || kind === ts.SyntaxKind.IndexSignature;
    }
    ts.isTypeElement = isTypeElement;
    function isClassOrTypeElement(node) {
        return isTypeElement(node) || isClassElement(node);
    }
    ts.isClassOrTypeElement = isClassOrTypeElement;
    function isObjectLiteralElementLike(node) {
        const kind = node.kind;
        return kind === ts.SyntaxKind.PropertyAssignment
            || kind === ts.SyntaxKind.ShorthandPropertyAssignment
            || kind === ts.SyntaxKind.SpreadAssignment
            || kind === ts.SyntaxKind.MethodDeclaration
            || kind === ts.SyntaxKind.GetAccessor
            || kind === ts.SyntaxKind.SetAccessor;
    }
    ts.isObjectLiteralElementLike = isObjectLiteralElementLike;
    // Type
    function isTypeNodeKind(kind) {
        return (kind >= ts.SyntaxKind.FirstTypeNode && kind <= ts.SyntaxKind.LastTypeNode)
            || kind === ts.SyntaxKind.AnyKeyword
            || kind === ts.SyntaxKind.NumberKeyword
            || kind === ts.SyntaxKind.ObjectKeyword
            || kind === ts.SyntaxKind.BooleanKeyword
            || kind === ts.SyntaxKind.StringKeyword
            || kind === ts.SyntaxKind.SymbolKeyword
            || kind === ts.SyntaxKind.ThisKeyword
            || kind === ts.SyntaxKind.VoidKeyword
            || kind === ts.SyntaxKind.UndefinedKeyword
            || kind === ts.SyntaxKind.NullKeyword
            || kind === ts.SyntaxKind.NeverKeyword
            || kind === ts.SyntaxKind.ExpressionWithTypeArguments
            || kind === ts.SyntaxKind.JSDocAllType
            || kind === ts.SyntaxKind.JSDocUnknownType
            || kind === ts.SyntaxKind.JSDocNullableType
            || kind === ts.SyntaxKind.JSDocNonNullableType
            || kind === ts.SyntaxKind.JSDocOptionalType
            || kind === ts.SyntaxKind.JSDocFunctionType
            || kind === ts.SyntaxKind.JSDocVariadicType;
    }
    /**
     * Node test that determines whether a node is a valid type node.
     * This differs from the `isPartOfTypeNode` function which determines whether a node is *part*
     * of a TypeNode.
     */
    function isTypeNode(node) {
        return isTypeNodeKind(node.kind);
    }
    ts.isTypeNode = isTypeNode;
    function isFunctionOrConstructorTypeNode(node) {
        switch (node.kind) {
            case ts.SyntaxKind.FunctionType:
            case ts.SyntaxKind.ConstructorType:
                return true;
        }
        return false;
    }
    ts.isFunctionOrConstructorTypeNode = isFunctionOrConstructorTypeNode;
    // Binding patterns
    /* @internal */
    function isBindingPattern(node) {
        if (node) {
            const kind = node.kind;
            return kind === ts.SyntaxKind.ArrayBindingPattern
                || kind === ts.SyntaxKind.ObjectBindingPattern;
        }
        return false;
    }
    ts.isBindingPattern = isBindingPattern;
    /* @internal */
    function isAssignmentPattern(node) {
        const kind = node.kind;
        return kind === ts.SyntaxKind.ArrayLiteralExpression
            || kind === ts.SyntaxKind.ObjectLiteralExpression;
    }
    ts.isAssignmentPattern = isAssignmentPattern;
    /* @internal */
    function isArrayBindingElement(node) {
        const kind = node.kind;
        return kind === ts.SyntaxKind.BindingElement
            || kind === ts.SyntaxKind.OmittedExpression;
    }
    ts.isArrayBindingElement = isArrayBindingElement;
    /**
     * Determines whether the BindingOrAssignmentElement is a BindingElement-like declaration
     */
    /* @internal */
    function isDeclarationBindingElement(bindingElement) {
        switch (bindingElement.kind) {
            case ts.SyntaxKind.VariableDeclaration:
            case ts.SyntaxKind.Parameter:
            case ts.SyntaxKind.BindingElement:
                return true;
        }
        return false;
    }
    ts.isDeclarationBindingElement = isDeclarationBindingElement;
    /**
     * Determines whether a node is a BindingOrAssignmentPattern
     */
    /* @internal */
    function isBindingOrAssignmentPattern(node) {
        return isObjectBindingOrAssignmentPattern(node)
            || isArrayBindingOrAssignmentPattern(node);
    }
    ts.isBindingOrAssignmentPattern = isBindingOrAssignmentPattern;
    /**
     * Determines whether a node is an ObjectBindingOrAssignmentPattern
     */
    /* @internal */
    function isObjectBindingOrAssignmentPattern(node) {
        switch (node.kind) {
            case ts.SyntaxKind.ObjectBindingPattern:
            case ts.SyntaxKind.ObjectLiteralExpression:
                return true;
        }
        return false;
    }
    ts.isObjectBindingOrAssignmentPattern = isObjectBindingOrAssignmentPattern;
    /**
     * Determines whether a node is an ArrayBindingOrAssignmentPattern
     */
    /* @internal */
    function isArrayBindingOrAssignmentPattern(node) {
        switch (node.kind) {
            case ts.SyntaxKind.ArrayBindingPattern:
            case ts.SyntaxKind.ArrayLiteralExpression:
                return true;
        }
        return false;
    }
    ts.isArrayBindingOrAssignmentPattern = isArrayBindingOrAssignmentPattern;
    /* @internal */
    function isPropertyAccessOrQualifiedNameOrImportTypeNode(node) {
        const kind = node.kind;
        return kind === ts.SyntaxKind.PropertyAccessExpression
            || kind === ts.SyntaxKind.QualifiedName
            || kind === ts.SyntaxKind.ImportType;
    }
    ts.isPropertyAccessOrQualifiedNameOrImportTypeNode = isPropertyAccessOrQualifiedNameOrImportTypeNode;
    // Expression
    function isPropertyAccessOrQualifiedName(node) {
        const kind = node.kind;
        return kind === ts.SyntaxKind.PropertyAccessExpression
            || kind === ts.SyntaxKind.QualifiedName;
    }
    ts.isPropertyAccessOrQualifiedName = isPropertyAccessOrQualifiedName;
    function isCallLikeExpression(node) {
        switch (node.kind) {
            case ts.SyntaxKind.JsxOpeningElement:
            case ts.SyntaxKind.JsxSelfClosingElement:
            case ts.SyntaxKind.CallExpression:
            case ts.SyntaxKind.NewExpression:
            case ts.SyntaxKind.TaggedTemplateExpression:
            case ts.SyntaxKind.Decorator:
                return true;
            default:
                return false;
        }
    }
    ts.isCallLikeExpression = isCallLikeExpression;
    function isCallOrNewExpression(node) {
        return node.kind === ts.SyntaxKind.CallExpression || node.kind === ts.SyntaxKind.NewExpression;
    }
    ts.isCallOrNewExpression = isCallOrNewExpression;
    function isTemplateLiteral(node) {
        const kind = node.kind;
        return kind === ts.SyntaxKind.TemplateExpression
            || kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral;
    }
    ts.isTemplateLiteral = isTemplateLiteral;
    /* @internal */
    function isLeftHandSideExpression(node) {
        return isLeftHandSideExpressionKind(ts.skipPartiallyEmittedExpressions(node).kind);
    }
    ts.isLeftHandSideExpression = isLeftHandSideExpression;
    function isLeftHandSideExpressionKind(kind) {
        switch (kind) {
            case ts.SyntaxKind.PropertyAccessExpression:
            case ts.SyntaxKind.ElementAccessExpression:
            case ts.SyntaxKind.NewExpression:
            case ts.SyntaxKind.CallExpression:
            case ts.SyntaxKind.JsxElement:
            case ts.SyntaxKind.JsxSelfClosingElement:
            case ts.SyntaxKind.JsxFragment:
            case ts.SyntaxKind.TaggedTemplateExpression:
            case ts.SyntaxKind.ArrayLiteralExpression:
            case ts.SyntaxKind.ParenthesizedExpression:
            case ts.SyntaxKind.ObjectLiteralExpression:
            case ts.SyntaxKind.ClassExpression:
            case ts.SyntaxKind.FunctionExpression:
            case ts.SyntaxKind.Identifier:
            case ts.SyntaxKind.RegularExpressionLiteral:
            case ts.SyntaxKind.NumericLiteral:
            case ts.SyntaxKind.StringLiteral:
            case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
            case ts.SyntaxKind.TemplateExpression:
            case ts.SyntaxKind.FalseKeyword:
            case ts.SyntaxKind.NullKeyword:
            case ts.SyntaxKind.ThisKeyword:
            case ts.SyntaxKind.TrueKeyword:
            case ts.SyntaxKind.SuperKeyword:
            case ts.SyntaxKind.NonNullExpression:
            case ts.SyntaxKind.MetaProperty:
            case ts.SyntaxKind.ImportKeyword: // technically this is only an Expression if it's in a CallExpression
                return true;
            default:
                return false;
        }
    }
    /* @internal */
    function isUnaryExpression(node) {
        return isUnaryExpressionKind(ts.skipPartiallyEmittedExpressions(node).kind);
    }
    ts.isUnaryExpression = isUnaryExpression;
    function isUnaryExpressionKind(kind) {
        switch (kind) {
            case ts.SyntaxKind.PrefixUnaryExpression:
            case ts.SyntaxKind.PostfixUnaryExpression:
            case ts.SyntaxKind.DeleteExpression:
            case ts.SyntaxKind.TypeOfExpression:
            case ts.SyntaxKind.VoidExpression:
            case ts.SyntaxKind.AwaitExpression:
            case ts.SyntaxKind.TypeAssertionExpression:
                return true;
            default:
                return isLeftHandSideExpressionKind(kind);
        }
    }
    /* @internal */
    function isUnaryExpressionWithWrite(expr) {
        switch (expr.kind) {
            case ts.SyntaxKind.PostfixUnaryExpression:
                return true;
            case ts.SyntaxKind.PrefixUnaryExpression:
                return expr.operator === ts.SyntaxKind.PlusPlusToken ||
                    expr.operator === ts.SyntaxKind.MinusMinusToken;
            default:
                return false;
        }
    }
    ts.isUnaryExpressionWithWrite = isUnaryExpressionWithWrite;
    /* @internal */
    /**
     * Determines whether a node is an expression based only on its kind.
     * Use `isExpressionNode` if not in transforms.
     */
    function isExpression(node) {
        return isExpressionKind(ts.skipPartiallyEmittedExpressions(node).kind);
    }
    ts.isExpression = isExpression;
    function isExpressionKind(kind) {
        switch (kind) {
            case ts.SyntaxKind.ConditionalExpression:
            case ts.SyntaxKind.YieldExpression:
            case ts.SyntaxKind.ArrowFunction:
            case ts.SyntaxKind.BinaryExpression:
            case ts.SyntaxKind.SpreadElement:
            case ts.SyntaxKind.AsExpression:
            case ts.SyntaxKind.OmittedExpression:
            case ts.SyntaxKind.CommaListExpression:
            case ts.SyntaxKind.PartiallyEmittedExpression:
                return true;
            default:
                return isUnaryExpressionKind(kind);
        }
    }
    function isAssertionExpression(node) {
        const kind = node.kind;
        return kind === ts.SyntaxKind.TypeAssertionExpression
            || kind === ts.SyntaxKind.AsExpression;
    }
    ts.isAssertionExpression = isAssertionExpression;
    /* @internal */
    function isPartiallyEmittedExpression(node) {
        return node.kind === ts.SyntaxKind.PartiallyEmittedExpression;
    }
    ts.isPartiallyEmittedExpression = isPartiallyEmittedExpression;
    /* @internal */
    function isNotEmittedStatement(node) {
        return node.kind === ts.SyntaxKind.NotEmittedStatement;
    }
    ts.isNotEmittedStatement = isNotEmittedStatement;
    /* @internal */
    function isNotEmittedOrPartiallyEmittedNode(node) {
        return isNotEmittedStatement(node)
            || isPartiallyEmittedExpression(node);
    }
    ts.isNotEmittedOrPartiallyEmittedNode = isNotEmittedOrPartiallyEmittedNode;
    function isIterationStatement(node, lookInLabeledStatements) {
        switch (node.kind) {
            case ts.SyntaxKind.ForStatement:
            case ts.SyntaxKind.ForInStatement:
            case ts.SyntaxKind.ForOfStatement:
            case ts.SyntaxKind.DoStatement:
            case ts.SyntaxKind.WhileStatement:
                return true;
            case ts.SyntaxKind.LabeledStatement:
                return lookInLabeledStatements && isIterationStatement(node.statement, lookInLabeledStatements);
        }
        return false;
    }
    ts.isIterationStatement = isIterationStatement;
    /* @internal */
    function isForInOrOfStatement(node) {
        return node.kind === ts.SyntaxKind.ForInStatement || node.kind === ts.SyntaxKind.ForOfStatement;
    }
    ts.isForInOrOfStatement = isForInOrOfStatement;
    // Element
    /* @internal */
    function isConciseBody(node) {
        return ts.isBlock(node)
            || isExpression(node);
    }
    ts.isConciseBody = isConciseBody;
    /* @internal */
    function isFunctionBody(node) {
        return ts.isBlock(node);
    }
    ts.isFunctionBody = isFunctionBody;
    /* @internal */
    function isForInitializer(node) {
        return ts.isVariableDeclarationList(node)
            || isExpression(node);
    }
    ts.isForInitializer = isForInitializer;
    /* @internal */
    function isModuleBody(node) {
        const kind = node.kind;
        return kind === ts.SyntaxKind.ModuleBlock
            || kind === ts.SyntaxKind.ModuleDeclaration
            || kind === ts.SyntaxKind.Identifier;
    }
    ts.isModuleBody = isModuleBody;
    /* @internal */
    function isNamespaceBody(node) {
        const kind = node.kind;
        return kind === ts.SyntaxKind.ModuleBlock
            || kind === ts.SyntaxKind.ModuleDeclaration;
    }
    ts.isNamespaceBody = isNamespaceBody;
    /* @internal */
    function isJSDocNamespaceBody(node) {
        const kind = node.kind;
        return kind === ts.SyntaxKind.Identifier
            || kind === ts.SyntaxKind.ModuleDeclaration;
    }
    ts.isJSDocNamespaceBody = isJSDocNamespaceBody;
    /* @internal */
    function isNamedImportBindings(node) {
        const kind = node.kind;
        return kind === ts.SyntaxKind.NamedImports
            || kind === ts.SyntaxKind.NamespaceImport;
    }
    ts.isNamedImportBindings = isNamedImportBindings;
    /* @internal */
    function isModuleOrEnumDeclaration(node) {
        return node.kind === ts.SyntaxKind.ModuleDeclaration || node.kind === ts.SyntaxKind.EnumDeclaration;
    }
    ts.isModuleOrEnumDeclaration = isModuleOrEnumDeclaration;
    function isDeclarationKind(kind) {
        return kind === ts.SyntaxKind.ArrowFunction
            || kind === ts.SyntaxKind.BindingElement
            || kind === ts.SyntaxKind.ClassDeclaration
            || kind === ts.SyntaxKind.ClassExpression
            || kind === ts.SyntaxKind.Constructor
            || kind === ts.SyntaxKind.EnumDeclaration
            || kind === ts.SyntaxKind.EnumMember
            || kind === ts.SyntaxKind.ExportSpecifier
            || kind === ts.SyntaxKind.FunctionDeclaration
            || kind === ts.SyntaxKind.FunctionExpression
            || kind === ts.SyntaxKind.GetAccessor
            || kind === ts.SyntaxKind.ImportClause
            || kind === ts.SyntaxKind.ImportEqualsDeclaration
            || kind === ts.SyntaxKind.ImportSpecifier
            || kind === ts.SyntaxKind.InterfaceDeclaration
            || kind === ts.SyntaxKind.JsxAttribute
            || kind === ts.SyntaxKind.MethodDeclaration
            || kind === ts.SyntaxKind.MethodSignature
            || kind === ts.SyntaxKind.ModuleDeclaration
            || kind === ts.SyntaxKind.NamespaceExportDeclaration
            || kind === ts.SyntaxKind.NamespaceImport
            || kind === ts.SyntaxKind.Parameter
            || kind === ts.SyntaxKind.PropertyAssignment
            || kind === ts.SyntaxKind.PropertyDeclaration
            || kind === ts.SyntaxKind.PropertySignature
            || kind === ts.SyntaxKind.SetAccessor
            || kind === ts.SyntaxKind.ShorthandPropertyAssignment
            || kind === ts.SyntaxKind.TypeAliasDeclaration
            || kind === ts.SyntaxKind.TypeParameter
            || kind === ts.SyntaxKind.VariableDeclaration
            || kind === ts.SyntaxKind.JSDocTypedefTag;
    }
    function isDeclarationStatementKind(kind) {
        return kind === ts.SyntaxKind.FunctionDeclaration
            || kind === ts.SyntaxKind.MissingDeclaration
            || kind === ts.SyntaxKind.ClassDeclaration
            || kind === ts.SyntaxKind.InterfaceDeclaration
            || kind === ts.SyntaxKind.TypeAliasDeclaration
            || kind === ts.SyntaxKind.EnumDeclaration
            || kind === ts.SyntaxKind.ModuleDeclaration
            || kind === ts.SyntaxKind.ImportDeclaration
            || kind === ts.SyntaxKind.ImportEqualsDeclaration
            || kind === ts.SyntaxKind.ExportDeclaration
            || kind === ts.SyntaxKind.ExportAssignment
            || kind === ts.SyntaxKind.NamespaceExportDeclaration;
    }
    function isStatementKindButNotDeclarationKind(kind) {
        return kind === ts.SyntaxKind.BreakStatement
            || kind === ts.SyntaxKind.ContinueStatement
            || kind === ts.SyntaxKind.DebuggerStatement
            || kind === ts.SyntaxKind.DoStatement
            || kind === ts.SyntaxKind.ExpressionStatement
            || kind === ts.SyntaxKind.EmptyStatement
            || kind === ts.SyntaxKind.ForInStatement
            || kind === ts.SyntaxKind.ForOfStatement
            || kind === ts.SyntaxKind.ForStatement
            || kind === ts.SyntaxKind.IfStatement
            || kind === ts.SyntaxKind.LabeledStatement
            || kind === ts.SyntaxKind.ReturnStatement
            || kind === ts.SyntaxKind.SwitchStatement
            || kind === ts.SyntaxKind.ThrowStatement
            || kind === ts.SyntaxKind.TryStatement
            || kind === ts.SyntaxKind.VariableStatement
            || kind === ts.SyntaxKind.WhileStatement
            || kind === ts.SyntaxKind.WithStatement
            || kind === ts.SyntaxKind.NotEmittedStatement
            || kind === ts.SyntaxKind.EndOfDeclarationMarker
            || kind === ts.SyntaxKind.MergeDeclarationMarker;
    }
    /* @internal */
    function isDeclaration(node) {
        if (node.kind === ts.SyntaxKind.TypeParameter) {
            return node.parent.kind !== ts.SyntaxKind.JSDocTemplateTag || ts.isInJavaScriptFile(node);
        }
        return isDeclarationKind(node.kind);
    }
    ts.isDeclaration = isDeclaration;
    /* @internal */
    function isDeclarationStatement(node) {
        return isDeclarationStatementKind(node.kind);
    }
    ts.isDeclarationStatement = isDeclarationStatement;
    /**
     * Determines whether the node is a statement that is not also a declaration
     */
    /* @internal */
    function isStatementButNotDeclaration(node) {
        return isStatementKindButNotDeclarationKind(node.kind);
    }
    ts.isStatementButNotDeclaration = isStatementButNotDeclaration;
    /* @internal */
    function isStatement(node) {
        const kind = node.kind;
        return isStatementKindButNotDeclarationKind(kind)
            || isDeclarationStatementKind(kind)
            || isBlockStatement(node);
    }
    ts.isStatement = isStatement;
    function isBlockStatement(node) {
        if (node.kind !== ts.SyntaxKind.Block)
            return false;
        if (node.parent !== undefined) {
            if (node.parent.kind === ts.SyntaxKind.TryStatement || node.parent.kind === ts.SyntaxKind.CatchClause) {
                return false;
            }
        }
        return !ts.isFunctionBlock(node);
    }
    // Module references
    /* @internal */
    function isModuleReference(node) {
        const kind = node.kind;
        return kind === ts.SyntaxKind.ExternalModuleReference
            || kind === ts.SyntaxKind.QualifiedName
            || kind === ts.SyntaxKind.Identifier;
    }
    ts.isModuleReference = isModuleReference;
    // JSX
    /* @internal */
    function isJsxTagNameExpression(node) {
        const kind = node.kind;
        return kind === ts.SyntaxKind.ThisKeyword
            || kind === ts.SyntaxKind.Identifier
            || kind === ts.SyntaxKind.PropertyAccessExpression;
    }
    ts.isJsxTagNameExpression = isJsxTagNameExpression;
    /* @internal */
    function isJsxChild(node) {
        const kind = node.kind;
        return kind === ts.SyntaxKind.JsxElement
            || kind === ts.SyntaxKind.JsxExpression
            || kind === ts.SyntaxKind.JsxSelfClosingElement
            || kind === ts.SyntaxKind.JsxText
            || kind === ts.SyntaxKind.JsxFragment;
    }
    ts.isJsxChild = isJsxChild;
    /* @internal */
    function isJsxAttributeLike(node) {
        const kind = node.kind;
        return kind === ts.SyntaxKind.JsxAttribute
            || kind === ts.SyntaxKind.JsxSpreadAttribute;
    }
    ts.isJsxAttributeLike = isJsxAttributeLike;
    /* @internal */
    function isStringLiteralOrJsxExpression(node) {
        const kind = node.kind;
        return kind === ts.SyntaxKind.StringLiteral
            || kind === ts.SyntaxKind.JsxExpression;
    }
    ts.isStringLiteralOrJsxExpression = isStringLiteralOrJsxExpression;
    function isJsxOpeningLikeElement(node) {
        const kind = node.kind;
        return kind === ts.SyntaxKind.JsxOpeningElement
            || kind === ts.SyntaxKind.JsxSelfClosingElement;
    }
    ts.isJsxOpeningLikeElement = isJsxOpeningLikeElement;
    // Clauses
    function isCaseOrDefaultClause(node) {
        const kind = node.kind;
        return kind === ts.SyntaxKind.CaseClause
            || kind === ts.SyntaxKind.DefaultClause;
    }
    ts.isCaseOrDefaultClause = isCaseOrDefaultClause;
    // JSDoc
    /** True if node is of some JSDoc syntax kind. */
    /* @internal */
    function isJSDocNode(node) {
        return node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode;
    }
    ts.isJSDocNode = isJSDocNode;
    /** True if node is of a kind that may contain comment text. */
    function isJSDocCommentContainingNode(node) {
        return node.kind === ts.SyntaxKind.JSDocComment || isJSDocTag(node) || ts.isJSDocTypeLiteral(node);
    }
    ts.isJSDocCommentContainingNode = isJSDocCommentContainingNode;
    // TODO: determine what this does before making it public.
    /* @internal */
    function isJSDocTag(node) {
        return node.kind >= ts.SyntaxKind.FirstJSDocTagNode && node.kind <= ts.SyntaxKind.LastJSDocTagNode;
    }
    ts.isJSDocTag = isJSDocTag;
    function isSetAccessor(node) {
        return node.kind === ts.SyntaxKind.SetAccessor;
    }
    ts.isSetAccessor = isSetAccessor;
    function isGetAccessor(node) {
        return node.kind === ts.SyntaxKind.GetAccessor;
    }
    ts.isGetAccessor = isGetAccessor;
    /** True if has jsdoc nodes attached to it. */
    /* @internal */
    function hasJSDocNodes(node) {
        return !!node.jsDoc && node.jsDoc.length > 0;
    }
    ts.hasJSDocNodes = hasJSDocNodes;
    /** True if has type node attached to it. */
    /* @internal */
    function hasType(node) {
        return !!node.type;
    }
    ts.hasType = hasType;
    /* True if the node could have a type node a `.type` */
    /* @internal */
    function couldHaveType(node) {
        switch (node.kind) {
            case ts.SyntaxKind.Parameter:
            case ts.SyntaxKind.PropertySignature:
            case ts.SyntaxKind.PropertyDeclaration:
            case ts.SyntaxKind.MethodSignature:
            case ts.SyntaxKind.MethodDeclaration:
            case ts.SyntaxKind.Constructor:
            case ts.SyntaxKind.GetAccessor:
            case ts.SyntaxKind.SetAccessor:
            case ts.SyntaxKind.CallSignature:
            case ts.SyntaxKind.ConstructSignature:
            case ts.SyntaxKind.IndexSignature:
            case ts.SyntaxKind.TypePredicate:
            case ts.SyntaxKind.FunctionType:
            case ts.SyntaxKind.ConstructorType:
            case ts.SyntaxKind.ParenthesizedType:
            case ts.SyntaxKind.TypeOperator:
            case ts.SyntaxKind.MappedType:
            case ts.SyntaxKind.TypeAssertionExpression:
            case ts.SyntaxKind.FunctionExpression:
            case ts.SyntaxKind.ArrowFunction:
            case ts.SyntaxKind.AsExpression:
            case ts.SyntaxKind.VariableDeclaration:
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.TypeAliasDeclaration:
            case ts.SyntaxKind.JSDocTypeExpression:
            case ts.SyntaxKind.JSDocNullableType:
            case ts.SyntaxKind.JSDocNonNullableType:
            case ts.SyntaxKind.JSDocOptionalType:
            case ts.SyntaxKind.JSDocFunctionType:
            case ts.SyntaxKind.JSDocVariadicType:
                return true;
        }
        return false;
    }
    ts.couldHaveType = couldHaveType;
    /** True if has initializer node attached to it. */
    /* @internal */
    function hasInitializer(node) {
        return !!node.initializer;
    }
    ts.hasInitializer = hasInitializer;
    /** True if has initializer node attached to it. */
    /* @internal */
    function hasOnlyExpressionInitializer(node) {
        return hasInitializer(node) && !ts.isForStatement(node) && !ts.isForInStatement(node) && !ts.isForOfStatement(node) && !ts.isJsxAttribute(node);
    }
    ts.hasOnlyExpressionInitializer = hasOnlyExpressionInitializer;
    function isObjectLiteralElement(node) {
        switch (node.kind) {
            case ts.SyntaxKind.JsxAttribute:
            case ts.SyntaxKind.JsxSpreadAttribute:
            case ts.SyntaxKind.PropertyAssignment:
            case ts.SyntaxKind.ShorthandPropertyAssignment:
            case ts.SyntaxKind.MethodDeclaration:
            case ts.SyntaxKind.GetAccessor:
            case ts.SyntaxKind.SetAccessor:
                return true;
            default:
                return false;
        }
    }
    ts.isObjectLiteralElement = isObjectLiteralElement;
    /* @internal */
    function isTypeReferenceType(node) {
        return node.kind === ts.SyntaxKind.TypeReference || node.kind === ts.SyntaxKind.ExpressionWithTypeArguments;
    }
    ts.isTypeReferenceType = isTypeReferenceType;
    const MAX_SMI_X86 = 1073741823;
    /* @internal */
    function guessIndentation(lines) {
        let indentation = MAX_SMI_X86;
        for (const line of lines) {
            if (!line.length) {
                continue;
            }
            let i = 0;
            for (; i < line.length && i < indentation; i++) {
                if (!ts.isWhiteSpaceLike(line.charCodeAt(i))) {
                    break;
                }
            }
            if (i < indentation) {
                indentation = i;
            }
            if (indentation === 0) {
                return 0;
            }
        }
        return indentation === MAX_SMI_X86 ? undefined : indentation;
    }
    ts.guessIndentation = guessIndentation;
    function isStringLiteralLike(node) {
        return node.kind === ts.SyntaxKind.StringLiteral || node.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral;
    }
    ts.isStringLiteralLike = isStringLiteralLike;
    /** @internal */
    function isNamedImportsOrExports(node) {
        return node.kind === ts.SyntaxKind.NamedImports || node.kind === ts.SyntaxKind.NamedExports;
    }
    ts.isNamedImportsOrExports = isNamedImportsOrExports;
})(ts || (ts = {}));
