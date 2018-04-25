/* @internal */
var ts;
(function (ts) {
    var Completions;
    (function (Completions) {
        var PathCompletions;
        (function (PathCompletions) {
            function nameAndKind(name, kind) {
                return { name, kind };
            }
            function addReplacementSpans(text, textStart, names) {
                const span = getDirectoryFragmentTextSpan(text, textStart);
                return names.map(({ name, kind }) => ({ name, kind, span }));
            }
            function getStringLiteralCompletionsFromModuleNames(sourceFile, node, compilerOptions, host, typeChecker) {
                return addReplacementSpans(node.text, node.getStart(sourceFile) + 1, getStringLiteralCompletionsFromModuleNamesWorker(node, compilerOptions, host, typeChecker));
            }
            PathCompletions.getStringLiteralCompletionsFromModuleNames = getStringLiteralCompletionsFromModuleNames;
            function getStringLiteralCompletionsFromModuleNamesWorker(node, compilerOptions, host, typeChecker) {
                const literalValue = ts.normalizeSlashes(node.text);
                const scriptPath = node.getSourceFile().path;
                const scriptDirectory = ts.getDirectoryPath(scriptPath);
                if (isPathRelativeToScript(literalValue) || ts.isRootedDiskPath(literalValue)) {
                    const extensions = ts.getSupportedExtensions(compilerOptions);
                    if (compilerOptions.rootDirs) {
                        return getCompletionEntriesForDirectoryFragmentWithRootDirs(compilerOptions.rootDirs, literalValue, scriptDirectory, extensions, /*includeExtensions*/ false, compilerOptions, host, scriptPath);
                    }
                    else {
                        return getCompletionEntriesForDirectoryFragment(literalValue, scriptDirectory, extensions, /*includeExtensions*/ false, host, scriptPath);
                    }
                }
                else {
                    // Check for node modules
                    return getCompletionEntriesForNonRelativeModules(literalValue, scriptDirectory, compilerOptions, host, typeChecker);
                }
            }
            /**
             * Takes a script path and returns paths for all potential folders that could be merged with its
             * containing folder via the "rootDirs" compiler option
             */
            function getBaseDirectoriesFromRootDirs(rootDirs, basePath, scriptPath, ignoreCase) {
                // Make all paths absolute/normalized if they are not already
                rootDirs = rootDirs.map(rootDirectory => ts.normalizePath(ts.isRootedDiskPath(rootDirectory) ? rootDirectory : ts.combinePaths(basePath, rootDirectory)));
                // Determine the path to the directory containing the script relative to the root directory it is contained within
                const relativeDirectory = ts.firstDefined(rootDirs, rootDirectory => ts.containsPath(rootDirectory, scriptPath, basePath, ignoreCase) ? scriptPath.substr(rootDirectory.length) : undefined);
                // Now find a path for each potential directory that is to be merged with the one containing the script
                return ts.deduplicate(rootDirs.map(rootDirectory => ts.combinePaths(rootDirectory, relativeDirectory)), ts.equateStringsCaseSensitive, ts.compareStringsCaseSensitive);
            }
            function getCompletionEntriesForDirectoryFragmentWithRootDirs(rootDirs, fragment, scriptPath, extensions, includeExtensions, compilerOptions, host, exclude) {
                const basePath = compilerOptions.project || host.getCurrentDirectory();
                const ignoreCase = !(host.useCaseSensitiveFileNames && host.useCaseSensitiveFileNames());
                const baseDirectories = getBaseDirectoriesFromRootDirs(rootDirs, basePath, scriptPath, ignoreCase);
                const result = [];
                for (const baseDirectory of baseDirectories) {
                    getCompletionEntriesForDirectoryFragment(fragment, baseDirectory, extensions, includeExtensions, host, exclude, result);
                }
                return result;
            }
            /**
             * Given a path ending at a directory, gets the completions for the path, and filters for those entries containing the basename.
             */
            function getCompletionEntriesForDirectoryFragment(fragment, scriptPath, extensions, includeExtensions, host, exclude, result = []) {
                if (fragment === undefined) {
                    fragment = "";
                }
                fragment = ts.normalizeSlashes(fragment);
                /**
                 * Remove the basename from the path. Note that we don't use the basename to filter completions;
                 * the client is responsible for refining completions.
                 */
                fragment = ts.getDirectoryPath(fragment);
                if (fragment === "") {
                    fragment = "." + ts.directorySeparator;
                }
                fragment = ts.ensureTrailingDirectorySeparator(fragment);
                const absolutePath = normalizeAndPreserveTrailingSlash(ts.isRootedDiskPath(fragment) ? fragment : ts.combinePaths(scriptPath, fragment));
                const baseDirectory = ts.getDirectoryPath(absolutePath);
                const ignoreCase = !(host.useCaseSensitiveFileNames && host.useCaseSensitiveFileNames());
                if (tryDirectoryExists(host, baseDirectory)) {
                    // Enumerate the available files if possible
                    const files = tryReadDirectory(host, baseDirectory, extensions, /*exclude*/ undefined, /*include*/ ["./*"]);
                    if (files) {
                        /**
                         * Multiple file entries might map to the same truncated name once we remove extensions
                         * (happens iff includeExtensions === false)so we use a set-like data structure. Eg:
                         *
                         * both foo.ts and foo.tsx become foo
                         */
                        const foundFiles = ts.createMap();
                        for (let filePath of files) {
                            filePath = ts.normalizePath(filePath);
                            if (exclude && ts.comparePaths(filePath, exclude, scriptPath, ignoreCase) === 0 /* EqualTo */) {
                                continue;
                            }
                            const foundFileName = includeExtensions ? ts.getBaseFileName(filePath) : ts.removeFileExtension(ts.getBaseFileName(filePath));
                            if (!foundFiles.has(foundFileName)) {
                                foundFiles.set(foundFileName, true);
                            }
                        }
                        ts.forEachKey(foundFiles, foundFile => {
                            result.push(nameAndKind(foundFile, ts.ScriptElementKind.scriptElement));
                        });
                    }
                    // If possible, get folder completion as well
                    const directories = tryGetDirectories(host, baseDirectory);
                    if (directories) {
                        for (const directory of directories) {
                            const directoryName = ts.getBaseFileName(ts.normalizePath(directory));
                            if (directoryName !== "@types") {
                                result.push(nameAndKind(directoryName, ts.ScriptElementKind.directory));
                            }
                        }
                    }
                }
                return result;
            }
            /**
             * Check all of the declared modules and those in node modules. Possible sources of modules:
             *      Modules that are found by the type checker
             *      Modules found relative to "baseUrl" compliler options (including patterns from "paths" compiler option)
             *      Modules from node_modules (i.e. those listed in package.json)
             *          This includes all files that are found in node_modules/moduleName/ with acceptable file extensions
             */
            function getCompletionEntriesForNonRelativeModules(fragment, scriptPath, compilerOptions, host, typeChecker) {
                const { baseUrl, paths } = compilerOptions;
                const result = [];
                const fileExtensions = ts.getSupportedExtensions(compilerOptions);
                if (baseUrl) {
                    const projectDir = compilerOptions.project || host.getCurrentDirectory();
                    const absolute = ts.isRootedDiskPath(baseUrl) ? baseUrl : ts.combinePaths(projectDir, baseUrl);
                    getCompletionEntriesForDirectoryFragment(fragment, ts.normalizePath(absolute), fileExtensions, /*includeExtensions*/ false, host, /*exclude*/ undefined, result);
                    for (const path in paths) {
                        const patterns = paths[path];
                        if (paths.hasOwnProperty(path) && patterns) {
                            for (const { name, kind } of getCompletionsForPathMapping(path, patterns, fragment, baseUrl, fileExtensions, host)) {
                                // Path mappings may provide a duplicate way to get to something we've already added, so don't add again.
                                if (!result.some(entry => entry.name === name)) {
                                    result.push(nameAndKind(name, kind));
                                }
                            }
                        }
                    }
                }
                const fragmentDirectory = containsSlash(fragment) ? ts.getDirectoryPath(fragment) : undefined;
                for (const ambientName of getAmbientModuleCompletions(fragment, fragmentDirectory, typeChecker)) {
                    result.push(nameAndKind(ambientName, ts.ScriptElementKind.externalModuleName));
                }
                getCompletionEntriesFromTypings(host, compilerOptions, scriptPath, result);
                if (ts.getEmitModuleResolutionKind(compilerOptions) === ts.ModuleResolutionKind.NodeJs) {
                    // If looking for a global package name, don't just include everything in `node_modules` because that includes dependencies' own dependencies.
                    // (But do if we didn't find anything, e.g. 'package.json' missing.)
                    let foundGlobal = false;
                    if (fragmentDirectory === undefined) {
                        for (const moduleName of enumerateNodeModulesVisibleToScript(host, scriptPath)) {
                            if (!result.some(entry => entry.name === moduleName)) {
                                foundGlobal = true;
                                result.push(nameAndKind(moduleName, ts.ScriptElementKind.externalModuleName));
                            }
                        }
                    }
                    if (!foundGlobal) {
                        ts.forEachAncestorDirectory(scriptPath, ancestor => {
                            const nodeModules = ts.combinePaths(ancestor, "node_modules");
                            if (tryDirectoryExists(host, nodeModules)) {
                                getCompletionEntriesForDirectoryFragment(fragment, nodeModules, fileExtensions, /*includeExtensions*/ false, host, /*exclude*/ undefined, result);
                            }
                        });
                    }
                }
                return result;
            }
            function getCompletionsForPathMapping(path, patterns, fragment, baseUrl, fileExtensions, host) {
                if (!ts.endsWith(path, "*")) {
                    // For a path mapping "foo": ["/x/y/z.ts"], add "foo" itself as a completion.
                    return !ts.stringContains(path, "*") && ts.startsWith(path, fragment) ? [{ name: path, kind: ts.ScriptElementKind.directory }] : ts.emptyArray;
                }
                const pathPrefix = path.slice(0, path.length - 1);
                if (!ts.startsWith(fragment, pathPrefix)) {
                    return [{ name: pathPrefix, kind: ts.ScriptElementKind.directory }];
                }
                const remainingFragment = fragment.slice(pathPrefix.length);
                return ts.flatMap(patterns, pattern => getModulesForPathsPattern(remainingFragment, baseUrl, pattern, fileExtensions, host));
            }
            function getModulesForPathsPattern(fragment, baseUrl, pattern, fileExtensions, host) {
                if (!host.readDirectory) {
                    return undefined;
                }
                const parsed = ts.hasZeroOrOneAsteriskCharacter(pattern) ? ts.tryParsePattern(pattern) : undefined;
                if (!parsed) {
                    return undefined;
                }
                // The prefix has two effective parts: the directory path and the base component after the filepath that is not a
                // full directory component. For example: directory/path/of/prefix/base*
                const normalizedPrefix = normalizeAndPreserveTrailingSlash(parsed.prefix);
                const normalizedPrefixDirectory = ts.getDirectoryPath(normalizedPrefix);
                const normalizedPrefixBase = ts.getBaseFileName(normalizedPrefix);
                const fragmentHasPath = containsSlash(fragment);
                // Try and expand the prefix to include any path from the fragment so that we can limit the readDirectory call
                const expandedPrefixDirectory = fragmentHasPath ? ts.combinePaths(normalizedPrefixDirectory, normalizedPrefixBase + ts.getDirectoryPath(fragment)) : normalizedPrefixDirectory;
                const normalizedSuffix = ts.normalizePath(parsed.suffix);
                // Need to normalize after combining: If we combinePaths("a", "../b"), we want "b" and not "a/../b".
                const baseDirectory = ts.normalizePath(ts.combinePaths(baseUrl, expandedPrefixDirectory));
                const completePrefix = fragmentHasPath ? baseDirectory : ts.ensureTrailingDirectorySeparator(baseDirectory) + normalizedPrefixBase;
                // If we have a suffix, then we need to read the directory all the way down. We could create a glob
                // that encodes the suffix, but we would have to escape the character "?" which readDirectory
                // doesn't support. For now, this is safer but slower
                const includeGlob = normalizedSuffix ? "**/*" : "./*";
                const matches = tryReadDirectory(host, baseDirectory, fileExtensions, /*exclude*/ undefined, [includeGlob]).map(name => ({ name, kind: ts.ScriptElementKind.scriptElement }));
                const directories = tryGetDirectories(host, baseDirectory).map(d => ts.combinePaths(baseDirectory, d)).map(name => ({ name, kind: ts.ScriptElementKind.directory }));
                // Trim away prefix and suffix
                return ts.mapDefined(ts.concatenate(matches, directories), ({ name, kind }) => {
                    const normalizedMatch = ts.normalizePath(name);
                    const inner = withoutStartAndEnd(normalizedMatch, completePrefix, normalizedSuffix);
                    return inner !== undefined ? { name: removeLeadingDirectorySeparator(ts.removeFileExtension(inner)), kind } : undefined;
                });
            }
            function withoutStartAndEnd(s, start, end) {
                return ts.startsWith(s, start) && ts.endsWith(s, end) ? s.slice(start.length, s.length - end.length) : undefined;
            }
            function removeLeadingDirectorySeparator(path) {
                return path[0] === ts.directorySeparator ? path.slice(1) : path;
            }
            function getAmbientModuleCompletions(fragment, fragmentDirectory, checker) {
                // Get modules that the type checker picked up
                const ambientModules = checker.getAmbientModules().map(sym => ts.stripQuotes(sym.name));
                const nonRelativeModuleNames = ambientModules.filter(moduleName => ts.startsWith(moduleName, fragment));
                // Nested modules of the form "module-name/sub" need to be adjusted to only return the string
                // after the last '/' that appears in the fragment because that's where the replacement span
                // starts
                if (fragmentDirectory !== undefined) {
                    const moduleNameWithSeperator = ts.ensureTrailingDirectorySeparator(fragmentDirectory);
                    return nonRelativeModuleNames.map(nonRelativeModuleName => ts.removePrefix(nonRelativeModuleName, moduleNameWithSeperator));
                }
                return nonRelativeModuleNames;
            }
            function getTripleSlashReferenceCompletion(sourceFile, position, compilerOptions, host) {
                const token = ts.getTokenAtPosition(sourceFile, position, /*includeJsDocComment*/ false);
                const commentRanges = ts.getLeadingCommentRanges(sourceFile.text, token.pos);
                const range = commentRanges && ts.find(commentRanges, commentRange => position >= commentRange.pos && position <= commentRange.end);
                if (!range) {
                    return undefined;
                }
                const text = sourceFile.text.slice(range.pos, position);
                const match = tripleSlashDirectiveFragmentRegex.exec(text);
                if (!match) {
                    return undefined;
                }
                const [, prefix, kind, toComplete] = match;
                const scriptPath = ts.getDirectoryPath(sourceFile.path);
                const names = kind === "path" ? getCompletionEntriesForDirectoryFragment(toComplete, scriptPath, ts.getSupportedExtensions(compilerOptions), /*includeExtensions*/ true, host, sourceFile.path)
                    : kind === "types" ? getCompletionEntriesFromTypings(host, compilerOptions, scriptPath)
                        : undefined;
                return names && addReplacementSpans(toComplete, range.pos + prefix.length, names);
            }
            PathCompletions.getTripleSlashReferenceCompletion = getTripleSlashReferenceCompletion;
            function getCompletionEntriesFromTypings(host, options, scriptPath, result = []) {
                // Check for typings specified in compiler options
                const seen = ts.createMap();
                if (options.types) {
                    for (const typesName of options.types) {
                        const moduleName = ts.getUnmangledNameForScopedPackage(typesName);
                        pushResult(moduleName);
                    }
                }
                else if (host.getDirectories) {
                    let typeRoots;
                    try {
                        typeRoots = ts.getEffectiveTypeRoots(options, host);
                    }
                    catch ( /* Wrap in try catch because getEffectiveTypeRoots touches the filesystem */_b) { /* Wrap in try catch because getEffectiveTypeRoots touches the filesystem */ }
                    if (typeRoots) {
                        for (const root of typeRoots) {
                            getCompletionEntriesFromDirectories(root);
                        }
                    }
                    // Also get all @types typings installed in visible node_modules directories
                    for (const packageJson of findPackageJsons(scriptPath, host)) {
                        const typesDir = ts.combinePaths(ts.getDirectoryPath(packageJson), "node_modules/@types");
                        getCompletionEntriesFromDirectories(typesDir);
                    }
                }
                return result;
                function getCompletionEntriesFromDirectories(directory) {
                    ts.Debug.assert(!!host.getDirectories);
                    if (tryDirectoryExists(host, directory)) {
                        const directories = tryGetDirectories(host, directory);
                        if (directories) {
                            for (let typeDirectory of directories) {
                                typeDirectory = ts.normalizePath(typeDirectory);
                                const directoryName = ts.getBaseFileName(typeDirectory);
                                const moduleName = ts.getUnmangledNameForScopedPackage(directoryName);
                                pushResult(moduleName);
                            }
                        }
                    }
                }
                function pushResult(moduleName) {
                    if (!seen.has(moduleName)) {
                        result.push(nameAndKind(moduleName, ts.ScriptElementKind.externalModuleName));
                        seen.set(moduleName, true);
                    }
                }
            }
            function findPackageJsons(directory, host) {
                const paths = [];
                ts.forEachAncestorDirectory(directory, ancestor => {
                    const currentConfigPath = ts.findConfigFile(ancestor, (f) => tryFileExists(host, f), "package.json");
                    if (!currentConfigPath) {
                        return true; // break out
                    }
                    paths.push(currentConfigPath);
                });
                return paths;
            }
            function enumerateNodeModulesVisibleToScript(host, scriptPath) {
                if (!host.readFile || !host.fileExists)
                    return ts.emptyArray;
                const result = [];
                for (const packageJson of findPackageJsons(scriptPath, host)) {
                    const contents = ts.readJson(packageJson, host); // Cast to assert that readFile is defined
                    // Provide completions for all non @types dependencies
                    for (const key of nodeModulesDependencyKeys) {
                        const dependencies = contents[key];
                        if (!dependencies)
                            continue;
                        for (const dep in dependencies) {
                            if (dependencies.hasOwnProperty(dep) && !ts.startsWith(dep, "@types/")) {
                                result.push(dep);
                            }
                        }
                    }
                }
                return result;
            }
            // Replace everything after the last directory seperator that appears
            function getDirectoryFragmentTextSpan(text, textStart) {
                const index = Math.max(text.lastIndexOf(ts.directorySeparator), text.lastIndexOf("\\"));
                const offset = index !== -1 ? index + 1 : 0;
                // If the range is an identifier, span is unnecessary.
                const length = text.length - offset;
                return length === 0 || ts.isIdentifierText(text.substr(offset, length), ts.ScriptTarget.ESNext) ? undefined : ts.createTextSpan(textStart + offset, length);
            }
            // Returns true if the path is explicitly relative to the script (i.e. relative to . or ..)
            function isPathRelativeToScript(path) {
                if (path && path.length >= 2 && path.charCodeAt(0) === 46 /* dot */) {
                    const slashIndex = path.length >= 3 && path.charCodeAt(1) === 46 /* dot */ ? 2 : 1;
                    const slashCharCode = path.charCodeAt(slashIndex);
                    return slashCharCode === 47 /* slash */ || slashCharCode === 92 /* backslash */;
                }
                return false;
            }
            function normalizeAndPreserveTrailingSlash(path) {
                if (ts.normalizeSlashes(path) === "./") {
                    // normalizePath turns "./" into "". "" + "/" would then be a rooted path instead of a relative one, so avoid this particular case.
                    // There is no problem for adding "/" to a non-empty string -- it's only a problem at the beginning.
                    return "";
                }
                const norm = ts.normalizePath(path);
                return ts.hasTrailingDirectorySeparator(path) ? ts.ensureTrailingDirectorySeparator(norm) : norm;
            }
            /**
             * Matches a triple slash reference directive with an incomplete string literal for its path. Used
             * to determine if the caret is currently within the string literal and capture the literal fragment
             * for completions.
             * For example, this matches
             *
             * /// <reference path="fragment
             *
             * but not
             *
             * /// <reference path="fragment"
             */
            const tripleSlashDirectiveFragmentRegex = /^(\/\/\/\s*<reference\s+(path|types)\s*=\s*(?:'|"))([^\3"]*)$/;
            const nodeModulesDependencyKeys = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
            function tryGetDirectories(host, directoryName) {
                return tryIOAndConsumeErrors(host, host.getDirectories, directoryName) || [];
            }
            function tryReadDirectory(host, path, extensions, exclude, include) {
                return tryIOAndConsumeErrors(host, host.readDirectory, path, extensions, exclude, include) || ts.emptyArray;
            }
            function tryFileExists(host, path) {
                return tryIOAndConsumeErrors(host, host.fileExists, path);
            }
            function tryDirectoryExists(host, path) {
                try {
                    return ts.directoryProbablyExists(path, host);
                }
                catch ( /*ignore*/_b) { /*ignore*/ }
                return undefined;
            }
            function tryIOAndConsumeErrors(host, toApply, ...args) {
                try {
                    return toApply && toApply.apply(host, args);
                }
                catch ( /*ignore*/_b) { /*ignore*/ }
                return undefined;
            }
            function containsSlash(fragment) {
                return ts.stringContains(fragment, ts.directorySeparator);
            }
        })(PathCompletions = Completions.PathCompletions || (Completions.PathCompletions = {}));
    })(Completions = ts.Completions || (ts.Completions = {}));
})(ts || (ts = {}));
