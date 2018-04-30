define(["require", "exports", "flash/display3D/IndexBuffer3D", "flash/display3D/VertexBuffer3D", "flash/display/BaseObject"], function (require, exports, IndexBuffer3D_1, VertexBuffer3D_1, BaseObject_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class WebGLGraphicsData extends BaseObject_1.BaseObject {
        constructor(gl, shader, attribsState) {
            super();
            this.gl = gl;
            this.color = [0, 0, 0];
            this.points = [];
            this.indices = [];
            this.buffer = IndexBuffer3D_1.IndexBuffer3D.createVertexBuffer(gl);
            this.indexBuffer = IndexBuffer3D_1.IndexBuffer3D.createIndexBuffer(gl);
            this.dirty = true;
            this.nativeLines = false;
            this.glPoints = null;
            this.glIndices = null;
            this.shader = shader;
            this.vao = new VertexBuffer3D_1.VertexBuffer3D(gl, attribsState)
                .addIndex(this.indexBuffer)
                .addAttribute(this.buffer, shader.attributes.aVertexPosition, gl.FLOAT, false, 4 * 6, 0)
                .addAttribute(this.buffer, shader.attributes.aColor, gl.FLOAT, false, 4 * 6, 2 * 4);
        }
        reset() {
            this.points.length = 0;
            this.indices.length = 0;
        }
        upload() {
            this.glPoints = new Float32Array(this.points);
            this.buffer.upload(this.glPoints);
            this.glIndices = new Uint16Array(this.indices);
            this.indexBuffer.upload(this.glIndices);
            this.dirty = false;
        }
        destroy() {
            this.color = null;
            this.points = null;
            this.indices = null;
            this.vao.destroy();
            this.buffer.destroy();
            this.indexBuffer.destroy();
            this.gl = null;
            this.buffer = null;
            this.indexBuffer = null;
            this.glPoints = null;
            this.glIndices = null;
        }
    }
    exports.WebGLGraphicsData = WebGLGraphicsData;
});
//# sourceMappingURL=WebGLGraphicsData.js.map