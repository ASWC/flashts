var ts;
(function (ts) {
    function countLines(program) {
        let count = 0;
        ts.forEach(program.getSourceFiles(), file => {
            count += ts.getLineStarts(file).length;
        });
        return count;
    }
    function getDiagnosticText(_message, ..._args) {
        const diagnostic = ts.createCompilerDiagnostic.apply(undefined, arguments);
        return diagnostic.messageText;
    }
    let reportDiagnostic = ts.createDiagnosticReporter(ts.sys);
    function updateReportDiagnostic(options) {
        if (shouldBePretty(options)) {
            reportDiagnostic = ts.createDiagnosticReporter(ts.sys, /*pretty*/ true);
        }
    }
    function shouldBePretty(options) {
        if (typeof options.pretty === "undefined") {
            return !!ts.sys.writeOutputIsTTY && ts.sys.writeOutputIsTTY();
        }
        return options.pretty;
    }
    function padLeft(s, length) {
        while (s.length < length) {
            s = " " + s;
        }
        return s;
    }
    function padRight(s, length) {
        while (s.length < length) {
            s = s + " ";
        }
        return s;
    }
    function executeCommandLine(args) {
        const commandLine = ts.parseCommandLine(args);
        // Configuration file name (if any)
        let configFileName;
        if (commandLine.options.locale) {
            ts.validateLocaleAndSetLanguage(commandLine.options.locale, ts.sys, commandLine.errors);
        }
        // If there are any errors due to command line parsing and/or
        // setting up localization, report them and quit.
        if (commandLine.errors.length > 0) {
            commandLine.errors.forEach(reportDiagnostic);
            return ts.sys.exit(ts.ExitStatus.DiagnosticsPresent_OutputsSkipped);
        }
        if (commandLine.options.init) {
            writeConfigFile(commandLine.options, commandLine.fileNames);
            return ts.sys.exit(ts.ExitStatus.Success);
        }
        if (commandLine.options.version) {
            printVersion();
            return ts.sys.exit(ts.ExitStatus.Success);
        }
        if (commandLine.options.help || commandLine.options.all) {
            printVersion();
            printHelp(commandLine.options.all);
            return ts.sys.exit(ts.ExitStatus.Success);
        }
        if (commandLine.options.project) {
            if (commandLine.fileNames.length !== 0) {
                reportDiagnostic(ts.createCompilerDiagnostic(Diagnostics.Option_project_cannot_be_mixed_with_source_files_on_a_command_line));
                return ts.sys.exit(ts.ExitStatus.DiagnosticsPresent_OutputsSkipped);
            }
            const fileOrDirectory = ts.normalizePath(commandLine.options.project);
            if (!fileOrDirectory /* current directory "." */ || ts.sys.directoryExists(fileOrDirectory)) {
                configFileName = ts.combinePaths(fileOrDirectory, "tsconfig.json");
                if (!ts.sys.fileExists(configFileName)) {
                    reportDiagnostic(ts.createCompilerDiagnostic(Diagnostics.Cannot_find_a_tsconfig_json_file_at_the_specified_directory_Colon_0, commandLine.options.project));
                    return ts.sys.exit(ts.ExitStatus.DiagnosticsPresent_OutputsSkipped);
                }
            }
            else {
                configFileName = fileOrDirectory;
                if (!ts.sys.fileExists(configFileName)) {
                    reportDiagnostic(ts.createCompilerDiagnostic(Diagnostics.The_specified_path_does_not_exist_Colon_0, commandLine.options.project));
                    return ts.sys.exit(ts.ExitStatus.DiagnosticsPresent_OutputsSkipped);
                }
            }
        }
        else if (commandLine.fileNames.length === 0) {
            const searchPath = ts.normalizePath(ts.sys.getCurrentDirectory());
            configFileName = ts.findConfigFile(searchPath, ts.sys.fileExists);
        }
        if (commandLine.fileNames.length === 0 && !configFileName) {
            printVersion();
            printHelp(commandLine.options.all);
            return ts.sys.exit(ts.ExitStatus.Success);
        }
        const commandLineOptions = commandLine.options;
        if (configFileName) {
            const configParseResult = ts.parseConfigFileWithSystem(configFileName, commandLineOptions, ts.sys, reportDiagnostic);
            updateReportDiagnostic(configParseResult.options);
            if (ts.isWatchSet(configParseResult.options)) {
                reportWatchModeWithoutSysSupport();
                createWatchOfConfigFile(configParseResult, commandLineOptions);
            }
            else {
                performCompilation(configParseResult.fileNames, configParseResult.options, ts.getConfigFileParsingDiagnostics(configParseResult));
            }
        }
        else {
            updateReportDiagnostic(commandLineOptions);
            if (ts.isWatchSet(commandLineOptions)) {
                reportWatchModeWithoutSysSupport();
                createWatchOfFilesAndCompilerOptions(commandLine.fileNames, commandLineOptions);
            }
            else {
                performCompilation(commandLine.fileNames, commandLineOptions);
            }
        }
    }
    ts.executeCommandLine = executeCommandLine;
    function reportWatchModeWithoutSysSupport() {
        if (!ts.sys.watchFile || !ts.sys.watchDirectory) {
            reportDiagnostic(ts.createCompilerDiagnostic(Diagnostics.The_current_host_does_not_support_the_0_option, "--watch"));
            ts.sys.exit(ts.ExitStatus.DiagnosticsPresent_OutputsSkipped);
        }
    }
    function performCompilation(rootFileNames, compilerOptions, configFileParsingDiagnostics) {
        const compilerHost = ts.createCompilerHost(compilerOptions);
        enableStatistics(compilerOptions);
        const program = ts.createProgram(rootFileNames, compilerOptions, compilerHost, /*oldProgram*/ undefined, configFileParsingDiagnostics);
        const exitStatus = ts.emitFilesAndReportErrors(program, reportDiagnostic, s => ts.sys.write(s + ts.sys.newLine));
        reportStatistics(program);
        return ts.sys.exit(exitStatus);
    }
    function updateWatchCompilationHost(watchCompilerHost) {
        const compileUsingBuilder = watchCompilerHost.createProgram;
        watchCompilerHost.createProgram = (rootNames, options, host, oldProgram) => {
            enableStatistics(options);
            return compileUsingBuilder(rootNames, options, host, oldProgram);
        };
        const emitFilesUsingBuilder = watchCompilerHost.afterProgramCreate;
        watchCompilerHost.afterProgramCreate = builderProgram => {
            emitFilesUsingBuilder(builderProgram);
            reportStatistics(builderProgram.getProgram());
        };
    }
    function createWatchStatusReporter(options) {
        return ts.createWatchStatusReporter(ts.sys, shouldBePretty(options));
    }
    function createWatchOfConfigFile(configParseResult, optionsToExtend) {
        const watchCompilerHost = ts.createWatchCompilerHostOfConfigFile(configParseResult.options.configFilePath, optionsToExtend, ts.sys, /*createProgram*/ undefined, reportDiagnostic, createWatchStatusReporter(configParseResult.options));
        updateWatchCompilationHost(watchCompilerHost);
        watchCompilerHost.configFileParsingResult = configParseResult;
        ts.createWatchProgram(watchCompilerHost);
    }
    function createWatchOfFilesAndCompilerOptions(rootFiles, options) {
        const watchCompilerHost = ts.createWatchCompilerHostOfFilesAndCompilerOptions(rootFiles, options, ts.sys, /*createProgram*/ undefined, reportDiagnostic, createWatchStatusReporter(options));
        updateWatchCompilationHost(watchCompilerHost);
        ts.createWatchProgram(watchCompilerHost);
    }
    function enableStatistics(compilerOptions) {
        if (compilerOptions.diagnostics || compilerOptions.extendedDiagnostics) {
            ts.performance.enable();
        }
    }
    function reportStatistics(program) {
        let statistics;
        const compilerOptions = program.getCompilerOptions();
        if (compilerOptions.diagnostics || compilerOptions.extendedDiagnostics) {
            statistics = [];
            const memoryUsed = ts.sys.getMemoryUsage ? ts.sys.getMemoryUsage() : -1;
            reportCountStatistic("Files", program.getSourceFiles().length);
            reportCountStatistic("Lines", countLines(program));
            reportCountStatistic("Nodes", program.getNodeCount());
            reportCountStatistic("Identifiers", program.getIdentifierCount());
            reportCountStatistic("Symbols", program.getSymbolCount());
            reportCountStatistic("Types", program.getTypeCount());
            if (memoryUsed >= 0) {
                reportStatisticalValue("Memory used", Math.round(memoryUsed / 1000) + "K");
            }
            const programTime = ts.performance.getDuration("Program");
            const bindTime = ts.performance.getDuration("Bind");
            const checkTime = ts.performance.getDuration("Check");
            const emitTime = ts.performance.getDuration("Emit");
            if (compilerOptions.extendedDiagnostics) {
                ts.performance.forEachMeasure((name, duration) => reportTimeStatistic(`${name} time`, duration));
            }
            else {
                // Individual component times.
                // Note: To match the behavior of previous versions of the compiler, the reported parse time includes
                // I/O read time and processing time for triple-slash references and module imports, and the reported
                // emit time includes I/O write time. We preserve this behavior so we can accurately compare times.
                reportTimeStatistic("I/O read", ts.performance.getDuration("I/O Read"));
                reportTimeStatistic("I/O write", ts.performance.getDuration("I/O Write"));
                reportTimeStatistic("Parse time", programTime);
                reportTimeStatistic("Bind time", bindTime);
                reportTimeStatistic("Check time", checkTime);
                reportTimeStatistic("Emit time", emitTime);
            }
            reportTimeStatistic("Total time", programTime + bindTime + checkTime + emitTime);
            reportStatistics();
            ts.performance.disable();
        }
        function reportStatistics() {
            let nameSize = 0;
            let valueSize = 0;
            for (const { name, value } of statistics) {
                if (name.length > nameSize) {
                    nameSize = name.length;
                }
                if (value.length > valueSize) {
                    valueSize = value.length;
                }
            }
            for (const { name, value } of statistics) {
                ts.sys.write(padRight(name + ":", nameSize + 2) + padLeft(value.toString(), valueSize) + ts.sys.newLine);
            }
        }
        function reportStatisticalValue(name, value) {
            statistics.push({ name, value });
        }
        function reportCountStatistic(name, count) {
            reportStatisticalValue(name, "" + count);
        }
        function reportTimeStatistic(name, time) {
            reportStatisticalValue(name, (time / 1000).toFixed(2) + "s");
        }
    }
    function printVersion() {
        ts.sys.write(getDiagnosticText(Diagnostics.Version_0, ts.version) + ts.sys.newLine);
    }
    function printHelp(showAllOptions) {
        const output = [];
        // We want to align our "syntax" and "examples" commands to a certain margin.
        const syntaxLength = getDiagnosticText(Diagnostics.Syntax_Colon_0, "").length;
        const examplesLength = getDiagnosticText(Diagnostics.Examples_Colon_0, "").length;
        let marginLength = Math.max(syntaxLength, examplesLength);
        // Build up the syntactic skeleton.
        let syntax = makePadding(marginLength - syntaxLength);
        syntax += "tsc [" + getDiagnosticText(Diagnostics.options) + "] [" + getDiagnosticText(Diagnostics.file) + " ...]";
        output.push(getDiagnosticText(Diagnostics.Syntax_Colon_0, syntax));
        output.push(ts.sys.newLine + ts.sys.newLine);
        // Build up the list of examples.
        const padding = makePadding(marginLength);
        output.push(getDiagnosticText(Diagnostics.Examples_Colon_0, makePadding(marginLength - examplesLength) + "tsc hello.ts") + ts.sys.newLine);
        output.push(padding + "tsc --outFile file.js file.ts" + ts.sys.newLine);
        output.push(padding + "tsc @args.txt" + ts.sys.newLine);
        output.push(ts.sys.newLine);
        output.push(getDiagnosticText(Diagnostics.Options_Colon) + ts.sys.newLine);
        // Sort our options by their names, (e.g. "--noImplicitAny" comes before "--watch")
        const optsList = showAllOptions ?
            ts.sort(ts.optionDeclarations, (a, b) => ts.compareStringsCaseInsensitive(a.name, b.name)) :
            ts.filter(ts.optionDeclarations.slice(), v => v.showInSimplifiedHelpView);
        // We want our descriptions to align at the same column in our output,
        // so we keep track of the longest option usage string.
        marginLength = 0;
        const usageColumn = []; // Things like "-d, --declaration" go in here.
        const descriptionColumn = [];
        const optionsDescriptionMap = ts.createMap(); // Map between option.description and list of option.type if it is a kind
        for (const option of optsList) {
            // If an option lacks a description,
            // it is not officially supported.
            if (!option.description) {
                continue;
            }
            let usageText = " ";
            if (option.shortName) {
                usageText += "-" + option.shortName;
                usageText += getParamType(option);
                usageText += ", ";
            }
            usageText += "--" + option.name;
            usageText += getParamType(option);
            usageColumn.push(usageText);
            let description;
            if (option.name === "lib") {
                description = getDiagnosticText(option.description);
                const element = option.element;
                const typeMap = element.type;
                optionsDescriptionMap.set(description, ts.arrayFrom(typeMap.keys()).map(key => `'${key}'`));
            }
            else {
                description = getDiagnosticText(option.description);
            }
            descriptionColumn.push(description);
            // Set the new margin for the description column if necessary.
            marginLength = Math.max(usageText.length, marginLength);
        }
        // Special case that can't fit in the loop.
        const usageText = " @<" + getDiagnosticText(Diagnostics.file) + ">";
        usageColumn.push(usageText);
        descriptionColumn.push(getDiagnosticText(Diagnostics.Insert_command_line_options_and_files_from_a_file));
        marginLength = Math.max(usageText.length, marginLength);
        // Print out each row, aligning all the descriptions on the same column.
        for (let i = 0; i < usageColumn.length; i++) {
            const usage = usageColumn[i];
            const description = descriptionColumn[i];
            const kindsList = optionsDescriptionMap.get(description);
            output.push(usage + makePadding(marginLength - usage.length + 2) + description + ts.sys.newLine);
            if (kindsList) {
                output.push(makePadding(marginLength + 4));
                for (const kind of kindsList) {
                    output.push(kind + " ");
                }
                output.push(ts.sys.newLine);
            }
        }
        for (const line of output) {
            ts.sys.write(line);
        }
        return;
        function getParamType(option) {
            if (option.paramType !== undefined) {
                return " " + getDiagnosticText(option.paramType);
            }
            return "";
        }
        function makePadding(paddingLength) {
            return Array(paddingLength + 1).join(" ");
        }
    }
    function writeConfigFile(options, fileNames) {
        const currentDirectory = ts.sys.getCurrentDirectory();
        const file = ts.normalizePath(ts.combinePaths(currentDirectory, "tsconfig.json"));
        if (ts.sys.fileExists(file)) {
            reportDiagnostic(ts.createCompilerDiagnostic(Diagnostics.A_tsconfig_json_file_is_already_defined_at_Colon_0, file));
        }
        else {
            ts.sys.writeFile(file, ts.generateTSConfig(options, fileNames, ts.sys.newLine));
            reportDiagnostic(ts.createCompilerDiagnostic(Diagnostics.Successfully_created_a_tsconfig_json_file));
        }
        return;
    }
})(ts || (ts = {}));
if (ts.Debug.isDebugging) {
    ts.Debug.enableDebugInfo();
}
if (ts.sys.tryEnableSourceMapsForHost && /^development$/i.test(ts.sys.getEnvironmentVariable("NODE_ENV"))) {
    ts.sys.tryEnableSourceMapsForHost();
}
if (ts.sys.setBlocking) {
    ts.sys.setBlocking();
}
ts.executeCommandLine(ts.sys.args);
