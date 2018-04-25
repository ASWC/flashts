import { Event } from "flash/events/Event";

export class FullScreenEvent extends Event
{
    public static FULL_SCREEN:string = "fullScreen";
    protected _fullScreen:boolean;

    constructor(type:string, bubbles:boolean = false, cancelable:boolean = false)
    {
        super(type, bubbles, cancelable);
        this._fullScreen = false;
    }

    public get fullScreen():boolean
    {
        return this._fullScreen;
    }
}