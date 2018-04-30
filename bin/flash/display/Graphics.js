define(["require", "exports", "flash/geom/Matrix", "flash/geom/Point", "flash/geom/Rectangle", "flash/rendering/managers/Constants", "flash/geom/Bounds", "flash/geom/shapes/Polygon", "flash/geom/shapes/RoundedRectangle", "flash/geom/shapes/Circle", "flash/geom/shapes/Ellipse", "flash/geom/shapes/GraphicsData", "flash/geom/shapes/ShapeUtils", "flash/display3D/renderers/GraphicsRenderer", "flash/display/DisplayObjectContainer"], function (require, exports, Matrix_1, Point_1, Rectangle_1, Constants_1, Bounds_1, Polygon_1, RoundedRectangle_1, Circle_1, Ellipse_1, GraphicsData_1, ShapeUtils_1, GraphicsRenderer_1, DisplayObjectContainer_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    // TYPED
    class Graphics extends DisplayObjectContainer_1.DisplayObjectContainer {
        constructor(nativeLines = false) {
            super();
            this.lineAlpha = 1;
            this.fillColor = 0;
            this.filling = false;
            this.fillAlpha = 1;
            this.lineWidth = 0;
            this.nativeLines = nativeLines;
            this.lineColor = 0;
            this._graphicsData = [];
            this._tint = 0xFFFFFF;
            this._prevTint = 0xFFFFFF;
            this._blendMode = Constants_1.Constants.BLEND_MODES.NORMAL;
            this.currentPath = null;
            this._webGL = {};
            this.isMask = false;
            this.boundsPadding = 0;
            this._localBounds = new Bounds_1.Bounds();
            this._dirty = 0;
            this._clearDirty = 0;
            this.boundsDirty = -1;
            this.cachedSpriteDirty = false;
            this._spriteRect = null;
        }
        clone() {
            const clone = new Graphics();
            clone.renderable = this.renderable;
            clone.fillAlpha = this.fillAlpha;
            clone.lineWidth = this.lineWidth;
            clone.lineColor = this.lineColor;
            clone._tint = this._tint;
            clone._blendMode = this._blendMode;
            clone.isMask = this.isMask;
            clone.boundsPadding = this.boundsPadding;
            clone._dirty = 0;
            clone.cachedSpriteDirty = this.cachedSpriteDirty;
            for (let i = 0; i < this._graphicsData.length; ++i) {
                clone._graphicsData.push(this._graphicsData[i].clone());
            }
            clone.currentPath = clone._graphicsData[clone._graphicsData.length - 1];
            clone.updateLocalBounds();
            return clone;
        }
        lineStyle(lineWidth = 0, color = 0, alpha = 1) {
            this.lineWidth = lineWidth;
            this.lineColor = color;
            this.lineAlpha = alpha;
            if (this.currentPath) {
                if (this.currentPath.shape.points.length) {
                    const shape = new Polygon_1.Polygon(this.currentPath.shape.points.slice(-2));
                    shape.closed = false;
                    this.drawShape(shape);
                }
                else {
                    this.currentPath.lineWidth = this.lineWidth;
                    this.currentPath.lineColor = this.lineColor;
                    this.currentPath.lineAlpha = this.lineAlpha;
                }
            }
            return this;
        }
        moveTo(x, y) {
            const shape = new Polygon_1.Polygon([x, y]);
            shape.closed = false;
            this.drawShape(shape);
            return this;
        }
        lineTo(x, y) {
            this.currentPath.shape.points.push(x, y);
            this._dirty++;
            return this;
        }
        quadraticCurveTo(cpX, cpY, toX, toY) {
            if (this.currentPath) {
                if (this.currentPath.shape.points.length === 0) {
                    this.currentPath.shape.points = [0, 0];
                }
            }
            else {
                this.moveTo(0, 0);
            }
            const n = 20;
            const points = this.currentPath.shape.points;
            let xa = 0;
            let ya = 0;
            if (points.length === 0) {
                this.moveTo(0, 0);
            }
            const fromX = points[points.length - 2];
            const fromY = points[points.length - 1];
            for (let i = 1; i <= n; ++i) {
                const j = i / n;
                xa = fromX + ((cpX - fromX) * j);
                ya = fromY + ((cpY - fromY) * j);
                points.push(xa + (((cpX + ((toX - cpX) * j)) - xa) * j), ya + (((cpY + ((toY - cpY) * j)) - ya) * j));
            }
            this._dirty++;
            return this;
        }
        bezierCurveTo(cpX, cpY, cpX2, cpY2, toX, toY) {
            if (this.currentPath) {
                if (this.currentPath.shape.points.length === 0) {
                    this.currentPath.shape.points = [0, 0];
                }
            }
            else {
                this.moveTo(0, 0);
            }
            const points = this.currentPath.shape.points;
            const fromX = points[points.length - 2];
            const fromY = points[points.length - 1];
            points.length -= 2;
            ShapeUtils_1.ShapeUtils.bezierCurveTo(fromX, fromY, cpX, cpY, cpX2, cpY2, toX, toY, points);
            this._dirty++;
            return this;
        }
        arcTo(x1, y1, x2, y2, radius) {
            if (this.currentPath) {
                if (this.currentPath.shape.points.length === 0) {
                    this.currentPath.shape.points.push(x1, y1);
                }
            }
            else {
                this.moveTo(x1, y1);
            }
            const points = this.currentPath.shape.points;
            const fromX = points[points.length - 2];
            const fromY = points[points.length - 1];
            const a1 = fromY - y1;
            const b1 = fromX - x1;
            const a2 = y2 - y1;
            const b2 = x2 - x1;
            const mm = Math.abs((a1 * b2) - (b1 * a2));
            if (mm < 1.0e-8 || radius === 0) {
                if (points[points.length - 2] !== x1 || points[points.length - 1] !== y1) {
                    points.push(x1, y1);
                }
            }
            else {
                const dd = (a1 * a1) + (b1 * b1);
                const cc = (a2 * a2) + (b2 * b2);
                const tt = (a1 * a2) + (b1 * b2);
                const k1 = radius * Math.sqrt(dd) / mm;
                const k2 = radius * Math.sqrt(cc) / mm;
                const j1 = k1 * tt / dd;
                const j2 = k2 * tt / cc;
                const cx = (k1 * b2) + (k2 * b1);
                const cy = (k1 * a2) + (k2 * a1);
                const px = b1 * (k2 + j1);
                const py = a1 * (k2 + j1);
                const qx = b2 * (k1 + j2);
                const qy = a2 * (k1 + j2);
                const startAngle = Math.atan2(py - cy, px - cx);
                const endAngle = Math.atan2(qy - cy, qx - cx);
                this.arc(cx + x1, cy + y1, radius, startAngle, endAngle, b1 * a2 > b2 * a1);
            }
            this._dirty++;
            return this;
        }
        arc(cx, cy, radius, startAngle, endAngle, anticlockwise = false) {
            if (startAngle === endAngle) {
                return this;
            }
            if (!anticlockwise && endAngle <= startAngle) {
                endAngle += Constants_1.Constants.PI_2;
            }
            else if (anticlockwise && startAngle <= endAngle) {
                startAngle += Constants_1.Constants.PI_2;
            }
            const sweep = endAngle - startAngle;
            const segs = Math.ceil(Math.abs(sweep) / Constants_1.Constants.PI_2) * 40;
            if (sweep === 0) {
                return this;
            }
            const startX = cx + (Math.cos(startAngle) * radius);
            const startY = cy + (Math.sin(startAngle) * radius);
            let points = this.currentPath ? this.currentPath.shape.points : null;
            if (points) {
                if (points[points.length - 2] !== startX || points[points.length - 1] !== startY) {
                    points.push(startX, startY);
                }
            }
            else {
                this.moveTo(startX, startY);
                points = this.currentPath.shape.points;
            }
            const theta = sweep / (segs * 2);
            const theta2 = theta * 2;
            const cTheta = Math.cos(theta);
            const sTheta = Math.sin(theta);
            const segMinus = segs - 1;
            const remainder = (segMinus % 1) / segMinus;
            for (let i = 0; i <= segMinus; ++i) {
                const real = i + (remainder * i);
                const angle = ((theta) + startAngle + (theta2 * real));
                const c = Math.cos(angle);
                const s = -Math.sin(angle);
                points.push((((cTheta * c) + (sTheta * s)) * radius) + cx, (((cTheta * -s) + (sTheta * c)) * radius) + cy);
            }
            this._dirty++;
            return this;
        }
        beginFill(color = 0, alpha = 1) {
            this.filling = true;
            this.fillColor = color;
            this.fillAlpha = alpha;
            if (this.currentPath) {
                if (this.currentPath.shape.points.length <= 2) {
                    this.currentPath.fill = this.filling;
                    this.currentPath.fillColor = this.fillColor;
                    this.currentPath.fillAlpha = this.fillAlpha;
                }
            }
            return this;
        }
        endFill() {
            this.filling = false;
            this.fillColor = null;
            this.fillAlpha = 1;
            return this;
        }
        drawRect(x, y, width, height) {
            this.drawShape(new Rectangle_1.Rectangle(x, y, width, height));
            return this;
        }
        drawRoundedRect(x, y, width, height, radius) {
            this.drawShape(new RoundedRectangle_1.RoundedRectangle(x, y, width, height, radius));
            return this;
        }
        drawCircle(x, y, radius) {
            this.drawShape(new Circle_1.Circle(x, y, radius));
            return this;
        }
        drawEllipse(x, y, width, height) {
            this.drawShape(new Ellipse_1.Ellipse(x, y, width, height));
            return this;
        }
        drawPolygon(path) {
            let points = path;
            let closed = true;
            if (points instanceof Polygon_1.Polygon) {
                closed = points.closed;
                points = points.points;
            }
            if (!Array.isArray(points)) {
                points = new Array(arguments.length);
                for (let i = 0; i < points.length; ++i) {
                    points[i] = arguments[i];
                }
            }
            const shape = new Polygon_1.Polygon(points);
            shape.closed = closed;
            this.drawShape(shape);
            return this;
        }
        drawStar(x, y, points, radius, innerRadius, rotation = 0) {
            innerRadius = innerRadius || radius / 2;
            const startAngle = (-1 * Math.PI / 2) + rotation;
            const len = points * 2;
            const delta = Constants_1.Constants.PI_2 / len;
            const polygon = [];
            for (let i = 0; i < len; i++) {
                const r = i % 2 ? innerRadius : radius;
                const angle = (i * delta) + startAngle;
                polygon.push(x + (r * Math.cos(angle)), y + (r * Math.sin(angle)));
            }
            return this.drawPolygon(polygon);
        }
        clear() {
            if (this.lineWidth || this.filling || this._graphicsData.length > 0) {
                this.lineWidth = 0;
                this.filling = false;
                this.boundsDirty = -1;
                this._dirty++;
                this._clearDirty++;
                this._graphicsData.length = 0;
            }
            this.currentPath = null;
            this._spriteRect = null;
            return this;
        }
        _renderWebGL() {
            if (!this.stage) {
                return;
            }
            if (this.transform.requireUpdate) {
                this.transform.updateWorldTransform(this.parent.transform);
                this.transform.update();
            }
            this.stage.setObjectRenderer(GraphicsRenderer_1.GraphicsRenderer.renderer);
            GraphicsRenderer_1.GraphicsRenderer.renderer.render(this);
        }
        _calculateBounds() {
            if (this.boundsDirty !== this._dirty) {
                this.boundsDirty = this._dirty;
                this.updateLocalBounds();
                this.cachedSpriteDirty = true;
            }
            const lb = this._localBounds;
            this._bounds.addFrame(this.transform, lb.minX, lb.minY, lb.maxX, lb.maxY);
        }
        containsPoint(point) {
            this.worldTransform.applyInverse(point, Graphics.tempPoint);
            const graphicsData = this._graphicsData;
            for (let i = 0; i < graphicsData.length; ++i) {
                const data = graphicsData[i];
                if (!data.fill) {
                    continue;
                }
                if (data.shape) {
                    if (data.shape.contains(Graphics.tempPoint.x, Graphics.tempPoint.y)) {
                        if (data.holes) {
                            for (let i = 0; i < data.holes.length; i++) {
                                const hole = data.holes[i];
                                if (hole.contains(Graphics.tempPoint.x, Graphics.tempPoint.y)) {
                                    return false;
                                }
                            }
                        }
                        return true;
                    }
                }
            }
            return false;
        }
        updateLocalBounds() {
            let minX = Infinity;
            let maxX = -Infinity;
            let minY = Infinity;
            let maxY = -Infinity;
            if (this._graphicsData.length) {
                let shape = null;
                let x = 0;
                let y = 0;
                let w = 0;
                let h = 0;
                for (let i = 0; i < this._graphicsData.length; i++) {
                    const data = this._graphicsData[i];
                    const type = data.type;
                    const lineWidth = data.lineWidth;
                    shape = data.shape;
                    if (type === Constants_1.Constants.SHAPES.RECT || type === Constants_1.Constants.SHAPES.RREC) {
                        x = shape.x - (lineWidth / 2);
                        y = shape.y - (lineWidth / 2);
                        w = shape.width + lineWidth;
                        h = shape.height + lineWidth;
                        minX = x < minX ? x : minX;
                        maxX = x + w > maxX ? x + w : maxX;
                        minY = y < minY ? y : minY;
                        maxY = y + h > maxY ? y + h : maxY;
                    }
                    else if (type === Constants_1.Constants.SHAPES.CIRC) {
                        x = shape.x;
                        y = shape.y;
                        w = shape.radius + (lineWidth / 2);
                        h = shape.radius + (lineWidth / 2);
                        minX = x - w < minX ? x - w : minX;
                        maxX = x + w > maxX ? x + w : maxX;
                        minY = y - h < minY ? y - h : minY;
                        maxY = y + h > maxY ? y + h : maxY;
                    }
                    else if (type === Constants_1.Constants.SHAPES.ELIP) {
                        x = shape.x;
                        y = shape.y;
                        w = shape.width + (lineWidth / 2);
                        h = shape.height + (lineWidth / 2);
                        minX = x - w < minX ? x - w : minX;
                        maxX = x + w > maxX ? x + w : maxX;
                        minY = y - h < minY ? y - h : minY;
                        maxY = y + h > maxY ? y + h : maxY;
                    }
                    else {
                        const points = shape.points;
                        let x2 = 0;
                        let y2 = 0;
                        let dx = 0;
                        let dy = 0;
                        let rw = 0;
                        let rh = 0;
                        let cx = 0;
                        let cy = 0;
                        for (let j = 0; j + 2 < points.length; j += 2) {
                            x = points[j];
                            y = points[j + 1];
                            x2 = points[j + 2];
                            y2 = points[j + 3];
                            dx = Math.abs(x2 - x);
                            dy = Math.abs(y2 - y);
                            h = lineWidth;
                            w = Math.sqrt((dx * dx) + (dy * dy));
                            if (w < 1e-9) {
                                continue;
                            }
                            rw = ((h / w * dy) + dx) / 2;
                            rh = ((h / w * dx) + dy) / 2;
                            cx = (x2 + x) / 2;
                            cy = (y2 + y) / 2;
                            minX = cx - rw < minX ? cx - rw : minX;
                            maxX = cx + rw > maxX ? cx + rw : maxX;
                            minY = cy - rh < minY ? cy - rh : minY;
                            maxY = cy + rh > maxY ? cy + rh : maxY;
                        }
                    }
                }
            }
            else {
                minX = 0;
                maxX = 0;
                minY = 0;
                maxY = 0;
            }
            const padding = this.boundsPadding;
            this._localBounds.minX = minX - padding;
            this._localBounds.maxX = maxX + padding;
            this._localBounds.minY = minY - padding;
            this._localBounds.maxY = maxY + padding;
        }
        drawShape(shape) {
            if (this.currentPath) {
                if (this.currentPath.shape.points.length <= 2) {
                    this._graphicsData.pop();
                }
            }
            this.currentPath = null;
            const data = new GraphicsData_1.GraphicsData(this.lineWidth, this.lineColor, this.lineAlpha, this.fillColor, this.fillAlpha, this.filling, this.nativeLines, shape);
            this._graphicsData.push(data);
            if (data.type === Constants_1.Constants.SHAPES.POLY) {
                data.shape.closed = data.shape.closed || this.filling;
                this.currentPath = data;
            }
            this._dirty++;
            return data;
        }
        closePath() {
            const currentPath = this.currentPath;
            if (currentPath && currentPath.shape) {
                currentPath.shape.close();
            }
            return this;
        }
        addHole() {
            const hole = this._graphicsData.pop();
            this.currentPath = this._graphicsData[this._graphicsData.length - 1];
            this.currentPath.addHole(hole.shape);
            this.currentPath = null;
            return this;
        }
        destroy() {
            super.destroy();
            for (let i = 0; i < this._graphicsData.length; ++i) {
                this._graphicsData[i].destroy();
            }
            for (const id in this._webgl) {
                for (let j = 0; j < this._webgl[id].data.length; ++j) {
                    this._webgl[id].data[j].destroy();
                }
            }
            if (this._spriteRect) {
                this._spriteRect.destroy();
            }
            this._graphicsData = null;
            this.currentPath = null;
            this._webgl = null;
            this._localBounds = null;
        }
        get graphicsData() {
            return this._graphicsData;
        }
        get clearDirty() {
            return this._clearDirty;
        }
        get dirty() {
            return this._dirty;
        }
        get tint() {
            return this._tint;
        }
        get blendMode() {
            return this._blendMode;
        }
        get webGL() {
            return this._webGL;
        }
    }
    Graphics.tempMatrix = new Matrix_1.Matrix();
    Graphics.tempPoint = new Point_1.Point();
    Graphics.tempColor1 = new Float32Array(4);
    Graphics.tempColor2 = new Float32Array(4);
    exports.Graphics = Graphics;
});
//# sourceMappingURL=Graphics.js.map