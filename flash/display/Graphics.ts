
import { Matrix } from "flash/geom/Matrix";
import { Point } from "flash/geom/Point";
import { Rectangle } from "flash/geom/Rectangle";
import { Constants } from "flash/rendering/managers/Constants";
import { Bounds } from "flash/rendering/math/Bounds";
import { Polygon } from "flash/rendering/core/shapes/Polygon";
import { RoundedRectangle } from "flash/rendering/core/shapes/RoundedRectangle";
import { Circle } from "flash/rendering/core/shapes/Circle";
import { Ellipse } from "flash/rendering/core/shapes/Ellipse";
import { Bitmap } from "flash/display/Bitmap";
import { Texture } from "flash/rendering/textures/Texture";
import { Utils } from "flash/rendering/webgl/Utils";
import { GraphicsData } from "flash/rendering/core/shapes/GraphicsData";
import { RenderTexture } from "flash/rendering/textures/RenderTexture";
import { ShapeUtils } from "flash/rendering/core/shapes/ShapeUtils";
import { GraphicsRenderer } from "flash/rendering/core/renderers/GraphicsRenderer";
import { DisplayObject } from "flash/display/DisplayObject";
import { BaseObject } from "flash/rendering/core/BaseObject";
import { DisplayObjectContainer } from "flash/display/DisplayObjectContainer";

export class Graphics extends DisplayObjectContainer
{
    public static _SPRITE_TEXTURE = null;
    public static canvasRenderer;
    public static tempMatrix:Matrix = new Matrix();
    public static tempPoint:Point = new Point();
    public static tempColor1:Float32Array = new Float32Array(4);
    public static tempColor2:Float32Array = new Float32Array(4);
    public nativeLines:boolean;
    public fillAlpha:number;
    public lineWidth:number;
    public lineColor:number;
    public graphicsData:GraphicsData[];
    public tint:number;
    public _prevTint:number;
    public blendMode:number;
    public currentPath:GraphicsData;
    public _webGL:any;   
    public boundsPadding:number;
    public _localBounds:Bounds;
    public dirty:number;    
    //public fastRectDirty:Number;    
    public boundsDirty:Number;   
    public clearDirty:number;
    public cachedSpriteDirty:boolean;   
    public filling:boolean;
    public fillColor:number;
    public _webgl:any;       
    public _spriteRect:Bitmap;     
    public lineAlpha:number;   

    constructor(nativeLines:boolean = false)
    {
        super();
        this.lineAlpha = 1;
        this.fillColor = 0;
        this.filling = false;
        this.fillAlpha = 1;
        this.lineWidth = 0;
        this.nativeLines = nativeLines;
        this.lineColor = 0;
        this.graphicsData = [];
        this.tint = 0xFFFFFF;
        this._prevTint = 0xFFFFFF;
        this.blendMode = Constants.BLEND_MODES.NORMAL;
        this.currentPath = null;
        this._webGL = {};
        this.isMask = false;
        this.boundsPadding = 0;
        this._localBounds = new Bounds();
        this.dirty = 0;
        this.clearDirty = 0;
        this.boundsDirty = -1;
        this.cachedSpriteDirty = false;
        this._spriteRect = null;
    }

    public clone():Graphics
    {
        const clone = new Graphics();
        clone.renderable = this.renderable;
        clone.fillAlpha = this.fillAlpha;
        clone.lineWidth = this.lineWidth;
        clone.lineColor = this.lineColor;
        clone.tint = this.tint;
        clone.blendMode = this.blendMode;
        clone.isMask = this.isMask;
        clone.boundsPadding = this.boundsPadding;
        clone.dirty = 0;
        clone.cachedSpriteDirty = this.cachedSpriteDirty;
        for (let i = 0; i < this.graphicsData.length; ++i)
        {
            clone.graphicsData.push(this.graphicsData[i].clone());
        }
        clone.currentPath = clone.graphicsData[clone.graphicsData.length - 1];
        clone.updateLocalBounds();
        return clone;
    }

    public lineStyle(lineWidth:number = 0, color:number = 0, alpha:number = 1):Graphics
    {
        this.lineWidth = lineWidth;
        this.lineColor = color;
        this.lineAlpha = alpha;
        if (this.currentPath)
        {
            if (this.currentPath.shape.points.length)
            {
                const shape = new Polygon(this.currentPath.shape.points.slice(-2));
                shape.closed = false;
                this.drawShape(shape);
            }
            else
            {
                this.currentPath.lineWidth = this.lineWidth;
                this.currentPath.lineColor = this.lineColor;
                this.currentPath.lineAlpha = this.lineAlpha;
            }
        }
        return this;
    }

    public moveTo(x:number, y:number):Graphics
    {
        const shape = new Polygon([x, y]);
        shape.closed = false;
        this.drawShape(shape);
        return this;
    }

    public lineTo(x:number, y:number):Graphics
    {
        this.currentPath.shape.points.push(x, y);
        this.dirty++;
        return this;
    }

    public quadraticCurveTo(cpX:number, cpY:number, toX:number, toY:number):Graphics
    {
        if (this.currentPath)
        {
            if (this.currentPath.shape.points.length === 0)
            {
                this.currentPath.shape.points = [0, 0];
            }
        }
        else
        {
            this.moveTo(0, 0);
        }
        const n = 20;
        const points = this.currentPath.shape.points;
        let xa = 0;
        let ya = 0;
        if (points.length === 0)
        {
            this.moveTo(0, 0);
        }
        const fromX = points[points.length - 2];
        const fromY = points[points.length - 1];
        for (let i = 1; i <= n; ++i)
        {
            const j = i / n;
            xa = fromX + ((cpX - fromX) * j);
            ya = fromY + ((cpY - fromY) * j);
            points.push(xa + (((cpX + ((toX - cpX) * j)) - xa) * j),
                ya + (((cpY + ((toY - cpY) * j)) - ya) * j));
        }
        this.dirty++;
        return this;
    }

    public bezierCurveTo(cpX:number, cpY:number, cpX2:number, cpY2:number, toX:number, toY:number):Graphics
    {
        if (this.currentPath)
        {
            if (this.currentPath.shape.points.length === 0)
            {
                this.currentPath.shape.points = [0, 0];
            }
        }
        else
        {
            this.moveTo(0, 0);
        }
        const points = this.currentPath.shape.points;
        const fromX = points[points.length - 2];
        const fromY = points[points.length - 1];
        points.length -= 2;
        ShapeUtils.bezierCurveTo(fromX, fromY, cpX, cpY, cpX2, cpY2, toX, toY, points);
        this.dirty++;
        return this;
    }

    public arcTo(x1:number, y1:number, x2:number, y2:number, radius:number):Graphics
    {
        if (this.currentPath)
        {
            if (this.currentPath.shape.points.length === 0)
            {
                this.currentPath.shape.points.push(x1, y1);
            }
        }
        else
        {
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
        if (mm < 1.0e-8 || radius === 0)
        {
            if (points[points.length - 2] !== x1 || points[points.length - 1] !== y1)
            {
                points.push(x1, y1);
            }
        }
        else
        {
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
        this.dirty++;
        return this;
    }

    public arc(cx:number, cy:number, radius:number, startAngle:number, endAngle:number, anticlockwise:boolean = false):Graphics
    {
        if (startAngle === endAngle)
        {
            return this;
        }
        if (!anticlockwise && endAngle <= startAngle)
        {
            endAngle += Constants.PI_2;
        }
        else if (anticlockwise && startAngle <= endAngle)
        {
            startAngle += Constants.PI_2;
        }
        const sweep = endAngle - startAngle;
        const segs = Math.ceil(Math.abs(sweep) / Constants.PI_2) * 40;
        if (sweep === 0)
        {
            return this;
        }
        const startX = cx + (Math.cos(startAngle) * radius);
        const startY = cy + (Math.sin(startAngle) * radius);
        let points = this.currentPath ? this.currentPath.shape.points : null;
        if (points)
        {
            if (points[points.length - 2] !== startX || points[points.length - 1] !== startY)
            {
                points.push(startX, startY);
            }
        }
        else
        {
            this.moveTo(startX, startY);
            points = this.currentPath.shape.points;
        }
        const theta = sweep / (segs * 2);
        const theta2 = theta * 2;
        const cTheta = Math.cos(theta);
        const sTheta = Math.sin(theta);
        const segMinus = segs - 1;
        const remainder = (segMinus % 1) / segMinus;
        for (let i = 0; i <= segMinus; ++i)
        {
            const real = i + (remainder * i);
            const angle = ((theta) + startAngle + (theta2 * real));
            const c = Math.cos(angle);
            const s = -Math.sin(angle);
            points.push(
                (((cTheta * c) + (sTheta * s)) * radius) + cx,
                (((cTheta * -s) + (sTheta * c)) * radius) + cy
            );
        }
        this.dirty++;
        return this;
    }

    public beginFill(color:number = 0, alpha:number = 1):Graphics
    {
        this.filling = true;
        this.fillColor = color;
        this.fillAlpha = alpha;
        if (this.currentPath)
        {
            if (this.currentPath.shape.points.length <= 2)
            {
                this.currentPath.fill = this.filling;
                this.currentPath.fillColor = this.fillColor;
                this.currentPath.fillAlpha = this.fillAlpha;
            }
        }
        return this;
    }

    public endFill():Graphics
    {
        this.filling = false;
        this.fillColor = null;
        this.fillAlpha = 1;
        return this;
    }

    public drawRect(x:number, y:number, width:number, height:number):Graphics
    {
        this.drawShape(new Rectangle(x, y, width, height));
        return this;
    }

    public drawRoundedRect(x:number, y:number, width:number, height:number, radius:number):Graphics
    {
        this.drawShape(new RoundedRectangle(x, y, width, height, radius));
        return this;
    }

    public drawCircle(x:number, y:number, radius:number):Graphics
    {
        this.drawShape(new Circle(x, y, radius));
        return this;
    }

    public drawEllipse(x:number, y:number, width:number, height:number):Graphics
    {
        this.drawShape(new Ellipse(x, y, width, height));
        return this;
    }

    public drawPolygon(path:number[]|Point[]|Polygon):Graphics
    {
        let points = path;
        let closed = true;
        if (points instanceof Polygon)
        {
            closed = points.closed;
            points = points.points;
        }
        if (!Array.isArray(points))
        {
            points = new Array(arguments.length);
            for (let i = 0; i < points.length; ++i)
            {
                points[i] = arguments[i]; 
            }
        }
        const shape = new Polygon(points);
        shape.closed = closed;
        this.drawShape(shape);
        return this;
    }

    public drawStar(x:number, y:number, points:number, radius:number, innerRadius:number, rotation:number = 0):Graphics
    {
        innerRadius = innerRadius || radius / 2;
        const startAngle = (-1 * Math.PI / 2) + rotation;
        const len = points * 2;
        const delta = Constants.PI_2 / len;
        const polygon = [];
        for (let i = 0; i < len; i++)
        {
            const r = i % 2 ? innerRadius : radius;
            const angle = (i * delta) + startAngle;
            polygon.push(
                x + (r * Math.cos(angle)),
                y + (r * Math.sin(angle))
            );
        }
        return this.drawPolygon(polygon);
    }

    public clear():Graphics
    {
        if (this.lineWidth || this.filling || this.graphicsData.length > 0)
        {
            this.lineWidth = 0;
            this.filling = false;
            this.boundsDirty = -1;
            this.dirty++;
            this.clearDirty++;
            this.graphicsData.length = 0;
        }
        this.currentPath = null;
        this._spriteRect = null;
        return this;
    }

    public _renderWebGL():void
    {        
        if(!this.stage)
        {
            return;
        }
        if(this.transform.requireUpdate)
        {
            this.transform.updateWorldTransform(this.parent.transform);
            this.transform.update();
        }
        this.stage.setObjectRenderer(GraphicsRenderer.renderer);
        GraphicsRenderer.renderer.render(this);
    }

    public _calculateBounds():void
    {
        if (this.boundsDirty !== this.dirty)
        {
            this.boundsDirty = this.dirty;
            this.updateLocalBounds();
            this.cachedSpriteDirty = true;
        }
        const lb = this._localBounds;
        this._bounds.addFrame(this.transform, lb.minX, lb.minY, lb.maxX, lb.maxY);
    }

    public containsPoint(point:Point):boolean
    {
        this.worldTransform.applyInverse(point, Graphics.tempPoint);
        const graphicsData = this.graphicsData;
        for (let i = 0; i < graphicsData.length; ++i)
        {
            const data = graphicsData[i];
            if (!data.fill)
            {
                continue;
            }
            if (data.shape)
            {
                if (data.shape.contains(Graphics.tempPoint.x, Graphics.tempPoint.y))
                {
                    if (data.holes)
                    {
                        for (let i = 0; i < data.holes.length; i++)
                        {
                            const hole = data.holes[i];
                            if (hole.contains(Graphics.tempPoint.x, Graphics.tempPoint.y))
                            {
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

    public updateLocalBounds():void
    {
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        if (this.graphicsData.length)
        {
            let shape:any = 0;
            let x = 0;
            let y = 0;
            let w = 0;
            let h = 0;
            for (let i = 0; i < this.graphicsData.length; i++)
            {
                const data = this.graphicsData[i];
                const type = data.type;
                const lineWidth = data.lineWidth;
                shape = data.shape;
                if (type === Constants.SHAPES.RECT || type === Constants.SHAPES.RREC)
                {
                    x = shape.x - (lineWidth / 2);
                    y = shape.y - (lineWidth / 2);
                    w = shape.width + lineWidth;
                    h = shape.height + lineWidth;
                    minX = x < minX ? x : minX;
                    maxX = x + w > maxX ? x + w : maxX;
                    minY = y < minY ? y : minY;
                    maxY = y + h > maxY ? y + h : maxY;
                }
                else if (type === Constants.SHAPES.CIRC)
                {
                    x = shape.x;
                    y = shape.y;
                    w = shape.radius + (lineWidth / 2);
                    h = shape.radius + (lineWidth / 2);
                    minX = x - w < minX ? x - w : minX;
                    maxX = x + w > maxX ? x + w : maxX;
                    minY = y - h < minY ? y - h : minY;
                    maxY = y + h > maxY ? y + h : maxY;
                }
                else if (type === Constants.SHAPES.ELIP)
                {
                    x = shape.x;
                    y = shape.y;
                    w = shape.width + (lineWidth / 2);
                    h = shape.height + (lineWidth / 2);
                    minX = x - w < minX ? x - w : minX;
                    maxX = x + w > maxX ? x + w : maxX;
                    minY = y - h < minY ? y - h : minY;
                    maxY = y + h > maxY ? y + h : maxY;
                }
                else
                {
                    const points = shape.points;
                    let x2 = 0;
                    let y2 = 0;
                    let dx = 0;
                    let dy = 0;
                    let rw = 0;
                    let rh = 0;
                    let cx = 0;
                    let cy = 0;
                    for (let j = 0; j + 2 < points.length; j += 2)
                    {
                        x = points[j];
                        y = points[j + 1];
                        x2 = points[j + 2];
                        y2 = points[j + 3];
                        dx = Math.abs(x2 - x);
                        dy = Math.abs(y2 - y);
                        h = lineWidth;
                        w = Math.sqrt((dx * dx) + (dy * dy));
                        if (w < 1e-9)
                        {
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
        else
        {
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

    public drawShape(shape:Circle|Ellipse|Polygon|Rectangle|RoundedRectangle):GraphicsData
    {
        if (this.currentPath)
        {
            if (this.currentPath.shape.points.length <= 2)
            {
                this.graphicsData.pop();
            }
        }
        this.currentPath = null;
        const data = new GraphicsData(
            this.lineWidth,
            this.lineColor,
            this.lineAlpha,
            this.fillColor,
            this.fillAlpha,
            this.filling,
            this.nativeLines,
            shape
        );
        this.graphicsData.push(data);
        if (data.type === Constants.SHAPES.POLY)
        {
            data.shape.closed = data.shape.closed || this.filling;
            this.currentPath = data;
        }
        this.dirty++;
        return data;
    }

    public closePath():Graphics
    {
        const currentPath = this.currentPath;
        if (currentPath && currentPath.shape)
        {
            currentPath.shape.close();
        }
        return this;
    }

    public addHole():Graphics
    {
        const hole = this.graphicsData.pop();
        this.currentPath = this.graphicsData[this.graphicsData.length - 1];
        this.currentPath.addHole(hole.shape);
        this.currentPath = null;
        return this;
    }

    public destroy(options:any|boolean)
    {
        super.destroy(options);
        for (let i = 0; i < this.graphicsData.length; ++i)
        {
            this.graphicsData[i].destroy();
        }
        for (const id in this._webgl)
        {
            for (let j = 0; j < this._webgl[id].data.length; ++j)
            {
                this._webgl[id].data[j].destroy();
            }
        }
        if (this._spriteRect)
        {
            this._spriteRect.destroy();
        }
        this.graphicsData = null;
        this.currentPath = null;
        this._webgl = null;
        this._localBounds = null;
    }
}