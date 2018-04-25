/// <reference path="harness.ts"/>
/// <reference path="runnerbase.ts" />
const fs = require("fs");
const path = require("path");
class ExternalCompileRunnerBase extends RunnerBase {
    enumerateTestFiles() {
        return Harness.IO.getDirectories(this.testDir);
    }
    /** Setup the runner's tests so that they are ready to be executed by the harness
     *  The first test should be a describe/it block that sets up the harness's compiler instance appropriately
     */
    initializeTests() {
        // Read in and evaluate the test list
        const testList = this.tests && this.tests.length ? this.tests : this.enumerateTestFiles();
        describe(`${this.kind()} code samples`, () => {
            for (const test of testList) {
                this.runTest(test);
            }
        });
    }
    runTest(directoryName) {
        // tslint:disable-next-line:no-this-assignment
        const cls = this;
        const timeout = 600000; // 10 minutes
        describe(directoryName, function () {
            this.timeout(timeout);
            const cp = require("child_process");
            it("should build successfully", () => {
                let cwd = path.join(__dirname, "../../", cls.testDir, directoryName);
                const stdio = isWorker ? "pipe" : "inherit";
                let types;
                if (fs.existsSync(path.join(cwd, "test.json"))) {
                    const submoduleDir = path.join(cwd, directoryName);
                    const reset = cp.spawnSync("git", ["reset", "HEAD", "--hard"], { cwd: submoduleDir, timeout, shell: true, stdio });
                    if (reset.status !== 0)
                        throw new Error(`git reset for ${directoryName} failed: ${reset.stderr.toString()}`);
                    const clean = cp.spawnSync("git", ["clean", "-f"], { cwd: submoduleDir, timeout, shell: true, stdio });
                    if (clean.status !== 0)
                        throw new Error(`git clean for ${directoryName} failed: ${clean.stderr.toString()}`);
                    const update = cp.spawnSync("git", ["submodule", "update", "--remote", "."], { cwd: submoduleDir, timeout, shell: true, stdio });
                    if (update.status !== 0)
                        throw new Error(`git submodule update for ${directoryName} failed: ${update.stderr.toString()}`);
                    const config = JSON.parse(fs.readFileSync(path.join(cwd, "test.json"), { encoding: "utf8" }));
                    ts.Debug.assert(!!config.types, "Bad format from test.json: Types field must be present.");
                    types = config.types;
                    cwd = submoduleDir;
                }
                if (fs.existsSync(path.join(cwd, "package.json"))) {
                    if (fs.existsSync(path.join(cwd, "package-lock.json"))) {
                        fs.unlinkSync(path.join(cwd, "package-lock.json"));
                    }
                    if (fs.existsSync(path.join(cwd, "node_modules"))) {
                        require("del").sync(path.join(cwd, "node_modules"), { force: true });
                    }
                    const install = cp.spawnSync(`npm`, ["i", "--ignore-scripts"], { cwd, timeout: timeout / 2, shell: true, stdio }); // NPM shouldn't take the entire timeout - if it takes a long time, it should be terminated and we should log the failure
                    if (install.status !== 0)
                        throw new Error(`NPM Install for ${directoryName} failed: ${install.stderr.toString()}`);
                }
                const args = [path.join(__dirname, "tsc.js")];
                if (types) {
                    args.push("--types", types.join(","));
                }
                args.push("--noEmit");
                Harness.Baseline.runBaseline(`${cls.kind()}/${directoryName}.log`, () => {
                    return cls.report(cp.spawnSync(`node`, args, { cwd, timeout, shell: true }), cwd);
                });
            });
        });
    }
}
class UserCodeRunner extends ExternalCompileRunnerBase {
    constructor() {
        super(...arguments);
        this.testDir = "tests/cases/user/";
    }
    kind() {
        return "user";
    }
    report(result) {
        // tslint:disable-next-line:no-null-keyword
        return result.status === 0 && !result.stdout.length && !result.stderr.length ? null : `Exit Code: ${result.status}
Standard output:
${result.stdout.toString().replace(/\r\n/g, "\n")}


Standard error:
${result.stderr.toString().replace(/\r\n/g, "\n")}`;
    }
}
class DefinitelyTypedRunner extends ExternalCompileRunnerBase {
    constructor() {
        super(...arguments);
        this.testDir = "../DefinitelyTyped/types/";
        this.workingDirectory = this.testDir;
    }
    kind() {
        return "dt";
    }
    report(result, cwd) {
        const stdout = removeExpectedErrors(result.stdout.toString(), cwd);
        const stderr = result.stderr.toString();
        // tslint:disable-next-line:no-null-keyword
        return !stdout.length && !stderr.length ? null : `Exit Code: ${result.status}
Standard output:
${stdout.replace(/\r\n/g, "\n")}


Standard error:
${stderr.replace(/\r\n/g, "\n")}`;
    }
}
function removeExpectedErrors(errors, cwd) {
    return ts.flatten(splitBy(errors.split("\n"), s => /^\S+/.test(s)).filter(isUnexpectedError(cwd))).join("\n");
}
/**
 * Returns true if the line that caused the error contains '$ExpectError',
 * or if the line before that one contains '$ExpectError'.
 * '$ExpectError' is a marker used in Definitely Typed tests,
 * meaning that the error should not contribute toward our error baslines.
 */
function isUnexpectedError(cwd) {
    return (error) => {
        ts.Debug.assertGreaterThanOrEqual(error.length, 1);
        const match = error[0].match(/(.+\.tsx?)\((\d+),\d+\): error TS/);
        if (!match) {
            return true;
        }
        const [, errorFile, lineNumberString] = match;
        const lines = fs.readFileSync(path.join(cwd, errorFile), { encoding: "utf8" }).split("\n");
        const lineNumber = parseInt(lineNumberString) - 1;
        ts.Debug.assertGreaterThanOrEqual(lineNumber, 0);
        ts.Debug.assertLessThan(lineNumber, lines.length);
        const previousLine = lineNumber - 1 > 0 ? lines[lineNumber - 1] : "";
        return !ts.stringContains(lines[lineNumber], "$ExpectError") && !ts.stringContains(previousLine, "$ExpectError");
    };
}
/**
 * Split an array into multiple arrays whenever `isStart` returns true.
 * @example
 * splitBy([1,2,3,4,5,6], isOdd)
 * ==> [[1, 2], [3, 4], [5, 6]]
 * where
 * const isOdd = n => !!(n % 2)
 */
function splitBy(xs, isStart) {
    const result = [];
    let group = [];
    for (const x of xs) {
        if (isStart(x)) {
            if (group.length) {
                result.push(group);
            }
            group = [x];
        }
        else {
            group.push(x);
        }
    }
    if (group.length) {
        result.push(group);
    }
    return result;
}
