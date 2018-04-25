var ts;
(function (ts) {
    var server;
    (function (server) {
        let LogLevel;
        (function (LogLevel) {
            LogLevel[LogLevel["terse"] = 0] = "terse";
            LogLevel[LogLevel["normal"] = 1] = "normal";
            LogLevel[LogLevel["requestTime"] = 2] = "requestTime";
            LogLevel[LogLevel["verbose"] = 3] = "verbose";
        })(LogLevel = server.LogLevel || (server.LogLevel = {}));
        server.emptyArray = createSortedArray();
        // TODO: Use a const enum (https://github.com/Microsoft/TypeScript/issues/16804)
        let Msg;
        (function (Msg) {
            Msg["Err"] = "Err";
            Msg["Info"] = "Info";
            Msg["Perf"] = "Perf";
        })(Msg = server.Msg || (server.Msg = {}));
        function createInstallTypingsRequest(project, typeAcquisition, unresolvedImports, cachePath) {
            return {
                projectName: project.getProjectName(),
                fileNames: project.getFileNames(/*excludeFilesFromExternalLibraries*/ true, /*excludeConfigFiles*/ true).concat(project.getExcludedFiles()),
                compilerOptions: project.getCompilationSettings(),
                typeAcquisition,
                unresolvedImports,
                projectRootPath: project.getCurrentDirectory(),
                cachePath,
                kind: "discover"
            };
        }
        server.createInstallTypingsRequest = createInstallTypingsRequest;
        let Errors;
        (function (Errors) {
            function ThrowNoProject() {
                throw new Error("No Project.");
            }
            Errors.ThrowNoProject = ThrowNoProject;
            function ThrowProjectLanguageServiceDisabled() {
                throw new Error("The project's language service is disabled.");
            }
            Errors.ThrowProjectLanguageServiceDisabled = ThrowProjectLanguageServiceDisabled;
            function ThrowProjectDoesNotContainDocument(fileName, project) {
                throw new Error(`Project '${project.getProjectName()}' does not contain document '${fileName}'`);
            }
            Errors.ThrowProjectDoesNotContainDocument = ThrowProjectDoesNotContainDocument;
        })(Errors = server.Errors || (server.Errors = {}));
        function getDefaultFormatCodeSettings(host) {
            return {
                indentSize: 4,
                tabSize: 4,
                newLineCharacter: host.newLine || "\n",
                convertTabsToSpaces: true,
                indentStyle: ts.IndentStyle.Smart,
                insertSpaceAfterConstructor: false,
                insertSpaceAfterCommaDelimiter: true,
                insertSpaceAfterSemicolonInForStatements: true,
                insertSpaceBeforeAndAfterBinaryOperators: true,
                insertSpaceAfterKeywordsInControlFlowStatements: true,
                insertSpaceAfterFunctionKeywordForAnonymousFunctions: false,
                insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis: false,
                insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets: false,
                insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true,
                insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: false,
                insertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces: false,
                insertSpaceBeforeFunctionParenthesis: false,
                placeOpenBraceOnNewLineForFunctions: false,
                placeOpenBraceOnNewLineForControlBlocks: false,
            };
        }
        server.getDefaultFormatCodeSettings = getDefaultFormatCodeSettings;
        function toNormalizedPath(fileName) {
            return ts.normalizePath(fileName);
        }
        server.toNormalizedPath = toNormalizedPath;
        function normalizedPathToPath(normalizedPath, currentDirectory, getCanonicalFileName) {
            const f = ts.isRootedDiskPath(normalizedPath) ? normalizedPath : ts.getNormalizedAbsolutePath(normalizedPath, currentDirectory);
            return getCanonicalFileName(f);
        }
        server.normalizedPathToPath = normalizedPathToPath;
        function asNormalizedPath(fileName) {
            return fileName;
        }
        server.asNormalizedPath = asNormalizedPath;
        function createNormalizedPathMap() {
            const map = ts.createMap();
            return {
                get(path) {
                    return map.get(path);
                },
                set(path, value) {
                    map.set(path, value);
                },
                contains(path) {
                    return map.has(path);
                },
                remove(path) {
                    map.delete(path);
                }
            };
        }
        server.createNormalizedPathMap = createNormalizedPathMap;
        function isInferredProjectName(name) {
            // POSIX defines /dev/null as a device - there should be no file with this prefix
            return /dev\/null\/inferredProject\d+\*/.test(name);
        }
        server.isInferredProjectName = isInferredProjectName;
        function makeInferredProjectName(counter) {
            return `/dev/null/inferredProject${counter}*`;
        }
        server.makeInferredProjectName = makeInferredProjectName;
        function createSortedArray() {
            return [];
        }
        server.createSortedArray = createSortedArray;
    })(server = ts.server || (ts.server = {}));
})(ts || (ts = {}));
/* @internal */
(function (ts) {
    var server;
    (function (server) {
        class ThrottledOperations {
            constructor(host, logger) {
                this.host = host;
                this.pendingTimeouts = ts.createMap();
                this.logger = logger.hasLevel(server.LogLevel.verbose) && logger;
            }
            /**
             * Wait `number` milliseconds and then invoke `cb`.  If, while waiting, schedule
             * is called again with the same `operationId`, cancel this operation in favor
             * of the new one.  (Note that the amount of time the canceled operation had been
             * waiting does not affect the amount of time that the new operation waits.)
             */
            schedule(operationId, delay, cb) {
                const pendingTimeout = this.pendingTimeouts.get(operationId);
                if (pendingTimeout) {
                    // another operation was already scheduled for this id - cancel it
                    this.host.clearTimeout(pendingTimeout);
                }
                // schedule new operation, pass arguments
                this.pendingTimeouts.set(operationId, this.host.setTimeout(ThrottledOperations.run, delay, this, operationId, cb));
                if (this.logger) {
                    this.logger.info(`Scheduled: ${operationId}${pendingTimeout ? ", Cancelled earlier one" : ""}`);
                }
            }
            static run(self, operationId, cb) {
                self.pendingTimeouts.delete(operationId);
                if (self.logger) {
                    self.logger.info(`Running: ${operationId}`);
                }
                cb();
            }
        }
        server.ThrottledOperations = ThrottledOperations;
        class GcTimer {
            constructor(host, delay, logger) {
                this.host = host;
                this.delay = delay;
                this.logger = logger;
            }
            scheduleCollect() {
                if (!this.host.gc || this.timerId !== undefined) {
                    // no global.gc or collection was already scheduled - skip this request
                    return;
                }
                this.timerId = this.host.setTimeout(GcTimer.run, this.delay, this);
            }
            static run(self) {
                self.timerId = undefined;
                const log = self.logger.hasLevel(server.LogLevel.requestTime);
                const before = log && self.host.getMemoryUsage();
                self.host.gc();
                if (log) {
                    const after = self.host.getMemoryUsage();
                    self.logger.perftrc(`GC::before ${before}, after ${after}`);
                }
            }
        }
        server.GcTimer = GcTimer;
        function getBaseConfigFileName(configFilePath) {
            const base = ts.getBaseFileName(configFilePath);
            return base === "tsconfig.json" || base === "jsconfig.json" ? base : undefined;
        }
        server.getBaseConfigFileName = getBaseConfigFileName;
        function removeSorted(array, remove, compare) {
            if (!array || array.length === 0) {
                return;
            }
            if (array[0] === remove) {
                array.splice(0, 1);
                return;
            }
            const removeIndex = ts.binarySearch(array, remove, ts.identity, compare);
            if (removeIndex >= 0) {
                array.splice(removeIndex, 1);
            }
        }
        server.removeSorted = removeSorted;
        function toSortedArray(arr, comparer) {
            arr.sort(comparer);
            return arr;
        }
        server.toSortedArray = toSortedArray;
        function toDeduplicatedSortedArray(arr) {
            arr.sort();
            ts.filterMutate(arr, isNonDuplicateInSortedArray);
            return arr;
        }
        server.toDeduplicatedSortedArray = toDeduplicatedSortedArray;
        function isNonDuplicateInSortedArray(value, index, array) {
            return index === 0 || value !== array[index - 1];
        }
        /* @internal */
        function indent(str) {
            return "\n    " + str;
        }
        server.indent = indent;
        /** Put stringified JSON on the next line, indented. */
        /* @internal */
        function stringifyIndented(json) {
            return "\n    " + JSON.stringify(json);
        }
        server.stringifyIndented = stringifyIndented;
    })(server = ts.server || (ts.server = {}));
})(ts || (ts = {}));
