import { Point } from "flash/geom/Point";
import { Constants } from "flash/rendering/managers/Constants";
import { BaseShape } from "flash/geom/shapes/BaseShape";
import { Utils } from "flash/rendering/webgl/Utils";

export class Polygon extends BaseShape
{        
    constructor(points:number[] = null)
    {
        super();
        if(points)
        {
            this.points = points;           
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
        const points:number[] = this.points;
        if (points[0] !== points[points.length - 2] || points[1] !== points[points.length - 1])
        {
            points.push(points[0], points[1]);
        }
    }

    public contains(x:number, y:number):boolean
    {
        let inside:boolean = false;
        const length:number = this.points.length / 2;
        for (let i:number = 0, j = length - 1; i < length; j = i++)
        {
            const xi:number = this.points[i * 2];
            const yi:number = this.points[(i * 2) + 1];
            const xj:number = this.points[j * 2];
            const yj:number = this.points[(j * 2) + 1];
            const intersect:boolean = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * ((y - yi) / (yj - yi))) + xi);
            if (intersect)
            {
                inside = !inside;
            }
        }
        return inside;
    }
}