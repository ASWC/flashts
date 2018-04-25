/* @internal */
var ts;
(function (ts) {
    function createCachedDirectoryStructureHost(host, currentDirectory, useCaseSensitiveFileNames) {
        if (!host.getDirectories || !host.readDirectory) {
            return undefined;
        }
        const cachedReadDirectoryResult = ts.createMap();
        const getCanonicalFileName = ts.createGetCanonicalFileName(useCaseSensitiveFileNames);
        return {
            useCaseSensitiveFileNames,
            fileExists,
            readFile: (path, encoding) => host.readFile(path, encoding),
            directoryExists: host.directoryExists && directoryExists,
            getDirectories,
            readDirectory,
            createDirectory: host.createDirectory && createDirectory,
            writeFile: host.writeFile && writeFile,
            addOrDeleteFileOrDirectory,
            addOrDeleteFile,
            clearCache
        };
        function toPath(fileName) {
            return ts.toPath(fileName, currentDirectory, getCanonicalFileName);
        }
        function getCachedFileSystemEntries(rootDirPath) {
            return cachedReadDirectoryResult.get(rootDirPath);
        }
        function getCachedFileSystemEntriesForBaseDir(path) {
            return getCachedFileSystemEntries(ts.getDirectoryPath(path));
        }
        function getBaseNameOfFileName(fileName) {
            return ts.getBaseFileName(ts.normalizePath(fileName));
        }
        function createCachedFileSystemEntries(rootDir, rootDirPath) {
            const resultFromHost = {
                files: ts.map(host.readDirectory(rootDir, /*extensions*/ undefined, /*exclude*/ undefined, /*include*/ ["*.*"]), getBaseNameOfFileName) || [],
                directories: host.getDirectories(rootDir) || []
            };
            cachedReadDirectoryResult.set(rootDirPath, resultFromHost);
            return resultFromHost;
        }
        /**
         * If the readDirectory result was already cached, it returns that
         * Otherwise gets result from host and caches it.
         * The host request is done under try catch block to avoid caching incorrect result
         */
        function tryReadDirectory(rootDir, rootDirPath) {
            const cachedResult = getCachedFileSystemEntries(rootDirPath);
            if (cachedResult) {
                return cachedResult;
            }
            try {
                return createCachedFileSystemEntries(rootDir, rootDirPath);
            }
            catch (_e) {
                // If there is exception to read directories, dont cache the result and direct the calls to host
                ts.Debug.assert(!cachedReadDirectoryResult.has(rootDirPath));
                return undefined;
            }
        }
        function fileNameEqual(name1, name2) {
            return getCanonicalFileName(name1) === getCanonicalFileName(name2);
        }
        function hasEntry(entries, name) {
            return ts.some(entries, file => fileNameEqual(file, name));
        }
        function updateFileSystemEntry(entries, baseName, isValid) {
            if (hasEntry(entries, baseName)) {
                if (!isValid) {
                    return ts.filterMutate(entries, entry => !fileNameEqual(entry, baseName));
                }
            }
            else if (isValid) {
                return entries.push(baseName);
            }
        }
        function writeFile(fileName, data, writeByteOrderMark) {
            const path = toPath(fileName);
            const result = getCachedFileSystemEntriesForBaseDir(path);
            if (result) {
                updateFilesOfFileSystemEntry(result, getBaseNameOfFileName(fileName), /*fileExists*/ true);
            }
            return host.writeFile(fileName, data, writeByteOrderMark);
        }
        function fileExists(fileName) {
            const path = toPath(fileName);
            const result = getCachedFileSystemEntriesForBaseDir(path);
            return result && hasEntry(result.files, getBaseNameOfFileName(fileName)) ||
                host.fileExists(fileName);
        }
        function directoryExists(dirPath) {
            const path = toPath(dirPath);
            return cachedReadDirectoryResult.has(path) || host.directoryExists(dirPath);
        }
        function createDirectory(dirPath) {
            const path = toPath(dirPath);
            const result = getCachedFileSystemEntriesForBaseDir(path);
            const baseFileName = getBaseNameOfFileName(dirPath);
            if (result) {
                updateFileSystemEntry(result.directories, baseFileName, /*isValid*/ true);
            }
            host.createDirectory(dirPath);
        }
        function getDirectories(rootDir) {
            const rootDirPath = toPath(rootDir);
            const result = tryReadDirectory(rootDir, rootDirPath);
            if (result) {
                return result.directories.slice();
            }
            return host.getDirectories(rootDir);
        }
        function readDirectory(rootDir, extensions, excludes, includes, depth) {
            const rootDirPath = toPath(rootDir);
            const result = tryReadDirectory(rootDir, rootDirPath);
            if (result) {
                return ts.matchFiles(rootDir, extensions, excludes, includes, useCaseSensitiveFileNames, currentDirectory, depth, getFileSystemEntries);
            }
            return host.readDirectory(rootDir, extensions, excludes, includes, depth);
            function getFileSystemEntries(dir) {
                const path = toPath(dir);
                if (path === rootDirPath) {
                    return result;
                }
                return tryReadDirectory(dir, path) || ts.emptyFileSystemEntries;
            }
        }
        function addOrDeleteFileOrDirectory(fileOrDirectory, fileOrDirectoryPath) {
            const existingResult = getCachedFileSystemEntries(fileOrDirectoryPath);
            if (existingResult) {
                // Just clear the cache for now
                // For now just clear the cache, since this could mean that multiple level entries might need to be re-evaluated
                clearCache();
                return undefined;
            }
            const parentResult = getCachedFileSystemEntriesForBaseDir(fileOrDirectoryPath);
            if (!parentResult) {
                return undefined;
            }
            // This was earlier a file (hence not in cached directory contents)
            // or we never cached the directory containing it
            if (!host.directoryExists) {
                // Since host doesnt support directory exists, clear the cache as otherwise it might not be same
                clearCache();
                return undefined;
            }
            const baseName = getBaseNameOfFileName(fileOrDirectory);
            const fsQueryResult = {
                fileExists: host.fileExists(fileOrDirectoryPath),
                directoryExists: host.directoryExists(fileOrDirectoryPath)
            };
            if (fsQueryResult.directoryExists || hasEntry(parentResult.directories, baseName)) {
                // Folder added or removed, clear the cache instead of updating the folder and its structure
                clearCache();
            }
            else {
                // No need to update the directory structure, just files
                updateFilesOfFileSystemEntry(parentResult, baseName, fsQueryResult.fileExists);
            }
            return fsQueryResult;
        }
        function addOrDeleteFile(fileName, filePath, eventKind) {
            if (eventKind === ts.FileWatcherEventKind.Changed) {
                return;
            }
            const parentResult = getCachedFileSystemEntriesForBaseDir(filePath);
            if (parentResult) {
                updateFilesOfFileSystemEntry(parentResult, getBaseNameOfFileName(fileName), eventKind === ts.FileWatcherEventKind.Created);
            }
        }
        function updateFilesOfFileSystemEntry(parentResult, baseName, fileExists) {
            updateFileSystemEntry(parentResult.files, baseName, fileExists);
        }
        function clearCache() {
            cachedReadDirectoryResult.clear();
        }
    }
    ts.createCachedDirectoryStructureHost = createCachedDirectoryStructureHost;
    let ConfigFileProgramReloadLevel;
    (function (ConfigFileProgramReloadLevel) {
        ConfigFileProgramReloadLevel[ConfigFileProgramReloadLevel["None"] = 0] = "None";
        /** Update the file name list from the disk */
        ConfigFileProgramReloadLevel[ConfigFileProgramReloadLevel["Partial"] = 1] = "Partial";
        /** Reload completely by re-reading contents of config file from disk and updating program */
        ConfigFileProgramReloadLevel[ConfigFileProgramReloadLevel["Full"] = 2] = "Full";
    })(ConfigFileProgramReloadLevel = ts.ConfigFileProgramReloadLevel || (ts.ConfigFileProgramReloadLevel = {}));
    /**
     * Updates the existing missing file watches with the new set of missing files after new program is created
     */
    function updateMissingFilePathsWatch(program, missingFileWatches, createMissingFileWatch) {
        const missingFilePaths = program.getMissingFilePaths();
        const newMissingFilePathMap = ts.arrayToSet(missingFilePaths);
        // Update the missing file paths watcher
        ts.mutateMap(missingFileWatches, newMissingFilePathMap, {
            // Watch the missing files
            createNewValue: createMissingFileWatch,
            // Files that are no longer missing (e.g. because they are no longer required)
            // should no longer be watched.
            onDeleteValue: ts.closeFileWatcher
        });
    }
    ts.updateMissingFilePathsWatch = updateMissingFilePathsWatch;
    /**
     * Updates the existing wild card directory watches with the new set of wild card directories from the config file
     * after new program is created because the config file was reloaded or program was created first time from the config file
     * Note that there is no need to call this function when the program is updated with additional files without reloading config files,
     * as wildcard directories wont change unless reloading config file
     */
    function updateWatchingWildcardDirectories(existingWatchedForWildcards, wildcardDirectories, watchDirectory) {
        ts.mutateMap(existingWatchedForWildcards, wildcardDirectories, {
            // Create new watch and recursive info
            createNewValue: createWildcardDirectoryWatcher,
            // Close existing watch thats not needed any more
            onDeleteValue: closeFileWatcherOf,
            // Close existing watch that doesnt match in the flags
            onExistingValue: updateWildcardDirectoryWatcher
        });
        function createWildcardDirectoryWatcher(directory, flags) {
            // Create new watch and recursive info
            return {
                watcher: watchDirectory(directory, flags),
                flags
            };
        }
        function updateWildcardDirectoryWatcher(existingWatcher, flags, directory) {
            // Watcher needs to be updated if the recursive flags dont match
            if (existingWatcher.flags === flags) {
                return;
            }
            existingWatcher.watcher.close();
            existingWatchedForWildcards.set(directory, createWildcardDirectoryWatcher(directory, flags));
        }
    }
    ts.updateWatchingWildcardDirectories = updateWatchingWildcardDirectories;
    function isEmittedFileOfProgram(program, file) {
        if (!program) {
            return false;
        }
        return program.isEmittedFile(file);
    }
    ts.isEmittedFileOfProgram = isEmittedFileOfProgram;
    let WatchLogLevel;
    (function (WatchLogLevel) {
        WatchLogLevel[WatchLogLevel["None"] = 0] = "None";
        WatchLogLevel[WatchLogLevel["TriggerOnly"] = 1] = "TriggerOnly";
        WatchLogLevel[WatchLogLevel["Verbose"] = 2] = "Verbose";
    })(WatchLogLevel = ts.WatchLogLevel || (ts.WatchLogLevel = {}));
    function getWatchFactory(watchLogLevel, log, getDetailWatchInfo) {
        return getWatchFactoryWith(watchLogLevel, log, getDetailWatchInfo, watchFile, watchDirectory);
    }
    ts.getWatchFactory = getWatchFactory;
    function getWatchFactoryWith(watchLogLevel, log, getDetailWatchInfo, watchFile, watchDirectory) {
        const createFileWatcher = getCreateFileWatcher(watchLogLevel, watchFile);
        const createFilePathWatcher = watchLogLevel === WatchLogLevel.None ? watchFilePath : createFileWatcher;
        const createDirectoryWatcher = getCreateFileWatcher(watchLogLevel, watchDirectory);
        return {
            watchFile: (host, file, callback, pollingInterval, detailInfo1, detailInfo2) => createFileWatcher(host, file, callback, pollingInterval, /*passThrough*/ undefined, detailInfo1, detailInfo2, watchFile, log, "FileWatcher", getDetailWatchInfo),
            watchFilePath: (host, file, callback, pollingInterval, path, detailInfo1, detailInfo2) => createFilePathWatcher(host, file, callback, pollingInterval, path, detailInfo1, detailInfo2, watchFile, log, "FileWatcher", getDetailWatchInfo),
            watchDirectory: (host, directory, callback, flags, detailInfo1, detailInfo2) => createDirectoryWatcher(host, directory, callback, flags, /*passThrough*/ undefined, detailInfo1, detailInfo2, watchDirectory, log, "DirectoryWatcher", getDetailWatchInfo)
        };
        function watchFilePath(host, file, callback, pollingInterval, path) {
            return watchFile(host, file, (fileName, eventKind) => callback(fileName, eventKind, path), pollingInterval);
        }
    }
    function watchFile(host, file, callback, pollingInterval) {
        return host.watchFile(file, callback, pollingInterval);
    }
    function watchDirectory(host, directory, callback, flags) {
        return host.watchDirectory(directory, callback, (flags & ts.WatchDirectoryFlags.Recursive) !== 0);
    }
    function getCreateFileWatcher(watchLogLevel, addWatch) {
        switch (watchLogLevel) {
            case WatchLogLevel.None:
                return addWatch;
            case WatchLogLevel.TriggerOnly:
                return createFileWatcherWithTriggerLogging;
            case WatchLogLevel.Verbose:
                return createFileWatcherWithLogging;
        }
    }
    function createFileWatcherWithLogging(host, file, cb, flags, passThrough, detailInfo1, detailInfo2, addWatch, log, watchCaption, getDetailWatchInfo) {
        log(`${watchCaption}:: Added:: ${getWatchInfo(file, flags, detailInfo1, detailInfo2, getDetailWatchInfo)}`);
        const watcher = createFileWatcherWithTriggerLogging(host, file, cb, flags, passThrough, detailInfo1, detailInfo2, addWatch, log, watchCaption, getDetailWatchInfo);
        return {
            close: () => {
                log(`${watchCaption}:: Close:: ${getWatchInfo(file, flags, detailInfo1, detailInfo2, getDetailWatchInfo)}`);
                watcher.close();
            }
        };
    }
    function createFileWatcherWithTriggerLogging(host, file, cb, flags, passThrough, detailInfo1, detailInfo2, addWatch, log, watchCaption, getDetailWatchInfo) {
        return addWatch(host, file, (fileName, cbOptional) => {
            const triggerredInfo = `${watchCaption}:: Triggered with ${fileName}${cbOptional !== undefined ? cbOptional : ""}:: ${getWatchInfo(file, flags, detailInfo1, detailInfo2, getDetailWatchInfo)}`;
            log(triggerredInfo);
            const start = ts.timestamp();
            cb(fileName, cbOptional, passThrough);
            const elapsed = ts.timestamp() - start;
            log(`Elapsed:: ${elapsed}ms ${triggerredInfo}`);
        }, flags);
    }
    function getWatchInfo(file, flags, detailInfo1, detailInfo2, getDetailWatchInfo) {
        return `WatchInfo: ${file} ${flags} ${getDetailWatchInfo ? getDetailWatchInfo(detailInfo1, detailInfo2) : ""}`;
    }
    function closeFileWatcherOf(objWithWatcher) {
        objWithWatcher.watcher.close();
    }
    ts.closeFileWatcherOf = closeFileWatcherOf;
})(ts || (ts = {}));
