define(["require", "exports", "flash/rendering/core/CoreDisplayObject", "flash/geom/Matrix"], function (require, exports, CoreDisplayObject_1, Matrix_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class DisplayObject extends CoreDisplayObject_1.CoreDisplayObject {
        constructor() {
            super();
            this._mask = null;
        }
        get worldVisible() {
            let item = this;
            do {
                if (item instanceof DisplayObject) {
                    if (!item._visible) {
                        return false;
                    }
                    item = item._parent;
                }
            } while (item);
            return true;
        }
        get mask() {
            return this._mask;
        }
        set mask(value) {
            if (this._mask) {
                this._mask.renderable = true;
                this._mask.isMask = false;
            }
            this._mask = value;
            if (this._mask) {
                this._mask.renderable = false;
                this._mask.isMask = true;
            }
        }
        toLocal(position, from, point, skipUpdate) {
            if (from) {
                position = from.toGlobal(position, point, skipUpdate);
            }
            if (!skipUpdate) {
                this._recursivePostUpdateTransform();
                if (!this._parent) {
                    //this._parent = Stage.emptyRoot;
                    this.updateTransform();
                    this._parent = null;
                }
                else {
                    this.updateTransform();
                }
            }
            return this.worldTransform.applyInverse(position, point);
        }
        setTransform(x = 0, y = 0, scaleX = 1, scaleY = 1, rotation = 0, skewX = 0, skewY = 0, pivotX = 0, pivotY = 0) {
            this.position.x = x;
            this.position.y = y;
            this.scale.x = !scaleX ? 1 : scaleX;
            this.scale.y = !scaleY ? 1 : scaleY;
            this.rotation = rotation;
            this.skew.x = skewX;
            this.skew.y = skewY;
            this.pivot.x = pivotX;
            this.pivot.y = pivotY;
            return this;
        }
        get z() {
            return 0;
        }
        set z(value) {
        }
        get root() {
            return null;
        }
    }
    DisplayObject._tempMatrix = new Matrix_1.Matrix();
    exports.DisplayObject = DisplayObject;
});
