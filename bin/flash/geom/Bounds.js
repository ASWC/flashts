define(["require", "exports", "flash/geom/Rectangle"], function (require, exports, Rectangle_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Bounds {
        constructor() {
            this._minX = Infinity;
            this._minY = Infinity;
            this._maxX = -Infinity;
            this._maxY = -Infinity;
            this.rect = null;
            this._updateID = 0;
        }
        set updateID(value) {
            this._updateID = value;
        }
        get updateID() {
            return this._updateID;
        }
        set minY(value) {
            this._minY = value;
        }
        get minY() {
            return this._minY;
        }
        set maxX(value) {
            this._maxX = value;
        }
        get maxX() {
            return this._maxX;
        }
        set maxY(value) {
            this._maxY = value;
        }
        get maxY() {
            return this._maxY;
        }
        set minX(value) {
            this._minX = value;
        }
        get minX() {
            return this._minX;
        }
        isEmpty() {
            return this._minX > this._maxX || this._minY > this._maxY;
        }
        clear() {
            this._updateID++;
            this._minX = Infinity;
            this._minY = Infinity;
            this._maxX = -Infinity;
            this._maxY = -Infinity;
        }
        getRectangle(rect) {
            if (this._minX > this._maxX || this._minY > this._maxY) {
                return Rectangle_1.Rectangle.EMPTY;
            }
            rect = rect || new Rectangle_1.Rectangle(0, 0, 1, 1);
            rect.x = this._minX;
            rect.y = this._minY;
            rect.width = this._maxX - this._minX;
            rect.height = this._maxY - this._minY;
            return rect;
        }
        addPoint(point) {
            this._minX = Math.min(this._minX, point.x);
            this._maxX = Math.max(this._maxX, point.x);
            this._minY = Math.min(this._minY, point.y);
            this._maxY = Math.max(this._maxY, point.y);
        }
        addQuad(vertices) {
            let minX = this._minX;
            let minY = this._minY;
            let maxX = this._maxX;
            let maxY = this._maxY;
            let x = vertices[0];
            let y = vertices[1];
            minX = x < minX ? x : minX;
            minY = y < minY ? y : minY;
            maxX = x > maxX ? x : maxX;
            maxY = y > maxY ? y : maxY;
            x = vertices[2];
            y = vertices[3];
            minX = x < minX ? x : minX;
            minY = y < minY ? y : minY;
            maxX = x > maxX ? x : maxX;
            maxY = y > maxY ? y : maxY;
            x = vertices[4];
            y = vertices[5];
            minX = x < minX ? x : minX;
            minY = y < minY ? y : minY;
            maxX = x > maxX ? x : maxX;
            maxY = y > maxY ? y : maxY;
            x = vertices[6];
            y = vertices[7];
            minX = x < minX ? x : minX;
            minY = y < minY ? y : minY;
            maxX = x > maxX ? x : maxX;
            maxY = y > maxY ? y : maxY;
            this._minX = minX;
            this._minY = minY;
            this._maxX = maxX;
            this._maxY = maxY;
        }
        addFrame(transform, x0, y0, x1, y1) {
            const matrix = transform.worldTransform;
            const a = matrix.a;
            const b = matrix.b;
            const c = matrix.c;
            const d = matrix.d;
            const tx = matrix.tx;
            const ty = matrix.ty;
            let minX = this._minX;
            let minY = this._minY;
            let maxX = this._maxX;
            let maxY = this._maxY;
            let x = (a * x0) + (c * y0) + tx;
            let y = (b * x0) + (d * y0) + ty;
            minX = x < minX ? x : minX;
            minY = y < minY ? y : minY;
            maxX = x > maxX ? x : maxX;
            maxY = y > maxY ? y : maxY;
            x = (a * x1) + (c * y0) + tx;
            y = (b * x1) + (d * y0) + ty;
            minX = x < minX ? x : minX;
            minY = y < minY ? y : minY;
            maxX = x > maxX ? x : maxX;
            maxY = y > maxY ? y : maxY;
            x = (a * x0) + (c * y1) + tx;
            y = (b * x0) + (d * y1) + ty;
            minX = x < minX ? x : minX;
            minY = y < minY ? y : minY;
            maxX = x > maxX ? x : maxX;
            maxY = y > maxY ? y : maxY;
            x = (a * x1) + (c * y1) + tx;
            y = (b * x1) + (d * y1) + ty;
            minX = x < minX ? x : minX;
            minY = y < minY ? y : minY;
            maxX = x > maxX ? x : maxX;
            maxY = y > maxY ? y : maxY;
            this._minX = minX;
            this._minY = minY;
            this._maxX = maxX;
            this._maxY = maxY;
        }
        addVertices(transform, vertices, beginOffset, endOffset) {
            const matrix = transform.worldTransform;
            const a = matrix.a;
            const b = matrix.b;
            const c = matrix.c;
            const d = matrix.d;
            const tx = matrix.tx;
            const ty = matrix.ty;
            let minX = this._minX;
            let minY = this._minY;
            let maxX = this._maxX;
            let maxY = this._maxY;
            for (let i = beginOffset; i < endOffset; i += 2) {
                const rawX = vertices[i];
                const rawY = vertices[i + 1];
                const x = (a * rawX) + (c * rawY) + tx;
                const y = (d * rawY) + (b * rawX) + ty;
                minX = x < minX ? x : minX;
                minY = y < minY ? y : minY;
                maxX = x > maxX ? x : maxX;
                maxY = y > maxY ? y : maxY;
            }
            this._minX = minX;
            this._minY = minY;
            this._maxX = maxX;
            this._maxY = maxY;
        }
        addBounds(bounds) {
            const minX = this._minX;
            const minY = this._minY;
            const maxX = this._maxX;
            const maxY = this._maxY;
            this._minX = bounds._minX < minX ? bounds._minX : minX;
            this._minY = bounds._minY < minY ? bounds._minY : minY;
            this._maxX = bounds._maxX > maxX ? bounds._maxX : maxX;
            this._maxY = bounds._maxY > maxY ? bounds._maxY : maxY;
        }
        addBoundsMask(bounds, mask) {
            const _minX = bounds._minX > mask._minX ? bounds._minX : mask._minX;
            const _minY = bounds._minY > mask._minY ? bounds._minY : mask._minY;
            const _maxX = bounds._maxX < mask._maxX ? bounds._maxX : mask._maxX;
            const _maxY = bounds._maxY < mask._maxY ? bounds._maxY : mask._maxY;
            if (_minX <= _maxX && _minY <= _maxY) {
                const minX = this._minX;
                const minY = this._minY;
                const maxX = this._maxX;
                const maxY = this._maxY;
                this._minX = _minX < minX ? _minX : minX;
                this._minY = _minY < minY ? _minY : minY;
                this._maxX = _maxX > maxX ? _maxX : maxX;
                this._maxY = _maxY > maxY ? _maxY : maxY;
            }
        }
        addBoundsArea(bounds, area) {
            const _minX = bounds._minX > area.x ? bounds._minX : area.x;
            const _minY = bounds._minY > area.y ? bounds._minY : area.y;
            const _maxX = bounds._maxX < area.x + area.width ? bounds._maxX : (area.x + area.width);
            const _maxY = bounds._maxY < area.y + area.height ? bounds._maxY : (area.y + area.height);
            if (_minX <= _maxX && _minY <= _maxY) {
                const minX = this._minX;
                const minY = this._minY;
                const maxX = this._maxX;
                const maxY = this._maxY;
                this._minX = _minX < minX ? _minX : minX;
                this._minY = _minY < minY ? _minY : minY;
                this._maxX = _maxX > maxX ? _maxX : maxX;
                this._maxY = _maxY > maxY ? _maxY : maxY;
            }
        }
    }
    exports.Bounds = Bounds;
});
//# sourceMappingURL=Bounds.js.map