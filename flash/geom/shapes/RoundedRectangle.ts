import { Constants } from "flash/rendering/managers/Constants";
import { BaseShape } from "flash/geom/shapes/BaseShape";

export class RoundedRectangle extends BaseShape
{    
    constructor(x:number = 0, y:number = 0, width:number = 0, height:number = 0, radius:number = 20)
    {
        super();
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.radius = radius;
        this.type = Constants.SHAPES.RREC;
    }

    public clone():RoundedRectangle
    {
        return new RoundedRectangle(this.x, this.y, this.width, this.height, this.radius);
    }

    public contains(x:number, y:number):boolean
    {
        if (this.width <= 0 || this.height <= 0)
        {
            return false;
        }
        if (x >= this.x && x <= this.x + this.width)
        {
            if (y >= this.y && y <= this.y + this.height)
            {
                if ((y >= this.y + this.radius && y <= this.y + this.height - this.radius)
                || (x >= this.x + this.radius && x <= this.x + this.width - this.radius))
                {
                    return true;
                }
                let dx:number = x - (this.x + this.radius);
                let dy:number = y - (this.y + this.radius);
                const radius2:number = this.radius * this.radius;
                if ((dx * dx) + (dy * dy) <= radius2)
                {
                    return true;
                }
                dx = x - (this.x + this.width - this.radius);
                if ((dx * dx) + (dy * dy) <= radius2)
                {
                    return true;
                }
                dy = y - (this.y + this.height - this.radius);
                if ((dx * dx) + (dy * dy) <= radius2)
                {
                    return true;
                }
                dx = x - (this.x + this.radius);
                if ((dx * dx) + (dy * dy) <= radius2)
                {
                    return true;
                }
            }
        }
        return false;
    }
}