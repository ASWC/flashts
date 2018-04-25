import { Event } from "flash/events/Event";

export class IOErrorEvent extends Event
{
    public static IO_ERROR:string = "ioError"
    public static STANDARD_ERROR_IO_ERROR:string = "standardErrorIoError"
    public static STANDARD_INPUT_IO_ERROR:string = "standardInputIoError"
    public static STANDARD_OUTPUT_IO_ERROR:string = "standardOutputIoError"

    constructor(type:string, bubbles:boolean = false, cancelable:boolean = false, text:string = "", id:number = 0)
    {
        super(type, bubbles, cancelable);
    }
}