import { Point } from "flash/geom/Point";
import { Constants } from "flash/rendering/managers/Constants";
import { BaseShape } from "flash/rendering/core/shapes/BaseShape";
import { Utils } from "flash/rendering/webgl/Utils";

export class Polygon extends BaseShape
{    
    public type:number;
    
    constructor(points:Point[]|number[] = null)
    {
        super();
        if(points)
        {
            if (points[0] instanceof Point)
            {
                var pointdata:any = points;
                this.points = Utils.getPointData(pointdata);
            }
            else
            {
                var numberdata:any = points;
                this.points = numberdata;
            } 
        }            
        this.closed = true;
        this.type = Constants.SHAPES.POLY;
    }

    public clone():Polygon
    {
        return new Polygon(this.points.slice());
    }

    public close():void
    {
        const points = this.points;
        if (points[0] !== points[points.length - 2] || points[1] !== points[points.length - 1])
        {
            points.push(points[0], points[1]);
        }
    }

    public contains(x:number, y:number):boolean
    {
        let inside = false;
        const length = this.points.length / 2;
        for (let i = 0, j = length - 1; i < length; j = i++)
        {
            const xi = this.points[i * 2];
            const yi = this.points[(i * 2) + 1];
            const xj = this.points[j * 2];
            const yj = this.points[(j * 2) + 1];
            const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * ((y - yi) / (yj - yi))) + xi);
            if (intersect)
            {
                inside = !inside;
            }
        }
        return inside;
    }
}