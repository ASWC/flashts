/// <reference path="harness.ts"/>
/// <reference path="runnerbase.ts" />
/// <reference path="loggedIO.ts" />
/// <reference path="..\compiler\commandLineParser.ts"/>
// In harness baselines, null is different than undefined. See `generateActual` in `harness.ts`.
/* tslint:disable:no-null-keyword */
var RWC;
(function (RWC) {
    function runWithIOLog(ioLog, fn) {
        const oldIO = Harness.IO;
        const wrappedIO = Playback.wrapIO(oldIO);
        wrappedIO.startReplayFromData(ioLog);
        Harness.IO = wrappedIO;
        try {
            fn(oldIO);
        }
        finally {
            wrappedIO.endReplay();
            Harness.IO = oldIO;
        }
    }
    function isTsConfigFile(file) {
        return file.path.indexOf("tsconfig") !== -1 && file.path.indexOf("json") !== -1;
    }
    function runRWCTest(jsonPath) {
        describe("Testing a rwc project: " + jsonPath, () => {
            let inputFiles = [];
            let otherFiles = [];
            let tsconfigFiles = [];
            let compilerResult;
            let compilerOptions;
            const baselineOpts = {
                Subfolder: "rwc",
                Baselinefolder: "internal/baselines"
            };
            const baseName = ts.getBaseFileName(jsonPath);
            let currentDirectory;
            let useCustomLibraryFile;
            after(() => {
                // Mocha holds onto the closure environment of the describe callback even after the test is done.
                // Therefore we have to clean out large objects after the test is done.
                inputFiles = [];
                otherFiles = [];
                tsconfigFiles = [];
                compilerResult = undefined;
                compilerOptions = undefined;
                currentDirectory = undefined;
                // useCustomLibraryFile is a flag specified in the json object to indicate whether to use built/local/lib.d.ts
                // or to use lib.d.ts inside the json object. If the flag is true, use the lib.d.ts inside json file
                // otherwise use the lib.d.ts from built/local
                useCustomLibraryFile = undefined;
            });
            it("can compile", function () {
                this.timeout(800000); // Allow long timeouts for RWC compilations
                let opts;
                const ioLog = Playback.newStyleLogIntoOldStyleLog(JSON.parse(Harness.IO.readFile(`internal/cases/rwc/${jsonPath}/test.json`)), Harness.IO, `internal/cases/rwc/${baseName}`);
                currentDirectory = ioLog.currentDirectory;
                useCustomLibraryFile = ioLog.useCustomLibraryFile;
                runWithIOLog(ioLog, () => {
                    opts = ts.parseCommandLine(ioLog.arguments, fileName => Harness.IO.readFile(fileName));
                    assert.equal(opts.errors.length, 0);
                    // To provide test coverage of output javascript file,
                    // we will set noEmitOnError flag to be false.
                    opts.options.noEmitOnError = false;
                });
                runWithIOLog(ioLog, oldIO => {
                    let fileNames = opts.fileNames;
                    const tsconfigFile = ts.forEach(ioLog.filesRead, f => isTsConfigFile(f) ? f : undefined);
                    if (tsconfigFile) {
                        const tsconfigFileContents = getHarnessCompilerInputUnit(tsconfigFile.path);
                        tsconfigFiles.push({ unitName: tsconfigFile.path, content: tsconfigFileContents.content });
                        const parsedTsconfigFileContents = ts.parseJsonText(tsconfigFile.path, tsconfigFileContents.content);
                        const configParseHost = {
                            useCaseSensitiveFileNames: Harness.IO.useCaseSensitiveFileNames(),
                            fileExists: Harness.IO.fileExists,
                            readDirectory: Harness.IO.readDirectory,
                            readFile: Harness.IO.readFile
                        };
                        const configParseResult = ts.parseJsonSourceFileConfigFileContent(parsedTsconfigFileContents, configParseHost, ts.getDirectoryPath(tsconfigFile.path));
                        fileNames = configParseResult.fileNames;
                        opts.options = ts.extend(opts.options, configParseResult.options);
                        ts.setConfigFileInOptions(opts.options, configParseResult.options.configFile);
                    }
                    // Deduplicate files so they are only printed once in baselines (they are deduplicated within the compiler already)
                    const uniqueNames = ts.createMap();
                    for (const fileName of fileNames) {
                        // Must maintain order, build result list while checking map
                        const normalized = ts.normalizeSlashes(fileName);
                        if (!uniqueNames.has(normalized)) {
                            uniqueNames.set(normalized, true);
                            // Load the file
                            inputFiles.push(getHarnessCompilerInputUnit(fileName));
                        }
                    }
                    // Add files to compilation
                    const isInInputList = (resolvedPath) => (inputFile) => inputFile.unitName === resolvedPath;
                    for (const fileRead of ioLog.filesRead) {
                        // Check if the file is already added into the set of input files.
                        const resolvedPath = ts.normalizeSlashes(Harness.IO.resolvePath(fileRead.path));
                        const inInputList = ts.forEach(inputFiles, isInInputList(resolvedPath));
                        if (isTsConfigFile(fileRead)) {
                            continue;
                        }
                        if (!Harness.isDefaultLibraryFile(fileRead.path)) {
                            if (inInputList) {
                                continue;
                            }
                            otherFiles.push(getHarnessCompilerInputUnit(fileRead.path));
                        }
                        else if (!opts.options.noLib && Harness.isDefaultLibraryFile(fileRead.path)) {
                            if (!inInputList) {
                                // If useCustomLibraryFile is true, we will use lib.d.ts from json object
                                // otherwise use the lib.d.ts from built/local
                                // Majority of RWC code will be using built/local/lib.d.ts instead of
                                // lib.d.ts inside json file. However, some RWC cases will still use
                                // their own version of lib.d.ts because they have customized lib.d.ts
                                if (useCustomLibraryFile) {
                                    inputFiles.push(getHarnessCompilerInputUnit(fileRead.path));
                                }
                                else {
                                    // set the flag to put default library to the beginning of the list
                                    inputFiles.unshift(Harness.getDefaultLibraryFile(fileRead.path, oldIO));
                                }
                            }
                        }
                    }
                    // do not use lib since we already read it in above
                    opts.options.lib = undefined;
                    opts.options.noLib = true;
                    // Emit the results
                    compilerOptions = undefined;
                    const output = Harness.Compiler.compileFiles(inputFiles, otherFiles, 
                    /* harnessOptions */ undefined, opts.options, 
                    // Since each RWC json file specifies its current directory in its json file, we need
                    // to pass this information in explicitly instead of acquiring it from the process.
                    currentDirectory);
                    compilerOptions = output.options;
                    compilerResult = output.result;
                });
                function getHarnessCompilerInputUnit(fileName) {
                    const unitName = ts.normalizeSlashes(Harness.IO.resolvePath(fileName));
                    let content;
                    try {
                        content = Harness.IO.readFile(unitName);
                    }
                    catch (e) {
                        content = Harness.IO.readFile(fileName);
                    }
                    return { unitName, content };
                }
            });
            it("has the expected emitted code", function () {
                this.timeout(100000); // Allow longer timeouts for RWC js verification
                Harness.Baseline.runMultifileBaseline(baseName, "", () => {
                    return Harness.Compiler.iterateOutputs(compilerResult.files);
                }, baselineOpts, [".js", ".jsx"]);
            });
            it("has the expected declaration file content", () => {
                Harness.Baseline.runMultifileBaseline(baseName, "", () => {
                    if (!compilerResult.declFilesCode.length) {
                        return null;
                    }
                    return Harness.Compiler.iterateOutputs(compilerResult.declFilesCode);
                }, baselineOpts, [".d.ts"]);
            });
            it("has the expected source maps", () => {
                Harness.Baseline.runMultifileBaseline(baseName, "", () => {
                    if (!compilerResult.sourceMaps.length) {
                        return null;
                    }
                    return Harness.Compiler.iterateOutputs(compilerResult.sourceMaps);
                }, baselineOpts, [".map"]);
            });
            it("has the expected errors", () => {
                Harness.Baseline.runMultifileBaseline(baseName, ".errors.txt", () => {
                    if (compilerResult.errors.length === 0) {
                        return null;
                    }
                    // Do not include the library in the baselines to avoid noise
                    const baselineFiles = tsconfigFiles.concat(inputFiles, otherFiles).filter(f => !Harness.isDefaultLibraryFile(f.unitName));
                    const errors = compilerResult.errors.filter(e => !e.file || !Harness.isDefaultLibraryFile(e.file.fileName));
                    return Harness.Compiler.iterateErrorBaseline(baselineFiles, errors);
                }, baselineOpts);
            });
            // Ideally, a generated declaration file will have no errors. But we allow generated
            // declaration file errors as part of the baseline.
            it("has the expected errors in generated declaration files", () => {
                if (compilerOptions.declaration && !compilerResult.errors.length) {
                    Harness.Baseline.runMultifileBaseline(baseName, ".dts.errors.txt", () => {
                        if (compilerResult.errors.length === 0) {
                            return null;
                        }
                        const declContext = Harness.Compiler.prepareDeclarationCompilationContext(inputFiles, otherFiles, compilerResult, /*harnessSettings*/ undefined, compilerOptions, currentDirectory);
                        // Reset compilerResult before calling into `compileDeclarationFiles` so the memory from the original compilation can be freed
                        compilerResult = undefined;
                        const declFileCompilationResult = Harness.Compiler.compileDeclarationFiles(declContext);
                        return Harness.Compiler.iterateErrorBaseline(tsconfigFiles.concat(declFileCompilationResult.declInputFiles, declFileCompilationResult.declOtherFiles), declFileCompilationResult.declResult.errors);
                    }, baselineOpts);
                }
            });
        });
    }
    RWC.runRWCTest = runRWCTest;
})(RWC || (RWC = {}));
class RWCRunner extends RunnerBase {
    enumerateTestFiles() {
        return Harness.IO.getDirectories("internal/cases/rwc/");
    }
    kind() {
        return "rwc";
    }
    /** Setup the runner's tests so that they are ready to be executed by the harness
     *  The first test should be a describe/it block that sets up the harness's compiler instance appropriately
     */
    initializeTests() {
        // Read in and evaluate the test list
        for (const test of this.tests && this.tests.length ? this.tests : this.enumerateTestFiles()) {
            this.runTest(test);
        }
    }
    runTest(jsonFileName) {
        RWC.runRWCTest(jsonFileName);
    }
}
