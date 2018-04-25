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
/// <reference path="harnessLanguageService.ts" />
/// <reference path="harness.ts" />
/// <reference path="fourslashRunner.ts" />
var FourSlash;
(function (FourSlash) {
    ts.disableIncrementalParsing = false;
    // List of allowed metadata names
    const fileMetadataNames = ["Filename" /* fileName */, "emitThisFile" /* emitThisFile */, "ResolveReference" /* resolveReference */, "Symlink" /* symlink */];
    function convertGlobalOptionsToCompilerOptions(globalOptions) {
        const settings = { target: ts.ScriptTarget.ES5 };
        Harness.Compiler.setCompilerOptionsFromHarnessSetting(globalOptions, settings);
        return settings;
    }
    class TestCancellationToken {
        constructor() {
            this.numberOfCallsBeforeCancellation = TestCancellationToken.notCanceled;
        }
        isCancellationRequested() {
            if (this.numberOfCallsBeforeCancellation < 0) {
                return false;
            }
            if (this.numberOfCallsBeforeCancellation > 0) {
                this.numberOfCallsBeforeCancellation--;
                return false;
            }
            return true;
        }
        setCancelled(numberOfCalls = 0) {
            ts.Debug.assert(numberOfCalls >= 0);
            this.numberOfCallsBeforeCancellation = numberOfCalls;
        }
        resetCancelled() {
            this.numberOfCallsBeforeCancellation = TestCancellationToken.notCanceled;
        }
    }
    // 0 - cancelled
    // >0 - not cancelled
    // <0 - not cancelled and value denotes number of isCancellationRequested after which token become cancelled
    TestCancellationToken.notCanceled = -1;
    FourSlash.TestCancellationToken = TestCancellationToken;
    function verifyOperationIsCancelled(f) {
        try {
            f();
        }
        catch (e) {
            if (e instanceof ts.OperationCanceledException) {
                return;
            }
        }
        throw new Error("Operation should be cancelled");
    }
    FourSlash.verifyOperationIsCancelled = verifyOperationIsCancelled;
    // This function creates IScriptSnapshot object for testing getPreProcessedFileInfo
    // Return object may lack some functionalities for other purposes.
    function createScriptSnapShot(sourceText) {
        return ts.ScriptSnapshot.fromString(sourceText);
    }
    class TestState {
        constructor(basePath, testType, testData) {
            this.basePath = basePath;
            this.testType = testType;
            this.testData = testData;
            // The current caret position in the active file
            this.currentCaretPosition = 0;
            // The position of the end of the current selection, or -1 if nothing is selected
            this.selectionEnd = -1;
            this.lastKnownMarker = "";
            // Whether or not we should format on keystrokes
            this.enableFormatting = true;
            this.inputFiles = ts.createMap(); // Map between inputFile's fileName and its content for easily looking up when resolving references
            this.alignmentForExtraInfo = 50;
            // Create a new Services Adapter
            this.cancellationToken = new TestCancellationToken();
            let compilationOptions = convertGlobalOptionsToCompilerOptions(this.testData.globalOptions);
            compilationOptions.skipDefaultLibCheck = true;
            // Initialize the language service with all the scripts
            let startResolveFileRef;
            let configFileName;
            for (const file of testData.files) {
                // Create map between fileName and its content for easily looking up when resolveReference flag is specified
                this.inputFiles.set(file.fileName, file.content);
                if (isConfig(file)) {
                    const configJson = ts.parseConfigFileTextToJson(file.fileName, file.content);
                    if (configJson.config === undefined) {
                        throw new Error(`Failed to parse test ${file.fileName}: ${configJson.error.messageText}`);
                    }
                    // Extend our existing compiler options so that we can also support tsconfig only options
                    if (configJson.config.compilerOptions) {
                        const baseDirectory = ts.normalizePath(ts.getDirectoryPath(file.fileName));
                        const tsConfig = ts.convertCompilerOptionsFromJson(configJson.config.compilerOptions, baseDirectory, file.fileName);
                        if (!tsConfig.errors || !tsConfig.errors.length) {
                            compilationOptions = ts.extend(compilationOptions, tsConfig.options);
                        }
                    }
                    configFileName = file.fileName;
                }
                if (!startResolveFileRef && file.fileOptions["ResolveReference" /* resolveReference */] === "true") {
                    startResolveFileRef = file;
                }
                else if (startResolveFileRef) {
                    // If entry point for resolving file references is already specified, report duplication error
                    throw new Error("There exists a Fourslash file which has resolveReference flag specified; remove duplicated resolveReference flag");
                }
            }
            if (configFileName) {
                const baseDir = ts.normalizePath(ts.getDirectoryPath(configFileName));
                const host = new Utils.MockParseConfigHost(baseDir, /*ignoreCase*/ false, this.inputFiles);
                const jsonSourceFile = ts.parseJsonText(configFileName, this.inputFiles.get(configFileName));
                compilationOptions = ts.parseJsonSourceFileConfigFileContent(jsonSourceFile, host, baseDir, compilationOptions, configFileName).options;
            }
            if (compilationOptions.typeRoots) {
                compilationOptions.typeRoots = compilationOptions.typeRoots.map(p => ts.getNormalizedAbsolutePath(p, this.basePath));
            }
            const languageServiceAdapter = this.getLanguageServiceAdapter(testType, this.cancellationToken, compilationOptions);
            this.languageServiceAdapterHost = languageServiceAdapter.getHost();
            this.languageService = memoWrap(languageServiceAdapter.getLanguageService(), this); // Wrap the LS to cache some expensive operations certain tests call repeatedly
            if (startResolveFileRef) {
                // Add the entry-point file itself into the languageServiceShimHost
                this.languageServiceAdapterHost.addScript(startResolveFileRef.fileName, startResolveFileRef.content, /*isRootFile*/ true);
                const resolvedResult = languageServiceAdapter.getPreProcessedFileInfo(startResolveFileRef.fileName, startResolveFileRef.content);
                const referencedFiles = resolvedResult.referencedFiles;
                const importedFiles = resolvedResult.importedFiles;
                // Add triple reference files into language-service host
                ts.forEach(referencedFiles, referenceFile => {
                    // Fourslash insert tests/cases/fourslash into inputFile.unitName so we will properly append the same base directory to refFile path
                    const referenceFilePath = this.basePath + "/" + referenceFile.fileName;
                    this.addMatchedInputFile(referenceFilePath, /* extensions */ undefined);
                });
                // Add import files into language-service host
                ts.forEach(importedFiles, importedFile => {
                    // Fourslash insert tests/cases/fourslash into inputFile.unitName and import statement doesn't require ".ts"
                    // so convert them before making appropriate comparison
                    const importedFilePath = this.basePath + "/" + importedFile.fileName;
                    this.addMatchedInputFile(importedFilePath, ts.getSupportedExtensions(compilationOptions));
                });
                // Check if no-default-lib flag is false and if so add default library
                if (!resolvedResult.isLibFile) {
                    this.languageServiceAdapterHost.addScript(Harness.Compiler.defaultLibFileName, Harness.Compiler.getDefaultLibrarySourceFile().text, /*isRootFile*/ false);
                }
            }
            else {
                // resolveReference file-option is not specified then do not resolve any files and include all inputFiles
                this.inputFiles.forEach((file, fileName) => {
                    if (!Harness.isDefaultLibraryFile(fileName)) {
                        this.languageServiceAdapterHost.addScript(fileName, file, /*isRootFile*/ true);
                    }
                });
                this.languageServiceAdapterHost.addScript(Harness.Compiler.defaultLibFileName, Harness.Compiler.getDefaultLibrarySourceFile().text, /*isRootFile*/ false);
            }
            for (const file of testData.files) {
                ts.forEach(file.symlinks, link => this.languageServiceAdapterHost.addSymlink(link, file.fileName));
            }
            this.formatCodeSettings = {
                baseIndentSize: 0,
                indentSize: 4,
                tabSize: 4,
                newLineCharacter: "\n",
                convertTabsToSpaces: true,
                indentStyle: ts.IndentStyle.Smart,
                insertSpaceAfterCommaDelimiter: true,
                insertSpaceAfterSemicolonInForStatements: true,
                insertSpaceBeforeAndAfterBinaryOperators: true,
                insertSpaceAfterConstructor: false,
                insertSpaceAfterKeywordsInControlFlowStatements: true,
                insertSpaceAfterFunctionKeywordForAnonymousFunctions: false,
                insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis: false,
                insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets: false,
                insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true,
                insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: false,
                insertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces: false,
                insertSpaceAfterTypeAssertion: false,
                placeOpenBraceOnNewLineForFunctions: false,
                placeOpenBraceOnNewLineForControlBlocks: false,
                insertSpaceBeforeTypeAnnotation: false
            };
            // Open the first file by default
            this.openFile(0);
            function memoWrap(ls, target) {
                const cacheableMembers = [
                    "getCompletionEntryDetails",
                    "getCompletionEntrySymbol",
                    "getQuickInfoAtPosition",
                    "getSignatureHelpItems",
                    "getReferencesAtPosition",
                    "getDocumentHighlights",
                ];
                const proxy = {};
                for (const k in ls) {
                    const key = k;
                    if (cacheableMembers.indexOf(key) === -1) {
                        proxy[key] = (...args) => ls[key](...args);
                        continue;
                    }
                    const memo = Utils.memoize((_version, _active, _caret, _selectEnd, _marker, ...args) => ls[key](...args), (...args) => args.join("|,|"));
                    proxy[key] = (...args) => memo(target.languageServiceAdapterHost.getScriptInfo(target.activeFile.fileName).version, target.activeFile.fileName, target.currentCaretPosition, target.selectionEnd, target.lastKnownMarker, ...args);
                }
                return proxy;
            }
        }
        static getDisplayPartsJson(displayParts) {
            let result = "";
            ts.forEach(displayParts, part => {
                if (result) {
                    result += ",\n    ";
                }
                else {
                    result = "[\n    ";
                }
                result += JSON.stringify(part);
            });
            if (result) {
                result += "\n]";
            }
            return result;
        }
        // Add input file which has matched file name with the given reference-file path.
        // This is necessary when resolveReference flag is specified
        addMatchedInputFile(referenceFilePath, extensions) {
            const inputFiles = this.inputFiles;
            const languageServiceAdapterHost = this.languageServiceAdapterHost;
            const didAdd = tryAdd(referenceFilePath);
            if (extensions && !didAdd) {
                ts.forEach(extensions, ext => tryAdd(referenceFilePath + ext));
            }
            function tryAdd(path) {
                const inputFile = inputFiles.get(path);
                if (inputFile && !Harness.isDefaultLibraryFile(path)) {
                    languageServiceAdapterHost.addScript(path, inputFile, /*isRootFile*/ true);
                    return true;
                }
            }
        }
        getLanguageServiceAdapter(testType, cancellationToken, compilationOptions) {
            switch (testType) {
                case 0 /* Native */:
                    return new Harness.LanguageService.NativeLanguageServiceAdapter(cancellationToken, compilationOptions);
                case 1 /* Shims */:
                    return new Harness.LanguageService.ShimLanguageServiceAdapter(/*preprocessToResolve*/ false, cancellationToken, compilationOptions);
                case 2 /* ShimsWithPreprocess */:
                    return new Harness.LanguageService.ShimLanguageServiceAdapter(/*preprocessToResolve*/ true, cancellationToken, compilationOptions);
                case 3 /* Server */:
                    return new Harness.LanguageService.ServerLanguageServiceAdapter(cancellationToken, compilationOptions);
                default:
                    throw new Error("Unknown FourSlash test type: ");
            }
        }
        getFileContent(fileName) {
            const script = this.languageServiceAdapterHost.getScriptInfo(fileName);
            return script.content;
        }
        // Entry points from fourslash.ts
        goToMarker(name = "") {
            const marker = ts.isString(name) ? this.getMarkerByName(name) : name;
            if (this.activeFile.fileName !== marker.fileName) {
                this.openFile(marker.fileName);
            }
            const content = this.getFileContent(marker.fileName);
            if (marker.position === -1 || marker.position > content.length) {
                throw new Error(`Marker "${name}" has been invalidated by unrecoverable edits to the file.`);
            }
            const mName = ts.isString(name) ? name : this.markerName(marker);
            this.lastKnownMarker = mName;
            this.goToPosition(marker.position);
        }
        goToEachMarker(markers, action) {
            assert(markers.length);
            for (let i = 0; i < markers.length; i++) {
                this.goToMarker(markers[i]);
                action(markers[i], i);
            }
        }
        goToEachRange(action) {
            const ranges = this.getRanges();
            assert(ranges.length);
            for (const range of ranges) {
                this.selectRange(range);
                action();
            }
        }
        markerName(m) {
            return ts.forEachEntry(this.testData.markerPositions, (marker, name) => {
                if (marker === m) {
                    return name;
                }
            });
        }
        goToPosition(pos) {
            this.currentCaretPosition = pos;
            this.selectionEnd = -1;
        }
        select(startMarker, endMarker) {
            const start = this.getMarkerByName(startMarker), end = this.getMarkerByName(endMarker);
            ts.Debug.assert(start.fileName === end.fileName);
            if (this.activeFile.fileName !== start.fileName) {
                this.openFile(start.fileName);
            }
            this.goToPosition(start.position);
            this.selectionEnd = end.position;
        }
        selectRange(range) {
            this.goToRangeStart(range);
            this.selectionEnd = range.end;
        }
        moveCaretRight(count = 1) {
            this.currentCaretPosition += count;
            this.currentCaretPosition = Math.min(this.currentCaretPosition, this.getFileContent(this.activeFile.fileName).length);
            this.selectionEnd = -1;
        }
        // Opens a file given its 0-based index or fileName
        openFile(indexOrName, content, scriptKindName) {
            const fileToOpen = this.findFile(indexOrName);
            fileToOpen.fileName = ts.normalizeSlashes(fileToOpen.fileName);
            this.activeFile = fileToOpen;
            // Let the host know that this file is now open
            this.languageServiceAdapterHost.openFile(fileToOpen.fileName, content, scriptKindName);
        }
        verifyErrorExistsBetweenMarkers(startMarkerName, endMarkerName, shouldExist) {
            const startMarker = this.getMarkerByName(startMarkerName);
            const endMarker = this.getMarkerByName(endMarkerName);
            const predicate = (errorMinChar, errorLimChar, startPos, endPos) => ((errorMinChar === startPos) && (errorLimChar === endPos)) ? true : false;
            const exists = this.anyErrorInRange(predicate, startMarker, endMarker);
            if (exists !== shouldExist) {
                this.printErrorLog(shouldExist, this.getAllDiagnostics());
                throw new Error(`${shouldExist ? "Expected" : "Did not expect"} failure between markers: '${startMarkerName}', '${endMarkerName}'`);
            }
        }
        raiseError(message) {
            throw new Error(this.messageAtLastKnownMarker(message));
        }
        messageAtLastKnownMarker(message) {
            const locationDescription = this.lastKnownMarker ? this.lastKnownMarker : this.getLineColStringAtPosition(this.currentCaretPosition);
            return `At ${locationDescription}: ${message}`;
        }
        assertionMessageAtLastKnownMarker(msg) {
            return "\nMarker: " + this.lastKnownMarker + "\nChecking: " + msg + "\n\n";
        }
        getDiagnostics(fileName, includeSuggestions = false) {
            return [
                ...this.languageService.getSyntacticDiagnostics(fileName),
                ...this.languageService.getSemanticDiagnostics(fileName),
                ...(includeSuggestions ? this.languageService.getSuggestionDiagnostics(fileName) : ts.emptyArray),
            ];
        }
        getAllDiagnostics() {
            return ts.flatMap(this.languageServiceAdapterHost.getFilenames(), fileName => ts.isAnySupportedFileExtension(fileName) ? this.getDiagnostics(fileName) : []);
        }
        verifyErrorExistsAfterMarker(markerName, shouldExist, after) {
            const marker = this.getMarkerByName(markerName);
            let predicate;
            if (after) {
                predicate = (errorMinChar, errorLimChar, startPos) => ((errorMinChar >= startPos) && (errorLimChar >= startPos)) ? true : false;
            }
            else {
                predicate = (errorMinChar, errorLimChar, startPos) => ((errorMinChar <= startPos) && (errorLimChar <= startPos)) ? true : false;
            }
            const exists = this.anyErrorInRange(predicate, marker);
            const diagnostics = this.getAllDiagnostics();
            if (exists !== shouldExist) {
                this.printErrorLog(shouldExist, diagnostics);
                throw new Error(`${shouldExist ? "Expected" : "Did not expect"} failure at marker '${markerName}'`);
            }
        }
        anyErrorInRange(predicate, startMarker, endMarker) {
            return this.getDiagnostics(startMarker.fileName).some(({ start, length }) => predicate(start, start + length, startMarker.position, endMarker === undefined ? undefined : endMarker.position));
        }
        printErrorLog(expectErrors, errors) {
            if (expectErrors) {
                Harness.IO.log("Expected error not found.  Error list is:");
            }
            else {
                Harness.IO.log("Unexpected error(s) found.  Error list is:");
            }
            for (const { start, length, messageText, file } of errors) {
                Harness.IO.log("  " + this.formatRange(file, start, length) +
                    ", message: " + ts.flattenDiagnosticMessageText(messageText, Harness.IO.newLine()) + "\n");
            }
        }
        formatRange(file, start, length) {
            if (file) {
                return `from: ${this.formatLineAndCharacterOfPosition(file, start)}, to: ${this.formatLineAndCharacterOfPosition(file, start + length)}`;
            }
            return "global";
        }
        formatLineAndCharacterOfPosition(file, pos) {
            if (file) {
                const { line, character } = ts.getLineAndCharacterOfPosition(file, pos);
                return `${line}:${character}`;
            }
            return "global";
        }
        formatPosition(file, pos) {
            if (file) {
                return file.fileName + "@" + pos;
            }
            return "global";
        }
        verifyNoErrors() {
            ts.forEachKey(this.inputFiles, fileName => {
                if (!ts.isAnySupportedFileExtension(fileName)
                    || !this.getProgram().getCompilerOptions().allowJs && !ts.extensionIsTypeScript(ts.extensionFromPath(fileName)))
                    return;
                const errors = this.getDiagnostics(fileName).filter(e => e.category !== ts.DiagnosticCategory.Suggestion);
                if (errors.length) {
                    this.printErrorLog(/*expectErrors*/ false, errors);
                    const error = errors[0];
                    this.raiseError(`Found an error: ${this.formatPosition(error.file, error.start)}: ${error.messageText}`);
                }
            });
        }
        verifyNumberOfErrorsInCurrentFile(expected) {
            const errors = this.getDiagnostics(this.activeFile.fileName);
            const actual = errors.length;
            if (actual !== expected) {
                this.printErrorLog(/*expectErrors*/ false, errors);
                const errorMsg = "Actual number of errors (" + actual + ") does not match expected number (" + expected + ")";
                Harness.IO.log(errorMsg);
                this.raiseError(errorMsg);
            }
        }
        verifyEval(expr, value) {
            const emit = this.languageService.getEmitOutput(this.activeFile.fileName);
            if (emit.outputFiles.length !== 1) {
                throw new Error("Expected exactly one output from emit of " + this.activeFile.fileName);
            }
            const evaluation = new Function(`${emit.outputFiles[0].text};\r\nreturn (${expr});`)();
            if (evaluation !== value) {
                this.raiseError(`Expected evaluation of expression "${expr}" to equal "${value}", but got "${evaluation}"`);
            }
        }
        verifyGoToDefinitionIs(endMarker) {
            this.verifyGoToXWorker(toArray(endMarker), () => this.getGoToDefinition());
        }
        verifyGoToDefinition(arg0, endMarkerNames) {
            this.verifyGoToX(arg0, endMarkerNames, () => this.getGoToDefinitionAndBoundSpan());
        }
        getGoToDefinition() {
            return this.languageService.getDefinitionAtPosition(this.activeFile.fileName, this.currentCaretPosition);
        }
        getGoToDefinitionAndBoundSpan() {
            return this.languageService.getDefinitionAndBoundSpan(this.activeFile.fileName, this.currentCaretPosition);
        }
        verifyGoToType(arg0, endMarkerNames) {
            this.verifyGoToX(arg0, endMarkerNames, () => this.languageService.getTypeDefinitionAtPosition(this.activeFile.fileName, this.currentCaretPosition));
        }
        verifyGoToX(arg0, endMarkerNames, getDefs) {
            if (endMarkerNames) {
                this.verifyGoToXPlain(arg0, endMarkerNames, getDefs);
            }
            else if (ts.isArray(arg0)) {
                const pairs = arg0;
                for (const [start, end] of pairs) {
                    this.verifyGoToXPlain(start, end, getDefs);
                }
            }
            else {
                const obj = arg0;
                for (const startMarkerName in obj) {
                    if (ts.hasProperty(obj, startMarkerName)) {
                        this.verifyGoToXPlain(startMarkerName, obj[startMarkerName], getDefs);
                    }
                }
            }
        }
        verifyGoToXPlain(startMarkerNames, endMarkerNames, getDefs) {
            for (const start of toArray(startMarkerNames)) {
                this.verifyGoToXSingle(start, endMarkerNames, getDefs);
            }
        }
        verifyGoToDefinitionForMarkers(markerNames) {
            for (const markerName of markerNames) {
                this.verifyGoToXSingle(`${markerName}Reference`, `${markerName}Definition`, () => this.getGoToDefinition());
            }
        }
        verifyGoToXSingle(startMarkerName, endMarkerNames, getDefs) {
            this.goToMarker(startMarkerName);
            this.verifyGoToXWorker(toArray(endMarkerNames), getDefs, startMarkerName);
        }
        verifyGoToXWorker(endMarkers, getDefs, startMarkerName) {
            const defs = getDefs();
            let definitions;
            let testName;
            if (!defs || Array.isArray(defs)) {
                definitions = defs || [];
                testName = "goToDefinitions";
            }
            else {
                this.verifyDefinitionTextSpan(defs, startMarkerName);
                definitions = defs.definitions;
                testName = "goToDefinitionsAndBoundSpan";
            }
            if (endMarkers.length !== definitions.length) {
                this.raiseError(`${testName} failed - expected to find ${endMarkers.length} definitions but got ${definitions.length}`);
            }
            ts.zipWith(endMarkers, definitions, (endMarker, definition, i) => {
                const marker = this.getMarkerByName(endMarker);
                if (marker.fileName !== definition.fileName || marker.position !== definition.textSpan.start) {
                    this.raiseError(`${testName} failed for definition ${endMarker} (${i}): expected ${marker.fileName} at ${marker.position}, got ${definition.fileName} at ${definition.textSpan.start}`);
                }
            });
        }
        verifyDefinitionTextSpan(defs, startMarkerName) {
            const range = this.testData.ranges.find(range => this.markerName(range.marker) === startMarkerName);
            if (!range && !defs.textSpan) {
                return;
            }
            if (!range) {
                this.raiseError(`goToDefinitionsAndBoundSpan failed - found a TextSpan ${JSON.stringify(defs.textSpan)} when it wasn't expected.`);
            }
            else if (defs.textSpan.start !== range.pos || defs.textSpan.length !== range.end - range.pos) {
                const expected = {
                    start: range.pos, length: range.end - range.pos
                };
                this.raiseError(`goToDefinitionsAndBoundSpan failed - expected to find TextSpan ${JSON.stringify(expected)} but got ${JSON.stringify(defs.textSpan)}`);
            }
        }
        verifyGetEmitOutputForCurrentFile(expected) {
            const emit = this.languageService.getEmitOutput(this.activeFile.fileName);
            if (emit.outputFiles.length !== 1) {
                throw new Error("Expected exactly one output from emit of " + this.activeFile.fileName);
            }
            const actual = emit.outputFiles[0].text;
            if (actual !== expected) {
                this.raiseError(`Expected emit output to be "${expected}", but got "${actual}"`);
            }
        }
        verifyGetEmitOutputContentsForCurrentFile(expected) {
            const emit = this.languageService.getEmitOutput(this.activeFile.fileName);
            assert.equal(emit.outputFiles.length, expected.length, "Number of emit output files");
            ts.zipWith(emit.outputFiles, expected, (outputFile, expected) => {
                assert.equal(outputFile.name, expected.name, "FileName");
                assert.equal(outputFile.text, expected.text, "Content");
            });
        }
        verifyCompletionListCount(expectedCount, negative) {
            if (expectedCount === 0 && negative) {
                this.verifyCompletionListIsEmpty(/*negative*/ false);
                return;
            }
            const members = this.getCompletionListAtCaret();
            if (members) {
                const match = members.entries.length === expectedCount;
                if ((!match && !negative) || (match && negative)) {
                    this.raiseError("Member list count was " + members.entries.length + ". Expected " + expectedCount);
                }
            }
            else if (expectedCount) {
                this.raiseError("Member list count was 0. Expected " + expectedCount);
            }
        }
        verifyCompletionListItemsCountIsGreaterThan(count, negative) {
            const completions = this.getCompletionListAtCaret();
            const itemsCount = completions ? completions.entries.length : 0;
            if (negative) {
                if (itemsCount > count) {
                    this.raiseError(`Expected completion list items count to not be greater than ${count}, but is actually ${itemsCount}`);
                }
            }
            else {
                if (itemsCount <= count) {
                    this.raiseError(`Expected completion list items count to be greater than ${count}, but is actually ${itemsCount}`);
                }
            }
        }
        verifyCompletionListStartsWithItemsInOrder(items) {
            if (items.length === 0) {
                return;
            }
            const entries = this.getCompletionListAtCaret().entries;
            assert.isTrue(items.length <= entries.length, `Amount of expected items in completion list [ ${items.length} ] is greater than actual number of items in list [ ${entries.length} ]`);
            ts.zipWith(entries, items, (entry, item) => {
                assert.equal(entry.name, item, `Unexpected item in completion list`);
            });
        }
        noItemsWithSameNameButDifferentKind() {
            const completions = this.getCompletionListAtCaret();
            const uniqueItems = ts.createMap();
            for (const item of completions.entries) {
                const uniqueItem = uniqueItems.get(item.name);
                if (!uniqueItem) {
                    uniqueItems.set(item.name, item.kind);
                }
                else {
                    assert.equal(item.kind, uniqueItem, `Items should have the same kind, got ${item.kind} and ${uniqueItem}`);
                }
            }
        }
        verifyCompletionListIsEmpty(negative) {
            const completions = this.getCompletionListAtCaret();
            if ((!completions || completions.entries.length === 0) && negative) {
                this.raiseError("Completion list is empty at caret at position " + this.activeFile.fileName + " " + this.currentCaretPosition);
            }
            else if (completions && completions.entries.length !== 0 && !negative) {
                this.raiseError(`Completion list is not empty at caret at position ${this.activeFile.fileName} ${this.currentCaretPosition}\n` +
                    `Completion List contains: ${stringify(completions.entries.map(e => e.name))}`);
            }
        }
        verifyCompletionListAllowsNewIdentifier(negative) {
            const completions = this.getCompletionListAtCaret();
            if ((completions && !completions.isNewIdentifierLocation) && !negative) {
                this.raiseError("Expected builder completion entry");
            }
            else if ((completions && completions.isNewIdentifierLocation) && negative) {
                this.raiseError("Un-expected builder completion entry");
            }
        }
        verifyCompletionListIsGlobal(expected) {
            const completions = this.getCompletionListAtCaret();
            if (completions && completions.isGlobalCompletion !== expected) {
                this.raiseError(`verifyCompletionListIsGlobal failed - expected result to be ${completions.isGlobalCompletion}`);
            }
        }
        verifyCompletionsAt(markerName, expected, options) {
            if (typeof markerName !== "string") {
                for (const m of markerName)
                    this.verifyCompletionsAt(m, expected, options);
                return;
            }
            this.goToMarker(markerName);
            const actualCompletions = this.getCompletionListAtCaret(options);
            if (!actualCompletions) {
                if (expected === undefined)
                    return;
                this.raiseError(`No completions at position '${this.currentCaretPosition}'.`);
            }
            if (actualCompletions.isNewIdentifierLocation !== (options && options.isNewIdentifierLocation || false)) {
                this.raiseError(`Expected 'isNewIdentifierLocation' to be ${options && options.isNewIdentifierLocation}, got ${actualCompletions.isNewIdentifierLocation}`);
            }
            const actual = actualCompletions.entries;
            if (actual.length !== expected.length) {
                this.raiseError(`Expected ${expected.length} completions, got ${actual.length} (${actual.map(a => a.name)}).`);
            }
            ts.zipWith(actual, expected, (completion, expectedCompletion, index) => {
                const { name, insertText, replacementSpan } = typeof expectedCompletion === "string" ? { name: expectedCompletion, insertText: undefined, replacementSpan: undefined } : expectedCompletion;
                if (completion.name !== name) {
                    this.raiseError(`Expected completion at index ${index} to be ${name}, got ${completion.name}`);
                }
                if (completion.insertText !== insertText) {
                    this.raiseError(`Expected completion insert text at index ${index} to be ${insertText}, got ${completion.insertText}`);
                }
                const convertedReplacementSpan = replacementSpan && ts.createTextSpanFromRange(replacementSpan);
                try {
                    assert.deepEqual(completion.replacementSpan, convertedReplacementSpan);
                }
                catch (_b) {
                    this.raiseError(`Expected completion replacementSpan at index ${index} to be ${stringify(convertedReplacementSpan)}, got ${stringify(completion.replacementSpan)}`);
                }
            });
        }
        verifyCompletionListContains(entryId, text, documentation, kind, spanIndex, hasAction, options) {
            const completions = this.getCompletionListAtCaret(options);
            if (completions) {
                this.assertItemInCompletionList(completions.entries, entryId, text, documentation, kind, spanIndex, hasAction, options);
            }
            else {
                this.raiseError(`No completions at position '${this.currentCaretPosition}' when looking for '${JSON.stringify(entryId)}'.`);
            }
        }
        /**
         * Verify that the completion list does NOT contain the given symbol.
         * The symbol is considered matched with the symbol in the list if and only if all given parameters must matched.
         * When any parameter is omitted, the parameter is ignored during comparison and assumed that the parameter with
         * that property of the symbol in the list.
         * @param symbol the name of symbol
         * @param expectedText the text associated with the symbol
         * @param expectedDocumentation the documentation text associated with the symbol
         * @param expectedKind the kind of symbol (see ScriptElementKind)
         * @param spanIndex the index of the range that the completion item's replacement text span should match
         */
        verifyCompletionListDoesNotContain(entryId, expectedText, expectedDocumentation, expectedKind, spanIndex, options) {
            let replacementSpan;
            if (spanIndex !== undefined) {
                replacementSpan = this.getTextSpanForRangeAtIndex(spanIndex);
            }
            const completions = this.getCompletionListAtCaret(options);
            if (completions) {
                let filterCompletions = completions.entries.filter(e => e.name === entryId.name && e.source === entryId.source);
                filterCompletions = expectedKind ? filterCompletions.filter(e => e.kind === expectedKind || (typeof expectedKind === "object" && e.kind === expectedKind.kind)) : filterCompletions;
                filterCompletions = filterCompletions.filter(entry => {
                    const details = this.getCompletionEntryDetails(entry.name);
                    const documentation = details && ts.displayPartsToString(details.documentation);
                    const text = details && ts.displayPartsToString(details.displayParts);
                    // If any of the expected values are undefined, assume that users don't
                    // care about them.
                    if (replacementSpan && !TestState.textSpansEqual(replacementSpan, entry.replacementSpan)) {
                        return false;
                    }
                    else if (expectedText && text !== expectedText) {
                        return false;
                    }
                    else if (expectedDocumentation && documentation !== expectedDocumentation) {
                        return false;
                    }
                    return true;
                });
                if (filterCompletions.length !== 0) {
                    // After filtered using all present criterion, if there are still symbol left in the list
                    // then these symbols must meet the criterion for Not supposed to be in the list. So we
                    // raise an error
                    let error = `Completion list did contain '${JSON.stringify(entryId)}\'.`;
                    const details = this.getCompletionEntryDetails(filterCompletions[0].name);
                    if (expectedText) {
                        error += "Expected text: " + expectedText + " to equal: " + ts.displayPartsToString(details.displayParts) + ".";
                    }
                    if (expectedDocumentation) {
                        error += "Expected documentation: " + expectedDocumentation + " to equal: " + ts.displayPartsToString(details.documentation) + ".";
                    }
                    if (expectedKind) {
                        error += "Expected kind: " + expectedKind + " to equal: " + filterCompletions[0].kind + ".";
                    }
                    else {
                        error += "kind: " + filterCompletions[0].kind + ".";
                    }
                    if (replacementSpan) {
                        const spanText = filterCompletions[0].replacementSpan ? stringify(filterCompletions[0].replacementSpan) : undefined;
                        error += "Expected replacement span: " + stringify(replacementSpan) + " to equal: " + spanText + ".";
                    }
                    this.raiseError(error);
                }
            }
        }
        verifyCompletionEntryDetails(entryName, expectedText, expectedDocumentation, kind, tags) {
            const details = this.getCompletionEntryDetails(entryName);
            assert(details, "no completion entry available");
            assert.equal(ts.displayPartsToString(details.displayParts), expectedText, this.assertionMessageAtLastKnownMarker("completion entry details text"));
            if (expectedDocumentation !== undefined) {
                assert.equal(ts.displayPartsToString(details.documentation), expectedDocumentation, this.assertionMessageAtLastKnownMarker("completion entry documentation"));
            }
            if (kind !== undefined) {
                assert.equal(details.kind, kind, this.assertionMessageAtLastKnownMarker("completion entry kind"));
            }
            if (tags !== undefined) {
                assert.equal(details.tags.length, tags.length, this.messageAtLastKnownMarker("QuickInfo tags"));
                ts.zipWith(tags, details.tags, (expectedTag, actualTag) => {
                    assert.equal(expectedTag.name, actualTag.name);
                    assert.equal(expectedTag.text, actualTag.text, this.messageAtLastKnownMarker("QuickInfo tag " + actualTag.name));
                });
            }
        }
        getProgram() {
            return this._program || (this._program = this.languageService.getProgram());
        }
        getChecker() {
            return this._checker || (this._checker = this.getProgram().getTypeChecker());
        }
        getSourceFile() {
            const { fileName } = this.activeFile;
            const result = this.getProgram().getSourceFile(fileName);
            if (!result) {
                throw new Error(`Could not get source file ${fileName}`);
            }
            return result;
        }
        getNode() {
            return ts.getTouchingPropertyName(this.getSourceFile(), this.currentCaretPosition, /*includeJsDocComment*/ false);
        }
        goToAndGetNode(range) {
            this.goToRangeStart(range);
            const node = this.getNode();
            this.verifyRange("touching property name", range, node);
            return node;
        }
        verifyRange(desc, expected, actual) {
            const actualStart = actual.getStart();
            const actualEnd = actual.getEnd();
            if (actualStart !== expected.pos || actualEnd !== expected.end) {
                this.raiseError(`${desc} should be ${expected.pos}-${expected.end}, got ${actualStart}-${actualEnd}`);
            }
        }
        verifySymbol(symbol, declarationRanges) {
            const { declarations } = symbol;
            if (declarations.length !== declarationRanges.length) {
                this.raiseError(`Expected to get ${declarationRanges.length} declarations, got ${declarations.length}`);
            }
            ts.zipWith(declarations, declarationRanges, (decl, range) => {
                this.verifyRange("symbol declaration", range, decl);
            });
        }
        verifySymbolAtLocation(startRange, declarationRanges) {
            const node = this.goToAndGetNode(startRange);
            const symbol = this.getChecker().getSymbolAtLocation(node);
            if (!symbol) {
                this.raiseError("Could not get symbol at location");
            }
            this.verifySymbol(symbol, declarationRanges);
        }
        symbolsInScope(range) {
            const node = this.goToAndGetNode(range);
            return this.getChecker().getSymbolsInScope(node, ts.SymbolFlags.Value | ts.SymbolFlags.Type | ts.SymbolFlags.Namespace);
        }
        setTypesRegistry(map) {
            this.languageServiceAdapterHost.typesRegistry = ts.createMapFromTemplate(map);
        }
        verifyTypeOfSymbolAtLocation(range, symbol, expected) {
            const node = this.goToAndGetNode(range);
            const checker = this.getChecker();
            const type = checker.getTypeOfSymbolAtLocation(symbol, node);
            const actual = checker.typeToString(type);
            if (actual !== expected) {
                this.raiseError(`Expected: '${expected}', actual: '${actual}'`);
            }
        }
        verifyReferencesAre(expectedReferences) {
            const actualReferences = this.getReferencesAtCaret() || [];
            if (actualReferences.length > expectedReferences.length) {
                // Find the unaccounted-for reference.
                for (const actual of actualReferences) {
                    if (!ts.forEach(expectedReferences, r => r.pos === actual.textSpan.start)) {
                        this.raiseError(`A reference ${stringify(actual)} is unaccounted for.`);
                    }
                }
                // Probably will never reach here.
                this.raiseError(`There are ${actualReferences.length} references but only ${expectedReferences.length} were expected.`);
            }
            for (const reference of expectedReferences) {
                const { fileName, pos, end } = reference;
                if (reference.marker && reference.marker.data) {
                    const { isWriteAccess, isDefinition } = reference.marker.data;
                    this.verifyReferencesWorker(actualReferences, fileName, pos, end, isWriteAccess, isDefinition);
                }
                else {
                    this.verifyReferencesWorker(actualReferences, fileName, pos, end);
                }
            }
        }
        verifyDocumentHighlightsRespectFilesList(files) {
            const startFile = this.activeFile.fileName;
            for (const fileName of files) {
                const searchFileNames = startFile === fileName ? [startFile] : [startFile, fileName];
                const highlights = this.getDocumentHighlightsAtCurrentPosition(searchFileNames);
                if (!highlights.every(dh => ts.contains(searchFileNames, dh.fileName))) {
                    this.raiseError(`When asking for document highlights only in files ${searchFileNames}, got document highlights in ${unique(highlights, dh => dh.fileName)}`);
                }
            }
        }
        verifyReferencesOf(range, references) {
            this.goToRangeStart(range);
            this.verifyDocumentHighlightsRespectFilesList(unique(references, e => e.fileName));
            this.verifyReferencesAre(references);
        }
        verifyRangesReferenceEachOther(ranges) {
            ranges = ranges || this.getRanges();
            assert(ranges.length);
            for (const range of ranges) {
                this.verifyReferencesOf(range, ranges);
            }
        }
        verifyReferenceGroups(starts, parts) {
            const fullExpected = ts.map(parts, ({ definition, ranges }) => ({
                definition: typeof definition === "string" ? definition : Object.assign({}, definition, { range: ts.createTextSpanFromRange(definition.range) }),
                references: ranges.map(r => {
                    const { isWriteAccess = false, isDefinition = false, isInString } = (r.marker && r.marker.data || {});
                    return Object.assign({ fileName: r.fileName, textSpan: ts.createTextSpanFromRange(r), isWriteAccess,
                        isDefinition }, (isInString ? { isInString: true } : undefined));
                }),
            }));
            for (const start of toArray(starts)) {
                if (typeof start === "string") {
                    this.goToMarker(start);
                }
                else {
                    this.goToRangeStart(start);
                }
                const fullActual = ts.map(this.findReferencesAtCaret(), ({ definition, references }, i) => {
                    const text = definition.displayParts.map(d => d.text).join("");
                    return {
                        definition: fullExpected.length > i && typeof fullExpected[i].definition === "string" ? text : { text, range: definition.textSpan },
                        references,
                    };
                });
                this.assertObjectsEqual(fullActual, fullExpected);
                if (parts) {
                    this.verifyDocumentHighlightsRespectFilesList(unique(ts.flatMap(parts, p => p.ranges), r => r.fileName));
                }
            }
        }
        verifyNoReferences(markerNameOrRange) {
            if (markerNameOrRange) {
                if (ts.isString(markerNameOrRange)) {
                    this.goToMarker(markerNameOrRange);
                }
                else {
                    this.goToRangeStart(markerNameOrRange);
                }
            }
            const refs = this.getReferencesAtCaret();
            if (refs && refs.length) {
                this.raiseError(`Expected getReferences to fail, but saw references: ${stringify(refs)}`);
            }
        }
        verifySingleReferenceGroup(definition, ranges) {
            ranges = ranges || this.getRanges();
            this.verifyReferenceGroups(ranges, [{ definition, ranges }]);
        }
        assertObjectsEqual(fullActual, fullExpected, msgPrefix = "") {
            const recur = (actual, expected, path) => {
                const fail = (msg) => {
                    this.raiseError(`${msgPrefix} At ${path}: ${msg}
Expected: ${stringify(fullExpected)}
Actual: ${stringify(fullActual)}`);
                };
                if ((actual === undefined) !== (expected === undefined)) {
                    fail(`Expected ${expected}, got ${actual}`);
                }
                for (const key in actual) {
                    if (ts.hasProperty(actual, key)) {
                        const ak = actual[key], ek = expected[key];
                        if (typeof ak === "object" && typeof ek === "object") {
                            recur(ak, ek, path ? path + "." + key : key);
                        }
                        else if (ak !== ek) {
                            fail(`Expected '${key}' to be '${ek}', got '${ak}'`);
                        }
                    }
                }
                for (const key in expected) {
                    if (ts.hasProperty(expected, key)) {
                        if (!ts.hasProperty(actual, key)) {
                            fail(`${msgPrefix}Missing property '${key}'`);
                        }
                    }
                }
            };
            if (fullActual === undefined || fullExpected === undefined) {
                if (fullActual === fullExpected) {
                    return;
                }
                this.raiseError(`${msgPrefix}
Expected: ${stringify(fullExpected)}
Actual: ${stringify(fullActual)}`);
            }
            recur(fullActual, fullExpected, "");
        }
        verifyDisplayPartsOfReferencedSymbol(expected) {
            const referencedSymbols = this.findReferencesAtCaret();
            if (referencedSymbols.length === 0) {
                this.raiseError("No referenced symbols found at current caret position");
            }
            else if (referencedSymbols.length > 1) {
                this.raiseError("More than one referenced symbol found");
            }
            assert.equal(TestState.getDisplayPartsJson(referencedSymbols[0].definition.displayParts), TestState.getDisplayPartsJson(expected), this.messageAtLastKnownMarker("referenced symbol definition display parts"));
        }
        verifyReferencesWorker(references, fileName, start, end, isWriteAccess, isDefinition) {
            for (const reference of references) {
                if (reference && reference.fileName === fileName && reference.textSpan.start === start && ts.textSpanEnd(reference.textSpan) === end) {
                    if (typeof isWriteAccess !== "undefined" && reference.isWriteAccess !== isWriteAccess) {
                        this.raiseError(`verifyReferencesAtPositionListContains failed - item isWriteAccess value does not match, actual: ${reference.isWriteAccess}, expected: ${isWriteAccess}.`);
                    }
                    if (typeof isDefinition !== "undefined" && reference.isDefinition !== isDefinition) {
                        this.raiseError(`verifyReferencesAtPositionListContains failed - item isDefinition value does not match, actual: ${reference.isDefinition}, expected: ${isDefinition}.`);
                    }
                    return;
                }
            }
            const missingItem = { fileName, start, end, isWriteAccess, isDefinition };
            this.raiseError(`verifyReferencesAtPositionListContains failed - could not find the item: ${stringify(missingItem)} in the returned list: (${stringify(references)})`);
        }
        getCompletionListAtCaret(options) {
            return this.languageService.getCompletionsAtPosition(this.activeFile.fileName, this.currentCaretPosition, options);
        }
        getCompletionEntryDetails(entryName, source, preferences) {
            return this.languageService.getCompletionEntryDetails(this.activeFile.fileName, this.currentCaretPosition, entryName, this.formatCodeSettings, source, preferences);
        }
        getReferencesAtCaret() {
            return this.languageService.getReferencesAtPosition(this.activeFile.fileName, this.currentCaretPosition);
        }
        findReferencesAtCaret() {
            return this.languageService.findReferences(this.activeFile.fileName, this.currentCaretPosition);
        }
        getSyntacticDiagnostics(expected) {
            const diagnostics = this.languageService.getSyntacticDiagnostics(this.activeFile.fileName);
            this.testDiagnostics(expected, diagnostics, "error");
        }
        getSemanticDiagnostics(expected) {
            const diagnostics = this.languageService.getSemanticDiagnostics(this.activeFile.fileName);
            this.testDiagnostics(expected, diagnostics, "error");
        }
        getSuggestionDiagnostics(expected) {
            this.testDiagnostics(expected, this.languageService.getSuggestionDiagnostics(this.activeFile.fileName), "suggestion");
        }
        testDiagnostics(expected, diagnostics, category) {
            assert.deepEqual(ts.realizeDiagnostics(diagnostics, ts.newLineCharacter), expected.map(e => (Object.assign({ message: e.message, category, code: e.code }, ts.createTextSpanFromRange(e.range || this.getRanges()[0])))));
        }
        verifyQuickInfoAt(markerName, expectedText, expectedDocumentation) {
            this.goToMarker(markerName);
            this.verifyQuickInfoString(expectedText, expectedDocumentation);
        }
        verifyQuickInfos(namesAndTexts) {
            for (const name in namesAndTexts) {
                if (ts.hasProperty(namesAndTexts, name)) {
                    const text = namesAndTexts[name];
                    if (ts.isArray(text)) {
                        assert(text.length === 2);
                        const [expectedText, expectedDocumentation] = text;
                        this.verifyQuickInfoAt(name, expectedText, expectedDocumentation);
                    }
                    else {
                        this.verifyQuickInfoAt(name, text);
                    }
                }
            }
        }
        verifyQuickInfoString(expectedText, expectedDocumentation) {
            if (expectedDocumentation === "") {
                throw new Error("Use 'undefined' instead");
            }
            const actualQuickInfo = this.languageService.getQuickInfoAtPosition(this.activeFile.fileName, this.currentCaretPosition);
            const actualQuickInfoText = actualQuickInfo ? ts.displayPartsToString(actualQuickInfo.displayParts) : "";
            const actualQuickInfoDocumentation = actualQuickInfo ? ts.displayPartsToString(actualQuickInfo.documentation) : "";
            assert.equal(actualQuickInfoText, expectedText, this.messageAtLastKnownMarker("quick info text"));
            assert.equal(actualQuickInfoDocumentation, expectedDocumentation || "", this.assertionMessageAtLastKnownMarker("quick info doc"));
        }
        verifyQuickInfoDisplayParts(kind, kindModifiers, textSpan, displayParts, documentation, tags) {
            const actualQuickInfo = this.languageService.getQuickInfoAtPosition(this.activeFile.fileName, this.currentCaretPosition);
            assert.equal(actualQuickInfo.kind, kind, this.messageAtLastKnownMarker("QuickInfo kind"));
            assert.equal(actualQuickInfo.kindModifiers, kindModifiers, this.messageAtLastKnownMarker("QuickInfo kindModifiers"));
            assert.equal(JSON.stringify(actualQuickInfo.textSpan), JSON.stringify(textSpan), this.messageAtLastKnownMarker("QuickInfo textSpan"));
            assert.equal(TestState.getDisplayPartsJson(actualQuickInfo.displayParts), TestState.getDisplayPartsJson(displayParts), this.messageAtLastKnownMarker("QuickInfo displayParts"));
            assert.equal(TestState.getDisplayPartsJson(actualQuickInfo.documentation), TestState.getDisplayPartsJson(documentation), this.messageAtLastKnownMarker("QuickInfo documentation"));
            assert.equal(actualQuickInfo.tags.length, tags.length, this.messageAtLastKnownMarker("QuickInfo tags"));
            ts.zipWith(tags, actualQuickInfo.tags, (expectedTag, actualTag) => {
                assert.equal(expectedTag.name, actualTag.name);
                assert.equal(expectedTag.text, actualTag.text, this.messageAtLastKnownMarker("QuickInfo tag " + actualTag.name));
            });
        }
        verifyRangesAreRenameLocations(options) {
            if (ts.isArray(options)) {
                this.verifyRenameLocations(options, options);
            }
            else {
                const ranges = options && options.ranges || this.getRanges();
                this.verifyRenameLocations(ranges, Object.assign({ ranges }, options));
            }
        }
        verifyRenameLocations(startRanges, options) {
            let findInStrings, findInComments, ranges;
            if (ts.isArray(options)) {
                findInStrings = findInComments = false;
                ranges = options;
            }
            else {
                findInStrings = !!options.findInStrings;
                findInComments = !!options.findInComments;
                ranges = options.ranges;
            }
            for (const startRange of toArray(startRanges)) {
                this.goToRangeStart(startRange);
                const renameInfo = this.languageService.getRenameInfo(this.activeFile.fileName, this.currentCaretPosition);
                if (!renameInfo.canRename) {
                    this.raiseError("Expected rename to succeed, but it actually failed.");
                    break;
                }
                let references = this.languageService.findRenameLocations(this.activeFile.fileName, this.currentCaretPosition, findInStrings, findInComments);
                ranges = ranges || this.getRanges();
                if (!references) {
                    if (ranges.length !== 0) {
                        this.raiseError(`Expected ${ranges.length} rename locations; got none.`);
                    }
                    return;
                }
                if (ranges.length !== references.length) {
                    this.raiseError("Rename location count does not match result.\n\nExpected: " + stringify(ranges) + "\n\nActual:" + stringify(references));
                }
                ranges = ranges.sort((r1, r2) => r1.pos - r2.pos);
                references = references.sort((r1, r2) => r1.textSpan.start - r2.textSpan.start);
                ts.zipWith(references, ranges, (reference, range) => {
                    if (reference.textSpan.start !== range.pos || ts.textSpanEnd(reference.textSpan) !== range.end) {
                        this.raiseError("Rename location results do not match.\n\nExpected: " + stringify(ranges) + "\n\nActual:" + stringify(references));
                    }
                });
            }
        }
        verifyQuickInfoExists(negative) {
            const actualQuickInfo = this.languageService.getQuickInfoAtPosition(this.activeFile.fileName, this.currentCaretPosition);
            if (negative) {
                if (actualQuickInfo) {
                    this.raiseError("verifyQuickInfoExists failed. Expected quick info NOT to exist");
                }
            }
            else {
                if (!actualQuickInfo) {
                    this.raiseError("verifyQuickInfoExists failed. Expected quick info to exist");
                }
            }
        }
        verifyCurrentSignatureHelpIs(expected) {
            const help = this.getActiveSignatureHelpItem();
            assert.equal(ts.displayPartsToString(help.prefixDisplayParts) +
                help.parameters.map(p => ts.displayPartsToString(p.displayParts)).join(ts.displayPartsToString(help.separatorDisplayParts)) +
                ts.displayPartsToString(help.suffixDisplayParts), expected);
        }
        verifyCurrentParameterIsVariable(isVariable) {
            const signature = this.getActiveSignatureHelpItem();
            assert.isOk(signature);
            assert.equal(isVariable, signature.isVariadic);
        }
        verifyCurrentParameterHelpName(name) {
            const activeParameter = this.getActiveParameter();
            const activeParameterName = activeParameter.name;
            assert.equal(activeParameterName, name);
        }
        verifyCurrentParameterSpanIs(parameter) {
            const activeParameter = this.getActiveParameter();
            assert.equal(ts.displayPartsToString(activeParameter.displayParts), parameter);
        }
        verifyCurrentParameterHelpDocComment(docComment) {
            const activeParameter = this.getActiveParameter();
            const activeParameterDocComment = activeParameter.documentation;
            assert.equal(ts.displayPartsToString(activeParameterDocComment), docComment, this.assertionMessageAtLastKnownMarker("current parameter Help DocComment"));
        }
        verifyCurrentSignatureHelpParameterCount(expectedCount) {
            assert.equal(this.getActiveSignatureHelpItem().parameters.length, expectedCount);
        }
        verifyCurrentSignatureHelpIsVariadic(expected) {
            assert.equal(this.getActiveSignatureHelpItem().isVariadic, expected);
        }
        verifyCurrentSignatureHelpDocComment(docComment) {
            const actualDocComment = this.getActiveSignatureHelpItem().documentation;
            assert.equal(ts.displayPartsToString(actualDocComment), docComment, this.assertionMessageAtLastKnownMarker("current signature help doc comment"));
        }
        verifyCurrentSignatureHelpTags(tags) {
            const actualTags = this.getActiveSignatureHelpItem().tags;
            assert.equal(actualTags.length, tags.length, this.assertionMessageAtLastKnownMarker("signature help tags"));
            ts.zipWith(tags, actualTags, (expectedTag, actualTag) => {
                assert.equal(expectedTag.name, actualTag.name);
                assert.equal(expectedTag.text, actualTag.text, this.assertionMessageAtLastKnownMarker("signature help tag " + actualTag.name));
            });
        }
        verifySignatureHelpCount(expected) {
            const help = this.languageService.getSignatureHelpItems(this.activeFile.fileName, this.currentCaretPosition);
            const actual = help && help.items ? help.items.length : 0;
            assert.equal(actual, expected);
        }
        verifySignatureHelpArgumentCount(expected) {
            const signatureHelpItems = this.languageService.getSignatureHelpItems(this.activeFile.fileName, this.currentCaretPosition);
            const actual = signatureHelpItems.argumentCount;
            assert.equal(actual, expected);
        }
        verifySignatureHelpPresent(shouldBePresent = true) {
            const actual = this.languageService.getSignatureHelpItems(this.activeFile.fileName, this.currentCaretPosition);
            if (shouldBePresent) {
                if (!actual) {
                    this.raiseError("Expected signature help to be present, but it wasn't");
                }
            }
            else {
                if (actual) {
                    this.raiseError(`Expected no signature help, but got "${stringify(actual)}"`);
                }
            }
        }
        validate(name, expected, actual) {
            if (expected && expected !== actual) {
                this.raiseError("Expected " + name + " '" + expected + "'.  Got '" + actual + "' instead.");
            }
        }
        verifyRenameInfoSucceeded(displayName, fullDisplayName, kind, kindModifiers) {
            const renameInfo = this.languageService.getRenameInfo(this.activeFile.fileName, this.currentCaretPosition);
            if (!renameInfo.canRename) {
                this.raiseError("Rename did not succeed");
            }
            this.validate("displayName", displayName, renameInfo.displayName);
            this.validate("fullDisplayName", fullDisplayName, renameInfo.fullDisplayName);
            this.validate("kind", kind, renameInfo.kind);
            this.validate("kindModifiers", kindModifiers, renameInfo.kindModifiers);
            if (this.getRanges().length !== 1) {
                this.raiseError("Expected a single range to be selected in the test file.");
            }
            const expectedRange = this.getRanges()[0];
            if (renameInfo.triggerSpan.start !== expectedRange.pos ||
                ts.textSpanEnd(renameInfo.triggerSpan) !== expectedRange.end) {
                this.raiseError("Expected triggerSpan [" + expectedRange.pos + "," + expectedRange.end + ").  Got [" +
                    renameInfo.triggerSpan.start + "," + ts.textSpanEnd(renameInfo.triggerSpan) + ") instead.");
            }
        }
        verifyRenameInfoFailed(message) {
            const renameInfo = this.languageService.getRenameInfo(this.activeFile.fileName, this.currentCaretPosition);
            if (renameInfo.canRename) {
                this.raiseError("Rename was expected to fail");
            }
            this.validate("error", message, renameInfo.localizedErrorMessage);
        }
        getActiveSignatureHelpItem() {
            const help = this.languageService.getSignatureHelpItems(this.activeFile.fileName, this.currentCaretPosition);
            const index = help.selectedItemIndex;
            return help.items[index];
        }
        getActiveParameter() {
            const help = this.languageService.getSignatureHelpItems(this.activeFile.fileName, this.currentCaretPosition);
            const item = help.items[help.selectedItemIndex];
            const currentParam = help.argumentIndex;
            return item.parameters[currentParam];
        }
        spanInfoToString(spanInfo, prefixString) {
            let resultString = "SpanInfo: " + JSON.stringify(spanInfo);
            if (spanInfo) {
                const spanString = this.activeFile.content.substr(spanInfo.start, spanInfo.length);
                const spanLineMap = ts.computeLineStarts(spanString);
                for (let i = 0; i < spanLineMap.length; i++) {
                    if (!i) {
                        resultString += "\n";
                    }
                    resultString += prefixString + spanString.substring(spanLineMap[i], spanLineMap[i + 1]);
                }
                resultString += "\n" + prefixString + ":=> (" + this.getLineColStringAtPosition(spanInfo.start) + ") to (" + this.getLineColStringAtPosition(ts.textSpanEnd(spanInfo)) + ")";
            }
            return resultString;
        }
        baselineCurrentFileLocations(getSpanAtPos) {
            const fileLineMap = ts.computeLineStarts(this.activeFile.content);
            let nextLine = 0;
            let resultString = "";
            let currentLine;
            let previousSpanInfo;
            let startColumn;
            let length;
            const prefixString = "    >";
            let pos = 0;
            const addSpanInfoString = () => {
                if (previousSpanInfo) {
                    resultString += currentLine;
                    let thisLineMarker = ts.repeatString(" ", startColumn) + ts.repeatString("~", length);
                    thisLineMarker += ts.repeatString(" ", this.alignmentForExtraInfo - thisLineMarker.length - prefixString.length + 1);
                    resultString += thisLineMarker;
                    resultString += "=> Pos: (" + (pos - length) + " to " + (pos - 1) + ") ";
                    resultString += " " + previousSpanInfo;
                    previousSpanInfo = undefined;
                }
            };
            for (; pos < this.activeFile.content.length; pos++) {
                if (pos === 0 || pos === fileLineMap[nextLine]) {
                    nextLine++;
                    addSpanInfoString();
                    if (resultString.length) {
                        resultString += "\n--------------------------------";
                    }
                    currentLine = "\n" + nextLine.toString() + ts.repeatString(" ", 3 - nextLine.toString().length) + ">" + this.activeFile.content.substring(pos, fileLineMap[nextLine]) + "\n    ";
                    startColumn = 0;
                    length = 0;
                }
                const spanInfo = this.spanInfoToString(getSpanAtPos(pos), prefixString);
                if (previousSpanInfo && previousSpanInfo !== spanInfo) {
                    addSpanInfoString();
                    previousSpanInfo = spanInfo;
                    startColumn = startColumn + length;
                    length = 1;
                }
                else {
                    previousSpanInfo = spanInfo;
                    length++;
                }
            }
            addSpanInfoString();
            return resultString;
        }
        getBreakpointStatementLocation(pos) {
            return this.languageService.getBreakpointStatementAtPosition(this.activeFile.fileName, pos);
        }
        baselineCurrentFileBreakpointLocations() {
            let baselineFile = this.testData.globalOptions["BaselineFile" /* baselineFile */];
            if (!baselineFile) {
                baselineFile = this.activeFile.fileName.replace(this.basePath + "/breakpointValidation", "bpSpan");
                baselineFile = baselineFile.replace(ts.Extension.Ts, ".baseline");
            }
            Harness.Baseline.runBaseline(baselineFile, () => {
                return this.baselineCurrentFileLocations(pos => this.getBreakpointStatementLocation(pos));
            });
        }
        baselineGetEmitOutput(insertResultsIntoVfs) {
            // Find file to be emitted
            const emitFiles = []; // List of FourSlashFile that has emitThisFile flag on
            const allFourSlashFiles = this.testData.files;
            for (const file of allFourSlashFiles) {
                if (file.fileOptions["emitThisFile" /* emitThisFile */] === "true") {
                    // Find a file with the flag emitThisFile turned on
                    emitFiles.push(file);
                }
            }
            // If there is not emiThisFile flag specified in the test file, throw an error
            if (emitFiles.length === 0) {
                this.raiseError("No emitThisFile is specified in the test file");
            }
            Harness.Baseline.runBaseline(this.testData.globalOptions["BaselineFile" /* baselineFile */], () => {
                let resultString = "";
                // Loop through all the emittedFiles and emit them one by one
                emitFiles.forEach(emitFile => {
                    const emitOutput = this.languageService.getEmitOutput(emitFile.fileName);
                    // Print emitOutputStatus in readable format
                    resultString += "EmitSkipped: " + emitOutput.emitSkipped + Harness.IO.newLine();
                    if (emitOutput.emitSkipped) {
                        resultString += "Diagnostics:" + Harness.IO.newLine();
                        const diagnostics = ts.getPreEmitDiagnostics(this.languageService.getProgram());
                        for (const diagnostic of diagnostics) {
                            if (!ts.isString(diagnostic.messageText)) {
                                let chainedMessage = diagnostic.messageText;
                                let indentation = " ";
                                while (chainedMessage) {
                                    resultString += indentation + chainedMessage.messageText + Harness.IO.newLine();
                                    chainedMessage = chainedMessage.next;
                                    indentation = indentation + " ";
                                }
                            }
                            else {
                                resultString += "  " + diagnostic.messageText + Harness.IO.newLine();
                            }
                        }
                    }
                    for (const outputFile of emitOutput.outputFiles) {
                        const fileName = "FileName : " + outputFile.name + Harness.IO.newLine();
                        resultString = resultString + fileName + outputFile.text;
                        if (insertResultsIntoVfs) {
                            this.languageServiceAdapterHost.addScript(ts.getNormalizedAbsolutePath(outputFile.name, "/"), outputFile.text, /*isRootFile*/ true);
                        }
                    }
                    resultString += Harness.IO.newLine();
                });
                return resultString;
            });
        }
        baselineQuickInfo() {
            let baselineFile = this.testData.globalOptions["BaselineFile" /* baselineFile */];
            if (!baselineFile) {
                baselineFile = ts.getBaseFileName(this.activeFile.fileName).replace(ts.Extension.Ts, ".baseline");
            }
            Harness.Baseline.runBaseline(baselineFile, () => stringify(this.testData.markers.map(marker => ({
                marker,
                quickInfo: this.languageService.getQuickInfoAtPosition(marker.fileName, marker.position)
            }))));
        }
        printBreakpointLocation(pos) {
            Harness.IO.log("\n**Pos: " + pos + " " + this.spanInfoToString(this.getBreakpointStatementLocation(pos), "  "));
        }
        printBreakpointAtCurrentLocation() {
            this.printBreakpointLocation(this.currentCaretPosition);
        }
        printCurrentParameterHelp() {
            const help = this.languageService.getSignatureHelpItems(this.activeFile.fileName, this.currentCaretPosition);
            Harness.IO.log(stringify(help));
        }
        printCurrentQuickInfo() {
            const quickInfo = this.languageService.getQuickInfoAtPosition(this.activeFile.fileName, this.currentCaretPosition);
            Harness.IO.log("Quick Info: " + quickInfo.displayParts.map(part => part.text).join(""));
        }
        printErrorList() {
            const syntacticErrors = this.languageService.getSyntacticDiagnostics(this.activeFile.fileName);
            const semanticErrors = this.languageService.getSemanticDiagnostics(this.activeFile.fileName);
            const errorList = ts.concatenate(syntacticErrors, semanticErrors);
            Harness.IO.log(`Error list (${errorList.length} errors)`);
            if (errorList.length) {
                errorList.forEach(err => {
                    Harness.IO.log("start: " + err.start +
                        ", length: " + err.length +
                        ", message: " + ts.flattenDiagnosticMessageText(err.messageText, Harness.IO.newLine()));
                });
            }
        }
        printCurrentFileState(showWhitespace, makeCaretVisible) {
            for (const file of this.testData.files) {
                const active = (this.activeFile === file);
                Harness.IO.log(`=== Script (${file.fileName}) ${(active ? "(active, cursor at |)" : "")} ===`);
                let content = this.getFileContent(file.fileName);
                if (active) {
                    content = content.substr(0, this.currentCaretPosition) + (makeCaretVisible ? "|" : "") + content.substr(this.currentCaretPosition);
                }
                if (showWhitespace) {
                    content = makeWhitespaceVisible(content);
                }
                Harness.IO.log(content);
            }
        }
        printCurrentSignatureHelp() {
            const sigHelp = this.getActiveSignatureHelpItem();
            Harness.IO.log(stringify(sigHelp));
        }
        printCompletionListMembers(preferences) {
            const completions = this.getCompletionListAtCaret(preferences);
            this.printMembersOrCompletions(completions);
        }
        printMembersOrCompletions(info) {
            if (info === undefined) {
                return "No completion info.";
            }
            const { entries } = info;
            function pad(s, length) {
                return s + new Array(length - s.length + 1).join(" ");
            }
            function max(arr, selector) {
                return arr.reduce((prev, x) => Math.max(prev, selector(x)), 0);
            }
            const longestNameLength = max(entries, m => m.name.length);
            const longestKindLength = max(entries, m => m.kind.length);
            entries.sort((m, n) => m.sortText > n.sortText ? 1 : m.sortText < n.sortText ? -1 : m.name > n.name ? 1 : m.name < n.name ? -1 : 0);
            const membersString = entries.map(m => `${pad(m.name, longestNameLength)} ${pad(m.kind, longestKindLength)} ${m.kindModifiers} ${m.isRecommended ? "recommended " : ""}${m.source === undefined ? "" : m.source}`).join("\n");
            Harness.IO.log(membersString);
        }
        printContext() {
            ts.forEach(this.languageServiceAdapterHost.getFilenames(), Harness.IO.log);
        }
        deleteChar(count = 1) {
            let offset = this.currentCaretPosition;
            const ch = "";
            const checkCadence = (count >> 2) + 1;
            for (let i = 0; i < count; i++) {
                this.editScriptAndUpdateMarkers(this.activeFile.fileName, offset, offset + 1, ch);
                if (i % checkCadence === 0) {
                    this.checkPostEditInvariants();
                }
                // Handle post-keystroke formatting
                if (this.enableFormatting) {
                    const edits = this.languageService.getFormattingEditsAfterKeystroke(this.activeFile.fileName, offset, ch, this.formatCodeSettings);
                    if (edits.length) {
                        offset += this.applyEdits(this.activeFile.fileName, edits, /*isFormattingEdit*/ true);
                    }
                }
            }
            this.checkPostEditInvariants();
        }
        replace(start, length, text) {
            this.editScriptAndUpdateMarkers(this.activeFile.fileName, start, start + length, text);
            this.checkPostEditInvariants();
        }
        deleteCharBehindMarker(count = 1) {
            let offset = this.currentCaretPosition;
            const ch = "";
            const checkCadence = (count >> 2) + 1;
            for (let i = 0; i < count; i++) {
                this.currentCaretPosition--;
                offset--;
                this.editScriptAndUpdateMarkers(this.activeFile.fileName, offset, offset + 1, ch);
                if (i % checkCadence === 0) {
                    this.checkPostEditInvariants();
                }
                // Don't need to examine formatting because there are no formatting changes on backspace.
            }
            this.checkPostEditInvariants();
        }
        // Enters lines of text at the current caret position
        type(text, highFidelity = false) {
            let offset = this.currentCaretPosition;
            const prevChar = " ";
            const checkCadence = (text.length >> 2) + 1;
            for (let i = 0; i < text.length; i++) {
                const ch = text.charAt(i);
                this.editScriptAndUpdateMarkers(this.activeFile.fileName, offset, offset, ch);
                if (highFidelity) {
                    this.languageService.getBraceMatchingAtPosition(this.activeFile.fileName, offset);
                }
                this.currentCaretPosition++;
                offset++;
                if (highFidelity) {
                    if (ch === "(" || ch === ",") {
                        /* Signature help*/
                        this.languageService.getSignatureHelpItems(this.activeFile.fileName, offset);
                    }
                    else if (prevChar === " " && /A-Za-z_/.test(ch)) {
                        /* Completions */
                        this.languageService.getCompletionsAtPosition(this.activeFile.fileName, offset, ts.defaultPreferences);
                    }
                    if (i % checkCadence === 0) {
                        this.checkPostEditInvariants();
                    }
                }
                // Handle post-keystroke formatting
                if (this.enableFormatting) {
                    const edits = this.languageService.getFormattingEditsAfterKeystroke(this.activeFile.fileName, offset, ch, this.formatCodeSettings);
                    if (edits.length) {
                        offset += this.applyEdits(this.activeFile.fileName, edits, /*isFormattingEdit*/ true);
                    }
                }
            }
            this.checkPostEditInvariants();
        }
        // Enters text as if the user had pasted it
        paste(text) {
            const start = this.currentCaretPosition;
            this.editScriptAndUpdateMarkers(this.activeFile.fileName, this.currentCaretPosition, this.currentCaretPosition, text);
            this.checkPostEditInvariants();
            const offset = this.currentCaretPosition += text.length;
            // Handle formatting
            if (this.enableFormatting) {
                const edits = this.languageService.getFormattingEditsForRange(this.activeFile.fileName, start, offset, this.formatCodeSettings);
                if (edits.length) {
                    this.applyEdits(this.activeFile.fileName, edits, /*isFormattingEdit*/ true);
                }
            }
            this.checkPostEditInvariants();
        }
        checkPostEditInvariants() {
            if (this.testType !== 0 /* Native */) {
                // getSourcefile() results can not be serialized. Only perform these verifications
                // if running against a native LS object.
                return;
            }
            const incrementalSourceFile = this.languageService.getNonBoundSourceFile(this.activeFile.fileName);
            Utils.assertInvariants(incrementalSourceFile, /*parent:*/ undefined);
            const incrementalSyntaxDiagnostics = incrementalSourceFile.parseDiagnostics;
            // Check syntactic structure
            const content = this.getFileContent(this.activeFile.fileName);
            const referenceSourceFile = ts.createLanguageServiceSourceFile(this.activeFile.fileName, createScriptSnapShot(content), ts.ScriptTarget.Latest, /*version:*/ "0", /*setNodeParents:*/ false);
            const referenceSyntaxDiagnostics = referenceSourceFile.parseDiagnostics;
            Utils.assertDiagnosticsEquals(incrementalSyntaxDiagnostics, referenceSyntaxDiagnostics);
            Utils.assertStructuralEquals(incrementalSourceFile, referenceSourceFile);
        }
        /**
         * @returns The number of characters added to the file as a result of the edits.
         * May be negative.
         */
        applyEdits(fileName, edits, isFormattingEdit) {
            // We get back a set of edits, but langSvc.editScript only accepts one at a time. Use this to keep track
            // of the incremental offset from each edit to the next. We assume these edit ranges don't overlap
            // Copy this so we don't ruin someone else's copy
            edits = JSON.parse(JSON.stringify(edits));
            // Get a snapshot of the content of the file so we can make sure any formatting edits didn't destroy non-whitespace characters
            const oldContent = this.getFileContent(fileName);
            let runningOffset = 0;
            for (let i = 0; i < edits.length; i++) {
                const edit = edits[i];
                const offsetStart = edit.span.start;
                const offsetEnd = offsetStart + edit.span.length;
                this.editScriptAndUpdateMarkers(fileName, offsetStart, offsetEnd, edit.newText);
                const editDelta = edit.newText.length - edit.span.length;
                if (offsetStart <= this.currentCaretPosition) {
                    if (offsetEnd <= this.currentCaretPosition) {
                        // The entirety of the edit span falls before the caret position, shift the caret accordingly
                        this.currentCaretPosition += editDelta;
                    }
                    else {
                        // The span being replaced includes the caret position, place the caret at the beginning of the span
                        this.currentCaretPosition = offsetStart;
                    }
                }
                runningOffset += editDelta;
                // Update positions of any future edits affected by this change
                for (let j = i + 1; j < edits.length; j++) {
                    if (edits[j].span.start >= edits[i].span.start) {
                        edits[j].span.start += editDelta;
                    }
                }
            }
            if (isFormattingEdit) {
                const newContent = this.getFileContent(fileName);
                if (this.removeWhitespace(newContent) !== this.removeWhitespace(oldContent)) {
                    this.raiseError("Formatting operation destroyed non-whitespace content");
                }
            }
            return runningOffset;
        }
        copyFormatOptions() {
            return ts.clone(this.formatCodeSettings);
        }
        setFormatOptions(formatCodeOptions) {
            const oldFormatCodeOptions = this.formatCodeSettings;
            this.formatCodeSettings = ts.toEditorSettings(formatCodeOptions);
            return oldFormatCodeOptions;
        }
        formatDocument() {
            const edits = this.languageService.getFormattingEditsForDocument(this.activeFile.fileName, this.formatCodeSettings);
            this.applyEdits(this.activeFile.fileName, edits, /*isFormattingEdit*/ true);
        }
        formatSelection(start, end) {
            const edits = this.languageService.getFormattingEditsForRange(this.activeFile.fileName, start, end, this.formatCodeSettings);
            this.applyEdits(this.activeFile.fileName, edits, /*isFormattingEdit*/ true);
        }
        formatOnType(pos, key) {
            const edits = this.languageService.getFormattingEditsAfterKeystroke(this.activeFile.fileName, pos, key, this.formatCodeSettings);
            this.applyEdits(this.activeFile.fileName, edits, /*isFormattingEdit*/ true);
        }
        editScriptAndUpdateMarkers(fileName, editStart, editEnd, newText) {
            this.languageServiceAdapterHost.editScript(fileName, editStart, editEnd, newText);
            for (const marker of this.testData.markers) {
                if (marker.fileName === fileName) {
                    marker.position = updatePosition(marker.position);
                }
            }
            for (const range of this.testData.ranges) {
                if (range.fileName === fileName) {
                    range.pos = updatePosition(range.pos);
                    range.end = updatePosition(range.end);
                }
            }
            function updatePosition(position) {
                if (position > editStart) {
                    if (position < editEnd) {
                        // Inside the edit - mark it as invalidated (?)
                        return -1;
                    }
                    else {
                        // Move marker back/forward by the appropriate amount
                        return position + (editStart - editEnd) + newText.length;
                    }
                }
                else {
                    return position;
                }
            }
        }
        removeWhitespace(text) {
            return text.replace(/\s/g, "");
        }
        goToBOF() {
            this.goToPosition(0);
        }
        goToEOF() {
            const len = this.getFileContent(this.activeFile.fileName).length;
            this.goToPosition(len);
        }
        goToRangeStart({ fileName, pos }) {
            this.openFile(fileName);
            this.goToPosition(pos);
        }
        goToTypeDefinition(definitionIndex) {
            const definitions = this.languageService.getTypeDefinitionAtPosition(this.activeFile.fileName, this.currentCaretPosition);
            if (!definitions || !definitions.length) {
                this.raiseError("goToTypeDefinition failed - expected to find at least one definition location but got 0");
            }
            if (definitionIndex >= definitions.length) {
                this.raiseError(`goToTypeDefinition failed - definitionIndex value (${definitionIndex}) exceeds definition list size (${definitions.length})`);
            }
            const definition = definitions[definitionIndex];
            this.openFile(definition.fileName);
            this.currentCaretPosition = definition.textSpan.start;
        }
        verifyTypeDefinitionsCount(negative, expectedCount) {
            const assertFn = negative ? assert.notEqual : assert.equal;
            const definitions = this.languageService.getTypeDefinitionAtPosition(this.activeFile.fileName, this.currentCaretPosition);
            const actualCount = definitions && definitions.length || 0;
            assertFn(actualCount, expectedCount, this.messageAtLastKnownMarker("Type definitions Count"));
        }
        verifyImplementationListIsEmpty(negative) {
            const implementations = this.languageService.getImplementationAtPosition(this.activeFile.fileName, this.currentCaretPosition);
            if (negative) {
                assert.isTrue(implementations && implementations.length > 0, "Expected at least one implementation but got 0");
            }
            else {
                assert.isUndefined(implementations, "Expected implementation list to be empty but implementations returned");
            }
        }
        verifyGoToDefinitionName(expectedName, expectedContainerName) {
            const definitions = this.languageService.getDefinitionAtPosition(this.activeFile.fileName, this.currentCaretPosition);
            const actualDefinitionName = definitions && definitions.length ? definitions[0].name : "";
            const actualDefinitionContainerName = definitions && definitions.length ? definitions[0].containerName : "";
            assert.equal(actualDefinitionName, expectedName, this.messageAtLastKnownMarker("Definition Info Name"));
            assert.equal(actualDefinitionContainerName, expectedContainerName, this.messageAtLastKnownMarker("Definition Info Container Name"));
        }
        goToImplementation() {
            const implementations = this.languageService.getImplementationAtPosition(this.activeFile.fileName, this.currentCaretPosition);
            if (!implementations || !implementations.length) {
                this.raiseError("goToImplementation failed - expected to find at least one implementation location but got 0");
            }
            if (implementations.length > 1) {
                this.raiseError(`goToImplementation failed - more than 1 implementation returned (${implementations.length})`);
            }
            const implementation = implementations[0];
            this.openFile(implementation.fileName);
            this.currentCaretPosition = implementation.textSpan.start;
        }
        verifyRangesInImplementationList(markerName) {
            this.goToMarker(markerName);
            const implementations = this.languageService.getImplementationAtPosition(this.activeFile.fileName, this.currentCaretPosition);
            if (!implementations || !implementations.length) {
                this.raiseError("verifyRangesInImplementationList failed - expected to find at least one implementation location but got 0");
            }
            const duplicate = findDuplicatedElement(implementations, implementationsAreEqual);
            if (duplicate) {
                const { textSpan, fileName } = duplicate;
                const end = textSpan.start + textSpan.length;
                this.raiseError(`Duplicate implementations returned for range (${textSpan.start}, ${end}) in ${fileName}`);
            }
            const ranges = this.getRanges();
            if (!ranges || !ranges.length) {
                this.raiseError("verifyRangesInImplementationList failed - expected to find at least one range in test source");
            }
            const unsatisfiedRanges = [];
            const delayedErrors = [];
            for (const range of ranges) {
                const length = range.end - range.pos;
                const matchingImpl = ts.find(implementations, impl => range.fileName === impl.fileName && range.pos === impl.textSpan.start && length === impl.textSpan.length);
                if (matchingImpl) {
                    if (range.marker && range.marker.data) {
                        const expected = range.marker.data;
                        if (expected.displayParts) {
                            if (!ts.arrayIsEqualTo(expected.displayParts, matchingImpl.displayParts, displayPartIsEqualTo)) {
                                delayedErrors.push(`Mismatched display parts: expected ${JSON.stringify(expected.displayParts)}, actual ${JSON.stringify(matchingImpl.displayParts)}`);
                            }
                        }
                        else if (expected.parts) {
                            const actualParts = matchingImpl.displayParts.map(p => p.text);
                            if (!ts.arrayIsEqualTo(expected.parts, actualParts)) {
                                delayedErrors.push(`Mismatched non-tagged display parts: expected ${JSON.stringify(expected.parts)}, actual ${JSON.stringify(actualParts)}`);
                            }
                        }
                        if (expected.kind !== undefined) {
                            if (expected.kind !== matchingImpl.kind) {
                                delayedErrors.push(`Mismatched kind: expected ${JSON.stringify(expected.kind)}, actual ${JSON.stringify(matchingImpl.kind)}`);
                            }
                        }
                    }
                    matchingImpl.matched = true;
                }
                else {
                    unsatisfiedRanges.push(range);
                }
            }
            if (delayedErrors.length) {
                this.raiseError(delayedErrors.join("\n"));
            }
            const unmatchedImplementations = implementations.filter(impl => !impl.matched);
            if (unmatchedImplementations.length || unsatisfiedRanges.length) {
                let error = "Not all ranges or implementations are satisfied";
                if (unsatisfiedRanges.length) {
                    error += "\nUnsatisfied ranges:";
                    for (const range of unsatisfiedRanges) {
                        error += `\n    (${range.pos}, ${range.end}) in ${range.fileName}: ${this.rangeText(range)}`;
                    }
                }
                if (unmatchedImplementations.length) {
                    error += "\nUnmatched implementations:";
                    for (const impl of unmatchedImplementations) {
                        const end = impl.textSpan.start + impl.textSpan.length;
                        error += `\n    (${impl.textSpan.start}, ${end}) in ${impl.fileName}: ${this.getFileContent(impl.fileName).slice(impl.textSpan.start, end)}`;
                    }
                }
                this.raiseError(error);
            }
            function implementationsAreEqual(a, b) {
                return a.fileName === b.fileName && TestState.textSpansEqual(a.textSpan, b.textSpan);
            }
            function displayPartIsEqualTo(a, b) {
                return a.kind === b.kind && a.text === b.text;
            }
        }
        getMarkers() {
            //  Return a copy of the list
            return this.testData.markers.slice(0);
        }
        getMarkerNames() {
            return ts.arrayFrom(this.testData.markerPositions.keys());
        }
        getRanges() {
            return this.testData.ranges;
        }
        rangesByText() {
            const result = ts.createMultiMap();
            for (const range of this.getRanges()) {
                const text = this.rangeText(range);
                result.add(text, range);
            }
            return result;
        }
        rangeText({ fileName, pos, end }) {
            return this.getFileContent(fileName).slice(pos, end);
        }
        verifyCaretAtMarker(markerName = "") {
            const pos = this.getMarkerByName(markerName);
            if (pos.fileName !== this.activeFile.fileName) {
                throw new Error(`verifyCaretAtMarker failed - expected to be in file "${pos.fileName}", but was in file "${this.activeFile.fileName}"`);
            }
            if (pos.position !== this.currentCaretPosition) {
                throw new Error(`verifyCaretAtMarker failed - expected to be at marker "/*${markerName}*/, but was at position ${this.currentCaretPosition}(${this.getLineColStringAtPosition(this.currentCaretPosition)})`);
            }
        }
        getIndentation(fileName, position, indentStyle, baseIndentSize) {
            const formatOptions = ts.clone(this.formatCodeSettings);
            formatOptions.indentStyle = indentStyle;
            formatOptions.baseIndentSize = baseIndentSize;
            return this.languageService.getIndentationAtPosition(fileName, position, formatOptions);
        }
        verifyIndentationAtCurrentPosition(numberOfSpaces, indentStyle = ts.IndentStyle.Smart, baseIndentSize = 0) {
            const actual = this.getIndentation(this.activeFile.fileName, this.currentCaretPosition, indentStyle, baseIndentSize);
            const lineCol = this.getLineColStringAtPosition(this.currentCaretPosition);
            if (actual !== numberOfSpaces) {
                this.raiseError(`verifyIndentationAtCurrentPosition failed at ${lineCol} - expected: ${numberOfSpaces}, actual: ${actual}`);
            }
        }
        verifyIndentationAtPosition(fileName, position, numberOfSpaces, indentStyle = ts.IndentStyle.Smart, baseIndentSize = 0) {
            const actual = this.getIndentation(fileName, position, indentStyle, baseIndentSize);
            const lineCol = this.getLineColStringAtPosition(position);
            if (actual !== numberOfSpaces) {
                this.raiseError(`verifyIndentationAtPosition failed at ${lineCol} - expected: ${numberOfSpaces}, actual: ${actual}`);
            }
        }
        verifyCurrentLineContent(text) {
            const actual = this.getCurrentLineContent();
            if (actual !== text) {
                throw new Error("verifyCurrentLineContent\n" +
                    "\tExpected: \"" + text + "\"\n" +
                    "\t  Actual: \"" + actual + "\"");
            }
        }
        verifyCurrentFileContent(text) {
            const actual = this.getFileContent(this.activeFile.fileName);
            if (actual !== text) {
                throw new Error(`verifyCurrentFileContent failed:\n${showTextDiff(text, actual)}`);
            }
        }
        verifyTextAtCaretIs(text) {
            const actual = this.getFileContent(this.activeFile.fileName).substring(this.currentCaretPosition, this.currentCaretPosition + text.length);
            if (actual !== text) {
                throw new Error("verifyTextAtCaretIs\n" +
                    "\tExpected: \"" + text + "\"\n" +
                    "\t  Actual: \"" + actual + "\"");
            }
        }
        verifyCurrentNameOrDottedNameSpanText(text) {
            const span = this.languageService.getNameOrDottedNameSpan(this.activeFile.fileName, this.currentCaretPosition, this.currentCaretPosition);
            if (!span) {
                this.raiseError("verifyCurrentNameOrDottedNameSpanText\n" +
                    "\tExpected: \"" + text + "\"\n" +
                    "\t  Actual: undefined");
            }
            const actual = this.getFileContent(this.activeFile.fileName).substring(span.start, ts.textSpanEnd(span));
            if (actual !== text) {
                this.raiseError("verifyCurrentNameOrDottedNameSpanText\n" +
                    "\tExpected: \"" + text + "\"\n" +
                    "\t  Actual: \"" + actual + "\"");
            }
        }
        getNameOrDottedNameSpan(pos) {
            return this.languageService.getNameOrDottedNameSpan(this.activeFile.fileName, pos, pos);
        }
        baselineCurrentFileNameOrDottedNameSpans() {
            Harness.Baseline.runBaseline(this.testData.globalOptions["BaselineFile" /* baselineFile */], () => {
                return this.baselineCurrentFileLocations(pos => this.getNameOrDottedNameSpan(pos));
            });
        }
        printNameOrDottedNameSpans(pos) {
            Harness.IO.log(this.spanInfoToString(this.getNameOrDottedNameSpan(pos), "**"));
        }
        verifyClassifications(expected, actual, sourceFileText) {
            if (actual.length !== expected.length) {
                this.raiseError("verifyClassifications failed - expected total classifications to be " + expected.length +
                    ", but was " + actual.length +
                    jsonMismatchString());
            }
            ts.zipWith(expected, actual, (expectedClassification, actualClassification) => {
                const expectedType = expectedClassification.classificationType;
                if (expectedType !== actualClassification.classificationType) {
                    this.raiseError("verifyClassifications failed - expected classifications type to be " +
                        expectedType + ", but was " +
                        actualClassification.classificationType +
                        jsonMismatchString());
                }
                const expectedSpan = expectedClassification.textSpan;
                const actualSpan = actualClassification.textSpan;
                if (expectedSpan) {
                    const expectedLength = expectedSpan.end - expectedSpan.start;
                    if (expectedSpan.start !== actualSpan.start || expectedLength !== actualSpan.length) {
                        this.raiseError("verifyClassifications failed - expected span of text to be " +
                            "{start=" + expectedSpan.start + ", length=" + expectedLength + "}, but was " +
                            "{start=" + actualSpan.start + ", length=" + actualSpan.length + "}" +
                            jsonMismatchString());
                    }
                }
                const actualText = this.activeFile.content.substr(actualSpan.start, actualSpan.length);
                if (expectedClassification.text !== actualText) {
                    this.raiseError("verifyClassifications failed - expected classified text to be " +
                        expectedClassification.text + ", but was " +
                        actualText +
                        jsonMismatchString());
                }
            });
            function jsonMismatchString() {
                const showActual = actual.map(({ classificationType, textSpan }) => ({ classificationType, text: sourceFileText.slice(textSpan.start, textSpan.start + textSpan.length) }));
                return Harness.IO.newLine() +
                    "expected: '" + Harness.IO.newLine() + stringify(expected) + "'" + Harness.IO.newLine() +
                    "actual:   '" + Harness.IO.newLine() + stringify(showActual) + "'";
            }
        }
        verifyProjectInfo(expected) {
            if (this.testType === 3 /* Server */) {
                const actual = this.languageService.getProjectInfo(this.activeFile.fileName, 
                /* needFileNameList */ true);
                assert.equal(expected.join(","), actual.fileNames.map(file => {
                    return file.replace(this.basePath + "/", "");
                }).join(","));
            }
        }
        verifySemanticClassifications(expected) {
            const actual = this.languageService.getSemanticClassifications(this.activeFile.fileName, ts.createTextSpan(0, this.activeFile.content.length));
            this.verifyClassifications(expected, actual, this.activeFile.content);
        }
        verifySyntacticClassifications(expected) {
            const actual = this.languageService.getSyntacticClassifications(this.activeFile.fileName, ts.createTextSpan(0, this.activeFile.content.length));
            this.verifyClassifications(expected, actual, this.activeFile.content);
        }
        verifyOutliningSpans(spans) {
            const actual = this.languageService.getOutliningSpans(this.activeFile.fileName);
            if (actual.length !== spans.length) {
                this.raiseError(`verifyOutliningSpans failed - expected total spans to be ${spans.length}, but was ${actual.length}`);
            }
            ts.zipWith(spans, actual, (expectedSpan, actualSpan, i) => {
                if (expectedSpan.pos !== actualSpan.textSpan.start || expectedSpan.end !== ts.textSpanEnd(actualSpan.textSpan)) {
                    this.raiseError(`verifyOutliningSpans failed - span ${(i + 1)} expected: (${expectedSpan.pos},${expectedSpan.end}),  actual: (${actualSpan.textSpan.start},${ts.textSpanEnd(actualSpan.textSpan)})`);
                }
            });
        }
        verifyTodoComments(descriptors, spans) {
            const actual = this.languageService.getTodoComments(this.activeFile.fileName, descriptors.map(d => { return { text: d, priority: 0 }; }));
            if (actual.length !== spans.length) {
                this.raiseError(`verifyTodoComments failed - expected total spans to be ${spans.length}, but was ${actual.length}`);
            }
            ts.zipWith(spans, actual, (expectedSpan, actualComment, i) => {
                const actualCommentSpan = ts.createTextSpan(actualComment.position, actualComment.message.length);
                if (expectedSpan.pos !== actualCommentSpan.start || expectedSpan.end !== ts.textSpanEnd(actualCommentSpan)) {
                    this.raiseError(`verifyOutliningSpans failed - span ${(i + 1)} expected: (${expectedSpan.pos},${expectedSpan.end}),  actual: (${actualCommentSpan.start},${ts.textSpanEnd(actualCommentSpan)})`);
                }
            });
        }
        /**
         * Finds and applies a code action corresponding to the supplied parameters.
         * If index is undefined, applies the unique code action available.
         * @param errorCode The error code that generated the code action.
         * @param index The nth (0-index-based) codeaction available generated by errorCode.
         */
        getAndApplyCodeActions(errorCode, index) {
            const fileName = this.activeFile.fileName;
            this.applyCodeActions(this.getCodeFixes(fileName, errorCode), index);
        }
        applyCodeActionFromCompletion(markerName, options) {
            this.goToMarker(markerName);
            const details = this.getCompletionEntryDetails(options.name, options.source, options.preferences);
            if (details.codeActions.length !== 1) {
                this.raiseError(`Expected one code action, got ${details.codeActions.length}`);
            }
            if (details.codeActions[0].description !== options.description) {
                this.raiseError(`Expected description to be:\n${options.description}\ngot:\n${details.codeActions[0].description}`);
            }
            this.applyCodeActions(details.codeActions);
            this.verifyNewContent(options);
        }
        verifyRangeIs(expectedText, includeWhiteSpace) {
            const ranges = this.getRanges();
            if (ranges.length !== 1) {
                this.raiseError("Exactly one range should be specified in the testfile.");
            }
            const actualText = this.rangeText(ranges[0]);
            const result = includeWhiteSpace
                ? actualText === expectedText
                : this.removeWhitespace(actualText) === this.removeWhitespace(expectedText);
            if (!result) {
                this.raiseError(`Actual range text doesn't match expected text.\n${showTextDiff(expectedText, actualText)}`);
            }
        }
        /**
         * Compares expected text to the text that would be in the sole range
         * (ie: [|...|]) in the file after applying the codefix sole codefix
         * in the source file.
         */
        verifyRangeAfterCodeFix(expectedText, includeWhiteSpace, errorCode, index) {
            this.getAndApplyCodeActions(errorCode, index);
            this.verifyRangeIs(expectedText, includeWhiteSpace);
        }
        verifyCodeFixAll({ fixId, fixAllDescription, newFileContent, commands: expectedCommands }) {
            const fixWithId = ts.find(this.getCodeFixes(this.activeFile.fileName), a => a.fixId === fixId);
            ts.Debug.assert(fixWithId !== undefined, "No available code fix has that group id.", () => `Expected '${fixId}'. Available action ids: ${ts.mapDefined(this.getCodeFixes(this.activeFile.fileName), a => a.fixId)}`);
            ts.Debug.assertEqual(fixWithId.fixAllDescription, fixAllDescription);
            const { changes, commands } = this.languageService.getCombinedCodeFix({ type: "file", fileName: this.activeFile.fileName }, fixId, this.formatCodeSettings, ts.defaultPreferences);
            assert.deepEqual(commands, expectedCommands);
            assert(changes.every(c => c.fileName === this.activeFile.fileName), "TODO: support testing codefixes that touch multiple files");
            this.applyChanges(changes);
            this.verifyCurrentFileContent(newFileContent);
        }
        /**
         * Applies fixes for the errors in fileName and compares the results to
         * expectedContents after all fixes have been applied.
         *
         * Note: applying one codefix may generate another (eg: remove duplicate implements
         * may generate an extends -> interface conversion fix).
         * @param expectedContents The contents of the file after the fixes are applied.
         * @param fileName The file to check. If not supplied, the current open file is used.
         */
        verifyFileAfterCodeFix(expectedContents, fileName) {
            fileName = fileName ? fileName : this.activeFile.fileName;
            this.applyCodeActions(this.getCodeFixes(fileName));
            const actualContents = this.getFileContent(fileName);
            if (this.removeWhitespace(actualContents) !== this.removeWhitespace(expectedContents)) {
                this.raiseError(`Actual text doesn't match expected text. Actual:\n${actualContents}\n\nExpected:\n${expectedContents}`);
            }
        }
        verifyCodeFix(options) {
            const fileName = this.activeFile.fileName;
            const actions = this.getCodeFixes(fileName, options.errorCode, options.preferences);
            let index = options.index;
            if (index === undefined) {
                if (!(actions && actions.length === 1)) {
                    this.raiseError(`Should find exactly one codefix, but ${actions ? actions.length : "none"} found. ${actions ? actions.map(a => `${Harness.IO.newLine()} "${a.description}"`) : ""}`);
                }
                index = 0;
            }
            else {
                if (!(actions && actions.length >= index + 1)) {
                    this.raiseError(`Should find at least ${index + 1} codefix(es), but ${actions ? actions.length : "none"} found.`);
                }
            }
            const action = actions[index];
            assert.equal(action.description, options.description);
            for (const change of action.changes) {
                this.applyEdits(change.fileName, change.textChanges, /*isFormattingEdit*/ false);
            }
            this.verifyNewContent(options);
        }
        verifyNewContent(options) {
            if (options.newFileContent !== undefined) {
                assert(!options.newRangeContent);
                this.verifyCurrentFileContent(options.newFileContent);
            }
            else {
                this.verifyRangeIs(options.newRangeContent, /*includeWhitespace*/ true);
            }
        }
        /**
         * Rerieves a codefix satisfying the parameters, or undefined if no such codefix is found.
         * @param fileName Path to file where error should be retrieved from.
         */
        getCodeFixes(fileName, errorCode, preferences = ts.defaultPreferences) {
            const diagnosticsForCodeFix = this.getDiagnostics(fileName, /*includeSuggestions*/ true).map(diagnostic => ({
                start: diagnostic.start,
                length: diagnostic.length,
                code: diagnostic.code
            }));
            return ts.flatMap(ts.deduplicate(diagnosticsForCodeFix, ts.equalOwnProperties), diagnostic => {
                if (errorCode !== undefined && errorCode !== diagnostic.code) {
                    return;
                }
                return this.languageService.getCodeFixesAtPosition(fileName, diagnostic.start, diagnostic.start + diagnostic.length, [diagnostic.code], this.formatCodeSettings, preferences);
            });
        }
        applyCodeActions(actions, index) {
            if (index === undefined) {
                if (!(actions && actions.length === 1)) {
                    this.raiseError(`Should find exactly one codefix, but ${actions ? actions.length : "none"} found. ${actions ? actions.map(a => `${Harness.IO.newLine()} "${a.description}"`) : ""}`);
                }
                index = 0;
            }
            else {
                if (!(actions && actions.length >= index + 1)) {
                    this.raiseError(`Should find at least ${index + 1} codefix(es), but ${actions ? actions.length : "none"} found.`);
                }
            }
            this.applyChanges(actions[index].changes);
        }
        applyChanges(changes) {
            for (const change of changes) {
                this.applyEdits(change.fileName, change.textChanges, /*isFormattingEdit*/ false);
            }
        }
        verifyImportFixAtPosition(expectedTextArray, errorCode, preferences) {
            const { fileName } = this.activeFile;
            const ranges = this.getRanges().filter(r => r.fileName === fileName);
            if (ranges.length !== 1) {
                this.raiseError("Exactly one range should be specified in the testfile.");
            }
            const range = ts.first(ranges);
            const codeFixes = this.getCodeFixes(fileName, errorCode, preferences).filter(f => f.fixId === undefined); // TODO: GH#20315 filter out those that use the import fix ID;
            if (codeFixes.length === 0) {
                if (expectedTextArray.length !== 0) {
                    this.raiseError("No codefixes returned.");
                }
                return;
            }
            const actualTextArray = [];
            const scriptInfo = this.languageServiceAdapterHost.getScriptInfo(fileName);
            const originalContent = scriptInfo.content;
            for (const codeFix of codeFixes) {
                ts.Debug.assert(codeFix.changes.length === 1);
                const change = ts.first(codeFix.changes);
                ts.Debug.assert(change.fileName === fileName);
                this.applyEdits(change.fileName, change.textChanges, /*isFormattingEdit*/ false);
                const text = this.rangeText(range);
                actualTextArray.push(text);
                scriptInfo.updateContent(originalContent);
            }
            if (expectedTextArray.length !== actualTextArray.length) {
                this.raiseError(`Expected ${expectedTextArray.length} import fixes, got ${actualTextArray.length}`);
            }
            ts.zipWith(expectedTextArray, actualTextArray, (expected, actual, index) => {
                if (expected !== actual) {
                    this.raiseError(`Import fix at index ${index} doesn't match.\n${showTextDiff(expected, actual)}`);
                }
            });
        }
        verifyDocCommentTemplate(expected) {
            const name = "verifyDocCommentTemplate";
            const actual = this.languageService.getDocCommentTemplateAtPosition(this.activeFile.fileName, this.currentCaretPosition);
            if (expected === undefined) {
                if (actual) {
                    this.raiseError(`${name} failed - expected no template but got {newText: "${actual.newText}", caretOffset: ${actual.caretOffset}}`);
                }
                return;
            }
            else {
                if (actual === undefined) {
                    this.raiseError(`${name} failed - expected the template {newText: "${expected.newText}", caretOffset: "${expected.caretOffset}"} but got nothing instead`);
                }
                if (actual.newText !== expected.newText) {
                    this.raiseError(`${name} failed for expected insertion.\n${showTextDiff(expected.newText, actual.newText)}`);
                }
                if (actual.caretOffset !== expected.caretOffset) {
                    this.raiseError(`${name} failed - expected caretOffset: ${expected.caretOffset}\nactual caretOffset:${actual.caretOffset}`);
                }
            }
        }
        verifyBraceCompletionAtPosition(negative, openingBrace) {
            const openBraceMap = ts.createMapFromTemplate({
                "(": 40 /* openParen */,
                "{": 123 /* openBrace */,
                "[": 91 /* openBracket */,
                "'": 39 /* singleQuote */,
                '"': 34 /* doubleQuote */,
                "`": 96 /* backtick */,
                "<": 60 /* lessThan */
            });
            const charCode = openBraceMap.get(openingBrace);
            if (!charCode) {
                this.raiseError(`Invalid openingBrace '${openingBrace}' specified.`);
            }
            const position = this.currentCaretPosition;
            const validBraceCompletion = this.languageService.isValidBraceCompletionAtPosition(this.activeFile.fileName, position, charCode);
            if (!negative && !validBraceCompletion) {
                this.raiseError(`${position} is not a valid brace completion position for ${openingBrace}`);
            }
            if (negative && validBraceCompletion) {
                this.raiseError(`${position} is a valid brace completion position for ${openingBrace}`);
            }
        }
        verifyMatchingBracePosition(bracePosition, expectedMatchPosition) {
            const actual = this.languageService.getBraceMatchingAtPosition(this.activeFile.fileName, bracePosition);
            if (actual.length !== 2) {
                this.raiseError(`verifyMatchingBracePosition failed - expected result to contain 2 spans, but it had ${actual.length}`);
            }
            let actualMatchPosition = -1;
            if (bracePosition === actual[0].start) {
                actualMatchPosition = actual[1].start;
            }
            else if (bracePosition === actual[1].start) {
                actualMatchPosition = actual[0].start;
            }
            else {
                this.raiseError(`verifyMatchingBracePosition failed - could not find the brace position: ${bracePosition} in the returned list: (${actual[0].start},${ts.textSpanEnd(actual[0])}) and (${actual[1].start},${ts.textSpanEnd(actual[1])})`);
            }
            if (actualMatchPosition !== expectedMatchPosition) {
                this.raiseError(`verifyMatchingBracePosition failed - expected: ${actualMatchPosition},  actual: ${expectedMatchPosition}`);
            }
        }
        verifyNoMatchingBracePosition(bracePosition) {
            const actual = this.languageService.getBraceMatchingAtPosition(this.activeFile.fileName, bracePosition);
            if (actual.length !== 0) {
                this.raiseError("verifyNoMatchingBracePosition failed - expected: 0 spans, actual: " + actual.length);
            }
        }
        verifySpanOfEnclosingComment(negative, onlyMultiLineDiverges) {
            const expected = !negative;
            const position = this.currentCaretPosition;
            const fileName = this.activeFile.fileName;
            const actual = !!this.languageService.getSpanOfEnclosingComment(fileName, position, /*onlyMultiLine*/ false);
            const actualOnlyMultiLine = !!this.languageService.getSpanOfEnclosingComment(fileName, position, /*onlyMultiLine*/ true);
            if (expected !== actual || onlyMultiLineDiverges === (actual === actualOnlyMultiLine)) {
                this.raiseError(`verifySpanOfEnclosingComment failed:
                position: '${position}'
                fileName: '${fileName}'
                onlyMultiLineDiverges: '${onlyMultiLineDiverges}'
                actual: '${actual}'
                actualOnlyMultiLine: '${actualOnlyMultiLine}'
                expected: '${expected}'.`);
            }
        }
        /*
            Check number of navigationItems which match both searchValue and matchKind,
            if a filename is passed in, limit the results to that file.
            Report an error if expected value and actual value do not match.
        */
        verifyNavigationItemsCount(expected, searchValue, matchKind, fileName) {
            const items = this.languageService.getNavigateToItems(searchValue, /*maxResultCount*/ undefined, fileName);
            let actual = 0;
            // Count only the match that match the same MatchKind
            for (const item of items) {
                if (!matchKind || item.matchKind === matchKind) {
                    actual++;
                }
            }
            if (expected !== actual) {
                this.raiseError(`verifyNavigationItemsCount failed - found: ${actual} navigation items, expected: ${expected}.`);
            }
        }
        /*
            Verify that returned navigationItems from getNavigateToItems have matched searchValue, matchKind, and kind.
            Report an error if getNavigateToItems does not find any matched searchValue.
        */
        verifyNavigationItemsListContains(name, kind, searchValue, matchKind, fileName, parentName) {
            const items = this.languageService.getNavigateToItems(searchValue);
            if (!items || items.length === 0) {
                this.raiseError("verifyNavigationItemsListContains failed - found 0 navigation items, expected at least one.");
            }
            for (const item of items) {
                if (item && item.name === name && item.kind === kind &&
                    (matchKind === undefined || item.matchKind === matchKind) &&
                    (fileName === undefined || item.fileName === fileName) &&
                    (parentName === undefined || item.containerName === parentName)) {
                    return;
                }
            }
            // if there was an explicit match kind specified, then it should be validated.
            if (matchKind !== undefined) {
                const missingItem = { name, kind, searchValue, matchKind, fileName, parentName };
                this.raiseError(`verifyNavigationItemsListContains failed - could not find the item: ${stringify(missingItem)} in the returned list: (${stringify(items)})`);
            }
        }
        verifyNavigationBar(json, options) {
            this.verifyNavigationTreeOrBar(json, this.languageService.getNavigationBarItems(this.activeFile.fileName), "Bar", options);
        }
        verifyNavigationTree(json, options) {
            this.verifyNavigationTreeOrBar(json, this.languageService.getNavigationTree(this.activeFile.fileName), "Tree", options);
        }
        verifyNavigationTreeOrBar(json, tree, name, options) {
            if (JSON.stringify(tree, replacer) !== JSON.stringify(json)) {
                this.raiseError(`verifyNavigation${name} failed - expected: ${stringify(json)}, got: ${stringify(tree, replacer)}`);
            }
            function replacer(key, value) {
                switch (key) {
                    case "spans":
                        return options && options.checkSpans ? value : undefined;
                    case "start":
                    case "length":
                        // Never omit the values in a span, even if they are 0.
                        return value;
                    case "childItems":
                        return !value || value.length === 0 ? undefined : value;
                    default:
                        // Omit falsy values, those are presumed to be the default.
                        return value || undefined;
                }
            }
        }
        printNavigationItems(searchValue) {
            const items = this.languageService.getNavigateToItems(searchValue);
            Harness.IO.log(`NavigationItems list (${items.length} items)`);
            for (const item of items) {
                Harness.IO.log(`name: ${item.name}, kind: ${item.kind}, parentName: ${item.containerName}, fileName: ${item.fileName}`);
            }
        }
        printNavigationBar() {
            const items = this.languageService.getNavigationBarItems(this.activeFile.fileName);
            Harness.IO.log(`Navigation bar (${items.length} items)`);
            for (const item of items) {
                Harness.IO.log(`${ts.repeatString(" ", item.indent)}name: ${item.text}, kind: ${item.kind}, childItems: ${item.childItems.map(child => child.text)}`);
            }
        }
        getOccurrencesAtCurrentPosition() {
            return this.languageService.getOccurrencesAtPosition(this.activeFile.fileName, this.currentCaretPosition);
        }
        verifyOccurrencesAtPositionListContains(fileName, start, end, isWriteAccess) {
            const occurrences = this.getOccurrencesAtCurrentPosition();
            if (!occurrences || occurrences.length === 0) {
                this.raiseError("verifyOccurrencesAtPositionListContains failed - found 0 references, expected at least one.");
            }
            for (const occurrence of occurrences) {
                if (occurrence && occurrence.fileName === fileName && occurrence.textSpan.start === start && ts.textSpanEnd(occurrence.textSpan) === end) {
                    if (typeof isWriteAccess !== "undefined" && occurrence.isWriteAccess !== isWriteAccess) {
                        this.raiseError(`verifyOccurrencesAtPositionListContains failed - item isWriteAccess value does not match, actual: ${occurrence.isWriteAccess}, expected: ${isWriteAccess}.`);
                    }
                    return;
                }
            }
            const missingItem = { fileName, start, end, isWriteAccess };
            this.raiseError(`verifyOccurrencesAtPositionListContains failed - could not find the item: ${stringify(missingItem)} in the returned list: (${stringify(occurrences)})`);
        }
        verifyOccurrencesAtPositionListCount(expectedCount) {
            const occurrences = this.getOccurrencesAtCurrentPosition();
            const actualCount = occurrences ? occurrences.length : 0;
            if (expectedCount !== actualCount) {
                this.raiseError(`verifyOccurrencesAtPositionListCount failed - actual: ${actualCount}, expected:${expectedCount}`);
            }
        }
        getDocumentHighlightsAtCurrentPosition(fileNamesToSearch) {
            const filesToSearch = fileNamesToSearch.map(name => ts.combinePaths(this.basePath, name));
            return this.languageService.getDocumentHighlights(this.activeFile.fileName, this.currentCaretPosition, filesToSearch);
        }
        verifyRangesAreOccurrences(isWriteAccess) {
            const ranges = this.getRanges();
            for (const r of ranges) {
                this.goToRangeStart(r);
                this.verifyOccurrencesAtPositionListCount(ranges.length);
                for (const range of ranges) {
                    this.verifyOccurrencesAtPositionListContains(range.fileName, range.pos, range.end, isWriteAccess);
                }
            }
        }
        verifyRangesWithSameTextAreRenameLocations() {
            this.rangesByText().forEach(ranges => this.verifyRangesAreRenameLocations(ranges));
        }
        verifyRangesWithSameTextAreDocumentHighlights() {
            this.rangesByText().forEach(ranges => this.verifyRangesAreDocumentHighlights(ranges, /*options*/ undefined));
        }
        verifyDocumentHighlightsOf(startRange, ranges, options) {
            const fileNames = options && options.filesToSearch || unique(ranges, range => range.fileName);
            this.goToRangeStart(startRange);
            this.verifyDocumentHighlights(ranges, fileNames);
        }
        verifyRangesAreDocumentHighlights(ranges, options) {
            ranges = ranges || this.getRanges();
            const fileNames = options && options.filesToSearch || unique(ranges, range => range.fileName);
            for (const range of ranges) {
                this.goToRangeStart(range);
                this.verifyDocumentHighlights(ranges, fileNames);
            }
        }
        verifyNoDocumentHighlights(startRange) {
            this.goToRangeStart(startRange);
            const documentHighlights = this.getDocumentHighlightsAtCurrentPosition([this.activeFile.fileName]);
            const numHighlights = ts.length(documentHighlights);
            if (numHighlights > 0) {
                this.raiseError(`verifyNoDocumentHighlights failed - unexpectedly got ${numHighlights} highlights`);
            }
        }
        verifyDocumentHighlights(expectedRanges, fileNames = [this.activeFile.fileName]) {
            fileNames = ts.map(fileNames, ts.normalizePath);
            const documentHighlights = this.getDocumentHighlightsAtCurrentPosition(fileNames) || [];
            for (const dh of documentHighlights) {
                if (fileNames.indexOf(dh.fileName) === -1) {
                    this.raiseError(`verifyDocumentHighlights failed - got highlights in unexpected file name ${dh.fileName}`);
                }
            }
            for (const fileName of fileNames) {
                const expectedRangesInFile = expectedRanges.filter(r => ts.normalizePath(r.fileName) === fileName);
                const highlights = ts.find(documentHighlights, dh => dh.fileName === fileName);
                const spansInFile = highlights ? highlights.highlightSpans.sort((s1, s2) => s1.textSpan.start - s2.textSpan.start) : [];
                if (expectedRangesInFile.length !== spansInFile.length) {
                    this.raiseError(`verifyDocumentHighlights failed - In ${fileName}, expected ${expectedRangesInFile.length} highlights, got ${spansInFile.length}`);
                }
                ts.zipWith(expectedRangesInFile, spansInFile, (expectedRange, span) => {
                    if (span.textSpan.start !== expectedRange.pos || ts.textSpanEnd(span.textSpan) !== expectedRange.end) {
                        this.raiseError(`verifyDocumentHighlights failed - span does not match, actual: ${stringify(span.textSpan)}, expected: ${expectedRange.pos}--${expectedRange.end}`);
                    }
                });
            }
        }
        verifyCodeFixAvailable(negative, info) {
            const codeFixes = this.getCodeFixes(this.activeFile.fileName);
            if (negative) {
                if (codeFixes.length) {
                    this.raiseError(`verifyCodeFixAvailable failed - expected no fixes but found ${codeFixes.map(c => c.description)}.`);
                }
                return;
            }
            if (!codeFixes.length) {
                this.raiseError(`verifyCodeFixAvailable failed - expected code fixes but none found.`);
            }
            codeFixes.forEach(fix => fix.changes.forEach(change => {
                assert.isObject(change, `Invalid change in code fix: ${JSON.stringify(fix)}`);
                change.textChanges.forEach(textChange => assert.isObject(textChange, `Invalid textChange in codeFix: ${JSON.stringify(fix)}`));
            }));
            if (info) {
                assert.equal(info.length, codeFixes.length);
                ts.zipWith(codeFixes, info, (fix, info) => {
                    assert.equal(fix.description, info.description);
                    this.assertObjectsEqual(fix.commands, info.commands);
                });
            }
        }
        verifyApplicableRefactorAvailableAtMarker(negative, markerName) {
            const marker = this.getMarkerByName(markerName);
            const applicableRefactors = this.languageService.getApplicableRefactors(this.activeFile.fileName, marker.position, ts.defaultPreferences);
            const isAvailable = applicableRefactors && applicableRefactors.length > 0;
            if (negative && isAvailable) {
                this.raiseError(`verifyApplicableRefactorAvailableAtMarker failed - expected no refactor at marker ${markerName} but found some.`);
            }
            if (!negative && !isAvailable) {
                this.raiseError(`verifyApplicableRefactorAvailableAtMarker failed - expected a refactor at marker ${markerName} but found none.`);
            }
        }
        getSelection() {
            return {
                pos: this.currentCaretPosition,
                end: this.selectionEnd === -1 ? this.currentCaretPosition : this.selectionEnd
            };
        }
        verifyRefactorAvailable(negative, name, actionName) {
            const selection = this.getSelection();
            let refactors = this.languageService.getApplicableRefactors(this.activeFile.fileName, selection, ts.defaultPreferences) || [];
            refactors = refactors.filter(r => r.name === name && (actionName === undefined || r.actions.some(a => a.name === actionName)));
            const isAvailable = refactors.length > 0;
            if (negative) {
                if (isAvailable) {
                    this.raiseError(`verifyApplicableRefactorAvailableForRange failed - expected no refactor but found: ${refactors.map(r => r.name).join(", ")}`);
                }
            }
            else {
                if (!isAvailable) {
                    this.raiseError(`verifyApplicableRefactorAvailableForRange failed - expected a refactor but found none.`);
                }
                if (refactors.length > 1) {
                    this.raiseError(`${refactors.length} available refactors both have name ${name} and action ${actionName}`);
                }
            }
        }
        verifyRefactor({ name, actionName, refactors }) {
            const selection = this.getSelection();
            const actualRefactors = (this.languageService.getApplicableRefactors(this.activeFile.fileName, selection, ts.defaultPreferences) || ts.emptyArray)
                .filter(r => r.name === name && r.actions.some(a => a.name === actionName));
            this.assertObjectsEqual(actualRefactors, refactors);
        }
        verifyApplicableRefactorAvailableForRange(negative) {
            const ranges = this.getRanges();
            if (!(ranges && ranges.length === 1)) {
                throw new Error("Exactly one refactor range is allowed per test.");
            }
            const applicableRefactors = this.languageService.getApplicableRefactors(this.activeFile.fileName, ts.first(ranges), ts.defaultPreferences);
            const isAvailable = applicableRefactors && applicableRefactors.length > 0;
            if (negative && isAvailable) {
                this.raiseError(`verifyApplicableRefactorAvailableForRange failed - expected no refactor but found some.`);
            }
            if (!negative && !isAvailable) {
                this.raiseError(`verifyApplicableRefactorAvailableForRange failed - expected a refactor but found none.`);
            }
        }
        applyRefactor({ refactorName, actionName, actionDescription, newContent: newContentWithRenameMarker }) {
            const range = this.getSelection();
            const refactors = this.languageService.getApplicableRefactors(this.activeFile.fileName, range, ts.defaultPreferences);
            const refactorsWithName = refactors.filter(r => r.name === refactorName);
            if (refactorsWithName.length === 0) {
                this.raiseError(`The expected refactor: ${refactorName} is not available at the marker location.\nAvailable refactors: ${refactors.map(r => r.name)}`);
            }
            const action = ts.firstDefined(refactorsWithName, refactor => refactor.actions.find(a => a.name === actionName));
            if (!action) {
                this.raiseError(`The expected action: ${actionName} is not included in: ${ts.flatMap(refactorsWithName, r => r.actions.map(a => a.name))}`);
            }
            if (action.description !== actionDescription) {
                this.raiseError(`Expected action description to be ${JSON.stringify(actionDescription)}, got: ${JSON.stringify(action.description)}`);
            }
            const editInfo = this.languageService.getEditsForRefactor(this.activeFile.fileName, this.formatCodeSettings, range, refactorName, actionName, ts.defaultPreferences);
            for (const edit of editInfo.edits) {
                this.applyEdits(edit.fileName, edit.textChanges, /*isFormattingEdit*/ false);
            }
            const { renamePosition, newContent } = parseNewContent();
            this.verifyCurrentFileContent(newContent);
            if (renamePosition === undefined) {
                if (editInfo.renameLocation !== undefined) {
                    this.raiseError(`Did not expect a rename location, got ${editInfo.renameLocation}`);
                }
            }
            else {
                // TODO: test editInfo.renameFilename value
                assert.isDefined(editInfo.renameFilename);
                if (renamePosition !== editInfo.renameLocation) {
                    this.raiseError(`Expected rename position of ${renamePosition}, but got ${editInfo.renameLocation}`);
                }
            }
            function parseNewContent() {
                const renamePosition = newContentWithRenameMarker.indexOf("/*RENAME*/");
                if (renamePosition === -1) {
                    return { renamePosition: undefined, newContent: newContentWithRenameMarker };
                }
                else {
                    const newContent = newContentWithRenameMarker.slice(0, renamePosition) + newContentWithRenameMarker.slice(renamePosition + "/*RENAME*/".length);
                    return { renamePosition, newContent };
                }
            }
        }
        verifyFileAfterApplyingRefactorAtMarker(markerName, expectedContent, refactorNameToApply, actionName, formattingOptions) {
            formattingOptions = formattingOptions || this.formatCodeSettings;
            const markerPos = this.getMarkerByName(markerName).position;
            const applicableRefactors = this.languageService.getApplicableRefactors(this.activeFile.fileName, markerPos, ts.defaultPreferences);
            const applicableRefactorToApply = ts.find(applicableRefactors, refactor => refactor.name === refactorNameToApply);
            if (!applicableRefactorToApply) {
                this.raiseError(`The expected refactor: ${refactorNameToApply} is not available at the marker location.`);
            }
            const editInfo = this.languageService.getEditsForRefactor(this.activeFile.fileName, formattingOptions, markerPos, refactorNameToApply, actionName, ts.defaultPreferences);
            for (const edit of editInfo.edits) {
                this.applyEdits(edit.fileName, edit.textChanges, /*isFormattingEdit*/ false);
            }
            const actualContent = this.getFileContent(this.activeFile.fileName);
            if (actualContent !== expectedContent) {
                this.raiseError(`verifyFileAfterApplyingRefactors failed:\n${showTextDiff(expectedContent, actualContent)}`);
            }
        }
        printAvailableCodeFixes() {
            const codeFixes = this.getCodeFixes(this.activeFile.fileName);
            Harness.IO.log(stringify(codeFixes));
        }
        // Get the text of the entire line the caret is currently at
        getCurrentLineContent() {
            const text = this.getFileContent(this.activeFile.fileName);
            const pos = this.currentCaretPosition;
            let startPos = pos, endPos = pos;
            while (startPos > 0) {
                const ch = text.charCodeAt(startPos - 1);
                if (ch === 13 /* carriageReturn */ || ch === 10 /* lineFeed */) {
                    break;
                }
                startPos--;
            }
            while (endPos < text.length) {
                const ch = text.charCodeAt(endPos);
                if (ch === 13 /* carriageReturn */ || ch === 10 /* lineFeed */) {
                    break;
                }
                endPos++;
            }
            return text.substring(startPos, endPos);
        }
        assertItemInCompletionList(items, entryId, text, documentation, kind, spanIndex, hasAction, options) {
            const eq = (a, b, msg) => {
                assert.deepEqual(a, b, this.assertionMessageAtLastKnownMarker(msg + " for " + stringify(entryId)));
            };
            const matchingItems = items.filter(item => item.name === entryId.name && item.source === entryId.source);
            if (matchingItems.length === 0) {
                const itemsString = items.map(item => stringify({ name: item.name, source: item.source, kind: item.kind })).join(",\n");
                this.raiseError(`Expected "${stringify({ entryId, text, documentation, kind })}" to be in list [${itemsString}]`);
            }
            else if (matchingItems.length > 1) {
                this.raiseError(`Found duplicate completion items for ${stringify(entryId)}`);
            }
            const item = matchingItems[0];
            if (documentation !== undefined || text !== undefined || entryId.source !== undefined) {
                const details = this.getCompletionEntryDetails(item.name, item.source);
                if (documentation !== undefined) {
                    eq(ts.displayPartsToString(details.documentation), documentation, "completion item documentation");
                }
                if (text !== undefined) {
                    eq(ts.displayPartsToString(details.displayParts), text, "completion item detail text");
                }
                if (entryId.source === undefined) {
                    eq(options && options.sourceDisplay, /*b*/ undefined, "source display");
                }
                else {
                    eq(details.source, [ts.textPart(options.sourceDisplay)], "source display");
                }
            }
            if (kind !== undefined) {
                if (typeof kind === "string") {
                    eq(item.kind, kind, "completion item kind");
                }
                else {
                    if (kind.kind) {
                        eq(item.kind, kind.kind, "completion item kind");
                    }
                    if (kind.kindModifiers !== undefined) {
                        eq(item.kindModifiers, kind.kindModifiers, "completion item kindModifiers");
                    }
                }
            }
            if (spanIndex !== undefined) {
                const span = this.getTextSpanForRangeAtIndex(spanIndex);
                assert.isTrue(TestState.textSpansEqual(span, item.replacementSpan), this.assertionMessageAtLastKnownMarker(stringify(span) + " does not equal " + stringify(item.replacementSpan) + " replacement span for " + stringify(entryId)));
            }
            eq(item.hasAction, hasAction, "hasAction");
            eq(item.isRecommended, options && options.isRecommended, "isRecommended");
            eq(item.insertText, options && options.insertText, "insertText");
            eq(item.replacementSpan, options && options.replacementSpan && ts.createTextSpanFromRange(options.replacementSpan), "replacementSpan");
        }
        findFile(indexOrName) {
            if (typeof indexOrName === "number") {
                const index = indexOrName;
                if (index >= this.testData.files.length) {
                    throw new Error(`File index (${index}) in openFile was out of range. There are only ${this.testData.files.length} files in this test.`);
                }
                else {
                    return this.testData.files[index];
                }
            }
            else if (ts.isString(indexOrName)) {
                let name = ts.normalizePath(indexOrName);
                // names are stored in the compiler with this relative path, this allows people to use goTo.file on just the fileName
                name = name.indexOf("/") === -1 ? (this.basePath + "/" + name) : name;
                const availableNames = [];
                const result = ts.forEach(this.testData.files, file => {
                    const fn = ts.normalizePath(file.fileName);
                    if (fn) {
                        if (fn === name) {
                            return file;
                        }
                        availableNames.push(fn);
                    }
                });
                if (!result) {
                    throw new Error(`No test file named "${name}" exists. Available file names are: ${availableNames.join(", ")}`);
                }
                return result;
            }
            else {
                return ts.Debug.assertNever(indexOrName);
            }
        }
        getLineColStringAtPosition(position) {
            const pos = this.languageServiceAdapterHost.positionToLineAndCharacter(this.activeFile.fileName, position);
            return `line ${(pos.line + 1)}, col ${pos.character}`;
        }
        getTextSpanForRangeAtIndex(index) {
            const ranges = this.getRanges();
            if (ranges && ranges.length > index) {
                return ts.createTextSpanFromRange(ranges[index]);
            }
            else {
                this.raiseError("Supplied span index: " + index + " does not exist in range list of size: " + (ranges ? 0 : ranges.length));
            }
        }
        getMarkerByName(markerName) {
            const markerPos = this.testData.markerPositions.get(markerName);
            if (markerPos === undefined) {
                throw new Error(`Unknown marker "${markerName}" Available markers: ${this.getMarkerNames().map(m => "\"" + m + "\"").join(", ")}`);
            }
            else {
                return markerPos;
            }
        }
        setCancelled(numberOfCalls) {
            this.cancellationToken.setCancelled(numberOfCalls);
        }
        resetCancelled() {
            this.cancellationToken.resetCancelled();
        }
        static textSpansEqual(a, b) {
            return a && b && a.start === b.start && a.length === b.length;
        }
        getEditsForFileRename(options) {
            const changes = this.languageService.getEditsForFileRename(options.oldPath, options.newPath, this.formatCodeSettings);
            this.applyChanges(changes);
            for (const fileName in options.newFileContents) {
                this.openFile(fileName);
                this.verifyCurrentFileContent(options.newFileContents[fileName]);
            }
        }
    }
    FourSlash.TestState = TestState;
    function runFourSlashTest(basePath, testType, fileName) {
        const content = Harness.IO.readFile(fileName);
        runFourSlashTestContent(basePath, testType, content, fileName);
    }
    FourSlash.runFourSlashTest = runFourSlashTest;
    function runFourSlashTestContent(basePath, testType, content, fileName) {
        // Give file paths an absolute path for the virtual file system
        const absoluteBasePath = ts.combinePaths(Harness.virtualFileSystemRoot, basePath);
        const absoluteFileName = ts.combinePaths(Harness.virtualFileSystemRoot, fileName);
        // Parse out the files and their metadata
        const testData = parseTestData(absoluteBasePath, content, absoluteFileName);
        const state = new TestState(absoluteBasePath, testType, testData);
        const output = ts.transpileModule(content, { reportDiagnostics: true });
        if (output.diagnostics.length > 0) {
            throw new Error(`Syntax error in ${absoluteBasePath}: ${output.diagnostics[0].messageText}`);
        }
        runCode(output.outputText, state);
    }
    FourSlash.runFourSlashTestContent = runFourSlashTestContent;
    function runCode(code, state) {
        // Compile and execute the test
        const wrappedCode = `(function(test, goTo, verify, edit, debug, format, cancellation, classification, verifyOperationIsCancelled) {
${code}
})`;
        try {
            const test = new FourSlashInterface.Test(state);
            const goTo = new FourSlashInterface.GoTo(state);
            const verify = new FourSlashInterface.Verify(state);
            const edit = new FourSlashInterface.Edit(state);
            const debug = new FourSlashInterface.Debug(state);
            const format = new FourSlashInterface.Format(state);
            const cancellation = new FourSlashInterface.Cancellation(state);
            const f = eval(wrappedCode);
            f(test, goTo, verify, edit, debug, format, cancellation, FourSlashInterface.Classification, verifyOperationIsCancelled);
        }
        catch (err) {
            throw err;
        }
    }
    function chompLeadingSpace(content) {
        const lines = content.split("\n");
        for (const line of lines) {
            if ((line.length !== 0) && (line.charAt(0) !== " ")) {
                return content;
            }
        }
        return lines.map(s => s.substr(1)).join("\n");
    }
    function parseTestData(basePath, contents, fileName) {
        // Regex for parsing options in the format "@Alpha: Value of any sort"
        const optionRegex = /^\s*@(\w+): (.*)\s*/;
        // List of all the subfiles we've parsed out
        const files = [];
        // Global options
        const globalOptions = {};
        // Marker positions
        // Split up the input file by line
        // Note: IE JS engine incorrectly handles consecutive delimiters here when using RegExp split, so
        // we have to string-based splitting instead and try to figure out the delimiting chars
        const lines = contents.split("\n");
        const markerPositions = ts.createMap();
        const markers = [];
        const ranges = [];
        // Stuff related to the subfile we're parsing
        let currentFileContent;
        let currentFileName = fileName;
        let currentFileSymlinks;
        let currentFileOptions = {};
        function nextFile() {
            if (currentFileContent === undefined)
                return;
            const file = parseFileContent(currentFileContent, currentFileName, markerPositions, markers, ranges);
            file.fileOptions = currentFileOptions;
            file.symlinks = currentFileSymlinks;
            // Store result file
            files.push(file);
            currentFileContent = undefined;
            currentFileOptions = {};
            currentFileName = fileName;
            currentFileSymlinks = undefined;
        }
        for (let line of lines) {
            if (line.length > 0 && line.charAt(line.length - 1) === "\r") {
                line = line.substr(0, line.length - 1);
            }
            if (line.substr(0, 4) === "////") {
                const text = line.substr(4);
                currentFileContent = currentFileContent === undefined ? text : currentFileContent + "\n" + text;
            }
            else if (line.substr(0, 2) === "//") {
                // Comment line, check for global/file @options and record them
                const match = optionRegex.exec(line.substr(2));
                if (match) {
                    const [key, value] = match.slice(1);
                    if (!ts.contains(fileMetadataNames, key)) {
                        // Check if the match is already existed in the global options
                        if (globalOptions[key] !== undefined) {
                            throw new Error(`Global option '${key}' already exists`);
                        }
                        globalOptions[key] = value;
                    }
                    else {
                        switch (key) {
                            case "Filename" /* fileName */:
                                // Found an @FileName directive, if this is not the first then create a new subfile
                                nextFile();
                                currentFileName = ts.isRootedDiskPath(value) ? value : basePath + "/" + value;
                                currentFileOptions[key] = value;
                                break;
                            case "Symlink" /* symlink */:
                                currentFileSymlinks = ts.append(currentFileSymlinks, value);
                                break;
                            default:
                                // Add other fileMetadata flag
                                currentFileOptions[key] = value;
                        }
                    }
                }
            }
            // Previously blank lines between fourslash content caused it to be considered as 2 files,
            // Remove this behavior since it just causes errors now
            else if (line !== "") {
                // Code line, terminate current subfile if there is one
                nextFile();
            }
        }
        // @Filename is the only directive that can be used in a test that contains tsconfig.json file.
        const config = ts.find(files, isConfig);
        if (config) {
            let directive = getNonFileNameOptionInFileList(files);
            if (!directive) {
                directive = getNonFileNameOptionInObject(globalOptions);
            }
            if (directive) {
                throw Error(`It is not allowed to use ${config.fileName} along with directive '${directive}'`);
            }
        }
        return {
            markerPositions,
            markers,
            globalOptions,
            files,
            ranges
        };
    }
    function isConfig(file) {
        return Harness.getConfigNameFromFileName(file.fileName) !== undefined;
    }
    function getNonFileNameOptionInFileList(files) {
        return ts.forEach(files, f => getNonFileNameOptionInObject(f.fileOptions));
    }
    function getNonFileNameOptionInObject(optionObject) {
        for (const option in optionObject) {
            if (option !== "Filename" /* fileName */) {
                return option;
            }
        }
        return undefined;
    }
    function reportError(fileName, line, col, message) {
        const errorMessage = fileName + "(" + line + "," + col + "): " + message;
        throw new Error(errorMessage);
    }
    function recordObjectMarker(fileName, location, text, markerMap, markers) {
        let markerValue;
        try {
            // Attempt to parse the marker value as JSON
            markerValue = JSON.parse("{ " + text + " }");
        }
        catch (e) {
            reportError(fileName, location.sourceLine, location.sourceColumn, "Unable to parse marker text " + e.message);
        }
        if (markerValue === undefined) {
            reportError(fileName, location.sourceLine, location.sourceColumn, "Object markers can not be empty");
            return undefined;
        }
        const marker = {
            fileName,
            position: location.position,
            data: markerValue
        };
        // Object markers can be anonymous
        if (markerValue.name) {
            markerMap.set(markerValue.name, marker);
        }
        markers.push(marker);
        return marker;
    }
    function recordMarker(fileName, location, name, markerMap, markers) {
        const marker = {
            fileName,
            position: location.position
        };
        // Verify markers for uniqueness
        if (markerMap.has(name)) {
            const message = "Marker '" + name + "' is duplicated in the source file contents.";
            reportError(marker.fileName, location.sourceLine, location.sourceColumn, message);
            return undefined;
        }
        else {
            markerMap.set(name, marker);
            markers.push(marker);
            return marker;
        }
    }
    function parseFileContent(content, fileName, markerMap, markers, ranges) {
        content = chompLeadingSpace(content);
        // Any slash-star comment with a character not in this string is not a marker.
        const validMarkerChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz$1234567890_";
        /// The file content (minus metacharacters) so far
        let output = "";
        /// The current marker (or maybe multi-line comment?) we're parsing, possibly
        let openMarker;
        /// A stack of the open range markers that are still unclosed
        const openRanges = [];
        /// A list of ranges we've collected so far */
        let localRanges = [];
        /// The latest position of the start of an unflushed plain text area
        let lastNormalCharPosition = 0;
        /// The total number of metacharacters removed from the file (so far)
        let difference = 0;
        /// The fourslash file state object we are generating
        let state = 0 /* none */;
        /// Current position data
        let line = 1;
        let column = 1;
        const flush = (lastSafeCharIndex) => {
            output = output + content.substr(lastNormalCharPosition, lastSafeCharIndex === undefined ? undefined : lastSafeCharIndex - lastNormalCharPosition);
        };
        if (content.length > 0) {
            let previousChar = content.charAt(0);
            for (let i = 1; i < content.length; i++) {
                const currentChar = content.charAt(i);
                switch (state) {
                    case 0 /* none */:
                        if (previousChar === "[" && currentChar === "|") {
                            // found a range start
                            openRanges.push({
                                position: (i - 1) - difference,
                                sourcePosition: i - 1,
                                sourceLine: line,
                                sourceColumn: column,
                            });
                            // copy all text up to marker position
                            flush(i - 1);
                            lastNormalCharPosition = i + 1;
                            difference += 2;
                        }
                        else if (previousChar === "|" && currentChar === "]") {
                            // found a range end
                            const rangeStart = openRanges.pop();
                            if (!rangeStart) {
                                reportError(fileName, line, column, "Found range end with no matching start.");
                            }
                            const range = {
                                fileName,
                                pos: rangeStart.position,
                                end: (i - 1) - difference,
                                marker: rangeStart.marker
                            };
                            localRanges.push(range);
                            // copy all text up to range marker position
                            flush(i - 1);
                            lastNormalCharPosition = i + 1;
                            difference += 2;
                        }
                        else if (previousChar === "/" && currentChar === "*") {
                            // found a possible marker start
                            state = 1 /* inSlashStarMarker */;
                            openMarker = {
                                position: (i - 1) - difference,
                                sourcePosition: i - 1,
                                sourceLine: line,
                                sourceColumn: column,
                            };
                        }
                        else if (previousChar === "{" && currentChar === "|") {
                            // found an object marker start
                            state = 2 /* inObjectMarker */;
                            openMarker = {
                                position: (i - 1) - difference,
                                sourcePosition: i - 1,
                                sourceLine: line,
                                sourceColumn: column,
                            };
                            flush(i - 1);
                        }
                        break;
                    case 2 /* inObjectMarker */:
                        // Object markers are only ever terminated by |} and have no content restrictions
                        if (previousChar === "|" && currentChar === "}") {
                            // Record the marker
                            const objectMarkerNameText = content.substring(openMarker.sourcePosition + 2, i - 1).trim();
                            const marker = recordObjectMarker(fileName, openMarker, objectMarkerNameText, markerMap, markers);
                            if (openRanges.length > 0) {
                                openRanges[openRanges.length - 1].marker = marker;
                            }
                            // Set the current start to point to the end of the current marker to ignore its text
                            lastNormalCharPosition = i + 1;
                            difference += i + 1 - openMarker.sourcePosition;
                            // Reset the state
                            openMarker = undefined;
                            state = 0 /* none */;
                        }
                        break;
                    case 1 /* inSlashStarMarker */:
                        if (previousChar === "*" && currentChar === "/") {
                            // Record the marker
                            // start + 2 to ignore the */, -1 on the end to ignore the * (/ is next)
                            const markerNameText = content.substring(openMarker.sourcePosition + 2, i - 1).trim();
                            const marker = recordMarker(fileName, openMarker, markerNameText, markerMap, markers);
                            if (openRanges.length > 0) {
                                openRanges[openRanges.length - 1].marker = marker;
                            }
                            // Set the current start to point to the end of the current marker to ignore its text
                            flush(openMarker.sourcePosition);
                            lastNormalCharPosition = i + 1;
                            difference += i + 1 - openMarker.sourcePosition;
                            // Reset the state
                            openMarker = undefined;
                            state = 0 /* none */;
                        }
                        else if (validMarkerChars.indexOf(currentChar) < 0) {
                            if (currentChar === "*" && i < content.length - 1 && content.charAt(i + 1) === "/") {
                                // The marker is about to be closed, ignore the 'invalid' char
                            }
                            else {
                                // We've hit a non-valid marker character, so we were actually in a block comment
                                // Bail out the text we've gathered so far back into the output
                                flush(i);
                                lastNormalCharPosition = i;
                                openMarker = undefined;
                                state = 0 /* none */;
                            }
                        }
                        break;
                }
                if (currentChar === "\n" && previousChar === "\r") {
                    // Ignore trailing \n after a \r
                    continue;
                }
                else if (currentChar === "\n" || currentChar === "\r") {
                    line++;
                    column = 1;
                    continue;
                }
                column++;
                previousChar = currentChar;
            }
        }
        // Add the remaining text
        flush(/*lastSafeCharIndex*/ undefined);
        if (openRanges.length > 0) {
            const openRange = openRanges[0];
            reportError(fileName, openRange.sourceLine, openRange.sourceColumn, "Unterminated range.");
        }
        if (openMarker) {
            reportError(fileName, openMarker.sourceLine, openMarker.sourceColumn, "Unterminated marker.");
        }
        // put ranges in the correct order
        localRanges = localRanges.sort((a, b) => a.pos < b.pos ? -1 : 1);
        localRanges.forEach((r) => { ranges.push(r); });
        return {
            content: output,
            fileOptions: {},
            version: 0,
            fileName,
        };
    }
    function stringify(data, replacer) {
        return JSON.stringify(data, replacer, 2);
    }
    /** Collects an array of unique outputs. */
    function unique(inputs, getOutput) {
        const set = ts.createMap();
        for (const input of inputs) {
            const out = getOutput(input);
            set.set(out, true);
        }
        return ts.arrayFrom(set.keys());
    }
    function toArray(x) {
        return ts.isArray(x) ? x : [x];
    }
    function makeWhitespaceVisible(text) {
        return text.replace(/ /g, "\u00B7").replace(/\r/g, "\u00B6").replace(/\n/g, "\u2193\n").replace(/\t/g, "\u2192\   ");
    }
    function showTextDiff(expected, actual) {
        // Only show whitespace if the difference is whitespace-only.
        if (differOnlyByWhitespace(expected, actual)) {
            expected = makeWhitespaceVisible(expected);
            actual = makeWhitespaceVisible(actual);
        }
        return `Expected:\n${expected}\nActual:\n${actual}`;
    }
    function differOnlyByWhitespace(a, b) {
        return stripWhitespace(a) === stripWhitespace(b);
    }
    function stripWhitespace(s) {
        return s.replace(/\s/g, "");
    }
    function findDuplicatedElement(a, equal) {
        for (let i = 0; i < a.length; i++) {
            for (let j = i + 1; j < a.length; j++) {
                if (equal(a[i], a[j])) {
                    return a[i];
                }
            }
        }
    }
})(FourSlash || (FourSlash = {}));
var FourSlashInterface;
(function (FourSlashInterface) {
    class Test {
        constructor(state) {
            this.state = state;
        }
        markers() {
            return this.state.getMarkers();
        }
        markerNames() {
            return this.state.getMarkerNames();
        }
        marker(name) {
            return this.state.getMarkerByName(name);
        }
        markerName(m) {
            return this.state.markerName(m);
        }
        ranges() {
            return this.state.getRanges();
        }
        spans() {
            return this.ranges().map(r => ts.createTextSpan(r.pos, r.end - r.pos));
        }
        rangesByText() {
            return this.state.rangesByText();
        }
        markerByName(s) {
            return this.state.getMarkerByName(s);
        }
        symbolsInScope(range) {
            return this.state.symbolsInScope(range);
        }
        setTypesRegistry(map) {
            this.state.setTypesRegistry(map);
        }
    }
    FourSlashInterface.Test = Test;
    class GoTo {
        constructor(state) {
            this.state = state;
        }
        // Moves the caret to the specified marker,
        // or the anonymous marker ('/**/') if no name
        // is given
        marker(name) {
            this.state.goToMarker(name);
        }
        eachMarker(a, b) {
            const markers = typeof a === "function" ? this.state.getMarkers() : a.map(m => this.state.getMarkerByName(m));
            this.state.goToEachMarker(markers, typeof a === "function" ? a : b);
        }
        rangeStart(range) {
            this.state.goToRangeStart(range);
        }
        eachRange(action) {
            this.state.goToEachRange(action);
        }
        bof() {
            this.state.goToBOF();
        }
        eof() {
            this.state.goToEOF();
        }
        implementation() {
            this.state.goToImplementation();
        }
        position(position, fileNameOrIndex) {
            if (fileNameOrIndex !== undefined) {
                this.file(fileNameOrIndex);
            }
            this.state.goToPosition(position);
        }
        // Opens a file, given either its index as it
        // appears in the test source, or its filename
        // as specified in the test metadata
        file(indexOrName, content, scriptKindName) {
            this.state.openFile(indexOrName, content, scriptKindName);
        }
        select(startMarker, endMarker) {
            this.state.select(startMarker, endMarker);
        }
        selectRange(range) {
            this.state.selectRange(range);
        }
    }
    FourSlashInterface.GoTo = GoTo;
    class VerifyNegatable {
        constructor(state, negative = false) {
            this.state = state;
            this.negative = negative;
            this.allowedClassElementKeywords = [
                "public",
                "private",
                "protected",
                "static",
                "abstract",
                "readonly",
                "get",
                "set",
                "constructor",
                "async"
            ];
            this.allowedConstructorParameterKeywords = [
                "public",
                "private",
                "protected",
                "readonly",
            ];
            if (!negative) {
                this.not = new VerifyNegatable(state, true);
            }
        }
        completionListCount(expectedCount) {
            this.state.verifyCompletionListCount(expectedCount, this.negative);
        }
        // Verifies the completion list contains the specified symbol. The
        // completion list is brought up if necessary
        completionListContains(entryId, text, documentation, kind, spanIndex, hasAction, options) {
            if (typeof entryId === "string") {
                entryId = { name: entryId, source: undefined };
            }
            if (this.negative) {
                this.state.verifyCompletionListDoesNotContain(entryId, text, documentation, kind, spanIndex, options);
            }
            else {
                this.state.verifyCompletionListContains(entryId, text, documentation, kind, spanIndex, hasAction, options);
            }
        }
        // Verifies the completion list items count to be greater than the specified amount. The
        // completion list is brought up if necessary
        completionListItemsCountIsGreaterThan(count) {
            this.state.verifyCompletionListItemsCountIsGreaterThan(count, this.negative);
        }
        assertHasRanges(ranges) {
            assert(ranges.length !== 0, "Array of ranges is expected to be non-empty");
        }
        completionListIsEmpty() {
            this.state.verifyCompletionListIsEmpty(this.negative);
        }
        completionListContainsClassElementKeywords() {
            for (const keyword of this.allowedClassElementKeywords) {
                this.completionListContains(keyword, keyword, /*documentation*/ undefined, "keyword");
            }
        }
        completionListContainsConstructorParameterKeywords() {
            for (const keyword of this.allowedConstructorParameterKeywords) {
                this.completionListContains(keyword, keyword, /*documentation*/ undefined, "keyword");
            }
        }
        completionListIsGlobal(expected) {
            this.state.verifyCompletionListIsGlobal(expected);
        }
        completionListAllowsNewIdentifier() {
            this.state.verifyCompletionListAllowsNewIdentifier(this.negative);
        }
        signatureHelpPresent() {
            this.state.verifySignatureHelpPresent(!this.negative);
        }
        errorExistsBetweenMarkers(startMarker, endMarker) {
            this.state.verifyErrorExistsBetweenMarkers(startMarker, endMarker, !this.negative);
        }
        errorExistsAfterMarker(markerName = "") {
            this.state.verifyErrorExistsAfterMarker(markerName, !this.negative, /*after*/ true);
        }
        errorExistsBeforeMarker(markerName = "") {
            this.state.verifyErrorExistsAfterMarker(markerName, !this.negative, /*after*/ false);
        }
        quickInfoExists() {
            this.state.verifyQuickInfoExists(this.negative);
        }
        typeDefinitionCountIs(expectedCount) {
            this.state.verifyTypeDefinitionsCount(this.negative, expectedCount);
        }
        implementationListIsEmpty() {
            this.state.verifyImplementationListIsEmpty(this.negative);
        }
        isValidBraceCompletionAtPosition(openingBrace) {
            this.state.verifyBraceCompletionAtPosition(this.negative, openingBrace);
        }
        isInCommentAtPosition(onlyMultiLineDiverges) {
            this.state.verifySpanOfEnclosingComment(this.negative, onlyMultiLineDiverges);
        }
        codeFix(options) {
            this.state.verifyCodeFix(options);
        }
        codeFixAvailable(options) {
            this.state.verifyCodeFixAvailable(this.negative, options);
        }
        applicableRefactorAvailableAtMarker(markerName) {
            this.state.verifyApplicableRefactorAvailableAtMarker(this.negative, markerName);
        }
        applicableRefactorAvailableForRange() {
            this.state.verifyApplicableRefactorAvailableForRange(this.negative);
        }
        refactor(options) {
            this.state.verifyRefactor(options);
        }
        refactorAvailable(name, actionName) {
            this.state.verifyRefactorAvailable(this.negative, name, actionName);
        }
    }
    FourSlashInterface.VerifyNegatable = VerifyNegatable;
    class Verify extends VerifyNegatable {
        constructor(state) {
            super(state);
        }
        completionsAt(markerName, completions, options) {
            this.state.verifyCompletionsAt(markerName, completions, options);
        }
        quickInfoIs(expectedText, expectedDocumentation) {
            this.state.verifyQuickInfoString(expectedText, expectedDocumentation);
        }
        quickInfoAt(markerName, expectedText, expectedDocumentation) {
            this.state.verifyQuickInfoAt(markerName, expectedText, expectedDocumentation);
        }
        quickInfos(namesAndTexts) {
            this.state.verifyQuickInfos(namesAndTexts);
        }
        caretAtMarker(markerName) {
            this.state.verifyCaretAtMarker(markerName);
        }
        indentationIs(numberOfSpaces) {
            this.state.verifyIndentationAtCurrentPosition(numberOfSpaces);
        }
        indentationAtPositionIs(fileName, position, numberOfSpaces, indentStyle = ts.IndentStyle.Smart, baseIndentSize = 0) {
            this.state.verifyIndentationAtPosition(fileName, position, numberOfSpaces, indentStyle, baseIndentSize);
        }
        textAtCaretIs(text) {
            this.state.verifyTextAtCaretIs(text);
        }
        /**
         * Compiles the current file and evaluates 'expr' in a context containing
         * the emitted output, then compares (using ===) the result of that expression
         * to 'value'. Do not use this function with external modules as it is not supported.
         */
        eval(expr, value) {
            this.state.verifyEval(expr, value);
        }
        currentLineContentIs(text) {
            this.state.verifyCurrentLineContent(text);
        }
        currentFileContentIs(text) {
            this.state.verifyCurrentFileContent(text);
        }
        goToDefinitionIs(endMarkers) {
            this.state.verifyGoToDefinitionIs(endMarkers);
        }
        goToDefinition(arg0, endMarkerName) {
            this.state.verifyGoToDefinition(arg0, endMarkerName);
        }
        goToType(arg0, endMarkerName) {
            this.state.verifyGoToType(arg0, endMarkerName);
        }
        goToDefinitionForMarkers(...markerNames) {
            this.state.verifyGoToDefinitionForMarkers(markerNames);
        }
        goToDefinitionName(name, containerName) {
            this.state.verifyGoToDefinitionName(name, containerName);
        }
        verifyGetEmitOutputForCurrentFile(expected) {
            this.state.verifyGetEmitOutputForCurrentFile(expected);
        }
        verifyGetEmitOutputContentsForCurrentFile(expected) {
            this.state.verifyGetEmitOutputContentsForCurrentFile(expected);
        }
        symbolAtLocation(startRange, ...declarationRanges) {
            this.state.verifySymbolAtLocation(startRange, declarationRanges);
        }
        typeOfSymbolAtLocation(range, symbol, expected) {
            this.state.verifyTypeOfSymbolAtLocation(range, symbol, expected);
        }
        referencesOf(start, references) {
            this.state.verifyReferencesOf(start, references);
        }
        referenceGroups(starts, parts) {
            this.state.verifyReferenceGroups(starts, parts);
        }
        noReferences(markerNameOrRange) {
            this.state.verifyNoReferences(markerNameOrRange);
        }
        singleReferenceGroup(definition, ranges) {
            this.state.verifySingleReferenceGroup(definition, ranges);
        }
        rangesReferenceEachOther(ranges) {
            this.state.verifyRangesReferenceEachOther(ranges);
        }
        findReferencesDefinitionDisplayPartsAtCaretAre(expected) {
            this.state.verifyDisplayPartsOfReferencedSymbol(expected);
        }
        currentParameterHelpArgumentNameIs(name) {
            this.state.verifyCurrentParameterHelpName(name);
        }
        currentParameterSpanIs(parameter) {
            this.state.verifyCurrentParameterSpanIs(parameter);
        }
        currentParameterHelpArgumentDocCommentIs(docComment) {
            this.state.verifyCurrentParameterHelpDocComment(docComment);
        }
        currentSignatureHelpDocCommentIs(docComment) {
            this.state.verifyCurrentSignatureHelpDocComment(docComment);
        }
        currentSignatureHelpTagsAre(tags) {
            this.state.verifyCurrentSignatureHelpTags(tags);
        }
        signatureHelpCountIs(expected) {
            this.state.verifySignatureHelpCount(expected);
        }
        signatureHelpCurrentArgumentListIsVariadic(expected) {
            this.state.verifyCurrentSignatureHelpIsVariadic(expected);
        }
        signatureHelpArgumentCountIs(expected) {
            this.state.verifySignatureHelpArgumentCount(expected);
        }
        currentSignatureParameterCountIs(expected) {
            this.state.verifyCurrentSignatureHelpParameterCount(expected);
        }
        currentSignatureHelpIs(expected) {
            this.state.verifyCurrentSignatureHelpIs(expected);
        }
        noErrors() {
            this.state.verifyNoErrors();
        }
        numberOfErrorsInCurrentFile(expected) {
            this.state.verifyNumberOfErrorsInCurrentFile(expected);
        }
        baselineCurrentFileBreakpointLocations() {
            this.state.baselineCurrentFileBreakpointLocations();
        }
        baselineCurrentFileNameOrDottedNameSpans() {
            this.state.baselineCurrentFileNameOrDottedNameSpans();
        }
        baselineGetEmitOutput(insertResultsIntoVfs) {
            this.state.baselineGetEmitOutput(insertResultsIntoVfs);
        }
        baselineQuickInfo() {
            this.state.baselineQuickInfo();
        }
        nameOrDottedNameSpanTextIs(text) {
            this.state.verifyCurrentNameOrDottedNameSpanText(text);
        }
        outliningSpansInCurrentFile(spans) {
            this.state.verifyOutliningSpans(spans);
        }
        todoCommentsInCurrentFile(descriptors) {
            this.state.verifyTodoComments(descriptors, this.state.getRanges());
        }
        matchingBracePositionInCurrentFile(bracePosition, expectedMatchPosition) {
            this.state.verifyMatchingBracePosition(bracePosition, expectedMatchPosition);
        }
        noMatchingBracePositionInCurrentFile(bracePosition) {
            this.state.verifyNoMatchingBracePosition(bracePosition);
        }
        docCommentTemplateAt(marker, expectedOffset, expectedText) {
            this.state.goToMarker(marker);
            this.state.verifyDocCommentTemplate({ newText: expectedText.replace(/\r?\n/g, "\r\n"), caretOffset: expectedOffset });
        }
        noDocCommentTemplateAt(marker) {
            this.state.goToMarker(marker);
            this.state.verifyDocCommentTemplate(/*expected*/ undefined);
        }
        rangeAfterCodeFix(expectedText, includeWhiteSpace, errorCode, index) {
            this.state.verifyRangeAfterCodeFix(expectedText, includeWhiteSpace, errorCode, index);
        }
        codeFixAll(options) {
            this.state.verifyCodeFixAll(options);
        }
        fileAfterApplyingRefactorAtMarker(markerName, expectedContent, refactorNameToApply, actionName, formattingOptions) {
            this.state.verifyFileAfterApplyingRefactorAtMarker(markerName, expectedContent, refactorNameToApply, actionName, formattingOptions);
        }
        rangeIs(expectedText, includeWhiteSpace) {
            this.state.verifyRangeIs(expectedText, includeWhiteSpace);
        }
        getAndApplyCodeFix(errorCode, index) {
            this.state.getAndApplyCodeActions(errorCode, index);
        }
        applyCodeActionFromCompletion(markerName, options) {
            this.state.applyCodeActionFromCompletion(markerName, options);
        }
        importFixAtPosition(expectedTextArray, errorCode, preferences) {
            this.state.verifyImportFixAtPosition(expectedTextArray, errorCode, preferences);
        }
        navigationBar(json, options) {
            this.state.verifyNavigationBar(json, options);
        }
        navigationTree(json, options) {
            this.state.verifyNavigationTree(json, options);
        }
        navigationItemsListCount(count, searchValue, matchKind, fileName) {
            this.state.verifyNavigationItemsCount(count, searchValue, matchKind, fileName);
        }
        navigationItemsListContains(name, kind, searchValue, matchKind, fileName, parentName) {
            this.state.verifyNavigationItemsListContains(name, kind, searchValue, matchKind, fileName, parentName);
        }
        occurrencesAtPositionContains(range, isWriteAccess) {
            this.state.verifyOccurrencesAtPositionListContains(range.fileName, range.pos, range.end, isWriteAccess);
        }
        occurrencesAtPositionCount(expectedCount) {
            this.state.verifyOccurrencesAtPositionListCount(expectedCount);
        }
        rangesAreOccurrences(isWriteAccess) {
            this.state.verifyRangesAreOccurrences(isWriteAccess);
        }
        rangesWithSameTextAreRenameLocations() {
            this.state.verifyRangesWithSameTextAreRenameLocations();
        }
        rangesAreRenameLocations(options) {
            this.state.verifyRangesAreRenameLocations(options);
        }
        rangesAreDocumentHighlights(ranges, options) {
            this.state.verifyRangesAreDocumentHighlights(ranges, options);
        }
        rangesWithSameTextAreDocumentHighlights() {
            this.state.verifyRangesWithSameTextAreDocumentHighlights();
        }
        documentHighlightsOf(startRange, ranges, options) {
            this.state.verifyDocumentHighlightsOf(startRange, ranges, options);
        }
        noDocumentHighlights(startRange) {
            this.state.verifyNoDocumentHighlights(startRange);
        }
        completionEntryDetailIs(entryName, text, documentation, kind, tags) {
            this.state.verifyCompletionEntryDetails(entryName, text, documentation, kind, tags);
        }
        /**
         * This method *requires* a contiguous, complete, and ordered stream of classifications for a file.
         */
        syntacticClassificationsAre(...classifications) {
            this.state.verifySyntacticClassifications(classifications);
        }
        /**
         * This method *requires* an ordered stream of classifications for a file, and spans are highly recommended.
         */
        semanticClassificationsAre(...classifications) {
            this.state.verifySemanticClassifications(classifications);
        }
        renameInfoSucceeded(displayName, fullDisplayName, kind, kindModifiers) {
            this.state.verifyRenameInfoSucceeded(displayName, fullDisplayName, kind, kindModifiers);
        }
        renameInfoFailed(message) {
            this.state.verifyRenameInfoFailed(message);
        }
        renameLocations(startRanges, options) {
            this.state.verifyRenameLocations(startRanges, options);
        }
        verifyQuickInfoDisplayParts(kind, kindModifiers, textSpan, displayParts, documentation, tags) {
            this.state.verifyQuickInfoDisplayParts(kind, kindModifiers, textSpan, displayParts, documentation, tags);
        }
        getSyntacticDiagnostics(expected) {
            this.state.getSyntacticDiagnostics(expected);
        }
        getSemanticDiagnostics(expected) {
            this.state.getSemanticDiagnostics(expected);
        }
        getSuggestionDiagnostics(expected) {
            this.state.getSuggestionDiagnostics(expected);
        }
        ProjectInfo(expected) {
            this.state.verifyProjectInfo(expected);
        }
        allRangesAppearInImplementationList(markerName) {
            this.state.verifyRangesInImplementationList(markerName);
        }
        getEditsForFileRename(options) {
            this.state.getEditsForFileRename(options);
        }
    }
    FourSlashInterface.Verify = Verify;
    class Edit {
        constructor(state) {
            this.state = state;
        }
        backspace(count) {
            this.state.deleteCharBehindMarker(count);
        }
        deleteAtCaret(times) {
            this.state.deleteChar(times);
        }
        replace(start, length, text) {
            this.state.replace(start, length, text);
        }
        paste(text) {
            this.state.paste(text);
        }
        insert(text) {
            this.insertLines(text);
        }
        insertLine(text) {
            this.insertLines(text + "\n");
        }
        insertLines(...lines) {
            this.state.type(lines.join("\n"));
        }
        moveRight(count) {
            this.state.moveCaretRight(count);
        }
        moveLeft(count) {
            if (typeof count === "undefined") {
                count = 1;
            }
            this.state.moveCaretRight(count * -1);
        }
        enableFormatting() {
            this.state.enableFormatting = true;
        }
        disableFormatting() {
            this.state.enableFormatting = false;
        }
        applyRefactor(options) {
            this.state.applyRefactor(options);
        }
    }
    FourSlashInterface.Edit = Edit;
    class Debug {
        constructor(state) {
            this.state = state;
        }
        printCurrentParameterHelp() {
            this.state.printCurrentParameterHelp();
        }
        printCurrentFileState() {
            this.state.printCurrentFileState(/*showWhitespace*/ false, /*makeCaretVisible*/ true);
        }
        printCurrentFileStateWithWhitespace() {
            this.state.printCurrentFileState(/*showWhitespace*/ true, /*makeCaretVisible*/ true);
        }
        printCurrentFileStateWithoutCaret() {
            this.state.printCurrentFileState(/*showWhitespace*/ false, /*makeCaretVisible*/ false);
        }
        printCurrentQuickInfo() {
            this.state.printCurrentQuickInfo();
        }
        printCurrentSignatureHelp() {
            this.state.printCurrentSignatureHelp();
        }
        printCompletionListMembers(options) {
            this.state.printCompletionListMembers(options);
        }
        printAvailableCodeFixes() {
            this.state.printAvailableCodeFixes();
        }
        printBreakpointLocation(pos) {
            this.state.printBreakpointLocation(pos);
        }
        printBreakpointAtCurrentLocation() {
            this.state.printBreakpointAtCurrentLocation();
        }
        printNameOrDottedNameSpans(pos) {
            this.state.printNameOrDottedNameSpans(pos);
        }
        printErrorList() {
            this.state.printErrorList();
        }
        printNavigationItems(searchValue = ".*") {
            this.state.printNavigationItems(searchValue);
        }
        printNavigationBar() {
            this.state.printNavigationBar();
        }
        printContext() {
            this.state.printContext();
        }
    }
    FourSlashInterface.Debug = Debug;
    class Format {
        constructor(state) {
            this.state = state;
        }
        document() {
            this.state.formatDocument();
        }
        copyFormatOptions() {
            return this.state.copyFormatOptions();
        }
        setFormatOptions(options) {
            return this.state.setFormatOptions(options);
        }
        selection(startMarker, endMarker) {
            this.state.formatSelection(this.state.getMarkerByName(startMarker).position, this.state.getMarkerByName(endMarker).position);
        }
        onType(posMarker, key) {
            this.state.formatOnType(this.state.getMarkerByName(posMarker).position, key);
        }
        setOption(name, value) {
            this.state.formatCodeSettings[name] = value;
        }
    }
    FourSlashInterface.Format = Format;
    class Cancellation {
        constructor(state) {
            this.state = state;
        }
        resetCancelled() {
            this.state.resetCancelled();
        }
        setCancelled(numberOfCalls = 0) {
            this.state.setCancelled(numberOfCalls);
        }
    }
    FourSlashInterface.Cancellation = Cancellation;
    let Classification;
    (function (Classification) {
        function comment(text, position) {
            return getClassification(ts.ClassificationTypeNames.comment, text, position);
        }
        Classification.comment = comment;
        function identifier(text, position) {
            return getClassification(ts.ClassificationTypeNames.identifier, text, position);
        }
        Classification.identifier = identifier;
        function keyword(text, position) {
            return getClassification(ts.ClassificationTypeNames.keyword, text, position);
        }
        Classification.keyword = keyword;
        function numericLiteral(text, position) {
            return getClassification(ts.ClassificationTypeNames.numericLiteral, text, position);
        }
        Classification.numericLiteral = numericLiteral;
        function operator(text, position) {
            return getClassification(ts.ClassificationTypeNames.operator, text, position);
        }
        Classification.operator = operator;
        function stringLiteral(text, position) {
            return getClassification(ts.ClassificationTypeNames.stringLiteral, text, position);
        }
        Classification.stringLiteral = stringLiteral;
        function whiteSpace(text, position) {
            return getClassification(ts.ClassificationTypeNames.whiteSpace, text, position);
        }
        Classification.whiteSpace = whiteSpace;
        function text(text, position) {
            return getClassification(ts.ClassificationTypeNames.text, text, position);
        }
        Classification.text = text;
        function punctuation(text, position) {
            return getClassification(ts.ClassificationTypeNames.punctuation, text, position);
        }
        Classification.punctuation = punctuation;
        function docCommentTagName(text, position) {
            return getClassification(ts.ClassificationTypeNames.docCommentTagName, text, position);
        }
        Classification.docCommentTagName = docCommentTagName;
        function className(text, position) {
            return getClassification(ts.ClassificationTypeNames.className, text, position);
        }
        Classification.className = className;
        function enumName(text, position) {
            return getClassification(ts.ClassificationTypeNames.enumName, text, position);
        }
        Classification.enumName = enumName;
        function interfaceName(text, position) {
            return getClassification(ts.ClassificationTypeNames.interfaceName, text, position);
        }
        Classification.interfaceName = interfaceName;
        function moduleName(text, position) {
            return getClassification(ts.ClassificationTypeNames.moduleName, text, position);
        }
        Classification.moduleName = moduleName;
        function typeParameterName(text, position) {
            return getClassification(ts.ClassificationTypeNames.typeParameterName, text, position);
        }
        Classification.typeParameterName = typeParameterName;
        function parameterName(text, position) {
            return getClassification(ts.ClassificationTypeNames.parameterName, text, position);
        }
        Classification.parameterName = parameterName;
        function typeAliasName(text, position) {
            return getClassification(ts.ClassificationTypeNames.typeAliasName, text, position);
        }
        Classification.typeAliasName = typeAliasName;
        function jsxOpenTagName(text, position) {
            return getClassification(ts.ClassificationTypeNames.jsxOpenTagName, text, position);
        }
        Classification.jsxOpenTagName = jsxOpenTagName;
        function jsxCloseTagName(text, position) {
            return getClassification(ts.ClassificationTypeNames.jsxCloseTagName, text, position);
        }
        Classification.jsxCloseTagName = jsxCloseTagName;
        function jsxSelfClosingTagName(text, position) {
            return getClassification(ts.ClassificationTypeNames.jsxSelfClosingTagName, text, position);
        }
        Classification.jsxSelfClosingTagName = jsxSelfClosingTagName;
        function jsxAttribute(text, position) {
            return getClassification(ts.ClassificationTypeNames.jsxAttribute, text, position);
        }
        Classification.jsxAttribute = jsxAttribute;
        function jsxText(text, position) {
            return getClassification(ts.ClassificationTypeNames.jsxText, text, position);
        }
        Classification.jsxText = jsxText;
        function jsxAttributeStringLiteralValue(text, position) {
            return getClassification(ts.ClassificationTypeNames.jsxAttributeStringLiteralValue, text, position);
        }
        Classification.jsxAttributeStringLiteralValue = jsxAttributeStringLiteralValue;
        function getClassification(classificationType, text, position) {
            const textSpan = position === undefined ? undefined : { start: position, end: position + text.length };
            return { classificationType, text, textSpan };
        }
    })(Classification = FourSlashInterface.Classification || (FourSlashInterface.Classification = {}));
})(FourSlashInterface || (FourSlashInterface = {}));
