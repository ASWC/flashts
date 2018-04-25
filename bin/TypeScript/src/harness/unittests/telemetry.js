/// <reference path="../harness.ts" />
/// <reference path="./tsserverProjectSystem.ts" />
var ts;
(function (ts) {
    var projectSystem;
    (function (projectSystem) {
        describe("project telemetry", () => {
            it("does nothing for inferred project", () => {
                const file = makeFile("/a.js");
                const et = new projectSystem.TestServerEventManager([file]);
                et.service.openClientFile(file.path);
                et.hasZeroEvent(ts.server.ProjectInfoTelemetryEvent);
            });
            it("only sends an event once", () => {
                const file = makeFile("/a/a.ts");
                const file2 = makeFile("/b.ts");
                const tsconfig = makeFile("/a/tsconfig.json", {});
                const et = new projectSystem.TestServerEventManager([file, file2, tsconfig]);
                et.service.openClientFile(file.path);
                et.assertProjectInfoTelemetryEvent({}, tsconfig.path);
                et.service.closeClientFile(file.path);
                projectSystem.checkNumberOfProjects(et.service, { configuredProjects: 1 });
                et.service.openClientFile(file2.path);
                projectSystem.checkNumberOfProjects(et.service, { inferredProjects: 1 });
                et.hasZeroEvent(ts.server.ProjectInfoTelemetryEvent);
                et.service.openClientFile(file.path);
                projectSystem.checkNumberOfProjects(et.service, { configuredProjects: 1, inferredProjects: 1 });
                et.hasZeroEvent(ts.server.ProjectInfoTelemetryEvent);
            });
            it("counts files by extension", () => {
                const files = ["ts.ts", "tsx.tsx", "moo.ts", "dts.d.ts", "jsx.jsx", "js.js", "badExtension.badExtension"].map(f => makeFile(`/src/${f}`));
                const notIncludedFile = makeFile("/bin/ts.js");
                const compilerOptions = { allowJs: true };
                const tsconfig = makeFile("/tsconfig.json", { compilerOptions, include: ["src"] });
                const et = new projectSystem.TestServerEventManager([...files, notIncludedFile, tsconfig]);
                et.service.openClientFile(files[0].path);
                et.assertProjectInfoTelemetryEvent({
                    fileStats: { ts: 2, tsx: 1, js: 1, jsx: 1, dts: 1 },
                    compilerOptions,
                    include: true,
                });
            });
            it("works with external project", () => {
                const file1 = makeFile("/a.ts");
                const et = new projectSystem.TestServerEventManager([file1]);
                const compilerOptions = { strict: true };
                const projectFileName = "/hunter2/foo.csproj";
                open();
                // TODO: Apparently compilerOptions is mutated, so have to repeat it here!
                et.assertProjectInfoTelemetryEvent({
                    projectId: Harness.mockHash("/hunter2/foo.csproj"),
                    compilerOptions: { strict: true },
                    compileOnSave: true,
                    // These properties can't be present for an external project, so they are undefined instead of false.
                    extends: undefined,
                    files: undefined,
                    include: undefined,
                    exclude: undefined,
                    configFileName: "other",
                    projectType: "external",
                });
                // Also test that opening an external project only sends an event once.
                et.service.closeExternalProject(projectFileName);
                projectSystem.checkNumberOfProjects(et.service, { externalProjects: 0 });
                open();
                assert.equal(et.getEvents().length, 0);
                function open() {
                    et.service.openExternalProject({
                        rootFiles: projectSystem.toExternalFiles([file1.path]),
                        options: compilerOptions,
                        projectFileName,
                    });
                    projectSystem.checkNumberOfProjects(et.service, { externalProjects: 1 });
                }
            });
            it("does not expose paths", () => {
                const file = makeFile("/a.ts");
                const compilerOptions = {
                    project: "",
                    outFile: "hunter2.js",
                    outDir: "hunter2",
                    rootDir: "hunter2",
                    baseUrl: "hunter2",
                    rootDirs: ["hunter2"],
                    typeRoots: ["hunter2"],
                    types: ["hunter2"],
                    sourceRoot: "hunter2",
                    mapRoot: "hunter2",
                    jsxFactory: "hunter2",
                    out: "hunter2",
                    reactNamespace: "hunter2",
                    charset: "hunter2",
                    locale: "hunter2",
                    declarationDir: "hunter2",
                    paths: {
                        "*": ["hunter2"],
                    },
                    // Boolean / number options get through
                    declaration: true,
                    // List of string enum gets through -- but only if legitimately a member of the enum
                    lib: ["es6", "dom", "hunter2"],
                    // Sensitive data doesn't get through even if sent to an option of safe type
                    checkJs: "hunter2",
                };
                const safeCompilerOptions = {
                    project: "",
                    outFile: "",
                    outDir: "",
                    rootDir: "",
                    baseUrl: "",
                    rootDirs: [""],
                    typeRoots: [""],
                    types: [""],
                    sourceRoot: "",
                    mapRoot: "",
                    jsxFactory: "",
                    out: "",
                    reactNamespace: "",
                    charset: "",
                    locale: "",
                    declarationDir: "",
                    paths: "",
                    declaration: true,
                    lib: ["es6", "dom"],
                };
                compilerOptions.unknownCompilerOption = "hunter2"; // These are always ignored.
                const tsconfig = makeFile("/tsconfig.json", { compilerOptions, files: ["/a.ts"] });
                const et = new projectSystem.TestServerEventManager([file, tsconfig]);
                et.service.openClientFile(file.path);
                et.assertProjectInfoTelemetryEvent({
                    compilerOptions: safeCompilerOptions,
                    files: true,
                });
            });
            it("sends telemetry for extends, files, include, exclude, and compileOnSave", () => {
                const file = makeFile("/hunter2/a.ts");
                const tsconfig = makeFile("/tsconfig.json", {
                    compilerOptions: {},
                    extends: "hunter2.json",
                    files: ["hunter2/a.ts"],
                    include: ["hunter2"],
                    exclude: ["hunter2"],
                    compileOnSave: true,
                });
                const et = new projectSystem.TestServerEventManager([tsconfig, file]);
                et.service.openClientFile(file.path);
                et.assertProjectInfoTelemetryEvent({
                    extends: true,
                    files: true,
                    include: true,
                    exclude: true,
                    compileOnSave: true,
                });
            });
            const autoJsCompilerOptions = {
                // Apparently some options are added by default.
                allowJs: true,
                allowSyntheticDefaultImports: true,
                maxNodeModuleJsDepth: 2,
                skipLibCheck: true,
                noEmit: true
            };
            it("sends telemetry for typeAcquisition settings", () => {
                const file = makeFile("/a.js");
                const jsconfig = makeFile("/jsconfig.json", {
                    compilerOptions: {},
                    typeAcquisition: {
                        enable: true,
                        enableAutoDiscovery: false,
                        include: ["hunter2", "hunter3"],
                        exclude: [],
                    },
                });
                const et = new projectSystem.TestServerEventManager([jsconfig, file]);
                et.service.openClientFile(file.path);
                et.assertProjectInfoTelemetryEvent({
                    projectId: Harness.mockHash("/jsconfig.json"),
                    fileStats: projectSystem.fileStats({ js: 1 }),
                    compilerOptions: autoJsCompilerOptions,
                    typeAcquisition: {
                        enable: true,
                        include: true,
                        exclude: false,
                    },
                    configFileName: "jsconfig.json",
                });
            });
            it("detects whether language service was disabled", () => {
                const file = makeFile("/a.js");
                const tsconfig = makeFile("/jsconfig.json", {});
                const et = new projectSystem.TestServerEventManager([tsconfig, file]);
                et.host.getFileSize = () => ts.server.maxProgramSizeForNonTsFiles + 1;
                et.service.openClientFile(file.path);
                et.getEvent(ts.server.ProjectLanguageServiceStateEvent);
                et.assertProjectInfoTelemetryEvent({
                    projectId: Harness.mockHash("/jsconfig.json"),
                    fileStats: projectSystem.fileStats({ js: 1 }),
                    compilerOptions: autoJsCompilerOptions,
                    configFileName: "jsconfig.json",
                    typeAcquisition: {
                        enable: true,
                        include: false,
                        exclude: false,
                    },
                    languageServiceEnabled: false,
                });
            });
        });
        function makeFile(path, content = "") {
            return { path, content: ts.isString(content) ? "" : JSON.stringify(content) };
        }
    })(projectSystem = ts.projectSystem || (ts.projectSystem = {}));
})(ts || (ts = {}));
