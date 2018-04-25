/* @internal */
var ts;
(function (ts) {
    var codefix;
    (function (codefix) {
        codefix.registerCodeFix({
            errorCodes: [Diagnostics.File_is_a_CommonJS_module_it_may_be_converted_to_an_ES6_module.code],
            getCodeActions(context) {
                const { sourceFile, program } = context;
                const changes = ts.textChanges.ChangeTracker.with(context, changes => {
                    const moduleExportsChangedToDefault = convertFileToEs6Module(sourceFile, program.getTypeChecker(), changes, program.getCompilerOptions().target);
                    if (moduleExportsChangedToDefault) {
                        for (const importingFile of program.getSourceFiles()) {
                            fixImportOfModuleExports(importingFile, sourceFile, changes);
                        }
                    }
                });
                // No support for fix-all since this applies to the whole file at once anyway.
                return [codefix.createCodeFixActionNoFixId("convertToEs6Module", changes, Diagnostics.Convert_to_ES6_module)];
            },
        });
        function fixImportOfModuleExports(importingFile, exportingFile, changes) {
            for (const moduleSpecifier of importingFile.imports) {
                const imported = ts.getResolvedModule(importingFile, moduleSpecifier.text);
                if (!imported || imported.resolvedFileName !== exportingFile.fileName) {
                    continue;
                }
                const importNode = ts.importFromModuleSpecifier(moduleSpecifier);
                switch (importNode.kind) {
                    case ts.SyntaxKind.ImportEqualsDeclaration:
                        changes.replaceNode(importingFile, importNode, makeImport(importNode.name, /*namedImports*/ undefined, moduleSpecifier));
                        break;
                    case ts.SyntaxKind.CallExpression:
                        if (ts.isRequireCall(importNode, /*checkArgumentIsStringLiteralLike*/ false)) {
                            changes.replaceNode(importingFile, importNode, ts.createPropertyAccess(ts.getSynthesizedDeepClone(importNode), "default"));
                        }
                        break;
                }
            }
        }
        /** @returns Whether we converted a `module.exports =` to a default export. */
        function convertFileToEs6Module(sourceFile, checker, changes, target) {
            const identifiers = { original: collectFreeIdentifiers(sourceFile), additional: ts.createMap() };
            const exports = collectExportRenames(sourceFile, checker, identifiers);
            convertExportsAccesses(sourceFile, exports, changes);
            let moduleExportsChangedToDefault = false;
            for (const statement of sourceFile.statements) {
                const moduleExportsChanged = convertStatement(sourceFile, statement, checker, changes, identifiers, target, exports);
                moduleExportsChangedToDefault = moduleExportsChangedToDefault || moduleExportsChanged;
            }
            return moduleExportsChangedToDefault;
        }
        function collectExportRenames(sourceFile, checker, identifiers) {
            const res = ts.createMap();
            forEachExportReference(sourceFile, node => {
                const { text, originalKeywordKind } = node.name;
                if (!res.has(text) && (originalKeywordKind !== undefined && ts.isNonContextualKeyword(originalKeywordKind)
                    || checker.resolveName(node.name.text, node, ts.SymbolFlags.Value, /*excludeGlobals*/ true))) {
                    // Unconditionally add an underscore in case `text` is a keyword.
                    res.set(text, makeUniqueName(`_${text}`, identifiers));
                }
            });
            return res;
        }
        function convertExportsAccesses(sourceFile, exports, changes) {
            forEachExportReference(sourceFile, (node, isAssignmentLhs) => {
                if (isAssignmentLhs) {
                    return;
                }
                const { text } = node.name;
                changes.replaceNode(sourceFile, node, ts.createIdentifier(exports.get(text) || text));
            });
        }
        function forEachExportReference(sourceFile, cb) {
            sourceFile.forEachChild(function recur(node) {
                if (ts.isPropertyAccessExpression(node) && ts.isExportsOrModuleExportsOrAlias(sourceFile, node.expression)) {
                    const { parent } = node;
                    cb(node, ts.isBinaryExpression(parent) && parent.left === node && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken);
                }
                node.forEachChild(recur);
            });
        }
        function convertStatement(sourceFile, statement, checker, changes, identifiers, target, exports) {
            switch (statement.kind) {
                case ts.SyntaxKind.VariableStatement:
                    convertVariableStatement(sourceFile, statement, changes, checker, identifiers, target);
                    return false;
                case ts.SyntaxKind.ExpressionStatement: {
                    const { expression } = statement;
                    switch (expression.kind) {
                        case ts.SyntaxKind.CallExpression: {
                            if (ts.isRequireCall(expression, /*checkArgumentIsStringLiteralLike*/ true)) {
                                // For side-effecting require() call, just make a side-effecting import.
                                changes.replaceNode(sourceFile, statement, makeImport(/*name*/ undefined, /*namedImports*/ undefined, expression.arguments[0]));
                            }
                            return false;
                        }
                        case ts.SyntaxKind.BinaryExpression: {
                            const { operatorToken } = expression;
                            return operatorToken.kind === ts.SyntaxKind.EqualsToken && convertAssignment(sourceFile, checker, expression, changes, exports);
                        }
                    }
                }
                // falls through
                default:
                    return false;
            }
        }
        function convertVariableStatement(sourceFile, statement, changes, checker, identifiers, target) {
            const { declarationList } = statement;
            let foundImport = false;
            const newNodes = ts.flatMap(declarationList.declarations, decl => {
                const { name, initializer } = decl;
                if (initializer) {
                    if (ts.isExportsOrModuleExportsOrAlias(sourceFile, initializer)) {
                        // `const alias = module.exports;` can be removed.
                        foundImport = true;
                        return [];
                    }
                    else if (ts.isRequireCall(initializer, /*checkArgumentIsStringLiteralLike*/ true)) {
                        foundImport = true;
                        return convertSingleImport(sourceFile, name, initializer.arguments[0], changes, checker, identifiers, target);
                    }
                    else if (ts.isPropertyAccessExpression(initializer) && ts.isRequireCall(initializer.expression, /*checkArgumentIsStringLiteralLike*/ true)) {
                        foundImport = true;
                        return convertPropertyAccessImport(name, initializer.name.text, initializer.expression.arguments[0], identifiers);
                    }
                }
                // Move it out to its own variable statement. (This will not be used if `!foundImport`)
                return ts.createVariableStatement(/*modifiers*/ undefined, ts.createVariableDeclarationList([decl], declarationList.flags));
            });
            if (foundImport) {
                // useNonAdjustedEndPosition to ensure we don't eat the newline after the statement.
                changes.replaceNodeWithNodes(sourceFile, statement, newNodes);
            }
        }
        /** Converts `const name = require("moduleSpecifier").propertyName` */
        function convertPropertyAccessImport(name, propertyName, moduleSpecifier, identifiers) {
            switch (name.kind) {
                case ts.SyntaxKind.ObjectBindingPattern:
                case ts.SyntaxKind.ArrayBindingPattern: {
                    // `const [a, b] = require("c").d` --> `import { d } from "c"; const [a, b] = d;`
                    const tmp = makeUniqueName(propertyName, identifiers);
                    return [
                        makeSingleImport(tmp, propertyName, moduleSpecifier),
                        makeConst(/*modifiers*/ undefined, name, ts.createIdentifier(tmp)),
                    ];
                }
                case ts.SyntaxKind.Identifier:
                    // `const a = require("b").c` --> `import { c as a } from "./b";
                    return [makeSingleImport(name.text, propertyName, moduleSpecifier)];
                default:
                    ts.Debug.assertNever(name);
            }
        }
        function convertAssignment(sourceFile, checker, assignment, changes, exports) {
            const { left, right } = assignment;
            if (!ts.isPropertyAccessExpression(left)) {
                return false;
            }
            if (ts.isExportsOrModuleExportsOrAlias(sourceFile, left)) {
                if (ts.isExportsOrModuleExportsOrAlias(sourceFile, right)) {
                    // `const alias = module.exports;` or `module.exports = alias;` can be removed.
                    changes.deleteNode(sourceFile, assignment.parent);
                }
                else {
                    let newNodes = ts.isObjectLiteralExpression(right) ? tryChangeModuleExportsObject(right) : undefined;
                    let changedToDefaultExport = false;
                    if (!newNodes) {
                        ([newNodes, changedToDefaultExport] = convertModuleExportsToExportDefault(right, checker));
                    }
                    changes.replaceNodeWithNodes(sourceFile, assignment.parent, newNodes);
                    return changedToDefaultExport;
                }
            }
            else if (ts.isExportsOrModuleExportsOrAlias(sourceFile, left.expression)) {
                convertNamedExport(sourceFile, assignment, changes, exports);
            }
            return false;
        }
        /**
         * Convert `module.exports = { ... }` to individual exports..
         * We can't always do this if the module has interesting members -- then it will be a default export instead.
         */
        function tryChangeModuleExportsObject(object) {
            return ts.mapAllOrFail(object.properties, prop => {
                switch (prop.kind) {
                    case ts.SyntaxKind.GetAccessor:
                    case ts.SyntaxKind.SetAccessor:
                    // TODO: Maybe we should handle this? See fourslash test `refactorConvertToEs6Module_export_object_shorthand.ts`.
                    case ts.SyntaxKind.ShorthandPropertyAssignment:
                    case ts.SyntaxKind.SpreadAssignment:
                        return undefined;
                    case ts.SyntaxKind.PropertyAssignment:
                        return !ts.isIdentifier(prop.name) ? undefined : convertExportsDotXEquals_replaceNode(prop.name.text, prop.initializer);
                    case ts.SyntaxKind.MethodDeclaration:
                        return !ts.isIdentifier(prop.name) ? undefined : functionExpressionToDeclaration(prop.name.text, [ts.createToken(ts.SyntaxKind.ExportKeyword)], prop);
                    default:
                        ts.Debug.assertNever(prop);
                }
            });
        }
        function convertNamedExport(sourceFile, assignment, changes, exports) {
            // If "originalKeywordKind" was set, this is e.g. `exports.
            const { text } = assignment.left.name;
            const rename = exports.get(text);
            if (rename !== undefined) {
                /*
                const _class = 0;
                export { _class as class };
                */
                const newNodes = [
                    makeConst(/*modifiers*/ undefined, rename, assignment.right),
                    makeExportDeclaration([ts.createExportSpecifier(rename, text)]),
                ];
                changes.replaceNodeWithNodes(sourceFile, assignment.parent, newNodes);
            }
            else {
                convertExportsPropertyAssignment(assignment, sourceFile, changes);
            }
        }
        function convertModuleExportsToExportDefault(exported, checker) {
            const modifiers = [ts.createToken(ts.SyntaxKind.ExportKeyword), ts.createToken(ts.SyntaxKind.DefaultKeyword)];
            switch (exported.kind) {
                case ts.SyntaxKind.FunctionExpression:
                case ts.SyntaxKind.ArrowFunction: {
                    // `module.exports = function f() {}` --> `export default function f() {}`
                    const fn = exported;
                    return [[functionExpressionToDeclaration(fn.name && fn.name.text, modifiers, fn)], true];
                }
                case ts.SyntaxKind.ClassExpression: {
                    // `module.exports = class C {}` --> `export default class C {}`
                    const cls = exported;
                    return [[classExpressionToDeclaration(cls.name && cls.name.text, modifiers, cls)], true];
                }
                case ts.SyntaxKind.CallExpression:
                    if (ts.isRequireCall(exported, /*checkArgumentIsStringLiteralLike*/ true)) {
                        return convertReExportAll(exported.arguments[0], checker);
                    }
                // falls through
                default:
                    // `module.exports = 0;` --> `export default 0;`
                    return [[ts.createExportAssignment(/*decorators*/ undefined, /*modifiers*/ undefined, /*isExportEquals*/ false, exported)], true];
            }
        }
        function convertReExportAll(reExported, checker) {
            // `module.exports = require("x");` ==> `export * from "x"; export { default } from "x";`
            const moduleSpecifier = reExported.text;
            const moduleSymbol = checker.getSymbolAtLocation(reExported);
            const exports = moduleSymbol ? moduleSymbol.exports : ts.emptyUnderscoreEscapedMap;
            return exports.has("export=")
                ? [[reExportDefault(moduleSpecifier)], true]
                : !exports.has("default")
                    ? [[reExportStar(moduleSpecifier)], false]
                    // If there's some non-default export, must include both `export *` and `export default`.
                    : exports.size > 1 ? [[reExportStar(moduleSpecifier), reExportDefault(moduleSpecifier)], true] : [[reExportDefault(moduleSpecifier)], true];
        }
        function reExportStar(moduleSpecifier) {
            return makeExportDeclaration(/*exportClause*/ undefined, moduleSpecifier);
        }
        function reExportDefault(moduleSpecifier) {
            return makeExportDeclaration([ts.createExportSpecifier(/*propertyName*/ undefined, "default")], moduleSpecifier);
        }
        function convertExportsPropertyAssignment({ left, right, parent }, sourceFile, changes) {
            const name = left.name.text;
            if ((ts.isFunctionExpression(right) || ts.isArrowFunction(right) || ts.isClassExpression(right)) && (!right.name || right.name.text === name)) {
                // `exports.f = function() {}` -> `export function f() {}` -- Replace `exports.f = ` with `export `, and insert the name after `function`.
                changes.replaceRange(sourceFile, { pos: left.getStart(sourceFile), end: right.getStart(sourceFile) }, ts.createToken(ts.SyntaxKind.ExportKeyword), { suffix: " " });
                if (!right.name)
                    changes.insertName(sourceFile, right, name);
                const semi = ts.findChildOfKind(parent, ts.SyntaxKind.SemicolonToken, sourceFile);
                if (semi)
                    changes.deleteNode(sourceFile, semi, { useNonAdjustedEndPosition: true });
            }
            else {
                // `exports.f = function g() {}` -> `export const f = function g() {}` -- just replace `exports.` with `export const `
                changes.replaceNodeRangeWithNodes(sourceFile, left.expression, ts.findChildOfKind(left, ts.SyntaxKind.DotToken, sourceFile), [ts.createToken(ts.SyntaxKind.ExportKeyword), ts.createToken(ts.SyntaxKind.ConstKeyword)], { joiner: " ", suffix: " " });
            }
        }
        // TODO: GH#22492 this will cause an error if a change has been made inside the body of the node.
        function convertExportsDotXEquals_replaceNode(name, exported) {
            const modifiers = [ts.createToken(ts.SyntaxKind.ExportKeyword)];
            switch (exported.kind) {
                case ts.SyntaxKind.FunctionExpression: {
                    const { name: expressionName } = exported;
                    if (expressionName && expressionName.text !== name) {
                        // `exports.f = function g() {}` -> `export const f = function g() {}`
                        return exportConst();
                    }
                }
                // falls through
                case ts.SyntaxKind.ArrowFunction:
                    // `exports.f = function() {}` --> `export function f() {}`
                    return functionExpressionToDeclaration(name, modifiers, exported);
                case ts.SyntaxKind.ClassExpression:
                    // `exports.C = class {}` --> `export class C {}`
                    return classExpressionToDeclaration(name, modifiers, exported);
                default:
                    return exportConst();
            }
            function exportConst() {
                // `exports.x = 0;` --> `export const x = 0;`
                return makeConst(modifiers, ts.createIdentifier(name), exported);
            }
        }
        /**
         * Converts `const <<name>> = require("x");`.
         * Returns nodes that will replace the variable declaration for the commonjs import.
         * May also make use `changes` to remove qualifiers at the use sites of imports, to change `mod.x` to `x`.
         */
        function convertSingleImport(file, name, moduleSpecifier, changes, checker, identifiers, target) {
            switch (name.kind) {
                case ts.SyntaxKind.ObjectBindingPattern: {
                    const importSpecifiers = ts.mapAllOrFail(name.elements, e => e.dotDotDotToken || e.initializer || e.propertyName && !ts.isIdentifier(e.propertyName) || !ts.isIdentifier(e.name)
                        ? undefined
                        : makeImportSpecifier(e.propertyName && e.propertyName.text, e.name.text));
                    if (importSpecifiers) {
                        return [makeImport(/*name*/ undefined, importSpecifiers, moduleSpecifier)];
                    }
                }
                // falls through -- object destructuring has an interesting pattern and must be a variable declaration
                case ts.SyntaxKind.ArrayBindingPattern: {
                    /*
                    import x from "x";
                    const [a, b, c] = x;
                    */
                    const tmp = makeUniqueName(codefix.moduleSpecifierToValidIdentifier(moduleSpecifier.text, target), identifiers);
                    return [
                        makeImport(ts.createIdentifier(tmp), /*namedImports*/ undefined, moduleSpecifier),
                        makeConst(/*modifiers*/ undefined, ts.getSynthesizedDeepClone(name), ts.createIdentifier(tmp)),
                    ];
                }
                case ts.SyntaxKind.Identifier:
                    return convertSingleIdentifierImport(file, name, moduleSpecifier, changes, checker, identifiers);
                default:
                    ts.Debug.assertNever(name);
            }
        }
        /**
         * Convert `import x = require("x").`
         * Also converts uses like `x.y()` to `y()` and uses a named import.
         */
        function convertSingleIdentifierImport(file, name, moduleSpecifier, changes, checker, identifiers) {
            const nameSymbol = checker.getSymbolAtLocation(name);
            // Maps from module property name to name actually used. (The same if there isn't shadowing.)
            const namedBindingsNames = ts.createMap();
            // True if there is some non-property use like `x()` or `f(x)`.
            let needDefaultImport = false;
            for (const use of identifiers.original.get(name.text)) {
                if (checker.getSymbolAtLocation(use) !== nameSymbol || use === name) {
                    // This was a use of a different symbol with the same name, due to shadowing. Ignore.
                    continue;
                }
                const { parent } = use;
                if (ts.isPropertyAccessExpression(parent)) {
                    const { expression, name: { text: propertyName } } = parent;
                    ts.Debug.assert(expression === use); // Else shouldn't have been in `collectIdentifiers`
                    let idName = namedBindingsNames.get(propertyName);
                    if (idName === undefined) {
                        idName = makeUniqueName(propertyName, identifiers);
                        namedBindingsNames.set(propertyName, idName);
                    }
                    changes.replaceNode(file, parent, ts.createIdentifier(idName));
                }
                else {
                    needDefaultImport = true;
                }
            }
            const namedBindings = namedBindingsNames.size === 0 ? undefined : ts.arrayFrom(ts.mapIterator(namedBindingsNames.entries(), ([propertyName, idName]) => ts.createImportSpecifier(propertyName === idName ? undefined : ts.createIdentifier(propertyName), ts.createIdentifier(idName))));
            if (!namedBindings) {
                // If it was unused, ensure that we at least import *something*.
                needDefaultImport = true;
            }
            return [makeImport(needDefaultImport ? ts.getSynthesizedDeepClone(name) : undefined, namedBindings, moduleSpecifier)];
        }
        // Identifiers helpers
        function makeUniqueName(name, identifiers) {
            while (identifiers.original.has(name) || identifiers.additional.has(name)) {
                name = `_${name}`;
            }
            identifiers.additional.set(name, true);
            return name;
        }
        function collectFreeIdentifiers(file) {
            const map = ts.createMultiMap();
            file.forEachChild(function recur(node) {
                if (ts.isIdentifier(node) && isFreeIdentifier(node)) {
                    map.add(node.text, node);
                }
                node.forEachChild(recur);
            });
            return map;
        }
        function isFreeIdentifier(node) {
            const { parent } = node;
            switch (parent.kind) {
                case ts.SyntaxKind.PropertyAccessExpression:
                    return parent.name !== node;
                case ts.SyntaxKind.BindingElement:
                    return parent.propertyName !== node;
                default:
                    return true;
            }
        }
        // Node helpers
        function functionExpressionToDeclaration(name, additionalModifiers, fn) {
            return ts.createFunctionDeclaration(ts.getSynthesizedDeepClones(fn.decorators), // TODO: GH#19915 Don't think this is even legal.
            ts.concatenate(additionalModifiers, ts.getSynthesizedDeepClones(fn.modifiers)), ts.getSynthesizedDeepClone(fn.asteriskToken), name, ts.getSynthesizedDeepClones(fn.typeParameters), ts.getSynthesizedDeepClones(fn.parameters), ts.getSynthesizedDeepClone(fn.type), ts.convertToFunctionBody(ts.getSynthesizedDeepClone(fn.body)));
        }
        function classExpressionToDeclaration(name, additionalModifiers, cls) {
            return ts.createClassDeclaration(ts.getSynthesizedDeepClones(cls.decorators), // TODO: GH#19915 Don't think this is even legal.
            ts.concatenate(additionalModifiers, ts.getSynthesizedDeepClones(cls.modifiers)), name, ts.getSynthesizedDeepClones(cls.typeParameters), ts.getSynthesizedDeepClones(cls.heritageClauses), ts.getSynthesizedDeepClones(cls.members));
        }
        function makeSingleImport(localName, propertyName, moduleSpecifier) {
            return propertyName === "default"
                ? makeImport(ts.createIdentifier(localName), /*namedImports*/ undefined, moduleSpecifier)
                : makeImport(/*name*/ undefined, [makeImportSpecifier(propertyName, localName)], moduleSpecifier);
        }
        function makeImport(name, namedImports, moduleSpecifier) {
            return makeImportDeclaration(name, namedImports, moduleSpecifier);
        }
        function makeImportDeclaration(name, namedImports, moduleSpecifier) {
            const importClause = (name || namedImports) && ts.createImportClause(name, namedImports && ts.createNamedImports(namedImports));
            return ts.createImportDeclaration(/*decorators*/ undefined, /*modifiers*/ undefined, importClause, moduleSpecifier);
        }
        codefix.makeImportDeclaration = makeImportDeclaration;
        function makeImportSpecifier(propertyName, name) {
            return ts.createImportSpecifier(propertyName !== undefined && propertyName !== name ? ts.createIdentifier(propertyName) : undefined, ts.createIdentifier(name));
        }
        function makeConst(modifiers, name, init) {
            return ts.createVariableStatement(modifiers, ts.createVariableDeclarationList([ts.createVariableDeclaration(name, /*type*/ undefined, init)], ts.NodeFlags.Const));
        }
        function makeExportDeclaration(exportSpecifiers, moduleSpecifier) {
            return ts.createExportDeclaration(
            /*decorators*/ undefined, 
            /*modifiers*/ undefined, exportSpecifiers && ts.createNamedExports(exportSpecifiers), moduleSpecifier === undefined ? undefined : ts.createLiteral(moduleSpecifier));
        }
    })(codefix = ts.codefix || (ts.codefix = {}));
})(ts || (ts = {}));
