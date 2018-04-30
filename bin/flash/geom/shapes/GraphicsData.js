define(["require", "exports", "flash/display/BaseObject"], function (require, exports, BaseObject_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class GraphicsData extends BaseObject_1.BaseObject {
        constructor(lineWidth, lineColor, lineAlpha, fillColor, fillAlpha, fill, nativeLines, shape) {
            super();
            this._points = [];
            this._lineWidth = lineWidth;
            this._nativeLines = nativeLines;
            this._lineColor = lineColor;
            this._lineAlpha = lineAlpha;
            this._lineTint = lineColor;
            this._fillColor = fillColor;
            this._fillAlpha = fillAlpha;
            this._fillTint = fillColor;
            this._fill = fill;
            this._shape = shape;
            this._type = shape.type;
            this._holes = [];
        }
        get type() {
            return this._type;
        }
        get shape() {
            return this._shape;
        }
        set shape(value) {
            this._shape = value;
        }
        get fill() {
            return this._fill;
        }
        set fill(value) {
            this._fill = value;
        }
        get holes() {
            return this._holes;
        }
        set holes(value) {
            this._holes = value;
        }
        get fillColor() {
            return this._fillColor;
        }
        set fillColor(value) {
            this._fillColor = value;
        }
        get fillAlpha() {
            return this._fillAlpha;
        }
        set fillAlpha(value) {
            this._fillAlpha = value;
        }
        get nativeLines() {
            return this._nativeLines;
        }
        get lineWidth() {
            return this._lineWidth;
        }
        set lineWidth(value) {
            this._lineWidth = value;
        }
        get points() {
            return this._points;
        }
        set points(value) {
            this._points = value;
        }
        get lineColor() {
            return this._lineColor;
        }
        set lineColor(value) {
            this._lineColor = value;
        }
        get lineAlpha() {
            return this._lineAlpha;
        }
        set lineAlpha(value) {
            this._lineAlpha = value;
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