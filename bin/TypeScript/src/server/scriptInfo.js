var ts;
(function (ts) {
    var server;
    (function (server) {
        /* @internal */
        class TextStorage {
            constructor(host, fileName) {
                this.host = host;
                this.fileName = fileName;
                this.svcVersion = 0;
                this.textVersion = 0;
            }
            getVersion() {
                return this.svc
                    ? `SVC-${this.svcVersion}-${this.svc.getSnapshotVersion()}`
                    : `Text-${this.textVersion}`;
            }
            hasScriptVersionCache_TestOnly() {
                return this.svc !== undefined;
            }
            useScriptVersionCache_TestOnly() {
                this.switchToScriptVersionCache();
            }
            useText(newText) {
                this.svc = undefined;
                this.text = newText;
                this.lineMap = undefined;
                this.textVersion++;
            }
            edit(start, end, newText) {
                this.switchToScriptVersionCache().edit(start, end - start, newText);
                this.ownFileText = false;
                this.text = undefined;
                this.lineMap = undefined;
            }
            /**
             * Set the contents as newText
             * returns true if text changed
             */
            reload(newText) {
                ts.Debug.assert(newText !== undefined);
                // Reload always has fresh content
                this.pendingReloadFromDisk = false;
                // If text changed set the text
                // This also ensures that if we had switched to version cache,
                // we are switching back to text.
                // The change to version cache will happen when needed
                // Thus avoiding the computation if there are no changes
                if (this.text !== newText) {
                    this.useText(newText);
                    // We cant guarantee new text is own file text
                    this.ownFileText = false;
                    return true;
                }
            }
            /**
             * Reads the contents from tempFile(if supplied) or own file and sets it as contents
             * returns true if text changed
             */
            reloadWithFileText(tempFileName) {
                const reloaded = this.reload(this.getFileText(tempFileName));
                this.ownFileText = !tempFileName || tempFileName === this.fileName;
                return reloaded;
            }
            /**
             * Reloads the contents from the file if there is no pending reload from disk or the contents of file are same as file text
             * returns true if text changed
             */
            reloadFromDisk() {
                if (!this.pendingReloadFromDisk && !this.ownFileText) {
                    return this.reloadWithFileText();
                }
                return false;
            }
            delayReloadFromFileIntoText() {
                this.pendingReloadFromDisk = true;
            }
            getSnapshot() {
                return this.useScriptVersionCacheIfValidOrOpen()
                    ? this.svc.getSnapshot()
                    : ts.ScriptSnapshot.fromString(this.getOrLoadText());
            }
            getLineInfo(line) {
                return this.switchToScriptVersionCache().getLineInfo(line);
            }
            /**
             *  @param line 0 based index
             */
            lineToTextSpan(line) {
                if (!this.useScriptVersionCacheIfValidOrOpen()) {
                    const lineMap = this.getLineMap();
                    const start = lineMap[line]; // -1 since line is 1-based
                    const end = line + 1 < lineMap.length ? lineMap[line + 1] : this.text.length;
                    return ts.createTextSpanFromBounds(start, end);
                }
                return this.svc.lineToTextSpan(line);
            }
            /**
             * @param line 1 based index
             * @param offset 1 based index
             */
            lineOffsetToPosition(line, offset) {
                if (!this.useScriptVersionCacheIfValidOrOpen()) {
                    return ts.computePositionOfLineAndCharacter(this.getLineMap(), line - 1, offset - 1, this.text);
                }
                // TODO: assert this offset is actually on the line
                return this.svc.lineOffsetToPosition(line, offset);
            }
            positionToLineOffset(position) {
                if (!this.useScriptVersionCacheIfValidOrOpen()) {
                    const { line, character } = ts.computeLineAndCharacterOfPosition(this.getLineMap(), position);
                    return { line: line + 1, offset: character + 1 };
                }
                return this.svc.positionToLineOffset(position);
            }
            getFileText(tempFileName) {
                return this.host.readFile(tempFileName || this.fileName) || "";
            }
            switchToScriptVersionCache() {
                if (!this.svc || this.pendingReloadFromDisk) {
                    this.svc = server.ScriptVersionCache.fromString(this.getOrLoadText());
                    this.svcVersion++;
                }
                return this.svc;
            }
            useScriptVersionCacheIfValidOrOpen() {
                // If this is open script, use the cache
                if (this.isOpen) {
                    return this.switchToScriptVersionCache();
                }
                // If there is pending reload from the disk then, reload the text
                if (this.pendingReloadFromDisk) {
                    this.reloadWithFileText();
                }
                // At this point if svc is present its valid
                return this.svc;
            }
            getOrLoadText() {
                if (this.text === undefined || this.pendingReloadFromDisk) {
                    ts.Debug.assert(!this.svc || this.pendingReloadFromDisk, "ScriptVersionCache should not be set when reloading from disk");
                    this.reloadWithFileText();
                }
                return this.text;
            }
            getLineMap() {
                ts.Debug.assert(!this.svc, "ScriptVersionCache should not be set");
                return this.lineMap || (this.lineMap = ts.computeLineStarts(this.getOrLoadText()));
            }
        }
        server.TextStorage = TextStorage;
        /*@internal*/
        function isDynamicFileName(fileName) {
            return fileName[0] === "^" || ts.getBaseFileName(fileName)[0] === "^";
        }
        server.isDynamicFileName = isDynamicFileName;
        class ScriptInfo {
            constructor(host, fileName, scriptKind, hasMixedContent, path) {
                this.host = host;
                this.fileName = fileName;
                this.scriptKind = scriptKind;
                this.hasMixedContent = hasMixedContent;
                this.path = path;
                /**
                 * All projects that include this file
                 */
                this.containingProjects = [];
                this.isDynamic = isDynamicFileName(fileName);
                this.textStorage = new TextStorage(host, fileName);
                if (hasMixedContent || this.isDynamic) {
                    this.textStorage.reload("");
                    this.realpath = this.path;
                }
                this.scriptKind = scriptKind
                    ? scriptKind
                    : ts.getScriptKindFromFileName(fileName);
            }
            /*@internal*/
            isDynamicOrHasMixedContent() {
                return this.hasMixedContent || this.isDynamic;
            }
            isScriptOpen() {
                return this.textStorage.isOpen;
            }
            open(newText) {
                this.textStorage.isOpen = true;
                if (newText !== undefined &&
                    this.textStorage.reload(newText)) {
                    // reload new contents only if the existing contents changed
                    this.markContainingProjectsAsDirty();
                }
            }
            close(fileExists = true) {
                this.textStorage.isOpen = false;
                if (this.isDynamicOrHasMixedContent() || !fileExists) {
                    if (this.textStorage.reload("")) {
                        this.markContainingProjectsAsDirty();
                    }
                }
                else if (this.textStorage.reloadFromDisk()) {
                    this.markContainingProjectsAsDirty();
                }
            }
            getSnapshot() {
                return this.textStorage.getSnapshot();
            }
            ensureRealPath() {
                if (this.realpath === undefined) {
                    // Default is just the path
                    this.realpath = this.path;
                    if (this.host.realpath) {
                        ts.Debug.assert(!!this.containingProjects.length);
                        const project = this.containingProjects[0];
                        const realpath = this.host.realpath(this.path);
                        if (realpath) {
                            this.realpath = project.toPath(realpath);
                            // If it is different from this.path, add to the map
                            if (this.realpath !== this.path) {
                                project.projectService.realpathToScriptInfos.add(this.realpath, this);
                            }
                        }
                    }
                }
            }
            /*@internal*/
            getRealpathIfDifferent() {
                return this.realpath && this.realpath !== this.path ? this.realpath : undefined;
            }
            getFormatCodeSettings() { return this.formatSettings; }
            getPreferences() { return this.preferences; }
            attachToProject(project) {
                const isNew = !this.isAttached(project);
                if (isNew) {
                    this.containingProjects.push(project);
                    project.onFileAddedOrRemoved();
                    if (!project.getCompilerOptions().preserveSymlinks) {
                        this.ensureRealPath();
                    }
                }
                return isNew;
            }
            isAttached(project) {
                // unrolled for common cases
                switch (this.containingProjects.length) {
                    case 0: return false;
                    case 1: return this.containingProjects[0] === project;
                    case 2: return this.containingProjects[0] === project || this.containingProjects[1] === project;
                    default: return ts.contains(this.containingProjects, project);
                }
            }
            detachFromProject(project) {
                // unrolled for common cases
                switch (this.containingProjects.length) {
                    case 0:
                        return;
                    case 1:
                        if (this.containingProjects[0] === project) {
                            project.onFileAddedOrRemoved();
                            this.containingProjects.pop();
                        }
                        break;
                    case 2:
                        if (this.containingProjects[0] === project) {
                            project.onFileAddedOrRemoved();
                            this.containingProjects[0] = this.containingProjects.pop();
                        }
                        else if (this.containingProjects[1] === project) {
                            project.onFileAddedOrRemoved();
                            this.containingProjects.pop();
                        }
                        break;
                    default:
                        if (ts.unorderedRemoveItem(this.containingProjects, project)) {
                            project.onFileAddedOrRemoved();
                        }
                        break;
                }
            }
            detachAllProjects() {
                for (const p of this.containingProjects) {
                    if (p.projectKind === server.ProjectKind.Configured) {
                        p.getCachedDirectoryStructureHost().addOrDeleteFile(this.fileName, this.path, ts.FileWatcherEventKind.Deleted);
                    }
                    const isInfoRoot = p.isRoot(this);
                    // detach is unnecessary since we'll clean the list of containing projects anyways
                    p.removeFile(this, /*fileExists*/ false, /*detachFromProjects*/ false);
                    // If the info was for the external or configured project's root,
                    // add missing file as the root
                    if (isInfoRoot && p.projectKind !== server.ProjectKind.Inferred) {
                        p.addMissingFileRoot(this.fileName);
                    }
                }
                ts.clear(this.containingProjects);
            }
            getDefaultProject() {
                switch (this.containingProjects.length) {
                    case 0:
                        return server.Errors.ThrowNoProject();
                    case 1:
                        return this.containingProjects[0];
                    default:
                        // if this file belongs to multiple projects, the first configured project should be
                        // the default project; if no configured projects, the first external project should
                        // be the default project; otherwise the first inferred project should be the default.
                        let firstExternalProject;
                        for (const project of this.containingProjects) {
                            if (project.projectKind === server.ProjectKind.Configured) {
                                return project;
                            }
                            else if (project.projectKind === server.ProjectKind.External && !firstExternalProject) {
                                firstExternalProject = project;
                            }
                        }
                        return firstExternalProject || this.containingProjects[0];
                }
            }
            registerFileUpdate() {
                for (const p of this.containingProjects) {
                    p.registerFileUpdate(this.path);
                }
            }
            setOptions(formatSettings, preferences) {
                if (formatSettings) {
                    if (!this.formatSettings) {
                        this.formatSettings = server.getDefaultFormatCodeSettings(this.host);
                        ts.assign(this.formatSettings, formatSettings);
                    }
                    else {
                        this.formatSettings = Object.assign({}, this.formatSettings, formatSettings);
                    }
                }
                if (preferences) {
                    if (!this.preferences) {
                        this.preferences = ts.defaultPreferences;
                    }
                    this.preferences = Object.assign({}, this.preferences, preferences);
                }
            }
            getLatestVersion() {
                return this.textStorage.getVersion();
            }
            saveTo(fileName) {
                this.host.writeFile(fileName, ts.getSnapshotText(this.textStorage.getSnapshot()));
            }
            /*@internal*/
            delayReloadNonMixedContentFile() {
                ts.Debug.assert(!this.isDynamicOrHasMixedContent());
                this.textStorage.delayReloadFromFileIntoText();
                this.markContainingProjectsAsDirty();
            }
            reloadFromFile(tempFileName) {
                if (this.isDynamicOrHasMixedContent()) {
                    this.textStorage.reload("");
                    this.markContainingProjectsAsDirty();
                }
                else {
                    if (this.textStorage.reloadWithFileText(tempFileName)) {
                        this.markContainingProjectsAsDirty();
                    }
                }
            }
            /*@internal*/
            getLineInfo(line) {
                return this.textStorage.getLineInfo(line);
            }
            editContent(start, end, newText) {
                this.textStorage.edit(start, end, newText);
                this.markContainingProjectsAsDirty();
            }
            markContainingProjectsAsDirty() {
                for (const p of this.containingProjects) {
                    p.markAsDirty();
                }
            }
            isOrphan() {
                return this.containingProjects.length === 0;
            }
            /**
             *  @param line 1 based index
             */
            lineToTextSpan(line) {
                return this.textStorage.lineToTextSpan(line);
            }
            /**
             * @param line 1 based index
             * @param offset 1 based index
             */
            lineOffsetToPosition(line, offset) {
                return this.textStorage.lineOffsetToPosition(line, offset);
            }
            positionToLineOffset(position) {
                return this.textStorage.positionToLineOffset(position);
            }
            isJavaScript() {
                return this.scriptKind === ts.ScriptKind.JS || this.scriptKind === ts.ScriptKind.JSX;
            }
        }
        server.ScriptInfo = ScriptInfo;
    })(server = ts.server || (ts.server = {}));
})(ts || (ts = {}));
