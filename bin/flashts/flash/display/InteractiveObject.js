define(["require", "exports", "flash/display/DisplayObject"], function (require, exports, DisplayObject_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    // TYPED
    class InteractiveObject extends DisplayObject_1.DisplayObject {
        constructor() {
            super();
            this._mouseEnabled = true;
        }
        get mouseEnabled() {
            return this._mouseEnabled;
        }
        set mouseEnabled(value) {
            this._mouseEnabled = value;
        }
    }
    exports.InteractiveObject = InteractiveObject;
});
//# sourceMappingURL=InteractiveObject.js.map