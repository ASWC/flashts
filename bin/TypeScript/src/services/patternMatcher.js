/* @internal */
var ts;
(function (ts) {
    // Note(cyrusn): this enum is ordered from strongest match type to weakest match type.
    let PatternMatchKind;
    (function (PatternMatchKind) {
        PatternMatchKind[PatternMatchKind["exact"] = 0] = "exact";
        PatternMatchKind[PatternMatchKind["prefix"] = 1] = "prefix";
        PatternMatchKind[PatternMatchKind["substring"] = 2] = "substring";
        PatternMatchKind[PatternMatchKind["camelCase"] = 3] = "camelCase";
    })(PatternMatchKind = ts.PatternMatchKind || (ts.PatternMatchKind = {}));
    function createPatternMatch(kind, isCaseSensitive) {
        return {
            kind,
            isCaseSensitive
        };
    }
    function createPatternMatcher(pattern) {
        // We'll often see the same candidate string many times when searching (For example, when
        // we see the name of a module that is used everywhere, or the name of an overload).  As
        // such, we cache the information we compute about the candidate for the life of this
        // pattern matcher so we don't have to compute it multiple times.
        const stringToWordSpans = ts.createMap();
        const dotSeparatedSegments = pattern.trim().split(".").map(p => createSegment(p.trim()));
        // A segment is considered invalid if we couldn't find any words in it.
        if (dotSeparatedSegments.some(segment => !segment.subWordTextChunks.length))
            return undefined;
        return {
            getFullMatch: (containers, candidate) => getFullMatch(containers, candidate, dotSeparatedSegments, stringToWordSpans),
            getMatchForLastSegmentOfPattern: candidate => matchSegment(candidate, ts.last(dotSeparatedSegments), stringToWordSpans),
            patternContainsDots: dotSeparatedSegments.length > 1
        };
    }
    ts.createPatternMatcher = createPatternMatcher;
    function getFullMatch(candidateContainers, candidate, dotSeparatedSegments, stringToWordSpans) {
        // First, check that the last part of the dot separated pattern matches the name of the
        // candidate.  If not, then there's no point in proceeding and doing the more
        // expensive work.
        const candidateMatch = matchSegment(candidate, ts.lastOrUndefined(dotSeparatedSegments), stringToWordSpans);
        if (!candidateMatch) {
            return undefined;
        }
        candidateContainers = candidateContainers || [];
        // -1 because the last part was checked against the name, and only the rest
        // of the parts are checked against the container.
        if (dotSeparatedSegments.length - 1 > candidateContainers.length) {
            // There weren't enough container parts to match against the pattern parts.
            // So this definitely doesn't match.
            return undefined;
        }
        let bestMatch;
        for (let i = dotSeparatedSegments.length - 2, j = candidateContainers.length - 1; i >= 0; i -= 1, j -= 1) {
            bestMatch = betterMatch(bestMatch, matchSegment(candidateContainers[j], dotSeparatedSegments[i], stringToWordSpans));
        }
        return bestMatch;
    }
    function getWordSpans(word, stringToWordSpans) {
        let spans = stringToWordSpans.get(word);
        if (!spans) {
            stringToWordSpans.set(word, spans = breakIntoWordSpans(word));
        }
        return spans;
    }
    function matchTextChunk(candidate, chunk, stringToWordSpans) {
        const index = indexOfIgnoringCase(candidate, chunk.textLowerCase);
        if (index === 0) {
            // a) Check if the word is a prefix of the candidate, in a case insensitive or
            //    sensitive manner. If it does, return that there was an exact match if the word and candidate are the same length, else a prefix match.
            return createPatternMatch(chunk.text.length === candidate.length ? PatternMatchKind.exact : PatternMatchKind.prefix, /*isCaseSensitive:*/ ts.startsWith(candidate, chunk.text));
        }
        if (chunk.isLowerCase) {
            if (index === -1)
                return undefined;
            // b) If the part is entirely lowercase, then check if it is contained anywhere in the
            //    candidate in a case insensitive manner.  If so, return that there was a substring
            //    match.
            //
            //    Note: We only have a substring match if the lowercase part is prefix match of some
            //    word part. That way we don't match something like 'Class' when the user types 'a'.
            //    But we would match 'FooAttribute' (since 'Attribute' starts with 'a').
            const wordSpans = getWordSpans(candidate, stringToWordSpans);
            for (const span of wordSpans) {
                if (partStartsWith(candidate, span, chunk.text, /*ignoreCase:*/ true)) {
                    return createPatternMatch(PatternMatchKind.substring, /*isCaseSensitive:*/ partStartsWith(candidate, span, chunk.text, /*ignoreCase:*/ false));
                }
            }
            // c) Is the pattern a substring of the candidate starting on one of the candidate's word boundaries?
            // We could check every character boundary start of the candidate for the pattern. However, that's
            // an m * n operation in the wost case. Instead, find the first instance of the pattern
            // substring, and see if it starts on a capital letter. It seems unlikely that the user will try to
            // filter the list based on a substring that starts on a capital letter and also with a lowercase one.
            // (Pattern: fogbar, Candidate: quuxfogbarFogBar).
            if (chunk.text.length < candidate.length && isUpperCaseLetter(candidate.charCodeAt(index))) {
                return createPatternMatch(PatternMatchKind.substring, /*isCaseSensitive:*/ false);
            }
        }
        else {
            // d) If the part was not entirely lowercase, then check if it is contained in the
            //    candidate in a case *sensitive* manner. If so, return that there was a substring
            //    match.
            if (candidate.indexOf(chunk.text) > 0) {
                return createPatternMatch(PatternMatchKind.substring, /*isCaseSensitive:*/ true);
            }
            // e) If the part was not entirely lowercase, then attempt a camel cased match as well.
            if (chunk.characterSpans.length > 0) {
                const candidateParts = getWordSpans(candidate, stringToWordSpans);
                const isCaseSensitive = tryCamelCaseMatch(candidate, candidateParts, chunk, /*ignoreCase:*/ false) ? true
                    : tryCamelCaseMatch(candidate, candidateParts, chunk, /*ignoreCase:*/ true) ? false : undefined;
                if (isCaseSensitive !== undefined) {
                    return createPatternMatch(PatternMatchKind.camelCase, isCaseSensitive);
                }
            }
        }
    }
    function matchSegment(candidate, segment, stringToWordSpans) {
        // First check if the segment matches as is.  This is also useful if the segment contains
        // characters we would normally strip when splitting into parts that we also may want to
        // match in the candidate.  For example if the segment is "@int" and the candidate is
        // "@int", then that will show up as an exact match here.
        //
        // Note: if the segment contains a space or an asterisk then we must assume that it's a
        // multi-word segment.
        if (every(segment.totalTextChunk.text, ch => ch !== 32 /* space */ && ch !== 42 /* asterisk */)) {
            const match = matchTextChunk(candidate, segment.totalTextChunk, stringToWordSpans);
            if (match)
                return match;
        }
        // The logic for pattern matching is now as follows:
        //
        // 1) Break the segment passed in into words.  Breaking is rather simple and a
        //    good way to think about it that if gives you all the individual alphanumeric words
        //    of the pattern.
        //
        // 2) For each word try to match the word against the candidate value.
        //
        // 3) Matching is as follows:
        //
        //   a) Check if the word is a prefix of the candidate, in a case insensitive or
        //      sensitive manner. If it does, return that there was an exact match if the word and candidate are the same length, else a prefix match.
        //
        //   If the word is entirely lowercase:
        //      b) Then check if it is contained anywhere in the
        //          candidate in a case insensitive manner.  If so, return that there was a substring
        //          match.
        //
        //          Note: We only have a substring match if the lowercase part is prefix match of
        //          some word part. That way we don't match something like 'Class' when the user
        //          types 'a'. But we would match 'FooAttribute' (since 'Attribute' starts with
        //          'a').
        //
        //       c) The word is all lower case. Is it a case insensitive substring of the candidate starting
        //          on a part boundary of the candidate?
        //
        //   Else:
        //       d) If the word was not entirely lowercase, then check if it is contained in the
        //          candidate in a case *sensitive* manner. If so, return that there was a substring
        //          match.
        //
        //       e) If the word was not entirely lowercase, then attempt a camel cased match as
        //          well.
        //
        // Only if all words have some sort of match is the pattern considered matched.
        const subWordTextChunks = segment.subWordTextChunks;
        let bestMatch;
        for (const subWordTextChunk of subWordTextChunks) {
            bestMatch = betterMatch(bestMatch, matchTextChunk(candidate, subWordTextChunk, stringToWordSpans));
        }
        return bestMatch;
    }
    function betterMatch(a, b) {
        return ts.min(a, b, compareMatches);
    }
    function compareMatches(a, b) {
        return a === undefined ? 1 /* GreaterThan */ : b === undefined ? -1 /* LessThan */
            : ts.compareValues(a.kind, b.kind) || ts.compareBooleans(!a.isCaseSensitive, !b.isCaseSensitive);
    }
    function partStartsWith(candidate, candidateSpan, pattern, ignoreCase, patternSpan = { start: 0, length: pattern.length }) {
        return patternSpan.length <= candidateSpan.length // If pattern part is longer than the candidate part there can never be a match.
            && everyInRange(0, patternSpan.length, i => equalChars(pattern.charCodeAt(patternSpan.start + i), candidate.charCodeAt(candidateSpan.start + i), ignoreCase));
    }
    function equalChars(ch1, ch2, ignoreCase) {
        return ignoreCase ? toLowerCase(ch1) === toLowerCase(ch2) : ch1 === ch2;
    }
    function tryCamelCaseMatch(candidate, candidateParts, chunk, ignoreCase) {
        const chunkCharacterSpans = chunk.characterSpans;
        // Note: we may have more pattern parts than candidate parts.  This is because multiple
        // pattern parts may match a candidate part.  For example "SiUI" against "SimpleUI".
        // We'll have 3 pattern parts Si/U/I against two candidate parts Simple/UI.  However, U
        // and I will both match in UI.
        let currentCandidate = 0;
        let currentChunkSpan = 0;
        let firstMatch;
        let contiguous;
        while (true) {
            // Let's consider our termination cases
            if (currentChunkSpan === chunkCharacterSpans.length) {
                return true;
            }
            else if (currentCandidate === candidateParts.length) {
                // No match, since we still have more of the pattern to hit
                return false;
            }
            let candidatePart = candidateParts[currentCandidate];
            let gotOneMatchThisCandidate = false;
            // Consider the case of matching SiUI against SimpleUIElement. The candidate parts
            // will be Simple/UI/Element, and the pattern parts will be Si/U/I.  We'll match 'Si'
            // against 'Simple' first.  Then we'll match 'U' against 'UI'. However, we want to
            // still keep matching pattern parts against that candidate part.
            for (; currentChunkSpan < chunkCharacterSpans.length; currentChunkSpan++) {
                const chunkCharacterSpan = chunkCharacterSpans[currentChunkSpan];
                if (gotOneMatchThisCandidate) {
                    // We've already gotten one pattern part match in this candidate.  We will
                    // only continue trying to consumer pattern parts if the last part and this
                    // part are both upper case.
                    if (!isUpperCaseLetter(chunk.text.charCodeAt(chunkCharacterSpans[currentChunkSpan - 1].start)) ||
                        !isUpperCaseLetter(chunk.text.charCodeAt(chunkCharacterSpans[currentChunkSpan].start))) {
                        break;
                    }
                }
                if (!partStartsWith(candidate, candidatePart, chunk.text, ignoreCase, chunkCharacterSpan)) {
                    break;
                }
                gotOneMatchThisCandidate = true;
                firstMatch = firstMatch === undefined ? currentCandidate : firstMatch;
                // If we were contiguous, then keep that value.  If we weren't, then keep that
                // value.  If we don't know, then set the value to 'true' as an initial match is
                // obviously contiguous.
                contiguous = contiguous === undefined ? true : contiguous;
                candidatePart = ts.createTextSpan(candidatePart.start + chunkCharacterSpan.length, candidatePart.length - chunkCharacterSpan.length);
            }
            // Check if we matched anything at all.  If we didn't, then we need to unset the
            // contiguous bit if we currently had it set.
            // If we haven't set the bit yet, then that means we haven't matched anything so
            // far, and we don't want to change that.
            if (!gotOneMatchThisCandidate && contiguous !== undefined) {
                contiguous = false;
            }
            // Move onto the next candidate.
            currentCandidate++;
        }
    }
    function createSegment(text) {
        return {
            totalTextChunk: createTextChunk(text),
            subWordTextChunks: breakPatternIntoTextChunks(text)
        };
    }
    function isUpperCaseLetter(ch) {
        // Fast check for the ascii range.
        if (ch >= 65 /* A */ && ch <= 90 /* Z */) {
            return true;
        }
        if (ch < 127 /* maxAsciiCharacter */ || !ts.isUnicodeIdentifierStart(ch, ts.ScriptTarget.Latest)) {
            return false;
        }
        // TODO: find a way to determine this for any unicode characters in a
        // non-allocating manner.
        const str = String.fromCharCode(ch);
        return str === str.toUpperCase();
    }
    function isLowerCaseLetter(ch) {
        // Fast check for the ascii range.
        if (ch >= 97 /* a */ && ch <= 122 /* z */) {
            return true;
        }
        if (ch < 127 /* maxAsciiCharacter */ || !ts.isUnicodeIdentifierStart(ch, ts.ScriptTarget.Latest)) {
            return false;
        }
        // TODO: find a way to determine this for any unicode characters in a
        // non-allocating manner.
        const str = String.fromCharCode(ch);
        return str === str.toLowerCase();
    }
    // Assumes 'value' is already lowercase.
    function indexOfIgnoringCase(str, value) {
        const n = str.length - value.length;
        for (let start = 0; start <= n; start++) {
            if (every(value, (valueChar, i) => toLowerCase(str.charCodeAt(i + start)) === valueChar)) {
                return start;
            }
        }
        return -1;
    }
    function toLowerCase(ch) {
        // Fast convert for the ascii range.
        if (ch >= 65 /* A */ && ch <= 90 /* Z */) {
            return 97 /* a */ + (ch - 65 /* A */);
        }
        if (ch < 127 /* maxAsciiCharacter */) {
            return ch;
        }
        // TODO: find a way to compute this for any unicode characters in a
        // non-allocating manner.
        return String.fromCharCode(ch).toLowerCase().charCodeAt(0);
    }
    function isDigit(ch) {
        // TODO(cyrusn): Find a way to support this for unicode digits.
        return ch >= 48 /* _0 */ && ch <= 57 /* _9 */;
    }
    function isWordChar(ch) {
        return isUpperCaseLetter(ch) || isLowerCaseLetter(ch) || isDigit(ch) || ch === 95 /* _ */ || ch === 36 /* $ */;
    }
    function breakPatternIntoTextChunks(pattern) {
        const result = [];
        let wordStart = 0;
        let wordLength = 0;
        for (let i = 0; i < pattern.length; i++) {
            const ch = pattern.charCodeAt(i);
            if (isWordChar(ch)) {
                if (wordLength === 0) {
                    wordStart = i;
                }
                wordLength++;
            }
            else {
                if (wordLength > 0) {
                    result.push(createTextChunk(pattern.substr(wordStart, wordLength)));
                    wordLength = 0;
                }
            }
        }
        if (wordLength > 0) {
            result.push(createTextChunk(pattern.substr(wordStart, wordLength)));
        }
        return result;
    }
    function createTextChunk(text) {
        const textLowerCase = text.toLowerCase();
        return {
            text,
            textLowerCase,
            isLowerCase: text === textLowerCase,
            characterSpans: breakIntoCharacterSpans(text)
        };
    }
    /* @internal */ function breakIntoCharacterSpans(identifier) {
        return breakIntoSpans(identifier, /*word:*/ false);
    }
    ts.breakIntoCharacterSpans = breakIntoCharacterSpans;
    /* @internal */ function breakIntoWordSpans(identifier) {
        return breakIntoSpans(identifier, /*word:*/ true);
    }
    ts.breakIntoWordSpans = breakIntoWordSpans;
    function breakIntoSpans(identifier, word) {
        const result = [];
        let wordStart = 0;
        for (let i = 1; i < identifier.length; i++) {
            const lastIsDigit = isDigit(identifier.charCodeAt(i - 1));
            const currentIsDigit = isDigit(identifier.charCodeAt(i));
            const hasTransitionFromLowerToUpper = transitionFromLowerToUpper(identifier, word, i);
            const hasTransitionFromUpperToLower = word && transitionFromUpperToLower(identifier, i, wordStart);
            if (charIsPunctuation(identifier.charCodeAt(i - 1)) ||
                charIsPunctuation(identifier.charCodeAt(i)) ||
                lastIsDigit !== currentIsDigit ||
                hasTransitionFromLowerToUpper ||
                hasTransitionFromUpperToLower) {
                if (!isAllPunctuation(identifier, wordStart, i)) {
                    result.push(ts.createTextSpan(wordStart, i - wordStart));
                }
                wordStart = i;
            }
        }
        if (!isAllPunctuation(identifier, wordStart, identifier.length)) {
            result.push(ts.createTextSpan(wordStart, identifier.length - wordStart));
        }
        return result;
    }
    function charIsPunctuation(ch) {
        switch (ch) {
            case 33 /* exclamation */:
            case 34 /* doubleQuote */:
            case 35 /* hash */:
            case 37 /* percent */:
            case 38 /* ampersand */:
            case 39 /* singleQuote */:
            case 40 /* openParen */:
            case 41 /* closeParen */:
            case 42 /* asterisk */:
            case 44 /* comma */:
            case 45 /* minus */:
            case 46 /* dot */:
            case 47 /* slash */:
            case 58 /* colon */:
            case 59 /* semicolon */:
            case 63 /* question */:
            case 64 /* at */:
            case 91 /* openBracket */:
            case 92 /* backslash */:
            case 93 /* closeBracket */:
            case 95 /* _ */:
            case 123 /* openBrace */:
            case 125 /* closeBrace */:
                return true;
        }
        return false;
    }
    function isAllPunctuation(identifier, start, end) {
        return every(identifier, ch => charIsPunctuation(ch) && ch !== 95 /* _ */, start, end);
    }
    function transitionFromUpperToLower(identifier, index, wordStart) {
        // Cases this supports:
        // 1) IDisposable -> I, Disposable
        // 2) UIElement -> UI, Element
        // 3) HTMLDocument -> HTML, Document
        //
        // etc.
        // We have a transition from an upper to a lower letter here.  But we only
        // want to break if all the letters that preceded are uppercase.  i.e. if we
        // have "Foo" we don't want to break that into "F, oo".  But if we have
        // "IFoo" or "UIFoo", then we want to break that into "I, Foo" and "UI,
        // Foo".  i.e. the last uppercase letter belongs to the lowercase letters
        // that follows.  Note: this will make the following not split properly:
        // "HELLOthere".  However, these sorts of names do not show up in .Net
        // programs.
        return index !== wordStart
            && index + 1 < identifier.length
            && isUpperCaseLetter(identifier.charCodeAt(index))
            && isLowerCaseLetter(identifier.charCodeAt(index + 1))
            && every(identifier, isUpperCaseLetter, wordStart, index);
    }
    function transitionFromLowerToUpper(identifier, word, index) {
        const lastIsUpper = isUpperCaseLetter(identifier.charCodeAt(index - 1));
        const currentIsUpper = isUpperCaseLetter(identifier.charCodeAt(index));
        // See if the casing indicates we're starting a new word. Note: if we're breaking on
        // words, then just seeing an upper case character isn't enough.  Instead, it has to
        // be uppercase and the previous character can't be uppercase.
        //
        // For example, breaking "AddMetadata" on words would make: Add Metadata
        //
        // on characters would be: A dd M etadata
        //
        // Break "AM" on words would be: AM
        //
        // on characters would be: A M
        //
        // We break the search string on characters.  But we break the symbol name on words.
        return currentIsUpper && (!word || !lastIsUpper);
    }
    function everyInRange(start, end, pred) {
        for (let i = start; i < end; i++) {
            if (!pred(i)) {
                return false;
            }
        }
        return true;
    }
    function every(s, pred, start = 0, end = s.length) {
        return everyInRange(start, end, i => pred(s.charCodeAt(i), i));
    }
})(ts || (ts = {}));
