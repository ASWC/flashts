var ts;
(function (ts) {
    function createDocumentRegistry(useCaseSensitiveFileNames, currentDirectory = "") {
        // Maps from compiler setting target (ES3, ES5, etc.) to all the cached documents we have
        // for those settings.
        const buckets = ts.createMap();
        const getCanonicalFileName = ts.createGetCanonicalFileName(!!useCaseSensitiveFileNames);
        function getKeyForCompilationSettings(settings) {
            return `_${settings.target}|${settings.module}|${settings.noResolve}|${settings.jsx}|${settings.allowJs}|${settings.baseUrl}|${JSON.stringify(settings.typeRoots)}|${JSON.stringify(settings.rootDirs)}|${JSON.stringify(settings.paths)}`;
        }
        function getBucketForCompilationSettings(key, createIfMissing) {
            let bucket = buckets.get(key);
            if (!bucket && createIfMissing) {
                buckets.set(key, bucket = ts.createMap());
            }
            return bucket;
        }
        function reportStats() {
            const bucketInfoArray = ts.arrayFrom(buckets.keys()).filter(name => name && name.charAt(0) === "_").map(name => {
                const entries = buckets.get(name);
                const sourceFiles = [];
                entries.forEach((entry, name) => {
                    sourceFiles.push({
                        name,
                        refCount: entry.languageServiceRefCount,
                        references: entry.owners.slice(0)
                    });
                });
                sourceFiles.sort((x, y) => y.refCount - x.refCount);
                return {
                    bucket: name,
                    sourceFiles
                };
            });
            return JSON.stringify(bucketInfoArray, undefined, 2);
        }
        function acquireDocument(fileName, compilationSettings, scriptSnapshot, version, scriptKind) {
            const path = ts.toPath(fileName, currentDirectory, getCanonicalFileName);
            const key = getKeyForCompilationSettings(compilationSettings);
            return acquireDocumentWithKey(fileName, path, compilationSettings, key, scriptSnapshot, version, scriptKind);
        }
        function acquireDocumentWithKey(fileName, path, compilationSettings, key, scriptSnapshot, version, scriptKind) {
            return acquireOrUpdateDocument(fileName, path, compilationSettings, key, scriptSnapshot, version, /*acquiring*/ true, scriptKind);
        }
        function updateDocument(fileName, compilationSettings, scriptSnapshot, version, scriptKind) {
            const path = ts.toPath(fileName, currentDirectory, getCanonicalFileName);
            const key = getKeyForCompilationSettings(compilationSettings);
            return updateDocumentWithKey(fileName, path, compilationSettings, key, scriptSnapshot, version, scriptKind);
        }
        function updateDocumentWithKey(fileName, path, compilationSettings, key, scriptSnapshot, version, scriptKind) {
            return acquireOrUpdateDocument(fileName, path, compilationSettings, key, scriptSnapshot, version, /*acquiring*/ false, scriptKind);
        }
        function acquireOrUpdateDocument(fileName, path, compilationSettings, key, scriptSnapshot, version, acquiring, scriptKind) {
            const bucket = getBucketForCompilationSettings(key, /*createIfMissing*/ true);
            let entry = bucket.get(path);
            if (!entry) {
                // Have never seen this file with these settings.  Create a new source file for it.
                const sourceFile = ts.createLanguageServiceSourceFile(fileName, scriptSnapshot, compilationSettings.target, version, /*setNodeParents*/ false, scriptKind);
                entry = {
                    sourceFile,
                    languageServiceRefCount: 1,
                    owners: []
                };
                bucket.set(path, entry);
            }
            else {
                // We have an entry for this file.  However, it may be for a different version of
                // the script snapshot.  If so, update it appropriately.  Otherwise, we can just
                // return it as is.
                if (entry.sourceFile.version !== version) {
                    entry.sourceFile = ts.updateLanguageServiceSourceFile(entry.sourceFile, scriptSnapshot, version, scriptSnapshot.getChangeRange(entry.sourceFile.scriptSnapshot));
                }
                // If we're acquiring, then this is the first time this LS is asking for this document.
                // Increase our ref count so we know there's another LS using the document.  If we're
                // not acquiring, then that means the LS is 'updating' the file instead, and that means
                // it has already acquired the document previously.  As such, we do not need to increase
                // the ref count.
                if (acquiring) {
                    entry.languageServiceRefCount++;
                }
            }
            return entry.sourceFile;
        }
        function releaseDocument(fileName, compilationSettings) {
            const path = ts.toPath(fileName, currentDirectory, getCanonicalFileName);
            const key = getKeyForCompilationSettings(compilationSettings);
            return releaseDocumentWithKey(path, key);
        }
        function releaseDocumentWithKey(path, key) {
            const bucket = getBucketForCompilationSettings(key, /*createIfMissing*/ false);
            ts.Debug.assert(bucket !== undefined);
            const entry = bucket.get(path);
            entry.languageServiceRefCount--;
            ts.Debug.assert(entry.languageServiceRefCount >= 0);
            if (entry.languageServiceRefCount === 0) {
                bucket.delete(path);
            }
        }
        return {
            acquireDocument,
            acquireDocumentWithKey,
            updateDocument,
            updateDocumentWithKey,
            releaseDocument,
            releaseDocumentWithKey,
            reportStats,
            getKeyForCompilationSettings
        };
    }
    ts.createDocumentRegistry = createDocumentRegistry;
})(ts || (ts = {}));
