var ts;
(function (ts) {
    var server;
    (function (server) {
        server.nullCancellationToken = {
            isCancellationRequested: () => false,
            setRequest: () => void 0,
            resetRequest: () => void 0
        };
        function hrTimeToMilliseconds(time) {
            const seconds = time[0];
            const nanoseconds = time[1];
            return ((1e9 * seconds) + nanoseconds) / 1000000.0;
        }
        function isDeclarationFileInJSOnlyNonConfiguredProject(project, file) {
            // Checking for semantic diagnostics is an expensive process. We want to avoid it if we
            // know for sure it is not needed.
            // For instance, .d.ts files injected by ATA automatically do not produce any relevant
            // errors to a JS- only project.
            //
            // Note that configured projects can set skipLibCheck (on by default in jsconfig.json) to
            // disable checking for declaration files. We only need to verify for inferred projects (e.g.
            // miscellaneous context in VS) and external projects(e.g.VS.csproj project) with only JS
            // files.
            //
            // We still want to check .js files in a JS-only inferred or external project (e.g. if the
            // file has '// @ts-check').
            if ((project.projectKind === server.ProjectKind.Inferred || project.projectKind === server.ProjectKind.External) &&
                project.isJsOnlyProject()) {
                const scriptInfo = project.getScriptInfoForNormalizedPath(file);
                return scriptInfo && !scriptInfo.isJavaScript();
            }
            return false;
        }
        function compareNumber(a, b) {
            return a - b;
        }
        function compareFileStart(a, b) {
            if (a.file < b.file) {
                return -1;
            }
            else if (a.file === b.file) {
                const n = compareNumber(a.start.line, b.start.line);
                if (n === 0) {
                    return compareNumber(a.start.offset, b.start.offset);
                }
                else
                    return n;
            }
            else {
                return 1;
            }
        }
        function formatDiag(fileName, project, diag) {
            const scriptInfo = project.getScriptInfoForNormalizedPath(fileName);
            return {
                start: scriptInfo.positionToLineOffset(diag.start),
                end: scriptInfo.positionToLineOffset(diag.start + diag.length),
                text: ts.flattenDiagnosticMessageText(diag.messageText, "\n"),
                code: diag.code,
                category: ts.diagnosticCategoryName(diag),
                reportsUnnecessary: diag.reportsUnnecessary,
                source: diag.source
            };
        }
        function convertToLocation(lineAndCharacter) {
            return { line: lineAndCharacter.line + 1, offset: lineAndCharacter.character + 1 };
        }
        function formatConfigFileDiag(diag, includeFileName) {
            const start = diag.file && convertToLocation(ts.getLineAndCharacterOfPosition(diag.file, diag.start));
            const end = diag.file && convertToLocation(ts.getLineAndCharacterOfPosition(diag.file, diag.start + diag.length));
            const text = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
            const { code, source } = diag;
            const category = ts.diagnosticCategoryName(diag);
            return includeFileName ? { start, end, text, code, category, source, reportsUnnecessary: diag.reportsUnnecessary, fileName: diag.file && diag.file.fileName } :
                { start, end, text, code, category, reportsUnnecessary: diag.reportsUnnecessary, source };
        }
        function allEditsBeforePos(edits, pos) {
            for (const edit of edits) {
                if (ts.textSpanEnd(edit.span) >= pos) {
                    return false;
                }
            }
            return true;
        }
        server.CommandNames = server.protocol.CommandTypes; // tslint:disable-line variable-name
        function formatMessage(msg, logger, byteLength, newLine) {
            const verboseLogging = logger.hasLevel(server.LogLevel.verbose);
            const json = JSON.stringify(msg);
            if (verboseLogging) {
                logger.info(`${msg.type}:${server.indent(json)}`);
            }
            const len = byteLength(json, "utf8");
            return `Content-Length: ${1 + len}\r\n\r\n${json}${newLine}`;
        }
        server.formatMessage = formatMessage;
        /**
         * Represents operation that can schedule its next step to be executed later.
         * Scheduling is done via instance of NextStep. If on current step subsequent step was not scheduled - operation is assumed to be completed.
         */
        class MultistepOperation {
            constructor(operationHost) {
                this.operationHost = operationHost;
            }
            startNew(action) {
                this.complete();
                this.requestId = this.operationHost.getCurrentRequestId();
                this.executeAction(action);
            }
            complete() {
                if (this.requestId !== undefined) {
                    this.operationHost.sendRequestCompletedEvent(this.requestId);
                    this.requestId = undefined;
                }
                this.setTimerHandle(undefined);
                this.setImmediateId(undefined);
            }
            immediate(action) {
                const requestId = this.requestId;
                ts.Debug.assert(requestId === this.operationHost.getCurrentRequestId(), "immediate: incorrect request id");
                this.setImmediateId(this.operationHost.getServerHost().setImmediate(() => {
                    this.immediateId = undefined;
                    this.operationHost.executeWithRequestId(requestId, () => this.executeAction(action));
                }));
            }
            delay(ms, action) {
                const requestId = this.requestId;
                ts.Debug.assert(requestId === this.operationHost.getCurrentRequestId(), "delay: incorrect request id");
                this.setTimerHandle(this.operationHost.getServerHost().setTimeout(() => {
                    this.timerHandle = undefined;
                    this.operationHost.executeWithRequestId(requestId, () => this.executeAction(action));
                }, ms));
            }
            executeAction(action) {
                let stop = false;
                try {
                    if (this.operationHost.isCancellationRequested()) {
                        stop = true;
                    }
                    else {
                        action(this);
                    }
                }
                catch (e) {
                    stop = true;
                    // ignore cancellation request
                    if (!(e instanceof ts.OperationCanceledException)) {
                        this.operationHost.logError(e, `delayed processing of request ${this.requestId}`);
                    }
                }
                if (stop || !this.hasPendingWork()) {
                    this.complete();
                }
            }
            setTimerHandle(timerHandle) {
                if (this.timerHandle !== undefined) {
                    this.operationHost.getServerHost().clearTimeout(this.timerHandle);
                }
                this.timerHandle = timerHandle;
            }
            setImmediateId(immediateId) {
                if (this.immediateId !== undefined) {
                    this.operationHost.getServerHost().clearImmediate(this.immediateId);
                }
                this.immediateId = immediateId;
            }
            hasPendingWork() {
                return !!this.timerHandle || !!this.immediateId;
            }
        }
        /** @internal */
        function toEvent(eventName, body) {
            return {
                seq: 0,
                type: "event",
                event: eventName,
                body
            };
        }
        server.toEvent = toEvent;
        function isProjectsArray(projects) {
            return !!projects.length;
        }
        /**
         * This helper function processes a list of projects and return the concatenated, sortd and deduplicated output of processing each project.
         */
        function combineProjectOutput(defaultValue, getValue, projects, action, comparer, areEqual) {
            const outputs = ts.flatMap(isProjectsArray(projects) ? projects : projects.projects, project => action(project, defaultValue));
            if (!isProjectsArray(projects) && projects.symLinkedProjects) {
                projects.symLinkedProjects.forEach((projects, path) => {
                    const value = getValue(path);
                    outputs.push(...ts.flatMap(projects, project => action(project, value)));
                });
            }
            return comparer
                ? ts.sortAndDeduplicate(outputs, comparer, areEqual)
                : ts.deduplicate(outputs, areEqual);
        }
        class Session {
            constructor(opts) {
                this.changeSeq = 0;
                this.handlers = ts.createMapFromTemplate({
                    [server.CommandNames.Status]: () => {
                        const response = { version: ts.version };
                        return this.requiredResponse(response);
                    },
                    [server.CommandNames.OpenExternalProject]: (request) => {
                        this.projectService.openExternalProject(request.arguments);
                        // TODO: GH#20447 report errors
                        return this.requiredResponse(/*response*/ true);
                    },
                    [server.CommandNames.OpenExternalProjects]: (request) => {
                        this.projectService.openExternalProjects(request.arguments.projects);
                        // TODO: GH#20447 report errors
                        return this.requiredResponse(/*response*/ true);
                    },
                    [server.CommandNames.CloseExternalProject]: (request) => {
                        this.projectService.closeExternalProject(request.arguments.projectFileName);
                        // TODO: GH#20447 report errors
                        return this.requiredResponse(/*response*/ true);
                    },
                    [server.CommandNames.SynchronizeProjectList]: (request) => {
                        const result = this.projectService.synchronizeProjectList(request.arguments.knownProjects);
                        if (!result.some(p => p.projectErrors && p.projectErrors.length !== 0)) {
                            return this.requiredResponse(result);
                        }
                        const converted = ts.map(result, p => {
                            if (!p.projectErrors || p.projectErrors.length === 0) {
                                return p;
                            }
                            return {
                                info: p.info,
                                changes: p.changes,
                                files: p.files,
                                projectErrors: this.convertToDiagnosticsWithLinePosition(p.projectErrors, /*scriptInfo*/ undefined)
                            };
                        });
                        return this.requiredResponse(converted);
                    },
                    [server.CommandNames.ApplyChangedToOpenFiles]: (request) => {
                        this.changeSeq++;
                        this.projectService.applyChangesInOpenFiles(request.arguments.openFiles, request.arguments.changedFiles, request.arguments.closedFiles);
                        // TODO: report errors
                        return this.requiredResponse(/*response*/ true);
                    },
                    [server.CommandNames.Exit]: () => {
                        this.exit();
                        return this.notRequired();
                    },
                    [server.CommandNames.Definition]: (request) => {
                        return this.requiredResponse(this.getDefinition(request.arguments, /*simplifiedResult*/ true));
                    },
                    [server.CommandNames.DefinitionFull]: (request) => {
                        return this.requiredResponse(this.getDefinition(request.arguments, /*simplifiedResult*/ false));
                    },
                    [server.CommandNames.DefinitionAndBoundSpan]: (request) => {
                        return this.requiredResponse(this.getDefinitionAndBoundSpan(request.arguments, /*simplifiedResult*/ true));
                    },
                    [server.CommandNames.DefinitionAndBoundSpanFull]: (request) => {
                        return this.requiredResponse(this.getDefinitionAndBoundSpan(request.arguments, /*simplifiedResult*/ false));
                    },
                    [server.CommandNames.TypeDefinition]: (request) => {
                        return this.requiredResponse(this.getTypeDefinition(request.arguments));
                    },
                    [server.CommandNames.Implementation]: (request) => {
                        return this.requiredResponse(this.getImplementation(request.arguments, /*simplifiedResult*/ true));
                    },
                    [server.CommandNames.ImplementationFull]: (request) => {
                        return this.requiredResponse(this.getImplementation(request.arguments, /*simplifiedResult*/ false));
                    },
                    [server.CommandNames.References]: (request) => {
                        return this.requiredResponse(this.getReferences(request.arguments, /*simplifiedResult*/ true));
                    },
                    [server.CommandNames.ReferencesFull]: (request) => {
                        return this.requiredResponse(this.getReferences(request.arguments, /*simplifiedResult*/ false));
                    },
                    [server.CommandNames.Rename]: (request) => {
                        return this.requiredResponse(this.getRenameLocations(request.arguments, /*simplifiedResult*/ true));
                    },
                    [server.CommandNames.RenameLocationsFull]: (request) => {
                        return this.requiredResponse(this.getRenameLocations(request.arguments, /*simplifiedResult*/ false));
                    },
                    [server.CommandNames.RenameInfoFull]: (request) => {
                        return this.requiredResponse(this.getRenameInfo(request.arguments));
                    },
                    [server.CommandNames.Open]: (request) => {
                        this.openClientFile(server.toNormalizedPath(request.arguments.file), request.arguments.fileContent, server.convertScriptKindName(request.arguments.scriptKindName), request.arguments.projectRootPath ? server.toNormalizedPath(request.arguments.projectRootPath) : undefined);
                        return this.notRequired();
                    },
                    [server.CommandNames.Quickinfo]: (request) => {
                        return this.requiredResponse(this.getQuickInfoWorker(request.arguments, /*simplifiedResult*/ true));
                    },
                    [server.CommandNames.QuickinfoFull]: (request) => {
                        return this.requiredResponse(this.getQuickInfoWorker(request.arguments, /*simplifiedResult*/ false));
                    },
                    [server.CommandNames.GetOutliningSpans]: (request) => {
                        return this.requiredResponse(this.getOutliningSpans(request.arguments, /*simplifiedResult*/ true));
                    },
                    [server.CommandNames.GetOutliningSpansFull]: (request) => {
                        return this.requiredResponse(this.getOutliningSpans(request.arguments, /*simplifiedResult*/ false));
                    },
                    [server.CommandNames.TodoComments]: (request) => {
                        return this.requiredResponse(this.getTodoComments(request.arguments));
                    },
                    [server.CommandNames.Indentation]: (request) => {
                        return this.requiredResponse(this.getIndentation(request.arguments));
                    },
                    [server.CommandNames.NameOrDottedNameSpan]: (request) => {
                        return this.requiredResponse(this.getNameOrDottedNameSpan(request.arguments));
                    },
                    [server.CommandNames.BreakpointStatement]: (request) => {
                        return this.requiredResponse(this.getBreakpointStatement(request.arguments));
                    },
                    [server.CommandNames.BraceCompletion]: (request) => {
                        return this.requiredResponse(this.isValidBraceCompletion(request.arguments));
                    },
                    [server.CommandNames.DocCommentTemplate]: (request) => {
                        return this.requiredResponse(this.getDocCommentTemplate(request.arguments));
                    },
                    [server.CommandNames.GetSpanOfEnclosingComment]: (request) => {
                        return this.requiredResponse(this.getSpanOfEnclosingComment(request.arguments));
                    },
                    [server.CommandNames.Format]: (request) => {
                        return this.requiredResponse(this.getFormattingEditsForRange(request.arguments));
                    },
                    [server.CommandNames.Formatonkey]: (request) => {
                        return this.requiredResponse(this.getFormattingEditsAfterKeystroke(request.arguments));
                    },
                    [server.CommandNames.FormatFull]: (request) => {
                        return this.requiredResponse(this.getFormattingEditsForDocumentFull(request.arguments));
                    },
                    [server.CommandNames.FormatonkeyFull]: (request) => {
                        return this.requiredResponse(this.getFormattingEditsAfterKeystrokeFull(request.arguments));
                    },
                    [server.CommandNames.FormatRangeFull]: (request) => {
                        return this.requiredResponse(this.getFormattingEditsForRangeFull(request.arguments));
                    },
                    [server.CommandNames.Completions]: (request) => {
                        return this.requiredResponse(this.getCompletions(request.arguments, /*simplifiedResult*/ true));
                    },
                    [server.CommandNames.CompletionsFull]: (request) => {
                        return this.requiredResponse(this.getCompletions(request.arguments, /*simplifiedResult*/ false));
                    },
                    [server.CommandNames.CompletionDetails]: (request) => {
                        return this.requiredResponse(this.getCompletionEntryDetails(request.arguments, /*simplifiedResult*/ true));
                    },
                    [server.CommandNames.CompletionDetailsFull]: (request) => {
                        return this.requiredResponse(this.getCompletionEntryDetails(request.arguments, /*simplifiedResult*/ false));
                    },
                    [server.CommandNames.CompileOnSaveAffectedFileList]: (request) => {
                        return this.requiredResponse(this.getCompileOnSaveAffectedFileList(request.arguments));
                    },
                    [server.CommandNames.CompileOnSaveEmitFile]: (request) => {
                        return this.requiredResponse(this.emitFile(request.arguments));
                    },
                    [server.CommandNames.SignatureHelp]: (request) => {
                        return this.requiredResponse(this.getSignatureHelpItems(request.arguments, /*simplifiedResult*/ true));
                    },
                    [server.CommandNames.SignatureHelpFull]: (request) => {
                        return this.requiredResponse(this.getSignatureHelpItems(request.arguments, /*simplifiedResult*/ false));
                    },
                    [server.CommandNames.CompilerOptionsDiagnosticsFull]: (request) => {
                        return this.requiredResponse(this.getCompilerOptionsDiagnostics(request.arguments));
                    },
                    [server.CommandNames.EncodedSemanticClassificationsFull]: (request) => {
                        return this.requiredResponse(this.getEncodedSemanticClassifications(request.arguments));
                    },
                    [server.CommandNames.Cleanup]: () => {
                        this.cleanup();
                        return this.requiredResponse(/*response*/ true);
                    },
                    [server.CommandNames.SemanticDiagnosticsSync]: (request) => {
                        return this.requiredResponse(this.getSemanticDiagnosticsSync(request.arguments));
                    },
                    [server.CommandNames.SyntacticDiagnosticsSync]: (request) => {
                        return this.requiredResponse(this.getSyntacticDiagnosticsSync(request.arguments));
                    },
                    [server.CommandNames.SuggestionDiagnosticsSync]: (request) => {
                        return this.requiredResponse(this.getSuggestionDiagnosticsSync(request.arguments));
                    },
                    [server.CommandNames.Geterr]: (request) => {
                        this.errorCheck.startNew(next => this.getDiagnostics(next, request.arguments.delay, request.arguments.files));
                        return this.notRequired();
                    },
                    [server.CommandNames.GeterrForProject]: (request) => {
                        this.errorCheck.startNew(next => this.getDiagnosticsForProject(next, request.arguments.delay, request.arguments.file));
                        return this.notRequired();
                    },
                    [server.CommandNames.Change]: (request) => {
                        this.change(request.arguments);
                        return this.notRequired();
                    },
                    [server.CommandNames.Configure]: (request) => {
                        this.projectService.setHostConfiguration(request.arguments);
                        this.doOutput(/*info*/ undefined, server.CommandNames.Configure, request.seq, /*success*/ true);
                        return this.notRequired();
                    },
                    [server.CommandNames.Reload]: (request) => {
                        this.reload(request.arguments, request.seq);
                        return this.requiredResponse({ reloadFinished: true });
                    },
                    [server.CommandNames.Saveto]: (request) => {
                        const savetoArgs = request.arguments;
                        this.saveToTmp(savetoArgs.file, savetoArgs.tmpfile);
                        return this.notRequired();
                    },
                    [server.CommandNames.Close]: (request) => {
                        const closeArgs = request.arguments;
                        this.closeClientFile(closeArgs.file);
                        return this.notRequired();
                    },
                    [server.CommandNames.Navto]: (request) => {
                        return this.requiredResponse(this.getNavigateToItems(request.arguments, /*simplifiedResult*/ true));
                    },
                    [server.CommandNames.NavtoFull]: (request) => {
                        return this.requiredResponse(this.getNavigateToItems(request.arguments, /*simplifiedResult*/ false));
                    },
                    [server.CommandNames.Brace]: (request) => {
                        return this.requiredResponse(this.getBraceMatching(request.arguments, /*simplifiedResult*/ true));
                    },
                    [server.CommandNames.BraceFull]: (request) => {
                        return this.requiredResponse(this.getBraceMatching(request.arguments, /*simplifiedResult*/ false));
                    },
                    [server.CommandNames.NavBar]: (request) => {
                        return this.requiredResponse(this.getNavigationBarItems(request.arguments, /*simplifiedResult*/ true));
                    },
                    [server.CommandNames.NavBarFull]: (request) => {
                        return this.requiredResponse(this.getNavigationBarItems(request.arguments, /*simplifiedResult*/ false));
                    },
                    [server.CommandNames.NavTree]: (request) => {
                        return this.requiredResponse(this.getNavigationTree(request.arguments, /*simplifiedResult*/ true));
                    },
                    [server.CommandNames.NavTreeFull]: (request) => {
                        return this.requiredResponse(this.getNavigationTree(request.arguments, /*simplifiedResult*/ false));
                    },
                    [server.CommandNames.Occurrences]: (request) => {
                        return this.requiredResponse(this.getOccurrences(request.arguments));
                    },
                    [server.CommandNames.DocumentHighlights]: (request) => {
                        return this.requiredResponse(this.getDocumentHighlights(request.arguments, /*simplifiedResult*/ true));
                    },
                    [server.CommandNames.DocumentHighlightsFull]: (request) => {
                        return this.requiredResponse(this.getDocumentHighlights(request.arguments, /*simplifiedResult*/ false));
                    },
                    [server.CommandNames.CompilerOptionsForInferredProjects]: (request) => {
                        this.setCompilerOptionsForInferredProjects(request.arguments);
                        return this.requiredResponse(/*response*/ true);
                    },
                    [server.CommandNames.ProjectInfo]: (request) => {
                        return this.requiredResponse(this.getProjectInfo(request.arguments));
                    },
                    [server.CommandNames.ReloadProjects]: () => {
                        this.projectService.reloadProjects();
                        return this.notRequired();
                    },
                    [server.CommandNames.GetCodeFixes]: (request) => {
                        return this.requiredResponse(this.getCodeFixes(request.arguments, /*simplifiedResult*/ true));
                    },
                    [server.CommandNames.GetCodeFixesFull]: (request) => {
                        return this.requiredResponse(this.getCodeFixes(request.arguments, /*simplifiedResult*/ false));
                    },
                    [server.CommandNames.GetCombinedCodeFix]: (request) => {
                        return this.requiredResponse(this.getCombinedCodeFix(request.arguments, /*simplifiedResult*/ true));
                    },
                    [server.CommandNames.GetCombinedCodeFixFull]: (request) => {
                        return this.requiredResponse(this.getCombinedCodeFix(request.arguments, /*simplifiedResult*/ false));
                    },
                    [server.CommandNames.ApplyCodeActionCommand]: (request) => {
                        return this.requiredResponse(this.applyCodeActionCommand(request.arguments));
                    },
                    [server.CommandNames.GetSupportedCodeFixes]: () => {
                        return this.requiredResponse(this.getSupportedCodeFixes());
                    },
                    [server.CommandNames.GetApplicableRefactors]: (request) => {
                        return this.requiredResponse(this.getApplicableRefactors(request.arguments));
                    },
                    [server.CommandNames.GetEditsForRefactor]: (request) => {
                        return this.requiredResponse(this.getEditsForRefactor(request.arguments, /*simplifiedResult*/ true));
                    },
                    [server.CommandNames.GetEditsForRefactorFull]: (request) => {
                        return this.requiredResponse(this.getEditsForRefactor(request.arguments, /*simplifiedResult*/ false));
                    },
                    [server.CommandNames.OrganizeImports]: (request) => {
                        return this.requiredResponse(this.organizeImports(request.arguments, /*simplifiedResult*/ true));
                    },
                    [server.CommandNames.OrganizeImportsFull]: (request) => {
                        return this.requiredResponse(this.organizeImports(request.arguments, /*simplifiedResult*/ false));
                    },
                    [server.CommandNames.GetEditsForFileRename]: (request) => {
                        return this.requiredResponse(this.getEditsForFileRename(request.arguments, /*simplifiedResult*/ true));
                    },
                    [server.CommandNames.GetEditsForFileRenameFull]: (request) => {
                        return this.requiredResponse(this.getEditsForFileRename(request.arguments, /*simplifiedResult*/ false));
                    },
                });
                this.host = opts.host;
                this.cancellationToken = opts.cancellationToken;
                this.typingsInstaller = opts.typingsInstaller;
                this.byteLength = opts.byteLength;
                this.hrtime = opts.hrtime;
                this.logger = opts.logger;
                this.canUseEvents = opts.canUseEvents;
                this.suppressDiagnosticEvents = opts.suppressDiagnosticEvents;
                const { throttleWaitMilliseconds } = opts;
                this.eventHandler = this.canUseEvents
                    ? opts.eventHandler || (event => this.defaultEventHandler(event))
                    : undefined;
                const multistepOperationHost = {
                    executeWithRequestId: (requestId, action) => this.executeWithRequestId(requestId, action),
                    getCurrentRequestId: () => this.currentRequestId,
                    getServerHost: () => this.host,
                    logError: (err, cmd) => this.logError(err, cmd),
                    sendRequestCompletedEvent: requestId => this.sendRequestCompletedEvent(requestId),
                    isCancellationRequested: () => this.cancellationToken.isCancellationRequested()
                };
                this.errorCheck = new MultistepOperation(multistepOperationHost);
                const settings = {
                    host: this.host,
                    logger: this.logger,
                    cancellationToken: this.cancellationToken,
                    useSingleInferredProject: opts.useSingleInferredProject,
                    useInferredProjectPerProjectRoot: opts.useInferredProjectPerProjectRoot,
                    typingsInstaller: this.typingsInstaller,
                    throttleWaitMilliseconds,
                    eventHandler: this.eventHandler,
                    suppressDiagnosticEvents: this.suppressDiagnosticEvents,
                    globalPlugins: opts.globalPlugins,
                    pluginProbeLocations: opts.pluginProbeLocations,
                    allowLocalPluginLoads: opts.allowLocalPluginLoads,
                    syntaxOnly: opts.syntaxOnly,
                };
                this.projectService = new server.ProjectService(settings);
                this.gcTimer = new server.GcTimer(this.host, /*delay*/ 7000, this.logger);
            }
            sendRequestCompletedEvent(requestId) {
                this.event({ request_seq: requestId }, "requestCompleted");
            }
            defaultEventHandler(event) {
                switch (event.eventName) {
                    case server.ProjectsUpdatedInBackgroundEvent:
                        const { openFiles } = event.data;
                        this.projectsUpdatedInBackgroundEvent(openFiles);
                        break;
                    case server.ConfigFileDiagEvent:
                        const { triggerFile, configFileName: configFile, diagnostics } = event.data;
                        const bakedDiags = ts.map(diagnostics, diagnostic => formatConfigFileDiag(diagnostic, /*includeFileName*/ true));
                        this.event({
                            triggerFile,
                            configFile,
                            diagnostics: bakedDiags
                        }, "configFileDiag");
                        break;
                    case server.ProjectLanguageServiceStateEvent: {
                        const eventName = "projectLanguageServiceState";
                        this.event({
                            projectName: event.data.project.getProjectName(),
                            languageServiceEnabled: event.data.languageServiceEnabled
                        }, eventName);
                        break;
                    }
                    case server.ProjectInfoTelemetryEvent: {
                        const eventName = "telemetry";
                        this.event({
                            telemetryEventName: event.eventName,
                            payload: event.data,
                        }, eventName);
                        break;
                    }
                }
            }
            projectsUpdatedInBackgroundEvent(openFiles) {
                this.projectService.logger.info(`got projects updated in background, updating diagnostics for ${openFiles}`);
                if (openFiles.length) {
                    if (!this.suppressDiagnosticEvents) {
                        const checkList = this.createCheckList(openFiles);
                        // For now only queue error checking for open files. We can change this to include non open files as well
                        this.errorCheck.startNew(next => this.updateErrorCheck(next, checkList, 100, /*requireOpen*/ true));
                    }
                    // Send project changed event
                    this.event({
                        openFiles
                    }, "projectsUpdatedInBackground");
                }
            }
            logError(err, cmd) {
                let msg = "Exception on executing command " + cmd;
                if (err.message) {
                    msg += ":\n" + server.indent(err.message);
                    if (err.stack) {
                        msg += "\n" + server.indent(err.stack);
                    }
                }
                this.logger.msg(msg, server.Msg.Err);
            }
            send(msg) {
                if (msg.type === "event" && !this.canUseEvents) {
                    if (this.logger.hasLevel(server.LogLevel.verbose)) {
                        this.logger.info(`Session does not support events: ignored event: ${JSON.stringify(msg)}`);
                    }
                    return;
                }
                this.host.write(formatMessage(msg, this.logger, this.byteLength, this.host.newLine));
            }
            event(body, eventName) {
                this.send(toEvent(eventName, body));
            }
            // For backwards-compatibility only.
            /** @deprecated */
            output(info, cmdName, reqSeq, errorMsg) {
                this.doOutput(info, cmdName, reqSeq, /*success*/ !errorMsg, errorMsg);
            }
            doOutput(info, cmdName, reqSeq, success, message) {
                const res = {
                    seq: 0,
                    type: "response",
                    command: cmdName,
                    request_seq: reqSeq,
                    success,
                };
                if (success) {
                    res.body = info;
                }
                else {
                    ts.Debug.assert(info === undefined);
                }
                if (message) {
                    res.message = message;
                }
                this.send(res);
            }
            semanticCheck(file, project) {
                const diags = isDeclarationFileInJSOnlyNonConfiguredProject(project, file)
                    ? server.emptyArray
                    : project.getLanguageService().getSemanticDiagnostics(file);
                this.sendDiagnosticsEvent(file, project, diags, "semanticDiag");
            }
            syntacticCheck(file, project) {
                this.sendDiagnosticsEvent(file, project, project.getLanguageService().getSyntacticDiagnostics(file), "syntaxDiag");
            }
            suggestionCheck(file, project) {
                this.sendDiagnosticsEvent(file, project, project.getLanguageService().getSuggestionDiagnostics(file), "suggestionDiag");
            }
            sendDiagnosticsEvent(file, project, diagnostics, kind) {
                try {
                    this.event({ file, diagnostics: diagnostics.map(diag => formatDiag(file, project, diag)) }, kind);
                }
                catch (err) {
                    this.logError(err, kind);
                }
            }
            /** It is the caller's responsibility to verify that `!this.suppressDiagnosticEvents`. */
            updateErrorCheck(next, checkList, ms, requireOpen = true) {
                ts.Debug.assert(!this.suppressDiagnosticEvents); // Caller's responsibility
                const seq = this.changeSeq;
                const followMs = Math.min(ms, 200);
                let index = 0;
                const checkOne = () => {
                    if (this.changeSeq !== seq) {
                        return;
                    }
                    const { fileName, project } = checkList[index];
                    index++;
                    if (!project.containsFile(fileName, requireOpen)) {
                        return;
                    }
                    this.syntacticCheck(fileName, project);
                    if (this.changeSeq !== seq) {
                        return;
                    }
                    next.immediate(() => {
                        this.semanticCheck(fileName, project);
                        if (this.changeSeq !== seq) {
                            return;
                        }
                        const goNext = () => {
                            if (checkList.length > index) {
                                next.delay(followMs, checkOne);
                            }
                        };
                        if (this.getPreferences(fileName).disableSuggestions) {
                            goNext();
                        }
                        else {
                            next.immediate(() => {
                                this.suggestionCheck(fileName, project);
                                goNext();
                            });
                        }
                    });
                };
                if (checkList.length > index && this.changeSeq === seq) {
                    next.delay(ms, checkOne);
                }
            }
            cleanProjects(caption, projects) {
                if (!projects) {
                    return;
                }
                this.logger.info(`cleaning ${caption}`);
                for (const p of projects) {
                    p.getLanguageService(/*ensureSynchronized*/ false).cleanupSemanticCache();
                }
            }
            cleanup() {
                this.cleanProjects("inferred projects", this.projectService.inferredProjects);
                this.cleanProjects("configured projects", ts.arrayFrom(this.projectService.configuredProjects.values()));
                this.cleanProjects("external projects", this.projectService.externalProjects);
                if (this.host.gc) {
                    this.logger.info(`host.gc()`);
                    this.host.gc();
                }
            }
            getEncodedSemanticClassifications(args) {
                const { file, project } = this.getFileAndProject(args);
                return project.getLanguageService().getEncodedSemanticClassifications(file, args);
            }
            getProject(projectFileName) {
                return projectFileName && this.projectService.findProject(projectFileName);
            }
            getConfigFileAndProject(args) {
                const project = this.getProject(args.projectFileName);
                const file = server.toNormalizedPath(args.file);
                return {
                    configFile: project && project.hasConfigFile(file) && file,
                    project
                };
            }
            getConfigFileDiagnostics(configFile, project, includeLinePosition) {
                const projectErrors = project.getAllProjectErrors();
                const optionsErrors = project.getLanguageService().getCompilerOptionsDiagnostics();
                const diagnosticsForConfigFile = ts.filter(ts.concatenate(projectErrors, optionsErrors), diagnostic => diagnostic.file && diagnostic.file.fileName === configFile);
                return includeLinePosition ?
                    this.convertToDiagnosticsWithLinePositionFromDiagnosticFile(diagnosticsForConfigFile) :
                    ts.map(diagnosticsForConfigFile, diagnostic => formatConfigFileDiag(diagnostic, /*includeFileName*/ false));
            }
            convertToDiagnosticsWithLinePositionFromDiagnosticFile(diagnostics) {
                return diagnostics.map(d => ({
                    message: ts.flattenDiagnosticMessageText(d.messageText, this.host.newLine),
                    start: d.start,
                    length: d.length,
                    category: ts.diagnosticCategoryName(d),
                    code: d.code,
                    startLocation: d.file && convertToLocation(ts.getLineAndCharacterOfPosition(d.file, d.start)),
                    endLocation: d.file && convertToLocation(ts.getLineAndCharacterOfPosition(d.file, d.start + d.length))
                }));
            }
            getCompilerOptionsDiagnostics(args) {
                const project = this.getProject(args.projectFileName);
                // Get diagnostics that dont have associated file with them
                // The diagnostics which have file would be in config file and
                // would be reported as part of configFileDiagnostics
                return this.convertToDiagnosticsWithLinePosition(ts.filter(project.getLanguageService().getCompilerOptionsDiagnostics(), diagnostic => !diagnostic.file), 
                /*scriptInfo*/ undefined);
            }
            convertToDiagnosticsWithLinePosition(diagnostics, scriptInfo) {
                return diagnostics.map(d => ({
                    message: ts.flattenDiagnosticMessageText(d.messageText, this.host.newLine),
                    start: d.start,
                    length: d.length,
                    category: ts.diagnosticCategoryName(d),
                    code: d.code,
                    source: d.source,
                    startLocation: scriptInfo && scriptInfo.positionToLineOffset(d.start),
                    endLocation: scriptInfo && scriptInfo.positionToLineOffset(d.start + d.length),
                    reportsUnnecessary: d.reportsUnnecessary
                }));
            }
            getDiagnosticsWorker(args, isSemantic, selector, includeLinePosition) {
                const { project, file } = this.getFileAndProject(args);
                if (isSemantic && isDeclarationFileInJSOnlyNonConfiguredProject(project, file)) {
                    return server.emptyArray;
                }
                const scriptInfo = project.getScriptInfoForNormalizedPath(file);
                const diagnostics = selector(project, file);
                return includeLinePosition
                    ? this.convertToDiagnosticsWithLinePosition(diagnostics, scriptInfo)
                    : diagnostics.map(d => formatDiag(file, project, d));
            }
            getDefinition(args, simplifiedResult) {
                const { file, project } = this.getFileAndProject(args);
                const position = this.getPositionInFile(args, file);
                const definitions = project.getLanguageService().getDefinitionAtPosition(file, position);
                if (!definitions) {
                    return server.emptyArray;
                }
                if (simplifiedResult) {
                    return this.mapDefinitionInfo(definitions, project);
                }
                else {
                    return definitions;
                }
            }
            getDefinitionAndBoundSpan(args, simplifiedResult) {
                const { file, project } = this.getFileAndProject(args);
                const position = this.getPositionInFile(args, file);
                const scriptInfo = project.getScriptInfo(file);
                const definitionAndBoundSpan = project.getLanguageService().getDefinitionAndBoundSpan(file, position);
                if (!definitionAndBoundSpan || !definitionAndBoundSpan.definitions) {
                    return {
                        definitions: server.emptyArray,
                        textSpan: undefined
                    };
                }
                if (simplifiedResult) {
                    return {
                        definitions: this.mapDefinitionInfo(definitionAndBoundSpan.definitions, project),
                        textSpan: this.toLocationTextSpan(definitionAndBoundSpan.textSpan, scriptInfo)
                    };
                }
                return definitionAndBoundSpan;
            }
            mapDefinitionInfo(definitions, project) {
                return definitions.map(def => this.toFileSpan(def.fileName, def.textSpan, project));
            }
            toFileSpan(fileName, textSpan, project) {
                const scriptInfo = project.getScriptInfo(fileName);
                return {
                    file: fileName,
                    start: scriptInfo.positionToLineOffset(textSpan.start),
                    end: scriptInfo.positionToLineOffset(ts.textSpanEnd(textSpan))
                };
            }
            getTypeDefinition(args) {
                const { file, project } = this.getFileAndProject(args);
                const position = this.getPositionInFile(args, file);
                const definitions = project.getLanguageService().getTypeDefinitionAtPosition(file, position);
                if (!definitions) {
                    return server.emptyArray;
                }
                return this.mapDefinitionInfo(definitions, project);
            }
            getImplementation(args, simplifiedResult) {
                const { file, project } = this.getFileAndProject(args);
                const position = this.getPositionInFile(args, file);
                const implementations = project.getLanguageService().getImplementationAtPosition(file, position);
                if (!implementations) {
                    return server.emptyArray;
                }
                if (simplifiedResult) {
                    return implementations.map(({ fileName, textSpan }) => this.toFileSpan(fileName, textSpan, project));
                }
                else {
                    return implementations;
                }
            }
            getOccurrences(args) {
                const { file, project } = this.getFileAndProject(args);
                const position = this.getPositionInFile(args, file);
                const occurrences = project.getLanguageService().getOccurrencesAtPosition(file, position);
                if (!occurrences) {
                    return server.emptyArray;
                }
                return occurrences.map(occurrence => {
                    const { fileName, isWriteAccess, textSpan, isInString } = occurrence;
                    const scriptInfo = project.getScriptInfo(fileName);
                    const result = {
                        start: scriptInfo.positionToLineOffset(textSpan.start),
                        end: scriptInfo.positionToLineOffset(ts.textSpanEnd(textSpan)),
                        file: fileName,
                        isWriteAccess,
                    };
                    // no need to serialize the property if it is not true
                    if (isInString) {
                        result.isInString = isInString;
                    }
                    return result;
                });
            }
            getSyntacticDiagnosticsSync(args) {
                const { configFile } = this.getConfigFileAndProject(args);
                if (configFile) {
                    // all the config file errors are reported as part of semantic check so nothing to report here
                    return server.emptyArray;
                }
                return this.getDiagnosticsWorker(args, /*isSemantic*/ false, (project, file) => project.getLanguageService().getSyntacticDiagnostics(file), args.includeLinePosition);
            }
            getSemanticDiagnosticsSync(args) {
                const { configFile, project } = this.getConfigFileAndProject(args);
                if (configFile) {
                    return this.getConfigFileDiagnostics(configFile, project, args.includeLinePosition);
                }
                return this.getDiagnosticsWorker(args, /*isSemantic*/ true, (project, file) => project.getLanguageService().getSemanticDiagnostics(file), args.includeLinePosition);
            }
            getSuggestionDiagnosticsSync(args) {
                const { configFile } = this.getConfigFileAndProject(args);
                if (configFile) {
                    // Currently there are no info diagnostics for config files.
                    return server.emptyArray;
                }
                // isSemantic because we don't want to info diagnostics in declaration files for JS-only users
                return this.getDiagnosticsWorker(args, /*isSemantic*/ true, (project, file) => project.getLanguageService().getSuggestionDiagnostics(file), args.includeLinePosition);
            }
            getDocumentHighlights(args, simplifiedResult) {
                const { file, project } = this.getFileAndProject(args);
                const position = this.getPositionInFile(args, file);
                const documentHighlights = project.getLanguageService().getDocumentHighlights(file, position, args.filesToSearch);
                if (!documentHighlights) {
                    return server.emptyArray;
                }
                if (simplifiedResult) {
                    return documentHighlights.map(convertToDocumentHighlightsItem);
                }
                else {
                    return documentHighlights;
                }
                function convertToDocumentHighlightsItem(documentHighlights) {
                    const { fileName, highlightSpans } = documentHighlights;
                    const scriptInfo = project.getScriptInfo(fileName);
                    return {
                        file: fileName,
                        highlightSpans: highlightSpans.map(convertHighlightSpan)
                    };
                    function convertHighlightSpan(highlightSpan) {
                        const { textSpan, kind } = highlightSpan;
                        const start = scriptInfo.positionToLineOffset(textSpan.start);
                        const end = scriptInfo.positionToLineOffset(ts.textSpanEnd(textSpan));
                        return { start, end, kind };
                    }
                }
            }
            setCompilerOptionsForInferredProjects(args) {
                this.projectService.setCompilerOptionsForInferredProjects(args.options, args.projectRootPath);
            }
            getProjectInfo(args) {
                return this.getProjectInfoWorker(args.file, args.projectFileName, args.needFileNameList, /*excludeConfigFiles*/ false);
            }
            getProjectInfoWorker(uncheckedFileName, projectFileName, needFileNameList, excludeConfigFiles) {
                const { project } = this.getFileAndProjectWorker(uncheckedFileName, projectFileName);
                project.updateGraph();
                const projectInfo = {
                    configFileName: project.getProjectName(),
                    languageServiceDisabled: !project.languageServiceEnabled,
                    fileNames: needFileNameList ? project.getFileNames(/*excludeFilesFromExternalLibraries*/ false, excludeConfigFiles) : undefined
                };
                return projectInfo;
            }
            getRenameInfo(args) {
                const { file, project } = this.getFileAndProject(args);
                const position = this.getPositionInFile(args, file);
                return project.getLanguageService().getRenameInfo(file, position);
            }
            getProjects(args) {
                let projects;
                let symLinkedProjects;
                if (args.projectFileName) {
                    const project = this.getProject(args.projectFileName);
                    if (project) {
                        projects = [project];
                    }
                }
                else {
                    const scriptInfo = this.projectService.getScriptInfo(args.file);
                    projects = scriptInfo.containingProjects;
                    symLinkedProjects = this.projectService.getSymlinkedProjects(scriptInfo);
                }
                // filter handles case when 'projects' is undefined
                projects = ts.filter(projects, p => p.languageServiceEnabled);
                if ((!projects || !projects.length) && !symLinkedProjects) {
                    return server.Errors.ThrowNoProject();
                }
                return symLinkedProjects ? { projects, symLinkedProjects } : projects;
            }
            getDefaultProject(args) {
                if (args.projectFileName) {
                    const project = this.getProject(args.projectFileName);
                    if (project) {
                        return project;
                    }
                }
                const info = this.projectService.getScriptInfo(args.file);
                return info.getDefaultProject();
            }
            getRenameLocations(args, simplifiedResult) {
                const file = server.toNormalizedPath(args.file);
                const position = this.getPositionInFile(args, file);
                const projects = this.getProjects(args);
                if (simplifiedResult) {
                    const defaultProject = this.getDefaultProject(args);
                    // The rename info should be the same for every project
                    const renameInfo = defaultProject.getLanguageService().getRenameInfo(file, position);
                    if (!renameInfo) {
                        return undefined;
                    }
                    if (!renameInfo.canRename) {
                        return {
                            info: renameInfo,
                            locs: server.emptyArray
                        };
                    }
                    const fileSpans = combineProjectOutput(file, path => this.projectService.getScriptInfoForPath(path).fileName, projects, (project, file) => {
                        const renameLocations = project.getLanguageService().findRenameLocations(file, position, args.findInStrings, args.findInComments);
                        if (!renameLocations) {
                            return server.emptyArray;
                        }
                        return renameLocations.map(location => {
                            const locationScriptInfo = project.getScriptInfo(location.fileName);
                            return {
                                file: location.fileName,
                                start: locationScriptInfo.positionToLineOffset(location.textSpan.start),
                                end: locationScriptInfo.positionToLineOffset(ts.textSpanEnd(location.textSpan)),
                            };
                        });
                    }, compareRenameLocation, (a, b) => a.file === b.file && a.start.line === b.start.line && a.start.offset === b.start.offset);
                    const locs = [];
                    for (const cur of fileSpans) {
                        let curFileAccum;
                        if (locs.length > 0) {
                            curFileAccum = locs[locs.length - 1];
                            if (curFileAccum.file !== cur.file) {
                                curFileAccum = undefined;
                            }
                        }
                        if (!curFileAccum) {
                            curFileAccum = { file: cur.file, locs: [] };
                            locs.push(curFileAccum);
                        }
                        curFileAccum.locs.push({ start: cur.start, end: cur.end });
                    }
                    return { info: renameInfo, locs };
                }
                else {
                    return combineProjectOutput(file, path => this.projectService.getScriptInfoForPath(path).fileName, projects, (p, file) => p.getLanguageService().findRenameLocations(file, position, args.findInStrings, args.findInComments), 
                    /*comparer*/ undefined, renameLocationIsEqualTo);
                }
                function renameLocationIsEqualTo(a, b) {
                    if (a === b) {
                        return true;
                    }
                    if (!a || !b) {
                        return false;
                    }
                    return a.fileName === b.fileName &&
                        a.textSpan.start === b.textSpan.start &&
                        a.textSpan.length === b.textSpan.length;
                }
                function compareRenameLocation(a, b) {
                    if (a.file < b.file) {
                        return -1;
                    }
                    else if (a.file > b.file) {
                        return 1;
                    }
                    else {
                        // reverse sort assuming no overlap
                        if (a.start.line < b.start.line) {
                            return 1;
                        }
                        else if (a.start.line > b.start.line) {
                            return -1;
                        }
                        else {
                            return b.start.offset - a.start.offset;
                        }
                    }
                }
            }
            getReferences(args, simplifiedResult) {
                const file = server.toNormalizedPath(args.file);
                const projects = this.getProjects(args);
                const defaultProject = this.getDefaultProject(args);
                const scriptInfo = this.projectService.getScriptInfoForNormalizedPath(file);
                const position = this.getPosition(args, scriptInfo);
                if (simplifiedResult) {
                    const nameInfo = defaultProject.getLanguageService().getQuickInfoAtPosition(file, position);
                    if (!nameInfo) {
                        return undefined;
                    }
                    const displayString = ts.displayPartsToString(nameInfo.displayParts);
                    const nameSpan = nameInfo.textSpan;
                    const nameColStart = scriptInfo.positionToLineOffset(nameSpan.start).offset;
                    const nameText = scriptInfo.getSnapshot().getText(nameSpan.start, ts.textSpanEnd(nameSpan));
                    const refs = combineProjectOutput(file, path => this.projectService.getScriptInfoForPath(path).fileName, projects, (project, file) => {
                        const references = project.getLanguageService().getReferencesAtPosition(file, position);
                        if (!references) {
                            return server.emptyArray;
                        }
                        return references.map(ref => {
                            const refScriptInfo = project.getScriptInfo(ref.fileName);
                            const start = refScriptInfo.positionToLineOffset(ref.textSpan.start);
                            const refLineSpan = refScriptInfo.lineToTextSpan(start.line - 1);
                            const lineText = refScriptInfo.getSnapshot().getText(refLineSpan.start, ts.textSpanEnd(refLineSpan)).replace(/\r|\n/g, "");
                            return {
                                file: ref.fileName,
                                start,
                                lineText,
                                end: refScriptInfo.positionToLineOffset(ts.textSpanEnd(ref.textSpan)),
                                isWriteAccess: ref.isWriteAccess,
                                isDefinition: ref.isDefinition
                            };
                        });
                    }, compareFileStart, areReferencesResponseItemsForTheSameLocation);
                    return {
                        refs,
                        symbolName: nameText,
                        symbolStartOffset: nameColStart,
                        symbolDisplayString: displayString
                    };
                }
                else {
                    return combineProjectOutput(file, path => this.projectService.getScriptInfoForPath(path).fileName, projects, (project, file) => project.getLanguageService().findReferences(file, position), 
                    /*comparer*/ undefined, ts.equateValues);
                }
                function areReferencesResponseItemsForTheSameLocation(a, b) {
                    if (a && b) {
                        return a.file === b.file &&
                            a.start === b.start &&
                            a.end === b.end;
                    }
                    return false;
                }
            }
            /**
             * @param fileName is the name of the file to be opened
             * @param fileContent is a version of the file content that is known to be more up to date than the one on disk
             */
            openClientFile(fileName, fileContent, scriptKind, projectRootPath) {
                this.projectService.openClientFileWithNormalizedPath(fileName, fileContent, scriptKind, /*hasMixedContent*/ false, projectRootPath);
            }
            getPosition(args, scriptInfo) {
                return args.position !== undefined ? args.position : scriptInfo.lineOffsetToPosition(args.line, args.offset);
            }
            getPositionInFile(args, file) {
                const scriptInfo = this.projectService.getScriptInfoForNormalizedPath(file);
                return this.getPosition(args, scriptInfo);
            }
            getFileAndProject(args) {
                return this.getFileAndProjectWorker(args.file, args.projectFileName);
            }
            getFileAndLanguageServiceForSyntacticOperation(args) {
                // Since this is syntactic operation, there should always be project for the file
                // we wouldnt have to ensure project but rather throw if we dont get project
                const file = server.toNormalizedPath(args.file);
                const project = this.getProject(args.projectFileName) || this.projectService.getDefaultProjectForFile(file, /*ensureProject*/ false);
                if (!project) {
                    return server.Errors.ThrowNoProject();
                }
                return {
                    file,
                    languageService: project.getLanguageService(/*ensureSynchronized*/ false)
                };
            }
            getFileAndProjectWorker(uncheckedFileName, projectFileName) {
                const file = server.toNormalizedPath(uncheckedFileName);
                const project = this.getProject(projectFileName) || this.projectService.getDefaultProjectForFile(file, /*ensureProject*/ true);
                return { file, project };
            }
            getOutliningSpans(args, simplifiedResult) {
                const { file, languageService } = this.getFileAndLanguageServiceForSyntacticOperation(args);
                const spans = languageService.getOutliningSpans(file);
                if (simplifiedResult) {
                    const scriptInfo = this.projectService.getScriptInfoForNormalizedPath(file);
                    return spans.map(s => ({
                        textSpan: this.toLocationTextSpan(s.textSpan, scriptInfo),
                        hintSpan: this.toLocationTextSpan(s.hintSpan, scriptInfo),
                        bannerText: s.bannerText,
                        autoCollapse: s.autoCollapse
                    }));
                }
                else {
                    return spans;
                }
            }
            getTodoComments(args) {
                const { file, project } = this.getFileAndProject(args);
                return project.getLanguageService().getTodoComments(file, args.descriptors);
            }
            getDocCommentTemplate(args) {
                const { file, languageService } = this.getFileAndLanguageServiceForSyntacticOperation(args);
                const position = this.getPositionInFile(args, file);
                return languageService.getDocCommentTemplateAtPosition(file, position);
            }
            getSpanOfEnclosingComment(args) {
                const { file, languageService } = this.getFileAndLanguageServiceForSyntacticOperation(args);
                const onlyMultiLine = args.onlyMultiLine;
                const position = this.getPositionInFile(args, file);
                return languageService.getSpanOfEnclosingComment(file, position, onlyMultiLine);
            }
            getIndentation(args) {
                const { file, languageService } = this.getFileAndLanguageServiceForSyntacticOperation(args);
                const position = this.getPositionInFile(args, file);
                const options = args.options ? server.convertFormatOptions(args.options) : this.getFormatOptions(file);
                const indentation = languageService.getIndentationAtPosition(file, position, options);
                return { position, indentation };
            }
            getBreakpointStatement(args) {
                const { file, languageService } = this.getFileAndLanguageServiceForSyntacticOperation(args);
                const position = this.getPositionInFile(args, file);
                return languageService.getBreakpointStatementAtPosition(file, position);
            }
            getNameOrDottedNameSpan(args) {
                const { file, languageService } = this.getFileAndLanguageServiceForSyntacticOperation(args);
                const position = this.getPositionInFile(args, file);
                return languageService.getNameOrDottedNameSpan(file, position, position);
            }
            isValidBraceCompletion(args) {
                const { file, languageService } = this.getFileAndLanguageServiceForSyntacticOperation(args);
                const position = this.getPositionInFile(args, file);
                return languageService.isValidBraceCompletionAtPosition(file, position, args.openingBrace.charCodeAt(0));
            }
            getQuickInfoWorker(args, simplifiedResult) {
                const { file, project } = this.getFileAndProject(args);
                const scriptInfo = this.projectService.getScriptInfoForNormalizedPath(file);
                const quickInfo = project.getLanguageService().getQuickInfoAtPosition(file, this.getPosition(args, scriptInfo));
                if (!quickInfo) {
                    return undefined;
                }
                if (simplifiedResult) {
                    const displayString = ts.displayPartsToString(quickInfo.displayParts);
                    const docString = ts.displayPartsToString(quickInfo.documentation);
                    return {
                        kind: quickInfo.kind,
                        kindModifiers: quickInfo.kindModifiers,
                        start: scriptInfo.positionToLineOffset(quickInfo.textSpan.start),
                        end: scriptInfo.positionToLineOffset(ts.textSpanEnd(quickInfo.textSpan)),
                        displayString,
                        documentation: docString,
                        tags: quickInfo.tags || []
                    };
                }
                else {
                    return quickInfo;
                }
            }
            getFormattingEditsForRange(args) {
                const { file, languageService } = this.getFileAndLanguageServiceForSyntacticOperation(args);
                const scriptInfo = this.projectService.getScriptInfoForNormalizedPath(file);
                const startPosition = scriptInfo.lineOffsetToPosition(args.line, args.offset);
                const endPosition = scriptInfo.lineOffsetToPosition(args.endLine, args.endOffset);
                // TODO: avoid duplicate code (with formatonkey)
                const edits = languageService.getFormattingEditsForRange(file, startPosition, endPosition, this.getFormatOptions(file));
                if (!edits) {
                    return undefined;
                }
                return edits.map(edit => this.convertTextChangeToCodeEdit(edit, scriptInfo));
            }
            getFormattingEditsForRangeFull(args) {
                const { file, languageService } = this.getFileAndLanguageServiceForSyntacticOperation(args);
                const options = args.options ? server.convertFormatOptions(args.options) : this.getFormatOptions(file);
                return languageService.getFormattingEditsForRange(file, args.position, args.endPosition, options);
            }
            getFormattingEditsForDocumentFull(args) {
                const { file, languageService } = this.getFileAndLanguageServiceForSyntacticOperation(args);
                const options = args.options ? server.convertFormatOptions(args.options) : this.getFormatOptions(file);
                return languageService.getFormattingEditsForDocument(file, options);
            }
            getFormattingEditsAfterKeystrokeFull(args) {
                const { file, languageService } = this.getFileAndLanguageServiceForSyntacticOperation(args);
                const options = args.options ? server.convertFormatOptions(args.options) : this.getFormatOptions(file);
                return languageService.getFormattingEditsAfterKeystroke(file, args.position, args.key, options);
            }
            getFormattingEditsAfterKeystroke(args) {
                const { file, languageService } = this.getFileAndLanguageServiceForSyntacticOperation(args);
                const scriptInfo = this.projectService.getScriptInfoForNormalizedPath(file);
                const position = scriptInfo.lineOffsetToPosition(args.line, args.offset);
                const formatOptions = this.getFormatOptions(file);
                const edits = languageService.getFormattingEditsAfterKeystroke(file, position, args.key, formatOptions);
                // Check whether we should auto-indent. This will be when
                // the position is on a line containing only whitespace.
                // This should leave the edits returned from
                // getFormattingEditsAfterKeystroke either empty or pertaining
                // only to the previous line.  If all this is true, then
                // add edits necessary to properly indent the current line.
                if ((args.key === "\n") && ((!edits) || (edits.length === 0) || allEditsBeforePos(edits, position))) {
                    const { lineText, absolutePosition } = scriptInfo.getLineInfo(args.line);
                    if (lineText && lineText.search("\\S") < 0) {
                        const preferredIndent = languageService.getIndentationAtPosition(file, position, formatOptions);
                        let hasIndent = 0;
                        let i, len;
                        for (i = 0, len = lineText.length; i < len; i++) {
                            if (lineText.charAt(i) === " ") {
                                hasIndent++;
                            }
                            else if (lineText.charAt(i) === "\t") {
                                hasIndent += formatOptions.tabSize;
                            }
                            else {
                                break;
                            }
                        }
                        // i points to the first non whitespace character
                        if (preferredIndent !== hasIndent) {
                            const firstNoWhiteSpacePosition = absolutePosition + i;
                            edits.push({
                                span: ts.createTextSpanFromBounds(absolutePosition, firstNoWhiteSpacePosition),
                                newText: ts.formatting.getIndentationString(preferredIndent, formatOptions)
                            });
                        }
                    }
                }
                if (!edits) {
                    return undefined;
                }
                return edits.map((edit) => {
                    return {
                        start: scriptInfo.positionToLineOffset(edit.span.start),
                        end: scriptInfo.positionToLineOffset(ts.textSpanEnd(edit.span)),
                        newText: edit.newText ? edit.newText : ""
                    };
                });
            }
            getCompletions(args, simplifiedResult) {
                const prefix = args.prefix || "";
                const { file, project } = this.getFileAndProject(args);
                const scriptInfo = this.projectService.getScriptInfoForNormalizedPath(file);
                const position = this.getPosition(args, scriptInfo);
                const completions = project.getLanguageService().getCompletionsAtPosition(file, position, Object.assign({}, this.getPreferences(file), { triggerCharacter: args.triggerCharacter, includeExternalModuleExports: args.includeExternalModuleExports, includeInsertTextCompletions: args.includeInsertTextCompletions }));
                if (simplifiedResult) {
                    return ts.mapDefined(completions && completions.entries, entry => {
                        if (completions.isMemberCompletion || ts.startsWith(entry.name.toLowerCase(), prefix.toLowerCase())) {
                            const { name, kind, kindModifiers, sortText, insertText, replacementSpan, hasAction, source, isRecommended } = entry;
                            const convertedSpan = replacementSpan ? this.toLocationTextSpan(replacementSpan, scriptInfo) : undefined;
                            // Use `hasAction || undefined` to avoid serializing `false`.
                            return { name, kind, kindModifiers, sortText, insertText, replacementSpan: convertedSpan, hasAction: hasAction || undefined, source, isRecommended };
                        }
                    }).sort((a, b) => ts.compareStringsCaseSensitiveUI(a.name, b.name));
                }
                else {
                    return completions;
                }
            }
            getCompletionEntryDetails(args, simplifiedResult) {
                const { file, project } = this.getFileAndProject(args);
                const scriptInfo = this.projectService.getScriptInfoForNormalizedPath(file);
                const position = this.getPosition(args, scriptInfo);
                const formattingOptions = project.projectService.getFormatCodeOptions(file);
                const result = ts.mapDefined(args.entryNames, entryName => {
                    const { name, source } = typeof entryName === "string" ? { name: entryName, source: undefined } : entryName;
                    return project.getLanguageService().getCompletionEntryDetails(file, position, name, formattingOptions, source, this.getPreferences(file));
                });
                return simplifiedResult
                    ? result.map(details => (Object.assign({}, details, { codeActions: ts.map(details.codeActions, action => this.mapCodeAction(project, action)) })))
                    : result;
            }
            getCompileOnSaveAffectedFileList(args) {
                const info = this.projectService.getScriptInfoEnsuringProjectsUptoDate(args.file);
                if (!info) {
                    return server.emptyArray;
                }
                // if specified a project, we only return affected file list in this project
                const projects = args.projectFileName ? [this.projectService.findProject(args.projectFileName)] : info.containingProjects;
                const symLinkedProjects = !args.projectFileName && this.projectService.getSymlinkedProjects(info);
                return combineProjectOutput(info, path => this.projectService.getScriptInfoForPath(path), symLinkedProjects ? { projects, symLinkedProjects } : projects, (project, info) => {
                    let result;
                    if (project.compileOnSaveEnabled && project.languageServiceEnabled && !project.getCompilationSettings().noEmit) {
                        result = {
                            projectFileName: project.getProjectName(),
                            fileNames: project.getCompileOnSaveAffectedFileList(info),
                            projectUsesOutFile: !!project.getCompilationSettings().outFile || !!project.getCompilationSettings().out
                        };
                    }
                    return result;
                });
            }
            emitFile(args) {
                const { file, project } = this.getFileAndProject(args);
                if (!project) {
                    server.Errors.ThrowNoProject();
                }
                if (!project.languageServiceEnabled) {
                    return false;
                }
                const scriptInfo = project.getScriptInfo(file);
                return project.emitFile(scriptInfo, (path, data, writeByteOrderMark) => this.host.writeFile(path, data, writeByteOrderMark));
            }
            getSignatureHelpItems(args, simplifiedResult) {
                const { file, project } = this.getFileAndProject(args);
                const scriptInfo = this.projectService.getScriptInfoForNormalizedPath(file);
                const position = this.getPosition(args, scriptInfo);
                const helpItems = project.getLanguageService().getSignatureHelpItems(file, position);
                if (!helpItems) {
                    return undefined;
                }
                if (simplifiedResult) {
                    const span = helpItems.applicableSpan;
                    return {
                        items: helpItems.items,
                        applicableSpan: {
                            start: scriptInfo.positionToLineOffset(span.start),
                            end: scriptInfo.positionToLineOffset(span.start + span.length)
                        },
                        selectedItemIndex: helpItems.selectedItemIndex,
                        argumentIndex: helpItems.argumentIndex,
                        argumentCount: helpItems.argumentCount,
                    };
                }
                else {
                    return helpItems;
                }
            }
            createCheckList(fileNames, defaultProject) {
                return ts.mapDefined(fileNames, uncheckedFileName => {
                    const fileName = server.toNormalizedPath(uncheckedFileName);
                    const project = defaultProject || this.projectService.getDefaultProjectForFile(fileName, /*ensureProject*/ false);
                    return project && { fileName, project };
                });
            }
            getDiagnostics(next, delay, fileNames) {
                if (this.suppressDiagnosticEvents) {
                    return;
                }
                const checkList = this.createCheckList(fileNames);
                if (checkList.length > 0) {
                    this.updateErrorCheck(next, checkList, delay);
                }
            }
            change(args) {
                const scriptInfo = this.projectService.getScriptInfo(args.file);
                ts.Debug.assert(!!scriptInfo);
                const start = scriptInfo.lineOffsetToPosition(args.line, args.offset);
                const end = scriptInfo.lineOffsetToPosition(args.endLine, args.endOffset);
                if (start >= 0) {
                    this.changeSeq++;
                    this.projectService.applyChangesToFile(scriptInfo, [{
                            span: { start, length: end - start },
                            newText: args.insertString
                        }]);
                }
            }
            reload(args, reqSeq) {
                const file = server.toNormalizedPath(args.file);
                const tempFileName = args.tmpfile && server.toNormalizedPath(args.tmpfile);
                const info = this.projectService.getScriptInfoForNormalizedPath(file);
                if (info) {
                    this.changeSeq++;
                    // make sure no changes happen before this one is finished
                    if (info.reloadFromFile(tempFileName)) {
                        this.doOutput(/*info*/ undefined, server.CommandNames.Reload, reqSeq, /*success*/ true);
                    }
                }
            }
            saveToTmp(fileName, tempFileName) {
                const scriptInfo = this.projectService.getScriptInfo(fileName);
                if (scriptInfo) {
                    scriptInfo.saveTo(tempFileName);
                }
            }
            closeClientFile(fileName) {
                if (!fileName) {
                    return;
                }
                const file = ts.normalizePath(fileName);
                this.projectService.closeClientFile(file);
            }
            mapLocationNavigationBarItems(items, scriptInfo) {
                return ts.map(items, item => ({
                    text: item.text,
                    kind: item.kind,
                    kindModifiers: item.kindModifiers,
                    spans: item.spans.map(span => this.toLocationTextSpan(span, scriptInfo)),
                    childItems: this.mapLocationNavigationBarItems(item.childItems, scriptInfo),
                    indent: item.indent
                }));
            }
            getNavigationBarItems(args, simplifiedResult) {
                const { file, languageService } = this.getFileAndLanguageServiceForSyntacticOperation(args);
                const items = languageService.getNavigationBarItems(file);
                return !items
                    ? undefined
                    : simplifiedResult
                        ? this.mapLocationNavigationBarItems(items, this.projectService.getScriptInfoForNormalizedPath(file))
                        : items;
            }
            toLocationNavigationTree(tree, scriptInfo) {
                return {
                    text: tree.text,
                    kind: tree.kind,
                    kindModifiers: tree.kindModifiers,
                    spans: tree.spans.map(span => this.toLocationTextSpan(span, scriptInfo)),
                    childItems: ts.map(tree.childItems, item => this.toLocationNavigationTree(item, scriptInfo))
                };
            }
            toLocationTextSpan(span, scriptInfo) {
                return {
                    start: scriptInfo.positionToLineOffset(span.start),
                    end: scriptInfo.positionToLineOffset(ts.textSpanEnd(span))
                };
            }
            getNavigationTree(args, simplifiedResult) {
                const { file, languageService } = this.getFileAndLanguageServiceForSyntacticOperation(args);
                const tree = languageService.getNavigationTree(file);
                return !tree
                    ? undefined
                    : simplifiedResult
                        ? this.toLocationNavigationTree(tree, this.projectService.getScriptInfoForNormalizedPath(file))
                        : tree;
            }
            getNavigateToItems(args, simplifiedResult) {
                const projects = this.getProjects(args);
                const fileName = args.currentFileOnly ? args.file && ts.normalizeSlashes(args.file) : undefined;
                if (simplifiedResult) {
                    return combineProjectOutput(fileName, () => undefined, projects, (project, file) => {
                        if (fileName && !file) {
                            return undefined;
                        }
                        const navItems = project.getLanguageService().getNavigateToItems(args.searchValue, args.maxResultCount, fileName, /*excludeDts*/ project.isNonTsProject());
                        if (!navItems) {
                            return server.emptyArray;
                        }
                        return navItems.map((navItem) => {
                            const scriptInfo = project.getScriptInfo(navItem.fileName);
                            const bakedItem = {
                                name: navItem.name,
                                kind: navItem.kind,
                                file: navItem.fileName,
                                start: scriptInfo.positionToLineOffset(navItem.textSpan.start),
                                end: scriptInfo.positionToLineOffset(ts.textSpanEnd(navItem.textSpan))
                            };
                            if (navItem.kindModifiers && (navItem.kindModifiers !== "")) {
                                bakedItem.kindModifiers = navItem.kindModifiers;
                            }
                            if (navItem.matchKind !== "none") {
                                bakedItem.matchKind = navItem.matchKind;
                            }
                            if (navItem.containerName && (navItem.containerName.length > 0)) {
                                bakedItem.containerName = navItem.containerName;
                            }
                            if (navItem.containerKind && (navItem.containerKind.length > 0)) {
                                bakedItem.containerKind = navItem.containerKind;
                            }
                            return bakedItem;
                        });
                    }, 
                    /*comparer*/ undefined, areNavToItemsForTheSameLocation);
                }
                else {
                    return combineProjectOutput(fileName, () => undefined, projects, (project, file) => {
                        if (fileName && !file) {
                            return undefined;
                        }
                        return project.getLanguageService().getNavigateToItems(args.searchValue, args.maxResultCount, fileName, /*excludeDts*/ project.isNonTsProject());
                    }, 
                    /*comparer*/ undefined, navigateToItemIsEqualTo);
                }
                function navigateToItemIsEqualTo(a, b) {
                    if (a === b) {
                        return true;
                    }
                    if (!a || !b) {
                        return false;
                    }
                    return a.containerKind === b.containerKind &&
                        a.containerName === b.containerName &&
                        a.fileName === b.fileName &&
                        a.isCaseSensitive === b.isCaseSensitive &&
                        a.kind === b.kind &&
                        a.kindModifiers === b.containerName &&
                        a.matchKind === b.matchKind &&
                        a.name === b.name &&
                        a.textSpan.start === b.textSpan.start &&
                        a.textSpan.length === b.textSpan.length;
                }
                function areNavToItemsForTheSameLocation(a, b) {
                    if (a && b) {
                        return a.file === b.file &&
                            a.start === b.start &&
                            a.end === b.end;
                    }
                    return false;
                }
            }
            getSupportedCodeFixes() {
                return ts.getSupportedCodeFixes();
            }
            isLocation(locationOrSpan) {
                return locationOrSpan.line !== undefined;
            }
            extractPositionAndRange(args, scriptInfo) {
                let position;
                let textRange;
                if (this.isLocation(args)) {
                    position = getPosition(args);
                }
                else {
                    const { startPosition, endPosition } = this.getStartAndEndPosition(args, scriptInfo);
                    textRange = { pos: startPosition, end: endPosition };
                }
                return { position, textRange };
                function getPosition(loc) {
                    return loc.position !== undefined ? loc.position : scriptInfo.lineOffsetToPosition(loc.line, loc.offset);
                }
            }
            getApplicableRefactors(args) {
                const { file, project } = this.getFileAndProject(args);
                const scriptInfo = project.getScriptInfoForNormalizedPath(file);
                const { position, textRange } = this.extractPositionAndRange(args, scriptInfo);
                return project.getLanguageService().getApplicableRefactors(file, position || textRange, this.getPreferences(file));
            }
            getEditsForRefactor(args, simplifiedResult) {
                const { file, project } = this.getFileAndProject(args);
                const scriptInfo = project.getScriptInfoForNormalizedPath(file);
                const { position, textRange } = this.extractPositionAndRange(args, scriptInfo);
                const result = project.getLanguageService().getEditsForRefactor(file, this.getFormatOptions(file), position || textRange, args.refactor, args.action, this.getPreferences(file));
                if (result === undefined) {
                    return {
                        edits: []
                    };
                }
                if (simplifiedResult) {
                    const { renameFilename, renameLocation, edits } = result;
                    let mappedRenameLocation;
                    if (renameFilename !== undefined && renameLocation !== undefined) {
                        const renameScriptInfo = project.getScriptInfoForNormalizedPath(server.toNormalizedPath(renameFilename));
                        mappedRenameLocation = getLocationInNewDocument(ts.getSnapshotText(renameScriptInfo.getSnapshot()), renameFilename, renameLocation, edits);
                    }
                    return { renameLocation: mappedRenameLocation, renameFilename, edits: this.mapTextChangesToCodeEdits(project, edits) };
                }
                else {
                    return result;
                }
            }
            organizeImports({ scope }, simplifiedResult) {
                ts.Debug.assert(scope.type === "file");
                const { file, project } = this.getFileAndProject(scope.args);
                const changes = project.getLanguageService().organizeImports({ type: "file", fileName: file }, this.getFormatOptions(file), this.getPreferences(file));
                if (simplifiedResult) {
                    return this.mapTextChangesToCodeEdits(project, changes);
                }
                else {
                    return changes;
                }
            }
            getEditsForFileRename(args, simplifiedResult) {
                const { file, project } = this.getFileAndProject(args);
                const changes = project.getLanguageService().getEditsForFileRename(args.oldFilePath, args.newFilePath, this.getFormatOptions(file));
                return simplifiedResult ? this.mapTextChangesToCodeEdits(project, changes) : changes;
            }
            getCodeFixes(args, simplifiedResult) {
                if (args.errorCodes.length === 0) {
                    return undefined;
                }
                const { file, project } = this.getFileAndProject(args);
                const scriptInfo = project.getScriptInfoForNormalizedPath(file);
                const { startPosition, endPosition } = this.getStartAndEndPosition(args, scriptInfo);
                const codeActions = project.getLanguageService().getCodeFixesAtPosition(file, startPosition, endPosition, args.errorCodes, this.getFormatOptions(file), this.getPreferences(file));
                return simplifiedResult ? codeActions.map(codeAction => this.mapCodeFixAction(project, codeAction)) : codeActions;
            }
            getCombinedCodeFix({ scope, fixId }, simplifiedResult) {
                ts.Debug.assert(scope.type === "file");
                const { file, project } = this.getFileAndProject(scope.args);
                const res = project.getLanguageService().getCombinedCodeFix({ type: "file", fileName: file }, fixId, this.getFormatOptions(file), this.getPreferences(file));
                if (simplifiedResult) {
                    return { changes: this.mapTextChangesToCodeEdits(project, res.changes), commands: res.commands };
                }
                else {
                    return res;
                }
            }
            applyCodeActionCommand(args) {
                const commands = args.command; // They should be sending back the command we sent them.
                for (const command of ts.toArray(commands)) {
                    const { project } = this.getFileAndProject(command);
                    project.getLanguageService().applyCodeActionCommand(command).then(_result => { }, _error => { });
                }
                return {};
            }
            getStartAndEndPosition(args, scriptInfo) {
                let startPosition, endPosition;
                if (args.startPosition !== undefined) {
                    startPosition = args.startPosition;
                }
                else {
                    startPosition = scriptInfo.lineOffsetToPosition(args.startLine, args.startOffset);
                    // save the result so we don't always recompute
                    args.startPosition = startPosition;
                }
                if (args.endPosition !== undefined) {
                    endPosition = args.endPosition;
                }
                else {
                    endPosition = scriptInfo.lineOffsetToPosition(args.endLine, args.endOffset);
                    args.endPosition = endPosition;
                }
                return { startPosition, endPosition };
            }
            mapCodeAction(project, { description, changes, commands }) {
                return { description, changes: this.mapTextChangesToCodeEdits(project, changes), commands };
            }
            mapCodeFixAction(project, { fixName, description, changes, commands, fixId, fixAllDescription }) {
                return { fixName, description, changes: this.mapTextChangesToCodeEdits(project, changes), commands, fixId, fixAllDescription };
            }
            mapTextChangesToCodeEdits(project, textChanges) {
                return textChanges.map(change => this.mapTextChangesToCodeEditsUsingScriptinfo(change, project.getScriptInfoForNormalizedPath(server.toNormalizedPath(change.fileName))));
            }
            mapTextChangesToCodeEditsUsingScriptinfo(textChanges, scriptInfo) {
                return {
                    fileName: textChanges.fileName,
                    textChanges: textChanges.textChanges.map(textChange => this.convertTextChangeToCodeEdit(textChange, scriptInfo))
                };
            }
            convertTextChangeToCodeEdit(change, scriptInfo) {
                return {
                    start: scriptInfo.positionToLineOffset(change.span.start),
                    end: scriptInfo.positionToLineOffset(change.span.start + change.span.length),
                    newText: change.newText ? change.newText : ""
                };
            }
            getBraceMatching(args, simplifiedResult) {
                const { file, languageService } = this.getFileAndLanguageServiceForSyntacticOperation(args);
                const scriptInfo = this.projectService.getScriptInfoForNormalizedPath(file);
                const position = this.getPosition(args, scriptInfo);
                const spans = languageService.getBraceMatchingAtPosition(file, position);
                return !spans
                    ? undefined
                    : simplifiedResult
                        ? spans.map(span => this.toLocationTextSpan(span, scriptInfo))
                        : spans;
            }
            getDiagnosticsForProject(next, delay, fileName) {
                if (this.suppressDiagnosticEvents) {
                    return;
                }
                const { fileNames, languageServiceDisabled } = this.getProjectInfoWorker(fileName, /*projectFileName*/ undefined, /*needFileNameList*/ true, /*excludeConfigFiles*/ true);
                if (languageServiceDisabled) {
                    return;
                }
                // No need to analyze lib.d.ts
                const fileNamesInProject = fileNames.filter(value => !ts.stringContains(value, "lib.d.ts"));
                if (fileNamesInProject.length === 0) {
                    return;
                }
                // Sort the file name list to make the recently touched files come first
                const highPriorityFiles = [];
                const mediumPriorityFiles = [];
                const lowPriorityFiles = [];
                const veryLowPriorityFiles = [];
                const normalizedFileName = server.toNormalizedPath(fileName);
                const project = this.projectService.getDefaultProjectForFile(normalizedFileName, /*ensureProject*/ true);
                for (const fileNameInProject of fileNamesInProject) {
                    if (this.getCanonicalFileName(fileNameInProject) === this.getCanonicalFileName(fileName)) {
                        highPriorityFiles.push(fileNameInProject);
                    }
                    else {
                        const info = this.projectService.getScriptInfo(fileNameInProject);
                        if (!info.isScriptOpen()) {
                            if (ts.fileExtensionIs(fileNameInProject, ts.Extension.Dts)) {
                                veryLowPriorityFiles.push(fileNameInProject);
                            }
                            else {
                                lowPriorityFiles.push(fileNameInProject);
                            }
                        }
                        else {
                            mediumPriorityFiles.push(fileNameInProject);
                        }
                    }
                }
                const sortedFiles = [...highPriorityFiles, ...mediumPriorityFiles, ...lowPriorityFiles, ...veryLowPriorityFiles];
                const checkList = sortedFiles.map(fileName => ({ fileName, project }));
                // Project level error analysis runs on background files too, therefore
                // doesn't require the file to be opened
                this.updateErrorCheck(next, checkList, delay, /*requireOpen*/ false);
            }
            getCanonicalFileName(fileName) {
                const name = this.host.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase();
                return ts.normalizePath(name);
            }
            exit() { }
            notRequired() {
                return { responseRequired: false };
            }
            requiredResponse(response) {
                return { response, responseRequired: true };
            }
            addProtocolHandler(command, handler) {
                if (this.handlers.has(command)) {
                    throw new Error(`Protocol handler already exists for command "${command}"`);
                }
                this.handlers.set(command, handler);
            }
            setCurrentRequest(requestId) {
                ts.Debug.assert(this.currentRequestId === undefined);
                this.currentRequestId = requestId;
                this.cancellationToken.setRequest(requestId);
            }
            resetCurrentRequest(requestId) {
                ts.Debug.assert(this.currentRequestId === requestId);
                this.currentRequestId = undefined;
                this.cancellationToken.resetRequest(requestId);
            }
            executeWithRequestId(requestId, f) {
                try {
                    this.setCurrentRequest(requestId);
                    return f();
                }
                finally {
                    this.resetCurrentRequest(requestId);
                }
            }
            executeCommand(request) {
                const handler = this.handlers.get(request.command);
                if (handler) {
                    return this.executeWithRequestId(request.seq, () => handler(request));
                }
                else {
                    this.logger.msg(`Unrecognized JSON command:${server.stringifyIndented(request)}`, server.Msg.Err);
                    this.doOutput(/*info*/ undefined, server.CommandNames.Unknown, request.seq, /*success*/ false, `Unrecognized JSON command: ${request.command}`);
                    return { responseRequired: false };
                }
            }
            onMessage(message) {
                this.gcTimer.scheduleCollect();
                let start;
                if (this.logger.hasLevel(server.LogLevel.requestTime)) {
                    start = this.hrtime();
                    if (this.logger.hasLevel(server.LogLevel.verbose)) {
                        this.logger.info(`request:${server.indent(message)}`);
                    }
                }
                let request;
                try {
                    request = JSON.parse(message);
                    const { response, responseRequired } = this.executeCommand(request);
                    if (this.logger.hasLevel(server.LogLevel.requestTime)) {
                        const elapsedTime = hrTimeToMilliseconds(this.hrtime(start)).toFixed(4);
                        if (responseRequired) {
                            this.logger.perftrc(`${request.seq}::${request.command}: elapsed time (in milliseconds) ${elapsedTime}`);
                        }
                        else {
                            this.logger.perftrc(`${request.seq}::${request.command}: async elapsed time (in milliseconds) ${elapsedTime}`);
                        }
                    }
                    if (response) {
                        this.doOutput(response, request.command, request.seq, /*success*/ true);
                    }
                    else if (responseRequired) {
                        this.doOutput(/*info*/ undefined, request.command, request.seq, /*success*/ false, "No content available.");
                    }
                }
                catch (err) {
                    if (err instanceof ts.OperationCanceledException) {
                        // Handle cancellation exceptions
                        this.doOutput({ canceled: true }, request.command, request.seq, /*success*/ true);
                        return;
                    }
                    this.logError(err, message);
                    this.doOutput(
                    /*info*/ undefined, request ? request.command : server.CommandNames.Unknown, request ? request.seq : 0, 
                    /*success*/ false, "Error processing request. " + err.message + "\n" + err.stack);
                }
            }
            getFormatOptions(file) {
                return this.projectService.getFormatCodeOptions(file);
            }
            getPreferences(file) {
                return this.projectService.getPreferences(file);
            }
        }
        server.Session = Session;
        /* @internal */ // Exported only for tests
        function getLocationInNewDocument(oldText, renameFilename, renameLocation, edits) {
            const newText = applyEdits(oldText, renameFilename, edits);
            const { line, character } = ts.computeLineAndCharacterOfPosition(ts.computeLineStarts(newText), renameLocation);
            return { line: line + 1, offset: character + 1 };
        }
        server.getLocationInNewDocument = getLocationInNewDocument;
        function applyEdits(text, textFilename, edits) {
            for (const { fileName, textChanges } of edits) {
                if (fileName !== textFilename) {
                    continue;
                }
                for (let i = textChanges.length - 1; i >= 0; i--) {
                    const { newText, span: { start, length } } = textChanges[i];
                    text = text.slice(0, start) + newText + text.slice(start + length);
                }
            }
            return text;
        }
    })(server = ts.server || (ts.server = {}));
})(ts || (ts = {}));
