/* @internal */
var ts;
(function (ts) {
    var SignatureHelp;
    (function (SignatureHelp) {
        function getSignatureHelpItems(program, sourceFile, position, cancellationToken) {
            const typeChecker = program.getTypeChecker();
            // Decide whether to show signature help
            const startingToken = ts.findTokenOnLeftOfPosition(sourceFile, position);
            if (!startingToken) {
                // We are at the beginning of the file
                return undefined;
            }
            const argumentInfo = getContainingArgumentInfo(startingToken, position, sourceFile);
            if (!argumentInfo)
                return undefined;
            cancellationToken.throwIfCancellationRequested();
            // Semantic filtering of signature help
            const call = argumentInfo.invocation;
            const candidates = [];
            const resolvedSignature = typeChecker.getResolvedSignature(call, candidates, argumentInfo.argumentCount);
            cancellationToken.throwIfCancellationRequested();
            if (!candidates.length) {
                // We didn't have any sig help items produced by the TS compiler.  If this is a JS
                // file, then see if we can figure out anything better.
                if (ts.isSourceFileJavaScript(sourceFile)) {
                    return createJavaScriptSignatureHelpItems(argumentInfo, program);
                }
                return undefined;
            }
            return createSignatureHelpItems(candidates, resolvedSignature, argumentInfo, typeChecker);
        }
        SignatureHelp.getSignatureHelpItems = getSignatureHelpItems;
        function createJavaScriptSignatureHelpItems(argumentInfo, program) {
            if (argumentInfo.invocation.kind !== ts.SyntaxKind.CallExpression) {
                return undefined;
            }
            // See if we can find some symbol with the call expression name that has call signatures.
            const callExpression = argumentInfo.invocation;
            const expression = callExpression.expression;
            const name = ts.isIdentifier(expression) ? expression : ts.isPropertyAccessExpression(expression) ? expression.name : undefined;
            if (!name || !name.escapedText) {
                return undefined;
            }
            const typeChecker = program.getTypeChecker();
            for (const sourceFile of program.getSourceFiles()) {
                const nameToDeclarations = sourceFile.getNamedDeclarations();
                const declarations = nameToDeclarations.get(name.text);
                if (declarations) {
                    for (const declaration of declarations) {
                        const symbol = declaration.symbol;
                        if (symbol) {
                            const type = typeChecker.getTypeOfSymbolAtLocation(symbol, declaration);
                            if (type) {
                                const callSignatures = type.getCallSignatures();
                                if (callSignatures && callSignatures.length) {
                                    return createSignatureHelpItems(callSignatures, callSignatures[0], argumentInfo, typeChecker);
                                }
                            }
                        }
                    }
                }
            }
        }
        /**
         * Returns relevant information for the argument list and the current argument if we are
         * in the argument of an invocation; returns undefined otherwise.
         */
        function getImmediatelyContainingArgumentInfo(node, position, sourceFile) {
            if (ts.isCallOrNewExpression(node.parent)) {
                const invocation = node.parent;
                let list;
                let argumentIndex;
                // There are 3 cases to handle:
                //   1. The token introduces a list, and should begin a signature help session
                //   2. The token is either not associated with a list, or ends a list, so the session should end
                //   3. The token is buried inside a list, and should give signature help
                //
                // The following are examples of each:
                //
                //    Case 1:
                //          foo<#T, U>(#a, b)    -> The token introduces a list, and should begin a signature help session
                //    Case 2:
                //          fo#o<T, U>#(a, b)#   -> The token is either not associated with a list, or ends a list, so the session should end
                //    Case 3:
                //          foo<T#, U#>(a#, #b#) -> The token is buried inside a list, and should give signature help
                // Find out if 'node' is an argument, a type argument, or neither
                if (node.kind === ts.SyntaxKind.LessThanToken || node.kind === ts.SyntaxKind.OpenParenToken) {
                    // Find the list that starts right *after* the < or ( token.
                    // If the user has just opened a list, consider this item 0.
                    list = getChildListThatStartsWithOpenerToken(invocation, node, sourceFile);
                    ts.Debug.assert(list !== undefined);
                    argumentIndex = 0;
                }
                else {
                    // findListItemInfo can return undefined if we are not in parent's argument list
                    // or type argument list. This includes cases where the cursor is:
                    //   - To the right of the closing parenthesis, non-substitution template, or template tail.
                    //   - Between the type arguments and the arguments (greater than token)
                    //   - On the target of the call (parent.func)
                    //   - On the 'new' keyword in a 'new' expression
                    list = ts.findContainingList(node);
                    if (!list)
                        return undefined;
                    argumentIndex = getArgumentIndex(list, node);
                }
                const kind = invocation.typeArguments && invocation.typeArguments.pos === list.pos ? 0 /* TypeArguments */ : 1 /* CallArguments */;
                const argumentCount = getArgumentCount(list);
                if (argumentIndex !== 0) {
                    ts.Debug.assertLessThan(argumentIndex, argumentCount);
                }
                const argumentsSpan = getApplicableSpanForArguments(list, sourceFile);
                return { kind, invocation, argumentsSpan, argumentIndex, argumentCount };
            }
            else if (node.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral && node.parent.kind === ts.SyntaxKind.TaggedTemplateExpression) {
                // Check if we're actually inside the template;
                // otherwise we'll fall out and return undefined.
                if (ts.isInsideTemplateLiteral(node, position)) {
                    return getArgumentListInfoForTemplate(node.parent, /*argumentIndex*/ 0, sourceFile);
                }
            }
            else if (node.kind === ts.SyntaxKind.TemplateHead && node.parent.parent.kind === ts.SyntaxKind.TaggedTemplateExpression) {
                const templateExpression = node.parent;
                const tagExpression = templateExpression.parent;
                ts.Debug.assert(templateExpression.kind === ts.SyntaxKind.TemplateExpression);
                const argumentIndex = ts.isInsideTemplateLiteral(node, position) ? 0 : 1;
                return getArgumentListInfoForTemplate(tagExpression, argumentIndex, sourceFile);
            }
            else if (node.parent.kind === ts.SyntaxKind.TemplateSpan && node.parent.parent.parent.kind === ts.SyntaxKind.TaggedTemplateExpression) {
                const templateSpan = node.parent;
                const templateExpression = templateSpan.parent;
                const tagExpression = templateExpression.parent;
                ts.Debug.assert(templateExpression.kind === ts.SyntaxKind.TemplateExpression);
                // If we're just after a template tail, don't show signature help.
                if (node.kind === ts.SyntaxKind.TemplateTail && !ts.isInsideTemplateLiteral(node, position)) {
                    return undefined;
                }
                const spanIndex = templateExpression.templateSpans.indexOf(templateSpan);
                const argumentIndex = getArgumentIndexForTemplatePiece(spanIndex, node, position);
                return getArgumentListInfoForTemplate(tagExpression, argumentIndex, sourceFile);
            }
            else if (node.parent && ts.isJsxOpeningLikeElement(node.parent)) {
                // Provide a signature help for JSX opening element or JSX self-closing element.
                // This is not guarantee that JSX tag-name is resolved into stateless function component. (that is done in "getSignatureHelpItems")
                // i.e
                //      export function MainButton(props: ButtonProps, context: any): JSX.Element { ... }
                //      <MainButton /*signatureHelp*/
                const attributeSpanStart = node.parent.attributes.getFullStart();
                const attributeSpanEnd = ts.skipTrivia(sourceFile.text, node.parent.attributes.getEnd(), /*stopAfterLineBreak*/ false);
                return {
                    kind: 3 /* JSXAttributesArguments */,
                    invocation: node.parent,
                    argumentsSpan: ts.createTextSpan(attributeSpanStart, attributeSpanEnd - attributeSpanStart),
                    argumentIndex: 0,
                    argumentCount: 1
                };
            }
            return undefined;
        }
        SignatureHelp.getImmediatelyContainingArgumentInfo = getImmediatelyContainingArgumentInfo;
        function getArgumentIndex(argumentsList, node) {
            // The list we got back can include commas.  In the presence of errors it may
            // also just have nodes without commas.  For example "Foo(a b c)" will have 3
            // args without commas. We want to find what index we're at.  So we count
            // forward until we hit ourselves, only incrementing the index if it isn't a
            // comma.
            //
            // Note: the subtlety around trailing commas (in getArgumentCount) does not apply
            // here.  That's because we're only walking forward until we hit the node we're
            // on.  In that case, even if we're after the trailing comma, we'll still see
            // that trailing comma in the list, and we'll have generated the appropriate
            // arg index.
            let argumentIndex = 0;
            for (const child of argumentsList.getChildren()) {
                if (child === node) {
                    break;
                }
                if (child.kind !== ts.SyntaxKind.CommaToken) {
                    argumentIndex++;
                }
            }
            return argumentIndex;
        }
        function getArgumentCount(argumentsList) {
            // The argument count for a list is normally the number of non-comma children it has.
            // For example, if you have "Foo(a,b)" then there will be three children of the arg
            // list 'a' '<comma>' 'b'.  So, in this case the arg count will be 2.  However, there
            // is a small subtlety.  If you have "Foo(a,)", then the child list will just have
            // 'a' '<comma>'.  So, in the case where the last child is a comma, we increase the
            // arg count by one to compensate.
            //
            // Note: this subtlety only applies to the last comma.  If you had "Foo(a,," then
            // we'll have: 'a' '<comma>' '<missing>'
            // That will give us 2 non-commas.  We then add one for the last comma, giving us an
            // arg count of 3.
            const listChildren = argumentsList.getChildren();
            let argumentCount = ts.countWhere(listChildren, arg => arg.kind !== ts.SyntaxKind.CommaToken);
            if (listChildren.length > 0 && ts.lastOrUndefined(listChildren).kind === ts.SyntaxKind.CommaToken) {
                argumentCount++;
            }
            return argumentCount;
        }
        // spanIndex is either the index for a given template span.
        // This does not give appropriate results for a NoSubstitutionTemplateLiteral
        function getArgumentIndexForTemplatePiece(spanIndex, node, position) {
            // Because the TemplateStringsArray is the first argument, we have to offset each substitution expression by 1.
            // There are three cases we can encounter:
            //      1. We are precisely in the template literal (argIndex = 0).
            //      2. We are in or to the right of the substitution expression (argIndex = spanIndex + 1).
            //      3. We are directly to the right of the template literal, but because we look for the token on the left,
            //          not enough to put us in the substitution expression; we should consider ourselves part of
            //          the *next* span's expression by offsetting the index (argIndex = (spanIndex + 1) + 1).
            //
            // tslint:disable no-double-space
            // Example: f  `# abcd $#{#  1 + 1#  }# efghi ${ #"#hello"#  }  #  `
            //              ^       ^ ^       ^   ^          ^ ^      ^     ^
            // Case:        1       1 3       2   1          3 2      2     1
            // tslint:enable no-double-space
            ts.Debug.assert(position >= node.getStart(), "Assumed 'position' could not occur before node.");
            if (ts.isTemplateLiteralKind(node.kind)) {
                if (ts.isInsideTemplateLiteral(node, position)) {
                    return 0;
                }
                return spanIndex + 2;
            }
            return spanIndex + 1;
        }
        function getArgumentListInfoForTemplate(tagExpression, argumentIndex, sourceFile) {
            // argumentCount is either 1 or (numSpans + 1) to account for the template strings array argument.
            const argumentCount = ts.isNoSubstitutionTemplateLiteral(tagExpression.template) ? 1 : tagExpression.template.templateSpans.length + 1;
            if (argumentIndex !== 0) {
                ts.Debug.assertLessThan(argumentIndex, argumentCount);
            }
            return {
                kind: 2 /* TaggedTemplateArguments */,
                invocation: tagExpression,
                argumentsSpan: getApplicableSpanForTaggedTemplate(tagExpression, sourceFile),
                argumentIndex,
                argumentCount
            };
        }
        function getApplicableSpanForArguments(argumentsList, sourceFile) {
            // We use full start and skip trivia on the end because we want to include trivia on
            // both sides. For example,
            //
            //    foo(   /*comment */     a, b, c      /*comment*/     )
            //        |                                               |
            //
            // The applicable span is from the first bar to the second bar (inclusive,
            // but not including parentheses)
            const applicableSpanStart = argumentsList.getFullStart();
            const applicableSpanEnd = ts.skipTrivia(sourceFile.text, argumentsList.getEnd(), /*stopAfterLineBreak*/ false);
            return ts.createTextSpan(applicableSpanStart, applicableSpanEnd - applicableSpanStart);
        }
        function getApplicableSpanForTaggedTemplate(taggedTemplate, sourceFile) {
            const template = taggedTemplate.template;
            const applicableSpanStart = template.getStart();
            let applicableSpanEnd = template.getEnd();
            // We need to adjust the end position for the case where the template does not have a tail.
            // Otherwise, we will not show signature help past the expression.
            // For example,
            //
            //      ` ${ 1 + 1 foo(10)
            //       |       |
            // This is because a Missing node has no width. However, what we actually want is to include trivia
            // leading up to the next token in case the user is about to type in a TemplateMiddle or TemplateTail.
            if (template.kind === ts.SyntaxKind.TemplateExpression) {
                const lastSpan = ts.lastOrUndefined(template.templateSpans);
                if (lastSpan.literal.getFullWidth() === 0) {
                    applicableSpanEnd = ts.skipTrivia(sourceFile.text, applicableSpanEnd, /*stopAfterLineBreak*/ false);
                }
            }
            return ts.createTextSpan(applicableSpanStart, applicableSpanEnd - applicableSpanStart);
        }
        function getContainingArgumentInfo(node, position, sourceFile) {
            for (let n = node; n.kind !== ts.SyntaxKind.SourceFile; n = n.parent) {
                if (ts.isFunctionBlock(n)) {
                    return undefined;
                }
                // If the node is not a subspan of its parent, this is a big problem.
                // There have been crashes that might be caused by this violation.
                if (n.pos < n.parent.pos || n.end > n.parent.end) {
                    ts.Debug.fail("Node of kind " + n.kind + " is not a subspan of its parent of kind " + n.parent.kind);
                }
                const argumentInfo = getImmediatelyContainingArgumentInfo(n, position, sourceFile);
                if (argumentInfo) {
                    return argumentInfo;
                }
                // TODO: Handle generic call with incomplete syntax
            }
            return undefined;
        }
        SignatureHelp.getContainingArgumentInfo = getContainingArgumentInfo;
        function getChildListThatStartsWithOpenerToken(parent, openerToken, sourceFile) {
            const children = parent.getChildren(sourceFile);
            const indexOfOpenerToken = children.indexOf(openerToken);
            ts.Debug.assert(indexOfOpenerToken >= 0 && children.length > indexOfOpenerToken + 1);
            return children[indexOfOpenerToken + 1];
        }
        const signatureHelpNodeBuilderFlags = ts.NodeBuilderFlags.OmitParameterModifiers | ts.NodeBuilderFlags.IgnoreErrors;
        function createSignatureHelpItems(candidates, resolvedSignature, argumentListInfo, typeChecker) {
            const { argumentCount, argumentsSpan: applicableSpan, invocation, argumentIndex } = argumentListInfo;
            const isTypeParameterList = argumentListInfo.kind === 0 /* TypeArguments */;
            const callTarget = ts.getInvokedExpression(invocation);
            const callTargetSymbol = typeChecker.getSymbolAtLocation(callTarget);
            const callTargetDisplayParts = callTargetSymbol && ts.symbolToDisplayParts(typeChecker, callTargetSymbol, /*enclosingDeclaration*/ undefined, /*meaning*/ undefined);
            const printer = ts.createPrinter({ removeComments: true });
            const items = ts.map(candidates, candidateSignature => {
                let signatureHelpParameters;
                const prefixDisplayParts = [];
                const suffixDisplayParts = [];
                if (callTargetDisplayParts) {
                    ts.addRange(prefixDisplayParts, callTargetDisplayParts);
                }
                let isVariadic;
                if (isTypeParameterList) {
                    isVariadic = false; // type parameter lists are not variadic
                    prefixDisplayParts.push(ts.punctuationPart(ts.SyntaxKind.LessThanToken));
                    const typeParameters = (candidateSignature.target || candidateSignature).typeParameters;
                    signatureHelpParameters = typeParameters && typeParameters.length > 0 ? ts.map(typeParameters, createSignatureHelpParameterForTypeParameter) : ts.emptyArray;
                    suffixDisplayParts.push(ts.punctuationPart(ts.SyntaxKind.GreaterThanToken));
                    const parameterParts = ts.mapToDisplayParts(writer => {
                        const thisParameter = candidateSignature.thisParameter ? [typeChecker.symbolToParameterDeclaration(candidateSignature.thisParameter, invocation, signatureHelpNodeBuilderFlags)] : [];
                        const params = ts.createNodeArray([...thisParameter, ...ts.map(candidateSignature.parameters, param => typeChecker.symbolToParameterDeclaration(param, invocation, signatureHelpNodeBuilderFlags))]);
                        printer.writeList(ts.ListFormat.CallExpressionArguments, params, ts.getSourceFileOfNode(ts.getParseTreeNode(invocation)), writer);
                    });
                    ts.addRange(suffixDisplayParts, parameterParts);
                }
                else {
                    isVariadic = candidateSignature.hasRestParameter;
                    const typeParameterParts = ts.mapToDisplayParts(writer => {
                        if (candidateSignature.typeParameters && candidateSignature.typeParameters.length) {
                            const args = ts.createNodeArray(ts.map(candidateSignature.typeParameters, p => typeChecker.typeParameterToDeclaration(p, invocation)));
                            printer.writeList(ts.ListFormat.TypeParameters, args, ts.getSourceFileOfNode(ts.getParseTreeNode(invocation)), writer);
                        }
                    });
                    ts.addRange(prefixDisplayParts, typeParameterParts);
                    prefixDisplayParts.push(ts.punctuationPart(ts.SyntaxKind.OpenParenToken));
                    signatureHelpParameters = ts.map(candidateSignature.parameters, createSignatureHelpParameterForParameter);
                    suffixDisplayParts.push(ts.punctuationPart(ts.SyntaxKind.CloseParenToken));
                }
                const returnTypeParts = ts.mapToDisplayParts(writer => {
                    writer.writePunctuation(":");
                    writer.writeSpace(" ");
                    const predicate = typeChecker.getTypePredicateOfSignature(candidateSignature);
                    if (predicate) {
                        typeChecker.writeTypePredicate(predicate, invocation, /*flags*/ undefined, writer);
                    }
                    else {
                        typeChecker.writeType(typeChecker.getReturnTypeOfSignature(candidateSignature), invocation, /*flags*/ undefined, writer);
                    }
                });
                ts.addRange(suffixDisplayParts, returnTypeParts);
                return {
                    isVariadic,
                    prefixDisplayParts,
                    suffixDisplayParts,
                    separatorDisplayParts: [ts.punctuationPart(ts.SyntaxKind.CommaToken), ts.spacePart()],
                    parameters: signatureHelpParameters,
                    documentation: candidateSignature.getDocumentationComment(typeChecker),
                    tags: candidateSignature.getJsDocTags()
                };
            });
            if (argumentIndex !== 0) {
                ts.Debug.assertLessThan(argumentIndex, argumentCount);
            }
            const selectedItemIndex = candidates.indexOf(resolvedSignature);
            ts.Debug.assert(selectedItemIndex !== -1); // If candidates is non-empty it should always include bestSignature. We check for an empty candidates before calling this function.
            return { items, applicableSpan, selectedItemIndex, argumentIndex, argumentCount };
            function createSignatureHelpParameterForParameter(parameter) {
                const displayParts = ts.mapToDisplayParts(writer => {
                    const param = typeChecker.symbolToParameterDeclaration(parameter, invocation, signatureHelpNodeBuilderFlags);
                    printer.writeNode(ts.EmitHint.Unspecified, param, ts.getSourceFileOfNode(ts.getParseTreeNode(invocation)), writer);
                });
                return {
                    name: parameter.name,
                    documentation: parameter.getDocumentationComment(typeChecker),
                    displayParts,
                    isOptional: typeChecker.isOptionalParameter(parameter.valueDeclaration)
                };
            }
            function createSignatureHelpParameterForTypeParameter(typeParameter) {
                const displayParts = ts.mapToDisplayParts(writer => {
                    const param = typeChecker.typeParameterToDeclaration(typeParameter, invocation);
                    printer.writeNode(ts.EmitHint.Unspecified, param, ts.getSourceFileOfNode(ts.getParseTreeNode(invocation)), writer);
                });
                return {
                    name: typeParameter.symbol.name,
                    documentation: ts.emptyArray,
                    displayParts,
                    isOptional: false
                };
            }
        }
    })(SignatureHelp = ts.SignatureHelp || (ts.SignatureHelp = {}));
})(ts || (ts = {}));
