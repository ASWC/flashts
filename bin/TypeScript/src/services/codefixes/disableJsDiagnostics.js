/* @internal */
var ts;
(function (ts) {
    var codefix;
    (function (codefix) {
        const fixName = "disableJsDiagnostics";
        const fixId = "disableJsDiagnostics";
        const errorCodes = ts.mapDefined(Object.keys(Diagnostics), key => {
            const diag = Diagnostics[key];
            return diag.category === ts.DiagnosticCategory.Error ? diag.code : undefined;
        });
        codefix.registerCodeFix({
            errorCodes,
            getCodeActions(context) {
                const { sourceFile, program, span, host, formatContext } = context;
                if (!ts.isInJavaScriptFile(sourceFile) || !ts.isCheckJsEnabledForFile(sourceFile, program.getCompilerOptions())) {
                    return undefined;
                }
                const fixes = [
                    // fixId unnecessary because adding `// @ts-nocheck` even once will ignore every error in the file.
                    codefix.createCodeFixActionNoFixId(fixName, [codefix.createFileTextChanges(sourceFile.fileName, [
                            ts.createTextChange(sourceFile.checkJsDirective
                                ? ts.createTextSpanFromBounds(sourceFile.checkJsDirective.pos, sourceFile.checkJsDirective.end)
                                : ts.createTextSpan(0, 0), `// @ts-nocheck${ts.getNewLineOrDefaultFromHost(host, formatContext.options)}`),
                        ])], Diagnostics.Disable_checking_for_this_file),
                ];
                if (ts.textChanges.isValidLocationToAddComment(sourceFile, span.start)) {
                    fixes.unshift(codefix.createCodeFixAction(fixName, ts.textChanges.ChangeTracker.with(context, t => makeChange(t, sourceFile, span.start)), Diagnostics.Ignore_this_error_message, fixId, Diagnostics.Add_ts_ignore_to_all_error_messages));
                }
                return fixes;
            },
            fixIds: [fixId],
            getAllCodeActions: context => {
                const seenLines = ts.createMap();
                return codefix.codeFixAll(context, errorCodes, (changes, diag) => {
                    if (ts.textChanges.isValidLocationToAddComment(diag.file, diag.start)) {
                        makeChange(changes, diag.file, diag.start, seenLines);
                    }
                });
            },
        });
        function makeChange(changes, sourceFile, position, seenLines) {
            const { line: lineNumber } = ts.getLineAndCharacterOfPosition(sourceFile, position);
            // Only need to add `// @ts-ignore` for a line once.
            if (!seenLines || ts.addToSeen(seenLines, lineNumber)) {
                changes.insertCommentBeforeLine(sourceFile, lineNumber, position, " @ts-ignore");
            }
        }
    })(codefix = ts.codefix || (ts.codefix = {}));
})(ts || (ts = {}));