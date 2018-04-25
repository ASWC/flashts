/* @internal */
var ts;
(function (ts) {
    var codefix;
    (function (codefix) {
        const fixId = "fixSpelling";
        const errorCodes = [
            Diagnostics.Property_0_does_not_exist_on_type_1_Did_you_mean_2.code,
            Diagnostics.Cannot_find_name_0_Did_you_mean_1.code,
            Diagnostics.Module_0_has_no_exported_member_1_Did_you_mean_2.code,
        ];
        codefix.registerCodeFix({
            errorCodes,
            getCodeActions(context) {
                const { sourceFile } = context;
                const info = getInfo(sourceFile, context.span.start, context);
                if (!info)
                    return undefined;
                const { node, suggestion } = info;
                const { target } = context.host.getCompilationSettings();
                const changes = ts.textChanges.ChangeTracker.with(context, t => doChange(t, sourceFile, node, suggestion, target));
                return [codefix.createCodeFixAction("spelling", changes, [Diagnostics.Change_spelling_to_0, suggestion], fixId, Diagnostics.Fix_all_detected_spelling_errors)];
            },
            fixIds: [fixId],
            getAllCodeActions: context => codefix.codeFixAll(context, errorCodes, (changes, diag) => {
                const info = getInfo(diag.file, diag.start, context);
                const { target } = context.host.getCompilationSettings();
                if (info)
                    doChange(changes, context.sourceFile, info.node, info.suggestion, target);
            }),
        });
        function getInfo(sourceFile, pos, context) {
            // This is the identifier of the misspelled word. eg:
            // this.speling = 1;
            //      ^^^^^^^
            const node = ts.getTokenAtPosition(sourceFile, pos, /*includeJsDocComment*/ false); // TODO: GH#15852
            const checker = context.program.getTypeChecker();
            let suggestion;
            if (ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) {
                ts.Debug.assert(node.kind === ts.SyntaxKind.Identifier);
                const containingType = checker.getTypeAtLocation(node.parent.expression);
                suggestion = checker.getSuggestionForNonexistentProperty(node, containingType);
            }
            else if (ts.isImportSpecifier(node.parent) && node.parent.name === node) {
                ts.Debug.assert(node.kind === ts.SyntaxKind.Identifier);
                const importDeclaration = ts.findAncestor(node, ts.isImportDeclaration);
                const resolvedSourceFile = getResolvedSourceFileFromImportDeclaration(sourceFile, context, importDeclaration);
                if (resolvedSourceFile && resolvedSourceFile.symbol) {
                    suggestion = checker.getSuggestionForNonexistentModule(node, resolvedSourceFile.symbol);
                }
            }
            else {
                const meaning = ts.getMeaningFromLocation(node);
                const name = ts.getTextOfNode(node);
                ts.Debug.assert(name !== undefined, "name should be defined");
                suggestion = checker.getSuggestionForNonexistentSymbol(node, name, convertSemanticMeaningToSymbolFlags(meaning));
            }
            return suggestion === undefined ? undefined : { node, suggestion };
        }
        function doChange(changes, sourceFile, node, suggestion, target) {
            if (!ts.isIdentifierText(suggestion, target) && ts.isPropertyAccessExpression(node.parent)) {
                changes.replaceNode(sourceFile, node.parent, ts.createElementAccess(node.parent.expression, ts.createLiteral(suggestion)));
            }
            else {
                changes.replaceNode(sourceFile, node, ts.createIdentifier(suggestion));
            }
        }
        function convertSemanticMeaningToSymbolFlags(meaning) {
            let flags = 0;
            if (meaning & 4 /* Namespace */) {
                flags |= ts.SymbolFlags.Namespace;
            }
            if (meaning & 2 /* Type */) {
                flags |= ts.SymbolFlags.Type;
            }
            if (meaning & 1 /* Value */) {
                flags |= ts.SymbolFlags.Value;
            }
            return flags;
        }
        function getResolvedSourceFileFromImportDeclaration(sourceFile, context, importDeclaration) {
            if (!importDeclaration || !ts.isStringLiteralLike(importDeclaration.moduleSpecifier))
                return undefined;
            const resolvedModule = ts.getResolvedModule(sourceFile, importDeclaration.moduleSpecifier.text);
            if (!resolvedModule)
                return undefined;
            return context.program.getSourceFile(resolvedModule.resolvedFileName);
        }
    })(codefix = ts.codefix || (ts.codefix = {}));
})(ts || (ts = {}));
