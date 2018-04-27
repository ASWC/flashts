define(["require", "exports", "flash/utils/TickerListener", "flash/rendering/managers/Constants", "flash/display/StageSettings"], function (require, exports, TickerListener_1, Constants_1, StageSettings_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Ticker {
        constructor() {
            this._head = new TickerListener_1.TickerListener(null, null, Infinity);
            this._requestId = null;
            this._maxElapsedMS = 100;
            this.autoStart = false;
            this.deltaTime = 1;
            this.elapsedMS = 1 / StageSettings_1.StageSettings.FPMS;
            this.lastTime = -1;
            this.speed = 1;
            this.started = false;
            this._tick = (time) => {
                this._requestId = null;
                if (this.started) {
                    this.update(time);
                    if (this.started && this._requestId === null && this._head.next) {
                        this._requestId = requestAnimationFrame(this._tick);
                    }
                }
            };
        }
        _requestIfNeeded() {
            if (this._requestId === null && this._head.next) {
                this.lastTime = performance.now();
                this._requestId = requestAnimationFrame(this._tick);
            }
        }
        _cancelIfNeeded() {
            if (this._requestId !== null) {
                cancelAnimationFrame(this._requestId);
                this._requestId = null;
            }
        }
        _startIfPossible() {
            if (this.started) {
                this._requestIfNeeded();
            }
            else if (this.autoStart) {
                this.start();
            }
        }
        add(fn, context, priority = Constants_1.Constants.UPDATE_PRIORITY.NORMAL) {
            this._addListener(new TickerListener_1.TickerListener(fn, context, priority));
        }
        addOnce(fn, context, priority = Constants_1.Constants.UPDATE_PRIORITY.NORMAL) {
            return this._addListener(new TickerListener_1.TickerListener(fn, context, priority, true));
        }
        _addListener(listener) {
            let current = this._head.next;
            let previous = this._head;
            if (!current) {
                listener.connect(previous);
            }
            else {
                while (current) {
                    if (listener.priority > current.priority) {
                        listener.connect(previous);
                        break;
                    }
                    previous = current;
                    current = current.next;
                }
                if (!listener.previous) {
                    listener.connect(previous);
                }
            }
            this._startIfPossible();
            return this;
        }
        remove(fn, context) {
            let listener = this._head.next;
            while (listener) {
                if (listener.match(fn, context)) {
                    listener = listener.destroy();
                }
                else {
                    listener = listener.next;
                }
            }
            if (!this._head.next) {
                this._cancelIfNeeded();
            }
            return this;
        }
        start() {
            if (!this.started) {
                this.started = true;
                this._requestIfNeeded();
            }
        }
        stop() {
            if (this.started) {
                this.started = false;
                this._cancelIfNeeded();
            }
        }
        destroy() {
            this.stop();
            let listener = this._head.next;
            while (listener) {
                listener = listener.destroy(true);
            }
            this._head.destroy();
            this._head = null;
        }
        update(currentTime = performance.now()) {
            let elapsedMS;
            if (currentTime > this.lastTime) {
                elapsedMS = this.elapsedMS = currentTime - this.lastTime;
                if (elapsedMS > this._maxElapsedMS) {
                    elapsedMS = this._maxElapsedMS;
                }
                this.deltaTime = elapsedMS * StageSettings_1.StageSettings.FPMS * this.speed;
                const head = this._head;
                let listener = head.next;
                while (listener) {
                    listener = listener.emit(this.deltaTime);
                }
                if (!head.next) {
                    this._cancelIfNeeded();
                }
            }
            else {
                this.deltaTime = this.elapsedMS = 0;
            }
            this.lastTime = currentTime;
        }
        get FPS() {
            return 1000 / this.elapsedMS;
        }
        get minFPS() {
            return 1000 / this._maxElapsedMS;
        }
        set minFPS(fps) {
            const minFPMS = Math.min(Math.max(0, fps) / 1000, StageSettings_1.StageSettings.FPMS);
            this._maxElapsedMS = 1 / minFPMS;
        }
    }
    exports.Ticker = Ticker;
});
//# sourceMappingURL=Ticker.js.map