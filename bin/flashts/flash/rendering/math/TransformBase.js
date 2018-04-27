define(["require", "exports", "flash/geom/Matrix", "flash/geom/Point", "flash/display/BaseObject", "../managers/Constants"], function (require, exports, Matrix_1, Point_1, BaseObject_1, Constants_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class TransformBase extends BaseObject_1.BaseObject {
        constructor() {
            super();
            this._position = new Point_1.Point(0, 0);
            this._scale = new Point_1.Point(1, 1);
            this._pivot = new Point_1.Point(0, 0);
            this._skew = new Point_1.Point(0, 0);
            this._worldTransform = new Matrix_1.Matrix();
            this._localTransform = new Matrix_1.Matrix();
            this._worldID = 0;
            this._parentID = 0;
            this._cx = 1;
            this._sx = 0;
            this._cy = 0;
            this._sy = 1;
            this._rotation = 0;
        }
        update() {
            this._requireUpdate = false;
            this._scale.update();
            this._pivot.update();
            this._skew.update();
            this._localTransform.update();
            this._position.update();
            this._worldTransform.update();
        }
        forceUpdate() {
            this._requireUpdate = true;
        }
        get requireUpdate() {
            if (this._requireUpdate) {
                return true;
            }
            if (this._scale.requireUpdate) {
                return true;
            }
            if (this._pivot.requireUpdate) {
                return true;
            }
            if (this._skew.requireUpdate) {
                return true;
            }
            if (this._localTransform.requireUpdate) {
                return true;
            }
            if (this._position.requireUpdate) {
                return true;
            }
            if (this._worldTransform.requireUpdate) {
                return true;
            }
            return false;
        }
        updateSkew() {
            this._cx = Math.cos(this._rotation + this._skew.y);
            this._sx = Math.sin(this._rotation + this._skew.y);
            this._cy = -Math.sin(this._rotation - this._skew.x);
            this._sy = Math.cos(this._rotation - this._skew.x);
            this._requireUpdate = true;
        }
        get rotation() {
            return this._rotation * Constants_1.Constants.RAD_TO_DEG;
        }
        set rotation(value) {
            this._rotation = value * Constants_1.Constants.DEG_TO_RAD;
            this.updateSkew();
        }
        get worldTransform() {
            return this._worldTransform;
        }
        set worldTransform(value) {
            this._worldTransform = value;
            this._requireUpdate = true;
        }
        get localTransform() {
            return this._localTransform;
        }
        set localTransform(value) {
            this._localTransform = value;
            this._requireUpdate = true;
        }
        get position() {
            return this._position;
        }
        set position(value) {
            this._position = value;
            this._requireUpdate = true;
        }
        get pivot() {
            return this._pivot;
        }
        set pivot(value) {
            this._pivot = value;
            this._requireUpdate = true;
        }
        get skew() {
            return this._skew;
        }
        set skew(value) {
            this._skew = value;
            this._requireUpdate = true;
        }
        get scale() {
            return this._scale;
        }
        set scale(value) {
            this._scale = value;
            this._requireUpdate = true;
        }
        updateLocalTransform() {
        }
        updateWorldTransform(parentTransform) {
            this.updateTransform(parentTransform);
        }
        updateTransform(parentTransform) {
            const pt = parentTransform._worldTransform;
            const wt = this._worldTransform;
            const lt = this._localTransform;
            wt.a = (lt.a * pt.a) + (lt.b * pt.c);
            wt.b = (lt.a * pt.b) + (lt.b * pt.d);
            wt.c = (lt.c * pt.a) + (lt.d * pt.c);
            wt.d = (lt.c * pt.b) + (lt.d * pt.d);
            wt.tx = (lt.tx * pt.a) + (lt.ty * pt.c) + pt.tx;
            wt.ty = (lt.tx * pt.b) + (lt.ty * pt.d) + pt.ty;
            this._worldID++;
        }
    }
    TransformBase.IDENTITY = new TransformBase();
    exports.TransformBase = TransformBase;
});
