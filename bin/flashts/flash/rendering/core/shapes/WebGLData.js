define(["require", "exports", "flash/rendering/core/BaseObject"], function (require, exports, BaseObject_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class WebGLData extends BaseObject_1.BaseObject {
        constructor(gl) {
            super();
            this.gl = gl;
            this.data = [];
            this.lastIndex = 0;
            this.clearDirty = -1;
            this.dirty = -1;
        }
    }
    exports.WebGLData = WebGLData;
});
