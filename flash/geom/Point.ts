

export class Point
{
    protected _x:number;
    protected _y:number;
    protected _requireUpdate:boolean;
   
    constructor(x:number = 0, y:number = 0)
    {
        this._x = x// + 0.00000001;
        this._y = y// + 0.00000001;  
    }

    public update():void
    {
        this._requireUpdate = false;
    }

    public get requireUpdate():boolean
    {
        return this._requireUpdate;
    }

    public set x(value:number)
    {
        this._x = value;
        this._requireUpdate = true;
    }

    public get x():number
    {
        return this._x;
    }

    public set y(value:number)
    {
        this._y = value;
        this._requireUpdate = true;
    }

    public get y():number
    {
        return this._y;
    }

    public clone():Point
    {
        return new Point(this._x, this._y);
    }

    public copy(value:Point):void
    {
        this.set(value._x, value._y);
        this._requireUpdate = true;
    }

    public equals(value:Point):boolean
    {
        return (value._x === this._x) && (value._y === this._y);
    }

    public set(x:number = 0, y:number = 0):void
    {
        this._x = x || 0;
        this._y = y || ((y !== 0) ? this._x : 0);
        this._requireUpdate = true;
    }
}