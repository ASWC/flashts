import { Rectangle } from "flash/geom/Rectangle";
import { Point } from "flash/geom/Point";
import { TransformBase } from "flash/geom/TransformBase";
import { Matrix } from "flash/geom/Matrix";

export class Bounds
{
    protected _minX:number;
    protected _minY:number;
    protected _maxX:number;
    protected _maxY:number;
    protected rect:Rectangle;
    protected _updateID:number;

    constructor()
    {
        this._minX = Infinity;
        this._minY = Infinity;
        this._maxX = -Infinity;
        this._maxY = -Infinity;
        this.rect = null;
        this._updateID = 0;
    }

    public set updateID(value:number)
    {
        this._updateID = value;
    }

    public get updateID():number
    {
        return this._updateID;
    }

    public set minY(value:number)
    {
        this._minY = value;
    }

    public get minY():number
    {
        return this._minY;
    }

    public set maxX(value:number)
    {
        this._maxX = value;
    }

    public get maxX():number
    {
        return this._maxX;
    }

    public set maxY(value:number)
    {
        this._maxY = value;
    }

    public get maxY():number
    {
        return this._maxY;
    }

    public set minX(value:number)
    {
        this._minX = value;
    }

    public get minX():number
    {
        return this._minX;
    }

    protected isEmpty():boolean
    {
        return this._minX > this._maxX || this._minY > this._maxY;
    }

    public clear():void
    {
        this._updateID++;
        this._minX = Infinity;
        this._minY = Infinity;
        this._maxX = -Infinity;
        this._maxY = -Infinity;
    }

    public getRectangle(rect:Rectangle):Rectangle
    {
        if (this._minX > this._maxX || this._minY > this._maxY)
        {
            return Rectangle.EMPTY;
        }
        rect = rect || new Rectangle(0, 0, 1, 1);
        rect.x = this._minX;
        rect.y = this._minY;
        rect.width = this._maxX - this._minX;
        rect.height = this._maxY - this._minY;
        return rect;
    }

    protected addPoint(point:Point):void
    {
        this._minX = Math.min(this._minX, point.x);
        this._maxX = Math.max(this._maxX, point.x);
        this._minY = Math.min(this._minY, point.y);
        this._maxY = Math.max(this._maxY, point.y);
    }

    public addQuad(vertices:Float32Array):void
    {
        let minX:number = this._minX;
        let minY:number = this._minY;
        let maxX:number = this._maxX;
        let maxY:number = this._maxY;
        let x:number = vertices[0];
        let y:number = vertices[1];
        minX = x < minX ? x : minX;
        minY = y < minY ? y : minY;
        maxX = x > maxX ? x : maxX;
        maxY = y > maxY ? y : maxY;
        x = vertices[2];
        y = vertices[3];
        minX = x < minX ? x : minX;
        minY = y < minY ? y : minY;
        maxX = x > maxX ? x : maxX;
        maxY = y > maxY ? y : maxY;
        x = vertices[4];
        y = vertices[5];
        minX = x < minX ? x : minX;
        minY = y < minY ? y : minY;
        maxX = x > maxX ? x : maxX;
        maxY = y > maxY ? y : maxY;
        x = vertices[6];
        y = vertices[7];
        minX = x < minX ? x : minX;
        minY = y < minY ? y : minY;
        maxX = x > maxX ? x : maxX;
        maxY = y > maxY ? y : maxY;
        this._minX = minX;
        this._minY = minY;
        this._maxX = maxX;
        this._maxY = maxY;
    }

    public addFrame(transform:TransformBase, x0:number, y0:number, x1:number, y1:number):void
    {
        const matrix:Matrix = transform.worldTransform;
        const a:number = matrix.a;
        const b:number = matrix.b;
        const c:number = matrix.c;
        const d:number = matrix.d;
        const tx:number = matrix.tx;
        const ty:number = matrix.ty;
        let minX:number = this._minX;
        let minY:number = this._minY;
        let maxX:number = this._maxX;
        let maxY:number = this._maxY;
        let x:number = (a * x0) + (c * y0) + tx;
        let y:number = (b * x0) + (d * y0) + ty;
        minX = x < minX ? x : minX;
        minY = y < minY ? y : minY;
        maxX = x > maxX ? x : maxX;
        maxY = y > maxY ? y : maxY;
        x = (a * x1) + (c * y0) + tx;
        y = (b * x1) + (d * y0) + ty;
        minX = x < minX ? x : minX;
        minY = y < minY ? y : minY;
        maxX = x > maxX ? x : maxX;
        maxY = y > maxY ? y : maxY;
        x = (a * x0) + (c * y1) + tx;
        y = (b * x0) + (d * y1) + ty;
        minX = x < minX ? x : minX;
        minY = y < minY ? y : minY;
        maxX = x > maxX ? x : maxX;
        maxY = y > maxY ? y : maxY;
        x = (a * x1) + (c * y1) + tx;
        y = (b * x1) + (d * y1) + ty;
        minX = x < minX ? x : minX;
        minY = y < minY ? y : minY;
        maxX = x > maxX ? x : maxX;
        maxY = y > maxY ? y : maxY;
        this._minX = minX;
        this._minY = minY;
        this._maxX = maxX;
        this._maxY = maxY;
    }

    public addVertices(transform:TransformBase, vertices:Float32Array, beginOffset:number, endOffset:number):void
    {
        const matrix:Matrix = transform.worldTransform;
        const a:number = matrix.a;
        const b:number = matrix.b;
        const c:number = matrix.c;
        const d:number = matrix.d;
        const tx:number = matrix.tx;
        const ty:number = matrix.ty;
        let minX:number = this._minX;
        let minY:number = this._minY;
        let maxX:number = this._maxX;
        let maxY:number = this._maxY;
        for (let i:number = beginOffset; i < endOffset; i += 2)
        {
            const rawX:number = vertices[i];
            const rawY:number = vertices[i + 1];
            const x:number = (a * rawX) + (c * rawY) + tx;
            const y:number = (d * rawY) + (b * rawX) + ty;
            minX = x < minX ? x : minX;
            minY = y < minY ? y : minY;
            maxX = x > maxX ? x : maxX;
            maxY = y > maxY ? y : maxY;
        }
        this._minX = minX;
        this._minY = minY;
        this._maxX = maxX;
        this._maxY = maxY;
    }

    public addBounds(bounds:Bounds):void
    {
        const minX:number = this._minX;
        const minY:number = this._minY;
        const maxX:number = this._maxX;
        const maxY:number = this._maxY;
        this._minX = bounds._minX < minX ? bounds._minX : minX;
        this._minY = bounds._minY < minY ? bounds._minY : minY;
        this._maxX = bounds._maxX > maxX ? bounds._maxX : maxX;
        this._maxY = bounds._maxY > maxY ? bounds._maxY : maxY;
    }

    public addBoundsMask(bounds:Bounds, mask:Bounds):void
    {
        const _minX:number = bounds._minX > mask._minX ? bounds._minX : mask._minX;
        const _minY:number = bounds._minY > mask._minY ? bounds._minY : mask._minY;
        const _maxX:number = bounds._maxX < mask._maxX ? bounds._maxX : mask._maxX;
        const _maxY:number = bounds._maxY < mask._maxY ? bounds._maxY : mask._maxY;
        if (_minX <= _maxX && _minY <= _maxY)
        {
            const minX:number = this._minX;
            const minY:number = this._minY;
            const maxX:number = this._maxX;
            const maxY:number = this._maxY;
            this._minX = _minX < minX ? _minX : minX;
            this._minY = _minY < minY ? _minY : minY;
            this._maxX = _maxX > maxX ? _maxX : maxX;
            this._maxY = _maxY > maxY ? _maxY : maxY;
        }
    }

    public addBoundsArea(bounds:Bounds, area:Rectangle):void
    {
        const _minX:number = bounds._minX > area.x ? bounds._minX : area.x;
        const _minY:number = bounds._minY > area.y ? bounds._minY : area.y;
        const _maxX:number = bounds._maxX < area.x + area.width ? bounds._maxX : (area.x + area.width);
        const _maxY:number = bounds._maxY < area.y + area.height ? bounds._maxY : (area.y + area.height);
        if (_minX <= _maxX && _minY <= _maxY)
        {
            const minX:number = this._minX;
            const minY:number = this._minY;
            const maxX:number = this._maxX;
            const maxY:number = this._maxY;
            this._minX = _minX < minX ? _minX : minX;
            this._minY = _minY < minY ? _minY : minY;
            this._maxX = _maxX > maxX ? _maxX : maxX;
            this._maxY = _maxY > maxY ? _maxY : maxY;
        }
    }
}