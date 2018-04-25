/// <reference path="..\harness.ts" />
var ts;
(function (ts) {
    function verifyMissingFilePaths(missingPaths, expected) {
        assert.isDefined(missingPaths);
        const map = ts.arrayToSet(expected);
        for (const missing of missingPaths) {
            const value = map.get(missing);
            assert.isTrue(value, `${missing} to be ${value === undefined ? "not present" : "present only once"}, in actual: ${missingPaths} expected: ${expected}`);
            map.set(missing, false);
        }
        const notFound = ts.arrayFrom(ts.mapDefinedIterator(map.keys(), k => map.get(k) === true ? k : undefined));
        assert.equal(notFound.length, 0, `Not found ${notFound} in actual: ${missingPaths} expected: ${expected}`);
    }
    describe("Program.getMissingFilePaths", () => {
        const options = {
            noLib: true,
        };
        const emptyFileName = "empty.ts";
        const emptyFileRelativePath = "./" + emptyFileName;
        const emptyFile = {
            unitName: emptyFileName,
            content: ""
        };
        const referenceFileName = "reference.ts";
        const referenceFileRelativePath = "./" + referenceFileName;
        const referenceFile = {
            unitName: referenceFileName,
            content: "/// <reference path=\"d:/imaginary/nonexistent1.ts\"/>\n" + // Absolute
                "/// <reference path=\"./nonexistent2.ts\"/>\n" + // Relative
                "/// <reference path=\"nonexistent3.ts\"/>\n" + // Unqualified
                "/// <reference path=\"nonexistent4\"/>\n" // No extension
        };
        const testCompilerHost = Harness.Compiler.createCompilerHost(
        /*inputFiles*/ [emptyFile, referenceFile], 
        /*writeFile*/ undefined, 
        /*scriptTarget*/ undefined, 
        /*useCaseSensitiveFileNames*/ false, 
        /*currentDirectory*/ "d:\\pretend\\", 
        /*newLineKind*/ ts.NewLineKind.LineFeed, 
        /*libFiles*/ undefined);
        it("handles no missing root files", () => {
            const program = ts.createProgram([emptyFileRelativePath], options, testCompilerHost);
            const missing = program.getMissingFilePaths();
            verifyMissingFilePaths(missing, []);
        });
        it("handles missing root file", () => {
            const program = ts.createProgram(["./nonexistent.ts"], options, testCompilerHost);
            const missing = program.getMissingFilePaths();
            verifyMissingFilePaths(missing, ["d:/pretend/nonexistent.ts"]); // Absolute path
        });
        it("handles multiple missing root files", () => {
            const program = ts.createProgram(["./nonexistent0.ts", "./nonexistent1.ts"], options, testCompilerHost);
            const missing = program.getMissingFilePaths();
            verifyMissingFilePaths(missing, ["d:/pretend/nonexistent0.ts", "d:/pretend/nonexistent1.ts"]);
        });
        it("handles a mix of present and missing root files", () => {
            const program = ts.createProgram(["./nonexistent0.ts", emptyFileRelativePath, "./nonexistent1.ts"], options, testCompilerHost);
            const missing = program.getMissingFilePaths();
            verifyMissingFilePaths(missing, ["d:/pretend/nonexistent0.ts", "d:/pretend/nonexistent1.ts"]);
        });
        it("handles repeatedly specified root files", () => {
            const program = ts.createProgram(["./nonexistent.ts", "./nonexistent.ts"], options, testCompilerHost);
            const missing = program.getMissingFilePaths();
            verifyMissingFilePaths(missing, ["d:/pretend/nonexistent.ts"]);
        });
        it("normalizes file paths", () => {
            const program0 = ts.createProgram(["./nonexistent.ts", "./NONEXISTENT.ts"], options, testCompilerHost);
            const program1 = ts.createProgram(["./NONEXISTENT.ts", "./nonexistent.ts"], options, testCompilerHost);
            const missing0 = program0.getMissingFilePaths();
            const missing1 = program1.getMissingFilePaths();
            assert.equal(missing0.length, 1);
            assert.deepEqual(missing0, missing1);
        });
        it("handles missing triple slash references", () => {
            const program = ts.createProgram([referenceFileRelativePath], options, testCompilerHost);
            const missing = program.getMissingFilePaths();
            verifyMissingFilePaths(missing, [
                // From absolute reference
                "d:/imaginary/nonexistent1.ts",
                // From relative reference
                "d:/pretend/nonexistent2.ts",
                // From unqualified reference
                "d:/pretend/nonexistent3.ts",
                // From no-extension reference
                "d:/pretend/nonexistent4.d.ts",
                "d:/pretend/nonexistent4.ts",
                "d:/pretend/nonexistent4.tsx"
            ]);
        });
    });
})(ts || (ts = {}));
