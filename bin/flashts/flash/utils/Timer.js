define(["require", "exports", "../events/EventDispatcher", "flash/utils/Ticker"], function (require, exports, EventDispatcher_1, Ticker_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Timer extends EventDispatcher_1.EventDispatcher {
        constructor(delay, repeatCount = 0) {
            super();
            this._repeatCount = repeatCount;
            this._delay = delay;
            this._currentCount = 0;
        }
        reset() {
            this._currentCount = 0;
        }
        start() {
        }
        stop() {
        }
        get currentCount() {
            return this._currentCount;
        }
        get delay() {
            return this._delay;
        }
        set delay(value) {
            this._delay = value;
        }
        get repeatCount() {
            return this._repeatCount;
        }
        set repeatCount(value) {
            this._repeatCount = value;
        }
        static get shared() {
            if (!Timer._sharedTicker) {
                Timer._sharedTicker = new Ticker_1.Ticker();
            }
            return Timer._sharedTicker;
        }
    }
    exports.Timer = Timer;
});
