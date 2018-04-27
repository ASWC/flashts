import { BaseObject } from "flash/display/BaseObject";
import { Point } from "flash/geom/Point";

export class BaseShape extends BaseObject
{
    protected _type:number;
    protected _points:number[];
    protected _closed:boolean;
    protected _x:number;
    protected _y:number;
    protected _width:number;
    protected _height:number;
    protected _radius:number;

    constructor()
    {
        super();
        this._type = 0;
        this._points = [];
        this._closed = false;
        this._x = 0;
        this._y = 0;
        this._width = 0;
        this._height = 0;
        this._radius = 0;
    }

    public clone():BaseShape
    {
        return null;
    }

    public get type():number
    {
        return this._type;
    }

    public set type(value:number)
    {
        this._type = value;
    }

    public set points(value:number[])
    {
        this._points = value;
    }

    public get points():number[]
    {
        return this._points;
    }

    public set closed(value:boolean)
    {
        this._closed = value;
    }

    public get closed():boolean
    {
        return this._closed;
    }

    public set radius(value:number)
    {
        this._radius = value;        
    }

    public get radius():number
    {
        return this._radius;
    }

    public set y(value:number)
    {
        this._y = value;
    }

    public get y():number
    {
        return this._y;
    }

    public set width(value:number)
    {
        this._width = value;
    }

    public get width():number
    {
        return this._width;
    }

    public set height(value:number)
    {
        this._height = value;
    }

    public get height():number
    {
        return this._height;
    }

    public set x(value:number)
    {
        this._x = value;
    }

    public get x():number
    {
        return this._x;
    }

    public contains(x:number, y:number):boolean
    {
        return false;
    }

    public close():void
    {
       
    }
}