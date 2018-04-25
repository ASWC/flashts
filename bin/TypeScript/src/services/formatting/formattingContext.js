/* @internal */
var ts;
(function (ts) {
    var formatting;
    (function (formatting) {
        class FormattingContext {
            constructor(sourceFile, formattingRequestKind, options) {
                this.sourceFile = sourceFile;
                this.formattingRequestKind = formattingRequestKind;
                this.options = options;
            }
            updateContext(currentRange, currentTokenParent, nextRange, nextTokenParent, commonParent) {
                ts.Debug.assert(currentRange !== undefined, "currentTokenSpan is null");
                ts.Debug.assert(currentTokenParent !== undefined, "currentTokenParent is null");
                ts.Debug.assert(nextRange !== undefined, "nextTokenSpan is null");
                ts.Debug.assert(nextTokenParent !== undefined, "nextTokenParent is null");
                ts.Debug.assert(commonParent !== undefined, "commonParent is null");
                this.currentTokenSpan = currentRange;
                this.currentTokenParent = currentTokenParent;
                this.nextTokenSpan = nextRange;
                this.nextTokenParent = nextTokenParent;
                this.contextNode = commonParent;
                // drop cached results
                this.contextNodeAllOnSameLine = undefined;
                this.nextNodeAllOnSameLine = undefined;
                this.tokensAreOnSameLine = undefined;
                this.contextNodeBlockIsOnOneLine = undefined;
                this.nextNodeBlockIsOnOneLine = undefined;
            }
            ContextNodeAllOnSameLine() {
                if (this.contextNodeAllOnSameLine === undefined) {
                    this.contextNodeAllOnSameLine = this.NodeIsOnOneLine(this.contextNode);
                }
                return this.contextNodeAllOnSameLine;
            }
            NextNodeAllOnSameLine() {
                if (this.nextNodeAllOnSameLine === undefined) {
                    this.nextNodeAllOnSameLine = this.NodeIsOnOneLine(this.nextTokenParent);
                }
                return this.nextNodeAllOnSameLine;
            }
            TokensAreOnSameLine() {
                if (this.tokensAreOnSameLine === undefined) {
                    const startLine = this.sourceFile.getLineAndCharacterOfPosition(this.currentTokenSpan.pos).line;
                    const endLine = this.sourceFile.getLineAndCharacterOfPosition(this.nextTokenSpan.pos).line;
                    this.tokensAreOnSameLine = (startLine === endLine);
                }
                return this.tokensAreOnSameLine;
            }
            ContextNodeBlockIsOnOneLine() {
                if (this.contextNodeBlockIsOnOneLine === undefined) {
                    this.contextNodeBlockIsOnOneLine = this.BlockIsOnOneLine(this.contextNode);
                }
                return this.contextNodeBlockIsOnOneLine;
            }
            NextNodeBlockIsOnOneLine() {
                if (this.nextNodeBlockIsOnOneLine === undefined) {
                    this.nextNodeBlockIsOnOneLine = this.BlockIsOnOneLine(this.nextTokenParent);
                }
                return this.nextNodeBlockIsOnOneLine;
            }
            NodeIsOnOneLine(node) {
                const startLine = this.sourceFile.getLineAndCharacterOfPosition(node.getStart(this.sourceFile)).line;
                const endLine = this.sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line;
                return startLine === endLine;
            }
            BlockIsOnOneLine(node) {
                const openBrace = ts.findChildOfKind(node, ts.SyntaxKind.OpenBraceToken, this.sourceFile);
                const closeBrace = ts.findChildOfKind(node, ts.SyntaxKind.CloseBraceToken, this.sourceFile);
                if (openBrace && closeBrace) {
                    const startLine = this.sourceFile.getLineAndCharacterOfPosition(openBrace.getEnd()).line;
                    const endLine = this.sourceFile.getLineAndCharacterOfPosition(closeBrace.getStart(this.sourceFile)).line;
                    return startLine === endLine;
                }
                return false;
            }
        }
        formatting.FormattingContext = FormattingContext;
    })(formatting = ts.formatting || (ts.formatting = {}));
})(ts || (ts = {}));
