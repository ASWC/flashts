var ts;
(function (ts) {
    function trace(host) {
        host.trace(ts.formatMessage.apply(undefined, arguments));
    }
    ts.trace = trace;
    /* @internal */
    function isTraceEnabled(compilerOptions, host) {
        return compilerOptions.traceResolution && host.trace !== undefined;
    }
    ts.isTraceEnabled = isTraceEnabled;
    function withPackageId(packageId, r) {
        return r && { path: r.path, extension: r.ext, packageId };
    }
    function noPackageId(r) {
        return withPackageId(/*packageId*/ undefined, r);
    }
    /**
     * Kinds of file that we are currently looking for.
     * Typically there is one pass with Extensions.TypeScript, then a second pass with Extensions.JavaScript.
     */
    let Extensions;
    (function (Extensions) {
        Extensions[Extensions["TypeScript"] = 0] = "TypeScript";
        Extensions[Extensions["JavaScript"] = 1] = "JavaScript";
        Extensions[Extensions["DtsOnly"] = 2] = "DtsOnly"; /** Only '.d.ts' */
    })(Extensions || (Extensions = {}));
    /** Used with `Extensions.DtsOnly` to extract the path from TypeScript results. */
    function resolvedTypeScriptOnly(resolved) {
        if (!resolved) {
            return undefined;
        }
        ts.Debug.assert(ts.extensionIsTypeScript(resolved.extension));
        return { fileName: resolved.path, packageId: resolved.packageId };
    }
    function createResolvedModuleWithFailedLookupLocations(resolved, originalPath, isExternalLibraryImport, failedLookupLocations) {
        return {
            resolvedModule: resolved && { resolvedFileName: resolved.path, originalPath, extension: resolved.extension, isExternalLibraryImport, packageId: resolved.packageId },
            failedLookupLocations
        };
    }
    /** Reads from "main" or "types"/"typings" depending on `extensions`. */
    function tryReadPackageJsonFields(readTypes, jsonContent, baseDirectory, state) {
        return readTypes ? tryReadFromField("typings") || tryReadFromField("types") : tryReadFromField("main");
        function tryReadFromField(fieldName) {
            if (!ts.hasProperty(jsonContent, fieldName)) {
                if (state.traceEnabled) {
                    trace(state.host, Diagnostics.package_json_does_not_have_a_0_field, fieldName);
                }
                return;
            }
            const fileName = jsonContent[fieldName];
            if (!ts.isString(fileName)) {
                if (state.traceEnabled) {
                    trace(state.host, Diagnostics.Expected_type_of_0_field_in_package_json_to_be_string_got_1, fieldName, typeof fileName);
                }
                return;
            }
            const path = ts.normalizePath(ts.combinePaths(baseDirectory, fileName));
            if (state.traceEnabled) {
                trace(state.host, Diagnostics.package_json_has_0_field_1_that_references_2, fieldName, fileName, path);
            }
            return path;
        }
    }
    /* @internal */
    function readJson(path, host) {
        try {
            const jsonText = host.readFile(path);
            return jsonText ? JSON.parse(jsonText) : {};
        }
        catch (e) {
            // gracefully handle if readFile fails or returns not JSON
            return {};
        }
    }
    ts.readJson = readJson;
    function getEffectiveTypeRoots(options, host) {
        if (options.typeRoots) {
            return options.typeRoots;
        }
        let currentDirectory;
        if (options.configFilePath) {
            currentDirectory = ts.getDirectoryPath(options.configFilePath);
        }
        else if (host.getCurrentDirectory) {
            currentDirectory = host.getCurrentDirectory();
        }
        if (currentDirectory !== undefined) {
            return getDefaultTypeRoots(currentDirectory, host);
        }
    }
    ts.getEffectiveTypeRoots = getEffectiveTypeRoots;
    /**
     * Returns the path to every node_modules/@types directory from some ancestor directory.
     * Returns undefined if there are none.
     */
    function getDefaultTypeRoots(currentDirectory, host) {
        if (!host.directoryExists) {
            return [ts.combinePaths(currentDirectory, nodeModulesAtTypes)];
            // And if it doesn't exist, tough.
        }
        let typeRoots;
        ts.forEachAncestorDirectory(ts.normalizePath(currentDirectory), directory => {
            const atTypes = ts.combinePaths(directory, nodeModulesAtTypes);
            if (host.directoryExists(atTypes)) {
                (typeRoots || (typeRoots = [])).push(atTypes);
            }
            return undefined;
        });
        return typeRoots;
    }
    const nodeModulesAtTypes = ts.combinePaths("node_modules", "@types");
    /**
     * @param {string | undefined} containingFile - file that contains type reference directive, can be undefined if containing file is unknown.
     * This is possible in case if resolution is performed for directives specified via 'types' parameter. In this case initial path for secondary lookups
     * is assumed to be the same as root directory of the project.
     */
    function resolveTypeReferenceDirective(typeReferenceDirectiveName, containingFile, options, host) {
        const traceEnabled = isTraceEnabled(options, host);
        const moduleResolutionState = { compilerOptions: options, host, traceEnabled };
        const typeRoots = getEffectiveTypeRoots(options, host);
        if (traceEnabled) {
            if (containingFile === undefined) {
                if (typeRoots === undefined) {
                    trace(host, Diagnostics.Resolving_type_reference_directive_0_containing_file_not_set_root_directory_not_set, typeReferenceDirectiveName);
                }
                else {
                    trace(host, Diagnostics.Resolving_type_reference_directive_0_containing_file_not_set_root_directory_1, typeReferenceDirectiveName, typeRoots);
                }
            }
            else {
                if (typeRoots === undefined) {
                    trace(host, Diagnostics.Resolving_type_reference_directive_0_containing_file_1_root_directory_not_set, typeReferenceDirectiveName, containingFile);
                }
                else {
                    trace(host, Diagnostics.Resolving_type_reference_directive_0_containing_file_1_root_directory_2, typeReferenceDirectiveName, containingFile, typeRoots);
                }
            }
        }
        const failedLookupLocations = [];
        let resolved = primaryLookup();
        let primary = true;
        if (!resolved) {
            resolved = secondaryLookup();
            primary = false;
        }
        let resolvedTypeReferenceDirective;
        if (resolved) {
            if (!options.preserveSymlinks) {
                resolved = Object.assign({}, resolved, { fileName: realPath(resolved.fileName, host, traceEnabled) });
            }
            if (traceEnabled) {
                trace(host, Diagnostics.Type_reference_directive_0_was_successfully_resolved_to_1_primary_Colon_2, typeReferenceDirectiveName, resolved.fileName, primary);
            }
            resolvedTypeReferenceDirective = { primary, resolvedFileName: resolved.fileName, packageId: resolved.packageId };
        }
        return { resolvedTypeReferenceDirective, failedLookupLocations };
        function primaryLookup() {
            // Check primary library paths
            if (typeRoots && typeRoots.length) {
                if (traceEnabled) {
                    trace(host, Diagnostics.Resolving_with_primary_search_path_0, typeRoots.join(", "));
                }
                return ts.forEach(typeRoots, typeRoot => {
                    const candidate = ts.combinePaths(typeRoot, typeReferenceDirectiveName);
                    const candidateDirectory = ts.getDirectoryPath(candidate);
                    const directoryExists = directoryProbablyExists(candidateDirectory, host);
                    if (!directoryExists && traceEnabled) {
                        trace(host, Diagnostics.Directory_0_does_not_exist_skipping_all_lookups_in_it, candidateDirectory);
                    }
                    return resolvedTypeScriptOnly(loadNodeModuleFromDirectory(Extensions.DtsOnly, candidate, failedLookupLocations, !directoryExists, moduleResolutionState));
                });
            }
            else {
                if (traceEnabled) {
                    trace(host, Diagnostics.Root_directory_cannot_be_determined_skipping_primary_search_paths);
                }
            }
        }
        function secondaryLookup() {
            let resolvedFile;
            const initialLocationForSecondaryLookup = containingFile && ts.getDirectoryPath(containingFile);
            if (initialLocationForSecondaryLookup !== undefined) {
                // check secondary locations
                if (traceEnabled) {
                    trace(host, Diagnostics.Looking_up_in_node_modules_folder_initial_location_0, initialLocationForSecondaryLookup);
                }
                const result = loadModuleFromNodeModules(Extensions.DtsOnly, typeReferenceDirectiveName, initialLocationForSecondaryLookup, failedLookupLocations, moduleResolutionState, /*cache*/ undefined);
                resolvedFile = resolvedTypeScriptOnly(result && result.value);
                if (!resolvedFile && traceEnabled) {
                    trace(host, Diagnostics.Type_reference_directive_0_was_not_resolved, typeReferenceDirectiveName);
                }
                return resolvedFile;
            }
            else {
                if (traceEnabled) {
                    trace(host, Diagnostics.Containing_file_is_not_specified_and_root_directory_cannot_be_determined_skipping_lookup_in_node_modules_folder);
                }
            }
        }
    }
    ts.resolveTypeReferenceDirective = resolveTypeReferenceDirective;
    /**
     * Given a set of options, returns the set of type directive names
     *   that should be included for this program automatically.
     * This list could either come from the config file,
     *   or from enumerating the types root + initial secondary types lookup location.
     * More type directives might appear in the program later as a result of loading actual source files;
     *   this list is only the set of defaults that are implicitly included.
     */
    function getAutomaticTypeDirectiveNames(options, host) {
        // Use explicit type list from tsconfig.json
        if (options.types) {
            return options.types;
        }
        // Walk the primary type lookup locations
        const result = [];
        if (host.directoryExists && host.getDirectories) {
            const typeRoots = getEffectiveTypeRoots(options, host);
            if (typeRoots) {
                for (const root of typeRoots) {
                    if (host.directoryExists(root)) {
                        for (const typeDirectivePath of host.getDirectories(root)) {
                            const normalized = ts.normalizePath(typeDirectivePath);
                            const packageJsonPath = pathToPackageJson(ts.combinePaths(root, normalized));
                            // `types-publisher` sometimes creates packages with `"typings": null` for packages that don't provide their own types.
                            // See `createNotNeededPackageJSON` in the types-publisher` repo.
                            // tslint:disable-next-line:no-null-keyword
                            const isNotNeededPackage = host.fileExists(packageJsonPath) && readJson(packageJsonPath, host).typings === null;
                            if (!isNotNeededPackage) {
                                // Return just the type directive names
                                result.push(ts.getBaseFileName(normalized));
                            }
                        }
                    }
                }
            }
        }
        return result;
    }
    ts.getAutomaticTypeDirectiveNames = getAutomaticTypeDirectiveNames;
    function createModuleResolutionCache(currentDirectory, getCanonicalFileName) {
        return createModuleResolutionCacheWithMaps(ts.createMap(), ts.createMap(), currentDirectory, getCanonicalFileName);
    }
    ts.createModuleResolutionCache = createModuleResolutionCache;
    /*@internal*/
    function createModuleResolutionCacheWithMaps(directoryToModuleNameMap, moduleNameToDirectoryMap, currentDirectory, getCanonicalFileName) {
        return { getOrCreateCacheForDirectory, getOrCreateCacheForModuleName };
        function getOrCreateCacheForDirectory(directoryName) {
            const path = ts.toPath(directoryName, currentDirectory, getCanonicalFileName);
            let perFolderCache = directoryToModuleNameMap.get(path);
            if (!perFolderCache) {
                perFolderCache = ts.createMap();
                directoryToModuleNameMap.set(path, perFolderCache);
            }
            return perFolderCache;
        }
        function getOrCreateCacheForModuleName(nonRelativeModuleName) {
            if (ts.isExternalModuleNameRelative(nonRelativeModuleName)) {
                return undefined;
            }
            let perModuleNameCache = moduleNameToDirectoryMap.get(nonRelativeModuleName);
            if (!perModuleNameCache) {
                perModuleNameCache = createPerModuleNameCache();
                moduleNameToDirectoryMap.set(nonRelativeModuleName, perModuleNameCache);
            }
            return perModuleNameCache;
        }
        function createPerModuleNameCache() {
            const directoryPathMap = ts.createMap();
            return { get, set };
            function get(directory) {
                return directoryPathMap.get(ts.toPath(directory, currentDirectory, getCanonicalFileName));
            }
            /**
             * At first this function add entry directory -> module resolution result to the table.
             * Then it computes the set of parent folders for 'directory' that should have the same module resolution result
             * and for every parent folder in set it adds entry: parent -> module resolution. .
             * Lets say we first directory name: /a/b/c/d/e and resolution result is: /a/b/bar.ts.
             * Set of parent folders that should have the same result will be:
             * [
             *     /a/b/c/d, /a/b/c, /a/b
             * ]
             * this means that request for module resolution from file in any of these folder will be immediately found in cache.
             */
            function set(directory, result) {
                const path = ts.toPath(directory, currentDirectory, getCanonicalFileName);
                // if entry is already in cache do nothing
                if (directoryPathMap.has(path)) {
                    return;
                }
                directoryPathMap.set(path, result);
                const resolvedFileName = result.resolvedModule && result.resolvedModule.resolvedFileName;
                // find common prefix between directory and resolved file name
                // this common prefix should be the shorted path that has the same resolution
                // directory: /a/b/c/d/e
                // resolvedFileName: /a/b/foo.d.ts
                const commonPrefix = getCommonPrefix(path, resolvedFileName);
                let current = path;
                while (true) {
                    const parent = ts.getDirectoryPath(current);
                    if (parent === current || directoryPathMap.has(parent)) {
                        break;
                    }
                    directoryPathMap.set(parent, result);
                    current = parent;
                    if (current === commonPrefix) {
                        break;
                    }
                }
            }
            function getCommonPrefix(directory, resolution) {
                if (resolution === undefined) {
                    return undefined;
                }
                const resolutionDirectory = ts.toPath(ts.getDirectoryPath(resolution), currentDirectory, getCanonicalFileName);
                // find first position where directory and resolution differs
                let i = 0;
                while (i < Math.min(directory.length, resolutionDirectory.length) && directory.charCodeAt(i) === resolutionDirectory.charCodeAt(i)) {
                    i++;
                }
                // find last directory separator before position i
                const sep = directory.lastIndexOf(ts.directorySeparator, i);
                if (sep < 0) {
                    return undefined;
                }
                return directory.substr(0, sep);
            }
        }
    }
    ts.createModuleResolutionCacheWithMaps = createModuleResolutionCacheWithMaps;
    function resolveModuleNameFromCache(moduleName, containingFile, cache) {
        const containingDirectory = ts.getDirectoryPath(containingFile);
        const perFolderCache = cache && cache.getOrCreateCacheForDirectory(containingDirectory);
        return perFolderCache && perFolderCache.get(moduleName);
    }
    ts.resolveModuleNameFromCache = resolveModuleNameFromCache;
    function resolveModuleName(moduleName, containingFile, compilerOptions, host, cache) {
        const traceEnabled = isTraceEnabled(compilerOptions, host);
        if (traceEnabled) {
            trace(host, Diagnostics.Resolving_module_0_from_1, moduleName, containingFile);
        }
        const containingDirectory = ts.getDirectoryPath(containingFile);
        const perFolderCache = cache && cache.getOrCreateCacheForDirectory(containingDirectory);
        let result = perFolderCache && perFolderCache.get(moduleName);
        if (result) {
            if (traceEnabled) {
                trace(host, Diagnostics.Resolution_for_module_0_was_found_in_cache_from_location_1, moduleName, containingDirectory);
            }
        }
        else {
            let moduleResolution = compilerOptions.moduleResolution;
            if (moduleResolution === undefined) {
                moduleResolution = ts.getEmitModuleKind(compilerOptions) === ts.ModuleKind.CommonJS ? ts.ModuleResolutionKind.NodeJs : ts.ModuleResolutionKind.Classic;
                if (traceEnabled) {
                    trace(host, Diagnostics.Module_resolution_kind_is_not_specified_using_0, ts.ModuleResolutionKind[moduleResolution]);
                }
            }
            else {
                if (traceEnabled) {
                    trace(host, Diagnostics.Explicitly_specified_module_resolution_kind_Colon_0, ts.ModuleResolutionKind[moduleResolution]);
                }
            }
            switch (moduleResolution) {
                case ts.ModuleResolutionKind.NodeJs:
                    result = nodeModuleNameResolver(moduleName, containingFile, compilerOptions, host, cache);
                    break;
                case ts.ModuleResolutionKind.Classic:
                    result = classicNameResolver(moduleName, containingFile, compilerOptions, host, cache);
                    break;
                default:
                    ts.Debug.fail(`Unexpected moduleResolution: ${moduleResolution}`);
            }
            if (perFolderCache) {
                perFolderCache.set(moduleName, result);
                // put result in per-module name cache
                const perModuleNameCache = cache.getOrCreateCacheForModuleName(moduleName);
                if (perModuleNameCache) {
                    perModuleNameCache.set(containingDirectory, result);
                }
            }
        }
        if (traceEnabled) {
            if (result.resolvedModule) {
                trace(host, Diagnostics.Module_name_0_was_successfully_resolved_to_1, moduleName, result.resolvedModule.resolvedFileName);
            }
            else {
                trace(host, Diagnostics.Module_name_0_was_not_resolved, moduleName);
            }
        }
        return result;
    }
    ts.resolveModuleName = resolveModuleName;
    /**
     * Any module resolution kind can be augmented with optional settings: 'baseUrl', 'paths' and 'rootDirs' - they are used to
     * mitigate differences between design time structure of the project and its runtime counterpart so the same import name
     * can be resolved successfully by TypeScript compiler and runtime module loader.
     * If these settings are set then loading procedure will try to use them to resolve module name and it can of failure it will
     * fallback to standard resolution routine.
     *
     * - baseUrl - this setting controls how non-relative module names are resolved. If this setting is specified then non-relative
     * names will be resolved relative to baseUrl: i.e. if baseUrl is '/a/b' then candidate location to resolve module name 'c/d' will
     * be '/a/b/c/d'
     * - paths - this setting can only be used when baseUrl is specified. allows to tune how non-relative module names
     * will be resolved based on the content of the module name.
     * Structure of 'paths' compiler options
     * 'paths': {
     *    pattern-1: [...substitutions],
     *    pattern-2: [...substitutions],
     *    ...
     *    pattern-n: [...substitutions]
     * }
     * Pattern here is a string that can contain zero or one '*' character. During module resolution module name will be matched against
     * all patterns in the list. Matching for patterns that don't contain '*' means that module name must be equal to pattern respecting the case.
     * If pattern contains '*' then to match pattern "<prefix>*<suffix>" module name must start with the <prefix> and end with <suffix>.
     * <MatchedStar> denotes part of the module name between <prefix> and <suffix>.
     * If module name can be matches with multiple patterns then pattern with the longest prefix will be picked.
     * After selecting pattern we'll use list of substitutions to get candidate locations of the module and the try to load module
     * from the candidate location.
     * Substitution is a string that can contain zero or one '*'. To get candidate location from substitution we'll pick every
     * substitution in the list and replace '*' with <MatchedStar> string. If candidate location is not rooted it
     * will be converted to absolute using baseUrl.
     * For example:
     * baseUrl: /a/b/c
     * "paths": {
     *     // match all module names
     *     "*": [
     *         "*",        // use matched name as is,
     *                     // <matched name> will be looked as /a/b/c/<matched name>
     *
     *         "folder1/*" // substitution will convert matched name to 'folder1/<matched name>',
     *                     // since it is not rooted then final candidate location will be /a/b/c/folder1/<matched name>
     *     ],
     *     // match module names that start with 'components/'
     *     "components/*": [ "/root/components/*" ] // substitution will convert /components/folder1/<matched name> to '/root/components/folder1/<matched name>',
     *                                              // it is rooted so it will be final candidate location
     * }
     *
     * 'rootDirs' allows the project to be spreaded across multiple locations and resolve modules with relative names as if
     * they were in the same location. For example lets say there are two files
     * '/local/src/content/file1.ts'
     * '/shared/components/contracts/src/content/protocols/file2.ts'
     * After bundling content of '/shared/components/contracts/src' will be merged with '/local/src' so
     * if file1 has the following import 'import {x} from "./protocols/file2"' it will be resolved successfully in runtime.
     * 'rootDirs' provides the way to tell compiler that in order to get the whole project it should behave as if content of all
     * root dirs were merged together.
     * I.e. for the example above 'rootDirs' will have two entries: [ '/local/src', '/shared/components/contracts/src' ].
     * Compiler will first convert './protocols/file2' into absolute path relative to the location of containing file:
     * '/local/src/content/protocols/file2' and try to load it - failure.
     * Then it will search 'rootDirs' looking for a longest matching prefix of this absolute path and if such prefix is found - absolute path will
     * be converted to a path relative to found rootDir entry './content/protocols/file2' (*). As a last step compiler will check all remaining
     * entries in 'rootDirs', use them to build absolute path out of (*) and try to resolve module from this location.
     */
    function tryLoadModuleUsingOptionalResolutionSettings(extensions, moduleName, containingDirectory, loader, failedLookupLocations, state) {
        if (!ts.isExternalModuleNameRelative(moduleName)) {
            return tryLoadModuleUsingBaseUrl(extensions, moduleName, loader, failedLookupLocations, state);
        }
        else {
            return tryLoadModuleUsingRootDirs(extensions, moduleName, containingDirectory, loader, failedLookupLocations, state);
        }
    }
    function tryLoadModuleUsingRootDirs(extensions, moduleName, containingDirectory, loader, failedLookupLocations, state) {
        if (!state.compilerOptions.rootDirs) {
            return undefined;
        }
        if (state.traceEnabled) {
            trace(state.host, Diagnostics.rootDirs_option_is_set_using_it_to_resolve_relative_module_name_0, moduleName);
        }
        const candidate = ts.normalizePath(ts.combinePaths(containingDirectory, moduleName));
        let matchedRootDir;
        let matchedNormalizedPrefix;
        for (const rootDir of state.compilerOptions.rootDirs) {
            // rootDirs are expected to be absolute
            // in case of tsconfig.json this will happen automatically - compiler will expand relative names
            // using location of tsconfig.json as base location
            let normalizedRoot = ts.normalizePath(rootDir);
            if (!ts.endsWith(normalizedRoot, ts.directorySeparator)) {
                normalizedRoot += ts.directorySeparator;
            }
            const isLongestMatchingPrefix = ts.startsWith(candidate, normalizedRoot) &&
                (matchedNormalizedPrefix === undefined || matchedNormalizedPrefix.length < normalizedRoot.length);
            if (state.traceEnabled) {
                trace(state.host, Diagnostics.Checking_if_0_is_the_longest_matching_prefix_for_1_2, normalizedRoot, candidate, isLongestMatchingPrefix);
            }
            if (isLongestMatchingPrefix) {
                matchedNormalizedPrefix = normalizedRoot;
                matchedRootDir = rootDir;
            }
        }
        if (matchedNormalizedPrefix) {
            if (state.traceEnabled) {
                trace(state.host, Diagnostics.Longest_matching_prefix_for_0_is_1, candidate, matchedNormalizedPrefix);
            }
            const suffix = candidate.substr(matchedNormalizedPrefix.length);
            // first - try to load from a initial location
            if (state.traceEnabled) {
                trace(state.host, Diagnostics.Loading_0_from_the_root_dir_1_candidate_location_2, suffix, matchedNormalizedPrefix, candidate);
            }
            const resolvedFileName = loader(extensions, candidate, failedLookupLocations, !directoryProbablyExists(containingDirectory, state.host), state);
            if (resolvedFileName) {
                return resolvedFileName;
            }
            if (state.traceEnabled) {
                trace(state.host, Diagnostics.Trying_other_entries_in_rootDirs);
            }
            // then try to resolve using remaining entries in rootDirs
            for (const rootDir of state.compilerOptions.rootDirs) {
                if (rootDir === matchedRootDir) {
                    // skip the initially matched entry
                    continue;
                }
                const candidate = ts.combinePaths(ts.normalizePath(rootDir), suffix);
                if (state.traceEnabled) {
                    trace(state.host, Diagnostics.Loading_0_from_the_root_dir_1_candidate_location_2, suffix, rootDir, candidate);
                }
                const baseDirectory = ts.getDirectoryPath(candidate);
                const resolvedFileName = loader(extensions, candidate, failedLookupLocations, !directoryProbablyExists(baseDirectory, state.host), state);
                if (resolvedFileName) {
                    return resolvedFileName;
                }
            }
            if (state.traceEnabled) {
                trace(state.host, Diagnostics.Module_resolution_using_rootDirs_has_failed);
            }
        }
        return undefined;
    }
    function tryLoadModuleUsingBaseUrl(extensions, moduleName, loader, failedLookupLocations, state) {
        if (!state.compilerOptions.baseUrl) {
            return undefined;
        }
        if (state.traceEnabled) {
            trace(state.host, Diagnostics.baseUrl_option_is_set_to_0_using_this_value_to_resolve_non_relative_module_name_1, state.compilerOptions.baseUrl, moduleName);
        }
        // string is for exact match
        let matchedPattern;
        if (state.compilerOptions.paths) {
            if (state.traceEnabled) {
                trace(state.host, Diagnostics.paths_option_is_specified_looking_for_a_pattern_to_match_module_name_0, moduleName);
            }
            matchedPattern = ts.matchPatternOrExact(ts.getOwnKeys(state.compilerOptions.paths), moduleName);
        }
        if (matchedPattern) {
            const matchedStar = ts.isString(matchedPattern) ? undefined : ts.matchedText(matchedPattern, moduleName);
            const matchedPatternText = ts.isString(matchedPattern) ? matchedPattern : ts.patternText(matchedPattern);
            if (state.traceEnabled) {
                trace(state.host, Diagnostics.Module_name_0_matched_pattern_1, moduleName, matchedPatternText);
            }
            return ts.forEach(state.compilerOptions.paths[matchedPatternText], subst => {
                const path = matchedStar ? subst.replace("*", matchedStar) : subst;
                const candidate = ts.normalizePath(ts.combinePaths(state.compilerOptions.baseUrl, path));
                if (state.traceEnabled) {
                    trace(state.host, Diagnostics.Trying_substitution_0_candidate_module_location_Colon_1, subst, path);
                }
                // A path mapping may have an extension, in contrast to an import, which should omit it.
                const extension = ts.tryGetExtensionFromPath(candidate);
                if (extension !== undefined) {
                    const path = tryFile(candidate, failedLookupLocations, /*onlyRecordFailures*/ false, state);
                    if (path !== undefined) {
                        return noPackageId({ path, ext: extension });
                    }
                }
                return loader(extensions, candidate, failedLookupLocations, !directoryProbablyExists(ts.getDirectoryPath(candidate), state.host), state);
            });
        }
        else {
            const candidate = ts.normalizePath(ts.combinePaths(state.compilerOptions.baseUrl, moduleName));
            if (state.traceEnabled) {
                trace(state.host, Diagnostics.Resolving_module_name_0_relative_to_base_url_1_2, moduleName, state.compilerOptions.baseUrl, candidate);
            }
            return loader(extensions, candidate, failedLookupLocations, !directoryProbablyExists(ts.getDirectoryPath(candidate), state.host), state);
        }
    }
    function nodeModuleNameResolver(moduleName, containingFile, compilerOptions, host, cache) {
        return nodeModuleNameResolverWorker(moduleName, ts.getDirectoryPath(containingFile), compilerOptions, host, cache, /*jsOnly*/ false);
    }
    ts.nodeModuleNameResolver = nodeModuleNameResolver;
    /**
     * Expose resolution logic to allow us to use Node module resolution logic from arbitrary locations.
     * No way to do this with `require()`: https://github.com/nodejs/node/issues/5963
     * Throws an error if the module can't be resolved.
     */
    /* @internal */
    function resolveJavaScriptModule(moduleName, initialDir, host) {
        const { resolvedModule, failedLookupLocations } = nodeModuleNameResolverWorker(moduleName, initialDir, { moduleResolution: ts.ModuleResolutionKind.NodeJs, allowJs: true }, host, /*cache*/ undefined, /*jsOnly*/ true);
        if (!resolvedModule) {
            throw new Error(`Could not resolve JS module '${moduleName}' starting at '${initialDir}'. Looked in: ${failedLookupLocations.join(", ")}`);
        }
        return resolvedModule.resolvedFileName;
    }
    ts.resolveJavaScriptModule = resolveJavaScriptModule;
    function nodeModuleNameResolverWorker(moduleName, containingDirectory, compilerOptions, host, cache, jsOnly) {
        const traceEnabled = isTraceEnabled(compilerOptions, host);
        const failedLookupLocations = [];
        const state = { compilerOptions, host, traceEnabled };
        const result = jsOnly ? tryResolve(Extensions.JavaScript) : (tryResolve(Extensions.TypeScript) || tryResolve(Extensions.JavaScript));
        if (result && result.value) {
            const { resolved, originalPath, isExternalLibraryImport } = result.value;
            return createResolvedModuleWithFailedLookupLocations(resolved, originalPath, isExternalLibraryImport, failedLookupLocations);
        }
        return { resolvedModule: undefined, failedLookupLocations };
        function tryResolve(extensions) {
            const loader = (extensions, candidate, failedLookupLocations, onlyRecordFailures, state) => nodeLoadModuleByRelativeName(extensions, candidate, failedLookupLocations, onlyRecordFailures, state, /*considerPackageJson*/ true);
            const resolved = tryLoadModuleUsingOptionalResolutionSettings(extensions, moduleName, containingDirectory, loader, failedLookupLocations, state);
            if (resolved) {
                return toSearchResult({ resolved, isExternalLibraryImport: false });
            }
            if (!ts.isExternalModuleNameRelative(moduleName)) {
                if (traceEnabled) {
                    trace(host, Diagnostics.Loading_module_0_from_node_modules_folder_target_file_type_1, moduleName, Extensions[extensions]);
                }
                const resolved = loadModuleFromNodeModules(extensions, moduleName, containingDirectory, failedLookupLocations, state, cache);
                if (!resolved)
                    return undefined;
                let resolvedValue = resolved.value;
                let originalPath;
                if (!compilerOptions.preserveSymlinks && resolvedValue) {
                    originalPath = resolvedValue.path;
                    const path = realPath(resolved.value.path, host, traceEnabled);
                    if (path === originalPath) {
                        originalPath = undefined;
                    }
                    resolvedValue = Object.assign({}, resolvedValue, { path });
                }
                // For node_modules lookups, get the real path so that multiple accesses to an `npm link`-ed module do not create duplicate files.
                return { value: resolvedValue && { resolved: resolvedValue, originalPath, isExternalLibraryImport: true } };
            }
            else {
                const { path: candidate, parts } = ts.normalizePathAndParts(ts.combinePaths(containingDirectory, moduleName));
                const resolved = nodeLoadModuleByRelativeName(extensions, candidate, failedLookupLocations, /*onlyRecordFailures*/ false, state, /*considerPackageJson*/ true);
                // Treat explicit "node_modules" import as an external library import.
                return resolved && toSearchResult({ resolved, isExternalLibraryImport: ts.contains(parts, "node_modules") });
            }
        }
    }
    function realPath(path, host, traceEnabled) {
        if (!host.realpath) {
            return path;
        }
        const real = ts.normalizePath(host.realpath(path));
        if (traceEnabled) {
            trace(host, Diagnostics.Resolving_real_path_for_0_result_1, path, real);
        }
        ts.Debug.assert(host.fileExists(real), `${path} linked to nonexistent file ${real}`); // tslint:disable-line
        return real;
    }
    function nodeLoadModuleByRelativeName(extensions, candidate, failedLookupLocations, onlyRecordFailures, state, considerPackageJson) {
        if (state.traceEnabled) {
            trace(state.host, Diagnostics.Loading_module_as_file_Slash_folder_candidate_module_location_0_target_file_type_1, candidate, Extensions[extensions]);
        }
        if (!ts.pathEndsWithDirectorySeparator(candidate)) {
            if (!onlyRecordFailures) {
                const parentOfCandidate = ts.getDirectoryPath(candidate);
                if (!directoryProbablyExists(parentOfCandidate, state.host)) {
                    if (state.traceEnabled) {
                        trace(state.host, Diagnostics.Directory_0_does_not_exist_skipping_all_lookups_in_it, parentOfCandidate);
                    }
                    onlyRecordFailures = true;
                }
            }
            const resolvedFromFile = loadModuleFromFile(extensions, candidate, failedLookupLocations, onlyRecordFailures, state);
            if (resolvedFromFile) {
                const nm = considerPackageJson ? parseNodeModuleFromPath(resolvedFromFile) : undefined;
                const packageId = nm && getPackageJsonInfo(nm.packageDirectory, nm.subModuleName, failedLookupLocations, /*onlyRecordFailures*/ false, state).packageId;
                return withPackageId(packageId, resolvedFromFile);
            }
        }
        if (!onlyRecordFailures) {
            const candidateExists = directoryProbablyExists(candidate, state.host);
            if (!candidateExists) {
                if (state.traceEnabled) {
                    trace(state.host, Diagnostics.Directory_0_does_not_exist_skipping_all_lookups_in_it, candidate);
                }
                onlyRecordFailures = true;
            }
        }
        return loadNodeModuleFromDirectory(extensions, candidate, failedLookupLocations, onlyRecordFailures, state, considerPackageJson);
    }
    const nodeModulesPathPart = "/node_modules/";
    /**
     * This will be called on the successfully resolved path from `loadModuleFromFile`.
     * (Not neeeded for `loadModuleFromNodeModules` as that looks up the `package.json` as part of resolution.)
     *
     * packageDirectory is the directory of the package itself.
     * subModuleName is the path within the package.
     *   For `blah/node_modules/foo/index.d.ts` this is { packageDirectory: "foo", subModuleName: "index.d.ts" }. (Part before "/node_modules/" is ignored.)
     *   For `/node_modules/foo/bar.d.ts` this is { packageDirectory: "foo", subModuleName": "bar/index.d.ts" }.
     *   For `/node_modules/@types/foo/bar/index.d.ts` this is { packageDirectory: "@types/foo", subModuleName: "bar/index.d.ts" }.
     *   For `/node_modules/foo/bar/index.d.ts` this is { packageDirectory: "foo", subModuleName": "bar/index.d.ts" }.
     */
    function parseNodeModuleFromPath(resolved) {
        const path = ts.normalizePath(resolved.path);
        const idx = path.lastIndexOf(nodeModulesPathPart);
        if (idx === -1) {
            return undefined;
        }
        const indexAfterNodeModules = idx + nodeModulesPathPart.length;
        let indexAfterPackageName = moveToNextDirectorySeparatorIfAvailable(path, indexAfterNodeModules);
        if (path.charCodeAt(indexAfterNodeModules) === 64 /* at */) {
            indexAfterPackageName = moveToNextDirectorySeparatorIfAvailable(path, indexAfterPackageName);
        }
        const packageDirectory = path.slice(0, indexAfterPackageName);
        const subModuleName = ts.removeExtension(path.slice(indexAfterPackageName + 1), resolved.ext) + ts.Extension.Dts;
        return { packageDirectory, subModuleName };
    }
    function moveToNextDirectorySeparatorIfAvailable(path, prevSeparatorIndex) {
        const nextSeparatorIndex = path.indexOf(ts.directorySeparator, prevSeparatorIndex + 1);
        return nextSeparatorIndex === -1 ? prevSeparatorIndex : nextSeparatorIndex;
    }
    function addExtensionAndIndex(path) {
        if (path === "") {
            return "index.d.ts";
        }
        if (ts.endsWith(path, ".d.ts")) {
            return path;
        }
        if (ts.endsWith(path, "/index")) {
            return path + ".d.ts";
        }
        return path + "/index.d.ts";
    }
    /* @internal */
    function directoryProbablyExists(directoryName, host) {
        // if host does not support 'directoryExists' assume that directory will exist
        return !host.directoryExists || host.directoryExists(directoryName);
    }
    ts.directoryProbablyExists = directoryProbablyExists;
    function loadModuleFromFileNoPackageId(extensions, candidate, failedLookupLocations, onlyRecordFailures, state) {
        return noPackageId(loadModuleFromFile(extensions, candidate, failedLookupLocations, onlyRecordFailures, state));
    }
    /**
     * @param {boolean} onlyRecordFailures - if true then function won't try to actually load files but instead record all attempts as failures. This flag is necessary
     * in cases when we know upfront that all load attempts will fail (because containing folder does not exists) however we still need to record all failed lookup locations.
     */
    function loadModuleFromFile(extensions, candidate, failedLookupLocations, onlyRecordFailures, state) {
        // First, try adding an extension. An import of "foo" could be matched by a file "foo.ts", or "foo.js" by "foo.js.ts"
        const resolvedByAddingExtension = tryAddingExtensions(candidate, extensions, failedLookupLocations, onlyRecordFailures, state);
        if (resolvedByAddingExtension) {
            return resolvedByAddingExtension;
        }
        // If that didn't work, try stripping a ".js" or ".jsx" extension and replacing it with a TypeScript one;
        // e.g. "./foo.js" can be matched by "./foo.ts" or "./foo.d.ts"
        if (ts.hasJavaScriptFileExtension(candidate)) {
            const extensionless = ts.removeFileExtension(candidate);
            if (state.traceEnabled) {
                const extension = candidate.substring(extensionless.length);
                trace(state.host, Diagnostics.File_name_0_has_a_1_extension_stripping_it, candidate, extension);
            }
            return tryAddingExtensions(extensionless, extensions, failedLookupLocations, onlyRecordFailures, state);
        }
    }
    /** Try to return an existing file that adds one of the `extensions` to `candidate`. */
    function tryAddingExtensions(candidate, extensions, failedLookupLocations, onlyRecordFailures, state) {
        if (!onlyRecordFailures) {
            // check if containing folder exists - if it doesn't then just record failures for all supported extensions without disk probing
            const directory = ts.getDirectoryPath(candidate);
            if (directory) {
                onlyRecordFailures = !directoryProbablyExists(directory, state.host);
            }
        }
        switch (extensions) {
            case Extensions.DtsOnly:
                return tryExtension(ts.Extension.Dts);
            case Extensions.TypeScript:
                return tryExtension(ts.Extension.Ts) || tryExtension(ts.Extension.Tsx) || tryExtension(ts.Extension.Dts);
            case Extensions.JavaScript:
                return tryExtension(ts.Extension.Js) || tryExtension(ts.Extension.Jsx);
        }
        function tryExtension(ext) {
            const path = tryFile(candidate + ext, failedLookupLocations, onlyRecordFailures, state);
            return path && { path, ext };
        }
    }
    /** Return the file if it exists. */
    function tryFile(fileName, failedLookupLocations, onlyRecordFailures, state) {
        if (!onlyRecordFailures) {
            if (state.host.fileExists(fileName)) {
                if (state.traceEnabled) {
                    trace(state.host, Diagnostics.File_0_exist_use_it_as_a_name_resolution_result, fileName);
                }
                return fileName;
            }
            else {
                if (state.traceEnabled) {
                    trace(state.host, Diagnostics.File_0_does_not_exist, fileName);
                }
            }
        }
        failedLookupLocations.push(fileName);
        return undefined;
    }
    function loadNodeModuleFromDirectory(extensions, candidate, failedLookupLocations, onlyRecordFailures, state, considerPackageJson = true) {
        const { packageJsonContent, packageId } = considerPackageJson
            ? getPackageJsonInfo(candidate, "", failedLookupLocations, onlyRecordFailures, state)
            : { packageJsonContent: undefined, packageId: undefined };
        return withPackageId(packageId, loadNodeModuleFromDirectoryWorker(extensions, candidate, failedLookupLocations, onlyRecordFailures, state, packageJsonContent));
    }
    function loadNodeModuleFromDirectoryWorker(extensions, candidate, failedLookupLocations, onlyRecordFailures, state, packageJsonContent) {
        const fromPackageJson = packageJsonContent && loadModuleFromPackageJson(packageJsonContent, extensions, candidate, failedLookupLocations, state);
        if (fromPackageJson) {
            return fromPackageJson;
        }
        const directoryExists = !onlyRecordFailures && directoryProbablyExists(candidate, state.host);
        return loadModuleFromFile(extensions, ts.combinePaths(candidate, "index"), failedLookupLocations, !directoryExists, state);
    }
    function getPackageJsonInfo(nodeModuleDirectory, subModuleName, failedLookupLocations, onlyRecordFailures, state) {
        const { host, traceEnabled } = state;
        const directoryExists = !onlyRecordFailures && directoryProbablyExists(nodeModuleDirectory, host);
        const packageJsonPath = pathToPackageJson(nodeModuleDirectory);
        if (directoryExists && host.fileExists(packageJsonPath)) {
            const packageJsonContent = readJson(packageJsonPath, host);
            if (subModuleName === "") { // looking up the root - need to handle types/typings/main redirects for subModuleName
                const path = tryReadPackageJsonFields(/*readTypes*/ true, packageJsonContent, nodeModuleDirectory, state);
                if (typeof path === "string") {
                    subModuleName = addExtensionAndIndex(path.substring(nodeModuleDirectory.length + 1));
                }
                else {
                    const jsPath = tryReadPackageJsonFields(/*readTypes*/ false, packageJsonContent, nodeModuleDirectory, state);
                    if (typeof jsPath === "string") {
                        subModuleName = ts.removeExtension(ts.removeExtension(jsPath.substring(nodeModuleDirectory.length + 1), ts.Extension.Js), ts.Extension.Jsx) + ts.Extension.Dts;
                    }
                    else {
                        subModuleName = "index.d.ts";
                    }
                }
            }
            if (!ts.endsWith(subModuleName, ts.Extension.Dts)) {
                subModuleName = addExtensionAndIndex(subModuleName);
            }
            const packageId = typeof packageJsonContent.name === "string" && typeof packageJsonContent.version === "string"
                ? { name: packageJsonContent.name, subModuleName, version: packageJsonContent.version }
                : undefined;
            if (traceEnabled) {
                if (packageId) {
                    trace(host, Diagnostics.Found_package_json_at_0_Package_ID_is_1, packageJsonPath, ts.packageIdToString(packageId));
                }
                else {
                    trace(host, Diagnostics.Found_package_json_at_0, packageJsonPath);
                }
            }
            return { found: true, packageJsonContent, packageId };
        }
        else {
            if (directoryExists && traceEnabled) {
                trace(host, Diagnostics.File_0_does_not_exist, packageJsonPath);
            }
            // record package json as one of failed lookup locations - in the future if this file will appear it will invalidate resolution results
            failedLookupLocations.push(packageJsonPath);
            return { found: false, packageJsonContent: undefined, packageId: undefined };
        }
    }
    function loadModuleFromPackageJson(jsonContent, extensions, candidate, failedLookupLocations, state) {
        const file = tryReadPackageJsonFields(extensions !== Extensions.JavaScript, jsonContent, candidate, state);
        if (!file) {
            return undefined;
        }
        const onlyRecordFailures = !directoryProbablyExists(ts.getDirectoryPath(file), state.host);
        const fromFile = tryFile(file, failedLookupLocations, onlyRecordFailures, state);
        if (fromFile) {
            const resolved = resolvedIfExtensionMatches(extensions, fromFile);
            if (resolved) {
                return resolved;
            }
            if (state.traceEnabled) {
                trace(state.host, Diagnostics.File_0_has_an_unsupported_extension_so_skipping_it, fromFile);
            }
        }
        // Even if extensions is DtsOnly, we can still look up a .ts file as a result of package.json "types"
        const nextExtensions = extensions === Extensions.DtsOnly ? Extensions.TypeScript : extensions;
        // Don't do package.json lookup recursively, because Node.js' package lookup doesn't.
        const result = nodeLoadModuleByRelativeName(nextExtensions, file, failedLookupLocations, onlyRecordFailures, state, /*considerPackageJson*/ false);
        if (result) {
            // It won't have a `packageId` set, because we disabled `considerPackageJson`.
            ts.Debug.assert(result.packageId === undefined);
            return { path: result.path, ext: result.extension };
        }
    }
    /** Resolve from an arbitrarily specified file. Return `undefined` if it has an unsupported extension. */
    function resolvedIfExtensionMatches(extensions, path) {
        const ext = ts.tryGetExtensionFromPath(path);
        return ext !== undefined && extensionIsOk(extensions, ext) ? { path, ext } : undefined;
    }
    /** True if `extension` is one of the supported `extensions`. */
    function extensionIsOk(extensions, extension) {
        switch (extensions) {
            case Extensions.JavaScript:
                return extension === ts.Extension.Js || extension === ts.Extension.Jsx;
            case Extensions.TypeScript:
                return extension === ts.Extension.Ts || extension === ts.Extension.Tsx || extension === ts.Extension.Dts;
            case Extensions.DtsOnly:
                return extension === ts.Extension.Dts;
        }
    }
    function pathToPackageJson(directory) {
        return ts.combinePaths(directory, "package.json");
    }
    function loadModuleFromNodeModulesFolder(extensions, moduleName, nodeModulesFolder, nodeModulesFolderExists, failedLookupLocations, state) {
        const candidate = ts.normalizePath(ts.combinePaths(nodeModulesFolder, moduleName));
        // First look for a nested package.json, as in `node_modules/foo/bar/package.json`.
        let packageJsonContent;
        let packageId;
        const packageInfo = getPackageJsonInfo(candidate, "", failedLookupLocations, /*onlyRecordFailures*/ !nodeModulesFolderExists, state);
        if (packageInfo.found) {
            ({ packageJsonContent, packageId } = packageInfo);
        }
        else {
            const { packageName, rest } = getPackageName(moduleName);
            if (rest !== "") { // If "rest" is empty, we just did this search above.
                const packageRootPath = ts.combinePaths(nodeModulesFolder, packageName);
                // Don't use a "types" or "main" from here because we're not loading the root, but a subdirectory -- just here for the packageId.
                packageId = getPackageJsonInfo(packageRootPath, rest, failedLookupLocations, !nodeModulesFolderExists, state).packageId;
            }
        }
        const pathAndExtension = loadModuleFromFile(extensions, candidate, failedLookupLocations, !nodeModulesFolderExists, state) ||
            loadNodeModuleFromDirectoryWorker(extensions, candidate, failedLookupLocations, !nodeModulesFolderExists, state, packageJsonContent);
        return withPackageId(packageId, pathAndExtension);
    }
    /* @internal */
    function getPackageName(moduleName) {
        let idx = moduleName.indexOf(ts.directorySeparator);
        if (moduleName[0] === "@") {
            idx = moduleName.indexOf(ts.directorySeparator, idx + 1);
        }
        return idx === -1 ? { packageName: moduleName, rest: "" } : { packageName: moduleName.slice(0, idx), rest: moduleName.slice(idx + 1) };
    }
    ts.getPackageName = getPackageName;
    function loadModuleFromNodeModules(extensions, moduleName, directory, failedLookupLocations, state, cache) {
        return loadModuleFromNodeModulesWorker(extensions, moduleName, directory, failedLookupLocations, state, /*typesOnly*/ false, cache);
    }
    function loadModuleFromNodeModulesAtTypes(moduleName, directory, failedLookupLocations, state) {
        // Extensions parameter here doesn't actually matter, because typesOnly ensures we're just doing @types lookup, which is always DtsOnly.
        return loadModuleFromNodeModulesWorker(Extensions.DtsOnly, moduleName, directory, failedLookupLocations, state, /*typesOnly*/ true, /*cache*/ undefined);
    }
    function loadModuleFromNodeModulesWorker(extensions, moduleName, directory, failedLookupLocations, state, typesOnly, cache) {
        const perModuleNameCache = cache && cache.getOrCreateCacheForModuleName(moduleName);
        return ts.forEachAncestorDirectory(ts.normalizeSlashes(directory), ancestorDirectory => {
            if (ts.getBaseFileName(ancestorDirectory) !== "node_modules") {
                const resolutionFromCache = tryFindNonRelativeModuleNameInCache(perModuleNameCache, moduleName, ancestorDirectory, state.traceEnabled, state.host, failedLookupLocations);
                if (resolutionFromCache) {
                    return resolutionFromCache;
                }
                return toSearchResult(loadModuleFromNodeModulesOneLevel(extensions, moduleName, ancestorDirectory, failedLookupLocations, state, typesOnly));
            }
        });
    }
    /** Load a module from a single node_modules directory, but not from any ancestors' node_modules directories. */
    function loadModuleFromNodeModulesOneLevel(extensions, moduleName, directory, failedLookupLocations, state, typesOnly = false) {
        const nodeModulesFolder = ts.combinePaths(directory, "node_modules");
        const nodeModulesFolderExists = directoryProbablyExists(nodeModulesFolder, state.host);
        if (!nodeModulesFolderExists && state.traceEnabled) {
            trace(state.host, Diagnostics.Directory_0_does_not_exist_skipping_all_lookups_in_it, nodeModulesFolder);
        }
        const packageResult = typesOnly ? undefined : loadModuleFromNodeModulesFolder(extensions, moduleName, nodeModulesFolder, nodeModulesFolderExists, failedLookupLocations, state);
        if (packageResult) {
            return packageResult;
        }
        if (extensions !== Extensions.JavaScript) {
            const nodeModulesAtTypes = ts.combinePaths(nodeModulesFolder, "@types");
            let nodeModulesAtTypesExists = nodeModulesFolderExists;
            if (nodeModulesFolderExists && !directoryProbablyExists(nodeModulesAtTypes, state.host)) {
                if (state.traceEnabled) {
                    trace(state.host, Diagnostics.Directory_0_does_not_exist_skipping_all_lookups_in_it, nodeModulesAtTypes);
                }
                nodeModulesAtTypesExists = false;
            }
            return loadModuleFromNodeModulesFolder(Extensions.DtsOnly, mangleScopedPackage(moduleName, state), nodeModulesAtTypes, nodeModulesAtTypesExists, failedLookupLocations, state);
        }
    }
    /** Double underscores are used in DefinitelyTyped to delimit scoped packages. */
    const mangledScopedPackageSeparator = "__";
    /** For a scoped package, we must look in `@types/foo__bar` instead of `@types/@foo/bar`. */
    function mangleScopedPackage(packageName, state) {
        const mangled = getMangledNameForScopedPackage(packageName);
        if (state.traceEnabled && mangled !== packageName) {
            trace(state.host, Diagnostics.Scoped_package_detected_looking_in_0, mangled);
        }
        return mangled;
    }
    /* @internal */
    function getTypesPackageName(packageName) {
        return `@types/${getMangledNameForScopedPackage(packageName)}`;
    }
    ts.getTypesPackageName = getTypesPackageName;
    /* @internal */
    function getMangledNameForScopedPackage(packageName) {
        if (ts.startsWith(packageName, "@")) {
            const replaceSlash = packageName.replace(ts.directorySeparator, mangledScopedPackageSeparator);
            if (replaceSlash !== packageName) {
                return replaceSlash.slice(1); // Take off the "@"
            }
        }
        return packageName;
    }
    ts.getMangledNameForScopedPackage = getMangledNameForScopedPackage;
    /* @internal */
    function getPackageNameFromAtTypesDirectory(mangledName) {
        const withoutAtTypePrefix = ts.removePrefix(mangledName, "@types/");
        if (withoutAtTypePrefix !== mangledName) {
            return getUnmangledNameForScopedPackage(withoutAtTypePrefix);
        }
        return mangledName;
    }
    ts.getPackageNameFromAtTypesDirectory = getPackageNameFromAtTypesDirectory;
    /* @internal */
    function getUnmangledNameForScopedPackage(typesPackageName) {
        return ts.stringContains(typesPackageName, mangledScopedPackageSeparator) ?
            "@" + typesPackageName.replace(mangledScopedPackageSeparator, ts.directorySeparator) :
            typesPackageName;
    }
    ts.getUnmangledNameForScopedPackage = getUnmangledNameForScopedPackage;
    function tryFindNonRelativeModuleNameInCache(cache, moduleName, containingDirectory, traceEnabled, host, failedLookupLocations) {
        const result = cache && cache.get(containingDirectory);
        if (result) {
            if (traceEnabled) {
                trace(host, Diagnostics.Resolution_for_module_0_was_found_in_cache_from_location_1, moduleName, containingDirectory);
            }
            failedLookupLocations.push(...result.failedLookupLocations);
            return { value: result.resolvedModule && { path: result.resolvedModule.resolvedFileName, extension: result.resolvedModule.extension, packageId: result.resolvedModule.packageId } };
        }
    }
    function classicNameResolver(moduleName, containingFile, compilerOptions, host, cache) {
        const traceEnabled = isTraceEnabled(compilerOptions, host);
        const state = { compilerOptions, host, traceEnabled };
        const failedLookupLocations = [];
        const containingDirectory = ts.getDirectoryPath(containingFile);
        const resolved = tryResolve(Extensions.TypeScript) || tryResolve(Extensions.JavaScript);
        // No originalPath because classic resolution doesn't resolve realPath
        return createResolvedModuleWithFailedLookupLocations(resolved && resolved.value, /*originalPath*/ undefined, /*isExternalLibraryImport*/ false, failedLookupLocations);
        function tryResolve(extensions) {
            const resolvedUsingSettings = tryLoadModuleUsingOptionalResolutionSettings(extensions, moduleName, containingDirectory, loadModuleFromFileNoPackageId, failedLookupLocations, state);
            if (resolvedUsingSettings) {
                return { value: resolvedUsingSettings };
            }
            const perModuleNameCache = cache && cache.getOrCreateCacheForModuleName(moduleName);
            if (!ts.isExternalModuleNameRelative(moduleName)) {
                // Climb up parent directories looking for a module.
                const resolved = ts.forEachAncestorDirectory(containingDirectory, directory => {
                    const resolutionFromCache = tryFindNonRelativeModuleNameInCache(perModuleNameCache, moduleName, directory, traceEnabled, host, failedLookupLocations);
                    if (resolutionFromCache) {
                        return resolutionFromCache;
                    }
                    const searchName = ts.normalizePath(ts.combinePaths(directory, moduleName));
                    return toSearchResult(loadModuleFromFileNoPackageId(extensions, searchName, failedLookupLocations, /*onlyRecordFailures*/ false, state));
                });
                if (resolved) {
                    return resolved;
                }
                if (extensions === Extensions.TypeScript) {
                    // If we didn't find the file normally, look it up in @types.
                    return loadModuleFromNodeModulesAtTypes(moduleName, containingDirectory, failedLookupLocations, state);
                }
            }
            else {
                const candidate = ts.normalizePath(ts.combinePaths(containingDirectory, moduleName));
                return toSearchResult(loadModuleFromFileNoPackageId(extensions, candidate, failedLookupLocations, /*onlyRecordFailures*/ false, state));
            }
        }
    }
    ts.classicNameResolver = classicNameResolver;
    /**
     * LSHost may load a module from a global cache of typings.
     * This is the minumum code needed to expose that functionality; the rest is in LSHost.
     */
    /* @internal */
    function loadModuleFromGlobalCache(moduleName, projectName, compilerOptions, host, globalCache) {
        const traceEnabled = isTraceEnabled(compilerOptions, host);
        if (traceEnabled) {
            trace(host, Diagnostics.Auto_discovery_for_typings_is_enabled_in_project_0_Running_extra_resolution_pass_for_module_1_using_cache_location_2, projectName, moduleName, globalCache);
        }
        const state = { compilerOptions, host, traceEnabled };
        const failedLookupLocations = [];
        const resolved = loadModuleFromNodeModulesOneLevel(Extensions.DtsOnly, moduleName, globalCache, failedLookupLocations, state);
        return createResolvedModuleWithFailedLookupLocations(resolved, /*originalPath*/ undefined, /*isExternalLibraryImport*/ true, failedLookupLocations);
    }
    ts.loadModuleFromGlobalCache = loadModuleFromGlobalCache;
    /**
     * Wraps value to SearchResult.
     * @returns undefined if value is undefined or { value } otherwise
     */
    function toSearchResult(value) {
        return value !== undefined ? { value } : undefined;
    }
})(ts || (ts = {}));
