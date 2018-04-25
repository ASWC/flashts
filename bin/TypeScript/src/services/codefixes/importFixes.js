/* @internal */
var ts;
(function (ts) {
    var codefix;
    (function (codefix) {
        var ChangeTracker = ts.textChanges.ChangeTracker;
        codefix.registerCodeFix({
            errorCodes: [
                Diagnostics.Cannot_find_name_0.code,
                Diagnostics.Cannot_find_name_0_Did_you_mean_1.code,
                Diagnostics.Cannot_find_namespace_0.code,
                Diagnostics._0_refers_to_a_UMD_global_but_the_current_file_is_a_module_Consider_adding_an_import_instead.code
            ],
            getCodeActions: getImportCodeActions,
            // TODO: GH#20315
            fixIds: [],
            getAllCodeActions: ts.notImplemented,
        });
        function createCodeAction(descriptionDiagnostic, diagnosticArgs, changes) {
            // TODO: GH#20315
            return codefix.createCodeFixActionNoFixId("import", changes, [descriptionDiagnostic, ...diagnosticArgs]);
        }
        function convertToImportCodeFixContext(context, symbolToken, symbolName) {
            const { program } = context;
            const checker = program.getTypeChecker();
            return {
                host: context.host,
                formatContext: context.formatContext,
                sourceFile: context.sourceFile,
                program,
                checker,
                compilerOptions: program.getCompilerOptions(),
                cachedImportDeclarations: [],
                getCanonicalFileName: ts.createGetCanonicalFileName(ts.hostUsesCaseSensitiveFileNames(context.host)),
                symbolName,
                symbolToken,
                preferences: context.preferences,
            };
        }
        function getImportCompletionAction(exportedSymbol, moduleSymbol, sourceFile, symbolName, host, program, checker, compilerOptions, allSourceFiles, formatContext, getCanonicalFileName, symbolToken, preferences) {
            const exportInfos = getAllReExportingModules(exportedSymbol, symbolName, checker, allSourceFiles);
            ts.Debug.assert(exportInfos.some(info => info.moduleSymbol === moduleSymbol));
            // We sort the best codefixes first, so taking `first` is best for completions.
            const moduleSpecifier = ts.first(getNewImportInfos(program, sourceFile, exportInfos, compilerOptions, getCanonicalFileName, host, preferences)).moduleSpecifier;
            const ctx = { host, program, checker, compilerOptions, sourceFile, formatContext, symbolName, getCanonicalFileName, symbolToken, preferences };
            return { moduleSpecifier, codeAction: ts.first(getCodeActionsForImport(exportInfos, ctx)) };
        }
        codefix.getImportCompletionAction = getImportCompletionAction;
        function getAllReExportingModules(exportedSymbol, symbolName, checker, allSourceFiles) {
            const result = [];
            forEachExternalModule(checker, allSourceFiles, moduleSymbol => {
                for (const exported of checker.getExportsOfModule(moduleSymbol)) {
                    if (exported.escapedName === ts.InternalSymbolName.Default || exported.name === symbolName && ts.skipAlias(exported, checker) === exportedSymbol) {
                        const isDefaultExport = checker.tryGetMemberInModuleExports(ts.InternalSymbolName.Default, moduleSymbol) === exported;
                        result.push({ moduleSymbol, importKind: isDefaultExport ? 1 /* Default */ : 0 /* Named */ });
                    }
                }
            });
            return result;
        }
        function getCodeActionsForImport(exportInfos, context) {
            const existingImports = ts.flatMap(exportInfos, info => getImportDeclarations(info, context.checker, context.sourceFile, context.cachedImportDeclarations));
            // It is possible that multiple import statements with the same specifier exist in the file.
            // e.g.
            //
            //     import * as ns from "foo";
            //     import { member1, member2 } from "foo";
            //
            //     member3/**/ <-- cusor here
            //
            // in this case we should provie 2 actions:
            //     1. change "member3" to "ns.member3"
            //     2. add "member3" to the second import statement's import list
            // and it is up to the user to decide which one fits best.
            const useExistingImportActions = !context.symbolToken || !ts.isIdentifier(context.symbolToken) ? ts.emptyArray : ts.mapDefined(existingImports, ({ declaration }) => {
                const namespace = getNamespaceImportName(declaration);
                if (namespace) {
                    const moduleSymbol = context.checker.getAliasedSymbol(context.checker.getSymbolAtLocation(namespace));
                    if (moduleSymbol && moduleSymbol.exports.has(ts.escapeLeadingUnderscores(context.symbolName))) {
                        return getCodeActionForUseExistingNamespaceImport(namespace.text, context, context.symbolToken);
                    }
                }
            });
            return [...useExistingImportActions, ...getCodeActionsForAddImport(exportInfos, context, existingImports)];
        }
        function getNamespaceImportName(declaration) {
            if (declaration.kind === ts.SyntaxKind.ImportDeclaration) {
                const namedBindings = declaration.importClause && ts.isImportClause(declaration.importClause) && declaration.importClause.namedBindings;
                return namedBindings && namedBindings.kind === ts.SyntaxKind.NamespaceImport ? namedBindings.name : undefined;
            }
            else {
                return declaration.name;
            }
        }
        // TODO(anhans): This doesn't seem important to cache... just use an iterator instead of creating a new array?
        function getImportDeclarations({ moduleSymbol, importKind }, checker, { imports }, cachedImportDeclarations = []) {
            const moduleSymbolId = ts.getUniqueSymbolId(moduleSymbol, checker);
            let cached = cachedImportDeclarations[moduleSymbolId];
            if (!cached) {
                cached = cachedImportDeclarations[moduleSymbolId] = ts.mapDefined(imports, moduleSpecifier => {
                    const i = ts.importFromModuleSpecifier(moduleSpecifier);
                    return (i.kind === ts.SyntaxKind.ImportDeclaration || i.kind === ts.SyntaxKind.ImportEqualsDeclaration)
                        && checker.getSymbolAtLocation(moduleSpecifier) === moduleSymbol ? { declaration: i, importKind } : undefined;
                });
            }
            return cached;
        }
        function getCodeActionForNewImport(context, { moduleSpecifier, importKind }) {
            const { sourceFile, symbolName, preferences } = context;
            const lastImportDeclaration = ts.findLast(sourceFile.statements, ts.isAnyImportSyntax);
            const moduleSpecifierWithoutQuotes = ts.stripQuotes(moduleSpecifier);
            const quotedModuleSpecifier = ts.createLiteral(moduleSpecifierWithoutQuotes, shouldUseSingleQuote(sourceFile, preferences));
            const importDecl = importKind !== 3 /* Equals */
                ? ts.createImportDeclaration(
                /*decorators*/ undefined, 
                /*modifiers*/ undefined, createImportClauseOfKind(importKind, symbolName), quotedModuleSpecifier)
                : ts.createImportEqualsDeclaration(
                /*decorators*/ undefined, 
                /*modifiers*/ undefined, ts.createIdentifier(symbolName), ts.createExternalModuleReference(quotedModuleSpecifier));
            const changes = ChangeTracker.with(context, changeTracker => {
                if (lastImportDeclaration) {
                    changeTracker.insertNodeAfter(sourceFile, lastImportDeclaration, importDecl);
                }
                else {
                    changeTracker.insertNodeAtTopOfFile(sourceFile, importDecl, /*blankLineBetween*/ true);
                }
            });
            // if this file doesn't have any import statements, insert an import statement and then insert a new line
            // between the only import statement and user code. Otherwise just insert the statement because chances
            // are there are already a new line seperating code and import statements.
            return createCodeAction(Diagnostics.Import_0_from_module_1, [symbolName, moduleSpecifierWithoutQuotes], changes);
        }
        function shouldUseSingleQuote(sourceFile, preferences) {
            if (preferences.quotePreference) {
                return preferences.quotePreference === "single";
            }
            else {
                const firstModuleSpecifier = ts.firstOrUndefined(sourceFile.imports);
                return !!firstModuleSpecifier && !ts.isStringDoubleQuoted(firstModuleSpecifier, sourceFile);
            }
        }
        function usesJsExtensionOnImports(sourceFile) {
            return ts.firstDefined(sourceFile.imports, ({ text }) => ts.pathIsRelative(text) ? ts.fileExtensionIs(text, ts.Extension.Js) : undefined) || false;
        }
        function createImportClauseOfKind(kind, symbolName) {
            const id = ts.createIdentifier(symbolName);
            switch (kind) {
                case 1 /* Default */:
                    return ts.createImportClause(id, /*namedBindings*/ undefined);
                case 2 /* Namespace */:
                    return ts.createImportClause(/*name*/ undefined, ts.createNamespaceImport(id));
                case 0 /* Named */:
                    return ts.createImportClause(/*name*/ undefined, ts.createNamedImports([ts.createImportSpecifier(/*propertyName*/ undefined, id)]));
                default:
                    ts.Debug.assertNever(kind);
            }
        }
        function getNewImportInfos(program, sourceFile, moduleSymbols, compilerOptions, getCanonicalFileName, host, preferences) {
            const { baseUrl, paths, rootDirs } = compilerOptions;
            const moduleResolutionKind = ts.getEmitModuleResolutionKind(compilerOptions);
            const addJsExtension = usesJsExtensionOnImports(sourceFile);
            const choicesForEachExportingModule = ts.flatMap(moduleSymbols, ({ moduleSymbol, importKind }) => {
                const modulePathsGroups = getAllModulePaths(program, moduleSymbol.valueDeclaration.getSourceFile()).map(moduleFileName => {
                    const sourceDirectory = ts.getDirectoryPath(sourceFile.fileName);
                    const global = tryGetModuleNameFromAmbientModule(moduleSymbol)
                        || tryGetModuleNameFromTypeRoots(compilerOptions, host, getCanonicalFileName, moduleFileName, addJsExtension)
                        || tryGetModuleNameAsNodeModule(compilerOptions, moduleFileName, host, getCanonicalFileName, sourceDirectory)
                        || rootDirs && tryGetModuleNameFromRootDirs(rootDirs, moduleFileName, sourceDirectory, getCanonicalFileName);
                    if (global) {
                        return [global];
                    }
                    const relativePath = removeExtensionAndIndexPostFix(ts.getRelativePath(moduleFileName, sourceDirectory, getCanonicalFileName), moduleResolutionKind, addJsExtension);
                    if (!baseUrl || preferences.importModuleSpecifierPreference === "relative") {
                        return [relativePath];
                    }
                    const relativeToBaseUrl = getRelativePathIfInDirectory(moduleFileName, baseUrl, getCanonicalFileName);
                    if (!relativeToBaseUrl) {
                        return [relativePath];
                    }
                    const importRelativeToBaseUrl = removeExtensionAndIndexPostFix(relativeToBaseUrl, moduleResolutionKind, addJsExtension);
                    if (paths) {
                        const fromPaths = tryGetModuleNameFromPaths(ts.removeFileExtension(relativeToBaseUrl), importRelativeToBaseUrl, paths);
                        if (fromPaths) {
                            return [fromPaths];
                        }
                    }
                    if (preferences.importModuleSpecifierPreference === "non-relative") {
                        return [importRelativeToBaseUrl];
                    }
                    if (preferences.importModuleSpecifierPreference !== undefined)
                        ts.Debug.assertNever(preferences.importModuleSpecifierPreference);
                    if (isPathRelativeToParent(relativeToBaseUrl)) {
                        return [relativePath];
                    }
                    /*
                    Prefer a relative import over a baseUrl import if it doesn't traverse up to baseUrl.
    
                    Suppose we have:
                        baseUrl = /base
                        sourceDirectory = /base/a/b
                        moduleFileName = /base/foo/bar
                    Then:
                        relativePath = ../../foo/bar
                        getRelativePathNParents(relativePath) = 2
                        pathFromSourceToBaseUrl = ../../
                        getRelativePathNParents(pathFromSourceToBaseUrl) = 2
                        2 < 2 = false
                    In this case we should prefer using the baseUrl path "/a/b" instead of the relative path "../../foo/bar".
    
                    Suppose we have:
                        baseUrl = /base
                        sourceDirectory = /base/foo/a
                        moduleFileName = /base/foo/bar
                    Then:
                        relativePath = ../a
                        getRelativePathNParents(relativePath) = 1
                        pathFromSourceToBaseUrl = ../../
                        getRelativePathNParents(pathFromSourceToBaseUrl) = 2
                        1 < 2 = true
                    In this case we should prefer using the relative path "../a" instead of the baseUrl path "foo/a".
                    */
                    const pathFromSourceToBaseUrl = ts.getRelativePath(baseUrl, sourceDirectory, getCanonicalFileName);
                    const relativeFirst = getRelativePathNParents(relativePath) < getRelativePathNParents(pathFromSourceToBaseUrl);
                    return relativeFirst ? [relativePath, importRelativeToBaseUrl] : [importRelativeToBaseUrl, relativePath];
                });
                return modulePathsGroups.map(group => group.map(moduleSpecifier => ({ moduleSpecifier, importKind })));
            });
            // Sort to keep the shortest paths first, but keep [relativePath, importRelativeToBaseUrl] groups together
            return ts.flatten(choicesForEachExportingModule.sort((a, b) => ts.first(a).moduleSpecifier.length - ts.first(b).moduleSpecifier.length));
        }
        /**
         * Looks for a existing imports that use symlinks to this module.
         * Only if no symlink is available, the real path will be used.
         */
        function getAllModulePaths(program, { fileName }) {
            const symlinks = ts.mapDefined(program.getSourceFiles(), sf => sf.resolvedModules && ts.firstDefinedIterator(sf.resolvedModules.values(), res => res && res.resolvedFileName === fileName ? res.originalPath : undefined));
            return symlinks.length === 0 ? [fileName] : symlinks;
        }
        function getRelativePathNParents(relativePath) {
            let count = 0;
            for (let i = 0; i + 3 <= relativePath.length && relativePath.slice(i, i + 3) === "../"; i += 3) {
                count++;
            }
            return count;
        }
        function tryGetModuleNameFromAmbientModule(moduleSymbol) {
            const decl = moduleSymbol.valueDeclaration;
            if (ts.isModuleDeclaration(decl) && ts.isStringLiteral(decl.name)) {
                return decl.name.text;
            }
        }
        function tryGetModuleNameFromPaths(relativeToBaseUrlWithIndex, relativeToBaseUrl, paths) {
            for (const key in paths) {
                for (const patternText of paths[key]) {
                    const pattern = ts.removeFileExtension(ts.normalizePath(patternText));
                    const indexOfStar = pattern.indexOf("*");
                    if (indexOfStar === 0 && pattern.length === 1) {
                        continue;
                    }
                    else if (indexOfStar !== -1) {
                        const prefix = pattern.substr(0, indexOfStar);
                        const suffix = pattern.substr(indexOfStar + 1);
                        if (relativeToBaseUrl.length >= prefix.length + suffix.length &&
                            ts.startsWith(relativeToBaseUrl, prefix) &&
                            ts.endsWith(relativeToBaseUrl, suffix)) {
                            const matchedStar = relativeToBaseUrl.substr(prefix.length, relativeToBaseUrl.length - suffix.length);
                            return key.replace("*", matchedStar);
                        }
                    }
                    else if (pattern === relativeToBaseUrl || pattern === relativeToBaseUrlWithIndex) {
                        return key;
                    }
                }
            }
        }
        function tryGetModuleNameFromRootDirs(rootDirs, moduleFileName, sourceDirectory, getCanonicalFileName) {
            const normalizedTargetPath = getPathRelativeToRootDirs(moduleFileName, rootDirs, getCanonicalFileName);
            if (normalizedTargetPath === undefined) {
                return undefined;
            }
            const normalizedSourcePath = getPathRelativeToRootDirs(sourceDirectory, rootDirs, getCanonicalFileName);
            const relativePath = normalizedSourcePath !== undefined ? ts.getRelativePath(normalizedTargetPath, normalizedSourcePath, getCanonicalFileName) : normalizedTargetPath;
            return ts.removeFileExtension(relativePath);
        }
        function tryGetModuleNameFromTypeRoots(options, host, getCanonicalFileName, moduleFileName, addJsExtension) {
            const roots = ts.getEffectiveTypeRoots(options, host);
            return ts.firstDefined(roots, unNormalizedTypeRoot => {
                const typeRoot = ts.toPath(unNormalizedTypeRoot, /*basePath*/ undefined, getCanonicalFileName);
                if (ts.startsWith(moduleFileName, typeRoot)) {
                    // For a type definition, we can strip `/index` even with classic resolution.
                    return removeExtensionAndIndexPostFix(moduleFileName.substring(typeRoot.length + 1), ts.ModuleResolutionKind.NodeJs, addJsExtension);
                }
            });
        }
        function tryGetModuleNameAsNodeModule(options, moduleFileName, host, getCanonicalFileName, sourceDirectory) {
            if (ts.getEmitModuleResolutionKind(options) !== ts.ModuleResolutionKind.NodeJs) {
                // nothing to do here
                return undefined;
            }
            const parts = getNodeModulePathParts(moduleFileName);
            if (!parts) {
                return undefined;
            }
            // Simplify the full file path to something that can be resolved by Node.
            // If the module could be imported by a directory name, use that directory's name
            let moduleSpecifier = getDirectoryOrExtensionlessFileName(moduleFileName);
            // Get a path that's relative to node_modules or the importing file's path
            moduleSpecifier = getNodeResolvablePath(moduleSpecifier);
            // If the module was found in @types, get the actual Node package name
            return ts.getPackageNameFromAtTypesDirectory(moduleSpecifier);
            function getDirectoryOrExtensionlessFileName(path) {
                // If the file is the main module, it can be imported by the package name
                const packageRootPath = path.substring(0, parts.packageRootIndex);
                const packageJsonPath = ts.combinePaths(packageRootPath, "package.json");
                if (host.fileExists(packageJsonPath)) {
                    const packageJsonContent = JSON.parse(host.readFile(packageJsonPath));
                    if (packageJsonContent) {
                        const mainFileRelative = packageJsonContent.typings || packageJsonContent.types || packageJsonContent.main;
                        if (mainFileRelative) {
                            const mainExportFile = ts.toPath(mainFileRelative, packageRootPath, getCanonicalFileName);
                            if (mainExportFile === getCanonicalFileName(path)) {
                                return packageRootPath;
                            }
                        }
                    }
                }
                // We still have a file name - remove the extension
                const fullModulePathWithoutExtension = ts.removeFileExtension(path);
                // If the file is /index, it can be imported by its directory name
                if (getCanonicalFileName(fullModulePathWithoutExtension.substring(parts.fileNameIndex)) === "/index") {
                    return fullModulePathWithoutExtension.substring(0, parts.fileNameIndex);
                }
                return fullModulePathWithoutExtension;
            }
            function getNodeResolvablePath(path) {
                const basePath = path.substring(0, parts.topLevelNodeModulesIndex);
                if (sourceDirectory.indexOf(basePath) === 0) {
                    // if node_modules folder is in this folder or any of its parent folders, no need to keep it.
                    return path.substring(parts.topLevelPackageNameIndex + 1);
                }
                else {
                    return ts.getRelativePath(path, sourceDirectory, getCanonicalFileName);
                }
            }
        }
        function getNodeModulePathParts(fullPath) {
            // If fullPath can't be valid module file within node_modules, returns undefined.
            // Example of expected pattern: /base/path/node_modules/[@scope/otherpackage/@otherscope/node_modules/]package/[subdirectory/]file.js
            // Returns indices:                       ^            ^                                                      ^             ^
            let topLevelNodeModulesIndex = 0;
            let topLevelPackageNameIndex = 0;
            let packageRootIndex = 0;
            let fileNameIndex = 0;
            let partStart = 0;
            let partEnd = 0;
            let state = 0 /* BeforeNodeModules */;
            while (partEnd >= 0) {
                partStart = partEnd;
                partEnd = fullPath.indexOf("/", partStart + 1);
                switch (state) {
                    case 0 /* BeforeNodeModules */:
                        if (fullPath.indexOf("/node_modules/", partStart) === partStart) {
                            topLevelNodeModulesIndex = partStart;
                            topLevelPackageNameIndex = partEnd;
                            state = 1 /* NodeModules */;
                        }
                        break;
                    case 1 /* NodeModules */:
                    case 2 /* Scope */:
                        if (state === 1 /* NodeModules */ && fullPath.charAt(partStart + 1) === "@") {
                            state = 2 /* Scope */;
                        }
                        else {
                            packageRootIndex = partEnd;
                            state = 3 /* PackageContent */;
                        }
                        break;
                    case 3 /* PackageContent */:
                        if (fullPath.indexOf("/node_modules/", partStart) === partStart) {
                            state = 1 /* NodeModules */;
                        }
                        else {
                            state = 3 /* PackageContent */;
                        }
                        break;
                }
            }
            fileNameIndex = partStart;
            return state > 1 /* NodeModules */ ? { topLevelNodeModulesIndex, topLevelPackageNameIndex, packageRootIndex, fileNameIndex } : undefined;
        }
        function getPathRelativeToRootDirs(path, rootDirs, getCanonicalFileName) {
            return ts.firstDefined(rootDirs, rootDir => {
                const relativePath = getRelativePathIfInDirectory(path, rootDir, getCanonicalFileName);
                return isPathRelativeToParent(relativePath) ? undefined : relativePath;
            });
        }
        function removeExtensionAndIndexPostFix(fileName, moduleResolutionKind, addJsExtension) {
            const noExtension = ts.removeFileExtension(fileName);
            return addJsExtension
                ? noExtension + ".js"
                : moduleResolutionKind === ts.ModuleResolutionKind.NodeJs
                    ? ts.removeSuffix(noExtension, "/index")
                    : noExtension;
        }
        function getRelativePathIfInDirectory(path, directoryPath, getCanonicalFileName) {
            const relativePath = ts.getRelativePathToDirectoryOrUrl(directoryPath, path, directoryPath, getCanonicalFileName, /*isAbsolutePathAnUrl*/ false);
            return ts.isRootedDiskPath(relativePath) ? undefined : relativePath;
        }
        function isPathRelativeToParent(path) {
            return ts.startsWith(path, "..");
        }
        function getCodeActionsForAddImport(exportInfos, ctx, existingImports) {
            const fromExistingImport = ts.firstDefined(existingImports, ({ declaration, importKind }) => {
                if (declaration.kind === ts.SyntaxKind.ImportDeclaration && declaration.importClause) {
                    const changes = tryUpdateExistingImport(ctx, ts.isImportClause(declaration.importClause) && declaration.importClause || undefined, importKind);
                    if (changes) {
                        const moduleSpecifierWithoutQuotes = ts.stripQuotes(declaration.moduleSpecifier.getText());
                        return createCodeAction(Diagnostics.Add_0_to_existing_import_declaration_from_1, [ctx.symbolName, moduleSpecifierWithoutQuotes], changes);
                    }
                }
            });
            if (fromExistingImport) {
                return [fromExistingImport];
            }
            const existingDeclaration = ts.firstDefined(existingImports, newImportInfoFromExistingSpecifier);
            const newImportInfos = existingDeclaration
                ? [existingDeclaration]
                : getNewImportInfos(ctx.program, ctx.sourceFile, exportInfos, ctx.compilerOptions, ctx.getCanonicalFileName, ctx.host, ctx.preferences);
            return newImportInfos.map(info => getCodeActionForNewImport(ctx, info));
        }
        function newImportInfoFromExistingSpecifier({ declaration, importKind }) {
            const expression = declaration.kind === ts.SyntaxKind.ImportDeclaration
                ? declaration.moduleSpecifier
                : declaration.moduleReference.kind === ts.SyntaxKind.ExternalModuleReference
                    ? declaration.moduleReference.expression
                    : undefined;
            return expression && ts.isStringLiteral(expression) ? { moduleSpecifier: expression.text, importKind } : undefined;
        }
        function tryUpdateExistingImport(context, importClause, importKind) {
            const { symbolName, sourceFile } = context;
            const { name } = importClause;
            const { namedBindings } = importClause.kind !== ts.SyntaxKind.ImportEqualsDeclaration && importClause;
            switch (importKind) {
                case 1 /* Default */:
                    return name ? undefined : ChangeTracker.with(context, t => t.replaceNode(sourceFile, importClause, ts.createImportClause(ts.createIdentifier(symbolName), namedBindings)));
                case 0 /* Named */: {
                    const newImportSpecifier = ts.createImportSpecifier(/*propertyName*/ undefined, ts.createIdentifier(symbolName));
                    if (namedBindings && namedBindings.kind === ts.SyntaxKind.NamedImports && namedBindings.elements.length !== 0) {
                        // There are already named imports; add another.
                        return ChangeTracker.with(context, t => t.insertNodeInListAfter(sourceFile, namedBindings.elements[namedBindings.elements.length - 1], newImportSpecifier));
                    }
                    if (!namedBindings || namedBindings.kind === ts.SyntaxKind.NamedImports && namedBindings.elements.length === 0) {
                        return ChangeTracker.with(context, t => t.replaceNode(sourceFile, importClause, ts.createImportClause(name, ts.createNamedImports([newImportSpecifier]))));
                    }
                    return undefined;
                }
                case 2 /* Namespace */:
                    return namedBindings ? undefined : ChangeTracker.with(context, t => t.replaceNode(sourceFile, importClause, ts.createImportClause(name, ts.createNamespaceImport(ts.createIdentifier(symbolName)))));
                case 3 /* Equals */:
                    return undefined;
                default:
                    ts.Debug.assertNever(importKind);
            }
        }
        function getCodeActionForUseExistingNamespaceImport(namespacePrefix, context, symbolToken) {
            const { symbolName, sourceFile } = context;
            /**
             * Cases:
             *     import * as ns from "mod"
             *     import default, * as ns from "mod"
             *     import ns = require("mod")
             *
             * Because there is no import list, we alter the reference to include the
             * namespace instead of altering the import declaration. For example, "foo" would
             * become "ns.foo"
             */
            const changes = ChangeTracker.with(context, tracker => tracker.replaceNode(sourceFile, symbolToken, ts.createPropertyAccess(ts.createIdentifier(namespacePrefix), symbolToken)));
            return createCodeAction(Diagnostics.Change_0_to_1, [symbolName, `${namespacePrefix}.${symbolName}`], changes);
        }
        function getImportCodeActions(context) {
            return context.errorCode === Diagnostics._0_refers_to_a_UMD_global_but_the_current_file_is_a_module_Consider_adding_an_import_instead.code
                ? getActionsForUMDImport(context)
                : getActionsForNonUMDImport(context);
        }
        function getActionsForUMDImport(context) {
            const token = ts.getTokenAtPosition(context.sourceFile, context.span.start, /*includeJsDocComment*/ false);
            const checker = context.program.getTypeChecker();
            let umdSymbol;
            if (ts.isIdentifier(token)) {
                // try the identifier to see if it is the umd symbol
                umdSymbol = checker.getSymbolAtLocation(token);
            }
            if (!ts.isUMDExportSymbol(umdSymbol)) {
                // The error wasn't for the symbolAtLocation, it was for the JSX tag itself, which needs access to e.g. `React`.
                const parent = token.parent;
                const isNodeOpeningLikeElement = ts.isJsxOpeningLikeElement(parent);
                if ((ts.isJsxOpeningLikeElement && parent.tagName === token) || parent.kind === ts.SyntaxKind.JsxOpeningFragment) {
                    umdSymbol = checker.resolveName(checker.getJsxNamespace(parent), isNodeOpeningLikeElement ? parent.tagName : parent, ts.SymbolFlags.Value, /*excludeGlobals*/ false);
                }
            }
            if (ts.isUMDExportSymbol(umdSymbol)) {
                const symbol = checker.getAliasedSymbol(umdSymbol);
                if (symbol) {
                    return getCodeActionsForImport([{ moduleSymbol: symbol, importKind: getUmdImportKind(context.program.getCompilerOptions()) }], convertToImportCodeFixContext(context, token, umdSymbol.name));
                }
            }
            return undefined;
        }
        function getUmdImportKind(compilerOptions) {
            // Import a synthetic `default` if enabled.
            if (ts.getAllowSyntheticDefaultImports(compilerOptions)) {
                return 1 /* Default */;
            }
            // When a synthetic `default` is unavailable, use `import..require` if the module kind supports it.
            const moduleKind = ts.getEmitModuleKind(compilerOptions);
            switch (moduleKind) {
                case ts.ModuleKind.AMD:
                case ts.ModuleKind.CommonJS:
                case ts.ModuleKind.UMD:
                    return 3 /* Equals */;
                case ts.ModuleKind.System:
                case ts.ModuleKind.ES2015:
                case ts.ModuleKind.ESNext:
                case ts.ModuleKind.None:
                    // Fall back to the `import * as ns` style import.
                    return 2 /* Namespace */;
                default:
                    return ts.Debug.assertNever(moduleKind);
            }
        }
        function getActionsForNonUMDImport(context) {
            // This will always be an Identifier, since the diagnostics we fix only fail on identifiers.
            const { sourceFile, span, program, cancellationToken } = context;
            const checker = program.getTypeChecker();
            const symbolToken = ts.getTokenAtPosition(sourceFile, span.start, /*includeJsDocComment*/ false);
            // If we're at `<Foo/>`, we must check if `Foo` is already in scope, and if so, get an import for `React` instead.
            const symbolName = ts.isJsxOpeningLikeElement(symbolToken.parent)
                && symbolToken.parent.tagName === symbolToken
                && (!ts.isIdentifier(symbolToken) || ts.isIntrinsicJsxName(symbolToken.text) || checker.resolveName(symbolToken.text, symbolToken, ts.SymbolFlags.All, /*excludeGlobals*/ false))
                ? checker.getJsxNamespace()
                : ts.isIdentifier(symbolToken) ? symbolToken.text : undefined;
            if (!symbolName)
                return undefined;
            // "default" is a keyword and not a legal identifier for the import, so we don't expect it here
            ts.Debug.assert(symbolName !== "default");
            const currentTokenMeaning = ts.getMeaningFromLocation(symbolToken);
            // For each original symbol, keep all re-exports of that symbol together so we can call `getCodeActionsForImport` on the whole group at once.
            // Maps symbol id to info for modules providing that symbol (original export + re-exports).
            const originalSymbolToExportInfos = ts.createMultiMap();
            function addSymbol(moduleSymbol, exportedSymbol, importKind) {
                originalSymbolToExportInfos.add(ts.getUniqueSymbolId(exportedSymbol, checker).toString(), { moduleSymbol, importKind });
            }
            forEachExternalModuleToImportFrom(checker, sourceFile, program.getSourceFiles(), moduleSymbol => {
                cancellationToken.throwIfCancellationRequested();
                // check the default export
                const defaultExport = checker.tryGetMemberInModuleExports(ts.InternalSymbolName.Default, moduleSymbol);
                if (defaultExport) {
                    const localSymbol = ts.getLocalSymbolForExportDefault(defaultExport);
                    if ((localSymbol && localSymbol.escapedName === symbolName ||
                        getEscapedNameForExportDefault(defaultExport) === symbolName ||
                        moduleSymbolToValidIdentifier(moduleSymbol, program.getCompilerOptions().target) === symbolName) && checkSymbolHasMeaning(localSymbol || defaultExport, currentTokenMeaning)) {
                        addSymbol(moduleSymbol, localSymbol || defaultExport, 1 /* Default */);
                    }
                }
                // check exports with the same name
                const exportSymbolWithIdenticalName = checker.tryGetMemberInModuleExportsAndProperties(symbolName, moduleSymbol);
                if (exportSymbolWithIdenticalName && checkSymbolHasMeaning(exportSymbolWithIdenticalName, currentTokenMeaning)) {
                    addSymbol(moduleSymbol, exportSymbolWithIdenticalName, 0 /* Named */);
                }
                function getEscapedNameForExportDefault(symbol) {
                    return ts.firstDefined(symbol.declarations, declaration => {
                        if (ts.isExportAssignment(declaration)) {
                            if (ts.isIdentifier(declaration.expression)) {
                                return declaration.expression.escapedText;
                            }
                        }
                        else if (ts.isExportSpecifier(declaration)) {
                            ts.Debug.assert(declaration.name.escapedText === ts.InternalSymbolName.Default);
                            if (declaration.propertyName) {
                                return declaration.propertyName.escapedText;
                            }
                        }
                    });
                }
            });
            return ts.arrayFrom(ts.flatMapIterator(originalSymbolToExportInfos.values(), exportInfos => getCodeActionsForImport(exportInfos, convertToImportCodeFixContext(context, symbolToken, symbolName))));
        }
        function checkSymbolHasMeaning({ declarations }, meaning) {
            return ts.some(declarations, decl => !!(ts.getMeaningFromDeclaration(decl) & meaning));
        }
        function forEachExternalModuleToImportFrom(checker, from, allSourceFiles, cb) {
            forEachExternalModule(checker, allSourceFiles, (module, sourceFile) => {
                if (sourceFile === undefined || sourceFile !== from && isImportablePath(from.fileName, sourceFile.fileName)) {
                    cb(module);
                }
            });
        }
        codefix.forEachExternalModuleToImportFrom = forEachExternalModuleToImportFrom;
        function forEachExternalModule(checker, allSourceFiles, cb) {
            for (const ambient of checker.getAmbientModules()) {
                cb(ambient, /*sourceFile*/ undefined);
            }
            for (const sourceFile of allSourceFiles) {
                if (ts.isExternalOrCommonJsModule(sourceFile)) {
                    cb(sourceFile.symbol, sourceFile);
                }
            }
        }
        /**
         * Don't include something from a `node_modules` that isn't actually reachable by a global import.
         * A relative import to node_modules is usually a bad idea.
         */
        function isImportablePath(fromPath, toPath) {
            // If it's in a `node_modules` but is not reachable from here via a global import, don't bother.
            const toNodeModules = ts.forEachAncestorDirectory(toPath, ancestor => ts.getBaseFileName(ancestor) === "node_modules" ? ancestor : undefined);
            return toNodeModules === undefined || ts.startsWith(fromPath, ts.getDirectoryPath(toNodeModules));
        }
        function moduleSymbolToValidIdentifier(moduleSymbol, target) {
            return moduleSpecifierToValidIdentifier(ts.removeFileExtension(ts.stripQuotes(moduleSymbol.name)), target);
        }
        codefix.moduleSymbolToValidIdentifier = moduleSymbolToValidIdentifier;
        function moduleSpecifierToValidIdentifier(moduleSpecifier, target) {
            const baseName = ts.getBaseFileName(ts.removeSuffix(moduleSpecifier, "/index"));
            let res = "";
            let lastCharWasValid = true;
            const firstCharCode = baseName.charCodeAt(0);
            if (ts.isIdentifierStart(firstCharCode, target)) {
                res += String.fromCharCode(firstCharCode);
            }
            else {
                lastCharWasValid = false;
            }
            for (let i = 1; i < baseName.length; i++) {
                const ch = baseName.charCodeAt(i);
                const isValid = ts.isIdentifierPart(ch, target);
                if (isValid) {
                    let char = String.fromCharCode(ch);
                    if (!lastCharWasValid) {
                        char = char.toUpperCase();
                    }
                    res += char;
                }
                lastCharWasValid = isValid;
            }
            // Need `|| "_"` to ensure result isn't empty.
            return !ts.isStringANonContextualKeyword(res) ? res || "_" : `_${res}`;
        }
        codefix.moduleSpecifierToValidIdentifier = moduleSpecifierToValidIdentifier;
    })(codefix = ts.codefix || (ts.codefix = {}));
})(ts || (ts = {}));