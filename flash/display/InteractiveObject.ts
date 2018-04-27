import { DisplayObject } from "flash/display/DisplayObject";

// TYPED

export class InteractiveObject extends DisplayObject
{
    protected _mouseEnabled:boolean;   

    constructor()
    {
        super();
        this._mouseEnabled = true;
    }

    public get mouseEnabled():boolean
    {
        return this._mouseEnabled;
    }

    public set mouseEnabled(value:boolean)
    {
        this._mouseEnabled = value;
    }
}