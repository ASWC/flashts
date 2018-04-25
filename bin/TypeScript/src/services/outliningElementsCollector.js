/* @internal */
var ts;
(function (ts) {
    var OutliningElementsCollector;
    (function (OutliningElementsCollector) {
        function collectElements(sourceFile, cancellationToken) {
            const res = [];
            addNodeOutliningSpans(sourceFile, cancellationToken, res);
            addRegionOutliningSpans(sourceFile, res);
            return res.sort((span1, span2) => span1.textSpan.start - span2.textSpan.start);
        }
        OutliningElementsCollector.collectElements = collectElements;
        function addNodeOutliningSpans(sourceFile, cancellationToken, out) {
            let depthRemaining = 40;
            sourceFile.forEachChild(function walk(n) {
                if (depthRemaining === 0)
                    return;
                cancellationToken.throwIfCancellationRequested();
                if (ts.isDeclaration(n)) {
                    addOutliningForLeadingCommentsForNode(n, sourceFile, cancellationToken, out);
                }
                const span = getOutliningSpanForNode(n, sourceFile);
                if (span)
                    out.push(span);
                depthRemaining--;
                if (ts.isIfStatement(n) && n.elseStatement && ts.isIfStatement(n.elseStatement)) {
                    // Consider an 'else if' to be on the same depth as the 'if'.
                    walk(n.expression);
                    walk(n.thenStatement);
                    depthRemaining++;
                    walk(n.elseStatement);
                    depthRemaining--;
                }
                else {
                    n.forEachChild(walk);
                }
                depthRemaining++;
            });
        }
        function addRegionOutliningSpans(sourceFile, out) {
            const regions = [];
            const lineStarts = sourceFile.getLineStarts();
            for (let i = 0; i < lineStarts.length; i++) {
                const currentLineStart = lineStarts[i];
                const lineEnd = i + 1 === lineStarts.length ? sourceFile.getEnd() : lineStarts[i + 1] - 1;
                const lineText = sourceFile.text.substring(currentLineStart, lineEnd);
                const result = lineText.match(/^\s*\/\/\s*#(end)?region(?:\s+(.*))?(?:\r)?$/);
                if (!result || ts.isInComment(sourceFile, currentLineStart)) {
                    continue;
                }
                if (!result[1]) {
                    const span = ts.createTextSpanFromBounds(sourceFile.text.indexOf("//", currentLineStart), lineEnd);
                    regions.push(createOutliningSpan(span, span, /*autoCollapse*/ false, result[2] || "#region"));
                }
                else {
                    const region = regions.pop();
                    if (region) {
                        region.textSpan.length = lineEnd - region.textSpan.start;
                        region.hintSpan.length = lineEnd - region.textSpan.start;
                        out.push(region);
                    }
                }
            }
        }
        function addOutliningForLeadingCommentsForNode(n, sourceFile, cancellationToken, out) {
            const comments = ts.getLeadingCommentRangesOfNode(n, sourceFile);
            if (!comments)
                return;
            let firstSingleLineCommentStart = -1;
            let lastSingleLineCommentEnd = -1;
            let singleLineCommentCount = 0;
            for (const { kind, pos, end } of comments) {
                cancellationToken.throwIfCancellationRequested();
                switch (kind) {
                    case ts.SyntaxKind.SingleLineCommentTrivia:
                        // For single line comments, combine consecutive ones (2 or more) into
                        // a single span from the start of the first till the end of the last
                        if (singleLineCommentCount === 0) {
                            firstSingleLineCommentStart = pos;
                        }
                        lastSingleLineCommentEnd = end;
                        singleLineCommentCount++;
                        break;
                    case ts.SyntaxKind.MultiLineCommentTrivia:
                        combineAndAddMultipleSingleLineComments();
                        out.push(createOutliningSpanFromBounds(pos, end));
                        singleLineCommentCount = 0;
                        break;
                    default:
                        ts.Debug.assertNever(kind);
                }
            }
            combineAndAddMultipleSingleLineComments();
            function combineAndAddMultipleSingleLineComments() {
                // Only outline spans of two or more consecutive single line comments
                if (singleLineCommentCount > 1) {
                    out.push(createOutliningSpanFromBounds(firstSingleLineCommentStart, lastSingleLineCommentEnd));
                }
            }
        }
        function createOutliningSpanFromBounds(pos, end) {
            return createOutliningSpan(ts.createTextSpanFromBounds(pos, end));
        }
        function getOutliningSpanForNode(n, sourceFile) {
            switch (n.kind) {
                case ts.SyntaxKind.Block:
                    if (ts.isFunctionBlock(n)) {
                        return spanForNode(n.parent, /*autoCollapse*/ n.parent.kind !== ts.SyntaxKind.ArrowFunction);
                    }
                    // Check if the block is standalone, or 'attached' to some parent statement.
                    // If the latter, we want to collapse the block, but consider its hint span
                    // to be the entire span of the parent.
                    switch (n.parent.kind) {
                        case ts.SyntaxKind.DoStatement:
                        case ts.SyntaxKind.ForInStatement:
                        case ts.SyntaxKind.ForOfStatement:
                        case ts.SyntaxKind.ForStatement:
                        case ts.SyntaxKind.IfStatement:
                        case ts.SyntaxKind.WhileStatement:
                        case ts.SyntaxKind.WithStatement:
                        case ts.SyntaxKind.CatchClause:
                            return spanForNode(n.parent);
                        case ts.SyntaxKind.TryStatement:
                            // Could be the try-block, or the finally-block.
                            const tryStatement = n.parent;
                            if (tryStatement.tryBlock === n) {
                                return spanForNode(n.parent);
                            }
                            else if (tryStatement.finallyBlock === n) {
                                return spanForNode(ts.findChildOfKind(tryStatement, ts.SyntaxKind.FinallyKeyword, sourceFile));
                            }
                        // falls through
                        default:
                            // Block was a standalone block.  In this case we want to only collapse
                            // the span of the block, independent of any parent span.
                            return createOutliningSpan(ts.createTextSpanFromNode(n, sourceFile));
                    }
                case ts.SyntaxKind.ModuleBlock:
                    return spanForNode(n.parent);
                case ts.SyntaxKind.ClassDeclaration:
                case ts.SyntaxKind.InterfaceDeclaration:
                case ts.SyntaxKind.EnumDeclaration:
                case ts.SyntaxKind.CaseBlock:
                    return spanForNode(n);
                case ts.SyntaxKind.ObjectLiteralExpression:
                    return spanForObjectOrArrayLiteral(n);
                case ts.SyntaxKind.ArrayLiteralExpression:
                    return spanForObjectOrArrayLiteral(n, ts.SyntaxKind.OpenBracketToken);
            }
            function spanForObjectOrArrayLiteral(node, open = ts.SyntaxKind.OpenBraceToken) {
                // If the block has no leading keywords and is inside an array literal,
                // we only want to collapse the span of the block.
                // Otherwise, the collapsed section will include the end of the previous line.
                return spanForNode(node, /*autoCollapse*/ false, /*useFullStart*/ !ts.isArrayLiteralExpression(node.parent), open);
            }
            function spanForNode(hintSpanNode, autoCollapse = false, useFullStart = true, open = ts.SyntaxKind.OpenBraceToken) {
                const openToken = ts.findChildOfKind(n, open, sourceFile);
                const close = open === ts.SyntaxKind.OpenBraceToken ? ts.SyntaxKind.CloseBraceToken : ts.SyntaxKind.CloseBracketToken;
                const closeToken = ts.findChildOfKind(n, close, sourceFile);
                if (!openToken || !closeToken) {
                    return undefined;
                }
                const textSpan = ts.createTextSpanFromBounds(useFullStart ? openToken.getFullStart() : openToken.getStart(sourceFile), closeToken.getEnd());
                return createOutliningSpan(textSpan, ts.createTextSpanFromNode(hintSpanNode, sourceFile), autoCollapse);
            }
        }
        function createOutliningSpan(textSpan, hintSpan = textSpan, autoCollapse = false, bannerText = "...") {
            return { textSpan, hintSpan, bannerText, autoCollapse };
        }
    })(OutliningElementsCollector = ts.OutliningElementsCollector || (ts.OutliningElementsCollector = {}));
})(ts || (ts = {}));
