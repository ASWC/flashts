define(["require", "exports", "flash/rendering/managers/Constants", "flash/geom/shapes/BaseShape"], function (require, exports, Constants_1, BaseShape_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Polygon extends BaseShape_1.BaseShape {
        constructor(points = null) {
            super();
            if (points) {
                this.points = points;
            }
            this.closed = true;
            this.type = Constants_1.Constants.SHAPES.POLY;
        }
        clone() {
            return new Polygon(this.points.slice());
        }
        close() {
            const points = this.points;
            if (points[0] !== points[points.length - 2] || points[1] !== points[points.length - 1]) {
                points.push(points[0], points[1]);
            }
        }
        contains(x, y) {
            let inside = false;
            const length = this.points.length / 2;
            for (let i = 0, j = length - 1; i < length; j = i++) {
                const xi = this.points[i * 2];
                const yi = this.points[(i * 2) + 1];
                const xj = this.points[j * 2];
                const yj = this.points[(j * 2) + 1];
                const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * ((y - yi) / (yj - yi))) + xi);
                if (intersect) {
                    inside = !inside;
                }
            }
            return inside;
        }
    }
    exports.Polygon = Polygon;
});
//# sourceMappingURL=Polygon.js.map