define(["require", "exports", "./WebGLManager"], function (require, exports, WebGLManager_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class ObjectRenderer extends WebGLManager_1.WebGLManager {
        static get renderer() {
            return null;
        }
        setContext(context) {
            this._context = context;
        }
        start() {
        }
        stop() {
            this.flush();
        }
        flush() {
        }
        render(object) {
        }
    }
    exports.ObjectRenderer = ObjectRenderer;
});
