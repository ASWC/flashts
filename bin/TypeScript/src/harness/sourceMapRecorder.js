//
// Copyright (c) Microsoft Corporation.  All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
///<reference path="harness.ts"/>
var Harness;
(function (Harness) {
    var SourceMapRecorder;
    (function (SourceMapRecorder) {
        let SourceMapDecoder;
        (function (SourceMapDecoder) {
            let sourceMapMappings;
            let sourceMapNames;
            let decodingIndex;
            let prevNameIndex;
            let decodeOfEncodedMapping;
            let errorDecodeOfEncodedMapping;
            function initializeSourceMapDecoding(sourceMapData) {
                sourceMapMappings = sourceMapData.sourceMapMappings;
                sourceMapNames = sourceMapData.sourceMapNames;
                decodingIndex = 0;
                prevNameIndex = 0;
                decodeOfEncodedMapping = {
                    emittedLine: 1,
                    emittedColumn: 1,
                    sourceLine: 1,
                    sourceColumn: 1,
                    sourceIndex: 0,
                };
                errorDecodeOfEncodedMapping = undefined;
            }
            SourceMapDecoder.initializeSourceMapDecoding = initializeSourceMapDecoding;
            function isSourceMappingSegmentEnd() {
                if (decodingIndex === sourceMapMappings.length) {
                    return true;
                }
                if (sourceMapMappings.charAt(decodingIndex) === ",") {
                    return true;
                }
                if (sourceMapMappings.charAt(decodingIndex) === ";") {
                    return true;
                }
                return false;
            }
            function decodeNextEncodedSourceMapSpan() {
                errorDecodeOfEncodedMapping = undefined;
                function createErrorIfCondition(condition, errormsg) {
                    if (errorDecodeOfEncodedMapping) {
                        // there was existing error:
                        return true;
                    }
                    if (condition) {
                        errorDecodeOfEncodedMapping = errormsg;
                    }
                    return condition;
                }
                function base64VLQFormatDecode() {
                    function base64FormatDecode() {
                        return "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".indexOf(sourceMapMappings.charAt(decodingIndex));
                    }
                    let moreDigits = true;
                    let shiftCount = 0;
                    let value = 0;
                    for (; moreDigits; decodingIndex++) {
                        if (createErrorIfCondition(decodingIndex >= sourceMapMappings.length, "Error in decoding base64VLQFormatDecode, past the mapping string")) {
                            return;
                        }
                        // 6 digit number
                        const currentByte = base64FormatDecode();
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
                while (decodingIndex < sourceMapMappings.length) {
                    if (sourceMapMappings.charAt(decodingIndex) === ";") {
                        // New line
                        decodeOfEncodedMapping.emittedLine++;
                        decodeOfEncodedMapping.emittedColumn = 1;
                        decodingIndex++;
                        continue;
                    }
                    if (sourceMapMappings.charAt(decodingIndex) === ",") {
                        // Next entry is on same line - no action needed
                        decodingIndex++;
                        continue;
                    }
                    // Read the current span
                    // 1. Column offset from prev read jsColumn
                    decodeOfEncodedMapping.emittedColumn += base64VLQFormatDecode();
                    // Incorrect emittedColumn dont support this map
                    if (createErrorIfCondition(decodeOfEncodedMapping.emittedColumn < 1, "Invalid emittedColumn found")) {
                        return { error: errorDecodeOfEncodedMapping, sourceMapSpan: decodeOfEncodedMapping };
                    }
                    // Dont support reading mappings that dont have information about original source and its line numbers
                    if (createErrorIfCondition(isSourceMappingSegmentEnd(), "Unsupported Error Format: No entries after emitted column")) {
                        return { error: errorDecodeOfEncodedMapping, sourceMapSpan: decodeOfEncodedMapping };
                    }
                    // 2. Relative sourceIndex
                    decodeOfEncodedMapping.sourceIndex += base64VLQFormatDecode();
                    // Incorrect sourceIndex dont support this map
                    if (createErrorIfCondition(decodeOfEncodedMapping.sourceIndex < 0, "Invalid sourceIndex found")) {
                        return { error: errorDecodeOfEncodedMapping, sourceMapSpan: decodeOfEncodedMapping };
                    }
                    // Dont support reading mappings that dont have information about original source span
                    if (createErrorIfCondition(isSourceMappingSegmentEnd(), "Unsupported Error Format: No entries after sourceIndex")) {
                        return { error: errorDecodeOfEncodedMapping, sourceMapSpan: decodeOfEncodedMapping };
                    }
                    // 3. Relative sourceLine 0 based
                    decodeOfEncodedMapping.sourceLine += base64VLQFormatDecode();
                    // Incorrect sourceLine dont support this map
                    if (createErrorIfCondition(decodeOfEncodedMapping.sourceLine < 1, "Invalid sourceLine found")) {
                        return { error: errorDecodeOfEncodedMapping, sourceMapSpan: decodeOfEncodedMapping };
                    }
                    // Dont support reading mappings that dont have information about original source and its line numbers
                    if (createErrorIfCondition(isSourceMappingSegmentEnd(), "Unsupported Error Format: No entries after emitted Line")) {
                        return { error: errorDecodeOfEncodedMapping, sourceMapSpan: decodeOfEncodedMapping };
                    }
                    // 4. Relative sourceColumn 0 based
                    decodeOfEncodedMapping.sourceColumn += base64VLQFormatDecode();
                    // Incorrect sourceColumn dont support this map
                    if (createErrorIfCondition(decodeOfEncodedMapping.sourceColumn < 1, "Invalid sourceLine found")) {
                        return { error: errorDecodeOfEncodedMapping, sourceMapSpan: decodeOfEncodedMapping };
                    }
                    // 5. Check if there is name:
                    if (!isSourceMappingSegmentEnd()) {
                        prevNameIndex += base64VLQFormatDecode();
                        decodeOfEncodedMapping.nameIndex = prevNameIndex;
                        // Incorrect nameIndex dont support this map
                        if (createErrorIfCondition(decodeOfEncodedMapping.nameIndex < 0 || decodeOfEncodedMapping.nameIndex >= sourceMapNames.length, "Invalid name index for the source map entry")) {
                            return { error: errorDecodeOfEncodedMapping, sourceMapSpan: decodeOfEncodedMapping };
                        }
                    }
                    // Dont support reading mappings that dont have information about original source and its line numbers
                    if (createErrorIfCondition(!isSourceMappingSegmentEnd(), "Unsupported Error Format: There are more entries after " + (decodeOfEncodedMapping.nameIndex === -1 ? "sourceColumn" : "nameIndex"))) {
                        return { error: errorDecodeOfEncodedMapping, sourceMapSpan: decodeOfEncodedMapping };
                    }
                    // Populated the entry
                    return { error: errorDecodeOfEncodedMapping, sourceMapSpan: decodeOfEncodedMapping };
                }
                createErrorIfCondition(/*condition*/ true, "No encoded entry found");
            }
            SourceMapDecoder.decodeNextEncodedSourceMapSpan = decodeNextEncodedSourceMapSpan;
            function hasCompletedDecoding() {
                return decodingIndex === sourceMapMappings.length;
            }
            SourceMapDecoder.hasCompletedDecoding = hasCompletedDecoding;
            function getRemainingDecodeString() {
                return sourceMapMappings.substr(decodingIndex);
            }
            SourceMapDecoder.getRemainingDecodeString = getRemainingDecodeString;
        })(SourceMapDecoder || (SourceMapDecoder = {}));
        let SourceMapSpanWriter;
        (function (SourceMapSpanWriter) {
            let sourceMapRecorder;
            let sourceMapSources;
            let sourceMapNames;
            let jsFile;
            let jsLineMap;
            let tsCode;
            let tsLineMap;
            let spansOnSingleLine;
            let prevWrittenSourcePos;
            let prevWrittenJsLine;
            let spanMarkerContinues;
            function initializeSourceMapSpanWriter(sourceMapRecordWriter, sourceMapData, currentJsFile) {
                sourceMapRecorder = sourceMapRecordWriter;
                sourceMapSources = sourceMapData.sourceMapSources;
                sourceMapNames = sourceMapData.sourceMapNames;
                jsFile = currentJsFile;
                jsLineMap = ts.computeLineStarts(jsFile.code);
                spansOnSingleLine = [];
                prevWrittenSourcePos = 0;
                prevWrittenJsLine = 0;
                spanMarkerContinues = false;
                SourceMapDecoder.initializeSourceMapDecoding(sourceMapData);
                sourceMapRecorder.WriteLine("===================================================================");
                sourceMapRecorder.WriteLine("JsFile: " + sourceMapData.sourceMapFile);
                sourceMapRecorder.WriteLine("mapUrl: " + sourceMapData.jsSourceMappingURL);
                sourceMapRecorder.WriteLine("sourceRoot: " + sourceMapData.sourceMapSourceRoot);
                sourceMapRecorder.WriteLine("sources: " + sourceMapData.sourceMapSources);
                if (sourceMapData.sourceMapSourcesContent) {
                    sourceMapRecorder.WriteLine("sourcesContent: " + JSON.stringify(sourceMapData.sourceMapSourcesContent));
                }
                sourceMapRecorder.WriteLine("===================================================================");
            }
            SourceMapSpanWriter.initializeSourceMapSpanWriter = initializeSourceMapSpanWriter;
            function getSourceMapSpanString(mapEntry, getAbsentNameIndex) {
                let mapString = "Emitted(" + mapEntry.emittedLine + ", " + mapEntry.emittedColumn + ") Source(" + mapEntry.sourceLine + ", " + mapEntry.sourceColumn + ") + SourceIndex(" + mapEntry.sourceIndex + ")";
                if (mapEntry.nameIndex >= 0 && mapEntry.nameIndex < sourceMapNames.length) {
                    mapString += " name (" + sourceMapNames[mapEntry.nameIndex] + ")";
                }
                else {
                    if ((mapEntry.nameIndex && mapEntry.nameIndex !== -1) || getAbsentNameIndex) {
                        mapString += " nameIndex (" + mapEntry.nameIndex + ")";
                    }
                }
                return mapString;
            }
            function recordSourceMapSpan(sourceMapSpan) {
                // verify the decoded span is same as the new span
                const decodeResult = SourceMapDecoder.decodeNextEncodedSourceMapSpan();
                let decodeErrors;
                if (decodeResult.error
                    || decodeResult.sourceMapSpan.emittedLine !== sourceMapSpan.emittedLine
                    || decodeResult.sourceMapSpan.emittedColumn !== sourceMapSpan.emittedColumn
                    || decodeResult.sourceMapSpan.sourceLine !== sourceMapSpan.sourceLine
                    || decodeResult.sourceMapSpan.sourceColumn !== sourceMapSpan.sourceColumn
                    || decodeResult.sourceMapSpan.sourceIndex !== sourceMapSpan.sourceIndex
                    || decodeResult.sourceMapSpan.nameIndex !== sourceMapSpan.nameIndex) {
                    if (decodeResult.error) {
                        decodeErrors = ["!!^^ !!^^ There was decoding error in the sourcemap at this location: " + decodeResult.error];
                    }
                    else {
                        decodeErrors = ["!!^^ !!^^ The decoded span from sourcemap's mapping entry does not match what was encoded for this span:"];
                    }
                    decodeErrors.push("!!^^ !!^^ Decoded span from sourcemap's mappings entry: " + getSourceMapSpanString(decodeResult.sourceMapSpan, /*getAbsentNameIndex*/ true) + " Span encoded by the emitter:" + getSourceMapSpanString(sourceMapSpan, /*getAbsentNameIndex*/ true));
                }
                if (spansOnSingleLine.length && spansOnSingleLine[0].sourceMapSpan.emittedLine !== sourceMapSpan.emittedLine) {
                    // On different line from the one that we have been recording till now,
                    writeRecordedSpans();
                    spansOnSingleLine = [];
                }
                spansOnSingleLine.push({ sourceMapSpan, decodeErrors });
            }
            SourceMapSpanWriter.recordSourceMapSpan = recordSourceMapSpan;
            function recordNewSourceFileSpan(sourceMapSpan, newSourceFileCode) {
                assert.isTrue(spansOnSingleLine.length === 0 || spansOnSingleLine[0].sourceMapSpan.emittedLine !== sourceMapSpan.emittedLine, "new file source map span should be on new line. We currently handle only that scenario");
                recordSourceMapSpan(sourceMapSpan);
                assert.isTrue(spansOnSingleLine.length === 1);
                sourceMapRecorder.WriteLine("-------------------------------------------------------------------");
                sourceMapRecorder.WriteLine("emittedFile:" + jsFile.fileName);
                sourceMapRecorder.WriteLine("sourceFile:" + sourceMapSources[spansOnSingleLine[0].sourceMapSpan.sourceIndex]);
                sourceMapRecorder.WriteLine("-------------------------------------------------------------------");
                tsLineMap = ts.computeLineStarts(newSourceFileCode);
                tsCode = newSourceFileCode;
                prevWrittenSourcePos = 0;
            }
            SourceMapSpanWriter.recordNewSourceFileSpan = recordNewSourceFileSpan;
            function close() {
                // Write the lines pending on the single line
                writeRecordedSpans();
                if (!SourceMapDecoder.hasCompletedDecoding()) {
                    sourceMapRecorder.WriteLine("!!!! **** There are more source map entries in the sourceMap's mapping than what was encoded");
                    sourceMapRecorder.WriteLine("!!!! **** Remaining decoded string: " + SourceMapDecoder.getRemainingDecodeString());
                }
                // write remaining js lines
                writeJsFileLines(jsLineMap.length);
            }
            SourceMapSpanWriter.close = close;
            function getTextOfLine(line, lineMap, code) {
                const startPos = lineMap[line];
                const endPos = lineMap[line + 1];
                return code.substring(startPos, endPos);
            }
            function writeJsFileLines(endJsLine) {
                for (; prevWrittenJsLine < endJsLine; prevWrittenJsLine++) {
                    sourceMapRecorder.Write(">>>" + getTextOfLine(prevWrittenJsLine, jsLineMap, jsFile.code));
                }
            }
            function writeRecordedSpans() {
                const markerIds = [];
                function getMarkerId(markerIndex) {
                    let markerId = "";
                    if (spanMarkerContinues) {
                        assert.isTrue(markerIndex === 0);
                        markerId = "1->";
                    }
                    else {
                        markerId = "" + (markerIndex + 1);
                        if (markerId.length < 2) {
                            markerId = markerId + " ";
                        }
                        markerId += ">";
                    }
                    return markerId;
                }
                let prevEmittedCol;
                function iterateSpans(fn) {
                    prevEmittedCol = 1;
                    for (let i = 0; i < spansOnSingleLine.length; i++) {
                        fn(spansOnSingleLine[i], i);
                        prevEmittedCol = spansOnSingleLine[i].sourceMapSpan.emittedColumn;
                    }
                }
                function writeSourceMapIndent(indentLength, indentPrefix) {
                    sourceMapRecorder.Write(indentPrefix);
                    for (let i = 1; i < indentLength; i++) {
                        sourceMapRecorder.Write(" ");
                    }
                }
                function writeSourceMapMarker(currentSpan, index, endColumn = currentSpan.sourceMapSpan.emittedColumn, endContinues) {
                    const markerId = getMarkerId(index);
                    markerIds.push(markerId);
                    writeSourceMapIndent(prevEmittedCol, markerId);
                    for (let i = prevEmittedCol; i < endColumn; i++) {
                        sourceMapRecorder.Write("^");
                    }
                    if (endContinues) {
                        sourceMapRecorder.Write("->");
                    }
                    sourceMapRecorder.WriteLine("");
                    spanMarkerContinues = endContinues;
                }
                function writeSourceMapSourceText(currentSpan, index) {
                    const sourcePos = tsLineMap[currentSpan.sourceMapSpan.sourceLine - 1] + (currentSpan.sourceMapSpan.sourceColumn - 1);
                    let sourceText = "";
                    if (prevWrittenSourcePos < sourcePos) {
                        // Position that goes forward, get text
                        sourceText = tsCode.substring(prevWrittenSourcePos, sourcePos);
                    }
                    if (currentSpan.decodeErrors) {
                        // If there are decode errors, write
                        for (const decodeError of currentSpan.decodeErrors) {
                            writeSourceMapIndent(prevEmittedCol, markerIds[index]);
                            sourceMapRecorder.WriteLine(decodeError);
                        }
                    }
                    const tsCodeLineMap = ts.computeLineStarts(sourceText);
                    for (let i = 0; i < tsCodeLineMap.length; i++) {
                        writeSourceMapIndent(prevEmittedCol, i === 0 ? markerIds[index] : "  >");
                        sourceMapRecorder.Write(getTextOfLine(i, tsCodeLineMap, sourceText));
                        if (i === tsCodeLineMap.length - 1) {
                            sourceMapRecorder.WriteLine("");
                        }
                    }
                    prevWrittenSourcePos = sourcePos;
                }
                function writeSpanDetails(currentSpan, index) {
                    sourceMapRecorder.WriteLine(markerIds[index] + getSourceMapSpanString(currentSpan.sourceMapSpan));
                }
                if (spansOnSingleLine.length) {
                    const currentJsLine = spansOnSingleLine[0].sourceMapSpan.emittedLine;
                    // Write js line
                    writeJsFileLines(currentJsLine);
                    // Emit markers
                    iterateSpans(writeSourceMapMarker);
                    const jsFileText = getTextOfLine(currentJsLine, jsLineMap, jsFile.code);
                    if (prevEmittedCol < jsFileText.length) {
                        // There is remaining text on this line that will be part of next source span so write marker that continues
                        writeSourceMapMarker(/*currentSpan*/ undefined, spansOnSingleLine.length, /*endColumn*/ jsFileText.length, /*endContinues*/ true);
                    }
                    // Emit Source text
                    iterateSpans(writeSourceMapSourceText);
                    // Emit column number etc
                    iterateSpans(writeSpanDetails);
                    sourceMapRecorder.WriteLine("---");
                }
            }
        })(SourceMapSpanWriter || (SourceMapSpanWriter = {}));
        function getSourceMapRecord(sourceMapDataList, program, jsFiles, declarationFiles) {
            const sourceMapRecorder = new Harness.Compiler.WriterAggregator();
            for (let i = 0; i < sourceMapDataList.length; i++) {
                const sourceMapData = sourceMapDataList[i];
                let prevSourceFile;
                let currentFile;
                if (ts.endsWith(sourceMapData.sourceMapFile, ts.Extension.Dts)) {
                    if (sourceMapDataList.length > jsFiles.length) {
                        currentFile = declarationFiles[Math.floor(i / 2)]; // When both kinds of source map are present, they alternate js/dts
                    }
                    else {
                        currentFile = declarationFiles[i];
                    }
                }
                else {
                    if (sourceMapDataList.length > jsFiles.length) {
                        currentFile = jsFiles[Math.floor(i / 2)];
                    }
                    else {
                        currentFile = jsFiles[i];
                    }
                }
                SourceMapSpanWriter.initializeSourceMapSpanWriter(sourceMapRecorder, sourceMapData, currentFile);
                for (const decodedSourceMapping of sourceMapData.sourceMapDecodedMappings) {
                    const currentSourceFile = program.getSourceFile(sourceMapData.inputSourceFileNames[decodedSourceMapping.sourceIndex]);
                    if (currentSourceFile !== prevSourceFile) {
                        SourceMapSpanWriter.recordNewSourceFileSpan(decodedSourceMapping, currentSourceFile.text);
                        prevSourceFile = currentSourceFile;
                    }
                    else {
                        SourceMapSpanWriter.recordSourceMapSpan(decodedSourceMapping);
                    }
                }
                SourceMapSpanWriter.close(); // If the last spans werent emitted, emit them
            }
            sourceMapRecorder.Close();
            return sourceMapRecorder.lines.join("\r\n");
        }
        SourceMapRecorder.getSourceMapRecord = getSourceMapRecord;
    })(SourceMapRecorder = Harness.SourceMapRecorder || (Harness.SourceMapRecorder = {}));
})(Harness || (Harness = {}));
