define(["require", "exports", "flash/events/Event"], function (require, exports, Event_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class StageOrientationEvent extends Event_1.Event {
        constructor(type, bubbles = false, cancelable = false, beforeOrientation = null, afterOrientation = null) {
            super(type, bubbles, cancelable);
        }
        get afterOrientation() {
            return this._afterOrientation;
        }
        get beforeOrientation() {
            return this._beforeOrientation;
        }
    }
    StageOrientationEvent.ORIENTATION_CHANGE = "orientationChange";
    StageOrientationEvent.ORIENTATION_CHANGING = "orientationChanging";
    exports.StageOrientationEvent = StageOrientationEvent;
});
//# sourceMappingURL=StageOrientationEvent.js.map