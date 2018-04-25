var ts;
(function (ts) {
    const ignoreDiagnosticCommentRegEx = /(^\s*$)|(^\s*\/\/\/?\s*(@ts-ignore)?)/;
    function findConfigFile(searchPath, fileExists, configName = "tsconfig.json") {
        return ts.forEachAncestorDirectory(searchPath, ancestor => {
            const fileName = ts.combinePaths(ancestor, configName);
            return fileExists(fileName) ? fileName : undefined;
        });
    }
    ts.findConfigFile = findConfigFile;
    function resolveTripleslashReference(moduleName, containingFile) {
        const basePath = ts.getDirectoryPath(containingFile);
        const referencedFileName = ts.isRootedDiskPath(moduleName) ? moduleName : ts.combinePaths(basePath, moduleName);
        return ts.normalizePath(referencedFileName);
    }
    ts.resolveTripleslashReference = resolveTripleslashReference;
    /* @internal */
    function computeCommonSourceDirectoryOfFilenames(fileNames, currentDirectory, getCanonicalFileName) {
        let commonPathComponents;
        const failed = ts.forEach(fileNames, sourceFile => {
            // Each file contributes into common source file path
            const sourcePathComponents = ts.getNormalizedPathComponents(sourceFile, currentDirectory);
            sourcePathComponents.pop(); // The base file name is not part of the common directory path
            if (!commonPathComponents) {
                // first file
                commonPathComponents = sourcePathComponents;
                return;
            }
            const n = Math.min(commonPathComponents.length, sourcePathComponents.length);
            for (let i = 0; i < n; i++) {
                if (getCanonicalFileName(commonPathComponents[i]) !== getCanonicalFileName(sourcePathComponents[i])) {
                    if (i === 0) {
                        // Failed to find any common path component
                        return true;
                    }
                    // New common path found that is 0 -> i-1
                    commonPathComponents.length = i;
                    break;
                }
            }
            // If the sourcePathComponents was shorter than the commonPathComponents, truncate to the sourcePathComponents
            if (sourcePathComponents.length < commonPathComponents.length) {
                commonPathComponents.length = sourcePathComponents.length;
            }
        });
        // A common path can not be found when paths span multiple drives on windows, for example
        if (failed) {
            return "";
        }
        if (!commonPathComponents) { // Can happen when all input files are .d.ts files
            return currentDirectory;
        }
        return ts.getNormalizedPathFromPathComponents(commonPathComponents);
    }
    ts.computeCommonSourceDirectoryOfFilenames = computeCommonSourceDirectoryOfFilenames;
    function createCompilerHost(options, setParentNodes) {
        const existingDirectories = ts.createMap();
        function getCanonicalFileName(fileName) {
            // if underlying system can distinguish between two files whose names differs only in cases then file name already in canonical form.
            // otherwise use toLowerCase as a canonical form.
            return ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase();
        }
        function getSourceFile(fileName, languageVersion, onError) {
            let text;
            try {
                ts.performance.mark("beforeIORead");
                text = ts.sys.readFile(fileName, options.charset);
                ts.performance.mark("afterIORead");
                ts.performance.measure("I/O Read", "beforeIORead", "afterIORead");
            }
            catch (e) {
                if (onError) {
                    onError(e.message);
                }
                text = "";
            }
            return text !== undefined ? ts.createSourceFile(fileName, text, languageVersion, setParentNodes) : undefined;
        }
        function directoryExists(directoryPath) {
            if (existingDirectories.has(directoryPath)) {
                return true;
            }
            if (ts.sys.directoryExists(directoryPath)) {
                existingDirectories.set(directoryPath, true);
                return true;
            }
            return false;
        }
        function ensureDirectoriesExist(directoryPath) {
            if (directoryPath.length > ts.getRootLength(directoryPath) && !directoryExists(directoryPath)) {
                const parentDirectory = ts.getDirectoryPath(directoryPath);
                ensureDirectoriesExist(parentDirectory);
                ts.sys.createDirectory(directoryPath);
            }
        }
        let outputFingerprints;
        function writeFileIfUpdated(fileName, data, writeByteOrderMark) {
            if (!outputFingerprints) {
                outputFingerprints = ts.createMap();
            }
            const hash = ts.sys.createHash(data);
            const mtimeBefore = ts.sys.getModifiedTime(fileName);
            if (mtimeBefore) {
                const fingerprint = outputFingerprints.get(fileName);
                // If output has not been changed, and the file has no external modification
                if (fingerprint &&
                    fingerprint.byteOrderMark === writeByteOrderMark &&
                    fingerprint.hash === hash &&
                    fingerprint.mtime.getTime() === mtimeBefore.getTime()) {
                    return;
                }
            }
            ts.sys.writeFile(fileName, data, writeByteOrderMark);
            const mtimeAfter = ts.sys.getModifiedTime(fileName);
            outputFingerprints.set(fileName, {
                hash,
                byteOrderMark: writeByteOrderMark,
                mtime: mtimeAfter
            });
        }
        function writeFile(fileName, data, writeByteOrderMark, onError) {
            try {
                ts.performance.mark("beforeIOWrite");
                ensureDirectoriesExist(ts.getDirectoryPath(ts.normalizePath(fileName)));
                if (ts.isWatchSet(options) && ts.sys.createHash && ts.sys.getModifiedTime) {
                    writeFileIfUpdated(fileName, data, writeByteOrderMark);
                }
                else {
                    ts.sys.writeFile(fileName, data, writeByteOrderMark);
                }
                ts.performance.mark("afterIOWrite");
                ts.performance.measure("I/O Write", "beforeIOWrite", "afterIOWrite");
            }
            catch (e) {
                if (onError) {
                    onError(e.message);
                }
            }
        }
        function getDefaultLibLocation() {
            return ts.getDirectoryPath(ts.normalizePath(ts.sys.getExecutingFilePath()));
        }
        const newLine = ts.getNewLineCharacter(options);
        const realpath = ts.sys.realpath && ((path) => ts.sys.realpath(path));
        return {
            getSourceFile,
            getDefaultLibLocation,
            getDefaultLibFileName: options => ts.combinePaths(getDefaultLibLocation(), ts.getDefaultLibFileName(options)),
            writeFile,
            getCurrentDirectory: ts.memoize(() => ts.sys.getCurrentDirectory()),
            useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
            getCanonicalFileName,
            getNewLine: () => newLine,
            fileExists: fileName => ts.sys.fileExists(fileName),
            readFile: fileName => ts.sys.readFile(fileName),
            trace: (s) => ts.sys.write(s + newLine),
            directoryExists: directoryName => ts.sys.directoryExists(directoryName),
            getEnvironmentVariable: name => ts.sys.getEnvironmentVariable ? ts.sys.getEnvironmentVariable(name) : "",
            getDirectories: (path) => ts.sys.getDirectories(path),
            realpath
        };
    }
    ts.createCompilerHost = createCompilerHost;
    function getPreEmitDiagnostics(program, sourceFile, cancellationToken) {
        const diagnostics = [
            ...program.getConfigFileParsingDiagnostics(),
            ...program.getOptionsDiagnostics(cancellationToken),
            ...program.getSyntacticDiagnostics(sourceFile, cancellationToken),
            ...program.getGlobalDiagnostics(cancellationToken),
            ...program.getSemanticDiagnostics(sourceFile, cancellationToken)
        ];
        if (program.getCompilerOptions().declaration) {
            ts.addRange(diagnostics, program.getDeclarationDiagnostics(sourceFile, cancellationToken));
        }
        return ts.sortAndDeduplicateDiagnostics(diagnostics);
    }
    ts.getPreEmitDiagnostics = getPreEmitDiagnostics;
    function formatDiagnostics(diagnostics, host) {
        let output = "";
        for (const diagnostic of diagnostics) {
            output += formatDiagnostic(diagnostic, host);
        }
        return output;
    }
    ts.formatDiagnostics = formatDiagnostics;
    function formatDiagnostic(diagnostic, host) {
        const errorMessage = `${ts.diagnosticCategoryName(diagnostic)} TS${diagnostic.code}: ${flattenDiagnosticMessageText(diagnostic.messageText, host.getNewLine())}${host.getNewLine()}`;
        if (diagnostic.file) {
            const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
            const fileName = diagnostic.file.fileName;
            const relativeFileName = ts.convertToRelativePath(fileName, host.getCurrentDirectory(), fileName => host.getCanonicalFileName(fileName));
            return `${relativeFileName}(${line + 1},${character + 1}): ` + errorMessage;
        }
        return errorMessage;
    }
    ts.formatDiagnostic = formatDiagnostic;
    /** @internal */
    let ForegroundColorEscapeSequences;
    (function (ForegroundColorEscapeSequences) {
        ForegroundColorEscapeSequences["Grey"] = "\u001B[90m";
        ForegroundColorEscapeSequences["Red"] = "\u001B[91m";
        ForegroundColorEscapeSequences["Yellow"] = "\u001B[93m";
        ForegroundColorEscapeSequences["Blue"] = "\u001B[94m";
        ForegroundColorEscapeSequences["Cyan"] = "\u001B[96m";
    })(ForegroundColorEscapeSequences = ts.ForegroundColorEscapeSequences || (ts.ForegroundColorEscapeSequences = {}));
    const gutterStyleSequence = "\u001b[30;47m";
    const gutterSeparator = " ";
    const resetEscapeSequence = "\u001b[0m";
    const ellipsis = "...";
    function getCategoryFormat(category) {
        switch (category) {
            case ts.DiagnosticCategory.Error: return ForegroundColorEscapeSequences.Red;
            case ts.DiagnosticCategory.Warning: return ForegroundColorEscapeSequences.Yellow;
            case ts.DiagnosticCategory.Suggestion: return ts.Debug.fail("Should never get an Info diagnostic on the command line.");
            case ts.DiagnosticCategory.Message: return ForegroundColorEscapeSequences.Blue;
        }
    }
    /** @internal */
    function formatColorAndReset(text, formatStyle) {
        return formatStyle + text + resetEscapeSequence;
    }
    ts.formatColorAndReset = formatColorAndReset;
    function padLeft(s, length) {
        while (s.length < length) {
            s = " " + s;
        }
        return s;
    }
    function formatDiagnosticsWithColorAndContext(diagnostics, host) {
        let output = "";
        for (const diagnostic of diagnostics) {
            let context = "";
            if (diagnostic.file) {
                const { start, length, file } = diagnostic;
                const { line: firstLine, character: firstLineChar } = ts.getLineAndCharacterOfPosition(file, start);
                const { line: lastLine, character: lastLineChar } = ts.getLineAndCharacterOfPosition(file, start + length);
                const lastLineInFile = ts.getLineAndCharacterOfPosition(file, file.text.length).line;
                const relativeFileName = host ? ts.convertToRelativePath(file.fileName, host.getCurrentDirectory(), fileName => host.getCanonicalFileName(fileName)) : file.fileName;
                const hasMoreThanFiveLines = (lastLine - firstLine) >= 4;
                let gutterWidth = (lastLine + 1 + "").length;
                if (hasMoreThanFiveLines) {
                    gutterWidth = Math.max(ellipsis.length, gutterWidth);
                }
                for (let i = firstLine; i <= lastLine; i++) {
                    context += host.getNewLine();
                    // If the error spans over 5 lines, we'll only show the first 2 and last 2 lines,
                    // so we'll skip ahead to the second-to-last line.
                    if (hasMoreThanFiveLines && firstLine + 1 < i && i < lastLine - 1) {
                        context += formatColorAndReset(padLeft(ellipsis, gutterWidth), gutterStyleSequence) + gutterSeparator + host.getNewLine();
                        i = lastLine - 1;
                    }
                    const lineStart = ts.getPositionOfLineAndCharacter(file, i, 0);
                    const lineEnd = i < lastLineInFile ? ts.getPositionOfLineAndCharacter(file, i + 1, 0) : file.text.length;
                    let lineContent = file.text.slice(lineStart, lineEnd);
                    lineContent = lineContent.replace(/\s+$/g, ""); // trim from end
                    lineContent = lineContent.replace("\t", " "); // convert tabs to single spaces
                    // Output the gutter and the actual contents of the line.
                    context += formatColorAndReset(padLeft(i + 1 + "", gutterWidth), gutterStyleSequence) + gutterSeparator;
                    context += lineContent + host.getNewLine();
                    // Output the gutter and the error span for the line using tildes.
                    context += formatColorAndReset(padLeft("", gutterWidth), gutterStyleSequence) + gutterSeparator;
                    context += ForegroundColorEscapeSequences.Red;
                    if (i === firstLine) {
                        // If we're on the last line, then limit it to the last character of the last line.
                        // Otherwise, we'll just squiggle the rest of the line, giving 'slice' no end position.
                        const lastCharForLine = i === lastLine ? lastLineChar : undefined;
                        context += lineContent.slice(0, firstLineChar).replace(/\S/g, " ");
                        context += lineContent.slice(firstLineChar, lastCharForLine).replace(/./g, "~");
                    }
                    else if (i === lastLine) {
                        context += lineContent.slice(0, lastLineChar).replace(/./g, "~");
                    }
                    else {
                        // Squiggle the entire line.
                        context += lineContent.replace(/./g, "~");
                    }
                    context += resetEscapeSequence;
                }
                output += formatColorAndReset(relativeFileName, ForegroundColorEscapeSequences.Cyan);
                output += ":";
                output += formatColorAndReset(`${firstLine + 1}`, ForegroundColorEscapeSequences.Yellow);
                output += ":";
                output += formatColorAndReset(`${firstLineChar + 1}`, ForegroundColorEscapeSequences.Yellow);
                output += " - ";
            }
            output += formatColorAndReset(ts.diagnosticCategoryName(diagnostic), getCategoryFormat(diagnostic.category));
            output += formatColorAndReset(` TS${diagnostic.code}: `, ForegroundColorEscapeSequences.Grey);
            output += flattenDiagnosticMessageText(diagnostic.messageText, host.getNewLine());
            if (diagnostic.file) {
                output += host.getNewLine();
                output += context;
            }
            output += host.getNewLine();
        }
        return output + host.getNewLine();
    }
    ts.formatDiagnosticsWithColorAndContext = formatDiagnosticsWithColorAndContext;
    function flattenDiagnosticMessageText(messageText, newLine) {
        if (ts.isString(messageText)) {
            return messageText;
        }
        else {
            let diagnosticChain = messageText;
            let result = "";
            let indent = 0;
            while (diagnosticChain) {
                if (indent) {
                    result += newLine;
                    for (let i = 0; i < indent; i++) {
                        result += "  ";
                    }
                }
                result += diagnosticChain.messageText;
                indent++;
                diagnosticChain = diagnosticChain.next;
            }
            return result;
        }
    }
    ts.flattenDiagnosticMessageText = flattenDiagnosticMessageText;
    function loadWithLocalCache(names, containingFile, loader) {
        if (names.length === 0) {
            return [];
        }
        const resolutions = [];
        const cache = ts.createMap();
        for (const name of names) {
            let result;
            if (cache.has(name)) {
                result = cache.get(name);
            }
            else {
                cache.set(name, result = loader(name, containingFile));
            }
            resolutions.push(result);
        }
        return resolutions;
    }
    /**
     * Determines if program structure is upto date or needs to be recreated
     */
    /* @internal */
    function isProgramUptoDate(program, rootFileNames, newOptions, getSourceVersion, fileExists, hasInvalidatedResolution, hasChangedAutomaticTypeDirectiveNames) {
        // If we haven't created a program yet or have changed automatic type directives, then it is not up-to-date
        if (!program || hasChangedAutomaticTypeDirectiveNames) {
            return false;
        }
        // If number of files in the program do not match, it is not up-to-date
        if (program.getRootFileNames().length !== rootFileNames.length) {
            return false;
        }
        // If any file is not up-to-date, then the whole program is not up-to-date
        if (program.getSourceFiles().some(sourceFileNotUptoDate)) {
            return false;
        }
        // If any of the missing file paths are now created
        if (program.getMissingFilePaths().some(fileExists)) {
            return false;
        }
        const currentOptions = program.getCompilerOptions();
        // If the compilation settings do no match, then the program is not up-to-date
        if (!ts.compareDataObjects(currentOptions, newOptions)) {
            return false;
        }
        // If everything matches but the text of config file is changed,
        // error locations can change for program options, so update the program
        if (currentOptions.configFile && newOptions.configFile) {
            return currentOptions.configFile.text === newOptions.configFile.text;
        }
        return true;
        function sourceFileNotUptoDate(sourceFile) {
            return sourceFile.version !== getSourceVersion(sourceFile.path) ||
                hasInvalidatedResolution(sourceFile.path);
        }
    }
    ts.isProgramUptoDate = isProgramUptoDate;
    function getConfigFileParsingDiagnostics(configFileParseResult) {
        return configFileParseResult.options.configFile ?
            configFileParseResult.options.configFile.parseDiagnostics.concat(configFileParseResult.errors) :
            configFileParseResult.errors;
    }
    ts.getConfigFileParsingDiagnostics = getConfigFileParsingDiagnostics;
    /**
     * Determined if source file needs to be re-created even if its text hasn't changed
     */
    function shouldProgramCreateNewSourceFiles(program, newOptions) {
        // If any of these options change, we can't reuse old source file even if version match
        // The change in options like these could result in change in syntax tree change
        const oldOptions = program && program.getCompilerOptions();
        return oldOptions && (oldOptions.target !== newOptions.target ||
            oldOptions.module !== newOptions.module ||
            oldOptions.moduleResolution !== newOptions.moduleResolution ||
            oldOptions.noResolve !== newOptions.noResolve ||
            oldOptions.jsx !== newOptions.jsx ||
            oldOptions.allowJs !== newOptions.allowJs ||
            oldOptions.disableSizeLimit !== newOptions.disableSizeLimit ||
            oldOptions.baseUrl !== newOptions.baseUrl ||
            !ts.equalOwnProperties(oldOptions.paths, newOptions.paths));
    }
    /**
     * Create a new 'Program' instance. A Program is an immutable collection of 'SourceFile's and a 'CompilerOptions'
     * that represent a compilation unit.
     *
     * Creating a program proceeds from a set of root files, expanding the set of inputs by following imports and
     * triple-slash-reference-path directives transitively. '@types' and triple-slash-reference-types are also pulled in.
     *
     * @param rootNames - A set of root files.
     * @param options - The compiler options which should be used.
     * @param host - The host interacts with the underlying file system.
     * @param oldProgram - Reuses an old program structure.
     * @param configFileParsingDiagnostics - error during config file parsing
     * @returns A 'Program' object.
     */
    function createProgram(rootNames, options, host, oldProgram, configFileParsingDiagnostics) {
        let program;
        let files = [];
        let commonSourceDirectory;
        let diagnosticsProducingTypeChecker;
        let noDiagnosticsTypeChecker;
        let classifiableNames;
        let modifiedFilePaths;
        const cachedSemanticDiagnosticsForFile = {};
        const cachedDeclarationDiagnosticsForFile = {};
        let resolvedTypeReferenceDirectives = ts.createMap();
        let fileProcessingDiagnostics = ts.createDiagnosticCollection();
        // The below settings are to track if a .js file should be add to the program if loaded via searching under node_modules.
        // This works as imported modules are discovered recursively in a depth first manner, specifically:
        // - For each root file, findSourceFile is called.
        // - This calls processImportedModules for each module imported in the source file.
        // - This calls resolveModuleNames, and then calls findSourceFile for each resolved module.
        // As all these operations happen - and are nested - within the createProgram call, they close over the below variables.
        // The current resolution depth is tracked by incrementing/decrementing as the depth first search progresses.
        const maxNodeModuleJsDepth = typeof options.maxNodeModuleJsDepth === "number" ? options.maxNodeModuleJsDepth : 0;
        let currentNodeModulesDepth = 0;
        // If a module has some of its imports skipped due to being at the depth limit under node_modules, then track
        // this, as it may be imported at a shallower depth later, and then it will need its skipped imports processed.
        const modulesWithElidedImports = ts.createMap();
        // Track source files that are source files found by searching under node_modules, as these shouldn't be compiled.
        const sourceFilesFoundSearchingNodeModules = ts.createMap();
        ts.performance.mark("beforeProgram");
        host = host || createCompilerHost(options);
        let skipDefaultLib = options.noLib;
        const getDefaultLibraryFileName = ts.memoize(() => host.getDefaultLibFileName(options));
        const defaultLibraryPath = host.getDefaultLibLocation ? host.getDefaultLibLocation() : ts.getDirectoryPath(getDefaultLibraryFileName());
        const programDiagnostics = ts.createDiagnosticCollection();
        const currentDirectory = host.getCurrentDirectory();
        const supportedExtensions = ts.getSupportedExtensions(options);
        // Map storing if there is emit blocking diagnostics for given input
        const hasEmitBlockingDiagnostics = ts.createMap();
        let _compilerOptionsObjectLiteralSyntax;
        let moduleResolutionCache;
        let resolveModuleNamesWorker;
        const hasInvalidatedResolution = host.hasInvalidatedResolution || ts.returnFalse;
        if (host.resolveModuleNames) {
            resolveModuleNamesWorker = (moduleNames, containingFile, reusedNames) => host.resolveModuleNames(ts.Debug.assertEachDefined(moduleNames), containingFile, reusedNames).map(resolved => {
                // An older host may have omitted extension, in which case we should infer it from the file extension of resolvedFileName.
                if (!resolved || resolved.extension !== undefined) {
                    return resolved;
                }
                const withExtension = ts.clone(resolved);
                withExtension.extension = ts.extensionFromPath(resolved.resolvedFileName);
                return withExtension;
            });
        }
        else {
            moduleResolutionCache = ts.createModuleResolutionCache(currentDirectory, x => host.getCanonicalFileName(x));
            const loader = (moduleName, containingFile) => ts.resolveModuleName(moduleName, containingFile, options, host, moduleResolutionCache).resolvedModule;
            resolveModuleNamesWorker = (moduleNames, containingFile) => loadWithLocalCache(ts.Debug.assertEachDefined(moduleNames), containingFile, loader);
        }
        let resolveTypeReferenceDirectiveNamesWorker;
        if (host.resolveTypeReferenceDirectives) {
            resolveTypeReferenceDirectiveNamesWorker = (typeDirectiveNames, containingFile) => host.resolveTypeReferenceDirectives(ts.Debug.assertEachDefined(typeDirectiveNames), containingFile);
        }
        else {
            const loader = (typesRef, containingFile) => ts.resolveTypeReferenceDirective(typesRef, containingFile, options, host).resolvedTypeReferenceDirective;
            resolveTypeReferenceDirectiveNamesWorker = (typeReferenceDirectiveNames, containingFile) => loadWithLocalCache(ts.Debug.assertEachDefined(typeReferenceDirectiveNames), containingFile, loader);
        }
        // Map from a stringified PackageId to the source file with that id.
        // Only one source file may have a given packageId. Others become redirects (see createRedirectSourceFile).
        // `packageIdToSourceFile` is only used while building the program, while `sourceFileToPackageName` and `isSourceFileTargetOfRedirect` are kept around.
        const packageIdToSourceFile = ts.createMap();
        // Maps from a SourceFile's `.path` to the name of the package it was imported with.
        let sourceFileToPackageName = ts.createMap();
        let redirectTargetsSet = ts.createMap();
        const filesByName = ts.createMap();
        let missingFilePaths;
        // stores 'filename -> file association' ignoring case
        // used to track cases when two file names differ only in casing
        const filesByNameIgnoreCase = host.useCaseSensitiveFileNames() ? ts.createMap() : undefined;
        const shouldCreateNewSourceFile = shouldProgramCreateNewSourceFiles(oldProgram, options);
        const structuralIsReused = tryReuseStructureFromOldProgram();
        if (structuralIsReused !== 2 /* Completely */) {
            ts.forEach(rootNames, name => processRootFile(name, /*isDefaultLib*/ false));
            // load type declarations specified via 'types' argument or implicitly from types/ and node_modules/@types folders
            const typeReferences = ts.getAutomaticTypeDirectiveNames(options, host);
            if (typeReferences.length) {
                // This containingFilename needs to match with the one used in managed-side
                const containingDirectory = options.configFilePath ? ts.getDirectoryPath(options.configFilePath) : host.getCurrentDirectory();
                const containingFilename = ts.combinePaths(containingDirectory, "__inferred type names__.ts");
                const resolutions = resolveTypeReferenceDirectiveNamesWorker(typeReferences, containingFilename);
                for (let i = 0; i < typeReferences.length; i++) {
                    processTypeReferenceDirective(typeReferences[i], resolutions[i]);
                }
            }
            // Do not process the default library if:
            //  - The '--noLib' flag is used.
            //  - A 'no-default-lib' reference comment is encountered in
            //      processing the root files.
            if (!skipDefaultLib) {
                // If '--lib' is not specified, include default library file according to '--target'
                // otherwise, using options specified in '--lib' instead of '--target' default library file
                const defaultLibraryFileName = getDefaultLibraryFileName();
                if (!options.lib && defaultLibraryFileName) {
                    processRootFile(defaultLibraryFileName, /*isDefaultLib*/ true);
                }
                else {
                    ts.forEach(options.lib, libFileName => {
                        processRootFile(ts.combinePaths(defaultLibraryPath, libFileName), /*isDefaultLib*/ true);
                    });
                }
            }
            missingFilePaths = ts.arrayFrom(filesByName.keys(), p => p).filter(p => !filesByName.get(p));
        }
        ts.Debug.assert(!!missingFilePaths);
        // Release any files we have acquired in the old program but are
        // not part of the new program.
        if (oldProgram && host.onReleaseOldSourceFile) {
            const oldSourceFiles = oldProgram.getSourceFiles();
            for (const oldSourceFile of oldSourceFiles) {
                if (!getSourceFile(oldSourceFile.path) || shouldCreateNewSourceFile) {
                    host.onReleaseOldSourceFile(oldSourceFile, oldProgram.getCompilerOptions());
                }
            }
        }
        // unconditionally set oldProgram to undefined to prevent it from being captured in closure
        oldProgram = undefined;
        program = {
            getRootFileNames: () => rootNames,
            getSourceFile,
            getSourceFileByPath,
            getSourceFiles: () => files,
            getMissingFilePaths: () => missingFilePaths,
            getCompilerOptions: () => options,
            getSyntacticDiagnostics,
            getOptionsDiagnostics,
            getGlobalDiagnostics,
            getSemanticDiagnostics,
            getDeclarationDiagnostics,
            getTypeChecker,
            getClassifiableNames,
            getDiagnosticsProducingTypeChecker,
            getCommonSourceDirectory,
            emit,
            getCurrentDirectory: () => currentDirectory,
            getNodeCount: () => getDiagnosticsProducingTypeChecker().getNodeCount(),
            getIdentifierCount: () => getDiagnosticsProducingTypeChecker().getIdentifierCount(),
            getSymbolCount: () => getDiagnosticsProducingTypeChecker().getSymbolCount(),
            getTypeCount: () => getDiagnosticsProducingTypeChecker().getTypeCount(),
            getFileProcessingDiagnostics: () => fileProcessingDiagnostics,
            getResolvedTypeReferenceDirectives: () => resolvedTypeReferenceDirectives,
            isSourceFileFromExternalLibrary,
            isSourceFileDefaultLibrary,
            dropDiagnosticsProducingTypeChecker,
            getSourceFileFromReference,
            sourceFileToPackageName,
            redirectTargetsSet,
            isEmittedFile,
            getConfigFileParsingDiagnostics,
            getResolvedModuleWithFailedLookupLocationsFromCache,
        };
        verifyCompilerOptions();
        ts.performance.mark("afterProgram");
        ts.performance.measure("Program", "beforeProgram", "afterProgram");
        return program;
        function getResolvedModuleWithFailedLookupLocationsFromCache(moduleName, containingFile) {
            return moduleResolutionCache && ts.resolveModuleNameFromCache(moduleName, containingFile, moduleResolutionCache);
        }
        function toPath(fileName) {
            return ts.toPath(fileName, currentDirectory, getCanonicalFileName);
        }
        function getCommonSourceDirectory() {
            if (commonSourceDirectory === undefined) {
                const emittedFiles = ts.filter(files, file => ts.sourceFileMayBeEmitted(file, options, isSourceFileFromExternalLibrary));
                if (options.rootDir && checkSourceFilesBelongToPath(emittedFiles, options.rootDir)) {
                    // If a rootDir is specified and is valid use it as the commonSourceDirectory
                    commonSourceDirectory = ts.getNormalizedAbsolutePath(options.rootDir, currentDirectory);
                }
                else {
                    commonSourceDirectory = computeCommonSourceDirectory(emittedFiles);
                }
                if (commonSourceDirectory && commonSourceDirectory[commonSourceDirectory.length - 1] !== ts.directorySeparator) {
                    // Make sure directory path ends with directory separator so this string can directly
                    // used to replace with "" to get the relative path of the source file and the relative path doesn't
                    // start with / making it rooted path
                    commonSourceDirectory += ts.directorySeparator;
                }
            }
            return commonSourceDirectory;
        }
        function getClassifiableNames() {
            if (!classifiableNames) {
                // Initialize a checker so that all our files are bound.
                getTypeChecker();
                classifiableNames = ts.createUnderscoreEscapedMap();
                for (const sourceFile of files) {
                    ts.copyEntries(sourceFile.classifiableNames, classifiableNames);
                }
            }
            return classifiableNames;
        }
        function resolveModuleNamesReusingOldState(moduleNames, containingFile, file, oldProgramState) {
            if (structuralIsReused === 0 /* Not */ && !file.ambientModuleNames.length) {
                // If the old program state does not permit reusing resolutions and `file` does not contain locally defined ambient modules,
                // the best we can do is fallback to the default logic.
                return resolveModuleNamesWorker(moduleNames, containingFile);
            }
            const oldSourceFile = oldProgramState.program && oldProgramState.program.getSourceFile(containingFile);
            if (oldSourceFile !== file && file.resolvedModules) {
                // `file` was created for the new program.
                //
                // We only set `file.resolvedModules` via work from the current function,
                // so it is defined iff we already called the current function on `file`.
                // That call happened no later than the creation of the `file` object,
                // which per above occured during the current program creation.
                // Since we assume the filesystem does not change during program creation,
                // it is safe to reuse resolutions from the earlier call.
                const result = [];
                for (const moduleName of moduleNames) {
                    const resolvedModule = file.resolvedModules.get(moduleName);
                    result.push(resolvedModule);
                }
                return result;
            }
            // At this point, we know at least one of the following hold:
            // - file has local declarations for ambient modules
            // - old program state is available
            // With this information, we can infer some module resolutions without performing resolution.
            /** An ordered list of module names for which we cannot recover the resolution. */
            let unknownModuleNames;
            /**
             * The indexing of elements in this list matches that of `moduleNames`.
             *
             * Before combining results, result[i] is in one of the following states:
             * * undefined: needs to be recomputed,
             * * predictedToResolveToAmbientModuleMarker: known to be an ambient module.
             * Needs to be reset to undefined before returning,
             * * ResolvedModuleFull instance: can be reused.
             */
            let result;
            let reusedNames;
            /** A transient placeholder used to mark predicted resolution in the result list. */
            const predictedToResolveToAmbientModuleMarker = {};
            for (let i = 0; i < moduleNames.length; i++) {
                const moduleName = moduleNames[i];
                // If the source file is unchanged and doesnt have invalidated resolution, reuse the module resolutions
                if (file === oldSourceFile && !hasInvalidatedResolution(oldSourceFile.path)) {
                    const oldResolvedModule = oldSourceFile && oldSourceFile.resolvedModules.get(moduleName);
                    if (oldResolvedModule) {
                        if (ts.isTraceEnabled(options, host)) {
                            ts.trace(host, Diagnostics.Reusing_resolution_of_module_0_to_file_1_from_old_program, moduleName, containingFile);
                        }
                        (result || (result = new Array(moduleNames.length)))[i] = oldResolvedModule;
                        (reusedNames || (reusedNames = [])).push(moduleName);
                        continue;
                    }
                }
                // We know moduleName resolves to an ambient module provided that moduleName:
                // - is in the list of ambient modules locally declared in the current source file.
                // - resolved to an ambient module in the old program whose declaration is in an unmodified file
                //   (so the same module declaration will land in the new program)
                let resolvesToAmbientModuleInNonModifiedFile = false;
                if (ts.contains(file.ambientModuleNames, moduleName)) {
                    resolvesToAmbientModuleInNonModifiedFile = true;
                    if (ts.isTraceEnabled(options, host)) {
                        ts.trace(host, Diagnostics.Module_0_was_resolved_as_locally_declared_ambient_module_in_file_1, moduleName, containingFile);
                    }
                }
                else {
                    resolvesToAmbientModuleInNonModifiedFile = moduleNameResolvesToAmbientModuleInNonModifiedFile(moduleName, oldProgramState);
                }
                if (resolvesToAmbientModuleInNonModifiedFile) {
                    (result || (result = new Array(moduleNames.length)))[i] = predictedToResolveToAmbientModuleMarker;
                }
                else {
                    // Resolution failed in the old program, or resolved to an ambient module for which we can't reuse the result.
                    (unknownModuleNames || (unknownModuleNames = [])).push(moduleName);
                }
            }
            const resolutions = unknownModuleNames && unknownModuleNames.length
                ? resolveModuleNamesWorker(unknownModuleNames, containingFile, reusedNames)
                : ts.emptyArray;
            // Combine results of resolutions and predicted results
            if (!result) {
                // There were no unresolved/ambient resolutions.
                ts.Debug.assert(resolutions.length === moduleNames.length);
                return resolutions;
            }
            let j = 0;
            for (let i = 0; i < result.length; i++) {
                if (result[i]) {
                    // `result[i]` is either a `ResolvedModuleFull` or a marker.
                    // If it is the former, we can leave it as is.
                    if (result[i] === predictedToResolveToAmbientModuleMarker) {
                        result[i] = undefined;
                    }
                }
                else {
                    result[i] = resolutions[j];
                    j++;
                }
            }
            ts.Debug.assert(j === resolutions.length);
            return result;
            // If we change our policy of rechecking failed lookups on each program create,
            // we should adjust the value returned here.
            function moduleNameResolvesToAmbientModuleInNonModifiedFile(moduleName, oldProgramState) {
                const resolutionToFile = ts.getResolvedModule(oldProgramState.oldSourceFile, moduleName);
                const resolvedFile = resolutionToFile && oldProgramState.program && oldProgramState.program.getSourceFile(resolutionToFile.resolvedFileName);
                if (resolutionToFile && resolvedFile && !resolvedFile.externalModuleIndicator) {
                    // In the old program, we resolved to an ambient module that was in the same
                    //   place as we expected to find an actual module file.
                    // We actually need to return 'false' here even though this seems like a 'true' case
                    //   because the normal module resolution algorithm will find this anyway.
                    return false;
                }
                const ambientModule = oldProgramState.program && oldProgramState.program.getTypeChecker().tryFindAmbientModuleWithoutAugmentations(moduleName);
                if (!(ambientModule && ambientModule.declarations)) {
                    return false;
                }
                // at least one of declarations should come from non-modified source file
                const firstUnmodifiedFile = ts.forEach(ambientModule.declarations, d => {
                    const f = ts.getSourceFileOfNode(d);
                    return !ts.contains(oldProgramState.modifiedFilePaths, f.path) && f;
                });
                if (!firstUnmodifiedFile) {
                    return false;
                }
                if (ts.isTraceEnabled(options, host)) {
                    ts.trace(host, Diagnostics.Module_0_was_resolved_as_ambient_module_declared_in_1_since_this_file_was_not_modified, moduleName, firstUnmodifiedFile.fileName);
                }
                return true;
            }
        }
        function tryReuseStructureFromOldProgram() {
            if (!oldProgram) {
                return 0 /* Not */;
            }
            // check properties that can affect structure of the program or module resolution strategy
            // if any of these properties has changed - structure cannot be reused
            const oldOptions = oldProgram.getCompilerOptions();
            if (ts.changesAffectModuleResolution(oldOptions, options)) {
                return oldProgram.structureIsReused = 0 /* Not */;
            }
            ts.Debug.assert(!(oldProgram.structureIsReused & (2 /* Completely */ | 1 /* SafeModules */)));
            // there is an old program, check if we can reuse its structure
            const oldRootNames = oldProgram.getRootFileNames();
            if (!ts.arrayIsEqualTo(oldRootNames, rootNames)) {
                return oldProgram.structureIsReused = 0 /* Not */;
            }
            if (!ts.arrayIsEqualTo(options.types, oldOptions.types)) {
                return oldProgram.structureIsReused = 0 /* Not */;
            }
            // check if program source files has changed in the way that can affect structure of the program
            const newSourceFiles = [];
            const filePaths = [];
            const modifiedSourceFiles = [];
            oldProgram.structureIsReused = 2 /* Completely */;
            // If the missing file paths are now present, it can change the progam structure,
            // and hence cant reuse the structure.
            // This is same as how we dont reuse the structure if one of the file from old program is now missing
            if (oldProgram.getMissingFilePaths().some(missingFilePath => host.fileExists(missingFilePath))) {
                return oldProgram.structureIsReused = 0 /* Not */;
            }
            const oldSourceFiles = oldProgram.getSourceFiles();
            const seenPackageNames = ts.createMap();
            for (const oldSourceFile of oldSourceFiles) {
                let newSourceFile = host.getSourceFileByPath
                    ? host.getSourceFileByPath(oldSourceFile.fileName, oldSourceFile.path, options.target, /*onError*/ undefined, shouldCreateNewSourceFile)
                    : host.getSourceFile(oldSourceFile.fileName, options.target, /*onError*/ undefined, shouldCreateNewSourceFile);
                if (!newSourceFile) {
                    return oldProgram.structureIsReused = 0 /* Not */;
                }
                ts.Debug.assert(!newSourceFile.redirectInfo, "Host should not return a redirect source file from `getSourceFile`");
                let fileChanged;
                if (oldSourceFile.redirectInfo) {
                    // We got `newSourceFile` by path, so it is actually for the unredirected file.
                    // This lets us know if the unredirected file has changed. If it has we should break the redirect.
                    if (newSourceFile !== oldSourceFile.redirectInfo.unredirected) {
                        // Underlying file has changed. Might not redirect anymore. Must rebuild program.
                        return oldProgram.structureIsReused = 0 /* Not */;
                    }
                    fileChanged = false;
                    newSourceFile = oldSourceFile; // Use the redirect.
                }
                else if (oldProgram.redirectTargetsSet.has(oldSourceFile.path)) {
                    // If a redirected-to source file changes, the redirect may be broken.
                    if (newSourceFile !== oldSourceFile) {
                        return oldProgram.structureIsReused = 0 /* Not */;
                    }
                    fileChanged = false;
                }
                else {
                    fileChanged = newSourceFile !== oldSourceFile;
                }
                newSourceFile.path = oldSourceFile.path;
                filePaths.push(newSourceFile.path);
                const packageName = oldProgram.sourceFileToPackageName.get(oldSourceFile.path);
                if (packageName !== undefined) {
                    // If there are 2 different source files for the same package name and at least one of them changes,
                    // they might become redirects. So we must rebuild the program.
                    const prevKind = seenPackageNames.get(packageName);
                    const newKind = fileChanged ? 1 /* Modified */ : 0 /* Exists */;
                    if ((prevKind !== undefined && newKind === 1 /* Modified */) || prevKind === 1 /* Modified */) {
                        return oldProgram.structureIsReused = 0 /* Not */;
                    }
                    seenPackageNames.set(packageName, newKind);
                }
                if (fileChanged) {
                    // The `newSourceFile` object was created for the new program.
                    if (oldSourceFile.hasNoDefaultLib !== newSourceFile.hasNoDefaultLib) {
                        // value of no-default-lib has changed
                        // this will affect if default library is injected into the list of files
                        oldProgram.structureIsReused = 1 /* SafeModules */;
                    }
                    // check tripleslash references
                    if (!ts.arrayIsEqualTo(oldSourceFile.referencedFiles, newSourceFile.referencedFiles, fileReferenceIsEqualTo)) {
                        // tripleslash references has changed
                        oldProgram.structureIsReused = 1 /* SafeModules */;
                    }
                    // check imports and module augmentations
                    collectExternalModuleReferences(newSourceFile);
                    if (!ts.arrayIsEqualTo(oldSourceFile.imports, newSourceFile.imports, moduleNameIsEqualTo)) {
                        // imports has changed
                        oldProgram.structureIsReused = 1 /* SafeModules */;
                    }
                    if (!ts.arrayIsEqualTo(oldSourceFile.moduleAugmentations, newSourceFile.moduleAugmentations, moduleNameIsEqualTo)) {
                        // moduleAugmentations has changed
                        oldProgram.structureIsReused = 1 /* SafeModules */;
                    }
                    if ((oldSourceFile.flags & ts.NodeFlags.PossiblyContainsDynamicImport) !== (newSourceFile.flags & ts.NodeFlags.PossiblyContainsDynamicImport)) {
                        // dynamicImport has changed
                        oldProgram.structureIsReused = 1 /* SafeModules */;
                    }
                    if (!ts.arrayIsEqualTo(oldSourceFile.typeReferenceDirectives, newSourceFile.typeReferenceDirectives, fileReferenceIsEqualTo)) {
                        // 'types' references has changed
                        oldProgram.structureIsReused = 1 /* SafeModules */;
                    }
                    // tentatively approve the file
                    modifiedSourceFiles.push({ oldFile: oldSourceFile, newFile: newSourceFile });
                }
                else if (hasInvalidatedResolution(oldSourceFile.path)) {
                    // 'module/types' references could have changed
                    oldProgram.structureIsReused = 1 /* SafeModules */;
                    // add file to the modified list so that we will resolve it later
                    modifiedSourceFiles.push({ oldFile: oldSourceFile, newFile: newSourceFile });
                }
                // if file has passed all checks it should be safe to reuse it
                newSourceFiles.push(newSourceFile);
            }
            if (oldProgram.structureIsReused !== 2 /* Completely */) {
                return oldProgram.structureIsReused;
            }
            modifiedFilePaths = modifiedSourceFiles.map(f => f.newFile.path);
            // try to verify results of module resolution
            for (const { oldFile: oldSourceFile, newFile: newSourceFile } of modifiedSourceFiles) {
                const newSourceFilePath = ts.getNormalizedAbsolutePath(newSourceFile.fileName, currentDirectory);
                if (resolveModuleNamesWorker) {
                    const moduleNames = getModuleNames(newSourceFile);
                    const oldProgramState = { program: oldProgram, oldSourceFile, modifiedFilePaths };
                    const resolutions = resolveModuleNamesReusingOldState(moduleNames, newSourceFilePath, newSourceFile, oldProgramState);
                    // ensure that module resolution results are still correct
                    const resolutionsChanged = ts.hasChangesInResolutions(moduleNames, resolutions, oldSourceFile.resolvedModules, ts.moduleResolutionIsEqualTo);
                    if (resolutionsChanged) {
                        oldProgram.structureIsReused = 1 /* SafeModules */;
                        newSourceFile.resolvedModules = ts.zipToMap(moduleNames, resolutions);
                    }
                    else {
                        newSourceFile.resolvedModules = oldSourceFile.resolvedModules;
                    }
                }
                if (resolveTypeReferenceDirectiveNamesWorker) {
                    const typesReferenceDirectives = ts.map(newSourceFile.typeReferenceDirectives, x => x.fileName);
                    const resolutions = resolveTypeReferenceDirectiveNamesWorker(typesReferenceDirectives, newSourceFilePath);
                    // ensure that types resolutions are still correct
                    const resolutionsChanged = ts.hasChangesInResolutions(typesReferenceDirectives, resolutions, oldSourceFile.resolvedTypeReferenceDirectiveNames, ts.typeDirectiveIsEqualTo);
                    if (resolutionsChanged) {
                        oldProgram.structureIsReused = 1 /* SafeModules */;
                        newSourceFile.resolvedTypeReferenceDirectiveNames = ts.zipToMap(typesReferenceDirectives, resolutions);
                    }
                    else {
                        newSourceFile.resolvedTypeReferenceDirectiveNames = oldSourceFile.resolvedTypeReferenceDirectiveNames;
                    }
                }
            }
            if (oldProgram.structureIsReused !== 2 /* Completely */) {
                return oldProgram.structureIsReused;
            }
            if (host.hasChangedAutomaticTypeDirectiveNames) {
                return oldProgram.structureIsReused = 1 /* SafeModules */;
            }
            missingFilePaths = oldProgram.getMissingFilePaths();
            // update fileName -> file mapping
            for (let i = 0; i < newSourceFiles.length; i++) {
                filesByName.set(filePaths[i], newSourceFiles[i]);
                // Set the file as found during node modules search if it was found that way in old progra,
                if (oldProgram.isSourceFileFromExternalLibrary(oldProgram.getSourceFileByPath(filePaths[i]))) {
                    sourceFilesFoundSearchingNodeModules.set(filePaths[i], true);
                }
            }
            files = newSourceFiles;
            fileProcessingDiagnostics = oldProgram.getFileProcessingDiagnostics();
            for (const modifiedFile of modifiedSourceFiles) {
                fileProcessingDiagnostics.reattachFileDiagnostics(modifiedFile.newFile);
            }
            resolvedTypeReferenceDirectives = oldProgram.getResolvedTypeReferenceDirectives();
            sourceFileToPackageName = oldProgram.sourceFileToPackageName;
            redirectTargetsSet = oldProgram.redirectTargetsSet;
            return oldProgram.structureIsReused = 2 /* Completely */;
        }
        function getEmitHost(writeFileCallback) {
            return {
                getCanonicalFileName,
                getCommonSourceDirectory: program.getCommonSourceDirectory,
                getCompilerOptions: program.getCompilerOptions,
                getCurrentDirectory: () => currentDirectory,
                getNewLine: () => host.getNewLine(),
                getSourceFile: program.getSourceFile,
                getSourceFileByPath: program.getSourceFileByPath,
                getSourceFiles: program.getSourceFiles,
                isSourceFileFromExternalLibrary,
                writeFile: writeFileCallback || ((fileName, data, writeByteOrderMark, onError, sourceFiles) => host.writeFile(fileName, data, writeByteOrderMark, onError, sourceFiles)),
                isEmitBlocked,
            };
        }
        function isSourceFileFromExternalLibrary(file) {
            return sourceFilesFoundSearchingNodeModules.get(file.path);
        }
        function isSourceFileDefaultLibrary(file) {
            if (file.hasNoDefaultLib) {
                return true;
            }
            if (!options.noLib) {
                return false;
            }
            // If '--lib' is not specified, include default library file according to '--target'
            // otherwise, using options specified in '--lib' instead of '--target' default library file
            const equalityComparer = host.useCaseSensitiveFileNames() ? ts.equateStringsCaseSensitive : ts.equateStringsCaseInsensitive;
            if (!options.lib) {
                return equalityComparer(file.fileName, getDefaultLibraryFileName());
            }
            else {
                return ts.forEach(options.lib, libFileName => equalityComparer(file.fileName, ts.combinePaths(defaultLibraryPath, libFileName)));
            }
        }
        function getDiagnosticsProducingTypeChecker() {
            return diagnosticsProducingTypeChecker || (diagnosticsProducingTypeChecker = ts.createTypeChecker(program, /*produceDiagnostics:*/ true));
        }
        function dropDiagnosticsProducingTypeChecker() {
            diagnosticsProducingTypeChecker = undefined;
        }
        function getTypeChecker() {
            return noDiagnosticsTypeChecker || (noDiagnosticsTypeChecker = ts.createTypeChecker(program, /*produceDiagnostics:*/ false));
        }
        function emit(sourceFile, writeFileCallback, cancellationToken, emitOnlyDtsFiles, transformers) {
            return runWithCancellationToken(() => emitWorker(program, sourceFile, writeFileCallback, cancellationToken, emitOnlyDtsFiles, transformers));
        }
        function isEmitBlocked(emitFileName) {
            return hasEmitBlockingDiagnostics.has(toPath(emitFileName));
        }
        function emitWorker(program, sourceFile, writeFileCallback, cancellationToken, emitOnlyDtsFiles, customTransformers) {
            let declarationDiagnostics = [];
            if (!emitOnlyDtsFiles) {
                if (options.noEmit) {
                    return { diagnostics: declarationDiagnostics, sourceMaps: undefined, emittedFiles: undefined, emitSkipped: true };
                }
                // If the noEmitOnError flag is set, then check if we have any errors so far.  If so,
                // immediately bail out.  Note that we pass 'undefined' for 'sourceFile' so that we
                // get any preEmit diagnostics, not just the ones
                if (options.noEmitOnError) {
                    const diagnostics = [
                        ...program.getOptionsDiagnostics(cancellationToken),
                        ...program.getSyntacticDiagnostics(sourceFile, cancellationToken),
                        ...program.getGlobalDiagnostics(cancellationToken),
                        ...program.getSemanticDiagnostics(sourceFile, cancellationToken)
                    ];
                    if (diagnostics.length === 0 && program.getCompilerOptions().declaration) {
                        declarationDiagnostics = program.getDeclarationDiagnostics(/*sourceFile*/ undefined, cancellationToken);
                    }
                    if (diagnostics.length > 0 || declarationDiagnostics.length > 0) {
                        return {
                            diagnostics: ts.concatenate(diagnostics, declarationDiagnostics),
                            sourceMaps: undefined,
                            emittedFiles: undefined,
                            emitSkipped: true
                        };
                    }
                }
            }
            // Create the emit resolver outside of the "emitTime" tracking code below.  That way
            // any cost associated with it (like type checking) are appropriate associated with
            // the type-checking counter.
            //
            // If the -out option is specified, we should not pass the source file to getEmitResolver.
            // This is because in the -out scenario all files need to be emitted, and therefore all
            // files need to be type checked. And the way to specify that all files need to be type
            // checked is to not pass the file to getEmitResolver.
            const emitResolver = getDiagnosticsProducingTypeChecker().getEmitResolver((options.outFile || options.out) ? undefined : sourceFile, cancellationToken);
            ts.performance.mark("beforeEmit");
            const transformers = emitOnlyDtsFiles ? [] : ts.getTransformers(options, customTransformers);
            const emitResult = ts.emitFiles(emitResolver, getEmitHost(writeFileCallback), sourceFile, emitOnlyDtsFiles, transformers);
            ts.performance.mark("afterEmit");
            ts.performance.measure("Emit", "beforeEmit", "afterEmit");
            return emitResult;
        }
        function getSourceFile(fileName) {
            return getSourceFileByPath(toPath(fileName));
        }
        function getSourceFileByPath(path) {
            return filesByName.get(path);
        }
        function getDiagnosticsHelper(sourceFile, getDiagnostics, cancellationToken) {
            if (sourceFile) {
                return getDiagnostics(sourceFile, cancellationToken);
            }
            return ts.sortAndDeduplicateDiagnostics(ts.flatMap(program.getSourceFiles(), sourceFile => {
                if (cancellationToken) {
                    cancellationToken.throwIfCancellationRequested();
                }
                return getDiagnostics(sourceFile, cancellationToken);
            }));
        }
        function getSyntacticDiagnostics(sourceFile, cancellationToken) {
            return getDiagnosticsHelper(sourceFile, getSyntacticDiagnosticsForFile, cancellationToken);
        }
        function getSemanticDiagnostics(sourceFile, cancellationToken) {
            return getDiagnosticsHelper(sourceFile, getSemanticDiagnosticsForFile, cancellationToken);
        }
        function getDeclarationDiagnostics(sourceFile, cancellationToken) {
            const options = program.getCompilerOptions();
            // collect diagnostics from the program only once if either no source file was specified or out/outFile is set (bundled emit)
            if (!sourceFile || options.out || options.outFile) {
                return getDeclarationDiagnosticsWorker(sourceFile, cancellationToken);
            }
            else {
                return getDiagnosticsHelper(sourceFile, getDeclarationDiagnosticsForFile, cancellationToken);
            }
        }
        function getSyntacticDiagnosticsForFile(sourceFile) {
            // For JavaScript files, we report semantic errors for using TypeScript-only
            // constructs from within a JavaScript file as syntactic errors.
            if (ts.isSourceFileJavaScript(sourceFile)) {
                if (!sourceFile.additionalSyntacticDiagnostics) {
                    sourceFile.additionalSyntacticDiagnostics = getJavaScriptSyntacticDiagnosticsForFile(sourceFile);
                }
                return ts.concatenate(sourceFile.additionalSyntacticDiagnostics, sourceFile.parseDiagnostics);
            }
            return sourceFile.parseDiagnostics;
        }
        function runWithCancellationToken(func) {
            try {
                return func();
            }
            catch (e) {
                if (e instanceof ts.OperationCanceledException) {
                    // We were canceled while performing the operation.  Because our type checker
                    // might be a bad state, we need to throw it away.
                    //
                    // Note: we are overly aggressive here.  We do not actually *have* to throw away
                    // the "noDiagnosticsTypeChecker".  However, for simplicity, i'd like to keep
                    // the lifetimes of these two TypeCheckers the same.  Also, we generally only
                    // cancel when the user has made a change anyways.  And, in that case, we (the
                    // program instance) will get thrown away anyways.  So trying to keep one of
                    // these type checkers alive doesn't serve much purpose.
                    noDiagnosticsTypeChecker = undefined;
                    diagnosticsProducingTypeChecker = undefined;
                }
                throw e;
            }
        }
        function getSemanticDiagnosticsForFile(sourceFile, cancellationToken) {
            return getAndCacheDiagnostics(sourceFile, cancellationToken, cachedSemanticDiagnosticsForFile, getSemanticDiagnosticsForFileNoCache);
        }
        function getSemanticDiagnosticsForFileNoCache(sourceFile, cancellationToken) {
            return runWithCancellationToken(() => {
                // If skipLibCheck is enabled, skip reporting errors if file is a declaration file.
                // If skipDefaultLibCheck is enabled, skip reporting errors if file contains a
                // '/// <reference no-default-lib="true"/>' directive.
                if (options.skipLibCheck && sourceFile.isDeclarationFile || options.skipDefaultLibCheck && sourceFile.hasNoDefaultLib) {
                    return ts.emptyArray;
                }
                const typeChecker = getDiagnosticsProducingTypeChecker();
                ts.Debug.assert(!!sourceFile.bindDiagnostics);
                const isCheckJs = ts.isCheckJsEnabledForFile(sourceFile, options);
                // By default, only type-check .ts, .tsx, and 'External' files (external files are added by plugins)
                const includeBindAndCheckDiagnostics = sourceFile.scriptKind === ts.ScriptKind.TS || sourceFile.scriptKind === ts.ScriptKind.TSX ||
                    sourceFile.scriptKind === ts.ScriptKind.External || isCheckJs;
                const bindDiagnostics = includeBindAndCheckDiagnostics ? sourceFile.bindDiagnostics : ts.emptyArray;
                const checkDiagnostics = includeBindAndCheckDiagnostics ? typeChecker.getDiagnostics(sourceFile, cancellationToken) : ts.emptyArray;
                const fileProcessingDiagnosticsInFile = fileProcessingDiagnostics.getDiagnostics(sourceFile.fileName);
                const programDiagnosticsInFile = programDiagnostics.getDiagnostics(sourceFile.fileName);
                let diagnostics = bindDiagnostics.concat(checkDiagnostics, fileProcessingDiagnosticsInFile, programDiagnosticsInFile);
                if (isCheckJs) {
                    diagnostics = ts.concatenate(diagnostics, sourceFile.jsDocDiagnostics);
                }
                return ts.filter(diagnostics, shouldReportDiagnostic);
            });
        }
        /**
         * Skip errors if previous line start with '// @ts-ignore' comment, not counting non-empty non-comment lines
         */
        function shouldReportDiagnostic(diagnostic) {
            const { file, start } = diagnostic;
            if (file) {
                const lineStarts = ts.getLineStarts(file);
                let { line } = ts.computeLineAndCharacterOfPosition(lineStarts, start);
                while (line > 0) {
                    const previousLineText = file.text.slice(lineStarts[line - 1], lineStarts[line]);
                    const result = ignoreDiagnosticCommentRegEx.exec(previousLineText);
                    if (!result) {
                        // non-empty line
                        return true;
                    }
                    if (result[3]) {
                        // @ts-ignore
                        return false;
                    }
                    line--;
                }
            }
            return true;
        }
        function getJavaScriptSyntacticDiagnosticsForFile(sourceFile) {
            return runWithCancellationToken(() => {
                const diagnostics = [];
                let parent = sourceFile;
                walk(sourceFile);
                return diagnostics;
                function walk(node) {
                    // Return directly from the case if the given node doesnt want to visit each child
                    // Otherwise break to visit each child
                    switch (parent.kind) {
                        case ts.SyntaxKind.Parameter:
                        case ts.SyntaxKind.PropertyDeclaration:
                            if (parent.questionToken === node) {
                                diagnostics.push(createDiagnosticForNode(node, Diagnostics._0_can_only_be_used_in_a_ts_file, "?"));
                                return;
                            }
                        // falls through
                        case ts.SyntaxKind.MethodDeclaration:
                        case ts.SyntaxKind.MethodSignature:
                        case ts.SyntaxKind.Constructor:
                        case ts.SyntaxKind.GetAccessor:
                        case ts.SyntaxKind.SetAccessor:
                        case ts.SyntaxKind.FunctionExpression:
                        case ts.SyntaxKind.FunctionDeclaration:
                        case ts.SyntaxKind.ArrowFunction:
                        case ts.SyntaxKind.VariableDeclaration:
                            // type annotation
                            if (parent.type === node) {
                                diagnostics.push(createDiagnosticForNode(node, Diagnostics.types_can_only_be_used_in_a_ts_file));
                                return;
                            }
                    }
                    switch (node.kind) {
                        case ts.SyntaxKind.ImportEqualsDeclaration:
                            diagnostics.push(createDiagnosticForNode(node, Diagnostics.import_can_only_be_used_in_a_ts_file));
                            return;
                        case ts.SyntaxKind.ExportAssignment:
                            if (node.isExportEquals) {
                                diagnostics.push(createDiagnosticForNode(node, Diagnostics.export_can_only_be_used_in_a_ts_file));
                                return;
                            }
                            break;
                        case ts.SyntaxKind.HeritageClause:
                            const heritageClause = node;
                            if (heritageClause.token === ts.SyntaxKind.ImplementsKeyword) {
                                diagnostics.push(createDiagnosticForNode(node, Diagnostics.implements_clauses_can_only_be_used_in_a_ts_file));
                                return;
                            }
                            break;
                        case ts.SyntaxKind.InterfaceDeclaration:
                            diagnostics.push(createDiagnosticForNode(node, Diagnostics.interface_declarations_can_only_be_used_in_a_ts_file));
                            return;
                        case ts.SyntaxKind.ModuleDeclaration:
                            diagnostics.push(createDiagnosticForNode(node, Diagnostics.module_declarations_can_only_be_used_in_a_ts_file));
                            return;
                        case ts.SyntaxKind.TypeAliasDeclaration:
                            diagnostics.push(createDiagnosticForNode(node, Diagnostics.type_aliases_can_only_be_used_in_a_ts_file));
                            return;
                        case ts.SyntaxKind.EnumDeclaration:
                            diagnostics.push(createDiagnosticForNode(node, Diagnostics.enum_declarations_can_only_be_used_in_a_ts_file));
                            return;
                        case ts.SyntaxKind.NonNullExpression:
                            diagnostics.push(createDiagnosticForNode(node, Diagnostics.non_null_assertions_can_only_be_used_in_a_ts_file));
                            return;
                        case ts.SyntaxKind.AsExpression:
                            diagnostics.push(createDiagnosticForNode(node.type, Diagnostics.type_assertion_expressions_can_only_be_used_in_a_ts_file));
                            return;
                        case ts.SyntaxKind.TypeAssertionExpression:
                            ts.Debug.fail(); // Won't parse these in a JS file anyway, as they are interpreted as JSX.
                    }
                    const prevParent = parent;
                    parent = node;
                    ts.forEachChild(node, walk, walkArray);
                    parent = prevParent;
                }
                function walkArray(nodes) {
                    if (parent.decorators === nodes && !options.experimentalDecorators) {
                        diagnostics.push(createDiagnosticForNode(parent, Diagnostics.Experimental_support_for_decorators_is_a_feature_that_is_subject_to_change_in_a_future_release_Set_the_experimentalDecorators_option_to_remove_this_warning));
                    }
                    switch (parent.kind) {
                        case ts.SyntaxKind.ClassDeclaration:
                        case ts.SyntaxKind.MethodDeclaration:
                        case ts.SyntaxKind.MethodSignature:
                        case ts.SyntaxKind.Constructor:
                        case ts.SyntaxKind.GetAccessor:
                        case ts.SyntaxKind.SetAccessor:
                        case ts.SyntaxKind.FunctionExpression:
                        case ts.SyntaxKind.FunctionDeclaration:
                        case ts.SyntaxKind.ArrowFunction:
                            // Check type parameters
                            if (nodes === parent.typeParameters) {
                                diagnostics.push(createDiagnosticForNodeArray(nodes, Diagnostics.type_parameter_declarations_can_only_be_used_in_a_ts_file));
                                return;
                            }
                        // falls through
                        case ts.SyntaxKind.VariableStatement:
                            // Check modifiers
                            if (nodes === parent.modifiers) {
                                return checkModifiers(nodes, parent.kind === ts.SyntaxKind.VariableStatement);
                            }
                            break;
                        case ts.SyntaxKind.PropertyDeclaration:
                            // Check modifiers of property declaration
                            if (nodes === parent.modifiers) {
                                for (const modifier of nodes) {
                                    if (modifier.kind !== ts.SyntaxKind.StaticKeyword) {
                                        diagnostics.push(createDiagnosticForNode(modifier, Diagnostics._0_can_only_be_used_in_a_ts_file, ts.tokenToString(modifier.kind)));
                                    }
                                }
                                return;
                            }
                            break;
                        case ts.SyntaxKind.Parameter:
                            // Check modifiers of parameter declaration
                            if (nodes === parent.modifiers) {
                                diagnostics.push(createDiagnosticForNodeArray(nodes, Diagnostics.parameter_modifiers_can_only_be_used_in_a_ts_file));
                                return;
                            }
                            break;
                        case ts.SyntaxKind.CallExpression:
                        case ts.SyntaxKind.NewExpression:
                        case ts.SyntaxKind.ExpressionWithTypeArguments:
                        case ts.SyntaxKind.JsxSelfClosingElement:
                        case ts.SyntaxKind.JsxOpeningElement:
                            // Check type arguments
                            if (nodes === parent.typeArguments) {
                                diagnostics.push(createDiagnosticForNodeArray(nodes, Diagnostics.type_arguments_can_only_be_used_in_a_ts_file));
                                return;
                            }
                            break;
                    }
                    for (const node of nodes) {
                        walk(node);
                    }
                }
                function checkModifiers(modifiers, isConstValid) {
                    for (const modifier of modifiers) {
                        switch (modifier.kind) {
                            case ts.SyntaxKind.ConstKeyword:
                                if (isConstValid) {
                                    continue;
                                }
                            // to report error,
                            // falls through
                            case ts.SyntaxKind.PublicKeyword:
                            case ts.SyntaxKind.PrivateKeyword:
                            case ts.SyntaxKind.ProtectedKeyword:
                            case ts.SyntaxKind.ReadonlyKeyword:
                            case ts.SyntaxKind.DeclareKeyword:
                            case ts.SyntaxKind.AbstractKeyword:
                                diagnostics.push(createDiagnosticForNode(modifier, Diagnostics._0_can_only_be_used_in_a_ts_file, ts.tokenToString(modifier.kind)));
                                break;
                            // These are all legal modifiers.
                            case ts.SyntaxKind.StaticKeyword:
                            case ts.SyntaxKind.ExportKeyword:
                            case ts.SyntaxKind.DefaultKeyword:
                        }
                    }
                }
                function createDiagnosticForNodeArray(nodes, message, arg0, arg1, arg2) {
                    const start = nodes.pos;
                    return ts.createFileDiagnostic(sourceFile, start, nodes.end - start, message, arg0, arg1, arg2);
                }
                // Since these are syntactic diagnostics, parent might not have been set
                // this means the sourceFile cannot be infered from the node
                function createDiagnosticForNode(node, message, arg0, arg1, arg2) {
                    return ts.createDiagnosticForNodeInSourceFile(sourceFile, node, message, arg0, arg1, arg2);
                }
            });
        }
        function getDeclarationDiagnosticsWorker(sourceFile, cancellationToken) {
            return getAndCacheDiagnostics(sourceFile, cancellationToken, cachedDeclarationDiagnosticsForFile, getDeclarationDiagnosticsForFileNoCache);
        }
        function getDeclarationDiagnosticsForFileNoCache(sourceFile, cancellationToken) {
            return runWithCancellationToken(() => {
                const resolver = getDiagnosticsProducingTypeChecker().getEmitResolver(sourceFile, cancellationToken);
                // Don't actually write any files since we're just getting diagnostics.
                return ts.getDeclarationDiagnostics(getEmitHost(ts.noop), resolver, sourceFile);
            });
        }
        function getAndCacheDiagnostics(sourceFile, cancellationToken, cache, getDiagnostics) {
            const cachedResult = sourceFile
                ? cache.perFile && cache.perFile.get(sourceFile.path)
                : cache.allDiagnostics;
            if (cachedResult) {
                return cachedResult;
            }
            const result = getDiagnostics(sourceFile, cancellationToken) || ts.emptyArray;
            if (sourceFile) {
                if (!cache.perFile) {
                    cache.perFile = ts.createMap();
                }
                cache.perFile.set(sourceFile.path, result);
            }
            else {
                cache.allDiagnostics = result;
            }
            return result;
        }
        function getDeclarationDiagnosticsForFile(sourceFile, cancellationToken) {
            return sourceFile.isDeclarationFile ? [] : getDeclarationDiagnosticsWorker(sourceFile, cancellationToken);
        }
        function getOptionsDiagnostics() {
            return ts.sortAndDeduplicateDiagnostics(ts.concatenate(fileProcessingDiagnostics.getGlobalDiagnostics(), ts.concatenate(programDiagnostics.getGlobalDiagnostics(), options.configFile ? programDiagnostics.getDiagnostics(options.configFile.fileName) : [])));
        }
        function getGlobalDiagnostics() {
            return ts.sortAndDeduplicateDiagnostics(getDiagnosticsProducingTypeChecker().getGlobalDiagnostics().slice());
        }
        function getConfigFileParsingDiagnostics() {
            return configFileParsingDiagnostics || ts.emptyArray;
        }
        function processRootFile(fileName, isDefaultLib) {
            processSourceFile(ts.normalizePath(fileName), isDefaultLib, /*packageId*/ undefined);
        }
        function fileReferenceIsEqualTo(a, b) {
            return a.fileName === b.fileName;
        }
        function moduleNameIsEqualTo(a, b) {
            return a.kind === ts.SyntaxKind.Identifier
                ? b.kind === ts.SyntaxKind.Identifier && a.escapedText === b.escapedText
                : b.kind === ts.SyntaxKind.StringLiteral && a.text === b.text;
        }
        function collectExternalModuleReferences(file) {
            if (file.imports) {
                return;
            }
            const isJavaScriptFile = ts.isSourceFileJavaScript(file);
            const isExternalModuleFile = ts.isExternalModule(file);
            // file.imports may not be undefined if there exists dynamic import
            let imports;
            let moduleAugmentations;
            let ambientModules;
            // If we are importing helpers, we need to add a synthetic reference to resolve the
            // helpers library.
            if (options.importHelpers
                && (options.isolatedModules || isExternalModuleFile)
                && !file.isDeclarationFile) {
                // synthesize 'import "tslib"' declaration
                const externalHelpersModuleReference = ts.createLiteral(ts.externalHelpersModuleNameText);
                const importDecl = ts.createImportDeclaration(/*decorators*/ undefined, /*modifiers*/ undefined, /*importClause*/ undefined, externalHelpersModuleReference);
                ts.addEmitFlags(importDecl, ts.EmitFlags.NeverApplyImportHelper);
                externalHelpersModuleReference.parent = importDecl;
                importDecl.parent = file;
                imports = [externalHelpersModuleReference];
            }
            for (const node of file.statements) {
                collectModuleReferences(node, /*inAmbientModule*/ false);
                if ((file.flags & ts.NodeFlags.PossiblyContainsDynamicImport) || isJavaScriptFile) {
                    collectDynamicImportOrRequireCalls(node);
                }
            }
            if ((file.flags & ts.NodeFlags.PossiblyContainsDynamicImport) || isJavaScriptFile) {
                collectDynamicImportOrRequireCalls(file.endOfFileToken);
            }
            file.imports = imports || ts.emptyArray;
            file.moduleAugmentations = moduleAugmentations || ts.emptyArray;
            file.ambientModuleNames = ambientModules || ts.emptyArray;
            return;
            function collectModuleReferences(node, inAmbientModule) {
                if (ts.isAnyImportOrReExport(node)) {
                    const moduleNameExpr = ts.getExternalModuleName(node);
                    // TypeScript 1.0 spec (April 2014): 12.1.6
                    // An ExternalImportDeclaration in an AmbientExternalModuleDeclaration may reference other external modules
                    // only through top - level external module names. Relative external module names are not permitted.
                    if (moduleNameExpr && ts.isStringLiteral(moduleNameExpr) && moduleNameExpr.text && (!inAmbientModule || !ts.isExternalModuleNameRelative(moduleNameExpr.text))) {
                        imports = ts.append(imports, moduleNameExpr);
                    }
                }
                else if (ts.isModuleDeclaration(node)) {
                    if (ts.isAmbientModule(node) && (inAmbientModule || ts.hasModifier(node, ts.ModifierFlags.Ambient) || file.isDeclarationFile)) {
                        const nameText = ts.getTextOfIdentifierOrLiteral(node.name);
                        // Ambient module declarations can be interpreted as augmentations for some existing external modules.
                        // This will happen in two cases:
                        // - if current file is external module then module augmentation is a ambient module declaration defined in the top level scope
                        // - if current file is not external module then module augmentation is an ambient module declaration with non-relative module name
                        //   immediately nested in top level ambient module declaration .
                        if (isExternalModuleFile || (inAmbientModule && !ts.isExternalModuleNameRelative(nameText))) {
                            (moduleAugmentations || (moduleAugmentations = [])).push(node.name);
                        }
                        else if (!inAmbientModule) {
                            if (file.isDeclarationFile) {
                                // for global .d.ts files record name of ambient module
                                (ambientModules || (ambientModules = [])).push(nameText);
                            }
                            // An AmbientExternalModuleDeclaration declares an external module.
                            // This type of declaration is permitted only in the global module.
                            // The StringLiteral must specify a top - level external module name.
                            // Relative external module names are not permitted
                            // NOTE: body of ambient module is always a module block, if it exists
                            const body = node.body;
                            if (body) {
                                for (const statement of body.statements) {
                                    collectModuleReferences(statement, /*inAmbientModule*/ true);
                                }
                            }
                        }
                    }
                }
            }
            function collectDynamicImportOrRequireCalls(node) {
                if (ts.isRequireCall(node, /*checkArgumentIsStringLiteralLike*/ true)) {
                    imports = ts.append(imports, node.arguments[0]);
                }
                // we have to check the argument list has length of 1. We will still have to process these even though we have parsing error.
                else if (ts.isImportCall(node) && node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) {
                    imports = ts.append(imports, node.arguments[0]);
                }
                else if (ts.isLiteralImportTypeNode(node)) {
                    imports = ts.append(imports, node.argument.literal);
                }
                else {
                    collectDynamicImportOrRequireCallsForEachChild(node);
                    if (ts.hasJSDocNodes(node)) {
                        ts.forEach(node.jsDoc, collectDynamicImportOrRequireCallsForEachChild);
                    }
                }
            }
            function collectDynamicImportOrRequireCallsForEachChild(node) {
                ts.forEachChild(node, collectDynamicImportOrRequireCalls);
            }
        }
        /** This should have similar behavior to 'processSourceFile' without diagnostics or mutation. */
        function getSourceFileFromReference(referencingFile, ref) {
            return getSourceFileFromReferenceWorker(resolveTripleslashReference(ref.fileName, referencingFile.fileName), fileName => filesByName.get(toPath(fileName)));
        }
        function getSourceFileFromReferenceWorker(fileName, getSourceFile, fail, refFile) {
            if (ts.hasExtension(fileName)) {
                if (!options.allowNonTsExtensions && !ts.forEach(supportedExtensions, extension => ts.fileExtensionIs(host.getCanonicalFileName(fileName), extension))) {
                    if (fail)
                        fail(Diagnostics.File_0_has_unsupported_extension_The_only_supported_extensions_are_1, fileName, "'" + supportedExtensions.join("', '") + "'");
                    return undefined;
                }
                const sourceFile = getSourceFile(fileName);
                if (fail) {
                    if (!sourceFile) {
                        fail(Diagnostics.File_0_not_found, fileName);
                    }
                    else if (refFile && host.getCanonicalFileName(fileName) === host.getCanonicalFileName(refFile.fileName)) {
                        fail(Diagnostics.A_file_cannot_have_a_reference_to_itself);
                    }
                }
                return sourceFile;
            }
            else {
                const sourceFileNoExtension = options.allowNonTsExtensions && getSourceFile(fileName);
                if (sourceFileNoExtension)
                    return sourceFileNoExtension;
                if (fail && options.allowNonTsExtensions) {
                    fail(Diagnostics.File_0_not_found, fileName);
                    return undefined;
                }
                const sourceFileWithAddedExtension = ts.forEach(supportedExtensions, extension => getSourceFile(fileName + extension));
                if (fail && !sourceFileWithAddedExtension)
                    fail(Diagnostics.File_0_not_found, fileName + ts.Extension.Ts);
                return sourceFileWithAddedExtension;
            }
        }
        /** This has side effects through `findSourceFile`. */
        function processSourceFile(fileName, isDefaultLib, packageId, refFile, refPos, refEnd) {
            getSourceFileFromReferenceWorker(fileName, fileName => findSourceFile(fileName, toPath(fileName), isDefaultLib, refFile, refPos, refEnd, packageId), (diagnostic, ...args) => {
                fileProcessingDiagnostics.add(refFile !== undefined && refEnd !== undefined && refPos !== undefined
                    ? ts.createFileDiagnostic(refFile, refPos, refEnd - refPos, diagnostic, ...args)
                    : ts.createCompilerDiagnostic(diagnostic, ...args));
            }, refFile);
        }
        function reportFileNamesDifferOnlyInCasingError(fileName, existingFileName, refFile, refPos, refEnd) {
            if (refFile !== undefined && refPos !== undefined && refEnd !== undefined) {
                fileProcessingDiagnostics.add(ts.createFileDiagnostic(refFile, refPos, refEnd - refPos, Diagnostics.File_name_0_differs_from_already_included_file_name_1_only_in_casing, fileName, existingFileName));
            }
            else {
                fileProcessingDiagnostics.add(ts.createCompilerDiagnostic(Diagnostics.File_name_0_differs_from_already_included_file_name_1_only_in_casing, fileName, existingFileName));
            }
        }
        function createRedirectSourceFile(redirectTarget, unredirected, fileName, path) {
            const redirect = Object.create(redirectTarget);
            redirect.fileName = fileName;
            redirect.path = path;
            redirect.redirectInfo = { redirectTarget, unredirected };
            Object.defineProperties(redirect, {
                id: {
                    get() { return this.redirectInfo.redirectTarget.id; },
                    set(value) { this.redirectInfo.redirectTarget.id = value; },
                },
                symbol: {
                    get() { return this.redirectInfo.redirectTarget.symbol; },
                    set(value) { this.redirectInfo.redirectTarget.symbol = value; },
                },
            });
            return redirect;
        }
        // Get source file from normalized fileName
        function findSourceFile(fileName, path, isDefaultLib, refFile, refPos, refEnd, packageId) {
            if (filesByName.has(path)) {
                const file = filesByName.get(path);
                // try to check if we've already seen this file but with a different casing in path
                // NOTE: this only makes sense for case-insensitive file systems
                if (file && options.forceConsistentCasingInFileNames && ts.getNormalizedAbsolutePath(file.fileName, currentDirectory) !== ts.getNormalizedAbsolutePath(fileName, currentDirectory)) {
                    reportFileNamesDifferOnlyInCasingError(fileName, file.fileName, refFile, refPos, refEnd);
                }
                // If the file was previously found via a node_modules search, but is now being processed as a root file,
                // then everything it sucks in may also be marked incorrectly, and needs to be checked again.
                if (file && sourceFilesFoundSearchingNodeModules.get(file.path) && currentNodeModulesDepth === 0) {
                    sourceFilesFoundSearchingNodeModules.set(file.path, false);
                    if (!options.noResolve) {
                        processReferencedFiles(file, isDefaultLib);
                        processTypeReferenceDirectives(file);
                    }
                    modulesWithElidedImports.set(file.path, false);
                    processImportedModules(file);
                }
                // See if we need to reprocess the imports due to prior skipped imports
                else if (file && modulesWithElidedImports.get(file.path)) {
                    if (currentNodeModulesDepth < maxNodeModuleJsDepth) {
                        modulesWithElidedImports.set(file.path, false);
                        processImportedModules(file);
                    }
                }
                return file;
            }
            // We haven't looked for this file, do so now and cache result
            const file = host.getSourceFile(fileName, options.target, hostErrorMessage => {
                if (refFile !== undefined && refPos !== undefined && refEnd !== undefined) {
                    fileProcessingDiagnostics.add(ts.createFileDiagnostic(refFile, refPos, refEnd - refPos, Diagnostics.Cannot_read_file_0_Colon_1, fileName, hostErrorMessage));
                }
                else {
                    fileProcessingDiagnostics.add(ts.createCompilerDiagnostic(Diagnostics.Cannot_read_file_0_Colon_1, fileName, hostErrorMessage));
                }
            }, shouldCreateNewSourceFile);
            if (packageId) {
                const packageIdKey = ts.packageIdToString(packageId);
                const fileFromPackageId = packageIdToSourceFile.get(packageIdKey);
                if (fileFromPackageId) {
                    // Some other SourceFile already exists with this package name and version.
                    // Instead of creating a duplicate, just redirect to the existing one.
                    const dupFile = createRedirectSourceFile(fileFromPackageId, file, fileName, path);
                    redirectTargetsSet.set(fileFromPackageId.path, true);
                    filesByName.set(path, dupFile);
                    sourceFileToPackageName.set(path, packageId.name);
                    files.push(dupFile);
                    return dupFile;
                }
                else if (file) {
                    // This is the first source file to have this packageId.
                    packageIdToSourceFile.set(packageIdKey, file);
                    sourceFileToPackageName.set(path, packageId.name);
                }
            }
            filesByName.set(path, file);
            if (file) {
                sourceFilesFoundSearchingNodeModules.set(path, currentNodeModulesDepth > 0);
                file.path = path;
                if (host.useCaseSensitiveFileNames()) {
                    const pathLowerCase = path.toLowerCase();
                    // for case-sensitive file systems check if we've already seen some file with similar filename ignoring case
                    const existingFile = filesByNameIgnoreCase.get(pathLowerCase);
                    if (existingFile) {
                        reportFileNamesDifferOnlyInCasingError(fileName, existingFile.fileName, refFile, refPos, refEnd);
                    }
                    else {
                        filesByNameIgnoreCase.set(pathLowerCase, file);
                    }
                }
                skipDefaultLib = skipDefaultLib || file.hasNoDefaultLib;
                if (!options.noResolve) {
                    processReferencedFiles(file, isDefaultLib);
                    processTypeReferenceDirectives(file);
                }
                // always process imported modules to record module name resolutions
                processImportedModules(file);
                if (isDefaultLib) {
                    files.unshift(file);
                }
                else {
                    files.push(file);
                }
            }
            return file;
        }
        function processReferencedFiles(file, isDefaultLib) {
            ts.forEach(file.referencedFiles, ref => {
                const referencedFileName = resolveTripleslashReference(ref.fileName, file.fileName);
                processSourceFile(referencedFileName, isDefaultLib, /*packageId*/ undefined, file, ref.pos, ref.end);
            });
        }
        function processTypeReferenceDirectives(file) {
            // We lower-case all type references because npm automatically lowercases all packages. See GH#9824.
            const typeDirectives = ts.map(file.typeReferenceDirectives, ref => ref.fileName.toLocaleLowerCase());
            const resolutions = resolveTypeReferenceDirectiveNamesWorker(typeDirectives, file.fileName);
            for (let i = 0; i < typeDirectives.length; i++) {
                const ref = file.typeReferenceDirectives[i];
                const resolvedTypeReferenceDirective = resolutions[i];
                // store resolved type directive on the file
                const fileName = ref.fileName.toLocaleLowerCase();
                ts.setResolvedTypeReferenceDirective(file, fileName, resolvedTypeReferenceDirective);
                processTypeReferenceDirective(fileName, resolvedTypeReferenceDirective, file, ref.pos, ref.end);
            }
        }
        function processTypeReferenceDirective(typeReferenceDirective, resolvedTypeReferenceDirective, refFile, refPos, refEnd) {
            // If we already found this library as a primary reference - nothing to do
            const previousResolution = resolvedTypeReferenceDirectives.get(typeReferenceDirective);
            if (previousResolution && previousResolution.primary) {
                return;
            }
            let saveResolution = true;
            if (resolvedTypeReferenceDirective) {
                if (resolvedTypeReferenceDirective.primary) {
                    // resolved from the primary path
                    processSourceFile(resolvedTypeReferenceDirective.resolvedFileName, /*isDefaultLib*/ false, resolvedTypeReferenceDirective.packageId, refFile, refPos, refEnd);
                }
                else {
                    // If we already resolved to this file, it must have been a secondary reference. Check file contents
                    // for sameness and possibly issue an error
                    if (previousResolution) {
                        // Don't bother reading the file again if it's the same file.
                        if (resolvedTypeReferenceDirective.resolvedFileName !== previousResolution.resolvedFileName) {
                            const otherFileText = host.readFile(resolvedTypeReferenceDirective.resolvedFileName);
                            if (otherFileText !== getSourceFile(previousResolution.resolvedFileName).text) {
                                fileProcessingDiagnostics.add(createDiagnostic(refFile, refPos, refEnd, Diagnostics.Conflicting_definitions_for_0_found_at_1_and_2_Consider_installing_a_specific_version_of_this_library_to_resolve_the_conflict, typeReferenceDirective, resolvedTypeReferenceDirective.resolvedFileName, previousResolution.resolvedFileName));
                            }
                        }
                        // don't overwrite previous resolution result
                        saveResolution = false;
                    }
                    else {
                        // First resolution of this library
                        processSourceFile(resolvedTypeReferenceDirective.resolvedFileName, /*isDefaultLib*/ false, resolvedTypeReferenceDirective.packageId, refFile, refPos, refEnd);
                    }
                }
            }
            else {
                fileProcessingDiagnostics.add(createDiagnostic(refFile, refPos, refEnd, Diagnostics.Cannot_find_type_definition_file_for_0, typeReferenceDirective));
            }
            if (saveResolution) {
                resolvedTypeReferenceDirectives.set(typeReferenceDirective, resolvedTypeReferenceDirective);
            }
        }
        function createDiagnostic(refFile, refPos, refEnd, message, ...args) {
            if (refFile === undefined || refPos === undefined || refEnd === undefined) {
                return ts.createCompilerDiagnostic(message, ...args);
            }
            else {
                return ts.createFileDiagnostic(refFile, refPos, refEnd - refPos, message, ...args);
            }
        }
        function getCanonicalFileName(fileName) {
            return host.getCanonicalFileName(fileName);
        }
        function processImportedModules(file) {
            collectExternalModuleReferences(file);
            if (file.imports.length || file.moduleAugmentations.length) {
                // Because global augmentation doesn't have string literal name, we can check for global augmentation as such.
                const moduleNames = getModuleNames(file);
                const oldProgramState = { program: oldProgram, oldSourceFile: oldProgram && oldProgram.getSourceFile(file.fileName), modifiedFilePaths };
                const resolutions = resolveModuleNamesReusingOldState(moduleNames, ts.getNormalizedAbsolutePath(file.fileName, currentDirectory), file, oldProgramState);
                ts.Debug.assert(resolutions.length === moduleNames.length);
                for (let i = 0; i < moduleNames.length; i++) {
                    const resolution = resolutions[i];
                    ts.setResolvedModule(file, moduleNames[i], resolution);
                    if (!resolution) {
                        continue;
                    }
                    const isFromNodeModulesSearch = resolution.isExternalLibraryImport;
                    const isJsFile = !ts.extensionIsTypeScript(resolution.extension);
                    const isJsFileFromNodeModules = isFromNodeModulesSearch && isJsFile;
                    const resolvedFileName = resolution.resolvedFileName;
                    if (isFromNodeModulesSearch) {
                        currentNodeModulesDepth++;
                    }
                    // add file to program only if:
                    // - resolution was successful
                    // - noResolve is falsy
                    // - module name comes from the list of imports
                    // - it's not a top level JavaScript module that exceeded the search max
                    const elideImport = isJsFileFromNodeModules && currentNodeModulesDepth > maxNodeModuleJsDepth;
                    // Don't add the file if it has a bad extension (e.g. 'tsx' if we don't have '--allowJs')
                    // This may still end up being an untyped module -- the file won't be included but imports will be allowed.
                    const shouldAddFile = resolvedFileName
                        && !getResolutionDiagnostic(options, resolution)
                        && !options.noResolve
                        && i < file.imports.length
                        && !elideImport
                        && !(isJsFile && !options.allowJs)
                        && (ts.isInJavaScriptFile(file.imports[i]) || !(file.imports[i].flags & ts.NodeFlags.JSDoc));
                    if (elideImport) {
                        modulesWithElidedImports.set(file.path, true);
                    }
                    else if (shouldAddFile) {
                        const path = toPath(resolvedFileName);
                        const pos = ts.skipTrivia(file.text, file.imports[i].pos);
                        findSourceFile(resolvedFileName, path, /*isDefaultLib*/ false, file, pos, file.imports[i].end, resolution.packageId);
                    }
                    if (isFromNodeModulesSearch) {
                        currentNodeModulesDepth--;
                    }
                }
            }
            else {
                // no imports - drop cached module resolutions
                file.resolvedModules = undefined;
            }
        }
        function computeCommonSourceDirectory(sourceFiles) {
            const fileNames = [];
            for (const file of sourceFiles) {
                if (!file.isDeclarationFile) {
                    fileNames.push(file.fileName);
                }
            }
            return computeCommonSourceDirectoryOfFilenames(fileNames, currentDirectory, getCanonicalFileName);
        }
        function checkSourceFilesBelongToPath(sourceFiles, rootDirectory) {
            let allFilesBelongToPath = true;
            if (sourceFiles) {
                const absoluteRootDirectoryPath = host.getCanonicalFileName(ts.getNormalizedAbsolutePath(rootDirectory, currentDirectory));
                for (const sourceFile of sourceFiles) {
                    if (!sourceFile.isDeclarationFile) {
                        const absoluteSourceFilePath = host.getCanonicalFileName(ts.getNormalizedAbsolutePath(sourceFile.fileName, currentDirectory));
                        if (absoluteSourceFilePath.indexOf(absoluteRootDirectoryPath) !== 0) {
                            programDiagnostics.add(ts.createCompilerDiagnostic(Diagnostics.File_0_is_not_under_rootDir_1_rootDir_is_expected_to_contain_all_source_files, sourceFile.fileName, options.rootDir));
                            allFilesBelongToPath = false;
                        }
                    }
                }
            }
            return allFilesBelongToPath;
        }
        function verifyCompilerOptions() {
            if (options.isolatedModules) {
                if (options.declaration) {
                    createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_with_option_1, "declaration", "isolatedModules");
                }
                if (options.noEmitOnError) {
                    createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_with_option_1, "noEmitOnError", "isolatedModules");
                }
                if (options.out) {
                    createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_with_option_1, "out", "isolatedModules");
                }
                if (options.outFile) {
                    createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_with_option_1, "outFile", "isolatedModules");
                }
            }
            if (options.inlineSourceMap) {
                if (options.sourceMap) {
                    createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_with_option_1, "sourceMap", "inlineSourceMap");
                }
                if (options.mapRoot) {
                    createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_with_option_1, "mapRoot", "inlineSourceMap");
                }
            }
            if (options.paths && options.baseUrl === undefined) {
                createDiagnosticForOptionName(Diagnostics.Option_paths_cannot_be_used_without_specifying_baseUrl_option, "paths");
            }
            if (options.paths) {
                for (const key in options.paths) {
                    if (!ts.hasProperty(options.paths, key)) {
                        continue;
                    }
                    if (!ts.hasZeroOrOneAsteriskCharacter(key)) {
                        createDiagnosticForOptionPaths(/*onKey*/ true, key, Diagnostics.Pattern_0_can_have_at_most_one_Asterisk_character, key);
                    }
                    if (ts.isArray(options.paths[key])) {
                        const len = options.paths[key].length;
                        if (len === 0) {
                            createDiagnosticForOptionPaths(/*onKey*/ false, key, Diagnostics.Substitutions_for_pattern_0_shouldn_t_be_an_empty_array, key);
                        }
                        for (let i = 0; i < len; i++) {
                            const subst = options.paths[key][i];
                            const typeOfSubst = typeof subst;
                            if (typeOfSubst === "string") {
                                if (!ts.hasZeroOrOneAsteriskCharacter(subst)) {
                                    createDiagnosticForOptionPathKeyValue(key, i, Diagnostics.Substitution_0_in_pattern_1_in_can_have_at_most_one_Asterisk_character, subst, key);
                                }
                            }
                            else {
                                createDiagnosticForOptionPathKeyValue(key, i, Diagnostics.Substitution_0_for_pattern_1_has_incorrect_type_expected_string_got_2, subst, key, typeOfSubst);
                            }
                        }
                    }
                    else {
                        createDiagnosticForOptionPaths(/*onKey*/ false, key, Diagnostics.Substitutions_for_pattern_0_should_be_an_array, key);
                    }
                }
            }
            if (!options.sourceMap && !options.inlineSourceMap) {
                if (options.inlineSources) {
                    createDiagnosticForOptionName(Diagnostics.Option_0_can_only_be_used_when_either_option_inlineSourceMap_or_option_sourceMap_is_provided, "inlineSources");
                }
                if (options.sourceRoot) {
                    createDiagnosticForOptionName(Diagnostics.Option_0_can_only_be_used_when_either_option_inlineSourceMap_or_option_sourceMap_is_provided, "sourceRoot");
                }
            }
            if (options.out && options.outFile) {
                createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_with_option_1, "out", "outFile");
            }
            if (options.mapRoot && !(options.sourceMap || options.declarationMap)) {
                // Error to specify --mapRoot without --sourcemap
                createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_without_specifying_option_1_or_option_2, "mapRoot", "sourceMap", "declarationMap");
            }
            if (options.declarationDir) {
                if (!options.declaration) {
                    createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_without_specifying_option_1, "declarationDir", "declaration");
                }
                if (options.out || options.outFile) {
                    createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_with_option_1, "declarationDir", options.out ? "out" : "outFile");
                }
            }
            if (options.declarationMap && !options.declaration) {
                createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_without_specifying_option_1, "declarationMap", "declaration");
            }
            if (options.lib && options.noLib) {
                createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_with_option_1, "lib", "noLib");
            }
            if (options.noImplicitUseStrict && ts.getStrictOptionValue(options, "alwaysStrict")) {
                createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_with_option_1, "noImplicitUseStrict", "alwaysStrict");
            }
            const languageVersion = options.target || ts.ScriptTarget.ES3;
            const outFile = options.outFile || options.out;
            const firstNonAmbientExternalModuleSourceFile = ts.forEach(files, f => ts.isExternalModule(f) && !f.isDeclarationFile ? f : undefined);
            if (options.isolatedModules) {
                if (options.module === ts.ModuleKind.None && languageVersion < ts.ScriptTarget.ES2015) {
                    createDiagnosticForOptionName(Diagnostics.Option_isolatedModules_can_only_be_used_when_either_option_module_is_provided_or_option_target_is_ES2015_or_higher, "isolatedModules", "target");
                }
                const firstNonExternalModuleSourceFile = ts.forEach(files, f => !ts.isExternalModule(f) && !f.isDeclarationFile ? f : undefined);
                if (firstNonExternalModuleSourceFile) {
                    const span = ts.getErrorSpanForNode(firstNonExternalModuleSourceFile, firstNonExternalModuleSourceFile);
                    programDiagnostics.add(ts.createFileDiagnostic(firstNonExternalModuleSourceFile, span.start, span.length, Diagnostics.Cannot_compile_namespaces_when_the_isolatedModules_flag_is_provided));
                }
            }
            else if (firstNonAmbientExternalModuleSourceFile && languageVersion < ts.ScriptTarget.ES2015 && options.module === ts.ModuleKind.None) {
                // We cannot use createDiagnosticFromNode because nodes do not have parents yet
                const span = ts.getErrorSpanForNode(firstNonAmbientExternalModuleSourceFile, firstNonAmbientExternalModuleSourceFile.externalModuleIndicator);
                programDiagnostics.add(ts.createFileDiagnostic(firstNonAmbientExternalModuleSourceFile, span.start, span.length, Diagnostics.Cannot_use_imports_exports_or_module_augmentations_when_module_is_none));
            }
            // Cannot specify module gen that isn't amd or system with --out
            if (outFile) {
                if (options.module && !(options.module === ts.ModuleKind.AMD || options.module === ts.ModuleKind.System)) {
                    createDiagnosticForOptionName(Diagnostics.Only_amd_and_system_modules_are_supported_alongside_0, options.out ? "out" : "outFile", "module");
                }
                else if (options.module === undefined && firstNonAmbientExternalModuleSourceFile) {
                    const span = ts.getErrorSpanForNode(firstNonAmbientExternalModuleSourceFile, firstNonAmbientExternalModuleSourceFile.externalModuleIndicator);
                    programDiagnostics.add(ts.createFileDiagnostic(firstNonAmbientExternalModuleSourceFile, span.start, span.length, Diagnostics.Cannot_compile_modules_using_option_0_unless_the_module_flag_is_amd_or_system, options.out ? "out" : "outFile"));
                }
            }
            // there has to be common source directory if user specified --outdir || --sourceRoot
            // if user specified --mapRoot, there needs to be common source directory if there would be multiple files being emitted
            if (options.outDir || // there is --outDir specified
                options.sourceRoot || // there is --sourceRoot specified
                options.mapRoot) { // there is --mapRoot specified
                // Precalculate and cache the common source directory
                const dir = getCommonSourceDirectory();
                // If we failed to find a good common directory, but outDir is specified and at least one of our files is on a windows drive/URL/other resource, add a failure
                if (options.outDir && dir === "" && ts.forEach(files, file => ts.getRootLength(file.fileName) > 1)) {
                    createDiagnosticForOptionName(Diagnostics.Cannot_find_the_common_subdirectory_path_for_the_input_files, "outDir");
                }
            }
            if (!options.noEmit && options.allowJs && options.declaration) {
                createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_with_option_1, "allowJs", "declaration");
            }
            if (options.checkJs && !options.allowJs) {
                programDiagnostics.add(ts.createCompilerDiagnostic(Diagnostics.Option_0_cannot_be_specified_without_specifying_option_1, "checkJs", "allowJs"));
            }
            if (options.emitDeclarationOnly) {
                if (!options.declaration) {
                    createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_without_specifying_option_1, "emitDeclarationOnly", "declaration");
                }
                if (options.noEmit) {
                    createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_with_option_1, "emitDeclarationOnly", "noEmit");
                }
            }
            if (options.emitDecoratorMetadata &&
                !options.experimentalDecorators) {
                createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_without_specifying_option_1, "emitDecoratorMetadata", "experimentalDecorators");
            }
            if (options.jsxFactory) {
                if (options.reactNamespace) {
                    createDiagnosticForOptionName(Diagnostics.Option_0_cannot_be_specified_with_option_1, "reactNamespace", "jsxFactory");
                }
                if (!ts.parseIsolatedEntityName(options.jsxFactory, languageVersion)) {
                    createOptionValueDiagnostic("jsxFactory", Diagnostics.Invalid_value_for_jsxFactory_0_is_not_a_valid_identifier_or_qualified_name, options.jsxFactory);
                }
            }
            else if (options.reactNamespace && !ts.isIdentifierText(options.reactNamespace, languageVersion)) {
                createOptionValueDiagnostic("reactNamespace", Diagnostics.Invalid_value_for_reactNamespace_0_is_not_a_valid_identifier, options.reactNamespace);
            }
            // If the emit is enabled make sure that every output file is unique and not overwriting any of the input files
            if (!options.noEmit && !options.suppressOutputPathCheck) {
                const emitHost = getEmitHost();
                const emitFilesSeen = ts.createMap();
                ts.forEachEmittedFile(emitHost, (emitFileNames) => {
                    if (!options.emitDeclarationOnly) {
                        verifyEmitFilePath(emitFileNames.jsFilePath, emitFilesSeen);
                    }
                    verifyEmitFilePath(emitFileNames.declarationFilePath, emitFilesSeen);
                });
            }
            // Verify that all the emit files are unique and don't overwrite input files
            function verifyEmitFilePath(emitFileName, emitFilesSeen) {
                if (emitFileName) {
                    const emitFilePath = toPath(emitFileName);
                    // Report error if the output overwrites input file
                    if (filesByName.has(emitFilePath)) {
                        let chain;
                        if (!options.configFilePath) {
                            // The program is from either an inferred project or an external project
                            chain = ts.chainDiagnosticMessages(/*details*/ undefined, Diagnostics.Adding_a_tsconfig_json_file_will_help_organize_projects_that_contain_both_TypeScript_and_JavaScript_files_Learn_more_at_https_Colon_Slash_Slashaka_ms_Slashtsconfig);
                        }
                        chain = ts.chainDiagnosticMessages(chain, Diagnostics.Cannot_write_file_0_because_it_would_overwrite_input_file, emitFileName);
                        blockEmittingOfFile(emitFileName, ts.createCompilerDiagnosticFromMessageChain(chain));
                    }
                    const emitFileKey = !host.useCaseSensitiveFileNames() ? emitFilePath.toLocaleLowerCase() : emitFilePath;
                    // Report error if multiple files write into same file
                    if (emitFilesSeen.has(emitFileKey)) {
                        // Already seen the same emit file - report error
                        blockEmittingOfFile(emitFileName, ts.createCompilerDiagnostic(Diagnostics.Cannot_write_file_0_because_it_would_be_overwritten_by_multiple_input_files, emitFileName));
                    }
                    else {
                        emitFilesSeen.set(emitFileKey, true);
                    }
                }
            }
        }
        function createDiagnosticForOptionPathKeyValue(key, valueIndex, message, arg0, arg1, arg2) {
            let needCompilerDiagnostic = true;
            const pathsSyntax = getOptionPathsSyntax();
            for (const pathProp of pathsSyntax) {
                if (ts.isObjectLiteralExpression(pathProp.initializer)) {
                    for (const keyProps of ts.getPropertyAssignment(pathProp.initializer, key)) {
                        if (ts.isArrayLiteralExpression(keyProps.initializer) &&
                            keyProps.initializer.elements.length > valueIndex) {
                            programDiagnostics.add(ts.createDiagnosticForNodeInSourceFile(options.configFile, keyProps.initializer.elements[valueIndex], message, arg0, arg1, arg2));
                            needCompilerDiagnostic = false;
                        }
                    }
                }
            }
            if (needCompilerDiagnostic) {
                programDiagnostics.add(ts.createCompilerDiagnostic(message, arg0, arg1, arg2));
            }
        }
        function createDiagnosticForOptionPaths(onKey, key, message, arg0) {
            let needCompilerDiagnostic = true;
            const pathsSyntax = getOptionPathsSyntax();
            for (const pathProp of pathsSyntax) {
                if (ts.isObjectLiteralExpression(pathProp.initializer) &&
                    createOptionDiagnosticInObjectLiteralSyntax(pathProp.initializer, onKey, key, /*key2*/ undefined, message, arg0)) {
                    needCompilerDiagnostic = false;
                }
            }
            if (needCompilerDiagnostic) {
                programDiagnostics.add(ts.createCompilerDiagnostic(message, arg0));
            }
        }
        function getOptionPathsSyntax() {
            const compilerOptionsObjectLiteralSyntax = getCompilerOptionsObjectLiteralSyntax();
            if (compilerOptionsObjectLiteralSyntax) {
                return ts.getPropertyAssignment(compilerOptionsObjectLiteralSyntax, "paths");
            }
            return ts.emptyArray;
        }
        function createDiagnosticForOptionName(message, option1, option2, option3) {
            createDiagnosticForOption(/*onKey*/ true, option1, option2, message, option1, option2, option3);
        }
        function createOptionValueDiagnostic(option1, message, arg0) {
            createDiagnosticForOption(/*onKey*/ false, option1, /*option2*/ undefined, message, arg0);
        }
        function createDiagnosticForOption(onKey, option1, option2, message, arg0, arg1, arg2) {
            const compilerOptionsObjectLiteralSyntax = getCompilerOptionsObjectLiteralSyntax();
            const needCompilerDiagnostic = !compilerOptionsObjectLiteralSyntax ||
                !createOptionDiagnosticInObjectLiteralSyntax(compilerOptionsObjectLiteralSyntax, onKey, option1, option2, message, arg0, arg1, arg2);
            if (needCompilerDiagnostic) {
                programDiagnostics.add(ts.createCompilerDiagnostic(message, arg0, arg1, arg2));
            }
        }
        function getCompilerOptionsObjectLiteralSyntax() {
            if (_compilerOptionsObjectLiteralSyntax === undefined) {
                _compilerOptionsObjectLiteralSyntax = null; // tslint:disable-line:no-null-keyword
                if (options.configFile && options.configFile.jsonObject) {
                    for (const prop of ts.getPropertyAssignment(options.configFile.jsonObject, "compilerOptions")) {
                        if (ts.isObjectLiteralExpression(prop.initializer)) {
                            _compilerOptionsObjectLiteralSyntax = prop.initializer;
                            break;
                        }
                    }
                }
            }
            return _compilerOptionsObjectLiteralSyntax;
        }
        function createOptionDiagnosticInObjectLiteralSyntax(objectLiteral, onKey, key1, key2, message, arg0, arg1, arg2) {
            const props = ts.getPropertyAssignment(objectLiteral, key1, key2);
            for (const prop of props) {
                programDiagnostics.add(ts.createDiagnosticForNodeInSourceFile(options.configFile, onKey ? prop.name : prop.initializer, message, arg0, arg1, arg2));
            }
            return !!props.length;
        }
        function blockEmittingOfFile(emitFileName, diag) {
            hasEmitBlockingDiagnostics.set(toPath(emitFileName), true);
            programDiagnostics.add(diag);
        }
        function isEmittedFile(file) {
            if (options.noEmit) {
                return false;
            }
            // If this is source file, its not emitted file
            const filePath = toPath(file);
            if (getSourceFileByPath(filePath)) {
                return false;
            }
            // If options have --outFile or --out just check that
            const out = options.outFile || options.out;
            if (out) {
                return isSameFile(filePath, out) || isSameFile(filePath, ts.removeFileExtension(out) + ts.Extension.Dts);
            }
            // If --outDir, check if file is in that directory
            if (options.outDir) {
                return ts.containsPath(options.outDir, filePath, currentDirectory, !host.useCaseSensitiveFileNames());
            }
            if (ts.fileExtensionIsOneOf(filePath, ts.supportedJavascriptExtensions) || ts.fileExtensionIs(filePath, ts.Extension.Dts)) {
                // Otherwise just check if sourceFile with the name exists
                const filePathWithoutExtension = ts.removeFileExtension(filePath);
                return !!getSourceFileByPath(ts.combinePaths(filePathWithoutExtension, ts.Extension.Ts)) ||
                    !!getSourceFileByPath(ts.combinePaths(filePathWithoutExtension, ts.Extension.Tsx));
            }
            return false;
        }
        function isSameFile(file1, file2) {
            return ts.comparePaths(file1, file2, currentDirectory, !host.useCaseSensitiveFileNames()) === 0 /* EqualTo */;
        }
    }
    ts.createProgram = createProgram;
    /* @internal */
    /**
     * Returns a DiagnosticMessage if we won't include a resolved module due to its extension.
     * The DiagnosticMessage's parameters are the imported module name, and the filename it resolved to.
     * This returns a diagnostic even if the module will be an untyped module.
     */
    function getResolutionDiagnostic(options, { extension }) {
        switch (extension) {
            case ts.Extension.Ts:
            case ts.Extension.Dts:
                // These are always allowed.
                return undefined;
            case ts.Extension.Tsx:
                return needJsx();
            case ts.Extension.Jsx:
                return needJsx() || needAllowJs();
            case ts.Extension.Js:
                return needAllowJs();
        }
        function needJsx() {
            return options.jsx ? undefined : Diagnostics.Module_0_was_resolved_to_1_but_jsx_is_not_set;
        }
        function needAllowJs() {
            return options.allowJs || !ts.getStrictOptionValue(options, "noImplicitAny") ? undefined : Diagnostics.Could_not_find_a_declaration_file_for_module_0_1_implicitly_has_an_any_type;
        }
    }
    ts.getResolutionDiagnostic = getResolutionDiagnostic;
    function getModuleNames({ imports, moduleAugmentations }) {
        const res = imports.map(i => i.text);
        for (const aug of moduleAugmentations) {
            if (aug.kind === ts.SyntaxKind.StringLiteral) {
                res.push(aug.text);
            }
            // Do nothing if it's an Identifier; we don't need to do module resolution for `declare global`.
        }
        return res;
    }
})(ts || (ts = {}));
