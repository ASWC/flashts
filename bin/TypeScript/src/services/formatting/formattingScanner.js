/* @internal */
var ts;
(function (ts) {
    var formatting;
    (function (formatting) {
        const standardScanner = ts.createScanner(ts.ScriptTarget.Latest, /*skipTrivia*/ false, ts.LanguageVariant.Standard);
        const jsxScanner = ts.createScanner(ts.ScriptTarget.Latest, /*skipTrivia*/ false, ts.LanguageVariant.JSX);
        function getFormattingScanner(text, languageVariant, startPos, endPos, cb) {
            const scanner = languageVariant === ts.LanguageVariant.JSX ? jsxScanner : standardScanner;
            scanner.setText(text);
            scanner.setTextPos(startPos);
            let wasNewLine = true;
            let leadingTrivia;
            let trailingTrivia;
            let savedPos;
            let lastScanAction;
            let lastTokenInfo;
            const res = cb({
                advance,
                readTokenInfo,
                isOnToken,
                getCurrentLeadingTrivia: () => leadingTrivia,
                lastTrailingTriviaWasNewLine: () => wasNewLine,
                skipToEndOf,
            });
            lastTokenInfo = undefined;
            scanner.setText(undefined);
            return res;
            function advance() {
                lastTokenInfo = undefined;
                const isStarted = scanner.getStartPos() !== startPos;
                if (isStarted) {
                    wasNewLine = trailingTrivia && ts.lastOrUndefined(trailingTrivia).kind === ts.SyntaxKind.NewLineTrivia;
                }
                else {
                    scanner.scan();
                }
                leadingTrivia = undefined;
                trailingTrivia = undefined;
                let pos = scanner.getStartPos();
                // Read leading trivia and token
                while (pos < endPos) {
                    const t = scanner.getToken();
                    if (!ts.isTrivia(t)) {
                        break;
                    }
                    // consume leading trivia
                    scanner.scan();
                    const item = {
                        pos,
                        end: scanner.getStartPos(),
                        kind: t
                    };
                    pos = scanner.getStartPos();
                    leadingTrivia = ts.append(leadingTrivia, item);
                }
                savedPos = scanner.getStartPos();
            }
            function shouldRescanGreaterThanToken(node) {
                switch (node.kind) {
                    case ts.SyntaxKind.GreaterThanEqualsToken:
                    case ts.SyntaxKind.GreaterThanGreaterThanEqualsToken:
                    case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken:
                    case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
                    case ts.SyntaxKind.GreaterThanGreaterThanToken:
                        return true;
                }
                return false;
            }
            function shouldRescanJsxIdentifier(node) {
                if (node.parent) {
                    switch (node.parent.kind) {
                        case ts.SyntaxKind.JsxAttribute:
                        case ts.SyntaxKind.JsxOpeningElement:
                        case ts.SyntaxKind.JsxClosingElement:
                        case ts.SyntaxKind.JsxSelfClosingElement:
                            // May parse an identifier like `module-layout`; that will be scanned as a keyword at first, but we should parse the whole thing to get an identifier.
                            return ts.isKeyword(node.kind) || node.kind === ts.SyntaxKind.Identifier;
                    }
                }
                return false;
            }
            function shouldRescanJsxText(node) {
                return node.kind === ts.SyntaxKind.JsxText;
            }
            function shouldRescanSlashToken(container) {
                return container.kind === ts.SyntaxKind.RegularExpressionLiteral;
            }
            function shouldRescanTemplateToken(container) {
                return container.kind === ts.SyntaxKind.TemplateMiddle ||
                    container.kind === ts.SyntaxKind.TemplateTail;
            }
            function startsWithSlashToken(t) {
                return t === ts.SyntaxKind.SlashToken || t === ts.SyntaxKind.SlashEqualsToken;
            }
            function readTokenInfo(n) {
                ts.Debug.assert(isOnToken());
                // normally scanner returns the smallest available token
                // check the kind of context node to determine if scanner should have more greedy behavior and consume more text.
                const expectedScanAction = shouldRescanGreaterThanToken(n)
                    ? 1 /* RescanGreaterThanToken */
                    : shouldRescanSlashToken(n)
                        ? 2 /* RescanSlashToken */
                        : shouldRescanTemplateToken(n)
                            ? 3 /* RescanTemplateToken */
                            : shouldRescanJsxIdentifier(n)
                                ? 4 /* RescanJsxIdentifier */
                                : shouldRescanJsxText(n)
                                    ? 5 /* RescanJsxText */
                                    : 0 /* Scan */;
                if (lastTokenInfo && expectedScanAction === lastScanAction) {
                    // readTokenInfo was called before with the same expected scan action.
                    // No need to re-scan text, return existing 'lastTokenInfo'
                    // it is ok to call fixTokenKind here since it does not affect
                    // what portion of text is consumed. In contrast rescanning can change it,
                    // i.e. for '>=' when originally scanner eats just one character
                    // and rescanning forces it to consume more.
                    return fixTokenKind(lastTokenInfo, n);
                }
                if (scanner.getStartPos() !== savedPos) {
                    ts.Debug.assert(lastTokenInfo !== undefined);
                    // readTokenInfo was called before but scan action differs - rescan text
                    scanner.setTextPos(savedPos);
                    scanner.scan();
                }
                let currentToken = getNextToken(n, expectedScanAction);
                const token = {
                    pos: scanner.getStartPos(),
                    end: scanner.getTextPos(),
                    kind: currentToken
                };
                // consume trailing trivia
                if (trailingTrivia) {
                    trailingTrivia = undefined;
                }
                while (scanner.getStartPos() < endPos) {
                    currentToken = scanner.scan();
                    if (!ts.isTrivia(currentToken)) {
                        break;
                    }
                    const trivia = {
                        pos: scanner.getStartPos(),
                        end: scanner.getTextPos(),
                        kind: currentToken
                    };
                    if (!trailingTrivia) {
                        trailingTrivia = [];
                    }
                    trailingTrivia.push(trivia);
                    if (currentToken === ts.SyntaxKind.NewLineTrivia) {
                        // move past new line
                        scanner.scan();
                        break;
                    }
                }
                lastTokenInfo = { leadingTrivia, trailingTrivia, token };
                return fixTokenKind(lastTokenInfo, n);
            }
            function getNextToken(n, expectedScanAction) {
                const token = scanner.getToken();
                lastScanAction = 0 /* Scan */;
                switch (expectedScanAction) {
                    case 1 /* RescanGreaterThanToken */:
                        if (token === ts.SyntaxKind.GreaterThanToken) {
                            lastScanAction = 1 /* RescanGreaterThanToken */;
                            const newToken = scanner.reScanGreaterToken();
                            ts.Debug.assert(n.kind === newToken);
                            return newToken;
                        }
                        break;
                    case 2 /* RescanSlashToken */:
                        if (startsWithSlashToken(token)) {
                            lastScanAction = 2 /* RescanSlashToken */;
                            const newToken = scanner.reScanSlashToken();
                            ts.Debug.assert(n.kind === newToken);
                            return newToken;
                        }
                        break;
                    case 3 /* RescanTemplateToken */:
                        if (token === ts.SyntaxKind.CloseBraceToken) {
                            lastScanAction = 3 /* RescanTemplateToken */;
                            return scanner.reScanTemplateToken();
                        }
                        break;
                    case 4 /* RescanJsxIdentifier */:
                        lastScanAction = 4 /* RescanJsxIdentifier */;
                        return scanner.scanJsxIdentifier();
                    case 5 /* RescanJsxText */:
                        lastScanAction = 5 /* RescanJsxText */;
                        return scanner.reScanJsxToken();
                    case 0 /* Scan */:
                        break;
                    default:
                        ts.Debug.assertNever(expectedScanAction);
                }
                return token;
            }
            function isOnToken() {
                const current = lastTokenInfo ? lastTokenInfo.token.kind : scanner.getToken();
                const startPos = lastTokenInfo ? lastTokenInfo.token.pos : scanner.getStartPos();
                return startPos < endPos && current !== ts.SyntaxKind.EndOfFileToken && !ts.isTrivia(current);
            }
            // when containing node in the tree is token
            // but its kind differs from the kind that was returned by the scanner,
            // then kind needs to be fixed. This might happen in cases
            // when parser interprets token differently, i.e keyword treated as identifier
            function fixTokenKind(tokenInfo, container) {
                if (ts.isToken(container) && tokenInfo.token.kind !== container.kind) {
                    tokenInfo.token.kind = container.kind;
                }
                return tokenInfo;
            }
            function skipToEndOf(node) {
                scanner.setTextPos(node.end);
                savedPos = scanner.getStartPos();
                lastScanAction = undefined;
                lastTokenInfo = undefined;
                wasNewLine = false;
                leadingTrivia = undefined;
                trailingTrivia = undefined;
            }
        }
        formatting.getFormattingScanner = getFormattingScanner;
    })(formatting = ts.formatting || (ts.formatting = {}));
})(ts || (ts = {}));
