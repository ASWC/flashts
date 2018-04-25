var ts;
(function (ts) {
    function createClassifier() {
        const scanner = ts.createScanner(ts.ScriptTarget.Latest, /*skipTrivia*/ false);
        function getClassificationsForLine(text, lexState, syntacticClassifierAbsent) {
            return convertClassificationsToResult(getEncodedLexicalClassifications(text, lexState, syntacticClassifierAbsent), text);
        }
        // If there is a syntactic classifier ('syntacticClassifierAbsent' is false),
        // we will be more conservative in order to avoid conflicting with the syntactic classifier.
        function getEncodedLexicalClassifications(text, lexState, syntacticClassifierAbsent) {
            let token = ts.SyntaxKind.Unknown;
            let lastNonTriviaToken = ts.SyntaxKind.Unknown;
            // Just a stack of TemplateHeads and OpenCurlyBraces, used to perform rudimentary (inexact)
            // classification on template strings. Because of the context free nature of templates,
            // the only precise way to classify a template portion would be by propagating the stack across
            // lines, just as we do with the end-of-line state. However, this is a burden for implementers,
            // and the behavior is entirely subsumed by the syntactic classifier anyway, so we instead
            // flatten any nesting when the template stack is non-empty and encode it in the end-of-line state.
            // Situations in which this fails are
            //  1) When template strings are nested across different lines:
            //          `hello ${ `world
            //          ` }`
            //
            //     Where on the second line, you will get the closing of a template,
            //     a closing curly, and a new template.
            //
            //  2) When substitution expressions have curly braces and the curly brace falls on the next line:
            //          `hello ${ () => {
            //          return "world" } } `
            //
            //     Where on the second line, you will get the 'return' keyword,
            //     a string literal, and a template end consisting of '} } `'.
            const templateStack = [];
            const { prefix, pushTemplate } = getPrefixFromLexState(lexState);
            text = prefix + text;
            const offset = prefix.length;
            if (pushTemplate) {
                templateStack.push(ts.SyntaxKind.TemplateHead);
            }
            scanner.setText(text);
            let endOfLineState = ts.EndOfLineState.None;
            const spans = [];
            // We can run into an unfortunate interaction between the lexical and syntactic classifier
            // when the user is typing something generic.  Consider the case where the user types:
            //
            //      Foo<number
            //
            // From the lexical classifier's perspective, 'number' is a keyword, and so the word will
            // be classified as such.  However, from the syntactic classifier's tree-based perspective
            // this is simply an expression with the identifier 'number' on the RHS of the less than
            // token.  So the classification will go back to being an identifier.  The moment the user
            // types again, number will become a keyword, then an identifier, etc. etc.
            //
            // To try to avoid this problem, we avoid classifying contextual keywords as keywords
            // when the user is potentially typing something generic.  We just can't do a good enough
            // job at the lexical level, and so well leave it up to the syntactic classifier to make
            // the determination.
            //
            // In order to determine if the user is potentially typing something generic, we use a
            // weak heuristic where we track < and > tokens.  It's a weak heuristic, but should
            // work well enough in practice.
            let angleBracketStack = 0;
            do {
                token = scanner.scan();
                if (!ts.isTrivia(token)) {
                    handleToken();
                    lastNonTriviaToken = token;
                }
                const end = scanner.getTextPos();
                pushEncodedClassification(scanner.getTokenPos(), end, offset, classFromKind(token), spans);
                if (end >= text.length) {
                    const end = getNewEndOfLineState(scanner, token, ts.lastOrUndefined(templateStack));
                    if (end !== undefined) {
                        endOfLineState = end;
                    }
                }
            } while (token !== ts.SyntaxKind.EndOfFileToken);
            function handleToken() {
                switch (token) {
                    case ts.SyntaxKind.SlashToken:
                    case ts.SyntaxKind.SlashEqualsToken:
                        if (!noRegexTable[lastNonTriviaToken] && scanner.reScanSlashToken() === ts.SyntaxKind.RegularExpressionLiteral) {
                            token = ts.SyntaxKind.RegularExpressionLiteral;
                        }
                        break;
                    case ts.SyntaxKind.LessThanToken:
                        if (lastNonTriviaToken === ts.SyntaxKind.Identifier) {
                            // Could be the start of something generic.  Keep track of that by bumping
                            // up the current count of generic contexts we may be in.
                            angleBracketStack++;
                        }
                        break;
                    case ts.SyntaxKind.GreaterThanToken:
                        if (angleBracketStack > 0) {
                            // If we think we're currently in something generic, then mark that that
                            // generic entity is complete.
                            angleBracketStack--;
                        }
                        break;
                    case ts.SyntaxKind.AnyKeyword:
                    case ts.SyntaxKind.StringKeyword:
                    case ts.SyntaxKind.NumberKeyword:
                    case ts.SyntaxKind.BooleanKeyword:
                    case ts.SyntaxKind.SymbolKeyword:
                        if (angleBracketStack > 0 && !syntacticClassifierAbsent) {
                            // If it looks like we're could be in something generic, don't classify this
                            // as a keyword.  We may just get overwritten by the syntactic classifier,
                            // causing a noisy experience for the user.
                            token = ts.SyntaxKind.Identifier;
                        }
                        break;
                    case ts.SyntaxKind.TemplateHead:
                        templateStack.push(token);
                        break;
                    case ts.SyntaxKind.OpenBraceToken:
                        // If we don't have anything on the template stack,
                        // then we aren't trying to keep track of a previously scanned template head.
                        if (templateStack.length > 0) {
                            templateStack.push(token);
                        }
                        break;
                    case ts.SyntaxKind.CloseBraceToken:
                        // If we don't have anything on the template stack,
                        // then we aren't trying to keep track of a previously scanned template head.
                        if (templateStack.length > 0) {
                            const lastTemplateStackToken = ts.lastOrUndefined(templateStack);
                            if (lastTemplateStackToken === ts.SyntaxKind.TemplateHead) {
                                token = scanner.reScanTemplateToken();
                                // Only pop on a TemplateTail; a TemplateMiddle indicates there is more for us.
                                if (token === ts.SyntaxKind.TemplateTail) {
                                    templateStack.pop();
                                }
                                else {
                                    ts.Debug.assertEqual(token, ts.SyntaxKind.TemplateMiddle, "Should have been a template middle.");
                                }
                            }
                            else {
                                ts.Debug.assertEqual(lastTemplateStackToken, ts.SyntaxKind.OpenBraceToken, "Should have been an open brace");
                                templateStack.pop();
                            }
                        }
                        break;
                    default:
                        if (!ts.isKeyword(token)) {
                            break;
                        }
                        if (lastNonTriviaToken === ts.SyntaxKind.DotToken) {
                            token = ts.SyntaxKind.Identifier;
                        }
                        else if (ts.isKeyword(lastNonTriviaToken) && ts.isKeyword(token) && !canFollow(lastNonTriviaToken, token)) {
                            // We have two keywords in a row.  Only treat the second as a keyword if
                            // it's a sequence that could legally occur in the language.  Otherwise
                            // treat it as an identifier.  This way, if someone writes "private var"
                            // we recognize that 'var' is actually an identifier here.
                            token = ts.SyntaxKind.Identifier;
                        }
                }
            }
            return { endOfLineState, spans };
        }
        return { getClassificationsForLine, getEncodedLexicalClassifications };
    }
    ts.createClassifier = createClassifier;
    /// We do not have a full parser support to know when we should parse a regex or not
    /// If we consider every slash token to be a regex, we could be missing cases like "1/2/3", where
    /// we have a series of divide operator. this list allows us to be more accurate by ruling out
    /// locations where a regexp cannot exist.
    const noRegexTable = ts.arrayToNumericMap([
        ts.SyntaxKind.Identifier,
        ts.SyntaxKind.StringLiteral,
        ts.SyntaxKind.NumericLiteral,
        ts.SyntaxKind.RegularExpressionLiteral,
        ts.SyntaxKind.ThisKeyword,
        ts.SyntaxKind.PlusPlusToken,
        ts.SyntaxKind.MinusMinusToken,
        ts.SyntaxKind.CloseParenToken,
        ts.SyntaxKind.CloseBracketToken,
        ts.SyntaxKind.CloseBraceToken,
        ts.SyntaxKind.TrueKeyword,
        ts.SyntaxKind.FalseKeyword,
    ], token => token, () => true);
    function getNewEndOfLineState(scanner, token, lastOnTemplateStack) {
        switch (token) {
            case ts.SyntaxKind.StringLiteral: {
                // Check to see if we finished up on a multiline string literal.
                if (!scanner.isUnterminated())
                    return undefined;
                const tokenText = scanner.getTokenText();
                const lastCharIndex = tokenText.length - 1;
                let numBackslashes = 0;
                while (tokenText.charCodeAt(lastCharIndex - numBackslashes) === 92 /* backslash */) {
                    numBackslashes++;
                }
                // If we have an odd number of backslashes, then the multiline string is unclosed
                if ((numBackslashes & 1) === 0)
                    return undefined;
                return tokenText.charCodeAt(0) === 34 /* doubleQuote */ ? ts.EndOfLineState.InDoubleQuoteStringLiteral : ts.EndOfLineState.InSingleQuoteStringLiteral;
            }
            case ts.SyntaxKind.MultiLineCommentTrivia:
                // Check to see if the multiline comment was unclosed.
                return scanner.isUnterminated() ? ts.EndOfLineState.InMultiLineCommentTrivia : undefined;
            default:
                if (ts.isTemplateLiteralKind(token)) {
                    if (!scanner.isUnterminated()) {
                        return undefined;
                    }
                    switch (token) {
                        case ts.SyntaxKind.TemplateTail:
                            return ts.EndOfLineState.InTemplateMiddleOrTail;
                        case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
                            return ts.EndOfLineState.InTemplateHeadOrNoSubstitutionTemplate;
                        default:
                            return ts.Debug.fail("Only 'NoSubstitutionTemplateLiteral's and 'TemplateTail's can be unterminated; got SyntaxKind #" + token);
                    }
                }
                return lastOnTemplateStack === ts.SyntaxKind.TemplateHead ? ts.EndOfLineState.InTemplateSubstitutionPosition : undefined;
        }
    }
    function pushEncodedClassification(start, end, offset, classification, result) {
        if (classification === ts.ClassificationType.whiteSpace) {
            // Don't bother with whitespace classifications.  They're not needed.
            return;
        }
        if (start === 0 && offset > 0) {
            // We're classifying the first token, and this was a case where we prepended text.
            // We should consider the start of this token to be at the start of the original text.
            start += offset;
        }
        const length = end - start;
        if (length > 0) {
            // All our tokens are in relation to the augmented text.  Move them back to be
            // relative to the original text.
            result.push(start - offset, length, classification);
        }
    }
    function convertClassificationsToResult(classifications, text) {
        const entries = [];
        const dense = classifications.spans;
        let lastEnd = 0;
        for (let i = 0; i < dense.length; i += 3) {
            const start = dense[i];
            const length = dense[i + 1];
            const type = dense[i + 2];
            // Make a whitespace entry between the last item and this one.
            if (lastEnd >= 0) {
                const whitespaceLength = start - lastEnd;
                if (whitespaceLength > 0) {
                    entries.push({ length: whitespaceLength, classification: ts.TokenClass.Whitespace });
                }
            }
            entries.push({ length, classification: convertClassification(type) });
            lastEnd = start + length;
        }
        const whitespaceLength = text.length - lastEnd;
        if (whitespaceLength > 0) {
            entries.push({ length: whitespaceLength, classification: ts.TokenClass.Whitespace });
        }
        return { entries, finalLexState: classifications.endOfLineState };
    }
    function convertClassification(type) {
        switch (type) {
            case ts.ClassificationType.comment: return ts.TokenClass.Comment;
            case ts.ClassificationType.keyword: return ts.TokenClass.Keyword;
            case ts.ClassificationType.numericLiteral: return ts.TokenClass.NumberLiteral;
            case ts.ClassificationType.operator: return ts.TokenClass.Operator;
            case ts.ClassificationType.stringLiteral: return ts.TokenClass.StringLiteral;
            case ts.ClassificationType.whiteSpace: return ts.TokenClass.Whitespace;
            case ts.ClassificationType.punctuation: return ts.TokenClass.Punctuation;
            case ts.ClassificationType.identifier:
            case ts.ClassificationType.className:
            case ts.ClassificationType.enumName:
            case ts.ClassificationType.interfaceName:
            case ts.ClassificationType.moduleName:
            case ts.ClassificationType.typeParameterName:
            case ts.ClassificationType.typeAliasName:
            case ts.ClassificationType.text:
            case ts.ClassificationType.parameterName:
                return ts.TokenClass.Identifier;
        }
    }
    /** Returns true if 'keyword2' can legally follow 'keyword1' in any language construct. */
    function canFollow(keyword1, keyword2) {
        if (!ts.isAccessibilityModifier(keyword1)) {
            // Assume any other keyword combination is legal.
            // This can be refined in the future if there are more cases we want the classifier to be better at.
            return true;
        }
        switch (keyword2) {
            case ts.SyntaxKind.GetKeyword:
            case ts.SyntaxKind.SetKeyword:
            case ts.SyntaxKind.ConstructorKeyword:
            case ts.SyntaxKind.StaticKeyword:
                return true; // Allow things like "public get", "public constructor" and "public static".
            default:
                return false; // Any other keyword following "public" is actually an identifier, not a real keyword.
        }
    }
    function getPrefixFromLexState(lexState) {
        // If we're in a string literal, then prepend: "\
        // (and a newline).  That way when we lex we'll think we're still in a string literal.
        //
        // If we're in a multiline comment, then prepend: /*
        // (and a newline).  That way when we lex we'll think we're still in a multiline comment.
        switch (lexState) {
            case ts.EndOfLineState.InDoubleQuoteStringLiteral:
                return { prefix: "\"\\\n" };
            case ts.EndOfLineState.InSingleQuoteStringLiteral:
                return { prefix: "'\\\n" };
            case ts.EndOfLineState.InMultiLineCommentTrivia:
                return { prefix: "/*\n" };
            case ts.EndOfLineState.InTemplateHeadOrNoSubstitutionTemplate:
                return { prefix: "`\n" };
            case ts.EndOfLineState.InTemplateMiddleOrTail:
                return { prefix: "}\n", pushTemplate: true };
            case ts.EndOfLineState.InTemplateSubstitutionPosition:
                return { prefix: "", pushTemplate: true };
            case ts.EndOfLineState.None:
                return { prefix: "" };
            default:
                return ts.Debug.assertNever(lexState);
        }
    }
    function isBinaryExpressionOperatorToken(token) {
        switch (token) {
            case ts.SyntaxKind.AsteriskToken:
            case ts.SyntaxKind.SlashToken:
            case ts.SyntaxKind.PercentToken:
            case ts.SyntaxKind.PlusToken:
            case ts.SyntaxKind.MinusToken:
            case ts.SyntaxKind.LessThanLessThanToken:
            case ts.SyntaxKind.GreaterThanGreaterThanToken:
            case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
            case ts.SyntaxKind.LessThanToken:
            case ts.SyntaxKind.GreaterThanToken:
            case ts.SyntaxKind.LessThanEqualsToken:
            case ts.SyntaxKind.GreaterThanEqualsToken:
            case ts.SyntaxKind.InstanceOfKeyword:
            case ts.SyntaxKind.InKeyword:
            case ts.SyntaxKind.AsKeyword:
            case ts.SyntaxKind.EqualsEqualsToken:
            case ts.SyntaxKind.ExclamationEqualsToken:
            case ts.SyntaxKind.EqualsEqualsEqualsToken:
            case ts.SyntaxKind.ExclamationEqualsEqualsToken:
            case ts.SyntaxKind.AmpersandToken:
            case ts.SyntaxKind.CaretToken:
            case ts.SyntaxKind.BarToken:
            case ts.SyntaxKind.AmpersandAmpersandToken:
            case ts.SyntaxKind.BarBarToken:
            case ts.SyntaxKind.BarEqualsToken:
            case ts.SyntaxKind.AmpersandEqualsToken:
            case ts.SyntaxKind.CaretEqualsToken:
            case ts.SyntaxKind.LessThanLessThanEqualsToken:
            case ts.SyntaxKind.GreaterThanGreaterThanEqualsToken:
            case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken:
            case ts.SyntaxKind.PlusEqualsToken:
            case ts.SyntaxKind.MinusEqualsToken:
            case ts.SyntaxKind.AsteriskEqualsToken:
            case ts.SyntaxKind.SlashEqualsToken:
            case ts.SyntaxKind.PercentEqualsToken:
            case ts.SyntaxKind.EqualsToken:
            case ts.SyntaxKind.CommaToken:
                return true;
            default:
                return false;
        }
    }
    function isPrefixUnaryExpressionOperatorToken(token) {
        switch (token) {
            case ts.SyntaxKind.PlusToken:
            case ts.SyntaxKind.MinusToken:
            case ts.SyntaxKind.TildeToken:
            case ts.SyntaxKind.ExclamationToken:
            case ts.SyntaxKind.PlusPlusToken:
            case ts.SyntaxKind.MinusMinusToken:
                return true;
            default:
                return false;
        }
    }
    function classFromKind(token) {
        if (ts.isKeyword(token)) {
            return ts.ClassificationType.keyword;
        }
        else if (isBinaryExpressionOperatorToken(token) || isPrefixUnaryExpressionOperatorToken(token)) {
            return ts.ClassificationType.operator;
        }
        else if (token >= ts.SyntaxKind.FirstPunctuation && token <= ts.SyntaxKind.LastPunctuation) {
            return ts.ClassificationType.punctuation;
        }
        switch (token) {
            case ts.SyntaxKind.NumericLiteral:
                return ts.ClassificationType.numericLiteral;
            case ts.SyntaxKind.StringLiteral:
                return ts.ClassificationType.stringLiteral;
            case ts.SyntaxKind.RegularExpressionLiteral:
                return ts.ClassificationType.regularExpressionLiteral;
            case ts.SyntaxKind.ConflictMarkerTrivia:
            case ts.SyntaxKind.MultiLineCommentTrivia:
            case ts.SyntaxKind.SingleLineCommentTrivia:
                return ts.ClassificationType.comment;
            case ts.SyntaxKind.WhitespaceTrivia:
            case ts.SyntaxKind.NewLineTrivia:
                return ts.ClassificationType.whiteSpace;
            case ts.SyntaxKind.Identifier:
            default:
                if (ts.isTemplateLiteralKind(token)) {
                    return ts.ClassificationType.stringLiteral;
                }
                return ts.ClassificationType.identifier;
        }
    }
    /* @internal */
    function getSemanticClassifications(typeChecker, cancellationToken, sourceFile, classifiableNames, span) {
        return convertClassificationsToSpans(getEncodedSemanticClassifications(typeChecker, cancellationToken, sourceFile, classifiableNames, span));
    }
    ts.getSemanticClassifications = getSemanticClassifications;
    function checkForClassificationCancellation(cancellationToken, kind) {
        // We don't want to actually call back into our host on every node to find out if we've
        // been canceled.  That would be an enormous amount of chattyness, along with the all
        // the overhead of marshalling the data to/from the host.  So instead we pick a few
        // reasonable node kinds to bother checking on.  These node kinds represent high level
        // constructs that we would expect to see commonly, but just at a far less frequent
        // interval.
        //
        // For example, in checker.ts (around 750k) we only have around 600 of these constructs.
        // That means we're calling back into the host around every 1.2k of the file we process.
        // Lib.d.ts has similar numbers.
        switch (kind) {
            case ts.SyntaxKind.ModuleDeclaration:
            case ts.SyntaxKind.ClassDeclaration:
            case ts.SyntaxKind.InterfaceDeclaration:
            case ts.SyntaxKind.FunctionDeclaration:
                cancellationToken.throwIfCancellationRequested();
        }
    }
    /* @internal */
    function getEncodedSemanticClassifications(typeChecker, cancellationToken, sourceFile, classifiableNames, span) {
        const spans = [];
        sourceFile.forEachChild(function cb(node) {
            // Only walk into nodes that intersect the requested span.
            if (!node || !ts.textSpanIntersectsWith(span, node.pos, node.getFullWidth())) {
                return;
            }
            checkForClassificationCancellation(cancellationToken, node.kind);
            // Only bother calling into the typechecker if this is an identifier that
            // could possibly resolve to a type name.  This makes classification run
            // in a third of the time it would normally take.
            if (ts.isIdentifier(node) && !ts.nodeIsMissing(node) && classifiableNames.has(node.escapedText)) {
                const symbol = typeChecker.getSymbolAtLocation(node);
                const type = symbol && classifySymbol(symbol, ts.getMeaningFromLocation(node), typeChecker);
                if (type) {
                    pushClassification(node.getStart(sourceFile), node.getEnd(), type);
                }
            }
            node.forEachChild(cb);
        });
        return { spans, endOfLineState: ts.EndOfLineState.None };
        function pushClassification(start, end, type) {
            spans.push(start);
            spans.push(end - start);
            spans.push(type);
        }
    }
    ts.getEncodedSemanticClassifications = getEncodedSemanticClassifications;
    function classifySymbol(symbol, meaningAtPosition, checker) {
        const flags = symbol.getFlags();
        if ((flags & ts.SymbolFlags.Classifiable) === ts.SymbolFlags.None) {
            return undefined;
        }
        else if (flags & ts.SymbolFlags.Class) {
            return ts.ClassificationType.className;
        }
        else if (flags & ts.SymbolFlags.Enum) {
            return ts.ClassificationType.enumName;
        }
        else if (flags & ts.SymbolFlags.TypeAlias) {
            return ts.ClassificationType.typeAliasName;
        }
        else if (flags & ts.SymbolFlags.Module) {
            // Only classify a module as such if
            //  - It appears in a namespace context.
            //  - There exists a module declaration which actually impacts the value side.
            return meaningAtPosition & 4 /* Namespace */ || meaningAtPosition & 1 /* Value */ && hasValueSideModule(symbol) ? ts.ClassificationType.moduleName : undefined;
        }
        else if (flags & ts.SymbolFlags.Alias) {
            return classifySymbol(checker.getAliasedSymbol(symbol), meaningAtPosition, checker);
        }
        else if (meaningAtPosition & 2 /* Type */) {
            return flags & ts.SymbolFlags.Interface ? ts.ClassificationType.interfaceName : flags & ts.SymbolFlags.TypeParameter ? ts.ClassificationType.typeParameterName : undefined;
        }
        else {
            return undefined;
        }
    }
    /** Returns true if there exists a module that introduces entities on the value side. */
    function hasValueSideModule(symbol) {
        return ts.some(symbol.declarations, declaration => ts.isModuleDeclaration(declaration) && ts.getModuleInstanceState(declaration) === 1 /* Instantiated */);
    }
    function getClassificationTypeName(type) {
        switch (type) {
            case ts.ClassificationType.comment: return ts.ClassificationTypeNames.comment;
            case ts.ClassificationType.identifier: return ts.ClassificationTypeNames.identifier;
            case ts.ClassificationType.keyword: return ts.ClassificationTypeNames.keyword;
            case ts.ClassificationType.numericLiteral: return ts.ClassificationTypeNames.numericLiteral;
            case ts.ClassificationType.operator: return ts.ClassificationTypeNames.operator;
            case ts.ClassificationType.stringLiteral: return ts.ClassificationTypeNames.stringLiteral;
            case ts.ClassificationType.whiteSpace: return ts.ClassificationTypeNames.whiteSpace;
            case ts.ClassificationType.text: return ts.ClassificationTypeNames.text;
            case ts.ClassificationType.punctuation: return ts.ClassificationTypeNames.punctuation;
            case ts.ClassificationType.className: return ts.ClassificationTypeNames.className;
            case ts.ClassificationType.enumName: return ts.ClassificationTypeNames.enumName;
            case ts.ClassificationType.interfaceName: return ts.ClassificationTypeNames.interfaceName;
            case ts.ClassificationType.moduleName: return ts.ClassificationTypeNames.moduleName;
            case ts.ClassificationType.typeParameterName: return ts.ClassificationTypeNames.typeParameterName;
            case ts.ClassificationType.typeAliasName: return ts.ClassificationTypeNames.typeAliasName;
            case ts.ClassificationType.parameterName: return ts.ClassificationTypeNames.parameterName;
            case ts.ClassificationType.docCommentTagName: return ts.ClassificationTypeNames.docCommentTagName;
            case ts.ClassificationType.jsxOpenTagName: return ts.ClassificationTypeNames.jsxOpenTagName;
            case ts.ClassificationType.jsxCloseTagName: return ts.ClassificationTypeNames.jsxCloseTagName;
            case ts.ClassificationType.jsxSelfClosingTagName: return ts.ClassificationTypeNames.jsxSelfClosingTagName;
            case ts.ClassificationType.jsxAttribute: return ts.ClassificationTypeNames.jsxAttribute;
            case ts.ClassificationType.jsxText: return ts.ClassificationTypeNames.jsxText;
            case ts.ClassificationType.jsxAttributeStringLiteralValue: return ts.ClassificationTypeNames.jsxAttributeStringLiteralValue;
        }
    }
    function convertClassificationsToSpans(classifications) {
        ts.Debug.assert(classifications.spans.length % 3 === 0);
        const dense = classifications.spans;
        const result = [];
        for (let i = 0; i < dense.length; i += 3) {
            result.push({
                textSpan: ts.createTextSpan(dense[i], dense[i + 1]),
                classificationType: getClassificationTypeName(dense[i + 2])
            });
        }
        return result;
    }
    /* @internal */
    function getSyntacticClassifications(cancellationToken, sourceFile, span) {
        return convertClassificationsToSpans(getEncodedSyntacticClassifications(cancellationToken, sourceFile, span));
    }
    ts.getSyntacticClassifications = getSyntacticClassifications;
    /* @internal */
    function getEncodedSyntacticClassifications(cancellationToken, sourceFile, span) {
        const spanStart = span.start;
        const spanLength = span.length;
        // Make a scanner we can get trivia from.
        const triviaScanner = ts.createScanner(ts.ScriptTarget.Latest, /*skipTrivia*/ false, sourceFile.languageVariant, sourceFile.text);
        const mergeConflictScanner = ts.createScanner(ts.ScriptTarget.Latest, /*skipTrivia*/ false, sourceFile.languageVariant, sourceFile.text);
        const result = [];
        processElement(sourceFile);
        return { spans: result, endOfLineState: ts.EndOfLineState.None };
        function pushClassification(start, length, type) {
            result.push(start);
            result.push(length);
            result.push(type);
        }
        function classifyLeadingTriviaAndGetTokenStart(token) {
            triviaScanner.setTextPos(token.pos);
            while (true) {
                const start = triviaScanner.getTextPos();
                // only bother scanning if we have something that could be trivia.
                if (!ts.couldStartTrivia(sourceFile.text, start)) {
                    return start;
                }
                const kind = triviaScanner.scan();
                const end = triviaScanner.getTextPos();
                const width = end - start;
                // The moment we get something that isn't trivia, then stop processing.
                if (!ts.isTrivia(kind)) {
                    return start;
                }
                switch (kind) {
                    case ts.SyntaxKind.NewLineTrivia:
                    case ts.SyntaxKind.WhitespaceTrivia:
                        // Don't bother with newlines/whitespace.
                        continue;
                    case ts.SyntaxKind.SingleLineCommentTrivia:
                    case ts.SyntaxKind.MultiLineCommentTrivia:
                        // Only bother with the trivia if it at least intersects the span of interest.
                        classifyComment(token, kind, start, width);
                        // Classifying a comment might cause us to reuse the trivia scanner
                        // (because of jsdoc comments).  So after we classify the comment make
                        // sure we set the scanner position back to where it needs to be.
                        triviaScanner.setTextPos(end);
                        continue;
                    case ts.SyntaxKind.ConflictMarkerTrivia:
                        const text = sourceFile.text;
                        const ch = text.charCodeAt(start);
                        // for the <<<<<<< and >>>>>>> markers, we just add them in as comments
                        // in the classification stream.
                        if (ch === 60 /* lessThan */ || ch === 62 /* greaterThan */) {
                            pushClassification(start, width, ts.ClassificationType.comment);
                            continue;
                        }
                        // for the ||||||| and ======== markers, add a comment for the first line,
                        // and then lex all subsequent lines up until the end of the conflict marker.
                        ts.Debug.assert(ch === 124 /* bar */ || ch === 61 /* equals */);
                        classifyDisabledMergeCode(text, start, end);
                        break;
                    case ts.SyntaxKind.ShebangTrivia:
                        // TODO: Maybe we should classify these.
                        break;
                    default:
                        ts.Debug.assertNever(kind);
                }
            }
        }
        function classifyComment(token, kind, start, width) {
            if (kind === ts.SyntaxKind.MultiLineCommentTrivia) {
                // See if this is a doc comment.  If so, we'll classify certain portions of it
                // specially.
                const docCommentAndDiagnostics = ts.parseIsolatedJSDocComment(sourceFile.text, start, width);
                if (docCommentAndDiagnostics && docCommentAndDiagnostics.jsDoc) {
                    // TODO: This should be predicated on `token["kind"]` being compatible with `HasJSDoc["kind"]`
                    docCommentAndDiagnostics.jsDoc.parent = token;
                    classifyJSDocComment(docCommentAndDiagnostics.jsDoc);
                    return;
                }
            }
            // Simple comment.  Just add as is.
            pushCommentRange(start, width);
        }
        function pushCommentRange(start, width) {
            pushClassification(start, width, ts.ClassificationType.comment);
        }
        function classifyJSDocComment(docComment) {
            let pos = docComment.pos;
            if (docComment.tags) {
                for (const tag of docComment.tags) {
                    // As we walk through each tag, classify the portion of text from the end of
                    // the last tag (or the start of the entire doc comment) as 'comment'.
                    if (tag.pos !== pos) {
                        pushCommentRange(pos, tag.pos - pos);
                    }
                    pushClassification(tag.atToken.pos, tag.atToken.end - tag.atToken.pos, ts.ClassificationType.punctuation); // "@"
                    pushClassification(tag.tagName.pos, tag.tagName.end - tag.tagName.pos, ts.ClassificationType.docCommentTagName); // e.g. "param"
                    pos = tag.tagName.end;
                    switch (tag.kind) {
                        case ts.SyntaxKind.JSDocParameterTag:
                            processJSDocParameterTag(tag);
                            break;
                        case ts.SyntaxKind.JSDocTemplateTag:
                            processJSDocTemplateTag(tag);
                            break;
                        case ts.SyntaxKind.JSDocTypeTag:
                            processElement(tag.typeExpression);
                            break;
                        case ts.SyntaxKind.JSDocReturnTag:
                            processElement(tag.typeExpression);
                            break;
                    }
                    pos = tag.end;
                }
            }
            if (pos !== docComment.end) {
                pushCommentRange(pos, docComment.end - pos);
            }
            return;
            function processJSDocParameterTag(tag) {
                if (tag.isNameFirst) {
                    pushCommentRange(pos, tag.name.pos - pos);
                    pushClassification(tag.name.pos, tag.name.end - tag.name.pos, ts.ClassificationType.parameterName);
                    pos = tag.name.end;
                }
                if (tag.typeExpression) {
                    pushCommentRange(pos, tag.typeExpression.pos - pos);
                    processElement(tag.typeExpression);
                    pos = tag.typeExpression.end;
                }
                if (!tag.isNameFirst) {
                    pushCommentRange(pos, tag.name.pos - pos);
                    pushClassification(tag.name.pos, tag.name.end - tag.name.pos, ts.ClassificationType.parameterName);
                    pos = tag.name.end;
                }
            }
        }
        function processJSDocTemplateTag(tag) {
            for (const child of tag.getChildren()) {
                processElement(child);
            }
        }
        function classifyDisabledMergeCode(text, start, end) {
            // Classify the line that the ||||||| or ======= marker is on as a comment.
            // Then just lex all further tokens and add them to the result.
            let i;
            for (i = start; i < end; i++) {
                if (ts.isLineBreak(text.charCodeAt(i))) {
                    break;
                }
            }
            pushClassification(start, i - start, ts.ClassificationType.comment);
            mergeConflictScanner.setTextPos(i);
            while (mergeConflictScanner.getTextPos() < end) {
                classifyDisabledCodeToken();
            }
        }
        function classifyDisabledCodeToken() {
            const start = mergeConflictScanner.getTextPos();
            const tokenKind = mergeConflictScanner.scan();
            const end = mergeConflictScanner.getTextPos();
            const type = classifyTokenType(tokenKind);
            if (type) {
                pushClassification(start, end - start, type);
            }
        }
        /**
         * Returns true if node should be treated as classified and no further processing is required.
         * False will mean that node is not classified and traverse routine should recurse into node contents.
         */
        function tryClassifyNode(node) {
            if (ts.isJSDoc(node)) {
                return true;
            }
            if (ts.nodeIsMissing(node)) {
                return true;
            }
            const classifiedElementName = tryClassifyJsxElementName(node);
            if (!ts.isToken(node) && node.kind !== ts.SyntaxKind.JsxText && classifiedElementName === undefined) {
                return false;
            }
            const tokenStart = node.kind === ts.SyntaxKind.JsxText ? node.pos : classifyLeadingTriviaAndGetTokenStart(node);
            const tokenWidth = node.end - tokenStart;
            ts.Debug.assert(tokenWidth >= 0);
            if (tokenWidth > 0) {
                const type = classifiedElementName || classifyTokenType(node.kind, node);
                if (type) {
                    pushClassification(tokenStart, tokenWidth, type);
                }
            }
            return true;
        }
        function tryClassifyJsxElementName(token) {
            switch (token.parent && token.parent.kind) {
                case ts.SyntaxKind.JsxOpeningElement:
                    if (token.parent.tagName === token) {
                        return ts.ClassificationType.jsxOpenTagName;
                    }
                    break;
                case ts.SyntaxKind.JsxClosingElement:
                    if (token.parent.tagName === token) {
                        return ts.ClassificationType.jsxCloseTagName;
                    }
                    break;
                case ts.SyntaxKind.JsxSelfClosingElement:
                    if (token.parent.tagName === token) {
                        return ts.ClassificationType.jsxSelfClosingTagName;
                    }
                    break;
                case ts.SyntaxKind.JsxAttribute:
                    if (token.parent.name === token) {
                        return ts.ClassificationType.jsxAttribute;
                    }
                    break;
            }
            return undefined;
        }
        // for accurate classification, the actual token should be passed in.  however, for
        // cases like 'disabled merge code' classification, we just get the token kind and
        // classify based on that instead.
        function classifyTokenType(tokenKind, token) {
            if (ts.isKeyword(tokenKind)) {
                return ts.ClassificationType.keyword;
            }
            // Special case `<` and `>`: If they appear in a generic context they are punctuation,
            // not operators.
            if (tokenKind === ts.SyntaxKind.LessThanToken || tokenKind === ts.SyntaxKind.GreaterThanToken) {
                // If the node owning the token has a type argument list or type parameter list, then
                // we can effectively assume that a '<' and '>' belong to those lists.
                if (token && ts.getTypeArgumentOrTypeParameterList(token.parent)) {
                    return ts.ClassificationType.punctuation;
                }
            }
            if (ts.isPunctuation(tokenKind)) {
                if (token) {
                    if (tokenKind === ts.SyntaxKind.EqualsToken) {
                        // the '=' in a variable declaration is special cased here.
                        if (token.parent.kind === ts.SyntaxKind.VariableDeclaration ||
                            token.parent.kind === ts.SyntaxKind.PropertyDeclaration ||
                            token.parent.kind === ts.SyntaxKind.Parameter ||
                            token.parent.kind === ts.SyntaxKind.JsxAttribute) {
                            return ts.ClassificationType.operator;
                        }
                    }
                    if (token.parent.kind === ts.SyntaxKind.BinaryExpression ||
                        token.parent.kind === ts.SyntaxKind.PrefixUnaryExpression ||
                        token.parent.kind === ts.SyntaxKind.PostfixUnaryExpression ||
                        token.parent.kind === ts.SyntaxKind.ConditionalExpression) {
                        return ts.ClassificationType.operator;
                    }
                }
                return ts.ClassificationType.punctuation;
            }
            else if (tokenKind === ts.SyntaxKind.NumericLiteral) {
                return ts.ClassificationType.numericLiteral;
            }
            else if (tokenKind === ts.SyntaxKind.StringLiteral) {
                return token.parent.kind === ts.SyntaxKind.JsxAttribute ? ts.ClassificationType.jsxAttributeStringLiteralValue : ts.ClassificationType.stringLiteral;
            }
            else if (tokenKind === ts.SyntaxKind.RegularExpressionLiteral) {
                // TODO: we should get another classification type for these literals.
                return ts.ClassificationType.stringLiteral;
            }
            else if (ts.isTemplateLiteralKind(tokenKind)) {
                // TODO (drosen): we should *also* get another classification type for these literals.
                return ts.ClassificationType.stringLiteral;
            }
            else if (tokenKind === ts.SyntaxKind.JsxText) {
                return ts.ClassificationType.jsxText;
            }
            else if (tokenKind === ts.SyntaxKind.Identifier) {
                if (token) {
                    switch (token.parent.kind) {
                        case ts.SyntaxKind.ClassDeclaration:
                            if (token.parent.name === token) {
                                return ts.ClassificationType.className;
                            }
                            return;
                        case ts.SyntaxKind.TypeParameter:
                            if (token.parent.name === token) {
                                return ts.ClassificationType.typeParameterName;
                            }
                            return;
                        case ts.SyntaxKind.InterfaceDeclaration:
                            if (token.parent.name === token) {
                                return ts.ClassificationType.interfaceName;
                            }
                            return;
                        case ts.SyntaxKind.EnumDeclaration:
                            if (token.parent.name === token) {
                                return ts.ClassificationType.enumName;
                            }
                            return;
                        case ts.SyntaxKind.ModuleDeclaration:
                            if (token.parent.name === token) {
                                return ts.ClassificationType.moduleName;
                            }
                            return;
                        case ts.SyntaxKind.Parameter:
                            if (token.parent.name === token) {
                                return ts.isThisIdentifier(token) ? ts.ClassificationType.keyword : ts.ClassificationType.parameterName;
                            }
                            return;
                    }
                }
                return ts.ClassificationType.identifier;
            }
        }
        function processElement(element) {
            if (!element) {
                return;
            }
            // Ignore nodes that don't intersect the original span to classify.
            if (ts.decodedTextSpanIntersectsWith(spanStart, spanLength, element.pos, element.getFullWidth())) {
                checkForClassificationCancellation(cancellationToken, element.kind);
                for (const child of element.getChildren(sourceFile)) {
                    if (!tryClassifyNode(child)) {
                        // Recurse into our child nodes.
                        processElement(child);
                    }
                }
            }
        }
    }
    ts.getEncodedSyntacticClassifications = getEncodedSyntacticClassifications;
})(ts || (ts = {}));
