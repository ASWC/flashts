/* @internal */
var ts;
(function (ts) {
    var codefix;
    (function (codefix) {
        const fixId = "fixCannotFindModule";
        const errorCodes = [Diagnostics.Could_not_find_a_declaration_file_for_module_0_1_implicitly_has_an_any_type.code];
        codefix.registerCodeFix({
            errorCodes,
            getCodeActions: context => {
                const { host, sourceFile, span: { start } } = context;
                const packageName = getTypesPackageNameToInstall(host, sourceFile, start);
                return packageName === undefined ? []
                    : [codefix.createCodeFixAction(fixId, /*changes*/ [], [Diagnostics.Install_0, packageName], fixId, Diagnostics.Install_all_missing_types_packages, getCommand(sourceFile.fileName, packageName))];
            },
            fixIds: [fixId],
            getAllCodeActions: context => codefix.codeFixAll(context, errorCodes, (_, diag, commands) => {
                const pkg = getTypesPackageNameToInstall(context.host, diag.file, diag.start);
                if (pkg) {
                    commands.push(getCommand(diag.file.fileName, pkg));
                }
            }),
        });
        function getCommand(fileName, packageName) {
            return { type: "install package", file: fileName, packageName };
        }
        function getTypesPackageNameToInstall(host, sourceFile, pos) {
            const moduleName = ts.cast(ts.getTokenAtPosition(sourceFile, pos, /*includeJsDocComment*/ false), ts.isStringLiteral).text;
            const { packageName } = ts.getPackageName(moduleName);
            return host.isKnownTypesPackageName(packageName) ? ts.getTypesPackageName(packageName) : undefined;
        }
    })(codefix = ts.codefix || (ts.codefix = {}));
})(ts || (ts = {}));
