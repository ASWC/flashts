define(["require", "exports", "flash/geom/TransformBase"], function (require, exports, TransformBase_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class TransformStatic extends TransformBase_1.TransformBase {
        constructor() {
            super();
            this._localID = 0;
            this._currentLocalID = 0;
        }
        updateSkew() {
            super.updateSkew();
            this._localID++;
        }
        updateLocalTransform() {
            const lt = this._localTransform;
            if (this._localID !== this._currentLocalID) {
                lt.a = this._cx * this._scale.x;
                lt.b = this._sx * this._scale.x;
                lt.c = this._cy * this._scale.y;
                lt.d = this._sy * this._scale.y;
                lt.tx = this._position.x - ((this._pivot.x * lt.a) + (this._pivot.y * lt.c));
                lt.ty = this._position.y - ((this._pivot.x * lt.b) + (this._pivot.y * lt.d));
                this._currentLocalID = this._localID;
                this._parentID = -1;
            }
        }
        updateTransform(parentTransform) {
            const lt = this._localTransform;
            if (this._localID !== this._currentLocalID) {
                lt.a = this._cx * this._scale.x;
                lt.b = this._sx * this._scale.x;
                lt.c = this._cy * this._scale.y;
                lt.d = this._sy * this._scale.y;
                lt.tx = this._position.x - ((this._pivot.x * lt.a) + (this._pivot.y * lt.c));
                lt.ty = this._position.y - ((this._pivot.x * lt.b) + (this._pivot.y * lt.d));
                this._currentLocalID = this._localID;
                this._parentID = -1;
            }
            if (this._parentID !== parentTransform.worldID) {
                const pt = parentTransform.worldTransform;
                const wt = this._worldTransform;
                wt.a = (lt.a * pt.a) + (lt.b * pt.c);
                wt.b = (lt.a * pt.b) + (lt.b * pt.d);
                wt.c = (lt.c * pt.a) + (lt.d * pt.c);
                wt.d = (lt.c * pt.b) + (lt.d * pt.d);
                wt.tx = (lt.tx * pt.a) + (lt.ty * pt.c) + pt.tx;
                wt.ty = (lt.tx * pt.b) + (lt.ty * pt.d) + pt.ty;
                this._parentID = parentTransform.worldID;
                this._worldID++;
            }
        }
        setFromMatrix(matrix) {
            matrix.decompose(this);
            this._localID++;
        }
    }
    exports.TransformStatic = TransformStatic;
});
//# sourceMappingURL=TransformStatic.js.map