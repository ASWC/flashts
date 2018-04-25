/*@internal*/
var ts;
(function (ts) {
    ts.maxNumberOfFilesToIterateForInvalidation = 256;
    function createResolutionCache(resolutionHost, rootDirForResolution, logChangesWhenResolvingModule) {
        let filesWithChangedSetOfUnresolvedImports;
        let filesWithInvalidatedResolutions;
        let filesWithInvalidatedNonRelativeUnresolvedImports;
        let allFilesHaveInvalidatedResolution = false;
        const getCurrentDirectory = ts.memoize(() => resolutionHost.getCurrentDirectory());
        const cachedDirectoryStructureHost = resolutionHost.getCachedDirectoryStructureHost();
        // The resolvedModuleNames and resolvedTypeReferenceDirectives are the cache of resolutions per file.
        // The key in the map is source file's path.
        // The values are Map of resolutions with key being name lookedup.
        const resolvedModuleNames = ts.createMap();
        const perDirectoryResolvedModuleNames = ts.createMap();
        const nonRelaticeModuleNameCache = ts.createMap();
        const moduleResolutionCache = ts.createModuleResolutionCacheWithMaps(perDirectoryResolvedModuleNames, nonRelaticeModuleNameCache, getCurrentDirectory(), resolutionHost.getCanonicalFileName);
        const resolvedTypeReferenceDirectives = ts.createMap();
        const perDirectoryResolvedTypeReferenceDirectives = ts.createMap();
        /**
         * These are the extensions that failed lookup files will have by default,
         * any other extension of failed lookup will be store that path in custom failed lookup path
         * This helps in not having to comb through all resolutions when files are added/removed
         * Note that .d.ts file also has .d.ts extension hence will be part of default extensions
         */
        const failedLookupDefaultExtensions = [ts.Extension.Ts, ts.Extension.Tsx, ts.Extension.Js, ts.Extension.Jsx, ts.Extension.Json];
        const customFailedLookupPaths = ts.createMap();
        const directoryWatchesOfFailedLookups = ts.createMap();
        const rootDir = rootDirForResolution && ts.removeTrailingDirectorySeparator(ts.getNormalizedAbsolutePath(rootDirForResolution, getCurrentDirectory()));
        const rootPath = rootDir && resolutionHost.toPath(rootDir);
        // TypeRoot watches for the types that get added as part of getAutomaticTypeDirectiveNames
        const typeRootsWatches = ts.createMap();
        return {
            startRecordingFilesWithChangedResolutions,
            finishRecordingFilesWithChangedResolutions,
            // perDirectoryResolvedModuleNames and perDirectoryResolvedTypeReferenceDirectives could be non empty if there was exception during program update
            // (between startCachingPerDirectoryResolution and finishCachingPerDirectoryResolution)
            startCachingPerDirectoryResolution: clearPerDirectoryResolutions,
            finishCachingPerDirectoryResolution,
            resolveModuleNames,
            resolveTypeReferenceDirectives,
            removeResolutionsOfFile,
            invalidateResolutionOfFile,
            setFilesWithInvalidatedNonRelativeUnresolvedImports,
            createHasInvalidatedResolution,
            updateTypeRootsWatch,
            closeTypeRootsWatch,
            clear
        };
        function getResolvedModule(resolution) {
            return resolution.resolvedModule;
        }
        function getResolvedTypeReferenceDirective(resolution) {
            return resolution.resolvedTypeReferenceDirective;
        }
        function isInDirectoryPath(dir, file) {
            if (dir === undefined || file.length <= dir.length) {
                return false;
            }
            return ts.startsWith(file, dir) && file[dir.length] === ts.directorySeparator;
        }
        function clear() {
            ts.clearMap(directoryWatchesOfFailedLookups, ts.closeFileWatcherOf);
            customFailedLookupPaths.clear();
            closeTypeRootsWatch();
            resolvedModuleNames.clear();
            resolvedTypeReferenceDirectives.clear();
            allFilesHaveInvalidatedResolution = false;
            // perDirectoryResolvedModuleNames and perDirectoryResolvedTypeReferenceDirectives could be non empty if there was exception during program update
            // (between startCachingPerDirectoryResolution and finishCachingPerDirectoryResolution)
            clearPerDirectoryResolutions();
        }
        function startRecordingFilesWithChangedResolutions() {
            filesWithChangedSetOfUnresolvedImports = [];
        }
        function finishRecordingFilesWithChangedResolutions() {
            const collected = filesWithChangedSetOfUnresolvedImports;
            filesWithChangedSetOfUnresolvedImports = undefined;
            return collected;
        }
        function isFileWithInvalidatedNonRelativeUnresolvedImports(path) {
            if (!filesWithInvalidatedNonRelativeUnresolvedImports) {
                return false;
            }
            // Invalidated if file has unresolved imports
            const value = filesWithInvalidatedNonRelativeUnresolvedImports.get(path);
            return value && !!value.length;
        }
        function createHasInvalidatedResolution(forceAllFilesAsInvalidated) {
            if (allFilesHaveInvalidatedResolution || forceAllFilesAsInvalidated) {
                // Any file asked would have invalidated resolution
                filesWithInvalidatedResolutions = undefined;
                return ts.returnTrue;
            }
            const collected = filesWithInvalidatedResolutions;
            filesWithInvalidatedResolutions = undefined;
            return path => (collected && collected.has(path)) ||
                isFileWithInvalidatedNonRelativeUnresolvedImports(path);
        }
        function clearPerDirectoryResolutions() {
            perDirectoryResolvedModuleNames.clear();
            nonRelaticeModuleNameCache.clear();
            perDirectoryResolvedTypeReferenceDirectives.clear();
        }
        function finishCachingPerDirectoryResolution() {
            allFilesHaveInvalidatedResolution = false;
            filesWithInvalidatedNonRelativeUnresolvedImports = undefined;
            directoryWatchesOfFailedLookups.forEach((watcher, path) => {
                if (watcher.refCount === 0) {
                    directoryWatchesOfFailedLookups.delete(path);
                    watcher.watcher.close();
                }
            });
            clearPerDirectoryResolutions();
        }
        function resolveModuleName(moduleName, containingFile, compilerOptions, host) {
            const primaryResult = ts.resolveModuleName(moduleName, containingFile, compilerOptions, host, moduleResolutionCache);
            // return result immediately only if global cache support is not enabled or if it is .ts, .tsx or .d.ts
            if (!resolutionHost.getGlobalCache) {
                return primaryResult;
            }
            // otherwise try to load typings from @types
            const globalCache = resolutionHost.getGlobalCache();
            if (globalCache !== undefined && !ts.isExternalModuleNameRelative(moduleName) && !(primaryResult.resolvedModule && ts.extensionIsTypeScript(primaryResult.resolvedModule.extension))) {
                // create different collection of failed lookup locations for second pass
                // if it will fail and we've already found something during the first pass - we don't want to pollute its results
                const { resolvedModule, failedLookupLocations } = ts.loadModuleFromGlobalCache(moduleName, resolutionHost.projectName, compilerOptions, host, globalCache);
                if (resolvedModule) {
                    return { resolvedModule, failedLookupLocations: ts.addRange(primaryResult.failedLookupLocations, failedLookupLocations) };
                }
            }
            // Default return the result from the first pass
            return primaryResult;
        }
        function resolveNamesWithLocalCache(names, containingFile, cache, perDirectoryCache, loader, getResolutionWithResolvedFileName, reusedNames, logChanges) {
            const path = resolutionHost.toPath(containingFile);
            const resolutionsInFile = cache.get(path) || cache.set(path, ts.createMap()).get(path);
            const dirPath = ts.getDirectoryPath(path);
            let perDirectoryResolution = perDirectoryCache.get(dirPath);
            if (!perDirectoryResolution) {
                perDirectoryResolution = ts.createMap();
                perDirectoryCache.set(dirPath, perDirectoryResolution);
            }
            const resolvedModules = [];
            const compilerOptions = resolutionHost.getCompilationSettings();
            const hasInvalidatedNonRelativeUnresolvedImport = logChanges && isFileWithInvalidatedNonRelativeUnresolvedImports(path);
            const seenNamesInFile = ts.createMap();
            for (const name of names) {
                let resolution = resolutionsInFile.get(name);
                // Resolution is valid if it is present and not invalidated
                if (!seenNamesInFile.has(name) &&
                    allFilesHaveInvalidatedResolution || !resolution || resolution.isInvalidated ||
                    // If the name is unresolved import that was invalidated, recalculate
                    (hasInvalidatedNonRelativeUnresolvedImport && !ts.isExternalModuleNameRelative(name) && !getResolutionWithResolvedFileName(resolution))) {
                    const existingResolution = resolution;
                    const resolutionInDirectory = perDirectoryResolution.get(name);
                    if (resolutionInDirectory) {
                        resolution = resolutionInDirectory;
                    }
                    else {
                        resolution = loader(name, containingFile, compilerOptions, resolutionHost);
                        perDirectoryResolution.set(name, resolution);
                    }
                    resolutionsInFile.set(name, resolution);
                    watchFailedLookupLocationOfResolution(resolution);
                    if (existingResolution) {
                        stopWatchFailedLookupLocationOfResolution(existingResolution);
                    }
                    if (logChanges && filesWithChangedSetOfUnresolvedImports && !resolutionIsEqualTo(existingResolution, resolution)) {
                        filesWithChangedSetOfUnresolvedImports.push(path);
                        // reset log changes to avoid recording the same file multiple times
                        logChanges = false;
                    }
                }
                ts.Debug.assert(resolution !== undefined && !resolution.isInvalidated);
                seenNamesInFile.set(name, true);
                resolvedModules.push(getResolutionWithResolvedFileName(resolution));
            }
            // Stop watching and remove the unused name
            resolutionsInFile.forEach((resolution, name) => {
                if (!seenNamesInFile.has(name) && !ts.contains(reusedNames, name)) {
                    stopWatchFailedLookupLocationOfResolution(resolution);
                    resolutionsInFile.delete(name);
                }
            });
            return resolvedModules;
            function resolutionIsEqualTo(oldResolution, newResolution) {
                if (oldResolution === newResolution) {
                    return true;
                }
                if (!oldResolution || !newResolution) {
                    return false;
                }
                const oldResult = getResolutionWithResolvedFileName(oldResolution);
                const newResult = getResolutionWithResolvedFileName(newResolution);
                if (oldResult === newResult) {
                    return true;
                }
                if (!oldResult || !newResult) {
                    return false;
                }
                return oldResult.resolvedFileName === newResult.resolvedFileName;
            }
        }
        function resolveTypeReferenceDirectives(typeDirectiveNames, containingFile) {
            return resolveNamesWithLocalCache(typeDirectiveNames, containingFile, resolvedTypeReferenceDirectives, perDirectoryResolvedTypeReferenceDirectives, ts.resolveTypeReferenceDirective, getResolvedTypeReferenceDirective, 
            /*reusedNames*/ undefined, /*logChanges*/ false);
        }
        function resolveModuleNames(moduleNames, containingFile, reusedNames) {
            return resolveNamesWithLocalCache(moduleNames, containingFile, resolvedModuleNames, perDirectoryResolvedModuleNames, resolveModuleName, getResolvedModule, reusedNames, logChangesWhenResolvingModule);
        }
        function isNodeModulesDirectory(dirPath) {
            return ts.endsWith(dirPath, "/node_modules");
        }
        function isNodeModulesAtTypesDirectory(dirPath) {
            return ts.endsWith(dirPath, "/node_modules/@types");
        }
        function isDirectoryAtleastAtLevelFromFSRoot(dirPath, minLevels) {
            for (let searchIndex = ts.getRootLength(dirPath); minLevels > 0; minLevels--) {
                searchIndex = dirPath.indexOf(ts.directorySeparator, searchIndex) + 1;
                if (searchIndex === 0) {
                    // Folder isnt at expected minimun levels
                    return false;
                }
            }
            return true;
        }
        function canWatchDirectory(dirPath) {
            return isDirectoryAtleastAtLevelFromFSRoot(dirPath, 
            // When root is "/" do not watch directories like:
            // "/", "/user", "/user/username", "/user/username/folderAtRoot"
            // When root is "c:/" do not watch directories like:
            // "c:/", "c:/folderAtRoot"
            dirPath.charCodeAt(0) === 47 /* slash */ ? 3 : 1);
        }
        function filterFSRootDirectoriesToWatch(watchPath, dirPath) {
            if (!canWatchDirectory(dirPath)) {
                watchPath.ignore = true;
            }
            return watchPath;
        }
        function getDirectoryToWatchFailedLookupLocation(failedLookupLocation, failedLookupLocationPath) {
            if (isInDirectoryPath(rootPath, failedLookupLocationPath)) {
                return { dir: rootDir, dirPath: rootPath };
            }
            return getDirectoryToWatchFromFailedLookupLocationDirectory(ts.getDirectoryPath(ts.getNormalizedAbsolutePath(failedLookupLocation, getCurrentDirectory())), ts.getDirectoryPath(failedLookupLocationPath));
        }
        function getDirectoryToWatchFromFailedLookupLocationDirectory(dir, dirPath) {
            // If directory path contains node module, get the most parent node_modules directory for watching
            while (ts.stringContains(dirPath, "/node_modules/")) {
                dir = ts.getDirectoryPath(dir);
                dirPath = ts.getDirectoryPath(dirPath);
            }
            // If the directory is node_modules use it to watch
            if (isNodeModulesDirectory(dirPath)) {
                return filterFSRootDirectoriesToWatch({ dir, dirPath }, ts.getDirectoryPath(dirPath));
            }
            // Use some ancestor of the root directory
            if (rootPath !== undefined) {
                while (!isInDirectoryPath(dirPath, rootPath)) {
                    const parentPath = ts.getDirectoryPath(dirPath);
                    if (parentPath === dirPath) {
                        break;
                    }
                    dirPath = parentPath;
                    dir = ts.getDirectoryPath(dir);
                }
            }
            return filterFSRootDirectoriesToWatch({ dir, dirPath }, dirPath);
        }
        function isPathWithDefaultFailedLookupExtension(path) {
            return ts.fileExtensionIsOneOf(path, failedLookupDefaultExtensions);
        }
        function watchFailedLookupLocationOfResolution(resolution) {
            // No need to set the resolution refCount
            if (!resolution.failedLookupLocations || !resolution.failedLookupLocations.length) {
                return;
            }
            if (resolution.refCount !== undefined) {
                resolution.refCount++;
                return;
            }
            resolution.refCount = 1;
            const { failedLookupLocations } = resolution;
            let setAtRoot = false;
            for (const failedLookupLocation of failedLookupLocations) {
                const failedLookupLocationPath = resolutionHost.toPath(failedLookupLocation);
                const { dir, dirPath, ignore } = getDirectoryToWatchFailedLookupLocation(failedLookupLocation, failedLookupLocationPath);
                if (!ignore) {
                    // If the failed lookup location path is not one of the supported extensions,
                    // store it in the custom path
                    if (!isPathWithDefaultFailedLookupExtension(failedLookupLocationPath)) {
                        const refCount = customFailedLookupPaths.get(failedLookupLocationPath) || 0;
                        customFailedLookupPaths.set(failedLookupLocationPath, refCount + 1);
                    }
                    if (dirPath === rootPath) {
                        setAtRoot = true;
                    }
                    else {
                        setDirectoryWatcher(dir, dirPath);
                    }
                }
            }
            if (setAtRoot) {
                setDirectoryWatcher(rootDir, rootPath);
            }
        }
        function setDirectoryWatcher(dir, dirPath) {
            const dirWatcher = directoryWatchesOfFailedLookups.get(dirPath);
            if (dirWatcher) {
                dirWatcher.refCount++;
            }
            else {
                directoryWatchesOfFailedLookups.set(dirPath, { watcher: createDirectoryWatcher(dir, dirPath), refCount: 1 });
            }
        }
        function stopWatchFailedLookupLocationOfResolution(resolution) {
            if (!resolution.failedLookupLocations || !resolution.failedLookupLocations.length) {
                return;
            }
            resolution.refCount--;
            if (resolution.refCount) {
                return;
            }
            const { failedLookupLocations } = resolution;
            let removeAtRoot = false;
            for (const failedLookupLocation of failedLookupLocations) {
                const failedLookupLocationPath = resolutionHost.toPath(failedLookupLocation);
                const { dirPath, ignore } = getDirectoryToWatchFailedLookupLocation(failedLookupLocation, failedLookupLocationPath);
                if (!ignore) {
                    const refCount = customFailedLookupPaths.get(failedLookupLocationPath);
                    if (refCount) {
                        if (refCount === 1) {
                            customFailedLookupPaths.delete(failedLookupLocationPath);
                        }
                        else {
                            ts.Debug.assert(refCount > 1);
                            customFailedLookupPaths.set(failedLookupLocationPath, refCount - 1);
                        }
                    }
                    if (dirPath === rootPath) {
                        removeAtRoot = true;
                    }
                    else {
                        removeDirectoryWatcher(dirPath);
                    }
                }
            }
            if (removeAtRoot) {
                removeDirectoryWatcher(rootPath);
            }
        }
        function removeDirectoryWatcher(dirPath) {
            const dirWatcher = directoryWatchesOfFailedLookups.get(dirPath);
            // Do not close the watcher yet since it might be needed by other failed lookup locations.
            dirWatcher.refCount--;
        }
        function createDirectoryWatcher(directory, dirPath) {
            return resolutionHost.watchDirectoryOfFailedLookupLocation(directory, fileOrDirectory => {
                const fileOrDirectoryPath = resolutionHost.toPath(fileOrDirectory);
                if (cachedDirectoryStructureHost) {
                    // Since the file existance changed, update the sourceFiles cache
                    cachedDirectoryStructureHost.addOrDeleteFileOrDirectory(fileOrDirectory, fileOrDirectoryPath);
                }
                // If the files are added to project root or node_modules directory, always run through the invalidation process
                // Otherwise run through invalidation only if adding to the immediate directory
                if (!allFilesHaveInvalidatedResolution &&
                    dirPath === rootPath || isNodeModulesDirectory(dirPath) || ts.getDirectoryPath(fileOrDirectoryPath) === dirPath) {
                    if (invalidateResolutionOfFailedLookupLocation(fileOrDirectoryPath, dirPath === fileOrDirectoryPath)) {
                        resolutionHost.onInvalidatedResolution();
                    }
                }
            }, ts.WatchDirectoryFlags.Recursive);
        }
        function removeResolutionsOfFileFromCache(cache, filePath) {
            // Deleted file, stop watching failed lookups for all the resolutions in the file
            const resolutions = cache.get(filePath);
            if (resolutions) {
                resolutions.forEach(stopWatchFailedLookupLocationOfResolution);
                cache.delete(filePath);
            }
        }
        function removeResolutionsOfFile(filePath) {
            removeResolutionsOfFileFromCache(resolvedModuleNames, filePath);
            removeResolutionsOfFileFromCache(resolvedTypeReferenceDirectives, filePath);
        }
        function invalidateResolutionCache(cache, isInvalidatedResolution, getResolutionWithResolvedFileName) {
            const seen = ts.createMap();
            cache.forEach((resolutions, containingFilePath) => {
                const dirPath = ts.getDirectoryPath(containingFilePath);
                let seenInDir = seen.get(dirPath);
                if (!seenInDir) {
                    seenInDir = ts.createMap();
                    seen.set(dirPath, seenInDir);
                }
                resolutions.forEach((resolution, name) => {
                    if (seenInDir.has(name)) {
                        return;
                    }
                    seenInDir.set(name, true);
                    if (!resolution.isInvalidated && isInvalidatedResolution(resolution, getResolutionWithResolvedFileName)) {
                        // Mark the file as needing re-evaluation of module resolution instead of using it blindly.
                        resolution.isInvalidated = true;
                        (filesWithInvalidatedResolutions || (filesWithInvalidatedResolutions = ts.createMap())).set(containingFilePath, true);
                    }
                });
            });
        }
        function hasReachedResolutionIterationLimit() {
            const maxSize = resolutionHost.maxNumberOfFilesToIterateForInvalidation || ts.maxNumberOfFilesToIterateForInvalidation;
            return resolvedModuleNames.size > maxSize || resolvedTypeReferenceDirectives.size > maxSize;
        }
        function invalidateResolutions(isInvalidatedResolution) {
            // If more than maxNumberOfFilesToIterateForInvalidation present,
            // just invalidated all files and recalculate the resolutions for files instead
            if (hasReachedResolutionIterationLimit()) {
                allFilesHaveInvalidatedResolution = true;
                return;
            }
            invalidateResolutionCache(resolvedModuleNames, isInvalidatedResolution, getResolvedModule);
            invalidateResolutionCache(resolvedTypeReferenceDirectives, isInvalidatedResolution, getResolvedTypeReferenceDirective);
        }
        function invalidateResolutionOfFile(filePath) {
            removeResolutionsOfFile(filePath);
            invalidateResolutions(
            // Resolution is invalidated if the resulting file name is same as the deleted file path
            (resolution, getResolutionWithResolvedFileName) => {
                const result = getResolutionWithResolvedFileName(resolution);
                return result && resolutionHost.toPath(result.resolvedFileName) === filePath;
            });
        }
        function setFilesWithInvalidatedNonRelativeUnresolvedImports(filesMap) {
            ts.Debug.assert(filesWithInvalidatedNonRelativeUnresolvedImports === filesMap || filesWithInvalidatedNonRelativeUnresolvedImports === undefined);
            filesWithInvalidatedNonRelativeUnresolvedImports = filesMap;
        }
        function invalidateResolutionOfFailedLookupLocation(fileOrDirectoryPath, isCreatingWatchedDirectory) {
            let isChangedFailedLookupLocation;
            if (isCreatingWatchedDirectory) {
                // Watching directory is created
                // Invalidate any resolution has failed lookup in this directory
                isChangedFailedLookupLocation = location => isInDirectoryPath(fileOrDirectoryPath, resolutionHost.toPath(location));
            }
            else {
                // Some file or directory in the watching directory is created
                // Return early if it does not have any of the watching extension or not the custom failed lookup path
                const dirOfFileOrDirectory = ts.getDirectoryPath(fileOrDirectoryPath);
                if (isNodeModulesAtTypesDirectory(fileOrDirectoryPath) || isNodeModulesDirectory(fileOrDirectoryPath) ||
                    isNodeModulesAtTypesDirectory(dirOfFileOrDirectory) || isNodeModulesDirectory(dirOfFileOrDirectory)) {
                    // Invalidate any resolution from this directory
                    isChangedFailedLookupLocation = location => {
                        const locationPath = resolutionHost.toPath(location);
                        return locationPath === fileOrDirectoryPath || ts.startsWith(resolutionHost.toPath(location), fileOrDirectoryPath);
                    };
                }
                else {
                    if (!isPathWithDefaultFailedLookupExtension(fileOrDirectoryPath) && !customFailedLookupPaths.has(fileOrDirectoryPath)) {
                        return false;
                    }
                    // Ignore emits from the program
                    if (ts.isEmittedFileOfProgram(resolutionHost.getCurrentProgram(), fileOrDirectoryPath)) {
                        return false;
                    }
                    // Resolution need to be invalidated if failed lookup location is same as the file or directory getting created
                    isChangedFailedLookupLocation = location => resolutionHost.toPath(location) === fileOrDirectoryPath;
                }
            }
            const hasChangedFailedLookupLocation = (resolution) => ts.some(resolution.failedLookupLocations, isChangedFailedLookupLocation);
            const invalidatedFilesCount = filesWithInvalidatedResolutions && filesWithInvalidatedResolutions.size;
            invalidateResolutions(
            // Resolution is invalidated if the resulting file name is same as the deleted file path
            hasChangedFailedLookupLocation);
            return allFilesHaveInvalidatedResolution || filesWithInvalidatedResolutions && filesWithInvalidatedResolutions.size !== invalidatedFilesCount;
        }
        function closeTypeRootsWatch() {
            ts.clearMap(typeRootsWatches, ts.closeFileWatcher);
        }
        function getDirectoryToWatchFailedLookupLocationFromTypeRoot(typeRoot, typeRootPath) {
            if (allFilesHaveInvalidatedResolution) {
                return undefined;
            }
            if (isInDirectoryPath(rootPath, typeRootPath)) {
                return rootPath;
            }
            const { dirPath, ignore } = getDirectoryToWatchFromFailedLookupLocationDirectory(typeRoot, typeRootPath);
            return !ignore && directoryWatchesOfFailedLookups.has(dirPath) && dirPath;
        }
        function createTypeRootsWatch(typeRootPath, typeRoot) {
            // Create new watch and recursive info
            return resolutionHost.watchTypeRootsDirectory(typeRoot, fileOrDirectory => {
                const fileOrDirectoryPath = resolutionHost.toPath(fileOrDirectory);
                if (cachedDirectoryStructureHost) {
                    // Since the file existance changed, update the sourceFiles cache
                    cachedDirectoryStructureHost.addOrDeleteFileOrDirectory(fileOrDirectory, fileOrDirectoryPath);
                }
                // For now just recompile
                // We could potentially store more data here about whether it was/would be really be used or not
                // and with that determine to trigger compilation but for now this is enough
                resolutionHost.onChangedAutomaticTypeDirectiveNames();
                // Since directory watchers invoked are flaky, the failed lookup location events might not be triggered
                // So handle to failed lookup locations here as well to ensure we are invalidating resolutions
                const dirPath = getDirectoryToWatchFailedLookupLocationFromTypeRoot(typeRoot, typeRootPath);
                if (dirPath && invalidateResolutionOfFailedLookupLocation(fileOrDirectoryPath, dirPath === fileOrDirectoryPath)) {
                    resolutionHost.onInvalidatedResolution();
                }
            }, ts.WatchDirectoryFlags.Recursive);
        }
        /**
         * Watches the types that would get added as part of getAutomaticTypeDirectiveNames
         * To be called when compiler options change
         */
        function updateTypeRootsWatch() {
            const options = resolutionHost.getCompilationSettings();
            if (options.types) {
                // No need to do any watch since resolution cache is going to handle the failed lookups
                // for the types added by this
                closeTypeRootsWatch();
                return;
            }
            // we need to assume the directories exist to ensure that we can get all the type root directories that get included
            // But filter directories that are at root level to say directory doesnt exist, so that we arent watching them
            const typeRoots = ts.getEffectiveTypeRoots(options, { directoryExists: directoryExistsForTypeRootWatch, getCurrentDirectory });
            if (typeRoots) {
                ts.mutateMap(typeRootsWatches, ts.arrayToMap(typeRoots, tr => resolutionHost.toPath(tr)), {
                    createNewValue: createTypeRootsWatch,
                    onDeleteValue: ts.closeFileWatcher
                });
            }
            else {
                closeTypeRootsWatch();
            }
        }
        /**
         * Use this function to return if directory exists to get type roots to watch
         * If we return directory exists then only the paths will be added to type roots
         * Hence return true for all directories except root directories which are filtered from watching
         */
        function directoryExistsForTypeRootWatch(nodeTypesDirectory) {
            const dir = ts.getDirectoryPath(ts.getDirectoryPath(nodeTypesDirectory));
            const dirPath = resolutionHost.toPath(dir);
            return dirPath === rootPath || canWatchDirectory(dirPath);
        }
    }
    ts.createResolutionCache = createResolutionCache;
})(ts || (ts = {}));
