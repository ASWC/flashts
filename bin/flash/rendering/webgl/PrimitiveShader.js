define(["require", "exports", "flash/rendering/core/gl/GLShader", "../filters/Shaders"], function (require, exports, GLShader_1, Shaders_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class PrimitiveShader extends GLShader_1.GLShader {
        constructor(gl) {
            super(gl, Shaders_1.Shaders.VERTEX_PRIMITIVE, Shaders_1.Shaders.FRAGMENT_PRIMITIVE);
        }
    }
    exports.PrimitiveShader = PrimitiveShader;
});
//# sourceMappingURL=PrimitiveShader.js.map