define(["require", "exports", "../webgl/Utils", "../webgl/WebGLRenderer"], function (require, exports, Utils_1, WebGLRenderer_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class AutoDetectRenderer {
        static autoDetectRenderer(options) {
            if (!Utils_1.Utils.isWebGLSupported()) {
                return;
            }
            return new WebGLRenderer_1.WebGLRenderer(options);
        }
    }
    exports.AutoDetectRenderer = AutoDetectRenderer;
});
