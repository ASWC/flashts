/// <reference path="..\..\..\src\harness\harness.ts" />
/// <reference path="..\..\..\src\harness\virtualFileSystem.ts" />
var ts;
(function (ts) {
    describe("Organize imports", () => {
        describe("Sort imports", () => {
            it("Sort - non-relative vs non-relative", () => {
                assertSortsBefore(`import y from "lib1";`, `import x from "lib2";`);
            });
            it("Sort - relative vs relative", () => {
                assertSortsBefore(`import y from "./lib1";`, `import x from "./lib2";`);
            });
            it("Sort - relative vs non-relative", () => {
                assertSortsBefore(`import y from "lib";`, `import x from "./lib";`);
            });
            function assertSortsBefore(importString1, importString2) {
                const [{ moduleSpecifier: moduleSpecifier1 }, { moduleSpecifier: moduleSpecifier2 }] = parseImports(importString1, importString2);
                assert.equal(ts.OrganizeImports.compareModuleSpecifiers(moduleSpecifier1, moduleSpecifier2), -1 /* LessThan */);
                assert.equal(ts.OrganizeImports.compareModuleSpecifiers(moduleSpecifier2, moduleSpecifier1), 1 /* GreaterThan */);
            }
        });
        describe("Coalesce imports", () => {
            it("No imports", () => {
                assert.isEmpty(ts.OrganizeImports.coalesceImports([]));
            });
            it("Sort specifiers", () => {
                const sortedImports = parseImports(`import { default as m, a as n, b, y, z as o } from "lib";`);
                const actualCoalescedImports = ts.OrganizeImports.coalesceImports(sortedImports);
                const expectedCoalescedImports = parseImports(`import { a as n, b, default as m, y, z as o } from "lib";`);
                assertListEqual(actualCoalescedImports, expectedCoalescedImports);
            });
            it("Combine side-effect-only imports", () => {
                const sortedImports = parseImports(`import "lib";`, `import "lib";`);
                const actualCoalescedImports = ts.OrganizeImports.coalesceImports(sortedImports);
                const expectedCoalescedImports = parseImports(`import "lib";`);
                assertListEqual(actualCoalescedImports, expectedCoalescedImports);
            });
            it("Combine namespace imports", () => {
                const sortedImports = parseImports(`import * as x from "lib";`, `import * as y from "lib";`);
                const actualCoalescedImports = ts.OrganizeImports.coalesceImports(sortedImports);
                const expectedCoalescedImports = sortedImports;
                assertListEqual(actualCoalescedImports, expectedCoalescedImports);
            });
            it("Combine default imports", () => {
                const sortedImports = parseImports(`import x from "lib";`, `import y from "lib";`);
                const actualCoalescedImports = ts.OrganizeImports.coalesceImports(sortedImports);
                const expectedCoalescedImports = parseImports(`import { default as x, default as y } from "lib";`);
                assertListEqual(actualCoalescedImports, expectedCoalescedImports);
            });
            it("Combine property imports", () => {
                const sortedImports = parseImports(`import { x } from "lib";`, `import { y as z } from "lib";`);
                const actualCoalescedImports = ts.OrganizeImports.coalesceImports(sortedImports);
                const expectedCoalescedImports = parseImports(`import { x, y as z } from "lib";`);
                assertListEqual(actualCoalescedImports, expectedCoalescedImports);
            });
            it("Combine side-effect-only import with namespace import", () => {
                const sortedImports = parseImports(`import "lib";`, `import * as x from "lib";`);
                const actualCoalescedImports = ts.OrganizeImports.coalesceImports(sortedImports);
                const expectedCoalescedImports = sortedImports;
                assertListEqual(actualCoalescedImports, expectedCoalescedImports);
            });
            it("Combine side-effect-only import with default import", () => {
                const sortedImports = parseImports(`import "lib";`, `import x from "lib";`);
                const actualCoalescedImports = ts.OrganizeImports.coalesceImports(sortedImports);
                const expectedCoalescedImports = sortedImports;
                assertListEqual(actualCoalescedImports, expectedCoalescedImports);
            });
            it("Combine side-effect-only import with property import", () => {
                const sortedImports = parseImports(`import "lib";`, `import { x } from "lib";`);
                const actualCoalescedImports = ts.OrganizeImports.coalesceImports(sortedImports);
                const expectedCoalescedImports = sortedImports;
                assertListEqual(actualCoalescedImports, expectedCoalescedImports);
            });
            it("Combine namespace import with default import", () => {
                const sortedImports = parseImports(`import * as x from "lib";`, `import y from "lib";`);
                const actualCoalescedImports = ts.OrganizeImports.coalesceImports(sortedImports);
                const expectedCoalescedImports = parseImports(`import y, * as x from "lib";`);
                assertListEqual(actualCoalescedImports, expectedCoalescedImports);
            });
            it("Combine namespace import with property import", () => {
                const sortedImports = parseImports(`import * as x from "lib";`, `import { y } from "lib";`);
                const actualCoalescedImports = ts.OrganizeImports.coalesceImports(sortedImports);
                const expectedCoalescedImports = sortedImports;
                assertListEqual(actualCoalescedImports, expectedCoalescedImports);
            });
            it("Combine default import with property import", () => {
                const sortedImports = parseImports(`import x from "lib";`, `import { y } from "lib";`);
                const actualCoalescedImports = ts.OrganizeImports.coalesceImports(sortedImports);
                const expectedCoalescedImports = parseImports(`import x, { y } from "lib";`);
                assertListEqual(actualCoalescedImports, expectedCoalescedImports);
            });
            it("Combine many imports", () => {
                const sortedImports = parseImports(`import "lib";`, `import * as y from "lib";`, `import w from "lib";`, `import { b } from "lib";`, `import "lib";`, `import * as x from "lib";`, `import z from "lib";`, `import { a } from "lib";`);
                const actualCoalescedImports = ts.OrganizeImports.coalesceImports(sortedImports);
                const expectedCoalescedImports = parseImports(`import "lib";`, `import * as x from "lib";`, `import * as y from "lib";`, `import { a, b, default as w, default as z } from "lib";`);
                assertListEqual(actualCoalescedImports, expectedCoalescedImports);
            });
            // This is descriptive, rather than normative
            it("Combine two namespace imports with one default import", () => {
                const sortedImports = parseImports(`import * as x from "lib";`, `import * as y from "lib";`, `import z from "lib";`);
                const actualCoalescedImports = ts.OrganizeImports.coalesceImports(sortedImports);
                const expectedCoalescedImports = sortedImports;
                assertListEqual(actualCoalescedImports, expectedCoalescedImports);
            });
        });
        describe("Baselines", () => {
            const libFile = {
                path: "/lib.ts",
                content: `
export function F1();
export default function F2();
`,
            };
            const reactLibFile = {
                path: "/react.ts",
                content: `
export const React = {
createElement: (_type, _props, _children) => {},
};

export const Other = 1;
`,
            };
            // Don't bother to actually emit a baseline for this.
            it("NoImports", () => {
                const testFile = {
                    path: "/a.ts",
                    content: "function F() { }",
                };
                const languageService = makeLanguageService(testFile);
                const changes = languageService.organizeImports({ type: "file", fileName: testFile.path }, ts.testFormatOptions, ts.defaultPreferences);
                assert.isEmpty(changes);
            });
            testOrganizeImports("Renamed_used", {
                path: "/test.ts",
                content: `
import { F1 as EffOne, F2 as EffTwo } from "lib";
EffOne();
`,
            }, libFile);
            testOrganizeImports("Simple", {
                path: "/test.ts",
                content: `
import { F1, F2 } from "lib";
import * as NS from "lib";
import D from "lib";

NS.F1();
D();
F1();
F2();
`,
            }, libFile);
            testOrganizeImports("Unused_Some", {
                path: "/test.ts",
                content: `
import { F1, F2 } from "lib";
import * as NS from "lib";
import D from "lib";

D();
`,
            }, libFile);
            testOrganizeImports("Unused_All", {
                path: "/test.ts",
                content: `
import { F1, F2 } from "lib";
import * as NS from "lib";
import D from "lib";
`,
            }, libFile);
            testOrganizeImports("Unused_false_positive_shorthand_assignment", {
                path: "/test.ts",
                content: `
import { x } from "a";
const o = { x };
`
            });
            testOrganizeImports("Unused_false_positive_export_shorthand", {
                path: "/test.ts",
                content: `
import { x } from "a";
export { x };
`
            });
            testOrganizeImports("MoveToTop", {
                path: "/test.ts",
                content: `
import { F1, F2 } from "lib";
F1();
F2();
import * as NS from "lib";
NS.F1();
import D from "lib";
D();
`,
            }, libFile);
            // tslint:disable no-invalid-template-strings
            testOrganizeImports("MoveToTop_Invalid", {
                path: "/test.ts",
                content: `
import { F1, F2 } from "lib";
F1();
F2();
import * as NS from "lib";
NS.F1();
import b from ${"`${'lib'}`"};
import a from ${"`${'lib'}`"};
import D from "lib";
D();
`,
            }, libFile);
            // tslint:enable no-invalid-template-strings
            testOrganizeImports("CoalesceMultipleModules", {
                path: "/test.ts",
                content: `
import { d } from "lib1";
import { b } from "lib1";
import { c } from "lib2";
import { a } from "lib2";
a + b + c + d;
`,
            }, { path: "/lib1.ts", content: "export const b = 1, d = 2;" }, { path: "/lib2.ts", content: "export const a = 3, c = 4;" });
            testOrganizeImports("CoalesceTrivia", {
                path: "/test.ts",
                content: `
/*A*/import /*B*/ { /*C*/ F2 /*D*/ } /*E*/ from /*F*/ "lib" /*G*/;/*H*/ //I
/*J*/import /*K*/ { /*L*/ F1 /*M*/ } /*N*/ from /*O*/ "lib" /*P*/;/*Q*/ //R

F1();
F2();
`,
            }, libFile);
            testOrganizeImports("SortTrivia", {
                path: "/test.ts",
                content: `
/*A*/import /*B*/ "lib2" /*C*/;/*D*/ //E
/*F*/import /*G*/ "lib1" /*H*/;/*I*/ //J
`,
            }, { path: "/lib1.ts", content: "" }, { path: "/lib2.ts", content: "" });
            testOrganizeImports("UnusedTrivia1", {
                path: "/test.ts",
                content: `
/*A*/import /*B*/ { /*C*/ F1 /*D*/ } /*E*/ from /*F*/ "lib" /*G*/;/*H*/ //I
`,
            }, libFile);
            testOrganizeImports("UnusedTrivia2", {
                path: "/test.ts",
                content: `
/*A*/import /*B*/ { /*C*/ F1 /*D*/, /*E*/ F2 /*F*/ } /*G*/ from /*H*/ "lib" /*I*/;/*J*/ //K

F1();
`,
            }, libFile);
            testOrganizeImports("UnusedHeaderComment", {
                path: "/test.ts",
                content: `
// Header
import { F1 } from "lib";
`,
            }, libFile);
            testOrganizeImports("SortHeaderComment", {
                path: "/test.ts",
                content: `
// Header
import "lib2";
import "lib1";
`,
            }, { path: "/lib1.ts", content: "" }, { path: "/lib2.ts", content: "" });
            testOrganizeImports("AmbientModule", {
                path: "/test.ts",
                content: `
declare module "mod" {
    import { F1 } from "lib";
    import * as NS from "lib";
    import { F2 } from "lib";

    function F(f1: {} = F1, f2: {} = F2) {}
}
`,
            }, libFile);
            testOrganizeImports("TopLevelAndAmbientModule", {
                path: "/test.ts",
                content: `
import D from "lib";

declare module "mod" {
    import { F1 } from "lib";
    import * as NS from "lib";
    import { F2 } from "lib";

    function F(f1: {} = F1, f2: {} = F2) {}
}

import E from "lib";
import "lib";

D();
`,
            }, libFile);
            testOrganizeImports("JsxFactoryUsed", {
                path: "/test.tsx",
                content: `
import { React, Other } from "react";

<div/>;
`,
            }, reactLibFile);
            // This is descriptive, rather than normative
            testOrganizeImports("JsxFactoryUnusedTsx", {
                path: "/test.tsx",
                content: `
import { React, Other } from "react";
`,
            }, reactLibFile);
            testOrganizeImports("JsxFactoryUnusedTs", {
                path: "/test.ts",
                content: `
import { React, Other } from "react";
`,
            }, reactLibFile);
            function testOrganizeImports(testName, testFile, ...otherFiles) {
                it(testName, () => runBaseline(`organizeImports/${testName}.ts`, testFile, ...otherFiles));
            }
            function runBaseline(baselinePath, testFile, ...otherFiles) {
                const { path: testPath, content: testContent } = testFile;
                const languageService = makeLanguageService(testFile, ...otherFiles);
                const changes = languageService.organizeImports({ type: "file", fileName: testPath }, ts.testFormatOptions, ts.defaultPreferences);
                assert.equal(changes.length, 1);
                assert.equal(changes[0].fileName, testPath);
                Harness.Baseline.runBaseline(baselinePath, () => {
                    const newText = ts.textChanges.applyChanges(testContent, changes[0].textChanges);
                    return [
                        "// ==ORIGINAL==",
                        testContent,
                        "// ==ORGANIZED==",
                        newText,
                    ].join(ts.newLineCharacter);
                });
            }
            function makeLanguageService(...files) {
                const host = ts.projectSystem.createServerHost(files);
                const projectService = ts.projectSystem.createProjectService(host, { useSingleInferredProject: true });
                projectService.setCompilerOptionsForInferredProjects({ jsx: files.some(f => f.path.endsWith("x")) ? ts.JsxEmit.React : ts.JsxEmit.None });
                files.forEach(f => projectService.openClientFile(f.path));
                return projectService.inferredProjects[0].getLanguageService();
            }
        });
        function parseImports(...importStrings) {
            const sourceFile = ts.createSourceFile("a.ts", importStrings.join("\n"), ts.ScriptTarget.ES2015, /*setParentNodes*/ true, ts.ScriptKind.TS);
            const imports = ts.filter(sourceFile.statements, ts.isImportDeclaration);
            assert.equal(imports.length, importStrings.length);
            return imports;
        }
        function assertEqual(node1, node2) {
            if (node1 === undefined) {
                assert.isUndefined(node2);
                return;
            }
            else if (node2 === undefined) {
                assert.isUndefined(node1); // Guaranteed to fail
                return;
            }
            assert.equal(node1.kind, node2.kind);
            switch (node1.kind) {
                case ts.SyntaxKind.ImportDeclaration:
                    const decl1 = node1;
                    const decl2 = node2;
                    assertEqual(decl1.importClause, decl2.importClause);
                    assertEqual(decl1.moduleSpecifier, decl2.moduleSpecifier);
                    break;
                case ts.SyntaxKind.ImportClause:
                    const clause1 = node1;
                    const clause2 = node2;
                    assertEqual(clause1.name, clause2.name);
                    assertEqual(clause1.namedBindings, clause2.namedBindings);
                    break;
                case ts.SyntaxKind.NamespaceImport:
                    const nsi1 = node1;
                    const nsi2 = node2;
                    assertEqual(nsi1.name, nsi2.name);
                    break;
                case ts.SyntaxKind.NamedImports:
                    const ni1 = node1;
                    const ni2 = node2;
                    assertListEqual(ni1.elements, ni2.elements);
                    break;
                case ts.SyntaxKind.ImportSpecifier:
                    const is1 = node1;
                    const is2 = node2;
                    assertEqual(is1.name, is2.name);
                    assertEqual(is1.propertyName, is2.propertyName);
                    break;
                case ts.SyntaxKind.Identifier:
                    const id1 = node1;
                    const id2 = node2;
                    assert.equal(id1.text, id2.text);
                    break;
                case ts.SyntaxKind.StringLiteral:
                case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
                    const sl1 = node1;
                    const sl2 = node2;
                    assert.equal(sl1.text, sl2.text);
                    break;
                default:
                    assert.equal(node1.getText(), node2.getText());
                    break;
            }
        }
        function assertListEqual(list1, list2) {
            if (list1 === undefined || list2 === undefined) {
                assert.isUndefined(list1);
                assert.isUndefined(list2);
                return;
            }
            assert.equal(list1.length, list2.length);
            for (let i = 0; i < list1.length; i++) {
                assertEqual(list1[i], list2[i]);
            }
        }
    });
})(ts || (ts = {}));
