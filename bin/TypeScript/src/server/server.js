var ts;
(function (ts) {
    var server;
    (function (server) {
        const childProcess = require("child_process");
        const os = require("os");
        const net = require("net");
        function getGlobalTypingsCacheLocation() {
            switch (process.platform) {
                case "win32": {
                    const basePath = process.env.LOCALAPPDATA ||
                        process.env.APPDATA ||
                        (os.homedir && os.homedir()) ||
                        process.env.USERPROFILE ||
                        (process.env.HOMEDRIVE && process.env.HOMEPATH && ts.normalizeSlashes(process.env.HOMEDRIVE + process.env.HOMEPATH)) ||
                        os.tmpdir();
                    return ts.combinePaths(ts.combinePaths(ts.normalizeSlashes(basePath), "Microsoft/TypeScript"), ts.versionMajorMinor);
                }
                case "openbsd":
                case "freebsd":
                case "darwin":
                case "linux":
                case "android": {
                    const cacheLocation = getNonWindowsCacheLocation(process.platform === "darwin");
                    return ts.combinePaths(ts.combinePaths(cacheLocation, "typescript"), ts.versionMajorMinor);
                }
                default:
                    ts.Debug.fail(`unsupported platform '${process.platform}'`);
                    return;
            }
        }
        function getNonWindowsCacheLocation(platformIsDarwin) {
            if (process.env.XDG_CACHE_HOME) {
                return process.env.XDG_CACHE_HOME;
            }
            const usersDir = platformIsDarwin ? "Users" : "home";
            const homePath = (os.homedir && os.homedir()) ||
                process.env.HOME ||
                ((process.env.LOGNAME || process.env.USER) && `/${usersDir}/${process.env.LOGNAME || process.env.USER}`) ||
                os.tmpdir();
            const cacheFolder = platformIsDarwin
                ? "Library/Caches"
                : ".cache";
            return ts.combinePaths(ts.normalizeSlashes(homePath), cacheFolder);
        }
        const readline = require("readline");
        const fs = require("fs");
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: false,
        });
        class Logger {
            constructor(logFilename, traceToConsole, level) {
                this.logFilename = logFilename;
                this.traceToConsole = traceToConsole;
                this.level = level;
                this.fd = -1;
                this.seq = 0;
                this.inGroup = false;
                this.firstInGroup = true;
                if (this.logFilename) {
                    try {
                        this.fd = fs.openSync(this.logFilename, "w");
                    }
                    catch (_) {
                        // swallow the error and keep logging disabled if file cannot be opened
                    }
                }
            }
            static padStringRight(str, padding) {
                return (str + padding).slice(0, padding.length);
            }
            close() {
                if (this.fd >= 0) {
                    fs.close(this.fd, ts.noop);
                }
            }
            getLogFileName() {
                return this.logFilename;
            }
            perftrc(s) {
                this.msg(s, server.Msg.Perf);
            }
            info(s) {
                this.msg(s, server.Msg.Info);
            }
            err(s) {
                this.msg(s, server.Msg.Err);
            }
            startGroup() {
                this.inGroup = true;
                this.firstInGroup = true;
            }
            endGroup() {
                this.inGroup = false;
            }
            loggingEnabled() {
                return !!this.logFilename || this.traceToConsole;
            }
            hasLevel(level) {
                return this.loggingEnabled() && this.level >= level;
            }
            msg(s, type = server.Msg.Err) {
                if (!this.canWrite)
                    return;
                s = `[${server.nowString()}] ${s}\n`;
                if (!this.inGroup || this.firstInGroup) {
                    const prefix = Logger.padStringRight(type + " " + this.seq.toString(), "          ");
                    s = prefix + s;
                }
                this.write(s);
                if (!this.inGroup) {
                    this.seq++;
                }
            }
            get canWrite() {
                return this.fd >= 0 || this.traceToConsole;
            }
            write(s) {
                if (this.fd >= 0) {
                    const buf = new Buffer(s);
                    // tslint:disable-next-line no-null-keyword
                    fs.writeSync(this.fd, buf, 0, buf.length, /*position*/ null);
                }
                if (this.traceToConsole) {
                    console.warn(s);
                }
            }
        }
        class NodeTypingsInstaller {
            constructor(telemetryEnabled, logger, host, globalTypingsCacheLocation, typingSafeListLocation, typesMapLocation, npmLocation, event) {
                this.telemetryEnabled = telemetryEnabled;
                this.logger = logger;
                this.host = host;
                this.globalTypingsCacheLocation = globalTypingsCacheLocation;
                this.typingSafeListLocation = typingSafeListLocation;
                this.typesMapLocation = typesMapLocation;
                this.npmLocation = npmLocation;
                this.event = event;
                this.activeRequestCount = 0;
                this.requestQueue = [];
                this.requestMap = ts.createMap(); // Maps operation ID to newest requestQueue entry with that ID
            }
            isKnownTypesPackageName(name) {
                // We want to avoid looking this up in the registry as that is expensive. So first check that it's actually an NPM package.
                const validationResult = ts.JsTyping.validatePackageName(name);
                if (validationResult !== 0 /* Ok */) {
                    return false;
                }
                if (this.requestedRegistry) {
                    return !!this.typesRegistryCache && this.typesRegistryCache.has(name);
                }
                this.requestedRegistry = true;
                this.send({ kind: "typesRegistry" });
                return false;
            }
            installPackage(options) {
                const rq = Object.assign({ kind: "installPackage" }, options);
                this.send(rq);
                ts.Debug.assert(this.packageInstalledPromise === undefined);
                return new Promise((resolve, reject) => {
                    this.packageInstalledPromise = { resolve, reject };
                });
            }
            attach(projectService) {
                this.projectService = projectService;
                if (this.logger.hasLevel(server.LogLevel.requestTime)) {
                    this.logger.info("Binding...");
                }
                const args = [server.Arguments.GlobalCacheLocation, this.globalTypingsCacheLocation];
                if (this.telemetryEnabled) {
                    args.push(server.Arguments.EnableTelemetry);
                }
                if (this.logger.loggingEnabled() && this.logger.getLogFileName()) {
                    args.push(server.Arguments.LogFile, ts.combinePaths(ts.getDirectoryPath(ts.normalizeSlashes(this.logger.getLogFileName())), `ti-${process.pid}.log`));
                }
                if (this.typingSafeListLocation) {
                    args.push(server.Arguments.TypingSafeListLocation, this.typingSafeListLocation);
                }
                if (this.typesMapLocation) {
                    args.push(server.Arguments.TypesMapLocation, this.typesMapLocation);
                }
                if (this.npmLocation) {
                    args.push(server.Arguments.NpmLocation, this.npmLocation);
                }
                const execArgv = [];
                for (const arg of process.execArgv) {
                    const match = /^--((?:debug|inspect)(?:-brk)?)(?:=(\d+))?$/.exec(arg);
                    if (match) {
                        // if port is specified - use port + 1
                        // otherwise pick a default port depending on if 'debug' or 'inspect' and use its value + 1
                        const currentPort = match[2] !== undefined
                            ? +match[2]
                            : match[1].charAt(0) === "d" ? 5858 : 9229;
                        execArgv.push(`--${match[1]}=${currentPort + 1}`);
                        break;
                    }
                }
                this.installer = childProcess.fork(ts.combinePaths(__dirname, "typingsInstaller.js"), args, { execArgv });
                this.installer.on("message", m => this.handleMessage(m));
                this.event({ pid: this.installer.pid }, "typingsInstallerPid");
                process.on("exit", () => {
                    this.installer.kill();
                });
            }
            onProjectClosed(p) {
                this.send({ projectName: p.getProjectName(), kind: "closeProject" });
            }
            send(rq) {
                this.installer.send(rq);
            }
            enqueueInstallTypingsRequest(project, typeAcquisition, unresolvedImports) {
                const request = server.createInstallTypingsRequest(project, typeAcquisition, unresolvedImports);
                if (this.logger.hasLevel(server.LogLevel.verbose)) {
                    if (this.logger.hasLevel(server.LogLevel.verbose)) {
                        this.logger.info(`Scheduling throttled operation:${server.stringifyIndented(request)}`);
                    }
                }
                const operationId = project.getProjectName();
                const operation = () => {
                    if (this.logger.hasLevel(server.LogLevel.verbose)) {
                        this.logger.info(`Sending request:${server.stringifyIndented(request)}`);
                    }
                    this.send(request);
                };
                const queuedRequest = { operationId, operation };
                if (this.activeRequestCount < NodeTypingsInstaller.maxActiveRequestCount) {
                    this.scheduleRequest(queuedRequest);
                }
                else {
                    if (this.logger.hasLevel(server.LogLevel.verbose)) {
                        this.logger.info(`Deferring request for: ${operationId}`);
                    }
                    this.requestQueue.push(queuedRequest);
                    this.requestMap.set(operationId, queuedRequest);
                }
            }
            handleMessage(response) {
                if (this.logger.hasLevel(server.LogLevel.verbose)) {
                    this.logger.info(`Received response:${server.stringifyIndented(response)}`);
                }
                switch (response.kind) {
                    case server.EventTypesRegistry:
                        this.typesRegistryCache = ts.createMapFromTemplate(response.typesRegistry);
                        break;
                    case server.ActionPackageInstalled: {
                        const { success, message } = response;
                        if (success) {
                            this.packageInstalledPromise.resolve({ successMessage: message });
                        }
                        else {
                            this.packageInstalledPromise.reject(message);
                        }
                        this.packageInstalledPromise = undefined;
                        this.projectService.updateTypingsForProject(response);
                        // The behavior is the same as for setTypings, so send the same event.
                        this.event(response, "setTypings");
                        break;
                    }
                    case server.EventInitializationFailed:
                        {
                            const body = {
                                message: response.message
                            };
                            const eventName = "typesInstallerInitializationFailed";
                            this.event(body, eventName);
                            break;
                        }
                    case server.EventBeginInstallTypes:
                        {
                            const body = {
                                eventId: response.eventId,
                                packages: response.packagesToInstall,
                            };
                            const eventName = "beginInstallTypes";
                            this.event(body, eventName);
                            break;
                        }
                    case server.EventEndInstallTypes:
                        {
                            if (this.telemetryEnabled) {
                                const body = {
                                    telemetryEventName: "typingsInstalled",
                                    payload: {
                                        installedPackages: response.packagesToInstall.join(","),
                                        installSuccess: response.installSuccess,
                                        typingsInstallerVersion: response.typingsInstallerVersion
                                    }
                                };
                                const eventName = "telemetry";
                                this.event(body, eventName);
                            }
                            const body = {
                                eventId: response.eventId,
                                packages: response.packagesToInstall,
                                success: response.installSuccess,
                            };
                            const eventName = "endInstallTypes";
                            this.event(body, eventName);
                            break;
                        }
                    case server.ActionInvalidate:
                        {
                            this.projectService.updateTypingsForProject(response);
                            break;
                        }
                    case server.ActionSet:
                        {
                            if (this.activeRequestCount > 0) {
                                this.activeRequestCount--;
                            }
                            else {
                                ts.Debug.fail("Received too many responses");
                            }
                            while (this.requestQueue.length > 0) {
                                const queuedRequest = this.requestQueue.shift();
                                if (this.requestMap.get(queuedRequest.operationId) === queuedRequest) {
                                    this.requestMap.delete(queuedRequest.operationId);
                                    this.scheduleRequest(queuedRequest);
                                    break;
                                }
                                if (this.logger.hasLevel(server.LogLevel.verbose)) {
                                    this.logger.info(`Skipping defunct request for: ${queuedRequest.operationId}`);
                                }
                            }
                            this.projectService.updateTypingsForProject(response);
                            this.event(response, "setTypings");
                            break;
                        }
                    default:
                        ts.assertTypeIsNever(response);
                }
            }
            scheduleRequest(request) {
                if (this.logger.hasLevel(server.LogLevel.verbose)) {
                    this.logger.info(`Scheduling request for: ${request.operationId}`);
                }
                this.activeRequestCount++;
                this.host.setTimeout(request.operation, NodeTypingsInstaller.requestDelayMillis);
            }
        }
        // This number is essentially arbitrary.  Processing more than one typings request
        // at a time makes sense, but having too many in the pipe results in a hang
        // (see https://github.com/nodejs/node/issues/7657).
        // It would be preferable to base our limit on the amount of space left in the
        // buffer, but we have yet to find a way to retrieve that value.
        NodeTypingsInstaller.maxActiveRequestCount = 10;
        NodeTypingsInstaller.requestDelayMillis = 100;
        class IOSession extends server.Session {
            constructor() {
                const event = (body, eventName) => {
                    if (this.constructed) {
                        this.event(body, eventName);
                    }
                    else {
                        // It is unsafe to dereference `this` before initialization completes,
                        // so we defer until the next tick.
                        //
                        // Construction should finish before the next tick fires, so we do not need to do this recursively.
                        setImmediate(() => this.event(body, eventName));
                    }
                };
                const host = sys;
                const typingsInstaller = disableAutomaticTypingAcquisition
                    ? undefined
                    : new NodeTypingsInstaller(telemetryEnabled, logger, host, getGlobalTypingsCacheLocation(), typingSafeListLocation, typesMapLocation, npmLocation, event);
                super({
                    host,
                    cancellationToken,
                    useSingleInferredProject,
                    useInferredProjectPerProjectRoot,
                    typingsInstaller: typingsInstaller || server.nullTypingsInstaller,
                    byteLength: Buffer.byteLength,
                    hrtime: process.hrtime,
                    logger,
                    canUseEvents: true,
                    suppressDiagnosticEvents,
                    syntaxOnly,
                    globalPlugins,
                    pluginProbeLocations,
                    allowLocalPluginLoads,
                });
                this.eventPort = eventPort;
                if (this.canUseEvents && this.eventPort) {
                    const s = net.connect({ port: this.eventPort }, () => {
                        this.eventSocket = s;
                        if (this.socketEventQueue) {
                            // flush queue.
                            for (const event of this.socketEventQueue) {
                                this.writeToEventSocket(event.body, event.eventName);
                            }
                            this.socketEventQueue = undefined;
                        }
                    });
                }
                this.constructed = true;
            }
            event(body, eventName) {
                ts.Debug.assert(this.constructed, "Should only call `IOSession.prototype.event` on an initialized IOSession");
                if (this.canUseEvents && this.eventPort) {
                    if (!this.eventSocket) {
                        if (this.logger.hasLevel(server.LogLevel.verbose)) {
                            this.logger.info(`eventPort: event "${eventName}" queued, but socket not yet initialized`);
                        }
                        (this.socketEventQueue || (this.socketEventQueue = [])).push({ body, eventName });
                        return;
                    }
                    else {
                        ts.Debug.assert(this.socketEventQueue === undefined);
                        this.writeToEventSocket(body, eventName);
                    }
                }
                else {
                    super.event(body, eventName);
                }
            }
            writeToEventSocket(body, eventName) {
                this.eventSocket.write(server.formatMessage(server.toEvent(eventName, body), this.logger, this.byteLength, this.host.newLine), "utf8");
            }
            exit() {
                this.logger.info("Exiting...");
                this.projectService.closeLog();
                process.exit(0);
            }
            listen() {
                rl.on("line", (input) => {
                    const message = input.trim();
                    this.onMessage(message);
                });
                rl.on("close", () => {
                    this.exit();
                });
            }
        }
        function parseLoggingEnvironmentString(logEnvStr) {
            if (!logEnvStr) {
                return {};
            }
            const logEnv = { logToFile: true };
            const args = logEnvStr.split(" ");
            const len = args.length - 1;
            for (let i = 0; i < len; i += 2) {
                const option = args[i];
                const { value, extraPartCounter } = getEntireValue(i + 1);
                i += extraPartCounter;
                if (option && value) {
                    switch (option) {
                        case "-file":
                            logEnv.file = value;
                            break;
                        case "-level":
                            const level = getLogLevel(value);
                            logEnv.detailLevel = level !== undefined ? level : server.LogLevel.normal;
                            break;
                        case "-traceToConsole":
                            logEnv.traceToConsole = value.toLowerCase() === "true";
                            break;
                        case "-logToFile":
                            logEnv.logToFile = value.toLowerCase() === "true";
                            break;
                    }
                }
            }
            return logEnv;
            function getEntireValue(initialIndex) {
                let pathStart = args[initialIndex];
                let extraPartCounter = 0;
                if (pathStart.charCodeAt(0) === 34 /* doubleQuote */ &&
                    pathStart.charCodeAt(pathStart.length - 1) !== 34 /* doubleQuote */) {
                    for (let i = initialIndex + 1; i < args.length; i++) {
                        pathStart += " ";
                        pathStart += args[i];
                        extraPartCounter++;
                        if (pathStart.charCodeAt(pathStart.length - 1) === 34 /* doubleQuote */)
                            break;
                    }
                }
                return { value: ts.stripQuotes(pathStart), extraPartCounter };
            }
        }
        function getLogLevel(level) {
            if (level) {
                const l = level.toLowerCase();
                for (const name in server.LogLevel) {
                    if (isNaN(+name) && l === name.toLowerCase()) {
                        return server.LogLevel[name];
                    }
                }
            }
            return undefined;
        }
        // TSS_LOG "{ level: "normal | verbose | terse", file?: string}"
        function createLogger() {
            const cmdLineLogFileName = server.findArgument("--logFile");
            const cmdLineVerbosity = getLogLevel(server.findArgument("--logVerbosity"));
            const envLogOptions = parseLoggingEnvironmentString(process.env.TSS_LOG);
            const logFileName = cmdLineLogFileName
                ? ts.stripQuotes(cmdLineLogFileName)
                : envLogOptions.logToFile
                    ? envLogOptions.file || (__dirname + "/.log" + process.pid.toString())
                    : undefined;
            const logVerbosity = cmdLineVerbosity || envLogOptions.detailLevel;
            return new Logger(logFileName, envLogOptions.traceToConsole, logVerbosity);
        }
        // This places log file in the directory containing editorServices.js
        // TODO: check that this location is writable
        // average async stat takes about 30 microseconds
        // set chunk size to do 30 files in < 1 millisecond
        function createPollingWatchedFileSet(interval = 2500, chunkSize = 30) {
            const watchedFiles = [];
            let nextFileToCheck = 0;
            return { getModifiedTime, poll, startWatchTimer, addFile, removeFile };
            function getModifiedTime(fileName) {
                return fs.statSync(fileName).mtime;
            }
            function poll(checkedIndex) {
                const watchedFile = watchedFiles[checkedIndex];
                if (!watchedFile) {
                    return;
                }
                fs.stat(watchedFile.fileName, (err, stats) => {
                    if (err) {
                        if (err.code === "ENOENT") {
                            if (watchedFile.mtime.getTime() !== 0) {
                                watchedFile.mtime = ts.missingFileModifiedTime;
                                watchedFile.callback(watchedFile.fileName, ts.FileWatcherEventKind.Deleted);
                            }
                        }
                        else {
                            watchedFile.callback(watchedFile.fileName, ts.FileWatcherEventKind.Changed);
                        }
                    }
                    else {
                        ts.onWatchedFileStat(watchedFile, stats.mtime);
                    }
                });
            }
            // this implementation uses polling and
            // stat due to inconsistencies of fs.watch
            // and efficiency of stat on modern filesystems
            function startWatchTimer() {
                setInterval(() => {
                    let count = 0;
                    let nextToCheck = nextFileToCheck;
                    let firstCheck = -1;
                    while ((count < chunkSize) && (nextToCheck !== firstCheck)) {
                        poll(nextToCheck);
                        if (firstCheck < 0) {
                            firstCheck = nextToCheck;
                        }
                        nextToCheck++;
                        if (nextToCheck === watchedFiles.length) {
                            nextToCheck = 0;
                        }
                        count++;
                    }
                    nextFileToCheck = nextToCheck;
                }, interval);
            }
            function addFile(fileName, callback) {
                const file = {
                    fileName,
                    callback,
                    mtime: sys.fileExists(fileName)
                        ? getModifiedTime(fileName)
                        : ts.missingFileModifiedTime // Any subsequent modification will occur after this time
                };
                watchedFiles.push(file);
                if (watchedFiles.length === 1) {
                    startWatchTimer();
                }
                return file;
            }
            function removeFile(file) {
                ts.unorderedRemoveItem(watchedFiles, file);
            }
        }
        // REVIEW: for now this implementation uses polling.
        // The advantage of polling is that it works reliably
        // on all os and with network mounted files.
        // For 90 referenced files, the average time to detect
        // changes is 2*msInterval (by default 5 seconds).
        // The overhead of this is .04 percent (1/2500) with
        // average pause of < 1 millisecond (and max
        // pause less than 1.5 milliseconds); question is
        // do we anticipate reference sets in the 100s and
        // do we care about waiting 10-20 seconds to detect
        // changes for large reference sets? If so, do we want
        // to increase the chunk size or decrease the interval
        // time dynamically to match the large reference set?
        const pollingWatchedFileSet = createPollingWatchedFileSet();
        const pending = [];
        let canWrite = true;
        function writeMessage(buf) {
            if (!canWrite) {
                pending.push(buf);
            }
            else {
                canWrite = false;
                process.stdout.write(buf, setCanWriteFlagAndWriteMessageIfNecessary);
            }
        }
        function setCanWriteFlagAndWriteMessageIfNecessary() {
            canWrite = true;
            if (pending.length) {
                writeMessage(pending.shift());
            }
        }
        function extractWatchDirectoryCacheKey(path, currentDriveKey) {
            path = ts.normalizeSlashes(path);
            if (isUNCPath(path)) {
                // UNC path: extract server name
                // //server/location
                //         ^ <- from 0 to this position
                const firstSlash = path.indexOf(ts.directorySeparator, 2);
                return firstSlash !== -1 ? path.substring(0, firstSlash).toLowerCase() : path;
            }
            const rootLength = ts.getRootLength(path);
            if (rootLength === 0) {
                // relative path - assume file is on the current drive
                return currentDriveKey;
            }
            if (path.charCodeAt(1) === 58 /* colon */ && path.charCodeAt(2) === 47 /* slash */) {
                // rooted path that starts with c:/... - extract drive letter
                return path.charAt(0).toLowerCase();
            }
            if (path.charCodeAt(0) === 47 /* slash */ && path.charCodeAt(1) !== 47 /* slash */) {
                // rooted path that starts with slash - /somename - use key for current drive
                return currentDriveKey;
            }
            // do not cache any other cases
            return undefined;
        }
        function isUNCPath(s) {
            return s.length > 2 && s.charCodeAt(0) === 47 /* slash */ && s.charCodeAt(1) === 47 /* slash */;
        }
        const logger = createLogger();
        const sys = ts.sys;
        const nodeVersion = ts.getNodeMajorVersion();
        // use watchGuard process on Windows when node version is 4 or later
        const useWatchGuard = process.platform === "win32" && nodeVersion >= 4;
        const originalWatchDirectory = sys.watchDirectory.bind(sys);
        const noopWatcher = { close: ts.noop };
        // This is the function that catches the exceptions when watching directory, and yet lets project service continue to function
        // Eg. on linux the number of watches are limited and one could easily exhaust watches and the exception ENOSPC is thrown when creating watcher at that point
        function watchDirectorySwallowingException(path, callback, recursive) {
            try {
                return originalWatchDirectory(path, callback, recursive);
            }
            catch (e) {
                logger.info(`Exception when creating directory watcher: ${e.message}`);
                return noopWatcher;
            }
        }
        if (useWatchGuard) {
            const currentDrive = extractWatchDirectoryCacheKey(sys.resolvePath(sys.getCurrentDirectory()), /*currentDriveKey*/ undefined);
            const statusCache = ts.createMap();
            sys.watchDirectory = (path, callback, recursive) => {
                const cacheKey = extractWatchDirectoryCacheKey(path, currentDrive);
                let status = cacheKey && statusCache.get(cacheKey);
                if (status === undefined) {
                    if (logger.hasLevel(server.LogLevel.verbose)) {
                        logger.info(`${cacheKey} for path ${path} not found in cache...`);
                    }
                    try {
                        const args = [ts.combinePaths(__dirname, "watchGuard.js"), path];
                        if (logger.hasLevel(server.LogLevel.verbose)) {
                            logger.info(`Starting ${process.execPath} with args:${server.stringifyIndented(args)}`);
                        }
                        childProcess.execFileSync(process.execPath, args, { stdio: "ignore", env: { ELECTRON_RUN_AS_NODE: "1" } });
                        status = true;
                        if (logger.hasLevel(server.LogLevel.verbose)) {
                            logger.info(`WatchGuard for path ${path} returned: OK`);
                        }
                    }
                    catch (e) {
                        status = false;
                        if (logger.hasLevel(server.LogLevel.verbose)) {
                            logger.info(`WatchGuard for path ${path} returned: ${e.message}`);
                        }
                    }
                    if (cacheKey) {
                        statusCache.set(cacheKey, status);
                    }
                }
                else if (logger.hasLevel(server.LogLevel.verbose)) {
                    logger.info(`watchDirectory for ${path} uses cached drive information.`);
                }
                if (status) {
                    // this drive is safe to use - call real 'watchDirectory'
                    return watchDirectorySwallowingException(path, callback, recursive);
                }
                else {
                    // this drive is unsafe - return no-op watcher
                    return noopWatcher;
                }
            };
        }
        else {
            sys.watchDirectory = watchDirectorySwallowingException;
        }
        // Override sys.write because fs.writeSync is not reliable on Node 4
        sys.write = (s) => writeMessage(new Buffer(s, "utf8"));
        sys.watchFile = (fileName, callback) => {
            const watchedFile = pollingWatchedFileSet.addFile(fileName, callback);
            return {
                close: () => pollingWatchedFileSet.removeFile(watchedFile)
            };
        };
        sys.setTimeout = setTimeout;
        sys.clearTimeout = clearTimeout;
        sys.setImmediate = setImmediate;
        sys.clearImmediate = clearImmediate;
        if (typeof global !== "undefined" && global.gc) {
            sys.gc = () => global.gc();
        }
        sys.require = (initialDir, moduleName) => {
            try {
                return { module: require(ts.resolveJavaScriptModule(moduleName, initialDir, sys)), error: undefined };
            }
            catch (error) {
                return { module: undefined, error };
            }
        };
        let cancellationToken;
        try {
            const factory = require("./cancellationToken");
            cancellationToken = factory(sys.args);
        }
        catch (e) {
            cancellationToken = server.nullCancellationToken;
        }
        let eventPort;
        {
            const str = server.findArgument("--eventPort");
            const v = str && parseInt(str);
            if (!isNaN(v)) {
                eventPort = v;
            }
        }
        const localeStr = server.findArgument("--locale");
        if (localeStr) {
            ts.validateLocaleAndSetLanguage(localeStr, sys);
        }
        ts.setStackTraceLimit();
        const typingSafeListLocation = server.findArgument(server.Arguments.TypingSafeListLocation);
        const typesMapLocation = server.findArgument(server.Arguments.TypesMapLocation) || ts.combinePaths(sys.getExecutingFilePath(), "../typesMap.json");
        const npmLocation = server.findArgument(server.Arguments.NpmLocation);
        function parseStringArray(argName) {
            const arg = server.findArgument(argName);
            if (arg === undefined) {
                return server.emptyArray;
            }
            return arg.split(",").filter(name => name !== "");
        }
        const globalPlugins = parseStringArray("--globalPlugins");
        const pluginProbeLocations = parseStringArray("--pluginProbeLocations");
        const allowLocalPluginLoads = server.hasArgument("--allowLocalPluginLoads");
        const useSingleInferredProject = server.hasArgument("--useSingleInferredProject");
        const useInferredProjectPerProjectRoot = server.hasArgument("--useInferredProjectPerProjectRoot");
        const disableAutomaticTypingAcquisition = server.hasArgument("--disableAutomaticTypingAcquisition");
        const suppressDiagnosticEvents = server.hasArgument("--suppressDiagnosticEvents");
        const syntaxOnly = server.hasArgument("--syntaxOnly");
        const telemetryEnabled = server.hasArgument(server.Arguments.EnableTelemetry);
        logger.info(`Starting TS Server`);
        logger.info(`Version: ${ts.version}`);
        logger.info(`Arguments: ${process.argv.join(" ")}`);
        logger.info(`Platform: ${os.platform()} NodeVersion: ${nodeVersion} CaseSensitive: ${sys.useCaseSensitiveFileNames}`);
        const ioSession = new IOSession();
        process.on("uncaughtException", err => {
            ioSession.logError(err, "unknown");
        });
        // See https://github.com/Microsoft/TypeScript/issues/11348
        // tslint:disable-next-line no-unnecessary-type-assertion-2
        process.noAsar = true;
        // Start listening
        ioSession.listen();
    })(server = ts.server || (ts.server = {}));
})(ts || (ts = {}));
