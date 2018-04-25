/* @internal */
var ts;
(function (ts) {
    var textChanges;
    (function (textChanges_1) {
        /**
         * Currently for simplicity we store recovered positions on the node itself.
         * It can be changed to side-table later if we decide that current design is too invasive.
         */
        function getPos(n) {
            const result = n.__pos;
            ts.Debug.assert(typeof result === "number");
            return result;
        }
        function setPos(n, pos) {
            ts.Debug.assert(typeof pos === "number");
            n.__pos = pos;
        }
        function getEnd(n) {
            const result = n.__end;
            ts.Debug.assert(typeof result === "number");
            return result;
        }
        function setEnd(n, end) {
            ts.Debug.assert(typeof end === "number");
            n.__end = end;
        }
        let Position;
        (function (Position) {
            Position[Position["FullStart"] = 0] = "FullStart";
            Position[Position["Start"] = 1] = "Start";
        })(Position = textChanges_1.Position || (textChanges_1.Position = {}));
        function skipWhitespacesAndLineBreaks(text, start) {
            return ts.skipTrivia(text, start, /*stopAfterLineBreak*/ false, /*stopAtComments*/ true);
        }
        function hasCommentsBeforeLineBreak(text, start) {
            let i = start;
            while (i < text.length) {
                const ch = text.charCodeAt(i);
                if (ts.isWhiteSpaceSingleLine(ch)) {
                    i++;
                    continue;
                }
                return ch === 47 /* slash */;
            }
            return false;
        }
        textChanges_1.useNonAdjustedPositions = {
            useNonAdjustedStartPosition: true,
            useNonAdjustedEndPosition: true,
        };
        let ChangeKind;
        (function (ChangeKind) {
            ChangeKind[ChangeKind["Remove"] = 0] = "Remove";
            ChangeKind[ChangeKind["ReplaceWithSingleNode"] = 1] = "ReplaceWithSingleNode";
            ChangeKind[ChangeKind["ReplaceWithMultipleNodes"] = 2] = "ReplaceWithMultipleNodes";
            ChangeKind[ChangeKind["Text"] = 3] = "Text";
        })(ChangeKind || (ChangeKind = {}));
        function getAdjustedRange(sourceFile, startNode, endNode, options) {
            return { pos: getAdjustedStartPosition(sourceFile, startNode, options, Position.Start), end: getAdjustedEndPosition(sourceFile, endNode, options) };
        }
        function getAdjustedStartPosition(sourceFile, node, options, position) {
            if (options.useNonAdjustedStartPosition) {
                return node.getStart(sourceFile);
            }
            const fullStart = node.getFullStart();
            const start = node.getStart(sourceFile);
            if (fullStart === start) {
                return start;
            }
            const fullStartLine = ts.getLineStartPositionForPosition(fullStart, sourceFile);
            const startLine = ts.getLineStartPositionForPosition(start, sourceFile);
            if (startLine === fullStartLine) {
                // full start and start of the node are on the same line
                //   a,     b;
                //    ^     ^
                //    |   start
                // fullstart
                // when b is replaced - we usually want to keep the leading trvia
                // when b is deleted - we delete it
                return position === Position.Start ? start : fullStart;
            }
            // get start position of the line following the line that contains fullstart position
            // (but only if the fullstart isn't the very beginning of the file)
            const nextLineStart = fullStart > 0 ? 1 : 0;
            let adjustedStartPosition = ts.getStartPositionOfLine(ts.getLineOfLocalPosition(sourceFile, fullStartLine) + nextLineStart, sourceFile);
            // skip whitespaces/newlines
            adjustedStartPosition = skipWhitespacesAndLineBreaks(sourceFile.text, adjustedStartPosition);
            return ts.getStartPositionOfLine(ts.getLineOfLocalPosition(sourceFile, adjustedStartPosition), sourceFile);
        }
        function getAdjustedEndPosition(sourceFile, node, options) {
            if (options.useNonAdjustedEndPosition || ts.isExpression(node)) {
                return node.getEnd();
            }
            const end = node.getEnd();
            const newEnd = ts.skipTrivia(sourceFile.text, end, /*stopAfterLineBreak*/ true);
            return newEnd !== end && ts.isLineBreak(sourceFile.text.charCodeAt(newEnd - 1))
                ? newEnd
                : end;
        }
        /**
         * Checks if 'candidate' argument is a legal separator in the list that contains 'node' as an element
         */
        function isSeparator(node, candidate) {
            return candidate && node.parent && (candidate.kind === ts.SyntaxKind.CommaToken || (candidate.kind === ts.SyntaxKind.SemicolonToken && node.parent.kind === ts.SyntaxKind.ObjectLiteralExpression));
        }
        function spaces(count) {
            let s = "";
            for (let i = 0; i < count; i++) {
                s += " ";
            }
            return s;
        }
        class ChangeTracker {
            /** Public for tests only. Other callers should use `ChangeTracker.with`. */
            constructor(newLineCharacter, formatContext) {
                this.newLineCharacter = newLineCharacter;
                this.formatContext = formatContext;
                this.changes = [];
                this.deletedNodesInLists = []; // Stores ids of nodes in lists that we already deleted. Used to avoid deleting `, ` twice in `a, b`.
                // Map from class id to nodes to insert at the start
                this.nodesInsertedAtClassStarts = ts.createMap();
            }
            static fromContext(context) {
                return new ChangeTracker(ts.getNewLineOrDefaultFromHost(context.host, context.formatContext.options), context.formatContext);
            }
            static with(context, cb) {
                const tracker = ChangeTracker.fromContext(context);
                cb(tracker);
                return tracker.getChanges();
            }
            deleteRange(sourceFile, range) {
                this.changes.push({ kind: ChangeKind.Remove, sourceFile, range });
                return this;
            }
            /** Warning: This deletes comments too. See `copyComments` in `convertFunctionToEs6Class`. */
            deleteNode(sourceFile, node, options = {}) {
                const startPosition = getAdjustedStartPosition(sourceFile, node, options, Position.FullStart);
                const endPosition = getAdjustedEndPosition(sourceFile, node, options);
                this.deleteRange(sourceFile, { pos: startPosition, end: endPosition });
                return this;
            }
            deleteNodeRange(sourceFile, startNode, endNode, options = {}) {
                const startPosition = getAdjustedStartPosition(sourceFile, startNode, options, Position.FullStart);
                const endPosition = getAdjustedEndPosition(sourceFile, endNode, options);
                this.deleteRange(sourceFile, { pos: startPosition, end: endPosition });
                return this;
            }
            deleteNodeInList(sourceFile, node) {
                const containingList = ts.formatting.SmartIndenter.getContainingList(node, sourceFile);
                if (!containingList) {
                    ts.Debug.fail("node is not a list element");
                    return this;
                }
                const index = ts.indexOfNode(containingList, node);
                if (index < 0) {
                    return this;
                }
                if (containingList.length === 1) {
                    this.deleteNode(sourceFile, node);
                    return this;
                }
                const id = ts.getNodeId(node);
                ts.Debug.assert(!this.deletedNodesInLists[id], "Deleting a node twice");
                this.deletedNodesInLists[id] = true;
                if (index !== containingList.length - 1) {
                    const nextToken = ts.getTokenAtPosition(sourceFile, node.end, /*includeJsDocComment*/ false);
                    if (nextToken && isSeparator(node, nextToken)) {
                        // find first non-whitespace position in the leading trivia of the node
                        const startPosition = ts.skipTrivia(sourceFile.text, getAdjustedStartPosition(sourceFile, node, {}, Position.FullStart), /*stopAfterLineBreak*/ false, /*stopAtComments*/ true);
                        const nextElement = containingList[index + 1];
                        /// find first non-whitespace position in the leading trivia of the next node
                        const endPosition = ts.skipTrivia(sourceFile.text, getAdjustedStartPosition(sourceFile, nextElement, {}, Position.FullStart), /*stopAfterLineBreak*/ false, /*stopAtComments*/ true);
                        // shift next node so its first non-whitespace position will be moved to the first non-whitespace position of the deleted node
                        this.deleteRange(sourceFile, { pos: startPosition, end: endPosition });
                    }
                }
                else {
                    const prev = containingList[index - 1];
                    if (this.deletedNodesInLists[ts.getNodeId(prev)]) {
                        const pos = ts.skipTrivia(sourceFile.text, getAdjustedStartPosition(sourceFile, node, {}, Position.FullStart), /*stopAfterLineBreak*/ false, /*stopAtComments*/ true);
                        const end = getAdjustedEndPosition(sourceFile, node, {});
                        this.deleteRange(sourceFile, { pos, end });
                    }
                    else {
                        const previousToken = ts.getTokenAtPosition(sourceFile, containingList[index - 1].end, /*includeJsDocComment*/ false);
                        if (previousToken && isSeparator(node, previousToken)) {
                            this.deleteNodeRange(sourceFile, previousToken, node);
                        }
                    }
                }
                return this;
            }
            replaceRange(sourceFile, range, newNode, options = {}) {
                this.changes.push({ kind: ChangeKind.ReplaceWithSingleNode, sourceFile, range, options, node: newNode });
                return this;
            }
            replaceNode(sourceFile, oldNode, newNode, options = textChanges_1.useNonAdjustedPositions) {
                return this.replaceRange(sourceFile, getAdjustedRange(sourceFile, oldNode, oldNode, options), newNode, options);
            }
            replaceNodeRange(sourceFile, startNode, endNode, newNode, options = textChanges_1.useNonAdjustedPositions) {
                this.replaceRange(sourceFile, getAdjustedRange(sourceFile, startNode, endNode, options), newNode, options);
            }
            replaceRangeWithNodes(sourceFile, range, newNodes, options = {}) {
                this.changes.push({ kind: ChangeKind.ReplaceWithMultipleNodes, sourceFile, range, options, nodes: newNodes });
                return this;
            }
            replaceNodeWithNodes(sourceFile, oldNode, newNodes, options = textChanges_1.useNonAdjustedPositions) {
                return this.replaceRangeWithNodes(sourceFile, getAdjustedRange(sourceFile, oldNode, oldNode, options), newNodes, options);
            }
            replaceNodeRangeWithNodes(sourceFile, startNode, endNode, newNodes, options = textChanges_1.useNonAdjustedPositions) {
                return this.replaceRangeWithNodes(sourceFile, getAdjustedRange(sourceFile, startNode, endNode, options), newNodes, options);
            }
            replacePropertyAssignment(sourceFile, oldNode, newNode) {
                return this.replaceNode(sourceFile, oldNode, newNode, {
                    suffix: "," + this.newLineCharacter
                });
            }
            insertNodeAt(sourceFile, pos, newNode, options = {}) {
                this.replaceRange(sourceFile, ts.createTextRange(pos), newNode, options);
            }
            insertNodesAt(sourceFile, pos, newNodes, options = {}) {
                this.changes.push({ kind: ChangeKind.ReplaceWithMultipleNodes, sourceFile, options, nodes: newNodes, range: { pos, end: pos } });
            }
            insertNodeAtTopOfFile(sourceFile, newNode, blankLineBetween) {
                const pos = getInsertionPositionAtSourceFileTop(sourceFile);
                this.insertNodeAt(sourceFile, pos, newNode, {
                    prefix: pos === 0 ? undefined : this.newLineCharacter,
                    suffix: (ts.isLineBreak(sourceFile.text.charCodeAt(pos)) ? "" : this.newLineCharacter) + (blankLineBetween ? this.newLineCharacter : ""),
                });
            }
            insertNodeBefore(sourceFile, before, newNode, blankLineBetween = false) {
                const pos = getAdjustedStartPosition(sourceFile, before, {}, Position.Start);
                return this.replaceRange(sourceFile, { pos, end: pos }, newNode, this.getOptionsForInsertNodeBefore(before, blankLineBetween));
            }
            insertModifierBefore(sourceFile, modifier, before) {
                const pos = before.getStart(sourceFile);
                this.replaceRange(sourceFile, { pos, end: pos }, ts.createToken(modifier), { suffix: " " });
            }
            insertCommentBeforeLine(sourceFile, lineNumber, position, commentText) {
                const lineStartPosition = ts.getStartPositionOfLine(lineNumber, sourceFile);
                const startPosition = ts.getFirstNonSpaceCharacterPosition(sourceFile.text, lineStartPosition);
                // First try to see if we can put the comment on the previous line.
                // We need to make sure that we are not in the middle of a string literal or a comment.
                // If so, we do not want to separate the node from its comment if we can.
                // Otherwise, add an extra new line immediately before the error span.
                const insertAtLineStart = isValidLocationToAddComment(sourceFile, startPosition);
                const token = ts.getTouchingToken(sourceFile, insertAtLineStart ? startPosition : position, /*includeJsDocComment*/ false);
                const text = `${insertAtLineStart ? "" : this.newLineCharacter}${sourceFile.text.slice(lineStartPosition, startPosition)}//${commentText}${this.newLineCharacter}`;
                this.insertText(sourceFile, token.getStart(sourceFile), text);
            }
            replaceRangeWithText(sourceFile, range, text) {
                this.changes.push({ kind: ChangeKind.Text, sourceFile, range, text });
            }
            insertText(sourceFile, pos, text) {
                this.replaceRangeWithText(sourceFile, ts.createTextRange(pos), text);
            }
            /** Prefer this over replacing a node with another that has a type annotation, as it avoids reformatting the other parts of the node. */
            tryInsertTypeAnnotation(sourceFile, node, type) {
                let endNode;
                if (ts.isFunctionLike(node)) {
                    endNode = ts.findChildOfKind(node, ts.SyntaxKind.CloseParenToken, sourceFile);
                    if (!endNode) {
                        if (!ts.isArrowFunction(node))
                            return; // Function missing parentheses, give up
                        // If no `)`, is an arrow function `x => x`, so use the end of the first parameter
                        endNode = ts.first(node.parameters);
                    }
                }
                else {
                    endNode = node.kind !== ts.SyntaxKind.VariableDeclaration && node.questionToken ? node.questionToken : node.name;
                }
                this.insertNodeAt(sourceFile, endNode.end, type, { prefix: ": " });
            }
            insertTypeParameters(sourceFile, node, typeParameters) {
                // If no `(`, is an arrow function `x => x`, so use the pos of the first parameter
                const start = (ts.findChildOfKind(node, ts.SyntaxKind.OpenParenToken, sourceFile) || ts.first(node.parameters)).getStart(sourceFile);
                this.insertNodesAt(sourceFile, start, typeParameters, { prefix: "<", suffix: ">" });
            }
            getOptionsForInsertNodeBefore(before, doubleNewlines) {
                if (ts.isStatement(before) || ts.isClassElement(before)) {
                    return { suffix: doubleNewlines ? this.newLineCharacter + this.newLineCharacter : this.newLineCharacter };
                }
                else if (ts.isVariableDeclaration(before)) { // insert `x = 1, ` into `const x = 1, y = 2;
                    return { suffix: ", " };
                }
                else if (ts.isParameter(before)) {
                    return {};
                }
                return ts.Debug.failBadSyntaxKind(before); // We haven't handled this kind of node yet -- add it
            }
            insertNodeAtConstructorStart(sourceFile, ctr, newStatement) {
                const firstStatement = ts.firstOrUndefined(ctr.body.statements);
                if (!firstStatement || !ctr.body.multiLine) {
                    this.replaceConstructorBody(sourceFile, ctr, [newStatement, ...ctr.body.statements]);
                }
                else {
                    this.insertNodeBefore(sourceFile, firstStatement, newStatement);
                }
            }
            insertNodeAtConstructorEnd(sourceFile, ctr, newStatement) {
                const lastStatement = ts.lastOrUndefined(ctr.body.statements);
                if (!lastStatement || !ctr.body.multiLine) {
                    this.replaceConstructorBody(sourceFile, ctr, [...ctr.body.statements, newStatement]);
                }
                else {
                    this.insertNodeAfter(sourceFile, lastStatement, newStatement);
                }
            }
            replaceConstructorBody(sourceFile, ctr, statements) {
                this.replaceNode(sourceFile, ctr.body, ts.createBlock(statements, /*multiLine*/ true));
            }
            insertNodeAtEndOfScope(sourceFile, scope, newNode) {
                const pos = getAdjustedStartPosition(sourceFile, scope.getLastToken(), {}, Position.Start);
                this.replaceRange(sourceFile, { pos, end: pos }, newNode, {
                    prefix: ts.isLineBreak(sourceFile.text.charCodeAt(scope.getLastToken().pos)) ? this.newLineCharacter : this.newLineCharacter + this.newLineCharacter,
                    suffix: this.newLineCharacter
                });
            }
            insertNodeAtClassStart(sourceFile, cls, newElement) {
                const firstMember = ts.firstOrUndefined(cls.members);
                if (!firstMember) {
                    const id = ts.getNodeId(cls).toString();
                    const newMembers = this.nodesInsertedAtClassStarts.get(id);
                    if (newMembers) {
                        ts.Debug.assert(newMembers.sourceFile === sourceFile && newMembers.cls === cls);
                        newMembers.members.push(newElement);
                    }
                    else {
                        this.nodesInsertedAtClassStarts.set(id, { sourceFile, cls, members: [newElement] });
                    }
                }
                else {
                    this.insertNodeBefore(sourceFile, firstMember, newElement);
                }
            }
            insertNodeAfter(sourceFile, after, newNode) {
                if (needSemicolonBetween(after, newNode)) {
                    // check if previous statement ends with semicolon
                    // if not - insert semicolon to preserve the code from changing the meaning due to ASI
                    if (sourceFile.text.charCodeAt(after.end - 1) !== 59 /* semicolon */) {
                        this.replaceRange(sourceFile, ts.createTextRange(after.end), ts.createToken(ts.SyntaxKind.SemicolonToken));
                    }
                }
                const endPosition = getAdjustedEndPosition(sourceFile, after, {});
                return this.replaceRange(sourceFile, ts.createTextRange(endPosition), newNode, this.getInsertNodeAfterOptions(after));
            }
            getInsertNodeAfterOptions(node) {
                if (ts.isClassDeclaration(node) || ts.isModuleDeclaration(node)) {
                    return { prefix: this.newLineCharacter, suffix: this.newLineCharacter };
                }
                else if (ts.isStatement(node) || ts.isClassOrTypeElement(node)) {
                    return { suffix: this.newLineCharacter };
                }
                else if (ts.isVariableDeclaration(node)) {
                    return { prefix: ", " };
                }
                else if (ts.isPropertyAssignment(node)) {
                    return { suffix: "," + this.newLineCharacter };
                }
                else if (ts.isParameter(node)) {
                    return {};
                }
                return ts.Debug.failBadSyntaxKind(node); // We haven't handled this kind of node yet -- add it
            }
            insertName(sourceFile, node, name) {
                ts.Debug.assert(!node.name);
                if (node.kind === ts.SyntaxKind.ArrowFunction) {
                    const arrow = ts.findChildOfKind(node, ts.SyntaxKind.EqualsGreaterThanToken, sourceFile);
                    const lparen = ts.findChildOfKind(node, ts.SyntaxKind.OpenParenToken, sourceFile);
                    if (lparen) {
                        // `() => {}` --> `function f() {}`
                        this.insertNodesAt(sourceFile, lparen.getStart(sourceFile), [ts.createToken(ts.SyntaxKind.FunctionKeyword), ts.createIdentifier(name)], { joiner: " " });
                        this.deleteNode(sourceFile, arrow);
                    }
                    else {
                        // `x => {}` -> `function f(x) {}`
                        this.insertText(sourceFile, ts.first(node.parameters).getStart(sourceFile), `function ${name}(`);
                        // Replacing full range of arrow to get rid of the leading space -- replace ` =>` with `)`
                        this.replaceRange(sourceFile, arrow, ts.createToken(ts.SyntaxKind.CloseParenToken));
                    }
                    if (node.body.kind !== ts.SyntaxKind.Block) {
                        // `() => 0` => `function f() { return 0; }`
                        this.insertNodesAt(sourceFile, node.body.getStart(sourceFile), [ts.createToken(ts.SyntaxKind.OpenBraceToken), ts.createToken(ts.SyntaxKind.ReturnKeyword)], { joiner: " ", suffix: " " });
                        this.insertNodesAt(sourceFile, node.body.end, [ts.createToken(ts.SyntaxKind.SemicolonToken), ts.createToken(ts.SyntaxKind.CloseBraceToken)], { joiner: " " });
                    }
                }
                else {
                    const pos = ts.findChildOfKind(node, node.kind === ts.SyntaxKind.FunctionExpression ? ts.SyntaxKind.FunctionKeyword : ts.SyntaxKind.ClassKeyword, sourceFile).end;
                    this.insertNodeAt(sourceFile, pos, ts.createIdentifier(name), { prefix: " " });
                }
            }
            /**
             * This function should be used to insert nodes in lists when nodes don't carry separators as the part of the node range,
             * i.e. arguments in arguments lists, parameters in parameter lists etc.
             * Note that separators are part of the node in statements and class elements.
             */
            insertNodeInListAfter(sourceFile, after, newNode) {
                const containingList = ts.formatting.SmartIndenter.getContainingList(after, sourceFile);
                if (!containingList) {
                    ts.Debug.fail("node is not a list element");
                    return this;
                }
                const index = ts.indexOfNode(containingList, after);
                if (index < 0) {
                    return this;
                }
                const end = after.getEnd();
                if (index !== containingList.length - 1) {
                    // any element except the last one
                    // use next sibling as an anchor
                    const nextToken = ts.getTokenAtPosition(sourceFile, after.end, /*includeJsDocComment*/ false);
                    if (nextToken && isSeparator(after, nextToken)) {
                        // for list
                        // a, b, c
                        // create change for adding 'e' after 'a' as
                        // - find start of next element after a (it is b)
                        // - use this start as start and end position in final change
                        // - build text of change by formatting the text of node + separator + whitespace trivia of b
                        // in multiline case it will work as
                        //   a,
                        //   b,
                        //   c,
                        // result - '*' denotes leading trivia that will be inserted after new text (displayed as '#')
                        //   a,*
                        // ***insertedtext<separator>#
                        // ###b,
                        //   c,
                        // find line and character of the next element
                        const lineAndCharOfNextElement = ts.getLineAndCharacterOfPosition(sourceFile, skipWhitespacesAndLineBreaks(sourceFile.text, containingList[index + 1].getFullStart()));
                        // find line and character of the token that precedes next element (usually it is separator)
                        const lineAndCharOfNextToken = ts.getLineAndCharacterOfPosition(sourceFile, nextToken.end);
                        let prefix;
                        let startPos;
                        if (lineAndCharOfNextToken.line === lineAndCharOfNextElement.line) {
                            // next element is located on the same line with separator:
                            // a,$$$$b
                            //  ^    ^
                            //  |    |-next element
                            //  |-separator
                            // where $$$ is some leading trivia
                            // for a newly inserted node we'll maintain the same relative position comparing to separator and replace leading trivia with spaces
                            // a,    x,$$$$b
                            //  ^    ^     ^
                            //  |    |     |-next element
                            //  |    |-new inserted node padded with spaces
                            //  |-separator
                            startPos = nextToken.end;
                            prefix = spaces(lineAndCharOfNextElement.character - lineAndCharOfNextToken.character);
                        }
                        else {
                            // next element is located on different line that separator
                            // let insert position be the beginning of the line that contains next element
                            startPos = ts.getStartPositionOfLine(lineAndCharOfNextElement.line, sourceFile);
                        }
                        // write separator and leading trivia of the next element as suffix
                        const suffix = `${ts.tokenToString(nextToken.kind)}${sourceFile.text.substring(nextToken.end, containingList[index + 1].getStart(sourceFile))}`;
                        this.replaceRange(sourceFile, ts.createTextRange(startPos, containingList[index + 1].getStart(sourceFile)), newNode, { prefix, suffix });
                    }
                }
                else {
                    const afterStart = after.getStart(sourceFile);
                    const afterStartLinePosition = ts.getLineStartPositionForPosition(afterStart, sourceFile);
                    let separator;
                    let multilineList = false;
                    // insert element after the last element in the list that has more than one item
                    // pick the element preceding the after element to:
                    // - pick the separator
                    // - determine if list is a multiline
                    if (containingList.length === 1) {
                        // if list has only one element then we'll format is as multiline if node has comment in trailing trivia, or as singleline otherwise
                        // i.e. var x = 1 // this is x
                        //     | new element will be inserted at this position
                        separator = ts.SyntaxKind.CommaToken;
                    }
                    else {
                        // element has more than one element, pick separator from the list
                        const tokenBeforeInsertPosition = ts.findPrecedingToken(after.pos, sourceFile);
                        separator = isSeparator(after, tokenBeforeInsertPosition) ? tokenBeforeInsertPosition.kind : ts.SyntaxKind.CommaToken;
                        // determine if list is multiline by checking lines of after element and element that precedes it.
                        const afterMinusOneStartLinePosition = ts.getLineStartPositionForPosition(containingList[index - 1].getStart(sourceFile), sourceFile);
                        multilineList = afterMinusOneStartLinePosition !== afterStartLinePosition;
                    }
                    if (hasCommentsBeforeLineBreak(sourceFile.text, after.end)) {
                        // in this case we'll always treat containing list as multiline
                        multilineList = true;
                    }
                    if (multilineList) {
                        // insert separator immediately following the 'after' node to preserve comments in trailing trivia
                        this.replaceRange(sourceFile, ts.createTextRange(end), ts.createToken(separator));
                        // use the same indentation as 'after' item
                        const indentation = ts.formatting.SmartIndenter.findFirstNonWhitespaceColumn(afterStartLinePosition, afterStart, sourceFile, this.formatContext.options);
                        // insert element before the line break on the line that contains 'after' element
                        let insertPos = ts.skipTrivia(sourceFile.text, end, /*stopAfterLineBreak*/ true, /*stopAtComments*/ false);
                        if (insertPos !== end && ts.isLineBreak(sourceFile.text.charCodeAt(insertPos - 1))) {
                            insertPos--;
                        }
                        this.replaceRange(sourceFile, ts.createTextRange(insertPos), newNode, { indentation, prefix: this.newLineCharacter });
                    }
                    else {
                        this.replaceRange(sourceFile, ts.createTextRange(end), newNode, { prefix: `${ts.tokenToString(separator)} ` });
                    }
                }
                return this;
            }
            finishInsertNodeAtClassStart() {
                this.nodesInsertedAtClassStarts.forEach(({ sourceFile, cls, members }) => {
                    const newCls = cls.kind === ts.SyntaxKind.ClassDeclaration
                        ? ts.updateClassDeclaration(cls, cls.decorators, cls.modifiers, cls.name, cls.typeParameters, cls.heritageClauses, members)
                        : ts.updateClassExpression(cls, cls.modifiers, cls.name, cls.typeParameters, cls.heritageClauses, members);
                    this.replaceNode(sourceFile, cls, newCls);
                });
            }
            /**
             * Note: after calling this, the TextChanges object must be discarded!
             * @param validate only for tests
             *    The reason we must validate as part of this method is that `getNonFormattedText` changes the node's positions,
             *    so we can only call this once and can't get the non-formatted text separately.
             */
            getChanges(validate) {
                this.finishInsertNodeAtClassStart();
                return changesToText.getTextChangesFromChanges(this.changes, this.newLineCharacter, this.formatContext, validate);
            }
        }
        textChanges_1.ChangeTracker = ChangeTracker;
        let changesToText;
        (function (changesToText) {
            function getTextChangesFromChanges(changes, newLineCharacter, formatContext, validate) {
                return ts.group(changes, c => c.sourceFile.path).map(changesInFile => {
                    const sourceFile = changesInFile[0].sourceFile;
                    // order changes by start position
                    const normalized = ts.stableSort(changesInFile, (a, b) => a.range.pos - b.range.pos);
                    // verify that change intervals do not overlap, except possibly at end points.
                    for (let i = 0; i < normalized.length - 1; i++) {
                        ts.Debug.assert(normalized[i].range.end <= normalized[i + 1].range.pos, "Changes overlap", () => `${JSON.stringify(normalized[i].range)} and ${JSON.stringify(normalized[i + 1].range)}`);
                    }
                    const textChanges = normalized.map(c => ts.createTextChange(ts.createTextSpanFromRange(c.range), computeNewText(c, sourceFile, newLineCharacter, formatContext, validate)));
                    return { fileName: sourceFile.fileName, textChanges };
                });
            }
            changesToText.getTextChangesFromChanges = getTextChangesFromChanges;
            function computeNewText(change, sourceFile, newLineCharacter, formatContext, validate) {
                if (change.kind === ChangeKind.Remove) {
                    return "";
                }
                if (change.kind === ChangeKind.Text) {
                    return change.text;
                }
                const { options = {}, range: { pos } } = change;
                const format = (n) => getFormattedTextOfNode(n, sourceFile, pos, options, newLineCharacter, formatContext, validate);
                const text = change.kind === ChangeKind.ReplaceWithMultipleNodes
                    ? change.nodes.map(n => ts.removeSuffix(format(n), newLineCharacter)).join(change.options.joiner || newLineCharacter)
                    : format(change.node);
                // strip initial indentation (spaces or tabs) if text will be inserted in the middle of the line
                const noIndent = (options.preserveLeadingWhitespace || options.indentation !== undefined || ts.getLineStartPositionForPosition(pos, sourceFile) === pos) ? text : text.replace(/^\s+/, "");
                return (options.prefix || "") + noIndent + (options.suffix || "");
            }
            /** Note: this may mutate `nodeIn`. */
            function getFormattedTextOfNode(nodeIn, sourceFile, pos, { indentation, prefix, delta }, newLineCharacter, formatContext, validate) {
                const { node, text } = getNonformattedText(nodeIn, sourceFile, newLineCharacter);
                if (validate)
                    validate(node, text);
                const { options: formatOptions } = formatContext;
                const initialIndentation = indentation !== undefined
                    ? indentation
                    : ts.formatting.SmartIndenter.getIndentation(pos, sourceFile, formatOptions, prefix === newLineCharacter || ts.getLineStartPositionForPosition(pos, sourceFile) === pos);
                if (delta === undefined) {
                    delta = ts.formatting.SmartIndenter.shouldIndentChildNode(formatContext.options, nodeIn) ? (formatOptions.indentSize || 0) : 0;
                }
                const file = { text, getLineAndCharacterOfPosition(pos) { return ts.getLineAndCharacterOfPosition(this, pos); } };
                const changes = ts.formatting.formatNodeGivenIndentation(node, file, sourceFile.languageVariant, initialIndentation, delta, formatContext);
                return applyChanges(text, changes);
            }
            /** Note: output node may be mutated input node. */
            function getNonformattedText(node, sourceFile, newLineCharacter) {
                const writer = new Writer(newLineCharacter);
                const newLine = newLineCharacter === "\n" ? ts.NewLineKind.LineFeed : ts.NewLineKind.CarriageReturnLineFeed;
                ts.createPrinter({ newLine }, writer).writeNode(ts.EmitHint.Unspecified, node, sourceFile, writer);
                return { text: writer.getText(), node: assignPositionsToNode(node) };
            }
        })(changesToText || (changesToText = {}));
        function applyChanges(text, changes) {
            for (let i = changes.length - 1; i >= 0; i--) {
                const change = changes[i];
                text = `${text.substring(0, change.span.start)}${change.newText}${text.substring(ts.textSpanEnd(change.span))}`;
            }
            return text;
        }
        textChanges_1.applyChanges = applyChanges;
        function isTrivia(s) {
            return ts.skipTrivia(s, 0) === s.length;
        }
        function assignPositionsToNode(node) {
            const visited = ts.visitEachChild(node, assignPositionsToNode, ts.nullTransformationContext, assignPositionsToNodeArray, assignPositionsToNode);
            // create proxy node for non synthesized nodes
            const newNode = ts.nodeIsSynthesized(visited) ? visited : Object.create(visited);
            newNode.pos = getPos(node);
            newNode.end = getEnd(node);
            return newNode;
        }
        function assignPositionsToNodeArray(nodes, visitor, test, start, count) {
            const visited = ts.visitNodes(nodes, visitor, test, start, count);
            if (!visited) {
                return visited;
            }
            // clone nodearray if necessary
            const nodeArray = visited === nodes ? ts.createNodeArray(visited.slice(0)) : visited;
            nodeArray.pos = getPos(nodes);
            nodeArray.end = getEnd(nodes);
            return nodeArray;
        }
        class Writer {
            constructor(newLine) {
                this.lastNonTriviaPosition = 0;
                this.writer = ts.createTextWriter(newLine);
                this.onEmitNode = (hint, node, printCallback) => {
                    if (node) {
                        setPos(node, this.lastNonTriviaPosition);
                    }
                    printCallback(hint, node);
                    if (node) {
                        setEnd(node, this.lastNonTriviaPosition);
                    }
                };
                this.onBeforeEmitNodeArray = nodes => {
                    if (nodes) {
                        setPos(nodes, this.lastNonTriviaPosition);
                    }
                };
                this.onAfterEmitNodeArray = nodes => {
                    if (nodes) {
                        setEnd(nodes, this.lastNonTriviaPosition);
                    }
                };
                this.onBeforeEmitToken = node => {
                    if (node) {
                        setPos(node, this.lastNonTriviaPosition);
                    }
                };
                this.onAfterEmitToken = node => {
                    if (node) {
                        setEnd(node, this.lastNonTriviaPosition);
                    }
                };
            }
            setLastNonTriviaPosition(s, force) {
                if (force || !isTrivia(s)) {
                    this.lastNonTriviaPosition = this.writer.getTextPos();
                    let i = 0;
                    while (ts.isWhiteSpaceLike(s.charCodeAt(s.length - i - 1))) {
                        i++;
                    }
                    // trim trailing whitespaces
                    this.lastNonTriviaPosition -= i;
                }
            }
            write(s) {
                this.writer.write(s);
                this.setLastNonTriviaPosition(s, /*force*/ false);
            }
            writeKeyword(s) {
                this.writer.writeKeyword(s);
                this.setLastNonTriviaPosition(s, /*force*/ false);
            }
            writeOperator(s) {
                this.writer.writeOperator(s);
                this.setLastNonTriviaPosition(s, /*force*/ false);
            }
            writePunctuation(s) {
                this.writer.writePunctuation(s);
                this.setLastNonTriviaPosition(s, /*force*/ false);
            }
            writeParameter(s) {
                this.writer.writeParameter(s);
                this.setLastNonTriviaPosition(s, /*force*/ false);
            }
            writeProperty(s) {
                this.writer.writeProperty(s);
                this.setLastNonTriviaPosition(s, /*force*/ false);
            }
            writeSpace(s) {
                this.writer.writeSpace(s);
                this.setLastNonTriviaPosition(s, /*force*/ false);
            }
            writeStringLiteral(s) {
                this.writer.writeStringLiteral(s);
                this.setLastNonTriviaPosition(s, /*force*/ false);
            }
            writeSymbol(s, sym) {
                this.writer.writeSymbol(s, sym);
                this.setLastNonTriviaPosition(s, /*force*/ false);
            }
            writeTextOfNode(text, node) {
                this.writer.writeTextOfNode(text, node);
            }
            writeLine() {
                this.writer.writeLine();
            }
            increaseIndent() {
                this.writer.increaseIndent();
            }
            decreaseIndent() {
                this.writer.decreaseIndent();
            }
            getText() {
                return this.writer.getText();
            }
            rawWrite(s) {
                this.writer.rawWrite(s);
                this.setLastNonTriviaPosition(s, /*force*/ false);
            }
            writeLiteral(s) {
                this.writer.writeLiteral(s);
                this.setLastNonTriviaPosition(s, /*force*/ true);
            }
            getTextPos() {
                return this.writer.getTextPos();
            }
            getLine() {
                return this.writer.getLine();
            }
            getColumn() {
                return this.writer.getColumn();
            }
            getIndent() {
                return this.writer.getIndent();
            }
            isAtStartOfLine() {
                return this.writer.isAtStartOfLine();
            }
            clear() {
                this.writer.clear();
                this.lastNonTriviaPosition = 0;
            }
        }
        function getInsertionPositionAtSourceFileTop({ text }) {
            const shebang = ts.getShebang(text);
            let position = 0;
            if (shebang !== undefined) {
                position = shebang.length;
                advancePastLineBreak();
            }
            // For a source file, it is possible there are detached comments we should not skip
            let ranges = ts.getLeadingCommentRanges(text, position);
            if (!ranges)
                return position;
            // However we should still skip a pinned comment at the top
            if (ranges.length && ranges[0].kind === ts.SyntaxKind.MultiLineCommentTrivia && ts.isPinnedComment(text, ranges[0].pos)) {
                position = ranges[0].end;
                advancePastLineBreak();
                ranges = ranges.slice(1);
            }
            // As well as any triple slash references
            for (const range of ranges) {
                if (range.kind === ts.SyntaxKind.SingleLineCommentTrivia && ts.isRecognizedTripleSlashComment(text, range.pos, range.end)) {
                    position = range.end;
                    advancePastLineBreak();
                    continue;
                }
                break;
            }
            return position;
            function advancePastLineBreak() {
                if (position < text.length) {
                    const charCode = text.charCodeAt(position);
                    if (ts.isLineBreak(charCode)) {
                        position++;
                        if (position < text.length && charCode === 13 /* carriageReturn */ && text.charCodeAt(position) === 10 /* lineFeed */) {
                            position++;
                        }
                    }
                }
            }
        }
        function isValidLocationToAddComment(sourceFile, position) {
            return !ts.isInComment(sourceFile, position) && !ts.isInString(sourceFile, position) && !ts.isInTemplateString(sourceFile, position);
        }
        textChanges_1.isValidLocationToAddComment = isValidLocationToAddComment;
        function needSemicolonBetween(a, b) {
            return (ts.isPropertySignature(a) || ts.isPropertyDeclaration(a)) && ts.isClassOrTypeElement(b) && b.name.kind === ts.SyntaxKind.ComputedPropertyName
                || ts.isStatementButNotDeclaration(a) && ts.isStatementButNotDeclaration(b); // TODO: only if b would start with a `(` or `[`
        }
    })(textChanges = ts.textChanges || (ts.textChanges = {}));
})(ts || (ts = {}));
