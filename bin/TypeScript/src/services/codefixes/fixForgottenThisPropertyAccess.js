/* @internal */
var ts;
(function (ts) {
    var codefix;
    (function (codefix) {
        const fixId = "forgottenThisPropertyAccess";
        const didYouMeanStaticMemberCode = Diagnostics.Cannot_find_name_0_Did_you_mean_the_static_member_1_0.code;
        const errorCodes = [
            Diagnostics.Cannot_find_name_0_Did_you_mean_the_instance_member_this_0.code,
            didYouMeanStaticMemberCode,
        ];
        codefix.registerCodeFix({
            errorCodes,
            getCodeActions(context) {
                const { sourceFile } = context;
                const info = getInfo(sourceFile, context.span.start, context.errorCode);
                if (!info) {
                    return undefined;
                }
                const changes = ts.textChanges.ChangeTracker.with(context, t => doChange(t, sourceFile, info));
                return [codefix.createCodeFixAction(fixId, changes, [Diagnostics.Add_0_to_unresolved_variable, info.className || "this"], fixId, Diagnostics.Add_qualifier_to_all_unresolved_variables_matching_a_member_name)];
            },
            fixIds: [fixId],
            getAllCodeActions: context => codefix.codeFixAll(context, errorCodes, (changes, diag) => {
                doChange(changes, context.sourceFile, getInfo(diag.file, diag.start, diag.code));
            }),
        });
        function getInfo(sourceFile, pos, diagCode) {
            const node = ts.getTokenAtPosition(sourceFile, pos, /*includeJsDocComment*/ false);
            if (!ts.isIdentifier(node))
                return undefined;
            return { node, className: diagCode === didYouMeanStaticMemberCode ? ts.getContainingClass(node).name.text : undefined };
        }
        function doChange(changes, sourceFile, { node, className }) {
            // TODO (https://github.com/Microsoft/TypeScript/issues/21246): use shared helper
            ts.suppressLeadingAndTrailingTrivia(node);
            changes.replaceNode(sourceFile, node, ts.createPropertyAccess(className ? ts.createIdentifier(className) : ts.createThis(), node));
        }
    })(codefix = ts.codefix || (ts.codefix = {}));
})(ts || (ts = {}));
