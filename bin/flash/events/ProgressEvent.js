define(["require", "exports", "flash/events/Event"], function (require, exports, Event_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class ProgressEvent extends Event_1.Event {
        constructor(type, bubbles = false, cancelable = false, bytesLoaded = 0, bytesTotal = 0) {
            super(type, bubbles, cancelable);
            this._bytesLoaded = bytesLoaded;
            this._bytesTotal = bytesTotal;
        }
        get bytesLoaded() {
            return this._bytesLoaded;
        }
        set bytesLoaded(value) {
            this._bytesLoaded = value;
        }
        get bytesTotal() {
            return this._bytesTotal;
        }
        set bytesTotal(value) {
            this._bytesTotal = value;
        }
    }
    ProgressEvent.PROGRESS = "progress";
    ProgressEvent.SOCKET_DATA = "socketData";
    ProgressEvent.STANDARD_ERROR_DATA = "standardErrorData";
    ProgressEvent.STANDARD_INPUT_PROGRESS = "standardInputProgress";
    ProgressEvent.STANDARD_OUTPUT_DATA = "standardOutputData";
    exports.ProgressEvent = ProgressEvent;
});
//# sourceMappingURL=ProgressEvent.js.map