define(["require", "exports", "flash/rendering/managers/Constants", "flash/geom/Rectangle", "flash/rendering/core/shapes/BaseShape"], function (require, exports, Constants_1, Rectangle_1, BaseShape_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Ellipse extends BaseShape_1.BaseShape {
        constructor(x = 0, y = 0, width = 0, height = 0) {
            super();
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
            this.type = Constants_1.Constants.SHAPES.ELIP;
        }
        clone() {
            return new Ellipse(this.x, this.y, this.width, this.height);
        }
        contains(x, y) {
            if (this.width <= 0 || this.height <= 0) {
                return false;
            }
            let normx = ((x - this.x) / this.width);
            let normy = ((y - this.y) / this.height);
            normx *= normx;
            normy *= normy;
            return (normx + normy <= 1);
        }
        getBounds() {
            return new Rectangle_1.Rectangle(this.x - this.width, this.y - this.height, this.width, this.height);
        }
    }
    exports.Ellipse = Ellipse;
});
//# sourceMappingURL=Ellipse.js.map