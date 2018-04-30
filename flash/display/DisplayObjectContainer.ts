
import { Utils } from "flash/rendering/webgl/Utils";
import { Event } from "flash/events/Event";
import { IDisplayObjectContainer } from "flash/display/IDisplayObjectContainer";
import { DisplayObject } from "flash/display/DisplayObject";
import { IGraphicOwner } from "flash/display3D/types/IGraphicOwner";
import { Transform } from "flash/geom/Transform";
import { Filter } from "../rendering/filters/Filter";

// TYPED

export class DisplayObjectContainer extends DisplayObject implements IDisplayObjectContainer
{
    protected children:DisplayObject[];
    protected _mouseChildren:boolean;

    constructor()
    {
        super();
        this.children = [];
    }

    public contains(child:DisplayObject):boolean
    {
        var index:number = this.children.indexOf(child);
        if(index >= 0)
        {
            return true;
        }
        return false;
    }

    public getChildByName(name:string):DisplayObject
    {
        for (let i:number = 0; i < this.children.length; i++)
        {
            if (this.children[i].name === name)
            {
                return this.children[i];
            }
        }
        return null;
    };

    public onChildrenChange(value:number = null)
    {
       
    }

    public addChild(child:DisplayObject):DisplayObject
    {
        if(!child)
        {
            return;
        }
        if (child.parent)
        {
            child.parent.removeChild(child);
        }
        child.parent = this;
        child.transform.parentID = -1;
        this.children.push(child);
        this._boundsID++;
        this.onChildrenChange(this.children.length - 1);
        child.dispatchEvent(new Event(Event.ADDED));
        return child;
    }

    public addChildAt(child:DisplayObject, index:number):DisplayObject
    {
        if (index < 0 || index > this.children.length)
        {
            throw new Error(`${child}addChildAt: The index ${index} supplied is out of bounds ${this.children.length}`);
        }
        if (child.parent)
        {
            child.parent.removeChild(child);
        }
        child.parent = this;
        child.transform.parentID = -1;
        this.children.splice(index, 0, child);
        this._boundsID++;
        this.onChildrenChange(index);
        child.dispatchEvent(new Event(Event.ADDED));
        return child;
    }

    public swapChildren(child:DisplayObject, child2:DisplayObject):void
    {
        if (child === child2)
        {
            return;
        }
        const index1:number = this.getChildIndex(child);
        const index2:number = this.getChildIndex(child2);
        this.children[index1] = child2;
        this.children[index2] = child;
        this.onChildrenChange(index1 < index2 ? index1 : index2);
    }

    public getChildIndex(child:DisplayObject):number
    {
        const index:number = this.children.indexOf(child);
        if (index < 0)
        {
            throw new Error('The supplied DisplayObject must be a child of the caller');
        }
        return index;
    }

    public setChildIndex(child:DisplayObject, index:number):void
    {
        if (index < 0 || index >= this.children.length)
        {
            throw new Error(`The index ${index} supplied is out of bounds ${this.children.length}`);
        }
        const currentIndex:number = this.getChildIndex(child);
        Utils.removeItems(this.children, currentIndex, 1); 
        this.children.splice(index, 0, child);
        this.onChildrenChange(index);
    }

    public getChildAt(index:number):DisplayObject
    {
        if (index < 0 || index >= this.children.length)
        {
            throw new Error(`getChildAt: Index (${index}) does not exist.`);
        }
        return this.children[index];
    }

    public removeChild(child:DisplayObject):DisplayObject
    {
        const index = this.children.indexOf(child);
        if (index < 0) return null;
        child.parent = null;
        child.transform.parentID = -1;
        Utils.removeItems(this.children, index, 1);
        this._boundsID++;
        this.onChildrenChange(index);
        child.dispatchEvent(new Event(Event.REMOVED));       
        return child;
    }

    public removeChildAt(index:number):DisplayObject
    {
        const child:DisplayObject = this.getChildAt(index);
        child.parent = null;
        child.transform.parentID = -1;
        Utils.removeItems(this.children, index, 1);
        this._boundsID++;
        this.onChildrenChange(index);
        child.dispatchEvent(new Event(Event.REMOVED));
        return child;
    }

    public removeChildren(beginIndex:number = 0, endIndex:number = 0):DisplayObject[]
    {
        const begin:number = beginIndex;
        const end:number = typeof endIndex === 'number' ? endIndex : this.children.length;
        const range:number = end - begin;
        let removed:DisplayObject[];
        if (range > 0 && range <= end)
        {
            removed = this.children.splice(begin, range);
            for (let i:number = 0; i < removed.length; ++i)
            {
                removed[i].parent = null;
                if (removed[i].transform)
                {
                    removed[i].transform.parentID = -1;
                }
            }
            this._boundsID++;
            this.onChildrenChange(beginIndex);
            for (let i = 0; i < removed.length; ++i)
            {
                removed[i].dispatchEvent(new Event(Event.REMOVED));
            }
            return removed;
        }
        else if (range === 0 && this.children.length === 0)
        {
            return [];
        }
        throw new RangeError('removeChildren: numeric values are outside the acceptable range.');
    }

    public updateTransform():void
    {
        if(this._parent)
        {
            this._boundsID++;
            this.transform.updateTransform(this.parent.transform);
            this.worldAlpha = this.alpha * this.parent.worldAlpha;
            for (let i = 0, j = this.children.length; i < j; ++i)
            {
                const child:DisplayObject = this.children[i];
                if (child.visible)
                {
                    child.updateTransform();
                }
            }
        }        
    }

    public calculateBounds():void
    {
        this._bounds.clear();
        this._calculateBounds();
        for (let i = 0; i < this.children.length; i++)
        {
            const child:DisplayObject = this.children[i];
            if (!child.visible || !child.renderable)
            {
                continue;
            }
            child.calculateBounds();
            if (child.mask)
            {
                child.mask.calculateBounds();
                this._bounds.addBoundsMask(child.bounds, child.mask.bounds);
            }
            else if (child.filterArea)
            {
                this._bounds.addBoundsArea(child.bounds, child.filterArea);
            }
            else
            {
                this._bounds.addBounds(child.bounds);
            }
        }
        this._lastBoundsID = this._boundsID;
    }

    public _calculateBounds():void
    {
       
    }

    public renderWebGL():void
    {
        super.renderWebGL();
        if (!this.visible || this.worldAlpha <= 0 || !this.renderable)
        {
            return;
        }
        if(this.transform.requireUpdate)
        {
            if(this.parent)
            {   
                this.transform.updateWorldTransform(this.parent.transform);
            }
            else
            {
                this.transform.updateWorldTransform(Transform.NEUTRAL);
            }
            this.transform.update();
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
                this.children[i].renderWebGL();
            }
        }
    }

    protected renderAdvancedWebGL():void
    {
        if(!this.stage)
        {
            return;
        }
        this.stage.flush();
        const filters:Filter[] = this._filters;
        const mask:DisplayObject = this._mask;
        if (filters)
        {
            if (!this._enabledFilters)
            {
                this._enabledFilters = [];
            }
            this._enabledFilters.length = 0;
            for (let i = 0; i < filters.length; i++)
            {
                if (filters[i].enabled)
                {
                    this._enabledFilters.push(filters[i]);
                }
            }
            if (this._enabledFilters.length)
            {
                this.stage.getFilterManager().pushFilter(this, this._enabledFilters);
            }
        }
        if (mask)
        {
            this.stage.getMaskManager().pushMask(this, this._mask);
        }
        this._renderWebGL();
        for (let i = 0, j = this.children.length; i < j; i++)
        {
            this.children[i].renderWebGL();
        }
        this.stage.flush();
        if (mask)
        {
            this.stage.getMaskManager().popMask(this, this._mask);
        }
        if (filters && this._enabledFilters && this._enabledFilters.length)
        {
            this.stage.getFilterManager().popFilter();
        }
    }

    protected _renderWebGL():void 
    {
        
    }

    public destroy():void
    {
        super.destroy();
        const oldChildren = this.removeChildren(0, this.children.length);      
        for (let i:number = 0; i < oldChildren.length; ++i)
        {
            oldChildren[i].destroy();
        }      
    }

    public getChildren():DisplayObject[]
    {
        return this.children;
    }

    public get mouseChildren():boolean
    {
        return this._mouseChildren;
    }

    public set mouseChildren(value:boolean)
    {
        this._mouseChildren = value;
        for (let i = 0; i < this.children.length; i++)
        {
            var child:DisplayObject = this.children[i];           
            child['mouseEnabled'] = this._mouseChildren;                        
        }
    }

    public get numChildren():number
    {
        if(this.children)
        {
            return this.children.length;
        }
        return 0;
    }


}