define(["require", "exports", "tslint", "chalk", "path"], function (require, exports, Lint, chalk_1, path_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function groupBy(array, getGroupId) {
        if (!array) {
            return [];
        }
        const groupIdToGroup = {};
        let result; // Compacted array for return value
        for (let index = 0; index < array.length; index++) {
            const value = array[index];
            const key = getGroupId(value, index);
            if (groupIdToGroup[key]) {
                groupIdToGroup[key].push(value);
            }
            else {
                const newGroup = [value];
                groupIdToGroup[key] = newGroup;
                if (!result) {
                    result = [newGroup];
                }
                else {
                    result.push(newGroup);
                }
            }
        }
        return result || [];
    }
    function max(array, selector) {
        if (!array) {
            return 0;
        }
        let max = 0;
        for (const item of array) {
            const scalar = selector(item);
            if (scalar > max) {
                max = scalar;
            }
        }
        return max;
    }
    function getLink(failure, color) {
        const lineAndCharacter = failure.getStartPosition().getLineAndCharacter();
        const sev = failure.getRuleSeverity().toUpperCase();
        let path = failure.getFileName();
        // Most autolinks only become clickable if they contain a slash in some way; so we make a top level file into a relative path here
        if (path.indexOf("/") === -1 && path.indexOf("\\") === -1) {
            path = `.${path_1.sep}${path}`;
        }
        return `${color ? (sev === "WARNING" ? chalk_1.default.blue(sev) : chalk_1.default.red(sev)) : sev}: ${path}:${lineAndCharacter.line + 1}:${lineAndCharacter.character + 1}`;
    }
    function getLinkMaxSize(failures) {
        return max(failures, f => getLink(f, /*color*/ false).length);
    }
    function getNameMaxSize(failures) {
        return max(failures, f => f.getRuleName().length);
    }
    function pad(str, visiblelen, len) {
        if (visiblelen >= len)
            return str;
        const count = len - visiblelen;
        for (let i = 0; i < count; i++) {
            str += " ";
        }
        return str;
    }
    class Formatter extends Lint.Formatters.AbstractFormatter {
        format(failures) {
            return groupBy(failures, f => f.getFileName()).map(group => {
                const currentFile = group[0].getFileName();
                const linkMaxSize = getLinkMaxSize(group);
                const nameMaxSize = getNameMaxSize(group);
                return `
${currentFile}
${group.map(f => `${pad(getLink(f, /*color*/ true), getLink(f, /*color*/ false).length, linkMaxSize)} ${chalk_1.default.grey(pad(f.getRuleName(), f.getRuleName().length, nameMaxSize))} ${chalk_1.default.yellow(f.getFailure())}`).join("\n")}`;
            }).join("\n");
        }
    }
    Formatter.metadata = {
        formatterName: "autolinkableStylish",
        description: "Human-readable formatter which creates stylish messages with autolinkable filepaths.",
        descriptionDetails: Lint.Utils.dedent `
            Colorized output grouped by file, with autolinkable filepaths containing line and column information
        `,
        sample: Lint.Utils.dedent `
        src/myFile.ts
        ERROR: src/myFile.ts:1:14 semicolon Missing semicolon`,
        consumer: "human"
    };
    exports.Formatter = Formatter;
});
