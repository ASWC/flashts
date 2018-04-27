define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Point {
        constructor(x = 0, y = 0) {
            this._x = x; // + 0.00000001;
            this._y = y; // + 0.00000001;  
        }
        update() {
            this._requireUpdate = false;
        }
        get requireUpdate() {
            return this._requireUpdate;
        }
        set x(value) {
            this._x = value;
            this._requireUpdate = true;
        }
        get x() {
            return this._x;
        }
        set y(value) {
            this._y = value;
            this._requireUpdate = true;
        }
        get y() {
            return this._y;
        }
        clone() {
            return new Point(this._x, this._y);
        }
        copy(value) {
            this.set(value._x, value._y);
            this._requireUpdate = true;
        }
        equals(value) {
            return (value._x === this._x) && (value._y === this._y);
        }
        set(x = 0, y = 0) {
            this._x = x || 0;
            this._y = y || ((y !== 0) ? this._x : 0);
            this._requireUpdate = true;
        }
    }
    exports.Point = Point;
});
//# sourceMappingURL=Point.js.map