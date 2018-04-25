/* @internal */
var ts;
(function (ts) {
    var codefix;
    (function (codefix) {
        const fixId = "addMissingInvocationForDecorator";
        const errorCodes = [Diagnostics._0_accepts_too_few_arguments_to_be_used_as_a_decorator_here_Did_you_mean_to_call_it_first_and_write_0.code];
        codefix.registerCodeFix({
            errorCodes,
            getCodeActions: (context) => {
                const changes = ts.textChanges.ChangeTracker.with(context, t => makeChange(t, context.sourceFile, context.span.start));
                return [codefix.createCodeFixAction(fixId, changes, Diagnostics.Call_decorator_expression, fixId, Diagnostics.Add_to_all_uncalled_decorators)];
            },
            fixIds: [fixId],
            getAllCodeActions: context => codefix.codeFixAll(context, errorCodes, (changes, diag) => makeChange(changes, diag.file, diag.start)),
        });
        function makeChange(changeTracker, sourceFile, pos) {
            const token = ts.getTokenAtPosition(sourceFile, pos, /*includeJsDocComment*/ false);
            const decorator = ts.findAncestor(token, ts.isDecorator);
            ts.Debug.assert(!!decorator, "Expected position to be owned by a decorator.");
            const replacement = ts.createCall(decorator.expression, /*typeArguments*/ undefined, /*argumentsArray*/ undefined);
            changeTracker.replaceNode(sourceFile, decorator.expression, replacement);
        }
    })(codefix = ts.codefix || (ts.codefix = {}));
})(ts || (ts = {}));
