import { Event } from "flash/events/Event";


export class StageOrientationEvent extends Event
{
    public static ORIENTATION_CHANGE:string = "orientationChange"
    public static ORIENTATION_CHANGING:string = "orientationChanging"

    protected _afterOrientation:string;
    protected _beforeOrientation:string;

    constructor(type:string, bubbles:boolean = false, cancelable:boolean = false, beforeOrientation:string = null, afterOrientation:string = null)
    {
        super(type, bubbles, cancelable);
    }

    public get afterOrientation():string
    {
        return this._afterOrientation;
    }

    public get beforeOrientation():string
    {
        return this._beforeOrientation;
    }
}