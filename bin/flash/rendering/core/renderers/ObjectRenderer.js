define(["require", "exports", "flash/rendering/core/BaseObject"], function (require, exports, BaseObject_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class ObjectRenderer extends BaseObject_1.BaseObject {
        static get renderer() {
            return null;
        }
        onContextChange(event) {
        }
        destroy() {
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
//# sourceMappingURL=ObjectRenderer.js.map