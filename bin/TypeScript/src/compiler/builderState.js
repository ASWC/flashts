/*@internal*/
var ts;
(function (ts) {
    function getFileEmitOutput(program, sourceFile, emitOnlyDtsFiles, cancellationToken, customTransformers) {
        const outputFiles = [];
        const emitResult = program.emit(sourceFile, writeFile, cancellationToken, emitOnlyDtsFiles, customTransformers);
        return { outputFiles, emitSkipped: emitResult.emitSkipped };
        function writeFile(fileName, text, writeByteOrderMark) {
            outputFiles.push({ name: fileName, writeByteOrderMark, text });
        }
    }
    ts.getFileEmitOutput = getFileEmitOutput;
})(ts || (ts = {}));
/*@internal*/
(function (ts) {
    var BuilderState;
    (function (BuilderState) {
        /**
         * Gets the referenced files for a file from the program with values for the keys as referenced file's path to be true
         */
        function getReferencedFiles(program, sourceFile, getCanonicalFileName) {
            let referencedFiles;
            // We need to use a set here since the code can contain the same import twice,
            // but that will only be one dependency.
            // To avoid invernal conversion, the key of the referencedFiles map must be of type Path
            if (sourceFile.imports && sourceFile.imports.length > 0) {
                const checker = program.getTypeChecker();
                for (const importName of sourceFile.imports) {
                    const symbol = checker.getSymbolAtLocation(importName);
                    if (symbol && symbol.declarations && symbol.declarations[0]) {
                        const declarationSourceFile = ts.getSourceFileOfNode(symbol.declarations[0]);
                        if (declarationSourceFile) {
                            addReferencedFile(declarationSourceFile.path);
                        }
                    }
                }
            }
            const sourceFileDirectory = ts.getDirectoryPath(sourceFile.path);
            // Handle triple slash references
            if (sourceFile.referencedFiles && sourceFile.referencedFiles.length > 0) {
                for (const referencedFile of sourceFile.referencedFiles) {
                    const referencedPath = ts.toPath(referencedFile.fileName, sourceFileDirectory, getCanonicalFileName);
                    addReferencedFile(referencedPath);
                }
            }
            // Handle type reference directives
            if (sourceFile.resolvedTypeReferenceDirectiveNames) {
                sourceFile.resolvedTypeReferenceDirectiveNames.forEach((resolvedTypeReferenceDirective) => {
                    if (!resolvedTypeReferenceDirective) {
                        return;
                    }
                    const fileName = resolvedTypeReferenceDirective.resolvedFileName;
                    const typeFilePath = ts.toPath(fileName, sourceFileDirectory, getCanonicalFileName);
                    addReferencedFile(typeFilePath);
                });
            }
            return referencedFiles;
            function addReferencedFile(referencedPath) {
                if (!referencedFiles) {
                    referencedFiles = ts.createMap();
                }
                referencedFiles.set(referencedPath, true);
            }
        }
        /**
         * Returns true if oldState is reusable, that is the emitKind = module/non module has not changed
         */
        function canReuseOldState(newReferencedMap, oldState) {
            return oldState && !oldState.referencedMap === !newReferencedMap;
        }
        BuilderState.canReuseOldState = canReuseOldState;
        /**
         * Creates the state of file references and signature for the new program from oldState if it is safe
         */
        function create(newProgram, getCanonicalFileName, oldState) {
            const fileInfos = ts.createMap();
            const referencedMap = newProgram.getCompilerOptions().module !== ts.ModuleKind.None ? ts.createMap() : undefined;
            const hasCalledUpdateShapeSignature = ts.createMap();
            const useOldState = canReuseOldState(referencedMap, oldState);
            // Create the reference map, and set the file infos
            for (const sourceFile of newProgram.getSourceFiles()) {
                const version = sourceFile.version;
                const oldInfo = useOldState && oldState.fileInfos.get(sourceFile.path);
                if (referencedMap) {
                    const newReferences = getReferencedFiles(newProgram, sourceFile, getCanonicalFileName);
                    if (newReferences) {
                        referencedMap.set(sourceFile.path, newReferences);
                    }
                }
                fileInfos.set(sourceFile.path, { version, signature: oldInfo && oldInfo.signature });
            }
            return {
                fileInfos,
                referencedMap,
                hasCalledUpdateShapeSignature,
                allFilesExcludingDefaultLibraryFile: undefined,
                allFileNames: undefined
            };
        }
        BuilderState.create = create;
        /**
         * Gets the files affected by the path from the program
         */
        function getFilesAffectedBy(state, programOfThisState, path, cancellationToken, computeHash, cacheToUpdateSignature) {
            // Since the operation could be cancelled, the signatures are always stored in the cache
            // They will be commited once it is safe to use them
            // eg when calling this api from tsserver, if there is no cancellation of the operation
            // In the other cases the affected files signatures are commited only after the iteration through the result is complete
            const signatureCache = cacheToUpdateSignature || ts.createMap();
            const sourceFile = programOfThisState.getSourceFileByPath(path);
            if (!sourceFile) {
                return ts.emptyArray;
            }
            if (!updateShapeSignature(state, programOfThisState, sourceFile, signatureCache, cancellationToken, computeHash)) {
                return [sourceFile];
            }
            const result = (state.referencedMap ? getFilesAffectedByUpdatedShapeWhenModuleEmit : getFilesAffectedByUpdatedShapeWhenNonModuleEmit)(state, programOfThisState, sourceFile, signatureCache, cancellationToken, computeHash);
            if (!cacheToUpdateSignature) {
                // Commit all the signatures in the signature cache
                updateSignaturesFromCache(state, signatureCache);
            }
            return result;
        }
        BuilderState.getFilesAffectedBy = getFilesAffectedBy;
        /**
         * Updates the signatures from the cache into state's fileinfo signatures
         * This should be called whenever it is safe to commit the state of the builder
         */
        function updateSignaturesFromCache(state, signatureCache) {
            signatureCache.forEach((signature, path) => {
                state.fileInfos.get(path).signature = signature;
                state.hasCalledUpdateShapeSignature.set(path, true);
            });
        }
        BuilderState.updateSignaturesFromCache = updateSignaturesFromCache;
        /**
         * Returns if the shape of the signature has changed since last emit
         */
        function updateShapeSignature(state, programOfThisState, sourceFile, cacheToUpdateSignature, cancellationToken, computeHash) {
            ts.Debug.assert(!!sourceFile);
            // If we have cached the result for this file, that means hence forth we should assume file shape is uptodate
            if (state.hasCalledUpdateShapeSignature.has(sourceFile.path) || cacheToUpdateSignature.has(sourceFile.path)) {
                return false;
            }
            const info = state.fileInfos.get(sourceFile.path);
            ts.Debug.assert(!!info);
            const prevSignature = info.signature;
            let latestSignature;
            if (sourceFile.isDeclarationFile) {
                latestSignature = sourceFile.version;
            }
            else {
                const emitOutput = ts.getFileEmitOutput(programOfThisState, sourceFile, /*emitOnlyDtsFiles*/ true, cancellationToken);
                if (emitOutput.outputFiles && emitOutput.outputFiles.length > 0) {
                    latestSignature = computeHash(emitOutput.outputFiles[0].text);
                }
                else {
                    latestSignature = prevSignature;
                }
            }
            cacheToUpdateSignature.set(sourceFile.path, latestSignature);
            return !prevSignature || latestSignature !== prevSignature;
        }
        /**
         * Get all the dependencies of the sourceFile
         */
        function getAllDependencies(state, programOfThisState, sourceFile) {
            const compilerOptions = programOfThisState.getCompilerOptions();
            // With --out or --outFile all outputs go into single file, all files depend on each other
            if (compilerOptions.outFile || compilerOptions.out) {
                return getAllFileNames(state, programOfThisState);
            }
            // If this is non module emit, or its a global file, it depends on all the source files
            if (!state.referencedMap || (!ts.isExternalModule(sourceFile) && !containsOnlyAmbientModules(sourceFile))) {
                return getAllFileNames(state, programOfThisState);
            }
            // Get the references, traversing deep from the referenceMap
            const seenMap = ts.createMap();
            const queue = [sourceFile.path];
            while (queue.length) {
                const path = queue.pop();
                if (!seenMap.has(path)) {
                    seenMap.set(path, true);
                    const references = state.referencedMap.get(path);
                    if (references) {
                        const iterator = references.keys();
                        for (let { value, done } = iterator.next(); !done; { value, done } = iterator.next()) {
                            queue.push(value);
                        }
                    }
                }
            }
            return ts.arrayFrom(ts.mapDefinedIterator(seenMap.keys(), path => {
                const file = programOfThisState.getSourceFileByPath(path);
                return file ? file.fileName : path;
            }));
        }
        BuilderState.getAllDependencies = getAllDependencies;
        /**
         * Gets the names of all files from the program
         */
        function getAllFileNames(state, programOfThisState) {
            if (!state.allFileNames) {
                const sourceFiles = programOfThisState.getSourceFiles();
                state.allFileNames = sourceFiles === ts.emptyArray ? ts.emptyArray : sourceFiles.map(file => file.fileName);
            }
            return state.allFileNames;
        }
        /**
         * Gets the files referenced by the the file path
         */
        function getReferencedByPaths(state, referencedFilePath) {
            return ts.arrayFrom(ts.mapDefinedIterator(state.referencedMap.entries(), ([filePath, referencesInFile]) => referencesInFile.has(referencedFilePath) ? filePath : undefined));
        }
        /**
         * For script files that contains only ambient external modules, although they are not actually external module files,
         * they can only be consumed via importing elements from them. Regular script files cannot consume them. Therefore,
         * there are no point to rebuild all script files if these special files have changed. However, if any statement
         * in the file is not ambient external module, we treat it as a regular script file.
         */
        function containsOnlyAmbientModules(sourceFile) {
            for (const statement of sourceFile.statements) {
                if (!ts.isModuleWithStringLiteralName(statement)) {
                    return false;
                }
            }
            return true;
        }
        /**
         * Gets all files of the program excluding the default library file
         */
        function getAllFilesExcludingDefaultLibraryFile(state, programOfThisState, firstSourceFile) {
            // Use cached result
            if (state.allFilesExcludingDefaultLibraryFile) {
                return state.allFilesExcludingDefaultLibraryFile;
            }
            let result;
            addSourceFile(firstSourceFile);
            for (const sourceFile of programOfThisState.getSourceFiles()) {
                if (sourceFile !== firstSourceFile) {
                    addSourceFile(sourceFile);
                }
            }
            state.allFilesExcludingDefaultLibraryFile = result || ts.emptyArray;
            return state.allFilesExcludingDefaultLibraryFile;
            function addSourceFile(sourceFile) {
                if (!programOfThisState.isSourceFileDefaultLibrary(sourceFile)) {
                    (result || (result = [])).push(sourceFile);
                }
            }
        }
        /**
         * When program emits non modular code, gets the files affected by the sourceFile whose shape has changed
         */
        function getFilesAffectedByUpdatedShapeWhenNonModuleEmit(state, programOfThisState, sourceFileWithUpdatedShape) {
            const compilerOptions = programOfThisState.getCompilerOptions();
            // If `--out` or `--outFile` is specified, any new emit will result in re-emitting the entire project,
            // so returning the file itself is good enough.
            if (compilerOptions && (compilerOptions.out || compilerOptions.outFile)) {
                return [sourceFileWithUpdatedShape];
            }
            return getAllFilesExcludingDefaultLibraryFile(state, programOfThisState, sourceFileWithUpdatedShape);
        }
        /**
         * When program emits modular code, gets the files affected by the sourceFile whose shape has changed
         */
        function getFilesAffectedByUpdatedShapeWhenModuleEmit(state, programOfThisState, sourceFileWithUpdatedShape, cacheToUpdateSignature, cancellationToken, computeHash) {
            if (!ts.isExternalModule(sourceFileWithUpdatedShape) && !containsOnlyAmbientModules(sourceFileWithUpdatedShape)) {
                return getAllFilesExcludingDefaultLibraryFile(state, programOfThisState, sourceFileWithUpdatedShape);
            }
            const compilerOptions = programOfThisState.getCompilerOptions();
            if (compilerOptions && (compilerOptions.isolatedModules || compilerOptions.out || compilerOptions.outFile)) {
                return [sourceFileWithUpdatedShape];
            }
            // Now we need to if each file in the referencedBy list has a shape change as well.
            // Because if so, its own referencedBy files need to be saved as well to make the
            // emitting result consistent with files on disk.
            const seenFileNamesMap = ts.createMap();
            // Start with the paths this file was referenced by
            seenFileNamesMap.set(sourceFileWithUpdatedShape.path, sourceFileWithUpdatedShape);
            const queue = getReferencedByPaths(state, sourceFileWithUpdatedShape.path);
            while (queue.length > 0) {
                const currentPath = queue.pop();
                if (!seenFileNamesMap.has(currentPath)) {
                    const currentSourceFile = programOfThisState.getSourceFileByPath(currentPath);
                    seenFileNamesMap.set(currentPath, currentSourceFile);
                    if (currentSourceFile && updateShapeSignature(state, programOfThisState, currentSourceFile, cacheToUpdateSignature, cancellationToken, computeHash)) {
                        queue.push(...getReferencedByPaths(state, currentPath));
                    }
                }
            }
            // Return array of values that needs emit
            // Return array of values that needs emit
            return ts.arrayFrom(ts.mapDefinedIterator(seenFileNamesMap.values(), value => value));
        }
    })(BuilderState = ts.BuilderState || (ts.BuilderState = {}));
})(ts || (ts = {}));
