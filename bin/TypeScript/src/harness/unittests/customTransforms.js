/// <reference path="..\..\compiler\emitter.ts" />
/// <reference path="..\harness.ts" />
var ts;
(function (ts) {
    describe("customTransforms", () => {
        function emitsCorrectly(name, sources, customTransformers, options = {}) {
            it(name, () => {
                const roots = sources.map(source => ts.createSourceFile(source.file, source.text, ts.ScriptTarget.ES2015));
                const fileMap = ts.arrayToMap(roots, file => file.fileName);
                const outputs = ts.createMap();
                const host = {
                    getSourceFile: (fileName) => fileMap.get(fileName),
                    getDefaultLibFileName: () => "lib.d.ts",
                    getCurrentDirectory: () => "",
                    getDirectories: () => [],
                    getCanonicalFileName: (fileName) => fileName,
                    useCaseSensitiveFileNames: () => true,
                    getNewLine: () => "\n",
                    fileExists: (fileName) => fileMap.has(fileName),
                    readFile: (fileName) => fileMap.has(fileName) ? fileMap.get(fileName).text : undefined,
                    writeFile: (fileName, text) => outputs.set(fileName, text),
                };
                const program = ts.createProgram(ts.arrayFrom(fileMap.keys()), options, host);
                program.emit(/*targetSourceFile*/ undefined, host.writeFile, /*cancellationToken*/ undefined, /*emitOnlyDtsFiles*/ false, customTransformers);
                Harness.Baseline.runBaseline(`customTransforms/${name}.js`, () => {
                    let content = "";
                    for (const [file, text] of ts.arrayFrom(outputs.entries())) {
                        if (content)
                            content += "\n\n";
                        content += `// [${file}]\n`;
                        content += text;
                    }
                    return content;
                });
            });
        }
        const sources = [{
                file: "source.ts",
                text: `
            function f1() { }
            class c() { }
            enum e { }
            // leading
            function f2() { } // trailing
            `
            }];
        const before = context => {
            return file => ts.visitEachChild(file, visit, context);
            function visit(node) {
                switch (node.kind) {
                    case ts.SyntaxKind.FunctionDeclaration:
                        return visitFunction(node);
                    default:
                        return ts.visitEachChild(node, visit, context);
                }
            }
            function visitFunction(node) {
                ts.addSyntheticLeadingComment(node, ts.SyntaxKind.MultiLineCommentTrivia, "@before", /*hasTrailingNewLine*/ true);
                return node;
            }
        };
        const after = context => {
            return file => ts.visitEachChild(file, visit, context);
            function visit(node) {
                switch (node.kind) {
                    case ts.SyntaxKind.VariableStatement:
                        return visitVariableStatement(node);
                    default:
                        return ts.visitEachChild(node, visit, context);
                }
            }
            function visitVariableStatement(node) {
                ts.addSyntheticLeadingComment(node, ts.SyntaxKind.SingleLineCommentTrivia, "@after");
                return node;
            }
        };
        emitsCorrectly("before", sources, { before: [before] });
        emitsCorrectly("after", sources, { after: [after] });
        emitsCorrectly("both", sources, { before: [before], after: [after] });
        emitsCorrectly("before+decorators", [{
                file: "source.ts",
                text: `
                declare const dec: any;
                class B {}
                @dec export class C { constructor(b: B) { } }
                'change'
            `
            }], { before: [
                context => node => ts.visitNode(node, function visitor(node) {
                    if (ts.isStringLiteral(node) && node.text === "change")
                        return ts.createLiteral("changed");
                    return ts.visitEachChild(node, visitor, context);
                })
            ] }, {
            target: ts.ScriptTarget.ES5,
            module: ts.ModuleKind.ES2015,
            emitDecoratorMetadata: true,
            experimentalDecorators: true
        });
    });
})(ts || (ts = {}));
