import { EventDispatcher } from "../events/EventDispatcher";
import { Ticker } from "flash/utils/Ticker";

export class Timer extends EventDispatcher
{
    private static _sharedTicker:Ticker;
    protected _repeatCount:number;
    protected _delay:number;
    protected _currentCount:number;

    constructor(delay:number, repeatCount:number = 0)
    {
        super();
        this._repeatCount = repeatCount;
        this._delay = delay;
        this._currentCount = 0;
    }

    public reset():void
    {
        this._currentCount = 0;
    }

    public start():void
    {

    }

    public stop():void
    {

    }

    public get currentCount():number
    {
        return this._currentCount;
    }

    public get delay():number
    {
        return this._delay;
    }

    public set delay(value:number)
    {
        this._delay = value;
    }

    public get repeatCount():number
    {
        return this._repeatCount;
    }

    public set repeatCount(value:number)
    {
        this._repeatCount = value;
    }

    public static get shared():Ticker
    {
        if(!Timer._sharedTicker)
        {
            Timer._sharedTicker = new Ticker();
        }
        return Timer._sharedTicker;
    }
}