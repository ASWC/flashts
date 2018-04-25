var ts;
(function (ts) {
    var server;
    (function (server) {
        /* @internal */
        function extractMessage(message) {
            // Read the content length
            const contentLengthPrefix = "Content-Length: ";
            const lines = message.split(/\r?\n/);
            ts.Debug.assert(lines.length >= 2, "Malformed response: Expected 3 lines in the response.");
            const contentLengthText = lines[0];
            ts.Debug.assert(contentLengthText.indexOf(contentLengthPrefix) === 0, "Malformed response: Response text did not contain content-length header.");
            const contentLength = parseInt(contentLengthText.substring(contentLengthPrefix.length));
            // Read the body
            const responseBody = lines[2];
            // Verify content length
            ts.Debug.assert(responseBody.length + 1 === contentLength, "Malformed response: Content length did not match the response's body length.");
            return responseBody;
        }
        server.extractMessage = extractMessage;
        class SessionClient {
            constructor(host) {
                this.host = host;
                this.sequence = 0;
                this.lineMaps = ts.createMap();
                this.messages = [];
                this.getCombinedCodeFix = ts.notImplemented;
                this.applyCodeActionCommand = ts.notImplemented;
            }
            onMessage(message) {
                this.messages.push(message);
            }
            writeMessage(message) {
                this.host.writeMessage(message);
            }
            getLineMap(fileName) {
                let lineMap = this.lineMaps.get(fileName);
                if (!lineMap) {
                    lineMap = ts.computeLineStarts(ts.getSnapshotText(this.host.getScriptSnapshot(fileName)));
                    this.lineMaps.set(fileName, lineMap);
                }
                return lineMap;
            }
            lineOffsetToPosition(fileName, lineOffset, lineMap) {
                lineMap = lineMap || this.getLineMap(fileName);
                return ts.computePositionOfLineAndCharacter(lineMap, lineOffset.line - 1, lineOffset.offset - 1);
            }
            positionToOneBasedLineOffset(fileName, position) {
                const lineOffset = ts.computeLineAndCharacterOfPosition(this.getLineMap(fileName), position);
                return {
                    line: lineOffset.line + 1,
                    offset: lineOffset.character + 1
                };
            }
            convertCodeEditsToTextChange(fileName, codeEdit) {
                return { span: this.decodeSpan(codeEdit, fileName), newText: codeEdit.newText };
            }
            processRequest(command, args) {
                const request = {
                    seq: this.sequence,
                    type: "request",
                    arguments: args,
                    command
                };
                this.sequence++;
                this.writeMessage(JSON.stringify(request));
                return request;
            }
            processResponse(request) {
                let foundResponseMessage = false;
                let lastMessage;
                let response;
                while (!foundResponseMessage) {
                    lastMessage = this.messages.shift();
                    ts.Debug.assert(!!lastMessage, "Did not receive any responses.");
                    const responseBody = extractMessage(lastMessage);
                    try {
                        response = JSON.parse(responseBody);
                        // the server may emit events before emitting the response. We
                        // want to ignore these events for testing purpose.
                        if (response.type === "response") {
                            foundResponseMessage = true;
                        }
                    }
                    catch (e) {
                        throw new Error("Malformed response: Failed to parse server response: " + lastMessage + ". \r\n  Error details: " + e.message);
                    }
                }
                // verify the sequence numbers
                ts.Debug.assert(response.request_seq === request.seq, "Malformed response: response sequence number did not match request sequence number.");
                // unmarshal errors
                if (!response.success) {
                    throw new Error("Error " + response.message);
                }
                ts.Debug.assert(!!response.body, "Malformed response: Unexpected empty response body.");
                return response;
            }
            openFile(file, fileContent, scriptKindName) {
                const args = { file, fileContent, scriptKindName };
                this.processRequest(server.CommandNames.Open, args);
            }
            closeFile(file) {
                const args = { file };
                this.processRequest(server.CommandNames.Close, args);
            }
            changeFile(fileName, start, end, insertString) {
                // clear the line map after an edit
                this.lineMaps.set(fileName, undefined);
                const args = Object.assign({}, this.createFileLocationRequestArgsWithEndLineAndOffset(fileName, start, end), { insertString });
                this.processRequest(server.CommandNames.Change, args);
            }
            getQuickInfoAtPosition(fileName, position) {
                const args = this.createFileLocationRequestArgs(fileName, position);
                const request = this.processRequest(server.CommandNames.Quickinfo, args);
                const response = this.processResponse(request);
                return {
                    kind: response.body.kind,
                    kindModifiers: response.body.kindModifiers,
                    textSpan: this.decodeSpan(response.body, fileName),
                    displayParts: [{ kind: "text", text: response.body.displayString }],
                    documentation: [{ kind: "text", text: response.body.documentation }],
                    tags: response.body.tags
                };
            }
            getProjectInfo(file, needFileNameList) {
                const args = { file, needFileNameList };
                const request = this.processRequest(server.CommandNames.ProjectInfo, args);
                const response = this.processResponse(request);
                return {
                    configFileName: response.body.configFileName,
                    fileNames: response.body.fileNames
                };
            }
            getCompletionsAtPosition(fileName, position, _preferences) {
                // Not passing along 'preferences' because server should already have those from the 'configure' command
                const args = this.createFileLocationRequestArgs(fileName, position);
                const request = this.processRequest(server.CommandNames.Completions, args);
                const response = this.processResponse(request);
                return {
                    isGlobalCompletion: false,
                    isMemberCompletion: false,
                    isNewIdentifierLocation: false,
                    entries: response.body.map(entry => {
                        if (entry.replacementSpan !== undefined) {
                            const { name, kind, kindModifiers, sortText, replacementSpan, hasAction, source, isRecommended } = entry;
                            // TODO: GH#241
                            const res = { name, kind, kindModifiers, sortText, replacementSpan: this.decodeSpan(replacementSpan, fileName), hasAction, source, isRecommended };
                            return res;
                        }
                        return entry; // TODO: GH#18217
                    })
                };
            }
            getCompletionEntryDetails(fileName, position, entryName, _options, source) {
                const args = Object.assign({}, this.createFileLocationRequestArgs(fileName, position), { entryNames: [{ name: entryName, source }] });
                const request = this.processRequest(server.CommandNames.CompletionDetails, args);
                const response = this.processResponse(request);
                ts.Debug.assert(response.body.length === 1, "Unexpected length of completion details response body.");
                const convertedCodeActions = ts.map(response.body[0].codeActions, ({ description, changes }) => ({ description, changes: this.convertChanges(changes, fileName) }));
                return Object.assign({}, response.body[0], { codeActions: convertedCodeActions });
            }
            getCompletionEntrySymbol(_fileName, _position, _entryName) {
                return ts.notImplemented();
            }
            getNavigateToItems(searchValue) {
                const args = {
                    searchValue,
                    file: this.host.getScriptFileNames()[0]
                };
                const request = this.processRequest(server.CommandNames.Navto, args);
                const response = this.processResponse(request);
                return response.body.map(entry => ({
                    name: entry.name,
                    containerName: entry.containerName || "",
                    containerKind: entry.containerKind || ts.ScriptElementKind.unknown,
                    kind: entry.kind,
                    kindModifiers: entry.kindModifiers,
                    matchKind: entry.matchKind,
                    isCaseSensitive: entry.isCaseSensitive,
                    fileName: entry.file,
                    textSpan: this.decodeSpan(entry),
                }));
            }
            getFormattingEditsForRange(file, start, end, _options) {
                const args = this.createFileLocationRequestArgsWithEndLineAndOffset(file, start, end);
                // TODO: handle FormatCodeOptions
                const request = this.processRequest(server.CommandNames.Format, args);
                const response = this.processResponse(request);
                return response.body.map(entry => this.convertCodeEditsToTextChange(file, entry));
            }
            getFormattingEditsForDocument(fileName, options) {
                return this.getFormattingEditsForRange(fileName, 0, this.host.getScriptSnapshot(fileName).getLength(), options);
            }
            getFormattingEditsAfterKeystroke(fileName, position, key, _options) {
                const args = Object.assign({}, this.createFileLocationRequestArgs(fileName, position), { key });
                // TODO: handle FormatCodeOptions
                const request = this.processRequest(server.CommandNames.Formatonkey, args);
                const response = this.processResponse(request);
                return response.body.map(entry => this.convertCodeEditsToTextChange(fileName, entry));
            }
            getDefinitionAtPosition(fileName, position) {
                const args = this.createFileLocationRequestArgs(fileName, position);
                const request = this.processRequest(server.CommandNames.Definition, args);
                const response = this.processResponse(request);
                return response.body.map(entry => ({
                    containerKind: ts.ScriptElementKind.unknown,
                    containerName: "",
                    fileName: entry.file,
                    textSpan: this.decodeSpan(entry),
                    kind: ts.ScriptElementKind.unknown,
                    name: ""
                }));
            }
            getDefinitionAndBoundSpan(fileName, position) {
                const args = this.createFileLocationRequestArgs(fileName, position);
                const request = this.processRequest(server.CommandNames.DefinitionAndBoundSpan, args);
                const response = this.processResponse(request);
                return {
                    definitions: response.body.definitions.map(entry => ({
                        containerKind: ts.ScriptElementKind.unknown,
                        containerName: "",
                        fileName: entry.file,
                        textSpan: this.decodeSpan(entry),
                        kind: ts.ScriptElementKind.unknown,
                        name: ""
                    })),
                    textSpan: this.decodeSpan(response.body.textSpan, request.arguments.file)
                };
            }
            getTypeDefinitionAtPosition(fileName, position) {
                const args = this.createFileLocationRequestArgs(fileName, position);
                const request = this.processRequest(server.CommandNames.TypeDefinition, args);
                const response = this.processResponse(request);
                return response.body.map(entry => ({
                    containerKind: ts.ScriptElementKind.unknown,
                    containerName: "",
                    fileName: entry.file,
                    textSpan: this.decodeSpan(entry),
                    kind: ts.ScriptElementKind.unknown,
                    name: ""
                }));
            }
            getImplementationAtPosition(fileName, position) {
                const args = this.createFileLocationRequestArgs(fileName, position);
                const request = this.processRequest(server.CommandNames.Implementation, args);
                const response = this.processResponse(request);
                return response.body.map(entry => ({
                    fileName: entry.file,
                    textSpan: this.decodeSpan(entry),
                    kind: ts.ScriptElementKind.unknown,
                    displayParts: []
                }));
            }
            findReferences(_fileName, _position) {
                // Not yet implemented.
                return [];
            }
            getReferencesAtPosition(fileName, position) {
                const args = this.createFileLocationRequestArgs(fileName, position);
                const request = this.processRequest(server.CommandNames.References, args);
                const response = this.processResponse(request);
                return response.body.refs.map(entry => ({
                    fileName: entry.file,
                    textSpan: this.decodeSpan(entry),
                    isWriteAccess: entry.isWriteAccess,
                    isDefinition: entry.isDefinition,
                }));
            }
            getEmitOutput(_fileName) {
                return ts.notImplemented();
            }
            getSyntacticDiagnostics(file) {
                return this.getDiagnostics(file, server.CommandNames.SyntacticDiagnosticsSync);
            }
            getSemanticDiagnostics(file) {
                return this.getDiagnostics(file, server.CommandNames.SemanticDiagnosticsSync);
            }
            getSuggestionDiagnostics(file) {
                return this.getDiagnostics(file, server.CommandNames.SuggestionDiagnosticsSync);
            }
            getDiagnostics(file, command) {
                const request = this.processRequest(command, { file, includeLinePosition: true });
                const response = this.processResponse(request);
                return response.body.map((entry) => {
                    const category = ts.firstDefined(Object.keys(ts.DiagnosticCategory), id => ts.isString(id) && entry.category === id.toLowerCase() ? ts.DiagnosticCategory[id] : undefined);
                    return {
                        file: undefined,
                        start: entry.start,
                        length: entry.length,
                        messageText: entry.message,
                        category: ts.Debug.assertDefined(category, "convertDiagnostic: category should not be undefined"),
                        code: entry.code,
                        reportsUnnecessary: entry.reportsUnnecessary,
                    };
                });
            }
            getCompilerOptionsDiagnostics() {
                return ts.notImplemented();
            }
            getRenameInfo(fileName, position, findInStrings, findInComments) {
                const args = Object.assign({}, this.createFileLocationRequestArgs(fileName, position), { findInStrings, findInComments });
                const request = this.processRequest(server.CommandNames.Rename, args);
                const response = this.processResponse(request);
                const locations = [];
                for (const entry of response.body.locs) {
                    const fileName = entry.file;
                    for (const loc of entry.locs) {
                        locations.push({ textSpan: this.decodeSpan(loc, fileName), fileName });
                    }
                }
                return this.lastRenameEntry = {
                    canRename: response.body.info.canRename,
                    displayName: response.body.info.displayName,
                    fullDisplayName: response.body.info.fullDisplayName,
                    kind: response.body.info.kind,
                    kindModifiers: response.body.info.kindModifiers,
                    localizedErrorMessage: response.body.info.localizedErrorMessage,
                    triggerSpan: ts.createTextSpanFromBounds(position, position),
                    fileName,
                    position,
                    findInStrings,
                    findInComments,
                    locations,
                };
            }
            findRenameLocations(fileName, position, findInStrings, findInComments) {
                if (!this.lastRenameEntry ||
                    this.lastRenameEntry.fileName !== fileName ||
                    this.lastRenameEntry.position !== position ||
                    this.lastRenameEntry.findInStrings !== findInStrings ||
                    this.lastRenameEntry.findInComments !== findInComments) {
                    this.getRenameInfo(fileName, position, findInStrings, findInComments);
                }
                return this.lastRenameEntry.locations;
            }
            decodeNavigationBarItems(items, fileName, lineMap) {
                if (!items) {
                    return [];
                }
                return items.map(item => ({
                    text: item.text,
                    kind: item.kind,
                    kindModifiers: item.kindModifiers || "",
                    spans: item.spans.map(span => this.decodeSpan(span, fileName, lineMap)),
                    childItems: this.decodeNavigationBarItems(item.childItems, fileName, lineMap),
                    indent: item.indent,
                    bolded: false,
                    grayed: false
                }));
            }
            getNavigationBarItems(file) {
                const request = this.processRequest(server.CommandNames.NavBar, { file });
                const response = this.processResponse(request);
                const lineMap = this.getLineMap(file);
                return this.decodeNavigationBarItems(response.body, file, lineMap);
            }
            decodeNavigationTree(tree, fileName, lineMap) {
                return {
                    text: tree.text,
                    kind: tree.kind,
                    kindModifiers: tree.kindModifiers,
                    spans: tree.spans.map(span => this.decodeSpan(span, fileName, lineMap)),
                    childItems: ts.map(tree.childItems, item => this.decodeNavigationTree(item, fileName, lineMap))
                };
            }
            getNavigationTree(file) {
                const request = this.processRequest(server.CommandNames.NavTree, { file });
                const response = this.processResponse(request);
                const lineMap = this.getLineMap(file);
                return this.decodeNavigationTree(response.body, file, lineMap);
            }
            decodeSpan(span, fileName, lineMap) {
                fileName = fileName || span.file;
                lineMap = lineMap || this.getLineMap(fileName);
                return ts.createTextSpanFromBounds(this.lineOffsetToPosition(fileName, span.start, lineMap), this.lineOffsetToPosition(fileName, span.end, lineMap));
            }
            getNameOrDottedNameSpan(_fileName, _startPos, _endPos) {
                return ts.notImplemented();
            }
            getBreakpointStatementAtPosition(_fileName, _position) {
                return ts.notImplemented();
            }
            getSignatureHelpItems(fileName, position) {
                const args = this.createFileLocationRequestArgs(fileName, position);
                const request = this.processRequest(server.CommandNames.SignatureHelp, args);
                const response = this.processResponse(request);
                if (!response.body) {
                    return undefined;
                }
                const { items, applicableSpan: encodedApplicableSpan, selectedItemIndex, argumentIndex, argumentCount } = response.body;
                const applicableSpan = this.decodeSpan(encodedApplicableSpan, fileName);
                return { items, applicableSpan, selectedItemIndex, argumentIndex, argumentCount };
            }
            getOccurrencesAtPosition(fileName, position) {
                const args = this.createFileLocationRequestArgs(fileName, position);
                const request = this.processRequest(server.CommandNames.Occurrences, args);
                const response = this.processResponse(request);
                return response.body.map(entry => ({
                    fileName: entry.file,
                    textSpan: this.decodeSpan(entry),
                    isWriteAccess: entry.isWriteAccess,
                    isDefinition: false
                }));
            }
            getDocumentHighlights(fileName, position, filesToSearch) {
                const args = Object.assign({}, this.createFileLocationRequestArgs(fileName, position), { filesToSearch });
                const request = this.processRequest(server.CommandNames.DocumentHighlights, args);
                const response = this.processResponse(request);
                return response.body.map(item => ({
                    fileName: item.file,
                    highlightSpans: item.highlightSpans.map(span => ({
                        textSpan: this.decodeSpan(span, item.file),
                        kind: span.kind
                    })),
                }));
            }
            getOutliningSpans(file) {
                const request = this.processRequest(server.CommandNames.GetOutliningSpans, { file });
                const response = this.processResponse(request);
                return response.body.map(item => ({
                    textSpan: this.decodeSpan(item.textSpan, file),
                    hintSpan: this.decodeSpan(item.hintSpan, file),
                    bannerText: item.bannerText,
                    autoCollapse: item.autoCollapse
                }));
            }
            getTodoComments(_fileName, _descriptors) {
                return ts.notImplemented();
            }
            getDocCommentTemplateAtPosition(_fileName, _position) {
                return ts.notImplemented();
            }
            isValidBraceCompletionAtPosition(_fileName, _position, _openingBrace) {
                return ts.notImplemented();
            }
            getSpanOfEnclosingComment(_fileName, _position, _onlyMultiLine) {
                return ts.notImplemented();
            }
            getCodeFixesAtPosition(file, start, end, errorCodes) {
                const args = Object.assign({}, this.createFileRangeRequestArgs(file, start, end), { errorCodes });
                const request = this.processRequest(server.CommandNames.GetCodeFixes, args);
                const response = this.processResponse(request);
                return response.body.map(({ fixName, description, changes, commands, fixId, fixAllDescription }) => ({ fixName, description, changes: this.convertChanges(changes, file), commands: commands, fixId, fixAllDescription }));
            }
            createFileLocationOrRangeRequestArgs(positionOrRange, fileName) {
                return typeof positionOrRange === "number"
                    ? this.createFileLocationRequestArgs(fileName, positionOrRange)
                    : this.createFileRangeRequestArgs(fileName, positionOrRange.pos, positionOrRange.end);
            }
            createFileLocationRequestArgs(file, position) {
                const { line, offset } = this.positionToOneBasedLineOffset(file, position);
                return { file, line, offset };
            }
            createFileRangeRequestArgs(file, start, end) {
                const { line: startLine, offset: startOffset } = this.positionToOneBasedLineOffset(file, start);
                const { line: endLine, offset: endOffset } = this.positionToOneBasedLineOffset(file, end);
                return { file, startLine, startOffset, endLine, endOffset };
            }
            createFileLocationRequestArgsWithEndLineAndOffset(file, start, end) {
                const { line, offset } = this.positionToOneBasedLineOffset(file, start);
                const { line: endLine, offset: endOffset } = this.positionToOneBasedLineOffset(file, end);
                return { file, line, offset, endLine, endOffset };
            }
            getApplicableRefactors(fileName, positionOrRange) {
                const args = this.createFileLocationOrRangeRequestArgs(positionOrRange, fileName);
                const request = this.processRequest(server.CommandNames.GetApplicableRefactors, args);
                const response = this.processResponse(request);
                return response.body;
            }
            getEditsForRefactor(fileName, _formatOptions, positionOrRange, refactorName, actionName) {
                const args = this.createFileLocationOrRangeRequestArgs(positionOrRange, fileName);
                args.refactor = refactorName;
                args.action = actionName;
                const request = this.processRequest(server.CommandNames.GetEditsForRefactor, args);
                const response = this.processResponse(request);
                if (!response.body) {
                    return { edits: [], renameFilename: undefined, renameLocation: undefined };
                }
                const edits = this.convertCodeEditsToTextChanges(response.body.edits);
                const renameFilename = response.body.renameFilename;
                let renameLocation;
                if (renameFilename !== undefined) {
                    renameLocation = this.lineOffsetToPosition(renameFilename, response.body.renameLocation);
                }
                return {
                    edits,
                    renameFilename,
                    renameLocation
                };
            }
            organizeImports(_scope, _formatOptions) {
                return ts.notImplemented();
            }
            getEditsForFileRename() {
                return ts.notImplemented();
            }
            convertCodeEditsToTextChanges(edits) {
                return edits.map(edit => {
                    const fileName = edit.fileName;
                    return {
                        fileName,
                        textChanges: edit.textChanges.map(t => this.convertTextChangeToCodeEdit(t, fileName))
                    };
                });
            }
            convertChanges(changes, fileName) {
                return changes.map(change => ({
                    fileName: change.fileName,
                    textChanges: change.textChanges.map(textChange => this.convertTextChangeToCodeEdit(textChange, fileName))
                }));
            }
            convertTextChangeToCodeEdit(change, fileName) {
                return {
                    span: this.decodeSpan(change, fileName),
                    newText: change.newText ? change.newText : ""
                };
            }
            getBraceMatchingAtPosition(fileName, position) {
                const args = this.createFileLocationRequestArgs(fileName, position);
                const request = this.processRequest(server.CommandNames.Brace, args);
                const response = this.processResponse(request);
                return response.body.map(entry => this.decodeSpan(entry, fileName));
            }
            getIndentationAtPosition(_fileName, _position, _options) {
                return ts.notImplemented();
            }
            getSyntacticClassifications(_fileName, _span) {
                return ts.notImplemented();
            }
            getSemanticClassifications(_fileName, _span) {
                return ts.notImplemented();
            }
            getEncodedSyntacticClassifications(_fileName, _span) {
                return ts.notImplemented();
            }
            getEncodedSemanticClassifications(_fileName, _span) {
                return ts.notImplemented();
            }
            getProgram() {
                throw new Error("SourceFile objects are not serializable through the server protocol.");
            }
            getNonBoundSourceFile(_fileName) {
                throw new Error("SourceFile objects are not serializable through the server protocol.");
            }
            getSourceFile(_fileName) {
                throw new Error("SourceFile objects are not serializable through the server protocol.");
            }
            cleanupSemanticCache() {
                throw new Error("cleanupSemanticCache is not available through the server layer.");
            }
            dispose() {
                throw new Error("dispose is not available through the server layer.");
            }
        }
        server.SessionClient = SessionClient;
    })(server = ts.server || (ts.server = {}));
})(ts || (ts = {}));
