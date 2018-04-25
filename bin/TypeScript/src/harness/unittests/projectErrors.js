/// <reference path="../harness.ts" />
/// <reference path="./tsserverProjectSystem.ts" />
/// <reference path="../../server/typingsInstaller/typingsInstaller.ts" />
var ts;
(function (ts) {
    var projectSystem;
    (function (projectSystem) {
        describe("Project errors", () => {
            function checkProjectErrors(projectFiles, expectedErrors) {
                assert.isTrue(projectFiles !== undefined, "missing project files");
                checkProjectErrorsWorker(projectFiles.projectErrors, expectedErrors);
            }
            function checkProjectErrorsWorker(errors, expectedErrors) {
                assert.equal(errors ? errors.length : 0, expectedErrors.length, `expected ${expectedErrors.length} error in the list`);
                if (expectedErrors.length) {
                    for (let i = 0; i < errors.length; i++) {
                        const actualMessage = ts.flattenDiagnosticMessageText(errors[i].messageText, "\n");
                        const expectedMessage = expectedErrors[i];
                        assert.isTrue(actualMessage.indexOf(expectedMessage) === 0, `error message does not match, expected ${actualMessage} to start with ${expectedMessage}`);
                    }
                }
            }
            function checkDiagnosticsWithLinePos(errors, expectedErrors) {
                assert.equal(errors ? errors.length : 0, expectedErrors.length, `expected ${expectedErrors.length} error in the list`);
                if (expectedErrors.length) {
                    ts.zipWith(errors, expectedErrors, ({ message: actualMessage }, expectedMessage) => {
                        assert.isTrue(ts.startsWith(actualMessage, actualMessage), `error message does not match, expected ${actualMessage} to start with ${expectedMessage}`);
                    });
                }
            }
            it("external project - diagnostics for missing files", () => {
                const file1 = {
                    path: "/a/b/app.ts",
                    content: ""
                };
                const file2 = {
                    path: "/a/b/applib.ts",
                    content: ""
                };
                const host = projectSystem.createServerHost([file1, projectSystem.libFile]);
                const session = projectSystem.createSession(host);
                const projectService = session.getProjectService();
                const projectFileName = "/a/b/test.csproj";
                const compilerOptionsRequest = {
                    type: "request",
                    command: ts.server.CommandNames.CompilerOptionsDiagnosticsFull,
                    seq: 2,
                    arguments: { projectFileName }
                };
                {
                    projectService.openExternalProject({
                        projectFileName,
                        options: {},
                        rootFiles: projectSystem.toExternalFiles([file1.path, file2.path])
                    });
                    projectSystem.checkNumberOfProjects(projectService, { externalProjects: 1 });
                    const diags = session.executeCommand(compilerOptionsRequest).response;
                    // only file1 exists - expect error
                    checkDiagnosticsWithLinePos(diags, ["File '/a/b/applib.ts' not found."]);
                }
                host.reloadFS([file2, projectSystem.libFile]);
                {
                    // only file2 exists - expect error
                    projectSystem.checkNumberOfProjects(projectService, { externalProjects: 1 });
                    const diags = session.executeCommand(compilerOptionsRequest).response;
                    checkDiagnosticsWithLinePos(diags, ["File '/a/b/app.ts' not found."]);
                }
                host.reloadFS([file1, file2, projectSystem.libFile]);
                {
                    // both files exist - expect no errors
                    projectSystem.checkNumberOfProjects(projectService, { externalProjects: 1 });
                    const diags = session.executeCommand(compilerOptionsRequest).response;
                    checkDiagnosticsWithLinePos(diags, []);
                }
            });
            it("configured projects - diagnostics for missing files", () => {
                const file1 = {
                    path: "/a/b/app.ts",
                    content: ""
                };
                const file2 = {
                    path: "/a/b/applib.ts",
                    content: ""
                };
                const config = {
                    path: "/a/b/tsconfig.json",
                    content: JSON.stringify({ files: [file1, file2].map(f => ts.getBaseFileName(f.path)) })
                };
                const host = projectSystem.createServerHost([file1, config, projectSystem.libFile]);
                const session = projectSystem.createSession(host);
                const projectService = session.getProjectService();
                projectSystem.openFilesForSession([file1], session);
                projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 1 });
                const project = projectSystem.configuredProjectAt(projectService, 0);
                const compilerOptionsRequest = {
                    type: "request",
                    command: ts.server.CommandNames.CompilerOptionsDiagnosticsFull,
                    seq: 2,
                    arguments: { projectFileName: project.getProjectName() }
                };
                let diags = session.executeCommand(compilerOptionsRequest).response;
                checkDiagnosticsWithLinePos(diags, ["File '/a/b/applib.ts' not found."]);
                host.reloadFS([file1, file2, config, projectSystem.libFile]);
                projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 1 });
                diags = session.executeCommand(compilerOptionsRequest).response;
                checkDiagnosticsWithLinePos(diags, []);
            });
            it("configured projects - diagnostics for corrupted config 1", () => {
                const file1 = {
                    path: "/a/b/app.ts",
                    content: ""
                };
                const file2 = {
                    path: "/a/b/lib.ts",
                    content: ""
                };
                const correctConfig = {
                    path: "/a/b/tsconfig.json",
                    content: JSON.stringify({ files: [file1, file2].map(f => ts.getBaseFileName(f.path)) })
                };
                const corruptedConfig = {
                    path: correctConfig.path,
                    content: correctConfig.content.substr(1)
                };
                const host = projectSystem.createServerHost([file1, file2, corruptedConfig]);
                const projectService = projectSystem.createProjectService(host);
                projectService.openClientFile(file1.path);
                {
                    projectService.checkNumberOfProjects({ configuredProjects: 1 });
                    const configuredProject = ts.forEach(projectService.synchronizeProjectList([]), f => f.info.projectName === corruptedConfig.path && f);
                    assert.isTrue(configuredProject !== undefined, "should find configured project");
                    checkProjectErrors(configuredProject, []);
                    const projectErrors = projectSystem.configuredProjectAt(projectService, 0).getAllProjectErrors();
                    checkProjectErrorsWorker(projectErrors, [
                        "'{' expected."
                    ]);
                    assert.isNotNull(projectErrors[0].file);
                    assert.equal(projectErrors[0].file.fileName, corruptedConfig.path);
                }
                // fix config and trigger watcher
                host.reloadFS([file1, file2, correctConfig]);
                {
                    projectService.checkNumberOfProjects({ configuredProjects: 1 });
                    const configuredProject = ts.forEach(projectService.synchronizeProjectList([]), f => f.info.projectName === corruptedConfig.path && f);
                    assert.isTrue(configuredProject !== undefined, "should find configured project");
                    checkProjectErrors(configuredProject, []);
                    const projectErrors = projectSystem.configuredProjectAt(projectService, 0).getAllProjectErrors();
                    checkProjectErrorsWorker(projectErrors, []);
                }
            });
            it("configured projects - diagnostics for corrupted config 2", () => {
                const file1 = {
                    path: "/a/b/app.ts",
                    content: ""
                };
                const file2 = {
                    path: "/a/b/lib.ts",
                    content: ""
                };
                const correctConfig = {
                    path: "/a/b/tsconfig.json",
                    content: JSON.stringify({ files: [file1, file2].map(f => ts.getBaseFileName(f.path)) })
                };
                const corruptedConfig = {
                    path: correctConfig.path,
                    content: correctConfig.content.substr(1)
                };
                const host = projectSystem.createServerHost([file1, file2, correctConfig]);
                const projectService = projectSystem.createProjectService(host);
                projectService.openClientFile(file1.path);
                {
                    projectService.checkNumberOfProjects({ configuredProjects: 1 });
                    const configuredProject = ts.forEach(projectService.synchronizeProjectList([]), f => f.info.projectName === corruptedConfig.path && f);
                    assert.isTrue(configuredProject !== undefined, "should find configured project");
                    checkProjectErrors(configuredProject, []);
                    const projectErrors = projectSystem.configuredProjectAt(projectService, 0).getAllProjectErrors();
                    checkProjectErrorsWorker(projectErrors, []);
                }
                // break config and trigger watcher
                host.reloadFS([file1, file2, corruptedConfig]);
                {
                    projectService.checkNumberOfProjects({ configuredProjects: 1 });
                    const configuredProject = ts.forEach(projectService.synchronizeProjectList([]), f => f.info.projectName === corruptedConfig.path && f);
                    assert.isTrue(configuredProject !== undefined, "should find configured project");
                    checkProjectErrors(configuredProject, []);
                    const projectErrors = projectSystem.configuredProjectAt(projectService, 0).getAllProjectErrors();
                    checkProjectErrorsWorker(projectErrors, [
                        "'{' expected."
                    ]);
                    assert.isNotNull(projectErrors[0].file);
                    assert.equal(projectErrors[0].file.fileName, corruptedConfig.path);
                }
            });
        });
    })(projectSystem = ts.projectSystem || (ts.projectSystem = {}));
})(ts || (ts = {}));
