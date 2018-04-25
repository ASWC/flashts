/// <reference path="..\harness.ts" />
const expect = _chai.expect;
var ts;
(function (ts) {
    var server;
    (function (server) {
        let lastWrittenToHost;
        const noopFileWatcher = { close: ts.noop };
        const mockHost = {
            args: [],
            newLine: "\n",
            useCaseSensitiveFileNames: true,
            write(s) { lastWrittenToHost = s; },
            readFile: () => undefined,
            writeFile: ts.noop,
            resolvePath() { return void 0; },
            fileExists: () => false,
            directoryExists: () => false,
            getDirectories: () => [],
            createDirectory: ts.noop,
            getExecutingFilePath() { return ""; },
            getCurrentDirectory() { return ""; },
            getEnvironmentVariable() { return ""; },
            readDirectory() { return []; },
            exit: ts.noop,
            setTimeout() { return 0; },
            clearTimeout: ts.noop,
            setImmediate: () => 0,
            clearImmediate: ts.noop,
            createHash: Harness.mockHash,
            watchFile: () => noopFileWatcher,
            watchDirectory: () => noopFileWatcher
        };
        class TestSession extends server.Session {
            getProjectService() {
                return this.projectService;
            }
        }
        describe("the Session class", () => {
            let session;
            let lastSent;
            function createSession() {
                const opts = {
                    host: mockHost,
                    cancellationToken: server.nullCancellationToken,
                    useSingleInferredProject: false,
                    useInferredProjectPerProjectRoot: false,
                    typingsInstaller: undefined,
                    byteLength: Utils.byteLength,
                    hrtime: process.hrtime,
                    logger: ts.projectSystem.nullLogger,
                    canUseEvents: true
                };
                return new TestSession(opts);
            }
            // Disable sourcemap support for the duration of the test, as sourcemapping the errors generated during this test is slow and not something we care to test
            let oldPrepare;
            before(() => {
                oldPrepare = Error.prepareStackTrace;
                delete Error.prepareStackTrace;
            });
            after(() => {
                Error.prepareStackTrace = oldPrepare;
            });
            beforeEach(() => {
                session = createSession();
                session.send = (msg) => {
                    lastSent = msg;
                };
            });
            describe("executeCommand", () => {
                it("should throw when commands are executed with invalid arguments", () => {
                    const req = {
                        command: server.CommandNames.Open,
                        seq: 0,
                        type: "request",
                        arguments: {
                            file: undefined
                        }
                    };
                    expect(() => session.executeCommand(req)).to.throw();
                });
                it("should output an error response when a command does not exist", () => {
                    const req = {
                        command: "foobar",
                        seq: 0,
                        type: "request"
                    };
                    session.executeCommand(req);
                    const expected = {
                        command: server.CommandNames.Unknown,
                        type: "response",
                        seq: 0,
                        message: "Unrecognized JSON command: foobar",
                        request_seq: 0,
                        success: false
                    };
                    expect(lastSent).to.deep.equal(expected);
                });
                it("should return a tuple containing the response and if a response is required on success", () => {
                    const req = {
                        command: server.CommandNames.Configure,
                        seq: 0,
                        type: "request",
                        arguments: {
                            hostInfo: "unit test",
                            formatOptions: {
                                newLineCharacter: "`n"
                            }
                        }
                    };
                    expect(session.executeCommand(req)).to.deep.equal({
                        responseRequired: false
                    });
                    expect(lastSent).to.deep.equal({
                        command: server.CommandNames.Configure,
                        type: "response",
                        success: true,
                        request_seq: 0,
                        seq: 0,
                        body: undefined
                    });
                });
                it("should handle literal types in request", () => {
                    const configureRequest = {
                        command: server.CommandNames.Configure,
                        seq: 0,
                        type: "request",
                        arguments: {
                            formatOptions: {
                                indentStyle: "Block" /* Block */,
                            }
                        }
                    };
                    session.onMessage(JSON.stringify(configureRequest));
                    assert.equal(session.getProjectService().getFormatCodeOptions("").indentStyle, ts.IndentStyle.Block);
                    const setOptionsRequest = {
                        command: server.CommandNames.CompilerOptionsForInferredProjects,
                        seq: 1,
                        type: "request",
                        arguments: {
                            options: {
                                module: "System" /* System */,
                                target: "ES5" /* ES5 */,
                                jsx: "React" /* React */,
                                newLine: "Lf" /* Lf */,
                                moduleResolution: "Node" /* Node */,
                            }
                        }
                    };
                    session.onMessage(JSON.stringify(setOptionsRequest));
                    assert.deepEqual(session.getProjectService().getCompilerOptionsForInferredProjects(), {
                        module: ts.ModuleKind.System,
                        target: ts.ScriptTarget.ES5,
                        jsx: ts.JsxEmit.React,
                        newLine: ts.NewLineKind.LineFeed,
                        moduleResolution: ts.ModuleResolutionKind.NodeJs,
                        allowNonTsExtensions: true // injected by tsserver
                    });
                });
                it("Status request gives ts.version", () => {
                    const req = {
                        command: server.CommandNames.Status,
                        seq: 0,
                        type: "request"
                    };
                    const expected = { version: ts.version };
                    assert.deepEqual(session.executeCommand(req).response, expected);
                });
            });
            describe("onMessage", () => {
                const allCommandNames = [
                    server.CommandNames.Brace,
                    server.CommandNames.BraceFull,
                    server.CommandNames.BraceCompletion,
                    server.CommandNames.Change,
                    server.CommandNames.Close,
                    server.CommandNames.Completions,
                    server.CommandNames.CompletionsFull,
                    server.CommandNames.CompletionDetails,
                    server.CommandNames.CompileOnSaveAffectedFileList,
                    server.CommandNames.Configure,
                    server.CommandNames.Definition,
                    server.CommandNames.DefinitionFull,
                    server.CommandNames.DefinitionAndBoundSpan,
                    server.CommandNames.DefinitionAndBoundSpanFull,
                    server.CommandNames.Implementation,
                    server.CommandNames.ImplementationFull,
                    server.CommandNames.Exit,
                    server.CommandNames.Format,
                    server.CommandNames.Formatonkey,
                    server.CommandNames.FormatFull,
                    server.CommandNames.FormatonkeyFull,
                    server.CommandNames.FormatRangeFull,
                    server.CommandNames.Geterr,
                    server.CommandNames.GeterrForProject,
                    server.CommandNames.SemanticDiagnosticsSync,
                    server.CommandNames.SyntacticDiagnosticsSync,
                    server.CommandNames.SuggestionDiagnosticsSync,
                    server.CommandNames.NavBar,
                    server.CommandNames.NavBarFull,
                    server.CommandNames.Navto,
                    server.CommandNames.NavtoFull,
                    server.CommandNames.NavTree,
                    server.CommandNames.NavTreeFull,
                    server.CommandNames.Occurrences,
                    server.CommandNames.DocumentHighlights,
                    server.CommandNames.DocumentHighlightsFull,
                    server.CommandNames.Open,
                    server.CommandNames.Quickinfo,
                    server.CommandNames.QuickinfoFull,
                    server.CommandNames.References,
                    server.CommandNames.ReferencesFull,
                    server.CommandNames.Reload,
                    server.CommandNames.Rename,
                    server.CommandNames.RenameInfoFull,
                    server.CommandNames.RenameLocationsFull,
                    server.CommandNames.Saveto,
                    server.CommandNames.SignatureHelp,
                    server.CommandNames.SignatureHelpFull,
                    server.CommandNames.Status,
                    server.CommandNames.TypeDefinition,
                    server.CommandNames.ProjectInfo,
                    server.CommandNames.ReloadProjects,
                    server.CommandNames.Unknown,
                    server.CommandNames.OpenExternalProject,
                    server.CommandNames.CloseExternalProject,
                    server.CommandNames.SynchronizeProjectList,
                    server.CommandNames.ApplyChangedToOpenFiles,
                    server.CommandNames.EncodedSemanticClassificationsFull,
                    server.CommandNames.Cleanup,
                    server.CommandNames.OutliningSpans,
                    server.CommandNames.TodoComments,
                    server.CommandNames.Indentation,
                    server.CommandNames.DocCommentTemplate,
                    server.CommandNames.CompilerOptionsDiagnosticsFull,
                    server.CommandNames.NameOrDottedNameSpan,
                    server.CommandNames.BreakpointStatement,
                    server.CommandNames.CompilerOptionsForInferredProjects,
                    server.CommandNames.GetCodeFixes,
                    server.CommandNames.GetCodeFixesFull,
                    server.CommandNames.GetSupportedCodeFixes,
                    server.CommandNames.GetApplicableRefactors,
                    server.CommandNames.GetEditsForRefactor,
                    server.CommandNames.GetEditsForRefactorFull,
                    server.CommandNames.OrganizeImports,
                    server.CommandNames.OrganizeImportsFull,
                    server.CommandNames.GetEditsForFileRename,
                    server.CommandNames.GetEditsForFileRenameFull,
                ];
                it("should not throw when commands are executed with invalid arguments", () => {
                    let i = 0;
                    for (const name of allCommandNames) {
                        const req = {
                            command: name,
                            seq: i,
                            type: "request"
                        };
                        i++;
                        session.onMessage(JSON.stringify(req));
                        req.seq = i;
                        i++;
                        req.arguments = {};
                        session.onMessage(JSON.stringify(req));
                        req.seq = i;
                        i++;
                        /* tslint:disable no-null-keyword */
                        req.arguments = null;
                        /* tslint:enable no-null-keyword */
                        session.onMessage(JSON.stringify(req));
                        req.seq = i;
                        i++;
                        req.arguments = "";
                        session.onMessage(JSON.stringify(req));
                        req.seq = i;
                        i++;
                        req.arguments = 0;
                        session.onMessage(JSON.stringify(req));
                        req.seq = i;
                        i++;
                        req.arguments = [];
                        session.onMessage(JSON.stringify(req));
                    }
                    session.onMessage("GARBAGE NON_JSON DATA");
                });
                it("should output the response for a correctly handled message", () => {
                    const req = {
                        command: server.CommandNames.Configure,
                        seq: 0,
                        type: "request",
                        arguments: {
                            hostInfo: "unit test",
                            formatOptions: {
                                newLineCharacter: "`n"
                            }
                        }
                    };
                    session.onMessage(JSON.stringify(req));
                    expect(lastSent).to.deep.equal({
                        command: server.CommandNames.Configure,
                        type: "response",
                        success: true,
                        request_seq: 0,
                        seq: 0,
                        body: undefined
                    });
                });
            });
            describe("send", () => {
                it("is an overrideable handle which sends protocol messages over the wire", () => {
                    const msg = { seq: 0, type: "request", command: "" };
                    const strmsg = JSON.stringify(msg);
                    const len = 1 + Utils.byteLength(strmsg, "utf8");
                    const resultMsg = `Content-Length: ${len}\r\n\r\n${strmsg}\n`;
                    session.send = server.Session.prototype.send;
                    assert(session.send);
                    expect(session.send(msg)).to.not.exist; // tslint:disable-line no-unused-expression
                    expect(lastWrittenToHost).to.equal(resultMsg);
                });
            });
            describe("addProtocolHandler", () => {
                it("can add protocol handlers", () => {
                    const respBody = {
                        item: false
                    };
                    const command = "newhandle";
                    const result = {
                        response: respBody,
                        responseRequired: true
                    };
                    session.addProtocolHandler(command, () => result);
                    expect(session.executeCommand({
                        command,
                        seq: 0,
                        type: "request"
                    })).to.deep.equal(result);
                });
                it("throws when a duplicate handler is passed", () => {
                    const respBody = {
                        item: false
                    };
                    const resp = {
                        response: respBody,
                        responseRequired: true
                    };
                    const command = "newhandle";
                    session.addProtocolHandler(command, () => resp);
                    expect(() => session.addProtocolHandler(command, () => resp))
                        .to.throw(`Protocol handler already exists for command "${command}"`);
                });
            });
            describe("event", () => {
                it("can format event responses and send them", () => {
                    const evt = "notify-test";
                    const info = {
                        test: true
                    };
                    session.event(info, evt);
                    expect(lastSent).to.deep.equal({
                        type: "event",
                        seq: 0,
                        event: evt,
                        body: info
                    });
                });
            });
            describe("output", () => {
                it("can format command responses and send them", () => {
                    const body = {
                        block: {
                            key: "value"
                        }
                    };
                    const command = "test";
                    session.output(body, command, /*reqSeq*/ 0);
                    expect(lastSent).to.deep.equal({
                        seq: 0,
                        request_seq: 0,
                        type: "response",
                        command,
                        body,
                        success: true
                    });
                });
            });
        });
        describe("exceptions", () => {
            // Disable sourcemap support for the duration of the test, as sourcemapping the errors generated during this test is slow and not something we care to test
            let oldPrepare;
            let oldStackTraceLimit;
            before(() => {
                oldStackTraceLimit = Error.stackTraceLimit;
                oldPrepare = Error.prepareStackTrace;
                delete Error.prepareStackTrace;
                Error.stackTraceLimit = 10;
            });
            after(() => {
                Error.prepareStackTrace = oldPrepare;
                Error.stackTraceLimit = oldStackTraceLimit;
            });
            const command = "testhandler";
            class TestSession extends server.Session {
                exceptionRaisingHandler(_request) {
                    f1();
                    return;
                    function f1() {
                        throw new Error("myMessage");
                    }
                }
                constructor() {
                    super({
                        host: mockHost,
                        cancellationToken: server.nullCancellationToken,
                        useSingleInferredProject: false,
                        useInferredProjectPerProjectRoot: false,
                        typingsInstaller: undefined,
                        byteLength: Utils.byteLength,
                        hrtime: process.hrtime,
                        logger: ts.projectSystem.nullLogger,
                        canUseEvents: true
                    });
                    this.addProtocolHandler(command, this.exceptionRaisingHandler);
                }
                send(msg) {
                    this.lastSent = msg;
                }
            }
            it("raised in a protocol handler generate an event", () => {
                const session = new TestSession();
                const request = {
                    command,
                    seq: 0,
                    type: "request"
                };
                session.onMessage(JSON.stringify(request));
                const lastSent = session.lastSent;
                expect(lastSent).to.contain({
                    seq: 0,
                    type: "response",
                    command,
                    success: false
                });
                expect(lastSent.message).has.string("myMessage").and.has.string("f1");
            });
        });
        describe("how Session is extendable via subclassing", () => {
            class TestSession extends server.Session {
                constructor() {
                    super({
                        host: mockHost,
                        cancellationToken: server.nullCancellationToken,
                        useSingleInferredProject: false,
                        useInferredProjectPerProjectRoot: false,
                        typingsInstaller: undefined,
                        byteLength: Utils.byteLength,
                        hrtime: process.hrtime,
                        logger: ts.projectSystem.nullLogger,
                        canUseEvents: true
                    });
                    this.customHandler = "testhandler";
                    this.addProtocolHandler(this.customHandler, () => {
                        return { response: undefined, responseRequired: true };
                    });
                }
                send(msg) {
                    this.lastSent = msg;
                }
            }
            it("can override methods such as send", () => {
                const session = new TestSession();
                const body = {
                    block: {
                        key: "value"
                    }
                };
                const command = "test";
                session.output(body, command, /*reqSeq*/ 0);
                expect(session.lastSent).to.deep.equal({
                    seq: 0,
                    request_seq: 0,
                    type: "response",
                    command,
                    body,
                    success: true
                });
            });
            it("can add and respond to new protocol handlers", () => {
                const session = new TestSession();
                expect(session.executeCommand({
                    seq: 0,
                    type: "request",
                    command: session.customHandler
                })).to.deep.equal({
                    response: undefined,
                    responseRequired: true
                });
            });
            it("has access to the project service", () => {
                // tslint:disable-next-line no-unused-expression
                new class extends TestSession {
                    constructor() {
                        super();
                        assert(this.projectService);
                        expect(this.projectService).to.be.instanceOf(server.ProjectService);
                    }
                }();
            });
        });
        describe("an example of using the Session API to create an in-process server", () => {
            class InProcSession extends server.Session {
                constructor(client) {
                    super({
                        host: mockHost,
                        cancellationToken: server.nullCancellationToken,
                        useSingleInferredProject: false,
                        useInferredProjectPerProjectRoot: false,
                        typingsInstaller: undefined,
                        byteLength: Utils.byteLength,
                        hrtime: process.hrtime,
                        logger: ts.projectSystem.nullLogger,
                        canUseEvents: true
                    });
                    this.client = client;
                    this.queue = [];
                    this.addProtocolHandler("echo", (req) => ({
                        response: req.arguments,
                        responseRequired: true
                    }));
                }
                send(msg) {
                    this.client.handle(msg);
                }
                enqueue(msg) {
                    this.queue.unshift(msg);
                }
                handleRequest(msg) {
                    let response;
                    try {
                        response = this.executeCommand(msg).response;
                    }
                    catch (e) {
                        this.output(undefined, msg.command, msg.seq, e.toString());
                        return;
                    }
                    if (response) {
                        this.output(response, msg.command, msg.seq);
                    }
                }
                consumeQueue() {
                    while (this.queue.length > 0) {
                        const elem = this.queue.pop();
                        this.handleRequest(elem);
                    }
                }
            }
            class InProcClient {
                constructor() {
                    this.seq = 0;
                    this.callbacks = [];
                    this.eventHandlers = ts.createMap();
                }
                handle(msg) {
                    if (msg.type === "response") {
                        const response = msg;
                        const handler = this.callbacks[response.request_seq];
                        if (handler) {
                            handler(response);
                            delete this.callbacks[response.request_seq];
                        }
                    }
                    else if (msg.type === "event") {
                        const event = msg;
                        this.emit(event.event, event.body);
                    }
                }
                emit(name, args) {
                    const handler = this.eventHandlers.get(name);
                    if (handler) {
                        handler(args);
                    }
                }
                on(name, handler) {
                    this.eventHandlers.set(name, handler);
                }
                connect(session) {
                    this.server = session;
                }
                execute(command, args, callback) {
                    if (!this.server) {
                        return;
                    }
                    this.seq++;
                    this.server.enqueue({
                        seq: this.seq,
                        type: "request",
                        command,
                        arguments: args
                    });
                    this.callbacks[this.seq] = callback;
                }
            }
            it("can be constructed and respond to commands", (done) => {
                const cli = new InProcClient();
                const session = new InProcSession(cli);
                const toEcho = {
                    data: true
                };
                const toEvent = {
                    data: false
                };
                let responses = 0;
                // Connect the client
                cli.connect(session);
                // Add an event handler
                cli.on("testevent", (eventinfo) => {
                    expect(eventinfo).to.equal(toEvent);
                    responses++;
                    expect(responses).to.equal(1);
                });
                // Trigger said event from the server
                session.event(toEvent, "testevent");
                // Queue an echo command
                cli.execute("echo", toEcho, (resp) => {
                    assert(resp.success, resp.message);
                    responses++;
                    expect(responses).to.equal(2);
                    expect(resp.body).to.deep.equal(toEcho);
                });
                // Queue a configure command
                cli.execute("configure", {
                    hostInfo: "unit test",
                    formatOptions: {
                        newLineCharacter: "`n"
                    }
                }, (resp) => {
                    assert(resp.success, resp.message);
                    responses++;
                    expect(responses).to.equal(3);
                    done();
                });
                // Consume the queue and trigger the callbacks
                session.consumeQueue();
            });
        });
        describe("helpers", () => {
            it(server.getLocationInNewDocument.name, () => {
                const text = `// blank line\nconst x = 0;`;
                const renameLocationInOldText = text.indexOf("0");
                const fileName = "/a.ts";
                const edits = {
                    fileName,
                    textChanges: [
                        {
                            span: { start: 0, length: 0 },
                            newText: "const newLocal = 0;\n\n",
                        },
                        {
                            span: { start: renameLocationInOldText, length: 1 },
                            newText: "newLocal",
                        },
                    ],
                };
                const renameLocationInNewText = renameLocationInOldText + edits.textChanges[0].newText.length;
                const res = server.getLocationInNewDocument(text, fileName, renameLocationInNewText, [edits]);
                assert.deepEqual(res, { line: 4, offset: 11 });
            });
        });
    })(server = ts.server || (ts.server = {}));
})(ts || (ts = {}));
