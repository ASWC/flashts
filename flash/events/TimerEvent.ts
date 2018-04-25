import { Event } from "flash/events/Event";

export class TimerEvent extends Event
{
    public static TIMER:string = "timer";
    public static TIMER_COMPLETE:string = "timerComplete";

    public updateAfterEvent():void
    {

    }
}