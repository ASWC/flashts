define(["require", "exports", "flash/display/DisplayObjectContainer", "flash/display/Graphics", "flash/events/Event"], function (require, exports, DisplayObjectContainer_1, Graphics_1, Event_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    // typed
    class Sprite extends DisplayObjectContainer_1.DisplayObjectContainer {
        constructor() {
            super();
            this._buttonMode = false;
            this._useHandCursor = false;
            this._dropTarget = null;
            this._graphics = null;
            this._hitArea = null;
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
            if (!this.visible || this.worldAlpha <= 0 || !this.renderable) {
                return;
            }
            if (this.transform.requireUpdate || this.parent.transform.requireUpdate) {
                this.transform.updateWorldTransform(this.parent.transform);
            }
            if (this._graphics) {
                if (this._graphics.parent != this._parent) {
                    this._graphics.parent = this._parent;
                }
                this._graphics.transform = this.transform;
                this._graphics._renderWebGL();
            }
            if (this._mask || this._filters) {
                this.renderAdvancedWebGL();
            }
            else {
                this._renderWebGL();
                for (let i = 0, j = this.children.length; i < j; ++i) {
                    this.children[i].transform.forceUpdate();
                    this.children[i].renderWebGL();
                }
            }
            this.transform.update();
            if (this.hasEventListener(Event_1.Event.EXIT_FRAME)) {
                if (!this._exitFrameEvent) {
                    this._exitFrameEvent = new Event_1.Event(Event_1.Event.EXIT_FRAME);
                }
                this.dispatchEvent(this._exitFrameEvent);
            }
        }
        get buttonMode() {
            return this._buttonMode;
        }
        set buttonMode(value) {
            this._buttonMode = value;
            // to implement
        }
        get dropTarget() {
            return this._dropTarget;
        }
        get graphics() {
            if (!this._graphics) {
                this._graphics = new Graphics_1.Graphics();
            }
            return this._graphics;
        }
        get hitArea() {
            return this._hitArea;
        }
        set hitArea(value) {
            this._hitArea = value;
            // to implement
        }
        get useHandCursor() {
            return this._useHandCursor;
        }
        set useHandCursor(value) {
            this._useHandCursor = value;
            // to implement
        }
        startDrag(lockCenter = false, bounds = null) {
            // to implement
        }
        startTouchDrag(touchPointID, lockCenter = false, bounds = null) {
            // to implement
        }
        stopDrag() {
            // to implement
        }
        stopTouchDrag(touchPointID) {
            // to implement
        }
    }
    exports.Sprite = Sprite;
});
