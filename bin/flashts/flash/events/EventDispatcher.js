define(["require", "exports", "flash/rendering/core/BaseObject", "flash/events/Event"], function (require, exports, BaseObject_1, Event_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class EventDispatcher extends BaseObject_1.BaseObject {
        constructor() {
            super();
            this._events = [];
            this._eventsCount = 0;
        }
        registerEvent(type, listener, scope = null) {
            var listenerScope = scope;
            if (!listenerScope) {
                listenerScope = this;
            }
            var group = this._events[type];
            group.register(listener, scope);
        }
        addEventListener(type, listener, scope = null, useCapture = false, priority = 0, useWeakReference = false) {
            if (!this._events[type]) {
                this._events[type] = new EventGroup(type);
                this.registerEvent(type, listener, scope);
            }
            else if (this._events[type]) {
                var group = this._events[type];
                if (!group.hasListenerGroup(listener, scope)) {
                    this.registerEvent(type, listener, scope);
                }
            }
        }
        dispatchEvent(event) {
            if (event.isDefaultPrevented()) {
                return false;
            }
            if (!this._events[event.type]) {
                return false;
            }
            else if (this._events[event.type]) {
                var group = this._events[event.type];
                Event_1.Event.linkEvent(event, this);
                group.call(event);
            }
            return true;
        }
        hasEventListener(type) {
            if (this._events[type]) {
                return true;
            }
            return false;
        }
        removeEventListener(type, listener, useCapture = false) {
            if (!this._events[type]) {
                return;
            }
            else if (this._events[type]) {
                var group = this._events[type];
                group.removeListener(listener);
            }
        }
        willTrigger(type) {
            if (this._events[type]) {
                return true;
            }
            return false;
        }
    }
    exports.EventDispatcher = EventDispatcher;
    class EventGroup {
        constructor(type) {
            this.type = type;
            this.groups = [];
        }
        call(event) {
            for (var i = 0; i < this.groups.length; i++) {
                this.groups[i].listener.call(this.groups[i].scope, event);
            }
        }
        removeListener(listener) {
            for (var i = 0; i < this.groups.length; i++) {
                if (this.groups[i].listener == listener) {
                    var group = this.groups[i];
                    group.listener = null;
                    group.scope = null;
                    this.groups.splice(i, 1);
                    return;
                }
            }
        }
        hasListenerGroup(listener, scope) {
            for (var i = 0; i < this.groups.length; i++) {
                if (this.groups[i].listener == listener && this.groups[i].scope == scope) {
                    return true;
                }
            }
            return false;
        }
        register(listener, scope) {
            var group = new ListenerGroup(listener, scope);
            this.groups.push(group);
        }
    }
    class ListenerGroup {
        constructor(listener, scope) {
            this.listener = listener;
            this.scope = scope;
        }
    }
});
//# sourceMappingURL=EventDispatcher.js.map