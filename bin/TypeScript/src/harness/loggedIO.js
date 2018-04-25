/// <reference path="..\..\src\compiler\sys.ts" />
/// <reference path="..\..\src\harness\harness.ts" />
/// <reference path="..\..\src\harness\harnessLanguageService.ts" />
/// <reference path="..\..\src\harness\runnerbase.ts" />
/// <reference path="..\..\src\harness\typeWriter.ts" />
var Playback;
(function (Playback) {
    let recordLog;
    let replayLog;
    let replayFilesRead;
    let recordLogFileNameBase = "";
    function memoize(func) {
        let lookup = {};
        const run = ((s) => {
            if (lookup.hasOwnProperty(s))
                return lookup[s];
            return lookup[s] = func(s);
        });
        run.reset = () => {
            lookup = undefined;
        };
        return run;
    }
    function createEmptyLog() {
        return {
            timestamp: (new Date()).toString(),
            arguments: [],
            currentDirectory: "",
            filesRead: [],
            directoriesRead: [],
            filesWritten: [],
            filesDeleted: [],
            filesAppended: [],
            fileExists: [],
            filesFound: [],
            dirs: [],
            dirExists: [],
            dirsCreated: [],
            pathsResolved: [],
            executingPath: ""
        };
    }
    function newStyleLogIntoOldStyleLog(log, host, baseName) {
        for (const file of log.filesAppended) {
            if (file.contentsPath) {
                file.contents = host.readFile(ts.combinePaths(baseName, file.contentsPath));
                delete file.contentsPath;
            }
        }
        for (const file of log.filesWritten) {
            if (file.contentsPath) {
                file.contents = host.readFile(ts.combinePaths(baseName, file.contentsPath));
                delete file.contentsPath;
            }
        }
        for (const file of log.filesRead) {
            if (file.result.contentsPath) {
                // `readFile` strips away a BOM (and actually reinerprets the file contents according to the correct encoding)
                // - but this has the unfortunate sideeffect of removing the BOM from any outputs based on the file, so we readd it here.
                file.result.contents = (file.result.bom || "") + host.readFile(ts.combinePaths(baseName, file.result.contentsPath));
                delete file.result.contentsPath;
            }
        }
        return log;
    }
    Playback.newStyleLogIntoOldStyleLog = newStyleLogIntoOldStyleLog;
    const canonicalizeForHarness = ts.createGetCanonicalFileName(/*caseSensitive*/ false); // This is done so tests work on windows _and_ linux
    function sanitizeTestFilePath(name) {
        const path = ts.toPath(ts.normalizeSlashes(name.replace(/[\^<>:"|?*%]/g, "_")).replace(/\.\.\//g, "__dotdot/"), "", canonicalizeForHarness);
        if (ts.startsWith(path, "/")) {
            return path.substring(1);
        }
        return path;
    }
    function oldStyleLogIntoNewStyleLog(log, writeFile, baseTestName) {
        if (log.filesAppended) {
            for (const file of log.filesAppended) {
                if (file.contents !== undefined) {
                    file.contentsPath = ts.combinePaths("appended", sanitizeTestFilePath(file.path));
                    writeFile(ts.combinePaths(baseTestName, file.contentsPath), file.contents);
                    delete file.contents;
                }
            }
        }
        if (log.filesWritten) {
            for (const file of log.filesWritten) {
                if (file.contents !== undefined) {
                    file.contentsPath = ts.combinePaths("written", sanitizeTestFilePath(file.path));
                    writeFile(ts.combinePaths(baseTestName, file.contentsPath), file.contents);
                    delete file.contents;
                }
            }
        }
        if (log.filesRead) {
            for (const file of log.filesRead) {
                const { contents } = file.result;
                if (contents !== undefined) {
                    file.result.contentsPath = ts.combinePaths("read", sanitizeTestFilePath(file.path));
                    writeFile(ts.combinePaths(baseTestName, file.result.contentsPath), contents);
                    const len = contents.length;
                    if (len >= 2 && contents.charCodeAt(0) === 0xfeff) {
                        file.result.bom = "\ufeff";
                    }
                    if (len >= 2 && contents.charCodeAt(0) === 0xfffe) {
                        file.result.bom = "\ufffe";
                    }
                    if (len >= 3 && contents.charCodeAt(0) === 0xefbb && contents.charCodeAt(1) === 0xbf) {
                        file.result.bom = "\uefbb\xbf";
                    }
                    delete file.result.contents;
                }
            }
        }
        return log;
    }
    Playback.oldStyleLogIntoNewStyleLog = oldStyleLogIntoNewStyleLog;
    function initWrapper(wrapper, underlying) {
        ts.forEach(Object.keys(underlying), prop => {
            wrapper[prop] = underlying[prop];
        });
        wrapper.startReplayFromString = logString => {
            wrapper.startReplayFromData(JSON.parse(logString));
        };
        wrapper.startReplayFromData = log => {
            replayLog = log;
            // Remove non-found files from the log (shouldn't really need them, but we still record them for diagnostic purposes)
            replayLog.filesRead = replayLog.filesRead.filter(f => f.result.contents !== undefined);
            replayFilesRead = ts.createMap();
            for (const file of replayLog.filesRead) {
                replayFilesRead.set(ts.normalizeSlashes(file.path).toLowerCase(), file);
            }
        };
        wrapper.endReplay = () => {
            replayLog = undefined;
            replayFilesRead = undefined;
        };
        wrapper.startRecord = (fileNameBase) => {
            recordLogFileNameBase = fileNameBase;
            recordLog = createEmptyLog();
            recordLog.useCaseSensitiveFileNames = typeof underlying.useCaseSensitiveFileNames === "function" ? underlying.useCaseSensitiveFileNames() : underlying.useCaseSensitiveFileNames;
            if (typeof underlying.args !== "function") {
                recordLog.arguments = underlying.args;
            }
        };
        wrapper.startReplayFromFile = logFn => {
            wrapper.startReplayFromString(underlying.readFile(logFn));
        };
        wrapper.endRecord = () => {
            if (recordLog !== undefined) {
                let i = 0;
                const getBase = () => recordLogFileNameBase + i;
                while (underlying.fileExists(ts.combinePaths(getBase(), "test.json")))
                    i++;
                const newLog = oldStyleLogIntoNewStyleLog(recordLog, (path, str) => underlying.writeFile(path, str), getBase());
                underlying.writeFile(ts.combinePaths(getBase(), "test.json"), JSON.stringify(newLog, null, 4)); // tslint:disable-line:no-null-keyword
                const syntheticTsconfig = generateTsconfig(newLog);
                if (syntheticTsconfig) {
                    underlying.writeFile(ts.combinePaths(getBase(), "tsconfig.json"), JSON.stringify(syntheticTsconfig, null, 4)); // tslint:disable-line:no-null-keyword
                }
                recordLog = undefined;
            }
        };
        function generateTsconfig(newLog) {
            if (newLog.filesRead.some(file => /tsconfig.+json$/.test(file.path))) {
                return;
            }
            const files = [];
            for (const file of newLog.filesRead) {
                if (file.result.contentsPath &&
                    Harness.isDefaultLibraryFile(file.result.contentsPath) &&
                    /\.[tj]s$/.test(file.result.contentsPath)) {
                    files.push(file.result.contentsPath);
                }
            }
            return { compilerOptions: ts.parseCommandLine(newLog.arguments).options, files };
        }
        wrapper.fileExists = recordReplay(wrapper.fileExists, underlying)(path => callAndRecord(underlying.fileExists(path), recordLog.fileExists, { path }), memoize(path => {
            // If we read from the file, it must exist
            if (findFileByPath(path, /*throwFileNotFoundError*/ false)) {
                return true;
            }
            else {
                return findResultByFields(replayLog.fileExists, { path }, /*defaultValue*/ false);
            }
        }));
        wrapper.getExecutingFilePath = () => {
            if (replayLog !== undefined) {
                return replayLog.executingPath;
            }
            else if (recordLog !== undefined) {
                return recordLog.executingPath = underlying.getExecutingFilePath();
            }
            else {
                return underlying.getExecutingFilePath();
            }
        };
        wrapper.getCurrentDirectory = () => {
            if (replayLog !== undefined) {
                return replayLog.currentDirectory || "";
            }
            else if (recordLog !== undefined) {
                return recordLog.currentDirectory = underlying.getCurrentDirectory();
            }
            else {
                return underlying.getCurrentDirectory();
            }
        };
        wrapper.resolvePath = recordReplay(wrapper.resolvePath, underlying)(path => callAndRecord(underlying.resolvePath(path), recordLog.pathsResolved, { path }), memoize(path => findResultByFields(replayLog.pathsResolved, { path }, !ts.isRootedDiskPath(ts.normalizeSlashes(path)) && replayLog.currentDirectory ? replayLog.currentDirectory + "/" + path : ts.normalizeSlashes(path))));
        wrapper.readFile = recordReplay(wrapper.readFile, underlying)((path) => {
            const result = underlying.readFile(path);
            const logEntry = { path, codepage: 0, result: { contents: result, codepage: 0 } };
            recordLog.filesRead.push(logEntry);
            return result;
        }, memoize(path => findFileByPath(path, /*throwFileNotFoundError*/ true).contents));
        wrapper.readDirectory = recordReplay(wrapper.readDirectory, underlying)((path, extensions, exclude, include, depth) => {
            const result = underlying.readDirectory(path, extensions, exclude, include, depth);
            recordLog.directoriesRead.push({ path, extensions, exclude, include, depth, result });
            return result;
        }, path => {
            // Because extensions is an array of all allowed extension, we will want to merge each of the replayLog.directoriesRead into one
            // if each of the directoriesRead has matched path with the given path (directory with same path but different extension will considered
            // different entry).
            // TODO (yuisu): We can certainly remove these once we recapture the RWC using new API
            const normalizedPath = ts.normalizePath(path).toLowerCase();
            return ts.flatMap(replayLog.directoriesRead, directory => {
                if (ts.normalizeSlashes(directory.path).toLowerCase() === normalizedPath) {
                    return directory.result;
                }
            });
        });
        wrapper.writeFile = recordReplay(wrapper.writeFile, underlying)((path, contents) => callAndRecord(underlying.writeFile(path, contents), recordLog.filesWritten, { path, contents, bom: false }), () => noOpReplay("writeFile"));
        wrapper.exit = (exitCode) => {
            if (recordLog !== undefined) {
                wrapper.endRecord();
            }
            underlying.exit(exitCode);
        };
        wrapper.useCaseSensitiveFileNames = () => {
            if (replayLog !== undefined) {
                return !!replayLog.useCaseSensitiveFileNames;
            }
            return typeof underlying.useCaseSensitiveFileNames === "function" ? underlying.useCaseSensitiveFileNames() : underlying.useCaseSensitiveFileNames;
        };
    }
    function recordReplay(original, underlying) {
        function createWrapper(record, replay) {
            // tslint:disable-next-line only-arrow-functions
            return (function () {
                if (replayLog !== undefined) {
                    return replay.apply(undefined, arguments);
                }
                else if (recordLog !== undefined) {
                    return record.apply(undefined, arguments);
                }
                else {
                    return original.apply(underlying, arguments);
                }
            });
        }
        return createWrapper;
    }
    function callAndRecord(underlyingResult, logArray, logEntry) {
        if (underlyingResult !== undefined) {
            logEntry.result = underlyingResult;
        }
        logArray.push(logEntry);
        return underlyingResult;
    }
    function findResultByFields(logArray, expectedFields, defaultValue) {
        const predicate = (entry) => {
            return Object.getOwnPropertyNames(expectedFields).every((name) => entry[name] === expectedFields[name]);
        };
        const results = logArray.filter(entry => predicate(entry));
        if (results.length === 0) {
            if (defaultValue !== undefined) {
                return defaultValue;
            }
            else {
                throw new Error("No matching result in log array for: " + JSON.stringify(expectedFields));
            }
        }
        return results[0].result;
    }
    function findFileByPath(expectedPath, throwFileNotFoundError) {
        const normalizedName = ts.normalizePath(expectedPath).toLowerCase();
        // Try to find the result through normal fileName
        const result = replayFilesRead.get(normalizedName);
        if (result) {
            return result.result;
        }
        // If we got here, we didn't find a match
        if (throwFileNotFoundError) {
            throw new Error("No matching result in log array for path: " + expectedPath);
        }
        else {
            return undefined;
        }
    }
    function noOpReplay(_name) {
        // console.log("Swallowed write operation during replay: " + name);
    }
    function wrapIO(underlying) {
        const wrapper = {};
        initWrapper(wrapper, underlying);
        wrapper.directoryName = notSupported;
        wrapper.createDirectory = notSupported;
        wrapper.directoryExists = notSupported;
        wrapper.deleteFile = notSupported;
        wrapper.listFiles = notSupported;
        return wrapper;
        function notSupported() {
            throw new Error("NotSupported");
        }
    }
    Playback.wrapIO = wrapIO;
    function wrapSystem(underlying) {
        const wrapper = {};
        initWrapper(wrapper, underlying);
        return wrapper;
    }
    Playback.wrapSystem = wrapSystem;
})(Playback || (Playback = {}));
