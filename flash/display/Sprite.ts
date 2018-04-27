import { DisplayObjectContainer } from "flash/display/DisplayObjectContainer";
import { Graphics } from "flash/display/Graphics";
import { DisplayObject } from "flash/display/DisplayObject";
import { Rectangle } from "flash/geom/Rectangle";
import { IChildrenOwner } from "flash/display3D/types/IChildrenOwner";
import { Event } from "flash/events/Event";

// typed

export class Sprite extends DisplayObjectContainer implements IChildrenOwner
{
    protected _buttonMode:boolean;
    protected _dropTarget:DisplayObject;
    protected _graphics:Graphics;
    protected _hitArea:Sprite;
    protected _useHandCursor:boolean;

    constructor()
    {
        super();
        this._buttonMode = false;
        this._useHandCursor = false;
        this._dropTarget = null;
        this._graphics = null;
        this._hitArea = null;
    }

    public renderWebGL():void
    {
        if(this.hasEventListener(Event.ENTER_FRAME))
        {
            if(!this._enterFrameEvent)
            {
                this._enterFrameEvent = new Event(Event.ENTER_FRAME);
            }
            this.dispatchEvent(this._enterFrameEvent);
        }
        if(!this._parent)
        {
            return;
        }
        if (!this.visible || this.worldAlpha <= 0 || !this.renderable)
        {
            return;
        }
        if(this.transform.requireUpdate || this.parent.transform.requireUpdate)
        {            
            this.transform.updateWorldTransform(this.parent.transform);            
        }
        if(this._graphics)
        {
            if(this._graphics.parent != this._parent)
            {
                this._graphics.parent = this._parent;
            }
            this._graphics.transform = this.transform;
            this._graphics._renderWebGL();
        }
        if (this._mask || this._filters)
        {          
            this.renderAdvancedWebGL();
        }
        else
        {               
            this._renderWebGL();
            for (let i = 0, j = this.children.length; i < j; ++i)
            {
                this.children[i].transform.forceUpdate();
                this.children[i].renderWebGL();
            }
        }
        this.transform.update();
        if(this.hasEventListener(Event.EXIT_FRAME))
        {
            if(!this._exitFrameEvent)
            {
                this._exitFrameEvent = new Event(Event.EXIT_FRAME);
            }
            this.dispatchEvent(this._exitFrameEvent);
        }
    }

    public get buttonMode():boolean
    {
        return this._buttonMode;
    }

    public set buttonMode(value:boolean)
    {
        this._buttonMode = value;
        // to implement
    }

    public get dropTarget():DisplayObject
    {
        return this._dropTarget;
    }

    public get graphics():Graphics
    {
        if(!this._graphics)
        {
            this._graphics = new Graphics();            
        }
        return this._graphics;
    }

    public get hitArea():Sprite
    {
        return this._hitArea;
    }

    public set hitArea(value:Sprite)
    {
        this._hitArea = value;
        // to implement
    }

    public get useHandCursor():boolean
    {
        return this._useHandCursor;
    }

    public set useHandCursor(value:boolean)
    {
        this._useHandCursor = value;
        // to implement
    }

    public startDrag(lockCenter:boolean = false, bounds:Rectangle = null):void
    {
        // to implement
    }

    public startTouchDrag(touchPointID:number, lockCenter:boolean = false, bounds:Rectangle = null):void
    {
        // to implement
    }

    public stopDrag():void
    {
        // to implement
    }

    public stopTouchDrag(touchPointID:number):void
    {
        // to implement
    }
}