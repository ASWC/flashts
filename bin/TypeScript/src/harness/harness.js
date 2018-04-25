//
// Copyright (c) Microsoft Corporation.  All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
/// <reference path="..\services\services.ts" />
/// <reference path="..\services\shims.ts" />
/// <reference path="..\server\session.ts" />
/// <reference path="..\server\client.ts" />
/// <reference path="sourceMapRecorder.ts"/>
/// <reference path="runnerbase.ts"/>
/// <reference path="virtualFileSystem.ts" />
/// <reference types="node" />
/// <reference types="mocha" />
/// <reference types="chai" />
// Block scoped definitions work poorly for global variables, temporarily enable var
/* tslint:disable:no-var-keyword */
// this will work in the browser via browserify
var _chai = require("chai");
var assert = _chai.assert;
{
    // chai's builtin `assert.isFalse` is featureful but slow - we don't use those features,
    // so we'll just overwrite it as an alterative to migrating a bunch of code off of chai
    assert.isFalse = (expr, msg) => { if (expr !== false)
        throw new Error(msg); };
    const assertDeepImpl = assert.deepEqual;
    assert.deepEqual = (a, b, msg) => {
        if (ts.isArray(a) && ts.isArray(b)) {
            assertDeepImpl(arrayExtraKeysObject(a), arrayExtraKeysObject(b), "Array extra keys differ");
        }
        assertDeepImpl(a, b, msg);
        function arrayExtraKeysObject(a) {
            const obj = {};
            for (const key in a) {
                if (Number.isNaN(Number(key))) {
                    obj[key] = a[key];
                }
            }
            return obj;
        }
    };
}
var global = Function("return this").call(undefined);
/* tslint:enable:no-var-keyword */
var Utils;
(function (Utils) {
    function getExecutionEnvironment() {
        if (typeof window !== "undefined") {
            return 1 /* Browser */;
        }
        else {
            return 0 /* Node */;
        }
    }
    Utils.getExecutionEnvironment = getExecutionEnvironment;
    Utils.currentExecutionEnvironment = getExecutionEnvironment();
    // Thanks to browserify, Buffer is always available nowadays
    const Buffer = require("buffer").Buffer;
    function encodeString(s) {
        return Buffer.from(s).toString("utf8");
    }
    Utils.encodeString = encodeString;
    function byteLength(s, encoding) {
        // stub implementation if Buffer is not available (in-browser case)
        return Buffer.byteLength(s, encoding);
    }
    Utils.byteLength = byteLength;
    function evalFile(fileContents, fileName, nodeContext) {
        const environment = getExecutionEnvironment();
        switch (environment) {
            case 1 /* Browser */:
                eval(fileContents);
                break;
            case 0 /* Node */:
                const vm = require("vm");
                if (nodeContext) {
                    vm.runInNewContext(fileContents, nodeContext, fileName);
                }
                else {
                    vm.runInThisContext(fileContents, fileName);
                }
                break;
            default:
                throw new Error("Unknown context");
        }
    }
    Utils.evalFile = evalFile;
    /** Splits the given string on \r\n, or on only \n if that fails, or on only \r if *that* fails. */
    function splitContentByNewlines(content) {
        // Split up the input file by line
        // Note: IE JS engine incorrectly handles consecutive delimiters here when using RegExp split, so
        // we have to use string-based splitting instead and try to figure out the delimiting chars
        let lines = content.split("\r\n");
        if (lines.length === 1) {
            lines = content.split("\n");
            if (lines.length === 1) {
                lines = content.split("\r");
            }
        }
        return lines;
    }
    Utils.splitContentByNewlines = splitContentByNewlines;
    /** Reads a file under /tests */
    function readTestFile(path) {
        if (path.indexOf("tests") < 0) {
            path = "tests/" + path;
        }
        let content;
        try {
            content = Harness.IO.readFile(Harness.userSpecifiedRoot + path);
        }
        catch (err) {
            return undefined;
        }
        return content;
    }
    Utils.readTestFile = readTestFile;
    function memoize(f, memoKey) {
        const cache = ts.createMap();
        return (function (...args) {
            const key = memoKey(...args);
            if (cache.has(key)) {
                return cache.get(key);
            }
            else {
                const value = f.apply(this, args);
                cache.set(key, value);
                return value;
            }
        });
    }
    Utils.memoize = memoize;
    Utils.canonicalizeForHarness = ts.createGetCanonicalFileName(/*caseSensitive*/ false); // This is done so tests work on windows _and_ linux
    function assertInvariants(node, parent) {
        if (node) {
            assert.isFalse(node.pos < 0, "node.pos < 0");
            assert.isFalse(node.end < 0, "node.end < 0");
            assert.isFalse(node.end < node.pos, "node.end < node.pos");
            assert.equal(node.parent, parent, "node.parent !== parent");
            if (parent) {
                // Make sure each child is contained within the parent.
                assert.isFalse(node.pos < parent.pos, "node.pos < parent.pos");
                assert.isFalse(node.end > parent.end, "node.end > parent.end");
            }
            ts.forEachChild(node, child => {
                assertInvariants(child, node);
            });
            // Make sure each of the children is in order.
            let currentPos = 0;
            ts.forEachChild(node, child => {
                assert.isFalse(child.pos < currentPos, "child.pos < currentPos");
                currentPos = child.end;
            }, array => {
                assert.isFalse(array.pos < node.pos, "array.pos < node.pos");
                assert.isFalse(array.end > node.end, "array.end > node.end");
                assert.isFalse(array.pos < currentPos, "array.pos < currentPos");
                for (const item of array) {
                    assert.isFalse(item.pos < currentPos, "array[i].pos < currentPos");
                    currentPos = item.end;
                }
                currentPos = array.end;
            });
            const childNodesAndArrays = [];
            ts.forEachChild(node, child => { childNodesAndArrays.push(child); }, array => { childNodesAndArrays.push(array); });
            for (const childName in node) {
                if (childName === "parent" || childName === "nextContainer" || childName === "modifiers" || childName === "externalModuleIndicator" ||
                    // for now ignore jsdoc comments
                    childName === "jsDocComment" || childName === "checkJsDirective") {
                    continue;
                }
                const child = node[childName];
                if (isNodeOrArray(child)) {
                    assert.isFalse(childNodesAndArrays.indexOf(child) < 0, "Missing child when forEach'ing over node: " + ts.SyntaxKind[node.kind] + "-" + childName);
                }
            }
        }
    }
    Utils.assertInvariants = assertInvariants;
    function isNodeOrArray(a) {
        return a !== undefined && typeof a.pos === "number";
    }
    function convertDiagnostics(diagnostics) {
        return diagnostics.map(convertDiagnostic);
    }
    Utils.convertDiagnostics = convertDiagnostics;
    function convertDiagnostic(diagnostic) {
        return {
            start: diagnostic.start,
            length: diagnostic.length,
            messageText: ts.flattenDiagnosticMessageText(diagnostic.messageText, Harness.IO.newLine()),
            category: ts.diagnosticCategoryName(diagnostic, /*lowerCase*/ false),
            code: diagnostic.code
        };
    }
    function sourceFileToJSON(file) {
        return JSON.stringify(file, (_, v) => isNodeOrArray(v) ? serializeNode(v) : v, "    ");
        function getKindName(k) {
            if (ts.isString(k)) {
                return k;
            }
            // For some markers in SyntaxKind, we should print its original syntax name instead of
            // the marker name in tests.
            if (k === ts.SyntaxKind.FirstJSDocNode ||
                k === ts.SyntaxKind.LastJSDocNode ||
                k === ts.SyntaxKind.FirstJSDocTagNode ||
                k === ts.SyntaxKind.LastJSDocTagNode) {
                for (const kindName in ts.SyntaxKind) {
                    if (ts.SyntaxKind[kindName] === k) {
                        return kindName;
                    }
                }
            }
            return ts.SyntaxKind[k];
        }
        function getFlagName(flags, f) {
            if (f === 0) {
                return 0;
            }
            let result = "";
            ts.forEach(Object.getOwnPropertyNames(flags), (v) => {
                if (isFinite(v)) {
                    v = +v;
                    if (f === +v) {
                        result = flags[v];
                        return true;
                    }
                    else if ((f & v) > 0) {
                        if (result.length) {
                            result += " | ";
                        }
                        result += flags[v];
                        return false;
                    }
                }
            });
            return result;
        }
        function getNodeFlagName(f) { return getFlagName(ts.NodeFlags, f); }
        function serializeNode(n) {
            const o = { kind: getKindName(n.kind) };
            if (ts.containsParseError(n)) {
                o.containsParseError = true;
            }
            ts.forEach(Object.getOwnPropertyNames(n), propertyName => {
                switch (propertyName) {
                    case "parent":
                    case "symbol":
                    case "locals":
                    case "localSymbol":
                    case "kind":
                    case "semanticDiagnostics":
                    case "id":
                    case "nodeCount":
                    case "symbolCount":
                    case "identifierCount":
                    case "scriptSnapshot":
                        // Blacklist of items we never put in the baseline file.
                        break;
                    case "originalKeywordKind":
                        o[propertyName] = getKindName(n[propertyName]);
                        break;
                    case "flags":
                        // Clear the flags that are produced by aggregating child values. That is ephemeral
                        // data we don't care about in the dump. We only care what the parser set directly
                        // on the AST.
                        const flags = n.flags & ~(ts.NodeFlags.JavaScriptFile | ts.NodeFlags.HasAggregatedChildData);
                        if (flags) {
                            o[propertyName] = getNodeFlagName(flags);
                        }
                        break;
                    case "referenceDiagnostics":
                    case "parseDiagnostics":
                        o[propertyName] = convertDiagnostics(n[propertyName]);
                        break;
                    case "nextContainer":
                        if (n.nextContainer) {
                            o[propertyName] = { kind: n.nextContainer.kind, pos: n.nextContainer.pos, end: n.nextContainer.end };
                        }
                        break;
                    case "text":
                        // Include 'text' field for identifiers/literals, but not for source files.
                        if (n.kind !== ts.SyntaxKind.SourceFile) {
                            o[propertyName] = n[propertyName];
                        }
                        break;
                    default:
                        o[propertyName] = n[propertyName];
                }
                return undefined;
            });
            return o;
        }
    }
    Utils.sourceFileToJSON = sourceFileToJSON;
    function assertDiagnosticsEquals(array1, array2) {
        if (array1 === array2) {
            return;
        }
        assert(array1, "array1");
        assert(array2, "array2");
        assert.equal(array1.length, array2.length, "array1.length !== array2.length");
        for (let i = 0; i < array1.length; i++) {
            const d1 = array1[i];
            const d2 = array2[i];
            assert.equal(d1.start, d2.start, "d1.start !== d2.start");
            assert.equal(d1.length, d2.length, "d1.length !== d2.length");
            assert.equal(ts.flattenDiagnosticMessageText(d1.messageText, Harness.IO.newLine()), ts.flattenDiagnosticMessageText(d2.messageText, Harness.IO.newLine()), "d1.messageText !== d2.messageText");
            assert.equal(d1.category, d2.category, "d1.category !== d2.category");
            assert.equal(d1.code, d2.code, "d1.code !== d2.code");
        }
    }
    Utils.assertDiagnosticsEquals = assertDiagnosticsEquals;
    function assertStructuralEquals(node1, node2) {
        if (node1 === node2) {
            return;
        }
        assert(node1, "node1");
        assert(node2, "node2");
        assert.equal(node1.pos, node2.pos, "node1.pos !== node2.pos");
        assert.equal(node1.end, node2.end, "node1.end !== node2.end");
        assert.equal(node1.kind, node2.kind, "node1.kind !== node2.kind");
        // call this on both nodes to ensure all propagated flags have been set (and thus can be
        // compared).
        assert.equal(ts.containsParseError(node1), ts.containsParseError(node2));
        assert.equal(node1.flags & ~ts.NodeFlags.ReachabilityAndEmitFlags, node2.flags & ~ts.NodeFlags.ReachabilityAndEmitFlags, "node1.flags !== node2.flags");
        ts.forEachChild(node1, child1 => {
            const childName = findChildName(node1, child1);
            const child2 = node2[childName];
            assertStructuralEquals(child1, child2);
        }, array1 => {
            const childName = findChildName(node1, array1);
            const array2 = node2[childName];
            assertArrayStructuralEquals(array1, array2);
        });
    }
    Utils.assertStructuralEquals = assertStructuralEquals;
    function assertArrayStructuralEquals(array1, array2) {
        if (array1 === array2) {
            return;
        }
        assert(array1, "array1");
        assert(array2, "array2");
        assert.equal(array1.pos, array2.pos, "array1.pos !== array2.pos");
        assert.equal(array1.end, array2.end, "array1.end !== array2.end");
        assert.equal(array1.length, array2.length, "array1.length !== array2.length");
        for (let i = 0; i < array1.length; i++) {
            assertStructuralEquals(array1[i], array2[i]);
        }
    }
    function findChildName(parent, child) {
        for (const name in parent) {
            if (parent.hasOwnProperty(name) && parent[name] === child) {
                return name;
            }
        }
        throw new Error("Could not find child in parent");
    }
    const maxHarnessFrames = 1;
    function filterStack(error, stackTraceLimit = Infinity) {
        const stack = error.stack;
        if (stack) {
            const lines = stack.split(/\r\n?|\n/g);
            const filtered = [];
            let frameCount = 0;
            let harnessFrameCount = 0;
            for (let line of lines) {
                if (isStackFrame(line)) {
                    if (frameCount >= stackTraceLimit
                        || isMocha(line)
                        || isNode(line)) {
                        continue;
                    }
                    if (isHarness(line)) {
                        if (harnessFrameCount >= maxHarnessFrames) {
                            continue;
                        }
                        harnessFrameCount++;
                    }
                    line = line.replace(/\bfile:\/\/\/(.*?)(?=(:\d+)*($|\)))/, (_, path) => ts.sys.resolvePath(path));
                    frameCount++;
                }
                filtered.push(line);
            }
            error.stack = filtered.join(Harness.IO.newLine());
        }
        return error;
    }
    Utils.filterStack = filterStack;
    function isStackFrame(line) {
        return /^\s+at\s/.test(line);
    }
    function isMocha(line) {
        return /[\\/](node_modules|components)[\\/]mocha(js)?[\\/]|[\\/]mocha\.js/.test(line);
    }
    function isNode(line) {
        return /\((timers|events|node|module)\.js:/.test(line);
    }
    function isHarness(line) {
        return /[\\/]src[\\/]harness[\\/]|[\\/]run\.js/.test(line);
    }
})(Utils || (Utils = {}));
var Harness;
(function (Harness) {
    // harness always uses one kind of new line
    // But note that `parseTestData` in `fourslash.ts` uses "\n"
    Harness.harnessNewLine = "\r\n";
    // Root for file paths that are stored in a virtual file system
    Harness.virtualFileSystemRoot = "/";
    let IOImpl;
    (function (IOImpl) {
        let Node;
        (function (Node) {
            let fs, pathModule;
            if (require) {
                fs = require("fs");
                pathModule = require("path");
            }
            else {
                fs = pathModule = {};
            }
            Node.resolvePath = (path) => ts.sys.resolvePath(path);
            Node.getCurrentDirectory = () => ts.sys.getCurrentDirectory();
            Node.newLine = () => Harness.harnessNewLine;
            Node.useCaseSensitiveFileNames = () => ts.sys.useCaseSensitiveFileNames;
            Node.args = () => ts.sys.args;
            Node.getExecutingFilePath = () => ts.sys.getExecutingFilePath();
            Node.exit = (exitCode) => ts.sys.exit(exitCode);
            Node.getDirectories = path => ts.sys.getDirectories(path);
            Node.readFile = path => ts.sys.readFile(path);
            Node.writeFile = (path, content) => ts.sys.writeFile(path, content);
            Node.fileExists = fs.existsSync;
            Node.log = s => console.log(s);
            Node.getEnvironmentVariable = name => ts.sys.getEnvironmentVariable(name);
            function tryEnableSourceMapsForHost() {
                if (ts.sys.tryEnableSourceMapsForHost) {
                    ts.sys.tryEnableSourceMapsForHost();
                }
            }
            Node.tryEnableSourceMapsForHost = tryEnableSourceMapsForHost;
            Node.readDirectory = (path, extension, exclude, include, depth) => ts.sys.readDirectory(path, extension, exclude, include, depth);
            function createDirectory(path) {
                if (!directoryExists(path)) {
                    fs.mkdirSync(path);
                }
            }
            Node.createDirectory = createDirectory;
            function deleteFile(path) {
                try {
                    fs.unlinkSync(path);
                }
                catch ( /*ignore*/_b) { /*ignore*/ }
            }
            Node.deleteFile = deleteFile;
            function directoryExists(path) {
                return fs.existsSync(path) && fs.statSync(path).isDirectory();
            }
            Node.directoryExists = directoryExists;
            function directoryName(path) {
                const dirPath = pathModule.dirname(path);
                // Node will just continue to repeat the root path, rather than return null
                return dirPath === path ? undefined : dirPath;
            }
            Node.directoryName = directoryName;
            Node.listFiles = (path, spec, options) => {
                options = options || {};
                function filesInFolder(folder) {
                    let paths = [];
                    for (const file of fs.readdirSync(folder)) {
                        const pathToFile = pathModule.join(folder, file);
                        const stat = fs.statSync(pathToFile);
                        if (options.recursive && stat.isDirectory()) {
                            paths = paths.concat(filesInFolder(pathToFile));
                        }
                        else if (stat.isFile() && (!spec || file.match(spec))) {
                            paths.push(pathToFile);
                        }
                    }
                    return paths;
                }
                return filesInFolder(path);
            };
            Node.getMemoryUsage = () => {
                if (global.gc) {
                    global.gc();
                }
                return process.memoryUsage().heapUsed;
            };
        })(Node = IOImpl.Node || (IOImpl.Node = {}));
        let Network;
        (function (Network) {
            const serverRoot = "http://localhost:8888/";
            Network.newLine = () => Harness.harnessNewLine;
            Network.useCaseSensitiveFileNames = () => false;
            Network.getCurrentDirectory = () => "";
            Network.args = () => [];
            Network.getExecutingFilePath = () => "";
            Network.exit = ts.noop;
            Network.getDirectories = () => [];
            Network.log = (s) => console.log(s);
            let Http;
            (function (Http) {
                function waitForXHR(xhr) {
                    while (xhr.readyState !== 4) { } // tslint:disable-line no-empty
                    return { status: xhr.status, responseText: xhr.responseText };
                }
                /// Ask the server for the contents of the file at the given URL via a simple GET request
                function getFileFromServerSync(url) {
                    const xhr = new XMLHttpRequest();
                    try {
                        xhr.open("GET", url, /*async*/ false);
                        xhr.send();
                    }
                    catch (e) {
                        return { status: 404, responseText: undefined };
                    }
                    return waitForXHR(xhr);
                }
                Http.getFileFromServerSync = getFileFromServerSync;
                /// Submit a POST request to the server to do the given action (ex WRITE, DELETE) on the provided URL
                function writeToServerSync(url, action, contents) {
                    const xhr = new XMLHttpRequest();
                    try {
                        const actionMsg = "?action=" + action;
                        xhr.open("POST", url + actionMsg, /*async*/ false);
                        xhr.setRequestHeader("Access-Control-Allow-Origin", "*");
                        xhr.send(contents);
                    }
                    catch (e) {
                        Network.log(`XHR Error: ${e}`);
                        return { status: 500, responseText: undefined };
                    }
                    return waitForXHR(xhr);
                }
                Http.writeToServerSync = writeToServerSync;
            })(Http || (Http = {}));
            function createDirectory() {
                // Do nothing (?)
            }
            Network.createDirectory = createDirectory;
            function deleteFile(path) {
                Http.writeToServerSync(serverRoot + path, "DELETE");
            }
            Network.deleteFile = deleteFile;
            function directoryExists() {
                return false;
            }
            Network.directoryExists = directoryExists;
            function directoryNameImpl(path) {
                let dirPath = path;
                // root of the server
                if (dirPath.match(/localhost:\d+$/) || dirPath.match(/localhost:\d+\/$/)) {
                    dirPath = undefined;
                    // path + fileName
                }
                else if (dirPath.indexOf(".") === -1) {
                    dirPath = dirPath.substring(0, dirPath.lastIndexOf("/"));
                    // path
                }
                else {
                    // strip any trailing slash
                    if (dirPath.match(/.*\/$/)) {
                        dirPath = dirPath.substring(0, dirPath.length - 2);
                    }
                    dirPath = dirPath.substring(0, dirPath.lastIndexOf("/"));
                }
                return dirPath;
            }
            Network.directoryName = Utils.memoize(directoryNameImpl, path => path);
            function resolvePath(path) {
                const response = Http.getFileFromServerSync(serverRoot + path + "?resolve=true");
                if (response.status === 200) {
                    return response.responseText;
                }
                else {
                    return undefined;
                }
            }
            Network.resolvePath = resolvePath;
            function fileExists(path) {
                const response = Http.getFileFromServerSync(serverRoot + path);
                return response.status === 200;
            }
            Network.fileExists = fileExists;
            Network.listFiles = Utils.memoize((path, spec, options) => {
                const response = Http.getFileFromServerSync(serverRoot + path);
                if (response.status === 200) {
                    let results = response.responseText.split(",");
                    if (spec) {
                        results = results.filter(file => spec.test(file));
                    }
                    if (options && !options.recursive) {
                        results = results.filter(file => (ts.getDirectoryPath(ts.normalizeSlashes(file)) === path));
                    }
                    return results;
                }
                else {
                    return [""];
                }
            }, (path, spec, options) => `${path}|${spec}|${options ? options.recursive : undefined}`);
            function readFile(file) {
                const response = Http.getFileFromServerSync(serverRoot + file);
                if (response.status === 200) {
                    return response.responseText;
                }
                else {
                    return undefined;
                }
            }
            Network.readFile = readFile;
            function writeFile(path, contents) {
                Http.writeToServerSync(serverRoot + path, "WRITE", contents);
            }
            Network.writeFile = writeFile;
            function readDirectory(path, extension, exclude, include, depth) {
                const fs = new Utils.VirtualFileSystem(path, Network.useCaseSensitiveFileNames());
                for (const file of Network.listFiles(path)) {
                    fs.addFile(file);
                }
                return ts.matchFiles(path, extension, exclude, include, Network.useCaseSensitiveFileNames(), Network.getCurrentDirectory(), depth, path => {
                    const entry = fs.traversePath(path);
                    if (entry && entry.isDirectory()) {
                        return {
                            files: ts.map(entry.getFiles(), f => f.name),
                            directories: ts.map(entry.getDirectories(), d => d.name)
                        };
                    }
                    return { files: [], directories: [] };
                });
            }
            Network.readDirectory = readDirectory;
        })(Network = IOImpl.Network || (IOImpl.Network = {}));
    })(IOImpl || (IOImpl = {}));
    function mockHash(s) {
        return `hash-${s}`;
    }
    Harness.mockHash = mockHash;
    const environment = Utils.getExecutionEnvironment();
    switch (environment) {
        case 0 /* Node */:
            Harness.IO = IOImpl.Node;
            break;
        case 1 /* Browser */:
            Harness.IO = IOImpl.Network;
            break;
        default:
            throw new Error(`Unknown value '${environment}' for ExecutionEnvironment.`);
    }
})(Harness || (Harness = {}));
(function (Harness) {
    Harness.libFolder = "built/local/";
    const tcServicesFileName = ts.combinePaths(Harness.libFolder, Utils.getExecutionEnvironment() === 1 /* Browser */ ? "typescriptServicesInBrowserTest.js" : "typescriptServices.js");
    Harness.tcServicesFile = Harness.IO.readFile(tcServicesFileName) + (Utils.getExecutionEnvironment() !== 1 /* Browser */
        ? Harness.IO.newLine() + `//# sourceURL=${Harness.IO.resolvePath(tcServicesFileName)}`
        : "");
    // Settings
    Harness.userSpecifiedRoot = "";
    Harness.lightMode = false;
    /** Functionality for compiling TypeScript code */
    let Compiler;
    (function (Compiler) {
        /** Aggregate various writes into a single array of lines. Useful for passing to the
         *  TypeScript compiler to fill with source code or errors.
         */
        class WriterAggregator {
            constructor() {
                this.lines = [];
                this.currentLine = undefined;
            }
            Write(str) {
                // out of memory usage concerns avoid using + or += if we're going to do any manipulation of this string later
                this.currentLine = [(this.currentLine || ""), str].join("");
            }
            WriteLine(str) {
                // out of memory usage concerns avoid using + or += if we're going to do any manipulation of this string later
                this.lines.push([(this.currentLine || ""), str].join(""));
                this.currentLine = undefined;
            }
            Close() {
                if (this.currentLine !== undefined) {
                    this.lines.push(this.currentLine);
                }
                this.currentLine = undefined;
            }
            reset() {
                this.lines = [];
                this.currentLine = undefined;
            }
        }
        Compiler.WriterAggregator = WriterAggregator;
        function createSourceFileAndAssertInvariants(fileName, sourceText, languageVersion) {
            // We'll only assert invariants outside of light mode.
            const shouldAssertInvariants = !Harness.lightMode;
            // Only set the parent nodes if we're asserting invariants.  We don't need them otherwise.
            const result = ts.createSourceFile(fileName, sourceText, languageVersion, /*setParentNodes:*/ shouldAssertInvariants);
            if (shouldAssertInvariants) {
                Utils.assertInvariants(result, /*parent:*/ undefined);
            }
            return result;
        }
        Compiler.createSourceFileAndAssertInvariants = createSourceFileAndAssertInvariants;
        const carriageReturnLineFeed = "\r\n";
        const lineFeed = "\n";
        Compiler.defaultLibFileName = "lib.d.ts";
        Compiler.es2015DefaultLibFileName = "lib.es2015.d.ts";
        // Cache of lib files from "built/local"
        let libFileNameSourceFileMap;
        // Cache of lib files from "tests/lib/"
        const testLibFileNameSourceFileMap = ts.createMap();
        const es6TestLibFileNameSourceFileMap = ts.createMap();
        function getDefaultLibrarySourceFile(fileName = Compiler.defaultLibFileName) {
            if (!isDefaultLibraryFile(fileName)) {
                return undefined;
            }
            if (!libFileNameSourceFileMap) {
                libFileNameSourceFileMap = ts.createMapFromTemplate({
                    [Compiler.defaultLibFileName]: createSourceFileAndAssertInvariants(Compiler.defaultLibFileName, Harness.IO.readFile(Harness.libFolder + "lib.es5.d.ts"), /*languageVersion*/ ts.ScriptTarget.Latest)
                });
            }
            let sourceFile = libFileNameSourceFileMap.get(fileName);
            if (!sourceFile) {
                libFileNameSourceFileMap.set(fileName, sourceFile = createSourceFileAndAssertInvariants(fileName, Harness.IO.readFile(Harness.libFolder + fileName), ts.ScriptTarget.Latest));
            }
            return sourceFile;
        }
        Compiler.getDefaultLibrarySourceFile = getDefaultLibrarySourceFile;
        function getDefaultLibFileName(options) {
            switch (options.target) {
                case ts.ScriptTarget.ESNext:
                case ts.ScriptTarget.ES2017:
                    return "lib.es2017.d.ts";
                case ts.ScriptTarget.ES2016:
                    return "lib.es2016.d.ts";
                case ts.ScriptTarget.ES2015:
                    return Compiler.es2015DefaultLibFileName;
                default:
                    return Compiler.defaultLibFileName;
            }
        }
        Compiler.getDefaultLibFileName = getDefaultLibFileName;
        // Cache these between executions so we don't have to re-parse them for every test
        Compiler.fourslashFileName = "fourslash.ts";
        function getCanonicalFileName(fileName) {
            return fileName;
        }
        Compiler.getCanonicalFileName = getCanonicalFileName;
        function createCompilerHost(inputFiles, writeFile, scriptTarget, useCaseSensitiveFileNames, 
        // the currentDirectory is needed for rwcRunner to passed in specified current directory to compiler host
        currentDirectory, newLineKind, libFiles) {
            // Local get canonical file name function, that depends on passed in parameter for useCaseSensitiveFileNames
            const getCanonicalFileName = ts.createGetCanonicalFileName(useCaseSensitiveFileNames);
            /** Maps a symlink name to a realpath. Used only for exposing `realpath`. */
            const realPathMap = ts.createMap();
            /**
             * Maps a file name to a source file.
             * This will have a different SourceFile for every symlink pointing to that file;
             * if the program resolves realpaths then symlink entries will be ignored.
             */
            const fileMap = ts.createMap();
            for (const file of inputFiles) {
                if (file.content !== undefined) {
                    const fileName = ts.normalizePath(file.unitName);
                    const path = ts.toPath(file.unitName, currentDirectory, getCanonicalFileName);
                    if (file.fileOptions && file.fileOptions.symlink) {
                        const links = file.fileOptions.symlink.split(",");
                        for (const link of links) {
                            const linkPath = ts.toPath(link, currentDirectory, getCanonicalFileName);
                            realPathMap.set(linkPath, fileName);
                            // Create a different SourceFile for every symlink.
                            const sourceFile = createSourceFileAndAssertInvariants(linkPath, file.content, scriptTarget);
                            fileMap.set(linkPath, sourceFile);
                        }
                    }
                    const sourceFile = createSourceFileAndAssertInvariants(fileName, file.content, scriptTarget);
                    fileMap.set(path, sourceFile);
                }
            }
            if (libFiles) {
                // Because @libFiles don't change between execution. We would cache the result of the files and reuse it to speed help compilation
                for (const fileName of libFiles.split(",")) {
                    const libFileName = "tests/lib/" + fileName;
                    if (scriptTarget <= ts.ScriptTarget.ES5) {
                        if (!testLibFileNameSourceFileMap.get(libFileName)) {
                            testLibFileNameSourceFileMap.set(libFileName, createSourceFileAndAssertInvariants(libFileName, Harness.IO.readFile(libFileName), scriptTarget));
                        }
                    }
                    else {
                        if (!es6TestLibFileNameSourceFileMap.get(libFileName)) {
                            es6TestLibFileNameSourceFileMap.set(libFileName, createSourceFileAndAssertInvariants(libFileName, Harness.IO.readFile(libFileName), scriptTarget));
                        }
                    }
                }
            }
            function getSourceFile(fileName) {
                fileName = ts.normalizePath(fileName);
                const fromFileMap = fileMap.get(toPath(fileName));
                if (fromFileMap) {
                    return fromFileMap;
                }
                else if (fileName === Compiler.fourslashFileName) {
                    const tsFn = "tests/cases/fourslash/" + Compiler.fourslashFileName;
                    Compiler.fourslashSourceFile = Compiler.fourslashSourceFile || createSourceFileAndAssertInvariants(tsFn, Harness.IO.readFile(tsFn), scriptTarget);
                    return Compiler.fourslashSourceFile;
                }
                else if (ts.startsWith(fileName, "tests/lib/")) {
                    return scriptTarget <= ts.ScriptTarget.ES5 ? testLibFileNameSourceFileMap.get(fileName) : es6TestLibFileNameSourceFileMap.get(fileName);
                }
                else {
                    // Don't throw here -- the compiler might be looking for a test that actually doesn't exist as part of the TC
                    // Return if it is other library file, otherwise return undefined
                    return getDefaultLibrarySourceFile(fileName);
                }
            }
            const newLine = newLineKind === ts.NewLineKind.CarriageReturnLineFeed ? carriageReturnLineFeed :
                newLineKind === ts.NewLineKind.LineFeed ? lineFeed :
                    Harness.IO.newLine();
            function toPath(fileName) {
                return ts.toPath(fileName, currentDirectory, getCanonicalFileName);
            }
            return {
                getCurrentDirectory: () => currentDirectory,
                getSourceFile,
                getDefaultLibFileName,
                writeFile,
                getCanonicalFileName,
                useCaseSensitiveFileNames: () => useCaseSensitiveFileNames,
                getNewLine: () => newLine,
                fileExists: fileName => fileMap.has(toPath(fileName)),
                readFile(fileName) {
                    const file = fileMap.get(toPath(fileName));
                    if (ts.endsWith(fileName, "json")) {
                        // strip comments
                        return file.getText();
                    }
                    return file.text;
                },
                realpath: (fileName) => {
                    const path = toPath(fileName);
                    return realPathMap.get(path) || path;
                },
                directoryExists: dir => {
                    let path = ts.toPath(dir, currentDirectory, getCanonicalFileName);
                    // Strip trailing /, which may exist if the path is a drive root
                    if (path[path.length - 1] === "/") {
                        path = path.substr(0, path.length - 1);
                    }
                    return mapHasFileInDirectory(path, fileMap);
                },
                getDirectories: d => {
                    const path = ts.toPath(d, currentDirectory, getCanonicalFileName);
                    const result = [];
                    ts.forEachKey(fileMap, key => {
                        if (key.indexOf(path) === 0 && key.lastIndexOf("/") > path.length) {
                            let dirName = key.substr(path.length, key.indexOf("/", path.length + 1) - path.length);
                            if (dirName[0] === "/") {
                                dirName = dirName.substr(1);
                            }
                            if (result.indexOf(dirName) < 0) {
                                result.push(dirName);
                            }
                        }
                    });
                    return result;
                }
            };
        }
        Compiler.createCompilerHost = createCompilerHost;
        function mapHasFileInDirectory(directoryPath, map) {
            if (!map) {
                return false;
            }
            let exists = false;
            ts.forEachKey(map, fileName => {
                if (!exists && ts.startsWith(fileName, directoryPath) && fileName[directoryPath.length] === "/") {
                    exists = true;
                }
            });
            return exists;
        }
        // Additional options not already in ts.optionDeclarations
        const harnessOptionDeclarations = [
            { name: "allowNonTsExtensions", type: "boolean" },
            { name: "useCaseSensitiveFileNames", type: "boolean" },
            { name: "baselineFile", type: "string" },
            { name: "includeBuiltFile", type: "string" },
            { name: "fileName", type: "string" },
            { name: "libFiles", type: "string" },
            { name: "noErrorTruncation", type: "boolean" },
            { name: "suppressOutputPathCheck", type: "boolean" },
            { name: "noImplicitReferences", type: "boolean" },
            { name: "currentDirectory", type: "string" },
            { name: "symlink", type: "string" },
            // Emitted js baseline will print full paths for every output file
            { name: "fullEmitPaths", type: "boolean" }
        ];
        let optionsIndex;
        function getCommandLineOption(name) {
            if (!optionsIndex) {
                optionsIndex = ts.createMap();
                const optionDeclarations = harnessOptionDeclarations.concat(ts.optionDeclarations);
                for (const option of optionDeclarations) {
                    optionsIndex.set(option.name.toLowerCase(), option);
                }
            }
            return optionsIndex.get(name.toLowerCase());
        }
        function setCompilerOptionsFromHarnessSetting(settings, options) {
            for (const name in settings) {
                if (settings.hasOwnProperty(name)) {
                    const value = settings[name];
                    if (value === undefined) {
                        throw new Error(`Cannot have undefined value for compiler option '${name}'.`);
                    }
                    const option = getCommandLineOption(name);
                    if (option) {
                        const errors = [];
                        options[option.name] = optionValue(option, value, errors);
                        if (errors.length > 0) {
                            throw new Error(`Unknown value '${value}' for compiler option '${name}'.`);
                        }
                    }
                    else {
                        throw new Error(`Unknown compiler option '${name}'.`);
                    }
                }
            }
        }
        Compiler.setCompilerOptionsFromHarnessSetting = setCompilerOptionsFromHarnessSetting;
        function optionValue(option, value, errors) {
            switch (option.type) {
                case "boolean":
                    return value.toLowerCase() === "true";
                case "string":
                    return value;
                case "number": {
                    const numverValue = parseInt(value, 10);
                    if (isNaN(numverValue)) {
                        throw new Error(`Value must be a number, got: ${JSON.stringify(value)}`);
                    }
                    return numverValue;
                }
                // If not a primitive, the possible types are specified in what is effectively a map of options.
                case "list":
                    return ts.parseListTypeOption(option, value, errors);
                default:
                    return ts.parseCustomTypeOption(option, value, errors);
            }
        }
        function compileFiles(inputFiles, otherFiles, harnessSettings, compilerOptions, 
        // Current directory is needed for rwcRunner to be able to use currentDirectory defined in json file
        currentDirectory) {
            const options = compilerOptions ? ts.cloneCompilerOptions(compilerOptions) : { noResolve: false };
            options.target = options.target || ts.ScriptTarget.ES3;
            options.newLine = options.newLine || ts.NewLineKind.CarriageReturnLineFeed;
            options.noErrorTruncation = true;
            options.skipDefaultLibCheck = typeof options.skipDefaultLibCheck === "undefined" ? true : options.skipDefaultLibCheck;
            if (typeof currentDirectory === "undefined") {
                currentDirectory = Harness.IO.getCurrentDirectory();
            }
            // Parse settings
            if (harnessSettings) {
                setCompilerOptionsFromHarnessSetting(harnessSettings, options);
            }
            if (options.rootDirs) {
                options.rootDirs = ts.map(options.rootDirs, d => ts.getNormalizedAbsolutePath(d, currentDirectory));
            }
            const useCaseSensitiveFileNames = options.useCaseSensitiveFileNames !== undefined ? options.useCaseSensitiveFileNames : Harness.IO.useCaseSensitiveFileNames();
            const programFiles = inputFiles.slice();
            // Files from built\local that are requested by test "@includeBuiltFiles" to be in the context.
            // Treat them as library files, so include them in build, but not in baselines.
            if (options.includeBuiltFile) {
                const builtFileName = ts.combinePaths(Harness.libFolder, options.includeBuiltFile);
                const builtFile = {
                    unitName: builtFileName,
                    content: normalizeLineEndings(Harness.IO.readFile(builtFileName), Harness.IO.newLine()),
                };
                programFiles.push(builtFile);
            }
            const fileOutputs = [];
            // Files from tests\lib that are requested by "@libFiles"
            if (options.libFiles) {
                for (const fileName of options.libFiles.split(",")) {
                    const libFileName = "tests/lib/" + fileName;
                    // Content is undefined here because in createCompilerHost we will create sourceFile for the lib file and cache the result
                    programFiles.push({ unitName: libFileName, content: undefined });
                }
            }
            const programFileNames = programFiles.map(file => file.unitName);
            const compilerHost = createCompilerHost(programFiles.concat(otherFiles), (fileName, code, writeByteOrderMark) => fileOutputs.push({ fileName, code, writeByteOrderMark }), options.target, useCaseSensitiveFileNames, currentDirectory, options.newLine, options.libFiles);
            let traceResults;
            if (options.traceResolution) {
                traceResults = [];
                compilerHost.trace = text => traceResults.push(text);
            }
            else {
                compilerHost.directoryExists = () => true; // This only visibly affects resolution traces, so to save time we always return true where possible
            }
            const program = ts.createProgram(programFileNames, options, compilerHost);
            const emitResult = program.emit();
            const errors = ts.getPreEmitDiagnostics(program);
            const result = new CompilerResult(fileOutputs, errors, program, Harness.IO.getCurrentDirectory(), emitResult.sourceMaps, traceResults);
            return { result, options };
        }
        Compiler.compileFiles = compileFiles;
        function prepareDeclarationCompilationContext(inputFiles, otherFiles, result, harnessSettings, options, 
        // Current directory is needed for rwcRunner to be able to use currentDirectory defined in json file
        currentDirectory) {
            if (result.errors.length === 0) {
                if (options.declaration) {
                    if (options.emitDeclarationOnly) {
                        if (result.files.length > 0 || result.declFilesCode.length === 0) {
                            throw new Error("Only declaration files should be generated when emitDeclarationOnly:true");
                        }
                    }
                    else if (result.declFilesCode.length !== result.files.length) {
                        throw new Error("There were no errors and declFiles generated did not match number of js files generated");
                    }
                }
            }
            const declInputFiles = [];
            const declOtherFiles = [];
            // if the .d.ts is non-empty, confirm it compiles correctly as well
            if (options.declaration && result.errors.length === 0 && result.declFilesCode.length > 0) {
                ts.forEach(inputFiles, file => addDtsFile(file, declInputFiles));
                ts.forEach(otherFiles, file => addDtsFile(file, declOtherFiles));
                return { declInputFiles, declOtherFiles, harnessSettings, options, currentDirectory: currentDirectory || harnessSettings.currentDirectory };
            }
            function addDtsFile(file, dtsFiles) {
                if (isDTS(file.unitName)) {
                    dtsFiles.push(file);
                }
                else if (isTS(file.unitName)) {
                    const declFile = findResultCodeFile(file.unitName);
                    if (declFile && !findUnit(declFile.fileName, declInputFiles) && !findUnit(declFile.fileName, declOtherFiles)) {
                        dtsFiles.push({ unitName: declFile.fileName, content: declFile.code });
                    }
                }
            }
            function findResultCodeFile(fileName) {
                const sourceFile = result.program.getSourceFile(fileName);
                assert(sourceFile, "Program has no source file with name '" + fileName + "'");
                // Is this file going to be emitted separately
                let sourceFileName;
                const outFile = options.outFile || options.out;
                if (!outFile) {
                    if (options.outDir) {
                        let sourceFilePath = ts.getNormalizedAbsolutePath(sourceFile.fileName, result.currentDirectoryForProgram);
                        sourceFilePath = sourceFilePath.replace(result.program.getCommonSourceDirectory(), "");
                        sourceFileName = ts.combinePaths(options.outDir, sourceFilePath);
                    }
                    else {
                        sourceFileName = sourceFile.fileName;
                    }
                }
                else {
                    // Goes to single --out file
                    sourceFileName = outFile;
                }
                const dTsFileName = ts.removeFileExtension(sourceFileName) + ts.Extension.Dts;
                return ts.forEach(result.declFilesCode, declFile => declFile.fileName === dTsFileName ? declFile : undefined);
            }
            function findUnit(fileName, units) {
                return ts.forEach(units, unit => unit.unitName === fileName ? unit : undefined);
            }
        }
        Compiler.prepareDeclarationCompilationContext = prepareDeclarationCompilationContext;
        function compileDeclarationFiles(context) {
            if (!context) {
                return;
            }
            const { declInputFiles, declOtherFiles, harnessSettings, options, currentDirectory } = context;
            const output = compileFiles(declInputFiles, declOtherFiles, harnessSettings, options, currentDirectory);
            return { declInputFiles, declOtherFiles, declResult: output.result };
        }
        Compiler.compileDeclarationFiles = compileDeclarationFiles;
        function normalizeLineEndings(text, lineEnding) {
            let normalized = text.replace(/\r\n?/g, "\n");
            if (lineEnding !== "\n") {
                normalized = normalized.replace(/\n/g, lineEnding);
            }
            return normalized;
        }
        function minimalDiagnosticsToString(diagnostics, pretty) {
            const host = { getCanonicalFileName, getCurrentDirectory: () => "", getNewLine: () => Harness.IO.newLine() };
            return (pretty ? ts.formatDiagnosticsWithColorAndContext : ts.formatDiagnostics)(diagnostics, host);
        }
        Compiler.minimalDiagnosticsToString = minimalDiagnosticsToString;
        function getErrorBaseline(inputFiles, diagnostics, pretty) {
            let outputLines = "";
            const gen = iterateErrorBaseline(inputFiles, diagnostics, pretty);
            for (let { done, value } = gen.next(); !done; { done, value } = gen.next()) {
                const [, content] = value;
                outputLines += content;
            }
            return outputLines;
        }
        Compiler.getErrorBaseline = getErrorBaseline;
        Compiler.diagnosticSummaryMarker = "__diagnosticSummary";
        Compiler.globalErrorsMarker = "__globalErrors";
        function* iterateErrorBaseline(inputFiles, diagnostics, pretty) {
            diagnostics = ts.sort(diagnostics, ts.compareDiagnostics);
            let outputLines = "";
            // Count up all errors that were found in files other than lib.d.ts so we don't miss any
            let totalErrorsReportedInNonLibraryFiles = 0;
            let errorsReported = 0;
            let firstLine = true;
            function newLine() {
                if (firstLine) {
                    firstLine = false;
                    return "";
                }
                return "\r\n";
            }
            function outputErrorText(error) {
                const message = ts.flattenDiagnosticMessageText(error.messageText, Harness.IO.newLine());
                const errLines = RunnerBase.removeFullPaths(message)
                    .split("\n")
                    .map(s => s.length > 0 && s.charAt(s.length - 1) === "\r" ? s.substr(0, s.length - 1) : s)
                    .filter(s => s.length > 0)
                    .map(s => "!!! " + ts.diagnosticCategoryName(error) + " TS" + error.code + ": " + s);
                errLines.forEach(e => outputLines += (newLine() + e));
                errorsReported++;
                // do not count errors from lib.d.ts here, they are computed separately as numLibraryDiagnostics
                // if lib.d.ts is explicitly included in input files and there are some errors in it (i.e. because of duplicate identifiers)
                // then they will be added twice thus triggering 'total errors' assertion with condition
                // 'totalErrorsReportedInNonLibraryFiles + numLibraryDiagnostics + numTest262HarnessDiagnostics, diagnostics.length
                if (!error.file || !isDefaultLibraryFile(error.file.fileName)) {
                    totalErrorsReportedInNonLibraryFiles++;
                }
            }
            yield [Compiler.diagnosticSummaryMarker, minimalDiagnosticsToString(diagnostics, pretty) + Harness.IO.newLine() + Harness.IO.newLine(), diagnostics.length];
            // Report global errors
            const globalErrors = diagnostics.filter(err => !err.file);
            globalErrors.forEach(outputErrorText);
            yield [Compiler.globalErrorsMarker, outputLines, errorsReported];
            outputLines = "";
            errorsReported = 0;
            // 'merge' the lines of each input file with any errors associated with it
            const dupeCase = ts.createMap();
            for (const inputFile of inputFiles.filter(f => f.content !== undefined)) {
                // Filter down to the errors in the file
                const fileErrors = diagnostics.filter(e => {
                    const errFn = e.file;
                    return errFn && errFn.fileName === inputFile.unitName;
                });
                // Header
                outputLines += (newLine() + "==== " + inputFile.unitName + " (" + fileErrors.length + " errors) ====");
                // Make sure we emit something for every error
                let markedErrorCount = 0;
                // For each line, emit the line followed by any error squiggles matching this line
                // Note: IE JS engine incorrectly handles consecutive delimiters here when using RegExp split, so
                // we have to string-based splitting instead and try to figure out the delimiting chars
                const lineStarts = ts.computeLineStarts(inputFile.content);
                let lines = inputFile.content.split("\n");
                if (lines.length === 1) {
                    lines = lines[0].split("\r");
                }
                lines.forEach((line, lineIndex) => {
                    if (line.length > 0 && line.charAt(line.length - 1) === "\r") {
                        line = line.substr(0, line.length - 1);
                    }
                    const thisLineStart = lineStarts[lineIndex];
                    let nextLineStart;
                    // On the last line of the file, fake the next line start number so that we handle errors on the last character of the file correctly
                    if (lineIndex === lines.length - 1) {
                        nextLineStart = inputFile.content.length;
                    }
                    else {
                        nextLineStart = lineStarts[lineIndex + 1];
                    }
                    // Emit this line from the original file
                    outputLines += (newLine() + "    " + line);
                    fileErrors.forEach(err => {
                        // Does any error start or continue on to this line? Emit squiggles
                        const end = ts.textSpanEnd(err);
                        if ((end >= thisLineStart) && ((err.start < nextLineStart) || (lineIndex === lines.length - 1))) {
                            // How many characters from the start of this line the error starts at (could be positive or negative)
                            const relativeOffset = err.start - thisLineStart;
                            // How many characters of the error are on this line (might be longer than this line in reality)
                            const length = (end - err.start) - Math.max(0, thisLineStart - err.start);
                            // Calculate the start of the squiggle
                            const squiggleStart = Math.max(0, relativeOffset);
                            // TODO/REVIEW: this doesn't work quite right in the browser if a multi file test has files whose names are just the right length relative to one another
                            outputLines += (newLine() + "    " + line.substr(0, squiggleStart).replace(/[^\s]/g, " ") + new Array(Math.min(length, line.length - squiggleStart) + 1).join("~"));
                            // If the error ended here, or we're at the end of the file, emit its message
                            if ((lineIndex === lines.length - 1) || nextLineStart > end) {
                                // Just like above, we need to do a split on a string instead of on a regex
                                // because the JS engine does regexes wrong
                                outputErrorText(err);
                                markedErrorCount++;
                            }
                        }
                    });
                });
                // Verify we didn't miss any errors in this file
                assert.equal(markedErrorCount, fileErrors.length, "count of errors in " + inputFile.unitName);
                yield [checkDuplicatedFileName(inputFile.unitName, dupeCase), outputLines, errorsReported];
                outputLines = "";
                errorsReported = 0;
            }
            const numLibraryDiagnostics = ts.countWhere(diagnostics, diagnostic => {
                return diagnostic.file && (isDefaultLibraryFile(diagnostic.file.fileName) || isBuiltFile(diagnostic.file.fileName));
            });
            const numTest262HarnessDiagnostics = ts.countWhere(diagnostics, diagnostic => {
                // Count an error generated from tests262-harness folder.This should only apply for test262
                return diagnostic.file && diagnostic.file.fileName.indexOf("test262-harness") >= 0;
            });
            // Verify we didn't miss any errors in total
            assert.equal(totalErrorsReportedInNonLibraryFiles + numLibraryDiagnostics + numTest262HarnessDiagnostics, diagnostics.length, "total number of errors");
        }
        Compiler.iterateErrorBaseline = iterateErrorBaseline;
        function doErrorBaseline(baselinePath, inputFiles, errors, pretty) {
            Baseline.runBaseline(baselinePath.replace(/\.tsx?$/, ".errors.txt"), () => {
                if (!errors || (errors.length === 0)) {
                    /* tslint:disable:no-null-keyword */
                    return null;
                    /* tslint:enable:no-null-keyword */
                }
                return getErrorBaseline(inputFiles, errors, pretty);
            });
        }
        Compiler.doErrorBaseline = doErrorBaseline;
        function doTypeAndSymbolBaseline(baselinePath, program, allFiles, opts, multifile, skipTypeBaselines, skipSymbolBaselines) {
            // The full walker simulates the types that you would get from doing a full
            // compile.  The pull walker simulates the types you get when you just do
            // a type query for a random node (like how the LS would do it).  Most of the
            // time, these will be the same.  However, occasionally, they can be different.
            // Specifically, when the compiler internally depends on symbol IDs to order
            // things, then we may see different results because symbols can be created in a
            // different order with 'pull' operations, and thus can produce slightly differing
            // output.
            //
            // For example, with a full type check, we may see a type displayed as: number | string
            // But with a pull type check, we may see it as:                        string | number
            //
            // These types are equivalent, but depend on what order the compiler observed
            // certain parts of the program.
            const fullWalker = new TypeWriterWalker(program, /*fullTypeCheck*/ true);
            // Produce baselines.  The first gives the types for all expressions.
            // The second gives symbols for all identifiers.
            let typesError, symbolsError;
            try {
                checkBaseLines(/*isSymbolBaseLine*/ false);
            }
            catch (e) {
                typesError = e;
            }
            try {
                checkBaseLines(/*isSymbolBaseLine*/ true);
            }
            catch (e) {
                symbolsError = e;
            }
            if (typesError && symbolsError) {
                throw new Error(typesError.stack + Harness.IO.newLine() + symbolsError.stack);
            }
            if (typesError) {
                throw typesError;
            }
            if (symbolsError) {
                throw symbolsError;
            }
            return;
            function checkBaseLines(isSymbolBaseLine) {
                const fullExtension = isSymbolBaseLine ? ".symbols" : ".types";
                // When calling this function from rwc-runner, the baselinePath will have no extension.
                // As rwc test- file is stored in json which ".json" will get stripped off.
                // When calling this function from compiler-runner, the baselinePath will then has either ".ts" or ".tsx" extension
                const outputFileName = ts.endsWith(baselinePath, ts.Extension.Ts) || ts.endsWith(baselinePath, ts.Extension.Tsx) ?
                    baselinePath.replace(/\.tsx?/, "") : baselinePath;
                if (!multifile) {
                    const fullBaseLine = generateBaseLine(isSymbolBaseLine, isSymbolBaseLine ? skipSymbolBaselines : skipTypeBaselines);
                    Baseline.runBaseline(outputFileName + fullExtension, () => fullBaseLine, opts);
                }
                else {
                    Baseline.runMultifileBaseline(outputFileName, fullExtension, () => {
                        return iterateBaseLine(isSymbolBaseLine, isSymbolBaseLine ? skipSymbolBaselines : skipTypeBaselines);
                    }, opts);
                }
            }
            function generateBaseLine(isSymbolBaseline, skipBaseline) {
                let result = "";
                const gen = iterateBaseLine(isSymbolBaseline, skipBaseline);
                for (let { done, value } = gen.next(); !done; { done, value } = gen.next()) {
                    const [, content] = value;
                    result += content;
                }
                /* tslint:disable:no-null-keyword */
                return result || null;
                /* tslint:enable:no-null-keyword */
            }
            function* iterateBaseLine(isSymbolBaseline, skipBaseline) {
                if (skipBaseline) {
                    return;
                }
                const dupeCase = ts.createMap();
                for (const file of allFiles) {
                    const { unitName } = file;
                    let typeLines = "=== " + unitName + " ===\r\n";
                    const codeLines = ts.flatMap(file.content.split(/\r?\n/g), e => e.split(/[\r\u2028\u2029]/g));
                    const gen = isSymbolBaseline ? fullWalker.getSymbols(unitName) : fullWalker.getTypes(unitName);
                    let lastIndexWritten;
                    for (let { done, value: result } = gen.next(); !done; { done, value: result } = gen.next()) {
                        if (isSymbolBaseline && !result.symbol) {
                            return;
                        }
                        if (lastIndexWritten === undefined) {
                            typeLines += codeLines.slice(0, result.line + 1).join("\r\n") + "\r\n";
                        }
                        else if (result.line !== lastIndexWritten) {
                            if (!((lastIndexWritten + 1 < codeLines.length) && (codeLines[lastIndexWritten + 1].match(/^\s*[{|}]\s*$/) || codeLines[lastIndexWritten + 1].trim() === ""))) {
                                typeLines += "\r\n";
                            }
                            typeLines += codeLines.slice(lastIndexWritten + 1, result.line + 1).join("\r\n") + "\r\n";
                        }
                        lastIndexWritten = result.line;
                        const typeOrSymbolString = isSymbolBaseline ? result.symbol : result.type;
                        const formattedLine = result.sourceText.replace(/\r?\n/g, "") + " : " + typeOrSymbolString;
                        typeLines += ">" + formattedLine + "\r\n";
                    }
                    // Preserve legacy behavior
                    if (lastIndexWritten === undefined) {
                        for (const codeLine of codeLines) {
                            typeLines += codeLine + "\r\nNo type information for this code.";
                        }
                    }
                    else {
                        if (lastIndexWritten + 1 < codeLines.length) {
                            if (!((lastIndexWritten + 1 < codeLines.length) && (codeLines[lastIndexWritten + 1].match(/^\s*[{|}]\s*$/) || codeLines[lastIndexWritten + 1].trim() === ""))) {
                                typeLines += "\r\n";
                            }
                            typeLines += codeLines.slice(lastIndexWritten + 1).join("\r\n");
                        }
                        typeLines += "\r\n";
                    }
                    yield [checkDuplicatedFileName(unitName, dupeCase), typeLines];
                }
            }
        }
        Compiler.doTypeAndSymbolBaseline = doTypeAndSymbolBaseline;
        function getByteOrderMarkText(file) {
            return file.writeByteOrderMark ? "\u00EF\u00BB\u00BF" : "";
        }
        function doSourcemapBaseline(baselinePath, options, result, harnessSettings) {
            const declMaps = ts.getAreDeclarationMapsEnabled(options);
            if (options.inlineSourceMap) {
                if (result.sourceMaps.length > 0 && !declMaps) {
                    throw new Error("No sourcemap files should be generated if inlineSourceMaps was set.");
                }
                return;
            }
            else if (options.sourceMap || declMaps) {
                if (result.sourceMaps.length !== (result.files.length * (declMaps && options.sourceMap ? 2 : 1))) {
                    throw new Error("Number of sourcemap files should be same as js files.");
                }
                Baseline.runBaseline(baselinePath.replace(/\.tsx?/, ".js.map"), () => {
                    if ((options.noEmitOnError && result.errors.length !== 0) || result.sourceMaps.length === 0) {
                        // We need to return null here or the runBaseLine will actually create a empty file.
                        // Baselining isn't required here because there is no output.
                        /* tslint:disable:no-null-keyword */
                        return null;
                        /* tslint:enable:no-null-keyword */
                    }
                    let sourceMapCode = "";
                    for (const sourceMap of result.sourceMaps) {
                        sourceMapCode += fileOutput(sourceMap, harnessSettings);
                    }
                    return sourceMapCode;
                });
            }
        }
        Compiler.doSourcemapBaseline = doSourcemapBaseline;
        function doJsEmitBaseline(baselinePath, header, options, result, tsConfigFiles, toBeCompiled, otherFiles, harnessSettings) {
            if (!options.noEmit && !options.emitDeclarationOnly && result.files.length === 0 && result.errors.length === 0) {
                throw new Error("Expected at least one js file to be emitted or at least one error to be created.");
            }
            // check js output
            Baseline.runBaseline(baselinePath.replace(/\.tsx?/, ts.Extension.Js), () => {
                let tsCode = "";
                const tsSources = otherFiles.concat(toBeCompiled);
                if (tsSources.length > 1) {
                    tsCode += "//// [" + header + "] ////\r\n\r\n";
                }
                for (let i = 0; i < tsSources.length; i++) {
                    tsCode += "//// [" + ts.getBaseFileName(tsSources[i].unitName) + "]\r\n";
                    tsCode += tsSources[i].content + (i < (tsSources.length - 1) ? "\r\n" : "");
                }
                let jsCode = "";
                for (const file of result.files) {
                    jsCode += fileOutput(file, harnessSettings);
                }
                if (result.declFilesCode.length > 0) {
                    jsCode += "\r\n\r\n";
                    for (const declFile of result.declFilesCode) {
                        jsCode += fileOutput(declFile, harnessSettings);
                    }
                }
                const declFileContext = prepareDeclarationCompilationContext(toBeCompiled, otherFiles, result, harnessSettings, options, /*currentDirectory*/ undefined);
                const declFileCompilationResult = compileDeclarationFiles(declFileContext);
                if (declFileCompilationResult && declFileCompilationResult.declResult.errors.length) {
                    jsCode += "\r\n\r\n//// [DtsFileErrors]\r\n";
                    jsCode += "\r\n\r\n";
                    jsCode += getErrorBaseline(tsConfigFiles.concat(declFileCompilationResult.declInputFiles, declFileCompilationResult.declOtherFiles), declFileCompilationResult.declResult.errors);
                }
                if (jsCode.length > 0) {
                    return tsCode + "\r\n\r\n" + jsCode;
                }
                else {
                    /* tslint:disable:no-null-keyword */
                    return null;
                    /* tslint:enable:no-null-keyword */
                }
            });
        }
        Compiler.doJsEmitBaseline = doJsEmitBaseline;
        function fileOutput(file, harnessSettings) {
            const fileName = harnessSettings.fullEmitPaths ? file.fileName : ts.getBaseFileName(file.fileName);
            return "//// [" + fileName + "]\r\n" + getByteOrderMarkText(file) + file.code;
        }
        function collateOutputs(outputFiles) {
            const gen = iterateOutputs(outputFiles);
            // Emit them
            let result = "";
            for (let { done, value } = gen.next(); !done; { done, value } = gen.next()) {
                // Some extra spacing if this isn't the first file
                if (result.length) {
                    result += "\r\n\r\n";
                }
                // FileName header + content
                const [, content] = value;
                result += content;
            }
            return result;
        }
        Compiler.collateOutputs = collateOutputs;
        function* iterateOutputs(outputFiles) {
            // Collect, test, and sort the fileNames
            outputFiles.sort((a, b) => ts.compareStringsCaseSensitive(cleanName(a.fileName), cleanName(b.fileName)));
            const dupeCase = ts.createMap();
            // Yield them
            for (const outputFile of outputFiles) {
                yield [checkDuplicatedFileName(outputFile.fileName, dupeCase), "/*====== " + outputFile.fileName + " ======*/\r\n" + outputFile.code];
            }
            function cleanName(fn) {
                const lastSlash = ts.normalizeSlashes(fn).lastIndexOf("/");
                return fn.substr(lastSlash + 1).toLowerCase();
            }
        }
        Compiler.iterateOutputs = iterateOutputs;
        function checkDuplicatedFileName(resultName, dupeCase) {
            resultName = sanitizeTestFilePath(resultName);
            if (dupeCase.has(resultName)) {
                // A different baseline filename should be manufactured if the names differ only in case, for windows compat
                const count = 1 + dupeCase.get(resultName);
                dupeCase.set(resultName, count);
                resultName = `${resultName}.dupe${count}`;
            }
            else {
                dupeCase.set(resultName, 0);
            }
            return resultName;
        }
        function sanitizeTestFilePath(name) {
            const path = ts.toPath(ts.normalizeSlashes(name.replace(/[\^<>:"|?*%]/g, "_")).replace(/\.\.\//g, "__dotdot/"), "", Utils.canonicalizeForHarness);
            if (ts.startsWith(path, "/")) {
                return path.substring(1);
            }
            return path;
        }
        Compiler.sanitizeTestFilePath = sanitizeTestFilePath;
        // This does not need to exist strictly speaking, but many tests will need to be updated if it's removed
        function compileString(_code, _unitName, _callback) {
            // NEWTODO: Re-implement 'compileString'
            return ts.notImplemented();
        }
        Compiler.compileString = compileString;
        function isTS(fileName) {
            return ts.endsWith(fileName, ts.Extension.Ts);
        }
        Compiler.isTS = isTS;
        function isTSX(fileName) {
            return ts.endsWith(fileName, ts.Extension.Tsx);
        }
        Compiler.isTSX = isTSX;
        function isDTS(fileName) {
            return ts.endsWith(fileName, ts.Extension.Dts);
        }
        Compiler.isDTS = isDTS;
        function isJS(fileName) {
            return ts.endsWith(fileName, ts.Extension.Js);
        }
        Compiler.isJS = isJS;
        function isJSX(fileName) {
            return ts.endsWith(fileName, ts.Extension.Jsx);
        }
        Compiler.isJSX = isJSX;
        function isJSMap(fileName) {
            return ts.endsWith(fileName, ".js.map") || ts.endsWith(fileName, ".jsx.map");
        }
        Compiler.isJSMap = isJSMap;
        function isDTSMap(fileName) {
            return ts.endsWith(fileName, ".d.ts.map");
        }
        Compiler.isDTSMap = isDTSMap;
        /** Contains the code and errors of a compilation and some helper methods to check its status. */
        class CompilerResult {
            /** @param fileResults an array of strings for the fileName and an ITextWriter with its code */
            constructor(fileResults, errors, program, currentDirectoryForProgram, sourceMapData, traceResults) {
                this.program = program;
                this.currentDirectoryForProgram = currentDirectoryForProgram;
                this.sourceMapData = sourceMapData;
                this.traceResults = traceResults;
                this.files = [];
                this.errors = [];
                this.declFilesCode = [];
                this.sourceMaps = [];
                for (const emittedFile of fileResults) {
                    if (isDTS(emittedFile.fileName)) {
                        // .d.ts file, add to declFiles emit
                        this.declFilesCode.push(emittedFile);
                    }
                    else if (isJS(emittedFile.fileName) || isJSX(emittedFile.fileName)) {
                        // .js file, add to files
                        this.files.push(emittedFile);
                    }
                    else if (isJSMap(emittedFile.fileName) || isDTSMap(emittedFile.fileName)) {
                        this.sourceMaps.push(emittedFile);
                    }
                    else {
                        throw new Error("Unrecognized file extension for file " + emittedFile.fileName);
                    }
                }
                this.errors = errors;
            }
            getSourceMapRecord() {
                if (this.sourceMapData && this.sourceMapData.length > 0) {
                    return Harness.SourceMapRecorder.getSourceMapRecord(this.sourceMapData, this.program, this.files, this.declFilesCode);
                }
            }
        }
        Compiler.CompilerResult = CompilerResult;
    })(Compiler = Harness.Compiler || (Harness.Compiler = {}));
    let TestCaseParser;
    (function (TestCaseParser) {
        // Regex for parsing options in the format "@Alpha: Value of any sort"
        const optionRegex = /^[\/]{2}\s*@(\w+)\s*:\s*([^\r\n]*)/gm; // multiple matches on multiple lines
        function extractCompilerSettings(content) {
            const opts = {};
            let match;
            /* tslint:disable:no-null-keyword */
            while ((match = optionRegex.exec(content)) !== null) {
                /* tslint:enable:no-null-keyword */
                opts[match[1]] = match[2].trim();
            }
            return opts;
        }
        /** Given a test file containing // @FileName directives, return an array of named units of code to be added to an existing compiler instance */
        function makeUnitsFromTest(code, fileName, rootDir) {
            const settings = extractCompilerSettings(code);
            // List of all the subfiles we've parsed out
            const testUnitData = [];
            const lines = Utils.splitContentByNewlines(code);
            // Stuff related to the subfile we're parsing
            let currentFileContent;
            let currentFileOptions = {};
            let currentFileName;
            let refs = [];
            for (const line of lines) {
                const testMetaData = optionRegex.exec(line);
                if (testMetaData) {
                    // Comment line, check for global/file @options and record them
                    optionRegex.lastIndex = 0;
                    const metaDataName = testMetaData[1].toLowerCase();
                    currentFileOptions[testMetaData[1]] = testMetaData[2].trim();
                    if (metaDataName !== "filename") {
                        continue;
                    }
                    // New metadata statement after having collected some code to go with the previous metadata
                    if (currentFileName) {
                        // Store result file
                        const newTestFile = {
                            content: currentFileContent,
                            name: currentFileName,
                            fileOptions: currentFileOptions,
                            originalFilePath: fileName,
                            references: refs
                        };
                        testUnitData.push(newTestFile);
                        // Reset local data
                        currentFileContent = undefined;
                        currentFileOptions = {};
                        currentFileName = testMetaData[2].trim();
                        refs = [];
                    }
                    else {
                        // First metadata marker in the file
                        currentFileName = testMetaData[2].trim();
                    }
                }
                else {
                    // Subfile content line
                    // Append to the current subfile content, inserting a newline needed
                    if (currentFileContent === undefined) {
                        currentFileContent = "";
                    }
                    else if (currentFileContent !== "") {
                        // End-of-line
                        currentFileContent = currentFileContent + "\n";
                    }
                    currentFileContent = currentFileContent + line;
                }
            }
            // normalize the fileName for the single file case
            currentFileName = testUnitData.length > 0 || currentFileName ? currentFileName : ts.getBaseFileName(fileName);
            // EOF, push whatever remains
            const newTestFile2 = {
                content: currentFileContent || "",
                name: currentFileName,
                fileOptions: currentFileOptions,
                originalFilePath: fileName,
                references: refs
            };
            testUnitData.push(newTestFile2);
            // unit tests always list files explicitly
            const parseConfigHost = {
                useCaseSensitiveFileNames: false,
                readDirectory: () => [],
                fileExists: () => true,
                readFile: (name) => ts.forEach(testUnitData, data => data.name.toLowerCase() === name.toLowerCase() ? data.content : undefined)
            };
            // check if project has tsconfig.json in the list of files
            let tsConfig;
            let tsConfigFileUnitData;
            for (let i = 0; i < testUnitData.length; i++) {
                const data = testUnitData[i];
                if (getConfigNameFromFileName(data.name)) {
                    const configJson = ts.parseJsonText(data.name, data.content);
                    assert.isTrue(configJson.endOfFileToken !== undefined);
                    let baseDir = ts.normalizePath(ts.getDirectoryPath(data.name));
                    if (rootDir) {
                        baseDir = ts.getNormalizedAbsolutePath(baseDir, rootDir);
                    }
                    tsConfig = ts.parseJsonSourceFileConfigFileContent(configJson, parseConfigHost, baseDir);
                    tsConfig.options.configFilePath = data.name;
                    tsConfigFileUnitData = data;
                    // delete entry from the list
                    ts.orderedRemoveItemAt(testUnitData, i);
                    break;
                }
            }
            return { settings, testUnitData, tsConfig, tsConfigFileUnitData };
        }
        TestCaseParser.makeUnitsFromTest = makeUnitsFromTest;
    })(TestCaseParser = Harness.TestCaseParser || (Harness.TestCaseParser = {}));
    /** Support class for baseline files */
    let Baseline;
    (function (Baseline) {
        const noContent = "<no content>";
        function localPath(fileName, baselineFolder, subfolder) {
            if (baselineFolder === undefined) {
                return baselinePath(fileName, "local", "tests/baselines", subfolder);
            }
            else {
                return baselinePath(fileName, "local", baselineFolder, subfolder);
            }
        }
        Baseline.localPath = localPath;
        function referencePath(fileName, baselineFolder, subfolder) {
            if (baselineFolder === undefined) {
                return baselinePath(fileName, "reference", "tests/baselines", subfolder);
            }
            else {
                return baselinePath(fileName, "reference", baselineFolder, subfolder);
            }
        }
        function baselinePath(fileName, type, baselineFolder, subfolder) {
            if (subfolder !== undefined) {
                return Harness.userSpecifiedRoot + baselineFolder + "/" + subfolder + "/" + type + "/" + fileName;
            }
            else {
                return Harness.userSpecifiedRoot + baselineFolder + "/" + type + "/" + fileName;
            }
        }
        const fileCache = {};
        function generateActual(generateContent) {
            const actual = generateContent();
            if (actual === undefined) {
                throw new Error("The generated content was \"undefined\". Return \"null\" if no baselining is required.\"");
            }
            return actual;
        }
        function compareToBaseline(actual, relativeFileName, opts) {
            // actual is now either undefined (the generator had an error), null (no file requested),
            // or some real output of the function
            if (actual === undefined) {
                // Nothing to do
                return;
            }
            const refFileName = referencePath(relativeFileName, opts && opts.Baselinefolder, opts && opts.Subfolder);
            /* tslint:disable:no-null-keyword */
            if (actual === null) {
                /* tslint:enable:no-null-keyword */
                actual = noContent;
            }
            let expected = "<no content>";
            if (Harness.IO.fileExists(refFileName)) {
                expected = Harness.IO.readFile(refFileName);
            }
            return { expected, actual };
        }
        function writeComparison(expected, actual, relativeFileName, actualFileName) {
            // For now this is written using TypeScript, because sys is not available when running old test cases.
            // But we need to move to sys once we have
            // Creates the directory including its parent if not already present
            function createDirectoryStructure(dirName) {
                if (fileCache[dirName] || Harness.IO.directoryExists(dirName)) {
                    fileCache[dirName] = true;
                    return;
                }
                const parentDirectory = Harness.IO.directoryName(dirName);
                if (parentDirectory !== "") {
                    createDirectoryStructure(parentDirectory);
                }
                Harness.IO.createDirectory(dirName);
                fileCache[dirName] = true;
            }
            // Create folders if needed
            createDirectoryStructure(Harness.IO.directoryName(actualFileName));
            // Delete the actual file in case it fails
            if (Harness.IO.fileExists(actualFileName)) {
                Harness.IO.deleteFile(actualFileName);
            }
            const encodedActual = Utils.encodeString(actual);
            if (expected !== encodedActual) {
                if (actual === noContent) {
                    Harness.IO.writeFile(actualFileName + ".delete", "");
                }
                else {
                    Harness.IO.writeFile(actualFileName, encodedActual);
                }
                throw new Error(`The baseline file ${relativeFileName} has changed.`);
            }
        }
        function runBaseline(relativeFileName, generateContent, opts) {
            const actualFileName = localPath(relativeFileName, opts && opts.Baselinefolder, opts && opts.Subfolder);
            const actual = generateActual(generateContent);
            const comparison = compareToBaseline(actual, relativeFileName, opts);
            writeComparison(comparison.expected, comparison.actual, relativeFileName, actualFileName);
        }
        Baseline.runBaseline = runBaseline;
        function runMultifileBaseline(relativeFileBase, extension, generateContent, opts, referencedExtensions) {
            const gen = generateContent();
            const writtenFiles = ts.createMap();
            const errors = [];
            // tslint:disable-next-line:no-null-keyword
            if (gen !== null) {
                for (let { done, value } = gen.next(); !done; { done, value } = gen.next()) {
                    const [name, content, count] = value;
                    if (count === 0)
                        continue; // Allow error reporter to skip writing files without errors
                    const relativeFileName = relativeFileBase + "/" + name + extension;
                    const actualFileName = localPath(relativeFileName, opts && opts.Baselinefolder, opts && opts.Subfolder);
                    const comparison = compareToBaseline(content, relativeFileName, opts);
                    try {
                        writeComparison(comparison.expected, comparison.actual, relativeFileName, actualFileName);
                    }
                    catch (e) {
                        errors.push(e);
                    }
                    writtenFiles.set(relativeFileName, true);
                }
            }
            const referenceDir = referencePath(relativeFileBase, opts && opts.Baselinefolder, opts && opts.Subfolder);
            let existing = Harness.IO.readDirectory(referenceDir, referencedExtensions || [extension]);
            if (extension === ".ts" || referencedExtensions && referencedExtensions.indexOf(".ts") > -1 && referencedExtensions.indexOf(".d.ts") === -1) {
                // special-case and filter .d.ts out of .ts results
                existing = existing.filter(f => !ts.endsWith(f, ".d.ts"));
            }
            const missing = [];
            for (const name of existing) {
                const localCopy = name.substring(referenceDir.length - relativeFileBase.length);
                if (!writtenFiles.has(localCopy)) {
                    missing.push(localCopy);
                }
            }
            if (missing.length) {
                for (const file of missing) {
                    Harness.IO.writeFile(localPath(file + ".delete", opts && opts.Baselinefolder, opts && opts.Subfolder), "");
                }
            }
            if (errors.length || missing.length) {
                let errorMsg = "";
                if (errors.length) {
                    errorMsg += `The baseline for ${relativeFileBase} in ${errors.length} files has changed:${"\n    " + errors.slice(0, 5).map(e => e.message).join("\n    ") + (errors.length > 5 ? "\n" + `    and ${errors.length - 5} more` : "")}`;
                }
                if (errors.length && missing.length) {
                    errorMsg += "\n";
                }
                if (missing.length) {
                    const writtenFilesArray = ts.arrayFrom(writtenFiles.keys());
                    errorMsg += `Baseline missing ${missing.length} files:${"\n    " + missing.slice(0, 5).join("\n    ") + (missing.length > 5 ? "\n" + `    and ${missing.length - 5} more` : "") + "\n"}Written ${writtenFiles.size} files:${"\n    " + writtenFilesArray.slice(0, 5).join("\n    ") + (writtenFilesArray.length > 5 ? "\n" + `    and ${writtenFilesArray.length - 5} more` : "")}`;
                }
                throw new Error(errorMsg);
            }
        }
        Baseline.runMultifileBaseline = runMultifileBaseline;
    })(Baseline = Harness.Baseline || (Harness.Baseline = {}));
    function isDefaultLibraryFile(filePath) {
        // We need to make sure that the filePath is prefixed with "lib." not just containing "lib." and end with ".d.ts"
        const fileName = ts.getBaseFileName(ts.normalizeSlashes(filePath));
        return ts.startsWith(fileName, "lib.") && ts.endsWith(fileName, ts.Extension.Dts);
    }
    Harness.isDefaultLibraryFile = isDefaultLibraryFile;
    function isBuiltFile(filePath) {
        return ts.startsWith(filePath, Harness.libFolder);
    }
    Harness.isBuiltFile = isBuiltFile;
    function getDefaultLibraryFile(filePath, io) {
        const libFile = Harness.userSpecifiedRoot + Harness.libFolder + ts.getBaseFileName(ts.normalizeSlashes(filePath));
        return { unitName: libFile, content: io.readFile(libFile) };
    }
    Harness.getDefaultLibraryFile = getDefaultLibraryFile;
    function getConfigNameFromFileName(filename) {
        const flc = ts.getBaseFileName(filename).toLowerCase();
        return ts.find(["tsconfig.json", "jsconfig.json"], x => x === flc);
    }
    Harness.getConfigNameFromFileName = getConfigNameFromFileName;
    if (Error)
        Error.stackTraceLimit = 100;
})(Harness || (Harness = {}));
