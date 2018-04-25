/* @internal */
var ts;
(function (ts) {
    function computeSuggestionDiagnostics(sourceFile, program) {
        program.getSemanticDiagnostics(sourceFile);
        const checker = program.getDiagnosticsProducingTypeChecker();
        const diags = [];
        if (sourceFile.commonJsModuleIndicator && (ts.programContainsEs6Modules(program) || ts.compilerOptionsIndicateEs6Modules(program.getCompilerOptions()))) {
            diags.push(ts.createDiagnosticForNode(getErrorNodeFromCommonJsIndicator(sourceFile.commonJsModuleIndicator), Diagnostics.File_is_a_CommonJS_module_it_may_be_converted_to_an_ES6_module));
        }
        const isJsFile = ts.isSourceFileJavaScript(sourceFile);
        function check(node) {
            switch (node.kind) {
                case ts.SyntaxKind.FunctionDeclaration:
                case ts.SyntaxKind.FunctionExpression:
                    if (isJsFile) {
                        const symbol = node.symbol;
                        if (symbol.members && (symbol.members.size > 0)) {
                            diags.push(ts.createDiagnosticForNode(ts.isVariableDeclaration(node.parent) ? node.parent.name : node, Diagnostics.This_constructor_function_may_be_converted_to_a_class_declaration));
                        }
                    }
                    break;
            }
            if (!isJsFile && ts.codefix.parameterShouldGetTypeFromJSDoc(node)) {
                diags.push(ts.createDiagnosticForNode(node.name || node, Diagnostics.JSDoc_types_may_be_moved_to_TypeScript_types));
            }
            node.forEachChild(check);
        }
        check(sourceFile);
        if (ts.getAllowSyntheticDefaultImports(program.getCompilerOptions())) {
            for (const moduleSpecifier of sourceFile.imports) {
                const importNode = ts.importFromModuleSpecifier(moduleSpecifier);
                const name = importNameForConvertToDefaultImport(importNode);
                if (!name)
                    continue;
                const module = ts.getResolvedModule(sourceFile, moduleSpecifier.text);
                const resolvedFile = module && program.getSourceFile(module.resolvedFileName);
                if (resolvedFile && resolvedFile.externalModuleIndicator && ts.isExportAssignment(resolvedFile.externalModuleIndicator) && resolvedFile.externalModuleIndicator.isExportEquals) {
                    diags.push(ts.createDiagnosticForNode(name, Diagnostics.Import_may_be_converted_to_a_default_import));
                }
            }
        }
        return diags.concat(checker.getSuggestionDiagnostics(sourceFile));
    }
    ts.computeSuggestionDiagnostics = computeSuggestionDiagnostics;
    function importNameForConvertToDefaultImport(node) {
        switch (node.kind) {
            case ts.SyntaxKind.ImportDeclaration:
                const { importClause, moduleSpecifier } = node;
                return importClause && !importClause.name && importClause.namedBindings.kind === ts.SyntaxKind.NamespaceImport && ts.isStringLiteral(moduleSpecifier)
                    ? importClause.namedBindings.name
                    : undefined;
            case ts.SyntaxKind.ImportEqualsDeclaration:
                return node.name;
            default:
                return undefined;
        }
    }
    function getErrorNodeFromCommonJsIndicator(commonJsModuleIndicator) {
        return ts.isBinaryExpression(commonJsModuleIndicator) ? commonJsModuleIndicator.left : commonJsModuleIndicator;
    }
})(ts || (ts = {}));
