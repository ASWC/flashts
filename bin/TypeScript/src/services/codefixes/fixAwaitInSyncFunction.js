/* @internal */
var ts;
(function (ts) {
    var codefix;
    (function (codefix) {
        const fixId = "fixAwaitInSyncFunction";
        const errorCodes = [
            Diagnostics.await_expression_is_only_allowed_within_an_async_function.code,
            Diagnostics.A_for_await_of_statement_is_only_allowed_within_an_async_function_or_async_generator.code,
        ];
        codefix.registerCodeFix({
            errorCodes,
            getCodeActions(context) {
                const { sourceFile, span } = context;
                const nodes = getNodes(sourceFile, span.start);
                if (!nodes)
                    return undefined;
                const changes = ts.textChanges.ChangeTracker.with(context, t => doChange(t, sourceFile, nodes));
                return [codefix.createCodeFixAction(fixId, changes, Diagnostics.Add_async_modifier_to_containing_function, fixId, Diagnostics.Add_all_missing_async_modifiers)];
            },
            fixIds: [fixId],
            getAllCodeActions: context => codefix.codeFixAll(context, errorCodes, (changes, diag) => {
                const nodes = getNodes(diag.file, diag.start);
                if (!nodes)
                    return;
                doChange(changes, context.sourceFile, nodes);
            }),
        });
        function getReturnType(expr) {
            if (expr.type) {
                return expr.type;
            }
            if (ts.isVariableDeclaration(expr.parent) &&
                expr.parent.type &&
                ts.isFunctionTypeNode(expr.parent.type)) {
                return expr.parent.type.type;
            }
        }
        function getNodes(sourceFile, start) {
            const token = ts.getTokenAtPosition(sourceFile, start, /*includeJsDocComment*/ false);
            const containingFunction = ts.getContainingFunction(token);
            if (!containingFunction) {
                return;
            }
            let insertBefore;
            switch (containingFunction.kind) {
                case ts.SyntaxKind.MethodDeclaration:
                    insertBefore = containingFunction.name;
                    break;
                case ts.SyntaxKind.FunctionDeclaration:
                case ts.SyntaxKind.FunctionExpression:
                    insertBefore = ts.findChildOfKind(containingFunction, ts.SyntaxKind.FunctionKeyword, sourceFile);
                    break;
                case ts.SyntaxKind.ArrowFunction:
                    insertBefore = ts.findChildOfKind(containingFunction, ts.SyntaxKind.OpenParenToken, sourceFile) || ts.first(containingFunction.parameters);
                    break;
                default:
                    return;
            }
            return {
                insertBefore,
                returnType: getReturnType(containingFunction)
            };
        }
        function doChange(changes, sourceFile, { insertBefore, returnType }) {
            if (returnType) {
                const entityName = ts.getEntityNameFromTypeNode(returnType);
                if (!entityName || entityName.kind !== ts.SyntaxKind.Identifier || entityName.text !== "Promise") {
                    changes.replaceNode(sourceFile, returnType, ts.createTypeReferenceNode("Promise", ts.createNodeArray([returnType])));
                }
            }
            changes.insertModifierBefore(sourceFile, ts.SyntaxKind.AsyncKeyword, insertBefore);
        }
    })(codefix = ts.codefix || (ts.codefix = {}));
})(ts || (ts = {}));
