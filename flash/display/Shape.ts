import { DisplayObject } from "flash/display/DisplayObject";
import { Graphics } from "flash/display/Graphics";
import { IGraphicOwner } from "flash/rendering/core/exports/IGraphicOwner";
import { IDisplayObjectContainer } from "flash/display/IDisplayObjectContainer";
import { Event } from "flash/events/Event";

export class Shape extends DisplayObject implements IGraphicOwner
{
    protected _graphics:Graphics;

    constructor()
    {
        super();
        this._graphics = null;
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
        if(this.transform.requireUpdate || this._parent.transform.requireUpdate)
        {
            this.transform.updateWorldTransform(this._parent.transform);
            this.transform.update();
        }
        else
        {
            
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
        if(this.hasEventListener(Event.EXIT_FRAME))
        {
            if(!this._exitFrameEvent)
            {
                this._exitFrameEvent = new Event(Event.EXIT_FRAME);
            }
            this.dispatchEvent(this._exitFrameEvent);
        }
    }

    public set parent(value:IDisplayObjectContainer)
    {
        this._parent = value;
        if(this._graphics)
        {
            this._graphics.parent = value;
        }
    }

    public get graphics():Graphics
    {
        if(!this._graphics)
        {
            this._graphics = new Graphics();            
        }
        return this._graphics;
    }
}