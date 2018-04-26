

import { CoreDisplayObject } from "flash/rendering/core/CoreDisplayObject";
import { Matrix } from "flash/geom/Matrix";
import { Point } from "flash/geom/Point";
import { Event } from "flash/events/Event";

// TYPED

export class DisplayObject extends CoreDisplayObject
{
    protected static _tempMatrix:Matrix = new Matrix();     
    protected _mask:DisplayObject;       
    protected _enterFrameEvent:Event;
    protected _exitFrameEvent:Event;

    constructor()
    {
        super();       
        this._mask = null;        
    }

    protected toLocal(position:Point, from:DisplayObject, point:Point, skipUpdate:boolean):Point
    {
        if (from)
        {
            position = from.toGlobal(position, point, skipUpdate);
        }
        if (!skipUpdate)
        {
            this._recursivePostUpdateTransform();
            if (!this._parent)
            {
                //this._parent = Stage.emptyRoot;
                this.updateTransform();
                this._parent = null;
            }
            else
            {
                this.updateTransform();
            }
        }
        return this.worldTransform.applyInverse(position, point);
    }

    protected setTransform(x:number = 0, y:number = 0, scaleX:number = 1, scaleY:number = 1, rotation:number = 0, skewX:number = 0, skewY:number = 0, pivotX:number = 0, pivotY:number = 0):DisplayObject
    {
        this.position.x = x;
        this.position.y = y;
        this.scale.x = !scaleX ? 1 : scaleX;
        this.scale.y = !scaleY ? 1 : scaleY;
        this.rotation = rotation;
        this.skew.x = skewX;
        this.skew.y = skewY;
        this.pivot.x = pivotX;
        this.pivot.y = pivotY;
        return this;
    }

    protected get worldVisible():boolean
    {
        let item:any = this;
        do
        {
            if(item instanceof DisplayObject)
            {
                if (!item._visible)
                {
                    return false;
                }
                item = item._parent;            
            }
            
        } while (item);
        return true;
    }

    public get mask():DisplayObject
    {
        return this._mask;
    }

    public set mask(value:DisplayObject) 
    {
        if (this._mask)
        {
            this._mask.renderable = true;
            this._mask.isMask = false;
        }
        this._mask = value;
        if (this._mask)
        {
            this._mask.renderable = false;
            this._mask.isMask = true;
        }
    }

    public get z():number
    {
        return 0;
    }

    public set z(value:number) 
    {
        
    }

    public get root():DisplayObject
    {
        return null;
    }

}


