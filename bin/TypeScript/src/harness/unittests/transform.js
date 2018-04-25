/// <reference path="..\..\services\transform.ts" />
/// <reference path="..\harness.ts" />
var ts;
(function (ts) {
    describe("TransformAPI", () => {
        function replaceUndefinedWithVoid0(context) {
            const previousOnSubstituteNode = context.onSubstituteNode;
            context.enableSubstitution(ts.SyntaxKind.Identifier);
            context.onSubstituteNode = (hint, node) => {
                node = previousOnSubstituteNode(hint, node);
                if (hint === ts.EmitHint.Expression && ts.isIdentifier(node) && node.escapedText === "undefined") {
                    node = ts.createPartiallyEmittedExpression(ts.addSyntheticTrailingComment(ts.setTextRange(ts.createVoidZero(), node), ts.SyntaxKind.MultiLineCommentTrivia, "undefined"));
                }
                return node;
            };
            return (file) => file;
        }
        function replaceNumberWith2(context) {
            function visitor(node) {
                if (ts.isNumericLiteral(node)) {
                    return ts.createNumericLiteral("2");
                }
                return ts.visitEachChild(node, visitor, context);
            }
            return (file) => ts.visitNode(file, visitor);
        }
        function replaceIdentifiersNamedOldNameWithNewName(context) {
            const previousOnSubstituteNode = context.onSubstituteNode;
            context.enableSubstitution(ts.SyntaxKind.Identifier);
            context.onSubstituteNode = (hint, node) => {
                node = previousOnSubstituteNode(hint, node);
                if (ts.isIdentifier(node) && node.escapedText === "oldName") {
                    node = ts.setTextRange(ts.createIdentifier("newName"), node);
                }
                return node;
            };
            return (file) => file;
        }
        function transformSourceFile(sourceText, transformers) {
            const transformed = ts.transform(ts.createSourceFile("source.ts", sourceText, ts.ScriptTarget.ES2015), transformers);
            const printer = ts.createPrinter({ newLine: ts.NewLineKind.CarriageReturnLineFeed }, {
                onEmitNode: transformed.emitNodeWithNotification,
                substituteNode: transformed.substituteNode
            });
            const result = printer.printBundle(ts.createBundle(transformed.transformed));
            transformed.dispose();
            return result;
        }
        function testBaseline(testName, test) {
            it(testName, () => {
                Harness.Baseline.runBaseline(`transformApi/transformsCorrectly.${testName}.js`, test);
            });
        }
        testBaseline("substitution", () => {
            return transformSourceFile(`var a = undefined;`, [replaceUndefinedWithVoid0]);
        });
        testBaseline("types", () => {
            return transformSourceFile(`let a: () => void`, [
                context => file => ts.visitNode(file, function visitor(node) {
                    return ts.visitEachChild(node, visitor, context);
                })
            ]);
        });
        testBaseline("fromTranspileModule", () => {
            return ts.transpileModule(`var oldName = undefined;`, {
                transformers: {
                    before: [replaceUndefinedWithVoid0],
                    after: [replaceIdentifiersNamedOldNameWithNewName]
                },
                compilerOptions: {
                    newLine: ts.NewLineKind.CarriageReturnLineFeed
                }
            }).outputText;
        });
        testBaseline("rewrittenNamespace", () => {
            return ts.transpileModule(`namespace Reflect { const x = 1; }`, {
                transformers: {
                    before: [forceNamespaceRewrite],
                },
                compilerOptions: {
                    newLine: ts.NewLineKind.CarriageReturnLineFeed,
                }
            }).outputText;
        });
        testBaseline("rewrittenNamespaceFollowingClass", () => {
            return ts.transpileModule(`
            class C { foo = 10; static bar = 20 }
            namespace C { export let x = 10; }
            `, {
                transformers: {
                    before: [forceNamespaceRewrite],
                },
                compilerOptions: {
                    target: ts.ScriptTarget.ESNext,
                    newLine: ts.NewLineKind.CarriageReturnLineFeed,
                }
            }).outputText;
        });
        testBaseline("transformTypesInExportDefault", () => {
            return ts.transpileModule(`
            export default (foo: string) => { return 1; }
            `, {
                transformers: {
                    before: [replaceNumberWith2],
                },
                compilerOptions: {
                    target: ts.ScriptTarget.ESNext,
                    newLine: ts.NewLineKind.CarriageReturnLineFeed,
                }
            }).outputText;
        });
        testBaseline("synthesizedClassAndNamespaceCombination", () => {
            return ts.transpileModule("", {
                transformers: {
                    before: [replaceWithClassAndNamespace],
                },
                compilerOptions: {
                    target: ts.ScriptTarget.ESNext,
                    newLine: ts.NewLineKind.CarriageReturnLineFeed,
                }
            }).outputText;
            function replaceWithClassAndNamespace() {
                return (sourceFile) => {
                    const result = ts.getMutableClone(sourceFile);
                    result.statements = ts.createNodeArray([
                        ts.createClassDeclaration(/*decorators*/ undefined, /*modifiers*/ undefined, "Foo", /*typeParameters*/ undefined, /*heritageClauses*/ undefined, /*members*/ undefined),
                        ts.createModuleDeclaration(/*decorators*/ undefined, /*modifiers*/ undefined, ts.createIdentifier("Foo"), ts.createModuleBlock([ts.createEmptyStatement()]))
                    ]);
                    return result;
                };
            }
        });
        function forceNamespaceRewrite(context) {
            return (sourceFile) => {
                return visitNode(sourceFile);
                function visitNode(node) {
                    if (node.kind === ts.SyntaxKind.ModuleBlock) {
                        const block = node;
                        const statements = ts.createNodeArray([...block.statements]);
                        return ts.updateModuleBlock(block, statements);
                    }
                    return ts.visitEachChild(node, visitNode, context);
                }
            };
        }
        testBaseline("transformAwayExportStar", () => {
            return ts.transpileModule("export * from './helper';", {
                transformers: {
                    before: [expandExportStar],
                },
                compilerOptions: {
                    target: ts.ScriptTarget.ESNext,
                    newLine: ts.NewLineKind.CarriageReturnLineFeed,
                }
            }).outputText;
            function expandExportStar(context) {
                return (sourceFile) => {
                    return visitNode(sourceFile);
                    function visitNode(node) {
                        if (node.kind === ts.SyntaxKind.ExportDeclaration) {
                            const ed = node;
                            const exports = [{ name: "x" }];
                            const exportSpecifiers = exports.map(e => ts.createExportSpecifier(e.name, e.name));
                            const exportClause = ts.createNamedExports(exportSpecifiers);
                            const newEd = ts.updateExportDeclaration(ed, ed.decorators, ed.modifiers, exportClause, ed.moduleSpecifier);
                            return newEd;
                        }
                        return ts.visitEachChild(node, visitNode, context);
                    }
                };
            }
        });
        // https://github.com/Microsoft/TypeScript/issues/19618
        testBaseline("transformAddImportStar", () => {
            return ts.transpileModule("", {
                transformers: {
                    before: [transformAddImportStar],
                },
                compilerOptions: {
                    target: ts.ScriptTarget.ES5,
                    module: ts.ModuleKind.System,
                    newLine: ts.NewLineKind.CarriageReturnLineFeed,
                }
            }).outputText;
            function transformAddImportStar(_context) {
                return (sourceFile) => {
                    return visitNode(sourceFile);
                };
                function visitNode(sf) {
                    // produce `import * as i0 from './comp';
                    const importStar = ts.createImportDeclaration(
                    /*decorators*/ undefined, 
                    /*modifiers*/ undefined, 
                    /*importClause*/ ts.createImportClause(
                    /*name*/ undefined, ts.createNamespaceImport(ts.createIdentifier("i0"))), 
                    /*moduleSpecifier*/ ts.createLiteral("./comp1"));
                    return ts.updateSourceFileNode(sf, [importStar]);
                }
            }
        });
        // https://github.com/Microsoft/TypeScript/issues/17384
        testBaseline("transformAddDecoratedNode", () => {
            return ts.transpileModule("", {
                transformers: {
                    before: [transformAddDecoratedNode],
                },
                compilerOptions: {
                    target: ts.ScriptTarget.ES5,
                    newLine: ts.NewLineKind.CarriageReturnLineFeed,
                }
            }).outputText;
            function transformAddDecoratedNode(_context) {
                return (sourceFile) => {
                    return visitNode(sourceFile);
                };
                function visitNode(sf) {
                    // produce `class Foo { @Bar baz() {} }`;
                    const classDecl = ts.createClassDeclaration([], [], "Foo", /*typeParameters*/ undefined, /*heritageClauses*/ undefined, [
                        ts.createMethod([ts.createDecorator(ts.createIdentifier("Bar"))], [], /**/ undefined, "baz", /**/ undefined, /**/ undefined, [], /**/ undefined, ts.createBlock([]))
                    ]);
                    return ts.updateSourceFileNode(sf, [classDecl]);
                }
            }
        });
    });
})(ts || (ts = {}));
