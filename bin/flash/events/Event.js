define(["require", "exports", "flash/display/BaseObject"], function (require, exports, BaseObject_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Event extends BaseObject_1.BaseObject {
        constructor(type, bubbles = false, cancelable = false) {
            super();
            this._defaultPrevented = false;
            this._type = type;
            this._bubbles = bubbles;
            this._cancelable = cancelable;
            this._currentTarget = null;
            this._eventPhase = 0;
            this._target = null;
        }
        get bubbles() {
            return this._bubbles;
        }
        get cancelable() {
            return this._cancelable;
        }
        get currentTarget() {
            return this._currentTarget;
        }
        get eventPhase() {
            return this._eventPhase;
        }
        get target() {
            return this._target;
        }
        get type() {
            return this._type;
        }
        clone() {
            return new Event(this._type, this._bubbles, this._cancelable);
        }
        formatToString(className, ...rest) {
            return this.className;
        }
        isDefaultPrevented() {
            return this._defaultPrevented;
        }
        preventDefault() {
            this._defaultPrevented = true;
        }
        stopImmediatePropagation() {
        }
        stopPropagation() {
        }
        toString() {
            return this.className;
        }
        static linkEvent(event, currentTarget = null, target = null) {
            if (target) {
                event._target = target;
            }
            if (currentTarget) {
                event._currentTarget = currentTarget;
            }
        }
    }
    Event.ACTIVATE = "activate";
    Event.ADDED = "added";
    Event.ADDED_TO_STAGE = "addedToStage";
    Event.BROWSER_ZOOM_CHANGE = "browserZoomChange";
    Event.CANCEL = "cancel";
    Event.CHANGE = "change";
    Event.ERROR = "error";
    Event.CHANNEL_MESSAGE = "channelMessage";
    Event.CHANNEL_STATE = "channelState";
    Event.CLEAR = "clear";
    Event.CLOSE = "close";
    Event.CLOSING = "closing";
    Event.SELECT = "select";
    Event.SELECT_ALL = "selectAll";
    Event.TAB_INDEX_CHANGE = "tabIndexChange";
    Event.TEXT_INTERACTION_MODE_CHANGE = "textInteractionModeChange";
    Event.TEXTURE_READY = "textureReady";
    Event.UNLOAD = "unload";
    Event.USER_IDLE = "userIdle";
    Event.USER_PRESENT = "userPresent";
    Event.VIDEO_FRAME = "videoFrame";
    Event.WORKER_STATE = "workerState";
    Event.SOUND_COMPLETE = "soundComplete";
    Event.STANDARD_ERROR_CLOSE = "standardErrorClose";
    Event.STANDARD_INPUT_CLOSE = "standardInputClose";
    Event.STANDARD_OUTPUT_CLOSE = "standardOutputClose";
    Event.SUSPEND = "suspend";
    Event.TAB_CHILDREN_CHANGE = "tabChildrenChange";
    Event.TAB_ENABLED_CHANGE = "tabEnabledChange";
    Event.REMOVED = "removed";
    Event.COMPLETE = "complete";
    Event.PASTE = "paste";
    Event.RENDER = "render";
    Event.RESIZE = "resize";
    Event.SCROLL = "scroll";
    Event.CONNECT = "connect";
    Event.CONTEXT3D_CREATE = "context3DCreate";
    Event.COPY = "copy";
    Event.NETWORK_CHANGE = "networkChange";
    Event.ID3 = "id3";
    Event.REMOVED_FROM_STAGE = "removedFromStage";
    Event.PREPARING = "preparing";
    Event.INIT = "init";
    Event.OPEN = "open";
    Event.LOCATION_CHANGE = "locationChange";
    Event.CUT = "cut";
    Event.MOUSE_LEAVE = "mouseLeave";
    Event.DEACTIVATE = "deactivate";
    Event.DISPLAYING = "displaying";
    Event.ENTER_FRAME = "enterFrame";
    Event.EXIT_FRAME = "exitFrame";
    Event.EXITING = "exiting";
    Event.FRAME_CONSTRUCTED = "frameConstructed";
    Event.FRAME_LABEL = "frameLabel";
    Event.HTML_RENDER = "htmlRender";
    Event.FULLSCREEN = "fullScreen";
    Event.HTML_BOUNDS_CHANGE = "htmlBoundsChange";
    Event.HTML_DOM_INITIALIZE = "htmlDOMInitialize";
    exports.Event = Event;
});
//# sourceMappingURL=Event.js.map