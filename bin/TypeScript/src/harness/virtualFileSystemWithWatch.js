/// <reference path="harness.ts" />
var ts;
(function (ts) {
    var TestFSWithWatch;
    (function (TestFSWithWatch) {
        TestFSWithWatch.libFile = {
            path: "/a/lib/lib.d.ts",
            content: `/// <reference no-default-lib="true"/>
interface Boolean {}
interface Function {}
interface IArguments {}
interface Number { toExponential: any; }
interface Object {}
interface RegExp {}
interface String { charAt: any; }
interface Array<T> {}`
        };
        TestFSWithWatch.safeList = {
            path: "/safeList.json",
            content: JSON.stringify({
                commander: "commander",
                express: "express",
                jquery: "jquery",
                lodash: "lodash",
                moment: "moment",
                chroma: "chroma-js"
            })
        };
        function getExecutingFilePathFromLibFile() {
            return ts.combinePaths(ts.getDirectoryPath(TestFSWithWatch.libFile.path), "tsc.js");
        }
        function createWatchedSystem(fileOrFolderList, params) {
            if (!params) {
                params = {};
            }
            const host = new TestServerHost(/*withSafelist*/ false, params.useCaseSensitiveFileNames !== undefined ? params.useCaseSensitiveFileNames : false, params.executingFilePath || getExecutingFilePathFromLibFile(), params.currentDirectory || "/", fileOrFolderList, params.newLine, params.useWindowsStylePaths, params.environmentVariables);
            return host;
        }
        TestFSWithWatch.createWatchedSystem = createWatchedSystem;
        function createServerHost(fileOrFolderList, params) {
            if (!params) {
                params = {};
            }
            const host = new TestServerHost(/*withSafelist*/ true, params.useCaseSensitiveFileNames !== undefined ? params.useCaseSensitiveFileNames : false, params.executingFilePath || getExecutingFilePathFromLibFile(), params.currentDirectory || "/", fileOrFolderList, params.newLine, params.useWindowsStylePaths, params.environmentVariables);
            return host;
        }
        TestFSWithWatch.createServerHost = createServerHost;
        function isFolder(s) {
            return s && ts.isArray(s.entries);
        }
        function isFile(s) {
            return s && ts.isString(s.content);
        }
        function isSymLink(s) {
            return s && ts.isString(s.symLink);
        }
        function invokeWatcherCallbacks(callbacks, invokeCallback) {
            if (callbacks) {
                // The array copy is made to ensure that even if one of the callback removes the callbacks,
                // we dont miss any callbacks following it
                const cbs = callbacks.slice();
                for (const cb of cbs) {
                    invokeCallback(cb);
                }
            }
        }
        function getDiffInKeys(map, expectedKeys) {
            if (map.size === expectedKeys.length) {
                return "";
            }
            const notInActual = [];
            const duplicates = [];
            const seen = ts.createMap();
            ts.forEach(expectedKeys, expectedKey => {
                if (seen.has(expectedKey)) {
                    duplicates.push(expectedKey);
                    return;
                }
                seen.set(expectedKey, true);
                if (!map.has(expectedKey)) {
                    notInActual.push(expectedKey);
                }
            });
            const inActualNotExpected = [];
            map.forEach((_value, key) => {
                if (!seen.has(key)) {
                    inActualNotExpected.push(key);
                }
                seen.set(key, true);
            });
            return `\n\nNotInActual: ${notInActual}\nDuplicates: ${duplicates}\nInActualButNotInExpected: ${inActualNotExpected}`;
        }
        function verifyMapSize(caption, map, expectedKeys) {
            assert.equal(map.size, expectedKeys.length, `${caption}: incorrect size of map: Actual keys: ${ts.arrayFrom(map.keys())} Expected: ${expectedKeys}${getDiffInKeys(map, expectedKeys)}`);
        }
        TestFSWithWatch.verifyMapSize = verifyMapSize;
        function checkMapKeys(caption, map, expectedKeys) {
            verifyMapSize(caption, map, expectedKeys);
            for (const name of expectedKeys) {
                assert.isTrue(map.has(name), `${caption} is expected to contain ${name}, actual keys: ${ts.arrayFrom(map.keys())}`);
            }
        }
        function checkMultiMapKeyCount(caption, actual, expectedKeys) {
            verifyMapSize(caption, actual, ts.arrayFrom(expectedKeys.keys()));
            expectedKeys.forEach((count, name) => {
                assert.isTrue(actual.has(name), `${caption}: expected to contain ${name}, actual keys: ${ts.arrayFrom(actual.keys())}`);
                assert.equal(actual.get(name).length, count, `${caption}: Expected to be have ${count} entries for ${name}. Actual entry: ${JSON.stringify(actual.get(name))}`);
            });
        }
        TestFSWithWatch.checkMultiMapKeyCount = checkMultiMapKeyCount;
        function checkMultiMapEachKeyWithCount(caption, actual, expectedKeys, count) {
            return checkMultiMapKeyCount(caption, actual, ts.arrayToMap(expectedKeys, s => s, () => count));
        }
        TestFSWithWatch.checkMultiMapEachKeyWithCount = checkMultiMapEachKeyWithCount;
        function checkArray(caption, actual, expected) {
            assert.equal(actual.length, expected.length, `${caption}: incorrect actual number of files, expected:\r\n${expected.join("\r\n")}\r\ngot: ${actual.join("\r\n")}`);
            for (const f of expected) {
                assert.equal(true, ts.contains(actual, f), `${caption}: expected to find ${f} in ${actual}`);
            }
        }
        TestFSWithWatch.checkArray = checkArray;
        function checkWatchedFiles(host, expectedFiles) {
            checkMapKeys("watchedFiles", host.watchedFiles, expectedFiles);
        }
        TestFSWithWatch.checkWatchedFiles = checkWatchedFiles;
        function checkWatchedFilesDetailed(host, expectedFiles) {
            checkMultiMapKeyCount("watchedFiles", host.watchedFiles, expectedFiles);
        }
        TestFSWithWatch.checkWatchedFilesDetailed = checkWatchedFilesDetailed;
        function checkWatchedDirectories(host, expectedDirectories, recursive) {
            checkMapKeys(`watchedDirectories${recursive ? " recursive" : ""}`, recursive ? host.watchedDirectoriesRecursive : host.watchedDirectories, expectedDirectories);
        }
        TestFSWithWatch.checkWatchedDirectories = checkWatchedDirectories;
        function checkWatchedDirectoriesDetailed(host, expectedDirectories, recursive) {
            checkMultiMapKeyCount(`watchedDirectories${recursive ? " recursive" : ""}`, recursive ? host.watchedDirectoriesRecursive : host.watchedDirectories, expectedDirectories);
        }
        TestFSWithWatch.checkWatchedDirectoriesDetailed = checkWatchedDirectoriesDetailed;
        function checkOutputContains(host, expected) {
            const mapExpected = ts.arrayToSet(expected);
            const mapSeen = ts.createMap();
            for (const f of host.getOutput()) {
                assert.isUndefined(mapSeen.get(f), `Already found ${f} in ${JSON.stringify(host.getOutput())}`);
                if (mapExpected.has(f)) {
                    mapExpected.delete(f);
                    mapSeen.set(f, true);
                }
            }
            assert.equal(mapExpected.size, 0, `Output has missing ${JSON.stringify(ts.arrayFrom(mapExpected.keys()))} in ${JSON.stringify(host.getOutput())}`);
        }
        TestFSWithWatch.checkOutputContains = checkOutputContains;
        function checkOutputDoesNotContain(host, expectedToBeAbsent) {
            const mapExpectedToBeAbsent = ts.arrayToSet(expectedToBeAbsent);
            for (const f of host.getOutput()) {
                assert.isFalse(mapExpectedToBeAbsent.has(f), `Contains ${f} in ${JSON.stringify(host.getOutput())}`);
            }
        }
        TestFSWithWatch.checkOutputDoesNotContain = checkOutputDoesNotContain;
        class Callbacks {
            constructor() {
                this.map = [];
                this.nextId = 1;
            }
            getNextId() {
                return this.nextId;
            }
            register(cb, args) {
                const timeoutId = this.nextId;
                this.nextId++;
                this.map[timeoutId] = cb.bind(/*this*/ undefined, ...args);
                return timeoutId;
            }
            unregister(id) {
                if (typeof id === "number") {
                    delete this.map[id];
                }
            }
            count() {
                let n = 0;
                for (const _ in this.map) {
                    n++;
                }
                return n;
            }
            invoke(invokeKey) {
                if (invokeKey) {
                    this.map[invokeKey]();
                    delete this.map[invokeKey];
                    return;
                }
                // Note: invoking a callback may result in new callbacks been queued,
                // so do not clear the entire callback list regardless. Only remove the
                // ones we have invoked.
                for (const key in this.map) {
                    this.map[key]();
                    delete this.map[key];
                }
            }
        }
        let Tsc_WatchDirectory;
        (function (Tsc_WatchDirectory) {
            Tsc_WatchDirectory["WatchFile"] = "RecursiveDirectoryUsingFsWatchFile";
            Tsc_WatchDirectory["NonRecursiveWatchDirectory"] = "RecursiveDirectoryUsingNonRecursiveWatchDirectory";
            Tsc_WatchDirectory["DynamicPolling"] = "RecursiveDirectoryUsingDynamicPriorityPolling";
        })(Tsc_WatchDirectory = TestFSWithWatch.Tsc_WatchDirectory || (TestFSWithWatch.Tsc_WatchDirectory = {}));
        const timeIncrements = 1000;
        class TestServerHost {
            constructor(withSafeList, useCaseSensitiveFileNames, executingFilePath, currentDirectory, fileOrFolderList, newLine = "\n", useWindowsStylePath, environmentVariables) {
                this.withSafeList = withSafeList;
                this.useCaseSensitiveFileNames = useCaseSensitiveFileNames;
                this.newLine = newLine;
                this.useWindowsStylePath = useWindowsStylePath;
                this.environmentVariables = environmentVariables;
                this.args = [];
                this.output = [];
                this.fs = ts.createMap();
                this.time = timeIncrements;
                this.timeoutCallbacks = new Callbacks();
                this.immediateCallbacks = new Callbacks();
                this.screenClears = [];
                this.watchedDirectories = ts.createMultiMap();
                this.watchedDirectoriesRecursive = ts.createMultiMap();
                this.watchedFiles = ts.createMultiMap();
                this.exitMessage = "System Exit";
                this.resolvePath = (s) => s;
                this.getExecutingFilePath = () => this.executingFilePath;
                this.getCurrentDirectory = () => this.currentDirectory;
                this.getCanonicalFileName = ts.createGetCanonicalFileName(useCaseSensitiveFileNames);
                this.toPath = s => ts.toPath(s, currentDirectory, this.getCanonicalFileName);
                this.executingFilePath = this.getHostSpecificPath(executingFilePath);
                this.currentDirectory = this.getHostSpecificPath(currentDirectory);
                this.reloadFS(fileOrFolderList);
                this.dynamicPriorityWatchFile = this.environmentVariables && this.environmentVariables.get("TSC_WATCHFILE") === "DynamicPriorityPolling" ?
                    ts.createDynamicPriorityPollingWatchFile(this) :
                    undefined;
                const tscWatchDirectory = this.environmentVariables && this.environmentVariables.get("TSC_WATCHDIRECTORY");
                if (tscWatchDirectory === Tsc_WatchDirectory.WatchFile) {
                    const watchDirectory = (directory, cb) => this.watchFile(directory, () => cb(directory), ts.PollingInterval.Medium);
                    this.customRecursiveWatchDirectory = ts.createRecursiveDirectoryWatcher({
                        directoryExists: path => this.directoryExists(path),
                        getAccessibleSortedChildDirectories: path => this.getDirectories(path),
                        filePathComparer: this.useCaseSensitiveFileNames ? ts.compareStringsCaseSensitive : ts.compareStringsCaseInsensitive,
                        watchDirectory,
                        realpath: s => this.realpath(s)
                    });
                }
                else if (tscWatchDirectory === Tsc_WatchDirectory.NonRecursiveWatchDirectory) {
                    const watchDirectory = (directory, cb) => this.watchDirectory(directory, fileName => cb(fileName), /*recursive*/ false);
                    this.customRecursiveWatchDirectory = ts.createRecursiveDirectoryWatcher({
                        directoryExists: path => this.directoryExists(path),
                        getAccessibleSortedChildDirectories: path => this.getDirectories(path),
                        filePathComparer: this.useCaseSensitiveFileNames ? ts.compareStringsCaseSensitive : ts.compareStringsCaseInsensitive,
                        watchDirectory,
                        realpath: s => this.realpath(s)
                    });
                }
                else if (tscWatchDirectory === Tsc_WatchDirectory.DynamicPolling) {
                    const watchFile = ts.createDynamicPriorityPollingWatchFile(this);
                    const watchDirectory = (directory, cb) => watchFile(directory, () => cb(directory), ts.PollingInterval.Medium);
                    this.customRecursiveWatchDirectory = ts.createRecursiveDirectoryWatcher({
                        directoryExists: path => this.directoryExists(path),
                        getAccessibleSortedChildDirectories: path => this.getDirectories(path),
                        filePathComparer: this.useCaseSensitiveFileNames ? ts.compareStringsCaseSensitive : ts.compareStringsCaseInsensitive,
                        watchDirectory,
                        realpath: s => this.realpath(s)
                    });
                }
            }
            getNewLine() {
                return this.newLine;
            }
            toNormalizedAbsolutePath(s) {
                return ts.getNormalizedAbsolutePath(s, this.currentDirectory);
            }
            toFullPath(s) {
                return this.toPath(this.toNormalizedAbsolutePath(s));
            }
            getHostSpecificPath(s) {
                if (this.useWindowsStylePath && s.startsWith(ts.directorySeparator)) {
                    return "c:/" + s.substring(1);
                }
                return s;
            }
            now() {
                this.time += timeIncrements;
                return new Date(this.time);
            }
            reloadFS(fileOrFolderList, options) {
                const mapNewLeaves = ts.createMap();
                const isNewFs = this.fs.size === 0;
                fileOrFolderList = fileOrFolderList.concat(this.withSafeList ? TestFSWithWatch.safeList : []);
                const filesOrFoldersToLoad = !this.useWindowsStylePath ? fileOrFolderList :
                    fileOrFolderList.map(f => {
                        const result = ts.clone(f);
                        result.path = this.getHostSpecificPath(f.path);
                        return result;
                    });
                for (const fileOrDirectory of filesOrFoldersToLoad) {
                    const path = this.toFullPath(fileOrDirectory.path);
                    mapNewLeaves.set(path, true);
                    // If its a change
                    const currentEntry = this.fs.get(path);
                    if (currentEntry) {
                        if (isFile(currentEntry)) {
                            if (ts.isString(fileOrDirectory.content)) {
                                // Update file
                                if (currentEntry.content !== fileOrDirectory.content) {
                                    if (options && options.invokeFileDeleteCreateAsPartInsteadOfChange) {
                                        this.removeFileOrFolder(currentEntry, ts.returnFalse);
                                        this.ensureFileOrFolder(fileOrDirectory);
                                    }
                                    else {
                                        currentEntry.content = fileOrDirectory.content;
                                        currentEntry.modifiedTime = this.now();
                                        this.fs.get(ts.getDirectoryPath(currentEntry.path)).modifiedTime = this.now();
                                        if (options && options.invokeDirectoryWatcherInsteadOfFileChanged) {
                                            this.invokeDirectoryWatcher(ts.getDirectoryPath(currentEntry.fullPath), currentEntry.fullPath);
                                        }
                                        else {
                                            this.invokeFileWatcher(currentEntry.fullPath, ts.FileWatcherEventKind.Changed);
                                        }
                                    }
                                }
                            }
                            else {
                                // TODO: Changing from file => folder/Symlink
                            }
                        }
                        else if (isSymLink(currentEntry)) {
                            // TODO: update symlinks
                        }
                        else {
                            // Folder
                            if (ts.isString(fileOrDirectory.content)) {
                                // TODO: Changing from folder => file
                            }
                            else {
                                // Folder update: Nothing to do.
                                currentEntry.modifiedTime = this.now();
                            }
                        }
                    }
                    else {
                        this.ensureFileOrFolder(fileOrDirectory, options && options.ignoreWatchInvokedWithTriggerAsFileCreate);
                    }
                }
                if (!isNewFs) {
                    this.fs.forEach((fileOrDirectory, path) => {
                        // If this entry is not from the new file or folder
                        if (!mapNewLeaves.get(path)) {
                            // Leaf entries that arent in new list => remove these
                            if (isFile(fileOrDirectory) || isSymLink(fileOrDirectory) || isFolder(fileOrDirectory) && fileOrDirectory.entries.length === 0) {
                                this.removeFileOrFolder(fileOrDirectory, folder => !mapNewLeaves.get(folder.path));
                            }
                        }
                    });
                }
            }
            renameFolder(folderName, newFolderName) {
                const fullPath = ts.getNormalizedAbsolutePath(folderName, this.currentDirectory);
                const path = this.toPath(fullPath);
                const folder = this.fs.get(path);
                ts.Debug.assert(!!folder);
                // Only remove the folder
                this.removeFileOrFolder(folder, ts.returnFalse, /*isRenaming*/ true);
                // Add updated folder with new folder name
                const newFullPath = ts.getNormalizedAbsolutePath(newFolderName, this.currentDirectory);
                const newFolder = this.toFolder(newFullPath);
                const newPath = newFolder.path;
                const basePath = ts.getDirectoryPath(path);
                ts.Debug.assert(basePath !== path);
                ts.Debug.assert(basePath === ts.getDirectoryPath(newPath));
                const baseFolder = this.fs.get(basePath);
                this.addFileOrFolderInFolder(baseFolder, newFolder);
                // Invoke watches for files in the folder as deleted (from old path)
                this.renameFolderEntries(folder, newFolder);
            }
            renameFolderEntries(oldFolder, newFolder) {
                for (const entry of oldFolder.entries) {
                    this.fs.delete(entry.path);
                    this.invokeFileWatcher(entry.fullPath, ts.FileWatcherEventKind.Deleted);
                    entry.fullPath = ts.combinePaths(newFolder.fullPath, ts.getBaseFileName(entry.fullPath));
                    entry.path = this.toPath(entry.fullPath);
                    if (newFolder !== oldFolder) {
                        newFolder.entries.push(entry);
                    }
                    this.fs.set(entry.path, entry);
                    this.invokeFileWatcher(entry.fullPath, ts.FileWatcherEventKind.Created);
                    if (isFolder(entry)) {
                        this.renameFolderEntries(entry, entry);
                    }
                }
            }
            ensureFileOrFolder(fileOrDirectory, ignoreWatchInvokedWithTriggerAsFileCreate) {
                if (ts.isString(fileOrDirectory.content)) {
                    const file = this.toFile(fileOrDirectory);
                    // file may already exist when updating existing type declaration file
                    if (!this.fs.get(file.path)) {
                        const baseFolder = this.ensureFolder(ts.getDirectoryPath(file.fullPath));
                        this.addFileOrFolderInFolder(baseFolder, file, ignoreWatchInvokedWithTriggerAsFileCreate);
                    }
                }
                else if (ts.isString(fileOrDirectory.symLink)) {
                    const symLink = this.toSymLink(fileOrDirectory);
                    ts.Debug.assert(!this.fs.get(symLink.path));
                    const baseFolder = this.ensureFolder(ts.getDirectoryPath(symLink.fullPath));
                    this.addFileOrFolderInFolder(baseFolder, symLink, ignoreWatchInvokedWithTriggerAsFileCreate);
                }
                else {
                    const fullPath = ts.getNormalizedAbsolutePath(fileOrDirectory.path, this.currentDirectory);
                    this.ensureFolder(fullPath);
                }
            }
            ensureFolder(fullPath) {
                const path = this.toPath(fullPath);
                let folder = this.fs.get(path);
                if (!folder) {
                    folder = this.toFolder(fullPath);
                    const baseFullPath = ts.getDirectoryPath(fullPath);
                    if (fullPath !== baseFullPath) {
                        // Add folder in the base folder
                        const baseFolder = this.ensureFolder(baseFullPath);
                        this.addFileOrFolderInFolder(baseFolder, folder);
                    }
                    else {
                        // root folder
                        ts.Debug.assert(this.fs.size === 0);
                        this.fs.set(path, folder);
                    }
                }
                ts.Debug.assert(isFolder(folder));
                return folder;
            }
            addFileOrFolderInFolder(folder, fileOrDirectory, ignoreWatch) {
                ts.insertSorted(folder.entries, fileOrDirectory, (a, b) => ts.compareStringsCaseSensitive(ts.getBaseFileName(a.path), ts.getBaseFileName(b.path)));
                folder.modifiedTime = this.now();
                this.fs.set(fileOrDirectory.path, fileOrDirectory);
                if (ignoreWatch) {
                    return;
                }
                this.invokeFileWatcher(fileOrDirectory.fullPath, ts.FileWatcherEventKind.Created);
                this.invokeDirectoryWatcher(folder.fullPath, fileOrDirectory.fullPath);
            }
            removeFileOrFolder(fileOrDirectory, isRemovableLeafFolder, isRenaming) {
                const basePath = ts.getDirectoryPath(fileOrDirectory.path);
                const baseFolder = this.fs.get(basePath);
                if (basePath !== fileOrDirectory.path) {
                    ts.Debug.assert(!!baseFolder);
                    baseFolder.modifiedTime = this.now();
                    ts.filterMutate(baseFolder.entries, entry => entry !== fileOrDirectory);
                }
                this.fs.delete(fileOrDirectory.path);
                this.invokeFileWatcher(fileOrDirectory.fullPath, ts.FileWatcherEventKind.Deleted);
                if (isFolder(fileOrDirectory)) {
                    ts.Debug.assert(fileOrDirectory.entries.length === 0 || isRenaming);
                    const relativePath = this.getRelativePathToDirectory(fileOrDirectory.fullPath, fileOrDirectory.fullPath);
                    // Invoke directory and recursive directory watcher for the folder
                    // Here we arent invoking recursive directory watchers for the base folders
                    // since that is something we would want to do for both file as well as folder we are deleting
                    this.invokeWatchedDirectoriesCallback(fileOrDirectory.fullPath, relativePath);
                    this.invokeWatchedDirectoriesRecursiveCallback(fileOrDirectory.fullPath, relativePath);
                }
                if (basePath !== fileOrDirectory.path) {
                    if (baseFolder.entries.length === 0 && isRemovableLeafFolder(baseFolder)) {
                        this.removeFileOrFolder(baseFolder, isRemovableLeafFolder);
                    }
                    else {
                        this.invokeRecursiveDirectoryWatcher(baseFolder.fullPath, fileOrDirectory.fullPath);
                    }
                }
            }
            // For overriding the methods
            invokeWatchedDirectoriesCallback(folderFullPath, relativePath) {
                invokeWatcherCallbacks(this.watchedDirectories.get(this.toPath(folderFullPath)), cb => this.directoryCallback(cb, relativePath));
            }
            invokeWatchedDirectoriesRecursiveCallback(folderFullPath, relativePath) {
                invokeWatcherCallbacks(this.watchedDirectoriesRecursive.get(this.toPath(folderFullPath)), cb => this.directoryCallback(cb, relativePath));
            }
            invokeFileWatcher(fileFullPath, eventKind, useFileNameInCallback) {
                invokeWatcherCallbacks(this.watchedFiles.get(this.toPath(fileFullPath)), ({ cb, fileName }) => cb(useFileNameInCallback ? fileName : fileFullPath, eventKind));
            }
            getRelativePathToDirectory(directoryFullPath, fileFullPath) {
                return ts.getRelativePathToDirectoryOrUrl(directoryFullPath, fileFullPath, this.currentDirectory, this.getCanonicalFileName, /*isAbsolutePathAnUrl*/ false);
            }
            /**
             * This will call the directory watcher for the folderFullPath and recursive directory watchers for this and base folders
             */
            invokeDirectoryWatcher(folderFullPath, fileName) {
                const relativePath = this.getRelativePathToDirectory(folderFullPath, fileName);
                // Folder is changed when the directory watcher is invoked
                this.invokeFileWatcher(folderFullPath, ts.FileWatcherEventKind.Changed, /*useFileNameInCallback*/ true);
                this.invokeWatchedDirectoriesCallback(folderFullPath, relativePath);
                this.invokeRecursiveDirectoryWatcher(folderFullPath, fileName);
            }
            directoryCallback({ cb, directoryName }, relativePath) {
                cb(ts.combinePaths(directoryName, relativePath));
            }
            /**
             * This will call the recursive directory watcher for this directory as well as all the base directories
             */
            invokeRecursiveDirectoryWatcher(fullPath, fileName) {
                const relativePath = this.getRelativePathToDirectory(fullPath, fileName);
                this.invokeWatchedDirectoriesRecursiveCallback(fullPath, relativePath);
                const basePath = ts.getDirectoryPath(fullPath);
                if (this.getCanonicalFileName(fullPath) !== this.getCanonicalFileName(basePath)) {
                    this.invokeRecursiveDirectoryWatcher(basePath, fileName);
                }
            }
            toFsEntry(path) {
                const fullPath = ts.getNormalizedAbsolutePath(path, this.currentDirectory);
                return {
                    path: this.toPath(fullPath),
                    fullPath,
                    modifiedTime: this.now()
                };
            }
            toFile(fileOrDirectory) {
                const file = this.toFsEntry(fileOrDirectory.path);
                file.content = fileOrDirectory.content;
                file.fileSize = fileOrDirectory.fileSize;
                return file;
            }
            toSymLink(fileOrDirectory) {
                const symLink = this.toFsEntry(fileOrDirectory.path);
                symLink.symLink = ts.getNormalizedAbsolutePath(fileOrDirectory.symLink, ts.getDirectoryPath(symLink.fullPath));
                return symLink;
            }
            toFolder(path) {
                const folder = this.toFsEntry(path);
                folder.entries = [];
                return folder;
            }
            getRealFsEntry(isFsEntry, path, fsEntry = this.fs.get(path)) {
                if (isFsEntry(fsEntry)) {
                    return fsEntry;
                }
                if (isSymLink(fsEntry)) {
                    return this.getRealFsEntry(isFsEntry, this.toPath(fsEntry.symLink));
                }
                if (fsEntry) {
                    // This fs entry is something else
                    return undefined;
                }
                const realpath = this.realpath(path);
                if (path !== realpath) {
                    return this.getRealFsEntry(isFsEntry, this.toPath(realpath));
                }
                return undefined;
            }
            isFile(fsEntry) {
                return !!this.getRealFile(fsEntry.path, fsEntry);
            }
            getRealFile(path, fsEntry) {
                return this.getRealFsEntry(isFile, path, fsEntry);
            }
            isFolder(fsEntry) {
                return !!this.getRealFolder(fsEntry.path, fsEntry);
            }
            getRealFolder(path, fsEntry = this.fs.get(path)) {
                return this.getRealFsEntry(isFolder, path, fsEntry);
            }
            fileExists(s) {
                const path = this.toFullPath(s);
                return !!this.getRealFile(path);
            }
            getModifiedTime(s) {
                const path = this.toFullPath(s);
                const fsEntry = this.fs.get(path);
                return fsEntry && fsEntry.modifiedTime;
            }
            readFile(s) {
                const fsEntry = this.getRealFile(this.toFullPath(s));
                return fsEntry ? fsEntry.content : undefined;
            }
            getFileSize(s) {
                const path = this.toFullPath(s);
                const entry = this.fs.get(path);
                if (isFile(entry)) {
                    return entry.fileSize ? entry.fileSize : entry.content.length;
                }
                return undefined;
            }
            directoryExists(s) {
                const path = this.toFullPath(s);
                return !!this.getRealFolder(path);
            }
            getDirectories(s) {
                const path = this.toFullPath(s);
                const folder = this.getRealFolder(path);
                if (folder) {
                    return ts.mapDefined(folder.entries, entry => this.isFolder(entry) ? ts.getBaseFileName(entry.fullPath) : undefined);
                }
                ts.Debug.fail(folder ? "getDirectories called on file" : "getDirectories called on missing folder");
                return [];
            }
            readDirectory(path, extensions, exclude, include, depth) {
                return ts.matchFiles(path, extensions, exclude, include, this.useCaseSensitiveFileNames, this.getCurrentDirectory(), depth, (dir) => {
                    const directories = [];
                    const files = [];
                    const folder = this.getRealFolder(this.toPath(dir));
                    if (folder) {
                        folder.entries.forEach((entry) => {
                            if (this.isFolder(entry)) {
                                directories.push(ts.getBaseFileName(entry.fullPath));
                            }
                            else if (this.isFile(entry)) {
                                files.push(ts.getBaseFileName(entry.fullPath));
                            }
                            else {
                                ts.Debug.fail("Unknown entry");
                            }
                        });
                    }
                    return { directories, files };
                });
            }
            watchDirectory(directoryName, cb, recursive) {
                if (recursive && this.customRecursiveWatchDirectory) {
                    return this.customRecursiveWatchDirectory(directoryName, cb, /*recursive*/ true);
                }
                const path = this.toFullPath(directoryName);
                const map = recursive ? this.watchedDirectoriesRecursive : this.watchedDirectories;
                const callback = {
                    cb,
                    directoryName
                };
                map.add(path, callback);
                return {
                    close: () => map.remove(path, callback)
                };
            }
            createHash(s) {
                return Harness.mockHash(s);
            }
            watchFile(fileName, cb, pollingInterval) {
                if (this.dynamicPriorityWatchFile) {
                    return this.dynamicPriorityWatchFile(fileName, cb, pollingInterval);
                }
                const path = this.toFullPath(fileName);
                const callback = { fileName, cb };
                this.watchedFiles.add(path, callback);
                return { close: () => this.watchedFiles.remove(path, callback) };
            }
            // TOOD: record and invoke callbacks to simulate timer events
            setTimeout(callback, _time, ...args) {
                return this.timeoutCallbacks.register(callback, args);
            }
            getNextTimeoutId() {
                return this.timeoutCallbacks.getNextId();
            }
            clearTimeout(timeoutId) {
                this.timeoutCallbacks.unregister(timeoutId);
            }
            clearScreen() {
                this.screenClears.push(this.output.length);
            }
            checkTimeoutQueueLengthAndRun(expected) {
                this.checkTimeoutQueueLength(expected);
                this.runQueuedTimeoutCallbacks();
            }
            checkTimeoutQueueLength(expected) {
                const callbacksCount = this.timeoutCallbacks.count();
                assert.equal(callbacksCount, expected, `expected ${expected} timeout callbacks queued but found ${callbacksCount}.`);
            }
            runQueuedTimeoutCallbacks(timeoutId) {
                try {
                    this.timeoutCallbacks.invoke(timeoutId);
                }
                catch (e) {
                    if (e.message === this.exitMessage) {
                        return;
                    }
                    throw e;
                }
            }
            runQueuedImmediateCallbacks(checkCount) {
                if (checkCount !== undefined) {
                    assert.equal(this.immediateCallbacks.count(), checkCount);
                }
                this.immediateCallbacks.invoke();
            }
            setImmediate(callback, _time, ...args) {
                return this.immediateCallbacks.register(callback, args);
            }
            clearImmediate(timeoutId) {
                this.immediateCallbacks.unregister(timeoutId);
            }
            createDirectory(directoryName) {
                const folder = this.toFolder(directoryName);
                // base folder has to be present
                const base = ts.getDirectoryPath(folder.path);
                const baseFolder = this.fs.get(base);
                ts.Debug.assert(isFolder(baseFolder));
                ts.Debug.assert(!this.fs.get(folder.path));
                this.addFileOrFolderInFolder(baseFolder, folder);
            }
            writeFile(path, content) {
                const file = this.toFile({ path, content });
                // base folder has to be present
                const base = ts.getDirectoryPath(file.path);
                const folder = this.fs.get(base);
                ts.Debug.assert(isFolder(folder));
                this.addFileOrFolderInFolder(folder, file);
            }
            write(message) {
                this.output.push(message);
            }
            getOutput() {
                return this.output;
            }
            clearOutput() {
                ts.clear(this.output);
                this.screenClears.length = 0;
            }
            realpath(s) {
                const fullPath = this.toNormalizedAbsolutePath(s);
                const path = this.toPath(fullPath);
                if (ts.getDirectoryPath(path) === path) {
                    // Root
                    return s;
                }
                const dirFullPath = this.realpath(ts.getDirectoryPath(fullPath));
                const realFullPath = ts.combinePaths(dirFullPath, ts.getBaseFileName(fullPath));
                const fsEntry = this.fs.get(this.toPath(realFullPath));
                if (isSymLink(fsEntry)) {
                    return this.realpath(fsEntry.symLink);
                }
                return realFullPath;
            }
            exit(exitCode) {
                this.exitCode = exitCode;
                throw new Error(this.exitMessage);
            }
            getEnvironmentVariable(name) {
                return this.environmentVariables && this.environmentVariables.get(name);
            }
        }
        TestFSWithWatch.TestServerHost = TestServerHost;
    })(TestFSWithWatch = ts.TestFSWithWatch || (ts.TestFSWithWatch = {}));
})(ts || (ts = {}));
