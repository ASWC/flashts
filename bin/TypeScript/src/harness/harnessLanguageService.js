/// <reference path="..\services\services.ts" />
/// <reference path="..\services\shims.ts" />
/// <reference path="..\server\client.ts" />
/// <reference path="harness.ts" />
var Harness;
(function (Harness) {
    var LanguageService;
    (function (LanguageService) {
        class ScriptInfo {
            constructor(fileName, content, isRootFile) {
                this.fileName = fileName;
                this.content = content;
                this.isRootFile = isRootFile;
                this.version = 1;
                this.editRanges = [];
                this.lineMap = undefined;
                this.setContent(content);
            }
            setContent(content) {
                this.content = content;
                this.lineMap = undefined;
            }
            getLineMap() {
                return this.lineMap || (this.lineMap = ts.computeLineStarts(this.content));
            }
            updateContent(content) {
                this.editRanges = [];
                this.setContent(content);
                this.version++;
            }
            editContent(start, end, newText) {
                // Apply edits
                const prefix = this.content.substring(0, start);
                const middle = newText;
                const suffix = this.content.substring(end);
                this.setContent(prefix + middle + suffix);
                // Store edit range + new length of script
                this.editRanges.push({
                    length: this.content.length,
                    textChangeRange: ts.createTextChangeRange(ts.createTextSpanFromBounds(start, end), newText.length)
                });
                // Update version #
                this.version++;
            }
            getTextChangeRangeBetweenVersions(startVersion, endVersion) {
                if (startVersion === endVersion) {
                    // No edits!
                    return ts.unchangedTextChangeRange;
                }
                const initialEditRangeIndex = this.editRanges.length - (this.version - startVersion);
                const lastEditRangeIndex = this.editRanges.length - (this.version - endVersion);
                const entries = this.editRanges.slice(initialEditRangeIndex, lastEditRangeIndex);
                return ts.collapseTextChangeRangesAcrossMultipleVersions(entries.map(e => e.textChangeRange));
            }
        }
        LanguageService.ScriptInfo = ScriptInfo;
        class ScriptSnapshot {
            constructor(scriptInfo) {
                this.scriptInfo = scriptInfo;
                this.textSnapshot = scriptInfo.content;
                this.version = scriptInfo.version;
            }
            getText(start, end) {
                return this.textSnapshot.substring(start, end);
            }
            getLength() {
                return this.textSnapshot.length;
            }
            getChangeRange(oldScript) {
                const oldShim = oldScript;
                return this.scriptInfo.getTextChangeRangeBetweenVersions(oldShim.version, this.version);
            }
        }
        class ScriptSnapshotProxy {
            constructor(scriptSnapshot) {
                this.scriptSnapshot = scriptSnapshot;
            }
            getText(start, end) {
                return this.scriptSnapshot.getText(start, end);
            }
            getLength() {
                return this.scriptSnapshot.getLength();
            }
            getChangeRange(oldScript) {
                const range = this.scriptSnapshot.getChangeRange(oldScript.scriptSnapshot);
                return range && JSON.stringify(range);
            }
        }
        class DefaultHostCancellationToken {
            isCancellationRequested() {
                return false;
            }
        }
        DefaultHostCancellationToken.instance = new DefaultHostCancellationToken();
        class LanguageServiceAdapterHost {
            constructor(cancellationToken = DefaultHostCancellationToken.instance, settings = ts.getDefaultCompilerOptions()) {
                this.cancellationToken = cancellationToken;
                this.settings = settings;
                this.virtualFileSystem = new Utils.VirtualFileSystem(Harness.virtualFileSystemRoot, /*useCaseSensitiveFilenames*/ false);
            }
            getNewLine() {
                return Harness.harnessNewLine;
            }
            getFilenames() {
                const fileNames = [];
                for (const virtualEntry of this.virtualFileSystem.getAllFileEntries()) {
                    const scriptInfo = virtualEntry.content;
                    if (scriptInfo.isRootFile) {
                        // only include root files here
                        // usually it means that we won't include lib.d.ts in the list of root files so it won't mess the computation of compilation root dir.
                        fileNames.push(scriptInfo.fileName);
                    }
                }
                return fileNames;
            }
            getScriptInfo(fileName) {
                const fileEntry = this.virtualFileSystem.traversePath(fileName);
                return fileEntry && fileEntry.isFile() ? fileEntry.content : undefined;
            }
            addScript(fileName, content, isRootFile) {
                this.virtualFileSystem.addFile(fileName, new ScriptInfo(fileName, content, isRootFile));
            }
            editScript(fileName, start, end, newText) {
                const script = this.getScriptInfo(fileName);
                if (script !== undefined) {
                    script.editContent(start, end, newText);
                    return;
                }
                throw new Error("No script with name '" + fileName + "'");
            }
            openFile(_fileName, _content, _scriptKindName) { }
            /**
             * @param line 0 based index
             * @param col 0 based index
             */
            positionToLineAndCharacter(fileName, position) {
                const script = this.getScriptInfo(fileName);
                assert.isOk(script);
                return ts.computeLineAndCharacterOfPosition(script.getLineMap(), position);
            }
        }
        LanguageService.LanguageServiceAdapterHost = LanguageServiceAdapterHost;
        /// Native adapter
        class NativeLanguageServiceHost extends LanguageServiceAdapterHost {
            constructor() {
                super(...arguments);
                this.symlinks = ts.createMap();
                this.installPackage = ts.notImplemented;
                this.log = ts.noop;
                this.trace = ts.noop;
                this.error = ts.noop;
            }
            isKnownTypesPackageName(name) {
                return this.typesRegistry && this.typesRegistry.has(name);
            }
            getCompilationSettings() { return this.settings; }
            getCancellationToken() { return this.cancellationToken; }
            getDirectories(path) {
                const dir = this.virtualFileSystem.traversePath(path);
                return dir && dir.isDirectory() ? dir.getDirectories().map(d => d.name) : [];
            }
            getCurrentDirectory() { return Harness.virtualFileSystemRoot; }
            getDefaultLibFileName() { return Harness.Compiler.defaultLibFileName; }
            getScriptFileNames() {
                return this.getFilenames().filter(ts.isAnySupportedFileExtension);
            }
            getScriptSnapshot(fileName) {
                const script = this.getScriptInfo(fileName);
                return script ? new ScriptSnapshot(script) : undefined;
            }
            getScriptKind() { return ts.ScriptKind.Unknown; }
            getScriptVersion(fileName) {
                const script = this.getScriptInfo(fileName);
                return script ? script.version.toString() : undefined;
            }
            directoryExists(dirName) {
                if (ts.forEachEntry(this.symlinks, (_, key) => ts.forSomeAncestorDirectory(key, ancestor => ancestor === dirName))) {
                    return true;
                }
                const fileEntry = this.virtualFileSystem.traversePath(dirName);
                return fileEntry && fileEntry.isDirectory();
            }
            fileExists(fileName) {
                return this.symlinks.has(fileName) || this.getScriptSnapshot(fileName) !== undefined;
            }
            readDirectory(path, extensions, exclude, include, depth) {
                return ts.matchFiles(path, extensions, exclude, include, 
                /*useCaseSensitiveFileNames*/ false, this.getCurrentDirectory(), depth, (p) => this.virtualFileSystem.getAccessibleFileSystemEntries(p));
            }
            readFile(path) {
                const target = this.symlinks.get(path);
                return target !== undefined ? this.readFile(target) : ts.getSnapshotText(this.getScriptSnapshot(path));
            }
            addSymlink(from, target) { this.symlinks.set(from, target); }
            realpath(path) {
                const target = this.symlinks.get(path);
                return target === undefined ? path : target;
            }
            getTypeRootsVersion() {
                return 0;
            }
        }
        class NativeLanguageServiceAdapter {
            constructor(cancellationToken, options) {
                this.host = new NativeLanguageServiceHost(cancellationToken, options);
            }
            getHost() { return this.host; }
            getLanguageService() { return ts.createLanguageService(this.host); }
            getClassifier() { return ts.createClassifier(); }
            getPreProcessedFileInfo(fileName, fileContents) { return ts.preProcessFile(fileContents, /* readImportFiles */ true, ts.hasJavaScriptFileExtension(fileName)); }
        }
        LanguageService.NativeLanguageServiceAdapter = NativeLanguageServiceAdapter;
        /// Shim adapter
        class ShimLanguageServiceHost extends LanguageServiceAdapterHost {
            constructor(preprocessToResolve, cancellationToken, options) {
                super(cancellationToken, options);
                this.readDirectory = ts.notImplemented;
                this.readDirectoryNames = ts.notImplemented;
                this.readFileNames = ts.notImplemented;
                this.nativeHost = new NativeLanguageServiceHost(cancellationToken, options);
                if (preprocessToResolve) {
                    const compilerOptions = this.nativeHost.getCompilationSettings();
                    const moduleResolutionHost = {
                        fileExists: fileName => this.getScriptInfo(fileName) !== undefined,
                        readFile: fileName => {
                            const scriptInfo = this.getScriptInfo(fileName);
                            return scriptInfo && scriptInfo.content;
                        }
                    };
                    this.getModuleResolutionsForFile = (fileName) => {
                        const scriptInfo = this.getScriptInfo(fileName);
                        const preprocessInfo = ts.preProcessFile(scriptInfo.content, /*readImportFiles*/ true);
                        const imports = {};
                        for (const module of preprocessInfo.importedFiles) {
                            const resolutionInfo = ts.resolveModuleName(module.fileName, fileName, compilerOptions, moduleResolutionHost);
                            if (resolutionInfo.resolvedModule) {
                                imports[module.fileName] = resolutionInfo.resolvedModule.resolvedFileName;
                            }
                        }
                        return JSON.stringify(imports);
                    };
                    this.getTypeReferenceDirectiveResolutionsForFile = (fileName) => {
                        const scriptInfo = this.getScriptInfo(fileName);
                        if (scriptInfo) {
                            const preprocessInfo = ts.preProcessFile(scriptInfo.content, /*readImportFiles*/ false);
                            const resolutions = {};
                            const settings = this.nativeHost.getCompilationSettings();
                            for (const typeReferenceDirective of preprocessInfo.typeReferenceDirectives) {
                                const resolutionInfo = ts.resolveTypeReferenceDirective(typeReferenceDirective.fileName, fileName, settings, moduleResolutionHost);
                                if (resolutionInfo.resolvedTypeReferenceDirective.resolvedFileName) {
                                    resolutions[typeReferenceDirective.fileName] = resolutionInfo.resolvedTypeReferenceDirective;
                                }
                            }
                            return JSON.stringify(resolutions);
                        }
                        else {
                            return "[]";
                        }
                    };
                }
            }
            addSymlink() { return ts.notImplemented(); }
            getFilenames() { return this.nativeHost.getFilenames(); }
            getScriptInfo(fileName) { return this.nativeHost.getScriptInfo(fileName); }
            addScript(fileName, content, isRootFile) { this.nativeHost.addScript(fileName, content, isRootFile); }
            editScript(fileName, start, end, newText) { this.nativeHost.editScript(fileName, start, end, newText); }
            positionToLineAndCharacter(fileName, position) { return this.nativeHost.positionToLineAndCharacter(fileName, position); }
            getCompilationSettings() { return JSON.stringify(this.nativeHost.getCompilationSettings()); }
            getCancellationToken() { return this.nativeHost.getCancellationToken(); }
            getCurrentDirectory() { return this.nativeHost.getCurrentDirectory(); }
            getDirectories(path) { return JSON.stringify(this.nativeHost.getDirectories(path)); }
            getDefaultLibFileName() { return this.nativeHost.getDefaultLibFileName(); }
            getScriptFileNames() { return JSON.stringify(this.nativeHost.getScriptFileNames()); }
            getScriptSnapshot(fileName) {
                const nativeScriptSnapshot = this.nativeHost.getScriptSnapshot(fileName);
                return nativeScriptSnapshot && new ScriptSnapshotProxy(nativeScriptSnapshot);
            }
            getScriptKind() { return this.nativeHost.getScriptKind(); }
            getScriptVersion(fileName) { return this.nativeHost.getScriptVersion(fileName); }
            getLocalizedDiagnosticMessages() { return JSON.stringify({}); }
            fileExists(fileName) { return this.getScriptInfo(fileName) !== undefined; }
            readFile(fileName) {
                const snapshot = this.nativeHost.getScriptSnapshot(fileName);
                return snapshot && ts.getSnapshotText(snapshot);
            }
            log(s) { this.nativeHost.log(s); }
            trace(s) { this.nativeHost.trace(s); }
            error(s) { this.nativeHost.error(s); }
            directoryExists() {
                // for tests pessimistically assume that directory always exists
                return true;
            }
        }
        class ClassifierShimProxy {
            constructor(shim) {
                this.shim = shim;
            }
            getEncodedLexicalClassifications(_text, _lexState, _classifyKeywordsInGenerics) {
                return ts.notImplemented();
            }
            getClassificationsForLine(text, lexState, classifyKeywordsInGenerics) {
                const result = this.shim.getClassificationsForLine(text, lexState, classifyKeywordsInGenerics).split("\n");
                const entries = [];
                let i = 0;
                let position = 0;
                for (; i < result.length - 1; i += 2) {
                    const t = entries[i / 2] = {
                        length: parseInt(result[i]),
                        classification: parseInt(result[i + 1])
                    };
                    assert.isTrue(t.length > 0, "Result length should be greater than 0, got :" + t.length);
                    position += t.length;
                }
                const finalLexState = parseInt(result[result.length - 1]);
                assert.equal(position, text.length, "Expected cumulative length of all entries to match the length of the source. expected: " + text.length + ", but got: " + position);
                return {
                    finalLexState,
                    entries
                };
            }
        }
        function unwrapJSONCallResult(result) {
            const parsedResult = JSON.parse(result);
            if (parsedResult.error) {
                throw new Error("Language Service Shim Error: " + JSON.stringify(parsedResult.error));
            }
            else if (parsedResult.canceled) {
                throw new ts.OperationCanceledException();
            }
            return parsedResult.result;
        }
        class LanguageServiceShimProxy {
            constructor(shim) {
                this.shim = shim;
                this.getCombinedCodeFix = ts.notImplemented;
                this.applyCodeActionCommand = ts.notImplemented;
            }
            cleanupSemanticCache() {
                this.shim.cleanupSemanticCache();
            }
            getSyntacticDiagnostics(fileName) {
                return unwrapJSONCallResult(this.shim.getSyntacticDiagnostics(fileName));
            }
            getSemanticDiagnostics(fileName) {
                return unwrapJSONCallResult(this.shim.getSemanticDiagnostics(fileName));
            }
            getSuggestionDiagnostics(fileName) {
                return unwrapJSONCallResult(this.shim.getSuggestionDiagnostics(fileName));
            }
            getCompilerOptionsDiagnostics() {
                return unwrapJSONCallResult(this.shim.getCompilerOptionsDiagnostics());
            }
            getSyntacticClassifications(fileName, span) {
                return unwrapJSONCallResult(this.shim.getSyntacticClassifications(fileName, span.start, span.length));
            }
            getSemanticClassifications(fileName, span) {
                return unwrapJSONCallResult(this.shim.getSemanticClassifications(fileName, span.start, span.length));
            }
            getEncodedSyntacticClassifications(fileName, span) {
                return unwrapJSONCallResult(this.shim.getEncodedSyntacticClassifications(fileName, span.start, span.length));
            }
            getEncodedSemanticClassifications(fileName, span) {
                return unwrapJSONCallResult(this.shim.getEncodedSemanticClassifications(fileName, span.start, span.length));
            }
            getCompletionsAtPosition(fileName, position, preferences) {
                return unwrapJSONCallResult(this.shim.getCompletionsAtPosition(fileName, position, preferences));
            }
            getCompletionEntryDetails(fileName, position, entryName, formatOptions, source, preferences) {
                return unwrapJSONCallResult(this.shim.getCompletionEntryDetails(fileName, position, entryName, JSON.stringify(formatOptions), source, preferences));
            }
            getCompletionEntrySymbol() {
                throw new Error("getCompletionEntrySymbol not implemented across the shim layer.");
            }
            getQuickInfoAtPosition(fileName, position) {
                return unwrapJSONCallResult(this.shim.getQuickInfoAtPosition(fileName, position));
            }
            getNameOrDottedNameSpan(fileName, startPos, endPos) {
                return unwrapJSONCallResult(this.shim.getNameOrDottedNameSpan(fileName, startPos, endPos));
            }
            getBreakpointStatementAtPosition(fileName, position) {
                return unwrapJSONCallResult(this.shim.getBreakpointStatementAtPosition(fileName, position));
            }
            getSignatureHelpItems(fileName, position) {
                return unwrapJSONCallResult(this.shim.getSignatureHelpItems(fileName, position));
            }
            getRenameInfo(fileName, position) {
                return unwrapJSONCallResult(this.shim.getRenameInfo(fileName, position));
            }
            findRenameLocations(fileName, position, findInStrings, findInComments) {
                return unwrapJSONCallResult(this.shim.findRenameLocations(fileName, position, findInStrings, findInComments));
            }
            getDefinitionAtPosition(fileName, position) {
                return unwrapJSONCallResult(this.shim.getDefinitionAtPosition(fileName, position));
            }
            getDefinitionAndBoundSpan(fileName, position) {
                return unwrapJSONCallResult(this.shim.getDefinitionAndBoundSpan(fileName, position));
            }
            getTypeDefinitionAtPosition(fileName, position) {
                return unwrapJSONCallResult(this.shim.getTypeDefinitionAtPosition(fileName, position));
            }
            getImplementationAtPosition(fileName, position) {
                return unwrapJSONCallResult(this.shim.getImplementationAtPosition(fileName, position));
            }
            getReferencesAtPosition(fileName, position) {
                return unwrapJSONCallResult(this.shim.getReferencesAtPosition(fileName, position));
            }
            findReferences(fileName, position) {
                return unwrapJSONCallResult(this.shim.findReferences(fileName, position));
            }
            getOccurrencesAtPosition(fileName, position) {
                return unwrapJSONCallResult(this.shim.getOccurrencesAtPosition(fileName, position));
            }
            getDocumentHighlights(fileName, position, filesToSearch) {
                return unwrapJSONCallResult(this.shim.getDocumentHighlights(fileName, position, JSON.stringify(filesToSearch)));
            }
            getNavigateToItems(searchValue) {
                return unwrapJSONCallResult(this.shim.getNavigateToItems(searchValue));
            }
            getNavigationBarItems(fileName) {
                return unwrapJSONCallResult(this.shim.getNavigationBarItems(fileName));
            }
            getNavigationTree(fileName) {
                return unwrapJSONCallResult(this.shim.getNavigationTree(fileName));
            }
            getOutliningSpans(fileName) {
                return unwrapJSONCallResult(this.shim.getOutliningSpans(fileName));
            }
            getTodoComments(fileName, descriptors) {
                return unwrapJSONCallResult(this.shim.getTodoComments(fileName, JSON.stringify(descriptors)));
            }
            getBraceMatchingAtPosition(fileName, position) {
                return unwrapJSONCallResult(this.shim.getBraceMatchingAtPosition(fileName, position));
            }
            getIndentationAtPosition(fileName, position, options) {
                return unwrapJSONCallResult(this.shim.getIndentationAtPosition(fileName, position, JSON.stringify(options)));
            }
            getFormattingEditsForRange(fileName, start, end, options) {
                return unwrapJSONCallResult(this.shim.getFormattingEditsForRange(fileName, start, end, JSON.stringify(options)));
            }
            getFormattingEditsForDocument(fileName, options) {
                return unwrapJSONCallResult(this.shim.getFormattingEditsForDocument(fileName, JSON.stringify(options)));
            }
            getFormattingEditsAfterKeystroke(fileName, position, key, options) {
                return unwrapJSONCallResult(this.shim.getFormattingEditsAfterKeystroke(fileName, position, key, JSON.stringify(options)));
            }
            getDocCommentTemplateAtPosition(fileName, position) {
                return unwrapJSONCallResult(this.shim.getDocCommentTemplateAtPosition(fileName, position));
            }
            isValidBraceCompletionAtPosition(fileName, position, openingBrace) {
                return unwrapJSONCallResult(this.shim.isValidBraceCompletionAtPosition(fileName, position, openingBrace));
            }
            getSpanOfEnclosingComment(fileName, position, onlyMultiLine) {
                return unwrapJSONCallResult(this.shim.getSpanOfEnclosingComment(fileName, position, onlyMultiLine));
            }
            getCodeFixesAtPosition() {
                throw new Error("Not supported on the shim.");
            }
            getCodeFixDiagnostics() {
                throw new Error("Not supported on the shim.");
            }
            getEditsForRefactor() {
                throw new Error("Not supported on the shim.");
            }
            getApplicableRefactors() {
                throw new Error("Not supported on the shim.");
            }
            organizeImports(_scope, _formatOptions) {
                throw new Error("Not supported on the shim.");
            }
            getEditsForFileRename() {
                throw new Error("Not supported on the shim.");
            }
            getEmitOutput(fileName) {
                return unwrapJSONCallResult(this.shim.getEmitOutput(fileName));
            }
            getProgram() {
                throw new Error("Program can not be marshaled across the shim layer.");
            }
            getNonBoundSourceFile() {
                throw new Error("SourceFile can not be marshaled across the shim layer.");
            }
            getSourceFile() {
                throw new Error("SourceFile can not be marshaled across the shim layer.");
            }
            dispose() { this.shim.dispose({}); }
        }
        class ShimLanguageServiceAdapter {
            constructor(preprocessToResolve, cancellationToken, options) {
                this.host = new ShimLanguageServiceHost(preprocessToResolve, cancellationToken, options);
                this.factory = new TypeScript.Services.TypeScriptServicesFactory();
            }
            getHost() { return this.host; }
            getLanguageService() { return new LanguageServiceShimProxy(this.factory.createLanguageServiceShim(this.host)); }
            getClassifier() { return new ClassifierShimProxy(this.factory.createClassifierShim(this.host)); }
            getPreProcessedFileInfo(fileName, fileContents) {
                let shimResult;
                const coreServicesShim = this.factory.createCoreServicesShim(this.host);
                shimResult = unwrapJSONCallResult(coreServicesShim.getPreProcessedFileInfo(fileName, ts.ScriptSnapshot.fromString(fileContents)));
                const convertResult = {
                    referencedFiles: [],
                    importedFiles: [],
                    ambientExternalModules: [],
                    isLibFile: shimResult.isLibFile,
                    typeReferenceDirectives: []
                };
                ts.forEach(shimResult.referencedFiles, refFile => {
                    convertResult.referencedFiles.push({
                        fileName: refFile.path,
                        pos: refFile.position,
                        end: refFile.position + refFile.length
                    });
                });
                ts.forEach(shimResult.importedFiles, importedFile => {
                    convertResult.importedFiles.push({
                        fileName: importedFile.path,
                        pos: importedFile.position,
                        end: importedFile.position + importedFile.length
                    });
                });
                ts.forEach(shimResult.typeReferenceDirectives, typeRefDirective => {
                    convertResult.importedFiles.push({
                        fileName: typeRefDirective.path,
                        pos: typeRefDirective.position,
                        end: typeRefDirective.position + typeRefDirective.length
                    });
                });
                return convertResult;
            }
        }
        LanguageService.ShimLanguageServiceAdapter = ShimLanguageServiceAdapter;
        // Server adapter
        class SessionClientHost extends NativeLanguageServiceHost {
            constructor(cancellationToken, settings) {
                super(cancellationToken, settings);
                this.onMessage = ts.noop;
                this.writeMessage = ts.noop;
            }
            setClient(client) {
                this.client = client;
            }
            openFile(fileName, content, scriptKindName) {
                super.openFile(fileName, content, scriptKindName);
                this.client.openFile(fileName, content, scriptKindName);
            }
            editScript(fileName, start, end, newText) {
                super.editScript(fileName, start, end, newText);
                this.client.changeFile(fileName, start, end, newText);
            }
        }
        class SessionServerHost {
            constructor(host) {
                this.host = host;
                this.args = [];
                this.useCaseSensitiveFileNames = false;
                this.onMessage = ts.noop;
                this.writeMessage = ts.noop; // overridden
                this.writeFile = ts.noop;
                this.exit = ts.noop;
                this.close = ts.noop;
                this.newLine = this.host.getNewLine();
            }
            write(message) {
                this.writeMessage(message);
            }
            readFile(fileName) {
                if (ts.stringContains(fileName, Harness.Compiler.defaultLibFileName)) {
                    fileName = Harness.Compiler.defaultLibFileName;
                }
                const snapshot = this.host.getScriptSnapshot(fileName);
                return snapshot && ts.getSnapshotText(snapshot);
            }
            resolvePath(path) {
                return path;
            }
            fileExists(path) {
                return !!this.host.getScriptSnapshot(path);
            }
            directoryExists() {
                // for tests assume that directory exists
                return true;
            }
            getExecutingFilePath() {
                return "";
            }
            createDirectory(_directoryName) {
                return ts.notImplemented();
            }
            getCurrentDirectory() {
                return this.host.getCurrentDirectory();
            }
            getDirectories() {
                return [];
            }
            getEnvironmentVariable(name) {
                return ts.sys.getEnvironmentVariable(name);
            }
            readDirectory() { return ts.notImplemented(); }
            watchFile() {
                return { close: ts.noop };
            }
            watchDirectory() {
                return { close: ts.noop };
            }
            info(message) {
                this.host.log(message);
            }
            msg(message) {
                this.host.log(message);
            }
            loggingEnabled() {
                return true;
            }
            getLogFileName() {
                return undefined;
            }
            hasLevel() {
                return false;
            }
            startGroup() { throw ts.notImplemented(); }
            endGroup() { throw ts.notImplemented(); }
            perftrc(message) {
                return this.host.log(message);
            }
            setTimeout(callback, ms, ...args) {
                return setTimeout(callback, ms, args);
            }
            clearTimeout(timeoutId) {
                clearTimeout(timeoutId);
            }
            setImmediate(callback, _ms, ...args) {
                return setImmediate(callback, args);
            }
            clearImmediate(timeoutId) {
                clearImmediate(timeoutId);
            }
            createHash(s) {
                return Harness.mockHash(s);
            }
            require(_initialDir, _moduleName) {
                switch (_moduleName) {
                    // Adds to the Quick Info a fixed string and a string from the config file
                    // and replaces the first display part
                    case "quickinfo-augmeneter":
                        return {
                            module: () => ({
                                create(info) {
                                    const proxy = makeDefaultProxy(info);
                                    const langSvc = info.languageService;
                                    // tslint:disable-next-line only-arrow-functions
                                    proxy.getQuickInfoAtPosition = function () {
                                        const parts = langSvc.getQuickInfoAtPosition.apply(langSvc, arguments);
                                        if (parts.displayParts.length > 0) {
                                            parts.displayParts[0].text = "Proxied";
                                        }
                                        parts.displayParts.push({ text: info.config.message, kind: "punctuation" });
                                        return parts;
                                    };
                                    return proxy;
                                }
                            }),
                            error: undefined
                        };
                    // Throws during initialization
                    case "create-thrower":
                        return {
                            module: () => ({
                                create() {
                                    throw new Error("I am not a well-behaved plugin");
                                }
                            }),
                            error: undefined
                        };
                    // Adds another diagnostic
                    case "diagnostic-adder":
                        return {
                            module: () => ({
                                create(info) {
                                    const proxy = makeDefaultProxy(info);
                                    proxy.getSemanticDiagnostics = filename => {
                                        const prev = info.languageService.getSemanticDiagnostics(filename);
                                        const sourceFile = info.languageService.getSourceFile(filename);
                                        prev.push({
                                            category: ts.DiagnosticCategory.Warning,
                                            file: sourceFile,
                                            code: 9999,
                                            length: 3,
                                            messageText: `Plugin diagnostic`,
                                            start: 0
                                        });
                                        return prev;
                                    };
                                    return proxy;
                                }
                            }),
                            error: undefined
                        };
                    default:
                        return {
                            module: undefined,
                            error: new Error("Could not resolve module")
                        };
                }
                function makeDefaultProxy(info) {
                    // tslint:disable-next-line:no-null-keyword
                    const proxy = Object.create(/*prototype*/ null);
                    const langSvc = info.languageService;
                    for (const k of Object.keys(langSvc)) {
                        // tslint:disable-next-line only-arrow-functions
                        proxy[k] = function () {
                            return langSvc[k].apply(langSvc, arguments);
                        };
                    }
                    return proxy;
                }
            }
        }
        class ServerLanguageServiceAdapter {
            constructor(cancellationToken, options) {
                // This is the main host that tests use to direct tests
                const clientHost = new SessionClientHost(cancellationToken, options);
                const client = new ts.server.SessionClient(clientHost);
                // This host is just a proxy for the clientHost, it uses the client
                // host to answer server queries about files on disk
                const serverHost = new SessionServerHost(clientHost);
                const opts = {
                    host: serverHost,
                    cancellationToken: ts.server.nullCancellationToken,
                    useSingleInferredProject: false,
                    useInferredProjectPerProjectRoot: false,
                    typingsInstaller: undefined,
                    byteLength: Utils.byteLength,
                    hrtime: process.hrtime,
                    logger: serverHost,
                    canUseEvents: true
                };
                const server = new ts.server.Session(opts);
                // Fake the connection between the client and the server
                serverHost.writeMessage = client.onMessage.bind(client);
                clientHost.writeMessage = server.onMessage.bind(server);
                // Wire the client to the host to get notifications when a file is open
                // or edited.
                clientHost.setClient(client);
                // Set the properties
                this.client = client;
                this.host = clientHost;
            }
            getHost() { return this.host; }
            getLanguageService() { return this.client; }
            getClassifier() { throw new Error("getClassifier is not available using the server interface."); }
            getPreProcessedFileInfo() { throw new Error("getPreProcessedFileInfo is not available using the server interface."); }
        }
        LanguageService.ServerLanguageServiceAdapter = ServerLanguageServiceAdapter;
    })(LanguageService = Harness.LanguageService || (Harness.LanguageService = {}));
})(Harness || (Harness = {}));
