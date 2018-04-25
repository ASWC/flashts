/* @internal */
var ts;
(function (ts) {
    var JsTyping;
    (function (JsTyping) {
        /* @internal */
        function isTypingUpToDate(cachedTyping, availableTypingVersions) {
            const availableVersion = ts.Semver.parse(ts.getProperty(availableTypingVersions, `ts${ts.versionMajorMinor}`) || ts.getProperty(availableTypingVersions, "latest"));
            return !availableVersion.greaterThan(cachedTyping.version);
        }
        JsTyping.isTypingUpToDate = isTypingUpToDate;
        /* @internal */
        JsTyping.nodeCoreModuleList = [
            "buffer", "querystring", "events", "http", "cluster",
            "zlib", "os", "https", "punycode", "repl", "readline",
            "vm", "child_process", "url", "dns", "net",
            "dgram", "fs", "path", "string_decoder", "tls",
            "crypto", "stream", "util", "assert", "tty", "domain",
            "constants", "process", "v8", "timers", "console"
        ];
        const nodeCoreModules = ts.arrayToSet(JsTyping.nodeCoreModuleList);
        function loadSafeList(host, safeListPath) {
            const result = ts.readConfigFile(safeListPath, path => host.readFile(path));
            return ts.createMapFromTemplate(result.config);
        }
        JsTyping.loadSafeList = loadSafeList;
        function loadTypesMap(host, typesMapPath) {
            const result = ts.readConfigFile(typesMapPath, path => host.readFile(path));
            if (result.config) {
                return ts.createMapFromTemplate(result.config.simpleMap);
            }
            return undefined;
        }
        JsTyping.loadTypesMap = loadTypesMap;
        /**
         * @param host is the object providing I/O related operations.
         * @param fileNames are the file names that belong to the same project
         * @param projectRootPath is the path to the project root directory
         * @param safeListPath is the path used to retrieve the safe list
         * @param packageNameToTypingLocation is the map of package names to their cached typing locations and installed versions
         * @param typeAcquisition is used to customize the typing acquisition process
         * @param compilerOptions are used as a source for typing inference
         */
        function discoverTypings(host, log, fileNames, projectRootPath, safeList, packageNameToTypingLocation, typeAcquisition, unresolvedImports, typesRegistry) {
            if (!typeAcquisition || !typeAcquisition.enable) {
                return { cachedTypingPaths: [], newTypingNames: [], filesToWatch: [] };
            }
            // A typing name to typing file path mapping
            const inferredTypings = ts.createMap();
            // Only infer typings for .js and .jsx files
            fileNames = ts.mapDefined(fileNames, fileName => {
                const path = ts.normalizePath(fileName);
                if (ts.hasJavaScriptFileExtension(path)) {
                    return path;
                }
            });
            const filesToWatch = [];
            if (typeAcquisition.include)
                addInferredTypings(typeAcquisition.include, "Explicitly included types");
            const exclude = typeAcquisition.exclude || [];
            // Directories to search for package.json, bower.json and other typing information
            const possibleSearchDirs = ts.arrayToSet(fileNames, ts.getDirectoryPath);
            possibleSearchDirs.set(projectRootPath, true);
            possibleSearchDirs.forEach((_true, searchDir) => {
                const packageJsonPath = ts.combinePaths(searchDir, "package.json");
                getTypingNamesFromJson(packageJsonPath, filesToWatch);
                const bowerJsonPath = ts.combinePaths(searchDir, "bower.json");
                getTypingNamesFromJson(bowerJsonPath, filesToWatch);
                const bowerComponentsPath = ts.combinePaths(searchDir, "bower_components");
                getTypingNamesFromPackagesFolder(bowerComponentsPath, filesToWatch);
                const nodeModulesPath = ts.combinePaths(searchDir, "node_modules");
                getTypingNamesFromPackagesFolder(nodeModulesPath, filesToWatch);
            });
            getTypingNamesFromSourceFileNames(fileNames);
            // add typings for unresolved imports
            if (unresolvedImports) {
                const module = ts.deduplicate(unresolvedImports.map(moduleId => nodeCoreModules.has(moduleId) ? "node" : moduleId), ts.equateStringsCaseSensitive, ts.compareStringsCaseSensitive);
                addInferredTypings(module, "Inferred typings from unresolved imports");
            }
            // Add the cached typing locations for inferred typings that are already installed
            packageNameToTypingLocation.forEach((typing, name) => {
                if (inferredTypings.has(name) && inferredTypings.get(name) === undefined && isTypingUpToDate(typing, typesRegistry.get(name))) {
                    inferredTypings.set(name, typing.typingLocation);
                }
            });
            // Remove typings that the user has added to the exclude list
            for (const excludeTypingName of exclude) {
                const didDelete = inferredTypings.delete(excludeTypingName);
                if (didDelete && log)
                    log(`Typing for ${excludeTypingName} is in exclude list, will be ignored.`);
            }
            const newTypingNames = [];
            const cachedTypingPaths = [];
            inferredTypings.forEach((inferred, typing) => {
                if (inferred !== undefined) {
                    cachedTypingPaths.push(inferred);
                }
                else {
                    newTypingNames.push(typing);
                }
            });
            const result = { cachedTypingPaths, newTypingNames, filesToWatch };
            if (log)
                log(`Result: ${JSON.stringify(result)}`);
            return result;
            function addInferredTyping(typingName) {
                if (!inferredTypings.has(typingName)) {
                    inferredTypings.set(typingName, undefined);
                }
            }
            function addInferredTypings(typingNames, message) {
                if (log)
                    log(`${message}: ${JSON.stringify(typingNames)}`);
                ts.forEach(typingNames, addInferredTyping);
            }
            /**
             * Get the typing info from common package manager json files like package.json or bower.json
             */
            function getTypingNamesFromJson(jsonPath, filesToWatch) {
                if (!host.fileExists(jsonPath)) {
                    return;
                }
                filesToWatch.push(jsonPath);
                const jsonConfig = ts.readConfigFile(jsonPath, path => host.readFile(path)).config;
                const jsonTypingNames = ts.flatMap([jsonConfig.dependencies, jsonConfig.devDependencies, jsonConfig.optionalDependencies, jsonConfig.peerDependencies], ts.getOwnKeys);
                addInferredTypings(jsonTypingNames, `Typing names in '${jsonPath}' dependencies`);
            }
            /**
             * Infer typing names from given file names. For example, the file name "jquery-min.2.3.4.js"
             * should be inferred to the 'jquery' typing name; and "angular-route.1.2.3.js" should be inferred
             * to the 'angular-route' typing name.
             * @param fileNames are the names for source files in the project
             */
            function getTypingNamesFromSourceFileNames(fileNames) {
                const fromFileNames = ts.mapDefined(fileNames, j => {
                    if (!ts.hasJavaScriptFileExtension(j))
                        return undefined;
                    const inferredTypingName = ts.removeFileExtension(ts.getBaseFileName(j.toLowerCase()));
                    const cleanedTypingName = ts.removeMinAndVersionNumbers(inferredTypingName);
                    return safeList.get(cleanedTypingName);
                });
                if (fromFileNames.length) {
                    addInferredTypings(fromFileNames, "Inferred typings from file names");
                }
                const hasJsxFile = ts.some(fileNames, f => ts.fileExtensionIs(f, ts.Extension.Jsx));
                if (hasJsxFile) {
                    if (log)
                        log(`Inferred 'react' typings due to presence of '.jsx' extension`);
                    addInferredTyping("react");
                }
            }
            /**
             * Infer typing names from packages folder (ex: node_module, bower_components)
             * @param packagesFolderPath is the path to the packages folder
             */
            function getTypingNamesFromPackagesFolder(packagesFolderPath, filesToWatch) {
                filesToWatch.push(packagesFolderPath);
                // Todo: add support for ModuleResolutionHost too
                if (!host.directoryExists(packagesFolderPath)) {
                    return;
                }
                // depth of 2, so we access `node_modules/foo` but not `node_modules/foo/bar`
                const fileNames = host.readDirectory(packagesFolderPath, [ts.Extension.Json], /*excludes*/ undefined, /*includes*/ undefined, /*depth*/ 2);
                if (log)
                    log(`Searching for typing names in ${packagesFolderPath}; all files: ${JSON.stringify(fileNames)}`);
                const packageNames = [];
                for (const fileName of fileNames) {
                    const normalizedFileName = ts.normalizePath(fileName);
                    const baseFileName = ts.getBaseFileName(normalizedFileName);
                    if (baseFileName !== "package.json" && baseFileName !== "bower.json") {
                        continue;
                    }
                    const result = ts.readConfigFile(normalizedFileName, (path) => host.readFile(path));
                    const packageJson = result.config;
                    // npm 3's package.json contains a "_requiredBy" field
                    // we should include all the top level module names for npm 2, and only module names whose
                    // "_requiredBy" field starts with "#" or equals "/" for npm 3.
                    if (baseFileName === "package.json" && packageJson._requiredBy &&
                        ts.filter(packageJson._requiredBy, (r) => r[0] === "#" || r === "/").length === 0) {
                        continue;
                    }
                    // If the package has its own d.ts typings, those will take precedence. Otherwise the package name will be used
                    // to download d.ts files from DefinitelyTyped
                    if (!packageJson.name) {
                        continue;
                    }
                    const ownTypes = packageJson.types || packageJson.typings;
                    if (ownTypes) {
                        const absolutePath = ts.getNormalizedAbsolutePath(ownTypes, ts.getDirectoryPath(normalizedFileName));
                        if (log)
                            log(`    Package '${packageJson.name}' provides its own types.`);
                        inferredTypings.set(packageJson.name, absolutePath);
                    }
                    else {
                        packageNames.push(packageJson.name);
                    }
                }
                addInferredTypings(packageNames, "    Found package names");
            }
        }
        JsTyping.discoverTypings = discoverTypings;
        const maxPackageNameLength = 214;
        /**
         * Validates package name using rules defined at https://docs.npmjs.com/files/package.json
         */
        function validatePackageName(packageName) {
            if (!packageName) {
                return 2 /* EmptyName */;
            }
            if (packageName.length > maxPackageNameLength) {
                return 3 /* NameTooLong */;
            }
            if (packageName.charCodeAt(0) === 46 /* dot */) {
                return 4 /* NameStartsWithDot */;
            }
            if (packageName.charCodeAt(0) === 95 /* _ */) {
                return 5 /* NameStartsWithUnderscore */;
            }
            // check if name is scope package like: starts with @ and has one '/' in the middle
            // scoped packages are not currently supported
            // TODO: when support will be added we'll need to split and check both scope and package name
            if (/^@[^/]+\/[^/]+$/.test(packageName)) {
                return 1 /* ScopedPackagesNotSupported */;
            }
            if (encodeURIComponent(packageName) !== packageName) {
                return 6 /* NameContainsNonURISafeCharacters */;
            }
            return 0 /* Ok */;
        }
        JsTyping.validatePackageName = validatePackageName;
        function renderPackageNameValidationFailure(result, typing) {
            switch (result) {
                case 2 /* EmptyName */:
                    return `Package name '${typing}' cannot be empty`;
                case 3 /* NameTooLong */:
                    return `Package name '${typing}' should be less than ${maxPackageNameLength} characters`;
                case 4 /* NameStartsWithDot */:
                    return `Package name '${typing}' cannot start with '.'`;
                case 5 /* NameStartsWithUnderscore */:
                    return `Package name '${typing}' cannot start with '_'`;
                case 1 /* ScopedPackagesNotSupported */:
                    return `Package '${typing}' is scoped and currently is not supported`;
                case 6 /* NameContainsNonURISafeCharacters */:
                    return `Package name '${typing}' contains non URI safe characters`;
                case 0 /* Ok */:
                    return ts.Debug.fail(); // Shouldn't have called this.
                default:
                    ts.Debug.assertNever(result);
            }
        }
        JsTyping.renderPackageNameValidationFailure = renderPackageNameValidationFailure;
    })(JsTyping = ts.JsTyping || (ts.JsTyping = {}));
})(ts || (ts = {}));
