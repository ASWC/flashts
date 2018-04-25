/// <reference types="node" />
var ts;
(function (ts) {
    var server;
    (function (server) {
        var typingsInstaller;
        (function (typingsInstaller) {
            const fs = require("fs");
            const path = require("path");
            class FileLog {
                constructor(logFile) {
                    this.logFile = logFile;
                    this.logEnabled = true;
                    this.isEnabled = () => {
                        return this.logEnabled && this.logFile !== undefined;
                    };
                    this.writeLine = (text) => {
                        try {
                            fs.appendFileSync(this.logFile, `[${server.nowString()}] ${text}${ts.sys.newLine}`);
                        }
                        catch (e) {
                            this.logEnabled = false;
                        }
                    };
                }
            }
            /** Used if `--npmLocation` is not passed. */
            function getDefaultNPMLocation(processName) {
                if (path.basename(processName).indexOf("node") === 0) {
                    return `"${path.join(path.dirname(process.argv[0]), "npm")}"`;
                }
                else {
                    return "npm";
                }
            }
            function loadTypesRegistryFile(typesRegistryFilePath, host, log) {
                if (!host.fileExists(typesRegistryFilePath)) {
                    if (log.isEnabled()) {
                        log.writeLine(`Types registry file '${typesRegistryFilePath}' does not exist`);
                    }
                    return ts.createMap();
                }
                try {
                    const content = JSON.parse(host.readFile(typesRegistryFilePath));
                    return ts.createMapFromTemplate(content.entries);
                }
                catch (e) {
                    if (log.isEnabled()) {
                        log.writeLine(`Error when loading types registry file '${typesRegistryFilePath}': ${e.message}, ${e.stack}`);
                    }
                    return ts.createMap();
                }
            }
            const typesRegistryPackageName = "types-registry";
            function getTypesRegistryFileLocation(globalTypingsCacheLocation) {
                return ts.combinePaths(ts.normalizeSlashes(globalTypingsCacheLocation), `node_modules/${typesRegistryPackageName}/index.json`);
            }
            class NodeTypingsInstaller extends typingsInstaller.TypingsInstaller {
                constructor(globalTypingsCacheLocation, typingSafeListLocation, typesMapLocation, npmLocation, throttleLimit, log) {
                    super(ts.sys, globalTypingsCacheLocation, typingSafeListLocation ? ts.toPath(typingSafeListLocation, "", ts.createGetCanonicalFileName(ts.sys.useCaseSensitiveFileNames)) : ts.toPath("typingSafeList.json", __dirname, ts.createGetCanonicalFileName(ts.sys.useCaseSensitiveFileNames)), typesMapLocation ? ts.toPath(typesMapLocation, "", ts.createGetCanonicalFileName(ts.sys.useCaseSensitiveFileNames)) : ts.toPath("typesMap.json", __dirname, ts.createGetCanonicalFileName(ts.sys.useCaseSensitiveFileNames)), throttleLimit, log);
                    this.npmPath = npmLocation !== undefined ? npmLocation : getDefaultNPMLocation(process.argv[0]);
                    // If the NPM path contains spaces and isn't wrapped in quotes, do so.
                    if (ts.stringContains(this.npmPath, " ") && this.npmPath[0] !== `"`) {
                        this.npmPath = `"${this.npmPath}"`;
                    }
                    if (this.log.isEnabled()) {
                        this.log.writeLine(`Process id: ${process.pid}`);
                        this.log.writeLine(`NPM location: ${this.npmPath} (explicit '${server.Arguments.NpmLocation}' ${npmLocation === undefined ? "not " : ""} provided)`);
                    }
                    ({ execSync: this.nodeExecSync } = require("child_process"));
                    this.ensurePackageDirectoryExists(globalTypingsCacheLocation);
                    try {
                        if (this.log.isEnabled()) {
                            this.log.writeLine(`Updating ${typesRegistryPackageName} npm package...`);
                        }
                        this.execSyncAndLog(`${this.npmPath} install --ignore-scripts ${typesRegistryPackageName}`, { cwd: globalTypingsCacheLocation });
                        if (this.log.isEnabled()) {
                            this.log.writeLine(`Updated ${typesRegistryPackageName} npm package`);
                        }
                    }
                    catch (e) {
                        if (this.log.isEnabled()) {
                            this.log.writeLine(`Error updating ${typesRegistryPackageName} package: ${e.message}`);
                        }
                        // store error info to report it later when it is known that server is already listening to events from typings installer
                        this.delayedInitializationError = {
                            kind: "event::initializationFailed",
                            message: e.message
                        };
                    }
                    this.typesRegistry = loadTypesRegistryFile(getTypesRegistryFileLocation(globalTypingsCacheLocation), this.installTypingHost, this.log);
                }
                listen() {
                    process.on("message", (req) => {
                        if (this.delayedInitializationError) {
                            // report initializationFailed error
                            this.sendResponse(this.delayedInitializationError);
                            this.delayedInitializationError = undefined;
                        }
                        switch (req.kind) {
                            case "discover":
                                this.install(req);
                                break;
                            case "closeProject":
                                this.closeProject(req);
                                break;
                            case "typesRegistry": {
                                const typesRegistry = {};
                                this.typesRegistry.forEach((value, key) => {
                                    typesRegistry[key] = value;
                                });
                                const response = { kind: server.EventTypesRegistry, typesRegistry };
                                this.sendResponse(response);
                                break;
                            }
                            case "installPackage": {
                                const { fileName, packageName, projectName, projectRootPath } = req;
                                const cwd = getDirectoryOfPackageJson(fileName, this.installTypingHost) || projectRootPath;
                                if (cwd) {
                                    this.installWorker(-1, [packageName], cwd, success => {
                                        const message = success ? `Package ${packageName} installed.` : `There was an error installing ${packageName}.`;
                                        const response = { kind: server.ActionPackageInstalled, projectName, success, message };
                                        this.sendResponse(response);
                                    });
                                }
                                else {
                                    const response = { kind: server.ActionPackageInstalled, projectName, success: false, message: "Could not determine a project root path." };
                                    this.sendResponse(response);
                                }
                                break;
                            }
                            default:
                                ts.Debug.assertNever(req);
                        }
                    });
                }
                sendResponse(response) {
                    if (this.log.isEnabled()) {
                        this.log.writeLine(`Sending response:\n    ${JSON.stringify(response)}`);
                    }
                    process.send(response);
                    if (this.log.isEnabled()) {
                        this.log.writeLine(`Response has been sent.`);
                    }
                }
                installWorker(requestId, packageNames, cwd, onRequestCompleted) {
                    if (this.log.isEnabled()) {
                        this.log.writeLine(`#${requestId} with arguments'${JSON.stringify(packageNames)}'.`);
                    }
                    const start = Date.now();
                    const hasError = typingsInstaller.installNpmPackages(this.npmPath, ts.version, packageNames, command => this.execSyncAndLog(command, { cwd }));
                    if (this.log.isEnabled()) {
                        this.log.writeLine(`npm install #${requestId} took: ${Date.now() - start} ms`);
                    }
                    onRequestCompleted(!hasError);
                }
                /** Returns 'true' in case of error. */
                execSyncAndLog(command, options) {
                    if (this.log.isEnabled()) {
                        this.log.writeLine(`Exec: ${command}`);
                    }
                    try {
                        const stdout = this.nodeExecSync(command, Object.assign({}, options, { encoding: "utf-8" }));
                        if (this.log.isEnabled()) {
                            this.log.writeLine(`    Succeeded. stdout:${indent(ts.sys.newLine, stdout)}`);
                        }
                        return false;
                    }
                    catch (error) {
                        const { stdout, stderr } = error;
                        this.log.writeLine(`    Failed. stdout:${indent(ts.sys.newLine, stdout)}${ts.sys.newLine}    stderr:${indent(ts.sys.newLine, stderr)}`);
                        return true;
                    }
                }
            }
            typingsInstaller.NodeTypingsInstaller = NodeTypingsInstaller;
            function getDirectoryOfPackageJson(fileName, host) {
                return ts.forEachAncestorDirectory(ts.getDirectoryPath(fileName), directory => {
                    if (host.fileExists(ts.combinePaths(directory, "package.json"))) {
                        return directory;
                    }
                });
            }
            const logFilePath = server.findArgument(server.Arguments.LogFile);
            const globalTypingsCacheLocation = server.findArgument(server.Arguments.GlobalCacheLocation);
            const typingSafeListLocation = server.findArgument(server.Arguments.TypingSafeListLocation);
            const typesMapLocation = server.findArgument(server.Arguments.TypesMapLocation);
            const npmLocation = server.findArgument(server.Arguments.NpmLocation);
            const log = new FileLog(logFilePath);
            if (log.isEnabled()) {
                process.on("uncaughtException", (e) => {
                    log.writeLine(`Unhandled exception: ${e} at ${e.stack}`);
                });
            }
            process.on("disconnect", () => {
                if (log.isEnabled()) {
                    log.writeLine(`Parent process has exited, shutting down...`);
                }
                process.exit(0);
            });
            const installer = new NodeTypingsInstaller(globalTypingsCacheLocation, typingSafeListLocation, typesMapLocation, npmLocation, /*throttleLimit*/ 5, log);
            installer.listen();
            function indent(newline, str) {
                return `${newline}    ` + str.replace(/\r?\n/, `${newline}    `);
            }
        })(typingsInstaller = server.typingsInstaller || (server.typingsInstaller = {}));
    })(server = ts.server || (ts.server = {}));
})(ts || (ts = {}));
