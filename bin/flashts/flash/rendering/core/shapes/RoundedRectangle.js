define(["require", "exports", "flash/rendering/managers/Constants", "flash/rendering/core/shapes/BaseShape"], function (require, exports, Constants_1, BaseShape_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class RoundedRectangle extends BaseShape_1.BaseShape {
        constructor(x = 0, y = 0, width = 0, height = 0, radius = 20) {
            super();
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
            this.radius = radius;
            this.type = Constants_1.Constants.SHAPES.RREC;
        }
        clone() {
            return new RoundedRectangle(this.x, this.y, this.width, this.height, this.radius);
        }
        contains(x, y) {
            if (this.width <= 0 || this.height <= 0) {
                return false;
            }
            if (x >= this.x && x <= this.x + this.width) {
                if (y >= this.y && y <= this.y + this.height) {
                    if ((y >= this.y + this.radius && y <= this.y + this.height - this.radius)
                        || (x >= this.x + this.radius && x <= this.x + this.width - this.radius)) {
                        return true;
                    }
                    let dx = x - (this.x + this.radius);
                    let dy = y - (this.y + this.radius);
                    const radius2 = this.radius * this.radius;
                    if ((dx * dx) + (dy * dy) <= radius2) {
                        return true;
                    }
                    dx = x - (this.x + this.width - this.radius);
                    if ((dx * dx) + (dy * dy) <= radius2) {
                        return true;
                    }
                    dy = y - (this.y + this.height - this.radius);
                    if ((dx * dx) + (dy * dy) <= radius2) {
                        return true;
                    }
                    dx = x - (this.x + this.radius);
                    if ((dx * dx) + (dy * dy) <= radius2) {
                        return true;
                    }
                }
            }
            return false;
        }
    }
    exports.RoundedRectangle = RoundedRectangle;
});
