/// <reference path="..\harness.ts" />
var ts;
(function (ts) {
    describe("programNoParseFalsyFileNames", () => {
        let program;
        beforeEach(() => {
            const testSource = `
            class Foo extends HTMLElement {
                bar: string = 'baz';
            }`;
            const host = {
                getSourceFile: (fileName, languageVersion, _onError) => {
                    return fileName === "test.ts" ? ts.createSourceFile(fileName, testSource, languageVersion) : undefined;
                },
                getDefaultLibFileName: () => "",
                writeFile: (_fileName, _content) => { throw new Error("unsupported"); },
                getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
                getCanonicalFileName: fileName => ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase(),
                getNewLine: () => ts.sys.newLine,
                useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
                fileExists: fileName => fileName === "test.ts",
                readFile: fileName => fileName === "test.ts" ? testSource : undefined,
                resolveModuleNames: (_moduleNames, _containingFile) => { throw new Error("unsupported"); },
                getDirectories: _path => { throw new Error("unsupported"); },
            };
            program = ts.createProgram(["test.ts"], { module: ts.ModuleKind.ES2015 }, host);
        });
        it("should not have missing file paths", () => {
            assert(program.getSourceFiles().length === 1, "expected 'getSourceFiles' length to be 1");
            assert(program.getMissingFilePaths().length === 0, "expected 'getMissingFilePaths' length to be 0");
            assert(program.getFileProcessingDiagnostics().getDiagnostics().length === 0, "expected 'getFileProcessingDiagnostics' length to be 0");
        });
    });
})(ts || (ts = {}));
