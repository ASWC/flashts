define(["require", "exports", "flash/rendering/managers/Constants", "flash/geom/Rectangle", "flash/rendering/core/shapes/BaseShape"], function (require, exports, Constants_1, Rectangle_1, BaseShape_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Circle extends BaseShape_1.BaseShape {
        constructor(x = 0, y = 0, radius = 0) {
            super();
            this.x = x;
            this.y = y;
            this.radius = radius;
            this.type = Constants_1.Constants.SHAPES.CIRC;
        }
        clone() {
            return new Circle(this.x, this.y, this.radius);
        }
        contains(x, y) {
            if (this.radius <= 0) {
                return false;
            }
            const r2 = this.radius * this.radius;
            let dx = (this.x - x);
            let dy = (this.y - y);
            dx *= dx;
            dy *= dy;
            return (dx + dy <= r2);
        }
        getBounds() {
            return new Rectangle_1.Rectangle(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
        }
    }
    exports.Circle = Circle;
});
