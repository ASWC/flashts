import { Event } from "flash/events/Event";

export class SecurityErrorEvent extends Event
{
    public static SECURITY_ERROR:string = "securityError";

    protected _text:string;
    protected _id:number;
    	
    constructor(type:string, bubbles:boolean = false, cancelable:boolean = false, text:string = "", id:number = 0)
    {
        super(type, bubbles, cancelable);
        this._text = text;
        this._id = id;
    }
}