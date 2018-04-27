import { Constants } from "flash/rendering/managers/Constants";
import { Rectangle } from "flash/geom/Rectangle";
import { BaseShape } from "flash/geom/shapes/BaseShape";

export class Circle extends BaseShape
{
    
    constructor(x:number = 0, y:number = 0, radius:number = 0)
    {
        super();
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.type = Constants.SHAPES.CIRC;
    }

    public clone():Circle
    {
        return new Circle(this.x, this.y, this.radius);
    }

    public contains(x:number, y:number):boolean
    {
        if (this.radius <= 0)
        {
            return false;
        }
        const r2:number = this.radius * this.radius;
        let dx:number = (this.x - x);
        let dy:number = (this.y - y);
        dx *= dx;
        dy *= dy;
        return (dx + dy <= r2);
    }

   public getBounds():Rectangle
    {
        return new Rectangle(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
    }
}