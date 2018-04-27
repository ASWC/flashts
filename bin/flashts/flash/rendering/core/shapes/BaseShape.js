define(["require", "exports", "flash/rendering/core/BaseObject"], function (require, exports, BaseObject_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class BaseShape extends BaseObject_1.BaseObject {
        constructor() {
            super();
            this.closed = false;
            this._x = 0;
            this._y = 0;
            this._width = 0;
            this._height = 0;
            this._radius = 0;
        }
        set radius(value) {
            this._radius = value;
        }
        get radius() {
            return this._radius;
        }
        set y(value) {
            this._y = value;
        }
        get y() {
            return this._y;
        }
        set width(value) {
            this._width = value;
        }
        get width() {
            return this._width;
        }
        set height(value) {
            this._height = value;
        }
        get height() {
            return this._height;
        }
        set x(value) {
            this._x = value;
        }
        get x() {
            return this._x;
        }
        contains(x, y) {
            return false;
        }
        close() {
        }
    }
    exports.BaseShape = BaseShape;
});
//# sourceMappingURL=BaseShape.js.map