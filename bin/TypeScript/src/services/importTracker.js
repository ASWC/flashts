/* Code for finding imports of an exported symbol. Used only by FindAllReferences. */
/* @internal */
var ts;
(function (ts) {
    var FindAllReferences;
    (function (FindAllReferences) {
        /** Creates the imports map and returns an ImportTracker that uses it. Call this lazily to avoid calling `getDirectImportsMap` unnecessarily.  */
        function createImportTracker(sourceFiles, sourceFilesSet, checker, cancellationToken) {
            const allDirectImports = getDirectImportsMap(sourceFiles, checker, cancellationToken);
            return (exportSymbol, exportInfo, isForRename) => {
                const { directImports, indirectUsers } = getImportersForExport(sourceFiles, sourceFilesSet, allDirectImports, exportInfo, checker, cancellationToken);
                return Object.assign({ indirectUsers }, getSearchesFromDirectImports(directImports, exportSymbol, exportInfo.exportKind, checker, isForRename));
            };
        }
        FindAllReferences.createImportTracker = createImportTracker;
        /** Returns import statements that directly reference the exporting module, and a list of files that may access the module through a namespace. */
        function getImportersForExport(sourceFiles, sourceFilesSet, allDirectImports, { exportingModuleSymbol, exportKind }, checker, cancellationToken) {
            const markSeenDirectImport = ts.nodeSeenTracker();
            const markSeenIndirectUser = ts.nodeSeenTracker();
            const directImports = [];
            const isAvailableThroughGlobal = !!exportingModuleSymbol.globalExports;
            const indirectUserDeclarations = isAvailableThroughGlobal ? undefined : [];
            handleDirectImports(exportingModuleSymbol);
            return { directImports, indirectUsers: getIndirectUsers() };
            function getIndirectUsers() {
                if (isAvailableThroughGlobal) {
                    // It has `export as namespace`, so anything could potentially use it.
                    return sourceFiles;
                }
                // Module augmentations may use this module's exports without importing it.
                for (const decl of exportingModuleSymbol.declarations) {
                    if (ts.isExternalModuleAugmentation(decl) && sourceFilesSet.has(decl.getSourceFile().fileName)) {
                        addIndirectUser(decl);
                    }
                }
                // This may return duplicates (if there are multiple module declarations in a single source file, all importing the same thing as a namespace), but `State.markSearchedSymbol` will handle that.
                return indirectUserDeclarations.map(ts.getSourceFileOfNode);
            }
            function handleDirectImports(exportingModuleSymbol) {
                const theseDirectImports = getDirectImports(exportingModuleSymbol);
                if (theseDirectImports) {
                    for (const direct of theseDirectImports) {
                        if (!markSeenDirectImport(direct)) {
                            continue;
                        }
                        cancellationToken.throwIfCancellationRequested();
                        switch (direct.kind) {
                            case ts.SyntaxKind.CallExpression:
                                if (!isAvailableThroughGlobal) {
                                    const parent = direct.parent;
                                    if (exportKind === 2 /* ExportEquals */ && parent.kind === ts.SyntaxKind.VariableDeclaration) {
                                        const { name } = parent;
                                        if (name.kind === ts.SyntaxKind.Identifier) {
                                            directImports.push(name);
                                            break;
                                        }
                                    }
                                    // Don't support re-exporting 'require()' calls, so just add a single indirect user.
                                    addIndirectUser(direct.getSourceFile());
                                }
                                break;
                            case ts.SyntaxKind.ImportEqualsDeclaration:
                                handleNamespaceImport(direct, direct.name, ts.hasModifier(direct, ts.ModifierFlags.Export));
                                break;
                            case ts.SyntaxKind.ImportDeclaration:
                                const namedBindings = direct.importClause && direct.importClause.namedBindings;
                                if (namedBindings && namedBindings.kind === ts.SyntaxKind.NamespaceImport) {
                                    handleNamespaceImport(direct, namedBindings.name);
                                }
                                else if (ts.isDefaultImport(direct)) {
                                    const sourceFileLike = getSourceFileLikeForImportDeclaration(direct);
                                    if (!isAvailableThroughGlobal) {
                                        addIndirectUser(sourceFileLike); // Add a check for indirect uses to handle synthetic default imports
                                    }
                                    directImports.push(direct);
                                }
                                else {
                                    directImports.push(direct);
                                }
                                break;
                            case ts.SyntaxKind.ExportDeclaration:
                                if (!direct.exportClause) {
                                    // This is `export * from "foo"`, so imports of this module may import the export too.
                                    handleDirectImports(getContainingModuleSymbol(direct, checker));
                                }
                                else {
                                    // This is `export { foo } from "foo"` and creates an alias symbol, so recursive search will get handle re-exports.
                                    directImports.push(direct);
                                }
                                break;
                        }
                    }
                }
            }
            function handleNamespaceImport(importDeclaration, name, isReExport) {
                if (exportKind === 2 /* ExportEquals */) {
                    // This is a direct import, not import-as-namespace.
                    directImports.push(importDeclaration);
                }
                else if (!isAvailableThroughGlobal) {
                    const sourceFileLike = getSourceFileLikeForImportDeclaration(importDeclaration);
                    ts.Debug.assert(sourceFileLike.kind === ts.SyntaxKind.SourceFile || sourceFileLike.kind === ts.SyntaxKind.ModuleDeclaration);
                    if (isReExport || findNamespaceReExports(sourceFileLike, name, checker)) {
                        addIndirectUsers(sourceFileLike);
                    }
                    else {
                        addIndirectUser(sourceFileLike);
                    }
                }
            }
            function addIndirectUser(sourceFileLike) {
                ts.Debug.assert(!isAvailableThroughGlobal);
                const isNew = markSeenIndirectUser(sourceFileLike);
                if (isNew) {
                    indirectUserDeclarations.push(sourceFileLike);
                }
                return isNew;
            }
            /** Adds a module and all of its transitive dependencies as possible indirect users. */
            function addIndirectUsers(sourceFileLike) {
                if (!addIndirectUser(sourceFileLike)) {
                    return;
                }
                const moduleSymbol = checker.getMergedSymbol(sourceFileLike.symbol);
                ts.Debug.assert(!!(moduleSymbol.flags & ts.SymbolFlags.Module));
                const directImports = getDirectImports(moduleSymbol);
                if (directImports) {
                    for (const directImport of directImports) {
                        addIndirectUsers(getSourceFileLikeForImportDeclaration(directImport));
                    }
                }
            }
            function getDirectImports(moduleSymbol) {
                return allDirectImports.get(ts.getSymbolId(moduleSymbol).toString());
            }
        }
        /**
         * Given the set of direct imports of a module, we need to find which ones import the particular exported symbol.
         * The returned `importSearches` will result in the entire source file being searched.
         * But re-exports will be placed in 'singleReferences' since they cannot be locally referenced.
         */
        function getSearchesFromDirectImports(directImports, exportSymbol, exportKind, checker, isForRename) {
            const importSearches = [];
            const singleReferences = [];
            function addSearch(location, symbol) {
                importSearches.push([location, symbol]);
            }
            if (directImports) {
                for (const decl of directImports) {
                    handleImport(decl);
                }
            }
            return { importSearches, singleReferences };
            function handleImport(decl) {
                if (decl.kind === ts.SyntaxKind.ImportEqualsDeclaration) {
                    if (isExternalModuleImportEquals(decl)) {
                        handleNamespaceImportLike(decl.name);
                    }
                    return;
                }
                if (decl.kind === ts.SyntaxKind.Identifier) {
                    handleNamespaceImportLike(decl);
                    return;
                }
                if (decl.kind === ts.SyntaxKind.ImportType) {
                    return;
                }
                // Ignore if there's a grammar error
                if (decl.moduleSpecifier.kind !== ts.SyntaxKind.StringLiteral) {
                    return;
                }
                if (decl.kind === ts.SyntaxKind.ExportDeclaration) {
                    searchForNamedImport(decl.exportClause);
                    return;
                }
                const { importClause } = decl;
                if (!importClause) {
                    return;
                }
                const { namedBindings } = importClause;
                if (namedBindings && namedBindings.kind === ts.SyntaxKind.NamespaceImport) {
                    handleNamespaceImportLike(namedBindings.name);
                    return;
                }
                if (exportKind === 0 /* Named */) {
                    searchForNamedImport(namedBindings);
                }
                else {
                    // `export =` might be imported by a default import if `--allowSyntheticDefaultImports` is on, so this handles both ExportKind.Default and ExportKind.ExportEquals
                    const { name } = importClause;
                    // If a default import has the same name as the default export, allow to rename it.
                    // Given `import f` and `export default function f`, we will rename both, but for `import g` we will rename just that.
                    if (name && (!isForRename || name.escapedText === symbolName(exportSymbol))) {
                        const defaultImportAlias = checker.getSymbolAtLocation(name);
                        addSearch(name, defaultImportAlias);
                    }
                    // 'default' might be accessed as a named import `{ default as foo }`.
                    if (exportKind === 1 /* Default */) {
                        searchForNamedImport(namedBindings);
                    }
                }
            }
            /**
             * `import x = require("./x") or `import * as x from "./x"`.
             * An `export =` may be imported by this syntax, so it may be a direct import.
             * If it's not a direct import, it will be in `indirectUsers`, so we don't have to do anything here.
             */
            function handleNamespaceImportLike(importName) {
                // Don't rename an import that already has a different name than the export.
                if (exportKind === 2 /* ExportEquals */ && (!isForRename || isNameMatch(importName.escapedText))) {
                    addSearch(importName, checker.getSymbolAtLocation(importName));
                }
            }
            function searchForNamedImport(namedBindings) {
                if (!namedBindings) {
                    return;
                }
                for (const element of namedBindings.elements) {
                    const { name, propertyName } = element;
                    if (!isNameMatch((propertyName || name).escapedText)) {
                        continue;
                    }
                    if (propertyName) {
                        // This is `import { foo as bar } from "./a"` or `export { foo as bar } from "./a"`. `foo` isn't a local in the file, so just add it as a single reference.
                        singleReferences.push(propertyName);
                        // If renaming `{ foo as bar }`, don't touch `bar`, just `foo`.
                        // But do rename `foo` in ` { default as foo }` if that's the original export name.
                        if (!isForRename || name.escapedText === exportSymbol.escapedName) {
                            // Search locally for `bar`.
                            addSearch(name, checker.getSymbolAtLocation(name));
                        }
                    }
                    else {
                        const localSymbol = element.kind === ts.SyntaxKind.ExportSpecifier && element.propertyName
                            ? checker.getExportSpecifierLocalTargetSymbol(element) // For re-exporting under a different name, we want to get the re-exported symbol.
                            : checker.getSymbolAtLocation(name);
                        addSearch(name, localSymbol);
                    }
                }
            }
            function isNameMatch(name) {
                // Use name of "default" even in `export =` case because we may have allowSyntheticDefaultImports
                return name === exportSymbol.escapedName || exportKind !== 0 /* Named */ && name === ts.InternalSymbolName.Default;
            }
        }
        /** Returns 'true' is the namespace 'name' is re-exported from this module, and 'false' if it is only used locally. */
        function findNamespaceReExports(sourceFileLike, name, checker) {
            const namespaceImportSymbol = checker.getSymbolAtLocation(name);
            return forEachPossibleImportOrExportStatement(sourceFileLike, statement => {
                if (statement.kind !== ts.SyntaxKind.ExportDeclaration)
                    return;
                const { exportClause, moduleSpecifier } = statement;
                if (moduleSpecifier || !exportClause)
                    return;
                for (const element of exportClause.elements) {
                    if (checker.getExportSpecifierLocalTargetSymbol(element) === namespaceImportSymbol) {
                        return true;
                    }
                }
            });
        }
        function findModuleReferences(program, sourceFiles, searchModuleSymbol) {
            const refs = [];
            const checker = program.getTypeChecker();
            for (const referencingFile of sourceFiles) {
                const searchSourceFile = searchModuleSymbol.valueDeclaration;
                if (searchSourceFile.kind === ts.SyntaxKind.SourceFile) {
                    for (const ref of referencingFile.referencedFiles) {
                        if (program.getSourceFileFromReference(referencingFile, ref) === searchSourceFile) {
                            refs.push({ kind: "reference", referencingFile, ref });
                        }
                    }
                    for (const ref of referencingFile.typeReferenceDirectives) {
                        const referenced = program.getResolvedTypeReferenceDirectives().get(ref.fileName);
                        if (referenced !== undefined && referenced.resolvedFileName === searchSourceFile.fileName) {
                            refs.push({ kind: "reference", referencingFile, ref });
                        }
                    }
                }
                forEachImport(referencingFile, (_importDecl, moduleSpecifier) => {
                    const moduleSymbol = checker.getSymbolAtLocation(moduleSpecifier);
                    if (moduleSymbol === searchModuleSymbol) {
                        refs.push({ kind: "import", literal: moduleSpecifier });
                    }
                });
            }
            return refs;
        }
        FindAllReferences.findModuleReferences = findModuleReferences;
        /** Returns a map from a module symbol Id to all import statements that directly reference the module. */
        function getDirectImportsMap(sourceFiles, checker, cancellationToken) {
            const map = ts.createMap();
            for (const sourceFile of sourceFiles) {
                cancellationToken.throwIfCancellationRequested();
                forEachImport(sourceFile, (importDecl, moduleSpecifier) => {
                    const moduleSymbol = checker.getSymbolAtLocation(moduleSpecifier);
                    if (moduleSymbol) {
                        const id = ts.getSymbolId(moduleSymbol).toString();
                        let imports = map.get(id);
                        if (!imports) {
                            map.set(id, imports = []);
                        }
                        imports.push(importDecl);
                    }
                });
            }
            return map;
        }
        /** Iterates over all statements at the top level or in module declarations. Returns the first truthy result. */
        function forEachPossibleImportOrExportStatement(sourceFileLike, action) {
            return ts.forEach(sourceFileLike.kind === ts.SyntaxKind.SourceFile ? sourceFileLike.statements : sourceFileLike.body.statements, statement => action(statement) || (isAmbientModuleDeclaration(statement) && ts.forEach(statement.body && statement.body.statements, action)));
        }
        /** Calls `action` for each import, re-export, or require() in a file. */
        function forEachImport(sourceFile, action) {
            if (sourceFile.externalModuleIndicator || sourceFile.imports !== undefined) {
                for (const i of sourceFile.imports) {
                    action(ts.importFromModuleSpecifier(i), i);
                }
            }
            else {
                forEachPossibleImportOrExportStatement(sourceFile, statement => {
                    switch (statement.kind) {
                        case ts.SyntaxKind.ExportDeclaration:
                        case ts.SyntaxKind.ImportDeclaration: {
                            const decl = statement;
                            if (decl.moduleSpecifier && ts.isStringLiteral(decl.moduleSpecifier)) {
                                action(decl, decl.moduleSpecifier);
                            }
                            break;
                        }
                        case ts.SyntaxKind.ImportEqualsDeclaration: {
                            const decl = statement;
                            if (isExternalModuleImportEquals(decl)) {
                                action(decl, decl.moduleReference.expression);
                            }
                            break;
                        }
                    }
                });
            }
        }
        /**
         * Given a local reference, we might notice that it's an import/export and recursively search for references of that.
         * If at an import, look locally for the symbol it imports.
         * If an an export, look for all imports of it.
         * This doesn't handle export specifiers; that is done in `getReferencesAtExportSpecifier`.
         * @param comingFromExport If we are doing a search for all exports, don't bother looking backwards for the imported symbol, since that's the reason we're here.
         */
        function getImportOrExportSymbol(node, symbol, checker, comingFromExport) {
            return comingFromExport ? getExport() : getExport() || getImport();
            function getExport() {
                const parent = node.parent;
                if (symbol.exportSymbol) {
                    if (parent.kind === ts.SyntaxKind.PropertyAccessExpression) {
                        // When accessing an export of a JS module, there's no alias. The symbol will still be flagged as an export even though we're at the use.
                        // So check that we are at the declaration.
                        return symbol.declarations.some(d => d === parent) && ts.isBinaryExpression(parent.parent)
                            ? getSpecialPropertyExport(parent.parent, /*useLhsSymbol*/ false)
                            : undefined;
                    }
                    else {
                        return exportInfo(symbol.exportSymbol, getExportKindForDeclaration(parent));
                    }
                }
                else {
                    const exportNode = getExportNode(parent, node);
                    if (exportNode && ts.hasModifier(exportNode, ts.ModifierFlags.Export)) {
                        if (ts.isImportEqualsDeclaration(exportNode) && exportNode.moduleReference === node) {
                            // We're at `Y` in `export import X = Y`. This is not the exported symbol, the left-hand-side is. So treat this as an import statement.
                            if (comingFromExport) {
                                return undefined;
                            }
                            const lhsSymbol = checker.getSymbolAtLocation(exportNode.name);
                            return { kind: 0 /* Import */, symbol: lhsSymbol, isNamedImport: false };
                        }
                        else {
                            return exportInfo(symbol, getExportKindForDeclaration(exportNode));
                        }
                    }
                    // If we are in `export = a;` or `export default a;`, `parent` is the export assignment.
                    else if (ts.isExportAssignment(parent)) {
                        return getExportAssignmentExport(parent);
                    }
                    // If we are in `export = class A {};` (or `export = class A {};`) at `A`, `parent.parent` is the export assignment.
                    else if (ts.isExportAssignment(parent.parent)) {
                        return getExportAssignmentExport(parent.parent);
                    }
                    // Similar for `module.exports =` and `exports.A =`.
                    else if (ts.isBinaryExpression(parent)) {
                        return getSpecialPropertyExport(parent, /*useLhsSymbol*/ true);
                    }
                    else if (ts.isBinaryExpression(parent.parent)) {
                        return getSpecialPropertyExport(parent.parent, /*useLhsSymbol*/ true);
                    }
                }
                function getExportAssignmentExport(ex) {
                    // Get the symbol for the `export =` node; its parent is the module it's the export of.
                    const exportingModuleSymbol = ts.Debug.assertDefined(ex.symbol.parent, "Expected export symbol to have a parent");
                    const exportKind = ex.isExportEquals ? 2 /* ExportEquals */ : 1 /* Default */;
                    return { kind: 1 /* Export */, symbol, exportInfo: { exportingModuleSymbol, exportKind } };
                }
                function getSpecialPropertyExport(node, useLhsSymbol) {
                    let kind;
                    switch (ts.getSpecialPropertyAssignmentKind(node)) {
                        case 1 /* ExportsProperty */:
                            kind = 0 /* Named */;
                            break;
                        case 2 /* ModuleExports */:
                            kind = 2 /* ExportEquals */;
                            break;
                        default:
                            return undefined;
                    }
                    const sym = useLhsSymbol ? checker.getSymbolAtLocation(ts.cast(node.left, ts.isPropertyAccessExpression).name) : symbol;
                    // Better detection for GH#20803
                    if (sym && !(checker.getMergedSymbol(sym.parent).flags & ts.SymbolFlags.Module)) {
                        ts.Debug.fail(`Special property assignment kind does not have a module as its parent. Assignment is ${ts.Debug.showSymbol(sym)}, parent is ${ts.Debug.showSymbol(sym.parent)}`);
                    }
                    return sym && exportInfo(sym, kind);
                }
            }
            function getImport() {
                const isImport = isNodeImport(node);
                if (!isImport)
                    return undefined;
                // A symbol being imported is always an alias. So get what that aliases to find the local symbol.
                let importedSymbol = checker.getImmediateAliasedSymbol(symbol);
                if (!importedSymbol)
                    return undefined;
                // Search on the local symbol in the exporting module, not the exported symbol.
                importedSymbol = skipExportSpecifierSymbol(importedSymbol, checker);
                // Similarly, skip past the symbol for 'export ='
                if (importedSymbol.escapedName === "export=") {
                    importedSymbol = getExportEqualsLocalSymbol(importedSymbol, checker);
                }
                // If the import has a different name than the export, do not continue searching.
                // If `importedName` is undefined, do continue searching as the export is anonymous.
                // (All imports returned from this function will be ignored anyway if we are in rename and this is a not a named export.)
                const importedName = symbolName(importedSymbol);
                if (importedName === undefined || importedName === ts.InternalSymbolName.Default || importedName === symbol.escapedName) {
                    return Object.assign({ kind: 0 /* Import */, symbol: importedSymbol }, isImport);
                }
            }
            function exportInfo(symbol, kind) {
                const exportInfo = getExportInfo(symbol, kind, checker);
                return exportInfo && { kind: 1 /* Export */, symbol, exportInfo };
            }
            // Not meant for use with export specifiers or export assignment.
            function getExportKindForDeclaration(node) {
                return ts.hasModifier(node, ts.ModifierFlags.Default) ? 1 /* Default */ : 0 /* Named */;
            }
        }
        FindAllReferences.getImportOrExportSymbol = getImportOrExportSymbol;
        function getExportEqualsLocalSymbol(importedSymbol, checker) {
            if (importedSymbol.flags & ts.SymbolFlags.Alias) {
                return ts.Debug.assertDefined(checker.getImmediateAliasedSymbol(importedSymbol));
            }
            const decl = importedSymbol.valueDeclaration;
            if (ts.isExportAssignment(decl)) { // `export = class {}`
                return ts.Debug.assertDefined(decl.expression.symbol);
            }
            else if (ts.isBinaryExpression(decl)) { // `module.exports = class {}`
                return ts.Debug.assertDefined(decl.right.symbol);
            }
            return ts.Debug.fail();
        }
        // If a reference is a class expression, the exported node would be its parent.
        // If a reference is a variable declaration, the exported node would be the variable statement.
        function getExportNode(parent, node) {
            if (parent.kind === ts.SyntaxKind.VariableDeclaration) {
                const p = parent;
                return p.name !== node ? undefined :
                    p.parent.kind === ts.SyntaxKind.CatchClause ? undefined : p.parent.parent.kind === ts.SyntaxKind.VariableStatement ? p.parent.parent : undefined;
            }
            else {
                return parent;
            }
        }
        function isNodeImport(node) {
            const { parent } = node;
            switch (parent.kind) {
                case ts.SyntaxKind.ImportEqualsDeclaration:
                    return parent.name === node && isExternalModuleImportEquals(parent)
                        ? { isNamedImport: false }
                        : undefined;
                case ts.SyntaxKind.ImportSpecifier:
                    // For a rename import `{ foo as bar }`, don't search for the imported symbol. Just find local uses of `bar`.
                    return parent.propertyName ? undefined : { isNamedImport: true };
                case ts.SyntaxKind.ImportClause:
                case ts.SyntaxKind.NamespaceImport:
                    ts.Debug.assert(parent.name === node);
                    return { isNamedImport: false };
                default:
                    return undefined;
            }
        }
        function getExportInfo(exportSymbol, exportKind, checker) {
            const moduleSymbol = exportSymbol.parent;
            if (!moduleSymbol)
                return undefined; // This can happen if an `export` is not at the top-level (which is a compile error).
            const exportingModuleSymbol = checker.getMergedSymbol(moduleSymbol); // Need to get merged symbol in case there's an augmentation.
            // `export` may appear in a namespace. In that case, just rely on global search.
            return ts.isExternalModuleSymbol(exportingModuleSymbol) ? { exportingModuleSymbol, exportKind } : undefined;
        }
        FindAllReferences.getExportInfo = getExportInfo;
        function symbolName(symbol) {
            if (symbol.escapedName !== ts.InternalSymbolName.Default) {
                return symbol.escapedName;
            }
            return ts.forEach(symbol.declarations, decl => {
                const name = ts.getNameOfDeclaration(decl);
                return name && name.kind === ts.SyntaxKind.Identifier && name.escapedText;
            });
        }
        /** If at an export specifier, go to the symbol it refers to. */
        function skipExportSpecifierSymbol(symbol, checker) {
            // For `export { foo } from './bar", there's nothing to skip, because it does not create a new alias. But `export { foo } does.
            if (symbol.declarations) {
                for (const declaration of symbol.declarations) {
                    if (ts.isExportSpecifier(declaration) && !declaration.propertyName && !declaration.parent.parent.moduleSpecifier) {
                        return checker.getExportSpecifierLocalTargetSymbol(declaration);
                    }
                }
            }
            return symbol;
        }
        function getContainingModuleSymbol(importer, checker) {
            return checker.getMergedSymbol(getSourceFileLikeForImportDeclaration(importer).symbol);
        }
        function getSourceFileLikeForImportDeclaration(node) {
            if (node.kind === ts.SyntaxKind.CallExpression) {
                return node.getSourceFile();
            }
            const { parent } = node;
            if (parent.kind === ts.SyntaxKind.SourceFile) {
                return parent;
            }
            ts.Debug.assert(parent.kind === ts.SyntaxKind.ModuleBlock);
            return ts.cast(parent.parent, isAmbientModuleDeclaration);
        }
        function isAmbientModuleDeclaration(node) {
            return node.kind === ts.SyntaxKind.ModuleDeclaration && node.name.kind === ts.SyntaxKind.StringLiteral;
        }
        function isExternalModuleImportEquals(eq) {
            return eq.moduleReference.kind === ts.SyntaxKind.ExternalModuleReference && eq.moduleReference.expression.kind === ts.SyntaxKind.StringLiteral;
        }
    })(FindAllReferences = ts.FindAllReferences || (ts.FindAllReferences = {}));
})(ts || (ts = {}));
