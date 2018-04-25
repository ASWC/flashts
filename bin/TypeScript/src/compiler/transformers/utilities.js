/* @internal */
var ts;
(function (ts) {
    function getOriginalNodeId(node) {
        node = ts.getOriginalNode(node);
        return node ? ts.getNodeId(node) : 0;
    }
    ts.getOriginalNodeId = getOriginalNodeId;
    function getNamedImportCount(node) {
        if (!(node.importClause && node.importClause.namedBindings))
            return 0;
        const names = node.importClause.namedBindings;
        if (!names)
            return 0;
        if (!ts.isNamedImports(names))
            return 0;
        return names.elements.length;
    }
    function containsDefaultReference(node) {
        if (!node)
            return false;
        if (!ts.isNamedImports(node))
            return false;
        return ts.some(node.elements, isNamedDefaultReference);
    }
    function isNamedDefaultReference(e) {
        return e.propertyName && e.propertyName.escapedText === ts.InternalSymbolName.Default;
    }
    function getImportNeedsImportStarHelper(node) {
        return !!ts.getNamespaceDeclarationNode(node) || (getNamedImportCount(node) > 1 && containsDefaultReference(node.importClause.namedBindings));
    }
    ts.getImportNeedsImportStarHelper = getImportNeedsImportStarHelper;
    function getImportNeedsImportDefaultHelper(node) {
        return ts.isDefaultImport(node) || (getNamedImportCount(node) === 1 && containsDefaultReference(node.importClause.namedBindings));
    }
    ts.getImportNeedsImportDefaultHelper = getImportNeedsImportDefaultHelper;
    function collectExternalModuleInfo(sourceFile, resolver, compilerOptions) {
        const externalImports = [];
        const exportSpecifiers = ts.createMultiMap();
        const exportedBindings = [];
        const uniqueExports = ts.createMap();
        let exportedNames;
        let hasExportDefault = false;
        let exportEquals;
        let hasExportStarsToExportValues = false;
        let hasImportStarOrImportDefault = false;
        for (const node of sourceFile.statements) {
            switch (node.kind) {
                case ts.SyntaxKind.ImportDeclaration:
                    // import "mod"
                    // import x from "mod"
                    // import * as x from "mod"
                    // import { x, y } from "mod"
                    externalImports.push(node);
                    hasImportStarOrImportDefault = hasImportStarOrImportDefault || getImportNeedsImportStarHelper(node) || getImportNeedsImportDefaultHelper(node);
                    break;
                case ts.SyntaxKind.ImportEqualsDeclaration:
                    if (node.moduleReference.kind === ts.SyntaxKind.ExternalModuleReference) {
                        // import x = require("mod")
                        externalImports.push(node);
                    }
                    break;
                case ts.SyntaxKind.ExportDeclaration:
                    if (node.moduleSpecifier) {
                        if (!node.exportClause) {
                            // export * from "mod"
                            externalImports.push(node);
                            hasExportStarsToExportValues = true;
                        }
                        else {
                            // export { x, y } from "mod"
                            externalImports.push(node);
                        }
                    }
                    else {
                        // export { x, y }
                        for (const specifier of node.exportClause.elements) {
                            if (!uniqueExports.get(ts.idText(specifier.name))) {
                                const name = specifier.propertyName || specifier.name;
                                exportSpecifiers.add(ts.idText(name), specifier);
                                const decl = resolver.getReferencedImportDeclaration(name)
                                    || resolver.getReferencedValueDeclaration(name);
                                if (decl) {
                                    multiMapSparseArrayAdd(exportedBindings, getOriginalNodeId(decl), specifier.name);
                                }
                                uniqueExports.set(ts.idText(specifier.name), true);
                                exportedNames = ts.append(exportedNames, specifier.name);
                            }
                        }
                    }
                    break;
                case ts.SyntaxKind.ExportAssignment:
                    if (node.isExportEquals && !exportEquals) {
                        // export = x
                        exportEquals = node;
                    }
                    break;
                case ts.SyntaxKind.VariableStatement:
                    if (ts.hasModifier(node, ts.ModifierFlags.Export)) {
                        for (const decl of node.declarationList.declarations) {
                            exportedNames = collectExportedVariableInfo(decl, uniqueExports, exportedNames);
                        }
                    }
                    break;
                case ts.SyntaxKind.FunctionDeclaration:
                    if (ts.hasModifier(node, ts.ModifierFlags.Export)) {
                        if (ts.hasModifier(node, ts.ModifierFlags.Default)) {
                            // export default function() { }
                            if (!hasExportDefault) {
                                multiMapSparseArrayAdd(exportedBindings, getOriginalNodeId(node), ts.getDeclarationName(node));
                                hasExportDefault = true;
                            }
                        }
                        else {
                            // export function x() { }
                            const name = node.name;
                            if (!uniqueExports.get(ts.idText(name))) {
                                multiMapSparseArrayAdd(exportedBindings, getOriginalNodeId(node), name);
                                uniqueExports.set(ts.idText(name), true);
                                exportedNames = ts.append(exportedNames, name);
                            }
                        }
                    }
                    break;
                case ts.SyntaxKind.ClassDeclaration:
                    if (ts.hasModifier(node, ts.ModifierFlags.Export)) {
                        if (ts.hasModifier(node, ts.ModifierFlags.Default)) {
                            // export default class { }
                            if (!hasExportDefault) {
                                multiMapSparseArrayAdd(exportedBindings, getOriginalNodeId(node), ts.getDeclarationName(node));
                                hasExportDefault = true;
                            }
                        }
                        else {
                            // export class x { }
                            const name = node.name;
                            if (name && !uniqueExports.get(ts.idText(name))) {
                                multiMapSparseArrayAdd(exportedBindings, getOriginalNodeId(node), name);
                                uniqueExports.set(ts.idText(name), true);
                                exportedNames = ts.append(exportedNames, name);
                            }
                        }
                    }
                    break;
            }
        }
        const externalHelpersModuleName = ts.getOrCreateExternalHelpersModuleNameIfNeeded(sourceFile, compilerOptions, hasExportStarsToExportValues, hasImportStarOrImportDefault);
        const externalHelpersImportDeclaration = externalHelpersModuleName && ts.createImportDeclaration(
        /*decorators*/ undefined, 
        /*modifiers*/ undefined, ts.createImportClause(/*name*/ undefined, ts.createNamespaceImport(externalHelpersModuleName)), ts.createLiteral(ts.externalHelpersModuleNameText));
        if (externalHelpersImportDeclaration) {
            ts.addEmitFlags(externalHelpersImportDeclaration, ts.EmitFlags.NeverApplyImportHelper);
            externalImports.unshift(externalHelpersImportDeclaration);
        }
        return { externalImports, exportSpecifiers, exportEquals, hasExportStarsToExportValues, exportedBindings, exportedNames, externalHelpersImportDeclaration };
    }
    ts.collectExternalModuleInfo = collectExternalModuleInfo;
    function collectExportedVariableInfo(decl, uniqueExports, exportedNames) {
        if (ts.isBindingPattern(decl.name)) {
            for (const element of decl.name.elements) {
                if (!ts.isOmittedExpression(element)) {
                    exportedNames = collectExportedVariableInfo(element, uniqueExports, exportedNames);
                }
            }
        }
        else if (!ts.isGeneratedIdentifier(decl.name)) {
            const text = ts.idText(decl.name);
            if (!uniqueExports.get(text)) {
                uniqueExports.set(text, true);
                exportedNames = ts.append(exportedNames, decl.name);
            }
        }
        return exportedNames;
    }
    /** Use a sparse array as a multi-map. */
    function multiMapSparseArrayAdd(map, key, value) {
        let values = map[key];
        if (values) {
            values.push(value);
        }
        else {
            map[key] = values = [value];
        }
        return values;
    }
    /**
     * Used in the module transformer to check if an expression is reasonably without sideeffect,
     *  and thus better to copy into multiple places rather than to cache in a temporary variable
     *  - this is mostly subjective beyond the requirement that the expression not be sideeffecting
     */
    function isSimpleCopiableExpression(expression) {
        return ts.isStringLiteralLike(expression) ||
            expression.kind === ts.SyntaxKind.NumericLiteral ||
            ts.isKeyword(expression.kind) ||
            ts.isIdentifier(expression);
    }
    ts.isSimpleCopiableExpression = isSimpleCopiableExpression;
    /**
     * @param input Template string input strings
     * @param args Names which need to be made file-level unique
     */
    function helperString(input, ...args) {
        return (uniqueName) => {
            let result = "";
            for (let i = 0; i < args.length; i++) {
                result += input[i];
                result += uniqueName(args[i]);
            }
            result += input[input.length - 1];
            return result;
        };
    }
    ts.helperString = helperString;
})(ts || (ts = {}));
