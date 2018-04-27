import { Polygon } from "flash/geom/shapes/Polygon";
import { Ellipse } from "flash/geom/shapes/Ellipse";
import { Rectangle } from "flash/geom/Rectangle";
import { Circle } from "flash/geom/shapes/Circle";
import { RoundedRectangle } from "flash/geom/shapes/RoundedRectangle";
import { BaseShape } from "flash/geom/shapes/BaseShape";
import { BaseObject } from "flash/display/BaseObject";

export class GraphicsData extends BaseObject
{
    protected _lineWidth:number;
    protected _nativeLines:boolean;
    protected _lineColor:number;
    protected _lineAlpha:number;
    protected _holes:BaseShape[];
    protected _shape:BaseShape;
    protected _type:number;
    protected _fillTint:number;
    protected _fill:boolean;
    protected _lineTint:number;
    protected _fillColor:number;
    protected _fillAlpha:number;
    protected _points:number[];

    constructor(lineWidth:number, lineColor:number, lineAlpha:number, fillColor:number, fillAlpha:number, fill:boolean, nativeLines:boolean, shape:Circle|Rectangle|Ellipse|Polygon|RoundedRectangle)
    {
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

    public get type():number
    {
        return this._type;
    }

    public get shape():BaseShape
    {
        return this._shape;
    }

    public set shape(value:BaseShape)
    {
        this._shape = value;
    }

    public get fill():boolean
    {
        return this._fill;
    }

    public set fill(value:boolean)
    {
        this._fill = value;
    }

    public get holes():BaseShape[]
    {
        return this._holes;
    }

    public set holes(value:BaseShape[])
    {
        this._holes = value;
    }

    public get fillColor():number
    {
        return this._fillColor;
    }

    public set fillColor(value:number)
    {
        this._fillColor = value;
    }

    public get fillAlpha():number
    {
        return this._fillAlpha;
    }

    public set fillAlpha(value:number)
    {
        this._fillAlpha = value;
    }

    public get nativeLines():boolean
    {
        return this._nativeLines;
    }

    public get lineWidth():number
    {
        return this._lineWidth;
    }

    public set lineWidth(value:number)
    {
        this._lineWidth = value;
    }

    public get points():number[]
    {
        return this._points;
    }

    public set points(value:number[])
    {
        this._points = value;
    }

    public get lineColor():number
    {
        return this._lineColor;
    }

    public set lineColor(value:number)
    {
        this._lineColor = value;
    }

    public get lineAlpha():number
    {
        return this._lineAlpha;
    }

    public set lineAlpha(value:number)
    {
        this._lineAlpha = value;
    }

    public clone():GraphicsData
    {
        return new GraphicsData(
            this.lineWidth,
            this.lineColor,
            this.lineAlpha,
            this.fillColor,
            this.fillAlpha,
            this.fill,
            this.nativeLines,
            this.shape
        );
    }

    public addHole(shape:BaseShape):void
    {
        this.holes.push(shape);
    }

    public destroy()
    {
        this.shape = null;
        this.holes = null;
    }
}