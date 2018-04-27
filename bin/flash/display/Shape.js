define(["require", "exports", "flash/display/DisplayObject", "flash/display/Graphics", "flash/events/Event"], function (require, exports, DisplayObject_1, Graphics_1, Event_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    // TYPED
    class Shape extends DisplayObject_1.DisplayObject {
        constructor() {
            super();
            this._graphics = null;
        }
        renderWebGL() {
            if (this.hasEventListener(Event_1.Event.ENTER_FRAME)) {
                if (!this._enterFrameEvent) {
                    this._enterFrameEvent = new Event_1.Event(Event_1.Event.ENTER_FRAME);
                }
                this.dispatchEvent(this._enterFrameEvent);
            }
            if (!this._parent) {
                return;
            }
            if (this.transform.requireUpdate || this._parent.transform.requireUpdate) {
                this.transform.updateWorldTransform(this._parent.transform);
                this.transform.update();
            }
            if (this._graphics) {
                if (this._graphics.parent != this._parent) {
                    this._graphics.parent = this._parent;
                }
                this._graphics.transform = this.transform;
                this._graphics._renderWebGL();
            }
            if (this.hasEventListener(Event_1.Event.EXIT_FRAME)) {
                if (!this._exitFrameEvent) {
                    this._exitFrameEvent = new Event_1.Event(Event_1.Event.EXIT_FRAME);
                }
                this.dispatchEvent(this._exitFrameEvent);
            }
        }
        set parent(value) {
            this._parent = value;
            if (this._graphics) {
                this._graphics.parent = value;
            }
        }
        get graphics() {
            if (!this._graphics) {
                this._graphics = new Graphics_1.Graphics();
            }
            return this._graphics;
        }
    }
    exports.Shape = Shape;
});
//# sourceMappingURL=Shape.js.map