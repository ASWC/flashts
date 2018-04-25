var ts;
(function (ts) {
    var server;
    (function (server) {
        server.nullTypingsInstaller = {
            isKnownTypesPackageName: ts.returnFalse,
            // Should never be called because we never provide a types registry.
            installPackage: ts.notImplemented,
            enqueueInstallTypingsRequest: ts.noop,
            attach: ts.noop,
            onProjectClosed: ts.noop,
            globalTypingsCacheLocation: undefined
        };
        function setIsEqualTo(arr1, arr2) {
            if (arr1 === arr2) {
                return true;
            }
            if ((arr1 || server.emptyArray).length === 0 && (arr2 || server.emptyArray).length === 0) {
                return true;
            }
            const set = ts.createMap();
            let unique = 0;
            for (const v of arr1) {
                if (set.get(v) !== true) {
                    set.set(v, true);
                    unique++;
                }
            }
            for (const v of arr2) {
                const isSet = set.get(v);
                if (isSet === undefined) {
                    return false;
                }
                if (isSet === true) {
                    set.set(v, false);
                    unique--;
                }
            }
            return unique === 0;
        }
        function typeAcquisitionChanged(opt1, opt2) {
            return opt1.enable !== opt2.enable ||
                !setIsEqualTo(opt1.include, opt2.include) ||
                !setIsEqualTo(opt1.exclude, opt2.exclude);
        }
        function compilerOptionsChanged(opt1, opt2) {
            // TODO: add more relevant properties
            return opt1.allowJs !== opt2.allowJs;
        }
        function unresolvedImportsChanged(imports1, imports2) {
            if (imports1 === imports2) {
                return false;
            }
            return !ts.arrayIsEqualTo(imports1, imports2);
        }
        /*@internal*/
        class TypingsCache {
            constructor(installer) {
                this.installer = installer;
                this.perProjectCache = ts.createMap();
            }
            isKnownTypesPackageName(name) {
                return this.installer.isKnownTypesPackageName(name);
            }
            installPackage(options) {
                return this.installer.installPackage(options);
            }
            enqueueInstallTypingsForProject(project, unresolvedImports, forceRefresh) {
                const typeAcquisition = project.getTypeAcquisition();
                if (!typeAcquisition || !typeAcquisition.enable) {
                    return;
                }
                const entry = this.perProjectCache.get(project.getProjectName());
                if (forceRefresh ||
                    !entry ||
                    typeAcquisitionChanged(typeAcquisition, entry.typeAcquisition) ||
                    compilerOptionsChanged(project.getCompilationSettings(), entry.compilerOptions) ||
                    unresolvedImportsChanged(unresolvedImports, entry.unresolvedImports)) {
                    // Note: entry is now poisoned since it does not really contain typings for a given combination of compiler options\typings options.
                    // instead it acts as a placeholder to prevent issuing multiple requests
                    this.perProjectCache.set(project.getProjectName(), {
                        compilerOptions: project.getCompilationSettings(),
                        typeAcquisition,
                        typings: entry ? entry.typings : server.emptyArray,
                        unresolvedImports,
                        poisoned: true
                    });
                    // something has been changed, issue a request to update typings
                    this.installer.enqueueInstallTypingsRequest(project, typeAcquisition, unresolvedImports);
                }
            }
            updateTypingsForProject(projectName, compilerOptions, typeAcquisition, unresolvedImports, newTypings) {
                const typings = server.toSortedArray(newTypings);
                this.perProjectCache.set(projectName, {
                    compilerOptions,
                    typeAcquisition,
                    typings,
                    unresolvedImports,
                    poisoned: false
                });
                return !typeAcquisition || !typeAcquisition.enable ? server.emptyArray : typings;
            }
            onProjectClosed(project) {
                this.perProjectCache.delete(project.getProjectName());
                this.installer.onProjectClosed(project);
            }
        }
        server.TypingsCache = TypingsCache;
    })(server = ts.server || (ts.server = {}));
})(ts || (ts = {}));
