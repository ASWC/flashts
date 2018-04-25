import { BaseObject } from "flash/rendering/core/BaseObject";

export class Event extends BaseObject
{
    public static ACTIVATE:string = "activate"
    public static ADDED:string = "added"
    public static ADDED_TO_STAGE:string = "addedToStage"
    public static BROWSER_ZOOM_CHANGE:string = "browserZoomChange"
    public static CANCEL:string = "cancel"
    public static CHANGE:string = "change"
    public static ERROR:string = "error"
    public static CHANNEL_MESSAGE:string = "channelMessage"
    public static CHANNEL_STATE:string = "channelState"
    public static CLEAR:string = "clear"
    public static CLOSE:string = "close"
    public static CLOSING:string = "closing"
    public static SELECT:string = "select"
    public static SELECT_ALL:string = "selectAll"
    public static TAB_INDEX_CHANGE:string = "tabIndexChange"
    public static TEXT_INTERACTION_MODE_CHANGE:string = "textInteractionModeChange"
    public static TEXTURE_READY:string = "textureReady"
    public static UNLOAD:string = "unload"
    public static USER_IDLE:string = "userIdle"
    public static USER_PRESENT:string = "userPresent"
    public static VIDEO_FRAME:string = "videoFrame"
    public static WORKER_STATE:string = "workerState"
    public static SOUND_COMPLETE:string = "soundComplete"
    public static STANDARD_ERROR_CLOSE:string = "standardErrorClose"
    public static STANDARD_INPUT_CLOSE:string = "standardInputClose"
    public static STANDARD_OUTPUT_CLOSE:string = "standardOutputClose"
    public static SUSPEND:string = "suspend"
    public static TAB_CHILDREN_CHANGE:string = "tabChildrenChange"
    public static TAB_ENABLED_CHANGE:string = "tabEnabledChange"
    public static REMOVED:string = "removed"
    public static COMPLETE:string = "complete"
    public static PASTE:string = "paste"
    public static RENDER:string = "render"
    public static RESIZE:string = "resize"
    public static SCROLL:string = "scroll"
    public static CONNECT:string = "connect"
    public static CONTEXT3D_CREATE:string = "context3DCreate"
    public static COPY:string = "copy"
    public static NETWORK_CHANGE:string = "networkChange"
    public static ID3:string = "id3"
    public static REMOVED_FROM_STAGE:string = "removedFromStage"
    public static PREPARING:string = "preparing"
    public static INIT:string = "init"
    public static OPEN:string = "open"
    public static LOCATION_CHANGE:string = "locationChange"
    public static CUT:string = "cut"
    public static MOUSE_LEAVE:string = "mouseLeave"
    public static DEACTIVATE:string = "deactivate"
    public static DISPLAYING:string = "displaying"
    public static ENTER_FRAME:string = "enterFrame"
    public static EXIT_FRAME:string = "exitFrame"
    public static EXITING:string = "exiting"
    public static FRAME_CONSTRUCTED:string = "frameConstructed"
    public static FRAME_LABEL:string = "frameLabel"
    public static HTML_RENDER:string = "htmlRender"
    public static FULLSCREEN:string = "fullScreen"
    public static HTML_BOUNDS_CHANGE:string = "htmlBoundsChange"
    public static HTML_DOM_INITIALIZE:string = "htmlDOMInitialize"

    protected _bubbles:boolean;
    protected _cancelable:boolean;
    protected _defaultPrevented:boolean;
    protected _currentTarget:any;
    protected _eventPhase:number;
    protected _target:boolean;
    protected _type:string;

    constructor(type:string, bubbles:boolean = false, cancelable:boolean = false)
    {
        super();
        this._defaultPrevented = false;
        this._type = type;
        this._bubbles = bubbles;
        this._cancelable = cancelable;
        this._currentTarget = null;
        this._eventPhase = 0;
        this._target = null;
    }

    public get bubbles():boolean
    {
        return this._bubbles;
    }

    public get cancelable():boolean
    {
        return this._cancelable;
    }

    public get currentTarget():any
    {
        return this._currentTarget;
    }

    public get eventPhase():number
    {
        return this._eventPhase;
    }

    public get target():any
    {
        return this._target;
    }

    public get type():string
    {
        return this._type;
    }

    public clone():Event
    {
        return new Event(this._type, this._bubbles, this._cancelable);
    }

    public formatToString(className:string, ... rest):string
    {
        return this.className;
    }

    public isDefaultPrevented():boolean
    {
        return this._defaultPrevented;
    }

    public preventDefault():void
    {
        this._defaultPrevented = true;
    }

    public stopImmediatePropagation():void
    {
        
    }

    public stopPropagation():void
    {

    }

    public toString():string
    {
        return this.className;
    }

    public static linkEvent(event:Event, currentTarget:any = null, target:any = null):void
    {
        if(target)
        {
            event._target = target;
        }
        if(currentTarget)
        {
            event._currentTarget = currentTarget;
        }
    }
}