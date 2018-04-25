var ts;
(function (ts) {
    /**
     * Set a high stack trace limit to provide more information in case of an error.
     * Called for command-line and server use cases.
     * Not called if TypeScript is used as a library.
     */
    /* @internal */
    function setStackTraceLimit() {
        if (Error.stackTraceLimit < 100) { // Also tests that we won't set the property if it doesn't exist.
            Error.stackTraceLimit = 100;
        }
    }
    ts.setStackTraceLimit = setStackTraceLimit;
    let FileWatcherEventKind;
    (function (FileWatcherEventKind) {
        FileWatcherEventKind[FileWatcherEventKind["Created"] = 0] = "Created";
        FileWatcherEventKind[FileWatcherEventKind["Changed"] = 1] = "Changed";
        FileWatcherEventKind[FileWatcherEventKind["Deleted"] = 2] = "Deleted";
    })(FileWatcherEventKind = ts.FileWatcherEventKind || (ts.FileWatcherEventKind = {}));
    /* @internal */
    let PollingInterval;
    (function (PollingInterval) {
        PollingInterval[PollingInterval["High"] = 2000] = "High";
        PollingInterval[PollingInterval["Medium"] = 500] = "Medium";
        PollingInterval[PollingInterval["Low"] = 250] = "Low";
    })(PollingInterval = ts.PollingInterval || (ts.PollingInterval = {}));
    function getPriorityValues(highPriorityValue) {
        const mediumPriorityValue = highPriorityValue * 2;
        const lowPriorityValue = mediumPriorityValue * 4;
        return [highPriorityValue, mediumPriorityValue, lowPriorityValue];
    }
    function pollingInterval(watchPriority) {
        return pollingIntervalsForPriority[watchPriority];
    }
    const pollingIntervalsForPriority = getPriorityValues(250);
    /* @internal */
    function watchFileUsingPriorityPollingInterval(host, fileName, callback, watchPriority) {
        return host.watchFile(fileName, callback, pollingInterval(watchPriority));
    }
    ts.watchFileUsingPriorityPollingInterval = watchFileUsingPriorityPollingInterval;
    /* @internal */
    ts.missingFileModifiedTime = new Date(0); // Any subsequent modification will occur after this time
    function createPollingIntervalBasedLevels(levels) {
        return {
            [PollingInterval.Low]: levels.Low,
            [PollingInterval.Medium]: levels.Medium,
            [PollingInterval.High]: levels.High
        };
    }
    const defaultChunkLevels = { Low: 32, Medium: 64, High: 256 };
    let pollingChunkSize = createPollingIntervalBasedLevels(defaultChunkLevels);
    /* @internal */
    ts.unchangedPollThresholds = createPollingIntervalBasedLevels(defaultChunkLevels);
    /* @internal */
    function setCustomPollingValues(system) {
        if (!system.getEnvironmentVariable) {
            return;
        }
        const pollingIntervalChanged = setCustomLevels("TSC_WATCH_POLLINGINTERVAL", PollingInterval);
        pollingChunkSize = getCustomPollingBasedLevels("TSC_WATCH_POLLINGCHUNKSIZE", defaultChunkLevels) || pollingChunkSize;
        ts.unchangedPollThresholds = getCustomPollingBasedLevels("TSC_WATCH_UNCHANGEDPOLLTHRESHOLDS", defaultChunkLevels) || ts.unchangedPollThresholds;
        function getLevel(envVar, level) {
            return system.getEnvironmentVariable(`${envVar}_${level.toUpperCase()}`);
        }
        function getCustomLevels(baseVariable) {
            let customLevels;
            setCustomLevel("Low");
            setCustomLevel("Medium");
            setCustomLevel("High");
            return customLevels;
            function setCustomLevel(level) {
                const customLevel = getLevel(baseVariable, level);
                if (customLevel) {
                    (customLevels || (customLevels = {}))[level] = Number(customLevel);
                }
            }
        }
        function setCustomLevels(baseVariable, levels) {
            const customLevels = getCustomLevels(baseVariable);
            if (customLevels) {
                setLevel("Low");
                setLevel("Medium");
                setLevel("High");
                return true;
            }
            return false;
            function setLevel(level) {
                levels[level] = customLevels[level] || levels[level];
            }
        }
        function getCustomPollingBasedLevels(baseVariable, defaultLevels) {
            const customLevels = getCustomLevels(baseVariable);
            return (pollingIntervalChanged || customLevels) &&
                createPollingIntervalBasedLevels(customLevels ? Object.assign({}, defaultLevels, customLevels) : defaultLevels);
        }
    }
    ts.setCustomPollingValues = setCustomPollingValues;
    /* @internal */
    function createDynamicPriorityPollingWatchFile(host) {
        const watchedFiles = [];
        const changedFilesInLastPoll = [];
        const lowPollingIntervalQueue = createPollingIntervalQueue(PollingInterval.Low);
        const mediumPollingIntervalQueue = createPollingIntervalQueue(PollingInterval.Medium);
        const highPollingIntervalQueue = createPollingIntervalQueue(PollingInterval.High);
        return watchFile;
        function watchFile(fileName, callback, defaultPollingInterval) {
            const file = {
                fileName,
                callback,
                unchangedPolls: 0,
                mtime: getModifiedTime(fileName)
            };
            watchedFiles.push(file);
            addToPollingIntervalQueue(file, defaultPollingInterval);
            return {
                close: () => {
                    file.isClosed = true;
                    // Remove from watchedFiles
                    ts.unorderedRemoveItem(watchedFiles, file);
                    // Do not update polling interval queue since that will happen as part of polling
                }
            };
        }
        function createPollingIntervalQueue(pollingInterval) {
            const queue = [];
            queue.pollingInterval = pollingInterval;
            queue.pollIndex = 0;
            queue.pollScheduled = false;
            return queue;
        }
        function pollPollingIntervalQueue(queue) {
            queue.pollIndex = pollQueue(queue, queue.pollingInterval, queue.pollIndex, pollingChunkSize[queue.pollingInterval]);
            // Set the next polling index and timeout
            if (queue.length) {
                scheduleNextPoll(queue.pollingInterval);
            }
            else {
                ts.Debug.assert(queue.pollIndex === 0);
                queue.pollScheduled = false;
            }
        }
        function pollLowPollingIntervalQueue(queue) {
            // Always poll complete list of changedFilesInLastPoll
            pollQueue(changedFilesInLastPoll, PollingInterval.Low, /*pollIndex*/ 0, changedFilesInLastPoll.length);
            // Finally do the actual polling of the queue
            pollPollingIntervalQueue(queue);
            // Schedule poll if there are files in changedFilesInLastPoll but no files in the actual queue
            // as pollPollingIntervalQueue wont schedule for next poll
            if (!queue.pollScheduled && changedFilesInLastPoll.length) {
                scheduleNextPoll(PollingInterval.Low);
            }
        }
        function pollQueue(queue, pollingInterval, pollIndex, chunkSize) {
            // Max visit would be all elements of the queue
            let needsVisit = queue.length;
            let definedValueCopyToIndex = pollIndex;
            for (let polled = 0; polled < chunkSize && needsVisit > 0; nextPollIndex(), needsVisit--) {
                const watchedFile = queue[pollIndex];
                if (!watchedFile) {
                    continue;
                }
                else if (watchedFile.isClosed) {
                    queue[pollIndex] = undefined;
                    continue;
                }
                polled++;
                const fileChanged = onWatchedFileStat(watchedFile, getModifiedTime(watchedFile.fileName));
                if (watchedFile.isClosed) {
                    // Closed watcher as part of callback
                    queue[pollIndex] = undefined;
                }
                else if (fileChanged) {
                    watchedFile.unchangedPolls = 0;
                    // Changed files go to changedFilesInLastPoll queue
                    if (queue !== changedFilesInLastPoll) {
                        queue[pollIndex] = undefined;
                        addChangedFileToLowPollingIntervalQueue(watchedFile);
                    }
                }
                else if (watchedFile.unchangedPolls !== ts.unchangedPollThresholds[pollingInterval]) {
                    watchedFile.unchangedPolls++;
                }
                else if (queue === changedFilesInLastPoll) {
                    // Restart unchangedPollCount for unchanged file and move to low polling interval queue
                    watchedFile.unchangedPolls = 1;
                    queue[pollIndex] = undefined;
                    addToPollingIntervalQueue(watchedFile, PollingInterval.Low);
                }
                else if (pollingInterval !== PollingInterval.High) {
                    watchedFile.unchangedPolls++;
                    queue[pollIndex] = undefined;
                    addToPollingIntervalQueue(watchedFile, pollingInterval === PollingInterval.Low ? PollingInterval.Medium : PollingInterval.High);
                }
                if (queue[pollIndex]) {
                    // Copy this file to the non hole location
                    if (definedValueCopyToIndex < pollIndex) {
                        queue[definedValueCopyToIndex] = watchedFile;
                        queue[pollIndex] = undefined;
                    }
                    definedValueCopyToIndex++;
                }
            }
            // Return next poll index
            return pollIndex;
            function nextPollIndex() {
                pollIndex++;
                if (pollIndex === queue.length) {
                    if (definedValueCopyToIndex < pollIndex) {
                        // There are holes from nextDefinedValueIndex to end of queue, change queue size
                        queue.length = definedValueCopyToIndex;
                    }
                    pollIndex = 0;
                    definedValueCopyToIndex = 0;
                }
            }
        }
        function pollingIntervalQueue(pollingInterval) {
            switch (pollingInterval) {
                case PollingInterval.Low:
                    return lowPollingIntervalQueue;
                case PollingInterval.Medium:
                    return mediumPollingIntervalQueue;
                case PollingInterval.High:
                    return highPollingIntervalQueue;
            }
        }
        function addToPollingIntervalQueue(file, pollingInterval) {
            pollingIntervalQueue(pollingInterval).push(file);
            scheduleNextPollIfNotAlreadyScheduled(pollingInterval);
        }
        function addChangedFileToLowPollingIntervalQueue(file) {
            changedFilesInLastPoll.push(file);
            scheduleNextPollIfNotAlreadyScheduled(PollingInterval.Low);
        }
        function scheduleNextPollIfNotAlreadyScheduled(pollingInterval) {
            if (!pollingIntervalQueue(pollingInterval).pollScheduled) {
                scheduleNextPoll(pollingInterval);
            }
        }
        function scheduleNextPoll(pollingInterval) {
            pollingIntervalQueue(pollingInterval).pollScheduled = host.setTimeout(pollingInterval === PollingInterval.Low ? pollLowPollingIntervalQueue : pollPollingIntervalQueue, pollingInterval, pollingIntervalQueue(pollingInterval));
        }
        function getModifiedTime(fileName) {
            return host.getModifiedTime(fileName) || ts.missingFileModifiedTime;
        }
    }
    ts.createDynamicPriorityPollingWatchFile = createDynamicPriorityPollingWatchFile;
    /**
     * Returns true if file status changed
     */
    /*@internal*/
    function onWatchedFileStat(watchedFile, modifiedTime) {
        const oldTime = watchedFile.mtime.getTime();
        const newTime = modifiedTime.getTime();
        if (oldTime !== newTime) {
            watchedFile.mtime = modifiedTime;
            const eventKind = oldTime === 0
                ? FileWatcherEventKind.Created
                : newTime === 0
                    ? FileWatcherEventKind.Deleted
                    : FileWatcherEventKind.Changed;
            watchedFile.callback(watchedFile.fileName, eventKind);
            return true;
        }
        return false;
    }
    ts.onWatchedFileStat = onWatchedFileStat;
    /**
     * Watch the directory recursively using host provided method to watch child directories
     * that means if this is recursive watcher, watch the children directories as well
     * (eg on OS that dont support recursive watch using fs.watch use fs.watchFile)
     */
    /*@internal*/
    function createRecursiveDirectoryWatcher(host) {
        return createDirectoryWatcher;
        /**
         * Create the directory watcher for the dirPath.
         */
        function createDirectoryWatcher(dirName, callback) {
            const watcher = host.watchDirectory(dirName, fileName => {
                // Call the actual callback
                callback(fileName);
                // Iterate through existing children and update the watches if needed
                updateChildWatches(result, callback);
            });
            let result = {
                close: () => {
                    watcher.close();
                    result.childWatches.forEach(ts.closeFileWatcher);
                    result = undefined;
                },
                dirName,
                childWatches: ts.emptyArray
            };
            updateChildWatches(result, callback);
            return result;
        }
        function updateChildWatches(watcher, callback) {
            // Iterate through existing children and update the watches if needed
            if (watcher) {
                watcher.childWatches = watchChildDirectories(watcher.dirName, watcher.childWatches, callback);
            }
        }
        /**
         * Watch the directories in the parentDir
         */
        function watchChildDirectories(parentDir, existingChildWatches, callback) {
            let newChildWatches;
            ts.enumerateInsertsAndDeletes(host.directoryExists(parentDir) ? ts.mapDefined(host.getAccessibleSortedChildDirectories(parentDir), child => {
                const childFullName = ts.getNormalizedAbsolutePath(child, parentDir);
                // Filter our the symbolic link directories since those arent included in recursive watch
                // which is same behaviour when recursive: true is passed to fs.watch
                return host.filePathComparer(childFullName, host.realpath(childFullName)) === 0 /* EqualTo */ ? childFullName : undefined;
            }) : ts.emptyArray, existingChildWatches, (child, childWatcher) => host.filePathComparer(child, childWatcher.dirName), createAndAddChildDirectoryWatcher, ts.closeFileWatcher, addChildDirectoryWatcher);
            return newChildWatches || ts.emptyArray;
            /**
             * Create new childDirectoryWatcher and add it to the new ChildDirectoryWatcher list
             */
            function createAndAddChildDirectoryWatcher(childName) {
                const result = createDirectoryWatcher(childName, callback);
                addChildDirectoryWatcher(result);
            }
            /**
             * Add child directory watcher to the new ChildDirectoryWatcher list
             */
            function addChildDirectoryWatcher(childWatcher) {
                (newChildWatches || (newChildWatches = [])).push(childWatcher);
            }
        }
    }
    ts.createRecursiveDirectoryWatcher = createRecursiveDirectoryWatcher;
    function getNodeMajorVersion() {
        if (typeof process === "undefined") {
            return undefined;
        }
        const version = process.version;
        if (!version) {
            return undefined;
        }
        const dot = version.indexOf(".");
        if (dot === -1) {
            return undefined;
        }
        return parseInt(version.substring(1, dot));
    }
    ts.getNodeMajorVersion = getNodeMajorVersion;
    ts.sys = (() => {
        // NodeJS detects "\uFEFF" at the start of the string and *replaces* it with the actual
        // byte order mark from the specified encoding. Using any other byte order mark does
        // not actually work.
        const byteOrderMarkIndicator = "\uFEFF";
        function getNodeSystem() {
            const _fs = require("fs");
            const _path = require("path");
            const _os = require("os");
            // crypto can be absent on reduced node installations
            let _crypto;
            try {
                _crypto = require("crypto");
            }
            catch (_b) {
                _crypto = undefined;
            }
            const Buffer = require("buffer").Buffer;
            const nodeVersion = getNodeMajorVersion();
            const isNode4OrLater = nodeVersion >= 4;
            const platform = _os.platform();
            const useCaseSensitiveFileNames = isFileSystemCaseSensitive();
            const useNonPollingWatchers = process.env.TSC_NONPOLLING_WATCHER;
            const tscWatchFile = process.env.TSC_WATCHFILE;
            const tscWatchDirectory = process.env.TSC_WATCHDIRECTORY;
            let dynamicPollingWatchFile;
            const nodeSystem = {
                args: process.argv.slice(2),
                newLine: _os.EOL,
                useCaseSensitiveFileNames,
                write(s) {
                    process.stdout.write(s);
                },
                writeOutputIsTTY() {
                    return process.stdout.isTTY;
                },
                readFile,
                writeFile,
                watchFile: getWatchFile(),
                watchDirectory: getWatchDirectory(),
                resolvePath: path => _path.resolve(path),
                fileExists,
                directoryExists,
                createDirectory(directoryName) {
                    if (!nodeSystem.directoryExists(directoryName)) {
                        _fs.mkdirSync(directoryName);
                    }
                },
                getExecutingFilePath() {
                    return __filename;
                },
                getCurrentDirectory() {
                    return process.cwd();
                },
                getDirectories,
                getEnvironmentVariable(name) {
                    return process.env[name] || "";
                },
                readDirectory,
                getModifiedTime,
                createHash: _crypto ? createMD5HashUsingNativeCrypto : generateDjb2Hash,
                getMemoryUsage() {
                    if (global.gc) {
                        global.gc();
                    }
                    return process.memoryUsage().heapUsed;
                },
                getFileSize(path) {
                    try {
                        const stat = _fs.statSync(path);
                        if (stat.isFile()) {
                            return stat.size;
                        }
                    }
                    catch ( /*ignore*/_b) { /*ignore*/ }
                    return 0;
                },
                exit(exitCode) {
                    process.exit(exitCode);
                },
                realpath,
                debugMode: ts.some(process.execArgv, arg => /^--(inspect|debug)(-brk)?(=\d+)?$/i.test(arg)),
                tryEnableSourceMapsForHost() {
                    try {
                        require("source-map-support").install();
                    }
                    catch (_b) {
                        // Could not enable source maps.
                    }
                },
                setTimeout,
                clearTimeout,
                clearScreen: () => {
                    process.stdout.write("\x1Bc");
                },
                setBlocking: () => {
                    if (process.stdout && process.stdout._handle && process.stdout._handle.setBlocking) {
                        process.stdout._handle.setBlocking(true);
                    }
                },
                base64decode: Buffer.from ? input => {
                    return Buffer.from(input, "base64").toString("utf8");
                } : input => {
                    return new Buffer(input, "base64").toString("utf8");
                },
                base64encode: Buffer.from ? input => {
                    return Buffer.from(input).toString("base64");
                } : input => {
                    return new Buffer(input).toString("base64");
                }
            };
            return nodeSystem;
            function isFileSystemCaseSensitive() {
                // win32\win64 are case insensitive platforms
                if (platform === "win32" || platform === "win64") {
                    return false;
                }
                // If this file exists under a different case, we must be case-insensitve.
                return !fileExists(swapCase(__filename));
            }
            /** Convert all lowercase chars to uppercase, and vice-versa */
            function swapCase(s) {
                return s.replace(/\w/g, (ch) => {
                    const up = ch.toUpperCase();
                    return ch === up ? ch.toLowerCase() : up;
                });
            }
            function getWatchFile() {
                switch (tscWatchFile) {
                    case "PriorityPollingInterval":
                        // Use polling interval based on priority when create watch using host.watchFile
                        return fsWatchFile;
                    case "DynamicPriorityPolling":
                        // Use polling interval but change the interval depending on file changes and their default polling interval
                        return createDynamicPriorityPollingWatchFile({ getModifiedTime, setTimeout });
                    case "UseFsEvents":
                        // Use notifications from FS to watch with falling back to fs.watchFile
                        return watchFileUsingFsWatch;
                    case "UseFsEventsWithFallbackDynamicPolling":
                        // Use notifications from FS to watch with falling back to dynamic watch file
                        dynamicPollingWatchFile = createDynamicPriorityPollingWatchFile({ getModifiedTime, setTimeout });
                        return createWatchFileUsingDynamicWatchFile(dynamicPollingWatchFile);
                    case "UseFsEventsOnParentDirectory":
                        // Use notifications from FS to watch with falling back to fs.watchFile
                        return createNonPollingWatchFile();
                }
                return useNonPollingWatchers ?
                    createNonPollingWatchFile() :
                    // Default to do not use polling interval as it is before this experiment branch
                    (fileName, callback) => fsWatchFile(fileName, callback);
            }
            function getWatchDirectory() {
                // Node 4.0 `fs.watch` function supports the "recursive" option on both OSX and Windows
                // (ref: https://github.com/nodejs/node/pull/2649 and https://github.com/Microsoft/TypeScript/issues/4643)
                const fsSupportsRecursive = isNode4OrLater && (process.platform === "win32" || process.platform === "darwin");
                if (fsSupportsRecursive) {
                    return watchDirectoryUsingFsWatch;
                }
                const watchDirectory = tscWatchDirectory === "RecursiveDirectoryUsingFsWatchFile" ?
                    createWatchDirectoryUsing(fsWatchFile) :
                    tscWatchDirectory === "RecursiveDirectoryUsingDynamicPriorityPolling" ?
                        createWatchDirectoryUsing(dynamicPollingWatchFile || createDynamicPriorityPollingWatchFile({ getModifiedTime, setTimeout })) :
                        watchDirectoryUsingFsWatch;
                const watchDirectoryRecursively = createRecursiveDirectoryWatcher({
                    filePathComparer: useCaseSensitiveFileNames ? ts.compareStringsCaseSensitive : ts.compareStringsCaseInsensitive,
                    directoryExists,
                    getAccessibleSortedChildDirectories: path => getAccessibleFileSystemEntries(path).directories,
                    watchDirectory,
                    realpath
                });
                return (directoryName, callback, recursive) => {
                    if (recursive) {
                        return watchDirectoryRecursively(directoryName, callback);
                    }
                    watchDirectory(directoryName, callback);
                };
            }
            function createNonPollingWatchFile() {
                // One file can have multiple watchers
                const fileWatcherCallbacks = ts.createMultiMap();
                const dirWatchers = ts.createMap();
                const toCanonicalName = ts.createGetCanonicalFileName(useCaseSensitiveFileNames);
                return nonPollingWatchFile;
                function nonPollingWatchFile(fileName, callback) {
                    const filePath = toCanonicalName(fileName);
                    fileWatcherCallbacks.add(filePath, callback);
                    const dirPath = ts.getDirectoryPath(filePath) || ".";
                    const watcher = dirWatchers.get(dirPath) || createDirectoryWatcher(ts.getDirectoryPath(fileName) || ".", dirPath);
                    watcher.referenceCount++;
                    return {
                        close: () => {
                            if (watcher.referenceCount === 1) {
                                watcher.close();
                                dirWatchers.delete(dirPath);
                            }
                            else {
                                watcher.referenceCount--;
                            }
                            fileWatcherCallbacks.remove(filePath, callback);
                        }
                    };
                }
                function createDirectoryWatcher(dirName, dirPath) {
                    const watcher = fsWatchDirectory(dirName, (_eventName, relativeFileName) => {
                        // When files are deleted from disk, the triggered "rename" event would have a relativefileName of "undefined"
                        const fileName = !ts.isString(relativeFileName)
                            ? undefined
                            : ts.getNormalizedAbsolutePath(relativeFileName, dirName);
                        // Some applications save a working file via rename operations
                        const callbacks = fileWatcherCallbacks.get(toCanonicalName(fileName));
                        if (callbacks) {
                            for (const fileCallback of callbacks) {
                                fileCallback(fileName, FileWatcherEventKind.Changed);
                            }
                        }
                    });
                    watcher.referenceCount = 0;
                    dirWatchers.set(dirPath, watcher);
                    return watcher;
                }
            }
            function fsWatchFile(fileName, callback, pollingInterval) {
                _fs.watchFile(fileName, { persistent: true, interval: pollingInterval || 250 }, fileChanged);
                let eventKind;
                return {
                    close: () => _fs.unwatchFile(fileName, fileChanged)
                };
                function fileChanged(curr, prev) {
                    // previous event kind check is to ensure we recongnize the file as previously also missing when it is restored or renamed twice (that is it disappears and reappears)
                    // In such case, prevTime returned is same as prev time of event when file was deleted as per node documentation
                    const isPreviouslyDeleted = +prev.mtime === 0 || eventKind === FileWatcherEventKind.Deleted;
                    if (+curr.mtime === 0) {
                        if (isPreviouslyDeleted) {
                            // Already deleted file, no need to callback again
                            return;
                        }
                        eventKind = FileWatcherEventKind.Deleted;
                    }
                    else if (isPreviouslyDeleted) {
                        eventKind = FileWatcherEventKind.Created;
                    }
                    // If there is no change in modified time, ignore the event
                    else if (+curr.mtime === +prev.mtime) {
                        return;
                    }
                    else {
                        // File changed
                        eventKind = FileWatcherEventKind.Changed;
                    }
                    callback(fileName, eventKind);
                }
            }
            function createFileWatcherCallback(callback) {
                return (_fileName, eventKind) => callback(eventKind === FileWatcherEventKind.Changed ? "change" : "rename", "");
            }
            function createFsWatchCallbackForFileWatcherCallback(fileName, callback) {
                return eventName => {
                    if (eventName === "rename") {
                        callback(fileName, fileExists(fileName) ? FileWatcherEventKind.Created : FileWatcherEventKind.Deleted);
                    }
                    else {
                        // Change
                        callback(fileName, FileWatcherEventKind.Changed);
                    }
                };
            }
            function createFsWatchCallbackForDirectoryWatcherCallback(directoryName, callback) {
                return (eventName, relativeFileName) => {
                    // In watchDirectory we only care about adding and removing files (when event name is
                    // "rename"); changes made within files are handled by corresponding fileWatchers (when
                    // event name is "change")
                    if (eventName === "rename") {
                        // When deleting a file, the passed baseFileName is null
                        callback(!relativeFileName ? directoryName : ts.normalizePath(ts.combinePaths(directoryName, relativeFileName)));
                    }
                };
            }
            function fsWatch(fileOrDirectory, entryKind, callback, recursive, fallbackPollingWatchFile, pollingInterval) {
                let options;
                /** Watcher for the file system entry depending on whether it is missing or present */
                let watcher = !fileSystemEntryExists(fileOrDirectory, entryKind) ?
                    watchMissingFileSystemEntry() :
                    watchPresentFileSystemEntry();
                return {
                    close: () => {
                        // Close the watcher (either existing file system entry watcher or missing file system entry watcher)
                        watcher.close();
                        watcher = undefined;
                    }
                };
                /**
                 * Invoke the callback with rename and update the watcher if not closed
                 * @param createWatcher
                 */
                function invokeCallbackAndUpdateWatcher(createWatcher) {
                    // Call the callback for current directory
                    callback("rename", "");
                    // If watcher is not closed, update it
                    if (watcher) {
                        watcher.close();
                        watcher = createWatcher();
                    }
                }
                /**
                 * Watch the file or directory that is currently present
                 * and when the watched file or directory is deleted, switch to missing file system entry watcher
                 */
                function watchPresentFileSystemEntry() {
                    // Node 4.0 `fs.watch` function supports the "recursive" option on both OSX and Windows
                    // (ref: https://github.com/nodejs/node/pull/2649 and https://github.com/Microsoft/TypeScript/issues/4643)
                    if (options === undefined) {
                        if (isNode4OrLater && (process.platform === "win32" || process.platform === "darwin")) {
                            options = { persistent: true, recursive: !!recursive };
                        }
                        else {
                            options = { persistent: true };
                        }
                    }
                    try {
                        const presentWatcher = _fs.watch(fileOrDirectory, options, callback);
                        // Watch the missing file or directory or error
                        presentWatcher.on("error", () => invokeCallbackAndUpdateWatcher(watchMissingFileSystemEntry));
                        return presentWatcher;
                    }
                    catch (e) {
                        // Catch the exception and use polling instead
                        // Eg. on linux the number of watches are limited and one could easily exhaust watches and the exception ENOSPC is thrown when creating watcher at that point
                        // so instead of throwing error, use fs.watchFile
                        return watchPresentFileSystemEntryWithFsWatchFile();
                    }
                }
                /**
                 * Watch the file or directory using fs.watchFile since fs.watch threw exception
                 * Eg. on linux the number of watches are limited and one could easily exhaust watches and the exception ENOSPC is thrown when creating watcher at that point
                 */
                function watchPresentFileSystemEntryWithFsWatchFile() {
                    return fallbackPollingWatchFile(fileOrDirectory, createFileWatcherCallback(callback), pollingInterval);
                }
                /**
                 * Watch the file or directory that is missing
                 * and switch to existing file or directory when the missing filesystem entry is created
                 */
                function watchMissingFileSystemEntry() {
                    return fallbackPollingWatchFile(fileOrDirectory, (_fileName, eventKind) => {
                        if (eventKind === FileWatcherEventKind.Created && fileSystemEntryExists(fileOrDirectory, entryKind)) {
                            // Call the callback for current file or directory
                            // For now it could be callback for the inner directory creation,
                            // but just return current directory, better than current no-op
                            invokeCallbackAndUpdateWatcher(watchPresentFileSystemEntry);
                        }
                    }, pollingInterval);
                }
            }
            function watchFileUsingFsWatch(fileName, callback, pollingInterval) {
                return fsWatch(fileName, 0 /* File */, createFsWatchCallbackForFileWatcherCallback(fileName, callback), /*recursive*/ false, fsWatchFile, pollingInterval);
            }
            function createWatchFileUsingDynamicWatchFile(watchFile) {
                return (fileName, callback, pollingInterval) => fsWatch(fileName, 0 /* File */, createFsWatchCallbackForFileWatcherCallback(fileName, callback), /*recursive*/ false, watchFile, pollingInterval);
            }
            function fsWatchDirectory(directoryName, callback, recursive) {
                return fsWatch(directoryName, 1 /* Directory */, callback, !!recursive, fsWatchFile);
            }
            function watchDirectoryUsingFsWatch(directoryName, callback, recursive) {
                return fsWatchDirectory(directoryName, createFsWatchCallbackForDirectoryWatcherCallback(directoryName, callback), recursive);
            }
            function createWatchDirectoryUsing(fsWatchFile) {
                return (directoryName, callback) => fsWatchFile(directoryName, () => callback(directoryName), PollingInterval.Medium);
            }
            function readFile(fileName, _encoding) {
                if (!fileExists(fileName)) {
                    return undefined;
                }
                const buffer = _fs.readFileSync(fileName);
                let len = buffer.length;
                if (len >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
                    // Big endian UTF-16 byte order mark detected. Since big endian is not supported by node.js,
                    // flip all byte pairs and treat as little endian.
                    len &= ~1; // Round down to a multiple of 2
                    for (let i = 0; i < len; i += 2) {
                        const temp = buffer[i];
                        buffer[i] = buffer[i + 1];
                        buffer[i + 1] = temp;
                    }
                    return buffer.toString("utf16le", 2);
                }
                if (len >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
                    // Little endian UTF-16 byte order mark detected
                    return buffer.toString("utf16le", 2);
                }
                if (len >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
                    // UTF-8 byte order mark detected
                    return buffer.toString("utf8", 3);
                }
                // Default is UTF-8 with no byte order mark
                return buffer.toString("utf8");
            }
            function writeFile(fileName, data, writeByteOrderMark) {
                // If a BOM is required, emit one
                if (writeByteOrderMark) {
                    data = byteOrderMarkIndicator + data;
                }
                let fd;
                try {
                    fd = _fs.openSync(fileName, "w");
                    _fs.writeSync(fd, data, /*position*/ undefined, "utf8");
                }
                finally {
                    if (fd !== undefined) {
                        _fs.closeSync(fd);
                    }
                }
            }
            function getAccessibleFileSystemEntries(path) {
                try {
                    const entries = _fs.readdirSync(path || ".").sort();
                    const files = [];
                    const directories = [];
                    for (const entry of entries) {
                        // This is necessary because on some file system node fails to exclude
                        // "." and "..". See https://github.com/nodejs/node/issues/4002
                        if (entry === "." || entry === "..") {
                            continue;
                        }
                        const name = ts.combinePaths(path, entry);
                        let stat;
                        try {
                            stat = _fs.statSync(name);
                        }
                        catch (e) {
                            continue;
                        }
                        if (stat.isFile()) {
                            files.push(entry);
                        }
                        else if (stat.isDirectory()) {
                            directories.push(entry);
                        }
                    }
                    return { files, directories };
                }
                catch (e) {
                    return ts.emptyFileSystemEntries;
                }
            }
            function readDirectory(path, extensions, excludes, includes, depth) {
                return ts.matchFiles(path, extensions, excludes, includes, useCaseSensitiveFileNames, process.cwd(), depth, getAccessibleFileSystemEntries);
            }
            function fileSystemEntryExists(path, entryKind) {
                try {
                    const stat = _fs.statSync(path);
                    switch (entryKind) {
                        case 0 /* File */: return stat.isFile();
                        case 1 /* Directory */: return stat.isDirectory();
                    }
                }
                catch (e) {
                    return false;
                }
            }
            function fileExists(path) {
                return fileSystemEntryExists(path, 0 /* File */);
            }
            function directoryExists(path) {
                return fileSystemEntryExists(path, 1 /* Directory */);
            }
            function getDirectories(path) {
                return ts.filter(_fs.readdirSync(path), dir => fileSystemEntryExists(ts.combinePaths(path, dir), 1 /* Directory */));
            }
            function realpath(path) {
                try {
                    return _fs.realpathSync(path);
                }
                catch (_b) {
                    return path;
                }
            }
            function getModifiedTime(path) {
                try {
                    return _fs.statSync(path).mtime;
                }
                catch (e) {
                    return undefined;
                }
            }
            /**
             * djb2 hashing algorithm
             * http://www.cse.yorku.ca/~oz/hash.html
             */
            function generateDjb2Hash(data) {
                const chars = data.split("").map(str => str.charCodeAt(0));
                return `${chars.reduce((prev, curr) => ((prev << 5) + prev) + curr, 5381)}`;
            }
            function createMD5HashUsingNativeCrypto(data) {
                const hash = _crypto.createHash("md5");
                hash.update(data);
                return hash.digest("hex");
            }
        }
        function getChakraSystem() {
            const realpath = ChakraHost.realpath && ((path) => ChakraHost.realpath(path));
            return {
                newLine: ChakraHost.newLine || "\r\n",
                args: ChakraHost.args,
                useCaseSensitiveFileNames: !!ChakraHost.useCaseSensitiveFileNames,
                write: ChakraHost.echo,
                readFile(path, _encoding) {
                    // encoding is automatically handled by the implementation in ChakraHost
                    return ChakraHost.readFile(path);
                },
                writeFile(path, data, writeByteOrderMark) {
                    // If a BOM is required, emit one
                    if (writeByteOrderMark) {
                        data = byteOrderMarkIndicator + data;
                    }
                    ChakraHost.writeFile(path, data);
                },
                resolvePath: ChakraHost.resolvePath,
                fileExists: ChakraHost.fileExists,
                directoryExists: ChakraHost.directoryExists,
                createDirectory: ChakraHost.createDirectory,
                getExecutingFilePath: () => ChakraHost.executingFile,
                getCurrentDirectory: () => ChakraHost.currentDirectory,
                getDirectories: ChakraHost.getDirectories,
                getEnvironmentVariable: ChakraHost.getEnvironmentVariable || (() => ""),
                readDirectory(path, extensions, excludes, includes, _depth) {
                    const pattern = ts.getFileMatcherPatterns(path, excludes, includes, !!ChakraHost.useCaseSensitiveFileNames, ChakraHost.currentDirectory);
                    return ChakraHost.readDirectory(path, extensions, pattern.basePaths, pattern.excludePattern, pattern.includeFilePattern, pattern.includeDirectoryPattern);
                },
                exit: ChakraHost.quit,
                realpath
            };
        }
        function recursiveCreateDirectory(directoryPath, sys) {
            const basePath = ts.getDirectoryPath(directoryPath);
            const shouldCreateParent = basePath !== "" && directoryPath !== basePath && !sys.directoryExists(basePath);
            if (shouldCreateParent) {
                recursiveCreateDirectory(basePath, sys);
            }
            if (shouldCreateParent || !sys.directoryExists(directoryPath)) {
                sys.createDirectory(directoryPath);
            }
        }
        let sys;
        if (typeof ChakraHost !== "undefined") {
            sys = getChakraSystem();
        }
        else if (typeof process !== "undefined" && process.nextTick && !process.browser && typeof require !== "undefined") {
            // process and process.nextTick checks if current environment is node-like
            // process.browser check excludes webpack and browserify
            sys = getNodeSystem();
        }
        if (sys) {
            // patch writefile to create folder before writing the file
            const originalWriteFile = sys.writeFile;
            sys.writeFile = (path, data, writeBom) => {
                const directoryPath = ts.getDirectoryPath(ts.normalizeSlashes(path));
                if (directoryPath && !sys.directoryExists(directoryPath)) {
                    recursiveCreateDirectory(directoryPath, sys);
                }
                originalWriteFile.call(sys, path, data, writeBom);
            };
        }
        return sys;
    })();
    if (ts.sys && ts.sys.getEnvironmentVariable) {
        setCustomPollingValues(ts.sys);
        ts.Debug.currentAssertionLevel = /^development$/i.test(ts.sys.getEnvironmentVariable("NODE_ENV"))
            ? 1 /* Normal */
            : 0 /* None */;
    }
    if (ts.sys && ts.sys.debugMode) {
        ts.Debug.isDebugging = true;
    }
})(ts || (ts = {}));
