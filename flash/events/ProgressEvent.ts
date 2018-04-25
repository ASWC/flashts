import { Event } from "flash/events/Event";

export class ProgressEvent extends Event
{
    public static PROGRESS:string = "progress"
    public static SOCKET_DATA:string = "socketData"
    public static STANDARD_ERROR_DATA:string = "standardErrorData"
    public static STANDARD_INPUT_PROGRESS:string = "standardInputProgress"
    public static STANDARD_OUTPUT_DATA:string = "standardOutputData"   

    protected _bytesLoaded:number;
    protected _bytesTotal:number;

    constructor(type:string, bubbles:boolean = false, cancelable:boolean = false, bytesLoaded:number = 0, bytesTotal:number = 0)
    {
        super(type, bubbles, cancelable);
        this._bytesLoaded = bytesLoaded;
        this._bytesTotal = bytesTotal;
    }

    public get bytesLoaded():number
    {
        return this._bytesLoaded;
    }
    public set bytesLoaded(value:number)
    {
        this._bytesLoaded = value;
    }
    public get bytesTotal():number
    {
        return this._bytesTotal;
    }
    public set bytesTotal(value:number)
    {
        this._bytesTotal = value;
    }
}