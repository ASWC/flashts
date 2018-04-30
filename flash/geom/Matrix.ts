import { Point } from "flash/geom/Point";
import { Constants } from "flash/rendering/managers/Constants";
import { TransformBase } from "flash/geom/TransformBase";

export class Matrix
{
    public static GLOBAL:Matrix = new Matrix();
    
    protected _a:number;
    protected _b:number;
    protected _c:number;
    protected _d:number;
    protected _tx:number;
    protected _ty:number;
    protected array:number[];
    protected _requireUpdate:boolean;

    constructor(a:number = 1, b:number = 0, c:number = 0, d:number = 1, tx:number = 0, ty:number = 0)
    {
        this._a = a;
        this._b = b;
        this._c = c;
        this._d = d;
        this._tx = tx;
        this._ty = ty || 0;
        this.array = null;
        this._requireUpdate = false;
    }

    public get ty():number
    {
        return this._ty;
    }

    public set ty(value:number)
    {
        this._ty = value;
        this._requireUpdate = true;
    }

    public get tx():number
    {
        return this._tx;
    }

    public set tx(value:number)
    {
        this._tx = value;
        this._requireUpdate = true;
    }

    public get d():number
    {
        return this._d;
    }

    public set d(value:number)
    {
        this._d = value;
        this._requireUpdate = true;
    }

    public get c():number
    {
        return this._c;
    }

    public set c(value:number)
    {
        this._c = value;
        this._requireUpdate = true;
    }

    public get b():number
    {
        return this._b;
    }

    public set b(value:number)
    {
        this._b = value;
        this._requireUpdate = true;
    }

    public get a():number
    {
        return this._a;
    }

    public set a(value:number)
    {
        this._a = value;
        this._requireUpdate = true;
    }

    public update():void
    {
        this._requireUpdate = false;
    }

    public get requireUpdate():boolean
    {
        return this._requireUpdate;
    }

    public fromArray(array:number[]):void
    {
        this._a = array[0];
        this._b = array[1];
        this._c = array[3];
        this._d = array[4];
        this._tx = array[2];
        this._ty = array[5];
        this._requireUpdate = true;
    }

    public set(a:number, b:number, c:number, d:number, tx:number, ty:number):Matrix
    {
        this._a = a;
        this._b = b;
        this._c = c;
        this._d = d;
        this._tx = tx;
        this._ty = ty;
        this._requireUpdate = true;
        return this;
    }

    public toArray(transpose:boolean, out:Float32Array = null):number[]|Float32Array
    {
        if (!this.array)
        {            
            this.array = [];
        }
        const array = out || this.array;
        if (transpose)
        {
            array[0] = this._a;
            array[1] = this._b;
            array[2] = 0;
            array[3] = this._c;
            array[4] = this._d;
            array[5] = 0;
            array[6] = this._tx;
            array[7] = this._ty;
            array[8] = 1;
        }
        else
        {
            array[0] = this._a;
            array[1] = this._c;
            array[2] = this._tx;
            array[3] = this._b;
            array[4] = this._d;
            array[5] = this._ty;
            array[6] = 0;
            array[7] = 0;
            array[8] = 1;
        }
        return array;
    }

    public apply(pos:Point, newPos:Point):Point
    {
        newPos = newPos || new Point();
        const x = pos.x;
        const y = pos.y;
        newPos.x = (this._a * x) + (this._c * y) + this._tx;
        newPos.y = (this._b * x) + (this._d * y) + this._ty;
        return newPos;
    }

    public applyInverse(pos:Point, newPos:Point):Point
    {
        newPos = newPos || new Point();
        const id = 1 / ((this._a * this._d) + (this._c * -this._b));
        const x = pos.x;
        const y = pos.y;
        newPos.x = (this._d * id * x) + (-this._c * id * y) + (((this._ty * this._c) - (this._tx * this._d)) * id);
        newPos.y = (this._a * id * y) + (-this._b * id * x) + (((-this._ty * this._a) + (this._tx * this._b)) * id);
        return newPos;
    }

    public translate(x:number, y:number):Matrix
    {
        this._tx += x;
        this._ty += y;
        this._requireUpdate = true;
        return this;
    }

    public scale(x:number, y:number):Matrix
    {
        this._a *= x;
        this._d *= y;
        this._c *= x;
        this._b *= y;
        this._tx *= x;
        this._ty *= y;
        this._requireUpdate = true;
        return this;
    }

    public rotate(angle:number):Matrix
    {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const a1 = this._a;
        const c1 = this._c;
        const tx1 = this._tx;
        this._a = (a1 * cos) - (this._b * sin);
        this._b = (a1 * sin) + (this._b * cos);
        this._c = (c1 * cos) - (this._d * sin);
        this._d = (c1 * sin) + (this._d * cos);
        this._tx = (tx1 * cos) - (this._ty * sin);
        this._ty = (tx1 * sin) + (this._ty * cos);
        this._requireUpdate = true;
        return this;
    }

    public append(matrix:Matrix):Matrix
    {
        const a1 = this._a;
        const b1 = this._b;
        const c1 = this._c;
        const d1 = this._d;
        this._a = (matrix._a * a1) + (matrix._b * c1);
        this._b = (matrix._a * b1) + (matrix._b * d1);
        this._c = (matrix._c * a1) + (matrix._d * c1);
        this._d = (matrix._c * b1) + (matrix._d * d1);
        this._tx = (matrix._tx * a1) + (matrix._ty * c1) + this._tx;
        this._ty = (matrix._tx * b1) + (matrix._ty * d1) + this._ty;
        this._requireUpdate = true;
        return this;
    }

    public setTransform(x:number, y:number, pivotX:number, pivotY:number, scaleX:number, scaleY:number, rotation:number, skewX:number, skewY:number):Matrix
    {
        this._a = Math.cos(rotation + skewY) * scaleX;
        this._b = Math.sin(rotation + skewY) * scaleX;
        this._c = -Math.sin(rotation - skewX) * scaleY;
        this._d = Math.cos(rotation - skewX) * scaleY;
        this._tx = x - ((pivotX * this._a) + (pivotY * this._c));
        this._ty = y - ((pivotX * this._b) + (pivotY * this._d));
        this._requireUpdate = true;
        return this;
    }

    public prepend(matrix:Matrix):Matrix
    {
        const tx1 = this._tx;
        if (matrix._a !== 1 || matrix._b !== 0 || matrix._c !== 0 || matrix._d !== 1)
        {
            const a1 = this._a;
            const c1 = this._c;
            this._a = (a1 * matrix._a) + (this._b * matrix._c);
            this._b = (a1 * matrix._b) + (this._b * matrix._d);
            this._c = (c1 * matrix._a) + (this._d * matrix._c);
            this._d = (c1 * matrix._b) + (this._d * matrix._d);
        }
        this._tx = (tx1 * matrix._a) + (this._ty * matrix._c) + matrix._tx;
        this._ty = (tx1 * matrix._b) + (this._ty * matrix._d) + matrix._ty;
        this._requireUpdate = true;
        return this;
    }

    public decompose(transform:TransformBase):TransformBase
    {
        const a = this._a;
        const b = this._b;
        const c = this._c;
        const d = this._d;
        const skewX = -Math.atan2(-c, d);
        const skewY = Math.atan2(b, a);
        const delta = Math.abs(skewX + skewY);
        if (delta < 0.00001 || Math.abs(Constants.PI_2 - delta) < 0.00001)
        {
            transform.rotation = skewY;
            if (a < 0 && d >= 0)
            {
                transform.rotation += (transform.rotation <= 0) ? Math.PI : -Math.PI;
            }
            transform.skew.x = transform.skew.y = 0;
        }
        else
        {
            transform.rotation = 0;
            transform.skew.x = skewX;
            transform.skew.y = skewY;
        }
        transform.scale.x = Math.sqrt((a * a) + (b * b));
        transform.scale.y = Math.sqrt((c * c) + (d * d));
        transform.position.x = this._tx;
        transform.position.y = this._ty;
        return transform;
    }

    public invert():Matrix
    {
        const a1 = this._a;
        const b1 = this._b;
        const c1 = this._c;
        const d1 = this._d;
        const tx1 = this._tx;
        const n = (a1 * d1) - (b1 * c1);
        this._a = d1 / n;
        this._b = -b1 / n;
        this._c = -c1 / n;
        this._d = a1 / n;
        this._tx = ((c1 * this._ty) - (d1 * tx1)) / n;
        this._ty = -((a1 * this._ty) - (b1 * tx1)) / n;
        this._requireUpdate = true;
        return this;
    }

    public identity():Matrix
    {
        this._a = 1;
        this._b = 0;
        this._c = 0;
        this._d = 1;
        this._tx = 0;
        this._ty = 0;
        this._requireUpdate = true;
        return this;
    }

    public clone():Matrix
    {
        const matrix = new Matrix();
        matrix.a = this._a;
        matrix.b = this._b;
        matrix.c = this._c;
        matrix.d = this._d;
        matrix.tx = this._tx;
        matrix.ty = this._ty;
        return matrix;
    }

    public copy(matrix:Matrix):Matrix
    {
        matrix.a = this._a;
        matrix.b = this._b;
        matrix.c = this._c;
        matrix.d = this._d;
        matrix.tx = this._tx;
        matrix.ty = this._ty;
        return matrix;
    }

    public static get IDENTITY():Matrix
    {
        return new Matrix();
    }

    public static get TEMP_MATRIX():Matrix
    {
        return new Matrix();
    }
}