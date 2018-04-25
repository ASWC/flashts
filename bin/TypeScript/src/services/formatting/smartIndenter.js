/* @internal */
var ts;
(function (ts) {
    var formatting;
    (function (formatting) {
        let SmartIndenter;
        (function (SmartIndenter) {
            /**
             * @param assumeNewLineBeforeCloseBrace
             * `false` when called on text from a real source file.
             * `true` when we need to assume `position` is on a newline.
             *
             * This is useful for codefixes. Consider
             * ```
             * function f() {
             * |}
             * ```
             * with `position` at `|`.
             *
             * When inserting some text after an open brace, we would like to get indentation as if a newline was already there.
             * By default indentation at `position` will be 0 so 'assumeNewLineBeforeCloseBrace' overrides this behavior.
             */
            function getIndentation(position, sourceFile, options, assumeNewLineBeforeCloseBrace = false) {
                if (position > sourceFile.text.length) {
                    return getBaseIndentation(options); // past EOF
                }
                // no indentation when the indent style is set to none,
                // so we can return fast
                if (options.indentStyle === ts.IndentStyle.None) {
                    return 0;
                }
                const precedingToken = ts.findPrecedingToken(position, sourceFile);
                const enclosingCommentRange = formatting.getRangeOfEnclosingComment(sourceFile, position, /*onlyMultiLine*/ true, precedingToken || null); // tslint:disable-line:no-null-keyword
                if (enclosingCommentRange) {
                    return getCommentIndent(sourceFile, position, options, enclosingCommentRange);
                }
                if (!precedingToken) {
                    return getBaseIndentation(options);
                }
                // no indentation in string \regex\template literals
                const precedingTokenIsLiteral = ts.isStringOrRegularExpressionOrTemplateLiteral(precedingToken.kind);
                if (precedingTokenIsLiteral && precedingToken.getStart(sourceFile) <= position && position < precedingToken.end) {
                    return 0;
                }
                const lineAtPosition = sourceFile.getLineAndCharacterOfPosition(position).line;
                // indentation is first non-whitespace character in a previous line
                // for block indentation, we should look for a line which contains something that's not
                // whitespace.
                if (options.indentStyle === ts.IndentStyle.Block) {
                    return getBlockIndent(sourceFile, position, options);
                }
                if (precedingToken.kind === ts.SyntaxKind.CommaToken && precedingToken.parent.kind !== ts.SyntaxKind.BinaryExpression) {
                    // previous token is comma that separates items in list - find the previous item and try to derive indentation from it
                    const actualIndentation = getActualIndentationForListItemBeforeComma(precedingToken, sourceFile, options);
                    if (actualIndentation !== -1 /* Unknown */) {
                        return actualIndentation;
                    }
                }
                return getSmartIndent(sourceFile, position, precedingToken, lineAtPosition, assumeNewLineBeforeCloseBrace, options);
            }
            SmartIndenter.getIndentation = getIndentation;
            function getCommentIndent(sourceFile, position, options, enclosingCommentRange) {
                const previousLine = ts.getLineAndCharacterOfPosition(sourceFile, position).line - 1;
                const commentStartLine = ts.getLineAndCharacterOfPosition(sourceFile, enclosingCommentRange.pos).line;
                ts.Debug.assert(commentStartLine >= 0);
                if (previousLine <= commentStartLine) {
                    return findFirstNonWhitespaceColumn(ts.getStartPositionOfLine(commentStartLine, sourceFile), position, sourceFile, options);
                }
                const startPostionOfLine = ts.getStartPositionOfLine(previousLine, sourceFile);
                const { column, character } = findFirstNonWhitespaceCharacterAndColumn(startPostionOfLine, position, sourceFile, options);
                if (column === 0) {
                    return column;
                }
                const firstNonWhitespaceCharacterCode = sourceFile.text.charCodeAt(startPostionOfLine + character);
                return firstNonWhitespaceCharacterCode === 42 /* asterisk */ ? column - 1 : column;
            }
            function getBlockIndent(sourceFile, position, options) {
                // move backwards until we find a line with a non-whitespace character,
                // then find the first non-whitespace character for that line.
                let current = position;
                while (current > 0) {
                    const char = sourceFile.text.charCodeAt(current);
                    if (!ts.isWhiteSpaceLike(char)) {
                        break;
                    }
                    current--;
                }
                const lineStart = ts.getLineStartPositionForPosition(current, sourceFile);
                return findFirstNonWhitespaceColumn(lineStart, current, sourceFile, options);
            }
            function getSmartIndent(sourceFile, position, precedingToken, lineAtPosition, assumeNewLineBeforeCloseBrace, options) {
                // try to find node that can contribute to indentation and includes 'position' starting from 'precedingToken'
                // if such node is found - compute initial indentation for 'position' inside this node
                let previous;
                let current = precedingToken;
                while (current) {
                    if (ts.positionBelongsToNode(current, position, sourceFile) && shouldIndentChildNode(options, current, previous, sourceFile, /*isNextChild*/ true)) {
                        const currentStart = getStartLineAndCharacterForNode(current, sourceFile);
                        const nextTokenKind = nextTokenIsCurlyBraceOnSameLineAsCursor(precedingToken, current, lineAtPosition, sourceFile);
                        const indentationDelta = nextTokenKind !== 0 /* Unknown */
                            // handle cases when codefix is about to be inserted before the close brace
                            ? assumeNewLineBeforeCloseBrace && nextTokenKind === 2 /* CloseBrace */ ? options.indentSize : 0
                            : lineAtPosition !== currentStart.line ? options.indentSize : 0;
                        return getIndentationForNodeWorker(current, currentStart, /*ignoreActualIndentationRange*/ undefined, indentationDelta, sourceFile, /*isNextChild*/ true, options);
                    }
                    // check if current node is a list item - if yes, take indentation from it
                    let actualIndentation = getActualIndentationForListItem(current, sourceFile, options);
                    if (actualIndentation !== -1 /* Unknown */) {
                        return actualIndentation;
                    }
                    actualIndentation = getLineIndentationWhenExpressionIsInMultiLine(current, sourceFile, options);
                    if (actualIndentation !== -1 /* Unknown */) {
                        return actualIndentation + options.indentSize;
                    }
                    previous = current;
                    current = current.parent;
                }
                // no parent was found - return the base indentation of the SourceFile
                return getBaseIndentation(options);
            }
            function getIndentationForNode(n, ignoreActualIndentationRange, sourceFile, options) {
                const start = sourceFile.getLineAndCharacterOfPosition(n.getStart(sourceFile));
                return getIndentationForNodeWorker(n, start, ignoreActualIndentationRange, /*indentationDelta*/ 0, sourceFile, /*isNextChild*/ false, options);
            }
            SmartIndenter.getIndentationForNode = getIndentationForNode;
            function getBaseIndentation(options) {
                return options.baseIndentSize || 0;
            }
            SmartIndenter.getBaseIndentation = getBaseIndentation;
            function getIndentationForNodeWorker(current, currentStart, ignoreActualIndentationRange, indentationDelta, sourceFile, isNextChild, options) {
                let parent = current.parent;
                // Walk up the tree and collect indentation for parent-child node pairs. Indentation is not added if
                // * parent and child nodes start on the same line, or
                // * parent is an IfStatement and child starts on the same line as an 'else clause'.
                while (parent) {
                    let useActualIndentation = true;
                    if (ignoreActualIndentationRange) {
                        const start = current.getStart(sourceFile);
                        useActualIndentation = start < ignoreActualIndentationRange.pos || start > ignoreActualIndentationRange.end;
                    }
                    if (useActualIndentation) {
                        // check if current node is a list item - if yes, take indentation from it
                        const actualIndentation = getActualIndentationForListItem(current, sourceFile, options);
                        if (actualIndentation !== -1 /* Unknown */) {
                            return actualIndentation + indentationDelta;
                        }
                    }
                    const containingListOrParentStart = getContainingListOrParentStart(parent, current, sourceFile);
                    const parentAndChildShareLine = containingListOrParentStart.line === currentStart.line ||
                        childStartsOnTheSameLineWithElseInIfStatement(parent, current, currentStart.line, sourceFile);
                    if (useActualIndentation) {
                        // try to fetch actual indentation for current node from source text
                        let actualIndentation = getActualIndentationForNode(current, parent, currentStart, parentAndChildShareLine, sourceFile, options);
                        if (actualIndentation !== -1 /* Unknown */) {
                            return actualIndentation + indentationDelta;
                        }
                        actualIndentation = getLineIndentationWhenExpressionIsInMultiLine(current, sourceFile, options);
                        if (actualIndentation !== -1 /* Unknown */) {
                            return actualIndentation + indentationDelta;
                        }
                    }
                    // increase indentation if parent node wants its content to be indented and parent and child nodes don't start on the same line
                    if (shouldIndentChildNode(options, parent, current, sourceFile, isNextChild) && !parentAndChildShareLine) {
                        indentationDelta += options.indentSize;
                    }
                    // In our AST, a call argument's `parent` is the call-expression, not the argument list.
                    // We would like to increase indentation based on the relationship between an argument and its argument-list,
                    // so we spoof the starting position of the (parent) call-expression to match the (non-parent) argument-list.
                    // But, the spoofed start-value could then cause a problem when comparing the start position of the call-expression
                    // to *its* parent (in the case of an iife, an expression statement), adding an extra level of indentation.
                    //
                    // Instead, when at an argument, we unspoof the starting position of the enclosing call expression
                    // *after* applying indentation for the argument.
                    const useTrueStart = isArgumentAndStartLineOverlapsExpressionBeingCalled(parent, current, currentStart.line, sourceFile);
                    current = parent;
                    parent = current.parent;
                    currentStart = useTrueStart ? sourceFile.getLineAndCharacterOfPosition(current.getStart(sourceFile)) : containingListOrParentStart;
                }
                return indentationDelta + getBaseIndentation(options);
            }
            function getContainingListOrParentStart(parent, child, sourceFile) {
                const containingList = getContainingList(child, sourceFile);
                const startPos = containingList ? containingList.pos : parent.getStart(sourceFile);
                return sourceFile.getLineAndCharacterOfPosition(startPos);
            }
            /*
             * Function returns Value.Unknown if indentation cannot be determined
             */
            function getActualIndentationForListItemBeforeComma(commaToken, sourceFile, options) {
                // previous token is comma that separates items in list - find the previous item and try to derive indentation from it
                const commaItemInfo = ts.findListItemInfo(commaToken);
                if (commaItemInfo && commaItemInfo.listItemIndex > 0) {
                    return deriveActualIndentationFromList(commaItemInfo.list.getChildren(), commaItemInfo.listItemIndex - 1, sourceFile, options);
                }
                else {
                    // handle broken code gracefully
                    return -1 /* Unknown */;
                }
            }
            /*
             * Function returns Value.Unknown if actual indentation for node should not be used (i.e because node is nested expression)
             */
            function getActualIndentationForNode(current, parent, currentLineAndChar, parentAndChildShareLine, sourceFile, options) {
                // actual indentation is used for statements\declarations if one of cases below is true:
                // - parent is SourceFile - by default immediate children of SourceFile are not indented except when user indents them manually
                // - parent and child are not on the same line
                const useActualIndentation = (ts.isDeclaration(current) || ts.isStatementButNotDeclaration(current)) &&
                    (parent.kind === ts.SyntaxKind.SourceFile || !parentAndChildShareLine);
                if (!useActualIndentation) {
                    return -1 /* Unknown */;
                }
                return findColumnForFirstNonWhitespaceCharacterInLine(currentLineAndChar, sourceFile, options);
            }
            function nextTokenIsCurlyBraceOnSameLineAsCursor(precedingToken, current, lineAtPosition, sourceFile) {
                const nextToken = ts.findNextToken(precedingToken, current);
                if (!nextToken) {
                    return 0 /* Unknown */;
                }
                if (nextToken.kind === ts.SyntaxKind.OpenBraceToken) {
                    // open braces are always indented at the parent level
                    return 1 /* OpenBrace */;
                }
                else if (nextToken.kind === ts.SyntaxKind.CloseBraceToken) {
                    // close braces are indented at the parent level if they are located on the same line with cursor
                    // this means that if new line will be added at $ position, this case will be indented
                    // class A {
                    //    $
                    // }
                    /// and this one - not
                    // class A {
                    // $}
                    const nextTokenStartLine = getStartLineAndCharacterForNode(nextToken, sourceFile).line;
                    return lineAtPosition === nextTokenStartLine ? 2 /* CloseBrace */ : 0 /* Unknown */;
                }
                return 0 /* Unknown */;
            }
            function getStartLineAndCharacterForNode(n, sourceFile) {
                return sourceFile.getLineAndCharacterOfPosition(n.getStart(sourceFile));
            }
            function isArgumentAndStartLineOverlapsExpressionBeingCalled(parent, child, childStartLine, sourceFile) {
                if (!(ts.isCallExpression(parent) && ts.contains(parent.arguments, child))) {
                    return false;
                }
                const expressionOfCallExpressionEnd = parent.expression.getEnd();
                const expressionOfCallExpressionEndLine = ts.getLineAndCharacterOfPosition(sourceFile, expressionOfCallExpressionEnd).line;
                return expressionOfCallExpressionEndLine === childStartLine;
            }
            SmartIndenter.isArgumentAndStartLineOverlapsExpressionBeingCalled = isArgumentAndStartLineOverlapsExpressionBeingCalled;
            function childStartsOnTheSameLineWithElseInIfStatement(parent, child, childStartLine, sourceFile) {
                if (parent.kind === ts.SyntaxKind.IfStatement && parent.elseStatement === child) {
                    const elseKeyword = ts.findChildOfKind(parent, ts.SyntaxKind.ElseKeyword, sourceFile);
                    ts.Debug.assert(elseKeyword !== undefined);
                    const elseKeywordStartLine = getStartLineAndCharacterForNode(elseKeyword, sourceFile).line;
                    return elseKeywordStartLine === childStartLine;
                }
                return false;
            }
            SmartIndenter.childStartsOnTheSameLineWithElseInIfStatement = childStartsOnTheSameLineWithElseInIfStatement;
            function getListIfStartEndIsInListRange(list, start, end) {
                return list && ts.rangeContainsStartEnd(list, start, end) ? list : undefined;
            }
            function getContainingList(node, sourceFile) {
                if (node.parent) {
                    switch (node.parent.kind) {
                        case ts.SyntaxKind.TypeReference:
                            return getListIfStartEndIsInListRange(node.parent.typeArguments, node.getStart(sourceFile), node.getEnd());
                        case ts.SyntaxKind.ObjectLiteralExpression:
                            return node.parent.properties;
                        case ts.SyntaxKind.ArrayLiteralExpression:
                            return node.parent.elements;
                        case ts.SyntaxKind.FunctionDeclaration:
                        case ts.SyntaxKind.FunctionExpression:
                        case ts.SyntaxKind.ArrowFunction:
                        case ts.SyntaxKind.MethodDeclaration:
                        case ts.SyntaxKind.MethodSignature:
                        case ts.SyntaxKind.CallSignature:
                        case ts.SyntaxKind.Constructor:
                        case ts.SyntaxKind.ConstructorType:
                        case ts.SyntaxKind.ConstructSignature: {
                            const start = node.getStart(sourceFile);
                            return getListIfStartEndIsInListRange(node.parent.typeParameters, start, node.getEnd()) ||
                                getListIfStartEndIsInListRange(node.parent.parameters, start, node.getEnd());
                        }
                        case ts.SyntaxKind.ClassDeclaration:
                            return getListIfStartEndIsInListRange(node.parent.typeParameters, node.getStart(sourceFile), node.getEnd());
                        case ts.SyntaxKind.NewExpression:
                        case ts.SyntaxKind.CallExpression: {
                            const start = node.getStart(sourceFile);
                            return getListIfStartEndIsInListRange(node.parent.typeArguments, start, node.getEnd()) ||
                                getListIfStartEndIsInListRange(node.parent.arguments, start, node.getEnd());
                        }
                        case ts.SyntaxKind.VariableDeclarationList:
                            return getListIfStartEndIsInListRange(node.parent.declarations, node.getStart(sourceFile), node.getEnd());
                        case ts.SyntaxKind.NamedImports:
                        case ts.SyntaxKind.NamedExports:
                            return getListIfStartEndIsInListRange(node.parent.elements, node.getStart(sourceFile), node.getEnd());
                    }
                }
                return undefined;
            }
            SmartIndenter.getContainingList = getContainingList;
            function getActualIndentationForListItem(node, sourceFile, options) {
                const containingList = getContainingList(node, sourceFile);
                if (containingList) {
                    const index = containingList.indexOf(node);
                    if (index !== -1) {
                        return deriveActualIndentationFromList(containingList, index, sourceFile, options);
                    }
                }
                return -1 /* Unknown */;
            }
            function getLineIndentationWhenExpressionIsInMultiLine(node, sourceFile, options) {
                // actual indentation should not be used when:
                // - node is close parenthesis - this is the end of the expression
                if (node.kind === ts.SyntaxKind.CloseParenToken) {
                    return -1 /* Unknown */;
                }
                if (node.parent && ts.isCallOrNewExpression(node.parent) && node.parent.expression !== node) {
                    const fullCallOrNewExpression = node.parent.expression;
                    const startingExpression = getStartingExpression(fullCallOrNewExpression);
                    if (fullCallOrNewExpression === startingExpression) {
                        return -1 /* Unknown */;
                    }
                    const fullCallOrNewExpressionEnd = sourceFile.getLineAndCharacterOfPosition(fullCallOrNewExpression.end);
                    const startingExpressionEnd = sourceFile.getLineAndCharacterOfPosition(startingExpression.end);
                    if (fullCallOrNewExpressionEnd.line === startingExpressionEnd.line) {
                        return -1 /* Unknown */;
                    }
                    return findColumnForFirstNonWhitespaceCharacterInLine(fullCallOrNewExpressionEnd, sourceFile, options);
                }
                return -1 /* Unknown */;
                function getStartingExpression(node) {
                    while (true) {
                        switch (node.kind) {
                            case ts.SyntaxKind.CallExpression:
                            case ts.SyntaxKind.NewExpression:
                            case ts.SyntaxKind.PropertyAccessExpression:
                            case ts.SyntaxKind.ElementAccessExpression:
                                node = node.expression;
                                break;
                            default:
                                return node;
                        }
                    }
                }
            }
            function deriveActualIndentationFromList(list, index, sourceFile, options) {
                ts.Debug.assert(index >= 0 && index < list.length);
                const node = list[index];
                // walk toward the start of the list starting from current node and check if the line is the same for all items.
                // if end line for item [i - 1] differs from the start line for item [i] - find column of the first non-whitespace character on the line of item [i]
                let lineAndCharacter = getStartLineAndCharacterForNode(node, sourceFile);
                for (let i = index - 1; i >= 0; i--) {
                    if (list[i].kind === ts.SyntaxKind.CommaToken) {
                        continue;
                    }
                    // skip list items that ends on the same line with the current list element
                    const prevEndLine = sourceFile.getLineAndCharacterOfPosition(list[i].end).line;
                    if (prevEndLine !== lineAndCharacter.line) {
                        return findColumnForFirstNonWhitespaceCharacterInLine(lineAndCharacter, sourceFile, options);
                    }
                    lineAndCharacter = getStartLineAndCharacterForNode(list[i], sourceFile);
                }
                return -1 /* Unknown */;
            }
            function findColumnForFirstNonWhitespaceCharacterInLine(lineAndCharacter, sourceFile, options) {
                const lineStart = sourceFile.getPositionOfLineAndCharacter(lineAndCharacter.line, 0);
                return findFirstNonWhitespaceColumn(lineStart, lineStart + lineAndCharacter.character, sourceFile, options);
            }
            /**
             * Character is the actual index of the character since the beginning of the line.
             * Column - position of the character after expanding tabs to spaces.
             * "0\t2$"
             * value of 'character' for '$' is 3
             * value of 'column' for '$' is 6 (assuming that tab size is 4)
             */
            function findFirstNonWhitespaceCharacterAndColumn(startPos, endPos, sourceFile, options) {
                let character = 0;
                let column = 0;
                for (let pos = startPos; pos < endPos; pos++) {
                    const ch = sourceFile.text.charCodeAt(pos);
                    if (!ts.isWhiteSpaceSingleLine(ch)) {
                        break;
                    }
                    if (ch === 9 /* tab */) {
                        column += options.tabSize + (column % options.tabSize);
                    }
                    else {
                        column++;
                    }
                    character++;
                }
                return { column, character };
            }
            SmartIndenter.findFirstNonWhitespaceCharacterAndColumn = findFirstNonWhitespaceCharacterAndColumn;
            function findFirstNonWhitespaceColumn(startPos, endPos, sourceFile, options) {
                return findFirstNonWhitespaceCharacterAndColumn(startPos, endPos, sourceFile, options).column;
            }
            SmartIndenter.findFirstNonWhitespaceColumn = findFirstNonWhitespaceColumn;
            function nodeContentIsAlwaysIndented(kind) {
                switch (kind) {
                    case ts.SyntaxKind.ExpressionStatement:
                    case ts.SyntaxKind.ClassDeclaration:
                    case ts.SyntaxKind.ClassExpression:
                    case ts.SyntaxKind.InterfaceDeclaration:
                    case ts.SyntaxKind.EnumDeclaration:
                    case ts.SyntaxKind.TypeAliasDeclaration:
                    case ts.SyntaxKind.ArrayLiteralExpression:
                    case ts.SyntaxKind.Block:
                    case ts.SyntaxKind.ModuleBlock:
                    case ts.SyntaxKind.ObjectLiteralExpression:
                    case ts.SyntaxKind.TypeLiteral:
                    case ts.SyntaxKind.MappedType:
                    case ts.SyntaxKind.TupleType:
                    case ts.SyntaxKind.CaseBlock:
                    case ts.SyntaxKind.DefaultClause:
                    case ts.SyntaxKind.CaseClause:
                    case ts.SyntaxKind.ParenthesizedExpression:
                    case ts.SyntaxKind.PropertyAccessExpression:
                    case ts.SyntaxKind.CallExpression:
                    case ts.SyntaxKind.NewExpression:
                    case ts.SyntaxKind.VariableStatement:
                    case ts.SyntaxKind.VariableDeclaration:
                    case ts.SyntaxKind.ExportAssignment:
                    case ts.SyntaxKind.ReturnStatement:
                    case ts.SyntaxKind.ConditionalExpression:
                    case ts.SyntaxKind.ArrayBindingPattern:
                    case ts.SyntaxKind.ObjectBindingPattern:
                    case ts.SyntaxKind.JsxOpeningElement:
                    case ts.SyntaxKind.JsxOpeningFragment:
                    case ts.SyntaxKind.JsxSelfClosingElement:
                    case ts.SyntaxKind.JsxExpression:
                    case ts.SyntaxKind.MethodSignature:
                    case ts.SyntaxKind.CallSignature:
                    case ts.SyntaxKind.ConstructSignature:
                    case ts.SyntaxKind.Parameter:
                    case ts.SyntaxKind.FunctionType:
                    case ts.SyntaxKind.ConstructorType:
                    case ts.SyntaxKind.ParenthesizedType:
                    case ts.SyntaxKind.TaggedTemplateExpression:
                    case ts.SyntaxKind.AwaitExpression:
                    case ts.SyntaxKind.NamedExports:
                    case ts.SyntaxKind.NamedImports:
                    case ts.SyntaxKind.ExportSpecifier:
                    case ts.SyntaxKind.ImportSpecifier:
                    case ts.SyntaxKind.PropertyAssignment:
                    case ts.SyntaxKind.PropertyDeclaration:
                        return true;
                }
                return false;
            }
            function nodeWillIndentChild(settings, parent, child, sourceFile, indentByDefault) {
                const childKind = child ? child.kind : ts.SyntaxKind.Unknown;
                switch (parent.kind) {
                    case ts.SyntaxKind.VariableDeclaration:
                    case ts.SyntaxKind.PropertyAssignment:
                    case ts.SyntaxKind.ObjectLiteralExpression:
                        if (!settings.indentMultiLineObjectLiteralBeginningOnBlankLine && sourceFile && childKind === ts.SyntaxKind.ObjectLiteralExpression) {
                            return rangeIsOnOneLine(sourceFile, child);
                        }
                        break;
                    case ts.SyntaxKind.DoStatement:
                    case ts.SyntaxKind.WhileStatement:
                    case ts.SyntaxKind.ForInStatement:
                    case ts.SyntaxKind.ForOfStatement:
                    case ts.SyntaxKind.ForStatement:
                    case ts.SyntaxKind.IfStatement:
                    case ts.SyntaxKind.FunctionDeclaration:
                    case ts.SyntaxKind.FunctionExpression:
                    case ts.SyntaxKind.MethodDeclaration:
                    case ts.SyntaxKind.ArrowFunction:
                    case ts.SyntaxKind.Constructor:
                    case ts.SyntaxKind.GetAccessor:
                    case ts.SyntaxKind.SetAccessor:
                        return childKind !== ts.SyntaxKind.Block;
                    case ts.SyntaxKind.ExportDeclaration:
                        return childKind !== ts.SyntaxKind.NamedExports;
                    case ts.SyntaxKind.ImportDeclaration:
                        return childKind !== ts.SyntaxKind.ImportClause ||
                            (!!child.namedBindings && child.namedBindings.kind !== ts.SyntaxKind.NamedImports);
                    case ts.SyntaxKind.JsxElement:
                        return childKind !== ts.SyntaxKind.JsxClosingElement;
                    case ts.SyntaxKind.JsxFragment:
                        return childKind !== ts.SyntaxKind.JsxClosingFragment;
                }
                // No explicit rule for given nodes so the result will follow the default value argument
                return indentByDefault;
            }
            SmartIndenter.nodeWillIndentChild = nodeWillIndentChild;
            function isControlFlowEndingStatement(kind, parent) {
                switch (kind) {
                    case ts.SyntaxKind.ReturnStatement:
                    case ts.SyntaxKind.ThrowStatement: {
                        if (parent.kind !== ts.SyntaxKind.Block) {
                            return true;
                        }
                        const grandParent = parent.parent;
                        // In a function, we may want to write inner functions after this.
                        return !(grandParent && grandParent.kind === ts.SyntaxKind.FunctionExpression || grandParent.kind === ts.SyntaxKind.FunctionDeclaration);
                    }
                    case ts.SyntaxKind.ContinueStatement:
                    case ts.SyntaxKind.BreakStatement:
                        return true;
                    default:
                        return false;
                }
            }
            /**
             * True when the parent node should indent the given child by an explicit rule.
             * @param isNextChild If true, we are judging indent of a hypothetical child *after* this one, not the current child.
             */
            function shouldIndentChildNode(settings, parent, child, sourceFile, isNextChild = false) {
                return (nodeContentIsAlwaysIndented(parent.kind) || nodeWillIndentChild(settings, parent, child, sourceFile, /*indentByDefault*/ false))
                    && !(isNextChild && child && isControlFlowEndingStatement(child.kind, parent));
            }
            SmartIndenter.shouldIndentChildNode = shouldIndentChildNode;
            function rangeIsOnOneLine(sourceFile, range) {
                const rangeStart = ts.skipTrivia(sourceFile.text, range.pos);
                const startLine = sourceFile.getLineAndCharacterOfPosition(rangeStart).line;
                const endLine = sourceFile.getLineAndCharacterOfPosition(range.end).line;
                return startLine === endLine;
            }
        })(SmartIndenter = formatting.SmartIndenter || (formatting.SmartIndenter = {}));
    })(formatting = ts.formatting || (ts.formatting = {}));
})(ts || (ts = {}));
