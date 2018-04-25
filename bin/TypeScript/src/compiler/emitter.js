var ts;
(function (ts) {
    const brackets = createBracketsMap();
    /*@internal*/
    /**
     * Iterates over the source files that are expected to have an emit output.
     *
     * @param host An EmitHost.
     * @param action The action to execute.
     * @param sourceFilesOrTargetSourceFile
     *   If an array, the full list of source files to emit.
     *   Else, calls `getSourceFilesToEmit` with the (optional) target source file to determine the list of source files to emit.
     */
    function forEachEmittedFile(host, action, sourceFilesOrTargetSourceFile, emitOnlyDtsFiles) {
        const sourceFiles = ts.isArray(sourceFilesOrTargetSourceFile) ? sourceFilesOrTargetSourceFile : ts.getSourceFilesToEmit(host, sourceFilesOrTargetSourceFile);
        const options = host.getCompilerOptions();
        if (options.outFile || options.out) {
            if (sourceFiles.length) {
                const bundle = ts.createBundle(sourceFiles);
                const result = action(getOutputPathsFor(bundle, host, emitOnlyDtsFiles), bundle);
                if (result) {
                    return result;
                }
            }
        }
        else {
            for (const sourceFile of sourceFiles) {
                const result = action(getOutputPathsFor(sourceFile, host, emitOnlyDtsFiles), sourceFile);
                if (result) {
                    return result;
                }
            }
        }
    }
    ts.forEachEmittedFile = forEachEmittedFile;
    /*@internal*/
    function getOutputPathsFor(sourceFile, host, forceDtsPaths) {
        const options = host.getCompilerOptions();
        if (sourceFile.kind === ts.SyntaxKind.Bundle) {
            const jsFilePath = options.outFile || options.out;
            const sourceMapFilePath = getSourceMapFilePath(jsFilePath, options);
            const declarationFilePath = (forceDtsPaths || options.declaration) ? ts.removeFileExtension(jsFilePath) + ts.Extension.Dts : undefined;
            const declarationMapPath = ts.getAreDeclarationMapsEnabled(options) ? declarationFilePath + ".map" : undefined;
            return { jsFilePath, sourceMapFilePath, declarationFilePath, declarationMapPath };
        }
        else {
            const jsFilePath = ts.getOwnEmitOutputFilePath(sourceFile, host, getOutputExtension(sourceFile, options));
            const sourceMapFilePath = getSourceMapFilePath(jsFilePath, options);
            // For legacy reasons (ie, we have baselines capturing the behavior), js files don't report a .d.ts output path - this would only matter if `declaration` and `allowJs` were both on, which is currently an error
            const isJs = ts.isSourceFileJavaScript(sourceFile);
            const declarationFilePath = ((forceDtsPaths || options.declaration) && !isJs) ? ts.getDeclarationEmitOutputFilePath(sourceFile, host) : undefined;
            const declarationMapPath = ts.getAreDeclarationMapsEnabled(options) ? declarationFilePath + ".map" : undefined;
            return { jsFilePath, sourceMapFilePath, declarationFilePath, declarationMapPath };
        }
    }
    ts.getOutputPathsFor = getOutputPathsFor;
    function getSourceMapFilePath(jsFilePath, options) {
        return (options.sourceMap && !options.inlineSourceMap) ? jsFilePath + ".map" : undefined;
    }
    // JavaScript files are always LanguageVariant.JSX, as JSX syntax is allowed in .js files also.
    // So for JavaScript files, '.jsx' is only emitted if the input was '.jsx', and JsxEmit.Preserve.
    // For TypeScript, the only time to emit with a '.jsx' extension, is on JSX input, and JsxEmit.Preserve
    function getOutputExtension(sourceFile, options) {
        if (options.jsx === ts.JsxEmit.Preserve) {
            if (ts.isSourceFileJavaScript(sourceFile)) {
                if (ts.fileExtensionIs(sourceFile.fileName, ts.Extension.Jsx)) {
                    return ts.Extension.Jsx;
                }
            }
            else if (sourceFile.languageVariant === ts.LanguageVariant.JSX) {
                // TypeScript source file preserving JSX syntax
                return ts.Extension.Jsx;
            }
        }
        return ts.Extension.Js;
    }
    /*@internal*/
    // targetSourceFile is when users only want one file in entire project to be emitted. This is used in compileOnSave feature
    function emitFiles(resolver, host, targetSourceFile, emitOnlyDtsFiles, transformers) {
        const compilerOptions = host.getCompilerOptions();
        const sourceMapDataList = (compilerOptions.sourceMap || compilerOptions.inlineSourceMap || ts.getAreDeclarationMapsEnabled(compilerOptions)) ? [] : undefined;
        const emittedFilesList = compilerOptions.listEmittedFiles ? [] : undefined;
        const emitterDiagnostics = ts.createDiagnosticCollection();
        const newLine = host.getNewLine();
        const writer = ts.createTextWriter(newLine);
        const sourceMap = ts.createSourceMapWriter(host, writer);
        const declarationSourceMap = ts.createSourceMapWriter(host, writer, {
            sourceMap: compilerOptions.declarationMap,
            sourceRoot: compilerOptions.sourceRoot,
            mapRoot: compilerOptions.mapRoot,
            extendedDiagnostics: compilerOptions.extendedDiagnostics,
        });
        let emitSkipped = false;
        // Emit each output file
        ts.performance.mark("beforePrint");
        forEachEmittedFile(host, emitSourceFileOrBundle, ts.getSourceFilesToEmit(host, targetSourceFile), emitOnlyDtsFiles);
        ts.performance.measure("printTime", "beforePrint");
        return {
            emitSkipped,
            diagnostics: emitterDiagnostics.getDiagnostics(),
            emittedFiles: emittedFilesList,
            sourceMaps: sourceMapDataList
        };
        function emitSourceFileOrBundle({ jsFilePath, sourceMapFilePath, declarationFilePath, declarationMapPath }, sourceFileOrBundle) {
            emitJsFileOrBundle(sourceFileOrBundle, jsFilePath, sourceMapFilePath);
            emitDeclarationFileOrBundle(sourceFileOrBundle, declarationFilePath, declarationMapPath);
            if (!emitSkipped && emittedFilesList) {
                if (!emitOnlyDtsFiles) {
                    emittedFilesList.push(jsFilePath);
                }
                if (sourceMapFilePath) {
                    emittedFilesList.push(sourceMapFilePath);
                }
                if (declarationFilePath) {
                    emittedFilesList.push(declarationFilePath);
                }
            }
        }
        function emitJsFileOrBundle(sourceFileOrBundle, jsFilePath, sourceMapFilePath) {
            const sourceFiles = ts.isSourceFile(sourceFileOrBundle) ? [sourceFileOrBundle] : sourceFileOrBundle.sourceFiles;
            // Make sure not to write js file and source map file if any of them cannot be written
            if (host.isEmitBlocked(jsFilePath) || compilerOptions.noEmit || compilerOptions.emitDeclarationOnly) {
                emitSkipped = true;
                return;
            }
            if (emitOnlyDtsFiles) {
                return;
            }
            // Transform the source files
            const transform = ts.transformNodes(resolver, host, compilerOptions, sourceFiles, transformers, /*allowDtsFiles*/ false);
            // Create a printer to print the nodes
            const printer = createPrinter(Object.assign({}, compilerOptions, { noEmitHelpers: compilerOptions.noEmitHelpers }), {
                // resolver hooks
                hasGlobalName: resolver.hasGlobalName,
                // transform hooks
                onEmitNode: transform.emitNodeWithNotification,
                substituteNode: transform.substituteNode,
                // sourcemap hooks
                onEmitSourceMapOfNode: sourceMap.emitNodeWithSourceMap,
                onEmitSourceMapOfToken: sourceMap.emitTokenWithSourceMap,
                onEmitSourceMapOfPosition: sourceMap.emitPos,
                // emitter hooks
                onSetSourceFile: setSourceFile,
            });
            printSourceFileOrBundle(jsFilePath, sourceMapFilePath, ts.isSourceFile(sourceFileOrBundle) ? transform.transformed[0] : ts.createBundle(transform.transformed), printer, sourceMap);
            // Clean up emit nodes on parse tree
            transform.dispose();
        }
        function emitDeclarationFileOrBundle(sourceFileOrBundle, declarationFilePath, declarationMapPath) {
            if (!(declarationFilePath && !ts.isInJavaScriptFile(sourceFileOrBundle))) {
                return;
            }
            const sourceFiles = ts.isSourceFile(sourceFileOrBundle) ? [sourceFileOrBundle] : sourceFileOrBundle.sourceFiles;
            // Setup and perform the transformation to retrieve declarations from the input files
            const nonJsFiles = ts.filter(sourceFiles, ts.isSourceFileNotJavaScript);
            const inputListOrBundle = (compilerOptions.outFile || compilerOptions.out) ? [ts.createBundle(nonJsFiles)] : nonJsFiles;
            const declarationTransform = ts.transformNodes(resolver, host, compilerOptions, inputListOrBundle, [ts.transformDeclarations], /*allowDtsFiles*/ false);
            if (ts.length(declarationTransform.diagnostics)) {
                for (const diagnostic of declarationTransform.diagnostics) {
                    emitterDiagnostics.add(diagnostic);
                }
            }
            const declarationPrinter = createPrinter(Object.assign({}, compilerOptions, { onlyPrintJsDocStyle: true, noEmitHelpers: true }), {
                // resolver hooks
                hasGlobalName: resolver.hasGlobalName,
                // sourcemap hooks
                onEmitSourceMapOfNode: declarationSourceMap.emitNodeWithSourceMap,
                onEmitSourceMapOfToken: declarationSourceMap.emitTokenWithSourceMap,
                onEmitSourceMapOfPosition: declarationSourceMap.emitPos,
                onSetSourceFile: setSourceFileForDeclarationSourceMaps,
                // transform hooks
                onEmitNode: declarationTransform.emitNodeWithNotification,
                substituteNode: declarationTransform.substituteNode,
            });
            const declBlocked = (!!declarationTransform.diagnostics && !!declarationTransform.diagnostics.length) || !!host.isEmitBlocked(declarationFilePath) || !!compilerOptions.noEmit;
            emitSkipped = emitSkipped || declBlocked;
            if (!declBlocked || emitOnlyDtsFiles) {
                printSourceFileOrBundle(declarationFilePath, declarationMapPath, declarationTransform.transformed[0], declarationPrinter, declarationSourceMap);
            }
            declarationTransform.dispose();
        }
        function printSourceFileOrBundle(jsFilePath, sourceMapFilePath, sourceFileOrBundle, printer, mapRecorder) {
            const bundle = sourceFileOrBundle.kind === ts.SyntaxKind.Bundle ? sourceFileOrBundle : undefined;
            const sourceFile = sourceFileOrBundle.kind === ts.SyntaxKind.SourceFile ? sourceFileOrBundle : undefined;
            const sourceFiles = bundle ? bundle.sourceFiles : [sourceFile];
            mapRecorder.initialize(jsFilePath, sourceMapFilePath || "", sourceFileOrBundle, sourceMapDataList);
            if (bundle) {
                printer.writeBundle(bundle, writer);
            }
            else {
                printer.writeFile(sourceFile, writer);
            }
            writer.writeLine();
            const sourceMappingURL = mapRecorder.getSourceMappingURL();
            if (sourceMappingURL) {
                writer.write(`//# ${"sourceMappingURL"}=${sourceMappingURL}`); // Sometimes tools can sometimes see this line as a source mapping url comment
            }
            // Write the source map
            if (sourceMapFilePath) {
                ts.writeFile(host, emitterDiagnostics, sourceMapFilePath, mapRecorder.getText(), /*writeByteOrderMark*/ false, sourceFiles);
            }
            // Write the output file
            ts.writeFile(host, emitterDiagnostics, jsFilePath, writer.getText(), compilerOptions.emitBOM, sourceFiles);
            // Reset state
            mapRecorder.reset();
            writer.clear();
        }
        function setSourceFile(node) {
            sourceMap.setSourceFile(node);
        }
        function setSourceFileForDeclarationSourceMaps(node) {
            declarationSourceMap.setSourceFile(node);
        }
    }
    ts.emitFiles = emitFiles;
    function createPrinter(printerOptions = {}, handlers = {}) {
        const { hasGlobalName, onEmitSourceMapOfNode, onEmitSourceMapOfToken, onEmitSourceMapOfPosition, onEmitNode, onSetSourceFile, substituteNode, onBeforeEmitNodeArray, onAfterEmitNodeArray, onBeforeEmitToken, onAfterEmitToken } = handlers;
        const newLine = ts.getNewLineCharacter(printerOptions);
        const comments = ts.createCommentWriter(printerOptions, onEmitSourceMapOfPosition);
        const { emitNodeWithComments, emitBodyWithDetachedComments, emitTrailingCommentsOfPosition, emitLeadingCommentsOfPosition, } = comments;
        let currentSourceFile;
        let nodeIdToGeneratedName; // Map of generated names for specific nodes.
        let autoGeneratedIdToGeneratedName; // Map of generated names for temp and loop variables.
        let generatedNames; // Set of names generated by the NameGenerator.
        let tempFlagsStack; // Stack of enclosing name generation scopes.
        let tempFlags; // TempFlags for the current name generation scope.
        let reservedNamesStack; // Stack of TempFlags reserved in enclosing name generation scopes.
        let reservedNames; // TempFlags to reserve in nested name generation scopes.
        let writer;
        let ownWriter;
        let write = writeBase;
        let commitPendingSemicolon = ts.noop;
        let writeSemicolon = writeSemicolonInternal;
        let pendingSemicolon = false;
        if (printerOptions.omitTrailingSemicolon) {
            commitPendingSemicolon = commitPendingSemicolonInternal;
            writeSemicolon = deferWriteSemicolon;
        }
        const syntheticParent = { pos: -1, end: -1 };
        const moduleKind = ts.getEmitModuleKind(printerOptions);
        const bundledHelpers = ts.createMap();
        let isOwnFileEmit;
        reset();
        return {
            // public API
            printNode,
            printList,
            printFile,
            printBundle,
            // internal API
            writeNode,
            writeList,
            writeFile,
            writeBundle
        };
        function printNode(hint, node, sourceFile) {
            switch (hint) {
                case ts.EmitHint.SourceFile:
                    ts.Debug.assert(ts.isSourceFile(node), "Expected a SourceFile node.");
                    break;
                case ts.EmitHint.IdentifierName:
                    ts.Debug.assert(ts.isIdentifier(node), "Expected an Identifier node.");
                    break;
                case ts.EmitHint.Expression:
                    ts.Debug.assert(ts.isExpression(node), "Expected an Expression node.");
                    break;
            }
            switch (node.kind) {
                case ts.SyntaxKind.SourceFile: return printFile(node);
                case ts.SyntaxKind.Bundle: return printBundle(node);
            }
            writeNode(hint, node, sourceFile, beginPrint());
            return endPrint();
        }
        function printList(format, nodes, sourceFile) {
            writeList(format, nodes, sourceFile, beginPrint());
            return endPrint();
        }
        function printBundle(bundle) {
            writeBundle(bundle, beginPrint());
            return endPrint();
        }
        function printFile(sourceFile) {
            writeFile(sourceFile, beginPrint());
            return endPrint();
        }
        function writeNode(hint, node, sourceFile, output) {
            const previousWriter = writer;
            setWriter(output);
            print(hint, node, sourceFile);
            reset();
            writer = previousWriter;
        }
        function writeList(format, nodes, sourceFile, output) {
            const previousWriter = writer;
            setWriter(output);
            if (sourceFile) {
                setSourceFile(sourceFile);
            }
            emitList(syntheticParent, nodes, format);
            reset();
            writer = previousWriter;
        }
        function writeBundle(bundle, output) {
            isOwnFileEmit = false;
            const previousWriter = writer;
            setWriter(output);
            emitShebangIfNeeded(bundle);
            emitPrologueDirectivesIfNeeded(bundle);
            emitHelpers(bundle);
            emitSyntheticTripleSlashReferencesIfNeeded(bundle);
            for (const sourceFile of bundle.sourceFiles) {
                print(ts.EmitHint.SourceFile, sourceFile, sourceFile);
            }
            reset();
            writer = previousWriter;
        }
        function writeFile(sourceFile, output) {
            isOwnFileEmit = true;
            const previousWriter = writer;
            setWriter(output);
            emitShebangIfNeeded(sourceFile);
            emitPrologueDirectivesIfNeeded(sourceFile);
            print(ts.EmitHint.SourceFile, sourceFile, sourceFile);
            reset();
            writer = previousWriter;
        }
        function beginPrint() {
            return ownWriter || (ownWriter = ts.createTextWriter(newLine));
        }
        function endPrint() {
            const text = ownWriter.getText();
            ownWriter.clear();
            return text;
        }
        function print(hint, node, sourceFile) {
            if (sourceFile) {
                setSourceFile(sourceFile);
            }
            pipelineEmitWithNotification(hint, node);
        }
        function setSourceFile(sourceFile) {
            currentSourceFile = sourceFile;
            comments.setSourceFile(sourceFile);
            if (onSetSourceFile) {
                onSetSourceFile(sourceFile);
            }
        }
        function setWriter(output) {
            writer = output;
            comments.setWriter(output);
        }
        function reset() {
            nodeIdToGeneratedName = [];
            autoGeneratedIdToGeneratedName = [];
            generatedNames = ts.createMap();
            tempFlagsStack = [];
            tempFlags = 0 /* Auto */;
            reservedNamesStack = [];
            comments.reset();
            setWriter(/*output*/ undefined);
        }
        // TODO: Should this just be `emit`?
        // See https://github.com/Microsoft/TypeScript/pull/18284#discussion_r137611034
        function emitIfPresent(node) {
            if (node) {
                emit(node);
            }
        }
        function emit(node) {
            pipelineEmitWithNotification(ts.EmitHint.Unspecified, node);
        }
        function emitIdentifierName(node) {
            pipelineEmitWithNotification(ts.EmitHint.IdentifierName, node);
        }
        function emitExpression(node) {
            pipelineEmitWithNotification(ts.EmitHint.Expression, node);
        }
        function pipelineEmitWithNotification(hint, node) {
            if (onEmitNode) {
                onEmitNode(hint, node, pipelineEmitWithComments);
            }
            else {
                pipelineEmitWithComments(hint, node);
            }
        }
        function pipelineEmitWithComments(hint, node) {
            node = trySubstituteNode(hint, node);
            if (emitNodeWithComments && hint !== ts.EmitHint.SourceFile) {
                emitNodeWithComments(hint, node, pipelineEmitWithSourceMap);
            }
            else {
                pipelineEmitWithSourceMap(hint, node);
            }
        }
        function pipelineEmitWithSourceMap(hint, node) {
            if (onEmitSourceMapOfNode && hint !== ts.EmitHint.SourceFile && hint !== ts.EmitHint.IdentifierName) {
                onEmitSourceMapOfNode(hint, node, pipelineEmitWithHint);
            }
            else {
                pipelineEmitWithHint(hint, node);
            }
        }
        function pipelineEmitWithHint(hint, node) {
            switch (hint) {
                case ts.EmitHint.SourceFile: return pipelineEmitSourceFile(node);
                case ts.EmitHint.IdentifierName: return pipelineEmitIdentifierName(node);
                case ts.EmitHint.Expression: return pipelineEmitExpression(node);
                case ts.EmitHint.MappedTypeParameter: return emitMappedTypeParameter(ts.cast(node, ts.isTypeParameterDeclaration));
                case ts.EmitHint.Unspecified: return pipelineEmitUnspecified(node);
            }
        }
        function pipelineEmitSourceFile(node) {
            ts.Debug.assertNode(node, ts.isSourceFile);
            emitSourceFile(node);
        }
        function pipelineEmitIdentifierName(node) {
            ts.Debug.assertNode(node, ts.isIdentifier);
            emitIdentifier(node);
        }
        function emitMappedTypeParameter(node) {
            emit(node.name);
            writeSpace();
            writeKeyword("in");
            writeSpace();
            emitIfPresent(node.constraint);
        }
        function pipelineEmitUnspecified(node) {
            const kind = node.kind;
            // Reserved words
            // Strict mode reserved words
            // Contextual keywords
            if (ts.isKeyword(kind)) {
                writeTokenNode(node, writeKeyword);
                return;
            }
            switch (kind) {
                // Pseudo-literals
                case ts.SyntaxKind.TemplateHead:
                case ts.SyntaxKind.TemplateMiddle:
                case ts.SyntaxKind.TemplateTail:
                    return emitLiteral(node);
                // Identifiers
                case ts.SyntaxKind.Identifier:
                    return emitIdentifier(node);
                // Parse tree nodes
                // Names
                case ts.SyntaxKind.QualifiedName:
                    return emitQualifiedName(node);
                case ts.SyntaxKind.ComputedPropertyName:
                    return emitComputedPropertyName(node);
                // Signature elements
                case ts.SyntaxKind.TypeParameter:
                    return emitTypeParameter(node);
                case ts.SyntaxKind.Parameter:
                    return emitParameter(node);
                case ts.SyntaxKind.Decorator:
                    return emitDecorator(node);
                // Type members
                case ts.SyntaxKind.PropertySignature:
                    return emitPropertySignature(node);
                case ts.SyntaxKind.PropertyDeclaration:
                    return emitPropertyDeclaration(node);
                case ts.SyntaxKind.MethodSignature:
                    return emitMethodSignature(node);
                case ts.SyntaxKind.MethodDeclaration:
                    return emitMethodDeclaration(node);
                case ts.SyntaxKind.Constructor:
                    return emitConstructor(node);
                case ts.SyntaxKind.GetAccessor:
                case ts.SyntaxKind.SetAccessor:
                    return emitAccessorDeclaration(node);
                case ts.SyntaxKind.CallSignature:
                    return emitCallSignature(node);
                case ts.SyntaxKind.ConstructSignature:
                    return emitConstructSignature(node);
                case ts.SyntaxKind.IndexSignature:
                    return emitIndexSignature(node);
                // Types
                case ts.SyntaxKind.TypePredicate:
                    return emitTypePredicate(node);
                case ts.SyntaxKind.TypeReference:
                    return emitTypeReference(node);
                case ts.SyntaxKind.FunctionType:
                    return emitFunctionType(node);
                case ts.SyntaxKind.JSDocFunctionType:
                    return emitJSDocFunctionType(node);
                case ts.SyntaxKind.ConstructorType:
                    return emitConstructorType(node);
                case ts.SyntaxKind.TypeQuery:
                    return emitTypeQuery(node);
                case ts.SyntaxKind.TypeLiteral:
                    return emitTypeLiteral(node);
                case ts.SyntaxKind.ArrayType:
                    return emitArrayType(node);
                case ts.SyntaxKind.TupleType:
                    return emitTupleType(node);
                case ts.SyntaxKind.UnionType:
                    return emitUnionType(node);
                case ts.SyntaxKind.IntersectionType:
                    return emitIntersectionType(node);
                case ts.SyntaxKind.ConditionalType:
                    return emitConditionalType(node);
                case ts.SyntaxKind.InferType:
                    return emitInferType(node);
                case ts.SyntaxKind.ParenthesizedType:
                    return emitParenthesizedType(node);
                case ts.SyntaxKind.ExpressionWithTypeArguments:
                    return emitExpressionWithTypeArguments(node);
                case ts.SyntaxKind.ThisType:
                    return emitThisType();
                case ts.SyntaxKind.TypeOperator:
                    return emitTypeOperator(node);
                case ts.SyntaxKind.IndexedAccessType:
                    return emitIndexedAccessType(node);
                case ts.SyntaxKind.MappedType:
                    return emitMappedType(node);
                case ts.SyntaxKind.LiteralType:
                    return emitLiteralType(node);
                case ts.SyntaxKind.ImportType:
                    return emitImportTypeNode(node);
                case ts.SyntaxKind.JSDocAllType:
                    write("*");
                    return;
                case ts.SyntaxKind.JSDocUnknownType:
                    write("?");
                    return;
                case ts.SyntaxKind.JSDocNullableType:
                    return emitJSDocNullableType(node);
                case ts.SyntaxKind.JSDocNonNullableType:
                    return emitJSDocNonNullableType(node);
                case ts.SyntaxKind.JSDocOptionalType:
                    return emitJSDocOptionalType(node);
                case ts.SyntaxKind.JSDocVariadicType:
                    return emitJSDocVariadicType(node);
                // Binding patterns
                case ts.SyntaxKind.ObjectBindingPattern:
                    return emitObjectBindingPattern(node);
                case ts.SyntaxKind.ArrayBindingPattern:
                    return emitArrayBindingPattern(node);
                case ts.SyntaxKind.BindingElement:
                    return emitBindingElement(node);
                // Misc
                case ts.SyntaxKind.TemplateSpan:
                    return emitTemplateSpan(node);
                case ts.SyntaxKind.SemicolonClassElement:
                    return emitSemicolonClassElement();
                // Statements
                case ts.SyntaxKind.Block:
                    return emitBlock(node);
                case ts.SyntaxKind.VariableStatement:
                    return emitVariableStatement(node);
                case ts.SyntaxKind.EmptyStatement:
                    return emitEmptyStatement();
                case ts.SyntaxKind.ExpressionStatement:
                    return emitExpressionStatement(node);
                case ts.SyntaxKind.IfStatement:
                    return emitIfStatement(node);
                case ts.SyntaxKind.DoStatement:
                    return emitDoStatement(node);
                case ts.SyntaxKind.WhileStatement:
                    return emitWhileStatement(node);
                case ts.SyntaxKind.ForStatement:
                    return emitForStatement(node);
                case ts.SyntaxKind.ForInStatement:
                    return emitForInStatement(node);
                case ts.SyntaxKind.ForOfStatement:
                    return emitForOfStatement(node);
                case ts.SyntaxKind.ContinueStatement:
                    return emitContinueStatement(node);
                case ts.SyntaxKind.BreakStatement:
                    return emitBreakStatement(node);
                case ts.SyntaxKind.ReturnStatement:
                    return emitReturnStatement(node);
                case ts.SyntaxKind.WithStatement:
                    return emitWithStatement(node);
                case ts.SyntaxKind.SwitchStatement:
                    return emitSwitchStatement(node);
                case ts.SyntaxKind.LabeledStatement:
                    return emitLabeledStatement(node);
                case ts.SyntaxKind.ThrowStatement:
                    return emitThrowStatement(node);
                case ts.SyntaxKind.TryStatement:
                    return emitTryStatement(node);
                case ts.SyntaxKind.DebuggerStatement:
                    return emitDebuggerStatement(node);
                // Declarations
                case ts.SyntaxKind.VariableDeclaration:
                    return emitVariableDeclaration(node);
                case ts.SyntaxKind.VariableDeclarationList:
                    return emitVariableDeclarationList(node);
                case ts.SyntaxKind.FunctionDeclaration:
                    return emitFunctionDeclaration(node);
                case ts.SyntaxKind.ClassDeclaration:
                    return emitClassDeclaration(node);
                case ts.SyntaxKind.InterfaceDeclaration:
                    return emitInterfaceDeclaration(node);
                case ts.SyntaxKind.TypeAliasDeclaration:
                    return emitTypeAliasDeclaration(node);
                case ts.SyntaxKind.EnumDeclaration:
                    return emitEnumDeclaration(node);
                case ts.SyntaxKind.ModuleDeclaration:
                    return emitModuleDeclaration(node);
                case ts.SyntaxKind.ModuleBlock:
                    return emitModuleBlock(node);
                case ts.SyntaxKind.CaseBlock:
                    return emitCaseBlock(node);
                case ts.SyntaxKind.NamespaceExportDeclaration:
                    return emitNamespaceExportDeclaration(node);
                case ts.SyntaxKind.ImportEqualsDeclaration:
                    return emitImportEqualsDeclaration(node);
                case ts.SyntaxKind.ImportDeclaration:
                    return emitImportDeclaration(node);
                case ts.SyntaxKind.ImportClause:
                    return emitImportClause(node);
                case ts.SyntaxKind.NamespaceImport:
                    return emitNamespaceImport(node);
                case ts.SyntaxKind.NamedImports:
                    return emitNamedImports(node);
                case ts.SyntaxKind.ImportSpecifier:
                    return emitImportSpecifier(node);
                case ts.SyntaxKind.ExportAssignment:
                    return emitExportAssignment(node);
                case ts.SyntaxKind.ExportDeclaration:
                    return emitExportDeclaration(node);
                case ts.SyntaxKind.NamedExports:
                    return emitNamedExports(node);
                case ts.SyntaxKind.ExportSpecifier:
                    return emitExportSpecifier(node);
                case ts.SyntaxKind.MissingDeclaration:
                    return;
                // Module references
                case ts.SyntaxKind.ExternalModuleReference:
                    return emitExternalModuleReference(node);
                // JSX (non-expression)
                case ts.SyntaxKind.JsxText:
                    return emitJsxText(node);
                case ts.SyntaxKind.JsxOpeningElement:
                case ts.SyntaxKind.JsxOpeningFragment:
                    return emitJsxOpeningElementOrFragment(node);
                case ts.SyntaxKind.JsxClosingElement:
                case ts.SyntaxKind.JsxClosingFragment:
                    return emitJsxClosingElementOrFragment(node);
                case ts.SyntaxKind.JsxAttribute:
                    return emitJsxAttribute(node);
                case ts.SyntaxKind.JsxAttributes:
                    return emitJsxAttributes(node);
                case ts.SyntaxKind.JsxSpreadAttribute:
                    return emitJsxSpreadAttribute(node);
                case ts.SyntaxKind.JsxExpression:
                    return emitJsxExpression(node);
                // Clauses
                case ts.SyntaxKind.CaseClause:
                    return emitCaseClause(node);
                case ts.SyntaxKind.DefaultClause:
                    return emitDefaultClause(node);
                case ts.SyntaxKind.HeritageClause:
                    return emitHeritageClause(node);
                case ts.SyntaxKind.CatchClause:
                    return emitCatchClause(node);
                // Property assignments
                case ts.SyntaxKind.PropertyAssignment:
                    return emitPropertyAssignment(node);
                case ts.SyntaxKind.ShorthandPropertyAssignment:
                    return emitShorthandPropertyAssignment(node);
                case ts.SyntaxKind.SpreadAssignment:
                    return emitSpreadAssignment(node);
                // Enum
                case ts.SyntaxKind.EnumMember:
                    return emitEnumMember(node);
                // JSDoc nodes (ignored)
                // Transformation nodes (ignored)
            }
            // If the node is an expression, try to emit it as an expression with
            // substitution.
            if (ts.isExpression(node)) {
                return pipelineEmitExpression(trySubstituteNode(ts.EmitHint.Expression, node));
            }
            if (ts.isToken(node)) {
                writeTokenNode(node, writePunctuation);
                return;
            }
        }
        function pipelineEmitExpression(node) {
            const kind = node.kind;
            switch (kind) {
                // Literals
                case ts.SyntaxKind.NumericLiteral:
                    return emitNumericLiteral(node);
                case ts.SyntaxKind.StringLiteral:
                case ts.SyntaxKind.RegularExpressionLiteral:
                case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
                    return emitLiteral(node);
                // Identifiers
                case ts.SyntaxKind.Identifier:
                    return emitIdentifier(node);
                // Reserved words
                case ts.SyntaxKind.FalseKeyword:
                case ts.SyntaxKind.NullKeyword:
                case ts.SyntaxKind.SuperKeyword:
                case ts.SyntaxKind.TrueKeyword:
                case ts.SyntaxKind.ThisKeyword:
                case ts.SyntaxKind.ImportKeyword:
                    writeTokenNode(node, writeKeyword);
                    return;
                // Expressions
                case ts.SyntaxKind.ArrayLiteralExpression:
                    return emitArrayLiteralExpression(node);
                case ts.SyntaxKind.ObjectLiteralExpression:
                    return emitObjectLiteralExpression(node);
                case ts.SyntaxKind.PropertyAccessExpression:
                    return emitPropertyAccessExpression(node);
                case ts.SyntaxKind.ElementAccessExpression:
                    return emitElementAccessExpression(node);
                case ts.SyntaxKind.CallExpression:
                    return emitCallExpression(node);
                case ts.SyntaxKind.NewExpression:
                    return emitNewExpression(node);
                case ts.SyntaxKind.TaggedTemplateExpression:
                    return emitTaggedTemplateExpression(node);
                case ts.SyntaxKind.TypeAssertionExpression:
                    return emitTypeAssertionExpression(node);
                case ts.SyntaxKind.ParenthesizedExpression:
                    return emitParenthesizedExpression(node);
                case ts.SyntaxKind.FunctionExpression:
                    return emitFunctionExpression(node);
                case ts.SyntaxKind.ArrowFunction:
                    return emitArrowFunction(node);
                case ts.SyntaxKind.DeleteExpression:
                    return emitDeleteExpression(node);
                case ts.SyntaxKind.TypeOfExpression:
                    return emitTypeOfExpression(node);
                case ts.SyntaxKind.VoidExpression:
                    return emitVoidExpression(node);
                case ts.SyntaxKind.AwaitExpression:
                    return emitAwaitExpression(node);
                case ts.SyntaxKind.PrefixUnaryExpression:
                    return emitPrefixUnaryExpression(node);
                case ts.SyntaxKind.PostfixUnaryExpression:
                    return emitPostfixUnaryExpression(node);
                case ts.SyntaxKind.BinaryExpression:
                    return emitBinaryExpression(node);
                case ts.SyntaxKind.ConditionalExpression:
                    return emitConditionalExpression(node);
                case ts.SyntaxKind.TemplateExpression:
                    return emitTemplateExpression(node);
                case ts.SyntaxKind.YieldExpression:
                    return emitYieldExpression(node);
                case ts.SyntaxKind.SpreadElement:
                    return emitSpreadExpression(node);
                case ts.SyntaxKind.ClassExpression:
                    return emitClassExpression(node);
                case ts.SyntaxKind.OmittedExpression:
                    return;
                case ts.SyntaxKind.AsExpression:
                    return emitAsExpression(node);
                case ts.SyntaxKind.NonNullExpression:
                    return emitNonNullExpression(node);
                case ts.SyntaxKind.MetaProperty:
                    return emitMetaProperty(node);
                // JSX
                case ts.SyntaxKind.JsxElement:
                    return emitJsxElement(node);
                case ts.SyntaxKind.JsxSelfClosingElement:
                    return emitJsxSelfClosingElement(node);
                case ts.SyntaxKind.JsxFragment:
                    return emitJsxFragment(node);
                // Transformation nodes
                case ts.SyntaxKind.PartiallyEmittedExpression:
                    return emitPartiallyEmittedExpression(node);
                case ts.SyntaxKind.CommaListExpression:
                    return emitCommaList(node);
            }
        }
        function trySubstituteNode(hint, node) {
            return node && substituteNode && substituteNode(hint, node) || node;
        }
        function emitHelpers(node) {
            let helpersEmitted = false;
            const bundle = node.kind === ts.SyntaxKind.Bundle ? node : undefined;
            if (bundle && moduleKind === ts.ModuleKind.None) {
                return;
            }
            const numNodes = bundle ? bundle.sourceFiles.length : 1;
            for (let i = 0; i < numNodes; i++) {
                const currentNode = bundle ? bundle.sourceFiles[i] : node;
                const sourceFile = ts.isSourceFile(currentNode) ? currentNode : currentSourceFile;
                const shouldSkip = printerOptions.noEmitHelpers || ts.getExternalHelpersModuleName(sourceFile) !== undefined;
                const shouldBundle = ts.isSourceFile(currentNode) && !isOwnFileEmit;
                const helpers = ts.getEmitHelpers(currentNode);
                if (helpers) {
                    for (const helper of ts.stableSort(helpers, ts.compareEmitHelpers)) {
                        if (!helper.scoped) {
                            // Skip the helper if it can be skipped and the noEmitHelpers compiler
                            // option is set, or if it can be imported and the importHelpers compiler
                            // option is set.
                            if (shouldSkip)
                                continue;
                            // Skip the helper if it can be bundled but hasn't already been emitted and we
                            // are emitting a bundled module.
                            if (shouldBundle) {
                                if (bundledHelpers.get(helper.name)) {
                                    continue;
                                }
                                bundledHelpers.set(helper.name, true);
                            }
                        }
                        else if (bundle) {
                            // Skip the helper if it is scoped and we are emitting bundled helpers
                            continue;
                        }
                        if (typeof helper.text === "string") {
                            writeLines(helper.text);
                        }
                        else {
                            writeLines(helper.text(makeFileLevelOptmiisticUniqueName));
                        }
                        helpersEmitted = true;
                    }
                }
            }
            return helpersEmitted;
        }
        //
        // Literals/Pseudo-literals
        //
        // SyntaxKind.NumericLiteral
        function emitNumericLiteral(node) {
            emitLiteral(node);
        }
        // SyntaxKind.StringLiteral
        // SyntaxKind.RegularExpressionLiteral
        // SyntaxKind.NoSubstitutionTemplateLiteral
        // SyntaxKind.TemplateHead
        // SyntaxKind.TemplateMiddle
        // SyntaxKind.TemplateTail
        function emitLiteral(node) {
            const text = getLiteralTextOfNode(node);
            if ((printerOptions.sourceMap || printerOptions.inlineSourceMap)
                && (node.kind === ts.SyntaxKind.StringLiteral || ts.isTemplateLiteralKind(node.kind))) {
                writeLiteral(text);
            }
            else {
                // Quick info expects all literals to be called with writeStringLiteral, as there's no specific type for numberLiterals
                writeStringLiteral(text);
            }
        }
        //
        // Identifiers
        //
        function emitIdentifier(node) {
            const writeText = node.symbol ? writeSymbol : write;
            writeText(getTextOfNode(node, /*includeTrivia*/ false), node.symbol);
            emitList(node, node.typeArguments, ts.ListFormat.TypeParameters); // Call emitList directly since it could be an array of TypeParameterDeclarations _or_ type arguments
        }
        //
        // Names
        //
        function emitQualifiedName(node) {
            emitEntityName(node.left);
            writePunctuation(".");
            emit(node.right);
        }
        function emitEntityName(node) {
            if (node.kind === ts.SyntaxKind.Identifier) {
                emitExpression(node);
            }
            else {
                emit(node);
            }
        }
        function emitComputedPropertyName(node) {
            writePunctuation("[");
            emitExpression(node.expression);
            writePunctuation("]");
        }
        //
        // Signature elements
        //
        function emitTypeParameter(node) {
            emit(node.name);
            if (node.constraint) {
                writeSpace();
                writeKeyword("extends");
                writeSpace();
                emit(node.constraint);
            }
            if (node.default) {
                writeSpace();
                writeOperator("=");
                writeSpace();
                emit(node.default);
            }
        }
        function emitParameter(node) {
            emitDecorators(node, node.decorators);
            emitModifiers(node, node.modifiers);
            emitIfPresent(node.dotDotDotToken);
            if (node.name) {
                emitNodeWithWriter(node.name, writeParameter);
            }
            emitIfPresent(node.questionToken);
            if (node.parent && node.parent.kind === ts.SyntaxKind.JSDocFunctionType && !node.name) {
                emitIfPresent(node.type);
            }
            else {
                emitTypeAnnotation(node.type);
            }
            // The comment position has to fallback to any present node within the parameterdeclaration because as it turns out, the parser can make parameter declarations with _just_ an initializer.
            emitInitializer(node.initializer, node.type ? node.type.end : node.questionToken ? node.questionToken.end : node.name ? node.name.end : node.modifiers ? node.modifiers.end : node.decorators ? node.decorators.end : node.pos, node);
        }
        function emitDecorator(decorator) {
            writePunctuation("@");
            emitExpression(decorator.expression);
        }
        //
        // Type members
        //
        function emitPropertySignature(node) {
            emitDecorators(node, node.decorators);
            emitModifiers(node, node.modifiers);
            emitNodeWithWriter(node.name, writeProperty);
            emitIfPresent(node.questionToken);
            emitTypeAnnotation(node.type);
            writeSemicolon();
        }
        function emitPropertyDeclaration(node) {
            emitDecorators(node, node.decorators);
            emitModifiers(node, node.modifiers);
            emit(node.name);
            emitIfPresent(node.questionToken);
            emitIfPresent(node.exclamationToken);
            emitTypeAnnotation(node.type);
            emitInitializer(node.initializer, node.type ? node.type.end : node.questionToken ? node.questionToken.end : node.name.end, node);
            writeSemicolon();
        }
        function emitMethodSignature(node) {
            emitDecorators(node, node.decorators);
            emitModifiers(node, node.modifiers);
            emit(node.name);
            emitIfPresent(node.questionToken);
            emitTypeParameters(node, node.typeParameters);
            emitParameters(node, node.parameters);
            emitTypeAnnotation(node.type);
            writeSemicolon();
        }
        function emitMethodDeclaration(node) {
            emitDecorators(node, node.decorators);
            emitModifiers(node, node.modifiers);
            emitIfPresent(node.asteriskToken);
            emit(node.name);
            emitIfPresent(node.questionToken);
            emitSignatureAndBody(node, emitSignatureHead);
        }
        function emitConstructor(node) {
            emitModifiers(node, node.modifiers);
            writeKeyword("constructor");
            emitSignatureAndBody(node, emitSignatureHead);
        }
        function emitAccessorDeclaration(node) {
            emitDecorators(node, node.decorators);
            emitModifiers(node, node.modifiers);
            writeKeyword(node.kind === ts.SyntaxKind.GetAccessor ? "get" : "set");
            writeSpace();
            emit(node.name);
            emitSignatureAndBody(node, emitSignatureHead);
        }
        function emitCallSignature(node) {
            emitDecorators(node, node.decorators);
            emitModifiers(node, node.modifiers);
            emitTypeParameters(node, node.typeParameters);
            emitParameters(node, node.parameters);
            emitTypeAnnotation(node.type);
            writeSemicolon();
        }
        function emitConstructSignature(node) {
            emitDecorators(node, node.decorators);
            emitModifiers(node, node.modifiers);
            writeKeyword("new");
            writeSpace();
            emitTypeParameters(node, node.typeParameters);
            emitParameters(node, node.parameters);
            emitTypeAnnotation(node.type);
            writeSemicolon();
        }
        function emitIndexSignature(node) {
            emitDecorators(node, node.decorators);
            emitModifiers(node, node.modifiers);
            emitParametersForIndexSignature(node, node.parameters);
            emitTypeAnnotation(node.type);
            writeSemicolon();
        }
        function emitSemicolonClassElement() {
            writeSemicolon();
        }
        //
        // Types
        //
        function emitTypePredicate(node) {
            emit(node.parameterName);
            writeSpace();
            writeKeyword("is");
            writeSpace();
            emit(node.type);
        }
        function emitTypeReference(node) {
            emit(node.typeName);
            emitTypeArguments(node, node.typeArguments);
        }
        function emitFunctionType(node) {
            emitTypeParameters(node, node.typeParameters);
            emitParametersForArrow(node, node.parameters);
            writeSpace();
            writePunctuation("=>");
            writeSpace();
            emitIfPresent(node.type);
        }
        function emitJSDocFunctionType(node) {
            write("function");
            emitParameters(node, node.parameters);
            write(":");
            emitIfPresent(node.type);
        }
        function emitJSDocNullableType(node) {
            write("?");
            emit(node.type);
        }
        function emitJSDocNonNullableType(node) {
            write("!");
            emit(node.type);
        }
        function emitJSDocOptionalType(node) {
            emit(node.type);
            write("=");
        }
        function emitConstructorType(node) {
            writeKeyword("new");
            writeSpace();
            emitTypeParameters(node, node.typeParameters);
            emitParameters(node, node.parameters);
            writeSpace();
            writePunctuation("=>");
            writeSpace();
            emitIfPresent(node.type);
        }
        function emitTypeQuery(node) {
            writeKeyword("typeof");
            writeSpace();
            emit(node.exprName);
        }
        function emitTypeLiteral(node) {
            writePunctuation("{");
            const flags = ts.getEmitFlags(node) & ts.EmitFlags.SingleLine ? ts.ListFormat.SingleLineTypeLiteralMembers : ts.ListFormat.MultiLineTypeLiteralMembers;
            emitList(node, node.members, flags | ts.ListFormat.NoSpaceIfEmpty);
            writePunctuation("}");
        }
        function emitArrayType(node) {
            emit(node.elementType);
            writePunctuation("[");
            writePunctuation("]");
        }
        function emitJSDocVariadicType(node) {
            write("...");
            emit(node.type);
        }
        function emitTupleType(node) {
            writePunctuation("[");
            emitList(node, node.elementTypes, ts.ListFormat.TupleTypeElements);
            writePunctuation("]");
        }
        function emitUnionType(node) {
            emitList(node, node.types, ts.ListFormat.UnionTypeConstituents);
        }
        function emitIntersectionType(node) {
            emitList(node, node.types, ts.ListFormat.IntersectionTypeConstituents);
        }
        function emitConditionalType(node) {
            emit(node.checkType);
            writeSpace();
            writeKeyword("extends");
            writeSpace();
            emit(node.extendsType);
            writeSpace();
            writePunctuation("?");
            writeSpace();
            emit(node.trueType);
            writeSpace();
            writePunctuation(":");
            writeSpace();
            emit(node.falseType);
        }
        function emitInferType(node) {
            writeKeyword("infer");
            writeSpace();
            emit(node.typeParameter);
        }
        function emitParenthesizedType(node) {
            writePunctuation("(");
            emit(node.type);
            writePunctuation(")");
        }
        function emitThisType() {
            writeKeyword("this");
        }
        function emitTypeOperator(node) {
            writeTokenText(node.operator, writeKeyword);
            writeSpace();
            emit(node.type);
        }
        function emitIndexedAccessType(node) {
            emit(node.objectType);
            writePunctuation("[");
            emit(node.indexType);
            writePunctuation("]");
        }
        function emitMappedType(node) {
            const emitFlags = ts.getEmitFlags(node);
            writePunctuation("{");
            if (emitFlags & ts.EmitFlags.SingleLine) {
                writeSpace();
            }
            else {
                writeLine();
                increaseIndent();
            }
            if (node.readonlyToken) {
                emit(node.readonlyToken);
                if (node.readonlyToken.kind !== ts.SyntaxKind.ReadonlyKeyword) {
                    writeKeyword("readonly");
                }
                writeSpace();
            }
            writePunctuation("[");
            pipelineEmitWithNotification(ts.EmitHint.MappedTypeParameter, node.typeParameter);
            writePunctuation("]");
            if (node.questionToken) {
                emit(node.questionToken);
                if (node.questionToken.kind !== ts.SyntaxKind.QuestionToken) {
                    writePunctuation("?");
                }
            }
            writePunctuation(":");
            writeSpace();
            emitIfPresent(node.type);
            writeSemicolon();
            if (emitFlags & ts.EmitFlags.SingleLine) {
                writeSpace();
            }
            else {
                writeLine();
                decreaseIndent();
            }
            writePunctuation("}");
        }
        function emitLiteralType(node) {
            emitExpression(node.literal);
        }
        function emitImportTypeNode(node) {
            if (node.isTypeOf) {
                writeKeyword("typeof");
                writeSpace();
            }
            writeKeyword("import");
            writePunctuation("(");
            emit(node.argument);
            writePunctuation(")");
            if (node.qualifier) {
                writePunctuation(".");
                emit(node.qualifier);
            }
            emitTypeArguments(node, node.typeArguments);
        }
        //
        // Binding patterns
        //
        function emitObjectBindingPattern(node) {
            writePunctuation("{");
            emitList(node, node.elements, ts.ListFormat.ObjectBindingPatternElements);
            writePunctuation("}");
        }
        function emitArrayBindingPattern(node) {
            writePunctuation("[");
            emitList(node, node.elements, ts.ListFormat.ArrayBindingPatternElements);
            writePunctuation("]");
        }
        function emitBindingElement(node) {
            emitIfPresent(node.dotDotDotToken);
            if (node.propertyName) {
                emit(node.propertyName);
                writePunctuation(":");
                writeSpace();
            }
            emit(node.name);
            emitInitializer(node.initializer, node.name.end, node);
        }
        //
        // Expressions
        //
        function emitArrayLiteralExpression(node) {
            const elements = node.elements;
            const preferNewLine = node.multiLine ? ts.ListFormat.PreferNewLine : ts.ListFormat.None;
            emitExpressionList(node, elements, ts.ListFormat.ArrayLiteralExpressionElements | preferNewLine);
        }
        function emitObjectLiteralExpression(node) {
            const indentedFlag = ts.getEmitFlags(node) & ts.EmitFlags.Indented;
            if (indentedFlag) {
                increaseIndent();
            }
            const preferNewLine = node.multiLine ? ts.ListFormat.PreferNewLine : ts.ListFormat.None;
            const allowTrailingComma = currentSourceFile.languageVersion >= ts.ScriptTarget.ES5 ? ts.ListFormat.AllowTrailingComma : ts.ListFormat.None;
            emitList(node, node.properties, ts.ListFormat.ObjectLiteralExpressionProperties | allowTrailingComma | preferNewLine);
            if (indentedFlag) {
                decreaseIndent();
            }
        }
        function emitPropertyAccessExpression(node) {
            let indentBeforeDot = false;
            let indentAfterDot = false;
            if (!(ts.getEmitFlags(node) & ts.EmitFlags.NoIndentation)) {
                const dotRangeStart = node.expression.end;
                const dotRangeEnd = ts.skipTrivia(currentSourceFile.text, node.expression.end) + 1;
                const dotToken = ts.createToken(ts.SyntaxKind.DotToken);
                dotToken.pos = dotRangeStart;
                dotToken.end = dotRangeEnd;
                indentBeforeDot = needsIndentation(node, node.expression, dotToken);
                indentAfterDot = needsIndentation(node, dotToken, node.name);
            }
            emitExpression(node.expression);
            increaseIndentIf(indentBeforeDot);
            const shouldEmitDotDot = !indentBeforeDot && needsDotDotForPropertyAccess(node.expression);
            if (shouldEmitDotDot) {
                writePunctuation(".");
            }
            emitTokenWithComment(ts.SyntaxKind.DotToken, node.expression.end, writePunctuation, node);
            increaseIndentIf(indentAfterDot);
            emit(node.name);
            decreaseIndentIf(indentBeforeDot, indentAfterDot);
        }
        // 1..toString is a valid property access, emit a dot after the literal
        // Also emit a dot if expression is a integer const enum value - it will appear in generated code as numeric literal
        function needsDotDotForPropertyAccess(expression) {
            expression = ts.skipPartiallyEmittedExpressions(expression);
            if (ts.isNumericLiteral(expression)) {
                // check if numeric literal is a decimal literal that was originally written with a dot
                const text = getLiteralTextOfNode(expression);
                return !expression.numericLiteralFlags
                    && !ts.stringContains(text, ts.tokenToString(ts.SyntaxKind.DotToken));
            }
            else if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
                // check if constant enum value is integer
                const constantValue = ts.getConstantValue(expression);
                // isFinite handles cases when constantValue is undefined
                return typeof constantValue === "number" && isFinite(constantValue)
                    && Math.floor(constantValue) === constantValue
                    && printerOptions.removeComments;
            }
        }
        function emitElementAccessExpression(node) {
            emitExpression(node.expression);
            const openPos = emitTokenWithComment(ts.SyntaxKind.OpenBracketToken, node.expression.end, writePunctuation, node);
            emitExpression(node.argumentExpression);
            emitTokenWithComment(ts.SyntaxKind.CloseBracketToken, node.argumentExpression ? node.argumentExpression.end : openPos, writePunctuation, node);
        }
        function emitCallExpression(node) {
            emitExpression(node.expression);
            emitTypeArguments(node, node.typeArguments);
            emitExpressionList(node, node.arguments, ts.ListFormat.CallExpressionArguments);
        }
        function emitNewExpression(node) {
            emitTokenWithComment(ts.SyntaxKind.NewKeyword, node.pos, writeKeyword, node);
            writeSpace();
            emitExpression(node.expression);
            emitTypeArguments(node, node.typeArguments);
            emitExpressionList(node, node.arguments, ts.ListFormat.NewExpressionArguments);
        }
        function emitTaggedTemplateExpression(node) {
            emitExpression(node.tag);
            emitTypeArguments(node, node.typeArguments);
            writeSpace();
            emitExpression(node.template);
        }
        function emitTypeAssertionExpression(node) {
            writePunctuation("<");
            emit(node.type);
            writePunctuation(">");
            emitExpression(node.expression);
        }
        function emitParenthesizedExpression(node) {
            const openParenPos = emitTokenWithComment(ts.SyntaxKind.OpenParenToken, node.pos, writePunctuation, node);
            emitExpression(node.expression);
            emitTokenWithComment(ts.SyntaxKind.CloseParenToken, node.expression ? node.expression.end : openParenPos, writePunctuation, node);
        }
        function emitFunctionExpression(node) {
            emitFunctionDeclarationOrExpression(node);
        }
        function emitArrowFunction(node) {
            emitDecorators(node, node.decorators);
            emitModifiers(node, node.modifiers);
            emitSignatureAndBody(node, emitArrowFunctionHead);
        }
        function emitArrowFunctionHead(node) {
            emitTypeParameters(node, node.typeParameters);
            emitParametersForArrow(node, node.parameters);
            emitTypeAnnotation(node.type);
            writeSpace();
            emit(node.equalsGreaterThanToken);
        }
        function emitDeleteExpression(node) {
            emitTokenWithComment(ts.SyntaxKind.DeleteKeyword, node.pos, writeKeyword, node);
            writeSpace();
            emitExpression(node.expression);
        }
        function emitTypeOfExpression(node) {
            emitTokenWithComment(ts.SyntaxKind.TypeOfKeyword, node.pos, writeKeyword, node);
            writeSpace();
            emitExpression(node.expression);
        }
        function emitVoidExpression(node) {
            emitTokenWithComment(ts.SyntaxKind.VoidKeyword, node.pos, writeKeyword, node);
            writeSpace();
            emitExpression(node.expression);
        }
        function emitAwaitExpression(node) {
            emitTokenWithComment(ts.SyntaxKind.AwaitKeyword, node.pos, writeKeyword, node);
            writeSpace();
            emitExpression(node.expression);
        }
        function emitPrefixUnaryExpression(node) {
            writeTokenText(node.operator, writeOperator);
            if (shouldEmitWhitespaceBeforeOperand(node)) {
                writeSpace();
            }
            emitExpression(node.operand);
        }
        function shouldEmitWhitespaceBeforeOperand(node) {
            // In some cases, we need to emit a space between the operator and the operand. One obvious case
            // is when the operator is an identifier, like delete or typeof. We also need to do this for plus
            // and minus expressions in certain cases. Specifically, consider the following two cases (parens
            // are just for clarity of exposition, and not part of the source code):
            //
            //  (+(+1))
            //  (+(++1))
            //
            // We need to emit a space in both cases. In the first case, the absence of a space will make
            // the resulting expression a prefix increment operation. And in the second, it will make the resulting
            // expression a prefix increment whose operand is a plus expression - (++(+x))
            // The same is true of minus of course.
            const operand = node.operand;
            return operand.kind === ts.SyntaxKind.PrefixUnaryExpression
                && ((node.operator === ts.SyntaxKind.PlusToken && (operand.operator === ts.SyntaxKind.PlusToken || operand.operator === ts.SyntaxKind.PlusPlusToken))
                    || (node.operator === ts.SyntaxKind.MinusToken && (operand.operator === ts.SyntaxKind.MinusToken || operand.operator === ts.SyntaxKind.MinusMinusToken)));
        }
        function emitPostfixUnaryExpression(node) {
            emitExpression(node.operand);
            writeTokenText(node.operator, writeOperator);
        }
        function emitBinaryExpression(node) {
            const isCommaOperator = node.operatorToken.kind !== ts.SyntaxKind.CommaToken;
            const indentBeforeOperator = needsIndentation(node, node.left, node.operatorToken);
            const indentAfterOperator = needsIndentation(node, node.operatorToken, node.right);
            emitExpression(node.left);
            increaseIndentIf(indentBeforeOperator, isCommaOperator ? " " : undefined);
            emitLeadingCommentsOfPosition(node.operatorToken.pos);
            writeTokenNode(node.operatorToken, writeOperator);
            emitTrailingCommentsOfPosition(node.operatorToken.end, /*prefixSpace*/ true); // Binary operators should have a space before the comment starts
            increaseIndentIf(indentAfterOperator, " ");
            emitExpression(node.right);
            decreaseIndentIf(indentBeforeOperator, indentAfterOperator);
        }
        function emitConditionalExpression(node) {
            const indentBeforeQuestion = needsIndentation(node, node.condition, node.questionToken);
            const indentAfterQuestion = needsIndentation(node, node.questionToken, node.whenTrue);
            const indentBeforeColon = needsIndentation(node, node.whenTrue, node.colonToken);
            const indentAfterColon = needsIndentation(node, node.colonToken, node.whenFalse);
            emitExpression(node.condition);
            increaseIndentIf(indentBeforeQuestion, " ");
            emit(node.questionToken);
            increaseIndentIf(indentAfterQuestion, " ");
            emitExpression(node.whenTrue);
            decreaseIndentIf(indentBeforeQuestion, indentAfterQuestion);
            increaseIndentIf(indentBeforeColon, " ");
            emit(node.colonToken);
            increaseIndentIf(indentAfterColon, " ");
            emitExpression(node.whenFalse);
            decreaseIndentIf(indentBeforeColon, indentAfterColon);
        }
        function emitTemplateExpression(node) {
            emit(node.head);
            emitList(node, node.templateSpans, ts.ListFormat.TemplateExpressionSpans);
        }
        function emitYieldExpression(node) {
            emitTokenWithComment(ts.SyntaxKind.YieldKeyword, node.pos, writeKeyword, node);
            emitIfPresent(node.asteriskToken);
            emitExpressionWithLeadingSpace(node.expression);
        }
        function emitSpreadExpression(node) {
            writePunctuation("...");
            emitExpression(node.expression);
        }
        function emitClassExpression(node) {
            emitClassDeclarationOrExpression(node);
        }
        function emitExpressionWithTypeArguments(node) {
            emitExpression(node.expression);
            emitTypeArguments(node, node.typeArguments);
        }
        function emitAsExpression(node) {
            emitExpression(node.expression);
            if (node.type) {
                writeSpace();
                writeKeyword("as");
                writeSpace();
                emit(node.type);
            }
        }
        function emitNonNullExpression(node) {
            emitExpression(node.expression);
            writeOperator("!");
        }
        function emitMetaProperty(node) {
            writeToken(node.keywordToken, node.pos, writePunctuation);
            writePunctuation(".");
            emit(node.name);
        }
        //
        // Misc
        //
        function emitTemplateSpan(node) {
            emitExpression(node.expression);
            emit(node.literal);
        }
        //
        // Statements
        //
        function emitBlock(node) {
            emitBlockStatements(node, /*forceSingleLine*/ !node.multiLine && isEmptyBlock(node));
        }
        function emitBlockStatements(node, forceSingleLine) {
            emitTokenWithComment(ts.SyntaxKind.OpenBraceToken, node.pos, writePunctuation, /*contextNode*/ node);
            const format = forceSingleLine || ts.getEmitFlags(node) & ts.EmitFlags.SingleLine ? ts.ListFormat.SingleLineBlockStatements : ts.ListFormat.MultiLineBlockStatements;
            emitList(node, node.statements, format);
            emitTokenWithComment(ts.SyntaxKind.CloseBraceToken, node.statements.end, writePunctuation, /*contextNode*/ node, /*indentLeading*/ !!(format & ts.ListFormat.MultiLine));
        }
        function emitVariableStatement(node) {
            emitModifiers(node, node.modifiers);
            emit(node.declarationList);
            writeSemicolon();
        }
        function emitEmptyStatement() {
            writeSemicolon();
        }
        function emitExpressionStatement(node) {
            emitExpression(node.expression);
            writeSemicolon();
        }
        function emitIfStatement(node) {
            const openParenPos = emitTokenWithComment(ts.SyntaxKind.IfKeyword, node.pos, writeKeyword, node);
            writeSpace();
            emitTokenWithComment(ts.SyntaxKind.OpenParenToken, openParenPos, writePunctuation, node);
            emitExpression(node.expression);
            emitTokenWithComment(ts.SyntaxKind.CloseParenToken, node.expression.end, writePunctuation, node);
            emitEmbeddedStatement(node, node.thenStatement);
            if (node.elseStatement) {
                writeLineOrSpace(node);
                emitTokenWithComment(ts.SyntaxKind.ElseKeyword, node.thenStatement.end, writeKeyword, node);
                if (node.elseStatement.kind === ts.SyntaxKind.IfStatement) {
                    writeSpace();
                    emit(node.elseStatement);
                }
                else {
                    emitEmbeddedStatement(node, node.elseStatement);
                }
            }
        }
        function emitWhileClause(node, startPos) {
            const openParenPos = emitTokenWithComment(ts.SyntaxKind.WhileKeyword, startPos, writeKeyword, node);
            writeSpace();
            emitTokenWithComment(ts.SyntaxKind.OpenParenToken, openParenPos, writePunctuation, node);
            emitExpression(node.expression);
            emitTokenWithComment(ts.SyntaxKind.CloseParenToken, node.expression.end, writePunctuation, node);
        }
        function emitDoStatement(node) {
            emitTokenWithComment(ts.SyntaxKind.DoKeyword, node.pos, writeKeyword, node);
            emitEmbeddedStatement(node, node.statement);
            if (ts.isBlock(node.statement)) {
                writeSpace();
            }
            else {
                writeLineOrSpace(node);
            }
            emitWhileClause(node, node.statement.end);
            writePunctuation(";");
        }
        function emitWhileStatement(node) {
            emitWhileClause(node, node.pos);
            emitEmbeddedStatement(node, node.statement);
        }
        function emitForStatement(node) {
            const openParenPos = emitTokenWithComment(ts.SyntaxKind.ForKeyword, node.pos, writeKeyword, node);
            writeSpace();
            let pos = emitTokenWithComment(ts.SyntaxKind.OpenParenToken, openParenPos, writePunctuation, /*contextNode*/ node);
            emitForBinding(node.initializer);
            pos = emitTokenWithComment(ts.SyntaxKind.SemicolonToken, node.initializer ? node.initializer.end : pos, writeSemicolon, node);
            emitExpressionWithLeadingSpace(node.condition);
            pos = emitTokenWithComment(ts.SyntaxKind.SemicolonToken, node.condition ? node.condition.end : pos, writeSemicolon, node);
            emitExpressionWithLeadingSpace(node.incrementor);
            emitTokenWithComment(ts.SyntaxKind.CloseParenToken, node.incrementor ? node.incrementor.end : pos, writePunctuation, node);
            emitEmbeddedStatement(node, node.statement);
        }
        function emitForInStatement(node) {
            const openParenPos = emitTokenWithComment(ts.SyntaxKind.ForKeyword, node.pos, writeKeyword, node);
            writeSpace();
            emitTokenWithComment(ts.SyntaxKind.OpenParenToken, openParenPos, writePunctuation, node);
            emitForBinding(node.initializer);
            writeSpace();
            emitTokenWithComment(ts.SyntaxKind.InKeyword, node.initializer.end, writeKeyword, node);
            writeSpace();
            emitExpression(node.expression);
            emitTokenWithComment(ts.SyntaxKind.CloseParenToken, node.expression.end, writePunctuation, node);
            emitEmbeddedStatement(node, node.statement);
        }
        function emitForOfStatement(node) {
            const openParenPos = emitTokenWithComment(ts.SyntaxKind.ForKeyword, node.pos, writeKeyword, node);
            writeSpace();
            emitWithTrailingSpace(node.awaitModifier);
            emitTokenWithComment(ts.SyntaxKind.OpenParenToken, openParenPos, writePunctuation, node);
            emitForBinding(node.initializer);
            writeSpace();
            emitTokenWithComment(ts.SyntaxKind.OfKeyword, node.initializer.end, writeKeyword, node);
            writeSpace();
            emitExpression(node.expression);
            emitTokenWithComment(ts.SyntaxKind.CloseParenToken, node.expression.end, writePunctuation, node);
            emitEmbeddedStatement(node, node.statement);
        }
        function emitForBinding(node) {
            if (node !== undefined) {
                if (node.kind === ts.SyntaxKind.VariableDeclarationList) {
                    emit(node);
                }
                else {
                    emitExpression(node);
                }
            }
        }
        function emitContinueStatement(node) {
            emitTokenWithComment(ts.SyntaxKind.ContinueKeyword, node.pos, writeKeyword, node);
            emitWithLeadingSpace(node.label);
            writeSemicolon();
        }
        function emitBreakStatement(node) {
            emitTokenWithComment(ts.SyntaxKind.BreakKeyword, node.pos, writeKeyword, node);
            emitWithLeadingSpace(node.label);
            writeSemicolon();
        }
        function emitTokenWithComment(token, pos, writer, contextNode, indentLeading) {
            const node = ts.getParseTreeNode(contextNode);
            const isSimilarNode = node && node.kind === contextNode.kind;
            const startPos = pos;
            if (isSimilarNode) {
                pos = ts.skipTrivia(currentSourceFile.text, pos);
            }
            if (emitLeadingCommentsOfPosition && isSimilarNode && contextNode.pos !== startPos) {
                const needsIndent = indentLeading && !ts.positionsAreOnSameLine(startPos, pos, currentSourceFile);
                if (needsIndent) {
                    increaseIndent();
                }
                emitLeadingCommentsOfPosition(startPos);
                if (needsIndent) {
                    decreaseIndent();
                }
            }
            pos = writeTokenText(token, writer, pos);
            if (emitTrailingCommentsOfPosition && isSimilarNode && contextNode.end !== pos) {
                emitTrailingCommentsOfPosition(pos, /*prefixSpace*/ true);
            }
            return pos;
        }
        function emitReturnStatement(node) {
            emitTokenWithComment(ts.SyntaxKind.ReturnKeyword, node.pos, writeKeyword, /*contextNode*/ node);
            emitExpressionWithLeadingSpace(node.expression);
            writeSemicolon();
        }
        function emitWithStatement(node) {
            const openParenPos = emitTokenWithComment(ts.SyntaxKind.WithKeyword, node.pos, writeKeyword, node);
            writeSpace();
            emitTokenWithComment(ts.SyntaxKind.OpenParenToken, openParenPos, writePunctuation, node);
            emitExpression(node.expression);
            emitTokenWithComment(ts.SyntaxKind.CloseParenToken, node.expression.end, writePunctuation, node);
            emitEmbeddedStatement(node, node.statement);
        }
        function emitSwitchStatement(node) {
            const openParenPos = emitTokenWithComment(ts.SyntaxKind.SwitchKeyword, node.pos, writeKeyword, node);
            writeSpace();
            emitTokenWithComment(ts.SyntaxKind.OpenParenToken, openParenPos, writePunctuation, node);
            emitExpression(node.expression);
            emitTokenWithComment(ts.SyntaxKind.CloseParenToken, node.expression.end, writePunctuation, node);
            writeSpace();
            emit(node.caseBlock);
        }
        function emitLabeledStatement(node) {
            emit(node.label);
            emitTokenWithComment(ts.SyntaxKind.ColonToken, node.label.end, writePunctuation, node);
            writeSpace();
            emit(node.statement);
        }
        function emitThrowStatement(node) {
            emitTokenWithComment(ts.SyntaxKind.ThrowKeyword, node.pos, writeKeyword, node);
            emitExpressionWithLeadingSpace(node.expression);
            writeSemicolon();
        }
        function emitTryStatement(node) {
            emitTokenWithComment(ts.SyntaxKind.TryKeyword, node.pos, writeKeyword, node);
            writeSpace();
            emit(node.tryBlock);
            if (node.catchClause) {
                writeLineOrSpace(node);
                emit(node.catchClause);
            }
            if (node.finallyBlock) {
                writeLineOrSpace(node);
                emitTokenWithComment(ts.SyntaxKind.FinallyKeyword, (node.catchClause || node.tryBlock).end, writeKeyword, node);
                writeSpace();
                emit(node.finallyBlock);
            }
        }
        function emitDebuggerStatement(node) {
            writeToken(ts.SyntaxKind.DebuggerKeyword, node.pos, writeKeyword);
            writeSemicolon();
        }
        //
        // Declarations
        //
        function emitVariableDeclaration(node) {
            emit(node.name);
            emitTypeAnnotation(node.type);
            emitInitializer(node.initializer, node.type ? node.type.end : node.name.end, node);
        }
        function emitVariableDeclarationList(node) {
            writeKeyword(ts.isLet(node) ? "let" : ts.isConst(node) ? "const" : "var");
            writeSpace();
            emitList(node, node.declarations, ts.ListFormat.VariableDeclarationList);
        }
        function emitFunctionDeclaration(node) {
            emitFunctionDeclarationOrExpression(node);
        }
        function emitFunctionDeclarationOrExpression(node) {
            emitDecorators(node, node.decorators);
            emitModifiers(node, node.modifiers);
            writeKeyword("function");
            emitIfPresent(node.asteriskToken);
            writeSpace();
            emitIdentifierName(node.name);
            emitSignatureAndBody(node, emitSignatureHead);
        }
        function emitBlockCallback(_hint, body) {
            emitBlockFunctionBody(body);
        }
        function emitSignatureAndBody(node, emitSignatureHead) {
            const body = node.body;
            if (body) {
                if (ts.isBlock(body)) {
                    const indentedFlag = ts.getEmitFlags(node) & ts.EmitFlags.Indented;
                    if (indentedFlag) {
                        increaseIndent();
                    }
                    pushNameGenerationScope(node);
                    emitSignatureHead(node);
                    if (onEmitNode) {
                        onEmitNode(ts.EmitHint.Unspecified, body, emitBlockCallback);
                    }
                    else {
                        emitBlockFunctionBody(body);
                    }
                    popNameGenerationScope(node);
                    if (indentedFlag) {
                        decreaseIndent();
                    }
                }
                else {
                    emitSignatureHead(node);
                    writeSpace();
                    emitExpression(body);
                }
            }
            else {
                emitSignatureHead(node);
                writeSemicolon();
            }
        }
        function emitSignatureHead(node) {
            emitTypeParameters(node, node.typeParameters);
            emitParameters(node, node.parameters);
            emitTypeAnnotation(node.type);
        }
        function shouldEmitBlockFunctionBodyOnSingleLine(body) {
            // We must emit a function body as a single-line body in the following case:
            // * The body has NodeEmitFlags.SingleLine specified.
            // We must emit a function body as a multi-line body in the following cases:
            // * The body is explicitly marked as multi-line.
            // * A non-synthesized body's start and end position are on different lines.
            // * Any statement in the body starts on a new line.
            if (ts.getEmitFlags(body) & ts.EmitFlags.SingleLine) {
                return true;
            }
            if (body.multiLine) {
                return false;
            }
            if (!ts.nodeIsSynthesized(body) && !ts.rangeIsOnSingleLine(body, currentSourceFile)) {
                return false;
            }
            if (shouldWriteLeadingLineTerminator(body, body.statements, ts.ListFormat.PreserveLines)
                || shouldWriteClosingLineTerminator(body, body.statements, ts.ListFormat.PreserveLines)) {
                return false;
            }
            let previousStatement;
            for (const statement of body.statements) {
                if (shouldWriteSeparatingLineTerminator(previousStatement, statement, ts.ListFormat.PreserveLines)) {
                    return false;
                }
                previousStatement = statement;
            }
            return true;
        }
        function emitBlockFunctionBody(body) {
            writeSpace();
            writePunctuation("{");
            increaseIndent();
            const emitBlockFunctionBody = shouldEmitBlockFunctionBodyOnSingleLine(body)
                ? emitBlockFunctionBodyOnSingleLine
                : emitBlockFunctionBodyWorker;
            if (emitBodyWithDetachedComments) {
                emitBodyWithDetachedComments(body, body.statements, emitBlockFunctionBody);
            }
            else {
                emitBlockFunctionBody(body);
            }
            decreaseIndent();
            writeToken(ts.SyntaxKind.CloseBraceToken, body.statements.end, writePunctuation, body);
        }
        function emitBlockFunctionBodyOnSingleLine(body) {
            emitBlockFunctionBodyWorker(body, /*emitBlockFunctionBodyOnSingleLine*/ true);
        }
        function emitBlockFunctionBodyWorker(body, emitBlockFunctionBodyOnSingleLine) {
            // Emit all the prologue directives (like "use strict").
            const statementOffset = emitPrologueDirectives(body.statements, /*startWithNewLine*/ true);
            const pos = writer.getTextPos();
            emitHelpers(body);
            if (statementOffset === 0 && pos === writer.getTextPos() && emitBlockFunctionBodyOnSingleLine) {
                decreaseIndent();
                emitList(body, body.statements, ts.ListFormat.SingleLineFunctionBodyStatements);
                increaseIndent();
            }
            else {
                emitList(body, body.statements, ts.ListFormat.MultiLineFunctionBodyStatements, statementOffset);
            }
        }
        function emitClassDeclaration(node) {
            emitClassDeclarationOrExpression(node);
        }
        function emitClassDeclarationOrExpression(node) {
            emitDecorators(node, node.decorators);
            emitModifiers(node, node.modifiers);
            writeKeyword("class");
            if (node.name) {
                writeSpace();
                emitIdentifierName(node.name);
            }
            const indentedFlag = ts.getEmitFlags(node) & ts.EmitFlags.Indented;
            if (indentedFlag) {
                increaseIndent();
            }
            emitTypeParameters(node, node.typeParameters);
            emitList(node, node.heritageClauses, ts.ListFormat.ClassHeritageClauses);
            writeSpace();
            writePunctuation("{");
            emitList(node, node.members, ts.ListFormat.ClassMembers);
            writePunctuation("}");
            if (indentedFlag) {
                decreaseIndent();
            }
        }
        function emitInterfaceDeclaration(node) {
            emitDecorators(node, node.decorators);
            emitModifiers(node, node.modifiers);
            writeKeyword("interface");
            writeSpace();
            emit(node.name);
            emitTypeParameters(node, node.typeParameters);
            emitList(node, node.heritageClauses, ts.ListFormat.HeritageClauses);
            writeSpace();
            writePunctuation("{");
            emitList(node, node.members, ts.ListFormat.InterfaceMembers);
            writePunctuation("}");
        }
        function emitTypeAliasDeclaration(node) {
            emitDecorators(node, node.decorators);
            emitModifiers(node, node.modifiers);
            writeKeyword("type");
            writeSpace();
            emit(node.name);
            emitTypeParameters(node, node.typeParameters);
            writeSpace();
            writePunctuation("=");
            writeSpace();
            emit(node.type);
            writeSemicolon();
        }
        function emitEnumDeclaration(node) {
            emitModifiers(node, node.modifiers);
            writeKeyword("enum");
            writeSpace();
            emit(node.name);
            writeSpace();
            writePunctuation("{");
            emitList(node, node.members, ts.ListFormat.EnumMembers);
            writePunctuation("}");
        }
        function emitModuleDeclaration(node) {
            emitModifiers(node, node.modifiers);
            if (~node.flags & ts.NodeFlags.GlobalAugmentation) {
                writeKeyword(node.flags & ts.NodeFlags.Namespace ? "namespace" : "module");
                writeSpace();
            }
            emit(node.name);
            let body = node.body;
            if (!body)
                return writeSemicolon();
            while (body.kind === ts.SyntaxKind.ModuleDeclaration) {
                writePunctuation(".");
                emit(body.name);
                body = body.body;
            }
            writeSpace();
            emit(body);
        }
        function emitModuleBlock(node) {
            pushNameGenerationScope(node);
            emitBlockStatements(node, /*forceSingleLine*/ isEmptyBlock(node));
            popNameGenerationScope(node);
        }
        function emitCaseBlock(node) {
            emitTokenWithComment(ts.SyntaxKind.OpenBraceToken, node.pos, writePunctuation, node);
            emitList(node, node.clauses, ts.ListFormat.CaseBlockClauses);
            emitTokenWithComment(ts.SyntaxKind.CloseBraceToken, node.clauses.end, writePunctuation, node, /*indentLeading*/ true);
        }
        function emitImportEqualsDeclaration(node) {
            emitModifiers(node, node.modifiers);
            emitTokenWithComment(ts.SyntaxKind.ImportKeyword, node.modifiers ? node.modifiers.end : node.pos, writeKeyword, node);
            writeSpace();
            emit(node.name);
            writeSpace();
            emitTokenWithComment(ts.SyntaxKind.EqualsToken, node.name.end, writePunctuation, node);
            writeSpace();
            emitModuleReference(node.moduleReference);
            writeSemicolon();
        }
        function emitModuleReference(node) {
            if (node.kind === ts.SyntaxKind.Identifier) {
                emitExpression(node);
            }
            else {
                emit(node);
            }
        }
        function emitImportDeclaration(node) {
            emitModifiers(node, node.modifiers);
            emitTokenWithComment(ts.SyntaxKind.ImportKeyword, node.modifiers ? node.modifiers.end : node.pos, writeKeyword, node);
            writeSpace();
            if (node.importClause) {
                emit(node.importClause);
                writeSpace();
                emitTokenWithComment(ts.SyntaxKind.FromKeyword, node.importClause.end, writeKeyword, node);
                writeSpace();
            }
            emitExpression(node.moduleSpecifier);
            writeSemicolon();
        }
        function emitImportClause(node) {
            emitIfPresent(node.name);
            if (node.name && node.namedBindings) {
                emitTokenWithComment(ts.SyntaxKind.CommaToken, node.name.end, writePunctuation, node);
                writeSpace();
            }
            emitIfPresent(node.namedBindings);
        }
        function emitNamespaceImport(node) {
            const asPos = emitTokenWithComment(ts.SyntaxKind.AsteriskToken, node.pos, writePunctuation, node);
            writeSpace();
            emitTokenWithComment(ts.SyntaxKind.AsKeyword, asPos, writeKeyword, node);
            writeSpace();
            emit(node.name);
        }
        function emitNamedImports(node) {
            emitNamedImportsOrExports(node);
        }
        function emitImportSpecifier(node) {
            emitImportOrExportSpecifier(node);
        }
        function emitExportAssignment(node) {
            const nextPos = emitTokenWithComment(ts.SyntaxKind.ExportKeyword, node.pos, writeKeyword, node);
            writeSpace();
            if (node.isExportEquals) {
                emitTokenWithComment(ts.SyntaxKind.EqualsToken, nextPos, writeOperator, node);
            }
            else {
                emitTokenWithComment(ts.SyntaxKind.DefaultKeyword, nextPos, writeKeyword, node);
            }
            writeSpace();
            emitExpression(node.expression);
            writeSemicolon();
        }
        function emitExportDeclaration(node) {
            let nextPos = emitTokenWithComment(ts.SyntaxKind.ExportKeyword, node.pos, writeKeyword, node);
            writeSpace();
            if (node.exportClause) {
                emit(node.exportClause);
            }
            else {
                nextPos = emitTokenWithComment(ts.SyntaxKind.AsteriskToken, nextPos, writePunctuation, node);
            }
            if (node.moduleSpecifier) {
                writeSpace();
                const fromPos = node.exportClause ? node.exportClause.end : nextPos;
                emitTokenWithComment(ts.SyntaxKind.FromKeyword, fromPos, writeKeyword, node);
                writeSpace();
                emitExpression(node.moduleSpecifier);
            }
            writeSemicolon();
        }
        function emitNamespaceExportDeclaration(node) {
            let nextPos = emitTokenWithComment(ts.SyntaxKind.ExportKeyword, node.pos, writeKeyword, node);
            writeSpace();
            nextPos = emitTokenWithComment(ts.SyntaxKind.AsKeyword, nextPos, writeKeyword, node);
            writeSpace();
            nextPos = emitTokenWithComment(ts.SyntaxKind.NamespaceKeyword, nextPos, writeKeyword, node);
            writeSpace();
            emit(node.name);
            writeSemicolon();
        }
        function emitNamedExports(node) {
            emitNamedImportsOrExports(node);
        }
        function emitExportSpecifier(node) {
            emitImportOrExportSpecifier(node);
        }
        function emitNamedImportsOrExports(node) {
            writePunctuation("{");
            emitList(node, node.elements, ts.ListFormat.NamedImportsOrExportsElements);
            writePunctuation("}");
        }
        function emitImportOrExportSpecifier(node) {
            if (node.propertyName) {
                emit(node.propertyName);
                writeSpace();
                emitTokenWithComment(ts.SyntaxKind.AsKeyword, node.propertyName.end, writeKeyword, node);
                writeSpace();
            }
            emit(node.name);
        }
        //
        // Module references
        //
        function emitExternalModuleReference(node) {
            writeKeyword("require");
            writePunctuation("(");
            emitExpression(node.expression);
            writePunctuation(")");
        }
        //
        // JSX
        //
        function emitJsxElement(node) {
            emit(node.openingElement);
            emitList(node, node.children, ts.ListFormat.JsxElementOrFragmentChildren);
            emit(node.closingElement);
        }
        function emitJsxSelfClosingElement(node) {
            writePunctuation("<");
            emitJsxTagName(node.tagName);
            writeSpace();
            emit(node.attributes);
            writePunctuation("/>");
        }
        function emitJsxFragment(node) {
            emit(node.openingFragment);
            emitList(node, node.children, ts.ListFormat.JsxElementOrFragmentChildren);
            emit(node.closingFragment);
        }
        function emitJsxOpeningElementOrFragment(node) {
            writePunctuation("<");
            if (ts.isJsxOpeningElement(node)) {
                emitJsxTagName(node.tagName);
                if (node.attributes.properties && node.attributes.properties.length > 0) {
                    writeSpace();
                }
                emit(node.attributes);
            }
            writePunctuation(">");
        }
        function emitJsxText(node) {
            commitPendingSemicolon();
            writer.writeLiteral(getTextOfNode(node, /*includeTrivia*/ true));
        }
        function emitJsxClosingElementOrFragment(node) {
            writePunctuation("</");
            if (ts.isJsxClosingElement(node)) {
                emitJsxTagName(node.tagName);
            }
            writePunctuation(">");
        }
        function emitJsxAttributes(node) {
            emitList(node, node.properties, ts.ListFormat.JsxElementAttributes);
        }
        function emitJsxAttribute(node) {
            emit(node.name);
            emitNodeWithPrefix("=", writePunctuation, node.initializer, emit);
        }
        function emitJsxSpreadAttribute(node) {
            writePunctuation("{...");
            emitExpression(node.expression);
            writePunctuation("}");
        }
        function emitJsxExpression(node) {
            if (node.expression) {
                writePunctuation("{");
                emitIfPresent(node.dotDotDotToken);
                emitExpression(node.expression);
                writePunctuation("}");
            }
        }
        function emitJsxTagName(node) {
            if (node.kind === ts.SyntaxKind.Identifier) {
                emitExpression(node);
            }
            else {
                emit(node);
            }
        }
        //
        // Clauses
        //
        function emitCaseClause(node) {
            emitTokenWithComment(ts.SyntaxKind.CaseKeyword, node.pos, writeKeyword, node);
            writeSpace();
            emitExpression(node.expression);
            emitCaseOrDefaultClauseRest(node, node.statements, node.expression.end);
        }
        function emitDefaultClause(node) {
            const pos = emitTokenWithComment(ts.SyntaxKind.DefaultKeyword, node.pos, writeKeyword, node);
            emitCaseOrDefaultClauseRest(node, node.statements, pos);
        }
        function emitCaseOrDefaultClauseRest(parentNode, statements, colonPos) {
            const emitAsSingleStatement = statements.length === 1 &&
                (
                // treat synthesized nodes as located on the same line for emit purposes
                ts.nodeIsSynthesized(parentNode) ||
                    ts.nodeIsSynthesized(statements[0]) ||
                    ts.rangeStartPositionsAreOnSameLine(parentNode, statements[0], currentSourceFile));
            let format = ts.ListFormat.CaseOrDefaultClauseStatements;
            if (emitAsSingleStatement) {
                writeToken(ts.SyntaxKind.ColonToken, colonPos, writePunctuation, parentNode);
                writeSpace();
                format &= ~(ts.ListFormat.MultiLine | ts.ListFormat.Indented);
            }
            else {
                emitTokenWithComment(ts.SyntaxKind.ColonToken, colonPos, writePunctuation, parentNode);
            }
            emitList(parentNode, statements, format);
        }
        function emitHeritageClause(node) {
            writeSpace();
            writeTokenText(node.token, writeKeyword);
            writeSpace();
            emitList(node, node.types, ts.ListFormat.HeritageClauseTypes);
        }
        function emitCatchClause(node) {
            const openParenPos = emitTokenWithComment(ts.SyntaxKind.CatchKeyword, node.pos, writeKeyword, node);
            writeSpace();
            if (node.variableDeclaration) {
                emitTokenWithComment(ts.SyntaxKind.OpenParenToken, openParenPos, writePunctuation, node);
                emit(node.variableDeclaration);
                emitTokenWithComment(ts.SyntaxKind.CloseParenToken, node.variableDeclaration.end, writePunctuation, node);
                writeSpace();
            }
            emit(node.block);
        }
        //
        // Property assignments
        //
        function emitPropertyAssignment(node) {
            emit(node.name);
            writePunctuation(":");
            writeSpace();
            // This is to ensure that we emit comment in the following case:
            //      For example:
            //          obj = {
            //              id: /*comment1*/ ()=>void
            //          }
            // "comment1" is not considered to be leading comment for node.initializer
            // but rather a trailing comment on the previous node.
            const initializer = node.initializer;
            if (emitTrailingCommentsOfPosition && (ts.getEmitFlags(initializer) & ts.EmitFlags.NoLeadingComments) === 0) {
                const commentRange = ts.getCommentRange(initializer);
                emitTrailingCommentsOfPosition(commentRange.pos);
            }
            emitExpression(initializer);
        }
        function emitShorthandPropertyAssignment(node) {
            emit(node.name);
            if (node.objectAssignmentInitializer) {
                writeSpace();
                writePunctuation("=");
                writeSpace();
                emitExpression(node.objectAssignmentInitializer);
            }
        }
        function emitSpreadAssignment(node) {
            if (node.expression) {
                writePunctuation("...");
                emitExpression(node.expression);
            }
        }
        //
        // Enum
        //
        function emitEnumMember(node) {
            emit(node.name);
            emitInitializer(node.initializer, node.name.end, node);
        }
        //
        // Top-level nodes
        //
        function emitSourceFile(node) {
            writeLine();
            const statements = node.statements;
            if (emitBodyWithDetachedComments) {
                // Emit detached comment if there are no prologue directives or if the first node is synthesized.
                // The synthesized node will have no leading comment so some comments may be missed.
                const shouldEmitDetachedComment = statements.length === 0 ||
                    !ts.isPrologueDirective(statements[0]) ||
                    ts.nodeIsSynthesized(statements[0]);
                if (shouldEmitDetachedComment) {
                    emitBodyWithDetachedComments(node, statements, emitSourceFileWorker);
                    return;
                }
            }
            emitSourceFileWorker(node);
        }
        function emitSyntheticTripleSlashReferencesIfNeeded(node) {
            emitTripleSlashDirectives(node.hasNoDefaultLib, node.syntheticFileReferences || [], node.syntheticTypeReferences || []);
        }
        function emitTripleSlashDirectivesIfNeeded(node) {
            if (node.isDeclarationFile)
                emitTripleSlashDirectives(node.hasNoDefaultLib, node.referencedFiles, node.typeReferenceDirectives);
        }
        function emitTripleSlashDirectives(hasNoDefaultLib, files, types) {
            if (hasNoDefaultLib) {
                write(`/// <reference no-default-lib="true"/>`);
                writeLine();
            }
            if (currentSourceFile && currentSourceFile.moduleName) {
                write(`/// <amd-module name="${currentSourceFile.moduleName}" />`);
                writeLine();
            }
            if (currentSourceFile && currentSourceFile.amdDependencies) {
                for (const dep of currentSourceFile.amdDependencies) {
                    if (dep.name) {
                        write(`/// <amd-dependency name="${dep.name}" path="${dep.path}" />`);
                    }
                    else {
                        write(`/// <amd-dependency path="${dep.path}" />`);
                    }
                    writeLine();
                }
            }
            for (const directive of files) {
                write(`/// <reference path="${directive.fileName}" />`);
                writeLine();
            }
            for (const directive of types) {
                write(`/// <reference types="${directive.fileName}" />`);
                writeLine();
            }
        }
        function emitSourceFileWorker(node) {
            const statements = node.statements;
            pushNameGenerationScope(node);
            emitHelpers(node);
            const index = ts.findIndex(statements, statement => !ts.isPrologueDirective(statement));
            emitTripleSlashDirectivesIfNeeded(node);
            emitList(node, statements, ts.ListFormat.MultiLine, index === -1 ? statements.length : index);
            popNameGenerationScope(node);
        }
        // Transformation nodes
        function emitPartiallyEmittedExpression(node) {
            emitExpression(node.expression);
        }
        function emitCommaList(node) {
            emitExpressionList(node, node.elements, ts.ListFormat.CommaListElements);
        }
        /**
         * Emits any prologue directives at the start of a Statement list, returning the
         * number of prologue directives written to the output.
         */
        function emitPrologueDirectives(statements, startWithNewLine, seenPrologueDirectives) {
            for (let i = 0; i < statements.length; i++) {
                const statement = statements[i];
                if (ts.isPrologueDirective(statement)) {
                    const shouldEmitPrologueDirective = seenPrologueDirectives ? !seenPrologueDirectives.has(statement.expression.text) : true;
                    if (shouldEmitPrologueDirective) {
                        if (startWithNewLine || i > 0) {
                            writeLine();
                        }
                        emit(statement);
                        if (seenPrologueDirectives) {
                            seenPrologueDirectives.set(statement.expression.text, true);
                        }
                    }
                }
                else {
                    // return index of the first non prologue directive
                    return i;
                }
            }
            return statements.length;
        }
        function emitPrologueDirectivesIfNeeded(sourceFileOrBundle) {
            if (ts.isSourceFile(sourceFileOrBundle)) {
                setSourceFile(sourceFileOrBundle);
                emitPrologueDirectives(sourceFileOrBundle.statements);
            }
            else {
                const seenPrologueDirectives = ts.createMap();
                for (const sourceFile of sourceFileOrBundle.sourceFiles) {
                    setSourceFile(sourceFile);
                    emitPrologueDirectives(sourceFile.statements, /*startWithNewLine*/ true, seenPrologueDirectives);
                }
            }
        }
        function emitShebangIfNeeded(sourceFileOrBundle) {
            if (ts.isSourceFile(sourceFileOrBundle)) {
                const shebang = ts.getShebang(sourceFileOrBundle.text);
                if (shebang) {
                    write(shebang);
                    writeLine();
                    return true;
                }
            }
            else {
                for (const sourceFile of sourceFileOrBundle.sourceFiles) {
                    // Emit only the first encountered shebang
                    if (emitShebangIfNeeded(sourceFile)) {
                        break;
                    }
                }
            }
        }
        //
        // Helpers
        //
        function emitNodeWithWriter(node, writer) {
            const savedWrite = write;
            write = writer;
            emit(node);
            write = savedWrite;
        }
        function emitModifiers(node, modifiers) {
            if (modifiers && modifiers.length) {
                emitList(node, modifiers, ts.ListFormat.Modifiers);
                writeSpace();
            }
        }
        function emitTypeAnnotation(node) {
            if (node) {
                writePunctuation(":");
                writeSpace();
                emit(node);
            }
        }
        function emitInitializer(node, equalCommentStartPos, container) {
            if (node) {
                writeSpace();
                emitTokenWithComment(ts.SyntaxKind.EqualsToken, equalCommentStartPos, writeOperator, container);
                writeSpace();
                emitExpression(node);
            }
        }
        function emitNodeWithPrefix(prefix, prefixWriter, node, emit) {
            if (node) {
                prefixWriter(prefix);
                emit(node);
            }
        }
        function emitWithLeadingSpace(node) {
            if (node) {
                writeSpace();
                emit(node);
            }
        }
        function emitExpressionWithLeadingSpace(node) {
            if (node) {
                writeSpace();
                emitExpression(node);
            }
        }
        function emitWithTrailingSpace(node) {
            if (node) {
                emit(node);
                writeSpace();
            }
        }
        function emitEmbeddedStatement(parent, node) {
            if (ts.isBlock(node) || ts.getEmitFlags(parent) & ts.EmitFlags.SingleLine) {
                writeSpace();
                emit(node);
            }
            else {
                writeLine();
                increaseIndent();
                emit(node);
                decreaseIndent();
            }
        }
        function emitDecorators(parentNode, decorators) {
            emitList(parentNode, decorators, ts.ListFormat.Decorators);
        }
        function emitTypeArguments(parentNode, typeArguments) {
            emitList(parentNode, typeArguments, ts.ListFormat.TypeArguments);
        }
        function emitTypeParameters(parentNode, typeParameters) {
            if (ts.isFunctionLike(parentNode) && parentNode.typeArguments) { // Quick info uses type arguments in place of type parameters on instantiated signatures
                return emitTypeArguments(parentNode, parentNode.typeArguments);
            }
            emitList(parentNode, typeParameters, ts.ListFormat.TypeParameters);
        }
        function emitParameters(parentNode, parameters) {
            emitList(parentNode, parameters, ts.ListFormat.Parameters);
        }
        function canEmitSimpleArrowHead(parentNode, parameters) {
            const parameter = ts.singleOrUndefined(parameters);
            return parameter
                && parameter.pos === parentNode.pos // may not have parsed tokens between parent and parameter
                && !(ts.isArrowFunction(parentNode) && parentNode.type) // arrow function may not have return type annotation
                && !ts.some(parentNode.decorators) // parent may not have decorators
                && !ts.some(parentNode.modifiers) // parent may not have modifiers
                && !ts.some(parentNode.typeParameters) // parent may not have type parameters
                && !ts.some(parameter.decorators) // parameter may not have decorators
                && !ts.some(parameter.modifiers) // parameter may not have modifiers
                && !parameter.dotDotDotToken // parameter may not be rest
                && !parameter.questionToken // parameter may not be optional
                && !parameter.type // parameter may not have a type annotation
                && !parameter.initializer // parameter may not have an initializer
                && ts.isIdentifier(parameter.name); // parameter name must be identifier
        }
        function emitParametersForArrow(parentNode, parameters) {
            if (canEmitSimpleArrowHead(parentNode, parameters)) {
                emitList(parentNode, parameters, ts.ListFormat.Parameters & ~ts.ListFormat.Parenthesis);
            }
            else {
                emitParameters(parentNode, parameters);
            }
        }
        function emitParametersForIndexSignature(parentNode, parameters) {
            emitList(parentNode, parameters, ts.ListFormat.IndexSignatureParameters);
        }
        function emitList(parentNode, children, format, start, count) {
            emitNodeList(emit, parentNode, children, format, start, count);
        }
        function emitExpressionList(parentNode, children, format, start, count) {
            emitNodeList(emitExpression, parentNode, children, format, start, count);
        }
        function writeDelimiter(format) {
            switch (format & ts.ListFormat.DelimitersMask) {
                case ts.ListFormat.None:
                    break;
                case ts.ListFormat.CommaDelimited:
                    writePunctuation(",");
                    break;
                case ts.ListFormat.BarDelimited:
                    writeSpace();
                    writePunctuation("|");
                    break;
                case ts.ListFormat.AmpersandDelimited:
                    writeSpace();
                    writePunctuation("&");
                    break;
            }
        }
        function emitNodeList(emit, parentNode, children, format, start = 0, count = children ? children.length - start : 0) {
            const isUndefined = children === undefined;
            if (isUndefined && format & ts.ListFormat.OptionalIfUndefined) {
                return;
            }
            const isEmpty = isUndefined || start >= children.length || count === 0;
            if (isEmpty && format & ts.ListFormat.OptionalIfEmpty) {
                if (onBeforeEmitNodeArray) {
                    onBeforeEmitNodeArray(children);
                }
                if (onAfterEmitNodeArray) {
                    onAfterEmitNodeArray(children);
                }
                return;
            }
            if (format & ts.ListFormat.BracketsMask) {
                writePunctuation(getOpeningBracket(format));
                if (isEmpty && !isUndefined) {
                    emitTrailingCommentsOfPosition(children.pos, /*prefixSpace*/ true); // Emit comments within empty bracketed lists
                }
            }
            if (onBeforeEmitNodeArray) {
                onBeforeEmitNodeArray(children);
            }
            if (isEmpty) {
                // Write a line terminator if the parent node was multi-line
                if (format & ts.ListFormat.MultiLine) {
                    writeLine();
                }
                else if (format & ts.ListFormat.SpaceBetweenBraces && !(format & ts.ListFormat.NoSpaceIfEmpty)) {
                    writeSpace();
                }
            }
            else {
                // Write the opening line terminator or leading whitespace.
                const mayEmitInterveningComments = (format & ts.ListFormat.NoInterveningComments) === 0;
                let shouldEmitInterveningComments = mayEmitInterveningComments;
                if (shouldWriteLeadingLineTerminator(parentNode, children, format)) {
                    writeLine();
                    shouldEmitInterveningComments = false;
                }
                else if (format & ts.ListFormat.SpaceBetweenBraces) {
                    writeSpace();
                }
                // Increase the indent, if requested.
                if (format & ts.ListFormat.Indented) {
                    increaseIndent();
                }
                // Emit each child.
                let previousSibling;
                let shouldDecreaseIndentAfterEmit;
                for (let i = 0; i < count; i++) {
                    const child = children[start + i];
                    // Write the delimiter if this is not the first node.
                    if (previousSibling) {
                        // i.e
                        //      function commentedParameters(
                        //          /* Parameter a */
                        //          a
                        //          /* End of parameter a */ -> this comment isn't considered to be trailing comment of parameter "a" due to newline
                        //          ,
                        if (format & ts.ListFormat.DelimitersMask && previousSibling.end !== parentNode.end) {
                            emitLeadingCommentsOfPosition(previousSibling.end);
                        }
                        writeDelimiter(format);
                        // Write either a line terminator or whitespace to separate the elements.
                        if (shouldWriteSeparatingLineTerminator(previousSibling, child, format)) {
                            // If a synthesized node in a single-line list starts on a new
                            // line, we should increase the indent.
                            if ((format & (ts.ListFormat.LinesMask | ts.ListFormat.Indented)) === ts.ListFormat.SingleLine) {
                                increaseIndent();
                                shouldDecreaseIndentAfterEmit = true;
                            }
                            writeLine();
                            shouldEmitInterveningComments = false;
                        }
                        else if (previousSibling && format & ts.ListFormat.SpaceBetweenSiblings) {
                            writeSpace();
                        }
                    }
                    // Emit this child.
                    if (shouldEmitInterveningComments) {
                        if (emitTrailingCommentsOfPosition) {
                            const commentRange = ts.getCommentRange(child);
                            emitTrailingCommentsOfPosition(commentRange.pos);
                        }
                    }
                    else {
                        shouldEmitInterveningComments = mayEmitInterveningComments;
                    }
                    emit(child);
                    if (shouldDecreaseIndentAfterEmit) {
                        decreaseIndent();
                        shouldDecreaseIndentAfterEmit = false;
                    }
                    previousSibling = child;
                }
                // Write a trailing comma, if requested.
                const hasTrailingComma = (format & ts.ListFormat.AllowTrailingComma) && children.hasTrailingComma;
                if (format & ts.ListFormat.CommaDelimited && hasTrailingComma) {
                    writePunctuation(",");
                }
                // Emit any trailing comment of the last element in the list
                // i.e
                //       var array = [...
                //          2
                //          /* end of element 2 */
                //       ];
                if (previousSibling && format & ts.ListFormat.DelimitersMask && previousSibling.end !== parentNode.end && !(ts.getEmitFlags(previousSibling) & ts.EmitFlags.NoTrailingComments)) {
                    emitLeadingCommentsOfPosition(previousSibling.end);
                }
                // Decrease the indent, if requested.
                if (format & ts.ListFormat.Indented) {
                    decreaseIndent();
                }
                // Write the closing line terminator or closing whitespace.
                if (shouldWriteClosingLineTerminator(parentNode, children, format)) {
                    writeLine();
                }
                else if (format & ts.ListFormat.SpaceBetweenBraces) {
                    writeSpace();
                }
            }
            if (onAfterEmitNodeArray) {
                onAfterEmitNodeArray(children);
            }
            if (format & ts.ListFormat.BracketsMask) {
                if (isEmpty && !isUndefined) {
                    emitLeadingCommentsOfPosition(children.end); // Emit leading comments within empty lists
                }
                writePunctuation(getClosingBracket(format));
            }
        }
        function commitPendingSemicolonInternal() {
            if (pendingSemicolon) {
                writeSemicolonInternal();
                pendingSemicolon = false;
            }
        }
        function writeLiteral(s) {
            commitPendingSemicolon();
            writer.writeLiteral(s);
        }
        function writeStringLiteral(s) {
            commitPendingSemicolon();
            writer.writeStringLiteral(s);
        }
        function writeBase(s) {
            commitPendingSemicolon();
            writer.write(s);
        }
        function writeSymbol(s, sym) {
            commitPendingSemicolon();
            writer.writeSymbol(s, sym);
        }
        function writePunctuation(s) {
            commitPendingSemicolon();
            writer.writePunctuation(s);
        }
        function deferWriteSemicolon() {
            pendingSemicolon = true;
        }
        function writeSemicolonInternal() {
            writer.writePunctuation(";");
        }
        function writeKeyword(s) {
            commitPendingSemicolon();
            writer.writeKeyword(s);
        }
        function writeOperator(s) {
            commitPendingSemicolon();
            writer.writeOperator(s);
        }
        function writeParameter(s) {
            commitPendingSemicolon();
            writer.writeParameter(s);
        }
        function writeSpace() {
            commitPendingSemicolon();
            writer.writeSpace(" ");
        }
        function writeProperty(s) {
            commitPendingSemicolon();
            writer.writeProperty(s);
        }
        function writeLine() {
            commitPendingSemicolon();
            writer.writeLine();
        }
        function increaseIndent() {
            commitPendingSemicolon();
            writer.increaseIndent();
        }
        function decreaseIndent() {
            commitPendingSemicolon();
            writer.decreaseIndent();
        }
        function writeToken(token, pos, writer, contextNode) {
            return onEmitSourceMapOfToken
                ? onEmitSourceMapOfToken(contextNode, token, writer, pos, writeTokenText)
                : writeTokenText(token, writer, pos);
        }
        function writeTokenNode(node, writer) {
            if (onBeforeEmitToken) {
                onBeforeEmitToken(node);
            }
            writer(ts.tokenToString(node.kind));
            if (onAfterEmitToken) {
                onAfterEmitToken(node);
            }
        }
        function writeTokenText(token, writer, pos) {
            const tokenString = ts.tokenToString(token);
            writer(tokenString);
            return pos < 0 ? pos : pos + tokenString.length;
        }
        function writeLineOrSpace(node) {
            if (ts.getEmitFlags(node) & ts.EmitFlags.SingleLine) {
                writeSpace();
            }
            else {
                writeLine();
            }
        }
        function writeLines(text) {
            const lines = text.split(/\r\n?|\n/g);
            const indentation = ts.guessIndentation(lines);
            for (const lineText of lines) {
                const line = indentation ? lineText.slice(indentation) : lineText;
                if (line.length) {
                    writeLine();
                    write(line);
                    writeLine();
                }
            }
        }
        function increaseIndentIf(value, valueToWriteWhenNotIndenting) {
            if (value) {
                increaseIndent();
                writeLine();
            }
            else if (valueToWriteWhenNotIndenting) {
                write(valueToWriteWhenNotIndenting);
            }
        }
        // Helper function to decrease the indent if we previously indented.  Allows multiple
        // previous indent values to be considered at a time.  This also allows caller to just
        // call this once, passing in all their appropriate indent values, instead of needing
        // to call this helper function multiple times.
        function decreaseIndentIf(value1, value2) {
            if (value1) {
                decreaseIndent();
            }
            if (value2) {
                decreaseIndent();
            }
        }
        function shouldWriteLeadingLineTerminator(parentNode, children, format) {
            if (format & ts.ListFormat.MultiLine) {
                return true;
            }
            if (format & ts.ListFormat.PreserveLines) {
                if (format & ts.ListFormat.PreferNewLine) {
                    return true;
                }
                const firstChild = children[0];
                if (firstChild === undefined) {
                    return !ts.rangeIsOnSingleLine(parentNode, currentSourceFile);
                }
                else if (ts.positionIsSynthesized(parentNode.pos) || ts.nodeIsSynthesized(firstChild)) {
                    return synthesizedNodeStartsOnNewLine(firstChild, format);
                }
                else {
                    return !ts.rangeStartPositionsAreOnSameLine(parentNode, firstChild, currentSourceFile);
                }
            }
            else {
                return false;
            }
        }
        function shouldWriteSeparatingLineTerminator(previousNode, nextNode, format) {
            if (format & ts.ListFormat.MultiLine) {
                return true;
            }
            else if (format & ts.ListFormat.PreserveLines) {
                if (previousNode === undefined || nextNode === undefined) {
                    return false;
                }
                else if (ts.nodeIsSynthesized(previousNode) || ts.nodeIsSynthesized(nextNode)) {
                    return synthesizedNodeStartsOnNewLine(previousNode, format) || synthesizedNodeStartsOnNewLine(nextNode, format);
                }
                else {
                    return !ts.rangeEndIsOnSameLineAsRangeStart(previousNode, nextNode, currentSourceFile);
                }
            }
            else {
                return ts.getStartsOnNewLine(nextNode);
            }
        }
        function shouldWriteClosingLineTerminator(parentNode, children, format) {
            if (format & ts.ListFormat.MultiLine) {
                return (format & ts.ListFormat.NoTrailingNewLine) === 0;
            }
            else if (format & ts.ListFormat.PreserveLines) {
                if (format & ts.ListFormat.PreferNewLine) {
                    return true;
                }
                const lastChild = ts.lastOrUndefined(children);
                if (lastChild === undefined) {
                    return !ts.rangeIsOnSingleLine(parentNode, currentSourceFile);
                }
                else if (ts.positionIsSynthesized(parentNode.pos) || ts.nodeIsSynthesized(lastChild)) {
                    return synthesizedNodeStartsOnNewLine(lastChild, format);
                }
                else {
                    return !ts.rangeEndPositionsAreOnSameLine(parentNode, lastChild, currentSourceFile);
                }
            }
            else {
                return false;
            }
        }
        function synthesizedNodeStartsOnNewLine(node, format) {
            if (ts.nodeIsSynthesized(node)) {
                const startsOnNewLine = ts.getStartsOnNewLine(node);
                if (startsOnNewLine === undefined) {
                    return (format & ts.ListFormat.PreferNewLine) !== 0;
                }
                return startsOnNewLine;
            }
            return (format & ts.ListFormat.PreferNewLine) !== 0;
        }
        function needsIndentation(parent, node1, node2) {
            parent = skipSynthesizedParentheses(parent);
            node1 = skipSynthesizedParentheses(node1);
            node2 = skipSynthesizedParentheses(node2);
            // Always use a newline for synthesized code if the synthesizer desires it.
            if (ts.getStartsOnNewLine(node2)) {
                return true;
            }
            return !ts.nodeIsSynthesized(parent)
                && !ts.nodeIsSynthesized(node1)
                && !ts.nodeIsSynthesized(node2)
                && !ts.rangeEndIsOnSameLineAsRangeStart(node1, node2, currentSourceFile);
        }
        function isEmptyBlock(block) {
            return block.statements.length === 0
                && ts.rangeEndIsOnSameLineAsRangeStart(block, block, currentSourceFile);
        }
        function skipSynthesizedParentheses(node) {
            while (node.kind === ts.SyntaxKind.ParenthesizedExpression && ts.nodeIsSynthesized(node)) {
                node = node.expression;
            }
            return node;
        }
        function getTextOfNode(node, includeTrivia) {
            if (ts.isGeneratedIdentifier(node)) {
                return generateName(node);
            }
            else if (ts.isIdentifier(node) && (ts.nodeIsSynthesized(node) || !node.parent)) {
                return ts.idText(node);
            }
            else if (node.kind === ts.SyntaxKind.StringLiteral && node.textSourceNode) {
                return getTextOfNode(node.textSourceNode, includeTrivia);
            }
            else if (ts.isLiteralExpression(node) && (ts.nodeIsSynthesized(node) || !node.parent)) {
                return node.text;
            }
            return ts.getSourceTextOfNodeFromSourceFile(currentSourceFile, node, includeTrivia);
        }
        function getLiteralTextOfNode(node) {
            if (node.kind === ts.SyntaxKind.StringLiteral && node.textSourceNode) {
                const textSourceNode = node.textSourceNode;
                if (ts.isIdentifier(textSourceNode)) {
                    return ts.getEmitFlags(node) & ts.EmitFlags.NoAsciiEscaping ?
                        `"${ts.escapeString(getTextOfNode(textSourceNode))}"` :
                        `"${ts.escapeNonAsciiString(getTextOfNode(textSourceNode))}"`;
                }
                else {
                    return getLiteralTextOfNode(textSourceNode);
                }
            }
            return ts.getLiteralText(node, currentSourceFile);
        }
        /**
         * Push a new name generation scope.
         */
        function pushNameGenerationScope(node) {
            if (node && ts.getEmitFlags(node) & ts.EmitFlags.ReuseTempVariableScope) {
                return;
            }
            tempFlagsStack.push(tempFlags);
            tempFlags = 0;
            reservedNamesStack.push(reservedNames);
        }
        /**
         * Pop the current name generation scope.
         */
        function popNameGenerationScope(node) {
            if (node && ts.getEmitFlags(node) & ts.EmitFlags.ReuseTempVariableScope) {
                return;
            }
            tempFlags = tempFlagsStack.pop();
            reservedNames = reservedNamesStack.pop();
        }
        function reserveNameInNestedScopes(name) {
            if (!reservedNames || reservedNames === ts.lastOrUndefined(reservedNamesStack)) {
                reservedNames = ts.createMap();
            }
            reservedNames.set(name, true);
        }
        /**
         * Generate the text for a generated identifier.
         */
        function generateName(name) {
            if ((name.autoGenerateFlags & 7 /* KindMask */) === 4 /* Node */) {
                // Node names generate unique names based on their original node
                // and are cached based on that node's id.
                if (name.autoGenerateFlags & 8 /* SkipNameGenerationScope */) {
                    const savedTempFlags = tempFlags;
                    popNameGenerationScope(/*node*/ undefined);
                    const result = generateNameCached(getNodeForGeneratedName(name));
                    pushNameGenerationScope(/*node*/ undefined);
                    tempFlags = savedTempFlags;
                    return result;
                }
                else {
                    return generateNameCached(getNodeForGeneratedName(name));
                }
            }
            else {
                // Auto, Loop, and Unique names are cached based on their unique
                // autoGenerateId.
                const autoGenerateId = name.autoGenerateId;
                return autoGeneratedIdToGeneratedName[autoGenerateId] || (autoGeneratedIdToGeneratedName[autoGenerateId] = makeName(name));
            }
        }
        function generateNameCached(node) {
            const nodeId = ts.getNodeId(node);
            return nodeIdToGeneratedName[nodeId] || (nodeIdToGeneratedName[nodeId] = generateNameForNode(node));
        }
        /**
         * Returns a value indicating whether a name is unique globally, within the current file,
         * or within the NameGenerator.
         */
        function isUniqueName(name) {
            return isFileLevelUniqueName(name)
                && !generatedNames.has(name)
                && !(reservedNames && reservedNames.has(name));
        }
        /**
         * Returns a value indicating whether a name is unique globally or within the current file.
         */
        function isFileLevelUniqueName(name) {
            return ts.isFileLevelUniqueName(currentSourceFile, name, hasGlobalName);
        }
        /**
         * Returns a value indicating whether a name is unique within a container.
         */
        function isUniqueLocalName(name, container) {
            for (let node = container; ts.isNodeDescendantOf(node, container); node = node.nextContainer) {
                if (node.locals) {
                    const local = node.locals.get(ts.escapeLeadingUnderscores(name));
                    // We conservatively include alias symbols to cover cases where they're emitted as locals
                    if (local && local.flags & (ts.SymbolFlags.Value | ts.SymbolFlags.ExportValue | ts.SymbolFlags.Alias)) {
                        return false;
                    }
                }
            }
            return true;
        }
        /**
         * Return the next available name in the pattern _a ... _z, _0, _1, ...
         * TempFlags._i or TempFlags._n may be used to express a preference for that dedicated name.
         * Note that names generated by makeTempVariableName and makeUniqueName will never conflict.
         */
        function makeTempVariableName(flags, reservedInNestedScopes) {
            if (flags && !(tempFlags & flags)) {
                const name = flags === 268435456 /* _i */ ? "_i" : "_n";
                if (isUniqueName(name)) {
                    tempFlags |= flags;
                    if (reservedInNestedScopes) {
                        reserveNameInNestedScopes(name);
                    }
                    return name;
                }
            }
            while (true) {
                const count = tempFlags & 268435455 /* CountMask */;
                tempFlags++;
                // Skip over 'i' and 'n'
                if (count !== 8 && count !== 13) {
                    const name = count < 26
                        ? "_" + String.fromCharCode(97 /* a */ + count)
                        : "_" + (count - 26);
                    if (isUniqueName(name)) {
                        if (reservedInNestedScopes) {
                            reserveNameInNestedScopes(name);
                        }
                        return name;
                    }
                }
            }
        }
        /**
         * Generate a name that is unique within the current file and doesn't conflict with any names
         * in global scope. The name is formed by adding an '_n' suffix to the specified base name,
         * where n is a positive integer. Note that names generated by makeTempVariableName and
         * makeUniqueName are guaranteed to never conflict.
         * If `optimistic` is set, the first instance will use 'baseName' verbatim instead of 'baseName_1'
         */
        function makeUniqueName(baseName, checkFn = isUniqueName, optimistic) {
            if (optimistic) {
                if (checkFn(baseName)) {
                    generatedNames.set(baseName, true);
                    return baseName;
                }
            }
            // Find the first unique 'name_n', where n is a positive number
            if (baseName.charCodeAt(baseName.length - 1) !== 95 /* _ */) {
                baseName += "_";
            }
            let i = 1;
            while (true) {
                const generatedName = baseName + i;
                if (checkFn(generatedName)) {
                    generatedNames.set(generatedName, true);
                    return generatedName;
                }
                i++;
            }
        }
        function makeFileLevelOptmiisticUniqueName(name) {
            return makeUniqueName(name, isFileLevelUniqueName, /*optimistic*/ true);
        }
        /**
         * Generates a unique name for a ModuleDeclaration or EnumDeclaration.
         */
        function generateNameForModuleOrEnum(node) {
            const name = getTextOfNode(node.name);
            // Use module/enum name itself if it is unique, otherwise make a unique variation
            return isUniqueLocalName(name, node) ? name : makeUniqueName(name);
        }
        /**
         * Generates a unique name for an ImportDeclaration or ExportDeclaration.
         */
        function generateNameForImportOrExportDeclaration(node) {
            const expr = ts.getExternalModuleName(node);
            const baseName = ts.isStringLiteral(expr) ?
                ts.makeIdentifierFromModuleName(expr.text) : "module";
            return makeUniqueName(baseName);
        }
        /**
         * Generates a unique name for a default export.
         */
        function generateNameForExportDefault() {
            return makeUniqueName("default");
        }
        /**
         * Generates a unique name for a class expression.
         */
        function generateNameForClassExpression() {
            return makeUniqueName("class");
        }
        function generateNameForMethodOrAccessor(node) {
            if (ts.isIdentifier(node.name)) {
                return generateNameCached(node.name);
            }
            return makeTempVariableName(0 /* Auto */);
        }
        /**
         * Generates a unique name from a node.
         */
        function generateNameForNode(node) {
            switch (node.kind) {
                case ts.SyntaxKind.Identifier:
                    return makeUniqueName(getTextOfNode(node));
                case ts.SyntaxKind.ModuleDeclaration:
                case ts.SyntaxKind.EnumDeclaration:
                    return generateNameForModuleOrEnum(node);
                case ts.SyntaxKind.ImportDeclaration:
                case ts.SyntaxKind.ExportDeclaration:
                    return generateNameForImportOrExportDeclaration(node);
                case ts.SyntaxKind.FunctionDeclaration:
                case ts.SyntaxKind.ClassDeclaration:
                case ts.SyntaxKind.ExportAssignment:
                    return generateNameForExportDefault();
                case ts.SyntaxKind.ClassExpression:
                    return generateNameForClassExpression();
                case ts.SyntaxKind.MethodDeclaration:
                case ts.SyntaxKind.GetAccessor:
                case ts.SyntaxKind.SetAccessor:
                    return generateNameForMethodOrAccessor(node);
                default:
                    return makeTempVariableName(0 /* Auto */);
            }
        }
        /**
         * Generates a unique identifier for a node.
         */
        function makeName(name) {
            switch (name.autoGenerateFlags & 7 /* KindMask */) {
                case 1 /* Auto */:
                    return makeTempVariableName(0 /* Auto */, !!(name.autoGenerateFlags & 16 /* ReservedInNestedScopes */));
                case 2 /* Loop */:
                    return makeTempVariableName(268435456 /* _i */, !!(name.autoGenerateFlags & 16 /* ReservedInNestedScopes */));
                case 3 /* Unique */:
                    return makeUniqueName(ts.idText(name), (name.autoGenerateFlags & 64 /* FileLevel */) ? isFileLevelUniqueName : isUniqueName, !!(name.autoGenerateFlags & 32 /* Optimistic */));
            }
            ts.Debug.fail("Unsupported GeneratedIdentifierKind.");
        }
        /**
         * Gets the node from which a name should be generated.
         */
        function getNodeForGeneratedName(name) {
            const autoGenerateId = name.autoGenerateId;
            let node = name;
            let original = node.original;
            while (original) {
                node = original;
                // if "node" is a different generated name (having a different
                // "autoGenerateId"), use it and stop traversing.
                if (ts.isIdentifier(node)
                    && node.autoGenerateFlags === 4 /* Node */
                    && node.autoGenerateId !== autoGenerateId) {
                    break;
                }
                original = node.original;
            }
            // otherwise, return the original node for the source;
            return node;
        }
    }
    ts.createPrinter = createPrinter;
    function createBracketsMap() {
        const brackets = [];
        brackets[ts.ListFormat.Braces] = ["{", "}"];
        brackets[ts.ListFormat.Parenthesis] = ["(", ")"];
        brackets[ts.ListFormat.AngleBrackets] = ["<", ">"];
        brackets[ts.ListFormat.SquareBrackets] = ["[", "]"];
        return brackets;
    }
    function getOpeningBracket(format) {
        return brackets[format & ts.ListFormat.BracketsMask][0];
    }
    function getClosingBracket(format) {
        return brackets[format & ts.ListFormat.BracketsMask][1];
    }
})(ts || (ts = {}));
