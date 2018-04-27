define(["require", "exports", "flash/events/Event"], function (require, exports, Event_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class SecurityErrorEvent extends Event_1.Event {
        constructor(type, bubbles = false, cancelable = false, text = "", id = 0) {
            super(type, bubbles, cancelable);
            this._text = text;
            this._id = id;
        }
    }
    SecurityErrorEvent.SECURITY_ERROR = "securityError";
    exports.SecurityErrorEvent = SecurityErrorEvent;
});
