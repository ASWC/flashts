/*@internal*/
var ts;
(function (ts) {
    const sysFormatDiagnosticsHost = ts.sys ? {
        getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
        getNewLine: () => ts.sys.newLine,
        getCanonicalFileName: ts.createGetCanonicalFileName(ts.sys.useCaseSensitiveFileNames)
    } : undefined;
    /**
     * Create a function that reports error by writing to the system and handles the formating of the diagnostic
     */
    function createDiagnosticReporter(system, pretty) {
        const host = system === ts.sys ? sysFormatDiagnosticsHost : {
            getCurrentDirectory: () => system.getCurrentDirectory(),
            getNewLine: () => system.newLine,
            getCanonicalFileName: ts.createGetCanonicalFileName(system.useCaseSensitiveFileNames),
        };
        if (!pretty) {
            return diagnostic => system.write(ts.formatDiagnostic(diagnostic, host));
        }
        const diagnostics = new Array(1);
        return diagnostic => {
            diagnostics[0] = diagnostic;
            system.write(ts.formatDiagnosticsWithColorAndContext(diagnostics, host) + host.getNewLine());
            diagnostics[0] = undefined;
        };
    }
    ts.createDiagnosticReporter = createDiagnosticReporter;
    /** @internal */
    ts.nonClearingMessageCodes = [
        Diagnostics.Found_1_error_Watching_for_file_changes.code,
        Diagnostics.Found_0_errors_Watching_for_file_changes.code
    ];
    /**
     * @returns Whether the screen was cleared.
     */
    function clearScreenIfNotWatchingForFileChanges(system, diagnostic, options) {
        if (system.clearScreen &&
            !options.preserveWatchOutput &&
            !options.extendedDiagnostics &&
            !options.diagnostics &&
            !ts.contains(ts.nonClearingMessageCodes, diagnostic.code)) {
            system.clearScreen();
            return true;
        }
        return false;
    }
    /** @internal */
    ts.screenStartingMessageCodes = [
        Diagnostics.Starting_compilation_in_watch_mode.code,
        Diagnostics.File_change_detected_Starting_incremental_compilation.code,
    ];
    function getPlainDiagnosticFollowingNewLines(diagnostic, newLine) {
        return ts.contains(ts.screenStartingMessageCodes, diagnostic.code)
            ? newLine + newLine
            : newLine;
    }
    /**
     * Create a function that reports watch status by writing to the system and handles the formating of the diagnostic
     */
    function createWatchStatusReporter(system, pretty) {
        return pretty ?
            (diagnostic, newLine, options) => {
                clearScreenIfNotWatchingForFileChanges(system, diagnostic, options);
                let output = `[${ts.formatColorAndReset(new Date().toLocaleTimeString(), ts.ForegroundColorEscapeSequences.Grey)}] `;
                output += `${ts.flattenDiagnosticMessageText(diagnostic.messageText, system.newLine)}${newLine + newLine}`;
                system.write(output);
            } :
            (diagnostic, newLine, options) => {
                let output = "";
                if (!clearScreenIfNotWatchingForFileChanges(system, diagnostic, options)) {
                    output += newLine;
                }
                output += `${new Date().toLocaleTimeString()} - `;
                output += `${ts.flattenDiagnosticMessageText(diagnostic.messageText, system.newLine)}${getPlainDiagnosticFollowingNewLines(diagnostic, newLine)}`;
                system.write(output);
            };
    }
    ts.createWatchStatusReporter = createWatchStatusReporter;
    /** Parses config file using System interface */
    function parseConfigFileWithSystem(configFileName, optionsToExtend, system, reportDiagnostic) {
        const host = system;
        host.onUnRecoverableConfigFileDiagnostic = diagnostic => reportUnrecoverableDiagnostic(ts.sys, reportDiagnostic, diagnostic);
        const result = getParsedCommandLineOfConfigFile(configFileName, optionsToExtend, host);
        host.onUnRecoverableConfigFileDiagnostic = undefined;
        return result;
    }
    ts.parseConfigFileWithSystem = parseConfigFileWithSystem;
    /**
     * Reads the config file, reports errors if any and exits if the config file cannot be found
     */
    function getParsedCommandLineOfConfigFile(configFileName, optionsToExtend, host) {
        let configFileText;
        try {
            configFileText = host.readFile(configFileName);
        }
        catch (e) {
            const error = ts.createCompilerDiagnostic(Diagnostics.Cannot_read_file_0_Colon_1, configFileName, e.message);
            host.onUnRecoverableConfigFileDiagnostic(error);
            return undefined;
        }
        if (!configFileText) {
            const error = ts.createCompilerDiagnostic(Diagnostics.File_0_not_found, configFileName);
            host.onUnRecoverableConfigFileDiagnostic(error);
            return undefined;
        }
        const result = ts.parseJsonText(configFileName, configFileText);
        const cwd = host.getCurrentDirectory();
        return ts.parseJsonSourceFileConfigFileContent(result, host, ts.getNormalizedAbsolutePath(ts.getDirectoryPath(configFileName), cwd), optionsToExtend, ts.getNormalizedAbsolutePath(configFileName, cwd));
    }
    ts.getParsedCommandLineOfConfigFile = getParsedCommandLineOfConfigFile;
    /**
     * Helper that emit files, report diagnostics and lists emitted and/or source files depending on compiler options
     */
    function emitFilesAndReportErrors(program, reportDiagnostic, writeFileName, reportSummary) {
        // First get and report any syntactic errors.
        const diagnostics = program.getConfigFileParsingDiagnostics().slice();
        const configFileParsingDiagnosticsLength = diagnostics.length;
        ts.addRange(diagnostics, program.getSyntacticDiagnostics());
        let reportSemanticDiagnostics = false;
        // If we didn't have any syntactic errors, then also try getting the global and
        // semantic errors.
        if (diagnostics.length === configFileParsingDiagnosticsLength) {
            ts.addRange(diagnostics, program.getOptionsDiagnostics());
            ts.addRange(diagnostics, program.getGlobalDiagnostics());
            if (diagnostics.length === configFileParsingDiagnosticsLength) {
                reportSemanticDiagnostics = true;
            }
        }
        // Emit and report any errors we ran into.
        const { emittedFiles, emitSkipped, diagnostics: emitDiagnostics } = program.emit();
        ts.addRange(diagnostics, emitDiagnostics);
        if (reportSemanticDiagnostics) {
            ts.addRange(diagnostics, program.getSemanticDiagnostics());
        }
        ts.sortAndDeduplicateDiagnostics(diagnostics).forEach(reportDiagnostic);
        if (writeFileName) {
            const currentDir = program.getCurrentDirectory();
            ts.forEach(emittedFiles, file => {
                const filepath = ts.getNormalizedAbsolutePath(file, currentDir);
                writeFileName(`TSFILE: ${filepath}`);
            });
            if (program.getCompilerOptions().listFiles) {
                ts.forEach(program.getSourceFiles(), file => {
                    writeFileName(file.fileName);
                });
            }
        }
        if (reportSummary) {
            reportSummary(diagnostics.filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error).length);
        }
        if (emitSkipped && diagnostics.length > 0) {
            // If the emitter didn't emit anything, then pass that value along.
            return ts.ExitStatus.DiagnosticsPresent_OutputsSkipped;
        }
        else if (diagnostics.length > 0) {
            // The emitter emitted something, inform the caller if that happened in the presence
            // of diagnostics or not.
            return ts.ExitStatus.DiagnosticsPresent_OutputsGenerated;
        }
        return ts.ExitStatus.Success;
    }
    ts.emitFilesAndReportErrors = emitFilesAndReportErrors;
    const noopFileWatcher = { close: ts.noop };
    /**
     * Creates the watch compiler host that can be extended with config file or root file names and options host
     */
    function createWatchCompilerHost(system = ts.sys, createProgram, reportDiagnostic, reportWatchStatus) {
        if (!createProgram) {
            createProgram = ts.createEmitAndSemanticDiagnosticsBuilderProgram;
        }
        let host = system;
        const useCaseSensitiveFileNames = () => system.useCaseSensitiveFileNames;
        const writeFileName = (s) => system.write(s + system.newLine);
        const onWatchStatusChange = reportWatchStatus || createWatchStatusReporter(system);
        return {
            useCaseSensitiveFileNames,
            getNewLine: () => system.newLine,
            getCurrentDirectory: () => system.getCurrentDirectory(),
            getDefaultLibLocation,
            getDefaultLibFileName: options => ts.combinePaths(getDefaultLibLocation(), ts.getDefaultLibFileName(options)),
            fileExists: path => system.fileExists(path),
            readFile: (path, encoding) => system.readFile(path, encoding),
            directoryExists: path => system.directoryExists(path),
            getDirectories: path => system.getDirectories(path),
            readDirectory: (path, extensions, exclude, include, depth) => system.readDirectory(path, extensions, exclude, include, depth),
            realpath: system.realpath && (path => system.realpath(path)),
            getEnvironmentVariable: system.getEnvironmentVariable && (name => system.getEnvironmentVariable(name)),
            watchFile: system.watchFile ? ((path, callback, pollingInterval) => system.watchFile(path, callback, pollingInterval)) : () => noopFileWatcher,
            watchDirectory: system.watchDirectory ? ((path, callback, recursive) => system.watchDirectory(path, callback, recursive)) : () => noopFileWatcher,
            setTimeout: system.setTimeout ? ((callback, ms, ...args) => system.setTimeout.call(system, callback, ms, ...args)) : ts.noop,
            clearTimeout: system.clearTimeout ? (timeoutId => system.clearTimeout(timeoutId)) : ts.noop,
            trace: s => system.write(s),
            onWatchStatusChange,
            createDirectory: path => system.createDirectory(path),
            writeFile: (path, data, writeByteOrderMark) => system.writeFile(path, data, writeByteOrderMark),
            onCachedDirectoryStructureHostCreate: cacheHost => host = cacheHost || system,
            createHash: system.createHash && (s => system.createHash(s)),
            createProgram,
            afterProgramCreate: emitFilesAndReportErrorUsingBuilder
        };
        function getDefaultLibLocation() {
            return ts.getDirectoryPath(ts.normalizePath(system.getExecutingFilePath()));
        }
        function emitFilesAndReportErrorUsingBuilder(builderProgram) {
            const compilerOptions = builderProgram.getCompilerOptions();
            const newLine = ts.getNewLineCharacter(compilerOptions, () => system.newLine);
            const reportSummary = (errorCount) => {
                if (errorCount === 1) {
                    onWatchStatusChange(ts.createCompilerDiagnostic(Diagnostics.Found_1_error_Watching_for_file_changes, errorCount), newLine, compilerOptions);
                }
                else {
                    onWatchStatusChange(ts.createCompilerDiagnostic(Diagnostics.Found_0_errors_Watching_for_file_changes, errorCount, errorCount), newLine, compilerOptions);
                }
            };
            emitFilesAndReportErrors(builderProgram, reportDiagnostic, writeFileName, reportSummary);
        }
    }
    /**
     * Report error and exit
     */
    function reportUnrecoverableDiagnostic(system, reportDiagnostic, diagnostic) {
        reportDiagnostic(diagnostic);
        system.exit(ts.ExitStatus.DiagnosticsPresent_OutputsSkipped);
    }
    /**
     * Creates the watch compiler host from system for config file in watch mode
     */
    function createWatchCompilerHostOfConfigFile(configFileName, optionsToExtend, system, createProgram, reportDiagnostic, reportWatchStatus) {
        reportDiagnostic = reportDiagnostic || createDiagnosticReporter(system);
        const host = createWatchCompilerHost(system, createProgram, reportDiagnostic, reportWatchStatus);
        host.onUnRecoverableConfigFileDiagnostic = diagnostic => reportUnrecoverableDiagnostic(system, reportDiagnostic, diagnostic);
        host.configFileName = configFileName;
        host.optionsToExtend = optionsToExtend;
        return host;
    }
    ts.createWatchCompilerHostOfConfigFile = createWatchCompilerHostOfConfigFile;
    /**
     * Creates the watch compiler host from system for compiling root files and options in watch mode
     */
    function createWatchCompilerHostOfFilesAndCompilerOptions(rootFiles, options, system, createProgram, reportDiagnostic, reportWatchStatus) {
        const host = createWatchCompilerHost(system, createProgram, reportDiagnostic || createDiagnosticReporter(system), reportWatchStatus);
        host.rootFiles = rootFiles;
        host.options = options;
        return host;
    }
    ts.createWatchCompilerHostOfFilesAndCompilerOptions = createWatchCompilerHostOfFilesAndCompilerOptions;
})(ts || (ts = {}));
(function (ts) {
    function createWatchCompilerHost(rootFilesOrConfigFileName, options, system, createProgram, reportDiagnostic, reportWatchStatus) {
        if (ts.isArray(rootFilesOrConfigFileName)) {
            return ts.createWatchCompilerHostOfFilesAndCompilerOptions(rootFilesOrConfigFileName, options, system, createProgram, reportDiagnostic, reportWatchStatus);
        }
        else {
            return ts.createWatchCompilerHostOfConfigFile(rootFilesOrConfigFileName, options, system, createProgram, reportDiagnostic, reportWatchStatus);
        }
    }
    ts.createWatchCompilerHost = createWatchCompilerHost;
    const initialVersion = 1;
    function createWatchProgram(host) {
        let builderProgram;
        let reloadLevel; // level to indicate if the program needs to be reloaded from config file/just filenames etc
        let missingFilesMap; // Map of file watchers for the missing files
        let watchedWildcardDirectories; // map of watchers for the wild card directories in the config file
        let timerToUpdateProgram; // timer callback to recompile the program
        const sourceFilesCache = ts.createMap(); // Cache that stores the source file and version info
        let missingFilePathsRequestedForRelease; // These paths are held temparirly so that we can remove the entry from source file cache if the file is not tracked by missing files
        let hasChangedCompilerOptions = false; // True if the compiler options have changed between compilations
        let hasChangedAutomaticTypeDirectiveNames = false; // True if the automatic type directives have changed
        const useCaseSensitiveFileNames = host.useCaseSensitiveFileNames();
        const currentDirectory = host.getCurrentDirectory();
        const getCurrentDirectory = () => currentDirectory;
        const readFile = (path, encoding) => host.readFile(path, encoding);
        const { configFileName, optionsToExtend: optionsToExtendForConfigFile = {}, createProgram } = host;
        let { rootFiles: rootFileNames, options: compilerOptions } = host;
        let configFileSpecs;
        let configFileParsingDiagnostics;
        let hasChangedConfigFileParsingErrors = false;
        const cachedDirectoryStructureHost = configFileName && ts.createCachedDirectoryStructureHost(host, currentDirectory, useCaseSensitiveFileNames);
        if (cachedDirectoryStructureHost && host.onCachedDirectoryStructureHostCreate) {
            host.onCachedDirectoryStructureHostCreate(cachedDirectoryStructureHost);
        }
        const directoryStructureHost = cachedDirectoryStructureHost || host;
        const parseConfigFileHost = {
            useCaseSensitiveFileNames,
            readDirectory: (path, extensions, exclude, include, depth) => directoryStructureHost.readDirectory(path, extensions, exclude, include, depth),
            fileExists: path => host.fileExists(path),
            readFile,
            getCurrentDirectory,
            onUnRecoverableConfigFileDiagnostic: host.onUnRecoverableConfigFileDiagnostic
        };
        // From tsc we want to get already parsed result and hence check for rootFileNames
        let newLine = updateNewLine();
        reportWatchDiagnostic(Diagnostics.Starting_compilation_in_watch_mode);
        if (configFileName) {
            newLine = ts.getNewLineCharacter(optionsToExtendForConfigFile, () => host.getNewLine());
            if (host.configFileParsingResult) {
                setConfigFileParsingResult(host.configFileParsingResult);
            }
            else {
                ts.Debug.assert(!rootFileNames);
                parseConfigFile();
            }
            newLine = updateNewLine();
        }
        const trace = host.trace && ((s) => { host.trace(s + newLine); });
        const watchLogLevel = trace ? compilerOptions.extendedDiagnostics ? ts.WatchLogLevel.Verbose :
            compilerOptions.diagnostis ? ts.WatchLogLevel.TriggerOnly : ts.WatchLogLevel.None : ts.WatchLogLevel.None;
        const writeLog = watchLogLevel !== ts.WatchLogLevel.None ? trace : ts.noop;
        const { watchFile, watchFilePath, watchDirectory: watchDirectoryWorker } = ts.getWatchFactory(watchLogLevel, writeLog);
        const getCanonicalFileName = ts.createGetCanonicalFileName(useCaseSensitiveFileNames);
        writeLog(`Current directory: ${currentDirectory} CaseSensitiveFileNames: ${useCaseSensitiveFileNames}`);
        if (configFileName) {
            watchFile(host, configFileName, scheduleProgramReload, ts.PollingInterval.High);
        }
        const compilerHost = {
            // Members for CompilerHost
            getSourceFile: (fileName, languageVersion, onError, shouldCreateNewSourceFile) => getVersionedSourceFileByPath(fileName, toPath(fileName), languageVersion, onError, shouldCreateNewSourceFile),
            getSourceFileByPath: getVersionedSourceFileByPath,
            getDefaultLibLocation: host.getDefaultLibLocation && (() => host.getDefaultLibLocation()),
            getDefaultLibFileName: options => host.getDefaultLibFileName(options),
            writeFile,
            getCurrentDirectory,
            useCaseSensitiveFileNames: () => useCaseSensitiveFileNames,
            getCanonicalFileName,
            getNewLine: () => newLine,
            fileExists,
            readFile,
            trace,
            directoryExists: directoryStructureHost.directoryExists && (path => directoryStructureHost.directoryExists(path)),
            getDirectories: directoryStructureHost.getDirectories && (path => directoryStructureHost.getDirectories(path)),
            realpath: host.realpath && (s => host.realpath(s)),
            getEnvironmentVariable: host.getEnvironmentVariable ? (name => host.getEnvironmentVariable(name)) : (() => ""),
            onReleaseOldSourceFile,
            createHash: host.createHash && (data => host.createHash(data)),
            // Members for ResolutionCacheHost
            toPath,
            getCompilationSettings: () => compilerOptions,
            watchDirectoryOfFailedLookupLocation: watchDirectory,
            watchTypeRootsDirectory: watchDirectory,
            getCachedDirectoryStructureHost: () => cachedDirectoryStructureHost,
            onInvalidatedResolution: scheduleProgramUpdate,
            onChangedAutomaticTypeDirectiveNames: () => {
                hasChangedAutomaticTypeDirectiveNames = true;
                scheduleProgramUpdate();
            },
            maxNumberOfFilesToIterateForInvalidation: host.maxNumberOfFilesToIterateForInvalidation,
            getCurrentProgram,
            writeLog
        };
        // Cache for the module resolution
        const resolutionCache = ts.createResolutionCache(compilerHost, configFileName ?
            ts.getDirectoryPath(ts.getNormalizedAbsolutePath(configFileName, currentDirectory)) :
            currentDirectory, 
        /*logChangesWhenResolvingModule*/ false);
        // Resolve module using host module resolution strategy if provided otherwise use resolution cache to resolve module names
        compilerHost.resolveModuleNames = host.resolveModuleNames ?
            ((moduleNames, containingFile, reusedNames) => host.resolveModuleNames(moduleNames, containingFile, reusedNames)) :
            ((moduleNames, containingFile, reusedNames) => resolutionCache.resolveModuleNames(moduleNames, containingFile, reusedNames));
        compilerHost.resolveTypeReferenceDirectives = host.resolveTypeReferenceDirectives ?
            ((typeDirectiveNames, containingFile) => host.resolveTypeReferenceDirectives(typeDirectiveNames, containingFile)) :
            ((typeDirectiveNames, containingFile) => resolutionCache.resolveTypeReferenceDirectives(typeDirectiveNames, containingFile));
        const userProvidedResolution = !!host.resolveModuleNames || !!host.resolveTypeReferenceDirectives;
        synchronizeProgram();
        // Update the wild card directory watch
        watchConfigFileWildCardDirectories();
        return configFileName ?
            { getCurrentProgram: getCurrentBuilderProgram, getProgram: synchronizeProgram } :
            { getCurrentProgram: getCurrentBuilderProgram, getProgram: synchronizeProgram, updateRootFileNames };
        function getCurrentBuilderProgram() {
            return builderProgram;
        }
        function getCurrentProgram() {
            return builderProgram && builderProgram.getProgram();
        }
        function synchronizeProgram() {
            writeLog(`Synchronizing program`);
            const program = getCurrentProgram();
            if (hasChangedCompilerOptions) {
                newLine = updateNewLine();
                if (program && ts.changesAffectModuleResolution(program.getCompilerOptions(), compilerOptions)) {
                    resolutionCache.clear();
                }
            }
            // All resolutions are invalid if user provided resolutions
            const hasInvalidatedResolution = resolutionCache.createHasInvalidatedResolution(userProvidedResolution);
            if (ts.isProgramUptoDate(getCurrentProgram(), rootFileNames, compilerOptions, getSourceVersion, fileExists, hasInvalidatedResolution, hasChangedAutomaticTypeDirectiveNames)) {
                if (hasChangedConfigFileParsingErrors) {
                    builderProgram = createProgram(/*rootNames*/ undefined, /*options*/ undefined, compilerHost, builderProgram, configFileParsingDiagnostics);
                    hasChangedConfigFileParsingErrors = false;
                }
                return builderProgram;
            }
            // Compile the program
            if (watchLogLevel !== ts.WatchLogLevel.None) {
                writeLog("CreatingProgramWith::");
                writeLog(`  roots: ${JSON.stringify(rootFileNames)}`);
                writeLog(`  options: ${JSON.stringify(compilerOptions)}`);
            }
            const needsUpdateInTypeRootWatch = hasChangedCompilerOptions || !program;
            hasChangedCompilerOptions = false;
            hasChangedConfigFileParsingErrors = false;
            resolutionCache.startCachingPerDirectoryResolution();
            compilerHost.hasInvalidatedResolution = hasInvalidatedResolution;
            compilerHost.hasChangedAutomaticTypeDirectiveNames = hasChangedAutomaticTypeDirectiveNames;
            builderProgram = createProgram(rootFileNames, compilerOptions, compilerHost, builderProgram, configFileParsingDiagnostics);
            resolutionCache.finishCachingPerDirectoryResolution();
            // Update watches
            ts.updateMissingFilePathsWatch(builderProgram.getProgram(), missingFilesMap || (missingFilesMap = ts.createMap()), watchMissingFilePath);
            if (needsUpdateInTypeRootWatch) {
                resolutionCache.updateTypeRootsWatch();
            }
            if (missingFilePathsRequestedForRelease) {
                // These are the paths that program creater told us as not in use any more but were missing on the disk.
                // We didnt remove the entry for them from sourceFiles cache so that we dont have to do File IO,
                // if there is already watcher for it (for missing files)
                // At this point our watches were updated, hence now we know that these paths are not tracked and need to be removed
                // so that at later time we have correct result of their presence
                for (const missingFilePath of missingFilePathsRequestedForRelease) {
                    if (!missingFilesMap.has(missingFilePath)) {
                        sourceFilesCache.delete(missingFilePath);
                    }
                }
                missingFilePathsRequestedForRelease = undefined;
            }
            if (host.afterProgramCreate) {
                host.afterProgramCreate(builderProgram);
            }
            return builderProgram;
        }
        function updateRootFileNames(files) {
            ts.Debug.assert(!configFileName, "Cannot update root file names with config file watch mode");
            rootFileNames = files;
            scheduleProgramUpdate();
        }
        function updateNewLine() {
            return ts.getNewLineCharacter(compilerOptions || optionsToExtendForConfigFile, () => host.getNewLine());
        }
        function toPath(fileName) {
            return ts.toPath(fileName, currentDirectory, getCanonicalFileName);
        }
        function isFileMissingOnHost(hostSourceFile) {
            return typeof hostSourceFile === "number";
        }
        function isFilePresentOnHost(hostSourceFile) {
            return !!hostSourceFile.sourceFile;
        }
        function fileExists(fileName) {
            const path = toPath(fileName);
            // If file is missing on host from cache, we can definitely say file doesnt exist
            // otherwise we need to ensure from the disk
            if (isFileMissingOnHost(sourceFilesCache.get(path))) {
                return true;
            }
            return directoryStructureHost.fileExists(fileName);
        }
        function getVersionedSourceFileByPath(fileName, path, languageVersion, onError, shouldCreateNewSourceFile) {
            const hostSourceFile = sourceFilesCache.get(path);
            // No source file on the host
            if (isFileMissingOnHost(hostSourceFile)) {
                return undefined;
            }
            // Create new source file if requested or the versions dont match
            if (!hostSourceFile || shouldCreateNewSourceFile || !isFilePresentOnHost(hostSourceFile) || hostSourceFile.version.toString() !== hostSourceFile.sourceFile.version) {
                const sourceFile = getNewSourceFile();
                if (hostSourceFile) {
                    if (shouldCreateNewSourceFile) {
                        hostSourceFile.version++;
                    }
                    if (sourceFile) {
                        // Set the source file and create file watcher now that file was present on the disk
                        hostSourceFile.sourceFile = sourceFile;
                        sourceFile.version = hostSourceFile.version.toString();
                        if (!hostSourceFile.fileWatcher) {
                            hostSourceFile.fileWatcher = watchFilePath(host, fileName, onSourceFileChange, ts.PollingInterval.Low, path);
                        }
                    }
                    else {
                        // There is no source file on host any more, close the watch, missing file paths will track it
                        if (isFilePresentOnHost(hostSourceFile)) {
                            hostSourceFile.fileWatcher.close();
                        }
                        sourceFilesCache.set(path, hostSourceFile.version);
                    }
                }
                else {
                    if (sourceFile) {
                        sourceFile.version = initialVersion.toString();
                        const fileWatcher = watchFilePath(host, fileName, onSourceFileChange, ts.PollingInterval.Low, path);
                        sourceFilesCache.set(path, { sourceFile, version: initialVersion, fileWatcher });
                    }
                    else {
                        sourceFilesCache.set(path, initialVersion);
                    }
                }
                return sourceFile;
            }
            return hostSourceFile.sourceFile;
            function getNewSourceFile() {
                let text;
                try {
                    ts.performance.mark("beforeIORead");
                    text = host.readFile(fileName, compilerOptions.charset);
                    ts.performance.mark("afterIORead");
                    ts.performance.measure("I/O Read", "beforeIORead", "afterIORead");
                }
                catch (e) {
                    if (onError) {
                        onError(e.message);
                    }
                }
                return text !== undefined ? ts.createSourceFile(fileName, text, languageVersion) : undefined;
            }
        }
        function nextSourceFileVersion(path) {
            const hostSourceFile = sourceFilesCache.get(path);
            if (hostSourceFile !== undefined) {
                if (isFileMissingOnHost(hostSourceFile)) {
                    // The next version, lets set it as presence unknown file
                    sourceFilesCache.set(path, { version: Number(hostSourceFile) + 1 });
                }
                else {
                    hostSourceFile.version++;
                }
            }
        }
        function getSourceVersion(path) {
            const hostSourceFile = sourceFilesCache.get(path);
            return !hostSourceFile || isFileMissingOnHost(hostSourceFile) ? undefined : hostSourceFile.version.toString();
        }
        function onReleaseOldSourceFile(oldSourceFile, _oldOptions) {
            const hostSourceFileInfo = sourceFilesCache.get(oldSourceFile.path);
            // If this is the source file thats in the cache and new program doesnt need it,
            // remove the cached entry.
            // Note we arent deleting entry if file became missing in new program or
            // there was version update and new source file was created.
            if (hostSourceFileInfo) {
                // record the missing file paths so they can be removed later if watchers arent tracking them
                if (isFileMissingOnHost(hostSourceFileInfo)) {
                    (missingFilePathsRequestedForRelease || (missingFilePathsRequestedForRelease = [])).push(oldSourceFile.path);
                }
                else if (hostSourceFileInfo.sourceFile === oldSourceFile) {
                    if (hostSourceFileInfo.fileWatcher) {
                        hostSourceFileInfo.fileWatcher.close();
                    }
                    sourceFilesCache.delete(oldSourceFile.path);
                    resolutionCache.removeResolutionsOfFile(oldSourceFile.path);
                }
            }
        }
        function reportWatchDiagnostic(message) {
            if (host.onWatchStatusChange) {
                host.onWatchStatusChange(ts.createCompilerDiagnostic(message), newLine, compilerOptions || optionsToExtendForConfigFile);
            }
        }
        // Upon detecting a file change, wait for 250ms and then perform a recompilation. This gives batch
        // operations (such as saving all modified files in an editor) a chance to complete before we kick
        // off a new compilation.
        function scheduleProgramUpdate() {
            if (!host.setTimeout || !host.clearTimeout) {
                return;
            }
            if (timerToUpdateProgram) {
                host.clearTimeout(timerToUpdateProgram);
            }
            timerToUpdateProgram = host.setTimeout(updateProgram, 250);
        }
        function scheduleProgramReload() {
            ts.Debug.assert(!!configFileName);
            reloadLevel = ts.ConfigFileProgramReloadLevel.Full;
            scheduleProgramUpdate();
        }
        function updateProgram() {
            timerToUpdateProgram = undefined;
            reportWatchDiagnostic(Diagnostics.File_change_detected_Starting_incremental_compilation);
            switch (reloadLevel) {
                case ts.ConfigFileProgramReloadLevel.Partial:
                    return reloadFileNamesFromConfigFile();
                case ts.ConfigFileProgramReloadLevel.Full:
                    return reloadConfigFile();
                default:
                    synchronizeProgram();
                    return;
            }
        }
        function reloadFileNamesFromConfigFile() {
            const result = ts.getFileNamesFromConfigSpecs(configFileSpecs, ts.getDirectoryPath(configFileName), compilerOptions, parseConfigFileHost);
            if (result.fileNames.length) {
                configFileParsingDiagnostics = ts.filter(configFileParsingDiagnostics, error => !ts.isErrorNoInputFiles(error));
                hasChangedConfigFileParsingErrors = true;
            }
            else if (!configFileSpecs.filesSpecs && !ts.some(configFileParsingDiagnostics, ts.isErrorNoInputFiles)) {
                configFileParsingDiagnostics = configFileParsingDiagnostics.concat(ts.getErrorForNoInputFiles(configFileSpecs, configFileName));
                hasChangedConfigFileParsingErrors = true;
            }
            rootFileNames = result.fileNames;
            // Update the program
            synchronizeProgram();
        }
        function reloadConfigFile() {
            writeLog(`Reloading config file: ${configFileName}`);
            reloadLevel = ts.ConfigFileProgramReloadLevel.None;
            if (cachedDirectoryStructureHost) {
                cachedDirectoryStructureHost.clearCache();
            }
            parseConfigFile();
            hasChangedCompilerOptions = true;
            synchronizeProgram();
            // Update the wild card directory watch
            watchConfigFileWildCardDirectories();
        }
        function parseConfigFile() {
            setConfigFileParsingResult(ts.getParsedCommandLineOfConfigFile(configFileName, optionsToExtendForConfigFile, parseConfigFileHost));
        }
        function setConfigFileParsingResult(configFileParseResult) {
            rootFileNames = configFileParseResult.fileNames;
            compilerOptions = configFileParseResult.options;
            configFileSpecs = configFileParseResult.configFileSpecs;
            configFileParsingDiagnostics = ts.getConfigFileParsingDiagnostics(configFileParseResult);
            hasChangedConfigFileParsingErrors = true;
        }
        function onSourceFileChange(fileName, eventKind, path) {
            updateCachedSystemWithFile(fileName, path, eventKind);
            // Update the source file cache
            if (eventKind === ts.FileWatcherEventKind.Deleted && sourceFilesCache.get(path)) {
                resolutionCache.invalidateResolutionOfFile(path);
            }
            nextSourceFileVersion(path);
            // Update the program
            scheduleProgramUpdate();
        }
        function updateCachedSystemWithFile(fileName, path, eventKind) {
            if (cachedDirectoryStructureHost) {
                cachedDirectoryStructureHost.addOrDeleteFile(fileName, path, eventKind);
            }
        }
        function watchDirectory(directory, cb, flags) {
            return watchDirectoryWorker(host, directory, cb, flags);
        }
        function watchMissingFilePath(missingFilePath) {
            return watchFilePath(host, missingFilePath, onMissingFileChange, ts.PollingInterval.Medium, missingFilePath);
        }
        function onMissingFileChange(fileName, eventKind, missingFilePath) {
            updateCachedSystemWithFile(fileName, missingFilePath, eventKind);
            if (eventKind === ts.FileWatcherEventKind.Created && missingFilesMap.has(missingFilePath)) {
                missingFilesMap.get(missingFilePath).close();
                missingFilesMap.delete(missingFilePath);
                // Delete the entry in the source files cache so that new source file is created
                nextSourceFileVersion(missingFilePath);
                // When a missing file is created, we should update the graph.
                scheduleProgramUpdate();
            }
        }
        function watchConfigFileWildCardDirectories() {
            if (configFileSpecs) {
                ts.updateWatchingWildcardDirectories(watchedWildcardDirectories || (watchedWildcardDirectories = ts.createMap()), ts.createMapFromTemplate(configFileSpecs.wildcardDirectories), watchWildcardDirectory);
            }
            else if (watchedWildcardDirectories) {
                ts.clearMap(watchedWildcardDirectories, ts.closeFileWatcherOf);
            }
        }
        function watchWildcardDirectory(directory, flags) {
            return watchDirectory(directory, fileOrDirectory => {
                ts.Debug.assert(!!configFileName);
                const fileOrDirectoryPath = toPath(fileOrDirectory);
                // Since the file existance changed, update the sourceFiles cache
                if (cachedDirectoryStructureHost) {
                    cachedDirectoryStructureHost.addOrDeleteFileOrDirectory(fileOrDirectory, fileOrDirectoryPath);
                }
                nextSourceFileVersion(fileOrDirectoryPath);
                // If the the added or created file or directory is not supported file name, ignore the file
                // But when watched directory is added/removed, we need to reload the file list
                if (fileOrDirectoryPath !== directory && ts.hasExtension(fileOrDirectoryPath) && !ts.isSupportedSourceFileName(fileOrDirectory, compilerOptions)) {
                    writeLog(`Project: ${configFileName} Detected file add/remove of non supported extension: ${fileOrDirectory}`);
                    return;
                }
                // Reload is pending, do the reload
                if (reloadLevel !== ts.ConfigFileProgramReloadLevel.Full) {
                    reloadLevel = ts.ConfigFileProgramReloadLevel.Partial;
                    // Schedule Update the program
                    scheduleProgramUpdate();
                }
            }, flags);
        }
        function ensureDirectoriesExist(directoryPath) {
            if (directoryPath.length > ts.getRootLength(directoryPath) && !host.directoryExists(directoryPath)) {
                const parentDirectory = ts.getDirectoryPath(directoryPath);
                ensureDirectoriesExist(parentDirectory);
                host.createDirectory(directoryPath);
            }
        }
        function writeFile(fileName, text, writeByteOrderMark, onError) {
            try {
                ts.performance.mark("beforeIOWrite");
                ensureDirectoriesExist(ts.getDirectoryPath(ts.normalizePath(fileName)));
                host.writeFile(fileName, text, writeByteOrderMark);
                ts.performance.mark("afterIOWrite");
                ts.performance.measure("I/O Write", "beforeIOWrite", "afterIOWrite");
            }
            catch (e) {
                if (onError) {
                    onError(e.message);
                }
            }
        }
    }
    ts.createWatchProgram = createWatchProgram;
})(ts || (ts = {}));
