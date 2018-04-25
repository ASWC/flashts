/// <reference path="harness.ts" />
class RunnerBase {
    constructor() {
        // contains the tests to run
        this.tests = [];
        /** The working directory where tests are found. Needed for batch testing where the input path will differ from the output path inside baselines */
        this.workingDirectory = "";
    }
    /** Add a source file to the runner's list of tests that need to be initialized with initializeTests */
    addTest(fileName) {
        this.tests.push(fileName);
    }
    enumerateFiles(folder, regex, options) {
        return ts.map(Harness.IO.listFiles(Harness.userSpecifiedRoot + folder, regex, { recursive: (options ? options.recursive : false) }), ts.normalizeSlashes);
    }
    /** Replaces instances of full paths with fileNames only */
    static removeFullPaths(path) {
        // If its a full path (starts with "C:" or "/") replace with just the filename
        let fixedPath = /^(\w:|\/)/.test(path) ? ts.getBaseFileName(path) : path;
        // when running in the browser the 'full path' is the host name, shows up in error baselines
        const localHost = /http:\/localhost:\d+/g;
        fixedPath = fixedPath.replace(localHost, "");
        return fixedPath;
    }
}
