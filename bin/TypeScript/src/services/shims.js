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
/* @internal */
let debugObjectHost = (function () { return this; })();
// We need to use 'null' to interface with the managed side.
/* tslint:disable:no-null-keyword */
/* tslint:disable:no-in-operator */
/* @internal */
var ts;
(function (ts) {
    function logInternalError(logger, err) {
        if (logger) {
            logger.log("*INTERNAL ERROR* - Exception in typescript services: " + err.message);
        }
    }
    class ScriptSnapshotShimAdapter {
        constructor(scriptSnapshotShim) {
            this.scriptSnapshotShim = scriptSnapshotShim;
        }
        getText(start, end) {
            return this.scriptSnapshotShim.getText(start, end);
        }
        getLength() {
            return this.scriptSnapshotShim.getLength();
        }
        getChangeRange(oldSnapshot) {
            const oldSnapshotShim = oldSnapshot;
            const encoded = this.scriptSnapshotShim.getChangeRange(oldSnapshotShim.scriptSnapshotShim);
            if (encoded === null) {
                return null;
            }
            const decoded = JSON.parse(encoded);
            return ts.createTextChangeRange(ts.createTextSpan(decoded.span.start, decoded.span.length), decoded.newLength);
        }
        dispose() {
            // if scriptSnapshotShim is a COM object then property check becomes method call with no arguments
            // 'in' does not have this effect
            if ("dispose" in this.scriptSnapshotShim) {
                this.scriptSnapshotShim.dispose();
            }
        }
    }
    class LanguageServiceShimHostAdapter {
        constructor(shimHost) {
            this.shimHost = shimHost;
            this.loggingEnabled = false;
            this.tracingEnabled = false;
            // if shimHost is a COM object then property check will become method call with no arguments.
            // 'in' does not have this effect.
            if ("getModuleResolutionsForFile" in this.shimHost) {
                this.resolveModuleNames = (moduleNames, containingFile) => {
                    const resolutionsInFile = JSON.parse(this.shimHost.getModuleResolutionsForFile(containingFile));
                    return ts.map(moduleNames, name => {
                        const result = ts.getProperty(resolutionsInFile, name);
                        return result ? { resolvedFileName: result, extension: ts.extensionFromPath(result), isExternalLibraryImport: false } : undefined;
                    });
                };
            }
            if ("directoryExists" in this.shimHost) {
                this.directoryExists = directoryName => this.shimHost.directoryExists(directoryName);
            }
            if ("getTypeReferenceDirectiveResolutionsForFile" in this.shimHost) {
                this.resolveTypeReferenceDirectives = (typeDirectiveNames, containingFile) => {
                    const typeDirectivesForFile = JSON.parse(this.shimHost.getTypeReferenceDirectiveResolutionsForFile(containingFile));
                    return ts.map(typeDirectiveNames, name => ts.getProperty(typeDirectivesForFile, name));
                };
            }
        }
        log(s) {
            if (this.loggingEnabled) {
                this.shimHost.log(s);
            }
        }
        trace(s) {
            if (this.tracingEnabled) {
                this.shimHost.trace(s);
            }
        }
        error(s) {
            this.shimHost.error(s);
        }
        getProjectVersion() {
            if (!this.shimHost.getProjectVersion) {
                // shimmed host does not support getProjectVersion
                return undefined;
            }
            return this.shimHost.getProjectVersion();
        }
        getTypeRootsVersion() {
            if (!this.shimHost.getTypeRootsVersion) {
                return 0;
            }
            return this.shimHost.getTypeRootsVersion();
        }
        useCaseSensitiveFileNames() {
            return this.shimHost.useCaseSensitiveFileNames ? this.shimHost.useCaseSensitiveFileNames() : false;
        }
        getCompilationSettings() {
            const settingsJson = this.shimHost.getCompilationSettings();
            if (settingsJson === null || settingsJson === "") {
                throw Error("LanguageServiceShimHostAdapter.getCompilationSettings: empty compilationSettings");
            }
            const compilerOptions = JSON.parse(settingsJson);
            // permit language service to handle all files (filtering should be performed on the host side)
            compilerOptions.allowNonTsExtensions = true;
            return compilerOptions;
        }
        getScriptFileNames() {
            const encoded = this.shimHost.getScriptFileNames();
            return this.files = JSON.parse(encoded);
        }
        getScriptSnapshot(fileName) {
            const scriptSnapshot = this.shimHost.getScriptSnapshot(fileName);
            return scriptSnapshot && new ScriptSnapshotShimAdapter(scriptSnapshot);
        }
        getScriptKind(fileName) {
            if ("getScriptKind" in this.shimHost) {
                return this.shimHost.getScriptKind(fileName);
            }
            else {
                return ts.ScriptKind.Unknown;
            }
        }
        getScriptVersion(fileName) {
            return this.shimHost.getScriptVersion(fileName);
        }
        getLocalizedDiagnosticMessages() {
            const diagnosticMessagesJson = this.shimHost.getLocalizedDiagnosticMessages();
            if (diagnosticMessagesJson === null || diagnosticMessagesJson === "") {
                return null;
            }
            try {
                return JSON.parse(diagnosticMessagesJson);
            }
            catch (e) {
                this.log(e.description || "diagnosticMessages.generated.json has invalid JSON format");
                return null;
            }
        }
        getCancellationToken() {
            const hostCancellationToken = this.shimHost.getCancellationToken();
            return new ts.ThrottledCancellationToken(hostCancellationToken);
        }
        getCurrentDirectory() {
            return this.shimHost.getCurrentDirectory();
        }
        getDirectories(path) {
            return JSON.parse(this.shimHost.getDirectories(path));
        }
        getDefaultLibFileName(options) {
            return this.shimHost.getDefaultLibFileName(JSON.stringify(options));
        }
        readDirectory(path, extensions, exclude, include, depth) {
            const pattern = ts.getFileMatcherPatterns(path, exclude, include, this.shimHost.useCaseSensitiveFileNames(), this.shimHost.getCurrentDirectory());
            return JSON.parse(this.shimHost.readDirectory(path, JSON.stringify(extensions), JSON.stringify(pattern.basePaths), pattern.excludePattern, pattern.includeFilePattern, pattern.includeDirectoryPattern, depth));
        }
        readFile(path, encoding) {
            return this.shimHost.readFile(path, encoding);
        }
        fileExists(path) {
            return this.shimHost.fileExists(path);
        }
    }
    ts.LanguageServiceShimHostAdapter = LanguageServiceShimHostAdapter;
    class CoreServicesShimHostAdapter {
        constructor(shimHost) {
            this.shimHost = shimHost;
            this.useCaseSensitiveFileNames = this.shimHost.useCaseSensitiveFileNames ? this.shimHost.useCaseSensitiveFileNames() : false;
            if ("directoryExists" in this.shimHost) {
                this.directoryExists = directoryName => this.shimHost.directoryExists(directoryName);
            }
            if ("realpath" in this.shimHost) {
                this.realpath = path => this.shimHost.realpath(path);
            }
        }
        readDirectory(rootDir, extensions, exclude, include, depth) {
            const pattern = ts.getFileMatcherPatterns(rootDir, exclude, include, this.shimHost.useCaseSensitiveFileNames(), this.shimHost.getCurrentDirectory());
            return JSON.parse(this.shimHost.readDirectory(rootDir, JSON.stringify(extensions), JSON.stringify(pattern.basePaths), pattern.excludePattern, pattern.includeFilePattern, pattern.includeDirectoryPattern, depth));
        }
        fileExists(fileName) {
            return this.shimHost.fileExists(fileName);
        }
        readFile(fileName) {
            return this.shimHost.readFile(fileName);
        }
        getDirectories(path) {
            return JSON.parse(this.shimHost.getDirectories(path));
        }
    }
    ts.CoreServicesShimHostAdapter = CoreServicesShimHostAdapter;
    function simpleForwardCall(logger, actionDescription, action, logPerformance) {
        let start;
        if (logPerformance) {
            logger.log(actionDescription);
            start = ts.timestamp();
        }
        const result = action();
        if (logPerformance) {
            const end = ts.timestamp();
            logger.log(`${actionDescription} completed in ${end - start} msec`);
            if (ts.isString(result)) {
                let str = result;
                if (str.length > 128) {
                    str = str.substring(0, 128) + "...";
                }
                logger.log(`  result.length=${str.length}, result='${JSON.stringify(str)}'`);
            }
        }
        return result;
    }
    function forwardJSONCall(logger, actionDescription, action, logPerformance) {
        return forwardCall(logger, actionDescription, /*returnJson*/ true, action, logPerformance);
    }
    function forwardCall(logger, actionDescription, returnJson, action, logPerformance) {
        try {
            const result = simpleForwardCall(logger, actionDescription, action, logPerformance);
            return returnJson ? JSON.stringify({ result }) : result;
        }
        catch (err) {
            if (err instanceof ts.OperationCanceledException) {
                return JSON.stringify({ canceled: true });
            }
            logInternalError(logger, err);
            err.description = actionDescription;
            return JSON.stringify({ error: err });
        }
    }
    class ShimBase {
        constructor(factory) {
            this.factory = factory;
            factory.registerShim(this);
        }
        dispose(_dummy) {
            this.factory.unregisterShim(this);
        }
    }
    function realizeDiagnostics(diagnostics, newLine) {
        return diagnostics.map(d => realizeDiagnostic(d, newLine));
    }
    ts.realizeDiagnostics = realizeDiagnostics;
    function realizeDiagnostic(diagnostic, newLine) {
        return {
            message: ts.flattenDiagnosticMessageText(diagnostic.messageText, newLine),
            start: diagnostic.start,
            length: diagnostic.length,
            category: ts.diagnosticCategoryName(diagnostic),
            code: diagnostic.code
        };
    }
    class LanguageServiceShimObject extends ShimBase {
        constructor(factory, host, languageService) {
            super(factory);
            this.host = host;
            this.languageService = languageService;
            this.logPerformance = false;
            this.logger = this.host;
        }
        forwardJSONCall(actionDescription, action) {
            return forwardJSONCall(this.logger, actionDescription, action, this.logPerformance);
        }
        /// DISPOSE
        /**
         * Ensure (almost) deterministic release of internal Javascript resources when
         * some external native objects holds onto us (e.g. Com/Interop).
         */
        dispose(dummy) {
            this.logger.log("dispose()");
            this.languageService.dispose();
            this.languageService = null;
            // force a GC
            if (debugObjectHost && debugObjectHost.CollectGarbage) {
                debugObjectHost.CollectGarbage();
                this.logger.log("CollectGarbage()");
            }
            this.logger = null;
            super.dispose(dummy);
        }
        /// REFRESH
        /**
         * Update the list of scripts known to the compiler
         */
        refresh(throwOnError) {
            this.forwardJSONCall(`refresh(${throwOnError})`, () => null);
        }
        cleanupSemanticCache() {
            this.forwardJSONCall("cleanupSemanticCache()", () => {
                this.languageService.cleanupSemanticCache();
                return null;
            });
        }
        realizeDiagnostics(diagnostics) {
            const newLine = ts.getNewLineOrDefaultFromHost(this.host);
            return realizeDiagnostics(diagnostics, newLine);
        }
        getSyntacticClassifications(fileName, start, length) {
            return this.forwardJSONCall(`getSyntacticClassifications('${fileName}', ${start}, ${length})`, () => this.languageService.getSyntacticClassifications(fileName, ts.createTextSpan(start, length)));
        }
        getSemanticClassifications(fileName, start, length) {
            return this.forwardJSONCall(`getSemanticClassifications('${fileName}', ${start}, ${length})`, () => this.languageService.getSemanticClassifications(fileName, ts.createTextSpan(start, length)));
        }
        getEncodedSyntacticClassifications(fileName, start, length) {
            return this.forwardJSONCall(`getEncodedSyntacticClassifications('${fileName}', ${start}, ${length})`, 
            // directly serialize the spans out to a string.  This is much faster to decode
            // on the managed side versus a full JSON array.
            () => convertClassifications(this.languageService.getEncodedSyntacticClassifications(fileName, ts.createTextSpan(start, length))));
        }
        getEncodedSemanticClassifications(fileName, start, length) {
            return this.forwardJSONCall(`getEncodedSemanticClassifications('${fileName}', ${start}, ${length})`, 
            // directly serialize the spans out to a string.  This is much faster to decode
            // on the managed side versus a full JSON array.
            () => convertClassifications(this.languageService.getEncodedSemanticClassifications(fileName, ts.createTextSpan(start, length))));
        }
        getSyntacticDiagnostics(fileName) {
            return this.forwardJSONCall(`getSyntacticDiagnostics('${fileName}')`, () => {
                const diagnostics = this.languageService.getSyntacticDiagnostics(fileName);
                return this.realizeDiagnostics(diagnostics);
            });
        }
        getSemanticDiagnostics(fileName) {
            return this.forwardJSONCall(`getSemanticDiagnostics('${fileName}')`, () => {
                const diagnostics = this.languageService.getSemanticDiagnostics(fileName);
                return this.realizeDiagnostics(diagnostics);
            });
        }
        getSuggestionDiagnostics(fileName) {
            return this.forwardJSONCall(`getSuggestionDiagnostics('${fileName}')`, () => this.realizeDiagnostics(this.languageService.getSuggestionDiagnostics(fileName)));
        }
        getCompilerOptionsDiagnostics() {
            return this.forwardJSONCall("getCompilerOptionsDiagnostics()", () => {
                const diagnostics = this.languageService.getCompilerOptionsDiagnostics();
                return this.realizeDiagnostics(diagnostics);
            });
        }
        /// QUICKINFO
        /**
         * Computes a string representation of the type at the requested position
         * in the active file.
         */
        getQuickInfoAtPosition(fileName, position) {
            return this.forwardJSONCall(`getQuickInfoAtPosition('${fileName}', ${position})`, () => this.languageService.getQuickInfoAtPosition(fileName, position));
        }
        /// NAMEORDOTTEDNAMESPAN
        /**
         * Computes span information of the name or dotted name at the requested position
         * in the active file.
         */
        getNameOrDottedNameSpan(fileName, startPos, endPos) {
            return this.forwardJSONCall(`getNameOrDottedNameSpan('${fileName}', ${startPos}, ${endPos})`, () => this.languageService.getNameOrDottedNameSpan(fileName, startPos, endPos));
        }
        /**
         * STATEMENTSPAN
         * Computes span information of statement at the requested position in the active file.
         */
        getBreakpointStatementAtPosition(fileName, position) {
            return this.forwardJSONCall(`getBreakpointStatementAtPosition('${fileName}', ${position})`, () => this.languageService.getBreakpointStatementAtPosition(fileName, position));
        }
        /// SIGNATUREHELP
        getSignatureHelpItems(fileName, position) {
            return this.forwardJSONCall(`getSignatureHelpItems('${fileName}', ${position})`, () => this.languageService.getSignatureHelpItems(fileName, position));
        }
        /// GOTO DEFINITION
        /**
         * Computes the definition location and file for the symbol
         * at the requested position.
         */
        getDefinitionAtPosition(fileName, position) {
            return this.forwardJSONCall(`getDefinitionAtPosition('${fileName}', ${position})`, () => this.languageService.getDefinitionAtPosition(fileName, position));
        }
        /**
         * Computes the definition location and file for the symbol
         * at the requested position.
         */
        getDefinitionAndBoundSpan(fileName, position) {
            return this.forwardJSONCall(`getDefinitionAndBoundSpan('${fileName}', ${position})`, () => this.languageService.getDefinitionAndBoundSpan(fileName, position));
        }
        /// GOTO Type
        /**
         * Computes the definition location of the type of the symbol
         * at the requested position.
         */
        getTypeDefinitionAtPosition(fileName, position) {
            return this.forwardJSONCall(`getTypeDefinitionAtPosition('${fileName}', ${position})`, () => this.languageService.getTypeDefinitionAtPosition(fileName, position));
        }
        /// GOTO Implementation
        /**
         * Computes the implementation location of the symbol
         * at the requested position.
         */
        getImplementationAtPosition(fileName, position) {
            return this.forwardJSONCall(`getImplementationAtPosition('${fileName}', ${position})`, () => this.languageService.getImplementationAtPosition(fileName, position));
        }
        getRenameInfo(fileName, position) {
            return this.forwardJSONCall(`getRenameInfo('${fileName}', ${position})`, () => this.languageService.getRenameInfo(fileName, position));
        }
        findRenameLocations(fileName, position, findInStrings, findInComments) {
            return this.forwardJSONCall(`findRenameLocations('${fileName}', ${position}, ${findInStrings}, ${findInComments})`, () => this.languageService.findRenameLocations(fileName, position, findInStrings, findInComments));
        }
        /// GET BRACE MATCHING
        getBraceMatchingAtPosition(fileName, position) {
            return this.forwardJSONCall(`getBraceMatchingAtPosition('${fileName}', ${position})`, () => this.languageService.getBraceMatchingAtPosition(fileName, position));
        }
        isValidBraceCompletionAtPosition(fileName, position, openingBrace) {
            return this.forwardJSONCall(`isValidBraceCompletionAtPosition('${fileName}', ${position}, ${openingBrace})`, () => this.languageService.isValidBraceCompletionAtPosition(fileName, position, openingBrace));
        }
        getSpanOfEnclosingComment(fileName, position, onlyMultiLine) {
            return this.forwardJSONCall(`getSpanOfEnclosingComment('${fileName}', ${position})`, () => this.languageService.getSpanOfEnclosingComment(fileName, position, onlyMultiLine));
        }
        /// GET SMART INDENT
        getIndentationAtPosition(fileName, position, options /*Services.EditorOptions*/) {
            return this.forwardJSONCall(`getIndentationAtPosition('${fileName}', ${position})`, () => {
                const localOptions = JSON.parse(options);
                return this.languageService.getIndentationAtPosition(fileName, position, localOptions);
            });
        }
        /// GET REFERENCES
        getReferencesAtPosition(fileName, position) {
            return this.forwardJSONCall(`getReferencesAtPosition('${fileName}', ${position})`, () => this.languageService.getReferencesAtPosition(fileName, position));
        }
        findReferences(fileName, position) {
            return this.forwardJSONCall(`findReferences('${fileName}', ${position})`, () => this.languageService.findReferences(fileName, position));
        }
        getOccurrencesAtPosition(fileName, position) {
            return this.forwardJSONCall(`getOccurrencesAtPosition('${fileName}', ${position})`, () => this.languageService.getOccurrencesAtPosition(fileName, position));
        }
        getDocumentHighlights(fileName, position, filesToSearch) {
            return this.forwardJSONCall(`getDocumentHighlights('${fileName}', ${position})`, () => {
                const results = this.languageService.getDocumentHighlights(fileName, position, JSON.parse(filesToSearch));
                // workaround for VS document highlighting issue - keep only items from the initial file
                const normalizedName = ts.normalizeSlashes(fileName).toLowerCase();
                return ts.filter(results, r => ts.normalizeSlashes(r.fileName).toLowerCase() === normalizedName);
            });
        }
        /// COMPLETION LISTS
        /**
         * Get a string based representation of the completions
         * to provide at the given source position and providing a member completion
         * list if requested.
         */
        getCompletionsAtPosition(fileName, position, preferences) {
            return this.forwardJSONCall(`getCompletionsAtPosition('${fileName}', ${position}, ${preferences})`, () => this.languageService.getCompletionsAtPosition(fileName, position, preferences));
        }
        /** Get a string based representation of a completion list entry details */
        getCompletionEntryDetails(fileName, position, entryName, formatOptions, source, preferences) {
            return this.forwardJSONCall(`getCompletionEntryDetails('${fileName}', ${position}, '${entryName}')`, () => {
                const localOptions = formatOptions === undefined ? undefined : JSON.parse(formatOptions);
                return this.languageService.getCompletionEntryDetails(fileName, position, entryName, localOptions, source, preferences);
            });
        }
        getFormattingEditsForRange(fileName, start, end, options /*Services.FormatCodeOptions*/) {
            return this.forwardJSONCall(`getFormattingEditsForRange('${fileName}', ${start}, ${end})`, () => {
                const localOptions = JSON.parse(options);
                return this.languageService.getFormattingEditsForRange(fileName, start, end, localOptions);
            });
        }
        getFormattingEditsForDocument(fileName, options /*Services.FormatCodeOptions*/) {
            return this.forwardJSONCall(`getFormattingEditsForDocument('${fileName}')`, () => {
                const localOptions = JSON.parse(options);
                return this.languageService.getFormattingEditsForDocument(fileName, localOptions);
            });
        }
        getFormattingEditsAfterKeystroke(fileName, position, key, options /*Services.FormatCodeOptions*/) {
            return this.forwardJSONCall(`getFormattingEditsAfterKeystroke('${fileName}', ${position}, '${key}')`, () => {
                const localOptions = JSON.parse(options);
                return this.languageService.getFormattingEditsAfterKeystroke(fileName, position, key, localOptions);
            });
        }
        getDocCommentTemplateAtPosition(fileName, position) {
            return this.forwardJSONCall(`getDocCommentTemplateAtPosition('${fileName}', ${position})`, () => this.languageService.getDocCommentTemplateAtPosition(fileName, position));
        }
        /// NAVIGATE TO
        /** Return a list of symbols that are interesting to navigate to */
        getNavigateToItems(searchValue, maxResultCount, fileName) {
            return this.forwardJSONCall(`getNavigateToItems('${searchValue}', ${maxResultCount}, ${fileName})`, () => this.languageService.getNavigateToItems(searchValue, maxResultCount, fileName));
        }
        getNavigationBarItems(fileName) {
            return this.forwardJSONCall(`getNavigationBarItems('${fileName}')`, () => this.languageService.getNavigationBarItems(fileName));
        }
        getNavigationTree(fileName) {
            return this.forwardJSONCall(`getNavigationTree('${fileName}')`, () => this.languageService.getNavigationTree(fileName));
        }
        getOutliningSpans(fileName) {
            return this.forwardJSONCall(`getOutliningSpans('${fileName}')`, () => this.languageService.getOutliningSpans(fileName));
        }
        getTodoComments(fileName, descriptors) {
            return this.forwardJSONCall(`getTodoComments('${fileName}')`, () => this.languageService.getTodoComments(fileName, JSON.parse(descriptors)));
        }
        /// Emit
        getEmitOutput(fileName) {
            return this.forwardJSONCall(`getEmitOutput('${fileName}')`, () => this.languageService.getEmitOutput(fileName));
        }
        getEmitOutputObject(fileName) {
            return forwardCall(this.logger, `getEmitOutput('${fileName}')`, 
            /*returnJson*/ false, () => this.languageService.getEmitOutput(fileName), this.logPerformance);
        }
    }
    function convertClassifications(classifications) {
        return { spans: classifications.spans.join(","), endOfLineState: classifications.endOfLineState };
    }
    class ClassifierShimObject extends ShimBase {
        constructor(factory, logger) {
            super(factory);
            this.logger = logger;
            this.logPerformance = false;
            this.classifier = ts.createClassifier();
        }
        getEncodedLexicalClassifications(text, lexState, syntacticClassifierAbsent) {
            return forwardJSONCall(this.logger, "getEncodedLexicalClassifications", () => convertClassifications(this.classifier.getEncodedLexicalClassifications(text, lexState, syntacticClassifierAbsent)), this.logPerformance);
        }
        /// COLORIZATION
        getClassificationsForLine(text, lexState, classifyKeywordsInGenerics) {
            const classification = this.classifier.getClassificationsForLine(text, lexState, classifyKeywordsInGenerics);
            let result = "";
            for (const item of classification.entries) {
                result += item.length + "\n";
                result += item.classification + "\n";
            }
            result += classification.finalLexState;
            return result;
        }
    }
    class CoreServicesShimObject extends ShimBase {
        constructor(factory, logger, host) {
            super(factory);
            this.logger = logger;
            this.host = host;
            this.logPerformance = false;
        }
        forwardJSONCall(actionDescription, action) {
            return forwardJSONCall(this.logger, actionDescription, action, this.logPerformance);
        }
        resolveModuleName(fileName, moduleName, compilerOptionsJson) {
            return this.forwardJSONCall(`resolveModuleName('${fileName}')`, () => {
                const compilerOptions = JSON.parse(compilerOptionsJson);
                const result = ts.resolveModuleName(moduleName, ts.normalizeSlashes(fileName), compilerOptions, this.host);
                let resolvedFileName = result.resolvedModule ? result.resolvedModule.resolvedFileName : undefined;
                if (result.resolvedModule && result.resolvedModule.extension !== ts.Extension.Ts && result.resolvedModule.extension !== ts.Extension.Tsx && result.resolvedModule.extension !== ts.Extension.Dts) {
                    resolvedFileName = undefined;
                }
                return {
                    resolvedFileName,
                    failedLookupLocations: result.failedLookupLocations
                };
            });
        }
        resolveTypeReferenceDirective(fileName, typeReferenceDirective, compilerOptionsJson) {
            return this.forwardJSONCall(`resolveTypeReferenceDirective(${fileName})`, () => {
                const compilerOptions = JSON.parse(compilerOptionsJson);
                const result = ts.resolveTypeReferenceDirective(typeReferenceDirective, ts.normalizeSlashes(fileName), compilerOptions, this.host);
                return {
                    resolvedFileName: result.resolvedTypeReferenceDirective ? result.resolvedTypeReferenceDirective.resolvedFileName : undefined,
                    primary: result.resolvedTypeReferenceDirective ? result.resolvedTypeReferenceDirective.primary : true,
                    failedLookupLocations: result.failedLookupLocations
                };
            });
        }
        getPreProcessedFileInfo(fileName, sourceTextSnapshot) {
            return this.forwardJSONCall(`getPreProcessedFileInfo('${fileName}')`, () => {
                // for now treat files as JavaScript
                const result = ts.preProcessFile(ts.getSnapshotText(sourceTextSnapshot), /* readImportFiles */ true, /* detectJavaScriptImports */ true);
                return {
                    referencedFiles: this.convertFileReferences(result.referencedFiles),
                    importedFiles: this.convertFileReferences(result.importedFiles),
                    ambientExternalModules: result.ambientExternalModules,
                    isLibFile: result.isLibFile,
                    typeReferenceDirectives: this.convertFileReferences(result.typeReferenceDirectives)
                };
            });
        }
        getAutomaticTypeDirectiveNames(compilerOptionsJson) {
            return this.forwardJSONCall(`getAutomaticTypeDirectiveNames('${compilerOptionsJson}')`, () => {
                const compilerOptions = JSON.parse(compilerOptionsJson);
                return ts.getAutomaticTypeDirectiveNames(compilerOptions, this.host);
            });
        }
        convertFileReferences(refs) {
            if (!refs) {
                return undefined;
            }
            const result = [];
            for (const ref of refs) {
                result.push({
                    path: ts.normalizeSlashes(ref.fileName),
                    position: ref.pos,
                    length: ref.end - ref.pos
                });
            }
            return result;
        }
        getTSConfigFileInfo(fileName, sourceTextSnapshot) {
            return this.forwardJSONCall(`getTSConfigFileInfo('${fileName}')`, () => {
                const result = ts.parseJsonText(fileName, ts.getSnapshotText(sourceTextSnapshot));
                const normalizedFileName = ts.normalizeSlashes(fileName);
                const configFile = ts.parseJsonSourceFileConfigFileContent(result, this.host, ts.getDirectoryPath(normalizedFileName), /*existingOptions*/ {}, normalizedFileName);
                return {
                    options: configFile.options,
                    typeAcquisition: configFile.typeAcquisition,
                    files: configFile.fileNames,
                    raw: configFile.raw,
                    errors: realizeDiagnostics(result.parseDiagnostics.concat(configFile.errors), "\r\n")
                };
            });
        }
        getDefaultCompilationSettings() {
            return this.forwardJSONCall("getDefaultCompilationSettings()", () => ts.getDefaultCompilerOptions());
        }
        discoverTypings(discoverTypingsJson) {
            const getCanonicalFileName = ts.createGetCanonicalFileName(/*useCaseSensitivefileNames:*/ false);
            return this.forwardJSONCall("discoverTypings()", () => {
                const info = JSON.parse(discoverTypingsJson);
                if (this.safeList === undefined) {
                    this.safeList = ts.JsTyping.loadSafeList(this.host, ts.toPath(info.safeListPath, info.safeListPath, getCanonicalFileName));
                }
                return ts.JsTyping.discoverTypings(this.host, msg => this.logger.log(msg), info.fileNames, ts.toPath(info.projectRootPath, info.projectRootPath, getCanonicalFileName), this.safeList, info.packageNameToTypingLocation, info.typeAcquisition, info.unresolvedImports, info.typesRegistry);
            });
        }
    }
    class TypeScriptServicesFactory {
        constructor() {
            this._shims = [];
        }
        /*
         * Returns script API version.
         */
        getServicesVersion() {
            return ts.servicesVersion;
        }
        createLanguageServiceShim(host) {
            try {
                if (this.documentRegistry === undefined) {
                    this.documentRegistry = ts.createDocumentRegistry(host.useCaseSensitiveFileNames && host.useCaseSensitiveFileNames(), host.getCurrentDirectory());
                }
                const hostAdapter = new LanguageServiceShimHostAdapter(host);
                const languageService = ts.createLanguageService(hostAdapter, this.documentRegistry, /*syntaxOnly*/ false);
                return new LanguageServiceShimObject(this, host, languageService);
            }
            catch (err) {
                logInternalError(host, err);
                throw err;
            }
        }
        createClassifierShim(logger) {
            try {
                return new ClassifierShimObject(this, logger);
            }
            catch (err) {
                logInternalError(logger, err);
                throw err;
            }
        }
        createCoreServicesShim(host) {
            try {
                const adapter = new CoreServicesShimHostAdapter(host);
                return new CoreServicesShimObject(this, host, adapter);
            }
            catch (err) {
                logInternalError(host, err);
                throw err;
            }
        }
        close() {
            // Forget all the registered shims
            ts.clear(this._shims);
            this.documentRegistry = undefined;
        }
        registerShim(shim) {
            this._shims.push(shim);
        }
        unregisterShim(shim) {
            for (let i = 0; i < this._shims.length; i++) {
                if (this._shims[i] === shim) {
                    delete this._shims[i];
                    return;
                }
            }
            throw new Error("Invalid operation");
        }
    }
    ts.TypeScriptServicesFactory = TypeScriptServicesFactory;
    if (typeof module !== "undefined" && module.exports) {
        module.exports = ts;
    }
})(ts || (ts = {}));
/* tslint:enable:no-in-operator */
/* tslint:enable:no-null */
/// TODO: this is used by VS, clean this up on both sides of the interface
/* @internal */
var TypeScript;
(function (TypeScript) {
    var Services;
    (function (Services) {
        Services.TypeScriptServicesFactory = ts.TypeScriptServicesFactory;
    })(Services = TypeScript.Services || (TypeScript.Services = {}));
})(TypeScript || (TypeScript = {}));
// 'toolsVersion' gets consumed by the managed side, so it's not unused.
// TODO: it should be moved into a namespace though.
/* @internal */
const toolsVersion = ts.versionMajorMinor;
