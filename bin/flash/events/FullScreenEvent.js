define(["require", "exports", "flash/events/Event"], function (require, exports, Event_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class FullScreenEvent extends Event_1.Event {
        constructor(type, bubbles = false, cancelable = false) {
            super(type, bubbles, cancelable);
            this._fullScreen = false;
        }
        get fullScreen() {
            return this._fullScreen;
        }
    }
    FullScreenEvent.FULL_SCREEN = "fullScreen";
    exports.FullScreenEvent = FullScreenEvent;
});
//# sourceMappingURL=FullScreenEvent.js.map