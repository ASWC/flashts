import { GroupD8 } from "flash/display3D/textures/GroupD8";
import { Rectangle } from "flash/geom/Rectangle";

export class TextureUvs
{
    protected _x0:number;
    protected _y0:number;
    protected _x1:number;
    protected _y1:number;
    protected _x2:number;
    protected _y2:number;
    protected _x3:number;
    protected _y3:number;
    protected _uvsUint32:Uint32Array;

    constructor()
    {
        this._x0 = 0;
        this._y0 = 0;
        this._x1 = 1;
        this._y1 = 0;
        this._x2 = 1;
        this._y2 = 1;
        this._x3 = 0;
        this._y3 = 1;
        this._uvsUint32 = new Uint32Array(4);
    }

    public get uvsUint32():Uint32Array
    {
        return this._uvsUint32;
    }

    public get y1():number
    {
        return this._y1;
    }

    public get x2():number
    {
        return this._x2;
    }

    public get y2():number
    {
        return this._y2;
    }

    public get x3():number
    {
        return this._x3;
    }

    public get y3():number
    {
        return this._y3;
    }

    public get x1():number
    {
        return this._x1;
    }

    public get x0():number
    {
        return this._x0;
    }

    public get y0():number
    {
        return this._y0;
    }

    public set(frame:Rectangle, baseFrame:Rectangle, rotate:number):void
    {
        const tw:number = baseFrame.width;
        const th:number = baseFrame.height;
        if (rotate)
        {
            const w2:number = frame.width / 2 / tw;
            const h2:number = frame.height / 2 / th;
            const cX:number = (frame.x / tw) + w2;
            const cY:number = (frame.y / th) + h2;
            rotate = GroupD8.add(rotate, GroupD8.NW);
            this._x0 = cX + (w2 * GroupD8.uX(rotate));
            this._y0 = cY + (h2 * GroupD8.uY(rotate));
            rotate = GroupD8.add(rotate, 2); 
            this._x1 = cX + (w2 * GroupD8.uX(rotate));
            this._y1 = cY + (h2 * GroupD8.uY(rotate));
            rotate = GroupD8.add(rotate, 2);
            this._x2 = cX + (w2 * GroupD8.uX(rotate));
            this._y2 = cY + (h2 * GroupD8.uY(rotate));
            rotate = GroupD8.add(rotate, 2);
            this._x3 = cX + (w2 * GroupD8.uX(rotate));
            this._y3 = cY + (h2 * GroupD8.uY(rotate));
        }
        else
        {
            this._x0 = frame.x / tw;
            this._y0 = frame.y / th;
            this._x1 = (frame.x + frame.width) / tw;
            this._y1 = frame.y / th;
            this._x2 = (frame.x + frame.width) / tw;
            this._y2 = (frame.y + frame.height) / th;
            this._x3 = frame.x / tw;
            this._y3 = (frame.y + frame.height) / th;
        }
        this._uvsUint32[0] = (((this._y0 * 65535) & 0xFFFF) << 16) | ((this._x0 * 65535) & 0xFFFF);
        this._uvsUint32[1] = (((this._y1 * 65535) & 0xFFFF) << 16) | ((this._x1 * 65535) & 0xFFFF);
        this._uvsUint32[2] = (((this._y2 * 65535) & 0xFFFF) << 16) | ((this._x2 * 65535) & 0xFFFF);
        this._uvsUint32[3] = (((this._y3 * 65535) & 0xFFFF) << 16) | ((this._x3 * 65535) & 0xFFFF);
    }
}