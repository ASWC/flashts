/// <reference types="node"/>
define(["require", "exports", "fs", "path"], function (require, exports, fs, path) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var Commands;
    (function (Commands) {
        function dir(obj) {
            obj.filesRead.filter(f => f.result !== undefined).forEach(f => {
                console.log(f.path);
            });
        }
        Commands.dir = dir;
        dir['description'] = ': displays a list of files';
        function find(obj, str) {
            obj.filesRead.filter(f => f.result !== undefined).forEach(f => {
                var lines = f.result.contents.split('\n');
                var printedHeader = false;
                lines.forEach(line => {
                    if (line.indexOf(str) >= 0) {
                        if (!printedHeader) {
                            console.log(' === ' + f.path + ' ===');
                            printedHeader = true;
                        }
                        console.log(line);
                    }
                });
            });
        }
        Commands.find = find;
        find['description'] = ' string: finds text in files';
        function grab(obj, filename) {
            obj.filesRead.filter(f => f.result !== undefined).forEach(f => {
                if (path.basename(f.path) === filename) {
                    fs.writeFile(filename, f.result.contents);
                }
            });
        }
        Commands.grab = grab;
        grab['description'] = ' filename.ts: writes out the specified file to disk';
        function extract(obj, outputFolder) {
            var directorySeparator = "/";
            function directoryExists(path) {
                return fs.existsSync(path) && fs.statSync(path).isDirectory();
            }
            function getDirectoryPath(path) {
                return path.substr(0, Math.max(getRootLength(path), path.lastIndexOf(directorySeparator)));
            }
            function getRootLength(path) {
                if (path.charAt(0) === directorySeparator) {
                    if (path.charAt(1) !== directorySeparator)
                        return 1;
                    var p1 = path.indexOf(directorySeparator, 2);
                    if (p1 < 0)
                        return 2;
                    var p2 = path.indexOf(directorySeparator, p1 + 1);
                    if (p2 < 0)
                        return p1 + 1;
                    return p2 + 1;
                }
                if (path.charAt(1) === ":") {
                    if (path.charAt(2) === directorySeparator)
                        return 3;
                }
                return 0;
            }
            function ensureDirectoriesExist(directoryPath) {
                if (directoryPath.length > getRootLength(directoryPath) && !directoryExists(directoryPath)) {
                    var parentDirectory = getDirectoryPath(directoryPath);
                    ensureDirectoriesExist(parentDirectory);
                    console.log("creating directory: " + directoryPath);
                    fs.mkdirSync(directoryPath);
                }
            }
            function normalizeSlashes(path) {
                return path.replace(/\\/g, "/");
            }
            function transalatePath(outputFolder, path) {
                return normalizeSlashes(outputFolder + directorySeparator + path.replace(":", ""));
            }
            function fileExists(path) {
                return fs.existsSync(path);
            }
            obj.filesRead.forEach(f => {
                var filename = transalatePath(outputFolder, f.path);
                ensureDirectoriesExist(getDirectoryPath(filename));
                console.log("writing filename:   " + filename);
                fs.writeFileSync(filename, f.result.contents);
            });
            console.log("Command:   tsc ");
            obj.arguments.forEach(a => {
                if (getRootLength(a) > 0) {
                    console.log(transalatePath(outputFolder, a));
                }
                else {
                    console.log(a);
                }
                console.log(" ");
            });
        }
        Commands.extract = extract;
        extract['description'] = ' outputFolder: extract all input files to <outputFolder>';
    })(Commands || (Commands = {}));
    var args = process.argv.slice(2);
    if (args.length < 2) {
        console.log('Usage: node ior.js path_to_file.json [command]');
        console.log('List of commands: ');
        Object.keys(Commands).forEach(k => console.log('   ' + k + Commands[k]['description']));
    }
    else {
        var cmd = Commands[args[1]];
        if (cmd === undefined) {
            console.log('Unknown command ' + args[1]);
        }
        else {
            fs.readFile(args[0], 'utf-8', (err, data) => {
                if (err)
                    throw err;
                var json = JSON.parse(data);
                cmd.apply(undefined, [json].concat(args.slice(2)));
            });
        }
    }
});
