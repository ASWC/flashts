define(["require", "exports", "flash/events/Event"], function (require, exports, Event_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class HTTPStatusEvent extends Event_1.Event {
        constructor(type, bubbles = false, cancelable = false, status = 0, redirected = false) {
            super(type, bubbles, cancelable);
            this._redirected = false;
            this._responseHeaders = [];
            this._responseURL = '';
        }
        get redirected() {
            return this._redirected;
        }
        set redirected(value) {
            this._redirected = value;
        }
        get responseHeaders() {
            return this._responseHeaders;
        }
        set responseHeaders(value) {
            this._responseHeaders = value;
        }
        get responseURL() {
            return this._responseURL;
        }
        set responseURL(value) {
            this._responseURL = value;
        }
    }
    HTTPStatusEvent.HTTP_RESPONSE_STATUS = "httpResponseStatus";
    HTTPStatusEvent.HTTP_STATUS = "httpStatus";
    exports.HTTPStatusEvent = HTTPStatusEvent;
});
