/// <reference path="..\harness.ts" />
var ts;
(function (ts) {
    describe("hostNewLineSupport", () => {
        function testLSWithFiles(settings, files) {
            function snapFor(path) {
                if (path === "lib.d.ts") {
                    return ts.ScriptSnapshot.fromString("");
                }
                const result = ts.find(files, f => f.unitName === path);
                return result && ts.ScriptSnapshot.fromString(result.content);
            }
            const lshost = {
                getCompilationSettings: () => settings,
                getScriptFileNames: () => ts.map(files, f => f.unitName),
                getScriptVersion: () => "1",
                getScriptSnapshot: name => snapFor(name),
                getDefaultLibFileName: () => "lib.d.ts",
                getCurrentDirectory: () => "",
            };
            return ts.createLanguageService(lshost);
        }
        function verifyNewLines(content, options) {
            const ls = testLSWithFiles(options, [{
                    content,
                    fileOptions: {},
                    unitName: "input.ts"
                }]);
            const result = ls.getEmitOutput("input.ts");
            assert(!result.emitSkipped, "emit was skipped");
            assert(result.outputFiles.length === 1, "a number of files other than 1 was output");
            assert(result.outputFiles[0].name === "input.js", `Expected output file name input.js, but got ${result.outputFiles[0].name}`);
            assert(result.outputFiles[0].text.match(options.newLine === ts.NewLineKind.CarriageReturnLineFeed ? /\r\n/ : /[^\r]\n/), "expected to find appropriate newlines");
            assert(!result.outputFiles[0].text.match(options.newLine === ts.NewLineKind.CarriageReturnLineFeed ? /[^\r]\n/ : /\r\n/), "expected not to find inappropriate newlines");
        }
        function verifyBothNewLines(content) {
            verifyNewLines(content, { newLine: ts.NewLineKind.CarriageReturnLineFeed });
            verifyNewLines(content, { newLine: ts.NewLineKind.LineFeed });
        }
        it("should exist and respect provided compiler options", () => {
            verifyBothNewLines(`
                function foo() {
                    return 2 + 2;
                }
            `);
        });
    });
})(ts || (ts = {}));
