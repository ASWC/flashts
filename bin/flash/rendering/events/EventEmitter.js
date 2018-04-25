define(["require", "exports", "../core/BaseObject"], function (require, exports, BaseObject_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class EventEmitter extends BaseObject_1.BaseObject {
        constructor() {
            super();
            this._events = new Events();
            this._eventsCount = 0;
        }
        addListener(event, fn, context, once = false) {
            var listener = new EE(fn, context || this, once);
            if (!this._events[event]) {
                this._events[event] = listener;
                this._eventsCount++;
            }
            else if (!this._events[event].fn) {
                this._events[event].push(listener);
            }
            else {
                this._events[event] = [this._events[event], listener];
            }
        }
        static clearEvent(emitter, evt) {
            if (--emitter._eventsCount === 0)
                emitter._events = new Events();
            else
                delete emitter._events[evt];
        }
        /**
         * Return an array listing the events for which the emitter has registered
         * listeners.
         *
         * @returns {Array}
         * @public
         */
        eventNames() {
            var names = [], events, name;
            if (this._eventsCount === 0)
                return names;
            for (name in (events = this._events)) {
                names.push(name);
            }
            return names;
        }
        ;
        /**
         * Return the listeners registered for a given event.
         *
         * @param {(String|Symbol)} event The event name.
         * @returns {Array} The registered listeners.
         * @public
         */
        listeners(event) {
            var evt = event;
            var handlers = this._events[evt];
            if (!handlers)
                return [];
            if (handlers.fn)
                return [handlers.fn];
            for (var i = 0, l = handlers.length, ee = new Array(l); i < l; i++) {
                ee[i] = handlers[i].fn;
            }
            return ee;
        }
        ;
        /**
         * Return the number of listeners listening to a given event.
         *
         * @param {(String|Symbol)} event The event name.
         * @returns {Number} The number of listeners.
         * @public
         */
        listenerCount(event) {
            var evt = event;
            var listeners = this._events[evt];
            if (!listeners)
                return 0;
            if (listeners.fn)
                return 1;
            return listeners.length;
        }
        ;
        /**
         * Calls each of the listeners registered for a given event.
         *
         * @param {(String|Symbol)} event The event name.
         * @returns {Boolean} `true` if the event had listeners, else `false`.
         * @public
         */
        emit(event = null, a1 = null, a2 = null, a3 = null, a4 = null, a5 = null) {
            var evt = event;
            if (!this._events[evt]) {
                return false;
            }
            var listeners = this._events[evt], len = arguments.length, args, i;
            if (listeners.fn) {
                if (listeners.once)
                    this.removeListener(event, listeners.fn, undefined, true);
                this.show('listener length: ' + len);
                switch (len) {
                    case 1: return listeners.fn.call(listeners.context), true;
                    case 2: return listeners.fn.call(listeners.context, a1), true;
                    case 3: return listeners.fn.call(listeners.context, a1, a2), true;
                    case 4: return listeners.fn.call(listeners.context, a1, a2, a3), true;
                    case 5: return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
                    case 6: return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
                }
                for (i = 1, args = new Array(len - 1); i < len; i++) {
                    args[i - 1] = arguments[i];
                }
                listeners.fn.apply(listeners.context, args);
            }
            else {
                this.show('no listener length: ');
                var length = listeners.length, j;
                for (i = 0; i < length; i++) {
                    if (listeners[i].once)
                        this.removeListener(event, listeners[i].fn, undefined, true);
                    switch (len) {
                        case 1:
                            listeners[i].fn.call(listeners[i].context);
                            break;
                        case 2:
                            listeners[i].fn.call(listeners[i].context, a1);
                            break;
                        case 3:
                            listeners[i].fn.call(listeners[i].context, a1, a2);
                            break;
                        case 4:
                            listeners[i].fn.call(listeners[i].context, a1, a2, a3);
                            break;
                        default:
                            if (!args)
                                for (j = 1, args = new Array(len - 1); j < len; j++) {
                                    args[j - 1] = arguments[j];
                                }
                            listeners[i].fn.apply(listeners[i].context, args);
                    }
                }
            }
            return true;
        }
        ;
        /**
         * Remove the listeners of a given event.
         *
         * @param {(String|Symbol)} event The event name.
         * @param {Function} fn Only remove the listeners that match this function.
         * @param {*} context Only remove the listeners that have this context.
         * @param {Boolean} once Only remove one-time listeners.
         * @returns {EventEmitter} `this`.
         * @public
         */
        removeListener(event, fn, context, once = false) {
            var evt = event;
            if (!this._events[evt])
                return this;
            if (!fn) {
                EventEmitter.clearEvent(this, evt);
                return this;
            }
            var listeners = this._events[evt];
            if (listeners.fn) {
                if (listeners.fn === fn &&
                    (!once || listeners.once) &&
                    (!context || listeners.context === context)) {
                    EventEmitter.clearEvent(this, evt);
                }
            }
            else {
                for (var i = 0, events = [], length = listeners.length; i < length; i++) {
                    if (listeners[i].fn !== fn ||
                        (once && !listeners[i].once) ||
                        (context && listeners[i].context !== context)) {
                        events.push(listeners[i]);
                    }
                }
                //
                // Reset the array, or remove it completely if we have no more listeners.
                //
                if (events.length)
                    this._events[evt] = events.length === 1 ? events[0] : events;
                else
                    EventEmitter.clearEvent(this, evt);
            }
            return this;
        }
        ;
        /**
         * Remove all listeners, or those of the specified event.
         *
         * @param {(String|Symbol)} [event] The event name.
         * @returns {EventEmitter} `this`.
         * @public
         */
        removeAllListeners(event = null) {
            var evt;
            if (event) {
                evt = event;
                if (this._events[evt])
                    EventEmitter.clearEvent(this, evt);
            }
            else {
                this._events = new Events();
                this._eventsCount = 0;
            }
            return this;
        }
        ;
    }
    exports.EventEmitter = EventEmitter;
    class Events {
        /**
         * Constructor to create a storage for our `EE` objects.
         * An `Events` instance is a plain object whose properties are event names.
         *
         * @constructor
         * @private
         */
        constructor() { }
    }
    class EE {
        constructor(fn, context, once) {
            this.fn = fn;
            this.context = context;
            this.once = once || false;
        }
    }
    Function.prototype.getParent = function () {
        var scope = this;
        var emmiter; // = scope.;
        return emmiter;
    };
});
