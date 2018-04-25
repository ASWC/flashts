/* @internal */
var ts;
(function (ts) {
    function getEditsForFileRename(program, oldFilePath, newFilePath, host, formatContext) {
        const pathUpdater = getPathUpdater(oldFilePath, newFilePath, host);
        return ts.textChanges.ChangeTracker.with({ host, formatContext }, changeTracker => {
            updateTsconfigFiles(program, changeTracker, oldFilePath, newFilePath);
            for (const { sourceFile, toUpdate } of getImportsToUpdate(program, oldFilePath)) {
                const newPath = pathUpdater(isRef(toUpdate) ? toUpdate.fileName : toUpdate.text);
                if (newPath !== undefined) {
                    const range = isRef(toUpdate) ? toUpdate : createStringRange(toUpdate, sourceFile);
                    changeTracker.replaceRangeWithText(sourceFile, range, isRef(toUpdate) ? newPath : ts.removeFileExtension(newPath));
                }
            }
        });
    }
    ts.getEditsForFileRename = getEditsForFileRename;
    function updateTsconfigFiles(program, changeTracker, oldFilePath, newFilePath) {
        const cfg = program.getCompilerOptions().configFile;
        if (!cfg)
            return;
        const oldFile = cfg.jsonObject && getFilesEntry(cfg.jsonObject, oldFilePath);
        if (oldFile) {
            changeTracker.replaceRangeWithText(cfg, createStringRange(oldFile, cfg), newFilePath);
        }
    }
    function getFilesEntry(cfg, fileName) {
        const filesProp = ts.find(cfg.properties, (prop) => ts.isPropertyAssignment(prop) && ts.isStringLiteral(prop.name) && prop.name.text === "files");
        const files = filesProp && filesProp.initializer;
        return files && ts.isArrayLiteralExpression(files) ? ts.find(files.elements, (e) => ts.isStringLiteral(e) && e.text === fileName) : undefined;
    }
    function isRef(toUpdate) {
        return "fileName" in toUpdate;
    }
    function getImportsToUpdate(program, oldFilePath) {
        const checker = program.getTypeChecker();
        const result = [];
        for (const sourceFile of program.getSourceFiles()) {
            for (const ref of sourceFile.referencedFiles) {
                if (!program.getSourceFileFromReference(sourceFile, ref) && ts.resolveTripleslashReference(ref.fileName, sourceFile.fileName) === oldFilePath) {
                    result.push({ sourceFile, toUpdate: ref });
                }
            }
            for (const importStringLiteral of sourceFile.imports) {
                // If it resolved to something already, ignore.
                if (checker.getSymbolAtLocation(importStringLiteral))
                    continue;
                const resolved = program.getResolvedModuleWithFailedLookupLocationsFromCache(importStringLiteral.text, sourceFile.fileName);
                if (ts.contains(resolved.failedLookupLocations, oldFilePath)) {
                    result.push({ sourceFile, toUpdate: importStringLiteral });
                }
            }
        }
        return result;
    }
    function getPathUpdater(oldFilePath, newFilePath, host) {
        // Get the relative path from old to new location, and append it on to the end of imports and normalize.
        const rel = ts.getRelativePath(newFilePath, ts.getDirectoryPath(oldFilePath), ts.createGetCanonicalFileName(ts.hostUsesCaseSensitiveFileNames(host)));
        return oldPath => {
            if (!ts.pathIsRelative(oldPath))
                return;
            return ts.ensurePathIsRelative(ts.normalizePath(ts.combinePaths(ts.getDirectoryPath(oldPath), rel)));
        };
    }
    function createStringRange(node, sourceFile) {
        return ts.createTextRange(node.getStart(sourceFile) + 1, node.end - 1);
    }
})(ts || (ts = {}));
