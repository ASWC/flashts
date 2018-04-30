define(["require", "exports", "flash/display/BaseObject"], function (require, exports, BaseObject_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class IndexBuffer3D extends BaseObject_1.BaseObject {
        constructor(gl, type, data, drawType) {
            super();
            this.gl = gl;
            this.buffer = gl.createBuffer();
            this.type = type || gl.ARRAY_BUFFER;
            this.drawType = drawType || gl.STATIC_DRAW;
            this.data = IndexBuffer3D.EMPTY_ARRAY_BUFFER;
            if (data) {
                this.upload(data);
            }
            this._updateID = 0;
        }
        ;
        upload(data, offset = null, dontBind = null) {
            if (!dontBind)
                this.bind();
            var gl = this.gl;
            data = data || this.data;
            offset = offset || 0;
            if (this.data.byteLength >= data.byteLength) {
                gl.bufferSubData(this.type, offset, data);
            }
            else {
                gl.bufferData(this.type, data, this.drawType);
            }
            this.data = data;
        }
        ;
        bind() {
            var gl = this.gl;
            gl.bindBuffer(this.type, this.buffer);
        }
        ;
        static createVertexBuffer(gl, data = null, drawType = null) {
            return new IndexBuffer3D(gl, gl.ARRAY_BUFFER, data, drawType);
        }
        ;
        static createIndexBuffer(gl, data = null, drawType = null) {
            return new IndexBuffer3D(gl, gl.ELEMENT_ARRAY_BUFFER, data, drawType);
        }
        ;
        create(gl, type, data, drawType) {
            return new IndexBuffer3D(gl, type, data, drawType);
        }
        ;
        destroy() {
            this.gl.deleteBuffer(this.buffer);
        }
        ;
    }
    IndexBuffer3D.EMPTY_ARRAY_BUFFER = new ArrayBuffer(0);
    exports.IndexBuffer3D = IndexBuffer3D;
});
//# sourceMappingURL=IndexBuffer3D.js.map