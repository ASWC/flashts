/// <reference path="..\harness.ts" />
/// <reference path="tsserverProjectSystem.ts" />
var ts;
(function (ts) {
    function extractTest(source) {
        const activeRanges = [];
        let text = "";
        let lastPos = 0;
        let pos = 0;
        const ranges = ts.createMap();
        while (pos < source.length) {
            if (source.charCodeAt(pos) === 91 /* openBracket */ &&
                (source.charCodeAt(pos + 1) === 35 /* hash */ || source.charCodeAt(pos + 1) === 36 /* $ */)) {
                const saved = pos;
                pos += 2;
                const s = pos;
                consumeIdentifier();
                const e = pos;
                if (source.charCodeAt(pos) === 124 /* bar */) {
                    pos++;
                    text += source.substring(lastPos, saved);
                    const name = s === e
                        ? source.charCodeAt(saved + 1) === 35 /* hash */ ? "selection" : "extracted"
                        : source.substring(s, e);
                    activeRanges.push({ name, pos: text.length, end: undefined });
                    lastPos = pos;
                    continue;
                }
                else {
                    pos = saved;
                }
            }
            else if (source.charCodeAt(pos) === 124 /* bar */ && source.charCodeAt(pos + 1) === 93 /* closeBracket */) {
                text += source.substring(lastPos, pos);
                activeRanges[activeRanges.length - 1].end = text.length;
                const range = activeRanges.pop();
                if (range.name in ranges) {
                    throw new Error(`Duplicate name of range ${range.name}`);
                }
                ranges.set(range.name, range);
                pos += 2;
                lastPos = pos;
                continue;
            }
            pos++;
        }
        text += source.substring(lastPos, pos);
        function consumeIdentifier() {
            while (ts.isIdentifierPart(source.charCodeAt(pos), ts.ScriptTarget.Latest)) {
                pos++;
            }
        }
        return { source: text, ranges };
    }
    ts.extractTest = extractTest;
    ts.newLineCharacter = "\n";
    ts.testFormatOptions = {
        indentSize: 4,
        tabSize: 4,
        newLineCharacter: ts.newLineCharacter,
        convertTabsToSpaces: true,
        indentStyle: ts.IndentStyle.Smart,
        insertSpaceAfterConstructor: false,
        insertSpaceAfterCommaDelimiter: true,
        insertSpaceAfterSemicolonInForStatements: true,
        insertSpaceBeforeAndAfterBinaryOperators: true,
        insertSpaceAfterKeywordsInControlFlowStatements: true,
        insertSpaceAfterFunctionKeywordForAnonymousFunctions: false,
        insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis: false,
        insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets: false,
        insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true,
        insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: false,
        insertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces: false,
        insertSpaceBeforeFunctionParenthesis: false,
        placeOpenBraceOnNewLineForFunctions: false,
        placeOpenBraceOnNewLineForControlBlocks: false,
    };
    const notImplementedHost = {
        getCompilationSettings: ts.notImplemented,
        getScriptFileNames: ts.notImplemented,
        getScriptVersion: ts.notImplemented,
        getScriptSnapshot: ts.notImplemented,
        getDefaultLibFileName: ts.notImplemented,
        getCurrentDirectory: ts.notImplemented,
    };
    function testExtractSymbol(caption, text, baselineFolder, description, includeLib) {
        const t = extractTest(text);
        const selectionRange = t.ranges.get("selection");
        if (!selectionRange) {
            throw new Error(`Test ${caption} does not specify selection range`);
        }
        [ts.Extension.Ts, ts.Extension.Js].forEach(extension => it(`${caption} [${extension}]`, () => runBaseline(extension)));
        function runBaseline(extension) {
            const path = "/a" + extension;
            const program = makeProgram({ path, content: t.source }, includeLib);
            if (hasSyntacticDiagnostics(program)) {
                // Don't bother generating JS baselines for inputs that aren't valid JS.
                assert.equal(ts.Extension.Js, extension, "Syntactic diagnostics found in non-JS file");
                return;
            }
            const sourceFile = program.getSourceFile(path);
            const context = {
                cancellationToken: { throwIfCancellationRequested: ts.noop, isCancellationRequested: ts.returnFalse },
                program,
                file: sourceFile,
                startPosition: selectionRange.pos,
                endPosition: selectionRange.end,
                host: notImplementedHost,
                formatContext: ts.formatting.getFormatContext(ts.testFormatOptions),
                preferences: ts.defaultPreferences,
            };
            const rangeToExtract = ts.refactor.extractSymbol.getRangeToExtract(sourceFile, ts.createTextSpanFromRange(selectionRange));
            assert.equal(rangeToExtract.errors, undefined, rangeToExtract.errors && "Range error: " + rangeToExtract.errors[0].messageText);
            const infos = ts.refactor.extractSymbol.getAvailableActions(context);
            const actions = ts.find(infos, info => info.description === description.message).actions;
            Harness.Baseline.runBaseline(`${baselineFolder}/${caption}${extension}`, () => {
                const data = [];
                data.push(`// ==ORIGINAL==`);
                data.push(text.replace("[#|", "/*[#|*/").replace("|]", "/*|]*/"));
                for (const action of actions) {
                    const { renameLocation, edits } = ts.refactor.extractSymbol.getEditsForAction(context, action.name);
                    assert.lengthOf(edits, 1);
                    data.push(`// ==SCOPE::${action.description}==`);
                    const newText = ts.textChanges.applyChanges(sourceFile.text, edits[0].textChanges);
                    const newTextWithRename = newText.slice(0, renameLocation) + "/*RENAME*/" + newText.slice(renameLocation);
                    data.push(newTextWithRename);
                    const diagProgram = makeProgram({ path, content: newText }, includeLib);
                    assert.isFalse(hasSyntacticDiagnostics(diagProgram));
                }
                return data.join(ts.newLineCharacter);
            });
        }
        function makeProgram(f, includeLib) {
            const host = ts.projectSystem.createServerHost(includeLib ? [f, ts.projectSystem.libFile] : [f]); // libFile is expensive to parse repeatedly - only test when required
            const projectService = ts.projectSystem.createProjectService(host);
            projectService.openClientFile(f.path);
            const program = projectService.inferredProjects[0].getLanguageService().getProgram();
            return program;
        }
        function hasSyntacticDiagnostics(program) {
            const diags = program.getSyntacticDiagnostics();
            return ts.length(diags) > 0;
        }
    }
    ts.testExtractSymbol = testExtractSymbol;
    function testExtractSymbolFailed(caption, text, description) {
        it(caption, () => {
            const t = extractTest(text);
            const selectionRange = t.ranges.get("selection");
            if (!selectionRange) {
                throw new Error(`Test ${caption} does not specify selection range`);
            }
            const f = {
                path: "/a.ts",
                content: t.source
            };
            const host = ts.projectSystem.createServerHost([f, ts.projectSystem.libFile]);
            const projectService = ts.projectSystem.createProjectService(host);
            projectService.openClientFile(f.path);
            const program = projectService.inferredProjects[0].getLanguageService().getProgram();
            const sourceFile = program.getSourceFile(f.path);
            const context = {
                cancellationToken: { throwIfCancellationRequested: ts.noop, isCancellationRequested: ts.returnFalse },
                program,
                file: sourceFile,
                startPosition: selectionRange.pos,
                endPosition: selectionRange.end,
                host: notImplementedHost,
                formatContext: ts.formatting.getFormatContext(ts.testFormatOptions),
                preferences: ts.defaultPreferences,
            };
            const rangeToExtract = ts.refactor.extractSymbol.getRangeToExtract(sourceFile, ts.createTextSpanFromRange(selectionRange));
            assert.isUndefined(rangeToExtract.errors, rangeToExtract.errors && "Range error: " + rangeToExtract.errors[0].messageText);
            const infos = ts.refactor.extractSymbol.getAvailableActions(context);
            assert.isUndefined(ts.find(infos, info => info.description === description.message));
        });
    }
    ts.testExtractSymbolFailed = testExtractSymbolFailed;
})(ts || (ts = {}));
