/* @internal */
var ts;
(function (ts) {
    var OrganizeImports;
    (function (OrganizeImports) {
        /**
         * Organize imports by:
         *   1) Removing unused imports
         *   2) Coalescing imports from the same module
         *   3) Sorting imports
         */
        function organizeImports(sourceFile, formatContext, host, program, _preferences) {
            const changeTracker = ts.textChanges.ChangeTracker.fromContext({ host, formatContext });
            // All of the old ImportDeclarations in the file, in syntactic order.
            const topLevelImportDecls = sourceFile.statements.filter(ts.isImportDeclaration);
            organizeImportsWorker(topLevelImportDecls);
            for (const ambientModule of sourceFile.statements.filter(ts.isAmbientModule)) {
                const ambientModuleBody = getModuleBlock(ambientModule);
                const ambientModuleImportDecls = ambientModuleBody.statements.filter(ts.isImportDeclaration);
                organizeImportsWorker(ambientModuleImportDecls);
            }
            return changeTracker.getChanges();
            function organizeImportsWorker(oldImportDecls) {
                if (ts.length(oldImportDecls) === 0) {
                    return;
                }
                // Special case: normally, we'd expect leading and trailing trivia to follow each import
                // around as it's sorted.  However, we do not want this to happen for leading trivia
                // on the first import because it is probably the header comment for the file.
                // Consider: we could do a more careful check that this trivia is actually a header,
                // but the consequences of being wrong are very minor.
                ts.suppressLeadingTrivia(oldImportDecls[0]);
                const oldImportGroups = ts.group(oldImportDecls, importDecl => getExternalModuleName(importDecl.moduleSpecifier));
                const sortedImportGroups = ts.stableSort(oldImportGroups, (group1, group2) => compareModuleSpecifiers(group1[0].moduleSpecifier, group2[0].moduleSpecifier));
                const newImportDecls = ts.flatMap(sortedImportGroups, importGroup => getExternalModuleName(importGroup[0].moduleSpecifier)
                    ? coalesceImports(removeUnusedImports(importGroup, sourceFile, program))
                    : importGroup);
                // Delete or replace the first import.
                if (newImportDecls.length === 0) {
                    changeTracker.deleteNode(sourceFile, oldImportDecls[0], {
                        useNonAdjustedStartPosition: true,
                        useNonAdjustedEndPosition: false,
                    });
                }
                else {
                    // Note: Delete the surrounding trivia because it will have been retained in newImportDecls.
                    changeTracker.replaceNodeWithNodes(sourceFile, oldImportDecls[0], newImportDecls, {
                        useNonAdjustedStartPosition: true,
                        useNonAdjustedEndPosition: false,
                        suffix: ts.getNewLineOrDefaultFromHost(host, formatContext.options),
                    });
                }
                // Delete any subsequent imports.
                for (let i = 1; i < oldImportDecls.length; i++) {
                    changeTracker.deleteNode(sourceFile, oldImportDecls[i]);
                }
            }
        }
        OrganizeImports.organizeImports = organizeImports;
        function getModuleBlock(moduleDecl) {
            const body = moduleDecl.body;
            return body && !ts.isIdentifier(body) && (ts.isModuleBlock(body) ? body : getModuleBlock(body));
        }
        function removeUnusedImports(oldImports, sourceFile, program) {
            const typeChecker = program.getTypeChecker();
            const jsxNamespace = typeChecker.getJsxNamespace();
            const jsxContext = sourceFile.languageVariant === ts.LanguageVariant.JSX && program.getCompilerOptions().jsx;
            const usedImports = [];
            for (const importDecl of oldImports) {
                const { importClause } = importDecl;
                if (!importClause) {
                    // Imports without import clauses are assumed to be included for their side effects and are not removed.
                    usedImports.push(importDecl);
                    continue;
                }
                let { name, namedBindings } = importClause;
                // Default import
                if (name && !isDeclarationUsed(name)) {
                    name = undefined;
                }
                if (namedBindings) {
                    if (ts.isNamespaceImport(namedBindings)) {
                        // Namespace import
                        if (!isDeclarationUsed(namedBindings.name)) {
                            namedBindings = undefined;
                        }
                    }
                    else {
                        // List of named imports
                        const newElements = namedBindings.elements.filter(e => isDeclarationUsed(e.name));
                        if (newElements.length < namedBindings.elements.length) {
                            namedBindings = newElements.length
                                ? ts.updateNamedImports(namedBindings, newElements)
                                : undefined;
                        }
                    }
                }
                if (name || namedBindings) {
                    usedImports.push(updateImportDeclarationAndClause(importDecl, name, namedBindings));
                }
            }
            return usedImports;
            function isDeclarationUsed(identifier) {
                // The JSX factory symbol is always used.
                return jsxContext && (identifier.text === jsxNamespace) || ts.FindAllReferences.Core.isSymbolReferencedInFile(identifier, typeChecker, sourceFile);
            }
        }
        function getExternalModuleName(specifier) {
            return ts.isStringLiteralLike(specifier) ? specifier.text : undefined;
        }
        /* @internal */ // Internal for testing
        /**
         * @param importGroup a list of ImportDeclarations, all with the same module name.
         */
        function coalesceImports(importGroup) {
            if (importGroup.length === 0) {
                return importGroup;
            }
            const { importWithoutClause, defaultImports, namespaceImports, namedImports } = getCategorizedImports(importGroup);
            const coalescedImports = [];
            if (importWithoutClause) {
                coalescedImports.push(importWithoutClause);
            }
            // Normally, we don't combine default and namespace imports, but it would be silly to
            // produce two import declarations in this special case.
            if (defaultImports.length === 1 && namespaceImports.length === 1 && namedImports.length === 0) {
                // Add the namespace import to the existing default ImportDeclaration.
                const defaultImport = defaultImports[0];
                coalescedImports.push(updateImportDeclarationAndClause(defaultImport, defaultImport.importClause.name, namespaceImports[0].importClause.namedBindings));
                return coalescedImports;
            }
            const sortedNamespaceImports = ts.stableSort(namespaceImports, (i1, i2) => compareIdentifiers(i1.importClause.namedBindings.name, i2.importClause.namedBindings.name));
            for (const namespaceImport of sortedNamespaceImports) {
                // Drop the name, if any
                coalescedImports.push(updateImportDeclarationAndClause(namespaceImport, /*name*/ undefined, namespaceImport.importClause.namedBindings));
            }
            if (defaultImports.length === 0 && namedImports.length === 0) {
                return coalescedImports;
            }
            let newDefaultImport;
            const newImportSpecifiers = [];
            if (defaultImports.length === 1) {
                newDefaultImport = defaultImports[0].importClause.name;
            }
            else {
                for (const defaultImport of defaultImports) {
                    newImportSpecifiers.push(ts.createImportSpecifier(ts.createIdentifier("default"), defaultImport.importClause.name));
                }
            }
            newImportSpecifiers.push(...ts.flatMap(namedImports, i => i.importClause.namedBindings.elements));
            const sortedImportSpecifiers = ts.stableSort(newImportSpecifiers, (s1, s2) => compareIdentifiers(s1.propertyName || s1.name, s2.propertyName || s2.name) ||
                compareIdentifiers(s1.name, s2.name));
            const importDecl = defaultImports.length > 0
                ? defaultImports[0]
                : namedImports[0];
            const newNamedImports = sortedImportSpecifiers.length === 0
                ? undefined
                : namedImports.length === 0
                    ? ts.createNamedImports(sortedImportSpecifiers)
                    : ts.updateNamedImports(namedImports[0].importClause.namedBindings, sortedImportSpecifiers);
            coalescedImports.push(updateImportDeclarationAndClause(importDecl, newDefaultImport, newNamedImports));
            return coalescedImports;
            /*
             * Returns entire import declarations because they may already have been rewritten and
             * may lack parent pointers.  The desired parts can easily be recovered based on the
             * categorization.
             *
             * NB: There may be overlap between `defaultImports` and `namespaceImports`/`namedImports`.
             */
            function getCategorizedImports(importGroup) {
                let importWithoutClause;
                const defaultImports = [];
                const namespaceImports = [];
                const namedImports = [];
                for (const importDeclaration of importGroup) {
                    if (importDeclaration.importClause === undefined) {
                        // Only the first such import is interesting - the others are redundant.
                        // Note: Unfortunately, we will lose trivia that was on this node.
                        importWithoutClause = importWithoutClause || importDeclaration;
                        continue;
                    }
                    const { name, namedBindings } = importDeclaration.importClause;
                    if (name) {
                        defaultImports.push(importDeclaration);
                    }
                    if (namedBindings) {
                        if (ts.isNamespaceImport(namedBindings)) {
                            namespaceImports.push(importDeclaration);
                        }
                        else {
                            namedImports.push(importDeclaration);
                        }
                    }
                }
                return {
                    importWithoutClause,
                    defaultImports,
                    namespaceImports,
                    namedImports,
                };
            }
            function compareIdentifiers(s1, s2) {
                return ts.compareStringsCaseSensitive(s1.text, s2.text);
            }
        }
        OrganizeImports.coalesceImports = coalesceImports;
        function updateImportDeclarationAndClause(importDeclaration, name, namedBindings) {
            return ts.updateImportDeclaration(importDeclaration, importDeclaration.decorators, importDeclaration.modifiers, ts.updateImportClause(importDeclaration.importClause, name, namedBindings), importDeclaration.moduleSpecifier);
        }
        /* internal */ // Exported for testing
        function compareModuleSpecifiers(m1, m2) {
            const name1 = getExternalModuleName(m1);
            const name2 = getExternalModuleName(m2);
            return ts.compareBooleans(name1 === undefined, name2 === undefined) ||
                ts.compareBooleans(ts.isExternalModuleNameRelative(name1), ts.isExternalModuleNameRelative(name2)) ||
                ts.compareStringsCaseSensitive(name1, name2);
        }
        OrganizeImports.compareModuleSpecifiers = compareModuleSpecifiers;
    })(OrganizeImports = ts.OrganizeImports || (ts.OrganizeImports = {}));
})(ts || (ts = {}));
