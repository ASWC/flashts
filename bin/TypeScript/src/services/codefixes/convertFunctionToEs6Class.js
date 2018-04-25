/* @internal */
var ts;
(function (ts) {
    var codefix;
    (function (codefix) {
        const fixId = "convertFunctionToEs6Class";
        const errorCodes = [Diagnostics.This_constructor_function_may_be_converted_to_a_class_declaration.code];
        codefix.registerCodeFix({
            errorCodes,
            getCodeActions(context) {
                const changes = ts.textChanges.ChangeTracker.with(context, t => doChange(t, context.sourceFile, context.span.start, context.program.getTypeChecker()));
                return [codefix.createCodeFixAction(fixId, changes, Diagnostics.Convert_function_to_an_ES2015_class, fixId, Diagnostics.Convert_all_constructor_functions_to_classes)];
            },
            fixIds: [fixId],
            getAllCodeActions: context => codefix.codeFixAll(context, errorCodes, (changes, err) => doChange(changes, err.file, err.start, context.program.getTypeChecker())),
        });
        function doChange(changes, sourceFile, position, checker) {
            const deletedNodes = [];
            const ctorSymbol = checker.getSymbolAtLocation(ts.getTokenAtPosition(sourceFile, position, /*includeJsDocComment*/ false));
            if (!ctorSymbol || !(ctorSymbol.flags & (ts.SymbolFlags.Function | ts.SymbolFlags.Variable))) {
                // Bad input
                return undefined;
            }
            const ctorDeclaration = ctorSymbol.valueDeclaration;
            let precedingNode;
            let newClassDeclaration;
            switch (ctorDeclaration.kind) {
                case ts.SyntaxKind.FunctionDeclaration:
                    precedingNode = ctorDeclaration;
                    deleteNode(ctorDeclaration);
                    newClassDeclaration = createClassFromFunctionDeclaration(ctorDeclaration);
                    break;
                case ts.SyntaxKind.VariableDeclaration:
                    precedingNode = ctorDeclaration.parent.parent;
                    newClassDeclaration = createClassFromVariableDeclaration(ctorDeclaration);
                    if (ctorDeclaration.parent.declarations.length === 1) {
                        copyComments(precedingNode, newClassDeclaration, sourceFile);
                        deleteNode(precedingNode);
                    }
                    else {
                        deleteNode(ctorDeclaration, /*inList*/ true);
                    }
                    break;
            }
            if (!newClassDeclaration) {
                return undefined;
            }
            copyComments(ctorDeclaration, newClassDeclaration, sourceFile);
            // Because the preceding node could be touched, we need to insert nodes before delete nodes.
            changes.insertNodeAfter(sourceFile, precedingNode, newClassDeclaration);
            for (const { node, inList } of deletedNodes) {
                if (inList) {
                    changes.deleteNodeInList(sourceFile, node);
                }
                else {
                    changes.deleteNode(sourceFile, node);
                }
            }
            function deleteNode(node, inList = false) {
                // If parent node has already been deleted, do nothing
                if (!deletedNodes.some(n => ts.isNodeDescendantOf(node, n.node))) {
                    deletedNodes.push({ node, inList });
                }
            }
            function createClassElementsFromSymbol(symbol) {
                const memberElements = [];
                // all instance members are stored in the "member" array of symbol
                if (symbol.members) {
                    symbol.members.forEach(member => {
                        const memberElement = createClassElement(member, /*modifiers*/ undefined);
                        if (memberElement) {
                            memberElements.push(memberElement);
                        }
                    });
                }
                // all static members are stored in the "exports" array of symbol
                if (symbol.exports) {
                    symbol.exports.forEach(member => {
                        const memberElement = createClassElement(member, [ts.createToken(ts.SyntaxKind.StaticKeyword)]);
                        if (memberElement) {
                            memberElements.push(memberElement);
                        }
                    });
                }
                return memberElements;
                function shouldConvertDeclaration(_target, source) {
                    // Right now the only thing we can convert are function expressions - other values shouldn't get
                    // transformed. We can update this once ES public class properties are available.
                    return ts.isFunctionLike(source);
                }
                function createClassElement(symbol, modifiers) {
                    // Right now the only thing we can convert are function expressions, which are marked as methods
                    if (!(symbol.flags & ts.SymbolFlags.Method)) {
                        return;
                    }
                    const memberDeclaration = symbol.valueDeclaration;
                    const assignmentBinaryExpression = memberDeclaration.parent;
                    if (!shouldConvertDeclaration(memberDeclaration, assignmentBinaryExpression.right)) {
                        return;
                    }
                    // delete the entire statement if this expression is the sole expression to take care of the semicolon at the end
                    const nodeToDelete = assignmentBinaryExpression.parent && assignmentBinaryExpression.parent.kind === ts.SyntaxKind.ExpressionStatement
                        ? assignmentBinaryExpression.parent : assignmentBinaryExpression;
                    deleteNode(nodeToDelete);
                    if (!assignmentBinaryExpression.right) {
                        return ts.createProperty([], modifiers, symbol.name, /*questionToken*/ undefined, 
                        /*type*/ undefined, /*initializer*/ undefined);
                    }
                    switch (assignmentBinaryExpression.right.kind) {
                        case ts.SyntaxKind.FunctionExpression: {
                            const functionExpression = assignmentBinaryExpression.right;
                            const fullModifiers = ts.concatenate(modifiers, getModifierKindFromSource(functionExpression, ts.SyntaxKind.AsyncKeyword));
                            const method = ts.createMethod(/*decorators*/ undefined, fullModifiers, /*asteriskToken*/ undefined, memberDeclaration.name, /*questionToken*/ undefined, 
                            /*typeParameters*/ undefined, functionExpression.parameters, /*type*/ undefined, functionExpression.body);
                            copyComments(assignmentBinaryExpression, method, sourceFile);
                            return method;
                        }
                        case ts.SyntaxKind.ArrowFunction: {
                            const arrowFunction = assignmentBinaryExpression.right;
                            const arrowFunctionBody = arrowFunction.body;
                            let bodyBlock;
                            // case 1: () => { return [1,2,3] }
                            if (arrowFunctionBody.kind === ts.SyntaxKind.Block) {
                                bodyBlock = arrowFunctionBody;
                            }
                            // case 2: () => [1,2,3]
                            else {
                                bodyBlock = ts.createBlock([ts.createReturn(arrowFunctionBody)]);
                            }
                            const fullModifiers = ts.concatenate(modifiers, getModifierKindFromSource(arrowFunction, ts.SyntaxKind.AsyncKeyword));
                            const method = ts.createMethod(/*decorators*/ undefined, fullModifiers, /*asteriskToken*/ undefined, memberDeclaration.name, /*questionToken*/ undefined, 
                            /*typeParameters*/ undefined, arrowFunction.parameters, /*type*/ undefined, bodyBlock);
                            copyComments(assignmentBinaryExpression, method, sourceFile);
                            return method;
                        }
                        default: {
                            // Don't try to declare members in JavaScript files
                            if (ts.isSourceFileJavaScript(sourceFile)) {
                                return;
                            }
                            const prop = ts.createProperty(/*decorators*/ undefined, modifiers, memberDeclaration.name, /*questionToken*/ undefined, 
                            /*type*/ undefined, assignmentBinaryExpression.right);
                            copyComments(assignmentBinaryExpression.parent, prop, sourceFile);
                            return prop;
                        }
                    }
                }
            }
            function createClassFromVariableDeclaration(node) {
                const initializer = node.initializer;
                if (!initializer || initializer.kind !== ts.SyntaxKind.FunctionExpression) {
                    return undefined;
                }
                if (node.name.kind !== ts.SyntaxKind.Identifier) {
                    return undefined;
                }
                const memberElements = createClassElementsFromSymbol(initializer.symbol);
                if (initializer.body) {
                    memberElements.unshift(ts.createConstructor(/*decorators*/ undefined, /*modifiers*/ undefined, initializer.parameters, initializer.body));
                }
                const modifiers = getModifierKindFromSource(precedingNode, ts.SyntaxKind.ExportKeyword);
                const cls = ts.createClassDeclaration(/*decorators*/ undefined, modifiers, node.name, 
                /*typeParameters*/ undefined, /*heritageClauses*/ undefined, memberElements);
                // Don't call copyComments here because we'll already leave them in place
                return cls;
            }
            function createClassFromFunctionDeclaration(node) {
                const memberElements = createClassElementsFromSymbol(ctorSymbol);
                if (node.body) {
                    memberElements.unshift(ts.createConstructor(/*decorators*/ undefined, /*modifiers*/ undefined, node.parameters, node.body));
                }
                const modifiers = getModifierKindFromSource(node, ts.SyntaxKind.ExportKeyword);
                const cls = ts.createClassDeclaration(/*decorators*/ undefined, modifiers, node.name, 
                /*typeParameters*/ undefined, /*heritageClauses*/ undefined, memberElements);
                // Don't call copyComments here because we'll already leave them in place
                return cls;
            }
        }
        function copyComments(sourceNode, targetNode, sourceFile) {
            ts.forEachLeadingCommentRange(sourceFile.text, sourceNode.pos, (pos, end, kind, htnl) => {
                if (kind === ts.SyntaxKind.MultiLineCommentTrivia) {
                    // Remove leading /*
                    pos += 2;
                    // Remove trailing */
                    end -= 2;
                }
                else {
                    // Remove leading //
                    pos += 2;
                }
                ts.addSyntheticLeadingComment(targetNode, kind, sourceFile.text.slice(pos, end), htnl);
            });
        }
        function getModifierKindFromSource(source, kind) {
            return ts.filter(source.modifiers, modifier => modifier.kind === kind);
        }
    })(codefix = ts.codefix || (ts.codefix = {}));
})(ts || (ts = {}));
