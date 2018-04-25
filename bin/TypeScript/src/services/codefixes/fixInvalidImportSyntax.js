/* @internal */
var ts;
(function (ts) {
    var codefix;
    (function (codefix) {
        const fixName = "invalidImportSyntax";
        codefix.registerCodeFix({
            errorCodes: [Diagnostics.A_namespace_style_import_cannot_be_called_or_constructed_and_will_cause_a_failure_at_runtime.code],
            getCodeActions: getActionsForInvalidImport
        });
        function getActionsForInvalidImport(context) {
            const sourceFile = context.sourceFile;
            // This is the whole import statement, eg:
            // import * as Bluebird from 'bluebird';
            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            const node = ts.getTokenAtPosition(sourceFile, context.span.start, /*includeJsDocComment*/ false).parent;
            if (!ts.isImportDeclaration(node)) {
                // No import quick fix for import calls
                return [];
            }
            return getCodeFixesForImportDeclaration(context, node);
        }
        function getCodeFixesForImportDeclaration(context, node) {
            const sourceFile = ts.getSourceFileOfNode(node);
            const namespace = ts.getNamespaceDeclarationNode(node);
            const opts = context.program.getCompilerOptions();
            const variations = [];
            // import Bluebird from "bluebird";
            variations.push(createAction(context, sourceFile, node, codefix.makeImportDeclaration(namespace.name, /*namedImports*/ undefined, node.moduleSpecifier)));
            if (ts.getEmitModuleKind(opts) === ts.ModuleKind.CommonJS) {
                // import Bluebird = require("bluebird");
                variations.push(createAction(context, sourceFile, node, ts.createImportEqualsDeclaration(
                /*decorators*/ undefined, 
                /*modifiers*/ undefined, namespace.name, ts.createExternalModuleReference(node.moduleSpecifier))));
            }
            return variations;
        }
        function createAction(context, sourceFile, node, replacement) {
            const changes = ts.textChanges.ChangeTracker.with(context, t => t.replaceNode(sourceFile, node, replacement));
            return codefix.createCodeFixActionNoFixId("invalidImportSyntax", changes, [Diagnostics.Replace_import_with_0, changes[0].textChanges[0].newText]);
        }
        codefix.registerCodeFix({
            errorCodes: [
                Diagnostics.Cannot_invoke_an_expression_whose_type_lacks_a_call_signature_Type_0_has_no_compatible_call_signatures.code,
                Diagnostics.Cannot_use_new_with_an_expression_whose_type_lacks_a_call_or_construct_signature.code,
            ],
            getCodeActions: getActionsForUsageOfInvalidImport
        });
        function getActionsForUsageOfInvalidImport(context) {
            const sourceFile = context.sourceFile;
            const targetKind = Diagnostics.Cannot_invoke_an_expression_whose_type_lacks_a_call_signature_Type_0_has_no_compatible_call_signatures.code === context.errorCode ? ts.SyntaxKind.CallExpression : ts.SyntaxKind.NewExpression;
            const node = ts.findAncestor(ts.getTokenAtPosition(sourceFile, context.span.start, /*includeJsDocComment*/ false), a => a.kind === targetKind && a.getStart() === context.span.start && a.getEnd() === (context.span.start + context.span.length));
            if (!node) {
                return [];
            }
            const expr = node.expression;
            const type = context.program.getTypeChecker().getTypeAtLocation(expr);
            if (!(type.symbol && type.symbol.originatingImport)) {
                return [];
            }
            const fixes = [];
            const relatedImport = type.symbol.originatingImport;
            if (!ts.isImportCall(relatedImport)) {
                ts.addRange(fixes, getCodeFixesForImportDeclaration(context, relatedImport));
            }
            const changes = ts.textChanges.ChangeTracker.with(context, t => t.replaceNode(sourceFile, expr, ts.createPropertyAccess(expr, "default"), {}));
            fixes.push(codefix.createCodeFixActionNoFixId(fixName, changes, Diagnostics.Use_synthetic_default_member));
            return fixes;
        }
    })(codefix = ts.codefix || (ts.codefix = {}));
})(ts || (ts = {}));
