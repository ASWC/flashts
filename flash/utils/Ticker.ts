import { TickerListener } from "flash/utils/TickerListener";
import { Constants } from "flash/rendering/managers/Constants";
import { StageSettings } from "flash/rendering/core/StageSettings";

export class Ticker
{
    public _head:TickerListener;
    public _requestId:number;
    public _maxElapsedMS:number;
    public autoStart:boolean;
    public deltaTime:number;
    public elapsedMS:number;
    public started:boolean;
    public lastTime:number;
    public _tick:FrameRequestCallback;
    public speed:number;
  
    constructor()
    {
        this._head = new TickerListener(null, null, Infinity);
        this._requestId = null;
        this._maxElapsedMS = 100;
        this.autoStart = false;
        this.deltaTime = 1;
        this.elapsedMS = 1 / StageSettings.FPMS;
        this.lastTime = -1;
        this.speed = 1;
        this.started = false;
        this._tick = (time) =>
        {
            this._requestId = null;
            if (this.started)
            {
                this.update(time);
                if (this.started && this._requestId === null && this._head.next)
                {
                    this._requestId = requestAnimationFrame(this._tick);
                }
            }
        };
    }

    private _requestIfNeeded():void
    {
        if (this._requestId === null && this._head.next)
        {
            this.lastTime = performance.now();
            this._requestId = requestAnimationFrame(this._tick);
        }
    }

    private _cancelIfNeeded():void
    {
        if (this._requestId !== null)
        {
            cancelAnimationFrame(this._requestId);
            this._requestId = null;
        }
    }

    private _startIfPossible():void
    {
        if (this.started)
        {
            this._requestIfNeeded();
        }
        else if (this.autoStart)
        {
            this.start();
        }
    }

    public add(fn:Function, context:any, priority:number = Constants.UPDATE_PRIORITY.NORMAL):void
    {
        this._addListener(new TickerListener(fn, context, priority));
    }

    public addOnce(fn:Function, context:any, priority = Constants.UPDATE_PRIORITY.NORMAL):Ticker
    {
        return this._addListener(new TickerListener(fn, context, priority, true));
    }

    public _addListener(listener:TickerListener):Ticker
    {
        let current = this._head.next;
        let previous = this._head;
        if (!current)
        {
            listener.connect(previous);
        }
        else
        {
            while (current)
            {
                if (listener.priority > current.priority)
                {
                    listener.connect(previous);
                    break;
                }
                previous = current;
                current = current.next;
            }
            if (!listener.previous)
            {
                listener.connect(previous);
            }
        }
        this._startIfPossible();
        return this;
    }

    public remove(fn:Function, context:any):Ticker
    {
        let listener = this._head.next;
        while (listener)
        {
            if (listener.match(fn, context))
            {
                listener = listener.destroy();
            }
            else
            {
                listener = listener.next;
            }
        }
        if (!this._head.next)
        {
            this._cancelIfNeeded();
        }
        return this;
    }

    public start():void
    {
        if (!this.started)
        {
            this.started = true;
            this._requestIfNeeded();
        }
    }

    public stop():void
    {
        if (this.started)
        {
            this.started = false;
            this._cancelIfNeeded();
        }
    }

    public destroy():void
    {
        this.stop();
        let listener = this._head.next;
        while (listener)
        {
            listener = listener.destroy(true);
        }
        this._head.destroy();
        this._head = null;
    }

    public update(currentTime:number = performance.now()):void
    {
        let elapsedMS;
        if (currentTime > this.lastTime)
        {
            elapsedMS = this.elapsedMS = currentTime - this.lastTime;
            if (elapsedMS > this._maxElapsedMS)
            {
                elapsedMS = this._maxElapsedMS;
            }
            this.deltaTime = elapsedMS * StageSettings.FPMS * this.speed;
            const head = this._head;
            let listener = head.next;
            while (listener)
            {
                listener = listener.emit(this.deltaTime);
            }
            if (!head.next)
            {
                this._cancelIfNeeded();
            }
        }
        else
        {
            this.deltaTime = this.elapsedMS = 0;
        }
        this.lastTime = currentTime;
    }

    public get FPS():number
    {
        return 1000 / this.elapsedMS;
    }

    public get minFPS():number
    {
        return 1000 / this._maxElapsedMS;
    }

    public set minFPS(fps:number)
    {
        const minFPMS = Math.min(Math.max(0, fps) / 1000, StageSettings.FPMS);
        this._maxElapsedMS = 1 / minFPMS;
    }

}