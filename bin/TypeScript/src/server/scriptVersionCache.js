/*@internal*/
var ts;
(function (ts) {
    var server;
    (function (server) {
        const lineCollectionCapacity = 4;
        class EditWalker {
            constructor() {
                this.goSubtree = true;
                this.lineIndex = new LineIndex();
                this.endBranch = [];
                this.state = 2 /* Entire */;
                this.initialText = "";
                this.trailingText = "";
                this.lineIndex.root = new LineNode();
                this.startPath = [this.lineIndex.root];
                this.stack = [this.lineIndex.root];
            }
            get done() { return false; }
            insertLines(insertedText, suppressTrailingText) {
                if (suppressTrailingText) {
                    this.trailingText = "";
                }
                if (insertedText) {
                    insertedText = this.initialText + insertedText + this.trailingText;
                }
                else {
                    insertedText = this.initialText + this.trailingText;
                }
                const lm = LineIndex.linesFromText(insertedText);
                const lines = lm.lines;
                if (lines.length > 1) {
                    if (lines[lines.length - 1] === "") {
                        lines.pop();
                    }
                }
                let branchParent;
                let lastZeroCount;
                for (let k = this.endBranch.length - 1; k >= 0; k--) {
                    this.endBranch[k].updateCounts();
                    if (this.endBranch[k].charCount() === 0) {
                        lastZeroCount = this.endBranch[k];
                        if (k > 0) {
                            branchParent = this.endBranch[k - 1];
                        }
                        else {
                            branchParent = this.branchNode;
                        }
                    }
                }
                if (lastZeroCount) {
                    branchParent.remove(lastZeroCount);
                }
                // path at least length two (root and leaf)
                const leafNode = this.startPath[this.startPath.length - 1];
                if (lines.length > 0) {
                    leafNode.text = lines[0];
                    if (lines.length > 1) {
                        let insertedNodes = new Array(lines.length - 1);
                        let startNode = leafNode;
                        for (let i = 1; i < lines.length; i++) {
                            insertedNodes[i - 1] = new LineLeaf(lines[i]);
                        }
                        let pathIndex = this.startPath.length - 2;
                        while (pathIndex >= 0) {
                            const insertionNode = this.startPath[pathIndex];
                            insertedNodes = insertionNode.insertAt(startNode, insertedNodes);
                            pathIndex--;
                            startNode = insertionNode;
                        }
                        let insertedNodesLen = insertedNodes.length;
                        while (insertedNodesLen > 0) {
                            const newRoot = new LineNode();
                            newRoot.add(this.lineIndex.root);
                            insertedNodes = newRoot.insertAt(this.lineIndex.root, insertedNodes);
                            insertedNodesLen = insertedNodes.length;
                            this.lineIndex.root = newRoot;
                        }
                        this.lineIndex.root.updateCounts();
                    }
                    else {
                        for (let j = this.startPath.length - 2; j >= 0; j--) {
                            this.startPath[j].updateCounts();
                        }
                    }
                }
                else {
                    const insertionNode = this.startPath[this.startPath.length - 2];
                    // no content for leaf node, so delete it
                    insertionNode.remove(leafNode);
                    for (let j = this.startPath.length - 2; j >= 0; j--) {
                        this.startPath[j].updateCounts();
                    }
                }
                return this.lineIndex;
            }
            post(_relativeStart, _relativeLength, lineCollection) {
                // have visited the path for start of range, now looking for end
                // if range is on single line, we will never make this state transition
                if (lineCollection === this.lineCollectionAtBranch) {
                    this.state = 4 /* End */;
                }
                // always pop stack because post only called when child has been visited
                this.stack.pop();
            }
            pre(_relativeStart, _relativeLength, lineCollection, _parent, nodeType) {
                // currentNode corresponds to parent, but in the new tree
                const currentNode = this.stack[this.stack.length - 1];
                if ((this.state === 2 /* Entire */) && (nodeType === 1 /* Start */)) {
                    // if range is on single line, we will never make this state transition
                    this.state = 1 /* Start */;
                    this.branchNode = currentNode;
                    this.lineCollectionAtBranch = lineCollection;
                }
                let child;
                function fresh(node) {
                    if (node.isLeaf()) {
                        return new LineLeaf("");
                    }
                    else
                        return new LineNode();
                }
                switch (nodeType) {
                    case 0 /* PreStart */:
                        this.goSubtree = false;
                        if (this.state !== 4 /* End */) {
                            currentNode.add(lineCollection);
                        }
                        break;
                    case 1 /* Start */:
                        if (this.state === 4 /* End */) {
                            this.goSubtree = false;
                        }
                        else {
                            child = fresh(lineCollection);
                            currentNode.add(child);
                            this.startPath.push(child);
                        }
                        break;
                    case 2 /* Entire */:
                        if (this.state !== 4 /* End */) {
                            child = fresh(lineCollection);
                            currentNode.add(child);
                            this.startPath.push(child);
                        }
                        else {
                            if (!lineCollection.isLeaf()) {
                                child = fresh(lineCollection);
                                currentNode.add(child);
                                this.endBranch.push(child);
                            }
                        }
                        break;
                    case 3 /* Mid */:
                        this.goSubtree = false;
                        break;
                    case 4 /* End */:
                        if (this.state !== 4 /* End */) {
                            this.goSubtree = false;
                        }
                        else {
                            if (!lineCollection.isLeaf()) {
                                child = fresh(lineCollection);
                                currentNode.add(child);
                                this.endBranch.push(child);
                            }
                        }
                        break;
                    case 5 /* PostEnd */:
                        this.goSubtree = false;
                        if (this.state !== 1 /* Start */) {
                            currentNode.add(lineCollection);
                        }
                        break;
                }
                if (this.goSubtree) {
                    this.stack.push(child);
                }
            }
            // just gather text from the leaves
            leaf(relativeStart, relativeLength, ll) {
                if (this.state === 1 /* Start */) {
                    this.initialText = ll.text.substring(0, relativeStart);
                }
                else if (this.state === 2 /* Entire */) {
                    this.initialText = ll.text.substring(0, relativeStart);
                    this.trailingText = ll.text.substring(relativeStart + relativeLength);
                }
                else {
                    // state is CharRangeSection.End
                    this.trailingText = ll.text.substring(relativeStart + relativeLength);
                }
            }
        }
        // text change information
        class TextChange {
            constructor(pos, deleteLen, insertedText) {
                this.pos = pos;
                this.deleteLen = deleteLen;
                this.insertedText = insertedText;
            }
            getTextChangeRange() {
                return ts.createTextChangeRange(ts.createTextSpan(this.pos, this.deleteLen), this.insertedText ? this.insertedText.length : 0);
            }
        }
        class ScriptVersionCache {
            constructor() {
                this.changes = [];
                this.versions = new Array(ScriptVersionCache.maxVersions);
                this.minVersion = 0; // no versions earlier than min version will maintain change history
                this.currentVersion = 0;
            }
            versionToIndex(version) {
                if (version < this.minVersion || version > this.currentVersion) {
                    return undefined;
                }
                return version % ScriptVersionCache.maxVersions;
            }
            currentVersionToIndex() {
                return this.currentVersion % ScriptVersionCache.maxVersions;
            }
            // REVIEW: can optimize by coalescing simple edits
            edit(pos, deleteLen, insertedText) {
                this.changes.push(new TextChange(pos, deleteLen, insertedText));
                if (this.changes.length > ScriptVersionCache.changeNumberThreshold ||
                    deleteLen > ScriptVersionCache.changeLengthThreshold ||
                    insertedText && insertedText.length > ScriptVersionCache.changeLengthThreshold) {
                    this.getSnapshot();
                }
            }
            getSnapshot() { return this._getSnapshot(); }
            _getSnapshot() {
                let snap = this.versions[this.currentVersionToIndex()];
                if (this.changes.length > 0) {
                    let snapIndex = snap.index;
                    for (const change of this.changes) {
                        snapIndex = snapIndex.edit(change.pos, change.deleteLen, change.insertedText);
                    }
                    snap = new LineIndexSnapshot(this.currentVersion + 1, this, snapIndex, this.changes);
                    this.currentVersion = snap.version;
                    this.versions[this.currentVersionToIndex()] = snap;
                    this.changes = [];
                    if ((this.currentVersion - this.minVersion) >= ScriptVersionCache.maxVersions) {
                        this.minVersion = (this.currentVersion - ScriptVersionCache.maxVersions) + 1;
                    }
                }
                return snap;
            }
            getSnapshotVersion() {
                return this._getSnapshot().version;
            }
            getLineInfo(line) {
                return this._getSnapshot().index.lineNumberToInfo(line);
            }
            lineOffsetToPosition(line, column) {
                return this._getSnapshot().index.absolutePositionOfStartOfLine(line) + (column - 1);
            }
            positionToLineOffset(position) {
                return this._getSnapshot().index.positionToLineOffset(position);
            }
            lineToTextSpan(line) {
                const index = this._getSnapshot().index;
                const { lineText, absolutePosition } = index.lineNumberToInfo(line + 1);
                const len = lineText !== undefined ? lineText.length : index.absolutePositionOfStartOfLine(line + 2) - absolutePosition;
                return ts.createTextSpan(absolutePosition, len);
            }
            getTextChangesBetweenVersions(oldVersion, newVersion) {
                if (oldVersion < newVersion) {
                    if (oldVersion >= this.minVersion) {
                        const textChangeRanges = [];
                        for (let i = oldVersion + 1; i <= newVersion; i++) {
                            const snap = this.versions[this.versionToIndex(i)];
                            for (const textChange of snap.changesSincePreviousVersion) {
                                textChangeRanges.push(textChange.getTextChangeRange());
                            }
                        }
                        return ts.collapseTextChangeRangesAcrossMultipleVersions(textChangeRanges);
                    }
                    else {
                        return undefined;
                    }
                }
                else {
                    return ts.unchangedTextChangeRange;
                }
            }
            static fromString(script) {
                const svc = new ScriptVersionCache();
                const snap = new LineIndexSnapshot(0, svc, new LineIndex());
                svc.versions[svc.currentVersion] = snap;
                const lm = LineIndex.linesFromText(script);
                snap.index.load(lm.lines);
                return svc;
            }
        }
        ScriptVersionCache.changeNumberThreshold = 8;
        ScriptVersionCache.changeLengthThreshold = 256;
        ScriptVersionCache.maxVersions = 8;
        server.ScriptVersionCache = ScriptVersionCache;
        class LineIndexSnapshot {
            constructor(version, cache, index, changesSincePreviousVersion = server.emptyArray) {
                this.version = version;
                this.cache = cache;
                this.index = index;
                this.changesSincePreviousVersion = changesSincePreviousVersion;
            }
            getText(rangeStart, rangeEnd) {
                return this.index.getText(rangeStart, rangeEnd - rangeStart);
            }
            getLength() {
                return this.index.getLength();
            }
            getChangeRange(oldSnapshot) {
                if (oldSnapshot instanceof LineIndexSnapshot && this.cache === oldSnapshot.cache) {
                    if (this.version <= oldSnapshot.version) {
                        return ts.unchangedTextChangeRange;
                    }
                    else {
                        return this.cache.getTextChangesBetweenVersions(oldSnapshot.version, this.version);
                    }
                }
            }
        }
        /* @internal */
        class LineIndex {
            constructor() {
                // set this to true to check each edit for accuracy
                this.checkEdits = false;
            }
            absolutePositionOfStartOfLine(oneBasedLine) {
                return this.lineNumberToInfo(oneBasedLine).absolutePosition;
            }
            positionToLineOffset(position) {
                const { oneBasedLine, zeroBasedColumn } = this.root.charOffsetToLineInfo(1, position);
                return { line: oneBasedLine, offset: zeroBasedColumn + 1 };
            }
            positionToColumnAndLineText(position) {
                return this.root.charOffsetToLineInfo(1, position);
            }
            lineNumberToInfo(oneBasedLine) {
                const lineCount = this.root.lineCount();
                if (oneBasedLine <= lineCount) {
                    const { position, leaf } = this.root.lineNumberToInfo(oneBasedLine, 0);
                    return { absolutePosition: position, lineText: leaf && leaf.text };
                }
                else {
                    return { absolutePosition: this.root.charCount(), lineText: undefined };
                }
            }
            load(lines) {
                if (lines.length > 0) {
                    const leaves = [];
                    for (let i = 0; i < lines.length; i++) {
                        leaves[i] = new LineLeaf(lines[i]);
                    }
                    this.root = LineIndex.buildTreeFromBottom(leaves);
                }
                else {
                    this.root = new LineNode();
                }
            }
            walk(rangeStart, rangeLength, walkFns) {
                this.root.walk(rangeStart, rangeLength, walkFns);
            }
            getText(rangeStart, rangeLength) {
                let accum = "";
                if ((rangeLength > 0) && (rangeStart < this.root.charCount())) {
                    this.walk(rangeStart, rangeLength, {
                        goSubtree: true,
                        done: false,
                        leaf: (relativeStart, relativeLength, ll) => {
                            accum = accum.concat(ll.text.substring(relativeStart, relativeStart + relativeLength));
                        }
                    });
                }
                return accum;
            }
            getLength() {
                return this.root.charCount();
            }
            every(f, rangeStart, rangeEnd) {
                if (!rangeEnd) {
                    rangeEnd = this.root.charCount();
                }
                const walkFns = {
                    goSubtree: true,
                    done: false,
                    leaf(relativeStart, relativeLength, ll) {
                        if (!f(ll, relativeStart, relativeLength)) {
                            this.done = true;
                        }
                    }
                };
                this.walk(rangeStart, rangeEnd - rangeStart, walkFns);
                return !walkFns.done;
            }
            edit(pos, deleteLength, newText) {
                if (this.root.charCount() === 0) {
                    ts.Debug.assert(deleteLength === 0); // Can't delete from empty document
                    if (newText !== undefined) {
                        this.load(LineIndex.linesFromText(newText).lines);
                        return this;
                    }
                }
                else {
                    let checkText;
                    if (this.checkEdits) {
                        const source = this.getText(0, this.root.charCount());
                        checkText = source.slice(0, pos) + newText + source.slice(pos + deleteLength);
                    }
                    const walker = new EditWalker();
                    let suppressTrailingText = false;
                    if (pos >= this.root.charCount()) {
                        // insert at end
                        pos = this.root.charCount() - 1;
                        const endString = this.getText(pos, 1);
                        if (newText) {
                            newText = endString + newText;
                        }
                        else {
                            newText = endString;
                        }
                        deleteLength = 0;
                        suppressTrailingText = true;
                    }
                    else if (deleteLength > 0) {
                        // check whether last characters deleted are line break
                        const e = pos + deleteLength;
                        const { zeroBasedColumn, lineText } = this.positionToColumnAndLineText(e);
                        if (zeroBasedColumn === 0) {
                            // move range end just past line that will merge with previous line
                            deleteLength += lineText.length;
                            // store text by appending to end of insertedText
                            newText = newText ? newText + lineText : lineText;
                        }
                    }
                    this.root.walk(pos, deleteLength, walker);
                    walker.insertLines(newText, suppressTrailingText);
                    if (this.checkEdits) {
                        const updatedText = walker.lineIndex.getText(0, walker.lineIndex.getLength());
                        ts.Debug.assert(checkText === updatedText, "buffer edit mismatch");
                    }
                    return walker.lineIndex;
                }
            }
            static buildTreeFromBottom(nodes) {
                if (nodes.length < lineCollectionCapacity) {
                    return new LineNode(nodes);
                }
                const interiorNodes = new Array(Math.ceil(nodes.length / lineCollectionCapacity));
                let nodeIndex = 0;
                for (let i = 0; i < interiorNodes.length; i++) {
                    const end = Math.min(nodeIndex + lineCollectionCapacity, nodes.length);
                    interiorNodes[i] = new LineNode(nodes.slice(nodeIndex, end));
                    nodeIndex = end;
                }
                return this.buildTreeFromBottom(interiorNodes);
            }
            static linesFromText(text) {
                const lineMap = ts.computeLineStarts(text);
                if (lineMap.length === 0) {
                    return { lines: [], lineMap };
                }
                const lines = new Array(lineMap.length);
                const lc = lineMap.length - 1;
                for (let lmi = 0; lmi < lc; lmi++) {
                    lines[lmi] = text.substring(lineMap[lmi], lineMap[lmi + 1]);
                }
                const endText = text.substring(lineMap[lc]);
                if (endText.length > 0) {
                    lines[lc] = endText;
                }
                else {
                    lines.pop();
                }
                return { lines, lineMap };
            }
        }
        server.LineIndex = LineIndex;
        class LineNode {
            constructor(children = []) {
                this.children = children;
                this.totalChars = 0;
                this.totalLines = 0;
                if (children.length)
                    this.updateCounts();
            }
            isLeaf() {
                return false;
            }
            updateCounts() {
                this.totalChars = 0;
                this.totalLines = 0;
                for (const child of this.children) {
                    this.totalChars += child.charCount();
                    this.totalLines += child.lineCount();
                }
            }
            execWalk(rangeStart, rangeLength, walkFns, childIndex, nodeType) {
                if (walkFns.pre) {
                    walkFns.pre(rangeStart, rangeLength, this.children[childIndex], this, nodeType);
                }
                if (walkFns.goSubtree) {
                    this.children[childIndex].walk(rangeStart, rangeLength, walkFns);
                    if (walkFns.post) {
                        walkFns.post(rangeStart, rangeLength, this.children[childIndex], this, nodeType);
                    }
                }
                else {
                    walkFns.goSubtree = true;
                }
                return walkFns.done;
            }
            skipChild(relativeStart, relativeLength, childIndex, walkFns, nodeType) {
                if (walkFns.pre && (!walkFns.done)) {
                    walkFns.pre(relativeStart, relativeLength, this.children[childIndex], this, nodeType);
                    walkFns.goSubtree = true;
                }
            }
            walk(rangeStart, rangeLength, walkFns) {
                // assume (rangeStart < this.totalChars) && (rangeLength <= this.totalChars)
                let childIndex = 0;
                let childCharCount = this.children[childIndex].charCount();
                // find sub-tree containing start
                let adjustedStart = rangeStart;
                while (adjustedStart >= childCharCount) {
                    this.skipChild(adjustedStart, rangeLength, childIndex, walkFns, 0 /* PreStart */);
                    adjustedStart -= childCharCount;
                    childIndex++;
                    childCharCount = this.children[childIndex].charCount();
                }
                // Case I: both start and end of range in same subtree
                if ((adjustedStart + rangeLength) <= childCharCount) {
                    if (this.execWalk(adjustedStart, rangeLength, walkFns, childIndex, 2 /* Entire */)) {
                        return;
                    }
                }
                else {
                    // Case II: start and end of range in different subtrees (possibly with subtrees in the middle)
                    if (this.execWalk(adjustedStart, childCharCount - adjustedStart, walkFns, childIndex, 1 /* Start */)) {
                        return;
                    }
                    let adjustedLength = rangeLength - (childCharCount - adjustedStart);
                    childIndex++;
                    const child = this.children[childIndex];
                    childCharCount = child.charCount();
                    while (adjustedLength > childCharCount) {
                        if (this.execWalk(0, childCharCount, walkFns, childIndex, 3 /* Mid */)) {
                            return;
                        }
                        adjustedLength -= childCharCount;
                        childIndex++;
                        childCharCount = this.children[childIndex].charCount();
                    }
                    if (adjustedLength > 0) {
                        if (this.execWalk(0, adjustedLength, walkFns, childIndex, 4 /* End */)) {
                            return;
                        }
                    }
                }
                // Process any subtrees after the one containing range end
                if (walkFns.pre) {
                    const clen = this.children.length;
                    if (childIndex < (clen - 1)) {
                        for (let ej = childIndex + 1; ej < clen; ej++) {
                            this.skipChild(0, 0, ej, walkFns, 5 /* PostEnd */);
                        }
                    }
                }
            }
            // Input position is relative to the start of this node.
            // Output line number is absolute.
            charOffsetToLineInfo(lineNumberAccumulator, relativePosition) {
                if (this.children.length === 0) {
                    // Root node might have no children if this is an empty document.
                    return { oneBasedLine: lineNumberAccumulator, zeroBasedColumn: relativePosition, lineText: undefined };
                }
                for (const child of this.children) {
                    if (child.charCount() > relativePosition) {
                        if (child.isLeaf()) {
                            return { oneBasedLine: lineNumberAccumulator, zeroBasedColumn: relativePosition, lineText: child.text };
                        }
                        else {
                            return child.charOffsetToLineInfo(lineNumberAccumulator, relativePosition);
                        }
                    }
                    else {
                        relativePosition -= child.charCount();
                        lineNumberAccumulator += child.lineCount();
                    }
                }
                // Skipped all children
                const { leaf } = this.lineNumberToInfo(this.lineCount(), 0);
                return { oneBasedLine: this.lineCount(), zeroBasedColumn: leaf ? leaf.charCount() : 0, lineText: undefined };
            }
            /**
             * Input line number is relative to the start of this node.
             * Output line number is relative to the child.
             * positionAccumulator will be an absolute position once relativeLineNumber reaches 0.
             */
            lineNumberToInfo(relativeOneBasedLine, positionAccumulator) {
                for (const child of this.children) {
                    const childLineCount = child.lineCount();
                    if (childLineCount >= relativeOneBasedLine) {
                        return child.isLeaf() ? { position: positionAccumulator, leaf: child } : child.lineNumberToInfo(relativeOneBasedLine, positionAccumulator);
                    }
                    else {
                        relativeOneBasedLine -= childLineCount;
                        positionAccumulator += child.charCount();
                    }
                }
                return { position: positionAccumulator, leaf: undefined };
            }
            splitAfter(childIndex) {
                let splitNode;
                const clen = this.children.length;
                childIndex++;
                const endLength = childIndex;
                if (childIndex < clen) {
                    splitNode = new LineNode();
                    while (childIndex < clen) {
                        splitNode.add(this.children[childIndex]);
                        childIndex++;
                    }
                    splitNode.updateCounts();
                }
                this.children.length = endLength;
                return splitNode;
            }
            remove(child) {
                const childIndex = this.findChildIndex(child);
                const clen = this.children.length;
                if (childIndex < (clen - 1)) {
                    for (let i = childIndex; i < (clen - 1); i++) {
                        this.children[i] = this.children[i + 1];
                    }
                }
                this.children.pop();
            }
            findChildIndex(child) {
                const childIndex = this.children.indexOf(child);
                ts.Debug.assert(childIndex !== -1);
                return childIndex;
            }
            insertAt(child, nodes) {
                let childIndex = this.findChildIndex(child);
                const clen = this.children.length;
                const nodeCount = nodes.length;
                // if child is last and there is more room and only one node to place, place it
                if ((clen < lineCollectionCapacity) && (childIndex === (clen - 1)) && (nodeCount === 1)) {
                    this.add(nodes[0]);
                    this.updateCounts();
                    return [];
                }
                else {
                    const shiftNode = this.splitAfter(childIndex);
                    let nodeIndex = 0;
                    childIndex++;
                    while ((childIndex < lineCollectionCapacity) && (nodeIndex < nodeCount)) {
                        this.children[childIndex] = nodes[nodeIndex];
                        childIndex++;
                        nodeIndex++;
                    }
                    let splitNodes = [];
                    let splitNodeCount = 0;
                    if (nodeIndex < nodeCount) {
                        splitNodeCount = Math.ceil((nodeCount - nodeIndex) / lineCollectionCapacity);
                        splitNodes = new Array(splitNodeCount);
                        let splitNodeIndex = 0;
                        for (let i = 0; i < splitNodeCount; i++) {
                            splitNodes[i] = new LineNode();
                        }
                        let splitNode = splitNodes[0];
                        while (nodeIndex < nodeCount) {
                            splitNode.add(nodes[nodeIndex]);
                            nodeIndex++;
                            if (splitNode.children.length === lineCollectionCapacity) {
                                splitNodeIndex++;
                                splitNode = splitNodes[splitNodeIndex];
                            }
                        }
                        for (let i = splitNodes.length - 1; i >= 0; i--) {
                            if (splitNodes[i].children.length === 0) {
                                splitNodes.pop();
                            }
                        }
                    }
                    if (shiftNode) {
                        splitNodes.push(shiftNode);
                    }
                    this.updateCounts();
                    for (let i = 0; i < splitNodeCount; i++) {
                        splitNodes[i].updateCounts();
                    }
                    return splitNodes;
                }
            }
            // assume there is room for the item; return true if more room
            add(collection) {
                this.children.push(collection);
                ts.Debug.assert(this.children.length <= lineCollectionCapacity);
            }
            charCount() {
                return this.totalChars;
            }
            lineCount() {
                return this.totalLines;
            }
        }
        class LineLeaf {
            constructor(text) {
                this.text = text;
            }
            isLeaf() {
                return true;
            }
            walk(rangeStart, rangeLength, walkFns) {
                walkFns.leaf(rangeStart, rangeLength, this);
            }
            charCount() {
                return this.text.length;
            }
            lineCount() {
                return 1;
            }
        }
    })(server = ts.server || (ts.server = {}));
})(ts || (ts = {}));
