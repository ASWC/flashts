/* @internal */
var ts;
(function (ts) {
    var sourcemaps;
    (function (sourcemaps) {
        sourcemaps.identitySourceMapper = { getOriginalPosition: ts.identity, getGeneratedPosition: ts.identity };
        function decode(host, mapPath, map, program, fallbackCache = ts.createSourceFileLikeCache(host)) {
            const currentDirectory = ts.getDirectoryPath(mapPath);
            const sourceRoot = map.sourceRoot || currentDirectory;
            let decodedMappings;
            let generatedOrderedMappings;
            let sourceOrderedMappings;
            return {
                getOriginalPosition,
                getGeneratedPosition
            };
            function getGeneratedPosition(loc) {
                const maps = getGeneratedOrderedMappings();
                if (!ts.length(maps))
                    return loc;
                let targetIndex = ts.binarySearch(maps, { sourcePath: loc.fileName, sourcePosition: loc.position }, ts.identity, compareProcessedPositionSourcePositions);
                if (targetIndex < 0 && maps.length > 0) {
                    // if no exact match, closest is 2's compliment of result
                    targetIndex = ~targetIndex;
                }
                if (!maps[targetIndex] || ts.comparePaths(loc.fileName, maps[targetIndex].sourcePath, sourceRoot) !== 0) {
                    return loc;
                }
                return { fileName: ts.toPath(map.file, sourceRoot, host.getCanonicalFileName), position: maps[targetIndex].emittedPosition }; // Closest pos
            }
            function getOriginalPosition(loc) {
                const maps = getSourceOrderedMappings();
                if (!ts.length(maps))
                    return loc;
                let targetIndex = ts.binarySearch(maps, { emittedPosition: loc.position }, ts.identity, compareProcessedPositionEmittedPositions);
                if (targetIndex < 0 && maps.length > 0) {
                    // if no exact match, closest is 2's compliment of result
                    targetIndex = ~targetIndex;
                }
                return { fileName: ts.toPath(maps[targetIndex].sourcePath, sourceRoot, host.getCanonicalFileName), position: maps[targetIndex].sourcePosition }; // Closest pos
            }
            function getSourceFileLike(fileName, location) {
                // Lookup file in program, if provided
                const file = program && program.getSourceFile(fileName);
                if (!file) {
                    // Otherwise check the cache (which may hit disk)
                    const path = ts.toPath(fileName, location, host.getCanonicalFileName);
                    return fallbackCache.get(path);
                }
                return file;
            }
            function getPositionOfLineAndCharacterUsingName(fileName, directory, line, character) {
                const file = getSourceFileLike(fileName, directory);
                if (!file) {
                    return -1;
                }
                return ts.getPositionOfLineAndCharacter(file, line, character);
            }
            function getDecodedMappings() {
                return decodedMappings || (decodedMappings = calculateDecodedMappings());
            }
            function getSourceOrderedMappings() {
                return sourceOrderedMappings || (sourceOrderedMappings = getDecodedMappings().slice().sort(compareProcessedPositionSourcePositions));
            }
            function getGeneratedOrderedMappings() {
                return generatedOrderedMappings || (generatedOrderedMappings = getDecodedMappings().slice().sort(compareProcessedPositionEmittedPositions));
            }
            function calculateDecodedMappings() {
                const state = {
                    encodedText: map.mappings,
                    currentNameIndex: undefined,
                    sourceMapNamesLength: map.names ? map.names.length : undefined,
                    currentEmittedColumn: 0,
                    currentEmittedLine: 0,
                    currentSourceColumn: 0,
                    currentSourceLine: 0,
                    currentSourceIndex: 0,
                    positions: [],
                    decodingIndex: 0,
                    processPosition,
                };
                while (!hasCompletedDecoding(state)) {
                    decodeSinglePosition(state);
                    if (state.error) {
                        host.log(`Encountered error while decoding sourcemap found at ${mapPath}: ${state.error}`);
                        return [];
                    }
                }
                return state.positions;
            }
            function compareProcessedPositionSourcePositions(a, b) {
                return ts.comparePaths(a.sourcePath, b.sourcePath, sourceRoot) ||
                    ts.compareValues(a.sourcePosition, b.sourcePosition);
            }
            function compareProcessedPositionEmittedPositions(a, b) {
                return ts.compareValues(a.emittedPosition, b.emittedPosition);
            }
            function processPosition(position) {
                const sourcePath = map.sources[position.sourceIndex];
                return {
                    emittedPosition: getPositionOfLineAndCharacterUsingName(map.file, currentDirectory, position.emittedLine, position.emittedColumn),
                    sourcePosition: getPositionOfLineAndCharacterUsingName(sourcePath, sourceRoot, position.sourceLine, position.sourceColumn),
                    sourcePath,
                };
            }
        }
        sourcemaps.decode = decode;
        function hasCompletedDecoding(state) {
            return state.decodingIndex === state.encodedText.length;
        }
        function decodeSinglePosition(state) {
            while (state.decodingIndex < state.encodedText.length) {
                const char = state.encodedText.charCodeAt(state.decodingIndex);
                if (char === 59 /* semicolon */) {
                    // New line
                    state.currentEmittedLine++;
                    state.currentEmittedColumn = 0;
                    state.decodingIndex++;
                    continue;
                }
                if (char === 44 /* comma */) {
                    // Next entry is on same line - no action needed
                    state.decodingIndex++;
                    continue;
                }
                // Read the current position
                // 1. Column offset from prev read jsColumn
                state.currentEmittedColumn += base64VLQFormatDecode();
                // Incorrect emittedColumn dont support this map
                if (createErrorIfCondition(state.currentEmittedColumn < 0, "Invalid emittedColumn found")) {
                    return;
                }
                // Dont support reading mappings that dont have information about original source and its line numbers
                if (createErrorIfCondition(isSourceMappingSegmentEnd(state.encodedText, state.decodingIndex), "Unsupported Error Format: No entries after emitted column")) {
                    return;
                }
                // 2. Relative sourceIndex
                state.currentSourceIndex += base64VLQFormatDecode();
                // Incorrect sourceIndex dont support this map
                if (createErrorIfCondition(state.currentSourceIndex < 0, "Invalid sourceIndex found")) {
                    return;
                }
                // Dont support reading mappings that dont have information about original source position
                if (createErrorIfCondition(isSourceMappingSegmentEnd(state.encodedText, state.decodingIndex), "Unsupported Error Format: No entries after sourceIndex")) {
                    return;
                }
                // 3. Relative sourceLine 0 based
                state.currentSourceLine += base64VLQFormatDecode();
                // Incorrect sourceLine dont support this map
                if (createErrorIfCondition(state.currentSourceLine < 0, "Invalid sourceLine found")) {
                    return;
                }
                // Dont support reading mappings that dont have information about original source and its line numbers
                if (createErrorIfCondition(isSourceMappingSegmentEnd(state.encodedText, state.decodingIndex), "Unsupported Error Format: No entries after emitted Line")) {
                    return;
                }
                // 4. Relative sourceColumn 0 based
                state.currentSourceColumn += base64VLQFormatDecode();
                // Incorrect sourceColumn dont support this map
                if (createErrorIfCondition(state.currentSourceColumn < 0, "Invalid sourceLine found")) {
                    return;
                }
                // 5. Check if there is name:
                if (!isSourceMappingSegmentEnd(state.encodedText, state.decodingIndex)) {
                    if (state.currentNameIndex === undefined) {
                        state.currentNameIndex = 0;
                    }
                    state.currentNameIndex += base64VLQFormatDecode();
                    // Incorrect nameIndex dont support this map
                    // TODO: If we start using `name`s, issue errors when they aren't correct in the sourcemap
                    // if (createErrorIfCondition(state.currentNameIndex < 0 || state.currentNameIndex >= state.sourceMapNamesLength, "Invalid name index for the source map entry")) {
                    //    return;
                    // }
                }
                // Dont support reading mappings that dont have information about original source and its line numbers
                if (createErrorIfCondition(!isSourceMappingSegmentEnd(state.encodedText, state.decodingIndex), "Unsupported Error Format: There are more entries after " + (state.currentNameIndex === undefined ? "sourceColumn" : "nameIndex"))) {
                    return;
                }
                // Entry should be complete
                capturePosition();
                return;
            }
            createErrorIfCondition(/*condition*/ true, "No encoded entry found");
            return;
            function capturePosition() {
                state.positions.push(state.processPosition({
                    emittedColumn: state.currentEmittedColumn,
                    emittedLine: state.currentEmittedLine,
                    sourceColumn: state.currentSourceColumn,
                    sourceIndex: state.currentSourceIndex,
                    sourceLine: state.currentSourceLine,
                    nameIndex: state.currentNameIndex
                }));
            }
            function createErrorIfCondition(condition, errormsg) {
                if (state.error) {
                    // An error was already reported
                    return true;
                }
                if (condition) {
                    state.error = errormsg;
                }
                return condition;
            }
            function base64VLQFormatDecode() {
                let moreDigits = true;
                let shiftCount = 0;
                let value = 0;
                for (; moreDigits; state.decodingIndex++) {
                    if (createErrorIfCondition(state.decodingIndex >= state.encodedText.length, "Error in decoding base64VLQFormatDecode, past the mapping string")) {
                        return;
                    }
                    // 6 digit number
                    const currentByte = base64FormatDecode(state.encodedText.charAt(state.decodingIndex));
                    // If msb is set, we still have more bits to continue
                    moreDigits = (currentByte & 32) !== 0;
                    // least significant 5 bits are the next msbs in the final value.
                    value = value | ((currentByte & 31) << shiftCount);
                    shiftCount += 5;
                }
                // Least significant bit if 1 represents negative and rest of the msb is actual absolute value
                if ((value & 1) === 0) {
                    // + number
                    value = value >> 1;
                }
                else {
                    // - number
                    value = value >> 1;
                    value = -value;
                }
                return value;
            }
        }
        function base64FormatDecode(char) {
            return "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".indexOf(char);
        }
        function isSourceMappingSegmentEnd(encodedText, pos) {
            return (pos === encodedText.length ||
                encodedText.charCodeAt(pos) === 44 /* comma */ ||
                encodedText.charCodeAt(pos) === 59 /* semicolon */);
        }
    })(sourcemaps = ts.sourcemaps || (ts.sourcemaps = {}));
})(ts || (ts = {}));
