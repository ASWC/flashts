define(["require", "exports", "flash/geom/Rectangle"], function (require, exports, Rectangle_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Bounds {
        constructor() {
            this.minX = Infinity;
            this.minY = Infinity;
            this.maxX = -Infinity;
            this.maxY = -Infinity;
            this.rect = null;
        }
        isEmpty() {
            return this.minX > this.maxX || this.minY > this.maxY;
        }
        clear() {
            this.updateID++;
            this.minX = Infinity;
            this.minY = Infinity;
            this.maxX = -Infinity;
            this.maxY = -Infinity;
        }
        getRectangle(rect) {
            if (this.minX > this.maxX || this.minY > this.maxY) {
                return Rectangle_1.Rectangle.EMPTY;
            }
            rect = rect || new Rectangle_1.Rectangle(0, 0, 1, 1);
            rect.x = this.minX;
            rect.y = this.minY;
            rect.width = this.maxX - this.minX;
            rect.height = this.maxY - this.minY;
            return rect;
        }
        addPoint(point) {
            this.minX = Math.min(this.minX, point.x);
            this.maxX = Math.max(this.maxX, point.x);
            this.minY = Math.min(this.minY, point.y);
            this.maxY = Math.max(this.maxY, point.y);
        }
        addQuad(vertices) {
            let minX = this.minX;
            let minY = this.minY;
            let maxX = this.maxX;
            let maxY = this.maxY;
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
            this.minX = minX;
            this.minY = minY;
            this.maxX = maxX;
            this.maxY = maxY;
        }
        addFrame(transform, x0, y0, x1, y1) {
            const matrix = transform.worldTransform;
            const a = matrix.a;
            const b = matrix.b;
            const c = matrix.c;
            const d = matrix.d;
            const tx = matrix.tx;
            const ty = matrix.ty;
            let minX = this.minX;
            let minY = this.minY;
            let maxX = this.maxX;
            let maxY = this.maxY;
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
            this.minX = minX;
            this.minY = minY;
            this.maxX = maxX;
            this.maxY = maxY;
        }
        addVertices(transform, vertices, beginOffset, endOffset) {
            const matrix = transform.worldTransform;
            const a = matrix.a;
            const b = matrix.b;
            const c = matrix.c;
            const d = matrix.d;
            const tx = matrix.tx;
            const ty = matrix.ty;
            let minX = this.minX;
            let minY = this.minY;
            let maxX = this.maxX;
            let maxY = this.maxY;
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
            this.minX = minX;
            this.minY = minY;
            this.maxX = maxX;
            this.maxY = maxY;
        }
        addBounds(bounds) {
            const minX = this.minX;
            const minY = this.minY;
            const maxX = this.maxX;
            const maxY = this.maxY;
            this.minX = bounds.minX < minX ? bounds.minX : minX;
            this.minY = bounds.minY < minY ? bounds.minY : minY;
            this.maxX = bounds.maxX > maxX ? bounds.maxX : maxX;
            this.maxY = bounds.maxY > maxY ? bounds.maxY : maxY;
        }
        addBoundsMask(bounds, mask) {
            const _minX = bounds.minX > mask.minX ? bounds.minX : mask.minX;
            const _minY = bounds.minY > mask.minY ? bounds.minY : mask.minY;
            const _maxX = bounds.maxX < mask.maxX ? bounds.maxX : mask.maxX;
            const _maxY = bounds.maxY < mask.maxY ? bounds.maxY : mask.maxY;
            if (_minX <= _maxX && _minY <= _maxY) {
                const minX = this.minX;
                const minY = this.minY;
                const maxX = this.maxX;
                const maxY = this.maxY;
                this.minX = _minX < minX ? _minX : minX;
                this.minY = _minY < minY ? _minY : minY;
                this.maxX = _maxX > maxX ? _maxX : maxX;
                this.maxY = _maxY > maxY ? _maxY : maxY;
            }
        }
        addBoundsArea(bounds, area) {
            const _minX = bounds.minX > area.x ? bounds.minX : area.x;
            const _minY = bounds.minY > area.y ? bounds.minY : area.y;
            const _maxX = bounds.maxX < area.x + area.width ? bounds.maxX : (area.x + area.width);
            const _maxY = bounds.maxY < area.y + area.height ? bounds.maxY : (area.y + area.height);
            if (_minX <= _maxX && _minY <= _maxY) {
                const minX = this.minX;
                const minY = this.minY;
                const maxX = this.maxX;
                const maxY = this.maxY;
                this.minX = _minX < minX ? _minX : minX;
                this.minY = _minY < minY ? _minY : minY;
                this.maxX = _maxX > maxX ? _maxX : maxX;
                this.maxY = _maxY > maxY ? _maxY : maxY;
            }
        }
    }
    exports.Bounds = Bounds;
});
//# sourceMappingURL=Bounds.js.map