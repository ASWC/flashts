/* @internal */
var ts;
(function (ts) {
    let codefix;
    (function (codefix) {
        const errorCodeToFixes = ts.createMultiMap();
        const fixIdToRegistration = ts.createMap();
        function diagnosticToString(diag) {
            return ts.isArray(diag)
                ? ts.formatStringFromArgs(ts.getLocaleSpecificMessage(diag[0]), diag.slice(1))
                : ts.getLocaleSpecificMessage(diag);
        }
        function createCodeFixActionNoFixId(fixName, changes, description) {
            return createCodeFixActionWorker(fixName, diagnosticToString(description), changes, /*fixId*/ undefined, /*fixAllDescription*/ undefined);
        }
        codefix.createCodeFixActionNoFixId = createCodeFixActionNoFixId;
        function createCodeFixAction(fixName, changes, description, fixId, fixAllDescription, command) {
            return createCodeFixActionWorker(fixName, diagnosticToString(description), changes, fixId, diagnosticToString(fixAllDescription), command);
        }
        codefix.createCodeFixAction = createCodeFixAction;
        function createCodeFixActionWorker(fixName, description, changes, fixId, fixAllDescription, command) {
            return { fixName, description, changes, fixId, fixAllDescription, commands: command ? [command] : undefined };
        }
        function registerCodeFix(reg) {
            for (const error of reg.errorCodes) {
                errorCodeToFixes.add(String(error), reg);
            }
            if (reg.fixIds) {
                for (const fixId of reg.fixIds) {
                    ts.Debug.assert(!fixIdToRegistration.has(fixId));
                    fixIdToRegistration.set(fixId, reg);
                }
            }
        }
        codefix.registerCodeFix = registerCodeFix;
        function getSupportedErrorCodes() {
            return ts.arrayFrom(errorCodeToFixes.keys());
        }
        codefix.getSupportedErrorCodes = getSupportedErrorCodes;
        function getFixes(context) {
            return ts.flatMap(errorCodeToFixes.get(String(context.errorCode)) || ts.emptyArray, f => f.getCodeActions(context));
        }
        codefix.getFixes = getFixes;
        function getAllFixes(context) {
            // Currently fixId is always a string.
            return fixIdToRegistration.get(ts.cast(context.fixId, ts.isString)).getAllCodeActions(context);
        }
        codefix.getAllFixes = getAllFixes;
        function createCombinedCodeActions(changes, commands) {
            return { changes, commands };
        }
        function createFileTextChanges(fileName, textChanges) {
            return { fileName, textChanges };
        }
        codefix.createFileTextChanges = createFileTextChanges;
        function codeFixAll(context, errorCodes, use) {
            const commands = [];
            const changes = ts.textChanges.ChangeTracker.with(context, t => eachDiagnostic(context, errorCodes, diag => use(t, diag, commands)));
            return createCombinedCodeActions(changes, commands.length === 0 ? undefined : commands);
        }
        codefix.codeFixAll = codeFixAll;
        function eachDiagnostic({ program, sourceFile }, errorCodes, cb) {
            for (const diag of program.getSemanticDiagnostics(sourceFile).concat(ts.computeSuggestionDiagnostics(sourceFile, program))) {
                if (ts.contains(errorCodes, diag.code)) {
                    cb(diag);
                }
            }
        }
    })(codefix = ts.codefix || (ts.codefix = {}));
})(ts || (ts = {}));
