import { Event } from "flash/events/Event";

export class HTTPStatusEvent extends Event
{
    public static HTTP_RESPONSE_STATUS:string = "httpResponseStatus"
    public static HTTP_STATUS:string = "httpStatus"

    protected _redirected:boolean;
    protected _responseHeaders:any[];
    protected _responseURL:string;

    constructor(type:string, bubbles:boolean = false, cancelable:boolean = false, status:number = 0, redirected:boolean = false)
    {
        super(type, bubbles, cancelable);
        this._redirected = false;
        this._responseHeaders = [];
        this._responseURL = '';
    }

    public get redirected():boolean
    {
        return this._redirected;
    }
    public set redirected(value:boolean)
    {
        this._redirected = value;
    }
    public get responseHeaders():any[]
    {
        return this._responseHeaders;
    }
    public set responseHeaders(value:any[])
    {
        this._responseHeaders = value;
    }
    public get responseURL():string
    {
        return this._responseURL;
    }
    public set responseURL(value:string)
    {
        this._responseURL = value;
    }

    
}