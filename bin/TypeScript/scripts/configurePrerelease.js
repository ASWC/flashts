define(["require", "exports", "path", "assert", "fs"], function (require, exports, path_1, assert, fs_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const args = process.argv.slice(2);
    function main() {
        if (args.length < 3) {
            console.log("Usage:");
            console.log("\tnode configureNightly.js <dev|insiders> <package.json location> <file containing version>");
            return;
        }
        const tag = args[0];
        if (tag !== "dev" && tag !== "insiders") {
            throw new Error(`Unexpected tag name '${tag}'.`);
        }
        // Acquire the version from the package.json file and modify it appropriately.
        const packageJsonFilePath = path_1.normalize(args[1]);
        const packageJsonValue = JSON.parse(fs_1.readFileSync(packageJsonFilePath).toString());
        const { majorMinor, patch } = parsePackageJsonVersion(packageJsonValue.version);
        const prereleasePatch = getPrereleasePatch(tag, patch);
        // Acquire and modify the source file that exposes the version string.
        const tsFilePath = path_1.normalize(args[2]);
        const tsFileContents = fs_1.readFileSync(tsFilePath).toString();
        const modifiedTsFileContents = updateTsFile(tsFilePath, tsFileContents, majorMinor, patch, prereleasePatch);
        // Ensure we are actually changing something - the user probably wants to know that the update failed.
        if (tsFileContents === modifiedTsFileContents) {
            let err = `\n  '${tsFilePath}' was not updated while configuring for a prerelease publish for '${tag}'.\n    `;
            err += `Ensure that you have not already run this script; otherwise, erase your changes using 'git checkout -- "${tsFilePath}"'.`;
            throw new Error(err + "\n");
        }
        // Finally write the changes to disk.
        // Modify the package.json structure
        packageJsonValue.version = `${majorMinor}.${prereleasePatch}`;
        fs_1.writeFileSync(packageJsonFilePath, JSON.stringify(packageJsonValue, /*replacer:*/ undefined, /*space:*/ 4));
        fs_1.writeFileSync(tsFilePath, modifiedTsFileContents);
    }
    function updateTsFile(tsFilePath, tsFileContents, majorMinor, patch, nightlyPatch) {
        const majorMinorRgx = /export const versionMajorMinor = "(\d+\.\d+)"/;
        const majorMinorMatch = majorMinorRgx.exec(tsFileContents);
        assert(majorMinorMatch !== null, `The file seems to no longer have a string matching '${majorMinorRgx}'.`);
        const parsedMajorMinor = majorMinorMatch[1];
        assert(parsedMajorMinor === majorMinor, `versionMajorMinor does not match. ${tsFilePath}: '${parsedMajorMinor}'; package.json: '${majorMinor}'`);
        const versionRgx = /export const version = `\$\{versionMajorMinor\}\.(\d)(-dev)?`;/;
        const patchMatch = versionRgx.exec(tsFileContents);
        assert(patchMatch !== null, "The file seems to no longer have a string matching " + versionRgx.toString());
        const parsedPatch = patchMatch[1];
        if (parsedPatch !== patch) {
            throw new Error(`patch does not match. ${tsFilePath}: '${parsedPatch}; package.json: '${patch}'`);
        }
        return tsFileContents.replace(versionRgx, `export const version = \`\${versionMajorMinor}.${nightlyPatch}\`;`);
    }
    function parsePackageJsonVersion(versionString) {
        const versionRgx = /(\d+\.\d+)\.(\d+)($|\-)/;
        const match = versionString.match(versionRgx);
        assert(match !== null, "package.json 'version' should match " + versionRgx.toString());
        return { majorMinor: match[1], patch: match[2] };
    }
    /** e.g. 0-dev.20170707 */
    function getPrereleasePatch(tag, plainPatch) {
        // We're going to append a representation of the current time at the end of the current version.
        // String.prototype.toISOString() returns a 24-character string formatted as 'YYYY-MM-DDTHH:mm:ss.sssZ',
        // but we'd prefer to just remove separators and limit ourselves to YYYYMMDD.
        // UTC time will always be implicit here.
        const now = new Date();
        const timeStr = now.toISOString().replace(/:|T|\.|-/g, "").slice(0, 8);
        return `${plainPatch}-${tag}.${timeStr}`;
    }
    main();
});
