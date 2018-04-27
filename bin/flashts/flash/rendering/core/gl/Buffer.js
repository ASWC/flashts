define(["require", "exports", "flash/rendering/core/BaseObject"], function (require, exports, BaseObject_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Buffer extends BaseObject_1.BaseObject {
        constructor(size) {
            super();
            this.vertices = new ArrayBuffer(size);
            this.float32View = new Float32Array(this.vertices);
            this.uint32View = new Uint32Array(this.vertices);
        }
        destroy() {
            this.vertices = null;
            this.positions = null;
            this.uvs = null;
            this.colors = null;
        }
    }
    exports.Buffer = Buffer;
});
//# sourceMappingURL=Buffer.js.map