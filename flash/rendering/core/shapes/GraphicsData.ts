import { Polygon } from "flash/rendering/core/shapes/Polygon";
import { Ellipse } from "flash/rendering/core/shapes/Ellipse";
import { Rectangle } from "flash/geom/Rectangle";
import { Circle } from "flash/rendering/core/shapes/Circle";
import { RoundedRectangle } from "flash/rendering/core/shapes/RoundedRectangle";
import { BaseShape } from "flash/rendering/core/shapes/BaseShape";
import { BaseObject } from "flash/display/BaseObject";

export class GraphicsData extends BaseObject
{
    public lineWidth:number;
    public nativeLines:boolean;
    public lineColor:number;
    public lineAlpha:number;
    public holes:BaseShape[];
    public shape:Circle|Rectangle|Ellipse|Polygon|RoundedRectangle;
    public type:number;
    public _fillTint:number;
    public fill:boolean;
    public _lineTint:number;
    public fillColor:number;
    public fillAlpha:number;
    public points:number[];

    constructor(lineWidth:number, lineColor:number, lineAlpha:number, fillColor:number, fillAlpha:number, fill:boolean, nativeLines:boolean, shape:Circle|Rectangle|Ellipse|Polygon|RoundedRectangle)
    {
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