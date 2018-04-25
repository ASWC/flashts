define(["require", "exports", "flash/rendering/managers/Constants", "flash/geom/Rectangle", "flash/rendering/core/shapes/BaseShape"], function (require, exports, Constants_1, Rectangle_1, BaseShape_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Circle extends BaseShape_1.BaseShape {
        /**
        * @param {number} [x=0] - The X coordinate of the center of this circle
        * @param {number} [y=0] - The Y coordinate of the center of this circle
        * @param {number} [radius=0] - The radius of the circle
        */
        constructor(x = 0, y = 0, radius = 0) {
            super();
            /**
             * @member {number}
             * @default 0
             */
            this.x = x;
            /**
             * @member {number}
             * @default 0
             */
            this.y = y;
            /**
             * @member {number}
             * @default 0
             */
            this.radius = radius;
            /**
             * The type of the object, mainly used to avoid `instanceof` checks
             *
             * @member {number}
             * @readOnly
             * @default PIXI.SHAPES.CIRC
             * @see PIXI.SHAPES
             */
            this.type = Constants_1.Constants.SHAPES.CIRC;
        }
        /**
         * Creates a clone of this Circle instance
         *
         * @return {PIXI.Circle} a copy of the Circle
         */
        clone() {
            return new Circle(this.x, this.y, this.radius);
        }
        /**
         * Checks whether the x and y coordinates given are contained within this circle
         *
         * @param {number} x - The X coordinate of the point to test
         * @param {number} y - The Y coordinate of the point to test
         * @return {boolean} Whether the x/y coordinates are within this Circle
         */
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
        /**
        * Returns the framing rectangle of the circle as a Rectangle object
        *
        * @return {PIXI.Rectangle} the framing rectangle
        */
        getBounds() {
            return new Rectangle_1.Rectangle(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
        }
    }
    exports.Circle = Circle;
});
