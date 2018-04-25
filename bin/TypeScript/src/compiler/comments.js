/* @internal */
var ts;
(function (ts) {
    function createCommentWriter(printerOptions, emitPos) {
        const extendedDiagnostics = printerOptions.extendedDiagnostics;
        const newLine = ts.getNewLineCharacter(printerOptions);
        let writer;
        let containerPos = -1;
        let containerEnd = -1;
        let declarationListContainerEnd = -1;
        let currentSourceFile;
        let currentText;
        let currentLineMap;
        let detachedCommentsInfo;
        let hasWrittenComment = false;
        let disabled = printerOptions.removeComments;
        return {
            reset,
            setWriter,
            setSourceFile,
            emitNodeWithComments,
            emitBodyWithDetachedComments,
            emitTrailingCommentsOfPosition,
            emitLeadingCommentsOfPosition,
        };
        function emitNodeWithComments(hint, node, emitCallback) {
            if (disabled) {
                emitCallback(hint, node);
                return;
            }
            if (node) {
                hasWrittenComment = false;
                const emitNode = node.emitNode;
                const emitFlags = emitNode && emitNode.flags;
                const { pos, end } = emitNode && emitNode.commentRange || node;
                if ((pos < 0 && end < 0) || (pos === end)) {
                    // Both pos and end are synthesized, so just emit the node without comments.
                    emitNodeWithSynthesizedComments(hint, node, emitNode, emitFlags, emitCallback);
                }
                else {
                    if (extendedDiagnostics) {
                        ts.performance.mark("preEmitNodeWithComment");
                    }
                    const isEmittedNode = node.kind !== ts.SyntaxKind.NotEmittedStatement;
                    // We have to explicitly check that the node is JsxText because if the compilerOptions.jsx is "preserve" we will not do any transformation.
                    // It is expensive to walk entire tree just to set one kind of node to have no comments.
                    const skipLeadingComments = pos < 0 || (emitFlags & ts.EmitFlags.NoLeadingComments) !== 0 || node.kind === ts.SyntaxKind.JsxText;
                    const skipTrailingComments = end < 0 || (emitFlags & ts.EmitFlags.NoTrailingComments) !== 0 || node.kind === ts.SyntaxKind.JsxText;
                    // Emit leading comments if the position is not synthesized and the node
                    // has not opted out from emitting leading comments.
                    if (!skipLeadingComments) {
                        emitLeadingComments(pos, isEmittedNode);
                    }
                    // Save current container state on the stack.
                    const savedContainerPos = containerPos;
                    const savedContainerEnd = containerEnd;
                    const savedDeclarationListContainerEnd = declarationListContainerEnd;
                    if (!skipLeadingComments) {
                        containerPos = pos;
                    }
                    if (!skipTrailingComments) {
                        containerEnd = end;
                        // To avoid invalid comment emit in a down-level binding pattern, we
                        // keep track of the last declaration list container's end
                        if (node.kind === ts.SyntaxKind.VariableDeclarationList) {
                            declarationListContainerEnd = end;
                        }
                    }
                    if (extendedDiagnostics) {
                        ts.performance.measure("commentTime", "preEmitNodeWithComment");
                    }
                    emitNodeWithSynthesizedComments(hint, node, emitNode, emitFlags, emitCallback);
                    if (extendedDiagnostics) {
                        ts.performance.mark("postEmitNodeWithComment");
                    }
                    // Restore previous container state.
                    containerPos = savedContainerPos;
                    containerEnd = savedContainerEnd;
                    declarationListContainerEnd = savedDeclarationListContainerEnd;
                    // Emit trailing comments if the position is not synthesized and the node
                    // has not opted out from emitting leading comments and is an emitted node.
                    if (!skipTrailingComments && isEmittedNode) {
                        emitTrailingComments(end);
                    }
                    if (extendedDiagnostics) {
                        ts.performance.measure("commentTime", "postEmitNodeWithComment");
                    }
                }
            }
        }
        function emitNodeWithSynthesizedComments(hint, node, emitNode, emitFlags, emitCallback) {
            const leadingComments = emitNode && emitNode.leadingComments;
            if (ts.some(leadingComments)) {
                if (extendedDiagnostics) {
                    ts.performance.mark("preEmitNodeWithSynthesizedComments");
                }
                ts.forEach(leadingComments, emitLeadingSynthesizedComment);
                if (extendedDiagnostics) {
                    ts.performance.measure("commentTime", "preEmitNodeWithSynthesizedComments");
                }
            }
            emitNodeWithNestedComments(hint, node, emitFlags, emitCallback);
            const trailingComments = emitNode && emitNode.trailingComments;
            if (ts.some(trailingComments)) {
                if (extendedDiagnostics) {
                    ts.performance.mark("postEmitNodeWithSynthesizedComments");
                }
                ts.forEach(trailingComments, emitTrailingSynthesizedComment);
                if (extendedDiagnostics) {
                    ts.performance.measure("commentTime", "postEmitNodeWithSynthesizedComments");
                }
            }
        }
        function emitLeadingSynthesizedComment(comment) {
            if (comment.kind === ts.SyntaxKind.SingleLineCommentTrivia) {
                writer.writeLine();
            }
            writeSynthesizedComment(comment);
            if (comment.hasTrailingNewLine || comment.kind === ts.SyntaxKind.SingleLineCommentTrivia) {
                writer.writeLine();
            }
            else {
                writer.write(" ");
            }
        }
        function emitTrailingSynthesizedComment(comment) {
            if (!writer.isAtStartOfLine()) {
                writer.write(" ");
            }
            writeSynthesizedComment(comment);
            if (comment.hasTrailingNewLine) {
                writer.writeLine();
            }
        }
        function writeSynthesizedComment(comment) {
            const text = formatSynthesizedComment(comment);
            const lineMap = comment.kind === ts.SyntaxKind.MultiLineCommentTrivia ? ts.computeLineStarts(text) : undefined;
            ts.writeCommentRange(text, lineMap, writer, 0, text.length, newLine);
        }
        function formatSynthesizedComment(comment) {
            return comment.kind === ts.SyntaxKind.MultiLineCommentTrivia
                ? `/*${comment.text}*/`
                : `//${comment.text}`;
        }
        function emitNodeWithNestedComments(hint, node, emitFlags, emitCallback) {
            if (emitFlags & ts.EmitFlags.NoNestedComments) {
                disabled = true;
                emitCallback(hint, node);
                disabled = false;
            }
            else {
                emitCallback(hint, node);
            }
        }
        function emitBodyWithDetachedComments(node, detachedRange, emitCallback) {
            if (extendedDiagnostics) {
                ts.performance.mark("preEmitBodyWithDetachedComments");
            }
            const { pos, end } = detachedRange;
            const emitFlags = ts.getEmitFlags(node);
            const skipLeadingComments = pos < 0 || (emitFlags & ts.EmitFlags.NoLeadingComments) !== 0;
            const skipTrailingComments = disabled || end < 0 || (emitFlags & ts.EmitFlags.NoTrailingComments) !== 0;
            if (!skipLeadingComments) {
                emitDetachedCommentsAndUpdateCommentsInfo(detachedRange);
            }
            if (extendedDiagnostics) {
                ts.performance.measure("commentTime", "preEmitBodyWithDetachedComments");
            }
            if (emitFlags & ts.EmitFlags.NoNestedComments && !disabled) {
                disabled = true;
                emitCallback(node);
                disabled = false;
            }
            else {
                emitCallback(node);
            }
            if (extendedDiagnostics) {
                ts.performance.mark("beginEmitBodyWithDetachedCommetns");
            }
            if (!skipTrailingComments) {
                emitLeadingComments(detachedRange.end, /*isEmittedNode*/ true);
                if (hasWrittenComment && !writer.isAtStartOfLine()) {
                    writer.writeLine();
                }
            }
            if (extendedDiagnostics) {
                ts.performance.measure("commentTime", "beginEmitBodyWithDetachedCommetns");
            }
        }
        function emitLeadingComments(pos, isEmittedNode) {
            hasWrittenComment = false;
            if (isEmittedNode) {
                forEachLeadingCommentToEmit(pos, emitLeadingComment);
            }
            else if (pos === 0) {
                // If the node will not be emitted in JS, remove all the comments(normal, pinned and ///) associated with the node,
                // unless it is a triple slash comment at the top of the file.
                // For Example:
                //      /// <reference-path ...>
                //      declare var x;
                //      /// <reference-path ...>
                //      interface F {}
                //  The first /// will NOT be removed while the second one will be removed even though both node will not be emitted
                forEachLeadingCommentToEmit(pos, emitTripleSlashLeadingComment);
            }
        }
        function emitTripleSlashLeadingComment(commentPos, commentEnd, kind, hasTrailingNewLine, rangePos) {
            if (isTripleSlashComment(commentPos, commentEnd)) {
                emitLeadingComment(commentPos, commentEnd, kind, hasTrailingNewLine, rangePos);
            }
        }
        function shouldWriteComment(text, pos) {
            if (printerOptions.onlyPrintJsDocStyle) {
                return (ts.isJSDocLikeText(text, pos) || ts.isPinnedComment(text, pos));
            }
            return true;
        }
        function emitLeadingComment(commentPos, commentEnd, kind, hasTrailingNewLine, rangePos) {
            if (!shouldWriteComment(currentText, commentPos))
                return;
            if (!hasWrittenComment) {
                ts.emitNewLineBeforeLeadingCommentOfPosition(currentLineMap, writer, rangePos, commentPos);
                hasWrittenComment = true;
            }
            // Leading comments are emitted at /*leading comment1 */space/*leading comment*/space
            if (emitPos)
                emitPos(commentPos);
            ts.writeCommentRange(currentText, currentLineMap, writer, commentPos, commentEnd, newLine);
            if (emitPos)
                emitPos(commentEnd);
            if (hasTrailingNewLine) {
                writer.writeLine();
            }
            else if (kind === ts.SyntaxKind.MultiLineCommentTrivia) {
                writer.write(" ");
            }
        }
        function emitLeadingCommentsOfPosition(pos) {
            if (disabled || pos === -1) {
                return;
            }
            emitLeadingComments(pos, /*isEmittedNode*/ true);
        }
        function emitTrailingComments(pos) {
            forEachTrailingCommentToEmit(pos, emitTrailingComment);
        }
        function emitTrailingComment(commentPos, commentEnd, _kind, hasTrailingNewLine) {
            if (!shouldWriteComment(currentText, commentPos))
                return;
            // trailing comments are emitted at space/*trailing comment1 */space/*trailing comment2*/
            if (!writer.isAtStartOfLine()) {
                writer.write(" ");
            }
            if (emitPos)
                emitPos(commentPos);
            ts.writeCommentRange(currentText, currentLineMap, writer, commentPos, commentEnd, newLine);
            if (emitPos)
                emitPos(commentEnd);
            if (hasTrailingNewLine) {
                writer.writeLine();
            }
        }
        function emitTrailingCommentsOfPosition(pos, prefixSpace) {
            if (disabled) {
                return;
            }
            if (extendedDiagnostics) {
                ts.performance.mark("beforeEmitTrailingCommentsOfPosition");
            }
            forEachTrailingCommentToEmit(pos, prefixSpace ? emitTrailingComment : emitTrailingCommentOfPosition);
            if (extendedDiagnostics) {
                ts.performance.measure("commentTime", "beforeEmitTrailingCommentsOfPosition");
            }
        }
        function emitTrailingCommentOfPosition(commentPos, commentEnd, _kind, hasTrailingNewLine) {
            // trailing comments of a position are emitted at /*trailing comment1 */space/*trailing comment*/space
            if (emitPos)
                emitPos(commentPos);
            ts.writeCommentRange(currentText, currentLineMap, writer, commentPos, commentEnd, newLine);
            if (emitPos)
                emitPos(commentEnd);
            if (hasTrailingNewLine) {
                writer.writeLine();
            }
            else {
                writer.write(" ");
            }
        }
        function forEachLeadingCommentToEmit(pos, cb) {
            // Emit the leading comments only if the container's pos doesn't match because the container should take care of emitting these comments
            if (containerPos === -1 || pos !== containerPos) {
                if (hasDetachedComments(pos)) {
                    forEachLeadingCommentWithoutDetachedComments(cb);
                }
                else {
                    ts.forEachLeadingCommentRange(currentText, pos, cb, /*state*/ pos);
                }
            }
        }
        function forEachTrailingCommentToEmit(end, cb) {
            // Emit the trailing comments only if the container's end doesn't match because the container should take care of emitting these comments
            if (containerEnd === -1 || (end !== containerEnd && end !== declarationListContainerEnd)) {
                ts.forEachTrailingCommentRange(currentText, end, cb);
            }
        }
        function reset() {
            currentSourceFile = undefined;
            currentText = undefined;
            currentLineMap = undefined;
            detachedCommentsInfo = undefined;
        }
        function setWriter(output) {
            writer = output;
        }
        function setSourceFile(sourceFile) {
            currentSourceFile = sourceFile;
            currentText = currentSourceFile.text;
            currentLineMap = ts.getLineStarts(currentSourceFile);
            detachedCommentsInfo = undefined;
        }
        function hasDetachedComments(pos) {
            return detachedCommentsInfo !== undefined && ts.lastOrUndefined(detachedCommentsInfo).nodePos === pos;
        }
        function forEachLeadingCommentWithoutDetachedComments(cb) {
            // get the leading comments from detachedPos
            const pos = ts.lastOrUndefined(detachedCommentsInfo).detachedCommentEndPos;
            if (detachedCommentsInfo.length - 1) {
                detachedCommentsInfo.pop();
            }
            else {
                detachedCommentsInfo = undefined;
            }
            ts.forEachLeadingCommentRange(currentText, pos, cb, /*state*/ pos);
        }
        function emitDetachedCommentsAndUpdateCommentsInfo(range) {
            const currentDetachedCommentInfo = ts.emitDetachedComments(currentText, currentLineMap, writer, writeComment, range, newLine, disabled);
            if (currentDetachedCommentInfo) {
                if (detachedCommentsInfo) {
                    detachedCommentsInfo.push(currentDetachedCommentInfo);
                }
                else {
                    detachedCommentsInfo = [currentDetachedCommentInfo];
                }
            }
        }
        function writeComment(text, lineMap, writer, commentPos, commentEnd, newLine) {
            if (!shouldWriteComment(currentText, commentPos))
                return;
            if (emitPos)
                emitPos(commentPos);
            ts.writeCommentRange(text, lineMap, writer, commentPos, commentEnd, newLine);
            if (emitPos)
                emitPos(commentEnd);
        }
        /**
         * Determine if the given comment is a triple-slash
         *
         * @return true if the comment is a triple-slash comment else false
         */
        function isTripleSlashComment(commentPos, commentEnd) {
            return ts.isRecognizedTripleSlashComment(currentText, commentPos, commentEnd);
        }
    }
    ts.createCommentWriter = createCommentWriter;
})(ts || (ts = {}));
