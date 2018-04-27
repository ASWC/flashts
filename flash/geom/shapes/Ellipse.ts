import { Constants } from "flash/rendering/managers/Constants";
import { Rectangle } from "flash/geom/Rectangle";
import { BaseShape } from "flash/geom/shapes/BaseShape";

export class Ellipse extends BaseShape
{       
    constructor(x:number = 0, y:number = 0, width:number = 0, height:number = 0)
    {
        super();
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = Constants.SHAPES.ELIP;
    }

    public clone():Ellipse
    {
        return new Ellipse(this.x, this.y, this.width, this.height);
    }

    public contains(x:number, y:number):boolean
    {
        if (this.width <= 0 || this.height <= 0)
        {
            return false;
        }
        let normx:number = ((x - this.x) / this.width);
        let normy:number = ((y - this.y) / this.height);
        normx *= normx;
        normy *= normy;
        return (normx + normy <= 1);
    }

    public getBounds():Rectangle
    {
        return new Rectangle(this.x - this.width, this.y - this.height, this.width, this.height);
    }
}