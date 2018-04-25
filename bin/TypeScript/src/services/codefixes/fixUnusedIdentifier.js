/* @internal */
var ts;
(function (ts) {
    var codefix;
    (function (codefix) {
        const fixName = "unusedIdentifier";
        const fixIdPrefix = "unusedIdentifier_prefix";
        const fixIdDelete = "unusedIdentifier_delete";
        const errorCodes = [
            Diagnostics._0_is_declared_but_its_value_is_never_read.code,
            Diagnostics.Property_0_is_declared_but_its_value_is_never_read.code,
            Diagnostics.All_imports_in_import_declaration_are_unused.code,
        ];
        codefix.registerCodeFix({
            errorCodes,
            getCodeActions(context) {
                const { errorCode, sourceFile } = context;
                const importDecl = tryGetFullImport(sourceFile, context.span.start);
                if (importDecl) {
                    const changes = ts.textChanges.ChangeTracker.with(context, t => t.deleteNode(sourceFile, importDecl));
                    return [codefix.createCodeFixAction(fixName, changes, [Diagnostics.Remove_import_from_0, ts.showModuleSpecifier(importDecl)], fixIdDelete, Diagnostics.Delete_all_unused_declarations)];
                }
                const token = getToken(sourceFile, ts.textSpanEnd(context.span));
                const result = [];
                const deletion = ts.textChanges.ChangeTracker.with(context, t => tryDeleteDeclaration(t, sourceFile, token));
                if (deletion.length) {
                    result.push(codefix.createCodeFixAction(fixName, deletion, [Diagnostics.Remove_declaration_for_Colon_0, token.getText(sourceFile)], fixIdDelete, Diagnostics.Delete_all_unused_declarations));
                }
                const prefix = ts.textChanges.ChangeTracker.with(context, t => tryPrefixDeclaration(t, errorCode, sourceFile, token));
                if (prefix.length) {
                    result.push(codefix.createCodeFixAction(fixName, prefix, [Diagnostics.Prefix_0_with_an_underscore, token.getText(sourceFile)], fixIdPrefix, Diagnostics.Prefix_all_unused_declarations_with_where_possible));
                }
                return result;
            },
            fixIds: [fixIdPrefix, fixIdDelete],
            getAllCodeActions: context => codefix.codeFixAll(context, errorCodes, (changes, diag) => {
                const { sourceFile } = context;
                const token = ts.findPrecedingToken(ts.textSpanEnd(diag), diag.file);
                switch (context.fixId) {
                    case fixIdPrefix:
                        if (ts.isIdentifier(token) && canPrefix(token)) {
                            tryPrefixDeclaration(changes, diag.code, sourceFile, token);
                        }
                        break;
                    case fixIdDelete:
                        const importDecl = tryGetFullImport(diag.file, diag.start);
                        if (importDecl) {
                            changes.deleteNode(sourceFile, importDecl);
                        }
                        else {
                            tryDeleteDeclaration(changes, sourceFile, token);
                        }
                        break;
                    default:
                        ts.Debug.fail(JSON.stringify(context.fixId));
                }
            }),
        });
        // Sometimes the diagnostic span is an entire ImportDeclaration, so we should remove the whole thing.
        function tryGetFullImport(sourceFile, pos) {
            const startToken = ts.getTokenAtPosition(sourceFile, pos, /*includeJsDocComment*/ false);
            return startToken.kind === ts.SyntaxKind.ImportKeyword ? ts.tryCast(startToken.parent, ts.isImportDeclaration) : undefined;
        }
        function getToken(sourceFile, pos) {
            const token = ts.findPrecedingToken(pos, sourceFile);
            // this handles var ["computed"] = 12;
            return token.kind === ts.SyntaxKind.CloseBracketToken ? ts.findPrecedingToken(pos - 1, sourceFile) : token;
        }
        function tryPrefixDeclaration(changes, errorCode, sourceFile, token) {
            // Don't offer to prefix a property.
            if (errorCode !== Diagnostics.Property_0_is_declared_but_its_value_is_never_read.code && ts.isIdentifier(token) && canPrefix(token)) {
                changes.replaceNode(sourceFile, token, ts.createIdentifier(`_${token.text}`));
            }
        }
        function canPrefix(token) {
            switch (token.parent.kind) {
                case ts.SyntaxKind.Parameter:
                    return true;
                case ts.SyntaxKind.VariableDeclaration: {
                    const varDecl = token.parent;
                    switch (varDecl.parent.parent.kind) {
                        case ts.SyntaxKind.ForOfStatement:
                        case ts.SyntaxKind.ForInStatement:
                            return true;
                    }
                }
            }
            return false;
        }
        function tryDeleteDeclaration(changes, sourceFile, token) {
            switch (token.kind) {
                case ts.SyntaxKind.Identifier:
                    tryDeleteIdentifier(changes, sourceFile, token);
                    break;
                case ts.SyntaxKind.PropertyDeclaration:
                case ts.SyntaxKind.NamespaceImport:
                    changes.deleteNode(sourceFile, token.parent);
                    break;
                default:
                    tryDeleteDefault(changes, sourceFile, token);
            }
        }
        function tryDeleteDefault(changes, sourceFile, token) {
            if (ts.isDeclarationName(token)) {
                changes.deleteNode(sourceFile, token.parent);
            }
            else if (ts.isLiteralComputedPropertyDeclarationName(token)) {
                changes.deleteNode(sourceFile, token.parent.parent);
            }
        }
        function tryDeleteIdentifier(changes, sourceFile, identifier) {
            const parent = identifier.parent;
            switch (parent.kind) {
                case ts.SyntaxKind.VariableDeclaration:
                    tryDeleteVariableDeclaration(changes, sourceFile, parent);
                    break;
                case ts.SyntaxKind.TypeParameter:
                    const typeParameters = parent.parent.typeParameters;
                    if (typeParameters.length === 1) {
                        const previousToken = ts.getTokenAtPosition(sourceFile, typeParameters.pos - 1, /*includeJsDocComment*/ false);
                        const nextToken = ts.getTokenAtPosition(sourceFile, typeParameters.end, /*includeJsDocComment*/ false);
                        ts.Debug.assert(previousToken.kind === ts.SyntaxKind.LessThanToken);
                        ts.Debug.assert(nextToken.kind === ts.SyntaxKind.GreaterThanToken);
                        changes.deleteNodeRange(sourceFile, previousToken, nextToken);
                    }
                    else {
                        changes.deleteNodeInList(sourceFile, parent);
                    }
                    break;
                case ts.SyntaxKind.Parameter:
                    const oldFunction = parent.parent;
                    if (ts.isSetAccessor(oldFunction)) {
                        // Setter must have a parameter
                        break;
                    }
                    if (ts.isArrowFunction(oldFunction) && oldFunction.parameters.length === 1) {
                        // Lambdas with exactly one parameter are special because, after removal, there
                        // must be an empty parameter list (i.e. `()`) and this won't necessarily be the
                        // case if the parameter is simply removed (e.g. in `x => 1`).
                        const newFunction = ts.updateArrowFunction(oldFunction, oldFunction.modifiers, oldFunction.typeParameters, 
                        /*parameters*/ undefined, oldFunction.type, oldFunction.equalsGreaterThanToken, oldFunction.body);
                        // Drop leading and trailing trivia of the new function because we're only going
                        // to replace the span (vs the full span) of the old function - the old leading
                        // and trailing trivia will remain.
                        ts.suppressLeadingAndTrailingTrivia(newFunction);
                        changes.replaceNode(sourceFile, oldFunction, newFunction);
                    }
                    else {
                        changes.deleteNodeInList(sourceFile, parent);
                    }
                    break;
                // handle case where 'import a = A;'
                case ts.SyntaxKind.ImportEqualsDeclaration:
                    const importEquals = ts.getAncestor(identifier, ts.SyntaxKind.ImportEqualsDeclaration);
                    changes.deleteNode(sourceFile, importEquals);
                    break;
                case ts.SyntaxKind.ImportSpecifier:
                    const namedImports = parent.parent;
                    if (namedImports.elements.length === 1) {
                        tryDeleteNamedImportBinding(changes, sourceFile, namedImports);
                    }
                    else {
                        // delete import specifier
                        changes.deleteNodeInList(sourceFile, parent);
                    }
                    break;
                case ts.SyntaxKind.ImportClause: // this covers both 'import |d|' and 'import |d,| *'
                    const importClause = parent;
                    if (!importClause.namedBindings) { // |import d from './file'|
                        changes.deleteNode(sourceFile, ts.getAncestor(importClause, ts.SyntaxKind.ImportDeclaration));
                    }
                    else {
                        // import |d,| * as ns from './file'
                        const start = importClause.name.getStart(sourceFile);
                        const nextToken = ts.getTokenAtPosition(sourceFile, importClause.name.end, /*includeJsDocComment*/ false);
                        if (nextToken && nextToken.kind === ts.SyntaxKind.CommaToken) {
                            // shift first non-whitespace position after comma to the start position of the node
                            const end = ts.skipTrivia(sourceFile.text, nextToken.end, /*stopAfterLineBreaks*/ false, /*stopAtComments*/ true);
                            changes.deleteRange(sourceFile, { pos: start, end });
                        }
                        else {
                            changes.deleteNode(sourceFile, importClause.name);
                        }
                    }
                    break;
                case ts.SyntaxKind.NamespaceImport:
                    tryDeleteNamedImportBinding(changes, sourceFile, parent);
                    break;
                default:
                    tryDeleteDefault(changes, sourceFile, identifier);
                    break;
            }
        }
        function tryDeleteNamedImportBinding(changes, sourceFile, namedBindings) {
            if (namedBindings.parent.name) {
                // Delete named imports while preserving the default import
                // import d|, * as ns| from './file'
                // import d|, { a }| from './file'
                const previousToken = ts.getTokenAtPosition(sourceFile, namedBindings.pos - 1, /*includeJsDocComment*/ false);
                if (previousToken && previousToken.kind === ts.SyntaxKind.CommaToken) {
                    changes.deleteRange(sourceFile, { pos: previousToken.getStart(), end: namedBindings.end });
                }
            }
            else {
                // Delete the entire import declaration
                // |import * as ns from './file'|
                // |import { a } from './file'|
                const importDecl = ts.getAncestor(namedBindings, ts.SyntaxKind.ImportDeclaration);
                changes.deleteNode(sourceFile, importDecl);
            }
        }
        // token.parent is a variableDeclaration
        function tryDeleteVariableDeclaration(changes, sourceFile, varDecl) {
            switch (varDecl.parent.parent.kind) {
                case ts.SyntaxKind.ForStatement: {
                    const forStatement = varDecl.parent.parent;
                    const forInitializer = forStatement.initializer;
                    if (forInitializer.declarations.length === 1) {
                        changes.deleteNode(sourceFile, forInitializer);
                    }
                    else {
                        changes.deleteNodeInList(sourceFile, varDecl);
                    }
                    break;
                }
                case ts.SyntaxKind.ForOfStatement:
                    const forOfStatement = varDecl.parent.parent;
                    ts.Debug.assert(forOfStatement.initializer.kind === ts.SyntaxKind.VariableDeclarationList);
                    const forOfInitializer = forOfStatement.initializer;
                    changes.replaceNode(sourceFile, forOfInitializer.declarations[0], ts.createObjectLiteral());
                    break;
                case ts.SyntaxKind.ForInStatement:
                case ts.SyntaxKind.TryStatement:
                    break;
                default:
                    const variableStatement = varDecl.parent.parent;
                    if (variableStatement.declarationList.declarations.length === 1) {
                        changes.deleteNode(sourceFile, variableStatement);
                    }
                    else {
                        changes.deleteNodeInList(sourceFile, varDecl);
                    }
            }
        }
    })(codefix = ts.codefix || (ts.codefix = {}));
})(ts || (ts = {}));
