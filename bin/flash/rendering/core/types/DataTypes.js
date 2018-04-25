define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class GLAttributeData {
        constructor(type, size, location, pointer) {
            this.size = size;
            this.type = type;
            this.location = location;
            this.pointer = pointer;
        }
    }
    exports.GLAttributeData = GLAttributeData;
});
