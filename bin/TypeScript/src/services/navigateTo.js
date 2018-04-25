/* @internal */
var ts;
(function (ts) {
    var NavigateTo;
    (function (NavigateTo) {
        function getNavigateToItems(sourceFiles, checker, cancellationToken, searchValue, maxResultCount, excludeDtsFiles) {
            const patternMatcher = ts.createPatternMatcher(searchValue);
            if (!patternMatcher)
                return ts.emptyArray;
            let rawItems = [];
            // Search the declarations in all files and output matched NavigateToItem into array of NavigateToItem[]
            for (const sourceFile of sourceFiles) {
                cancellationToken.throwIfCancellationRequested();
                if (excludeDtsFiles && ts.fileExtensionIs(sourceFile.fileName, ts.Extension.Dts)) {
                    continue;
                }
                sourceFile.getNamedDeclarations().forEach((declarations, name) => {
                    getItemsFromNamedDeclaration(patternMatcher, name, declarations, checker, sourceFile.fileName, rawItems);
                });
            }
            rawItems.sort(compareNavigateToItems);
            if (maxResultCount !== undefined) {
                rawItems = rawItems.slice(0, maxResultCount);
            }
            return rawItems.map(createNavigateToItem);
        }
        NavigateTo.getNavigateToItems = getNavigateToItems;
        function getItemsFromNamedDeclaration(patternMatcher, name, declarations, checker, fileName, rawItems) {
            // First do a quick check to see if the name of the declaration matches the
            // last portion of the (possibly) dotted name they're searching for.
            const match = patternMatcher.getMatchForLastSegmentOfPattern(name);
            if (!match) {
                return; // continue to next named declarations
            }
            for (const declaration of declarations) {
                if (!shouldKeepItem(declaration, checker))
                    continue;
                if (patternMatcher.patternContainsDots) {
                    const fullMatch = patternMatcher.getFullMatch(getContainers(declaration), name);
                    if (fullMatch) {
                        rawItems.push({ name, fileName, matchKind: fullMatch.kind, isCaseSensitive: fullMatch.isCaseSensitive, declaration });
                    }
                }
                else {
                    // If the pattern has dots in it, then also see if the declaration container matches as well.
                    rawItems.push({ name, fileName, matchKind: match.kind, isCaseSensitive: match.isCaseSensitive, declaration });
                }
            }
        }
        function shouldKeepItem(declaration, checker) {
            switch (declaration.kind) {
                case ts.SyntaxKind.ImportClause:
                case ts.SyntaxKind.ImportSpecifier:
                case ts.SyntaxKind.ImportEqualsDeclaration:
                    const importer = checker.getSymbolAtLocation(declaration.name);
                    const imported = checker.getAliasedSymbol(importer);
                    return importer.escapedName !== imported.escapedName;
                default:
                    return true;
            }
        }
        function tryAddSingleDeclarationName(declaration, containers) {
            const name = ts.getNameOfDeclaration(declaration);
            if (name && ts.isPropertyNameLiteral(name)) {
                containers.unshift(ts.getTextOfIdentifierOrLiteral(name));
                return true;
            }
            else if (name && name.kind === ts.SyntaxKind.ComputedPropertyName) {
                return tryAddComputedPropertyName(name.expression, containers, /*includeLastPortion*/ true);
            }
            else {
                // Don't know how to add this.
                return false;
            }
        }
        // Only added the names of computed properties if they're simple dotted expressions, like:
        //
        //      [X.Y.Z]() { }
        function tryAddComputedPropertyName(expression, containers, includeLastPortion) {
            if (ts.isPropertyNameLiteral(expression)) {
                const text = ts.getTextOfIdentifierOrLiteral(expression);
                if (includeLastPortion) {
                    containers.unshift(text);
                }
                return true;
            }
            if (ts.isPropertyAccessExpression(expression)) {
                if (includeLastPortion) {
                    containers.unshift(expression.name.text);
                }
                return tryAddComputedPropertyName(expression.expression, containers, /*includeLastPortion*/ true);
            }
            return false;
        }
        function getContainers(declaration) {
            const containers = [];
            // First, if we started with a computed property name, then add all but the last
            // portion into the container array.
            const name = ts.getNameOfDeclaration(declaration);
            if (name.kind === ts.SyntaxKind.ComputedPropertyName && !tryAddComputedPropertyName(name.expression, containers, /*includeLastPortion*/ false)) {
                return undefined;
            }
            // Now, walk up our containers, adding all their names to the container array.
            declaration = ts.getContainerNode(declaration);
            while (declaration) {
                if (!tryAddSingleDeclarationName(declaration, containers)) {
                    return undefined;
                }
                declaration = ts.getContainerNode(declaration);
            }
            return containers;
        }
        function compareNavigateToItems(i1, i2) {
            // TODO(cyrusn): get the gamut of comparisons that VS already uses here.
            return ts.compareValues(i1.matchKind, i2.matchKind)
                || ts.compareStringsCaseSensitiveUI(i1.name, i2.name);
        }
        function createNavigateToItem(rawItem) {
            const declaration = rawItem.declaration;
            const container = ts.getContainerNode(declaration);
            const containerName = container && ts.getNameOfDeclaration(container);
            return {
                name: rawItem.name,
                kind: ts.getNodeKind(declaration),
                kindModifiers: ts.getNodeModifiers(declaration),
                matchKind: ts.PatternMatchKind[rawItem.matchKind],
                isCaseSensitive: rawItem.isCaseSensitive,
                fileName: rawItem.fileName,
                textSpan: ts.createTextSpanFromNode(declaration),
                // TODO(jfreeman): What should be the containerName when the container has a computed name?
                containerName: containerName ? containerName.text : "",
                containerKind: containerName ? ts.getNodeKind(container) : ts.ScriptElementKind.unknown
            };
        }
    })(NavigateTo = ts.NavigateTo || (ts.NavigateTo = {}));
})(ts || (ts = {}));
