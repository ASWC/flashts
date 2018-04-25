var ts;
(function (ts) {
    /*
     * This function will compile source text from 'input' argument using specified compiler options.
     * If not options are provided - it will use a set of default compiler options.
     * Extra compiler options that will unconditionally be used by this function are:
     * - isolatedModules = true
     * - allowNonTsExtensions = true
     * - noLib = true
     * - noResolve = true
     */
    function transpileModule(input, transpileOptions) {
        const diagnostics = [];
        const options = transpileOptions.compilerOptions ? fixupCompilerOptions(transpileOptions.compilerOptions, diagnostics) : ts.getDefaultCompilerOptions();
        options.isolatedModules = true;
        // transpileModule does not write anything to disk so there is no need to verify that there are no conflicts between input and output paths.
        options.suppressOutputPathCheck = true;
        // Filename can be non-ts file.
        options.allowNonTsExtensions = true;
        // We are not returning a sourceFile for lib file when asked by the program,
        // so pass --noLib to avoid reporting a file not found error.
        options.noLib = true;
        // Clear out other settings that would not be used in transpiling this module
        options.lib = undefined;
        options.types = undefined;
        options.noEmit = undefined;
        options.noEmitOnError = undefined;
        options.paths = undefined;
        options.rootDirs = undefined;
        options.declaration = undefined;
        options.declarationDir = undefined;
        options.out = undefined;
        options.outFile = undefined;
        // We are not doing a full typecheck, we are not resolving the whole context,
        // so pass --noResolve to avoid reporting missing file errors.
        options.noResolve = true;
        // if jsx is specified then treat file as .tsx
        const inputFileName = transpileOptions.fileName || (options.jsx ? "module.tsx" : "module.ts");
        const sourceFile = ts.createSourceFile(inputFileName, input, options.target);
        if (transpileOptions.moduleName) {
            sourceFile.moduleName = transpileOptions.moduleName;
        }
        if (transpileOptions.renamedDependencies) {
            sourceFile.renamedDependencies = ts.createMapFromTemplate(transpileOptions.renamedDependencies);
        }
        const newLine = ts.getNewLineCharacter(options);
        // Output
        let outputText;
        let sourceMapText;
        // Create a compilerHost object to allow the compiler to read and write files
        const compilerHost = {
            getSourceFile: (fileName) => fileName === ts.normalizePath(inputFileName) ? sourceFile : undefined,
            writeFile: (name, text) => {
                if (ts.fileExtensionIs(name, ".map")) {
                    ts.Debug.assertEqual(sourceMapText, undefined, "Unexpected multiple source map outputs, file:", name);
                    sourceMapText = text;
                }
                else {
                    ts.Debug.assertEqual(outputText, undefined, "Unexpected multiple outputs, file:", name);
                    outputText = text;
                }
            },
            getDefaultLibFileName: () => "lib.d.ts",
            useCaseSensitiveFileNames: () => false,
            getCanonicalFileName: fileName => fileName,
            getCurrentDirectory: () => "",
            getNewLine: () => newLine,
            fileExists: (fileName) => fileName === inputFileName,
            readFile: () => "",
            directoryExists: () => true,
            getDirectories: () => []
        };
        const program = ts.createProgram([inputFileName], options, compilerHost);
        if (transpileOptions.reportDiagnostics) {
            ts.addRange(/*to*/ diagnostics, /*from*/ program.getSyntacticDiagnostics(sourceFile));
            ts.addRange(/*to*/ diagnostics, /*from*/ program.getOptionsDiagnostics());
        }
        // Emit
        program.emit(/*targetSourceFile*/ undefined, /*writeFile*/ undefined, /*cancellationToken*/ undefined, /*emitOnlyDtsFiles*/ undefined, transpileOptions.transformers);
        ts.Debug.assert(outputText !== undefined, "Output generation failed");
        return { outputText, diagnostics, sourceMapText };
    }
    ts.transpileModule = transpileModule;
    /*
     * This is a shortcut function for transpileModule - it accepts transpileOptions as parameters and returns only outputText part of the result.
     */
    function transpile(input, compilerOptions, fileName, diagnostics, moduleName) {
        const output = transpileModule(input, { compilerOptions, fileName, reportDiagnostics: !!diagnostics, moduleName });
        // addRange correctly handles cases when wither 'from' or 'to' argument is missing
        ts.addRange(diagnostics, output.diagnostics);
        return output.outputText;
    }
    ts.transpile = transpile;
    let commandLineOptionsStringToEnum;
    /** JS users may pass in string values for enum compiler options (such as ModuleKind), so convert. */
    /*@internal*/
    function fixupCompilerOptions(options, diagnostics) {
        // Lazily create this value to fix module loading errors.
        commandLineOptionsStringToEnum = commandLineOptionsStringToEnum || ts.filter(ts.optionDeclarations, o => typeof o.type === "object" && !ts.forEachEntry(o.type, v => typeof v !== "number"));
        options = ts.cloneCompilerOptions(options);
        for (const opt of commandLineOptionsStringToEnum) {
            if (!ts.hasProperty(options, opt.name)) {
                continue;
            }
            const value = options[opt.name];
            // Value should be a key of opt.type
            if (ts.isString(value)) {
                // If value is not a string, this will fail
                options[opt.name] = ts.parseCustomTypeOption(opt, value, diagnostics);
            }
            else {
                if (!ts.forEachEntry(opt.type, v => v === value)) {
                    // Supplied value isn't a valid enum value.
                    diagnostics.push(ts.createCompilerDiagnosticForInvalidCustomType(opt));
                }
            }
        }
        return options;
    }
    ts.fixupCompilerOptions = fixupCompilerOptions;
})(ts || (ts = {}));
