define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Utils {
        static numberIsInteger(value) {
            return typeof value === 'number' && isFinite(value) && Math.floor(value) === value;
        }
        ;
    }
    exports.Utils = Utils;
});
