import { Constants } from "flash/rendering/managers/Constants";
import { BaseShape } from "flash/rendering/core/shapes/BaseShape";

export class Rectangle extends BaseShape
{    
    public type:any;
    constructor(x:number = 0, y:number = 0, width:number = 0, height:number = 0)
    {
        super();
        this._x = Number(x);
        this._y = Number(y);
        this._width = Number(width);
        this._height = Number(height);
        this.type = Constants.SHAPES.RECT;
    }
    public get left():number
    {
        return this.x;
    }

    public get right():number
    {
        return this.x + this.width;
    }

    public get top():number
    {
        return this.y;
    }

    public get bottom():number
    {
        return this.y + this.height;
    }

    public static get EMPTY():Rectangle
    {
        return new Rectangle(0, 0, 0, 0);
    }

    public clone():Rectangle
    {
        return new Rectangle(this.x, this.y, this.width, this.height);
    }

    public copy(rectangle:Rectangle):Rectangle
    {
        this.x = rectangle.x;
        this.y = rectangle.y;
        this.width = rectangle.width;
        this.height = rectangle.height;
        return this;
    }

    public contains(x:number, y:number):boolean
    {
        if (this.width <= 0 || this.height <= 0)
        {
            return false;
        }
        if (x >= this.x && x < this.x + this.width)
        {
            if (y >= this.y && y < this.y + this.height)
            {
                return true;
            }
        }
        return false;
    }

    public pad(paddingX:number, paddingY:number):void
    {
        paddingX = paddingX || 0;
        paddingY = paddingY || ((paddingY !== 0) ? paddingX : 0);
        this.x -= paddingX;
        this.y -= paddingY;
        this.width += paddingX * 2;
        this.height += paddingY * 2;
    }

    public fit(rectangle:Rectangle):void
    {
        if (this.x < rectangle.x)
        {
            this.width += this.x;
            if (this.width < 0)
            {
                this.width = 0;
            }
            this.x = rectangle.x;
        }
        if (this.y < rectangle.y)
        {
            this.height += this.y;
            if (this.height < 0)
            {
                this.height = 0;
            }
            this.y = rectangle.y;
        }
        if (this.x + this.width > rectangle.x + rectangle.width)
        {
            this.width = rectangle.width - this.x;
            if (this.width < 0)
            {
                this.width = 0;
            }
        }
        if (this.y + this.height > rectangle.y + rectangle.height)
        {
            this.height = rectangle.height - this.y;
            if (this.height < 0)
            {
                this.height = 0;
            }
        }
    }

    public enlarge(rectangle:Rectangle):void
    {
        const x1 = Math.min(this.x, rectangle.x);
        const x2 = Math.max(this.x + this.width, rectangle.x + rectangle.width);
        const y1 = Math.min(this.y, rectangle.y);
        const y2 = Math.max(this.y + this.height, rectangle.y + rectangle.height);
        this.x = x1;
        this.width = x2 - x1;
        this.y = y1;
        this.height = y2 - y1;
    }
}