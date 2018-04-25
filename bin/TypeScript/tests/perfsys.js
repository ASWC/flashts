/// <reference path="..\src\compiler\sys.ts"/>
/// <reference path="..\src\compiler\types.ts"/>
var perftest;
(function (perftest) {
    perftest.readFile = ts.sys.readFile;
    const writeFile = ts.sys.writeFile;
    perftest.write = ts.sys.write;
    const resolvePath = ts.sys.resolvePath;
    perftest.getExecutingFilePath = ts.sys.getExecutingFilePath;
    perftest.getCurrentDirectory = ts.sys.getCurrentDirectory;
    // const exit = ts.sys.exit;
    const args = ts.sys.args;
    // augment sys so first ts.executeCommandLine call will be finish silently
    ts.sys.write = (s) => { };
    ts.sys.exit = (code) => { };
    ts.sys.args = [];
    function restoreSys() {
        ts.sys.args = args;
        ts.sys.write = perftest.write;
    }
    perftest.restoreSys = restoreSys;
    function hasLogIOFlag() {
        return args.length > 2 && args[0] === "--logio";
    }
    perftest.hasLogIOFlag = hasLogIOFlag;
    function getArgsWithoutLogIOFlag() {
        return args.slice(2);
    }
    perftest.getArgsWithoutLogIOFlag = getArgsWithoutLogIOFlag;
    function getArgsWithoutIOLogFile() {
        return args.slice(1);
    }
    perftest.getArgsWithoutIOLogFile = getArgsWithoutIOLogFile;
    const resolvePathLog = {};
    function interceptIO() {
        ts.sys.resolvePath = (s) => {
            const result = resolvePath(s);
            resolvePathLog[s] = result;
            return result;
        };
    }
    perftest.interceptIO = interceptIO;
    function writeIOLog(fileNames) {
        const path = args[1];
        const log = {
            fileNames: fileNames,
            resolvePath: resolvePathLog
        };
        writeFile(path, JSON.stringify(log));
    }
    perftest.writeIOLog = writeIOLog;
    function prepare() {
        const log = JSON.parse(perftest.readFile(args[0]));
        const files = {};
        log.fileNames.forEach(f => { files[f] = perftest.readFile(f); });
        ts.sys.createDirectory = (s) => { };
        ts.sys.directoryExists = (s) => true;
        ts.sys.fileExists = (s) => true;
        const currentDirectory = ts.sys.getCurrentDirectory();
        ts.sys.getCurrentDirectory = () => currentDirectory;
        const executingFilePath = ts.sys.getExecutingFilePath();
        ts.sys.getExecutingFilePath = () => executingFilePath;
        ts.sys.readFile = (s) => {
            return files[s];
        };
        ts.sys.resolvePath = (s) => {
            const path = log.resolvePath[s];
            if (!path) {
                throw new Error("Unexpected path '" + s + "'");
            }
            return path;
        };
        ts.sys.writeFile = (path, data) => { };
        let out = "";
        ts.sys.write = (s) => { out += s; };
        return {
            getOut: () => out,
        };
    }
    perftest.prepare = prepare;
})(perftest || (perftest = {}));
