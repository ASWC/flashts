define(["require", "exports", "flash/display/BaseObject"], function (require, exports, BaseObject_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class GraphicsData extends BaseObject_1.BaseObject {
        constructor(lineWidth, lineColor, lineAlpha, fillColor, fillAlpha, fill, nativeLines, shape) {
            super();
            this.points = [];
            this.lineWidth = lineWidth;
            this.nativeLines = nativeLines;
            this.lineColor = lineColor;
            this.lineAlpha = lineAlpha;
            this._lineTint = lineColor;
            this.fillColor = fillColor;
            this.fillAlpha = fillAlpha;
            this._fillTint = fillColor;
            this.fill = fill;
            this.shape = shape;
            this.type = shape.type;
            this.holes = [];
        }
        clone() {
            return new GraphicsData(this.lineWidth, this.lineColor, this.lineAlpha, this.fillColor, this.fillAlpha, this.fill, this.nativeLines, this.shape);
        }
        addHole(shape) {
            this.holes.push(shape);
        }
        destroy() {
            this.shape = null;
            this.holes = null;
        }
    }
    exports.GraphicsData = GraphicsData;
});
//# sourceMappingURL=GraphicsData.js.map