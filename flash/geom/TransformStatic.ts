import { TransformBase } from "flash/geom/TransformBase"
import { Matrix } from "flash/geom/Matrix";
import { Point } from "flash/geom/Point";

export class TransformStatic extends TransformBase
{    
    protected _currentLocalID:number;    
    protected _localID:number;
    
    constructor()
    {
        super();
        this._localID = 0;
        this._currentLocalID = 0;
    }

    public updateSkew():void
    {
        super.updateSkew();
        this._localID ++;
    }

    public updateLocalTransform():void
    {
        const lt:Matrix = this._localTransform;
        if (this._localID !== this._currentLocalID)
        {
            lt.a = this._cx * this._scale.x;
            lt.b = this._sx * this._scale.x;
            lt.c = this._cy * this._scale.y;
            lt.d = this._sy * this._scale.y;
            lt.tx = this._position.x - ((this._pivot.x * lt.a) + (this._pivot.y * lt.c));
            lt.ty = this._position.y - ((this._pivot.x * lt.b) + (this._pivot.y * lt.d));
            this._currentLocalID = this._localID;
            this._parentID = -1;
        }
    }

    public updateTransform(parentTransform:TransformBase):void
    {
        const lt:Matrix = this._localTransform;
        if (this._localID !== this._currentLocalID)
        {
            lt.a = this._cx * this._scale.x;
            lt.b = this._sx * this._scale.x;
            lt.c = this._cy * this._scale.y;
            lt.d = this._sy * this._scale.y;
            lt.tx = this._position.x - ((this._pivot.x * lt.a) + (this._pivot.y * lt.c));
            lt.ty = this._position.y - ((this._pivot.x * lt.b) + (this._pivot.y * lt.d));
            this._currentLocalID = this._localID;
            this._parentID = -1;
        }
        if (this._parentID !== parentTransform.worldID)
        {
            const pt:Matrix = parentTransform.worldTransform;
            const wt:Matrix = this._worldTransform;
            wt.a = (lt.a * pt.a) + (lt.b * pt.c);
            wt.b = (lt.a * pt.b) + (lt.b * pt.d);
            wt.c = (lt.c * pt.a) + (lt.d * pt.c);
            wt.d = (lt.c * pt.b) + (lt.d * pt.d);
            wt.tx = (lt.tx * pt.a) + (lt.ty * pt.c) + pt.tx;
            wt.ty = (lt.tx * pt.b) + (lt.ty * pt.d) + pt.ty;
            this._parentID = parentTransform.worldID;
            this._worldID ++;
        }
    }

    public setFromMatrix(matrix:Matrix):void
    {
        matrix.decompose(this);
        this._localID ++;
    }


}