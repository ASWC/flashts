/*@internal*/
var ts;
(function (ts) {
    function transformES2015Module(context) {
        const compilerOptions = context.getCompilerOptions();
        const previousOnEmitNode = context.onEmitNode;
        const previousOnSubstituteNode = context.onSubstituteNode;
        context.onEmitNode = onEmitNode;
        context.onSubstituteNode = onSubstituteNode;
        context.enableEmitNotification(ts.SyntaxKind.SourceFile);
        context.enableSubstitution(ts.SyntaxKind.Identifier);
        let currentSourceFile;
        return transformSourceFile;
        function transformSourceFile(node) {
            if (node.isDeclarationFile) {
                return node;
            }
            if (ts.isExternalModule(node) || compilerOptions.isolatedModules) {
                const externalHelpersModuleName = ts.getOrCreateExternalHelpersModuleNameIfNeeded(node, compilerOptions);
                if (externalHelpersModuleName) {
                    const statements = [];
                    const statementOffset = ts.addPrologue(statements, node.statements);
                    const tslibImport = ts.createImportDeclaration(
                    /*decorators*/ undefined, 
                    /*modifiers*/ undefined, ts.createImportClause(/*name*/ undefined, ts.createNamespaceImport(externalHelpersModuleName)), ts.createLiteral(ts.externalHelpersModuleNameText));
                    ts.addEmitFlags(tslibImport, ts.EmitFlags.NeverApplyImportHelper);
                    ts.append(statements, tslibImport);
                    ts.addRange(statements, ts.visitNodes(node.statements, visitor, ts.isStatement, statementOffset));
                    return ts.updateSourceFileNode(node, ts.setTextRange(ts.createNodeArray(statements), node.statements));
                }
                else {
                    return ts.visitEachChild(node, visitor, context);
                }
            }
            return node;
        }
        function visitor(node) {
            switch (node.kind) {
                case ts.SyntaxKind.ImportEqualsDeclaration:
                    // Elide `import=` as it is not legal with --module ES6
                    return undefined;
                case ts.SyntaxKind.ExportAssignment:
                    return visitExportAssignment(node);
            }
            return node;
        }
        function visitExportAssignment(node) {
            // Elide `export=` as it is not legal with --module ES6
            return node.isExportEquals ? undefined : node;
        }
        //
        // Emit Notification
        //
        /**
         * Hook for node emit.
         *
         * @param hint A hint as to the intended usage of the node.
         * @param node The node to emit.
         * @param emit A callback used to emit the node in the printer.
         */
        function onEmitNode(hint, node, emitCallback) {
            if (ts.isSourceFile(node)) {
                currentSourceFile = node;
                previousOnEmitNode(hint, node, emitCallback);
                currentSourceFile = undefined;
            }
            else {
                previousOnEmitNode(hint, node, emitCallback);
            }
        }
        //
        // Substitutions
        //
        /**
         * Hooks node substitutions.
         *
         * @param hint A hint as to the intended usage of the node.
         * @param node The node to substitute.
         */
        function onSubstituteNode(hint, node) {
            node = previousOnSubstituteNode(hint, node);
            if (ts.isIdentifier(node) && hint === ts.EmitHint.Expression) {
                return substituteExpressionIdentifier(node);
            }
            return node;
        }
        function substituteExpressionIdentifier(node) {
            if (ts.getEmitFlags(node) & ts.EmitFlags.HelperName) {
                const externalHelpersModuleName = ts.getExternalHelpersModuleName(currentSourceFile);
                if (externalHelpersModuleName) {
                    return ts.createPropertyAccess(externalHelpersModuleName, node);
                }
            }
            return node;
        }
    }
    ts.transformES2015Module = transformES2015Module;
})(ts || (ts = {}));
