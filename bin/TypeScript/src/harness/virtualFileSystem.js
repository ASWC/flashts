/// <reference path="harness.ts" />
/// <reference path="..\compiler\commandLineParser.ts"/>
var Utils;
(function (Utils) {
    class VirtualFileSystemEntry {
        constructor(fileSystem, name) {
            this.fileSystem = fileSystem;
            this.name = name;
        }
        isDirectory() { return false; }
        isFile() { return false; }
        isFileSystem() { return false; }
    }
    Utils.VirtualFileSystemEntry = VirtualFileSystemEntry;
    class VirtualFile extends VirtualFileSystemEntry {
        isFile() { return true; }
    }
    Utils.VirtualFile = VirtualFile;
    class VirtualFileSystemContainer extends VirtualFileSystemEntry {
        getFileSystemEntry(name) {
            for (const entry of this.getFileSystemEntries()) {
                if (this.fileSystem.sameName(entry.name, name)) {
                    return entry;
                }
            }
            return undefined;
        }
        getDirectories() {
            return ts.filter(this.getFileSystemEntries(), entry => entry.isDirectory());
        }
        getFiles() {
            return ts.filter(this.getFileSystemEntries(), entry => entry.isFile());
        }
        getDirectory(name) {
            const entry = this.getFileSystemEntry(name);
            return entry.isDirectory() ? entry : undefined;
        }
        getFile(name) {
            const entry = this.getFileSystemEntry(name);
            return entry.isFile() ? entry : undefined;
        }
    }
    Utils.VirtualFileSystemContainer = VirtualFileSystemContainer;
    class VirtualDirectory extends VirtualFileSystemContainer {
        constructor() {
            super(...arguments);
            this.entries = [];
        }
        isDirectory() { return true; }
        getFileSystemEntries() { return this.entries.slice(); }
        addDirectory(name) {
            const entry = this.getFileSystemEntry(name);
            if (entry === undefined) {
                const directory = new VirtualDirectory(this.fileSystem, name);
                this.entries.push(directory);
                return directory;
            }
            else if (entry.isDirectory()) {
                return entry;
            }
            else {
                return undefined;
            }
        }
        addFile(name, content) {
            const entry = this.getFileSystemEntry(name);
            if (entry === undefined) {
                const file = new VirtualFile(this.fileSystem, name);
                file.content = content;
                this.entries.push(file);
                return file;
            }
            else if (entry.isFile()) {
                entry.content = content;
                return entry;
            }
            else {
                return undefined;
            }
        }
    }
    Utils.VirtualDirectory = VirtualDirectory;
    class VirtualFileSystem extends VirtualFileSystemContainer {
        constructor(currentDirectory, useCaseSensitiveFileNames) {
            super(/*fileSystem*/ undefined, "");
            this.fileSystem = this;
            this.root = new VirtualDirectory(this, "");
            this.currentDirectory = currentDirectory;
            this.useCaseSensitiveFileNames = useCaseSensitiveFileNames;
        }
        isFileSystem() { return true; }
        getFileSystemEntries() { return this.root.getFileSystemEntries(); }
        addDirectory(path) {
            path = ts.normalizePath(path);
            const components = ts.getNormalizedPathComponents(path, this.currentDirectory);
            let directory = this.root;
            for (const component of components) {
                directory = directory.addDirectory(component);
                if (directory === undefined) {
                    break;
                }
            }
            return directory;
        }
        addFile(path, content) {
            const absolutePath = ts.normalizePath(ts.getNormalizedAbsolutePath(path, this.currentDirectory));
            const fileName = ts.getBaseFileName(absolutePath);
            const directoryPath = ts.getDirectoryPath(absolutePath);
            const directory = this.addDirectory(directoryPath);
            return directory ? directory.addFile(fileName, content) : undefined;
        }
        fileExists(path) {
            const entry = this.traversePath(path);
            return entry !== undefined && entry.isFile();
        }
        sameName(a, b) {
            return this.useCaseSensitiveFileNames ? a === b : a.toLowerCase() === b.toLowerCase();
        }
        traversePath(path) {
            path = ts.normalizePath(path);
            let directory = this.root;
            for (const component of ts.getNormalizedPathComponents(path, this.currentDirectory)) {
                const entry = directory.getFileSystemEntry(component);
                if (entry === undefined) {
                    return undefined;
                }
                else if (entry.isDirectory()) {
                    directory = entry;
                }
                else {
                    return entry;
                }
            }
            return directory;
        }
        /**
         * Reads the directory at the given path and retrieves a list of file names and a list
         * of directory names within it. Suitable for use with ts.matchFiles()
         * @param path The path to the directory to be read
         */
        getAccessibleFileSystemEntries(path) {
            const entry = this.traversePath(path);
            if (entry && entry.isDirectory()) {
                return {
                    files: ts.map(entry.getFiles(), f => f.name),
                    directories: ts.map(entry.getDirectories(), d => d.name)
                };
            }
            return { files: [], directories: [] };
        }
        getAllFileEntries() {
            const fileEntries = [];
            getFilesRecursive(this.root, fileEntries);
            return fileEntries;
            function getFilesRecursive(dir, result) {
                const files = dir.getFiles();
                const dirs = dir.getDirectories();
                for (const file of files) {
                    result.push(file);
                }
                for (const subDir of dirs) {
                    getFilesRecursive(subDir, result);
                }
            }
        }
    }
    Utils.VirtualFileSystem = VirtualFileSystem;
    class MockParseConfigHost extends VirtualFileSystem {
        constructor(currentDirectory, ignoreCase, files) {
            super(currentDirectory, ignoreCase);
            if (files instanceof Array) {
                for (const file of files) {
                    this.addFile(file, new Harness.LanguageService.ScriptInfo(file, undefined, /*isRootFile*/ false));
                }
            }
            else {
                files.forEach((fileContent, fileName) => {
                    this.addFile(fileName, new Harness.LanguageService.ScriptInfo(fileName, fileContent, /*isRootFile*/ false));
                });
            }
        }
        readFile(path) {
            const value = this.traversePath(path);
            if (value && value.isFile()) {
                return value.content.content;
            }
        }
        readDirectory(path, extensions, excludes, includes, depth) {
            return ts.matchFiles(path, extensions, excludes, includes, this.useCaseSensitiveFileNames, this.currentDirectory, depth, (path) => this.getAccessibleFileSystemEntries(path));
        }
    }
    Utils.MockParseConfigHost = MockParseConfigHost;
})(Utils || (Utils = {}));
