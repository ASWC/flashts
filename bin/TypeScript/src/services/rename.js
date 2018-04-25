/* @internal */
var ts;
(function (ts) {
    var Rename;
    (function (Rename) {
        function getRenameInfo(typeChecker, defaultLibFileName, getCanonicalFileName, sourceFile, position) {
            const getCanonicalDefaultLibName = ts.memoize(() => getCanonicalFileName(ts.normalizePath(defaultLibFileName)));
            const node = ts.getTouchingPropertyName(sourceFile, position, /*includeJsDocComment*/ true);
            const renameInfo = node && nodeIsEligibleForRename(node)
                ? getRenameInfoForNode(node, typeChecker, sourceFile, isDefinedInLibraryFile)
                : undefined;
            return renameInfo || getRenameInfoError(Diagnostics.You_cannot_rename_this_element);
            function isDefinedInLibraryFile(declaration) {
                if (!defaultLibFileName) {
                    return false;
                }
                const sourceFile = declaration.getSourceFile();
                const canonicalName = getCanonicalFileName(ts.normalizePath(sourceFile.fileName));
                return canonicalName === getCanonicalDefaultLibName();
            }
        }
        Rename.getRenameInfo = getRenameInfo;
        function getRenameInfoForNode(node, typeChecker, sourceFile, isDefinedInLibraryFile) {
            const symbol = typeChecker.getSymbolAtLocation(node);
            // Only allow a symbol to be renamed if it actually has at least one declaration.
            if (symbol) {
                const { declarations } = symbol;
                if (declarations && declarations.length > 0) {
                    // Disallow rename for elements that are defined in the standard TypeScript library.
                    if (declarations.some(isDefinedInLibraryFile)) {
                        return getRenameInfoError(Diagnostics.You_cannot_rename_elements_that_are_defined_in_the_standard_TypeScript_library);
                    }
                    // Cannot rename `default` as in `import { default as foo } from "./someModule";
                    if (ts.isIdentifier(node) && node.originalKeywordKind === ts.SyntaxKind.DefaultKeyword && symbol.parent.flags & ts.SymbolFlags.Module) {
                        return undefined;
                    }
                    const kind = ts.SymbolDisplay.getSymbolKind(typeChecker, symbol, node);
                    const specifierName = (ts.isImportOrExportSpecifierName(node) || ts.isStringOrNumericLiteral(node) && node.parent.kind === ts.SyntaxKind.ComputedPropertyName)
                        ? ts.stripQuotes(ts.getTextOfIdentifierOrLiteral(node))
                        : undefined;
                    const displayName = specifierName || typeChecker.symbolToString(symbol);
                    const fullDisplayName = specifierName || typeChecker.getFullyQualifiedName(symbol);
                    return getRenameInfoSuccess(displayName, fullDisplayName, kind, ts.SymbolDisplay.getSymbolModifiers(symbol), node, sourceFile);
                }
            }
            else if (ts.isStringLiteral(node)) {
                if (isDefinedInLibraryFile(node)) {
                    return getRenameInfoError(Diagnostics.You_cannot_rename_elements_that_are_defined_in_the_standard_TypeScript_library);
                }
                return getRenameInfoSuccess(node.text, node.text, ts.ScriptElementKind.variableElement, ts.ScriptElementKindModifier.none, node, sourceFile);
            }
        }
        function getRenameInfoSuccess(displayName, fullDisplayName, kind, kindModifiers, node, sourceFile) {
            return {
                canRename: true,
                kind,
                displayName,
                localizedErrorMessage: undefined,
                fullDisplayName,
                kindModifiers,
                triggerSpan: createTriggerSpanForNode(node, sourceFile)
            };
        }
        function getRenameInfoError(diagnostic) {
            return {
                canRename: false,
                localizedErrorMessage: ts.getLocaleSpecificMessage(diagnostic),
                displayName: undefined,
                fullDisplayName: undefined,
                kind: undefined,
                kindModifiers: undefined,
                triggerSpan: undefined
            };
        }
        function createTriggerSpanForNode(node, sourceFile) {
            let start = node.getStart(sourceFile);
            let width = node.getWidth(sourceFile);
            if (node.kind === ts.SyntaxKind.StringLiteral) {
                // Exclude the quotes
                start += 1;
                width -= 2;
            }
            return ts.createTextSpan(start, width);
        }
        function nodeIsEligibleForRename(node) {
            switch (node.kind) {
                case ts.SyntaxKind.Identifier:
                case ts.SyntaxKind.StringLiteral:
                case ts.SyntaxKind.ThisKeyword:
                    return true;
                case ts.SyntaxKind.NumericLiteral:
                    return ts.isLiteralNameOfPropertyDeclarationOrIndexAccess(node);
                default:
                    return false;
            }
        }
    })(Rename = ts.Rename || (ts.Rename = {}));
})(ts || (ts = {}));
