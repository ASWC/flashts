define(["require", "exports", "flash/events/Event"], function (require, exports, Event_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class IOErrorEvent extends Event_1.Event {
        constructor(type, bubbles = false, cancelable = false, text = "", id = 0) {
            super(type, bubbles, cancelable);
        }
    }
    IOErrorEvent.IO_ERROR = "ioError";
    IOErrorEvent.STANDARD_ERROR_IO_ERROR = "standardErrorIoError";
    IOErrorEvent.STANDARD_INPUT_IO_ERROR = "standardInputIoError";
    IOErrorEvent.STANDARD_OUTPUT_IO_ERROR = "standardOutputIoError";
    exports.IOErrorEvent = IOErrorEvent;
});
//# sourceMappingURL=IOErrorEvent.js.map