
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
import { GraphicsRenderer } from "flash/display3D/renderers/GraphicsRenderer";
import { DisplayObject } from "flash/display/DisplayObject";
import { BaseObject } from "flash/display/BaseObject";
import { DisplayObjectContainer } from "flash/display/DisplayObjectContainer";
import { WebGlDataDictionary } from "flash/display3D/types/DataDictionaries";
import { BaseShape } from "flash/rendering/core/shapes/BaseShape";

// TYPED

export class Graphics extends DisplayObjectContainer
{
    protected static tempMatrix:Matrix = new Matrix();
    protected static tempPoint:Point = new Point();
    protected static tempColor1:Float32Array = new Float32Array(4);
    protected static tempColor2:Float32Array = new Float32Array(4);
    protected nativeLines:boolean;
    protected fillAlpha:number;
    protected lineWidth:number;
    protected lineColor:number;
    protected _graphicsData:GraphicsData[];
    protected _tint:number;
    protected _prevTint:number;
    protected _blendMode:number;
    protected currentPath:GraphicsData;
    protected _webGL:WebGlDataDictionary;  
    protected boundsPadding:number;
    protected _localBounds:Bounds;
    protected _dirty:number;      
    protected boundsDirty:Number;   
    protected _clearDirty:number;
    protected cachedSpriteDirty:boolean;   
    protected filling:boolean;
    protected fillColor:number;
    protected _webgl:WebGlDataDictionary;       
    protected _spriteRect:Bitmap;     
    protected lineAlpha:number;   

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
        this._graphicsData = [];
        this._tint = 0xFFFFFF;
        this._prevTint = 0xFFFFFF;
        this._blendMode = Constants.BLEND_MODES.NORMAL;
        this.currentPath = null;
        this._webGL = {};
        this.isMask = false;
        this.boundsPadding = 0;
        this._localBounds = new Bounds();
        this._dirty = 0;
        this._clearDirty = 0;
        this.boundsDirty = -1;
        this.cachedSpriteDirty = false;
        this._spriteRect = null;
    }

    public clone():Graphics
    {
        const clone:Graphics = new Graphics();
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
        for (let i:number = 0; i < this._graphicsData.length; ++i)
        {
            clone._graphicsData.push(this._graphicsData[i].clone());
        }
        clone.currentPath = clone._graphicsData[clone._graphicsData.length - 1];
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
                const shape:Polygon = new Polygon(this.currentPath.shape.points.slice(-2));
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
        const shape:Polygon = new Polygon([x, y]);
        shape.closed = false;
        this.drawShape(shape);
        return this;
    }

    public lineTo(x:number, y:number):Graphics
    {
        this.currentPath.shape.points.push(x, y);
        this._dirty++;
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
        const n:number = 20;
        const points:number[] = this.currentPath.shape.points;
        let xa:number = 0;
        let ya:number = 0;
        if (points.length === 0)
        {
            this.moveTo(0, 0);
        }
        const fromX:number = points[points.length - 2];
        const fromY:number = points[points.length - 1];
        for (let i:number = 1; i <= n; ++i)
        {
            const j = i / n;
            xa = fromX + ((cpX - fromX) * j);
            ya = fromY + ((cpY - fromY) * j);
            points.push(xa + (((cpX + ((toX - cpX) * j)) - xa) * j), ya + (((cpY + ((toY - cpY) * j)) - ya) * j));
        }
        this._dirty++;
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
        const points:number[] = this.currentPath.shape.points;
        const fromX:number = points[points.length - 2];
        const fromY:number = points[points.length - 1];
        points.length -= 2;
        ShapeUtils.bezierCurveTo(fromX, fromY, cpX, cpY, cpX2, cpY2, toX, toY, points);
        this._dirty++;
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
        const points:number[] = this.currentPath.shape.points;
        const fromX:number = points[points.length - 2];
        const fromY:number = points[points.length - 1];
        const a1:number = fromY - y1;
        const b1:number = fromX - x1;
        const a2:number = y2 - y1;
        const b2:number = x2 - x1;
        const mm:number = Math.abs((a1 * b2) - (b1 * a2));
        if (mm < 1.0e-8 || radius === 0)
        {
            if (points[points.length - 2] !== x1 || points[points.length - 1] !== y1)
            {
                points.push(x1, y1);
            }
        }
        else
        {
            const dd:number = (a1 * a1) + (b1 * b1);
            const cc:number = (a2 * a2) + (b2 * b2);
            const tt:number = (a1 * a2) + (b1 * b2);
            const k1:number = radius * Math.sqrt(dd) / mm;
            const k2:number = radius * Math.sqrt(cc) / mm;
            const j1:number = k1 * tt / dd;
            const j2:number = k2 * tt / cc;
            const cx:number = (k1 * b2) + (k2 * b1);
            const cy:number = (k1 * a2) + (k2 * a1);
            const px:number = b1 * (k2 + j1);
            const py:number = a1 * (k2 + j1);
            const qx:number = b2 * (k1 + j2);
            const qy:number = a2 * (k1 + j2);
            const startAngle:number = Math.atan2(py - cy, px - cx);
            const endAngle:number = Math.atan2(qy - cy, qx - cx);
            this.arc(cx + x1, cy + y1, radius, startAngle, endAngle, b1 * a2 > b2 * a1);
        }
        this._dirty++;
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
        const sweep:number = endAngle - startAngle;
        const segs:number = Math.ceil(Math.abs(sweep) / Constants.PI_2) * 40;
        if (sweep === 0)
        {
            return this;
        }
        const startX:number = cx + (Math.cos(startAngle) * radius);
        const startY:number = cy + (Math.sin(startAngle) * radius);
        let points:number[] = this.currentPath ? this.currentPath.shape.points : null;
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
        const theta:number = sweep / (segs * 2);
        const theta2:number = theta * 2;
        const cTheta:number = Math.cos(theta);
        const sTheta:number = Math.sin(theta);
        const segMinus:number = segs - 1;
        const remainder:number = (segMinus % 1) / segMinus;
        for (let i = 0; i <= segMinus; ++i)
        {
            const real:number = i + (remainder * i);
            const angle:number = ((theta) + startAngle + (theta2 * real));
            const c:number = Math.cos(angle);
            const s:number = -Math.sin(angle);
            points.push(
                (((cTheta * c) + (sTheta * s)) * radius) + cx,
                (((cTheta * -s) + (sTheta * c)) * radius) + cy
            );
        }
        this._dirty++;
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
        let points:number[]|Point[]|Polygon = path;
        let closed:boolean = true;
        if (points instanceof Polygon)
        {
            closed = points.closed;
            points = points.points;
        }
        if (!Array.isArray(points))
        {
            points = new Array(arguments.length);
            for (let i:number = 0; i < points.length; ++i)
            {
                points[i] = arguments[i]; 
            }
        }
        const shape:Polygon = new Polygon(points);
        shape.closed = closed;
        this.drawShape(shape);
        return this;
    }

    public drawStar(x:number, y:number, points:number, radius:number, innerRadius:number, rotation:number = 0):Graphics
    {
        innerRadius = innerRadius || radius / 2;
        const startAngle:number = (-1 * Math.PI / 2) + rotation;
        const len:number = points * 2;
        const delta:number = Constants.PI_2 / len;
        const polygon:number[] = [];
        for (let i = 0; i < len; i++)
        {
            const r = i % 2 ? innerRadius : radius;
            const angle = (i * delta) + startAngle;
            polygon.push(x + (r * Math.cos(angle)), y + (r * Math.sin(angle)));
        }
        return this.drawPolygon(polygon);
    }

    public clear():Graphics
    {
        if (this.lineWidth || this.filling || this._graphicsData.length > 0)
        {
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
        if (this.boundsDirty !== this._dirty)
        {
            this.boundsDirty = this._dirty;
            this.updateLocalBounds();
            this.cachedSpriteDirty = true;
        }
        const lb:Bounds = this._localBounds;
        this._bounds.addFrame(this.transform, lb.minX, lb.minY, lb.maxX, lb.maxY);
    }

    public containsPoint(point:Point):boolean
    {
        this.worldTransform.applyInverse(point, Graphics.tempPoint);
        const graphicsData:GraphicsData[] = this._graphicsData;
        for (let i:number = 0; i < graphicsData.length; ++i)
        {
            const data:GraphicsData = graphicsData[i];
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
                        for (let i:number = 0; i < data.holes.length; i++)
                        {
                            const hole:BaseShape = data.holes[i];
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
        let minX:number = Infinity;
        let maxX:number = -Infinity;
        let minY:number = Infinity;
        let maxY:number = -Infinity;
        if (this._graphicsData.length)
        {
            let shape:BaseShape = null;
            let x:number = 0;
            let y:number = 0;
            let w:number = 0;
            let h:number = 0;
            for (let i:number = 0; i < this._graphicsData.length; i++)
            {
                const data:GraphicsData = this._graphicsData[i];
                const type:number = data.type;
                const lineWidth:number = data.lineWidth;
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
                    const points:number[] = shape.points;
                    let x2:number = 0;
                    let y2:number = 0;
                    let dx:number = 0;
                    let dy:number = 0;
                    let rw:number = 0;
                    let rh:number = 0;
                    let cx:number = 0;
                    let cy:number = 0;
                    for (let j:number = 0; j + 2 < points.length; j += 2)
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
        const padding:number = this.boundsPadding;
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
                this._graphicsData.pop();
            }
        }
        this.currentPath = null;
        const data:GraphicsData = new GraphicsData(this.lineWidth, this.lineColor, this.lineAlpha, this.fillColor, this.fillAlpha, this.filling, this.nativeLines, shape);
        this._graphicsData.push(data);
        if (data.type === Constants.SHAPES.POLY)
        {
            data.shape.closed = data.shape.closed || this.filling;
            this.currentPath = data;
        }
        this._dirty++;
        return data;
    }

    public closePath():Graphics
    {
        const currentPath:GraphicsData = this.currentPath;
        if (currentPath && currentPath.shape)
        {
            currentPath.shape.close();
        }
        return this;
    }

    public addHole():Graphics
    {
        const hole:GraphicsData = this._graphicsData.pop();
        this.currentPath = this._graphicsData[this._graphicsData.length - 1];
        this.currentPath.addHole(hole.shape);
        this.currentPath = null;
        return this;
    }

    public destroy()
    {
        super.destroy();
        for (let i = 0; i < this._graphicsData.length; ++i)
        {
            this._graphicsData[i].destroy();
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
        this._graphicsData = null;
        this.currentPath = null;
        this._webgl = null;
        this._localBounds = null;
    }

    public get graphicsData():GraphicsData[]
    {
        return this._graphicsData;
    }

    public get clearDirty():number
    {
        return this._clearDirty;
    }

    public get dirty():number
    {
        return this._dirty;
    }

    public get tint():number
    {
        return this._tint;
    }

    public get blendMode():number
    {
        return this._blendMode;
    }

    public get webGL():WebGlDataDictionary
    {
        return this._webGL;
    }

}