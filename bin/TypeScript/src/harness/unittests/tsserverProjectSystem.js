/// <reference path="..\harness.ts" />
/// <reference path="..\virtualFileSystemWithWatch.ts" />
/// <reference path="../../server/typingsInstaller/typingsInstaller.ts" />
var ts;
(function (ts) {
    var projectSystem;
    (function (projectSystem) {
        var TI = ts.server.typingsInstaller;
        var CommandNames = ts.server.CommandNames;
        projectSystem.TestServerHost = ts.TestFSWithWatch.TestServerHost;
        projectSystem.createServerHost = ts.TestFSWithWatch.createServerHost;
        projectSystem.checkArray = ts.TestFSWithWatch.checkArray;
        projectSystem.libFile = ts.TestFSWithWatch.libFile;
        projectSystem.checkWatchedFiles = ts.TestFSWithWatch.checkWatchedFiles;
        projectSystem.checkWatchedFilesDetailed = ts.TestFSWithWatch.checkWatchedFilesDetailed;
        projectSystem.checkWatchedDirectories = ts.TestFSWithWatch.checkWatchedDirectories;
        projectSystem.checkWatchedDirectoriesDetailed = ts.TestFSWithWatch.checkWatchedDirectoriesDetailed;
        var safeList = ts.TestFSWithWatch.safeList;
        projectSystem.customTypesMap = {
            path: "/typesMap.json",
            content: `{
            "typesMap": {
                "jquery": {
                    "match": "jquery(-(\\\\.?\\\\d+)+)?(\\\\.intellisense)?(\\\\.min)?\\\\.js$",
                    "types": ["jquery"]
                },
                "quack": {
                    "match": "/duckquack-(\\\\d+)\\\\.min\\\\.js",
                    "types": ["duck-types"]
                }
            },
            "simpleMap": {
                "Bacon": "baconjs",
                "bliss": "blissfuljs",
                "commander": "commander",
                "cordova": "cordova",
                "react": "react",
                "lodash": "lodash"
            }
        }`
        };
        projectSystem.nullLogger = {
            close: ts.noop,
            hasLevel: () => false,
            loggingEnabled: () => false,
            perftrc: ts.noop,
            info: ts.noop,
            msg: ts.noop,
            startGroup: ts.noop,
            endGroup: ts.noop,
            getLogFileName: () => undefined
        };
        class TestTypingsInstaller extends TI.TypingsInstaller {
            constructor(globalTypingsCacheLocation, throttleLimit, installTypingHost, typesRegistry = ts.createMap(), log) {
                super(installTypingHost, globalTypingsCacheLocation, safeList.path, projectSystem.customTypesMap.path, throttleLimit, log);
                this.globalTypingsCacheLocation = globalTypingsCacheLocation;
                this.typesRegistry = typesRegistry;
                this.postExecActions = [];
                this.isKnownTypesPackageName = ts.notImplemented;
                this.installPackage = ts.notImplemented;
                this.onProjectClosed = ts.noop;
            }
            executePendingCommands() {
                const actionsToRun = this.postExecActions;
                this.postExecActions = [];
                for (const action of actionsToRun) {
                    action.callback(action.success);
                }
            }
            checkPendingCommands(expectedCount) {
                assert.equal(this.postExecActions.length, expectedCount, `Expected ${expectedCount} post install actions`);
            }
            attach(projectService) {
                this.projectService = projectService;
            }
            getInstallTypingHost() {
                return this.installTypingHost;
            }
            installWorker(_requestId, _args, _cwd, cb) {
                this.addPostExecAction("success", cb);
            }
            sendResponse(response) {
                this.projectService.updateTypingsForProject(response);
            }
            enqueueInstallTypingsRequest(project, typeAcquisition, unresolvedImports) {
                const request = ts.server.createInstallTypingsRequest(project, typeAcquisition, unresolvedImports, this.globalTypingsCacheLocation);
                this.install(request);
            }
            addPostExecAction(stdout, cb) {
                const out = ts.isString(stdout) ? stdout : createNpmPackageJsonString(stdout);
                const action = {
                    success: !!out,
                    callback: cb
                };
                this.postExecActions.push(action);
            }
        }
        projectSystem.TestTypingsInstaller = TestTypingsInstaller;
        function createNpmPackageJsonString(installedTypings) {
            const dependencies = {};
            for (const typing of installedTypings) {
                dependencies[typing] = "1.0.0";
            }
            return JSON.stringify({ dependencies });
        }
        function createTypesRegistry(...list) {
            const versionMap = {
                "latest": "1.3.0",
                "ts2.0": "1.0.0",
                "ts2.1": "1.0.0",
                "ts2.2": "1.2.0",
                "ts2.3": "1.3.0",
                "ts2.4": "1.3.0",
                "ts2.5": "1.3.0",
                "ts2.6": "1.3.0",
                "ts2.7": "1.3.0"
            };
            const map = ts.createMap();
            for (const l of list) {
                map.set(l, versionMap);
            }
            return map;
        }
        projectSystem.createTypesRegistry = createTypesRegistry;
        function createHostModuleResolutionTrace(host) {
            const resolutionTrace = [];
            host.trace = resolutionTrace.push.bind(resolutionTrace);
            return resolutionTrace;
        }
        function toExternalFile(fileName) {
            return { fileName };
        }
        projectSystem.toExternalFile = toExternalFile;
        function toExternalFiles(fileNames) {
            return ts.map(fileNames, toExternalFile);
        }
        projectSystem.toExternalFiles = toExternalFiles;
        function fileStats(nonZeroStats) {
            return Object.assign({ ts: 0, tsx: 0, dts: 0, js: 0, jsx: 0 }, nonZeroStats);
        }
        projectSystem.fileStats = fileStats;
        class TestServerEventManager {
            constructor(files, suppressDiagnosticEvents) {
                this.events = [];
                this.host = projectSystem.createServerHost(files);
                this.session = createSession(this.host, {
                    canUseEvents: true,
                    eventHandler: event => this.events.push(event),
                    suppressDiagnosticEvents,
                });
                this.service = this.session.getProjectService();
            }
            getEvents() {
                const events = this.events;
                this.events = [];
                return events;
            }
            getEvent(eventName) {
                let eventData;
                ts.filterMutate(this.events, e => {
                    if (e.eventName === eventName) {
                        if (eventData !== undefined) {
                            assert(false, "more than one event found");
                        }
                        eventData = e.data;
                        return false;
                    }
                    return true;
                });
                assert.isDefined(eventData);
                return eventData;
            }
            hasZeroEvent(eventName) {
                this.events.forEach(event => assert.notEqual(event.eventName, eventName));
            }
            checkSingleConfigFileDiagEvent(configFileName, triggerFile) {
                const eventData = this.getEvent(ts.server.ConfigFileDiagEvent);
                assert.equal(eventData.configFileName, configFileName);
                assert.equal(eventData.triggerFile, triggerFile);
            }
            assertProjectInfoTelemetryEvent(partial, configFile) {
                assert.deepEqual(this.getEvent(ts.server.ProjectInfoTelemetryEvent), Object.assign({ projectId: Harness.mockHash(configFile || "/tsconfig.json"), fileStats: fileStats({ ts: 1 }), compilerOptions: {}, extends: false, files: false, include: false, exclude: false, compileOnSave: false, typeAcquisition: {
                        enable: false,
                        exclude: false,
                        include: false,
                    }, configFileName: "tsconfig.json", projectType: "configured", languageServiceEnabled: true, version: ts.version }, partial));
            }
        }
        projectSystem.TestServerEventManager = TestServerEventManager;
        class TestSession extends ts.server.Session {
            constructor() {
                super(...arguments);
                this.seq = 0;
                this.events = [];
            }
            getProjectService() {
                return this.projectService;
            }
            getSeq() {
                return this.seq;
            }
            getNextSeq() {
                return this.seq + 1;
            }
            executeCommandSeq(request) {
                this.seq++;
                request.seq = this.seq;
                request.type = "request";
                return this.executeCommand(request);
            }
            event(body, eventName) {
                this.events.push(ts.server.toEvent(eventName, body));
                super.event(body, eventName);
            }
            clearMessages() {
                ts.clear(this.events);
                this.host.clearOutput();
            }
        }
        function createSession(host, opts = {}) {
            if (opts.typingsInstaller === undefined) {
                opts.typingsInstaller = new TestTypingsInstaller("/a/data/", /*throttleLimit*/ 5, host);
            }
            if (opts.eventHandler !== undefined) {
                opts.canUseEvents = true;
            }
            const sessionOptions = {
                host,
                cancellationToken: ts.server.nullCancellationToken,
                useSingleInferredProject: false,
                useInferredProjectPerProjectRoot: false,
                typingsInstaller: undefined,
                byteLength: Utils.byteLength,
                hrtime: process.hrtime,
                logger: opts.logger || projectSystem.nullLogger,
                canUseEvents: false
            };
            return new TestSession(Object.assign({}, sessionOptions, opts));
        }
        projectSystem.createSession = createSession;
        class TestProjectService extends ts.server.ProjectService {
            constructor(host, logger, cancellationToken, useSingleInferredProject, typingsInstaller, eventHandler, opts = {}) {
                super(Object.assign({ host,
                    logger,
                    cancellationToken,
                    useSingleInferredProject, useInferredProjectPerProjectRoot: false, typingsInstaller, typesMapLocation: projectSystem.customTypesMap.path, eventHandler }, opts));
            }
            checkNumberOfProjects(count) {
                checkNumberOfProjects(this, count);
            }
        }
        projectSystem.TestProjectService = TestProjectService;
        function createProjectService(host, parameters = {}, options) {
            const cancellationToken = parameters.cancellationToken || ts.server.nullCancellationToken;
            const logger = parameters.logger || projectSystem.nullLogger;
            const useSingleInferredProject = parameters.useSingleInferredProject !== undefined ? parameters.useSingleInferredProject : false;
            return new TestProjectService(host, logger, cancellationToken, useSingleInferredProject, parameters.typingsInstaller, parameters.eventHandler, options);
        }
        projectSystem.createProjectService = createProjectService;
        function checkNumberOfConfiguredProjects(projectService, expected) {
            assert.equal(projectService.configuredProjects.size, expected, `expected ${expected} configured project(s)`);
        }
        projectSystem.checkNumberOfConfiguredProjects = checkNumberOfConfiguredProjects;
        function checkNumberOfExternalProjects(projectService, expected) {
            assert.equal(projectService.externalProjects.length, expected, `expected ${expected} external project(s)`);
        }
        function checkNumberOfInferredProjects(projectService, expected) {
            assert.equal(projectService.inferredProjects.length, expected, `expected ${expected} inferred project(s)`);
        }
        function checkNumberOfProjects(projectService, count) {
            checkNumberOfConfiguredProjects(projectService, count.configuredProjects || 0);
            checkNumberOfExternalProjects(projectService, count.externalProjects || 0);
            checkNumberOfInferredProjects(projectService, count.inferredProjects || 0);
        }
        projectSystem.checkNumberOfProjects = checkNumberOfProjects;
        function configuredProjectAt(projectService, index) {
            const values = projectService.configuredProjects.values();
            while (index > 0) {
                values.next();
                index--;
            }
            return values.next().value;
        }
        projectSystem.configuredProjectAt = configuredProjectAt;
        function checkProjectActualFiles(project, expectedFiles) {
            projectSystem.checkArray(`${ts.server.ProjectKind[project.projectKind]} project, actual files`, project.getFileNames(), expectedFiles);
        }
        projectSystem.checkProjectActualFiles = checkProjectActualFiles;
        function checkProjectRootFiles(project, expectedFiles) {
            projectSystem.checkArray(`${ts.server.ProjectKind[project.projectKind]} project, rootFileNames`, project.getRootFiles(), expectedFiles);
        }
        function mapCombinedPathsInAncestor(dir, path2, mapAncestor) {
            dir = ts.normalizePath(dir);
            const result = [];
            ts.forEachAncestorDirectory(dir, ancestor => {
                if (mapAncestor(ancestor)) {
                    result.push(ts.combinePaths(ancestor, path2));
                }
            });
            return result;
        }
        function getRootsToWatchWithAncestorDirectory(dir, path2) {
            return mapCombinedPathsInAncestor(dir, path2, ancestor => ancestor.split(ts.directorySeparator).length > 4);
        }
        const nodeModules = "node_modules";
        function getNodeModuleDirectories(dir) {
            return getRootsToWatchWithAncestorDirectory(dir, nodeModules);
        }
        projectSystem.nodeModulesAtTypes = "node_modules/@types";
        function getTypeRootsFromLocation(currentDirectory) {
            return getRootsToWatchWithAncestorDirectory(currentDirectory, projectSystem.nodeModulesAtTypes);
        }
        projectSystem.getTypeRootsFromLocation = getTypeRootsFromLocation;
        function getNumberOfWatchesInvokedForRecursiveWatches(recursiveWatchedDirs, file) {
            return ts.countWhere(recursiveWatchedDirs, dir => file.length > dir.length && ts.startsWith(file, dir) && file[dir.length] === ts.directorySeparator);
        }
        function checkOpenFiles(projectService, expectedFiles) {
            projectSystem.checkArray("Open files", ts.arrayFrom(projectService.openFiles.keys(), path => projectService.getScriptInfoForPath(path).fileName), expectedFiles.map(file => file.path));
        }
        /**
         * Test server cancellation token used to mock host token cancellation requests.
         * The cancelAfterRequest constructor param specifies how many isCancellationRequested() calls
         * should be made before canceling the token. The id of the request to cancel should be set with
         * setRequestToCancel();
         */
        class TestServerCancellationToken {
            constructor(cancelAfterRequest = 0) {
                this.cancelAfterRequest = cancelAfterRequest;
                this.currentId = -1;
                this.requestToCancel = -1;
                this.isCancellationRequestedCount = 0;
            }
            setRequest(requestId) {
                this.currentId = requestId;
            }
            setRequestToCancel(requestId) {
                this.resetToken();
                this.requestToCancel = requestId;
            }
            resetRequest(requestId) {
                assert.equal(requestId, this.currentId, "unexpected request id in cancellation");
                this.currentId = undefined;
            }
            isCancellationRequested() {
                this.isCancellationRequestedCount++;
                // If the request id is the request to cancel and isCancellationRequestedCount
                // has been met then cancel the request. Ex: cancel the request if it is a
                // nav bar request & isCancellationRequested() has already been called three times.
                return this.requestToCancel === this.currentId && this.isCancellationRequestedCount >= this.cancelAfterRequest;
            }
            resetToken() {
                this.currentId = -1;
                this.isCancellationRequestedCount = 0;
                this.requestToCancel = -1;
            }
        }
        projectSystem.TestServerCancellationToken = TestServerCancellationToken;
        function makeSessionRequest(command, args) {
            const newRequest = {
                seq: 0,
                type: "request",
                command,
                arguments: args
            };
            return newRequest;
        }
        projectSystem.makeSessionRequest = makeSessionRequest;
        function openFilesForSession(files, session) {
            for (const file of files) {
                const request = makeSessionRequest(CommandNames.Open, { file: file.path });
                session.executeCommand(request);
            }
        }
        projectSystem.openFilesForSession = openFilesForSession;
        function getProtocolDiagnosticMessage({ diagnosticMessage, errorTextArguments = [] }) {
            return ts.formatStringFromArgs(diagnosticMessage.message, errorTextArguments);
        }
        function verifyDiagnostics(actual, expected) {
            const expectedErrors = expected.map(getProtocolDiagnosticMessage);
            assert.deepEqual(actual.map(diag => ts.flattenDiagnosticMessageText(diag.text, "\n")), expectedErrors);
        }
        function verifyNoDiagnostics(actual) {
            verifyDiagnostics(actual, []);
        }
        function checkErrorMessage(session, eventName, diagnostics, isMostRecent = false) {
            checkNthEvent(session, ts.server.toEvent(eventName, diagnostics), 0, isMostRecent);
        }
        function checkCompleteEvent(session, numberOfCurrentEvents, expectedSequenceId, isMostRecent = true) {
            checkNthEvent(session, ts.server.toEvent("requestCompleted", { request_seq: expectedSequenceId }), numberOfCurrentEvents - 1, isMostRecent);
        }
        function checkProjectUpdatedInBackgroundEvent(session, openFiles) {
            checkNthEvent(session, ts.server.toEvent("projectsUpdatedInBackground", { openFiles }), 0, /*isMostRecent*/ true);
        }
        function checkNoDiagnosticEvents(session) {
            for (const event of session.events) {
                assert.isFalse(event.event.endsWith("Diag"), JSON.stringify(event));
            }
        }
        function checkNthEvent(session, expectedEvent, index, isMostRecent) {
            const events = session.events;
            assert.deepEqual(events[index], expectedEvent);
            const outputs = session.host.getOutput();
            assert.equal(outputs[index], ts.server.formatMessage(expectedEvent, projectSystem.nullLogger, Utils.byteLength, session.host.newLine));
            if (isMostRecent) {
                assert.strictEqual(events.length, index + 1, JSON.stringify(events));
                assert.strictEqual(outputs.length, index + 1, JSON.stringify(outputs));
            }
        }
        describe("tsserverProjectSystem general functionality", () => {
            const commonFile1 = {
                path: "/a/b/commonFile1.ts",
                content: "let x = 1"
            };
            const commonFile2 = {
                path: "/a/b/commonFile2.ts",
                content: "let y = 1"
            };
            it("create inferred project", () => {
                const appFile = {
                    path: "/a/b/c/app.ts",
                    content: `
                import {f} from "./module"
                console.log(f)
                `
                };
                const moduleFile = {
                    path: "/a/b/c/module.d.ts",
                    content: `export let x: number`
                };
                const host = projectSystem.createServerHost([appFile, moduleFile, projectSystem.libFile]);
                const projectService = createProjectService(host);
                const { configFileName } = projectService.openClientFile(appFile.path);
                assert(!configFileName, `should not find config, got: '${configFileName}`);
                checkNumberOfConfiguredProjects(projectService, 0);
                checkNumberOfInferredProjects(projectService, 1);
                const project = projectService.inferredProjects[0];
                projectSystem.checkArray("inferred project", project.getFileNames(), [appFile.path, projectSystem.libFile.path, moduleFile.path]);
                const configFileLocations = ["/a/b/c/", "/a/b/", "/a/", "/"];
                const configFiles = ts.flatMap(configFileLocations, location => [location + "tsconfig.json", location + "jsconfig.json"]);
                projectSystem.checkWatchedFiles(host, configFiles.concat(projectSystem.libFile.path, moduleFile.path));
                projectSystem.checkWatchedDirectories(host, [], /*recursive*/ false);
                projectSystem.checkWatchedDirectories(host, ["/a/b/c", ts.combinePaths(ts.getDirectoryPath(appFile.path), projectSystem.nodeModulesAtTypes)], /*recursive*/ true);
            });
            it("can handle tsconfig file name with difference casing", () => {
                const f1 = {
                    path: "/a/b/app.ts",
                    content: "let x = 1"
                };
                const config = {
                    path: "/a/b/tsconfig.json",
                    content: JSON.stringify({
                        include: []
                    })
                };
                const host = projectSystem.createServerHost([f1, config], { useCaseSensitiveFileNames: false });
                const service = createProjectService(host);
                const upperCaseConfigFilePath = ts.combinePaths(ts.getDirectoryPath(config.path).toUpperCase(), ts.getBaseFileName(config.path));
                service.openExternalProject({
                    projectFileName: "/a/b/project.csproj",
                    rootFiles: toExternalFiles([f1.path, upperCaseConfigFilePath]),
                    options: {}
                });
                service.checkNumberOfProjects({ configuredProjects: 1 });
                checkProjectActualFiles(configuredProjectAt(service, 0), [upperCaseConfigFilePath]);
                service.openClientFile(f1.path);
                service.checkNumberOfProjects({ configuredProjects: 1, inferredProjects: 1 });
                checkProjectActualFiles(configuredProjectAt(service, 0), [upperCaseConfigFilePath]);
                checkProjectActualFiles(service.inferredProjects[0], [f1.path]);
            });
            it("create configured project without file list", () => {
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: `
                {
                    "compilerOptions": {},
                    "exclude": [
                        "e"
                    ]
                }`
                };
                const file1 = {
                    path: "/a/b/c/f1.ts",
                    content: "let x = 1"
                };
                const file2 = {
                    path: "/a/b/d/f2.ts",
                    content: "let y = 1"
                };
                const file3 = {
                    path: "/a/b/e/f3.ts",
                    content: "let z = 1"
                };
                const host = projectSystem.createServerHost([configFile, projectSystem.libFile, file1, file2, file3]);
                const projectService = createProjectService(host);
                const { configFileName, configFileErrors } = projectService.openClientFile(file1.path);
                assert(configFileName, "should find config file");
                assert.isTrue(!configFileErrors || configFileErrors.length === 0, `expect no errors in config file, got ${JSON.stringify(configFileErrors)}`);
                checkNumberOfInferredProjects(projectService, 0);
                checkNumberOfConfiguredProjects(projectService, 1);
                const project = configuredProjectAt(projectService, 0);
                checkProjectActualFiles(project, [file1.path, projectSystem.libFile.path, file2.path, configFile.path]);
                checkProjectRootFiles(project, [file1.path, file2.path]);
                // watching all files except one that was open
                projectSystem.checkWatchedFiles(host, [configFile.path, file2.path, projectSystem.libFile.path]);
                const configFileDirectory = ts.getDirectoryPath(configFile.path);
                projectSystem.checkWatchedDirectories(host, [configFileDirectory, ts.combinePaths(configFileDirectory, projectSystem.nodeModulesAtTypes)], /*recursive*/ true);
            });
            it("create configured project with the file list", () => {
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: `
                {
                    "compilerOptions": {},
                    "include": ["*.ts"]
                }`
                };
                const file1 = {
                    path: "/a/b/f1.ts",
                    content: "let x = 1"
                };
                const file2 = {
                    path: "/a/b/f2.ts",
                    content: "let y = 1"
                };
                const file3 = {
                    path: "/a/b/c/f3.ts",
                    content: "let z = 1"
                };
                const host = projectSystem.createServerHost([configFile, projectSystem.libFile, file1, file2, file3]);
                const projectService = createProjectService(host);
                const { configFileName, configFileErrors } = projectService.openClientFile(file1.path);
                assert(configFileName, "should find config file");
                assert.isTrue(!configFileErrors || configFileErrors.length === 0, `expect no errors in config file, got ${JSON.stringify(configFileErrors)}`);
                checkNumberOfInferredProjects(projectService, 0);
                checkNumberOfConfiguredProjects(projectService, 1);
                const project = configuredProjectAt(projectService, 0);
                checkProjectActualFiles(project, [file1.path, projectSystem.libFile.path, file2.path, configFile.path]);
                checkProjectRootFiles(project, [file1.path, file2.path]);
                // watching all files except one that was open
                projectSystem.checkWatchedFiles(host, [configFile.path, file2.path, projectSystem.libFile.path]);
                projectSystem.checkWatchedDirectories(host, [ts.getDirectoryPath(configFile.path)], /*recursive*/ false);
            });
            it("add and then remove a config file in a folder with loose files", () => {
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: `{
                    "files": ["commonFile1.ts"]
                }`
                };
                const filesWithoutConfig = [projectSystem.libFile, commonFile1, commonFile2];
                const host = projectSystem.createServerHost(filesWithoutConfig);
                const filesWithConfig = [projectSystem.libFile, commonFile1, commonFile2, configFile];
                const projectService = createProjectService(host);
                projectService.openClientFile(commonFile1.path);
                projectService.openClientFile(commonFile2.path);
                checkNumberOfInferredProjects(projectService, 2);
                const configFileLocations = ["/", "/a/", "/a/b/"];
                const watchedFiles = ts.flatMap(configFileLocations, location => [location + "tsconfig.json", location + "jsconfig.json"]).concat(projectSystem.libFile.path);
                projectSystem.checkWatchedFiles(host, watchedFiles);
                // Add a tsconfig file
                host.reloadFS(filesWithConfig);
                host.checkTimeoutQueueLengthAndRun(1);
                checkNumberOfInferredProjects(projectService, 1);
                checkNumberOfConfiguredProjects(projectService, 1);
                projectSystem.checkWatchedFiles(host, watchedFiles);
                // remove the tsconfig file
                host.reloadFS(filesWithoutConfig);
                checkNumberOfInferredProjects(projectService, 1);
                host.checkTimeoutQueueLengthAndRun(1); // Refresh inferred projects
                checkNumberOfInferredProjects(projectService, 2);
                checkNumberOfConfiguredProjects(projectService, 0);
                projectSystem.checkWatchedFiles(host, watchedFiles);
            });
            it("add new files to a configured project without file list", () => {
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: `{}`
                };
                const host = projectSystem.createServerHost([commonFile1, projectSystem.libFile, configFile]);
                const projectService = createProjectService(host);
                projectService.openClientFile(commonFile1.path);
                const configFileDir = ts.getDirectoryPath(configFile.path);
                projectSystem.checkWatchedDirectories(host, [configFileDir, ts.combinePaths(configFileDir, projectSystem.nodeModulesAtTypes)], /*recursive*/ true);
                checkNumberOfConfiguredProjects(projectService, 1);
                const project = configuredProjectAt(projectService, 0);
                checkProjectRootFiles(project, [commonFile1.path]);
                // add a new ts file
                host.reloadFS([commonFile1, commonFile2, projectSystem.libFile, configFile]);
                host.checkTimeoutQueueLengthAndRun(2);
                // project service waits for 250ms to update the project structure, therefore the assertion needs to wait longer.
                checkProjectRootFiles(project, [commonFile1.path, commonFile2.path]);
            });
            it("should ignore non-existing files specified in the config file", () => {
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: `{
                    "compilerOptions": {},
                    "files": [
                        "commonFile1.ts",
                        "commonFile3.ts"
                    ]
                }`
                };
                const host = projectSystem.createServerHost([commonFile1, commonFile2, configFile]);
                const projectService = createProjectService(host);
                projectService.openClientFile(commonFile1.path);
                projectService.openClientFile(commonFile2.path);
                checkNumberOfConfiguredProjects(projectService, 1);
                const project = configuredProjectAt(projectService, 0);
                checkProjectRootFiles(project, [commonFile1.path]);
                checkNumberOfInferredProjects(projectService, 1);
            });
            it("remove not-listed external projects", () => {
                const f1 = {
                    path: "/a/app.ts",
                    content: "let x = 1"
                };
                const f2 = {
                    path: "/b/app.ts",
                    content: "let x = 1"
                };
                const f3 = {
                    path: "/c/app.ts",
                    content: "let x = 1"
                };
                const makeProject = (f) => ({ projectFileName: f.path + ".csproj", rootFiles: [toExternalFile(f.path)], options: {} });
                const p1 = makeProject(f1);
                const p2 = makeProject(f2);
                const p3 = makeProject(f3);
                const host = projectSystem.createServerHost([f1, f2, f3]);
                const session = createSession(host);
                session.executeCommand({
                    seq: 1,
                    type: "request",
                    command: "openExternalProjects",
                    arguments: { projects: [p1, p2] }
                });
                const projectService = session.getProjectService();
                checkNumberOfProjects(projectService, { externalProjects: 2 });
                assert.equal(projectService.externalProjects[0].getProjectName(), p1.projectFileName);
                assert.equal(projectService.externalProjects[1].getProjectName(), p2.projectFileName);
                session.executeCommand({
                    seq: 2,
                    type: "request",
                    command: "openExternalProjects",
                    arguments: { projects: [p1, p3] }
                });
                checkNumberOfProjects(projectService, { externalProjects: 2 });
                assert.equal(projectService.externalProjects[0].getProjectName(), p1.projectFileName);
                assert.equal(projectService.externalProjects[1].getProjectName(), p3.projectFileName);
                session.executeCommand({
                    seq: 3,
                    type: "request",
                    command: "openExternalProjects",
                    arguments: { projects: [] }
                });
                checkNumberOfProjects(projectService, { externalProjects: 0 });
                session.executeCommand({
                    seq: 3,
                    type: "request",
                    command: "openExternalProjects",
                    arguments: { projects: [p2] }
                });
                assert.equal(projectService.externalProjects[0].getProjectName(), p2.projectFileName);
            });
            it("handle recreated files correctly", () => {
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: `{}`
                };
                const host = projectSystem.createServerHost([commonFile1, commonFile2, configFile]);
                const projectService = createProjectService(host);
                projectService.openClientFile(commonFile1.path);
                checkNumberOfConfiguredProjects(projectService, 1);
                const project = configuredProjectAt(projectService, 0);
                checkProjectRootFiles(project, [commonFile1.path, commonFile2.path]);
                // delete commonFile2
                host.reloadFS([commonFile1, configFile]);
                host.checkTimeoutQueueLengthAndRun(2);
                checkProjectRootFiles(project, [commonFile1.path]);
                // re-add commonFile2
                host.reloadFS([commonFile1, commonFile2, configFile]);
                host.checkTimeoutQueueLengthAndRun(2);
                checkProjectRootFiles(project, [commonFile1.path, commonFile2.path]);
            });
            it("handles the missing files - that were added to program because they were added with ///<ref", () => {
                const file1 = {
                    path: "/a/b/commonFile1.ts",
                    content: `/// <reference path="commonFile2.ts"/>
                    let x = y`
                };
                const host = projectSystem.createServerHost([file1, projectSystem.libFile]);
                const session = createSession(host);
                openFilesForSession([file1], session);
                const projectService = session.getProjectService();
                checkNumberOfInferredProjects(projectService, 1);
                const project = projectService.inferredProjects[0];
                checkProjectRootFiles(project, [file1.path]);
                checkProjectActualFiles(project, [file1.path, projectSystem.libFile.path]);
                const getErrRequest = makeSessionRequest(ts.server.CommandNames.SemanticDiagnosticsSync, { file: file1.path });
                // Two errors: CommonFile2 not found and cannot find name y
                let diags = session.executeCommand(getErrRequest).response;
                verifyDiagnostics(diags, [
                    { diagnosticMessage: Diagnostics.Cannot_find_name_0, errorTextArguments: ["y"] },
                    { diagnosticMessage: Diagnostics.File_0_not_found, errorTextArguments: [commonFile2.path] }
                ]);
                host.reloadFS([file1, commonFile2, projectSystem.libFile]);
                host.runQueuedTimeoutCallbacks();
                checkNumberOfInferredProjects(projectService, 1);
                assert.strictEqual(projectService.inferredProjects[0], project, "Inferred project should be same");
                checkProjectRootFiles(project, [file1.path]);
                checkProjectActualFiles(project, [file1.path, projectSystem.libFile.path, commonFile2.path]);
                diags = session.executeCommand(getErrRequest).response;
                verifyNoDiagnostics(diags);
            });
            it("should create new inferred projects for files excluded from a configured project", () => {
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: `{
                    "compilerOptions": {},
                    "files": ["${commonFile1.path}", "${commonFile2.path}"]
                }`
                };
                const files = [commonFile1, commonFile2, configFile];
                const host = projectSystem.createServerHost(files);
                const projectService = createProjectService(host);
                projectService.openClientFile(commonFile1.path);
                const project = configuredProjectAt(projectService, 0);
                checkProjectRootFiles(project, [commonFile1.path, commonFile2.path]);
                configFile.content = `{
                "compilerOptions": {},
                "files": ["${commonFile1.path}"]
            }`;
                host.reloadFS(files);
                checkNumberOfConfiguredProjects(projectService, 1);
                checkProjectRootFiles(project, [commonFile1.path, commonFile2.path]);
                host.checkTimeoutQueueLengthAndRun(2); // Update the configured project + refresh inferred projects
                checkNumberOfConfiguredProjects(projectService, 1);
                checkProjectRootFiles(project, [commonFile1.path]);
                projectService.openClientFile(commonFile2.path);
                checkNumberOfInferredProjects(projectService, 1);
            });
            it("files explicitly excluded in config file", () => {
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: `{
                    "compilerOptions": {},
                    "exclude": ["/a/c"]
                }`
                };
                const excludedFile1 = {
                    path: "/a/c/excluedFile1.ts",
                    content: `let t = 1;`
                };
                const host = projectSystem.createServerHost([commonFile1, commonFile2, excludedFile1, configFile]);
                const projectService = createProjectService(host);
                projectService.openClientFile(commonFile1.path);
                checkNumberOfConfiguredProjects(projectService, 1);
                const project = configuredProjectAt(projectService, 0);
                checkProjectRootFiles(project, [commonFile1.path, commonFile2.path]);
                projectService.openClientFile(excludedFile1.path);
                checkNumberOfInferredProjects(projectService, 1);
            });
            it("should properly handle module resolution changes in config file", () => {
                const file1 = {
                    path: "/a/b/file1.ts",
                    content: `import { T } from "module1";`
                };
                const nodeModuleFile = {
                    path: "/a/b/node_modules/module1.ts",
                    content: `export interface T {}`
                };
                const classicModuleFile = {
                    path: "/a/module1.ts",
                    content: `export interface T {}`
                };
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: `{
                    "compilerOptions": {
                        "moduleResolution": "node"
                    },
                    "files": ["${file1.path}"]
                }`
                };
                const files = [file1, nodeModuleFile, classicModuleFile, configFile];
                const host = projectSystem.createServerHost(files);
                const projectService = createProjectService(host);
                projectService.openClientFile(file1.path);
                projectService.openClientFile(nodeModuleFile.path);
                projectService.openClientFile(classicModuleFile.path);
                checkNumberOfConfiguredProjects(projectService, 1);
                const project = configuredProjectAt(projectService, 0);
                checkProjectActualFiles(project, [file1.path, nodeModuleFile.path, configFile.path]);
                checkNumberOfInferredProjects(projectService, 1);
                configFile.content = `{
                "compilerOptions": {
                    "moduleResolution": "classic"
                },
                "files": ["${file1.path}"]
            }`;
                host.reloadFS(files);
                host.checkTimeoutQueueLengthAndRun(2);
                checkProjectActualFiles(project, [file1.path, classicModuleFile.path, configFile.path]);
                checkNumberOfInferredProjects(projectService, 1);
            });
            it("should keep the configured project when the opened file is referenced by the project but not its root", () => {
                const file1 = {
                    path: "/a/b/main.ts",
                    content: "import { objA } from './obj-a';"
                };
                const file2 = {
                    path: "/a/b/obj-a.ts",
                    content: `export const objA = Object.assign({foo: "bar"}, {bar: "baz"});`
                };
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: `{
                    "compilerOptions": {
                        "target": "es6"
                    },
                    "files": [ "main.ts" ]
                }`
                };
                const host = projectSystem.createServerHost([file1, file2, configFile]);
                const projectService = createProjectService(host);
                projectService.openClientFile(file1.path);
                projectService.closeClientFile(file1.path);
                projectService.openClientFile(file2.path);
                checkNumberOfConfiguredProjects(projectService, 1);
                checkNumberOfInferredProjects(projectService, 0);
            });
            it("should keep the configured project when the opened file is referenced by the project but not its root", () => {
                const file1 = {
                    path: "/a/b/main.ts",
                    content: "import { objA } from './obj-a';"
                };
                const file2 = {
                    path: "/a/b/obj-a.ts",
                    content: `export const objA = Object.assign({foo: "bar"}, {bar: "baz"});`
                };
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: `{
                    "compilerOptions": {
                        "target": "es6"
                    },
                    "files": [ "main.ts" ]
                }`
                };
                const host = projectSystem.createServerHost([file1, file2, configFile]);
                const projectService = createProjectService(host);
                projectService.openClientFile(file1.path);
                projectService.closeClientFile(file1.path);
                projectService.openClientFile(file2.path);
                checkNumberOfConfiguredProjects(projectService, 1);
                checkNumberOfInferredProjects(projectService, 0);
            });
            it("should tolerate config file errors and still try to build a project", () => {
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: `{
                    "compilerOptions": {
                        "target": "es6",
                        "allowAnything": true
                    },
                    "someOtherProperty": {}
                }`
                };
                const host = projectSystem.createServerHost([commonFile1, commonFile2, projectSystem.libFile, configFile]);
                const projectService = createProjectService(host);
                projectService.openClientFile(commonFile1.path);
                checkNumberOfConfiguredProjects(projectService, 1);
                checkProjectRootFiles(configuredProjectAt(projectService, 0), [commonFile1.path, commonFile2.path]);
            });
            it("should disable features when the files are too large", () => {
                const file1 = {
                    path: "/a/b/f1.js",
                    content: "let x =1;",
                    fileSize: 10 * 1024 * 1024
                };
                const file2 = {
                    path: "/a/b/f2.js",
                    content: "let y =1;",
                    fileSize: 6 * 1024 * 1024
                };
                const file3 = {
                    path: "/a/b/f3.js",
                    content: "let y =1;",
                    fileSize: 6 * 1024 * 1024
                };
                const proj1name = "proj1", proj2name = "proj2", proj3name = "proj3";
                const host = projectSystem.createServerHost([file1, file2, file3]);
                const projectService = createProjectService(host);
                projectService.openExternalProject({ rootFiles: toExternalFiles([file1.path]), options: {}, projectFileName: proj1name });
                const proj1 = projectService.findProject(proj1name);
                assert.isTrue(proj1.languageServiceEnabled);
                projectService.openExternalProject({ rootFiles: toExternalFiles([file2.path]), options: {}, projectFileName: proj2name });
                const proj2 = projectService.findProject(proj2name);
                assert.isTrue(proj2.languageServiceEnabled);
                projectService.openExternalProject({ rootFiles: toExternalFiles([file3.path]), options: {}, projectFileName: proj3name });
                const proj3 = projectService.findProject(proj3name);
                assert.isFalse(proj3.languageServiceEnabled);
            });
            it("should use only one inferred project if 'useOneInferredProject' is set", () => {
                const file1 = {
                    path: "/a/b/main.ts",
                    content: "let x =1;"
                };
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: `{
                    "compilerOptions": {
                        "target": "es6"
                    },
                    "files": [ "main.ts" ]
                }`
                };
                const file2 = {
                    path: "/a/c/main.ts",
                    content: "let x =1;"
                };
                const file3 = {
                    path: "/a/d/main.ts",
                    content: "let x =1;"
                };
                const host = projectSystem.createServerHost([file1, file2, file3, projectSystem.libFile]);
                const projectService = createProjectService(host, { useSingleInferredProject: true });
                projectService.openClientFile(file1.path);
                projectService.openClientFile(file2.path);
                projectService.openClientFile(file3.path);
                checkNumberOfConfiguredProjects(projectService, 0);
                checkNumberOfInferredProjects(projectService, 1);
                checkProjectActualFiles(projectService.inferredProjects[0], [file1.path, file2.path, file3.path, projectSystem.libFile.path]);
                host.reloadFS([file1, configFile, file2, file3, projectSystem.libFile]);
                host.checkTimeoutQueueLengthAndRun(1);
                checkNumberOfConfiguredProjects(projectService, 1);
                checkNumberOfInferredProjects(projectService, 1);
                checkProjectActualFiles(projectService.inferredProjects[0], [file2.path, file3.path, projectSystem.libFile.path]);
            });
            it("should reuse same project if file is opened from the configured project that has no open files", () => {
                const file1 = {
                    path: "/a/b/main.ts",
                    content: "let x =1;"
                };
                const file2 = {
                    path: "/a/b/main2.ts",
                    content: "let y =1;"
                };
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: `{
                    "compilerOptions": {
                        "target": "es6"
                    },
                    "files": [ "main.ts", "main2.ts" ]
                }`
                };
                const host = projectSystem.createServerHost([file1, file2, configFile, projectSystem.libFile]);
                const projectService = createProjectService(host, { useSingleInferredProject: true });
                projectService.openClientFile(file1.path);
                checkNumberOfConfiguredProjects(projectService, 1);
                const project = projectService.configuredProjects.get(configFile.path);
                assert.isTrue(project.hasOpenRef()); // file1
                projectService.closeClientFile(file1.path);
                checkNumberOfConfiguredProjects(projectService, 1);
                assert.strictEqual(projectService.configuredProjects.get(configFile.path), project);
                assert.isFalse(project.hasOpenRef()); // No open files
                assert.isFalse(project.isClosed());
                projectService.openClientFile(file2.path);
                checkNumberOfConfiguredProjects(projectService, 1);
                assert.strictEqual(projectService.configuredProjects.get(configFile.path), project);
                assert.isTrue(project.hasOpenRef()); // file2
                assert.isFalse(project.isClosed());
            });
            it("should not close configured project after closing last open file, but should be closed on next file open if its not the file from same project", () => {
                const file1 = {
                    path: "/a/b/main.ts",
                    content: "let x =1;"
                };
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: `{
                    "compilerOptions": {
                        "target": "es6"
                    },
                    "files": [ "main.ts" ]
                }`
                };
                const host = projectSystem.createServerHost([file1, configFile, projectSystem.libFile]);
                const projectService = createProjectService(host, { useSingleInferredProject: true });
                projectService.openClientFile(file1.path);
                checkNumberOfConfiguredProjects(projectService, 1);
                const project = projectService.configuredProjects.get(configFile.path);
                assert.isTrue(project.hasOpenRef()); // file1
                projectService.closeClientFile(file1.path);
                checkNumberOfConfiguredProjects(projectService, 1);
                assert.strictEqual(projectService.configuredProjects.get(configFile.path), project);
                assert.isFalse(project.hasOpenRef()); // No files
                assert.isFalse(project.isClosed());
                projectService.openClientFile(projectSystem.libFile.path);
                checkNumberOfConfiguredProjects(projectService, 0);
                assert.isFalse(project.hasOpenRef()); // No files + project closed
                assert.isTrue(project.isClosed());
            });
            it("should not close external project with no open files", () => {
                const file1 = {
                    path: "/a/b/f1.ts",
                    content: "let x =1;"
                };
                const file2 = {
                    path: "/a/b/f2.ts",
                    content: "let y =1;"
                };
                const externalProjectName = "externalproject";
                const host = projectSystem.createServerHost([file1, file2]);
                const projectService = createProjectService(host);
                projectService.openExternalProject({
                    rootFiles: toExternalFiles([file1.path, file2.path]),
                    options: {},
                    projectFileName: externalProjectName
                });
                checkNumberOfExternalProjects(projectService, 1);
                checkNumberOfInferredProjects(projectService, 0);
                // open client file - should not lead to creation of inferred project
                projectService.openClientFile(file1.path, file1.content);
                checkNumberOfExternalProjects(projectService, 1);
                checkNumberOfInferredProjects(projectService, 0);
                // close client file - external project should still exists
                projectService.closeClientFile(file1.path);
                checkNumberOfExternalProjects(projectService, 1);
                checkNumberOfInferredProjects(projectService, 0);
                projectService.closeExternalProject(externalProjectName);
                checkNumberOfExternalProjects(projectService, 0);
                checkNumberOfInferredProjects(projectService, 0);
            });
            it("external project for dynamic file", () => {
                const externalProjectName = "^ScriptDocument1 file1.ts";
                const externalFiles = toExternalFiles(["^ScriptDocument1 file1.ts"]);
                const host = projectSystem.createServerHost([]);
                const projectService = createProjectService(host);
                projectService.openExternalProject({
                    rootFiles: externalFiles,
                    options: {},
                    projectFileName: externalProjectName
                });
                checkNumberOfExternalProjects(projectService, 1);
                checkNumberOfInferredProjects(projectService, 0);
                externalFiles[0].content = "let x =1;";
                projectService.applyChangesInOpenFiles(externalFiles, [], []);
            });
            it("external project that included config files", () => {
                const file1 = {
                    path: "/a/b/f1.ts",
                    content: "let x =1;"
                };
                const config1 = {
                    path: "/a/b/tsconfig.json",
                    content: JSON.stringify({
                        compilerOptions: {},
                        files: ["f1.ts"]
                    })
                };
                const file2 = {
                    path: "/a/c/f2.ts",
                    content: "let y =1;"
                };
                const config2 = {
                    path: "/a/c/tsconfig.json",
                    content: JSON.stringify({
                        compilerOptions: {},
                        files: ["f2.ts"]
                    })
                };
                const file3 = {
                    path: "/a/d/f3.ts",
                    content: "let z =1;"
                };
                const externalProjectName = "externalproject";
                const host = projectSystem.createServerHost([file1, file2, file3, config1, config2]);
                const projectService = createProjectService(host);
                projectService.openExternalProject({
                    rootFiles: toExternalFiles([config1.path, config2.path, file3.path]),
                    options: {},
                    projectFileName: externalProjectName
                });
                checkNumberOfProjects(projectService, { configuredProjects: 2 });
                const proj1 = projectService.configuredProjects.get(config1.path);
                const proj2 = projectService.configuredProjects.get(config2.path);
                assert.isDefined(proj1);
                assert.isDefined(proj2);
                // open client file - should not lead to creation of inferred project
                projectService.openClientFile(file1.path, file1.content);
                checkNumberOfProjects(projectService, { configuredProjects: 2 });
                assert.strictEqual(projectService.configuredProjects.get(config1.path), proj1);
                assert.strictEqual(projectService.configuredProjects.get(config2.path), proj2);
                projectService.openClientFile(file3.path, file3.content);
                checkNumberOfProjects(projectService, { configuredProjects: 2, inferredProjects: 1 });
                assert.strictEqual(projectService.configuredProjects.get(config1.path), proj1);
                assert.strictEqual(projectService.configuredProjects.get(config2.path), proj2);
                projectService.closeExternalProject(externalProjectName);
                // open file 'file1' from configured project keeps project alive
                checkNumberOfProjects(projectService, { configuredProjects: 1, inferredProjects: 1 });
                assert.strictEqual(projectService.configuredProjects.get(config1.path), proj1);
                assert.isUndefined(projectService.configuredProjects.get(config2.path));
                projectService.closeClientFile(file3.path);
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                assert.strictEqual(projectService.configuredProjects.get(config1.path), proj1);
                assert.isUndefined(projectService.configuredProjects.get(config2.path));
                projectService.closeClientFile(file1.path);
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                assert.strictEqual(projectService.configuredProjects.get(config1.path), proj1);
                assert.isUndefined(projectService.configuredProjects.get(config2.path));
                projectService.openClientFile(file2.path, file2.content);
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                assert.isUndefined(projectService.configuredProjects.get(config1.path));
                assert.isDefined(projectService.configuredProjects.get(config2.path));
            });
            describe("ignoreConfigFiles", () => {
                it("external project including config file", () => {
                    const file1 = {
                        path: "/a/b/f1.ts",
                        content: "let x =1;"
                    };
                    const config1 = {
                        path: "/a/b/tsconfig.json",
                        content: JSON.stringify({
                            compilerOptions: {},
                            files: ["f1.ts"]
                        })
                    };
                    const externalProjectName = "externalproject";
                    const host = projectSystem.createServerHost([file1, config1]);
                    const projectService = createProjectService(host, { useSingleInferredProject: true }, { syntaxOnly: true });
                    projectService.openExternalProject({
                        rootFiles: toExternalFiles([file1.path, config1.path]),
                        options: {},
                        projectFileName: externalProjectName
                    });
                    checkNumberOfProjects(projectService, { externalProjects: 1 });
                    const proj = projectService.externalProjects[0];
                    assert.isDefined(proj);
                    assert.isTrue(proj.fileExists(file1.path));
                });
                it("loose file included in config file (openClientFile)", () => {
                    const file1 = {
                        path: "/a/b/f1.ts",
                        content: "let x =1;"
                    };
                    const config1 = {
                        path: "/a/b/tsconfig.json",
                        content: JSON.stringify({
                            compilerOptions: {},
                            files: ["f1.ts"]
                        })
                    };
                    const host = projectSystem.createServerHost([file1, config1]);
                    const projectService = createProjectService(host, { useSingleInferredProject: true }, { syntaxOnly: true });
                    projectService.openClientFile(file1.path, file1.content);
                    checkNumberOfProjects(projectService, { inferredProjects: 1 });
                    const proj = projectService.inferredProjects[0];
                    assert.isDefined(proj);
                    assert.isTrue(proj.fileExists(file1.path));
                });
                it("loose file included in config file (applyCodeChanges)", () => {
                    const file1 = {
                        path: "/a/b/f1.ts",
                        content: "let x =1;"
                    };
                    const config1 = {
                        path: "/a/b/tsconfig.json",
                        content: JSON.stringify({
                            compilerOptions: {},
                            files: ["f1.ts"]
                        })
                    };
                    const host = projectSystem.createServerHost([file1, config1]);
                    const projectService = createProjectService(host, { useSingleInferredProject: true }, { syntaxOnly: true });
                    projectService.applyChangesInOpenFiles([{ fileName: file1.path, content: file1.content }], [], []);
                    checkNumberOfProjects(projectService, { inferredProjects: 1 });
                    const proj = projectService.inferredProjects[0];
                    assert.isDefined(proj);
                    assert.isTrue(proj.fileExists(file1.path));
                });
            });
            it("disable inferred project", () => {
                const file1 = {
                    path: "/a/b/f1.ts",
                    content: "let x =1;"
                };
                const host = projectSystem.createServerHost([file1]);
                const projectService = createProjectService(host, { useSingleInferredProject: true }, { syntaxOnly: true });
                projectService.openClientFile(file1.path, file1.content);
                checkNumberOfProjects(projectService, { inferredProjects: 1 });
                const proj = projectService.inferredProjects[0];
                assert.isDefined(proj);
                assert.isFalse(proj.languageServiceEnabled);
            });
            it("reload regular file after closing", () => {
                const f1 = {
                    path: "/a/b/app.ts",
                    content: "x."
                };
                const f2 = {
                    path: "/a/b/lib.ts",
                    content: "let x: number;"
                };
                const host = projectSystem.createServerHost([f1, f2, projectSystem.libFile]);
                const service = createProjectService(host);
                service.openExternalProject({ projectFileName: "/a/b/project", rootFiles: toExternalFiles([f1.path, f2.path]), options: {} });
                service.openClientFile(f1.path);
                service.openClientFile(f2.path, "let x: string");
                service.checkNumberOfProjects({ externalProjects: 1 });
                checkProjectActualFiles(service.externalProjects[0], [f1.path, f2.path, projectSystem.libFile.path]);
                const completions1 = service.externalProjects[0].getLanguageService().getCompletionsAtPosition(f1.path, 2, ts.defaultPreferences);
                // should contain completions for string
                assert.isTrue(completions1.entries.some(e => e.name === "charAt"), "should contain 'charAt'");
                assert.isFalse(completions1.entries.some(e => e.name === "toExponential"), "should not contain 'toExponential'");
                service.closeClientFile(f2.path);
                const completions2 = service.externalProjects[0].getLanguageService().getCompletionsAtPosition(f1.path, 2, ts.defaultPreferences);
                // should contain completions for string
                assert.isFalse(completions2.entries.some(e => e.name === "charAt"), "should not contain 'charAt'");
                assert.isTrue(completions2.entries.some(e => e.name === "toExponential"), "should contain 'toExponential'");
            });
            it("clear mixed content file after closing", () => {
                const f1 = {
                    path: "/a/b/app.ts",
                    content: " "
                };
                const f2 = {
                    path: "/a/b/lib.html",
                    content: "<html/>"
                };
                const host = projectSystem.createServerHost([f1, f2, projectSystem.libFile]);
                const service = createProjectService(host);
                service.openExternalProject({ projectFileName: "/a/b/project", rootFiles: [{ fileName: f1.path }, { fileName: f2.path, hasMixedContent: true }], options: {} });
                service.openClientFile(f1.path);
                service.openClientFile(f2.path, "let somelongname: string");
                service.checkNumberOfProjects({ externalProjects: 1 });
                checkProjectActualFiles(service.externalProjects[0], [f1.path, f2.path, projectSystem.libFile.path]);
                const completions1 = service.externalProjects[0].getLanguageService().getCompletionsAtPosition(f1.path, 0, ts.defaultPreferences);
                assert.isTrue(completions1.entries.some(e => e.name === "somelongname"), "should contain 'somelongname'");
                service.closeClientFile(f2.path);
                const completions2 = service.externalProjects[0].getLanguageService().getCompletionsAtPosition(f1.path, 0, ts.defaultPreferences);
                assert.isFalse(completions2.entries.some(e => e.name === "somelongname"), "should not contain 'somelongname'");
                const sf2 = service.externalProjects[0].getLanguageService().getProgram().getSourceFile(f2.path);
                assert.equal(sf2.text, "");
            });
            it("external project with included config file opened after configured project", () => {
                const file1 = {
                    path: "/a/b/f1.ts",
                    content: "let x = 1"
                };
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: JSON.stringify({ compilerOptions: {} })
                };
                const externalProjectName = "externalproject";
                const host = projectSystem.createServerHost([file1, configFile]);
                const projectService = createProjectService(host);
                projectService.openClientFile(file1.path);
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                projectService.openExternalProject({
                    rootFiles: toExternalFiles([configFile.path]),
                    options: {},
                    projectFileName: externalProjectName
                });
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                projectService.closeClientFile(file1.path);
                // configured project is alive since it is opened as part of external project
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                projectService.closeExternalProject(externalProjectName);
                checkNumberOfProjects(projectService, { configuredProjects: 0 });
            });
            it("external project with included config file opened after configured project and then closed", () => {
                const file1 = {
                    path: "/a/b/f1.ts",
                    content: "let x = 1"
                };
                const file2 = {
                    path: "/a/f2.ts",
                    content: "let x = 1"
                };
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: JSON.stringify({ compilerOptions: {} })
                };
                const externalProjectName = "externalproject";
                const host = projectSystem.createServerHost([file1, file2, projectSystem.libFile, configFile]);
                const projectService = createProjectService(host);
                projectService.openClientFile(file1.path);
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                const project = projectService.configuredProjects.get(configFile.path);
                projectService.openExternalProject({
                    rootFiles: toExternalFiles([configFile.path]),
                    options: {},
                    projectFileName: externalProjectName
                });
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                assert.strictEqual(projectService.configuredProjects.get(configFile.path), project);
                projectService.closeExternalProject(externalProjectName);
                // configured project is alive since file is still open
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                assert.strictEqual(projectService.configuredProjects.get(configFile.path), project);
                projectService.closeClientFile(file1.path);
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                assert.strictEqual(projectService.configuredProjects.get(configFile.path), project);
                projectService.openClientFile(file2.path);
                checkNumberOfProjects(projectService, { inferredProjects: 1 });
                assert.isUndefined(projectService.configuredProjects.get(configFile.path));
            });
            it("changes in closed files are reflected in project structure", () => {
                const file1 = {
                    path: "/a/b/f1.ts",
                    content: `export * from "./f2"`
                };
                const file2 = {
                    path: "/a/b/f2.ts",
                    content: `export let x = 1`
                };
                const file3 = {
                    path: "/a/c/f3.ts",
                    content: `export let y = 1;`
                };
                const host = projectSystem.createServerHost([file1, file2, file3]);
                const projectService = createProjectService(host);
                projectService.openClientFile(file1.path);
                checkNumberOfInferredProjects(projectService, 1);
                checkProjectActualFiles(projectService.inferredProjects[0], [file1.path, file2.path]);
                projectService.openClientFile(file3.path);
                checkNumberOfInferredProjects(projectService, 2);
                checkProjectActualFiles(projectService.inferredProjects[1], [file3.path]);
                const modifiedFile2 = {
                    path: file2.path,
                    content: `export * from "../c/f3"` // now inferred project should inclule file3
                };
                host.reloadFS([file1, modifiedFile2, file3]);
                host.checkTimeoutQueueLengthAndRun(2);
                checkNumberOfInferredProjects(projectService, 1);
                checkProjectActualFiles(projectService.inferredProjects[0], [file1.path, modifiedFile2.path, file3.path]);
            });
            it("deleted files affect project structure", () => {
                const file1 = {
                    path: "/a/b/f1.ts",
                    content: `export * from "./f2"`
                };
                const file2 = {
                    path: "/a/b/f2.ts",
                    content: `export * from "../c/f3"`
                };
                const file3 = {
                    path: "/a/c/f3.ts",
                    content: `export let y = 1;`
                };
                const host = projectSystem.createServerHost([file1, file2, file3]);
                const projectService = createProjectService(host);
                projectService.openClientFile(file1.path);
                checkNumberOfProjects(projectService, { inferredProjects: 1 });
                checkProjectActualFiles(projectService.inferredProjects[0], [file1.path, file2.path, file3.path]);
                projectService.openClientFile(file3.path);
                checkNumberOfProjects(projectService, { inferredProjects: 1 });
                host.reloadFS([file1, file3]);
                host.checkTimeoutQueueLengthAndRun(2);
                checkNumberOfProjects(projectService, { inferredProjects: 2 });
                checkProjectActualFiles(projectService.inferredProjects[0], [file1.path]);
                checkProjectActualFiles(projectService.inferredProjects[1], [file3.path]);
            });
            it("ignores files excluded by a custom safe type list", () => {
                const file1 = {
                    path: "/a/b/f1.js",
                    content: "export let x = 5"
                };
                const office = {
                    path: "/lib/duckquack-3.min.js",
                    content: "whoa do @@ not parse me ok thanks!!!"
                };
                const host = projectSystem.createServerHost([file1, office, projectSystem.customTypesMap]);
                const projectService = createProjectService(host);
                try {
                    projectService.openExternalProject({ projectFileName: "project", options: {}, rootFiles: toExternalFiles([file1.path, office.path]) });
                    const proj = projectService.externalProjects[0];
                    assert.deepEqual(proj.getFileNames(/*excludeFilesFromExternalLibraries*/ true), [file1.path]);
                    assert.deepEqual(proj.getTypeAcquisition().include, ["duck-types"]);
                }
                finally {
                    projectService.resetSafeList();
                }
            });
            it("ignores files excluded by the default type list", () => {
                const file1 = {
                    path: "/a/b/f1.js",
                    content: "export let x = 5"
                };
                const minFile = {
                    path: "/c/moment.min.js",
                    content: "unspecified"
                };
                const kendoFile1 = {
                    path: "/q/lib/kendo/kendo.all.min.js",
                    content: "unspecified"
                };
                const kendoFile2 = {
                    path: "/q/lib/kendo/kendo.ui.min.js",
                    content: "unspecified"
                };
                const kendoFile3 = {
                    path: "/q/lib/kendo-ui/kendo.all.js",
                    content: "unspecified"
                };
                const officeFile1 = {
                    path: "/scripts/Office/1/excel-15.debug.js",
                    content: "unspecified"
                };
                const officeFile2 = {
                    path: "/scripts/Office/1/powerpoint.js",
                    content: "unspecified"
                };
                const files = [file1, minFile, kendoFile1, kendoFile2, kendoFile3, officeFile1, officeFile2];
                const host = projectSystem.createServerHost(files);
                const projectService = createProjectService(host);
                try {
                    projectService.openExternalProject({ projectFileName: "project", options: {}, rootFiles: toExternalFiles(files.map(f => f.path)) });
                    const proj = projectService.externalProjects[0];
                    assert.deepEqual(proj.getFileNames(/*excludeFilesFromExternalLibraries*/ true), [file1.path]);
                    assert.deepEqual(proj.getTypeAcquisition().include, ["kendo-ui", "office"]);
                }
                finally {
                    projectService.resetSafeList();
                }
            });
            it("removes version numbers correctly", () => {
                const testData = [
                    ["jquery-max", "jquery-max"],
                    ["jquery.min", "jquery"],
                    ["jquery-min.4.2.3", "jquery"],
                    ["jquery.min.4.2.1", "jquery"],
                    ["minimum", "minimum"],
                    ["min", "min"],
                    ["min.3.2", "min"],
                    ["jquery", "jquery"]
                ];
                for (const t of testData) {
                    assert.equal(ts.removeMinAndVersionNumbers(t[0]), t[1], t[0]);
                }
            });
            it("ignores files excluded by a legacy safe type list", () => {
                const file1 = {
                    path: "/a/b/bliss.js",
                    content: "let x = 5"
                };
                const file2 = {
                    path: "/a/b/foo.js",
                    content: ""
                };
                const file3 = {
                    path: "/a/b/Bacon.js",
                    content: "let y = 5"
                };
                const host = projectSystem.createServerHost([file1, file2, file3, projectSystem.customTypesMap]);
                const projectService = createProjectService(host);
                try {
                    projectService.openExternalProject({ projectFileName: "project", options: {}, rootFiles: toExternalFiles([file1.path, file2.path]), typeAcquisition: { enable: true } });
                    const proj = projectService.externalProjects[0];
                    assert.deepEqual(proj.getFileNames(), [file2.path]);
                }
                finally {
                    projectService.resetSafeList();
                }
            });
            it("open file become a part of configured project if it is referenced from root file", () => {
                const file1 = {
                    path: "/a/b/f1.ts",
                    content: "export let x = 5"
                };
                const file2 = {
                    path: "/a/c/f2.ts",
                    content: `import {x} from "../b/f1"`
                };
                const file3 = {
                    path: "/a/c/f3.ts",
                    content: "export let y = 1"
                };
                const configFile = {
                    path: "/a/c/tsconfig.json",
                    content: JSON.stringify({ compilerOptions: {}, files: ["f2.ts", "f3.ts"] })
                };
                const host = projectSystem.createServerHost([file1, file2, file3]);
                const projectService = createProjectService(host);
                projectService.openClientFile(file1.path);
                checkNumberOfProjects(projectService, { inferredProjects: 1 });
                checkProjectActualFiles(projectService.inferredProjects[0], [file1.path]);
                projectService.openClientFile(file3.path);
                checkNumberOfProjects(projectService, { inferredProjects: 2 });
                checkProjectActualFiles(projectService.inferredProjects[0], [file1.path]);
                checkProjectActualFiles(projectService.inferredProjects[1], [file3.path]);
                host.reloadFS([file1, file2, file3, configFile]);
                host.checkTimeoutQueueLengthAndRun(1);
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                checkProjectActualFiles(configuredProjectAt(projectService, 0), [file1.path, file2.path, file3.path, configFile.path]);
            });
            it("correctly migrate files between projects", () => {
                const file1 = {
                    path: "/a/b/f1.ts",
                    content: `
                export * from "../c/f2";
                export * from "../d/f3";`
                };
                const file2 = {
                    path: "/a/c/f2.ts",
                    content: "export let x = 1;"
                };
                const file3 = {
                    path: "/a/d/f3.ts",
                    content: "export let y = 1;"
                };
                const host = projectSystem.createServerHost([file1, file2, file3]);
                const projectService = createProjectService(host);
                projectService.openClientFile(file2.path);
                checkNumberOfProjects(projectService, { inferredProjects: 1 });
                checkProjectActualFiles(projectService.inferredProjects[0], [file2.path]);
                projectService.openClientFile(file3.path);
                checkNumberOfProjects(projectService, { inferredProjects: 2 });
                checkProjectActualFiles(projectService.inferredProjects[0], [file2.path]);
                checkProjectActualFiles(projectService.inferredProjects[1], [file3.path]);
                projectService.openClientFile(file1.path);
                checkNumberOfProjects(projectService, { inferredProjects: 1 });
                checkProjectRootFiles(projectService.inferredProjects[0], [file1.path]);
                checkProjectActualFiles(projectService.inferredProjects[0], [file1.path, file2.path, file3.path]);
                projectService.closeClientFile(file1.path);
                checkNumberOfProjects(projectService, { inferredProjects: 2 });
            });
            it("can correctly update configured project when set of root files has changed (new file on disk)", () => {
                const file1 = {
                    path: "/a/b/f1.ts",
                    content: "let x = 1"
                };
                const file2 = {
                    path: "/a/b/f2.ts",
                    content: "let y = 1"
                };
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: JSON.stringify({ compilerOptions: {} })
                };
                const host = projectSystem.createServerHost([file1, configFile]);
                const projectService = createProjectService(host);
                projectService.openClientFile(file1.path);
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                checkProjectActualFiles(configuredProjectAt(projectService, 0), [file1.path, configFile.path]);
                host.reloadFS([file1, file2, configFile]);
                host.checkTimeoutQueueLengthAndRun(2);
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                checkProjectRootFiles(configuredProjectAt(projectService, 0), [file1.path, file2.path]);
            });
            it("can correctly update configured project when set of root files has changed (new file in list of files)", () => {
                const file1 = {
                    path: "/a/b/f1.ts",
                    content: "let x = 1"
                };
                const file2 = {
                    path: "/a/b/f2.ts",
                    content: "let y = 1"
                };
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: JSON.stringify({ compilerOptions: {}, files: ["f1.ts"] })
                };
                const host = projectSystem.createServerHost([file1, file2, configFile]);
                const projectService = createProjectService(host);
                projectService.openClientFile(file1.path);
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                checkProjectActualFiles(configuredProjectAt(projectService, 0), [file1.path, configFile.path]);
                const modifiedConfigFile = {
                    path: configFile.path,
                    content: JSON.stringify({ compilerOptions: {}, files: ["f1.ts", "f2.ts"] })
                };
                host.reloadFS([file1, file2, modifiedConfigFile]);
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                host.checkTimeoutQueueLengthAndRun(2);
                checkProjectRootFiles(configuredProjectAt(projectService, 0), [file1.path, file2.path]);
            });
            it("can update configured project when set of root files was not changed", () => {
                const file1 = {
                    path: "/a/b/f1.ts",
                    content: "let x = 1"
                };
                const file2 = {
                    path: "/a/b/f2.ts",
                    content: "let y = 1"
                };
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: JSON.stringify({ compilerOptions: {}, files: ["f1.ts", "f2.ts"] })
                };
                const host = projectSystem.createServerHost([file1, file2, configFile]);
                const projectService = createProjectService(host);
                projectService.openClientFile(file1.path);
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                checkProjectActualFiles(configuredProjectAt(projectService, 0), [file1.path, file2.path, configFile.path]);
                const modifiedConfigFile = {
                    path: configFile.path,
                    content: JSON.stringify({ compilerOptions: { outFile: "out.js" }, files: ["f1.ts", "f2.ts"] })
                };
                host.reloadFS([file1, file2, modifiedConfigFile]);
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                checkProjectRootFiles(configuredProjectAt(projectService, 0), [file1.path, file2.path]);
            });
            it("can correctly update external project when set of root files has changed", () => {
                const file1 = {
                    path: "/a/b/f1.ts",
                    content: "let x = 1"
                };
                const file2 = {
                    path: "/a/b/f2.ts",
                    content: "let y = 1"
                };
                const host = projectSystem.createServerHost([file1, file2]);
                const projectService = createProjectService(host);
                projectService.openExternalProject({ projectFileName: "project", options: {}, rootFiles: toExternalFiles([file1.path]) });
                checkNumberOfProjects(projectService, { externalProjects: 1 });
                checkProjectActualFiles(projectService.externalProjects[0], [file1.path]);
                projectService.openExternalProject({ projectFileName: "project", options: {}, rootFiles: toExternalFiles([file1.path, file2.path]) });
                checkNumberOfProjects(projectService, { externalProjects: 1 });
                checkProjectRootFiles(projectService.externalProjects[0], [file1.path, file2.path]);
            });
            it("can update external project when set of root files was not changed", () => {
                const file1 = {
                    path: "/a/b/f1.ts",
                    content: `export * from "m"`
                };
                const file2 = {
                    path: "/a/b/f2.ts",
                    content: "export let y = 1"
                };
                const file3 = {
                    path: "/a/m.ts",
                    content: "export let y = 1"
                };
                const host = projectSystem.createServerHost([file1, file2, file3]);
                const projectService = createProjectService(host);
                projectService.openExternalProject({ projectFileName: "project", options: { moduleResolution: ts.ModuleResolutionKind.NodeJs }, rootFiles: toExternalFiles([file1.path, file2.path]) });
                checkNumberOfProjects(projectService, { externalProjects: 1 });
                checkProjectRootFiles(projectService.externalProjects[0], [file1.path, file2.path]);
                checkProjectActualFiles(projectService.externalProjects[0], [file1.path, file2.path]);
                projectService.openExternalProject({ projectFileName: "project", options: { moduleResolution: ts.ModuleResolutionKind.Classic }, rootFiles: toExternalFiles([file1.path, file2.path]) });
                checkNumberOfProjects(projectService, { externalProjects: 1 });
                checkProjectRootFiles(projectService.externalProjects[0], [file1.path, file2.path]);
                checkProjectActualFiles(projectService.externalProjects[0], [file1.path, file2.path, file3.path]);
            });
            it("regression test for crash in acquireOrUpdateDocument", () => {
                const tsFile = {
                    fileName: "/a/b/file1.ts",
                    path: "/a/b/file1.ts",
                    content: ""
                };
                const jsFile = {
                    path: "/a/b/file1.js",
                    content: "var x = 10;",
                    fileName: "/a/b/file1.js",
                    scriptKind: "JS"
                };
                const host = projectSystem.createServerHost([]);
                const projectService = createProjectService(host);
                projectService.applyChangesInOpenFiles([tsFile], [], []);
                const projs = projectService.synchronizeProjectList([]);
                projectService.findProject(projs[0].info.projectName).getLanguageService().getNavigationBarItems(tsFile.fileName);
                projectService.synchronizeProjectList([projs[0].info]);
                projectService.applyChangesInOpenFiles([jsFile], [], []);
            });
            it("config file is deleted", () => {
                const file1 = {
                    path: "/a/b/f1.ts",
                    content: "let x = 1;"
                };
                const file2 = {
                    path: "/a/b/f2.ts",
                    content: "let y = 2;"
                };
                const config = {
                    path: "/a/b/tsconfig.json",
                    content: JSON.stringify({ compilerOptions: {} })
                };
                const host = projectSystem.createServerHost([file1, file2, config]);
                const projectService = createProjectService(host);
                projectService.openClientFile(file1.path);
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                checkProjectActualFiles(configuredProjectAt(projectService, 0), [file1.path, file2.path, config.path]);
                projectService.openClientFile(file2.path);
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                checkProjectActualFiles(configuredProjectAt(projectService, 0), [file1.path, file2.path, config.path]);
                host.reloadFS([file1, file2]);
                host.checkTimeoutQueueLengthAndRun(1);
                checkNumberOfProjects(projectService, { inferredProjects: 2 });
                checkProjectActualFiles(projectService.inferredProjects[0], [file1.path]);
                checkProjectActualFiles(projectService.inferredProjects[1], [file2.path]);
            });
            it("loading files with correct priority", () => {
                const f1 = {
                    path: "/a/main.ts",
                    content: "let x = 1"
                };
                const f2 = {
                    path: "/a/main.js",
                    content: "var y = 1"
                };
                const config = {
                    path: "/a/tsconfig.json",
                    content: JSON.stringify({
                        compilerOptions: { allowJs: true }
                    })
                };
                const host = projectSystem.createServerHost([f1, f2, config]);
                const projectService = createProjectService(host);
                projectService.setHostConfiguration({
                    extraFileExtensions: [
                        { extension: ".js", isMixedContent: false },
                        { extension: ".html", isMixedContent: true }
                    ]
                });
                projectService.openClientFile(f1.path);
                projectService.checkNumberOfProjects({ configuredProjects: 1 });
                checkProjectActualFiles(configuredProjectAt(projectService, 0), [f1.path, config.path]);
                // Should close configured project with next file open
                projectService.closeClientFile(f1.path);
                projectService.openClientFile(f2.path);
                projectService.checkNumberOfProjects({ inferredProjects: 1 });
                assert.isUndefined(projectService.configuredProjects.get(config.path));
                checkProjectActualFiles(projectService.inferredProjects[0], [f2.path]);
            });
            it("tsconfig script block support", () => {
                const file1 = {
                    path: "/a/b/f1.ts",
                    content: ` `
                };
                const file2 = {
                    path: "/a/b/f2.html",
                    content: `var hello = "hello";`
                };
                const config = {
                    path: "/a/b/tsconfig.json",
                    content: JSON.stringify({ compilerOptions: { allowJs: true } })
                };
                const host = projectSystem.createServerHost([file1, file2, config]);
                const session = createSession(host);
                openFilesForSession([file1], session);
                const projectService = session.getProjectService();
                // HTML file will not be included in any projects yet
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                const configuredProj = configuredProjectAt(projectService, 0);
                checkProjectActualFiles(configuredProj, [file1.path, config.path]);
                // Specify .html extension as mixed content
                const extraFileExtensions = [{ extension: ".html", scriptKind: ts.ScriptKind.JS, isMixedContent: true }];
                const configureHostRequest = makeSessionRequest(CommandNames.Configure, { extraFileExtensions });
                session.executeCommand(configureHostRequest);
                // The configured project should now be updated to include html file
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                assert.strictEqual(configuredProjectAt(projectService, 0), configuredProj, "Same configured project should be updated");
                checkProjectActualFiles(configuredProjectAt(projectService, 0), [file1.path, file2.path, config.path]);
                // Open HTML file
                projectService.applyChangesInOpenFiles(
                /*openFiles*/ [{ fileName: file2.path, hasMixedContent: true, scriptKind: ts.ScriptKind.JS, content: `var hello = "hello";` }], 
                /*changedFiles*/ undefined, 
                /*closedFiles*/ undefined);
                // Now HTML file is included in the project
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                checkProjectActualFiles(configuredProjectAt(projectService, 0), [file1.path, file2.path, config.path]);
                // Check identifiers defined in HTML content are available in .ts file
                const project = configuredProjectAt(projectService, 0);
                let completions = project.getLanguageService().getCompletionsAtPosition(file1.path, 1, ts.defaultPreferences);
                assert(completions && completions.entries[0].name === "hello", `expected entry hello to be in completion list`);
                // Close HTML file
                projectService.applyChangesInOpenFiles(
                /*openFiles*/ undefined, 
                /*changedFiles*/ undefined, 
                /*closedFiles*/ [file2.path]);
                // HTML file is still included in project
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                checkProjectActualFiles(configuredProjectAt(projectService, 0), [file1.path, file2.path, config.path]);
                // Check identifiers defined in HTML content are not available in .ts file
                completions = project.getLanguageService().getCompletionsAtPosition(file1.path, 5, ts.defaultPreferences);
                assert(completions && completions.entries[0].name !== "hello", `unexpected hello entry in completion list`);
            });
            it("no tsconfig script block diagnostic errors", () => {
                //  #1. Ensure no diagnostic errors when allowJs is true
                const file1 = {
                    path: "/a/b/f1.ts",
                    content: ` `
                };
                const file2 = {
                    path: "/a/b/f2.html",
                    content: `var hello = "hello";`
                };
                const config1 = {
                    path: "/a/b/tsconfig.json",
                    content: JSON.stringify({ compilerOptions: { allowJs: true } })
                };
                let host = projectSystem.createServerHost([file1, file2, config1, projectSystem.libFile], { executingFilePath: ts.combinePaths(ts.getDirectoryPath(projectSystem.libFile.path), "tsc.js") });
                let session = createSession(host);
                // Specify .html extension as mixed content in a configure host request
                const extraFileExtensions = [{ extension: ".html", scriptKind: ts.ScriptKind.JS, isMixedContent: true }];
                const configureHostRequest = makeSessionRequest(CommandNames.Configure, { extraFileExtensions });
                session.executeCommand(configureHostRequest);
                openFilesForSession([file1], session);
                let projectService = session.getProjectService();
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                let diagnostics = configuredProjectAt(projectService, 0).getLanguageService().getCompilerOptionsDiagnostics();
                assert.deepEqual(diagnostics, []);
                //  #2. Ensure no errors when allowJs is false
                const config2 = {
                    path: "/a/b/tsconfig.json",
                    content: JSON.stringify({ compilerOptions: { allowJs: false } })
                };
                host = projectSystem.createServerHost([file1, file2, config2, projectSystem.libFile], { executingFilePath: ts.combinePaths(ts.getDirectoryPath(projectSystem.libFile.path), "tsc.js") });
                session = createSession(host);
                session.executeCommand(configureHostRequest);
                openFilesForSession([file1], session);
                projectService = session.getProjectService();
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                diagnostics = configuredProjectAt(projectService, 0).getLanguageService().getCompilerOptionsDiagnostics();
                assert.deepEqual(diagnostics, []);
                //  #3. Ensure no errors when compiler options aren't specified
                const config3 = {
                    path: "/a/b/tsconfig.json",
                    content: JSON.stringify({})
                };
                host = projectSystem.createServerHost([file1, file2, config3, projectSystem.libFile], { executingFilePath: ts.combinePaths(ts.getDirectoryPath(projectSystem.libFile.path), "tsc.js") });
                session = createSession(host);
                session.executeCommand(configureHostRequest);
                openFilesForSession([file1], session);
                projectService = session.getProjectService();
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                diagnostics = configuredProjectAt(projectService, 0).getLanguageService().getCompilerOptionsDiagnostics();
                assert.deepEqual(diagnostics, []);
                //  #4. Ensure no errors when files are explicitly specified in tsconfig
                const config4 = {
                    path: "/a/b/tsconfig.json",
                    content: JSON.stringify({ compilerOptions: { allowJs: true }, files: [file1.path, file2.path] })
                };
                host = projectSystem.createServerHost([file1, file2, config4, projectSystem.libFile], { executingFilePath: ts.combinePaths(ts.getDirectoryPath(projectSystem.libFile.path), "tsc.js") });
                session = createSession(host);
                session.executeCommand(configureHostRequest);
                openFilesForSession([file1], session);
                projectService = session.getProjectService();
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                diagnostics = configuredProjectAt(projectService, 0).getLanguageService().getCompilerOptionsDiagnostics();
                assert.deepEqual(diagnostics, []);
                //  #4. Ensure no errors when files are explicitly excluded in tsconfig
                const config5 = {
                    path: "/a/b/tsconfig.json",
                    content: JSON.stringify({ compilerOptions: { allowJs: true }, exclude: [file2.path] })
                };
                host = projectSystem.createServerHost([file1, file2, config5, projectSystem.libFile], { executingFilePath: ts.combinePaths(ts.getDirectoryPath(projectSystem.libFile.path), "tsc.js") });
                session = createSession(host);
                session.executeCommand(configureHostRequest);
                openFilesForSession([file1], session);
                projectService = session.getProjectService();
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                diagnostics = configuredProjectAt(projectService, 0).getLanguageService().getCompilerOptionsDiagnostics();
                assert.deepEqual(diagnostics, []);
            });
            it("project structure update is deferred if files are not added\removed", () => {
                const file1 = {
                    path: "/a/b/f1.ts",
                    content: `import {x} from "./f2"`
                };
                const file2 = {
                    path: "/a/b/f2.ts",
                    content: "export let x = 1"
                };
                const host = projectSystem.createServerHost([file1, file2]);
                const projectService = createProjectService(host);
                projectService.openClientFile(file1.path);
                projectService.openClientFile(file2.path);
                checkNumberOfProjects(projectService, { inferredProjects: 1 });
                projectService.applyChangesInOpenFiles(
                /*openFiles*/ undefined, 
                /*changedFiles*/ [{ fileName: file1.path, changes: [{ span: ts.createTextSpan(0, file1.path.length), newText: "let y = 1" }] }], 
                /*closedFiles*/ undefined);
                checkNumberOfProjects(projectService, { inferredProjects: 1 });
                projectService.ensureInferredProjectsUpToDate_TestOnly();
                checkNumberOfProjects(projectService, { inferredProjects: 2 });
            });
            it("files with mixed content are handled correctly", () => {
                const file1 = {
                    path: "/a/b/f1.html",
                    content: `<html><script language="javascript">var x = 1;</></html>`
                };
                const host = projectSystem.createServerHost([file1]);
                const projectService = createProjectService(host);
                const projectFileName = "projectFileName";
                projectService.openExternalProject({ projectFileName, options: {}, rootFiles: [{ fileName: file1.path, scriptKind: ts.ScriptKind.JS, hasMixedContent: true }] });
                checkNumberOfProjects(projectService, { externalProjects: 1 });
                projectSystem.checkWatchedFiles(host, [projectSystem.libFile.path]); // watching the "missing" lib file
                const project = projectService.externalProjects[0];
                const scriptInfo = project.getScriptInfo(file1.path);
                const snap = scriptInfo.getSnapshot();
                const actualText = ts.getSnapshotText(snap);
                assert.equal(actualText, "", `expected content to be empty string, got "${actualText}"`);
                projectService.openClientFile(file1.path, `var x = 1;`);
                project.updateGraph();
                const quickInfo = project.getLanguageService().getQuickInfoAtPosition(file1.path, 4);
                assert.equal(quickInfo.kind, ts.ScriptElementKind.variableElement);
                projectService.closeClientFile(file1.path);
                const scriptInfo2 = project.getScriptInfo(file1.path);
                const actualText2 = ts.getSnapshotText(scriptInfo2.getSnapshot());
                assert.equal(actualText2, "", `expected content to be empty string, got "${actualText2}"`);
            });
            it("project settings for inferred projects", () => {
                const file1 = {
                    path: "/a/b/app.ts",
                    content: `import {x} from "mod"`
                };
                const modFile = {
                    path: "/a/mod.ts",
                    content: "export let x: number"
                };
                const host = projectSystem.createServerHost([file1, modFile]);
                const projectService = createProjectService(host);
                projectService.openClientFile(file1.path);
                projectService.openClientFile(modFile.path);
                checkNumberOfProjects(projectService, { inferredProjects: 2 });
                projectService.setCompilerOptionsForInferredProjects({ moduleResolution: ts.ModuleResolutionKind.Classic });
                host.checkTimeoutQueueLengthAndRun(3);
                checkNumberOfProjects(projectService, { inferredProjects: 1 });
            });
            it("syntax tree cache handles changes in project settings", () => {
                const file1 = {
                    path: "/a/b/app.ts",
                    content: "{x: 1}"
                };
                const host = projectSystem.createServerHost([file1]);
                const projectService = createProjectService(host, { useSingleInferredProject: true });
                projectService.setCompilerOptionsForInferredProjects({ target: ts.ScriptTarget.ES5, allowJs: false });
                projectService.openClientFile(file1.path);
                projectService.inferredProjects[0].getLanguageService(/*ensureSynchronized*/ false).getOutliningSpans(file1.path);
                projectService.setCompilerOptionsForInferredProjects({ target: ts.ScriptTarget.ES5, allowJs: true });
                projectService.getScriptInfo(file1.path).editContent(0, 0, " ");
                projectService.inferredProjects[0].getLanguageService(/*ensureSynchronized*/ false).getOutliningSpans(file1.path);
                projectService.closeClientFile(file1.path);
            });
            it("File in multiple projects at opened and closed correctly", () => {
                const file1 = {
                    path: "/a/b/app.ts",
                    content: "let x = 1;"
                };
                const file2 = {
                    path: "/a/c/f.ts",
                    content: `/// <reference path="../b/app.ts"/>`
                };
                const tsconfig1 = {
                    path: "/a/c/tsconfig.json",
                    content: "{}"
                };
                const tsconfig2 = {
                    path: "/a/b/tsconfig.json",
                    content: "{}"
                };
                const host = projectSystem.createServerHost([file1, file2, tsconfig1, tsconfig2]);
                const projectService = createProjectService(host);
                projectService.openClientFile(file2.path);
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                const project1 = projectService.configuredProjects.get(tsconfig1.path);
                assert.isTrue(project1.hasOpenRef(), "Has open ref count in project1 - 1"); // file2
                assert.equal(project1.getScriptInfo(file2.path).containingProjects.length, 1, "containing projects count");
                assert.isFalse(project1.isClosed());
                projectService.openClientFile(file1.path);
                checkNumberOfProjects(projectService, { configuredProjects: 2 });
                assert.isTrue(project1.hasOpenRef(), "Has open ref count in project1 - 2"); // file2
                assert.strictEqual(projectService.configuredProjects.get(tsconfig1.path), project1);
                assert.isFalse(project1.isClosed());
                const project2 = projectService.configuredProjects.get(tsconfig2.path);
                assert.isTrue(project2.hasOpenRef(), "Has open ref count in project2 - 2"); // file1
                assert.isFalse(project2.isClosed());
                assert.equal(project1.getScriptInfo(file1.path).containingProjects.length, 2, `${file1.path} containing projects count`);
                assert.equal(project1.getScriptInfo(file2.path).containingProjects.length, 1, `${file2.path} containing projects count`);
                projectService.closeClientFile(file2.path);
                checkNumberOfProjects(projectService, { configuredProjects: 2 });
                assert.isFalse(project1.hasOpenRef(), "Has open ref count in project1 - 3"); // No files
                assert.isTrue(project2.hasOpenRef(), "Has open ref count in project2 - 3"); // file1
                assert.strictEqual(projectService.configuredProjects.get(tsconfig1.path), project1);
                assert.strictEqual(projectService.configuredProjects.get(tsconfig2.path), project2);
                assert.isFalse(project1.isClosed());
                assert.isFalse(project2.isClosed());
                projectService.closeClientFile(file1.path);
                checkNumberOfProjects(projectService, { configuredProjects: 2 });
                assert.isFalse(project1.hasOpenRef(), "Has open ref count in project1 - 4"); // No files
                assert.isFalse(project2.hasOpenRef(), "Has open ref count in project2 - 4"); // No files
                assert.strictEqual(projectService.configuredProjects.get(tsconfig1.path), project1);
                assert.strictEqual(projectService.configuredProjects.get(tsconfig2.path), project2);
                assert.isFalse(project1.isClosed());
                assert.isFalse(project2.isClosed());
                projectService.openClientFile(file2.path);
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                assert.strictEqual(projectService.configuredProjects.get(tsconfig1.path), project1);
                assert.isUndefined(projectService.configuredProjects.get(tsconfig2.path));
                assert.isTrue(project1.hasOpenRef(), "Has open ref count in project1 - 5"); // file2
                assert.isFalse(project1.isClosed());
                assert.isTrue(project2.isClosed());
            });
            it("Open ref of configured project when open file gets added to the project as part of configured file update", () => {
                const file1 = {
                    path: "/a/b/src/file1.ts",
                    content: "let x = 1;"
                };
                const file2 = {
                    path: "/a/b/src/file2.ts",
                    content: "let y = 1;"
                };
                const file3 = {
                    path: "/a/b/file3.ts",
                    content: "let z = 1;"
                };
                const file4 = {
                    path: "/a/file4.ts",
                    content: "let z = 1;"
                };
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: JSON.stringify({ files: ["src/file1.ts", "file3.ts"] })
                };
                const files = [file1, file2, file3, file4];
                const host = projectSystem.createServerHost(files.concat(configFile));
                const projectService = createProjectService(host);
                projectService.openClientFile(file1.path);
                projectService.openClientFile(file2.path);
                projectService.openClientFile(file3.path);
                projectService.openClientFile(file4.path);
                const infos = files.map(file => projectService.getScriptInfoForPath(file.path));
                checkOpenFiles(projectService, files);
                checkNumberOfProjects(projectService, { configuredProjects: 1, inferredProjects: 2 });
                const configProject1 = projectService.configuredProjects.get(configFile.path);
                assert.isTrue(configProject1.hasOpenRef()); // file1 and file3
                checkProjectActualFiles(configProject1, [file1.path, file3.path, configFile.path]);
                const inferredProject1 = projectService.inferredProjects[0];
                checkProjectActualFiles(inferredProject1, [file2.path]);
                const inferredProject2 = projectService.inferredProjects[1];
                checkProjectActualFiles(inferredProject2, [file4.path]);
                configFile.content = "{}";
                host.reloadFS(files.concat(configFile));
                host.runQueuedTimeoutCallbacks();
                verifyScriptInfos();
                checkOpenFiles(projectService, files);
                verifyConfiguredProjectStateAfterUpdate(/*hasOpenRef*/ true); // file1, file2, file3
                checkNumberOfInferredProjects(projectService, 1);
                const inferredProject3 = projectService.inferredProjects[0];
                checkProjectActualFiles(inferredProject3, [file4.path]);
                assert.strictEqual(inferredProject3, inferredProject2);
                projectService.closeClientFile(file1.path);
                projectService.closeClientFile(file2.path);
                projectService.closeClientFile(file4.path);
                verifyScriptInfos();
                checkOpenFiles(projectService, [file3]);
                verifyConfiguredProjectStateAfterUpdate(/*hasOpenRef*/ true); // file3
                checkNumberOfInferredProjects(projectService, 0);
                projectService.openClientFile(file4.path);
                verifyScriptInfos();
                checkOpenFiles(projectService, [file3, file4]);
                verifyConfiguredProjectStateAfterUpdate(/*hasOpenRef*/ true); // file3
                checkNumberOfInferredProjects(projectService, 1);
                const inferredProject4 = projectService.inferredProjects[0];
                checkProjectActualFiles(inferredProject4, [file4.path]);
                projectService.closeClientFile(file3.path);
                verifyScriptInfos();
                checkOpenFiles(projectService, [file4]);
                verifyConfiguredProjectStateAfterUpdate(/*hasOpenRef*/ false); // No open files
                checkNumberOfInferredProjects(projectService, 1);
                const inferredProject5 = projectService.inferredProjects[0];
                checkProjectActualFiles(inferredProject4, [file4.path]);
                assert.strictEqual(inferredProject5, inferredProject4);
                const file5 = {
                    path: "/file5.ts",
                    content: "let zz = 1;"
                };
                host.reloadFS(files.concat(configFile, file5));
                projectService.openClientFile(file5.path);
                verifyScriptInfosAreUndefined([file1, file2, file3]);
                assert.strictEqual(projectService.getScriptInfoForPath(file4.path), ts.find(infos, info => info.path === file4.path));
                assert.isDefined(projectService.getScriptInfoForPath(file5.path));
                checkOpenFiles(projectService, [file4, file5]);
                checkNumberOfConfiguredProjects(projectService, 0);
                function verifyScriptInfos() {
                    infos.forEach(info => assert.strictEqual(projectService.getScriptInfoForPath(info.path), info));
                }
                function verifyScriptInfosAreUndefined(files) {
                    for (const file of files) {
                        assert.isUndefined(projectService.getScriptInfoForPath(file.path));
                    }
                }
                function verifyConfiguredProjectStateAfterUpdate(hasOpenRef) {
                    checkNumberOfConfiguredProjects(projectService, 1);
                    const configProject2 = projectService.configuredProjects.get(configFile.path);
                    assert.strictEqual(configProject2, configProject1);
                    checkProjectActualFiles(configProject2, [file1.path, file2.path, file3.path, configFile.path]);
                    assert.equal(configProject2.hasOpenRef(), hasOpenRef);
                }
            });
            it("Open ref of configured project when open file gets added to the project as part of configured file update buts its open file references are all closed when the update happens", () => {
                const file1 = {
                    path: "/a/b/src/file1.ts",
                    content: "let x = 1;"
                };
                const file2 = {
                    path: "/a/b/src/file2.ts",
                    content: "let y = 1;"
                };
                const file3 = {
                    path: "/a/b/file3.ts",
                    content: "let z = 1;"
                };
                const file4 = {
                    path: "/a/file4.ts",
                    content: "let z = 1;"
                };
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: JSON.stringify({ files: ["src/file1.ts", "file3.ts"] })
                };
                const files = [file1, file2, file3];
                const hostFiles = files.concat(file4, configFile);
                const host = projectSystem.createServerHost(hostFiles);
                const projectService = createProjectService(host);
                projectService.openClientFile(file1.path);
                projectService.openClientFile(file2.path);
                projectService.openClientFile(file3.path);
                checkNumberOfProjects(projectService, { configuredProjects: 1, inferredProjects: 1 });
                const configuredProject = projectService.configuredProjects.get(configFile.path);
                assert.isTrue(configuredProject.hasOpenRef()); // file1 and file3
                checkProjectActualFiles(configuredProject, [file1.path, file3.path, configFile.path]);
                const inferredProject1 = projectService.inferredProjects[0];
                checkProjectActualFiles(inferredProject1, [file2.path]);
                projectService.closeClientFile(file1.path);
                projectService.closeClientFile(file3.path);
                assert.isFalse(configuredProject.hasOpenRef()); // No files
                configFile.content = "{}";
                host.reloadFS(files.concat(configFile));
                // Time out is not yet run so there is project update pending
                assert.isTrue(configuredProject.hasOpenRef()); // Pending update and file2 might get into the project
                projectService.openClientFile(file4.path);
                checkNumberOfProjects(projectService, { configuredProjects: 1, inferredProjects: 2 });
                assert.strictEqual(projectService.configuredProjects.get(configFile.path), configuredProject);
                assert.isTrue(configuredProject.hasOpenRef()); // Pending update and F2 might get into the project
                assert.strictEqual(projectService.inferredProjects[0], inferredProject1);
                const inferredProject2 = projectService.inferredProjects[1];
                checkProjectActualFiles(inferredProject2, [file4.path]);
                host.runQueuedTimeoutCallbacks();
                checkNumberOfProjects(projectService, { configuredProjects: 1, inferredProjects: 1 });
                assert.strictEqual(projectService.configuredProjects.get(configFile.path), configuredProject);
                assert.isTrue(configuredProject.hasOpenRef()); // file2
                checkProjectActualFiles(configuredProject, [file1.path, file2.path, file3.path, configFile.path]);
                assert.strictEqual(projectService.inferredProjects[0], inferredProject2);
                checkProjectActualFiles(inferredProject2, [file4.path]);
            });
            it("language service disabled state is updated in external projects", () => {
                const f1 = {
                    path: "/a/app.js",
                    content: "var x = 1"
                };
                const f2 = {
                    path: "/a/largefile.js",
                    content: ""
                };
                const host = projectSystem.createServerHost([f1, f2]);
                const originalGetFileSize = host.getFileSize;
                host.getFileSize = (filePath) => filePath === f2.path ? ts.server.maxProgramSizeForNonTsFiles + 1 : originalGetFileSize.call(host, filePath);
                const service = createProjectService(host);
                const projectFileName = "/a/proj.csproj";
                service.openExternalProject({
                    projectFileName,
                    rootFiles: toExternalFiles([f1.path, f2.path]),
                    options: {}
                });
                service.checkNumberOfProjects({ externalProjects: 1 });
                assert.isFalse(service.externalProjects[0].languageServiceEnabled, "language service should be disabled - 1");
                service.openExternalProject({
                    projectFileName,
                    rootFiles: toExternalFiles([f1.path]),
                    options: {}
                });
                service.checkNumberOfProjects({ externalProjects: 1 });
                assert.isTrue(service.externalProjects[0].languageServiceEnabled, "language service should be enabled");
                service.openExternalProject({
                    projectFileName,
                    rootFiles: toExternalFiles([f1.path, f2.path]),
                    options: {}
                });
                service.checkNumberOfProjects({ externalProjects: 1 });
                assert.isFalse(service.externalProjects[0].languageServiceEnabled, "language service should be disabled - 2");
            });
            it("files are properly detached when language service is disabled", () => {
                const f1 = {
                    path: "/a/app.js",
                    content: "var x = 1"
                };
                const f2 = {
                    path: "/a/largefile.js",
                    content: ""
                };
                const f3 = {
                    path: "/a/lib.js",
                    content: "var x = 1"
                };
                const config = {
                    path: "/a/tsconfig.json",
                    content: JSON.stringify({ compilerOptions: { allowJs: true } })
                };
                const host = projectSystem.createServerHost([f1, f2, f3, config]);
                const originalGetFileSize = host.getFileSize;
                host.getFileSize = (filePath) => filePath === f2.path ? ts.server.maxProgramSizeForNonTsFiles + 1 : originalGetFileSize.call(host, filePath);
                const projectService = createProjectService(host);
                projectService.openClientFile(f1.path);
                projectService.checkNumberOfProjects({ configuredProjects: 1 });
                const project = projectService.configuredProjects.get(config.path);
                assert.isTrue(project.hasOpenRef()); // f1
                assert.isFalse(project.isClosed());
                projectService.closeClientFile(f1.path);
                projectService.checkNumberOfProjects({ configuredProjects: 1 });
                assert.strictEqual(projectService.configuredProjects.get(config.path), project);
                assert.isFalse(project.hasOpenRef()); // No files
                assert.isFalse(project.isClosed());
                for (const f of [f1, f2, f3]) {
                    // All the script infos should be present and contain the project since it is still alive.
                    const scriptInfo = projectService.getScriptInfoForNormalizedPath(ts.server.toNormalizedPath(f.path));
                    assert.equal(scriptInfo.containingProjects.length, 1, `expect 1 containing projects for '${f.path}'`);
                    assert.equal(scriptInfo.containingProjects[0], project, `expect configured project to be the only containing project for '${f.path}'`);
                }
                const f4 = {
                    path: "/aa.js",
                    content: "var x = 1"
                };
                host.reloadFS([f1, f2, f3, config, f4]);
                projectService.openClientFile(f4.path);
                projectService.checkNumberOfProjects({ inferredProjects: 1 });
                assert.isFalse(project.hasOpenRef()); // No files
                assert.isTrue(project.isClosed());
                for (const f of [f1, f2, f3]) {
                    // All the script infos should not be present since the project is closed and orphan script infos are collected
                    assert.isUndefined(projectService.getScriptInfoForNormalizedPath(ts.server.toNormalizedPath(f.path)));
                }
            });
            it("language service disabled events are triggered", () => {
                const f1 = {
                    path: "/a/app.js",
                    content: "let x = 1;"
                };
                const f2 = {
                    path: "/a/largefile.js",
                    content: ""
                };
                const config = {
                    path: "/a/jsconfig.json",
                    content: "{}"
                };
                const configWithExclude = {
                    path: config.path,
                    content: JSON.stringify({ exclude: ["largefile.js"] })
                };
                const host = projectSystem.createServerHost([f1, f2, config]);
                const originalGetFileSize = host.getFileSize;
                host.getFileSize = (filePath) => filePath === f2.path ? ts.server.maxProgramSizeForNonTsFiles + 1 : originalGetFileSize.call(host, filePath);
                let lastEvent;
                const session = createSession(host, {
                    canUseEvents: true,
                    eventHandler: e => {
                        if (e.eventName === ts.server.ConfigFileDiagEvent || e.eventName === ts.server.ProjectsUpdatedInBackgroundEvent || e.eventName === ts.server.ProjectInfoTelemetryEvent) {
                            return;
                        }
                        assert.equal(e.eventName, ts.server.ProjectLanguageServiceStateEvent);
                        assert.equal(e.data.project.getProjectName(), config.path, "project name");
                        lastEvent = e;
                    }
                });
                session.executeCommand({
                    seq: 0,
                    type: "request",
                    command: "open",
                    arguments: { file: f1.path }
                });
                const projectService = session.getProjectService();
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                const project = configuredProjectAt(projectService, 0);
                assert.isFalse(project.languageServiceEnabled, "Language service enabled");
                assert.isTrue(!!lastEvent, "should receive event");
                assert.equal(lastEvent.data.project, project, "project name");
                assert.equal(lastEvent.data.project.getProjectName(), config.path, "config path");
                assert.isFalse(lastEvent.data.languageServiceEnabled, "Language service state");
                host.reloadFS([f1, f2, configWithExclude]);
                host.checkTimeoutQueueLengthAndRun(2);
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                assert.isTrue(project.languageServiceEnabled, "Language service enabled");
                assert.equal(lastEvent.data.project, project, "project");
                assert.isTrue(lastEvent.data.languageServiceEnabled, "Language service state");
            });
            it("syntactic features work even if language service is disabled", () => {
                const f1 = {
                    path: "/a/app.js",
                    content: "let x =   1;"
                };
                const f2 = {
                    path: "/a/largefile.js",
                    content: ""
                };
                const config = {
                    path: "/a/jsconfig.json",
                    content: "{}"
                };
                const host = projectSystem.createServerHost([f1, f2, config]);
                const originalGetFileSize = host.getFileSize;
                host.getFileSize = (filePath) => filePath === f2.path ? ts.server.maxProgramSizeForNonTsFiles + 1 : originalGetFileSize.call(host, filePath);
                let lastEvent;
                const session = createSession(host, {
                    canUseEvents: true,
                    eventHandler: e => {
                        if (e.eventName === ts.server.ConfigFileDiagEvent || e.eventName === ts.server.ProjectInfoTelemetryEvent) {
                            return;
                        }
                        assert.equal(e.eventName, ts.server.ProjectLanguageServiceStateEvent);
                        lastEvent = e;
                    }
                });
                session.executeCommand({
                    seq: 0,
                    type: "request",
                    command: "open",
                    arguments: { file: f1.path }
                });
                const projectService = session.getProjectService();
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                const project = configuredProjectAt(projectService, 0);
                assert.isFalse(project.languageServiceEnabled, "Language service enabled");
                assert.isTrue(!!lastEvent, "should receive event");
                assert.equal(lastEvent.data.project, project, "project name");
                assert.isFalse(lastEvent.data.languageServiceEnabled, "Language service state");
                const options = projectService.getFormatCodeOptions(f1.path);
                const edits = project.getLanguageService().getFormattingEditsForDocument(f1.path, options);
                assert.deepEqual(edits, [{ span: ts.createTextSpan(/*start*/ 7, /*length*/ 3), newText: " " }]);
            });
            it("snapshot from different caches are incompatible", () => {
                const f1 = {
                    path: "/a/b/app.ts",
                    content: "let x = 1;"
                };
                const host = projectSystem.createServerHost([f1]);
                const projectFileName = "/a/b/proj.csproj";
                const projectService = createProjectService(host);
                projectService.openExternalProject({
                    projectFileName,
                    rootFiles: [toExternalFile(f1.path)],
                    options: {}
                });
                projectService.openClientFile(f1.path, "let x = 1;\nlet y = 2;");
                projectService.checkNumberOfProjects({ externalProjects: 1 });
                projectService.externalProjects[0].getLanguageService(/*ensureSynchronized*/ false).getNavigationBarItems(f1.path);
                projectService.closeClientFile(f1.path);
                projectService.openClientFile(f1.path);
                projectService.checkNumberOfProjects({ externalProjects: 1 });
                const navbar = projectService.externalProjects[0].getLanguageService(/*ensureSynchronized*/ false).getNavigationBarItems(f1.path);
                assert.equal(navbar[0].spans[0].length, f1.content.length);
            });
            it("deleting config file opened from the external project works", () => {
                const site = {
                    path: "/user/someuser/project/js/site.js",
                    content: ""
                };
                const configFile = {
                    path: "/user/someuser/project/tsconfig.json",
                    content: "{}"
                };
                const projectFileName = "/user/someuser/project/WebApplication6.csproj";
                const host = projectSystem.createServerHost([projectSystem.libFile, site, configFile]);
                const projectService = createProjectService(host);
                const externalProject = {
                    projectFileName,
                    rootFiles: [toExternalFile(site.path), toExternalFile(configFile.path)],
                    options: { allowJs: false },
                    typeAcquisition: { include: [] }
                };
                projectService.openExternalProjects([externalProject]);
                let knownProjects = projectService.synchronizeProjectList([]);
                checkNumberOfProjects(projectService, { configuredProjects: 1, externalProjects: 0, inferredProjects: 0 });
                const configProject = configuredProjectAt(projectService, 0);
                checkProjectActualFiles(configProject, [projectSystem.libFile.path, configFile.path]);
                const diagnostics = configProject.getAllProjectErrors();
                assert.equal(diagnostics[0].code, Diagnostics.No_inputs_were_found_in_config_file_0_Specified_include_paths_were_1_and_exclude_paths_were_2.code);
                host.reloadFS([projectSystem.libFile, site]);
                host.checkTimeoutQueueLengthAndRun(1);
                knownProjects = projectService.synchronizeProjectList(ts.map(knownProjects, proj => proj.info));
                checkNumberOfProjects(projectService, { configuredProjects: 0, externalProjects: 0, inferredProjects: 0 });
                externalProject.rootFiles.length = 1;
                projectService.openExternalProjects([externalProject]);
                checkNumberOfProjects(projectService, { configuredProjects: 0, externalProjects: 1, inferredProjects: 0 });
                checkProjectActualFiles(projectService.externalProjects[0], [site.path, projectSystem.libFile.path]);
            });
            it("Getting errors from closed script info does not throw exception (because of getting project from orphan script info)", () => {
                let hasErrorMsg = false;
                const { close, hasLevel, loggingEnabled, startGroup, endGroup, info, getLogFileName, perftrc } = projectSystem.nullLogger;
                const logger = {
                    close, hasLevel, loggingEnabled, startGroup, endGroup, info, getLogFileName, perftrc,
                    msg: () => {
                        hasErrorMsg = true;
                    }
                };
                const f1 = {
                    path: "/a/b/app.ts",
                    content: "let x = 1;"
                };
                const config = {
                    path: "/a/b/tsconfig.json",
                    content: JSON.stringify({ compilerOptions: {} })
                };
                const host = projectSystem.createServerHost([f1, projectSystem.libFile, config]);
                const session = createSession(host, { logger });
                session.executeCommandSeq({
                    command: ts.server.CommandNames.Open,
                    arguments: {
                        file: f1.path
                    }
                });
                session.executeCommandSeq({
                    command: ts.server.CommandNames.Close,
                    arguments: {
                        file: f1.path
                    }
                });
                session.executeCommandSeq({
                    command: ts.server.CommandNames.Geterr,
                    arguments: {
                        delay: 0,
                        files: [f1.path]
                    }
                });
                assert.isFalse(hasErrorMsg);
            });
            it("Changed module resolution reflected when specifying files list", () => {
                const file1 = {
                    path: "/a/b/file1.ts",
                    content: 'import classc from "file2"'
                };
                const file2a = {
                    path: "/a/file2.ts",
                    content: "export classc { method2a() { return 10; } }"
                };
                const file2 = {
                    path: "/a/b/file2.ts",
                    content: "export classc { method2() { return 10; } }"
                };
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: JSON.stringify({ files: [file1.path], compilerOptions: { module: "amd" } })
                };
                const files = [file1, file2a, configFile, projectSystem.libFile];
                const host = projectSystem.createServerHost(files);
                const projectService = createProjectService(host);
                projectService.openClientFile(file1.path);
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                const project = projectService.configuredProjects.get(configFile.path);
                assert.isDefined(project);
                checkProjectActualFiles(project, ts.map(files, file => file.path));
                projectSystem.checkWatchedFiles(host, ts.mapDefined(files, file => file === file1 ? undefined : file.path));
                projectSystem.checkWatchedDirectories(host, [], /*recursive*/ false);
                const watchedRecursiveDirectories = ["/a/b/node_modules/@types"];
                watchedRecursiveDirectories.push("/a/b");
                projectSystem.checkWatchedDirectories(host, watchedRecursiveDirectories, /*recursive*/ true);
                files.push(file2);
                host.reloadFS(files);
                host.runQueuedTimeoutCallbacks();
                watchedRecursiveDirectories.pop();
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                assert.strictEqual(projectService.configuredProjects.get(configFile.path), project);
                checkProjectActualFiles(project, ts.mapDefined(files, file => file === file2a ? undefined : file.path));
                projectSystem.checkWatchedFiles(host, ts.mapDefined(files, file => file === file1 ? undefined : file.path));
                projectSystem.checkWatchedDirectories(host, [], /*recursive*/ false);
                projectSystem.checkWatchedDirectories(host, watchedRecursiveDirectories, /*recursive*/ true);
                // On next file open the files file2a should be closed and not watched any more
                projectService.openClientFile(file2.path);
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                assert.strictEqual(projectService.configuredProjects.get(configFile.path), project);
                checkProjectActualFiles(project, ts.mapDefined(files, file => file === file2a ? undefined : file.path));
                projectSystem.checkWatchedFiles(host, [projectSystem.libFile.path, configFile.path]);
                projectSystem.checkWatchedDirectories(host, [], /*recursive*/ false);
                projectSystem.checkWatchedDirectories(host, watchedRecursiveDirectories, /*recursive*/ true);
            });
            it("Failed lookup locations uses parent most node_modules directory", () => {
                const root = "/user/username/rootfolder";
                const file1 = {
                    path: "/a/b/src/file1.ts",
                    content: 'import { classc } from "module1"'
                };
                const module1 = {
                    path: "/a/b/node_modules/module1/index.d.ts",
                    content: `import { class2 } from "module2";
                          export classc { method2a(): class2; }`
                };
                const module2 = {
                    path: "/a/b/node_modules/module2/index.d.ts",
                    content: "export class2 { method2() { return 10; } }"
                };
                const module3 = {
                    path: "/a/b/node_modules/module/node_modules/module3/index.d.ts",
                    content: "export class3 { method2() { return 10; } }"
                };
                const configFile = {
                    path: "/a/b/src/tsconfig.json",
                    content: JSON.stringify({ files: ["file1.ts"] })
                };
                const nonLibFiles = [file1, module1, module2, module3, configFile];
                nonLibFiles.forEach(f => f.path = root + f.path);
                const files = nonLibFiles.concat(projectSystem.libFile);
                const host = projectSystem.createServerHost(files);
                const projectService = createProjectService(host);
                projectService.openClientFile(file1.path);
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                const project = projectService.configuredProjects.get(configFile.path);
                assert.isDefined(project);
                checkProjectActualFiles(project, [file1.path, projectSystem.libFile.path, module1.path, module2.path, configFile.path]);
                projectSystem.checkWatchedFiles(host, [projectSystem.libFile.path, module1.path, module2.path, configFile.path]);
                projectSystem.checkWatchedDirectories(host, [], /*recursive*/ false);
                const watchedRecursiveDirectories = getTypeRootsFromLocation(root + "/a/b/src");
                watchedRecursiveDirectories.push(`${root}/a/b/src`, `${root}/a/b/node_modules`);
                projectSystem.checkWatchedDirectories(host, watchedRecursiveDirectories, /*recursive*/ true);
            });
            it("Properly handle Windows-style outDir", () => {
                const configFile = {
                    path: "C:\\a\\tsconfig.json",
                    content: JSON.stringify({
                        compilerOptions: {
                            outDir: `C:\\a\\b`
                        },
                        include: ["*.ts"]
                    })
                };
                const file1 = {
                    path: "C:\\a\\f1.ts",
                    content: "let x = 1;"
                };
                const host = projectSystem.createServerHost([file1, configFile], { useWindowsStylePaths: true });
                const projectService = createProjectService(host);
                projectService.openClientFile(file1.path);
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                const project = configuredProjectAt(projectService, 0);
                checkProjectActualFiles(project, [ts.normalizePath(file1.path), ts.normalizePath(configFile.path)]);
                const options = project.getCompilerOptions();
                assert.equal(options.outDir, "C:/a/b", "");
            });
            it("dynamic file without external project", () => {
                const file = {
                    path: "^walkThroughSnippet:/Users/UserName/projects/someProject/out/someFile#1.js",
                    content: "var x = 10;"
                };
                const host = projectSystem.createServerHost([projectSystem.libFile], { useCaseSensitiveFileNames: true });
                const projectService = createProjectService(host);
                projectService.setCompilerOptionsForInferredProjects({
                    module: ts.ModuleKind.CommonJS,
                    allowJs: true,
                    allowSyntheticDefaultImports: true,
                    allowNonTsExtensions: true
                });
                projectService.openClientFile(file.path, "var x = 10;");
                projectService.checkNumberOfProjects({ inferredProjects: 1 });
                const project = projectService.inferredProjects[0];
                checkProjectRootFiles(project, [file.path]);
                checkProjectActualFiles(project, [file.path, projectSystem.libFile.path]);
                assert.strictEqual(projectService.getDefaultProjectForFile(ts.server.toNormalizedPath(file.path), /*ensureProject*/ true), project);
                const indexOfX = file.content.indexOf("x");
                assert.deepEqual(project.getLanguageService(/*ensureSynchronized*/ true).getQuickInfoAtPosition(file.path, indexOfX), {
                    kind: ts.ScriptElementKind.variableElement,
                    kindModifiers: "",
                    textSpan: { start: indexOfX, length: 1 },
                    displayParts: [
                        { text: "var", kind: "keyword" },
                        { text: " ", kind: "space" },
                        { text: "x", kind: "localName" },
                        { text: ":", kind: "punctuation" },
                        { text: " ", kind: "space" },
                        { text: "number", kind: "keyword" }
                    ],
                    documentation: [],
                    tags: []
                });
            });
            it("files opened, closed affecting multiple projects", () => {
                const file = {
                    path: "/a/b/projects/config/file.ts",
                    content: `import {a} from "../files/file1"; export let b = a;`
                };
                const config = {
                    path: "/a/b/projects/config/tsconfig.json",
                    content: ""
                };
                const filesFile1 = {
                    path: "/a/b/projects/files/file1.ts",
                    content: "export let a = 10;"
                };
                const filesFile2 = {
                    path: "/a/b/projects/files/file2.ts",
                    content: "export let aa = 10;"
                };
                const files = [config, file, filesFile1, filesFile2, projectSystem.libFile];
                const host = projectSystem.createServerHost(files);
                const session = createSession(host);
                // Create configured project
                session.executeCommandSeq({
                    command: "open" /* Open */,
                    arguments: {
                        file: file.path
                    }
                });
                const projectService = session.getProjectService();
                const configuredProject = projectService.configuredProjects.get(config.path);
                verifyConfiguredProject();
                // open files/file1 = should not create another project
                session.executeCommandSeq({
                    command: "open" /* Open */,
                    arguments: {
                        file: filesFile1.path
                    }
                });
                verifyConfiguredProject();
                // Close the file = should still have project
                session.executeCommandSeq({
                    command: "close" /* Close */,
                    arguments: {
                        file: file.path
                    }
                });
                verifyConfiguredProject();
                // Open files/file2 - should create inferred project and close configured project
                session.executeCommandSeq({
                    command: "open" /* Open */,
                    arguments: {
                        file: filesFile2.path
                    }
                });
                checkNumberOfProjects(projectService, { inferredProjects: 1 });
                checkProjectActualFiles(projectService.inferredProjects[0], [projectSystem.libFile.path, filesFile2.path]);
                // Actions on file1 would result in assert
                session.executeCommandSeq({
                    command: "occurrences" /* Occurrences */,
                    arguments: {
                        file: filesFile1.path,
                        line: 1,
                        offset: filesFile1.content.indexOf("a")
                    }
                });
                function verifyConfiguredProject() {
                    checkNumberOfProjects(projectService, { configuredProjects: 1 });
                    checkProjectActualFiles(configuredProject, [file.path, filesFile1.path, projectSystem.libFile.path, config.path]);
                }
            });
            it("requests are done on file on pendingReload but has svc for previous version", () => {
                const projectLocation = "/user/username/projects/project";
                const file1 = {
                    path: `${projectLocation}/src/file1.ts`,
                    content: `import { y } from "./file1"; let x = 10;`
                };
                const file2 = {
                    path: `${projectLocation}/src/file2.ts`,
                    content: "export let y = 10;"
                };
                const config = {
                    path: `${projectLocation}/tsconfig.json`,
                    content: "{}"
                };
                const files = [file1, file2, projectSystem.libFile, config];
                const host = projectSystem.createServerHost(files);
                const session = createSession(host);
                session.executeCommandSeq({
                    command: "open" /* Open */,
                    arguments: { file: file2.path, fileContent: file2.content }
                });
                session.executeCommandSeq({
                    command: "open" /* Open */,
                    arguments: { file: file1.path }
                });
                session.executeCommandSeq({
                    command: "close" /* Close */,
                    arguments: { file: file2.path }
                });
                file2.content += "export let z = 10;";
                host.reloadFS(files);
                // Do not let the timeout runs, before executing command
                const startOffset = file2.content.indexOf("y") + 1;
                session.executeCommandSeq({
                    command: "getApplicableRefactors" /* GetApplicableRefactors */,
                    arguments: { file: file2.path, startLine: 1, startOffset, endLine: 1, endOffset: startOffset + 1 }
                });
            });
        });
        describe("tsserverProjectSystem Proper errors", () => {
            function createErrorLogger() {
                let hasError = false;
                const errorLogger = {
                    close: ts.noop,
                    hasLevel: () => true,
                    loggingEnabled: () => true,
                    perftrc: ts.noop,
                    info: ts.noop,
                    msg: (_s, type) => {
                        if (type === ts.server.Msg.Err) {
                            hasError = true;
                        }
                    },
                    startGroup: ts.noop,
                    endGroup: ts.noop,
                    getLogFileName: () => undefined
                };
                return {
                    errorLogger,
                    hasError: () => hasError
                };
            }
            it("document is not contained in project", () => {
                const file1 = {
                    path: "/a/b/app.ts",
                    content: ""
                };
                const corruptedConfig = {
                    path: "/a/b/tsconfig.json",
                    content: "{"
                };
                const host = projectSystem.createServerHost([file1, corruptedConfig]);
                const projectService = createProjectService(host);
                projectService.openClientFile(file1.path);
                projectService.checkNumberOfProjects({ configuredProjects: 1 });
                const project = projectService.findProject(corruptedConfig.path);
                checkProjectRootFiles(project, [file1.path]);
            });
            describe("when opening new file that doesnt exist on disk yet", () => {
                function verifyNonExistentFile(useProjectRoot) {
                    const host = projectSystem.createServerHost([projectSystem.libFile]);
                    const { hasError, errorLogger } = createErrorLogger();
                    const session = createSession(host, { canUseEvents: true, logger: errorLogger, useInferredProjectPerProjectRoot: true });
                    const folderPath = "/user/someuser/projects/someFolder";
                    const projectService = session.getProjectService();
                    const untitledFile = "untitled:Untitled-1";
                    session.executeCommandSeq({
                        command: ts.server.CommandNames.Open,
                        arguments: {
                            file: untitledFile,
                            fileContent: "",
                            scriptKindName: "JS",
                            projectRootPath: useProjectRoot ? folderPath : undefined
                        }
                    });
                    checkNumberOfProjects(projectService, { inferredProjects: 1 });
                    const infoForUntitledAtProjectRoot = projectService.getScriptInfoForPath(`${folderPath.toLowerCase()}/${untitledFile.toLowerCase()}`);
                    const infoForUnitiledAtRoot = projectService.getScriptInfoForPath(`/${untitledFile.toLowerCase()}`);
                    if (useProjectRoot) {
                        assert.isDefined(infoForUntitledAtProjectRoot);
                        assert.isUndefined(infoForUnitiledAtRoot);
                    }
                    else {
                        assert.isDefined(infoForUnitiledAtRoot);
                        assert.isUndefined(infoForUntitledAtProjectRoot);
                    }
                    host.checkTimeoutQueueLength(2);
                    const newTimeoutId = host.getNextTimeoutId();
                    const expectedSequenceId = session.getNextSeq();
                    session.executeCommandSeq({
                        command: ts.server.CommandNames.Geterr,
                        arguments: {
                            delay: 0,
                            files: [untitledFile]
                        }
                    });
                    host.checkTimeoutQueueLength(3);
                    // Run the last one = get error request
                    host.runQueuedTimeoutCallbacks(newTimeoutId);
                    assert.isFalse(hasError());
                    host.checkTimeoutQueueLength(2);
                    checkErrorMessage(session, "syntaxDiag", { file: untitledFile, diagnostics: [] });
                    session.clearMessages();
                    host.runQueuedImmediateCallbacks();
                    assert.isFalse(hasError());
                    checkErrorMessage(session, "semanticDiag", { file: untitledFile, diagnostics: [] });
                    session.clearMessages();
                    host.runQueuedImmediateCallbacks(1);
                    assert.isFalse(hasError());
                    checkErrorMessage(session, "suggestionDiag", { file: untitledFile, diagnostics: [] });
                    checkCompleteEvent(session, 2, expectedSequenceId);
                    session.clearMessages();
                }
                it("has projectRoot", () => {
                    verifyNonExistentFile(/*useProjectRoot*/ true);
                });
                it("does not have projectRoot", () => {
                    verifyNonExistentFile(/*useProjectRoot*/ false);
                });
            });
            it("folder rename updates project structure and reports no errors", () => {
                const projectDir = "/a/b/projects/myproject";
                const app = {
                    path: `${projectDir}/bar/app.ts`,
                    content: "class Bar implements foo.Foo { getFoo() { return ''; } get2() { return 1; } }"
                };
                const foo = {
                    path: `${projectDir}/foo/foo.ts`,
                    content: "declare namespace foo { interface Foo { get2(): number; getFoo(): string; } }"
                };
                const configFile = {
                    path: `${projectDir}/tsconfig.json`,
                    content: JSON.stringify({ compilerOptions: { module: "none", targer: "es5" }, exclude: ["node_modules"] })
                };
                const host = projectSystem.createServerHost([app, foo, configFile]);
                const session = createSession(host, { canUseEvents: true, });
                const projectService = session.getProjectService();
                session.executeCommandSeq({
                    command: ts.server.CommandNames.Open,
                    arguments: { file: app.path, }
                });
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                assert.isDefined(projectService.configuredProjects.get(configFile.path));
                verifyErrorsInApp();
                host.renameFolder(`${projectDir}/foo`, `${projectDir}/foo2`);
                host.runQueuedTimeoutCallbacks();
                host.runQueuedTimeoutCallbacks();
                verifyErrorsInApp();
                function verifyErrorsInApp() {
                    session.clearMessages();
                    const expectedSequenceId = session.getNextSeq();
                    session.executeCommandSeq({
                        command: ts.server.CommandNames.Geterr,
                        arguments: {
                            delay: 0,
                            files: [app.path]
                        }
                    });
                    host.checkTimeoutQueueLengthAndRun(1);
                    checkErrorMessage(session, "syntaxDiag", { file: app.path, diagnostics: [] });
                    session.clearMessages();
                    host.runQueuedImmediateCallbacks();
                    checkErrorMessage(session, "semanticDiag", { file: app.path, diagnostics: [] });
                    session.clearMessages();
                    host.runQueuedImmediateCallbacks(1);
                    checkErrorMessage(session, "suggestionDiag", { file: app.path, diagnostics: [] });
                    checkCompleteEvent(session, 2, expectedSequenceId);
                    session.clearMessages();
                }
            });
            it("Getting errors before opening file", () => {
                const file = {
                    path: "/a/b/project/file.ts",
                    content: "let x: number = false;"
                };
                const host = projectSystem.createServerHost([file, projectSystem.libFile]);
                const { hasError, errorLogger } = createErrorLogger();
                const session = createSession(host, { canUseEvents: true, logger: errorLogger });
                session.clearMessages();
                const expectedSequenceId = session.getNextSeq();
                session.executeCommandSeq({
                    command: ts.server.CommandNames.Geterr,
                    arguments: {
                        delay: 0,
                        files: [file.path]
                    }
                });
                host.runQueuedImmediateCallbacks();
                assert.isFalse(hasError());
                checkCompleteEvent(session, 1, expectedSequenceId);
                session.clearMessages();
            });
        });
        describe("tsserverProjectSystem autoDiscovery", () => {
            it("does not depend on extension", () => {
                const file1 = {
                    path: "/a/b/app.html",
                    content: ""
                };
                const file2 = {
                    path: "/a/b/app.d.ts",
                    content: ""
                };
                const host = projectSystem.createServerHost([file1, file2]);
                const projectService = createProjectService(host);
                projectService.openExternalProject({
                    projectFileName: "/a/b/proj.csproj",
                    rootFiles: [toExternalFile(file2.path), { fileName: file1.path, hasMixedContent: true, scriptKind: ts.ScriptKind.JS }],
                    options: {}
                });
                projectService.checkNumberOfProjects({ externalProjects: 1 });
                const typeAcquisition = projectService.externalProjects[0].getTypeAcquisition();
                assert.isTrue(typeAcquisition.enable, "Typine acquisition should be enabled");
            });
        });
        describe("tsserverProjectSystem extra resolution pass in lshost", () => {
            it("can load typings that are proper modules", () => {
                const file1 = {
                    path: "/a/b/app.js",
                    content: `var x = require("lib")`
                };
                const lib = {
                    path: "/a/cache/node_modules/@types/lib/index.d.ts",
                    content: "export let x = 1"
                };
                const host = projectSystem.createServerHost([file1, lib]);
                const resolutionTrace = createHostModuleResolutionTrace(host);
                const projectService = createProjectService(host, { typingsInstaller: new TestTypingsInstaller("/a/cache", /*throttleLimit*/ 5, host) });
                projectService.setCompilerOptionsForInferredProjects({ traceResolution: true, allowJs: true });
                projectService.openClientFile(file1.path);
                projectService.checkNumberOfProjects({ inferredProjects: 1 });
                const proj = projectService.inferredProjects[0];
                assert.deepEqual(resolutionTrace, [
                    "======== Resolving module 'lib' from '/a/b/app.js'. ========",
                    "Module resolution kind is not specified, using 'NodeJs'.",
                    "Loading module 'lib' from 'node_modules' folder, target file type 'TypeScript'.",
                    "Directory '/a/b/node_modules' does not exist, skipping all lookups in it.",
                    "Directory '/a/node_modules' does not exist, skipping all lookups in it.",
                    "Directory '/node_modules' does not exist, skipping all lookups in it.",
                    "Loading module 'lib' from 'node_modules' folder, target file type 'JavaScript'.",
                    "Directory '/a/b/node_modules' does not exist, skipping all lookups in it.",
                    "Directory '/a/node_modules' does not exist, skipping all lookups in it.",
                    "Directory '/node_modules' does not exist, skipping all lookups in it.",
                    "======== Module name 'lib' was not resolved. ========",
                    `Auto discovery for typings is enabled in project '${proj.getProjectName()}'. Running extra resolution pass for module 'lib' using cache location '/a/cache'.`,
                    "File '/a/cache/node_modules/lib.d.ts' does not exist.",
                    "File '/a/cache/node_modules/@types/lib/package.json' does not exist.",
                    "File '/a/cache/node_modules/@types/lib.d.ts' does not exist.",
                    "File '/a/cache/node_modules/@types/lib/index.d.ts' exist - use it as a name resolution result.",
                ]);
                checkProjectActualFiles(proj, [file1.path, lib.path]);
            });
        });
        describe("tsserverProjectSystem navigate-to for javascript project", () => {
            function containsNavToItem(items, itemName, itemKind) {
                return ts.find(items, item => item.name === itemName && item.kind === itemKind) !== undefined;
            }
            it("should not include type symbols", () => {
                const file1 = {
                    path: "/a/b/file1.js",
                    content: "function foo() {}"
                };
                const configFile = {
                    path: "/a/b/jsconfig.json",
                    content: "{}"
                };
                const host = projectSystem.createServerHost([file1, configFile, projectSystem.libFile]);
                const session = createSession(host);
                openFilesForSession([file1], session);
                // Try to find some interface type defined in lib.d.ts
                const libTypeNavToRequest = makeSessionRequest(CommandNames.Navto, { searchValue: "Document", file: file1.path, projectFileName: configFile.path });
                const items = session.executeCommand(libTypeNavToRequest).response;
                assert.isFalse(containsNavToItem(items, "Document", "interface"), `Found lib.d.ts symbol in JavaScript project nav to request result.`);
                const localFunctionNavToRequst = makeSessionRequest(CommandNames.Navto, { searchValue: "foo", file: file1.path, projectFileName: configFile.path });
                const items2 = session.executeCommand(localFunctionNavToRequst).response;
                assert.isTrue(containsNavToItem(items2, "foo", "function"), `Cannot find function symbol "foo".`);
            });
        });
        describe("tsserverProjectSystem external projects", () => {
            it("correctly handling add/remove tsconfig - 1", () => {
                const f1 = {
                    path: "/a/b/app.ts",
                    content: "let x = 1;"
                };
                const f2 = {
                    path: "/a/b/lib.ts",
                    content: ""
                };
                const tsconfig = {
                    path: "/a/b/tsconfig.json",
                    content: ""
                };
                const host = projectSystem.createServerHost([f1, f2]);
                const projectService = createProjectService(host);
                // open external project
                const projectName = "/a/b/proj1";
                projectService.openExternalProject({
                    projectFileName: projectName,
                    rootFiles: toExternalFiles([f1.path, f2.path]),
                    options: {}
                });
                projectService.openClientFile(f1.path);
                projectService.checkNumberOfProjects({ externalProjects: 1 });
                checkProjectActualFiles(projectService.externalProjects[0], [f1.path, f2.path]);
                // rename lib.ts to tsconfig.json
                host.reloadFS([f1, tsconfig]);
                projectService.openExternalProject({
                    projectFileName: projectName,
                    rootFiles: toExternalFiles([f1.path, tsconfig.path]),
                    options: {}
                });
                projectService.checkNumberOfProjects({ configuredProjects: 1 });
                checkProjectActualFiles(configuredProjectAt(projectService, 0), [f1.path, tsconfig.path]);
                // rename tsconfig.json back to lib.ts
                host.reloadFS([f1, f2]);
                projectService.openExternalProject({
                    projectFileName: projectName,
                    rootFiles: toExternalFiles([f1.path, f2.path]),
                    options: {}
                });
                projectService.checkNumberOfProjects({ externalProjects: 1 });
                checkProjectActualFiles(projectService.externalProjects[0], [f1.path, f2.path]);
            });
            it("correctly handling add/remove tsconfig - 2", () => {
                const f1 = {
                    path: "/a/b/app.ts",
                    content: "let x = 1;"
                };
                const cLib = {
                    path: "/a/b/c/lib.ts",
                    content: ""
                };
                const cTsconfig = {
                    path: "/a/b/c/tsconfig.json",
                    content: "{}"
                };
                const dLib = {
                    path: "/a/b/d/lib.ts",
                    content: ""
                };
                const dTsconfig = {
                    path: "/a/b/d/tsconfig.json",
                    content: "{}"
                };
                const host = projectSystem.createServerHost([f1, cLib, cTsconfig, dLib, dTsconfig]);
                const projectService = createProjectService(host);
                // open external project
                const projectName = "/a/b/proj1";
                projectService.openExternalProject({
                    projectFileName: projectName,
                    rootFiles: toExternalFiles([f1.path]),
                    options: {}
                });
                projectService.checkNumberOfProjects({ externalProjects: 1 });
                checkProjectActualFiles(projectService.externalProjects[0], [f1.path]);
                // add two config file as root files
                projectService.openExternalProject({
                    projectFileName: projectName,
                    rootFiles: toExternalFiles([f1.path, cTsconfig.path, dTsconfig.path]),
                    options: {}
                });
                projectService.checkNumberOfProjects({ configuredProjects: 2 });
                checkProjectActualFiles(configuredProjectAt(projectService, 0), [cLib.path, cTsconfig.path]);
                checkProjectActualFiles(configuredProjectAt(projectService, 1), [dLib.path, dTsconfig.path]);
                // remove one config file
                projectService.openExternalProject({
                    projectFileName: projectName,
                    rootFiles: toExternalFiles([f1.path, dTsconfig.path]),
                    options: {}
                });
                projectService.checkNumberOfProjects({ configuredProjects: 1 });
                checkProjectActualFiles(configuredProjectAt(projectService, 0), [dLib.path, dTsconfig.path]);
                // remove second config file
                projectService.openExternalProject({
                    projectFileName: projectName,
                    rootFiles: toExternalFiles([f1.path]),
                    options: {}
                });
                projectService.checkNumberOfProjects({ externalProjects: 1 });
                checkProjectActualFiles(projectService.externalProjects[0], [f1.path]);
                // open two config files
                // add two config file as root files
                projectService.openExternalProject({
                    projectFileName: projectName,
                    rootFiles: toExternalFiles([f1.path, cTsconfig.path, dTsconfig.path]),
                    options: {}
                });
                projectService.checkNumberOfProjects({ configuredProjects: 2 });
                checkProjectActualFiles(configuredProjectAt(projectService, 0), [cLib.path, cTsconfig.path]);
                checkProjectActualFiles(configuredProjectAt(projectService, 1), [dLib.path, dTsconfig.path]);
                // close all projects - no projects should be opened
                projectService.closeExternalProject(projectName);
                projectService.checkNumberOfProjects({});
            });
            it("correctly handles changes in lib section of config file", () => {
                const libES5 = {
                    path: "/compiler/lib.es5.d.ts",
                    content: "declare const eval: any"
                };
                const libES2015Promise = {
                    path: "/compiler/lib.es2015.promise.d.ts",
                    content: "declare class Promise<T> {}"
                };
                const app = {
                    path: "/src/app.ts",
                    content: "var x: Promise<string>;"
                };
                const config1 = {
                    path: "/src/tsconfig.json",
                    content: JSON.stringify({
                        compilerOptions: {
                            module: "commonjs",
                            target: "es5",
                            noImplicitAny: true,
                            sourceMap: false,
                            lib: [
                                "es5"
                            ]
                        }
                    })
                };
                const config2 = {
                    path: config1.path,
                    content: JSON.stringify({
                        compilerOptions: {
                            module: "commonjs",
                            target: "es5",
                            noImplicitAny: true,
                            sourceMap: false,
                            lib: [
                                "es5",
                                "es2015.promise"
                            ]
                        }
                    })
                };
                const host = projectSystem.createServerHost([libES5, libES2015Promise, app, config1], { executingFilePath: "/compiler/tsc.js" });
                const projectService = createProjectService(host);
                projectService.openClientFile(app.path);
                projectService.checkNumberOfProjects({ configuredProjects: 1 });
                checkProjectActualFiles(configuredProjectAt(projectService, 0), [libES5.path, app.path, config1.path]);
                host.reloadFS([libES5, libES2015Promise, app, config2]);
                host.checkTimeoutQueueLengthAndRun(2);
                projectService.checkNumberOfProjects({ configuredProjects: 1 });
                checkProjectActualFiles(configuredProjectAt(projectService, 0), [libES5.path, libES2015Promise.path, app.path, config2.path]);
            });
            it("should handle non-existing directories in config file", () => {
                const f = {
                    path: "/a/src/app.ts",
                    content: "let x = 1;"
                };
                const config = {
                    path: "/a/tsconfig.json",
                    content: JSON.stringify({
                        compilerOptions: {},
                        include: [
                            "src/**/*",
                            "notexistingfolder/*"
                        ]
                    })
                };
                const host = projectSystem.createServerHost([f, config]);
                const projectService = createProjectService(host);
                projectService.openClientFile(f.path);
                projectService.checkNumberOfProjects({ configuredProjects: 1 });
                const project = projectService.configuredProjects.get(config.path);
                assert.isTrue(project.hasOpenRef()); // f
                projectService.closeClientFile(f.path);
                projectService.checkNumberOfProjects({ configuredProjects: 1 });
                assert.strictEqual(projectService.configuredProjects.get(config.path), project);
                assert.isFalse(project.hasOpenRef()); // No files
                assert.isFalse(project.isClosed());
                projectService.openClientFile(f.path);
                projectService.checkNumberOfProjects({ configuredProjects: 1 });
                assert.strictEqual(projectService.configuredProjects.get(config.path), project);
                assert.isTrue(project.hasOpenRef()); // f
                assert.isFalse(project.isClosed());
            });
        });
        describe("tsserverProjectSystem prefer typings to js", () => {
            it("during second resolution pass", () => {
                const typingsCacheLocation = "/a/typings";
                const f1 = {
                    path: "/a/b/app.js",
                    content: "var x = require('bar')"
                };
                const barjs = {
                    path: "/a/b/node_modules/bar/index.js",
                    content: "export let x = 1"
                };
                const barTypings = {
                    path: `${typingsCacheLocation}/node_modules/@types/bar/index.d.ts`,
                    content: "export let y: number"
                };
                const config = {
                    path: "/a/b/jsconfig.json",
                    content: JSON.stringify({ compilerOptions: { allowJs: true }, exclude: ["node_modules"] })
                };
                const host = projectSystem.createServerHost([f1, barjs, barTypings, config]);
                const projectService = createProjectService(host, { typingsInstaller: new TestTypingsInstaller(typingsCacheLocation, /*throttleLimit*/ 5, host) });
                projectService.openClientFile(f1.path);
                projectService.checkNumberOfProjects({ configuredProjects: 1 });
                checkProjectActualFiles(configuredProjectAt(projectService, 0), [f1.path, barTypings.path, config.path]);
            });
        });
        describe("tsserverProjectSystem format settings", () => {
            it("can be set globally", () => {
                const f1 = {
                    path: "/a/b/app.ts",
                    content: "let x;"
                };
                const host = projectSystem.createServerHost([f1]);
                const projectService = createProjectService(host);
                projectService.openClientFile(f1.path);
                const defaultSettings = projectService.getFormatCodeOptions(f1.path);
                // set global settings
                const newGlobalSettings1 = ts.clone(defaultSettings);
                newGlobalSettings1.placeOpenBraceOnNewLineForControlBlocks = !newGlobalSettings1.placeOpenBraceOnNewLineForControlBlocks;
                projectService.setHostConfiguration({ formatOptions: newGlobalSettings1 });
                // get format options for file - should be equal to new global settings
                const s1 = projectService.getFormatCodeOptions(ts.server.toNormalizedPath(f1.path));
                assert.deepEqual(s1, newGlobalSettings1, "file settings should be the same with global settings");
                // set per file format options
                const newPerFileSettings = ts.clone(defaultSettings);
                newPerFileSettings.insertSpaceAfterCommaDelimiter = !newPerFileSettings.insertSpaceAfterCommaDelimiter;
                projectService.setHostConfiguration({ formatOptions: newPerFileSettings, file: f1.path });
                // get format options for file - should be equal to new per-file settings
                const s2 = projectService.getFormatCodeOptions(ts.server.toNormalizedPath(f1.path));
                assert.deepEqual(s2, newPerFileSettings, "file settings should be the same with per-file settings");
                // set new global settings - they should not affect ones that were set per-file
                const newGlobalSettings2 = ts.clone(defaultSettings);
                newGlobalSettings2.insertSpaceAfterSemicolonInForStatements = !newGlobalSettings2.insertSpaceAfterSemicolonInForStatements;
                projectService.setHostConfiguration({ formatOptions: newGlobalSettings2 });
                // get format options for file - should be equal to new per-file settings
                const s3 = projectService.getFormatCodeOptions(ts.server.toNormalizedPath(f1.path));
                assert.deepEqual(s3, newPerFileSettings, "file settings should still be the same with per-file settings");
            });
        });
        describe("tsserverProjectSystem watching @types", () => {
            it("works correctly when typings are added or removed", () => {
                const f1 = {
                    path: "/a/b/app.ts",
                    content: "let x = 1;"
                };
                const t1 = {
                    path: "/a/b/node_modules/@types/lib1/index.d.ts",
                    content: "export let a: number"
                };
                const t2 = {
                    path: "/a/b/node_modules/@types/lib2/index.d.ts",
                    content: "export let b: number"
                };
                const tsconfig = {
                    path: "/a/b/tsconfig.json",
                    content: JSON.stringify({
                        compilerOptions: {},
                        exclude: ["node_modules"]
                    })
                };
                const host = projectSystem.createServerHost([f1, t1, tsconfig]);
                const projectService = createProjectService(host);
                projectService.openClientFile(f1.path);
                projectService.checkNumberOfProjects({ configuredProjects: 1 });
                checkProjectActualFiles(configuredProjectAt(projectService, 0), [f1.path, t1.path, tsconfig.path]);
                // delete t1
                host.reloadFS([f1, tsconfig]);
                // run throttled operation
                host.runQueuedTimeoutCallbacks();
                projectService.checkNumberOfProjects({ configuredProjects: 1 });
                checkProjectActualFiles(configuredProjectAt(projectService, 0), [f1.path, tsconfig.path]);
                // create t2
                host.reloadFS([f1, tsconfig, t2]);
                // run throttled operation
                host.runQueuedTimeoutCallbacks();
                projectService.checkNumberOfProjects({ configuredProjects: 1 });
                checkProjectActualFiles(configuredProjectAt(projectService, 0), [f1.path, t2.path, tsconfig.path]);
            });
        });
        describe("tsserverProjectSystem Open-file", () => {
            it("can be reloaded with empty content", () => {
                const f = {
                    path: "/a/b/app.ts",
                    content: "let x = 1"
                };
                const projectFileName = "externalProject";
                const host = projectSystem.createServerHost([f]);
                const projectService = createProjectService(host);
                // create a project
                projectService.openExternalProject({ projectFileName, rootFiles: [toExternalFile(f.path)], options: {} });
                projectService.checkNumberOfProjects({ externalProjects: 1 });
                const p = projectService.externalProjects[0];
                // force to load the content of the file
                p.updateGraph();
                const scriptInfo = p.getScriptInfo(f.path);
                checkSnapLength(scriptInfo.getSnapshot(), f.content.length);
                // open project and replace its content with empty string
                projectService.openClientFile(f.path, "");
                checkSnapLength(scriptInfo.getSnapshot(), 0);
            });
            function checkSnapLength(snap, expectedLength) {
                assert.equal(snap.getLength(), expectedLength, "Incorrect snapshot size");
            }
            function verifyOpenFileWorks(useCaseSensitiveFileNames) {
                const file1 = {
                    path: "/a/b/src/app.ts",
                    content: "let x = 10;"
                };
                const file2 = {
                    path: "/a/B/lib/module2.ts",
                    content: "let z = 10;"
                };
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: ""
                };
                const configFile2 = {
                    path: "/a/tsconfig.json",
                    content: ""
                };
                const host = projectSystem.createServerHost([file1, file2, configFile, configFile2], {
                    useCaseSensitiveFileNames
                });
                const service = createProjectService(host);
                // Open file1 -> configFile
                verifyConfigFileName(file1, "/a", configFile);
                verifyConfigFileName(file1, "/a/b", configFile);
                verifyConfigFileName(file1, "/a/B", useCaseSensitiveFileNames ? undefined : configFile);
                // Open file2 use root "/a/b"
                verifyConfigFileName(file2, "/a", useCaseSensitiveFileNames ? configFile2 : configFile);
                verifyConfigFileName(file2, "/a/b", useCaseSensitiveFileNames ? undefined : configFile);
                verifyConfigFileName(file2, "/a/B", useCaseSensitiveFileNames ? undefined : configFile);
                function verifyConfigFileName(file, projectRoot, expectedConfigFile) {
                    const { configFileName } = service.openClientFile(file.path, /*fileContent*/ undefined, /*scriptKind*/ undefined, projectRoot);
                    assert.equal(configFileName, expectedConfigFile && expectedConfigFile.path);
                    service.closeClientFile(file.path);
                }
            }
            it("works when project root is used with case-sensitive system", () => {
                verifyOpenFileWorks(/*useCaseSensitiveFileNames*/ true);
            });
            it("works when project root is used with case-insensitive system", () => {
                verifyOpenFileWorks(/*useCaseSensitiveFileNames*/ false);
            });
            it("uses existing project even if project refresh is pending", () => {
                const projectFolder = "/user/someuser/projects/myproject";
                const aFile = {
                    path: `${projectFolder}/src/a.ts`,
                    content: "export const x = 0;"
                };
                const configFile = {
                    path: `${projectFolder}/tsconfig.json`,
                    content: "{}"
                };
                const files = [aFile, configFile, projectSystem.libFile];
                const host = projectSystem.createServerHost(files);
                const service = createProjectService(host);
                service.openClientFile(aFile.path, /*fileContent*/ undefined, ts.ScriptKind.TS, projectFolder);
                verifyProject();
                const bFile = {
                    path: `${projectFolder}/src/b.ts`,
                    content: `export {}; declare module "./a" {  export const y: number; }`
                };
                files.push(bFile);
                host.reloadFS(files);
                service.openClientFile(bFile.path, /*fileContent*/ undefined, ts.ScriptKind.TS, projectFolder);
                verifyProject();
                function verifyProject() {
                    assert.isDefined(service.configuredProjects.get(configFile.path));
                    const project = service.configuredProjects.get(configFile.path);
                    checkProjectActualFiles(project, files.map(f => f.path));
                }
            });
        });
        describe("tsserverProjectSystem Language service", () => {
            it("should work correctly on case-sensitive file systems", () => {
                const lib = {
                    path: "/a/Lib/lib.d.ts",
                    content: "let x: number"
                };
                const f = {
                    path: "/a/b/app.ts",
                    content: "let x = 1;"
                };
                const host = projectSystem.createServerHost([lib, f], { executingFilePath: "/a/Lib/tsc.js", useCaseSensitiveFileNames: true });
                const projectService = createProjectService(host);
                projectService.openClientFile(f.path);
                projectService.checkNumberOfProjects({ inferredProjects: 1 });
                projectService.inferredProjects[0].getLanguageService().getProgram();
            });
        });
        describe("tsserverProjectSystem rename a module file and rename back", () => {
            it("should restore the states for inferred projects", () => {
                const moduleFile = {
                    path: "/a/b/moduleFile.ts",
                    content: "export function bar() { };"
                };
                const file1 = {
                    path: "/a/b/file1.ts",
                    content: "import * as T from './moduleFile'; T.bar();"
                };
                const host = projectSystem.createServerHost([moduleFile, file1]);
                const session = createSession(host);
                openFilesForSession([file1], session);
                const getErrRequest = makeSessionRequest(ts.server.CommandNames.SemanticDiagnosticsSync, { file: file1.path });
                let diags = session.executeCommand(getErrRequest).response;
                verifyNoDiagnostics(diags);
                const moduleFileOldPath = moduleFile.path;
                const moduleFileNewPath = "/a/b/moduleFile1.ts";
                moduleFile.path = moduleFileNewPath;
                host.reloadFS([moduleFile, file1]);
                host.runQueuedTimeoutCallbacks();
                diags = session.executeCommand(getErrRequest).response;
                verifyDiagnostics(diags, [
                    { diagnosticMessage: Diagnostics.Cannot_find_module_0, errorTextArguments: ["./moduleFile"] }
                ]);
                assert.equal(diags.length, 1);
                moduleFile.path = moduleFileOldPath;
                host.reloadFS([moduleFile, file1]);
                host.runQueuedTimeoutCallbacks();
                // Make a change to trigger the program rebuild
                const changeRequest = makeSessionRequest(ts.server.CommandNames.Change, { file: file1.path, line: 1, offset: 44, endLine: 1, endOffset: 44, insertString: "\n" });
                session.executeCommand(changeRequest);
                host.runQueuedTimeoutCallbacks();
                diags = session.executeCommand(getErrRequest).response;
                verifyNoDiagnostics(diags);
            });
            it("should restore the states for configured projects", () => {
                const moduleFile = {
                    path: "/a/b/moduleFile.ts",
                    content: "export function bar() { };"
                };
                const file1 = {
                    path: "/a/b/file1.ts",
                    content: "import * as T from './moduleFile'; T.bar();"
                };
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: `{}`
                };
                const host = projectSystem.createServerHost([moduleFile, file1, configFile]);
                const session = createSession(host);
                openFilesForSession([file1], session);
                const getErrRequest = makeSessionRequest(ts.server.CommandNames.SemanticDiagnosticsSync, { file: file1.path });
                let diags = session.executeCommand(getErrRequest).response;
                verifyNoDiagnostics(diags);
                const moduleFileOldPath = moduleFile.path;
                const moduleFileNewPath = "/a/b/moduleFile1.ts";
                moduleFile.path = moduleFileNewPath;
                host.reloadFS([moduleFile, file1, configFile]);
                host.runQueuedTimeoutCallbacks();
                diags = session.executeCommand(getErrRequest).response;
                verifyDiagnostics(diags, [
                    { diagnosticMessage: Diagnostics.Cannot_find_module_0, errorTextArguments: ["./moduleFile"] }
                ]);
                moduleFile.path = moduleFileOldPath;
                host.reloadFS([moduleFile, file1, configFile]);
                host.runQueuedTimeoutCallbacks();
                diags = session.executeCommand(getErrRequest).response;
                verifyNoDiagnostics(diags);
            });
            it("should property handle missing config files", () => {
                const f1 = {
                    path: "/a/b/app.ts",
                    content: "let x = 1"
                };
                const config = {
                    path: "/a/b/tsconfig.json",
                    content: "{}"
                };
                const projectName = "project1";
                const host = projectSystem.createServerHost([f1]);
                const projectService = createProjectService(host);
                projectService.openExternalProject({ rootFiles: toExternalFiles([f1.path, config.path]), options: {}, projectFileName: projectName });
                // should have one external project since config file is missing
                projectService.checkNumberOfProjects({ externalProjects: 1 });
                host.reloadFS([f1, config]);
                projectService.openExternalProject({ rootFiles: toExternalFiles([f1.path, config.path]), options: {}, projectFileName: projectName });
                projectService.checkNumberOfProjects({ configuredProjects: 1 });
            });
            it("types should load from config file path if config exists", () => {
                const f1 = {
                    path: "/a/b/app.ts",
                    content: "let x = 1"
                };
                const config = {
                    path: "/a/b/tsconfig.json",
                    content: JSON.stringify({ compilerOptions: { types: ["node"], typeRoots: [] } })
                };
                const node = {
                    path: "/a/b/node_modules/@types/node/index.d.ts",
                    content: "declare var process: any"
                };
                const cwd = {
                    path: "/a/c"
                };
                const host = projectSystem.createServerHost([f1, config, node, cwd], { currentDirectory: cwd.path });
                const projectService = createProjectService(host);
                projectService.openClientFile(f1.path);
                projectService.checkNumberOfProjects({ configuredProjects: 1 });
                checkProjectActualFiles(configuredProjectAt(projectService, 0), [f1.path, node.path, config.path]);
            });
        });
        describe("tsserverProjectSystem add the missing module file for inferred project", () => {
            it("should remove the `module not found` error", () => {
                const moduleFile = {
                    path: "/a/b/moduleFile.ts",
                    content: "export function bar() { };"
                };
                const file1 = {
                    path: "/a/b/file1.ts",
                    content: "import * as T from './moduleFile'; T.bar();"
                };
                const host = projectSystem.createServerHost([file1]);
                const session = createSession(host);
                openFilesForSession([file1], session);
                const getErrRequest = makeSessionRequest(ts.server.CommandNames.SemanticDiagnosticsSync, { file: file1.path });
                let diags = session.executeCommand(getErrRequest).response;
                verifyDiagnostics(diags, [
                    { diagnosticMessage: Diagnostics.Cannot_find_module_0, errorTextArguments: ["./moduleFile"] }
                ]);
                host.reloadFS([file1, moduleFile]);
                host.runQueuedTimeoutCallbacks();
                // Make a change to trigger the program rebuild
                const changeRequest = makeSessionRequest(ts.server.CommandNames.Change, { file: file1.path, line: 1, offset: 44, endLine: 1, endOffset: 44, insertString: "\n" });
                session.executeCommand(changeRequest);
                // Recheck
                diags = session.executeCommand(getErrRequest).response;
                verifyNoDiagnostics(diags);
            });
            it("npm install @types works", () => {
                const folderPath = "/a/b/projects/temp";
                const file1 = {
                    path: `${folderPath}/a.ts`,
                    content: 'import f = require("pad"); f;'
                };
                const files = [file1, projectSystem.libFile];
                const host = projectSystem.createServerHost(files);
                const session = createSession(host, { canUseEvents: true });
                const service = session.getProjectService();
                session.executeCommandSeq({
                    command: ts.server.CommandNames.Open,
                    arguments: {
                        file: file1.path,
                        fileContent: file1.content,
                        scriptKindName: "TS",
                        projectRootPath: folderPath
                    }
                });
                checkNumberOfProjects(service, { inferredProjects: 1 });
                session.clearMessages();
                const expectedSequenceId = session.getNextSeq();
                session.executeCommandSeq({
                    command: ts.server.CommandNames.Geterr,
                    arguments: {
                        delay: 0,
                        files: [file1.path]
                    }
                });
                host.checkTimeoutQueueLengthAndRun(1);
                checkErrorMessage(session, "syntaxDiag", { file: file1.path, diagnostics: [] });
                session.clearMessages();
                host.runQueuedImmediateCallbacks();
                const startOffset = file1.content.indexOf('"') + 1;
                checkErrorMessage(session, "semanticDiag", {
                    file: file1.path,
                    diagnostics: [
                        createDiagnostic({ line: 1, offset: startOffset }, { line: 1, offset: startOffset + '"pad"'.length }, Diagnostics.Cannot_find_module_0, ["pad"])
                    ],
                });
                session.clearMessages();
                host.runQueuedImmediateCallbacks(1);
                checkErrorMessage(session, "suggestionDiag", { file: file1.path, diagnostics: [] });
                checkCompleteEvent(session, 2, expectedSequenceId);
                session.clearMessages();
                const padIndex = {
                    path: `${folderPath}/node_modules/@types/pad/index.d.ts`,
                    content: "export = pad;declare function pad(length: number, text: string, char ?: string): string;"
                };
                files.push(padIndex);
                host.reloadFS(files, { ignoreWatchInvokedWithTriggerAsFileCreate: true });
                host.runQueuedTimeoutCallbacks();
                checkProjectUpdatedInBackgroundEvent(session, [file1.path]);
                session.clearMessages();
                host.runQueuedTimeoutCallbacks();
                checkErrorMessage(session, "syntaxDiag", { file: file1.path, diagnostics: [] });
                session.clearMessages();
                host.runQueuedImmediateCallbacks();
                checkErrorMessage(session, "semanticDiag", { file: file1.path, diagnostics: [] });
            });
            it("suggestion diagnostics", () => {
                const file = {
                    path: "/a.js",
                    content: "function f(p) {}",
                };
                const host = projectSystem.createServerHost([file]);
                const session = createSession(host, { canUseEvents: true });
                const service = session.getProjectService();
                session.executeCommandSeq({
                    command: ts.server.CommandNames.Open,
                    arguments: { file: file.path, fileContent: file.content },
                });
                checkNumberOfProjects(service, { inferredProjects: 1 });
                session.clearMessages();
                const expectedSequenceId = session.getNextSeq();
                host.checkTimeoutQueueLengthAndRun(2);
                checkProjectUpdatedInBackgroundEvent(session, [file.path]);
                session.clearMessages();
                session.executeCommandSeq({
                    command: ts.server.CommandNames.Geterr,
                    arguments: {
                        delay: 0,
                        files: [file.path],
                    }
                });
                host.checkTimeoutQueueLengthAndRun(1);
                checkErrorMessage(session, "syntaxDiag", { file: file.path, diagnostics: [] }, /*isMostRecent*/ true);
                session.clearMessages();
                host.runQueuedImmediateCallbacks(1);
                checkErrorMessage(session, "semanticDiag", { file: file.path, diagnostics: [] });
                session.clearMessages();
                host.runQueuedImmediateCallbacks(1);
                checkErrorMessage(session, "suggestionDiag", {
                    file: file.path,
                    diagnostics: [
                        createDiagnostic({ line: 1, offset: 12 }, { line: 1, offset: 13 }, Diagnostics._0_is_declared_but_its_value_is_never_read, ["p"], "suggestion", /*reportsUnnecssary*/ true)
                    ],
                });
                checkCompleteEvent(session, 2, expectedSequenceId);
                session.clearMessages();
            });
            it("disable suggestion diagnostics", () => {
                const file = {
                    path: "/a.js",
                    content: 'require("b")',
                };
                const host = projectSystem.createServerHost([file]);
                const session = createSession(host, { canUseEvents: true });
                const service = session.getProjectService();
                session.executeCommandSeq({
                    command: ts.server.CommandNames.Open,
                    arguments: { file: file.path, fileContent: file.content },
                });
                session.executeCommandSeq({
                    command: ts.server.CommandNames.Configure,
                    arguments: {
                        preferences: { disableSuggestions: true }
                    },
                });
                checkNumberOfProjects(service, { inferredProjects: 1 });
                session.clearMessages();
                const expectedSequenceId = session.getNextSeq();
                host.checkTimeoutQueueLengthAndRun(2);
                checkProjectUpdatedInBackgroundEvent(session, [file.path]);
                session.clearMessages();
                session.executeCommandSeq({
                    command: ts.server.CommandNames.Geterr,
                    arguments: {
                        delay: 0,
                        files: [file.path],
                    }
                });
                host.checkTimeoutQueueLengthAndRun(1);
                checkErrorMessage(session, "syntaxDiag", { file: file.path, diagnostics: [] }, /*isMostRecent*/ true);
                session.clearMessages();
                host.runQueuedImmediateCallbacks(1);
                checkErrorMessage(session, "semanticDiag", { file: file.path, diagnostics: [] });
                // No suggestion event, we're done.
                checkCompleteEvent(session, 2, expectedSequenceId);
                session.clearMessages();
            });
            it("suppressed diagnostic events", () => {
                const file = {
                    path: "/a.ts",
                    content: "1 = 2;",
                };
                const host = projectSystem.createServerHost([file]);
                const session = createSession(host, { canUseEvents: true, suppressDiagnosticEvents: true });
                const service = session.getProjectService();
                session.executeCommandSeq({
                    command: ts.server.CommandNames.Open,
                    arguments: { file: file.path, fileContent: file.content },
                });
                checkNumberOfProjects(service, { inferredProjects: 1 });
                host.checkTimeoutQueueLength(0);
                checkNoDiagnosticEvents(session);
                session.clearMessages();
                let expectedSequenceId = session.getNextSeq();
                session.executeCommandSeq({
                    command: ts.server.CommandNames.Geterr,
                    arguments: {
                        delay: 0,
                        files: [file.path],
                    }
                });
                host.checkTimeoutQueueLength(0);
                checkNoDiagnosticEvents(session);
                checkCompleteEvent(session, 1, expectedSequenceId);
                session.clearMessages();
                expectedSequenceId = session.getNextSeq();
                session.executeCommandSeq({
                    command: ts.server.CommandNames.Geterr,
                    arguments: {
                        delay: 0,
                        file: file.path,
                    }
                });
                host.checkTimeoutQueueLength(0);
                checkNoDiagnosticEvents(session);
                checkCompleteEvent(session, 1, expectedSequenceId);
                session.clearMessages();
            });
            function createDiagnostic(start, end, message, args = [], category = ts.diagnosticCategoryName(message), reportsUnnecessary) {
                return { start, end, text: ts.formatStringFromArgs(message.message, args), code: message.code, category, reportsUnnecessary, source: undefined };
            }
        });
        describe("tsserverProjectSystem Configure file diagnostics events", () => {
            it("are generated when the config file has errors", () => {
                const file = {
                    path: "/a/b/app.ts",
                    content: "let x = 10"
                };
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: `{
                    "compilerOptions": {
                        "foo": "bar",
                        "allowJS": true
                    }
                }`
                };
                const serverEventManager = new TestServerEventManager([file, configFile]);
                openFilesForSession([file], serverEventManager.session);
                serverEventManager.checkSingleConfigFileDiagEvent(configFile.path, file.path);
            });
            it("are generated when the config file doesn't have errors", () => {
                const file = {
                    path: "/a/b/app.ts",
                    content: "let x = 10"
                };
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: `{
                    "compilerOptions": {}
                }`
                };
                const serverEventManager = new TestServerEventManager([file, configFile]);
                openFilesForSession([file], serverEventManager.session);
                serverEventManager.checkSingleConfigFileDiagEvent(configFile.path, file.path);
            });
            it("are generated when the config file changes", () => {
                const file = {
                    path: "/a/b/app.ts",
                    content: "let x = 10"
                };
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: `{
                    "compilerOptions": {}
                }`
                };
                const serverEventManager = new TestServerEventManager([file, configFile]);
                openFilesForSession([file], serverEventManager.session);
                serverEventManager.checkSingleConfigFileDiagEvent(configFile.path, file.path);
                configFile.content = `{
                "compilerOptions": {
                    "haha": 123
                }
            }`;
                serverEventManager.host.reloadFS([file, configFile]);
                serverEventManager.host.runQueuedTimeoutCallbacks();
                serverEventManager.checkSingleConfigFileDiagEvent(configFile.path, configFile.path);
                configFile.content = `{
                "compilerOptions": {}
            }`;
                serverEventManager.host.reloadFS([file, configFile]);
                serverEventManager.host.runQueuedTimeoutCallbacks();
                serverEventManager.checkSingleConfigFileDiagEvent(configFile.path, configFile.path);
            });
            it("are not generated when the config file does not include file opened and config file has errors", () => {
                const file = {
                    path: "/a/b/app.ts",
                    content: "let x = 10"
                };
                const file2 = {
                    path: "/a/b/test.ts",
                    content: "let x = 10"
                };
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: `{
                    "compilerOptions": {
                        "foo": "bar",
                        "allowJS": true
                    },
                    "files": ["app.ts"]
                }`
                };
                const serverEventManager = new TestServerEventManager([file, file2, projectSystem.libFile, configFile]);
                openFilesForSession([file2], serverEventManager.session);
                serverEventManager.hasZeroEvent("configFileDiag");
            });
            it("are not generated when the config file has errors but suppressDiagnosticEvents is true", () => {
                const file = {
                    path: "/a/b/app.ts",
                    content: "let x = 10"
                };
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: `{
                    "compilerOptions": {
                        "foo": "bar",
                        "allowJS": true
                    }
                }`
                };
                const serverEventManager = new TestServerEventManager([file, configFile], /*suppressDiagnosticEvents*/ true);
                openFilesForSession([file], serverEventManager.session);
                serverEventManager.hasZeroEvent("configFileDiag");
            });
            it("are not generated when the config file does not include file opened and doesnt contain any errors", () => {
                const file = {
                    path: "/a/b/app.ts",
                    content: "let x = 10"
                };
                const file2 = {
                    path: "/a/b/test.ts",
                    content: "let x = 10"
                };
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: `{
                    "files": ["app.ts"]
                }`
                };
                const serverEventManager = new TestServerEventManager([file, file2, projectSystem.libFile, configFile]);
                openFilesForSession([file2], serverEventManager.session);
                serverEventManager.hasZeroEvent("configFileDiag");
            });
        });
        describe("tsserverProjectSystem skipLibCheck", () => {
            it("should be turned on for js-only inferred projects", () => {
                const file1 = {
                    path: "/a/b/file1.js",
                    content: `
                /// <reference path="file2.d.ts" />
                var x = 1;`
                };
                const file2 = {
                    path: "/a/b/file2.d.ts",
                    content: `
                interface T {
                    name: string;
                };
                interface T {
                    name: number;
                };`
                };
                const host = projectSystem.createServerHost([file1, file2]);
                const session = createSession(host);
                openFilesForSession([file1, file2], session);
                const file2GetErrRequest = makeSessionRequest(CommandNames.SemanticDiagnosticsSync, { file: file2.path });
                let errorResult = session.executeCommand(file2GetErrRequest).response;
                assert.isTrue(errorResult.length === 0);
                const closeFileRequest = makeSessionRequest(CommandNames.Close, { file: file1.path });
                session.executeCommand(closeFileRequest);
                errorResult = session.executeCommand(file2GetErrRequest).response;
                assert.isTrue(errorResult.length !== 0);
                openFilesForSession([file1], session);
                errorResult = session.executeCommand(file2GetErrRequest).response;
                assert.isTrue(errorResult.length === 0);
            });
            it("should be turned on for js-only external projects", () => {
                const jsFile = {
                    path: "/a/b/file1.js",
                    content: "let x =1;"
                };
                const dTsFile = {
                    path: "/a/b/file2.d.ts",
                    content: `
                interface T {
                    name: string;
                };
                interface T {
                    name: number;
                };`
                };
                const host = projectSystem.createServerHost([jsFile, dTsFile]);
                const session = createSession(host);
                const openExternalProjectRequest = makeSessionRequest(CommandNames.OpenExternalProject, {
                    projectFileName: "project1",
                    rootFiles: toExternalFiles([jsFile.path, dTsFile.path]),
                    options: {}
                });
                session.executeCommand(openExternalProjectRequest);
                const dTsFileGetErrRequest = makeSessionRequest(CommandNames.SemanticDiagnosticsSync, { file: dTsFile.path });
                const errorResult = session.executeCommand(dTsFileGetErrRequest).response;
                assert.isTrue(errorResult.length === 0);
            });
            it("should be turned on for js-only external projects with skipLibCheck=false", () => {
                const jsFile = {
                    path: "/a/b/file1.js",
                    content: "let x =1;"
                };
                const dTsFile = {
                    path: "/a/b/file2.d.ts",
                    content: `
                interface T {
                    name: string;
                };
                interface T {
                    name: number;
                };`
                };
                const host = projectSystem.createServerHost([jsFile, dTsFile]);
                const session = createSession(host);
                const openExternalProjectRequest = makeSessionRequest(CommandNames.OpenExternalProject, {
                    projectFileName: "project1",
                    rootFiles: toExternalFiles([jsFile.path, dTsFile.path]),
                    options: { skipLibCheck: false }
                });
                session.executeCommand(openExternalProjectRequest);
                const dTsFileGetErrRequest = makeSessionRequest(CommandNames.SemanticDiagnosticsSync, { file: dTsFile.path });
                const errorResult = session.executeCommand(dTsFileGetErrRequest).response;
                assert.isTrue(errorResult.length === 0);
            });
            it("should not report bind errors for declaration files with skipLibCheck=true", () => {
                const jsconfigFile = {
                    path: "/a/jsconfig.json",
                    content: "{}"
                };
                const jsFile = {
                    path: "/a/jsFile.js",
                    content: "let x = 1;"
                };
                const dTsFile1 = {
                    path: "/a/dTsFile1.d.ts",
                    content: `
                declare var x: number;`
                };
                const dTsFile2 = {
                    path: "/a/dTsFile2.d.ts",
                    content: `
                declare var x: string;`
                };
                const host = projectSystem.createServerHost([jsconfigFile, jsFile, dTsFile1, dTsFile2]);
                const session = createSession(host);
                openFilesForSession([jsFile], session);
                const dTsFile1GetErrRequest = makeSessionRequest(CommandNames.SemanticDiagnosticsSync, { file: dTsFile1.path });
                const error1Result = session.executeCommand(dTsFile1GetErrRequest).response;
                assert.isTrue(error1Result.length === 0);
                const dTsFile2GetErrRequest = makeSessionRequest(CommandNames.SemanticDiagnosticsSync, { file: dTsFile2.path });
                const error2Result = session.executeCommand(dTsFile2GetErrRequest).response;
                assert.isTrue(error2Result.length === 0);
            });
            it("should report semanitc errors for loose JS files with '// @ts-check' and skipLibCheck=true", () => {
                const jsFile = {
                    path: "/a/jsFile.js",
                    content: `
                // @ts-check
                let x = 1;
                x === "string";`
                };
                const host = projectSystem.createServerHost([jsFile]);
                const session = createSession(host);
                openFilesForSession([jsFile], session);
                const getErrRequest = makeSessionRequest(CommandNames.SemanticDiagnosticsSync, { file: jsFile.path });
                const errorResult = session.executeCommand(getErrRequest).response;
                assert.isTrue(errorResult.length === 1);
                assert.equal(errorResult[0].code, Diagnostics.Operator_0_cannot_be_applied_to_types_1_and_2.code);
            });
            it("should report semanitc errors for configured js project with '// @ts-check' and skipLibCheck=true", () => {
                const jsconfigFile = {
                    path: "/a/jsconfig.json",
                    content: "{}"
                };
                const jsFile = {
                    path: "/a/jsFile.js",
                    content: `
                // @ts-check
                let x = 1;
                x === "string";`
                };
                const host = projectSystem.createServerHost([jsconfigFile, jsFile]);
                const session = createSession(host);
                openFilesForSession([jsFile], session);
                const getErrRequest = makeSessionRequest(CommandNames.SemanticDiagnosticsSync, { file: jsFile.path });
                const errorResult = session.executeCommand(getErrRequest).response;
                assert.isTrue(errorResult.length === 1);
                assert.equal(errorResult[0].code, Diagnostics.Operator_0_cannot_be_applied_to_types_1_and_2.code);
            });
            it("should report semanitc errors for configured js project with checkJs=true and skipLibCheck=true", () => {
                const jsconfigFile = {
                    path: "/a/jsconfig.json",
                    content: JSON.stringify({
                        compilerOptions: {
                            checkJs: true,
                            skipLibCheck: true
                        },
                    })
                };
                const jsFile = {
                    path: "/a/jsFile.js",
                    content: `let x = 1;
                x === "string";`
                };
                const host = projectSystem.createServerHost([jsconfigFile, jsFile]);
                const session = createSession(host);
                openFilesForSession([jsFile], session);
                const getErrRequest = makeSessionRequest(CommandNames.SemanticDiagnosticsSync, { file: jsFile.path });
                const errorResult = session.executeCommand(getErrRequest).response;
                assert.isTrue(errorResult.length === 1);
                assert.equal(errorResult[0].code, Diagnostics.Operator_0_cannot_be_applied_to_types_1_and_2.code);
            });
        });
        describe("tsserverProjectSystem non-existing directories listed in config file input array", () => {
            it("should be tolerated without crashing the server", () => {
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: `{
                    "compilerOptions": {},
                    "include": ["app/*", "test/**/*", "something"]
                }`
                };
                const file1 = {
                    path: "/a/b/file1.ts",
                    content: "let t = 10;"
                };
                const host = projectSystem.createServerHost([file1, configFile]);
                const projectService = createProjectService(host);
                projectService.openClientFile(file1.path);
                host.runQueuedTimeoutCallbacks();
                // Since there is no file open from configFile it would be closed
                checkNumberOfConfiguredProjects(projectService, 0);
                checkNumberOfInferredProjects(projectService, 1);
                const inferredProject = projectService.inferredProjects[0];
                assert.isTrue(inferredProject.containsFile(file1.path));
            });
            it("should be able to handle @types if input file list is empty", () => {
                const f = {
                    path: "/a/app.ts",
                    content: "let x = 1"
                };
                const config = {
                    path: "/a/tsconfig.json",
                    content: JSON.stringify({
                        compiler: {},
                        files: []
                    })
                };
                const t1 = {
                    path: "/a/node_modules/@types/typings/index.d.ts",
                    content: `export * from "./lib"`
                };
                const t2 = {
                    path: "/a/node_modules/@types/typings/lib.d.ts",
                    content: `export const x: number`
                };
                const host = projectSystem.createServerHost([f, config, t1, t2], { currentDirectory: ts.getDirectoryPath(f.path) });
                const projectService = createProjectService(host);
                projectService.openClientFile(f.path);
                // Since no file from the configured project is open, it would be closed immediately
                projectService.checkNumberOfProjects({ configuredProjects: 0, inferredProjects: 1 });
            });
            it("should tolerate invalid include files that start in subDirectory", () => {
                const projectFolder = "/user/username/projects/myproject";
                const f = {
                    path: `${projectFolder}/src/server/index.ts`,
                    content: "let x = 1"
                };
                const config = {
                    path: `${projectFolder}/src/server/tsconfig.json`,
                    content: JSON.stringify({
                        compiler: {
                            module: "commonjs",
                            outDir: "../../build"
                        },
                        include: [
                            "../src/**/*.ts"
                        ]
                    })
                };
                const host = projectSystem.createServerHost([f, config, projectSystem.libFile], { useCaseSensitiveFileNames: true });
                const projectService = createProjectService(host);
                projectService.openClientFile(f.path);
                // Since no file from the configured project is open, it would be closed immediately
                projectService.checkNumberOfProjects({ configuredProjects: 0, inferredProjects: 1 });
            });
        });
        describe("tsserverProjectSystem reload", () => {
            it("should work with temp file", () => {
                const f1 = {
                    path: "/a/b/app.ts",
                    content: "let x = 1"
                };
                const tmp = {
                    path: "/a/b/app.tmp",
                    content: "const y = 42"
                };
                const host = projectSystem.createServerHost([f1, tmp]);
                const session = createSession(host);
                // send open request
                session.executeCommand({
                    type: "request",
                    command: "open",
                    seq: 1,
                    arguments: { file: f1.path }
                });
                // reload from tmp file
                session.executeCommand({
                    type: "request",
                    command: "reload",
                    seq: 2,
                    arguments: { file: f1.path, tmpfile: tmp.path }
                });
                // verify content
                const projectServiice = session.getProjectService();
                const snap1 = projectServiice.getScriptInfo(f1.path).getSnapshot();
                assert.equal(ts.getSnapshotText(snap1), tmp.content, "content should be equal to the content of temp file");
                // reload from original file file
                session.executeCommand({
                    type: "request",
                    command: "reload",
                    seq: 2,
                    arguments: { file: f1.path }
                });
                // verify content
                const snap2 = projectServiice.getScriptInfo(f1.path).getSnapshot();
                assert.equal(ts.getSnapshotText(snap2), f1.content, "content should be equal to the content of original file");
            });
            it("should work when script info doesnt have any project open", () => {
                const f1 = {
                    path: "/a/b/app.ts",
                    content: "let x = 1"
                };
                const tmp = {
                    path: "/a/b/app.tmp",
                    content: "const y = 42"
                };
                const host = projectSystem.createServerHost([f1, tmp, projectSystem.libFile]);
                const session = createSession(host);
                const openContent = "let z = 1";
                // send open request
                session.executeCommandSeq({
                    command: "open" /* Open */,
                    arguments: { file: f1.path, fileContent: openContent }
                });
                const projectService = session.getProjectService();
                checkNumberOfProjects(projectService, { inferredProjects: 1 });
                const info = projectService.getScriptInfo(f1.path);
                assert.isDefined(info);
                checkScriptInfoContents(openContent, "contents set during open request");
                // send close request
                session.executeCommandSeq({
                    command: "close" /* Close */,
                    arguments: { file: f1.path }
                });
                checkScriptInfoAndProjects(0, f1.content, "contents of closed file");
                // Can reload contents of the file when its not open and has no project
                // reload from temp file
                session.executeCommandSeq({
                    command: "reload" /* Reload */,
                    arguments: { file: f1.path, tmpfile: tmp.path }
                });
                checkScriptInfoAndProjects(0, tmp.content, "contents of temp file");
                // reload from own file
                session.executeCommandSeq({
                    command: "reload" /* Reload */,
                    arguments: { file: f1.path }
                });
                checkScriptInfoAndProjects(0, f1.content, "contents of closed file");
                // Open file again without setting its content
                session.executeCommandSeq({
                    command: "open" /* Open */,
                    arguments: { file: f1.path }
                });
                checkScriptInfoAndProjects(1, f1.content, "contents of file when opened without specifying contents");
                const snap = info.getSnapshot();
                // send close request
                session.executeCommandSeq({
                    command: "close" /* Close */,
                    arguments: { file: f1.path }
                });
                checkScriptInfoAndProjects(0, f1.content, "contents of closed file");
                assert.strictEqual(info.getSnapshot(), snap);
                // reload from temp file
                session.executeCommandSeq({
                    command: "reload" /* Reload */,
                    arguments: { file: f1.path, tmpfile: tmp.path }
                });
                checkScriptInfoAndProjects(0, tmp.content, "contents of temp file");
                assert.notStrictEqual(info.getSnapshot(), snap);
                // reload from own file
                session.executeCommandSeq({
                    command: "reload" /* Reload */,
                    arguments: { file: f1.path }
                });
                checkScriptInfoAndProjects(0, f1.content, "contents of closed file");
                assert.notStrictEqual(info.getSnapshot(), snap);
                function checkScriptInfoAndProjects(inferredProjects, contentsOfInfo, captionForContents) {
                    checkNumberOfProjects(projectService, { inferredProjects });
                    assert.strictEqual(projectService.getScriptInfo(f1.path), info);
                    checkScriptInfoContents(contentsOfInfo, captionForContents);
                }
                function checkScriptInfoContents(contentsOfInfo, captionForContents) {
                    const snap = info.getSnapshot();
                    assert.equal(ts.getSnapshotText(snap), contentsOfInfo, "content should be equal to " + captionForContents);
                }
            });
        });
        describe("tsserverProjectSystem Inferred projects", () => {
            it("should support files without extensions", () => {
                const f = {
                    path: "/a/compile",
                    content: "let x = 1"
                };
                const host = projectSystem.createServerHost([f]);
                const session = createSession(host);
                session.executeCommand({
                    seq: 1,
                    type: "request",
                    command: "compilerOptionsForInferredProjects",
                    arguments: {
                        options: {
                            allowJs: true
                        }
                    }
                });
                session.executeCommand({
                    seq: 2,
                    type: "request",
                    command: "open",
                    arguments: {
                        file: f.path,
                        fileContent: f.content,
                        scriptKindName: "JS"
                    }
                });
                const projectService = session.getProjectService();
                checkNumberOfProjects(projectService, { inferredProjects: 1 });
                checkProjectActualFiles(projectService.inferredProjects[0], [f.path]);
            });
            it("inferred projects per project root", () => {
                const file1 = { path: "/a/file1.ts", content: "let x = 1;", projectRootPath: "/a" };
                const file2 = { path: "/a/file2.ts", content: "let y = 2;", projectRootPath: "/a" };
                const file3 = { path: "/b/file2.ts", content: "let x = 3;", projectRootPath: "/b" };
                const file4 = { path: "/c/file3.ts", content: "let z = 4;" };
                const host = projectSystem.createServerHost([file1, file2, file3, file4]);
                const session = createSession(host, {
                    useSingleInferredProject: true,
                    useInferredProjectPerProjectRoot: true
                });
                session.executeCommand({
                    seq: 1,
                    type: "request",
                    command: CommandNames.CompilerOptionsForInferredProjects,
                    arguments: {
                        options: {
                            allowJs: true,
                            target: ts.ScriptTarget.ESNext
                        }
                    }
                });
                session.executeCommand({
                    seq: 2,
                    type: "request",
                    command: CommandNames.CompilerOptionsForInferredProjects,
                    arguments: {
                        options: {
                            allowJs: true,
                            target: ts.ScriptTarget.ES2015
                        },
                        projectRootPath: "/b"
                    }
                });
                session.executeCommand({
                    seq: 3,
                    type: "request",
                    command: CommandNames.Open,
                    arguments: {
                        file: file1.path,
                        fileContent: file1.content,
                        scriptKindName: "JS",
                        projectRootPath: file1.projectRootPath
                    }
                });
                session.executeCommand({
                    seq: 4,
                    type: "request",
                    command: CommandNames.Open,
                    arguments: {
                        file: file2.path,
                        fileContent: file2.content,
                        scriptKindName: "JS",
                        projectRootPath: file2.projectRootPath
                    }
                });
                session.executeCommand({
                    seq: 5,
                    type: "request",
                    command: CommandNames.Open,
                    arguments: {
                        file: file3.path,
                        fileContent: file3.content,
                        scriptKindName: "JS",
                        projectRootPath: file3.projectRootPath
                    }
                });
                session.executeCommand({
                    seq: 6,
                    type: "request",
                    command: CommandNames.Open,
                    arguments: {
                        file: file4.path,
                        fileContent: file4.content,
                        scriptKindName: "JS"
                    }
                });
                const projectService = session.getProjectService();
                checkNumberOfProjects(projectService, { inferredProjects: 3 });
                checkProjectActualFiles(projectService.inferredProjects[0], [file4.path]);
                checkProjectActualFiles(projectService.inferredProjects[1], [file1.path, file2.path]);
                checkProjectActualFiles(projectService.inferredProjects[2], [file3.path]);
                assert.equal(projectService.inferredProjects[0].getCompilationSettings().target, ts.ScriptTarget.ESNext);
                assert.equal(projectService.inferredProjects[1].getCompilationSettings().target, ts.ScriptTarget.ESNext);
                assert.equal(projectService.inferredProjects[2].getCompilationSettings().target, ts.ScriptTarget.ES2015);
            });
            function checkInferredProject(inferredProject, actualFiles, target) {
                checkProjectActualFiles(inferredProject, actualFiles.map(f => f.path));
                assert.equal(inferredProject.getCompilationSettings().target, target);
            }
            function verifyProjectRootWithCaseSensitivity(useCaseSensitiveFileNames) {
                const files = [
                    { path: "/a/file1.ts", content: "let x = 1;" },
                    { path: "/A/file2.ts", content: "let y = 2;" },
                    { path: "/b/file2.ts", content: "let x = 3;" },
                    { path: "/c/file3.ts", content: "let z = 4;" }
                ];
                const host = projectSystem.createServerHost(files, { useCaseSensitiveFileNames });
                const projectService = createProjectService(host, { useSingleInferredProject: true, }, { useInferredProjectPerProjectRoot: true });
                projectService.setCompilerOptionsForInferredProjects({
                    allowJs: true,
                    target: ts.ScriptTarget.ESNext
                });
                projectService.setCompilerOptionsForInferredProjects({
                    allowJs: true,
                    target: ts.ScriptTarget.ES2015
                }, "/a");
                openClientFiles(["/a", "/a", "/b", undefined]);
                verifyInferredProjectsState([
                    [[files[3]], ts.ScriptTarget.ESNext],
                    [[files[0], files[1]], ts.ScriptTarget.ES2015],
                    [[files[2]], ts.ScriptTarget.ESNext]
                ]);
                closeClientFiles();
                openClientFiles(["/a", "/A", "/b", undefined]);
                if (useCaseSensitiveFileNames) {
                    verifyInferredProjectsState([
                        [[files[3]], ts.ScriptTarget.ESNext],
                        [[files[0]], ts.ScriptTarget.ES2015],
                        [[files[1]], ts.ScriptTarget.ESNext],
                        [[files[2]], ts.ScriptTarget.ESNext]
                    ]);
                }
                else {
                    verifyInferredProjectsState([
                        [[files[3]], ts.ScriptTarget.ESNext],
                        [[files[0], files[1]], ts.ScriptTarget.ES2015],
                        [[files[2]], ts.ScriptTarget.ESNext]
                    ]);
                }
                closeClientFiles();
                projectService.setCompilerOptionsForInferredProjects({
                    allowJs: true,
                    target: ts.ScriptTarget.ES2017
                }, "/A");
                openClientFiles(["/a", "/a", "/b", undefined]);
                verifyInferredProjectsState([
                    [[files[3]], ts.ScriptTarget.ESNext],
                    [[files[0], files[1]], useCaseSensitiveFileNames ? ts.ScriptTarget.ES2015 : ts.ScriptTarget.ES2017],
                    [[files[2]], ts.ScriptTarget.ESNext]
                ]);
                closeClientFiles();
                openClientFiles(["/a", "/A", "/b", undefined]);
                if (useCaseSensitiveFileNames) {
                    verifyInferredProjectsState([
                        [[files[3]], ts.ScriptTarget.ESNext],
                        [[files[0]], ts.ScriptTarget.ES2015],
                        [[files[1]], ts.ScriptTarget.ES2017],
                        [[files[2]], ts.ScriptTarget.ESNext]
                    ]);
                }
                else {
                    verifyInferredProjectsState([
                        [[files[3]], ts.ScriptTarget.ESNext],
                        [[files[0], files[1]], ts.ScriptTarget.ES2017],
                        [[files[2]], ts.ScriptTarget.ESNext]
                    ]);
                }
                closeClientFiles();
                function openClientFiles(projectRoots) {
                    files.forEach((file, index) => {
                        projectService.openClientFile(file.path, file.content, ts.ScriptKind.JS, projectRoots[index]);
                    });
                }
                function closeClientFiles() {
                    files.forEach(file => projectService.closeClientFile(file.path));
                }
                function verifyInferredProjectsState(expected) {
                    checkNumberOfProjects(projectService, { inferredProjects: expected.length });
                    projectService.inferredProjects.forEach((p, index) => {
                        const [actualFiles, target] = expected[index];
                        checkInferredProject(p, actualFiles, target);
                    });
                }
            }
            it("inferred projects per project root with case sensitive system", () => {
                verifyProjectRootWithCaseSensitivity(/*useCaseSensitiveFileNames*/ true);
            });
            it("inferred projects per project root with case insensitive system", () => {
                verifyProjectRootWithCaseSensitivity(/*useCaseSensitiveFileNames*/ false);
            });
        });
        describe("tsserverProjectSystem No overwrite emit error", () => {
            it("for inferred project", () => {
                const f1 = {
                    path: "/a/b/f1.js",
                    content: "function test1() { }"
                };
                const host = projectSystem.createServerHost([f1, projectSystem.libFile]);
                const session = createSession(host);
                openFilesForSession([f1], session);
                const projectService = session.getProjectService();
                checkNumberOfProjects(projectService, { inferredProjects: 1 });
                const projectName = projectService.inferredProjects[0].getProjectName();
                const diags = session.executeCommand({
                    type: "request",
                    command: ts.server.CommandNames.CompilerOptionsDiagnosticsFull,
                    seq: 2,
                    arguments: { projectFileName: projectName }
                }).response;
                assert.isTrue(diags.length === 0);
                session.executeCommand({
                    type: "request",
                    command: ts.server.CommandNames.CompilerOptionsForInferredProjects,
                    seq: 3,
                    arguments: { options: { module: ts.ModuleKind.CommonJS } }
                });
                const diagsAfterUpdate = session.executeCommand({
                    type: "request",
                    command: ts.server.CommandNames.CompilerOptionsDiagnosticsFull,
                    seq: 4,
                    arguments: { projectFileName: projectName }
                }).response;
                assert.isTrue(diagsAfterUpdate.length === 0);
            });
            it("for external project", () => {
                const f1 = {
                    path: "/a/b/f1.js",
                    content: "function test1() { }"
                };
                const host = projectSystem.createServerHost([f1, projectSystem.libFile]);
                const session = createSession(host);
                const projectService = session.getProjectService();
                const projectFileName = "/a/b/project.csproj";
                const externalFiles = toExternalFiles([f1.path]);
                projectService.openExternalProject({
                    projectFileName,
                    rootFiles: externalFiles,
                    options: {}
                });
                checkNumberOfProjects(projectService, { externalProjects: 1 });
                const diags = session.executeCommand({
                    type: "request",
                    command: ts.server.CommandNames.CompilerOptionsDiagnosticsFull,
                    seq: 2,
                    arguments: { projectFileName }
                }).response;
                assert.isTrue(diags.length === 0);
                session.executeCommand({
                    type: "request",
                    command: ts.server.CommandNames.OpenExternalProject,
                    seq: 3,
                    arguments: {
                        projectFileName,
                        rootFiles: externalFiles,
                        options: { module: ts.ModuleKind.CommonJS }
                    }
                });
                const diagsAfterUpdate = session.executeCommand({
                    type: "request",
                    command: ts.server.CommandNames.CompilerOptionsDiagnosticsFull,
                    seq: 4,
                    arguments: { projectFileName }
                }).response;
                assert.isTrue(diagsAfterUpdate.length === 0);
            });
        });
        describe("tsserverProjectSystem emit with outFile or out setting", () => {
            function test(opts, expectedUsesOutFile) {
                const f1 = {
                    path: "/a/a.ts",
                    content: "let x = 1"
                };
                const f2 = {
                    path: "/a/b.ts",
                    content: "let y = 1"
                };
                const config = {
                    path: "/a/tsconfig.json",
                    content: JSON.stringify({
                        compilerOptions: opts,
                        compileOnSave: true
                    })
                };
                const host = projectSystem.createServerHost([f1, f2, config]);
                const session = createSession(host);
                session.executeCommand({
                    seq: 1,
                    type: "request",
                    command: "open",
                    arguments: { file: f1.path }
                });
                checkNumberOfProjects(session.getProjectService(), { configuredProjects: 1 });
                const { response } = session.executeCommand({
                    seq: 2,
                    type: "request",
                    command: "compileOnSaveAffectedFileList",
                    arguments: { file: f1.path }
                });
                assert.equal(response.length, 1, "expected output for 1 project");
                assert.equal(response[0].fileNames.length, 2, "expected output for 1 project");
                assert.equal(response[0].projectUsesOutFile, expectedUsesOutFile, "usesOutFile");
            }
            it("projectUsesOutFile should not be returned if not set", () => {
                test({}, /*expectedUsesOutFile*/ false);
            });
            it("projectUsesOutFile should be true if outFile is set", () => {
                test({ outFile: "/a/out.js" }, /*expectedUsesOutFile*/ true);
            });
            it("projectUsesOutFile should be true if out is set", () => {
                test({ out: "/a/out.js" }, /*expectedUsesOutFile*/ true);
            });
        });
        describe("tsserverProjectSystem import helpers", () => {
            it("should not crash in tsserver", () => {
                const f1 = {
                    path: "/a/app.ts",
                    content: "export async function foo() { return 100; }"
                };
                const tslib = {
                    path: "/a/node_modules/tslib/index.d.ts",
                    content: ""
                };
                const host = projectSystem.createServerHost([f1, tslib]);
                const service = createProjectService(host);
                service.openExternalProject({ projectFileName: "p", rootFiles: [toExternalFile(f1.path)], options: { importHelpers: true } });
                service.checkNumberOfProjects({ externalProjects: 1 });
            });
        });
        describe("tsserverProjectSystem searching for config file", () => {
            it("should stop at projectRootPath if given", () => {
                const f1 = {
                    path: "/a/file1.ts",
                    content: ""
                };
                const configFile = {
                    path: "/tsconfig.json",
                    content: "{}"
                };
                const host = projectSystem.createServerHost([f1, configFile]);
                const service = createProjectService(host);
                service.openClientFile(f1.path, /*fileContent*/ undefined, /*scriptKind*/ undefined, "/a");
                checkNumberOfConfiguredProjects(service, 0);
                checkNumberOfInferredProjects(service, 1);
                service.closeClientFile(f1.path);
                service.openClientFile(f1.path);
                checkNumberOfConfiguredProjects(service, 1);
                checkNumberOfInferredProjects(service, 0);
            });
            it("should use projectRootPath when searching for inferred project again", () => {
                const projectDir = "/a/b/projects/project";
                const configFileLocation = `${projectDir}/src`;
                const f1 = {
                    path: `${configFileLocation}/file1.ts`,
                    content: ""
                };
                const configFile = {
                    path: `${configFileLocation}/tsconfig.json`,
                    content: "{}"
                };
                const configFile2 = {
                    path: "/a/b/projects/tsconfig.json",
                    content: "{}"
                };
                const host = projectSystem.createServerHost([f1, projectSystem.libFile, configFile, configFile2]);
                const service = createProjectService(host);
                service.openClientFile(f1.path, /*fileContent*/ undefined, /*scriptKind*/ undefined, projectDir);
                checkNumberOfProjects(service, { configuredProjects: 1 });
                assert.isDefined(service.configuredProjects.get(configFile.path));
                projectSystem.checkWatchedFiles(host, [projectSystem.libFile.path, configFile.path]);
                projectSystem.checkWatchedDirectories(host, [], /*recursive*/ false);
                const typeRootLocations = getTypeRootsFromLocation(configFileLocation);
                projectSystem.checkWatchedDirectories(host, typeRootLocations.concat(configFileLocation), /*recursive*/ true);
                // Delete config file - should create inferred project and not configured project
                host.reloadFS([f1, projectSystem.libFile, configFile2]);
                host.runQueuedTimeoutCallbacks();
                checkNumberOfProjects(service, { inferredProjects: 1 });
                projectSystem.checkWatchedFiles(host, [projectSystem.libFile.path, configFile.path, `${configFileLocation}/jsconfig.json`, `${projectDir}/tsconfig.json`, `${projectDir}/jsconfig.json`]);
                projectSystem.checkWatchedDirectories(host, [], /*recursive*/ false);
                projectSystem.checkWatchedDirectories(host, typeRootLocations, /*recursive*/ true);
            });
            it("should use projectRootPath when searching for inferred project again 2", () => {
                const projectDir = "/a/b/projects/project";
                const configFileLocation = `${projectDir}/src`;
                const f1 = {
                    path: `${configFileLocation}/file1.ts`,
                    content: ""
                };
                const configFile = {
                    path: `${configFileLocation}/tsconfig.json`,
                    content: "{}"
                };
                const configFile2 = {
                    path: "/a/b/projects/tsconfig.json",
                    content: "{}"
                };
                const host = projectSystem.createServerHost([f1, projectSystem.libFile, configFile, configFile2]);
                const service = createProjectService(host, { useSingleInferredProject: true }, { useInferredProjectPerProjectRoot: true });
                service.openClientFile(f1.path, /*fileContent*/ undefined, /*scriptKind*/ undefined, projectDir);
                checkNumberOfProjects(service, { configuredProjects: 1 });
                assert.isDefined(service.configuredProjects.get(configFile.path));
                projectSystem.checkWatchedFiles(host, [projectSystem.libFile.path, configFile.path]);
                projectSystem.checkWatchedDirectories(host, [], /*recursive*/ false);
                projectSystem.checkWatchedDirectories(host, getTypeRootsFromLocation(configFileLocation).concat(configFileLocation), /*recursive*/ true);
                // Delete config file - should create inferred project with project root path set
                host.reloadFS([f1, projectSystem.libFile, configFile2]);
                host.runQueuedTimeoutCallbacks();
                checkNumberOfProjects(service, { inferredProjects: 1 });
                assert.equal(service.inferredProjects[0].projectRootPath, projectDir);
                projectSystem.checkWatchedFiles(host, [projectSystem.libFile.path, configFile.path, `${configFileLocation}/jsconfig.json`, `${projectDir}/tsconfig.json`, `${projectDir}/jsconfig.json`]);
                projectSystem.checkWatchedDirectories(host, [], /*recursive*/ false);
                projectSystem.checkWatchedDirectories(host, getTypeRootsFromLocation(projectDir), /*recursive*/ true);
            });
        });
        describe("tsserverProjectSystem cancellationToken", () => {
            // Disable sourcemap support for the duration of the test, as sourcemapping the errors generated during this test is slow and not something we care to test
            let oldPrepare;
            before(() => {
                oldPrepare = Error.prepareStackTrace;
                delete Error.prepareStackTrace;
            });
            after(() => {
                Error.prepareStackTrace = oldPrepare;
            });
            it("is attached to request", () => {
                const f1 = {
                    path: "/a/b/app.ts",
                    content: "let xyz = 1;"
                };
                const host = projectSystem.createServerHost([f1]);
                let expectedRequestId;
                const cancellationToken = {
                    isCancellationRequested: () => false,
                    setRequest: requestId => {
                        if (expectedRequestId === undefined) {
                            assert.isTrue(false, "unexpected call");
                        }
                        assert.equal(requestId, expectedRequestId);
                    },
                    resetRequest: ts.noop
                };
                const session = createSession(host, { cancellationToken });
                expectedRequestId = session.getNextSeq();
                session.executeCommandSeq({
                    command: "open",
                    arguments: { file: f1.path }
                });
                expectedRequestId = session.getNextSeq();
                session.executeCommandSeq({
                    command: "geterr",
                    arguments: { files: [f1.path] }
                });
                expectedRequestId = session.getNextSeq();
                session.executeCommandSeq({
                    command: "occurrences",
                    arguments: { file: f1.path, line: 1, offset: 6 }
                });
                expectedRequestId = 2;
                host.runQueuedImmediateCallbacks();
                expectedRequestId = 2;
                host.runQueuedImmediateCallbacks();
            });
            it("Geterr is cancellable", () => {
                const f1 = {
                    path: "/a/app.ts",
                    content: "let x = 1"
                };
                const config = {
                    path: "/a/tsconfig.json",
                    content: JSON.stringify({
                        compilerOptions: {}
                    })
                };
                const cancellationToken = new TestServerCancellationToken();
                const host = projectSystem.createServerHost([f1, config]);
                const session = createSession(host, {
                    canUseEvents: true,
                    eventHandler: ts.noop,
                    cancellationToken
                });
                {
                    session.executeCommandSeq({
                        command: "open",
                        arguments: { file: f1.path }
                    });
                    // send geterr for missing file
                    session.executeCommandSeq({
                        command: "geterr",
                        arguments: { files: ["/a/missing"] }
                    });
                    // no files - expect 'completed' event
                    assert.equal(host.getOutput().length, 1, "expect 1 message");
                    verifyRequestCompleted(session.getSeq(), 0);
                }
                {
                    const getErrId = session.getNextSeq();
                    // send geterr for a valid file
                    session.executeCommandSeq({
                        command: "geterr",
                        arguments: { files: [f1.path] }
                    });
                    assert.equal(host.getOutput().length, 0, "expect 0 messages");
                    // run new request
                    session.executeCommandSeq({
                        command: "projectInfo",
                        arguments: { file: f1.path }
                    });
                    session.clearMessages();
                    // cancel previously issued Geterr
                    cancellationToken.setRequestToCancel(getErrId);
                    host.runQueuedTimeoutCallbacks();
                    assert.equal(host.getOutput().length, 1, "expect 1 message");
                    verifyRequestCompleted(getErrId, 0);
                    cancellationToken.resetToken();
                }
                {
                    const getErrId = session.getNextSeq();
                    session.executeCommandSeq({
                        command: "geterr",
                        arguments: { files: [f1.path] }
                    });
                    assert.equal(host.getOutput().length, 0, "expect 0 messages");
                    // run first step
                    host.runQueuedTimeoutCallbacks();
                    assert.equal(host.getOutput().length, 1, "expect 1 message");
                    const e1 = getMessage(0);
                    assert.equal(e1.event, "syntaxDiag");
                    session.clearMessages();
                    cancellationToken.setRequestToCancel(getErrId);
                    host.runQueuedImmediateCallbacks();
                    assert.equal(host.getOutput().length, 1, "expect 1 message");
                    verifyRequestCompleted(getErrId, 0);
                    cancellationToken.resetToken();
                }
                {
                    const getErrId = session.getNextSeq();
                    session.executeCommandSeq({
                        command: "geterr",
                        arguments: { files: [f1.path] }
                    });
                    assert.equal(host.getOutput().length, 0, "expect 0 messages");
                    // run first step
                    host.runQueuedTimeoutCallbacks();
                    assert.equal(host.getOutput().length, 1, "expect 1 message");
                    const e1 = getMessage(0);
                    assert.equal(e1.event, "syntaxDiag");
                    session.clearMessages();
                    // the semanticDiag message
                    host.runQueuedImmediateCallbacks();
                    assert.equal(host.getOutput().length, 1);
                    const e2 = getMessage(0);
                    assert.equal(e2.event, "semanticDiag");
                    session.clearMessages();
                    host.runQueuedImmediateCallbacks(1);
                    assert.equal(host.getOutput().length, 2);
                    const e3 = getMessage(0);
                    assert.equal(e3.event, "suggestionDiag");
                    verifyRequestCompleted(getErrId, 1);
                    cancellationToken.resetToken();
                }
                {
                    const getErr1 = session.getNextSeq();
                    session.executeCommandSeq({
                        command: "geterr",
                        arguments: { files: [f1.path] }
                    });
                    assert.equal(host.getOutput().length, 0, "expect 0 messages");
                    // run first step
                    host.runQueuedTimeoutCallbacks();
                    assert.equal(host.getOutput().length, 1, "expect 1 message");
                    const e1 = getMessage(0);
                    assert.equal(e1.event, "syntaxDiag");
                    session.clearMessages();
                    session.executeCommandSeq({
                        command: "geterr",
                        arguments: { files: [f1.path] }
                    });
                    // make sure that getErr1 is completed
                    verifyRequestCompleted(getErr1, 0);
                }
                function verifyRequestCompleted(expectedSeq, n) {
                    const event = getMessage(n);
                    assert.equal(event.event, "requestCompleted");
                    assert.equal(event.body.request_seq, expectedSeq, "expectedSeq");
                    session.clearMessages();
                }
                function getMessage(n) {
                    return JSON.parse(ts.server.extractMessage(host.getOutput()[n]));
                }
            });
            it("Lower priority tasks are cancellable", () => {
                const f1 = {
                    path: "/a/app.ts",
                    content: `{ let x = 1; } var foo = "foo"; var bar = "bar"; var fooBar = "fooBar";`
                };
                const config = {
                    path: "/a/tsconfig.json",
                    content: JSON.stringify({
                        compilerOptions: {}
                    })
                };
                const cancellationToken = new TestServerCancellationToken(/*cancelAfterRequest*/ 3);
                const host = projectSystem.createServerHost([f1, config]);
                const session = createSession(host, {
                    canUseEvents: true,
                    eventHandler: ts.noop,
                    cancellationToken,
                    throttleWaitMilliseconds: 0
                });
                {
                    session.executeCommandSeq({
                        command: "open",
                        arguments: { file: f1.path }
                    });
                    // send navbar request (normal priority)
                    session.executeCommandSeq({
                        command: "navbar",
                        arguments: { file: f1.path }
                    });
                    // ensure the nav bar request can be canceled
                    verifyExecuteCommandSeqIsCancellable({
                        command: "navbar",
                        arguments: { file: f1.path }
                    });
                    // send outlining spans request (normal priority)
                    session.executeCommandSeq({
                        command: "outliningSpans",
                        arguments: { file: f1.path }
                    });
                    // ensure the outlining spans request can be canceled
                    verifyExecuteCommandSeqIsCancellable({
                        command: "outliningSpans",
                        arguments: { file: f1.path }
                    });
                }
                function verifyExecuteCommandSeqIsCancellable(request) {
                    // Set the next request to be cancellable
                    // The cancellation token will cancel the request the third time
                    // isCancellationRequested() is called.
                    cancellationToken.setRequestToCancel(session.getNextSeq());
                    let operationCanceledExceptionThrown = false;
                    try {
                        session.executeCommandSeq(request);
                    }
                    catch (e) {
                        assert(e instanceof ts.OperationCanceledException);
                        operationCanceledExceptionThrown = true;
                    }
                    assert(operationCanceledExceptionThrown, "Operation Canceled Exception not thrown for request: " + JSON.stringify(request));
                }
            });
        });
        describe("tsserverProjectSystem occurence highlight on string", () => {
            it("should be marked if only on string values", () => {
                const file1 = {
                    path: "/a/b/file1.ts",
                    content: `let t1 = "div";\nlet t2 = "div";\nlet t3 = { "div": 123 };\nlet t4 = t3["div"];`
                };
                const host = projectSystem.createServerHost([file1]);
                const session = createSession(host);
                const projectService = session.getProjectService();
                projectService.openClientFile(file1.path);
                {
                    const highlightRequest = makeSessionRequest(CommandNames.Occurrences, { file: file1.path, line: 1, offset: 11 });
                    const highlightResponse = session.executeCommand(highlightRequest).response;
                    const firstOccurence = highlightResponse[0];
                    assert.isTrue(firstOccurence.isInString, "Highlights should be marked with isInString");
                }
                {
                    const highlightRequest = makeSessionRequest(CommandNames.Occurrences, { file: file1.path, line: 3, offset: 13 });
                    const highlightResponse = session.executeCommand(highlightRequest).response;
                    assert.isTrue(highlightResponse.length === 2);
                    const firstOccurence = highlightResponse[0];
                    assert.isUndefined(firstOccurence.isInString, "Highlights should not be marked with isInString if on property name");
                }
                {
                    const highlightRequest = makeSessionRequest(CommandNames.Occurrences, { file: file1.path, line: 4, offset: 14 });
                    const highlightResponse = session.executeCommand(highlightRequest).response;
                    assert.isTrue(highlightResponse.length === 2);
                    const firstOccurence = highlightResponse[0];
                    assert.isUndefined(firstOccurence.isInString, "Highlights should not be marked with isInString if on indexer");
                }
            });
        });
        describe("tsserverProjectSystem maxNodeModuleJsDepth for inferred projects", () => {
            it("should be set to 2 if the project has js root files", () => {
                const file1 = {
                    path: "/a/b/file1.js",
                    content: `var t = require("test"); t.`
                };
                const moduleFile = {
                    path: "/a/b/node_modules/test/index.js",
                    content: `var v = 10; module.exports = v;`
                };
                const host = projectSystem.createServerHost([file1, moduleFile]);
                const projectService = createProjectService(host);
                projectService.openClientFile(file1.path);
                let project = projectService.inferredProjects[0];
                let options = project.getCompilationSettings();
                assert.isTrue(options.maxNodeModuleJsDepth === 2);
                // Assert the option sticks
                projectService.setCompilerOptionsForInferredProjects({ target: ts.ScriptTarget.ES2016 });
                project = projectService.inferredProjects[0];
                options = project.getCompilationSettings();
                assert.isTrue(options.maxNodeModuleJsDepth === 2);
            });
            it("should return to normal state when all js root files are removed from project", () => {
                const file1 = {
                    path: "/a/file1.ts",
                    content: "let x =1;"
                };
                const file2 = {
                    path: "/a/file2.js",
                    content: "let x =1;"
                };
                const host = projectSystem.createServerHost([file1, file2, projectSystem.libFile]);
                const projectService = createProjectService(host, { useSingleInferredProject: true });
                projectService.openClientFile(file1.path);
                checkNumberOfInferredProjects(projectService, 1);
                let project = projectService.inferredProjects[0];
                assert.isUndefined(project.getCompilationSettings().maxNodeModuleJsDepth);
                projectService.openClientFile(file2.path);
                project = projectService.inferredProjects[0];
                assert.isTrue(project.getCompilationSettings().maxNodeModuleJsDepth === 2);
                projectService.closeClientFile(file2.path);
                project = projectService.inferredProjects[0];
                assert.isUndefined(project.getCompilationSettings().maxNodeModuleJsDepth);
            });
        });
        describe("tsserverProjectSystem Options Diagnostic locations reported correctly with changes in configFile contents", () => {
            it("when options change", () => {
                const file = {
                    path: "/a/b/app.ts",
                    content: "let x = 10"
                };
                const configFileContentBeforeComment = `{`;
                const configFileContentComment = `
                // comment`;
                const configFileContentAfterComment = `
                "compilerOptions": {
                    "allowJs": true,
                    "declaration": true
                }
            }`;
                const configFileContentWithComment = configFileContentBeforeComment + configFileContentComment + configFileContentAfterComment;
                const configFileContentWithoutCommentLine = configFileContentBeforeComment + configFileContentAfterComment;
                const configFile = {
                    path: "/a/b/tsconfig.json",
                    content: configFileContentWithComment
                };
                const host = projectSystem.createServerHost([file, projectSystem.libFile, configFile]);
                const session = createSession(host);
                openFilesForSession([file], session);
                const projectService = session.getProjectService();
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                const projectName = configuredProjectAt(projectService, 0).getProjectName();
                const diags = session.executeCommand({
                    type: "request",
                    command: ts.server.CommandNames.SemanticDiagnosticsSync,
                    seq: 2,
                    arguments: { file: configFile.path, projectFileName: projectName, includeLinePosition: true }
                }).response;
                assert.isTrue(diags.length === 2);
                configFile.content = configFileContentWithoutCommentLine;
                host.reloadFS([file, configFile]);
                const diagsAfterEdit = session.executeCommand({
                    type: "request",
                    command: ts.server.CommandNames.SemanticDiagnosticsSync,
                    seq: 2,
                    arguments: { file: configFile.path, projectFileName: projectName, includeLinePosition: true }
                }).response;
                assert.isTrue(diagsAfterEdit.length === 2);
                verifyDiagnostic(diags[0], diagsAfterEdit[0]);
                verifyDiagnostic(diags[1], diagsAfterEdit[1]);
                function verifyDiagnostic(beforeEditDiag, afterEditDiag) {
                    assert.equal(beforeEditDiag.message, afterEditDiag.message);
                    assert.equal(beforeEditDiag.code, afterEditDiag.code);
                    assert.equal(beforeEditDiag.category, afterEditDiag.category);
                    assert.equal(beforeEditDiag.startLocation.line, afterEditDiag.startLocation.line + 1);
                    assert.equal(beforeEditDiag.startLocation.offset, afterEditDiag.startLocation.offset);
                    assert.equal(beforeEditDiag.endLocation.line, afterEditDiag.endLocation.line + 1);
                    assert.equal(beforeEditDiag.endLocation.offset, afterEditDiag.endLocation.offset);
                }
            });
        });
        describe("tsserverProjectSystem refactors", () => {
            it("use formatting options", () => {
                const file = {
                    path: "/a.ts",
                    content: "function f() {\n  1;\n}",
                };
                const host = projectSystem.createServerHost([file]);
                const session = createSession(host);
                openFilesForSession([file], session);
                const response0 = session.executeCommandSeq({
                    command: "configure" /* Configure */,
                    arguments: {
                        formatOptions: {
                            indentSize: 2,
                        },
                    },
                }).response;
                assert.deepEqual(response0, /*expected*/ undefined);
                const response1 = session.executeCommandSeq({
                    command: "getEditsForRefactor" /* GetEditsForRefactor */,
                    arguments: {
                        refactor: "Extract Symbol",
                        action: "function_scope_1",
                        file: "/a.ts",
                        startLine: 2,
                        startOffset: 3,
                        endLine: 2,
                        endOffset: 4,
                    },
                }).response;
                assert.deepEqual(response1, {
                    edits: [
                        {
                            fileName: "/a.ts",
                            textChanges: [
                                {
                                    start: { line: 2, offset: 3 },
                                    end: { line: 2, offset: 5 },
                                    newText: "newFunction();",
                                },
                                {
                                    start: { line: 3, offset: 2 },
                                    end: { line: 3, offset: 2 },
                                    newText: "\n\nfunction newFunction() {\n  1;\n}\n",
                                },
                            ]
                        }
                    ],
                    renameFilename: "/a.ts",
                    renameLocation: { line: 2, offset: 3 },
                });
            });
        });
        describe("tsserverProjectSystem CachingFileSystemInformation", () => {
            let CalledMapsWithSingleArg;
            (function (CalledMapsWithSingleArg) {
                CalledMapsWithSingleArg["fileExists"] = "fileExists";
                CalledMapsWithSingleArg["directoryExists"] = "directoryExists";
                CalledMapsWithSingleArg["getDirectories"] = "getDirectories";
                CalledMapsWithSingleArg["readFile"] = "readFile";
            })(CalledMapsWithSingleArg || (CalledMapsWithSingleArg = {}));
            let CalledMapsWithFiveArgs;
            (function (CalledMapsWithFiveArgs) {
                CalledMapsWithFiveArgs["readDirectory"] = "readDirectory";
            })(CalledMapsWithFiveArgs || (CalledMapsWithFiveArgs = {}));
            function createCallsTrackingHost(host) {
                const calledMaps = {
                    fileExists: setCallsTrackingWithSingleArgFn(CalledMapsWithSingleArg.fileExists),
                    directoryExists: setCallsTrackingWithSingleArgFn(CalledMapsWithSingleArg.directoryExists),
                    getDirectories: setCallsTrackingWithSingleArgFn(CalledMapsWithSingleArg.getDirectories),
                    readFile: setCallsTrackingWithSingleArgFn(CalledMapsWithSingleArg.readFile),
                    readDirectory: setCallsTrackingWithFiveArgFn(CalledMapsWithFiveArgs.readDirectory)
                };
                return {
                    verifyNoCall,
                    verifyCalledOnEachEntryNTimes,
                    verifyCalledOnEachEntry,
                    verifyNoHostCalls,
                    verifyNoHostCallsExceptFileExistsOnce,
                    verifyCalledOn,
                    clear
                };
                function setCallsTrackingWithSingleArgFn(prop) {
                    const calledMap = ts.createMultiMap();
                    const cb = host[prop].bind(host);
                    host[prop] = (f) => {
                        calledMap.add(f, /*value*/ true);
                        return cb(f);
                    };
                    return calledMap;
                }
                function setCallsTrackingWithFiveArgFn(prop) {
                    const calledMap = ts.createMultiMap();
                    const cb = host[prop].bind(host);
                    host[prop] = (f, arg1, arg2, arg3, arg4) => {
                        calledMap.add(f, [arg1, arg2, arg3, arg4]);
                        return cb(f, arg1, arg2, arg3, arg4);
                    };
                    return calledMap;
                }
                function verifyCalledOn(callback, name) {
                    const calledMap = calledMaps[callback];
                    const result = calledMap.get(name);
                    assert.isTrue(result && !!result.length, `${callback} should be called with name: ${name}: ${ts.arrayFrom(calledMap.keys())}`);
                }
                function verifyNoCall(callback) {
                    const calledMap = calledMaps[callback];
                    assert.equal(calledMap.size, 0, `${callback} shouldnt be called: ${ts.arrayFrom(calledMap.keys())}`);
                }
                function verifyCalledOnEachEntry(callback, expectedKeys) {
                    ts.TestFSWithWatch.checkMultiMapKeyCount(callback, calledMaps[callback], expectedKeys);
                }
                function verifyCalledOnEachEntryNTimes(callback, expectedKeys, nTimes) {
                    ts.TestFSWithWatch.checkMultiMapEachKeyWithCount(callback, calledMaps[callback], expectedKeys, nTimes);
                }
                function verifyNoHostCalls() {
                    iterateOnCalledMaps(key => verifyNoCall(key));
                }
                function verifyNoHostCallsExceptFileExistsOnce(expectedKeys) {
                    verifyCalledOnEachEntryNTimes(CalledMapsWithSingleArg.fileExists, expectedKeys, 1);
                    verifyNoCall(CalledMapsWithSingleArg.directoryExists);
                    verifyNoCall(CalledMapsWithSingleArg.getDirectories);
                    verifyNoCall(CalledMapsWithSingleArg.readFile);
                    verifyNoCall(CalledMapsWithFiveArgs.readDirectory);
                }
                function clear() {
                    iterateOnCalledMaps(key => calledMaps[key].clear());
                }
                function iterateOnCalledMaps(cb) {
                    for (const key in CalledMapsWithSingleArg) {
                        cb(key);
                    }
                    for (const key in CalledMapsWithFiveArgs) {
                        cb(key);
                    }
                }
            }
            it("works using legacy resolution logic", () => {
                let rootContent = `import {x} from "f1"`;
                const root = {
                    path: "/c/d/f0.ts",
                    content: rootContent
                };
                const imported = {
                    path: "/c/f1.ts",
                    content: `foo()`
                };
                const host = projectSystem.createServerHost([root, imported]);
                const projectService = createProjectService(host);
                projectService.setCompilerOptionsForInferredProjects({ module: ts.ModuleKind.AMD, noLib: true });
                projectService.openClientFile(root.path);
                checkNumberOfProjects(projectService, { inferredProjects: 1 });
                const project = projectService.inferredProjects[0];
                const rootScriptInfo = project.getRootScriptInfos()[0];
                assert.equal(rootScriptInfo.fileName, root.path);
                // ensure that imported file was found
                verifyImportedDiagnostics();
                const callsTrackingHost = createCallsTrackingHost(host);
                // trigger synchronization to make sure that import will be fetched from the cache
                // ensure file has correct number of errors after edit
                editContent(`import {x} from "f1";
                 var x: string = 1;`);
                verifyImportedDiagnostics();
                callsTrackingHost.verifyNoHostCalls();
                // trigger synchronization to make sure that LSHost will try to find 'f2' module on disk
                editContent(`import {x} from "f2"`);
                try {
                    // trigger synchronization to make sure that LSHost will try to find 'f2' module on disk
                    verifyImportedDiagnostics();
                    assert.isTrue(false, `should not find file '${imported.path}'`);
                }
                catch (e) {
                    assert.isTrue(e.message.indexOf(`Could not find file: '${imported.path}'.`) === 0);
                }
                const f2Lookups = getLocationsForModuleLookup("f2");
                callsTrackingHost.verifyCalledOnEachEntryNTimes(CalledMapsWithSingleArg.fileExists, f2Lookups, 1);
                const f2DirLookups = getLocationsForDirectoryLookup();
                callsTrackingHost.verifyCalledOnEachEntry(CalledMapsWithSingleArg.directoryExists, f2DirLookups);
                callsTrackingHost.verifyNoCall(CalledMapsWithSingleArg.getDirectories);
                callsTrackingHost.verifyNoCall(CalledMapsWithSingleArg.readFile);
                callsTrackingHost.verifyNoCall(CalledMapsWithFiveArgs.readDirectory);
                editContent(`import {x} from "f1"`);
                verifyImportedDiagnostics();
                const f1Lookups = f2Lookups.map(s => s.replace("f2", "f1"));
                f1Lookups.length = f1Lookups.indexOf(imported.path) + 1;
                const f1DirLookups = ["/c/d", "/c", ...mapCombinedPathsInAncestor(ts.getDirectoryPath(root.path), projectSystem.nodeModulesAtTypes, ts.returnTrue)];
                vertifyF1Lookups();
                // setting compiler options discards module resolution cache
                callsTrackingHost.clear();
                projectService.setCompilerOptionsForInferredProjects({ module: ts.ModuleKind.AMD, noLib: true, target: ts.ScriptTarget.ES5 });
                verifyImportedDiagnostics();
                vertifyF1Lookups();
                function vertifyF1Lookups() {
                    callsTrackingHost.verifyCalledOnEachEntryNTimes(CalledMapsWithSingleArg.fileExists, f1Lookups, 1);
                    callsTrackingHost.verifyCalledOnEachEntryNTimes(CalledMapsWithSingleArg.directoryExists, f1DirLookups, 1);
                    callsTrackingHost.verifyNoCall(CalledMapsWithSingleArg.getDirectories);
                    callsTrackingHost.verifyNoCall(CalledMapsWithSingleArg.readFile);
                    callsTrackingHost.verifyNoCall(CalledMapsWithFiveArgs.readDirectory);
                }
                function editContent(newContent) {
                    callsTrackingHost.clear();
                    rootScriptInfo.editContent(0, rootContent.length, newContent);
                    rootContent = newContent;
                }
                function verifyImportedDiagnostics() {
                    const diags = project.getLanguageService().getSemanticDiagnostics(imported.path);
                    assert.equal(diags.length, 1);
                    const diag = diags[0];
                    assert.equal(diag.code, Diagnostics.Cannot_find_name_0.code);
                    assert.equal(ts.flattenDiagnosticMessageText(diag.messageText, "\n"), "Cannot find name 'foo'.");
                }
                function getLocationsForModuleLookup(module) {
                    const locations = [];
                    ts.forEachAncestorDirectory(ts.getDirectoryPath(root.path), ancestor => {
                        locations.push(ts.combinePaths(ancestor, `${module}.ts`), ts.combinePaths(ancestor, `${module}.tsx`), ts.combinePaths(ancestor, `${module}.d.ts`));
                    });
                    ts.forEachAncestorDirectory(ts.getDirectoryPath(root.path), ancestor => {
                        locations.push(ts.combinePaths(ancestor, `${module}.js`), ts.combinePaths(ancestor, `${module}.jsx`));
                    });
                    return locations;
                }
                function getLocationsForDirectoryLookup() {
                    const result = ts.createMap();
                    ts.forEachAncestorDirectory(ts.getDirectoryPath(root.path), ancestor => {
                        // To resolve modules
                        result.set(ancestor, 2);
                        // for type roots
                        result.set(ts.combinePaths(ancestor, nodeModules), 1);
                        result.set(ts.combinePaths(ancestor, projectSystem.nodeModulesAtTypes), 1);
                    });
                    return result;
                }
            });
            it("loads missing files from disk", () => {
                const root = {
                    path: "/c/foo.ts",
                    content: `import {y} from "bar"`
                };
                const imported = {
                    path: "/c/bar.d.ts",
                    content: `export var y = 1`
                };
                const host = projectSystem.createServerHost([root]);
                const projectService = createProjectService(host);
                projectService.setCompilerOptionsForInferredProjects({ module: ts.ModuleKind.AMD, noLib: true });
                const callsTrackingHost = createCallsTrackingHost(host);
                projectService.openClientFile(root.path);
                checkNumberOfProjects(projectService, { inferredProjects: 1 });
                const project = projectService.inferredProjects[0];
                const rootScriptInfo = project.getRootScriptInfos()[0];
                assert.equal(rootScriptInfo.fileName, root.path);
                let diags = project.getLanguageService().getSemanticDiagnostics(root.path);
                assert.equal(diags.length, 1);
                const diag = diags[0];
                assert.equal(diag.code, Diagnostics.Cannot_find_module_0.code);
                assert.equal(ts.flattenDiagnosticMessageText(diag.messageText, "\n"), "Cannot find module 'bar'.");
                callsTrackingHost.verifyCalledOn(CalledMapsWithSingleArg.fileExists, imported.path);
                callsTrackingHost.clear();
                host.reloadFS([root, imported]);
                host.runQueuedTimeoutCallbacks();
                diags = project.getLanguageService().getSemanticDiagnostics(root.path);
                assert.equal(diags.length, 0);
                callsTrackingHost.verifyCalledOn(CalledMapsWithSingleArg.fileExists, imported.path);
            });
            it("when calling goto definition of module", () => {
                const clientFile = {
                    path: "/a/b/controllers/vessels/client.ts",
                    content: `
                    import { Vessel } from '~/models/vessel';
                    const v = new Vessel();
                `
                };
                const anotherModuleFile = {
                    path: "/a/b/utils/db.ts",
                    content: "export class Bookshelf { }"
                };
                const moduleFile = {
                    path: "/a/b/models/vessel.ts",
                    content: `
                    import { Bookshelf } from '~/utils/db';
                    export class Vessel extends Bookshelf {}
                `
                };
                const tsconfigFile = {
                    path: "/a/b/tsconfig.json",
                    content: JSON.stringify({
                        compilerOptions: {
                            target: "es6",
                            module: "es6",
                            baseUrl: "./",
                            paths: {
                                "~/*": ["*"] // resolve any `~/foo/bar` to `<baseUrl>/foo/bar`
                            }
                        },
                        exclude: [
                            "api",
                            "build",
                            "node_modules",
                            "public",
                            "seeds",
                            "sql_updates",
                            "tests.build"
                        ]
                    })
                };
                const projectFiles = [clientFile, anotherModuleFile, moduleFile, tsconfigFile];
                const host = projectSystem.createServerHost(projectFiles);
                const session = createSession(host);
                const projectService = session.getProjectService();
                const { configFileName } = projectService.openClientFile(clientFile.path);
                assert.isDefined(configFileName, `should find config`);
                checkNumberOfConfiguredProjects(projectService, 1);
                const project = projectService.configuredProjects.get(tsconfigFile.path);
                checkProjectActualFiles(project, ts.map(projectFiles, f => f.path));
                const callsTrackingHost = createCallsTrackingHost(host);
                // Get definitions shouldnt make host requests
                const getDefinitionRequest = makeSessionRequest("definition" /* Definition */, {
                    file: clientFile.path,
                    position: clientFile.content.indexOf("/vessel") + 1,
                    line: undefined,
                    offset: undefined
                });
                const response = session.executeCommand(getDefinitionRequest).response;
                assert.equal(response[0].file, moduleFile.path, "Should go to definition of vessel: response: " + JSON.stringify(response));
                callsTrackingHost.verifyNoHostCalls();
                // Open the file should call only file exists on module directory and use cached value for parental directory
                const { configFileName: config2 } = projectService.openClientFile(moduleFile.path);
                assert.equal(config2, configFileName);
                callsTrackingHost.verifyNoHostCallsExceptFileExistsOnce(["/a/b/models/tsconfig.json", "/a/b/models/jsconfig.json"]);
                checkNumberOfConfiguredProjects(projectService, 1);
                assert.strictEqual(projectService.configuredProjects.get(tsconfigFile.path), project);
            });
            describe("WatchDirectories for config file with", () => {
                function verifyWatchDirectoriesCaseSensitivity(useCaseSensitiveFileNames) {
                    const frontendDir = "/Users/someuser/work/applications/frontend";
                    const toCanonical = useCaseSensitiveFileNames ? s => s : s => s.toLowerCase();
                    const canonicalFrontendDir = toCanonical(frontendDir);
                    const file1 = {
                        path: `${frontendDir}/src/app/utils/Analytic.ts`,
                        content: "export class SomeClass { };"
                    };
                    const file2 = {
                        path: `${frontendDir}/src/app/redux/configureStore.ts`,
                        content: "export class configureStore { }"
                    };
                    const file3 = {
                        path: `${frontendDir}/src/app/utils/Cookie.ts`,
                        content: "export class Cookie { }"
                    };
                    const es2016LibFile = {
                        path: "/a/lib/lib.es2016.full.d.ts",
                        content: projectSystem.libFile.content
                    };
                    const typeRoots = ["types", "node_modules/@types"];
                    const types = ["node", "jest"];
                    const tsconfigFile = {
                        path: `${frontendDir}/tsconfig.json`,
                        content: JSON.stringify({
                            compilerOptions: {
                                strict: true,
                                strictNullChecks: true,
                                target: "es2016",
                                module: "commonjs",
                                moduleResolution: "node",
                                sourceMap: true,
                                noEmitOnError: true,
                                experimentalDecorators: true,
                                emitDecoratorMetadata: true,
                                types,
                                noUnusedLocals: true,
                                outDir: "./compiled",
                                typeRoots,
                                baseUrl: ".",
                                paths: {
                                    "*": [
                                        "types/*"
                                    ]
                                }
                            },
                            include: [
                                "src/**/*"
                            ],
                            exclude: [
                                "node_modules",
                                "compiled"
                            ]
                        })
                    };
                    const projectFiles = [file1, file2, es2016LibFile, tsconfigFile];
                    const host = projectSystem.createServerHost(projectFiles, { useCaseSensitiveFileNames });
                    const projectService = createProjectService(host);
                    const canonicalConfigPath = toCanonical(tsconfigFile.path);
                    const { configFileName } = projectService.openClientFile(file1.path);
                    assert.equal(configFileName, tsconfigFile.path, `should find config`);
                    checkNumberOfConfiguredProjects(projectService, 1);
                    const watchingRecursiveDirectories = [`${canonicalFrontendDir}/src`, canonicalFrontendDir].concat(getNodeModuleDirectories(ts.getDirectoryPath(canonicalFrontendDir)));
                    const project = projectService.configuredProjects.get(canonicalConfigPath);
                    verifyProjectAndWatchedDirectories();
                    const callsTrackingHost = createCallsTrackingHost(host);
                    // Create file cookie.ts
                    projectFiles.push(file3);
                    host.reloadFS(projectFiles);
                    host.runQueuedTimeoutCallbacks();
                    const canonicalFile3Path = useCaseSensitiveFileNames ? file3.path : file3.path.toLocaleLowerCase();
                    const numberOfTimesWatchInvoked = getNumberOfWatchesInvokedForRecursiveWatches(watchingRecursiveDirectories, canonicalFile3Path);
                    callsTrackingHost.verifyCalledOnEachEntryNTimes(CalledMapsWithSingleArg.fileExists, [canonicalFile3Path], numberOfTimesWatchInvoked);
                    callsTrackingHost.verifyCalledOnEachEntryNTimes(CalledMapsWithSingleArg.directoryExists, [canonicalFile3Path], numberOfTimesWatchInvoked);
                    callsTrackingHost.verifyNoCall(CalledMapsWithSingleArg.getDirectories);
                    callsTrackingHost.verifyCalledOnEachEntryNTimes(CalledMapsWithSingleArg.readFile, [file3.path], 1);
                    callsTrackingHost.verifyNoCall(CalledMapsWithFiveArgs.readDirectory);
                    checkNumberOfConfiguredProjects(projectService, 1);
                    assert.strictEqual(projectService.configuredProjects.get(canonicalConfigPath), project);
                    verifyProjectAndWatchedDirectories();
                    callsTrackingHost.clear();
                    const { configFileName: configFile2 } = projectService.openClientFile(file3.path);
                    assert.equal(configFile2, configFileName);
                    checkNumberOfConfiguredProjects(projectService, 1);
                    assert.strictEqual(projectService.configuredProjects.get(canonicalConfigPath), project);
                    verifyProjectAndWatchedDirectories();
                    callsTrackingHost.verifyNoHostCalls();
                    function getFilePathIfNotOpen(f) {
                        const path = toCanonical(f.path);
                        const info = projectService.getScriptInfoForPath(toCanonical(f.path));
                        return info && info.isScriptOpen() ? undefined : path;
                    }
                    function verifyProjectAndWatchedDirectories() {
                        checkProjectActualFiles(project, ts.map(projectFiles, f => f.path));
                        projectSystem.checkWatchedFiles(host, ts.mapDefined(projectFiles, getFilePathIfNotOpen));
                        projectSystem.checkWatchedDirectories(host, watchingRecursiveDirectories, /*recursive*/ true);
                        projectSystem.checkWatchedDirectories(host, [], /*recursive*/ false);
                    }
                }
                it("case insensitive file system", () => {
                    verifyWatchDirectoriesCaseSensitivity(/*useCaseSensitiveFileNames*/ false);
                });
                it("case sensitive file system", () => {
                    verifyWatchDirectoriesCaseSensitivity(/*useCaseSensitiveFileNames*/ true);
                });
            });
            describe("Subfolder invalidations correctly include parent folder failed lookup locations", () => {
                function runFailedLookupTest(resolution) {
                    const projectLocation = "/proj";
                    const file1 = {
                        path: `${projectLocation}/foo/boo/app.ts`,
                        content: `import * as debug from "debug"`
                    };
                    const file2 = {
                        path: `${projectLocation}/foo/boo/moo/app.ts`,
                        content: `import * as debug from "debug"`
                    };
                    const tsconfig = {
                        path: `${projectLocation}/tsconfig.json`,
                        content: JSON.stringify({
                            files: ["foo/boo/app.ts", "foo/boo/moo/app.ts"],
                            moduleResolution: resolution
                        })
                    };
                    const files = [file1, file2, tsconfig, projectSystem.libFile];
                    const host = projectSystem.createServerHost(files);
                    const service = createProjectService(host);
                    service.openClientFile(file1.path);
                    const project = service.configuredProjects.get(tsconfig.path);
                    checkProjectActualFiles(project, files.map(f => f.path));
                    assert.deepEqual(project.getLanguageService().getSemanticDiagnostics(file1.path).map(diag => diag.messageText), ["Cannot find module 'debug'."]);
                    assert.deepEqual(project.getLanguageService().getSemanticDiagnostics(file2.path).map(diag => diag.messageText), ["Cannot find module 'debug'."]);
                    const debugTypesFile = {
                        path: `${projectLocation}/node_modules/debug/index.d.ts`,
                        content: "export {}"
                    };
                    files.push(debugTypesFile);
                    host.reloadFS(files);
                    host.runQueuedTimeoutCallbacks();
                    checkProjectActualFiles(project, files.map(f => f.path));
                    assert.deepEqual(project.getLanguageService().getSemanticDiagnostics(file1.path).map(diag => diag.messageText), []);
                    assert.deepEqual(project.getLanguageService().getSemanticDiagnostics(file2.path).map(diag => diag.messageText), []);
                }
                it("Includes the parent folder FLLs in node module resolution mode", () => {
                    runFailedLookupTest("Node");
                });
                it("Includes the parent folder FLLs in classic module resolution mode", () => {
                    runFailedLookupTest("Classic");
                });
            });
            describe("Verify npm install in directory with tsconfig file works when", () => {
                function verifyNpmInstall(timeoutDuringPartialInstallation) {
                    const root = "/user/username/rootfolder/otherfolder";
                    const getRootedFileOrFolder = (fileOrFolder) => {
                        fileOrFolder.path = root + fileOrFolder.path;
                        return fileOrFolder;
                    };
                    const app = getRootedFileOrFolder({
                        path: "/a/b/app.ts",
                        content: "import _ from 'lodash';"
                    });
                    const tsconfigJson = getRootedFileOrFolder({
                        path: "/a/b/tsconfig.json",
                        content: '{ "compilerOptions": { } }'
                    });
                    const packageJson = getRootedFileOrFolder({
                        path: "/a/b/package.json",
                        content: `
{
  "name": "test",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "dependencies": {
    "lodash",
    "rxjs"
  },
  "devDependencies": {
    "@types/lodash",
    "typescript"
  },
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC"
}
`
                    });
                    const appFolder = ts.getDirectoryPath(app.path);
                    const projectFiles = [app, projectSystem.libFile, tsconfigJson];
                    const typeRootDirectories = getTypeRootsFromLocation(ts.getDirectoryPath(tsconfigJson.path));
                    const otherFiles = [packageJson];
                    const host = projectSystem.createServerHost(projectFiles.concat(otherFiles));
                    const projectService = createProjectService(host);
                    const { configFileName } = projectService.openClientFile(app.path);
                    assert.equal(configFileName, tsconfigJson.path, `should find config`);
                    const recursiveWatchedDirectories = [appFolder].concat(getNodeModuleDirectories(ts.getDirectoryPath(appFolder)));
                    verifyProject();
                    let timeoutAfterReloadFs = timeoutDuringPartialInstallation;
                    // Simulate npm install
                    const filesAndFoldersToAdd = [
                        { path: "/a/b/node_modules" },
                        { path: "/a/b/node_modules/.staging/@types" },
                        { path: "/a/b/node_modules/.staging/lodash-b0733faa" },
                        { path: "/a/b/node_modules/.staging/@types/lodash-e56c4fe7" },
                        { path: "/a/b/node_modules/.staging/symbol-observable-24bcbbff" },
                        { path: "/a/b/node_modules/.staging/rxjs-22375c61" },
                        { path: "/a/b/node_modules/.staging/typescript-8493ea5d" },
                        { path: "/a/b/node_modules/.staging/symbol-observable-24bcbbff/package.json", content: "{\n  \"name\": \"symbol-observable\",\n  \"version\": \"1.0.4\",\n  \"description\": \"Symbol.observable ponyfill\",\n  \"license\": \"MIT\",\n  \"repository\": \"blesh/symbol-observable\",\n  \"author\": {\n    \"name\": \"Ben Lesh\",\n    \"email\": \"ben@benlesh.com\"\n  },\n  \"engines\": {\n    \"node\": \">=0.10.0\"\n  },\n  \"scripts\": {\n    \"test\": \"npm run build && mocha && tsc ./ts-test/test.ts && node ./ts-test/test.js && check-es3-syntax -p lib/ --kill\",\n    \"build\": \"babel es --out-dir lib\",\n    \"prepublish\": \"npm test\"\n  },\n  \"files\": [\n    \"" },
                        { path: "/a/b/node_modules/.staging/lodash-b0733faa/package.json", content: "{\n  \"name\": \"lodash\",\n  \"version\": \"4.17.4\",\n  \"description\": \"Lodash modular utilities.\",\n  \"keywords\": \"modules, stdlib, util\",\n  \"homepage\": \"https://lodash.com/\",\n  \"repository\": \"lodash/lodash\",\n  \"icon\": \"https://lodash.com/icon.svg\",\n  \"license\": \"MIT\",\n  \"main\": \"lodash.js\",\n  \"author\": \"John-David Dalton <john.david.dalton@gmail.com> (http://allyoucanleet.com/)\",\n  \"contributors\": [\n    \"John-David Dalton <john.david.dalton@gmail.com> (http://allyoucanleet.com/)\",\n    \"Mathias Bynens <mathias@qiwi." },
                        { path: "/a/b/node_modules/.staging/rxjs-22375c61/package.json", content: "{\n  \"name\": \"rxjs\",\n  \"version\": \"5.4.3\",\n  \"description\": \"Reactive Extensions for modern JavaScript\",\n  \"main\": \"Rx.js\",\n  \"config\": {\n    \"commitizen\": {\n      \"path\": \"cz-conventional-changelog\"\n    }\n  },\n  \"lint-staged\": {\n    \"*.@(js)\": [\n      \"eslint --fix\",\n      \"git add\"\n    ],\n    \"*.@(ts)\": [\n      \"tslint --fix\",\n      \"git add\"\n    ]\n  },\n  \"scripts-info\": {\n    \"info\": \"List available script\",\n    \"build_all\": \"Build all packages (ES6, CJS, UMD) and generate packages\",\n    \"build_cjs\": \"Build CJS package with clean up existing build, copy source into dist\",\n    \"build_es6\": \"Build ES6 package with clean up existing build, copy source into dist\",\n    \"build_closure_core\": \"Minify Global core build using closure compiler\",\n    \"build_global\": \"Build Global package, then minify build\",\n    \"build_perf\": \"Build CJS & Global build, run macro performance test\",\n    \"build_test\": \"Build CJS package & test spec, execute mocha test runner\",\n    \"build_cover\": \"Run lint to current code, build CJS & test spec, execute test coverage\",\n    \"build_docs\": \"Build ES6 & global package, create documentation using it\",\n    \"build_spec\": \"Build test specs\",\n    \"check_circular_dependencies\": \"Check codebase has circular dependencies\",\n    \"clean_spec\": \"Clean up existing test spec build output\",\n    \"clean_dist_cjs\": \"Clean up existing CJS package output\",\n    \"clean_dist_es6\": \"Clean up existing ES6 package output\",\n    \"clean_dist_global\": \"Clean up existing Global package output\",\n    \"commit\": \"Run git commit wizard\",\n    \"compile_dist_cjs\": \"Compile codebase into CJS module\",\n    \"compile_module_es6\": \"Compile codebase into ES6\",\n    \"cover\": \"Execute test coverage\",\n    \"lint_perf\": \"Run lint against performance test suite\",\n    \"lint_spec\": \"Run lint against test spec\",\n    \"lint_src\": \"Run lint against source\",\n    \"lint\": \"Run lint against everything\",\n    \"perf\": \"Run macro performance benchmark\",\n    \"perf_micro\": \"Run micro performance benchmark\",\n    \"test_mocha\": \"Execute mocha test runner against existing test spec build\",\n    \"test_browser\": \"Execute mocha test runner on browser against existing test spec build\",\n    \"test\": \"Clean up existing test spec build, build test spec and execute mocha test runner\",\n    \"tests2png\": \"Generate marble diagram image from test spec\",\n    \"watch\": \"Watch codebase, trigger compile when source code changes\"\n  },\n  \"repository\": {\n    \"type\": \"git\",\n    \"url\": \"git@github.com:ReactiveX/RxJS.git\"\n  },\n  \"keywords\": [\n    \"Rx\",\n    \"RxJS\",\n    \"ReactiveX\",\n    \"ReactiveExtensions\",\n    \"Streams\",\n    \"Observables\",\n    \"Observable\",\n    \"Stream\",\n    \"ES6\",\n    \"ES2015\"\n  ],\n  \"author\": \"Ben Lesh <ben@benlesh.com>\",\n  \"contributors\": [\n    {\n      \"name\": \"Ben Lesh\",\n      \"email\": \"ben@benlesh.com\"\n    },\n    {\n      \"name\": \"Paul Taylor\",\n      \"email\": \"paul.e.taylor@me.com\"\n    },\n    {\n      \"name\": \"Jeff Cross\",\n      \"email\": \"crossj@google.com\"\n    },\n    {\n      \"name\": \"Matthew Podwysocki\",\n      \"email\": \"matthewp@microsoft.com\"\n    },\n    {\n      \"name\": \"OJ Kwon\",\n      \"email\": \"kwon.ohjoong@gmail.com\"\n    },\n    {\n      \"name\": \"Andre Staltz\",\n      \"email\": \"andre@staltz.com\"\n    }\n  ],\n  \"license\": \"Apache-2.0\",\n  \"bugs\": {\n    \"url\": \"https://github.com/ReactiveX/RxJS/issues\"\n  },\n  \"homepage\": \"https://github.com/ReactiveX/RxJS\",\n  \"devDependencies\": {\n    \"babel-polyfill\": \"^6.23.0\",\n    \"benchmark\": \"^2.1.0\",\n    \"benchpress\": \"2.0.0-beta.1\",\n    \"chai\": \"^3.5.0\",\n    \"color\": \"^0.11.1\",\n    \"colors\": \"1.1.2\",\n    \"commitizen\": \"^2.8.6\",\n    \"coveralls\": \"^2.11.13\",\n    \"cz-conventional-changelog\": \"^1.2.0\",\n    \"danger\": \"^1.1.0\",\n    \"doctoc\": \"^1.0.0\",\n    \"escape-string-regexp\": \"^1.0.5 \",\n    \"esdoc\": \"^0.4.7\",\n    \"eslint\": \"^3.8.0\",\n    \"fs-extra\": \"^2.1.2\",\n    \"get-folder-size\": \"^1.0.0\",\n    \"glob\": \"^7.0.3\",\n    \"gm\": \"^1.22.0\",\n    \"google-closure-compiler-js\": \"^20170218.0.0\",\n    \"gzip-size\": \"^3.0.0\",\n    \"http-server\": \"^0.9.0\",\n    \"husky\": \"^0.13.3\",\n    \"lint-staged\": \"3.2.5\",\n    \"lodash\": \"^4.15.0\",\n    \"madge\": \"^1.4.3\",\n    \"markdown-doctest\": \"^0.9.1\",\n    \"minimist\": \"^1.2.0\",\n    \"mkdirp\": \"^0.5.1\",\n    \"mocha\": \"^3.0.2\",\n    \"mocha-in-sauce\": \"0.0.1\",\n    \"npm-run-all\": \"^4.0.2\",\n    \"npm-scripts-info\": \"^0.3.4\",\n    \"nyc\": \"^10.2.0\",\n    \"opn-cli\": \"^3.1.0\",\n    \"platform\": \"^1.3.1\",\n    \"promise\": \"^7.1.1\",\n    \"protractor\": \"^3.1.1\",\n    \"rollup\": \"0.36.3\",\n    \"rollup-plugin-inject\": \"^2.0.0\",\n    \"rollup-plugin-node-resolve\": \"^2.0.0\",\n    \"rx\": \"latest\",\n    \"rxjs\": \"latest\",\n    \"shx\": \"^0.2.2\",\n    \"sinon\": \"^2.1.0\",\n    \"sinon-chai\": \"^2.9.0\",\n    \"source-map-support\": \"^0.4.0\",\n    \"tslib\": \"^1.5.0\",\n    \"tslint\": \"^4.4.2\",\n    \"typescript\": \"~2.0.6\",\n    \"typings\": \"^2.0.0\",\n    \"validate-commit-msg\": \"^2.14.0\",\n    \"watch\": \"^1.0.1\",\n    \"webpack\": \"^1.13.1\",\n    \"xmlhttprequest\": \"1.8.0\"\n  },\n  \"engines\": {\n    \"npm\": \">=2.0.0\"\n  },\n  \"typings\": \"Rx.d.ts\",\n  \"dependencies\": {\n    \"symbol-observable\": \"^1.0.1\"\n  }\n}" },
                        { path: "/a/b/node_modules/.staging/typescript-8493ea5d/package.json", content: "{\n    \"name\": \"typescript\",\n    \"author\": \"Microsoft Corp.\",\n    \"homepage\": \"http://typescriptlang.org/\",\n    \"version\": \"2.4.2\",\n    \"license\": \"Apache-2.0\",\n    \"description\": \"TypeScript is a language for application scale JavaScript development\",\n    \"keywords\": [\n        \"TypeScript\",\n        \"Microsoft\",\n        \"compiler\",\n        \"language\",\n        \"javascript\"\n    ],\n    \"bugs\": {\n        \"url\": \"https://github.com/Microsoft/TypeScript/issues\"\n    },\n    \"repository\": {\n        \"type\": \"git\",\n        \"url\": \"https://github.com/Microsoft/TypeScript.git\"\n    },\n    \"main\": \"./lib/typescript.js\",\n    \"typings\": \"./lib/typescript.d.ts\",\n    \"bin\": {\n        \"tsc\": \"./bin/tsc\",\n        \"tsserver\": \"./bin/tsserver\"\n    },\n    \"engines\": {\n        \"node\": \">=4.2.0\"\n    },\n    \"devDependencies\": {\n        \"@types/browserify\": \"latest\",\n        \"@types/chai\": \"latest\",\n        \"@types/convert-source-map\": \"latest\",\n        \"@types/del\": \"latest\",\n        \"@types/glob\": \"latest\",\n        \"@types/gulp\": \"latest\",\n        \"@types/gulp-concat\": \"latest\",\n        \"@types/gulp-help\": \"latest\",\n        \"@types/gulp-newer\": \"latest\",\n        \"@types/gulp-sourcemaps\": \"latest\",\n        \"@types/merge2\": \"latest\",\n        \"@types/minimatch\": \"latest\",\n        \"@types/minimist\": \"latest\",\n        \"@types/mkdirp\": \"latest\",\n        \"@types/mocha\": \"latest\",\n        \"@types/node\": \"latest\",\n        \"@types/q\": \"latest\",\n        \"@types/run-sequence\": \"latest\",\n        \"@types/through2\": \"latest\",\n        \"browserify\": \"latest\",\n        \"chai\": \"latest\",\n        \"convert-source-map\": \"latest\",\n        \"del\": \"latest\",\n        \"gulp\": \"latest\",\n        \"gulp-clone\": \"latest\",\n        \"gulp-concat\": \"latest\",\n        \"gulp-help\": \"latest\",\n        \"gulp-insert\": \"latest\",\n        \"gulp-newer\": \"latest\",\n        \"gulp-sourcemaps\": \"latest\",\n        \"gulp-typescript\": \"latest\",\n        \"into-stream\": \"latest\",\n        \"istanbul\": \"latest\",\n        \"jake\": \"latest\",\n        \"merge2\": \"latest\",\n        \"minimist\": \"latest\",\n        \"mkdirp\": \"latest\",\n        \"mocha\": \"latest\",\n        \"mocha-fivemat-progress-reporter\": \"latest\",\n        \"q\": \"latest\",\n        \"run-sequence\": \"latest\",\n        \"sorcery\": \"latest\",\n        \"through2\": \"latest\",\n        \"travis-fold\": \"latest\",\n        \"ts-node\": \"latest\",\n        \"tslint\": \"latest\",\n        \"typescript\": \"^2.4\"\n    },\n    \"scripts\": {\n        \"pretest\": \"jake tests\",\n        \"test\": \"jake runtests-parallel\",\n        \"build\": \"npm run build:compiler && npm run build:tests\",\n        \"build:compiler\": \"jake local\",\n        \"build:tests\": \"jake tests\",\n        \"start\": \"node lib/tsc\",\n        \"clean\": \"jake clean\",\n        \"gulp\": \"gulp\",\n        \"jake\": \"jake\",\n        \"lint\": \"jake lint\",\n        \"setup-hooks\": \"node scripts/link-hooks.js\"\n    },\n    \"browser\": {\n        \"buffer\": false,\n        \"fs\": false,\n        \"os\": false,\n        \"path\": false\n    }\n}" },
                        { path: "/a/b/node_modules/.staging/symbol-observable-24bcbbff/index.js", content: "module.exports = require('./lib/index');\n" },
                        { path: "/a/b/node_modules/.staging/symbol-observable-24bcbbff/index.d.ts", content: "declare const observableSymbol: symbol;\nexport default observableSymbol;\n" },
                        { path: "/a/b/node_modules/.staging/symbol-observable-24bcbbff/lib" },
                        { path: "/a/b/node_modules/.staging/symbol-observable-24bcbbff/lib/index.js", content: "'use strict';\n\nObject.defineProperty(exports, \"__esModule\", {\n  value: true\n});\n\nvar _ponyfill = require('./ponyfill');\n\nvar _ponyfill2 = _interopRequireDefault(_ponyfill);\n\nfunction _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }\n\nvar root; /* global window */\n\n\nif (typeof self !== 'undefined') {\n  root = self;\n} else if (typeof window !== 'undefined') {\n  root = window;\n} else if (typeof global !== 'undefined') {\n  root = global;\n} else if (typeof module !== 'undefined') {\n  root = module;\n} else {\n  root = Function('return this')();\n}\n\nvar result = (0, _ponyfill2['default'])(root);\nexports['default'] = result;" },
                    ].map(getRootedFileOrFolder);
                    verifyAfterPartialOrCompleteNpmInstall(2);
                    filesAndFoldersToAdd.push(...[
                        { path: "/a/b/node_modules/.staging/typescript-8493ea5d/lib" },
                        { path: "/a/b/node_modules/.staging/rxjs-22375c61/add/operator" },
                        { path: "/a/b/node_modules/.staging/@types/lodash-e56c4fe7/package.json", content: "{\n    \"name\": \"@types/lodash\",\n    \"version\": \"4.14.74\",\n    \"description\": \"TypeScript definitions for Lo-Dash\",\n    \"license\": \"MIT\",\n    \"contributors\": [\n        {\n            \"name\": \"Brian Zengel\",\n            \"url\": \"https://github.com/bczengel\"\n        },\n        {\n            \"name\": \"Ilya Mochalov\",\n            \"url\": \"https://github.com/chrootsu\"\n        },\n        {\n            \"name\": \"Stepan Mikhaylyuk\",\n            \"url\": \"https://github.com/stepancar\"\n        },\n        {\n            \"name\": \"Eric L Anderson\",\n            \"url\": \"https://github.com/ericanderson\"\n        },\n        {\n            \"name\": \"AJ Richardson\",\n            \"url\": \"https://github.com/aj-r\"\n        },\n        {\n            \"name\": \"Junyoung Clare Jang\",\n            \"url\": \"https://github.com/ailrun\"\n        }\n    ],\n    \"main\": \"\",\n    \"repository\": {\n        \"type\": \"git\",\n        \"url\": \"https://www.github.com/DefinitelyTyped/DefinitelyTyped.git\"\n    },\n    \"scripts\": {},\n    \"dependencies\": {},\n    \"typesPublisherContentHash\": \"12af578ffaf8d86d2df37e591857906a86b983fa9258414326544a0fe6af0de8\",\n    \"typeScriptVersion\": \"2.2\"\n}" },
                        { path: "/a/b/node_modules/.staging/lodash-b0733faa/index.js", content: "module.exports = require('./lodash');" },
                        { path: "/a/b/node_modules/.staging/typescript-8493ea5d/package.json.3017591594" }
                    ].map(getRootedFileOrFolder));
                    // Since we added/removed folder, scheduled project update
                    verifyAfterPartialOrCompleteNpmInstall(2);
                    // Remove file "/a/b/node_modules/.staging/typescript-8493ea5d/package.json.3017591594"
                    filesAndFoldersToAdd.length--;
                    verifyAfterPartialOrCompleteNpmInstall(0);
                    filesAndFoldersToAdd.push(...[
                        { path: "/a/b/node_modules/.staging/rxjs-22375c61/bundles" },
                        { path: "/a/b/node_modules/.staging/rxjs-22375c61/operator" },
                        { path: "/a/b/node_modules/.staging/rxjs-22375c61/src/add/observable/dom" },
                        { path: "/a/b/node_modules/.staging/@types/lodash-e56c4fe7/index.d.ts", content: "\n// Stub for lodash\nexport = _;\nexport as namespace _;\ndeclare var _: _.LoDashStatic;\ndeclare namespace _ {\n    interface LoDashStatic {\n        someProp: string;\n    }\n    class SomeClass {\n        someMethod(): void;\n    }\n}" }
                    ].map(getRootedFileOrFolder));
                    verifyAfterPartialOrCompleteNpmInstall(2);
                    filesAndFoldersToAdd.push(...[
                        { path: "/a/b/node_modules/.staging/rxjs-22375c61/src/scheduler" },
                        { path: "/a/b/node_modules/.staging/rxjs-22375c61/src/util" },
                        { path: "/a/b/node_modules/.staging/rxjs-22375c61/symbol" },
                        { path: "/a/b/node_modules/.staging/rxjs-22375c61/testing" },
                        { path: "/a/b/node_modules/.staging/rxjs-22375c61/package.json.2252192041", content: "{\n  \"_args\": [\n    [\n      {\n        \"raw\": \"rxjs@^5.4.2\",\n        \"scope\": null,\n        \"escapedName\": \"rxjs\",\n        \"name\": \"rxjs\",\n        \"rawSpec\": \"^5.4.2\",\n        \"spec\": \">=5.4.2 <6.0.0\",\n        \"type\": \"range\"\n      },\n      \"C:\\\\Users\\\\shkamat\\\\Desktop\\\\app\"\n    ]\n  ],\n  \"_from\": \"rxjs@>=5.4.2 <6.0.0\",\n  \"_id\": \"rxjs@5.4.3\",\n  \"_inCache\": true,\n  \"_location\": \"/rxjs\",\n  \"_nodeVersion\": \"7.7.2\",\n  \"_npmOperationalInternal\": {\n    \"host\": \"s3://npm-registry-packages\",\n    \"tmp\": \"tmp/rxjs-5.4.3.tgz_1502407898166_0.6800217325799167\"\n  },\n  \"_npmUser\": {\n    \"name\": \"blesh\",\n    \"email\": \"ben@benlesh.com\"\n  },\n  \"_npmVersion\": \"5.3.0\",\n  \"_phantomChildren\": {},\n  \"_requested\": {\n    \"raw\": \"rxjs@^5.4.2\",\n    \"scope\": null,\n    \"escapedName\": \"rxjs\",\n    \"name\": \"rxjs\",\n    \"rawSpec\": \"^5.4.2\",\n    \"spec\": \">=5.4.2 <6.0.0\",\n    \"type\": \"range\"\n  },\n  \"_requiredBy\": [\n    \"/\"\n  ],\n  \"_resolved\": \"https://registry.npmjs.org/rxjs/-/rxjs-5.4.3.tgz\",\n  \"_shasum\": \"0758cddee6033d68e0fd53676f0f3596ce3d483f\",\n  \"_shrinkwrap\": null,\n  \"_spec\": \"rxjs@^5.4.2\",\n  \"_where\": \"C:\\\\Users\\\\shkamat\\\\Desktop\\\\app\",\n  \"author\": {\n    \"name\": \"Ben Lesh\",\n    \"email\": \"ben@benlesh.com\"\n  },\n  \"bugs\": {\n    \"url\": \"https://github.com/ReactiveX/RxJS/issues\"\n  },\n  \"config\": {\n    \"commitizen\": {\n      \"path\": \"cz-conventional-changelog\"\n    }\n  },\n  \"contributors\": [\n    {\n      \"name\": \"Ben Lesh\",\n      \"email\": \"ben@benlesh.com\"\n    },\n    {\n      \"name\": \"Paul Taylor\",\n      \"email\": \"paul.e.taylor@me.com\"\n    },\n    {\n      \"name\": \"Jeff Cross\",\n      \"email\": \"crossj@google.com\"\n    },\n    {\n      \"name\": \"Matthew Podwysocki\",\n      \"email\": \"matthewp@microsoft.com\"\n    },\n    {\n      \"name\": \"OJ Kwon\",\n      \"email\": \"kwon.ohjoong@gmail.com\"\n    },\n    {\n      \"name\": \"Andre Staltz\",\n      \"email\": \"andre@staltz.com\"\n    }\n  ],\n  \"dependencies\": {\n    \"symbol-observable\": \"^1.0.1\"\n  },\n  \"description\": \"Reactive Extensions for modern JavaScript\",\n  \"devDependencies\": {\n    \"babel-polyfill\": \"^6.23.0\",\n    \"benchmark\": \"^2.1.0\",\n    \"benchpress\": \"2.0.0-beta.1\",\n    \"chai\": \"^3.5.0\",\n    \"color\": \"^0.11.1\",\n    \"colors\": \"1.1.2\",\n    \"commitizen\": \"^2.8.6\",\n    \"coveralls\": \"^2.11.13\",\n    \"cz-conventional-changelog\": \"^1.2.0\",\n    \"danger\": \"^1.1.0\",\n    \"doctoc\": \"^1.0.0\",\n    \"escape-string-regexp\": \"^1.0.5 \",\n    \"esdoc\": \"^0.4.7\",\n    \"eslint\": \"^3.8.0\",\n    \"fs-extra\": \"^2.1.2\",\n    \"get-folder-size\": \"^1.0.0\",\n    \"glob\": \"^7.0.3\",\n    \"gm\": \"^1.22.0\",\n    \"google-closure-compiler-js\": \"^20170218.0.0\",\n    \"gzip-size\": \"^3.0.0\",\n    \"http-server\": \"^0.9.0\",\n    \"husky\": \"^0.13.3\",\n    \"lint-staged\": \"3.2.5\",\n    \"lodash\": \"^4.15.0\",\n    \"madge\": \"^1.4.3\",\n    \"markdown-doctest\": \"^0.9.1\",\n    \"minimist\": \"^1.2.0\",\n    \"mkdirp\": \"^0.5.1\",\n    \"mocha\": \"^3.0.2\",\n    \"mocha-in-sauce\": \"0.0.1\",\n    \"npm-run-all\": \"^4.0.2\",\n    \"npm-scripts-info\": \"^0.3.4\",\n    \"nyc\": \"^10.2.0\",\n    \"opn-cli\": \"^3.1.0\",\n    \"platform\": \"^1.3.1\",\n    \"promise\": \"^7.1.1\",\n    \"protractor\": \"^3.1.1\",\n    \"rollup\": \"0.36.3\",\n    \"rollup-plugin-inject\": \"^2.0.0\",\n    \"rollup-plugin-node-resolve\": \"^2.0.0\",\n    \"rx\": \"latest\",\n    \"rxjs\": \"latest\",\n    \"shx\": \"^0.2.2\",\n    \"sinon\": \"^2.1.0\",\n    \"sinon-chai\": \"^2.9.0\",\n    \"source-map-support\": \"^0.4.0\",\n    \"tslib\": \"^1.5.0\",\n    \"tslint\": \"^4.4.2\",\n    \"typescript\": \"~2.0.6\",\n    \"typings\": \"^2.0.0\",\n    \"validate-commit-msg\": \"^2.14.0\",\n    \"watch\": \"^1.0.1\",\n    \"webpack\": \"^1.13.1\",\n    \"xmlhttprequest\": \"1.8.0\"\n  },\n  \"directories\": {},\n  \"dist\": {\n    \"integrity\": \"sha512-fSNi+y+P9ss+EZuV0GcIIqPUK07DEaMRUtLJvdcvMyFjc9dizuDjere+A4V7JrLGnm9iCc+nagV/4QdMTkqC4A==\",\n    \"shasum\": \"0758cddee6033d68e0fd53676f0f3596ce3d483f\",\n    \"tarball\": \"https://registry.npmjs.org/rxjs/-/rxjs-5.4.3.tgz\"\n  },\n  \"engines\": {\n    \"npm\": \">=2.0.0\"\n  },\n  \"homepage\": \"https://github.com/ReactiveX/RxJS\",\n  \"keywords\": [\n    \"Rx\",\n    \"RxJS\",\n    \"ReactiveX\",\n    \"ReactiveExtensions\",\n    \"Streams\",\n    \"Observables\",\n    \"Observable\",\n    \"Stream\",\n    \"ES6\",\n    \"ES2015\"\n  ],\n  \"license\": \"Apache-2.0\",\n  \"lint-staged\": {\n    \"*.@(js)\": [\n      \"eslint --fix\",\n      \"git add\"\n    ],\n    \"*.@(ts)\": [\n      \"tslint --fix\",\n      \"git add\"\n    ]\n  },\n  \"main\": \"Rx.js\",\n  \"maintainers\": [\n    {\n      \"name\": \"blesh\",\n      \"email\": \"ben@benlesh.com\"\n    }\n  ],\n  \"name\": \"rxjs\",\n  \"optionalDependencies\": {},\n  \"readme\": \"ERROR: No README data found!\",\n  \"repository\": {\n    \"type\": \"git\",\n    \"url\": \"git+ssh://git@github.com/ReactiveX/RxJS.git\"\n  },\n  \"scripts-info\": {\n    \"info\": \"List available script\",\n    \"build_all\": \"Build all packages (ES6, CJS, UMD) and generate packages\",\n    \"build_cjs\": \"Build CJS package with clean up existing build, copy source into dist\",\n    \"build_es6\": \"Build ES6 package with clean up existing build, copy source into dist\",\n    \"build_closure_core\": \"Minify Global core build using closure compiler\",\n    \"build_global\": \"Build Global package, then minify build\",\n    \"build_perf\": \"Build CJS & Global build, run macro performance test\",\n    \"build_test\": \"Build CJS package & test spec, execute mocha test runner\",\n    \"build_cover\": \"Run lint to current code, build CJS & test spec, execute test coverage\",\n    \"build_docs\": \"Build ES6 & global package, create documentation using it\",\n    \"build_spec\": \"Build test specs\",\n    \"check_circular_dependencies\": \"Check codebase has circular dependencies\",\n    \"clean_spec\": \"Clean up existing test spec build output\",\n    \"clean_dist_cjs\": \"Clean up existing CJS package output\",\n    \"clean_dist_es6\": \"Clean up existing ES6 package output\",\n    \"clean_dist_global\": \"Clean up existing Global package output\",\n    \"commit\": \"Run git commit wizard\",\n    \"compile_dist_cjs\": \"Compile codebase into CJS module\",\n    \"compile_module_es6\": \"Compile codebase into ES6\",\n    \"cover\": \"Execute test coverage\",\n    \"lint_perf\": \"Run lint against performance test suite\",\n    \"lint_spec\": \"Run lint against test spec\",\n    \"lint_src\": \"Run lint against source\",\n    \"lint\": \"Run lint against everything\",\n    \"perf\": \"Run macro performance benchmark\",\n    \"perf_micro\": \"Run micro performance benchmark\",\n    \"test_mocha\": \"Execute mocha test runner against existing test spec build\",\n    \"test_browser\": \"Execute mocha test runner on browser against existing test spec build\",\n    \"test\": \"Clean up existing test spec build, build test spec and execute mocha test runner\",\n    \"tests2png\": \"Generate marble diagram image from test spec\",\n    \"watch\": \"Watch codebase, trigger compile when source code changes\"\n  },\n  \"typings\": \"Rx.d.ts\",\n  \"version\": \"5.4.3\"\n}\n" }
                    ].map(getRootedFileOrFolder));
                    verifyAfterPartialOrCompleteNpmInstall(2);
                    // remove /a/b/node_modules/.staging/rxjs-22375c61/package.json.2252192041
                    filesAndFoldersToAdd.length--;
                    // and add few more folders/files
                    filesAndFoldersToAdd.push(...[
                        { path: "/a/b/node_modules/symbol-observable" },
                        { path: "/a/b/node_modules/@types" },
                        { path: "/a/b/node_modules/@types/lodash" },
                        { path: "/a/b/node_modules/lodash" },
                        { path: "/a/b/node_modules/rxjs" },
                        { path: "/a/b/node_modules/typescript" },
                        { path: "/a/b/node_modules/.bin" }
                    ].map(getRootedFileOrFolder));
                    // From the type root update
                    verifyAfterPartialOrCompleteNpmInstall(2);
                    ts.forEach(filesAndFoldersToAdd, f => {
                        f.path = f.path
                            .replace("/a/b/node_modules/.staging", "/a/b/node_modules")
                            .replace(/[\-\.][\d\w][\d\w][\d\w][\d\w][\d\w][\d\w][\d\w][\d\w]/g, "");
                    });
                    const lodashIndexPath = root + "/a/b/node_modules/@types/lodash/index.d.ts";
                    projectFiles.push(ts.find(filesAndFoldersToAdd, f => f.path === lodashIndexPath));
                    // we would now not have failed lookup in the parent of appFolder since lodash is available
                    recursiveWatchedDirectories.length = 1;
                    // npm installation complete, timeout after reload fs
                    timeoutAfterReloadFs = true;
                    verifyAfterPartialOrCompleteNpmInstall(2);
                    function verifyAfterPartialOrCompleteNpmInstall(timeoutQueueLengthWhenRunningTimeouts) {
                        host.reloadFS(projectFiles.concat(otherFiles, filesAndFoldersToAdd));
                        if (timeoutAfterReloadFs) {
                            host.checkTimeoutQueueLengthAndRun(timeoutQueueLengthWhenRunningTimeouts);
                        }
                        else {
                            host.checkTimeoutQueueLength(2);
                        }
                        verifyProject();
                    }
                    function verifyProject() {
                        checkNumberOfConfiguredProjects(projectService, 1);
                        const project = projectService.configuredProjects.get(tsconfigJson.path);
                        const projectFilePaths = ts.map(projectFiles, f => f.path);
                        checkProjectActualFiles(project, projectFilePaths);
                        const filesWatched = ts.filter(projectFilePaths, p => p !== app.path);
                        projectSystem.checkWatchedFiles(host, filesWatched);
                        projectSystem.checkWatchedDirectories(host, typeRootDirectories.concat(recursiveWatchedDirectories), /*recursive*/ true);
                        projectSystem.checkWatchedDirectories(host, [], /*recursive*/ false);
                    }
                }
                it("timeouts occur inbetween installation", () => {
                    verifyNpmInstall(/*timeoutDuringPartialInstallation*/ true);
                });
                it("timeout occurs after installation", () => {
                    verifyNpmInstall(/*timeoutDuringPartialInstallation*/ false);
                });
            });
            it("when node_modules dont receive event for the @types file addition", () => {
                const projectLocation = "/user/username/folder/myproject";
                const app = {
                    path: `${projectLocation}/app.ts`,
                    content: `import * as debug from "debug"`
                };
                const tsconfig = {
                    path: `${projectLocation}/tsconfig.json`,
                    content: ""
                };
                const files = [app, tsconfig, projectSystem.libFile];
                const host = projectSystem.createServerHost(files);
                const service = createProjectService(host);
                service.openClientFile(app.path);
                const project = service.configuredProjects.get(tsconfig.path);
                checkProjectActualFiles(project, files.map(f => f.path));
                assert.deepEqual(project.getLanguageService().getSemanticDiagnostics(app.path).map(diag => diag.messageText), ["Cannot find module 'debug'."]);
                const debugTypesFile = {
                    path: `${projectLocation}/node_modules/@types/debug/index.d.ts`,
                    content: "export {}"
                };
                files.push(debugTypesFile);
                // Do not invoke recursive directory watcher for anything other than node_module/@types
                const invoker = host.invokeWatchedDirectoriesRecursiveCallback;
                host.invokeWatchedDirectoriesRecursiveCallback = (fullPath, relativePath) => {
                    if (fullPath.endsWith("@types")) {
                        invoker.call(host, fullPath, relativePath);
                    }
                };
                host.reloadFS(files);
                host.runQueuedTimeoutCallbacks();
                checkProjectActualFiles(project, files.map(f => f.path));
                assert.deepEqual(project.getLanguageService().getSemanticDiagnostics(app.path).map(diag => diag.messageText), []);
            });
        });
        describe("tsserverProjectSystem ProjectsChangedInBackground", () => {
            function verifyFiles(caption, actual, expected) {
                assert.equal(actual.length, expected.length, `Incorrect number of ${caption}. Actual: ${actual} Expected: ${expected}`);
                const seen = ts.createMap();
                ts.forEach(actual, f => {
                    assert.isFalse(seen.has(f), `${caption}: Found duplicate ${f}. Actual: ${actual} Expected: ${expected}`);
                    seen.set(f, true);
                    assert.isTrue(ts.contains(expected, f), `${caption}: Expected not to contain ${f}. Actual: ${actual} Expected: ${expected}`);
                });
            }
            function createVerifyInitialOpen(session, verifyProjectsUpdatedInBackgroundEventHandler) {
                return (file) => {
                    session.executeCommandSeq({
                        command: ts.server.CommandNames.Open,
                        arguments: {
                            file: file.path
                        }
                    });
                    verifyProjectsUpdatedInBackgroundEventHandler([]);
                };
            }
            function verifyProjectsUpdatedInBackgroundEvent(createSession) {
                it("when adding new file", () => {
                    const commonFile1 = {
                        path: "/a/b/file1.ts",
                        content: "export var x = 10;"
                    };
                    const commonFile2 = {
                        path: "/a/b/file2.ts",
                        content: "export var y = 10;"
                    };
                    const commonFile3 = {
                        path: "/a/b/file3.ts",
                        content: "export var z = 10;"
                    };
                    const configFile = {
                        path: "/a/b/tsconfig.json",
                        content: `{}`
                    };
                    const openFiles = [commonFile1.path];
                    const host = projectSystem.createServerHost([commonFile1, projectSystem.libFile, configFile]);
                    const { verifyProjectsUpdatedInBackgroundEventHandler, verifyInitialOpen } = createSession(host);
                    verifyInitialOpen(commonFile1);
                    host.reloadFS([commonFile1, projectSystem.libFile, configFile, commonFile2]);
                    host.runQueuedTimeoutCallbacks();
                    verifyProjectsUpdatedInBackgroundEventHandler([{
                            eventName: ts.server.ProjectsUpdatedInBackgroundEvent,
                            data: {
                                openFiles
                            }
                        }]);
                    host.reloadFS([commonFile1, commonFile2, projectSystem.libFile, configFile, commonFile3]);
                    host.runQueuedTimeoutCallbacks();
                    verifyProjectsUpdatedInBackgroundEventHandler([{
                            eventName: ts.server.ProjectsUpdatedInBackgroundEvent,
                            data: {
                                openFiles
                            }
                        }]);
                });
                describe("with --out or --outFile setting", () => {
                    function verifyEventWithOutSettings(compilerOptions = {}) {
                        const config = {
                            path: "/a/tsconfig.json",
                            content: JSON.stringify({
                                compilerOptions
                            })
                        };
                        const f1 = {
                            path: "/a/a.ts",
                            content: "export let x = 1"
                        };
                        const f2 = {
                            path: "/a/b.ts",
                            content: "export let y = 1"
                        };
                        const openFiles = [f1.path];
                        const files = [f1, config, projectSystem.libFile];
                        const host = projectSystem.createServerHost(files);
                        const { verifyInitialOpen, verifyProjectsUpdatedInBackgroundEventHandler } = createSession(host);
                        verifyInitialOpen(f1);
                        files.push(f2);
                        host.reloadFS(files);
                        host.runQueuedTimeoutCallbacks();
                        verifyProjectsUpdatedInBackgroundEventHandler([{
                                eventName: ts.server.ProjectsUpdatedInBackgroundEvent,
                                data: {
                                    openFiles
                                }
                            }]);
                        f2.content = "export let x = 11";
                        host.reloadFS(files);
                        host.runQueuedTimeoutCallbacks();
                        verifyProjectsUpdatedInBackgroundEventHandler([{
                                eventName: ts.server.ProjectsUpdatedInBackgroundEvent,
                                data: {
                                    openFiles
                                }
                            }]);
                    }
                    it("when both options are not set", () => {
                        verifyEventWithOutSettings();
                    });
                    it("when --out is set", () => {
                        const outJs = "/a/out.js";
                        verifyEventWithOutSettings({ out: outJs });
                    });
                    it("when --outFile is set", () => {
                        const outJs = "/a/out.js";
                        verifyEventWithOutSettings({ outFile: outJs });
                    });
                });
                describe("with modules and configured project", () => {
                    const file1Consumer1Path = "/a/b/file1Consumer1.ts";
                    const moduleFile1Path = "/a/b/moduleFile1.ts";
                    const configFilePath = "/a/b/tsconfig.json";
                    function getInitialState({ configObj = {}, getAdditionalFileOrFolder, firstReloadFileList } = {}) {
                        const moduleFile1 = {
                            path: moduleFile1Path,
                            content: "export function Foo() { };",
                        };
                        const file1Consumer1 = {
                            path: file1Consumer1Path,
                            content: `import {Foo} from "./moduleFile1"; export var y = 10;`,
                        };
                        const file1Consumer2 = {
                            path: "/a/b/file1Consumer2.ts",
                            content: `import {Foo} from "./moduleFile1"; let z = 10;`,
                        };
                        const moduleFile2 = {
                            path: "/a/b/moduleFile2.ts",
                            content: `export var Foo4 = 10;`,
                        };
                        const globalFile3 = {
                            path: "/a/b/globalFile3.ts",
                            content: `interface GlobalFoo { age: number }`
                        };
                        const additionalFiles = getAdditionalFileOrFolder ? getAdditionalFileOrFolder() : [];
                        const configFile = {
                            path: configFilePath,
                            content: JSON.stringify(configObj || { compilerOptions: {} })
                        };
                        const files = [file1Consumer1, moduleFile1, file1Consumer2, moduleFile2, ...additionalFiles, globalFile3, projectSystem.libFile, configFile];
                        const filesToReload = firstReloadFileList && getFiles(firstReloadFileList) || files;
                        const host = projectSystem.createServerHost([filesToReload[0], configFile]);
                        // Initial project creation
                        const { session, verifyProjectsUpdatedInBackgroundEventHandler, verifyInitialOpen } = createSession(host);
                        const openFiles = [filesToReload[0].path];
                        verifyInitialOpen(filesToReload[0]);
                        // Since this is first event, it will have all the files
                        verifyProjectsUpdatedInBackgroundEvent(filesToReload);
                        return {
                            moduleFile1, file1Consumer1, file1Consumer2, moduleFile2, globalFile3, configFile,
                            files,
                            updateContentOfOpenFile,
                            verifyNoProjectsUpdatedInBackgroundEvent,
                            verifyProjectsUpdatedInBackgroundEvent
                        };
                        function getFiles(filelist) {
                            return ts.map(filelist, getFile);
                        }
                        function getFile(fileName) {
                            return ts.find(files, file => file.path === fileName);
                        }
                        function verifyNoProjectsUpdatedInBackgroundEvent(filesToReload) {
                            host.reloadFS(filesToReload || files);
                            host.runQueuedTimeoutCallbacks();
                            verifyProjectsUpdatedInBackgroundEventHandler([]);
                        }
                        function verifyProjectsUpdatedInBackgroundEvent(filesToReload) {
                            host.reloadFS(filesToReload || files);
                            host.runQueuedTimeoutCallbacks();
                            verifyProjectsUpdatedInBackgroundEventHandler([{
                                    eventName: ts.server.ProjectsUpdatedInBackgroundEvent,
                                    data: {
                                        openFiles
                                    }
                                }]);
                        }
                        function updateContentOfOpenFile(file, newContent) {
                            session.executeCommandSeq({
                                command: ts.server.CommandNames.Change,
                                arguments: {
                                    file: file.path,
                                    insertString: newContent,
                                    endLine: 1,
                                    endOffset: file.content.length,
                                    line: 1,
                                    offset: 1
                                }
                            });
                            file.content = newContent;
                        }
                    }
                    it("should contains only itself if a module file's shape didn't change, and all files referencing it if its shape changed", () => {
                        const { moduleFile1, verifyProjectsUpdatedInBackgroundEvent } = getInitialState();
                        // Change the content of moduleFile1 to `export var T: number;export function Foo() { };`
                        moduleFile1.content = `export var T: number;export function Foo() { };`;
                        verifyProjectsUpdatedInBackgroundEvent();
                        // Change the content of moduleFile1 to `export var T: number;export function Foo() { console.log('hi'); };`
                        moduleFile1.content = `export var T: number;export function Foo() { console.log('hi'); };`;
                        verifyProjectsUpdatedInBackgroundEvent();
                    });
                    it("should be up-to-date with the reference map changes", () => {
                        const { moduleFile1, file1Consumer1, updateContentOfOpenFile, verifyProjectsUpdatedInBackgroundEvent, verifyNoProjectsUpdatedInBackgroundEvent } = getInitialState();
                        // Change file1Consumer1 content to `export let y = Foo();`
                        updateContentOfOpenFile(file1Consumer1, "export let y = Foo();");
                        verifyNoProjectsUpdatedInBackgroundEvent();
                        // Change the content of moduleFile1 to `export var T: number;export function Foo() { };`
                        moduleFile1.content = `export var T: number;export function Foo() { };`;
                        verifyProjectsUpdatedInBackgroundEvent();
                        // Add the import statements back to file1Consumer1
                        updateContentOfOpenFile(file1Consumer1, `import {Foo} from "./moduleFile1";let y = Foo();`);
                        verifyNoProjectsUpdatedInBackgroundEvent();
                        // Change the content of moduleFile1 to `export var T: number;export var T2: string;export function Foo() { };`
                        moduleFile1.content = `export var T: number;export var T2: string;export function Foo() { };`;
                        verifyProjectsUpdatedInBackgroundEvent();
                        // Multiple file edits in one go:
                        // Change file1Consumer1 content to `export let y = Foo();`
                        // Change the content of moduleFile1 to `export var T: number;export function Foo() { };`
                        updateContentOfOpenFile(file1Consumer1, `export let y = Foo();`);
                        moduleFile1.content = `export var T: number;export function Foo() { };`;
                        verifyProjectsUpdatedInBackgroundEvent();
                    });
                    it("should be up-to-date with deleted files", () => {
                        const { moduleFile1, file1Consumer2, files, verifyProjectsUpdatedInBackgroundEvent } = getInitialState();
                        // Change the content of moduleFile1 to `export var T: number;export function Foo() { };`
                        moduleFile1.content = `export var T: number;export function Foo() { };`;
                        // Delete file1Consumer2
                        const filesToLoad = ts.filter(files, file => file !== file1Consumer2);
                        verifyProjectsUpdatedInBackgroundEvent(filesToLoad);
                    });
                    it("should be up-to-date with newly created files", () => {
                        const { moduleFile1, files, verifyProjectsUpdatedInBackgroundEvent, } = getInitialState();
                        const file1Consumer3 = {
                            path: "/a/b/file1Consumer3.ts",
                            content: `import {Foo} from "./moduleFile1"; let y = Foo();`
                        };
                        moduleFile1.content = `export var T: number;export function Foo() { };`;
                        verifyProjectsUpdatedInBackgroundEvent(files.concat(file1Consumer3));
                    });
                    it("should detect changes in non-root files", () => {
                        const { moduleFile1, verifyProjectsUpdatedInBackgroundEvent } = getInitialState({
                            configObj: { files: [file1Consumer1Path] },
                        });
                        moduleFile1.content = `export var T: number;export function Foo() { };`;
                        verifyProjectsUpdatedInBackgroundEvent();
                        // change file1 internal, and verify only file1 is affected
                        moduleFile1.content += "var T1: number;";
                        verifyProjectsUpdatedInBackgroundEvent();
                    });
                    it("should return all files if a global file changed shape", () => {
                        const { globalFile3, verifyProjectsUpdatedInBackgroundEvent } = getInitialState();
                        globalFile3.content += "var T2: string;";
                        verifyProjectsUpdatedInBackgroundEvent();
                    });
                    it("should always return the file itself if '--isolatedModules' is specified", () => {
                        const { moduleFile1, verifyProjectsUpdatedInBackgroundEvent } = getInitialState({
                            configObj: { compilerOptions: { isolatedModules: true } }
                        });
                        moduleFile1.content = `export var T: number;export function Foo() { };`;
                        verifyProjectsUpdatedInBackgroundEvent();
                    });
                    it("should always return the file itself if '--out' or '--outFile' is specified", () => {
                        const outFilePath = "/a/b/out.js";
                        const { moduleFile1, verifyProjectsUpdatedInBackgroundEvent } = getInitialState({
                            configObj: { compilerOptions: { module: "system", outFile: outFilePath } }
                        });
                        moduleFile1.content = `export var T: number;export function Foo() { };`;
                        verifyProjectsUpdatedInBackgroundEvent();
                    });
                    it("should return cascaded affected file list", () => {
                        const file1Consumer1Consumer1 = {
                            path: "/a/b/file1Consumer1Consumer1.ts",
                            content: `import {y} from "./file1Consumer1";`
                        };
                        const { moduleFile1, file1Consumer1, updateContentOfOpenFile, verifyNoProjectsUpdatedInBackgroundEvent, verifyProjectsUpdatedInBackgroundEvent } = getInitialState({
                            getAdditionalFileOrFolder: () => [file1Consumer1Consumer1]
                        });
                        updateContentOfOpenFile(file1Consumer1, file1Consumer1.content + "export var T: number;");
                        verifyNoProjectsUpdatedInBackgroundEvent();
                        // Doesnt change the shape of file1Consumer1
                        moduleFile1.content = `export var T: number;export function Foo() { };`;
                        verifyProjectsUpdatedInBackgroundEvent();
                        // Change both files before the timeout
                        updateContentOfOpenFile(file1Consumer1, file1Consumer1.content + "export var T2: number;");
                        moduleFile1.content = `export var T2: number;export function Foo() { };`;
                        verifyProjectsUpdatedInBackgroundEvent();
                    });
                    it("should work fine for files with circular references", () => {
                        const file1 = {
                            path: "/a/b/file1.ts",
                            content: `
                    /// <reference path="./file2.ts" />
                    export var t1 = 10;`
                        };
                        const file2 = {
                            path: "/a/b/file2.ts",
                            content: `
                    /// <reference path="./file1.ts" />
                    export var t2 = 10;`
                        };
                        const { configFile, verifyProjectsUpdatedInBackgroundEvent } = getInitialState({
                            getAdditionalFileOrFolder: () => [file1, file2],
                            firstReloadFileList: [file1.path, projectSystem.libFile.path, file2.path, configFilePath]
                        });
                        file2.content += "export var t3 = 10;";
                        verifyProjectsUpdatedInBackgroundEvent([file1, file2, projectSystem.libFile, configFile]);
                    });
                    it("should detect removed code file", () => {
                        const referenceFile1 = {
                            path: "/a/b/referenceFile1.ts",
                            content: `
                    /// <reference path="./moduleFile1.ts" />
                    export var x = Foo();`
                        };
                        const { configFile, verifyProjectsUpdatedInBackgroundEvent } = getInitialState({
                            getAdditionalFileOrFolder: () => [referenceFile1],
                            firstReloadFileList: [referenceFile1.path, projectSystem.libFile.path, moduleFile1Path, configFilePath]
                        });
                        verifyProjectsUpdatedInBackgroundEvent([projectSystem.libFile, referenceFile1, configFile]);
                    });
                    it("should detect non-existing code file", () => {
                        const referenceFile1 = {
                            path: "/a/b/referenceFile1.ts",
                            content: `
                    /// <reference path="./moduleFile2.ts" />
                    export var x = Foo();`
                        };
                        const { configFile, moduleFile2, updateContentOfOpenFile, verifyNoProjectsUpdatedInBackgroundEvent, verifyProjectsUpdatedInBackgroundEvent } = getInitialState({
                            getAdditionalFileOrFolder: () => [referenceFile1],
                            firstReloadFileList: [referenceFile1.path, projectSystem.libFile.path, configFilePath]
                        });
                        updateContentOfOpenFile(referenceFile1, referenceFile1.content + "export var yy = Foo();");
                        verifyNoProjectsUpdatedInBackgroundEvent([projectSystem.libFile, referenceFile1, configFile]);
                        // Create module File2 and see both files are saved
                        verifyProjectsUpdatedInBackgroundEvent([projectSystem.libFile, moduleFile2, referenceFile1, configFile]);
                    });
                });
                describe("resolution when resolution cache size", () => {
                    function verifyWithMaxCacheLimit(limitHit, useSlashRootAsSomeNotRootFolderInUserDirectory) {
                        const rootFolder = useSlashRootAsSomeNotRootFolderInUserDirectory ? "/user/username/rootfolder/otherfolder/" : "/";
                        const file1 = {
                            path: rootFolder + "a/b/project/file1.ts",
                            content: 'import a from "file2"'
                        };
                        const file2 = {
                            path: rootFolder + "a/b/node_modules/file2.d.ts",
                            content: "export class a { }"
                        };
                        const file3 = {
                            path: rootFolder + "a/b/project/file3.ts",
                            content: "export class c { }"
                        };
                        const configFile = {
                            path: rootFolder + "a/b/project/tsconfig.json",
                            content: JSON.stringify({ compilerOptions: { typeRoots: [] } })
                        };
                        const projectFiles = [file1, file3, projectSystem.libFile, configFile];
                        const openFiles = [file1.path];
                        const watchedRecursiveDirectories = useSlashRootAsSomeNotRootFolderInUserDirectory ?
                            // Folders of node_modules lookup not in changedRoot
                            ["a/b/project", "a/b/node_modules", "a/node_modules", "node_modules"].map(v => rootFolder + v) :
                            // Folder of tsconfig
                            ["/a/b/project"];
                        const host = projectSystem.createServerHost(projectFiles);
                        const { session, verifyInitialOpen, verifyProjectsUpdatedInBackgroundEventHandler } = createSession(host);
                        const projectService = session.getProjectService();
                        verifyInitialOpen(file1);
                        checkNumberOfProjects(projectService, { configuredProjects: 1 });
                        const project = projectService.configuredProjects.get(configFile.path);
                        verifyProject();
                        if (limitHit) {
                            project.maxNumberOfFilesToIterateForInvalidation = 1;
                        }
                        file3.content += "export class d {}";
                        host.reloadFS(projectFiles);
                        host.checkTimeoutQueueLengthAndRun(2);
                        // Since this is first event
                        verifyProject();
                        verifyProjectsUpdatedInBackgroundEventHandler([{
                                eventName: ts.server.ProjectsUpdatedInBackgroundEvent,
                                data: {
                                    openFiles
                                }
                            }]);
                        projectFiles.push(file2);
                        host.reloadFS(projectFiles);
                        host.runQueuedTimeoutCallbacks();
                        if (useSlashRootAsSomeNotRootFolderInUserDirectory) {
                            watchedRecursiveDirectories.length = 2;
                        }
                        else {
                            // file2 addition wont be detected
                            projectFiles.pop();
                            assert.isTrue(host.fileExists(file2.path));
                        }
                        verifyProject();
                        verifyProjectsUpdatedInBackgroundEventHandler(useSlashRootAsSomeNotRootFolderInUserDirectory ? [{
                                eventName: ts.server.ProjectsUpdatedInBackgroundEvent,
                                data: {
                                    openFiles
                                }
                            }] : []);
                        function verifyProject() {
                            checkProjectActualFiles(project, ts.map(projectFiles, file => file.path));
                            projectSystem.checkWatchedDirectories(host, [], /*recursive*/ false);
                            projectSystem.checkWatchedDirectories(host, watchedRecursiveDirectories, /*recursive*/ true);
                        }
                    }
                    it("limit not hit and project is not at root level", () => {
                        verifyWithMaxCacheLimit(/*limitHit*/ false, /*useSlashRootAsSomeNotRootFolderInUserDirectory*/ true);
                    });
                    it("limit hit and project is not at root level", () => {
                        verifyWithMaxCacheLimit(/*limitHit*/ true, /*useSlashRootAsSomeNotRootFolderInUserDirectory*/ true);
                    });
                    it("limit not hit and project is at root level", () => {
                        verifyWithMaxCacheLimit(/*limitHit*/ false, /*useSlashRootAsSomeNotRootFolderInUserDirectory*/ false);
                    });
                    it("limit hit and project is at root level", () => {
                        verifyWithMaxCacheLimit(/*limitHit*/ true, /*useSlashRootAsSomeNotRootFolderInUserDirectory*/ false);
                    });
                });
            }
            describe("when event handler is set in the session", () => {
                verifyProjectsUpdatedInBackgroundEvent(createSessionWithProjectChangedEventHandler);
                function createSessionWithProjectChangedEventHandler(host) {
                    const projectChangedEvents = [];
                    const session = createSession(host, {
                        eventHandler: e => {
                            if (e.eventName === ts.server.ProjectsUpdatedInBackgroundEvent) {
                                projectChangedEvents.push(e);
                            }
                        }
                    });
                    return {
                        session,
                        verifyProjectsUpdatedInBackgroundEventHandler,
                        verifyInitialOpen: createVerifyInitialOpen(session, verifyProjectsUpdatedInBackgroundEventHandler)
                    };
                    function eventToString(event) {
                        return JSON.stringify(event && { eventName: event.eventName, data: event.data });
                    }
                    function eventsToString(events) {
                        return "[" + ts.map(events, eventToString).join(",") + "]";
                    }
                    function verifyProjectsUpdatedInBackgroundEventHandler(expectedEvents) {
                        assert.equal(projectChangedEvents.length, expectedEvents.length, `Incorrect number of events Actual: ${eventsToString(projectChangedEvents)} Expected: ${eventsToString(expectedEvents)}`);
                        ts.forEach(projectChangedEvents, (actualEvent, i) => {
                            const expectedEvent = expectedEvents[i];
                            assert.strictEqual(actualEvent.eventName, expectedEvent.eventName);
                            verifyFiles("openFiles", actualEvent.data.openFiles, expectedEvent.data.openFiles);
                        });
                        // Verified the events, reset them
                        projectChangedEvents.length = 0;
                    }
                }
            });
            describe("when event handler is not set but session is created with canUseEvents = true", () => {
                verifyProjectsUpdatedInBackgroundEvent(createSessionThatUsesEvents);
                function createSessionThatUsesEvents(host) {
                    const session = createSession(host, { canUseEvents: true });
                    return {
                        session,
                        verifyProjectsUpdatedInBackgroundEventHandler,
                        verifyInitialOpen: createVerifyInitialOpen(session, verifyProjectsUpdatedInBackgroundEventHandler)
                    };
                    function verifyProjectsUpdatedInBackgroundEventHandler(expected) {
                        const expectedEvents = ts.map(expected, e => {
                            return {
                                openFiles: e.data.openFiles
                            };
                        });
                        const outputEventRegex = /Content\-Length: [\d]+\r\n\r\n/;
                        const events = ts.filter(ts.map(host.getOutput(), s => ts.convertToObject(ts.parseJsonText("json.json", s.replace(outputEventRegex, "")), [])), e => e.event === ts.server.ProjectsUpdatedInBackgroundEvent);
                        assert.equal(events.length, expectedEvents.length, `Incorrect number of events Actual: ${ts.map(events, e => e.body)} Expected: ${expectedEvents}`);
                        ts.forEach(events, (actualEvent, i) => {
                            const expectedEvent = expectedEvents[i];
                            verifyFiles("openFiles", actualEvent.body.openFiles, expectedEvent.openFiles);
                        });
                        // Verified the events, reset them
                        session.clearMessages();
                    }
                }
            });
        });
        describe("tsserverProjectSystem Watched recursive directories with windows style file system", () => {
            function verifyWatchedDirectories(useProjectAtRoot) {
                const root = useProjectAtRoot ? "c:/" : "c:/myfolder/allproject/";
                const configFile = {
                    path: root + "project/tsconfig.json",
                    content: "{}"
                };
                const file1 = {
                    path: root + "project/file1.ts",
                    content: "let x = 10;"
                };
                const file2 = {
                    path: root + "project/file2.ts",
                    content: "let y = 10;"
                };
                const files = [configFile, file1, file2, projectSystem.libFile];
                const host = projectSystem.createServerHost(files, { useWindowsStylePaths: true });
                const projectService = createProjectService(host);
                projectService.openClientFile(file1.path);
                const project = projectService.configuredProjects.get(configFile.path);
                assert.isDefined(project);
                const winsowsStyleLibFilePath = "c:/" + projectSystem.libFile.path.substring(1);
                checkProjectActualFiles(project, files.map(f => f === projectSystem.libFile ? winsowsStyleLibFilePath : f.path));
                projectSystem.checkWatchedFiles(host, ts.mapDefined(files, f => f === projectSystem.libFile ? winsowsStyleLibFilePath : f === file1 ? undefined : f.path));
                projectSystem.checkWatchedDirectories(host, [], /*recursive*/ false);
                projectSystem.checkWatchedDirectories(host, [
                    root + "project",
                    root + "project/node_modules/@types"
                ].concat(useProjectAtRoot ? [] : [root + projectSystem.nodeModulesAtTypes]), /*recursive*/ true);
            }
            it("When project is in rootFolder", () => {
                verifyWatchedDirectories(/*useProjectAtRoot*/ true);
            });
            it("When files at some folder other than root", () => {
                verifyWatchedDirectories(/*useProjectAtRoot*/ false);
            });
        });
        describe("tsserverProjectSystem typingsInstaller on inferred Project", () => {
            it("when projectRootPath is provided", () => {
                const projects = "/users/username/projects";
                const projectRootPath = `${projects}/san2`;
                const file = {
                    path: `${projectRootPath}/x.js`,
                    content: "const aaaaaaav = 1;"
                };
                const currentDirectory = `${projects}/anotherProject`;
                const packageJsonInCurrentDirectory = {
                    path: `${currentDirectory}/package.json`,
                    content: JSON.stringify({
                        devDependencies: {
                            pkgcurrentdirectory: ""
                        },
                    })
                };
                const packageJsonOfPkgcurrentdirectory = {
                    path: `${currentDirectory}/node_modules/pkgcurrentdirectory/package.json`,
                    content: JSON.stringify({
                        name: "pkgcurrentdirectory",
                        main: "index.js",
                        typings: "index.d.ts"
                    })
                };
                const indexOfPkgcurrentdirectory = {
                    path: `${currentDirectory}/node_modules/pkgcurrentdirectory/index.d.ts`,
                    content: "export function foo() { }"
                };
                const typingsCache = `/users/username/Library/Caches/typescript/2.7`;
                const typingsCachePackageJson = {
                    path: `${typingsCache}/package.json`,
                    content: JSON.stringify({
                        devDependencies: {},
                    })
                };
                const typingsCachePackageLockJson = {
                    path: `${typingsCache}/package-lock.json`,
                    content: JSON.stringify({
                        dependencies: {},
                    })
                };
                const files = [file, packageJsonInCurrentDirectory, packageJsonOfPkgcurrentdirectory, indexOfPkgcurrentdirectory, typingsCachePackageJson, typingsCachePackageLockJson];
                const host = projectSystem.createServerHost(files, { currentDirectory });
                const typesRegistry = createTypesRegistry("pkgcurrentdirectory");
                const typingsInstaller = new TestTypingsInstaller(typingsCache, /*throttleLimit*/ 5, host, typesRegistry);
                const projectService = createProjectService(host, { typingsInstaller });
                projectService.setCompilerOptionsForInferredProjects({
                    module: ts.ModuleKind.CommonJS,
                    target: ts.ScriptTarget.ES2016,
                    jsx: ts.JsxEmit.Preserve,
                    experimentalDecorators: true,
                    allowJs: true,
                    allowSyntheticDefaultImports: true,
                    allowNonTsExtensions: true
                });
                projectService.openClientFile(file.path, file.content, ts.ScriptKind.JS, projectRootPath);
                const project = projectService.inferredProjects[0];
                assert.isDefined(project);
                // Ensure that we use result from types cache when getting ls
                assert.isDefined(project.getLanguageService());
                // Verify that the pkgcurrentdirectory from the current directory isnt picked up
                checkProjectActualFiles(project, [file.path]);
            });
        });
        describe("tsserverProjectSystem with symLinks", () => {
            it("rename in common file renames all project", () => {
                const projects = "/users/username/projects";
                const folderA = `${projects}/a`;
                const aFile = {
                    path: `${folderA}/a.ts`,
                    content: `import {C} from "./c/fc"; console.log(C)`
                };
                const aTsconfig = {
                    path: `${folderA}/tsconfig.json`,
                    content: JSON.stringify({ compilerOptions: { module: "commonjs" } })
                };
                const aC = {
                    path: `${folderA}/c`,
                    symLink: "../c"
                };
                const aFc = `${folderA}/c/fc.ts`;
                const folderB = `${projects}/b`;
                const bFile = {
                    path: `${folderB}/b.ts`,
                    content: `import {C} from "./c/fc"; console.log(C)`
                };
                const bTsconfig = {
                    path: `${folderB}/tsconfig.json`,
                    content: JSON.stringify({ compilerOptions: { module: "commonjs" } })
                };
                const bC = {
                    path: `${folderB}/c`,
                    symLink: "../c"
                };
                const bFc = `${folderB}/c/fc.ts`;
                const folderC = `${projects}/c`;
                const cFile = {
                    path: `${folderC}/fc.ts`,
                    content: `export const C = 8`
                };
                const files = [cFile, projectSystem.libFile, aFile, aTsconfig, aC, bFile, bTsconfig, bC];
                const host = projectSystem.createServerHost(files);
                const session = createSession(host);
                const projectService = session.getProjectService();
                session.executeCommandSeq({
                    command: "open" /* Open */,
                    arguments: {
                        file: aFile.path,
                        projectRootPath: folderA
                    }
                });
                session.executeCommandSeq({
                    command: "open" /* Open */,
                    arguments: {
                        file: bFile.path,
                        projectRootPath: folderB
                    }
                });
                session.executeCommandSeq({
                    command: "open" /* Open */,
                    arguments: {
                        file: aFc,
                        projectRootPath: folderA
                    }
                });
                session.executeCommandSeq({
                    command: "open" /* Open */,
                    arguments: {
                        file: bFc,
                        projectRootPath: folderB
                    }
                });
                checkNumberOfProjects(projectService, { configuredProjects: 2 });
                assert.isDefined(projectService.configuredProjects.get(aTsconfig.path));
                assert.isDefined(projectService.configuredProjects.get(bTsconfig.path));
                verifyRenameResponse(session.executeCommandSeq({
                    command: "rename" /* Rename */,
                    arguments: {
                        file: aFc,
                        line: 1,
                        offset: 14,
                        findInStrings: false,
                        findInComments: false
                    }
                }).response);
                function verifyRenameResponse({ info, locs }) {
                    assert.isTrue(info.canRename);
                    assert.equal(locs.length, 4);
                    verifyLocations(0, aFile.path, aFc);
                    verifyLocations(2, bFile.path, bFc);
                    function verifyLocations(locStartIndex, firstFile, secondFile) {
                        assert.deepEqual(locs[locStartIndex], {
                            file: firstFile,
                            locs: [
                                { start: { line: 1, offset: 39 }, end: { line: 1, offset: 40 } },
                                { start: { line: 1, offset: 9 }, end: { line: 1, offset: 10 } }
                            ]
                        });
                        assert.deepEqual(locs[locStartIndex + 1], {
                            file: secondFile,
                            locs: [
                                { start: { line: 1, offset: 14 }, end: { line: 1, offset: 15 } }
                            ]
                        });
                    }
                }
            });
        });
        describe("tsserverProjectSystem forceConsistentCasingInFileNames", () => {
            it("works when extends is specified with a case insensitive file system", () => {
                const rootPath = "/Users/username/dev/project";
                const file1 = {
                    path: `${rootPath}/index.ts`,
                    content: 'import {x} from "file2";',
                };
                const file2 = {
                    path: `${rootPath}/file2.js`,
                    content: "",
                };
                const file2Dts = {
                    path: `${rootPath}/types/file2/index.d.ts`,
                    content: "export declare const x: string;",
                };
                const tsconfigAll = {
                    path: `${rootPath}/tsconfig.all.json`,
                    content: JSON.stringify({
                        compilerOptions: {
                            baseUrl: ".",
                            paths: { file2: ["./file2.js"] },
                            typeRoots: ["./types"],
                            forceConsistentCasingInFileNames: true,
                        },
                    }),
                };
                const tsconfig = {
                    path: `${rootPath}/tsconfig.json`,
                    content: JSON.stringify({ extends: "./tsconfig.all.json" }),
                };
                const host = projectSystem.createServerHost([file1, file2, file2Dts, projectSystem.libFile, tsconfig, tsconfigAll], { useCaseSensitiveFileNames: false });
                const session = createSession(host);
                openFilesForSession([file1], session);
                const projectService = session.getProjectService();
                checkNumberOfProjects(projectService, { configuredProjects: 1 });
                const diagnostics = configuredProjectAt(projectService, 0).getLanguageService().getCompilerOptionsDiagnostics();
                assert.deepEqual(diagnostics, []);
            });
        });
        describe("tsserverProjectSystem module resolution caching", () => {
            const projectLocation = "/user/username/projects/myproject";
            const configFile = {
                path: `${projectLocation}/tsconfig.json`,
                content: JSON.stringify({ compilerOptions: { traceResolution: true } })
            };
            function getModules(module1Path, module2Path) {
                const module1 = {
                    path: module1Path,
                    content: `export function module1() {}`
                };
                const module2 = {
                    path: module2Path,
                    content: `export function module2() {}`
                };
                return { module1, module2 };
            }
            function verifyTrace(resolutionTrace, expected) {
                assert.deepEqual(resolutionTrace, expected);
                resolutionTrace.length = 0;
            }
            function getExpectedFileDoesNotExistResolutionTrace(host, expectedTrace, foundModule, module, directory, file, ignoreIfParentMissing) {
                if (!foundModule) {
                    const path = ts.combinePaths(directory, file);
                    if (!ignoreIfParentMissing || host.directoryExists(ts.getDirectoryPath(path))) {
                        if (module.path === path) {
                            foundModule = true;
                        }
                        else {
                            expectedTrace.push(`File '${path}' does not exist.`);
                        }
                    }
                }
                return foundModule;
            }
            function getExpectedMissedLocationResolutionTrace(host, expectedTrace, dirPath, module, moduleName, useNodeModules, cacheLocation) {
                let foundModule = false;
                ts.forEachAncestorDirectory(dirPath, dirPath => {
                    if (dirPath === cacheLocation) {
                        return foundModule;
                    }
                    const directory = useNodeModules ? ts.combinePaths(dirPath, nodeModules) : dirPath;
                    if (useNodeModules && !foundModule && !host.directoryExists(directory)) {
                        expectedTrace.push(`Directory '${directory}' does not exist, skipping all lookups in it.`);
                        return undefined;
                    }
                    foundModule = getExpectedFileDoesNotExistResolutionTrace(host, expectedTrace, foundModule, module, directory, `${moduleName}/package.json`, /*ignoreIfParentMissing*/ true);
                    foundModule = getExpectedFileDoesNotExistResolutionTrace(host, expectedTrace, foundModule, module, directory, `${moduleName}.ts`);
                    foundModule = getExpectedFileDoesNotExistResolutionTrace(host, expectedTrace, foundModule, module, directory, `${moduleName}.tsx`);
                    foundModule = getExpectedFileDoesNotExistResolutionTrace(host, expectedTrace, foundModule, module, directory, `${moduleName}.d.ts`);
                    foundModule = getExpectedFileDoesNotExistResolutionTrace(host, expectedTrace, foundModule, module, directory, `${moduleName}/index.ts`, /*ignoreIfParentMissing*/ true);
                    if (useNodeModules && !foundModule) {
                        expectedTrace.push(`Directory '${directory}/@types' does not exist, skipping all lookups in it.`);
                    }
                    return foundModule ? true : undefined;
                });
            }
            function getExpectedResolutionTraceHeader(expectedTrace, file, moduleName) {
                expectedTrace.push(`======== Resolving module '${moduleName}' from '${file.path}'. ========`, `Module resolution kind is not specified, using 'NodeJs'.`);
            }
            function getExpectedResolutionTraceFooter(expectedTrace, module, moduleName, addRealPathTrace, ignoreModuleFileFound) {
                if (!ignoreModuleFileFound) {
                    expectedTrace.push(`File '${module.path}' exist - use it as a name resolution result.`);
                }
                if (addRealPathTrace) {
                    expectedTrace.push(`Resolving real path for '${module.path}', result '${module.path}'.`);
                }
                expectedTrace.push(`======== Module name '${moduleName}' was successfully resolved to '${module.path}'. ========`);
            }
            function getExpectedRelativeModuleResolutionTrace(host, file, module, moduleName, expectedTrace = []) {
                getExpectedResolutionTraceHeader(expectedTrace, file, moduleName);
                expectedTrace.push(`Loading module as file / folder, candidate module location '${ts.removeFileExtension(module.path)}', target file type 'TypeScript'.`);
                getExpectedMissedLocationResolutionTrace(host, expectedTrace, ts.getDirectoryPath(ts.normalizePath(ts.combinePaths(ts.getDirectoryPath(file.path), moduleName))), module, moduleName.substring(moduleName.lastIndexOf("/") + 1), /*useNodeModules*/ false);
                getExpectedResolutionTraceFooter(expectedTrace, module, moduleName, /*addRealPathTrace*/ false);
                return expectedTrace;
            }
            function getExpectedNonRelativeModuleResolutionTrace(host, file, module, moduleName, expectedTrace = []) {
                getExpectedResolutionTraceHeader(expectedTrace, file, moduleName);
                expectedTrace.push(`Loading module '${moduleName}' from 'node_modules' folder, target file type 'TypeScript'.`);
                getExpectedMissedLocationResolutionTrace(host, expectedTrace, ts.getDirectoryPath(file.path), module, moduleName, /*useNodeModules*/ true);
                getExpectedResolutionTraceFooter(expectedTrace, module, moduleName, /*addRealPathTrace*/ true);
                return expectedTrace;
            }
            function getExpectedNonRelativeModuleResolutionFromCacheTrace(host, file, module, moduleName, cacheLocation, expectedTrace = []) {
                getExpectedResolutionTraceHeader(expectedTrace, file, moduleName);
                expectedTrace.push(`Loading module '${moduleName}' from 'node_modules' folder, target file type 'TypeScript'.`);
                getExpectedMissedLocationResolutionTrace(host, expectedTrace, ts.getDirectoryPath(file.path), module, moduleName, /*useNodeModules*/ true, cacheLocation);
                expectedTrace.push(`Resolution for module '${moduleName}' was found in cache from location '${cacheLocation}'.`);
                getExpectedResolutionTraceFooter(expectedTrace, module, moduleName, /*addRealPathTrace*/ true, /*ignoreModuleFileFound*/ true);
                return expectedTrace;
            }
            function getExpectedReusingResolutionFromOldProgram(file, moduleName) {
                return `Reusing resolution of module '${moduleName}' to file '${file.path}' from old program.`;
            }
            function verifyWatchesWithConfigFile(host, files, openFile) {
                projectSystem.checkWatchedFiles(host, ts.mapDefined(files, f => f === openFile ? undefined : f.path));
                projectSystem.checkWatchedDirectories(host, [], /*recursive*/ false);
                const configDirectory = ts.getDirectoryPath(configFile.path);
                projectSystem.checkWatchedDirectories(host, [configDirectory, `${configDirectory}/${projectSystem.nodeModulesAtTypes}`], /*recursive*/ true);
            }
            describe("from files in same folder", () => {
                function getFiles(fileContent) {
                    const file1 = {
                        path: `${projectLocation}/src/file1.ts`,
                        content: fileContent
                    };
                    const file2 = {
                        path: `${projectLocation}/src/file2.ts`,
                        content: fileContent
                    };
                    return { file1, file2 };
                }
                it("relative module name", () => {
                    const module1Name = "./module1";
                    const module2Name = "../module2";
                    const fileContent = `import { module1 } from "${module1Name}";import { module2 } from "${module2Name}";`;
                    const { file1, file2 } = getFiles(fileContent);
                    const { module1, module2 } = getModules(`${projectLocation}/src/module1.ts`, `${projectLocation}/module2.ts`);
                    const files = [module1, module2, file1, file2, configFile, projectSystem.libFile];
                    const host = projectSystem.createServerHost(files);
                    const resolutionTrace = createHostModuleResolutionTrace(host);
                    const service = createProjectService(host);
                    service.openClientFile(file1.path);
                    const expectedTrace = getExpectedRelativeModuleResolutionTrace(host, file1, module1, module1Name);
                    getExpectedRelativeModuleResolutionTrace(host, file1, module2, module2Name, expectedTrace);
                    verifyTrace(resolutionTrace, expectedTrace);
                    verifyWatchesWithConfigFile(host, files, file1);
                    file1.content += fileContent;
                    file2.content += fileContent;
                    host.reloadFS(files);
                    host.runQueuedTimeoutCallbacks();
                    verifyTrace(resolutionTrace, [
                        getExpectedReusingResolutionFromOldProgram(file1, module1Name),
                        getExpectedReusingResolutionFromOldProgram(file1, module2Name)
                    ]);
                    verifyWatchesWithConfigFile(host, files, file1);
                });
                it("non relative module name", () => {
                    const module1Name = "module1";
                    const module2Name = "module2";
                    const fileContent = `import { module1 } from "${module1Name}";import { module2 } from "${module2Name}";`;
                    const { file1, file2 } = getFiles(fileContent);
                    const { module1, module2 } = getModules(`${projectLocation}/src/node_modules/module1/index.ts`, `${projectLocation}/node_modules/module2/index.ts`);
                    const files = [module1, module2, file1, file2, configFile, projectSystem.libFile];
                    const host = projectSystem.createServerHost(files);
                    const resolutionTrace = createHostModuleResolutionTrace(host);
                    const service = createProjectService(host);
                    service.openClientFile(file1.path);
                    const expectedTrace = getExpectedNonRelativeModuleResolutionTrace(host, file1, module1, module1Name);
                    getExpectedNonRelativeModuleResolutionTrace(host, file1, module2, module2Name, expectedTrace);
                    verifyTrace(resolutionTrace, expectedTrace);
                    verifyWatchesWithConfigFile(host, files, file1);
                    file1.content += fileContent;
                    file2.content += fileContent;
                    host.reloadFS(files);
                    host.runQueuedTimeoutCallbacks();
                    verifyTrace(resolutionTrace, [
                        getExpectedReusingResolutionFromOldProgram(file1, module1Name),
                        getExpectedReusingResolutionFromOldProgram(file1, module2Name)
                    ]);
                    verifyWatchesWithConfigFile(host, files, file1);
                });
            });
            describe("from files in different folders", () => {
                function getFiles(fileContent1, fileContent2 = fileContent1, fileContent3 = fileContent1, fileContent4 = fileContent1) {
                    const file1 = {
                        path: `${projectLocation}/product/src/file1.ts`,
                        content: fileContent1
                    };
                    const file2 = {
                        path: `${projectLocation}/product/src/feature/file2.ts`,
                        content: fileContent2
                    };
                    const file3 = {
                        path: `${projectLocation}/product/test/src/file3.ts`,
                        content: fileContent3
                    };
                    const file4 = {
                        path: `${projectLocation}/product/test/file4.ts`,
                        content: fileContent4
                    };
                    return { file1, file2, file3, file4 };
                }
                it("relative module name", () => {
                    const module1Name = "./module1";
                    const module2Name = "../module2";
                    const module3Name = "../module1";
                    const module4Name = "../../module2";
                    const module5Name = "../../src/module1";
                    const module6Name = "../src/module1";
                    const fileContent1 = `import { module1 } from "${module1Name}";import { module2 } from "${module2Name}";`;
                    const fileContent2 = `import { module1 } from "${module3Name}";import { module2 } from "${module4Name}";`;
                    const fileContent3 = `import { module1 } from "${module5Name}";import { module2 } from "${module4Name}";`;
                    const fileContent4 = `import { module1 } from "${module6Name}";import { module2 } from "${module2Name}";`;
                    const { file1, file2, file3, file4 } = getFiles(fileContent1, fileContent2, fileContent3, fileContent4);
                    const { module1, module2 } = getModules(`${projectLocation}/product/src/module1.ts`, `${projectLocation}/product/module2.ts`);
                    const files = [module1, module2, file1, file2, file3, file4, configFile, projectSystem.libFile];
                    const host = projectSystem.createServerHost(files);
                    const resolutionTrace = createHostModuleResolutionTrace(host);
                    const service = createProjectService(host);
                    service.openClientFile(file1.path);
                    const expectedTrace = getExpectedRelativeModuleResolutionTrace(host, file1, module1, module1Name);
                    getExpectedRelativeModuleResolutionTrace(host, file1, module2, module2Name, expectedTrace);
                    getExpectedRelativeModuleResolutionTrace(host, file2, module1, module3Name, expectedTrace);
                    getExpectedRelativeModuleResolutionTrace(host, file2, module2, module4Name, expectedTrace);
                    getExpectedRelativeModuleResolutionTrace(host, file4, module1, module6Name, expectedTrace);
                    getExpectedRelativeModuleResolutionTrace(host, file4, module2, module2Name, expectedTrace);
                    getExpectedRelativeModuleResolutionTrace(host, file3, module1, module5Name, expectedTrace);
                    getExpectedRelativeModuleResolutionTrace(host, file3, module2, module4Name, expectedTrace);
                    verifyTrace(resolutionTrace, expectedTrace);
                    verifyWatchesWithConfigFile(host, files, file1);
                    file1.content += fileContent1;
                    file2.content += fileContent2;
                    file3.content += fileContent3;
                    file4.content += fileContent4;
                    host.reloadFS(files);
                    host.runQueuedTimeoutCallbacks();
                    verifyTrace(resolutionTrace, [
                        getExpectedReusingResolutionFromOldProgram(file1, module1Name),
                        getExpectedReusingResolutionFromOldProgram(file1, module2Name)
                    ]);
                    verifyWatchesWithConfigFile(host, files, file1);
                });
                it("non relative module name", () => {
                    const module1Name = "module1";
                    const module2Name = "module2";
                    const fileContent = `import { module1 } from "${module1Name}";import { module2 } from "${module2Name}";`;
                    const { file1, file2, file3, file4 } = getFiles(fileContent);
                    const { module1, module2 } = getModules(`${projectLocation}/product/node_modules/module1/index.ts`, `${projectLocation}/node_modules/module2/index.ts`);
                    const files = [module1, module2, file1, file2, file3, file4, configFile, projectSystem.libFile];
                    const host = projectSystem.createServerHost(files);
                    const resolutionTrace = createHostModuleResolutionTrace(host);
                    const service = createProjectService(host);
                    service.openClientFile(file1.path);
                    const expectedTrace = getExpectedNonRelativeModuleResolutionTrace(host, file1, module1, module1Name);
                    getExpectedNonRelativeModuleResolutionTrace(host, file1, module2, module2Name, expectedTrace);
                    getExpectedNonRelativeModuleResolutionFromCacheTrace(host, file2, module1, module1Name, ts.getDirectoryPath(file1.path), expectedTrace);
                    getExpectedNonRelativeModuleResolutionFromCacheTrace(host, file2, module2, module2Name, ts.getDirectoryPath(file1.path), expectedTrace);
                    getExpectedNonRelativeModuleResolutionFromCacheTrace(host, file4, module1, module1Name, `${projectLocation}/product`, expectedTrace);
                    getExpectedNonRelativeModuleResolutionFromCacheTrace(host, file4, module2, module2Name, `${projectLocation}/product`, expectedTrace);
                    getExpectedNonRelativeModuleResolutionFromCacheTrace(host, file3, module1, module1Name, ts.getDirectoryPath(file4.path), expectedTrace);
                    getExpectedNonRelativeModuleResolutionFromCacheTrace(host, file3, module2, module2Name, ts.getDirectoryPath(file4.path), expectedTrace);
                    verifyTrace(resolutionTrace, expectedTrace);
                    verifyWatchesWithConfigFile(host, files, file1);
                    file1.content += fileContent;
                    file2.content += fileContent;
                    file3.content += fileContent;
                    file4.content += fileContent;
                    host.reloadFS(files);
                    host.runQueuedTimeoutCallbacks();
                    verifyTrace(resolutionTrace, [
                        getExpectedReusingResolutionFromOldProgram(file1, module1Name),
                        getExpectedReusingResolutionFromOldProgram(file1, module2Name)
                    ]);
                    verifyWatchesWithConfigFile(host, files, file1);
                });
                it("non relative module name from inferred project", () => {
                    const module1Name = "module1";
                    const module2Name = "module2";
                    const file2Name = "./feature/file2";
                    const file3Name = "../test/src/file3";
                    const file4Name = "../test/file4";
                    const importModuleContent = `import { module1 } from "${module1Name}";import { module2 } from "${module2Name}";`;
                    const { file1, file2, file3, file4 } = getFiles(`import "${file2Name}"; import "${file4Name}"; import "${file3Name}"; ${importModuleContent}`, importModuleContent, importModuleContent, importModuleContent);
                    const { module1, module2 } = getModules(`${projectLocation}/product/node_modules/module1/index.ts`, `${projectLocation}/node_modules/module2/index.ts`);
                    const files = [module1, module2, file1, file2, file3, file4, projectSystem.libFile];
                    const host = projectSystem.createServerHost(files);
                    const resolutionTrace = createHostModuleResolutionTrace(host);
                    const service = createProjectService(host);
                    service.setCompilerOptionsForInferredProjects({ traceResolution: true });
                    service.openClientFile(file1.path);
                    const expectedTrace = getExpectedRelativeModuleResolutionTrace(host, file1, file2, file2Name);
                    getExpectedRelativeModuleResolutionTrace(host, file1, file4, file4Name, expectedTrace);
                    getExpectedRelativeModuleResolutionTrace(host, file1, file3, file3Name, expectedTrace);
                    getExpectedNonRelativeModuleResolutionTrace(host, file1, module1, module1Name, expectedTrace);
                    getExpectedNonRelativeModuleResolutionTrace(host, file1, module2, module2Name, expectedTrace);
                    getExpectedNonRelativeModuleResolutionFromCacheTrace(host, file2, module1, module1Name, ts.getDirectoryPath(file1.path), expectedTrace);
                    getExpectedNonRelativeModuleResolutionFromCacheTrace(host, file2, module2, module2Name, ts.getDirectoryPath(file1.path), expectedTrace);
                    getExpectedNonRelativeModuleResolutionFromCacheTrace(host, file4, module1, module1Name, `${projectLocation}/product`, expectedTrace);
                    getExpectedNonRelativeModuleResolutionFromCacheTrace(host, file4, module2, module2Name, `${projectLocation}/product`, expectedTrace);
                    getExpectedNonRelativeModuleResolutionFromCacheTrace(host, file3, module1, module1Name, ts.getDirectoryPath(file4.path), expectedTrace);
                    getExpectedNonRelativeModuleResolutionFromCacheTrace(host, file3, module2, module2Name, ts.getDirectoryPath(file4.path), expectedTrace);
                    verifyTrace(resolutionTrace, expectedTrace);
                    const currentDirectory = ts.getDirectoryPath(file1.path);
                    const watchedFiles = ts.mapDefined(files, f => f === file1 ? undefined : f.path);
                    ts.forEachAncestorDirectory(currentDirectory, d => {
                        watchedFiles.push(ts.combinePaths(d, "tsconfig.json"), ts.combinePaths(d, "jsconfig.json"));
                    });
                    const watchedRecursiveDirectories = getTypeRootsFromLocation(currentDirectory).concat([
                        currentDirectory, `${projectLocation}/product/${nodeModules}`,
                        `${projectLocation}/${nodeModules}`, `${projectLocation}/product/test/${nodeModules}`,
                        `${projectLocation}/product/test/src/${nodeModules}`
                    ]);
                    checkWatches();
                    file1.content += importModuleContent;
                    file2.content += importModuleContent;
                    file3.content += importModuleContent;
                    file4.content += importModuleContent;
                    host.reloadFS(files);
                    host.runQueuedTimeoutCallbacks();
                    verifyTrace(resolutionTrace, [
                        getExpectedReusingResolutionFromOldProgram(file1, file2Name),
                        getExpectedReusingResolutionFromOldProgram(file1, file4Name),
                        getExpectedReusingResolutionFromOldProgram(file1, file3Name),
                        getExpectedReusingResolutionFromOldProgram(file1, module1Name),
                        getExpectedReusingResolutionFromOldProgram(file1, module2Name)
                    ]);
                    checkWatches();
                    function checkWatches() {
                        projectSystem.checkWatchedFiles(host, watchedFiles);
                        projectSystem.checkWatchedDirectories(host, [], /*recursive*/ false);
                        projectSystem.checkWatchedDirectories(host, watchedRecursiveDirectories, /*recursive*/ true);
                    }
                });
            });
        });
        describe("watchDirectories implementation", () => {
            function verifyCompletionListWithNewFileInSubFolder(tscWatchDirectory) {
                const projectFolder = "/a/username/project";
                const projectSrcFolder = `${projectFolder}/src`;
                const configFile = {
                    path: `${projectFolder}/tsconfig.json`,
                    content: "{}"
                };
                const index = {
                    path: `${projectSrcFolder}/index.ts`,
                    content: `import {} from "./"`
                };
                const file1 = {
                    path: `${projectSrcFolder}/file1.ts`,
                    content: ""
                };
                const files = [index, file1, configFile, projectSystem.libFile];
                const fileNames = files.map(file => file.path);
                // All closed files(files other than index), project folder, project/src folder and project/node_modules/@types folder
                const expectedWatchedFiles = ts.arrayToMap(fileNames.slice(1), s => s, () => 1);
                const expectedWatchedDirectories = ts.createMap();
                const mapOfDirectories = tscWatchDirectory === ts.TestFSWithWatch.Tsc_WatchDirectory.NonRecursiveWatchDirectory ?
                    expectedWatchedDirectories :
                    tscWatchDirectory === ts.TestFSWithWatch.Tsc_WatchDirectory.WatchFile ?
                        expectedWatchedFiles :
                        ts.createMap();
                // For failed resolution lookup and tsconfig files
                mapOfDirectories.set(projectFolder, 2);
                // Through above recursive watches
                mapOfDirectories.set(projectSrcFolder, 2);
                // node_modules/@types folder
                mapOfDirectories.set(`${projectFolder}/${projectSystem.nodeModulesAtTypes}`, 1);
                const expectedCompletions = ["file1"];
                const completionPosition = index.content.lastIndexOf('"');
                const environmentVariables = ts.createMap();
                environmentVariables.set("TSC_WATCHDIRECTORY", tscWatchDirectory);
                const host = projectSystem.createServerHost(files, { environmentVariables });
                const projectService = createProjectService(host);
                projectService.openClientFile(index.path);
                const project = projectService.configuredProjects.get(configFile.path);
                assert.isDefined(project);
                verifyProjectAndCompletions();
                // Add file2
                const file2 = {
                    path: `${projectSrcFolder}/file2.ts`,
                    content: ""
                };
                files.push(file2);
                fileNames.push(file2.path);
                expectedWatchedFiles.set(file2.path, 1);
                expectedCompletions.push("file2");
                host.reloadFS(files);
                host.runQueuedTimeoutCallbacks();
                assert.equal(projectService.configuredProjects.get(configFile.path), project);
                verifyProjectAndCompletions();
                function verifyProjectAndCompletions() {
                    const completions = project.getLanguageService().getCompletionsAtPosition(index.path, completionPosition, { includeExternalModuleExports: false, includeInsertTextCompletions: false });
                    projectSystem.checkArray("Completion Entries", completions.entries.map(e => e.name), expectedCompletions);
                    projectSystem.checkWatchedDirectories(host, ts.emptyArray, /*recursive*/ true);
                    projectSystem.checkWatchedFilesDetailed(host, expectedWatchedFiles);
                    projectSystem.checkWatchedDirectoriesDetailed(host, expectedWatchedDirectories, /*recursive*/ false);
                    checkProjectActualFiles(project, fileNames);
                }
            }
            it("uses watchFile when file is added to subfolder, completion list has new file", () => {
                verifyCompletionListWithNewFileInSubFolder(ts.TestFSWithWatch.Tsc_WatchDirectory.WatchFile);
            });
            it("uses non recursive watchDirectory when file is added to subfolder, completion list has new file", () => {
                verifyCompletionListWithNewFileInSubFolder(ts.TestFSWithWatch.Tsc_WatchDirectory.NonRecursiveWatchDirectory);
            });
            it("uses dynamic polling when file is added to subfolder, completion list has new file", () => {
                verifyCompletionListWithNewFileInSubFolder(ts.TestFSWithWatch.Tsc_WatchDirectory.DynamicPolling);
            });
        });
    })(projectSystem = ts.projectSystem || (ts.projectSystem = {}));
})(ts || (ts = {}));
