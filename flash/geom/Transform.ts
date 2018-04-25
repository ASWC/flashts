import { TransformBase } from "flash/rendering/math/TransformBase";
import { Point } from "flash/geom/Point";
import { Matrix } from "flash/geom/Matrix";

export class Transform extends TransformBase
{
    public static NEUTRAL:Transform = new Transform();

    constructor()
    {
        super();       
    }

    public updateLocalTransform():void
    {
        const lt = this._localTransform;
        lt.a = this._cx * this._scale.x;
        lt.b = this._sx * this._scale.x;
        lt.c = this._cy * this._scale.y;
        lt.d = this._sy * this._scale.y;
        lt.tx = this._position.x - ((this._pivot.x * lt.a) + (this._pivot.y * lt.c));
        lt.ty = this._position.y - ((this._pivot.x * lt.b) + (this._pivot.y * lt.d));
    }

    public updateTransform(parentTransform:TransformBase):void
    {
        const lt = this._localTransform;
        lt.a = this._cx * this._scale.x;
        lt.b = this._sx * this._scale.x;
        lt.c = this._cy * this._scale.y;
        lt.d = this._sy * this._scale.y;
        lt.tx = this._position.x - ((this._pivot.x * lt.a) + (this._pivot.y * lt.c));
        lt.ty = this._position.y - ((this._pivot.x * lt.b) + (this._pivot.y * lt.d));
        const pt = parentTransform.worldTransform;
        const wt = this._worldTransform;
        wt.a = (lt.a * pt.a) + (lt.b * pt.c);
        wt.b = (lt.a * pt.b) + (lt.b * pt.d);
        wt.c = (lt.c * pt.a) + (lt.d * pt.c);
        wt.d = (lt.c * pt.b) + (lt.d * pt.d);
        wt.tx = (lt.tx * pt.a) + (lt.ty * pt.c) + pt.tx;
        wt.ty = (lt.tx * pt.b) + (lt.ty * pt.d) + pt.ty;
        this._worldID ++;
    }

    public setFromMatrix(matrix:Matrix):void
    {
        matrix.decompose(this);
    }


}