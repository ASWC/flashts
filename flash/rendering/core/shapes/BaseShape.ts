import { BaseObject } from "flash/display/BaseObject";
import { Point } from "flash/geom/Point";

export class BaseShape extends BaseObject
{
    public points:number[];
    public closed:boolean;
    public _x:number;
    public _y:number;
    public _width:number;
    public _height:number;
    public _radius:number;

    constructor()
    {
        super();
        this.closed = false;
        this._x = 0;
        this._y = 0;
        this._width = 0;
        this._height = 0;
        this._radius = 0;
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