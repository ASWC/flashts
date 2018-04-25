var ts;
(function (ts) {
    var server;
    (function (server) {
        server.maxProgramSizeForNonTsFiles = 20 * 1024 * 1024;
        // tslint:disable variable-name
        server.ProjectsUpdatedInBackgroundEvent = "projectsUpdatedInBackground";
        server.ConfigFileDiagEvent = "configFileDiag";
        server.ProjectLanguageServiceStateEvent = "projectLanguageServiceState";
        server.ProjectInfoTelemetryEvent = "projectInfo";
        function prepareConvertersForEnumLikeCompilerOptions(commandLineOptions) {
            const map = ts.createMap();
            for (const option of commandLineOptions) {
                if (typeof option.type === "object") {
                    const optionMap = option.type;
                    // verify that map contains only numbers
                    optionMap.forEach(value => {
                        ts.Debug.assert(typeof value === "number");
                    });
                    map.set(option.name, optionMap);
                }
            }
            return map;
        }
        const compilerOptionConverters = prepareConvertersForEnumLikeCompilerOptions(ts.optionDeclarations);
        const indentStyle = ts.createMapFromTemplate({
            none: ts.IndentStyle.None,
            block: ts.IndentStyle.Block,
            smart: ts.IndentStyle.Smart
        });
        /**
         * How to understand this block:
         *  * The 'match' property is a regexp that matches a filename.
         *  * If 'match' is successful, then:
         *     * All files from 'exclude' are removed from the project. See below.
         *     * All 'types' are included in ATA
         *  * What the heck is 'exclude' ?
         *     * An array of an array of strings and numbers
         *     * Each array is:
         *       * An array of strings and numbers
         *       * The strings are literals
         *       * The numbers refer to capture group indices from the 'match' regexp
         *          * Remember that '1' is the first group
         *       * These are concatenated together to form a new regexp
         *       * Filenames matching these regexps are excluded from the project
         * This default value is tested in tsserverProjectSystem.ts; add tests there
         *   if you are changing this so that you can be sure your regexp works!
         */
        const defaultTypeSafeList = {
            "jquery": {
                // jquery files can have names like "jquery-1.10.2.min.js" (or "jquery.intellisense.js")
                match: /jquery(-(\.?\d+)+)?(\.intellisense)?(\.min)?\.js$/i,
                types: ["jquery"]
            },
            "WinJS": {
                // e.g. c:/temp/UWApp1/lib/winjs-4.0.1/js/base.js
                match: /^(.*\/winjs-[.\d]+)\/js\/base\.js$/i,
                exclude: [["^", 1, "/.*"]],
                types: ["winjs"] // And fetch the @types package for WinJS
            },
            "Kendo": {
                // e.g. /Kendo3/wwwroot/lib/kendo/kendo.all.min.js
                match: /^(.*\/kendo(-ui)?)\/kendo\.all(\.min)?\.js$/i,
                exclude: [["^", 1, "/.*"]],
                types: ["kendo-ui"]
            },
            "Office Nuget": {
                // e.g. /scripts/Office/1/excel-15.debug.js
                match: /^(.*\/office\/1)\/excel-\d+\.debug\.js$/i,
                exclude: [["^", 1, "/.*"]],
                types: ["office"] // @types package to fetch instead
            },
            "References": {
                match: /^(.*\/_references\.js)$/i,
                exclude: [["^", 1, "$"]]
            }
        };
        function convertFormatOptions(protocolOptions) {
            if (ts.isString(protocolOptions.indentStyle)) {
                protocolOptions.indentStyle = indentStyle.get(protocolOptions.indentStyle.toLowerCase());
                ts.Debug.assert(protocolOptions.indentStyle !== undefined);
            }
            return protocolOptions;
        }
        server.convertFormatOptions = convertFormatOptions;
        function convertCompilerOptions(protocolOptions) {
            compilerOptionConverters.forEach((mappedValues, id) => {
                const propertyValue = protocolOptions[id];
                if (ts.isString(propertyValue)) {
                    protocolOptions[id] = mappedValues.get(propertyValue.toLowerCase());
                }
            });
            return protocolOptions;
        }
        server.convertCompilerOptions = convertCompilerOptions;
        function tryConvertScriptKindName(scriptKindName) {
            return ts.isString(scriptKindName) ? convertScriptKindName(scriptKindName) : scriptKindName;
        }
        server.tryConvertScriptKindName = tryConvertScriptKindName;
        function convertScriptKindName(scriptKindName) {
            switch (scriptKindName) {
                case "JS":
                    return ts.ScriptKind.JS;
                case "JSX":
                    return ts.ScriptKind.JSX;
                case "TS":
                    return ts.ScriptKind.TS;
                case "TSX":
                    return ts.ScriptKind.TSX;
                default:
                    return ts.ScriptKind.Unknown;
            }
        }
        server.convertScriptKindName = convertScriptKindName;
        const fileNamePropertyReader = {
            getFileName: x => x,
            getScriptKind: (fileName, extraFileExtensions) => {
                let result;
                if (extraFileExtensions) {
                    const fileExtension = ts.getAnyExtensionFromPath(fileName);
                    if (fileExtension) {
                        ts.some(extraFileExtensions, info => {
                            if (info.extension === fileExtension) {
                                result = info.scriptKind;
                                return true;
                            }
                            return false;
                        });
                    }
                }
                return result;
            },
            hasMixedContent: (fileName, extraFileExtensions) => ts.some(extraFileExtensions, ext => ext.isMixedContent && ts.fileExtensionIs(fileName, ext.extension)),
        };
        const externalFilePropertyReader = {
            getFileName: x => x.fileName,
            getScriptKind: x => tryConvertScriptKindName(x.scriptKind),
            hasMixedContent: x => x.hasMixedContent,
        };
        function findProjectByName(projectName, projects) {
            for (const proj of projects) {
                if (proj.getProjectName() === projectName) {
                    return proj;
                }
            }
        }
        function getDetailWatchInfo(watchType, project) {
            return `Project: ${project ? project.getProjectName() : ""} WatchType: ${watchType}`;
        }
        class ProjectService {
            constructor(opts) {
                /**
                 * Container of all known scripts
                 */
                this.filenameToScriptInfo = ts.createMap();
                /**
                 * maps external project file name to list of config files that were the part of this project
                 */
                this.externalProjectToConfiguredProjectMap = ts.createMap();
                /**
                 * external projects (configuration and list of root files is not controlled by tsserver)
                 */
                this.externalProjects = [];
                /**
                 * projects built from openFileRoots
                 */
                this.inferredProjects = [];
                /**
                 * projects specified by a tsconfig.json file
                 */
                this.configuredProjects = ts.createMap();
                /**
                 * Open files: with value being project root path, and key being Path of the file that is open
                 */
                this.openFiles = ts.createMap();
                /**
                 * Map of open files that are opened without complete path but have projectRoot as current directory
                 */
                this.openFilesWithNonRootedDiskPath = ts.createMap();
                this.compilerOptionsForInferredProjectsPerProjectRoot = ts.createMap();
                /**
                 * Project size for configured or external projects
                 */
                this.projectToSizeMap = ts.createMap();
                /**
                 * This is a map of config file paths existance that doesnt need query to disk
                 * - The entry can be present because there is inferred project that needs to watch addition of config file to directory
                 *   In this case the exists could be true/false based on config file is present or not
                 * - Or it is present if we have configured project open with config file at that location
                 *   In this case the exists property is always true
                 */
                this.configFileExistenceInfoCache = ts.createMap();
                this.safelist = defaultTypeSafeList;
                this.legacySafelist = {};
                this.pendingProjectUpdates = ts.createMap();
                /** Tracks projects that we have already sent telemetry for. */
                this.seenProjects = ts.createMap();
                this.host = opts.host;
                this.logger = opts.logger;
                this.cancellationToken = opts.cancellationToken;
                this.useSingleInferredProject = opts.useSingleInferredProject;
                this.useInferredProjectPerProjectRoot = opts.useInferredProjectPerProjectRoot;
                this.typingsInstaller = opts.typingsInstaller || server.nullTypingsInstaller;
                this.throttleWaitMilliseconds = opts.throttleWaitMilliseconds;
                this.eventHandler = opts.eventHandler;
                this.suppressDiagnosticEvents = opts.suppressDiagnosticEvents;
                this.globalPlugins = opts.globalPlugins || server.emptyArray;
                this.pluginProbeLocations = opts.pluginProbeLocations || server.emptyArray;
                this.allowLocalPluginLoads = !!opts.allowLocalPluginLoads;
                this.typesMapLocation = (opts.typesMapLocation === undefined) ? ts.combinePaths(this.getExecutingFilePath(), "../typesMap.json") : opts.typesMapLocation;
                this.syntaxOnly = opts.syntaxOnly;
                ts.Debug.assert(!!this.host.createHash, "'ServerHost.createHash' is required for ProjectService");
                if (this.host.realpath) {
                    this.realpathToScriptInfos = ts.createMultiMap();
                }
                this.currentDirectory = this.host.getCurrentDirectory();
                this.toCanonicalFileName = ts.createGetCanonicalFileName(this.host.useCaseSensitiveFileNames);
                this.globalCacheLocationDirectoryPath = this.typingsInstaller.globalTypingsCacheLocation &&
                    ts.ensureTrailingDirectorySeparator(this.toPath(this.typingsInstaller.globalTypingsCacheLocation));
                this.throttledOperations = new server.ThrottledOperations(this.host, this.logger);
                if (this.typesMapLocation) {
                    this.loadTypesMap();
                }
                else {
                    this.logger.info("No types map provided; using the default");
                }
                this.typingsInstaller.attach(this);
                this.typingsCache = new server.TypingsCache(this.typingsInstaller);
                this.hostConfiguration = {
                    formatCodeOptions: server.getDefaultFormatCodeSettings(this.host),
                    preferences: ts.defaultPreferences,
                    hostInfo: "Unknown host",
                    extraFileExtensions: []
                };
                this.documentRegistry = ts.createDocumentRegistry(this.host.useCaseSensitiveFileNames, this.currentDirectory);
                const watchLogLevel = this.logger.hasLevel(server.LogLevel.verbose) ? ts.WatchLogLevel.Verbose :
                    this.logger.loggingEnabled() ? ts.WatchLogLevel.TriggerOnly : ts.WatchLogLevel.None;
                const log = watchLogLevel !== ts.WatchLogLevel.None ? (s => this.logger.info(s)) : ts.noop;
                this.watchFactory = ts.getWatchFactory(watchLogLevel, log, getDetailWatchInfo);
            }
            toPath(fileName) {
                return ts.toPath(fileName, this.currentDirectory, this.toCanonicalFileName);
            }
            /*@internal*/
            getExecutingFilePath() {
                return this.getNormalizedAbsolutePath(this.host.getExecutingFilePath());
            }
            /*@internal*/
            getNormalizedAbsolutePath(fileName) {
                return ts.getNormalizedAbsolutePath(fileName, this.host.getCurrentDirectory());
            }
            /* @internal */
            ensureInferredProjectsUpToDate_TestOnly() {
                this.ensureProjectStructuresUptoDate();
            }
            /* @internal */
            getCompilerOptionsForInferredProjects() {
                return this.compilerOptionsForInferredProjects;
            }
            /* @internal */
            onUpdateLanguageServiceStateForProject(project, languageServiceEnabled) {
                if (!this.eventHandler) {
                    return;
                }
                const event = {
                    eventName: server.ProjectLanguageServiceStateEvent,
                    data: { project, languageServiceEnabled }
                };
                this.eventHandler(event);
            }
            loadTypesMap() {
                try {
                    const fileContent = this.host.readFile(this.typesMapLocation);
                    if (fileContent === undefined) {
                        this.logger.info(`Provided types map file "${this.typesMapLocation}" doesn't exist`);
                        return;
                    }
                    const raw = JSON.parse(fileContent);
                    // Parse the regexps
                    for (const k of Object.keys(raw.typesMap)) {
                        raw.typesMap[k].match = new RegExp(raw.typesMap[k].match, "i");
                    }
                    // raw is now fixed and ready
                    this.safelist = raw.typesMap;
                    for (const key in raw.simpleMap) {
                        if (raw.simpleMap.hasOwnProperty(key)) {
                            this.legacySafelist[key] = raw.simpleMap[key].toLowerCase();
                        }
                    }
                }
                catch (e) {
                    this.logger.info(`Error loading types map: ${e}`);
                    this.safelist = defaultTypeSafeList;
                    this.legacySafelist = {};
                }
            }
            updateTypingsForProject(response) {
                const project = this.findProject(response.projectName);
                if (!project) {
                    return;
                }
                switch (response.kind) {
                    case server.ActionSet:
                        // Update the typing files and update the project
                        project.updateTypingFiles(this.typingsCache.updateTypingsForProject(response.projectName, response.compilerOptions, response.typeAcquisition, response.unresolvedImports, response.typings));
                        break;
                    case server.ActionInvalidate:
                        // Do not clear resolution cache, there was changes detected in typings, so enque typing request and let it get us correct results
                        this.typingsCache.enqueueInstallTypingsForProject(project, project.lastCachedUnresolvedImportsList, /*forceRefresh*/ true);
                        return;
                }
                this.delayUpdateProjectGraphAndEnsureProjectStructureForOpenFiles(project);
            }
            delayEnsureProjectForOpenFiles() {
                this.pendingEnsureProjectForOpenFiles = true;
                this.throttledOperations.schedule("*ensureProjectForOpenFiles*", /*delay*/ 250, () => {
                    if (this.pendingProjectUpdates.size !== 0) {
                        this.delayEnsureProjectForOpenFiles();
                    }
                    else {
                        if (this.pendingEnsureProjectForOpenFiles) {
                            this.ensureProjectForOpenFiles();
                            // Send the event to notify that there were background project updates
                            // send current list of open files
                            this.sendProjectsUpdatedInBackgroundEvent();
                        }
                    }
                });
            }
            delayUpdateProjectGraph(project) {
                project.markAsDirty();
                const projectName = project.getProjectName();
                this.pendingProjectUpdates.set(projectName, project);
                this.throttledOperations.schedule(projectName, /*delay*/ 250, () => {
                    if (this.pendingProjectUpdates.delete(projectName)) {
                        project.updateGraph();
                    }
                });
            }
            /*@internal*/
            hasPendingProjectUpdate(project) {
                return this.pendingProjectUpdates.has(project.getProjectName());
            }
            sendProjectsUpdatedInBackgroundEvent() {
                if (!this.eventHandler) {
                    return;
                }
                const event = {
                    eventName: server.ProjectsUpdatedInBackgroundEvent,
                    data: {
                        openFiles: ts.arrayFrom(this.openFiles.keys(), path => this.getScriptInfoForPath(path).fileName)
                    }
                };
                this.eventHandler(event);
            }
            /* @internal */
            delayUpdateProjectGraphAndEnsureProjectStructureForOpenFiles(project) {
                this.delayUpdateProjectGraph(project);
                this.delayEnsureProjectForOpenFiles();
            }
            delayUpdateProjectGraphs(projects) {
                for (const project of projects) {
                    this.delayUpdateProjectGraph(project);
                }
                this.delayEnsureProjectForOpenFiles();
            }
            setCompilerOptionsForInferredProjects(projectCompilerOptions, projectRootPath) {
                ts.Debug.assert(projectRootPath === undefined || this.useInferredProjectPerProjectRoot, "Setting compiler options per project root path is only supported when useInferredProjectPerProjectRoot is enabled");
                const compilerOptions = convertCompilerOptions(projectCompilerOptions);
                // always set 'allowNonTsExtensions' for inferred projects since user cannot configure it from the outside
                // previously we did not expose a way for user to change these settings and this option was enabled by default
                compilerOptions.allowNonTsExtensions = true;
                const canonicalProjectRootPath = projectRootPath && this.toCanonicalFileName(projectRootPath);
                if (canonicalProjectRootPath) {
                    this.compilerOptionsForInferredProjectsPerProjectRoot.set(canonicalProjectRootPath, compilerOptions);
                }
                else {
                    this.compilerOptionsForInferredProjects = compilerOptions;
                }
                for (const project of this.inferredProjects) {
                    // Only update compiler options in the following cases:
                    // - Inferred projects without a projectRootPath, if the new options do not apply to
                    //   a workspace root
                    // - Inferred projects with a projectRootPath, if the new options do not apply to a
                    //   workspace root and there is no more specific set of options for that project's
                    //   root path
                    // - Inferred projects with a projectRootPath, if the new options apply to that
                    //   project root path.
                    if (canonicalProjectRootPath ?
                        project.projectRootPath === canonicalProjectRootPath :
                        !project.projectRootPath || !this.compilerOptionsForInferredProjectsPerProjectRoot.has(project.projectRootPath)) {
                        project.setCompilerOptions(compilerOptions);
                        project.compileOnSaveEnabled = compilerOptions.compileOnSave;
                        project.markAsDirty();
                        this.delayUpdateProjectGraph(project);
                    }
                }
                this.delayEnsureProjectForOpenFiles();
            }
            findProject(projectName) {
                if (projectName === undefined) {
                    return undefined;
                }
                if (server.isInferredProjectName(projectName)) {
                    return findProjectByName(projectName, this.inferredProjects);
                }
                return this.findExternalProjectByProjectName(projectName) || this.findConfiguredProjectByProjectName(server.toNormalizedPath(projectName));
            }
            getDefaultProjectForFile(fileName, ensureProject) {
                let scriptInfo = this.getScriptInfoForNormalizedPath(fileName);
                if (ensureProject && (!scriptInfo || scriptInfo.isOrphan())) {
                    this.ensureProjectStructuresUptoDate();
                    scriptInfo = this.getScriptInfoForNormalizedPath(fileName);
                    if (!scriptInfo) {
                        return server.Errors.ThrowNoProject();
                    }
                    return scriptInfo.getDefaultProject();
                }
                return scriptInfo && !scriptInfo.isOrphan() && scriptInfo.getDefaultProject();
            }
            getScriptInfoEnsuringProjectsUptoDate(uncheckedFileName) {
                this.ensureProjectStructuresUptoDate();
                return this.getScriptInfo(uncheckedFileName);
            }
            /**
             * Ensures the project structures are upto date
             * This means,
             * - we go through all the projects and update them if they are dirty
             * - if updates reflect some change in structure or there was pending request to ensure projects for open files
             *   ensure that each open script info has project
             */
            ensureProjectStructuresUptoDate() {
                let hasChanges = this.pendingEnsureProjectForOpenFiles;
                this.pendingProjectUpdates.clear();
                const updateGraph = (project) => {
                    hasChanges = this.updateProjectIfDirty(project) || hasChanges;
                };
                this.externalProjects.forEach(updateGraph);
                this.configuredProjects.forEach(updateGraph);
                this.inferredProjects.forEach(updateGraph);
                if (hasChanges) {
                    this.ensureProjectForOpenFiles();
                }
            }
            updateProjectIfDirty(project) {
                return project.dirty && project.updateGraph();
            }
            getFormatCodeOptions(file) {
                const info = this.getScriptInfoForNormalizedPath(file);
                return info && info.getFormatCodeSettings() || this.hostConfiguration.formatCodeOptions;
            }
            getPreferences(file) {
                const info = this.getScriptInfoForNormalizedPath(file);
                return info && info.getPreferences() || this.hostConfiguration.preferences;
            }
            onSourceFileChanged(fileName, eventKind, path) {
                const info = this.getScriptInfoForPath(path);
                if (!info) {
                    this.logger.msg(`Error: got watch notification for unknown file: ${fileName}`);
                }
                else if (eventKind === ts.FileWatcherEventKind.Deleted) {
                    // File was deleted
                    this.handleDeletedFile(info);
                }
                else if (!info.isScriptOpen()) {
                    if (info.containingProjects.length === 0) {
                        // Orphan script info, remove it as we can always reload it on next open file request
                        this.stopWatchingScriptInfo(info);
                        this.deleteScriptInfo(info);
                    }
                    else {
                        // file has been changed which might affect the set of referenced files in projects that include
                        // this file and set of inferred projects
                        info.delayReloadNonMixedContentFile();
                        this.delayUpdateProjectGraphs(info.containingProjects);
                    }
                }
            }
            handleDeletedFile(info) {
                this.stopWatchingScriptInfo(info);
                if (!info.isScriptOpen()) {
                    this.deleteScriptInfo(info);
                    // capture list of projects since detachAllProjects will wipe out original list
                    const containingProjects = info.containingProjects.slice();
                    info.detachAllProjects();
                    // update projects to make sure that set of referenced files is correct
                    this.delayUpdateProjectGraphs(containingProjects);
                }
            }
            /**
             * This is to watch whenever files are added or removed to the wildcard directories
             */
            /*@internal*/
            watchWildcardDirectory(directory, flags, project) {
                return this.watchFactory.watchDirectory(this.host, directory, fileOrDirectory => {
                    const fileOrDirectoryPath = this.toPath(fileOrDirectory);
                    project.getCachedDirectoryStructureHost().addOrDeleteFileOrDirectory(fileOrDirectory, fileOrDirectoryPath);
                    const configFilename = project.getConfigFilePath();
                    // If the the added or created file or directory is not supported file name, ignore the file
                    // But when watched directory is added/removed, we need to reload the file list
                    if (fileOrDirectoryPath !== directory && ts.hasExtension(fileOrDirectoryPath) && !ts.isSupportedSourceFileName(fileOrDirectory, project.getCompilationSettings(), this.hostConfiguration.extraFileExtensions)) {
                        this.logger.info(`Project: ${configFilename} Detected file add/remove of non supported extension: ${fileOrDirectory}`);
                        return;
                    }
                    // Reload is pending, do the reload
                    if (project.pendingReload !== ts.ConfigFileProgramReloadLevel.Full) {
                        project.pendingReload = ts.ConfigFileProgramReloadLevel.Partial;
                        this.delayUpdateProjectGraphAndEnsureProjectStructureForOpenFiles(project);
                    }
                }, flags, "Wild card directory" /* WildcardDirectories */, project);
            }
            /** Gets the config file existence info for the configured project */
            /*@internal*/
            getConfigFileExistenceInfo(project) {
                return this.configFileExistenceInfoCache.get(project.canonicalConfigFilePath);
            }
            onConfigChangedForConfiguredProject(project, eventKind) {
                const configFileExistenceInfo = this.getConfigFileExistenceInfo(project);
                if (eventKind === ts.FileWatcherEventKind.Deleted) {
                    // Update the cached status
                    // We arent updating or removing the cached config file presence info as that will be taken care of by
                    // setConfigFilePresenceByClosedConfigFile when the project is closed (depending on tracking open files)
                    configFileExistenceInfo.exists = false;
                    this.removeProject(project);
                    // Reload the configured projects for the open files in the map as they are affectected by this config file
                    // Since the configured project was deleted, we want to reload projects for all the open files including files
                    // that are not root of the inferred project
                    this.logConfigFileWatchUpdate(project.getConfigFilePath(), project.canonicalConfigFilePath, configFileExistenceInfo, "Reloading configured projects for files" /* ReloadingFiles */);
                    this.delayReloadConfiguredProjectForFiles(configFileExistenceInfo, /*ignoreIfNotInferredProjectRoot*/ false);
                }
                else {
                    this.logConfigFileWatchUpdate(project.getConfigFilePath(), project.canonicalConfigFilePath, configFileExistenceInfo, "Reloading configured projects for only inferred root files" /* ReloadingInferredRootFiles */);
                    project.pendingReload = ts.ConfigFileProgramReloadLevel.Full;
                    this.delayUpdateProjectGraph(project);
                    // As we scheduled the update on configured project graph,
                    // we would need to schedule the project reload for only the root of inferred projects
                    this.delayReloadConfiguredProjectForFiles(configFileExistenceInfo, /*ignoreIfNotInferredProjectRoot*/ true);
                }
            }
            /**
             * This is the callback function for the config file add/remove/change at any location
             * that matters to open script info but doesnt have configured project open
             * for the config file
             */
            onConfigFileChangeForOpenScriptInfo(configFileName, eventKind) {
                // This callback is called only if we dont have config file project for this config file
                const canonicalConfigPath = server.normalizedPathToPath(configFileName, this.currentDirectory, this.toCanonicalFileName);
                const configFileExistenceInfo = this.configFileExistenceInfoCache.get(canonicalConfigPath);
                configFileExistenceInfo.exists = (eventKind !== ts.FileWatcherEventKind.Deleted);
                this.logConfigFileWatchUpdate(configFileName, canonicalConfigPath, configFileExistenceInfo, "Reloading configured projects for files" /* ReloadingFiles */);
                // Because there is no configured project open for the config file, the tracking open files map
                // will only have open files that need the re-detection of the project and hence
                // reload projects for all the tracking open files in the map
                this.delayReloadConfiguredProjectForFiles(configFileExistenceInfo, /*ignoreIfNotInferredProjectRoot*/ false);
            }
            removeProject(project) {
                this.logger.info(`remove project: ${project.getRootFiles().toString()}`);
                project.close();
                if (ts.Debug.shouldAssert(1 /* Normal */)) {
                    this.filenameToScriptInfo.forEach(info => ts.Debug.assert(!info.isAttached(project)));
                }
                // Remove the project from pending project updates
                this.pendingProjectUpdates.delete(project.getProjectName());
                switch (project.projectKind) {
                    case server.ProjectKind.External:
                        ts.unorderedRemoveItem(this.externalProjects, project);
                        this.projectToSizeMap.delete(project.getProjectName());
                        break;
                    case server.ProjectKind.Configured:
                        this.configuredProjects.delete(project.canonicalConfigFilePath);
                        this.projectToSizeMap.delete(project.canonicalConfigFilePath);
                        this.setConfigFileExistenceInfoByClosedConfiguredProject(project);
                        break;
                    case server.ProjectKind.Inferred:
                        ts.unorderedRemoveItem(this.inferredProjects, project);
                        break;
                }
            }
            /*@internal*/
            assignOrphanScriptInfoToInferredProject(info, projectRootPath) {
                ts.Debug.assert(info.isOrphan());
                const project = this.getOrCreateInferredProjectForProjectRootPathIfEnabled(info, projectRootPath) ||
                    this.getOrCreateSingleInferredProjectIfEnabled() ||
                    this.createInferredProject(info.isDynamic ? this.currentDirectory : ts.getDirectoryPath(info.path));
                project.addRoot(info);
                project.updateGraph();
                if (!this.useSingleInferredProject && !project.projectRootPath) {
                    // Note that we need to create a copy of the array since the list of project can change
                    for (const inferredProject of this.inferredProjects.slice(0, this.inferredProjects.length - 1)) {
                        ts.Debug.assert(inferredProject !== project);
                        // Remove the inferred project if the root of it is now part of newly created inferred project
                        // e.g through references
                        // Which means if any root of inferred project is part of more than 1 project can be removed
                        // This logic is same as iterating over all open files and calling
                        // this.removeRootOfInferredProjectIfNowPartOfOtherProject(f);
                        // Since this is also called from refreshInferredProject and closeOpen file
                        // to update inferred projects of the open file, this iteration might be faster
                        // instead of scanning all open files
                        const roots = inferredProject.getRootScriptInfos();
                        ts.Debug.assert(roots.length === 1 || !!inferredProject.projectRootPath);
                        if (roots.length === 1 && roots[0].containingProjects.length > 1) {
                            this.removeProject(inferredProject);
                        }
                    }
                }
                return project;
            }
            /**
             * Remove this file from the set of open, non-configured files.
             * @param info The file that has been closed or newly configured
             */
            closeOpenFile(info) {
                // Closing file should trigger re-reading the file content from disk. This is
                // because the user may chose to discard the buffer content before saving
                // to the disk, and the server's version of the file can be out of sync.
                const fileExists = this.host.fileExists(info.fileName);
                info.close(fileExists);
                this.stopWatchingConfigFilesForClosedScriptInfo(info);
                this.openFiles.delete(info.path);
                const canonicalFileName = this.toCanonicalFileName(info.fileName);
                if (this.openFilesWithNonRootedDiskPath.get(canonicalFileName) === info) {
                    this.openFilesWithNonRootedDiskPath.delete(canonicalFileName);
                }
                // collect all projects that should be removed
                let projectsToRemove;
                for (const p of info.containingProjects) {
                    if (p.projectKind === server.ProjectKind.Configured) {
                        if (info.hasMixedContent) {
                            info.registerFileUpdate();
                        }
                        // Do not remove the project so that we can reuse this project
                        // if it would need to be re-created with next file open
                    }
                    else if (p.projectKind === server.ProjectKind.Inferred && p.isRoot(info)) {
                        // If this was the open root file of inferred project
                        if (p.isProjectWithSingleRoot()) {
                            // - when useSingleInferredProject is not set, we can guarantee that this will be the only root
                            // - other wise remove the project if it is the only root
                            (projectsToRemove || (projectsToRemove = [])).push(p);
                        }
                        else {
                            p.removeFile(info, fileExists, /*detachFromProject*/ true);
                        }
                    }
                    if (!p.languageServiceEnabled) {
                        // if project language service is disabled then we create a program only for open files.
                        // this means that project should be marked as dirty to force rebuilding of the program
                        // on the next request
                        p.markAsDirty();
                    }
                }
                if (projectsToRemove) {
                    for (const project of projectsToRemove) {
                        this.removeProject(project);
                    }
                    // collect orphaned files and assign them to inferred project just like we treat open of a file
                    this.openFiles.forEach((projectRootPath, path) => {
                        const f = this.getScriptInfoForPath(path);
                        if (f.isOrphan()) {
                            this.assignOrphanScriptInfoToInferredProject(f, projectRootPath);
                        }
                    });
                    // Cleanup script infos that arent part of any project (eg. those could be closed script infos not referenced by any project)
                    // is postponed to next file open so that if file from same project is opened,
                    // we wont end up creating same script infos
                }
                // If the current info is being just closed - add the watcher file to track changes
                // But if file was deleted, handle that part
                if (fileExists) {
                    this.watchClosedScriptInfo(info);
                }
                else {
                    this.handleDeletedFile(info);
                }
            }
            deleteOrphanScriptInfoNotInAnyProject() {
                this.filenameToScriptInfo.forEach(info => {
                    if (!info.isScriptOpen() && info.isOrphan()) {
                        // if there are not projects that include this script info - delete it
                        this.stopWatchingScriptInfo(info);
                        this.deleteScriptInfo(info);
                    }
                });
            }
            deleteScriptInfo(info) {
                this.filenameToScriptInfo.delete(info.path);
                const realpath = info.getRealpathIfDifferent();
                if (realpath) {
                    this.realpathToScriptInfos.remove(realpath, info);
                }
            }
            configFileExists(configFileName, canonicalConfigFilePath, info) {
                let configFileExistenceInfo = this.configFileExistenceInfoCache.get(canonicalConfigFilePath);
                if (configFileExistenceInfo) {
                    // By default the info would get impacted by presence of config file since its in the detection path
                    // Only adding the info as a root to inferred project will need the existence to be watched by file watcher
                    if (!configFileExistenceInfo.openFilesImpactedByConfigFile.has(info.path)) {
                        configFileExistenceInfo.openFilesImpactedByConfigFile.set(info.path, false);
                        this.logConfigFileWatchUpdate(configFileName, canonicalConfigFilePath, configFileExistenceInfo, "File added to open files impacted by this config file" /* OpenFilesImpactedByConfigFileAdd */);
                    }
                    return configFileExistenceInfo.exists;
                }
                // Theoretically we should be adding watch for the directory here itself.
                // In practice there will be very few scenarios where the config file gets added
                // somewhere inside the another config file directory.
                // And technically we could handle that case in configFile's directory watcher in some cases
                // But given that its a rare scenario it seems like too much overhead. (we werent watching those directories earlier either)
                // So what we are now watching is: configFile if the configured project corresponding to it is open
                // Or the whole chain of config files for the roots of the inferred projects
                // Cache the host value of file exists and add the info to map of open files impacted by this config file
                const openFilesImpactedByConfigFile = ts.createMap();
                openFilesImpactedByConfigFile.set(info.path, false);
                const exists = this.host.fileExists(configFileName);
                configFileExistenceInfo = { exists, openFilesImpactedByConfigFile };
                this.configFileExistenceInfoCache.set(canonicalConfigFilePath, configFileExistenceInfo);
                this.logConfigFileWatchUpdate(configFileName, canonicalConfigFilePath, configFileExistenceInfo, "File added to open files impacted by this config file" /* OpenFilesImpactedByConfigFileAdd */);
                return exists;
            }
            setConfigFileExistenceByNewConfiguredProject(project) {
                const configFileExistenceInfo = this.getConfigFileExistenceInfo(project);
                if (configFileExistenceInfo) {
                    ts.Debug.assert(configFileExistenceInfo.exists);
                    // close existing watcher
                    if (configFileExistenceInfo.configFileWatcherForRootOfInferredProject) {
                        const configFileName = project.getConfigFilePath();
                        configFileExistenceInfo.configFileWatcherForRootOfInferredProject.close();
                        configFileExistenceInfo.configFileWatcherForRootOfInferredProject = undefined;
                        this.logConfigFileWatchUpdate(configFileName, project.canonicalConfigFilePath, configFileExistenceInfo, "Updated the callback" /* UpdatedCallback */);
                    }
                }
                else {
                    // We could be in this scenario if project is the configured project tracked by external project
                    // Since that route doesnt check if the config file is present or not
                    this.configFileExistenceInfoCache.set(project.canonicalConfigFilePath, {
                        exists: true,
                        openFilesImpactedByConfigFile: ts.createMap()
                    });
                }
            }
            /**
             * Returns true if the configFileExistenceInfo is needed/impacted by open files that are root of inferred project
             */
            configFileExistenceImpactsRootOfInferredProject(configFileExistenceInfo) {
                return ts.forEachEntry(configFileExistenceInfo.openFilesImpactedByConfigFile, (isRootOfInferredProject) => isRootOfInferredProject);
            }
            setConfigFileExistenceInfoByClosedConfiguredProject(closedProject) {
                const configFileExistenceInfo = this.getConfigFileExistenceInfo(closedProject);
                ts.Debug.assert(!!configFileExistenceInfo);
                if (configFileExistenceInfo.openFilesImpactedByConfigFile.size) {
                    const configFileName = closedProject.getConfigFilePath();
                    // If there are open files that are impacted by this config file existence
                    // but none of them are root of inferred project, the config file watcher will be
                    // created when any of the script infos are added as root of inferred project
                    if (this.configFileExistenceImpactsRootOfInferredProject(configFileExistenceInfo)) {
                        ts.Debug.assert(!configFileExistenceInfo.configFileWatcherForRootOfInferredProject);
                        this.createConfigFileWatcherOfConfigFileExistence(configFileName, closedProject.canonicalConfigFilePath, configFileExistenceInfo);
                    }
                }
                else {
                    // There is not a single file open thats tracking the status of this config file. Remove from cache
                    this.configFileExistenceInfoCache.delete(closedProject.canonicalConfigFilePath);
                }
            }
            logConfigFileWatchUpdate(configFileName, canonicalConfigFilePath, configFileExistenceInfo, status) {
                if (!this.logger.hasLevel(server.LogLevel.verbose)) {
                    return;
                }
                const inferredRoots = [];
                const otherFiles = [];
                configFileExistenceInfo.openFilesImpactedByConfigFile.forEach((isRootOfInferredProject, key) => {
                    const info = this.getScriptInfoForPath(key);
                    (isRootOfInferredProject ? inferredRoots : otherFiles).push(info.fileName);
                });
                const watches = [];
                if (configFileExistenceInfo.configFileWatcherForRootOfInferredProject) {
                    watches.push("Config file for the inferred project root" /* ConfigFileForInferredRoot */);
                }
                if (this.configuredProjects.has(canonicalConfigFilePath)) {
                    watches.push("Config file for the program" /* ConfigFilePath */);
                }
                this.logger.info(`ConfigFilePresence:: Current Watches: ${watches}:: File: ${configFileName} Currently impacted open files: RootsOfInferredProjects: ${inferredRoots} OtherOpenFiles: ${otherFiles} Status: ${status}`);
            }
            /**
             * Create the watcher for the configFileExistenceInfo
             */
            createConfigFileWatcherOfConfigFileExistence(configFileName, canonicalConfigFilePath, configFileExistenceInfo) {
                configFileExistenceInfo.configFileWatcherForRootOfInferredProject = this.watchFactory.watchFile(this.host, configFileName, (_filename, eventKind) => this.onConfigFileChangeForOpenScriptInfo(configFileName, eventKind), ts.PollingInterval.High, "Config file for the inferred project root" /* ConfigFileForInferredRoot */);
                this.logConfigFileWatchUpdate(configFileName, canonicalConfigFilePath, configFileExistenceInfo, "Updated the callback" /* UpdatedCallback */);
            }
            /**
             * Close the config file watcher in the cached ConfigFileExistenceInfo
             *   if there arent any open files that are root of inferred project
             */
            closeConfigFileWatcherOfConfigFileExistenceInfo(configFileExistenceInfo) {
                // Close the config file watcher if there are no more open files that are root of inferred project
                if (configFileExistenceInfo.configFileWatcherForRootOfInferredProject &&
                    !this.configFileExistenceImpactsRootOfInferredProject(configFileExistenceInfo)) {
                    configFileExistenceInfo.configFileWatcherForRootOfInferredProject.close();
                    configFileExistenceInfo.configFileWatcherForRootOfInferredProject = undefined;
                }
            }
            /**
             * This is called on file close, so that we stop watching the config file for this script info
             */
            stopWatchingConfigFilesForClosedScriptInfo(info) {
                ts.Debug.assert(!info.isScriptOpen());
                this.forEachConfigFileLocation(info, (configFileName, canonicalConfigFilePath) => {
                    const configFileExistenceInfo = this.configFileExistenceInfoCache.get(canonicalConfigFilePath);
                    if (configFileExistenceInfo) {
                        const infoIsRootOfInferredProject = configFileExistenceInfo.openFilesImpactedByConfigFile.get(info.path);
                        // Delete the info from map, since this file is no more open
                        configFileExistenceInfo.openFilesImpactedByConfigFile.delete(info.path);
                        this.logConfigFileWatchUpdate(configFileName, canonicalConfigFilePath, configFileExistenceInfo, "File removed from open files impacted by this config file" /* OpenFilesImpactedByConfigFileRemove */);
                        // If the script info was not root of inferred project,
                        // there wont be config file watch open because of this script info
                        if (infoIsRootOfInferredProject) {
                            // But if it is a root, it could be the last script info that is root of inferred project
                            // and hence we would need to close the config file watcher
                            this.closeConfigFileWatcherOfConfigFileExistenceInfo(configFileExistenceInfo);
                        }
                        // If there are no open files that are impacted by configFileExistenceInfo after closing this script info
                        // there is no configured project present, remove the cached existence info
                        if (!configFileExistenceInfo.openFilesImpactedByConfigFile.size &&
                            !this.getConfiguredProjectByCanonicalConfigFilePath(canonicalConfigFilePath)) {
                            ts.Debug.assert(!configFileExistenceInfo.configFileWatcherForRootOfInferredProject);
                            this.configFileExistenceInfoCache.delete(canonicalConfigFilePath);
                        }
                    }
                });
            }
            /**
             * This is called by inferred project whenever script info is added as a root
             */
            /* @internal */
            startWatchingConfigFilesForInferredProjectRoot(info, projectRootPath) {
                ts.Debug.assert(info.isScriptOpen());
                this.forEachConfigFileLocation(info, (configFileName, canonicalConfigFilePath) => {
                    let configFileExistenceInfo = this.configFileExistenceInfoCache.get(canonicalConfigFilePath);
                    if (!configFileExistenceInfo) {
                        // Create the cache
                        configFileExistenceInfo = {
                            exists: this.host.fileExists(configFileName),
                            openFilesImpactedByConfigFile: ts.createMap()
                        };
                        this.configFileExistenceInfoCache.set(canonicalConfigFilePath, configFileExistenceInfo);
                    }
                    // Set this file as the root of inferred project
                    configFileExistenceInfo.openFilesImpactedByConfigFile.set(info.path, true);
                    this.logConfigFileWatchUpdate(configFileName, canonicalConfigFilePath, configFileExistenceInfo, "Open file was set as Inferred root" /* RootOfInferredProjectTrue */);
                    // If there is no configured project for this config file, add the file watcher
                    if (!configFileExistenceInfo.configFileWatcherForRootOfInferredProject &&
                        !this.getConfiguredProjectByCanonicalConfigFilePath(canonicalConfigFilePath)) {
                        this.createConfigFileWatcherOfConfigFileExistence(configFileName, canonicalConfigFilePath, configFileExistenceInfo);
                    }
                }, projectRootPath);
            }
            /**
             * This is called by inferred project whenever root script info is removed from it
             */
            /* @internal */
            stopWatchingConfigFilesForInferredProjectRoot(info) {
                this.forEachConfigFileLocation(info, (configFileName, canonicalConfigFilePath) => {
                    const configFileExistenceInfo = this.configFileExistenceInfoCache.get(canonicalConfigFilePath);
                    if (configFileExistenceInfo && configFileExistenceInfo.openFilesImpactedByConfigFile.has(info.path)) {
                        ts.Debug.assert(info.isScriptOpen());
                        // Info is not root of inferred project any more
                        configFileExistenceInfo.openFilesImpactedByConfigFile.set(info.path, false);
                        this.logConfigFileWatchUpdate(configFileName, canonicalConfigFilePath, configFileExistenceInfo, "Open file was set as not inferred root" /* RootOfInferredProjectFalse */);
                        // Close the config file watcher
                        this.closeConfigFileWatcherOfConfigFileExistenceInfo(configFileExistenceInfo);
                    }
                });
            }
            /**
             * This function tries to search for a tsconfig.json for the given file.
             * This is different from the method the compiler uses because
             * the compiler can assume it will always start searching in the
             * current directory (the directory in which tsc was invoked).
             * The server must start searching from the directory containing
             * the newly opened file.
             */
            forEachConfigFileLocation(info, action, projectRootPath) {
                if (this.syntaxOnly) {
                    return undefined;
                }
                let searchPath = server.asNormalizedPath(ts.getDirectoryPath(info.fileName));
                while (!projectRootPath || ts.containsPath(projectRootPath, searchPath, this.currentDirectory, !this.host.useCaseSensitiveFileNames)) {
                    const canonicalSearchPath = server.normalizedPathToPath(searchPath, this.currentDirectory, this.toCanonicalFileName);
                    const tsconfigFileName = server.asNormalizedPath(ts.combinePaths(searchPath, "tsconfig.json"));
                    let result = action(tsconfigFileName, ts.combinePaths(canonicalSearchPath, "tsconfig.json"));
                    if (result) {
                        return tsconfigFileName;
                    }
                    const jsconfigFileName = server.asNormalizedPath(ts.combinePaths(searchPath, "jsconfig.json"));
                    result = action(jsconfigFileName, ts.combinePaths(canonicalSearchPath, "jsconfig.json"));
                    if (result) {
                        return jsconfigFileName;
                    }
                    const parentPath = server.asNormalizedPath(ts.getDirectoryPath(searchPath));
                    if (parentPath === searchPath) {
                        break;
                    }
                    searchPath = parentPath;
                }
                return undefined;
            }
            /**
             * This function tries to search for a tsconfig.json for the given file.
             * This is different from the method the compiler uses because
             * the compiler can assume it will always start searching in the
             * current directory (the directory in which tsc was invoked).
             * The server must start searching from the directory containing
             * the newly opened file.
             */
            getConfigFileNameForFile(info, projectRootPath) {
                ts.Debug.assert(info.isScriptOpen());
                this.logger.info(`Search path: ${ts.getDirectoryPath(info.fileName)}`);
                const configFileName = this.forEachConfigFileLocation(info, (configFileName, canonicalConfigFilePath) => this.configFileExists(configFileName, canonicalConfigFilePath, info), projectRootPath);
                if (configFileName) {
                    this.logger.info(`For info: ${info.fileName} :: Config file name: ${configFileName}`);
                }
                else {
                    this.logger.info(`For info: ${info.fileName} :: No config files found.`);
                }
                return configFileName;
            }
            printProjects() {
                if (!this.logger.hasLevel(server.LogLevel.normal)) {
                    return;
                }
                const writeProjectFileNames = this.logger.hasLevel(server.LogLevel.verbose);
                this.logger.startGroup();
                let counter = 0;
                const printProjects = (projects, counter) => {
                    for (const project of projects) {
                        this.logger.info(`Project '${project.getProjectName()}' (${server.ProjectKind[project.projectKind]}) ${counter}`);
                        this.logger.info(project.filesToString(writeProjectFileNames));
                        this.logger.info("-----------------------------------------------");
                        counter++;
                    }
                    return counter;
                };
                counter = printProjects(this.externalProjects, counter);
                counter = printProjects(ts.arrayFrom(this.configuredProjects.values()), counter);
                printProjects(this.inferredProjects, counter);
                this.logger.info("Open files: ");
                this.openFiles.forEach((projectRootPath, path) => {
                    const info = this.getScriptInfoForPath(path);
                    this.logger.info(`\tFileName: ${info.fileName} ProjectRootPath: ${projectRootPath}`);
                    if (writeProjectFileNames) {
                        this.logger.info(`\t\tProjects: ${info.containingProjects.map(p => p.getProjectName())}`);
                    }
                });
                this.logger.endGroup();
            }
            findConfiguredProjectByProjectName(configFileName) {
                // make sure that casing of config file name is consistent
                const canonicalConfigFilePath = server.asNormalizedPath(this.toCanonicalFileName(configFileName));
                return this.getConfiguredProjectByCanonicalConfigFilePath(canonicalConfigFilePath);
            }
            getConfiguredProjectByCanonicalConfigFilePath(canonicalConfigFilePath) {
                return this.configuredProjects.get(canonicalConfigFilePath);
            }
            findExternalProjectByProjectName(projectFileName) {
                return findProjectByName(projectFileName, this.externalProjects);
            }
            convertConfigFileContentToProjectOptions(configFilename, cachedDirectoryStructureHost) {
                configFilename = ts.normalizePath(configFilename);
                const configFileContent = this.host.readFile(configFilename);
                const result = ts.parseJsonText(configFilename, configFileContent);
                if (!result.endOfFileToken) {
                    result.endOfFileToken = { kind: ts.SyntaxKind.EndOfFileToken };
                }
                const errors = result.parseDiagnostics;
                const parsedCommandLine = ts.parseJsonSourceFileConfigFileContent(result, cachedDirectoryStructureHost, ts.getDirectoryPath(configFilename), 
                /*existingOptions*/ {}, configFilename, 
                /*resolutionStack*/ [], this.hostConfiguration.extraFileExtensions);
                if (parsedCommandLine.errors.length) {
                    errors.push(...parsedCommandLine.errors);
                }
                ts.Debug.assert(!!parsedCommandLine.fileNames);
                const projectOptions = {
                    files: parsedCommandLine.fileNames,
                    compilerOptions: parsedCommandLine.options,
                    configHasExtendsProperty: parsedCommandLine.raw.extends !== undefined,
                    configHasFilesProperty: parsedCommandLine.raw.files !== undefined,
                    configHasIncludeProperty: parsedCommandLine.raw.include !== undefined,
                    configHasExcludeProperty: parsedCommandLine.raw.exclude !== undefined,
                    wildcardDirectories: ts.createMapFromTemplate(parsedCommandLine.wildcardDirectories),
                    typeAcquisition: parsedCommandLine.typeAcquisition,
                    compileOnSave: parsedCommandLine.compileOnSave
                };
                return { projectOptions, configFileErrors: errors, configFileSpecs: parsedCommandLine.configFileSpecs };
            }
            /** Get a filename if the language service exceeds the maximum allowed program size; otherwise returns undefined. */
            getFilenameForExceededTotalSizeLimitForNonTsFiles(name, options, fileNames, propertyReader) {
                if (options && options.disableSizeLimit || !this.host.getFileSize) {
                    return;
                }
                let availableSpace = server.maxProgramSizeForNonTsFiles;
                this.projectToSizeMap.set(name, 0);
                this.projectToSizeMap.forEach(val => (availableSpace -= (val || 0)));
                let totalNonTsFileSize = 0;
                for (const f of fileNames) {
                    const fileName = propertyReader.getFileName(f);
                    if (ts.hasTypeScriptFileExtension(fileName)) {
                        continue;
                    }
                    totalNonTsFileSize += this.host.getFileSize(fileName);
                    if (totalNonTsFileSize > server.maxProgramSizeForNonTsFiles || totalNonTsFileSize > availableSpace) {
                        this.logger.info(getExceedLimitMessage({ propertyReader, hasTypeScriptFileExtension: ts.hasTypeScriptFileExtension, host: this.host }, totalNonTsFileSize));
                        // Keep the size as zero since it's disabled
                        return fileName;
                    }
                }
                this.projectToSizeMap.set(name, totalNonTsFileSize);
                return;
                function getExceedLimitMessage(context, totalNonTsFileSize) {
                    const files = getTop5LargestFiles(context);
                    return `Non TS file size exceeded limit (${totalNonTsFileSize}). Largest files: ${files.map(file => `${file.name}:${file.size}`).join(", ")}`;
                }
                function getTop5LargestFiles({ propertyReader, hasTypeScriptFileExtension, host }) {
                    return fileNames.map(f => propertyReader.getFileName(f))
                        .filter(name => hasTypeScriptFileExtension(name))
                        .map(name => ({ name, size: host.getFileSize(name) }))
                        .sort((a, b) => b.size - a.size)
                        .slice(0, 5);
                }
            }
            createExternalProject(projectFileName, files, options, typeAcquisition, excludedFiles) {
                const compilerOptions = convertCompilerOptions(options);
                const project = new server.ExternalProject(projectFileName, this, this.documentRegistry, compilerOptions, 
                /*lastFileExceededProgramSize*/ this.getFilenameForExceededTotalSizeLimitForNonTsFiles(projectFileName, compilerOptions, files, externalFilePropertyReader), options.compileOnSave === undefined ? true : options.compileOnSave);
                project.excludedFiles = excludedFiles;
                this.addFilesToNonInferredProjectAndUpdateGraph(project, files, externalFilePropertyReader, typeAcquisition);
                this.externalProjects.push(project);
                this.sendProjectTelemetry(projectFileName, project);
                return project;
            }
            sendProjectTelemetry(projectKey, project, projectOptions) {
                if (this.seenProjects.has(projectKey)) {
                    return;
                }
                this.seenProjects.set(projectKey, true);
                if (!this.eventHandler) {
                    return;
                }
                const data = {
                    projectId: this.host.createHash(projectKey),
                    fileStats: server.countEachFileTypes(project.getScriptInfos()),
                    compilerOptions: ts.convertCompilerOptionsForTelemetry(project.getCompilationSettings()),
                    typeAcquisition: convertTypeAcquisition(project.getTypeAcquisition()),
                    extends: projectOptions && projectOptions.configHasExtendsProperty,
                    files: projectOptions && projectOptions.configHasFilesProperty,
                    include: projectOptions && projectOptions.configHasIncludeProperty,
                    exclude: projectOptions && projectOptions.configHasExcludeProperty,
                    compileOnSave: project.compileOnSaveEnabled,
                    configFileName: configFileName(),
                    projectType: project instanceof server.ExternalProject ? "external" : "configured",
                    languageServiceEnabled: project.languageServiceEnabled,
                    version: ts.version,
                };
                this.eventHandler({ eventName: server.ProjectInfoTelemetryEvent, data });
                function configFileName() {
                    if (!(project instanceof server.ConfiguredProject)) {
                        return "other";
                    }
                    const configFilePath = project instanceof server.ConfiguredProject && project.getConfigFilePath();
                    return server.getBaseConfigFileName(configFilePath) || "other";
                }
                function convertTypeAcquisition({ enable, include, exclude }) {
                    return {
                        enable,
                        include: include !== undefined && include.length !== 0,
                        exclude: exclude !== undefined && exclude.length !== 0,
                    };
                }
            }
            addFilesToNonInferredProjectAndUpdateGraph(project, files, propertyReader, typeAcquisition) {
                this.updateNonInferredProjectFiles(project, files, propertyReader);
                project.setTypeAcquisition(typeAcquisition);
                // This doesnt need scheduling since its either creation or reload of the project
                project.updateGraph();
            }
            createConfiguredProject(configFileName) {
                const cachedDirectoryStructureHost = ts.createCachedDirectoryStructureHost(this.host, this.host.getCurrentDirectory(), this.host.useCaseSensitiveFileNames);
                const { projectOptions, configFileErrors, configFileSpecs } = this.convertConfigFileContentToProjectOptions(configFileName, cachedDirectoryStructureHost);
                this.logger.info(`Opened configuration file ${configFileName}`);
                const lastFileExceededProgramSize = this.getFilenameForExceededTotalSizeLimitForNonTsFiles(configFileName, projectOptions.compilerOptions, projectOptions.files, fileNamePropertyReader);
                const project = new server.ConfiguredProject(configFileName, this, this.documentRegistry, projectOptions.configHasFilesProperty, projectOptions.compilerOptions, lastFileExceededProgramSize, projectOptions.compileOnSave === undefined ? false : projectOptions.compileOnSave, cachedDirectoryStructureHost);
                project.configFileSpecs = configFileSpecs;
                // TODO: We probably should also watch the configFiles that are extended
                project.configFileWatcher = this.watchFactory.watchFile(this.host, configFileName, (_fileName, eventKind) => this.onConfigChangedForConfiguredProject(project, eventKind), ts.PollingInterval.High, "Config file for the program" /* ConfigFilePath */, project);
                if (!lastFileExceededProgramSize) {
                    project.watchWildcards(projectOptions.wildcardDirectories);
                }
                project.setProjectErrors(configFileErrors);
                const filesToAdd = projectOptions.files.concat(project.getExternalFiles());
                this.addFilesToNonInferredProjectAndUpdateGraph(project, filesToAdd, fileNamePropertyReader, projectOptions.typeAcquisition);
                this.configuredProjects.set(project.canonicalConfigFilePath, project);
                this.setConfigFileExistenceByNewConfiguredProject(project);
                this.sendProjectTelemetry(configFileName, project, projectOptions);
                return project;
            }
            updateNonInferredProjectFiles(project, files, propertyReader) {
                const projectRootFilesMap = project.getRootFilesMap();
                const newRootScriptInfoMap = ts.createMap();
                for (const f of files) {
                    const newRootFile = propertyReader.getFileName(f);
                    const normalizedPath = server.toNormalizedPath(newRootFile);
                    const isDynamic = server.isDynamicFileName(normalizedPath);
                    let scriptInfo;
                    let path;
                    // Use the project's fileExists so that it can use caching instead of reaching to disk for the query
                    if (!isDynamic && !project.fileExists(newRootFile)) {
                        path = server.normalizedPathToPath(normalizedPath, this.currentDirectory, this.toCanonicalFileName);
                        const existingValue = projectRootFilesMap.get(path);
                        if (server.isScriptInfo(existingValue)) {
                            project.removeFile(existingValue, /*fileExists*/ false, /*detachFromProject*/ true);
                        }
                        projectRootFilesMap.set(path, normalizedPath);
                        scriptInfo = normalizedPath;
                    }
                    else {
                        const scriptKind = propertyReader.getScriptKind(f, this.hostConfiguration.extraFileExtensions);
                        const hasMixedContent = propertyReader.hasMixedContent(f, this.hostConfiguration.extraFileExtensions);
                        scriptInfo = this.getOrCreateScriptInfoNotOpenedByClientForNormalizedPath(normalizedPath, project.currentDirectory, scriptKind, hasMixedContent, project.directoryStructureHost);
                        path = scriptInfo.path;
                        // If this script info is not already a root add it
                        if (!project.isRoot(scriptInfo)) {
                            project.addRoot(scriptInfo);
                            if (scriptInfo.isScriptOpen()) {
                                // if file is already root in some inferred project
                                // - remove the file from that project and delete the project if necessary
                                this.removeRootOfInferredProjectIfNowPartOfOtherProject(scriptInfo);
                            }
                        }
                    }
                    newRootScriptInfoMap.set(path, scriptInfo);
                }
                // project's root file map size is always going to be same or larger than new roots map
                // as we have already all the new files to the project
                if (projectRootFilesMap.size > newRootScriptInfoMap.size) {
                    projectRootFilesMap.forEach((value, path) => {
                        if (!newRootScriptInfoMap.has(path)) {
                            if (server.isScriptInfo(value)) {
                                project.removeFile(value, project.fileExists(path), /*detachFromProject*/ true);
                            }
                            else {
                                projectRootFilesMap.delete(path);
                            }
                        }
                    });
                }
                // Just to ensure that even if root files dont change, the changes to the non root file are picked up,
                // mark the project as dirty unconditionally
                project.markAsDirty();
            }
            updateNonInferredProject(project, newUncheckedFiles, propertyReader, newOptions, newTypeAcquisition, compileOnSave) {
                project.setCompilerOptions(newOptions);
                // VS only set the CompileOnSaveEnabled option in the request if the option was changed recently
                // therefore if it is undefined, it should not be updated.
                if (compileOnSave !== undefined) {
                    project.compileOnSaveEnabled = compileOnSave;
                }
                this.addFilesToNonInferredProjectAndUpdateGraph(project, newUncheckedFiles, propertyReader, newTypeAcquisition);
            }
            /**
             * Reload the file names from config file specs and update the project graph
             */
            /*@internal*/
            reloadFileNamesOfConfiguredProject(project) {
                const configFileSpecs = project.configFileSpecs;
                const configFileName = project.getConfigFilePath();
                const fileNamesResult = ts.getFileNamesFromConfigSpecs(configFileSpecs, ts.getDirectoryPath(configFileName), project.getCompilationSettings(), project.getCachedDirectoryStructureHost(), this.hostConfiguration.extraFileExtensions);
                project.updateErrorOnNoInputFiles(fileNamesResult.fileNames.length !== 0);
                this.updateNonInferredProjectFiles(project, fileNamesResult.fileNames, fileNamePropertyReader);
                return project.updateGraph();
            }
            /**
             * Read the config file of the project again and update the project
             */
            /* @internal */
            reloadConfiguredProject(project) {
                // At this point, there is no reason to not have configFile in the host
                const host = project.getCachedDirectoryStructureHost();
                // Clear the cache since we are reloading the project from disk
                host.clearCache();
                const configFileName = project.getConfigFilePath();
                this.logger.info(`Reloading configured project ${configFileName}`);
                // Read updated contents from disk
                const { projectOptions, configFileErrors, configFileSpecs } = this.convertConfigFileContentToProjectOptions(configFileName, host);
                // Update the project
                project.configFileSpecs = configFileSpecs;
                project.setProjectErrors(configFileErrors);
                const lastFileExceededProgramSize = this.getFilenameForExceededTotalSizeLimitForNonTsFiles(project.canonicalConfigFilePath, projectOptions.compilerOptions, projectOptions.files, fileNamePropertyReader);
                if (lastFileExceededProgramSize) {
                    project.disableLanguageService(lastFileExceededProgramSize);
                    project.stopWatchingWildCards();
                }
                else {
                    project.enableLanguageService();
                    project.watchWildcards(projectOptions.wildcardDirectories);
                }
                this.updateNonInferredProject(project, projectOptions.files, fileNamePropertyReader, projectOptions.compilerOptions, projectOptions.typeAcquisition, projectOptions.compileOnSave);
                this.sendConfigFileDiagEvent(project, configFileName);
            }
            sendConfigFileDiagEvent(project, triggerFile) {
                if (!this.eventHandler || this.suppressDiagnosticEvents) {
                    return;
                }
                this.eventHandler({
                    eventName: server.ConfigFileDiagEvent,
                    data: { configFileName: project.getConfigFilePath(), diagnostics: project.getAllProjectErrors(), triggerFile }
                });
            }
            getOrCreateInferredProjectForProjectRootPathIfEnabled(info, projectRootPath) {
                if (info.isDynamic || !this.useInferredProjectPerProjectRoot) {
                    return undefined;
                }
                if (projectRootPath) {
                    const canonicalProjectRootPath = this.toCanonicalFileName(projectRootPath);
                    // if we have an explicit project root path, find (or create) the matching inferred project.
                    for (const project of this.inferredProjects) {
                        if (project.projectRootPath === canonicalProjectRootPath) {
                            return project;
                        }
                    }
                    return this.createInferredProject(projectRootPath, /*isSingleInferredProject*/ false, projectRootPath);
                }
                // we don't have an explicit root path, so we should try to find an inferred project
                // that more closely contains the file.
                let bestMatch;
                for (const project of this.inferredProjects) {
                    // ignore single inferred projects (handled elsewhere)
                    if (!project.projectRootPath)
                        continue;
                    // ignore inferred projects that don't contain the root's path
                    if (!ts.containsPath(project.projectRootPath, info.path, this.host.getCurrentDirectory(), !this.host.useCaseSensitiveFileNames))
                        continue;
                    // ignore inferred projects that are higher up in the project root.
                    // TODO(rbuckton): Should we add the file as a root to these as well?
                    if (bestMatch && bestMatch.projectRootPath.length > project.projectRootPath.length)
                        continue;
                    bestMatch = project;
                }
                return bestMatch;
            }
            getOrCreateSingleInferredProjectIfEnabled() {
                if (!this.useSingleInferredProject) {
                    return undefined;
                }
                // If `useInferredProjectPerProjectRoot` is not enabled, then there will only be one
                // inferred project for all files. If `useInferredProjectPerProjectRoot` is enabled
                // then we want to put all files that are not opened with a `projectRootPath` into
                // the same inferred project.
                //
                // To avoid the cost of searching through the array and to optimize for the case where
                // `useInferredProjectPerProjectRoot` is not enabled, we will always put the inferred
                // project for non-rooted files at the front of the array.
                if (this.inferredProjects.length > 0 && this.inferredProjects[0].projectRootPath === undefined) {
                    return this.inferredProjects[0];
                }
                // Single inferred project does not have a project root and hence no current directory
                return this.createInferredProject(/*currentDirectory*/ undefined, /*isSingleInferredProject*/ true);
            }
            createInferredProject(currentDirectory, isSingleInferredProject, projectRootPath) {
                const compilerOptions = projectRootPath && this.compilerOptionsForInferredProjectsPerProjectRoot.get(projectRootPath) || this.compilerOptionsForInferredProjects;
                const project = new server.InferredProject(this, this.documentRegistry, compilerOptions, projectRootPath, currentDirectory);
                if (isSingleInferredProject) {
                    this.inferredProjects.unshift(project);
                }
                else {
                    this.inferredProjects.push(project);
                }
                return project;
            }
            /*@internal*/
            getOrCreateScriptInfoNotOpenedByClient(uncheckedFileName, currentDirectory, hostToQueryFileExistsOn) {
                return this.getOrCreateScriptInfoNotOpenedByClientForNormalizedPath(server.toNormalizedPath(uncheckedFileName), currentDirectory, /*scriptKind*/ undefined, 
                /*hasMixedContent*/ undefined, hostToQueryFileExistsOn);
            }
            getScriptInfo(uncheckedFileName) {
                return this.getScriptInfoForNormalizedPath(server.toNormalizedPath(uncheckedFileName));
            }
            /**
             * Returns the projects that contain script info through SymLink
             * Note that this does not return projects in info.containingProjects
             */
            /*@internal*/
            getSymlinkedProjects(info) {
                let projects;
                if (this.realpathToScriptInfos) {
                    const realpath = info.getRealpathIfDifferent();
                    if (realpath) {
                        ts.forEach(this.realpathToScriptInfos.get(realpath), combineProjects);
                    }
                    ts.forEach(this.realpathToScriptInfos.get(info.path), combineProjects);
                }
                return projects;
                function combineProjects(toAddInfo) {
                    if (toAddInfo !== info) {
                        for (const project of toAddInfo.containingProjects) {
                            // Add the projects only if they can use symLink targets and not already in the list
                            if (project.languageServiceEnabled &&
                                !project.getCompilerOptions().preserveSymlinks &&
                                !ts.contains(info.containingProjects, project)) {
                                if (!projects) {
                                    projects = ts.createMultiMap();
                                    projects.add(toAddInfo.path, project);
                                }
                                else if (!ts.forEachEntry(projects, (projs, path) => path === toAddInfo.path ? false : ts.contains(projs, project))) {
                                    projects.add(toAddInfo.path, project);
                                }
                            }
                        }
                    }
                }
            }
            watchClosedScriptInfo(info) {
                ts.Debug.assert(!info.fileWatcher);
                // do not watch files with mixed content - server doesn't know how to interpret it
                // do not watch files in the global cache location
                if (!info.isDynamicOrHasMixedContent() &&
                    (!this.globalCacheLocationDirectoryPath ||
                        !ts.startsWith(info.path, this.globalCacheLocationDirectoryPath))) {
                    const { fileName } = info;
                    info.fileWatcher = this.watchFactory.watchFilePath(this.host, fileName, (fileName, eventKind, path) => this.onSourceFileChanged(fileName, eventKind, path), ts.PollingInterval.Medium, info.path, "Closed Script info" /* ClosedScriptInfo */);
                }
            }
            stopWatchingScriptInfo(info) {
                if (info.fileWatcher) {
                    info.fileWatcher.close();
                    info.fileWatcher = undefined;
                }
            }
            /*@internal*/
            getOrCreateScriptInfoNotOpenedByClientForNormalizedPath(fileName, currentDirectory, scriptKind, hasMixedContent, hostToQueryFileExistsOn) {
                return this.getOrCreateScriptInfoWorker(fileName, currentDirectory, /*openedByClient*/ false, /*fileContent*/ undefined, scriptKind, hasMixedContent, hostToQueryFileExistsOn);
            }
            /*@internal*/
            getOrCreateScriptInfoOpenedByClientForNormalizedPath(fileName, currentDirectory, fileContent, scriptKind, hasMixedContent) {
                return this.getOrCreateScriptInfoWorker(fileName, currentDirectory, /*openedByClient*/ true, fileContent, scriptKind, hasMixedContent);
            }
            getOrCreateScriptInfoForNormalizedPath(fileName, openedByClient, fileContent, scriptKind, hasMixedContent, hostToQueryFileExistsOn) {
                return this.getOrCreateScriptInfoWorker(fileName, this.currentDirectory, openedByClient, fileContent, scriptKind, hasMixedContent, hostToQueryFileExistsOn);
            }
            getOrCreateScriptInfoWorker(fileName, currentDirectory, openedByClient, fileContent, scriptKind, hasMixedContent, hostToQueryFileExistsOn) {
                ts.Debug.assert(fileContent === undefined || openedByClient, "ScriptInfo needs to be opened by client to be able to set its user defined content");
                const path = server.normalizedPathToPath(fileName, currentDirectory, this.toCanonicalFileName);
                let info = this.getScriptInfoForPath(path);
                if (!info) {
                    const isDynamic = server.isDynamicFileName(fileName);
                    ts.Debug.assert(ts.isRootedDiskPath(fileName) || isDynamic || openedByClient, "", () => `${JSON.stringify({ fileName, currentDirectory, hostCurrentDirectory: this.currentDirectory, openKeys: ts.arrayFrom(this.openFilesWithNonRootedDiskPath.keys()) })}\nScript info with non-dynamic relative file name can only be open script info`);
                    ts.Debug.assert(!ts.isRootedDiskPath(fileName) || this.currentDirectory === currentDirectory || !this.openFilesWithNonRootedDiskPath.has(this.toCanonicalFileName(fileName)), "", () => `${JSON.stringify({ fileName, currentDirectory, hostCurrentDirectory: this.currentDirectory, openKeys: ts.arrayFrom(this.openFilesWithNonRootedDiskPath.keys()) })}\nOpen script files with non rooted disk path opened with current directory context cannot have same canonical names`);
                    ts.Debug.assert(!isDynamic || this.currentDirectory === currentDirectory, "", () => `${JSON.stringify({ fileName, currentDirectory, hostCurrentDirectory: this.currentDirectory, openKeys: ts.arrayFrom(this.openFilesWithNonRootedDiskPath.keys()) })}\nDynamic files must always have current directory context since containing external project name will always match the script info name.`);
                    // If the file is not opened by client and the file doesnot exist on the disk, return
                    if (!openedByClient && !isDynamic && !(hostToQueryFileExistsOn || this.host).fileExists(fileName)) {
                        return;
                    }
                    info = new server.ScriptInfo(this.host, fileName, scriptKind, hasMixedContent, path);
                    this.filenameToScriptInfo.set(info.path, info);
                    if (!openedByClient) {
                        this.watchClosedScriptInfo(info);
                    }
                    else if (!ts.isRootedDiskPath(fileName) && currentDirectory !== this.currentDirectory) {
                        // File that is opened by user but isn't rooted disk path
                        this.openFilesWithNonRootedDiskPath.set(this.toCanonicalFileName(fileName), info);
                    }
                }
                if (openedByClient && !info.isScriptOpen()) {
                    // Opening closed script info
                    // either it was created just now, or was part of projects but was closed
                    this.stopWatchingScriptInfo(info);
                    info.open(fileContent);
                    if (hasMixedContent) {
                        info.registerFileUpdate();
                    }
                }
                else {
                    ts.Debug.assert(fileContent === undefined);
                }
                return info;
            }
            /**
             * This gets the script info for the normalized path. If the path is not rooted disk path then the open script info with project root context is preferred
             */
            getScriptInfoForNormalizedPath(fileName) {
                return !ts.isRootedDiskPath(fileName) && this.openFilesWithNonRootedDiskPath.get(this.toCanonicalFileName(fileName)) ||
                    this.getScriptInfoForPath(server.normalizedPathToPath(fileName, this.currentDirectory, this.toCanonicalFileName));
            }
            getScriptInfoForPath(fileName) {
                return this.filenameToScriptInfo.get(fileName);
            }
            setHostConfiguration(args) {
                if (args.file) {
                    const info = this.getScriptInfoForNormalizedPath(server.toNormalizedPath(args.file));
                    if (info) {
                        info.setOptions(convertFormatOptions(args.formatOptions), args.preferences);
                        this.logger.info(`Host configuration update for file ${args.file}`);
                    }
                }
                else {
                    if (args.hostInfo !== undefined) {
                        this.hostConfiguration.hostInfo = args.hostInfo;
                        this.logger.info(`Host information ${args.hostInfo}`);
                    }
                    if (args.formatOptions) {
                        this.hostConfiguration.formatCodeOptions = Object.assign({}, this.hostConfiguration.formatCodeOptions, convertFormatOptions(args.formatOptions));
                        this.logger.info("Format host information updated");
                    }
                    if (args.preferences) {
                        this.hostConfiguration.preferences = Object.assign({}, this.hostConfiguration.preferences, args.preferences);
                    }
                    if (args.extraFileExtensions) {
                        this.hostConfiguration.extraFileExtensions = args.extraFileExtensions;
                        // We need to update the project structures again as it is possible that existing
                        // project structure could have more or less files depending on extensions permitted
                        this.reloadProjects();
                        this.logger.info("Host file extension mappings updated");
                    }
                }
            }
            closeLog() {
                this.logger.close();
            }
            /**
             * This function rebuilds the project for every file opened by the client
             * This does not reload contents of open files from disk. But we could do that if needed
             */
            reloadProjects() {
                this.logger.info("reload projects.");
                // If we want this to also reload open files from disk, we could do that,
                // but then we need to make sure we arent calling this function
                // (and would separate out below reloading of projects to be called when immediate reload is needed)
                // as there is no need to load contents of the files from the disk
                // Reload Projects
                this.reloadConfiguredProjectForFiles(this.openFiles, /*delayReload*/ false, ts.returnTrue);
                this.ensureProjectForOpenFiles();
            }
            delayReloadConfiguredProjectForFiles(configFileExistenceInfo, ignoreIfNotRootOfInferredProject) {
                // Get open files to reload projects for
                this.reloadConfiguredProjectForFiles(configFileExistenceInfo.openFilesImpactedByConfigFile, 
                /*delayReload*/ true, ignoreIfNotRootOfInferredProject ?
                    isRootOfInferredProject => isRootOfInferredProject : // Reload open files if they are root of inferred project
                    ts.returnTrue // Reload all the open files impacted by config file
                );
                this.delayEnsureProjectForOpenFiles();
            }
            /**
             * This function goes through all the openFiles and tries to file the config file for them.
             * If the config file is found and it refers to existing project, it reloads it either immediately
             * or schedules it for reload depending on delayReload option
             * If the there is no existing project it just opens the configured project for the config file
             * reloadForInfo provides a way to filter out files to reload configured project for
             */
            reloadConfiguredProjectForFiles(openFiles, delayReload, shouldReloadProjectFor) {
                const updatedProjects = ts.createMap();
                // try to reload config file for all open files
                openFiles.forEach((openFileValue, path) => {
                    // Filter out the files that need to be ignored
                    if (!shouldReloadProjectFor(openFileValue)) {
                        return;
                    }
                    const info = this.getScriptInfoForPath(path);
                    ts.Debug.assert(info.isScriptOpen());
                    // This tries to search for a tsconfig.json for the given file. If we found it,
                    // we first detect if there is already a configured project created for it: if so,
                    // we re- read the tsconfig file content and update the project only if we havent already done so
                    // otherwise we create a new one.
                    const configFileName = this.getConfigFileNameForFile(info, this.openFiles.get(path));
                    if (configFileName) {
                        const project = this.findConfiguredProjectByProjectName(configFileName);
                        if (!project) {
                            this.createConfiguredProject(configFileName);
                            updatedProjects.set(configFileName, true);
                        }
                        else if (!updatedProjects.has(configFileName)) {
                            if (delayReload) {
                                project.pendingReload = ts.ConfigFileProgramReloadLevel.Full;
                                this.delayUpdateProjectGraph(project);
                            }
                            else {
                                this.reloadConfiguredProject(project);
                            }
                            updatedProjects.set(configFileName, true);
                        }
                    }
                });
            }
            /**
             * Remove the root of inferred project if script info is part of another project
             */
            removeRootOfInferredProjectIfNowPartOfOtherProject(info) {
                // If the script info is root of inferred project, it could only be first containing project
                // since info is added as root to the inferred project only when there are no other projects containing it
                // So when it is root of the inferred project and after project structure updates its now part
                // of multiple project it needs to be removed from that inferred project because:
                // - references in inferred project supercede the root part
                // - root / reference in non - inferred project beats root in inferred project
                // eg. say this is structure /a/b/a.ts /a/b/c.ts where c.ts references a.ts
                // When a.ts is opened, since there is no configured project/external project a.ts can be part of
                // a.ts is added as root to inferred project.
                // Now at time of opening c.ts, c.ts is also not aprt of any existing project,
                // so it will be added to inferred project as a root. (for sake of this example assume single inferred project is false)
                // So at this poing a.ts is part of first inferred project and second inferred project (of which c.ts is root)
                // And hence it needs to be removed from the first inferred project.
                if (info.containingProjects.length > 1 &&
                    info.containingProjects[0].projectKind === server.ProjectKind.Inferred &&
                    info.containingProjects[0].isRoot(info)) {
                    const inferredProject = info.containingProjects[0];
                    if (inferredProject.isProjectWithSingleRoot()) {
                        this.removeProject(inferredProject);
                    }
                    else {
                        inferredProject.removeFile(info, /*fileExists*/ true, /*detachFromProject*/ true);
                    }
                }
            }
            /**
             * This function is to update the project structure for every inferred project.
             * It is called on the premise that all the configured projects are
             * up to date.
             * This will go through open files and assign them to inferred project if open file is not part of any other project
             * After that all the inferred project graphs are updated
             */
            ensureProjectForOpenFiles() {
                this.logger.info("Structure before ensureProjectForOpenFiles:");
                this.printProjects();
                this.openFiles.forEach((projectRootPath, path) => {
                    const info = this.getScriptInfoForPath(path);
                    // collect all orphaned script infos from open files
                    if (info.isOrphan()) {
                        this.assignOrphanScriptInfoToInferredProject(info, projectRootPath);
                    }
                    else {
                        // Or remove the root of inferred project if is referenced in more than one projects
                        this.removeRootOfInferredProjectIfNowPartOfOtherProject(info);
                    }
                });
                this.pendingEnsureProjectForOpenFiles = false;
                this.inferredProjects.forEach(p => this.updateProjectIfDirty(p));
                this.logger.info("Structure after ensureProjectForOpenFiles:");
                this.printProjects();
            }
            /**
             * Open file whose contents is managed by the client
             * @param filename is absolute pathname
             * @param fileContent is a known version of the file content that is more up to date than the one on disk
             */
            openClientFile(fileName, fileContent, scriptKind, projectRootPath) {
                return this.openClientFileWithNormalizedPath(server.toNormalizedPath(fileName), fileContent, scriptKind, /*hasMixedContent*/ false, projectRootPath ? server.toNormalizedPath(projectRootPath) : undefined);
            }
            findExternalProjectContainingOpenScriptInfo(info) {
                return ts.find(this.externalProjects, proj => {
                    // Ensure project structure is up-to-date to check if info is present in external project
                    proj.updateGraph();
                    return proj.containsScriptInfo(info);
                });
            }
            openClientFileWithNormalizedPath(fileName, fileContent, scriptKind, hasMixedContent, projectRootPath) {
                let configFileName;
                let configFileErrors;
                const info = this.getOrCreateScriptInfoOpenedByClientForNormalizedPath(fileName, projectRootPath ? this.getNormalizedAbsolutePath(projectRootPath) : this.currentDirectory, fileContent, scriptKind, hasMixedContent);
                let project = this.findExternalProjectContainingOpenScriptInfo(info);
                if (!project && !this.syntaxOnly) { // Checking syntaxOnly is an optimization
                    configFileName = this.getConfigFileNameForFile(info, projectRootPath);
                    if (configFileName) {
                        project = this.findConfiguredProjectByProjectName(configFileName);
                        if (!project) {
                            project = this.createConfiguredProject(configFileName);
                            // Send the event only if the project got created as part of this open request and info is part of the project
                            if (info.isOrphan()) {
                                // Since the file isnt part of configured project, do not send config file info
                                configFileName = undefined;
                            }
                            else {
                                configFileErrors = project.getAllProjectErrors();
                                this.sendConfigFileDiagEvent(project, fileName);
                            }
                        }
                        else {
                            // Ensure project is ready to check if it contains opened script info
                            project.updateGraph();
                        }
                    }
                }
                // Project we have at this point is going to be updated since its either found through
                // - external project search, which updates the project before checking if info is present in it
                // - configured project - either created or updated to ensure we know correct status of info
                // At this point if file is part of any any configured or external project, then it would be present in the containing projects
                // So if it still doesnt have any containing projects, it needs to be part of inferred project
                if (info.isOrphan()) {
                    this.assignOrphanScriptInfoToInferredProject(info, projectRootPath);
                }
                ts.Debug.assert(!info.isOrphan());
                this.openFiles.set(info.path, projectRootPath);
                // Remove the configured projects that have zero references from open files.
                // This was postponed from closeOpenFile to after opening next file,
                // so that we can reuse the project if we need to right away
                this.configuredProjects.forEach(project => {
                    if (!project.hasOpenRef()) {
                        this.removeProject(project);
                    }
                });
                // Delete the orphan files here because there might be orphan script infos (which are not part of project)
                // when some file/s were closed which resulted in project removal.
                // It was then postponed to cleanup these script infos so that they can be reused if
                // the file from that old project is reopened because of opening file from here.
                this.deleteOrphanScriptInfoNotInAnyProject();
                this.printProjects();
                return { configFileName, configFileErrors };
            }
            /**
             * Close file whose contents is managed by the client
             * @param filename is absolute pathname
             */
            closeClientFile(uncheckedFileName) {
                const info = this.getScriptInfoForNormalizedPath(server.toNormalizedPath(uncheckedFileName));
                if (info) {
                    this.closeOpenFile(info);
                }
                this.printProjects();
            }
            collectChanges(lastKnownProjectVersions, currentProjects, result) {
                for (const proj of currentProjects) {
                    const knownProject = ts.forEach(lastKnownProjectVersions, p => p.projectName === proj.getProjectName() && p);
                    result.push(proj.getChangesSinceVersion(knownProject && knownProject.version));
                }
            }
            /* @internal */
            synchronizeProjectList(knownProjects) {
                const files = [];
                this.collectChanges(knownProjects, this.externalProjects, files);
                this.collectChanges(knownProjects, ts.arrayFrom(this.configuredProjects.values()), files);
                this.collectChanges(knownProjects, this.inferredProjects, files);
                return files;
            }
            /* @internal */
            applyChangesInOpenFiles(openFiles, changedFiles, closedFiles) {
                if (openFiles) {
                    for (const file of openFiles) {
                        const scriptInfo = this.getScriptInfo(file.fileName);
                        ts.Debug.assert(!scriptInfo || !scriptInfo.isScriptOpen(), "Script should not exist and not be open already");
                        const normalizedPath = scriptInfo ? scriptInfo.fileName : server.toNormalizedPath(file.fileName);
                        this.openClientFileWithNormalizedPath(normalizedPath, file.content, tryConvertScriptKindName(file.scriptKind), file.hasMixedContent);
                    }
                }
                if (changedFiles) {
                    for (const file of changedFiles) {
                        const scriptInfo = this.getScriptInfo(file.fileName);
                        ts.Debug.assert(!!scriptInfo);
                        this.applyChangesToFile(scriptInfo, file.changes);
                    }
                }
                if (closedFiles) {
                    for (const file of closedFiles) {
                        this.closeClientFile(file);
                    }
                }
            }
            /* @internal */
            applyChangesToFile(scriptInfo, changes) {
                // apply changes in reverse order
                for (let i = changes.length - 1; i >= 0; i--) {
                    const change = changes[i];
                    scriptInfo.editContent(change.span.start, change.span.start + change.span.length, change.newText);
                }
            }
            closeConfiguredProjectReferencedFromExternalProject(configFile) {
                const configuredProject = this.findConfiguredProjectByProjectName(configFile);
                if (configuredProject) {
                    configuredProject.deleteExternalProjectReference();
                    if (!configuredProject.hasOpenRef()) {
                        this.removeProject(configuredProject);
                        return;
                    }
                }
            }
            closeExternalProject(uncheckedFileName) {
                const fileName = server.toNormalizedPath(uncheckedFileName);
                const configFiles = this.externalProjectToConfiguredProjectMap.get(fileName);
                if (configFiles) {
                    for (const configFile of configFiles) {
                        this.closeConfiguredProjectReferencedFromExternalProject(configFile);
                    }
                    this.externalProjectToConfiguredProjectMap.delete(fileName);
                }
                else {
                    // close external project
                    const externalProject = this.findExternalProjectByProjectName(uncheckedFileName);
                    if (externalProject) {
                        this.removeProject(externalProject);
                    }
                }
            }
            openExternalProjects(projects) {
                // record project list before the update
                const projectsToClose = ts.arrayToMap(this.externalProjects, p => p.getProjectName(), _ => true);
                ts.forEachKey(this.externalProjectToConfiguredProjectMap, externalProjectName => {
                    projectsToClose.set(externalProjectName, true);
                });
                for (const externalProject of projects) {
                    this.openExternalProject(externalProject);
                    // delete project that is present in input list
                    projectsToClose.delete(externalProject.projectFileName);
                }
                // close projects that were missing in the input list
                ts.forEachKey(projectsToClose, externalProjectName => {
                    this.closeExternalProject(externalProjectName);
                });
            }
            static escapeFilenameForRegex(filename) {
                return filename.replace(this.filenameEscapeRegexp, "\\$&");
            }
            resetSafeList() {
                this.safelist = defaultTypeSafeList;
            }
            applySafeList(proj) {
                const { rootFiles, typeAcquisition } = proj;
                ts.Debug.assert(!!typeAcquisition, "proj.typeAcquisition should be set by now");
                // If type acquisition has been explicitly disabled, do not exclude anything from the project
                if (typeAcquisition.enable === false) {
                    return [];
                }
                const typeAcqInclude = typeAcquisition.include || (typeAcquisition.include = []);
                const excludeRules = [];
                const normalizedNames = rootFiles.map(f => ts.normalizeSlashes(f.fileName));
                const excludedFiles = [];
                for (const name of Object.keys(this.safelist)) {
                    const rule = this.safelist[name];
                    for (const root of normalizedNames) {
                        if (rule.match.test(root)) {
                            this.logger.info(`Excluding files based on rule ${name} matching file '${root}'`);
                            // If the file matches, collect its types packages and exclude rules
                            if (rule.types) {
                                for (const type of rule.types) {
                                    // Best-effort de-duping here - doesn't need to be unduplicated but
                                    // we don't want the list to become a 400-element array of just 'kendo'
                                    if (typeAcqInclude.indexOf(type) < 0) {
                                        typeAcqInclude.push(type);
                                    }
                                }
                            }
                            if (rule.exclude) {
                                for (const exclude of rule.exclude) {
                                    const processedRule = root.replace(rule.match, (...groups) => {
                                        return exclude.map(groupNumberOrString => {
                                            // RegExp group numbers are 1-based, but the first element in groups
                                            // is actually the original string, so it all works out in the end.
                                            if (typeof groupNumberOrString === "number") {
                                                if (!ts.isString(groups[groupNumberOrString])) {
                                                    // Specification was wrong - exclude nothing!
                                                    this.logger.info(`Incorrect RegExp specification in safelist rule ${name} - not enough groups`);
                                                    // * can't appear in a filename; escape it because it's feeding into a RegExp
                                                    return "\\*";
                                                }
                                                return ProjectService.escapeFilenameForRegex(groups[groupNumberOrString]);
                                            }
                                            return groupNumberOrString;
                                        }).join("");
                                    });
                                    if (excludeRules.indexOf(processedRule) === -1) {
                                        excludeRules.push(processedRule);
                                    }
                                }
                            }
                            else {
                                // If not rules listed, add the default rule to exclude the matched file
                                const escaped = ProjectService.escapeFilenameForRegex(root);
                                if (excludeRules.indexOf(escaped) < 0) {
                                    excludeRules.push(escaped);
                                }
                            }
                        }
                    }
                }
                const excludeRegexes = excludeRules.map(e => new RegExp(e, "i"));
                const filesToKeep = [];
                for (let i = 0; i < proj.rootFiles.length; i++) {
                    if (excludeRegexes.some(re => re.test(normalizedNames[i]))) {
                        excludedFiles.push(normalizedNames[i]);
                    }
                    else {
                        let exclude = false;
                        if (typeAcquisition.enable || typeAcquisition.enableAutoDiscovery) {
                            const baseName = ts.getBaseFileName(normalizedNames[i].toLowerCase());
                            if (ts.fileExtensionIs(baseName, "js")) {
                                const inferredTypingName = ts.removeFileExtension(baseName);
                                const cleanedTypingName = ts.removeMinAndVersionNumbers(inferredTypingName);
                                if (this.legacySafelist[cleanedTypingName]) {
                                    this.logger.info(`Excluded '${normalizedNames[i]}' because it matched ${cleanedTypingName} from the legacy safelist`);
                                    excludedFiles.push(normalizedNames[i]);
                                    // *exclude* it from the project...
                                    exclude = true;
                                    // ... but *include* it in the list of types to acquire
                                    const typeName = this.legacySafelist[cleanedTypingName];
                                    // Same best-effort dedupe as above
                                    if (typeAcqInclude.indexOf(typeName) < 0) {
                                        typeAcqInclude.push(typeName);
                                    }
                                }
                            }
                        }
                        if (!exclude) {
                            // Exclude any minified files that get this far
                            if (/^.+[\.-]min\.js$/.test(normalizedNames[i])) {
                                excludedFiles.push(normalizedNames[i]);
                            }
                            else {
                                filesToKeep.push(proj.rootFiles[i]);
                            }
                        }
                    }
                }
                proj.rootFiles = filesToKeep;
                return excludedFiles;
            }
            openExternalProject(proj) {
                // typingOptions has been deprecated and is only supported for backward compatibility
                // purposes. It should be removed in future releases - use typeAcquisition instead.
                if (proj.typingOptions && !proj.typeAcquisition) {
                    const typeAcquisition = ts.convertEnableAutoDiscoveryToEnable(proj.typingOptions);
                    proj.typeAcquisition = typeAcquisition;
                }
                proj.typeAcquisition = proj.typeAcquisition || {};
                proj.typeAcquisition.include = proj.typeAcquisition.include || [];
                proj.typeAcquisition.exclude = proj.typeAcquisition.exclude || [];
                if (proj.typeAcquisition.enable === undefined) {
                    proj.typeAcquisition.enable = server.hasNoTypeScriptSource(proj.rootFiles.map(f => f.fileName));
                }
                const excludedFiles = this.applySafeList(proj);
                let tsConfigFiles;
                const rootFiles = [];
                for (const file of proj.rootFiles) {
                    const normalized = server.toNormalizedPath(file.fileName);
                    if (server.getBaseConfigFileName(normalized)) {
                        if (!this.syntaxOnly && this.host.fileExists(normalized)) {
                            (tsConfigFiles || (tsConfigFiles = [])).push(normalized);
                        }
                    }
                    else {
                        rootFiles.push(file);
                    }
                }
                // sort config files to simplify comparison later
                if (tsConfigFiles) {
                    tsConfigFiles.sort();
                }
                const externalProject = this.findExternalProjectByProjectName(proj.projectFileName);
                let exisingConfigFiles;
                if (externalProject) {
                    externalProject.excludedFiles = excludedFiles;
                    if (!tsConfigFiles) {
                        const compilerOptions = convertCompilerOptions(proj.options);
                        const lastFileExceededProgramSize = this.getFilenameForExceededTotalSizeLimitForNonTsFiles(proj.projectFileName, compilerOptions, proj.rootFiles, externalFilePropertyReader);
                        if (lastFileExceededProgramSize) {
                            externalProject.disableLanguageService(lastFileExceededProgramSize);
                        }
                        else {
                            externalProject.enableLanguageService();
                        }
                        // external project already exists and not config files were added - update the project and return;
                        this.updateNonInferredProject(externalProject, proj.rootFiles, externalFilePropertyReader, compilerOptions, proj.typeAcquisition, proj.options.compileOnSave);
                        return;
                    }
                    // some config files were added to external project (that previously were not there)
                    // close existing project and later we'll open a set of configured projects for these files
                    this.closeExternalProject(proj.projectFileName);
                }
                else if (this.externalProjectToConfiguredProjectMap.get(proj.projectFileName)) {
                    // this project used to include config files
                    if (!tsConfigFiles) {
                        // config files were removed from the project - close existing external project which in turn will close configured projects
                        this.closeExternalProject(proj.projectFileName);
                    }
                    else {
                        // project previously had some config files - compare them with new set of files and close all configured projects that correspond to unused files
                        const oldConfigFiles = this.externalProjectToConfiguredProjectMap.get(proj.projectFileName);
                        let iNew = 0;
                        let iOld = 0;
                        while (iNew < tsConfigFiles.length && iOld < oldConfigFiles.length) {
                            const newConfig = tsConfigFiles[iNew];
                            const oldConfig = oldConfigFiles[iOld];
                            if (oldConfig < newConfig) {
                                this.closeConfiguredProjectReferencedFromExternalProject(oldConfig);
                                iOld++;
                            }
                            else if (oldConfig > newConfig) {
                                iNew++;
                            }
                            else {
                                // record existing config files so avoid extra add-refs
                                (exisingConfigFiles || (exisingConfigFiles = [])).push(oldConfig);
                                iOld++;
                                iNew++;
                            }
                        }
                        for (let i = iOld; i < oldConfigFiles.length; i++) {
                            // projects for all remaining old config files should be closed
                            this.closeConfiguredProjectReferencedFromExternalProject(oldConfigFiles[i]);
                        }
                    }
                }
                if (tsConfigFiles) {
                    // store the list of tsconfig files that belong to the external project
                    this.externalProjectToConfiguredProjectMap.set(proj.projectFileName, tsConfigFiles);
                    for (const tsconfigFile of tsConfigFiles) {
                        let project = this.findConfiguredProjectByProjectName(tsconfigFile);
                        if (!project) {
                            // errors are stored in the project
                            project = this.createConfiguredProject(tsconfigFile);
                        }
                        if (project && !ts.contains(exisingConfigFiles, tsconfigFile)) {
                            // keep project alive even if no documents are opened - its lifetime is bound to the lifetime of containing external project
                            project.addExternalProjectReference();
                        }
                    }
                }
                else {
                    // no config files - remove the item from the collection
                    this.externalProjectToConfiguredProjectMap.delete(proj.projectFileName);
                    this.createExternalProject(proj.projectFileName, rootFiles, proj.options, proj.typeAcquisition, excludedFiles);
                }
            }
        }
        /** Makes a filename safe to insert in a RegExp */
        ProjectService.filenameEscapeRegexp = /[-\/\\^$*+?.()|[\]{}]/g;
        server.ProjectService = ProjectService;
    })(server = ts.server || (ts.server = {}));
})(ts || (ts = {}));
