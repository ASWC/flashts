import { BaseObject } from "flash/display/BaseObject";
import { IEventDispatcher } from "flash/events/IEventDispatcher";
import { Event } from "flash/events/Event";

export class EventDispatcher extends BaseObject implements IEventDispatcher
{
    protected _events:string[];
    protected _eventsCount:number; 

    constructor()
    {
        super();
        this._events = [];
        this._eventsCount = 0;
    }

    protected registerEvent(type:string, listener:Function, scope:any = null):void
    {
        var listenerScope:any = scope;
        if(!listenerScope)
        {
            listenerScope = this;
        }
        var group:EventGroup = this._events[type];
        group.register(listener, scope);
    }

    public addEventListener(type:string, listener:Function, scope:any = null, useCapture:boolean = false, priority:number = 0, useWeakReference:boolean = false):void
    {  
        if (!this._events[type]) 
        {
            this._events[type] = new EventGroup(type);
            this.registerEvent(type, listener, scope);
        }
        else if (this._events[type]) 
        {
            var group:EventGroup = this._events[type];
            if(!group.hasListenerGroup(listener, scope))
            {
                this.registerEvent(type, listener, scope);
            }
        }
    }

    public dispatchEvent(event:Event):boolean
    {
        if(event.isDefaultPrevented())
        {
            return false;
        }
        if (!this._events[event.type]) 
        {
            return false;
        }
        else if (this._events[event.type]) 
        {
            var group:EventGroup = this._events[event.type];
            Event.linkEvent(event, this);
            group.call(event);
        }
        return true;
    }

    public hasEventListener(type:string):boolean
    {
        if (this._events[type]) 
        {
            return true;
        }
        return false;
    }

    public removeEventListener(type:string, listener:Function, useCapture:boolean = false):void
    {
        if (!this._events[type]) 
        {
            return;
        }
        else if (this._events[type]) 
        {
            var group:EventGroup = this._events[type];
            group.removeListener(listener);
        }
    }

    public willTrigger(type:string):boolean
    {
        if (this._events[type]) 
        {
            return true;
        }
        return false;
    }
}

class EventGroup
{
    public type:string;
    protected groups:ListenerGroup[];

    constructor(type:string) 
    {
        this.type = type;   
        this.groups = [];  
    }

    public call(event:Event):void
    {
        for(var i:number = 0; i < this.groups.length; i++)
        {
            this.groups[i].listener.call(this.groups[i].scope, event);
        }
    }

    public removeListener(listener):void
    {
        for(var i:number = 0; i < this.groups.length; i++)
        {
            if(this.groups[i].listener == listener)
            {
                var group:ListenerGroup = this.groups[i];
                group.listener = null;
                group.scope = null;
                this.groups.splice(i, 1);
                return;
            }
        }
    }

    public hasListenerGroup(listener:Function, scope:any):boolean
    {
        for(var i:number = 0; i < this.groups.length; i++)
        {
            if(this.groups[i].listener == listener && this.groups[i].scope == scope)
            {
                return true;
            }
        }
        return false;
    }

    public register(listener:Function, scope:any):void
    {
        var group:ListenerGroup = new ListenerGroup(listener, scope);
        this.groups.push(group);
    }
}

class ListenerGroup
{
    public listener:Function;
    public scope:any;

    constructor(listener:Function, scope:any)
    {
        this.listener = listener;
        this.scope = scope;
    }
}