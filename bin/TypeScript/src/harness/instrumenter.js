define(["require", "exports", "fs", "path"], function (require, exports, fs, path) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function instrumentForRecording(fn, tscPath) {
        instrument(tscPath, `
ts.sys = Playback.wrapSystem(ts.sys);
ts.sys.startRecord("${fn}");`, `ts.sys.endRecord();`);
    }
    function instrumentForReplay(logFilename, tscPath) {
        instrument(tscPath, `
ts.sys = Playback.wrapSystem(ts.sys);
ts.sys.startReplay("${logFilename}");`);
    }
    function instrument(tscPath, prepareCode, cleanupCode = "") {
        const bak = `${tscPath}.bak`;
        fs.exists(bak, (backupExists) => {
            let filename = tscPath;
            if (backupExists) {
                filename = bak;
            }
            fs.readFile(filename, "utf-8", (err, tscContent) => {
                if (err)
                    throw err;
                fs.writeFile(bak, tscContent, (err) => {
                    if (err)
                        throw err;
                    fs.readFile(path.resolve(path.dirname(tscPath) + "/loggedIO.js"), "utf-8", (err, loggerContent) => {
                        if (err)
                            throw err;
                        const invocationLine = "ts.executeCommandLine(ts.sys.args);";
                        const index1 = tscContent.indexOf(invocationLine);
                        if (index1 < 0) {
                            throw new Error(`Could not find ${invocationLine}`);
                        }
                        const index2 = index1 + invocationLine.length;
                        const newContent = tscContent.substr(0, index1) + loggerContent + prepareCode + invocationLine + cleanupCode + tscContent.substr(index2) + "\r\n";
                        fs.writeFile(tscPath, newContent, err => {
                            if (err)
                                throw err;
                        });
                    });
                });
            });
        });
    }
    const isJson = (arg) => arg.indexOf(".json") > 0;
    const record = process.argv.indexOf("record");
    const tscPath = process.argv[process.argv.length - 1];
    if (record >= 0) {
        console.log(`Instrumenting ${tscPath} for recording`);
        instrumentForRecording(process.argv[record + 1], tscPath);
    }
    else if (process.argv.some(isJson)) {
        const filename = process.argv.filter(isJson)[0];
        instrumentForReplay(filename, tscPath);
    }
});
