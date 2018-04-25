
import { Event } from "flash/events/Event";

export interface IEventDispatcher
{
    addEventListener(type:string, listener:Function, scope:any, useCapture:boolean, priority:number, useWeakReference:boolean):void;
    dispatchEvent(event:Event):boolean
    hasEventListener(type:string):boolean
    removeEventListener(type:string, listener:Function, useCapture:boolean):void
    willTrigger(type:string):boolean
}