import { Matrix } from "flash/geom/Matrix";
import { Point } from "flash/geom/Point";
import { BaseObject } from "../core/BaseObject";
import { Constants } from "../managers/Constants";

class TransformBase extends BaseObject
{
    public static IDENTITY:TransformBase = new TransformBase();
    protected _position:Point;
    protected _worldTransform:Matrix;
    protected _localTransform:Matrix;
    public _parentID:number;
    public _worldID:number;
    protected _rotation:number;
    protected _skew:Point;
    protected _sx:number;
    protected _cy:number;
    protected _sy:number;
    protected _cx:number;
    protected _pivot:Point; 
    protected _scale:Point;
    protected _requireUpdate:boolean;

    constructor()
    {
        super();
        this._position = new Point(0, 0);
        this._scale = new Point(1, 1);        
        this._pivot = new Point(0, 0);
        this._skew = new Point(0, 0);
        this._worldTransform = new Matrix();
        this._localTransform = new Matrix();
        this._worldID = 0;
        this._parentID = 0;
        this._cx = 1; 
        this._sx = 0; 
        this._cy = 0;
        this._sy = 1;
        this._rotation = 0;
    }

    public update():void
    {
        this._requireUpdate = false;
        this._scale.update();
        this._pivot.update();
        this._skew.update();
        this._localTransform.update();
        this._position.update();
        this._worldTransform.update();
    }

    public forceUpdate():void
    {
        this._requireUpdate = true;
    }

    public get requireUpdate():boolean
    {
        if(this._requireUpdate)
        {
            return true;
        }
        if(this._scale.requireUpdate)
        {
            return true;
        }
        if(this._pivot.requireUpdate)
        {
            return true;
        }
        if(this._skew.requireUpdate)
        {
            return true;
        }
        if(this._localTransform.requireUpdate)
        {
            return true;
        }
        if(this._position.requireUpdate)
        {
            return true;
        }
        if(this._worldTransform.requireUpdate)
        {
            return true;
        }
        return false;
    }

    public updateSkew():void
    {
        this._cx = Math.cos(this._rotation + this._skew.y);
        this._sx = Math.sin(this._rotation + this._skew.y);
        this._cy = -Math.sin(this._rotation - this._skew.x);
        this._sy = Math.cos(this._rotation - this._skew.x); 
        this._requireUpdate = true;
    }

    public get rotation():number
    {
        return this._rotation * Constants.RAD_TO_DEG;
    }

    public set rotation(value:number)
    {
        this._rotation = value * Constants.DEG_TO_RAD;
        this.updateSkew();
    }

    public get worldTransform():Matrix
    {
        return this._worldTransform;
    }

    public set worldTransform(value:Matrix)
    {
        this._worldTransform = value;
        this._requireUpdate = true;
    }

    public get localTransform():Matrix
    {
        return this._localTransform;
    }

    public set localTransform(value:Matrix)
    {
        this._localTransform = value;
        this._requireUpdate = true;
    }

    public get position():Point
    {
        return this._position;
    }

    public set position(value:Point)
    {
        this._position = value;
        this._requireUpdate = true;
    }

    public get pivot():Point
    {
        return this._pivot;
    }

    public set pivot(value:Point)
    {
        this._pivot = value;
        this._requireUpdate = true;
    }

    public get skew():Point
    {
        return this._skew;
    }

    public set skew(value:Point)
    {
        this._skew = value;
        this._requireUpdate = true;
    }

    public get scale():Point
    {
        return this._scale;
    }

    public set scale(value:Point)
    {
        this._scale = value;
        this._requireUpdate = true;
    }

    public updateLocalTransform():void
    {
        
    }

    public updateWorldTransform(parentTransform:TransformBase):void
    {
        this.updateTransform(parentTransform);
    }

    public updateTransform(parentTransform:TransformBase):void
    {
        const pt = parentTransform._worldTransform;
        const wt = this._worldTransform;
        const lt = this._localTransform;
        wt.a = (lt.a * pt.a) + (lt.b * pt.c);
        wt.b = (lt.a * pt.b) + (lt.b * pt.d);
        wt.c = (lt.c * pt.a) + (lt.d * pt.c);
        wt.d = (lt.c * pt.b) + (lt.d * pt.d);
        wt.tx = (lt.tx * pt.a) + (lt.ty * pt.c) + pt.tx;
        wt.ty = (lt.tx * pt.b) + (lt.ty * pt.d) + pt.ty;
        this._worldID ++;
    }
}
export { TransformBase };