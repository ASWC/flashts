/// <reference types="node" />
define(["require", "exports", "http", "fs", "path", "url", "child_process", "os"], function (require, exports, http, fs, path, url, child_process, os) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    /// Command line processing ///
    if (process.argv[2] == "--help") {
        console.log("Runs a node server on port 8888, looking for tests folder in the current directory\n");
        console.log("Syntax: node nodeServer.js [typescriptEnlistmentDirectory] [tests] [--browser] [--verbose]\n");
        console.log("Examples: \n\tnode nodeServer.js .");
        console.log("\tnode nodeServer.js 3000 D:/src/typescript/public --verbose IE");
    }
    function switchToForwardSlashes(path) {
        return path.replace(/\\/g, "/").replace(/\/\//g, "/");
    }
    const port = 8888; // harness.ts and webTestResults.html depend on this exact port number.
    let browser;
    if (process.argv[2]) {
        browser = process.argv[2];
        if (browser !== "chrome" && browser !== "IE") {
            console.log(`Invalid command line arguments. Got ${browser} but expected chrome, IE or nothing.`);
        }
    }
    const grep = process.argv[3];
    let verbose = false;
    if (process.argv[4] == "--verbose") {
        verbose = true;
    }
    else if (process.argv[4] && process.argv[4] !== "--verbose") {
        console.log(`Invalid command line arguments. Got ${process.argv[4]} but expected --verbose or nothing.`);
    }
    /// Utils ///
    function log(msg) {
        if (verbose) {
            console.log(msg);
        }
    }
    const directorySeparator = "/";
    function getRootLength(path) {
        if (path.charAt(0) === directorySeparator) {
            if (path.charAt(1) !== directorySeparator)
                return 1;
            const p1 = path.indexOf("/", 2);
            if (p1 < 0)
                return 2;
            const p2 = path.indexOf("/", p1 + 1);
            if (p2 < 0)
                return p1 + 1;
            return p2 + 1;
        }
        if (path.charAt(1) === ":") {
            if (path.charAt(2) === directorySeparator)
                return 3;
        }
        // Per RFC 1738 'file' URI schema has the shape file://<host>/<path>
        // if <host> is omitted then it is assumed that host value is 'localhost',
        // however slash after the omitted <host> is not removed.
        // file:///folder1/file1 - this is a correct URI
        // file://folder2/file2 - this is an incorrect URI
        if (path.lastIndexOf("file:///", 0) === 0) {
            return "file:///".length;
        }
        const idx = path.indexOf("://");
        if (idx !== -1) {
            return idx + "://".length;
        }
        return 0;
    }
    function getDirectoryPath(path) {
        path = switchToForwardSlashes(path);
        return path.substr(0, Math.max(getRootLength(path), path.lastIndexOf(directorySeparator)));
    }
    function ensureDirectoriesExist(path) {
        path = switchToForwardSlashes(path);
        if (path.length > getRootLength(path) && !fs.existsSync(path)) {
            const parentDirectory = getDirectoryPath(path);
            ensureDirectoriesExist(parentDirectory);
            if (!fs.existsSync(path)) {
                fs.mkdirSync(path);
            }
        }
    }
    // Copied from the compiler sources
    function dir(dirPath, spec, options) {
        options = options || {};
        return filesInFolder(dirPath);
        function filesInFolder(folder) {
            folder = switchToForwardSlashes(folder);
            let paths = [];
            // Everything after the current directory is relative
            const baseDirectoryLength = process.cwd().length + 1;
            try {
                const files = fs.readdirSync(folder);
                for (let i = 0; i < files.length; i++) {
                    const stat = fs.statSync(path.join(folder, files[i]));
                    if (options.recursive && stat.isDirectory()) {
                        paths = paths.concat(filesInFolder(path.join(folder, files[i])));
                    }
                    else if (stat.isFile() && (!spec || files[i].match(spec))) {
                        const relativePath = folder.substring(baseDirectoryLength);
                        paths.push(path.join(relativePath, files[i]));
                    }
                }
            }
            catch (err) {
                // Skip folders that are inaccessible
            }
            return paths;
        }
    }
    function writeFile(path, data) {
        ensureDirectoriesExist(getDirectoryPath(path));
        fs.writeFileSync(path, data);
    }
    /// Request Handling ///
    function handleResolutionRequest(filePath, res) {
        let resolvedPath = path.resolve(filePath, "");
        resolvedPath = resolvedPath.substring(resolvedPath.indexOf("tests"));
        resolvedPath = switchToForwardSlashes(resolvedPath);
        send(200 /* Success */, res, resolvedPath);
    }
    function send(responseCode, res, contents, contentType = "binary") {
        res.writeHead(responseCode, { "Content-Type": contentType });
        res.end(contents);
    }
    // Reads the data from a post request and passes it to the given callback
    function processPost(req, res, callback) {
        let queryData = "";
        if (typeof callback !== "function")
            return;
        if (req.method == "POST") {
            req.on("data", (data) => {
                queryData += data;
                if (queryData.length > 1e8) {
                    queryData = "";
                    send(413 /* PayloadTooLarge */, res, undefined);
                    console.log("ERROR: destroying connection");
                    req.connection.destroy();
                }
            });
            req.on("end", () => {
                // res.post = url.parse(req.url).query;
                callback(queryData);
            });
        }
        else {
            send(405 /* MethodNotAllowed */, res, undefined);
        }
    }
    var RequestType;
    (function (RequestType) {
        RequestType[RequestType["GetFile"] = 0] = "GetFile";
        RequestType[RequestType["GetDir"] = 1] = "GetDir";
        RequestType[RequestType["ResolveFile"] = 2] = "ResolveFile";
        RequestType[RequestType["WriteFile"] = 3] = "WriteFile";
        RequestType[RequestType["DeleteFile"] = 4] = "DeleteFile";
        RequestType[RequestType["WriteDir"] = 5] = "WriteDir";
        RequestType[RequestType["DeleteDir"] = 6] = "DeleteDir";
        RequestType[RequestType["AppendFile"] = 7] = "AppendFile";
        RequestType[RequestType["Unknown"] = 8] = "Unknown";
    })(RequestType || (RequestType = {}));
    function getRequestOperation(req) {
        if (req.method === "GET" && req.url.indexOf("?") === -1) {
            if (req.url.indexOf(".") !== -1)
                return RequestType.GetFile;
            else
                return RequestType.GetDir;
        }
        else {
            const queryData = url.parse(req.url, /*parseQueryString*/ true).query;
            if (req.method === "GET" && queryData.resolve !== undefined)
                return RequestType.ResolveFile;
            // mocha uses ?grep=<regexp> query string as equivalent to the --grep command line option used to filter tests
            if (req.method === "GET" && queryData.grep !== undefined)
                return RequestType.GetFile;
            if (req.method === "POST" && queryData.action) {
                const path = req.url.substr(0, req.url.lastIndexOf("?"));
                const isFile = path.substring(path.lastIndexOf("/")).indexOf(".") !== -1;
                switch (queryData.action.toUpperCase()) {
                    case "WRITE":
                        return isFile ? RequestType.WriteFile : RequestType.WriteDir;
                    case "DELETE":
                        return isFile ? RequestType.DeleteFile : RequestType.DeleteDir;
                    case "APPEND":
                        return isFile ? RequestType.AppendFile : RequestType.Unknown;
                }
            }
            return RequestType.Unknown;
        }
    }
    function handleRequestOperation(req, res, operation, reqPath) {
        switch (operation) {
            case RequestType.GetDir:
                const filesInFolder = dir(reqPath, "", { recursive: true });
                send(200 /* Success */, res, filesInFolder.join(","));
                break;
            case RequestType.GetFile:
                fs.readFile(reqPath, (err, file) => {
                    const contentType = contentTypeForExtension(path.extname(reqPath));
                    if (err) {
                        send(404 /* NotFound */, res, err.message, contentType);
                    }
                    else {
                        send(200 /* Success */, res, file, contentType);
                    }
                });
                break;
            case RequestType.ResolveFile:
                const resolveRequest = req.url.match(/(.*)\?resolve/);
                handleResolutionRequest(resolveRequest[1], res);
                break;
            case RequestType.WriteFile:
                processPost(req, res, (data) => {
                    writeFile(reqPath, data);
                });
                send(200 /* Success */, res, undefined);
                break;
            case RequestType.WriteDir:
                fs.mkdirSync(reqPath);
                send(200 /* Success */, res, undefined);
                break;
            case RequestType.DeleteFile:
                if (fs.existsSync(reqPath)) {
                    fs.unlinkSync(reqPath);
                }
                send(200 /* Success */, res, undefined);
                break;
            case RequestType.DeleteDir:
                if (fs.existsSync(reqPath)) {
                    fs.rmdirSync(reqPath);
                }
                send(200 /* Success */, res, undefined);
                break;
            case RequestType.AppendFile:
                processPost(req, res, (data) => {
                    fs.appendFileSync(reqPath, data);
                });
                send(200 /* Success */, res, undefined);
                break;
            case RequestType.Unknown:
            default:
                send(400 /* BadRequest */, res, undefined);
                break;
        }
        function contentTypeForExtension(ext) {
            switch (ext) {
                case ".js": return "text/javascript";
                case ".css": return "text/css";
                case ".html": return "text/html";
                default: return "binary";
            }
        }
    }
    console.log(`Static file server running at\n  => http://localhost:${port}/\nCTRL + C to shutdown`);
    http.createServer((req, res) => {
        log(`${req.method} ${req.url}`);
        const uri = decodeURIComponent(url.parse(req.url).pathname);
        const reqPath = path.join(process.cwd(), uri);
        const operation = getRequestOperation(req);
        handleRequestOperation(req, res, operation, reqPath);
    }).listen(port);
    let browserPath;
    if (browser === "chrome") {
        let defaultChromePath = "";
        switch (os.platform()) {
            case "win32":
                defaultChromePath = "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe";
                break;
            case "darwin":
                defaultChromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
                break;
            case "linux":
                defaultChromePath = "/opt/google/chrome/chrome";
                break;
            default:
                console.log(`default Chrome location is unknown for platform '${os.platform()}'`);
                break;
        }
        if (fs.existsSync(defaultChromePath)) {
            browserPath = defaultChromePath;
        }
        else {
            browserPath = browser;
        }
    }
    else {
        const defaultIEPath = "C:/Program Files/Internet Explorer/iexplore.exe";
        if (fs.existsSync(defaultIEPath)) {
            browserPath = defaultIEPath;
        }
        else {
            browserPath = browser;
        }
    }
    console.log(`Using browser: ${browserPath}`);
    const queryString = grep ? `?grep=${grep}` : "";
    child_process.spawn(browserPath, [`http://localhost:${port}/tests/webTestResults.html${queryString}`], {
        stdio: "inherit"
    });
});
