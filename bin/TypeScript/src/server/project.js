var ts;
(function (ts) {
    var server;
    (function (server) {
        let ProjectKind;
        (function (ProjectKind) {
            ProjectKind[ProjectKind["Inferred"] = 0] = "Inferred";
            ProjectKind[ProjectKind["Configured"] = 1] = "Configured";
            ProjectKind[ProjectKind["External"] = 2] = "External";
        })(ProjectKind = server.ProjectKind || (server.ProjectKind = {}));
        /* @internal */
        function countEachFileTypes(infos) {
            const result = { js: 0, jsx: 0, ts: 0, tsx: 0, dts: 0 };
            for (const info of infos) {
                switch (info.scriptKind) {
                    case ts.ScriptKind.JS:
                        result.js += 1;
                        break;
                    case ts.ScriptKind.JSX:
                        result.jsx += 1;
                        break;
                    case ts.ScriptKind.TS:
                        ts.fileExtensionIs(info.fileName, ts.Extension.Dts)
                            ? result.dts += 1
                            : result.ts += 1;
                        break;
                    case ts.ScriptKind.TSX:
                        result.tsx += 1;
                        break;
                }
            }
            return result;
        }
        server.countEachFileTypes = countEachFileTypes;
        function hasOneOrMoreJsAndNoTsFiles(project) {
            const counts = countEachFileTypes(project.getScriptInfos());
            return counts.js > 0 && counts.ts === 0 && counts.tsx === 0;
        }
        function allRootFilesAreJsOrDts(project) {
            const counts = countEachFileTypes(project.getRootScriptInfos());
            return counts.ts === 0 && counts.tsx === 0;
        }
        server.allRootFilesAreJsOrDts = allRootFilesAreJsOrDts;
        function allFilesAreJsOrDts(project) {
            const counts = countEachFileTypes(project.getScriptInfos());
            return counts.ts === 0 && counts.tsx === 0;
        }
        server.allFilesAreJsOrDts = allFilesAreJsOrDts;
        /* @internal */
        function hasNoTypeScriptSource(fileNames) {
            return !fileNames.some(fileName => (ts.fileExtensionIs(fileName, ts.Extension.Ts) && !ts.fileExtensionIs(fileName, ts.Extension.Dts)) || ts.fileExtensionIs(fileName, ts.Extension.Tsx));
        }
        server.hasNoTypeScriptSource = hasNoTypeScriptSource;
        /* @internal */
        function isScriptInfo(value) {
            return value instanceof server.ScriptInfo;
        }
        server.isScriptInfo = isScriptInfo;
        class Project {
            /*@internal*/
            constructor(
            /*@internal*/ projectName, projectKind, projectService, documentRegistry, hasExplicitListOfFiles, lastFileExceededProgramSize, compilerOptions, compileOnSaveEnabled, directoryStructureHost, currentDirectory) {
                this.projectName = projectName;
                this.projectKind = projectKind;
                this.projectService = projectService;
                this.documentRegistry = documentRegistry;
                this.compilerOptions = compilerOptions;
                this.compileOnSaveEnabled = compileOnSaveEnabled;
                this.rootFiles = [];
                this.rootFilesMap = ts.createMap();
                this.plugins = [];
                /*@internal*/
                /**
                 * This is map from files to unresolved imports in it
                 * Maop does not contain entries for files that do not have unresolved imports
                 * This helps in containing the set of files to invalidate
                 */
                this.cachedUnresolvedImportsPerFile = ts.createMap();
                /*@internal*/
                this.hasAddedorRemovedFiles = false;
                /**
                 * Last version that was reported.
                 */
                this.lastReportedVersion = 0;
                /**
                 * Current project's program version. (incremented everytime new program is created that is not complete reuse from the old one)
                 * This property is changed in 'updateGraph' based on the set of files in program
                 */
                this.projectProgramVersion = 0;
                /**
                 * Current version of the project state. It is changed when:
                 * - new root file was added/removed
                 * - edit happen in some file that is currently included in the project.
                 * This property is different from projectStructureVersion since in most cases edits don't affect set of files in the project
                 */
                this.projectStateVersion = 0;
                /*@internal*/
                this.dirty = false;
                /*@internal*/
                this.hasChangedAutomaticTypeDirectiveNames = false;
                /*@internal*/
                this.typingFiles = server.emptyArray;
                this.directoryStructureHost = directoryStructureHost;
                this.currentDirectory = this.projectService.getNormalizedAbsolutePath(currentDirectory || "");
                this.getCanonicalFileName = this.projectService.toCanonicalFileName;
                this.cancellationToken = new ts.ThrottledCancellationToken(this.projectService.cancellationToken, this.projectService.throttleWaitMilliseconds);
                if (!this.compilerOptions) {
                    this.compilerOptions = ts.getDefaultCompilerOptions();
                    this.compilerOptions.allowNonTsExtensions = true;
                    this.compilerOptions.allowJs = true;
                }
                else if (hasExplicitListOfFiles || this.compilerOptions.allowJs) {
                    // If files are listed explicitly or allowJs is specified, allow all extensions
                    this.compilerOptions.allowNonTsExtensions = true;
                }
                this.languageServiceEnabled = !projectService.syntaxOnly;
                this.setInternalCompilerOptionsForEmittingJsFiles();
                const host = this.projectService.host;
                if (this.projectService.logger.loggingEnabled()) {
                    this.trace = s => this.writeLog(s);
                }
                else if (host.trace) {
                    this.trace = s => host.trace(s);
                }
                if (host.realpath) {
                    this.realpath = path => host.realpath(path);
                }
                // Use the current directory as resolution root only if the project created using current directory string
                this.resolutionCache = ts.createResolutionCache(this, currentDirectory && this.currentDirectory, /*logChangesWhenResolvingModule*/ true);
                this.languageService = ts.createLanguageService(this, this.documentRegistry, projectService.syntaxOnly);
                if (lastFileExceededProgramSize) {
                    this.disableLanguageService(lastFileExceededProgramSize);
                }
                this.markAsDirty();
                this.projectService.pendingEnsureProjectForOpenFiles = true;
            }
            isNonTsProject() {
                this.updateGraph();
                return allFilesAreJsOrDts(this);
            }
            isJsOnlyProject() {
                this.updateGraph();
                return hasOneOrMoreJsAndNoTsFiles(this);
            }
            static resolveModule(moduleName, initialDir, host, log) {
                const resolvedPath = ts.normalizeSlashes(host.resolvePath(ts.combinePaths(initialDir, "node_modules")));
                log(`Loading ${moduleName} from ${initialDir} (resolved to ${resolvedPath})`);
                const result = host.require(resolvedPath, moduleName);
                if (result.error) {
                    const err = result.error.stack || result.error.message || JSON.stringify(result.error);
                    log(`Failed to load module '${moduleName}': ${err}`);
                    return undefined;
                }
                return result.module;
            }
            isKnownTypesPackageName(name) {
                return this.typingsCache.isKnownTypesPackageName(name);
            }
            installPackage(options) {
                return this.typingsCache.installPackage(Object.assign({}, options, { projectName: this.projectName, projectRootPath: this.toPath(this.currentDirectory) }));
            }
            get typingsCache() {
                return this.projectService.typingsCache;
            }
            // Method of LanguageServiceHost
            getCompilationSettings() {
                return this.compilerOptions;
            }
            // Method to support public API
            getCompilerOptions() {
                return this.getCompilationSettings();
            }
            getNewLine() {
                return this.projectService.host.newLine;
            }
            getProjectVersion() {
                return this.projectStateVersion.toString();
            }
            getScriptFileNames() {
                if (!this.rootFiles) {
                    return ts.emptyArray;
                }
                let result;
                this.rootFilesMap.forEach(value => {
                    if (this.languageServiceEnabled || (isScriptInfo(value) && value.isScriptOpen())) {
                        // if language service is disabled - process only files that are open
                        (result || (result = [])).push(isScriptInfo(value) ? value.fileName : value);
                    }
                });
                return ts.addRange(result, this.typingFiles) || ts.emptyArray;
            }
            getOrCreateScriptInfoAndAttachToProject(fileName) {
                const scriptInfo = this.projectService.getOrCreateScriptInfoNotOpenedByClient(fileName, this.currentDirectory, this.directoryStructureHost);
                if (scriptInfo) {
                    const existingValue = this.rootFilesMap.get(scriptInfo.path);
                    if (existingValue !== scriptInfo && existingValue !== undefined) {
                        // This was missing path earlier but now the file exists. Update the root
                        this.rootFiles.push(scriptInfo);
                        this.rootFilesMap.set(scriptInfo.path, scriptInfo);
                    }
                    scriptInfo.attachToProject(this);
                }
                return scriptInfo;
            }
            getScriptKind(fileName) {
                const info = this.getOrCreateScriptInfoAndAttachToProject(fileName);
                return info && info.scriptKind;
            }
            getScriptVersion(filename) {
                const info = this.getOrCreateScriptInfoAndAttachToProject(filename);
                return info && info.getLatestVersion();
            }
            getScriptSnapshot(filename) {
                const scriptInfo = this.getOrCreateScriptInfoAndAttachToProject(filename);
                if (scriptInfo) {
                    return scriptInfo.getSnapshot();
                }
            }
            getCancellationToken() {
                return this.cancellationToken;
            }
            getCurrentDirectory() {
                return this.currentDirectory;
            }
            getDefaultLibFileName() {
                const nodeModuleBinDir = ts.getDirectoryPath(ts.normalizePath(this.projectService.getExecutingFilePath()));
                return ts.combinePaths(nodeModuleBinDir, ts.getDefaultLibFileName(this.compilerOptions));
            }
            useCaseSensitiveFileNames() {
                return this.projectService.host.useCaseSensitiveFileNames;
            }
            readDirectory(path, extensions, exclude, include, depth) {
                return this.directoryStructureHost.readDirectory(path, extensions, exclude, include, depth);
            }
            readFile(fileName) {
                return this.projectService.host.readFile(fileName);
            }
            fileExists(file) {
                // As an optimization, don't hit the disks for files we already know don't exist
                // (because we're watching for their creation).
                const path = this.toPath(file);
                return !this.isWatchedMissingFile(path) && this.directoryStructureHost.fileExists(file);
            }
            resolveModuleNames(moduleNames, containingFile, reusedNames) {
                return this.resolutionCache.resolveModuleNames(moduleNames, containingFile, reusedNames);
            }
            resolveTypeReferenceDirectives(typeDirectiveNames, containingFile) {
                return this.resolutionCache.resolveTypeReferenceDirectives(typeDirectiveNames, containingFile);
            }
            directoryExists(path) {
                return this.directoryStructureHost.directoryExists(path);
            }
            getDirectories(path) {
                return this.directoryStructureHost.getDirectories(path);
            }
            /*@internal*/
            getCachedDirectoryStructureHost() {
                return undefined;
            }
            /*@internal*/
            toPath(fileName) {
                return ts.toPath(fileName, this.currentDirectory, this.projectService.toCanonicalFileName);
            }
            /*@internal*/
            watchDirectoryOfFailedLookupLocation(directory, cb, flags) {
                return this.projectService.watchFactory.watchDirectory(this.projectService.host, directory, cb, flags, "Directory of Failed lookup locations in module resolution" /* FailedLookupLocation */, this);
            }
            /*@internal*/
            onInvalidatedResolution() {
                this.projectService.delayUpdateProjectGraphAndEnsureProjectStructureForOpenFiles(this);
            }
            /*@internal*/
            watchTypeRootsDirectory(directory, cb, flags) {
                return this.projectService.watchFactory.watchDirectory(this.projectService.host, directory, cb, flags, "Type root directory" /* TypeRoots */, this);
            }
            /*@internal*/
            onChangedAutomaticTypeDirectiveNames() {
                this.hasChangedAutomaticTypeDirectiveNames = true;
                this.projectService.delayUpdateProjectGraphAndEnsureProjectStructureForOpenFiles(this);
            }
            /*@internal*/
            getGlobalCache() {
                return this.getTypeAcquisition().enable ? this.projectService.typingsInstaller.globalTypingsCacheLocation : undefined;
            }
            /*@internal*/
            writeLog(s) {
                this.projectService.logger.info(s);
            }
            log(s) {
                this.writeLog(s);
            }
            error(s) {
                this.projectService.logger.msg(s, server.Msg.Err);
            }
            setInternalCompilerOptionsForEmittingJsFiles() {
                if (this.projectKind === ProjectKind.Inferred || this.projectKind === ProjectKind.External) {
                    this.compilerOptions.noEmitForJsFiles = true;
                }
            }
            /**
             * Get the errors that dont have any file name associated
             */
            getGlobalProjectErrors() {
                return server.emptyArray;
            }
            getAllProjectErrors() {
                return server.emptyArray;
            }
            getLanguageService(ensureSynchronized = true) {
                if (ensureSynchronized) {
                    this.updateGraph();
                }
                return this.languageService;
            }
            shouldEmitFile(scriptInfo) {
                return scriptInfo && !scriptInfo.isDynamicOrHasMixedContent();
            }
            getCompileOnSaveAffectedFileList(scriptInfo) {
                if (!this.languageServiceEnabled) {
                    return [];
                }
                this.updateGraph();
                this.builderState = ts.BuilderState.create(this.program, this.projectService.toCanonicalFileName, this.builderState);
                return ts.mapDefined(ts.BuilderState.getFilesAffectedBy(this.builderState, this.program, scriptInfo.path, this.cancellationToken, data => this.projectService.host.createHash(data)), sourceFile => this.shouldEmitFile(this.projectService.getScriptInfoForPath(sourceFile.path)) ? sourceFile.fileName : undefined);
            }
            /**
             * Returns true if emit was conducted
             */
            emitFile(scriptInfo, writeFile) {
                if (!this.languageServiceEnabled || !this.shouldEmitFile(scriptInfo)) {
                    return false;
                }
                const { emitSkipped, outputFiles } = this.getLanguageService(/*ensureSynchronized*/ false).getEmitOutput(scriptInfo.fileName);
                if (!emitSkipped) {
                    for (const outputFile of outputFiles) {
                        const outputFileAbsoluteFileName = ts.getNormalizedAbsolutePath(outputFile.name, this.currentDirectory);
                        writeFile(outputFileAbsoluteFileName, outputFile.text, outputFile.writeByteOrderMark);
                    }
                }
                return !emitSkipped;
            }
            enableLanguageService() {
                if (this.languageServiceEnabled || this.projectService.syntaxOnly) {
                    return;
                }
                this.languageServiceEnabled = true;
                this.lastFileExceededProgramSize = undefined;
                this.projectService.onUpdateLanguageServiceStateForProject(this, /*languageServiceEnabled*/ true);
            }
            disableLanguageService(lastFileExceededProgramSize) {
                if (!this.languageServiceEnabled) {
                    return;
                }
                ts.Debug.assert(!this.projectService.syntaxOnly);
                this.languageService.cleanupSemanticCache();
                this.languageServiceEnabled = false;
                this.lastFileExceededProgramSize = lastFileExceededProgramSize;
                this.builderState = undefined;
                this.resolutionCache.closeTypeRootsWatch();
                this.projectService.onUpdateLanguageServiceStateForProject(this, /*languageServiceEnabled*/ false);
            }
            getProjectName() {
                return this.projectName;
            }
            removeLocalTypingsFromTypeAcquisition(newTypeAcquisition) {
                if (!newTypeAcquisition || !newTypeAcquisition.include) {
                    // Nothing to filter out, so just return as-is
                    return newTypeAcquisition;
                }
                return Object.assign({}, newTypeAcquisition, { include: this.removeExistingTypings(newTypeAcquisition.include) });
            }
            getExternalFiles() {
                return server.toSortedArray(ts.flatMap(this.plugins, plugin => {
                    if (typeof plugin.getExternalFiles !== "function")
                        return;
                    try {
                        return plugin.getExternalFiles(this);
                    }
                    catch (e) {
                        this.projectService.logger.info(`A plugin threw an exception in getExternalFiles: ${e}`);
                        if (e.stack) {
                            this.projectService.logger.info(e.stack);
                        }
                    }
                }));
            }
            getSourceFile(path) {
                if (!this.program) {
                    return undefined;
                }
                return this.program.getSourceFileByPath(path);
            }
            close() {
                if (this.program) {
                    // if we have a program - release all files that are enlisted in program but arent root
                    // The releasing of the roots happens later
                    // The project could have pending update remaining and hence the info could be in the files but not in program graph
                    for (const f of this.program.getSourceFiles()) {
                        this.detachScriptInfoIfNotRoot(f.fileName);
                    }
                }
                // Release external files
                ts.forEach(this.externalFiles, externalFile => this.detachScriptInfoIfNotRoot(externalFile));
                // Always remove root files from the project
                for (const root of this.rootFiles) {
                    root.detachFromProject(this);
                }
                this.projectService.pendingEnsureProjectForOpenFiles = true;
                this.rootFiles = undefined;
                this.rootFilesMap = undefined;
                this.externalFiles = undefined;
                this.program = undefined;
                this.builderState = undefined;
                this.resolutionCache.clear();
                this.resolutionCache = undefined;
                this.cachedUnresolvedImportsPerFile = undefined;
                this.directoryStructureHost = undefined;
                // Clean up file watchers waiting for missing files
                if (this.missingFilesMap) {
                    ts.clearMap(this.missingFilesMap, ts.closeFileWatcher);
                    this.missingFilesMap = undefined;
                }
                // signal language service to release source files acquired from document registry
                this.languageService.dispose();
                this.languageService = undefined;
            }
            detachScriptInfoIfNotRoot(uncheckedFilename) {
                const info = this.projectService.getScriptInfo(uncheckedFilename);
                // We might not find the script info in case its not associated with the project any more
                // and project graph was not updated (eg delayed update graph in case of files changed/deleted on the disk)
                if (info && !this.isRoot(info)) {
                    info.detachFromProject(this);
                }
            }
            isClosed() {
                return this.rootFiles === undefined;
            }
            hasRoots() {
                return this.rootFiles && this.rootFiles.length > 0;
            }
            getRootFiles() {
                return this.rootFiles && this.rootFiles.map(info => info.fileName);
            }
            /*@internal*/
            getRootFilesMap() {
                return this.rootFilesMap;
            }
            getRootScriptInfos() {
                return this.rootFiles;
            }
            getScriptInfos() {
                if (!this.languageServiceEnabled) {
                    // if language service is not enabled - return just root files
                    return this.rootFiles;
                }
                return ts.map(this.program.getSourceFiles(), sourceFile => {
                    const scriptInfo = this.projectService.getScriptInfoForPath(sourceFile.path);
                    if (!scriptInfo) {
                        ts.Debug.fail(`scriptInfo for a file '${sourceFile.fileName}' Path: '${sourceFile.path}' is missing.`);
                    }
                    return scriptInfo;
                });
            }
            getExcludedFiles() {
                return server.emptyArray;
            }
            getFileNames(excludeFilesFromExternalLibraries, excludeConfigFiles) {
                if (!this.program) {
                    return [];
                }
                if (!this.languageServiceEnabled) {
                    // if language service is disabled assume that all files in program are root files + default library
                    let rootFiles = this.getRootFiles();
                    if (this.compilerOptions) {
                        const defaultLibrary = ts.getDefaultLibFilePath(this.compilerOptions);
                        if (defaultLibrary) {
                            (rootFiles || (rootFiles = [])).push(server.asNormalizedPath(defaultLibrary));
                        }
                    }
                    return rootFiles;
                }
                const result = [];
                for (const f of this.program.getSourceFiles()) {
                    if (excludeFilesFromExternalLibraries && this.program.isSourceFileFromExternalLibrary(f)) {
                        continue;
                    }
                    result.push(server.asNormalizedPath(f.fileName));
                }
                if (!excludeConfigFiles) {
                    const configFile = this.program.getCompilerOptions().configFile;
                    if (configFile) {
                        result.push(server.asNormalizedPath(configFile.fileName));
                        if (configFile.extendedSourceFiles) {
                            for (const f of configFile.extendedSourceFiles) {
                                result.push(server.asNormalizedPath(f));
                            }
                        }
                    }
                }
                return result;
            }
            hasConfigFile(configFilePath) {
                if (this.program && this.languageServiceEnabled) {
                    const configFile = this.program.getCompilerOptions().configFile;
                    if (configFile) {
                        if (configFilePath === server.asNormalizedPath(configFile.fileName)) {
                            return true;
                        }
                        if (configFile.extendedSourceFiles) {
                            for (const f of configFile.extendedSourceFiles) {
                                if (configFilePath === server.asNormalizedPath(f)) {
                                    return true;
                                }
                            }
                        }
                    }
                }
                return false;
            }
            containsScriptInfo(info) {
                return this.isRoot(info) || (this.program && this.program.getSourceFileByPath(info.path) !== undefined);
            }
            containsFile(filename, requireOpen) {
                const info = this.projectService.getScriptInfoForPath(this.toPath(filename));
                if (info && (info.isScriptOpen() || !requireOpen)) {
                    return this.containsScriptInfo(info);
                }
            }
            isRoot(info) {
                return this.rootFilesMap && this.rootFilesMap.get(info.path) === info;
            }
            // add a root file to project
            addRoot(info) {
                ts.Debug.assert(!this.isRoot(info));
                this.rootFiles.push(info);
                this.rootFilesMap.set(info.path, info);
                info.attachToProject(this);
                this.markAsDirty();
            }
            // add a root file that doesnt exist on host
            addMissingFileRoot(fileName) {
                const path = this.projectService.toPath(fileName);
                this.rootFilesMap.set(path, fileName);
                this.markAsDirty();
            }
            removeFile(info, fileExists, detachFromProject) {
                if (this.isRoot(info)) {
                    this.removeRoot(info);
                }
                if (fileExists) {
                    // If file is present, just remove the resolutions for the file
                    this.resolutionCache.removeResolutionsOfFile(info.path);
                }
                else {
                    this.resolutionCache.invalidateResolutionOfFile(info.path);
                }
                this.cachedUnresolvedImportsPerFile.delete(info.path);
                if (detachFromProject) {
                    info.detachFromProject(this);
                }
                this.markAsDirty();
            }
            registerFileUpdate(fileName) {
                (this.updatedFileNames || (this.updatedFileNames = ts.createMap())).set(fileName, true);
            }
            markAsDirty() {
                if (!this.dirty) {
                    this.projectStateVersion++;
                    this.dirty = true;
                }
            }
            /* @internal */
            extractUnresolvedImportsFromSourceFile(file, ambientModules) {
                const cached = this.cachedUnresolvedImportsPerFile.get(file.path);
                if (cached) {
                    // found cached result, return
                    return cached;
                }
                let unresolvedImports;
                if (file.resolvedModules) {
                    file.resolvedModules.forEach((resolvedModule, name) => {
                        // pick unresolved non-relative names
                        if (!resolvedModule && !ts.isExternalModuleNameRelative(name) && !isAmbientlyDeclaredModule(name)) {
                            // for non-scoped names extract part up-to the first slash
                            // for scoped names - extract up to the second slash
                            let trimmed = name.trim();
                            let i = trimmed.indexOf("/");
                            if (i !== -1 && trimmed.charCodeAt(0) === 64 /* at */) {
                                i = trimmed.indexOf("/", i + 1);
                            }
                            if (i !== -1) {
                                trimmed = trimmed.substr(0, i);
                            }
                            (unresolvedImports || (unresolvedImports = [])).push(trimmed);
                        }
                    });
                }
                this.cachedUnresolvedImportsPerFile.set(file.path, unresolvedImports || server.emptyArray);
                return unresolvedImports || server.emptyArray;
                function isAmbientlyDeclaredModule(name) {
                    return ambientModules.some(m => m === name);
                }
            }
            /* @internal */
            onFileAddedOrRemoved() {
                this.hasAddedorRemovedFiles = true;
            }
            /**
             * Updates set of files that contribute to this project
             * @returns: true if set of files in the project stays the same and false - otherwise.
             */
            updateGraph() {
                this.resolutionCache.startRecordingFilesWithChangedResolutions();
                const hasNewProgram = this.updateGraphWorker();
                const hasAddedorRemovedFiles = this.hasAddedorRemovedFiles;
                this.hasAddedorRemovedFiles = false;
                const changedFiles = this.resolutionCache.finishRecordingFilesWithChangedResolutions() || server.emptyArray;
                for (const file of changedFiles) {
                    // delete cached information for changed files
                    this.cachedUnresolvedImportsPerFile.delete(file);
                }
                // update builder only if language service is enabled
                // otherwise tell it to drop its internal state
                if (this.languageServiceEnabled) {
                    // 1. no changes in structure, no changes in unresolved imports - do nothing
                    // 2. no changes in structure, unresolved imports were changed - collect unresolved imports for all files
                    // (can reuse cached imports for files that were not changed)
                    // 3. new files were added/removed, but compilation settings stays the same - collect unresolved imports for all new/modified files
                    // (can reuse cached imports for files that were not changed)
                    // 4. compilation settings were changed in the way that might affect module resolution - drop all caches and collect all data from the scratch
                    if (hasNewProgram || changedFiles.length) {
                        let result;
                        const ambientModules = this.program.getTypeChecker().getAmbientModules().map(mod => ts.stripQuotes(mod.getName()));
                        for (const sourceFile of this.program.getSourceFiles()) {
                            const unResolved = this.extractUnresolvedImportsFromSourceFile(sourceFile, ambientModules);
                            if (unResolved !== server.emptyArray) {
                                (result || (result = [])).push(...unResolved);
                            }
                        }
                        this.lastCachedUnresolvedImportsList = result ? server.toDeduplicatedSortedArray(result) : server.emptyArray;
                    }
                    this.projectService.typingsCache.enqueueInstallTypingsForProject(this, this.lastCachedUnresolvedImportsList, hasAddedorRemovedFiles);
                }
                else {
                    this.lastCachedUnresolvedImportsList = undefined;
                }
                if (hasNewProgram) {
                    this.projectProgramVersion++;
                }
                return !hasNewProgram;
            }
            /*@internal*/
            updateTypingFiles(typingFiles) {
                this.typingFiles = typingFiles;
                // Invalidate files with unresolved imports
                this.resolutionCache.setFilesWithInvalidatedNonRelativeUnresolvedImports(this.cachedUnresolvedImportsPerFile);
            }
            /* @internal */
            getCurrentProgram() {
                return this.program;
            }
            removeExistingTypings(include) {
                const existing = ts.getAutomaticTypeDirectiveNames(this.getCompilerOptions(), this.directoryStructureHost);
                return include.filter(i => existing.indexOf(i) < 0);
            }
            updateGraphWorker() {
                const oldProgram = this.program;
                ts.Debug.assert(!this.isClosed(), "Called update graph worker of closed project");
                this.writeLog(`Starting updateGraphWorker: Project: ${this.getProjectName()}`);
                const start = ts.timestamp();
                this.hasInvalidatedResolution = this.resolutionCache.createHasInvalidatedResolution();
                this.resolutionCache.startCachingPerDirectoryResolution();
                this.program = this.languageService.getProgram();
                this.dirty = false;
                this.resolutionCache.finishCachingPerDirectoryResolution();
                ts.Debug.assert(oldProgram === undefined || this.program !== undefined);
                // bump up the version if
                // - oldProgram is not set - this is a first time updateGraph is called
                // - newProgram is different from the old program and structure of the old program was not reused.
                const hasNewProgram = this.program && (!oldProgram || (this.program !== oldProgram && !(oldProgram.structureIsReused & 2 /* Completely */)));
                this.hasChangedAutomaticTypeDirectiveNames = false;
                if (hasNewProgram) {
                    if (oldProgram) {
                        for (const f of oldProgram.getSourceFiles()) {
                            if (this.program.getSourceFileByPath(f.path)) {
                                continue;
                            }
                            // new program does not contain this file - detach it from the project
                            this.detachScriptInfoFromProject(f.fileName);
                        }
                    }
                    // Update the missing file paths watcher
                    ts.updateMissingFilePathsWatch(this.program, this.missingFilesMap || (this.missingFilesMap = ts.createMap()), 
                    // Watch the missing files
                    missingFilePath => this.addMissingFileWatcher(missingFilePath));
                    // Watch the type locations that would be added to program as part of automatic type resolutions
                    if (this.languageServiceEnabled) {
                        this.resolutionCache.updateTypeRootsWatch();
                    }
                }
                const oldExternalFiles = this.externalFiles || server.emptyArray;
                this.externalFiles = this.getExternalFiles();
                ts.enumerateInsertsAndDeletes(this.externalFiles, oldExternalFiles, ts.compareStringsCaseSensitive, 
                // Ensure a ScriptInfo is created for new external files. This is performed indirectly
                // by the LSHost for files in the program when the program is retrieved above but
                // the program doesn't contain external files so this must be done explicitly.
                inserted => {
                    const scriptInfo = this.projectService.getOrCreateScriptInfoNotOpenedByClient(inserted, this.currentDirectory, this.directoryStructureHost);
                    scriptInfo.attachToProject(this);
                }, removed => this.detachScriptInfoFromProject(removed));
                const elapsed = ts.timestamp() - start;
                this.writeLog(`Finishing updateGraphWorker: Project: ${this.getProjectName()} Version: ${this.getProjectVersion()} structureChanged: ${hasNewProgram} Elapsed: ${elapsed}ms`);
                return hasNewProgram;
            }
            detachScriptInfoFromProject(uncheckedFileName) {
                const scriptInfoToDetach = this.projectService.getScriptInfo(uncheckedFileName);
                if (scriptInfoToDetach) {
                    scriptInfoToDetach.detachFromProject(this);
                    this.resolutionCache.removeResolutionsOfFile(scriptInfoToDetach.path);
                }
            }
            addMissingFileWatcher(missingFilePath) {
                const fileWatcher = this.projectService.watchFactory.watchFile(this.projectService.host, missingFilePath, (fileName, eventKind) => {
                    if (this.projectKind === ProjectKind.Configured) {
                        this.getCachedDirectoryStructureHost().addOrDeleteFile(fileName, missingFilePath, eventKind);
                    }
                    if (eventKind === ts.FileWatcherEventKind.Created && this.missingFilesMap.has(missingFilePath)) {
                        this.missingFilesMap.delete(missingFilePath);
                        fileWatcher.close();
                        // When a missing file is created, we should update the graph.
                        this.projectService.delayUpdateProjectGraphAndEnsureProjectStructureForOpenFiles(this);
                    }
                }, ts.PollingInterval.Medium, "Missing file from program" /* MissingFilePath */, this);
                return fileWatcher;
            }
            isWatchedMissingFile(path) {
                return this.missingFilesMap && this.missingFilesMap.has(path);
            }
            getScriptInfoForNormalizedPath(fileName) {
                const scriptInfo = this.projectService.getScriptInfoForPath(this.toPath(fileName));
                if (scriptInfo && !scriptInfo.isAttached(this)) {
                    return server.Errors.ThrowProjectDoesNotContainDocument(fileName, this);
                }
                return scriptInfo;
            }
            getScriptInfo(uncheckedFileName) {
                return this.projectService.getScriptInfo(uncheckedFileName);
            }
            filesToString(writeProjectFileNames) {
                if (!this.program) {
                    return "\tFiles (0)\n";
                }
                const sourceFiles = this.program.getSourceFiles();
                let strBuilder = `\tFiles (${sourceFiles.length})\n`;
                if (writeProjectFileNames) {
                    for (const file of sourceFiles) {
                        strBuilder += `\t${file.fileName}\n`;
                    }
                }
                return strBuilder;
            }
            setCompilerOptions(compilerOptions) {
                if (compilerOptions) {
                    compilerOptions.allowNonTsExtensions = true;
                    const oldOptions = this.compilerOptions;
                    this.compilerOptions = compilerOptions;
                    this.setInternalCompilerOptionsForEmittingJsFiles();
                    if (ts.changesAffectModuleResolution(oldOptions, compilerOptions)) {
                        // reset cached unresolved imports if changes in compiler options affected module resolution
                        this.cachedUnresolvedImportsPerFile.clear();
                        this.lastCachedUnresolvedImportsList = undefined;
                        this.resolutionCache.clear();
                    }
                    this.markAsDirty();
                }
            }
            /* @internal */
            getChangesSinceVersion(lastKnownVersion) {
                this.updateGraph();
                const info = {
                    projectName: this.getProjectName(),
                    version: this.projectProgramVersion,
                    isInferred: this.projectKind === ProjectKind.Inferred,
                    options: this.getCompilationSettings(),
                    languageServiceDisabled: !this.languageServiceEnabled,
                    lastFileExceededProgramSize: this.lastFileExceededProgramSize
                };
                const updatedFileNames = this.updatedFileNames;
                this.updatedFileNames = undefined;
                // check if requested version is the same that we have reported last time
                if (this.lastReportedFileNames && lastKnownVersion === this.lastReportedVersion) {
                    // if current structure version is the same - return info without any changes
                    if (this.projectProgramVersion === this.lastReportedVersion && !updatedFileNames) {
                        return { info, projectErrors: this.getGlobalProjectErrors() };
                    }
                    // compute and return the difference
                    const lastReportedFileNames = this.lastReportedFileNames;
                    const externalFiles = this.getExternalFiles().map(f => server.toNormalizedPath(f));
                    const currentFiles = ts.arrayToSet(this.getFileNames().concat(externalFiles));
                    const added = [];
                    const removed = [];
                    const updated = updatedFileNames ? ts.arrayFrom(updatedFileNames.keys()) : [];
                    ts.forEachKey(currentFiles, id => {
                        if (!lastReportedFileNames.has(id)) {
                            added.push(id);
                        }
                    });
                    ts.forEachKey(lastReportedFileNames, id => {
                        if (!currentFiles.has(id)) {
                            removed.push(id);
                        }
                    });
                    this.lastReportedFileNames = currentFiles;
                    this.lastReportedVersion = this.projectProgramVersion;
                    return { info, changes: { added, removed, updated }, projectErrors: this.getGlobalProjectErrors() };
                }
                else {
                    // unknown version - return everything
                    const projectFileNames = this.getFileNames();
                    const externalFiles = this.getExternalFiles().map(f => server.toNormalizedPath(f));
                    const allFiles = projectFileNames.concat(externalFiles);
                    this.lastReportedFileNames = ts.arrayToSet(allFiles);
                    this.lastReportedVersion = this.projectProgramVersion;
                    return { info, files: allFiles, projectErrors: this.getGlobalProjectErrors() };
                }
            }
            // remove a root file from project
            removeRoot(info) {
                ts.orderedRemoveItem(this.rootFiles, info);
                this.rootFilesMap.delete(info.path);
            }
            enableGlobalPlugins() {
                const host = this.projectService.host;
                const options = this.getCompilationSettings();
                if (!host.require) {
                    this.projectService.logger.info("Plugins were requested but not running in environment that supports 'require'. Nothing will be loaded");
                    return;
                }
                // Search our peer node_modules, then any globally-specified probe paths
                // ../../.. to walk from X/node_modules/typescript/lib/tsserver.js to X/node_modules/
                const searchPaths = [ts.combinePaths(this.projectService.getExecutingFilePath(), "../../.."), ...this.projectService.pluginProbeLocations];
                if (this.projectService.globalPlugins) {
                    // Enable global plugins with synthetic configuration entries
                    for (const globalPluginName of this.projectService.globalPlugins) {
                        // Skip empty names from odd commandline parses
                        if (!globalPluginName)
                            continue;
                        // Skip already-locally-loaded plugins
                        if (options.plugins && options.plugins.some(p => p.name === globalPluginName))
                            continue;
                        // Provide global: true so plugins can detect why they can't find their config
                        this.projectService.logger.info(`Loading global plugin ${globalPluginName}`);
                        this.enablePlugin({ name: globalPluginName, global: true }, searchPaths);
                    }
                }
            }
            enablePlugin(pluginConfigEntry, searchPaths) {
                this.projectService.logger.info(`Enabling plugin ${pluginConfigEntry.name} from candidate paths: ${searchPaths.join(",")}`);
                const log = (message) => {
                    this.projectService.logger.info(message);
                };
                for (const searchPath of searchPaths) {
                    const resolvedModule = Project.resolveModule(pluginConfigEntry.name, searchPath, this.projectService.host, log);
                    if (resolvedModule) {
                        this.enableProxy(resolvedModule, pluginConfigEntry);
                        return;
                    }
                }
                this.projectService.logger.info(`Couldn't find ${pluginConfigEntry.name}`);
            }
            enableProxy(pluginModuleFactory, configEntry) {
                try {
                    if (typeof pluginModuleFactory !== "function") {
                        this.projectService.logger.info(`Skipped loading plugin ${configEntry.name} because it did expose a proper factory function`);
                        return;
                    }
                    const info = {
                        config: configEntry,
                        project: this,
                        languageService: this.languageService,
                        languageServiceHost: this,
                        serverHost: this.projectService.host
                    };
                    const pluginModule = pluginModuleFactory({ typescript: ts });
                    const newLS = pluginModule.create(info);
                    for (const k of Object.keys(this.languageService)) {
                        if (!(k in newLS)) {
                            this.projectService.logger.info(`Plugin activation warning: Missing proxied method ${k} in created LS. Patching.`);
                            newLS[k] = this.languageService[k];
                        }
                    }
                    this.projectService.logger.info(`Plugin validation succeded`);
                    this.languageService = newLS;
                    this.plugins.push(pluginModule);
                }
                catch (e) {
                    this.projectService.logger.info(`Plugin activation failed: ${e}`);
                }
            }
        }
        server.Project = Project;
        /**
         * If a file is opened and no tsconfig (or jsconfig) is found,
         * the file and its imports/references are put into an InferredProject.
         */
        class InferredProject extends Project {
            /*@internal*/
            constructor(projectService, documentRegistry, compilerOptions, projectRootPath, currentDirectory) {
                super(InferredProject.newName(), ProjectKind.Inferred, projectService, documentRegistry, 
                /*files*/ undefined, 
                /*lastFileExceededProgramSize*/ undefined, compilerOptions, 
                /*compileOnSaveEnabled*/ false, projectService.host, currentDirectory);
                this._isJsInferredProject = false;
                this.projectRootPath = projectRootPath && projectService.toCanonicalFileName(projectRootPath);
                this.enableGlobalPlugins();
            }
            toggleJsInferredProject(isJsInferredProject) {
                if (isJsInferredProject !== this._isJsInferredProject) {
                    this._isJsInferredProject = isJsInferredProject;
                    this.setCompilerOptions();
                }
            }
            setCompilerOptions(options) {
                // Avoid manipulating the given options directly
                const newOptions = options ? ts.cloneCompilerOptions(options) : this.getCompilationSettings();
                if (!newOptions) {
                    return;
                }
                if (this._isJsInferredProject && typeof newOptions.maxNodeModuleJsDepth !== "number") {
                    newOptions.maxNodeModuleJsDepth = 2;
                }
                else if (!this._isJsInferredProject) {
                    newOptions.maxNodeModuleJsDepth = undefined;
                }
                newOptions.allowJs = true;
                super.setCompilerOptions(newOptions);
            }
            addRoot(info) {
                ts.Debug.assert(info.isScriptOpen());
                this.projectService.startWatchingConfigFilesForInferredProjectRoot(info, this.projectService.openFiles.get(info.path));
                if (!this._isJsInferredProject && info.isJavaScript()) {
                    this.toggleJsInferredProject(/*isJsInferredProject*/ true);
                }
                super.addRoot(info);
            }
            removeRoot(info) {
                this.projectService.stopWatchingConfigFilesForInferredProjectRoot(info);
                super.removeRoot(info);
                if (this._isJsInferredProject && info.isJavaScript()) {
                    if (ts.every(this.getRootScriptInfos(), rootInfo => !rootInfo.isJavaScript())) {
                        this.toggleJsInferredProject(/*isJsInferredProject*/ false);
                    }
                }
            }
            isProjectWithSingleRoot() {
                // - when useSingleInferredProject is not set and projectRootPath is not set,
                //   we can guarantee that this will be the only root
                // - other wise it has single root if it has single root script info
                return (!this.projectRootPath && !this.projectService.useSingleInferredProject) ||
                    this.getRootScriptInfos().length === 1;
            }
            close() {
                ts.forEach(this.getRootScriptInfos(), info => this.projectService.stopWatchingConfigFilesForInferredProjectRoot(info));
                super.close();
            }
            getTypeAcquisition() {
                return {
                    enable: allRootFilesAreJsOrDts(this),
                    include: [],
                    exclude: []
                };
            }
        }
        InferredProject.newName = (() => {
            let nextId = 1;
            return () => {
                const id = nextId;
                nextId++;
                return server.makeInferredProjectName(id);
            };
        })();
        server.InferredProject = InferredProject;
        /**
         * If a file is opened, the server will look for a tsconfig (or jsconfig)
         * and if successfull create a ConfiguredProject for it.
         * Otherwise it will create an InferredProject.
         */
        class ConfiguredProject extends Project {
            /*@internal*/
            constructor(configFileName, projectService, documentRegistry, hasExplicitListOfFiles, compilerOptions, lastFileExceededProgramSize, compileOnSaveEnabled, cachedDirectoryStructureHost) {
                super(configFileName, ProjectKind.Configured, projectService, documentRegistry, hasExplicitListOfFiles, lastFileExceededProgramSize, compilerOptions, compileOnSaveEnabled, cachedDirectoryStructureHost, ts.getDirectoryPath(configFileName));
                this.compileOnSaveEnabled = compileOnSaveEnabled;
                /** Ref count to the project when opened from external project */
                this.externalProjectRefCount = 0;
                this.canonicalConfigFilePath = server.asNormalizedPath(projectService.toCanonicalFileName(configFileName));
                this.enablePlugins();
            }
            /**
             * If the project has reload from disk pending, it reloads (and then updates graph as part of that) instead of just updating the graph
             * @returns: true if set of files in the project stays the same and false - otherwise.
             */
            updateGraph() {
                const reloadLevel = this.pendingReload;
                this.pendingReload = ts.ConfigFileProgramReloadLevel.None;
                switch (reloadLevel) {
                    case ts.ConfigFileProgramReloadLevel.Partial:
                        return this.projectService.reloadFileNamesOfConfiguredProject(this);
                    case ts.ConfigFileProgramReloadLevel.Full:
                        this.projectService.reloadConfiguredProject(this);
                        return true;
                    default:
                        return super.updateGraph();
                }
            }
            /*@internal*/
            getCachedDirectoryStructureHost() {
                return this.directoryStructureHost;
            }
            getConfigFilePath() {
                return server.asNormalizedPath(this.getProjectName());
            }
            enablePlugins() {
                const host = this.projectService.host;
                const options = this.getCompilationSettings();
                if (!host.require) {
                    this.projectService.logger.info("Plugins were requested but not running in environment that supports 'require'. Nothing will be loaded");
                    return;
                }
                // Search our peer node_modules, then any globally-specified probe paths
                // ../../.. to walk from X/node_modules/typescript/lib/tsserver.js to X/node_modules/
                const searchPaths = [ts.combinePaths(this.projectService.getExecutingFilePath(), "../../.."), ...this.projectService.pluginProbeLocations];
                if (this.projectService.allowLocalPluginLoads) {
                    const local = ts.getDirectoryPath(this.canonicalConfigFilePath);
                    this.projectService.logger.info(`Local plugin loading enabled; adding ${local} to search paths`);
                    searchPaths.unshift(local);
                }
                // Enable tsconfig-specified plugins
                if (options.plugins) {
                    for (const pluginConfigEntry of options.plugins) {
                        this.enablePlugin(pluginConfigEntry, searchPaths);
                    }
                }
                this.enableGlobalPlugins();
            }
            /**
             * Get the errors that dont have any file name associated
             */
            getGlobalProjectErrors() {
                return ts.filter(this.projectErrors, diagnostic => !diagnostic.file) || server.emptyArray;
            }
            /**
             * Get all the project errors
             */
            getAllProjectErrors() {
                return this.projectErrors || server.emptyArray;
            }
            setProjectErrors(projectErrors) {
                this.projectErrors = projectErrors;
            }
            setTypeAcquisition(newTypeAcquisition) {
                this.typeAcquisition = this.removeLocalTypingsFromTypeAcquisition(newTypeAcquisition);
            }
            getTypeAcquisition() {
                return this.typeAcquisition;
            }
            /*@internal*/
            watchWildcards(wildcardDirectories) {
                ts.updateWatchingWildcardDirectories(this.directoriesWatchedForWildcards || (this.directoriesWatchedForWildcards = ts.createMap()), wildcardDirectories, 
                // Create new directory watcher
                (directory, flags) => this.projectService.watchWildcardDirectory(directory, flags, this));
            }
            /*@internal*/
            stopWatchingWildCards() {
                if (this.directoriesWatchedForWildcards) {
                    ts.clearMap(this.directoriesWatchedForWildcards, ts.closeFileWatcherOf);
                    this.directoriesWatchedForWildcards = undefined;
                }
            }
            close() {
                if (this.configFileWatcher) {
                    this.configFileWatcher.close();
                    this.configFileWatcher = undefined;
                }
                this.stopWatchingWildCards();
                this.projectErrors = undefined;
                this.configFileSpecs = undefined;
                super.close();
            }
            /* @internal */
            addExternalProjectReference() {
                this.externalProjectRefCount++;
            }
            /* @internal */
            deleteExternalProjectReference() {
                this.externalProjectRefCount--;
            }
            /** Returns true if the project is needed by any of the open script info/external project */
            /* @internal */
            hasOpenRef() {
                if (!!this.externalProjectRefCount) {
                    return true;
                }
                // Closed project doesnt have any reference
                if (this.isClosed()) {
                    return false;
                }
                const configFileExistenceInfo = this.projectService.getConfigFileExistenceInfo(this);
                if (this.projectService.hasPendingProjectUpdate(this)) {
                    // If there is pending update for this project,
                    // we dont know if this project would be needed by any of the open files impacted by this config file
                    // In that case keep the project alive if there are open files impacted by this project
                    return !!configFileExistenceInfo.openFilesImpactedByConfigFile.size;
                }
                // If there is no pending update for this project,
                // We know exact set of open files that get impacted by this configured project as the files in the project
                // The project is referenced only if open files impacted by this project are present in this project
                return ts.forEachEntry(configFileExistenceInfo.openFilesImpactedByConfigFile, (_value, infoPath) => this.containsScriptInfo(this.projectService.getScriptInfoForPath(infoPath))) || false;
            }
            getEffectiveTypeRoots() {
                return ts.getEffectiveTypeRoots(this.getCompilationSettings(), this.directoryStructureHost) || [];
            }
            /*@internal*/
            updateErrorOnNoInputFiles(hasFileNames) {
                if (hasFileNames) {
                    ts.filterMutate(this.projectErrors, error => !ts.isErrorNoInputFiles(error));
                }
                else if (!this.configFileSpecs.filesSpecs && !ts.some(this.projectErrors, ts.isErrorNoInputFiles)) {
                    this.projectErrors.push(ts.getErrorForNoInputFiles(this.configFileSpecs, this.getConfigFilePath()));
                }
            }
        }
        server.ConfiguredProject = ConfiguredProject;
        /**
         * Project whose configuration is handled externally, such as in a '.csproj'.
         * These are created only if a host explicitly calls `openExternalProject`.
         */
        class ExternalProject extends Project {
            /*@internal*/
            constructor(externalProjectName, projectService, documentRegistry, compilerOptions, lastFileExceededProgramSize, compileOnSaveEnabled, projectFilePath) {
                super(externalProjectName, ProjectKind.External, projectService, documentRegistry, 
                /*hasExplicitListOfFiles*/ true, lastFileExceededProgramSize, compilerOptions, compileOnSaveEnabled, projectService.host, ts.getDirectoryPath(projectFilePath || ts.normalizeSlashes(externalProjectName)));
                this.externalProjectName = externalProjectName;
                this.compileOnSaveEnabled = compileOnSaveEnabled;
                this.excludedFiles = [];
            }
            getExcludedFiles() {
                return this.excludedFiles;
            }
            getTypeAcquisition() {
                return this.typeAcquisition;
            }
            setTypeAcquisition(newTypeAcquisition) {
                ts.Debug.assert(!!newTypeAcquisition, "newTypeAcquisition may not be null/undefined");
                ts.Debug.assert(!!newTypeAcquisition.include, "newTypeAcquisition.include may not be null/undefined");
                ts.Debug.assert(!!newTypeAcquisition.exclude, "newTypeAcquisition.exclude may not be null/undefined");
                ts.Debug.assert(typeof newTypeAcquisition.enable === "boolean", "newTypeAcquisition.enable may not be null/undefined");
                this.typeAcquisition = this.removeLocalTypingsFromTypeAcquisition(newTypeAcquisition);
            }
        }
        server.ExternalProject = ExternalProject;
    })(server = ts.server || (ts.server = {}));
})(ts || (ts = {}));