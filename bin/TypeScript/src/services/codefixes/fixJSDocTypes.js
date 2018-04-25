/* @internal */
var ts;
(function (ts) {
    var codefix;
    (function (codefix) {
        const fixIdPlain = "fixJSDocTypes_plain";
        const fixIdNullable = "fixJSDocTypes_nullable";
        const errorCodes = [Diagnostics.JSDoc_types_can_only_be_used_inside_documentation_comments.code];
        codefix.registerCodeFix({
            errorCodes,
            getCodeActions(context) {
                const { sourceFile } = context;
                const checker = context.program.getTypeChecker();
                const info = getInfo(sourceFile, context.span.start, checker);
                if (!info)
                    return undefined;
                const { typeNode, type } = info;
                const original = typeNode.getText(sourceFile);
                const actions = [fix(type, fixIdPlain, Diagnostics.Change_all_jsdoc_style_types_to_TypeScript)];
                if (typeNode.kind === ts.SyntaxKind.JSDocNullableType) {
                    // for nullable types, suggest the flow-compatible `T | null | undefined`
                    // in addition to the jsdoc/closure-compatible `T | null`
                    actions.push(fix(checker.getNullableType(type, ts.TypeFlags.Undefined), fixIdNullable, Diagnostics.Change_all_jsdoc_style_types_to_TypeScript_and_add_undefined_to_nullable_types));
                }
                return actions;
                function fix(type, fixId, fixAllDescription) {
                    const changes = ts.textChanges.ChangeTracker.with(context, t => doChange(t, sourceFile, typeNode, type, checker));
                    return codefix.createCodeFixAction("jdocTypes", changes, [Diagnostics.Change_0_to_1, original, checker.typeToString(type)], fixId, fixAllDescription);
                }
            },
            fixIds: [fixIdPlain, fixIdNullable],
            getAllCodeActions(context) {
                const { fixId, program, sourceFile } = context;
                const checker = program.getTypeChecker();
                return codefix.codeFixAll(context, errorCodes, (changes, err) => {
                    const info = getInfo(err.file, err.start, checker);
                    if (!info)
                        return;
                    const { typeNode, type } = info;
                    const fixedType = typeNode.kind === ts.SyntaxKind.JSDocNullableType && fixId === fixIdNullable ? checker.getNullableType(type, ts.TypeFlags.Undefined) : type;
                    doChange(changes, sourceFile, typeNode, fixedType, checker);
                });
            }
        });
        function doChange(changes, sourceFile, oldTypeNode, newType, checker) {
            changes.replaceNode(sourceFile, oldTypeNode, checker.typeToTypeNode(newType, /*enclosingDeclaration*/ oldTypeNode));
        }
        function getInfo(sourceFile, pos, checker) {
            const decl = ts.findAncestor(ts.getTokenAtPosition(sourceFile, pos, /*includeJsDocComment*/ false), isTypeContainer);
            const typeNode = decl && decl.type;
            return typeNode && { typeNode, type: checker.getTypeFromTypeNode(typeNode) };
        }
        function isTypeContainer(node) {
            // NOTE: Some locations are not handled yet:
            // MappedTypeNode.typeParameters and SignatureDeclaration.typeParameters, as well as CallExpression.typeArguments
            switch (node.kind) {
                case ts.SyntaxKind.AsExpression:
                case ts.SyntaxKind.CallSignature:
                case ts.SyntaxKind.ConstructSignature:
                case ts.SyntaxKind.FunctionDeclaration:
                case ts.SyntaxKind.GetAccessor:
                case ts.SyntaxKind.IndexSignature:
                case ts.SyntaxKind.MappedType:
                case ts.SyntaxKind.MethodDeclaration:
                case ts.SyntaxKind.MethodSignature:
                case ts.SyntaxKind.Parameter:
                case ts.SyntaxKind.PropertyDeclaration:
                case ts.SyntaxKind.PropertySignature:
                case ts.SyntaxKind.SetAccessor:
                case ts.SyntaxKind.TypeAliasDeclaration:
                case ts.SyntaxKind.TypeAssertionExpression:
                case ts.SyntaxKind.VariableDeclaration:
                    return true;
                default:
                    return false;
            }
        }
    })(codefix = ts.codefix || (ts.codefix = {}));
})(ts || (ts = {}));
