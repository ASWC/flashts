define(["require", "exports", "flash/events/Event"], function (require, exports, Event_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class TimerEvent extends Event_1.Event {
        updateAfterEvent() {
        }
    }
    TimerEvent.TIMER = "timer";
    TimerEvent.TIMER_COMPLETE = "timerComplete";
    exports.TimerEvent = TimerEvent;
});
